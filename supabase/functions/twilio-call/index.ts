import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type Provider = "twilio" | "exotel" | "plivo";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    const { data: settings } = await supabase
      .from("twilio_settings")
      .select("provider, account_sid, auth_token, twilio_number, agent_number")
      .eq("user_id", userId)
      .maybeSingle();

    if (!settings || !settings.account_sid || !settings.auth_token || !settings.twilio_number) {
      return new Response(JSON.stringify({ error: "Calling provider not configured. Add your credentials in Settings." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!settings.agent_number) {
      return new Response(JSON.stringify({ error: "Your phone number (agent number) is required. Add it in Settings." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { to, leadId, leadName } = body as { to: string; leadId?: string; leadName?: string };

    if (!to) {
      return new Response(JSON.stringify({ error: "Phone number is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const provider = (settings.provider as Provider) || "twilio";
    let callSid = "";
    let status = "initiated";

    if (provider === "twilio") {
      // Twilio calls your phone (agent) first, then when you answer, connects the lead.
      // TwiML: <Dial> your number first, then <Number> the lead.
      const twiml = `<Response><Dial callerId="${settings.twilio_number}" timeout="30"><Number>${settings.agent_number}</Number><Number>${to}</Number></Dial></Response>`;
      const formData = new URLSearchParams();
      formData.append("To", settings.agent_number);
      formData.append("From", settings.twilio_number);
      formData.append("Twiml", twiml);

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${settings.account_sid}/Calls.json`;
      const auth = btoa(`${settings.account_sid}:${settings.auth_token}`);

      const twilioRes = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      const twilioData = await twilioRes.json();
      if (!twilioRes.ok) {
        return new Response(JSON.stringify({ error: twilioData.message || "Twilio call failed" }), {
          status: twilioRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      callSid = twilioData.sid;
      status = twilioData.status || "initiated";

    } else if (provider === "exotel") {
      // Exotel Connect API: POST to https://<sid>:<token>@api.exotel.com/v1/Accounts/<sid>/Calls/connect.json
      // Body: From=agent_number, To=virtual_number, CallerId=virtual_number, CallType=transsion
      // Actually Exotel's connect API: From=agent, To=lead, CallerId=virtual_number
      const exotelUrl = `https://api.exotel.com/v1/Accounts/${settings.account_sid}/Calls/connect.json`;
      const auth = btoa(`${settings.account_sid}:${settings.auth_token}`);

      const exoFormData = new URLSearchParams();
      exoFormData.append("From", settings.agent_number || to);
      exoFormData.append("To", to);
      exoFormData.append("CallerId", settings.twilio_number);
      exoFormData.append("CallType", "transsion");

      const exoRes = await fetch(exotelUrl, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: exoFormData.toString(),
      });

      const exoData = await exoRes.json();
      if (!exoRes.ok) {
        const errMsg = exoData?.Status || exoData?.Message || "Exotel call failed";
        return new Response(JSON.stringify({ error: errMsg }), {
          status: exoRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      callSid = exoData?.Call?.Sid || exoData?.CallId || "";
      status = exoData?.Status || "initiated";

    } else if (provider === "plivo") {
      // Plivo: POST to https://api.plivo.com/v1/Account/{auth_id}/Call/
      // Body JSON: from=virtual_number, to=agent_number, answer_url=<plivo-answer function URL>
      // The answer_url returns XML that dials the lead's number
      const plivoUrl = `https://api.plivo.com/v1/Account/${settings.account_sid}/Call/`;
      const auth = btoa(`${settings.account_sid}:${settings.auth_token}`);

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const answerUrl = `${supabaseUrl}/functions/v1/plivo-answer?to=${encodeURIComponent(to)}`;

      const plivoBody = {
        from: settings.twilio_number,
        to: settings.agent_number || to,
        answer_url: answerUrl,
      };

      const plivoRes = await fetch(plivoUrl, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(plivoBody),
      });

      const plivoData = await plivoRes.json();
      if (!plivoRes.ok) {
        return new Response(JSON.stringify({ error: plivoData?.error || "Plivo call failed" }), {
          status: plivoRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      callSid = plivoData?.request_uuid || plivoData?.api_id || "";
      status = "initiated";
    }

    await supabase.from("call_logs").insert({
      user_id: userId,
      lead_id: leadId || null,
      phone_number: to,
      lead_name: leadName || null,
      status,
      twilio_call_sid: callSid,
      direction: "outbound",
    });

    return new Response(JSON.stringify({ callSid, status, provider }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
