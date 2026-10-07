import { createClient } from "npm:@supabase/supabase-js@2";

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
    const to = url.searchParams.get("to") || "";

    if (!to) {
      return new Response("<Response><Hangup/></Response>", {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      });
    }

    // Plivo XML to dial the lead's number
    const xml = `<Response><Dial><Number>${to}</Number></Dial></Response>`;

    return new Response(xml, {
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  } catch (err) {
    return new Response("<Response><Hangup/></Response>", {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  }
});
