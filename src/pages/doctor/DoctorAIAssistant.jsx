import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import { useDoctorContext } from '@/lib/DoctorContext';
import AIClinicalAssistant from '@/components/doctor/AIClinicalAssistant';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, User, Stethoscope, RefreshCw, Info, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function DoctorAIAssistant() {
  const { selectedDoctor } = useDoctorContext();
  const [selectedVisitId, setSelectedVisitId] = useState('');

  // Fetch active doctor visits / queue
  const { data: visits = [], isLoading, refetch } = useQuery({
    queryKey: ['doctor-ai-visits'],
    queryFn: () => ethioCareClient.entities.Visit.list('-created_date', 100),
  });

  const activeVisit = visits.find(v => v.id === selectedVisitId);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Sparkles className="w-6 h-6 text-primary" />
            AI Clinical Decision Support Assistant
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            EthioCare clinical reasoning engine calibrated against Ethiopian Standard Treatment Guidelines (STG).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Queue
          </Button>
        </div>
      </div>

      {/* Patient Selector Bar */}
      <Card className="border-border/60 shadow-xs">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary" />
                Select Patient from Queue or Consultation (Optional):
              </label>
              <p className="text-[11px] text-muted-foreground">
                Load symptoms, vitals, and physical findings directly into the AI diagnostic evaluator.
              </p>
            </div>
            <div className="min-w-[280px]">
              <Select value={selectedVisitId} onValueChange={setSelectedVisitId}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="-- Select Patient from Queue --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ad_hoc">Free-form / General Diagnostic Inquiry</SelectItem>
                  {visits.filter(v => v.registration_fee_paid === true).slice(0, 30).map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.patient_name || 'Patient'} ({v.age || '?'}yo {v.gender || ''}) — #{v.queue_number || 'N/A'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main AI Clinical Assistant Component */}
      <AIClinicalAssistant
        patient={
          activeVisit
            ? {
                full_name: activeVisit.patient_name,
                age: activeVisit.age || 35,
                gender: activeVisit.gender || 'Unknown',
              }
            : {
                full_name: 'Clinical Case Evaluation',
                age: 35,
                gender: 'Female',
              }
        }
        visit={
          activeVisit
            ? {
                ...activeVisit,
                symptoms: activeVisit.symptoms || '',
                examination_notes: activeVisit.examination_notes || '',
                diagnosis: activeVisit.diagnosis || '',
              }
            : {
                symptoms: 'High fever, acute productive cough with rust-colored sputum for 3 days, pleuritic right-sided chest pain.',
                examination_notes: 'Right lower lobe bronchial breathing and crackles. SpO2 93% on room air.',
                diagnosis: 'Suspected Community-Acquired Pneumonia',
              }
        }
        onApplyNotes={(soapDraft, primaryDiff) => {
          toast.success('Clinical analysis copied to clipboard & drafted!', {
            description: primaryDiff ? `Primary impression: ${primaryDiff}` : undefined,
          });
        }}
      />
    </div>
  );
}
