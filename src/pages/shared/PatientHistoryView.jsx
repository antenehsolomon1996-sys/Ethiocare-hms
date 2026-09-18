import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Stethoscope, FlaskConical, Pill, FileText, 
  Calendar, User, Phone, Clock, HeartPulse 
} from 'lucide-react';
import { format } from 'date-fns';

export default function PatientHistoryView({ patientId, patientName }) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['patientHistory', patientId],
    queryFn: () => base44.entities.PatientHistory.filter({ patient_id: patientId }, '-visit_date', 100),
    enabled: !!patientId
  });

  const { data: visits = [] } = useQuery({
    queryKey: ['patientVisits', patientId],
    queryFn: () => base44.entities.Visit.filter({ patient_id: patientId }, '-created_date', 50),
    enabled: !!patientId
  });

  const { data: labOrders = [] } = useQuery({
    queryKey: ['patientLabs', patientId],
    queryFn: () => base44.entities.LabOrder.filter({ patient_id: patientId }, '-created_date', 50),
    enabled: !!patientId
  });

  const { data: prescriptions = [] } = useQuery({
    queryKey: ['patientPrescriptions', patientId],
    queryFn: () => base44.entities.Prescription.filter({ patient_id: patientId }, '-created_date', 50),
    enabled: !!patientId
  });

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground text-sm">Loading patient history...</div>;
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="visits">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="visits"><Stethoscope className="w-3.5 h-3.5 mr-1" />Visits ({visits.length})</TabsTrigger>
          <TabsTrigger value="labs"><FlaskConical className="w-3.5 h-3.5 mr-1" />Labs ({labOrders.length})</TabsTrigger>
          <TabsTrigger value="prescriptions"><Pill className="w-3.5 h-3.5 mr-1" />Rx ({prescriptions.length})</TabsTrigger>
          <TabsTrigger value="history"><FileText className="w-3.5 h-3.5 mr-1" />History ({history.length})</TabsTrigger>
        </TabsList>

        {/* Visits Tab */}
        <TabsContent value="visits" className="space-y-3 mt-4">
          {visits.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">No visits recorded</p>
          ) : visits.map(v => (
            <Card key={v.id} className="border border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold">{v.visit_date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Dr. {v.assigned_doctor || 'N/A'}</span>
                  </div>
                </div>
                {v.symptoms && <InfoRow label="Symptoms" value={v.symptoms} />}
                {v.diagnosis && <InfoRow label="Diagnosis" value={v.diagnosis} highlight />}
                {v.disease && <InfoRow label="Disease" value={v.disease} />}
                {v.treatment_plan && <InfoRow label="Treatment" value={v.treatment_plan} />}
                {v.examination_notes && <InfoRow label="Notes" value={v.examination_notes} />}
                {v.final_diagnosis && (
                  <div className="mt-3 p-3 bg-primary/5 rounded-lg">
                    <p className="text-xs font-semibold text-primary mb-1">Final Diagnosis</p>
                    <p className="text-sm">{v.final_diagnosis}</p>
                    {v.final_treatment && <p className="text-xs text-muted-foreground mt-1">{v.final_treatment}</p>}
                  </div>
                )}
                {v.follow_up_date && (
                  <div className="flex items-center gap-2 mt-2 text-xs text-amber-600">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Follow-up: {v.follow_up_date}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Labs Tab */}
        <TabsContent value="labs" className="space-y-3 mt-4">
          {labOrders.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">No lab tests recorded</p>
          ) : labOrders.map(lab => (
            <Card key={lab.id} className="border border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-sm">{lab.test_type}</p>
                    {lab.test_name && <p className="text-xs text-muted-foreground">{lab.test_name}</p>}
                  </div>
                  <Badge className={
                    lab.test_status === 'completed' ? 'bg-green-100 text-green-700 text-xs' :
                    lab.test_status === 'pending' ? 'bg-amber-100 text-amber-700 text-xs' :
                    'bg-blue-100 text-blue-700 text-xs'
                  }>
                    {lab.test_status?.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">Dr. {lab.doctor_name} · {lab.created_date ? format(new Date(lab.created_date), 'MMM d, yyyy') : ''}</p>
                {lab.results && (
                  <div className="mt-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <p className="text-xs font-semibold text-emerald-700 mb-1">Results</p>
                    <p className="text-sm text-emerald-800">{lab.results}</p>
                    {lab.result_notes && <p className="text-xs text-emerald-600 mt-1">{lab.result_notes}</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Prescriptions Tab */}
        <TabsContent value="prescriptions" className="space-y-3 mt-4">
          {prescriptions.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">No prescriptions recorded</p>
          ) : prescriptions.map(rx => (
            <Card key={rx.id} className="border border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <p className="font-semibold text-sm">{rx.medicine_name}</p>
                  <Badge className={
                    rx.status === 'dispensed' ? 'bg-green-100 text-green-700 text-xs' :
                    rx.status === 'pending' ? 'bg-amber-100 text-amber-700 text-xs' :
                    'bg-gray-100 text-gray-600 text-xs'
                  }>
                    {rx.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  {rx.dosage && <span>Dose: {rx.dosage}</span>}
                  {rx.frequency && <span>Freq: {rx.frequency}</span>}
                  {rx.duration && <span>Duration: {rx.duration}</span>}
                </div>
                {rx.instructions && <p className="text-xs mt-2 text-muted-foreground italic">{rx.instructions}</p>}
                <p className="text-xs text-muted-foreground mt-2">Dr. {rx.doctor_name} · {rx.created_date ? format(new Date(rx.created_date), 'MMM d, yyyy') : ''}</p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Medical History Tab */}
        <TabsContent value="history" className="space-y-3 mt-4">
          {history.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">No centralized history records yet</p>
          ) : history.map(h => (
            <Card key={h.id} className="border border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <HeartPulse className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold">{h.visit_date}</span>
                  </div>
                  <Badge className="text-xs bg-primary/10 text-primary">{h.record_type}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-2">Dr. {h.doctor_name} {h.doctor_specialty ? `(${h.doctor_specialty})` : ''}</p>
                {h.symptoms && <InfoRow label="Symptoms" value={h.symptoms} />}
                {h.diagnosis && <InfoRow label="Diagnosis" value={h.diagnosis} highlight />}
                {h.treatment && <InfoRow label="Treatment" value={h.treatment} />}
                {h.prescription && <InfoRow label="Prescription" value={h.prescription} />}
                {h.lab_results && <InfoRow label="Lab Results" value={h.lab_results} />}
                {h.notes && <InfoRow label="Notes" value={h.notes} />}
                {(h.blood_pressure || h.temperature || h.weight || h.pulse) && (
                  <div className="mt-2 flex flex-wrap gap-3 text-xs">
                    {h.blood_pressure && <span className="bg-red-50 text-red-700 px-2 py-1 rounded">BP: {h.blood_pressure}</span>}
                    {h.temperature && <span className="bg-orange-50 text-orange-700 px-2 py-1 rounded">Temp: {h.temperature}</span>}
                    {h.weight && <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">Wt: {h.weight}</span>}
                    {h.pulse && <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded">Pulse: {h.pulse}</span>}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({ label, value, highlight }) {
  return (
    <div className="mb-1.5">
      <span className={`text-xs font-semibold ${highlight ? 'text-primary' : 'text-muted-foreground'}`}>{label}: </span>
      <span className={`text-sm ${highlight ? 'font-medium' : ''}`}>{value}</span>
    </div>
  );
}