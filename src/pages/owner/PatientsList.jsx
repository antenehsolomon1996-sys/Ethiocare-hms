import { useQuery } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import DataTable from '@/components/common/DataTable';
import StatusBadge from '@/components/common/StatusBadge';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';

export default function PatientsList() {
  const [search, setSearch] = useState('');
  const { data: patients = [], isLoading } = useQuery({ queryKey: ['patients'], queryFn: () => ethioCareClient.entities.Patient.list('-created_date') });

  const filtered = patients.filter(p => {
    if (!search) return true;
    const s = search.toLowerCase();
    return p.full_name?.toLowerCase().includes(s) || p.patient_id?.toLowerCase().includes(s) || p.phone?.includes(s);
  });

  const columns = [
    { 
      header: 'Patient', 
      cell: (r) => (
        <div>
          <p className="font-semibold text-foreground">{r.full_name}</p>
          <span className="text-[11px] font-mono text-muted-foreground">{r.patient_id}</span>
        </div>
      )
    },
    { 
      header: 'Demographics', 
      cell: (r) => (
        <span className="capitalize">{r.gender || '-'} · {r.age ? `${r.age} yrs` : '-'}</span>
      )
    },
    { header: 'Phone', accessor: 'phone' },
    { 
      header: 'Status & Reg Date', 
      cell: (r) => (
        <div>
          <StatusBadge status={r.status || 'active'} />
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {r.created_date ? format(new Date(r.created_date), 'MMM d, yyyy') : '-'}
          </p>
        </div>
      )
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">All Patients</h1>
        <p className="text-sm text-muted-foreground">{patients.length} registered patients</p>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by name, ID, or phone..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <DataTable columns={columns} data={filtered} isLoading={isLoading} emptyMessage="No patients found" />
    </div>
  );
}