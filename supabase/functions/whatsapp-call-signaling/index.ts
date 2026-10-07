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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!; // multi-number: default to first settings row
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);

    // Meta webhook verification (GET)
    if (req.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode === "subscribe") {
        const { data: allSettings } = await supabase
          .from("whatsapp_settings")
          .select("verify_token");

        const match = allSettings?.find((s: any) => s.verify_token && s.verify_token === token);
        if (match || !allSettings || allSettings.length === 0) {
          if (allSettings && allSettings.length > 0 && !match) {
            return new Response("Forbidden", { status: 403, headers: corsHeaders });
          }
          return new Response(challenge || "ok", {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "text/plain" },
          });
        }
        return new Response("Forbidden", { status: 403, headers: corsHeaders });
      }
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    // POST: webhook callback from Meta for call events
    const body = await req.json();

    if (!body?.entry || !Array.isArray(body.entry)) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const entry of body.entry) {
      for (const change of entry.changes || []) {
        // Handle call permission reply (arrives as a message, not a call event)
        if (change.field === "messages" && change.value?.messages) {
          for (const msg of change.value.messages) {
            const interactive = msg.interactive;
            if (interactive?.type !== "call_permission_reply") continue;

            const reply = interactive.call_permission_reply || {};
            const response = reply.response || "";
            const isPermanent = reply.is_permanent || false;
            const expirationTimestamp = reply.expiration_timestamp || null;
            const responseSource = reply.response_source || "";
            const fromPhone = msg.from || "";

            await supabase.from("wa_call_permissions").upsert({
              phone_number: fromPhone,
              response,
              is_permanent: isPermanent,
              expiration_timestamp: expirationTimestamp ? new Date(parseInt(expirationTimestamp) * 1000).toISOString() : null,
              response_source: responseSource,
              updated_at: new Date().toISOString(),
            }, { onConflict: "phone_number" });
          }
          continue;
        }

        if (change.field !== "calls") continue;

        const phoneNumberId = change.value?.metadata?.phone_number_id;
        const contacts = change.value?.contacts || [];
        const callerWaId = contacts[0]?.wa_id || "";

        // Handle calls array (connect/terminate/recording/transcription events)
        if (change.value?.calls && Array.isArray(change.value.calls)) {
          for (const callEvent of change.value.calls) {
            const callId = callEvent.id;
            if (!callId) continue;

            const event = callEvent.event;
            const direction = callEvent.direction || "";
            const sdpType = callEvent.session?.sdp_type;
            const sdp = callEvent.session?.sdp || "";
            const webrtcSdp = callEvent.connection?.webrtc?.sdp || "";
            const statusArray = callEvent.status || [];

            // Incoming call (user-initiated): connect event with SDP offer
            if (event === "connect" && sdpType === "offer" && sdp && direction !== "BUSINESS_INITIATED") {
              let ownerUserId: string | null = null;
              if (phoneNumberId) {
                const { data: settings } = await supabase
                  .from("whatsapp_settings")
                  .select("user_id")
                  .eq("phone_number_id", phoneNumberId)
                  .maybeSingle();
                ownerUserId = settings?.user_id || null;
              }
              if (!ownerUserId) {
                const { data: fallback } = await supabase
                  .from("whatsapp_settings")
                  .select("user_id")
                  .order("created_at", { ascending: true })
                  .limit(1)
                  .maybeSingle();
                ownerUserId = fallback?.user_id || null;
              }

              const callerPhone = callEvent.to || callerWaId || "";

              await supabase.from("wa_call_sessions").insert({
                call_id: callId,
                phone_number: callerPhone,
                status: "incoming_ringing",
                sdp_offer: sdp,
                direction: "user_initiated",
                user_id: ownerUserId,
              });
              continue;
            }

            // Outgoing call (business-initiated): connect event with SDP answer
            if (event === "connect" && direction === "BUSINESS_INITIATED") {
              const answerSdp = sdpType === "answer" ? sdp : webrtcSdp;
              if (answerSdp) {
                await supabase
                  .from("wa_call_sessions")
                  .update({
                    sdp_answer: answerSdp,
                    status: "accepted",
                    updated_at: new Date().toISOString(),
                  })
                  .eq("call_id", callId);
              }
              continue;
            }

            // Call recording available webhook
            if (event === "call_recording_available") {
              const recording = callEvent.call_recording;
              if (recording?.audio) {
                const { data: sessionRow } = await supabase
                  .from("wa_call_sessions")
                  .select("id")
                  .eq("call_id", callId)
                  .maybeSingle();

                await supabase.from("wa_call_recordings").insert({
                  call_session_id: sessionRow?.id || null,
                  call_id: callId,
                  type: "recording",
                  media_id: recording.audio.id || null,
                  sha256: recording.audio.sha256 || null,
                  mime_type: recording.audio.mime_type || "audio/ogg; codecs=opus",
                  download_url: recording.audio.url || null,
                });
              }
              continue;
            }

            // Call transcription available webhook
            if (event === "call_transcription_available") {
              const transcript = callEvent.call_transcript;
              if (transcript?.document) {
                const { data: sessionRow } = await supabase
                  .from("wa_call_sessions")
                  .select("id")
                  .eq("call_id", callId)
                  .maybeSingle();

                await supabase.from("wa_call_recordings").insert({
                  call_session_id: sessionRow?.id || null,
                  call_id: callId,
                  type: "transcription",
                  media_id: transcript.document.id || null,
                  sha256: transcript.document.sha256 || null,
                  mime_type: transcript.document.mime_type || "application/json",
                  download_url: transcript.document.url || null,
                });
              }
              continue;
            }

            // Terminate event: call ended (both directions)
            if (event === "terminate") {
              const finalStatus = statusArray?.includes("Failed") ? "failed"
                : statusArray?.includes("Completed") ? "ended"
                : "ended";

              const startTime = callEvent.start_time ? new Date(parseInt(callEvent.start_time) * 1000).toISOString() : null;
              const endTime = callEvent.end_time ? new Date(parseInt(callEvent.end_time) * 1000).toISOString() : null;
              const duration = callEvent.duration ? parseInt(callEvent.duration) : null;
              const errors = callEvent.errors || [];
              const bizOpaque = callEvent.biz_opaque_callback_data || null;

              const updateData: Record<string, any> = {
                status: finalStatus,
                updated_at: new Date().toISOString(),
              };

              if (startTime) updateData.call_start_time = startTime;
              if (endTime) updateData.call_end_time = endTime;
              if (duration !== null) updateData.call_duration = duration;
              if (bizOpaque) updateData.biz_opaque_callback_data = bizOpaque;
              if (errors.length > 0) {
                updateData.error_code = errors[0].code || null;
                updateData.error_message = errors[0].message || null;
              }

              await supabase
                .from("wa_call_sessions")
                .update(updateData)
                .eq("call_id", callId);
              continue;
            }
          }
        }

        // Handle statuses array (RINGING/ACCEPTED/REJECTED for business-initiated calls)
        if (change.value?.statuses && Array.isArray(change.value.statuses)) {
          for (const statusEvent of change.value.statuses) {
            const callId = statusEvent.id;
            const status = (statusEvent.status || "").toLowerCase();
            if (!callId || !status) continue;

            const statusMap: Record<string, string> = {
              ringing: "ringing",
              accepted: "accepted",
              rejected: "rejected",
              ended: "ended",
              failed: "failed",
              no_answer: "no-answer",
              busy: "busy",
            };

            const mappedStatus = statusMap[status] || status;

            await supabase
              .from("wa_call_sessions")
              .update({
                status: mappedStatus,
                updated_at: new Date().toISOString(),
              })
              .eq("call_id", callId);
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


