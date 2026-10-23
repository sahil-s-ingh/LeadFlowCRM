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

interface KnowledgeEntry {
  title: string;
  category: string;
  content: string;
  keywords: string[];
  priority: number;
  language: string;
}

interface LogData {
  user_id: string;
  platform: string;
  conversation_id: string;
  incoming_text: string;
  reply_text: string;
  used_kb: boolean;
  kb_entry_titles: string[];
  language: string | null;
  sentiment: string | null;
  confidence: string | null;
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

// Smart keyword matching: only inject KB entries whose keywords match the incoming message
function filterRelevantEntries(entries: KnowledgeEntry[], message: string): KnowledgeEntry[] {
  const msgLower = message.toLowerCase();
  const matched = entries.filter((e) => {
    if (e.keywords.length === 0) return true;
    return e.keywords.some((kw) => msgLower.includes(kw.toLowerCase()));
  });
  // If nothing matched, return all entries (let the AI decide)
  if (matched.length === 0) return entries;
  // Sort by priority descending
  return matched.sort((a, b) => b.priority - a.priority);
}

function buildKnowledgeContext(entries: KnowledgeEntry[]): string {
  if (!entries.length) return "";
  const sections = entries.map((e) => {
    const kw = e.keywords.length > 0 ? `\nKeywords: ${e.keywords.join(", ")}` : "";
    return `### ${e.title} (${e.category})\n${e.content}${kw}`;
  });
  return "\n\n--- KNOWLEDGE BASE ---\nUse the following product and service information to answer customer questions. When a customer asks about something covered here, provide detailed, accurate answers based on this knowledge. If asked about something NOT covered, say you will have a team member follow up.\n\n" + sections.join("\n\n") + "\n--- END KNOWLEDGE BASE ---";
}

function buildSystemPrompt(basePrompt: string, knowledgeContext: string): string {
  const multiLangInstruction = "\n\nIMPORTANT RULES:\n1. Detect the language the customer is writing in and REPLY IN THE SAME LANGUAGE. If they write in Hindi, reply in Hindi. If English, reply in English.\n2. When answering questions about products, services, pricing, or features, ALWAYS use the knowledge base information above. Provide specific details, not generic responses.\n3. If a customer asks about something covered in the knowledge base, give a complete, detailed answer. Be enthusiastic and helpful when describing features.\n4. If the customer seems frustrated or upset, be extra empathetic and offer to connect them with a human agent.\n5. If you do NOT have relevant information in the knowledge base to answer the question, say that you will have a team member follow up — do not make up information.";

  if (!knowledgeContext) {
    return (basePrompt || "You are a helpful customer support assistant.") + multiLangInstruction;
  }
  const enhanced = basePrompt
    ? `${basePrompt}\n${knowledgeContext}`
    : `You are a helpful customer support assistant.${knowledgeContext}`;
  return enhanced + multiLangInstruction;
}

async function generateAIReply(config: AIConfig, conversation: ChatMessage[], knowledgeContext: string): Promise<string> {
  const fullSystemPrompt = buildSystemPrompt(config.system_prompt || "", knowledgeContext);
  const messages: ChatMessage[] = [];
  if (fullSystemPrompt) messages.push({ role: "system", content: fullSystemPrompt });
  messages.push(...conversation);

  switch (config.provider) {
    case "openai":
      return await callOpenAI(config.api_key, config.model, messages, config.temperature, config.max_tokens);
    case "gemini":
      return await callGemini(config.api_key, config.model, fullSystemPrompt, conversation, config.temperature, config.max_tokens);
    case "claude":
      return await callClaude(config.api_key, config.model, fullSystemPrompt, conversation, config.temperature, config.max_tokens);
    case "mistral":
      return await callMistral(config.api_key, config.model, messages, config.temperature, config.max_tokens);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

// Simple sentiment detection based on keywords
function detectSentiment(text: string): string {
  const lower = text.toLowerCase();
  const negative = ["angry", "frustrated", "upset", "terrible", "worst", "hate", "disappointed", "scam", "fraud", "cheat", "refund", "problem", "issue", "broken", "not working", "bad", "poor", "unhappy", "complain"];
  const positive = ["great", "awesome", "love", "amazing", "excellent", "good", "happy", "satisfied", "perfect", "fantastic", "wonderful", "thanks", "thank you"];
  if (negative.some((w) => lower.includes(w))) return "negative";
  if (positive.some((w) => lower.includes(w))) return "positive";
  return "neutral";
}

// Simple language detection based on character sets
function detectLanguage(text: string): string {
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  if (/[\u0400-\u04FF]/.test(text)) return "ru";
  if (/[\u4e00-\u9fff]/.test(text)) return "zh";
  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  return "en";
}

async function logReply(supabase: ReturnType<typeof createClient>, data: LogData) {
  try {
    await supabase.from("ai_reply_logs").insert({
      user_id: data.user_id,
      platform: data.platform,
      conversation_id: data.conversation_id,
      incoming_text: data.incoming_text,
      reply_text: data.reply_text,
      used_kb: data.used_kb,
      kb_entry_titles: data.kb_entry_titles,
      language: data.language,
      sentiment: data.sentiment,
      confidence: data.confidence,
    });
  } catch (e) {
    console.error("Failed to log reply:", e instanceof Error ? e.message : "unknown");
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
    const { user_id, platform, conversation_id, incoming_text, test_mode } = body as {
      user_id: string;
      platform: "whatsapp" | "telegram" | "test";
      conversation_id: string;
      incoming_text: string;
      test_mode?: boolean;
    };

    if (!user_id || !incoming_text) {
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

    // In test mode, skip active/channel checks
    if (!test_mode) {
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
    }

    if (!configRow.api_key || !configRow.model) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_api_key" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build conversation history (skip in test mode)
    let conversation: ChatMessage[] = [];
    if (!test_mode && conversation_id && platform !== "test") {
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

      conversation = (history || [])
        .filter((m: { sender: string; text_content: string | null }) => m.text_content)
        .map((m: { sender: string; text_content: string | null }) => ({
          role: m.sender === "client" ? "user" : "assistant",
          content: m.text_content as string,
        })) as ChatMessage[];
    }

    // Always include the incoming text in conversation
    conversation.push({ role: "user", content: incoming_text });

    // Fetch knowledge base entries
    const { data: kbRows } = await supabase
      .from("ai_knowledge_base")
      .select("title, category, content, keywords, priority, language")
      .eq("user_id", user_id)
      .eq("is_active", true)
      .order("priority", { ascending: false });

    // Filter out expired entries
    const now = new Date().toISOString();
    let allEntries: KnowledgeEntry[] = (kbRows || []) as KnowledgeEntry[];
    allEntries = allEntries.filter((e) => !e.expires_at || e.expires_at > now);

    // Smart matching: only inject relevant entries
    const relevantEntries = filterRelevantEntries(allEntries, incoming_text);
    const knowledgeContext = buildKnowledgeContext(relevantEntries);
    const usedKb = relevantEntries.length > 0;
    const kbTitles = relevantEntries.map((e) => e.title);

    const config: AIConfig = {
      provider: configRow.provider,
      api_key: configRow.api_key,
      model: configRow.model,
      system_prompt: configRow.system_prompt,
      temperature: configRow.temperature ?? 0.7,
      max_tokens: configRow.max_tokens ?? 500,
      fallback_message: configRow.fallback_message,
    };

    // Detect language and sentiment
    const detectedLang = detectLanguage(incoming_text);
    const detectedSentiment = detectSentiment(incoming_text);

    let reply: string;
    try {
      reply = await generateAIReply(config, conversation, knowledgeContext);
      reply = reply.trim();
      if (!reply) reply = config.fallback_message;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI generation failed";
      console.error("AI reply error:", msg);
      // Log the failure
      if (!test_mode) {
        await logReply(supabase, {
          user_id, platform: platform || "test", conversation_id: conversation_id || "",
          incoming_text, reply_text: config.fallback_message,
          used_kb: usedKb, kb_entry_titles: kbTitles,
          language: detectedLang, sentiment: detectedSentiment, confidence: "error",
        });
      }
      return new Response(JSON.stringify({ error: msg, fallback: config.fallback_message }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log the reply (skip in test mode)
    if (!test_mode) {
      await logReply(supabase, {
        user_id, platform: platform || "test", conversation_id: conversation_id || "",
        incoming_text, reply_text: reply,
        used_kb: usedKb, kb_entry_titles: kbTitles,
        language: detectedLang, sentiment: detectedSentiment, confidence: "normal",
      });
    }

    return new Response(JSON.stringify({
      reply,
      meta: {
        used_kb: usedKb,
        kb_entries: kbTitles,
        language: detectedLang,
        sentiment: detectedSentiment,
      },
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
