import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GRAPH_API_VERSION = "v21.0";
const BATCH_DELAY_MS = 500;

// Cron-triggered: finds active drip sequences and sends steps whose offset_days
// have elapsed since the sequence started. No auth — called by Supabase cron.
// Processes due steps, sends template messages, and marks sequence completed.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();

    // Find active sequences
    const { data: activeSeqs, error } = await supabase
      .from("wa_drip_sequences")
      .select("*")
      .eq("status", "active");

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!activeSeqs || activeSeqs.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0, message: "No active drip sequences" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const results: { sequence_id: string; step: number; sent: number; failed: number }[] = [];

    for (const seq of activeSeqs) {
      if (!seq.started_at) continue;
      const startedAt = new Date(seq.started_at);
      const elapsedDays = Math.floor((now.getTime() - startedAt.getTime()) / (1000 * 60 * 60 * 24));

      // Find pending steps whose offset_days has passed
      const { data: dueSteps } = await supabase
        .from("wa_drip_steps")
        .select("*")
        .eq("sequence_id", seq.id)
        .eq("status", "pending")
        .lte("offset_days", elapsedDays)
        .order("step_number", { ascending: true });

      if (!dueSteps || dueSteps.length === 0) continue;

      // Get WhatsApp settings
      let settingsQuery = supabase
        .from("whatsapp_settings")
        .select("phone_number_id, access_token")
        .eq("user_id", seq.user_id)
        .order("created_at", { ascending: true })
        .limit(1);
      if (seq.phone_number_id) {
        settingsQuery = supabase
          .from("whatsapp_settings")
          .select("phone_number_id, access_token")
          .eq("user_id", seq.user_id)
          .eq("phone_number_id", seq.phone_number_id)
          .limit(1);
      }
      const { data: settings } = await settingsQuery.maybeSingle();
      if (!settings || !settings.phone_number_id || !settings.access_token) {
        // Skip — no WhatsApp config
        continue;
      }

      const phoneNumberId = settings.phone_number_id;
      const accessToken = settings.access_token;

      // Get opted-out numbers for this user
      const { data: optOuts } = await supabase
        .from("wa_opt_outs")
        .select("phone_number")
        .eq("user_id", seq.user_id)
        .eq("status", "opted_out");
      const optedOutSet = new Set((optOuts || []).map((o: { phone_number: string }) => o.phone_number.replace(/^\+/, "")));

      for (const step of dueSteps) {
        // Mark as sending
        await supabase.from("wa_drip_steps").update({ status: "sending" }).eq("id", step.id);

        // Count expected template params
        const storedComponents: any[] = Array.isArray(step.template_components) ? step.template_components : [];
        const bodyComponent = storedComponents.find((c) => (c?.type || "").toUpperCase() === "BODY");
        const bodyText: string = bodyComponent?.text || "";
        const placeholderMatches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
        const expectedParamCount = placeholderMatches.length;

        // Get pending recipients for this step
        const { data: pendingRecips } = await supabase
          .from("wa_drip_recipients")
          .select("*")
          .eq("step_id", step.id)
          .eq("status", "pending")
          .order("created_at", { ascending: true });

        if (!pendingRecips || pendingRecips.length === 0) {
          await supabase.from("wa_drip_steps").update({ status: "completed", sent_at: new Date().toISOString() }).eq("id", step.id);
          results.push({ sequence_id: seq.id, step: step.step_number, sent: 0, failed: 0 });
          continue;
        }

        let sentCount = 0;
        let failedCount = 0;

        for (const recipient of pendingRecips) {
          // Skip opted-out
          if (optedOutSet.has(recipient.phone_number.replace(/^\+/, ""))) {
            await supabase.from("wa_drip_recipients").update({ status: "failed", error_message: "Opted out", sent_at: new Date().toISOString() }).eq("id", recipient.id);
            failedCount++;
            continue;
          }

          try {
            const components: { type: string; parameters: { type: string; text: string }[] }[] = [];
            const varValues: Record<string, string> = recipient.variable_values || {};

            if (expectedParamCount > 0) {
              const params: { type: string; text: string }[] = [];
              for (let i = 1; i <= expectedParamCount; i++) {
                const key = String(i);
                const rawVal = varValues[key];
                const val = rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== "" ? String(rawVal) : " ";
                params.push({ type: "text", text: val });
              }
              components.push({ type: "body", parameters: params });
            } else if (varValues && Object.keys(varValues).length > 0) {
              const sortedKeys = Object.keys(varValues).sort((a, b) => parseInt(a) - parseInt(b));
              components.push({ type: "body", parameters: sortedKeys.map((k) => ({ type: "text", text: varValues[k] || " " })) });
            }

            const templatePayload: Record<string, unknown> = { name: step.template_name, language: { code: step.template_language } };
            if (components.length > 0) templatePayload.components = components;

            const sendBody: Record<string, unknown> = { messaging_product: "whatsapp", to: recipient.phone_number, type: "template", template: templatePayload };

            const sendRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
              body: JSON.stringify(sendBody),
            });
            const sendData = await sendRes.json();

            if (sendData.error) {
              const errMsg = sendData.error.error_data?.details || sendData.error.message || "Unknown error";
              await supabase.from("wa_drip_recipients").update({ status: "failed", error_message: errMsg, sent_at: new Date().toISOString() }).eq("id", recipient.id);
              failedCount++;
            } else {
              const waMessageId = sendData.messages?.[0]?.id || null;
              await supabase.from("wa_drip_recipients").update({ status: "sent", wa_message_id: waMessageId, sent_at: new Date().toISOString() }).eq("id", recipient.id);
              sentCount++;
            }
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : "Unknown error";
            await supabase.from("wa_drip_recipients").update({ status: "failed", error_message: errMsg, sent_at: new Date().toISOString() }).eq("id", recipient.id);
            failedCount++;
          }
          await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
        }

        await supabase.from("wa_drip_steps").update({ status: "completed", sent_count: sentCount, failed_count: failedCount, sent_at: new Date().toISOString() }).eq("id", step.id);
        results.push({ sequence_id: seq.id, step: step.step_number, sent: sentCount, failed: failedCount });
      }

      // Check if all steps are completed → mark sequence completed
      const { data: remainingSteps } = await supabase
        .from("wa_drip_steps")
        .select("id")
        .eq("sequence_id", seq.id)
        .in("status", ["pending", "sending"]);
      if (!remainingSteps || remainingSteps.length === 0) {
        await supabase.from("wa_drip_sequences").update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", seq.id);
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
