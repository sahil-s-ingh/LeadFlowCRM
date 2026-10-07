import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GRAPH_API_VERSION = "v20.0";

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
    // multi-number: default to first (oldest) settings row
    const { data: settings, error: settingsError } = await adminSupabase
      .from("whatsapp_settings")
      .select("waba_id, access_token")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (settingsError || !settings || !settings.waba_id || !settings.access_token) {
      return new Response(
        JSON.stringify({ error: "WhatsApp Business Account ID and Access Token are required. Configure them in WhatsApp settings first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const wabaId = settings.waba_id;
    const accessToken = settings.access_token;
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || 'list';

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

      // Sync to local cache
      for (const t of templates) {
        const existing = await adminSupabase
          .from("wa_message_templates")
          .select("id")
          .eq("user_id", userData.user.id)
          .eq("name", t.name)
          .eq("language", t.language)
          .maybeSingle();

        if (existing.data) {
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
        JSON.stringify({ templates }),
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
