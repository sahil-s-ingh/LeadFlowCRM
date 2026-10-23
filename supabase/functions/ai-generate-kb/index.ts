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
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { user_id, url } = await req.json() as { user_id: string; url: string };

    if (!user_id || !url) {
      return new Response(JSON.stringify({ error: "Missing user_id or url" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the user's AI config
    const { data: configRow } = await supabase
      .from("ai_reply_settings")
      .select("provider, api_key, model")
      .eq("user_id", user_id)
      .maybeSingle();

    if (!configRow?.api_key) {
      return new Response(JSON.stringify({ error: "No AI provider configured. Add your API key in AI Chatbot settings first." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the webpage content
    const pageRes = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KnowledgeBot/1.0)" },
      signal: AbortSignal.timeout(15000),
    });

    if (!pageRes.ok) {
      return new Response(JSON.stringify({ error: `Failed to fetch URL (${pageRes.status})` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = await pageRes.text();

    // Extract text content from HTML (strip tags, scripts, styles)
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();

    // Extract title from HTML
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const pageTitle = titleMatch ? titleMatch[1].trim() : new URL(url).hostname;

    // Truncate to ~6000 chars to fit in AI context
    const truncated = textContent.slice(0, 6000);

    if (truncated.length < 50) {
      return new Response(JSON.stringify({ error: "Could not extract enough content from the page. The site may require JavaScript to render." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use the user's AI provider to generate a knowledge entry
    const generatePrompt = `You are a knowledge base generator. Analyze the following webpage content and create a well-structured knowledge base entry that a customer support AI can use to answer questions about this product or service.

Page Title: ${pageTitle}
URL: ${url}

Content:
${truncated}

Generate a JSON object with these fields:
- "title": A concise title for the knowledge entry (e.g. "Premium TradingView Indicator")
- "category": One of: Product, Pricing, FAQ, How it works, Feature, Policy, Other
- "content": A detailed summary (300-800 words) covering what the product/service is, its key features, how it works, pricing if available, and any other relevant details a customer might ask about.
- "keywords": An array of 5-15 lowercase keywords/phrases that customers might use when asking about this topic.

Respond with ONLY the JSON object, no markdown, no explanation.`;

    let generatedJson: { title: string; category: string; content: string; keywords: string[] };

    try {
      const { provider, api_key, model } = configRow;
      let aiResponse = "";

      if (provider === "openai") {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${api_key}` },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: generatePrompt }],
            temperature: 0.3,
            max_tokens: 1500,
          }),
        });
        if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
        const data = await res.json();
        aiResponse = data.choices?.[0]?.message?.content || "";
      } else if (provider === "gemini") {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${api_key}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: generatePrompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 1500 },
          }),
        });
        if (!res.ok) throw new Error(`Gemini error ${res.status}`);
        const data = await res.json();
        aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      } else if (provider === "claude") {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": api_key, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model,
            max_tokens: 1500,
            temperature: 0.3,
            messages: [{ role: "user", content: generatePrompt }],
          }),
        });
        if (!res.ok) throw new Error(`Claude error ${res.status}`);
        const data = await res.json();
        aiResponse = data.content?.[0]?.text || "";
      } else {
        // Mistral
        const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${api_key}` },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: generatePrompt }],
            temperature: 0.3,
            max_tokens: 1500,
          }),
        });
        if (!res.ok) throw new Error(`Mistral error ${res.status}`);
        const data = await res.json();
        aiResponse = data.choices?.[0]?.message?.content || "";
      }

      // Parse JSON from AI response (strip markdown code fences if present)
      const cleaned = aiResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      generatedJson = JSON.parse(cleaned);

      // Validate
      if (!generatedJson.title || !generatedJson.content) {
        throw new Error("AI generated incomplete entry");
      }
      if (!Array.isArray(generatedJson.keywords)) generatedJson.keywords = [];
    } catch (aiErr) {
      const msg = aiErr instanceof Error ? aiErr.message : "AI generation failed";
      return new Response(JSON.stringify({ error: `AI failed to generate knowledge entry: ${msg}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ entry: generatedJson }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
