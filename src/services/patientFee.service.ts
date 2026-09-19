import { ethioCareClient } from '@/api/ethioCareClient';
import { differenceInDays, parseISO, isValid } from 'date-fns';
import { logAudit } from '@/lib/auditLogger';

export interface RegistrationFeeResult {
  feeType: 'new_patient' | 'recent_patient' | 'returning_over_30_days';
  fee: number;
  label: string;
  serviceName: string;
  serviceId?: string;
  daysSinceLastVisit: number | null;
  lastVisitDate: string | null;
  lastVisitSource?: 'system' | 'historical';
  isRecent: boolean;
  statusText: string;
  badgeText: string;
  badgeVariant: 'default' | 'secondary' | 'outline' | 'destructive';
}

export interface RegistrationTariffs {
  newPatientFee: number;
  recentPatientFee: number;
  newPatientService: any | null;
  recentPatientService: any | null;
}

export const DEFAULT_NEW_PATIENT_FEE = 150.0;
export const DEFAULT_RECENT_PATIENT_FEE = 100.0;

export const patientFeeService = {
  /**
   * Extract configured tariffs for new and recent patients from the active services catalog.
   */
  getRegistrationTariffs(services: any[] = []): RegistrationTariffs {
    const regServices = services.filter(
      (s) => s.category === 'registration' && s.status === 'active'
    );

    // Recent / returning fee (<= 30 days)
    const recentPatientService =
      regServices.find(
        (s) =>
          s.name?.toLowerCase().includes('recent') ||
          s.name?.toLowerCase().includes('revisit') ||
          s.name?.toLowerCase().includes('returning') ||
          s.name?.includes('≤30') ||
          s.name?.includes('<=30')
      ) || null;

    // New patient fee
    const newPatientService =
      regServices.find(
        (s) =>
          (s.name?.toLowerCase().includes('new') ||
           s.name?.toLowerCase().includes('registration') ||
           s.name === 'Patient Registration') &&
          s.id !== recentPatientService?.id
      ) ||
      regServices[0] ||
      null;

    const newPatientFee =
      newPatientService && typeof newPatientService.price === 'number'
        ? newPatientService.price
        : DEFAULT_NEW_PATIENT_FEE;

    const recentPatientFee =
      recentPatientService && typeof recentPatientService.price === 'number'
        ? recentPatientService.price
        : DEFAULT_RECENT_PATIENT_FEE;

    return {
      newPatientFee,
      recentPatientFee,
      newPatientService,
      recentPatientService,
    };
  },

  /**
   * Calculate registration fee according to the 30-day treatment rule:
   * 1. Never treated before (no system visits or historical records): standard New Patient Registration Fee.
   * 2. Most recent actual hospital visit date was within 30 days (<= 30 days): Recent/Returning Patient Fee.
   * 3. Most recent actual hospital visit date was more than 30 days ago (> 30 days): Standard Registration Fee.
   *
   * Accurately inspects BOTH modern EthioCare HMS visits and imported historical patient records
   * using the EXACT original treatment date without guessing or overwriting.
   */
  determineRegistrationFee(
    patientId: string,
    services: any[] = [],
    patientVisits: any[] = [],
    patientHistory: any[] = []
  ): RegistrationFeeResult {
    const tariffs = this.getRegistrationTariffs(services);

    // Find all completed visits for this patient
    const completedVisits = patientVisits.filter((v) => {
      if (!v) return false;
      const matchesPatient = v.patient_id === patientId;
      if (!matchesPatient) return false;

      // Status indicates completed consultation / treatment
      const isCompleted =
        v.status === 'completed' ||
        v.consultation_completed === true;

      return isCompleted;
    });

    // Find all historical records for this patient
    const matchingHistory = patientHistory.filter((h) => {
      if (!h) return false;
      return h.patient_id === patientId && Boolean(h.visit_date);
    });

    // If neither completed system visits nor historical records exist, this is a new patient
    if (completedVisits.length === 0 && matchingHistory.length === 0) {
      return {
        feeType: 'new_patient',
        fee: tariffs.newPatientFee,
        label: 'New Patient Registration Fee',
        serviceName: tariffs.newPatientService?.name || 'Patient Registration (New Patient)',
        serviceId: tariffs.newPatientService?.id,
        daysSinceLastVisit: null,
        lastVisitDate: null,
        isRecent: false,
        statusText: 'New patient registration',
        badgeText: 'New Patient Registration',
        badgeVariant: 'default',
      };
    }

    // Determine the most recent completed hospital visit date across system visits and historical records
    let latestVisitDate: Date | null = null;
    let latestVisitDateStr: string | null = null;
    let latestRecordSource: 'system' | 'historical' = 'system';

    // 1. Check system visits
    for (const v of completedVisits) {
      const dateStr = v.visit_date || v.created_at || v.created_date;
      if (!dateStr) continue;

      try {
        const d = typeof dateStr === 'string' ? parseISO(dateStr.slice(0, 10)) : new Date(dateStr);
        if (isValid(d)) {
          if (!latestVisitDate || d.getTime() > latestVisitDate.getTime()) {
            latestVisitDate = d;
            latestVisitDateStr = typeof dateStr === 'string' ? dateStr.slice(0, 10) : dateStr.toISOString().slice(0, 10);
            latestRecordSource = 'system';
          }
        }
      } catch {
        // ignore invalid dates
      }
    }

    // 2. Check historical records (preserves original historical treatment date)
    for (const h of matchingHistory) {
      const dateStr = h.visit_date;
      if (!dateStr) continue;

      try {
        const d = typeof dateStr === 'string' ? parseISO(dateStr.slice(0, 10)) : new Date(dateStr);
        if (isValid(d)) {
          if (!latestVisitDate || d.getTime() > latestVisitDate.getTime()) {
            latestVisitDate = d;
            latestVisitDateStr = typeof dateStr === 'string' ? dateStr.slice(0, 10) : dateStr.toISOString().slice(0, 10);
            latestRecordSource = 'historical';
          }
        }
      } catch {
        // ignore invalid dates
      }
    }

    if (!latestVisitDate) {
      return {
        feeType: 'new_patient',
        fee: tariffs.newPatientFee,
        label: 'New Patient Registration Fee',
        serviceName: tariffs.newPatientService?.name || 'Patient Registration (New Patient)',
        serviceId: tariffs.newPatientService?.id,
        daysSinceLastVisit: null,
        lastVisitDate: null,
        isRecent: false,
        statusText: 'New patient registration',
        badgeText: 'New Patient Registration',
        badgeVariant: 'default',
      };
    }

    const today = new Date();
    // Compare date portions
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const latestDateOnly = new Date(latestVisitDate.getFullYear(), latestVisitDate.getMonth(), latestVisitDate.getDate());
    const daysSince = Math.max(0, differenceInDays(todayDateOnly, latestDateOnly));

    if (daysSince <= 30) {
      return {
        feeType: 'recent_patient',
        fee: tariffs.recentPatientFee,
        label: 'Recent Patient Revisit Fee (≤30 Days)',
        serviceName:
          tariffs.recentPatientService?.name ||
          'Recent Patient Revisit Fee (≤30 Days)',
        serviceId: tariffs.recentPatientService?.id,
        daysSinceLastVisit: daysSince,
        lastVisitDate: latestVisitDateStr,
        lastVisitSource: latestRecordSource,
        isRecent: true,
        statusText: 'Visited within 30 days',
        badgeText: `Visited within 30 days (${daysSince === 0 ? 'Today' : `${daysSince}d ago`})`,
        badgeVariant: 'secondary',
      };
    } else {
      return {
        feeType: 'returning_over_30_days',
        fee: tariffs.newPatientFee,
        label: 'Returning Patient Re-Registration Fee (>30 Days)',
        serviceName:
          tariffs.newPatientService?.name || 'Patient Registration (New Patient)',
        serviceId: tariffs.newPatientService?.id,
        daysSinceLastVisit: daysSince,
        lastVisitDate: latestVisitDateStr,
        lastVisitSource: latestRecordSource,
        isRecent: false,
        statusText: 'More than 30 days since last visit',
        badgeText: `More than 30 days since last visit (${daysSince}d ago)`,
        badgeVariant: 'outline',
      };
    }
  },

  /**
   * Updates owner registration tariffs in services table.
   * This applies strictly to future visits and registrations without altering historical records.
   */
  async updateTariffs(
    newPatientFee: number,
    recentPatientFee: number,
    updatedBy: string = 'Owner/Admin'
  ): Promise<boolean> {
    const services = await ethioCareClient.entities.Service.list();
    const tariffs = this.getRegistrationTariffs(services);

    // 1. Update or create New Patient Registration Fee
    if (tariffs.newPatientService) {
      await ethioCareClient.entities.Service.update(tariffs.newPatientService.id, {
        price: newPatientFee,
        updated_at: new Date().toISOString(),
      });
    } else {
      await ethioCareClient.entities.Service.create({
        name: 'Patient Registration (New Patient)',
        category: 'registration',
        price: newPatientFee,
        description: 'Standard registration and file opening for new patients',
        status: 'active',
      });
    }

    // 2. Update or create Recent Patient Revisit Fee
    if (tariffs.recentPatientService) {
      await ethioCareClient.entities.Service.update(tariffs.recentPatientService.id, {
        price: recentPatientFee,
        updated_at: new Date().toISOString(),
      });
    } else {
      await ethioCareClient.entities.Service.create({
        name: 'Recent Patient Revisit Fee (≤30 Days)',
        category: 'registration',
        price: recentPatientFee,
        description: 'Registration revisit fee for patients treated within 30 days',
        status: 'active',
      });
    }

    logAudit({
      action: 'UPDATE_REGISTRATION_TARIFFS',
      performedBy: updatedBy,
      details: `Updated New Patient Fee to ${newPatientFee} ETB and Recent Patient Fee to ${recentPatientFee} ETB (future visits only)`,
      metadata: { newPatientFee, recentPatientFee },
    });

    return true;
  },
};
