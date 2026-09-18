import { useQuery } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import DataTable from '@/components/common/DataTable';
import { format } from 'date-fns';

export default function LabResults() {
  const { data: labOrders = [], isLoading } = useQuery({ queryKey: ['labOrders'], queryFn: () => ethioCareClient.entities.LabOrder.list('-created_date', 200) });
  const completed = labOrders.filter(o => o.test_status === 'completed');

  const columns = [
    { header: 'Patient', accessor: 'patient_name' },
    { header: 'Test', cell: (r) => `${r.test_type}${r.test_name ? ` - ${r.test_name}` : ''}` },
    { header: 'Results', cell: (r) => <span className="truncate max-w-[250px] block text-sm">{r.results}</span> },
    { header: 'Doctor', accessor: 'doctor_name' },
    { header: 'Completed', cell: (r) => r.completed_date ? format(new Date(r.completed_date), 'MMM d, yyyy') : '-' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Completed Results</h1>
      <DataTable columns={columns} data={completed} isLoading={isLoading} emptyMessage="No completed results" />
    </div>
  );
}