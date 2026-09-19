import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import { useAuth } from '@/lib/AuthContext';
import StatCard from '@/components/common/StatCard';
import StatusBadge from '@/components/common/StatusBadge';
import { Activity, Clock, CheckCircle, Syringe, ShoppingCart, Pill, ChevronRight, AlertTriangle, Building2, User } from 'lucide-react';
import { startOfDay } from 'date-fns';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const URGENCY_STYLES = {
  stat: 'bg-red-50 text-red-700 border-red-200',
  urgent: 'bg-amber-50 text-amber-700 border-amber-200',
  routine: 'bg-blue-50 text-blue-700 border-blue-200'
};

export default function NurseDashboard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: tasks = [] } = useQuery({
    queryKey: ['nurseTasks'],
    queryFn: () => ethioCareClient.entities.NurseTask.list('-created_date', 100),
    refetchInterval: 10000
  });
  const { data: medOrders = [] } = useQuery({
    queryKey: ['medicationOrders'],
    queryFn: () => ethioCareClient.entities.MedicationOrder.list('-created_date', 100),
    refetchInterval: 10000
  });

  const pendingMedOrders = medOrders.filter(o =>
    (o.payment_status === 'paid' || o.payment_status === 'waived') &&
    o.administration_status !== 'completed' &&
    o.administration_status !== 'refused'
  );
  const statOrders = pendingMedOrders.filter(o => o.urgency === 'stat');

  const today = startOfDay(new Date());
  const todayTasks = tasks.filter(t => new Date(t.created_date) >= today);
  const pending = tasks.filter(t => t.status === 'pending');
  const inProgress = tasks.filter(t => t.status === 'in_progress');

  const handleStartMed = async (order) => {
    try {
      await ethioCareClient.entities.MedicationOrder.update(order.id, { administration_status: 'in_progress' });
      const linked = await ethioCareClient.entities.Payment.filter({ reference_id: order.id });
      if (linked.length > 0) {
        await ethioCareClient.entities.Payment.update(linked[0].id, { order_status: 'administered' });
      }
      queryClient.invalidateQueries({ queryKey: ['medicationOrders'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Administration started');
    } catch {
      toast.error('Failed to start administration');
    }
  };

  return (
    <div className="space-y-6">
      {/* Personalized Header */}
      <div className="bg-card rounded-2xl border border-border p-5 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-13 h-13 rounded-2xl bg-pink-500/15 border border-pink-500/25 flex items-center justify-center text-pink-600 dark:text-pink-400 shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-heading text-2xl font-bold tracking-tight">
                {user?.full_name ? `Welcome, ${user.full_name}` : 'Nursing Workspace'}
              </h1>
              <Badge variant="outline" className="text-xs font-mono bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/30">
                Staff ID: {user?.id?.slice(0, 8).toUpperCase() || 'NURS-01'}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
              <span className="font-semibold text-foreground">Inpatient & Ward Nursing</span>
              <span className="text-muted-foreground/50">•</span>
              <span className="flex items-center gap-1 font-medium">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                {user?.assigned_room_number ? (
                  <strong className="text-primary font-mono">Assigned Station: Room {user.assigned_room_number}</strong>
                ) : (
                  <span>Central Nursing Station</span>
                )}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/nurse/unified-tasks"><Button>My Tasks</Button></Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Pending Tasks" value={pending.length} icon={Clock} color="amber" />
        <StatCard title="In Progress" value={inProgress.length} icon={Activity} color="blue" />
        <StatCard title="Completed Today" value={todayTasks.filter(t => t.status === 'completed').length} icon={CheckCircle} color="green" />
        <StatCard title="Medication Orders" value={pendingMedOrders.length} icon={ShoppingCart} color="purple" />
      </div>

      {/* STAT Alert */}
      {statOrders.length > 0 && (
        <div className="bg-red-50 border border-red-200/60 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm text-red-800 font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {statOrders.length} STAT medication order{statOrders.length > 1 ? 's' : ''} need immediate attention
          </p>
          <Link to="/nurse/medication-orders"><Button size="sm" variant="destructive">View Now</Button></Link>
        </div>
      )}

      {/* Medication Orders Section */}
      {pendingMedOrders.length > 0 && (
        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-sm font-bold flex items-center gap-2">
              <Syringe className="w-4 h-4 text-primary" />
              Medication Orders ({pendingMedOrders.length})
            </h3>
            <Link to="/nurse/medication-orders">
              <Button size="sm" variant="ghost">View All <ChevronRight className="w-3 h-3 ml-1" /></Button>
            </Link>
          </div>
          <div className="space-y-2">
            {[...pendingMedOrders].sort((a, b) => {
              const order = { stat: 0, urgent: 1, routine: 2 };
              return (order[a.urgency] || 2) - (order[b.urgency] || 2);
            }).slice(0, 5).map(o => (
              <div key={o.id} className={`flex items-center gap-3 border rounded-lg p-3 transition-all hover:shadow-soft ${o.urgency === 'stat' ? 'border-red-200 bg-red-50/30' : 'border-border/60'}`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${o.urgency === 'stat' ? 'bg-red-100' : 'bg-primary/10'}`}>
                  <Pill className={`w-4 h-4 ${o.urgency === 'stat' ? 'text-red-600' : 'text-primary'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm truncate">{o.patient_name}</p>
                    <Badge variant="outline" className={`text-[10px] ${URGENCY_STYLES[o.urgency]}`}>{o.urgency}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{o.item_name}{o.dosage ? ` — ${o.dosage}` : ''}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {o.administration_status === 'pending' && (
                    <Button size="sm" onClick={() => handleStartMed(o)}>Start</Button>
                  )}
                  {o.administration_status === 'in_progress' && (
                    <Link to="/nurse/medication-orders"><Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">Complete</Button></Link>
                  )}
                  <Link to="/nurse/medication-orders"><Button size="sm" variant="ghost">Details</Button></Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Tasks */}
      <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
        <h3 className="font-heading text-sm font-bold mb-4">Pending Tasks</h3>
        <div className="space-y-2">
          {pending.map(t => (
            <Link key={t.id} to="/nurse/tasks" className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/40 transition-colors">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{t.patient_name}</p>
                <p className="text-xs text-muted-foreground capitalize truncate">{t.task_type?.replace('_', ' ')} - {t.description}</p>
              </div>
              <StatusBadge status={t.status} />
            </Link>
          ))}
          {pending.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No pending tasks</p>}
        </div>
      </div>
    </div>
  );
}