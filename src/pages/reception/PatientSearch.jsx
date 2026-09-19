import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ethioCareClient } from '@/api/ethioCareClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PatientHistoryView from '@/pages/shared/PatientHistoryView';
import AddHistoricalRecordModal from '@/components/reception/AddHistoricalRecordModal';
import { 
  Search, User, Phone, Hash, Calendar, Pencil, 
  Send, ChevronDown, Clock, PlusCircle, UserPlus, 
  AlertCircle, CheckCircle2, ShieldCheck, History, BookOpen
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { buildDoctorList } from '@/lib/doctorUtils';
import { notificationService } from '@/services/notification.service';
import { patientFeeService } from '@/services/patientFee.service';
import { calculateDoctorAvailability } from '@/services/staffAvailability.service';

export default function PatientSearch() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [queueOpen, setQueueOpen] = useState(false);
  const [historicalModalOpen, setHistoricalModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState(null);

  // Queries for live data
  const { data: patients = [], isLoading: isLoadingPatients } = useQuery({
    queryKey: ['patients'],
    queryFn: () => ethioCareClient.entities.Patient.list('-created_date', 500)
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: () => ethioCareClient.entities.Staff.list()
  });

  const { data: doctors = [] } = useQuery({
    queryKey: ['doctors'],
    queryFn: () => ethioCareClient.entities.Doctor.list()
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => ethioCareClient.entities.Service.list()
  });

  const { data: visits = [] } = useQuery({
    queryKey: ['visits'],
    queryFn: () => ethioCareClient.entities.Visit.list('-created_date', 500)
  });

  const { data: allHistory = [] } = useQuery({
    queryKey: ['patientHistoryAll'],
    queryFn: () => ethioCareClient.entities.PatientHistory.list('-visit_date', 1000)
  });

  const allDoctors = useMemo(() => buildDoctorList(doctors, staff), [doctors, staff]);

  const doctorsWithAvailability = useMemo(() => {
    return allDoctors.map(doc => {
      const avail = calculateDoctorAvailability(doc, visits);
      return {
        ...doc,
        availability: avail
      };
    });
  }, [allDoctors, visits]);

  // Determine 30-day treatment rule fee assessment across BOTH system visits and historical records
  const feeAssessment = useMemo(() => {
    if (!selected) return null;
    return patientFeeService.determineRegistrationFee(selected.id, services, visits, allHistory);
  }, [selected, services, visits, allHistory]);

  const feeAmount = feeAssessment?.fee ?? 150;
  const feeName = feeAssessment?.serviceName ?? 'Patient Registration Fee';

  const searched = query.trim().length >= 2;
  const filtered = searched ? patients.filter(p => {
    const q = query.toLowerCase();
    return (
      p.full_name?.toLowerCase().includes(q) ||
      p.phone?.includes(q) ||
      p.patient_id?.toLowerCase().includes(q)
    );
  }) : patients.slice(0, 20);

  const [isSaving, setIsSaving] = useState(false);
  const [isSendingQueue, setIsSendingQueue] = useState(false);

  const openEdit = (patient) => {
    setEditForm({
      full_name: patient.full_name || '',
      phone: patient.phone || '',
      gender: patient.gender || 'Male',
      age: patient.age || '',
      date_of_birth: patient.date_of_birth || '',
      address: patient.address || '',
      emergency_contact_name: patient.emergency_contact_name || '',
      emergency_contact_phone: patient.emergency_contact_phone || '',
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editForm.full_name?.trim() || !editForm.phone?.trim()) {
      toast.error('Full name and phone are required');
      return;
    }
    setIsSaving(true);
    try {
      const sanitized = {
        ...editForm,
        full_name: editForm.full_name.trim(),
        phone: editForm.phone.trim(),
        age: editForm.age ? parseInt(editForm.age) : null,
        date_of_birth: editForm.date_of_birth?.trim() ? editForm.date_of_birth.trim() : null,
        address: editForm.address?.trim() || null,
        emergency_contact_name: editForm.emergency_contact_name?.trim() || null,
        emergency_contact_phone: editForm.emergency_contact_phone?.trim() || null,
      };
      await ethioCareClient.entities.Patient.update(selected.id, sanitized);
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      setSelected(prev => ({ ...prev, ...sanitized }));
      setEditOpen(false);
      toast.success('Patient information updated');
    } catch (err) {
      console.error('[PatientSearch] Update error:', err);
      toast.error(err.message || 'Failed to update patient information');
    } finally {
      setIsSaving(false);
    }
  };

  const sendToQueue = async () => {
    if (!selected) return;
    setIsSendingQueue(true);
    try {
      const allVisits = await ethioCareClient.entities.Visit.list('-created_date', 200);
      const today = format(new Date(), 'yyyy-MM-dd');
      const todayVisits = allVisits.filter(v => v.visit_date === today);
      const queueNum = todayVisits.length + 1;

      // Returning or new patients: create a visit record in waiting status
      const newVisit = await ethioCareClient.entities.Visit.create({
        patient_id: selected.id,
        patient_name: selected.full_name,
        visit_date: today,
        queue_number: queueNum,
        status: 'waiting',
        assigned_doctor: selectedDoctor?.full_name || null,
        assigned_doctor_id: selectedDoctor?.id || null,
        registration_fee_paid: false,
        billing_completed: false,
        consultation_completed: false
      });

      // Create pending registration payment for this current visit using evaluated tariff
      await ethioCareClient.entities.Payment.create({
        visit_id: newVisit.id,
        patient_id: selected.id,
        patient_name: selected.full_name,
        payment_type: 'registration',
        description: feeName,
        amount: feeAmount,
        status: 'pending',
        reference_type: 'registration',
        reference_id: newVisit.id
      });

      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });

      toast.success(`${selected.full_name} added to queue #${queueNum} — Registration fee (${feeAmount} ETB) required at Billing.`);

      notificationService.dispatch({
        title: 'Registration Fee Pending',
        message: `${selected.full_name} (${selected.patient_id || 'ID'}) requires registration fee payment (${feeAmount} ETB) at Billing desk before doctor consultation unlocks.`,
        type: 'warning',
        module: 'billing',
        targetRoles: ['accountant', 'receptionist', 'owner'],
        link: '/reception/billing'
      });

      if (selectedDoctor?.id || selectedDoctor?.full_name) {
        notificationService.dispatch({
          title: 'Patient Assigned to Your Queue',
          message: `${selected.full_name} (${selected.patient_id || 'ID'}) has been assigned to your consultation queue (#${queueNum}).`,
          type: 'info',
          module: 'queue',
          targetRoles: ['doctor'],
          targetUserId: selectedDoctor.id,
          targetStaffName: selectedDoctor.full_name,
          link: '/doctor/queue'
        });
      }

      setQueueOpen(false);
      setSelectedDoctor(null);
    } catch (err) {
      console.error('[PatientSearch] Send to queue error:', err);
      toast.error(err.message || 'Failed to send patient to queue');
    } finally {
      setIsSendingQueue(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Patient Search & Management</h1>
          <p className="text-sm text-muted-foreground">
            Search patient records, view complete clinical histories, add historical archives, and register for doctor visits.
          </p>
        </div>

        <Button 
          onClick={() => navigate('/reception/register')}
          className="gap-2 shrink-0 self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          Register New Patient
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          className="pl-10 h-12 text-base shadow-sm"
          placeholder="Search by patient name, phone number, or PT-ID..."
          value={query}
          onChange={e => { setQuery(e.target.value); setSelected(null); }}
          autoFocus
        />
      </div>

      {/* Results List */}
      <div className="max-w-3xl space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {searched ? `Search Results (${filtered.length})` : `Recent Patients`}
        </p>

        {isLoadingPatients ? (
          <p className="text-sm text-muted-foreground py-4">Loading patient records...</p>
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-xl p-8 text-center space-y-3">
            <User className="w-10 h-10 mx-auto text-muted-foreground/40" />
            <div>
              <p className="text-base font-semibold text-foreground">
                {searched ? `No patient found matching "${query}"` : 'No patients registered yet'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                If this is a new patient or someone with previous paper records, register them first.
              </p>
            </div>
            <Button 
              variant="outline" 
              className="gap-2 text-xs"
              onClick={() => navigate('/reception/register')}
            >
              <UserPlus className="w-4 h-4" />
              Register Patient Now
            </Button>
          </div>
        ) : (
          filtered.map(p => {
            const isSelected = selected?.id === p.id;
            return (
              <div key={p.id} className="space-y-2">
                {/* Patient Select Card */}
                <button
                  type="button"
                  onClick={() => setSelected(isSelected ? null : p)}
                  className={`w-full text-left bg-card border rounded-xl p-4 transition-all hover:shadow-md ${
                    isSelected ? 'border-primary ring-1 ring-primary shadow-soft bg-primary/[0.02]' : 'border-border'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-foreground">{p.full_name}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" />{p.phone}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                            <Hash className="w-3 h-3" />{p.patient_id}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="text-xs bg-secondary text-secondary-foreground">{p.gender}</Badge>
                      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isSelected ? 'rotate-180 text-primary' : ''}`} />
                    </div>
                  </div>
                </button>

                {/* Inline Detail Card for Selected Patient */}
                {isSelected && (
                  <div className="bg-card border border-primary/30 rounded-xl p-4 md:p-6 shadow-soft space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Header with Quick Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-border/60">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-foreground">{p.full_name}</h3>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <Badge className="text-xs bg-secondary text-secondary-foreground">{p.gender}</Badge>
                            {p.age && <Badge className="text-xs bg-secondary text-secondary-foreground">Age {p.age}</Badge>}
                            <Badge className="text-xs bg-primary/10 text-primary font-mono">{p.patient_id}</Badge>
                          </div>
                        </div>
                      </div>

                      {/* Top Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            setEditingRecord(null);
                            setHistoricalModalOpen(true);
                          }}
                          className="gap-1.5 text-xs text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          Import Paper History
                        </Button>

                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => openEdit(p)}
                          className="gap-1.5 text-xs"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit Info
                        </Button>

                        <Button 
                          size="sm" 
                          onClick={() => setQueueOpen(true)}
                          className="gap-1.5 text-xs"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Register for New Visit
                        </Button>
                      </div>
                    </div>

                    {/* Patient Profile Demographics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-muted/20 p-3.5 rounded-lg border border-border/50">
                      <div>
                        <p className="text-muted-foreground">Phone Number</p>
                        <p className="font-semibold text-foreground mt-0.5">{p.phone || '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Date of Birth</p>
                        <p className="font-semibold text-foreground mt-0.5">{p.date_of_birth || '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Residential Address</p>
                        <p className="font-semibold text-foreground mt-0.5">{p.address || '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Registered Date</p>
                        <p className="font-semibold text-foreground mt-0.5">{p.registration_date || '-'}</p>
                      </div>
                      {p.emergency_contact_name && (
                        <div className="col-span-2 sm:col-span-4 pt-1 border-t border-border/40">
                          <p className="text-muted-foreground">Emergency Contact</p>
                          <p className="font-semibold text-foreground mt-0.5">
                            {p.emergency_contact_name} · {p.emergency_contact_phone || 'No phone'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* 30-DAY RETURN ASSESSMENT CARD */}
                    {feeAssessment && (
                      <div className={`p-4 rounded-xl border transition-all ${
                        feeAssessment.isRecent
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : feeAssessment.daysSinceLastVisit !== null
                          ? 'bg-amber-500/10 border-amber-500/30'
                          : 'bg-primary/5 border-primary/20'
                      }`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {feeAssessment.isRecent ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              ) : feeAssessment.daysSinceLastVisit !== null ? (
                                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                              ) : (
                                <UserPlus className="w-5 h-5 text-primary shrink-0" />
                              )}
                              <span className="font-bold text-sm text-foreground">
                                {feeAssessment.statusText}
                              </span>
                              <Badge variant={feeAssessment.badgeVariant} className="text-[11px]">
                                {feeAssessment.badgeText}
                              </Badge>
                            </div>

                            <p className="text-xs text-muted-foreground">
                              {feeAssessment.daysSinceLastVisit !== null ? (
                                <>
                                  Last hospital treatment was{' '}
                                  <strong className="text-foreground">
                                    {feeAssessment.daysSinceLastVisit === 0 ? 'today' : `${feeAssessment.daysSinceLastVisit} days ago`}
                                  </strong>{' '}
                                  on <span className="font-mono font-semibold">{feeAssessment.lastVisitDate}</span>{' '}
                                  ({feeAssessment.lastVisitSource === 'historical' ? 'from historical archive' : 'from previous system visit'}).
                                </>
                              ) : (
                                <>First registration for this patient. No previous hospital treatment records found.</>
                              )}
                            </p>
                          </div>

                          <div className="bg-card px-3.5 py-2 rounded-lg border border-border shrink-0 text-right">
                            <span className="text-[11px] text-muted-foreground block">Applicable Tariff:</span>
                            <span className="text-base font-extrabold text-primary font-mono">
                              {feeAmount} ETB
                            </span>
                            <span className="text-[10px] text-muted-foreground block truncate max-w-[170px]">
                              {feeName}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Complete Patient Clinical & Historical Archive View */}
                    <div className="pt-2 border-t border-border/60">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-primary" />
                          Complete Medical & Historical Records
                        </h4>
                      </div>

                      <PatientHistoryView 
                        patientId={p.id} 
                        patientName={p.full_name}
                        allowAddHistorical={true}
                        onAddHistorical={() => {
                          setEditingRecord(null);
                          setHistoricalModalOpen(true);
                        }}
                        onEditHistorical={(record) => {
                          setEditingRecord(record);
                          setHistoricalModalOpen(true);
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Edit Patient Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Patient Information</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label>Full Name</Label>
              <Input 
                value={editForm.full_name || ''} 
                onChange={e => setEditForm({...editForm, full_name: e.target.value})} 
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Phone</Label>
                <Input 
                  value={editForm.phone || ''} 
                  onChange={e => setEditForm({...editForm, phone: e.target.value})} 
                />
              </div>
              <div>
                <Label>Gender</Label>
                <Select 
                  value={editForm.gender || 'Male'} 
                  onValueChange={v => setEditForm({...editForm, gender: v})}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Age</Label>
                <Input 
                  type="number" 
                  value={editForm.age || ''} 
                  onChange={e => setEditForm({...editForm, age: e.target.value})} 
                />
              </div>
              <div>
                <Label>Date of Birth</Label>
                <Input 
                  type="date" 
                  value={editForm.date_of_birth || ''} 
                  onChange={e => setEditForm({...editForm, date_of_birth: e.target.value})} 
                />
              </div>
            </div>
            <div>
              <Label>Address</Label>
              <Input 
                value={editForm.address || ''} 
                onChange={e => setEditForm({...editForm, address: e.target.value})} 
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Emergency Contact</Label>
                <Input 
                  value={editForm.emergency_contact_name || ''} 
                  onChange={e => setEditForm({...editForm, emergency_contact_name: e.target.value})} 
                />
              </div>
              <div>
                <Label>Emergency Phone</Label>
                <Input 
                  value={editForm.emergency_contact_phone || ''} 
                  onChange={e => setEditForm({...editForm, emergency_contact_phone: e.target.value})} 
                />
              </div>
            </div>
            <Button className="w-full mt-2" onClick={saveEdit} disabled={isSaving}>
              {isSaving ? 'Saving Changes...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send to Doctor Queue Dialog */}
      <Dialog open={queueOpen} onOpenChange={setQueueOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Register New Visit & Send to Queue</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Queue <strong>{selected?.full_name}</strong> for doctor consultation today.
            </p>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs font-semibold">Assign Doctor</Label>
                <span className="text-[11px] text-muted-foreground">Live Shift Availability</span>
              </div>
              <Select
                value={selectedDoctor?.full_name || ''}
                onValueChange={name => setSelectedDoctor(doctorsWithAvailability.find(d => d.full_name === name) || null)}
              >
                <SelectTrigger className="h-11 text-sm">
                  <SelectValue placeholder="Select doctor..." />
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
                </SelectContent>
              </Select>
            </div>

            {/* Applicable Registration Payment Option */}
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">{feeName}</span>
                <span className="font-bold text-primary text-base font-mono">{feeAmount} ETB</span>
              </div>

              {feeAssessment && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant={feeAssessment.badgeVariant} className="text-[10px]">
                      {feeAssessment.statusText}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {feeAssessment.isRecent ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        ≤30-Day Revisit Discount Applied
                      </span>
                    ) : feeAssessment.daysSinceLastVisit !== null ? (
                      <span>
                        Previous visit was &gt;30 days ago. Standard fee applied.
                      </span>
                    ) : (
                      <span>New patient first visit registration tariff.</span>
                    )}
                  </p>
                </div>
              )}

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <strong>Payment Gate:</strong> Doctor consultation queue will remain locked until patient pays this fee at the Billing Desk.
                </div>
              </div>
            </div>

            <Button className="w-full gap-2" onClick={sendToQueue} disabled={isSendingQueue}>
              <Send className="w-4 h-4" />
              {isSendingQueue ? 'Sending to Queue...' : 'Confirm & Add to Queue'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import / Edit Historical Paper Record Modal */}
      {selected && (
        <AddHistoricalRecordModal
          open={historicalModalOpen}
          onOpenChange={(val) => {
            setHistoricalModalOpen(val);
            if (!val) setEditingRecord(null);
          }}
          patient={selected}
          recordToEdit={editingRecord}
          onRecordAdded={() => {
            queryClient.invalidateQueries({ queryKey: ['patientHistoryAll'] });
            queryClient.invalidateQueries({ queryKey: ['patientHistory', selected.id] });
            setEditingRecord(null);
          }}
        />
      )}
    </div>
  );
}