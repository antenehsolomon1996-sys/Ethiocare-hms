-- ==============================================================================
-- EthioCare HMS - Billing and Reception RLS Policy Synchronization
-- Migration: 20260916_fix_billing_reception_rls.sql
-- ==============================================================================

-- 1. Medication Orders: Allow Receptionist to update orders to paid
DROP POLICY IF EXISTS "medication_orders_update_policy" ON public.medication_orders;
CREATE POLICY "medication_orders_update_policy"
ON public.medication_orders FOR UPDATE TO authenticated
USING (public.is_staff('owner', 'admin', 'nurse', 'accountant', 'doctor', 'receptionist'))
WITH CHECK (public.is_staff('owner', 'admin', 'nurse', 'accountant', 'doctor', 'receptionist'));

-- 2. Nurse Tasks: Allow Accountant and Receptionist to auto-dispatch tasks on payment
DROP POLICY IF EXISTS "nurse_tasks_insert_policy" ON public.nurse_tasks;
CREATE POLICY "nurse_tasks_insert_policy"
ON public.nurse_tasks FOR INSERT TO authenticated
WITH CHECK (public.is_staff('owner', 'admin', 'doctor', 'nurse', 'accountant', 'receptionist'));

-- 3. Lab Orders: Allow Accountant and Receptionist to update payment status
DROP POLICY IF EXISTS "lab_orders_update_policy" ON public.lab_orders;
CREATE POLICY "lab_orders_update_policy"
ON public.lab_orders FOR UPDATE TO authenticated
USING (public.is_staff('owner', 'admin', 'lab_technician', 'doctor', 'accountant', 'receptionist'))
WITH CHECK (public.is_staff('owner', 'admin', 'lab_technician', 'doctor', 'accountant', 'receptionist'));

-- 4. Payments: Ensure Receptionist and Accountant have full INSERT and UPDATE access
DROP POLICY IF EXISTS "payments_insert_policy" ON public.payments;
CREATE POLICY "payments_insert_policy"
ON public.payments FOR INSERT TO authenticated
WITH CHECK (public.is_staff('owner', 'admin', 'receptionist', 'accountant', 'doctor'));

DROP POLICY IF EXISTS "payments_update_policy" ON public.payments;
CREATE POLICY "payments_update_policy"
ON public.payments FOR UPDATE TO authenticated
USING (public.is_staff('owner', 'admin', 'accountant', 'receptionist'))
WITH CHECK (public.is_staff('owner', 'admin', 'accountant', 'receptionist'));

-- 5. Visits: Ensure Receptionist and Accountant can update visit billing status
DROP POLICY IF EXISTS "visits_update_policy" ON public.visits;
CREATE POLICY "visits_update_policy"
ON public.visits FOR UPDATE TO authenticated
USING (public.is_staff('owner', 'admin', 'receptionist', 'doctor', 'nurse', 'lab_technician', 'accountant'))
WITH CHECK (public.is_staff('owner', 'admin', 'receptionist', 'doctor', 'nurse', 'lab_technician', 'accountant'));
