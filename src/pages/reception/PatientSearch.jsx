import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PatientHistoryView from '@/pages/shared/PatientHistoryView';
import { Search, User, Phone, Hash, Calendar, Pencil, Send, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { buildDoctorList } from '@/lib/doctorUtils';
import { notificationService } from '@/services/notification.service';
import { patientFeeService } from '@/services/patientFee.service';

export default function PatientSearch() {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [queueOpen, setQueueOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null); // full doctor object
  const queryClient = useQueryClient();

  const { data: patients = [], isLoading } = useQuery({
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

  const feeAssessment = selected
    ? patientFeeService.determineRegistrationFee(selected.id, services, visits)
    : null;
  const feeAmount = feeAssessment?.fee ?? 150;
  const feeName = feeAssessment?.serviceName ?? 'Patient Registration Fee';

  const allDoctors = buildDoctorList(doctors, staff);

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
      const visits = await ethioCareClient.entities.Visit.list('-created_date', 200);
      const today = format(new Date(), 'yyyy-MM-dd');
      const todayVisits = visits.filter(v => v.visit_date === today);
      const queueNum = todayVisits.length + 1;

      // Returning patients must pay the new visit registration/revisit fee
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

      // Create pending registration payment for this current visit
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
      toast.success(`${selected.full_name} sent to queue #${queueNum} — Revisit fee (${feeAmount} ETB) required at Billing`);
      notificationService.dispatch({
        title: 'Revisit Fee Pending',
        message: `${selected.full_name} (${selected.patient_id || 'ID'}) requires revisit payment (${feeAmount} ETB) before Doctor queue activation.`,
        type: 'warning',
        module: 'billing',
        targetRoles: ['accountant', 'receptionist', 'owner'],
        link: '/reception/billing'
      });
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
      <div>
        <h1 className="text-2xl font-bold">Patient Search</h1>
        <p className="text-sm text-muted-foreground">Search by name, phone number, or patient ID</p>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          className="pl-10 h-12 text-base"
          placeholder="Search patient name, phone, or ID..."
          value={query}
          onChange={e => { setQuery(e.target.value); setSelected(null); }}
          autoFocus
        />
      </div>

      {/* Results */}
      <div className="max-w-xl space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase">
          {searched ? `Search Results (${filtered.length})` : `Recent Patients`}
        </p>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center text-muted-foreground">
            <User className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">{searched ? `No patients found for "${query}"` : 'No patients registered yet'}</p>
          </div>
        ) : filtered.map(p => {
            const isSelected = selected?.id === p.id;
            return (
              <div key={p.id} className="space-y-2">
                <button
                  onClick={() => setSelected(isSelected ? null : p)}
                  className={`w-full text-left bg-card border rounded-xl p-4 transition-all hover:shadow-md ${
                    isSelected ? 'border-primary ring-1 ring-primary shadow-soft bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{p.full_name}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" />{p.phone}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
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

                {/* Inline Accordion Detail Directly Beneath This Patient */}
                {isSelected && (
                  <div className="bg-card border border-primary/30 rounded-xl p-4 md:p-5 shadow-soft space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-border/60">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-foreground">{p.full_name}</h3>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            <Badge className="text-xs bg-secondary text-secondary-foreground">{p.gender}</Badge>
                            {p.age && <Badge className="text-xs bg-secondary text-secondary-foreground">Age {p.age}</Badge>}
                            <Badge className="text-xs bg-primary/10 text-primary font-mono">{p.patient_id}</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                          <Pencil className="w-3.5 h-3.5 mr-1.5" />Edit Info
                        </Button>
                        <Button size="sm" onClick={() => setQueueOpen(true)}>
                          <Send className="w-3.5 h-3.5 mr-1.5" />Send to Queue
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">Phone</p>
                        <p className="font-semibold text-foreground mt-0.5">{p.phone || '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Date of Birth</p>
                        <p className="font-semibold text-foreground mt-0.5">{p.date_of_birth || '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Address</p>
                        <p className="font-semibold text-foreground mt-0.5">{p.address || '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Registered</p>
                        <p className="font-semibold text-foreground mt-0.5">{p.registration_date || '-'}</p>
                      </div>
                      {p.emergency_contact_name && (
                        <div className="col-span-2">
                          <p className="text-muted-foreground">Emergency Contact</p>
                          <p className="font-semibold text-foreground mt-0.5">{p.emergency_contact_name} · {p.emergency_contact_phone}</p>
                        </div>
                      )}
                    </div>

                    {/* Complete Patient History */}
                    <div className="pt-2 border-t border-border/60">
                      <h4 className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-primary" />
                        Complete Clinical & Visit History
                      </h4>
                      <PatientHistoryView patientId={p.id} patientName={p.full_name} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Patient Information</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label>Full Name</Label><Input value={editForm.full_name} onChange={e => setEditForm({...editForm, full_name: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Phone</Label><Input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} /></div>
              <div><Label>Gender</Label>
                <Select value={editForm.gender} onValueChange={v => setEditForm({...editForm, gender: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Age</Label><Input type="number" value={editForm.age} onChange={e => setEditForm({...editForm, age: e.target.value})} /></div>
              <div><Label>Date of Birth</Label><Input type="date" value={editForm.date_of_birth} onChange={e => setEditForm({...editForm, date_of_birth: e.target.value})} /></div>
            </div>
            <div><Label>Address</Label><Input value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Emergency Contact</Label><Input value={editForm.emergency_contact_name} onChange={e => setEditForm({...editForm, emergency_contact_name: e.target.value})} /></div>
              <div><Label>Emergency Phone</Label><Input value={editForm.emergency_contact_phone} onChange={e => setEditForm({...editForm, emergency_contact_phone: e.target.value})} /></div>
            </div>
            <Button className="w-full" onClick={saveEdit} disabled={isSaving}>
              {isSaving ? 'Saving Changes...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send to Queue Dialog */}
      <Dialog open={queueOpen} onOpenChange={setQueueOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Send to Doctor Queue</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">Send <strong>{selected?.full_name}</strong> to today's queue</p>
            <div>
              <Label>Assign Doctor (optional)</Label>
              <Select
                value={selectedDoctor?.full_name || ''}
                onValueChange={name => setSelectedDoctor(allDoctors.find(d => d.full_name === name) || null)}
              >
                <SelectTrigger><SelectValue placeholder="Any available doctor" /></SelectTrigger>
                <SelectContent>
                  {allDoctors.map(d => (
                    <SelectItem key={d.full_name} value={d.full_name}>
                      {d.full_name} {d.specialty ? `(${d.specialty})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">{feeName}</span>
                <span className="font-bold text-primary text-sm">{feeAmount} ETB</span>
              </div>
              {feeAssessment && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant={feeAssessment.badgeVariant} className="text-[10px] py-0 px-1.5 font-normal">
                    {feeAssessment.badgeText}
                  </Badge>
                  {feeAssessment.isRecent ? (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                      ≤30-day treatment discount applied
                    </span>
                  ) : feeAssessment.daysSinceLastVisit !== null ? (
                    <span className="text-[11px] text-muted-foreground">
                      Prior visit &gt;30 days ago (standard fee)
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      First hospital treatment
                    </span>
                  )}
                </div>
              )}
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                Payment Gate: Doctor queue unlocks automatically once payment is marked PAID at Billing desk.
              </p>
            </div>
            <Button className="w-full" onClick={sendToQueue} disabled={isSendingQueue}>
              <Send className="w-4 h-4 mr-2" />{isSendingQueue ? 'Sending to Queue...' : 'Confirm & Send to Queue'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}