import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { connection_id, event, lead_data } = await req.json();

    if (!connection_id || !event) {
      return new Response(JSON.stringify({ error: "Missing connection_id or event" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: conn, error: connErr } = await supabase
      .from("google_sheets_connections")
      .select("*")
      .eq("id", connection_id)
      .maybeSingle();

    if (connErr || !conn) {
      return new Response(JSON.stringify({ error: "Connection not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!conn.is_active) {
      return new Response(JSON.stringify({ skipped: true, reason: "inactive" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!conn.events.includes(event)) {
      return new Response(JSON.stringify({ skipped: true, reason: "event_not_subscribed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create sync log entry
    const { data: logEntry, error: logErr } = await supabase
      .from("google_sheets_sync_log")
      .insert({
        connection_id: conn.id,
        user_id: conn.user_id,
        event,
        lead_id: lead_data?.id || null,
        lead_data: lead_data || {},
        status: "pending",
      })
      .select()
      .single();

    if (logErr || !logEntry) {
      return new Response(JSON.stringify({ error: "Failed to create sync log" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build payload for the Apps Script web app
    const payload = {
      event,
      timestamp: new Date().toISOString(),
      sheetName: conn.sheet_name,
      columnMapping: conn.column_mapping,
      lead: lead_data || {},
    };

    try {
      const resp = await fetch(conn.script_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });

      const respText = await resp.text();
      const isOk = resp.ok;

      await supabase.from("google_sheets_sync_log").update({
        status: isOk ? "synced" : "failed",
        error_message: isOk ? null : `HTTP ${resp.status}: ${respText.slice(0, 500)}`,
      }).eq("id", logEntry.id);

      await supabase.from("google_sheets_connections").update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: isOk ? "synced" : "failed",
        last_sync_error: isOk ? null : `HTTP ${resp.status}`,
      }).eq("id", conn.id);

      return new Response(JSON.stringify({ success: isOk, log_id: logEntry.id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (fetchErr) {
      await supabase.from("google_sheets_sync_log").update({
        status: "failed",
        error_message: String((fetchErr as Error).message || fetchErr).slice(0, 500),
      }).eq("id", logEntry.id);

      await supabase.from("google_sheets_connections").update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: "failed",
        last_sync_error: String((fetchErr as Error).message || fetchErr).slice(0, 200),
      }).eq("id", conn.id);

      return new Response(JSON.stringify({ success: false, error: String((fetchErr as Error).message || fetchErr) }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: String((err as Error).message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
