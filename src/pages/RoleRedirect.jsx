import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';

const roleRoutes = {
  owner: '/owner',
  admin: '/owner',
  receptionist: '/reception',
  doctor: '/doctor',
  nurse: '/nurse',
  lab_technician: '/lab',
  pharmacist: '/pharmacy',
  accountant: '/billing',
};

export default function RoleRedirect() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      const role = user.role;
      const route = roleRoutes[role];
      if (route) {
        navigate(route, { replace: true });
      } else {
        // No valid role assigned — send back to login
        base44.auth.redirectToLogin();
      }
    }
  }, [user, navigate]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">Redirecting to your portal...</p>
      </div>
    </div>
  );
}