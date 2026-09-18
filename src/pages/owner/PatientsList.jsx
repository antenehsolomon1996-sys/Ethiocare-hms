import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import DataTable from '@/components/common/DataTable';
import StatusBadge from '@/components/common/StatusBadge';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';

export default function PatientsList() {
  const [search, setSearch] = useState('');
  const { data: patients = [], isLoading } = useQuery({ queryKey: ['patients'], queryFn: () => base44.entities.Patient.list('-created_date') });

  const filtered = patients.filter(p => {
    if (!search) return true;
    const s = search.toLowerCase();
    return p.full_name?.toLowerCase().includes(s) || p.patient_id?.toLowerCase().includes(s) || p.phone?.includes(s);
  });

  const columns = [
    { header: 'Patient ID', accessor: 'patient_id' },
    { header: 'Full Name', accessor: 'full_name' },
    { header: 'Gender', accessor: 'gender' },
    { header: 'Age', accessor: 'age' },
    { header: 'Phone', accessor: 'phone' },
    { header: 'Registered', cell: (r) => r.created_date ? format(new Date(r.created_date), 'MMM d, yyyy') : '-' },
    { header: 'Status', cell: (r) => <StatusBadge status={r.status || 'active'} /> },
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