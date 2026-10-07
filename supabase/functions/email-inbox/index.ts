import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import Imap from "npm:imap@0.8.19";
import { simpleParser } from "npm:mailparser@3.7.1";
import nodemailer from "npm:nodemailer@6.9.15";
// Email inbox edge function — IMAP fetch + SMTP reply

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userSupabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await userSupabase.auth.getUser();
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const adminSupabase = createClient(supabaseUrl, supabaseKey);
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "fetch";

    // Load SMTP/IMAP settings
    const { data: settings, error: settingsError } = await adminSupabase
      .from("smtp_settings")
      .select("*")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (settingsError || !settings) {
      return new Response(
        JSON.stringify({ error: "Email settings not configured. Go to Settings to set up SMTP/IMAP." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── FETCH: pull new emails from IMAP ────────────────────────────────
    if (action === "fetch" && req.method === "GET") {
      if (!settings.imap_host || !settings.imap_username || !settings.imap_password) {
        return new Response(
          JSON.stringify({ error: "IMAP settings not configured. Go to Settings to set up IMAP." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Find the last fetched email date to avoid re-downloading old emails
      const { data: lastEmail } = await adminSupabase
        .from("email_inbox_messages")
        .select("created_at")
        .eq("user_id", userData.user.id)
        .eq("direction", "incoming")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const sinceDate = lastEmail?.created_at
        ? new Date(lastEmail.created_at)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // default: last 30 days

      const fetchedEmails: Array<{
        from_email: string;
        from_name: string | null;
        to_email: string;
        subject: string;
        body_text: string;
        body_html: string | null;
        message_id: string | null;
        in_reply_to: string | null;
        has_attachments: boolean;
        attachments: Array<{ filename: string; contentType: string; size: number }>;
        date: Date;
      }> = [];

      const imapConfig: Imap.Config = {
        user: settings.imap_username,
        password: settings.imap_password,
        host: settings.imap_host,
        port: settings.imap_port || 993,
        tls: settings.imap_use_tls !== false,
        tlsOptions: { rejectUnauthorized: false },
        connTimeout: 30000,
        authTimeout: 30000,
        socketTimeout: 30000,
      };

      const parsePromises: Promise<void>[] = [];

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          try { imapConn.end(); } catch {}
          reject(new Error("IMAP connection timed out after 45 seconds"));
        }, 45000);

        const imapConn = new Imap(imapConfig);

        imapConn.once("ready", () => {
          imapConn.openBox("INBOX", (err: Error | null) => {
            if (err) {
              clearTimeout(timeout);
              imapConn.end();
              reject(err);
              return;
            }

            const searchCriteria: Imap.SearchCriteria = [
              ["SINCE", sinceDate],
              ["UNSEEN"],
            ];

            imapConn.search(searchCriteria, (searchErr: Error | null, uids: number[]) => {
              if (searchErr) {
                clearTimeout(timeout);
                imapConn.end();
                reject(searchErr);
                return;
              }

              if (!uids || uids.length === 0) {
                clearTimeout(timeout);
                imapConn.end();
                resolve();
                return;
              }

              const fetch = imapConn.fetch(uids, { bodies: "", struct: true, envelope: true });

              fetch.on("message", (msg: Imap.ImapMessage) => {
                const chunks: Buffer[] = [];

                msg.on("body", (stream: NodeJS.ReadableStream) => {
                  stream.on("data", (chunk: Buffer) => { chunks.push(chunk); });
                });

                msg.once("end", () => {
                  const rawBuffer = Buffer.concat(chunks);
                  parsePromises.push(
                    (async () => {
                      try {
                        const parsed = await simpleParser(rawBuffer);

                        const fromAddr = parsed.from?.value?.[0]?.address || "unknown@unknown.com";
                        const fromName = parsed.from?.value?.[0]?.name || null;
                        const toAddr = parsed.to?.value?.[0]?.address || settings.from_email || settings.smtp_username || "";
                        const subject = parsed.subject || "(No Subject)";
                        const bodyText = parsed.text || "";
                        const bodyHtml = parsed.html || null;
                        const messageId = parsed.messageId || null;
                        const inReplyTo = parsed.inReplyTo || null;

                        const attachments = (parsed.attachments || []).map((a: { filename?: string; contentType?: string; size?: number }) => ({
                          filename: a.filename || "unnamed",
                          contentType: a.contentType || "application/octet-stream",
                          size: a.size || 0,
                        }));

                        fetchedEmails.push({
                          from_email: fromAddr,
                          from_name: fromName,
                          to_email: toAddr,
                          subject,
                          body_text: bodyText,
                          body_html: bodyHtml,
                          message_id: messageId,
                          in_reply_to: inReplyTo,
                          has_attachments: attachments.length > 0,
                          attachments,
                          date: parsed.date || new Date(),
                        });
                      } catch {
                        // skip unparseable emails
                      }
                    })()
                  );
                });
              });

              fetch.once("error", (fetchErr: Error) => {
                clearTimeout(timeout);
                imapConn.end();
                reject(fetchErr);
              });

              fetch.once("end", () => {
                clearTimeout(timeout);
                imapConn.end();
              });
            });
          });
        });

        imapConn.once("error", (err: Error) => {
          clearTimeout(timeout);
          reject(err);
        });

        imapConn.once("end", () => {
          resolve();
        });

        imapConn.connect();
      }).catch((err: Error) => {
        throw new Error(`IMAP connection failed: ${err.message}`);
      });

      // Wait for all email parsing to complete before storing
      await Promise.all(parsePromises);

      // Store fetched emails in the database
      let newCount = 0;
      let conversationCount = 0;

      for (const email of fetchedEmails) {
        // Skip if we already have this message_id
        if (email.message_id) {
          const { data: existing } = await adminSupabase
            .from("email_inbox_messages")
            .select("id")
            .eq("user_id", userData.user.id)
            .eq("message_id", email.message_id)
            .maybeSingle();
          if (existing) continue;
        }

        // Skip emails from ourselves (sent emails, drafts, etc.)
        if (
          email.from_email.toLowerCase() === (settings.from_email || settings.smtp_username || "").toLowerCase()
        ) {
          continue;
        }

        // Find or create conversation (grouped by from_email + subject)
        let conversationId: string | null = null;
        const { data: existingConv } = await adminSupabase
          .from("email_inbox_conversations")
          .select("id")
          .eq("user_id", userData.user.id)
          .eq("from_email", email.from_email)
          .maybeSingle();

        if (existingConv) {
          conversationId = existingConv.id;
          await adminSupabase
            .from("email_inbox_conversations")
            .update({
              last_message_text: email.body_text.slice(0, 200),
              last_message_at: email.date.toISOString(),
              unread_count: existingConv.unread_count + 1,
            })
            .eq("id", conversationId);
        } else {
          // Try to match a lead by email
          let leadId: string | null = null;
          const { data: lead } = await adminSupabase
            .from("submissions")
            .select("id")
            .eq("user_id", userData.user.id)
            .ilike("email", email.from_email)
            .is("deleted_at", null)
            .maybeSingle();
          if (lead) leadId = lead.id;

          const { data: newConv } = await adminSupabase
            .from("email_inbox_conversations")
            .insert({
              user_id: userData.user.id,
              from_email: email.from_email,
              from_name: email.from_name,
              subject: email.subject,
              last_message_text: email.body_text.slice(0, 200),
              last_message_at: email.date.toISOString(),
              unread_count: 1,
              lead_id: leadId,
            })
            .select("id")
            .single();

          conversationId = newConv?.id || null;
          if (conversationId) conversationCount++;
        }

        if (!conversationId) continue;

        await adminSupabase
          .from("email_inbox_messages")
          .insert({
            conversation_id: conversationId,
            user_id: userData.user.id,
            from_email: email.from_email,
            from_name: email.from_name,
            to_email: email.to_email,
            subject: email.subject,
            body_text: email.body_text,
            body_html: email.body_html,
            direction: "incoming",
            message_id: email.message_id,
            in_reply_to: email.in_reply_to,
            is_read: false,
            has_attachments: email.has_attachments,
            attachments: email.attachments,
            created_at: email.date.toISOString(),
          });

        newCount++;
      }

      return new Response(
        JSON.stringify({ success: true, fetched: newCount, conversations: conversationCount, total_seen: fetchedEmails.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── REPLY: send a reply via SMTP ────────────────────────────────────
    if (action === "reply" && req.method === "POST") {
      const body = await req.json();
      const { conversation_id, reply_text } = body;

      if (!conversation_id || !reply_text || !reply_text.trim()) {
        return new Response(
          JSON.stringify({ error: "conversation_id and reply_text are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (!settings.smtp_host || !settings.smtp_username || !settings.smtp_password) {
        return new Response(
          JSON.stringify({ error: "SMTP settings not configured. Go to Settings to set up SMTP." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: conversation, error: convError } = await adminSupabase
        .from("email_inbox_conversations")
        .select("*")
        .eq("id", conversation_id)
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (convError || !conversation) {
        return new Response(
          JSON.stringify({ error: "Conversation not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const transporter = nodemailer.createTransport({
        host: settings.smtp_host,
        port: settings.smtp_port || 587,
        secure: (settings.smtp_port || 587) === 465,
        auth: {
          user: settings.smtp_username,
          pass: settings.smtp_password,
        },
      });

      const fromAddr = settings.from_name
        ? `"${settings.from_name}" <${settings.from_email || settings.smtp_username}>`
        : (settings.from_email || settings.smtp_username);

      const replySubject = conversation.subject.startsWith("Re:")
        ? conversation.subject
        : `Re: ${conversation.subject}`;

      const info = await transporter.sendMail({
        from: fromAddr,
        to: conversation.from_email,
        subject: replySubject,
        text: reply_text.trim(),
        html: `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${reply_text.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</div>`,
      });

      // Store the outgoing message
      await adminSupabase
        .from("email_inbox_messages")
        .insert({
          conversation_id: conversation_id,
          user_id: userData.user.id,
          from_email: settings.from_email || settings.smtp_username,
          from_name: settings.from_name,
          to_email: conversation.from_email,
          subject: replySubject,
          body_text: reply_text.trim(),
          body_html: null,
          direction: "outgoing",
          message_id: info.messageId,
          in_reply_to: null,
          is_read: true,
          has_attachments: false,
          attachments: [],
        });

      // Update conversation
      await adminSupabase
        .from("email_inbox_conversations")
        .update({
          last_message_text: reply_text.trim().slice(0, 200),
          last_message_at: new Date().toISOString(),
        })
        .eq("id", conversation_id);

      return new Response(
        JSON.stringify({ success: true, messageId: info.messageId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── MARK_READ: mark a conversation as read ───────────────────────────
    if (action === "mark_read" && req.method === "POST") {
      const body = await req.json();
      const { conversation_id } = body;

      if (!conversation_id) {
        return new Response(
          JSON.stringify({ error: "conversation_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await adminSupabase
        .from("email_inbox_messages")
        .update({ is_read: true })
        .eq("conversation_id", conversation_id)
        .eq("user_id", userData.user.id)
        .eq("is_read", false);

      await adminSupabase
        .from("email_inbox_conversations")
        .update({ unread_count: 0 })
        .eq("id", conversation_id)
        .eq("user_id", userData.user.id);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── DELETE: delete a conversation ────────────────────────────────────
    if (action === "delete" && req.method === "DELETE") {
      const body = await req.json();
      const { conversation_id } = body;

      if (!conversation_id) {
        return new Response(
          JSON.stringify({ error: "conversation_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { error } = await adminSupabase
        .from("email_inbox_conversations")
        .delete()
        .eq("id", conversation_id)
        .eq("user_id", userData.user.id);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

