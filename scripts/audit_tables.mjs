import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://qlodfpwcpjtoaxqrgfsh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ZDcmnHfTmyXsIJsbLWmVtA_lFXIgzbF";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const tables = [
  'patients',
  'visits',
  'vitals',
  'nurse_tasks',
  'lab_orders',
  'lab_tests',
  'medicines',
  'medication_orders',
  'prescriptions',
  'payments',
  'patient_history',
  'services',
  'doctors',
  'staff',
  'profiles'
];

async function checkAllTables() {
  console.log('=== Checking Read Access for anon ===');
  for (const table of tables) {
    const { data, error, count } = await supabase.from(table).select('*', { count: 'exact' }).limit(1);
    if (error) {
      console.log(`❌ ${table}: ERROR ${error.code} - ${error.message}`);
    } else {
      console.log(`✅ ${table}: SUCCESS (count: ${count}, rows returned: ${data?.length})`);
    }
  }
}

checkAllTables();
