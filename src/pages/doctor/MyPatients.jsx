import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDoctorContext } from '@/lib/DoctorContext';
import { useDoctorPatientTracking } from '@/hooks/useDoctorPatientTracking';
import { 
  Users, 
  Search, 
  Clock, 
  CheckCircle2, 
  FlaskConical, 
  Syringe, 
  Receipt, 
  Pill, 
  Stethoscope, 
  RefreshCw, 
  Radio, 
  MapPin, 
  Eye, 
  ExternalLink, 
  AlertCircle,
  Calendar
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import PatientJourneyTimeline from '@/components/doctor/tracking/PatientJourneyTimeline';
import DoctorPatientDetailModal from '@/components/doctor/tracking/DoctorPatientDetailModal';
import DailyPatientHistory from '@/components/doctor/tracking/DailyPatientHistory';
import OngoingPatientsView from '@/components/doctor/tracking/OngoingPatientsView';

export default function MyPatients() {
  const navigate = useNavigate();
  const { selectedDoctor } = useDoctorContext();
  const [selectedPatientForModal, setSelectedPatientForModal] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('all'); // 'all' | 'waiting' | 'in_exam' | 'lab' | 'nurse' | 'billing' | 'pharmacy' | 'completed'

  const tracking = useDoctorPatientTracking(selectedDoctor);
  const {
    isLoading,
    allPatients,
    todayStr,
    yesterdayStr,
    waitingPatients,
    inExamPatients,
    labPatients,
    nursePatients,
    billingPatients,
    pharmacyPatients,
    completedPatients,
    ongoingPatients,
    getDailyPatientSummary,
    refetchAll
  } = tracking;

  // Filter active patients list by stage chip and search query
  const filteredActivePatients = useMemo(() => {
    let list = allPatients;

    // Stage filter
    if (stageFilter === 'waiting') {
      list = waitingPatients;
    } else if (stageFilter === 'in_exam') {
      list = inExamPatients;
    } else if (stageFilter === 'lab') {
      list = labPatients;
    } else if (stageFilter === 'nurse') {
      list = nursePatients;
    } else if (stageFilter === 'billing') {
      list = billingPatients;
    } else if (stageFilter === 'pharmacy') {
      list = pharmacyPatients;
    } else if (stageFilter === 'completed') {
      list = completedPatients;
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => 
        p.patient_name?.toLowerCase().includes(q) ||
        p.patient_full_name?.toLowerCase().includes(q) ||
        p.patient_id?.toLowerCase().includes(q) ||
        p.diagnosis?.toLowerCase().includes(q) ||
        p.waitingOn?.toLowerCase().includes(q) ||
        p.currentStage.room?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [allPatients, stageFilter, searchQuery, waitingPatients, inExamPatients, labPatients, nursePatients, billingPatients, pharmacyPatients, completedPatients]);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Patient Tracking System
            </h1>
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Live Cross-Department Sync</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {selectedDoctor ? (
              <span>
                Tracking all patients assigned to <strong>Dr. {selectedDoctor.full_name}</strong> across all hospital rooms & stages
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400">
                Please select an attending doctor from the sidebar to track assigned patients.
              </span>
            )}
          </p>
        </div>

        {/* Header KPI Stats & Refresh */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            <span>{allPatients.length} Total Patients</span>
          </div>
          <div className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300/40 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>{ongoingPatients.length} Active / Ongoing</span>
          </div>
          <div className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300/40 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{completedPatients.length} Completed</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refetchAll}
            className="h-8 px-2.5 rounded-xl text-xs gap-1 text-muted-foreground hover:text-foreground"
            title="Refresh All Records"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {!selectedDoctor && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 text-sm text-amber-800 dark:text-amber-300 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-semibold">No Doctor Selected</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              Select your doctor profile using the Doctor Selector in the sidebar to activate real-time patient tracking.
            </p>
          </div>
        </div>
      )}

      {/* Primary Section Tabs */}
      <Tabs defaultValue="active" className="space-y-6">
        <TabsList className="flex flex-wrap h-auto p-1.5 bg-muted/70 rounded-2xl gap-1">
          <TabsTrigger value="active" className="rounded-xl text-xs py-2 px-3.5 font-semibold flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-primary" />
            <span>Stage & Room Tracking ({allPatients.length})</span>
          </TabsTrigger>
          <TabsTrigger value="ongoing" className="rounded-xl text-xs py-2 px-3.5 font-semibold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Ongoing Patients ({ongoingPatients.length})</span>
          </TabsTrigger>
          <TabsTrigger value="daily" className="rounded-xl text-xs py-2 px-3.5 font-semibold flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span>Daily History & Calendar</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: ACTIVE & STAGE TRACKING (THE ROOM TRACKER) */}
        <TabsContent value="active" className="space-y-5 mt-0">
          {/* Multi-Stage Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 bg-card border border-border/80 p-2 rounded-2xl shadow-sm">
            <Button
              variant={stageFilter === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setStageFilter('all')}
              className="text-xs h-8 rounded-xl font-semibold"
            >
              All ({allPatients.length})
            </Button>
            <Button
              variant={stageFilter === 'waiting' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setStageFilter('waiting')}
              className="text-xs h-8 rounded-xl font-medium gap-1 text-sky-700 dark:text-sky-400"
            >
              <Clock className="w-3 h-3" />
              Waiting ({waitingPatients.length})
            </Button>
            <Button
              variant={stageFilter === 'in_exam' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setStageFilter('in_exam')}
              className="text-xs h-8 rounded-xl font-medium gap-1 text-indigo-700 dark:text-indigo-400"
            >
              <Stethoscope className="w-3 h-3" />
              In Examination ({inExamPatients.length})
            </Button>
            <Button
              variant={stageFilter === 'lab' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setStageFilter('lab')}
              className="text-xs h-8 rounded-xl font-medium gap-1 text-purple-700 dark:text-purple-400"
            >
              <FlaskConical className="w-3 h-3" />
              Sent to Lab ({labPatients.length})
            </Button>
            <Button
              variant={stageFilter === 'billing' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setStageFilter('billing')}
              className="text-xs h-8 rounded-xl font-medium gap-1 text-amber-700 dark:text-amber-400"
            >
              <Receipt className="w-3 h-3" />
              Waiting Billing ({billingPatients.length})
            </Button>
            <Button
              variant={stageFilter === 'nurse' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setStageFilter('nurse')}
              className="text-xs h-8 rounded-xl font-medium gap-1 text-pink-700 dark:text-pink-400"
            >
              <Syringe className="w-3 h-3" />
              Sent to Nurse ({nursePatients.length})
            </Button>
            <Button
              variant={stageFilter === 'pharmacy' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setStageFilter('pharmacy')}
              className="text-xs h-8 rounded-xl font-medium gap-1 text-green-700 dark:text-green-400"
            >
              <Pill className="w-3 h-3" />
              Pharmacy ({pharmacyPatients.length})
            </Button>
            <Button
              variant={stageFilter === 'completed' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setStageFilter('completed')}
              className="text-xs h-8 rounded-xl font-medium gap-1 text-emerald-700 dark:text-emerald-400"
            >
              <CheckCircle2 className="w-3 h-3" />
              Completed ({completedPatients.length})
            </Button>
          </div>

          {/* Search bar */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9 h-10 rounded-xl"
              placeholder="Search by patient name, ID, room, or condition..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Real-time Patient Tracking Cards */}
          {isLoading ? (
            <div className="bg-card border border-border/80 rounded-2xl p-12 text-center text-muted-foreground">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-2 opacity-50" />
              <p className="text-sm">Loading real-time patient stages...</p>
            </div>
          ) : filteredActivePatients.length === 0 ? (
            <div className="bg-card border border-border/80 rounded-2xl p-12 text-center">
              <Users className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="font-semibold text-sm">No patients found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchQuery ? 'Try clearing your search query' : 'No patients currently assigned to you in this filter.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredActivePatients.map((patient) => (
                <div
                  key={patient.id}
                  className="bg-card border border-border/80 hover:border-primary/50 hover:shadow-md rounded-2xl p-4 sm:p-5 transition-all space-y-3.5"
                >
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-base shrink-0 mt-0.5">
                        {patient.queue_number ? `#${patient.queue_number}` : <Users className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-base text-foreground">
                            {patient.patient_full_name || patient.patient_name}
                          </h3>
                          {patient.patient_age && (
                            <span className="text-xs text-muted-foreground font-normal">
                              ({patient.patient_age} yrs, {patient.patient_gender || 'N/A'})
                            </span>
                          )}
                          {patient.isOngoing && patient.daysOngoing > 0 && (
                            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300">
                              Ongoing {patient.daysOngoing + 1}d
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>ID: <strong className="text-foreground">{patient.patient_id}</strong></span>
                          <span>·</span>
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {patient.visit_date}</span>
                          {patient.diagnosis && (
                            <>
                              <span>·</span>
                              <span>Diagnosis: <strong className="text-foreground">{patient.diagnosis}</strong></span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
                      <Badge className="bg-primary text-primary-foreground font-semibold text-xs px-2.5 py-1">
                        {patient.currentStage.label}
                      </Badge>
                      <Badge variant="outline" className="text-xs flex items-center gap-1 bg-muted/40 font-medium">
                        <MapPin className="w-3 h-3 text-primary" />
                        {patient.currentStage.room}
                      </Badge>
                    </div>
                  </div>

                  {/* Realtime Waiting and Next Step Directive */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-muted/30 dark:bg-muted/15 p-3 rounded-xl text-xs">
                    <div>
                      <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider block mb-0.5">
                        Current Blocker / Waiting On:
                      </span>
                      <p className="font-medium text-amber-900 dark:text-amber-200">
                        {patient.waitingOn || 'Consultation in progress'}
                      </p>
                    </div>

                    <div>
                      <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider block mb-0.5">
                        Next Required Action:
                      </span>
                      <p className="font-medium text-foreground">
                        {patient.nextStep || 'Follow routine clinical protocol'}
                      </p>
                    </div>
                  </div>

                  {/* 8-Stage Visual Timeline and Action Buttons */}
                  <div className="pt-2 border-t border-border/50 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <PatientJourneyTimeline timeline={patient.stageTimeline} compact currentStageId={patient.currentStage.id} />
                    </div>

                    <div className="flex items-center justify-between lg:justify-end gap-3 shrink-0">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3 text-primary" />
                        {patient.lastActivityTime.relative}
                      </span>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedPatientForModal(patient)}
                          className="h-8 px-2.5 text-xs font-semibold rounded-xl gap-1"
                        >
                          <Eye className="w-3.5 h-3.5 text-primary" />
                          View Dossier
                        </Button>

                        {patient.currentStage.id !== 'completed' && (
                          <Button
                            size="sm"
                            onClick={() => navigate(`/doctor/queue?visit=${patient.id}`)}
                            className="h-8 px-2.5 text-xs font-semibold rounded-xl gap-1 bg-primary text-primary-foreground"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Open in Queue
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: ONGOING PATIENTS (UNFINISHED VISITS ACROSS ALL DATES) */}
        <TabsContent value="ongoing" className="mt-0">
          <OngoingPatientsView
            ongoingPatients={ongoingPatients}
            onSelectPatient={setSelectedPatientForModal}
          />
        </TabsContent>

        {/* TAB 3: DAILY PATIENT HISTORY (TODAY, YESTERDAY, CALENDAR DATE PICKER) */}
        <TabsContent value="daily" className="mt-0">
          <DailyPatientHistory
            todayStr={todayStr}
            yesterdayStr={yesterdayStr}
            getDailyPatientSummary={getDailyPatientSummary}
            onSelectPatient={setSelectedPatientForModal}
          />
        </TabsContent>
      </Tabs>

      {/* Comprehensive Patient Record Modal */}
      <DoctorPatientDetailModal
        patient={selectedPatientForModal}
        isOpen={!!selectedPatientForModal}
        onClose={() => setSelectedPatientForModal(null)}
      />
    </div>
  );
}