import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import { useDoctorContext } from '@/lib/DoctorContext';
import { useAuth } from '@/lib/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Stethoscope, Building2, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function DoctorSelector({ collapsed }) {
  const { selectedDoctor, setSelectedDoctor } = useDoctorContext();
  const { user } = useAuth();

  const isIndividualDoctor = user?.role === 'doctor';

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
    if (isIndividualDoctor) return; // Lock individual doctor to their own identity
    const doc = activeDoctors.find(d => d.id === id);
    setSelectedDoctor(doc || null);
  };

  if (collapsed) {
    return (
      <div className="px-2 py-2 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-lg bg-indigo-500/20 flex items-center justify-center mx-auto" title={selectedDoctor?.full_name || 'Doctor Workspace'}>
          <Stethoscope className="w-4 h-4 text-indigo-300" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-3 border-b border-sidebar-border space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          {isIndividualDoctor ? 'Authenticated Doctor' : 'Viewing As'}
        </p>
        {isIndividualDoctor && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
            <Lock className="w-2.5 h-2.5" /> Locked
          </span>
        )}
      </div>

      {isIndividualDoctor ? (
        <div className="rounded-lg bg-sidebar-accent/80 p-2.5 space-y-1.5 border border-sidebar-border">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-4 h-4 shrink-0 text-indigo-400" />
            <span className="font-bold text-xs truncate">Dr. {selectedDoctor?.full_name || user?.full_name}</span>
          </div>
          <p className="text-[11px] text-sidebar-foreground/70 truncate">
            {selectedDoctor?.specialty || user?.specialization || 'Attending Physician'}
          </p>
          <div className="flex items-center justify-between pt-1">
            {(selectedDoctor?.assigned_room_number || user?.assigned_room_number) ? (
              <Badge variant="outline" className="text-[10px] font-mono bg-primary/10 text-primary border-primary/30">
                <Building2 className="w-2.5 h-2.5 mr-1" />
                Room {selectedDoctor?.assigned_room_number || user?.assigned_room_number}
              </Badge>
            ) : (
              <span className="text-[10px] text-muted-foreground italic">Consultation Room</span>
            )}
            <span className="text-[10px] font-semibold text-emerald-400">
              Active
            </span>
          </div>
        </div>
      ) : (
        <>
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
                    <span className="text-[10px] text-muted-foreground">
                      {d.specialty} {d.assigned_room_number ? `· Room ${d.assigned_room_number}` : ''}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedDoctor && (
            <div className="rounded-lg bg-sidebar-accent/60 p-2 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-sidebar-foreground/70 truncate">{selectedDoctor.specialty}</span>
                {selectedDoctor.assigned_room_number && (
                  <span className="text-primary font-mono text-[10px]">Room {selectedDoctor.assigned_room_number}</span>
                )}
              </div>
              <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                selectedDoctor.availability === 'available' ? 'bg-green-500/20 text-green-300' :
                selectedDoctor.availability === 'busy' ? 'bg-amber-500/20 text-amber-300' :
                'bg-red-500/20 text-red-300'
              }`}>
                {selectedDoctor.availability || 'active'}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}