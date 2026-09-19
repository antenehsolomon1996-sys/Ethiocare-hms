import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import { historicalRecordService, HISTORICAL_RECORD_TAG } from '@/services/historicalRecord.service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Stethoscope, FlaskConical, Pill, FileText, 
  Calendar, User, Phone, Clock, HeartPulse, Activity,
  ShieldCheck, PlusCircle, BookmarkCheck, Pencil, BookOpen, AlertCircle
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';

export default function PatientHistoryView({ 
  patientId, 
  patientName, 
  onAddHistorical,
  onEditHistorical,
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

  // Extract audit digitizer line if available
  const getAuditInfo = (record) => {
    if (record.digitized_by) {
      const datePart = record.digitized_at ? formatDateSafe(record.digitized_at) : '';
      return `Digitized by ${record.digitized_by}${datePart ? ` on ${datePart}` : ''}`;
    }
    if (typeof record.notes === 'string') {
      const match = record.notes.match(/Digitized (?:From Paper Chart|Paper Record)?:? ([^\n]+)/i);
      if (match) {
        return match[0].replace(HISTORICAL_RECORD_TAG, '').trim();
      }
    }
    return null;
  };

  // Separate paper records vs general history
  const paperRecords = useMemo(() => {
    return history.filter(h => historicalRecordService.isHistoricalRecord(h));
  }, [history]);

  // Combine history records and system visits into a unified chronological timeline
  const chronologicalHistory = useMemo(() => {
    const list = [];

    history.forEach(h => {
      const isHistorical = historicalRecordService.isHistoricalRecord(h);
      list.push({
        kind: isHistorical ? 'paper' : 'historical_entry',
        id: h.id,
        rawDate: h.visit_date || h.created_at,
        displayDate: h.visit_date,
        doctor: h.doctor_name,
        specialty: h.doctor_specialty,
        diagnosis: h.diagnosis,
        symptoms: h.symptoms,
        treatment: h.treatment,
        prescription: h.prescription,
        lab_results: h.lab_results,
        notes: h.notes,
        blood_pressure: h.blood_pressure,
        temperature: h.temperature,
        pulse: h.pulse,
        weight: h.weight,
        auditInfo: getAuditInfo(h),
        rawRecord: h
      });
    });

    visits.forEach(v => {
      const dateStr = v.visit_date || (v.created_date ? v.created_date.slice(0, 10) : v.created_at);
      list.push({
        kind: 'system_visit',
        id: v.id,
        rawDate: dateStr,
        displayDate: dateStr,
        doctor: v.assigned_doctor,
        queue_number: v.queue_number,
        status: v.status,
        diagnosis: v.diagnosis,
        symptoms: v.symptoms,
        notes: v.doctor_notes || v.notes,
        rawRecord: v
      });
    });

    // Sort newest to oldest
    list.sort((a, b) => {
      const timeA = a.rawDate ? new Date(a.rawDate).getTime() : 0;
      const timeB = b.rawDate ? new Date(b.rawDate).getTime() : 0;
      return timeB - timeA;
    });

    return list;
  }, [history, visits]);

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground text-sm">Loading patient medical history...</div>;
  }

  // Render an individual paper/historical record card
  const renderPaperRecordCard = (h, key) => {
    const isHistorical = historicalRecordService.isHistoricalRecord(h);
    const auditText = getAuditInfo(h);

    return (
      <Card 
        key={key || h.id} 
        className="border border-amber-500/30 bg-gradient-to-br from-card via-card to-amber-500/[0.03] shadow-sm transition-all"
      >
        <CardContent className="p-4 sm:p-5 space-y-3.5">
          {/* Card Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0">
                <BookOpen className="w-4 h-4" />
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
                  <User className="w-3 h-3 text-amber-600" />
                  <span>Attending: <strong>Dr. {h.doctor_name}</strong></span>
                  {h.doctor_specialty && (
                    <span className="text-muted-foreground/80">({h.doctor_specialty})</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge className="bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-[11px] font-semibold px-2.5 py-0.5 gap-1">
                <BookOpen className="w-3 h-3" />
                Historical / Paper Record
              </Badge>

              {allowAddHistorical && onEditHistorical && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  onClick={() => onEditHistorical(h)}
                >
                  <Pencil className="w-3 h-3" />
                  Edit
                </Button>
              )}
            </div>
          </div>

          {/* Audit Trail Banner */}
          {auditText && (
            <div className="text-[11px] text-muted-foreground bg-muted/30 px-2.5 py-1 rounded flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{auditText}</span>
            </div>
          )}

          {/* Clinical Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {h.diagnosis && (
              <div className="md:col-span-2 p-3 bg-amber-500/5 rounded-lg border border-amber-500/20">
                <span className="font-bold text-amber-800 dark:text-amber-300 block text-xs mb-1">
                  Diagnosis & Condition from Paper Chart:
                </span>
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
                  <Pill className="w-3 h-3" /> Medicines / Medications Prescribed:
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
                  Weight: {h.weight}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Render an individual system visit card
  const renderSystemVisitCard = (v, key) => (
    <Card key={key || v.id} className="border border-border bg-card shadow-sm">
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Stethoscope className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">
                  {formatDateSafe(v.visit_date || v.created_date || v.created_at)}
                </span>
                {v.queue_number && (
                  <Badge variant="outline" className="text-[10px] font-mono">
                    Queue #{v.queue_number}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Doctor: <strong>Dr. {v.assigned_doctor || 'Assigned Physician'}</strong>
              </p>
            </div>
          </div>

          <Badge variant="secondary" className="text-xs capitalize">
            {v.status || 'System Visit'}
          </Badge>
        </div>

        {v.diagnosis && (
          <div className="text-xs p-2.5 bg-primary/5 rounded-lg border border-primary/20">
            <span className="font-semibold text-primary block text-[11px] mb-0.5">Clinical Diagnosis:</span>
            <p className="text-foreground font-medium">{v.diagnosis}</p>
          </div>
        )}

        {v.symptoms && (
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Symptoms: </span>
            {v.symptoms}
          </div>
        )}

        {(v.doctor_notes || v.notes) && (
          <div className="text-xs p-2.5 bg-muted/20 rounded-lg text-muted-foreground whitespace-pre-line">
            {v.doctor_notes || v.notes}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <Tabs defaultValue="timeline">
        <TabsList className="w-full grid grid-cols-2 sm:grid-cols-5 h-auto p-1 gap-1">
          <TabsTrigger value="timeline" className="text-xs py-2">
            <Calendar className="w-3.5 h-3.5 mr-1 text-primary" />
            Chronological ({chronologicalHistory.length})
          </TabsTrigger>
          <TabsTrigger value="paper" className="text-xs py-2">
            <BookOpen className="w-3.5 h-3.5 mr-1 text-amber-600" />
            Paper Records ({paperRecords.length})
          </TabsTrigger>
          <TabsTrigger value="visits" className="text-xs py-2">
            <Stethoscope className="w-3.5 h-3.5 mr-1" />
            System Visits ({visits.length})
          </TabsTrigger>
          <TabsTrigger value="labs" className="text-xs py-2">
            <FlaskConical className="w-3.5 h-3.5 mr-1" />
            Labs ({labOrders.length})
          </TabsTrigger>
          <TabsTrigger value="prescriptions" className="text-xs py-2">
            <Pill className="w-3.5 h-3.5 mr-1" />
            Rx ({prescriptions.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Complete Unified Chronological Timeline (Paper + System Visits) */}
        <TabsContent value="timeline" className="space-y-3.5 mt-4 focus-visible:outline-none">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-1 border-b border-border/50">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                Complete Chronological Medical History
              </p>
              <p className="text-[11px] text-muted-foreground">
                Historical paper files and electronic visits arranged chronologically by treatment date.
              </p>
            </div>
            {allowAddHistorical && onAddHistorical && (
              <Button 
                size="sm" 
                variant="outline" 
                className="text-xs h-8 gap-1.5 border-amber-500/30 hover:bg-amber-500/10 text-amber-700 dark:text-amber-400"
                onClick={onAddHistorical}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Import Paper History
              </Button>
            )}
          </div>

          {chronologicalHistory.length === 0 ? (
            <div className="text-center py-8 bg-card/60 border border-dashed border-border rounded-xl p-6">
              <Calendar className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm font-semibold text-foreground">No medical history recorded yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Reception can digitize prior paper chart visits using the "Import Paper History" button.
              </p>
              {allowAddHistorical && onAddHistorical && (
                <Button 
                  size="sm" 
                  className="mt-3 text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={onAddHistorical}
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Import Paper History Now
                </Button>
              )}
            </div>
          ) : (
            chronologicalHistory.map(item => {
              if (item.kind === 'paper') {
                return renderPaperRecordCard(item.rawRecord, `chronological-${item.id}`);
              }
              return renderSystemVisitCard(item.rawRecord, `chronological-${item.id}`);
            })
          )}
        </TabsContent>

        {/* TAB 2: Historical Paper Records Only */}
        <TabsContent value="paper" className="space-y-3.5 mt-4 focus-visible:outline-none">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-1 border-b border-border/50">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                Digitized Historical / Paper Records ({paperRecords.length})
              </p>
              <p className="text-[11px] text-muted-foreground">
                Preserved pre-EthioCare hospital paper files, original physicians, diagnoses, and treatments.
              </p>
            </div>
            {allowAddHistorical && onAddHistorical && (
              <Button 
                size="sm" 
                variant="outline" 
                className="text-xs h-8 gap-1.5 border-amber-500/30 hover:bg-amber-500/10 text-amber-700 dark:text-amber-400"
                onClick={onAddHistorical}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Import Paper History
              </Button>
            )}
          </div>

          {paperRecords.length === 0 ? (
            <div className="text-center py-8 bg-card/60 border border-dashed border-border rounded-xl p-6">
              <BookOpen className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm font-semibold text-foreground">No paper records digitized for this patient</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                If this patient was treated before EthioCare HMS existed, digitize their paper files here.
              </p>
              {allowAddHistorical && onAddHistorical && (
                <Button 
                  size="sm" 
                  className="mt-3 text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={onAddHistorical}
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Import Paper History
                </Button>
              )}
            </div>
          ) : (
            paperRecords.map(h => renderPaperRecordCard(h, `paper-${h.id}`))
          )}
        </TabsContent>

        {/* TAB 3: System Visits */}
        <TabsContent value="visits" className="space-y-3 mt-4 focus-visible:outline-none">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 pb-1 border-b border-border/50">
            <Stethoscope className="w-3.5 h-3.5 text-primary" />
            EthioCare HMS Electronic Visits ({visits.length})
          </p>

          {visits.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs bg-card/60 border border-dashed border-border rounded-xl">
              No electronic hospital visits recorded in EthioCare HMS yet.
            </div>
          ) : (
            visits.map(v => renderSystemVisitCard(v, `visit-${v.id}`))
          )}
        </TabsContent>

        {/* TAB 4: Lab Orders */}
        <TabsContent value="labs" className="space-y-3 mt-4 focus-visible:outline-none">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 pb-1 border-b border-border/50">
            <FlaskConical className="w-3.5 h-3.5 text-primary" />
            Electronic Lab Orders & Results ({labOrders.length})
          </p>

          {labOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs bg-card/60 border border-dashed border-border rounded-xl">
              No lab orders recorded yet.
            </div>
          ) : (
            labOrders.map(lab => (
              <Card key={lab.id} className="border border-border">
                <CardContent className="p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-foreground">{lab.test_name}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">{lab.status}</Badge>
                  </div>
                  {lab.result_summary && (
                    <p className="text-xs font-mono bg-muted/30 p-2 rounded text-foreground">{lab.result_summary}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground">Ordered: {formatDateSafe(lab.order_date || lab.created_date || lab.created_at)}</p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* TAB 5: Prescriptions */}
        <TabsContent value="prescriptions" className="space-y-3 mt-4 focus-visible:outline-none">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 pb-1 border-b border-border/50">
            <Pill className="w-3.5 h-3.5 text-primary" />
            Electronic Prescriptions ({prescriptions.length})
          </p>

          {prescriptions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs bg-card/60 border border-dashed border-border rounded-xl">
              No electronic prescriptions recorded yet.
            </div>
          ) : (
            prescriptions.map(rx => (
              <Card key={rx.id} className="border border-border">
                <CardContent className="p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-foreground">{rx.medication_name}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">{rx.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{rx.dosage} · {rx.frequency} · {rx.duration}</p>
                  <p className="text-[11px] text-muted-foreground">Dr. {rx.doctor_name} · {formatDateSafe(rx.created_date || rx.created_at)}</p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}