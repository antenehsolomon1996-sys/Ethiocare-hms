import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import DataTable from '@/components/common/DataTable';
import { format } from 'date-fns';

export default function ReceiptsList() {
  const { data: payments = [], isLoading } = useQuery({ 
    queryKey: ['payments'], 
    queryFn: () => base44.entities.Payment.list('-created_date', 200) 
  });

  const paidPayments = payments.filter(p => p.status === 'paid');

  const columns = [
    { header: 'Receipt #', accessor: 'receipt_number' },
    { header: 'Patient', accessor: 'patient_name' },
    { header: 'Type', cell: (r) => <span className="capitalize">{r.payment_type?.replace('_', ' ')}</span> },
    { header: 'Amount', cell: (r) => `${r.amount?.toLocaleString()} ETB` },
    { header: 'Method', cell: (r) => <span className="capitalize">{r.payment_method?.replace('_', ' ')}</span> },
    { header: 'Cashier', accessor: 'cashier_name' },
    { header: 'Date', cell: (r) => r.paid_date ? format(new Date(r.paid_date), 'MMM d, yyyy') : '-' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Receipts</h1>
        <p className="text-sm text-muted-foreground">{paidPayments.length} receipts generated</p>
      </div>
      <DataTable columns={columns} data={paidPayments} isLoading={isLoading} emptyMessage="No receipts yet" />
    </div>
  );
}
