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
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, dbOrderId } = await req.json();
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !dbOrderId) {
      return new Response(JSON.stringify({ error: "Missing verification fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch Razorpay secret
    const { data: paySettings, error: payErr } = await adminClient
      .from("platform_payment_settings")
      .select("razorpay_key_secret")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (payErr || !paySettings || !paySettings.razorpay_key_secret) {
      return new Response(JSON.stringify({ error: "Payment gateway not configured" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify signature
    const expectedSig = createHmac("sha256", paySettings.razorpay_key_secret)
      .update(razorpayOrderId + "|" + razorpayPaymentId)
      .digest("hex");
    if (expectedSig !== razorpaySignature) {
      await adminClient.from("wa_credit_orders").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", dbOrderId);
      return new Response(JSON.stringify({ error: "Payment verification failed. Signature mismatch." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update order with payment details
    await adminClient.from("wa_credit_orders").update({
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature,
      updated_at: new Date().toISOString(),
    }).eq("id", dbOrderId);

    // Credit the user's balance via the RPC function (idempotent)
    const { data: creditResult, error: creditErr } = await adminClient.rpc("purchase_wa_credits", {
      p_order_id: dbOrderId,
    });

    if (creditErr) {
      console.error("Failed to credit balance:", creditErr.message);
      return new Response(JSON.stringify({ error: "Payment verified but crediting failed. Please contact support." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      balance: creditResult?.balance ?? 0,
      message: "Credits added to your wallet",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
