import { createClient } from "npm:@supabase/supabase-js@2";

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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isSuperAdmin, error: adminCheckError } = await userClient.rpc("is_super_admin");
    if (adminCheckError || !isSuperAdmin) {
      return new Response(JSON.stringify({ error: "Unauthorized: super admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json();
    const { action } = body;

    // ── Delete account ──────────────────────────────────────────
    if (action === "delete_account") {
      const { targetUserId, targetEmail } = body;
      if (!targetUserId) {
        return new Response(JSON.stringify({ error: "targetUserId is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (targetUserId === user.id) {
        return new Response(JSON.stringify({ error: "You cannot delete your own admin account" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete the auth user — ON DELETE CASCADE on all foreign keys removes related data
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetUserId);
      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Log the action
      await adminClient.from("admin_audit_log").insert({
        admin_id: user.id,
        admin_email: user.email!,
        action_type: "account_deleted",
        target_user_id: targetUserId,
        target_email: targetEmail || null,
        details: { method: "super_admin_panel" },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Bulk delete accounts ────────────────────────────────────
    if (action === "bulk_delete_accounts") {
      const { accounts } = body as { accounts: Array<{ user_id: string; email: string }> };
      if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
        return new Response(JSON.stringify({ error: "accounts array is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Prevent self-deletion
      const filtered = accounts.filter((a) => a.user_id !== user.id);
      if (filtered.length === 0) {
        return new Response(JSON.stringify({ error: "No valid accounts to delete (self-deletion blocked)" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const results: Array<{ user_id: string; email: string; success: boolean; error?: string }> = [];

      for (const acct of filtered) {
        const { error: delErr } = await adminClient.auth.admin.deleteUser(acct.user_id);
        if (delErr) {
          results.push({ user_id: acct.user_id, email: acct.email, success: false, error: delErr.message });
        } else {
          results.push({ user_id: acct.user_id, email: acct.email, success: true });
        }
      }

      // Log the bulk action
      const successCount = results.filter((r) => r.success).length;
      await adminClient.from("admin_audit_log").insert({
        admin_id: user.id,
        admin_email: user.email!,
        action_type: "accounts_bulk_deleted",
        target_user_id: null,
        target_email: null,
        details: {
          total_requested: accounts.length,
          succeeded: successCount,
          failed: results.length - successCount,
          accounts: filtered.map((a) => ({ user_id: a.user_id, email: a.email })),
        },
      });

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Assign / change plan ────────────────────────────────────
    if (action === "assign_plan") {
      const { targetUserId, targetEmail, planId, planName, billingCycle, status } = body;
      if (!targetUserId || !planId) {
        return new Response(JSON.stringify({ error: "targetUserId and planId are required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if subscription already exists for this user
      const { data: existingSub, error: fetchErr } = await adminClient
        .from("account_subscriptions")
        .select("id")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (fetchErr) {
        return new Response(JSON.stringify({ error: fetchErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const now = new Date().toISOString();
      const periodEnd = new Date();
      periodEnd.setDate(periodEnd.getDate() + (billingCycle === "annual" ? 365 : 30));

      if (existingSub) {
        // Update existing subscription
        const { error: updateErr } = await adminClient
          .from("account_subscriptions")
          .update({
            plan_id: planId,
            billing_cycle: billingCycle || "monthly",
            status: status || "active",
            current_period_start: now,
            current_period_end: periodEnd.toISOString(),
            updated_at: now,
          })
          .eq("id", existingSub.id);

        if (updateErr) {
          return new Response(JSON.stringify({ error: updateErr.message }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        // Create new subscription
        const { error: insertErr } = await adminClient
          .from("account_subscriptions")
          .insert({
            user_id: targetUserId,
            plan_id: planId,
            billing_cycle: billingCycle || "monthly",
            status: status || "active",
            current_period_start: now,
            current_period_end: periodEnd.toISOString(),
          });

        if (insertErr) {
          return new Response(JSON.stringify({ error: insertErr.message }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Log the action
      await adminClient.from("admin_audit_log").insert({
        admin_id: user.id,
        admin_email: user.email!,
        action_type: "plan_assigned",
        target_user_id: targetUserId,
        target_email: targetEmail || null,
        details: { plan_id: planId, plan_name: planName, billing_cycle: billingCycle, status: status || "active" },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Remove plan (set to free / cancel) ──────────────────────
    if (action === "remove_plan") {
      const { targetUserId, targetEmail } = body;
      if (!targetUserId) {
        return new Response(JSON.stringify({ error: "targetUserId is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateErr } = await adminClient
        .from("account_subscriptions")
        .update({ status: "canceled", plan_id: null, updated_at: new Date().toISOString() })
        .eq("user_id", targetUserId);

      if (updateErr) {
        return new Response(JSON.stringify({ error: updateErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await adminClient.from("admin_audit_log").insert({
        admin_id: user.id,
        admin_email: user.email!,
        action_type: "plan_removed",
        target_user_id: targetUserId,
        target_email: targetEmail || null,
        details: { reason: "super_admin_panel" },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Fetch audit log ─────────────────────────────────────────
    if (action === "get_audit_log") {
      const { data, error: logErr } = await adminClient
        .from("admin_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (logErr) {
        return new Response(JSON.stringify({ error: logErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
