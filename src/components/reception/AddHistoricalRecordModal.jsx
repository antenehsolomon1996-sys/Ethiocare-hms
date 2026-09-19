import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import { historicalRecordService } from '@/services/historicalRecord.service';
import { useAuth } from '@/lib/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar, Stethoscope, FileText, FlaskConical, 
  Pill, Activity, Clock, ShieldCheck, AlertCircle, Save, PlusCircle,
  FileSpreadsheet, UserCheck, BookOpen, User, Phone, MapPin, Trash2,
  CheckCircle2, Plus, ArrowRight, UserPlus
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { buildDoctorList } from '@/lib/doctorUtils';

const createEmptyVisit = () => ({
  id: Math.random().toString(36).substring(2, 9),
  visit_date: '',
  doctor_name: '',
  doctor_specialty: 'General Medicine',
  is_custom_doctor: false,
  diagnosis: '',
  disease: '',
  symptoms: '',
  examination_notes: '',
  treatment: '',
  lab_tests: '',
  lab_results: '',
  nurse_records: '',
  medicines: '',
  medical_reports: '',
  notes: '',
  blood_pressure: '',
  temperature: '',
  weight: '',
  pulse: ''
});

export default function AddHistoricalRecordModal({ 
  open, 
  onOpenChange, 
  patient = null, 
  recordToEdit = null,
  onRecordAdded 
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const maxDate = format(new Date(), 'yyyy-MM-dd');
  const isEditing = Boolean(recordToEdit?.id);
  const isStandaloneNewPatient = !patient && !recordToEdit;

  // Load staff & doctors
  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: () => ethioCareClient.entities.Staff.list()
  });

  const { data: doctorsList = [] } = useQuery({
    queryKey: ['doctors'],
    queryFn: () => ethioCareClient.entities.Doctor.list()
  });

  const { data: allPatients = [] } = useQuery({
    queryKey: ['patients'],
    queryFn: () => ethioCareClient.entities.Patient.list('-created_date', 500)
  });

  const activeDoctors = useMemo(() => buildDoctorList(doctorsList, staff), [doctorsList, staff]);

  // Patient demographics state (for new paper patient)
  const [patientForm, setPatientForm] = useState({
    full_name: '',
    gender: 'Male',
    age: '',
    date_of_birth: '',
    phone: '',
    no_phone: false,
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    paper_chart_id: ''
  });

  // Selected existing patient when resolving duplicate
  const [activePatient, setActivePatient] = useState(patient);
  const [ignoredDuplicateId, setIgnoredDuplicateId] = useState(null);

  // Multi-visit management state
  const [visits, setVisits] = useState([createEmptyVisit()]);
  const [selectedVisitIndex, setSelectedVisitIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('clinical');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync activePatient when prop changes
  useEffect(() => {
    setActivePatient(patient);
  }, [patient]);

  // Reset or pre-fill state when opened
  useEffect(() => {
    if (open) {
      if (recordToEdit) {
        // Edit single existing historical record
        const docName = recordToEdit.doctor_name || '';
        const isKnownDoc = activeDoctors.some(d => d.full_name === docName);

        setVisits([{
          id: recordToEdit.id || 'edit-1',
          visit_date: recordToEdit.visit_date || '',
          doctor_name: docName,
          doctor_specialty: recordToEdit.doctor_specialty || 'General Medicine',
          is_custom_doctor: !isKnownDoc && Boolean(docName),
          diagnosis: recordToEdit.diagnosis || '',
          disease: recordToEdit.disease || '',
          symptoms: recordToEdit.symptoms || '',
          examination_notes: recordToEdit.examination_notes || '',
          treatment: recordToEdit.treatment || '',
          lab_tests: recordToEdit.lab_tests || '',
          lab_results: recordToEdit.lab_results || '',
          nurse_records: recordToEdit.nurse_records || '',
          medicines: recordToEdit.medicines || recordToEdit.prescription || '',
          medical_reports: recordToEdit.medical_reports || '',
          notes: recordToEdit.notes || '',
          blood_pressure: recordToEdit.blood_pressure || '',
          temperature: recordToEdit.temperature || '',
          weight: recordToEdit.weight || '',
          pulse: recordToEdit.pulse || ''
        }]);
        setSelectedVisitIndex(0);
        setActiveTab('clinical');
      } else {
        // Fresh creation (either for existing patient or brand new paper patient)
        setVisits([createEmptyVisit()]);
        setSelectedVisitIndex(0);
        setActiveTab('clinical');
        setIgnoredDuplicateId(null);
        setPatientForm({
          full_name: '',
          gender: 'Male',
          age: '',
          date_of_birth: '',
          phone: '',
          no_phone: false,
          address: '',
          emergency_contact_name: '',
          emergency_contact_phone: '',
          paper_chart_id: ''
        });
      }
    }
  }, [open, recordToEdit, activeDoctors]);

  // Live duplicate detection
  const detectedDuplicate = useMemo(() => {
    if (activePatient || isEditing) return null;
    const cleanPhone = patientForm.phone.trim().replace(/\s+/g, '');
    const cleanName = patientForm.full_name.trim().toLowerCase();

    if (!cleanPhone && cleanName.length < 3) return null;

    const found = allPatients.find(p => {
      if (ignoredDuplicateId && p.id === ignoredDuplicateId) return false;
      if (cleanPhone && cleanPhone !== 'n/a' && p.phone) {
        const patPhone = p.phone.replace(/\s+/g, '');
        if (patPhone && patPhone === cleanPhone) return true;
      }
      if (cleanName.length >= 3 && p.full_name && p.full_name.trim().toLowerCase() === cleanName) {
        return true;
      }
      return false;
    });

    return found || null;
  }, [allPatients, patientForm.phone, patientForm.full_name, activePatient, isEditing, ignoredDuplicateId]);

  // Current active visit helper
  const currentVisit = visits[selectedVisitIndex] || visits[0];

  const handleVisitFieldChange = (field, value) => {
    setVisits(prev => {
      const updated = [...prev];
      updated[selectedVisitIndex] = {
        ...updated[selectedVisitIndex],
        [field]: value
      };
      return updated;
    });
  };

  const handleDoctorSelect = (docName) => {
    if (docName === '__custom__') {
      handleVisitFieldChange('is_custom_doctor', true);
      handleVisitFieldChange('doctor_name', '');
      handleVisitFieldChange('doctor_specialty', '');
      return;
    }
    const doc = activeDoctors.find(d => d.full_name === docName);
    setVisits(prev => {
      const updated = [...prev];
      updated[selectedVisitIndex] = {
        ...updated[selectedVisitIndex],
        is_custom_doctor: false,
        doctor_name: doc?.full_name || docName,
        doctor_specialty: doc?.specialty || 'General Medicine'
      };
      return updated;
    });
  };

  const handleAddAnotherVisit = () => {
    const newV = createEmptyVisit();
    setVisits(prev => [...prev, newV]);
    setSelectedVisitIndex(visits.length);
    setActiveTab('clinical');
    toast.info(`Added Historical Visit #${visits.length + 1}`);
  };

  const handleRemoveVisit = (indexToRemove) => {
    if (visits.length <= 1) {
      toast.error('A paper file must have at least one historical visit');
      return;
    }
    setVisits(prev => prev.filter((_, idx) => idx !== indexToRemove));
    setSelectedVisitIndex(Math.max(0, indexToRemove - 1));
  };

  const handleUseDuplicatePatient = (dup) => {
    setActivePatient(dup);
    setIgnoredDuplicateId(null);
    toast.success(`Attached to existing patient: ${dup.full_name} (${dup.patient_id})`);
  };

  const handleIgnoreDuplicate = () => {
    if (detectedDuplicate) {
      setIgnoredDuplicateId(detectedDuplicate.id);
      toast.info('Confirmed: Proceeding with separate new patient record.');
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();

    // 1. Validate Patient Demographics if new patient
    if (!activePatient && !isEditing) {
      if (!patientForm.full_name.trim()) {
        toast.error('Patient full name from paper file is required');
        return;
      }
      if (!patientForm.no_phone && !patientForm.phone.trim()) {
        toast.error('Phone number is required (or check "No phone number on paper chart")');
        return;
      }
    }

    // 2. Validate all historical visits
    for (let i = 0; i < visits.length; i++) {
      const v = visits[i];
      if (!v.visit_date?.trim()) {
        toast.error(`Visit #${i + 1}: Treatment date from paper file is required`);
        setSelectedVisitIndex(i);
        setActiveTab('clinical');
        return;
      }
      if (!v.doctor_name?.trim()) {
        toast.error(`Visit #${i + 1}: Attending physician name is required`);
        setSelectedVisitIndex(i);
        setActiveTab('clinical');
        return;
      }
      if (!v.diagnosis?.trim()) {
        toast.error(`Visit #${i + 1}: Primary diagnosis / disease is required`);
        setSelectedVisitIndex(i);
        setActiveTab('clinical');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const staffIdentifier = user?.full_name || user?.email || 'Receptionist';

      if (isEditing && recordToEdit?.id) {
        // Single record edit mode
        const v = visits[0];
        const payload = {
          patient_id: activePatient?.id || recordToEdit.patient_id,
          patient_name: activePatient?.full_name || recordToEdit.patient_name,
          patient_phone: activePatient?.phone || null,
          patient_gender: activePatient?.gender || null,
          patient_dob: activePatient?.date_of_birth || null,
          visit_date: v.visit_date.trim(),
          doctor_name: v.doctor_name.trim(),
          doctor_specialty: v.doctor_specialty?.trim() || null,
          diagnosis: v.diagnosis.trim(),
          disease: v.disease?.trim() || null,
          symptoms: v.symptoms?.trim() || null,
          examination_notes: v.examination_notes?.trim() || null,
          treatment: v.treatment?.trim() || null,
          lab_tests: v.lab_tests?.trim() || null,
          lab_results: v.lab_results?.trim() || null,
          nurse_records: v.nurse_records?.trim() || null,
          medicines: v.medicines?.trim() || null,
          medical_reports: v.medical_reports?.trim() || null,
          notes: v.notes?.trim() || null,
          blood_pressure: v.blood_pressure?.trim() || null,
          temperature: v.temperature?.trim() || null,
          weight: v.weight?.trim() || null,
          pulse: v.pulse?.trim() || null,
          digitized_by: staffIdentifier
        };

        await historicalRecordService.updateHistoricalRecord(recordToEdit.id, payload, staffIdentifier);
        toast.success(`Paper record from ${v.visit_date} updated successfully`);
      } else if (activePatient) {
        // Adding one or multiple historical visits to an EXISTING patient
        for (let i = 0; i < visits.length; i++) {
          const v = visits[i];
          const payload = {
            patient_id: activePatient.id,
            patient_name: activePatient.full_name,
            patient_phone: activePatient.phone || null,
            patient_gender: activePatient.gender || null,
            patient_dob: activePatient.date_of_birth || null,
            visit_date: v.visit_date.trim(),
            doctor_name: v.doctor_name.trim(),
            doctor_specialty: v.doctor_specialty?.trim() || null,
            diagnosis: v.diagnosis.trim(),
            disease: v.disease?.trim() || null,
            symptoms: v.symptoms?.trim() || null,
            examination_notes: v.examination_notes?.trim() || null,
            treatment: v.treatment?.trim() || null,
            lab_tests: v.lab_tests?.trim() || null,
            lab_results: v.lab_results?.trim() || null,
            nurse_records: v.nurse_records?.trim() || null,
            medicines: v.medicines?.trim() || null,
            medical_reports: v.medical_reports?.trim() || null,
            notes: v.notes?.trim() || null,
            blood_pressure: v.blood_pressure?.trim() || null,
            temperature: v.temperature?.trim() || null,
            weight: v.weight?.trim() || null,
            pulse: v.pulse?.trim() || null,
            digitized_by: staffIdentifier
          };
          await historicalRecordService.createHistoricalRecord(payload, staffIdentifier);
        }
        toast.success(`Imported ${visits.length} historical paper record(s) for ${activePatient.full_name}`);
      } else {
        // Brand NEW paper patient file + historical visits
        const patientData = {
          full_name: patientForm.full_name.trim(),
          gender: patientForm.gender,
          age: patientForm.age ? parseInt(patientForm.age) : null,
          date_of_birth: patientForm.date_of_birth?.trim() || null,
          address: patientForm.address?.trim() || null,
          phone: patientForm.no_phone ? 'N/A (Paper Chart)' : patientForm.phone.trim(),
          emergency_contact_name: patientForm.emergency_contact_name?.trim() || null,
          emergency_contact_phone: patientForm.emergency_contact_phone?.trim() || null,
          paper_chart_id: patientForm.paper_chart_id?.trim() || null
        };

        const result = await historicalRecordService.createPaperPatientWithVisits(
          patientData,
          visits.map(v => ({
            visit_date: v.visit_date.trim(),
            doctor_name: v.doctor_name.trim(),
            doctor_specialty: v.doctor_specialty?.trim() || null,
            diagnosis: v.diagnosis.trim(),
            disease: v.disease?.trim() || null,
            symptoms: v.symptoms?.trim() || null,
            examination_notes: v.examination_notes?.trim() || null,
            treatment: v.treatment?.trim() || null,
            lab_tests: v.lab_tests?.trim() || null,
            lab_results: v.lab_results?.trim() || null,
            nurse_records: v.nurse_records?.trim() || null,
            medicines: v.medicines?.trim() || null,
            medical_reports: v.medical_reports?.trim() || patientData.paper_chart_id || null,
            notes: v.notes?.trim() || null,
            blood_pressure: v.blood_pressure?.trim() || null,
            temperature: v.temperature?.trim() || null,
            weight: v.weight?.trim() || null,
            pulse: v.pulse?.trim() || null,
            digitized_by: staffIdentifier
          })),
          staffIdentifier
        );

        toast.success(`Paper patient file created (${result.patient.patient_id}) with ${visits.length} historical visit(s)!`);
      }

      // Invalidate queries across the app
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['patientHistoryAll'] });
      if (activePatient?.id) {
        queryClient.invalidateQueries({ queryKey: ['patientHistory', activePatient.id] });
        queryClient.invalidateQueries({ queryKey: ['patientVisits', activePatient.id] });
      }

      if (onRecordAdded) {
        onRecordAdded();
      }
      onOpenChange(false);
    } catch (err) {
      console.error('[AddHistoricalRecordModal] Submission error:', err);
      toast.error(err.message || 'Failed to save historical paper records');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayName = activePatient?.full_name || (patientForm.full_name ? patientForm.full_name : 'New Paper Patient');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-5 border-b border-border bg-card/70 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-xs tracking-wider uppercase">
              <BookOpen className="w-4 h-4" />
              Pre-EthioCare Chart Archive Digitization
            </div>
            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 font-medium">
              Historical Paper File
            </Badge>
          </div>
          <DialogTitle className="text-lg sm:text-xl font-bold mt-1 text-foreground flex items-center gap-2">
            {isEditing ? 'Edit Historical / Paper Record' : activePatient ? `Import Paper History for ${displayName}` : 'Import Old Paper Patient File'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Digitize previous physical hospital chart records from past months/years.
            Original paper treatment dates and physician findings will be permanently preserved.
          </DialogDescription>
        </DialogHeader>

        {/* Distinctive Notice: Not a Live Visit / No Billing / No Queue */}
        <div className="px-4 sm:px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5 shrink-0">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
          <div className="leading-snug">
            <strong>Historical Archive Mode Only:</strong> This records previous hospital treatments that occurred before EthioCare HMS.
            It does <strong>NOT</strong> create a current visit, does <strong>NOT</strong> queue the patient, and does <strong>NOT</strong> generate a registration payment.
          </div>
        </div>

        {/* Main Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* SECTION 1: Patient Demographics (Rendered when creating a new paper patient) */}
          {!activePatient && !isEditing && (
            <div className="border border-border rounded-xl p-4 bg-muted/20 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    1. Patient Details from Physical Chart
                  </h3>
                </div>
                <span className="text-[11px] text-muted-foreground">Paper Demographic Records</span>
              </div>

              {/* Duplicate Detection Alert */}
              {detectedDuplicate && (
                <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-lg text-xs space-y-2 text-amber-900 dark:text-amber-200">
                  <div className="flex items-start gap-2">
                    <UserCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Existing Patient File Detected in HMS:</p>
                      <p className="mt-0.5">
                        <strong>{detectedDuplicate.full_name}</strong> (ID: <span className="font-mono">{detectedDuplicate.patient_id}</span>, Phone: {detectedDuplicate.phone || 'N/A'})
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Is this the same patient? You can attach this paper history to their existing file or confirm this is a genuinely different person.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-7 text-xs gap-1 font-semibold"
                      onClick={() => handleUseDuplicatePatient(detectedDuplicate)}
                    >
                      <UserCheck className="w-3.5 h-3.5 text-primary" />
                      Attach to Existing Patient ({detectedDuplicate.patient_id})
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={handleIgnoreDuplicate}
                    >
                      Confirm Genuinely Different Person
                    </Button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-xs font-semibold">
                    Full Patient Name <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    placeholder="e.g. Almaz Bekele"
                    value={patientForm.full_name}
                    onChange={(e) => setPatientForm(prev => ({ ...prev, full_name: e.target.value }))}
                    className="h-9 text-sm"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Gender</Label>
                  <Select
                    value={patientForm.gender}
                    onValueChange={(val) => setPatientForm(prev => ({ ...prev, gender: val }))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">
                      Phone Number {!patientForm.no_phone && <span className="text-rose-500">*</span>}
                    </Label>
                    <label className="text-[11px] text-muted-foreground flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={patientForm.no_phone}
                        onChange={(e) => setPatientForm(prev => ({ ...prev, no_phone: e.target.checked }))}
                        className="rounded text-primary h-3 w-3"
                      />
                      No phone
                    </label>
                  </div>
                  <Input
                    placeholder="+251 9..."
                    value={patientForm.phone}
                    disabled={patientForm.no_phone}
                    onChange={(e) => setPatientForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Age</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 42"
                    value={patientForm.age}
                    onChange={(e) => setPatientForm(prev => ({ ...prev, age: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Date of Birth</Label>
                  <Input
                    type="date"
                    max={maxDate}
                    value={patientForm.date_of_birth}
                    onChange={(e) => setPatientForm(prev => ({ ...prev, date_of_birth: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Residential Address</Label>
                  <Input
                    placeholder="e.g. Addis Ababa, Bole Sub-city"
                    value={patientForm.address}
                    onChange={(e) => setPatientForm(prev => ({ ...prev, address: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Original Paper Card # / Archive Box</Label>
                  <Input
                    placeholder="e.g. Paper Card #10492 / Archive Shelf 3"
                    value={patientForm.paper_chart_id}
                    onChange={(e) => setPatientForm(prev => ({ ...prev, paper_chart_id: e.target.value }))}
                    className="h-9 text-sm font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* If working with an already existing patient, show patient badge bar */}
          {activePatient && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    {activePatient.full_name}
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {activePatient.patient_id}
                    </Badge>
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Phone: {activePatient.phone || 'N/A'} • Gender: {activePatient.gender || 'N/A'} {activePatient.age ? `• Age: ${activePatient.age}` : ''}
                  </p>
                </div>
              </div>

              {isStandaloneNewPatient && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 text-muted-foreground hover:text-foreground self-start sm:self-auto"
                  onClick={() => setActivePatient(null)}
                >
                  Switch to creating new patient
                </Button>
              )}
            </div>
          )}

          {/* SECTION 2: Historical Visits Management (Support for Multiple Historical Visits) */}
          <div className="border border-border rounded-xl p-4 bg-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  {!activePatient && !isEditing ? '2. Historical Visits on Paper Chart' : 'Historical Paper Visits'}
                </h3>
              </div>

              {/* Add Another Visit Button */}
              {!isEditing && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 gap-1 border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                  onClick={handleAddAnotherVisit}
                >
                  <Plus className="w-3.5 h-3.5" />
                  + Add Another Historical Visit
                </Button>
              )}
            </div>

            {/* Visit Selector Tabs when multiple visits exist */}
            {visits.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {visits.map((v, idx) => (
                  <div key={v.id || idx} className="flex items-center shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedVisitIndex(idx)}
                      className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all flex items-center gap-1.5 ${
                        selectedVisitIndex === idx
                          ? 'bg-amber-500/15 border-amber-500/50 text-amber-900 dark:text-amber-200 font-bold shadow-xs'
                          : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <BookOpen className="w-3 h-3" />
                      Visit #{idx + 1} {v.visit_date ? `(${v.visit_date})` : ''}
                    </button>
                    <button
                      type="button"
                      title="Remove this visit"
                      onClick={() => handleRemoveVisit(idx)}
                      className="ml-1 p-1 text-muted-foreground hover:text-rose-600 rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Sub-tabs for the Selected Visit */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-3 w-full mb-3">
                <TabsTrigger value="clinical" className="text-xs">
                  <Stethoscope className="w-3.5 h-3.5 mr-1" />
                  Clinical & Doctor
                </TabsTrigger>
                <TabsTrigger value="diagnostics" className="text-xs">
                  <FlaskConical className="w-3.5 h-3.5 mr-1" />
                  Labs & Nursing
                </TabsTrigger>
                <TabsTrigger value="notes" className="text-xs">
                  <FileText className="w-3.5 h-3.5 mr-1" />
                  Rx & Ledger Notes
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: Clinical & Doctor */}
              <TabsContent value="clinical" className="space-y-3.5 focus-visible:outline-none">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="visit_date" className="text-xs font-semibold flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-primary" />
                      Exact Date Written on Paper <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="visit_date"
                      type="date"
                      max={maxDate}
                      value={currentVisit.visit_date}
                      onChange={(e) => handleVisitFieldChange('visit_date', e.target.value)}
                      className="h-9 text-sm"
                      required
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Exact treatment date from chart (e.g. 2024-03-15). Never today's digitization date.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="doctor_select" className="text-xs font-semibold flex items-center gap-1.5">
                      <Stethoscope className="w-3.5 h-3.5 text-primary" />
                      Attending Physician <span className="text-rose-500">*</span>
                    </Label>
                    {!currentVisit.is_custom_doctor ? (
                      <Select
                        value={currentVisit.doctor_name || undefined}
                        onValueChange={handleDoctorSelect}
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Select doctor or choose custom..." />
                        </SelectTrigger>
                        <SelectContent>
                          {activeDoctors.map((doc) => (
                            <SelectItem key={doc.id || doc.full_name} value={doc.full_name}>
                              {doc.full_name} {doc.specialty ? `(${doc.specialty})` : ''}
                            </SelectItem>
                          ))}
                          <SelectItem value="__custom__" className="text-primary font-medium">
                            + Enter External / Former Doctor Name
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="space-y-1.5">
                        <Input
                          placeholder="Dr. Full Name (former or external physician)"
                          value={currentVisit.doctor_name}
                          onChange={(e) => handleVisitFieldChange('doctor_name', e.target.value)}
                          className="h-9 text-sm"
                          autoFocus
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs h-6 px-1 text-muted-foreground hover:text-foreground"
                          onClick={() => handleVisitFieldChange('is_custom_doctor', false)}
                        >
                          ← Choose from staff list
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {currentVisit.is_custom_doctor && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Doctor Specialty / Department</Label>
                    <Input
                      placeholder="e.g. Internal Medicine, Pediatrics, Surgery, General Practice"
                      value={currentVisit.doctor_specialty}
                      onChange={(e) => handleVisitFieldChange('doctor_specialty', e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      Primary Diagnosis <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      placeholder="e.g. Acute Bronchitis, Typhoid Fever, Hypertension"
                      value={currentVisit.diagnosis}
                      onChange={(e) => handleVisitFieldChange('diagnosis', e.target.value)}
                      className="h-9 text-sm"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Specific Disease / Condition</Label>
                    <Input
                      placeholder="e.g. Type 2 Diabetes, Stage 2 HTN"
                      value={currentVisit.disease}
                      onChange={(e) => handleVisitFieldChange('disease', e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Patient Symptoms & Chief Complaints</Label>
                  <Textarea
                    placeholder="e.g. High fever for 4 days, persistent dry cough, chills, fatigue"
                    value={currentVisit.symptoms}
                    onChange={(e) => handleVisitFieldChange('symptoms', e.target.value)}
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Physical Examination Findings</Label>
                  <Textarea
                    placeholder="e.g. Chest clear on auscultation, mild epigastric tenderness, throat normal"
                    value={currentVisit.examination_notes}
                    onChange={(e) => handleVisitFieldChange('examination_notes', e.target.value)}
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Treatment & Clinical Plan</Label>
                  <Textarea
                    placeholder="e.g. Antibiotic therapy initiated, bed rest, hydration, return for review in 5 days"
                    value={currentVisit.treatment}
                    onChange={(e) => handleVisitFieldChange('treatment', e.target.value)}
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>
              </TabsContent>

              {/* TAB 2: Labs & Nursing */}
              <TabsContent value="diagnostics" className="space-y-3.5 focus-visible:outline-none">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <FlaskConical className="w-3.5 h-3.5 text-primary" />
                    Lab Tests Ordered
                  </Label>
                  <Input
                    placeholder="e.g. CBC, Widal Test, Urinalysis, Fasting Blood Sugar (FBS), Stool Examination"
                    value={currentVisit.lab_tests}
                    onChange={(e) => handleVisitFieldChange('lab_tests', e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Lab Results & Values</Label>
                  <Textarea
                    placeholder="e.g. WBC: 12,400 /mcL, Hb: 13.8 g/dL, Widal 'O' 1:160, 'H' 1:80, FBS: 104 mg/dL"
                    value={currentVisit.lab_results}
                    onChange={(e) => handleVisitFieldChange('lab_results', e.target.value)}
                    rows={3}
                    className="text-sm resize-none font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-primary" />
                    Nursing Records & Procedures
                  </Label>
                  <Textarea
                    placeholder="e.g. IV Normal Saline 500ml infused, IM Diclofenac 75mg given, wound dressed with povidone-iodine"
                    value={currentVisit.nurse_records}
                    onChange={(e) => handleVisitFieldChange('nurse_records', e.target.value)}
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>

                {/* Vitals Grid */}
                <div className="border border-border/80 rounded-xl p-3 bg-muted/30 space-y-2">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-rose-500" />
                    Historical Vital Signs on Paper (Optional)
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Blood Pressure</Label>
                      <Input
                        placeholder="120/80"
                        value={currentVisit.blood_pressure}
                        onChange={(e) => handleVisitFieldChange('blood_pressure', e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Temperature</Label>
                      <Input
                        placeholder="37.2 °C"
                        value={currentVisit.temperature}
                        onChange={(e) => handleVisitFieldChange('temperature', e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Pulse</Label>
                      <Input
                        placeholder="78 bpm"
                        value={currentVisit.pulse}
                        onChange={(e) => handleVisitFieldChange('pulse', e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Weight</Label>
                      <Input
                        placeholder="65 kg"
                        value={currentVisit.weight}
                        onChange={(e) => handleVisitFieldChange('weight', e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* TAB 3: Medicines & Archive Notes */}
              <TabsContent value="notes" className="space-y-3.5 focus-visible:outline-none">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Pill className="w-3.5 h-3.5 text-primary" />
                    Medicines Prescribed / Administered
                  </Label>
                  <Textarea
                    placeholder="e.g. Ciprofloxacin 500mg PO BID x 7 days&#10;Paracetamol 500mg PO TID PRN for fever&#10;ORS sachets 1L daily x 3 days"
                    value={currentVisit.medicines}
                    onChange={(e) => handleVisitFieldChange('medicines', e.target.value)}
                    rows={4}
                    className="text-xs font-mono leading-relaxed"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-primary" />
                    Paper Chart / Ledger Archive Reference
                  </Label>
                  <Input
                    placeholder="e.g. Card #10492 / Registry Book 2024 page 88"
                    value={currentVisit.medical_reports}
                    onChange={(e) => handleVisitFieldChange('medical_reports', e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Additional Clinical Notes</Label>
                  <Textarea
                    placeholder="Any other observations, referrals, or comments noted on the paper file..."
                    value={currentVisit.notes}
                    onChange={(e) => handleVisitFieldChange('notes', e.target.value)}
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-border bg-card/70 shrink-0 flex flex-row items-center justify-between sm:justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            {!isEditing && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddAnotherVisit}
                disabled={isSubmitting}
                className="text-xs border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Another Visit ({visits.length})
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Save className="w-3.5 h-3.5" />
              {isSubmitting 
                ? (isEditing ? 'Saving Changes...' : 'Importing Paper File...') 
                : (isEditing ? 'Update Paper Record' : `Save ${visits.length > 1 ? `(${visits.length} Visits)` : 'Paper File'}`)}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
