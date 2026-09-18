import { useQuery } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import DataTable from '@/components/common/DataTable';
import StatusBadge from '@/components/common/StatusBadge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { useDoctorContext } from '@/lib/DoctorContext';

export default function PatientRecords() {
  const { selectedDoctor } = useDoctorContext();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const { data: patients = [], isLoading } = useQuery({ queryKey: ['patients'], queryFn: () => ethioCareClient.entities.Patient.list('-created_date') });
  const { data: visits = [] } = useQuery({ queryKey: ['visits'], queryFn: () => ethioCareClient.entities.Visit.list('-created_date', 200) });
  const { data: labOrders = [] } = useQuery({ queryKey: ['labOrders'], queryFn: () => ethioCareClient.entities.LabOrder.list('-created_date', 200) });
  const { data: prescriptions = [] } = useQuery({ queryKey: ['prescriptions'], queryFn: () => ethioCareClient.entities.Prescription.list('-created_date', 200) });
  const { data: vitals = [] } = useQuery({ queryKey: ['vitals'], queryFn: () => ethioCareClient.entities.Vital.list('-created_date', 200) });

  const myDoctorId = selectedDoctor?.id;

  // Only show patients who have had a completed consultation with THIS doctor
  const myConsultedPatientIds = new Set(
    visits
      .filter(v => {
        const isMyDoc = myDoctorId
          ? (v.assigned_doctor_id === myDoctorId || v.assigned_doctor?.toLowerCase() === selectedDoctor?.full_name?.toLowerCase())
          : false;
        return isMyDoc && (v.consultation_completed === true || (['pharmacy', 'completed'].includes(v.status) && v.final_diagnosis));
      })
      .map(v => v.patient_id)
  );

  const filtered = patients.filter(p => {
    if (!myConsultedPatientIds.has(p.id)) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return p.full_name?.toLowerCase().includes(s) || p.patient_id?.includes(s);
  });

  const pVisits = selected ? visits.filter(v => v.patient_id === selected.id) : [];
  const pLabs = selected ? labOrders.filter(o => o.patient_id === selected.id) : [];
  const pRx = selected ? prescriptions.filter(p => p.patient_id === selected.id) : [];
  const pVitals = selected ? vitals.filter(v => v.patient_id === selected.id) : [];

  const columns = [
    { header: 'Patient ID', accessor: 'patient_id' },
    { header: 'Name', accessor: 'full_name' },
    { header: 'Gender', accessor: 'gender' },
    { header: 'Age', accessor: 'age' },
    { header: 'Phone', accessor: 'phone' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Patient Records</h1>
        <p className="text-sm text-muted-foreground">
          {selectedDoctor
            ? `Patients consulted by Dr. ${selectedDoctor.full_name}`
            : 'Select a doctor from the sidebar to view their patient records'}
        </p>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search patients..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <DataTable columns={columns} data={filtered} isLoading={isLoading} onRowClick={setSelected} />

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Patient History: {selected?.full_name}</DialogTitle></DialogHeader>
          {selected && (
            <Tabs defaultValue="visits" className="mt-4">
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="visits">Visits ({pVisits.length})</TabsTrigger>
                <TabsTrigger value="labs">Labs ({pLabs.length})</TabsTrigger>
                <TabsTrigger value="rx">Rx ({pRx.length})</TabsTrigger>
                <TabsTrigger value="vitals">Vitals ({pVitals.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="visits" className="space-y-3 max-h-96 overflow-y-auto">
                {pVisits.map(v => (
                  <div key={v.id} className="border rounded-lg p-3 text-sm">
                    <div className="flex justify-between"><span className="font-medium">{v.visit_date}</span><StatusBadge status={v.status} /></div>
                    {v.diagnosis && <p className="mt-1"><strong>Diagnosis:</strong> {v.diagnosis}</p>}
                    {v.treatment_plan && <p><strong>Treatment:</strong> {v.treatment_plan}</p>}
                    {v.final_diagnosis && <p className="text-emerald-600"><strong>Final:</strong> {v.final_diagnosis}</p>}
                  </div>
                ))}
                {pVisits.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No visits</p>}
              </TabsContent>
              <TabsContent value="labs" className="space-y-3 max-h-96 overflow-y-auto">
                {pLabs.map(o => (
                  <div key={o.id} className="border rounded-lg p-3 text-sm">
                    <div className="flex justify-between"><span className="font-medium">{o.test_type}</span><StatusBadge status={o.test_status} /></div>
                    {o.results && <p className="mt-1 bg-muted/50 rounded p-2">{o.results}</p>}
                  </div>
                ))}
                {pLabs.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No lab orders</p>}
              </TabsContent>
              <TabsContent value="rx" className="space-y-3 max-h-96 overflow-y-auto">
                {pRx.map(p => (
                  <div key={p.id} className="border rounded-lg p-3 text-sm">
                    <p className="font-medium">{p.medicine_name}</p>
                    <p className="text-muted-foreground">{p.dosage} - {p.frequency} - {p.duration}</p>
                  </div>
                ))}
                {pRx.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No prescriptions</p>}
              </TabsContent>
              <TabsContent value="vitals" className="space-y-3 max-h-96 overflow-y-auto">
                {pVitals.map(v => (
                  <div key={v.id} className="border rounded-lg p-3 text-sm grid grid-cols-3 gap-2">
                    <p>BP: {v.blood_pressure_systolic}/{v.blood_pressure_diastolic}</p>
                    <p>Temp: {v.temperature}°C</p>
                    <p>Pulse: {v.pulse}</p>
                    <p>SpO2: {v.oxygen_level}%</p>
                    <p>Weight: {v.weight}kg</p>
                    <p>Height: {v.height}cm</p>
                  </div>
                ))}
                {pVitals.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No vitals recorded</p>}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}