import { createClient } from "npm:@supabase/supabase-js@2.45.4";

// Email tracking endpoint — open & click tracking (public, no JWT)
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
    const url = new URL(req.url);
    const logId = url.searchParams.get("id");
    const action = url.searchParams.get("action") || "open";
    const redirect = url.searchParams.get("redirect");

    if (!logId) {
      if (action === "click" && redirect) {
        return new Response(null, {
          status: 302,
          headers: { ...corsHeaders, Location: decodeURIComponent(redirect) },
        });
      }
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    if (action === "click") {
      const link = redirect ? decodeURIComponent(redirect) : null;

      const { data: existing } = await adminClient
        .from("email_log")
        .select("status, clicked_links")
        .eq("id", logId)
        .maybeSingle();

      if (existing) {
        const clickedLinks: string[] = Array.isArray(existing.clicked_links) ? existing.clicked_links : [];
        if (link && !clickedLinks.includes(link)) {
          clickedLinks.push(link);
        }

        const updates: Record<string, unknown> = {
          clicked_links: clickedLinks,
          clicked_at: new Date().toISOString(),
        };

        if (existing.status !== "clicked") {
          updates.status = "clicked";
        }

        await adminClient.from("email_log").update(updates).eq("id", logId);
      }

      if (redirect) {
        return new Response(null, {
          status: 302,
          headers: { ...corsHeaders, Location: decodeURIComponent(redirect) },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Open tracking (default)
    const { data: existing } = await adminClient
      .from("email_log")
      .select("status, opened_at")
      .eq("id", logId)
      .maybeSingle();

    if (existing && !existing.opened_at) {
      const updates: Record<string, unknown> = {
        opened_at: new Date().toISOString(),
      };
      if (existing.status === "sent" || existing.status === "delivered") {
        updates.status = "opened";
      }
      await adminClient.from("email_log").update(updates).eq("id", logId);

      // Fire automation trigger for email_opened
      const { data: logRow } = await adminClient
        .from("email_log")
        .select("lead_id, recipient_email")
        .eq("id", logId)
        .maybeSingle();
      if (logRow?.lead_id) {
        const { data: lead } = await adminClient
          .from("submissions")
          .select("*")
          .eq("id", logRow.lead_id)
          .maybeSingle();
        try {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/process-automations`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              trigger_type: "email_opened",
              lead_id: logRow.lead_id,
              lead_data: lead || {},
            }),
          });
        } catch { /* best effort */ }
      }
    }

    // Return 1x1 transparent GIF
    const gif = new Uint8Array([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00,
      0x80, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x21,
      0xF9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2C, 0x00, 0x00,
      0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
      0x01, 0x00, 0x3B,
    ]);

    return new Response(gif, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "image/gif",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

