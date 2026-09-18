import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
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
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState('');
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({ 
    queryKey: ['nurseTasks'], 
    queryFn: () => base44.entities.NurseTask.list('-created_date', 100),
    refetchInterval: 10000
  });

  const handleStart = async (task) => {
    queryClient.setQueryData(['nurseTasks'], (old) => old.map(t => t.id === task.id ? { ...t, status: 'in_progress' } : t));
    try {
      await base44.entities.NurseTask.update(task.id, { status: 'in_progress' });
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
      await base44.entities.NurseTask.update(selected.id, { 
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
    { header: 'Patient', accessor: 'patient_name' },
    { header: 'Task', cell: (r) => <span className="capitalize">{r.task_type?.replace('_', ' ')}</span> },
    { header: 'Description', accessor: 'description' },
    { header: 'Doctor', accessor: 'doctor_name' },
    { header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
    { header: 'Action', cell: (r) => {
      if (r.status === 'pending') return <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleStart(r); }}>Start</Button>;
      if (r.status === 'in_progress') return <Button size="sm" onClick={(e) => { e.stopPropagation(); setSelected(r); setNotes(r.notes || ''); }}>Complete</Button>;
      return <span className="text-xs text-emerald-600">Done</span>;
    }}
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nurse Tasks</h1>
      <DataTable columns={columns} data={tasks} isLoading={isLoading} />

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