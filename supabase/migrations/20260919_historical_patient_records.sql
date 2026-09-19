-- ==============================================================================
-- EthioCare HMS - Historical Patient Records Migration
-- ==============================================================================

-- 1. Add optional historical metadata columns to patient_history if they do not exist
ALTER TABLE public.patient_history 
  ADD COLUMN IF NOT EXISTS is_historical BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS disease TEXT,
  ADD COLUMN IF NOT EXISTS examination_notes TEXT,
  ADD COLUMN IF NOT EXISTS lab_tests TEXT,
  ADD COLUMN IF NOT EXISTS nurse_records TEXT,
  ADD COLUMN IF NOT EXISTS medicines TEXT,
  ADD COLUMN IF NOT EXISTS medical_reports TEXT,
  ADD COLUMN IF NOT EXISTS record_source TEXT DEFAULT 'manual_historical',
  ADD COLUMN IF NOT EXISTS digitized_by TEXT,
  ADD COLUMN IF NOT EXISTS digitized_at TIMESTAMPTZ DEFAULT now();

-- 2. Performance indexes for 30-day lookup and historical querying
CREATE INDEX IF NOT EXISTS idx_patient_history_visit_date 
  ON public.patient_history(visit_date);

CREATE INDEX IF NOT EXISTS idx_patient_history_patient_date 
  ON public.patient_history(patient_id, visit_date DESC);

-- 3. Ensure RLS allows full access to patient_history for staff
ALTER TABLE public.patient_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Patient history full access" ON public.patient_history;
CREATE POLICY "Patient history full access" ON public.patient_history
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
