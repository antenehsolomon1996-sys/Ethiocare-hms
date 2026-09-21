import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import { useDoctorContext } from '@/lib/DoctorContext';
import StatusBadge from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Stethoscope, FlaskConical, Pill, ClipboardList, History, User, Syringe, AlertTriangle, ChevronLeft, Sparkles, Building2 } from 'lucide-react';
import MedicationOrderForm from '@/components/doctor/MedicationOrderForm';
import AIClinicalAssistant from '@/components/doctor/AIClinicalAssistant';
import { format } from 'date-fns';
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import PatientHistoryView from '@/pages/shared/PatientHistoryView';
import { logAudit } from '@/lib/auditLogger';
import { notificationService } from '@/services/notification.service';
import { useIsMobile } from '@/hooks/use-mobile';
import { calculateLabAssistantAvailability } from '@/services/staffAvailability.service';

export default function DoctorQueue() {
  const { selectedDoctor } = useDoctorContext();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [selected, setSelected] = useState(null);
  const [labForm, setLabForm] = useState({ test_type: 'Blood Test', test_name: '', notes: '', lab_test_id: '', assigned_assistant_id: '', assigned_assistant_name: '' });
  const [prescForm, setPrescForm] = useState({ medicine_name: '', medicine_id: '', dosage: '', frequency: '', duration: '', quantity: '1', instructions: '' });
  const [examForm, setExamForm] = useState({ symptoms: '', examination_notes: '', diagnosis: '', disease: '', treatment_plan: '' });
  const [finalForm, setFinalForm] = useState({ final_diagnosis: '', final_treatment: '', follow_up_date: '', follow_up_notes: '' });
  const [bedModalOpen, setBedModalOpen] = useState(false);
  const [bedRequestForm, setBedRequestForm] = useState({ department: 'Inpatient Ward', notes: '' });

  const { data: visits = [] } = useQuery({
    queryKey: ['visits'],
    queryFn: () => ethioCareClient.entities.Visit.list('-created_date', 200),
    refetchInterval: 10000,
    staleTime: 30000
  });
  const { data: labOrders = [] } = useQuery({ queryKey: ['labOrders'], queryFn: () => ethioCareClient.entities.LabOrder.list('-created_date', 200) });
  const { data: prescriptions = [] } = useQuery({ queryKey: ['prescriptions'], queryFn: () => ethioCareClient.entities.Prescription.list('-created_date', 200) });
  const { data: medicationOrders = [] } = useQuery({ queryKey: ['medicationOrders'], queryFn: () => ethioCareClient.entities.MedicationOrder.list('-created_date', 200) });
  const { data: availableLabTests = [] } = useQuery({ queryKey: ['labTests'], queryFn: () => ethioCareClient.entities.LabTest.list() });
  const { data: availableMedicines = [] } = useQuery({ queryKey: ['medicines'], queryFn: () => ethioCareClient.entities.Medicine.list() });
  const { data: staffList = [] } = useQuery({ queryKey: ['staff'], queryFn: () => ethioCareClient.entities.Staff.list() });

  const labAssistantsWithAvailability = useMemo(() => {
    const rawStaff = staffList.filter(s => s.role === 'lab_technician' || s.role === 'lab_assistant');
    const base = rawStaff.length > 0 ? rawStaff : [
      { id: 'stf-6', full_name: 'Kidus Worku', role: 'lab_technician' },
      { id: 'stf-lab-2', full_name: 'Dawit Lab Technician', role: 'lab_technician' }
    ];
    return base.map(a => ({
      ...a,
      availability: calculateLabAssistantAvailability(a, labOrders)
    }));
  }, [staffList, labOrders]);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const myDoctorId = selectedDoctor?.id;
  const mySpecialty = selectedDoctor?.specialty || '';

  const isMyVisit = (v) => {
    if (!myDoctorId) return false;
    if (v.assigned_doctor_id) return v.assigned_doctor_id === myDoctorId;
    return v.assigned_doctor?.toLowerCase() === selectedDoctor?.full_name?.toLowerCase();
  };

  // STRICTLY only visits assigned to this doctor today
  const myVisits = visits.filter(v => v.visit_date === todayStr && isMyVisit(v));
  
  // ACTIVE QUEUE: Only paid registration visits are actionable!
  const waiting = myVisits.filter(v => 
    v.registration_fee_paid === true && 
    ['waiting', 'with_doctor', 'lab_complete'].includes(v.status)
  );

  // BLOCKED QUEUE: Unpaid registration visits
  const unpaidVisits = myVisits.filter(v => 
    v.registration_fee_paid !== true &&
    ['waiting', 'with_doctor'].includes(v.status)
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const visitId = params.get('visit');
    if (visitId) {
      const v = visits.find(vi => vi.id === visitId);
      if (v && v.registration_fee_paid) handleSelectVisit(v);
    }
  }, [visits]);

  const handleSelectVisit = (visit) => {
    if (!visit.registration_fee_paid) {
      toast.error('Registration payment required before doctor consultation can begin');
      return;
    }
    setSelected(visit);
    setExamForm({
      symptoms: visit.symptoms || '',
      examination_notes: visit.examination_notes || '',
      diagnosis: visit.diagnosis || '',
      disease: visit.disease || '',
      treatment_plan: visit.treatment_plan || ''
    });
    setFinalForm({
      final_diagnosis: visit.final_diagnosis || '',
      final_treatment: visit.final_treatment || '',
      follow_up_date: visit.follow_up_date || '',
      follow_up_notes: visit.follow_up_notes || ''
    });
    if (visit.status === 'waiting') {
      try {
        ethioCareClient.entities.Visit.update(visit.id, {
          status: 'with_doctor',
          assigned_doctor: selectedDoctor?.full_name || visit.assigned_doctor || null,
          assigned_doctor_id: myDoctorId || visit.assigned_doctor_id || null
        });
        queryClient.invalidateQueries({ queryKey: ['visits'] });
      } catch (err) {
        console.error('[DoctorQueue] Error transitioning visit to with_doctor:', err);
      }
    }
    logAudit({ userName: selectedDoctor?.full_name, userRole: 'doctor', action: 'view', module: 'Visit', description: `Opened visit for ${visit.patient_name}`, recordId: visit.id, recordName: visit.patient_name });
  };

  const [actionLoading, setActionLoading] = useState(false);

  const saveExam = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      await ethioCareClient.entities.Visit.update(selected.id, examForm);
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      toast.success('Examination saved');
      logAudit({ userName: selectedDoctor?.full_name, userRole: 'doctor', action: 'update', module: 'Visit', description: `Saved examination for ${selected.patient_name}`, recordId: selected.id, recordName: selected.patient_name });
    } catch (err) {
      console.error('[DoctorQueue] Error saving exam:', err);
      toast.error(err.message || 'Failed to save examination');
    } finally {
      setActionLoading(false);
    }
  };

  const orderLab = async () => {
    if (!selected || (!labForm.lab_test_id && !labForm.test_type)) {
      toast.error('Please select a test');
      return;
    }
    setActionLoading(true);
    try {
      const activeLabTests = availableLabTests.filter(t => t.status === 'active');
      const selectedTest = activeLabTests.find(t => t.id === labForm.lab_test_id) ||
        activeLabTests.find(t => t.name?.toLowerCase() === (labForm.test_name || labForm.test_type)?.toLowerCase()) ||
        activeLabTests[0];

      const price = selectedTest?.price ?? 150;
      const testName = selectedTest?.name || labForm.test_name || labForm.test_type;
      const testCategory = selectedTest?.category || labForm.test_type || 'Laboratory';

      const labOrder = await ethioCareClient.entities.LabOrder.create({
        visit_id: selected.id,
        patient_id: selected.patient_id,
        patient_name: selected.patient_name,
        doctor_name: selectedDoctor?.full_name || null,
        doctor_id: myDoctorId || null,
        assigned_assistant_id: labForm.assigned_assistant_id || null,
        assigned_assistant_name: labForm.assigned_assistant_name || null,
        test_type: testCategory,
        test_name: testName,
        notes: labForm.notes || null,
        payment_status: 'pending',
        test_status: 'awaiting_payment',
        price: price
      });
      await ethioCareClient.entities.Payment.create({
        visit_id: selected.id,
        patient_id: selected.patient_id,
        patient_name: selected.patient_name,
        payment_type: 'laboratory',
        description: `Lab: ${testName}`,
        amount: price,
        status: 'pending',
        reference_type: 'lab_order',
        reference_id: labOrder.id
      });
      await ethioCareClient.entities.Visit.update(selected.id, { status: 'lab_pending' });
      queryClient.invalidateQueries({ queryKey: ['labOrders', 'visits', 'payments'] });
      toast.success(`Lab order "${testName}" created (${price} ETB) — sent to billing`);
      logAudit({ userName: selectedDoctor?.full_name, userRole: 'doctor', action: 'create', module: 'LabOrder', description: `Ordered ${testName} (${price} ETB) for ${selected.patient_name}${labForm.assigned_assistant_name ? ` (assigned to ${labForm.assigned_assistant_name})` : ''}`, recordId: labOrder.id, recordName: selected.patient_name });
      notificationService.dispatch({
        title: 'Pending Lab Payment Required',
        message: `Lab fee for "${testName}" (${price} ETB) for ${selected.patient_name} awaiting payment at Billing desk.`,
        type: 'warning',
        module: 'billing',
        targetRoles: ['accountant', 'receptionist', 'owner'],
        link: '/billing/payments'
      });

      if (labForm.assigned_assistant_id || labForm.assigned_assistant_name) {
        notificationService.dispatch({
          title: 'New Diagnostic Test Assigned',
          message: `Diagnostic test "${testName}" for ${selected.patient_name} assigned to you by Dr. ${selectedDoctor?.full_name || 'Attending Doctor'}. Payment required before processing.`,
          type: 'info',
          module: 'lab',
          targetRoles: ['lab_technician'],
          targetUserId: labForm.assigned_assistant_id,
          targetStaffName: labForm.assigned_assistant_name,
          link: '/lab/orders'
        });
      }

      setLabForm({ test_type: 'Blood Test', test_name: '', notes: '', lab_test_id: '', assigned_assistant_id: '', assigned_assistant_name: '' });
    } catch (err) {
      console.error('[DoctorQueue] Error ordering lab:', err);
      toast.error(err.message || 'Failed to create lab order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestBedAdmission = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      // 1. Update visit to bed_requested
      await ethioCareClient.entities.Visit.update(selected.id, {
        bed_status: 'bed_requested',
        notes: bedRequestForm.notes ? `${selected.notes || ''}\n[Inpatient Admission]: ${bedRequestForm.notes}` : selected.notes
      });

      // 2. Create pending payment for bed admission fee
      await ethioCareClient.entities.Payment.create({
        visit_id: selected.id,
        patient_id: selected.patient_id,
        patient_name: selected.patient_name,
        payment_type: 'bed',
        description: `Inpatient Admission Fee (${bedRequestForm.department})`,
        amount: 500,
        status: 'pending',
        reference_type: 'bed_admission',
        reference_id: selected.id
      });

      // 3. Dispatch notification to Reception & Billing
      notificationService.dispatch({
        title: 'Inpatient Bed Admission Requested',
        message: `Dr. ${selectedDoctor?.full_name || 'Attending Doctor'} requested bed admission for ${selected.patient_name}. Reception please collect admission fee and assign room/bed.`,
        type: 'warning',
        module: 'patient',
        targetRoles: ['receptionist', 'accountant', 'owner', 'nurse'],
        link: '/reception/beds'
      });

      queryClient.invalidateQueries({ queryKey: ['visits', 'payments'] });
      toast.success(`Bed admission requested for ${selected.patient_name}. Sent to Reception Desk.`);
      setBedModalOpen(false);
      setBedRequestForm({ department: 'Inpatient Ward', notes: '' });
    } catch (err) {
      console.error('[DoctorQueue] Error requesting bed admission:', err);
      toast.error(err.message || 'Failed to request bed admission');
    } finally {
      setActionLoading(false);
    }
  };

  const prescribeMedicine = async () => {
    if (!selected || !prescForm.medicine_name?.trim()) {
      toast.error('Medicine name is required');
      return;
    }
    setActionLoading(true);
    try {
      const matchedMed = availableMedicines.find(m =>
        m.id === prescForm.medicine_id ||
        m.name?.toLowerCase() === prescForm.medicine_name.trim().toLowerCase()
      );
      const qty = prescForm.quantity ? parseInt(prescForm.quantity) : 1;
      const unitPrice = matchedMed?.unit_price ?? 0;
      const totalAmount = unitPrice * qty;

      const rx = await ethioCareClient.entities.Prescription.create({
        visit_id: selected.id,
        patient_id: selected.patient_id,
        patient_name: selected.patient_name,
        doctor_name: selectedDoctor?.full_name || null,
        medicine_name: prescForm.medicine_name.trim(),
        dosage: prescForm.dosage,
        frequency: prescForm.frequency,
        duration: prescForm.duration,
        instructions: prescForm.instructions,
        quantity: qty,
        unit_price: unitPrice,
        status: 'pending',
        payment_status: 'pending'
      });
      await ethioCareClient.entities.Payment.create({
        visit_id: selected.id,
        patient_id: selected.patient_id,
        patient_name: selected.patient_name,
        payment_type: 'medicine',
        description: `Medicine: ${prescForm.medicine_name.trim()}${unitPrice > 0 ? ` (${qty}x @ ${unitPrice} ETB)` : ''}`,
        amount: totalAmount,
        status: 'pending',
        reference_type: 'prescription',
        reference_id: rx.id
      });
      queryClient.invalidateQueries({ queryKey: ['prescriptions', 'payments'] });
      toast.success(`Prescription for ${prescForm.medicine_name} added successfully`);
      logAudit({ userName: selectedDoctor?.full_name, userRole: 'doctor', action: 'create', module: 'Prescription', description: `Prescribed ${prescForm.medicine_name} (${qty} units) for ${selected.patient_name}`, recordId: rx.id, recordName: selected.patient_name });
      notificationService.dispatch({
        title: 'New Prescription',
        message: `Prescription for ${prescForm.medicine_name.trim()} (${qty} units) ordered for ${selected.patient_name}.`,
        type: 'info',
        module: 'pharmacy',
        targetRoles: ['pharmacist', 'owner'],
        link: '/pharmacy/dispense'
      });
      notificationService.dispatch({
        title: 'Pending Medicine Invoice',
        message: `Prescription bill for ${prescForm.medicine_name.trim()} (${totalAmount} ETB) awaiting payment.`,
        type: 'info',
        module: 'billing',
        targetRoles: ['accountant', 'owner'],
        link: '/billing/payments'
      });
      setPrescForm({ medicine_name: '', medicine_id: '', dosage: '', frequency: '', duration: '', quantity: '1', instructions: '' });
    } catch (err) {
      console.error('[DoctorQueue] Error prescribing medicine:', err);
      toast.error(err.message || 'Failed to create prescription');
    } finally {
      setActionLoading(false);
    }
  };

  const saveFinalAndComplete = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      const sanitizedFinal = {
        ...finalForm,
        follow_up_date: finalForm.follow_up_date?.trim() ? finalForm.follow_up_date.trim() : null,
        follow_up_notes: finalForm.follow_up_notes?.trim() || null,
        status: 'pharmacy',
        consultation_completed: true
      };
      await ethioCareClient.entities.Visit.update(selected.id, sanitizedFinal);

      // Save to centralized patient history
      const visitPrescriptions = prescriptions.filter(p => p.visit_id === selected.id);
      const visitLabs = labOrders.filter(o => o.visit_id === selected.id);
      const prescriptionSummary = visitPrescriptions.map(p => `${p.medicine_name} (${p.dosage})`).join(', ');
      const labResultsSummary = visitLabs.filter(l => l.results).map(l => `${l.test_type}: ${l.results}`).join('; ');

      await ethioCareClient.entities.PatientHistory.create({
        patient_id: selected.patient_id,
        patient_name: selected.patient_name,
        visit_id: selected.id,
        visit_date: selected.visit_date || format(new Date(), 'yyyy-MM-dd'),
        doctor_name: selectedDoctor?.full_name || 'Attending Doctor',
        doctor_specialty: mySpecialty,
        symptoms: examForm.symptoms || null,
        diagnosis: finalForm.final_diagnosis || examForm.diagnosis || null,
        treatment: finalForm.final_treatment || examForm.treatment_plan || null,
        prescription: prescriptionSummary || null,
        lab_results: labResultsSummary || null,
        notes: examForm.examination_notes || null,
        follow_up_date: finalForm.follow_up_date?.trim() ? finalForm.follow_up_date.trim() : null,
        record_type: 'visit'
      });

      queryClient.invalidateQueries({ queryKey: ['visits', 'patientHistory'] });
      toast.success('Visit completed — history saved & sent to pharmacy');
      logAudit({ userName: selectedDoctor?.full_name, userRole: 'doctor', action: 'update', module: 'Visit', description: `Completed visit for ${selected.patient_name}`, recordId: selected.id, recordName: selected.patient_name });
      setSelected(null);
    } catch (err) {
      console.error('[DoctorQueue] Error completing visit:', err);
      toast.error(err.message || 'Failed to complete visit');
    } finally {
      setActionLoading(false);
    }
  };

  const visitLabOrders = selected ? labOrders.filter(o => o.visit_id === selected.id) : [];
  const visitPrescriptions = selected ? prescriptions.filter(p => p.visit_id === selected.id) : [];
  const visitMedOrders = selected ? medicationOrders.filter(o => o.visit_id === selected.id) : [];


  return (
    <div className="space-y-6">
      {/* Personalized Workspace Header */}
      <div className="bg-card rounded-2xl border border-border p-5 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <Stethoscope className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {selectedDoctor ? `Welcome, Dr. ${selectedDoctor.full_name}` : 'Doctor Consultation Workspace'}
                </h1>
                <Badge variant="outline" className="text-xs font-mono bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30">
                  ID: {selectedDoctor?.id?.slice(0, 8).toUpperCase() || 'PHYS-01'}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-muted-foreground">
                <span className="font-semibold text-foreground flex items-center gap-1">
                  <Stethoscope className="w-3.5 h-3.5 text-primary" />
                  {mySpecialty || 'General Practice'}
                </span>
                <span className="text-muted-foreground/50">•</span>
                <span className="flex items-center gap-1 font-medium">
                  <Building2 className="w-3.5 h-3.5 text-primary" />
                  {selectedDoctor?.assigned_room_number ? (
                    <strong className="text-primary font-mono">Room {selectedDoctor.assigned_room_number}</strong>
                  ) : (
                    <span className="italic">Consultation OPD</span>
                  )}
                </span>
                <span className="text-muted-foreground/50">•</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {selectedDoctor?.doctor_type || 'Attending Physician'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:self-center bg-muted/50 p-2.5 rounded-xl border border-border shrink-0">
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Personal Queue</p>
              <p className="text-lg font-mono font-bold text-primary">{waiting.length} Waiting</p>
            </div>
            <div className="h-8 w-px bg-border mx-1" />
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Today's Total</p>
              <p className="text-lg font-mono font-bold text-foreground">{myVisits.length}</p>
            </div>
          </div>
        </div>
      </div>

      {!selectedDoctor && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>No doctor selected. Use the <strong>Doctor Selector</strong> in the sidebar to choose a doctor.</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Queue List */}
        <div className={`space-y-3 md:col-span-5 lg:col-span-4 ${isMobile && selected ? 'hidden' : ''}`}>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase">Waiting ({waiting.length})</h3>
          {waiting.map(v => (
            <button
              key={v.id}
              onClick={() => handleSelectVisit(v)}
              className={`w-full text-left bg-card rounded-xl border p-4 transition-all hover:shadow-md ${selected?.id === v.id ? 'border-primary ring-1 ring-primary' : 'border-border'}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">#{v.queue_number}</div>
                  <div>
                    <p className="font-medium text-sm">{v.patient_name}</p>
                    {v.assigned_doctor && <p className="text-xs text-muted-foreground">Dr. {v.assigned_doctor}</p>}
                  </div>
                </div>
                <StatusBadge status={v.status} />
              </div>
            </button>
          ))}
          {waiting.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No paid patients waiting</p>}

          {/* Blocked Unpaid Registration Visits */}
          {unpaidVisits.length > 0 && (
            <div className="pt-3 border-t border-border/60 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Registration Fee Pending ({unpaidVisits.length})
                </h4>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Consultation is blocked until registration fee is paid at Billing desk.
              </p>
              <div className="space-y-1.5">
                {unpaidVisits.map(uv => (
                  <div
                    key={uv.id}
                    className="w-full bg-muted/40 rounded-xl border border-dashed border-amber-300 dark:border-amber-800 p-3 select-none opacity-85"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-amber-500/15 flex items-center justify-center text-xs font-bold text-amber-700 dark:text-amber-400 shrink-0">
                          #{uv.queue_number}
                        </div>
                        <div className="min-w-0 truncate">
                          <p className="font-semibold text-xs text-foreground truncate">{uv.patient_name}</p>
                          <p className="text-[10px] text-amber-700 dark:text-amber-400">Payment Required</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 shrink-0">
                        Blocked
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Patient Detail */}
        <div className={`md:col-span-7 lg:col-span-8 ${isMobile && !selected ? 'hidden' : ''}`}>
          {selected ? (
            <>
            {isMobile && (
              <Button variant="ghost" onClick={() => setSelected(null)} className="mb-3 -ml-2">
                <ChevronLeft className="w-5 h-5" />Back to Queue
              </Button>
            )}
            <Tabs defaultValue="examination" className="space-y-4">
              <div className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-bold">{selected.patient_name}</h2>
                      {selected.bed_assigned && selected.room_number ? (
                        <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 text-xs">
                          🏨 Room {selected.room_number} → Bed {selected.bed_number || 'Assigned'}
                        </Badge>
                      ) : selected.bed_status === 'bed_requested' ? (
                        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 text-xs">
                          ⏳ Bed Requested (Pending Admission Fee)
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">Queue #{selected.queue_number} · {selected.visit_date}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!selected.bed_assigned && selected.bed_status !== 'bed_requested' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setBedModalOpen(true)}
                        className="text-xs border-indigo-200 text-indigo-700 dark:text-indigo-300 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                      >
                        <Building2 className="w-3.5 h-3.5 mr-1" />
                        Admit to Bed
                      </Button>
                    )}
                    <StatusBadge status={selected.status} />
                  </div>
                </div>
                <TabsList className="w-full flex overflow-x-auto gap-1 scrollbar-hide">
                  <TabsTrigger value="examination" className="shrink-0 text-xs"><Stethoscope className="w-3 h-3 mr-1" />Exam</TabsTrigger>
                  <TabsTrigger value="ai" className="shrink-0 text-xs font-semibold text-primary bg-primary/5 border border-primary/20"><Sparkles className="w-3 h-3 mr-1 text-primary" />AI Assistant</TabsTrigger>
                  <TabsTrigger value="lab" className="shrink-0 text-xs"><FlaskConical className="w-3 h-3 mr-1" />Lab</TabsTrigger>
                  <TabsTrigger value="prescription" className="shrink-0 text-xs"><Pill className="w-3 h-3 mr-1" />Rx</TabsTrigger>
                  <TabsTrigger value="nurse" className="shrink-0 text-xs"><Syringe className="w-3 h-3 mr-1" />Nurse</TabsTrigger>
                  <TabsTrigger value="final" className="shrink-0 text-xs"><ClipboardList className="w-3 h-3 mr-1" />Final</TabsTrigger>
                  <TabsTrigger value="history" className="shrink-0 text-xs"><History className="w-3 h-3 mr-1" />History</TabsTrigger>
                </TabsList>
              </div>

              {/* AI Clinical Assistant Tab */}
              <TabsContent value="ai" className="space-y-4">
                <AIClinicalAssistant
                  patient={{
                    full_name: selected.patient_name,
                    age: selected.age,
                    gender: selected.gender
                  }}
                  visit={{
                    ...selected,
                    symptoms: examForm.symptoms || selected.symptoms,
                    examination_notes: examForm.examination_notes || selected.examination_notes,
                    diagnosis: examForm.diagnosis || selected.diagnosis
                  }}
                  onApplyNotes={(soapDraft, primaryDiff) => {
                    setExamForm(prev => ({
                      ...prev,
                      examination_notes: prev.examination_notes ? `${prev.examination_notes}\n\n${soapDraft}` : soapDraft,
                      diagnosis: prev.diagnosis || primaryDiff || prev.diagnosis
                    }));
                    setFinalForm(prev => ({
                      ...prev,
                      final_diagnosis: prev.final_diagnosis || primaryDiff || prev.final_diagnosis
                    }));
                  }}
                />
              </TabsContent>

              <TabsContent value="examination" className="space-y-4">
                <Card>
                  <CardHeader><CardTitle className="text-base">Patient Examination</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div><Label>Symptoms</Label><Textarea value={examForm.symptoms} onChange={e => setExamForm({...examForm, symptoms: e.target.value})} rows={3} /></div>
                    <div><Label>Examination Notes</Label><Textarea value={examForm.examination_notes} onChange={e => setExamForm({...examForm, examination_notes: e.target.value})} rows={3} /></div>
                    <div><Label>Diagnosis</Label><Input value={examForm.diagnosis} onChange={e => setExamForm({...examForm, diagnosis: e.target.value})} /></div>
                    <div><Label>Disease</Label><Input value={examForm.disease} onChange={e => setExamForm({...examForm, disease: e.target.value})} /></div>
                    <div><Label>Treatment Plan</Label><Textarea value={examForm.treatment_plan} onChange={e => setExamForm({...examForm, treatment_plan: e.target.value})} rows={2} /></div>
                    <Button onClick={saveExam} disabled={actionLoading}>{actionLoading ? 'Saving...' : 'Save Examination'}</Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="lab" className="space-y-4">
                <Card>
                  <CardHeader><CardTitle className="text-base">Order Laboratory Diagnostic Test</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label>Select Hospital Lab Test (Owner Tariffs)</Label>
                      <Select
                        value={labForm.lab_test_id}
                        onValueChange={id => {
                          const t = availableLabTests.find(item => item.id === id);
                          setLabForm({
                            ...labForm,
                            lab_test_id: id,
                            test_name: t?.name || '',
                            test_type: t?.category || 'Blood'
                          });
                        }}
                      >
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Choose configured lab test..." /></SelectTrigger>
                        <SelectContent>
                          {availableLabTests.filter(t => t.status === 'active').map(t => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name} — {t.price} ETB {t.turnaround_time ? `(${t.turnaround_time})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-xs font-semibold">Assign Specific Lab Assistant</Label>
                        <span className="text-[11px] text-muted-foreground">Live Shift Availability</span>
                      </div>
                      <Select
                        value={labForm.assigned_assistant_name || '__any'}
                        onValueChange={val => {
                          if (val === '__any') {
                            setLabForm(f => ({ ...f, assigned_assistant_id: '', assigned_assistant_name: '' }));
                          } else {
                            const asst = labAssistantsWithAvailability.find(a => a.full_name === val);
                            setLabForm(f => ({
                              ...f,
                              assigned_assistant_id: asst?.id || '',
                              assigned_assistant_name: asst?.full_name || val
                            }));
                          }
                        }}
                      >
                        <SelectTrigger className="h-10 text-sm">
                          <SelectValue placeholder="Any Available Lab Assistant (Lab Pool)" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          <SelectItem value="__any">Any Available Lab Assistant (Lab Duty Pool)</SelectItem>
                          {labAssistantsWithAvailability.map(a => (
                            <SelectItem key={a.id || a.full_name} value={a.full_name}>
                              <div className="flex items-center justify-between gap-3 w-full py-0.5">
                                <span className="font-medium text-foreground">{a.full_name}</span>
                                <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${a.availability?.badgeClass || 'bg-slate-100 text-slate-700'}`}>
                                    {a.availability?.statusLabel}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground font-mono bg-muted/60 px-1.5 py-0.5 rounded">
                                    {a.availability?.totalWorkload} in queue
                                  </span>
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {labForm.lab_test_id && (
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold text-foreground">
                            {availableLabTests.find(t => t.id === labForm.lab_test_id)?.name}
                          </p>
                          <p className="text-muted-foreground mt-0.5">
                            Category: {availableLabTests.find(t => t.id === labForm.lab_test_id)?.category} · Turnaround: {availableLabTests.find(t => t.id === labForm.lab_test_id)?.turnaround_time || 'Standard'}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-muted-foreground block text-[10px]">Owner Tariff</span>
                          <span className="text-base font-bold text-primary">
                            {availableLabTests.find(t => t.id === labForm.lab_test_id)?.price} ETB
                          </span>
                        </div>
                      </div>
                    )}

                    <div><Label>Specific Notes / Clinical Indication</Label><Textarea value={labForm.notes} onChange={e => setLabForm({...labForm, notes: e.target.value})} rows={2} placeholder="Clinical indication for lab technician..." /></div>
                    <Button onClick={orderLab} disabled={actionLoading}>
                      <FlaskConical className="w-4 h-4 mr-2" />{actionLoading ? 'Ordering...' : 'Order Test'}
                    </Button>
                  </CardContent>
                </Card>
                {visitLabOrders.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-base">Lab Orders ({visitLabOrders.length})</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {visitLabOrders.map(o => (
                        <div key={o.id} className="border rounded-lg p-3">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <p className="font-medium text-sm">{o.test_type}{o.test_name ? ` - ${o.test_name}` : ''}</p>
                              <p className="text-xs text-muted-foreground">{o.notes}</p>
                              {o.price && <p className="text-xs font-semibold text-primary mt-1">{o.price} ETB</p>}
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                o.payment_status === 'paid'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200'
                              }`}>
                                {o.payment_status === 'paid' ? 'Paid' : 'Laboratory payment pending'}
                              </span>
                              <StatusBadge status={o.test_status} />
                            </div>
                          </div>
                          {o.payment_status !== 'paid' && (
                            <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 rounded p-1.5">
                              Payment pending at Billing desk. Laboratory sample collection is blocked until payment is completed.
                            </p>
                          )}
                          {o.results && (
                            <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded p-2">
                              <p className="text-xs font-semibold text-emerald-700">Results:</p>
                              <p className="text-sm">{o.results}</p>
                              {o.result_notes && <p className="text-xs text-muted-foreground mt-1">{o.result_notes}</p>}
                            </div>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="prescription" className="space-y-4">
                <Card>
                  <CardHeader><CardTitle className="text-base">Prescribe Medicine (Pharmacy Catalog)</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label>Select Medicine from Catalog</Label>
                      <Select
                        value={prescForm.medicine_id}
                        onValueChange={id => {
                          const m = availableMedicines.find(item => item.id === id);
                          if (m) {
                            setPrescForm({
                              ...prescForm,
                              medicine_id: id,
                              medicine_name: m.name,
                              dosage: m.strength || prescForm.dosage
                            });
                          }
                        }}
                      >
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Pick from configured pharmacy medicines..." /></SelectTrigger>
                        <SelectContent>
                          {availableMedicines.filter(m => m.status !== 'out_of_stock').map(m => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name} {m.strength ? `(${m.strength})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Or Custom Medicine Name</Label>
                      <Input
                        value={prescForm.medicine_name}
                        onChange={e => setPrescForm({...prescForm, medicine_name: e.target.value, medicine_id: ''})}
                        placeholder="e.g. Paracetamol 500mg"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div><Label>Dosage</Label><Input value={prescForm.dosage} onChange={e => setPrescForm({...prescForm, dosage: e.target.value})} placeholder="e.g. 500mg" /></div>
                      <div><Label>Frequency</Label><Input value={prescForm.frequency} onChange={e => setPrescForm({...prescForm, frequency: e.target.value})} placeholder="e.g. 3x daily" /></div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div><Label>Duration</Label><Input value={prescForm.duration} onChange={e => setPrescForm({...prescForm, duration: e.target.value})} placeholder="e.g. 7 days" /></div>
                      <div><Label>Quantity</Label><Input type="number" value={prescForm.quantity} onChange={e => setPrescForm({...prescForm, quantity: e.target.value})} /></div>
                    </div>

                    <div><Label>Instructions</Label><Textarea value={prescForm.instructions} onChange={e => setPrescForm({...prescForm, instructions: e.target.value})} rows={2} placeholder="Take after meals with water..." /></div>
                    <Button onClick={prescribeMedicine} disabled={actionLoading}>
                      <Pill className="w-4 h-4 mr-2" />{actionLoading ? 'Adding...' : 'Add Prescription'}
                    </Button>
                  </CardContent>
                </Card>
                {visitPrescriptions.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-base">Prescriptions ({visitPrescriptions.length})</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {visitPrescriptions.map(p => (
                        <div key={p.id} className="flex justify-between items-center border rounded-lg p-3">
                          <div>
                            <p className="font-medium text-sm">{p.medicine_name}</p>
                            <p className="text-xs text-muted-foreground">{p.dosage} · {p.frequency} · {p.duration} (Qty: {p.quantity})</p>
                          </div>
                          <StatusBadge status={p.status} />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="nurse" className="space-y-4">
                <MedicationOrderForm
                  visit={selected}
                  doctor={selectedDoctor}
                  existingOrders={visitMedOrders}
                />
              </TabsContent>

              <TabsContent value="final" className="space-y-4">
                <Card>
                  <CardHeader><CardTitle className="text-base">Final Diagnosis & Discharge</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div><Label>Final Diagnosis</Label><Textarea value={finalForm.final_diagnosis} onChange={e => setFinalForm({...finalForm, final_diagnosis: e.target.value})} rows={3} /></div>
                    <div><Label>Final Treatment</Label><Textarea value={finalForm.final_treatment} onChange={e => setFinalForm({...finalForm, final_treatment: e.target.value})} rows={3} /></div>
                    <div><Label>Follow-up Date</Label><Input type="date" value={finalForm.follow_up_date} onChange={e => setFinalForm({...finalForm, follow_up_date: e.target.value})} /></div>
                    <div><Label>Follow-up Notes</Label><Textarea value={finalForm.follow_up_notes} onChange={e => setFinalForm({...finalForm, follow_up_notes: e.target.value})} rows={2} /></div>
                    <Button className="w-full" onClick={saveFinalAndComplete} disabled={actionLoading}>
                      {actionLoading ? 'Completing Visit...' : 'Complete Visit & Save to Patient History'}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history" className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-2">
                  <p className="text-xs text-amber-800 flex items-center gap-2">
                    <User className="w-3.5 h-3.5" />
                    Viewing complete history for <strong>{selected.patient_name}</strong> — records from all doctors
                  </p>
                </div>
                <PatientHistoryView patientId={selected.patient_id} patientName={selected.patient_name} />
              </TabsContent>
            </Tabs>
            </>
          ) : (
            <div className="bg-card rounded-xl border border-border flex items-center justify-center h-96">
              <div className="text-center text-muted-foreground">
                <Stethoscope className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Select a patient from the queue</p>
                <p className="text-sm mt-1">You can view their full history in the History tab</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bed Admission Request Dialog */}
      <Dialog open={bedModalOpen} onOpenChange={setBedModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600" />
              Request Inpatient Bed Admission
            </DialogTitle>
            <DialogDescription>
              Submit an inpatient admission order for <strong>{selected?.patient_name}</strong>. Reception will collect the admission deposit and assign a room & bed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold">Recommended Ward / Department</Label>
              <Select
                value={bedRequestForm.department}
                onValueChange={val => setBedRequestForm(f => ({ ...f, department: val }))}
              >
                <SelectTrigger className="h-10 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="General Inpatient">General Ward (Floor 1)</SelectItem>
                  <SelectItem value="Pediatrics">Pediatric Ward (Floor 1)</SelectItem>
                  <SelectItem value="Inpatient Ward">Semi-Private / Standard Ward (Floor 2)</SelectItem>
                  <SelectItem value="Intensive Care Unit (ICU)">ICU (Floor 3)</SelectItem>
                  <SelectItem value="Maternity Ward">Maternity Ward</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Clinical Indication / Admission Instructions</Label>
              <Textarea
                className="mt-1"
                rows={3}
                placeholder="e.g. Admit for IV antibiotic therapy, vital sign monitoring every 4 hours, and bed rest."
                value={bedRequestForm.notes}
                onChange={e => setBedRequestForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-800 rounded-lg p-3 text-xs text-indigo-800 dark:text-indigo-300">
              <p className="font-semibold mb-0.5">Workflow Gate:</p>
              <p>
                An admission billing invoice (500 ETB) will be created at Reception/Billing. Once verified, Reception assigns an available room & bed.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBedModalOpen(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button onClick={handleRequestBedAdmission} disabled={actionLoading} className="gap-2">
              <Building2 className="w-4 h-4" />
              {actionLoading ? 'Submitting...' : 'Confirm Bed Admission'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}