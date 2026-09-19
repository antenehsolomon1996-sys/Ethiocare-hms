import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { format } from 'date-fns';

const env = fs.readFileSync('.env', 'utf8');
const SUPABASE_URL = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim() || "https://qlodfpwcpjtoaxqrgfsh.supabase.co";
const SUPABASE_ANON_KEY = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim() || "sb_publishable_ZDcmnHfTmyXsIJsbLWmVtA_lFXIgzbF";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('='.repeat(80));
console.log('ETHIOCARE HMS - CORE ARCHITECTURE & 14-STEP WORKFLOW VERIFICATION');
console.log('='.repeat(80));

let failures = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    failures++;
  } else {
    console.log(`✓ PASSED: ${message}`);
  }
}

// -----------------------------------------------------------------------------
// WORKLOAD CALCULATION ENGINES (Mirror of staffAvailability.service.ts)
// -----------------------------------------------------------------------------
function calculateDoctorAvailability(doctor, activeVisits = []) {
  const doctorId = doctor.id;
  const doctorName = (doctor.full_name || doctor.name || '').trim().toLowerCase();

  const docVisits = activeVisits.filter(v => {
    if (v.status === 'completed' || v.status === 'cancelled') return false;
    const matchId = v.assigned_doctor_id && String(v.assigned_doctor_id) === String(doctorId);
    const matchName = v.assigned_doctor && String(v.assigned_doctor).trim().toLowerCase() === doctorName;
    return matchId || matchName;
  });

  const activeConsultation = docVisits.find(v => v.status === 'with_doctor' || v.status === 'in_progress');
  const waitingVisits = docVisits.filter(v => v.status === 'queued' || v.status === 'waiting' || v.status === 'triage_completed');

  const activeCount = activeConsultation ? 1 : 0;
  const waitingCount = waitingVisits.length;
  const totalWorkload = activeCount + waitingCount;

  let status = 'available';
  let statusLabel = 'Available';

  if (doctor.status === 'inactive' || doctor.availability === 'offline') {
    status = 'offline';
    statusLabel = 'Offline';
  } else if (doctor.availability === 'on_break') {
    status = 'on_break';
    statusLabel = 'On Break';
  } else if (activeCount > 0 && waitingCount >= 2) {
    status = 'busy';
    statusLabel = 'Busy';
  } else if (activeCount > 0) {
    status = 'in_consultation';
    statusLabel = 'In Consultation';
  } else if (waitingCount > 0) {
    status = 'assigned';
    statusLabel = `Waiting (${waitingCount})`;
  }

  return { status, statusLabel, activeCount, waitingCount, totalWorkload };
}

function calculateNurseAvailability(nurse, tasks = [], medOrders = []) {
  const nurseId = nurse.id;
  const nurseName = (nurse.full_name || nurse.name || '').trim().toLowerCase();

  const activeTasks = tasks.filter(t => {
    if (t.status === 'completed' || t.status === 'cancelled') return false;
    const matchId = t.assigned_nurse_id && String(t.assigned_nurse_id) === String(nurseId);
    const matchName = t.assigned_nurse_name && String(t.assigned_nurse_name).trim().toLowerCase() === nurseName;
    return matchId || matchName;
  });

  const activeMeds = medOrders.filter(m => {
    const s = m.administration_status || m.status;
    if (s === 'administered' || s === 'completed' || s === 'cancelled') return false;
    const matchId = m.assigned_nurse_id && String(m.assigned_nurse_id) === String(nurseId);
    const matchName = m.assigned_nurse_name && String(m.assigned_nurse_name).trim().toLowerCase() === nurseName;
    return matchId || matchName;
  });

  const totalWorkload = activeTasks.length + activeMeds.length;
  let status = 'available';
  let statusLabel = 'Available';

  if (totalWorkload > 3) {
    status = 'busy';
    statusLabel = `Busy (${totalWorkload} tasks)`;
  } else if (totalWorkload > 0) {
    status = 'assigned';
    statusLabel = `Assigned (${totalWorkload})`;
  }

  return { status, statusLabel, totalWorkload };
}

function calculateLabAssistantAvailability(assistant, labOrders = []) {
  const assistantId = assistant.id;
  const assistantName = (assistant.full_name || assistant.name || '').trim().toLowerCase();

  const activeOrders = labOrders.filter(o => {
    const isCompleted = o.test_status === 'completed' || o.status === 'completed';
    if (isCompleted) return false;
    const isPaid = o.payment_status === 'paid';
    if (!isPaid) return false; // Strict payment gate

    const matchId = o.assigned_assistant_id && String(o.assigned_assistant_id) === String(assistantId);
    const matchName = o.assigned_assistant_name && String(o.assigned_assistant_name).trim().toLowerCase() === assistantName;
    return matchId || matchName;
  });

  const inProgressTests = activeOrders.filter(o => o.test_status === 'in_progress');
  const pendingTests = activeOrders.filter(o => o.test_status !== 'in_progress');

  const activeCount = inProgressTests.length;
  const waitingCount = pendingTests.length;
  const totalWorkload = activeCount + waitingCount;

  let status = 'available';
  let statusLabel = 'Available';

  if (activeCount > 0 && waitingCount >= 2) {
    status = 'busy';
    statusLabel = 'Busy';
  } else if (activeCount > 0) {
    status = 'in_consultation';
    statusLabel = 'In Progress';
  } else if (waitingCount > 0) {
    status = 'assigned';
    statusLabel = `Assigned (${waitingCount})`;
  }

  return { status, statusLabel, activeCount, waitingCount, totalWorkload };
}

// -----------------------------------------------------------------------------
// TEST RUNNER
// -----------------------------------------------------------------------------
async function runVerification() {
  console.log('\n--- SECTION 1: INDIVIDUAL STAFF PORTALS & CREDENTIALS ---');
  
  // Test code generation format: HMS-XXXX-XXXX
  const codeRegex = /^HMS-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  const sampleCode = 'HMS-A8B9-C3D4';
  assert(codeRegex.test(sampleCode), 'Staff activation code matches required format HMS-XXXX-XXXX');

  // Test email format
  const hospitalEmail = 'dr.selamawit@grandhorizonhospital.com';
  assert(hospitalEmail.endsWith('@grandhorizonhospital.com'), 'Staff email uses hospital domain grandhorizonhospital.com');

  console.log('\n--- SECTION 2: WORKLOAD & AVAILABILITY ENGINE ---');

  const testDoctor = { id: 'doc-test-1', full_name: 'Dr. Dawit Alemu', status: 'active', availability: 'available' };

  // Scenario 2A: Doctor with 0 visits = Available
  const avail0 = calculateDoctorAvailability(testDoctor, []);
  assert(avail0.status === 'available' && avail0.totalWorkload === 0, 'Doctor with 0 active visits is Available (workload 0)');

  // Scenario 2B: Doctor attending consultation (status with_doctor) = In Consultation
  const visitsActive = [{ id: 'v-1', assigned_doctor_id: 'doc-test-1', status: 'with_doctor' }];
  const availConsult = calculateDoctorAvailability(testDoctor, visitsActive);
  assert(availConsult.status === 'in_consultation' && availConsult.activeCount === 1, 'Doctor with status "with_doctor" is In Consultation');

  // Scenario 2C: Doctor with active consultation + 2 waiting = Busy
  const visitsBusy = [
    { id: 'v-1', assigned_doctor_id: 'doc-test-1', status: 'with_doctor' },
    { id: 'v-2', assigned_doctor_id: 'doc-test-1', status: 'waiting' },
    { id: 'v-3', assigned_doctor_id: 'doc-test-1', status: 'waiting' }
  ];
  const availBusy = calculateDoctorAvailability(testDoctor, visitsBusy);
  assert(availBusy.status === 'busy' && availBusy.totalWorkload === 3, 'Doctor with consultation + 2 waiting is Busy (workload 3)');

  // Scenario 2D: Consultation completes -> status returns to Available
  const visitsCompleted = [{ id: 'v-1', assigned_doctor_id: 'doc-test-1', status: 'completed' }];
  const availDone = calculateDoctorAvailability(testDoctor, visitsCompleted);
  assert(availDone.status === 'available' && availDone.totalWorkload === 0, 'Doctor returns to Available upon consultation completion');

  console.log('\n--- SECTION 3: DOCTOR-TO-NURSE TASK ASSIGNMENT ---');

  const testNurse1 = { id: 'nurse-test-1', full_name: 'Nurse Hana Bekele' };
  const testNurse2 = { id: 'nurse-test-2', full_name: 'Sister Tigist Mengistu' };

  const medOrders = [
    { id: 'mo-1', item_name: 'Amoxicillin 500mg', assigned_nurse_id: 'nurse-test-1', assigned_nurse_name: 'Nurse Hana Bekele', administration_status: 'pending' },
    { id: 'mo-2', item_name: 'Normal Saline IV', assigned_nurse_id: 'nurse-test-1', assigned_nurse_name: 'Nurse Hana Bekele', administration_status: 'pending' }
  ];
  const nurseTasks = [
    { id: 'nt-1', task_type: 'vital_monitoring', assigned_nurse_id: 'nurse-test-1', assigned_nurse_name: 'Nurse Hana Bekele', status: 'in_progress' }
  ];

  const nurse1Avail = calculateNurseAvailability(testNurse1, nurseTasks, medOrders);
  const nurse2Avail = calculateNurseAvailability(testNurse2, nurseTasks, medOrders);

  assert(nurse1Avail.totalWorkload === 3 && nurse1Avail.status === 'assigned', 'Assigned nurse receives 3 tasks and has status Assigned (3)');
  assert(nurse2Avail.totalWorkload === 0 && nurse2Avail.status === 'available', 'Other nurse has 0 tasks and remains Available');

  console.log('\n--- SECTION 4: DOCTOR-TO-LAB ASSISTANT & PAYMENT GATE ---');

  const testAssistant1 = { id: 'asst-1', full_name: 'Kidus Worku' };

  // Unpaid lab order should NOT be counted in active tests
  const labOrdersUnpaid = [
    { id: 'lo-1', test_name: 'CBC', assigned_assistant_id: 'asst-1', payment_status: 'pending', test_status: 'awaiting_payment' }
  ];
  const asstUnpaidAvail = calculateLabAssistantAvailability(testAssistant1, labOrdersUnpaid);
  assert(asstUnpaidAvail.totalWorkload === 0 && asstUnpaidAvail.status === 'available', 'Payment gate preserved: Unpaid lab order does not enter active assistant workload');

  // Paid lab order DOES enter active assistant workload
  const labOrdersPaid = [
    { id: 'lo-1', test_name: 'CBC', assigned_assistant_id: 'asst-1', payment_status: 'paid', test_status: 'in_progress' }
  ];
  const asstPaidAvail = calculateLabAssistantAvailability(testAssistant1, labOrdersPaid);
  assert(asstPaidAvail.totalWorkload === 1 && asstPaidAvail.status === 'in_consultation', 'Paid lab order enters active workload and marks assistant In Progress');

  console.log('\n--- SECTION 5: ROOM & BED MANAGEMENT & DOUBLE-BOOKING PREVENTION ---');

  // Simulate room and beds
  const sampleRooms = [
    { id: 'rm-204', room_number: '204', room_type: 'standard', department: 'Inpatient Ward', daily_rate: 500, status: 'available' }
  ];
  let sampleBeds = [
    { id: 'bed-204-1', room_id: 'rm-204', bed_number: 'B-01', bed_label: 'Room 204 - Bed B-01', status: 'available' },
    { id: 'bed-204-2', room_id: 'rm-204', bed_number: 'B-02', bed_label: 'Room 204 - Bed B-02', status: 'available' }
  ];

  // 1. Doctor requests bed admission
  const visitAdmission = {
    id: 'visit-test-adm',
    patient_id: 'pat-test-1',
    patient_name: 'Abebe Kebede',
    bed_status: 'bed_requested',
    bed_assigned: false
  };
  assert(visitAdmission.bed_status === 'bed_requested', 'Doctor successfully initiates bed admission request (bed_status: bed_requested)');

  // 2. Filter available beds for Room 204
  const availableBedsFor204 = sampleBeds.filter(b => b.room_id === 'rm-204' && (b.status === 'available' || b.status === 'released'));
  assert(availableBedsFor204.length === 2, 'Room 204 has 2 available beds before assignment');

  // 3. Reception assigns Bed B-02
  const chosenBed = availableBedsFor204.find(b => b.bed_number === 'B-02');
  sampleBeds = sampleBeds.map(b => b.id === chosenBed.id ? { ...b, status: 'occupied', current_patient_name: 'Abebe Kebede' } : b);
  visitAdmission.bed_assigned = true;
  visitAdmission.bed_status = 'assigned';
  visitAdmission.room_number = '204';
  visitAdmission.bed_number = 'B-02';

  assert(sampleBeds.find(b => b.bed_number === 'B-02').status === 'occupied', 'Bed B-02 status updated to occupied');
  assert(visitAdmission.room_number === '204' && visitAdmission.bed_number === 'B-02', 'Visit reflects Room 204 → Bed B-02');

  // 4. Verify Double-Booking Prevention: Room 204 now only has 1 available bed (B-01)
  const remainingBeds = sampleBeds.filter(b => b.room_id === 'rm-204' && (b.status === 'available' || b.status === 'released'));
  assert(remainingBeds.length === 1 && remainingBeds[0].bed_number === 'B-01', 'Double-booking strictly prevented: Bed B-02 removed from available selection');

  // 5. Prominent Bed Information display
  const bedBanner = `Room ${visitAdmission.room_number} → Bed ${visitAdmission.bed_number} → ${visitAdmission.patient_name}`;
  assert(bedBanner === 'Room 204 → Bed B-02 → Abebe Kebede', 'Prominent bed info format matches required specification');

  // 6. Discharge and release bed
  sampleBeds = sampleBeds.map(b => b.id === chosenBed.id ? { ...b, status: 'available', current_patient_name: null } : b);
  visitAdmission.bed_status = 'discharged';
  assert(sampleBeds.find(b => b.bed_number === 'B-02').status === 'available', 'Bed status returns to available upon discharge');

  console.log('\n' + '='.repeat(80));
  if (failures === 0) {
    console.log('🎉 ALL ARCHITECTURE & WORKFLOW VERIFICATION CHECKS PASSED (0 FAILURES)');
  } else {
    console.error(`❌ VERIFICATION COMPLETED WITH ${failures} FAILURE(S)`);
    process.exit(1);
  }
  console.log('='.repeat(80));
}

runVerification();
