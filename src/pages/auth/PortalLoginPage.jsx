import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Lock,
  Mail,
  ShieldCheck,
  Stethoscope,
  UserPlus,
  Activity,
  FlaskConical,
  Pill,
  Receipt,
  LayoutDashboard,
  Building2,
  ArrowRight,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import HealthcareBackground from '@/components/layout/HealthcareBackground';
import { useHospitalBranding } from '@/hooks/useHospitalBranding';
import { usePharmacyBranding } from '@/hooks/usePharmacyBranding';

export const PORTAL_METADATA = {
  admin: {
    role: 'owner',
    allowedRoles: ['owner', 'admin'],
    title: 'Admin & Executive Portal',
    subtitle: 'Hospital governance, finance, employee salaries, and operations',
    icon: LayoutDashboard,
    badge: 'Executive Access',
    color: 'from-blue-600 to-indigo-700',
    accentClass: 'text-blue-600 dark:text-blue-400',
    borderClass: 'border-blue-500/20',
    quickEmail: 'admin@grandhorizonhospital.com',
    quickRole: 'Hospital Administrator',
  },
  reception: {
    role: 'receptionist',
    allowedRoles: ['receptionist', 'owner', 'admin'],
    title: 'Reception & Front Desk Portal',
    subtitle: 'Patient registration, 30-day tariff policies, queue, and checkout',
    icon: UserPlus,
    badge: 'Front Desk Access',
    color: 'from-teal-600 to-cyan-700',
    accentClass: 'text-teal-600 dark:text-teal-400',
    borderClass: 'border-teal-500/20',
    quickEmail: 'almaz.t@grandhorizonhospital.com',
    quickRole: 'Front Desk Officer',
  },
  doctor: {
    role: 'doctor',
    allowedRoles: ['doctor'],
    title: 'Doctor & Clinical Portal',
    subtitle: 'Consultation queue, e-prescriptions, lab orders, and AI clinical assistant',
    icon: Stethoscope,
    badge: 'Physician Access',
    color: 'from-indigo-600 to-violet-700',
    accentClass: 'text-indigo-600 dark:text-indigo-400',
    borderClass: 'border-indigo-500/20',
    quickEmail: 'dr.selamawit@grandhorizonhospital.com',
    quickRole: 'Attending Physician',
  },
  nurse: {
    role: 'nurse',
    allowedRoles: ['nurse'],
    title: 'Nursing & Inpatient Care Portal',
    subtitle: 'Vitals tracking, medication administration, and unified care tasks',
    icon: Activity,
    badge: 'Nursing Care Access',
    color: 'from-rose-600 to-pink-700',
    accentClass: 'text-rose-600 dark:text-rose-400',
    borderClass: 'border-rose-500/20',
    quickEmail: 'tigist.m@grandhorizonhospital.com',
    quickRole: 'Charge Nurse',
  },
  lab: {
    role: 'lab_technician',
    allowedRoles: ['lab_technician'],
    title: 'Laboratory Diagnostic Portal',
    subtitle: 'Sample processing, specimen intake, and diagnostic test results',
    icon: FlaskConical,
    badge: 'Laboratory Access',
    color: 'from-purple-600 to-indigo-700',
    accentClass: 'text-purple-600 dark:text-purple-400',
    borderClass: 'border-purple-500/20',
    quickEmail: 'kidus.w@grandhorizonhospital.com',
    quickRole: 'Laboratory Technician',
  },
  pharmacy: {
    role: 'pharmacist',
    allowedRoles: ['pharmacist'],
    title: 'Central Pharmacy Portal',
    subtitle: 'Dispensing, walk-in sales, stock inventory, and invoice reconciliation',
    icon: Pill,
    badge: 'Pharmacy Access',
    color: 'from-emerald-600 to-teal-700',
    accentClass: 'text-emerald-600 dark:text-emerald-400',
    borderClass: 'border-emerald-500/20',
    quickEmail: 'bethelhem.s@grandhorizonhospital.com',
    quickRole: 'Lead Pharmacist',
  },
  billing: {
    role: 'accountant',
    allowedRoles: ['accountant'],
    title: 'Hospital Billing & Cashier Desk',
    subtitle: 'Payment settlement, gate unlocking, receipts, and revenue reconciliation',
    icon: Receipt,
    badge: 'Finance & Cashier Access',
    color: 'from-amber-600 to-orange-700',
    accentClass: 'text-amber-600 dark:text-amber-400',
    borderClass: 'border-amber-500/20',
    quickEmail: 'mulugeta.k@grandhorizonhospital.com',
    quickRole: 'Hospital Cashier / Accountant',
  },
};

export default function PortalLoginPage({ portalKey = 'admin', onLoginSuccess }) {
  const meta = PORTAL_METADATA[portalKey] || PORTAL_METADATA.admin;
  const PortalIcon = meta.icon;

  const { login, user, isAuthenticated, isLoadingAuth } = useAuth();
  const navigate = useNavigate();

  const { hospital } = useHospitalBranding();
  const { pharmacy } = usePharmacyBranding();

  // Branding: Pharmacy portal strictly uses Pharmacy branding; others use Hospital branding
  const isPharmacy = portalKey === 'pharmacy';
  const brandName = isPharmacy
    ? (pharmacy?.pharmacy_name || 'EthioCare Central Pharmacy')
    : (hospital?.hospital_name || 'Grand Horizon Hospital');
  const brandLogo = isPharmacy ? pharmacy?.pharmacy_logo : hospital?.hospital_logo;

  const showDevSwitcher = hospital?.dev_portal_switcher_enabled !== undefined
    ? Boolean(hospital.dev_portal_switcher_enabled)
    : import.meta.env.DEV;

  const [email, setEmail] = useState('');
  const [credential, setCredential] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If already authenticated and user has access to this portal, redirect to portal dashboard
  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated && user?.role) {
      if (meta.allowedRoles.includes(user.role)) {
        if (onLoginSuccess) {
          onLoginSuccess(user);
        }
      }
    }
  }, [isLoadingAuth, isAuthenticated, user, meta, onLoginSuccess]);

  const handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Direct login with target portal validation
      const profile = await login(email, credential, meta.role);

      // Verify portal authorization
      if (!meta.allowedRoles.includes(profile.role)) {
        const readableRole = profile.role.replace(/_/g, ' ');
        throw new Error(`Access denied. ${readableRole} credentials cannot access the ${meta.title}.`);
      }

      if (onLoginSuccess) {
        onLoginSuccess(profile);
      }
    } catch (err) {
      setError(err.message || 'Invalid hospital email or credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail(meta.quickEmail);
    setCredential('Hospital@2026');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      <HealthcareBackground />

      <div className="w-full max-w-md relative z-10 animate-in fade-in-50 zoom-in-95 duration-200">
        {/* Portal Luxury Header Card */}
        <div className="bg-card/90 backdrop-blur-md border border-border rounded-2xl shadow-xl p-8 space-y-6">
          <div className="text-center space-y-3">
            {/* Branding Logo or Portal Icon */}
            <div className="flex items-center justify-center">
              {brandLogo ? (
                <div className="w-16 h-16 rounded-2xl overflow-hidden border border-border shadow-md bg-white flex items-center justify-center p-1.5">
                  <img src={brandLogo} alt={brandName} className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${meta.color} text-white flex items-center justify-center shadow-lg`}>
                  <PortalIcon className="w-8 h-8" />
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                {brandName}
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-foreground mt-1">
                {meta.title}
              </h2>
              <div className="flex items-center justify-center gap-2 mt-2">
                <Badge variant="outline" className={`font-medium text-xs px-2.5 py-0.5 ${meta.borderClass} ${meta.accentClass}`}>
                  {meta.badge}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2 px-2">
                {meta.subtitle}
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2.5 animate-in fade-in-50 duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="text-xs font-medium">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="portal-email" className="text-xs font-semibold text-foreground">
                Hospital Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="portal-email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@grandhorizonhospital.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11 bg-background"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="portal-password" className="text-xs font-semibold text-foreground">
                  Password or Staff Code
                </Label>
                <Link to="/forgot-password" className="text-[11px] text-primary hover:underline font-medium">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="portal-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="•••••••• or HMS-XXXX-XXXX"
                  value={credential}
                  onChange={(e) => setCredential(e.target.value)}
                  className="pl-10 h-11 bg-background"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 font-semibold gap-2 shadow-sm text-sm"
              disabled={loading}
            >
              {loading ? (
                'Verifying Credentials...'
              ) : (
                <>
                  Sign In to {meta.badge.replace(' Access', '')}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          {/* 1-Click Demo Credentials (Controlled by Owner Setting) */}
          {showDevSwitcher && (
            <div className="pt-3 border-t border-border">
              <button
                type="button"
                onClick={handleFillDemo}
                className="w-full py-1.5 px-3 rounded-lg border border-dashed border-border text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3 h-3 text-primary" />
                Fill {meta.quickRole} Credentials ({meta.quickEmail})
              </button>
            </div>
          )}

          <div className="text-center pt-2 text-xs text-muted-foreground">
            First time logging in?{' '}
            <Link to="/activate-account" className="text-primary font-semibold hover:underline inline-flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Activate account
            </Link>
          </div>
        </div>

        {/* Global Navigation Link to Other Portals */}
        <div className="text-center mt-4">
          <Link to="/login" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
            ← Switch to General Hospital Staff Login
          </Link>
        </div>
      </div>
    </div>
  );
}
