import { ethioCareClient } from '@/api/ethioCareClient';
import { pharmacySaleService } from '@/services/pharmacySale.service';
import { logAudit } from '@/lib/auditLogger';
import {
  format,
  isToday,
  isThisWeek,
  isThisMonth,
  subDays,
  startOfDay,
  parseISO,
  isValid
} from 'date-fns';

export interface ExpenseRecord {
  id?: string;
  category: 'salaries' | 'medical_supplies' | 'pharmacy_purchase' | 'utilities' | 'maintenance' | 'rent' | 'equipment' | 'administrative' | 'other';
  title: string;
  amount: number;
  payment_method: 'cash' | 'bank_transfer' | 'telebirr' | 'cbe_birr' | 'check' | 'other';
  expense_date: string;
  description?: string | null;
  recorded_by?: string;
  reference_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface OtherIncomeRecord {
  id?: string;
  source: 'cafeteria' | 'grants' | 'ambulance' | 'rent' | 'donations' | 'other';
  title: string;
  amount: number;
  payment_method: 'cash' | 'bank_transfer' | 'telebirr' | 'cbe_birr' | 'check' | 'other';
  income_date: string;
  description?: string | null;
  recorded_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MetricBlock {
  income: number;
  expense: number;
  net: number;
}

export interface TrendItem {
  date: string;
  label: string;
  income: number;
  expense: number;
  net: number;
}

export interface FinancialSummary {
  today: MetricBlock;
  thisWeek: MetricBlock;
  thisMonth: MetricBlock;
  total: MetricBlock;
  dailyTrend: TrendItem[];
  monthlyTrend: TrendItem[];
  expenseByCategory: Record<string, number>;
  incomeBySource: Record<string, number>;
  transactions: TransactionItem[];
}

export interface TransactionItem {
  id: string;
  type: 'income' | 'expense';
  sourceOrCategory: string;
  title: string;
  amount: number;
  paymentMethod: string;
  date: string;
  recordedBy: string;
  description?: string;
  referenceId?: string;
  canEdit: boolean;
  entityName: 'Expense' | 'OtherIncome' | 'Payment' | 'PharmacySale';
}

function parseItemDate(dateValue: any): Date {
  if (!dateValue) return new Date();
  if (dateValue instanceof Date) return dateValue;
  try {
    const d = parseISO(String(dateValue));
    return isValid(d) ? d : new Date();
  } catch {
    return new Date();
  }
}

export const financeService = {
  /**
   * Aggregate all revenues (hospital payments, walk-in pharmacy, other incomes)
   * and all expenses (salaries, supplies, overheads) into high-level metrics, trends, and ledger.
   */
  async getFinancialSummary(): Promise<FinancialSummary> {
    // 1. Fetch data concurrently
    const [payments, walkInSales, otherIncomes, expenses] = await Promise.all([
      ethioCareClient.entities.Payment.list('-created_date', 1000).catch(() => []),
      pharmacySaleService.getSales().catch(() => []),
      ethioCareClient.entities.OtherIncome.list('-income_date', 500).catch(() => []),
      ethioCareClient.entities.Expense.list('-expense_date', 500).catch(() => []),
    ]);

    // 2. Identify all PAID hospital payments
    const paidPayments = payments.filter((p: any) => p.status === 'paid');
    const existingPaymentReceipts = new Set(
      paidPayments.map((p: any) => p.receipt_number).filter(Boolean)
    );
    const existingPaymentIds = new Set(paidPayments.map((p: any) => p.id));

    const transactions: TransactionItem[] = [];

    // Add Paid Hospital Payments
    for (const p of paidPayments) {
      const pDate = p.paid_date || p.created_at || p.created_date || format(new Date(), 'yyyy-MM-dd');
      const isBedPayment = p.payment_type === 'bed' || String(p.reference_type || '').startsWith('bed');
      const sourceOrCategory = isBedPayment 
        ? (p.reference_type || 'bed')
        : (p.reference_type || p.payment_type || 'hospital_service');

      transactions.push({
        id: p.id,
        type: 'income',
        sourceOrCategory,
        title: p.description || (isBedPayment ? 'Inpatient Bed Service' : `${p.payment_type || 'Hospital'} Payment`),
        amount: Number(p.amount) || 0,
        paymentMethod: p.payment_method || 'cash',
        date: String(pDate).slice(0, 10),
        recordedBy: p.cashier_name || 'Cashier',
        description: `Receipt: ${p.receipt_number || 'N/A'} - Patient: ${p.patient_name || 'N/A'}`,
        referenceId: p.reference_id,
        canEdit: false,
        entityName: 'Payment',
      });
    }

    // Add Walk-in Pharmacy Sales (if not duplicate in payments)
    for (const s of walkInSales) {
      if (s.receiptNumber && existingPaymentReceipts.has(s.receiptNumber)) continue;
      if (s.id && existingPaymentIds.has(s.id)) continue;

      const sDate = s.createdAt || format(new Date(), 'yyyy-MM-dd');
      transactions.push({
        id: s.id,
        type: 'income',
        sourceOrCategory: 'pharmacy_walk_in',
        title: `Walk-in Pharmacy Sale (${s.receiptNumber || 'POS'})`,
        amount: Number(s.total) || 0,
        paymentMethod: s.paymentMethod || 'cash',
        date: String(sDate).slice(0, 10),
        recordedBy: s.cashierName || 'Pharmacist',
        description: `Customer: ${s.customerName || 'Walk-In'} - ${s.items?.length || 0} items`,
        canEdit: false,
        entityName: 'PharmacySale',
      });
    }

    // Add Other Incomes
    for (const oi of otherIncomes) {
      const oiDate = oi.income_date || oi.created_at || format(new Date(), 'yyyy-MM-dd');
      transactions.push({
        id: oi.id,
        type: 'income',
        sourceOrCategory: oi.source || 'other',
        title: oi.title || 'Other Income',
        amount: Number(oi.amount) || 0,
        paymentMethod: oi.payment_method || 'cash',
        date: String(oiDate).slice(0, 10),
        recordedBy: oi.recorded_by || 'Admin',
        description: oi.description || '',
        canEdit: true,
        entityName: 'OtherIncome',
      });
    }

    // Add Expenses
    for (const exp of expenses) {
      const expDate = exp.expense_date || exp.created_at || format(new Date(), 'yyyy-MM-dd');
      transactions.push({
        id: exp.id,
        type: 'expense',
        sourceOrCategory: exp.category || 'other',
        title: exp.title || 'Hospital Expense',
        amount: Number(exp.amount) || 0,
        paymentMethod: exp.payment_method || 'cash',
        date: String(expDate).slice(0, 10),
        recordedBy: exp.recorded_by || 'Admin',
        description: exp.description || '',
        referenceId: exp.reference_id,
        canEdit: true,
        entityName: 'Expense',
      });
    }

    // Sort transactions by date descending
    transactions.sort((a, b) => b.date.localeCompare(a.date));

    // 3. Compute Metrics
    const today = { income: 0, expense: 0, net: 0 };
    const thisWeek = { income: 0, expense: 0, net: 0 };
    const thisMonth = { income: 0, expense: 0, net: 0 };
    const total = { income: 0, expense: 0, net: 0 };

    const expenseByCategory: Record<string, number> = {};
    const incomeBySource: Record<string, number> = {};

    for (const t of transactions) {
      const itemDate = parseItemDate(t.date);

      if (t.type === 'income') {
        total.income += t.amount;
        if (isToday(itemDate)) today.income += t.amount;
        if (isThisWeek(itemDate, { weekStartsOn: 1 })) thisWeek.income += t.amount;
        if (isThisMonth(itemDate)) thisMonth.income += t.amount;

        const cat = t.sourceOrCategory || 'other';
        incomeBySource[cat] = (incomeBySource[cat] || 0) + t.amount;
      } else {
        total.expense += t.amount;
        if (isToday(itemDate)) today.expense += t.amount;
        if (isThisWeek(itemDate, { weekStartsOn: 1 })) thisWeek.expense += t.amount;
        if (isThisMonth(itemDate)) thisMonth.expense += t.amount;

        const cat = t.sourceOrCategory || 'other';
        expenseByCategory[cat] = (expenseByCategory[cat] || 0) + t.amount;
      }
    }

    today.net = today.income - today.expense;
    thisWeek.net = thisWeek.income - thisWeek.expense;
    thisMonth.net = thisMonth.income - thisMonth.expense;
    total.net = total.income - total.expense;

    // 4. Compute 14-day Daily Trend
    const dailyMap = new Map<string, { income: number; expense: number }>();
    for (let i = 13; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const key = format(d, 'yyyy-MM-dd');
      dailyMap.set(key, { income: 0, expense: 0 });
    }

    for (const t of transactions) {
      if (dailyMap.has(t.date)) {
        const bucket = dailyMap.get(t.date)!;
        if (t.type === 'income') bucket.income += t.amount;
        else bucket.expense += t.amount;
      }
    }

    const dailyTrend: TrendItem[] = Array.from(dailyMap.entries()).map(([date, vals]) => ({
      date,
      label: format(parseISO(date), 'MMM dd'),
      income: vals.income,
      expense: vals.expense,
      net: vals.income - vals.expense,
    }));

    // 5. Compute 6-month Trend
    const monthlyMap = new Map<string, { income: number; expense: number; label: string }>();
    for (let i = 5; i >= 0; i--) {
      const d = subDays(new Date(), i * 30);
      const key = format(d, 'yyyy-MM');
      const label = format(d, 'MMM yyyy');
      monthlyMap.set(key, { income: 0, expense: 0, label });
    }

    for (const t of transactions) {
      const mKey = t.date.slice(0, 7);
      if (monthlyMap.has(mKey)) {
        const bucket = monthlyMap.get(mKey)!;
        if (t.type === 'income') bucket.income += t.amount;
        else bucket.expense += t.amount;
      }
    }

    const monthlyTrend: TrendItem[] = Array.from(monthlyMap.entries()).map(([month, vals]) => ({
      date: month,
      label: vals.label,
      income: vals.income,
      expense: vals.expense,
      net: vals.income - vals.expense,
    }));

    return {
      today,
      thisWeek,
      thisMonth,
      total,
      dailyTrend,
      monthlyTrend,
      expenseByCategory,
      incomeBySource,
      transactions,
    };
  },

  /**
   * Expense CRUD
   */
  async createExpense(data: ExpenseRecord, recordedBy: string = 'Owner/Admin'): Promise<any> {
    if (!data.title || !data.amount) {
      throw new Error('Expense title and amount are required');
    }
    const created = await ethioCareClient.entities.Expense.create({
      ...data,
      amount: Number(data.amount),
      recorded_by: recordedBy,
      expense_date: data.expense_date || format(new Date(), 'yyyy-MM-dd'),
    });

    logAudit({
      action: 'CREATE_EXPENSE',
      performedBy: recordedBy,
      details: `Created expense: ${data.title} (${data.amount} ETB) under ${data.category}`,
      metadata: { id: created.id, amount: data.amount, category: data.category },
    });

    return created;
  },

  async updateExpense(id: string, data: Partial<ExpenseRecord>, updatedBy: string = 'Owner/Admin'): Promise<any> {
    const updated = await ethioCareClient.entities.Expense.update(id, {
      ...data,
      amount: data.amount !== undefined ? Number(data.amount) : undefined,
      updated_at: new Date().toISOString(),
    });

    logAudit({
      action: 'UPDATE_EXPENSE',
      performedBy: updatedBy,
      details: `Updated expense ID ${id}`,
      metadata: { id, updates: data },
    });

    return updated;
  },

  async deleteExpense(id: string, deletedBy: string = 'Owner/Admin'): Promise<boolean> {
    await ethioCareClient.entities.Expense.delete(id);

    logAudit({
      action: 'DELETE_EXPENSE',
      performedBy: deletedBy,
      details: `Deleted expense ID ${id}`,
      metadata: { id },
    });

    return true;
  },

  /**
   * Other Income CRUD
   */
  async createOtherIncome(data: OtherIncomeRecord, recordedBy: string = 'Owner/Admin'): Promise<any> {
    if (!data.title || !data.amount) {
      throw new Error('Income title and amount are required');
    }
    const created = await ethioCareClient.entities.OtherIncome.create({
      ...data,
      amount: Number(data.amount),
      recorded_by: recordedBy,
      income_date: data.income_date || format(new Date(), 'yyyy-MM-dd'),
    });

    logAudit({
      action: 'CREATE_OTHER_INCOME',
      performedBy: recordedBy,
      details: `Recorded other income: ${data.title} (${data.amount} ETB) from ${data.source}`,
      metadata: { id: created.id, amount: data.amount, source: data.source },
    });

    return created;
  },

  async updateOtherIncome(id: string, data: Partial<OtherIncomeRecord>, updatedBy: string = 'Owner/Admin'): Promise<any> {
    const updated = await ethioCareClient.entities.OtherIncome.update(id, {
      ...data,
      amount: data.amount !== undefined ? Number(data.amount) : undefined,
      updated_at: new Date().toISOString(),
    });

    logAudit({
      action: 'UPDATE_OTHER_INCOME',
      performedBy: updatedBy,
      details: `Updated other income ID ${id}`,
      metadata: { id, updates: data },
    });

    return updated;
  },

  async deleteOtherIncome(id: string, deletedBy: string = 'Owner/Admin'): Promise<boolean> {
    await ethioCareClient.entities.OtherIncome.delete(id);

    logAudit({
      action: 'DELETE_OTHER_INCOME',
      performedBy: deletedBy,
      details: `Deleted other income ID ${id}`,
      metadata: { id },
    });

    return true;
  },
};
