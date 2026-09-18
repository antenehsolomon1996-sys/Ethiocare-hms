import { base44 } from '@/api/base44Client';
import { differenceInDays, parseISO, isValid } from 'date-fns';
import { logAudit } from '@/lib/auditLogger';

export interface RegistrationFeeResult {
  feeType: 'new_patient' | 'recent_patient' | 'returning_over_30_days';
  fee: number;
  label: string;
  serviceName: string;
  serviceId?: string;
  daysSinceLastVisit: number | null;
  isRecent: boolean;
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
   * 1. Never treated before: standard New Patient Registration Fee (default 150 ETB).
   * 2. Treated within the last 30 days (<= 30 days): Recent/Returning Patient Fee (default 100 ETB).
   * 3. Treated more than 30 days ago (> 30 days): Standard New Patient Registration Fee (150 ETB).
   */
  determineRegistrationFee(
    patientId: string,
    services: any[] = [],
    patientVisits: any[] = []
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

    if (completedVisits.length === 0) {
      return {
        feeType: 'new_patient',
        fee: tariffs.newPatientFee,
        label: 'New Patient Registration Fee',
        serviceName: tariffs.newPatientService?.name || 'Patient Registration (New Patient)',
        serviceId: tariffs.newPatientService?.id,
        daysSinceLastVisit: null,
        isRecent: false,
        badgeText: 'New Patient',
        badgeVariant: 'default',
      };
    }

    // Determine the most recent completed visit date
    let latestVisitDate: Date | null = null;

    for (const v of completedVisits) {
      const dateStr = v.visit_date || v.created_at || v.created_date;
      if (!dateStr) continue;

      try {
        const d = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
        if (isValid(d)) {
          if (!latestVisitDate || d.getTime() > latestVisitDate.getTime()) {
            latestVisitDate = d;
          }
        }
      } catch {
        // ignore
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
        isRecent: false,
        badgeText: 'New Patient',
        badgeVariant: 'default',
      };
    }

    const today = new Date();
    const daysSince = Math.max(0, differenceInDays(today, latestVisitDate));

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
        isRecent: true,
        badgeText: `Treated ${daysSince === 0 ? 'Today' : `${daysSince}d ago`} (≤30d discount)`,
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
        isRecent: false,
        badgeText: `Last treated ${daysSince}d ago (>30d)`,
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
    const services = await base44.entities.Service.list();
    const tariffs = this.getRegistrationTariffs(services);

    // 1. Update or create New Patient Registration Fee
    if (tariffs.newPatientService) {
      await base44.entities.Service.update(tariffs.newPatientService.id, {
        price: newPatientFee,
        updated_at: new Date().toISOString(),
      });
    } else {
      await base44.entities.Service.create({
        name: 'Patient Registration (New Patient)',
        category: 'registration',
        price: newPatientFee,
        description: 'Standard registration and file opening for new patients',
        status: 'active',
      });
    }

    // 2. Update or create Recent Patient Revisit Fee
    if (tariffs.recentPatientService) {
      await base44.entities.Service.update(tariffs.recentPatientService.id, {
        price: recentPatientFee,
        updated_at: new Date().toISOString(),
      });
    } else {
      await base44.entities.Service.create({
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
