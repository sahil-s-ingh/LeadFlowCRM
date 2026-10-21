import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

async function callOpenAI(apiKey: string, model: string, messages: ChatMessage[], temperature: number, maxTokens: number): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callGemini(apiKey: string, model: string, systemPrompt: string, conversation: ChatMessage[], temperature: number, maxTokens: number): Promise<string> {
  const contents = conversation.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const body: Record<string, unknown> = { contents, generationConfig: { temperature, maxOutputTokens: maxTokens } };
  if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callClaude(apiKey: string, model: string, systemPrompt: string, conversation: ChatMessage[], temperature: number, maxTokens: number): Promise<string> {
  const messages = conversation.map((m) => ({ role: m.role, content: m.content }));
  const body: Record<string, unknown> = { model, max_tokens: maxTokens, temperature, messages };
  if (systemPrompt) body.system = systemPrompt;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Claude error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

async function callMistral(apiKey: string, model: string, messages: ChatMessage[], temperature: number, maxTokens: number): Promise<string> {
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
  });
  if (!res.ok) throw new Error(`Mistral error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function generateAIReply(provider: string, apiKey: string, model: string, systemPrompt: string, conversation: ChatMessage[], temperature: number, maxTokens: number): Promise<string> {
  const messages: ChatMessage[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push(...conversation);
  switch (provider) {
    case "openai": return await callOpenAI(apiKey, model, messages, temperature, maxTokens);
    case "gemini": return await callGemini(apiKey, model, systemPrompt, conversation, temperature, maxTokens);
    case "claude": return await callClaude(apiKey, model, systemPrompt, conversation, temperature, maxTokens);
    case "mistral": return await callMistral(apiKey, model, messages, temperature, maxTokens);
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}

async function gatherCRMContext(supabase: ReturnType<typeof createClient>, userId: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const parts: string[] = [];

  const { data: leads } = await supabase.from("submissions").select("id, full_name, mobile_number, email, status, fund_amount, created_at, lead_score, state, trading_product, assigned_to, lead_source").eq("user_id", userId).is("deleted_at", null).order("created_at", { ascending: false }).limit(200);
  parts.push(`=== LEADS (${leads?.length || 0} total, showing most recent 200) ===`);
  for (const l of leads || []) {
    parts.push(`- ${l.full_name} | phone: ${l.mobile_number || "N/A"} | email: ${l.email || "N/A"} | status: ${l.status || "new"} | score: ${l.lead_score ?? "N/A"} | state: ${l.state || "N/A"} | product: ${l.trading_product || "N/A"} | fund: ${l.fund_amount ?? "N/A"} | source: ${l.lead_source || "N/A"} | created: ${l.created_at?.slice(0,10)}`);
  }

  const { data: followups } = await supabase.from("lead_followups").select("id, title, note, reminder_at, status, lead_id").eq("user_id", userId).order("reminder_at", { ascending: true }).limit(100);
  const pendingFollowups = (followups || []).filter((f) => f.status === "pending");
  const overdue = pendingFollowups.filter((f) => f.reminder_at && f.reminder_at.slice(0, 10) <= today);
  parts.push(`\n=== FOLLOW-UPS (${pendingFollowups.length} pending, ${overdue.length} overdue/due today) ===`);
  for (const f of pendingFollowups.slice(0, 50)) {
    const leadName = leads?.find((l) => l.id === f.lead_id)?.full_name || "Unknown lead";
    parts.push(`- [${f.reminder_at?.slice(0, 16) || "N/A"}] ${f.title} (lead: ${leadName}) | status: ${f.status}${f.note ? ` | note: ${f.note}` : ""}`);
  }

  const { count: waConvCount } = await supabase.from("wa_conversations").select("id", { count: "exact", head: true }).eq("user_id", userId);
  const { data: waConvs } = await supabase.from("wa_conversations").select("id, customer_name, customer_phone, last_message_text, last_message_at, ai_paused").eq("user_id", userId).order("last_message_at", { ascending: false }).limit(20);
  parts.push(`\n=== WHATSAPP CONVERSATIONS (${waConvCount || 0} total, showing recent 20) ===`);
  for (const c of waConvs || []) {
    parts.push(`- ${c.customer_name || c.customer_phone || "Unknown"} | phone: ${c.customer_phone || "N/A"} | last msg: ${c.last_message_text?.slice(0, 80) || "N/A"} | at: ${c.last_message_at?.slice(0, 16) || "N/A"}${c.ai_paused ? " | [AI paused]" : ""}`);
  }

  const { data: tgConvs } = await supabase.from("chat_conversations").select("id, customer_name, customer_phone, last_message_text, last_message_at").eq("user_id", userId).order("last_message_at", { ascending: false }).limit(10);
  if (tgConvs && tgConvs.length > 0) {
    parts.push(`\n=== TELEGRAM CONVERSATIONS (showing recent 10) ===`);
    for (const c of tgConvs) {
      parts.push(`- ${c.customer_name || c.customer_phone || "Unknown"} | last msg: ${c.last_message_text?.slice(0, 80) || "N/A"} | at: ${c.last_message_at?.slice(0, 16) || "N/A"}`);
    }
  }

  const statusCounts: Record<string, number> = {};
  for (const l of leads || []) { const s = l.status || "new"; statusCounts[s] = (statusCounts[s] || 0) + 1; }
  parts.push(`\n=== LEAD STATUS BREAKDOWN ===`);
  for (const [status, count] of Object.entries(statusCounts)) { parts.push(`- ${status}: ${count}`); }

  return parts.join("\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { user_id, question, history } = body as {
      user_id: string;
      question: string;
      history?: ChatMessage[];
    };

    if (!user_id || !question) {
      return new Response(JSON.stringify({ error: "Missing user_id or question" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: config, error: configErr } = await supabase
      .from("ai_assistant_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (configErr || !config) {
      return new Response(JSON.stringify({ error: "AI assistant is not configured. Please ask the super admin to configure it." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!config.is_active) {
      return new Response(JSON.stringify({ error: "AI assistant is currently disabled." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!config.api_key || !config.model) {
      return new Response(JSON.stringify({ error: "AI assistant is not fully configured. The API key or model is missing." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const crmContext = await gatherCRMContext(supabase, user_id);

    const systemPrompt = `${config.system_prompt || "You are Jarvis, an AI assistant for a trading CRM."}\n\nBelow is the current CRM data for the logged-in user. Use this to answer their questions accurately. All numbers and names come from real data — do not make up information.\n\n${crmContext}`;

    const conversation: ChatMessage[] = (history || []).slice(-10);
    conversation.push({ role: "user", content: question });

    let reply: string;
    try {
      reply = await generateAIReply(
        config.provider, config.api_key, config.model,
        systemPrompt, conversation,
        Number(config.temperature) || 0.7, Number(config.max_tokens) || 800,
      );
      reply = reply.trim();
      if (!reply) reply = "I could not generate a response. Please try rephrasing your question.";
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI generation failed";
      console.error("Jarvis AI error:", msg);
      return new Response(JSON.stringify({ error: `AI service error: ${msg}` }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ reply }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
