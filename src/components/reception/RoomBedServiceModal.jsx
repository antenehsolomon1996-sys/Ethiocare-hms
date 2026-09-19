import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Building2, CheckCircle2, AlertCircle, ShieldCheck, DollarSign, User } from 'lucide-react';
import { toast } from 'sonner';
import { notificationService } from '@/services/notification.service';
import { logAudit } from '@/lib/auditLogger';

export default function RoomBedServiceModal({ open, onOpenChange, visit, onAssigned }) {
  const queryClient = useQueryClient();
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedBedId, setSelectedBedId] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Fetch rooms and beds
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

  // 2. Fetch payments for this visit to verify bed admission fee
  const { data: payments = [] } = useQuery({
    queryKey: ['payments', 'visit', visit?.id],
    queryFn: () => ethioCareClient.entities.Payment.filter({ visit_id: visit.id }),
    enabled: open && !!visit?.id
  });

  const bedPayment = useMemo(() => {
    return payments.find(p => p.payment_type === 'bed' || p.reference_type === 'bed_admission') || null;
  }, [payments]);

  const isBedFeePaid = bedPayment ? (bedPayment.status === 'paid' || bedPayment.status === 'waived') : false;

  // Active available rooms
  const activeRooms = useMemo(() => {
    return rooms.filter(r => r.status === 'available' || r.status === 'open');
  }, [rooms]);

  // Selected room details
  const selectedRoom = useMemo(() => {
    return activeRooms.find(r => String(r.id) === String(selectedRoomId));
  }, [activeRooms, selectedRoomId]);

  // Available beds for selected room (PREVENTS DOUBLE-BOOKING)
  const availableBedsForRoom = useMemo(() => {
    if (!selectedRoomId) return [];
    return beds.filter(b => 
      String(b.room_id) === String(selectedRoomId) && 
      (b.status === 'available' || b.status === 'released')
    );
  }, [beds, selectedRoomId]);

  const selectedBed = useMemo(() => {
    return availableBedsForRoom.find(b => String(b.id) === String(selectedBedId));
  }, [availableBedsForRoom, selectedBedId]);

  const handleMarkPaymentPaid = async () => {
    if (!bedPayment) {
      // Create and mark paid
      try {
        await ethioCareClient.entities.Payment.create({
          visit_id: visit.id,
          patient_id: visit.patient_id,
          patient_name: visit.patient_name,
          payment_type: 'bed',
          description: 'Inpatient Admission Deposit Fee',
          amount: selectedRoom?.daily_rate || 500,
          status: 'paid',
          reference_type: 'bed_admission',
          reference_id: visit.id
        });
        queryClient.invalidateQueries({ queryKey: ['payments'] });
        toast.success('Bed admission fee confirmed as paid');
      } catch (err) {
        toast.error(err.message || 'Failed to record payment');
      }
    } else {
      try {
        await ethioCareClient.entities.Payment.update(bedPayment.id, { status: 'paid' });
        queryClient.invalidateQueries({ queryKey: ['payments'] });
        toast.success('Bed payment updated to paid');
      } catch (err) {
        toast.error(err.message || 'Failed to update payment');
      }
    }
  };

  const handleAssignBed = async () => {
    if (!visit || !selectedRoom || !selectedBed) {
      toast.error('Please select both a room and an available bed');
      return;
    }

    // Double check bed is not already occupied in live data
    if (selectedBed.status === 'occupied') {
      toast.error('This bed was just booked by another staff member. Please select another bed.');
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();

      // 1. Update Bed to occupied
      await ethioCareClient.entities.Bed.update(selectedBed.id, {
        status: 'occupied',
        current_patient_id: visit.patient_id,
        current_patient_name: visit.patient_name,
        current_visit_id: visit.id,
        assigned_at: now
      });

      // 2. Update Visit with bed details
      await ethioCareClient.entities.Visit.update(visit.id, {
        bed_assigned: true,
        bed_status: 'assigned',
        room_number: selectedRoom.room_number,
        bed_number: selectedBed.bed_number,
        assigned_bed_id: selectedBed.id
      });

      // 3. Create BedAssignment history audit
      await ethioCareClient.entities.BedAssignment.create({
        bed_id: selectedBed.id,
        room_id: selectedRoom.id,
        patient_id: visit.patient_id,
        patient_name: visit.patient_name,
        visit_id: visit.id,
        admitted_by: 'Reception Staff',
        admission_date: now,
        daily_rate: selectedRoom.daily_rate || 500,
        status: 'admitted',
        payment_status: isBedFeePaid ? 'paid' : 'pending',
        notes: notes?.trim() || null
      });

      // 4. Log Audit
      logAudit({
        userName: 'Reception Staff',
        userRole: 'receptionist',
        action: 'create',
        module: 'BedAssignment',
        description: `Assigned ${visit.patient_name} to Room ${selectedRoom.room_number}, Bed ${selectedBed.bed_number}`,
        recordId: selectedBed.id,
        recordName: `${selectedRoom.room_number} - ${selectedBed.bed_number}`
      });

      // 5. Targeted Notification to Doctor and Nurses
      notificationService.dispatch({
        title: 'Patient Admitted to Bed',
        message: `${visit.patient_name} admitted to Room ${selectedRoom.room_number} → Bed ${selectedBed.bed_number}. Care tasks and orders active.`,
        type: 'success',
        module: 'patient',
        targetRoles: ['doctor', 'nurse', 'owner'],
        targetUserId: visit.assigned_doctor_id || undefined,
        targetStaffName: visit.assigned_doctor || undefined,
        link: '/nurse/unified-tasks'
      });

      queryClient.invalidateQueries({ queryKey: ['beds'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['bed_assignments'] });

      toast.success(`${visit.patient_name} successfully assigned to Room ${selectedRoom.room_number}, Bed ${selectedBed.bed_number}`);
      if (onAssigned) onAssigned();
      onOpenChange(false);
    } catch (err) {
      console.error('[RoomBedServiceModal] Error assigning bed:', err);
      toast.error(err.message || 'Failed to assign room and bed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Inpatient Room & Bed Assignment
          </DialogTitle>
          <DialogDescription>
            Assign patient <strong>{visit?.patient_name}</strong> to a verified available bed. Prevents double-booking.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Patient Overview */}
          <div className="bg-muted/50 rounded-xl p-3 text-xs grid grid-cols-2 gap-2 border border-border">
            <div>
              <span className="text-muted-foreground block">Patient</span>
              <span className="font-semibold text-foreground text-sm">{visit?.patient_name}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Attending Doctor</span>
              <span className="font-semibold text-foreground text-sm">
                {visit?.assigned_doctor ? `Dr. ${visit.assigned_doctor}` : 'General Duty'}
              </span>
            </div>
          </div>

          {/* Admission Payment Verification */}
          <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
            isBedFeePaid 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300' 
              : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
          }`}>
            <div className="flex items-center gap-2.5">
              {isBedFeePaid ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              )}
              <div>
                <span className="font-semibold text-xs block">
                  {isBedFeePaid ? 'Admission Fee Paid & Verified' : 'Admission Fee Pending at Billing'}
                </span>
                <span className="text-[11px] opacity-80">
                  {isBedFeePaid 
                    ? 'Payment requirements satisfied for bed allocation' 
                    : `Admission deposit required (${bedPayment?.amount || 500} ETB)`}
                </span>
              </div>
            </div>

            {!isBedFeePaid && (
              <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" onClick={handleMarkPaymentPaid}>
                <DollarSign className="w-3.5 h-3.5 mr-1" />
                Mark Paid
              </Button>
            )}
          </div>

          {/* Room Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">1. Select Hospital Room</Label>
            <Select value={selectedRoomId} onValueChange={(id) => { setSelectedRoomId(id); setSelectedBedId(''); }}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Choose room (Ward, Semi-Private, ICU...)" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {activeRooms.map(r => {
                  const bedsInRoom = beds.filter(b => String(b.room_id) === String(r.id));
                  const availCount = bedsInRoom.filter(b => b.status === 'available' || b.status === 'released').length;
                  return (
                    <SelectItem key={r.id} value={String(r.id)} disabled={availCount === 0}>
                      <div className="flex items-center justify-between gap-3 w-full py-0.5">
                        <span>Room {r.room_number} ({r.department || r.room_type} · {r.floor || 'Floor 1'})</span>
                        <div className="flex items-center gap-1.5 ml-auto">
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${availCount > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {availCount} {availCount === 1 ? 'bed' : 'beds'} free
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {r.daily_rate} ETB/day
                          </span>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Bed Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">2. Select Available Bed (Double-Booking Protected)</Label>
            <Select 
              value={selectedBedId} 
              onValueChange={setSelectedBedId} 
              disabled={!selectedRoomId || availableBedsForRoom.length === 0}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder={!selectedRoomId ? 'Select a room first' : availableBedsForRoom.length === 0 ? 'No beds available in this room' : 'Choose bed...'} />
              </SelectTrigger>
              <SelectContent>
                {availableBedsForRoom.map(b => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    <div className="flex items-center justify-between gap-3 w-full">
                      <span className="font-semibold">{b.bed_label || `Bed ${b.bed_number}`}</span>
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                        Available
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Admission Notes (optional)</Label>
            <Textarea
              rows={2}
              placeholder="e.g. Admitted for overnight observation and vital signs."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleAssignBed} disabled={isSubmitting || !selectedRoomId || !selectedBedId}>
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            {isSubmitting ? 'Assigning Bed...' : 'Confirm Bed Assignment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
