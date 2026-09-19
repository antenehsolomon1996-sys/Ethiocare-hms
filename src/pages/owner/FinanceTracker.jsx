import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { financeService } from '@/services/finance.service';
import { useAuth } from '@/lib/AuthContext';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Wallet,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Search,
  Pencil,
  Trash2,
  RefreshCw,
  FileText,
  CreditCard,
  Building2,
  CheckCircle2,
  Eye
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
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { toast } from 'sonner';
import { format } from 'date-fns';

const EXPENSE_CATEGORIES = [
  { value: 'salaries', label: 'Staff Salaries & Wages' },
  { value: 'medical_supplies', label: 'Medical Supplies & PPE' },
  { value: 'pharmacy_purchase', label: 'Pharmacy Bulk Stock' },
  { value: 'utilities', label: 'Utilities (Water, Power, Net)' },
  { value: 'maintenance', label: 'Facility Maintenance & Repairs' },
  { value: 'rent', label: 'Building & Land Rent' },
  { value: 'equipment', label: 'Medical Equipment & Depreciation' },
  { value: 'administrative', label: 'Administrative & Legal' },
  { value: 'other', label: 'Other Operating Expenses' },
];

const INCOME_SOURCES = [
  { value: 'cafeteria', label: 'Hospital Cafeteria' },
  { value: 'grants', label: 'Government & NGO Grants' },
  { value: 'ambulance', label: 'Ambulance & Transfer Services' },
  { value: 'rent', label: 'Facility Sub-Leasing' },
  { value: 'donations', label: 'Philanthropic Donations' },
  { value: 'other', label: 'Miscellaneous Other Income' },
];

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'telebirr', label: 'Telebirr' },
  { value: 'cbe_birr', label: 'CBE Birr' },
  { value: 'check', label: 'Check' },
  { value: 'other', label: 'Other' },
];

export default function FinanceTracker() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: summary,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['financialSummary'],
    queryFn: () => financeService.getFinancialSummary(),
  });

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // all | income | expense
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [chartTab, setChartTab] = useState('daily');

  // Modals state
  const [detailTx, setDetailTx] = useState(null);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    amount: '',
    category: 'utilities',
    payment_method: 'cash',
    expense_date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
  });

  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState(null);
  const [incomeForm, setIncomeForm] = useState({
    title: '',
    amount: '',
    source: 'cafeteria',
    payment_method: 'cash',
    income_date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
  });

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Expense handlers
  const openNewExpense = () => {
    setEditingExpense(null);
    setExpenseForm({
      title: '',
      amount: '',
      category: 'utilities',
      payment_method: 'cash',
      expense_date: format(new Date(), 'yyyy-MM-dd'),
      description: '',
    });
    setExpenseModalOpen(true);
  };

  const openEditExpense = (item) => {
    setEditingExpense(item);
    setExpenseForm({
      title: item.title,
      amount: String(item.amount),
      category: item.sourceOrCategory,
      payment_method: item.paymentMethod,
      expense_date: item.date,
      description: item.description || '',
    });
    setExpenseModalOpen(true);
  };

  const handleSaveExpense = async () => {
    if (!expenseForm.title?.trim() || !expenseForm.amount) {
      toast.error('Title and amount are required');
      return;
    }
    const amt = parseFloat(expenseForm.amount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid positive amount');
      return;
    }

    setIsSaving(true);
    try {
      if (editingExpense) {
        await financeService.updateExpense(
          editingExpense.id,
          {
            title: expenseForm.title.trim(),
            amount: amt,
            category: expenseForm.category,
            payment_method: expenseForm.payment_method,
            expense_date: expenseForm.expense_date,
            description: expenseForm.description?.trim() || null,
          },
          user?.full_name || 'Owner/Admin'
        );
        toast.success('Expense updated successfully');
      } else {
        await financeService.createExpense(
          {
            title: expenseForm.title.trim(),
            amount: amt,
            category: expenseForm.category,
            payment_method: expenseForm.payment_method,
            expense_date: expenseForm.expense_date,
            description: expenseForm.description?.trim() || null,
          },
          user?.full_name || 'Owner/Admin'
        );
        toast.success('Expense recorded successfully');
      }
      setExpenseModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['financialSummary'] });
    } catch (err) {
      toast.error(err.message || 'Failed to save expense');
    } finally {
      setIsSaving(false);
    }
  };

  // Other Income handlers
  const openNewIncome = () => {
    setEditingIncome(null);
    setIncomeForm({
      title: '',
      amount: '',
      source: 'cafeteria',
      payment_method: 'cash',
      income_date: format(new Date(), 'yyyy-MM-dd'),
      description: '',
    });
    setIncomeModalOpen(true);
  };

  const openEditIncome = (item) => {
    setEditingIncome(item);
    setIncomeForm({
      title: item.title,
      amount: String(item.amount),
      source: item.sourceOrCategory,
      payment_method: item.paymentMethod,
      income_date: item.date,
      description: item.description || '',
    });
    setIncomeModalOpen(true);
  };

  const handleSaveIncome = async () => {
    if (!incomeForm.title?.trim() || !incomeForm.amount) {
      toast.error('Title and amount are required');
      return;
    }
    const amt = parseFloat(incomeForm.amount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid positive amount');
      return;
    }

    setIsSaving(true);
    try {
      if (editingIncome) {
        await financeService.updateOtherIncome(
          editingIncome.id,
          {
            title: incomeForm.title.trim(),
            amount: amt,
            source: incomeForm.source,
            payment_method: incomeForm.payment_method,
            income_date: incomeForm.income_date,
            description: incomeForm.description?.trim() || null,
          },
          user?.full_name || 'Owner/Admin'
        );
        toast.success('Income entry updated');
      } else {
        await financeService.createOtherIncome(
          {
            title: incomeForm.title.trim(),
            amount: amt,
            source: incomeForm.source,
            payment_method: incomeForm.payment_method,
            income_date: incomeForm.income_date,
            description: incomeForm.description?.trim() || null,
          },
          user?.full_name || 'Owner/Admin'
        );
        toast.success('Other income recorded');
      }
      setIncomeModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['financialSummary'] });
    } catch (err) {
      toast.error(err.message || 'Failed to save income');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete handler
  const confirmDelete = (item) => {
    setItemToDelete(item);
    setDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    setIsSaving(true);
    try {
      if (itemToDelete.entityName === 'Expense') {
        await financeService.deleteExpense(itemToDelete.id, user?.full_name || 'Owner/Admin');
        toast.success('Expense record deleted');
      } else if (itemToDelete.entityName === 'OtherIncome') {
        await financeService.deleteOtherIncome(itemToDelete.id, user?.full_name || 'Owner/Admin');
        toast.success('Income record deleted');
      }
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['financialSummary'] });
    } catch (err) {
      toast.error(err.message || 'Failed to delete record');
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    if (!summary?.transactions) return [];

    return summary.transactions.filter((t) => {
      // Type filter
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;

      // Category filter
      if (categoryFilter !== 'all' && t.sourceOrCategory !== categoryFilter) return false;

      // Search filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchTitle = t.title?.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q);
        const matchSource = t.sourceOrCategory?.toLowerCase().includes(q);
        const matchPerson = t.recordedBy?.toLowerCase().includes(q);
        const matchMethod = t.paymentMethod?.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchSource && !matchPerson && !matchMethod) {
          return false;
        }
      }

      return true;
    });
  }, [summary?.transactions, typeFilter, categoryFilter, searchTerm]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight font-heading">Hospital Finance Tracker</h1>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs">
              Live Ledger
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time income, operating expenses, and net margins across all EthioCare departments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

          <Button
            variant="outline"
            size="sm"
            onClick={openNewIncome}
            className="gap-1.5 text-xs border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
          >
            <Plus className="w-3.5 h-3.5" />
            + Other Income
          </Button>

          <Button
            size="sm"
            onClick={openNewExpense}
            className="gap-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white"
          >
            <Plus className="w-3.5 h-3.5" />
            + Record Expense
          </Button>
        </div>
      </div>

      {/* KPI Cards: Today, This Week, This Month, Total */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today */}
        <Card className="border-border/60 shadow-sm">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Today's Net</span>
              <div className={`p-2 rounded-lg ${(summary?.today.net ?? 0) >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                {(summary?.today.net ?? 0) >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              </div>
            </div>
            <div className="mt-2">
              <div className={`text-2xl font-bold ${(summary?.today.net ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {(summary?.today.net ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-sm font-normal text-muted-foreground">ETB</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 pt-2 border-t border-border/40">
                <span className="text-emerald-600 font-medium">In: +{(summary?.today.income ?? 0).toLocaleString()} ETB</span>
                <span className="text-rose-600 font-medium">Out: -{(summary?.today.expense ?? 0).toLocaleString()} ETB</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* This Week */}
        <Card className="border-border/60 shadow-sm">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">This Week's Net</span>
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className={`text-2xl font-bold ${(summary?.thisWeek.net ?? 0) >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600'}`}>
                {(summary?.thisWeek.net ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-sm font-normal text-muted-foreground">ETB</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 pt-2 border-t border-border/40">
                <span className="text-emerald-600 font-medium">In: +{(summary?.thisWeek.income ?? 0).toLocaleString()} ETB</span>
                <span className="text-rose-600 font-medium">Out: -{(summary?.thisWeek.expense ?? 0).toLocaleString()} ETB</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* This Month */}
        <Card className="border-border/60 shadow-sm">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">This Month's Net</span>
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className={`text-2xl font-bold ${(summary?.thisMonth.net ?? 0) >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-rose-600'}`}>
                {(summary?.thisMonth.net ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-sm font-normal text-muted-foreground">ETB</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 pt-2 border-t border-border/40">
                <span className="text-emerald-600 font-medium">In: +{(summary?.thisMonth.income ?? 0).toLocaleString()} ETB</span>
                <span className="text-rose-600 font-medium">Out: -{(summary?.thisMonth.expense ?? 0).toLocaleString()} ETB</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Net */}
        <Card className="border-border/60 shadow-sm bg-primary/[0.02]">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">All-Time Net Profit</span>
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className={`text-2xl font-bold ${(summary?.total.net ?? 0) >= 0 ? 'text-primary' : 'text-rose-600'}`}>
                {(summary?.total.net ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-sm font-normal text-muted-foreground">ETB</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 pt-2 border-t border-border/40">
                <span className="text-emerald-600 font-medium">In: {(summary?.total.income ?? 0).toLocaleString()} ETB</span>
                <span className="text-rose-600 font-medium">Out: {(summary?.total.expense ?? 0).toLocaleString()} ETB</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart Section */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-semibold">Cashflow &amp; Net Performance Trend</CardTitle>
              <CardDescription className="text-xs">
                Visualizing hospital revenue vs operational expenses and resulting net profit margin.
              </CardDescription>
            </div>
            <Tabs value={chartTab} onValueChange={setChartTab} className="w-auto">
              <TabsList className="h-8">
                <TabsTrigger value="daily" className="text-xs px-3">14-Day Daily</TabsTrigger>
                <TabsTrigger value="monthly" className="text-xs px-3">6-Month Monthly</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartTab === 'daily' ? summary?.dailyTrend || [] : summary?.monthlyTrend || []}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="label" fontSize={11} tickLine={false} />
                <YAxis fontSize={11} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip
                  formatter={(val, name) => [
                    `${Number(val).toLocaleString()} ETB`,
                    name === 'income' ? 'Income' : name === 'expense' ? 'Expenses' : 'Net Margin',
                  ]}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    borderColor: 'hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="net" name="Net Margin" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History Ledger */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold">Transaction Ledger</CardTitle>
              <CardDescription className="text-xs">
                Comprehensive audit trail of all incoming hospital revenue and operating disbursements.
              </CardDescription>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Search ledger..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[120px] h-8 text-xs">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="income">Income Only</SelectItem>
                  <SelectItem value="expense">Expense Only</SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[150px] h-8 text-xs">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="salaries">Salaries</SelectItem>
                  <SelectItem value="medical_supplies">Medical Supplies</SelectItem>
                  <SelectItem value="pharmacy_purchase">Pharmacy Stock</SelectItem>
                  <SelectItem value="utilities">Utilities</SelectItem>
                  <SelectItem value="registration">Registration</SelectItem>
                  <SelectItem value="laboratory">Laboratory</SelectItem>
                  <SelectItem value="pharmacy_walk_in">Walk-in Pharmacy</SelectItem>
                  <SelectItem value="cafeteria">Cafeteria</SelectItem>
                  <SelectItem value="grants">Grants</SelectItem>
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
                  <TableHead className="w-[140px]">Date &amp; Type</TableHead>
                  <TableHead>Category &amp; Description</TableHead>
                  <TableHead className="text-right w-[160px]">Amount &amp; Method</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">
                      Loading financial ledger...
                    </TableCell>
                  </TableRow>
                ) : filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">
                      No financial transactions match your criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((t) => (
                    <TableRow key={t.id} className="text-xs hover:bg-muted/30">
                      {/* 1. Date & Type */}
                      <TableCell>
                        <span className="font-mono text-muted-foreground block">{t.date}</span>
                        <div className="mt-1">
                          {t.type === 'income' ? (
                            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 gap-1 text-[10px] font-medium py-0">
                              <ArrowUpRight className="w-3 h-3" /> Income
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-600 gap-1 text-[10px] font-medium py-0">
                              <ArrowDownRight className="w-3 h-3" /> Expense
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* 2. Category & Description */}
                      <TableCell>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-foreground text-xs">{t.title}</span>
                          <Badge variant="secondary" className="capitalize text-[10px] py-0">
                            {t.sourceOrCategory.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        {t.description && (
                          <div className="text-[11px] text-muted-foreground truncate max-w-xs">
                            {t.description}
                          </div>
                        )}
                      </TableCell>

                      {/* 3. Amount & Method */}
                      <TableCell className="text-right">
                        <div className={`font-semibold font-mono text-sm ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {t.type === 'income' ? '+' : '-'}{t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
                        </div>
                        <span className="text-[11px] text-muted-foreground capitalize block">
                          {t.paymentMethod.replace(/_/g, ' ')}
                        </span>
                      </TableCell>

                      {/* 4. Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => setDetailTx(t)}
                            title="View Transaction Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          {t.canEdit && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => t.entityName === 'Expense' ? openEditExpense(t) : openEditIncome(t)}
                                title="Edit Record"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                onClick={() => confirmDelete(t)}
                                title="Delete Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Record / Edit Expense Modal */}
      <Dialog open={expenseModalOpen} onOpenChange={setExpenseModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingExpense ? 'Edit Expense Record' : 'Record Operating Expense'}</DialogTitle>
            <DialogDescription className="text-xs">
              Log facility costs, supplies, utilities, or operating overhead.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-xs">Expense Title *</Label>
              <Input
                placeholder="e.g. Oxygen Cylinder Refill / Power Bill"
                value={expenseForm.title}
                onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                className="text-xs mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Amount (ETB) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0.00"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  className="text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs">Category *</Label>
                <Select
                  value={expenseForm.category}
                  onValueChange={(v) => setExpenseForm({ ...expenseForm, category: v })}
                >
                  <SelectTrigger className="text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value} className="text-xs">
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Payment Method</Label>
                <Select
                  value={expenseForm.payment_method}
                  onValueChange={(v) => setExpenseForm({ ...expenseForm, payment_method: v })}
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

              <div>
                <Label className="text-xs">Expense Date</Label>
                <Input
                  type="date"
                  value={expenseForm.expense_date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                  className="text-xs mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Description / Supplier Notes (Optional)</Label>
              <Textarea
                placeholder="Details, invoice numbers, receipt voucher..."
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                className="text-xs mt-1 min-h-[70px]"
              />
            </div>
          </div>

          <DialogFooter className="pt-3">
            <Button variant="outline" size="sm" onClick={() => setExpenseModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveExpense} disabled={isSaving} className="bg-rose-600 hover:bg-rose-700 text-white">
              {isSaving ? 'Saving...' : editingExpense ? 'Save Changes' : 'Record Expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record / Edit Other Income Modal */}
      <Dialog open={incomeModalOpen} onOpenChange={setIncomeModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingIncome ? 'Edit Income Entry' : 'Record Other Hospital Income'}</DialogTitle>
            <DialogDescription className="text-xs">
              Log cafeteria sales, grants, donations, facility leases, or other non-patient revenues.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-xs">Income Title *</Label>
              <Input
                placeholder="e.g. Weekly Cafeteria Settlement / NGO Grant"
                value={incomeForm.title}
                onChange={(e) => setIncomeForm({ ...incomeForm, title: e.target.value })}
                className="text-xs mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Amount (ETB) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0.00"
                  value={incomeForm.amount}
                  onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })}
                  className="text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs">Income Source *</Label>
                <Select
                  value={incomeForm.source}
                  onValueChange={(v) => setIncomeForm({ ...incomeForm, source: v })}
                >
                  <SelectTrigger className="text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INCOME_SOURCES.map((s) => (
                      <SelectItem key={s.value} value={s.value} className="text-xs">
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Payment Method</Label>
                <Select
                  value={incomeForm.payment_method}
                  onValueChange={(v) => setIncomeForm({ ...incomeForm, payment_method: v })}
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

              <div>
                <Label className="text-xs">Income Date</Label>
                <Input
                  type="date"
                  value={incomeForm.income_date}
                  onChange={(e) => setIncomeForm({ ...incomeForm, income_date: e.target.value })}
                  className="text-xs mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Notes / Reference (Optional)</Label>
              <Textarea
                placeholder="Bank receipt, voucher reference, donor organization..."
                value={incomeForm.description}
                onChange={(e) => setIncomeForm({ ...incomeForm, description: e.target.value })}
                className="text-xs mt-1 min-h-[70px]"
              />
            </div>
          </div>

          <DialogFooter className="pt-3">
            <Button variant="outline" size="sm" onClick={() => setIncomeModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveIncome} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {isSaving ? 'Saving...' : editingIncome ? 'Save Changes' : 'Record Income'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Transaction Record</DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to delete this {itemToDelete?.type} entry ({itemToDelete?.title}) of {itemToDelete?.amount} ETB? This action will update financial metrics.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isSaving}>
              {isSaving ? 'Deleting...' : 'Confirm Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Transaction Details Dialog */}
      <Dialog open={!!detailTx} onOpenChange={(open) => !open && setDetailTx(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              Transaction Details
            </DialogTitle>
            <DialogDescription className="text-xs">
              Complete financial record and ledger audit info.
            </DialogDescription>
          </DialogHeader>
          {detailTx && (
            <div className="space-y-3 pt-2 text-xs">
              <div className="bg-muted/40 p-3 rounded-xl space-y-2 border border-border/60">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Record ID:</span>
                  <span className="font-mono text-[11px]">{detailTx.id}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Date:</span>
                  <span className="font-semibold">{detailTx.date}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Type:</span>
                  <Badge variant={detailTx.type === 'income' ? 'success' : 'destructive'} className="text-[10px] capitalize">
                    {detailTx.type}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Category / Source:</span>
                  <span className="capitalize font-medium">{detailTx.sourceOrCategory?.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Payment Method:</span>
                  <span className="capitalize font-medium">{detailTx.paymentMethod?.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Recorded By:</span>
                  <span>{detailTx.recordedBy || 'System / Auto'}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border/60">
                  <span className="text-muted-foreground font-semibold">Total Amount:</span>
                  <span className={`font-mono text-base font-bold ${detailTx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {detailTx.type === 'income' ? '+' : '-'}{detailTx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
                  </span>
                </div>
              </div>
              {detailTx.description && (
                <div className="p-3 bg-muted/20 rounded-xl border border-border/40">
                  <p className="text-muted-foreground font-medium mb-1">Description / Notes:</p>
                  <p className="text-foreground">{detailTx.description}</p>
                </div>
              )}
              <div className="flex justify-end pt-2">
                <Button variant="outline" size="sm" onClick={() => setDetailTx(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
