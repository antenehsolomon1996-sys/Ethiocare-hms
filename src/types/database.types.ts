export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: 'owner' | 'admin' | 'receptionist' | 'doctor' | 'nurse' | 'lab_technician' | 'pharmacist' | 'accountant'
          department: string | null
          specialization: string | null
          phone: string | null
          status: 'active' | 'suspended' | 'retired'
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role?: 'owner' | 'admin' | 'receptionist' | 'doctor' | 'nurse' | 'lab_technician' | 'pharmacist' | 'accountant'
          department?: string | null
          specialization?: string | null
          phone?: string | null
          status?: 'active' | 'suspended' | 'retired'
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: 'owner' | 'admin' | 'receptionist' | 'doctor' | 'nurse' | 'lab_technician' | 'pharmacist' | 'accountant'
          department?: string | null
          specialization?: string | null
          phone?: string | null
          status?: 'active' | 'suspended' | 'retired'
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      staff: {
        Row: {
          id: string
          full_name: string
          email: string
          username: string | null
          personal_email: string | null
          role: 'owner' | 'admin' | 'receptionist' | 'doctor' | 'nurse' | 'lab_technician' | 'pharmacist' | 'accountant'
          department: string | null
          specialization: string | null
          phone: string | null
          license_number: string | null
          status: 'active' | 'suspended' | 'retired'
          activation_code: string | null
          activation_used: boolean
          password_set: boolean
          last_login: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          full_name: string
          email: string
          username?: string | null
          personal_email?: string | null
          role: 'owner' | 'admin' | 'receptionist' | 'doctor' | 'nurse' | 'lab_technician' | 'pharmacist' | 'accountant'
          department?: string | null
          specialization?: string | null
          phone?: string | null
          license_number?: string | null
          status?: 'active' | 'suspended' | 'retired'
          activation_code?: string | null
          activation_used?: boolean
          password_set?: boolean
          last_login?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          email?: string
          username?: string | null
          personal_email?: string | null
          role?: 'owner' | 'admin' | 'receptionist' | 'doctor' | 'nurse' | 'lab_technician' | 'pharmacist' | 'accountant'
          department?: string | null
          specialization?: string | null
          phone?: string | null
          license_number?: string | null
          status?: 'active' | 'suspended' | 'retired'
          activation_code?: string | null
          activation_used?: boolean
          password_set?: boolean
          last_login?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      doctors: {
        Row: {
          id: string
          staff_id: string | null
          full_name: string
          email: string | null
          phone: string | null
          specialty: string
          doctor_type: 'General Practitioner' | 'Specialist' | 'Consultant' | 'Resident'
          license_number: string | null
          department: string | null
          bio: string | null
          years_experience: number | null
          availability: 'available' | 'busy' | 'off_duty' | 'on_leave'
          status: 'active' | 'inactive' | 'on_leave'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          staff_id?: string | null
          full_name: string
          email?: string | null
          phone?: string | null
          specialty: string
          doctor_type?: 'General Practitioner' | 'Specialist' | 'Consultant' | 'Resident'
          license_number?: string | null
          department?: string | null
          bio?: string | null
          years_experience?: number | null
          availability?: 'available' | 'busy' | 'off_duty' | 'on_leave'
          status?: 'active' | 'inactive' | 'on_leave'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          staff_id?: string | null
          full_name?: string
          email?: string | null
          phone?: string | null
          specialty?: string
          doctor_type?: 'General Practitioner' | 'Specialist' | 'Consultant' | 'Resident'
          license_number?: string | null
          department?: string | null
          bio?: string | null
          years_experience?: number | null
          availability?: 'available' | 'busy' | 'off_duty' | 'on_leave'
          status?: 'active' | 'inactive' | 'on_leave'
          created_at?: string
          updated_at?: string
        }
      }
      patients: {
        Row: {
          id: string
          patient_id: string
          full_name: string
          gender: 'Male' | 'Female'
          age: number | null
          date_of_birth: string | null
          address: string | null
          phone: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          registration_date: string
          status: 'active' | 'inactive'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          full_name: string
          gender: 'Male' | 'Female'
          age?: number | null
          date_of_birth?: string | null
          address?: string | null
          phone: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          registration_date?: string
          status?: 'active' | 'inactive'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          full_name?: string
          gender?: 'Male' | 'Female'
          age?: number | null
          date_of_birth?: string | null
          address?: string | null
          phone?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          registration_date?: string
          status?: 'active' | 'inactive'
          created_at?: string
          updated_at?: string
        }
      }
      visits: {
        Row: {
          id: string
          patient_id: string
          patient_name: string
          visit_date: string
          queue_number: number | null
          status: 'waiting' | 'with_doctor' | 'lab_pending' | 'lab_paid' | 'lab_processing' | 'lab_complete' | 'pharmacy' | 'completed' | 'cancelled'
          assigned_doctor: string | null
          assigned_doctor_id: string | null
          billing_completed: boolean
          consultation_completed: boolean
          registration_fee_paid: boolean
          symptoms: string | null
          examination_notes: string | null
          diagnosis: string | null
          disease: string | null
          treatment_plan: string | null
          final_diagnosis: string | null
          final_treatment: string | null
          follow_up_date: string | null
          follow_up_notes: string | null
          department: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          patient_name: string
          visit_date?: string
          queue_number?: number | null
          status?: 'waiting' | 'with_doctor' | 'lab_pending' | 'lab_paid' | 'lab_processing' | 'lab_complete' | 'pharmacy' | 'completed' | 'cancelled'
          assigned_doctor?: string | null
          assigned_doctor_id?: string | null
          billing_completed?: boolean
          consultation_completed?: boolean
          registration_fee_paid?: boolean
          symptoms?: string | null
          examination_notes?: string | null
          diagnosis?: string | null
          disease?: string | null
          treatment_plan?: string | null
          final_diagnosis?: string | null
          final_treatment?: string | null
          follow_up_date?: string | null
          follow_up_notes?: string | null
          department?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          patient_name?: string
          visit_date?: string
          queue_number?: number | null
          status?: 'waiting' | 'with_doctor' | 'lab_pending' | 'lab_paid' | 'lab_processing' | 'lab_complete' | 'pharmacy' | 'completed' | 'cancelled'
          assigned_doctor?: string | null
          assigned_doctor_id?: string | null
          billing_completed?: boolean
          consultation_completed?: boolean
          registration_fee_paid?: boolean
          symptoms?: string | null
          examination_notes?: string | null
          diagnosis?: string | null
          disease?: string | null
          treatment_plan?: string | null
          final_diagnosis?: string | null
          final_treatment?: string | null
          follow_up_date?: string | null
          follow_up_notes?: string | null
          department?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      vitals: {
        Row: {
          id: string
          visit_id: string
          patient_id: string
          patient_name: string | null
          blood_pressure_systolic: number | null
          blood_pressure_diastolic: number | null
          temperature: number | null
          pulse: number | null
          weight: number | null
          height: number | null
          oxygen_level: number | null
          nurse_notes: string | null
          recorded_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          visit_id: string
          patient_id: string
          patient_name?: string | null
          blood_pressure_systolic?: number | null
          blood_pressure_diastolic?: number | null
          temperature?: number | null
          pulse?: number | null
          weight?: number | null
          height?: number | null
          oxygen_level?: number | null
          nurse_notes?: string | null
          recorded_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          visit_id?: string
          patient_id?: string
          patient_name?: string | null
          blood_pressure_systolic?: number | null
          blood_pressure_diastolic?: number | null
          temperature?: number | null
          pulse?: number | null
          weight?: number | null
          height?: number | null
          oxygen_level?: number | null
          nurse_notes?: string | null
          recorded_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      nurse_tasks: {
        Row: {
          id: string
          visit_id: string
          patient_id: string
          patient_name: string | null
          task_type: 'injection' | 'iv_treatment' | 'procedure' | 'vitals' | 'other'
          description: string | null
          instructions: string | null
          status: 'pending' | 'in_progress' | 'completed'
          notes: string | null
          doctor_name: string | null
          completed_by: string | null
          completed_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          visit_id: string
          patient_id: string
          patient_name?: string | null
          task_type: 'injection' | 'iv_treatment' | 'procedure' | 'vitals' | 'other'
          description?: string | null
          instructions?: string | null
          status?: 'pending' | 'in_progress' | 'completed'
          notes?: string | null
          doctor_name?: string | null
          completed_by?: string | null
          completed_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          visit_id?: string
          patient_id?: string
          patient_name?: string | null
          task_type?: 'injection' | 'iv_treatment' | 'procedure' | 'vitals' | 'other'
          description?: string | null
          instructions?: string | null
          status?: 'pending' | 'in_progress' | 'completed'
          notes?: string | null
          doctor_name?: string | null
          completed_by?: string | null
          completed_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      lab_orders: {
        Row: {
          id: string
          visit_id: string
          patient_id: string
          patient_name: string
          doctor_name: string | null
          doctor_id: string | null
          test_type: string
          test_name: string | null
          notes: string | null
          payment_status: 'pending' | 'paid' | 'cancelled'
          test_status: 'awaiting_payment' | 'pending' | 'in_progress' | 'completed'
          results: string | null
          result_notes: string | null
          result_file_url: string | null
          price: number
          completed_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          visit_id: string
          patient_id: string
          patient_name: string
          doctor_name?: string | null
          doctor_id?: string | null
          test_type: string
          test_name?: string | null
          notes?: string | null
          payment_status?: 'pending' | 'paid' | 'cancelled'
          test_status?: 'awaiting_payment' | 'pending' | 'in_progress' | 'completed'
          results?: string | null
          result_notes?: string | null
          result_file_url?: string | null
          price?: number
          completed_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          visit_id?: string
          patient_id?: string
          patient_name?: string
          doctor_name?: string | null
          doctor_id?: string | null
          test_type?: string
          test_name?: string | null
          notes?: string | null
          payment_status?: 'pending' | 'paid' | 'cancelled'
          test_status?: 'awaiting_payment' | 'pending' | 'in_progress' | 'completed'
          results?: string | null
          result_notes?: string | null
          result_file_url?: string | null
          price?: number
          completed_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      lab_tests: {
        Row: {
          id: string
          name: string
          category: string
          price: number
          description: string | null
          turnaround_time: string | null
          status: 'active' | 'inactive'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          category?: string
          price?: number
          description?: string | null
          turnaround_time?: string | null
          status?: 'active' | 'inactive'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          category?: string
          price?: number
          description?: string | null
          turnaround_time?: string | null
          status?: 'active' | 'inactive'
          created_at?: string
          updated_at?: string
        }
      }
      medicines: {
        Row: {
          id: string
          name: string
          generic_name: string | null
          brand: string | null
          category: string | null
          dosage_form: string | null
          strength: string | null
          barcode: string | null
          sku: string | null
          batch_number: string | null
          manufacturer: string | null
          supplier: string | null
          purchase_price: number
          unit_price: number
          tax: number
          quantity: number
          min_stock: number
          max_stock: number
          unit: string
          expiry_date: string | null
          manufacturing_date: string | null
          storage_location: string | null
          prescription_required: boolean
          status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'expired'
          archived: boolean
          notes: string | null
          image_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          generic_name?: string | null
          brand?: string | null
          category?: string | null
          dosage_form?: string | null
          strength?: string | null
          barcode?: string | null
          sku?: string | null
          batch_number?: string | null
          manufacturer?: string | null
          supplier?: string | null
          purchase_price?: number
          unit_price?: number
          tax?: number
          quantity?: number
          min_stock?: number
          max_stock?: number
          unit?: string
          expiry_date?: string | null
          manufacturing_date?: string | null
          storage_location?: string | null
          prescription_required?: boolean
          status?: 'in_stock' | 'low_stock' | 'out_of_stock' | 'expired'
          archived?: boolean
          notes?: string | null
          image_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          generic_name?: string | null
          brand?: string | null
          category?: string | null
          dosage_form?: string | null
          strength?: string | null
          barcode?: string | null
          sku?: string | null
          batch_number?: string | null
          manufacturer?: string | null
          supplier?: string | null
          purchase_price?: number
          unit_price?: number
          tax?: number
          quantity?: number
          min_stock?: number
          max_stock?: number
          unit?: string
          expiry_date?: string | null
          manufacturing_date?: string | null
          storage_location?: string | null
          prescription_required?: boolean
          status?: 'in_stock' | 'low_stock' | 'out_of_stock' | 'expired'
          archived?: boolean
          notes?: string | null
          image_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      medication_orders: {
        Row: {
          id: string
          visit_id: string
          patient_id: string
          patient_name: string
          doctor_name: string | null
          doctor_id: string | null
          order_type: 'medicine' | 'injection' | 'iv_treatment' | 'medical_supply' | 'other'
          item_name: string
          dosage: string | null
          frequency: string | null
          duration: string | null
          quantity: number
          unit_price: number
          total_price: number
          instructions: string | null
          urgency: 'routine' | 'urgent' | 'stat'
          payment_status: 'pending_payment' | 'paid' | 'waived' | 'cancelled'
          administration_status: 'awaiting_payment' | 'pending' | 'in_progress' | 'completed' | 'refused'
          payment_id: string | null
          receipt_number: string | null
          paid_by: string | null
          paid_date: string | null
          administered_by: string | null
          administered_date: string | null
          administration_notes: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          visit_id: string
          patient_id: string
          patient_name: string
          doctor_name?: string | null
          doctor_id?: string | null
          order_type: 'medicine' | 'injection' | 'iv_treatment' | 'medical_supply' | 'other'
          item_name: string
          dosage?: string | null
          frequency?: string | null
          duration?: string | null
          quantity?: number
          unit_price?: number
          total_price?: number
          instructions?: string | null
          urgency?: 'routine' | 'urgent' | 'stat'
          payment_status?: 'pending_payment' | 'paid' | 'waived' | 'cancelled'
          administration_status?: 'awaiting_payment' | 'pending' | 'in_progress' | 'completed' | 'refused'
          payment_id?: string | null
          receipt_number?: string | null
          paid_by?: string | null
          paid_date?: string | null
          administered_by?: string | null
          administered_date?: string | null
          administration_notes?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          visit_id?: string
          patient_id?: string
          patient_name?: string
          doctor_name?: string | null
          doctor_id?: string | null
          order_type?: 'medicine' | 'injection' | 'iv_treatment' | 'medical_supply' | 'other'
          item_name?: string
          dosage?: string | null
          frequency?: string | null
          duration?: string | null
          quantity?: number
          unit_price?: number
          total_price?: number
          instructions?: string | null
          urgency?: 'routine' | 'urgent' | 'stat'
          payment_status?: 'pending_payment' | 'paid' | 'waived' | 'cancelled'
          administration_status?: 'awaiting_payment' | 'pending' | 'in_progress' | 'completed' | 'refused'
          payment_id?: string | null
          receipt_number?: string | null
          paid_by?: string | null
          paid_date?: string | null
          administered_by?: string | null
          administered_date?: string | null
          administration_notes?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      prescriptions: {
        Row: {
          id: string
          visit_id: string
          patient_id: string
          patient_name: string
          doctor_name: string | null
          medicine_name: string
          dosage: string | null
          frequency: string | null
          duration: string | null
          instructions: string | null
          quantity: number
          status: 'pending' | 'dispensed' | 'cancelled'
          dispensed_date: string | null
          payment_status: 'pending' | 'paid' | 'cancelled'
          price: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          visit_id: string
          patient_id: string
          patient_name: string
          doctor_name?: string | null
          medicine_name: string
          dosage?: string | null
          frequency?: string | null
          duration?: string | null
          instructions?: string | null
          quantity?: number
          status?: 'pending' | 'dispensed' | 'cancelled'
          dispensed_date?: string | null
          payment_status?: 'pending' | 'paid' | 'cancelled'
          price?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          visit_id?: string
          patient_id?: string
          patient_name?: string
          doctor_name?: string | null
          medicine_name?: string
          dosage?: string | null
          frequency?: string | null
          duration?: string | null
          instructions?: string | null
          quantity?: number
          status?: 'pending' | 'dispensed' | 'cancelled'
          dispensed_date?: string | null
          payment_status?: 'pending' | 'paid' | 'cancelled'
          price?: number
          created_at?: string
          updated_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          visit_id: string | null
          patient_id: string | null
          patient_name: string | null
          payment_type: 'registration' | 'consultation' | 'laboratory' | 'procedure' | 'injection' | 'medicine' | 'other'
          description: string | null
          amount: number
          status: 'pending' | 'paid' | 'cancelled'
          payment_method: 'cash' | 'mobile_banking' | 'card' | 'insurance'
          receipt_number: string | null
          reference_id: string | null
          reference_type: 'lab_order' | 'prescription' | 'service' | 'registration' | 'medication_order' | null
          cashier_name: string | null
          paid_date: string | null
          doctor_name: string | null
          doctor_id: string | null
          medication_order_id: string | null
          medication_name: string | null
          dosage: string | null
          quantity: number | null
          frequency: string | null
          route: string | null
          order_notes: string | null
          order_status: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          visit_id?: string | null
          patient_id?: string | null
          patient_name?: string | null
          payment_type: 'registration' | 'consultation' | 'laboratory' | 'procedure' | 'injection' | 'medicine' | 'other'
          description?: string | null
          amount?: number
          status?: 'pending' | 'paid' | 'cancelled'
          payment_method?: 'cash' | 'mobile_banking' | 'card' | 'insurance'
          receipt_number?: string | null
          reference_id?: string | null
          reference_type?: 'lab_order' | 'prescription' | 'service' | 'registration' | 'medication_order' | null
          cashier_name?: string | null
          paid_date?: string | null
          doctor_name?: string | null
          doctor_id?: string | null
          medication_order_id?: string | null
          medication_name?: string | null
          dosage?: string | null
          quantity?: number | null
          frequency?: string | null
          route?: string | null
          order_notes?: string | null
          order_status?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          visit_id?: string | null
          patient_id?: string | null
          patient_name?: string | null
          payment_type?: 'registration' | 'consultation' | 'laboratory' | 'procedure' | 'injection' | 'medicine' | 'other'
          description?: string | null
          amount?: number
          status?: 'pending' | 'paid' | 'cancelled'
          payment_method?: 'cash' | 'mobile_banking' | 'card' | 'insurance'
          receipt_number?: string | null
          reference_id?: string | null
          reference_type?: 'lab_order' | 'prescription' | 'service' | 'registration' | 'medication_order' | null
          cashier_name?: string | null
          paid_date?: string | null
          doctor_name?: string | null
          doctor_id?: string | null
          medication_order_id?: string | null
          medication_name?: string | null
          dosage?: string | null
          quantity?: number | null
          frequency?: string | null
          route?: string | null
          order_notes?: string | null
          order_status?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      patient_history: {
        Row: {
          id: string
          patient_id: string
          patient_name: string
          patient_phone: string | null
          patient_gender: string | null
          patient_dob: string | null
          visit_id: string | null
          visit_date: string
          doctor_name: string
          doctor_specialty: string | null
          symptoms: string | null
          diagnosis: string | null
          treatment: string | null
          prescription: string | null
          lab_results: string | null
          notes: string | null
          follow_up_date: string | null
          blood_pressure: string | null
          temperature: string | null
          weight: string | null
          pulse: string | null
          record_type: 'visit' | 'lab' | 'prescription' | 'note' | 'vitals'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          patient_name: string
          patient_phone?: string | null
          patient_gender?: string | null
          patient_dob?: string | null
          visit_id?: string | null
          visit_date: string
          doctor_name: string
          doctor_specialty?: string | null
          symptoms?: string | null
          diagnosis?: string | null
          treatment?: string | null
          prescription?: string | null
          lab_results?: string | null
          notes?: string | null
          follow_up_date?: string | null
          blood_pressure?: string | null
          temperature?: string | null
          weight?: string | null
          pulse?: string | null
          record_type?: 'visit' | 'lab' | 'prescription' | 'note' | 'vitals'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          patient_name?: string
          patient_phone?: string | null
          patient_gender?: string | null
          patient_dob?: string | null
          visit_id?: string | null
          visit_date?: string
          doctor_name?: string
          doctor_specialty?: string | null
          symptoms?: string | null
          diagnosis?: string | null
          treatment?: string | null
          prescription?: string | null
          lab_results?: string | null
          notes?: string | null
          follow_up_date?: string | null
          blood_pressure?: string | null
          temperature?: string | null
          weight?: string | null
          pulse?: string | null
          record_type?: 'visit' | 'lab' | 'prescription' | 'note' | 'vitals'
          created_at?: string
          updated_at?: string
        }
      }
      services: {
        Row: {
          id: string
          name: string
          category: 'consultation' | 'procedure' | 'injection' | 'registration' | 'other'
          price: number
          description: string | null
          status: 'active' | 'inactive'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          category: 'consultation' | 'procedure' | 'injection' | 'registration' | 'other'
          price?: number
          description?: string | null
          status?: 'active' | 'inactive'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          category?: 'consultation' | 'procedure' | 'injection' | 'registration' | 'other'
          price?: number
          description?: string | null
          status?: 'active' | 'inactive'
          created_at?: string
          updated_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          user_name: string
          user_role: string | null
          action: 'login' | 'logout' | 'create' | 'update' | 'delete' | 'view' | 'print' | 'approve' | 'reject'
          module: string
          description: string | null
          record_id: string | null
          record_name: string | null
          ip_address: string | null
          timestamp: string
          created_at: string
        }
        Insert: {
          id?: string
          user_name: string
          user_role?: string | null
          action: 'login' | 'logout' | 'create' | 'update' | 'delete' | 'view' | 'print' | 'approve' | 'reject'
          module: string
          description?: string | null
          record_id?: string | null
          record_name?: string | null
          ip_address?: string | null
          timestamp?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_name?: string
          user_role?: string | null
          action?: 'login' | 'logout' | 'create' | 'update' | 'delete' | 'view' | 'print' | 'approve' | 'reject'
          module?: string
          description?: string | null
          record_id?: string | null
          record_name?: string | null
          ip_address?: string | null
          timestamp?: string
          created_at?: string
        }
      }
    }
  }
}
