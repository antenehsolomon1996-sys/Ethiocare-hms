-- ==============================================================================
-- EthioCare HMS - Lab Technician Visits Update Authorization
-- Migration: 20260918_fix_lab_visit_update_rls.sql
-- ==============================================================================

-- Update visits_update_policy to authorize 'lab_technician' (and 'pharmacist')
-- alongside owner, admin, receptionist, doctor, nurse, and accountant.
DROP POLICY IF EXISTS "visits_update_policy" ON public.visits;

CREATE POLICY "visits_update_policy"
ON public.visits FOR UPDATE TO authenticated
USING (public.is_staff('owner', 'admin', 'receptionist', 'doctor', 'nurse', 'lab_technician', 'pharmacist', 'accountant'))
WITH CHECK (public.is_staff('owner', 'admin', 'receptionist', 'doctor', 'nurse', 'lab_technician', 'pharmacist', 'accountant'));
