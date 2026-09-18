import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface HospitalSettings {
  id?: string;
  hospital_name: string;
  hospital_tagline?: string;
  hospital_logo?: string;
  phone?: string;
  alt_phone?: string;
  emergency_phone?: string;
  email?: string;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  postal_code?: string;
  website?: string;
  working_hours?: string;
  description?: string;
  accreditation_number?: string;
  dev_portal_switcher_enabled?: boolean;
  created_at?: string;
  updated_at?: string;
  updated_by?: string;
}

const STORAGE_KEY = 'ethiocare_hospital_settings';
export const HOSPITAL_BRANDING_EVENT = 'hospital-branding-updated';

export const DEFAULT_HOSPITAL_SETTINGS: HospitalSettings = {
  hospital_name: 'EthioCare Hospital',
  hospital_tagline: 'Advanced Healthcare & Diagnostic Center',
  hospital_logo: '',
  phone: '+251 11 612 3456',
  alt_phone: '+251 91 122 3344',
  emergency_phone: '+251 11 612 9999',
  email: 'info@ethiocarehospital.com',
  address: 'Bole Sub-City, Kebele 03',
  city: 'Addis Ababa',
  region: 'Addis Ababa',
  country: 'Ethiopia',
  postal_code: 'P.O. Box 1042',
  website: 'https://ethiocarehospital.com',
  working_hours: '24/7 Emergency & Inpatient · OPD Mon-Sat 8:00 AM - 8:00 PM',
  description: 'EthioCare Hospital is a premier medical institution providing compassionate, world-class healthcare in Addis Ababa, Ethiopia.',
  accreditation_number: 'EFDA-HOSP-2024-0012',
  dev_portal_switcher_enabled: true,
};

export const hospitalBrandingService = {
  /**
   * Synchronously get current hospital settings from cache or defaults
   */
  getCachedSettings(): HospitalSettings {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          return { ...DEFAULT_HOSPITAL_SETTINGS, ...JSON.parse(cached) };
        }
      } catch {}
    }
    return { ...DEFAULT_HOSPITAL_SETTINGS };
  },

  /**
   * Fetch latest settings from Supabase, falling back to local cache
   */
  async getSettings(): Promise<HospitalSettings> {
    let currentSettings = this.getCachedSettings();

    if (!isSupabaseConfigured()) {
      return currentSettings;
    }

    try {
      const { data, error } = await supabase
        .from('hospital_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        currentSettings = {
          ...currentSettings,
          ...data,
          hospital_name: data.hospital_name || DEFAULT_HOSPITAL_SETTINGS.hospital_name,
        };

        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
        }
      }
    } catch (err) {
      console.warn('[hospitalBranding] Failed to fetch from Supabase, using cache:', err);
    }

    return currentSettings;
  },

  /**
   * Update hospital settings in Supabase and local cache
   */
  async updateSettings(
    settings: Partial<HospitalSettings>,
    updatedBy = 'Owner'
  ): Promise<HospitalSettings> {
    const existing = await this.getSettings();
    const merged: HospitalSettings = {
      ...existing,
      ...settings,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    };

    // 1. Immediately update localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        // Broadcast custom event so all open tabs / components update live
        window.dispatchEvent(
          new CustomEvent(HOSPITAL_BRANDING_EVENT, { detail: merged })
        );
      } catch {}
    }

    // 2. Persist to Supabase if configured
    if (isSupabaseConfigured()) {
      try {
        const payload = {
          hospital_name: merged.hospital_name,
          hospital_tagline: merged.hospital_tagline,
          hospital_logo: merged.hospital_logo,
          phone: merged.phone,
          alt_phone: merged.alt_phone,
          emergency_phone: merged.emergency_phone,
          email: merged.email,
          address: merged.address,
          city: merged.city,
          region: merged.region,
          country: merged.country,
          postal_code: merged.postal_code,
          website: merged.website,
          working_hours: merged.working_hours,
          description: merged.description,
          accreditation_number: merged.accreditation_number,
          dev_portal_switcher_enabled: merged.dev_portal_switcher_enabled,
          updated_at: merged.updated_at,
          updated_by: merged.updated_by,
        };

        if (existing.id) {
          const { error } = await supabase
            .from('hospital_settings')
            .update(payload)
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from('hospital_settings')
            .insert(payload)
            .select()
            .maybeSingle();

          if (!error && data?.id) {
            merged.id = data.id;
            if (typeof window !== 'undefined') {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            }
          }
        }
      } catch (err) {
        console.warn('[hospitalBranding] Failed to persist to Supabase:', err);
      }
    }

    return merged;
  },
};
