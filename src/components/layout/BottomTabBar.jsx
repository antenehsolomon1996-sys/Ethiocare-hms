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
  Stethoscope,
  FlaskConical,
  Pill,
  Receipt,
  ClipboardList,
  Activity,
  Settings,
  MoreHorizontal,
  Sparkles,
  Bell,
  Clock,
  Syringe,
  ShoppingCart,
  Package,
  PackagePlus,
  BarChart2,
  ChevronRight,
  LogOut,
  User,
  DollarSign,
} from 'lucide-react';
import { ethioCareClient } from '@/api/ethioCareClient';

// Dedicated top 4 destinations per portal (5th is always 'More' drawer)
const PORTAL_BOTTOM_NAV = {
  doctor: [
    { path: '/doctor', label: 'Home', icon: LayoutDashboard },
    { path: '/doctor/patients', label: 'Patients', icon: Users },
    { path: '/doctor/ai-assistant', label: 'AI Clinical', icon: Sparkles },
    { path: '/doctor/notifications', label: 'Alerts', icon: Bell },
  ],
  receptionist: [
    { path: '/reception', label: 'Home', icon: LayoutDashboard },
    { path: '/reception/search', label: 'Patients', icon: Users },
    { path: '/reception/register', label: 'Register', icon: UserPlus },
    { path: '/reception/queue', label: 'Queue', icon: Clock },
  ],
  nurse: [
    { path: '/nurse', label: 'Home', icon: LayoutDashboard },
    { path: '/nurse/unified-tasks', label: 'Tasks', icon: ClipboardList },
    { path: '/nurse/medication-orders', label: 'Med Orders', icon: Syringe },
    { path: '/nurse/vitals', label: 'Vitals', icon: Activity },
  ],
  lab_technician: [
    { path: '/lab', label: 'Home', icon: LayoutDashboard },
    { path: '/lab/orders', label: 'Orders', icon: FlaskConical },
    { path: '/lab/results', label: 'Results', icon: ClipboardList },
    { path: '/lab/orders', id: 'lab-alerts', label: 'Alerts', icon: Bell },
  ],
  pharmacist: [
    { path: '/pharmacy', label: 'Home', icon: LayoutDashboard },
    { path: '/pharmacy/sales', label: 'POS', icon: ShoppingCart },
    { path: '/pharmacy/prescriptions', label: 'Orders', icon: ClipboardList },
    { path: '/pharmacy/inventory', label: 'Stock', icon: Package },
  ],
  accountant: [
    { path: '/billing', label: 'Home', icon: LayoutDashboard },
    { path: '/billing/payments', label: 'Payments', icon: Receipt },
    { path: '/billing/medication-orders', label: 'Med Orders', icon: Pill },
    { path: '/billing/receipts', label: 'Receipts', icon: Receipt },
  ],
  owner: [
    { path: '/admin', label: 'Home', icon: LayoutDashboard },
    { path: '/admin/staff', label: 'Staff', icon: Users },
    { path: '/admin/finances', label: 'Finances', icon: DollarSign },
    { path: '/admin/reports', label: 'Reports', icon: BarChart2 },
  ],
  admin: [
    { path: '/admin', label: 'Home', icon: LayoutDashboard },
    { path: '/admin/staff', label: 'Staff', icon: Users },
    { path: '/admin/finances', label: 'Finances', icon: DollarSign },
    { path: '/admin/reports', label: 'Reports', icon: BarChart2 },
  ],
};

export default function BottomTabBar({ role }) {
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
  const primaryItems = PORTAL_BOTTOM_NAV[role] || fullConfig.items.slice(0, 4);

  // Remaining portal items for the "More" drawer
  const primaryPaths = new Set(primaryItems.map(i => i.path));
  const moreItems = fullConfig.items.filter(item => !primaryPaths.has(item.path));

  const handleNavClick = (e, item) => {
    e.preventDefault();
    const isActive = location.pathname === item.path;
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
  };

  const handleLogout = () => {
    setMoreOpen(false);
    ethioCareClient.auth.logout('/login');
  };

  return (
    <>
      {/* Fixed Luxury Bottom Tab Bar (Mobile/Tablet only) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 dark:bg-[#0c080a]/95 backdrop-blur-xl border-t border-border/60 dark:border-burgundy-900/30 shadow-premium flex items-stretch justify-around px-1"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          minHeight: 'calc(var(--mobile-bottom-nav-height, 3.75rem) + env(safe-area-inset-bottom, 0px))'
        }}
      >
        {/* 4 Primary Navigation Items */}
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const normalize = (p) => (p || '').replace(/^\/owner/, '/admin');
          const currentNorm = normalize(location.pathname);
          const targetNorm = normalize(item.path);
          const isActive =
            currentNorm === targetNorm ||
            (targetNorm !== `/${role}` && targetNorm !== '/admin' && currentNorm.startsWith(targetNorm + '/'));

          return (
            <Link
              key={item.id || item.path}
              to={item.path}
              onClick={(e) => handleNavClick(e, item)}
              className={cn(
                "relative select-none flex flex-col items-center justify-center gap-1 min-h-[52px] py-1.5 px-1 flex-1 min-w-0 transition-all active:scale-95",
                isActive ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
              )}
              <div className="relative">
                <Icon className={cn("w-5 h-5 transition-transform", isActive && "scale-110")} />
                {(item.label === 'Alerts' || item.id === 'lab-alerts') && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 animate-pulse ring-2 ring-background" />
                )}
              </div>
              <span className="text-[10px] truncate max-w-full tracking-tight">
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* 5th "More" Navigation Button */}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cn(
            "relative select-none flex flex-col items-center justify-center gap-1 min-h-[52px] py-1.5 px-1 flex-1 min-w-0 transition-all active:scale-95",
            moreOpen ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[10px] truncate max-w-full tracking-tight">More</span>
        </button>
      </nav>

      {/* Luxury "More" Bottom Sheet Drawer */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl max-h-[85vh] max-h-[85dvh] overflow-y-auto p-5 border-t border-border/60 bg-background/95 backdrop-blur-xl"
          style={{ paddingBottom: 'calc(var(--mobile-bottom-spacer-extra, 2rem) + env(safe-area-inset-bottom, 0px))' }}
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

          {/* Navigation Grid of Remaining Items */}
          <div className="py-4 space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2">
              All Portal Features:
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

          {/* Bottom Actions */}
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
