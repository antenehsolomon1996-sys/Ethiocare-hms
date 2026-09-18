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
import MobileSheet from '@/components/common/MobileSheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isToday, isYesterday, isThisWeek, isThisMonth, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { logAudit } from '@/lib/auditLogger';
import {
  Pill,
  Syringe,
  Package,
  Clock,
  CheckCircle,
  Search,
  AlertTriangle,
  Receipt,
  DollarSign,
  Printer,
  RefreshCw,
  Eye,
  X,
  User,
  Stethoscope,
  Calendar,
  CreditCard,
  FileText
} from 'lucide-react';
import ReceiptModal from '@/components/billing/ReceiptModal';
import { notificationService } from '@/services/notification.service';

const ORDER_TYPE_ICONS = {
  medicine: Pill,
  injection: Syringe,
  iv_treatment: Syringe,
  medical_supply: Package,
  other: Package
};

const URGENCY_BADGES = {
  stat: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  urgent: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  routine: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
};

export default function MedicationOrdersBilling() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Filters state
  const [search, setSearch] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  // Modals state
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [detailOrder, setDetailOrder] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [customPrice, setCustomPrice] = useState('');
  const [activeReceipt, setActiveReceipt] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 1. Fetch medication orders from live Supabase
  const {
    data: orders = [],
    isLoading: isLoadingOrders,
    isError: isOrdersError,
    error: ordersError,
    refetch: refetchOrders,
    isFetching
  } = useQuery({
    queryKey: ['medicationOrders'],
    queryFn: () => ethioCareClient.entities.MedicationOrder.list('-created_date', 300),
    refetchInterval: 10000
  });

  // 2. Fetch patients to map UUIDs to human-readable Patient IDs (e.g. PT-260915-1001)
  const { data: patients = [] } = useQuery({
    queryKey: ['patients'],
    queryFn: () => ethioCareClient.entities.Patient.list('-created_date', 300)
  });

  // Map patient_id UUID to full patient record
  const patientMap = useMemo(() => {
    const map = new Map();
    patients.forEach(p => {
      map.set(p.id, p);
      if (p.patient_id) map.set(p.patient_id, p);
    });
    return map;
  }, [patients]);

  // Realtime subscription to live Supabase updates
  useEffect(() => {
    const unsubscribe = ethioCareClient.entities.MedicationOrder.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['medicationOrders'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    });
    return unsubscribe;
  }, [queryClient]);

  // Helper to resolve human-readable patient code
  const getPatientCode = (order) => {
    const p = patientMap.get(order.patient_id);
    if (p?.patient_id) return p.patient_id;
    if (order.patient_id && !order.patient_id.includes('-') && order.patient_id.length < 15) {
      return order.patient_id;
    }
    return order.patient_id ? `PT-${order.patient_id.slice(0, 6).toUpperCase()}` : 'N/A';
  };

  // Date filtering logic
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

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // 1. Search filter: Patient name, Patient ID, Item name, Doctor name
      if (search.trim()) {
        const q = search.toLowerCase();
        const pCode = getPatientCode(order).toLowerCase();
        const pName = (order.patient_name || '').toLowerCase();
        const iName = (order.item_name || '').toLowerCase();
        const dName = (order.doctor_name || '').toLowerCase();
        if (!pName.includes(q) && !pCode.includes(q) && !iName.includes(q) && !dName.includes(q)) {
          return false;
        }
      }

      // 2. Payment status filter
      if (paymentStatusFilter !== 'all') {
        if (paymentStatusFilter === 'pending_payment') {
          if (order.payment_status !== 'pending_payment' && order.payment_status !== 'pending') return false;
        } else if (order.payment_status !== paymentStatusFilter) {
          return false;
        }
      }

      // 3. Order / Administration status filter
      if (orderStatusFilter !== 'all') {
        if (orderStatusFilter === 'pending') {
          if (order.administration_status !== 'pending' && order.administration_status !== 'in_progress') return false;
        } else if (order.administration_status !== orderStatusFilter) {
          return false;
        }
      }

      // 4. Date filter
      if (!matchDate(order.created_at || order.created_date)) {
        return false;
      }

      return true;
    });
  }, [orders, search, paymentStatusFilter, orderStatusFilter, dateFilter, patientMap]);

  // Summary Card Statistics
  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const pendingOrders = orders.filter(o => o.payment_status === 'pending_payment' || o.payment_status === 'pending');
    const pendingTotalAmount = pendingOrders.reduce((sum, o) => sum + (Number(o.total_price) || Number(o.unit_price) || 0), 0);

    const paidOrders = orders.filter(o => o.payment_status === 'paid');
    const paidTotalAmount = paidOrders.reduce((sum, o) => sum + (Number(o.total_price) || Number(o.paid_amount) || 0), 0);

    const waivedOrders = orders.filter(o => o.payment_status === 'waived');
    const waivedTotalAmount = waivedOrders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);

    return {
      total: totalOrders,
      pendingCount: pendingOrders.length,
      pendingAmount: pendingTotalAmount,
      paidCount: paidOrders.length,
      paidAmount: paidTotalAmount,
      waivedCount: waivedOrders.length,
      waivedAmount: waivedTotalAmount
    };
  }, [orders]);

  // Open Payment Confirmation Dialog
  const handleOpenPayment = (order) => {
    setPaymentOrder(order);
    setCustomPrice(order.total_price?.toString() || order.unit_price?.toString() || '0');
    setPaymentMethod('cash');
  };

  // Confirm Payment
  const handleConfirmPayment = async () => {
    if (!paymentOrder) return;
    setIsProcessing(true);
    try {
      const receiptNum = `RCP-MED-${format(new Date(), 'yyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;
      const amount = parseFloat(customPrice) || 0;
      const cashier = user?.full_name || 'Hospital Cashier';
      const paidDate = format(new Date(), 'yyyy-MM-dd');

      // 1. Check if an existing pending payment record is linked
      const existingPayments = await ethioCareClient.entities.Payment.filter({ reference_id: paymentOrder.id });
      const existingPending = existingPayments.find(p => p.status === 'pending');
      let paymentRecord = null;
      let paymentId = null;

      if (existingPending) {
        paymentRecord = await ethioCareClient.entities.Payment.update(existingPending.id, {
          amount,
          status: 'paid',
          payment_method: paymentMethod,
          receipt_number: receiptNum,
          cashier_name: cashier,
          paid_date: paidDate,
          order_status: 'paid'
        });
        paymentId = existingPending.id;
      } else {
        paymentRecord = await ethioCareClient.entities.Payment.create({
          visit_id: paymentOrder.visit_id || null,
          patient_id: paymentOrder.patient_id,
          patient_name: paymentOrder.patient_name,
          payment_type: paymentOrder.order_type === 'medicine' ? 'medicine' : 'procedure',
          description: `Medication: ${paymentOrder.item_name}${paymentOrder.dosage ? ` (${paymentOrder.dosage})` : ''}`,
          amount,
          status: 'paid',
          payment_method: paymentMethod,
          receipt_number: receiptNum,
          cashier_name: cashier,
          paid_date: paidDate,
          reference_type: 'medication_order',
          reference_id: paymentOrder.id,
          doctor_name: paymentOrder.doctor_name || null,
          doctor_id: paymentOrder.doctor_id || null,
          medication_order_id: paymentOrder.id,
          medication_name: paymentOrder.item_name,
          dosage: paymentOrder.dosage || null,
          quantity: paymentOrder.quantity || 1,
          frequency: paymentOrder.frequency || null,
          route: paymentOrder.order_type || 'medicine',
          order_notes: paymentOrder.instructions || null,
          order_status: 'paid'
        });
        paymentId = paymentRecord.id;
      }

      // 2. Update Medication Order status to 'paid' and administration to 'pending'
      await ethioCareClient.entities.MedicationOrder.update(paymentOrder.id, {
        payment_status: 'paid',
        administration_status: 'pending',
        payment_id: paymentId,
        receipt_number: receiptNum,
        paid_by: cashier,
        paid_date: paidDate,
        total_price: amount
      });

      // 3. Dispatch NurseTask for medication administration (wrapped safely)
      try {
        if (paymentOrder.visit_id && paymentOrder.patient_id) {
          const isImmediate = paymentOrder.urgency === 'stat' || paymentOrder.urgency === 'urgent' || paymentOrder.order_type === 'injection';
          const existingTasks = await ethioCareClient.entities.NurseTask.filter({ visit_id: paymentOrder.visit_id });
          const taskExists = existingTasks.some(t => t.description?.includes(paymentOrder.item_name));
          if (!taskExists) {
            await ethioCareClient.entities.NurseTask.create({
              visit_id: paymentOrder.visit_id,
              patient_id: paymentOrder.patient_id,
              patient_name: paymentOrder.patient_name,
              task_type: paymentOrder.order_type === 'iv_treatment' ? 'iv_treatment' : paymentOrder.order_type === 'injection' ? 'injection' : 'procedure',
              description: `${isImmediate ? '[IMMEDIATE] ' : ''}Medication: ${paymentOrder.item_name}${paymentOrder.dosage ? ` — ${paymentOrder.dosage}` : ''}${paymentOrder.frequency ? ` ${paymentOrder.frequency}` : ''} · Qty: ${paymentOrder.quantity || 1}`,
              instructions: paymentOrder.instructions || `Administer ${paymentOrder.item_name} as prescribed by Dr. ${paymentOrder.doctor_name || ''}`,
              doctor_name: paymentOrder.doctor_name || '',
              status: 'pending'
            });
            queryClient.invalidateQueries({ queryKey: ['nurseTasks'] });
          }

          // Dispatch notification to Nurse Room
          const isStat = paymentOrder.urgency === 'stat';
          notificationService.dispatch({
            title: isStat ? '🚨 IMMEDIATE Nursing Order Paid' : 'New Paid Nursing Order Ready',
            message: `${isStat ? '[STAT IMMEDIATE] ' : ''}Payment completed for ${paymentOrder.patient_name}: ${paymentOrder.item_name}. Ready for administration.`,
            type: isStat ? 'alert' : 'info',
            module: 'nurse',
            targetRoles: ['nurse', 'owner'],
            link: '/nurse/medication-orders'
          });
        }
      } catch (taskErr) {
        console.warn('[MedicationOrdersBilling] Non-critical: NurseTask notice:', taskErr);
      }

      // 4. Invalidate React Query caches for instantaneous UI updates
      queryClient.invalidateQueries({ queryKey: ['medicationOrders'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });

      logAudit({
        userName: user?.full_name,
        userRole: user?.role || 'accountant',
        action: 'approve',
        module: 'MedicationOrder',
        description: `Payment of ${amount} ETB confirmed for ${paymentOrder.item_name} (Patient: ${paymentOrder.patient_name})`,
        recordId: paymentOrder.id,
        recordName: paymentOrder.patient_name
      });

      toast.success(`Payment confirmed! Order released to Nurse Room. Receipt: ${receiptNum}`);
      setActiveReceipt(paymentRecord || {
        receipt_number: receiptNum,
        amount,
        payment_method: paymentMethod,
        patient_name: paymentOrder.patient_name,
        description: `Medication: ${paymentOrder.item_name}`,
        paid_date: paidDate,
        cashier_name: cashier,
        payment_type: 'medicine'
      });
      setPaymentOrder(null);
    } catch (err) {
      console.error('[MedicationOrdersBilling] Error processing payment:', err);
      toast.error(err.message || 'Failed to process payment');
    } finally {
      setIsProcessing(false);
    }
  };

  // Waive Order
  const handleWaiveOrder = async (order) => {
    if (!window.confirm(`Are you sure you want to waive payment for "${order.item_name}"? This will release the order to the Nurse Room as medically waived.`)) {
      return;
    }
    try {
      await ethioCareClient.entities.MedicationOrder.update(order.id, {
        payment_status: 'waived',
        administration_status: 'pending',
        notes: `Payment waived by ${user?.full_name || 'Accountant'} on ${format(new Date(), 'yyyy-MM-dd')}`
      });

      const linked = await ethioCareClient.entities.Payment.filter({ reference_id: order.id });
      if (linked.length > 0) {
        await ethioCareClient.entities.Payment.update(linked[0].id, {
          status: 'paid',
          order_status: 'waived',
          paid_by: user?.full_name || 'Hospital Accountant',
          paid_date: format(new Date(), 'yyyy-MM-dd')
        });
      }

      queryClient.invalidateQueries({ queryKey: ['medicationOrders'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success(`Order payment waived. Order released to Nurse Room.`);
    } catch (err) {
      console.error('[MedicationOrdersBilling] Error waiving order:', err);
      toast.error(err.message || 'Failed to waive payment');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Pill className="w-6 h-6 text-primary" />
            Medication Orders — Billing
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time queue of physician medication orders requiring billing settlement and nurse release
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchOrders()}
            disabled={isFetching}
            className="border-border/60 hover:bg-muted/50"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {stats.pendingCount > 0 && (
            <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs px-2.5 py-1 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5 mr-1.5 inline" />
              {stats.pendingCount} Awaiting Payment
            </Badge>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          title="Total Medication Orders"
          value={stats.total}
          subtitle="All recorded prescriptions"
          icon={Pill}
          color="primary"
        />
        <StatCard
          title="Pending Payment"
          value={stats.pendingCount}
          subtitle={`${stats.pendingAmount.toLocaleString()} ETB pending`}
          icon={Clock}
          color="amber"
        />
        <StatCard
          title="Paid & Released"
          value={stats.paidCount}
          subtitle={`${stats.paidAmount.toLocaleString()} ETB collected`}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="Waived Orders"
          value={stats.waivedCount}
          subtitle={`${stats.waivedAmount.toLocaleString()} ETB waived`}
          icon={Receipt}
          color="purple"
        />
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-card rounded-xl border border-border/60 p-4 shadow-soft space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9 bg-background/50 border-border/60"
              placeholder="Search patient, ID, med, doctor..."
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

          {/* Payment Status Filter */}
          <div>
            <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
              <SelectTrigger className="bg-background/50 border-border/60">
                <SelectValue placeholder="Payment Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payment Statuses</SelectItem>
                <SelectItem value="pending_payment">Awaiting Payment ({stats.pendingCount})</SelectItem>
                <SelectItem value="paid">Paid & Settled ({stats.paidCount})</SelectItem>
                <SelectItem value="waived">Waived ({stats.waivedCount})</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Order / Administration Status Filter */}
          <div>
            <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
              <SelectTrigger className="bg-background/50 border-border/60">
                <SelectValue placeholder="Administration Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Order Statuses</SelectItem>
                <SelectItem value="awaiting_payment">Awaiting Billing</SelectItem>
                <SelectItem value="pending">Nurse Queue (Pending)</SelectItem>
                <SelectItem value="completed">Administered (Done)</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Filter */}
          <div>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="bg-background/50 border-border/60">
                <SelectValue placeholder="Order Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="today">Today's Orders</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="this_week">This Week</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Active Filters Summary & Reset */}
        {(search || paymentStatusFilter !== 'all' || orderStatusFilter !== 'all' || dateFilter !== 'all') && (
          <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs text-muted-foreground">
            <span>
              Showing {filteredOrders.length} of {orders.length} orders
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-primary"
              onClick={() => {
                setSearch('');
                setPaymentStatusFilter('all');
                setOrderStatusFilter('all');
                setDateFilter('all');
              }}
            >
              Reset Filters
            </Button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {isLoadingOrders ? (
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
      ) : isOrdersError ? (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-6 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
          <h3 className="font-heading font-semibold text-lg text-foreground">Failed to load medication orders</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {ordersError?.message || 'An unexpected database error occurred while fetching orders from Supabase.'}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetchOrders()}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Try Again
          </Button>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-card rounded-xl border border-border/60 p-12 text-center shadow-soft">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 text-primary">
            <Pill className="w-7 h-7" />
          </div>
          <h3 className="font-heading font-semibold text-lg text-foreground">No medication orders found</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
            {orders.length === 0
              ? 'No medication orders have been prescribed yet in the hospital database.'
              : 'No orders match your current search and filter settings.'}
          </p>
          {(search || paymentStatusFilter !== 'all' || orderStatusFilter !== 'all' || dateFilter !== 'all') && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setSearch('');
                setPaymentStatusFilter('all');
                setOrderStatusFilter('all');
                setDateFilter('all');
              }}
            >
              Clear All Filters
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-card rounded-xl border border-border/60 shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Patient</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Medication</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Doctor</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Date / Time</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Amount</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-center">Payment Status</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-center">Order Status</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map(order => {
                    const patientCode = getPatientCode(order);
                    const orderDateStr = order.created_at || order.created_date;
                    const formattedDate = orderDateStr
                      ? format(new Date(orderDateStr), 'MMM dd, yyyy · HH:mm')
                      : 'N/A';
                    const amountNum = Number(order.total_price) || Number(order.unit_price) || 0;
                    const Icon = ORDER_TYPE_ICONS[order.order_type] || Pill;

                    return (
                      <TableRow
                        key={order.id}
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setDetailOrder(order)}
                      >
                        {/* Patient */}
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-xs">
                              {order.patient_name?.[0]?.toUpperCase() || 'P'}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm text-foreground truncate">
                                {order.patient_name || 'Unnamed Patient'}
                              </p>
                              <span className="inline-block font-mono text-[11px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded mt-0.5">
                                {patientCode}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Medication */}
                        <TableCell>
                          <div className="flex items-start gap-2">
                            <Icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium text-sm text-foreground">{order.item_name}</p>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                                {order.dosage && <span>{order.dosage}</span>}
                                {order.frequency && <span>· {order.frequency}</span>}
                                {order.quantity && <span>· Qty: {order.quantity}</span>}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* Prescribing Doctor */}
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Stethoscope className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                            <span className="truncate">{order.doctor_name ? `Dr. ${order.doctor_name}` : 'Attending MD'}</span>
                          </div>
                        </TableCell>

                        {/* Date / Time */}
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                            <Calendar className="w-3.5 h-3.5 opacity-60" />
                            <span>{formattedDate}</span>
                          </div>
                        </TableCell>

                        {/* Amount */}
                        <TableCell className="text-right">
                          <span className="font-bold text-sm font-heading text-foreground">
                            {amountNum.toLocaleString()} ETB
                          </span>
                        </TableCell>

                        {/* Payment Status */}
                        <TableCell className="text-center whitespace-nowrap">
                          {order.payment_status === 'paid' && (
                            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                              Paid
                            </Badge>
                          )}
                          {(order.payment_status === 'pending_payment' || order.payment_status === 'pending') && (
                            <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                              Pending Payment
                            </Badge>
                          )}
                          {order.payment_status === 'waived' && (
                            <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                              Waived
                            </Badge>
                          )}
                          {order.payment_status === 'cancelled' && (
                            <Badge className="bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
                              Cancelled
                            </Badge>
                          )}
                        </TableCell>

                        {/* Order / Admin Status */}
                        <TableCell className="text-center whitespace-nowrap">
                          <StatusBadge status={order.administration_status || 'awaiting_payment'} />
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {(order.payment_status === 'pending_payment' || order.payment_status === 'pending') ? (
                              <Button
                                size="sm"
                                className="h-8 px-3 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                                onClick={() => handleOpenPayment(order)}
                              >
                                <DollarSign className="w-3.5 h-3.5 mr-1" />
                                Collect
                              </Button>
                            ) : order.payment_status === 'paid' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2.5 text-xs border-border/60 hover:bg-muted/50"
                                onClick={() =>
                                  setActiveReceipt({
                                    receipt_number: order.receipt_number || `RCP-MED-${order.id.slice(0, 6)}`,
                                    amount: amountNum,
                                    patient_name: order.patient_name,
                                    description: `Medication: ${order.item_name}`,
                                    paid_date: order.paid_date || format(new Date(), 'yyyy-MM-dd'),
                                    cashier_name: order.paid_by || 'Hospital Cashier',
                                    payment_method: order.payment_method || 'cash',
                                    payment_type: 'medicine'
                                  })
                                }
                              >
                                <Printer className="w-3.5 h-3.5 mr-1" />
                                Receipt
                              </Button>
                            ) : null}

                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => setDetailOrder(order)}
                              title="View full details"
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

          {/* Mobile Cards View */}
          <div className="md:hidden space-y-3">
            {filteredOrders.map(order => {
              const patientCode = getPatientCode(order);
              const orderDateStr = order.created_at || order.created_date;
              const formattedDate = orderDateStr
                ? format(new Date(orderDateStr), 'MMM dd, yyyy · HH:mm')
                : 'N/A';
              const amountNum = Number(order.total_price) || Number(order.unit_price) || 0;
              const Icon = ORDER_TYPE_ICONS[order.order_type] || Pill;

              return (
                <div
                  key={order.id}
                  className="bg-card rounded-xl border border-border/60 p-4 shadow-soft space-y-3 cursor-pointer hover:border-primary/40 transition-colors"
                  onClick={() => setDetailOrder(order)}
                >
                  {/* Top Bar: Patient & Status Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{order.patient_name}</p>
                      <span className="font-mono text-xs text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                        {patientCode}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {order.payment_status === 'paid' ? (
                        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs">
                          Paid
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs">
                          Awaiting Payment
                        </Badge>
                      )}
                      <Badge variant="outline" className={`text-[10px] ${URGENCY_BADGES[order.urgency || 'routine']}`}>
                        {order.urgency || 'routine'}
                      </Badge>
                    </div>
                  </div>

                  {/* Body: Medication & Details */}
                  <div className="bg-muted/30 rounded-lg p-2.5 flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0 text-primary mt-0.5">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-foreground">{order.item_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {[order.dosage, order.frequency, order.duration].filter(Boolean).join(' · ')}
                        {order.quantity ? ` · Qty: ${order.quantity}` : ''}
                      </p>
                      {order.doctor_name && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Stethoscope className="w-3 h-3 text-primary" /> Dr. {order.doctor_name}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Footer: Date, Price, Actions */}
                  <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs text-muted-foreground" onClick={e => e.stopPropagation()}>
                    <div>
                      <p className="font-bold text-sm text-foreground font-heading">
                        {amountNum.toLocaleString()} ETB
                      </p>
                      <p className="text-[11px] text-muted-foreground">{formattedDate}</p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {(order.payment_status === 'pending_payment' || order.payment_status === 'pending') ? (
                        <Button
                          size="sm"
                          className="h-8 px-3 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                          onClick={() => handleOpenPayment(order)}
                        >
                          <DollarSign className="w-3.5 h-3.5 mr-1" /> Pay
                        </Button>
                      ) : order.payment_status === 'paid' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2.5 text-xs"
                          onClick={() =>
                            setActiveReceipt({
                              receipt_number: order.receipt_number || `RCP-MED-${order.id.slice(0, 6)}`,
                              amount: amountNum,
                              patient_name: order.patient_name,
                              description: `Medication: ${order.item_name}`,
                              paid_date: order.paid_date || format(new Date(), 'yyyy-MM-dd'),
                              cashier_name: order.paid_by || 'Hospital Cashier',
                              payment_method: order.payment_method || 'cash',
                              payment_type: 'medicine'
                            })
                          }
                        >
                          <Printer className="w-3.5 h-3.5 mr-1" /> Receipt
                        </Button>
                      ) : null}

                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => setDetailOrder(order)}
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

      {/* Medication Order Details Modal */}
      <Dialog open={!!detailOrder} onOpenChange={open => !open && setDetailOrder(null)}>
        <DialogContent className="max-w-md md:max-w-lg bg-card border-border/60 shadow-card">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-bold text-foreground flex items-center gap-2">
              <Pill className="w-5 h-5 text-primary" />
              Prescription Order Details
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Full order record from physician prescription through billing and nurse administration
            </DialogDescription>
          </DialogHeader>

          {detailOrder && (
            <div className="space-y-4 pt-2 text-sm">
              {/* Patient & Doctor Card */}
              <div className="bg-muted/40 rounded-xl p-3.5 border border-border/60 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Patient</p>
                  <p className="font-semibold text-foreground text-sm">{detailOrder.patient_name}</p>
                  <span className="font-mono text-xs text-primary font-bold">{getPatientCode(detailOrder)}</span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Prescribing Physician</p>
                  <p className="font-semibold text-foreground text-sm">
                    {detailOrder.doctor_name ? `Dr. ${detailOrder.doctor_name}` : 'Attending Staff'}
                  </p>
                  <span className="text-xs text-muted-foreground capitalize">
                    {detailOrder.order_type?.replace(/_/g, ' ') || 'Internal Medicine'}
                  </span>
                </div>
              </div>

              {/* Medication Itemization */}
              <div className="space-y-2 border border-border/60 rounded-xl p-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">{detailOrder.item_name}</span>
                  <Badge variant="outline" className={`text-xs ${URGENCY_BADGES[detailOrder.urgency || 'routine']}`}>
                    {detailOrder.urgency || 'routine'}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1">
                  <div>
                    <span className="font-medium text-foreground">Dosage:</span> {detailOrder.dosage || 'Standard'}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Frequency:</span> {detailOrder.frequency || 'As needed'}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Duration:</span> {detailOrder.duration || 'N/A'}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Quantity:</span> {detailOrder.quantity || 1} units
                  </div>
                </div>
                {detailOrder.instructions && (
                  <div className="bg-primary/5 rounded-lg p-2.5 text-xs text-foreground mt-2 border border-primary/20">
                    <span className="font-semibold text-primary">Instructions:</span> {detailOrder.instructions}
                  </div>
                )}
                {detailOrder.notes && (
                  <div className="text-xs text-muted-foreground italic">
                    <span className="font-semibold not-italic">Notes:</span> {detailOrder.notes}
                  </div>
                )}
              </div>

              {/* Financial Breakdown */}
              <div className="bg-card border border-border/60 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Order Total Amount</p>
                  <p className="text-xl font-bold font-heading text-primary">
                    {(Number(detailOrder.total_price) || Number(detailOrder.unit_price) || 0).toLocaleString()} ETB
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Payment Status</p>
                  <span className="capitalize font-semibold text-sm">
                    {detailOrder.payment_status?.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              {/* Settlement / Receipt Metadata if Paid */}
              {detailOrder.payment_status === 'paid' && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs space-y-1 text-emerald-800 dark:text-emerald-300">
                  <p className="font-semibold flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Payment Settled
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-muted-foreground">
                    <div>Receipt: <span className="font-mono font-semibold text-foreground">{detailOrder.receipt_number || 'N/A'}</span></div>
                    <div>Paid Date: <span className="text-foreground">{detailOrder.paid_date || 'Today'}</span></div>
                    <div>Cashier: <span className="text-foreground">{detailOrder.paid_by || 'Hospital Cashier'}</span></div>
                    <div>Method: <span className="capitalize text-foreground">{detailOrder.payment_method || 'Cash'}</span></div>
                  </div>
                </div>
              )}

              {/* Administration Status */}
              <div className="text-xs text-muted-foreground space-y-1 border-t border-border/40 pt-2">
                <p>
                  <span className="font-medium text-foreground">Administration Status:</span>{' '}
                  <span className="capitalize font-semibold">{detailOrder.administration_status?.replace(/_/g, ' ') || 'Pending'}</span>
                </p>
                {detailOrder.administered_by && (
                  <p>
                    <span className="font-medium text-foreground">Administered By:</span> {detailOrder.administered_by} on {detailOrder.administered_date}
                  </p>
                )}
              </div>

              {/* Actions inside modal */}
              <div className="flex items-center justify-end gap-2 pt-2">
                {(detailOrder.payment_status === 'pending_payment' || detailOrder.payment_status === 'pending') && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        handleWaiveOrder(detailOrder);
                        setDetailOrder(null);
                      }}
                    >
                      Waive Payment
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => {
                        handleOpenPayment(detailOrder);
                        setDetailOrder(null);
                      }}
                    >
                      <DollarSign className="w-3.5 h-3.5 mr-1" />
                      Collect Payment
                    </Button>
                  </>
                )}

                {detailOrder.payment_status === 'paid' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs border-border/60"
                    onClick={() => {
                      setActiveReceipt({
                        receipt_number: detailOrder.receipt_number || `RCP-MED-${detailOrder.id.slice(0, 6)}`,
                        amount: Number(detailOrder.total_price) || Number(detailOrder.unit_price) || 0,
                        patient_name: detailOrder.patient_name,
                        description: `Medication: ${detailOrder.item_name}`,
                        paid_date: detailOrder.paid_date || format(new Date(), 'yyyy-MM-dd'),
                        cashier_name: detailOrder.paid_by || 'Hospital Cashier',
                        payment_method: detailOrder.payment_method || 'cash',
                        payment_type: 'medicine'
                      });
                      setDetailOrder(null);
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

      {/* Collect Payment Modal */}
      <Dialog open={!!paymentOrder} onOpenChange={open => !open && setPaymentOrder(null)}>
        <DialogContent className="max-w-md bg-card border-border/60 shadow-card">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-bold text-foreground flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Collect Medication Payment
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Confirm patient payment to release this medication order to the Nurse Room
            </DialogDescription>
          </DialogHeader>

          {paymentOrder && (
            <div className="space-y-4 pt-2">
              {/* Order Info Summary */}
              <div className="bg-muted/40 rounded-xl p-3.5 border border-border/60 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Patient:</span>
                  <span className="font-semibold text-foreground">{paymentOrder.patient_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Patient ID:</span>
                  <span className="font-mono text-xs font-bold text-primary">{getPatientCode(paymentOrder)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Medication:</span>
                  <span className="font-medium text-foreground">{paymentOrder.item_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Prescribed By:</span>
                  <span className="text-foreground">
                    {paymentOrder.doctor_name ? `Dr. ${paymentOrder.doctor_name}` : 'Staff Doctor'}
                  </span>
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-1.5">
                <Label htmlFor="customPrice" className="text-xs font-medium">Settlement Amount (ETB) *</Label>
                <div className="relative">
                  <Input
                    id="customPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    className="pl-8 text-lg font-bold font-heading bg-background border-border/60"
                    value={customPrice}
                    onChange={e => setCustomPrice(e.target.value)}
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                    ETB
                  </span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Payment Method *</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="bg-background border-border/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash Payment</SelectItem>
                    <SelectItem value="telebirr">Telebirr SuperApp</SelectItem>
                    <SelectItem value="cbe_birr">CBE Birr</SelectItem>
                    <SelectItem value="card">Debit / Credit Card (POS)</SelectItem>
                    <SelectItem value="mobile_banking">Mobile Banking / Transfer</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="insurance">Insurance Coverage</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaymentOrder(null)}
                  disabled={isProcessing}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={handleConfirmPayment}
                  disabled={isProcessing || !customPrice || parseFloat(customPrice) < 0}
                >
                  <Receipt className="w-4 h-4 mr-1.5" />
                  {isProcessing ? 'Processing Payment...' : 'Confirm & Generate Receipt'}
                </Button>
              </div>
            </div>
          )}
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