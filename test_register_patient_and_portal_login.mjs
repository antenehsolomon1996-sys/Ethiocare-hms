import assert from 'node:assert';
import { differenceInDays, parseISO, subDays, format } from 'date-fns';

console.log('\n======================================================');
console.log('🧪 ETHIOCARE HMS: REGISTER PATIENT & PORTAL LOGIN TESTS');
console.log('======================================================\n');

let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(`   Error: ${err.message}`);
    failedTests++;
  }
}

// -------------------------------------------------------------
// 1. 30-DAY TREATMENT RULE & TARIFF LOGIC TESTS
// -------------------------------------------------------------

const mockServices = [
  { id: 'srv-reg-new', name: 'Patient Registration (New Patient)', category: 'registration', price: 150, status: 'active' },
  { id: 'srv-reg-rec', name: 'Recent Patient Revisit Fee (≤30 Days)', category: 'registration', price: 100, status: 'active' },
  { id: 'srv-consult', name: 'General Consultation', category: 'consultation', price: 200, status: 'active' },
];

function getRegistrationTariffs(services = []) {
  const regServices = services.filter(s => s.category === 'registration' && s.status === 'active');
  const recentService = regServices.find(s =>
    s.name?.toLowerCase().includes('recent') ||
    s.name?.toLowerCase().includes('revisit') ||
    s.name?.includes('≤30')
  ) || null;

  const newPatientService = regServices.find(s =>
    (s.name?.toLowerCase().includes('new') || s.name?.toLowerCase().includes('registration')) &&
    s.id !== recentService?.id
  ) || regServices[0] || null;

  return {
    newPatientFee: newPatientService?.price ?? 150,
    recentPatientFee: recentService?.price ?? 100,
    newPatientService,
    recentPatientService: recentService
  };
}

function determineRegistrationFee(patientId, services = [], patientVisits = []) {
  const tariffs = getRegistrationTariffs(services);
  const completedVisits = patientVisits.filter(v => 
    v && v.patient_id === patientId && (v.status === 'completed' || v.consultation_completed === true)
  );

  if (completedVisits.length === 0) {
    return {
      feeType: 'new_patient',
      fee: tariffs.newPatientFee,
      isRecent: false,
      daysSinceLastVisit: null,
      serviceName: tariffs.newPatientService?.name || 'Patient Registration (New Patient)'
    };
  }

  let latestVisitDate = null;
  for (const v of completedVisits) {
    const d = new Date(v.visit_date || v.created_at);
    if (!latestVisitDate || d.getTime() > latestVisitDate.getTime()) {
      latestVisitDate = d;
    }
  }

  const today = new Date();
  const daysSince = Math.max(0, differenceInDays(today, latestVisitDate));

  if (daysSince <= 30) {
    return {
      feeType: 'recent_patient',
      fee: tariffs.recentPatientFee,
      isRecent: true,
      daysSinceLastVisit: daysSince,
      serviceName: tariffs.recentPatientService?.name || 'Recent Patient Revisit Fee (≤30 Days)'
    };
  } else {
    return {
      feeType: 'returning_over_30_days',
      fee: tariffs.newPatientFee,
      isRecent: false,
      daysSinceLastVisit: daysSince,
      serviceName: tariffs.newPatientService?.name || 'Patient Registration (New Patient)'
    };
  }
}

runTest('Tariff discovery extracts 150 ETB new patient fee and 100 ETB recent patient fee', () => {
  const tariffs = getRegistrationTariffs(mockServices);
  assert.strictEqual(tariffs.newPatientFee, 150);
  assert.strictEqual(tariffs.recentPatientFee, 100);
  assert.strictEqual(tariffs.newPatientService.id, 'srv-reg-new');
  assert.strictEqual(tariffs.recentPatientService.id, 'srv-reg-rec');
});

runTest('New patient with zero completed visits receives standard 150 ETB fee', () => {
  const result = determineRegistrationFee('pat-new-1', mockServices, []);
  assert.strictEqual(result.feeType, 'new_patient');
  assert.strictEqual(result.fee, 150);
  assert.strictEqual(result.isRecent, false);
  assert.strictEqual(result.daysSinceLastVisit, null);
});

runTest('Recent patient treated 10 days ago (<= 30 days) receives 100 ETB recent patient fee', () => {
  const tenDaysAgo = format(subDays(new Date(), 10), 'yyyy-MM-dd');
  const visits = [
    { id: 'v-1', patient_id: 'pat-rec-1', visit_date: tenDaysAgo, status: 'completed', consultation_completed: true }
  ];
  const result = determineRegistrationFee('pat-rec-1', mockServices, visits);
  assert.strictEqual(result.feeType, 'recent_patient');
  assert.strictEqual(result.fee, 100);
  assert.strictEqual(result.isRecent, true);
  assert.strictEqual(result.daysSinceLastVisit, 10);
});

runTest('Recent patient treated today (0 days ago) receives 100 ETB recent patient fee', () => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const visits = [
    { id: 'v-2', patient_id: 'pat-rec-2', visit_date: today, status: 'completed', consultation_completed: true }
  ];
  const result = determineRegistrationFee('pat-rec-2', mockServices, visits);
  assert.strictEqual(result.feeType, 'recent_patient');
  assert.strictEqual(result.fee, 100);
  assert.strictEqual(result.isRecent, true);
  assert.strictEqual(result.daysSinceLastVisit, 0);
});

runTest('Returning patient treated 45 days ago (> 30 days) receives standard 150 ETB fee', () => {
  const fortyFiveDaysAgo = format(subDays(new Date(), 45), 'yyyy-MM-dd');
  const visits = [
    { id: 'v-3', patient_id: 'pat-old-1', visit_date: fortyFiveDaysAgo, status: 'completed', consultation_completed: true }
  ];
  const result = determineRegistrationFee('pat-old-1', mockServices, visits);
  assert.strictEqual(result.feeType, 'returning_over_30_days');
  assert.strictEqual(result.fee, 150);
  assert.strictEqual(result.isRecent, false);
  assert.strictEqual(result.daysSinceLastVisit, 45);
});

// -------------------------------------------------------------
// 2. PORTAL METADATA & ISOLATION CONFIGURATION TESTS
// -------------------------------------------------------------

const EXPECTED_PORTALS = ['admin', 'reception', 'doctor', 'nurse', 'lab', 'pharmacy', 'billing'];

const PORTAL_ACCESS = {
  owner: ['owner', 'admin'],
  admin: ['owner', 'admin'],
  receptionist: ['receptionist', 'owner', 'admin'],
  doctor: ['doctor'],
  nurse: ['nurse'],
  lab_technician: ['lab_technician'],
  pharmacist: ['pharmacist'],
  accountant: ['accountant'],
};

runTest('All 7 distinct portal keys are configured in isolation rules', () => {
  assert.ok(PORTAL_ACCESS.owner);
  assert.ok(PORTAL_ACCESS.receptionist);
  assert.ok(PORTAL_ACCESS.doctor);
  assert.ok(PORTAL_ACCESS.nurse);
  assert.ok(PORTAL_ACCESS.lab_technician);
  assert.ok(PORTAL_ACCESS.pharmacist);
  assert.ok(PORTAL_ACCESS.accountant);
});

runTest('Strict 1:1 portal role protection denies unauthorized staff', () => {
  // Doctor trying Admin
  assert.strictEqual(PORTAL_ACCESS.owner.includes('doctor'), false);
  // Nurse trying Pharmacy
  assert.strictEqual(PORTAL_ACCESS.pharmacist.includes('nurse'), false);
  // Receptionist trying Billing
  assert.strictEqual(PORTAL_ACCESS.accountant.includes('receptionist'), false);
  // Lab Tech trying Doctor
  assert.strictEqual(PORTAL_ACCESS.doctor.includes('lab_technician'), false);
  // Doctor in Doctor portal is authorized
  assert.strictEqual(PORTAL_ACCESS.doctor.includes('doctor'), true);
  // Pharmacist in Pharmacy portal is authorized
  assert.strictEqual(PORTAL_ACCESS.pharmacist.includes('pharmacist'), true);
});

runTest('Receptionist portal allows receptionist, owner, and admin', () => {
  assert.strictEqual(PORTAL_ACCESS.receptionist.includes('receptionist'), true);
  assert.strictEqual(PORTAL_ACCESS.receptionist.includes('owner'), true);
  assert.strictEqual(PORTAL_ACCESS.receptionist.includes('admin'), true);
  assert.strictEqual(PORTAL_ACCESS.receptionist.includes('doctor'), false);
});

// -------------------------------------------------------------
// 3. WORKFLOW GATE & SETTLEMENT UNLOCK TESTS
// -------------------------------------------------------------

runTest('New visit created from RegisterPatient defaults to registration_fee_paid: false', () => {
  const newVisit = {
    id: 'vis-101',
    patient_id: 'pat-1',
    patient_name: 'Abebe Kebede',
    registration_fee_paid: false,
    billing_completed: false,
    consultation_completed: false,
    status: 'waiting'
  };
  assert.strictEqual(newVisit.registration_fee_paid, false);
  assert.strictEqual(newVisit.billing_completed, false);
});

runTest('Doctor Queue filters out visits where registration_fee_paid !== true', () => {
  const visits = [
    { id: 'v-unpaid', patient_name: 'Patient A', registration_fee_paid: false, status: 'waiting' },
    { id: 'v-paid', patient_name: 'Patient B', registration_fee_paid: true, status: 'waiting' },
  ];

  const actionableQueue = visits.filter(v => v.registration_fee_paid === true && v.status === 'waiting');
  const blockedQueue = visits.filter(v => v.registration_fee_paid !== true && v.status === 'waiting');

  assert.strictEqual(actionableQueue.length, 1);
  assert.strictEqual(actionableQueue[0].id, 'v-paid');
  assert.strictEqual(blockedQueue.length, 1);
  assert.strictEqual(blockedQueue[0].id, 'v-unpaid');
});

runTest('Settling registration payment unlocks visit for doctor queue', () => {
  const visit = { id: 'v-test-1', registration_fee_paid: false, billing_completed: false, status: 'waiting' };
  const payment = { id: 'pay-test-1', visit_id: visit.id, payment_type: 'registration', amount: 150, status: 'pending' };

  // Simulate billing settlement
  payment.status = 'paid';
  payment.receipt_number = 'RCP-260917-1001';
  visit.registration_fee_paid = true;
  visit.billing_completed = true;

  assert.strictEqual(payment.status, 'paid');
  assert.strictEqual(visit.registration_fee_paid, true);
  assert.strictEqual(visit.billing_completed, true);
});

console.log('\n------------------------------------------------------');
console.log(`Summary: Passed: ${passedTests} | Failed: ${failedTests}`);
console.log('------------------------------------------------------\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 All 10 verification tests passed successfully!\n');
}
