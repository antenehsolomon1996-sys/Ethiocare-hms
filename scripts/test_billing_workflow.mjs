import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://qlodfpwcpjtoaxqrgfsh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ZDcmnHfTmyXsIJsbLWmVtA_lFXIgzbF";

async function testBillingWorkflow() {
  console.log('='.repeat(80));
  console.log('ETHIOCARE HMS - BILLING WORKFLOW LIVE VERIFICATION');
  console.log('Target: ' + SUPABASE_URL);
  console.log('='.repeat(80));

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  let testOrderId = null;
  let testPaymentId = null;

  try {
    // -------------------------------------------------------------------------
    // STEP 1: DOCTOR CREATES MEDICATION ORDER & BILLING ROW
    // -------------------------------------------------------------------------
    console.log('\n[STEP 1] Authenticating Doctor (dr.selamawit@grandhorizonhospital.com)...');
    const { data: docAuth, error: docErr } = await client.auth.signInWithPassword({
      email: 'dr.selamawit@grandhorizonhospital.com',
      password: 'Hospital@2026'
    });
    if (docErr) throw new Error(`Doctor login failed: ${docErr.message}`);

    const { data: visits } = await client.from('visits').select('id, patient_id, patient_name').limit(1);
    const visit = visits[0];
    console.log(`✅ Using visit: ${visit.id} for patient: ${visit.patient_name}`);

    const receiptNum = `RCP-TEST-${Date.now().toString().slice(-6)}`;
    const { data: medOrder, error: orderErr } = await client
      .from('medication_orders')
      .insert({
        visit_id: visit.id,
        patient_id: visit.patient_id,
        patient_name: visit.patient_name,
        doctor_name: 'Dr. Selamawit Tadesse',
        doctor_id: docAuth.user.id,
        order_type: 'medicine',
        item_name: 'Ceftriaxone 1g IV (Integration Test)',
        dosage: '1g',
        frequency: 'Daily',
        duration: '3 days',
        quantity: 3,
        unit_price: 180,
        total_price: 540,
        instructions: 'Slow IV injection',
        urgency: 'urgent',
        payment_status: 'pending_payment',
        administration_status: 'awaiting_payment'
      })
      .select()
      .single();

    if (orderErr) throw new Error(`Medication order insert failed: ${orderErr.message}`);
    testOrderId = medOrder.id;
    console.log('✅ Created MedicationOrder in Supabase:');
    console.log('   ID:', testOrderId);
    console.log('   Item:', medOrder.item_name);
    console.log('   Payment Status:', medOrder.payment_status);

    const { data: pendingPay, error: payErr } = await client
      .from('payments')
      .insert({
        visit_id: visit.id,
        patient_id: visit.patient_id,
        patient_name: visit.patient_name,
        payment_type: 'medicine',
        description: 'medicine: Ceftriaxone 1g IV (1g)',
        amount: 540,
        status: 'pending',
        reference_id: testOrderId,
        reference_type: 'medication_order',
        medication_order_id: testOrderId,
        medication_name: 'Ceftriaxone 1g IV (Integration Test)',
        dosage: '1g',
        quantity: 3,
        frequency: 'Daily',
        route: 'medicine',
        order_notes: 'Slow IV injection',
        order_status: 'pending_payment'
      })
      .select()
      .single();

    if (payErr) throw new Error(`Payment row insert failed: ${payErr.message}`);
    testPaymentId = pendingPay.id;
    console.log('✅ Created linked Payment in Supabase. ID:', testPaymentId);

    await client.auth.signOut();

    // -------------------------------------------------------------------------
    // STEP 2: BILLING PORTAL (ACCOUNTANT) PROCESSES PAYMENT
    // ---------------------------------------------------------
    console.log('\n[STEP 2] Authenticating Accountant / Billing (mulugeta.k@grandhorizonhospital.com)...');
    const { data: accAuth, error: accErr } = await client.auth.signInWithPassword({
      email: 'mulugeta.k@grandhorizonhospital.com',
      password: 'Hospital@2026'
    });
    if (accErr) throw new Error(`Accountant login failed: ${accErr.message}`);
    console.log('✅ Accountant authenticated.');

    // Accountant reads pending medication orders
    const { data: accOrders, error: accFetchErr } = await client
      .from('medication_orders')
      .select('*')
      .eq('id', testOrderId)
      .single();

    if (accFetchErr) throw new Error(`Accountant cannot read medication orders: ${accFetchErr.message}`);
    console.log('✅ Billing portal fetched order:', accOrders.item_name, 'Status:', accOrders.payment_status);

    // Accountant confirms payment in Billing portal
    console.log('   Confirming payment in Billing Portal...');
    const { data: updatedPay, error: payUpdateErr } = await client
      .from('payments')
      .update({
        status: 'paid',
        payment_method: 'telebirr',
        receipt_number: receiptNum,
        cashier_name: 'Mulugeta Kebede (Billing)',
        paid_date: new Date().toISOString().split('T')[0],
        order_status: 'paid'
      })
      .eq('id', testPaymentId)
      .select()
      .single();

    if (payUpdateErr) throw new Error(`Payment update failed: ${payUpdateErr.message}`);
    console.log('✅ Payment marked as PAID in public.payments. Receipt #:', updatedPay.receipt_number);

    // Accountant updates medication order to 'paid'
    const { data: updatedMedOrder, error: medUpdateErr } = await client
      .from('medication_orders')
      .update({
        payment_status: 'paid',
        administration_status: 'pending',
        payment_id: testPaymentId,
        receipt_number: receiptNum,
        paid_by: 'Mulugeta Kebede (Billing)',
        paid_date: new Date().toISOString().split('T')[0],
        total_price: 540
      })
      .eq('id', testOrderId)
      .select()
      .single();

    if (medUpdateErr) throw new Error(`Medication order update failed: ${medUpdateErr.message}`);
    console.log('✅ Medication order marked as PAID by Billing Portal!');

    await client.auth.signOut();

    // -------------------------------------------------------------------------
    // STEP 3: NURSE PORTAL VERIFIES REALTIME AVAILABILITY FOR ADMINISTRATION
    // -------------------------------------------------------------------------
    console.log('\n[STEP 3] Authenticating Nurse (tigist.m@grandhorizonhospital.com)...');
    const { error: nurseErr } = await client.auth.signInWithPassword({
      email: 'tigist.m@grandhorizonhospital.com',
      password: 'Hospital@2026'
    });
    if (nurseErr) throw new Error(`Nurse login failed: ${nurseErr.message}`);

    const { data: nurseOrders, error: nurseFetchErr } = await client
      .from('medication_orders')
      .select('*')
      .eq('id', testOrderId)
      .eq('payment_status', 'paid');

    if (nurseFetchErr || !nurseOrders?.length) {
      throw new Error(`Nurse cannot access paid order: ${nurseFetchErr?.message}`);
    }

    console.log('✅ Nurse Portal sees paid medication order ready for administration:');
    console.log('   Order:', nurseOrders[0].item_name);
    console.log('   Payment Status:', nurseOrders[0].payment_status);
    console.log('   Administration Status:', nurseOrders[0].administration_status);
    console.log('   Receipt #:', nurseOrders[0].receipt_number);

    // Nurse marks administration as completed
    const { data: administeredOrder, error: adminErr } = await client
      .from('medication_orders')
      .update({
        administration_status: 'completed',
        administered_by: 'Sister Tigist Mengistu',
        administered_date: new Date().toISOString().split('T')[0],
        administration_notes: 'Dose administered via IV bolus. Patient tolerated well.'
      })
      .eq('id', testOrderId)
      .select()
      .single();

    if (adminErr) throw new Error(`Nurse administration update failed: ${adminErr.message}`);
    console.log('✅ Nurse successfully administered medication:');
    console.log('   Administration Status:', administeredOrder.administration_status);
    console.log('   Administered By:', administeredOrder.administered_by);

    await client.auth.signOut();

    // -------------------------------------------------------------------------
    // STEP 4: RECEPTIONIST VERIFIES SHARED LIVE DATA & RECEIPT
    // -------------------------------------------------------------------------
    console.log('\n[STEP 4] Authenticating Receptionist (almaz.t@grandhorizonhospital.com)...');
    const { error: recepErr } = await client.auth.signInWithPassword({
      email: 'almaz.t@grandhorizonhospital.com',
      password: 'Hospital@2026'
    });
    if (recepErr) throw new Error(`Receptionist login failed: ${recepErr.message}`);

    // Reception queries the shared payment and medication order
    const { data: recepPayment } = await client.from('payments').select('*').eq('id', testPaymentId).single();
    const { data: recepOrder } = await client.from('medication_orders').select('*').eq('id', testOrderId).single();

    console.log('✅ Receptionist reads shared live billing records in Reception Portal:');
    console.log('   Payment Receipt:', recepPayment.receipt_number, '| Status:', recepPayment.status, '| Amount:', recepPayment.amount);
    console.log('   Order Admin Status:', recepOrder.administration_status, '| Administered By:', recepOrder.administered_by);

    await client.auth.signOut();

    // -------------------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------------------
    console.log('\n[STEP 5] Cleaning up test records...');
    await client.auth.signInWithPassword({
      email: 'dr.selamawit@grandhorizonhospital.com',
      password: 'Hospital@2026'
    });
    await client.from('medication_orders').delete().eq('id', testOrderId);
    await client.from('payments').delete().eq('id', testPaymentId);
    console.log('✅ Cleanup completed successfully.');

    console.log('\n' + '='.repeat(80));
    console.log('🎉 BILLING & CROSS-PORTAL INTEGRATION VERIFIED SUCCESSFULLY!');
    console.log('='.repeat(80));

  } catch (err) {
    console.error('\n❌ WORKFLOW FAILED:', err.message);
    process.exit(1);
  }
}

testBillingWorkflow();
