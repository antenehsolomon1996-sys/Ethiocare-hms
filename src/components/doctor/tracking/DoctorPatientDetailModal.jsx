import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  User,
  Phone,
  Calendar,
  Clock,
  MapPin,
  Stethoscope,
  FlaskConical,
  Syringe,
  Pill,
  Receipt,
  FileText,
  Activity,
  History,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Printer,
  X
} from 'lucide-react';
import PatientJourneyTimeline from './PatientJourneyTimeline';
import PatientHistoryView from '@/pages/shared/PatientHistoryView';
import StatusBadge from '@/components/common/StatusBadge';

export default function DoctorPatientDetailModal({
  patient,
  isOpen,
  onClose
}) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  if (!patient) return null;

  const child = patient.childRecords || {};
  const labs = child.labs || [];
  const medOrders = child.medOrders || [];
  const nurseTasks = child.nurseTasks || [];
  const prescriptions = child.prescriptions || [];
  const payments = child.payments || [];
  const vitals = child.vitals || [];

  const handleOpenInQueue = () => {
    onClose();
    navigate(`/doctor/queue?visit=${patient.id}`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Modal Header */}
        <DialogHeader className="p-5 pb-3 border-b bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0">
                {patient.queue_number ? `#${patient.queue_number}` : <User className="w-6 h-6" />}
              </div>
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  {patient.patient_full_name || patient.patient_name}
                  {patient.patient_age && (
                    <span className="text-sm font-normal text-muted-foreground">({patient.patient_age} yrs, {patient.patient_gender || 'N/A'})</span>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground flex flex-wrap items-center gap-2 mt-1">
                  <span>ID: <strong className="text-foreground">{patient.patient_id}</strong></span>
                  <span>·</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Visit: {patient.visit_date}</span>
                  {patient.patient_phone && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {patient.patient_phone}</span>
                    </>
                  )}
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <Badge className="bg-primary text-primary-foreground font-semibold px-3 py-1 text-xs">
                {patient.currentStage.label}
              </Badge>
              <Badge variant="outline" className="text-xs flex items-center gap-1 bg-card">
                <MapPin className="w-3 h-3 text-primary" />
                {patient.currentStage.room}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Modal Body with Tabs */}
        <div className="flex-1 overflow-y-auto p-5">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid grid-cols-3 sm:grid-cols-7 h-auto p-1 bg-muted/60">
              <TabsTrigger value="overview" className="text-xs py-1.5">Overview</TabsTrigger>
              <TabsTrigger value="clinical" className="text-xs py-1.5">Clinical Notes</TabsTrigger>
              <TabsTrigger value="labs" className="text-xs py-1.5 flex items-center gap-1">
                Labs {labs.length > 0 && <span className="bg-primary/20 text-primary px-1.5 rounded-full text-[10px]">{labs.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="nurse" className="text-xs py-1.5 flex items-center gap-1">
                Nursing {(medOrders.length + nurseTasks.length) > 0 && <span className="bg-primary/20 text-primary px-1.5 rounded-full text-[10px]">{medOrders.length + nurseTasks.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="prescriptions" className="text-xs py-1.5 flex items-center gap-1">
                Rx {prescriptions.length > 0 && <span className="bg-primary/20 text-primary px-1.5 rounded-full text-[10px]">{prescriptions.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="billing" className="text-xs py-1.5 flex items-center gap-1">
                Billing {payments.length > 0 && <span className="bg-primary/20 text-primary px-1.5 rounded-full text-[10px]">{payments.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs py-1.5">History</TabsTrigger>
            </TabsList>

            {/* TAB 1: OVERVIEW & JOURNEY */}
            <TabsContent value="overview" className="space-y-5 mt-0">
              {/* Patient Stage Journey */}
              <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-primary" />
                    Patient Journey & Hospital Stage Progress
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    Last activity: <strong>{patient.lastActivityTime.relative}</strong> ({patient.lastActivityTime.formatted})
                  </span>
                </div>
                <PatientJourneyTimeline timeline={patient.stageTimeline} currentStageId={patient.currentStage.id} />
              </div>

              {/* Status & Next Step Callout Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                      Currently Waiting On
                    </h4>
                  </div>
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                    {patient.waitingOn || 'No pending bottlenecks.'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Department: <strong>{patient.currentStage.department}</strong> · Room: <strong>{patient.currentStage.room}</strong>
                  </p>
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <h4 className="text-xs font-bold text-primary uppercase tracking-wider">
                      Next Required Step
                    </h4>
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {patient.nextStep || 'Consultation in progress.'}
                  </p>
                  {patient.isOngoing && patient.daysOngoing > 0 && (
                    <Badge variant="outline" className="mt-2 text-[11px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300">
                      Ongoing visit · Started {patient.daysOngoing} day{patient.daysOngoing > 1 ? 's' : ''} ago
                    </Badge>
                  )}
                </div>
              </div>

              {/* Patient Quick Info & Completed Milestones */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border rounded-xl p-4 bg-card space-y-2">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Patient Profile</h4>
                  <div className="text-xs space-y-1">
                    <p><span className="text-muted-foreground">Blood Group:</span> <strong>{patient.patient_blood_group || 'Not recorded'}</strong></p>
                    <p><span className="text-muted-foreground">Registration:</span> {patient.registration_fee_paid ? <Badge className="text-[10px] bg-emerald-100 text-emerald-800">Paid (150 ETB)</Badge> : <Badge className="text-[10px] bg-amber-100 text-amber-800">Unpaid</Badge>}</p>
                    <p><span className="text-muted-foreground">Assigned Doctor:</span> <strong>{patient.assigned_doctor || 'Self'}</strong></p>
                  </div>
                </div>

                <div className="border rounded-xl p-4 bg-card md:col-span-2 space-y-2">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Completed Milestones in this Visit</h4>
                  {patient.completedItems?.length > 0 ? (
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                      {patient.completedItems.map((item, i) => (
                        <li key={i} className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">No clinical milestones completed yet.</p>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: CLINICAL NOTES */}
            <TabsContent value="clinical" className="space-y-4 mt-0">
              <div className="border rounded-2xl p-4 bg-card space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Chief Symptoms & Presentation</h4>
                  <p className="text-sm bg-muted/30 p-3 rounded-xl whitespace-pre-wrap">
                    {patient.symptoms || 'No symptoms recorded.'}
                  </p>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Clinical Examination Notes</h4>
                  <p className="text-sm bg-muted/30 p-3 rounded-xl whitespace-pre-wrap">
                    {patient.examination_notes || 'No physical examination notes recorded yet.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Working Diagnosis</h4>
                    <p className="text-sm font-semibold text-primary bg-primary/5 p-3 rounded-xl">
                      {patient.diagnosis || 'Diagnosis pending.'}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Disease Classification</h4>
                    <p className="text-sm font-medium bg-muted/30 p-3 rounded-xl">
                      {patient.disease || 'Unspecified'}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Initial Treatment Plan</h4>
                  <p className="text-sm bg-muted/30 p-3 rounded-xl whitespace-pre-wrap">
                    {patient.treatment_plan || 'No initial treatment plan recorded.'}
                  </p>
                </div>

                {(patient.final_diagnosis || patient.final_treatment) && (
                  <div className="border-t pt-4 space-y-3 bg-emerald-50/40 dark:bg-emerald-950/20 p-3 rounded-xl border-emerald-200">
                    <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                      Finalized Clinical Assessment & Outcome
                    </h4>
                    {patient.final_diagnosis && (
                      <p className="text-sm"><strong>Final Diagnosis:</strong> {patient.final_diagnosis}</p>
                    )}
                    {patient.final_treatment && (
                      <p className="text-sm"><strong>Final Treatment:</strong> {patient.final_treatment}</p>
                    )}
                    {patient.follow_up_date && (
                      <Badge className="bg-emerald-600 text-white">
                        Follow-up scheduled: {patient.follow_up_date}
                      </Badge>
                    )}
                    {patient.follow_up_notes && (
                      <p className="text-xs text-muted-foreground">Notes: {patient.follow_up_notes}</p>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TAB 3: DIAGNOSTIC LABS */}
            <TabsContent value="labs" className="space-y-4 mt-0">
              <div className="border rounded-2xl p-4 bg-card">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-purple-600" />
                    Laboratory Orders ({labs.length})
                  </h3>
                </div>

                {labs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No laboratory orders placed for this visit.</p>
                ) : (
                  <div className="space-y-3">
                    {labs.map((order) => (
                      <div key={order.id} className="border rounded-xl p-3.5 bg-muted/10 space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-sm">{order.test_name || order.test_type}</p>
                            <p className="text-xs text-muted-foreground">
                              Category: {order.test_type} · Price: {order.price || 0} ETB · Ordered: {order.created_at?.slice(0, 16).replace('T', ' ')}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={order.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>
                              Payment: {order.payment_status || 'pending'}
                            </Badge>
                            <StatusBadge status={order.test_status} />
                          </div>
                        </div>

                        {order.notes && (
                          <p className="text-xs text-muted-foreground"><strong>Clinical Notes:</strong> {order.notes}</p>
                        )}

                        {order.results ? (
                          <div className="mt-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
                            <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase mb-1">
                              Verified Results / Findings:
                            </p>
                            <p className="text-sm whitespace-pre-wrap font-mono text-emerald-950 dark:text-emerald-100">
                              {order.results}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-amber-700 dark:text-amber-400 italic">
                            ⏳ Results pending laboratory analysis.
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TAB 4: NURSING & PROCEDURES */}
            <TabsContent value="nurse" className="space-y-4 mt-0">
              <div className="border rounded-2xl p-4 bg-card space-y-4">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
                    <Syringe className="w-4 h-4 text-pink-600" />
                    Medication Orders & Injections ({medOrders.length})
                  </h3>
                  {medOrders.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No nursing medication orders.</p>
                  ) : (
                    <div className="space-y-2">
                      {medOrders.map(mo => (
                        <div key={mo.id} className="border rounded-xl p-3 bg-muted/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-sm">{mo.item_name || mo.medication_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {[mo.dosage, mo.frequency, mo.duration].filter(Boolean).join(' · ')}
                            </p>
                            {mo.instructions && <p className="text-xs text-muted-foreground mt-0.5">Note: {mo.instructions}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={mo.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>
                              Payment: {mo.payment_status}
                            </Badge>
                            <Badge className={mo.administration_status === 'completed' ? 'bg-emerald-600 text-white' : 'bg-blue-100 text-blue-800'}>
                              Admin: {mo.administration_status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
                    <Activity className="w-4 h-4 text-teal-600" />
                    Nursing Tasks & Care Procedures ({nurseTasks.length})
                  </h3>
                  {nurseTasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No specific nursing tasks assigned.</p>
                  ) : (
                    <div className="space-y-2">
                      {nurseTasks.map(t => (
                        <div key={t.id} className="border rounded-xl p-3 bg-muted/10 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-sm">{t.task_type || 'Care Task'}</p>
                            <p className="text-xs text-muted-foreground">{t.description || t.notes}</p>
                          </div>
                          <StatusBadge status={t.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* TAB 5: PRESCRIPTIONS & PHARMACY */}
            <TabsContent value="prescriptions" className="space-y-4 mt-0">
              <div className="border rounded-2xl p-4 bg-card">
                <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
                  <Pill className="w-4 h-4 text-green-600" />
                  Prescriptions for Pharmacy ({prescriptions.length})
                </h3>
                {prescriptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No outpatient prescriptions for this visit.</p>
                ) : (
                  <div className="space-y-2">
                    {prescriptions.map(rx => (
                      <div key={rx.id} className="border rounded-xl p-3.5 bg-muted/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm">{rx.medicine_name} <span className="text-xs text-muted-foreground font-normal">({rx.dosage})</span></p>
                          <p className="text-xs text-muted-foreground">
                            {rx.frequency} for {rx.duration} · Qty: {rx.quantity || 1} · {rx.unit_price ? `${rx.unit_price * (rx.quantity || 1)} ETB` : ''}
                          </p>
                          {rx.instructions && <p className="text-xs text-foreground/80 mt-1">Instructions: {rx.instructions}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={rx.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>
                            Payment: {rx.payment_status || 'pending'}
                          </Badge>
                          <Badge className={rx.status === 'dispensed' ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-800'}>
                            Dispense: {rx.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TAB 6: BILLING & INVOICES */}
            <TabsContent value="billing" className="space-y-4 mt-0">
              <div className="border rounded-2xl p-4 bg-card">
                <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
                  <Receipt className="w-4 h-4 text-amber-600" />
                  Billing Invoices & Payments ({payments.length})
                </h3>
                {payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No billing records found for this visit.</p>
                ) : (
                  <div className="space-y-2">
                    {payments.map(pm => (
                      <div key={pm.id} className="border rounded-xl p-3 bg-muted/10 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm">{pm.description || pm.payment_type}</p>
                          <p className="text-xs text-muted-foreground">
                            Category: {pm.payment_type} {pm.receipt_number ? `· Receipt: ${pm.receipt_number}` : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-sm">{pm.amount} ETB</p>
                          <Badge className={pm.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>
                            {pm.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TAB 7: PREVIOUS VISITS HISTORY */}
            <TabsContent value="history" className="space-y-4 mt-0">
              <div className="border rounded-2xl p-4 bg-card">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <History className="w-4 h-4 text-primary" />
                  Complete Medical History for {patient.patient_full_name || patient.patient_name}
                </h3>
                <PatientHistoryView patientId={patient.patient_id} patientName={patient.patient_full_name || patient.patient_name} />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Modal Footer */}
        <DialogFooter className="p-4 border-t bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} className="text-xs gap-1">
              <Printer className="w-3.5 h-3.5" /> Print Summary
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
              Close
            </Button>
            {patient.currentStage.id !== 'completed' && (
              <Button size="sm" onClick={handleOpenInQueue} className="text-xs gap-1 bg-primary text-primary-foreground">
                <ExternalLink className="w-3.5 h-3.5" /> Open in Consultation Queue
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
