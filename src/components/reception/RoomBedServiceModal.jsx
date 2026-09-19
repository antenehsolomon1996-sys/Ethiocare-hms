import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import { inpatientBedService } from '@/services/inpatientBed.service';
import { useAuth } from '@/lib/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  Building2, BedSingle, Calendar, Clock, DollarSign, 
  Receipt, CheckCircle2, AlertCircle, ShieldCheck, User, Search
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import ReceiptModal from '@/components/billing/ReceiptModal';

export default function RoomBedServiceModal({ 
  open, 
  onOpenChange, 
  visit = null, 
  initialPatient = null,
  onAssigned 
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Form State
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedBedId, setSelectedBedId] = useState('');
  const [admissionDate, setAdmissionDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [expectedDays, setExpectedDays] = useState(1);
  const [depositPaymentMode, setDepositPaymentMode] = useState('collect_now'); // 'collect_now' | 'pay_later' | 'waived'
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [customDepositAmount, setCustomDepositAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState(null);

  // 1. Fetch live rooms and beds
  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => ethioCareClient.entities.Room.list(),
    enabled: open
  });

  const { data: beds = [] } = useQuery({
    queryKey: ['beds'],
    queryFn: () => ethioCareClient.entities.Bed.list(),
    enabled: open
  });

  const { data: allPatients = [] } = useQuery({
    queryKey: ['patients'],
    queryFn: () => ethioCareClient.entities.Patient.list('-created_date', 300),
    enabled: open && !visit
  });

  // Active available rooms
  const activeRooms = useMemo(() => {
    return rooms.filter(r => r.status === 'available' || r.status === 'open' || !r.status);
  }, [rooms]);

  // Selected room
  const selectedRoom = useMemo(() => {
    return activeRooms.find(r => String(r.id) === String(selectedRoomId));
  }, [activeRooms, selectedRoomId]);

  // Available beds for selected room
  const availableBedsForRoom = useMemo(() => {
    if (!selectedRoomId) return [];
    return beds.filter(b => 
      String(b.room_id) === String(selectedRoomId) && 
      (b.status === 'available' || b.status === 'released' || !b.status)
    );
  }, [beds, selectedRoomId]);

  const selectedBed = useMemo(() => {
    return availableBedsForRoom.find(b => String(b.id) === String(selectedBedId));
  }, [availableBedsForRoom, selectedBedId]);

  // Effective daily rate
  const dailyRate = useMemo(() => {
    return inpatientBedService.getEffectiveBedPrice(selectedBed, selectedRoom);
  }, [selectedBed, selectedRoom]);

  // Estimated gross charge
  const estimatedGross = useMemo(() => {
    const days = Math.max(1, parseInt(String(expectedDays)) || 1);
    return days * dailyRate;
  }, [expectedDays, dailyRate]);

  // Actual deposit amount to record
  const depositAmount = useMemo(() => {
    if (depositPaymentMode === 'waived') return 0;
    if (customDepositAmount !== '' && !isNaN(parseFloat(customDepositAmount))) {
      return Math.max(0, parseFloat(customDepositAmount));
    }
    return estimatedGross;
  }, [depositPaymentMode, customDepositAmount, estimatedGross]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setSelectedRoomId('');
      setSelectedBedId('');
      setAdmissionDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
      setExpectedDays(1);
      setDepositPaymentMode('collect_now');
      setPaymentMethod('cash');
      setCustomDepositAmount('');
      setNotes('');
      setActiveReceipt(null);

      if (visit) {
        setSelectedPatientId(visit.patient_id || '');
      } else if (initialPatient) {
        setSelectedPatientId(initialPatient.id || '');
      } else {
        setSelectedPatientId('');
      }
    }
  }, [open, visit, initialPatient]);

  // Resolve target patient object
  const activePatient = useMemo(() => {
    if (visit) {
      return {
        id: visit.patient_id,
        full_name: visit.patient_name,
        patient_id: visit.patient_hospital_id || visit.patient_id
      };
    }
    if (initialPatient) return initialPatient;
    return allPatients.find(p => p.id === selectedPatientId) || null;
  }, [visit, initialPatient, allPatients, selectedPatientId]);

  // Filtered patients for standalone search
  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return allPatients.slice(0, 8);
    const q = patientSearch.toLowerCase();
    return allPatients.filter(p => 
      p.full_name?.toLowerCase().includes(q) ||
      p.phone?.includes(q) ||
      p.patient_id?.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [allPatients, patientSearch]);

  const handleAssignBed = async () => {
    if (!activePatient) {
      toast.error('Please select an inpatient to admit');
      return;
    }
    if (!selectedRoom || !selectedBed) {
      toast.error('Please select both a room and an available bed');
      return;
    }
    if (selectedBed.status === 'occupied') {
      toast.error('This bed was just booked by another staff member. Please select another bed.');
      return;
    }

    setIsSubmitting(true);
    try {
      const staffIdentifier = user?.full_name || 'Reception Staff';
      const days = Math.max(1, parseInt(String(expectedDays)) || 1);

      const result = await inpatientBedService.assignBed({
        patient_id: activePatient.id,
        patient_name: activePatient.full_name,
        visit_id: visit?.id || null,
        room_id: selectedRoom.id,
        bed_id: selectedBed.id,
        admission_date: new Date(admissionDate).toISOString(),
        expected_days: days,
        daily_rate: dailyRate,
        deposit_amount: depositAmount,
        payment_method: paymentMethod,
        payment_status: depositPaymentMode === 'collect_now' ? 'paid' : depositPaymentMode === 'waived' ? 'waived' : 'pending',
        notes: notes?.trim() || null
      }, staffIdentifier);

      queryClient.invalidateQueries({ queryKey: ['beds'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['bed_assignments'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['financialSummary'] });

      toast.success(`${activePatient.full_name} successfully admitted to Room ${selectedRoom.room_number}, Bed ${selectedBed.bed_number}`);

      if (depositPaymentMode === 'collect_now' && result.receiptNumber) {
        setActiveReceipt(result.payment || {
          receipt_number: result.receiptNumber,
          patient_name: activePatient.full_name,
          payment_type: 'bed',
          description: `Inpatient Admission Deposit — Room ${selectedRoom.room_number}, Bed ${selectedBed.bed_number}`,
          amount: depositAmount,
          payment_method: paymentMethod,
          cashier_name: staffIdentifier,
          paid_date: format(new Date(), 'yyyy-MM-dd')
        });
      }

      if (onAssigned) onAssigned(result);
      if (depositPaymentMode !== 'collect_now') {
        onOpenChange(false);
      }
    } catch (err) {
      console.error('[RoomBedServiceModal] Error assigning bed:', err);
      toast.error(err.message || 'Failed to assign bed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open && !activeReceipt} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
          {/* Header */}
          <DialogHeader className="p-4 sm:p-5 border-b border-border bg-card/70 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
                <Building2 className="w-4 h-4 text-primary" />
                Inpatient Bed Admission & Allocation
              </div>
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-medium">
                Live Ward Allocation
              </Badge>
            </div>
            <DialogTitle className="text-lg sm:text-xl font-bold mt-1 text-foreground">
              {activePatient ? `Admit Patient: ${activePatient.full_name}` : 'Admit Patient to Hospital Bed'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Select room, available bed, admission timing, and configure inpatient deposit billing.
            </DialogDescription>
          </DialogHeader>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* Step 1: Patient Selection if not already attached */}
            {!visit && !initialPatient && (
              <div className="border border-border rounded-xl p-3.5 bg-muted/20 space-y-2.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-primary" />
                  1. Select Inpatient for Admission
                </Label>
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search patient by name, phone, or ID..."
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                  <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Choose patient from list..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {filteredPatients.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name} ({p.patient_id}) · {p.phone || 'No phone'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Patient Info Banner if selected */}
            {activePatient && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-foreground block text-sm">{activePatient.full_name}</span>
                    <span className="text-muted-foreground font-mono text-[11px]">{activePatient.patient_id}</span>
                  </div>
                </div>
                {visit?.assigned_doctor && (
                  <span className="text-[11px] text-muted-foreground">
                    Referred by: <strong>Dr. {visit.assigned_doctor}</strong>
                  </span>
                )}
              </div>
            )}

            {/* Step 2: Room and Bed Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-primary" />
                  Select Hospital Room <span className="text-rose-500">*</span>
                </Label>
                <Select value={selectedRoomId} onValueChange={(id) => { setSelectedRoomId(id); setSelectedBedId(''); }}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Choose ward / room..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {activeRooms.map(r => {
                      const bedsInRoom = beds.filter(b => String(b.room_id) === String(r.id));
                      const availCount = bedsInRoom.filter(b => b.status === 'available' || b.status === 'released' || !b.status).length;
                      return (
                        <SelectItem key={r.id} value={String(r.id)} disabled={availCount === 0}>
                          <div className="flex items-center justify-between gap-3 w-full py-0.5 text-xs">
                            <span>Room {r.room_number} ({r.department || r.room_type})</span>
                            <span className="text-muted-foreground font-mono text-[11px]">
                              {r.daily_rate} ETB/d · {availCount} free
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <BedSingle className="w-3.5 h-3.5 text-primary" />
                  Select Available Bed <span className="text-rose-500">*</span>
                </Label>
                <Select 
                  value={selectedBedId} 
                  onValueChange={setSelectedBedId} 
                  disabled={!selectedRoomId || availableBedsForRoom.length === 0}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder={!selectedRoomId ? 'Select room first' : availableBedsForRoom.length === 0 ? 'No beds free' : 'Choose bed...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBedsForRoom.map(b => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        <div className="flex items-center justify-between gap-3 w-full text-xs">
                          <span className="font-semibold">{b.bed_label || `Bed ${b.bed_number}`}</span>
                          <span className="text-primary font-mono text-[11px]">
                            {inpatientBedService.getEffectiveBedPrice(b, selectedRoom)} ETB/day
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Step 3: Admission Timing & Expected Duration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  Admission Date & Time
                </Label>
                <Input
                  type="datetime-local"
                  value={admissionDate}
                  onChange={(e) => setAdmissionDate(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  Expected Stay (Days)
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="120"
                  value={expectedDays}
                  onChange={(e) => setExpectedDays(Math.max(1, parseInt(e.target.value) || 1))}
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            {/* Step 4: Deposit & Billing Configuration */}
            <div className="border border-border rounded-xl p-3.5 bg-card space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <Label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  Admission Deposit & Billing
                </Label>
                <span className="text-xs font-bold font-mono text-primary">
                  Est. Total: {estimatedGross.toLocaleString()} ETB ({expectedDays}d @ {dailyRate} ETB)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setDepositPaymentMode('collect_now')}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    depositPaymentMode === 'collect_now'
                      ? 'bg-primary/10 border-primary text-primary font-semibold'
                      : 'bg-muted/30 border-border text-muted-foreground'
                  }`}
                >
                  <span className="text-xs block">1. Collect Deposit Now</span>
                  <span className="text-[10px] opacity-80">Instant receipt issued</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDepositPaymentMode('pay_later')}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    depositPaymentMode === 'pay_later'
                      ? 'bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-300 font-semibold'
                      : 'bg-muted/30 border-border text-muted-foreground'
                  }`}
                >
                  <span className="text-xs block">2. Pay at Cashier Desk</span>
                  <span className="text-[10px] opacity-80">Pending billing invoice</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDepositPaymentMode('waived')}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    depositPaymentMode === 'waived'
                      ? 'bg-secondary border-primary/40 text-foreground font-semibold'
                      : 'bg-muted/30 border-border text-muted-foreground'
                  }`}
                >
                  <span className="text-xs block">3. Waive Upfront Deposit</span>
                  <span className="text-[10px] opacity-80">Settle at discharge</span>
                </button>
              </div>

              {depositPaymentMode === 'collect_now' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium">Payment Method</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash (Local Birr)</SelectItem>
                        <SelectItem value="telebirr">Telebirr (Mobile)</SelectItem>
                        <SelectItem value="cbe_birr">CBE Birr (Mobile)</SelectItem>
                        <SelectItem value="card">Card (POS)</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="insurance">Insurance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium">Deposit Amount (ETB)</Label>
                    <Input
                      type="number"
                      placeholder={String(estimatedGross)}
                      value={customDepositAmount}
                      onChange={(e) => setCustomDepositAmount(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Step 5: Admission Notes */}
            <div className="space-y-1">
              <Label className="text-xs font-medium">Admission Clinical Notes (optional)</Label>
              <Textarea
                placeholder="e.g. Admitted for IV antibiotic therapy and overnight monitoring..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="text-xs resize-none"
              />
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

            <Button
              type="button"
              size="sm"
              onClick={handleAssignBed}
              disabled={isSubmitting || !activePatient || !selectedRoomId || !selectedBedId}
              className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {isSubmitting ? 'Admitting...' : depositPaymentMode === 'collect_now' ? `Collect ${depositAmount.toLocaleString()} ETB & Admit` : 'Confirm Bed Allocation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Official Receipt Modal if collected upfront */}
      {activeReceipt && (
        <ReceiptModal
          open={Boolean(activeReceipt)}
          onOpenChange={(val) => {
            if (!val) {
              setActiveReceipt(null);
              onOpenChange(false);
            }
          }}
          payment={activeReceipt}
        />
      )}
    </>
  );
}
