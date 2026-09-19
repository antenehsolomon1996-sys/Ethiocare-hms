import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { ethioCareClient } from '@/api/ethioCareClient';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogIn, Mail, Lock, ShieldCheck, UserCheck, Stethoscope, UserPlus, Activity, FlaskConical, Pill, Receipt, Building2, User } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { useHospitalBranding } from "@/hooks/useHospitalBranding";

const STAFF_TYPES = [
  { value: "doctor", label: "Doctor", icon: Stethoscope, role: "doctor" },
  { value: "nurse", label: "Nurse", icon: Activity, role: "nurse" },
  { value: "lab_technician", label: "Lab", icon: FlaskConical, role: "lab_technician" },
  { value: "receptionist", label: "Reception", icon: UserPlus, role: "receptionist" },
  { value: "pharmacist", label: "Pharmacy", icon: Pill, role: "pharmacist" },
  { value: "accountant", label: "Billing", icon: Receipt, role: "accountant" },
  { value: "owner", label: "Owner/Admin", icon: UserCheck, role: "owner" },
];

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

export default function Login() {
  const { login, user, isAuthenticated, isLoadingAuth } = useAuth();
  const { hospital } = useHospitalBranding();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPortalParam = searchParams.get('portal');

  const [staffType, setStaffType] = useState(() => {
    if (initialPortalParam && STAFF_TYPES.some(t => t.value === initialPortalParam || t.role === initialPortalParam)) {
      return initialPortalParam;
    }
    return 'doctor';
  });

  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [email, setEmail] = useState("");
  const [credential, setCredential] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Load all provisioned staff from database
  const { data: allStaff = [] } = useQuery({
    queryKey: ['staff_login_list'],
    queryFn: () => ethioCareClient.entities.Staff.list('-created_date', 200),
    refetchInterval: 15000
  });

  // Filter provisioned members based on selected staff type
  const activeStaffForType = useMemo(() => {
    return allStaff.filter(s => {
      if (staffType === 'owner') return s.role === 'owner' || s.role === 'admin';
      return s.role === staffType;
    });
  }, [allStaff, staffType]);

  // When staffType changes, pick the first staff member if available or clear
  useEffect(() => {
    if (activeStaffForType.length > 0) {
      const first = activeStaffForType[0];
      setSelectedStaffId(String(first.id));
      setEmail(first.email || "");
      setCredential("");
      setError("");
    } else {
      setSelectedStaffId("");
      setEmail("");
      setCredential("");
    }
  }, [staffType, activeStaffForType]);

  const handleSelectStaffMember = (staffId) => {
    setSelectedStaffId(staffId);
    const chosen = activeStaffForType.find(s => String(s.id) === String(staffId));
    if (chosen) {
      setEmail(chosen.email || "");
      setCredential("");
      setError("");
    }
  };

  const handleEmailChange = (val) => {
    setEmail(val);
    const matched = allStaff.find(s => s.email?.toLowerCase() === val.trim().toLowerCase());
    if (matched) {
      const matchedRoleType = matched.role === 'admin' ? 'owner' : matched.role;
      if (matchedRoleType !== staffType && STAFF_TYPES.some(t => t.value === matchedRoleType)) {
        setStaffType(matchedRoleType);
      }
      setSelectedStaffId(String(matched.id));
    }
  };

  // If already authenticated and not loading, navigate immediately to authorized portal
  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated && user?.role) {
      const normalizedRole = user.role.toLowerCase().trim();
      const destination = ROLE_ROUTES[normalizedRole] || '/admin';
      navigate(destination, { replace: true });
    }
  }, [isLoadingAuth, isAuthenticated, user, navigate]);

  const handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const selectedMember = allStaff.find(s => s.email?.toLowerCase() === cleanEmail);
      const targetRole = selectedMember ? (selectedMember.role === 'admin' ? 'owner' : selectedMember.role) : staffType;

      const profile = await login(cleanEmail, credential, targetRole);
      const normalizedRole = profile?.role ? profile.role.toLowerCase().trim() : '';
      const destination = ROLE_ROUTES[normalizedRole] || "/admin";
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message || "Invalid hospital email or credentials");
    } finally {
      setLoading(false);
    }
  };

  const selectedMemberData = allStaff.find(s => s.email?.toLowerCase() === email.trim().toLowerCase()) ||
    activeStaffForType.find(s => String(s.id) === String(selectedStaffId));

  return (
    <AuthLayout
      icon={LogIn}
      title="Individual Staff Workspace Login"
      subtitle="Sign in to your dedicated hospital workspace, assigned room, and personal queue"
      footer={
        <>
          First time signing in?{" "}
          <Link to="/activate-account" className="text-primary font-semibold hover:underline inline-flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Activate your account
          </Link>
        </>
      }
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-destructive text-sm flex items-start gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-destructive mt-1.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Staff-Type Selector Tabs */}
      <div className="space-y-3 mb-5">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Select Staff Role</Label>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
          {STAFF_TYPES.map((type) => {
            const Icon = type.icon;
            const isSelected = staffType === type.value;
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => setStaffType(type.value)}
                className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-medium transition-all ${
                  isSelected
                    ? "border-primary bg-primary/10 text-primary ring-1 ring-primary shadow-xs font-bold"
                    : "border-border bg-card/60 hover:bg-accent text-foreground/80 hover:text-foreground"
                }`}
              >
                <Icon className={`w-4 h-4 mb-1 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-[11px] truncate w-full text-center">{type.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Provisioned Individual Staff List Selector */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="staff-member">Select Provisioned {STAFF_TYPES.find(t => t.value === staffType)?.label.replace(' ▼', '')}</Label>
            <span className="text-[11px] text-muted-foreground font-mono">{activeStaffForType.length} available</span>
          </div>
          <Select value={selectedStaffId} onValueChange={handleSelectStaffMember}>
            <SelectTrigger id="staff-member" className="h-12 bg-background">
              <SelectValue placeholder="Choose individual staff account..." />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {activeStaffForType.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  <div className="flex items-center justify-between gap-3 w-full py-0.5">
                    <div className="flex flex-col text-left">
                      <span className="font-semibold text-xs text-foreground">
                        {s.full_name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {s.specialization || s.department || s.role}
                      </span>
                    </div>
                    {s.assigned_room_number && (
                      <span className="text-[10px] bg-primary/10 text-primary font-mono px-2 py-0.5 rounded-full shrink-0 border border-primary/20">
                        Room {s.assigned_room_number}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
              {activeStaffForType.length === 0 && (
                <SelectItem value="__none" disabled>
                  No staff provisioned for this role yet
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Selected Staff Workspace Preview Banner */}
        {selectedMemberData && (
          <div className="bg-muted/40 border border-border/80 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-foreground truncate">{selectedMemberData.full_name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{selectedMemberData.email}</p>
              </div>
            </div>
            {selectedMemberData.assigned_room_number ? (
              <span className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold px-2 py-1 rounded-md text-[11px] shrink-0 border border-emerald-500/20">
                Room {selectedMemberData.assigned_room_number}
              </span>
            ) : (
              <span className="text-muted-foreground italic text-[11px] shrink-0">Float Room</span>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email">Hospital Email</Label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="name@grandhorizonhospital.com"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              className="pl-10 h-11"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="credential">Staff Code or Password</Label>
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
              className="pl-10 h-11 font-mono text-sm"
              required
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Enter your personal activation code (e.g. HMS-DOC1-2026) or private account password.
          </p>
        </div>

        <Button type="submit" className="w-full h-11 font-medium text-sm" loading={loading}>
          {loading ? "Verifying..." : `Sign in to ${selectedMemberData?.full_name || 'Individual Portal'}`}
        </Button>
      </form>
    </AuthLayout>
  );
}