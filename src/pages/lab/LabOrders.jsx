import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import DataTable from '@/components/common/DataTable';
import StatusBadge from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useState } from 'react';
import { toast } from 'sonner';
import { notificationService } from '@/services/notification.service';
import { useAuth } from '@/lib/AuthContext';
import { Badge } from '@/components/ui/badge';
import { User, FlaskConical, Building2 } from 'lucide-react';

export default function LabOrders() {
  const { user } = useAuth();
  const [selected, setSelected] = useState(null);
  const [results, setResults] = useState('');
  const [resultNotes, setResultNotes] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [scope, setScope] = useState('my'); // 'my' | 'all'
  const queryClient = useQueryClient();

  const { data: labOrders = [], isLoading } = useQuery({ 
    queryKey: ['labOrders'], 
    queryFn: () => ethioCareClient.entities.LabOrder.list('-created_date', 200),
    refetchInterval: 10000
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // CRITICAL: Only show PAID orders - unpaid must NEVER appear
  const paidOrders = labOrders.filter(o => o.payment_status === 'paid');

  const isAssignedToMe = (order) => {
    if (!user) return true;
    const myId = String(user.id || '').trim();
    const myName = String(user.full_name || '').toLowerCase().trim();
    const assignedId = String(order.assigned_assistant_id || '').trim();
    const assignedName = String(order.assigned_assistant_name || '').toLowerCase().trim();

    if (!assignedId && !assignedName) return true;
    if (assignedId && myId && assignedId === myId) return true;
    if (assignedName && myName && (assignedName.includes(myName) || myName.includes(assignedName))) return true;
    return false;
  };

  const scopedPaidOrders = scope === 'my' ? paidOrders.filter(isAssignedToMe) : paidOrders;
  const filtered = statusFilter === 'all' ? scopedPaidOrders : scopedPaidOrders.filter(o => o.test_status === statusFilter);

  const handleStartTest = async (order) => {
    if (!order?.id) return;
    setIsSubmitting(true);
    try {
      await ethioCareClient.entities.LabOrder.update(order.id, { test_status: 'in_progress' });
      if (order.visit_id && typeof order.visit_id === 'string' && order.visit_id.trim()) {
        try {
          await ethioCareClient.entities.Visit.update(order.visit_id.trim(), { status: 'lab_processing' });
        } catch (visitErr) {
          console.warn('[LabOrders] Test started, but visit status sync encountered warning:', visitErr?.message || visitErr);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['labOrders', 'visits'] });
      toast.success('Test started');
    } catch (err) {
      console.error('[LabOrders] Error starting test:', err);
      toast.error(err.message || 'Failed to start test');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitResults = async () => {
    if (!selected?.id) return;
    if (!results?.trim()) {
      toast.error('Test results are required');
      return;
    }
    setIsSubmitting(true);
    try {
      await ethioCareClient.entities.LabOrder.update(selected.id, { 
        test_status: 'completed', 
        results: results.trim(), 
        result_notes: resultNotes?.trim() || null,
        completed_date: format(new Date(), 'yyyy-MM-dd')
      });
      if (selected.visit_id && typeof selected.visit_id === 'string' && selected.visit_id.trim()) {
        try {
          await ethioCareClient.entities.Visit.update(selected.visit_id.trim(), { status: 'lab_complete' });
        } catch (visitErr) {
          console.warn('[LabOrders] Lab results submitted, but visit status sync encountered warning:', visitErr?.message || visitErr);
        }
      }

      notificationService.dispatch({
        title: 'Lab Results Ready',
        message: `Diagnostic results submitted for ${selected.patient_name} (${selected.test_name || selected.test_type}). Available in Doctor Portal.`,
        type: 'info',
        module: 'lab',
        targetRoles: ['doctor', 'owner'],
        link: '/doctor/lab-orders'
      });

      queryClient.invalidateQueries({ queryKey: ['labOrders', 'visits'] });
      toast.success('Results submitted — Doctor notified');
      setSelected(null);
      setResults('');
      setResultNotes('');
    } catch (err) {
      console.error('[LabOrders] Error submitting results:', err);
      toast.error(err.message || 'Failed to submit lab results');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = [
    { header: 'Patient', accessor: 'patient_name' },
    { header: 'Test Type', accessor: 'test_type' },
    { header: 'Test Name', accessor: 'test_name' },
    { header: 'Doctor', accessor: 'doctor_name' },
    { 
      header: 'Assigned Assistant', 
      cell: (r) => (
        <span className="text-xs">
          {r.assigned_assistant_name ? (
            <span className="font-medium text-foreground">{r.assigned_assistant_name}</span>
          ) : (
            <span className="text-muted-foreground italic">Unassigned (Lab Pool)</span>
          )}
        </span>
      )
    },
    { header: 'Status', cell: (r) => <StatusBadge status={r.test_status} /> },
    { header: 'Action', cell: (r) => {
      if (r.test_status === 'pending' || r.test_status === 'awaiting_sample' || !r.test_status) return (
        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleStartTest(r); }}>Start Test</Button>
      );
      if (r.test_status === 'in_progress') return (
        <Button size="sm" onClick={(e) => { e.stopPropagation(); setSelected(r); setResults(r.results || ''); setResultNotes(r.result_notes || ''); }}>Enter Results</Button>
      );
      if (r.test_status === 'completed') return <span className="text-xs text-emerald-600 font-medium">Done</span>;
      return null;
    }}
  ];

  return (
    <div className="space-y-6">
      {/* Personalized Header Card */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight">
                {user?.full_name ? `Lab Orders · ${user.full_name}` : 'Lab Diagnostic Orders'}
              </h1>
              <Badge variant="outline" className="text-xs font-mono bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30">
                Staff ID: {user?.id?.slice(0, 8).toUpperCase() || 'LAB'}
              </Badge>
              {user?.assigned_room_number && (
                <Badge variant="outline" className="text-xs font-mono bg-primary/10 text-primary border-primary/30 flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  Room {user.assigned_room_number}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Strict Payment Gate: Showing <strong>{paidOrders.length} paid</strong> orders
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border border-border">
            <Button
              size="sm"
              variant={scope === 'my' ? 'default' : 'ghost'}
              className="h-8 text-xs font-medium rounded-lg px-3"
              onClick={() => setScope('my')}
            >
              <User className="w-3.5 h-3.5 mr-1" />
              Assigned to Me
            </Button>
            <Button
              size="sm"
              variant={scope === 'all' ? 'default' : 'ghost'}
              className="h-8 text-xs font-medium rounded-lg px-3"
              onClick={() => setScope('all')}
            >
              <FlaskConical className="w-3.5 h-3.5 mr-1" />
              All Paid Orders
            </Button>
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable columns={columns} data={filtered} isLoading={isLoading} emptyMessage="No paid lab diagnostic orders found" />

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enter Lab Results</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4 pt-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p><strong>Patient:</strong> {selected.patient_name}</p>
                <p><strong>Test:</strong> {selected.test_type} {selected.test_name ? `- ${selected.test_name}` : ''}</p>
                <p><strong>Doctor:</strong> {selected.doctor_name}</p>
                {selected.notes && <p><strong>Notes:</strong> {selected.notes}</p>}
              </div>
              <div><Label>Results *</Label><Textarea value={results} onChange={e => setResults(e.target.value)} rows={5} placeholder="Enter test results..." /></div>
              <div><Label>Additional Notes</Label><Textarea value={resultNotes} onChange={e => setResultNotes(e.target.value)} rows={2} /></div>
              <Button className="w-full" onClick={handleSubmitResults} disabled={isSubmitting}>
                {isSubmitting ? 'Submitting Results...' : 'Submit Results'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}