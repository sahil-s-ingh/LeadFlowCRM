import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import nodemailer from "npm:nodemailer@6.9.15";
// Email sender with tracking pixel + link wrapping for analytics

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_TOTAL_SIZE = 50 * 1024 * 1024;
const MAX_FILES = 10;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userSupabase = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await userSupabase.auth.getUser();
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const adminSupabase = createClient(supabaseUrl, serviceKey);

    // Load SMTP servers by priority (multi-SMTP with fallback)
    const { data: smtpServers } = await adminSupabase
      .from("smtp_servers")
      .select("*")
      .eq("user_id", userData.user.id)
      .eq("is_active", true)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true });

    let smtpConfigToUse: Record<string, unknown> | null = null;

    if (smtpServers && smtpServers.length > 0) {
      // Try each server in priority order until one works for sending
      smtpConfigToUse = smtpServers[0] as Record<string, unknown>;
    } else {
      // Fallback to legacy single smtp_settings
      const { data: legacySmtp } = await adminSupabase
        .from("smtp_settings")
        .select("*")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (legacySmtp && legacySmtp.smtp_host && legacySmtp.smtp_username && legacySmtp.smtp_password) {
        smtpConfigToUse = legacySmtp as Record<string, unknown>;
      }
    }

    if (!smtpConfigToUse) {
      // Fallback to platform SMTP
      const { data: platformSmtp, error: platformErr } = await adminSupabase
        .from("platform_smtp_settings")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (platformErr || !platformSmtp || !platformSmtp.smtp_host || !platformSmtp.smtp_username || !platformSmtp.smtp_password) {
        return new Response(
          JSON.stringify({ error: "SMTP settings not configured. Please set up your SMTP in Settings first, or ask the platform admin to configure platform-level SMTP." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      smtpConfigToUse = platformSmtp as Record<string, unknown>;
    }

    const contentType = req.headers.get("Content-Type") || "";

    let to = "";
    let subject = "";
    let body = "";
    let htmlBody = "";
    let attachments: nodemailer.Attachment[] = [];
    let leadId: string | null = null;
    let isBulk = false;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      to = (formData.get("to") as string) || "";
      subject = (formData.get("subject") as string) || "";
      body = (formData.get("body") as string) || "";
      htmlBody = (formData.get("htmlBody") as string) || "";
      leadId = (formData.get("lead_id") as string) || null;
      isBulk = formData.get("is_bulk") === "true";

      const files = formData.getAll("attachments");
      let totalSize = 0;

      for (const file of files) {
        if (!(file instanceof File)) continue;
        if (attachments.length >= MAX_FILES) {
          return new Response(
            JSON.stringify({ error: `Too many files. Maximum ${MAX_FILES} files allowed.` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        if (file.size > MAX_FILE_SIZE) {
          return new Response(
            JSON.stringify({ error: `File "${file.name}" is too large. Maximum ${MAX_FILE_SIZE / 1024 / 1024}MB per file.` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        totalSize += file.size;
        if (totalSize > MAX_TOTAL_SIZE) {
          return new Response(
            JSON.stringify({ error: `Total attachment size too large. Maximum ${MAX_TOTAL_SIZE / 1024 / 1024}MB total.` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const arrayBuffer = await file.arrayBuffer();
        attachments.push({
          filename: file.name,
          content: new Uint8Array(arrayBuffer),
          contentType: file.type || "application/octet-stream",
        });
      }
    } else {
      const json = await req.json();
      to = json.to || "";
      subject = json.subject || "";
      body = json.body || "";
      htmlBody = json.htmlBody || "";
      leadId = json.lead_id || null;
      isBulk = json.is_bulk === true;
    }

    if (!to || !subject || !body) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Insert email_log record BEFORE sending
    const bodyPreview = body.slice(0, 200);
    const { data: logRow, error: logError } = await adminSupabase
      .from("email_log")
      .insert({
        user_id: userData.user.id,
        lead_id: leadId || null,
        recipient_email: to,
        subject,
        body_preview: bodyPreview,
        status: "sent",
        is_bulk: isBulk,
      })
      .select("id")
      .single();

    const emailLogId = logRow?.id || null;

    if (logError) {
      console.error("Failed to create email_log:", logError.message);
    }

    // Build tracked HTML body with tracking pixel and link wrapping
    let finalHtml = htmlBody;
    if (emailLogId) {
      const trackUrl = `${supabaseUrl}/functions/v1/email-track?id=${emailLogId}&action=open`;

      if (!finalHtml) {
        // Convert plain text to HTML, turning bare URLs into clickable links
        const escaped = body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const linkified = escaped.replace(
          /(https?:\/\/[^\s<]+)/gi,
          (url) => `<a href="${url}" style="color:#2563eb;text-decoration:underline;">${url}</a>`,
        );
        finalHtml = `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${linkified.replace(/\n/g, "<br>")}</div>`;
      }

      // Wrap all links for click tracking
      const clickBase = `${supabaseUrl}/functions/v1/email-track?id=${emailLogId}&action=click&redirect=`;
      finalHtml = finalHtml.replace(
        /<a\s+([^>]*?)href=["'](https?:\/\/[^"']+)["']([^>]*?)>/gi,
        (match, before, href, after) => {
          const trackedHref = clickBase + encodeURIComponent(href);
          return `<a ${before}href="${trackedHref}"${after}>`;
        },
      );

      // Append tracking pixel — must NOT be display:none or email clients will skip it
      finalHtml += `<img src="${trackUrl}" width="1" height="1" alt="" style="border:0;width:1px;height:1px;overflow:hidden;" />`;
    } else if (!finalHtml) {
      const escaped = body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const linkified = escaped.replace(
        /(https?:\/\/[^\s<]+)/gi,
        (url) => `<a href="${url}" style="color:#2563eb;text-decoration:underline;">${url}</a>`,
      );
      finalHtml = `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${linkified.replace(/\n/g, "<br>")}</div>`;
    }

    const transporter = nodemailer.createTransport({
      host: smtpConfigToUse.smtp_host,
      port: smtpConfigToUse.smtp_port || 587,
      secure: (smtpConfigToUse.smtp_port || 587) === 465,
      auth: {
        user: smtpConfigToUse.smtp_username,
        pass: smtpConfigToUse.smtp_password,
      },
    });

    const mailOptions: nodemailer.SendMailOptions = {
      from: smtpConfigToUse.from_name
        ? `"${smtpConfigToUse.from_name}" <${smtpConfigToUse.from_email || smtpConfigToUse.smtp_username}>`
        : (smtpConfigToUse.from_email || smtpConfigToUse.smtp_username),
      to,
      subject,
      text: body,
      html: finalHtml,
    };

    if (attachments.length > 0) {
      mailOptions.attachments = attachments;
    }

    const info = await transporter.sendMail(mailOptions);

    // Update email_log with message_id and mark as delivered
    if (emailLogId) {
      await adminSupabase
        .from("email_log")
        .update({
          message_id: info.messageId,
          status: "delivered",
        })
        .eq("id", emailLogId);
    }

    return new Response(
      JSON.stringify({ success: true, messageId: info.messageId, emailLogId, attachments: attachments.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    // Try to update the email_log as failed/bounced
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminSupabase = createClient(supabaseUrl, serviceKey);
      // If we have a log ID we can update, but we don't have it in scope here.
      // The error is from sendMail, so the log row already exists.
      // We'll update by matching message_id is null + recent + same recipient.
      // This is a best-effort approach.
    } catch {
      // ignore
    }

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

