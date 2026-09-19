import { createClient } from '@supabase/supabase-js';
import { format, subDays, addDays, differenceInDays, parseISO, isValid, isAfter, startOfDay } from 'date-fns';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const SUPABASE_URL = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim() || "https://qlodfpwcpjtoaxqrgfsh.supabase.co";
const SUPABASE_ANON_KEY = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim() || "sb_publishable_ZDcmnHfTmyXsIJsbLWmVtA_lFXIgzbF";

console.log('='.repeat(80));
console.log('ETHIOCARE HMS - HISTORICAL PATIENT RECORDS & 30-DAY RETURN RULE VERIFICATION');
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
// STANDALONE DETERMINATION FUNCTION (Exact match to patientFeeService.determineRegistrationFee)
// -----------------------------------------------------------------------------
const DEFAULT_NEW_PATIENT_FEE = 150.0;
const DEFAULT_RECENT_PATIENT_FEE = 100.0;

function getRegistrationTariffs(services = []) {
  const regServices = services.filter(s => s.category === 'registration' && s.status === 'active');
  const recentPatientService = regServices.find(s =>
    s.name?.toLowerCase().includes('recent') ||
    s.name?.toLowerCase().includes('revisit') ||
    s.name?.toLowerCase().includes('returning') ||
    s.name?.includes('≤30')
  ) || null;

  const newPatientService = regServices.find(s =>
    (s.name?.toLowerCase().includes('new') || s.name === 'Patient Registration') &&
    s.id !== recentPatientService?.id
  ) || regServices[0] || null;

  return {
    newPatientFee: newPatientService?.price ?? DEFAULT_NEW_PATIENT_FEE,
    recentPatientFee: recentPatientService?.price ?? DEFAULT_RECENT_PATIENT_FEE,
    newPatientService,
    recentPatientService
  };
}

function determineRegistrationFee(patientId, services = [], patientVisits = [], patientHistory = []) {
  const tariffs = getRegistrationTariffs(services);

  const completedVisits = patientVisits.filter(v => {
    if (!v) return false;
    return v.patient_id === patientId && (v.status === 'completed' || v.consultation_completed === true);
  });

  const matchingHistory = patientHistory.filter(h => {
    if (!h) return false;
    return h.patient_id === patientId && Boolean(h.visit_date);
  });

  if (completedVisits.length === 0 && matchingHistory.length === 0) {
    return {
      feeType: 'new_patient',
      fee: tariffs.newPatientFee,
      label: 'New Patient Registration Fee',
      serviceName: tariffs.newPatientService?.name || 'Patient Registration (New Patient)',
      daysSinceLastVisit: null,
      lastVisitDate: null,
      isRecent: false,
      statusText: 'New patient registration',
      badgeText: 'New Patient Registration'
    };
  }

  let latestVisitDate = null;
  let latestVisitDateStr = null;
  let latestRecordSource = 'system';

  for (const v of completedVisits) {
    const dateStr = v.visit_date || v.created_at;
    if (!dateStr) continue;
    try {
      const d = typeof dateStr === 'string' ? parseISO(dateStr.slice(0, 10)) : new Date(dateStr);
      if (isValid(d) && (!latestVisitDate || d.getTime() > latestVisitDate.getTime())) {
        latestVisitDate = d;
        latestVisitDateStr = typeof dateStr === 'string' ? dateStr.slice(0, 10) : dateStr.toISOString().slice(0, 10);
        latestRecordSource = 'system';
      }
    } catch {}
  }

  for (const h of matchingHistory) {
    const dateStr = h.visit_date;
    if (!dateStr) continue;
    try {
      const d = typeof dateStr === 'string' ? parseISO(dateStr.slice(0, 10)) : new Date(dateStr);
      if (isValid(d) && (!latestVisitDate || d.getTime() > latestVisitDate.getTime())) {
        latestVisitDate = d;
        latestVisitDateStr = typeof dateStr === 'string' ? dateStr.slice(0, 10) : dateStr.toISOString().slice(0, 10);
        latestRecordSource = 'historical';
      }
    } catch {}
  }

  if (!latestVisitDate) {
    return {
      feeType: 'new_patient',
      fee: tariffs.newPatientFee,
      daysSinceLastVisit: null,
      lastVisitDate: null,
      isRecent: false,
      statusText: 'New patient registration'
    };
  }

  const today = new Date();
  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const latestDateOnly = new Date(latestVisitDate.getFullYear(), latestVisitDate.getMonth(), latestVisitDate.getDate());
  const daysSince = Math.max(0, differenceInDays(todayDateOnly, latestDateOnly));

  if (daysSince <= 30) {
    return {
      feeType: 'recent_patient',
      fee: tariffs.recentPatientFee,
      label: 'Recent Patient Revisit Fee (≤30 Days)',
      daysSinceLastVisit: daysSince,
      lastVisitDate: latestVisitDateStr,
      lastVisitSource: latestRecordSource,
      isRecent: true,
      statusText: 'Visited within 30 days',
      badgeText: `Visited within 30 days (${daysSince === 0 ? 'Today' : `${daysSince}d ago`})`
    };
  } else {
    return {
      feeType: 'returning_over_30_days',
      fee: tariffs.newPatientFee,
      label: 'Returning Patient Re-Registration Fee (>30 Days)',
      daysSinceLastVisit: daysSince,
      lastVisitDate: latestVisitDateStr,
      lastVisitSource: latestRecordSource,
      isRecent: false,
      statusText: 'More than 30 days since last visit',
      badgeText: `More than 30 days since last visit (${daysSince}d ago)`
    };
  }
}

// -----------------------------------------------------------------------------
// HISTORICAL RECORD VALIDATOR (Exact match to historicalRecordService.validate)
// -----------------------------------------------------------------------------
function validateHistoricalRecord(data) {
  if (!data.patient_id?.trim()) return { valid: false, error: 'Patient ID is required' };
  if (!data.patient_name?.trim()) return { valid: false, error: 'Patient name is required' };
  if (!data.visit_date?.trim()) return { valid: false, error: 'Original treatment date is required' };

  const parsedDate = parseISO(data.visit_date);
  if (!isValid(parsedDate)) return { valid: false, error: 'Invalid treatment date format (use YYYY-MM-DD)' };

  const today = startOfDay(new Date());
  if (isAfter(startOfDay(parsedDate), today)) {
    return { valid: false, error: 'Historical treatment date cannot be in the future' };
  }

  if (!data.doctor_name?.trim()) return { valid: false, error: 'Attending doctor name is required' };
  if (!data.diagnosis?.trim()) return { valid: false, error: 'Historical diagnosis/disease is required' };

  return { valid: true };
}

// -----------------------------------------------------------------------------
// SECTION 1: 30-DAY RETURN RULE UNIT TESTS
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 1: 30-Day Return Rule Logic Tests ---');

const mockServices = [
  { id: 's1', name: 'Patient Registration (New Patient)', category: 'registration', price: 150, status: 'active' },
  { id: 's2', name: 'Recent Patient Revisit Fee (≤30 Days)', category: 'registration', price: 100, status: 'active' }
];

const patientId = 'test-patient-uuid-1';
const today = new Date();

// Test 1: No prior visits or history (New patient)
const res1 = determineRegistrationFee(patientId, mockServices, [], []);
assert(res1.feeType === 'new_patient', 'No visits -> feeType is new_patient');
assert(res1.fee === 150, 'No visits -> fee is 150 ETB');
assert(res1.statusText === 'New patient registration', 'No visits -> statusText is "New patient registration"');
assert(res1.daysSinceLastVisit === null, 'No visits -> daysSinceLastVisit is null');
assert(res1.isRecent === false, 'No visits -> isRecent is false');

// Test 2: System visit 10 days ago (<= 30 days)
const visit10DaysAgo = {
  id: 'v1',
  patient_id: patientId,
  visit_date: format(subDays(today, 10), 'yyyy-MM-dd'),
  status: 'completed',
  consultation_completed: true
};
const res2 = determineRegistrationFee(patientId, mockServices, [visit10DaysAgo], []);
assert(res2.feeType === 'recent_patient', 'Visit 10d ago -> feeType is recent_patient');
assert(res2.fee === 100, 'Visit 10d ago -> fee is 100 ETB');
assert(res2.statusText === 'Visited within 30 days', 'Visit 10d ago -> statusText is "Visited within 30 days"');
assert(res2.daysSinceLastVisit === 10, `Visit 10d ago -> daysSinceLastVisit is 10 (got ${res2.daysSinceLastVisit})`);
assert(res2.isRecent === true, 'Visit 10d ago -> isRecent is true');

// Test 3: System visit 45 days ago (> 30 days)
const visit45DaysAgo = {
  id: 'v2',
  patient_id: patientId,
  visit_date: format(subDays(today, 45), 'yyyy-MM-dd'),
  status: 'completed',
  consultation_completed: true
};
const res3 = determineRegistrationFee(patientId, mockServices, [visit45DaysAgo], []);
assert(res3.feeType === 'returning_over_30_days', 'Visit 45d ago -> feeType is returning_over_30_days');
assert(res3.fee === 150, 'Visit 45d ago -> fee is 150 ETB');
assert(res3.statusText === 'More than 30 days since last visit', 'Visit 45d ago -> statusText is "More than 30 days since last visit"');
assert(res3.daysSinceLastVisit === 45, `Visit 45d ago -> daysSinceLastVisit is 45 (got ${res3.daysSinceLastVisit})`);
assert(res3.isRecent === false, 'Visit 45d ago -> isRecent is false');

// Test 4: Historical record from 18 days ago (Pre-EthioCare HMS, <= 30 days)
const hist18DaysAgo = {
  id: 'h1',
  patient_id: patientId,
  visit_date: format(subDays(today, 18), 'yyyy-MM-dd'),
  doctor_name: 'Dr. Former Physician',
  diagnosis: 'Acute Gastritis'
};
const res4 = determineRegistrationFee(patientId, mockServices, [], [hist18DaysAgo]);
assert(res4.feeType === 'recent_patient', 'Historical record 18d ago -> feeType is recent_patient');
assert(res4.fee === 100, 'Historical record 18d ago -> fee is 100 ETB');
assert(res4.statusText === 'Visited within 30 days', 'Historical record 18d ago -> statusText is "Visited within 30 days"');
assert(res4.daysSinceLastVisit === 18, `Historical record 18d ago -> daysSinceLastVisit is 18 (got ${res4.daysSinceLastVisit})`);
assert(res4.lastVisitSource === 'historical', 'Historical record 18d ago -> source is historical');

// Test 5: Historical record from 6 months ago (Pre-EthioCare HMS, > 30 days)
const hist180DaysAgo = {
  id: 'h2',
  patient_id: patientId,
  visit_date: format(subDays(today, 180), 'yyyy-MM-dd'),
  doctor_name: 'Dr. Former Physician',
  diagnosis: 'Malaria infection'
};
const res5 = determineRegistrationFee(patientId, mockServices, [], [hist180DaysAgo]);
assert(res5.feeType === 'returning_over_30_days', 'Historical record 180d ago -> feeType is returning_over_30_days');
assert(res5.fee === 150, 'Historical record 180d ago -> fee is 150 ETB');
assert(res5.statusText === 'More than 30 days since last visit', 'Historical record 180d ago -> statusText is "More than 30 days since last visit"');
assert(res5.daysSinceLastVisit === 180, `Historical record 180d ago -> daysSinceLastVisit is 180 (got ${res5.daysSinceLastVisit})`);

// Test 6: Multiple records (Old visit 90 days ago AND recent historical record 7 days ago)
const res6 = determineRegistrationFee(patientId, mockServices, [visit45DaysAgo], [
  hist180DaysAgo,
  {
    id: 'h3',
    patient_id: patientId,
    visit_date: format(subDays(today, 7), 'yyyy-MM-dd'),
    doctor_name: 'Dr. Recent Physician',
    diagnosis: 'Pneumonia'
  }
]);
assert(res6.feeType === 'recent_patient', 'Latest of multiple visits (7d ago) -> recent_patient discount');
assert(res6.fee === 100, 'Latest of multiple visits (7d ago) -> 100 ETB');
assert(res6.daysSinceLastVisit === 7, `Latest of multiple visits -> daysSinceLastVisit is 7 (got ${res6.daysSinceLastVisit})`);

// -----------------------------------------------------------------------------
// SECTION 2: HISTORICAL RECORD VALIDATION TESTS
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 2: Historical Record Validation Tests ---');

// Future date rejection
const futureValidation = validateHistoricalRecord({
  patient_id: 'p1',
  patient_name: 'Test Patient',
  visit_date: format(addDays(today, 5), 'yyyy-MM-dd'),
  doctor_name: 'Dr. Future',
  diagnosis: 'Future Condition'
});
assert(futureValidation.valid === false, 'Future visit date rejected by validation');
assert(futureValidation.error?.includes('future'), `Error mentions future: "${futureValidation.error}"`);

// Missing required fields
const missingDate = validateHistoricalRecord({
  patient_id: 'p1',
  patient_name: 'Test Patient',
  visit_date: '',
  doctor_name: 'Dr. Test',
  diagnosis: 'Condition'
});
assert(missingDate.valid === false, 'Missing visit date rejected');

const validPayload = {
  patient_id: 'p1',
  patient_name: 'Test Patient',
  visit_date: '2025-06-15',
  doctor_name: 'Dr. Solomon Haile',
  diagnosis: 'Hypertension Stage 2',
  disease: 'Essential HTN',
  symptoms: 'Occasional morning occipital headache',
  treatment: 'Amlodipine 5mg PO daily, low sodium diet',
  medicines: 'Amlodipine 5mg daily',
  lab_tests: 'Lipid panel, Serum Creatinine',
  lab_results: 'Cholesterol 190, Creatinine 0.9'
};
const validRes = validateHistoricalRecord(validPayload);
assert(validRes.valid === true, 'Proper historical payload passes validation');

// -----------------------------------------------------------------------------
// SECTION 3: LIVE SUPABASE INTEGRATION & RECEPTION WORKFLOW TESTS
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 3: Live Supabase CRUD & Reception Workflow Tests ---');

async function runLiveTests() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Authenticate as Receptionist
  console.log('Authenticating as Receptionist (almaz.t@grandhorizonhospital.com)...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'almaz.t@grandhorizonhospital.com',
    password: 'Hospital@2026'
  });

  if (authError) {
    console.error('❌ Authentication failed:', authError.message);
    failures++;
    return;
  }
  console.log('✓ Receptionist authenticated successfully');

  // 1. Create a test patient with unique ID
  const testPatientId = `PT-HIST-${Date.now().toString().slice(-6)}`;
  const { data: newPatient, error: patError } = await supabase.from('patients').insert({
    patient_id: testPatientId,
    full_name: 'Marta Tesfaye Historical Test',
    gender: 'Female',
    age: 35,
    phone: '+251911445566',
    address: 'Bole Subcity, Addis Ababa',
    registration_date: format(today, 'yyyy-MM-dd'),
    status: 'active'
  }).select().single();

  if (patError) {
    console.error('❌ Failed to insert test patient:', patError);
    failures++;
    return;
  }
  assert(newPatient && newPatient.id, `Test patient created with UUID: ${newPatient.id}`);

  // 2. Add multiple historical visits for this patient with EXACT original dates
  const originalDate1 = '2024-04-12';
  const originalDate2 = '2025-11-20';

  const { data: hist1, error: hErr1 } = await supabase.from('patient_history').insert({
    patient_id: newPatient.id,
    patient_name: newPatient.full_name,
    patient_phone: newPatient.phone,
    patient_gender: newPatient.gender,
    visit_id: null,
    visit_date: originalDate1,
    doctor_name: 'Dr. Dawit Bekele',
    doctor_specialty: 'Internal Medicine',
    diagnosis: 'Acute Peptic Ulcer Disease (H. pylori positive)',
    symptoms: 'Burning epigastric pain, nausea after meals',
    treatment: 'Triple therapy regimen for 14 days, antacids',
    prescription: 'Omeprazole 20mg BID, Clarithromycin 500mg BID, Amoxicillin 1000mg BID',
    lab_results: 'H. pylori stool antigen positive; CBC normal',
    notes: '[HISTORICAL RECORD - PRE-ETHIOCARE HMS]\nPaper chart card #38291 from legacy records archive.',
    record_type: 'visit'
  }).select().single();

  assert(!hErr1, `Historical visit 1 created (Date: ${originalDate1}, Doctor: Dr. Dawit Bekele)`);

  const { data: hist2, error: hErr2 } = await supabase.from('patient_history').insert({
    patient_id: newPatient.id,
    patient_name: newPatient.full_name,
    patient_phone: newPatient.phone,
    patient_gender: newPatient.gender,
    visit_id: null,
    visit_date: originalDate2,
    doctor_name: 'Dr. Selamawit Tadesse',
    doctor_specialty: 'Internal Medicine',
    diagnosis: 'Routine Medical Checkup & Follow-up',
    symptoms: 'Patient asymptomatic, requested blood pressure check',
    treatment: 'Lifestyle modification, annual lipid check advised',
    prescription: 'Multivitamins 1 tab daily',
    lab_results: 'FBS: 92 mg/dL, Lipid Panel: Desirable',
    blood_pressure: '118/78',
    temperature: '36.8',
    notes: '[HISTORICAL RECORD - PRE-ETHIOCARE HMS]\nLegacy chart checkup follow-up.',
    record_type: 'visit'
  }).select().single();

  assert(!hErr2, `Historical visit 2 created (Date: ${originalDate2}, Doctor: Dr. Selamawit Tadesse)`);

  // 3. Read back historical records (Doctor View simulation)
  const { data: fetchedHistory, error: fetchErr } = await supabase
    .from('patient_history')
    .select('*')
    .eq('patient_id', newPatient.id)
    .order('visit_date', { ascending: false });

  assert(!fetchErr && fetchedHistory.length === 2, `Doctor history query returned 2 historical visits (got ${fetchedHistory?.length})`);
  assert(fetchedHistory[0].visit_date === originalDate2, `Preserves exact original date 1: ${fetchedHistory[0]?.visit_date}`);
  assert(fetchedHistory[1].visit_date === originalDate1, `Preserves exact original date 2: ${fetchedHistory[1]?.visit_date}`);
  assert(fetchedHistory[0].doctor_name === 'Dr. Selamawit Tadesse', 'Preserves doctor name 1');
  assert(fetchedHistory[1].doctor_name === 'Dr. Dawit Bekele', 'Preserves doctor name 2');

  // 4. Test 30-day return rule evaluation for this live patient
  const liveAssessment = determineRegistrationFee(
    newPatient.id,
    mockServices,
    [],
    fetchedHistory
  );
  assert(liveAssessment.feeType === 'returning_over_30_days', 'Historical visits from 2024/2025 are >30 days ago');
  assert(liveAssessment.fee === 150, 'Standard registration tariff applied (150 ETB)');
  assert(liveAssessment.statusText === 'More than 30 days since last visit', 'Status text is "More than 30 days since last visit"');
  assert(liveAssessment.lastVisitDate === originalDate2, `Latest visit date matches most recent historical record (${originalDate2})`);

  // 5. Test registration payment record creation with payment gate
  const { data: regPayment, error: payErr } = await supabase.from('payments').insert({
    patient_id: newPatient.id,
    patient_name: newPatient.full_name,
    payment_type: 'registration',
    description: liveAssessment.serviceName || 'Patient Registration Fee',
    amount: liveAssessment.fee,
    status: 'pending',
    reference_type: 'registration'
  }).select().single();

  assert(!payErr && regPayment.id, `Registration payment created with status 'pending' and amount ${liveAssessment.fee} ETB`);

  // 6. Clean up all test records
  console.log('Cleaning up test records from database...');
  await supabase.from('payments').delete().eq('patient_id', newPatient.id);
  await supabase.from('patient_history').delete().eq('patient_id', newPatient.id);
  await supabase.from('patients').delete().eq('id', newPatient.id);
  console.log('✓ Cleanup complete.');

  console.log('\n' + '='.repeat(80));
  if (failures === 0) {
    console.log('🎉 ALL HISTORICAL PATIENT RECORD & 30-DAY RETURN TESTS PASSED (0 failures)');
  } else {
    console.error(`❌ ${failures} TEST(S) FAILED`);
    process.exit(1);
  }
  console.log('='.repeat(80));
}

runLiveTests().catch(err => {
  console.error('Unhandled error during test run:', err);
  process.exit(1);
});
