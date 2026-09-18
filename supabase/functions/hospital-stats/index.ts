import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const todayStr = new Date().toISOString().slice(0, 10);

    // Run parallel aggregated queries
    const [
      { count: totalPatients },
      { count: visitsToday },
      { data: todayPayments },
      { count: activeDoctors },
      { count: lowStockMeds },
    ] = await Promise.all([
      supabase.from("patients").select("*", { count: "exact", head: true }),
      supabase.from("visits").select("*", { count: "exact", head: true }).eq("visit_date", todayStr),
      supabase.from("payments").select("amount").eq("status", "paid").eq("paid_date", todayStr),
      supabase.from("doctors").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("medicines").select("*", { count: "exact", head: true }).eq("status", "low_stock"),
    ]);

    const revenueToday = (todayPayments || []).reduce((acc, curr) => acc + (curr.amount || 0), 0);

    return new Response(
      JSON.stringify({
        totalPatients: totalPatients || 0,
        visitsToday: visitsToday || 0,
        revenueToday,
        activeDoctors: activeDoctors || 0,
        lowStockMeds: lowStockMeds || 0,
        generatedAt: new Date().toISOString(),
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
