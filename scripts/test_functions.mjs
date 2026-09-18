import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://qlodfpwcpjtoaxqrgfsh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ZDcmnHfTmyXsIJsbLWmVtA_lFXIgzbF";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkFunction() {
  const res = await supabase.functions.invoke('hospital-stats');
  console.log('hospital-stats function result:', res);
}

checkFunction();
