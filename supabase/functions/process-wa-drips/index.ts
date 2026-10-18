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

    const now = new Date().toISOString();

    // Find all active enrollments whose next_step_at has arrived
    const { data: dueEnrollments, error: fetchErr } = await supabase
      .from("wa_drip_enrollments")
      .select(`
        id, sequence_id, conversation_id, phone_number, current_step, status,
        wa_drip_sequences!inner (
          id, user_id, is_active, total_steps,
          wa_drip_steps!wa_drip_steps_sequence_id_fkey (id, step_order, delay_hours, message_text, template_name)
        )
      `)
      .eq("status", "active")
      .lte("next_step_at", now);

    if (fetchErr) throw fetchErr;
    if (!dueEnrollments || dueEnrollments.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    let skipped = 0;

    for (const en of dueEnrollments as any[]) {
      const seq = en.wa_drip_sequences;
      if (!seq || !seq.is_active) {
        skipped++;
        continue;
      }

      const steps = (seq.wa_drip_steps || []).sort((a: any, b: any) => a.step_order - b.step_order);
      const nextStepOrder = en.current_step + 1;
      const step = steps.find((s: any) => s.step_order === nextStepOrder);
      if (!step) {
        // No more steps — mark completed
        await supabase.from("wa_drip_enrollments").update({
          status: "completed",
          completed_at: new Date().toISOString(),
          next_step_at: null,
        }).eq("id", en.id);
        continue;
      }

      // Check opt-out list for this user
      const { data: optedOut } = await supabase
        .from("wa_opt_outs")
        .select("id")
        .eq("user_id", seq.user_id)
        .eq("phone_number", en.phone_number)
        .maybeSingle();

      if (optedOut) {
        await supabase.from("wa_drip_enrollments").update({
          status: "opted_out",
          next_step_at: null,
        }).eq("id", en.id);
        skipped++;
        continue;
      }

      // Fetch whatsapp_settings for this user (first available number)
      const { data: settings } = await supabase
        .from("whatsapp_settings")
        .select("phone_number_id, access_token")
        .eq("user_id", seq.user_id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!settings || !settings.phone_number_id || !settings.access_token) {
        skipped++;
        continue;
      }

      const toNum = en.phone_number.replace(/^\+/, "");

      // Send via Meta Graph API — text or template
      let body: Record<string, unknown>;
      if (step.template_name) {
        body = {
          messaging_product: "whatsapp",
          to: toNum,
          type: "template",
          template: { name: step.template_name, language: { code: "en_US" } },
        };
      } else {
        body = {
          messaging_product: "whatsapp",
          to: toNum,
          type: "text",
          text: { body: step.message_text },
        };
      }

      try {
        const resp = await fetch(`https://graph.facebook.com/v20.0/${settings.phone_number_id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${settings.access_token}` },
          body: JSON.stringify(body),
        });
        if (!resp.ok) {
          skipped++;
          continue;
        }
      } catch {
        skipped++;
        continue;
      }

      // Record the outbound message in the conversation
      if (en.conversation_id) {
        try {
          await supabase.from("wa_messages").insert({
            conversation_id: en.conversation_id,
            sender: "admin",
            message_type: step.template_name ? "template" : "text",
            text_content: step.message_text,
          });
        } catch { /* best effort */ }
      }

      // Advance enrollment
      const isLast = nextStepOrder >= seq.total_steps;
      const nextStep = steps.find((s: any) => s.step_order === nextStepOrder + 1);
      const nextAt = (!isLast && nextStep)
        ? new Date(Date.now() + nextStep.delay_hours * 3600 * 1000).toISOString()
        : null;

      await supabase.from("wa_drip_enrollments").update({
        current_step: nextStepOrder,
        next_step_at: nextAt,
        status: isLast ? "completed" : "active",
        completed_at: isLast ? new Date().toISOString() : null,
      }).eq("id", en.id);

      sent++;
    }

    return new Response(JSON.stringify({ ok: true, sent, skipped, total: dueEnrollments.length }), {
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
