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
          status: statusData.status || null,
          name_status: statusData.name_status || null,
          throughput: statusData.throughput || null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
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
