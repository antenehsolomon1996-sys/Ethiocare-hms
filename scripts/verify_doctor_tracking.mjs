import assert from 'node:assert';
import { enrichVisitRecord, JOURNEY_STAGES } from '../src/lib/doctorTrackingUtils.js';

console.log('--- STARTING DOCTOR PATIENT TRACKING VERIFICATION ---');

// Test 1: Journey Stages definition
assert.strictEqual(JOURNEY_STAGES.length, 8, 'Must have exactly 8 canonical stages');
assert.deepStrictEqual(
  JOURNEY_STAGES.map(s => s.id),
  ['registration', 'payment', 'doctor', 'lab', 'billing', 'nurse', 'pharmacy', 'completed'],
  'Stages must match canonical sequence: Registration -> Payment -> Doctor -> Lab -> Billing -> Nurse -> Pharmacy -> Completed'
);
console.log('✓ Test 1 Passed: 8 Canonical Journey Stages verified');

// Test 2: Unpaid registration visit -> Stage: payment
const unpaidRegVisit = {
  id: 'v-101',
  patient_id: 'pat-1',
  patient_name: 'Abebe Kebede',
  visit_date: '2026-09-19',
  status: 'waiting',
  registration_fee_paid: false
};
const enriched1 = enrichVisitRecord(unpaidRegVisit);
assert.strictEqual(enriched1.currentStage.id, 'payment', 'Unpaid registration must be at payment stage');
assert.strictEqual(enriched1.currentStage.room, 'Billing & Registration Desk');
assert.strictEqual(enriched1.isOngoing, true, 'Unfinished visit must be marked ongoing');
console.log('✓ Test 2 Passed: Unpaid registration stage resolution verified');

// Test 3: Patient sent to Lab (unpaid lab) -> MUST NOT DISAPPEAR, stage: billing
const labPendingVisit = {
  id: 'v-102',
  patient_id: 'pat-2',
  patient_name: 'Sara Mohammed',
  visit_date: '2026-09-19',
  status: 'lab_pending',
  registration_fee_paid: true
};
const labOrders = [
  { id: 'lab-1', visit_id: 'v-102', test_name: 'Complete Blood Count (CBC)', test_type: 'Blood', price: 180, payment_status: 'pending', test_status: 'awaiting_payment' }
];
const enriched2 = enrichVisitRecord(labPendingVisit, { labOrders });
assert.strictEqual(enriched2.currentStage.id, 'billing');
assert.strictEqual(enriched2.currentStage.room, 'Billing / Cashier Desk');
assert.strictEqual(enriched2.waitingOn.includes('Complete Blood Count'), true);
assert.strictEqual(enriched2.isOngoing, true);
console.log('✓ Test 3 Passed: Sent to Lab (Awaiting Payment) patient remains tracked in Billing Cashier');

// Test 4: Lab fee paid, testing in progress -> Stage: lab, Room: Laboratory Testing Room
const labPaidOrders = [
  { id: 'lab-1', visit_id: 'v-102', test_name: 'Complete Blood Count (CBC)', test_type: 'Blood', price: 180, payment_status: 'paid', test_status: 'in_progress' }
];
const enriched3 = enrichVisitRecord(labPendingVisit, { labOrders: labPaidOrders });
assert.strictEqual(enriched3.currentStage.id, 'lab');
assert.strictEqual(enriched3.currentStage.room, 'Laboratory Testing Room');
assert.strictEqual(enriched3.currentStage.label, 'Lab Testing in Progress');
console.log('✓ Test 4 Passed: Lab testing in progress stage resolution verified');

// Test 5: Lab results ready -> Stage: doctor, Room: Doctor Consultation Room
const labCompletedOrders = [
  { id: 'lab-1', visit_id: 'v-102', test_name: 'CBC', test_type: 'Blood', price: 180, payment_status: 'paid', test_status: 'completed', results: 'WBC 6.5, Hb 14.2 g/dL (Normal)' }
];
const enriched4 = enrichVisitRecord(labPendingVisit, { labOrders: labCompletedOrders });
assert.strictEqual(enriched4.currentStage.id, 'doctor');
assert.strictEqual(enriched4.currentStage.label, 'Lab Results Ready');
assert.strictEqual(enriched4.currentStage.room, 'Doctor Consultation Room');
assert.strictEqual(enriched4.nextStep.includes('review lab findings'), true);
console.log('✓ Test 5 Passed: Lab results ready returns to Doctor Room for review');

// Test 6: Sent to Nurse for Injections -> Stage: nurse, Room: Nursing Station
const nurseVisit = {
  id: 'v-103',
  patient_id: 'pat-3',
  patient_name: 'Dawit Yohannes',
  visit_date: '2026-09-19',
  status: 'with_doctor',
  registration_fee_paid: true
};
const medOrders = [
  { id: 'mo-1', visit_id: 'v-103', item_name: 'Diclofenac 75mg IM', payment_status: 'paid', administration_status: 'pending' }
];
const enriched5 = enrichVisitRecord(nurseVisit, { medicationOrders: medOrders });
assert.strictEqual(enriched5.currentStage.id, 'nurse');
assert.strictEqual(enriched5.currentStage.room, 'Nursing Station / Procedure Room');
assert.strictEqual(enriched5.waitingOn.includes('Diclofenac'), true);
console.log('✓ Test 6 Passed: Patient sent to Nurse remains visible in Nursing Station');

// Test 7: Multi-day ongoing patient (started 3 days ago, unfinished lab)
const multiDayVisit = {
  id: 'v-104',
  patient_id: 'pat-4',
  patient_name: 'Kassahun Bekele',
  visit_date: '2026-09-16',
  created_at: '2026-09-16T09:00:00Z',
  status: 'lab_processing',
  registration_fee_paid: true
};
const enriched6 = enrichVisitRecord(multiDayVisit, {
  labOrders: [
    { id: 'lab-2', visit_id: 'v-104', test_name: 'Blood Culture', payment_status: 'paid', test_status: 'in_progress' }
  ]
});
assert.strictEqual(enriched6.isOngoing, true);
assert.strictEqual(enriched6.daysOngoing >= 2, true, 'Must identify multi-day ongoing encounter');
console.log(`✓ Test 7 Passed: Multi-day ongoing patient detected (${enriched6.daysOngoing} days ongoing)`);

// Test 8: Completed visit -> Stage: completed, isOngoing: false
const completedVisit = {
  id: 'v-105',
  patient_id: 'pat-5',
  patient_name: 'Tigist Haile',
  visit_date: '2026-09-19',
  status: 'completed',
  consultation_completed: true,
  registration_fee_paid: true
};
const enriched7 = enrichVisitRecord(completedVisit);
assert.strictEqual(enriched7.currentStage.id, 'completed');
assert.strictEqual(enriched7.currentStage.label, 'Treatment Completed');
assert.strictEqual(enriched7.isOngoing, false);
console.log('✓ Test 8 Passed: Concluded visit marked completed and discharged');

console.log('--- ALL DOCTOR PATIENT TRACKING TESTS PASSED PERFECTLY ---');
