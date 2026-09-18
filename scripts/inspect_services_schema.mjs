import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://qlodfpwcpjtoaxqrgfsh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ZDcmnHfTmyXsIJsbLWmVtA_lFXIgzbF";

async function inspect() {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await client.auth.signInWithPassword({
    email: 'admin@grandhorizonhospital.com',
    password: 'Hospital@2026'
  });

  const { data: services } = await client.from('services').select('*').limit(5);
  console.log('Services sample columns:', Object.keys(services[0] || {}));
  console.log('Services sample data:', services.slice(0, 3));

  const { data: allServices } = await client.from('services').select('category');
  const cats = [...new Set(allServices.map(s => s.category))];
  console.log('Distinct service categories:', cats);

  const { data: labTests } = await client.from('lab_tests').select('*').limit(3);
  console.log('Lab tests sample columns:', Object.keys(labTests[0] || {}));
  console.log('Lab tests sample data:', labTests.slice(0, 2));

  const { data: meds } = await client.from('medicines').select('*').limit(3);
  console.log('Medicines sample columns:', Object.keys(meds[0] || {}));
  console.log('Medicines sample data:', meds.slice(0, 2));
}

inspect();
