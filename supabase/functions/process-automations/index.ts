// Advanced automation processor: test runs, suggestions, time windows, webhook triggers, if/else branching
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ActionStep {
  type: string;
  config: Record<string, unknown>;
}

interface AutomationFlow {
  id: string;
  name: string;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  actions: ActionStep[];
  user_id: string;
  time_window_config?: Record<string, unknown>;
}

interface QueueItem {
  id: string;
  flow_id: string;
  lead_id: string | null;
  run_id: string | null;
  actions: ActionStep[];
  context: Record<string, unknown>;
  execute_at: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { trigger_type, lead_id, lead_data, message_data, mode, user_id, is_test, webhook_payload } = body;

    if (mode === "process_queue") {
      return await processQueue(supabase);
    }

    if (mode === "test_run") {
      return await runTestFlow(supabase, body);
    }

    if (mode === "webhook_trigger") {
      return await handleWebhookTrigger(supabase, body);
    }

    if (mode === "generate_suggestions") {
      return await generateSuggestions(supabase, user_id);
    }

    if (!trigger_type) {
      return new Response(JSON.stringify({ error: "trigger_type is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let flowQuery = supabase
      .from("automation_flows")
      .select("*")
      .eq("trigger_type", trigger_type)
      .eq("is_active", true);

    if (user_id) {
      flowQuery = flowQuery.eq("user_id", user_id);
    }

    const { data: flows, error: flowError } = await flowQuery;
    if (flowError) throw flowError;

    const runResults: Record<string, string> = {};

    for (const flow of (flows || []) as AutomationFlow[]) {
      if (!isWithinTimeWindow(flow.time_window_config)) {
        continue;
      }

      const log: Record<string, unknown> = { actions: [] };
      let allSuccess = true;

      if (trigger_type === "lead_created" && flow.trigger_config?.product) {
        if ((lead_data as Record<string, unknown>)?.trading_product !== flow.trigger_config.product) {
          continue;
        }
      }
      if (trigger_type === "lead_status_changed" && flow.trigger_config?.status) {
        if ((lead_data as Record<string, unknown>)?.status !== flow.trigger_config.status) {
          continue;
        }
      }
      if (trigger_type === "lead_tagged" && flow.trigger_config?.tag) {
        const tags = ((lead_data as Record<string, unknown>)?.tags as string[]) || [];
        if (!tags.includes(flow.trigger_config.tag as string)) {
          continue;
        }
      }
      if (trigger_type === "lead_assigned" && flow.trigger_config?.assignee_email) {
        const assignedTo = (lead_data as Record<string, unknown>)?.assigned_to;
        const { data: member } = await supabase
          .from("team_members")
          .select("email")
          .eq("user_id", assignedTo)
          .maybeSingle();
        if (member?.email !== flow.trigger_config.assignee_email) {
          continue;
        }
      }

      const { data: run } = await supabase
        .from("automation_runs")
        .insert({
          flow_id: flow.id,
          lead_id: lead_id || null,
          status: "running",
          run_log: log,
          is_test: is_test || false,
        })
        .select()
        .maybeSingle();

      const runId = run?.id || null;

      const result = await executeActionSequence(
        supabase,
        flow.actions,
        { lead_id, lead_data, message_data, flow_id: flow.id, run_id: runId }
      );

      if (result.delayed) {
        await supabase.from("automation_runs").update({ status: "delayed", run_log: { actions: result.log } }).eq("id", runId);
        runResults[flow.id] = "delayed";
      } else {
        allSuccess = result.success;
        (log as Record<string, unknown>).actions = result.log;
        await supabase.from("automation_runs").update({ status: allSuccess ? "success" : "failed", run_log: log }).eq("id", runId);
        runResults[flow.id] = allSuccess ? "success" : "failed";
      }
    }

    return new Response(JSON.stringify({ triggered: Object.keys(runResults).length, results: runResults }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function isWithinTimeWindow(config?: Record<string, unknown>): boolean {
  if (!config || !config.enabled) return true;
  const now = new Date();
  const dayOfWeek = now.getDay();
  const days = (config.days as number[]) || [0, 1, 2, 3, 4, 5, 6];
  if (!days.includes(dayOfWeek)) return false;
  const startHour = (config.start_hour as number) ?? 0;
  const endHour = (config.end_hour as number) ?? 24;
  const currentHour = now.getHours();
  if (currentHour < startHour || currentHour >= endHour) return false;
  return true;
}

async function runTestFlow(supabase: ReturnType<typeof createClient>, body: Record<string, unknown>): Promise<Response> {
  const { flow_id, test_lead } = body;

  const { data: flow } = await supabase
    .from("automation_flows")
    .select("*")
    .eq("id", flow_id as string)
    .maybeSingle();

  if (!flow) {
    return new Response(JSON.stringify({ error: "Flow not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const fakeLead = (test_lead as Record<string, unknown>) || {
    full_name: "Test Lead",
    email: "test@example.com",
    mobile_number: "+1234567890",
    status: "new",
    trading_product: "algo",
    fund_amount: "5000",
    state: "California",
  };

  const log: Record<string, unknown> = { actions: [] };
  const summary: string[] = [];

  for (const action of (flow.actions as ActionStep[])) {
    if (action.type === "delay") {
      const mins = Number(action.config.minutes) || 0;
      const hours = Number(action.config.hours) || 0;
      const days = Number(action.config.days) || 0;
      const total = mins + hours * 60 + days * 1440;
      summary.push(`[Delay] Would wait ${total} minute(s)`);
      continue;
    }
    if (action.type === "condition") {
      const field = (action.config.field as string) || "";
      const op = (action.config.operator as string) || "equals";
      const val = (action.config.value as string) || "";
      const fv = String(fakeLead[field] ?? "");
      let matches = false;
      if (op === "equals") matches = fv === val;
      else if (op === "not_equals") matches = fv !== val;
      else if (op === "contains") matches = fv.includes(val);
      else if (op === "greater_than") matches = parseFloat(fv) > parseFloat(val);
      else if (op === "less_than") matches = parseFloat(fv) < parseFloat(val);
      const branch = (action.config.branch as string) || "stop";
      if (matches) {
        summary.push(`[Condition] ${field} ${op} ${val} → TRUE — would continue`);
      } else if (branch === "else") {
        summary.push(`[Condition] ${field} ${op} ${val} → FALSE — would take ELSE branch`);
      } else {
        summary.push(`[Condition] ${field} ${op} ${val} → FALSE — would stop`);
      }
      continue;
    }
    if (action.type === "send_email") {
      const subject = ((action.config.subject as string) || "Email").replace(/\{\{lead_name\}\}/g, (fakeLead.full_name as string) || "there");
      summary.push(`[Email] Would send "${subject}" to ${fakeLead.email || "test@example.com"}`);
      continue;
    }
    if (action.type === "send_whatsapp") {
      const msg = ((action.config.message as string) || "").replace(/\{\{lead_name\}\}/g, (fakeLead.full_name as string) || "there").slice(0, 60);
      summary.push(`[WhatsApp] Would send "${msg}..." to ${fakeLead.mobile_number || "+1234567890"}`);
      continue;
    }
    if (action.type === "send_telegram") {
      const msg = ((action.config.message as string) || "").replace(/\{\{lead_name\}\}/g, (fakeLead.full_name as string) || "there").slice(0, 60);
      summary.push(`[Telegram] Would send "${msg}..." to lead's Telegram chat`);
      continue;
    }
    if (action.type === "send_notification") {
      const msg = ((action.config.message as string) || "").replace(/\{\{lead_name\}\}/g, (fakeLead.full_name as string) || "there").slice(0, 60);
      summary.push(`[Notification] Would post in team chat: "${msg}..."`);
      continue;
    }
    if (action.type === "assign_lead") {
      summary.push(`[Assign] Would assign to ${action.config.assignee_email || "selected member"}`);
      continue;
    }
    if (action.type === "add_tag") {
      summary.push(`[Tag] Would add tag "${action.config.tag || "tag"}"`);
      continue;
    }
    if (action.type === "change_status") {
      summary.push(`[Status] Would change status to "${action.config.status || "selected"}"`);
      continue;
    }
    if (action.type === "schedule_followup") {
      summary.push(`[Follow-up] Would schedule in ${action.config.days || "3"} days: "${action.config.title || "Follow-up"}"`);
      continue;
    }
    if (action.type === "fire_webhook") {
      summary.push(`[Webhook] Would ${action.config.method || "POST"} to ${action.config.url || "URL"}`);
      continue;
    }
    summary.push(`[${action.type}] Would execute`);
  }

  (log as Record<string, unknown>).actions = summary.map((s, i) => ({ step: i + 1, detail: s, status: "simulated" }));
  (log as Record<string, unknown>).test_lead = fakeLead;

  await supabase.from("automation_runs").insert({
    flow_id: flow.id,
    status: "success",
    run_log: log,
    is_test: true,
    result_summary: summary.join(". "),
  });

  return new Response(JSON.stringify({
    success: true,
    summary,
    test_lead: fakeLead,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleWebhookTrigger(supabase: ReturnType<typeof createClient>, body: Record<string, unknown>): Promise<Response> {
  const { webhook_url, payload } = body;

  if (!webhook_url) {
    return new Response(JSON.stringify({ error: "webhook_url is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: flow } = await supabase
    .from("automation_flows")
    .select("*")
    .eq("webhook_url", webhook_url as string)
    .eq("is_active", true)
    .maybeSingle();

  if (!flow) {
    return new Response(JSON.stringify({ error: "No active flow found for this webhook URL" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await supabase.from("automation_webhook_triggers").insert({
    flow_id: flow.id,
    payload: payload || {},
  });

  const leadData = (payload as Record<string, unknown>)?.lead_data || payload || {};

  const log: Record<string, unknown> = { actions: [] };
  const result = await executeActionSequence(
    supabase,
    flow.actions as ActionStep[],
    { lead_data: leadData as Record<string, unknown>, flow_id: flow.id, run_id: null }
  );

  (log as Record<string, unknown>).actions = result.log;

  await supabase.from("automation_runs").insert({
    flow_id: flow.id,
    status: result.success ? "success" : "failed",
    run_log: log,
  });

  await supabase.from("automation_webhook_triggers")
    .update({ processed: true })
    .eq("flow_id", flow.id);

  return new Response(JSON.stringify({
    success: result.success,
    triggered: flow.name,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function generateSuggestions(supabase: ReturnType<typeof createClient>, user_id: string): Promise<Response> {
  if (!user_id) {
    return new Response(JSON.stringify({ error: "user_id is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: leads } = await supabase
    .from("submissions")
    .select("id, status, created_at, tags, assigned_to, mobile_number, email, trading_product")
    .order("created_at", { ascending: false })
    .limit(500);

  const { data: flows } = await supabase
    .from("automation_flows")
    .select("id, name, trigger_type, is_active, actions")
    .eq("user_id", user_id);

  const { data: runs } = await supabase
    .from("automation_runs")
    .select("flow_id, status, created_at, lead_id")
    .order("created_at", { ascending: false })
    .limit(200);

  const suggestions: {
    suggestion_type: string;
    title: string;
    description: string;
    data: Record<string, unknown>;
    confidence: number;
  }[] = [];

  const leadList = (leads || []) as Record<string, unknown>[];
  const flowList = (flows || []) as Record<string, unknown>[];
  const runList = (runs || []) as Record<string, unknown>[];

  // Suggestion 1: Response time
  const hasInstantReply = flowList.some((f) =>
    f.trigger_type === "lead_created" &&
    (f.actions as ActionStep[]).some((a) => a.type === "send_whatsapp" || a.type === "send_email")
  );
  if (!hasInstantReply && leadList.length > 5) {
    suggestions.push({
      suggestion_type: "response_time",
      title: "Add an instant reply automation",
      description: `You have ${leadList.length} leads but no automation sending an instant reply when a new lead arrives. Leads who receive a response within 5 minutes are 21x more likely to convert. Consider creating a "Welcome" automation that sends a WhatsApp or email message immediately when a lead is created.`,
      data: { lead_count: leadList.length, missing_trigger: "lead_created" },
      confidence: 0.85,
    });
  }

  // Suggestion 2: Follow-up gap
  const coldLeads = leadList.filter((l) => l.status === "called_no_response");
  if (coldLeads.length > 3) {
    const hasReengage = flowList.some((f) =>
      f.trigger_type === "lead_status_changed" &&
      (f.trigger_config as Record<string, unknown>)?.status === "called_no_response"
    );
    if (!hasReengage) {
      suggestions.push({
        suggestion_type: "follow_up_gap",
        title: `${coldLeads.length} cold leads without re-engagement automation`,
        description: `You have ${coldLeads.length} leads marked "Called - No Response" but no automation to re-engage them. Create a "Re-Engage Cold Leads" automation that triggers when status changes to "Called - No Response" and schedules a follow-up reminder 3 days later.`,
        data: { cold_lead_count: coldLeads.length },
        confidence: 0.78,
      });
    }
  }

  // Suggestion 3: Conversion celebration
  const hasConversionFlow = flowList.some((f) =>
    f.trigger_type === "lead_status_changed" &&
    (f.trigger_config as Record<string, unknown>)?.status === "converted"
  );
  if (!hasConversionFlow && leadList.some((l) => l.status === "converted")) {
    suggestions.push({
      suggestion_type: "conversion_celebration",
      title: "Celebrate conversions with a team notification",
      description: "You have converted leads but no automation fires when a lead becomes a customer. Create a \"Conversion Celebration\" automation that notifies the team and tags the lead as \"won\" when status changes to Converted.",
      data: {},
      confidence: 0.72,
    });
  }

  // Suggestion 4: Run success rate
  if (runList.length > 10) {
    const failedRuns = runList.filter((r) => r.status === "failed");
    const failRate = failedRuns.length / runList.length;
    if (failRate > 0.3) {
      suggestions.push({
        suggestion_type: "high_failure_rate",
        title: `${Math.round(failRate * 100)}% of automation runs are failing`,
        description: `Out of ${runList.length} recent runs, ${failedRuns.length} failed. Common causes: missing email/phone on leads, team member not found, or Telegram bot not configured. Review the run history for details.`,
        data: { total_runs: runList.length, failed_runs: failedRuns.length, fail_rate: failRate },
        confidence: 0.9,
      });
    }
  }

  // Suggestion 5: Tagged hot leads
  const taggedLeads = leadList.filter((l) => {
    const tags = (l.tags as string[]) || [];
    return tags.includes("hot");
  });
  if (taggedLeads.length > 2) {
    const hasHotFlow = flowList.some((f) =>
      f.trigger_type === "lead_tagged" &&
      (f.trigger_config as Record<string, unknown>)?.tag === "hot"
    );
    if (!hasHotFlow) {
      suggestions.push({
        suggestion_type: "hot_lead_alert",
        title: `${taggedLeads.length} leads tagged "hot" without automation`,
        description: `You have ${taggedLeads.length} leads tagged "hot" but no automation to act on them instantly. Create a "Hot Lead Alert" automation that notifies the team and changes status to Interested when a lead gets the "hot" tag.`,
        data: { hot_lead_count: taggedLeads.length },
        confidence: 0.82,
      });
    }
  }

  // Clear old suggestions and insert new ones
  await supabase.from("automation_suggestions").delete().eq("user_id", user_id);
  if (suggestions.length > 0) {
    await supabase.from("automation_suggestions").insert(
      suggestions.map((s) => ({ ...s, user_id }))
    );
  }

  return new Response(JSON.stringify({ suggestions }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function executeActionSequence(
  supabase: ReturnType<typeof createClient>,
  actions: ActionStep[],
  context: {
    lead_id?: string;
    lead_data?: Record<string, unknown>;
    message_data?: Record<string, unknown>;
    flow_id: string;
    run_id: string | null;
  }
): Promise<{ success: boolean; log: unknown[]; delayed: boolean }> {
  const log: unknown[] = [];
  let allSuccess = true;

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];

    if (action.type === "delay") {
      const delayMinutes = Number(action.config.minutes) || 0;
      const delayHours = Number(action.config.hours) || 0;
      const delayDays = Number(action.config.days) || 0;
      const totalMinutes = delayMinutes + delayHours * 60 + delayDays * 24 * 60;

      if (totalMinutes > 0) {
        const executeAt = new Date(Date.now() + totalMinutes * 60 * 1000).toISOString();
        const remainingActions = actions.slice(i + 1);

        await supabase.from("automation_queue").insert({
          flow_id: context.flow_id,
          lead_id: context.lead_id || null,
          run_id: context.run_id,
          actions: remainingActions,
          context: {
            lead_data: context.lead_data,
            message_data: context.message_data,
          },
          execute_at: executeAt,
          status: "pending",
        });

        log.push({ type: "delay", status: "queued", detail: `delayed ${totalMinutes} min, ${remainingActions.length} actions queued` });
        return { success: true, log, delayed: true };
      }
      log.push({ type: "delay", status: "skipped", detail: "zero delay" });
      continue;
    }

    if (action.type === "condition") {
      const field = (action.config.field as string) || "";
      const operator = (action.config.operator as string) || "equals";
      const value = (action.config.value as string) || "";
      const branch = (action.config.branch as string) || "stop";
      const lead = context.lead_data || {};

      const fieldValue = String(lead[field] ?? "");
      let matches = false;

      if (operator === "equals") matches = fieldValue === value;
      else if (operator === "not_equals") matches = fieldValue !== value;
      else if (operator === "contains") matches = fieldValue.includes(value);
      else if (operator === "greater_than") matches = parseFloat(fieldValue) > parseFloat(value);
      else if (operator === "less_than") matches = parseFloat(fieldValue) < parseFloat(value);

      if (!matches) {
        log.push({ type: "condition", status: "skipped", detail: `${field} ${operator} ${value} → false` });
        if (branch === "else") {
          const elseActions = (action.config.else_actions as ActionStep[]) || [];
          if (elseActions.length > 0) {
            const elseResult = await executeActionSequence(supabase, elseActions, context);
            log.push({ type: "else_branch", status: elseResult.success ? "success" : "failed", detail: `${elseActions.length} else-actions executed` });
            if (!elseResult.success) allSuccess = false;
          }
          continue;
        }
        break;
      }
      log.push({ type: "condition", status: "success", detail: `${field} ${operator} ${value} → true` });
      continue;
    }

    try {
      const result = await executeAction(supabase, action, {
        lead_id: context.lead_id,
        lead_data: context.lead_data,
        message_data: context.message_data,
        flow_id: context.flow_id,
      });
      log.push({ type: action.type, status: "success", detail: result });
    } catch (err) {
      log.push({ type: action.type, status: "failed", error: (err as Error).message });
      allSuccess = false;
      break;
    }
  }

  return { success: allSuccess, log, delayed: false };
}

async function processQueue(
  supabase: ReturnType<typeof createClient>
): Promise<Response> {
  const now = new Date().toISOString();

  const { data: items, error } = await supabase
    .from("automation_queue")
    .select("*")
    .eq("status", "pending")
    .lte("execute_at", now)
    .limit(20);

  if (error) throw error;

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const item of (items || []) as QueueItem[]) {
    processed++;
    const ctx = item.context || {};
    const leadData = (ctx.lead_data as Record<string, unknown>) || {};
    const messageData = (ctx.message_data as Record<string, unknown>) || {};

    const result = await executeActionSequence(supabase, item.actions, {
      lead_id: item.lead_id || undefined,
      lead_data: leadData,
      message_data: messageData,
      flow_id: item.flow_id,
      run_id: item.run_id,
    });

    if (result.delayed) {
      await supabase.from("automation_queue").update({ status: "completed" }).eq("id", item.id);
      if (item.run_id) {
        await supabase.from("automation_runs").update({ status: "delayed", run_log: { actions: result.log } }).eq("id", item.run_id);
      }
    } else if (result.success) {
      succeeded++;
      await supabase.from("automation_queue").update({ status: "completed" }).eq("id", item.id);
      if (item.run_id) {
        await supabase.from("automation_runs").update({ status: "success", run_log: { actions: result.log } }).eq("id", item.run_id);
      }
    } else {
      failed++;
      await supabase.from("automation_queue").update({ status: "failed" }).eq("id", item.id);
      if (item.run_id) {
        await supabase.from("automation_runs").update({ status: "failed", run_log: { actions: result.log } }).eq("id", item.run_id);
      }
    }
  }

  return new Response(JSON.stringify({ processed, succeeded, failed }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function executeAction(
  supabase: ReturnType<typeof createClient>,
  action: ActionStep,
  context: { lead_id?: string; lead_data?: Record<string, unknown>; message_data?: Record<string, unknown>; flow_id?: string }
): Promise<string> {
  const { type, config } = action;
  const lead = context.lead_data || {};
  const leadName = (lead.full_name as string) || "there";
  const leadEmail = (lead.email as string) || "";

  const replacePlaceholders = (text: string): string => {
    return text
      .replace(/\{\{lead_name\}\}/g, leadName)
      .replace(/\{\{lead_email\}\}/g, leadEmail)
      .replace(/\{\{lead_phone\}\}/g, (lead.mobile_number as string) || "")
      .replace(/\{\{lead_status\}\}/g, (lead.status as string) || "")
      .replace(/\{\{lead_product\}\}/g, (lead.trading_product as string) || "");
  };

  if (type === "send_email") {
    const subject = replacePlaceholders((config.subject as string) || "Automated email");
    const body = replacePlaceholders((config.body as string) || "");
    if (!leadEmail) return "skipped: no email";
    const { error } = await supabase.from("scheduled_emails").insert({
      recipient_email: leadEmail,
      subject,
      body,
      status: "pending",
      lead_id: context.lead_id || null,
    });
    if (error) throw new Error(`Email insert failed: ${error.message}`);
    return `email queued to ${leadEmail}`;
  }

  if (type === "send_whatsapp") {
    const message = replacePlaceholders((config.message as string) || "");
    const phone = (lead.mobile_number as string) || "";
    if (!phone) return "skipped: no phone";
    const cleanPhone = phone.replace(/^\+/, "");
    const { data: flowOwner } = await supabase
      .from("automation_flows")
      .select("user_id")
      .eq("id", context.flow_id || "")
      .maybeSingle();
    const ownerId = (flowOwner?.user_id as string) || ((lead as Record<string, unknown>).user_id as string) || null;
    if (!ownerId) return "skipped: no flow owner";
    const { data: waSettings } = await supabase
      .from("whatsapp_settings")
      .select("phone_number_id, access_token")
      .eq("user_id", ownerId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!waSettings?.phone_number_id || !waSettings?.access_token) return "skipped: whatsapp not configured";
    const waResp = await fetch(`https://graph.facebook.com/v20.0/${waSettings.phone_number_id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${waSettings.access_token}` },
      body: JSON.stringify({ messaging_product: "whatsapp", to: cleanPhone, type: "text", text: { body: message } }),
    });
    const waData = await waResp.json();
    if (waData.error) return `whatsapp send failed: ${waData.error.message || "unknown"}`;
    return `whatsapp sent to ${cleanPhone}`;
  }

  if (type === "send_telegram") {
    const message = replacePlaceholders((config.message as string) || "");
    if (!message) return "skipped: no message";
    const { data: flowOwner } = await supabase
      .from("automation_flows")
      .select("user_id")
      .eq("id", context.flow_id || "")
      .maybeSingle();
    const ownerUserId = flowOwner?.user_id || null;
    if (!ownerUserId) return "skipped: no flow owner";
    const { data: tgSettings } = await supabase
      .from("telegram_settings")
      .select("bot_token")
      .eq("user_id", ownerUserId)
      .maybeSingle();
    if (!tgSettings?.bot_token) return "skipped: telegram bot not configured";
    let chatId: string | number | null = null;
    if (context.lead_id) {
      const { data: conv } = await supabase
        .from("telegram_conversations")
        .select("telegram_chat_id")
        .eq("lead_id", context.lead_id)
        .maybeSingle();
      if (conv?.telegram_chat_id) chatId = conv.telegram_chat_id;
    }
    if (!chatId) return "skipped: no telegram chat for lead";
    const tgResp = await fetch(
      `https://api.telegram.org/bot${tgSettings.bot_token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" }),
      },
    );
    if (!tgResp.ok) {
      const tgErr = await tgResp.text();
      throw new Error(`Telegram send failed: ${tgErr}`);
    }
    return `telegram sent to ${chatId}`;
  }

  if (type === "assign_lead") {
    const assigneeEmail = (config.assignee_email as string) || "";
    if (!assigneeEmail || !context.lead_id) return "skipped: no assignee or lead";
    const { data: member } = await supabase
      .from("team_members")
      .select("user_id")
      .eq("email", assigneeEmail)
      .maybeSingle();
    if (!member) return `skipped: team member ${assigneeEmail} not found`;
    const { error } = await supabase
      .from("submissions")
      .update({ assigned_to: member.user_id })
      .eq("id", context.lead_id);
    if (error) throw new Error(`Assign failed: ${error.message}`);
    return `assigned to ${assigneeEmail}`;
  }

  if (type === "add_tag") {
    const tag = (config.tag as string) || "";
    if (!tag || !context.lead_id) return "skipped: no tag or lead";
    const { data: leadRow } = await supabase
      .from("submissions")
      .select("tags")
      .eq("id", context.lead_id)
      .maybeSingle();
    const existingTags: string[] = (leadRow?.tags as string[]) || [];
    if (existingTags.includes(tag)) return `tag "${tag}" already present`;
    const { error } = await supabase
      .from("submissions")
      .update({ tags: [...existingTags, tag] })
      .eq("id", context.lead_id);
    if (error) throw new Error(`Tag failed: ${error.message}`);
    return `added tag "${tag}"`;
  }

  if (type === "change_status") {
    const status = (config.status as string) || "";
    if (!status || !context.lead_id) return "skipped: no status or lead";
    const { error } = await supabase
      .from("submissions")
      .update({ status })
      .eq("id", context.lead_id);
    if (error) throw new Error(`Status change failed: ${error.message}`);
    return `status changed to ${status}`;
  }

  if (type === "send_notification") {
    const message = replacePlaceholders((config.message as string) || "Automation notification");
    const { data: flowOwner } = await supabase
      .from("automation_flows")
      .select("user_id")
      .eq("id", context.flow_id || "")
      .maybeSingle();
    const { error } = await supabase.from("team_chat_messages").insert({
      message_text: `[Automation] ${message}`,
      sender_name: "Automation",
      sender_role: "system",
      team_owner_id: flowOwner?.user_id || null,
      sender_id: flowOwner?.user_id || null,
    });
    if (error) throw new Error(`Notification failed: ${error.message}`);
    return "notification sent";
  }

  if (type === "fire_webhook") {
    const url = (config.url as string) || "";
    const method = (config.method as string) || "POST";
    if (!url) return "skipped: no webhook URL";
    const resp = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method !== "GET" ? JSON.stringify({ lead, trigger: "automation" }) : undefined,
    });
    return `webhook fired: ${resp.status}`;
  }

  if (type === "schedule_followup") {
    const daysAhead = Number(config.days) || 1;
    const note = replacePlaceholders((config.note as string) || "Automated follow-up");
    if (!context.lead_id) return "skipped: no lead";
    const dueDate = new Date(Date.now() + daysAhead * 24 * 60 * 1000).toISOString();
    const { data: flowOwner } = await supabase
      .from("automation_flows")
      .select("user_id")
      .eq("id", context.flow_id || "")
      .maybeSingle();
    const { error } = await supabase.from("lead_followups").insert({
      user_id: flowOwner?.user_id,
      lead_id: context.lead_id,
      title: `Follow up: ${leadName}`,
      note,
      reminder_at: dueDate,
      status: "pending",
    });
    if (error) throw new Error(`Follow-up failed: ${error.message}`);
    return `follow-up scheduled in ${daysAhead} days`;
  }

  return `unknown action type: ${type}`;
}

