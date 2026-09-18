-- ==============================================================================
-- EthioCare HMS - Role-Based Row Level Security (RLS) & Auth Synchronization
-- Migration: 20260916_fix_rls_policies.sql
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Core Schema Permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- 3. Ensure Columns & Relax Constraints
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS personal_email TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;

ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS blood_group TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS subcity_zone TEXT;
ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_gender_check;
ALTER TABLE public.patients ADD CONSTRAINT patients_gender_check CHECK (gender ILIKE ANY (ARRAY['male', 'female', 'other']));

ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS chief_complaint TEXT;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS blood_pressure TEXT;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS temperature TEXT;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS pulse_rate TEXT;

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_payment_method_check CHECK (payment_method IN ('cash', 'mobile_banking', 'card', 'insurance', 'telebirr', 'cbe_birr', 'bank_transfer'));

-- ------------------------------------------------------------------------------
-- 4. Fast, Secure Role Resolution Helper Functions (SECURITY DEFINER)
-- ------------------------------------------------------------------------------

-- Get current authenticated user's role from public.profiles
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  -- 1. Look up role in public.profiles for this auth.uid()
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = auth.uid() AND status = 'active';

  IF v_role IS NOT NULL THEN
    RETURN v_role;
  END IF;

  -- 2. Fallback: match by email from JWT in public.staff
  SELECT role INTO v_role
  FROM public.staff
  WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email') AND status = 'active';

  IF v_role IS NOT NULL THEN
    -- Auto-heal: ensure profile exists for this auth user
    BEGIN
      INSERT INTO public.profiles (id, email, full_name, role, status, updated_at)
      SELECT auth.uid(), s.email, s.full_name, s.role, s.status, now()
      FROM public.staff s
      WHERE LOWER(s.email) = LOWER(auth.jwt() ->> 'email')
      ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;
    EXCEPTION WHEN OTHERS THEN
      -- Ignore concurrency conflict
    END;
    RETURN v_role;
  END IF;

  -- 3. Fallback: check JWT metadata
  RETURN COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'role',
    auth.jwt() -> 'app_metadata' ->> 'role',
    NULL
  );
END;
$$;

-- Check if current authenticated user has one of the allowed roles
CREATE OR REPLACE FUNCTION public.is_staff(VARIADIC allowed_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := public.get_auth_role();
  IF v_role IS NULL THEN
    RETURN false;
  END IF;
  RETURN v_role = ANY(allowed_roles);
END;
$$;

-- Check if current user is admin/owner
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  RETURN public.is_staff('owner', 'admin');
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. Auto-Confirm Trigger on auth.users (No Email Inboxes Needed for Hospital Staff)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_auto_confirm_user ON auth.users;
CREATE TRIGGER tr_auto_confirm_user
BEFORE INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_user();

-- ------------------------------------------------------------------------------
-- 6. Synchronize Seed Staff into auth.users, auth.identities, and public.profiles
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  s RECORD;
  v_auth_id UUID;
BEGIN
  PERFORM set_config('search_path', 'public, extensions, auth', true);
  FOR s IN SELECT * FROM public.staff LOOP
    -- Check if auth user already exists for this email
    SELECT id INTO v_auth_id FROM auth.users WHERE LOWER(email) = LOWER(s.email);

    IF v_auth_id IS NULL THEN
      -- Prefer the staff record UUID so auth.users and public.staff match 1:1
      v_auth_id := s.id;
      
      INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        last_sign_in_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        v_auth_id,
        'authenticated',
        'authenticated',
        LOWER(s.email),
        crypt('Hospital@2026', gen_salt('bf')),
        now(),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', s.full_name, 'role', s.role),
        now(),
        now(),
        '',
        '',
        '',
        ''
      ) ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        encrypted_password = EXCLUDED.encrypted_password,
        email_confirmed_at = COALESCE(auth.users.email_confirmed_at, now()),
        raw_user_meta_data = EXCLUDED.raw_user_meta_data,
        updated_at = now();

      BEGIN
        INSERT INTO auth.identities (
          id,
          user_id,
          identity_data,
          provider,
          provider_id,
          last_sign_in_at,
          created_at,
          updated_at
        ) VALUES (
          v_auth_id,
          v_auth_id,
          jsonb_build_object('sub', v_auth_id::text, 'email', LOWER(s.email)),
          'email',
          LOWER(s.email),
          now(),
          now(),
          now()
        );
      EXCEPTION WHEN OTHERS THEN
        -- Safely ignore identity conflict if already registered
        NULL;
      END;
    ELSE
      -- User exists: ensure password is set and confirmed
      UPDATE auth.users
      SET 
        encrypted_password = crypt('Hospital@2026', gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        raw_user_meta_data = jsonb_build_object('full_name', s.full_name, 'role', s.role)
      WHERE id = v_auth_id;
    END IF;

    -- Ensure public.profiles has this user with correct role
    INSERT INTO public.profiles (
      id, email, full_name, role, department, specialization, phone, status, updated_at
    ) VALUES (
      v_auth_id, LOWER(s.email), s.full_name, s.role, s.department, s.specialization, s.phone, s.status, now()
    )
    ON CONFLICT (id) DO UPDATE SET
      role = EXCLUDED.role,
      full_name = EXCLUDED.full_name,
      status = EXCLUDED.status,
      updated_at = now();

  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 7. Configure Granular Role-Based RLS Policies Across All HMS Tables
-- ------------------------------------------------------------------------------

-- ==========================================
-- PROFILES TABLE
-- ==========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profiles readable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert or manage any profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles full access" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;

CREATE POLICY "profiles_select_policy"
ON public.profiles FOR SELECT TO authenticated
USING (true);

CREATE POLICY "profiles_update_policy"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid() OR public.is_admin())
WITH CHECK (id = auth.uid() OR public.is_admin());

CREATE POLICY "profiles_insert_policy"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid() OR public.is_admin());

-- ==========================================
-- PATIENTS TABLE (Core Focus of Request)
-- ==========================================
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Patients full access for authenticated staff" ON public.patients;
DROP POLICY IF EXISTS "Patients full access" ON public.patients;
DROP POLICY IF EXISTS "patients_select_policy" ON public.patients;
DROP POLICY IF EXISTS "patients_insert_policy" ON public.patients;
DROP POLICY IF EXISTS "patients_update_policy" ON public.patients;
DROP POLICY IF EXISTS "patients_delete_policy" ON public.patients;

-- SELECT: All hospital staff roles
CREATE POLICY "patients_select_policy"
ON public.patients FOR SELECT TO authenticated
USING (public.is_staff('owner', 'admin', 'receptionist', 'doctor', 'nurse', 'lab_technician', 'pharmacist', 'accountant'));

-- INSERT: Reception, Doctors, Nurses, Lab, Pharmacy, Owner, Admin
CREATE POLICY "patients_insert_policy"
ON public.patients FOR INSERT TO authenticated
WITH CHECK (public.is_staff('owner', 'admin', 'receptionist', 'doctor', 'nurse', 'lab_technician', 'pharmacist'));

-- UPDATE: Intake and clinical staff
CREATE POLICY "patients_update_policy"
ON public.patients FOR UPDATE TO authenticated
USING (public.is_staff('owner', 'admin', 'receptionist', 'doctor', 'nurse'))
WITH CHECK (public.is_staff('owner', 'admin', 'receptionist', 'doctor', 'nurse'));

-- DELETE: Leadership / administrators only
CREATE POLICY "patients_delete_policy"
ON public.patients FOR DELETE TO authenticated
USING (public.is_staff('owner', 'admin'));

-- ==========================================
-- VISITS TABLE
-- ==========================================
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Visits full access for authenticated staff" ON public.visits;
DROP POLICY IF EXISTS "Visits full access" ON public.visits;
DROP POLICY IF EXISTS "visits_select_policy" ON public.visits;
DROP POLICY IF EXISTS "visits_insert_policy" ON public.visits;
DROP POLICY IF EXISTS "visits_update_policy" ON public.visits;
DROP POLICY IF EXISTS "visits_delete_policy" ON public.visits;

CREATE POLICY "visits_select_policy"
ON public.visits FOR SELECT TO authenticated
USING (public.is_staff('owner', 'admin', 'receptionist', 'doctor', 'nurse', 'lab_technician', 'pharmacist', 'accountant'));

CREATE POLICY "visits_insert_policy"
ON public.visits FOR INSERT TO authenticated
WITH CHECK (public.is_staff('owner', 'admin', 'receptionist', 'doctor', 'nurse'));

CREATE POLICY "visits_update_policy"
ON public.visits FOR UPDATE TO authenticated
USING (public.is_staff('owner', 'admin', 'receptionist', 'doctor', 'nurse', 'accountant'))
WITH CHECK (public.is_staff('owner', 'admin', 'receptionist', 'doctor', 'nurse', 'accountant'));

CREATE POLICY "visits_delete_policy"
ON public.visits FOR DELETE TO authenticated
USING (public.is_staff('owner', 'admin'));

-- ==========================================
-- VITALS TABLE
-- ==========================================
ALTER TABLE public.vitals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Vitals full access for authenticated staff" ON public.vitals;
DROP POLICY IF EXISTS "Vitals full access" ON public.vitals;
DROP POLICY IF EXISTS "vitals_select_policy" ON public.vitals;
DROP POLICY IF EXISTS "vitals_insert_policy" ON public.vitals;
DROP POLICY IF EXISTS "vitals_update_policy" ON public.vitals;
DROP POLICY IF EXISTS "vitals_delete_policy" ON public.vitals;

CREATE POLICY "vitals_select_policy"
ON public.vitals FOR SELECT TO authenticated
USING (public.is_staff('owner', 'admin', 'receptionist', 'doctor', 'nurse', 'lab_technician', 'pharmacist', 'accountant'));

CREATE POLICY "vitals_insert_policy"
ON public.vitals FOR INSERT TO authenticated
WITH CHECK (public.is_staff('owner', 'admin', 'nurse', 'doctor'));

CREATE POLICY "vitals_update_policy"
ON public.vitals FOR UPDATE TO authenticated
USING (public.is_staff('owner', 'admin', 'nurse', 'doctor'))
WITH CHECK (public.is_staff('owner', 'admin', 'nurse', 'doctor'));

CREATE POLICY "vitals_delete_policy"
ON public.vitals FOR DELETE TO authenticated
USING (public.is_staff('owner', 'admin'));

-- ==========================================
-- NURSE TASKS TABLE
-- ==========================================
ALTER TABLE public.nurse_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Nurse tasks full access for authenticated staff" ON public.nurse_tasks;
DROP POLICY IF EXISTS "Nurse tasks full access" ON public.nurse_tasks;
DROP POLICY IF EXISTS "nurse_tasks_select_policy" ON public.nurse_tasks;
DROP POLICY IF EXISTS "nurse_tasks_insert_policy" ON public.nurse_tasks;
DROP POLICY IF EXISTS "nurse_tasks_update_policy" ON public.nurse_tasks;
DROP POLICY IF EXISTS "nurse_tasks_delete_policy" ON public.nurse_tasks;

CREATE POLICY "nurse_tasks_select_policy"
ON public.nurse_tasks FOR SELECT TO authenticated
USING (public.is_staff('owner', 'admin', 'receptionist', 'doctor', 'nurse', 'lab_technician', 'pharmacist', 'accountant'));

CREATE POLICY "nurse_tasks_insert_policy"
ON public.nurse_tasks FOR INSERT TO authenticated
WITH CHECK (public.is_staff('owner', 'admin', 'doctor', 'nurse'));

CREATE POLICY "nurse_tasks_update_policy"
ON public.nurse_tasks FOR UPDATE TO authenticated
USING (public.is_staff('owner', 'admin', 'nurse'))
WITH CHECK (public.is_staff('owner', 'admin', 'nurse'));

CREATE POLICY "nurse_tasks_delete_policy"
ON public.nurse_tasks FOR DELETE TO authenticated
USING (public.is_staff('owner', 'admin'));

-- ==========================================
-- LAB ORDERS TABLE
-- ==========================================
ALTER TABLE public.lab_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lab orders full access for authenticated staff" ON public.lab_orders;
DROP POLICY IF EXISTS "Lab orders full access" ON public.lab_orders;
DROP POLICY IF EXISTS "lab_orders_select_policy" ON public.lab_orders;
DROP POLICY IF EXISTS "lab_orders_insert_policy" ON public.lab_orders;
DROP POLICY IF EXISTS "lab_orders_update_policy" ON public.lab_orders;
DROP POLICY IF EXISTS "lab_orders_delete_policy" ON public.lab_orders;

CREATE POLICY "lab_orders_select_policy"
ON public.lab_orders FOR SELECT TO authenticated
USING (public.is_staff('owner', 'admin', 'receptionist', 'doctor', 'nurse', 'lab_technician', 'pharmacist', 'accountant'));

CREATE POLICY "lab_orders_insert_policy"
ON public.lab_orders FOR INSERT TO authenticated
WITH CHECK (public.is_staff('owner', 'admin', 'doctor'));

CREATE POLICY "lab_orders_update_policy"
ON public.lab_orders FOR UPDATE TO authenticated
USING (public.is_staff('owner', 'admin', 'lab_technician', 'doctor', 'accountant'))
WITH CHECK (public.is_staff('owner', 'admin', 'lab_technician', 'doctor', 'accountant'));

CREATE POLICY "lab_orders_delete_policy"
ON public.lab_orders FOR DELETE TO authenticated
USING (public.is_staff('owner', 'admin'));

-- ==========================================
-- PRESCRIPTIONS TABLE
-- ==========================================
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Prescriptions access" ON public.prescriptions;
DROP POLICY IF EXISTS "Prescriptions full access" ON public.prescriptions;
DROP POLICY IF EXISTS "prescriptions_select_policy" ON public.prescriptions;
DROP POLICY IF EXISTS "prescriptions_insert_policy" ON public.prescriptions;
DROP POLICY IF EXISTS "prescriptions_update_policy" ON public.prescriptions;
DROP POLICY IF EXISTS "prescriptions_delete_policy" ON public.prescriptions;

CREATE POLICY "prescriptions_select_policy"
ON public.prescriptions FOR SELECT TO authenticated
USING (public.is_staff('owner', 'admin', 'receptionist', 'doctor', 'nurse', 'lab_technician', 'pharmacist', 'accountant'));

CREATE POLICY "prescriptions_insert_policy"
ON public.prescriptions FOR INSERT TO authenticated
WITH CHECK (public.is_staff('owner', 'admin', 'doctor'));

CREATE POLICY "prescriptions_update_policy"
ON public.prescriptions FOR UPDATE TO authenticated
USING (public.is_staff('owner', 'admin', 'pharmacist', 'doctor'))
WITH CHECK (public.is_staff('owner', 'admin', 'pharmacist', 'doctor'));

CREATE POLICY "prescriptions_delete_policy"
ON public.prescriptions FOR DELETE TO authenticated
USING (public.is_staff('owner', 'admin'));

-- ==========================================
-- MEDICATION ORDERS TABLE
-- ==========================================
ALTER TABLE public.medication_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Medication orders access" ON public.medication_orders;
DROP POLICY IF EXISTS "Medication orders full access" ON public.medication_orders;
DROP POLICY IF EXISTS "medication_orders_select_policy" ON public.medication_orders;
DROP POLICY IF EXISTS "medication_orders_insert_policy" ON public.medication_orders;
DROP POLICY IF EXISTS "medication_orders_update_policy" ON public.medication_orders;
DROP POLICY IF EXISTS "medication_orders_delete_policy" ON public.medication_orders;

CREATE POLICY "medication_orders_select_policy"
ON public.medication_orders FOR SELECT TO authenticated
USING (public.is_staff('owner', 'admin', 'receptionist', 'doctor', 'nurse', 'lab_technician', 'pharmacist', 'accountant'));

CREATE POLICY "medication_orders_insert_policy"
ON public.medication_orders FOR INSERT TO authenticated
WITH CHECK (public.is_staff('owner', 'admin', 'doctor'));

CREATE POLICY "medication_orders_update_policy"
ON public.medication_orders FOR UPDATE TO authenticated
USING (public.is_staff('owner', 'admin', 'nurse', 'accountant', 'doctor'))
WITH CHECK (public.is_staff('owner', 'admin', 'nurse', 'accountant', 'doctor'));

CREATE POLICY "medication_orders_delete_policy"
ON public.medication_orders FOR DELETE TO authenticated
USING (public.is_staff('owner', 'admin'));

-- ==========================================
-- PAYMENTS TABLE
-- ==========================================
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Payments billing access" ON public.payments;
DROP POLICY IF EXISTS "Payments full access" ON public.payments;
DROP POLICY IF EXISTS "payments_select_policy" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_policy" ON public.payments;
DROP POLICY IF EXISTS "payments_update_policy" ON public.payments;
DROP POLICY IF EXISTS "payments_delete_policy" ON public.payments;

CREATE POLICY "payments_select_policy"
ON public.payments FOR SELECT TO authenticated
USING (public.is_staff('owner', 'admin', 'receptionist', 'doctor', 'nurse', 'lab_technician', 'pharmacist', 'accountant'));

CREATE POLICY "payments_insert_policy"
ON public.payments FOR INSERT TO authenticated
WITH CHECK (public.is_staff('owner', 'admin', 'receptionist', 'accountant', 'doctor'));

CREATE POLICY "payments_update_policy"
ON public.payments FOR UPDATE TO authenticated
USING (public.is_staff('owner', 'admin', 'accountant', 'receptionist'))
WITH CHECK (public.is_staff('owner', 'admin', 'accountant', 'receptionist'));

CREATE POLICY "payments_delete_policy"
ON public.payments FOR DELETE TO authenticated
USING (public.is_staff('owner', 'admin'));

-- ==========================================
-- MEDICINES & INVENTORY TABLE
-- ==========================================
ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Medicines inventory access" ON public.medicines;
DROP POLICY IF EXISTS "Medicines full access" ON public.medicines;
DROP POLICY IF EXISTS "medicines_select_policy" ON public.medicines;
DROP POLICY IF EXISTS "medicines_manage_policy" ON public.medicines;

CREATE POLICY "medicines_select_policy"
ON public.medicines FOR SELECT TO authenticated
USING (public.is_staff('owner', 'admin', 'receptionist', 'doctor', 'nurse', 'lab_technician', 'pharmacist', 'accountant'));

CREATE POLICY "medicines_manage_policy"
ON public.medicines FOR ALL TO authenticated
USING (public.is_staff('owner', 'admin', 'pharmacist'))
WITH CHECK (public.is_staff('owner', 'admin', 'pharmacist'));

-- ==========================================
-- SERVICES, LAB TESTS, DOCTORS, STAFF TABLES
-- ==========================================
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Services pricing access" ON public.services;
DROP POLICY IF EXISTS "Services full access" ON public.services;
CREATE POLICY "services_select_policy" ON public.services FOR SELECT TO authenticated USING (true);
CREATE POLICY "services_manage_policy" ON public.services FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER TABLE public.lab_tests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lab tests catalog access" ON public.lab_tests;
DROP POLICY IF EXISTS "Lab tests full access" ON public.lab_tests;
CREATE POLICY "lab_tests_select_policy" ON public.lab_tests FOR SELECT TO authenticated USING (true);
CREATE POLICY "lab_tests_manage_policy" ON public.lab_tests FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Doctors directory access" ON public.doctors;
DROP POLICY IF EXISTS "Doctors full access" ON public.doctors;
CREATE POLICY "doctors_select_policy" ON public.doctors FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "doctors_manage_policy" ON public.doctors FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff readable by authenticated users" ON public.staff;
DROP POLICY IF EXISTS "Staff managed by admin" ON public.staff;
DROP POLICY IF EXISTS "Staff full access" ON public.staff;
CREATE POLICY "staff_select_policy" ON public.staff FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "staff_manage_policy" ON public.staff FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Populate public.doctors from public.staff where role = 'doctor'
INSERT INTO public.doctors (id, staff_id, full_name, email, phone, specialty, doctor_type, license_number, department, availability, status)
SELECT 
  id,
  id,
  full_name,
  email,
  phone,
  COALESCE(specialization, 'General Practice'),
  'General Practitioner',
  license_number,
  department,
  'available',
  'active'
FROM public.staff
WHERE role = 'doctor'
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  specialty = EXCLUDED.specialty,
  phone = EXCLUDED.phone,
  status = 'active';
