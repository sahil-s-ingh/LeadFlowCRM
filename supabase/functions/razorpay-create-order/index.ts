import { createClient } from "npm:@supabase/supabase-js@2.45.4";

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

    // Fetch Razorpay keys from platform_payment_settings
    const { data: paymentSettings, error: settingsError } = await supabase
      .from("platform_payment_settings")
      .select("razorpay_key_id, razorpay_key_secret, is_active, currency")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (settingsError || !paymentSettings || !paymentSettings.razorpay_key_id || !paymentSettings.razorpay_key_secret) {
      return new Response(
        JSON.stringify({ error: "Payment gateway is not configured. Please contact support." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const keyId = paymentSettings.razorpay_key_id;
    const keySecret = paymentSettings.razorpay_key_secret;
    const finalCurrency = currency || paymentSettings.currency || "INR";

    // Razorpay expects amount in paise (for INR) or smallest currency unit
    const amountInUnits = Math.round(Number(amount) * 100);

    // Create order on Razorpay
    const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + btoa(keyId + ":" + keySecret),
      },
      body: JSON.stringify({
        amount: amountInUnits,
        currency: finalCurrency,
        receipt: "rcpt_" + Date.now(),
        notes: {
          plan_name: planName,
          customer_email: customerEmail,
          billing_cycle: billingCycle || "monthly",
          target_user_id: targetUserId || "",
          admin_email: adminEmail || "",
        },
      }),
    });

    const razorpayOrder = await razorpayResponse.json();

    if (!razorpayResponse.ok) {
      return new Response(
        JSON.stringify({ error: razorpayOrder.error?.description || "Failed to create Razorpay order" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Save order in our database
    const { data: dbOrder, error: dbError } = await supabase
      .from("payment_orders")
      .insert({
        razorpay_order_id: razorpayOrder.id,
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

    // If admin checkout, link the order to the target user
    if (targetUserId && dbOrder?.id) {
      await supabase.from("payment_orders").update({ submission_id: null }).eq("id", dbOrder.id);
    }

    if (dbError) {
      console.error("Failed to save order:", dbError.message);
    }

    return new Response(
      JSON.stringify({
        orderId: razorpayOrder.id,
        amount: amountInUnits,
        currency: finalCurrency,
        keyId: keyId,
        dbOrderId: dbOrder?.id || null,
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
