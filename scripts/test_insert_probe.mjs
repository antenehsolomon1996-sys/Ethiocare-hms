import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://qlodfpwcpjtoaxqrgfsh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ZDcmnHfTmyXsIJsbLWmVtA_lFXIgzbF";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function probe() {
  console.log('Testing insert into patients:');
  const res = await supabase.from('patients').insert({
    patient_id: 'PT-TEST-001',
    full_name: 'Test Patient',
    gender: 'Male',
    age: 30,
    phone: '+251911223344'
  }).select('*');
  console.log('Patient insert result:', JSON.stringify(res, null, 2));

  console.log('Testing select on doctors:');
  const docRes = await supabase.from('doctors').select('*');
  console.log('Doctors select result:', JSON.stringify(docRes, null, 2));
}

probe();
