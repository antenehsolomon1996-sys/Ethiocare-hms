-- ==============================================================================
-- EthioCare HMS: Master Workflow & Payment Gate Architecture
-- Migration Date: 2026-09-17
-- Description:
--   Strict database constraints, columns, indexes, and atomic stored procedures
--   ensuring hospital clinical services and orders move between portals
--   ONLY when required payment has been settled.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. VISITS TABLE: Registration & Consultation Payment Gating
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'visits' AND column_name = 'registration_fee_paid') THEN
    ALTER TABLE public.visits ADD COLUMN registration_fee_paid BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'visits' AND column_name = 'billing_completed') THEN
    ALTER TABLE public.visits ADD COLUMN billing_completed BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'visits' AND column_name = 'registration_fee') THEN
    ALTER TABLE public.visits ADD COLUMN registration_fee NUMERIC(10,2) DEFAULT 150.00;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'visits' AND column_name = 'revisit_fee') THEN
    ALTER TABLE public.visits ADD COLUMN revisit_fee NUMERIC(10,2) DEFAULT 100.00;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_visits_registration_gate ON public.visits (visit_date, registration_fee_paid, status);

-- ------------------------------------------------------------------------------
-- 2. LAB_ORDERS TABLE: Diagnostic Payment Gating
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lab_orders' AND column_name = 'payment_status') THEN
    ALTER TABLE public.lab_orders ADD COLUMN payment_status TEXT DEFAULT 'pending';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lab_orders' AND column_name = 'price') THEN
    ALTER TABLE public.lab_orders ADD COLUMN price NUMERIC(10,2) DEFAULT 0.00;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lab_orders_payment_gate ON public.lab_orders (payment_status, test_status);

-- ------------------------------------------------------------------------------
-- 3. MEDICATION_ORDERS TABLE: Nursing / Injection Payment Gating
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'medication_orders' AND column_name = 'payment_status') THEN
    ALTER TABLE public.medication_orders ADD COLUMN payment_status TEXT DEFAULT 'pending_payment';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'medication_orders' AND column_name = 'administration_status') THEN
    ALTER TABLE public.medication_orders ADD COLUMN administration_status TEXT DEFAULT 'pending';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'medication_orders' AND column_name = 'urgency') THEN
    ALTER TABLE public.medication_orders ADD COLUMN urgency TEXT DEFAULT 'routine';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'medication_orders' AND column_name = 'total_price') THEN
    ALTER TABLE public.medication_orders ADD COLUMN total_price NUMERIC(10,2) DEFAULT 0.00;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_med_orders_payment_gate ON public.medication_orders (payment_status, administration_status, urgency);

-- ------------------------------------------------------------------------------
-- 4. ATOMIC RPC FUNCTION: Settle Hospital Payment
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_settle_hospital_payment(
  p_payment_id UUID,
  p_payment_method TEXT DEFAULT 'cash',
  p_cashier_name TEXT DEFAULT 'Hospital Cashier',
  p_receipt_number TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment RECORD;
  v_receipt TEXT;
  v_today TEXT;
  v_result JSONB;
BEGIN
  -- 1. Fetch payment
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment % not found', p_payment_id;
  END IF;

  v_today := TO_CHAR(NOW(), 'YYYY-MM-DD');
  v_receipt := COALESCE(p_receipt_number, v_payment.receipt_number, 'RCP-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0'));

  -- 2. Update payment to PAID
  UPDATE public.payments
  SET
    status = 'paid',
    order_status = 'paid',
    payment_method = p_payment_method,
    receipt_number = v_receipt,
    cashier_name = p_cashier_name,
    paid_date = v_today,
    updated_at = NOW()
  WHERE id = p_payment_id;

  -- 3. Gate Resolution by Reference Type
  -- Case A: Registration
  IF v_payment.reference_type = 'registration' OR v_payment.payment_type = 'registration' THEN
    IF v_payment.visit_id IS NOT NULL THEN
      UPDATE public.visits
      SET
        registration_fee_paid = TRUE,
        billing_completed = TRUE,
        status = 'waiting',
        updated_at = NOW()
      WHERE id = v_payment.visit_id;
    END IF;
  END IF;

  -- Case B: Lab Order
  IF v_payment.reference_type = 'lab_order' OR v_payment.payment_type = 'laboratory' THEN
    IF v_payment.reference_id IS NOT NULL THEN
      UPDATE public.lab_orders
      SET
        payment_status = 'paid',
        test_status = 'pending',
        updated_at = NOW()
      WHERE id = v_payment.reference_id;
    ELSIF v_payment.visit_id IS NOT NULL THEN
      UPDATE public.lab_orders
      SET
        payment_status = 'paid',
        test_status = 'pending',
        updated_at = NOW()
      WHERE visit_id = v_payment.visit_id;
    END IF;

    IF v_payment.visit_id IS NOT NULL THEN
      UPDATE public.visits
      SET status = 'lab_paid', updated_at = NOW()
      WHERE id = v_payment.visit_id;
    END IF;
  END IF;

  -- Case C: Medication / Injection / Nursing Order
  IF v_payment.reference_type = 'medication_order' OR v_payment.payment_type IN ('medicine', 'injection', 'procedure', 'iv_treatment') THEN
    IF v_payment.reference_id IS NOT NULL THEN
      UPDATE public.medication_orders
      SET
        payment_status = 'paid',
        administration_status = 'pending',
        payment_id = v_payment.id,
        receipt_number = v_receipt,
        paid_by = p_cashier_name,
        paid_date = v_today,
        updated_at = NOW()
      WHERE id = v_payment.reference_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'payment_id', p_payment_id,
    'receipt_number', v_receipt,
    'paid_date', v_today
  );
END;
$$;
