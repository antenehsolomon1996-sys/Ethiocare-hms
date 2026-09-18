import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import PatientHistoryView from '@/pages/shared/PatientHistoryView';
import { Search, User, Phone, Hash, Stethoscope } from 'lucide-react';
import { useDoctorContext } from '@/lib/DoctorContext';

export default function DoctorPatientHistory() {
  const { selectedDoctor } = useDoctorContext();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);

  const { data: patients = [] } = useQuery({
    queryKey: ['patients'],
    queryFn: () => base44.entities.Patient.list('-created_date', 500)
  });

  const searched = query.trim().length >= 2;
  const filtered = searched ? patients.filter(p => {
    const q = query.toLowerCase();
    return (
      p.full_name?.toLowerCase().includes(q) ||
      p.phone?.includes(q) ||
      p.patient_id?.toLowerCase().includes(q)
    );
  }) : patients.slice(0, 20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Patient Medical History</h1>
        <p className="text-sm text-muted-foreground">Search and view complete patient history across all doctors</p>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          className="pl-10 h-12 text-base"
          placeholder="Search by patient name, phone, or ID..."
          value={query}
          onChange={e => { setQuery(e.target.value); setSelected(null); }}
          autoFocus
        />
      </div>

      <div className="max-w-xl space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase">
          {searched ? `Search Results (${filtered.length})` : `Recent Patients`}
        </p>
        {filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center text-muted-foreground">
            <User className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">{searched ? 'No patients found' : 'No patients registered yet'}</p>
          </div>
        ) : filtered.map(p => (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className={`w-full text-left bg-card border rounded-xl p-4 transition-all hover:shadow-md ${
                selected?.id === p.id ? 'border-primary ring-1 ring-primary' : 'border-border'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{p.full_name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" />{p.phone}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Hash className="w-3 h-3" />{p.patient_id}
                      </span>
                    </div>
                  </div>
                </div>
                <Badge className="text-xs bg-secondary text-secondary-foreground">{p.gender}</Badge>
              </div>
            </button>
          ))}
      </div>

      {selected && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{selected.full_name}</h2>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <Badge className="text-xs bg-secondary text-secondary-foreground">{selected.gender}</Badge>
                    {selected.age && <Badge className="text-xs bg-secondary text-secondary-foreground">Age {selected.age}</Badge>}
                    <Badge className="text-xs bg-primary/10 text-primary font-mono">{selected.patient_id}</Badge>
                    <Badge className="text-xs bg-blue-50 text-blue-700">{selected.phone}</Badge>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-800 flex items-center gap-2">
                  <Stethoscope className="w-3.5 h-3.5" />
                  {selectedDoctor
                    ? `Viewing as Dr. ${selectedDoctor.full_name} — All records from all attending physicians are visible below.`
                    : 'Select a doctor from the sidebar to personalize this view.'}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="bg-card border border-border rounded-xl p-5">
            <PatientHistoryView patientId={selected.id} patientName={selected.full_name} />
          </div>
        </div>
      )}

      {!selected && patients.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Stethoscope className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No patients registered yet</p>
          <p className="text-sm mt-1">Patients will appear here once registered at reception</p>
        </div>
      )}
    </div>
  );
}