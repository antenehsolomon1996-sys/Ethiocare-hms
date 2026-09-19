-- ==============================================================================
-- EthioCare HMS - Core Architecture Migration: Individual Staff Portals,
-- Workload Assignments, and Room & Bed Service Management
-- ==============================================================================

-- 1. Create Rooms Table
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number TEXT NOT NULL UNIQUE,
  room_type TEXT NOT NULL DEFAULT 'standard' CHECK (room_type IN ('general_ward', 'semi_private', 'private', 'icu', 'emergency', 'maternity', 'pediatric', 'standard')),
  department TEXT DEFAULT 'Inpatient Ward',
  floor TEXT DEFAULT '1st Floor',
  daily_rate NUMERIC NOT NULL DEFAULT 500,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'maintenance', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create Beds Table
CREATE TABLE IF NOT EXISTS public.beds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  bed_number TEXT NOT NULL,
  bed_label TEXT,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved', 'maintenance', 'released')),
  current_patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  current_patient_name TEXT,
  current_visit_id UUID REFERENCES public.visits(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_room_bed UNIQUE (room_id, bed_number)
);

-- 3. Create Bed Assignments Table (Audit & Inpatient Stay History)
CREATE TABLE IF NOT EXISTS public.bed_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bed_id UUID NOT NULL REFERENCES public.beds(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  visit_id UUID REFERENCES public.visits(id) ON DELETE SET NULL,
  admitted_by TEXT,
  admission_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  discharge_date TIMESTAMPTZ,
  daily_rate NUMERIC NOT NULL DEFAULT 500,
  status TEXT NOT NULL DEFAULT 'admitted' CHECK (status IN ('pending_payment', 'admitted', 'discharged', 'transferred', 'cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'waived')),
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Extend public.visits with Bed and Staff Assignment Tracking
ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS bed_assigned BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS bed_status TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS room_number TEXT,
  ADD COLUMN IF NOT EXISTS bed_number TEXT,
  ADD COLUMN IF NOT EXISTS assigned_bed_id UUID REFERENCES public.beds(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_nurse_id UUID,
  ADD COLUMN IF NOT EXISTS assigned_nurse_name TEXT;

-- 5. Extend public.lab_orders with Lab Assistant Assignment Tracking
ALTER TABLE public.lab_orders
  ADD COLUMN IF NOT EXISTS assigned_assistant_id UUID,
  ADD COLUMN IF NOT EXISTS assigned_assistant_name TEXT;

-- 6. Extend public.nurse_tasks and public.medication_orders with Nurse Assignment Tracking
ALTER TABLE public.nurse_tasks
  ADD COLUMN IF NOT EXISTS assigned_nurse_id UUID,
  ADD COLUMN IF NOT EXISTS assigned_nurse_name TEXT;

ALTER TABLE public.medication_orders
  ADD COLUMN IF NOT EXISTS assigned_nurse_id UUID,
  ADD COLUMN IF NOT EXISTS assigned_nurse_name TEXT;

-- 7. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_beds_room_id ON public.beds(room_id);
CREATE INDEX IF NOT EXISTS idx_beds_status ON public.beds(status);
CREATE INDEX IF NOT EXISTS idx_bed_assignments_patient ON public.bed_assignments(patient_id);
CREATE INDEX IF NOT EXISTS idx_bed_assignments_status ON public.bed_assignments(status);
CREATE INDEX IF NOT EXISTS idx_visits_bed_status ON public.visits(bed_status);
CREATE INDEX IF NOT EXISTS idx_visits_doctor_date ON public.visits(assigned_doctor_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_lab_orders_assistant ON public.lab_orders(assigned_assistant_id, test_status);
CREATE INDEX IF NOT EXISTS idx_nurse_tasks_nurse ON public.nurse_tasks(assigned_nurse_id, status);
CREATE INDEX IF NOT EXISTS idx_med_orders_nurse ON public.medication_orders(assigned_nurse_id, administration_status);

-- 8. Row Level Security Policies
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bed_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Rooms full access" ON public.rooms;
CREATE POLICY "Rooms full access" ON public.rooms
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Beds full access" ON public.beds;
CREATE POLICY "Beds full access" ON public.beds
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Bed assignments full access" ON public.bed_assignments;
CREATE POLICY "Bed assignments full access" ON public.bed_assignments
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 9. Seed Standard Hospital Rooms and Beds
DO $$
DECLARE
  r101 UUID;
  r102 UUID;
  r201 UUID;
  r204 UUID;
  r301 UUID;
BEGIN
  -- Room 101: General Ward (Floor 1)
  INSERT INTO public.rooms (room_number, room_type, department, floor, daily_rate, status)
  VALUES ('101', 'general_ward', 'General Inpatient', '1st Floor', 350, 'available')
  ON CONFLICT (room_number) DO UPDATE SET daily_rate = 350
  RETURNING id INTO r101;

  INSERT INTO public.beds (room_id, bed_number, bed_label, status)
  VALUES 
    (r101, 'B-01', 'Room 101 - Bed B-01', 'available'),
    (r101, 'B-02', 'Room 101 - Bed B-02', 'available'),
    (r101, 'B-03', 'Room 101 - Bed B-03', 'available'),
    (r101, 'B-04', 'Room 101 - Bed B-04', 'available')
  ON CONFLICT (room_id, bed_number) DO NOTHING;

  -- Room 102: Pediatric Ward (Floor 1)
  INSERT INTO public.rooms (room_number, room_type, department, floor, daily_rate, status)
  VALUES ('102', 'pediatric', 'Pediatrics', '1st Floor', 400, 'available')
  ON CONFLICT (room_number) DO UPDATE SET daily_rate = 400
  RETURNING id INTO r102;

  INSERT INTO public.beds (room_id, bed_number, bed_label, status)
  VALUES 
    (r102, 'B-01', 'Room 102 - Bed B-01', 'available'),
    (r102, 'B-02', 'Room 102 - Bed B-02', 'available')
  ON CONFLICT (room_id, bed_number) DO NOTHING;

  -- Room 201: Semi-Private Ward (Floor 2)
  INSERT INTO public.rooms (room_number, room_type, department, floor, daily_rate, status)
  VALUES ('201', 'semi_private', 'Inpatient Ward', '2nd Floor', 600, 'available')
  ON CONFLICT (room_number) DO UPDATE SET daily_rate = 600
  RETURNING id INTO r201;

  INSERT INTO public.beds (room_id, bed_number, bed_label, status)
  VALUES 
    (r201, 'B-01', 'Room 201 - Bed B-01', 'available'),
    (r201, 'B-02', 'Room 201 - Bed B-02', 'available')
  ON CONFLICT (room_id, bed_number) DO NOTHING;

  -- Room 204: Standard Inpatient Room (Floor 2)
  INSERT INTO public.rooms (room_number, room_type, department, floor, daily_rate, status)
  VALUES ('204', 'standard', 'Inpatient Ward', '2nd Floor', 500, 'available')
  ON CONFLICT (room_number) DO UPDATE SET daily_rate = 500
  RETURNING id INTO r204;

  INSERT INTO public.beds (room_id, bed_number, bed_label, status)
  VALUES 
    (r204, 'B-01', 'Room 204 - Bed B-01', 'available'),
    (r204, 'B-02', 'Room 204 - Bed B-02', 'available')
  ON CONFLICT (room_id, bed_number) DO NOTHING;

  -- Room 301: Intensive Care Unit (Floor 3)
  INSERT INTO public.rooms (room_number, room_type, department, floor, daily_rate, status)
  VALUES ('301', 'icu', 'Intensive Care Unit (ICU)', '3rd Floor', 1200, 'available')
  ON CONFLICT (room_number) DO UPDATE SET daily_rate = 1200
  RETURNING id INTO r301;

  INSERT INTO public.beds (room_id, bed_number, bed_label, status)
  VALUES 
    (r301, 'B-01', 'Room 301 - Bed B-01', 'available'),
    (r301, 'B-02', 'Room 301 - Bed B-02', 'available')
  ON CONFLICT (room_id, bed_number) DO NOTHING;
END $$;
