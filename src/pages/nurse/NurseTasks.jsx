import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import DataTable from '@/components/common/DataTable';
import StatusBadge from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

export default function NurseTasks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState('');
  const [scope, setScope] = useState('my');

  const { data: tasks = [], isLoading } = useQuery({ 
    queryKey: ['nurseTasks'], 
    queryFn: () => ethioCareClient.entities.NurseTask.list('-created_date', 100),
    refetchInterval: 10000
  });

  const { data: visits = [] } = useQuery({
    queryKey: ['visits'],
    queryFn: () => ethioCareClient.entities.Visit.list('-created_date', 100),
    refetchInterval: 15000
  });

  const getBedInfo = (patientId, visitId) => {
    const v = (visitId && visits.find(vis => vis.id === visitId)) ||
              (patientId && visits.find(vis => vis.patient_id === patientId && (vis.bed_assigned || vis.room_number)));
    if (v && v.room_number && v.bed_number) return `Room ${v.room_number} → Bed ${v.bed_number}`;
    if (v && v.room_number) return `Room ${v.room_number}`;
    return null;
  };

  const isAssignedToMe = (t) => {
    if (!user) return true;
    const myId = String(user.id || '').trim();
    const myName = String(user.full_name || '').toLowerCase().trim();
    const assignedId = String(t.assigned_nurse_id || '').trim();
    const assignedName = String(t.assigned_nurse_name || '').toLowerCase().trim();
    if (!assignedId && !assignedName) return true;
    if (assignedId && myId && assignedId === myId) return true;
    if (assignedName && myName && (assignedName.includes(myName) || myName.includes(assignedName))) return true;
    return false;
  };

  const displayedTasks = scope === 'my' ? tasks.filter(isAssignedToMe) : tasks;

  const handleStart = async (task) => {
    queryClient.setQueryData(['nurseTasks'], (old) => old.map(t => t.id === task.id ? { ...t, status: 'in_progress' } : t));
    try {
      await ethioCareClient.entities.NurseTask.update(task.id, { status: 'in_progress' });
      toast.success('Task started');
    } catch {
      queryClient.invalidateQueries({ queryKey: ['nurseTasks'] });
      toast.error('Failed to start task');
    }
    queryClient.invalidateQueries({ queryKey: ['nurseTasks'] });
  };

  const [isCompleting, setIsCompleting] = useState(false);

  const handleComplete = async () => {
    if (!selected) return;
    setIsCompleting(true);
    try {
      await ethioCareClient.entities.NurseTask.update(selected.id, { 
        status: 'completed', 
        notes: notes?.trim() || null, 
        completed_by: user?.full_name || 'Staff Nurse',
        completed_date: format(new Date(), 'yyyy-MM-dd')
      });
      queryClient.invalidateQueries({ queryKey: ['nurseTasks'] });
      toast.success('Task completed');
      setSelected(null);
      setNotes('');
    } catch (err) {
      console.error('[NurseTasks] Error completing task:', err);
      toast.error(err.message || 'Failed to complete task');
    } finally {
      setIsCompleting(false);
    }
  };

  const columns = [
    { 
      header: 'Patient & Bed', 
      cell: (r) => {
        const bedInfo = getBedInfo(r.patient_id, r.visit_id);
        return (
          <div>
            <p className="font-semibold text-sm text-foreground">{r.patient_name}</p>
            {bedInfo ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800 mt-0.5">
                🏨 {bedInfo}
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground">Outpatient / OPD</span>
            )}
          </div>
        );
      }
    },
    { 
      header: 'Task & Doctor', 
      cell: (r) => (
        <div>
          <span className="capitalize font-medium text-sm text-foreground block">{r.task_type?.replace(/_/g, ' ')}</span>
          <p className="text-[11px] text-muted-foreground truncate max-w-xs">
            {r.doctor_name ? `Dr. ${r.doctor_name}` : ''} {r.instructions ? `· ${r.instructions}` : (r.description ? `· ${r.description}` : '')}
          </p>
        </div>
      )
    },
    { header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
    { header: 'Action', cell: (r) => {
      if (r.status === 'pending') return <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleStart(r); }}>Start</Button>;
      if (r.status === 'in_progress') return <Button size="sm" onClick={(e) => { e.stopPropagation(); setSelected(r); setNotes(r.notes || ''); }}>Complete</Button>;
      return <span className="text-xs text-emerald-600 font-semibold">Done</span>;
    }}
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nurse Tasks</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Logged in as: <strong>{user?.full_name || 'Staff Nurse'}</strong></p>
        </div>
        <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border border-border shrink-0 self-start sm:self-auto">
          <Button
            size="sm"
            variant={scope === 'my' ? 'default' : 'ghost'}
            className="h-8 text-xs font-medium rounded-lg px-3"
            onClick={() => setScope('my')}
          >
            Assigned to Me
          </Button>
          <Button
            size="sm"
            variant={scope === 'all' ? 'default' : 'ghost'}
            className="h-8 text-xs font-medium rounded-lg px-3"
            onClick={() => setScope('all')}
          >
            All Ward Tasks
          </Button>
        </div>
      </div>
      <DataTable columns={columns} data={displayedTasks} isLoading={isLoading} />

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Complete Task</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4 pt-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p><strong>Patient:</strong> {selected.patient_name}</p>
                <p><strong>Task:</strong> {selected.task_type?.replace('_', ' ')}</p>
                <p><strong>Instructions:</strong> {selected.instructions || selected.description}</p>
              </div>
              <div><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="Record notes..." /></div>
              <Button className="w-full" onClick={handleComplete} disabled={isCompleting}>
                {isCompleting ? 'Marking Complete...' : 'Mark Complete'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}