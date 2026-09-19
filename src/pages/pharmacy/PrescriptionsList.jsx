import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import DataTable from '@/components/common/DataTable';
import StatusBadge from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { logAudit } from '@/lib/auditLogger';
import { notificationService } from '@/services/notification.service';
import { movementService } from '@/services/movement.service';

export default function PrescriptionsList() {
  const { user, role } = useAuth();
  const [selected, setSelected] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const queryClient = useQueryClient();

  const { data: prescriptions = [], isLoading } = useQuery({ 
    queryKey: ['prescriptions'], 
    queryFn: () => ethioCareClient.entities.Prescription.list('-created_date', 200),
    refetchInterval: 10000
  });

  const filtered = statusFilter === 'all' ? prescriptions : prescriptions.filter(p => p.status === statusFilter);

  const [isDispensing, setIsDispensing] = useState(false);

  const handleDispense = async () => {
    if (!selected) return;
    setIsDispensing(true);
    try {
      await ethioCareClient.entities.Prescription.update(selected.id, { 
        status: 'dispensed',
        dispensed_date: format(new Date(), 'yyyy-MM-dd')
      });
      // Try to reduce stock
      try {
        const medicines = await ethioCareClient.entities.Medicine.list();
        const medicine = medicines.find(m => m.name?.toLowerCase() === selected.medicine_name?.toLowerCase());
        if (medicine) {
          const newQty = Math.max(0, (medicine.quantity || 0) - (selected.quantity || 1));
          await ethioCareClient.entities.Medicine.update(medicine.id, { 
            quantity: newQty,
            status: newQty <= 0 ? 'out_of_stock' : newQty <= (medicine.min_stock || 10) ? 'low_stock' : 'in_stock'
          });

          // Record HOSPITAL_DISPENSE movement
          try {
            await movementService.recordMovement({
              medicineId: medicine.id,
              medicineName: medicine.name,
              movementType: 'HOSPITAL_DISPENSE',
              quantity: selected.quantity || 1,
              batchNumber: medicine.batch_number,
              expiryDate: medicine.expiry_date,
              unitPrice: medicine.unit_price,
              referenceType: 'prescription',
              referenceId: selected.id,
              sourceLocation: 'Hospital Pharmacy',
              destinationLocation: `Patient: ${selected.patient_name}`,
              notes: `Hospital Dispense: ${selected.dosage || ''} ${selected.frequency || ''} for ${selected.duration || ''}`,
              performedBy: user?.full_name || 'Pharmacist',
              performedByRole: role || 'pharmacist'
            });
          } catch (mvtErr) {
            console.warn('[PrescriptionsList] Movement recording failed:', mvtErr);
          }

          if (newQty <= (medicine.min_stock || 10)) {
            notificationService.dispatch({
              title: 'Low Medicine Stock',
              message: `${medicine.name} is low on stock (${newQty} left).`,
              type: 'alert',
              module: 'pharmacy',
              targetRoles: ['pharmacist', 'owner'],
              link: '/pharmacy/inventory'
            });
          }
        }
      } catch (stockErr) {
        console.warn('[PrescriptionsList] Stock reduction error:', stockErr);
      }
      logAudit({
        userName: user?.full_name || 'Pharmacist',
        userRole: role || 'pharmacist',
        action: 'update',
        module: 'Pharmacy',
        description: `Dispensed ${selected.medicine_name} (${selected.quantity || 1} units) to ${selected.patient_name}`,
        recordId: selected.id,
        recordName: selected.patient_name
      });
      queryClient.invalidateQueries({ queryKey: ['prescriptions', 'medicines'] });
      toast.success('Medicine dispensed successfully');
      setSelected(null);
    } catch (err) {
      console.error('[PrescriptionsList] Error dispensing prescription:', err);
      toast.error(err.message || 'Failed to dispense prescription');
    } finally {
      setIsDispensing(false);
    }
  };

  const columns = [
    { header: 'Patient', accessor: 'patient_name' },
    { 
      header: 'Medicine & Dosage', 
      cell: (r) => (
        <div>
          <p className="font-semibold text-foreground">{r.medicine_name}</p>
          <p className="text-[11px] text-muted-foreground">{r.dosage || ''} · Qty: {r.quantity || 1}</p>
        </div>
      )
    },
    { header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
    { 
      header: 'Action', 
      cell: (r) => (
        <Button 
          size="sm" 
          variant={r.status === 'pending' ? 'default' : 'outline'}
          className="h-8 text-xs" 
          onClick={(e) => { e.stopPropagation(); setSelected(r); }}
        >
          {r.status === 'pending' ? 'Dispense' : 'View'}
        </Button>
      ) 
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Prescriptions</h1>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="dispensed">Dispensed</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DataTable columns={columns} data={filtered} isLoading={isLoading} />

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Dispense Medicine</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4 pt-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <p><strong>Patient:</strong> {selected.patient_name}</p>
                <p><strong>Medicine:</strong> {selected.medicine_name}</p>
                <p><strong>Dosage:</strong> {selected.dosage}</p>
                <p><strong>Frequency:</strong> {selected.frequency}</p>
                <p><strong>Duration:</strong> {selected.duration}</p>
                <p><strong>Quantity:</strong> {selected.quantity}</p>
                <p><strong>Doctor:</strong> {selected.doctor_name}</p>
                {selected.instructions && <p><strong>Instructions:</strong> {selected.instructions}</p>}
              </div>
              <Button className="w-full" onClick={handleDispense} disabled={isDispensing}>
                {isDispensing ? 'Dispensing...' : 'Confirm Dispensing'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}