import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogIn, Mail, Lock, ShieldCheck, UserCheck, Stethoscope, UserPlus, Activity, FlaskConical, Pill, Receipt } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { useHospitalBranding } from "@/hooks/useHospitalBranding";

const PORTALS = [
  { value: "auto", label: "Auto-detect from role" },
  { value: "owner", label: "Owner Portal" },
  { value: "doctor", label: "Doctor Portal" },
  { value: "receptionist", label: "Reception Portal" },
  { value: "nurse", label: "Nurse Portal" },
  { value: "lab_technician", label: "Lab Portal" },
  { value: "pharmacist", label: "Pharmacy Portal" },
  { value: "accountant", label: "Billing Portal" },
];

const QUICK_ROLES = [
  { label: "Admin", email: "admin@grandhorizonhospital.com", code: "HMS-ADMN-2026", role: "owner", icon: UserCheck, color: "hover:border-blue-500" },
  { label: "Doctor", email: "dr.selamawit@grandhorizonhospital.com", code: "HMS-DOC1-2026", role: "doctor", icon: Stethoscope, color: "hover:border-indigo-500" },
  { label: "Reception", email: "almaz.t@grandhorizonhospital.com", code: "HMS-RCPT-2026", role: "receptionist", icon: UserPlus, color: "hover:border-teal-500" },
  { label: "Nurse", email: "tigist.m@grandhorizonhospital.com", code: "HMS-NURS-2026", role: "nurse", icon: Activity, color: "hover:border-pink-500" },
  { label: "Lab", email: "kidus.w@grandhorizonhospital.com", code: "HMS-LABT-2026", role: "lab_technician", icon: FlaskConical, color: "hover:border-purple-500" },
  { label: "Pharmacy", email: "bethelhem.s@grandhorizonhospital.com", code: "HMS-PHAR-2026", role: "pharmacist", icon: Pill, color: "hover:border-emerald-500" },
  { label: "Billing", email: "mulugeta.k@grandhorizonhospital.com", code: "HMS-BILL-2026", role: "accountant", icon: Receipt, color: "hover:border-amber-500" },
];

const ROLE_ROUTES = {
  owner: '/owner',
  admin: '/owner',
  receptionist: '/reception',
  doctor: '/doctor',
  nurse: '/nurse',
  lab_technician: '/lab',
  pharmacist: '/pharmacy',
  accountant: '/billing',
};

export default function Login() {
  const { login, user, isAuthenticated, isLoadingAuth } = useAuth();
  const { hospital } = useHospitalBranding();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPortal = searchParams.get('portal') || 'auto';

  const showDevSwitcher = hospital?.dev_portal_switcher_enabled !== undefined
    ? Boolean(hospital.dev_portal_switcher_enabled)
    : import.meta.env.DEV;

  const [email, setEmail] = useState("");
  const [credential, setCredential] = useState("");
  const [targetPortal, setTargetPortal] = useState(initialPortal);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If already authenticated and not loading, navigate immediately to authorized portal
  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated && user?.role) {
      navigate(ROLE_ROUTES[user.role] || "/", { replace: true });
    }
  }, [isLoadingAuth, isAuthenticated, user, navigate]);

  const handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const portalParam = targetPortal !== "auto" ? targetPortal : undefined;
      const profile = await login(email, credential, portalParam);
      const destination = ROLE_ROUTES[profile.role] || "/";
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message || "Invalid hospital email or credentials");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (roleObj) => {
    setEmail(roleObj.email);
    setCredential(roleObj.code);
    setTargetPortal(roleObj.role);
    setError("");
    setLoading(true);
    try {
      const profile = await login(roleObj.email, roleObj.code, roleObj.role);
      const destination = ROLE_ROUTES[profile.role] || "/";
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    base44.auth.loginWithProvider("google", "/");
  };

  return (
    <AuthLayout
      icon={LogIn}
      title="Hospital Staff Login"
      subtitle="Sign in with your hospital email and staff code or password"
      footer={
        <>
          First time signing in?{" "}
          <Link to="/activate-account" className="text-primary font-semibold hover:underline inline-flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Activate your account
          </Link>
        </>
      }
    >
      <Button
        variant="outline"
        className="w-full h-12 text-sm font-medium mb-5"
        onClick={handleGoogle}
      >
        <GoogleIcon className="w-5 h-5 mr-2" />
        Continue with Google
      </Button>

      <div className="relative mb-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground tracking-wider">or staff credentials</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-destructive text-sm flex items-start gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-destructive mt-1.5 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="portal">Target Portal</Label>
          <div className="relative">
            <Select value={targetPortal} onValueChange={setTargetPortal}>
              <SelectTrigger id="portal" className="h-12">
                <SelectValue placeholder="Select portal" />
              </SelectTrigger>
              <SelectContent>
                {PORTALS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Hospital Email</Label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@grandhorizonhospital.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="credential">Password or Staff Code</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline font-medium">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="credential"
              type="password"
              autoComplete="current-password"
              placeholder="•••••••• or HMS-XXXX-XXXX"
              value={credential}
              onChange={(e) => setCredential(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>

        <Button type="submit" className="w-full h-12 font-medium" loading={loading}>
          {loading ? "Verifying..." : "Sign in to Portal"}
        </Button>
      </form>

      {/* Quick Portal Switcher (Controlled by Owner Setting) */}
      {showDevSwitcher && (
        <div className="mt-6 pt-5 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 text-center">
            Development Portal Switcher
          </p>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
            {QUICK_ROLES.map((r) => {
              const Icon = r.icon;
              return (
                <button
                  key={r.label}
                  type="button"
                  onClick={() => handleQuickLogin(r)}
                  disabled={loading}
                  title={`Sign in as ${r.label} (${r.role})`}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border border-border bg-card/60 hover:bg-accent transition-all text-xs text-foreground/80 hover:text-foreground ${r.color} disabled:opacity-50`}
                >
                  <Icon className="w-4 h-4 mb-1 text-primary" />
                  <span className="text-[10px] font-medium truncate w-full text-center">{r.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </AuthLayout>
  );
}