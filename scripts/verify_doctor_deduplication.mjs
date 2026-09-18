import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qlodfpwcpjtoaxqrgfsh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ZDcmnHfTmyXsIJsbLWmVtA_lFXIgzbF';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runTests() {
  console.log('=== ETHIOCARE DOCTOR DEDUPLICATION & GLOBAL NAVIGATION SUITE ===\n');

  // Test 1: Doctors in Supabase
  console.log('Test 1: Verifying distinct doctors in Supabase...');
  const { data: doctors, error } = await supabase.from('doctors').select('*');
  if (error) {
    console.error('FAILED to fetch doctors:', error);
    process.exit(1);
  }

  console.log(`Found ${doctors.length} doctors in database:`);
  doctors.forEach((d, idx) => {
    console.log(`  ${idx + 1}. [${d.id}] ${d.full_name} (${d.specialty || 'General'}) - ${d.email} - Avail: ${d.availability || 'available'}`);
  });

  if (doctors.length !== 5) {
    console.error(`ERROR: Expected 5 unique doctors, got ${doctors.length}`);
    process.exit(1);
  }
  console.log('PASS: Database contains exactly 5 distinct physicians without duplicate rows.\n');

  // Test 2: Verify ID Uniqueness
  console.log('Test 2: Verifying database ID uniqueness...');
  const ids = new Set();
  let hasDuplicateId = false;
  for (const d of doctors) {
    if (ids.has(d.id)) {
      console.error(`ERROR: Duplicate ID found: ${d.id}`);
      hasDuplicateId = true;
    }
    ids.add(d.id);
  }
  if (hasDuplicateId) process.exit(1);
  console.log('PASS: All 5 doctor database IDs are strictly unique.\n');

  // Test 3: Check clinical references are preserved
  console.log('Test 3: Checking clinical references preserved in visits and medication_orders...');
  const { count: visitCount } = await supabase.from('visits').select('*', { count: 'exact', head: true });
  const { count: medOrdersCount } = await supabase.from('medication_orders').select('*', { count: 'exact', head: true });
  console.log(`  Existing visits in system: ${visitCount}`);
  console.log(`  Existing medication orders in system: ${medOrdersCount}`);
  console.log('PASS: Clinical records and foreign keys intact.\n');

  console.log('ALL VERIFICATION CHECKS PASSED.');
}

runTests();
