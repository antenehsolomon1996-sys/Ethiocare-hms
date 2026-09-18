import { useState, useEffect, useCallback } from 'react';
import {
  hospitalBrandingService,
  DEFAULT_HOSPITAL_SETTINGS,
  HOSPITAL_BRANDING_EVENT,
} from '@/services/hospitalBranding.service';

export function useHospitalBranding() {
  const [hospital, setHospital] = useState(() =>
    hospitalBrandingService.getCachedSettings()
  );
  const [isLoading, setIsLoading] = useState(false);

  const refreshHospital = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await hospitalBrandingService.getSettings();
      setHospital(data);
    } catch (err) {
      console.warn('[useHospitalBranding] Error fetching settings:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateHospital = useCallback(async (settings, updatedBy) => {
    setIsLoading(true);
    try {
      const updated = await hospitalBrandingService.updateSettings(settings, updatedBy);
      setHospital(updated);
      return updated;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshHospital();

    // Listen to in-memory custom events across components
    const handleBrandingEvent = (e) => {
      if (e.detail) {
        setHospital(e.detail);
      }
    };

    // Listen to localStorage events from other tabs
    const handleStorageEvent = (e) => {
      if (e.key === 'ethiocare_hospital_settings' && e.newValue) {
        try {
          setHospital(JSON.parse(e.newValue));
        } catch {}
      }
    };

    window.addEventListener(HOSPITAL_BRANDING_EVENT, handleBrandingEvent);
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      window.removeEventListener(HOSPITAL_BRANDING_EVENT, handleBrandingEvent);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [refreshHospital]);

  return {
    hospital: hospital || DEFAULT_HOSPITAL_SETTINGS,
    updateHospital,
    isLoading,
    refreshHospital,
  };
}
