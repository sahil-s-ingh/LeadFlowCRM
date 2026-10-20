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

    const body = await req.json();
    const { conversationId, amount, title, description, leadId, itemDescription } = body;

    if (!conversationId || !amount || !title) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: conversationId, amount, title" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const amountPaise = Math.round(Number(amount) * 100);
    if (amountPaise < 100) {
      return new Response(
        JSON.stringify({ error: "Amount must be at least ₹1.00" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify conversation ownership
    const { data: conversation, error: convError } = await adminSupabase
      .from("wa_conversations")
      .select("*")
      .eq("id", conversationId)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (convError || !conversation) {
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Resolve WhatsApp settings
    let settings: any = null;
    if (conversation.wa_settings_id) {
      const { data: s } = await adminSupabase
        .from("whatsapp_settings")
        .select("*")
        .eq("id", conversation.wa_settings_id)
        .maybeSingle();
      settings = s;
    }
    if (!settings) {
      const { data: s } = await adminSupabase
        .from("whatsapp_settings")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      settings = s;
    }
    if (!settings || !settings.phone_number_id || !settings.access_token) {
      return new Response(
        JSON.stringify({ error: "WhatsApp is not configured. Go to Settings to set it up." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch the active payment config for this user
    const { data: payConfig, error: cfgError } = await adminSupabase
      .from("wa_payment_config")
      .select("*")
      .eq("user_id", userData.user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cfgError || !payConfig) {
      return new Response(
        JSON.stringify({ error: "WhatsApp payment gateway is not linked yet. Go to WhatsApp Settings to add your payment configuration from WhatsApp Manager." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const to = conversation.wa_phone_number.replace(/^\+/, "");
    const referenceId = `WAP-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    // Build the order_details interactive payload (India PG flow, simplified)
    const orderItem = {
      name: title.slice(0, 200),
      quantity: 1,
      amount: { offset: 100, value: amountPaise },
    };

    const interactivePayload: Record<string, unknown> = {
      type: "order_details",
      reference_id: referenceId,
      payment_settings: [
        {
          payment_gateway_name: payConfig.payment_gateway_name,
          configuration_name: payConfig.configuration_name,
        },
      ],
      currency: "INR",
      total_amount: { offset: 100, value: amountPaise },
      type: "digital-goods",
      order: {
        status: "pending",
        subtotal: { offset: 100, value: amountPaise },
        tax: { offset: 100, value: 0 },
        discount: { offset: 100, value: 0 },
        shipping: { offset: 100, value: 0 },
        items: [orderItem],
      },
    };

    if (description) {
      interactivePayload.header = { type: "text", text: description.slice(0, 60) };
    }

    const sendBody = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive: interactivePayload,
    };

    const waRes = await fetch(`https://graph.facebook.com/v21.0/${settings.phone_number_id}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.access_token}`,
      },
      body: JSON.stringify(sendBody),
    });

    const waData = await waRes.json();

    if (waData.error) {
      const errMsg = waData.error.error_data?.details || waData.error.message || "Unknown";
      const errCode = waData.error.code;
      const friendlyMsg = errCode === 131037
        ? "Your WhatsApp Business number's display name has not been approved by Meta yet."
        : `WhatsApp API error: ${errMsg}`;
      return new Response(
        JSON.stringify({
          error: friendlyMsg,
          errorStep: "meta_send_order_details",
          metaError: errMsg,
          metaCode: errCode,
          metaErrorRaw: waData.error,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const waMessageId = waData.messages?.[0]?.id || null;

    // Save the payment order
    const { data: payOrder, error: orderError } = await adminSupabase
      .from("wa_payment_orders")
      .insert({
        user_id: userData.user.id,
        conversation_id: conversationId,
        lead_id: leadId || null,
        reference_id: referenceId,
        wa_settings_id: settings.id,
        amount_value: amountPaise,
        currency: "INR",
        title,
        status: "pending",
        gateway_name: payConfig.payment_gateway_name,
        meta_payload: sendBody,
      })
      .select("id")
      .single();

    if (orderError) {
      console.error("Failed to save payment order:", orderError.message);
    }

    // Save the message in the chat thread
    const previewText = `Payment Request: ${title} — ₹${(amountPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
    await adminSupabase.from("wa_messages").insert({
      conversation_id: conversationId,
      sender: "admin",
      message_type: "payment_request",
      text_content: previewText,
      wa_message_id: waMessageId,
      delivery_status: waMessageId ? "sent" : null,
    });

    await adminSupabase
      .from("wa_conversations")
      .update({ last_message_text: previewText.slice(0, 100), last_message_at: new Date().toISOString() })
      .eq("id", conversationId);

    return new Response(
      JSON.stringify({
        success: true,
        orderId: payOrder?.id || null,
        referenceId,
        waMessageId,
        amount: amountPaise,
        currency: "INR",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message, errorStep: "unexpected_exception" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

