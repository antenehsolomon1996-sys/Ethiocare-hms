import React, { useState } from "react";
import { Link } from "react-router-dom";
import { authService } from "@/services/auth.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Mail, Lock, KeyRound, Loader2, CheckCircle2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { toast } from "sonner";

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

export default function ActivateAccount() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Step 1: Verify email + activation code
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Validate inputs
      const cleanEmail = email.trim().toLowerCase();
      const cleanCode = activationCode.trim().toUpperCase();

      if (!cleanEmail || !cleanCode) {
        setError("Please enter both your hospital email and activation code.");
        setLoading(false);
        return;
      }

      // Proceed to password setup
      setStep(2);
    } catch (err) {
      setError(err.message || "Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Set password & complete activation (NO OTP REQUIRED)
  const handleCreatePassword = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    setLoading(true);
    try {
      const profile = await authService.activateAccount(email, activationCode, password);
      toast.success("Account activated successfully!", {
        description: `Welcome to the ${profile.role.replace('_', ' ')} portal.`,
      });
      window.location.href = ROLE_ROUTES[profile.role] || "/";
    } catch (err) {
      setError(err.message || "Account activation failed");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Set Password
  if (step === 2) {
    return (
      <AuthLayout
        icon={Lock}
        title="Set your password"
        subtitle={`Activating account for ${email}`}
        footer={
          <button
            onClick={() => setStep(1)}
            className="text-primary font-medium hover:underline text-sm inline-flex items-center gap-1"
          >
            ← Change email or activation code
          </button>
        }
      >
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-destructive text-sm flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive mt-1.5 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleCreatePassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                autoFocus
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 h-12"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm Password</Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10 h-12"
                required
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Password must be at least 8 characters. No email inbox access or OTP required.
          </p>

          <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Activating Account...
              </>
            ) : (
              "Activate Account & Enter Portal"
            )}
          </Button>
        </form>
      </AuthLayout>
    );
  }

  // Step 1: Verify Activation Code
  return (
    <AuthLayout
      icon={ShieldCheck}
      title="Staff Account Activation"
      subtitle="Enter your hospital email and staff activation code"
      footer={
        <Link to="/login" className="text-primary font-medium hover:underline text-sm">
          Already activated? Log in
        </Link>
      }
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-destructive text-sm flex items-start gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-destructive mt-1.5 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleVerifyCode} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Hospital Email</Label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
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
          <Label htmlFor="code">Staff Activation Code</Label>
          <div className="relative">
            <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="code"
              type="text"
              placeholder="HMS-XXXX-XXXX"
              value={activationCode}
              onChange={(e) => setActivationCode(e.target.value)}
              className="pl-10 h-12 uppercase tracking-wider font-mono"
              required
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Use the activation code provided by hospital administration (e.g. HMS-DOC1-2026).
        </p>

        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Verifying...
            </>
          ) : (
            "Continue to Password Setup"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}