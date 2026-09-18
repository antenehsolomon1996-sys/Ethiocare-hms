import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import StatusBadge from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { logAudit } from '@/lib/auditLogger';
import { Pill, Syringe, Package, Clock, CheckCircle, Search, AlertTriangle, Activity, XCircle } from 'lucide-react';

const ORDER_TYPE_ICONS = {
  medicine: Pill,
  injection: Syringe,
  iv_treatment: Syringe,
  medical_supply: Package,
  other: Package
};

const URGENCY_STYLES = {
  stat: 'bg-red-100 text-red-700 border-red-200',
  urgent: 'bg-amber-100 text-amber-700 border-amber-200',
  routine: 'bg-slate-100 text-slate-600 border-slate-200'
};

export default function MedicationAdministration() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selected, setSelected] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');

  // Only fetch orders that are PAID or WAIVED — never pending_payment
  const { data: allOrders = [], isLoading } = useQuery({
    queryKey: ['medicationOrders'],
    queryFn: () => base44.entities.MedicationOrder.list('-created_date', 300),
    refetchInterval: 8000
  });

  // Nurse only sees paid/waived orders — cancelled and awaiting_payment are hidden
  const visibleOrders = allOrders.filter(o =>
    (o.payment_status === 'paid' || o.payment_status === 'waived') &&
    o.payment_status !== 'cancelled'
  );

  // Realtime subscription — immediately reflects billing approvals and status changes
  useEffect(() => {
    const unsubscribe = base44.entities.MedicationOrder.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['medicationOrders'] });
    });
    return unsubscribe;
  }, [queryClient]);

  const filtered = visibleOrders.filter(o => {
    const matchSearch = !search || o.patient_name?.toLowerCase().includes(search.toLowerCase()) || o.item_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' ||
      (statusFilter === 'pending' && (o.administration_status === 'pending' || o.administration_status === 'in_progress')) ||
      (statusFilter === 'completed' && o.administration_status === 'completed') ||
      (statusFilter === 'in_progress' && o.administration_status === 'in_progress');
    return matchSearch && matchStatus;
  });

  const stats = {
    pending: visibleOrders.filter(o => o.administration_status === 'pending').length,
    inProgress: visibleOrders.filter(o => o.administration_status === 'in_progress').length,
    completedToday: visibleOrders.filter(o =>
      o.administration_status === 'completed' &&
      o.administered_date === format(new Date(), 'yyyy-MM-dd')
    ).length,
    stat: visibleOrders.filter(o => o.urgency === 'stat' && o.administration_status !== 'completed').length
  };

  const handleStart = async (order) => {
    queryClient.setQueryData(['medicationOrders'], (old) => old.map(o => o.id === order.id ? { ...o, administration_status: 'in_progress' } : o));
    try {
      await base44.entities.MedicationOrder.update(order.id, { administration_status: 'in_progress' });
      // Sync linked payment record
      const linked = await base44.entities.Payment.filter({ reference_id: order.id });
      if (linked.length > 0) {
        await base44.entities.Payment.update(linked[0].id, { order_status: 'administered' });
      }
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      logAudit({
        userName: user?.full_name, userRole: 'nurse', action: 'update',
        module: 'MedicationOrder', description: `Started administration of ${order.item_name} for ${order.patient_name}`,
        recordId: order.id, recordName: order.patient_name
      });
      toast.success('Administration started');
    } catch {
      queryClient.invalidateQueries({ queryKey: ['medicationOrders'] });
      toast.error('Failed to start administration');
    }
    queryClient.invalidateQueries({ queryKey: ['medicationOrders'] });
  };

  const [isCompleting, setIsCompleting] = useState(false);

  const handleComplete = async () => {
    if (!selected) return;
    setIsCompleting(true);
    try {
      await base44.entities.MedicationOrder.update(selected.id, {
        administration_status: 'completed',
        administered_by: user?.full_name || 'Staff Nurse',
        administered_date: format(new Date(), 'yyyy-MM-dd'),
        administration_notes: adminNotes?.trim() || null
      });
      // Sync linked payment record — completed medication stays in history
      const linked = await base44.entities.Payment.filter({ reference_id: selected.id });
      if (linked.length > 0) {
        await base44.entities.Payment.update(linked[0].id, { order_status: 'completed' });
      }
      queryClient.invalidateQueries({ queryKey: ['medicationOrders'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      logAudit({
        userName: user?.full_name, userRole: 'nurse', action: 'update',
        module: 'MedicationOrder', description: `Completed administration of ${selected.item_name} for ${selected.patient_name}`,
        recordId: selected.id, recordName: selected.patient_name
      });
      toast.success('Administration marked as complete');
      setSelected(null);
      setAdminNotes('');
    } catch (err) {
      console.error('[MedicationAdministration] Error completing administration:', err);
      toast.error(err.message || 'Failed to complete administration');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleRefuse = async (order) => {
    try {
      await base44.entities.MedicationOrder.update(order.id, {
        administration_status: 'refused',
        administered_by: user?.full_name || 'Staff Nurse',
        administration_notes: 'Patient refused'
      });
      queryClient.invalidateQueries({ queryKey: ['medicationOrders'] });
      toast.info('Order marked as refused');
    } catch (err) {
      console.error('[MedicationAdministration] Error marking refused:', err);
      toast.error(err.message || 'Failed to update order status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Medication Administration</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Paid orders ready for administration</p>
        </div>
        {stats.stat > 0 && (
          <Badge className="bg-red-100 text-red-700 border border-red-200 text-sm px-3 py-1.5 animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
            {stats.stat} STAT order{stats.stat > 1 ? 's' : ''}!
          </Badge>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Pending', value: stats.pending, color: 'bg-amber-50 border-amber-200 text-amber-700', icon: Clock },
          { label: 'In Progress', value: stats.inProgress, color: 'bg-blue-50 border-blue-200 text-blue-700', icon: Activity },
          { label: 'Completed Today', value: stats.completedToday, color: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: CheckCircle },
          { label: 'STAT Orders', value: stats.stat, color: 'bg-red-50 border-red-200 text-red-700', icon: AlertTriangle }
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`rounded-xl border p-4 flex items-center gap-3 ${s.color}`}>
              <Icon className="w-6 h-6 opacity-70" />
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs font-medium opacity-80">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search patient or item..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Active</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2 text-sm text-blue-800">
        <CheckCircle className="w-4 h-4 shrink-0" />
        Only orders with confirmed payment are shown here. Unpaid orders are not visible.
      </div>

      {/* Orders */}
      <div className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>}
        {!isLoading && filtered.length === 0 && (
          <div className="bg-card rounded-xl border p-10 text-center text-muted-foreground">
            <Syringe className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No orders to administer</p>
          </div>
        )}
        {/* Sort STAT first */}
        {[...filtered].sort((a, b) => {
          const urgencyOrder = { stat: 0, urgent: 1, routine: 2 };
          return (urgencyOrder[a.urgency] || 2) - (urgencyOrder[b.urgency] || 2);
        }).map(order => {
          const Icon = ORDER_TYPE_ICONS[order.order_type] || Pill;
          const isInProgress = order.administration_status === 'in_progress';
          const isCompleted = order.administration_status === 'completed';
          return (
            <div
              key={order.id}
              className={`bg-card border rounded-xl p-4 transition-all hover:shadow-md ${order.urgency === 'stat' ? 'border-red-200 bg-red-50/30' : ''}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${order.urgency === 'stat' ? 'bg-red-100' : 'bg-primary/10'}`}>
                    <Icon className={`w-5 h-5 ${order.urgency === 'stat' ? 'text-red-600' : 'text-primary'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{order.item_name}</p>
                      <Badge variant="outline" className={`text-xs ${URGENCY_STYLES[order.urgency]}`}>
                        {order.urgency?.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="text-xs capitalize">
                        {order.order_type?.replace('_', ' ')}
                      </Badge>
                      {order.payment_status === 'waived' && (
                        <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 border-purple-200">Fee Waived</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      <strong>{order.patient_name}</strong>
                      {order.doctor_name && ` · Dr. ${order.doctor_name}`}
                    </p>
                    {(order.dosage || order.frequency) && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {[order.dosage, order.frequency, order.duration].filter(Boolean).join(' · ')}
                        {order.quantity > 1 && ` · Qty: ${order.quantity}`}
                      </p>
                    )}
                    {order.instructions && (
                      <p className="text-xs text-blue-600 mt-1 font-medium italic">{order.instructions}</p>
                    )}
                    {isCompleted && order.administered_by && (
                      <p className="text-xs text-emerald-600 mt-1">
                        ✓ Administered by {order.administered_by} on {order.administered_date}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:shrink-0 flex-wrap">
                  {!isCompleted && order.administration_status !== 'refused' && (
                    <>
                      {!isInProgress && (
                        <Button size="sm" onClick={() => handleStart(order)}>
                          <Activity className="w-3 h-3 mr-1" />Start
                        </Button>
                      )}
                      {isInProgress && (
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setSelected(order); setAdminNotes(order.administration_notes || ''); }}>
                          <CheckCircle className="w-3 h-3 mr-1" />Mark Complete
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => handleRefuse(order)}>
                        <XCircle className="w-3 h-3 mr-1" />Refuse
                      </Button>
                    </>
                  )}
                  {isCompleted && <Badge className="bg-emerald-100 text-emerald-700">Done</Badge>}
                  {order.administration_status === 'refused' && <Badge className="bg-red-100 text-red-700">Refused</Badge>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Complete Dialog */}
      <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Complete Administration</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4 pt-2">
              <div className="bg-muted/50 rounded-lg p-4 space-y-1">
                <p className="text-sm font-semibold">{selected.item_name}</p>
                <p className="text-sm text-muted-foreground">Patient: {selected.patient_name}</p>
                {selected.instructions && (
                  <p className="text-sm text-blue-600 italic">{selected.instructions}</p>
                )}
              </div>
              <div>
                <Label>Administration Notes (optional)</Label>
                <Textarea
                  value={adminNotes}
                  onChange={e => setAdminNotes(e.target.value)}
                  rows={3}
                  placeholder="Record any observations, patient response, time administered..."
                />
              </div>
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleComplete} disabled={isCompleting}>
                <CheckCircle className="w-4 h-4 mr-2" />{isCompleting ? 'Completing Administration...' : 'Confirm Administration Complete'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}