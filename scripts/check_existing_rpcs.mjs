import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://qlodfpwcpjtoaxqrgfsh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ZDcmnHfTmyXsIJsbLWmVtA_lFXIgzbF";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkRpc() {
  const rpcs = ['is_admin', 'handle_new_user', 'generate_patient_id', 'generate_invoice_number', 'generate_lab_order_number', 'generate_medication_order_number'];
  for (const rpc of rpcs) {
    const { data, error } = await supabase.rpc(rpc, {});
    console.log(`RPC ${rpc}:`, { data, error: error?.message });
  }
}

checkRpc();
