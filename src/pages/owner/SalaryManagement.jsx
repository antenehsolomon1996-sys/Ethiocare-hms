import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { salaryService } from '@/services/salary.service';
import { useAuth } from '@/lib/AuthContext';
import {
  DollarSign,
  Users,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Building,
  CreditCard,
  History,
  FileCheck2,
  SendHorizontal
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { format, subMonths } from 'date-fns';

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'telebirr', label: 'Telebirr' },
  { value: 'cbe_birr', label: 'CBE Birr' },
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'other', label: 'Other' },
];

export default function SalaryManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Period selector: e.g. '2026-09'
  const currentMonthPeriod = format(new Date(), 'yyyy-MM');
  const [selectedPeriod, setSelectedPeriod] = useState(currentMonthPeriod);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Month period options: last 6 months
  const periodOptions = useMemo(() => {
    const opts = [];
    for (let i = 0; i < 6; i++) {
      const d = subMonths(new Date(), i);
      opts.push({
        value: format(d, 'yyyy-MM'),
        label: format(d, 'MMMM yyyy'),
      });
    }
    return opts;
  }, []);

  // Queries
  const {
    data: staffSalaries = [],
    isLoading: loadingSalaries,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['employeeSalaries'],
    queryFn: () => salaryService.listEmployeeSalaries(),
  });

  const {
    data: payments = [],
    isLoading: loadingPayments,
  } = useQuery({
    queryKey: ['salaryPayments', selectedPeriod],
    queryFn: () => salaryService.listSalaryPayments(selectedPeriod),
  });

  const {
    data: dueAlerts = [],
  } = useQuery({
    queryKey: ['salaryDueAlerts'],
    queryFn: () => salaryService.getSalaryDueNotifications(new Date()),
  });

  // State for Config Modal
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [configForm, setConfigForm] = useState({
    staff_id: '',
    employee_name: '',
    role: '',
    department: '',
    base_salary: '',
    payday_of_month: 28,
    payment_frequency: 'monthly',
    payment_method: 'bank_transfer',
    bank_name: 'Commercial Bank of Ethiopia',
    bank_account: '',
    status: 'active',
  });

  // State for Disburse Modal
  const [disburseModalOpen, setDisburseModalOpen] = useState(false);
  const [disburseTarget, setDisburseTarget] = useState(null);
  const [disburseForm, setDisburseForm] = useState({
    base_salary: 0,
    allowances: '',
    deductions: '',
    amount_paid: '',
    payment_method: 'bank_transfer',
    transaction_reference: '',
    payment_date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
  });

  // State for History Modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyStaff, setHistoryStaff] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Group payments by staff_id for the selected period
  const paymentsByStaff = useMemo(() => {
    const map = new Map();
    for (const p of payments) {
      const current = map.get(p.staff_id) || [];
      current.push(p);
      map.set(p.staff_id, current);
    }
    return map;
  }, [payments]);

  // Overall calculations for selected period
  const periodMetrics = useMemo(() => {
    let totalBudget = 0;
    let totalPaid = 0;

    for (const s of staffSalaries) {
      if (s.status === 'inactive') continue;
      totalBudget += Number(s.base_salary) || 0;

      const staffPays = paymentsByStaff.get(s.staff_id) || [];
      const paid = staffPays.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);
      totalPaid += paid;
    }

    const totalRemaining = Math.max(0, totalBudget - totalPaid);
    return {
      totalBudget,
      totalPaid,
      totalRemaining,
      paidCount: staffSalaries.filter(s => {
        const staffPays = paymentsByStaff.get(s.staff_id) || [];
        const paid = staffPays.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);
        return (s.base_salary || 0) > 0 && paid >= s.base_salary;
      }).length,
    };
  }, [staffSalaries, paymentsByStaff]);

  // Config Modal actions
  const openConfigModal = (item) => {
    setEditingConfig(item);
    setConfigForm({
      id: item.id,
      staff_id: item.staff_id,
      employee_name: item.employee_name,
      role: item.role,
      department: item.department || '',
      base_salary: String(item.base_salary || 0),
      payday_of_month: item.payday_of_month || 28,
      payment_frequency: item.payment_frequency || 'monthly',
      payment_method: item.payment_method || 'bank_transfer',
      bank_name: item.bank_name || 'Commercial Bank of Ethiopia',
      bank_account: item.bank_account || '',
      status: item.status || 'active',
    });
    setConfigModalOpen(true);
  };

  const handleSaveConfig = async () => {
    const baseAmt = parseFloat(configForm.base_salary);
    if (isNaN(baseAmt) || baseAmt < 0) {
      toast.error('Please enter a valid base salary');
      return;
    }

    setIsSubmitting(true);
    try {
      await salaryService.saveSalaryConfig(
        {
          ...configForm,
          base_salary: baseAmt,
          payday_of_month: parseInt(String(configForm.payday_of_month)) || 28,
        },
        user?.full_name || 'Owner/Admin'
      );
      toast.success(`Salary settings updated for ${configForm.employee_name}`);
      setConfigModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['employeeSalaries'] });
      queryClient.invalidateQueries({ queryKey: ['salaryDueAlerts'] });
    } catch (err) {
      toast.error(err.message || 'Failed to save salary config');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Disburse Modal actions
  const openDisburseModal = (item) => {
    setDisburseTarget(item);
    const base = Number(item.base_salary) || 0;
    const staffPays = paymentsByStaff.get(item.staff_id) || [];
    const alreadyPaid = staffPays.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);
    const initialAmount = Math.max(0, base - alreadyPaid);

    setDisburseForm({
      base_salary: base,
      allowances: '',
      deductions: '',
      amount_paid: String(initialAmount),
      payment_method: item.payment_method || 'bank_transfer',
      transaction_reference: '',
      payment_date: format(new Date(), 'yyyy-MM-dd'),
      notes: '',
    });
    setDisburseModalOpen(true);
  };

  const netPayableCalc = useMemo(() => {
    const base = Number(disburseForm.base_salary) || 0;
    const allow = Number(disburseForm.allowances) || 0;
    const ded = Number(disburseForm.deductions) || 0;
    return Math.max(0, base + allow - ded);
  }, [disburseForm.base_salary, disburseForm.allowances, disburseForm.deductions]);

  const remainingAfterPayment = useMemo(() => {
    const paid = Number(disburseForm.amount_paid) || 0;
    return Math.max(0, netPayableCalc - paid);
  }, [netPayableCalc, disburseForm.amount_paid]);

  const handleDisburseSalary = async () => {
    if (!disburseTarget) return;
    const amt = parseFloat(disburseForm.amount_paid);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid amount to disburse');
      return;
    }

    setIsSubmitting(true);
    try {
      await salaryService.disburseSalary(
        {
          employee_salary_id: disburseTarget.id,
          staff_id: disburseTarget.staff_id,
          employee_name: disburseTarget.employee_name,
          salary_period: selectedPeriod,
          base_salary: Number(disburseForm.base_salary),
          allowances: Number(disburseForm.allowances || 0),
          deductions: Number(disburseForm.deductions || 0),
          net_payable: netPayableCalc,
          amount_paid: amt,
          remaining_amount: remainingAfterPayment,
          payment_method: disburseForm.payment_method,
          transaction_reference: disburseForm.transaction_reference?.trim() || null,
          payment_date: disburseForm.payment_date,
          notes: disburseForm.notes?.trim() || null,
          recorded_by: user?.full_name || 'Owner/Admin',
        },
        user?.full_name || 'Owner/Admin'
      );

      toast.success(
        `Disbursed ${amt.toLocaleString()} ETB to ${disburseTarget.employee_name}! Logged in Operating Expenses.`
      );
      setDisburseModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['salaryPayments'] });
      queryClient.invalidateQueries({ queryKey: ['salaryDueAlerts'] });
      queryClient.invalidateQueries({ queryKey: ['financialSummary'] });
    } catch (err) {
      toast.error(err.message || 'Failed to disburse salary');
    } finally {
      setIsSubmitting(false);
    }
  };

  // History view action
  const openHistory = (item) => {
    setHistoryStaff(item);
    setHistoryModalOpen(true);
  };

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffSalaries.filter((s) => {
      if (roleFilter !== 'all' && s.role !== roleFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = s.employee_name?.toLowerCase().includes(q);
        const matchRole = s.role?.toLowerCase().includes(q);
        const matchDept = s.department?.toLowerCase().includes(q);
        if (!matchName && !matchRole && !matchDept) return false;
      }
      return true;
    });
  }, [staffSalaries, roleFilter, searchTerm]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight font-heading">Employee Salary Tracker</h1>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs">
              Owner Management
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage staff base pay, disbursement dates, remaining obligations, and automated payroll expense logging.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Period selector */}
          <div className="flex items-center gap-1.5 bg-card border border-border/60 rounded-lg p-1">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground ml-1" />
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="border-0 shadow-none h-7 text-xs font-semibold focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((p) => (
                  <SelectItem key={p.value} value={p.value} className="text-xs">
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Salary Due Notifications Banner (Upcoming Paydays) */}
      {dueAlerts.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <CardTitle className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                  Salary Due Notifications ({dueAlerts.length})
                </CardTitle>
              </div>
              <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                Cycle: {format(new Date(), 'MMMM yyyy')}
              </span>
            </div>
            <CardDescription className="text-xs text-amber-800/80 dark:text-amber-400/80">
              Staff members with approaching or overdue payday disbursements for this payroll cycle.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {dueAlerts.map((alert) => {
                const isOverdue = alert.urgency === 'overdue';
                const isToday = alert.urgency === 'due_today';

                return (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-lg border text-xs flex flex-col justify-between gap-2 ${
                      isOverdue
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-300'
                        : isToday
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-300'
                        : 'bg-background border-border/60 text-foreground'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold truncate">{alert.employeeName}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] py-0 px-1.5 capitalize font-medium ${
                            isOverdue
                              ? 'border-rose-500/40 text-rose-600 bg-rose-500/10'
                              : isToday
                              ? 'border-amber-500/40 text-amber-600 bg-amber-500/10'
                              : 'border-blue-500/40 text-blue-600 bg-blue-500/10'
                          }`}
                        >
                          {alert.urgencyLabel}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1 capitalize">
                        {alert.role.replace(/_/g, ' ')} • Payday: {alert.paydayOfMonth}th of month
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border/40">
                      <div>
                        <span className="text-[10px] text-muted-foreground">Remaining: </span>
                        <span className="font-bold text-primary">{alert.remainingUnpaid.toLocaleString()} ETB</span>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-6 text-[11px] px-2"
                        onClick={() => {
                          const target = staffSalaries.find((s) => s.staff_id === alert.staffId);
                          if (target) openDisburseModal(target);
                        }}
                      >
                        Disburse
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly Salary KPI Blocks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Salary Budget */}
        <Card className="border-border/60 shadow-sm">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payroll Budget</span>
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold text-foreground">
                {periodMetrics.totalBudget.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">ETB</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total monthly base commitment for {staffSalaries.length} staff
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Total Paid This Period */}
        <Card className="border-border/60 shadow-sm">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Disbursed ({selectedPeriod})</span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold text-emerald-600">
                {periodMetrics.totalPaid.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">ETB</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {periodMetrics.paidCount} staff paid in full for this period
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Total Remaining Unpaid */}
        <Card className="border-border/60 shadow-sm">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Remaining Unpaid</span>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold text-amber-600">
                {periodMetrics.totalRemaining.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">ETB</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Pending payroll disbursements for period
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Active Staff Count */}
        <Card className="border-border/60 shadow-sm">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Staff Registered</span>
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {staffSalaries.length} <span className="text-sm font-normal text-muted-foreground">Employees</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                100% synchronized with Staff Directory
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Staff Salary Directory & Payroll Table */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold">Staff Salary Directory</CardTitle>
              <CardDescription className="text-xs">
                Configure employee contracts, salary amounts, paydays, and disburse period wages.
              </CardDescription>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Search staff or role..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>

              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="doctor">Doctors</SelectItem>
                  <SelectItem value="nurse">Nurses</SelectItem>
                  <SelectItem value="receptionist">Receptionists</SelectItem>
                  <SelectItem value="pharmacist">Pharmacists</SelectItem>
                  <SelectItem value="lab_technician">Lab Techs</SelectItem>
                  <SelectItem value="accountant">Accountants</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-md border border-border/60 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 text-xs">
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Base Salary &amp; Payday</TableHead>
                  <TableHead>Disbursed &amp; Balance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingSalaries ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">
                      Loading staff salary records...
                    </TableCell>
                  </TableRow>
                ) : filteredStaff.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">
                      No staff members found matching your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStaff.map((staff) => {
                    const staffPays = paymentsByStaff.get(staff.staff_id) || [];
                    const paidThisPeriod = staffPays.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);
                    const remaining = Math.max(0, (Number(staff.base_salary) || 0) - paidThisPeriod);
                    const isFullyPaid = (Number(staff.base_salary) || 0) > 0 && remaining <= 0;
                    const isPartial = paidThisPeriod > 0 && remaining > 0;

                    return (
                      <TableRow key={staff.staff_id} className="text-xs hover:bg-muted/30">
                        {/* 1. Staff Member */}
                        <TableCell>
                          <div className="font-semibold text-foreground">{staff.employee_name}</div>
                          <div className="text-[11px] text-muted-foreground capitalize">
                            {staff.role?.replace(/_/g, ' ')} · {staff.department}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[140px]">
                            {staff.bank_name || 'Bank N/A'}
                          </div>
                        </TableCell>

                        {/* 2. Base Salary & Payday */}
                        <TableCell>
                          <div className="font-semibold text-foreground text-sm">
                            {Number(staff.base_salary || 0).toLocaleString()} ETB
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            Payday: {staff.payday_of_month || 28}th of month
                          </span>
                        </TableCell>

                        {/* 3. Disbursed & Balance */}
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-emerald-600 font-semibold text-xs">
                                {paidThisPeriod > 0 ? `+${paidThisPeriod.toLocaleString()} ETB` : '0 ETB'}
                              </span>
                              <span className={`text-[11px] ${remaining > 0 ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>
                                Rem: {remaining.toLocaleString()} ETB
                              </span>
                            </div>
                            <div>
                              {isFullyPaid ? (
                                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 text-[9px] py-0">
                                  Paid in Full
                                </Badge>
                              ) : isPartial ? (
                                <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-600 text-[9px] py-0">
                                  Partial Paid
                                </Badge>
                              ) : staff.base_salary > 0 ? (
                                <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 text-[9px] py-0">
                                  Unpaid
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[9px] text-muted-foreground py-0">
                                  Not Configured
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* 4. Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 text-xs px-2.5 bg-primary hover:bg-primary/90"
                              onClick={() => openDisburseModal(staff)}
                            >
                              <SendHorizontal className="w-3 h-3 mr-1" />
                              Disburse
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => openConfigModal(staff)}
                              title="Edit Salary Settings"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => openHistory(staff)}
                              title="View Payment History"
                            >
                              <History className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Salary Disbursement Modal */}
      <Dialog open={disburseModalOpen} onOpenChange={setDisburseModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Disburse Staff Salary</DialogTitle>
            <DialogDescription className="text-xs">
              Process salary disbursement for <strong>{disburseTarget?.employee_name}</strong> for period <strong>{selectedPeriod}</strong>. This automatically generates a matching Operating Expense record.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            {/* Employee summary pill */}
            <div className="p-2.5 bg-primary/5 border border-primary/20 rounded-lg flex items-center justify-between text-xs">
              <div>
                <span className="font-semibold text-foreground">{disburseTarget?.employee_name}</span>
                <span className="text-muted-foreground ml-2 capitalize">({disburseTarget?.role?.replace(/_/g, ' ')})</span>
              </div>
              <div className="font-mono text-muted-foreground">
                Payday: {disburseTarget?.payday_of_month}th
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Base Salary (ETB)</Label>
                <Input
                  type="number"
                  value={disburseForm.base_salary}
                  disabled
                  className="text-xs mt-1 bg-muted/40 font-semibold"
                />
              </div>

              <div>
                <Label className="text-xs">Allowances / Bonus</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0.00"
                  value={disburseForm.allowances}
                  onChange={(e) => setDisburseForm({ ...disburseForm, allowances: e.target.value })}
                  className="text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs">Deductions (Tax, Adv)</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0.00"
                  value={disburseForm.deductions}
                  onChange={(e) => setDisburseForm({ ...disburseForm, deductions: e.target.value })}
                  className="text-xs mt-1"
                />
              </div>
            </div>

            {/* Net Payable Banner */}
            <div className="p-3 bg-muted/40 border border-border/60 rounded-lg flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Net Calculated Payable</div>
                <div className="text-lg font-bold text-foreground">
                  {netPayableCalc.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">ETB</span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs text-muted-foreground">Balance After Payment</div>
                <div className={`text-lg font-bold ${remainingAfterPayment > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {remainingAfterPayment.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">ETB</span>
                </div>
              </div>
            </div>

            {/* Payment Details */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Amount to Pay Now (ETB) *</Label>
                <Input
                  type="number"
                  min="1"
                  value={disburseForm.amount_paid}
                  onChange={(e) => setDisburseForm({ ...disburseForm, amount_paid: e.target.value })}
                  className="text-xs mt-1 font-bold text-primary"
                />
              </div>

              <div>
                <Label className="text-xs">Disbursement Method</Label>
                <Select
                  value={disburseForm.payment_method}
                  onValueChange={(v) => setDisburseForm({ ...disburseForm, payment_method: v })}
                >
                  <SelectTrigger className="text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value} className="text-xs">
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Payment Date</Label>
                <Input
                  type="date"
                  value={disburseForm.payment_date}
                  onChange={(e) => setDisburseForm({ ...disburseForm, payment_date: e.target.value })}
                  className="text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs">Bank Transfer Ref / Voucher #</Label>
                <Input
                  placeholder="e.g. TXN-10029384"
                  value={disburseForm.transaction_reference}
                  onChange={(e) => setDisburseForm({ ...disburseForm, transaction_reference: e.target.value })}
                  className="text-xs mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Payroll Notes / Comments (Optional)</Label>
              <Textarea
                placeholder="Disbursement rationale, deductions breakdown, notes..."
                value={disburseForm.notes}
                onChange={(e) => setDisburseForm({ ...disburseForm, notes: e.target.value })}
                className="text-xs mt-1 min-h-[60px]"
              />
            </div>
          </div>

          <DialogFooter className="pt-3">
            <Button variant="outline" size="sm" onClick={() => setDisburseModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleDisburseSalary}
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSubmitting ? 'Processing...' : 'Confirm & Disburse Salary'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Salary Configuration Modal */}
      <Dialog open={configModalOpen} onOpenChange={setConfigModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configure Staff Salary</DialogTitle>
            <DialogDescription className="text-xs">
              Set base monthly compensation, disbursement day, and banking details.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-xs">Employee Name</Label>
              <Input value={configForm.employee_name} disabled className="text-xs mt-1 bg-muted/40 font-semibold" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Base Salary (ETB) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="100"
                  value={configForm.base_salary}
                  onChange={(e) => setConfigForm({ ...configForm, base_salary: e.target.value })}
                  className="text-xs mt-1 font-semibold"
                />
              </div>

              <div>
                <Label className="text-xs">Payday Day of Month (1-31) *</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={configForm.payday_of_month}
                  onChange={(e) => setConfigForm({ ...configForm, payday_of_month: e.target.value })}
                  className="text-xs mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Payment Frequency</Label>
                <Select
                  value={configForm.payment_frequency}
                  onValueChange={(v) => setConfigForm({ ...configForm, payment_frequency: v })}
                >
                  <SelectTrigger className="text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly" className="text-xs">Monthly</SelectItem>
                    <SelectItem value="bi-weekly" className="text-xs">Bi-Weekly</SelectItem>
                    <SelectItem value="weekly" className="text-xs">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Preferred Method</Label>
                <Select
                  value={configForm.payment_method}
                  onValueChange={(v) => setConfigForm({ ...configForm, payment_method: v })}
                >
                  <SelectTrigger className="text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value} className="text-xs">
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Bank Name / Provider</Label>
                <Input
                  placeholder="e.g. Commercial Bank of Ethiopia"
                  value={configForm.bank_name}
                  onChange={(e) => setConfigForm({ ...configForm, bank_name: e.target.value })}
                  className="text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs">Account / Mobile Number</Label>
                <Input
                  placeholder="e.g. 1000123456789"
                  value={configForm.bank_account}
                  onChange={(e) => setConfigForm({ ...configForm, bank_account: e.target.value })}
                  className="text-xs mt-1"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-3">
            <Button variant="outline" size="sm" onClick={() => setConfigModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveConfig} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Configuration'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment History Modal */}
      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Disbursement History: {historyStaff?.employee_name}</DialogTitle>
            <DialogDescription className="text-xs">
              Complete log of past payroll disbursements for this employee.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2 max-h-[350px] overflow-y-auto">
            {payments.filter((p) => p.staff_id === historyStaff?.staff_id).length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                No disbursements recorded for {historyStaff?.employee_name} in {selectedPeriod}.
              </p>
            ) : (
              <div className="rounded-md border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 text-xs">
                      <TableHead>Date &amp; Period</TableHead>
                      <TableHead>Paid (ETB)</TableHead>
                      <TableHead>Remaining</TableHead>
                      <TableHead>Reference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments
                      .filter((p) => p.staff_id === historyStaff?.staff_id)
                      .map((p) => (
                        <TableRow key={p.id} className="text-xs">
                          <TableCell>
                            <span className="font-mono text-muted-foreground block">{p.payment_date}</span>
                            <span className="text-[11px] text-foreground font-medium">{p.salary_period}</span>
                          </TableCell>
                          <TableCell className="font-semibold text-emerald-600">
                            {Number(p.amount_paid).toLocaleString()} ETB
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {Number(p.remaining_amount || 0).toLocaleString()} ETB
                          </TableCell>
                          <TableCell className="font-mono text-[11px] text-muted-foreground">
                            {p.transaction_reference || 'Voucher Auto'}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setHistoryModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
