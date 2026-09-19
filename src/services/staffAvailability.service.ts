import { ethioCareClient } from '@/api/ethioCareClient';

export interface StaffWorkloadSummary {
  id: string;
  name: string;
  email?: string;
  role: string;
  department?: string;
  status: 'available' | 'in_consultation' | 'busy' | 'assigned' | 'on_break' | 'offline';
  statusLabel: string;
  statusColor: string; // Tailwind color classes
  badgeClass: string;
  activeCount: number;
  waitingCount: number;
  totalWorkload: number;
  currentActivity?: string;
}

/**
 * Doctor Workload & Availability Calculation
 */
export function calculateDoctorAvailability(
  doctor: { id: string; full_name?: string; name?: string; email?: string; specialty?: string; status?: string; availability?: string },
  activeVisits: any[] = []
): StaffWorkloadSummary {
  const doctorId = doctor.id;
  const doctorName = (doctor.full_name || doctor.name || '').trim().toLowerCase();

  // Find visits matching this doctor
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

  let status: StaffWorkloadSummary['status'] = 'available';
  let statusLabel = 'Available';
  let statusColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  let badgeClass = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  let currentActivity = 'Ready for patients';

  if (doctor.status === 'inactive' || doctor.availability === 'offline') {
    status = 'offline';
    statusLabel = 'Offline';
    statusColor = 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    badgeClass = 'bg-slate-500/15 text-slate-400 border-slate-500/30';
    currentActivity = 'Off shift';
  } else if (doctor.availability === 'on_break') {
    status = 'on_break';
    statusLabel = 'On Break';
    statusColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    badgeClass = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    currentActivity = 'Temporary break';
  } else if (activeCount > 0 && waitingCount >= 2) {
    status = 'busy';
    statusLabel = 'Busy';
    statusColor = 'text-red-400 bg-red-500/10 border-red-500/20';
    badgeClass = 'bg-red-500/15 text-red-400 border-red-500/30';
    currentActivity = `Consulting (${waitingCount} waiting)`;
  } else if (activeCount > 0) {
    status = 'in_consultation';
    statusLabel = 'In Consultation';
    statusColor = 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    badgeClass = 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    currentActivity = activeConsultation?.patient_name ? `Consulting ${activeConsultation.patient_name}` : 'In consultation';
  } else if (waitingCount > 0) {
    status = 'assigned';
    statusLabel = `Waiting (${waitingCount})`;
    statusColor = 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
    badgeClass = 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
    currentActivity = `${waitingCount} queued`;
  }

  return {
    id: doctor.id,
    name: doctor.full_name || doctor.name || 'Doctor',
    email: doctor.email,
    role: 'doctor',
    department: (doctor as any).department || (doctor as any).specialty || 'OPD',
    status,
    statusLabel,
    statusColor,
    badgeClass,
    activeCount,
    waitingCount,
    totalWorkload,
    currentActivity,
  };
}

/**
 * Nurse Workload & Availability Calculation
 */
export function calculateNurseAvailability(
  nurse: { id: string; full_name?: string; name?: string; email?: string; status?: string },
  tasks: any[] = [],
  medOrders: any[] = []
): StaffWorkloadSummary {
  const nurseId = nurse.id;
  const nurseName = (nurse.full_name || nurse.name || '').trim().toLowerCase();

  const activeTasks = tasks.filter(t => {
    if (t.status === 'completed' || t.status === 'cancelled') return false;
    const matchId = t.assigned_nurse_id && String(t.assigned_nurse_id) === String(nurseId);
    const matchName = t.assigned_nurse_name && String(t.assigned_nurse_name).trim().toLowerCase() === nurseName;
    return matchId || matchName;
  });

  const activeMeds = medOrders.filter(m => {
    const status = m.administration_status || m.status;
    if (status === 'administered' || status === 'completed' || status === 'cancelled') return false;
    const matchId = m.assigned_nurse_id && String(m.assigned_nurse_id) === String(nurseId);
    const matchName = m.assigned_nurse_name && String(m.assigned_nurse_name).trim().toLowerCase() === nurseName;
    return matchId || matchName;
  });

  const totalWorkload = activeTasks.length + activeMeds.length;

  let status: StaffWorkloadSummary['status'] = 'available';
  let statusLabel = 'Available';
  let statusColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  let badgeClass = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  let currentActivity = 'Available for orders & care';

  if (nurse.status === 'inactive') {
    status = 'offline';
    statusLabel = 'Offline';
    statusColor = 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    badgeClass = 'bg-slate-500/15 text-slate-400 border-slate-500/30';
    currentActivity = 'Off shift';
  } else if (totalWorkload > 3) {
    status = 'busy';
    statusLabel = `Busy (${totalWorkload} tasks)`;
    statusColor = 'text-red-400 bg-red-500/10 border-red-500/20';
    badgeClass = 'bg-red-500/15 text-red-400 border-red-500/30';
    currentActivity = `${totalWorkload} active nursing duties`;
  } else if (totalWorkload > 0) {
    status = 'assigned';
    statusLabel = `Assigned (${totalWorkload})`;
    statusColor = 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    badgeClass = 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    currentActivity = `${totalWorkload} pending tasks`;
  }

  return {
    id: nurse.id,
    name: nurse.full_name || nurse.name || 'Nurse',
    email: nurse.email,
    role: 'nurse',
    department: 'Nursing',
    status,
    statusLabel,
    statusColor,
    badgeClass,
    activeCount: totalWorkload,
    waitingCount: 0,
    totalWorkload,
    currentActivity,
  };
}

/**
 * Lab Assistant Workload & Availability Calculation
 */
export function calculateLabAssistantAvailability(
  assistant: { id: string; full_name?: string; name?: string; email?: string; status?: string },
  labOrders: any[] = []
): StaffWorkloadSummary {
  const assistantId = assistant.id;
  const assistantName = (assistant.full_name || assistant.name || '').trim().toLowerCase();

  // Active tests that are PAID and not yet completed
  const activeOrders = labOrders.filter(o => {
    const isCompleted = o.test_status === 'completed' || o.status === 'completed';
    if (isCompleted) return false;
    const isPaid = o.payment_status === 'paid';
    if (!isPaid) return false; // Payment gate preserved

    const matchId = o.assigned_assistant_id && String(o.assigned_assistant_id) === String(assistantId);
    const matchName = o.assigned_assistant_name && String(o.assigned_assistant_name).trim().toLowerCase() === assistantName;
    return matchId || matchName;
  });

  const inProgressTests = activeOrders.filter(o => o.test_status === 'in_progress');
  const pendingTests = activeOrders.filter(o => o.test_status !== 'in_progress');

  const activeCount = inProgressTests.length;
  const waitingCount = pendingTests.length;
  const totalWorkload = activeCount + waitingCount;

  let status: StaffWorkloadSummary['status'] = 'available';
  let statusLabel = 'Available';
  let statusColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  let badgeClass = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  let currentActivity = 'Available for diagnostic tests';

  if (assistant.status === 'inactive') {
    status = 'offline';
    statusLabel = 'Offline';
    statusColor = 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    badgeClass = 'bg-slate-500/15 text-slate-400 border-slate-500/30';
    currentActivity = 'Off shift';
  } else if (activeCount > 0 && waitingCount >= 2) {
    status = 'busy';
    statusLabel = 'Busy';
    statusColor = 'text-red-400 bg-red-500/10 border-red-500/20';
    badgeClass = 'bg-red-500/15 text-red-400 border-red-500/30';
    currentActivity = `Testing in progress (${waitingCount} in queue)`;
  } else if (activeCount > 0) {
    status = 'in_consultation';
    statusLabel = 'In Progress';
    statusColor = 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    badgeClass = 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    currentActivity = 'Running diagnostic analysis';
  } else if (waitingCount > 0) {
    status = 'assigned';
    statusLabel = `Assigned (${waitingCount})`;
    statusColor = 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
    badgeClass = 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
    currentActivity = `${waitingCount} test(s) queued`;
  }

  return {
    id: assistant.id,
    name: assistant.full_name || assistant.name || 'Lab Assistant',
    email: assistant.email,
    role: 'lab_technician',
    department: 'Laboratory',
    status,
    statusLabel,
    statusColor,
    badgeClass,
    activeCount,
    waitingCount,
    totalWorkload,
    currentActivity,
  };
}

/**
 * Fetch all staff and their live availability engine results
 */
export async function loadHospitalStaffAvailability() {
  try {
    const [staffList, docList, visitsList, tasksList, medOrdersList, labOrdersList] = await Promise.all([
      ethioCareClient.entities.Staff.list().catch(() => []),
      ethioCareClient.entities.Doctor.list().catch(() => []),
      ethioCareClient.entities.Visit.list().catch(() => []),
      ethioCareClient.entities.NurseTask.list().catch(() => []),
      ethioCareClient.entities.MedicationOrder.list().catch(() => []),
      ethioCareClient.entities.LabOrder.list().catch(() => []),
    ]);

    // Active visits (today or not completed)
    const activeVisits = (visitsList || []).filter((v: any) => v.status !== 'completed' && v.status !== 'cancelled');

    // 1. Doctors
    // Deduplicate doctors between Doctor entity and Staff table
    const doctorsCombined: any[] = [];
    const seenDocIds = new Set<string>();
    const seenDocNames = new Set<string>();

    (docList || []).forEach((d: any) => {
      const nameKey = (d.full_name || d.name || '').toLowerCase().trim();
      if (!seenDocIds.has(d.id) && !seenDocNames.has(nameKey)) {
        seenDocIds.add(d.id);
        if (nameKey) seenDocNames.add(nameKey);
        doctorsCombined.push(d);
      }
    });

    (staffList || []).filter((s: any) => s.role === 'doctor').forEach((s: any) => {
      const nameKey = (s.full_name || s.name || '').toLowerCase().trim();
      if (!seenDocIds.has(s.id) && !seenDocNames.has(nameKey)) {
        seenDocIds.add(s.id);
        if (nameKey) seenDocNames.add(nameKey);
        doctorsCombined.push(s);
      }
    });

    const doctors = doctorsCombined.map(d => calculateDoctorAvailability(d, activeVisits));

    // 2. Nurses
    const nurseStaff = (staffList || []).filter((s: any) => s.role === 'nurse');
    // Fallback default nurses if none created yet
    const baseNurses = nurseStaff.length > 0 ? nurseStaff : [
      { id: 'stf-4', full_name: 'Sister Tigist Mengistu', role: 'nurse', email: 'tigist.m@grandhorizonhospital.com' },
      { id: 'stf-nurse-2', full_name: 'Nurse Hana Bekele', role: 'nurse', email: 'hana.b@grandhorizonhospital.com' },
    ];
    const nurses = baseNurses.map((n: any) => calculateNurseAvailability(n, tasksList || [], medOrdersList || []));

    // 3. Lab Assistants
    const labStaff = (staffList || []).filter((s: any) => s.role === 'lab_technician' || s.role === 'lab_assistant');
    const baseLabStaff = labStaff.length > 0 ? labStaff : [
      { id: 'stf-6', full_name: 'Kidus Worku', role: 'lab_technician', email: 'kidus.w@grandhorizonhospital.com' },
      { id: 'stf-lab-2', full_name: 'Dawit Lab Technician', role: 'lab_technician', email: 'dawit.lab@grandhorizonhospital.com' },
    ];
    const labAssistants = baseLabStaff.map((l: any) => calculateLabAssistantAvailability(l, labOrdersList || []));

    return {
      doctors,
      nurses,
      labAssistants,
      activeVisits,
    };
  } catch (err) {
    console.error('Failed to load hospital staff availability:', err);
    return {
      doctors: [],
      nurses: [],
      labAssistants: [],
      activeVisits: [],
    };
  }
}
