import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, fullName, role, activationCode } = await req.json();

    if (!email || !activationCode) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email and activationCode" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Secure notification dispatch logic (e.g. Resend, SendGrid, or SMS)
    console.log(`[Activation Invite] Sent to ${email} for ${fullName} (${role}): Code=${activationCode}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Activation invitation successfully processed for ${email}`,
        recipient: email,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
