import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { roleConfig } from './Sidebar';
import { useTabNavigation } from '@/lib/TabNavigationContext';
import { useHospitalBranding } from '@/hooks/useHospitalBranding';
import { usePharmacyBranding } from '@/hooks/usePharmacyBranding';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  FlaskConical,
  Pill,
  Receipt,
  ClipboardList,
  Activity,
  MoreHorizontal,
  Bell,
  Clock,
  Syringe,
  ShoppingCart,
  Package,
  BarChart2,
  ChevronRight,
  LogOut,
  DollarSign,
  CreditCard,
} from 'lucide-react';
import { ethioCareClient } from '@/api/ethioCareClient';

// Dedicated top 4 destinations per portal (5th button is always 'More' drawer)
const PORTAL_NAV_ITEMS = {
  doctor: [
    { path: '/doctor', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/doctor/patients', label: 'Patient Tracking', icon: Users },
    { path: '/doctor/queue', label: 'Visits & Queue', icon: Clock },
    { path: '/doctor/prescriptions', label: 'Prescriptions', icon: ClipboardList },
  ],
  receptionist: [
    { path: '/reception', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/reception/search', label: 'Search Patients', icon: Users },
    { path: '/reception/register', label: 'Register Patient', icon: UserPlus },
    { path: '/reception/queue', label: 'Patient Queue', icon: Clock },
  ],
  nurse: [
    { path: '/nurse', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/nurse/unified-tasks', label: 'My Tasks', icon: ClipboardList },
    { path: '/nurse/medication-orders', label: 'Medication Orders', icon: Syringe },
    { path: '/nurse/vitals', label: 'Record Vitals', icon: Activity },
  ],
  lab_technician: [
    { path: '/lab', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/lab/orders', label: 'Lab Orders', icon: FlaskConical },
    { path: '/lab/results', label: 'Lab Results', icon: ClipboardList },
    { path: '/lab/orders', id: 'lab-alerts', label: 'Lab Alerts', icon: Bell },
  ],
  pharmacist: [
    { path: '/pharmacy', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/pharmacy/sales', label: 'Walk-In POS', icon: ShoppingCart },
    { path: '/pharmacy/prescriptions', label: 'Hospital Orders', icon: ClipboardList },
    { path: '/pharmacy/inventory', label: 'Medicine Stock', icon: Package },
  ],
  accountant: [
    { path: '/billing', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/billing/payments', label: 'Billing & Payments', icon: Receipt },
    { path: '/billing/medication-orders', label: 'Medication Orders', icon: Pill },
    { path: '/billing/receipts', label: 'Receipts History', icon: CreditCard },
  ],
  owner: [
    { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/staff', label: 'Staff Management', icon: Users },
    { path: '/admin/finances', label: 'Finance Tracker', icon: DollarSign },
    { path: '/admin/reports', label: 'Reports & Analytics', icon: BarChart2 },
  ],
  admin: [
    { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/staff', label: 'Staff Management', icon: Users },
    { path: '/admin/finances', label: 'Finance Tracker', icon: DollarSign },
    { path: '/admin/reports', label: 'Reports & Analytics', icon: BarChart2 },
  ],
};

/**
 * MobileFloatingNav
 * Compact, luxury vertical floating icon rail positioned on the lower right side for mobile viewports.
 * Replaces the horizontal bottom bar to eliminate content overlap and enable natural full-page scrolling.
 */
export default function MobileFloatingNav({ role }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { getTabPath } = useTabNavigation();
  const [moreOpen, setMoreOpen] = useState(false);

  const { hospital } = useHospitalBranding();
  const { pharmacy } = usePharmacyBranding();

  const isPharmacy = role === 'pharmacist';
  const orgName = isPharmacy
    ? pharmacy?.pharmacy_name || 'EthioCare Central Pharmacy'
    : hospital?.hospital_name || 'EthioCare Hospital';

  const fullConfig = roleConfig[role] || roleConfig.owner;
  const primaryItems = PORTAL_NAV_ITEMS[role] || fullConfig.items.slice(0, 4);

  // Normalize owner/admin paths for route matching
  const normalize = (p) => (p || '').replace(/^\/owner/, '/admin');
  const currentNorm = normalize(location.pathname);

  const handleNavClick = (e, item) => {
    e.preventDefault();
    const targetNorm = normalize(item.path);
    const isActive = currentNorm === targetNorm;
    if (isActive) {
      navigate(item.path, { replace: true });
    } else {
      const savedPath = getTabPath(item.path);
      navigate(savedPath || item.path);
    }
  };

  const handleMoreItemClick = (path) => {
    setMoreOpen(false);
    navigate(path);
    // Guarantee body scroll restoration on mobile navigation drawer close
    requestAnimationFrame(() => {
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
      document.body.removeAttribute('data-scroll-locked');
      document.documentElement.style.overflow = '';
    });
  };

  const handleLogout = () => {
    setMoreOpen(false);
    document.body.style.overflow = '';
    document.body.style.pointerEvents = '';
    document.body.removeAttribute('data-scroll-locked');
    ethioCareClient.auth.logout('/login');
  };

  return (
    <>
      {/* Vertical Floating Navigation Rail (Mobile viewports only) */}
      <aside
        aria-label="Mobile Navigation Rail"
        className={cn(
          "md:hidden fixed z-40 right-3",
          "bottom-[calc(16px+env(safe-area-inset-bottom,0px))]",
          "flex flex-col items-center gap-1 p-1.5",
          "w-14 rounded-2xl",
          "bg-card/92 dark:bg-[#0f0b0d]/92 backdrop-blur-xl",
          "border border-border/70 dark:border-border/60",
          "shadow-2xl shadow-black/20 dark:shadow-black/60",
          "transition-all duration-200 select-none"
        )}
      >
        {/* 4 Primary Navigation Icons */}
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const targetNorm = normalize(item.path);
          const isActive =
            currentNorm === targetNorm ||
            (targetNorm !== `/${role}` && targetNorm !== '/admin' && currentNorm.startsWith(targetNorm + '/'));

          return (
            <Link
              key={item.id || item.path}
              to={item.path}
              onClick={(e) => handleNavClick(e, item)}
              title={item.label}
              aria-label={item.label}
              className={cn(
                "relative flex items-center justify-center",
                "w-11 h-11 min-h-[44px] min-w-[44px] rounded-xl",
                "transition-all duration-150 active:scale-95",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/30 scale-105"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {(item.label === 'Lab Alerts' || item.id === 'lab-alerts') && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-500 animate-pulse ring-2 ring-card" />
              )}
            </Link>
          );
        })}

        {/* Separator before 'More' */}
        <div className="w-6 h-px bg-border/60 my-0.5" />

        {/* 5th 'More' Navigation Button */}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          title="More Portal Navigation"
          aria-label="More portal navigation"
          className={cn(
            "relative flex items-center justify-center",
            "w-11 h-11 min-h-[44px] min-w-[44px] rounded-xl",
            "transition-all duration-150 active:scale-95",
            moreOpen
              ? "bg-primary/20 text-primary font-bold shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
          )}
        >
          <MoreHorizontal className="w-5 h-5 shrink-0" />
        </button>
      </aside>

      {/* Luxury 'More' Navigation Sheet Drawer */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl max-h-[85vh] max-h-[85dvh] overflow-y-auto p-5 border-t border-border/60 bg-background/95 backdrop-blur-xl"
          style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <SheetHeader className="text-left pb-4 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="text-base font-bold text-foreground">
                  {fullConfig.title} Menu
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                  {orgName}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* Complete Navigation List */}
          <div className="py-4 space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2">
              All Portal Destinations:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {fullConfig.items.map((item) => {
                const ItemIcon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => handleMoreItemClick(item.path)}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl text-left text-xs font-semibold transition-all min-h-[44px]",
                      isActive
                        ? "bg-primary/10 text-primary border border-primary/20 shadow-xs"
                        : "bg-muted/40 hover:bg-muted/70 text-foreground border border-transparent"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                        isActive ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground border border-border/50"
                      )}>
                        <ItemIcon className="w-4 h-4" />
                      </div>
                      <span className="truncate">{item.label}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sign Out Action */}
          <div className="pt-3 border-t border-border/50 flex gap-2">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-xs font-bold hover:bg-destructive/15 transition-colors min-h-[44px]"
            >
              <LogOut className="w-4 h-4" />
              Sign Out of HMS
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
