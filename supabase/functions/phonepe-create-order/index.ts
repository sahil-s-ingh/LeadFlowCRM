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

    const { planName, amount, currency, billingCycle, customerName, customerEmail, customerPhone, customerState, planId, targetUserId, adminEmail } = await req.json();

    if (!planName || !amount || !customerName || !customerEmail) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: planName, amount, customerName, customerEmail" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch PhonePe settings from platform_payment_settings
    const { data: paymentSettings, error: settingsError } = await supabase
      .from("platform_payment_settings")
      .select("phonepe_merchant_id, phonepe_salt_key, phonepe_salt_index, phonepe_environment, is_active, currency")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (settingsError || !paymentSettings || !paymentSettings.phonepe_merchant_id || !paymentSettings.phonepe_salt_key) {
      return new Response(
        JSON.stringify({ error: "PhonePe payment gateway is not configured. Please contact support." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const merchantId = paymentSettings.phonepe_merchant_id;
    const saltKey = paymentSettings.phonepe_salt_key;
    const saltIndex = paymentSettings.phonepe_salt_index || "1";
    const environment = paymentSettings.phonepe_environment || "production";
    const finalCurrency = currency || paymentSettings.currency || "INR";

    // PhonePe expects amount in paise (smallest currency unit)
    const amountInPaise = Math.round(Number(amount) * 100);

    // Generate unique merchant transaction ID
    const merchantTxnId = "MT" + Date.now() + Math.floor(Math.random() * 10000);

    // Determine the redirect URL (back to the site after payment)
    const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/$/, "") || "";
    const redirectUrl = origin ? `${origin}/?phonepe_redirect=1` : "";

    // Build the payment payload
    const paymentPayload = {
      merchantId: merchantId,
      merchantTransactionId: merchantTxnId,
      merchantUserId: customerEmail.replace(/[^a-zA-Z0-9]/g, "").slice(0, 36) || "MUID" + Date.now(),
      amount: amountInPaise,
      redirectUrl: redirectUrl,
      redirectMode: "REDIRECT",
      callbackUrl: `${supabaseUrl}/functions/v1/phonepe-verify-payment`,
      mobileNumber: customerPhone ? customerPhone.replace(/[^0-9]/g, "").slice(0, 12) : undefined,
      paymentInstrument: {
        type: "PAY_PAGE",
      },
    };

    // PhonePe API base URL
    const phonepeApiBase = environment === "sandbox"
      ? "https://api-preprod.phonepe.com/apis/pg-sandbox"
      : "https://api.phonepe.com/apis/hermes";

    // Encode payload as base64
    const payloadBase64 = btoa(JSON.stringify(paymentPayload));

    // Generate checksum: SHA256(base64Payload + "/pg/v1/pay" + saltKey) + "###" + saltIndex
    const checksumString = payloadBase64 + "/pg/v1/pay" + saltKey;
    const checksum = createHash("sha256").update(checksumString).digest("hex") + "###" + saltIndex;

    // Call PhonePe API to initiate payment
    const phonepeResponse = await fetch(`${phonepeApiBase}/pg/v1/pay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": checksum,
        "X-CALLBACK-URL": `${supabaseUrl}/functions/v1/phonepe-verify-payment`,
        accept: "application/json",
      },
      body: JSON.stringify({
        request: payloadBase64,
      }),
    });

    const phonepeResult = await phonepeResponse.json();

    if (!phonepeResponse.ok || phonepeResult.success !== true) {
      const errMsg = phonepeResult.message || phonepeResult.error?.message || "Failed to create PhonePe order";
      return new Response(
        JSON.stringify({ error: errMsg }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Save order in our database
    const { data: dbOrder, error: dbError } = await supabase
      .from("payment_orders")
      .insert({
        gateway: "phonepe",
        phonepe_merchant_txn_id: merchantTxnId,
        plan_id: planId || null,
        plan_name: planName,
        amount: Number(amount),
        currency: finalCurrency,
        billing_cycle: billingCycle || "monthly",
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        customer_state: customerState || null,
        status: "created",
      })
      .select("id")
      .single();

    if (dbError) {
      console.error("Failed to save order:", dbError.message);
    }

    const redirectPaymentUrl = phonepeResult.data?.instrumentResponse?.redirectInfo?.url;

    return new Response(
      JSON.stringify({
        merchantTxnId: merchantTxnId,
        paymentUrl: redirectPaymentUrl,
        dbOrderId: dbOrder?.id || null,
        amount: amountInPaise,
        currency: finalCurrency,
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
