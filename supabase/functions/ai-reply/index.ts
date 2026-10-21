import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AIConfig {
  provider: string;
  api_key: string;
  model: string;
  system_prompt: string | null;
  temperature: number;
  max_tokens: number;
  fallback_message: string;
}

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
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callGemini(apiKey: string, model: string, systemPrompt: string, conversation: ChatMessage[], temperature: number, maxTokens: number): Promise<string> {
  const contents = conversation.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const body: Record<string, unknown> = {
    contents,
    generationConfig: { temperature, maxOutputTokens: maxTokens },
  };
  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callClaude(apiKey: string, model: string, systemPrompt: string, conversation: ChatMessage[], temperature: number, maxTokens: number): Promise<string> {
  const messages = conversation.map((m) => ({ role: m.role, content: m.content }));
  const body: Record<string, unknown> = { model, max_tokens: maxTokens, temperature, messages };
  if (systemPrompt) body.system = systemPrompt;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

async function callMistral(apiKey: string, model: string, messages: ChatMessage[], temperature: number, maxTokens: number): Promise<string> {
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Mistral error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function generateAIReply(config: AIConfig, conversation: ChatMessage[]): Promise<string> {
  const messages: ChatMessage[] = [];
  if (config.system_prompt) messages.push({ role: "system", content: config.system_prompt });
  messages.push(...conversation);

  switch (config.provider) {
    case "openai":
      return await callOpenAI(config.api_key, config.model, messages, config.temperature, config.max_tokens);
    case "gemini":
      return await callGemini(config.api_key, config.model, config.system_prompt || "", conversation, config.temperature, config.max_tokens);
    case "claude":
      return await callClaude(config.api_key, config.model, config.system_prompt || "", conversation, config.temperature, config.max_tokens);
    case "mistral":
      return await callMistral(config.api_key, config.model, messages, config.temperature, config.max_tokens);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
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
    const { user_id, platform, conversation_id, incoming_text } = body as {
      user_id: string;
      platform: "whatsapp" | "telegram";
      conversation_id: string;
      incoming_text: string;
    };

    if (!user_id || !platform || !conversation_id || !incoming_text) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: configRow, error: configErr } = await supabase
      .from("ai_reply_settings")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    if (configErr || !configRow) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_config" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!configRow.is_active) {
      return new Response(JSON.stringify({ skipped: true, reason: "inactive" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (platform === "whatsapp" && !configRow.whatsapp_enabled) {
      return new Response(JSON.stringify({ skipped: true, reason: "whatsapp_disabled" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (platform === "telegram" && !configRow.telegram_enabled) {
      return new Response(JSON.stringify({ skipped: true, reason: "telegram_disabled" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!configRow.api_key || !configRow.model) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_api_key" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const table = platform === "whatsapp" ? "wa_conversations" : "chat_conversations";
    const { data: conv } = await supabase
      .from(table)
      .select("ai_paused")
      .eq("id", conversation_id)
      .maybeSingle();

    if (conv?.ai_paused) {
      return new Response(JSON.stringify({ skipped: true, reason: "ai_paused" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const msgTable = platform === "whatsapp" ? "wa_messages" : "chat_messages";
    const { data: history } = await supabase
      .from(msgTable)
      .select("sender, text_content")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: true })
      .limit(20);

    const conversation: ChatMessage[] = (history || [])
      .filter((m: { sender: string; text_content: string | null }) => m.text_content)
      .map((m: { sender: string; text_content: string | null }) => ({
        role: m.sender === "client" ? "user" : "assistant",
        content: m.text_content as string,
      })) as ChatMessage[];

    const config: AIConfig = {
      provider: configRow.provider,
      api_key: configRow.api_key,
      model: configRow.model,
      system_prompt: configRow.system_prompt,
      temperature: configRow.temperature ?? 0.7,
      max_tokens: configRow.max_tokens ?? 500,
      fallback_message: configRow.fallback_message,
    };

    let reply: string;
    try {
      reply = await generateAIReply(config, conversation);
      reply = reply.trim();
      if (!reply) reply = config.fallback_message;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI generation failed";
      console.error("AI reply error:", msg);
      return new Response(JSON.stringify({ error: msg, fallback: config.fallback_message }), {
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
