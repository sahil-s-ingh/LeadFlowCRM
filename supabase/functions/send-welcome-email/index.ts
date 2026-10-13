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

    const { leadId, fullName, email, tradingProduct, fundAmount } = await req.json();

    if (!leadId || !email) {
      return new Response(
        JSON.stringify({ error: "Missing leadId or email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: fuSettings } = await supabase
      .from("follow_up_settings")
      .select("enable_auto_welcome_email, auto_welcome_email_subject, auto_welcome_email_body, reminder_email, welcome_urgency_hours, welcome_next_steps, welcome_booking_link, welcome_testimonial, welcome_testimonial_author, welcome_reply_tracking")
      .limit(1)
      .maybeSingle();

    if (!fuSettings || !fuSettings.enable_auto_welcome_email) {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Load SMTP servers by priority (multi-SMTP with fallback)
    const { data: smtpServers } = await supabase
      .from("smtp_servers")
      .select("*")
      .eq("is_active", true)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1);

    let smtpToUse: Record<string, unknown> | null = null;

    if (smtpServers && smtpServers.length > 0 && smtpServers[0].smtp_host && smtpServers[0].smtp_username && smtpServers[0].smtp_password) {
      smtpToUse = smtpServers[0] as Record<string, unknown>;
    } else {
      // Fallback to legacy smtp_settings
      const { data: legacySmtp } = await supabase
        .from("smtp_settings")
        .select("smtp_host, smtp_port, smtp_username, smtp_password, from_email, from_name, user_id")
        .limit(1)
        .maybeSingle();

      if (legacySmtp && legacySmtp.smtp_host && legacySmtp.smtp_username && legacySmtp.smtp_password) {
        smtpToUse = legacySmtp as Record<string, unknown>;
      } else {
        const { data: platformSmtp } = await supabase
          .from("platform_smtp_settings")
          .select("smtp_host, smtp_port, smtp_username, smtp_password, from_email, from_name")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (platformSmtp && platformSmtp.smtp_host && platformSmtp.smtp_username && platformSmtp.smtp_password) {
          smtpToUse = platformSmtp as Record<string, unknown>;
        }
      }
    }

    if (!smtpToUse) {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "no_smtp" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: tgSettings } = await supabase
      .from("telegram_settings")
      .select("telegram_link, whatsapp_group_link, personal_phone_number")
      .limit(1)
      .maybeSingle();

    const telegramLink = tgSettings?.telegram_link || "";
    const whatsappGroupLink = tgSettings?.whatsapp_group_link || "";
    const personalPhoneNumber = tgSettings?.personal_phone_number || "";

    const productName = tradingProduct === "algo" ? "Trading Algo" : "TradingView Premium Indicator";
    const fundStr = fundAmount ? "$" + String(fundAmount) : "";
    const fundText = fundAmount ? " with a fund of " + fundStr : "";

    // Build urgency line
    const urgencyHours = fuSettings.welcome_urgency_hours || 0;
    const urgencyLine = urgencyHours > 0
      ? "\n\nReply within " + urgencyHours + " hours to get a free strategy consultation with our team!"
      : "";

    // Build next steps section
    const nextStepsRaw = fuSettings.welcome_next_steps || "";
    let nextStepsSection = "";
    if (nextStepsRaw.trim()) {
      const steps = nextStepsRaw.split("\n").map((s: string) => s.trim()).filter((s: string) => s.length > 0);
      if (steps.length > 0) {
        nextStepsSection = "\n\nHere are your next steps:\n" + steps.map((s: string, i: number) => (i + 1) + ". " + s).join("\n");
      }
    }

    // Build testimonial section
    let testimonialSection = "";
    if (fuSettings.welcome_testimonial && fuSettings.welcome_testimonial.trim()) {
      const author = fuSettings.welcome_testimonial_author || "";
      testimonialSection = "\n\n---\n\"" + fuSettings.welcome_testimonial.trim() + "\""
        + (author ? "\n— " + author : "");
    }

    // Build booking section
    const bookingLink = fuSettings.welcome_booking_link || "";
    let bookingSection = "";
    if (bookingLink.trim()) {
      bookingSection = "\n\nBook a call with us directly: " + bookingLink.trim();
    }

    const defaultSubject = "Welcome to " + productName + ", " + fullName + "!";
    const defaultBody = "Hi " + fullName + ",\n\n"
      + "Thank you for your interest in our " + productName + "! We've received your submission" + fundText + " and our team will get in touch with you shortly.\n\n"
      + "Join our community channels for instant updates and support:\n\n"
      + "1. Telegram: " + (telegramLink || "Link coming soon") + "\n"
      + "2. WhatsApp Group: " + (whatsappGroupLink || "Link coming soon") + "\n"
      + "3. Contact us directly: " + (personalPhoneNumber || "Number coming soon")
      + nextStepsSection
      + bookingSection
      + urgencyLine
      + testimonialSection
      + "\n\nWe look forward to helping you on your trading journey!\n\n"
      + "Best regards,\n"
      + "The Team";

    const subject = fuSettings.auto_welcome_email_subject || defaultSubject;
    const body = (fuSettings.auto_welcome_email_body || defaultBody)
      .replace(/\{name\}/g, fullName || "")
      .replace(/\{email\}/g, email || "")
      .replace(/\{product\}/g, productName)
      .replace(/\{fund_amount\}/g, fundStr || "N/A")
      .replace(/\{telegram_link\}/g, telegramLink || "")
      .replace(/\{whatsapp_group_link\}/g, whatsappGroupLink || "")
      .replace(/\{personal_phone_number\}/g, personalPhoneNumber || "")
      .replace(/\{booking_link\}/g, bookingLink || "");

    // Build HTML body
    const bookingHtml = bookingLink.trim()
      ? '<div style="text-align: center; margin: 20px 0;"><a href="' + bookingLink.trim() + '" style="display: inline-block; padding: 12px 28px; background: #0891B2; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 0.9rem;">Book a Call</a></div>'
      : "";

    const testimonialHtml = fuSettings.welcome_testimonial && fuSettings.welcome_testimonial.trim()
      ? '<div style="margin: 20px 0; padding: 16px; background: #f0fdfa; border-left: 4px solid #14b8a6; border-radius: 8px;"><p style="margin: 0 0 6px; font-size: 0.88rem; color: #134e4a; font-style: italic; line-height: 1.5;">"' + fuSettings.welcome_testimonial.trim() + '"</p>' + (fuSettings.welcome_testimonial_author ? '<p style="margin: 0; font-size: 0.8rem; color: #0f766e; font-weight: 600;">— ' + fuSettings.welcome_testimonial_author + '</p>' : "") + '</div>'
      : "";

    const urgencyHtml = urgencyHours > 0
      ? '<div style="margin: 16px 0; padding: 12px 16px; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; text-align: center;"><span style="font-size: 0.88rem; color: #92400e; font-weight: 600;">Reply within ' + urgencyHours + ' hours to get a free strategy consultation!</span></div>'
      : "";

    const htmlBody = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">'
      + '<div style="background: linear-gradient(135deg, #0891B2, #06B6D4); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">'
      + '<h1 style="color: #fff; margin: 0; font-size: 1.4rem;">Welcome, ' + fullName + '!</h1>'
      + '<p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 0.9rem;">LeadCentre CRM</p>'
      + '</div>'
      + '<div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">'
      + '<div style="font-size: 0.95rem; color: #1f2937; line-height: 1.6; white-space: pre-wrap;">' + body + '</div>'
      + bookingHtml
      + urgencyHtml
      + testimonialHtml
      + '</div>'
      + '</div>';

    // Insert email_log record
    const { data: logRow } = await supabase
      .from("email_log")
      .insert({
        user_id: (smtpToUse as Record<string, unknown>).user_id || null,
        lead_id: leadId,
        recipient_email: email,
        subject,
        body_preview: body.slice(0, 200),
        status: "sent",
      })
      .select("id")
      .single();

    const emailLogId = logRow?.id || null;

    const transporter = nodemailer.createTransport({
      host: smtpToUse.smtp_host,
      port: smtpToUse.smtp_port || 587,
      secure: (smtpToUse.smtp_port || 587) === 465,
      auth: { user: smtpToUse.smtp_username, pass: smtpToUse.smtp_password },
    });

    // Add Reply-To header for tracking if enabled
    const mailOptions: Record<string, unknown> = {
      from: smtpToUse.from_name
        ? '"' + smtpToUse.from_name + '" <' + (smtpToUse.from_email || smtpToUse.smtp_username) + ">"
        : (smtpToUse.from_email || smtpToUse.smtp_username),
      to: email,
      subject,
      text: body,
      html: htmlBody,
    };

    if (fuSettings.welcome_reply_tracking) {
      mailOptions.headers = {
        "X-Lead-Id": leadId,
        "X-Reply-Tracking": "true",
        "In-Reply-To": "<welcome-" + leadId + "@leadcentre.crm>",
        "References": "<welcome-" + leadId + "@leadcentre.crm>",
      };
      mailOptions.replyTo = smtpToUse.from_email || smtpToUse.smtp_username;
    }

    const info = await transporter.sendMail(mailOptions);

    if (emailLogId) {
      await supabase
        .from("email_log")
        .update({ message_id: info.messageId, status: "delivered" })
        .eq("id", emailLogId);
    }

    // Add a lead activity noting the welcome email was sent
    if (fuSettings.welcome_reply_tracking) {
      await supabase
        .from("lead_activities")
        .insert({
          lead_id: leadId,
          activity_type: "welcome_email_sent",
          description: "Welcome email sent to " + email + ". Reply tracking enabled.",
        });
    }

    return new Response(
      JSON.stringify({ ok: true, messageId: info.messageId }),
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

