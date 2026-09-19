import React, { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import { inpatientBedService } from '@/services/inpatientBed.service';
import { useAuth } from '@/lib/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  Building2, BedSingle, Calendar, Clock, DollarSign, 
  Receipt, CheckCircle2, AlertCircle, Printer, LogOut, ShieldCheck
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { toast } from 'sonner';
import ReceiptModal from '@/components/billing/ReceiptModal';

export default function InpatientDischargeModal({ 
  open, 
  onOpenChange, 
  bed, 
  room, 
  activeAssignment,
  onDischarged 
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [dischargeDate, setDischargeDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [isWaiveMode, setIsWaiveMode] = useState(false);
  const [waiverReason, setWaiverReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedReceipt, setGeneratedReceipt] = useState(null);

  // Initialize discharge date when opened
  useEffect(() => {
    if (open) {
      setDischargeDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
      setIsWaiveMode(false);
      setWaiverReason('');
      setNotes('');
      setGeneratedReceipt(null);
    }
  }, [open, bed]);

  const admissionDateStr = activeAssignment?.admission_date || bed?.assigned_at || new Date().toISOString();
  const dailyRate = inpatientBedService.getEffectiveBedPrice(bed, room);
  const depositPaid = Number(activeAssignment?.paid_amount) || 0;

  // Calculate stay breakdown
  const staySummary = useMemo(() => {
    if (!bed) return null;
    return inpatientBedService.calculateStaySummary(
      admissionDateStr,
      dischargeDate,
      dailyRate,
      depositPaid
    );
  }, [bed, admissionDateStr, dischargeDate, dailyRate, depositPaid]);

  const handleDischarge = async (actionType = 'pay') => {
    if (!bed) return;
    setIsSubmitting(true);

    try {
      const staffIdentifier = user?.full_name || 'Reception Staff';
      const isWaiving = actionType === 'waive' || isWaiveMode;

      const result = await inpatientBedService.dischargePatient({
        bed_id: bed.id,
        assignment_id: activeAssignment?.id || null,
        patient_id: bed.current_patient_id || activeAssignment?.patient_id,
        patient_name: bed.current_patient_name || activeAssignment?.patient_name,
        visit_id: bed.current_visit_id || activeAssignment?.visit_id,
        discharge_date: new Date(dischargeDate).toISOString(),
        daily_rate: dailyRate,
        gross_charge: staySummary.grossCharge,
        deposit_paid: depositPaid,
        remaining_balance: staySummary.remainingBalance,
        payment_method: paymentMethod,
        is_balance_paid: !isWaiving && staySummary.remainingBalance > 0,
        is_balance_waived: isWaiving,
        waiver_reason: waiverReason?.trim() || 'Authorized Discharge Waiver',
        notes: notes?.trim() || null
      }, staffIdentifier);

      queryClient.invalidateQueries({ queryKey: ['beds'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['bed_assignments'] });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['financialSummary'] });

      toast.success(`${bed.current_patient_name || 'Patient'} successfully discharged! Bed is now available.`);

      if (result.finalPayment || result.receiptNumber) {
        setGeneratedReceipt(result.finalPayment || {
          receipt_number: result.receiptNumber,
          patient_name: bed.current_patient_name || activeAssignment?.patient_name,
          payment_type: 'bed',
          description: `Inpatient Final Stay Settlement — Bed ${bed.bed_label || bed.bed_number}`,
          amount: staySummary.remainingBalance,
          payment_method: paymentMethod,
          cashier_name: staffIdentifier,
          paid_date: format(new Date(), 'yyyy-MM-dd')
        });
      }

      if (onDischarged) {
        onDischarged(result);
      }

      if (!result.finalPayment && !result.receiptNumber) {
        onOpenChange(false);
      }
    } catch (err) {
      console.error('[InpatientDischargeModal] Discharge error:', err);
      toast.error(err.message || 'Failed to complete inpatient discharge');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!bed) return null;

  return (
    <>
      <Dialog open={open && !generatedReceipt} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
          {/* Header */}
          <DialogHeader className="p-4 sm:p-5 border-b border-border bg-card/70 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
                <LogOut className="w-4 h-4 text-primary" />
                Inpatient Discharge & Financial Settlement
              </div>
              <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30 font-medium">
                Active Occupant
              </Badge>
            </div>
            <DialogTitle className="text-lg sm:text-xl font-bold mt-1 text-foreground">
              Discharge Patient: {bed.current_patient_name || 'Inpatient'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Room {room?.room_number || 'Ward'} · Bed {bed.bed_label || bed.bed_number}.
              Reconcile stay duration, calculate final accumulated bed charge, collect balance, and release bed.
            </DialogDescription>
          </DialogHeader>

          {/* Form Body with Scrollable Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* Stay Timeline & Duration Card */}
            <div className="bg-muted/30 border border-border rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  1. Stay Duration & Timing
                </span>
                <span className="text-xs font-mono font-bold text-primary">
                  Rate: {dailyRate.toLocaleString()} ETB/day
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Admission Date & Time</Label>
                  <p className="font-semibold text-foreground mt-0.5 font-mono">
                    {format(parseISO(admissionDateStr), 'MMM d, yyyy · hh:mm a')}
                  </p>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="disch-date" className="text-[11px] font-semibold text-foreground">
                    Discharge Date & Time
                  </Label>
                  <Input
                    id="disch-date"
                    type="datetime-local"
                    value={dischargeDate}
                    onChange={(e) => setDischargeDate(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Total Inpatient Duration:</span>
                <span className="font-bold text-foreground bg-primary/10 px-2 py-0.5 rounded font-mono">
                  {staySummary?.billableDays === 1 && staySummary?.daysStayed === 0
                    ? 'Same-Day Stay (1 day billed)'
                    : `${staySummary?.billableDays} Day${staySummary?.billableDays > 1 ? 's' : ''} (${staySummary?.daysStayed} full 24h block${staySummary?.daysStayed > 1 ? 's' : ''})`}
                </span>
              </div>
            </div>

            {/* Financial Reconciliation Breakdown */}
            <div className="border border-border rounded-xl p-4 bg-card space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5 pb-2 border-b border-border/60">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                2. Financial Reconciliation & Settlement
              </span>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Gross Bed Charges ({staySummary?.billableDays} days × {dailyRate} ETB):</span>
                  <span className="font-semibold text-foreground font-mono">
                    {staySummary?.grossCharge.toLocaleString()} ETB
                  </span>
                </div>

                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Admission Deposit / Pre-Paid Amount:</span>
                  <span className="font-semibold text-emerald-600 font-mono">
                    - {depositPaid.toLocaleString()} ETB
                  </span>
                </div>

                <div className="flex justify-between items-baseline pt-2 border-t border-border font-bold text-sm">
                  <span className="text-foreground">Net Remaining Balance:</span>
                  <span className={`text-xl font-extrabold font-mono ${
                    staySummary?.remainingBalance > 0 ? 'text-primary' : 'text-emerald-600'
                  }`}>
                    {staySummary?.remainingBalance.toLocaleString()} ETB
                  </span>
                </div>
              </div>

              {staySummary?.remainingBalance === 0 && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2.5 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>Bed fee is fully settled. Patient is cleared for discharge.</span>
                </div>
              )}
            </div>

            {/* Payment Method or Waiver Mode (when remaining balance > 0) */}
            {staySummary?.remainingBalance > 0 && (
              <div className="border border-border rounded-xl p-3.5 bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">
                    {isWaiveMode ? 'Waiver Authorization' : 'Payment Method for Balance Settlement'}
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={() => setIsWaiveMode(!isWaiveMode)}
                  >
                    {isWaiveMode ? '← Switch to Payment Collection' : 'Request Fee Waiver →'}
                  </Button>
                </div>

                {!isWaiveMode ? (
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash (Local Birr)</SelectItem>
                      <SelectItem value="telebirr">Telebirr (Mobile Payment)</SelectItem>
                      <SelectItem value="cbe_birr">CBE Birr (Mobile Payment)</SelectItem>
                      <SelectItem value="card">Debit / Credit Card (POS)</SelectItem>
                      <SelectItem value="bank_transfer">Direct Bank Transfer</SelectItem>
                      <SelectItem value="insurance">Health Insurance Covered</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="space-y-2">
                    <Input
                      placeholder="Reason for waiver / Authorizing medical director..."
                      value={waiverReason}
                      onChange={(e) => setWaiverReason(e.target.value)}
                      className="h-8 text-xs"
                      required
                    />
                    <p className="text-[11px] text-amber-700 dark:text-amber-400">
                      Waiver will be permanently recorded in audit logs and financial reports.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Optional Notes */}
            <div className="space-y-1">
              <Label htmlFor="disch-notes" className="text-xs font-medium">
                Discharge Notes / Comments (optional)
              </Label>
              <Textarea
                id="disch-notes"
                placeholder="e.g. Discharged in stable condition with outpatient prescription."
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

            {staySummary?.remainingBalance > 0 && !isWaiveMode ? (
              <Button
                type="button"
                size="sm"
                onClick={() => handleDischarge('pay')}
                disabled={isSubmitting}
                className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Receipt className="w-3.5 h-3.5" />
                {isSubmitting ? 'Processing Discharge...' : `Collect ${staySummary.remainingBalance.toLocaleString()} ETB & Discharge`}
              </Button>
            ) : staySummary?.remainingBalance > 0 && isWaiveMode ? (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => handleDischarge('waive')}
                disabled={isSubmitting || !waiverReason.trim()}
                className="gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                {isSubmitting ? 'Processing Waiver...' : 'Waive Balance & Complete Discharge'}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => handleDischarge('pay')}
                disabled={isSubmitting}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {isSubmitting ? 'Discharging...' : 'Complete Discharge & Release Bed'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Official Settlement Receipt Modal */}
      {generatedReceipt && (
        <ReceiptModal
          open={Boolean(generatedReceipt)}
          onOpenChange={(val) => {
            if (!val) {
              setGeneratedReceipt(null);
              onOpenChange(false);
            }
          }}
          payment={generatedReceipt}
        />
      )}
    </>
  );
}
