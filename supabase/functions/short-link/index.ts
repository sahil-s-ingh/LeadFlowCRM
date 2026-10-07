import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function generateShortCode(len: number = 6): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < len; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/short-link/, "").replace(/^\//, "");

    // GET /short-link?code=abc123 → redirect to original URL
    if (req.method === "GET" && path) {
      const { data, error } = await supabase
        .from("short_links")
        .select("original_url, expires_at")
        .eq("short_code", path)
        .maybeSingle();

      if (error || !data) {
        return new Response(JSON.stringify({ error: "Short link not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
        return new Response(JSON.stringify({ error: "Short link has expired" }), {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Increment click counter
      await supabase.rpc("increment_clicks", { link_code: path }).then(() => {});

      return Response.redirect(data.original_url, 302);
    }

    // POST /short-link → create a new short link
    if (req.method === "POST") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );

      const { data: userData, error: userError } = await userClient.auth.getUser();
      if (userError || !userData.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const { originalUrl, phoneNumber, message } = body;

      if (!originalUrl) {
        return new Response(JSON.stringify({ error: "originalUrl is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate unique short code
      let shortCode = "";
      let attempts = 0;
      while (attempts < 10) {
        shortCode = generateShortCode(6);
        const { data: existing } = await supabase
          .from("short_links")
          .select("id")
          .eq("short_code", shortCode)
          .maybeSingle();
        if (!existing) break;
        attempts++;
      }

      if (!shortCode) {
        return new Response(JSON.stringify({ error: "Failed to generate unique code" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: insertData, error: insertError } = await supabase
        .from("short_links")
        .insert({
          short_code: shortCode,
          original_url: originalUrl,
          phone_number: phoneNumber || null,
          message: message || null,
          user_id: userData.user.id,
        })
        .select("short_code, created_at")
        .single();

      if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        shortCode: insertData.short_code,
        shortUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/short-link/${insertData.short_code}`,
        createdAt: insertData.created_at,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
