import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://qlodfpwcpjtoaxqrgfsh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ZDcmnHfTmyXsIJsbLWmVtA_lFXIgzbF";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testRpc() {
  const { data, error } = await supabase.rpc('verify_staff_login', {
    p_email: 'dr.selamawit@grandhorizonhospital.com',
    p_credential: 'HMS-DOC1-2026',
    p_target_portal: 'doctor'
  });
  console.log('verify_staff_login result:', { data, error });
}

testRpc();
