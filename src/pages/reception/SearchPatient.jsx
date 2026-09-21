import { useQuery } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import DataTable from '@/components/common/DataTable';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Search, Send } from 'lucide-react';
import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import StatusBadge from '@/components/common/StatusBadge';
import { buildDoctorList } from '@/lib/doctorUtils';

export default function SearchPatient() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [isSendingQueue, setIsSendingQueue] = useState(false);
  const queryClient = useQueryClient();

  const { data: patients = [], isLoading } = useQuery({ queryKey: ['patients'], queryFn: () => ethioCareClient.entities.Patient.list('-created_date') });
  const { data: visits = [] } = useQuery({ queryKey: ['visits'], queryFn: () => ethioCareClient.entities.Visit.list('-created_date', 200) });
  const { data: staffList = [] } = useQuery({ queryKey: ['staff'], queryFn: () => ethioCareClient.entities.Staff.list().catch(() => []) });
  const { data: directDoctors = [] } = useQuery({ queryKey: ['doctors'], queryFn: () => ethioCareClient.entities.Doctor.list().catch(() => []) });
  
  // Authoritative unified doctor list from Staff Management
  const doctors = useMemo(() => buildDoctorList(directDoctors, staffList), [directDoctors, staffList]);

  const filtered = patients.filter(p => {
    if (!search) return true;
    const s = search.toLowerCase();
    return p.full_name?.toLowerCase().includes(s) || p.patient_id?.toLowerCase().includes(s) || p.phone?.includes(s);
  });

  const patientVisits = selected ? visits.filter(v => v.patient_id === selected.id) : [];

  const handleSendToQueue = async () => {
    if (!selected) return;
    setIsSendingQueue(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const todayVisits = visits.filter(v => v.visit_date === today);
      const queueNum = todayVisits.length + 1;
      const matchedDoctor = doctors.find(d => d.id === selectedDoctor || d.full_name === selectedDoctor);

      await ethioCareClient.entities.Visit.create({
        patient_id: selected.id,
        patient_name: selected.full_name,
        visit_date: today,
        queue_number: queueNum,
        status: 'waiting',
        assigned_doctor: matchedDoctor?.full_name || selectedDoctor || null,
        assigned_doctor_id: matchedDoctor?.id || null
      });
      await ethioCareClient.entities.Payment.create({
        patient_id: selected.id,
        patient_name: selected.full_name,
        payment_type: 'consultation',
        description: 'Consultation Fee',
        amount: 100,
        status: 'pending',
        reference_type: 'service'
      });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success(`Patient sent to queue #${queueNum}`);
      setSelected(null);
      setSelectedDoctor('');
    } catch (err) {
      toast.error(err.message || 'Failed to send patient to queue');
    } finally {
      setIsSendingQueue(false);
    }
  };

  const columns = [
    { 
      header: 'Patient', 
      cell: (r) => (
        <div>
          <p className="font-semibold text-foreground">{r.full_name}</p>
          <span className="text-[11px] font-mono text-muted-foreground">{r.patient_id || 'ID Pending'}</span>
        </div>
      )
    },
    { header: 'Phone', accessor: 'phone' },
    { header: 'Status', cell: (r) => <StatusBadge status={r.status || 'active'} /> },
    { header: 'Action', cell: (r) => <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setSelected(r); }}>View / Send</Button> }
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Search Patient</h1>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by name, ID, or phone..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <DataTable columns={columns} data={filtered} isLoading={isLoading} />

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Patient: {selected?.full_name}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <p><strong>ID:</strong> {selected.patient_id}</p>
                <p><strong>Gender:</strong> {selected.gender}</p>
                <p><strong>Age:</strong> {selected.age}</p>
                <p><strong>Phone:</strong> {selected.phone}</p>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Previous Visits ({patientVisits.length})</h4>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {patientVisits.map(v => (
                    <div key={v.id} className="flex justify-between items-center text-sm bg-muted/50 rounded-lg p-2">
                      <div>
                        <p className="font-medium">{v.visit_date}</p>
                        <p className="text-xs text-muted-foreground">{v.diagnosis || 'No diagnosis'}</p>
                      </div>
                      <StatusBadge status={v.status} />
                    </div>
                  ))}
                  {patientVisits.length === 0 && <p className="text-xs text-muted-foreground">No previous visits</p>}
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <Label>Send to Doctor</Label>
                <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                  <SelectTrigger><SelectValue placeholder="Select doctor" /></SelectTrigger>
                  <SelectContent>
                    {doctors.map(d => (
                      <SelectItem key={d.id} value={d.full_name}>{d.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button className="w-full" onClick={handleSendToQueue} disabled={isSendingQueue}>
                  <Send className="w-4 h-4 mr-2" /> {isSendingQueue ? 'Sending to Queue...' : 'Send to Queue'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}