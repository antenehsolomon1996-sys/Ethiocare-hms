import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://qlodfpwcpjtoaxqrgfsh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ZDcmnHfTmyXsIJsbLWmVtA_lFXIgzbF";

async function testLabSubmissionWorkflow() {
  console.log('='.repeat(80));
  console.log('ETHIOCARE HMS - LAB PORTAL SUBMISSION WORKFLOW INTEGRATION TEST');
  console.log('Supabase Target: ' + SUPABASE_URL);
  console.log('='.repeat(80));

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  let testOrderId = null;

  try {
    // -------------------------------------------------------------------------
    // STEP 1: AUTHENTICATE AS LAB TECHNICIAN
    // -------------------------------------------------------------------------
    console.log('\n[STEP 1] Authenticating as Lab Technician (kidus.w@grandhorizonhospital.com)...');
    const { data: authData, error: authErr } = await client.auth.signInWithPassword({
      email: 'kidus.w@grandhorizonhospital.com',
      password: 'Hospital@2026'
    });

    if (authErr) throw new Error(`Lab Technician login failed: ${authErr.message}`);
    console.log('✅ Lab Technician authenticated. UID:', authData.user.id);

    // Verify staff profile role
    const { data: profile, error: profErr } = await client
      .from('profiles')
      .select('id, email, role, full_name')
      .eq('id', authData.user.id)
      .single();

    if (profErr) throw new Error(`Failed to fetch Lab profile: ${profErr.message}`);
    console.log('✅ Verified Staff Profile:', profile);
    if (profile.role !== 'lab_technician') {
      throw new Error(`Expected role 'lab_technician', got '${profile.role}'`);
    }

    // -------------------------------------------------------------------------
    // STEP 2: DISCOVER OR PREPARE A LAB ORDER LINKED TO A VISIT
    // -------------------------------------------------------------------------
    console.log('\n[STEP 2] Querying lab orders accessible to Lab Technician...');
    const { data: orders, error: oErr } = await client
      .from('lab_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (oErr) throw new Error(`Failed to query lab orders: ${oErr.message}`);
    console.log(`✅ Retrieved ${orders.length} lab orders.`);

    let targetOrder = orders.find(o => o.visit_id);
    if (!targetOrder && orders.length > 0) {
      targetOrder = orders[0];
    }

    if (!targetOrder) {
      throw new Error('No existing lab orders found in database to test.');
    }

    testOrderId = targetOrder.id;
    console.log(`✅ Using Lab Order: ${targetOrder.id} (Patient: ${targetOrder.patient_name}, Visit: ${targetOrder.visit_id})`);

    // Verify linked visit exists and is readable by Lab Technician
    if (targetOrder.visit_id) {
      const { data: visitData, error: vErr } = await client
        .from('visits')
        .select('id, patient_name, status')
        .eq('id', targetOrder.visit_id)
        .maybeSingle();

      if (vErr) {
        console.warn('⚠️ Visit lookup returned error:', vErr.message);
      } else if (visitData) {
        console.log(`✅ Linked visit verified: ${visitData.id} (Patient: ${visitData.patient_name}, Status: ${visitData.status})`);
      }
    }

    // -------------------------------------------------------------------------
    // STEP 3: EXECUTE LAB WORKFLOW — START TEST (IN_PROGRESS)
    // -------------------------------------------------------------------------
    console.log('\n[STEP 3] Executing Start Test (test_status -> in_progress)...');
    const { data: startedOrder, error: startErr } = await client
      .from('lab_orders')
      .update({ test_status: 'in_progress' })
      .eq('id', testOrderId)
      .select()
      .single();

    if (startErr) throw new Error(`Failed to update test_status to in_progress: ${startErr.message}`);
    console.log('✅ Lab order status updated to in_progress.');

    // -------------------------------------------------------------------------
    // STEP 4: EXECUTE LAB WORKFLOW — SUBMIT DIAGNOSTIC RESULTS (COMPLETED)
    // -------------------------------------------------------------------------
    console.log('\n[STEP 4] Executing Submit Results (test_status -> completed, with results)...');
    const testResultsText = 'Hemoglobin: 14.2 g/dL (Normal). WBC: 6,800 /mcL (Normal). Platelets: 245,000 /mcL (Normal). Automated E2E verification.';
    const testNotesText = 'Specimen processed successfully. No cellular abnormalities noted.';
    const todayStr = new Date().toISOString().split('T')[0];

    const { data: completedOrder, error: compErr } = await client
      .from('lab_orders')
      .update({
        test_status: 'completed',
        results: testResultsText,
        result_notes: testNotesText,
        completed_date: todayStr
      })
      .eq('id', testOrderId)
      .select()
      .single();

    if (compErr) throw new Error(`Failed to submit lab results: ${compErr.message}`);
    console.log('✅ Lab results submitted successfully!');
    console.log('   Test Status:', completedOrder.test_status);
    console.log('   Completed Date:', completedOrder.completed_date);
    console.log('   Results:', completedOrder.results);

    // -------------------------------------------------------------------------
    // STEP 5: VERIFY DOCTOR CAN INSPECT THE SUBMITTED LAB RESULTS
    // -------------------------------------------------------------------------
    console.log('\n[STEP 5] Verifying Doctor portal visibility...');
    await client.auth.signOut();

    const { error: docLoginErr } = await client.auth.signInWithPassword({
      email: 'dr.selamawit@grandhorizonhospital.com',
      password: 'Hospital@2026'
    });
    if (docLoginErr) throw new Error(`Doctor login failed: ${docLoginErr.message}`);

    const { data: docOrders, error: docOErr } = await client
      .from('lab_orders')
      .select('id, test_status, results, completed_date')
      .eq('id', testOrderId)
      .single();

    if (docOErr) throw new Error(`Doctor failed to read lab order: ${docOErr.message}`);
    if (docOrders.test_status !== 'completed' || !docOrders.results) {
      throw new Error(`Doctor view does not show completed results: ${JSON.stringify(docOrders)}`);
    }
    console.log('✅ Doctor successfully retrieved completed lab results from database!');

    // -------------------------------------------------------------------------
    // STEP 6: VERIFY RECEPTION & BILLING WORKFLOWS UNAFFECTED
    // -------------------------------------------------------------------------
    console.log('\n[STEP 6] Verifying Reception & Billing workflows remain functional...');
    await client.auth.signOut();

    // Receptionist check
    const { error: recLoginErr } = await client.auth.signInWithPassword({
      email: 'almaz.t@grandhorizonhospital.com',
      password: 'Hospital@2026'
    });
    if (recLoginErr) throw new Error(`Reception login failed: ${recLoginErr.message}`);
    const { count: patientCount, error: patErr } = await client
      .from('patients')
      .select('*', { count: 'exact', head: true });
    if (patErr) throw new Error(`Receptionist query failed: ${patErr.message}`);
    console.log(`✅ Receptionist verified active. Total registered patients: ${patientCount}`);

    await client.auth.signOut();

    // Billing check
    const { error: billLoginErr } = await client.auth.signInWithPassword({
      email: 'mulugeta.k@grandhorizonhospital.com',
      password: 'Hospital@2026'
    });
    if (billLoginErr) throw new Error(`Billing login failed: ${billLoginErr.message}`);
    const { count: paymentCount, error: payErr } = await client
      .from('payments')
      .select('*', { count: 'exact', head: true });
    if (payErr) throw new Error(`Billing query failed: ${payErr.message}`);
    console.log(`✅ Billing/Accountant verified active. Total payment records: ${paymentCount}`);

    console.log('\n' + '='.repeat(80));
    console.log('ALL LAB WORKFLOW VERIFICATIONS PASSED SUCCESSFULLY!');
    console.log('='.repeat(80));

  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.message);
    process.exit(1);
  } finally {
    await client.auth.signOut();
  }
}

testLabSubmissionWorkflow();
