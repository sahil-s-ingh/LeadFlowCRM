import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface OptimizationRule {
  id: string;
  name: string;
  metric: string;
  condition: string;
  threshold: number;
  action: string;
  change_pct: number;
  is_active: boolean;
}

interface CampaignSnapshot {
  campaign_id: string;
  campaign_name: string;
  adset_id: string;
  adset_name: string;
  spend: number;
  cpl: number | null;
  roas: number | null;
  lead_quality_score: number | null;
  health_score: number | null;
  cost_per_conversion: number | null;
  conversions: number;
  leads: number;
}

interface MarketingSettings {
  access_token: string;
  ad_account_id: string;
  is_enabled: boolean;
  auto_optimize: boolean;
  max_budget_change_pct: number;
}

function evaluateRule(
  rule: OptimizationRule,
  snapshot: CampaignSnapshot,
): { triggered: boolean; value: number } {
  let value = 0;
  switch (rule.metric) {
    case "cpl":
      value = snapshot.cpl ?? 0;
      break;
    case "roas":
      value = snapshot.roas ?? 0;
      break;
    case "lead_quality":
      value = snapshot.lead_quality_score ?? 0;
      break;
    case "health_score":
      value = snapshot.health_score ?? 0;
      break;
    case "cost_per_conversion":
      value = snapshot.cost_per_conversion ?? 0;
      break;
    case "conversions":
      value = snapshot.conversions ?? 0;
      break;
  }

  let triggered = false;
  if (rule.condition === "below" && value < rule.threshold) triggered = true;
  if (rule.condition === "above" && value > rule.threshold) triggered = true;

  return { triggered, value };
}

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

    const { data: settings } = await adminSupabase
      .from("meta_marketing_settings")
      .select("*")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!settings) {
      return new Response(
        JSON.stringify({ error: "No credentials saved yet. Open Campaign Optimizer → Settings, enter your Access Token and Ad Account ID, and click Save Settings first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const mk = settings as MarketingSettings;
    if (!mk.access_token || !mk.ad_account_id) {
      return new Response(
        JSON.stringify({ error: "Access Token and Ad Account ID are required. Fill them in Campaign Optimizer → Settings and click Save Settings." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!mk.is_enabled) {
      return new Response(
        JSON.stringify({ success: false, message: "Marketing API is disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch active optimization rules
    const { data: rulesData } = await adminSupabase
      .from("optimization_rules")
      .select("*")
      .eq("user_id", userData.user.id)
      .eq("is_active", true);

    const rules = (rulesData || []) as unknown as OptimizationRule[];

    if (rules.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No active optimization rules", actions_taken: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch latest campaign snapshots
    const today = new Date().toISOString().slice(0, 10);
    const { data: snapshotsData } = await adminSupabase
      .from("campaign_snapshots")
      .select("*")
      .eq("user_id", userData.user.id)
      .eq("snapshot_date", today)
      .order("spend", { ascending: false });

    const snapshots = (snapshotsData || []) as unknown as CampaignSnapshot[];

    if (snapshots.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: "No campaign snapshots available. Run a sync first." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;
    const maxChangePct = mk.max_budget_change_pct || 20;
    const accountId = mk.ad_account_id.replace(/^act_/, "");
    const actionsTaken: Array<Record<string, unknown>> = [];

    // Group snapshots by campaign (adset level → take the one with highest spend per campaign)
    const campaignMap = new Map<string, CampaignSnapshot>();
    for (const snap of snapshots) {
      const existing = campaignMap.get(snap.campaign_id);
      if (!existing || snap.spend > existing.spend) {
        campaignMap.set(snap.campaign_id, snap);
      }
    }

    for (const [campaignId, snapshot] of campaignMap) {
      for (const rule of rules) {
        const { triggered, value } = evaluateRule(rule, snapshot);
        if (!triggered) continue;

        if (rule.action === "notify") {
          actionsTaken.push({
            rule_id: rule.id,
            rule_name: rule.name,
            campaign_id: campaignId,
            campaign_name: snapshot.campaign_name,
            action_taken: "notify",
            metric_value: value,
            success: true,
          });
          continue;
        }

        if (rule.action === "pause") {
          if (dryRun) {
            actionsTaken.push({
              rule_id: rule.id,
              rule_name: rule.name,
              campaign_id: campaignId,
              campaign_name: snapshot.campaign_name,
              action_taken: "pause (dry run)",
              metric_value: value,
              success: true,
            });
            continue;
          }

          const pauseUrl = `https://graph.facebook.com/v20.0/${campaignId}?access_token=${mk.access_token}`;
          const pauseRes = await fetch(pauseUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "PAUSED" }),
          });
          const pauseResult = await pauseRes.json();
          const success = pauseRes.ok;

          await adminSupabase.from("optimization_logs").insert({
            user_id: userData.user.id,
            rule_id: rule.id,
            rule_name: rule.name,
            campaign_id: campaignId,
            campaign_name: snapshot.campaign_name,
            action_taken: "pause",
            metric_value: value,
            success,
            error_message: success ? null : (pauseResult.error?.message || `HTTP ${pauseRes.status}`),
          });

          actionsTaken.push({
            rule_id: rule.id,
            rule_name: rule.name,
            campaign_id: campaignId,
            campaign_name: snapshot.campaign_name,
            action_taken: "pause",
            metric_value: value,
            success,
          });
          continue;
        }

        // increase_budget or decrease_budget
        const rawChange = rule.change_pct || 10;
        const clampedChange = Math.min(rawChange, maxChangePct);
        const direction = rule.action === "increase_budget" ? 1 : -1;
        const changePct = direction * clampedChange;

        // Fetch current daily budget from Meta
        const campaignUrl = `https://graph.facebook.com/v20.0/${campaignId}?fields=daily_budget,configured_status&access_token=${mk.access_token}`;
        const campaignRes = await fetch(campaignUrl);
        const campaignData = await campaignRes.json();
        const currentBudget = parseFloat(campaignData.daily_budget || "0");

        if (currentBudget <= 0) {
          actionsTaken.push({
            rule_id: rule.id,
            rule_name: rule.name,
            campaign_id: campaignId,
            campaign_name: snapshot.campaign_name,
            action_taken: `${rule.action} (skipped — no daily budget found)`,
            metric_value: value,
            success: false,
            error_message: "Campaign has no daily budget set",
          });
          continue;
        }

        const newBudget = Math.max(1, Math.round(currentBudget * (1 + changePct / 100) * 100) / 100);

        if (dryRun) {
          actionsTaken.push({
            rule_id: rule.id,
            rule_name: rule.name,
            campaign_id: campaignId,
            campaign_name: snapshot.campaign_name,
            action_taken: `${rule.action} (dry run)`,
            old_budget: currentBudget,
            new_budget: newBudget,
            metric_value: value,
            success: true,
          });
          continue;
        }

        const updateUrl = `https://graph.facebook.com/v20.0/${campaignId}?access_token=${mk.access_token}`;
        const updateRes = await fetch(updateUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ daily_budget: String(Math.round(newBudget * 100)) }),
        });
        const updateResult = await updateRes.json();
        const success = updateRes.ok;

        await adminSupabase.from("optimization_logs").insert({
          user_id: userData.user.id,
          rule_id: rule.id,
          rule_name: rule.name,
          campaign_id: campaignId,
          campaign_name: snapshot.campaign_name,
          action_taken: rule.action,
          old_budget: currentBudget,
          new_budget: success ? newBudget : null,
          metric_value: value,
          success,
          error_message: success ? null : (updateResult.error?.message || `HTTP ${updateRes.status}`),
        });

        actionsTaken.push({
          rule_id: rule.id,
          rule_name: rule.name,
          campaign_id: campaignId,
          campaign_name: snapshot.campaign_name,
          action_taken: rule.action,
          old_budget: currentBudget,
          new_budget: success ? newBudget : null,
          metric_value: value,
          success,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        actions_taken: actionsTaken.length,
        dry_run: dryRun,
        actions: actionsTaken,
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

