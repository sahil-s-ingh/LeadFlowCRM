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

    const { data: smtpConfig, error: configError } = await adminSupabase
      .from("smtp_settings")
      .select("*")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (configError || !smtpConfig || !smtpConfig.smtp_host || !smtpConfig.smtp_username || !smtpConfig.smtp_password) {
      return new Response(
        JSON.stringify({ error: "SMTP settings not configured. Please set up your SMTP in Settings first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { inviteeEmail, inviteeRole, appUrl } = await req.json();

    if (!inviteeEmail || !appUrl) {
      return new Response(
        JSON.stringify({ error: "Missing inviteeEmail or appUrl" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const roleLabel = inviteeRole === "admin" ? "Admin (full access)" : inviteeRole === "manager" ? "Manager (leads + inbox)" : "Agent (view leads only)";

    const loginUrl = `${appUrl}?invite=${encodeURIComponent(inviteeEmail)}`;

    const subject = "You're invited to join the CRM Team";
    const textBody = `Hello,

You have been invited to join the CRM team as a ${roleLabel}.

Click the link below to log in and access the CRM:
${loginUrl}

If you did not expect this invitation, you can safely ignore this email.`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#2563eb,#1e40af);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.3px;">CRM Team Invitation</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 16px;color:#1f2937;font-size:15px;line-height:1.6;">Hello,</p>
              <p style="margin:0 0 16px;color:#1f2937;font-size:15px;line-height:1.6;">
                You have been invited to join the CRM team as <strong style="color:#2563eb;">${roleLabel}</strong>.
              </p>
              <p style="margin:0 0 28px;color:#64748b;font-size:14px;line-height:1.6;">
                Click the button below to log in and access the CRM dashboard.
              </p>
              <div style="text-align:center;margin:32px 0;">
                <a href="${loginUrl}" style="display:inline-block;padding:14px 40px;background-color:#2563eb;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;border-radius:10px;letter-spacing:0.3px;">
                  Login
                </a>
              </div>
              <p style="margin:24px 0 0;color:#94a3b8;font-size:13px;line-height:1.6;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${loginUrl}" style="color:#2563eb;word-break:break-all;">${loginUrl}</a>
              </p>
              <p style="margin:24px 0 0;color:#94a3b8;font-size:13px;line-height:1.6;">
                If you did not expect this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">This invitation was sent by the CRM Team Management system.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const transporter = nodemailer.createTransport({
      host: smtpConfig.smtp_host,
      port: smtpConfig.smtp_port || 587,
      secure: (smtpConfig.smtp_port || 587) === 465,
      auth: {
        user: smtpConfig.smtp_username,
        pass: smtpConfig.smtp_password,
      },
    });

    const mailOptions: nodemailer.SendMailOptions = {
      from: smtpConfig.from_name
        ? `"${smtpConfig.from_name}" <${smtpConfig.from_email || smtpConfig.smtp_username}>`
        : (smtpConfig.from_email || smtpConfig.smtp_username),
      to: inviteeEmail,
      subject,
      text: textBody,
      html: htmlBody,
    };

    await transporter.sendMail(mailOptions);

    return new Response(
      JSON.stringify({ success: true }),
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
