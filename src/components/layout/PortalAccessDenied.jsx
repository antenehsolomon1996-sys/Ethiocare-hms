import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, LogOut, ArrowRight, UserCheck, Lock } from 'lucide-react';
import HealthcareBackground from '@/components/layout/HealthcareBackground';

const ROLE_NAMES = {
  owner: 'Hospital Owner / Executive',
  admin: 'Hospital Administrator',
  doctor: 'Doctor / Physician',
  nurse: 'Registered Nurse',
  lab_technician: 'Laboratory Technician',
  pharmacist: 'Pharmacist',
  accountant: 'Billing Officer / Cashier',
  receptionist: 'Receptionist / Front Desk',
};

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

const PORTAL_DISPLAY_NAMES = {
  owner: 'Admin & Owner Portal',
  admin: 'Admin & Owner Portal',
  reception: 'Reception Portal',
  receptionist: 'Reception Portal',
  doctor: 'Doctor Portal',
  nurse: 'Nurse Portal',
  lab: 'Laboratory Portal',
  lab_technician: 'Laboratory Portal',
  pharmacy: 'Pharmacy Portal',
  pharmacist: 'Pharmacy Portal',
  billing: 'Billing & Cashier Portal',
  accountant: 'Billing & Cashier Portal',
};

export default function PortalAccessDenied({ portalRole, onSwitchAccount }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const userRole = user?.role || 'staff';
  const myPortalRoute = ROLE_ROUTES[userRole] || '/';
  const myRoleTitle = ROLE_NAMES[userRole] || userRole;
  const targetPortalTitle = PORTAL_DISPLAY_NAMES[portalRole] || 'Requested Portal';

  const handleGoToMyPortal = () => {
    navigate(myPortalRoute, { replace: true });
  };

  const handleSignOut = async () => {
    if (onSwitchAccount) {
      onSwitchAccount();
    } else {
      await logout(false);
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      <HealthcareBackground />

      <Card className="max-w-md w-full border-destructive/30 shadow-2xl relative z-10 animate-in fade-in-50 zoom-in-95 duration-200">
        <CardHeader className="text-center pb-3">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-3 shadow-inner">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <CardTitle className="text-xl font-bold text-foreground">
            This account does not have access to this portal
          </CardTitle>
          <CardDescription className="text-sm">
            Access to the <strong>{targetPortalTitle}</strong> is restricted by hospital role permissions.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* User identity box */}
          <div className="bg-muted/60 rounded-xl p-4 border border-border text-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Logged-in Staff:</span>
              <span className="font-semibold text-foreground truncate max-w-[200px]">
                {user?.full_name || 'Hospital Staff'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Staff Email:</span>
              <span className="font-mono text-xs text-muted-foreground truncate max-w-[200px]">
                {user?.email || 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-border/50">
              <span className="text-xs text-muted-foreground">Assigned Role:</span>
              <Badge variant="secondary" className="font-medium text-xs">
                {myRoleTitle}
              </Badge>
            </div>
          </div>

          <div className="space-y-2.5">
            <Button
              className="w-full h-11 font-medium gap-2 text-sm shadow-sm"
              onClick={handleGoToMyPortal}
            >
              <ArrowRight className="w-4 h-4" />
              Go to My Authorized Portal ({PORTAL_DISPLAY_NAMES[userRole] || 'Dashboard'})
            </Button>

            <Button
              variant="outline"
              className="w-full h-11 font-medium gap-2 text-sm border-border hover:bg-destructive/5 hover:text-destructive"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4" />
              Sign Out & Switch Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
