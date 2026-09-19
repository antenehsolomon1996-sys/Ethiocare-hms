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
import { format } from 'date-fns';
import { toast } from 'sonner';
import { notificationService } from '@/services/notification.service';

export default function LabOrders() {
  const [selected, setSelected] = useState(null);
  const [results, setResults] = useState('');
  const [resultNotes, setResultNotes] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const queryClient = useQueryClient();

  const { data: labOrders = [], isLoading } = useQuery({ 
    queryKey: ['labOrders'], 
    queryFn: () => ethioCareClient.entities.LabOrder.list('-created_date', 200),
    refetchInterval: 10000
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // CRITICAL: Only show PAID orders - unpaid must NEVER appear
  const paidOrders = labOrders.filter(o => o.payment_status === 'paid');
  const filtered = statusFilter === 'all' ? paidOrders : paidOrders.filter(o => o.test_status === statusFilter);

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
    { header: 'Status', cell: (r) => <StatusBadge status={r.test_status} /> },
    { header: 'Action', cell: (r) => {
      if (r.test_status === 'pending') return (
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lab Orders</h1>
          <p className="text-xs text-muted-foreground">Only showing paid orders</p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={filtered} isLoading={isLoading} emptyMessage="No paid lab orders" />

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