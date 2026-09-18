import { base44 } from '@/api/base44Client';
import { notificationService } from '@/services/notification.service';
import { logAudit } from '@/lib/auditLogger';
import {
  format,
  getDaysInMonth,
  setDate,
  differenceInCalendarDays,
  isValid,
  parseISO
} from 'date-fns';

export interface EmployeeSalaryConfig {
  id?: string;
  staff_id: string;
  employee_name: string;
  role: string;
  department: string;
  base_salary: number;
  payday_of_month: number;
  payment_frequency: 'monthly' | 'bi-weekly' | 'weekly';
  payment_method: 'bank_transfer' | 'cash' | 'telebirr' | 'cbe_birr' | 'check' | 'other';
  bank_name?: string;
  bank_account?: string;
  status: 'active' | 'inactive';
  created_at?: string;
  updated_at?: string;
}

export interface SalaryDisbursementInput {
  employee_salary_id?: string;
  staff_id: string;
  employee_name: string;
  salary_period: string; // e.g. '2026-09'
  base_salary: number;
  allowances: number;
  deductions: number;
  net_payable: number;
  amount_paid: number;
  remaining_amount: number;
  payment_method: string;
  transaction_reference?: string;
  payment_date: string;
  notes?: string;
  recorded_by?: string;
}

export interface SalaryDueAlert {
  id: string;
  staffId: string;
  employeeName: string;
  role: string;
  baseSalary: number;
  paydayOfMonth: number;
  paydayDate: string;
  daysUntilPayday: number;
  urgency: 'overdue' | 'due_today' | 'due_tomorrow' | 'due_in_7_days';
  urgencyLabel: string;
  message: string;
  remainingUnpaid: number;
  isPaid: boolean;
}

export const salaryService = {
  /**
   * List all staff with their salary configurations.
   * Merges records from public.staff and public.employee_salaries.
   */
  async listEmployeeSalaries(): Promise<EmployeeSalaryConfig[]> {
    const [staffMembers, salaryConfigs] = await Promise.all([
      base44.entities.Staff.list().catch(() => []),
      base44.entities.EmployeeSalary.list().catch(() => []),
    ]);

    const configMap = new Map<string, any>();
    for (const c of salaryConfigs) {
      if (c.staff_id) configMap.set(c.staff_id, c);
    }

    const merged: EmployeeSalaryConfig[] = [];

    // Ensure all active staff members are represented
    for (const s of staffMembers) {
      if (s.status === 'inactive') continue;

      const existing = configMap.get(s.id);
      if (existing) {
        merged.push({
          ...existing,
          employee_name: existing.employee_name || s.full_name,
          role: existing.role || s.role,
          department: existing.department || s.department || 'General',
          base_salary: Number(existing.base_salary) || 0,
          payday_of_month: Number(existing.payday_of_month) || 28,
        });
        configMap.delete(s.id);
      } else {
        // Default template
        merged.push({
          staff_id: s.id,
          employee_name: s.full_name,
          role: s.role,
          department: s.department || 'General',
          base_salary: 0,
          payday_of_month: 28,
          payment_frequency: 'monthly',
          payment_method: 'bank_transfer',
          bank_name: 'Commercial Bank of Ethiopia',
          bank_account: '',
          status: 'active',
        });
      }
    }

    // Include any standalone salary configurations not directly matched to staff
    for (const standalone of configMap.values()) {
      merged.push({
        ...standalone,
        base_salary: Number(standalone.base_salary) || 0,
        payday_of_month: Number(standalone.payday_of_month) || 28,
      });
    }

    return merged;
  },

  /**
   * Save or update an employee salary configuration.
   */
  async saveSalaryConfig(config: EmployeeSalaryConfig, recordedBy: string = 'Owner/Admin'): Promise<any> {
    if (!config.staff_id && !config.id) {
      throw new Error('Staff ID or Salary Config ID is required');
    }

    const payload = {
      staff_id: config.staff_id,
      employee_name: config.employee_name,
      role: config.role,
      department: config.department,
      base_salary: Number(config.base_salary) || 0,
      payday_of_month: Math.min(31, Math.max(1, Number(config.payday_of_month) || 28)),
      payment_frequency: config.payment_frequency || 'monthly',
      payment_method: config.payment_method || 'bank_transfer',
      bank_name: config.bank_name || null,
      bank_account: config.bank_account || null,
      status: config.status || 'active',
    };

    let result;
    if (config.id) {
      result = await base44.entities.EmployeeSalary.update(config.id, payload);
    } else {
      // Check if an existing config exists for this staff_id
      const existing = await base44.entities.EmployeeSalary.filter({ staff_id: config.staff_id }).catch(() => []);
      if (existing.length > 0) {
        result = await base44.entities.EmployeeSalary.update(existing[0].id, payload);
      } else {
        result = await base44.entities.EmployeeSalary.create(payload);
      }
    }

    logAudit({
      action: 'UPDATE_EMPLOYEE_SALARY_CONFIG',
      performedBy: recordedBy,
      details: `Configured base salary for ${config.employee_name}: ${config.base_salary} ETB (Payday: ${config.payday_of_month}th)`,
      metadata: { staffId: config.staff_id, baseSalary: config.base_salary },
    });

    return result;
  },

  /**
   * Disburse salary to an employee.
   * Auto-creates a record in public.salary_payments AND in public.expenses with category 'salaries'.
   */
  async disburseSalary(data: SalaryDisbursementInput, recordedBy: string = 'Owner/Admin'): Promise<any> {
    if (!data.staff_id || !data.amount_paid || data.amount_paid <= 0) {
      throw new Error('Valid staff and payment amount are required for salary disbursement');
    }

    const netPayable = Number(data.net_payable) || (Number(data.base_salary) + Number(data.allowances || 0) - Number(data.deductions || 0));
    const amountPaid = Number(data.amount_paid);
    const remaining = Math.max(0, netPayable - amountPaid);
    const status = remaining <= 0 ? 'paid' : 'partial';
    const payDate = data.payment_date || format(new Date(), 'yyyy-MM-dd');

    // 1. Create SalaryPayment record
    const paymentRecord = await base44.entities.SalaryPayment.create({
      employee_salary_id: data.employee_salary_id || null,
      staff_id: data.staff_id,
      employee_name: data.employee_name,
      salary_period: data.salary_period,
      base_salary: Number(data.base_salary),
      allowances: Number(data.allowances || 0),
      deductions: Number(data.deductions || 0),
      net_payable: netPayable,
      amount_paid: amountPaid,
      remaining_amount: remaining,
      payment_method: data.payment_method,
      transaction_reference: data.transaction_reference || null,
      payment_date: payDate,
      status: status,
      notes: data.notes || null,
      recorded_by: recordedBy,
    });

    // 2. Auto-log corresponding entry in public.expenses
    try {
      await base44.entities.Expense.create({
        category: 'salaries',
        title: `Salary: ${data.employee_name} (${data.salary_period})`,
        amount: amountPaid,
        payment_method: data.payment_method || 'bank_transfer',
        expense_date: payDate,
        description: `Disbursed ${amountPaid} ETB (${status.toUpperCase()}) for period ${data.salary_period}${data.notes ? ` - ${data.notes}` : ''}`,
        recorded_by: recordedBy,
        reference_id: paymentRecord.id,
      });
    } catch (expErr) {
      console.warn('[salaryService] Failed to auto-create expense entry:', expErr);
    }

    // 3. Dispatch hospital notification
    notificationService.dispatch({
      title: 'Salary Disbursed',
      message: `${amountPaid} ETB salary paid to ${data.employee_name} for ${data.salary_period} (${status === 'paid' ? 'Paid in Full' : `Remaining: ${remaining} ETB`}).`,
      type: 'success',
      module: 'finance',
      targetRoles: ['owner', 'accountant'],
      link: '/owner/salaries',
    });

    logAudit({
      action: 'DISBURSE_SALARY',
      performedBy: recordedBy,
      details: `Disbursed ${amountPaid} ETB salary to ${data.employee_name} (${data.salary_period})`,
      metadata: {
        staffId: data.staff_id,
        amount: amountPaid,
        period: data.salary_period,
        remaining,
      },
    });

    return paymentRecord;
  },

  /**
   * List salary payments with optional period filter (e.g. '2026-09')
   */
  async listSalaryPayments(period?: string): Promise<any[]> {
    const list = await base44.entities.SalaryPayment.list('-payment_date', 500).catch(() => []);
    if (!period) return list;
    return list.filter((p: any) => p.salary_period === period);
  },

  /**
   * Calculate upcoming salary due dates and return alerts:
   * - overdue (past payday and unpaid)
   * - due_today (payday is today)
   * - due_tomorrow (payday is tomorrow)
   * - due_in_7_days (payday is within 7 days)
   * Deduplicated so each employee has at most 1 current status alert.
   */
  async getSalaryDueNotifications(currentDate: Date = new Date()): Promise<SalaryDueAlert[]> {
    const [configs, payments] = await Promise.all([
      this.listEmployeeSalaries(),
      base44.entities.SalaryPayment.list('-payment_date', 500).catch(() => []),
    ]);

    const currentPeriod = format(currentDate, 'yyyy-MM');
    const alerts: SalaryDueAlert[] = [];

    // Group payments by staff_id for the current period
    const paymentsForPeriod = new Map<string, number>();
    for (const p of payments) {
      if (p.salary_period === currentPeriod) {
        const currentPaid = paymentsForPeriod.get(p.staff_id) || 0;
        paymentsForPeriod.set(p.staff_id, currentPaid + (Number(p.amount_paid) || 0));
      }
    }

    const daysInThisMonth = getDaysInMonth(currentDate);

    for (const emp of configs) {
      if (emp.status === 'inactive' || !emp.base_salary || emp.base_salary <= 0) continue;

      const totalPaid = paymentsForPeriod.get(emp.staff_id) || 0;
      const remainingUnpaid = Math.max(0, emp.base_salary - totalPaid);
      const isPaid = remainingUnpaid <= 0;

      // Calculate payday date for current month
      const targetDay = Math.min(daysInThisMonth, Math.max(1, emp.payday_of_month || 28));
      const paydayDate = setDate(currentDate, targetDay);
      const daysUntil = differenceInCalendarDays(paydayDate, currentDate);

      // If fully paid, no urgent alert is needed
      if (isPaid) continue;

      let urgency: SalaryDueAlert['urgency'] | null = null;
      let urgencyLabel = '';
      let message = '';

      if (daysUntil < 0) {
        urgency = 'overdue';
        const overdueDays = Math.abs(daysUntil);
        urgencyLabel = `Overdue by ${overdueDays}d`;
        message = `Salary payment for ${emp.employee_name} (${emp.role}) is OVERDUE by ${overdueDays} day${overdueDays > 1 ? 's' : ''} (Payday was ${format(paydayDate, 'MMM dd')}). Balance: ${remainingUnpaid} ETB.`;
      } else if (daysUntil === 0) {
        urgency = 'due_today';
        urgencyLabel = 'Due Today';
        message = `Salary payment for ${emp.employee_name} is DUE TODAY (${targetDay}th)! Amount: ${remainingUnpaid} ETB.`;
      } else if (daysUntil === 1) {
        urgency = 'due_tomorrow';
        urgencyLabel = 'Due Tomorrow';
        message = `Salary payment for ${emp.employee_name} is due tomorrow. Amount: ${remainingUnpaid} ETB.`;
      } else if (daysUntil <= 7) {
        urgency = 'due_in_7_days';
        urgencyLabel = `Due in ${daysUntil} days`;
        message = `Salary for ${emp.employee_name} is due in ${daysUntil} days (${format(paydayDate, 'MMM dd')}). Amount: ${remainingUnpaid} ETB.`;
      }

      if (urgency) {
        alerts.push({
          id: `salary-due-${emp.staff_id}-${currentPeriod}`,
          staffId: emp.staff_id,
          employeeName: emp.employee_name,
          role: emp.role,
          baseSalary: emp.base_salary,
          paydayOfMonth: targetDay,
          paydayDate: format(paydayDate, 'yyyy-MM-dd'),
          daysUntilPayday: daysUntil,
          urgency,
          urgencyLabel,
          message,
          remainingUnpaid,
          isPaid,
        });
      }
    }

    // Sort: overdue first, then due_today, due_tomorrow, due_in_7_days
    const orderMap = { overdue: 0, due_today: 1, due_tomorrow: 2, due_in_7_days: 3 };
    alerts.sort((a, b) => {
      const pA = orderMap[a.urgency];
      const pB = orderMap[b.urgency];
      if (pA !== pB) return pA - pB;
      return a.daysUntilPayday - b.daysUntilPayday;
    });

    return alerts;
  },
};
