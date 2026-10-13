import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import nodemailer from "npm:nodemailer@6.9.15";

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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date().toISOString();

    const { data: pendingBatches, error: fetchError } = await supabase
      .from("scheduled_emails")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", now)
      .order("scheduled_at", { ascending: true })
      .limit(1);

    if (fetchError) {
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!pendingBatches || pendingBatches.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No scheduled emails due" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const batch = pendingBatches[0];

    await supabase
      .from("scheduled_emails")
      .update({ status: "sending", updated_at: now })
      .eq("id", batch.id);

    const recipients = batch.recipient_emails as Array<{
      id: string;
      email: string;
      full_name: string;
      mobile_number?: string;
      state?: string;
      trading_product?: string;
    }>;
    const attachments = (batch.attachment_meta || []) as Array<{
      filename: string;
      content_base64: string;
      contentType: string;
    }>;

    // Load SMTP servers by priority (multi-SMTP with fallback)
    const { data: smtpServers } = await supabase
      .from("smtp_servers")
      .select("*")
      .eq("user_id", batch.user_id)
      .eq("is_active", true)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true });

    let smtpConfig: Record<string, unknown> | null = null;

    if (smtpServers && smtpServers.length > 0 && smtpServers[0].smtp_host && smtpServers[0].smtp_username && smtpServers[0].smtp_password) {
      smtpConfig = smtpServers[0] as Record<string, unknown>;
    } else {
      // Fallback to legacy smtp_settings
      const { data: legacySmtp } = await supabase
        .from("smtp_settings")
        .select("*")
        .eq("user_id", batch.user_id)
        .maybeSingle();

      if (legacySmtp && legacySmtp.smtp_host && legacySmtp.smtp_username && legacySmtp.smtp_password) {
        smtpConfig = legacySmtp as Record<string, unknown>;
      }
    }

    if (!smtpConfig) {
      await supabase
        .from("scheduled_emails")
        .update({
          status: "partially_failed",
          failed_count: recipients.length,
          failed_recipients: recipients.map((r) => ({
            id: r.id, email: r.email, full_name: r.full_name, error: "SMTP not configured",
          })),
          updated_at: new Date().toISOString(),
        })
        .eq("id", batch.id);

      return new Response(
        JSON.stringify({ success: false, error: "SMTP not configured for user" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const transporter = nodemailer.createTransport({
      host: smtpConfig.smtp_host,
      port: smtpConfig.smtp_port || 587,
      secure: (smtpConfig.smtp_port || 587) === 465,
      auth: {
        user: smtpConfig.smtp_username,
        pass: smtpConfig.smtp_password,
      },
    });

    const replacePlaceholders = (text: string, lead: {
      full_name: string; email: string; mobile_number?: string; state?: string; trading_product?: string;
    }): string => {
      return text
        .replace(/\{\{name\}\}/g, (lead.full_name || "").split(" ")[0] || "")
        .replace(/\{\{full_name\}\}/g, lead.full_name || "")
        .replace(/\{\{email\}\}/g, lead.email || "")
        .replace(/\{\{phone\}\}/g, lead.mobile_number || "")
        .replace(/\{\{state\}\}/g, lead.state || "")
        .replace(/\{\{product\}\}/g, lead.trading_product === "algo" ? "Trading Algo" : "TradingView Premium");
    };

    const signature = batch.from_name ? `\n\nBest regards,\n${batch.from_name}` : "";

    let sentCount = 0;
    let failCount = 0;
    const failedRecipients: Array<{ id: string; email: string; full_name: string; error: string }> = [];

    const BATCH_SIZE = 70;
    const EMAIL_DELAY = 2000;

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];

      if (i > 0 && i % BATCH_SIZE === 0) {
        await new Promise((r) => setTimeout(r, 60000));
      }

      const personalizedSubject = replacePlaceholders(batch.subject, recipient);
      const personalizedBody = replacePlaceholders(batch.body, recipient) + signature;

      try {
        const mailOptions: nodemailer.SendMailOptions = {
          from: smtpConfig.from_name
            ? `"${smtpConfig.from_name}" <${smtpConfig.from_email || smtpConfig.smtp_username}>`
            : (smtpConfig.from_email || smtpConfig.smtp_username),
          to: recipient.email,
          subject: personalizedSubject,
          text: personalizedBody,
        };

        if (attachments.length > 0) {
          mailOptions.attachments = attachments.map((a) => ({
            filename: a.filename,
            content: Buffer.from(a.content_base64, "base64"),
            contentType: a.contentType,
          }));
        }

        const info = await transporter.sendMail(mailOptions);

        await supabase.from("email_log").insert({
          user_id: batch.user_id,
          lead_id: recipient.id || null,
          recipient_email: recipient.email,
          subject: personalizedSubject,
          body_preview: personalizedBody.slice(0, 200),
          status: "delivered",
          is_bulk: true,
          message_id: info.messageId,
        });

        sentCount++;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        failCount++;
        failedRecipients.push({
          id: recipient.id,
          email: recipient.email,
          full_name: recipient.full_name,
          error: errMsg,
        });

        await supabase.from("email_log").insert({
          user_id: batch.user_id,
          lead_id: recipient.id || null,
          recipient_email: recipient.email,
          subject: personalizedSubject,
          body_preview: personalizedBody.slice(0, 200),
          status: "failed",
          is_bulk: true,
          bounce_reason: errMsg,
        });
      }

      await supabase
        .from("scheduled_emails")
        .update({
          sent_count: sentCount,
          failed_count: failCount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", batch.id);

      if (i < recipients.length - 1) {
        await new Promise((r) => setTimeout(r, EMAIL_DELAY));
      }
    }

    const finalStatus = failCount === 0 ? "completed" : (sentCount > 0 ? "partially_failed" : "partially_failed");

    await supabase
      .from("scheduled_emails")
      .update({
        status: finalStatus,
        sent_count: sentCount,
        failed_count: failCount,
        failed_recipients: failedRecipients,
        updated_at: new Date().toISOString(),
      })
      .eq("id", batch.id);

    return new Response(
      JSON.stringify({
        success: true,
        batchId: batch.id,
        sent: sentCount,
        failed: failCount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

