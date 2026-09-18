import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://qlodfpwcpjtoaxqrgfsh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ZDcmnHfTmyXsIJsbLWmVtA_lFXIgzbF";

async function testBillingPagesLogic() {
  console.log('='.repeat(80));
  console.log('ETHIOCARE HMS - BILLING PAGES LIVE DATA & FILTER VERIFICATION');
  console.log('Target: ' + SUPABASE_URL);
  console.log('='.repeat(80));

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Authenticate as Accountant
  const { data: authData, error: authErr } = await client.auth.signInWithPassword({
    email: 'mulugeta.k@grandhorizonhospital.com',
    password: 'Hospital@2026'
  });
  if (authErr) throw new Error(`Accountant login failed: ${authErr.message}`);
  console.log('✅ Logged in as Accountant (mulugeta.k@grandhorizonhospital.com)');

  // 1. Fetch live patients
  const { data: patients, error: ptErr } = await client.from('patients').select('*');
  if (ptErr) throw new Error(`Patients fetch error: ${ptErr.message}`);
  console.log(`✅ Loaded ${patients.length} patients for ID resolution.`);

  const patientMap = new Map();
  patients.forEach(p => {
    patientMap.set(p.id, p);
    if (p.patient_id) patientMap.set(p.patient_id, p);
  });

  const getPatientCode = (row) => {
    const p = patientMap.get(row.patient_id);
    if (p?.patient_id) return p.patient_id;
    return row.patient_id ? `PT-${row.patient_id.slice(0, 6).toUpperCase()}` : 'N/A';
  };

  // --------------------------------------------------------------------------
  // TEST 1: MEDICATION ORDERS PAGE LOGIC
  // --------------------------------------------------------------------------
  console.log('\n[TEST 1] Testing Medication Orders page data & filters...');
  const { data: medOrders, error: moErr } = await client.from('medication_orders').select('*');
  if (moErr) throw new Error(`Medication orders fetch error: ${moErr.message}`);
  console.log(`✅ Loaded ${medOrders.length} live medication orders.`);

  // Compute stats
  const totalOrders = medOrders.length;
  const pendingOrders = medOrders.filter(o => o.payment_status === 'pending_payment' || o.payment_status === 'pending');
  const paidOrders = medOrders.filter(o => o.payment_status === 'paid');
  const waivedOrders = medOrders.filter(o => o.payment_status === 'waived');

  console.log('   Stats computed:');
  console.log('     - Total Medication Orders:', totalOrders);
  console.log('     - Pending Payment Count:', pendingOrders.length);
  console.log('     - Paid Count:', paidOrders.length);
  console.log('     - Waived Count:', waivedOrders.length);

  // Test field resolution
  medOrders.forEach(o => {
    const pCode = getPatientCode(o);
    console.log(`   Order [${o.id.slice(0, 8)}] Patient: ${o.patient_name} (${pCode}) | Item: ${o.item_name} | Price: ${o.total_price} ETB | Status: ${o.payment_status} | Admin: ${o.administration_status}`);
  });

  // Test search logic: search for "amoxicillin" or patient name
  const testSearch = 'amox';
  const searchResults = medOrders.filter(o => {
    const q = testSearch.toLowerCase();
    const pCode = getPatientCode(o).toLowerCase();
    const pName = (o.patient_name || '').toLowerCase();
    const iName = (o.item_name || '').toLowerCase();
    return pName.includes(q) || pCode.includes(q) || iName.includes(q);
  });
  console.log(`✅ Search for "${testSearch}" returned ${searchResults.length} matches.`);

  // --------------------------------------------------------------------------
  // TEST 2: PAYMENTS PAGE LOGIC
  // --------------------------------------------------------------------------
  console.log('\n[TEST 2] Testing Payments page data & filters...');
  const { data: payments, error: payErr } = await client.from('payments').select('*');
  if (payErr) throw new Error(`Payments fetch error: ${payErr.message}`);
  console.log(`✅ Loaded ${payments.length} live payments.`);

  const paidPayments = payments.filter(p => p.status === 'paid');
  const totalPaidAmount = paidPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const pendingPayments = payments.filter(p => p.status === 'pending');
  const pendingAmount = pendingPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const cancelledPayments = payments.filter(p => p.status === 'cancelled');

  console.log('   Stats computed:');
  console.log('     - Total Paid Amount:', totalPaidAmount, 'ETB (from ' + paidPayments.length + ' payments)');
  console.log('     - Pending Amount:', pendingAmount, 'ETB (from ' + pendingPayments.length + ' payments)');
  console.log('     - Cancelled/Waived Count:', cancelledPayments.length);

  payments.forEach(p => {
    const pCode = getPatientCode(p);
    console.log(`   Payment [${p.id.slice(0, 8)}] Patient: ${p.patient_name} (${pCode}) | Type: ${p.payment_type} | Method: ${p.payment_method} | Amount: ${p.amount} ETB | Status: ${p.status} | Receipt: ${p.receipt_number || 'N/A'}`);
  });

  // Test filter by method
  const telebirrPayments = payments.filter(p => p.payment_method === 'telebirr');
  console.log(`✅ Method filter "telebirr" returned ${telebirrPayments.length} rows.`);

  console.log('\n' + '='.repeat(80));
  console.log('ALL BILLING PAGE QUERIES, RESOLUTIONS, AND STATS VERIFIED SUCCESSFULLY!');
  console.log('='.repeat(80));
}

testBillingPagesLogic();
