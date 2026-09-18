-- ==============================================================================
-- EthioCare HMS: Add Development Portal Switcher setting to Hospital Settings
-- Migration Date: 2026-09-17
-- Description: Supports Owner/Admin toggle to show or hide the Development
--              Portal Switcher on login pages.
-- ==============================================================================

ALTER TABLE public.hospital_settings 
ADD COLUMN IF NOT EXISTS dev_portal_switcher_enabled BOOLEAN DEFAULT true;

-- Update existing records if dev_portal_switcher_enabled is null
UPDATE public.hospital_settings 
SET dev_portal_switcher_enabled = true 
WHERE dev_portal_switcher_enabled IS NULL;
