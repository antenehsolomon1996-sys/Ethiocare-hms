import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface PharmacyBranding {
  id?: string;
  pharmacy_name: string;
  pharmacy_logo?: string;
  phone?: string;
  alt_phone?: string;
  email?: string;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  license_number?: string;
  tin_number?: string;
  website?: string;
  working_hours?: string;
  receipt_footer?: string;
  default_receipt_format?: '58mm' | '80mm' | 'a4';
  created_at?: string;
  updated_at?: string;
  updated_by?: string;
}

const STORAGE_KEY = 'ethiocare_pharmacy_branding';
export const PHARMACY_BRANDING_EVENT = 'pharmacy-branding-updated';

export const DEFAULT_PHARMACY_BRANDING: PharmacyBranding = {
  pharmacy_name: 'EthioCare Central Pharmacy',
  pharmacy_logo: '',
  phone: '+251 11 612 3457',
  alt_phone: '+251 91 133 4455',
  email: 'pharmacy@ethiocarehospital.com',
  address: 'Ground Floor, Medical Block A',
  city: 'Addis Ababa',
  region: 'Addis Ababa',
  country: 'Ethiopia',
  license_number: 'EFDA-PH-2024-8841',
  tin_number: '0045892147',
  website: 'https://ethiocarehospital.com/pharmacy',
  working_hours: 'Open 24 Hours · Inpatient & Walk-In',
  receipt_footer: 'Thank you for choosing EthioCare Central Pharmacy. Keep medicines in a cool, dry place.',
  default_receipt_format: '80mm',
};

export const pharmacyBrandingService = {
  /**
   * Synchronously get cached pharmacy branding
   */
  getCachedBranding(): PharmacyBranding {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          return { ...DEFAULT_PHARMACY_BRANDING, ...JSON.parse(cached) };
        }
      } catch {}
    }
    return { ...DEFAULT_PHARMACY_BRANDING };
  },

  /**
   * Fetch latest pharmacy branding from Supabase, fallback to cache
   */
  async getBranding(): Promise<PharmacyBranding> {
    let currentBranding = this.getCachedBranding();

    if (!isSupabaseConfigured()) {
      return currentBranding;
    }

    try {
      const { data, error } = await supabase
        .from('pharmacy_branding')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        currentBranding = {
          ...currentBranding,
          ...data,
          pharmacy_name: data.pharmacy_name || DEFAULT_PHARMACY_BRANDING.pharmacy_name,
          default_receipt_format: data.default_receipt_format || '80mm',
        };

        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(currentBranding));
        }
      }
    } catch (err) {
      console.warn('[pharmacyBranding] Failed to fetch from Supabase, using cache:', err);
    }

    return currentBranding;
  },

  /**
   * Update pharmacy branding in Supabase and local cache
   */
  async updateBranding(
    branding: Partial<PharmacyBranding>,
    updatedBy = 'Pharmacist'
  ): Promise<PharmacyBranding> {
    const existing = await this.getBranding();
    const merged: PharmacyBranding = {
      ...existing,
      ...branding,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    };

    // 1. Immediately update localStorage and notify listeners
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        window.dispatchEvent(
          new CustomEvent(PHARMACY_BRANDING_EVENT, { detail: merged })
        );
      } catch {}
    }

    // 2. Persist to Supabase if configured
    if (isSupabaseConfigured()) {
      try {
        const payload = {
          pharmacy_name: merged.pharmacy_name,
          pharmacy_logo: merged.pharmacy_logo,
          phone: merged.phone,
          alt_phone: merged.alt_phone,
          email: merged.email,
          address: merged.address,
          city: merged.city,
          region: merged.region,
          country: merged.country,
          license_number: merged.license_number,
          tin_number: merged.tin_number,
          website: merged.website,
          working_hours: merged.working_hours,
          receipt_footer: merged.receipt_footer,
          default_receipt_format: merged.default_receipt_format || '80mm',
          updated_at: merged.updated_at,
          updated_by: merged.updated_by,
        };

        if (existing.id) {
          const { error } = await supabase
            .from('pharmacy_branding')
            .update(payload)
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from('pharmacy_branding')
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
        console.warn('[pharmacyBranding] Failed to persist to Supabase:', err);
      }
    }

    return merged;
  },
};
