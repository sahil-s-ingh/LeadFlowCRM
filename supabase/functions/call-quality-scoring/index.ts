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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { action, call_session_id, call_log_id, user_id } = await req.json();

    if (action === "score_call") {
      return await scoreCall(supabase, { call_session_id, call_log_id, user_id });
    }

    if (action === "list_scores") {
      return await listScores(supabase, user_id);
    }

    if (action === "get_score") {
      return await getScore(supabase, req.json());
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function scoreCall(supabase: ReturnType<typeof createClient>, params: { call_session_id?: string; call_log_id?: string; user_id: string }) {
  const { call_session_id, call_log_id, user_id } = params;

  // Get the user's call quality settings
  const { data: qualitySettings } = await supabase
    .from("call_quality_settings")
    .select("*")
    .eq("user_id", user_id)
    .maybeSingle();

  if (!qualitySettings || !qualitySettings.enabled) {
    return new Response(
      JSON.stringify({ error: "Call quality scoring is not enabled" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Fetch the call recording/transcript
  let transcript = "";
  let callDuration = 0;
  let leadPhone = "";
  let agentEmail = "";

  if (call_session_id) {
    const { data: session } = await supabase
      .from("wa_call_sessions")
      .select("*")
      .eq("id", call_session_id)
      .maybeSingle();

    if (!session) {
      return new Response(
        JSON.stringify({ error: "Call session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    callDuration = session.call_duration || 0;
    leadPhone = session.phone_number || "";

    // Get the recording/transcript
    const { data: recording } = await supabase
      .from("wa_call_recordings")
      .select("*")
      .eq("call_session_id", call_session_id)
      .eq("type", "transcript")
      .maybeSingle();

    if (recording?.transcript_json) {
      const segments = recording.transcript_json as Array<{ text: string; speaker?: string }>;
      transcript = segments.map((s) => `${s.speaker || "Speaker"}: ${s.text}`).join("\n");
    } else if (recording?.text) {
      transcript = recording.text;
    }
  } else if (call_log_id) {
    const { data: callLog } = await supabase
      .from("call_logs")
      .select("*")
      .eq("id", call_log_id)
      .maybeSingle();

    if (!callLog) {
      return new Response(
        JSON.stringify({ error: "Call log not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    callDuration = callLog.duration || 0;
    leadPhone = callLog.to_number || "";
  }

  // Check minimum call duration
  if (callDuration < qualitySettings.min_call_duration_sec) {
    return new Response(
      JSON.stringify({ error: `Call too short (minimum ${qualitySettings.min_call_duration_sec}s)` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Get agent email
  const { data: userInfo } = await supabase.auth.admin.getUserById(user_id);
  agentEmail = userInfo?.user?.email || "";

  // Generate quality scores using heuristic analysis of the transcript
  const analysis = analyzeTranscript(transcript, callDuration);

  // Calculate weighted overall score
  const weights = {
    script: qualitySettings.script_weight || 30,
    objection: qualitySettings.objection_weight || 25,
    tone: qualitySettings.tone_weight || 25,
    pacing: qualitySettings.pacing_weight || 20,
  };
  const totalWeight = weights.script + weights.objection + weights.tone + weights.pacing;
  const overallScore = Math.round(
    (analysis.scriptAdherence * weights.script +
      analysis.objectionHandling * weights.objection +
      analysis.tone * weights.tone +
      analysis.pacing * weights.pacing) / totalWeight
  );

  // Save the score
  const { data: scoreRecord, error: insertError } = await supabase
    .from("call_quality_scores")
    .insert({
      user_id,
      call_session_id: call_session_id || null,
      call_log_id: call_log_id || null,
      lead_phone: leadPhone,
      agent_email: agentEmail,
      call_duration_sec: callDuration,
      overall_score: overallScore,
      script_adherence_score: analysis.scriptAdherence,
      objection_handling_score: analysis.objectionHandling,
      tone_score: analysis.tone,
      pacing_score: analysis.pacing,
      feedback_summary: analysis.feedback,
      key_moments: JSON.stringify(analysis.keyMoments),
      red_flags: JSON.stringify(analysis.redFlags),
      transcript_snippet: transcript.slice(0, 500),
    })
    .select("id")
    .single();

  if (insertError) {
    return new Response(
      JSON.stringify({ error: insertError.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      score_id: scoreRecord.id,
      overall_score: overallScore,
      script_adherence: analysis.scriptAdherence,
      objection_handling: analysis.objectionHandling,
      tone: analysis.tone,
      pacing: analysis.pacing,
      feedback: analysis.feedback,
      key_moments: analysis.keyMoments,
      red_flags: analysis.redFlags,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

async function listScores(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await supabase
    .from("call_quality_scores")
    .select("*")
    .eq("user_id", userId)
    .order("scored_at", { ascending: false })
    .limit(50);

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ success: true, scores: data || [] }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

async function getScore(supabase: ReturnType<typeof createClient>, bodyPromise: Promise<any>) {
  const body = await bodyPromise;
  const { score_id } = body;
  const { data, error } = await supabase
    .from("call_quality_scores")
    .select("*")
    .eq("id", score_id)
    .maybeSingle();

  if (error || !data) {
    return new Response(
      JSON.stringify({ error: "Score not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ success: true, score: data }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

// Heuristic transcript analysis — scores calls based on conversation patterns
interface CallAnalysis {
  scriptAdherence: number;
  objectionHandling: number;
  tone: number;
  pacing: number;
  feedback: string;
  keyMoments: Array<{ time: string; event: string; type: "positive" | "negative" | "neutral" }>;
  redFlags: string[];
}

function analyzeTranscript(transcript: string, durationSec: number): CallAnalysis {
  const text = transcript.toLowerCase();
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const lines = transcript.split("\n").filter(Boolean);

  // Script adherence: checks for key sales conversation elements
  const scriptElements = [
    { pattern: /\b(hello|hi|hey|good (morning|afternoon|evening))\b/, label: "Greeting" },
    { pattern: /\b(my name is|i'm|i am)\b/, label: "Introduction" },
    { pattern: /\b(how are you|how's it going|hope you're doing well)\b/, label: "Rapport building" },
    { pattern: /\b(i wanted to (talk|discuss|share)|calling (about|regarding)|reason (for|i'm) (my )?call)\b/, label: "Purpose statement" },
    { pattern: /\b(what do you think|does that (make sense|sound good)|how does that sound|any questions)\b/, label: "Checking in" },
    { pattern: /\b(next steps|shall we|i'll send|let me (send|share|schedule)|follow up)\b/, label: "Next steps" },
    { pattern: /\b(thank you|thanks|appreciate)\b/, label: "Closing" },
  ];

  let scriptHits = 0;
  const foundElements: string[] = [];
  for (const el of scriptElements) {
    if (el.pattern.test(text)) {
      scriptHits++;
      foundElements.push(el.label);
    }
  }
  const scriptAdherence = Math.min(100, Math.round((scriptHits / scriptElements.length) * 100));

  // Objection handling: detects objections and responses
  const objectionWords = /\b(too expensive|can't afford|not interested|not now|think about it|need to (think|talk)|already have|another (time|provider)|maybe later|don't have (time|money))\b/;
  const responseWords = /\b(i understand|i hear you|that's (a great|valid) (point|concern)|let me (explain|address)|what if|here's the thing|absolutely|makes sense)\b/;

  let objectionHandling = 60;
  const hasObjection = objectionWords.test(text);
  const hasResponse = responseWords.test(text);
  if (hasObjection && hasResponse) objectionHandling = 90;
  else if (hasResponse) objectionHandling = 75;
  else if (hasObjection) objectionHandling = 35;
  else objectionHandling = 65;

  // Tone: positive vs negative word ratio
  const positiveWords = (text.match(/\b(great|excellent|perfect|wonderful|happy|glad|excited|fantastic|love|amazing|absolutely|definitely|sure|of course)\b/g) || []).length;
  const negativeWords = (text.match(/\b(no|not|can't|won't|don't|never|unfortunately|sorry|problem|issue|wrong|bad|terrible)\b/g) || []).length;
  const toneRatio = positiveWords / (positiveWords + negativeWords + 1);
  const tone = Math.min(100, Math.round(toneRatio * 100 + 30));

  // Pacing: words per minute analysis
  const durationMin = durationSec / 60;
  const wpm = durationMin > 0 ? wordCount / durationMin : 0;
  let pacing = 70;
  if (wpm > 0 && wpm < 180) pacing = 90;
  else if (wpm >= 180 && wpm <= 220) pacing = 75;
  else if (wpm > 220) pacing = 50;
  else if (wpm === 0) pacing = 40;

  // Key moments
  const keyMoments: CallAnalysis["keyMoments"] = [];
  if (/\b(price|cost|fee|how much|pricing)\b/.test(text)) {
    keyMoments.push({ time: "mid-call", event: "Pricing discussion", type: "neutral" });
  }
  if (hasObjection) {
    keyMoments.push({ time: "mid-call", event: "Objection raised by lead", type: "negative" });
  }
  if (hasResponse) {
    keyMoments.push({ time: "mid-call", event: "Objection handled", type: "positive" });
  }
  if (/\b(yes|sign up|let's do it|go ahead|interested|proceed)\b/.test(text)) {
    keyMoments.push({ time: "late-call", event: "Positive buying signal", type: "positive" });
  }
  if (foundElements.length > 0) {
    keyMoments.push({ time: "opening", event: `Covered: ${foundElements.join(", ")}`, type: "positive" });
  }

  // Red flags
  const redFlags: string[] = [];
  if (durationSec < 30) redFlags.push("Very short call — may not have had meaningful conversation");
  if (negativeWords > positiveWords * 2) redFlags.push("Conversation had a negative tone overall");
  if (wpm > 250) redFlags.push("Speaking too fast — may overwhelm the lead");
  if (!/\b(next|follow up|call back|schedule|send)\b/.test(text)) redFlags.push("No clear next steps defined");
  if (scriptHits < 2) redFlags.push("Key conversation elements missing (greeting, purpose, closing)");

  // Feedback summary
  const parts: string[] = [];
  if (scriptAdherence >= 80) parts.push("Strong script adherence — covered the key conversation stages well.");
  else if (scriptAdherence >= 60) parts.push("Decent script structure but some key elements were missing.");
  else parts.push("Script needs improvement — several key conversation stages were skipped.");

  if (objectionHandling >= 80) parts.push("Excellent objection handling.");
  else if (objectionHandling < 50) parts.push("Objection handling needs work — practice acknowledging and redirecting concerns.");

  if (tone >= 75) parts.push("Positive, professional tone throughout.");
  else parts.push("Try to keep the tone more positive and encouraging.");

  if (pacing >= 80) parts.push("Good conversational pacing.");
  else if (pacing < 60) parts.push("Pacing was off — aim for 150-180 words per minute.");

  const feedback = parts.join(" ");

  return { scriptAdherence, objectionHandling, tone, pacing, feedback, keyMoments, redFlags };
}
