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

    // Verify the caller is authenticated — we need their user_id.
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { packageId } = await req.json();
    if (!packageId) {
      return new Response(JSON.stringify({ error: "Package ID is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Fetch the package
    const { data: pkg, error: pkgErr } = await adminClient
      .from("wa_credit_packages")
      .select("*")
      .eq("id", packageId)
      .eq("is_active", true)
      .maybeSingle();
    if (pkgErr || !pkg) {
      return new Response(JSON.stringify({ error: "Package not found or inactive" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch Razorpay keys
    const { data: paySettings, error: payErr } = await adminClient
      .from("platform_payment_settings")
      .select("razorpay_key_id, razorpay_key_secret, is_active, currency")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (payErr || !paySettings || !paySettings.razorpay_key_id || !paySettings.razorpay_key_secret) {
      return new Response(JSON.stringify({ error: "Payment gateway is not configured. Please contact support." }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const finalCurrency = pkg.currency || paySettings.currency || "INR";
    const amountInUnits = Math.round(Number(pkg.price) * 100);

    // Create Razorpay order
    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + btoa(paySettings.razorpay_key_id + ":" + paySettings.razorpay_key_secret),
      },
      body: JSON.stringify({
        amount: amountInUnits,
        currency: finalCurrency,
        receipt: "wa_cred_" + Date.now(),
        notes: {
          user_id: user.id,
          package_name: pkg.name,
          credits: String(pkg.credits),
        },
      }),
    });
    const rzpOrder = await rzpRes.json();
    if (!rzpRes.ok) {
      return new Response(JSON.stringify({ error: rzpOrder.error?.description || "Failed to create Razorpay order" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save order in our DB
    const { data: dbOrder, error: dbErr } = await adminClient
      .from("wa_credit_orders")
      .insert({
        razorpay_order_id: rzpOrder.id,
        user_id: user.id,
        package_id: pkg.id,
        package_name: pkg.name,
        credits: pkg.credits,
        amount: Number(pkg.price),
        currency: finalCurrency,
        status: "created",
      })
      .select("id")
      .single();
    if (dbErr) {
      console.error("Failed to save credit order:", dbErr.message);
    }

    return new Response(JSON.stringify({
      orderId: rzpOrder.id,
      amount: amountInUnits,
      currency: finalCurrency,
      keyId: paySettings.razorpay_key_id,
      dbOrderId: dbOrder?.id || null,
      packageName: pkg.name,
      credits: pkg.credits,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
