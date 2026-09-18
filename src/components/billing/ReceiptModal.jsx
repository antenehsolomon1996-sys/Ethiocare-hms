import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer, CheckCircle2, Building2, Calendar, User, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import { useHospitalBranding } from '@/hooks/useHospitalBranding';

export default function ReceiptModal({ open, onOpenChange, payment }) {
  const { hospital } = useHospitalBranding();
  if (!payment) return null;

  const handlePrint = () => {
    window.print();
  };

  const receiptDate = payment.paid_date
    ? format(new Date(payment.paid_date), 'MMMM d, yyyy')
    : payment.created_at
    ? format(new Date(payment.created_at), 'MMMM d, yyyy')
    : format(new Date(), 'MMMM d, yyyy');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 bg-white dark:bg-slate-900 border shadow-2xl rounded-2xl print:p-0 print:border-none print:shadow-none">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold overflow-hidden">
                {hospital?.hospital_logo ? (
                  <img src={hospital.hospital_logo} alt="Logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <Building2 className="w-5 h-5" />
                )}
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold">
                  {hospital?.hospital_name || 'EthioCare Hospital'}
                </DialogTitle>
                <p className="text-[11px] text-muted-foreground">
                  {hospital?.address ? `${hospital.address}, ` : ''}{hospital?.city || 'Addis Ababa'} · Tel: {hospital?.phone || '+251 11 612 3456'}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> PAID
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-3 print:py-1 text-sm">
          <div className="flex justify-between items-center py-2 border-b border-dashed">
            <span className="text-muted-foreground">Receipt Number:</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
              {payment.receipt_number || `RCP-${payment.id?.slice(0, 8).toUpperCase()}`}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 py-1">
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="w-3 h-3" /> Patient Name
              </p>
              <p className="font-semibold text-slate-900 dark:text-white mt-0.5">{payment.patient_name || 'Walk-in Patient'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Date
              </p>
              <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">{receiptDate}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 py-1">
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <CreditCard className="w-3 h-3" /> Payment Method
              </p>
              <p className="font-medium capitalize text-slate-800 dark:text-slate-200 mt-0.5">
                {payment.payment_method ? payment.payment_method.replace(/_/g, ' ') : 'Cash'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cashier / Staff</p>
              <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                {payment.cashier_name || 'Hospital Cashier'}
              </p>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 border space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              <span>Item / Description</span>
              <span>Amount</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-slate-200 dark:border-slate-700">
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-200">
                  {payment.description || payment.payment_type?.replace(/_/g, ' ').toUpperCase() || 'Hospital Service'}
                </p>
                <p className="text-xs text-muted-foreground capitalize">Category: {payment.payment_type?.replace(/_/g, ' ') || 'General'}</p>
              </div>
              <p className="font-semibold text-slate-900 dark:text-white">
                {payment.amount?.toLocaleString()} ETB
              </p>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 text-base font-bold">
            <span>Total Paid</span>
            <span className="text-xl text-primary font-extrabold">
              {payment.amount?.toLocaleString()} ETB
            </span>
          </div>
        </div>

        <div className="flex gap-2 pt-3 border-t print:hidden">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button className="flex-1" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" /> Print Receipt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
