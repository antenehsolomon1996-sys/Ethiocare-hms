import { useState, useEffect, useCallback } from 'react';
import {
  pharmacyBrandingService,
  DEFAULT_PHARMACY_BRANDING,
  PHARMACY_BRANDING_EVENT,
} from '@/services/pharmacyBranding.service';

export function usePharmacyBranding() {
  const [pharmacy, setPharmacy] = useState(() =>
    pharmacyBrandingService.getCachedBranding()
  );
  const [isLoading, setIsLoading] = useState(false);

  const refreshPharmacy = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await pharmacyBrandingService.getBranding();
      setPharmacy(data);
    } catch (err) {
      console.warn('[usePharmacyBranding] Error fetching branding:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updatePharmacy = useCallback(async (branding, updatedBy) => {
    setIsLoading(true);
    try {
      const updated = await pharmacyBrandingService.updateBranding(branding, updatedBy);
      setPharmacy(updated);
      return updated;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshPharmacy();

    // Listen to in-memory custom events across components
    const handleBrandingEvent = (e) => {
      if (e.detail) {
        setPharmacy(e.detail);
      }
    };

    // Listen to localStorage events from other tabs
    const handleStorageEvent = (e) => {
      if (e.key === 'ethiocare_pharmacy_branding' && e.newValue) {
        try {
          setPharmacy(JSON.parse(e.newValue));
        } catch {}
      }
    };

    window.addEventListener(PHARMACY_BRANDING_EVENT, handleBrandingEvent);
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      window.removeEventListener(PHARMACY_BRANDING_EVENT, handleBrandingEvent);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [refreshPharmacy]);

  return {
    pharmacy: pharmacy || DEFAULT_PHARMACY_BRANDING,
    updatePharmacy,
    isLoading,
    refreshPharmacy,
  };
}
