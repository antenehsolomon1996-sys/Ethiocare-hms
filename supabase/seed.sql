-- ==============================================================================
-- EthioCare HMS - Default Seed Data
-- ==============================================================================

-- 1. Standard Hospital Services & Pricing
INSERT INTO public.services (name, category, price, description, status) VALUES
  ('Patient Registration', 'registration', 50.00, 'Standard registration and medical file opening', 'active'),
  ('General Consultation', 'consultation', 150.00, 'Consultation with general medical doctor', 'active'),
  ('Specialist Consultation', 'consultation', 300.00, 'Consultation with specialist medical physician', 'active'),
  ('Emergency Consultation', 'consultation', 250.00, 'Priority emergency triage & physician consultation', 'active'),
  ('Intramuscular / Subcutaneous Injection', 'injection', 35.00, 'Nursing administration of prescribed injection', 'active'),
  ('Intravenous (IV) Infusion Setup', 'injection', 90.00, 'IV line placement and intravenous fluid administration', 'active'),
  ('Minor Wound Dressing', 'procedure', 75.00, 'Antiseptic cleaning and sterile wound bandage dressing', 'active'),
  ('Major Wound Suture / Procedure', 'procedure', 350.00, 'Surgical suturing, local anesthesia, and sterile dressing', 'active'),
  ('Nebulization Therapy', 'procedure', 120.00, 'Bronchodilator respiratory nebulization treatment', 'active'),
  ('Catheterization Procedure', 'procedure', 180.00, 'Urinary catheter placement and monitoring', 'active')
ON CONFLICT DO NOTHING;

-- 2. Standard Laboratory Tests Catalogue
INSERT INTO public.lab_tests (name, category, price, description, turnaround_time, status) VALUES
  ('Complete Blood Count (CBC)', 'Blood', 180.00, 'Full blood count, hemoglobin, hematocrit, WBC differential, platelets', '1 hour', 'active'),
  ('Malaria Rapid Test & Blood Film', 'Blood', 120.00, 'Giemsa stained blood film for plasmodium falciparum / vivax', '45 mins', 'active'),
  ('Typhoid Widal / Ag Test', 'Blood', 150.00, 'Serological screen for Salmonella typhi antibodies', '1 hour', 'active'),
  ('Fasting Blood Glucose (FBG)', 'Blood', 80.00, 'Quantitative blood sugar glucose measurement', '30 mins', 'active'),
  ('Random Blood Sugar (RBS)', 'Blood', 60.00, 'Rapid bedside blood sugar glucose determination', '15 mins', 'active'),
  ('Lipid Profile Panel', 'Blood', 350.00, 'Total cholesterol, HDL, LDL, VLDL, and triglycerides', '3 hours', 'active'),
  ('Liver Function Tests (LFT)', 'Blood', 400.00, 'ALT, AST, ALP, Total Bilirubin, Direct Bilirubin, Albumin', '4 hours', 'active'),
  ('Renal Function Tests (RFT / Bun & Creatinine)', 'Blood', 280.00, 'Serum Creatinine, Blood Urea Nitrogen, electrolytes', '2 hours', 'active'),
  ('Urine Routine Analysis', 'Urine', 90.00, 'Physical, chemical dipstick, and microscopic urine analysis', '30 mins', 'active'),
  ('Stool Examination Routine', 'Stool', 80.00, 'Microscopic ova, parasites, and protozoa detection', '30 mins', 'active'),
  ('H. Pylori Stool Antigen Test', 'Stool', 220.00, 'Rapid qualitative antigen detection for gastric infection', '45 mins', 'active'),
  ('HIV 1/2 Rapid Antibody Screen', 'Blood', 0.00, 'Confidential national protocol HIV screening', '20 mins', 'active'),
  ('Chest X-Ray (PA View)', 'Radiology', 450.00, 'Plain chest radiography for pulmonary evaluation', '1 hour', 'active'),
  ('Abdominal Ultrasound Examination', 'Radiology', 550.00, 'Complete abdominal sonography by radiologist', '1.5 hours', 'active')
ON CONFLICT DO NOTHING;

-- 3. Pharmacy Essential Medicines & Inventory
INSERT INTO public.medicines (name, generic_name, brand, category, dosage_form, strength, barcode, sku, batch_number, manufacturer, supplier, purchase_price, unit_price, tax, quantity, min_stock, max_stock, unit, expiry_date, manufacturing_date, storage_location, prescription_required, status) VALUES
  ('Amoxicillin 500mg', 'Amoxicillin', 'Amoxil', 'Antibiotic', 'Capsule', '500mg', '890123456701', 'MED-AMX-500', 'B2026-01', 'Cadila Pharma', 'MedTech Supplies', 8.50, 15.00, 0, 450, 50, 1000, 'capsules', CURRENT_DATE + INTERVAL '18 months', CURRENT_DATE - INTERVAL '3 months', 'Shelf A-1', true, 'in_stock'),
  ('Paracetamol 500mg', 'Acetaminophen', 'Panadol', 'Analgesic', 'Tablet', '500mg', '890123456702', 'MED-PAR-500', 'B2026-02', 'EPHARM', 'Central Medical Stores', 1.20, 3.50, 0, 1200, 100, 3000, 'tablets', CURRENT_DATE + INTERVAL '24 months', CURRENT_DATE - INTERVAL '2 months', 'Shelf A-2', false, 'in_stock'),
  ('Ibuprofen 400mg', 'Ibuprofen', 'Brufen', 'Analgesic', 'Tablet', '400mg', '890123456703', 'MED-IBU-400', 'B2026-03', 'Julphar', 'HealthCare Distribution', 3.00, 6.00, 0, 600, 50, 1500, 'tablets', CURRENT_DATE + INTERVAL '16 months', CURRENT_DATE - INTERVAL '4 months', 'Shelf A-3', false, 'in_stock'),
  ('Ciprofloxacin 500mg', 'Ciprofloxacin', 'Cipro', 'Antibiotic', 'Tablet', '500mg', '890123456704', 'MED-CIP-500', 'B2026-04', 'Bayer Health', 'MedTech Supplies', 12.00, 22.00, 0, 320, 40, 800, 'tablets', CURRENT_DATE + INTERVAL '14 months', CURRENT_DATE - INTERVAL '5 months', 'Shelf B-1', true, 'in_stock'),
  ('Omeprazole 20mg', 'Omeprazole', 'Losec', 'Antacid', 'Capsule', '20mg', '890123456705', 'MED-OME-020', 'B2026-05', 'AstraZeneca', 'EthioPharma Wholesale', 5.50, 12.00, 0, 850, 60, 2000, 'capsules', CURRENT_DATE + INTERVAL '20 months', CURRENT_DATE - INTERVAL '2 months', 'Shelf B-2', false, 'in_stock'),
  ('Ceftriaxone 1g Injection', 'Ceftriaxone Sodium', 'Rocephin', 'Antibiotic', 'Injection', '1g Vial', '890123456706', 'MED-CEF-001', 'B2026-06', 'Roche Pharma', 'National Med Importers', 45.00, 85.00, 0, 150, 30, 500, 'vials', CURRENT_DATE + INTERVAL '12 months', CURRENT_DATE - INTERVAL '6 months', 'Cold Room Shelf C-1', true, 'in_stock'),
  ('Normal Saline 0.9% 500ml', 'Sodium Chloride 0.9%', 'Saline IV', 'Other', 'Injection', '500ml IV', '890123456707', 'MED-NS-500', 'B2026-07', 'EPHARM', 'Central Medical Stores', 28.00, 55.00, 0, 280, 50, 600, 'bottles', CURRENT_DATE + INTERVAL '30 months', CURRENT_DATE - INTERVAL '1 month', 'Fluid Bay F-1', true, 'in_stock'),
  ('Ringer Lactate 500ml', 'Hartmann Solution', 'RL IV', 'Other', 'Injection', '500ml IV', '890123456708', 'MED-RL-500', 'B2026-08', 'EPHARM', 'Central Medical Stores', 32.00, 65.00, 0, 240, 40, 500, 'bottles', CURRENT_DATE + INTERVAL '28 months', CURRENT_DATE - INTERVAL '2 months', 'Fluid Bay F-2', true, 'in_stock'),
  ('Metformin 500mg', 'Metformin HCl', 'Glucophage', 'Diabetes', 'Tablet', '500mg', '890123456709', 'MED-MET-500', 'B2026-09', 'Merck', 'HealthCare Distribution', 4.00, 8.50, 0, 520, 60, 1200, 'tablets', CURRENT_DATE + INTERVAL '22 months', CURRENT_DATE - INTERVAL '3 months', 'Shelf C-2', true, 'in_stock'),
  ('Amlodipine 5mg', 'Amlodipine Besylate', 'Norvasc', 'Cardiovascular', 'Tablet', '5mg', '890123456710', 'MED-AML-005', 'B2026-10', 'Pfizer', 'EthioPharma Wholesale', 6.00, 14.00, 0, 400, 40, 1000, 'tablets', CURRENT_DATE + INTERVAL '15 months', CURRENT_DATE - INTERVAL '4 months', 'Shelf C-3', true, 'in_stock'),
  ('Salbutamol Inhaler 100mcg', 'Albuterol Sulfate', 'Ventolin', 'Respiratory', 'Inhaler', '200 Doses', '890123456711', 'MED-SAL-INH', 'B2026-11', 'GSK', 'International Med', 85.00, 145.00, 0, 75, 20, 250, 'canisters', CURRENT_DATE + INTERVAL '18 months', CURRENT_DATE - INTERVAL '3 months', 'Shelf D-1', true, 'in_stock'),
  ('Diclofenac 75mg/3ml Injection', 'Diclofenac Sodium', 'Voltaren', 'Analgesic', 'Injection', '75mg Ampoule', '890123456712', 'MED-DIC-AMP', 'B2026-12', 'Novartis', 'MedTech Supplies', 15.00, 32.00, 0, 18, 25, 400, 'ampoules', CURRENT_DATE + INTERVAL '10 months', CURRENT_DATE - INTERVAL '8 months', 'Shelf D-2', true, 'low_stock')
ON CONFLICT DO NOTHING;

-- 4. Clinical Doctors Directory
INSERT INTO public.doctors (full_name, email, phone, specialty, doctor_type, license_number, department, bio, years_experience, availability, status) VALUES
  ('Dr. Selamawit Tadesse', 'dr.selamawit@grandhorizonhospital.com', '+251 91 123 4567', 'Internal Medicine', 'Consultant', 'MED-LIC-84920', 'Internal Medicine', 'Chief of Internal Medicine with extensive clinical care experience.', 14, 'available', 'active'),
  ('Dr. Dawit Alemu', 'dr.dawit@grandhorizonhospital.com', '+251 92 234 5678', 'General Practice', 'General Practitioner', 'MED-LIC-73819', 'Outpatient OPD', 'Primary care and triage specialist dedicated to family medicine.', 8, 'available', 'active'),
  ('Dr. Helen Bekele', 'dr.helen@grandhorizonhospital.com', '+251 93 345 6789', 'Pediatrics', 'Specialist', 'MED-LIC-92014', 'Pediatrics', 'Specialized in neonatal medicine and pediatric emergency care.', 11, 'available', 'active'),
  ('Dr. Yohannes Girma', 'dr.yohannes@grandhorizonhospital.com', '+251 94 456 7890', 'Cardiology', 'Consultant', 'MED-LIC-61029', 'Cardiology', 'Board-certified cardiologist with clinical catheterization expertise.', 16, 'available', 'active'),
  ('Dr. Meron Haile', 'dr.meron@grandhorizonhospital.com', '+251 95 567 8901', 'Obstetrics & Gynecology', 'Specialist', 'MED-LIC-55092', 'Maternity & OB-GYN', 'Specialist in high-risk obstetric care and maternal health.', 10, 'available', 'active')
ON CONFLICT DO NOTHING;

-- 5. Staff Directory with Pre-configured Activation Codes
INSERT INTO public.staff (full_name, email, username, role, department, specialization, phone, status, activation_code, activation_used, password_set) VALUES
  ('Administrator', 'admin@grandhorizonhospital.com', 'admin', 'owner', 'Executive', 'Hospital Administration', '+251 91 000 0001', 'active', 'HMS-ADMN-2026', false, false),
  ('Dr. Selamawit Tadesse', 'dr.selamawit@grandhorizonhospital.com', 'selamawit.t', 'doctor', 'Internal Medicine', 'Internal Medicine', '+251 91 123 4567', 'active', 'HMS-DOC1-2026', false, false),
  ('Dr. Dawit Alemu', 'dr.dawit@grandhorizonhospital.com', 'dawit.a', 'doctor', 'Outpatient OPD', 'General Practice', '+251 92 234 5678', 'active', 'HMS-DOC2-2026', false, false),
  ('Sister Tigist Mengistu', 'tigist.m@grandhorizonhospital.com', 'tigist.m', 'nurse', 'Nursing Services', 'Critical Care Nurse', '+251 91 222 3344', 'active', 'HMS-NURS-2026', false, false),
  ('Almaz Tesfaye', 'almaz.t@grandhorizonhospital.com', 'almaz.t', 'receptionist', 'Front Desk', 'Front Desk & Patient Intake', '+251 91 333 4455', 'active', 'HMS-RCPT-2026', false, false),
  ('Kidus Worku', 'kidus.w@grandhorizonhospital.com', 'kidus.w', 'lab_technician', 'Laboratory', 'Clinical Pathology', '+251 91 444 5566', 'active', 'HMS-LABT-2026', false, false),
  ('Bethelhem Solomon', 'bethelhem.s@grandhorizonhospital.com', 'bethelhem.s', 'pharmacist', 'Pharmacy', 'Clinical Pharmacist', '+251 91 555 6677', 'active', 'HMS-PHAR-2026', false, false),
  ('Mulugeta Kebede', 'mulugeta.k@grandhorizonhospital.com', 'mulugeta.k', 'accountant', 'Finance & Billing', 'Cashier & Medical Accountant', '+251 91 666 7788', 'active', 'HMS-BILL-2026', false, false)
ON CONFLICT (email) DO NOTHING;

-- Link doctors to staff
UPDATE public.doctors d
SET staff_id = s.id
FROM public.staff s
WHERE LOWER(d.email) = LOWER(s.email);

-- 6. Sample Patients
INSERT INTO public.patients (patient_id, full_name, gender, age, date_of_birth, address, phone, emergency_contact_name, emergency_contact_phone, registration_date, status) VALUES
  ('PT-260915-1001', 'Abebe Kebede', 'Male', 42, '1984-05-12', 'Bole Sub-City, Woreda 03, Addis Ababa', '+251 91 789 0123', 'Hiwot Kebede (Spouse)', '+251 92 789 0124', CURRENT_DATE, 'active'),
  ('PT-260915-1002', 'Sara Mohammed', 'Female', 29, '1997-09-24', 'Kirkos Sub-City, Addis Ababa', '+251 91 890 1234', 'Ahmed Mohammed (Brother)', '+251 93 890 1235', CURRENT_DATE, 'active'),
  ('PT-260915-1003', 'Tewodros Kassahun', 'Male', 58, '1968-02-18', 'Yeka Sub-City, Addis Ababa', '+251 91 901 2345', 'Aster Kassahun (Daughter)', '+251 94 901 2346', CURRENT_DATE, 'active')
ON CONFLICT (patient_id) DO NOTHING;
