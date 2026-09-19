import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import { historicalRecordService } from '@/services/historicalRecord.service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Stethoscope, FlaskConical, Pill, FileText, 
  Calendar, User, Phone, Clock, HeartPulse, Activity,
  ShieldCheck, PlusCircle, BookmarkCheck
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';

export default function PatientHistoryView({ 
  patientId, 
  patientName, 
  onAddHistorical,
  allowAddHistorical = false 
}) {
  const { data: history = [], isLoading: isLoadingHistory } = useQuery({
    queryKey: ['patientHistory', patientId],
    queryFn: () => ethioCareClient.entities.PatientHistory.filter({ patient_id: patientId }, '-visit_date', 100),
    enabled: !!patientId
  });

  const { data: visits = [], isLoading: isLoadingVisits } = useQuery({
    queryKey: ['patientVisits', patientId],
    queryFn: () => ethioCareClient.entities.Visit.filter({ patient_id: patientId }, '-created_date', 50),
    enabled: !!patientId
  });

  const { data: labOrders = [] } = useQuery({
    queryKey: ['patientLabs', patientId],
    queryFn: () => ethioCareClient.entities.LabOrder.filter({ patient_id: patientId }, '-created_date', 50),
    enabled: !!patientId
  });

  const { data: prescriptions = [] } = useQuery({
    queryKey: ['patientPrescriptions', patientId],
    queryFn: () => ethioCareClient.entities.Prescription.filter({ patient_id: patientId }, '-created_date', 50),
    enabled: !!patientId
  });

  const isLoading = isLoadingHistory || isLoadingVisits;

  // Format date helper
  const formatDateSafe = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = typeof dateStr === 'string' ? parseISO(dateStr.slice(0, 10)) : new Date(dateStr);
      return isValid(d) ? format(d, 'MMM dd, yyyy') : dateStr;
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground text-sm">Loading patient history...</div>;
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="history">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="history" className="text-xs">
            <Clock className="w-3.5 h-3.5 mr-1 text-primary" />
            Historical ({history.length})
          </TabsTrigger>
          <TabsTrigger value="visits" className="text-xs">
            <Stethoscope className="w-3.5 h-3.5 mr-1" />
            System Visits ({visits.length})
          </TabsTrigger>
          <TabsTrigger value="labs" className="text-xs">
            <FlaskConical className="w-3.5 h-3.5 mr-1" />
            Labs ({labOrders.length})
          </TabsTrigger>
          <TabsTrigger value="prescriptions" className="text-xs">
            <Pill className="w-3.5 h-3.5 mr-1" />
            Rx ({prescriptions.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Complete Historical Archive Records */}
        <TabsContent value="history" className="space-y-3.5 mt-4 focus-visible:outline-none">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-1 border-b border-border/50">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <BookmarkCheck className="w-3.5 h-3.5 text-primary" />
                Pre-EthioCare HMS Archive Records
              </p>
              <p className="text-[11px] text-muted-foreground">
                Preserved historical treatments, attending doctors, diagnoses, lab tests, nursing notes, and medications.
              </p>
            </div>
            {allowAddHistorical && onAddHistorical && (
              <Button 
                size="sm" 
                variant="outline" 
                className="text-xs h-8 gap-1.5 border-primary/30 hover:bg-primary/5 text-primary"
                onClick={onAddHistorical}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Add Historical Record
              </Button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="text-center py-8 bg-card/60 border border-dashed border-border rounded-xl p-6">
              <Clock className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm font-semibold text-foreground">No historical archive records recorded</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Reception can manually enter previous hospital treatments from paper charts using the "Add Historical Record" button.
              </p>
              {allowAddHistorical && onAddHistorical && (
                <Button 
                  size="sm" 
                  className="mt-3 text-xs gap-1.5"
                  onClick={onAddHistorical}
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Add Historical Record Now
                </Button>
              )}
            </div>
          ) : history.map((h) => {
            const isHistorical = historicalRecordService.isHistoricalRecord(h);

            return (
              <Card 
                key={h.id} 
                className={`border transition-all duration-200 shadow-sm ${
                  isHistorical 
                    ? 'border-primary/30 bg-gradient-to-br from-card to-primary/[0.02]' 
                    : 'border-border bg-card'
                }`}
              >
                <CardContent className="p-4 sm:p-5 space-y-3.5">
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/60">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">
                            {formatDateSafe(h.visit_date)}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            ({h.visit_date})
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <User className="w-3 h-3 text-primary" />
                          <span>Attending: <strong>Dr. {h.doctor_name}</strong></span>
                          {h.doctor_specialty && (
                            <span className="text-muted-foreground/80">({h.doctor_specialty})</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isHistorical ? (
                        <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-[11px] font-medium px-2.5 py-0.5">
                          Historical Record
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs capitalize">
                          {h.record_type || 'Visit'}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Clinical Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {h.diagnosis && (
                      <div className="md:col-span-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                        <span className="font-bold text-primary block text-xs mb-1">Diagnosis & Condition:</span>
                        <p className="text-sm font-medium text-foreground">{h.diagnosis}</p>
                      </div>
                    )}

                    {h.symptoms && (
                      <div className="p-2.5 bg-muted/30 rounded-lg border border-border/50">
                        <span className="font-semibold text-muted-foreground block text-[11px] mb-0.5">Symptoms & Complaints:</span>
                        <p className="text-foreground leading-relaxed">{h.symptoms}</p>
                      </div>
                    )}

                    {h.treatment && (
                      <div className="p-2.5 bg-muted/30 rounded-lg border border-border/50">
                        <span className="font-semibold text-muted-foreground block text-[11px] mb-0.5">Treatment & Clinical Plan:</span>
                        <p className="text-foreground leading-relaxed">{h.treatment}</p>
                      </div>
                    )}

                    {h.lab_results && (
                      <div className="p-2.5 bg-teal-500/5 rounded-lg border border-teal-500/20">
                        <span className="font-semibold text-teal-700 dark:text-teal-400 flex items-center gap-1 text-[11px] mb-0.5">
                          <FlaskConical className="w-3 h-3" /> Lab Tests & Results:
                        </span>
                        <p className="text-foreground whitespace-pre-line leading-relaxed font-mono text-[11px]">
                          {h.lab_results}
                        </p>
                      </div>
                    )}

                    {h.prescription && (
                      <div className="p-2.5 bg-blue-500/5 rounded-lg border border-blue-500/20">
                        <span className="font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1 text-[11px] mb-0.5">
                          <Pill className="w-3 h-3" /> Medicines / Medications Given:
                        </span>
                        <p className="text-foreground whitespace-pre-line leading-relaxed font-mono text-[11px]">
                          {h.prescription}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Notes / Reports */}
                  {h.notes && (
                    <div className="text-xs p-2.5 bg-muted/20 rounded-lg border border-border/40 text-muted-foreground whitespace-pre-line leading-relaxed">
                      {h.notes}
                    </div>
                  )}

                  {/* Vitals Bar if Present */}
                  {(h.blood_pressure || h.temperature || h.weight || h.pulse) && (
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                      <span className="text-muted-foreground font-semibold flex items-center gap-1 mr-1">
                        <Activity className="w-3 h-3 text-rose-500" /> Historical Vitals:
                      </span>
                      {h.blood_pressure && (
                        <span className="bg-rose-500/10 text-rose-700 dark:text-rose-400 px-2 py-0.5 rounded font-mono">
                          BP: {h.blood_pressure}
                        </span>
                      )}
                      {h.temperature && (
                        <span className="bg-orange-500/10 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded font-mono">
                          Temp: {h.temperature}
                        </span>
                      )}
                      {h.pulse && (
                        <span className="bg-purple-500/10 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded font-mono">
                          Pulse: {h.pulse}
                        </span>
                      )}
                      {h.weight && (
                        <span className="bg-blue-500/10 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded font-mono">
                          Wt: {h.weight}
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* TAB 2: System Visits */}
        <TabsContent value="visits" className="space-y-3 mt-4 focus-visible:outline-none">
          {visits.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">No digital system visits recorded yet</p>
          ) : visits.map(v => (
            <Card key={v.id} className="border border-border">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold">{formatDateSafe(v.visit_date)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Dr. {v.assigned_doctor || 'Unassigned'}</span>
                  </div>
                </div>
                {v.symptoms && <InfoRow label="Symptoms" value={v.symptoms} />}
                {v.diagnosis && <InfoRow label="Diagnosis" value={v.diagnosis} highlight />}
                {v.disease && <InfoRow label="Disease" value={v.disease} />}
                {v.treatment_plan && <InfoRow label="Treatment" value={v.treatment_plan} />}
                {v.examination_notes && <InfoRow label="Notes" value={v.examination_notes} />}
                {v.final_diagnosis && (
                  <div className="mt-2 p-2.5 bg-primary/5 rounded-lg">
                    <p className="text-xs font-semibold text-primary mb-1">Final Diagnosis</p>
                    <p className="text-sm">{v.final_diagnosis}</p>
                    {v.final_treatment && <p className="text-xs text-muted-foreground mt-1">{v.final_treatment}</p>}
                  </div>
                )}
                {v.follow_up_date && (
                  <div className="flex items-center gap-2 mt-1 text-xs text-amber-600">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Follow-up: {v.follow_up_date}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* TAB 3: Labs */}
        <TabsContent value="labs" className="space-y-3 mt-4 focus-visible:outline-none">
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
                <p className="text-xs text-muted-foreground">Dr. {lab.doctor_name} · {formatDateSafe(lab.created_date || lab.created_at)}</p>
                {lab.results && (
                  <div className="mt-3 p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">Results</p>
                    <p className="text-sm text-foreground">{lab.results}</p>
                    {lab.result_notes && <p className="text-xs text-muted-foreground mt-1">{lab.result_notes}</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* TAB 4: Prescriptions */}
        <TabsContent value="prescriptions" className="space-y-3 mt-4 focus-visible:outline-none">
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
                <p className="text-xs text-muted-foreground mt-2">Dr. {rx.doctor_name} · {formatDateSafe(rx.created_date || rx.created_at)}</p>
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