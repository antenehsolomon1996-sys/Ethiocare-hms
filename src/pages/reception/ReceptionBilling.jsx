import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CreditCard, Search, Receipt, CheckCircle2, AlertCircle, Clock,
  User, DollarSign, Pill, FlaskConical, Stethoscope, Printer, FileText, Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import ReceiptModal from '@/components/billing/ReceiptModal';
import MedicationOrdersBilling from '@/pages/billing/MedicationOrdersBilling';
import PaymentsList from '@/pages/billing/PaymentsList';
import ReceiptsList from '@/pages/billing/ReceiptsList';
import { notificationService } from '@/services/notification.service';

export default function ReceptionBilling() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('checkout');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState(null);

  // Queries for live Supabase data
  const { data: patients = [], isLoading: isLoadingPatients } = useQuery({
    queryKey: ['patients'],
    queryFn: () => base44.entities.Patient.list('-created_date', 300),
  });

  const { data: visits = [] } = useQuery({
    queryKey: ['visits'],
    queryFn: () => base44.entities.Visit.list('-created_date', 300),
    refetchInterval: 8000,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['payments'],
    queryFn: () => base44.entities.Payment.list('-created_date', 300),
    refetchInterval: 8000,
  });

  const { data: medOrders = [] } = useQuery({
    queryKey: ['medicationOrders'],
    queryFn: () => base44.entities.MedicationOrder.list('-created_date', 300),
    refetchInterval: 8000,
  });

  const { data: labOrders = [] } = useQuery({
    queryKey: ['labOrders'],
    queryFn: () => base44.entities.LabOrder.list('-created_date', 300),
    refetchInterval: 8000,
  });

  // Selected patient
  const selectedPatient = useMemo(() => {
    return patients.find(p => p.id === selectedPatientId) || null;
  }, [patients, selectedPatientId]);

  // Filtered patient list for autocomplete
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return patients.filter(p =>
      p.full_name?.toLowerCase().includes(term) ||
      p.patient_id?.toLowerCase().includes(term) ||
      p.phone?.toLowerCase().includes(term)
    ).slice(0, 8);
  }, [patients, searchTerm]);

  // Current active visit for this patient
  const patientVisit = useMemo(() => {
    if (!selectedPatient) return null;
    const today = format(new Date(), 'yyyy-MM-dd');
    return visits.find(v => v.patient_id === selectedPatient.id && v.visit_date === today) ||
           visits.find(v => v.patient_id === selectedPatient.id) || null;
  }, [visits, selectedPatient]);

  // Outstanding billable items for this patient
  const pendingPayments = useMemo(() => {
    if (!selectedPatient) return [];
    return payments.filter(p => p.patient_id === selectedPatient.id && p.status === 'pending');
  }, [payments, selectedPatient]);

  const pendingMedOrders = useMemo(() => {
    if (!selectedPatient) return [];
    return medOrders.filter(o => o.patient_id === selectedPatient.id && o.payment_status === 'pending_payment');
  }, [medOrders, selectedPatient]);

  const pendingLabOrders = useMemo(() => {
    if (!selectedPatient) return [];
    return labOrders.filter(o => o.patient_id === selectedPatient.id && o.payment_status === 'pending');
  }, [labOrders, selectedPatient]);

  // Patient payment history
  const patientPaymentHistory = useMemo(() => {
    if (!selectedPatient) return [];
    return payments.filter(p => p.patient_id === selectedPatient.id && p.status === 'paid');
  }, [payments, selectedPatient]);

  // Total outstanding calculation
  const totalDue = useMemo(() => {
    const paySum = pendingPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const medSum = pendingMedOrders.reduce((acc, o) => acc + (Number(o.total_price) || Number(o.unit_price) || 0), 0);
    const labSum = pendingLabOrders.reduce((acc, l) => acc + (Number(l.price) || 0), 0);
    return paySum + medSum + labSum;
  }, [pendingPayments, pendingMedOrders, pendingLabOrders]);

  // Process checkout payment
  const handleProcessPatientPayment = async () => {
    if (!selectedPatient) return;
    if (totalDue <= 0 && pendingPayments.length === 0 && pendingMedOrders.length === 0 && pendingLabOrders.length === 0) {
      toast.info('No outstanding fees for this patient');
      return;
    }

    setIsProcessing(true);
    try {
      const receiptNum = `RCP-REC-${format(new Date(), 'yyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;
      const paidDate = format(new Date(), 'yyyy-MM-dd');
      const cashier = user?.full_name || 'Reception Staff';
      let primaryPaymentRecord = null;

      // 1. Mark existing pending payments as paid
      for (const p of pendingPayments) {
        const updated = await base44.entities.Payment.update(p.id, {
          status: 'paid',
          payment_method: paymentMethod,
          receipt_number: receiptNum,
          cashier_name: cashier,
          paid_date: paidDate,
        });
        if (!primaryPaymentRecord) primaryPaymentRecord = updated;

        if (p.reference_type === 'registration' || p.payment_type === 'registration') {
          notificationService.dispatch({
            title: 'Patient Ready for Doctor',
            message: `Registration fee paid for ${selectedPatient.full_name}. Consultation queue is now active.`,
            type: 'success',
            module: 'queue',
            targetRoles: ['doctor', 'owner'],
            link: '/doctor/queue'
          });
        }
      }

      // 2. Process pending medication orders
      for (const mo of pendingMedOrders) {
        const orderAmount = Number(mo.total_price) || Number(mo.unit_price) || 0;
        const newPay = await base44.entities.Payment.create({
          visit_id: mo.visit_id || patientVisit?.id || null,
          patient_id: selectedPatient.id,
          patient_name: selectedPatient.full_name,
          payment_type: mo.order_type === 'medicine' ? 'medicine' : 'procedure',
          description: `Medication: ${mo.item_name} (${mo.dosage || '1 dose'})`,
          amount: orderAmount,
          status: 'paid',
          payment_method: paymentMethod,
          receipt_number: receiptNum,
          cashier_name: cashier,
          paid_date: paidDate,
          reference_type: 'medication_order',
          reference_id: mo.id,
          doctor_name: mo.doctor_name || null,
          doctor_id: mo.doctor_id || null,
          medication_order_id: mo.id,
          medication_name: mo.item_name,
          dosage: mo.dosage || null,
          quantity: mo.quantity || 1,
          order_status: 'paid'
        });
        if (!primaryPaymentRecord) primaryPaymentRecord = newPay;

        try {
          await base44.entities.MedicationOrder.update(mo.id, {
            payment_status: 'paid',
            administration_status: 'pending',
            payment_id: newPay.id,
            receipt_number: receiptNum,
            paid_by: cashier,
            paid_date: paidDate,
          });
        } catch (moErr) {
          console.warn('[ReceptionBilling] Non-critical medication order status notice:', moErr);
        }

        // Try dispatching NurseTask
        try {
          if (mo.visit_id) {
            const isImmediate = mo.urgency === 'stat' || mo.urgency === 'urgent' || mo.order_type === 'injection';
            await base44.entities.NurseTask.create({
              visit_id: mo.visit_id,
              patient_id: selectedPatient.id,
              patient_name: selectedPatient.full_name,
              task_type: mo.order_type === 'iv_treatment' ? 'iv_treatment' : mo.order_type === 'injection' ? 'injection' : 'procedure',
              description: `${isImmediate ? '[IMMEDIATE] ' : ''}Medication: ${mo.item_name}${mo.dosage ? ` — ${mo.dosage}` : ''}`,
              instructions: mo.instructions || `Administer ${mo.item_name}`,
              doctor_name: mo.doctor_name || '',
              status: 'pending'
            });
          }
        } catch (e) {
          console.warn('[ReceptionBilling] Non-critical nurse task notice:', e);
        }

        notificationService.dispatch({
          title: 'New Paid Nursing Order Ready',
          message: `Payment completed for ${selectedPatient.full_name}: ${mo.item_name}. Ready for administration.`,
          type: 'info',
          module: 'nurse',
          targetRoles: ['nurse', 'owner'],
          link: '/nurse/medication-orders'
        });
      }

      // 3. Process pending lab orders
      for (const lo of pendingLabOrders) {
        const labPrice = Number(lo.price) || 0;
        const newLabPay = await base44.entities.Payment.create({
          visit_id: lo.visit_id || patientVisit?.id || null,
          patient_id: selectedPatient.id,
          patient_name: selectedPatient.full_name,
          payment_type: 'laboratory',
          description: `Lab Test: ${lo.test_name || lo.test_type}`,
          amount: labPrice,
          status: 'paid',
          payment_method: paymentMethod,
          receipt_number: receiptNum,
          cashier_name: cashier,
          paid_date: paidDate,
          reference_type: 'lab_order',
          reference_id: lo.id,
          doctor_name: lo.doctor_name || null,
          doctor_id: lo.doctor_id || null,
        });
        if (!primaryPaymentRecord) primaryPaymentRecord = newLabPay;

        try {
          await base44.entities.LabOrder.update(lo.id, {
            payment_status: 'paid',
            test_status: 'pending'
          });
        } catch (e) {
          console.warn('[ReceptionBilling] Lab order update notice:', e);
        }

        notificationService.dispatch({
          title: 'New Paid Lab Order Ready',
          message: `Lab payment completed for ${selectedPatient.full_name} (${lo.test_name || lo.test_type}). Ready for sample processing.`,
          type: 'info',
          module: 'lab',
          targetRoles: ['lab_technician', 'owner'],
          link: '/lab/orders'
        });
      }

      // 4. Update visit billing status if applicable
      if (patientVisit?.id) {
        try {
          await base44.entities.Visit.update(patientVisit.id, {
            billing_completed: true,
            registration_fee_paid: true,
            status: 'waiting'
          });
        } catch (visErr) {
          console.warn('[ReceptionBilling] Visit billing status update notice:', visErr);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['medicationOrders'] });
      queryClient.invalidateQueries({ queryKey: ['labOrders'] });
      queryClient.invalidateQueries({ queryKey: ['visits'] });

      toast.success(`Payment successfully recorded! Receipt: ${receiptNum}`);
      setActiveReceipt(primaryPaymentRecord || {
        receipt_number: receiptNum,
        patient_name: selectedPatient.full_name,
        payment_type: 'Hospital Services',
        description: `Settlement for ${selectedPatient.full_name}`,
        amount: totalDue,
        payment_method: paymentMethod,
        cashier_name: cashier,
        paid_date: paidDate
      });
    } catch (err) {
      console.error('[ReceptionBilling] Error processing patient checkout:', err);
      toast.error(err.message || 'Failed to record payment');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-primary" />
            Reception Billing & Cashier Desk
          </h1>
          <p className="text-sm text-muted-foreground">
            Integrated billing, patient checkout, medication order collections, and receipts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 px-3 py-1">
            <Sparkles className="w-3.5 h-3.5 mr-1" /> Live Sync Active
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-4 max-w-2xl bg-muted/60">
          <TabsTrigger value="checkout" className="flex items-center gap-2">
            <User className="w-4 h-4" /> Patient Checkout
          </TabsTrigger>
          <TabsTrigger value="medications" className="flex items-center gap-2">
            <Pill className="w-4 h-4" /> Medication Orders
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> All Payments
          </TabsTrigger>
          <TabsTrigger value="receipts" className="flex items-center gap-2">
            <Receipt className="w-4 h-4" /> Receipts
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Patient Checkout & Billing Workflow */}
        <TabsContent value="checkout" className="space-y-6">
          {/* Patient Search & Selection Card */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="w-4 h-4 text-primary" />
                Step 1: Select Patient for Billing
              </CardTitle>
              <CardDescription>
                Search by patient name, phone number, or patient ID (e.g. PT-260916-1294)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search patient name or phone..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                  {searchResults.length > 0 && !selectedPatient && (
                    <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-popover border rounded-lg shadow-xl overflow-hidden max-h-56 overflow-y-auto">
                      {searchResults.map(p => (
                        <div
                          key={p.id}
                          className="p-2.5 hover:bg-muted/80 cursor-pointer text-sm border-b last:border-none flex justify-between items-center"
                          onClick={() => {
                            setSelectedPatientId(p.id);
                            setSearchTerm('');
                          }}
                        >
                          <div>
                            <p className="font-semibold">{p.full_name}</p>
                            <p className="text-xs text-muted-foreground">{p.patient_id} · {p.phone || 'No phone'}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">{p.gender || 'Patient'}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                  <SelectTrigger className="w-full sm:w-72">
                    <SelectValue placeholder="Or select from registered list..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {patients.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name} ({p.patient_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Selected Patient Banner */}
              {selectedPatient && (
                <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900 dark:text-white">{selectedPatient.full_name}</p>
                        <Badge variant="secondary" className="font-mono text-xs">{selectedPatient.patient_id}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {selectedPatient.gender} · Age: {selectedPatient.age || 'N/A'} · Phone: {selectedPatient.phone || 'N/A'}
                      </p>
                    </div>
                  </div>
                  {patientVisit && (
                    <div className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-lg border text-xs">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>Today's Visit: Queue #{patientVisit.queue_number || 1} ({patientVisit.status})</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Billable Items Section */}
          {selectedPatient && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Outstanding Items Breakdown */}
              <div className="lg:col-span-2 space-y-4">
                <Card className="border shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-primary" />
                        Outstanding Billable Items
                      </span>
                      <Badge variant={totalDue > 0 ? "destructive" : "outline"}>
                        {totalDue > 0 ? `${totalDue.toLocaleString()} ETB Due` : 'Fully Paid'}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* 1. Pending Registration / General Fees */}
                    {pendingPayments.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5" /> Registration & General Fees
                        </p>
                        {pendingPayments.map(p => (
                          <div key={p.id} className="p-3 rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 flex justify-between items-center">
                            <div>
                              <p className="text-sm font-medium text-slate-900 dark:text-white">{p.description || 'Registration Fee'}</p>
                              <p className="text-xs text-muted-foreground capitalize">Type: {p.payment_type?.replace(/_/g, ' ')}</p>
                            </div>
                            <span className="font-bold text-slate-900 dark:text-white">{p.amount?.toLocaleString()} ETB</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 2. Pending Doctor Medication Orders */}
                    {pendingMedOrders.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Pill className="w-3.5 h-3.5" /> Medication & Injection Orders (Doctor Prescribed)
                        </p>
                        {pendingMedOrders.map(mo => (
                          <div key={mo.id} className="p-3 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900 flex justify-between items-center">
                            <div>
                              <p className="text-sm font-medium text-slate-900 dark:text-white">
                                {mo.item_name} {mo.dosage && `(${mo.dosage})`}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Qty: {mo.quantity || 1} · {mo.order_type?.replace(/_/g, ' ')} {mo.doctor_name && `· Dr. ${mo.doctor_name}`}
                              </p>
                            </div>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {(mo.total_price || mo.unit_price || 0).toLocaleString()} ETB
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 3. Pending Lab Orders */}
                    {pendingLabOrders.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <FlaskConical className="w-3.5 h-3.5" /> Laboratory Test Orders
                        </p>
                        {pendingLabOrders.map(lo => (
                          <div key={lo.id} className="p-3 rounded-lg border bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900 flex justify-between items-center">
                            <div>
                              <p className="text-sm font-medium text-slate-900 dark:text-white">{lo.test_name || lo.test_type}</p>
                              <p className="text-xs text-muted-foreground">{lo.doctor_name && `Ordered by Dr. ${lo.doctor_name}`}</p>
                            </div>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {(lo.price || 0).toLocaleString()} ETB
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Empty State */}
                    {pendingPayments.length === 0 && pendingMedOrders.length === 0 && pendingLabOrders.length === 0 && (
                      <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                        <p className="font-semibold text-sm">No Pending Balances</p>
                        <p className="text-xs text-muted-foreground">This patient has settled all current orders and fees.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Patient Payment History */}
                <Card className="border shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-muted-foreground" />
                      Payment History for {selectedPatient.full_name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {patientPaymentHistory.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic py-2">No prior payments recorded for this patient.</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {patientPaymentHistory.map(ph => (
                          <div key={ph.id} className="p-2.5 rounded-lg border bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between text-xs">
                            <div>
                              <span className="font-medium text-slate-800 dark:text-slate-200">{ph.description || ph.payment_type}</span>
                              <p className="text-[11px] text-muted-foreground font-mono">{ph.receipt_number || 'RCP-PAID'} · {ph.paid_date || 'Today'}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-emerald-600">{ph.amount?.toLocaleString()} ETB</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-[11px]"
                                onClick={() => setActiveReceipt(ph)}
                              >
                                <Printer className="w-3 h-3 mr-1" /> View
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Checkout & Payment Action Card */}
              <div className="space-y-4">
                <Card className="border shadow-md bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950">
                  <CardHeader className="pb-3 border-b">
                    <CardTitle className="text-base font-bold">Payment Summary</CardTitle>
                    <CardDescription>Select payment method and issue receipt</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    <div className="bg-primary/5 dark:bg-primary/10 rounded-xl p-4 border border-primary/20 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Outstanding Items:</span>
                        <span className="font-semibold">{pendingPayments.length + pendingMedOrders.length + pendingLabOrders.length}</span>
                      </div>
                      <div className="flex justify-between items-baseline pt-2 border-t border-primary/20">
                        <span className="font-bold text-sm">Total Due:</span>
                        <span className="text-2xl font-extrabold text-primary">
                          {totalDue.toLocaleString()} ETB
                        </span>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold">Payment Method</Label>
                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash (Local Birr)</SelectItem>
                          <SelectItem value="mobile_banking">Telebirr / CBE Birr (Mobile)</SelectItem>
                          <SelectItem value="card">Debit / Credit Card</SelectItem>
                          <SelectItem value="insurance">Health Insurance Provider</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="text-xs text-muted-foreground bg-muted/60 p-3 rounded-lg flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>Recording payment will automatically release medication orders to the Nurse room and mark lab tests as ready.</span>
                    </div>

                    <Button
                      className="w-full font-bold shadow-md"
                      size="lg"
                      disabled={totalDue <= 0 || isProcessing}
                      onClick={handleProcessPatientPayment}
                    >
                      <Receipt className="w-4 h-4 mr-2" />
                      {isProcessing ? 'Recording Payment...' : `Collect ${totalDue.toLocaleString()} ETB & Issue Receipt`}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        {/* TAB 2: Medication Orders (Live Supabase View) */}
        <TabsContent value="medications">
          <MedicationOrdersBilling />
        </TabsContent>

        {/* TAB 3: All Payments List (Live Supabase View) */}
        <TabsContent value="payments">
          <PaymentsList />
        </TabsContent>

        {/* TAB 4: Receipts (Live Supabase View) */}
        <TabsContent value="receipts">
          <ReceiptsList />
        </TabsContent>
      </Tabs>

      {/* Official Receipt Modal */}
      <ReceiptModal
        open={!!activeReceipt}
        onOpenChange={(open) => !open && setActiveReceipt(null)}
        payment={activeReceipt}
      />
    </div>
  );
}
