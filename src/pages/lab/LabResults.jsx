import { useQuery } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import DataTable from '@/components/common/DataTable';
import { format } from 'date-fns';

export default function LabResults() {
  const { data: labOrders = [], isLoading } = useQuery({ queryKey: ['labOrders'], queryFn: () => ethioCareClient.entities.LabOrder.list('-created_date', 200) });
  const completed = labOrders.filter(o => o.test_status === 'completed');

  const columns = [
    { header: 'Patient', accessor: 'patient_name' },
    { 
      header: 'Diagnostic Test', 
      cell: (r) => (
        <div>
          <p className="font-semibold text-foreground text-xs">{r.test_name || r.test_type}</p>
          <span className="text-[11px] text-muted-foreground">{r.test_type}</span>
        </div>
      ) 
    },
    { 
      header: 'Results Summary', 
      cell: (r) => (
        <span className="truncate max-w-[200px] block text-xs font-mono bg-muted/50 px-2 py-1 rounded">
          {r.results || 'No detailed text'}
        </span>
      ) 
    },
    { 
      header: 'Doctor & Date', 
      cell: (r) => (
        <div>
          <p className="text-xs font-medium text-foreground">Dr. {r.doctor_name || 'Staff'}</p>
          <span className="text-[10px] text-muted-foreground">
            {r.completed_date ? format(new Date(r.completed_date), 'MMM d, yyyy') : '-'}
          </span>
        </div>
      ) 
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Completed Results</h1>
      <DataTable columns={columns} data={completed} isLoading={isLoading} emptyMessage="No completed results" />
    </div>
  );
}