import React, { useState, useMemo, useEffect } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { UserPlus, Send, CheckCircle2, AlertCircle, Clock, ArrowRight, UserCheck, Stethoscope, RefreshCw, FileText, History, BookOpen } from 'lucide-react';
import { buildDoctorList } from '@/lib/doctorUtils';
import { notificationService } from '@/services/notification.service';
import { patientFeeService } from '@/services/patientFee.service';
import AddHistoricalRecordModal from '@/components/reception/AddHistoricalRecordModal';
import { calculateDoctorAvailability } from '@/services/staffAvailability.service';

export default function RegisterPatient() {
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    full_name: '',
    gender: 'Male',
    age: '',
    date_of_birth: '',
    address: '',
    phone: '',
    emergency_contact_name: '',
    emergency_contact_phone: ''
  });

  const [existingPatientId, setExistingPatientId] = useState(null);
  const [created, setCreated] = useState(null);
  const [sendToDoctor, setSendToDoctor] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Queries for live data
  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: () => ethioCareClient.entities.Staff.list()
  });

  const { data: doctorEntities = [] } = useQuery({
    queryKey: ['doctors'],
    queryFn: () => ethioCareClient.entities.Doctor.list()
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => ethioCareClient.entities.Service.list()
  });

  const { data: patients = [] } = useQuery({
    queryKey: ['patients'],
    queryFn: () => ethioCareClient.entities.Patient.list('-created_date', 500)
  });

  const { data: visits = [] } = useQuery({
    queryKey: ['visits'],
    queryFn: () => ethioCareClient.entities.Visit.list('-created_date', 500)
  });

  const { data: allHistory = [] } = useQuery({
    queryKey: ['patientHistoryAll'],
    queryFn: () => ethioCareClient.entities.PatientHistory.list('-visit_date', 1000)
  });

  const [historicalModalOpen, setHistoricalModalOpen] = useState(false);

  const doctors = useMemo(() => buildDoctorList(doctorEntities, staff), [doctorEntities, staff]);

  const doctorsWithAvailability = useMemo(() => {
    return doctors.map(doc => {
      const avail = calculateDoctorAvailability(doc, visits);
      return {
        ...doc,
        availability: avail
      };
    });
  }, [doctors, visits]);

  // Centralized active registration tariffs
  const regServices = useMemo(() => {
    return services.filter(s =>
      (s.category === 'registration' || s.category === 'consultation') && s.status === 'active'
    );
  }, [services]);

  const tariffs = useMemo(() => patientFeeService.getRegistrationTariffs(services), [services]);

  // Check if entered phone or name matches an existing patient
  const matchedExistingPatient = useMemo(() => {
    const cleanPhone = form.phone.trim();
    const cleanName = form.full_name.trim().toLowerCase();
    if (!cleanPhone && cleanName.length < 3) return null;

    return patients.find(p => {
      if (cleanPhone && p.phone && p.phone.replace(/\s+/g, '') === cleanPhone.replace(/\s+/g, '')) {
        return true;
      }
      if (cleanName.length >= 3 && p.full_name && p.full_name.trim().toLowerCase() === cleanName) {
        return true;
      }
      return false;
    }) || null;
  }, [patients, form.phone, form.full_name]);

  // Evaluate 30-Day Treatment Rule for matched or selected patient across visits and historical records
  const feeAssessment = useMemo(() => {
    const targetPatient = matchedExistingPatient || (existingPatientId ? patients.find(p => p.id === existingPatientId) : null);
    if (!targetPatient) return null;
    return patientFeeService.determineRegistrationFee(targetPatient.id, services, visits, allHistory);
  }, [matchedExistingPatient, existingPatientId, patients, services, visits, allHistory]);

  // Automatically select the appropriate tariff based on 30-day treatment rule if user hasn't explicitly picked one
  useEffect(() => {
    if (!selectedServiceId) {
      if (feeAssessment?.isRecent && tariffs.recentPatientService?.id) {
        setSelectedServiceId(tariffs.recentPatientService.id);
      } else if (tariffs.newPatientService?.id) {
        setSelectedServiceId(tariffs.newPatientService.id);
      }
    }
  }, [feeAssessment, tariffs, selectedServiceId]);

  // Resolve active tariff and fee amount
  const activeService = useMemo(() => {
    if (selectedServiceId) {
      const found = regServices.find(s => s.id === selectedServiceId);
      if (found) return found;
    }
    if (feeAssessment?.isRecent && tariffs.recentPatientService) {
      return tariffs.recentPatientService;
    }
    return tariffs.newPatientService || regServices[0] || null;
  }, [selectedServiceId, regServices, feeAssessment, tariffs]);

  const registrationFee = useMemo(() => {
    if (activeService && typeof activeService.price === 'number') {
      return activeService.price;
    }
    if (feeAssessment) {
      return feeAssessment.fee;
    }
    return tariffs.newPatientFee || 150;
  }, [activeService, feeAssessment, tariffs]);

  const registrationServiceName = activeService?.name || feeAssessment?.serviceName || 'Patient Registration (New Patient)';

  const generatePatientId = () => {
    const d = format(new Date(), 'yyMMdd');
    const r = Math.floor(1000 + Math.random() * 9000);
    return `PT-${d}-${r}`;
  };

  const handleUseExistingPatient = (pat) => {
    setExistingPatientId(pat.id);
    setForm({
      full_name: pat.full_name || '',
      gender: pat.gender || 'Male',
      age: pat.age ? String(pat.age) : '',
      date_of_birth: pat.date_of_birth || '',
      address: pat.address || '',
      phone: pat.phone || '',
      emergency_contact_name: pat.emergency_contact_name || '',
      emergency_contact_phone: pat.emergency_contact_phone || ''
    });

    const assessment = patientFeeService.determineRegistrationFee(pat.id, services, visits);
    if (assessment.isRecent && tariffs.recentPatientService?.id) {
      setSelectedServiceId(tariffs.recentPatientService.id);
    } else if (tariffs.newPatientService?.id) {
      setSelectedServiceId(tariffs.newPatientService.id);
    }
    toast.info(`Loaded patient profile: ${pat.full_name} (${pat.patient_id})`);
  };

  const handleRegister = async () => {
    if (!form.full_name?.trim() || !form.phone?.trim()) {
      toast.error('Full name and phone number are required');
      return;
    }

    setIsSubmitting(true);
    try {
      let patientRecord = null;

      // If linking to an existing patient, update their contact info and use existing record
      if (existingPatientId || matchedExistingPatient) {
        const targetId = existingPatientId || matchedExistingPatient.id;
        patientRecord = await ethioCareClient.entities.Patient.update(targetId, {
          full_name: form.full_name.trim(),
          gender: form.gender,
          age: form.age ? parseInt(form.age) : null,
          date_of_birth: form.date_of_birth?.trim() || null,
          address: form.address?.trim() || null,
          phone: form.phone.trim(),
          emergency_contact_name: form.emergency_contact_name?.trim() || null,
          emergency_contact_phone: form.emergency_contact_phone?.trim() || null,
          status: 'active'
        });
      } else {
        // Create brand new patient
        const patientId = generatePatientId();
        patientRecord = await ethioCareClient.entities.Patient.create({
          full_name: form.full_name.trim(),
          gender: form.gender,
          age: form.age ? parseInt(form.age) : null,
          date_of_birth: form.date_of_birth?.trim() || null,
          address: form.address?.trim() || null,
          phone: form.phone.trim(),
          emergency_contact_name: form.emergency_contact_name?.trim() || null,
          emergency_contact_phone: form.emergency_contact_phone?.trim() || null,
          patient_id: patientId,
          registration_date: format(new Date(), 'yyyy-MM-dd'),
          status: 'active'
        });
      }

      // Create registration payment record (status: pending until cashier receives payment)
      await ethioCareClient.entities.Payment.create({
        patient_id: patientRecord.id,
        patient_name: form.full_name.trim(),
        payment_type: 'registration',
        description: registrationServiceName,
        amount: Number(registrationFee) || 150,
        status: 'pending',
        reference_type: 'registration'
      });

      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });

      setCreated(patientRecord);
      toast.success(`Patient ready: ${patientRecord.patient_id || patientRecord.full_name} (Registration Fee: ${registrationFee} ETB)`);
    } catch (err) {
      console.error('[RegisterPatient] Registration error:', err);
      toast.error(err.message || 'Failed to register patient');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendToQueue = async () => {
    if (!created) return;
    setIsSubmitting(true);
    try {
      const allVisits = await ethioCareClient.entities.Visit.list('-created_date', 200);
      const today = format(new Date(), 'yyyy-MM-dd');
      const todayVisits = allVisits.filter(v => v.visit_date === today);
      const queueNum = todayVisits.length + 1;

      const newVisit = await ethioCareClient.entities.Visit.create({
        patient_id: created.id,
        patient_name: created.full_name,
        visit_date: today,
        queue_number: queueNum,
        status: 'waiting',
        assigned_doctor: selectedDoctor?.full_name || null,
        assigned_doctor_id: selectedDoctor?.id || null,
        registration_fee_paid: false,
        billing_completed: false,
        consultation_completed: false
      });

      // Link pending registration payment to this visit
      const payments = await ethioCareClient.entities.Payment.filter({
        patient_id: created.id,
        reference_type: 'registration',
        status: 'pending'
      });
      if (payments.length > 0) {
        await ethioCareClient.entities.Payment.update(payments[0].id, { visit_id: newVisit.id });
      }

      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });

      toast.success(`Patient added to queue #${queueNum} — Registration fee payment required at Billing before doctor consultation.`);

      notificationService.dispatch({
        title: 'Registration Fee Pending',
        message: `${created.full_name} (${created.patient_id || 'ID Pending'}) requires registration fee payment (${registrationFee} ETB) at Billing before doctor consultation.`,
        type: 'warning',
        module: 'billing',
        targetRoles: ['accountant', 'receptionist', 'owner', 'admin'],
        link: '/reception/billing'
      });

      if (selectedDoctor?.id || selectedDoctor?.full_name) {
        notificationService.dispatch({
          title: 'Patient Assigned to Your Queue',
          message: `${created.full_name} (${created.patient_id || 'ID Pending'}) has been assigned to your consultation queue (#${queueNum}).`,
          type: 'info',
          module: 'queue',
          targetRoles: ['doctor'],
          targetUserId: selectedDoctor.id,
          targetStaffName: selectedDoctor.full_name,
          link: '/doctor/queue'
        });
      }

      // Reset form state cleanly
      setCreated(null);
      setSendToDoctor(false);
      setSelectedDoctor(null);
      setExistingPatientId(null);
      setSelectedServiceId('');
      setForm({
        full_name: '',
        gender: 'Male',
        age: '',
        date_of_birth: '',
        address: '',
        phone: '',
        emergency_contact_name: '',
        emergency_contact_phone: ''
      });
    } catch (err) {
      console.error('[RegisterPatient] Send to queue error:', err);
      toast.error(err.message || 'Failed to send patient to queue');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setCreated(null);
    setSendToDoctor(false);
    setSelectedDoctor(null);
    setExistingPatientId(null);
    setSelectedServiceId('');
    setForm({
      full_name: '',
      gender: 'Male',
      age: '',
      date_of_birth: '',
      address: '',
      phone: '',
      emergency_contact_name: '',
      emergency_contact_phone: ''
    });
  };

  // 1. Success confirmation card
  if (created && !sendToDoctor) {
    return (
      <div className="max-w-xl mx-auto space-y-6 animate-in fade-in-50 duration-200">
        <Card className="border-emerald-500/30 shadow-md">
          <CardHeader className="text-center pb-3">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">
              Patient Registration Ready
            </CardTitle>
            <CardDescription>
              Patient profile is active. Next, send the patient to the Doctor Queue and direct them to Billing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/60 border border-border rounded-xl p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hospital Patient ID</p>
              <p className="text-3xl font-extrabold text-primary mt-1 font-mono tracking-wide">
                {created.patient_id || 'PT-PENDING'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm bg-card/60 p-3.5 rounded-lg border border-border">
              <div>
                <span className="text-muted-foreground text-xs block">Patient Name</span>
                <span className="font-semibold text-foreground">{created.full_name}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-xs block">Phone Number</span>
                <span className="font-semibold text-foreground">{created.phone}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-xs block">Tariff Category</span>
                <span className="font-semibold text-foreground">{registrationServiceName}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-xs block">Registration Fee</span>
                <span className="font-bold text-primary">{(Number(registrationFee) || 0).toLocaleString()} ETB</span>
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <span className="font-semibold block">Gate Rule Enforced:</span>
                Doctor consultation queue will remain locked until the patient pays this registration fee at the Billing Desk.
              </div>
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <div className="flex flex-col sm:flex-row gap-3">
                <Button className="w-full sm:flex-1 h-11 font-medium gap-2" onClick={() => setSendToDoctor(true)}>
                  <Send className="w-4 h-4" />
                  Assign Doctor & Send to Queue
                </Button>
                <Button variant="outline" className="w-full sm:flex-1 h-11" onClick={handleResetForm}>
                  Register Another Patient
                </Button>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-10 gap-2 text-xs border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                onClick={() => setHistoricalModalOpen(true)}
              >
                <BookOpen className="w-3.5 h-3.5" />
                Import Paper History for this Patient
              </Button>
            </div>
          </CardContent>
        </Card>

        {created && (
          <AddHistoricalRecordModal
            open={historicalModalOpen}
            onOpenChange={setHistoricalModalOpen}
            patient={created}
            onRecordAdded={() => {
              queryClient.invalidateQueries({ queryKey: ['patientHistoryAll'] });
              queryClient.invalidateQueries({ queryKey: ['patientHistory', created.id] });
            }}
          />
        )}
      </div>
    );
  }

  // 2. Doctor Queue Assignment step
  if (sendToDoctor && created) {
    return (
      <div className="max-w-xl mx-auto space-y-6 animate-in fade-in-50 duration-200">
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-1">
              <Stethoscope className="w-4 h-4" /> Queue Assignment
            </div>
            <CardTitle className="text-xl font-bold">Assign Doctor for Consultation</CardTitle>
            <CardDescription>
              Assign patient <strong>{created.full_name}</strong> ({created.patient_id}) to an available physician.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="doctor-select">Select Attending Doctor</Label>
                <span className="text-[11px] text-muted-foreground">Live Availability</span>
              </div>
              <Select
                value={selectedDoctor?.full_name || undefined}
                onValueChange={name => {
                  const doc = doctorsWithAvailability.find(d => d.full_name === name);
                  setSelectedDoctor(doc || null);
                }}
              >
                <SelectTrigger id="doctor-select" className="h-11 bg-card">
                  <SelectValue placeholder="Choose a doctor..." />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {doctorsWithAvailability.map(d => (
                    <SelectItem key={d.full_name} value={d.full_name} className="py-2">
                      <div className="flex items-center justify-between gap-3 w-full">
                        <div className="flex flex-col text-left">
                          <span className="font-semibold text-foreground text-xs leading-none">
                            {d.full_name}
                          </span>
                          <span className="text-[10px] text-muted-foreground mt-0.5">
                            {d.specialty || 'General Practice'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${d.availability?.badgeClass || 'bg-slate-100 text-slate-700'}`}>
                            {d.availability?.statusLabel}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono bg-muted/60 px-1.5 py-0.5 rounded">
                            {d.availability?.totalWorkload} in queue
                          </span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                  {doctorsWithAvailability.length === 0 && (
                    <SelectItem value="__none" disabled>
                      No active doctors available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2.5">
              <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <span className="font-semibold block">Workflow Gate Notice:</span>
                Patient will be queued with status <span className="font-mono font-bold">registration_fee_paid: false</span>. The doctor will see this patient in their queue as payment-pending, and consultation will be unlocked immediately upon cashier confirmation.
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                className="w-full sm:flex-1 h-11 font-medium gap-2"
                onClick={handleSendToQueue}
                disabled={isSubmitting || !selectedDoctor}
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? 'Sending to Queue...' : 'Confirm & Send to Queue'}
              </Button>
              <Button
                variant="outline"
                className="w-full sm:w-auto h-11"
                onClick={() => setSendToDoctor(false)}
                disabled={isSubmitting}
              >
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 3. Main Registration Form
  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-primary" /> Register New Patient
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Create patient medical file, apply the 30-day treatment rule, and initiate the consultation workflow.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleResetForm} className="self-start sm:self-auto gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Clear Form
        </Button>
      </div>

      {/* Matched Existing Patient Alert / 30-Day Rule Banner */}
      {matchedExistingPatient && (
        <Card className="border-primary/40 bg-primary/5 shadow-sm">
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <UserCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold text-foreground flex flex-wrap items-center gap-2">
                    Existing Patient File Detected: {matchedExistingPatient.full_name}
                    <Badge variant={feeAssessment?.badgeVariant || 'default'} className="text-[10px]">
                      {feeAssessment?.badgeText || 'Returning Patient'}
                    </Badge>
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Patient ID: <span className="font-mono font-medium text-foreground">{matchedExistingPatient.patient_id}</span> • Phone: {matchedExistingPatient.phone}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 self-start sm:self-auto shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    handleUseExistingPatient(matchedExistingPatient);
                    setHistoricalModalOpen(true);
                  }}
                  className="gap-1 text-xs border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Import Paper History
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => handleUseExistingPatient(matchedExistingPatient)}
                  className="gap-1 text-xs"
                >
                  Use Patient File <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {feeAssessment && (
              <div className="text-xs bg-background/80 rounded-lg p-2.5 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span>
                  <strong>30-Day Policy:</strong> {feeAssessment.isRecent ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      Treated {feeAssessment.daysSinceLastVisit === 0 ? 'Today' : `${feeAssessment.daysSinceLastVisit} days ago`} (≤ 30 days) — Eligible for Revisit Discount!
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {feeAssessment.daysSinceLastVisit !== null ? `Last treated ${feeAssessment.daysSinceLastVisit} days ago (> 30 days)` : 'No prior treatment recorded'} — Standard Registration Tariff applies.
                    </span>
                  )}
                </span>
                <span className="font-bold text-primary shrink-0 self-end sm:self-auto">
                  {feeAssessment.fee.toLocaleString()} ETB
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm">
        <CardHeader className="pb-4 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-semibold">Patient Information</CardTitle>
              <CardDescription>Fill out the patient's personal and emergency contact details.</CardDescription>
            </div>
            {existingPatientId && (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs self-start sm:self-auto">
                Updating Existing Patient: {matchedExistingPatient?.patient_id}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {/* Registration Tariff Policy Card */}
          <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <Label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-primary" /> Registration Tariff & 30-Day Policy
                </Label>
                <p className="text-xs text-muted-foreground">
                  Owner-configured hospital fee for opening patient file
                </p>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-xs text-muted-foreground">Applicable Fee: </span>
                <span className="text-xl font-bold text-primary">
                  {(Number(registrationFee) || 150).toLocaleString()} ETB
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Select
                value={selectedServiceId || activeService?.id || undefined}
                onValueChange={setSelectedServiceId}
              >
                <SelectTrigger className="bg-card h-10">
                  <SelectValue placeholder="Select registration tariff tier..." />
                </SelectTrigger>
                <SelectContent>
                  {regServices.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} — {(Number(s.price) || 0).toLocaleString()} ETB ({s.category})
                    </SelectItem>
                  ))}
                  {regServices.length === 0 && (
                    <SelectItem value="__default" disabled>
                      Standard Patient Registration — 150 ETB
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="reg-name">Full Name <span className="text-destructive">*</span></Label>
              <Input
                id="reg-name"
                value={form.full_name}
                onChange={e => setForm({ ...form, full_name: e.target.value })}
                placeholder="e.g. Abebe Kebede"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reg-gender">Gender <span className="text-destructive">*</span></Label>
              <Select
                value={form.gender || 'Male'}
                onValueChange={v => setForm({ ...form, gender: v })}
              >
                <SelectTrigger id="reg-gender" className="h-10 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reg-phone">Phone Number <span className="text-destructive">*</span></Label>
              <Input
                id="reg-phone"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="+251 9..."
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reg-age">Age</Label>
              <Input
                id="reg-age"
                type="number"
                value={form.age}
                onChange={e => setForm({ ...form, age: e.target.value })}
                placeholder="e.g. 35"
                min="0"
                max="130"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reg-dob">Date of Birth</Label>
              <Input
                id="reg-dob"
                type="date"
                value={form.date_of_birth}
                onChange={e => setForm({ ...form, date_of_birth: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reg-address">Address / City</Label>
              <Input
                id="reg-address"
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                placeholder="e.g. Addis Ababa, Bole"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reg-em-name">Emergency Contact Name</Label>
              <Input
                id="reg-em-name"
                value={form.emergency_contact_name}
                onChange={e => setForm({ ...form, emergency_contact_name: e.target.value })}
                placeholder="e.g. Sara Mohammed (Spouse)"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reg-em-phone">Emergency Contact Phone</Label>
              <Input
                id="reg-em-phone"
                value={form.emergency_contact_phone}
                onChange={e => setForm({ ...form, emergency_contact_phone: e.target.value })}
                placeholder="+251 9..."
              />
            </div>
          </div>

          <div className="pt-2">
            <Button
              className="w-full h-11 font-medium gap-2 text-base"
              size="lg"
              onClick={handleRegister}
              disabled={isSubmitting || !form.full_name.trim() || !form.phone.trim()}
            >
              <UserPlus className="w-5 h-5" />
              {isSubmitting ? 'Registering Patient...' : existingPatientId ? 'Update & Create Visit' : 'Register Patient & Continue'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {(matchedExistingPatient || (existingPatientId ? patients.find(p => p.id === existingPatientId) : null)) && (
        <AddHistoricalRecordModal
          open={historicalModalOpen}
          onOpenChange={setHistoricalModalOpen}
          patient={matchedExistingPatient || patients.find(p => p.id === existingPatientId)}
          onRecordAdded={() => {
            queryClient.invalidateQueries({ queryKey: ['patientHistoryAll'] });
            queryClient.invalidateQueries({ queryKey: ['patients'] });
          }}
        />
      )}
    </div>
  );
}