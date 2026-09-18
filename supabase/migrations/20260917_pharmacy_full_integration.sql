-- ==============================================================================
-- EthioCare HMS - Pharmacy Full Module Integration Migration
-- Migration: 20260917_pharmacy_full_integration.sql
-- ==============================================================================

-- 1. Create inventory_movements table for centralized inventory movement tracking
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id UUID REFERENCES public.medicines(id) ON DELETE SET NULL,
  medicine_name TEXT NOT NULL,
  batch_number TEXT,
  movement_type TEXT NOT NULL CHECK (movement_type IN (
    'STOCK_IN', 'HOSPITAL_DISPENSE', 'WALK_IN_SALE', 'RETURN_IN', 'RETURN_OUT',
    'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'EXPIRED', 'DAMAGED', 'TRANSFER_IN', 'TRANSFER_OUT'
  )),
  quantity NUMERIC NOT NULL,
  previous_quantity NUMERIC,
  new_quantity NUMERIC,
  reference_id TEXT,
  reference_type TEXT,
  reason TEXT,
  storage_location TEXT,
  performed_by TEXT NOT NULL,
  user_role TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index on movement_type, medicine_id, and created_at
CREATE INDEX IF NOT EXISTS idx_movements_med_id ON public.inventory_movements(medicine_id);
CREATE INDEX IF NOT EXISTS idx_movements_type ON public.inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_movements_created ON public.inventory_movements(created_at);

-- 2. Create purchase_invoices table for Stock Receiving
CREATE TABLE IF NOT EXISTS public.purchase_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  supplier TEXT NOT NULL,
  purchase_order_number TEXT,
  invoice_date DATE NOT NULL,
  delivery_date DATE,
  storage_location TEXT,
  received_by TEXT NOT NULL,
  subtotal NUMERIC NOT NULL,
  tax_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC NOT NULL,
  total_quantity NUMERIC NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'completed',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_num ON public.purchase_invoices(invoice_number);

-- 3. Create sales_returns table for POS Returns
CREATE TABLE IF NOT EXISTS public.sales_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number TEXT NOT NULL UNIQUE,
  original_sale_id TEXT NOT NULL,
  original_receipt_number TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  refund_amount NUMERIC NOT NULL,
  refund_method TEXT NOT NULL,
  reason TEXT NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'completed',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  processed_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_returns_sale ON public.sales_returns(original_sale_id);

-- 4. Create pharmacy_settings table for dynamic POS configuration
CREATE TABLE IF NOT EXISTS public.pharmacy_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  require_customer_name BOOLEAN DEFAULT false,
  require_customer_phone BOOLEAN DEFAULT false,
  require_customer_age BOOLEAN DEFAULT false,
  require_customer_type BOOLEAN DEFAULT false,
  require_customer_weight BOOLEAN DEFAULT false,
  require_dosage_instructions BOOLEAN DEFAULT false,
  require_prescription_number BOOLEAN DEFAULT false,
  enable_retail_sales BOOLEAN DEFAULT true,
  default_storage_location TEXT DEFAULT 'Main Pharmacy Dispensary',
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default settings row if not present
INSERT INTO public.pharmacy_settings (
  id, require_customer_name, require_customer_phone, require_customer_age,
  require_customer_type, require_customer_weight, require_dosage_instructions,
  require_prescription_number, enable_retail_sales, default_storage_location
) VALUES (
  'default', false, false, false, false, false, false, false, true, 'Main Pharmacy Dispensary'
) ON CONFLICT (id) DO NOTHING;

-- 5. Enable Row Level Security
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_settings ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies: inventory_movements
DROP POLICY IF EXISTS "inventory_movements_all_policy" ON public.inventory_movements;
CREATE POLICY "inventory_movements_all_policy"
ON public.inventory_movements FOR ALL TO authenticated
USING (public.is_staff('owner', 'admin', 'pharmacist', 'nurse', 'doctor', 'accountant'))
WITH CHECK (public.is_staff('owner', 'admin', 'pharmacist', 'nurse', 'doctor', 'accountant'));

-- 7. RLS Policies: purchase_invoices
DROP POLICY IF EXISTS "purchase_invoices_all_policy" ON public.purchase_invoices;
CREATE POLICY "purchase_invoices_all_policy"
ON public.purchase_invoices FOR ALL TO authenticated
USING (public.is_staff('owner', 'admin', 'pharmacist', 'accountant'))
WITH CHECK (public.is_staff('owner', 'admin', 'pharmacist', 'accountant'));

-- 8. RLS Policies: sales_returns
DROP POLICY IF EXISTS "sales_returns_all_policy" ON public.sales_returns;
CREATE POLICY "sales_returns_all_policy"
ON public.sales_returns FOR ALL TO authenticated
USING (public.is_staff('owner', 'admin', 'pharmacist', 'accountant'))
WITH CHECK (public.is_staff('owner', 'admin', 'pharmacist', 'accountant'));

-- 9. RLS Policies: pharmacy_settings
DROP POLICY IF EXISTS "pharmacy_settings_all_policy" ON public.pharmacy_settings;
CREATE POLICY "pharmacy_settings_all_policy"
ON public.pharmacy_settings FOR ALL TO authenticated
USING (true)
WITH CHECK (public.is_staff('owner', 'admin', 'pharmacist'));

-- 10. Update payments policy to allow pharmacist to record walk-in payments and refunds
DROP POLICY IF EXISTS "payments_insert_policy" ON public.payments;
CREATE POLICY "payments_insert_policy"
ON public.payments FOR INSERT TO authenticated
WITH CHECK (public.is_staff('owner', 'admin', 'receptionist', 'accountant', 'doctor', 'pharmacist'));

DROP POLICY IF EXISTS "payments_select_policy" ON public.payments;
CREATE POLICY "payments_select_policy"
ON public.payments FOR SELECT TO authenticated
USING (true);
