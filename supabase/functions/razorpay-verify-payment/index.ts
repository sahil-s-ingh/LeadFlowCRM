import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { createHmac } from "node:crypto";

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

    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, dbOrderId, customerName, customerEmail, customerPhone, customerState, planName, planId, targetUserId, adminEmail, billingCycle } = await req.json();

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return new Response(
        JSON.stringify({ error: "Missing payment verification fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch Razorpay secret from platform_payment_settings
    const { data: paymentSettings, error: settingsError } = await supabase
      .from("platform_payment_settings")
      .select("razorpay_key_secret")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (settingsError || !paymentSettings || !paymentSettings.razorpay_key_secret) {
      return new Response(
        JSON.stringify({ error: "Payment gateway not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const keySecret = paymentSettings.razorpay_key_secret;

    // Verify signature: HMAC-SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret)
    const expectedSignature = createHmac("sha256", keySecret)
      .update(razorpayOrderId + "|" + razorpayPaymentId)
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      // Mark order as failed
      if (dbOrderId) {
        await supabase.from("payment_orders").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", dbOrderId);
      }
      return new Response(
        JSON.stringify({ error: "Payment verification failed. Signature mismatch." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Update order as paid
    const { error: updateError } = await supabase
      .from("payment_orders")
      .update({
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: razorpaySignature,
        status: "paid",
        updated_at: new Date().toISOString(),
      })
      .eq("razorpay_order_id", razorpayOrderId);

    if (updateError) {
      console.error("Failed to update order:", updateError.message);
    }

    // ── Admin assisted checkout: activate subscription for target user ──
    if (targetUserId && planId) {
      const now = new Date().toISOString();
      const periodEnd = new Date();
      periodEnd.setDate(periodEnd.getDate() + (billingCycle === "annual" ? 365 : 30));

      // Check if subscription already exists
      const { data: existingSub } = await supabase
        .from("account_subscriptions")
        .select("id")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (existingSub) {
        await supabase
          .from("account_subscriptions")
          .update({ plan_id: planId, billing_cycle: billingCycle || "monthly", status: "active", current_period_start: now, current_period_end: periodEnd.toISOString(), updated_at: now })
          .eq("id", existingSub.id);
      } else {
        await supabase
          .from("account_subscriptions")
          .insert({ user_id: targetUserId, plan_id: planId, billing_cycle: billingCycle || "monthly", status: "active", current_period_start: now, current_period_end: periodEnd.toISOString() });
      }

      // Log to audit trail
      if (adminEmail) {
        await supabase.from("admin_audit_log").insert({
          admin_id: "00000000-0000-0000-0000-000000000000",
          admin_email: adminEmail,
          action_type: "admin_assisted_checkout",
          target_user_id: targetUserId,
          target_email: customerEmail || null,
          details: { plan_id: planId, plan_name: planName, billing_cycle: billingCycle || "monthly", amount: "paid via razorpay" },
        });
      }

      return new Response(
        JSON.stringify({ success: true, message: "Payment verified and subscription activated", targetUserId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Normal checkout: create a lead/submission ──
    let submissionId: string | null = null;
    const { data: ownerId } = await supabase.rpc("get_platform_owner_id");

    const { data: leadData, error: leadError } = await supabase.from("submissions").insert({
      full_name: customerName,
      mobile_number: customerPhone,
      email: customerEmail,
      state: customerState || null,
      trading_product: "both",
      user_id: ownerId ?? null,
      status: "converted",
    }).select("id").single();

    if (leadError) {
      console.error("Failed to create lead:", leadError.message);
    } else if (leadData) {
      submissionId = leadData.id;
      await supabase.from("payment_orders").update({ submission_id: submissionId }).eq("razorpay_order_id", razorpayOrderId);
    }

    if (submissionId) {
      fetch(`${supabaseUrl}/functions/v1/send-welcome-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: submissionId, fullName: customerName, email: customerEmail, tradingProduct: "both", fundAmount: null }),
      }).catch(() => {});
    }

    return new Response(
      JSON.stringify({
        success: true,
        submissionId: submissionId,
        message: "Payment verified successfully",
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
// redeploy
