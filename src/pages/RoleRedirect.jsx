import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertCircle, RefreshCw, LogOut } from 'lucide-react';
import HealthcareBackground from '@/components/layout/HealthcareBackground';

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

const PORTAL_LINKS = [
  { label: 'Admin / Owner', path: '/admin' },
  { label: 'Reception', path: '/reception' },
  { label: 'Doctor', path: '/doctor' },
  { label: 'Nurse', path: '/nurse' },
  { label: 'Laboratory', path: '/lab' },
  { label: 'Pharmacy', path: '/pharmacy' },
  { label: 'Billing / Cashier', path: '/billing' },
];

export default function RoleRedirect() {
  const { user, isLoadingAuth, authChecked, checkUserAuth, logout } = useAuth();
  const navigate = useNavigate();
  const [timedOut, setTimedOut] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // 1. Immediate reactive redirection
  useEffect(() => {
    if (user?.role) {
      const normalizedRole = user.role.toLowerCase().trim();
      const route = ROLE_ROUTES[normalizedRole];
      if (route) {
        navigate(route, { replace: true });
        return;
      }
    }

    // Unauthenticated user visited root / -> send directly to login
    if (authChecked && !isLoadingAuth && !user) {
      navigate('/login', { replace: true });
      return;
    }
  }, [user, authChecked, isLoadingAuth, navigate]);

  // 2. Safety Timeout: If redirect has not occurred within 5 seconds, attempt recovery
  useEffect(() => {
    const timer = setTimeout(() => {
      // Check cached session in localStorage before displaying error UI
      try {
        const stored = localStorage.getItem('ethiocare_auth_session');
        if (stored) {
          const profile = JSON.parse(stored);
          if (profile?.role && ROLE_ROUTES[profile.role.toLowerCase().trim()]) {
            navigate(ROLE_ROUTES[profile.role.toLowerCase().trim()], { replace: true });
            return;
          }
        }
      } catch {
        // Continue to timeout UI
      }

      setTimedOut(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigate]);

  const handleRetry = async () => {
    setRetrying(true);
    setTimedOut(false);
    try {
      await checkUserAuth();
    } finally {
      setRetrying(false);
    }
  };

  const handleSignOut = async () => {
    await logout(true);
  };

  // If redirect timed out or user role is unknown, show graceful recovery UI
  if (timedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background relative">
        <HealthcareBackground />
        <Card className="w-full max-w-md relative z-10 border-border/60 shadow-xl bg-card/95 backdrop-blur-md">
          <CardHeader className="text-center pb-2">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <CardTitle className="text-xl font-bold">Portal Redirection Notice</CardTitle>
            <CardDescription className="text-sm text-muted-foreground mt-1">
              We were unable to automatically resolve your destination portal. You can retry verification or select your authorized portal directly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {user ? (
              <div className="p-3 rounded-lg bg-muted/50 border border-border/50 text-xs text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <span className="font-medium text-foreground">Signed in as:</span>
                  <span>{user.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-foreground">Detected role:</span>
                  <span className="capitalize">{user.role || 'Unassigned'}</span>
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <Button
                onClick={handleRetry}
                disabled={retrying}
                className="w-full h-11 font-medium gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
                {retrying ? 'Verifying Session...' : 'Retry Portal Redirection'}
              </Button>

              <Button
                variant="outline"
                onClick={handleSignOut}
                className="w-full h-11 font-medium gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="w-4 h-4" />
                Sign Out / Return to Login
              </Button>
            </div>

            <div className="pt-2 border-t border-border/50">
              <p className="text-xs text-muted-foreground font-medium mb-2 text-center">
                Direct Portal Links:
              </p>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {PORTAL_LINKS.map((portal) => (
                  <Link
                    key={portal.path}
                    to={portal.path}
                    className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground text-center border border-border/40 transition-colors font-medium text-muted-foreground"
                  >
                    {portal.label}
                  </Link>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Normal loading state during rapid verification (< 300ms)
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-muted-foreground font-medium">Redirecting to your portal...</p>
      </div>
    </div>
  );
}