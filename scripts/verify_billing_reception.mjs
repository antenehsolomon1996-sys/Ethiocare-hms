import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://qlodfpwcpjtoaxqrgfsh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ZDcmnHfTmyXsIJsbLWmVtA_lFXIgzbF";

async function runBillingReceptionVerification() {
  console.log('='.repeat(80));
  console.log('ETHIOCARE HMS - BILLING & RECEPTION END-TO-END INTEGRATION TEST');
  console.log('Supabase Target: ' + SUPABASE_URL);
  console.log('='.repeat(80));

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  let testMedOrderId = null;
  let testPaymentId = null;

  try {
    // ---------------------------------------------------------
    // STEP 1: DOCTOR AUTHENTICATION & PATIENT / VISIT DISCOVERY
    // ---------------------------------------------------------
    console.log('\n[STEP 1] Doctor login (dr.selamawit@grandhorizonhospital.com)...');
    const { data: docAuth, error: docAuthErr } = await client.auth.signInWithPassword({
      email: 'dr.selamawit@grandhorizonhospital.com',
      password: 'Hospital@2026'
    });
    if (docAuthErr) throw new Error(`Doctor login failed: ${docAuthErr.message}`);
    console.log('✅ Doctor authenticated. UID:', docAuth.user.id);

    // Fetch existing active visit
    const { data: visits, error: vErr } = await client
      .from('visits')
      .select('id, patient_id, patient_name, status')
      .limit(1);

    if (vErr || !visits?.length) throw new Error(`Failed to find active visit: ${vErr?.message}`);
    const visit = visits[0];
    console.log(`✅ Using active visit ID: ${visit.id} (Patient: ${visit.patient_name})`);

    // ---------------------------------------------------------
    // STEP 2: DOCTOR CREATES MEDICATION ORDER
    // ---------------------------------------------------------
    console.log('\n[STEP 2] Doctor creating medication order with payment_status = pending_payment...');
    const unitPrice = 125.00;
    const qty = 2;
    const totalAmount = unitPrice * qty;

    const { data: medOrder, error: medOrderErr } = await client
      .from('medication_orders')
      .insert({
        visit_id: visit.id,
        patient_id: visit.patient_id,
        patient_name: visit.patient_name,
        doctor_name: 'Dr. Selamawit Tadesse',
        doctor_id: docAuth.user.id,
        order_type: 'medicine',
        item_name: 'Amoxicillin 500mg (E2E Test)',
        dosage: '500mg',
        frequency: 'TID',
        duration: '5 days',
        quantity: qty,
        unit_price: unitPrice,
        total_price: totalAmount,
        instructions: 'Take 1 capsule three times daily after meals',
        urgency: 'routine',
        notes: 'End-to-end integration test order',
        payment_status: 'pending_payment',
        administration_status: 'awaiting_payment'
      })
      .select()
      .single();

    if (medOrderErr) throw new Error(`Medication order insert failed: ${medOrderErr.message}`);
    testMedOrderId = medOrder.id;
    console.log('✅ Medication order created successfully!');
    console.log('   Order ID:', testMedOrderId);
    console.log('   Item:', medOrder.item_name);
    console.log('   Total Price:', medOrder.total_price);
    console.log('   Payment Status:', medOrder.payment_status);

    // Also create initial pending payment record (same as Doctor MedicationOrderForm does)
    const { data: pendingPay, error: pendingPayErr } = await client
      .from('payments')
      .insert({
        visit_id: visit.id,
        patient_id: visit.patient_id,
        patient_name: visit.patient_name,
        payment_type: 'medicine',
        description: `medicine: Amoxicillin 500mg (E2E Test) (500mg)`,
        amount: totalAmount,
        status: 'pending',
        reference_id: testMedOrderId,
        reference_type: 'medication_order',
        medication_order_id: testMedOrderId,
        medication_name: 'Amoxicillin 500mg (E2E Test)',
        dosage: '500mg',
        quantity: qty,
        frequency: 'TID',
        route: 'medicine',
        order_notes: 'Take 1 capsule three times daily after meals',
        order_status: 'pending_payment'
      })
      .select()
      .single();

    if (pendingPayErr) throw new Error(`Initial payment record insert failed: ${pendingPayErr.message}`);
    testPaymentId = pendingPay.id;
    console.log('✅ Pending payment record created in public.payments. ID:', testPaymentId);

    await client.auth.signOut();

    // ---------------------------------------------------------
    // STEP 3: RECEPTIONIST PROCESSES BILLING & PAYMENT
    // ---------------------------------------------------------
    console.log('\n[STEP 3] Receptionist login (almaz.t@grandhorizonhospital.com)...');
    const { data: recepAuth, error: recepAuthErr } = await client.auth.signInWithPassword({
      email: 'almaz.t@grandhorizonhospital.com',
      password: 'Hospital@2026'
    });
    if (recepAuthErr) throw new Error(`Receptionist login failed: ${recepAuthErr.message}`);
    console.log('✅ Receptionist authenticated. UID:', recepAuth.user.id);

    // Reception queries pending medication orders
    console.log('   Querying pending medication orders in Reception Billing desk...');
    const { data: pendingOrders, error: pendingErr } = await client
      .from('medication_orders')
      .select('*')
      .eq('id', testMedOrderId)
      .single();

    if (pendingErr) throw new Error(`Receptionist cannot read medication orders: ${pendingErr.message}`);
    console.log('✅ Receptionist verified pending order:', pendingOrders.item_name, '| Status:', pendingOrders.payment_status);

    // Receptionist confirms and completes payment
    const receiptNum = `RCP-REC-${Date.now().toString().slice(-6)}`;
    console.log(`   Recording payment with receipt #${receiptNum}...`);

    const { data: updatedPay, error: updatePayErr } = await client
      .from('payments')
      .update({
        status: 'paid',
        payment_method: 'telebirr',
        receipt_number: receiptNum,
        cashier_name: 'Almaz Tesfaye (Reception)',
        paid_date: new Date().toISOString().split('T')[0],
        order_status: 'paid'
      })
      .eq('id', testPaymentId)
      .select()
      .single();

    if (updatePayErr) throw new Error(`Receptionist payment update failed: ${updatePayErr.message}`);
    console.log('✅ Payment status updated to completed in public.payments!');
    console.log('   Receipt Number:', updatedPay.receipt_number);
    console.log('   Payment Method:', updatedPay.payment_method);
    console.log('   Cashier:', updatedPay.cashier_name);

    // Receptionist updates medication_orders to 'paid' and 'pending' administration
    console.log('   Updating medication_orders payment_status to paid...');
    const { data: updatedMedOrder, error: updateMedErr } = await client
      .from('medication_orders')
      .update({
        payment_status: 'paid',
        administration_status: 'pending',
        payment_id: testPaymentId,
        receipt_number: receiptNum,
        paid_by: 'Almaz Tesfaye (Reception)',
        paid_date: new Date().toISOString().split('T')[0],
        total_price: totalAmount
      })
      .eq('id', testMedOrderId)
      .select()
      .single();

    if (updateMedErr) throw new Error(`Receptionist medication_orders update failed: ${updateMedErr.message}`);
    console.log('✅ Medication order payment_status updated to PAID by Receptionist!');
    console.log('   Administration Status:', updatedMedOrder.administration_status);

    await client.auth.signOut();

    // ---------------------------------------------------------
    // STEP 4: ACCOUNTANT (BILLING PORTAL) VERIFIES SHARED DATA
    // ---------------------------------------------------------
    console.log('\n[STEP 4] Accountant login (mulugeta.k@grandhorizonhospital.com)...');
    const { data: accAuth, error: accAuthErr } = await client.auth.signInWithPassword({
      email: 'mulugeta.k@grandhorizonhospital.com',
      password: 'Hospital@2026'
    });
    if (accAuthErr) throw new Error(`Accountant login failed: ${accAuthErr.message}`);
    console.log('✅ Accountant authenticated. UID:', accAuth.user.id);

    // Accountant reads the exact same medication order
    console.log('   Accountant reading medication orders in Billing Portal...');
    const { data: accMedOrder, error: accMedErr } = await client
      .from('medication_orders')
      .select('*')
      .eq('id', testMedOrderId)
      .single();

    if (accMedErr) throw new Error(`Accountant failed to read medication order: ${accMedErr.message}`);
    console.log('✅ Accountant sees shared updated medication order:');
    console.log('   Payment Status:', accMedOrder.payment_status);
    console.log('   Receipt #:', accMedOrder.receipt_number);
    console.log('   Paid By:', accMedOrder.paid_by);

    // Accountant reads the payment record created/updated by Receptionist
    console.log('   Accountant reading payments list in Billing Portal...');
    const { data: accPayment, error: accPayErr } = await client
      .from('payments')
      .select('*')
      .eq('id', testPaymentId)
      .single();

    if (accPayErr) throw new Error(`Accountant failed to read payment record: ${accPayErr.message}`);
    console.log('✅ Accountant sees shared payment record in public.payments:');
    console.log('   Receipt #:', accPayment.receipt_number);
    console.log('   Amount:', accPayment.amount);
    console.log('   Status:', accPayment.status);
    console.log('   Cashier:', accPayment.cashier_name);

    await client.auth.signOut();

    // ---------------------------------------------------------
    // STEP 5: NURSE PORTAL VERIFIES ORDER IS READY FOR ADMINISTRATION
    // ---------------------------------------------------------
    console.log('\n[STEP 5] Nurse login (tigist.m@grandhorizonhospital.com)...');
    const { data: nurseAuth, error: nurseAuthErr } = await client.auth.signInWithPassword({
      email: 'tigist.m@grandhorizonhospital.com',
      password: 'Hospital@2026'
    });
    if (nurseAuthErr) throw new Error(`Nurse login failed: ${nurseAuthErr.message}`);
    console.log('✅ Nurse authenticated. UID:', nurseAuth.user.id);

    const { data: nurseVisibleOrders, error: nurseOrderErr } = await client
      .from('medication_orders')
      .select('*')
      .eq('id', testMedOrderId)
      .eq('payment_status', 'paid');

    if (nurseOrderErr || !nurseVisibleOrders?.length) {
      throw new Error(`Nurse cannot see paid order: ${nurseOrderErr?.message}`);
    }
    console.log('✅ Nurse successfully retrieved paid medication order ready for administration!');
    console.log('   Order ID:', nurseVisibleOrders[0].id);
    console.log('   Item Name:', nurseVisibleOrders[0].item_name);
    console.log('   Payment Status:', nurseVisibleOrders[0].payment_status);
    console.log('   Administration Status:', nurseVisibleOrders[0].administration_status);

    await client.auth.signOut();

    // ---------------------------------------------------------
    // CLEANUP
    // ---------------------------------------------------------
    console.log('\n[STEP 6] Cleaning up test order & payment...');
    await client.auth.signInWithPassword({
      email: 'dr.selamawit@grandhorizonhospital.com',
      password: 'Hospital@2026'
    });
    await client.from('medication_orders').delete().eq('id', testMedOrderId);
    await client.from('payments').delete().eq('id', testPaymentId);
    console.log('✅ Cleanup completed.');

    console.log('\n' + '='.repeat(80));
    console.log('ALL VERIFICATIONS PASSED: BILLING & RECEPTION INTEGRATION FULLY OPERATIONAL!');
    console.log('='.repeat(80));
  } catch (err) {
    console.error('\n❌ VERIFICATION FAILED:', err.message);
    process.exit(1);
  }
}

runBillingReceptionVerification();
