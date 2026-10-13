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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const { action } = body;

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    // ─── Exchange code for access token ───────────────────────────────
    if (action === "exchange_code") {
      const { code, phone_number_id, waba_id, display_phone_number } = body;
      if (!code || !phone_number_id || !waba_id) {
        return new Response(JSON.stringify({ error: "Missing required fields: code, phone_number_id, waba_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get the Meta App ID and config_id from the super admin config
      const { data: configRow } = await serviceClient
        .from("wa_embedded_signup_config")
        .select("meta_app_id, config_id")
        .maybeSingle();

      if (!configRow?.meta_app_id) {
        return new Response(JSON.stringify({ error: "Embedded signup is not configured. Ask your platform admin to set it up." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const appId = configRow.meta_app_id;
      const appSecret = Deno.env.get("WA_APP_SECRET");

      // Exchange the code for a long-lived access token
      // The code comes from the Facebook embedded signup response
      let accessToken = "";

      // If we have an app secret, exchange the code server-side
      if (appSecret) {
        const tokenUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${encodeURIComponent(code)}`;
        const tokenRes = await fetch(tokenUrl);
        const tokenData = await tokenRes.json();
        if (tokenData.error) {
          return new Response(JSON.stringify({ error: `Token exchange failed: ${tokenData.error.message}` }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        accessToken = tokenData.access_token;
      } else {
        // Without app secret, the client should send the access_token directly
        // (they exchanged it client-side via FB SDK)
        accessToken = body.access_token || "";
      }

      if (!accessToken) {
        return new Response(JSON.stringify({ error: "Failed to obtain access token. Please try the manual setup." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // If phone_number_id / waba_id weren't provided, resolve them from the Graph API
      let resolvedPhoneId = phone_number_id;
      let resolvedWabaId = waba_id;

      if (!resolvedPhoneId || !resolvedWabaId) {
        // Step 1: Get the WABA IDs from /me/accounts (whatsapp_business_management permission)
        const accountsRes = await fetch(
          `https://graph.facebook.com/${GRAPH_API_VERSION}/me/accounts?fields=id,name`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const accountsData = await accountsRes.json();

        if (accountsData.error || !accountsData.data || accountsData.data.length === 0) {
          return new Response(JSON.stringify({
            error: "No WhatsApp Business Accounts found. Make sure your Facebook account has access to a WhatsApp Business Manager.",
          }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Take the first WABA
        resolvedWabaId = resolvedWabaId || accountsData.data[0].id;

        // Step 2: Get phone numbers from the WABA
        const phonesRes = await fetch(
          `https://graph.facebook.com/${GRAPH_API_VERSION}/${resolvedWabaId}/phone_numbers?fields=display_phone_number,verified_name,name_status,quality_rating`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const phonesData = await phonesRes.json();

        if (phonesData.error || !phonesData.data || phonesData.data.length === 0) {
          return new Response(JSON.stringify({
            error: "No phone numbers found in this WhatsApp Business Account. Add a number in Meta Business Manager first.",
          }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        resolvedPhoneId = resolvedPhoneId || phonesData.data[0].id;
      }

      // Get the phone number details
      const phoneRes = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${resolvedPhoneId}?fields=display_phone_number,verified_name,name_status,quality_rating`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const phoneData = await phoneRes.json();
      if (phoneData.error) {
        console.warn("Phone number lookup failed:", phoneData.error);
      }

      // Save to whatsapp_settings
      const insertPayload = {
        user_id: userId,
        phone_number_id: resolvedPhoneId,
        access_token: accessToken,
        waba_id: resolvedWabaId,
        connected_phone_number: display_phone_number || phoneData?.display_phone_number || null,
        meta_app_id: appId,
        verify_token: "leadcentre_verify_" + Date.now(),
        welcome_message: "Hi! Thanks for reaching out. Our team will get back to you shortly.",
        label: phoneData?.verified_name || "WhatsApp Number",
        onboarding_method: "embedded",
        is_active: true,
      };

      const { data: inserted, error: insErr } = await serviceClient
        .from("whatsapp_settings")
        .insert(insertPayload)
        .select()
        .single();

      if (insErr) {
        return new Response(JSON.stringify({ error: insErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Register the webhook for this WABA
      try {
        await fetch(
          `https://graph.facebook.com/${GRAPH_API_VERSION}/${resolvedWabaId}/subscribed_apps`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({}),
          }
        );
      } catch {
        // Webhook registration is best-effort — don't fail the whole signup
      }

      return new Response(JSON.stringify({
        success: true,
        number: inserted,
        phone_info: phoneData,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Save manual number ───────────────────────────────────────────
    if (action === "save_manual") {
      const { phone_number_id, access_token, waba_id, display_phone_number, label, welcome_message } = body;
      if (!phone_number_id || !access_token) {
        return new Response(JSON.stringify({ error: "Phone Number ID and Access Token are required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const insertPayload = {
        user_id: userId,
        phone_number_id: phone_number_id.trim(),
        access_token: access_token.trim(),
        waba_id: waba_id?.trim() || null,
        connected_phone_number: display_phone_number?.trim() || null,
        meta_app_id: null,
        verify_token: "leadcentre_verify_" + Date.now(),
        welcome_message: welcome_message || "Hi! Thanks for reaching out. Our team will get back to you shortly.",
        label: label || "WhatsApp Number",
        onboarding_method: "manual",
        is_active: true,
      };

      const { data: inserted, error: insErr } = await serviceClient
        .from("whatsapp_settings")
        .insert(insertPayload)
        .select()
        .single();

      if (insErr) {
        return new Response(JSON.stringify({ error: insErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, number: inserted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Get embedded signup config (public read) ─────────────────────
    if (action === "get_config") {
      const { data } = await serviceClient
        .from("wa_embedded_signup_config")
        .select("meta_app_id, config_id, enabled")
        .maybeSingle();

      return new Response(JSON.stringify({ config: data || { enabled: false } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Get webhook status for a WhatsApp number ───────────────────
    if (action === "get_webhook_status") {
      const { wa_settings_id } = body;
      if (!wa_settings_id) {
        return new Response(JSON.stringify({ error: "Missing wa_settings_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: waSetting, error: waErr } = await serviceClient
        .from("whatsapp_settings")
        .select("id, access_token, waba_id, phone_number_id, user_id")
        .eq("id", wa_settings_id)
        .single();

      if (waErr || !waSetting) {
        return new Response(JSON.stringify({ error: "WhatsApp number not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (waSetting.user_id !== userId) {
        return new Response(JSON.stringify({ error: "Not authorized" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!waSetting.waba_id || !waSetting.access_token) {
        return new Response(JSON.stringify({
          webhook_registered: false,
          can_check: false,
          message: "No WABA ID or access token — webhook status unavailable for manually added numbers without a WABA ID.",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      try {
        // Query Meta: GET /{waba_id}/subscribed_apps — returns the apps subscribed to this WABA
        const subsRes = await fetch(
          `https://graph.facebook.com/${GRAPH_API_VERSION}/${waSetting.waba_id}/subscribed_apps`,
          { headers: { Authorization: `Bearer ${waSetting.access_token}` } }
        );
        const subsData = await subsRes.json();

        if (subsData.error) {
          return new Response(JSON.stringify({
            webhook_registered: false,
            can_check: true,
            error: subsData.error.message,
            message: "Failed to check webhook status — the access token may have expired.",
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const subscribedApps: Array<{ id: string; name: string }> = subsData.data || [];
        const webhookRegistered = subscribedApps.length > 0;

        return new Response(JSON.stringify({
          webhook_registered: webhookRegistered,
          can_check: true,
          subscribed_apps: subscribedApps,
          message: webhookRegistered
            ? `Webhook is active. ${subscribedApps.length} app(s) subscribed.`
            : "Webhook is NOT registered. Click 'Re-register Webhook' to fix this.",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to check webhook status";
        return new Response(JSON.stringify({
          webhook_registered: false,
          can_check: true,
          error: msg,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ─── Re-register webhook for a WhatsApp number ──────────────────
    if (action === "register_webhook") {
      const { wa_settings_id } = body;
      if (!wa_settings_id) {
        return new Response(JSON.stringify({ error: "Missing wa_settings_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: waSetting, error: waErr } = await serviceClient
        .from("whatsapp_settings")
        .select("id, access_token, waba_id, phone_number_id, user_id")
        .eq("id", wa_settings_id)
        .single();

      if (waErr || !waSetting) {
        return new Response(JSON.stringify({ error: "WhatsApp number not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (waSetting.user_id !== userId) {
        return new Response(JSON.stringify({ error: "Not authorized" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!waSetting.waba_id || !waSetting.access_token) {
        return new Response(JSON.stringify({ error: "No WABA ID or access token — cannot register webhook for this number." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const regRes = await fetch(
          `https://graph.facebook.com/${GRAPH_API_VERSION}/${waSetting.waba_id}/subscribed_apps`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${waSetting.access_token}`, "Content-Type": "application/json" },
            body: JSON.stringify({}),
          }
        );
        const regData = await regRes.json();

        if (regData.error) {
          return new Response(JSON.stringify({ error: regData.error.message }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const success = regData.success === true || regData.result === "successfully subscribed app to webhook";

        return new Response(JSON.stringify({
          success,
          message: success ? "Webhook registered successfully!" : "Webhook registration returned an unexpected response.",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to register webhook";
        return new Response(JSON.stringify({ error: msg }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }


    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
