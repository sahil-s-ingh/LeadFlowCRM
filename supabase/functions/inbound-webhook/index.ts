import { createClient } from "npm:@supabase/supabase-js@2";
// Inbound webhook — accepts lead data from external systems

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface InboundLead {
  full_name?: string;
  name?: string;
  mobile_number?: string;
  phone?: string;
  email?: string;
  state?: string;
  trading_product?: string;
  fund_amount?: number | string | null;
  notes?: string;
  tags?: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const apiKey = url.searchParams.get("key");

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing API key. Provide ?key=your_key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: keyRow, error: keyError } = await supabase
      .from("inbound_webhook_keys")
      .select("id, user_id, is_active, source_tag")
      .eq("api_key", apiKey)
      .eq("is_active", true)
      .maybeSingle();

    if (keyError || !keyRow) {
      return new Response(JSON.stringify({ error: "Invalid or inactive API key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lead: InboundLead = body;

    const fullName = (lead.full_name || lead.name || "").trim();
    const mobile = (lead.mobile_number || lead.phone || "").trim();
    const email = (lead.email || "").trim();
    const state = (lead.state || "").trim() || "N/A";
    const tradingProduct = lead.trading_product === "tradingview_premium" ? "tradingview_premium" : "algo";
    const fundAmount = lead.fund_amount != null ? parseFloat(String(lead.fund_amount)) || null : null;
    const tags = Array.isArray(lead.tags) ? lead.tags : [];
    if (keyRow.source_tag && !tags.includes(keyRow.source_tag)) {
      tags.push(keyRow.source_tag);
    }

    if (!fullName && !mobile && !email) {
      await supabase.from("inbound_webhook_logs").insert({
        api_key_id: keyRow.id,
        raw_payload: body,
        source: keyRow.source_tag || null,
        status: "failed",
        error_message: "No identifiable fields (name, phone, or email) provided",
      });
      return new Response(JSON.stringify({ error: "Provide at least a name, phone, or email" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let duplicateLeadId: string | null = null;
    if (email) {
      const { data: existing } = await supabase
        .from("submissions")
        .select("id")
        .ilike("email", email)
        .is("deleted_at", null)
        .maybeSingle();
      if (existing) duplicateLeadId = (existing as { id: string }).id;
    }
    if (!duplicateLeadId && mobile) {
      const { data: existing } = await supabase
        .from("submissions")
        .select("id")
        .eq("mobile_number", mobile)
        .is("deleted_at", null)
        .maybeSingle();
      if (existing) duplicateLeadId = (existing as { id: string }).id;
    }

    if (duplicateLeadId) {
      await supabase.from("inbound_webhook_logs").insert({
        api_key_id: keyRow.id,
        lead_id: duplicateLeadId,
        raw_payload: body,
        source: keyRow.source_tag || null,
        status: "duplicate",
        error_message: "Lead already exists with matching email or phone",
      });
      return new Response(JSON.stringify({
        status: "duplicate",
        message: "A lead with this email or phone already exists",
        lead_id: duplicateLeadId,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const insertPayload = {
      full_name: fullName || "Unknown",
      mobile_number: mobile || "N/A",
      email: email || "N/A",
      state,
      trading_product: tradingProduct,
      status: "new",
      tags,
      notes: lead.notes || "",
      fund_amount: fundAmount,
    };

    const { data: newLead, error: insertError } = await supabase
      .from("submissions")
      .insert(insertPayload)
      .select("id")
      .single();

    if (insertError || !newLead) {
      await supabase.from("inbound_webhook_logs").insert({
        api_key_id: keyRow.id,
        raw_payload: body,
        source: keyRow.source_tag || null,
        status: "failed",
        error_message: insertError?.message || "Insert failed",
      });
      return new Response(JSON.stringify({ error: "Failed to create lead", details: insertError?.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const leadId = (newLead as { id: string }).id;

    await supabase.from("inbound_webhook_logs").insert({
      api_key_id: keyRow.id,
      lead_id: leadId,
      raw_payload: body,
      source: keyRow.source_tag || null,
      status: "success",
    });

    return new Response(JSON.stringify({
      status: "success",
      message: "Lead created successfully",
      lead_id: leadId,
    }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
