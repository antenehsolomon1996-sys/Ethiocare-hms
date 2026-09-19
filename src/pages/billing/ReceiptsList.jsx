import { useQuery } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import DataTable from '@/components/common/DataTable';
import { format } from 'date-fns';

export default function ReceiptsList() {
  const { data: payments = [], isLoading } = useQuery({ 
    queryKey: ['payments'], 
    queryFn: () => ethioCareClient.entities.Payment.list('-created_date', 200) 
  });

  const paidPayments = payments.filter(p => p.status === 'paid');

  const columns = [
    { 
      header: 'Receipt #', 
      cell: (r) => (
        <div>
          <span className="font-mono font-bold text-foreground">{r.receipt_number || `RCP-${r.id?.slice(0, 8)}`}</span>
          <p className="text-[11px] text-muted-foreground">{r.paid_date ? format(new Date(r.paid_date), 'MMM d, yyyy') : '-'}</p>
        </div>
      )
    },
    { 
      header: 'Patient & Service', 
      cell: (r) => (
        <div>
          <p className="font-semibold text-foreground">{r.patient_name}</p>
          <span className="text-[11px] text-muted-foreground capitalize">{r.payment_type?.replace(/_/g, ' ')}</span>
        </div>
      )
    },
    { 
      header: 'Amount & Method', 
      cell: (r) => (
        <div>
          <p className="font-mono font-semibold text-primary">{r.amount?.toLocaleString()} ETB</p>
          <span className="text-[11px] text-muted-foreground capitalize">{r.payment_method?.replace(/_/g, ' ')}</span>
        </div>
      )
    },
    { 
      header: 'Cashier', 
      cell: (r) => (
        <div>
          <p className="text-xs font-medium text-foreground truncate max-w-[120px]">{r.cashier_name || 'Cashier'}</p>
          <span className="text-[10px] text-emerald-600 font-semibold uppercase">Paid</span>
        </div>
      )
    },
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
