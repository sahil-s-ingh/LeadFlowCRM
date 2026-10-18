import { createClient } from "npm:@supabase/supabase-js@2.45.4";
// multi-number support: getSettings accepts optional settingsId

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function getSettings(supabase: any, userId: string, settingsId?: string) {
  if (settingsId) {
    const { data, error } = await supabase
      .from("whatsapp_settings")
      .select("phone_number_id, access_token")
      .eq("id", settingsId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data || !data.phone_number_id || !data.access_token) return null;
    return data;
  }
  const { data, error } = await supabase
    .from("whatsapp_settings")
    .select("phone_number_id, access_token")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data || !data.phone_number_id || !data.access_token) return null;
  return data;
}

type GuardrailResult = {
  blocked: boolean;
  reason: string;
  rule: string;
};

async function checkCallGuardrails(
  supabase: any,
  userId: string,
  toPhone: string,
  opts: { recordingEnabled?: boolean; leadId?: string; consentGiven?: boolean },
): Promise<GuardrailResult> {
  const { data: g } = await supabase
    .from("call_guardrail_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!g || !g.enabled) return { blocked: false, reason: "", rule: "" };

  // 1. DND list
  if (Array.isArray(g.dnd_phone_numbers) && g.dnd_phone_numbers.length > 0) {
    const toNorm = toPhone.replace(/[^0-9]/g, "");
    const hit = g.dnd_phone_numbers.some((n: string) => n.replace(/[^0-9]/g, "") === toNorm);
    if (hit) return { blocked: true, reason: "This number is on your Do-Not-Call list.", rule: "dnd" };
  }

  // 2. Quiet hours
  if (g.quiet_hours_enabled) {
    try {
      const tz = g.timezone || "Asia/Kolkata";
      const now = new Date();
      const local = new Intl.DateTimeFormat("en-US", {
        timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
      }).format(now);
      const [hStr, mStr] = local.split(":");
      const curMin = (parseInt(hStr, 10) * 60) + parseInt(mStr, 10);
      const [sh, sm] = (g.quiet_hours_start || "22:00").split(":").map((x: string) => parseInt(x, 10));
      const [eh, em] = (g.quiet_hours_end || "08:00").split(":").map((x: string) => parseInt(x, 10));
      const startMin = sh * 60 + sm;
      let endMin = eh * 60 + em;
      if (endMin <= startMin) endMin += 24 * 60; // overnight window
      let inWindow: boolean;
      if (curMin >= startMin && curMin < endMin) inWindow = true;
      else if (curMin + 24 * 60 < endMin && curMin + 24 * 60 >= startMin) inWindow = true;
      else inWindow = false;
      if (inWindow) {
        return {
          blocked: true,
          reason: `Calls are blocked during quiet hours (${g.quiet_hours_start}–${g.quiet_hours_end} ${tz}).`,
          rule: "quiet_hours",
        };
      }
    } catch { /* timezone error — don't block */ }
  }

  // 3. Cooldown
  if (g.cooldown_enabled && g.cooldown_minutes > 0) {
    const since = new Date(Date.now() - g.cooldown_minutes * 60 * 1000).toISOString();
    const lookbackTables = ["wa_call_sessions", "call_logs"];
    for (const t of lookbackTables) {
      let q = supabase.from(t).select("created_at").eq("user_id", userId).gte("created_at", since).order("created_at", { ascending: false }).limit(1);
      if (opts.leadId) q = q.eq("lead_id", opts.leadId);
      else {
        const norm = toPhone.replace(/[^0-9]/g, "");
        q = q.or(`phone_number.eq.+${toPhone},phone_number.eq.${toPhone}`);
        // also try normalized match
        void norm;
      }
      const { data: recent } = await q.maybeSingle();
      if (recent) {
        const mins = Math.round((Date.now() - new Date(recent.created_at).getTime()) / 60000);
        return {
          blocked: true,
          reason: `A call to this lead was placed ${mins} min ago. Cooldown is ${g.cooldown_minutes} min.`,
          rule: "cooldown",
        };
      }
    }
  }

  // 4. Recording consent
  if (g.require_recording_consent && opts.recordingEnabled && !opts.consentGiven) {
    return {
      blocked: true,
      reason: "Recording consent is required but was not confirmed. The lead must agree before recording starts.",
      rule: "consent",
    };
  }

  return { blocked: false, reason: "", rule: "" };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = authData.user.id;

    const body = await req.json();
    const {
      to, sdpOffer, sessionId, action, callId, sdpAnswer,
      recording, transcription, bizOpaqueCallbackData,
      callSettings, settingsId,
    } = body as {
      to: string;
      sdpOffer: string;
      sessionId: string;
      action?: string;
      callId?: string;
      sdpAnswer?: string;
      recording?: { enabled: boolean; purpose?: string; announcementLanguage?: string };
      transcription?: { enabled: boolean; purpose?: string; announcementLanguage?: string };
      bizOpaqueCallbackData?: string;
      callSettings?: any;
      settingsId?: string;
    };

    // Get current call settings
    if (action === "get_call_settings") {
      const settings = await getSettings(supabase, userId, settingsId);
      if (!settings) {
        return new Response(JSON.stringify({ error: "WhatsApp Business API not configured." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const apiUrl = `https://graph.facebook.com/v21.0/${settings.phone_number_id}/settings`;
      const apiResponse = await fetch(apiUrl, {
        headers: { "Authorization": `Bearer ${settings.access_token}` },
      });
      const apiData = await apiResponse.json();

      if (!apiResponse.ok) {
        return new Response(JSON.stringify({ error: apiData?.error?.message || "Failed to get call settings" }), {
          status: apiResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ settings: apiData?.calling || null }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Configure/update call settings
    if (action === "update_call_settings" && callSettings) {
      const settings = await getSettings(supabase, userId, settingsId);
      if (!settings) {
        return new Response(JSON.stringify({ error: "WhatsApp Business API not configured." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const apiUrl = `https://graph.facebook.com/v21.0/${settings.phone_number_id}/settings`;
      const apiResponse = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${settings.access_token}`,
        },
        body: JSON.stringify({ calling: callSettings }),
      });
      const apiData = await apiResponse.json();

      if (!apiResponse.ok) {
        return new Response(JSON.stringify({ error: apiData?.error?.message || "Failed to update call settings" }), {
          status: apiResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check call permission status for a user
    if (action === "check_permission" && to) {
      const settings = await getSettings(supabase, userId, settingsId);
      if (!settings) {
        return new Response(JSON.stringify({ error: "WhatsApp Business API not configured." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cleanTo = to.replace(/^\+/, "");
      const apiUrl = `https://graph.facebook.com/v21.0/${settings.phone_number_id}/call_permissions?user_wa_id=${cleanTo}`;
      const apiResponse = await fetch(apiUrl, {
        headers: { "Authorization": `Bearer ${settings.access_token}` },
      });

      const apiData = await apiResponse.json();

      if (!apiResponse.ok) {
        const errorMsg = apiData?.error?.message || "Failed to check call permission";
        return new Response(JSON.stringify({ error: errorMsg }), {
          status: apiResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const canCall = apiData?.actions?.find((a: any) => a.action_name === "start_call")?.can_perform_action ?? false;
      const permissionStatus = apiData?.permission?.status || "none";

      return new Response(JSON.stringify({
        canCall,
        permissionStatus,
        permission: apiData?.permission || null,
        actions: apiData?.actions || [],
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send a call permission request message to a user
    if (action === "request_permission" && to) {
      const settings = await getSettings(supabase, userId, settingsId);
      if (!settings) {
        return new Response(JSON.stringify({ error: "WhatsApp Business API not configured." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cleanTo = to.replace(/^\+/, "");
      const apiUrl = `https://graph.facebook.com/v21.0/${settings.phone_number_id}/messages`;
      const apiResponse = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${settings.access_token}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: cleanTo,
          type: "interactive",
          interactive: {
            type: "call_permission_request",
            body: {
              text: "We would like to call you to provide support. Please grant permission so we can place a call to you.",
            },
          },
        }),
      });

      const apiData = await apiResponse.json();

      if (!apiResponse.ok) {
        const errorMsg = apiData?.error?.message || apiData?.error?.error_user_msg || "Failed to send permission request";
        return new Response(JSON.stringify({ error: errorMsg }), {
          status: apiResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, messageId: apiData?.messages?.[0]?.id || null }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download a call recording or transcript via Media API
    if (action === "download_recording" && body.recordingId) {
      const settings = await getSettings(supabase, userId, settingsId);
      if (!settings) {
        return new Response(JSON.stringify({ error: "WhatsApp Business API not configured." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: recRow } = await supabase
        .from("wa_call_recordings")
        .select("*")
        .eq("id", body.recordingId)
        .maybeSingle();

      if (!recRow) {
        return new Response(JSON.stringify({ error: "Recording not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let mediaUrl = recRow.download_url;
      if (!mediaUrl && recRow.media_id) {
        const mediaRes = await fetch(
          `https://graph.facebook.com/v21.0/${recRow.media_id}`,
          { headers: { "Authorization": `Bearer ${settings.access_token}` } }
        );
        const mediaData = await mediaRes.json();
        mediaUrl = mediaData?.url || null;
      }

      if (!mediaUrl) {
        return new Response(JSON.stringify({ error: "Could not retrieve media URL" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const downloadRes = await fetch(mediaUrl, {
        headers: { "Authorization": `Bearer ${settings.access_token}` },
      });
      const arrayBuffer = await downloadRes.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      await supabase
        .from("wa_call_recordings")
        .update({ downloaded: true })
        .eq("id", body.recordingId);

      return new Response(JSON.stringify({
        success: true,
        data: base64,
        mimeType: recRow.mime_type || "audio/ogg",
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pre-accept an incoming call (establish WebRTC connection early)
    if (action === "pre_accept" && callId && sdpAnswer) {
      const settings = await getSettings(supabase, userId, settingsId);
      if (!settings) {
        return new Response(JSON.stringify({ error: "WhatsApp Business API not configured." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const apiUrl = `https://graph.facebook.com/v21.0/${settings.phone_number_id}/calls`;
      const apiResponse = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${settings.access_token}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          call_id: callId,
          action: "pre_accept",
          session: {
            sdp_type: "answer",
            sdp: sdpAnswer,
          },
        }),
      });

      const apiData = await apiResponse.json();

      if (!apiResponse.ok) {
        const errorMsg = apiData?.error?.message || "Failed to pre-accept call";
        return new Response(JSON.stringify({ error: errorMsg }), {
          status: apiResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("wa_call_sessions")
        .update({ status: "pre_accepted", sdp_answer: sdpAnswer, updated_at: new Date().toISOString() })
        .eq("call_id", callId);

      return new Response(JSON.stringify({ success: true, callId }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Accept an incoming call (finalize after WebRTC is established)
    if (action === "accept" && callId && sdpAnswer) {
      const settings = await getSettings(supabase, userId, settingsId);
      if (!settings) {
        return new Response(JSON.stringify({ error: "WhatsApp Business API not configured." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const apiUrl = `https://graph.facebook.com/v21.0/${settings.phone_number_id}/calls`;
      const apiResponse = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${settings.access_token}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          call_id: callId,
          action: "accept",
          session: {
            sdp_type: "answer",
            sdp: sdpAnswer,
          },
        }),
      });

      const apiData = await apiResponse.json();

      if (!apiResponse.ok) {
        const errorMsg = apiData?.error?.message || "Failed to accept call";
        await supabase
          .from("wa_call_sessions")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("call_id", callId);
        return new Response(JSON.stringify({ error: errorMsg }), {
          status: apiResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("wa_call_sessions")
        .update({ status: "accepted", sdp_answer: sdpAnswer, updated_at: new Date().toISOString() })
        .eq("call_id", callId);

      return new Response(JSON.stringify({ success: true, callId }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reject an incoming call
    if (action === "reject" && callId) {
      const settings = await getSettings(supabase, userId, settingsId);
      if (!settings) {
        return new Response(JSON.stringify({ error: "WhatsApp Business API not configured." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const apiUrl = `https://graph.facebook.com/v21.0/${settings.phone_number_id}/calls`;
      await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${settings.access_token}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          call_id: callId,
          action: "reject",
        }),
      });

      await supabase
        .from("wa_call_sessions")
        .update({ status: "rejected", updated_at: new Date().toISOString() })
        .eq("call_id", callId);

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Terminate an active call (end call)
    if (action === "terminate" && callId) {
      const settings = await getSettings(supabase, userId, settingsId);
      if (!settings) {
        return new Response(JSON.stringify({ error: "WhatsApp Business API not configured." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const apiUrl = `https://graph.facebook.com/v21.0/${settings.phone_number_id}/calls`;
      await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${settings.access_token}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          call_id: callId,
          action: "terminate",
        }),
      });

      await supabase
        .from("wa_call_sessions")
        .update({ status: "ended", updated_at: new Date().toISOString() })
        .eq("call_id", callId);

      // Fire automation trigger for call_completed
      const { data: callSession } = await supabase
        .from("wa_call_sessions")
        .select("user_id, lead_id, caller_phone")
        .eq("call_id", callId)
        .maybeSingle();
      if (callSession) {
        let leadData: Record<string, unknown> = {};
        if (callSession.lead_id) {
          const { data: lead } = await supabase
            .from("submissions")
            .select("*")
            .eq("id", callSession.lead_id)
            .maybeSingle();
          if (lead) leadData = lead as Record<string, unknown>;
        }
        try {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/process-automations`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              trigger_type: "call_completed",
              lead_id: callSession.lead_id || null,
              lead_data: leadData,
              user_id: callSession.user_id,
            }),
          });
        } catch { /* best effort */ }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Call guardrails (only for outgoing connect calls) ----
    if (!action && to && sdpOffer && sessionId) {
      const guardResult = await checkCallGuardrails(supabase, userId, to.replace(/^\+/, ""), {
        recordingEnabled: recording?.enabled || false,
        leadId: (body as Record<string, unknown>).leadId as string | undefined,
        consentGiven: (body as Record<string, unknown>).consent as boolean | undefined,
      });
      if (guardResult.blocked) {
        await supabase
          .from("wa_call_sessions")
          .update({ status: "blocked", updated_at: new Date().toISOString() })
          .eq("id", sessionId)
          .eq("user_id", userId);
        return new Response(
          JSON.stringify({ error: guardResult.reason, errorType: "guardrail", guardrail: guardResult.rule }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Initiate an outgoing call
    if (!action && to && sdpOffer && sessionId) {
      const settings = await getSettings(supabase, userId, settingsId);
      if (!settings) {
        return new Response(JSON.stringify({ error: "WhatsApp Business API not configured. Add your credentials in Settings." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("wa_call_sessions")
        .update({
          sdp_offer: sdpOffer,
          status: "initiating",
          recording_enabled: recording?.enabled || false,
          transcription_enabled: transcription?.enabled || false,
          biz_opaque_callback_data: bizOpaqueCallbackData || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId)
        .eq("user_id", userId);

      const cleanTo = to.replace(/^\+/, "");
      const apiUrl = `https://graph.facebook.com/v21.0/${settings.phone_number_id}/calls`;

      const callBody: Record<string, any> = {
        messaging_product: "whatsapp",
        to: cleanTo,
        action: "connect",
        session: {
          sdp_type: "offer",
          sdp: sdpOffer,
        },
      };

      if (bizOpaqueCallbackData) {
        callBody.biz_opaque_callback_data = bizOpaqueCallbackData.slice(0, 512);
      }

      if (recording?.enabled) {
        callBody.recording = {
          status: "ENABLED",
          purpose: recording.purpose || "quality assurance",
          announcement_language: recording.announcementLanguage || "en_US",
        };
      }

      if (transcription?.enabled) {
        callBody.transcription = {
          status: "ENABLED",
          purpose: transcription.purpose || "quality assurance",
          announcement_language: transcription.announcementLanguage || "en_US",
        };
      }

      const apiResponse = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${settings.access_token}`,
        },
        body: JSON.stringify(callBody),
      });

      const apiData = await apiResponse.json();

      if (!apiResponse.ok) {
        const errorMsg = apiData?.error?.message || apiData?.error?.error_user_msg || "Failed to initiate WhatsApp call";
        await supabase
          .from("wa_call_sessions")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", sessionId)
          .eq("user_id", userId);

        return new Response(JSON.stringify({ error: errorMsg }), {
          status: apiResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const newCallId = apiData?.calls?.[0]?.id || null;

      if (newCallId) {
        await supabase
          .from("wa_call_sessions")
          .update({ call_id: newCallId, status: "ringing", updated_at: new Date().toISOString() })
          .eq("id", sessionId)
          .eq("user_id", userId);
      }

      return new Response(JSON.stringify({ success: true, callId: newCallId, sessionId }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid request: missing required fields" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

