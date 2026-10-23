// Updated: AI generation + heatmap analytics + test send fix
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GRAPH_API_VERSION = "v21.0";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userSupabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await userSupabase.auth.getUser();
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const adminSupabase = createClient(supabaseUrl, supabaseKey);
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || 'list';
    const phoneNumberIdParam = url.searchParams.get("phone_number_id");

    // If a specific phone_number_id is provided, use that number's WABA credentials.
    // Otherwise fall back to the first (oldest) connected number.
    let settingsQuery = adminSupabase
      .from("whatsapp_settings")
      .select("waba_id, access_token, phone_number_id, connected_phone_number, label")
      .eq("user_id", userData.user.id);

    if (phoneNumberIdParam) {
      settingsQuery = settingsQuery.eq("phone_number_id", phoneNumberIdParam);
    } else {
      settingsQuery = settingsQuery.order("created_at", { ascending: true }).limit(1);
    }

    const { data: settings, error: settingsError } = await settingsQuery.maybeSingle();

    if (settingsError || !settings || !settings.waba_id || !settings.access_token) {
      return new Response(
        JSON.stringify({ error: "WhatsApp Business Account ID and Access Token are required. Configure them in WhatsApp settings first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const wabaId = settings.waba_id;
    const accessToken = settings.access_token;

    // ─── LIST: fetch templates from Meta ───────────────────────────────
    if (action === 'list' && req.method === 'GET') {
      const metaRes = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/message_templates?limit=250`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const metaData = await metaRes.json();

      if (metaData.error) {
        return new Response(
          JSON.stringify({ error: metaData.error.message || "Failed to fetch templates from Meta" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const templates = (metaData.data || []).map((t: any) => ({
        meta_template_id: t.id,
        name: t.name,
        language: t.language,
        category: t.category,
        status: t.status,
        components: t.components || [],
        rejection_reason: t.rejection_reason || null,
      }));

      const phoneLabel = settings.label || settings.connected_phone_number || settings.phone_number_id;

      // Sync to local cache + detect status changes for notifications
      for (const t of templates) {
        const existing = await adminSupabase
          .from("wa_message_templates")
          .select("id, status")
          .eq("user_id", userData.user.id)
          .eq("name", t.name)
          .eq("language", t.language)
          .maybeSingle();

        if (existing.data) {
          if (existing.data.status !== t.status) {
            await adminSupabase.from("wa_template_notifications").insert({
              user_id: userData.user.id,
              template_name: t.name,
              template_language: t.language,
              old_status: existing.data.status,
              new_status: t.status,
              rejection_reason: t.rejection_reason,
              phone_label: phoneLabel,
            });
          }
          await adminSupabase
            .from("wa_message_templates")
            .update({
              meta_template_id: t.meta_template_id,
              status: t.status,
              category: t.category,
              components: t.components,
              rejection_reason: t.rejection_reason,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.data.id);
        } else {
          await adminSupabase
            .from("wa_message_templates")
            .insert({
              user_id: userData.user.id,
              meta_template_id: t.meta_template_id,
              name: t.name,
              language: t.language,
              category: t.category,
              status: t.status,
              components: t.components,
              rejection_reason: t.rejection_reason,
            });
        }
      }

      return new Response(
        JSON.stringify({
          templates,
          phone_number_id: settings.phone_number_id,
          phone_label: phoneLabel,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── CREATE: submit a new template to Meta ──────────────────────────
    if (action === 'create' && req.method === 'POST') {
      const body = await req.json();
      const { name, language, category, components } = body;

      if (!name || !language || !category || !components) {
        return new Response(
          JSON.stringify({ error: "name, language, category, and components are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Server-side validation: check body variable/example count match
      const bodyComp = components.find((c: any) => c.type === 'BODY');
      if (bodyComp) {
        const bodyVars = (bodyComp.text?.match(/\{\{(\d+)\}\}/g) || []).map((m: string) => parseInt(m.match(/\d+/)![0], 10));
        const uniqueVars = [...new Set(bodyVars)].sort((a: number, b: number) => a - b);
        if (uniqueVars.length > 0) {
          for (let i = 0; i < uniqueVars.length; i++) {
            if (uniqueVars[i] !== i + 1) {
              return new Response(
                JSON.stringify({ error: `Body variables must be sequential starting from {{1}}. Found {{${uniqueVars[i]}}} but expected {{${i + 1}}}.` }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
              );
            }
          }
          if (!bodyComp.example?.body_text) {
            return new Response(
              JSON.stringify({ error: `Body has ${uniqueVars.length} variable(s) but no example values were provided. Meta requires example values for all variables.` }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
          const exampleCount = bodyComp.example.body_text[0]?.length || 0;
          if (exampleCount !== uniqueVars.length) {
            return new Response(
              JSON.stringify({ error: `Body has ${uniqueVars.length} variable(s) but ${exampleCount} example value(s) were provided. Provide exactly ${uniqueVars.length}.` }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
        }
      }

      const metaRes = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/message_templates`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            name,
            language,
            category,
            components,
          }),
        },
      );

      const metaData = await metaRes.json();

      if (metaData.error) {
        const errDetail = metaData.error.error_data;
        const errMsg = (errDetail && errDetail.details) || metaData.error.message || "Meta API error";
        const errCode = metaData.error.code ? ` (code ${metaData.error.code})` : '';
        return new Response(
          JSON.stringify({ error: `${errMsg}${errCode}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Cache locally
      await adminSupabase
        .from("wa_message_templates")
        .insert({
          user_id: userData.user.id,
          meta_template_id: metaData.id || null,
          name,
          language,
          category,
          status: metaData.status || 'PENDING',
          components,
        });

      return new Response(
        JSON.stringify({
          success: true,
          template: {
            meta_template_id: metaData.id,
            name: metaData.name || name,
            language,
            category: metaData.category || category,
            status: metaData.status || 'PENDING',
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── EDIT: update an existing template on Meta ──────────────────────
    if (action === 'edit' && req.method === 'POST') {
      const body = await req.json();
      const { meta_template_id, components, category } = body;

      if (!meta_template_id || !components) {
        return new Response(
          JSON.stringify({ error: "meta_template_id and components are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const payload: any = { components };
      if (category) payload.category = category;

      const metaRes = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${meta_template_id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        },
      );

      const metaData = await metaRes.json();

      if (metaData.error) {
        const errDetail = metaData.error.error_data;
        const errMsg = (errDetail && errDetail.details) || metaData.error.message || "Meta API error";
        const errCode = metaData.error.code ? ` (code ${metaData.error.code})` : '';
        return new Response(
          JSON.stringify({ error: `${errMsg}${errCode}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Update local cache
      await adminSupabase
        .from("wa_message_templates")
        .update({
          components,
          category: category || undefined,
          status: metaData.status || 'PENDING',
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userData.user.id)
        .eq("meta_template_id", meta_template_id);

      return new Response(
        JSON.stringify({
          success: true,
          template: {
            meta_template_id: metaData.id || meta_template_id,
            status: metaData.status || 'PENDING',
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── SYNC: fetch a single template's latest status from Meta ────────
    if (action === 'sync' && req.method === 'GET') {
      const metaTemplateId = url.searchParams.get('meta_template_id');
      if (!metaTemplateId) {
        return new Response(
          JSON.stringify({ error: "meta_template_id query parameter is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const metaRes = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${metaTemplateId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const metaData = await metaRes.json();

      if (metaData.error) {
        return new Response(
          JSON.stringify({ error: metaData.error.message || "Failed to fetch template status" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const template = {
        meta_template_id: metaData.id,
        name: metaData.name,
        language: metaData.language,
        category: metaData.category,
        status: metaData.status,
        components: metaData.components || [],
        rejection_reason: metaData.rejection_reason || null,
      };

      // Update local cache
      await adminSupabase
        .from("wa_message_templates")
        .update({
          status: template.status,
          category: template.category,
          components: template.components,
          rejection_reason: template.rejection_reason,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userData.user.id)
        .eq("meta_template_id", metaTemplateId);

      return new Response(
        JSON.stringify({ template }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── DELETE: remove a template from Meta ────────────────────────────
    if (action === 'delete' && req.method === 'DELETE') {
      const body = await req.json();
      const { meta_template_id, name } = body;

      if (!meta_template_id && !name) {
        return new Response(
          JSON.stringify({ error: "meta_template_id or name is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Look up the template name from local cache if not provided
      let templateName = name;
      if (!templateName && meta_template_id) {
        const { data: cached } = await adminSupabase
          .from("wa_message_templates")
          .select("name")
          .eq("user_id", userData.user.id)
          .eq("meta_template_id", meta_template_id)
          .maybeSingle();
        templateName = cached?.name;
      }

      if (!templateName) {
        return new Response(
          JSON.stringify({ error: "Could not determine template name for deletion" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Meta requires deleting templates via the WABA endpoint with the name as a query param
      const metaRes = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/message_templates?name=${encodeURIComponent(templateName)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      const metaData = await metaRes.json();

      if (metaData.error) {
        const errMsg = metaData.error.message || "Failed to delete template";
        // If the template doesn't exist on Meta anymore, treat it as already deleted
        // and remove from local cache so the UI stays in sync.
        if (/does not exist|not found|cannot be loaded|already/i.test(errMsg)) {
          await adminSupabase
            .from("wa_message_templates")
            .delete()
            .eq("user_id", userData.user.id)
            .eq("meta_template_id", meta_template_id);

          return new Response(
            JSON.stringify({ success: true, alreadyDeleted: true }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({ error: errMsg }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Remove from local cache
      await adminSupabase
        .from("wa_message_templates")
        .delete()
        .eq("user_id", userData.user.id)
        .eq("meta_template_id", meta_template_id);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── MEDIA UPLOAD: upload file to Meta and return handle ──────────
    if (action === 'media_upload' && req.method === 'POST') {
      const body = await req.json();
      const { type, url: fileUrl } = body;

      if (!type || !fileUrl) {
        return new Response(
          JSON.stringify({ error: "type and url are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Fetch the file from the provided URL
      const fileRes = await fetch(fileUrl);
      if (!fileRes.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to download file from URL" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const fileBlob = await fileRes.blob();
      const formData = new FormData();
      formData.append("type", type);
      formData.append("file", fileBlob, fileUrl.split('/').pop() || 'file');

      const uploadRes = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/whatsapp_business_media`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: formData,
        },
      );
      const uploadData = await uploadRes.json();

      if (uploadData.error) {
        return new Response(
          JSON.stringify({ error: uploadData.error.message || "Failed to upload media to Meta" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ handle: uploadData.h, id: uploadData.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── TEST SEND: send a test message to a phone number ─────────────
    if (action === 'test_send' && req.method === 'POST') {
      const body = await req.json();
      const { template_name, language, phone_number, components } = body;

      if (!template_name || !phone_number) {
        return new Response(
          JSON.stringify({ error: "template_name and phone_number are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Get the phone number ID — use the already-resolved settings from the top of the function
      if (!settings?.phone_number_id) {
        return new Response(
          JSON.stringify({ error: "Phone number ID not configured. Connect a WhatsApp number first." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const payload: any = {
        messaging_product: "whatsapp",
        to: phone_number,
        type: "template",
        template: {
          name: template_name,
          language: { code: language || 'en_US' },
        },
      };

      if (components && components.length > 0) {
        payload.template.components = components;
      }

      const sendRes = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${settings.phone_number_id}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        },
      );
      const sendData = await sendRes.json();

      if (sendData.error) {
        return new Response(
          JSON.stringify({ error: sendData.error.message || "Failed to send test message" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true, message_id: sendData.messages?.[0]?.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── ANALYTICS: fetch template analytics from Meta ────────────────
    if (action === 'analytics' && req.method === 'GET') {
      const templateName = url.searchParams.get('name');
      if (!templateName) {
        return new Response(
          JSON.stringify({ error: "name query parameter is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Fetch template analytics from Meta's insights API
      const startTs = url.searchParams.get('start') || String(Math.floor(Date.now() / 1000) - 7 * 86400);
      const endTs = url.searchParams.get('end') || String(Math.floor(Date.now() / 1000));

      const analyticsRes = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/template_analytics?` +
        `template_name=${encodeURIComponent(templateName)}&` +
        `start=${startTs}&end=${endTs}&granularity=DAILY&metric_types=CLICKS,DELIVERED,READ,SENT`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const analyticsData = await analyticsRes.json();

      if (analyticsData.error) {
        return new Response(
          JSON.stringify({ error: analyticsData.error.message || "Failed to fetch analytics" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const dataPoints = analyticsData.analytics?.data?.category?.[0]?.data_points || [];
      const totals = dataPoints.reduce((acc: any, dp: any) => {
        acc.sent = (acc.sent || 0) + (dp.sent || 0);
        acc.delivered = (acc.delivered || 0) + (dp.delivered || 0);
        acc.read = (acc.read || 0) + (dp.read || 0);
        acc.clicked = (acc.clicked || 0) + (dp.clicked || 0);
        return acc;
      }, {});

      return new Response(
        JSON.stringify({ analytics: totals, dataPoints }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── AI GENERATE: generate template content from a goal ───────────
    if (action === 'ai_generate' && req.method === 'POST') {
      const body = await req.json();
      const { goal, category, language, tone } = body;

      if (!goal || !goal.trim()) {
        return new Response(
          JSON.stringify({ error: "A goal description is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const cat = (category || 'MARKETING').toUpperCase();
      const langLabel = language || 'en_US';
      const toneLabel = tone || 'professional';
      const optOutPhrase = cat === 'MARKETING' ? '\n\nFooter must include an opt-out phrase like "Reply STOP to unsubscribe".' : '';
      const authNote = cat === 'AUTHENTICATION' ? '\n\nFor authentication templates, the body must contain only {{1}} for the OTP code.' : '';

      const prompt = `You are a WhatsApp Business template expert. Generate a WhatsApp message template for the following goal:

Goal: ${goal}
Category: ${cat}
Language: ${langLabel}
Tone: ${toneLabel}

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{
  "name": "lowercase_with_underscores_min_5_chars",
  "header": "Short header text or empty string for no header",
  "body": "The message body text. Use {{1}}, {{2}} etc. for variables.",
  "footer": "Footer text or empty string",
  "bodyExamples": ["example_value_1", "example_value_2"],
  "headerExample": "example value if header has a variable, else empty string",
  "buttons": [{"type": "QUICK_REPLY", "text": "Button text"}, {"type": "URL", "text": "Button text", "url": "https://example.com"}]
}

Rules:
- Name must be lowercase, only letters, numbers, and underscores, 5-60 chars
- Body must be under 1024 characters
- Variables must be sequential starting from {{1}}
- Provide example values for every variable
- Up to 2 buttons (can be empty array for no buttons)
- Button text max 25 characters
- Do NOT use banned words: free, win, winner, won, prize, gift, guaranteed, lottery, earn, click here, buy now, limited time, act now, urgent, casino, gambling, loan, credit card
- Do NOT include URLs in the body text (use URL buttons instead)${optOutPhrase}${authNote}
- Keep the tone ${toneLabel} and natural for WhatsApp messaging`;

      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a WhatsApp Business template generator. You only return valid JSON." },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 800,
        }),
      });

      if (!aiRes.ok) {
        const errText = await aiRes.text();
        return new Response(
          JSON.stringify({ error: `AI generation failed: ${aiRes.status}. ${errText.slice(0, 200)}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const aiData = await aiRes.json();
      const content = aiData.choices?.[0]?.message?.content || '';

      let parsed: any;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
      } catch {
        return new Response(
          JSON.stringify({ error: "AI returned an invalid response. Please try again with a different goal." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (!parsed.body || !parsed.name) {
        return new Response(
          JSON.stringify({ error: "AI response is missing required fields (name or body)." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Sanitize name
      parsed.name = parsed.name.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

      return new Response(
        JSON.stringify({ template: parsed }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── HEATMAP: daily analytics data points for heatmap ─────────────
    if (action === 'heatmap' && req.method === 'GET') {
      const templateName = url.searchParams.get('name');
      if (!templateName) {
        return new Response(
          JSON.stringify({ error: "name query parameter is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const startTs = url.searchParams.get('start') || String(Math.floor(Date.now() / 1000) - 30 * 86400);
      const endTs = url.searchParams.get('end') || String(Math.floor(Date.now() / 1000));

      const analyticsRes = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/template_analytics?` +
        `template_name=${encodeURIComponent(templateName)}&` +
        `start=${startTs}&end=${endTs}&granularity=DAILY&metric_types=CLICKS,DELIVERED,READ,SENT`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const analyticsData = await analyticsRes.json();

      if (analyticsData.error) {
        return new Response(
          JSON.stringify({ error: analyticsData.error.message || "Failed to fetch analytics" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const dataPoints = analyticsData.analytics?.data?.category?.[0]?.data_points || [];
      const dayStats = dataPoints.map((dp: any) => {
        const date = new Date(dp.start * 1000);
        return {
          date: date.toISOString().split('T')[0],
          dayOfWeek: date.getDay(),
          hour: date.getHours(),
          sent: dp.sent || 0,
          delivered: dp.delivered || 0,
          read: dp.read || 0,
          clicked: dp.clicked || 0,
        };
      });

      return new Response(
        JSON.stringify({ dataPoints: dayStats }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
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
