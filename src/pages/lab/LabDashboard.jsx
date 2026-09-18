import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import StatCard from '@/components/common/StatCard';
import StatusBadge from '@/components/common/StatusBadge';
import { FlaskConical, Clock, CheckCircle, Activity, ChevronRight } from 'lucide-react';
import { startOfDay } from 'date-fns';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function LabDashboard() {
  const { data: labOrders = [] } = useQuery({
    queryKey: ['labOrders'],
    queryFn: () => base44.entities.LabOrder.list('-created_date', 100),
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Laboratory Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Lab orders & test results</p>
        </div>
        <Link to="/lab/orders"><Button>View Orders</Button></Link>
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