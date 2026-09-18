-- ==============================================================================
-- EthioCare HMS - Complete Database Schema Migration
-- ==============================================================================

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Helper function for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 1. Profiles Table (extends auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'doctor' CHECK (role IN ('owner', 'admin', 'receptionist', 'doctor', 'nurse', 'lab_technician', 'pharmacist', 'accountant')),
  department TEXT,
  specialization TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'retired')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 2. Staff Directory Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  personal_email TEXT,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'receptionist', 'doctor', 'nurse', 'lab_technician', 'pharmacist', 'accountant')),
  department TEXT,
  specialization TEXT,
  phone TEXT,
  license_number TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'retired')),
  activation_code TEXT,
  activation_used BOOLEAN NOT NULL DEFAULT false,
  password_set BOOLEAN NOT NULL DEFAULT false,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_staff_updated_at
BEFORE UPDATE ON public.staff
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 3. Doctors Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  specialty TEXT NOT NULL,
  doctor_type TEXT NOT NULL DEFAULT 'General Practitioner' CHECK (doctor_type IN ('General Practitioner', 'Specialist', 'Consultant', 'Resident')),
  license_number TEXT,
  department TEXT,
  bio TEXT,
  years_experience NUMERIC DEFAULT 0,
  availability TEXT NOT NULL DEFAULT 'available' CHECK (availability IN ('available', 'busy', 'off_duty', 'on_leave')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_doctors_updated_at
BEFORE UPDATE ON public.doctors
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 4. Patients Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female')),
  age INTEGER,
  date_of_birth DATE,
  address TEXT,
  phone TEXT NOT NULL,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  registration_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_patients_updated_at
BEFORE UPDATE ON public.patients
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 5. Visits Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  queue_number INTEGER,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'with_doctor', 'lab_pending', 'lab_paid', 'lab_processing', 'lab_complete', 'pharmacy', 'completed', 'cancelled')),
  assigned_doctor TEXT,
  assigned_doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
  billing_completed BOOLEAN NOT NULL DEFAULT false,
  consultation_completed BOOLEAN NOT NULL DEFAULT false,
  registration_fee_paid BOOLEAN NOT NULL DEFAULT false,
  symptoms TEXT,
  examination_notes TEXT,
  diagnosis TEXT,
  disease TEXT,
  treatment_plan TEXT,
  final_diagnosis TEXT,
  final_treatment TEXT,
  follow_up_date DATE,
  follow_up_notes TEXT,
  department TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_visits_updated_at
BEFORE UPDATE ON public.visits
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 6. Vitals Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  patient_name TEXT,
  blood_pressure_systolic NUMERIC,
  blood_pressure_diastolic NUMERIC,
  temperature NUMERIC,
  pulse NUMERIC,
  weight NUMERIC,
  height NUMERIC,
  oxygen_level NUMERIC,
  nurse_notes TEXT,
  recorded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_vitals_updated_at
BEFORE UPDATE ON public.vitals
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 7. Nurse Tasks Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nurse_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  patient_name TEXT,
  task_type TEXT NOT NULL CHECK (task_type IN ('injection', 'iv_treatment', 'procedure', 'vitals', 'other')),
  description TEXT,
  instructions TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  notes TEXT,
  doctor_name TEXT,
  completed_by TEXT,
  completed_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_nurse_tasks_updated_at
BEFORE UPDATE ON public.nurse_tasks
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 8. Lab Orders Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lab_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  doctor_name TEXT,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
  test_type TEXT NOT NULL,
  test_name TEXT,
  notes TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'cancelled')),
  test_status TEXT NOT NULL DEFAULT 'awaiting_payment' CHECK (test_status IN ('awaiting_payment', 'pending', 'in_progress', 'completed')),
  results TEXT,
  result_notes TEXT,
  result_file_url TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  completed_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_lab_orders_updated_at
BEFORE UPDATE ON public.lab_orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 9. Lab Tests Catalog Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Blood',
  price NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  turnaround_time TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_lab_tests_updated_at
BEFORE UPDATE ON public.lab_tests
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 10. Medicines & Inventory Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medicines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  generic_name TEXT,
  brand TEXT,
  category TEXT,
  dosage_form TEXT CHECK (dosage_form IN ('Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Drops', 'Inhaler', 'Cream', 'Suppository', 'Other')),
  strength TEXT,
  barcode TEXT,
  sku TEXT,
  batch_number TEXT,
  manufacturer TEXT,
  supplier TEXT,
  purchase_price NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  tax NUMERIC NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 10,
  max_stock INTEGER NOT NULL DEFAULT 100,
  unit TEXT NOT NULL DEFAULT 'pieces',
  expiry_date DATE,
  manufacturing_date DATE,
  storage_location TEXT,
  prescription_required BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'low_stock', 'out_of_stock', 'expired')),
  archived BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_medicines_updated_at
BEFORE UPDATE ON public.medicines
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 11. Medication Orders Table (Cross-portal Doctor -> Billing -> Nurse)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medication_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  doctor_name TEXT,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
  order_type TEXT NOT NULL CHECK (order_type IN ('medicine', 'injection', 'iv_treatment', 'medical_supply', 'other')),
  item_name TEXT NOT NULL,
  dosage TEXT,
  frequency TEXT,
  duration TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  instructions TEXT,
  urgency TEXT NOT NULL DEFAULT 'routine' CHECK (urgency IN ('routine', 'urgent', 'stat')),
  payment_status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (payment_status IN ('pending_payment', 'paid', 'waived', 'cancelled')),
  administration_status TEXT NOT NULL DEFAULT 'awaiting_payment' CHECK (administration_status IN ('awaiting_payment', 'pending', 'in_progress', 'completed', 'refused')),
  payment_id UUID,
  receipt_number TEXT,
  paid_by TEXT,
  paid_date DATE,
  administered_by TEXT,
  administered_date DATE,
  administration_notes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_medication_orders_updated_at
BEFORE UPDATE ON public.medication_orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 12. Prescriptions Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  doctor_name TEXT,
  medicine_name TEXT NOT NULL,
  dosage TEXT,
  frequency TEXT,
  duration TEXT,
  instructions TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dispensed', 'cancelled')),
  dispensed_date DATE,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'cancelled')),
  price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_prescriptions_updated_at
BEFORE UPDATE ON public.prescriptions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 13. Payments Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID REFERENCES public.visits(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  patient_name TEXT,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('registration', 'consultation', 'laboratory', 'procedure', 'injection', 'medicine', 'other')),
  description TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'mobile_banking', 'card', 'insurance')),
  receipt_number TEXT,
  reference_id TEXT,
  reference_type TEXT CHECK (reference_type IN ('lab_order', 'prescription', 'service', 'registration', 'medication_order')),
  cashier_name TEXT,
  paid_date DATE,
  doctor_name TEXT,
  doctor_id TEXT,
  medication_order_id TEXT,
  medication_name TEXT,
  dosage TEXT,
  quantity NUMERIC,
  frequency TEXT,
  route TEXT,
  order_notes TEXT,
  order_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 14. Patient History Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patient_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  patient_phone TEXT,
  patient_gender TEXT,
  patient_dob DATE,
  visit_id UUID REFERENCES public.visits(id) ON DELETE SET NULL,
  visit_date DATE NOT NULL,
  doctor_name TEXT NOT NULL,
  doctor_specialty TEXT,
  symptoms TEXT,
  diagnosis TEXT,
  treatment TEXT,
  prescription TEXT,
  lab_results TEXT,
  notes TEXT,
  follow_up_date DATE,
  blood_pressure TEXT,
  temperature TEXT,
  weight TEXT,
  pulse TEXT,
  record_type TEXT NOT NULL DEFAULT 'visit' CHECK (record_type IN ('visit', 'lab', 'prescription', 'note', 'vitals')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_patient_history_updated_at
BEFORE UPDATE ON public.patient_history
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 15. Services Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('consultation', 'procedure', 'injection', 'registration', 'other')),
  price NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_services_updated_at
BEFORE UPDATE ON public.services
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 16. Audit Logs Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name TEXT NOT NULL,
  user_role TEXT,
  action TEXT NOT NULL CHECK (action IN ('login', 'logout', 'create', 'update', 'delete', 'view', 'print', 'approve', 'reject')),
  module TEXT NOT NULL,
  description TEXT,
  record_id TEXT,
  record_name TEXT,
  ip_address TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- INDEXES FOR FREQUENT QUERIES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_staff_email ON public.staff(email);
CREATE INDEX IF NOT EXISTS idx_staff_role ON public.staff(role);
CREATE INDEX IF NOT EXISTS idx_staff_activation_code ON public.staff(activation_code);

CREATE INDEX IF NOT EXISTS idx_doctors_specialty ON public.doctors(specialty);
CREATE INDEX IF NOT EXISTS idx_doctors_status ON public.doctors(status);

CREATE INDEX IF NOT EXISTS idx_patients_patient_id ON public.patients(patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_full_name ON public.patients(full_name);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON public.patients(phone);

CREATE INDEX IF NOT EXISTS idx_visits_date ON public.visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_visits_status ON public.visits(status);
CREATE INDEX IF NOT EXISTS idx_visits_patient_id ON public.visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_doctor_id ON public.visits(assigned_doctor_id);

CREATE INDEX IF NOT EXISTS idx_vitals_visit_id ON public.vitals(visit_id);
CREATE INDEX IF NOT EXISTS idx_vitals_patient_id ON public.vitals(patient_id);

CREATE INDEX IF NOT EXISTS idx_nurse_tasks_visit_id ON public.nurse_tasks(visit_id);
CREATE INDEX IF NOT EXISTS idx_nurse_tasks_status ON public.nurse_tasks(status);

CREATE INDEX IF NOT EXISTS idx_lab_orders_visit_id ON public.lab_orders(visit_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_payment_status ON public.lab_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_lab_orders_test_status ON public.lab_orders(test_status);

CREATE INDEX IF NOT EXISTS idx_medicines_name ON public.medicines(name);
CREATE INDEX IF NOT EXISTS idx_medicines_barcode ON public.medicines(barcode);
CREATE INDEX IF NOT EXISTS idx_medicines_status ON public.medicines(status);

CREATE INDEX IF NOT EXISTS idx_medication_orders_visit_id ON public.medication_orders(visit_id);
CREATE INDEX IF NOT EXISTS idx_medication_orders_payment_status ON public.medication_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_medication_orders_admin_status ON public.medication_orders(administration_status);

CREATE INDEX IF NOT EXISTS idx_prescriptions_visit_id ON public.prescriptions(visit_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON public.prescriptions(status);

CREATE INDEX IF NOT EXISTS idx_payments_visit_id ON public.payments(visit_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON public.payments(reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_patient_history_patient_id ON public.patient_history(patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON public.audit_logs(module);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nurse_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper to check if current user is owner/admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles: users can read all profiles (staff directory) and update their own
CREATE POLICY "Profiles readable by authenticated users"
ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "Admins can insert or manage any profile"
ON public.profiles FOR ALL TO authenticated USING (public.is_admin());

-- Staff: readable by authenticated users, manageable by admin/owner, activation check open for unauthenticated
CREATE POLICY "Staff readable by authenticated users"
ON public.staff FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff activation verify allowed for anonymous"
ON public.staff FOR SELECT TO anon USING (activation_used = false);

CREATE POLICY "Staff managed by admin"
ON public.staff FOR ALL TO authenticated USING (public.is_admin());

CREATE POLICY "Staff activation code marked used"
ON public.staff FOR UPDATE TO anon USING (activation_used = false) WITH CHECK (activation_used = true);

-- General clinical tables (patients, visits, vitals, nurse_tasks, lab_orders, prescriptions, medication_orders, payments, patient_history)
-- Accessible by all authenticated clinical staff members
CREATE POLICY "Patients full access for authenticated staff"
ON public.patients FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Visits full access for authenticated staff"
ON public.visits FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Vitals full access for authenticated staff"
ON public.vitals FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Nurse tasks full access for authenticated staff"
ON public.nurse_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Lab orders full access for authenticated staff"
ON public.lab_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Lab tests catalog access"
ON public.lab_tests FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Medicines inventory access"
ON public.medicines FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Medication orders access"
ON public.medication_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Prescriptions access"
ON public.prescriptions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Payments billing access"
ON public.payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Patient history clinical access"
ON public.patient_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Services pricing access"
ON public.services FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Doctors directory access"
ON public.doctors FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Audit logs: readable by admins/owners, insertable by any authenticated staff member
CREATE POLICY "Audit logs insertable by any authenticated user"
ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Audit logs viewable by authenticated admins and staff"
ON public.audit_logs FOR SELECT TO authenticated USING (true);

-- Automatic Profile Creation Trigger on Supabase Auth SignUp
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT := 'doctor';
  v_name TEXT := 'Staff User';
  v_dept TEXT := '';
  v_spec TEXT := '';
  v_phone TEXT := '';
BEGIN
  -- Try to pull pre-configured details from staff table matching this email
  SELECT role, full_name, department, specialization, phone
  INTO v_role, v_name, v_dept, v_spec, v_phone
  FROM public.staff
  WHERE LOWER(email) = LOWER(NEW.email)
  LIMIT 1;

  INSERT INTO public.profiles (id, email, full_name, role, department, specialization, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', v_name),
    COALESCE(NEW.raw_user_meta_data->>'role', v_role, 'doctor'),
    COALESCE(NEW.raw_user_meta_data->>'department', v_dept),
    COALESCE(NEW.raw_user_meta_data->>'specialization', v_spec),
    COALESCE(NEW.raw_user_meta_data->>'phone', v_phone)
  )
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute upon user creation in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- STORAGE BUCKETS SETUP
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('lab-results', 'lab-results', true),
  ('medicine-images', 'medicine-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
CREATE POLICY "Authenticated users can upload lab results"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'lab-results');

CREATE POLICY "Lab results are viewable by authenticated users"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'lab-results');

CREATE POLICY "Authenticated users can upload medicine images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'medicine-images');

CREATE POLICY "Medicine images are publicly readable"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'medicine-images');
