import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Api-Key",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function hashKey(plain: string): Promise<string> {
  const data = new TextEncoder().encode(plain);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("X-Api-Key") || req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing API key" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { contacts } = body as { contacts: Array<Record<string, string>> };

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return new Response(JSON.stringify({ error: "Missing or empty 'contacts' array" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hashedKey = await hashKey(authHeader);
    const { data: apiKey, error: keyErr } = await supabase
      .from("google_sheets_api_keys")
      .select("id, user_id, is_active")
      .eq("key_hash", hashedKey)
      .maybeSingle();

    if (keyErr || !apiKey) {
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!apiKey.is_active) {
      return new Response(JSON.stringify({ error: "API key has been revoked" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("google_sheets_api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", apiKey.id);

    let imported = 0;
    let duplicates = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const contact of contacts) {
      const phone = (contact.phone || contact.mobile_number || contact["phone number"] || contact["Phone"] || "").trim();
      const name = (contact.name || contact.full_name || contact["Full Name"] || contact["Name"] || "").trim();
      const email = (contact.email || contact["Email"] || contact["email address"] || "").trim();

      if (!phone) {
        failed++;
        errors.push(`Row missing phone: ${JSON.stringify(contact).slice(0, 100)}`);
        continue;
      }

      const { data: existing } = await supabase
        .from("submissions")
        .select("id")
        .eq("user_id", apiKey.user_id)
        .eq("mobile_number", phone)
        .maybeSingle();

      if (existing) {
        duplicates++;
        continue;
      }

      const { error: insertErr } = await supabase.from("submissions").insert({
        user_id: apiKey.user_id,
        full_name: name,
        mobile_number: phone,
        email: email || null,
        status: "new",
        lead_source: "google_sheets",
      });

      if (insertErr) {
        failed++;
        errors.push(`Failed to import ${phone}: ${insertErr.message}`);
      } else {
        imported++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      imported,
      duplicates,
      failed,
      errors: errors.slice(0, 10),
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String((err as Error).message || err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
