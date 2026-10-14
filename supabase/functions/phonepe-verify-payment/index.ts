import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { createHash } from "node:crypto";

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

    const body = await req.json();
    const { merchantTxnId, dbOrderId, customerName, customerEmail, customerPhone, customerState, planName, planId, targetUserId, adminEmail, billingCycle } = body;

    if (!merchantTxnId) {
      // PhonePe callback/server-to-server mode: extract from callback payload
      const callbackData = body;
      if (callbackData?.response) {
        // This is a PhonePe server callback
        const decoded = atob(callbackData.response);
        const parsed = JSON.parse(decoded);
        if (parsed.code === "PAYMENT_SUCCESS" && parsed.data?.merchantTransactionId) {
          return await verifyByMerchantTxnId(supabase, supabaseUrl, parsed.data.merchantTransactionId, parsed.data.transactionId);
        }
      }
      return new Response(
        JSON.stringify({ error: "Missing merchantTxnId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Frontend verification flow — verify the payment status with PhonePe
    return await verifyByMerchantTxnId(supabase, supabaseUrl, merchantTxnId, null, {
      dbOrderId, customerName, customerEmail, customerPhone, customerState, planName, planId, targetUserId, adminEmail, billingCycle
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function verifyByMerchantTxnId(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  merchantTxnId: string,
  phonepeTxnId: string | null,
  frontendData?: {
    dbOrderId?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    customerState?: string;
    planName?: string;
    planId?: string;
    targetUserId?: string;
    adminEmail?: string;
    billingCycle?: string;
  }
) {
  // Fetch PhonePe settings
  const { data: paymentSettings, error: settingsError } = await supabase
    .from("platform_payment_settings")
    .select("phonepe_merchant_id, phonepe_salt_key, phonepe_salt_index, phonepe_environment")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (settingsError || !paymentSettings || !paymentSettings.phonepe_merchant_id || !paymentSettings.phonepe_salt_key) {
    return new Response(
      JSON.stringify({ error: "PhonePe gateway not configured" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const merchantId = paymentSettings.phonepe_merchant_id;
  const saltKey = paymentSettings.phonepe_salt_key;
  const saltIndex = paymentSettings.phonepe_salt_index || "1";
  const environment = paymentSettings.phonepe_environment || "production";

  const phonepeApiBase = environment === "sandbox"
    ? "https://api-preprod.phonepe.com/apis/pg-sandbox"
    : "https://api.phonepe.com/apis/hermes";

  // Generate checksum for status check: SHA256("/pg/v1/status/" + merchantId + "/" + merchantTxnId + saltKey) + "###" + saltIndex
  const statusPath = `/pg/v1/status/${merchantId}/${merchantTxnId}`;
  const checksumString = statusPath + saltKey;
  const checksum = createHash("sha256").update(checksumString).digest("hex") + "###" + saltIndex;

  // Call PhonePe status API
  const statusResponse = await fetch(`${phonepeApiBase}${statusPath}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-VERIFY": checksum,
      "X-MERCHANT-ID": merchantId,
      accept: "application/json",
    },
  });

  const statusResult = await statusResponse.json();

  if (!statusResponse.ok) {
    return new Response(
      JSON.stringify({ error: statusResult.message || "Failed to verify payment with PhonePe" }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const paymentStatus = statusResult.code;
  const transactionId = phonepeTxnId || statusResult.data?.transactionId || null;

  if (paymentStatus === "PAYMENT_SUCCESS") {
    // Update order as paid
    const { error: updateError } = await supabase
      .from("payment_orders")
      .update({
        phonepe_txn_id: transactionId,
        status: "paid",
        updated_at: new Date().toISOString(),
      })
      .eq("phonepe_merchant_txn_id", merchantTxnId);

    if (updateError) {
      console.error("Failed to update order:", updateError.message);
    }

    // If admin-assisted checkout, activate subscription
    if (frontendData?.targetUserId && frontendData?.planId) {
      const now = new Date().toISOString();
      const periodEnd = new Date();
      periodEnd.setDate(periodEnd.getDate() + (frontendData.billingCycle === "annual" ? 365 : 30));

      const { data: existingSub } = await supabase
        .from("account_subscriptions")
        .select("id")
        .eq("user_id", frontendData.targetUserId)
        .maybeSingle();

      if (existingSub) {
        await supabase
          .from("account_subscriptions")
          .update({ plan_id: frontendData.planId, billing_cycle: frontendData.billingCycle || "monthly", status: "active", current_period_start: now, current_period_end: periodEnd.toISOString(), updated_at: now })
          .eq("id", existingSub.id);
      } else {
        await supabase
          .from("account_subscriptions")
          .insert({ user_id: frontendData.targetUserId, plan_id: frontendData.planId, billing_cycle: frontendData.billingCycle || "monthly", status: "active", current_period_start: now, current_period_end: periodEnd.toISOString() });
      }

      if (frontendData.adminEmail) {
        await supabase.from("admin_audit_log").insert({
          admin_id: "00000000-0000-0000-0000-000000000000",
          admin_email: frontendData.adminEmail,
          action_type: "admin_assisted_checkout",
          target_user_id: frontendData.targetUserId,
          target_email: frontendData.customerEmail || null,
          details: { plan_id: frontendData.planId, plan_name: frontendData.planName, billing_cycle: frontendData.billingCycle || "monthly", amount: "paid via phonepe" },
        });
      }

      return new Response(
        JSON.stringify({ success: true, message: "Payment verified and subscription activated", targetUserId: frontendData.targetUserId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Normal checkout: create a lead/submission
    let submissionId: string | null = null;
    const { data: ownerId } = await supabase.rpc("get_platform_owner_id");

    const { data: leadData, error: leadError } = await supabase.from("submissions").insert({
      full_name: frontendData?.customerName,
      mobile_number: frontendData?.customerPhone,
      email: frontendData?.customerEmail,
      state: frontendData?.customerState || null,
      trading_product: "both",
      user_id: ownerId ?? null,
      status: "converted",
    }).select("id").single();

    if (leadError) {
      console.error("Failed to create lead:", leadError.message);
    } else if (leadData) {
      submissionId = leadData.id;
      await supabase.from("payment_orders").update({ submission_id: submissionId }).eq("phonepe_merchant_txn_id", merchantTxnId);
    }

    if (submissionId) {
      fetch(`${supabaseUrl}/functions/v1/send-welcome-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: submissionId, fullName: frontendData?.customerName, email: frontendData?.customerEmail, tradingProduct: "both", fundAmount: null }),
      }).catch(() => {});
    }

    return new Response(
      JSON.stringify({ success: true, submissionId, message: "Payment verified successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } else if (paymentStatus === "PAYMENT_PENDING" || paymentStatus === "PAYMENT_ERROR") {
    // Mark order as failed
    await supabase.from("payment_orders")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("phonepe_merchant_txn_id", merchantTxnId);

    return new Response(
      JSON.stringify({ error: statusResult.message || "Payment was not completed" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } else {
    return new Response(
      JSON.stringify({ error: "Payment status unknown", code: paymentStatus }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}
