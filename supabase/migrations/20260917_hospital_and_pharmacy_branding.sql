-- ==============================================================================
-- EthioCare HMS: Hospital Branding & Pharmacy Branding Schema
-- Migration Date: 2026-09-17
-- Description: Centralized hospital settings and independent pharmacy branding
-- ==============================================================================

-- 1. Hospital Settings Table (Owner Organization Branding)
CREATE TABLE IF NOT EXISTS public.hospital_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_name TEXT NOT NULL DEFAULT 'EthioCare Hospital',
  hospital_tagline TEXT DEFAULT 'Advanced Healthcare & Diagnostic Center',
  hospital_logo TEXT DEFAULT '',
  phone TEXT DEFAULT '+251 11 612 3456',
  alt_phone TEXT DEFAULT '+251 91 122 3344',
  emergency_phone TEXT DEFAULT '+251 11 612 9999',
  email TEXT DEFAULT 'info@ethiocarehospital.com',
  address TEXT DEFAULT 'Bole Sub-City, Kebele 03',
  city TEXT DEFAULT 'Addis Ababa',
  region TEXT DEFAULT 'Addis Ababa',
  country TEXT DEFAULT 'Ethiopia',
  postal_code TEXT DEFAULT 'P.O. Box 1042',
  website TEXT DEFAULT 'https://ethiocarehospital.com',
  working_hours TEXT DEFAULT '24/7 Emergency & Inpatient · OPD Mon-Sat 8:00 AM - 8:00 PM',
  description TEXT DEFAULT 'EthioCare Hospital is a premier medical institution providing compassionate, world-class healthcare in Addis Ababa, Ethiopia.',
  accreditation_number TEXT DEFAULT 'EFDA-HOSP-2024-0012',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT DEFAULT 'Owner'
);

-- 2. Pharmacy Branding Table (Independent Pharmacy Profile)
CREATE TABLE IF NOT EXISTS public.pharmacy_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_name TEXT NOT NULL DEFAULT 'EthioCare Central Pharmacy',
  pharmacy_logo TEXT DEFAULT '',
  phone TEXT DEFAULT '+251 11 612 3457',
  alt_phone TEXT DEFAULT '+251 91 133 4455',
  email TEXT DEFAULT 'pharmacy@ethiocarehospital.com',
  address TEXT DEFAULT 'Ground Floor, Medical Block A',
  city TEXT DEFAULT 'Addis Ababa',
  region TEXT DEFAULT 'Addis Ababa',
  country TEXT DEFAULT 'Ethiopia',
  license_number TEXT DEFAULT 'EFDA-PH-2024-8841',
  tin_number TEXT DEFAULT '0045892147',
  website TEXT DEFAULT 'https://ethiocarehospital.com/pharmacy',
  working_hours TEXT DEFAULT 'Open 24 Hours · Inpatient & Walk-In',
  receipt_footer TEXT DEFAULT 'Thank you for choosing EthioCare Central Pharmacy. Keep medicines in a cool, dry place.',
  default_receipt_format TEXT DEFAULT '80mm' CHECK (default_receipt_format IN ('58mm', '80mm', 'a4')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT DEFAULT 'Pharmacist'
);

-- 3. Initial Default Seed
INSERT INTO public.hospital_settings (
  hospital_name,
  hospital_tagline,
  phone,
  emergency_phone,
  email,
  address,
  city,
  country,
  working_hours
)
SELECT
  'EthioCare Hospital',
  'Advanced Healthcare & Diagnostic Center',
  '+251 11 612 3456',
  '+251 11 612 9999',
  'info@ethiocarehospital.com',
  'Bole Sub-City, Kebele 03',
  'Addis Ababa',
  'Ethiopia',
  '24/7 Emergency & Inpatient · OPD Mon-Sat 8:00 AM - 8:00 PM'
WHERE NOT EXISTS (SELECT 1 FROM public.hospital_settings);

INSERT INTO public.pharmacy_branding (
  pharmacy_name,
  phone,
  email,
  address,
  city,
  country,
  license_number,
  working_hours,
  default_receipt_format
)
SELECT
  'EthioCare Central Pharmacy',
  '+251 11 612 3457',
  'pharmacy@ethiocarehospital.com',
  'Ground Floor, Medical Block A',
  'Addis Ababa',
  'Ethiopia',
  'EFDA-PH-2024-8841',
  'Open 24 Hours · Inpatient & Walk-In',
  '80mm'
WHERE NOT EXISTS (SELECT 1 FROM public.pharmacy_branding);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.hospital_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_branding ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies: Hospital Settings
CREATE POLICY hospital_settings_select_policy ON public.hospital_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY hospital_settings_insert_policy ON public.hospital_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('owner', 'admin')
    )
  );

CREATE POLICY hospital_settings_update_policy ON public.hospital_settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('owner', 'admin')
    )
  );

-- 6. RLS Policies: Pharmacy Branding
CREATE POLICY pharmacy_branding_select_policy ON public.pharmacy_branding
  FOR SELECT TO authenticated USING (true);

CREATE POLICY pharmacy_branding_insert_policy ON public.pharmacy_branding
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('pharmacist', 'owner', 'admin')
    )
  );

CREATE POLICY pharmacy_branding_update_policy ON public.pharmacy_branding
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('pharmacist', 'owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('pharmacist', 'owner', 'admin')
    )
  );
