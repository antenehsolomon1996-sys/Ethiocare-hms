-- ==============================================================================
-- EthioCare HMS - Migration: Individual Staff Workspaces & Physical Room Assignments
-- ==============================================================================

-- 1. Extend rooms table with exclusivity and staff assignment metadata
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS is_exclusive BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS assigned_staff_id UUID,
  ADD COLUMN IF NOT EXISTS assigned_staff_name TEXT,
  ADD COLUMN IF NOT EXISTS assigned_staff_role TEXT;

-- 2. Extend staff table with physical room assignment
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS assigned_room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_room_number TEXT;

-- 3. Extend doctors table with physical room assignment
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS assigned_room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_room_number TEXT;

-- 4. Extend visits table with doctor room tracking
ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS consultation_room TEXT;

-- 5. Indexes for fast staff and room lookups
CREATE INDEX IF NOT EXISTS idx_staff_assigned_room ON public.staff(assigned_room_id);
CREATE INDEX IF NOT EXISTS idx_doctors_assigned_room ON public.doctors(assigned_room_id);
CREATE INDEX IF NOT EXISTS idx_rooms_assigned_staff ON public.rooms(assigned_staff_id);
