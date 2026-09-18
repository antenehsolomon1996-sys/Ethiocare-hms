import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://qlodfpwcpjtoaxqrgfsh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ZDcmnHfTmyXsIJsbLWmVtA_lFXIgzbF";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper for test reporting
const results = [];
function report(portal, entity, action, status, details = '') {
  results.push({ portal, entity, action, status, details });
  const icon = status === 'SUCCESS' ? 'PASS' : 'FAIL';
  console.log(`[${icon}] ${portal.padEnd(10)} | ${entity.padEnd(16)} | ${action.padEnd(20)} | ${status} ${details ? `(${details})` : ''}`);
}

async function runVerification() {
  console.log('='.repeat(80));
  console.log('ETHIOCARE HMS - LIVE DATABASE CRUD VERIFICATION');
  console.log('Target: ' + SUPABASE_URL);
  console.log('='.repeat(80));

  let testPatientId = null;
  let testVisitId = null;
  let testLabOrderId = null;
  let testPrescriptionId = null;
  let testMedOrderId = null;
  let testPaymentId = null;
  let testServiceId = null;
  let testLabTestId = null;

  // --------------------------------------------------------------------------
  // 1. RECEPTION PORTAL: Patient Registration & Visit Queueing
  // --------------------------------------------------------------------------
  try {
    const pIdStr = `PT-${Date.now().toString().slice(-6)}`;
    const { data: patient, error: pErr } = await supabase.from('patients').insert({
      patient_id: pIdStr,
      full_name: 'Abebe Bikila Test',
      gender: 'Male',
      age: 32,
      phone: '+251911002233',
      address: 'Addis Ababa, Bole',
      emergency_contact_name: 'Almaz Test',
      emergency_contact_phone: '+251922334455',
      status: 'active'
    }).select().single();

    if (pErr) throw pErr;
    testPatientId = patient.id;
    report('Reception', 'patients', 'Create Patient', 'SUCCESS', `ID: ${patient.patient_id}`);

    // Create Visit
    const today = new Date().toISOString().split('T')[0];
    const { data: visit, error: vErr } = await supabase.from('visits').insert({
      patient_id: patient.id,
      patient_name: patient.full_name,
      visit_date: today,
      queue_number: 99,
      status: 'waiting',
      symptoms: 'Mild headache and persistent fever'
    }).select().single();

    if (vErr) throw vErr;
    testVisitId = visit.id;
    report('Reception', 'visits', 'Create Visit (Queue)', 'SUCCESS', `Queue #${visit.queue_number}`);
  } catch (err) {
    report('Reception', 'patients/visits', 'Create Record', 'FAIL', err.message || JSON.stringify(err));
  }

  // --------------------------------------------------------------------------
  // 2. NURSE PORTAL: Record Vitals & Nurse Tasks
  // --------------------------------------------------------------------------
  if (testVisitId && testPatientId) {
    try {
      const { data: vitals, error: vitErr } = await supabase.from('vitals').insert({
        visit_id: testVisitId,
        patient_id: testPatientId,
        patient_name: 'Abebe Bikila Test',
        temperature: 37.8,
        blood_pressure_systolic: 120,
        blood_pressure_diastolic: 80,
        pulse: 76,
        oxygen_level: 98,
        weight: 70,
        height: 175,
        nurse_notes: 'Patient alert and oriented',
        recorded_by: 'Sister Bethlehem'
      }).select().single();

      if (vitErr) throw vitErr;
      report('Nurse', 'vitals', 'Record Vitals', 'SUCCESS', `BP: 120/80, Temp: 37.8`);
    } catch (err) {
      report('Nurse', 'vitals', 'Record Vitals', 'FAIL', err.message);
    }
  }

  // --------------------------------------------------------------------------
  // 3. DOCTOR PORTAL: Consultation, Lab Order, Prescription, Medication Order
  // --------------------------------------------------------------------------
  if (testVisitId && testPatientId) {
    try {
      // Update Visit examination
      const { error: examErr } = await supabase.from('visits').update({
        status: 'with_doctor',
        diagnosis: 'Acute Upper Respiratory Infection',
        symptoms: 'Fever, cough, malaise',
        physical_examination: 'Clear chest sounds, mild pharyngeal erythema',
        doctor_notes: 'Hydration advised. Lab order submitted.'
      }).eq('id', testVisitId);

      if (examErr) throw examErr;
      report('Doctor', 'visits', 'Consultation Exam', 'SUCCESS');

      // Create Lab Order
      const { data: labOrder, error: loErr } = await supabase.from('lab_orders').insert({
        visit_id: testVisitId,
        patient_id: testPatientId,
        patient_name: 'Abebe Bikila Test',
        test_type: 'CBC',
        test_name: 'Complete Blood Count',
        urgency: 'routine',
        clinical_indication: 'Rule out bacterial infection',
        test_status: 'ordered',
        payment_status: 'paid'
      }).select().single();

      if (loErr) throw loErr;
      testLabOrderId = labOrder.id;
      report('Doctor', 'lab_orders', 'Order Lab Test', 'SUCCESS', `Test: ${labOrder.test_type}`);

      // Create Prescription
      const { data: rx, error: rxErr } = await supabase.from('prescriptions').insert({
        visit_id: testVisitId,
        patient_id: testPatientId,
        patient_name: 'Abebe Bikila Test',
        medicine_name: 'Amoxicillin 500mg',
        dosage: '500mg',
        frequency: 'Three times daily',
        duration: '5 days',
        quantity: 15,
        status: 'pending',
        instructions: 'Take with food'
      }).select().single();

      if (rxErr) throw rxErr;
      testPrescriptionId = rx.id;
      report('Doctor', 'prescriptions', 'Prescribe Medicine', 'SUCCESS', rx.medicine_name);

      // Create Medication Order (Nurse administration)
      const { data: medOrder, error: moErr } = await supabase.from('medication_orders').insert({
        visit_id: testVisitId,
        patient_id: testPatientId,
        patient_name: 'Abebe Bikila Test',
        order_type: 'medicine',
        item_name: 'Paracetamol IV 1g',
        dosage: '1g',
        frequency: 'Once',
        urgency: 'routine',
        payment_status: 'pending_payment',
        administration_status: 'awaiting_payment'
      }).select().single();

      if (moErr) throw moErr;
      testMedOrderId = medOrder.id;
      report('Doctor', 'medication_orders', 'Nurse Med Order', 'SUCCESS', medOrder.item_name);
    } catch (err) {
      report('Doctor', 'orders', 'Doctor Operations', 'FAIL', err.message);
    }
  }

  // --------------------------------------------------------------------------
  // 4. LAB PORTAL: Process Order & Submit Results
  // --------------------------------------------------------------------------
  if (testLabOrderId) {
    try {
      // Start test
      const { error: startErr } = await supabase.from('lab_orders').update({
        test_status: 'in_progress'
      }).eq('id', testLabOrderId);
      if (startErr) throw startErr;
      report('Lab', 'lab_orders', 'Start Test', 'SUCCESS', 'in_progress');

      // Submit results
      const { error: resErr } = await supabase.from('lab_orders').update({
        test_status: 'completed',
        results: 'WBC: 7.5 x10^9/L (Normal), Hb: 14.8 g/dL, Platelets: 250 x10^9/L. Normal findings.',
        completed_date: new Date().toISOString().split('T')[0]
      }).eq('id', testLabOrderId);
      if (resErr) throw resErr;
      report('Lab', 'lab_orders', 'Submit Results', 'SUCCESS', 'completed');
    } catch (err) {
      report('Lab', 'lab_orders', 'Lab Workflow', 'FAIL', err.message);
    }
  }

  // --------------------------------------------------------------------------
  // 5. PHARMACY PORTAL: Adjust Stock & Dispense Prescription
  // --------------------------------------------------------------------------
  try {
    // Check if any medicine exists, or create one for test
    const { data: meds } = await supabase.from('medicines').select('id, name, quantity').limit(1);
    let medId = meds?.[0]?.id;
    let oldQty = meds?.[0]?.quantity || 50;

    if (medId) {
      const newQty = oldQty + 10;
      const { error: stockErr } = await supabase.from('medicines').update({
        quantity: newQty,
        status: 'in_stock'
      }).eq('id', medId);
      if (stockErr) throw stockErr;
      report('Pharmacy', 'medicines', 'Stock Adjustment', 'SUCCESS', `${oldQty} -> ${newQty}`);
    }

    if (testPrescriptionId) {
      const { error: dispErr } = await supabase.from('prescriptions').update({
        status: 'dispensed',
        dispensed_date: new Date().toISOString().split('T')[0]
      }).eq('id', testPrescriptionId);
      if (dispErr) throw dispErr;
      report('Pharmacy', 'prescriptions', 'Dispense Prescription', 'SUCCESS', 'dispensed');
    }
  } catch (err) {
    report('Pharmacy', 'inventory/rx', 'Pharmacy Operations', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // 6. BILLING PORTAL: Confirm Payment & Waive Medication Orders
  // --------------------------------------------------------------------------
  try {
    const { data: payment, error: payErr } = await supabase.from('payments').insert({
      patient_id: testPatientId || null,
      patient_name: 'Abebe Bikila Test',
      payment_type: 'consultation',
      description: 'Registration & General Consultation',
      amount: 150,
      status: 'pending',
      reference_type: 'service'
    }).select().single();

    if (payErr) throw payErr;
    testPaymentId = payment.id;
    report('Billing', 'payments', 'Create Payment', 'SUCCESS', `${payment.amount} ETB`);

    // Confirm payment
    const { error: confErr } = await supabase.from('payments').update({
      status: 'paid',
      payment_method: 'cash',
      cashier_name: 'Dawit Cashier',
      receipt_number: `RCP-${Date.now().toString().slice(-6)}`,
      paid_date: new Date().toISOString().split('T')[0]
    }).eq('id', testPaymentId);
    if (confErr) throw confErr;
    report('Billing', 'payments', 'Confirm Payment', 'SUCCESS', 'paid (cash)');

    if (testMedOrderId) {
      const { error: waiveErr } = await supabase.from('medication_orders').update({
        payment_status: 'paid'
      }).eq('id', testMedOrderId);
      if (waiveErr) throw waiveErr;
      report('Billing', 'medication_orders', 'Confirm Med Order Payment', 'SUCCESS', 'paid');
    }
  } catch (err) {
    report('Billing', 'payments', 'Billing Operations', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // 7. OWNER PORTAL: Services, Lab Tests, Staff Management
  // --------------------------------------------------------------------------
  try {
    // Create Service
    const { data: srv, error: srvErr } = await supabase.from('services').insert({
      name: `Specialist Consultation ${Date.now().toString().slice(-4)}`,
      category: 'consultation',
      price: 350,
      description: 'Specialist physician outpatient visit',
      status: 'active'
    }).select().single();
    if (srvErr) throw srvErr;
    testServiceId = srv.id;
    report('Owner', 'services', 'Create Service', 'SUCCESS', `${srv.price} ETB`);

    // Create Lab Test
    const { data: lt, error: ltErr } = await supabase.from('lab_tests').insert({
      name: `Thyroid Panel TSH/FT4 ${Date.now().toString().slice(-4)}`,
      category: 'Blood',
      price: 480,
      turnaround_time: '2 hours',
      status: 'active'
    }).select().single();
    if (ltErr) throw ltErr;
    testLabTestId = lt.id;
    report('Owner', 'lab_tests', 'Create Lab Test Catalog', 'SUCCESS', `${lt.price} ETB`);

    // Staff update check
    const { data: staffList } = await supabase.from('staff').select('id, full_name, status').limit(1);
    if (staffList?.[0]) {
      const { error: stErr } = await supabase.from('staff').update({
        status: staffList[0].status
      }).eq('id', staffList[0].id);
      if (stErr) throw stErr;
      report('Owner', 'staff', 'Update Staff Member', 'SUCCESS', staffList[0].full_name);
    }
  } catch (err) {
    report('Owner', 'config/staff', 'Owner Operations', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // CLEANUP TEST RECORDS (if created)
  // --------------------------------------------------------------------------
  try {
    if (testLabTestId) await supabase.from('lab_tests').delete().eq('id', testLabTestId);
    if (testServiceId) await supabase.from('services').delete().eq('id', testServiceId);
    if (testPaymentId) await supabase.from('payments').delete().eq('id', testPaymentId);
    if (testMedOrderId) await supabase.from('medication_orders').delete().eq('id', testMedOrderId);
    if (testPrescriptionId) await supabase.from('prescriptions').delete().eq('id', testPrescriptionId);
    if (testLabOrderId) await supabase.from('lab_orders').delete().eq('id', testLabOrderId);
    if (testVisitId) {
      await supabase.from('vitals').delete().eq('visit_id', testVisitId);
      await supabase.from('visits').delete().eq('id', testVisitId);
    }
    if (testPatientId) await supabase.from('patients').delete().eq('id', testPatientId);
    console.log('\n[INFO] Test records cleaned up successfully.');
  } catch {
    // Ignore cleanup errors
  }

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY OF CRUD RESULTS');
  console.log('='.repeat(80));
  const passed = results.filter(r => r.status === 'SUCCESS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`TOTAL CHECKS: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);
  if (failed > 0) {
    console.log('\nFAILED REASONS (requires SQL migration in Supabase SQL editor):');
    results.filter(r => r.status === 'FAIL').forEach(f => {
      console.log(` - [${f.portal}] ${f.entity} -> ${f.action}: ${f.details}`);
    });
  }
}

runVerification();
