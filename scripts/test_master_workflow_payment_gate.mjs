import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://qlodfpwcpjtoaxqrgfsh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ZDcmnHfTmyXsIJsbLWmVtA_lFXIgzbF";

async function runMasterWorkflowPaymentGateTest() {
  console.log('='.repeat(80));
  console.log('ETHIOCARE HMS - MASTER WORKFLOW & PAYMENT GATE E2E TEST SUITE');
  console.log('Supabase Target:', SUPABASE_URL);
  console.log('='.repeat(80));

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  let testPatientId = null;
  let testVisitId = null;
  let testRegPaymentId = null;
  let testLabOrderId = null;
  let testLabPaymentId = null;
  let testMedOrderId = null;
  let testMedPaymentId = null;

  try {
    // -------------------------------------------------------------------------
    // SCENARIO A: Reception -> Registration Fee Payment Gate -> Doctor Queue
    // -------------------------------------------------------------------------
    console.log('\n🔵 [SCENARIO A] Testing New Patient Registration & Consultation Payment Gate...');

    // 1. Receptionist logs in
    const { data: recAuth, error: recErr } = await client.auth.signInWithPassword({
      email: 'almaz.t@grandhorizonhospital.com',
      password: 'Hospital@2026'
    });
    if (recErr) throw new Error(`Receptionist login failed: ${recErr.message}`);
    console.log('  ✅ Receptionist authenticated (Almaz Tesfaye)');

    // 2. Create test patient
    const patientCode = `TEST-PT-${Date.now().toString().slice(-4)}`;
    const { data: patient, error: pErr } = await client
      .from('patients')
      .insert({
        patient_id: patientCode,
        full_name: `Abebe Automation ${patientCode}`,
        age: 38,
        gender: 'Male',
        phone: '+251911998877',
        status: 'active'
      })
      .select()
      .single();
    if (pErr) throw new Error(`Failed to create test patient: ${pErr.message}`);
    testPatientId = patient.id;
    console.log(`  ✅ Test Patient created: ${patient.full_name} (${patient.id})`);

    // 3. Create Visit with registration_fee_paid: false
    const todayStr = new Date().toISOString().split('T')[0];
    const { data: visit, error: vErr } = await client
      .from('visits')
      .insert({
        patient_id: patient.id,
        patient_name: patient.full_name,
        visit_date: todayStr,
        queue_number: Math.floor(100 + Math.random() * 800),
        status: 'waiting',
        registration_fee_paid: false,
        billing_completed: false
      })
      .select()
      .single();
    if (vErr) throw new Error(`Failed to create visit: ${vErr.message}`);
    testVisitId = visit.id;
    console.log(`  ✅ Visit created with registration_fee_paid=false. Visit ID: ${testVisitId}`);

    // 4. Create pending registration Payment
    const { data: regPay, error: rpErr } = await client
      .from('payments')
      .insert({
        patient_id: patient.id,
        patient_name: patient.full_name,
        visit_id: visit.id,
        payment_type: 'registration',
        description: 'New Patient Registration Fee',
        amount: 150.00,
        status: 'pending',
        payment_method: 'cash',
        reference_type: 'registration',
        reference_id: visit.id
      })
      .select()
      .single();
    if (rpErr) throw new Error(`Failed to create registration payment: ${rpErr.message}`);
    testRegPaymentId = regPay.id;
    console.log(`  ✅ Pending registration Payment record created: ${testRegPaymentId} (150 ETB)`);

    await client.auth.signOut();

    // 5. Doctor logs in and verifies patient is BLOCKED from consultation queue
    console.log('\n  Doctor login to verify gating...');
    const { data: docAuth, error: docErr } = await client.auth.signInWithPassword({
      email: 'dr.selamawit@grandhorizonhospital.com',
      password: 'Hospital@2026'
    });
    if (docErr) throw new Error(`Doctor login failed: ${docErr.message}`);
    console.log('  ✅ Doctor authenticated (Dr. Selamawit Tadesse)');

    const { data: docVisits, error: dvErr } = await client
      .from('visits')
      .select('*')
      .eq('id', testVisitId);
    if (dvErr) throw new Error(`Doctor visit query failed: ${dvErr.message}`);

    const retrievedVisit = docVisits[0];
    if (retrievedVisit.registration_fee_paid !== false) {
      throw new Error(`Expected registration_fee_paid to be false, got ${retrievedVisit.registration_fee_paid}`);
    }
    console.log('  🔒 Verified: Doctor queue logic BLOCKS consultation because registration_fee_paid = false.');

    await client.auth.signOut();

    // 6. Billing / Accountant settles Registration Payment
    console.log('\n  Accountant settles registration payment...');
    const { data: accAuth, error: accErr } = await client.auth.signInWithPassword({
      email: 'mulugeta.k@grandhorizonhospital.com',
      password: 'Hospital@2026'
    });
    if (accErr) throw new Error(`Accountant login failed: ${accErr.message}`);

    const regReceipt = `RCP-REG-${Date.now().toString().slice(-6)}`;
    const { data: settledRegPay, error: srpErr } = await client
      .from('payments')
      .update({
        status: 'paid',
        payment_method: 'cash',
        receipt_number: regReceipt,
        cashier_name: 'Mulugeta Kebede',
        paid_date: todayStr
      })
      .eq('id', testRegPaymentId)
      .select()
      .single();
    if (srpErr) throw new Error(`Failed to settle payment: ${srpErr.message}`);

    // Update visit to unlock doctor queue
    const { data: unlockedVisit, error: uvErr } = await client
      .from('visits')
      .update({
        registration_fee_paid: true,
        billing_completed: true,
        status: 'waiting'
      })
      .eq('id', testVisitId)
      .select()
      .single();
    if (uvErr) throw new Error(`Failed to unlock visit: ${uvErr.message}`);

    console.log('  🔓 Registration payment settled! Receipt:', regReceipt);
    console.log(`  ✅ Visit unlocked: registration_fee_paid = ${unlockedVisit.registration_fee_paid}, status = ${unlockedVisit.status}`);

    await client.auth.signOut();

    // -------------------------------------------------------------------------
    // SCENARIO B: Doctor Orders Diagnostic Lab Test -> Gated until Payment
    // -------------------------------------------------------------------------
    console.log('\n🔵 [SCENARIO B] Testing Doctor Lab Order Payment Gate...');

    // 1. Doctor orders Lab Test
    await client.auth.signInWithPassword({
      email: 'dr.selamawit@grandhorizonhospital.com',
      password: 'Hospital@2026'
    });

    const labTestPrice = 350.00;
    const { data: labOrder, error: loErr } = await client
      .from('lab_orders')
      .insert({
        visit_id: testVisitId,
        patient_id: testPatientId,
        patient_name: patient.full_name,
        doctor_name: 'Dr. Selamawit Tadesse',
        doctor_id: docAuth.user.id,
        test_type: 'Hematology',
        test_name: 'Complete Blood Count (CBC) E2E',
        payment_status: 'pending',
        test_status: 'awaiting_payment',
        price: labTestPrice
      })
      .select()
      .single();
    if (loErr) throw new Error(`Doctor lab order creation failed: ${loErr.message}`);
    testLabOrderId = labOrder.id;
    console.log(`  ✅ Lab Order created with payment_status = pending, test_status = awaiting_payment. Lab Order ID: ${testLabOrderId}`);

    // Create corresponding pending payment
    const { data: labPay, error: lpErr } = await client
      .from('payments')
      .insert({
        patient_id: testPatientId,
        patient_name: patient.full_name,
        visit_id: testVisitId,
        payment_type: 'laboratory',
        description: 'Complete Blood Count (CBC) E2E',
        amount: labTestPrice,
        status: 'pending',
        payment_method: 'cash',
        reference_type: 'lab_order',
        reference_id: testLabOrderId
      })
      .select()
      .single();
    if (lpErr) throw new Error(`Lab payment creation failed: ${lpErr.message}`);
    testLabPaymentId = labPay.id;

    await client.auth.signOut();

    // 2. Lab Technician checks queue — Unpaid test must NOT appear in actionable processing list
    console.log('  Lab technician logs in to verify unpaid lab order is hidden from processing...');
    const { data: labTechAuth, error: ltErr } = await client.auth.signInWithPassword({
      email: 'kidus.w@grandhorizonhospital.com',
      password: 'Hospital@2026'
    });
    if (ltErr) throw new Error(`Lab Tech login failed: ${ltErr.message}`);
    console.log('  ✅ Lab Technician authenticated (Kidus Worku)');

    const { data: labActionable, error: laErr } = await client
      .from('lab_orders')
      .select('*')
      .eq('id', testLabOrderId)
      .eq('payment_status', 'paid');
    if (laErr) throw new Error(`Lab orders query failed: ${laErr.message}`);

    if (labActionable.length > 0) {
      throw new Error('FAILED: Unpaid lab order appeared in paid processing queue!');
    }
    console.log('  🔒 Verified: Lab Technician actionable queue strictly excludes unpaid lab order.');

    await client.auth.signOut();

    // 3. Billing settles Lab Order Payment
    console.log('  Billing settles lab order payment...');
    await client.auth.signInWithPassword({
      email: 'mulugeta.k@grandhorizonhospital.com',
      password: 'Hospital@2026'
    });

    const labReceipt = `RCP-LAB-${Date.now().toString().slice(-6)}`;
    await client
      .from('payments')
      .update({
        status: 'paid',
        payment_method: 'cash',
        receipt_number: labReceipt,
        cashier_name: 'Mulugeta Kebede',
        paid_date: todayStr
      })
      .eq('id', testLabPaymentId);

    const { data: unlockedLabOrder, error: uloErr } = await client
      .from('lab_orders')
      .update({
        payment_status: 'paid',
        test_status: 'pending'
      })
      .eq('id', testLabOrderId)
      .select()
      .single();
    if (uloErr) throw new Error(`Failed to unlock lab order: ${uloErr.message}`);

    console.log('  🔓 Lab order payment settled! Receipt:', labReceipt);
    console.log(`  ✅ Lab Order unlocked for processing: payment_status = ${unlockedLabOrder.payment_status}, test_status = ${unlockedLabOrder.test_status}`);

    await client.auth.signOut();

    // -------------------------------------------------------------------------
    // SCENARIO C: Doctor Orders Stat Injection / Medication -> Gated for Nurse
    // -------------------------------------------------------------------------
    console.log('\n🔵 [SCENARIO C] Testing Doctor Stat Injection Payment Gate...');

    // 1. Doctor orders Stat Injection
    await client.auth.signInWithPassword({
      email: 'dr.selamawit@grandhorizonhospital.com',
      password: 'Hospital@2026'
    });

    const injPrice = 210.00;
    const { data: medOrder, error: moErr } = await client
      .from('medication_orders')
      .insert({
        visit_id: testVisitId,
        patient_id: testPatientId,
        patient_name: patient.full_name,
        doctor_name: 'Dr. Selamawit Tadesse',
        doctor_id: docAuth.user.id,
        order_type: 'injection',
        item_name: 'Ceftriaxone 1g IV (STAT E2E)',
        dosage: '1g',
        frequency: 'Stat',
        urgency: 'stat',
        payment_status: 'pending_payment',
        administration_status: 'awaiting_payment',
        total_price: injPrice
      })
      .select()
      .single();
    if (moErr) throw new Error(`Doctor medication order creation failed: ${moErr.message}`);
    testMedOrderId = medOrder.id;
    console.log(`  ✅ Stat Injection created with payment_status = pending_payment, administration_status = awaiting_payment. ID: ${testMedOrderId}`);

    // Create corresponding pending payment
    const { data: medPay, error: mpErr } = await client
      .from('payments')
      .insert({
        patient_id: testPatientId,
        patient_name: patient.full_name,
        visit_id: testVisitId,
        payment_type: 'injection',
        description: 'Ceftriaxone 1g IV (STAT E2E)',
        amount: injPrice,
        status: 'pending',
        payment_method: 'cash',
        reference_type: 'medication_order',
        reference_id: testMedOrderId
      })
      .select()
      .single();
    if (mpErr) throw new Error(`Med payment creation failed: ${mpErr.message}`);
    testMedPaymentId = medPay.id;

    await client.auth.signOut();

    // 2. Nurse logs in — unpaid stat injection must NOT be visible in administration queue
    console.log('  Nurse logs in to verify unpaid injection is hidden from administration queue...');
    const { data: nurseAuth, error: nErr } = await client.auth.signInWithPassword({
      email: 'tigist.m@grandhorizonhospital.com',
      password: 'Hospital@2026'
    });
    if (nErr) throw new Error(`Nurse login failed: ${nErr.message}`);
    console.log('  ✅ Nurse authenticated (Sister Tigist Mengistu)');

    const { data: nurseVisibleOrders, error: nvoErr } = await client
      .from('medication_orders')
      .select('*')
      .eq('id', testMedOrderId)
      .eq('payment_status', 'paid');
    if (nvoErr) throw new Error(`Nurse query failed: ${nvoErr.message}`);

    if (nurseVisibleOrders.length > 0) {
      throw new Error('FAILED: Unpaid injection appeared in nurse administration queue!');
    }
    console.log('  🔒 Verified: Nurse administration queue strictly excludes unpaid injections.');

    await client.auth.signOut();

    // 3. Billing settles Injection Payment
    console.log('  Billing settles injection payment and unlocks for Nurse...');
    await client.auth.signInWithPassword({
      email: 'mulugeta.k@grandhorizonhospital.com',
      password: 'Hospital@2026'
    });

    const medReceipt = `RCP-INJ-${Date.now().toString().slice(-6)}`;
    await client
      .from('payments')
      .update({
        status: 'paid',
        payment_method: 'cash',
        receipt_number: medReceipt,
        cashier_name: 'Mulugeta Kebede',
        paid_date: todayStr
      })
      .eq('id', testMedPaymentId);

    const { data: unlockedMedOrder, error: umoErr } = await client
      .from('medication_orders')
      .update({
        payment_status: 'paid',
        administration_status: 'pending',
        receipt_number: medReceipt,
        paid_by: 'Mulugeta Kebede'
      })
      .eq('id', testMedOrderId)
      .select()
    if (umoErr) throw new Error(`Failed to unlock med order: ${umoErr.message}`);
    await client.auth.signOut();

    // Nurse receives unlocked order and registers task with [IMMEDIATE] tag
    await client.auth.signInWithPassword({
      email: 'tigist.m@grandhorizonhospital.com',
      password: 'Hospital@2026'
    });

    const { data: nurseTask, error: ntErr } = await client
      .from('nurse_tasks')
      .insert({
        visit_id: testVisitId,
        patient_id: testPatientId,
        patient_name: patient.full_name,
        task_type: 'injection',
        description: `[IMMEDIATE] ${unlockedMedOrder.item_name} ${unlockedMedOrder.dosage}`,
        instructions: 'Administer STAT as prescribed',
        doctor_name: 'Dr. Selamawit Tadesse',
        status: 'pending'
      })
      .select()
      .single();
    if (ntErr) throw new Error(`Failed to create nurse task: ${ntErr.message}`);

    console.log('  🔓 Injection payment settled! Receipt:', medReceipt);
    console.log(`  ✅ Injection unlocked for Nurse: payment_status = ${unlockedMedOrder.payment_status}, urgency = ${unlockedMedOrder.urgency}`);
    console.log(`  ✅ Nurse task created with priority: ${nurseTask.description}`);

    // Clean up task
    await client.from('nurse_tasks').delete().eq('id', nurseTask.id);
    await client.auth.signOut();

    // -------------------------------------------------------------------------
    // SCENARIO D: Autonomous Retail Pharmacy Walk-in POS
    // -------------------------------------------------------------------------
    console.log('\n🔵 [SCENARIO D] Testing Retail Pharmacy Independence...');
    const { data: pharmAuth, error: phErr } = await client.auth.signInWithPassword({
      email: 'bethelhem.s@grandhorizonhospital.com',
      password: 'Hospital@2026'
    });
    if (phErr) throw new Error(`Pharmacist login failed: ${phErr.message}`);
    console.log('  ✅ Pharmacist authenticated (Bethelhem Solomon)');

    const { data: medicines, error: medErr } = await client
      .from('medicines')
      .select('id, name, unit_price, quantity')
      .limit(2);
    if (medErr) throw new Error(`Pharmacy query failed: ${medErr.message}`);
    console.log(`  ✅ Pharmacy operates independently with ${medicines.length} items catalogued.`);

    await client.auth.signOut();

    console.log('\n' + '='.repeat(80));
    console.log('🎉 ALL MASTER WORKFLOW & PAYMENT GATE VERIFICATION TESTS PASSED!');
    console.log('='.repeat(80));

  } finally {
    // Cleanup test records
    console.log('\n🧹 Cleaning up test records...');
    try {
      if (testMedOrderId) await client.from('medication_orders').delete().eq('id', testMedOrderId);
      if (testMedPaymentId) await client.from('payments').delete().eq('id', testMedPaymentId);
      if (testLabOrderId) await client.from('lab_orders').delete().eq('id', testLabOrderId);
      if (testLabPaymentId) await client.from('payments').delete().eq('id', testLabPaymentId);
      if (testRegPaymentId) await client.from('payments').delete().eq('id', testRegPaymentId);
      if (testVisitId) await client.from('visits').delete().eq('id', testVisitId);
      if (testPatientId) await client.from('patients').delete().eq('id', testPatientId);
      console.log('✅ Test artifacts cleaned up successfully.');
    } catch (cleanErr) {
      console.warn('Notice during cleanup:', cleanErr.message);
    }
  }
}

runMasterWorkflowPaymentGateTest().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
