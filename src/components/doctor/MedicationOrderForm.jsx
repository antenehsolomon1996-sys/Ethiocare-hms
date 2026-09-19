import { useState } from 'react';
import { ethioCareClient } from '@/api/ethioCareClient';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import StatusBadge from '@/components/common/StatusBadge';
import { Pill, Syringe, Package, ShoppingCart, AlertTriangle, CheckCircle, Clock, CreditCard, Hourglass, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { logAudit } from '@/lib/auditLogger';
import { useQuery } from '@tanstack/react-query';

import { calculateNurseAvailability } from '@/services/staffAvailability.service';
import { notificationService } from '@/services/notification.service';
import { useMemo } from 'react';

const ORDER_TYPE_ICONS = { medicine: Pill, injection: Syringe, iv_treatment: Syringe, medical_supply: Package, other: Package };
const URGENCY_STYLES = {
  stat: 'bg-red-100 text-red-700 border-red-200',
  urgent: 'bg-amber-100 text-amber-700 border-amber-200',
  routine: 'bg-slate-100 text-slate-600 border-slate-200'
};

const defaultForm = {
  order_type: 'injection',
  item_name: '',
  dosage: '',
  frequency: '',
  duration: '',
  quantity: '1',
  unit_price: '',
  instructions: '',
  urgency: 'routine',
  assigned_nurse_id: '',
  assigned_nurse_name: '',
  notes: ''
};

function PaymentStatusBadge({ order, payments }) {
  // Find the payment linked to this order by reference_id
  const payment = payments.find(p => p.reference_id === order.id);

  // Determine effective status: prefer live Payment record, fallback to order field
  const effectiveStatus = payment?.status ?? order.payment_status;

  if (effectiveStatus === 'paid' || order.payment_status === 'paid' || order.payment_status === 'waived') {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs flex items-center gap-1">
        <CheckCircle className="w-3 h-3" />
        {order.payment_status === 'waived' ? 'Waived' : 'Paid'}
      </Badge>
    );
  }
  if (effectiveStatus === 'cancelled' || order.payment_status === 'cancelled') {
    return (
      <Badge className="bg-red-100 text-red-700 border border-red-200 text-xs flex items-center gap-1">
        <Ban className="w-3 h-3" />
        Cancelled
      </Badge>
    );
  }
  // pending / pending_payment
  return (
    <Badge className="bg-amber-100 text-amber-700 border border-amber-200 text-xs flex items-center gap-1">
      <Hourglass className="w-3 h-3" />
      Pending Payment
    </Badge>
  );
}

export default function MedicationOrderForm({ visit, doctor, existingOrders = [] }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);

  // Fetch live payment records for this visit to reflect billing status
  const { data: visitPayments = [] } = useQuery({
    queryKey: ['payments', 'visit', visit?.id],
    queryFn: () => ethioCareClient.entities.Payment.filter({ visit_id: visit.id }),
    enabled: !!visit?.id,
    refetchInterval: 8000
  });

  // Fetch medicines to auto-suggest prices from configured values
  const { data: medicines = [] } = useQuery({
    queryKey: ['medicines'],
    queryFn: () => ethioCareClient.entities.Medicine.list()
  });

  // Fetch staff and tasks to compute live nurse availability & workload
  const { data: staffList = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: () => ethioCareClient.entities.Staff.list()
  });
  const { data: allNurseTasks = [] } = useQuery({
    queryKey: ['nurseTasks'],
    queryFn: () => ethioCareClient.entities.NurseTask.list()
  });
  const { data: allMedOrders = [] } = useQuery({
    queryKey: ['medicationOrders'],
    queryFn: () => ethioCareClient.entities.MedicationOrder.list()
  });

  const nursesWithAvailability = useMemo(() => {
    const rawNurses = staffList.filter(s => s.role === 'nurse');
    const base = rawNurses.length > 0 ? rawNurses : [
      { id: 'stf-4', full_name: 'Sister Tigist Mengistu', role: 'nurse' },
      { id: 'stf-nurse-2', full_name: 'Nurse Hana Bekele', role: 'nurse' }
    ];
    return base.map(n => ({
      ...n,
      availability: calculateNurseAvailability(n, allNurseTasks, allMedOrders)
    }));
  }, [staffList, allNurseTasks, allMedOrders]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleItemNameChange = (name) => {
    set('item_name', name);
    const match = medicines.find(m => m.name?.toLowerCase() === name.toLowerCase());
    if (match && match.unit_price) {
      set('unit_price', match.unit_price.toString());
    }
  };

  const handleSubmit = async () => {
    if (!form.item_name.trim()) {
      toast.error('Item name is required');
      return;
    }
    setLoading(true);
    const qty = parseInt(form.quantity) || 1;
    const unitPrice = parseFloat(form.unit_price) || 0;
    const total = qty * unitPrice;

    try {
      // Step 1: Create the MedicationOrder (the primary order record)
      const order = await ethioCareClient.entities.MedicationOrder.create({
        visit_id: visit.id,
        patient_id: visit.patient_id,
        patient_name: visit.patient_name,
        doctor_name: doctor?.full_name || null,
        doctor_id: doctor?.id || null,
        assigned_nurse_id: form.assigned_nurse_id || null,
        assigned_nurse_name: form.assigned_nurse_name || null,
        order_type: form.order_type,
        item_name: form.item_name,
        dosage: form.dosage,
        frequency: form.frequency,
        duration: form.duration,
        quantity: qty,
        unit_price: unitPrice,
        total_price: total,
        instructions: form.instructions,
        urgency: form.urgency,
        notes: form.notes,
        payment_status: 'pending_payment',
        administration_status: 'awaiting_payment'
      });

      // Step 2: Create linked billing record with full medication details
      // The Order ID is the primary relationship key across Doctor → Billing → Nurse
      await ethioCareClient.entities.Payment.create({
        visit_id: visit.id,
        patient_id: visit.patient_id,
        patient_name: visit.patient_name,
        payment_type: form.order_type === 'medicine' ? 'medicine' : form.order_type === 'injection' || form.order_type === 'iv_treatment' ? 'injection' : 'procedure',
        description: `${form.order_type.replace('_', ' ')}: ${form.item_name}${form.dosage ? ` (${form.dosage})` : ''}`,
        amount: total,
        status: 'pending',
        reference_type: 'medication_order',
        reference_id: order.id,
        doctor_name: doctor?.full_name || null,
        doctor_id: doctor?.id || null,
        medication_order_id: order.id,
        medication_name: form.item_name,
        dosage: form.dosage,
        quantity: qty,
        frequency: form.frequency,
        route: form.order_type,
        order_notes: form.instructions,
        order_status: 'pending_payment'
      });

      if (form.assigned_nurse_id || form.assigned_nurse_name) {
        notificationService.dispatch({
          title: 'New Nurse Task Assigned',
          message: `${form.order_type.replace('_', ' ')}: ${form.item_name} for ${visit.patient_name} assigned to you by Dr. ${doctor?.full_name || 'Attending Doctor'}.`,
          type: 'info',
          module: 'nurse',
          targetRoles: ['nurse'],
          targetUserId: form.assigned_nurse_id,
          targetStaffName: form.assigned_nurse_name,
          link: '/nurse/medication-orders'
        });
      }

      queryClient.invalidateQueries({ queryKey: ['medicationOrders'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      logAudit({
        userName: doctor?.full_name, userRole: 'doctor', action: 'create',
        module: 'MedicationOrder',
        description: `Ordered ${form.order_type.replace('_', ' ')}: ${form.item_name} for ${visit.patient_name}${form.assigned_nurse_name ? ` (assigned to ${form.assigned_nurse_name})` : ''}`,
        recordId: order.id, recordName: visit.patient_name
      });
      toast.success('Order sent to Billing for payment processing');
      setForm(defaultForm);
    } catch (err) {
      toast.error(err?.message || 'Failed to create medication order. Please try again.');
      console.error('[MedicationOrderForm] Error creating order:', err);
    } finally {
      setLoading(false);
    }
  };

  const Icon = ORDER_TYPE_ICONS[form.order_type] || Pill;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            New Medication / Injection / Supply Order
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Order Type</Label>
              <Select value={form.order_type} onValueChange={v => set('order_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="medicine">Medicine (Oral/Topical)</SelectItem>
                  <SelectItem value="injection">Injection (IM/SC/ID)</SelectItem>
                  <SelectItem value="iv_treatment">IV Treatment</SelectItem>
                  <SelectItem value="medical_supply">Medical Supply</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Urgency</Label>
              <Select value={form.urgency} onValueChange={v => set('urgency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="routine">Routine</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="stat">STAT (Immediate)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.urgency === 'stat' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 flex items-center gap-2 text-sm text-red-700 font-medium">
              <AlertTriangle className="w-4 h-4" /> STAT — Will alert billing for immediate processing
            </div>
          )}

          <div>
            <Label>Item Name *</Label>
            <Input
              value={form.item_name}
              onChange={e => handleItemNameChange(e.target.value)}
              list="medicine-suggestions"
              placeholder={
                form.order_type === 'injection' ? 'e.g. Amoxicillin 500mg IM' :
                form.order_type === 'iv_treatment' ? 'e.g. Normal Saline 500ml' :
                form.order_type === 'medical_supply' ? 'e.g. Surgical Gloves (Large)' :
                'e.g. Paracetamol 500mg'
              }
            />
            <datalist id="medicine-suggestions">
              {medicines.map(m => (
                <option key={m.id} value={m.name}>{m.unit_price ? `${m.unit_price} ETB` : ''}</option>
              ))}
            </datalist>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs font-semibold">Assign Specific Nurse</Label>
              <span className="text-[11px] text-muted-foreground">Live Shift Availability</span>
            </div>
            <Select
              value={form.assigned_nurse_name || '__any'}
              onValueChange={val => {
                if (val === '__any') {
                  setForm(f => ({ ...f, assigned_nurse_id: '', assigned_nurse_name: '' }));
                } else {
                  const nurse = nursesWithAvailability.find(n => n.full_name === val);
                  setForm(f => ({
                    ...f,
                    assigned_nurse_id: nurse?.id || '',
                    assigned_nurse_name: nurse?.full_name || val
                  }));
                }
              }}
            >
              <SelectTrigger className="h-10 text-sm">
                <SelectValue placeholder="Any Available Nurse (Ward Pool)" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="__any">Any Available Nurse (Ward Duty Pool)</SelectItem>
                {nursesWithAvailability.map(n => (
                  <SelectItem key={n.id || n.full_name} value={n.full_name}>
                    <div className="flex items-center justify-between gap-3 w-full py-0.5">
                      <span className="font-medium text-foreground">{n.full_name}</span>
                      <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${n.availability?.badgeClass || 'bg-slate-100 text-slate-700'}`}>
                          {n.availability?.statusLabel}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono bg-muted/60 px-1.5 py-0.5 rounded">
                          {n.availability?.totalWorkload} active
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Dosage</Label>
              <Input value={form.dosage} onChange={e => set('dosage', e.target.value)} placeholder="e.g. 500mg" />
            </div>
            <div>
              <Label>Frequency</Label>
              <Input value={form.frequency} onChange={e => set('frequency', e.target.value)} placeholder="e.g. Once / BID / TID" />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <Label>Duration</Label>
              <Input value={form.duration} onChange={e => set('duration', e.target.value)} placeholder="e.g. 5 days" />
            </div>
            <div>
              <Label>Quantity</Label>
              <Input type="number" min="1" value={form.quantity} onChange={e => set('quantity', e.target.value)} />
            </div>
            <div>
              <Label>Unit Price (ETB)</Label>
              <Input type="number" min="0" value={form.unit_price} onChange={e => set('unit_price', e.target.value)} placeholder="0" />
            </div>
          </div>

          <div>
            <Label>Administration Instructions for Nurse</Label>
            <Textarea
              value={form.instructions}
              onChange={e => set('instructions', e.target.value)}
              rows={2}
              placeholder="Specific instructions for the nurse (route, timing, precautions...)"
            />
          </div>

          {form.unit_price && form.quantity && (
            <div className="bg-primary/5 rounded-lg p-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total charge:</span>
              <span className="font-bold text-primary">{(parseFloat(form.unit_price || 0) * parseInt(form.quantity || 1)).toLocaleString()} ETB</span>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-center gap-2 text-xs text-amber-800">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            This order goes to <strong>Billing</strong> first. After payment, it becomes visible to nurses.
          </div>

          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            <ShoppingCart className="w-4 h-4 mr-2" />
            {loading ? 'Submitting...' : 'Submit Order to Billing'}
          </Button>
        </CardContent>
      </Card>

      {existingOrders.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Orders for this Visit ({existingOrders.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {existingOrders.map(o => {
              const OIcon = ORDER_TYPE_ICONS[o.order_type] || Pill;
              return (
                <div key={o.id} className="flex items-center justify-between border rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <OIcon className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{o.item_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{o.order_type?.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-xs ${URGENCY_STYLES[o.urgency]}`}>{o.urgency}</Badge>
                    <div className="flex flex-col items-end gap-1">
                      <PaymentStatusBadge order={o} payments={visitPayments} />
                      {o.administration_status === 'completed' && (
                        <Badge className="bg-blue-100 text-blue-700 border border-blue-200 text-xs flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />Administered
                        </Badge>
                      )}
                      {(o.payment_status === 'paid' || o.payment_status === 'waived') && o.administration_status !== 'completed' && (
                        <Badge className="bg-teal-100 text-teal-700 border border-teal-200 text-xs">At Nurse Room</Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}