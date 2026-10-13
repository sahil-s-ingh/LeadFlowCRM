import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import nodemailer from "npm:nodemailer@6.9.15";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BATCH_DELAY_MS = 500;

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
    const action = url.searchParams.get("action") || "list";

    // ─── LIST: fetch campaigns ──────────────────────────────────────────
    if (action === "list" && req.method === "GET") {
      const { data, error } = await adminSupabase
        .from("email_broadcast_campaigns")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false });

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ campaigns: data || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── GET: fetch single campaign with recipients ─────────────────────
    if (action === "get" && req.method === "GET") {
      const campaignId = url.searchParams.get("campaign_id");
      if (!campaignId) {
        return new Response(
          JSON.stringify({ error: "campaign_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: campaign, error: campError } = await adminSupabase
        .from("email_broadcast_campaigns")
        .select("*")
        .eq("id", campaignId)
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (campError || !campaign) {
        return new Response(
          JSON.stringify({ error: "Campaign not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: recipients } = await adminSupabase
        .from("email_broadcast_recipients")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: true });

      return new Response(
        JSON.stringify({ campaign, recipients: recipients || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── CREATE: create campaign with recipients ─────────────────────────
    if (action === "create" && req.method === "POST") {
      const body = await req.json();
      const { subject, body: emailBody, html_body, recipients } = body;

      if (!subject || !emailBody || !recipients || !Array.isArray(recipients)) {
        return new Response(
          JSON.stringify({ error: "subject, body, and recipients array are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: campaign, error: campError } = await adminSupabase
        .from("email_broadcast_campaigns")
        .insert({
          user_id: userData.user.id,
          subject,
          body: emailBody,
          html_body: html_body || null,
          status: "draft",
          total_recipients: recipients.length,
        })
        .select()
        .single();

      if (campError || !campaign) {
        return new Response(
          JSON.stringify({ error: campError?.message || "Failed to create campaign" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const recipientRows = recipients.map((r: { lead_id?: string; email: string }) => ({
        campaign_id: campaign.id,
        user_id: userData.user.id,
        lead_id: r.lead_id || null,
        email: r.email,
        status: "pending",
      }));

      const { error: recipError } = await adminSupabase
        .from("email_broadcast_recipients")
        .insert(recipientRows);

      if (recipError) {
        return new Response(
          JSON.stringify({ error: recipError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true, campaign_id: campaign.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── SEND: start sending a campaign ─────────────────────────────────
    if (action === "send" && req.method === "POST") {
      const body = await req.json();
      const { campaign_id } = body;

      if (!campaign_id) {
        return new Response(
          JSON.stringify({ error: "campaign_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: campaign, error: campError } = await adminSupabase
        .from("email_broadcast_campaigns")
        .select("*")
        .eq("id", campaign_id)
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (campError || !campaign) {
        return new Response(
          JSON.stringify({ error: "Campaign not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Load SMTP servers by priority (multi-SMTP with fallback)
      const { data: smtpServers } = await adminSupabase
        .from("smtp_servers")
        .select("*")
        .eq("user_id", userData.user.id)
        .eq("is_active", true)
        .order("priority", { ascending: true })
        .order("created_at", { ascending: true });

      let smtpConfig: Record<string, unknown> | null = null;

      if (smtpServers && smtpServers.length > 0 && smtpServers[0].smtp_host && smtpServers[0].smtp_username && smtpServers[0].smtp_password) {
        smtpConfig = smtpServers[0] as Record<string, unknown>;
      } else {
        const { data: legacySmtp } = await adminSupabase
          .from("smtp_settings")
          .select("*")
          .eq("user_id", userData.user.id)
          .maybeSingle();

        if (legacySmtp && legacySmtp.smtp_host && legacySmtp.smtp_username && legacySmtp.smtp_password) {
          smtpConfig = legacySmtp as Record<string, unknown>;
        }
      }

      if (!smtpConfig) {
        return new Response(
          JSON.stringify({ error: "SMTP settings not configured. Please set up your SMTP in Settings first." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: pendingRecipients } = await adminSupabase
        .from("email_broadcast_recipients")
        .select("*")
        .eq("campaign_id", campaign_id)
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (!pendingRecipients || pendingRecipients.length === 0) {
        return new Response(
          JSON.stringify({ error: "No pending recipients to send to" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await adminSupabase
        .from("email_broadcast_campaigns")
        .update({ status: "sending", updated_at: new Date().toISOString() })
        .eq("id", campaign_id);

      const transporter = nodemailer.createTransport({
        host: smtpConfig.smtp_host,
        port: smtpConfig.smtp_port || 587,
        secure: (smtpConfig.smtp_port || 587) === 465,
        auth: {
          user: smtpConfig.smtp_username,
          pass: smtpConfig.smtp_password,
        },
      });

      const fromAddr = smtpConfig.from_name
        ? `"${smtpConfig.from_name}" <${smtpConfig.from_email || smtpConfig.smtp_username}>`
        : (smtpConfig.from_email || smtpConfig.smtp_username);

      let sentCount = campaign.sent_count || 0;
      let failedCount = campaign.failed_count || 0;

      for (const recipient of pendingRecipients) {
        try {
          // Insert email_log record BEFORE sending
          const bodyPreview = campaign.body.slice(0, 200);
          const { data: logRow } = await adminSupabase
            .from("email_log")
            .insert({
              user_id: userData.user.id,
              lead_id: recipient.lead_id || null,
              recipient_email: recipient.email,
              subject: campaign.subject,
              body_preview: bodyPreview,
              status: "sent",
              is_bulk: true,
            })
            .select("id")
            .single();

          const emailLogId = logRow?.id || null;

          // Build tracked HTML body with tracking pixel and link wrapping
          let finalHtml = campaign.html_body || "";
          if (emailLogId) {
            const trackUrl = `${supabaseUrl}/functions/v1/email-track?id=${emailLogId}&action=open`;

            if (!finalHtml) {
              const escaped = campaign.body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
              const linkified = escaped.replace(
                /(https?:\/\/[^\s<]+)/gi,
                (u) => `<a href="${u}" style="color:#2563eb;text-decoration:underline;">${u}</a>`,
              );
              finalHtml = `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${linkified.replace(/\n/g, "<br>")}</div>`;
            }

            const clickBase = `${supabaseUrl}/functions/v1/email-track?id=${emailLogId}&action=click&redirect=`;
            finalHtml = finalHtml.replace(
              /<a\s+([^>]*?)href=["'](https?:\/\/[^"']+)["']([^>]*?)>/gi,
              (match: string, before: string, href: string, after: string) => {
                const trackedHref = clickBase + encodeURIComponent(href);
                return `<a ${before}href="${trackedHref}"${after}>`;
              },
            );

            finalHtml += `<img src="${trackUrl}" width="1" height="1" alt="" style="border:0;width:1px;height:1px;overflow:hidden;" />`;
          } else if (!finalHtml) {
            const escaped = campaign.body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const linkified = escaped.replace(
              /(https?:\/\/[^\s<]+)/gi,
              (u) => `<a href="${u}" style="color:#2563eb;text-decoration:underline;">${u}</a>`,
            );
            finalHtml = `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${linkified.replace(/\n/g, "<br>")}</div>`;
          }

          const mailOptions: nodemailer.SendMailOptions = {
            from: fromAddr,
            to: recipient.email,
            subject: campaign.subject,
            text: campaign.body,
            html: finalHtml,
          };

          const info = await transporter.sendMail(mailOptions);

          // Update email_log as delivered
          if (emailLogId) {
            await adminSupabase
              .from("email_log")
              .update({ message_id: info.messageId, status: "delivered" })
              .eq("id", emailLogId);
          }

          await adminSupabase
            .from("email_broadcast_recipients")
            .update({ status: "sent", email_log_id: emailLogId, sent_at: new Date().toISOString() })
            .eq("id", recipient.id);
          sentCount++;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "Unknown error";
          await adminSupabase
            .from("email_broadcast_recipients")
            .update({ status: "failed", error_message: errMsg, sent_at: new Date().toISOString() })
            .eq("id", recipient.id);
          failedCount++;
        }

        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }

      const finalStatus = failedCount === pendingRecipients.length ? "failed" : "completed";
      await adminSupabase
        .from("email_broadcast_campaigns")
        .update({
          status: finalStatus,
          sent_count: sentCount,
          failed_count: failedCount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaign_id);

      return new Response(
        JSON.stringify({
          success: true,
          sent: sentCount - (campaign.sent_count || 0),
          failed: failedCount - (campaign.failed_count || 0),
          status: finalStatus,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── DELETE: delete a campaign ───────────────────────────────────────
    if (action === "delete" && req.method === "DELETE") {
      const body = await req.json();
      const { campaign_id } = body;

      if (!campaign_id) {
        return new Response(
          JSON.stringify({ error: "campaign_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { error } = await adminSupabase
        .from("email_broadcast_campaigns")
        .delete()
        .eq("id", campaign_id)
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

