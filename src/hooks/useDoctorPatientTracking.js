import { useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import { format } from 'date-fns';
import { JOURNEY_STAGES, enrichVisitRecord } from '@/lib/doctorTrackingUtils';

export { JOURNEY_STAGES, enrichVisitRecord };

/**
 * Main React Hook for Doctor Patient Tracking
 */
export function useDoctorPatientTracking(selectedDoctor) {
  const queryClient = useQueryClient();

  // Queries for all core operational entities
  const { data: visits = [], isLoading: loadingVisits } = useQuery({
    queryKey: ['visits'],
    queryFn: () => ethioCareClient.entities.Visit.list('-created_date', 500),
    refetchInterval: 15000,
    staleTime: 10000
  });

  const { data: patients = [], isLoading: loadingPatients } = useQuery({
    queryKey: ['patients'],
    queryFn: () => ethioCareClient.entities.Patient.list('-created_date', 500),
    staleTime: 60000
  });

  const { data: labOrders = [], isLoading: loadingLabs } = useQuery({
    queryKey: ['labOrders'],
    queryFn: () => ethioCareClient.entities.LabOrder.list('-created_date', 500),
    refetchInterval: 15000
  });

  const { data: medicationOrders = [] } = useQuery({
    queryKey: ['medicationOrders'],
    queryFn: () => ethioCareClient.entities.MedicationOrder.list('-created_date', 300),
    refetchInterval: 15000
  });

  const { data: nurseTasks = [] } = useQuery({
    queryKey: ['nurseTasks'],
    queryFn: () => ethioCareClient.entities.NurseTask.list('-created_date', 300),
    refetchInterval: 15000
  });

  const { data: prescriptions = [] } = useQuery({
    queryKey: ['prescriptions'],
    queryFn: () => ethioCareClient.entities.Prescription.list('-created_date', 500),
    refetchInterval: 15000
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['payments'],
    queryFn: () => ethioCareClient.entities.Payment.list('-created_date', 500),
    refetchInterval: 15000
  });

  const { data: vitals = [] } = useQuery({
    queryKey: ['vitals'],
    queryFn: () => ethioCareClient.entities.Vital.list('-created_date', 300),
    staleTime: 30000
  });

  // Supabase Realtime Subscriptions for immediate cross-department reactivity
  useEffect(() => {
    const unsubVisit = ethioCareClient.entities.Visit.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
    });
    const unsubLab = ethioCareClient.entities.LabOrder.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['labOrders'] });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
    });
    const unsubMed = ethioCareClient.entities.MedicationOrder.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['medicationOrders'] });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
    });
    const unsubTask = ethioCareClient.entities.NurseTask.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['nurseTasks'] });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
    });
    const unsubPayment = ethioCareClient.entities.Payment.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['labOrders'] });
    });
    const unsubRx = ethioCareClient.entities.Prescription.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
    });

    return () => {
      unsubVisit?.();
      unsubLab?.();
      unsubMed?.();
      unsubTask?.();
      unsubPayment?.();
      unsubRx?.();
    };
  }, [queryClient]);

  // Filter for doctor's assigned patients
  const myEnrichedVisits = useMemo(() => {
    if (!selectedDoctor) return [];
    const docId = selectedDoctor.id;
    const docName = selectedDoctor.full_name?.toLowerCase();

    const isAssignedToMe = (v) => {
      if (docId && v.assigned_doctor_id === docId) return true;
      if (docName && v.assigned_doctor?.toLowerCase() === docName) return true;
      return false;
    };

    return visits
      .filter(isAssignedToMe)
      .map(v => enrichVisitRecord(v, {
        labOrders,
        medicationOrders,
        nurseTasks,
        prescriptions,
        payments,
        vitals,
        patients
      }));
  }, [selectedDoctor, visits, labOrders, medicationOrders, nurseTasks, prescriptions, payments, vitals, patients]);

  // Today and yesterday strings
  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const yesterdayStr = useMemo(() => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return format(y, 'yyyy-MM-dd');
  }, []);

  // Categorized patient subsets
  const categories = useMemo(() => {
    const waitingPatients = [];
    const inExamPatients = [];
    const labPatients = [];
    const nursePatients = [];
    const billingPatients = [];
    const pharmacyPatients = [];
    const completedPatients = [];
    const ongoingPatients = [];

    myEnrichedVisits.forEach(p => {
      if (p.isOngoing) {
        ongoingPatients.push(p);
      }

      if (p.currentStage.id === 'completed') {
        completedPatients.push(p);
      } else if (p.currentStage.id === 'lab' || p.currentStage.label.includes('Lab')) {
        labPatients.push(p);
      } else if (p.currentStage.id === 'billing' || p.currentStage.label.includes('Payment')) {
        billingPatients.push(p);
      } else if (p.currentStage.id === 'nurse') {
        nursePatients.push(p);
      } else if (p.currentStage.id === 'pharmacy') {
        pharmacyPatients.push(p);
      } else if (p.currentStage.label === 'In Consultation' || p.status === 'with_doctor') {
        inExamPatients.push(p);
      } else if (p.currentStage.label === 'Waiting for Doctor' || p.status === 'waiting') {
        waitingPatients.push(p);
      } else {
        waitingPatients.push(p);
      }
    });

    ongoingPatients.sort((a, b) => b.daysOngoing - a.daysOngoing);

    return {
      waitingPatients,
      inExamPatients,
      labPatients,
      nursePatients,
      billingPatients,
      pharmacyPatients,
      completedPatients,
      ongoingPatients
    };
  }, [myEnrichedVisits]);

  // Helper to query patients for a specific day and calculate day metrics
  const getDailyPatientSummary = useMemo(() => {
    return (targetDateStr) => {
      const dayVisits = myEnrichedVisits.filter(v => v.visit_date === targetDateStr);
      const seenCount = dayVisits.length;
      const completedCount = dayVisits.filter(v => v.currentStage.id === 'completed').length;
      const unfinishedCount = dayVisits.filter(v => v.isOngoing).length;
      const labCount = dayVisits.filter(v => v.childRecords.labs.length > 0).length;
      const nurseCount = dayVisits.filter(v => v.childRecords.nurseTasks.length > 0 || v.childRecords.medOrders.length > 0).length;
      const billingCount = dayVisits.filter(v => v.childRecords.payments.length > 0).length;

      return {
        dateStr: targetDateStr,
        visits: dayVisits,
        metrics: {
          seenCount,
          completedCount,
          unfinishedCount,
          labCount,
          nurseCount,
          billingCount
        }
      };
    };
  }, [myEnrichedVisits]);

  return {
    isLoading: loadingVisits || loadingPatients || loadingLabs,
    allPatients: myEnrichedVisits,
    todayStr,
    yesterdayStr,
    ...categories,
    getDailyPatientSummary,
    totalCount: myEnrichedVisits.length,
    activeCount: categories.ongoingPatients.length,
    refetchAll: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['labOrders'] });
      queryClient.invalidateQueries({ queryKey: ['medicationOrders'] });
      queryClient.invalidateQueries({ queryKey: ['nurseTasks'] });
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    }
  };
}
