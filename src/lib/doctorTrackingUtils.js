import { format, parseISO, differenceInDays, formatDistanceToNow } from 'date-fns';

/**
 * 8-Step Canonical Patient Journey Stages
 */
export const JOURNEY_STAGES = [
  { id: 'registration', label: 'Registration', department: 'Reception / Front Desk' },
  { id: 'payment', label: 'Payment', department: 'Billing / Cashier' },
  { id: 'doctor', label: 'Doctor', department: 'Doctor Consultation' },
  { id: 'lab', label: 'Laboratory', department: 'Laboratory Room' },
  { id: 'billing', label: 'Billing', department: 'Billing / Cashier' },
  { id: 'nurse', label: 'Nurse', department: 'Nursing Station' },
  { id: 'pharmacy', label: 'Pharmacy', department: 'Pharmacy Dispensary' },
  { id: 'completed', label: 'Completed', department: 'Discharge / Concluded' },
];

/**
 * Enriches a visit record with real-time stage resolution, current room/department,
 * waiting items, next step, milestone completion, and activity timeline.
 */
export function enrichVisitRecord(v, {
  labOrders = [],
  medicationOrders = [],
  nurseTasks = [],
  prescriptions = [],
  payments = [],
  vitals = [],
  patients = []
} = {}) {
  const visitId = v.id;
  const patientId = v.patient_id;

  // Filter linked child records
  const vLabs = labOrders.filter(l => l.visit_id === visitId || (patientId && l.patient_id === patientId && l.created_at?.slice(0, 10) === v.visit_date));
  const vMeds = medicationOrders.filter(m => m.visit_id === visitId || (patientId && m.patient_id === patientId && m.created_at?.slice(0, 10) === v.visit_date));
  const vTasks = nurseTasks.filter(t => t.visit_id === visitId || (patientId && t.patient_id === patientId && t.created_at?.slice(0, 10) === v.visit_date));
  const vRx = prescriptions.filter(p => p.visit_id === visitId || (patientId && p.patient_id === patientId && p.created_at?.slice(0, 10) === v.visit_date));
  const vPayments = payments.filter(p => p.visit_id === visitId || (patientId && p.patient_id === patientId && p.created_at?.slice(0, 10) === v.visit_date));
  const vVitals = vitals.filter(vt => vt.visit_id === visitId || (patientId && vt.patient_id === patientId && vt.created_at?.slice(0, 10) === v.visit_date));
  const patientProfile = patients.find(p => p.id === patientId || p.patient_id === patientId);

  // Status flags
  const isRegPaid = v.registration_fee_paid === true || vPayments.some(p => (p.payment_type === 'registration' || p.reference_type === 'registration') && p.status === 'paid');
  const hasUnpaidRegistration = !isRegPaid;

  const hasLabOrders = vLabs.length > 0;
  const pendingPaymentLabs = vLabs.filter(l => l.payment_status === 'pending' || l.test_status === 'awaiting_payment');
  const inProgressLabs = vLabs.filter(l => l.test_status === 'in_progress' || l.test_status === 'pending');
  const completedLabs = vLabs.filter(l => l.test_status === 'completed');
  const allLabsCompleted = hasLabOrders && completedLabs.length === vLabs.length;

  const hasNurseTasks = vTasks.length > 0 || vMeds.length > 0;
  const pendingMeds = vMeds.filter(m => m.administration_status !== 'completed' && m.administration_status !== 'refused');
  const pendingTasks = vTasks.filter(t => t.status !== 'completed');
  const hasPendingNurseCare = pendingMeds.length > 0 || pendingTasks.length > 0;
  const pendingMedPayments = vMeds.filter(m => m.payment_status === 'pending_payment' || m.payment_status === 'pending');

  const hasPrescriptions = vRx.length > 0;
  const pendingRx = vRx.filter(r => r.status === 'pending');
  const pendingRxPayments = vRx.filter(r => r.payment_status === 'pending');

  const pendingPayments = vPayments.filter(p => p.status === 'pending' && p.payment_type !== 'registration');

  // Overall visit completion check
  const isCompleted = v.status === 'completed' || (
    v.consultation_completed === true &&
    pendingPaymentLabs.length === 0 &&
    inProgressLabs.length === 0 &&
    !hasPendingNurseCare &&
    pendingRx.length === 0 &&
    pendingPayments.length === 0
  );

  // Determine stage, room, and department
  let stageId = 'doctor';
  let stageLabel = 'In Consultation';
  let room = 'Doctor Consultation Room';
  let department = 'Doctor Consultation';
  let waitingOn = 'None';
  let nextStep = 'Doctor examination and treatment planning';

  if (v.status === 'cancelled') {
    stageId = 'completed';
    stageLabel = 'Cancelled';
    room = 'Archived / Cancelled';
    department = 'Records';
    waitingOn = 'None';
    nextStep = 'Visit cancelled';
  } else if (isCompleted) {
    stageId = 'completed';
    stageLabel = 'Treatment Completed';
    room = 'Discharged / Concluded';
    department = 'Outpatient Discharge';
    waitingOn = 'None';
    nextStep = v.follow_up_date ? `Follow-up scheduled on ${v.follow_up_date}` : 'Patient discharged';
  } else if (hasUnpaidRegistration) {
    stageId = 'payment';
    stageLabel = 'Registration Payment';
    room = 'Billing & Registration Desk';
    department = 'Cashier / Billing';
    waitingOn = 'Settlement of patient registration fee';
    nextStep = 'Cashier to collect registration fee at billing desk';
  } else if (pendingPaymentLabs.length > 0) {
    stageId = 'billing';
    stageLabel = 'Awaiting Lab Payment';
    room = 'Billing / Cashier Desk';
    department = 'Billing / Cashier';
    waitingOn = `Lab payment for ${pendingPaymentLabs.map(l => l.test_name).join(', ')}`;
    nextStep = 'Patient to pay lab fee at billing desk';
  } else if (pendingMedPayments.length > 0) {
    stageId = 'billing';
    stageLabel = 'Awaiting Procedure Payment';
    room = 'Billing / Cashier Desk';
    department = 'Billing / Cashier';
    waitingOn = `Payment for nursing procedure/medication`;
    nextStep = 'Patient to pay procedure fee at cashier desk';
  } else if (inProgressLabs.length > 0) {
    stageId = 'lab';
    const isInTesting = inProgressLabs.some(l => l.test_status === 'in_progress');
    stageLabel = isInTesting ? 'Lab Testing in Progress' : 'Sample Collection / Pending Lab';
    room = isInTesting ? 'Laboratory Testing Room' : 'Laboratory Sample Station';
    department = 'Laboratory';
    waitingOn = `Lab test results for ${inProgressLabs.map(l => l.test_name).join(', ')}`;
    nextStep = 'Lab technician to complete testing and upload results';
  } else if (allLabsCompleted && !v.consultation_completed) {
    stageId = 'doctor';
    stageLabel = 'Lab Results Ready';
    room = 'Doctor Consultation Room';
    department = 'Doctor Consultation';
    waitingOn = 'Doctor review of completed lab report';
    nextStep = 'Doctor to review lab findings and finalize clinical diagnosis';
  } else if (hasPendingNurseCare) {
    stageId = 'nurse';
    stageLabel = 'Under Nursing Care';
    room = 'Nursing Station / Procedure Room';
    department = 'Nursing Care';
    const medNames = pendingMeds.map(m => m.item_name || m.medication_name).join(', ');
    const taskNames = pendingTasks.map(t => t.description || t.task_type).join(', ');
    waitingOn = `Nurse administration: ${[medNames, taskNames].filter(Boolean).join('; ')}`;
    nextStep = 'Nurse to administer medication / procedure and record vitals';
  } else if (pendingRxPayments.length > 0) {
    stageId = 'billing';
    stageLabel = 'Awaiting Medicine Payment';
    room = 'Billing / Cashier Desk';
    department = 'Billing / Cashier';
    waitingOn = `Settlement of prescription bill (${pendingRxPayments.length} item${pendingRxPayments.length > 1 ? 's' : ''})`;
    nextStep = 'Patient to settle medicine invoice at billing desk';
  } else if (v.status === 'pharmacy' || pendingRx.length > 0) {
    stageId = 'pharmacy';
    stageLabel = 'At Pharmacy Dispensary';
    room = 'Pharmacy Dispensary Window';
    department = 'Pharmacy';
    waitingOn = `Dispensation of ${vRx.map(r => r.medicine_name).join(', ')}`;
    nextStep = 'Pharmacist to verify prescription and dispense medications';
  } else if (pendingPayments.length > 0) {
    stageId = 'billing';
    stageLabel = 'Pending Billing Settlement';
    room = 'Billing / Cashier Desk';
    department = 'Billing / Cashier';
    waitingOn = `Settlement of pending invoice (${pendingPayments.length} item${pendingPayments.length > 1 ? 's' : ''})`;
    nextStep = 'Cashier to collect invoice payment';
  } else if (v.status === 'with_doctor') {
    stageId = 'doctor';
    stageLabel = 'In Consultation';
    room = 'Doctor Consultation Room';
    department = 'Doctor Consultation';
    waitingOn = 'Clinical consultation in progress';
    nextStep = 'Doctor examining patient and establishing treatment plan';
  } else if (v.status === 'waiting') {
    stageId = 'doctor';
    stageLabel = 'Waiting for Doctor';
    room = 'Doctor Waiting Area';
    department = 'Doctor Consultation';
    waitingOn = 'Patient waiting in queue';
    nextStep = 'Doctor to call patient in for consultation';
  }

  // Calculate Completed Milestones
  const completedItems = [];
  if (isRegPaid) completedItems.push('Registration fee settled');
  if (vVitals.length > 0) completedItems.push(`Vitals recorded (${vVitals[0].blood_pressure || 'BP normal'})`);
  if (v.symptoms || v.examination_notes) completedItems.push('Initial examination performed');
  if (completedLabs.length > 0) completedItems.push(`Lab tests completed (${completedLabs.length} test${completedLabs.length > 1 ? 's' : ''})`);
  if (vMeds.some(m => m.administration_status === 'completed')) completedItems.push('Nursing medication administered');
  if (vRx.some(r => r.status === 'dispensed')) completedItems.push('Prescription medications dispensed');
  if (v.consultation_completed) completedItems.push('Doctor consultation finalized');
  if (isCompleted) completedItems.push('Outpatient visit concluded');

  // Calculate Last Activity Time across all linked items
  const timestamps = [
    v.updated_at,
    v.created_at,
    ...vLabs.flatMap(l => [l.updated_at, l.created_at]),
    ...vMeds.flatMap(m => [m.updated_at, m.created_at]),
    ...vTasks.flatMap(t => [t.updated_at, t.created_at]),
    ...vRx.flatMap(r => [r.updated_at, r.created_at]),
    ...vPayments.flatMap(p => [p.updated_at, p.created_at]),
    ...vVitals.flatMap(vt => [vt.created_at])
  ].filter(Boolean);

  let latestDate = null;
  timestamps.forEach(ts => {
    try {
      const d = parseISO(ts);
      if (!isNaN(d.getTime())) {
        if (!latestDate || d > latestDate) latestDate = d;
      }
    } catch {
      // ignore parse errors
    }
  });

  const lastActivityRelative = latestDate
    ? formatDistanceToNow(latestDate, { addSuffix: true })
    : 'Recently';
  const lastActivityFormatted = latestDate
    ? format(latestDate, 'yyyy-MM-dd HH:mm')
    : v.created_at || '';

  // Calculate Days Ongoing
  let daysOngoing = 0;
  try {
    const startDate = v.visit_date ? parseISO(v.visit_date) : (v.created_at ? parseISO(v.created_at.slice(0, 10)) : new Date());
    if (!isNaN(startDate.getTime())) {
      daysOngoing = Math.max(0, differenceInDays(new Date(), startDate));
    }
  } catch {
    daysOngoing = 0;
  }

  const isOngoing = !isCompleted && v.status !== 'cancelled';

  // Build 8-Stage Canonical Timeline
  const stageOrder = ['registration', 'payment', 'doctor', 'lab', 'billing', 'nurse', 'pharmacy', 'completed'];
  const currentStageIndex = stageOrder.indexOf(stageId);

  const stageTimeline = JOURNEY_STAGES.map((s, idx) => {
    let status = 'upcoming';
    let note = '';

    if (isCompleted) {
      status = 'completed';
    } else if (idx < currentStageIndex) {
      status = 'completed';
    } else if (idx === currentStageIndex) {
      status = 'current';
      note = waitingOn;
    } else {
      status = 'upcoming';
    }

    // Specific Stage Annotations
    if (s.id === 'registration' && isRegPaid) {
      status = 'completed';
      note = 'Fee paid';
    }
    if (s.id === 'lab') {
      if (allLabsCompleted) {
        status = 'completed';
        note = `${completedLabs.length} test(s) completed`;
      } else if (inProgressLabs.length > 0) {
        status = 'current';
        note = 'Testing in progress';
      }
    }
    if (s.id === 'nurse') {
      if (hasNurseTasks && !hasPendingNurseCare) {
        status = 'completed';
        note = 'Care completed';
      }
    }
    if (s.id === 'pharmacy') {
      if (hasPrescriptions && pendingRx.length === 0) {
        status = 'completed';
        note = 'Medicines dispensed';
      }
    }

    return {
      ...s,
      status,
      note: note || (status === 'completed' ? 'Done' : 'Pending')
    };
  });

  return {
    ...v,
    patientProfile,
    patient_full_name: patientProfile?.full_name || v.patient_name,
    patient_phone: patientProfile?.phone || '',
    patient_gender: patientProfile?.gender || '',
    patient_age: patientProfile?.age || '',
    patient_blood_group: patientProfile?.blood_group || '',
    currentStage: {
      id: stageId,
      label: stageLabel,
      room,
      department
    },
    waitingOn,
    nextStep,
    completedItems,
    lastActivityTime: {
      relative: lastActivityRelative,
      formatted: lastActivityFormatted,
      date: latestDate
    },
    isOngoing,
    daysOngoing,
    stageTimeline,
    childRecords: {
      labs: vLabs,
      medOrders: vMeds,
      nurseTasks: vTasks,
      prescriptions: vRx,
      payments: vPayments,
      vitals: vVitals
    }
  };
}
