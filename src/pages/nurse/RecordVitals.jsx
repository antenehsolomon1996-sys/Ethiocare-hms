import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { startOfDay } from 'date-fns';

export default function RecordVitals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedVisit, setSelectedVisit] = useState('');
  const [form, setForm] = useState({
    blood_pressure_systolic: '', blood_pressure_diastolic: '',
    temperature: '', pulse: '', weight: '', height: '', oxygen_level: '', nurse_notes: ''
  });

  const [isSaving, setIsSaving] = useState(false);

  const { data: visits = [] } = useQuery({ 
    queryKey: ['visits'], 
    queryFn: () => base44.entities.Visit.list('-created_date', 50) 
  });

  const activeVisits = visits.filter(v => v.status !== 'completed' && v.status !== 'cancelled');

  const handleSave = async () => {
    if (!selectedVisit) { toast.error('Please select a patient visit'); return; }
    const visit = activeVisits.find(v => v.id === selectedVisit);
    if (!visit) { toast.error('Selected visit not found'); return; }

    setIsSaving(true);
    try {
      await base44.entities.Vital.create({
        visit_id: selectedVisit,
        patient_id: visit.patient_id,
        patient_name: visit.patient_name,
        blood_pressure_systolic: form.blood_pressure_systolic ? parseFloat(form.blood_pressure_systolic) : null,
        blood_pressure_diastolic: form.blood_pressure_diastolic ? parseFloat(form.blood_pressure_diastolic) : null,
        temperature: form.temperature ? parseFloat(form.temperature) : null,
        pulse: form.pulse ? parseFloat(form.pulse) : null,
        weight: form.weight ? parseFloat(form.weight) : null,
        height: form.height ? parseFloat(form.height) : null,
        oxygen_level: form.oxygen_level ? parseFloat(form.oxygen_level) : null,
        nurse_notes: form.nurse_notes?.trim() || null,
        recorded_by: user?.full_name || 'Staff Nurse'
      });
      queryClient.invalidateQueries({ queryKey: ['vitals'] });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      toast.success('Vitals recorded successfully');
      setForm({ blood_pressure_systolic: '', blood_pressure_diastolic: '', temperature: '', pulse: '', weight: '', height: '', oxygen_level: '', nurse_notes: '' });
      setSelectedVisit('');
    } catch (err) {
      console.error('[RecordVitals] Error saving vitals:', err);
      toast.error(err.message || 'Failed to record vitals');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Record Vitals</h1>
      <Card>
        <CardHeader><CardTitle>Patient Vitals</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Select Patient Visit</Label>
            <Select value={selectedVisit} onValueChange={setSelectedVisit}>
              <SelectTrigger><SelectValue placeholder="Choose patient..." /></SelectTrigger>
              <SelectContent>
                {activeVisits.map(v => (
                  <SelectItem key={v.id} value={v.id}>#{v.queue_number} - {v.patient_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>BP Systolic (mmHg)</Label><Input type="number" value={form.blood_pressure_systolic} onChange={e => setForm({...form, blood_pressure_systolic: e.target.value})} /></div>
            <div><Label>BP Diastolic (mmHg)</Label><Input type="number" value={form.blood_pressure_diastolic} onChange={e => setForm({...form, blood_pressure_diastolic: e.target.value})} /></div>
            <div><Label>Temperature (°C)</Label><Input type="number" step="0.1" value={form.temperature} onChange={e => setForm({...form, temperature: e.target.value})} /></div>
            <div><Label>Pulse (bpm)</Label><Input type="number" value={form.pulse} onChange={e => setForm({...form, pulse: e.target.value})} /></div>
            <div><Label>Weight (kg)</Label><Input type="number" step="0.1" value={form.weight} onChange={e => setForm({...form, weight: e.target.value})} /></div>
            <div><Label>Height (cm)</Label><Input type="number" value={form.height} onChange={e => setForm({...form, height: e.target.value})} /></div>
            <div className="col-span-2"><Label>Oxygen Level (%)</Label><Input type="number" value={form.oxygen_level} onChange={e => setForm({...form, oxygen_level: e.target.value})} /></div>
          </div>
          <div><Label>Notes</Label><Textarea value={form.nurse_notes} onChange={e => setForm({...form, nurse_notes: e.target.value})} rows={3} /></div>
          <Button className="w-full" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving Vitals...' : 'Save Vitals'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}