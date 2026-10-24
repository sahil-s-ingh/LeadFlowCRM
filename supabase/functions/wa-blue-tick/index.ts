import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ApplicationPayload {
  action: "submit" | "check_status" | "save_draft";
  application_id?: string;
  business_name: string;
  business_display_name: string;
  business_category: string;
  business_description: string;
  website_url?: string;
  business_email: string;
  business_phone: string;
  address_line1: string;
  address_city: string;
  address_state?: string;
  address_country: string;
  address_postal_code?: string;
  waba_id?: string;
  phone_number_id?: string;
  documents_provided?: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: ApplicationPayload = await req.json();
    const { action } = body;

    if (action === "save_draft") {
      const payload = {
        user_id: user.id,
        business_name: body.business_name,
        business_display_name: body.business_display_name,
        business_category: body.business_category,
        business_description: body.business_description,
        website_url: body.website_url || null,
        business_email: body.business_email,
        business_phone: body.business_phone,
        address_line1: body.address_line1,
        address_city: body.address_city,
        address_state: body.address_state || null,
        address_country: body.address_country,
        address_postal_code: body.address_postal_code || null,
        waba_id: body.waba_id || null,
        phone_number_id: body.phone_number_id || null,
        documents_provided: body.documents_provided || [],
        status: "draft",
        updated_at: new Date().toISOString(),
      };

      if (body.application_id) {
        const { data, error } = await supabase
          .from("wa_blue_tick_applications")
          .update(payload)
          .eq("id", body.application_id)
          .eq("user_id", user.id)
          .select()
          .single();
        if (error) throw new Error(error.message);
        return new Response(JSON.stringify({ application: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        const { data, error } = await supabase
          .from("wa_blue_tick_applications")
          .insert(payload)
          .select()
          .single();
        if (error) throw new Error(error.message);
        return new Response(JSON.stringify({ application: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "submit") {
      const required = ["business_name", "business_display_name", "business_category", "business_description", "business_email", "business_phone", "address_line1", "address_city", "address_country"];
      for (const field of required) {
        if (!(body as Record<string, string>)[field]?.trim()) {
          return new Response(JSON.stringify({ error: `Missing required field: ${field}` }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const { data: waSettings } = await supabase
        .from("whatsapp_settings")
        .select("phone_number_id, access_token, waba_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      const wabaId = body.waba_id || waSettings?.waba_id;
      const phoneNumberId = body.phone_number_id || waSettings?.phone_number_id;
      const accessToken = waSettings?.access_token;

      let metaApplicationId: string | null = null;
      let metaVerificationStatus: string | null = null;
      let submitError: string | null = null;

      if (accessToken && wabaId) {
        try {
          const metaRes = await fetch(
            `https://graph.facebook.com/v21.0/${wabaId}/whatsapp_business_verification`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                business_name: body.business_name,
                business_display_name: body.business_display_name,
                business_category: body.business_category,
                business_description: body.business_description,
                website_url: body.website_url || undefined,
                business_email: body.business_email,
                business_phone: body.business_phone,
                address: {
                  street: body.address_line1,
                  city: body.address_city,
                  state: body.address_state || undefined,
                  country: body.address_country,
                  postal_code: body.address_postal_code || undefined,
                },
              }),
            }
          );
          const metaData = await metaRes.json();
          if (metaRes.ok) {
            metaApplicationId = metaData.id || null;
            metaVerificationStatus = metaData.verification_status || "submitted";
          } else {
            submitError = metaData.error?.message || "Meta API submission failed";
          }
        } catch {
          submitError = "Could not reach Meta's verification API";
        }
      }

      const status = "submitted";
      const payload = {
        user_id: user.id,
        business_name: body.business_name,
        business_display_name: body.business_display_name,
        business_category: body.business_category,
        business_description: body.business_description,
        website_url: body.website_url || null,
        business_email: body.business_email,
        business_phone: body.business_phone,
        address_line1: body.address_line1,
        address_city: body.address_city,
        address_state: body.address_state || null,
        address_country: body.address_country,
        address_postal_code: body.address_postal_code || null,
        waba_id: wabaId || null,
        phone_number_id: phoneNumberId || null,
        documents_provided: body.documents_provided || [],
        status,
        meta_application_id: metaApplicationId,
        meta_verification_status: metaVerificationStatus,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      let application;
      if (body.application_id) {
        const { data, error } = await supabase
          .from("wa_blue_tick_applications")
          .update(payload)
          .eq("id", body.application_id)
          .eq("user_id", user.id)
          .select()
          .single();
        if (error) throw new Error(error.message);
        application = data;
      } else {
        const { data, error } = await supabase
          .from("wa_blue_tick_applications")
          .insert(payload)
          .select()
          .single();
        if (error) throw new Error(error.message);
        application = data;
      }

      return new Response(JSON.stringify({
        application,
        meta_submitted: !submitError,
        meta_error: submitError,
        warning: submitError
          ? "Your application was saved, but we could not automatically submit it to Meta. You'll need to complete verification in Meta Business Manager."
          : null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "check_status") {
      if (!body.application_id) {
        return new Response(JSON.stringify({ error: "Application ID required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: app, error: appError } = await supabase
        .from("wa_blue_tick_applications")
        .select("*")
        .eq("id", body.application_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (appError) throw new Error(appError.message);
      if (!app) {
        return new Response(JSON.stringify({ error: "Application not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let metaStatus = app.meta_verification_status;
      let metaRejectionReason = app.rejection_reason;

      if (app.meta_application_id && app.waba_id) {
        const { data: waSettings } = await supabase
          .from("whatsapp_settings")
          .select("access_token")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (waSettings?.access_token) {
          try {
            const metaRes = await fetch(
              `https://graph.facebook.com/v21.0/${app.meta_application_id}`,
              {
                headers: { "Authorization": `Bearer ${waSettings.access_token}` },
              }
            );
            const metaData = await metaRes.json();
            if (metaRes.ok) {
              metaStatus = metaData.verification_status || metaStatus;
              if (metaStatus === "rejected" && metaData.rejection_reason) {
                metaRejectionReason = metaData.rejection_reason;
              }
            }
          } catch { /* non-fatal — return stored status */ }
        }
      }

      const statusMap: Record<string, string> = {
        "approved": "approved",
        "verified": "approved",
        "rejected": "rejected",
        "declined": "rejected",
        "in_review": "in_review",
        "in review": "in_review",
        "pending": "in_review",
        "submitted": "in_review",
      };
      const newStatus = metaStatus ? (statusMap[metaStatus.toLowerCase()] || app.status) : app.status;

      if (newStatus !== app.status || metaStatus !== app.meta_verification_status) {
        const updatePayload: Record<string, string | null> = {
          status: newStatus,
          meta_verification_status: metaStatus,
          updated_at: new Date().toISOString(),
        };
        if (newStatus === "approved" || newStatus === "rejected") {
          updatePayload.reviewed_at = new Date().toISOString();
        }
        if (metaRejectionReason !== app.rejection_reason) {
          updatePayload.rejection_reason = metaRejectionReason;
        }
        await supabase
          .from("wa_blue_tick_applications")
          .update(updatePayload)
          .eq("id", app.id)
          .eq("user_id", user.id);
        app.status = newStatus;
        app.meta_verification_status = metaStatus;
        app.rejection_reason = metaRejectionReason;
      }

      return new Response(JSON.stringify({ application: app }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
