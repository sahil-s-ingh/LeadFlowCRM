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

    // Fetch all pending reminders that are due
    const { data: dueReminders, error: fetchError } = await supabase
      .from("lead_followups")
      .select("*")
      .eq("status", "pending")
      .lte("reminder_at", now);

    if (fetchError) {
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!dueReminders || dueReminders.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No due reminders" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Collect all lead_ids so we can batch-fetch lead details
    const leadIds = [...new Set(dueReminders.filter((r) => r.lead_id).map((r) => r.lead_id))] as string[];

    const leadMap = new Map<string, { full_name: string; mobile_number: string; email: string }>();

    if (leadIds.length > 0) {
      const { data: leads } = await supabase
        .from("submissions")
        .select("id, full_name, mobile_number, email")
        .in("id", leadIds);

      if (leads) {
        for (const l of leads) {
          leadMap.set(l.id, {
            full_name: l.full_name || "",
            mobile_number: l.mobile_number || "",
            email: l.email || "",
          });
        }
      }
    }

    // Group reminders by user_id
    const byUser = new Map<string, typeof dueReminders>();
    for (const r of dueReminders) {
      const arr = byUser.get(r.user_id) || [];
      arr.push(r);
      byUser.set(r.user_id, arr);
    }

    let totalSent = 0;
    const errors: string[] = [];

    for (const [userId, reminders] of byUser) {
      // Get the user's follow-up reminder settings
      const { data: fuSettings } = await supabase
        .from("follow_up_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      // Collect all reminder email addresses (new array field + legacy single field)
      const reminderEmails: string[] = [
        ...((fuSettings?.reminder_emails as string[] || []).filter((e: string) => e && e.trim())),
      ];
      if (fuSettings?.reminder_email && !reminderEmails.includes(fuSettings.reminder_email)) {
        reminderEmails.push(fuSettings.reminder_email);
      }

      if (!fuSettings || !fuSettings.enable_reminders || reminderEmails.length === 0) {
        for (const r of reminders) {
          await supabase
            .from("lead_followups")
            .update({ status: "snoozed", updated_at: new Date().toISOString() })
            .eq("id", r.id);
        }
        continue;
      }

      // Get the user's SMTP settings
      let { data: smtpConfig } = await supabase
        .from("smtp_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      // If the user has no SMTP settings, try their team owner's settings
      if (!smtpConfig || !smtpConfig.smtp_host || !smtpConfig.smtp_username || !smtpConfig.smtp_password) {
        const { data: userInfo } = await supabase.auth.admin.getUserById(userId);
        const memberEmail = userInfo?.user?.email;
        if (memberEmail) {
          const { data: teamMember } = await supabase
            .from("team_members")
            .select("owner_id")
            .eq("email", memberEmail)
            .maybeSingle();

          const ownerId = teamMember?.owner_id;
          if (ownerId) {
            const { data: ownerSmtp } = await supabase
              .from("smtp_settings")
              .select("*")
              .eq("user_id", ownerId)
              .maybeSingle();
            if (ownerSmtp?.smtp_host && ownerSmtp?.smtp_username && ownerSmtp?.smtp_password) {
              smtpConfig = ownerSmtp;
            }
          }
        }
      }

      if (!smtpConfig || !smtpConfig.smtp_host || !smtpConfig.smtp_username || !smtpConfig.smtp_password) {
        errors.push(`User ${userId}: SMTP not configured`);
        continue;
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

      for (const reminder of reminders) {
        const reminderDate = new Date(reminder.reminder_at);
        const dateStr = reminderDate.toLocaleDateString("en-US", {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
        });
        const timeStr = reminderDate.toLocaleTimeString("en-US", {
          hour: "numeric", minute: "2-digit", hour12: true,
        });

        // Get lead details from the map
        const lead = reminder.lead_id ? leadMap.get(reminder.lead_id) : null;
        const leadName = lead?.full_name || reminder.title?.replace(/^Follow up:\s*/i, "") || "your lead";
        const leadPhone = lead?.mobile_number && lead.mobile_number !== "N/A" ? lead.mobile_number : "";
        const leadEmail = lead?.email && lead.email !== "N/A" ? lead.email : "";

        const subject = `Follow-Up Reminder: ${leadName}`;
        const textBody = `Follow-Up Reminder

You have a follow-up reminder for: ${leadName}
${leadPhone ? `Phone: ${leadPhone}` : ""}
${leadEmail ? `Email: ${leadEmail}` : ""}

Scheduled for: ${dateStr} at ${timeStr}
${reminder.note ? `Note: ${reminder.note}` : ""}

${leadPhone ? `Call now: tel:${leadPhone.replace(/[^+\d]/g, "")}` : ""}

Log in to your CRM to follow up with this lead.`;

        const htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <div style="background: linear-gradient(135deg, #0891B2, #06B6D4); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: #fff; margin: 0; font-size: 1.4rem;">Follow-Up Reminder</h1>
              <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 0.9rem;">LeadCentre CRM</p>
            </div>
            <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
              <p style="font-size: 1rem; color: #1f2937; margin: 0 0 16px;">This is a reminder to follow up with:</p>
              <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin-bottom: 16px;">
                <h2 style="margin: 0 0 16px; font-size: 1.2rem; color: #111827;">${leadName}</h2>

                ${leadPhone ? `
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                  <span style="font-size: 0.9rem; color: #64748b; min-width: 60px;"><strong>Phone:</strong></span>
                  <a href="tel:${leadPhone.replace(/[^+\d]/g, "")}" style="font-size: 0.92rem; color: #0891B2; text-decoration: none; font-weight: 600;">${leadPhone}</a>
                </div>` : ""}

                ${leadEmail ? `
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                  <span style="font-size: 0.9rem; color: #64748b; min-width: 60px;"><strong>Email:</strong></span>
                  <a href="mailto:${leadEmail}" style="font-size: 0.92rem; color: #0891B2; text-decoration: none; font-weight: 600;">${leadEmail}</a>
                </div>` : ""}

                <p style="margin: 12px 0 0; font-size: 0.9rem; color: #64748b;">
                  <strong>Scheduled for:</strong> ${dateStr} at ${timeStr}
                </p>
                ${reminder.note ? `<div style="margin-top: 12px; padding: 12px; background: #f1f5f9; border-radius: 8px; font-size: 0.88rem; color: #475569; line-height: 1.5;">${reminder.note}</div>` : ""}
              </div>

              ${leadPhone ? `
              <div style="text-align: center; margin-bottom: 16px;">
                <a href="tel:${leadPhone.replace(/[^+\d]/g, "")}" style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 28px; background: linear-gradient(135deg, #0891B2, #06B6D4); color: #fff; text-decoration: none; border-radius: 10px; font-size: 0.95rem; font-weight: 700; box-shadow: 0 4px 14px rgba(8, 145, 178, 0.3);">
                  <span style="font-size: 1.1rem;">&#9742;</span> Call ${leadPhone}
                </a>
              </div>` : ""}

              <p style="margin-top: 24px; font-size: 0.78rem; color: #94a3b8; text-align: center;">This reminder was sent from your LeadCentre CRM account.</p>
            </div>
          </div>
        `;

        try {
          await transporter.sendMail({
            from: smtpConfig.from_name
              ? `"${smtpConfig.from_name}" <${smtpConfig.from_email || smtpConfig.smtp_username}>`
              : (smtpConfig.from_email || smtpConfig.smtp_username),
            to: reminderEmails.join(", "),
            subject,
            text: textBody,
            html: htmlBody,
          });

          await supabase
            .from("lead_followups")
            .update({ status: "sent", email_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq("id", reminder.id);

          totalSent++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          errors.push(`Reminder ${reminder.id}: ${msg}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent: totalSent, errors: errors.length > 0 ? errors : undefined }),
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
