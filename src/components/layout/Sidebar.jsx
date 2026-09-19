import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Users, UserPlus, Stethoscope, FlaskConical,
  Pill, Receipt, ClipboardList, Activity, Settings, LogOut,
  ChevronLeft, ChevronRight, Heart, Search, CreditCard,
  Package, FileText, Clock, Shield, BarChart2, BookOpen, Building2, Syringe, ShoppingCart,
  PackagePlus, RotateCcw, History, Sparkles, Bell, User, DollarSign, Wallet
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { ethioCareClient } from '@/api/ethioCareClient';
import DoctorSelector from '@/components/doctor/DoctorSelector';
import { useHospitalBranding } from '@/hooks/useHospitalBranding';
import { usePharmacyBranding } from '@/hooks/usePharmacyBranding';

export const roleConfig = {
  owner: {
    title: 'Admin Portal',
    color: 'from-blue-600 to-blue-800',
    icon: LayoutDashboard,
    items: [
      { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/admin/finances', label: 'Finance Tracker', icon: DollarSign },
      { path: '/admin/salaries', label: 'Employee Salaries', icon: Wallet },
      { path: '/admin/staff', label: 'Staff Management', icon: Users },
      { path: '/admin/doctors', label: 'Doctor Management', icon: Stethoscope },
      { path: '/admin/patients', label: 'Patients', icon: Heart },
      { path: '/admin/services', label: 'Services & Pricing', icon: CreditCard },
      { path: '/admin/medicines', label: 'Medicines', icon: Pill },
      { path: '/admin/lab-tests', label: 'Lab Tests', icon: FlaskConical },
      { path: '/admin/fees', label: 'Fee Management', icon: CreditCard },
      { path: '/admin/doctor-portals', label: 'Doctor Portals', icon: Building2 },
      { path: '/admin/reports', label: 'Reports & Analytics', icon: BarChart2 },
      { path: '/admin/audit-logs', label: 'Audit Logs', icon: Shield },
      { path: '/admin/settings', label: 'Settings', icon: Settings },
    ]
  },
  admin: {
    title: 'Admin Portal',
    color: 'from-blue-600 to-blue-800',
    icon: LayoutDashboard,
    items: [
      { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/admin/finances', label: 'Finance Tracker', icon: DollarSign },
      { path: '/admin/salaries', label: 'Employee Salaries', icon: Wallet },
      { path: '/admin/staff', label: 'Staff Management', icon: Users },
      { path: '/admin/doctors', label: 'Doctor Management', icon: Stethoscope },
      { path: '/admin/patients', label: 'Patients', icon: Heart },
      { path: '/admin/services', label: 'Services & Pricing', icon: CreditCard },
      { path: '/admin/medicines', label: 'Medicines', icon: Pill },
      { path: '/admin/lab-tests', label: 'Lab Tests', icon: FlaskConical },
      { path: '/admin/fees', label: 'Fee Management', icon: CreditCard },
      { path: '/admin/doctor-portals', label: 'Doctor Portals', icon: Building2 },
      { path: '/admin/reports', label: 'Reports & Analytics', icon: BarChart2 },
      { path: '/admin/audit-logs', label: 'Audit Logs', icon: Shield },
      { path: '/admin/settings', label: 'Settings', icon: Settings },
    ]
  },
  receptionist: {
    title: 'Reception',
    color: 'from-teal-600 to-teal-800',
    icon: UserPlus,
    items: [
      { path: '/reception', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/reception/register', label: 'Register Patient', icon: UserPlus },
      { path: '/reception/search', label: 'Search Patient', icon: Search },
      { path: '/reception/queue', label: 'Queue View', icon: Clock },
      { path: '/reception/billing', label: 'Billing Desk', icon: CreditCard },
      { path: '/reception/billing/medication-orders', label: 'Medication Orders', icon: Pill },
      { path: '/reception/billing/payments', label: 'Payments', icon: CreditCard },
      { path: '/reception/billing/receipts', label: 'Receipts', icon: Receipt },
    ]
  },
  doctor: {
    title: 'Doctor Portal',
    color: 'from-indigo-600 to-indigo-800',
    icon: Stethoscope,
    items: [
      { path: '/doctor', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/doctor/patients', label: 'Patients', icon: Users },
      { path: '/doctor/queue', label: 'Appointments / Visits', icon: Clock },
      { path: '/doctor/prescriptions', label: 'Prescriptions', icon: Pill },
      { path: '/doctor/medication-orders', label: 'Medication Orders', icon: Syringe },
      { path: '/doctor/lab-orders', label: 'Laboratory / Lab Orders', icon: FlaskConical },
      { path: '/doctor/ai-assistant', label: 'AI Assistant', icon: Sparkles },
      { path: '/doctor/notifications', label: 'Notifications', icon: Bell },
      { path: '/doctor/profile', label: 'Profile / Account', icon: User },
    ]
  },
  nurse: {
    title: 'Nurse Portal',
    color: 'from-pink-600 to-pink-800',
    icon: Activity,
    items: [
      { path: '/nurse', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/nurse/unified-tasks', label: 'My Tasks', icon: ClipboardList },
      { path: '/nurse/tasks', label: 'Care Tasks', icon: ClipboardList },
      { path: '/nurse/medication-orders', label: 'Medication Orders', icon: Syringe },
      { path: '/nurse/vitals', label: 'Record Vitals', icon: Activity },
    ]
  },
  lab_technician: {
    title: 'Laboratory',
    color: 'from-purple-600 to-purple-800',
    icon: FlaskConical,
    items: [
      { path: '/lab', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/lab/orders', label: 'Lab Orders', icon: FlaskConical },
      { path: '/lab/results', label: 'Results', icon: FileText },
    ]
  },
  pharmacist: {
    title: 'Pharmacy',
    color: 'from-green-600 to-green-800',
    icon: Pill,
    items: [
      { path: '/pharmacy', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/pharmacy/receive-stock', label: 'Receive Stock', icon: PackagePlus },
      { path: '/pharmacy/prescriptions', label: 'Hospital Orders', icon: ClipboardList },
      { path: '/pharmacy/sales', label: 'Walk-In POS', icon: ShoppingCart },
      { path: '/pharmacy/sales-history', label: 'Sales History', icon: History },
      { path: '/pharmacy/returns', label: 'Sales Returns', icon: RotateCcw },
      { path: '/pharmacy/inventory', label: 'Inventory', icon: Package },
      { path: '/pharmacy/reports', label: 'Reports', icon: BarChart2 },
      { path: '/pharmacy/settings', label: 'POS Settings', icon: Settings },
    ]
  },
  accountant: {
    title: 'Billing',
    color: 'from-amber-600 to-amber-800',
    icon: Receipt,
    items: [
      { path: '/billing', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/billing/payments', label: 'Payments', icon: CreditCard },
      { path: '/billing/medication-orders', label: 'Medication Orders', icon: Pill },
      { path: '/billing/receipts', label: 'Receipts', icon: Receipt },
    ]
  }
};

export default function Sidebar({ role }) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1024;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setCollapsed(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const location = useLocation();
  const config = roleConfig[role] || roleConfig.owner;
  const Icon = config.icon;
  const { hospital } = useHospitalBranding();
  const { pharmacy } = usePharmacyBranding();

  const isPharmacy = role === 'pharmacist';
  const orgName = isPharmacy ? (pharmacy?.pharmacy_name || 'EthioCare Central Pharmacy') : (hospital?.hospital_name || 'EthioCare Hospital');
  const orgLogo = isPharmacy ? pharmacy?.pharmacy_logo : hospital?.hospital_logo;

  const handleLogout = () => {
    ethioCareClient.auth.logout('/login');
  };

  return (
    <aside className={cn(
      "h-screen sticky top-0 flex flex-col glass-sidebar text-sidebar-foreground transition-all duration-300 z-40 border-r border-sidebar-border",
      collapsed ? "w-[72px]" : "w-64"
    )}>
      {/* Brand header */}
      <div className={cn("p-4 border-b border-sidebar-border", collapsed && "px-3")}>
        <div className="flex items-center gap-3">
          <div className={cn("w-9 h-9 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0 shadow-soft overflow-hidden", collapsed && "mx-auto")}>
            {orgLogo ? (
              <img src={orgLogo} alt={orgName} className="w-full h-full object-contain p-1" loading="lazy" decoding="async" />
            ) : (
              <Icon className="w-5 h-5 text-white" />
            )}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h2 className="font-heading font-bold text-sm tracking-tight truncate">{config.title}</h2>
              <p className="text-[11px] text-sidebar-foreground/60 truncate font-medium">{orgName}</p>
            </div>
          )}
        </div>
      </div>

      {/* Doctor Selector (doctor portal only) */}
      {role === 'doctor' && <DoctorSelector collapsed={collapsed} />}

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {config.items.map((item) => {
          const ItemIcon = item.icon;
          const isActive = location.pathname === item.path ||
            (location.pathname === '/owner' && item.path === '/admin') ||
            (location.pathname === '/admin' && item.path === '/owner') ||
            (location.pathname.replace(/^\/owner/, '/admin') === item.path) ||
            (location.pathname.replace(/^\/admin/, '/owner') === item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "group relative select-none flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 min-h-[44px]",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-soft"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.label : undefined}
            >
              {isActive && !collapsed && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-sidebar-primary" />
              )}
              <ItemIcon className={cn("w-[18px] h-[18px] flex-shrink-0 transition-transform", isActive && "scale-110")} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-sidebar-border space-y-0.5">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground w-full transition-colors min-h-[44px]"
        >
          {collapsed ? <ChevronRight className="w-4 h-4 mx-auto" /> : <><ChevronLeft className="w-4 h-4" /><span>Collapse</span></>}
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 w-full transition-colors min-h-[44px]"
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}