import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface PharmacySettings {
  id?: string;
  enable_retail_sales: boolean;
  require_customer_name: boolean;
  require_customer_phone: boolean;
  require_customer_age: boolean;
  require_customer_type: boolean; // Adult / Child
  require_customer_weight: boolean;
  require_dosage_instructions: boolean;
  require_prescription_number: boolean; // Required when Rx medicine is present
  default_storage_location: string;
  updated_at?: string;
  updated_by?: string;
}

const STORAGE_KEY = 'ethiocare_pharmacy_settings';

export const DEFAULT_PHARMACY_SETTINGS: PharmacySettings = {
  enable_retail_sales: true,
  require_customer_name: false,
  require_customer_phone: false,
  require_customer_age: false,
  require_customer_type: false,
  require_customer_weight: false,
  require_dosage_instructions: false,
  require_prescription_number: false,
  default_storage_location: 'Main Pharmacy Store'
};

export const pharmacySettingsService = {
  /**
   * Get current settings from Supabase or local storage
   */
  async getSettings(): Promise<PharmacySettings> {
    let currentSettings = { ...DEFAULT_PHARMACY_SETTINGS };

    // Try local storage first as base
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          currentSettings = { ...currentSettings, ...JSON.parse(cached) };
        }
      } catch {}
    }

    if (!isSupabaseConfigured()) {
      return currentSettings;
    }

    try {
      const { data, error } = await supabase
        .from('pharmacy_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        currentSettings = {
          id: data.id,
          enable_retail_sales: data.enable_retail_sales ?? true,
          require_customer_name: data.require_customer_name ?? false,
          require_customer_phone: data.require_customer_phone ?? false,
          require_customer_age: data.require_customer_age ?? false,
          require_customer_type: data.require_customer_type ?? false,
          require_customer_weight: data.require_customer_weight ?? false,
          require_dosage_instructions: data.require_dosage_instructions ?? false,
          require_prescription_number: data.require_prescription_number ?? false,
          default_storage_location: data.default_storage_location || 'Main Pharmacy Store',
          updated_at: data.updated_at,
          updated_by: data.updated_by
        };

        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
        }
      }
    } catch {
      // Return cached settings if query fails
    }

    return currentSettings;
  },

  /**
   * Update pharmacy settings
   */
  async updateSettings(settings: Partial<PharmacySettings>, updatedBy = 'Pharmacist'): Promise<PharmacySettings> {
    const existing = await this.getSettings();
    const merged: PharmacySettings = {
      ...existing,
      ...settings,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy
    };

    // Save to local cache
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch {}
    }

    if (isSupabaseConfigured()) {
      try {
        if (existing.id) {
          await supabase
            .from('pharmacy_settings')
            .update({
              enable_retail_sales: merged.enable_retail_sales,
              require_customer_name: merged.require_customer_name,
              require_customer_phone: merged.require_customer_phone,
              require_customer_age: merged.require_customer_age,
              require_customer_type: merged.require_customer_type,
              require_customer_weight: merged.require_customer_weight,
              require_dosage_instructions: merged.require_dosage_instructions,
              require_prescription_number: merged.require_prescription_number,
              default_storage_location: merged.default_storage_location,
              updated_at: merged.updated_at,
              updated_by: merged.updated_by
            })
            .eq('id', existing.id);
        } else {
          const { data } = await supabase
            .from('pharmacy_settings')
            .insert({
              enable_retail_sales: merged.enable_retail_sales,
              require_customer_name: merged.require_customer_name,
              require_customer_phone: merged.require_customer_phone,
              require_customer_age: merged.require_customer_age,
              require_customer_type: merged.require_customer_type,
              require_customer_weight: merged.require_customer_weight,
              require_dosage_instructions: merged.require_dosage_instructions,
              require_prescription_number: merged.require_prescription_number,
              default_storage_location: merged.default_storage_location,
              updated_by: merged.updated_by
            })
            .select()
            .maybeSingle();

          if (data?.id) {
            merged.id = data.id;
            if (typeof window !== 'undefined') {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            }
          }
        }
      } catch (err) {
        console.warn('[pharmacySettings] Failed to persist to Supabase:', err);
      }
    }

    return merged;
  },

  /**
   * Validate POS checkout parameters against current rules
   */
  validateCheckoutRules({
    settings,
    customer,
    items,
    medicinesCatalog
  }: {
    settings: PharmacySettings;
    customer: {
      name?: string;
      phone?: string;
      type?: 'Adult' | 'Child';
      age?: number | string;
      weight?: number | string;
      prescriptionNumber?: string;
    };
    items: Array<{
      medicineId: string;
      name: string;
      dosageInstructions?: string;
    }>;
    medicinesCatalog?: Array<{
      id: string;
      prescription_required?: boolean;
    }>;
  }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!settings.enable_retail_sales) {
      errors.push('Walk-in retail sales are currently disabled by pharmacy policy.');
      return { valid: false, errors };
    }

    if (settings.require_customer_name && (!customer.name || !customer.name.trim())) {
      errors.push('Customer Name is required per pharmacy policy.');
    }

    if (settings.require_customer_phone && (!customer.phone || !customer.phone.trim())) {
      errors.push('Customer Phone is required per pharmacy policy.');
    }

    if (settings.require_customer_type && !customer.type) {
      errors.push('Customer Classification (Adult / Child) is required.');
    }

    if (settings.require_customer_age && (!customer.age || Number(customer.age) <= 0)) {
      errors.push('Valid Customer Age is required.');
    }

    if (settings.require_customer_weight && (!customer.weight || Number(customer.weight) <= 0)) {
      errors.push('Valid Customer Weight (kg) is required.');
    }

    if (settings.require_dosage_instructions) {
      const missingDosage = items.filter(it => !it.dosageInstructions || !it.dosageInstructions.trim());
      if (missingDosage.length > 0) {
        errors.push(`Dosage instructions required for: ${missingDosage.map(i => i.name).join(', ')}`);
      }
    }

    if (settings.require_prescription_number) {
      // Check if any item in cart requires prescription
      const hasRxItem = items.some(it => {
        const found = medicinesCatalog?.find(m => m.id === it.medicineId);
        return found?.prescription_required === true;
      });

      if (hasRxItem && (!customer.prescriptionNumber || !customer.prescriptionNumber.trim())) {
        errors.push('Prescription Number is required because one or more items are Prescription Only (Rx).');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
};
