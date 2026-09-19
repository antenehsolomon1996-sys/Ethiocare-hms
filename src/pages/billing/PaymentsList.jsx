import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import StatCard from '@/components/common/StatCard';
import StatusBadge from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isToday, isYesterday, isThisWeek, isThisMonth, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { logAudit } from '@/lib/auditLogger';
import {
  DollarSign,
  CheckCircle,
  Clock,
  Receipt,
  Plus,
  Printer,
  Search,
  RefreshCw,
  Eye,
  X,
  CreditCard,
  User,
  Calendar,
  FileText,
  AlertTriangle,
  Building,
  Smartphone
} from 'lucide-react';
import ReceiptModal from '@/components/billing/ReceiptModal';
import { hospitalBillingService } from '@/services/hospitalBilling.service';

const METHOD_LABELS = {
  cash: 'Cash',
  telebirr: 'Telebirr',
  cbe_birr: 'CBE Birr',
  card: 'Card (POS)',
  mobile_banking: 'Mobile Banking',
  bank_transfer: 'Bank Transfer',
  insurance: 'Insurance'
};

const METHOD_ICONS = {
  cash: DollarSign,
  telebirr: Smartphone,
  cbe_birr: Smartphone,
  card: CreditCard,
  mobile_banking: Smartphone,
  bank_transfer: Building,
  insurance: FileText
};

export default function PaymentsList() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  // Modals State
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [detailPayment, setDetailPayment] = useState(null);
  const [activeReceipt, setActiveReceipt] = useState(null);
  const [showNewPayment, setShowNewPayment] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');

  // New Payment Form State
  const [newPay, setNewPay] = useState({
    patient_id: '',
    patient_name: '',
    payment_type: 'consultation',
    description: '',
    amount: '',
    payment_method: 'cash'
  });
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);

  // 1. Fetch live Payments from Supabase
  const {
    data: payments = [],
    isLoading: isLoadingPayments,
    isError: isPaymentsError,
    error: paymentsError,
    refetch: refetchPayments,
    isFetching
  } = useQuery({
    queryKey: ['payments'],
    queryFn: () => ethioCareClient.entities.Payment.list('-created_date', 300),
    refetchInterval: 10000
  });

  // 2. Fetch Patients to resolve human-readable patient IDs (e.g. PT-260915-1001)
  const { data: patients = [] } = useQuery({
    queryKey: ['patients'],
    queryFn: () => ethioCareClient.entities.Patient.list('-created_date', 300)
  });

  // Patient mapping dictionary
  const patientMap = useMemo(() => {
    const map = new Map();
    patients.forEach(p => {
      map.set(p.id, p);
      if (p.patient_id) map.set(p.patient_id, p);
    });
    return map;
  }, [patients]);

  // Realtime subscription
  useEffect(() => {
    const unsubscribe = ethioCareClient.entities.Payment.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['medicationOrders'] });
    });
    return unsubscribe;
  }, [queryClient]);

  // Helper to get human patient code
  const getPatientCode = (payment) => {
    const p = patientMap.get(payment.patient_id);
    if (p?.patient_id) return p.patient_id;
    if (payment.patient_id && !payment.patient_id.includes('-') && payment.patient_id.length < 15) {
      return payment.patient_id;
    }
    return payment.patient_id ? `PT-${payment.patient_id.slice(0, 6).toUpperCase()}` : 'N/A';
  };

  // Helper to get patient full name
  const getPatientName = (payment) => {
    return payment.patient_name || patientMap.get(payment.patient_id)?.full_name || 'Walk-in Patient';
  };

  // Date filter matcher
  const matchDate = (isoString) => {
    if (!isoString || dateFilter === 'all') return true;
    try {
      const date = typeof isoString === 'string' ? parseISO(isoString) : new Date(isoString);
      if (isNaN(date.getTime())) return true;
      if (dateFilter === 'today') return isToday(date);
      if (dateFilter === 'yesterday') return isYesterday(date);
      if (dateFilter === 'this_week') return isThisWeek(date, { weekStartsOn: 1 });
      if (dateFilter === 'this_month') return isThisMonth(date);
    } catch {
      return true;
    }
    return true;
  };

  // Filtered Payments
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      const pName = getPatientName(p).toLowerCase();
      const pCode = getPatientCode(p).toLowerCase();

      // 1. Search: Patient name, Patient ID, Receipt #, Payment ID, Cashier, Description
      if (search.trim()) {
        const q = search.toLowerCase();
        const rNum = (p.receipt_number || '').toLowerCase();
        const pId = (p.id || '').toLowerCase();
        const desc = (p.description || '').toLowerCase();
        const cashier = (p.cashier_name || '').toLowerCase();
        if (
          !pName.includes(q) &&
          !pCode.includes(q) &&
          !rNum.includes(q) &&
          !pId.includes(q) &&
          !desc.includes(q) &&
          !cashier.includes(q)
        ) {
          return false;
        }
      }

      // 2. Status Filter
      if (statusFilter !== 'all' && p.status !== statusFilter) {
        return false;
      }

      // 3. Payment Method Filter
      if (methodFilter !== 'all' && p.payment_method !== methodFilter) {
        return false;
      }

      // 4. Date Filter
      if (!matchDate(p.paid_date || p.created_at || p.created_date)) {
        return false;
      }

      return true;
    });
  }, [payments, search, statusFilter, methodFilter, dateFilter, patientMap]);

  // Summary Metrics
  const stats = useMemo(() => {
    const paidPayments = payments.filter(p => p.status === 'paid');
    const totalPaidAmount = paidPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const todayPaid = paidPayments.filter(p => {
      const d = p.paid_date || p.created_at || p.created_date;
      if (!d) return false;
      try {
        return isToday(parseISO(d));
      } catch {
        return false;
      }
    });
    const todayRevenue = todayPaid.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const pendingPayments = payments.filter(p => p.status === 'pending');
    const pendingAmount = pendingPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const waivedPayments = payments.filter(p => p.status === 'cancelled' || p.order_status === 'waived');
    const waivedAmount = waivedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    return {
      todayRevenue,
      todayCount: todayPaid.length,
      totalPaidAmount,
      totalPaidCount: paidPayments.length,
      pendingCount: pendingPayments.length,
      pendingAmount,
      waivedCount: waivedPayments.length,
      waivedAmount
    };
  }, [payments]);

  // Confirm / Settle a Pending Payment
  const handleConfirmPayment = async () => {
    if (!selectedPayment) return;
    setIsProcessing(true);
    try {
      const paidDate = format(new Date(), 'yyyy-MM-dd');
      const cashier = user?.full_name || 'Hospital Cashier';

      // Atomic cross-portal settlement & unlock via hospitalBillingService
      const settleResult = await hospitalBillingService.settlePayment(selectedPayment.id, {
        paymentMethod,
        cashierName: cashier,
        receiptNumber: selectedPayment.receipt_number || `RCP-${format(new Date(), 'yyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`,
        paidDate
      });

      const updated = settleResult.payment;
      const receiptNum = settleResult.receiptNumber;

      // 5. Invalidate React Query caches for immediate UI refresh
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['medicationOrders'] });
      queryClient.invalidateQueries({ queryKey: ['labOrders'] });
      queryClient.invalidateQueries({ queryKey: ['visits'] });

      logAudit({
        userName: user?.full_name,
        userRole: user?.role || 'accountant',
        action: 'approve',
        module: 'Payment',
        description: `Payment confirmed: ${selectedPayment.amount} ETB (${selectedPayment.description}) — Patient: ${getPatientName(selectedPayment)}`,
        recordId: selectedPayment.id,
        recordName: getPatientName(selectedPayment)
      });

      toast.success(`Payment settled successfully. Receipt: ${receiptNum}`);
      setActiveReceipt(updated || {
        ...selectedPayment,
        status: 'paid',
        payment_method: paymentMethod,
        receipt_number: receiptNum,
        cashier_name: cashier,
        paid_date: paidDate
      });
      setSelectedPayment(null);
    } catch (err) {
      console.error('[PaymentsList] Error settling payment:', err);
      toast.error(err.message || 'Failed to settle payment');
    } finally {
      setIsProcessing(false);
    }
  };

  // Create Ad-Hoc New Payment
  const handleCreateNewPayment = async () => {
    if (!newPay.patient_name || !newPay.amount) {
      toast.error('Patient name and amount are required');
      return;
    }
    setIsCreatingPayment(true);
    try {
      const receiptNum = `RCP-${format(new Date(), 'yyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;
      const paidDate = format(new Date(), 'yyyy-MM-dd');
      const cashier = user?.full_name || 'Hospital Cashier';

      const payment = await ethioCareClient.entities.Payment.create({
        patient_id: newPay.patient_id || null,
        patient_name: newPay.patient_name.trim(),
        payment_type: newPay.payment_type,
        description: newPay.description?.trim() || `${newPay.payment_type.replace(/_/g, ' ')} Fee`,
        amount: parseFloat(newPay.amount) || 0,
        status: 'paid',
        payment_method: newPay.payment_method,
        receipt_number: receiptNum,
        cashier_name: cashier,
        paid_date: paidDate
      });

      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success(`Payment recorded. Receipt: ${receiptNum}`);
      setActiveReceipt(payment);
      setShowNewPayment(false);
      setNewPay({
        patient_id: '',
        patient_name: '',
        payment_type: 'consultation',
        description: '',
        amount: '',
        payment_method: 'cash'
      });
    } catch (err) {
      console.error('[PaymentsList] Error recording payment:', err);
      toast.error(err.message || 'Failed to record payment');
    } finally {
      setIsCreatingPayment(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-primary" />
            Hospital Payments Ledger
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Collect, track, and reconcile patient payments across all clinical departments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchPayments()}
            disabled={isFetching}
            className="border-border/60 hover:bg-muted/50"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setShowNewPayment(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Payment
          </Button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          title="Today's Revenue"
          value={`${stats.todayRevenue.toLocaleString()} ETB`}
          subtitle={`${stats.todayCount} transactions today`}
          icon={DollarSign}
          color="blue"
        />
        <StatCard
          title="Total Paid"
          value={`${stats.totalPaidAmount.toLocaleString()} ETB`}
          subtitle={`${stats.totalPaidCount} completed payments`}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="Pending Payments"
          value={`${stats.pendingAmount.toLocaleString()} ETB`}
          subtitle={`${stats.pendingCount} unpaid invoices`}
          icon={Clock}
          color="amber"
        />
        <StatCard
          title="Waived / Cancelled"
          value={stats.waivedCount}
          subtitle={`${stats.waivedAmount.toLocaleString()} ETB total`}
          icon={Receipt}
          color="purple"
        />
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-card rounded-xl border border-border/60 p-4 shadow-soft space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9 bg-background/50 border-border/60"
              placeholder="Search patient, ID, receipt, cashier..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-background/50 border-border/60">
                <SelectValue placeholder="Payment Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payment Statuses</SelectItem>
                <SelectItem value="paid">Paid ({stats.totalPaidCount})</SelectItem>
                <SelectItem value="pending">Pending ({stats.pendingCount})</SelectItem>
                <SelectItem value="cancelled">Cancelled ({stats.waivedCount})</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Payment Method Filter */}
          <div>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="bg-background/50 border-border/60">
                <SelectValue placeholder="Payment Method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payment Methods</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="telebirr">Telebirr</SelectItem>
                <SelectItem value="cbe_birr">CBE Birr</SelectItem>
                <SelectItem value="card">Card (POS)</SelectItem>
                <SelectItem value="mobile_banking">Mobile Banking</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="insurance">Insurance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Filter */}
          <div>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="bg-background/50 border-border/60">
                <SelectValue placeholder="Payment Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="today">Today's Transactions</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="this_week">This Week</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Filter Reset */}
        {(search || statusFilter !== 'all' || methodFilter !== 'all' || dateFilter !== 'all') && (
          <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs text-muted-foreground">
            <span>
              Showing {filteredPayments.length} of {payments.length} payment records
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-primary"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
                setMethodFilter('all');
                setDateFilter('all');
              }}
            >
              Reset Filters
            </Button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {isLoadingPayments ? (
        <div className="bg-card rounded-xl border border-border/60 p-8 space-y-4 shadow-soft">
          <div className="flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <Skeleton className="h-6 w-48" />
          </div>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : isPaymentsError ? (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-6 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
          <h3 className="font-heading font-semibold text-lg text-foreground">Failed to load payments</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {paymentsError?.message || 'An unexpected database error occurred while fetching payments from Supabase.'}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetchPayments()}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Try Again
          </Button>
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="bg-card rounded-xl border border-border/60 p-12 text-center shadow-soft">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 text-primary">
            <DollarSign className="w-7 h-7" />
          </div>
          <h3 className="font-heading font-semibold text-lg text-foreground">No payments found</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
            {payments.length === 0
              ? 'No payments have been recorded yet in the hospital database.'
              : 'No payments match your current search and filter settings.'}
          </p>
          {(search || statusFilter !== 'all' || methodFilter !== 'all' || dateFilter !== 'all') && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
                setMethodFilter('all');
                setDateFilter('all');
              }}
            >
              Clear All Filters
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-card rounded-xl border border-border/60 shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider w-[220px]">Payment / Receipt</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Patient</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-right w-[180px]">Amount &amp; Method</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-right w-[200px]">Status &amp; Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map(payment => {
                    const patientCode = getPatientCode(payment);
                    const patientName = getPatientName(payment);
                    const payDateStr = payment.paid_date || payment.created_at || payment.created_date;
                    const formattedDate = payDateStr
                      ? format(new Date(payDateStr), 'MMM dd, yyyy · HH:mm')
                      : 'N/A';
                    const amountNum = Number(payment.amount) || 0;
                    const MethodIcon = METHOD_ICONS[payment.payment_method] || DollarSign;

                    return (
                      <TableRow
                        key={payment.id}
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setDetailPayment(payment)}
                      >
                        {/* 1. Payment ID / Receipt */}
                        <TableCell>
                          <div>
                            {payment.receipt_number ? (
                              <span className="font-mono text-xs font-bold text-primary block">
                                {payment.receipt_number}
                              </span>
                            ) : (
                              <span className="font-mono text-xs text-muted-foreground block">
                                #{payment.id.slice(0, 8)}
                              </span>
                            )}
                            <p className="text-[11px] text-foreground font-medium truncate max-w-[200px]">
                              {payment.description || `${payment.payment_type?.replace(/_/g, ' ')} Fee`}
                            </p>
                            <span className="text-[10px] text-muted-foreground block">
                              {formattedDate}
                            </span>
                          </div>
                        </TableCell>

                        {/* 2. Patient */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-xs">
                              {patientName?.[0]?.toUpperCase() || 'P'}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm text-foreground truncate">
                                {patientName}
                              </p>
                              <span className="inline-block font-mono text-[11px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                                {patientCode}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* 3. Amount & Method */}
                        <TableCell className="text-right">
                          <span className="font-bold text-sm font-heading text-foreground block">
                            {amountNum.toLocaleString()} ETB
                          </span>
                          <div className="flex justify-end mt-1">
                            <Badge variant="outline" className="text-[10px] gap-1 py-0.5 font-medium">
                              <MethodIcon className="w-3 h-3 text-muted-foreground" />
                              {METHOD_LABELS[payment.payment_method] || payment.payment_method || 'Cash'}
                            </Badge>
                          </div>
                        </TableCell>

                        {/* 4. Status & Actions */}
                        <TableCell className="text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <StatusBadge status={payment.status} />
                            {payment.status === 'pending' ? (
                              <Button
                                size="sm"
                                className="h-8 px-2.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                                onClick={() => {
                                  setSelectedPayment(payment);
                                  setPaymentMethod(payment.payment_method || 'cash');
                                }}
                              >
                                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                                Pay
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2 text-xs border-border/60 hover:bg-muted/50"
                                onClick={() =>
                                  setActiveReceipt({
                                    receipt_number: payment.receipt_number || `RCP-${payment.id.slice(0, 8)}`,
                                    amount: amountNum,
                                    patient_name: patientName,
                                    description: payment.description || `${payment.payment_type?.replace(/_/g, ' ')} Fee`,
                                    paid_date: payment.paid_date || format(new Date(), 'yyyy-MM-dd'),
                                    cashier_name: payment.cashier_name || 'Hospital Cashier',
                                    payment_method: payment.payment_method || 'cash',
                                    payment_type: payment.payment_type || 'service'
                                  })
                                }
                              >
                                <Printer className="w-3.5 h-3.5 mr-1" />
                                Receipt
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => setDetailPayment(payment)}
                              title="View details"
                            >
                              <Eye className="w-4 h-4 text-muted-foreground" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredPayments.map(payment => {
              const patientCode = getPatientCode(payment);
              const patientName = getPatientName(payment);
              const payDateStr = payment.paid_date || payment.created_at || payment.created_date;
              const formattedDate = payDateStr
                ? format(new Date(payDateStr), 'MMM dd, yyyy · HH:mm')
                : 'N/A';
              const amountNum = Number(payment.amount) || 0;
              const MethodIcon = METHOD_ICONS[payment.payment_method] || DollarSign;

              return (
                <div
                  key={payment.id}
                  className="bg-card rounded-xl border border-border/60 p-4 shadow-soft space-y-3 cursor-pointer hover:border-primary/40 transition-colors"
                  onClick={() => setDetailPayment(payment)}
                >
                  {/* Top: Receipt & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-mono text-xs font-bold text-primary block truncate">
                        {payment.receipt_number || `#${payment.id.slice(0, 8)}`}
                      </span>
                      <p className="font-semibold text-sm text-foreground truncate mt-0.5">{patientName}</p>
                      <span className="font-mono text-xs text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                        {patientCode}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StatusBadge status={payment.status} />
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <MethodIcon className="w-3 h-3" />
                        {METHOD_LABELS[payment.payment_method] || payment.payment_method || 'Cash'}
                      </Badge>
                    </div>
                  </div>

                  {/* Body: Service description */}
                  <div className="bg-muted/30 rounded-lg p-2.5 text-xs space-y-1">
                    <p className="font-medium text-foreground">{payment.description || `${payment.payment_type?.replace(/_/g, ' ')} Fee`}</p>
                    <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                      <span>Cashier: {payment.cashier_name || 'Hospital Cashier'}</span>
                      <span>{formattedDate}</span>
                    </div>
                  </div>

                  {/* Footer: Price & Actions */}
                  <div className="flex items-center justify-between pt-1 border-t border-border/40" onClick={e => e.stopPropagation()}>
                    <p className="font-bold text-base text-foreground font-heading">
                      {amountNum.toLocaleString()} ETB
                    </p>

                    <div className="flex items-center gap-1.5">
                      {payment.status === 'pending' ? (
                        <Button
                          size="sm"
                          className="h-8 px-3 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                          onClick={() => {
                            setSelectedPayment(payment);
                            setPaymentMethod(payment.payment_method || 'cash');
                          }}
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1" /> Pay
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2.5 text-xs"
                          onClick={() =>
                            setActiveReceipt({
                              receipt_number: payment.receipt_number || `RCP-${payment.id.slice(0, 8)}`,
                              amount: amountNum,
                              patient_name: patientName,
                              description: payment.description || `${payment.payment_type?.replace(/_/g, ' ')} Fee`,
                              paid_date: payment.paid_date || format(new Date(), 'yyyy-MM-dd'),
                              cashier_name: payment.cashier_name || 'Hospital Cashier',
                              payment_method: payment.payment_method || 'cash',
                              payment_type: payment.payment_type || 'service'
                            })
                          }
                        >
                          <Printer className="w-3.5 h-3.5 mr-1" /> Receipt
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => setDetailPayment(payment)}
                      >
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Payment Details Modal */}
      <Dialog open={!!detailPayment} onOpenChange={open => !open && setDetailPayment(null)}>
        <DialogContent className="max-w-md bg-card border-border/60 shadow-card">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-bold text-foreground flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              Payment Transaction Details
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Official hospital transaction record from the public.payments database
            </DialogDescription>
          </DialogHeader>

          {detailPayment && (
            <div className="space-y-4 pt-2 text-sm">
              <div className="bg-muted/40 rounded-xl p-3.5 border border-border/60 space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Receipt Number:</span>
                  <span className="font-mono text-xs font-bold text-primary">
                    {detailPayment.receipt_number || `Pending (#${detailPayment.id.slice(0, 8)})`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Patient Name:</span>
                  <span className="font-semibold text-foreground">{getPatientName(detailPayment)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Patient ID:</span>
                  <span className="font-mono text-xs font-semibold">{getPatientCode(detailPayment)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Service / Type:</span>
                  <span className="capitalize text-foreground">
                    {detailPayment.description || detailPayment.payment_type?.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Payment Method:</span>
                  <span className="font-medium text-foreground capitalize">
                    {METHOD_LABELS[detailPayment.payment_method] || detailPayment.payment_method}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Cashier / Received By:</span>
                  <span className="text-foreground">{detailPayment.cashier_name || 'Hospital Cashier'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Transaction Date:</span>
                  <span className="text-foreground">{detailPayment.paid_date || 'Today'}</span>
                </div>
              </div>

              {/* Total Card */}
              <div className="bg-card border border-border/60 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Settlement Amount</p>
                  <p className="text-xl font-bold font-heading text-primary">
                    {(Number(detailPayment.amount) || 0).toLocaleString()} ETB
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <StatusBadge status={detailPayment.status} />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                {detailPayment.status === 'pending' ? (
                  <Button
                    size="sm"
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => {
                      setSelectedPayment(detailPayment);
                      setPaymentMethod(detailPayment.payment_method || 'cash');
                      setDetailPayment(null);
                    }}
                  >
                    <CheckCircle className="w-3.5 h-3.5 mr-1" />
                    Settle Payment
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-border/60"
                    onClick={() => {
                      setActiveReceipt({
                        receipt_number: detailPayment.receipt_number || `RCP-${detailPayment.id.slice(0, 8)}`,
                        amount: Number(detailPayment.amount) || 0,
                        patient_name: getPatientName(detailPayment),
                        description: detailPayment.description || `${detailPayment.payment_type?.replace(/_/g, ' ')} Fee`,
                        paid_date: detailPayment.paid_date || format(new Date(), 'yyyy-MM-dd'),
                        cashier_name: detailPayment.cashier_name || 'Hospital Cashier',
                        payment_method: detailPayment.payment_method || 'cash',
                        payment_type: detailPayment.payment_type || 'service'
                      });
                      setDetailPayment(null);
                    }}
                  >
                    <Printer className="w-3.5 h-3.5 mr-1" />
                    Print Receipt
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Settle Pending Payment Modal */}
      <Dialog open={!!selectedPayment} onOpenChange={open => !open && setSelectedPayment(null)}>
        <DialogContent className="max-w-md bg-card border-border/60 shadow-card">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-bold text-foreground flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Settle Pending Payment
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Confirm payment receipt and dispatch live updates across all portals
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-4 pt-2 text-sm">
              <div className="bg-muted/40 rounded-xl p-3.5 border border-border/60 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Patient:</span>
                  <span className="font-semibold text-foreground">{getPatientName(selectedPayment)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Patient ID:</span>
                  <span className="font-mono text-xs font-bold text-primary">{getPatientCode(selectedPayment)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service:</span>
                  <span className="font-medium text-foreground">{selectedPayment.description}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border/40">
                  <span className="text-muted-foreground font-medium">Total Due:</span>
                  <span className="text-xl font-bold font-heading text-primary">
                    {(Number(selectedPayment.amount) || 0).toLocaleString()} ETB
                  </span>
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Payment Method *</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="bg-background border-border/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="telebirr">Telebirr SuperApp</SelectItem>
                    <SelectItem value="cbe_birr">CBE Birr</SelectItem>
                    <SelectItem value="card">Debit / Credit Card (POS)</SelectItem>
                    <SelectItem value="mobile_banking">Mobile Banking / Transfer</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="insurance">Insurance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedPayment(null)}
                  disabled={isProcessing}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={handleConfirmPayment}
                  disabled={isProcessing}
                >
                  <CheckCircle className="w-4 h-4 mr-1.5" />
                  {isProcessing ? 'Settling Payment...' : 'Confirm & Generate Receipt'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New Payment Modal */}
      <Dialog open={showNewPayment} onOpenChange={setShowNewPayment}>
        <DialogContent className="max-w-md bg-card border-border/60 shadow-card">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-bold text-foreground flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              Record New Hospital Payment
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Manually record consultation, registration, service, or medicine fee
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 pt-2 text-sm">
            {/* Patient Select */}
            <div className="space-y-1">
              <Label className="text-xs font-medium">Select Existing Patient (Optional)</Label>
              <Select
                value={newPay.patient_id}
                onValueChange={val => {
                  const found = patients.find(p => p.id === val);
                  setNewPay(prev => ({
                    ...prev,
                    patient_id: val,
                    patient_name: found?.full_name || prev.patient_name
                  }));
                }}
              >
                <SelectTrigger className="bg-background border-border/60">
                  <SelectValue placeholder="Choose a registered patient..." />
                </SelectTrigger>
                <SelectContent>
                  {patients.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name} ({p.patient_id || 'ID Pending'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Patient Name */}
            <div className="space-y-1">
              <Label className="text-xs font-medium">Patient Full Name *</Label>
              <Input
                placeholder="e.g. Abebe Bikila"
                className="bg-background border-border/60"
                value={newPay.patient_name}
                onChange={e => setNewPay(prev => ({ ...prev, patient_name: e.target.value }))}
              />
            </div>

            {/* Type & Amount */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Payment Type *</Label>
                <Select
                  value={newPay.payment_type}
                  onValueChange={val => setNewPay(prev => ({ ...prev, payment_type: val }))}
                >
                  <SelectTrigger className="bg-background border-border/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consultation">Consultation</SelectItem>
                    <SelectItem value="registration">Registration</SelectItem>
                    <SelectItem value="medicine">Medicine</SelectItem>
                    <SelectItem value="laboratory">Laboratory</SelectItem>
                    <SelectItem value="procedure">Procedure</SelectItem>
                    <SelectItem value="injection">Injection</SelectItem>
                    <SelectItem value="other">Other Service</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Amount (ETB) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="bg-background border-border/60 font-semibold"
                  value={newPay.amount}
                  onChange={e => setNewPay(prev => ({ ...prev, amount: e.target.value }))}
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <Label className="text-xs font-medium">Description / Service Note</Label>
              <Input
                placeholder="e.g. Specialist Consultation with Dr. Selamawit"
                className="bg-background border-border/60"
                value={newPay.description}
                onChange={e => setNewPay(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            {/* Payment Method */}
            <div className="space-y-1">
              <Label className="text-xs font-medium">Payment Method *</Label>
              <Select
                value={newPay.payment_method}
                onValueChange={val => setNewPay(prev => ({ ...prev, payment_method: val }))}
              >
                <SelectTrigger className="bg-background border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="telebirr">Telebirr</SelectItem>
                  <SelectItem value="cbe_birr">CBE Birr</SelectItem>
                  <SelectItem value="card">Card (POS)</SelectItem>
                  <SelectItem value="mobile_banking">Mobile Banking</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="insurance">Insurance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNewPayment(false)}
                disabled={isCreatingPayment}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleCreateNewPayment}
                disabled={isCreatingPayment || !newPay.patient_name || !newPay.amount}
              >
                <Receipt className="w-4 h-4 mr-1.5" />
                {isCreatingPayment ? 'Recording...' : 'Record Payment & Print Receipt'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Printable Receipt Modal */}
      <ReceiptModal
        open={!!activeReceipt}
        onOpenChange={open => !open && setActiveReceipt(null)}
        payment={activeReceipt}
      />
    </div>
  );
}
