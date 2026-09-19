import React, { useState, useEffect } from 'react';
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
  FileSpreadsheet, UserCheck, BookOpen
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { buildDoctorList } from '@/lib/doctorUtils';

export default function AddHistoricalRecordModal({ 
  open, 
  onOpenChange, 
  patient, 
  recordToEdit = null,
  onRecordAdded 
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const maxDate = format(new Date(), 'yyyy-MM-dd');
  const isEditing = Boolean(recordToEdit?.id);

  // Load doctors for easy selection
  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: () => ethioCareClient.entities.Staff.list()
  });

  const { data: doctorsList = [] } = useQuery({
    queryKey: ['doctors'],
    queryFn: () => ethioCareClient.entities.Doctor.list()
  });

  const activeDoctors = buildDoctorList(doctorsList, staff);

  const [activeTab, setActiveTab] = useState('clinical');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCustomDoctor, setIsCustomDoctor] = useState(false);

  const [form, setForm] = useState({
    visit_date: '', // EXACT original treatment date written on the paper file
    doctor_name: '',
    doctor_specialty: 'General Medicine',
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

  // Pre-fill form when recordToEdit is provided, or reset when opened fresh
  useEffect(() => {
    if (open && recordToEdit) {
      const docName = recordToEdit.doctor_name || '';
      const isKnownDoc = activeDoctors.some(d => d.full_name === docName);

      setForm({
        visit_date: recordToEdit.visit_date || '',
        doctor_name: docName,
        doctor_specialty: recordToEdit.doctor_specialty || 'General Medicine',
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
      });
      setIsCustomDoctor(!isKnownDoc && Boolean(docName));
    } else if (open && !recordToEdit) {
      setForm({
        visit_date: '',
        doctor_name: '',
        doctor_specialty: 'General Medicine',
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
      setIsCustomDoctor(false);
    }
  }, [open, recordToEdit]);

  const handleFieldChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleDoctorSelect = (docName) => {
    if (docName === '__custom__') {
      setIsCustomDoctor(true);
      setForm(prev => ({ ...prev, doctor_name: '', doctor_specialty: '' }));
      return;
    }
    setIsCustomDoctor(false);
    const doc = activeDoctors.find(d => d.full_name === docName);
    setForm(prev => ({
      ...prev,
      doctor_name: doc?.full_name || docName,
      doctor_specialty: doc?.specialty || 'General Medicine'
    }));
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!patient) {
      toast.error('No patient selected');
      return;
    }

    if (!form.visit_date) {
      toast.error('Original treatment date from paper file is required');
      setActiveTab('clinical');
      return;
    }

    if (!form.doctor_name?.trim()) {
      toast.error('Attending physician name is required');
      setActiveTab('clinical');
      return;
    }

    if (!form.diagnosis?.trim()) {
      toast.error('Historical diagnosis or disease description is required');
      setActiveTab('clinical');
      return;
    }

    setIsSubmitting(true);
    try {
      const staffIdentifier = user?.full_name || user?.email || 'Receptionist';

      const payload = {
        patient_id: patient.id,
        patient_name: patient.full_name,
        patient_phone: patient.phone || null,
        patient_gender: patient.gender || null,
        patient_dob: patient.date_of_birth || null,
        visit_date: form.visit_date.trim(),
        doctor_name: form.doctor_name.trim(),
        doctor_specialty: form.doctor_specialty?.trim() || null,
        diagnosis: form.diagnosis.trim(),
        disease: form.disease?.trim() || null,
        symptoms: form.symptoms?.trim() || null,
        examination_notes: form.examination_notes?.trim() || null,
        treatment: form.treatment?.trim() || null,
        lab_tests: form.lab_tests?.trim() || null,
        lab_results: form.lab_results?.trim() || null,
        nurse_records: form.nurse_records?.trim() || null,
        medicines: form.medicines?.trim() || null,
        medical_reports: form.medical_reports?.trim() || null,
        notes: form.notes?.trim() || null,
        blood_pressure: form.blood_pressure?.trim() || null,
        temperature: form.temperature?.trim() || null,
        weight: form.weight?.trim() || null,
        pulse: form.pulse?.trim() || null,
        digitized_by: staffIdentifier
      };

      if (isEditing && recordToEdit?.id) {
        await historicalRecordService.updateHistoricalRecord(recordToEdit.id, payload, staffIdentifier);
        toast.success(`Paper record from ${form.visit_date} updated successfully for ${patient.full_name}`);
      } else {
        await historicalRecordService.createHistoricalRecord(payload, staffIdentifier);
        toast.success(`Paper record from ${form.visit_date} digitized and imported for ${patient.full_name}`);
      }

      queryClient.invalidateQueries({ queryKey: ['patientHistory', patient.id] });
      queryClient.invalidateQueries({ queryKey: ['patientHistoryAll'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['patientVisits', patient.id] });

      if (onRecordAdded) {
        onRecordAdded();
      }
      onOpenChange(false);
    } catch (err) {
      console.error('[AddHistoricalRecordModal] Submission error:', err);
      toast.error(err.message || 'Failed to save historical paper record');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-5 border-b border-border bg-card/60 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-xs tracking-wider uppercase">
              <BookOpen className="w-4 h-4" />
              Historical / Paper Record Digitization
            </div>
            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
              Pre-EthioCare HMS Archive
            </Badge>
          </div>
          <DialogTitle className="text-lg sm:text-xl font-bold mt-1 text-foreground">
            {isEditing ? 'Edit Historical / Paper Record' : 'Import Paper History'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Digitize previous physical chart visits for <strong>{patient?.full_name}</strong> ({patient?.patient_id || 'ID Pending'}).
            The exact treatment date written on the paper file will be permanently preserved.
          </DialogDescription>
        </DialogHeader>

        {/* Distinctive Notice: Not a Current Visit */}
        <div className="px-4 sm:px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2 shrink-0">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
          <div className="leading-snug">
            <strong>Historical Medical History Only:</strong> This digitizes a patient's past treatment before EthioCare existed.
            It does <strong>NOT</strong> create a current visit, does <strong>NOT</strong> generate a doctor queue number, and does <strong>NOT</strong> create a registration payment.
          </div>
        </div>

        {/* Form Body with Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-3 w-full mb-4">
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
                Rx & Archive
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Clinical & Doctor Details */}
            <TabsContent value="clinical" className="space-y-4 focus-visible:outline-none">
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
                    value={form.visit_date}
                    onChange={(e) => handleFieldChange('visit_date', e.target.value)}
                    className="h-10 text-sm"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Original treatment date from the physical chart (never today's data entry date).
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="doctor_select" className="text-xs font-semibold flex items-center gap-1.5">
                    <Stethoscope className="w-3.5 h-3.5 text-primary" />
                    Attending Physician <span className="text-rose-500">*</span>
                  </Label>
                  {!isCustomDoctor ? (
                    <div className="space-y-2">
                      <Select
                        value={form.doctor_name || undefined}
                        onValueChange={handleDoctorSelect}
                      >
                        <SelectTrigger className="h-10 text-sm">
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
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        placeholder="Dr. Full Name (former or external physician)"
                        value={form.doctor_name}
                        onChange={(e) => handleFieldChange('doctor_name', e.target.value)}
                        className="h-10 text-sm"
                        autoFocus
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 text-muted-foreground hover:text-foreground"
                        onClick={() => setIsCustomDoctor(false)}
                      >
                        ← Choose from staff list
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {isCustomDoctor && (
                <div className="space-y-1.5">
                  <Label htmlFor="doctor_specialty" className="text-xs font-medium">
                    Doctor Specialty / Department
                  </Label>
                  <Input
                    id="doctor_specialty"
                    placeholder="e.g. Internal Medicine, Pediatrics, Surgery"
                    value={form.doctor_specialty}
                    onChange={(e) => handleFieldChange('doctor_specialty', e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <Label htmlFor="diagnosis" className="text-xs font-semibold">
                    Primary Diagnosis <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="diagnosis"
                    placeholder="e.g. Acute Bronchitis, Hypertension, Gastritis"
                    value={form.diagnosis}
                    onChange={(e) => handleFieldChange('diagnosis', e.target.value)}
                    className="h-10 text-sm"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="disease" className="text-xs font-medium">
                    Specific Disease / Condition
                  </Label>
                  <Input
                    id="disease"
                    placeholder="e.g. Type 2 Diabetes, Stage 2 HTN"
                    value={form.disease}
                    onChange={(e) => handleFieldChange('disease', e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="symptoms" className="text-xs font-medium">
                  Patient Symptoms & Chief Complaints
                </Label>
                <Textarea
                  id="symptoms"
                  placeholder="e.g. Fever for 3 days, dry cough, headache, chills"
                  value={form.symptoms}
                  onChange={(e) => handleFieldChange('symptoms', e.target.value)}
                  rows={2}
                  className="text-sm resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="examination_notes" className="text-xs font-medium">
                  Physical Examination Findings
                </Label>
                <Textarea
                  id="examination_notes"
                  placeholder="e.g. Bilateral chest crackles, mild epigastric tenderness, clear throat"
                  value={form.examination_notes}
                  onChange={(e) => handleFieldChange('examination_notes', e.target.value)}
                  rows={2}
                  className="text-sm resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="treatment" className="text-xs font-medium">
                  Treatment / Medical Plan History
                </Label>
                <Textarea
                  id="treatment"
                  placeholder="e.g. Antibiotic therapy prescribed, bed rest, hydration and outpatient follow-up"
                  value={form.treatment}
                  onChange={(e) => handleFieldChange('treatment', e.target.value)}
                  rows={2}
                  className="text-sm resize-none"
                />
              </div>
            </TabsContent>

            {/* TAB 2: Labs & Nursing */}
            <TabsContent value="diagnostics" className="space-y-4 focus-visible:outline-none">
              <div className="space-y-1.5">
                <Label htmlFor="lab_tests" className="text-xs font-medium flex items-center gap-1.5">
                  <FlaskConical className="w-3.5 h-3.5 text-primary" />
                  Lab Tests Conducted
                </Label>
                <Input
                  id="lab_tests"
                  placeholder="e.g. CBC, Widal Test, Urinalysis, Fasting Blood Sugar (FBS)"
                  value={form.lab_tests}
                  onChange={(e) => handleFieldChange('lab_tests', e.target.value)}
                  className="h-10 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lab_results" className="text-xs font-medium">
                  Lab Results & Values
                </Label>
                <Textarea
                  id="lab_results"
                  placeholder="e.g. WBC: 11,200 /mcL, Hb: 14.1 g/dL, Widal 'O' 1:160, FBS: 98 mg/dL"
                  value={form.lab_results}
                  onChange={(e) => handleFieldChange('lab_results', e.target.value)}
                  rows={3}
                  className="text-sm resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nurse_records" className="text-xs font-medium flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-primary" />
                  Nurse Records & In-Hospital Procedures
                </Label>
                <Textarea
                  id="nurse_records"
                  placeholder="e.g. IV Normal Saline 500ml infused, IM Diclofenac 75mg administered, wound dressing with betadine"
                  value={form.nurse_records}
                  onChange={(e) => handleFieldChange('nurse_records', e.target.value)}
                  rows={3}
                  className="text-sm resize-none"
                />
              </div>

              {/* Vitals Grid */}
              <div className="border border-border/80 rounded-xl p-3.5 bg-muted/30 space-y-2.5">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-rose-500" />
                  Historical Vital Signs Recorded on Paper (Optional)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Blood Pressure</Label>
                    <Input
                      placeholder="120/80"
                      value={form.blood_pressure}
                      onChange={(e) => handleFieldChange('blood_pressure', e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Temperature</Label>
                    <Input
                      placeholder="37.0 °C"
                      value={form.temperature}
                      onChange={(e) => handleFieldChange('temperature', e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Pulse</Label>
                    <Input
                      placeholder="76 bpm"
                      value={form.pulse}
                      onChange={(e) => handleFieldChange('pulse', e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Weight</Label>
                    <Input
                      placeholder="68 kg"
                      value={form.weight}
                      onChange={(e) => handleFieldChange('weight', e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: Medicines & Archive Notes */}
            <TabsContent value="notes" className="space-y-4 focus-visible:outline-none">
              <div className="space-y-1.5">
                <Label htmlFor="medicines" className="text-xs font-semibold flex items-center gap-1.5">
                  <Pill className="w-3.5 h-3.5 text-primary" />
                  Medicines & Medications Prescribed / Administered
                </Label>
                <Textarea
                  id="medicines"
                  placeholder="e.g. Amoxicillin 500mg PO TID x 7 days&#10;Paracetamol 500mg PO PRN for pain/fever&#10;Omeprazole 20mg daily before breakfast"
                  value={form.medicines}
                  onChange={(e) => handleFieldChange('medicines', e.target.value)}
                  rows={4}
                  className="text-sm font-mono text-xs leading-relaxed"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="medical_reports" className="text-xs font-medium flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  Paper Chart / Ledger Archive Reference
                </Label>
                <Input
                  id="medical_reports"
                  placeholder="e.g. Old Paper Card #84920, St. Paul archive registry box B-4"
                  value={form.medical_reports}
                  onChange={(e) => handleFieldChange('medical_reports', e.target.value)}
                  className="h-10 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-xs font-medium">
                  Additional Clinical Notes
                </Label>
                <Textarea
                  id="notes"
                  placeholder="Any other comments or historical findings from the paper card..."
                  value={form.notes}
                  onChange={(e) => handleFieldChange('notes', e.target.value)}
                  rows={3}
                  className="text-sm resize-none"
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-border bg-card/60 shrink-0 flex flex-row items-center justify-between sm:justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
          >
            <Save className="w-3.5 h-3.5" />
            {isSubmitting 
              ? (isEditing ? 'Updating Record...' : 'Importing Record...') 
              : (isEditing ? 'Update Paper Record' : 'Import Paper Record')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
