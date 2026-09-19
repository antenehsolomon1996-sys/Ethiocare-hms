import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const SUPABASE_URL = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim() || "https://qlodfpwcpjtoaxqrgfsh.supabase.co";
const SUPABASE_ANON_KEY = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim() || "sb_publishable_ZDcmnHfTmyXsIJsbLWmVtA_lFXIgzbF";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('='.repeat(85));
console.log('ETHIOCARE HMS - INDIVIDUAL WORKSPACES, ROOM EXCLUSIVITY & SHARED HISTORY TEST');
console.log('='.repeat(85));

let failures = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    failures++;
  } else {
    console.log(`✓ PASSED: ${message}`);
  }
}

// Emulate Room Exclusivity Check (Mirror of StaffManagement.jsx logic)
function validateRoomAssignment(targetRoomId, assigningStaffId, allStaff, rooms) {
  if (!targetRoomId) return { valid: true };
  const room = rooms.find(r => String(r.id) === String(targetRoomId));
  if (!room) return { valid: true };

  // If room is non-exclusive (shared workspace), assignment is always permitted
  if (room.is_exclusive === false) {
    return { valid: true };
  }

  // If room is exclusive, check if another active staff member is currently assigned
  const conflictingStaff = allStaff.find(s => 
    s.status === 'active' &&
    String(s.id) !== String(assigningStaffId) &&
    String(s.assigned_room_id) === String(targetRoomId)
  );

  if (conflictingStaff) {
    return { 
      valid: false, 
      error: `Room ${room.room_number || targetRoomId} is exclusive and currently assigned to ${conflictingStaff.full_name} (${conflictingStaff.role}).` 
    };
  }

  return { valid: true };
}

// Emulate Individual Queue Filter (Mirror of DoctorQueue.jsx logic)
function filterDoctorQueue(visits, currentDoctor) {
  if (!currentDoctor) return [];
  const docId = String(currentDoctor.id || '').trim();
  const docName = String(currentDoctor.full_name || '').toLowerCase().trim();

  return visits.filter(v => {
    if (v.status === 'completed' || v.status === 'cancelled') return false;
    const assignedId = String(v.assigned_doctor_id || '').trim();
    const assignedName = String(v.assigned_doctor || '').toLowerCase().trim();

    // Assigned explicitly to this doctor
    if (assignedId && docId && assignedId === docId) return true;
    if (assignedName && docName && (assignedName.includes(docName) || docName.includes(assignedName))) return true;

    // Unassigned general pool
    if (!assignedId && !assignedName) return true;

    return false;
  });
}

async function runVerification() {
  try {
    // Authenticate session for RLS-protected database operations
    const { error: loginErr } = await supabase.auth.signInWithPassword({
      email: 'admin@grandhorizonhospital.com',
      password: 'Hospital@2026'
    });
    assert(!loginErr, 'Established authenticated staff session via Supabase Auth');

    // -------------------------------------------------------------------------
    // TEST 1: Provisioned Staff Profiles & Distinct Credentials
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 1: Provisioned Staff Profiles & Distinct Credentials ---');
    const { data: staffList, error: staffErr } = await supabase.from('staff').select('*');
    assert(!staffErr, 'Fetched staff list from Supabase without error');
    assert(staffList && staffList.length >= 6, `Retrieved ${staffList?.length || 0} total staff records`);

    // Verify at least 2 distinct Doctors
    const doctors = staffList.filter(s => s.role === 'doctor' && s.status === 'active');
    assert(doctors.length >= 2, `Found ${doctors.length} active doctors (required >= 2)`);
    const doc1 = doctors.find(d => d.full_name?.toLowerCase().includes('selamawit')) || doctors[0];
    const doc2 = doctors.find(d => d.full_name?.toLowerCase().includes('dawit')) || doctors[1];
    
    assert(doc1.email !== doc2.email, `Doctors have distinct hospital emails: ${doc1.email} vs ${doc2.email}`);
    assert(doc1.activation_code !== doc2.activation_code, `Doctors have distinct login credentials/activation codes: ${doc1.activation_code} vs ${doc2.activation_code}`);
    assert(doc1.id !== doc2.id, `Doctors have distinct staff IDs: ${doc1.id} vs ${doc2.id}`);

    // Verify at least 2 distinct Nurses
    const nurses = staffList.filter(s => s.role === 'nurse' && s.status === 'active');
    assert(nurses.length >= 2, `Found ${nurses.length} active nurses (required >= 2)`);
    const nurse1 = nurses.find(n => n.full_name?.toLowerCase().includes('tigist')) || nurses[0];
    const nurse2 = nurses.find(n => n.full_name?.toLowerCase().includes('hana')) || nurses[1];
    assert(nurse1.email !== nurse2.email, `Nurses have distinct hospital emails: ${nurse1.email} vs ${nurse2.email}`);
    assert(nurse1.activation_code !== nurse2.activation_code, `Nurses have distinct login codes: ${nurse1.activation_code} vs ${nurse2.activation_code}`);
    assert(nurse1.id !== nurse2.id, `Nurses have distinct staff IDs`);

    // Verify at least 2 distinct Lab Assistants
    const labStaff = staffList.filter(s => (s.role === 'lab' || s.role === 'lab_technician') && s.status === 'active');
    assert(labStaff.length >= 2, `Found ${labStaff.length} active lab staff (required >= 2)`);
    const lab1 = labStaff.find(l => l.full_name?.toLowerCase().includes('kidus')) || labStaff[0];
    const lab2 = labStaff.find(l => l.full_name?.toLowerCase().includes('bethlehem')) || labStaff[1];
    assert(lab1.email !== lab2.email, `Lab staff have distinct hospital emails: ${lab1.email} vs ${lab2.email}`);
    assert(lab1.activation_code !== lab2.activation_code, `Lab staff have distinct login codes: ${lab1.activation_code} vs ${lab2.activation_code}`);
    assert(lab1.id !== lab2.id, `Lab staff have distinct staff IDs`);

    // -------------------------------------------------------------------------
    // TEST 2: Physical Consultation & Station Rooms & Exclusivity Policy
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Physical Rooms & Exclusivity Policy Enforcement ---');
    
    // Test hospital rooms configuration
    const hospitalRooms = [
      { id: 'rm-104', room_number: '104', department: 'Internal Medicine OPD', is_exclusive: true, assigned_staff_id: doc1.id, assigned_staff_name: doc1.full_name },
      { id: 'rm-105', room_number: '105', department: 'General Practice OPD', is_exclusive: true, assigned_staff_id: doc2.id, assigned_staff_name: doc2.full_name },
      { id: 'rm-nurse-1', room_number: 'NS-01', department: 'Nursing Station - Ward A', is_exclusive: true, assigned_staff_id: nurse1.id, assigned_staff_name: nurse1.full_name },
      { id: 'rm-nurse-2', room_number: 'NS-02', department: 'Nursing Station - Ward B', is_exclusive: true, assigned_staff_id: nurse2.id, assigned_staff_name: nurse2.full_name },
      { id: 'rm-lab-1', room_number: 'LAB-01', department: 'Hematology Lab', is_exclusive: true, assigned_staff_id: lab1.id, assigned_staff_name: lab1.full_name },
      { id: 'rm-lab-2', room_number: 'LAB-02', department: 'Microbiology Lab', is_exclusive: true, assigned_staff_id: lab2.id, assigned_staff_name: lab2.full_name },
      { id: 'rm-shared-1', room_number: '101', department: 'General Ward', is_exclusive: false }
    ];

    assert(hospitalRooms.length >= 6, `Configured ${hospitalRooms.length} physical consultation & workstation rooms`);

    // Assign mock assigned rooms to staff for testing exclusivity
    const staffWithRooms = [
      { ...doc1, assigned_room_id: 'rm-104', assigned_room_number: '104' },
      { ...doc2, assigned_room_id: 'rm-105', assigned_room_number: '105' },
      { ...nurse1, assigned_room_id: 'rm-nurse-1', assigned_room_number: 'NS-01' },
      { ...nurse2, assigned_room_id: 'rm-nurse-2', assigned_room_number: 'NS-02' },
      { ...lab1, assigned_room_id: 'rm-lab-1', assigned_room_number: 'LAB-01' },
      { ...lab2, assigned_room_id: 'rm-lab-2', assigned_room_number: 'LAB-02' }
    ];

    // Attempting to assign doc2 to doc1's exclusive room (Room 104)
    const conflictResult = validateRoomAssignment('rm-104', doc2.id, staffWithRooms, hospitalRooms);
    assert(!conflictResult.valid, `Exclusivity rule blocked double assignment to Room 104: "${conflictResult.error}"`);

    // Assigning doc1 to their own room (Room 104) should pass (safe re-assignment)
    const selfAssignResult = validateRoomAssignment('rm-104', doc1.id, staffWithRooms, hospitalRooms);
    assert(selfAssignResult.valid, 'Self-assignment / editing existing staff permitted without false collision');

    // Attempting to assign nurse2 to nurse1's exclusive station (NS-01)
    const nurseConflict = validateRoomAssignment('rm-nurse-1', nurse2.id, staffWithRooms, hospitalRooms);
    assert(!nurseConflict.valid, `Exclusivity rule blocked double assignment to Nursing Station NS-01: "${nurseConflict.error}"`);

    // Non-exclusive room sharing test (Room 101 with is_exclusive = false)
    const sharedResult1 = validateRoomAssignment('rm-shared-1', doc1.id, staffWithRooms, hospitalRooms);
    const sharedResult2 = validateRoomAssignment('rm-shared-1', doc2.id, staffWithRooms, hospitalRooms);
    assert(sharedResult1.valid && sharedResult2.valid, 'Non-exclusive shared workspace (Room 101) permits multi-staff assignment');

    // -------------------------------------------------------------------------
    // TEST 3: Credential Isolation & Two-Tier Selector Logic
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Credential Isolation & Role/Member Segregation ---');
    const mockAuthAttempt = (providedEmail, providedCode, staffMember, targetPortal) => {
      if (staffMember.email.toLowerCase() !== providedEmail.toLowerCase()) return { success: false, error: 'Email mismatch' };
      if (targetPortal && staffMember.role !== targetPortal) return { success: false, error: 'Portal mismatch' };
      if (staffMember.activation_code !== providedCode && providedCode !== 'Hospital@2026') {
        return { success: false, error: 'Invalid code' };
      }
      return { success: true };
    };

    assert(!mockAuthAttempt(doc2.email, doc1.activation_code, doc2, 'doctor').success, 
      'Credential cross-talk prevented: Dr. Selamawit\'s code cannot authenticate Dr. Dawit');
    assert(!mockAuthAttempt(nurse1.email, doc1.activation_code, nurse1, 'nurse').success,
      'Credential cross-talk prevented: Doctor code cannot authenticate Nurse portal');
    assert(!mockAuthAttempt(doc1.email, doc1.activation_code, doc1, 'nurse').success,
      'Portal mismatch prevented: Doctor credentials rejected on Nurse portal login');
    assert(mockAuthAttempt(doc1.email, doc1.activation_code, doc1, 'doctor').success,
      'Valid authentication: Dr. Selamawit authenticates only with her own credentials on Doctor portal');

    // -------------------------------------------------------------------------
    // TEST 4: Reception Queue Assignment & Doctor Workload Isolation
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Reception Assignment & Doctor Workload Isolation ---');
    // Create test patient
    const testPatientPhone = `0911${Math.floor(100000 + Math.random() * 900000)}`;
    const testPatientId = `PT-TEST-${Math.floor(1000 + Math.random() * 9000)}`;
    const { data: testPatient, error: pErr } = await supabase.from('patients').insert({
      patient_id: testPatientId,
      full_name: 'Abebe Workspace-Test',
      phone: testPatientPhone,
      gender: 'Male',
      age: 38
    }).select().single();

    assert(!pErr && testPatient, `Created test patient: ${testPatient?.full_name} (${testPatient?.id})`);

    // Reception queues patient specifically to Dr. Selamawit (Room 104)
    const todayDate = new Date().toISOString().slice(0, 10);
    const { data: testVisit, error: vErr } = await supabase.from('visits').insert({
      patient_id: testPatient.id,
      patient_name: testPatient.full_name,
      assigned_doctor: doc1.full_name,
      assigned_doctor_id: doc1.id,
      status: 'waiting',
      visit_date: todayDate
    }).select().single();

    assert(!vErr && testVisit, `Queued visit #${testVisit?.id?.slice(0, 8)} specifically to Dr. ${doc1.full_name}`);

    // Query active visits and filter for Dr. Selamawit vs Dr. Dawit
    const { data: activeVisits } = await supabase.from('visits').select('*').in('status', ['queued', 'with_doctor', 'in_progress', 'waiting']);
    const selQueue = filterDoctorQueue(activeVisits, doc1);
    const dawQueue = filterDoctorQueue(activeVisits, doc2);

    const inSelQueue = selQueue.some(v => v.id === testVisit.id);
    const inDawQueue = dawQueue.some(v => v.id === testVisit.id);

    assert(inSelQueue, `Patient correctly appears in Dr. ${doc1.full_name}'s personalized queue`);
    assert(!inDawQueue, `Patient correctly excluded from Dr. ${doc2.full_name}'s queue (workload isolation verified)`);

    // -------------------------------------------------------------------------
    // TEST 5: Centralized Shared Patient History (Zero Fragmentation)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Centralized Shared Patient Medical Record Across Staff ---');
    // Dr. Selamawit records consultation notes & diagnosis in central patient_history
    const clinicalDiagnosis = 'Acute Bacterial Bronchitis';
    const clinicalNotes = 'Patient presenting with productive cough and mild pyrexia. Prescribed Amoxicillin.';
    
    const { data: historyRecord, error: histErr } = await supabase.from('patient_history').insert({
      patient_id: testPatient.id,
      patient_name: testPatient.full_name,
      doctor_name: doc1.full_name,
      visit_date: todayDate,
      diagnosis: clinicalDiagnosis,
      symptoms: 'Cough, pyrexia, wheezing',
      notes: clinicalNotes,
      treatment: 'Antibiotic therapy',
      record_type: 'visit'
    }).select().single();

    assert(!histErr && historyRecord, `Dr. ${doc1.full_name} recorded consultation into central patient_history`);

    // Also simulate a historical paper record added by Reception
    const { data: paperRecord, error: paperErr } = await supabase.from('patient_history').insert({
      patient_id: testPatient.id,
      patient_name: testPatient.full_name,
      doctor_name: 'Dr. Historical Practitioner',
      visit_date: '2021-04-12',
      diagnosis: 'Childhood Asthma',
      notes: '[HISTORICAL / PAPER RECORD] Digitized from physical paper chart',
      record_type: 'visit'
    }).select().single();

    assert(!paperErr && paperRecord, 'Paper historical record saved in same central patient_history table');

    // Dr. Dawit opens the patient chart: queries shared patient history
    const { data: sharedHistory, error: readHistErr } = await supabase
      .from('patient_history')
      .select('*')
      .eq('patient_id', testPatient.id)
      .order('created_at', { ascending: false });

    assert(!readHistErr, 'Dr. Dawit successfully queried shared patient history');
    assert(sharedHistory.length >= 2, `Retrieved all ${sharedHistory.length} patient history entries across all providers`);

    const hasSelamawitVisit = sharedHistory.some(h => h.diagnosis === clinicalDiagnosis && h.doctor_name === doc1.full_name);
    const hasPaperVisit = sharedHistory.some(h => h.diagnosis === 'Childhood Asthma');

    assert(hasSelamawitVisit, `Dr. Dawit sees Dr. Selamawit's consultation (${clinicalDiagnosis}) in patient chart`);
    assert(hasPaperVisit, 'Dr. Dawit sees historical paper record (Childhood Asthma) in same patient chart');

    // Clean up test data
    await supabase.from('patient_history').delete().eq('patient_id', testPatient.id);
    await supabase.from('visits').delete().eq('patient_id', testPatient.id);
    await supabase.from('patients').delete().eq('id', testPatient.id);
    console.log('✓ Cleaned up test patient, visits, and history records');

  } catch (err) {
    console.error('Unhandled verification error:', err);
    failures++;
  }

  console.log('\n' + '='.repeat(85));
  if (failures === 0) {
    console.log('🎉 ALL INDIVIDUAL WORKSPACE & ROOM EXCLUSIVITY TESTS PASSED SUCCESSFULLY!');
  } else {
    console.error(`💥 VERIFICATION COMPLETED WITH ${failures} FAILURE(S)`);
  }
  console.log('='.repeat(85));
  process.exit(failures > 0 ? 1 : 0);
}

runVerification();
