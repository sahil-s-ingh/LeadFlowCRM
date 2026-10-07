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

    const { sender_id, sender_name, message_text, team_owner_id } = await req.json();

    if (!sender_id || !message_text || !team_owner_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Don't notify the sender for their own message
    // Fetch the team owner's notification settings
    const { data: fuSettings } = await supabase
      .from("follow_up_settings")
      .select("enable_chat_notifications, reminder_email")
      .eq("user_id", team_owner_id)
      .maybeSingle();

    if (!fuSettings || !fuSettings.enable_chat_notifications || !fuSettings.reminder_email) {
      return new Response(
        JSON.stringify({ success: true, sent: false, reason: "Notifications disabled or no email configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Don't notify if the sender IS the team owner
    if (sender_id === team_owner_id) {
      return new Response(
        JSON.stringify({ success: true, sent: false, reason: "Sender is the team owner" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch SMTP settings for the team owner
    const { data: smtpConfig } = await supabase
      .from("smtp_settings")
      .select("*")
      .eq("user_id", team_owner_id)
      .maybeSingle();

    if (!smtpConfig || !smtpConfig.smtp_host || !smtpConfig.smtp_username || !smtpConfig.smtp_password) {
      return new Response(
        JSON.stringify({ error: "SMTP not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const preview = message_text.length > 200 ? message_text.slice(0, 200) + "..." : message_text;
    const subject = `New Team Chat message from ${sender_name}`;
    const textBody = `You have a new message in your team chat from ${sender_name}:

"${preview}"

Log in to your CRM to reply.`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <div style="background: linear-gradient(135deg, #0891B2, #06B6D4); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 1.4rem;">New Team Chat Message</h1>
          <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 0.9rem;">LeadCentre CRM</p>
        </div>
        <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
          <p style="font-size: 1rem; color: #1f2937; margin: 0 0 16px;">
            <strong style="color: #0891B2;">${sender_name}</strong> sent a new message in your team chat:
          </p>
          <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin-bottom: 16px;">
            <p style="margin: 0; font-size: 0.95rem; color: #334155; line-height: 1.6;">${preview.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
          </div>
          <p style="margin-top: 24px; font-size: 0.78rem; color: #94a3b8; text-align: center;">Log in to your CRM to reply to this message.</p>
        </div>
      </div>
    `;

    const transporter = nodemailer.createTransport({
      host: smtpConfig.smtp_host,
      port: smtpConfig.smtp_port || 587,
      secure: (smtpConfig.smtp_port || 587) === 465,
      auth: {
        user: smtpConfig.smtp_username,
        pass: smtpConfig.smtp_password,
      },
    });

    await transporter.sendMail({
      from: smtpConfig.from_name
        ? `"${smtpConfig.from_name}" <${smtpConfig.from_email || smtpConfig.smtp_username}>`
        : (smtpConfig.from_email || smtpConfig.smtp_username),
      to: fuSettings.reminder_email,
      subject,
      text: textBody,
      html: htmlBody,
    });

    return new Response(
      JSON.stringify({ success: true, sent: true }),
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
