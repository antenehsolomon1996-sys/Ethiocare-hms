import { useQuery } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import { useAuth } from '@/lib/AuthContext';
import StatCard from '@/components/common/StatCard';
import StatusBadge from '@/components/common/StatusBadge';
import { FlaskConical, Clock, CheckCircle, Activity, ChevronRight, Building2, User } from 'lucide-react';
import { startOfDay } from 'date-fns';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function LabDashboard() {
  const { user } = useAuth();
  const { data: labOrders = [] } = useQuery({
    queryKey: ['labOrders'],
    queryFn: () => ethioCareClient.entities.LabOrder.list('-created_date', 100),
    refetchInterval: 10000
  });

  const paidOrders = labOrders.filter(o => o.payment_status === 'paid');
  const today = startOfDay(new Date());
  const todayOrders = paidOrders.filter(o => new Date(o.created_date) >= today);
  const pending = paidOrders.filter(o => o.test_status === 'pending');
  const inProgress = paidOrders.filter(o => o.test_status === 'in_progress');
  const completed = paidOrders.filter(o => o.test_status === 'completed');

  return (
    <div className="space-y-6">
      {/* Personalized Header */}
      <div className="bg-card rounded-2xl border border-border p-5 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-13 h-13 rounded-2xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
            <FlaskConical className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-heading text-2xl font-bold tracking-tight">
                {user?.full_name ? `Welcome, ${user.full_name}` : 'Laboratory Workspace'}
              </h1>
              <Badge variant="outline" className="text-xs font-mono bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30">
                Staff ID: {user?.id?.slice(0, 8).toUpperCase() || 'LAB-01'}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
              <span className="font-semibold text-foreground">Diagnostic Testing & Analysis</span>
              <span className="text-muted-foreground/50">•</span>
              <span className="flex items-center gap-1 font-medium">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                {user?.assigned_room_number ? (
                  <strong className="text-primary font-mono">Assigned Lab: Room {user.assigned_room_number}</strong>
                ) : (
                  <span>Central Clinical Lab</span>
                )}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/lab/orders"><Button>View Orders</Button></Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Pending Tests" value={pending.length} icon={Clock} color="amber" />
        <StatCard title="In Progress" value={inProgress.length} icon={Activity} color="blue" />
        <StatCard title="Completed Today" value={todayOrders.filter(o => o.test_status === 'completed').length} icon={CheckCircle} color="green" />
        <StatCard title="Total Completed" value={completed.length} icon={FlaskConical} color="purple" />
      </div>

      {/* Pending Lab Orders */}
      <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-sm font-bold">Pending Lab Orders</h3>
          <span className="text-xs text-muted-foreground font-medium">Paid Only</span>
        </div>
        <div className="space-y-2">
          {pending.map(o => (
            <Link key={o.id} to="/lab/orders" className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/40 transition-colors group">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{o.patient_name}</p>
                <p className="text-xs text-muted-foreground truncate">{o.test_type} {o.test_name ? `- ${o.test_name}` : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={o.test_status} />
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          ))}
          {pending.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No pending orders</p>}
        </div>
      </div>
    </div>
  );
}