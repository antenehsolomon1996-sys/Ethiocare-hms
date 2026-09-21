import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import Sidebar from './Sidebar';
import MobileFloatingNav from './MobileFloatingNav';
import PortalFooter from './PortalFooter';
import ThemeToggle from './ThemeToggle';
import HealthcareBackground from './HealthcareBackground';
import NotificationBell from '@/components/common/NotificationBell';
import { Menu, Bell, User, Settings, Trash2, ChevronLeft, ShieldAlert, Search, Building2, Pill } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { ethioCareClient } from '@/api/ethioCareClient';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { useTabNavigation } from '@/lib/TabNavigationContext';
import { roleConfig } from './Sidebar';
import { useHospitalBranding } from '@/hooks/useHospitalBranding';
import { usePharmacyBranding } from '@/hooks/usePharmacyBranding';
import { useDoctorContext } from '@/lib/DoctorContext';
import PortalLoginPage from '@/pages/auth/PortalLoginPage';
import PortalAccessDenied from '@/components/layout/PortalAccessDenied';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const ROOT_ROUTES = ['/admin', '/owner', '/reception', '/doctor', '/nurse', '/lab', '/laboratory', '/pharmacy', '/billing', '/login', '/register', '/forgot-password', '/reset-password', '/activate-account'];

// RBAC: strict 1:1 role isolation per portal (with owner/admin management oversight)
const PORTAL_ACCESS = {
  owner: ['owner', 'admin'],
  admin: ['owner', 'admin'],
  receptionist: ['receptionist', 'reception', 'owner', 'admin'],
  doctor: ['doctor'],
  nurse: ['nurse'],
  lab_technician: ['lab_technician', 'lab', 'laboratory'],
  pharmacist: ['pharmacist', 'pharmacy'],
  accountant: ['accountant', 'billing', 'cashier'],
};

const ROLE_TO_PORTAL_KEY = {
  owner: 'admin',
  admin: 'admin',
  receptionist: 'reception',
  reception: 'reception',
  doctor: 'doctor',
  nurse: 'nurse',
  lab_technician: 'lab',
  lab: 'lab',
  laboratory: 'lab',
  pharmacist: 'pharmacy',
  pharmacy: 'pharmacy',
  accountant: 'billing',
  billing: 'billing',
  cashier: 'billing',
};

const ROLE_ROUTES = {
  owner: '/admin',
  admin: '/admin',
  receptionist: '/reception',
  reception: '/reception',
  doctor: '/doctor',
  nurse: '/nurse',
  lab_technician: '/lab',
  lab: '/lab',
  laboratory: '/lab',
  pharmacist: '/pharmacy',
  pharmacy: '/pharmacy',
  accountant: '/billing',
  billing: '/billing',
  cashier: '/billing',
};

export default function PortalLayout({ role }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { user, logout, isLoadingAuth } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isRootRoute = ROOT_ROUTES.includes(location.pathname);
  const pageName = location.pathname.split('/').pop()?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Dashboard';
  const { setTabPath } = useTabNavigation();

  const { hospital } = useHospitalBranding();
  const { pharmacy } = usePharmacyBranding();
  const doctorContext = useDoctorContext();
  const selectedDoctor = role === 'doctor' ? doctorContext?.selectedDoctor : null;
  const isPharmacy = role === 'pharmacist';
  const brandName = isPharmacy ? (pharmacy?.pharmacy_name || 'EthioCare Central Pharmacy') : (hospital?.hospital_name || 'EthioCare Hospital');
  const brandLogo = isPharmacy ? pharmacy?.pharmacy_logo : hospital?.hospital_logo;
  const portalLabel = roleConfig[role]?.title || 'Hospital Portal';

  // Breadcrumb segments
  const pathSegments = location.pathname.split('/').filter(Boolean);

  useEffect(() => {
    const config = roleConfig[role];
    if (!config) return;
    const matched = config.items
      .map(i => i.path)
      .filter(p => location.pathname === p || location.pathname.startsWith(p + '/'))
      .sort((a, b) => b.length - a.length)[0];
    if (matched) {
      setTabPath(matched, location.pathname);
    }
  }, [location.pathname, role, setTabPath]);

  // Lock background scroll when mobile sidebar drawer is open, and restore when closed
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  // Ensure body scroll is always restored when navigating or after modal/drawer close
  useEffect(() => {
    setMobileOpen(false);
    const timer = setTimeout(() => {
      const hasOpenModal = document.querySelector('[data-state="open"][role="dialog"], [data-state="open"][role="alertdialog"], [role="dialog"][data-state="open"]');
      if (!hasOpenModal && !mobileOpen && !deleteOpen) {
        if (document.body.style.overflow === 'hidden') {
          document.body.style.overflow = '';
        }
        if (document.body.style.pointerEvents === 'none') {
          document.body.style.pointerEvents = '';
        }
        document.body.removeAttribute('data-scroll-locked');
        document.documentElement.style.overflow = '';
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  // When unauthenticated, render the dedicated portal login page at this exact URL
  if (!user) {
    if (isLoadingAuth) {
      return (
        <div className="flex h-screen h-dvh items-center justify-center bg-background">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Loading portal...</p>
          </div>
        </div>
      );
    }
    const portalKey = ROLE_TO_PORTAL_KEY[role] || 'admin';
    return (
      <PortalLoginPage
        portalKey={portalKey}
        onLoginSuccess={(profile) => {
          const userRole = profile?.role ? profile.role.toLowerCase().trim() : role;
          const dest = ROLE_ROUTES[userRole] || ROLE_ROUTES[role] || '/admin';
          navigate(dest, { replace: true });
        }}
      />
    );
  }

  // RBAC: verify the logged-in user's role matches this portal
  const userRole = user?.role;
  const isAuthorized = PORTAL_ACCESS[role]?.includes(userRole) ?? false;

  if (user && !isAuthorized) {
    return <PortalAccessDenied portalRole={role} />;
  }

  const handleRefresh = async () => {
    await queryClient.invalidateQueries();
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      if (typeof ethioCareClient.auth.deleteAccount === 'function') {
        await ethioCareClient.auth.deleteAccount();
      }
      window.location.href = '/login';
    } catch {
      toast.error('Unable to delete account. Please contact support.');
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  return (
    <div className="portal-shell min-h-screen min-h-[100dvh] flex flex-col md:flex-row bg-background relative">
      {/* Moving Ambient Healthcare Background */}
      <HealthcareBackground />

      {/* Desktop sidebar */}
      <div className="hidden md:block shrink-0 self-start sticky top-0 h-screen z-40">
        <Sidebar role={role} />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 h-full animate-slide-in-right">
            <Sidebar role={role} />
          </div>
        </div>
      )}

      {/* Main content wrapper */}
      <div className="portal-content-wrapper flex-1 min-w-0 flex flex-col min-h-screen min-h-[100dvh] relative z-10">
        {/* Top bar */}
        <header
          className="glass border-b border-border/60 flex items-center justify-between px-3 md:px-5 flex-shrink-0 transition-all z-30 sticky top-0"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)', minHeight: 'calc(3.75rem + env(safe-area-inset-top, 0px))' }}
        >
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <Button variant="ghost" size="icon" className="md:hidden shrink-0 min-h-[44px] min-w-[44px]" onClick={() => setMobileOpen(true)} aria-label="Open portal navigation menu">
              <Menu className="w-5 h-5" />
            </Button>

            {/* Brand emblem and portal badge */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                {brandLogo ? (
                  <img src={brandLogo} alt={brandName} className="w-full h-full object-contain p-0.5" loading="lazy" decoding="async" />
                ) : isPharmacy ? (
                  <Pill className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Building2 className="w-4 h-4 text-primary" />
                )}
              </div>
              <div className="min-w-0 hidden sm:block">
                <p className="text-xs font-bold leading-tight truncate tracking-tight text-foreground">{brandName}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-primary/10 text-primary uppercase tracking-wider">
                    {isPharmacy ? 'Dispensary & POS' : portalLabel}
                  </span>
                </div>
              </div>
            </div>

            <div className="h-4 w-px bg-border/60 hidden md:block shrink-0 mx-1" />

            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 min-w-0">
              {!isRootRoute && (
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate(-1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              )}
              <nav className="flex items-center gap-1.5 text-xs sm:text-sm min-w-0">
                {pathSegments.map((segment, i) => (
                  <span key={i} className="flex items-center gap-1.5 min-w-0">
                    {i > 0 && <span className="text-muted-foreground/40 text-xs">/</span>}
                    <span className={cn(
                      "truncate",
                      i === pathSegments.length - 1
                        ? "font-semibold text-foreground capitalize"
                        : "text-muted-foreground capitalize hidden lg:inline"
                    )}>
                      {segment.replace(/-/g, ' ')}
                    </span>
                  </span>
                ))}
              </nav>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Doctor Viewing Status Badge (Desktop) */}
            {role === 'doctor' && selectedDoctor && (
              <div className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs shadow-2xs">
                <span className="text-muted-foreground font-medium">Viewing As:</span>
                <span className="font-semibold text-foreground">Dr. {selectedDoctor.full_name}</span>
                {selectedDoctor.specialty && (
                  <>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-primary font-medium">{selectedDoctor.specialty}</span>
                  </>
                )}
                {selectedDoctor.department && (
                  <>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-muted-foreground">{selectedDoctor.department} Dept.</span>
                  </>
                )}
                <span className={cn(
                  "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider",
                  selectedDoctor.availability === 'available' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                  selectedDoctor.availability === 'busy' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                  'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                )}>
                  {selectedDoctor.availability || 'available'}
                </span>
              </div>
            )}

            {/* Search (desktop) */}
            <div className="hidden lg:flex relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                className="w-44 xl:w-56 h-9 rounded-lg border border-border/60 bg-card/50 pl-9 pr-3 text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 transition-all"
              />
            </div>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Notifications */}
            <NotificationBell role={role} />

            {/* User profile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 outline-none cursor-pointer pl-1">
                  <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center shadow-soft">
                    <span className="text-xs font-bold text-white">
                      {role === 'doctor' && selectedDoctor?.full_name ? selectedDoctor.full_name[0] : (user?.full_name?.[0] || 'U')}
                    </span>
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-xs font-semibold leading-none">
                      {role === 'doctor' && selectedDoctor?.full_name ? `Dr. ${selectedDoctor.full_name}` : (user?.full_name || 'User')}
                    </p>
                    <p className="text-[10px] text-muted-foreground capitalize mt-0.5">
                      {role === 'doctor' && selectedDoctor?.specialty ? selectedDoctor.specialty : role?.replace('_', ' ')}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="font-normal">
                  <p className="text-sm font-semibold leading-none">
                    {role === 'doctor' && selectedDoctor?.full_name ? `Dr. ${selectedDoctor.full_name}` : (user?.full_name || 'User')}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground mt-1">
                    {role === 'doctor' && selectedDoctor?.email ? selectedDoctor.email : (user?.email || '')}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {role === 'doctor' ? (
                  <>
                    <DropdownMenuItem onClick={() => navigate('/doctor/profile')}>
                      <User className="w-4 h-4" />
                      <span>Doctor Profile</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => navigate(isPharmacy ? '/pharmacy/settings' : '/owner/settings')}>
                      <Settings className="w-4 h-4" />
                      <span>Settings</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive focus:bg-destructive/5"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Account</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Contextual Mobile Portal Sub-Header (Section 8: Authentic Data Strip) */}
        <div className="md:hidden border-b border-border/60 bg-card/90 backdrop-blur-md px-3.5 py-2 flex items-center justify-between z-20 shadow-2xs shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-heading text-foreground tracking-tight">
                {portalLabel}
              </span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {role === 'doctor' && selectedDoctor?.availability
                  ? selectedDoctor.availability.toUpperCase()
                  : (user?.status || 'Active').toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate mt-0.5">
              <span className="font-medium text-foreground/90 truncate">
                {role === 'doctor' && selectedDoctor?.full_name ? `Dr. ${selectedDoctor.full_name}` : (user?.full_name || 'Staff User')}
              </span>
              <span>•</span>
              <span className="truncate">
                {role === 'doctor' && selectedDoctor?.specialty
                  ? selectedDoctor.specialty
                  : (user?.department || roleConfig[role]?.title?.replace(' Portal', '') || 'Hospital Staff')}
              </span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <span className="text-[10px] text-muted-foreground/80 font-mono">
              {brandName.split(' ')[0]}
            </span>
          </div>
        </div>

        {/* Primary Portal Content Container */}
        <div className="portal-content flex-1 flex flex-col min-w-0">
          {/* Main page content with mobile floating nav clearance */}
          <main className="flex-1 flex flex-col p-3.5 sm:p-4 md:p-6 lg:p-8 pb-24 sm:pb-8 md:pb-6 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col min-w-0"
              >
                <ErrorBoundary title="Portal View Error">
                  <Outlet />
                </ErrorBoundary>
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Shared Permanent Compact Portal Footer in normal document flow */}
          <PortalFooter role={role} />
        </div>
      </div>

      {/* Mobile vertical floating icon navigation */}
      <MobileFloatingNav role={role} />

      {/* Delete Account Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your account and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete Account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}