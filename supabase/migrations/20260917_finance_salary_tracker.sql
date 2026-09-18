-- ==============================================================================
-- EthioCare HMS: Finance & Employee Salary Management Schema
-- Migration Date: 2026-09-17
-- Description:
--   Complete schema for Income & Expense tracking, Employee Salary Management,
--   Salary Disbursement history, and Hospital Tariff controls.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXPENSES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'utilities',
    'medical_supplies',
    'pharmaceuticals',
    'salaries',
    'maintenance',
    'rent',
    'equipment',
    'administrative',
    'cleaning_sanitation',
    'food_catering',
    'taxes_licenses',
    'marketing',
    'other'
  )),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN (
    'cash', 'telebirr', 'cbe_birr', 'card', 'mobile_banking', 'bank_transfer', 'cheque', 'other'
  )),
  vendor TEXT,
  receipt_number TEXT,
  description TEXT,
  recorded_by TEXT,
  recorded_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date_cat ON public.expenses (expense_date, category);

-- ------------------------------------------------------------------------------
-- 2. OTHER INCOMES TABLE (Direct non-patient revenues)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.other_incomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN (
    'ambulance_service',
    'facility_rental',
    'cafeteria_canteen',
    'grants_donations',
    'medical_records_copy',
    'training_consultancy',
    'investment_interest',
    'miscellaneous'
  )),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  income_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN (
    'cash', 'telebirr', 'cbe_birr', 'card', 'mobile_banking', 'bank_transfer', 'cheque', 'other'
  )),
  receipt_number TEXT,
  description TEXT,
  recorded_by TEXT,
  recorded_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_other_incomes_date ON public.other_incomes (income_date);

-- ------------------------------------------------------------------------------
-- 3. EMPLOYEE SALARIES CONFIGURATION TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_salaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,
  staff_name TEXT NOT NULL,
  role TEXT NOT NULL,
  department TEXT,
  base_salary NUMERIC(12,2) NOT NULL CHECK (base_salary >= 0),
  pay_day_of_month INTEGER NOT NULL DEFAULT 28 CHECK (pay_day_of_month BETWEEN 1 AND 31),
  pay_frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (pay_frequency IN ('monthly', 'biweekly')),
  payment_method_default TEXT NOT NULL DEFAULT 'bank_transfer' CHECK (payment_method_default IN (
    'bank_transfer', 'telebirr', 'cbe_birr', 'cash', 'cheque'
  )),
  bank_name TEXT DEFAULT 'Commercial Bank of Ethiopia (CBE)',
  bank_account_number TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_employee_salaries_staff UNIQUE (staff_id)
);

-- ------------------------------------------------------------------------------
-- 4. SALARY PAYMENTS TABLE (Disbursements & History)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.salary_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  staff_name TEXT NOT NULL,
  role TEXT NOT NULL,
  salary_period TEXT NOT NULL, -- e.g. "September 2026"
  base_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  allowance NUMERIC(12,2) NOT NULL DEFAULT 0,
  deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  remaining_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('pending', 'paid', 'partially_paid')),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
  receipt_number TEXT,
  notes TEXT,
  paid_by TEXT,
  paid_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_salary_payments_staff_period UNIQUE (staff_id, salary_period)
);

CREATE INDEX IF NOT EXISTS idx_salary_payments_period ON public.salary_payments (salary_period, payment_status);

-- ------------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.other_incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;

-- Expenses RLS
DROP POLICY IF EXISTS "expenses_select_policy" ON public.expenses;
DROP POLICY IF EXISTS "expenses_all_policy" ON public.expenses;
CREATE POLICY "expenses_select_policy" ON public.expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "expenses_all_policy" ON public.expenses FOR ALL TO authenticated USING (
  public.is_staff('owner', 'admin', 'accountant')
) WITH CHECK (
  public.is_staff('owner', 'admin', 'accountant')
);

-- Other Incomes RLS
DROP POLICY IF EXISTS "other_incomes_select_policy" ON public.other_incomes;
DROP POLICY IF EXISTS "other_incomes_all_policy" ON public.other_incomes;
CREATE POLICY "other_incomes_select_policy" ON public.other_incomes FOR SELECT TO authenticated USING (true);
CREATE POLICY "other_incomes_all_policy" ON public.other_incomes FOR ALL TO authenticated USING (
  public.is_staff('owner', 'admin', 'accountant')
) WITH CHECK (
  public.is_staff('owner', 'admin', 'accountant')
);

-- Employee Salaries RLS
DROP POLICY IF EXISTS "salaries_select_policy" ON public.employee_salaries;
DROP POLICY IF EXISTS "salaries_all_policy" ON public.employee_salaries;
CREATE POLICY "salaries_select_policy" ON public.employee_salaries FOR SELECT TO authenticated USING (true);
CREATE POLICY "salaries_all_policy" ON public.employee_salaries FOR ALL TO authenticated USING (
  public.is_staff('owner', 'admin')
) WITH CHECK (
  public.is_staff('owner', 'admin')
);

-- Salary Payments RLS
DROP POLICY IF EXISTS "salary_payments_select_policy" ON public.salary_payments;
DROP POLICY IF EXISTS "salary_payments_all_policy" ON public.salary_payments;
CREATE POLICY "salary_payments_select_policy" ON public.salary_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "salary_payments_all_policy" ON public.salary_payments FOR ALL TO authenticated USING (
  public.is_staff('owner', 'admin', 'accountant')
) WITH CHECK (
  public.is_staff('owner', 'admin', 'accountant')
);

-- ------------------------------------------------------------------------------
-- 6. DEFAULT SERVICES SEED FOR REGISTRATION TARIFFS
-- ------------------------------------------------------------------------------
INSERT INTO public.services (name, category, price, description, status)
VALUES 
  ('New Patient Registration Fee', 'registration', 150.00, 'Standard registration and file creation for first-time or returning (>30 days) patients', 'active'),
  ('Recent Patient Revisit Fee (≤30 Days)', 'registration', 100.00, 'Discounted revisit consultation fee for patients treated within the past 30 days', 'active')
ON CONFLICT DO NOTHING;
