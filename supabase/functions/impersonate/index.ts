import { createClient } from "npm:@supabase/supabase-js@2";

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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create client with the caller's token to verify they are a super admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check super admin status
    const { data: isSuperAdmin, error: adminCheckError } = await userClient.rpc("is_super_admin");
    if (adminCheckError || !isSuperAdmin) {
      return new Response(JSON.stringify({ error: "Unauthorized: super admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for privileged operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { targetUserId, action } = body;

    if (action === "start") {
      if (!targetUserId) {
        return new Response(JSON.stringify({ error: "targetUserId is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch target user details
      const { data: targetUser, error: targetError } = await adminClient.auth.admin.getUserById(targetUserId);
      if (targetError || !targetUser?.user) {
        return new Response(JSON.stringify({ error: "Target user not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate a new access token for the target user using service role
      const { data: tokenData, error: tokenError } = await adminClient.auth.admin.generateLink({
        type: "magiclink",
        email: targetUser.user.email!,
      });

      if (tokenError || !tokenData) {
        return new Response(JSON.stringify({ error: "Failed to generate session token" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Extract the token from the properties
      const hashedToken = tokenData.properties?.hashed_token;
      if (!hashedToken) {
        return new Response(JSON.stringify({ error: "Failed to extract session token" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify the OTP to get a proper session
      const verifyClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data: verifyData, error: verifyError } = await verifyClient.auth.verifyOtp({
        type: "magiclink",
        token_hash: hashedToken,
      });

      if (verifyError || !verifyData.session) {
        // Fallback: try invite link
        const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
          targetUser.user.email!,
          { redirectTo: `${new URL(req.url).origin}/#/admin` }
        );

        // If invite fails too, return the error
        if (inviteError) {
          return new Response(JSON.stringify({ error: "Failed to create impersonation session" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const session = verifyData?.session;
      if (!session) {
        return new Response(JSON.stringify({ error: "Failed to create impersonation session" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Log the impersonation
      await adminClient.from("impersonation_logs").insert({
        super_admin_id: user.id,
        super_admin_email: user.email!,
        target_user_id: targetUserId,
        target_email: targetUser.user.email!,
        started_at: new Date().toISOString(),
      });

      return new Response(JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        expires_in: session.expires_in,
        target_email: targetUser.user.email,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "end") {
      // Mark the latest impersonation by this admin as ended
      await adminClient
        .from("impersonation_logs")
        .update({ ended_at: new Date().toISOString() })
        .eq("super_admin_id", user.id)
        .is("ended_at", null);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
