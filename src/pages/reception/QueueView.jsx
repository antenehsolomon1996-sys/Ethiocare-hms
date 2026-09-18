import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import StatusBadge from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { RefreshCw, Users, Syringe, CreditCard, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const STATUSES = [
  { value: 'waiting', label: 'Waiting' },
  { value: 'with_doctor', label: 'With Doctor' },
  { value: 'lab_pending', label: 'Lab Pending' },
  { value: 'lab_paid', label: 'Lab Paid' },
  { value: 'lab_processing', label: 'Lab Processing' },
  { value: 'lab_complete', label: 'Lab Complete' },
  { value: 'pharmacy', label: 'At Pharmacy' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function QueueView() {
  const queryClient = useQueryClient();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const { data: visits = [], isLoading } = useQuery({ 
    queryKey: ['visits'], 
    queryFn: () => base44.entities.Visit.list('-created_date', 200),
    refetchInterval: 15000
  });
  const { data: nurseTasks = [] } = useQuery({
    queryKey: ['nurseTasks'],
    queryFn: () => base44.entities.NurseTask.list('-created_date', 200),
    refetchInterval: 15000
  });

  const todayVisits = visits
    .filter(v => v.visit_date === todayStr)
    .sort((a, b) => (a.queue_number || 0) - (b.queue_number || 0));

  const statusMutation = useMutation({
    mutationFn: ({ visit, newStatus }) => base44.entities.Visit.update(visit.id, { status: newStatus }),
    onMutate: async ({ visit, newStatus }) => {
      await queryClient.cancelQueries({ queryKey: ['visits'] });
      const previousVisits = queryClient.getQueryData(['visits']);
      queryClient.setQueryData(['visits'], (old) => old.map(v => v.id === visit.id ? { ...v, status: newStatus } : v));
      return { previousVisits };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousVisits) queryClient.setQueryData(['visits'], context.previousVisits);
      toast.error('Failed to update status');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
    },
  });

  const handleStatusChange = (visit, newStatus) => {
    statusMutation.mutate({ visit, newStatus });
    if (!statusMutation.isError) {
      toast.success(`Status updated to: ${newStatus.replace(/_/g, ' ')}`);
    }
  };

  const activeVisits = todayVisits.filter(v => v.status !== 'cancelled');
  const cancelledVisits = todayVisits.filter(v => v.status === 'cancelled');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Patient Queue</h1>
          <p className="text-sm text-muted-foreground">{format(new Date(), 'EEEE, MMMM d, yyyy')} • {activeVisits.length} active</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['visits'] })}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Loading queue...</div>
      ) : todayVisits.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No patients in queue today</p>
          <p className="text-sm">Register a patient and send them to the doctor queue</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeVisits.map(v => (
            <div key={v.id} className="bg-card rounded-xl border border-border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-lg font-bold text-primary">#{v.queue_number}</span>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{v.patient_name}</p>
                  <p className="text-xs text-muted-foreground">{v.assigned_doctor ? `Dr. ${v.assigned_doctor}` : 'No doctor assigned'}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {v.registration_fee_paid ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded px-2 py-0.5">
                        <CheckCircle2 className="w-3 h-3" /> Registration: PAID
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded px-2 py-0.5">
                        <AlertCircle className="w-3 h-3" /> Payment Required
                      </span>
                    )}
                    {!v.registration_fee_paid && (
                      <Link to={`/reception/billing`}>
                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 text-primary border-primary/30">
                          <CreditCard className="w-3 h-3 mr-1" /> Settle Fee
                        </Button>
                      </Link>
                    )}
                    {(() => {
                      const pending = nurseTasks.filter(t => t.visit_id === v.id && t.status !== 'completed').length;
                      return pending > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                          <Syringe className="w-3 h-3" />{pending} nurse task{pending > 1 ? 's' : ''} pending
                        </span>
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge status={v.status} />
                <Select value={v.status} onValueChange={val => handleStatusChange(v, val)}>
                  <SelectTrigger className="h-7 w-36 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => (
                      <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
          {cancelledVisits.length > 0 && (
            <div className="pt-2">
              <p className="text-xs text-muted-foreground uppercase font-semibold mb-2">Cancelled ({cancelledVisits.length})</p>
              {cancelledVisits.map(v => (
                <div key={v.id} className="bg-card/50 rounded-xl border border-border/50 p-3 flex items-center justify-between opacity-60 mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <span className="text-sm font-bold text-muted-foreground">#{v.queue_number}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{v.patient_name}</p>
                  </div>
                  <StatusBadge status="cancelled" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}