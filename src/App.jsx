import { Toaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { DoctorProvider } from '@/lib/DoctorContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ThemeProvider } from 'next-themes';
import { TabNavigationProvider } from '@/lib/TabNavigationContext';
import { lazy, Suspense } from 'react';
import ErrorBoundary from '@/components/common/ErrorBoundary';

// Auth pages
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const ActivateAccount = lazy(() => import('@/pages/ActivateAccount'));

// Role redirect
const RoleRedirect = lazy(() => import('@/pages/RoleRedirect'));

// Portal Layouts
const PortalLayout = lazy(() => import('@/components/layout/PortalLayout'));

// Owner pages
const OwnerDashboard = lazy(() => import('@/pages/owner/OwnerDashboard'));
const StaffManagement = lazy(() => import('@/pages/owner/StaffManagement'));
const DoctorManagement = lazy(() => import('@/pages/owner/DoctorManagement'));
const PatientsList = lazy(() => import('@/pages/owner/PatientsList'));
const ServicesManagement = lazy(() => import('@/pages/owner/ServicesManagement'));
const MedicinesManagement = lazy(() => import('@/pages/owner/MedicinesManagement'));
const LabTestsManagement = lazy(() => import('@/pages/owner/LabTestsManagement'));
const FeeManagement = lazy(() => import('@/pages/owner/FeeManagement'));
const FinanceTracker = lazy(() => import('@/pages/owner/FinanceTracker'));
const SalaryManagement = lazy(() => import('@/pages/owner/SalaryManagement'));
const Reports = lazy(() => import('@/pages/owner/Reports'));
const AuditLogs = lazy(() => import('@/pages/owner/AuditLogs'));
const OwnerSettings = lazy(() => import('@/pages/owner/OwnerSettings'));
const DoctorPortals = lazy(() => import('@/pages/owner/DoctorPortals'));

// Reception pages
const ReceptionDashboard = lazy(() => import('@/pages/reception/ReceptionDashboard'));
const RegisterPatient = lazy(() => import('@/pages/reception/RegisterPatient'));
const QueueView = lazy(() => import('@/pages/reception/QueueView'));
const PatientSearch = lazy(() => import('@/pages/reception/PatientSearch'));
const ReceptionBilling = lazy(() => import('@/pages/reception/ReceptionBilling'));

// Doctor pages
const DoctorDashboard = lazy(() => import('@/pages/doctor/DoctorDashboard'));
const DoctorQueue = lazy(() => import('@/pages/doctor/DoctorQueue'));
const DoctorPatientHistory = lazy(() => import('@/pages/doctor/DoctorPatientHistory'));
const PatientRecords = lazy(() => import('@/pages/doctor/PatientRecords'));
const MyPatients = lazy(() => import('@/pages/doctor/MyPatients'));
const DoctorAIAssistant = lazy(() => import('@/pages/doctor/DoctorAIAssistant'));
const DoctorPrescriptions = lazy(() => import('@/pages/doctor/DoctorPrescriptions'));
const DoctorMedicationOrders = lazy(() => import('@/pages/doctor/DoctorMedicationOrders'));
const DoctorLabOrders = lazy(() => import('@/pages/doctor/DoctorLabOrders'));
const DoctorNotifications = lazy(() => import('@/pages/doctor/DoctorNotifications'));
const DoctorProfile = lazy(() => import('@/pages/doctor/DoctorProfile'));

// Nurse pages
const NurseDashboard = lazy(() => import('@/pages/nurse/NurseDashboard'));
const NurseTasks = lazy(() => import('@/pages/nurse/NurseTasks'));
const RecordVitals = lazy(() => import('@/pages/nurse/RecordVitals'));

// Lab pages
const LabDashboard = lazy(() => import('@/pages/lab/LabDashboard'));
const LabOrders = lazy(() => import('@/pages/lab/LabOrders'));
const LabResults = lazy(() => import('@/pages/lab/LabResults'));

// Pharmacy pages
const PharmacyDashboard = lazy(() => import('@/pages/pharmacy/PharmacyDashboard'));
const PrescriptionsList = lazy(() => import('@/pages/pharmacy/PrescriptionsList'));
const Inventory = lazy(() => import('@/pages/pharmacy/Inventory'));
const WalkInSales = lazy(() => import('@/pages/pharmacy/WalkInSales'));
const ReceiveStock = lazy(() => import('@/pages/pharmacy/ReceiveStock'));
const SalesHistory = lazy(() => import('@/pages/pharmacy/SalesHistory'));
const SalesReturns = lazy(() => import('@/pages/pharmacy/SalesReturns'));
const PharmacyReports = lazy(() => import('@/pages/pharmacy/PharmacyReports'));
const PharmacySettings = lazy(() => import('@/pages/pharmacy/PharmacySettings'));

// Billing pages
const BillingDashboard = lazy(() => import('@/pages/billing/BillingDashboard'));
const PaymentsList = lazy(() => import('@/pages/billing/PaymentsList'));
const ReceiptsList = lazy(() => import('@/pages/billing/ReceiptsList'));
const MedicationOrdersBilling = lazy(() => import('@/pages/billing/MedicationOrdersBilling'));
const MedicationAdministration = lazy(() => import('@/pages/nurse/MedicationAdministration'));
const NurseUnifiedTasks = lazy(() => import('@/pages/nurse/NurseUnifiedTasks'));

const PageLoader = () => (
  <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] p-8 animate-in fade-in-50 duration-200">
    <div className="relative flex items-center justify-center">
      <div className="w-10 h-10 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
      <div className="absolute w-4 h-4 rounded-full bg-primary/10" />
    </div>
    <p className="text-xs font-medium text-muted-foreground mt-3 tracking-wide">Loading portal view...</p>
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading HMS...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <ErrorBoundary title="Application Error">
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Global Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/activate-account" element={<ActivateAccount />} />

          {/* Root Role-based redirect */}
          <Route path="/" element={<RoleRedirect />} />

          {/* Admin / Owner Portal (accessible via /admin and /owner) */}
          <Route element={<PortalLayout role="owner" />}>
            <Route path="/admin" element={<OwnerDashboard />} />
            <Route path="/admin/finances" element={<FinanceTracker />} />
            <Route path="/admin/salaries" element={<SalaryManagement />} />
            <Route path="/admin/staff" element={<StaffManagement />} />
            <Route path="/admin/doctors" element={<DoctorManagement />} />
            <Route path="/admin/patients" element={<PatientsList />} />
            <Route path="/admin/services" element={<ServicesManagement />} />
            <Route path="/admin/medicines" element={<MedicinesManagement />} />
            <Route path="/admin/lab-tests" element={<LabTestsManagement />} />
            <Route path="/admin/fees" element={<FeeManagement />} />
            <Route path="/admin/doctor-portals" element={<DoctorPortals />} />
            <Route path="/admin/reports" element={<Reports />} />
            <Route path="/admin/audit-logs" element={<AuditLogs />} />
            <Route path="/admin/settings" element={<OwnerSettings />} />

            <Route path="/owner" element={<OwnerDashboard />} />
            <Route path="/owner/finances" element={<FinanceTracker />} />
            <Route path="/owner/finance" element={<FinanceTracker />} />
            <Route path="/owner/salaries" element={<SalaryManagement />} />
            <Route path="/owner/salary" element={<SalaryManagement />} />
            <Route path="/owner/staff" element={<StaffManagement />} />
            <Route path="/owner/doctors" element={<DoctorManagement />} />
            <Route path="/owner/patients" element={<PatientsList />} />
            <Route path="/owner/services" element={<ServicesManagement />} />
            <Route path="/owner/medicines" element={<MedicinesManagement />} />
            <Route path="/owner/lab-tests" element={<LabTestsManagement />} />
            <Route path="/owner/fees" element={<FeeManagement />} />
            <Route path="/owner/fee-management" element={<FeeManagement />} />
            <Route path="/owner/doctor-portals" element={<DoctorPortals />} />
            <Route path="/owner/reports" element={<Reports />} />
            <Route path="/owner/audit-logs" element={<AuditLogs />} />
            <Route path="/owner/settings" element={<OwnerSettings />} />
          </Route>

          {/* Reception Portal */}
          <Route element={<PortalLayout role="receptionist" />}>
            <Route path="/reception" element={<ReceptionDashboard />} />
            <Route path="/reception/register" element={<RegisterPatient />} />
            <Route path="/reception/search" element={<PatientSearch />} />
            <Route path="/reception/queue" element={<QueueView />} />
            <Route path="/reception/billing" element={<ReceptionBilling />} />
            <Route path="/reception/billing/medication-orders" element={<MedicationOrdersBilling />} />
            <Route path="/reception/billing/payments" element={<PaymentsList />} />
            <Route path="/reception/billing/receipts" element={<ReceiptsList />} />
          </Route>

          {/* Doctor Portal */}
          <Route element={<PortalLayout role="doctor" />}>
            <Route path="/doctor" element={<DoctorDashboard />} />
            <Route path="/doctor/queue" element={<DoctorQueue />} />
            <Route path="/doctor/my-patients" element={<MyPatients />} />
            <Route path="/doctor/patients" element={<MyPatients />} />
            <Route path="/doctor/history" element={<DoctorPatientHistory />} />
            <Route path="/doctor/patient-records" element={<PatientRecords />} />
            <Route path="/doctor/prescriptions" element={<DoctorPrescriptions />} />
            <Route path="/doctor/medication-orders" element={<DoctorMedicationOrders />} />
            <Route path="/doctor/lab-orders" element={<DoctorLabOrders />} />
            <Route path="/doctor/ai-assistant" element={<DoctorAIAssistant />} />
            <Route path="/doctor/notifications" element={<DoctorNotifications />} />
            <Route path="/doctor/profile" element={<DoctorProfile />} />
          </Route>

          {/* Nurse Portal */}
          <Route element={<PortalLayout role="nurse" />}>
            <Route path="/nurse" element={<NurseDashboard />} />
            <Route path="/nurse/tasks" element={<NurseTasks />} />
            <Route path="/nurse/medication-orders" element={<MedicationAdministration />} />
            <Route path="/nurse/unified-tasks" element={<NurseUnifiedTasks />} />
            <Route path="/nurse/vitals" element={<RecordVitals />} />
          </Route>

          {/* Lab Portal (accessible via /lab and /laboratory) */}
          <Route element={<PortalLayout role="lab_technician" />}>
            <Route path="/lab" element={<LabDashboard />} />
            <Route path="/lab/orders" element={<LabOrders />} />
            <Route path="/lab/results" element={<LabResults />} />

            <Route path="/laboratory" element={<LabDashboard />} />
            <Route path="/laboratory/orders" element={<LabOrders />} />
            <Route path="/laboratory/results" element={<LabResults />} />
          </Route>

          {/* Pharmacy Portal */}
          <Route element={<PortalLayout role="pharmacist" />}>
            <Route path="/pharmacy" element={<PharmacyDashboard />} />
            <Route path="/pharmacy/prescriptions" element={<PrescriptionsList />} />
            <Route path="/pharmacy/receive-stock" element={<ReceiveStock />} />
            <Route path="/pharmacy/sales" element={<WalkInSales />} />
            <Route path="/pharmacy/walk-in" element={<WalkInSales />} />
            <Route path="/pharmacy/sales-history" element={<SalesHistory />} />
            <Route path="/pharmacy/returns" element={<SalesReturns />} />
            <Route path="/pharmacy/inventory" element={<Inventory />} />
            <Route path="/pharmacy/reports" element={<PharmacyReports />} />
            <Route path="/pharmacy/settings" element={<PharmacySettings />} />
          </Route>

          {/* Billing Portal */}
          <Route element={<PortalLayout role="accountant" />}>
            <Route path="/billing" element={<BillingDashboard />} />
            <Route path="/billing/payments" element={<PaymentsList />} />
            <Route path="/billing/medication-orders" element={<MedicationOrdersBilling />} />
            <Route path="/billing/receipts" element={<ReceiptsList />} />
          </Route>

          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
};

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <DoctorProvider>
          <QueryClientProvider client={queryClientInstance}>
            <TabNavigationProvider>
              <Router>
                <AuthenticatedApp />
              </Router>
              <Toaster />
            </TabNavigationProvider>
          </QueryClientProvider>
        </DoctorProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App