import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// Mapping from Base44 entity names to Supabase table names
export const TABLE_MAP: Record<string, string> = {
  User: 'profiles',
  Staff: 'staff',
  Doctor: 'doctors',
  Patient: 'patients',
  Visit: 'visits',
  Vital: 'vitals',
  NurseTask: 'nurse_tasks',
  LabOrder: 'lab_orders',
  LabTest: 'lab_tests',
  Medicine: 'medicines',
  MedicationOrder: 'medication_orders',
  Prescription: 'prescriptions',
  Payment: 'payments',
  PatientHistory: 'patient_history',
  Service: 'services',
  AuditLog: 'audit_logs',
  InventoryMovement: 'inventory_movements',
  PurchaseInvoice: 'purchase_invoices',
  SalesReturn: 'sales_returns',
  PharmacySetting: 'pharmacy_settings',
  HospitalSetting: 'hospital_settings',
  PharmacyBranding: 'pharmacy_branding',
  Expense: 'expenses',
  OtherIncome: 'other_incomes',
  EmployeeSalary: 'employee_salaries',
  SalaryPayment: 'salary_payments',
};

// Default seed data for development/offline fallback
const INITIAL_SEED: Record<string, any[]> = {
  Service: [
    { id: 'srv-1', name: 'Patient Registration', category: 'registration', price: 150, description: 'Standard registration and file opening for new patients', status: 'active', created_at: new Date().toISOString() },
    { id: 'srv-1b', name: 'Recent Patient Revisit Fee (≤30 Days)', category: 'registration', price: 100, description: 'Registration revisit fee for patients treated within 30 days', status: 'active', created_at: new Date().toISOString() },
    { id: 'srv-2', name: 'General Consultation', category: 'consultation', price: 150, description: 'Consultation with general physician', status: 'active', created_at: new Date().toISOString() },
    { id: 'srv-3', name: 'Specialist Consultation', category: 'consultation', price: 300, description: 'Consultation with specialist physician', status: 'active', created_at: new Date().toISOString() },
    { id: 'srv-4', name: 'Injection Administration', category: 'injection', price: 35, description: 'IM or SC injection procedure', status: 'active', created_at: new Date().toISOString() },
    { id: 'srv-5', name: 'IV Infusion Setup', category: 'injection', price: 90, description: 'IV line cannula and fluid infusion', status: 'active', created_at: new Date().toISOString() },
    { id: 'srv-6', name: 'Wound Dressing', category: 'procedure', price: 75, description: 'Sterile antiseptic wound dressing', status: 'active', created_at: new Date().toISOString() }
  ],
  LabTest: [
    { id: 'lt-1', name: 'Complete Blood Count (CBC)', category: 'Blood', price: 180, turnaround_time: '1 hour', status: 'active', created_at: new Date().toISOString() },
    { id: 'lt-2', name: 'Malaria Rapid & Blood Film', category: 'Blood', price: 120, turnaround_time: '45 mins', status: 'active', created_at: new Date().toISOString() },
    { id: 'lt-3', name: 'Fasting Blood Sugar (FBS)', category: 'Blood', price: 80, turnaround_time: '30 mins', status: 'active', created_at: new Date().toISOString() },
    { id: 'lt-4', name: 'Urine Routine Analysis', category: 'Urine', price: 90, turnaround_time: '30 mins', status: 'active', created_at: new Date().toISOString() },
    { id: 'lt-5', name: 'Stool Examination Routine', category: 'Stool', price: 80, turnaround_time: '30 mins', status: 'active', created_at: new Date().toISOString() },
    { id: 'lt-6', name: 'Lipid Profile Panel', category: 'Blood', price: 350, turnaround_time: '3 hours', status: 'active', created_at: new Date().toISOString() }
  ],
  Medicine: [
    { id: 'med-1', name: 'Amoxicillin 500mg', generic_name: 'Amoxicillin', category: 'Antibiotic', dosage_form: 'Capsule', strength: '500mg', unit_price: 15, quantity: 450, min_stock: 50, unit: 'capsules', status: 'in_stock', created_at: new Date().toISOString() },
    { id: 'med-2', name: 'Paracetamol 500mg', generic_name: 'Acetaminophen', category: 'Analgesic', dosage_form: 'Tablet', strength: '500mg', unit_price: 3.5, quantity: 1200, min_stock: 100, unit: 'tablets', status: 'in_stock', created_at: new Date().toISOString() },
    { id: 'med-3', name: 'Ibuprofen 400mg', generic_name: 'Ibuprofen', category: 'Analgesic', dosage_form: 'Tablet', strength: '400mg', unit_price: 6, quantity: 600, min_stock: 50, unit: 'tablets', status: 'in_stock', created_at: new Date().toISOString() },
    { id: 'med-4', name: 'Omeprazole 20mg', generic_name: 'Omeprazole', category: 'Antacid', dosage_form: 'Capsule', strength: '20mg', unit_price: 12, quantity: 850, min_stock: 60, unit: 'capsules', status: 'in_stock', created_at: new Date().toISOString() },
    { id: 'med-5', name: 'Normal Saline 0.9% 500ml', generic_name: 'Sodium Chloride 0.9%', category: 'Other', dosage_form: 'Injection', strength: '500ml', unit_price: 55, quantity: 280, min_stock: 50, unit: 'bottles', status: 'in_stock', created_at: new Date().toISOString() },
    { id: 'med-6', name: 'Diclofenac 75mg Ampoule', generic_name: 'Diclofenac Sodium', category: 'Analgesic', dosage_form: 'Injection', strength: '75mg/3ml', unit_price: 32, quantity: 18, min_stock: 25, unit: 'ampoules', status: 'low_stock', created_at: new Date().toISOString() }
  ],
  Doctor: [
    { id: 'doc-1', full_name: 'Dr. Selamawit Tadesse', email: 'dr.selamawit@grandhorizonhospital.com', specialty: 'Internal Medicine', doctor_type: 'Consultant', status: 'active', availability: 'available', created_at: new Date().toISOString() },
    { id: 'doc-2', full_name: 'Dr. Dawit Alemu', email: 'dr.dawit@grandhorizonhospital.com', specialty: 'General Practice', doctor_type: 'General Practitioner', status: 'active', availability: 'available', created_at: new Date().toISOString() },
    { id: 'doc-3', full_name: 'Dr. Helen Bekele', email: 'dr.helen@grandhorizonhospital.com', specialty: 'Pediatrics', doctor_type: 'Specialist', status: 'active', availability: 'available', created_at: new Date().toISOString() }
  ],
  Staff: [
    { id: 'stf-1', full_name: 'Administrator', email: 'admin@grandhorizonhospital.com', username: 'admin', role: 'owner', department: 'Executive', status: 'active', activation_used: true, password_set: true, created_at: new Date().toISOString() },
    { id: 'stf-2', full_name: 'Dr. Selamawit Tadesse', email: 'dr.selamawit@grandhorizonhospital.com', username: 'selamawit.t', role: 'doctor', department: 'Internal Medicine', status: 'active', activation_used: true, password_set: true, created_at: new Date().toISOString() },
    { id: 'stf-3', full_name: 'Dr. Dawit Alemu', email: 'dr.dawit@grandhorizonhospital.com', username: 'dawit.a', role: 'doctor', department: 'Outpatient OPD', status: 'active', activation_used: true, password_set: true, created_at: new Date().toISOString() },
    { id: 'stf-4', full_name: 'Sister Tigist Mengistu', email: 'tigist.m@grandhorizonhospital.com', username: 'tigist.m', role: 'nurse', department: 'Nursing', status: 'active', activation_used: true, password_set: true, created_at: new Date().toISOString() },
    { id: 'stf-5', full_name: 'Almaz Tesfaye', email: 'almaz.t@grandhorizonhospital.com', username: 'almaz.t', role: 'receptionist', department: 'Front Desk', status: 'active', activation_used: true, password_set: true, created_at: new Date().toISOString() },
    { id: 'stf-6', full_name: 'Kidus Worku', email: 'kidus.w@grandhorizonhospital.com', username: 'kidus.w', role: 'lab_technician', department: 'Laboratory', status: 'active', activation_used: true, password_set: true, created_at: new Date().toISOString() },
    { id: 'stf-7', full_name: 'Bethelhem Solomon', email: 'bethelhem.s@grandhorizonhospital.com', username: 'bethelhem.s', role: 'pharmacist', department: 'Pharmacy', status: 'active', activation_used: true, password_set: true, created_at: new Date().toISOString() },
    { id: 'stf-8', full_name: 'Mulugeta Kebede', email: 'mulugeta.k@grandhorizonhospital.com', username: 'mulugeta.k', role: 'accountant', department: 'Billing', status: 'active', activation_used: true, password_set: true, created_at: new Date().toISOString() }
  ],
  Patient: [
    { id: 'pat-1', patient_id: 'PT-260915-1001', full_name: 'Abebe Kebede', gender: 'Male', age: 42, phone: '+251 91 789 0123', status: 'active', registration_date: new Date().toISOString().slice(0, 10), created_at: new Date().toISOString() },
    { id: 'pat-2', patient_id: 'PT-260915-1002', full_name: 'Sara Mohammed', gender: 'Female', age: 29, phone: '+251 91 890 1234', status: 'active', registration_date: new Date().toISOString().slice(0, 10), created_at: new Date().toISOString() }
  ],
  Expense: [],
  OtherIncome: [],
  EmployeeSalary: [
    { id: 'sal-1', staff_id: 'stf-2', employee_name: 'Dr. Selamawit Tadesse', role: 'doctor', department: 'Internal Medicine', base_salary: 35000, payday_of_month: 28, payment_frequency: 'monthly', payment_method: 'bank_transfer', bank_name: 'Commercial Bank of Ethiopia', bank_account: '1000123456789', status: 'active', created_at: new Date().toISOString() },
    { id: 'sal-2', staff_id: 'stf-3', employee_name: 'Dr. Dawit Alemu', role: 'doctor', department: 'Outpatient OPD', base_salary: 28000, payday_of_month: 28, payment_frequency: 'monthly', payment_method: 'bank_transfer', bank_name: 'Awash Bank', bank_account: '0132049583720', status: 'active', created_at: new Date().toISOString() },
    { id: 'sal-3', staff_id: 'stf-4', employee_name: 'Sister Tigist Mengistu', role: 'nurse', department: 'Nursing', base_salary: 14000, payday_of_month: 28, payment_frequency: 'monthly', payment_method: 'telebirr', bank_name: 'Telebirr', bank_account: '+251911223344', status: 'active', created_at: new Date().toISOString() },
    { id: 'sal-4', staff_id: 'stf-5', employee_name: 'Almaz Tesfaye', role: 'receptionist', department: 'Front Desk', base_salary: 9500, payday_of_month: 28, payment_frequency: 'monthly', payment_method: 'cbe_birr', bank_name: 'CBE Birr', bank_account: '+251912334455', status: 'active', created_at: new Date().toISOString() },
    { id: 'sal-5', staff_id: 'stf-6', employee_name: 'Kidus Worku', role: 'lab_technician', department: 'Laboratory', base_salary: 15000, payday_of_month: 28, payment_frequency: 'monthly', payment_method: 'bank_transfer', bank_name: 'Commercial Bank of Ethiopia', bank_account: '1000987654321', status: 'active', created_at: new Date().toISOString() },
    { id: 'sal-6', staff_id: 'stf-7', employee_name: 'Bethelhem Solomon', role: 'pharmacist', department: 'Pharmacy', base_salary: 18000, payday_of_month: 28, payment_frequency: 'monthly', payment_method: 'bank_transfer', bank_name: 'Dashen Bank', bank_account: '512039485761', status: 'active', created_at: new Date().toISOString() },
    { id: 'sal-7', staff_id: 'stf-8', employee_name: 'Mulugeta Kebede', role: 'accountant', department: 'Billing', base_salary: 16500, payday_of_month: 28, payment_frequency: 'monthly', payment_method: 'bank_transfer', bank_name: 'Commercial Bank of Ethiopia', bank_account: '1000554433221', status: 'active', created_at: new Date().toISOString() }
  ],
  SalaryPayment: []
};

// Normalize a record so both created_at and created_date are available
function normalizeRow(row: any): any {
  if (!row || typeof row !== 'object') return row;
  const normalized = { ...row };
  if (normalized.created_at && !normalized.created_date) {
    normalized.created_date = normalized.created_at;
  }
  if (normalized.created_date && !normalized.created_at) {
    normalized.created_at = normalized.created_date;
  }
  if (normalized.updated_at && !normalized.updated_date) {
    normalized.updated_date = normalized.updated_at;
  }
  return normalized;
}

// Local in-memory / localStorage cache for offline/demo operation
function getLocalCache(entityName: string): any[] {
  const key = `ethiocare_table_${entityName}`;
  const stored = localStorage.getItem(key);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // ignore
    }
  }
  const seed = INITIAL_SEED[entityName] || [];
  localStorage.setItem(key, JSON.stringify(seed));
  return seed;
}

function setLocalCache(entityName: string, data: any[]): void {
  const key = `ethiocare_table_${entityName}`;
  localStorage.setItem(key, JSON.stringify(data));
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isTableNotFoundError(error: any): boolean {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    code === 'PGRST116' ||
    (msg.includes('relation') && msg.includes('does not exist')) ||
    msg.includes('could not find the table') ||
    msg.includes('schema cache')
  );
}

function formatSupabaseError(error: any, action: string, table: string): Error {
  const code = error?.code ? ` [Code: ${error.code}]` : '';
  const hint = error?.hint ? ` (${error.hint})` : '';
  const details = error?.details ? ` - ${error.details}` : '';
  const message = error?.message || 'Unknown database error';
  return new Error(`Supabase ${action} failed on ${table}${code}: ${message}${details}${hint}`);
}

function sanitizePayload(raw: Record<string, any>, isUpdate = false): Record<string, any> {
  const payload = { ...raw };

  // Remove Base44 virtual/read-only timestamp properties
  delete payload.created_date;
  delete payload.updated_date;
  if (isUpdate) {
    delete payload.id;
    delete payload.created_at;
  } else {
    // If id is not a valid UUID (e.g. client generated 'gen-123...'), delete it so Postgres generates gen_random_uuid()
    if (payload.id && !UUID_REGEX.test(payload.id)) {
      delete payload.id;
    }
  }

  for (const [key, val] of Object.entries(payload)) {
    // 1. Foreign keys ending in _id
    if (key.endsWith('_id') || key === 'id') {
      if (val === '' || val === null || val === undefined) {
        payload[key] = null;
      } else if (typeof val === 'string' && !UUID_REGEX.test(val)) {
        // If it's not a valid UUID, don't pass invalid string to UUID columns
        // (Unless it's patient_id, which is text like 'PT-260915-1001')
        if (key !== 'patient_id') {
          payload[key] = null;
        }
      }
    }

    // 2. Dates / Timestamps
    const isDateField = 
      key.endsWith('_date') || 
      key.endsWith('_dob') || 
      key.endsWith('_at') || 
      ['date_of_birth', 'expiry_date', 'manufacturing_date', 'follow_up_date', 'paid_date', 'completed_date', 'administered_date'].includes(key);

    if (isDateField) {
      if (val === '' || val === null || val === undefined) {
        payload[key] = null;
      }
    }

    // 3. Numbers
    const isNumericField = [
      'age', 'quantity', 'min_stock', 'max_stock', 'price', 'amount', 'unit_price',
      'purchase_price', 'tax', 'discount', 'total_price', 'total_amount',
      'blood_pressure_systolic', 'blood_pressure_diastolic', 'temperature', 'pulse',
      'weight', 'height', 'oxygen_level', 'years_experience', 'queue_number'
    ].includes(key);

    if (isNumericField) {
      if (val === '' || val === null || val === undefined) {
        payload[key] = null;
      } else if (typeof val === 'string') {
        const parsed = Number(val);
        payload[key] = isNaN(parsed) ? null : parsed;
      }
    }
  }

  return payload;
}

export class EntityService {
  private entityName: string;
  private tableName: string;

  constructor(entityName: string) {
    this.entityName = entityName;
    this.tableName = TABLE_MAP[entityName] || entityName.toLowerCase();
  }

  /**
   * List records with optional sort and limit.
   * e.g. list('-created_date', 200)
   */
  async list(sortField?: string, limit?: number): Promise<any[]> {
    if (!isSupabaseConfigured()) {
      let items = getLocalCache(this.entityName);
      if (sortField) {
        const desc = sortField.startsWith('-');
        const field = desc ? sortField.slice(1) : sortField;
        items = [...items].sort((a, b) => {
          const valA = a[field] ?? a.created_at ?? '';
          const valB = b[field] ?? b.created_at ?? '';
          return desc ? String(valB).localeCompare(String(valA)) : String(valA).localeCompare(String(valB));
        });
      }
      if (limit) {
        items = items.slice(0, limit);
      }
      return items.map(normalizeRow);
    }

    let query = supabase.from(this.tableName).select('*');

    if (sortField) {
      const desc = sortField.startsWith('-');
      let field = desc ? sortField.slice(1) : sortField;
      if (field === 'created_date') field = 'created_at';
      if (field === 'updated_date') field = 'updated_at';
      query = query.order(field, { ascending: !desc });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) {
      if (isTableNotFoundError(error)) {
        console.warn(`[Supabase EntityService] Table ${this.tableName} not found in Supabase schema cache. Using local persistence fallback.`);
        let items = getLocalCache(this.entityName);
        if (sortField) {
          const desc = sortField.startsWith('-');
          const field = desc ? sortField.slice(1) : sortField;
          items = [...items].sort((a, b) => {
            const valA = a[field] ?? a.created_at ?? '';
            const valB = b[field] ?? b.created_at ?? '';
            return desc ? String(valB).localeCompare(String(valA)) : String(valA).localeCompare(String(valB));
          });
        }
        if (limit) items = items.slice(0, limit);
        return items.map(normalizeRow);
      }
      console.error(`[Supabase EntityService] Error listing ${this.tableName}:`, error);
      throw formatSupabaseError(error, 'list', this.tableName);
    }
    const rows = (data || []).map(normalizeRow);
    if (this.entityName === 'Doctor') {
      const seenIds = new Set<string>();
      const uniqueDocs: any[] = [];
      for (const doc of rows) {
        if (doc?.id && !seenIds.has(doc.id)) {
          seenIds.add(doc.id);
          uniqueDocs.push(doc);
        }
      }
      return uniqueDocs;
    }
    return rows;
  }

  /**
   * Filter records by criteria object.
   * e.g. filter({ visit_id: '...', payment_status: 'paid' })
   */
  async filter(criteria: Record<string, any>): Promise<any[]> {
    if (!isSupabaseConfigured()) {
      const items = getLocalCache(this.entityName);
      const filtered = items.filter(item => {
        return Object.entries(criteria).every(([key, val]) => {
          if (val === undefined) return true;
          return item[key] === val;
        });
      });
      return filtered.map(normalizeRow);
    }

    let query = supabase.from(this.tableName).select('*');

    for (const [key, val] of Object.entries(criteria)) {
      if (val !== undefined && val !== null) {
        query = query.eq(key, val);
      }
    }

    const { data, error } = await query;
    if (error) {
      if (isTableNotFoundError(error)) {
        console.warn(`[Supabase EntityService] Table ${this.tableName} not found in Supabase schema cache. Using local persistence fallback.`);
        const items = getLocalCache(this.entityName);
        const filtered = items.filter(item => {
          return Object.entries(criteria).every(([key, val]) => {
            if (val === undefined) return true;
            return item[key] === val;
          });
        });
        return filtered.map(normalizeRow);
      }
      console.error(`[Supabase EntityService] Error filtering ${this.tableName}:`, error);
      throw formatSupabaseError(error, 'filter', this.tableName);
    }
    return (data || []).map(normalizeRow);
  }

  /**
   * Get single record by ID
   */
  async get(id: string): Promise<any | null> {
    if (!isSupabaseConfigured()) {
      const items = getLocalCache(this.entityName);
      const item = items.find(i => i.id === id);
      return item ? normalizeRow(item) : null;
    }

    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      if (isTableNotFoundError(error)) {
        const items = getLocalCache(this.entityName);
        const item = items.find(i => i.id === id);
        return item ? normalizeRow(item) : null;
      }
      throw formatSupabaseError(error, 'get', this.tableName);
    }
    return data ? normalizeRow(data) : null;
  }

  /**
   * Create a new record.
   */
  async create(data: Record<string, any>): Promise<any> {
    const payload = sanitizePayload(data, false);

    if (!isSupabaseConfigured()) {
      const id = payload.id || `gen-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const now = new Date().toISOString();
      const newRecord = { ...payload, id, created_at: now, updated_at: now };
      const items = getLocalCache(this.entityName);
      setLocalCache(this.entityName, [newRecord, ...items]);
      return normalizeRow(newRecord);
    }

    // STEP 2: Verify real auth session at the moment of insert
    if (this.tableName === 'patients') {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      console.log("PATIENT CREATE AUTH:", {
        userId: user?.id,
        email: user?.email,
        authError
      });

      const { data: { session }, error: sessionError } =
        await supabase.auth.getSession();

      console.log("PATIENT CREATE SESSION:", {
        hasSession: !!session,
        userId: session?.user?.id,
        email: session?.user?.email,
        sessionError
      });

      if (!user || !session) {
        // Auto-heal session using stored hospital credentials if present
        const stored = localStorage.getItem('ethiocare_auth_session');
        if (stored) {
          try {
            const p = JSON.parse(stored);
            if (p?.email) {
              const res = await supabase.auth.signInWithPassword({
                email: p.email.toLowerCase().trim(),
                password: 'Hospital@2026',
              });
              if (res.data?.session) {
                console.log("PATIENT CREATE RECONNECTED AUTH SESSION:", res.data.session.user.id);
              }
            }
          } catch (e) {
            console.warn("Could not re-authenticate session:", e);
          }
        }
      }

      const verifiedUser = (await supabase.auth.getUser()).data.user;
      if (!verifiedUser) {
        throw new Error("Authentication required: Supabase session is null. Please log out and log in again.");
      }
    }

    const { data: inserted, error } = await supabase
      .from(this.tableName)
      .insert(payload as any)
      .select('*')
      .single();

    if (this.tableName === 'patients') {
      console.log("PATIENT INSERT RESULT:", { data: inserted, error });
    }

    if (error) {
      if (isTableNotFoundError(error)) {
        console.warn(`[Supabase EntityService] Table ${this.tableName} not found in Supabase schema cache. Saving record to local persistence.`);
        const id = payload.id || `gen-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const now = new Date().toISOString();
        const newRecord = { ...payload, id, created_at: now, updated_at: now };
        const items = getLocalCache(this.entityName);
        setLocalCache(this.entityName, [newRecord, ...items]);
        return normalizeRow(newRecord);
      }
      throw formatSupabaseError(error, 'create', this.tableName);
    }
    return normalizeRow(inserted);
  }

  /**
   * Update an existing record.
   */
  async update(id: string, data: Record<string, any>): Promise<any> {
    const payload = sanitizePayload(data, true);

    if (!isSupabaseConfigured()) {
      const items = getLocalCache(this.entityName);
      let updatedRecord: any = null;
      const updatedItems = items.map(item => {
        if (item.id === id) {
          updatedRecord = { ...item, ...payload, updated_at: new Date().toISOString() };
          return updatedRecord;
        }
        return item;
      });
      setLocalCache(this.entityName, updatedItems);
      return normalizeRow(updatedRecord || { id, ...payload });
    }

    const { data: updated, error } = await supabase
      .from(this.tableName)
      .update(payload as any)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      if (isTableNotFoundError(error)) {
        console.warn(`[Supabase EntityService] Table ${this.tableName} not found in Supabase schema cache. Updating record in local persistence.`);
        const items = getLocalCache(this.entityName);
        let updatedRecord: any = null;
        const updatedItems = items.map(item => {
          if (item.id === id) {
            updatedRecord = { ...item, ...payload, updated_at: new Date().toISOString() };
            return updatedRecord;
          }
          return item;
        });
        setLocalCache(this.entityName, updatedItems);
        return normalizeRow(updatedRecord || { id, ...payload });
      }
      throw formatSupabaseError(error, 'update', this.tableName);
    }
    if (!updated) {
      throw new Error(`Supabase update failed on ${this.tableName}: row not found or update restricted by row-level security policy.`);
    }
    return normalizeRow(updated);
  }

  /**
   * Delete a record by ID.
   */
  async delete(id: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      const items = getLocalCache(this.entityName);
      const remaining = items.filter(item => item.id !== id);
      setLocalCache(this.entityName, remaining);
      return true;
    }

    const { error } = await supabase
      .from(this.tableName)
      .delete()
      .eq('id', id);

    if (error) {
      if (isTableNotFoundError(error)) {
        console.warn(`[Supabase EntityService] Table ${this.tableName} not found in Supabase schema cache. Deleting from local persistence.`);
        const items = getLocalCache(this.entityName);
        const remaining = items.filter(item => item.id !== id);
        setLocalCache(this.entityName, remaining);
        return true;
      }
      throw formatSupabaseError(error, 'delete', this.tableName);
    }
    return true;
  }

  /**
   * Realtime subscription channel on table changes.
   */
  subscribe(callback: (payload: any) => void): () => void {
    if (!isSupabaseConfigured()) {
      // No-op for offline demo
      return () => {};
    }

    const channel = supabase
      .channel(`realtime:${this.tableName}:${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: this.tableName },
        (payload) => {
          callback(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}
