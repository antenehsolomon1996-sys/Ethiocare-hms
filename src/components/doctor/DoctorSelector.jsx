import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import { useDoctorContext } from '@/lib/DoctorContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Stethoscope, ChevronDown } from 'lucide-react';

export default function DoctorSelector({ collapsed }) {
  const { selectedDoctor, setSelectedDoctor } = useDoctorContext();

  const { data: doctors = [] } = useQuery({
    queryKey: ['doctors'],
    queryFn: () => ethioCareClient.entities.Doctor.list(),
  });

  const activeDoctors = useMemo(() => {
    const seenIds = new Set();
    const seenCanonical = new Set();
    return doctors.filter(d => {
      if (!d || !d.id || (d.status && d.status !== 'active')) return false;
      if (seenIds.has(d.id)) return false;
      const canonicalKey = `${d.full_name?.toLowerCase().trim()}_${d.email?.toLowerCase().trim()}_${d.specialty?.toLowerCase().trim()}`;
      if (d.email && seenCanonical.has(canonicalKey)) return false;
      seenIds.add(d.id);
      if (d.email) seenCanonical.add(canonicalKey);
      return true;
    });
  }, [doctors]);

  const handleChange = (id) => {
    const doc = activeDoctors.find(d => d.id === id);
    setSelectedDoctor(doc || null);
  };

  if (collapsed) {
    return (
      <div className="px-2 py-2 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-lg bg-indigo-500/20 flex items-center justify-center mx-auto" title={selectedDoctor?.full_name || 'Select Doctor'}>
          <Stethoscope className="w-4 h-4 text-indigo-300" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-3 border-b border-sidebar-border space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">Viewing As</p>
      <Select value={selectedDoctor?.id || ''} onValueChange={handleChange}>
        <SelectTrigger className="bg-sidebar-accent border-sidebar-border text-sidebar-foreground text-xs h-9 w-full">
          <div className="flex items-center gap-2 min-w-0">
            <Stethoscope className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
            <span className="truncate">
              {selectedDoctor ? `Dr. ${selectedDoctor.full_name}` : 'Select Doctor'}
            </span>
          </div>
        </SelectTrigger>
        <SelectContent>
          {activeDoctors.length === 0 && (
            <SelectItem value="__none" disabled>No doctors found</SelectItem>
          )}
          {activeDoctors.map(d => (
            <SelectItem key={d.id} value={d.id}>
              <div className="flex flex-col">
                <span className="font-medium">Dr. {d.full_name}</span>
                {d.specialty && <span className="text-xs text-muted-foreground">{d.specialty}</span>}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedDoctor && (
        <div className="rounded-lg bg-sidebar-accent/60 p-2 space-y-0.5">
          {selectedDoctor.specialty && (
            <p className="text-[11px] text-sidebar-foreground/70">{selectedDoctor.specialty}</p>
          )}
          {selectedDoctor.department && (
            <p className="text-[11px] text-sidebar-foreground/50">{selectedDoctor.department} Dept.</p>
          )}
          <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded ${
            selectedDoctor.availability === 'available' ? 'bg-green-500/20 text-green-300' :
            selectedDoctor.availability === 'busy' ? 'bg-amber-500/20 text-amber-300' :
            'bg-red-500/20 text-red-300'
          }`}>
            {selectedDoctor.availability || 'active'}
          </span>
        </div>
      )}
    </div>
  );
}