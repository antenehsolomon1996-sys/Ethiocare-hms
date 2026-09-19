import { ethioCareClient } from '@/api/ethioCareClient';
import { logAudit } from '@/lib/auditLogger';
import { isValid, parseISO, isAfter, startOfDay } from 'date-fns';

export interface HistoricalRecordPayload {
  id?: string;
  patient_id: string;
  patient_name: string;
  patient_phone?: string | null;
  patient_gender?: string | null;
  patient_dob?: string | null;
  visit_date: string; // Original treatment date (YYYY-MM-DD)
  doctor_name: string;
  doctor_specialty?: string | null;
  diagnosis: string;
  disease?: string | null;
  symptoms?: string | null;
  examination_notes?: string | null;
  treatment?: string | null;
  lab_tests?: string | null;
  lab_results?: string | null;
  nurse_records?: string | null;
  medicines?: string | null;
  medical_reports?: string | null;
  notes?: string | null;
  blood_pressure?: string | null;
  temperature?: string | null;
  weight?: string | null;
  pulse?: string | null;
  digitized_by?: string | null;
  digitized_at?: string | null;
  created_by?: string | null;
}

export const HISTORICAL_RECORD_TAG = '[HISTORICAL / PAPER RECORD - PRE-ETHIOCARE HMS]';

export const historicalRecordService = {
  /**
   * Validate a historical record payload before submission.
   */
  validate(data: HistoricalRecordPayload): { valid: boolean; error?: string } {
    if (!data.patient_id?.trim()) {
      return { valid: false, error: 'Patient ID is required' };
    }
    if (!data.patient_name?.trim()) {
      return { valid: false, error: 'Patient name is required' };
    }
    if (!data.visit_date?.trim()) {
      return { valid: false, error: 'Original paper treatment date is required' };
    }

    const parsedDate = parseISO(data.visit_date);
    if (!isValid(parsedDate)) {
      return { valid: false, error: 'Invalid treatment date format (use YYYY-MM-DD)' };
    }

    const today = startOfDay(new Date());
    if (isAfter(startOfDay(parsedDate), today)) {
      return { valid: false, error: 'Historical treatment date cannot be in the future' };
    }

    if (!data.doctor_name?.trim()) {
      return { valid: false, error: 'Attending doctor name is required' };
    }
    if (!data.diagnosis?.trim()) {
      return { valid: false, error: 'Historical diagnosis/disease is required' };
    }

    return { valid: true };
  },

  /**
   * Create a new digitized historical paper record in patient_history.
   * Preserves exact original treatment date, attending physician, and all clinical details.
   * Does NOT create any registration payment or queue entry (medical history only).
   */
  async createHistoricalRecord(
    payload: HistoricalRecordPayload,
    recordedBy: string = 'Reception'
  ): Promise<any> {
    const validation = this.validate(payload);
    if (!validation.valid) {
      throw new Error(validation.error || 'Validation failed');
    }

    const digitizer = payload.digitized_by || recordedBy || 'Reception';
    const digitizeTime = new Date().toISOString();

    // Compose formatted notes with machine-readable tag, audit trail, and structured sections
    const noteSections: string[] = [
      HISTORICAL_RECORD_TAG,
      `Digitized From Paper Chart: ${digitizeTime.slice(0, 10)} by ${digitizer}`
    ];

    if (payload.disease?.trim()) {
      noteSections.push(`Specific Disease/Condition: ${payload.disease.trim()}`);
    }
    if (payload.examination_notes?.trim()) {
      noteSections.push(`Examination Findings: ${payload.examination_notes.trim()}`);
    }
    if (payload.lab_tests?.trim()) {
      noteSections.push(`Lab Tests Ordered: ${payload.lab_tests.trim()}`);
    }
    if (payload.nurse_records?.trim()) {
      noteSections.push(`Nursing Records & Procedures: ${payload.nurse_records.trim()}`);
    }
    if (payload.medical_reports?.trim()) {
      noteSections.push(`Paper File / Archive Reference: ${payload.medical_reports.trim()}`);
    }
    if (payload.notes?.trim()) {
      noteSections.push(`Clinical Notes: ${payload.notes.trim()}`);
    }

    const combinedNotes = noteSections.join('\n\n');

    // Combine diagnosis + disease if provided
    const combinedDiagnosis = payload.disease?.trim()
      ? `${payload.diagnosis.trim()} (${payload.disease.trim()})`
      : payload.diagnosis.trim();

    // Combine lab tests + lab results if provided
    const combinedLab = [
      payload.lab_tests?.trim() ? `Tests: ${payload.lab_tests.trim()}` : '',
      payload.lab_results?.trim() ? `Results: ${payload.lab_results.trim()}` : ''
    ].filter(Boolean).join('\n') || null;

    // Combine medicines if provided
    const combinedPrescription = payload.medicines?.trim() || null;

    // Construct entity payload satisfying existing verified columns
    const recordData: Record<string, any> = {
      patient_id: payload.patient_id,
      patient_name: payload.patient_name.trim(),
      patient_phone: payload.patient_phone?.trim() || null,
      patient_gender: payload.patient_gender || null,
      patient_dob: payload.patient_dob?.trim() || null,
      visit_id: null, // Null explicitly indicates pre-system historical paper record
      visit_date: payload.visit_date.trim(), // EXACT original treatment date from paper file
      doctor_name: payload.doctor_name.trim(),
      doctor_specialty: payload.doctor_specialty?.trim() || 'General Medicine',
      symptoms: payload.symptoms?.trim() || null,
      diagnosis: combinedDiagnosis,
      treatment: payload.treatment?.trim() || null,
      prescription: combinedPrescription,
      lab_results: combinedLab,
      notes: combinedNotes,
      blood_pressure: payload.blood_pressure?.trim() || null,
      temperature: payload.temperature?.trim() || null,
      weight: payload.weight?.trim() || null,
      pulse: payload.pulse?.trim() || null,
      record_type: 'visit' // Satisfies check constraint
    };

    // Attempt creation via ethioCareClient
    const createdRecord = await ethioCareClient.entities.PatientHistory.create(recordData);

    logAudit({
      action: 'IMPORT_PAPER_PATIENT_RECORD',
      performedBy: digitizer,
      details: `Digitized paper medical record for ${payload.patient_name} (Paper Treatment Date: ${payload.visit_date}, Doctor: ${payload.doctor_name}, Diagnosis: ${payload.diagnosis})`,
      metadata: {
        patient_id: payload.patient_id,
        patient_name: payload.patient_name,
        visit_date: payload.visit_date,
        doctor_name: payload.doctor_name,
        diagnosis: payload.diagnosis,
        digitized_by: digitizer,
        digitized_at: digitizeTime
      }
    });

    return createdRecord;
  },

  /**
   * Update an existing digitized historical record in patient_history.
   */
  async updateHistoricalRecord(
    recordId: string,
    payload: HistoricalRecordPayload,
    updatedBy: string = 'Reception'
  ): Promise<any> {
    const validation = this.validate(payload);
    if (!validation.valid) {
      throw new Error(validation.error || 'Validation failed');
    }

    const modifier = payload.digitized_by || updatedBy || 'Reception';
    const updateTime = new Date().toISOString();

    const noteSections: string[] = [
      HISTORICAL_RECORD_TAG,
      `Digitized Paper Record (Last modified: ${updateTime.slice(0, 10)} by ${modifier})`
    ];

    if (payload.disease?.trim()) {
      noteSections.push(`Specific Disease/Condition: ${payload.disease.trim()}`);
    }
    if (payload.examination_notes?.trim()) {
      noteSections.push(`Examination Findings: ${payload.examination_notes.trim()}`);
    }
    if (payload.lab_tests?.trim()) {
      noteSections.push(`Lab Tests Ordered: ${payload.lab_tests.trim()}`);
    }
    if (payload.nurse_records?.trim()) {
      noteSections.push(`Nursing Records & Procedures: ${payload.nurse_records.trim()}`);
    }
    if (payload.medical_reports?.trim()) {
      noteSections.push(`Paper File / Archive Reference: ${payload.medical_reports.trim()}`);
    }
    if (payload.notes?.trim()) {
      noteSections.push(`Clinical Notes: ${payload.notes.trim()}`);
    }

    const combinedNotes = noteSections.join('\n\n');

    const combinedDiagnosis = payload.disease?.trim()
      ? `${payload.diagnosis.trim()} (${payload.disease.trim()})`
      : payload.diagnosis.trim();

    const combinedLab = [
      payload.lab_tests?.trim() ? `Tests: ${payload.lab_tests.trim()}` : '',
      payload.lab_results?.trim() ? `Results: ${payload.lab_results.trim()}` : ''
    ].filter(Boolean).join('\n') || null;

    const combinedPrescription = payload.medicines?.trim() || null;

    const updateData: Record<string, any> = {
      visit_date: payload.visit_date.trim(),
      doctor_name: payload.doctor_name.trim(),
      doctor_specialty: payload.doctor_specialty?.trim() || 'General Medicine',
      symptoms: payload.symptoms?.trim() || null,
      diagnosis: combinedDiagnosis,
      treatment: payload.treatment?.trim() || null,
      prescription: combinedPrescription,
      lab_results: combinedLab,
      notes: combinedNotes,
      blood_pressure: payload.blood_pressure?.trim() || null,
      temperature: payload.temperature?.trim() || null,
      weight: payload.weight?.trim() || null,
      pulse: payload.pulse?.trim() || null
    };

    const updated = await ethioCareClient.entities.PatientHistory.update(recordId, updateData);

    logAudit({
      action: 'UPDATE_PAPER_PATIENT_RECORD',
      performedBy: modifier,
      details: `Updated digitized paper record for ${payload.patient_name} (Treatment Date: ${payload.visit_date}, Doctor: ${payload.doctor_name})`,
      metadata: {
        record_id: recordId,
        patient_id: payload.patient_id,
        patient_name: payload.patient_name,
        visit_date: payload.visit_date,
        modified_by: modifier,
        modified_at: updateTime
      }
    });

    return updated;
  },

  /**
   * Helper to determine whether a given record in patient_history is an imported historical/paper record.
   */
  isHistoricalRecord(record: any): boolean {
    if (!record) return false;
    if (record.is_historical === true) return true;
    if (record.record_source === 'manual_historical') return true;
    if (record.visit_id === null || record.visit_id === undefined) return true;
    if (typeof record.notes === 'string' && (
      record.notes.includes(HISTORICAL_RECORD_TAG) ||
      record.notes.includes('HISTORICAL RECORD') ||
      record.notes.includes('Historical Record') ||
      record.notes.includes('Paper Record') ||
      record.notes.includes('Paper Chart')
    )) {
      return true;
    }
    return false;
  }
};
