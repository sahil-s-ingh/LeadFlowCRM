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

    // Fetch PayPal settings from platform_payment_settings
    const { data: paymentSettings, error: settingsError } = await supabase
      .from("platform_payment_settings")
      .select("paypal_client_id, paypal_client_secret, paypal_environment, is_active, currency")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (settingsError || !paymentSettings || !paymentSettings.paypal_client_id || !paymentSettings.paypal_client_secret) {
      return new Response(
        JSON.stringify({ error: "PayPal payment gateway is not configured. Please contact support." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const clientId = paymentSettings.paypal_client_id;
    const clientSecret = paymentSettings.paypal_client_secret;
    const environment = paymentSettings.paypal_environment || "production";
    const finalCurrency = (currency || paymentSettings.currency || "USD").toUpperCase();

    const paypalApiBase = environment === "sandbox"
      ? "https://api-m.sandbox.paypal.com"
      : "https://api-m.paypal.com";

    // Step 1: Get OAuth access token from PayPal
    const tokenResponse = await fetch(`${paypalApiBase}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(clientId + ":" + clientSecret),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      return new Response(
        JSON.stringify({ error: "Failed to authenticate with PayPal. Check your API credentials." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const accessToken = tokenData.access_token;

    // Determine the return URL (where PayPal redirects after approval)
    const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/$/, "") || "";
    const returnUrl = origin ? `${origin}/?paypal_redirect=1` : "";
    const cancelUrl = origin ? `${origin}/?paypal_cancel=1` : "";

    // Step 2: Create order with PayPal Orders API v2
    const orderPayload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: "plan_" + Date.now(),
          description: `${planName} — ${billingCycle || "monthly"}`,
          amount: {
            currency_code: finalCurrency,
            value: Number(amount).toFixed(2),
          },
          payee: {
            email_address: undefined,
          },
        },
      ],
      application_context: {
        brand_name: "LeadFlow CRM",
        user_action: "PAY_NOW",
        shipping_preference: "NO_SHIPPING",
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    };

    // Remove undefined fields
    delete (orderPayload.purchase_units[0] as any).payee;

    const orderResponse = await fetch(`${paypalApiBase}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify(orderPayload),
    });

    const orderData = await orderResponse.json();

    if (!orderResponse.ok) {
      const errMsg = orderData.message || orderData.error?.description || "Failed to create PayPal order";
      return new Response(
        JSON.stringify({ error: errMsg }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Find the approval URL from PayPal's links
    const approveLink = orderData.links?.find((link: any) => link.rel === "approve")?.href;

    if (!approveLink) {
      return new Response(
        JSON.stringify({ error: "PayPal did not return an approval URL." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Save order in our database
    const { data: dbOrder, error: dbError } = await supabase
      .from("payment_orders")
      .insert({
        gateway: "paypal",
        paypal_order_id: orderData.id,
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

    return new Response(
      JSON.stringify({
        paypalOrderId: orderData.id,
        approvalUrl: approveLink,
        dbOrderId: dbOrder?.id || null,
        amount: Number(amount).toFixed(2),
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
