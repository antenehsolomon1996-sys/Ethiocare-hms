import { useQuery } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import StatCard from '@/components/common/StatCard';
import StatusBadge from '@/components/common/StatusBadge';
import { DollarSign, Clock, CheckCircle, CreditCard, Syringe, ChevronRight } from 'lucide-react';
import { startOfDay } from 'date-fns';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function BillingDashboard() {
  const { data: payments = [] } = useQuery({ queryKey: ['payments'], queryFn: () => ethioCareClient.entities.Payment.list('-created_date', 100), refetchInterval: 10000 });
  const { data: medOrders = [] } = useQuery({ queryKey: ['medicationOrders'], queryFn: () => ethioCareClient.entities.MedicationOrder.list('-created_date', 100), refetchInterval: 10000 });
  const pendingMedOrders = medOrders.filter(o => o.payment_status === 'pending_payment');

  const today = startOfDay(new Date());
  const todayPayments = payments.filter(p => new Date(p.created_date) >= today);
  const pending = payments.filter(p => p.status === 'pending');
  const todayPaid = todayPayments.filter(p => p.status === 'paid');
  const todayRevenue = todayPaid.reduce((s, p) => s + (p.amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Billing Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Payments & revenue overview</p>
        </div>
        <Link to="/billing/payments"><Button>View Payments</Button></Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Pending Payments" value={pending.length} icon={Clock} color="amber" />
        <StatCard title="Today's Collections" value={todayPaid.length} icon={CheckCircle} color="green" />
        <StatCard title="Today's Revenue" value={`${todayRevenue.toLocaleString()} ETB`} icon={DollarSign} color="blue" />
        <StatCard title="Medication Orders" value={pendingMedOrders.length} icon={Syringe} color="purple" />
      </div>

      {/* Medication Orders Alert */}
      {pendingMedOrders.length > 0 && (
        <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm text-amber-800 font-semibold flex items-center gap-2">
            <Syringe className="w-4 h-4" />
            {pendingMedOrders.length} medication order{pendingMedOrders.length > 1 ? 's' : ''} awaiting payment
          </p>
          <Link to="/billing/medication-orders"><Button size="sm">Process Orders</Button></Link>
        </div>
      )}

      {/* Pending Payments */}
      <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-sm font-bold">Pending Payments ({pending.length})</h3>
          <Link to="/billing/payments" className="text-xs text-primary font-medium hover:underline">View All</Link>
        </div>
        <div className="space-y-2">
          {pending.slice(0, 10).map(p => (
            <div key={p.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/40 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                  <CreditCard className="w-4 h-4 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{p.patient_name}</p>
                  <p className="text-xs text-muted-foreground capitalize truncate">{p.payment_type?.replace('_', ' ')} - {p.description}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-sm font-heading">{p.amount?.toLocaleString()} ETB</p>
                <StatusBadge status={p.status} />
              </div>
            </div>
          ))}
          {pending.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No pending payments</p>}
        </div>
      </div>
    </div>
  );
}