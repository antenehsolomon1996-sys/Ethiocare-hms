import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';

const DoctorContext = createContext(null);

export function DoctorProvider({ children }) {
  const { user } = useAuth();
  const [selectedDoctor, setSelectedDoctorState] = useState(() => {
    try {
      const stored = localStorage.getItem('hms_selected_doctor');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [activeDoctors, setActiveDoctors] = useState([]);
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);

  // Sync to localStorage
  const setSelectedDoctor = useCallback((doctor) => {
    setSelectedDoctorState(doctor);
    if (doctor) {
      localStorage.setItem('hms_selected_doctor', JSON.stringify(doctor));
    } else {
      localStorage.removeItem('hms_selected_doctor');
    }
  }, []);

  // Update availability in both state and backend
  const updateDoctorAvailability = useCallback(async (newStatus) => {
    if (!selectedDoctor?.id) return;
    try {
      setSelectedDoctorState(prev => prev ? { ...prev, availability: newStatus } : prev);
      const stored = localStorage.getItem('hms_selected_doctor');
      if (stored) {
        const parsed = JSON.parse(stored);
        localStorage.setItem('hms_selected_doctor', JSON.stringify({ ...parsed, availability: newStatus }));
      }
      await base44.entities.Doctor.update(selectedDoctor.id, { availability: newStatus });
    } catch (err) {
      console.warn('[DoctorContext] Failed to update availability:', err);
    }
  }, [selectedDoctor?.id]);

  // Load and auto-bind doctor
  useEffect(() => {
    let isMounted = true;
    async function loadDoctors() {
      try {
        setIsLoadingDoctors(true);
        const docs = await base44.entities.Doctor.list();
        if (!isMounted) return;

        // Deduplicate
        const seenIds = new Set();
        const seenCanonical = new Set();
        const unique = (docs || []).filter(d => {
          if (!d || !d.id || (d.status && d.status !== 'active')) return false;
          if (seenIds.has(d.id)) return false;
          const canonicalKey = `${d.full_name?.toLowerCase().trim()}_${d.email?.toLowerCase().trim()}_${d.specialty?.toLowerCase().trim()}`;
          if (d.email && seenCanonical.has(canonicalKey)) return false;
          seenIds.add(d.id);
          if (d.email) seenCanonical.add(canonicalKey);
          return true;
        });

        setActiveDoctors(unique);

        // Auto-resolve selectedDoctor:
        // Priority 1: If user is doctor role, match user to doctor
        if (user?.role === 'doctor') {
          const userDoctor = unique.find(d => 
            (d.email && user.email && d.email.toLowerCase() === user.email.toLowerCase()) ||
            d.id === user.id ||
            d.staff_id === user.id ||
            (d.full_name && user.full_name && d.full_name.toLowerCase() === user.full_name.toLowerCase())
          );
          if (userDoctor) {
            setSelectedDoctor(userDoctor);
            return;
          }
        }

        // Priority 2: If current selectedDoctor exists, verify it is still in unique list and refresh data
        if (selectedDoctor?.id) {
          const matchedCurrent = unique.find(d => d.id === selectedDoctor.id);
          if (matchedCurrent) {
            setSelectedDoctor(matchedCurrent);
            return;
          }
        }

        // Priority 3: If no doctor selected and active doctors exist, pick the first one
        if (!selectedDoctor && unique.length > 0) {
          setSelectedDoctor(unique[0]);
        }
      } catch (err) {
        console.warn('[DoctorContext] Failed to load doctors:', err);
      } finally {
        if (isMounted) setIsLoadingDoctors(false);
      }
    }

    loadDoctors();
    return () => { isMounted = false; };
  }, [user, setSelectedDoctor]);

  return (
    <DoctorContext.Provider value={{
      selectedDoctor,
      setSelectedDoctor,
      activeDoctors,
      isLoadingDoctors,
      updateDoctorAvailability
    }}>
      {children}
    </DoctorContext.Provider>
  );
}

export function useDoctorContext() {
  return useContext(DoctorContext);
}