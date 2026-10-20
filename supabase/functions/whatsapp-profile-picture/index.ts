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
    // multi-number: default to first (oldest) settings row
    const { data: settings, error: settingsError } = await adminSupabase
      .from("whatsapp_settings")
      .select("phone_number_id, access_token, meta_app_id")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (settingsError || !settings) {
      return new Response(
        JSON.stringify({ error: "WhatsApp settings not found. Configure your WhatsApp API settings first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!settings.phone_number_id || !settings.access_token) {
      return new Response(
        JSON.stringify({ error: "Phone Number ID and Access Token are required. Configure them in WhatsApp settings first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const phoneNumberId = settings.phone_number_id;
    const accessToken = settings.access_token;
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "get";

    // ─── GET: fetch current profile picture URL ─────────────────────────
    if (action === "get" && req.method === "GET") {
      const metaRes = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/whatsapp_business_profile?fields=profile_picture_url,about,address,description,email,websites,vertical`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const metaData = await metaRes.json();

      if (metaData.error) {
        return new Response(
          JSON.stringify({ error: metaData.error.message || "Failed to fetch profile from Meta" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const profile = metaData.data?.[0] || {};
      return new Response(
        JSON.stringify({
          profile_picture_url: profile.profile_picture_url || null,
          about: profile.about || null,
          address: profile.address || null,
          description: profile.description || null,
          email: profile.email || null,
          websites: profile.websites || [],
          vertical: profile.vertical || null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── STATUS: fetch phone number quality rating and status ──────────
    if (action === "status" && req.method === "GET") {
      const statusRes = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const statusData = await statusRes.json();

      if (statusData.error) {
        return new Response(
          JSON.stringify({ error: statusData.error.message || "Failed to fetch phone number status from Meta" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({
          verified_name: statusData.verified_name || null,
          display_phone_number: statusData.display_phone_number || null,
          quality_rating: statusData.quality_rating || null,
          messaging_limit_tier: statusData.messaging_limit_tier || null,
          status: statusData.status || null,
          name_status: statusData.name_status || null,
          throughput: statusData.throughput || null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── STATUS_ALL: fetch status + usage + quality history + conversation windows ──
    if (action === "status_all" && req.method === "GET") {
      const { data: allSettings } = await adminSupabase
        .from("whatsapp_settings")
        .select("id, label, phone_number_id, access_token, connected_phone_number, user_id")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: true });

      if (!allSettings || allSettings.length === 0) {
        return new Response(JSON.stringify({ numbers: [] }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const numbers = [];
      for (const s of allSettings) {
        if (!s.phone_number_id || !s.access_token) {
          numbers.push({ settings_id: s.id, label: s.label || s.connected_phone_number || s.phone_number_id, phone_number_id: s.phone_number_id, connected_phone_number: s.connected_phone_number, error: "Missing credentials", messaging_limit_tier: null, quality_rating: null, status: null, unique_customers_24h: 0, daily_volume: [], quality_history: [], active_windows: 0, expired_windows: 0, cost_estimates: null });
          continue;
        }
        try {
          const statusRes = await fetch(
            `https://graph.facebook.com/${GRAPH_API_VERSION}/${s.phone_number_id}`,
            { headers: { Authorization: `Bearer ${s.access_token}` } },
          );
          const sd = await statusRes.json();
          if (sd.error) {
            numbers.push({ settings_id: s.id, label: s.label || s.connected_phone_number || s.phone_number_id, phone_number_id: s.phone_number_id, connected_phone_number: s.connected_phone_number, error: sd.error.message, messaging_limit_tier: null, quality_rating: null, status: null, unique_customers_24h: 0, daily_volume: [], quality_history: [], active_windows: 0, expired_windows: 0, cost_estimates: null });
            continue;
          }

          const qualityRating = sd.quality_rating || null;
          const tier = sd.messaging_limit_tier || null;

          // Log quality history if changed or first check
          try {
            const { data: lastHist } = await adminSupabase
              .from("wa_quality_history")
              .select("quality_rating, messaging_limit_tier")
              .eq("wa_settings_id", s.id)
              .order("checked_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (!lastHist || lastHist.quality_rating !== qualityRating || lastHist.messaging_limit_tier !== tier) {
              await adminSupabase.from("wa_quality_history").insert({
                wa_settings_id: s.id,
                quality_rating: qualityRating || "UNKNOWN",
                messaging_limit_tier: tier,
              });
            }
          } catch { /* non-fatal */ }

          // 24h unique customers
          const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const { count: count24h } = await adminSupabase
            .from("wa_messaging_usage")
            .select("customer_phone", { count: "exact", head: true })
            .eq("wa_settings_id", s.id)
            .gte("window_hour", since24.slice(0, 13) + ":00:00+00");

          // 7-day daily volume (business-initiated messages per day)
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          const { data: dailyData } = await adminSupabase
            .from("wa_messaging_usage")
            .select("window_hour, message_direction, customer_phone")
            .eq("wa_settings_id", s.id)
            .gte("window_hour", sevenDaysAgo.toISOString().slice(0, 13) + ":00:00+00");

          const dayMap: Record<string, { date: string; business: number; customer: number; unique: Set<string> }> = {};
          for (let i = 6; i >= 0; i--) {
            const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
            const key = d.toISOString().slice(0, 10);
            dayMap[key] = { date: key, business: 0, customer: 0, unique: new Set() };
          }
          if (dailyData) {
            for (const row of dailyData) {
              const dayKey = (row.window_hour as string).slice(0, 10);
              if (!dayMap[dayKey]) continue;
              if (row.message_direction === "customer_initiated") {
                dayMap[dayKey].customer++;
              } else {
                dayMap[dayKey].business++;
              }
              if (row.customer_phone) dayMap[dayKey].unique.add(row.customer_phone);
            }
          }
          const dailyVolume = Object.values(dayMap).map(d => ({ date: d.date, business: d.business, customer: d.customer, unique_customers: d.unique.size }));

          // Quality history (last 30 entries)
          const { data: histData } = await adminSupabase
            .from("wa_quality_history")
            .select("quality_rating, messaging_limit_tier, checked_at")
            .eq("wa_settings_id", s.id)
            .order("checked_at", { ascending: true })
            .limit(30);
          const qualityHistory = (histData || []).map(h => ({
            quality_rating: h.quality_rating,
            messaging_limit_tier: h.messaging_limit_tier,
            checked_at: h.checked_at,
          }));

          // Conversation windows: count conversations where last inbound message is within 24h
          const windowCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const { count: activeWindows } = await adminSupabase
            .from("wa_conversations")
            .select("id", { count: "exact", head: true })
            .eq("user_id", s.user_id)
            .gte("last_message_at", windowCutoff);
          const { count: totalConvs } = await adminSupabase
            .from("wa_conversations")
            .select("id", { count: "exact", head: true })
            .eq("user_id", s.user_id);
          const expiredWindows = (totalConvs || 0) - (activeWindows || 0);

          // Cost estimates (rough — based on India pricing: business-initiated ~$0.012, customer-initiated free)
          const last7Business = dailyVolume.reduce((sum, d) => sum + d.business, 0);
          const last7Customer = dailyVolume.reduce((sum, d) => sum + d.customer, 0);
          const costEstimates = {
            business_initiated_7d: last7Business,
            customer_initiated_7d: last7Customer,
            estimated_cost_7d_usd: +(last7Business * 0.012).toFixed(2),
            estimated_cost_30d_usd: +(last7Business * 0.012 * (30 / 7)).toFixed(2),
            note: "Based on India market pricing. Actual costs vary by country and conversation category.",
          };

          numbers.push({
            settings_id: s.id,
            label: s.label || s.connected_phone_number || s.phone_number_id,
            phone_number_id: s.phone_number_id,
            connected_phone_number: s.connected_phone_number,
            verified_name: sd.verified_name || null,
            display_phone_number: sd.display_phone_number || null,
            quality_rating: qualityRating,
            messaging_limit_tier: tier,
            status: sd.status || null,
            name_status: sd.name_status || null,
            throughput: sd.throughput || null,
            unique_customers_24h: count24h || 0,
            daily_volume: dailyVolume,
            quality_history: qualityHistory,
            active_windows: activeWindows || 0,
            expired_windows: expiredWindows > 0 ? expiredWindows : 0,
            cost_estimates: costEstimates,
          });
        } catch (e) {
          numbers.push({ settings_id: s.id, label: s.label || s.connected_phone_number || s.phone_number_id, phone_number_id: s.phone_number_id, connected_phone_number: s.connected_phone_number, error: e instanceof Error ? e.message : "Failed", messaging_limit_tier: null, quality_rating: null, status: null, unique_customers_24h: 0, daily_volume: [], quality_history: [], active_windows: 0, expired_windows: 0, cost_estimates: null });
        }
      }

      return new Response(JSON.stringify({ numbers }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── RENAME: update the WhatsApp display name ─────────────────────
    if (action === "rename" && req.method === "POST") {
      const contentType = req.headers.get("Content-Type") || "";
      if (!contentType.includes("application/json")) {
        return new Response(
          JSON.stringify({ error: "Content-Type must be application/json" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const body = await req.json();
      const newName = (body?.new_display_name || "").trim();
      if (!newName) {
        return new Response(
          JSON.stringify({ error: "new_display_name is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const renameRes = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}?new_display_name=${encodeURIComponent(newName)}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      const renameData = await renameRes.json();

      if (renameData.error) {
        return new Response(
          JSON.stringify({ error: renameData.error.message || "Failed to update display name" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          new_display_name: renameData.new_display_name || newName,
          new_name_status: renameData.new_name_status || null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── REGISTER: re-register phone number after display name approval ─
    if (action === "register" && req.method === "POST") {
      const contentType = req.headers.get("Content-Type") || "";
      if (!contentType.includes("application/json")) {
        return new Response(
          JSON.stringify({ error: "Content-Type must be application/json" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const body = await req.json();
      const { code, pin } = body;

      // Step 1: Request a registration code
      if (!code) {
        const regRes = await fetch(
          `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/register`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              ...(pin ? { pin: String(pin) } : {}),
            }),
          },
        );
        const regData = await regRes.json();

        if (regData.error) {
          const errCode = regData.error.code;
          const errMsg = errCode === 131037
            ? "Display name is still pending approval. Meta must approve the name before re-registration. Check Meta Business Manager → WhatsApp Manager → Phone Numbers."
            : (regData.error.error_data?.details || regData.error.message || "Failed to request registration code");
          return new Response(
            JSON.stringify({ error: errMsg }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: "Registration code sent. Enter the code you received via SMS or voice call." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Step 2: Verify the registration code
      const verifyRes = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            code: String(code),
          }),
        },
      );
      const verifyData = await verifyRes.json();

      if (verifyData.error) {
        const errMsg = verifyData.error.error_data?.details || verifyData.error.message || "Failed to verify code";
        return new Response(
          JSON.stringify({ error: errMsg }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Phone number re-registered successfully. You can now send messages." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── UPLOAD: upload a new profile picture ──────────────────────────
    if (action === "upload" && req.method === "POST") {
      if (!settings.meta_app_id) {
        return new Response(
          JSON.stringify({ error: "Meta App ID is required for profile picture uploads. Add it in WhatsApp settings first." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const appId = settings.meta_app_id;
      const contentType = req.headers.get("Content-Type") || "";

      // The client sends the image as a base64 string in a JSON body
      if (!contentType.includes("application/json")) {
        return new Response(
          JSON.stringify({ error: "Content-Type must be application/json" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const body = await req.json();
      const { base64, mimeType, fileSize } = body;

      if (!base64 || !mimeType || !fileSize) {
        return new Response(
          JSON.stringify({ error: "base64, mimeType, and fileSize are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Convert base64 to binary
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Step 1: Start the resumable upload session
      const startRes = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${appId}/uploads`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            file_length: fileSize,
            file_type: mimeType,
          }),
        },
      );
      const startData = await startRes.json();

      if (startData.error) {
        return new Response(
          JSON.stringify({ error: startData.error.message || "Failed to start upload session" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const uploadId = startData.id;
      if (!uploadId) {
        return new Response(
          JSON.stringify({ error: "Failed to get upload session ID from Meta" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Step 2: Transfer the binary file
      const transferRes = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${uploadId}`,
        {
          method: "POST",
          headers: {
            Authorization: `OAuth ${accessToken}`,
            "file_offset": "0",
          },
          body: bytes,
        },
      );
      const transferData = await transferRes.json();

      if (transferData.error) {
        return new Response(
          JSON.stringify({ error: transferData.error.message || "Failed to upload file to Meta" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const fileHandle = transferData.h;
      if (!fileHandle) {
        return new Response(
          JSON.stringify({ error: "Failed to get file handle from Meta upload" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Step 3: Update the WhatsApp business profile with the new picture handle
      const profileRes = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/whatsapp_business_profile`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            profile_picture_handle: fileHandle,
          }),
        },
      );
      const profileData = await profileRes.json();

      if (profileData.error) {
        return new Response(
          JSON.stringify({ error: profileData.error.message || "Failed to update WhatsApp profile picture" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Profile picture updated successfully" }),
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
