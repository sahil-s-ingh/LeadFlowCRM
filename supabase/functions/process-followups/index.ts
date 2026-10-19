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

    // ===================== Escalation Logic =====================
    // Check for overdue reminders that have already been sent (status='sent')
    // and escalate them based on the user's escalation settings.
    let totalEscalated = 0;

    {
      const nowMs = Date.now();

      // Fetch all sent reminders (already emailed) — these are candidates for escalation
      const { data: sentReminders } = await supabase
        .from("lead_followups")
        .select("*")
        .eq("status", "sent")
        .order("user_id");

      if (sentReminders && sentReminders.length > 0) {
        // Group by user
        const sentByUser = new Map<string, typeof sentReminders>();
        for (const r of sentReminders) {
          const arr = sentByUser.get(r.user_id) || [];
          arr.push(r);
          sentByUser.set(r.user_id, arr);
        }

        for (const [escUserId, reminders] of sentByUser) {
          // Get escalation settings
          const { data: escSettings } = await supabase
            .from("followup_escalation_settings")
            .select("*")
            .eq("user_id", escUserId)
            .maybeSingle();

          if (!escSettings || !escSettings.enabled) continue;

          // Get escalation logs to avoid duplicate escalations
          const { data: existingLogs } = await supabase
            .from("followup_escalation_log")
            .select("followup_id, step")
            .eq("user_id", escUserId);

          const loggedMap = new Map<string, Set<number>>();
          for (const log of existingLogs || []) {
            const set = loggedMap.get(log.followup_id) || new Set<number>();
            set.add(log.step);
            loggedMap.set(log.followup_id, set);
          }

          for (const reminder of reminders) {
            const overdueMs = nowMs - new Date(reminder.reminder_at).getTime();
            const overdueHours = overdueMs / (1000 * 60 * 60);

            const alreadyLogged = loggedMap.get(reminder.id) || new Set<number>();

            // Determine which step to escalate to
            let escalateStep = 0;
            let escalateAction = "";
            let notifyEmail: string | null = null;

            if (escSettings.step1_enabled && overdueHours >= escSettings.step1_hours && !alreadyLogged.has(1)) {
              escalateStep = 1;
              escalateAction = "agent_reminder";
              // Get the user's own email for step 1
              const { data: userInfo } = await supabase.auth.admin.getUserById(escUserId);
              notifyEmail = userInfo?.user?.email || null;
            } else if (escSettings.step2_enabled && overdueHours >= escSettings.step2_hours && !alreadyLogged.has(2)) {
              escalateStep = 2;
              escalateAction = "manager_escalation";
              notifyEmail = escSettings.step2_manager_email || null;
            } else if (escSettings.step3_enabled && overdueHours >= escSettings.step3_hours && !alreadyLogged.has(3)) {
              escalateStep = 3;
              escalateAction = escSettings.step3_reassign_lead ? "lead_reassignment" : "final_escalation";
              notifyEmail = escSettings.step2_manager_email || null;
            }

            if (escalateStep === 0 || !notifyEmail) continue;

            // Get lead info
            const lead = reminder.lead_id ? leadMap.get(reminder.lead_id) : null;
            const leadName = lead?.full_name || reminder.title?.replace(/^Follow up:\s*/i, "") || "a lead";

            // Send escalation email using the user's SMTP
            let smtpForEsc = smtpConfig;
            // Reuse SMTP from earlier — look up if needed
            if (!smtpForEsc) {
              const { data: escSmtp } = await supabase
                .from("smtp_settings")
                .select("*")
                .eq("user_id", escUserId)
                .maybeSingle();
              smtpForEsc = escSmtp as typeof smtpForEsc | null;
              if (!smtpForEsc || !smtpForEsc.smtp_host) {
                // Try owner's SMTP
                const { data: userInfo2 } = await supabase.auth.admin.getUserById(escUserId);
                const memberEmail = userInfo2?.user?.email;
                if (memberEmail) {
                  const { data: teamMember } = await supabase
                    .from("team_members")
                    .select("owner_id")
                    .eq("email", memberEmail)
                    .maybeSingle();
                  if (teamMember?.owner_id) {
                    const { data: ownerSmtp } = await supabase
                      .from("smtp_settings")
                      .select("*")
                      .eq("user_id", teamMember.owner_id)
                      .maybeSingle();
                    if (ownerSmtp?.smtp_host) smtpForEsc = ownerSmtp as typeof smtpForEsc | null;
                  }
                }
              }
            }

            if (smtpForEsc && smtpForEsc.smtp_host && smtpForEsc.smtp_username && smtpForEsc.smtp_password) {
              const escTransporter = nodemailer.createTransport({
                host: smtpForEsc.smtp_host,
                port: smtpForEsc.smtp_port || 587,
                secure: (smtpForEsc.smtp_port || 587) === 465,
                auth: { user: smtpForEsc.smtp_username, pass: smtpForEsc.smtp_password },
              });

              const stepLabels: Record<number, string> = { 1: "Reminder", 2: "Manager Escalation", 3: "Final Escalation" };
              const escSubject = `[${stepLabels[escalateStep]}] Overdue follow-up: ${leadName}`;

              const escHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                  <div style="background: linear-gradient(135deg, #dc2626, #ea580c); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
                    <h1 style="color: #fff; margin: 0; font-size: 1.3rem;">${stepLabels[escalateStep]}</h1>
                    <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 0.85rem;">Overdue by ${Math.round(overdueHours)} hours</p>
                  </div>
                  <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
                    <p style="font-size: 1rem; color: #1f2937; margin: 0 0 12px;">
                      ${escalateStep === 1 ? "A follow-up reminder is overdue and has not been completed." : ""}
                      ${escalateStep === 2 ? "This follow-up has been overdue for an extended period and requires manager attention." : ""}
                      ${escalateStep === 3 ? "This follow-up has been severely overdue and requires immediate action." : ""}
                    </p>
                    <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 16px;">
                      <h2 style="margin: 0 0 8px; font-size: 1.1rem; color: #111827;">${leadName}</h2>
                      ${lead?.mobile_number && lead.mobile_number !== "N/A" ? `<p style="margin: 4px 0; font-size: 0.88rem; color: #64748b;"><strong>Phone:</strong> ${lead.mobile_number}</p>` : ""}
                      <p style="margin: 4px 0 0; font-size: 0.88rem; color: #64748b;"><strong>Scheduled:</strong> ${new Date(reminder.reminder_at).toLocaleString("en-US")}</p>
                      ${reminder.note ? `<div style="margin-top: 10px; padding: 10px; background: #f1f5f9; border-radius: 8px; font-size: 0.85rem; color: #475569;">${reminder.note}</div>` : ""}
                    </div>
                    <p style="font-size: 0.78rem; color: #94a3b8; text-align: center;">LeadCentre CRM — Auto Escalation</p>
                  </div>
                </div>
              `;

              try {
                await escTransporter.sendMail({
                  from: smtpForEsc.from_name
                    ? `"${smtpForEsc.from_name}" <${smtpForEsc.from_email || smtpForEsc.smtp_username}>`
                    : (smtpForEsc.from_email || smtpForEsc.smtp_username),
                  to: notifyEmail,
                  subject: escSubject,
                  html: escHtml,
                });
                totalEscalated++;
              } catch (err) {
                errors.push(`Escalation ${reminder.id} step ${escalateStep}: ${err instanceof Error ? err.message : "Unknown"}`);
              }
            }

            // Log the escalation
            await supabase.from("followup_escalation_log").insert({
              user_id: escUserId,
              followup_id: reminder.id,
              lead_id: reminder.lead_id,
              step: escalateStep,
              action: escalateAction,
              notified_email: notifyEmail,
            });

            // Step 3 reassignment: find another team member and reassign the lead
            if (escalateStep === 3 && escSettings.step3_reassign_lead && reminder.lead_id) {
              const { data: teamMembers } = await supabase
                .from("team_members")
                .select("email")
                .eq("owner_id", escUserId)
                .eq("role", "agent")
                .limit(10);

              if (teamMembers && teamMembers.length > 0) {
                // Pick the first agent (simple rotation)
                const newAgentEmail = teamMembers[0].email;
                const { data: newAgentUser } = await supabase.auth.admin.listUsers();
                const newAgent = newAgentUser?.users?.find((u: { email?: string }) => u.email === newAgentEmail);
                if (newAgent) {
                  await supabase
                    .from("submissions")
                    .update({ assigned_to: newAgent.id, updated_at: new Date().toISOString() })
                    .eq("id", reminder.lead_id);
                }
              }
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent: totalSent, escalated: totalEscalated, errors: errors.length > 0 ? errors : undefined }),
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
