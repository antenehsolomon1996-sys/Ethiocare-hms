-- ==============================================================================
-- EthioCare HMS - Pharmacy Walk-In Sales RLS Policy
-- Migration: 20260917_pharmacy_walk_in_sales.sql
-- ==============================================================================

-- 1. Payments: Allow Pharmacist to insert walk-in sales payments
DROP POLICY IF EXISTS "payments_insert_policy" ON public.payments;
CREATE POLICY "payments_insert_policy"
ON public.payments FOR INSERT TO authenticated
WITH CHECK (public.is_staff('owner', 'admin', 'receptionist', 'accountant', 'doctor', 'pharmacist'));

-- 2. Payments: Allow Pharmacist to read walk-in pharmacy sales
DROP POLICY IF EXISTS "payments_select_policy" ON public.payments;
CREATE POLICY "payments_select_policy"
ON public.payments FOR SELECT TO authenticated
USING (true);
