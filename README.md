# EthioCare Hospital Management System

**EthioCare Hospital Management System** is a modern, full-featured hospital management platform designed for healthcare facilities, clinics, and hospitals. Built with React, Vite, Tailwind CSS, and backed by Supabase PostgreSQL and Authentication, it provides secure, role-based workflows across all clinical and administrative departments.

---

## Portals & Modules

The platform features dedicated, role-guarded portals tailored to each hospital department:

1. **Admin / Owner Portal (`/admin`)**
   - Executive dashboard with daily revenue, patient throughput, and department statistics
   - Staff directory and credential management
   - Fee, tariff, and service configuration
   - Financial ledger, expense tracking, and salary management
   - Clinical audit logging and system settings

2. **Reception Portal (`/reception`)**
   - Rapid patient registration and medical record creation
   - Triage assignment and consultation fee billing
   - Real-time patient queue management and status tracking
   - Patient search and visit history lookup

3. **Doctor Portal (`/doctor`)**
   - Active consultation queue and patient vitals review
   - Diagnosis recording and clinical SOAP notes
   - Medication orders and automated prescription generation
   - Lab investigation orders and results review
   - AI Clinical Assistant support

4. **Nurse Portal (`/nurse`)**
   - Vitals recording (BP, pulse, temperature, SpO2, weight, height)
   - Medication administration tracking and scheduled dosages
   - Unified nursing task queue and clinical procedures

5. **Laboratory Portal (`/lab`)**
   - Lab test catalog and pricing management
   - Pending lab orders queue from doctors
   - Test result entry with reference ranges and printable reports

6. **Pharmacy Portal (`/pharmacy`)**
   - Prescription dispensing queue with stock verification
   - Medication inventory control, reorder alerts, and stock adjustments
   - Walk-in over-the-counter (OTC) medicine sales
   - Batch tracking, expiry monitoring, and stock receipt

7. **Billing Portal (`/billing`)**
   - Consolidated cashier workflows for consultation, lab, and pharmacy fees
   - Real-time payment processing (Cash, Card, Telebirr, CBE Birr)
   - Printable thermal receipts and invoices
   - Financial transaction reports

---

## Technology Stack

- **Frontend**: React 18, Vite, React Router v6, Tailwind CSS, Radix UI, Framer Motion, Lucide Icons
- **Backend**: Supabase (PostgreSQL, Supabase Auth, Row Level Security, Storage)
- **Deployment**: Vercel

---

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- A Supabase project with the schema applied

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd MYHOSPITAL
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables in `.env`:
   ```env
   VITE_SUPABASE_URL=https://<your-supabase-project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
   VITE_APP_NAME="EthioCare HMS"
   VITE_HOSPITAL_NAME="Grand Horizon Hospital"
   VITE_HOSPITAL_DOMAIN="grandhorizonhospital.com"
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Build for production:
   ```bash
   npm run build
   ```

---

## Production Deployment (Vercel)

1. Push your repository to your Git provider.
2. Import the project in Vercel with framework preset **Vite**.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to Vercel Environment Variables.
4. Deploy. The included `vercel.json` ensures client-side routes resolve seamlessly without 404 errors.
