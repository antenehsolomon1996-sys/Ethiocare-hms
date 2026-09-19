import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Clock, 
  AlertCircle, 
  MapPin, 
  Eye, 
  ExternalLink, 
  Search, 
  FlaskConical, 
  Receipt, 
  Syringe, 
  Stethoscope, 
  Calendar 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import PatientJourneyTimeline from './PatientJourneyTimeline';

export default function OngoingPatientsView({
  ongoingPatients = [],
  onSelectPatient
}) {
  const navigate = useNavigate();
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'multiday' | 'today'
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPatients = useMemo(() => {
    let list = ongoingPatients;
    if (filterMode === 'multiday') {
      list = list.filter(p => p.daysOngoing > 0);
    } else if (filterMode === 'today') {
      list = list.filter(p => p.daysOngoing === 0);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => 
        p.patient_name?.toLowerCase().includes(q) ||
        p.patient_full_name?.toLowerCase().includes(q) ||
        p.patient_id?.toLowerCase().includes(q) ||
        p.diagnosis?.toLowerCase().includes(q) ||
        p.waitingOn?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [ongoingPatients, filterMode, searchQuery]);

  const multidayCount = ongoingPatients.filter(p => p.daysOngoing > 0).length;
  const todayCount = ongoingPatients.filter(p => p.daysOngoing === 0).length;

  return (
    <div className="space-y-5">
      {/* Top Banner & Filters */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/10 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Active & Ongoing Patient Encounters ({ongoingPatients.length})
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                All unfinished visits assigned to you across all hospital departments and dates.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={filterMode === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterMode('all')}
              className="text-xs font-semibold rounded-xl"
            >
              All Unfinished ({ongoingPatients.length})
            </Button>
            <Button
              variant={filterMode === 'multiday' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterMode('multiday')}
              className="text-xs font-semibold rounded-xl"
            >
              Multi-Day Wait ({multidayCount})
            </Button>
            <Button
              variant={filterMode === 'today' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterMode('today')}
              className="text-xs font-semibold rounded-xl"
            >
              Started Today ({todayCount})
            </Button>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9 h-10 rounded-xl"
          placeholder="Search ongoing patients by name, ID, or pending blocker..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Ongoing Patients Card List */}
      {filteredPatients.length === 0 ? (
        <div className="bg-card border border-border/80 rounded-2xl p-10 text-center">
          <Clock className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-semibold text-sm">No ongoing unfinished patients</p>
          <p className="text-xs text-muted-foreground mt-1">
            All patient encounters in this view have been fully concluded or none match your filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredPatients.map((patient) => {
            const isMultiDay = patient.daysOngoing > 0;
            return (
              <div
                key={patient.id}
                className={`bg-card border rounded-2xl p-4 sm:p-5 transition-all shadow-sm space-y-4 ${
                  isMultiDay 
                    ? 'border-amber-300 dark:border-amber-800/60 bg-amber-50/20 dark:bg-amber-950/10' 
                    : 'border-border/80 hover:border-primary/50'
                }`}
              >
                {/* Card Top: Patient Details & Status Badges */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-base shrink-0 mt-0.5">
                      {patient.queue_number ? `#${patient.queue_number}` : <Stethoscope className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-base text-foreground">
                          {patient.patient_full_name || patient.patient_name}
                        </h3>
                        {patient.patient_age && (
                          <span className="text-xs text-muted-foreground">({patient.patient_age} yrs, {patient.patient_gender})</span>
                        )}
                        {isMultiDay ? (
                          <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-amber-300 text-[11px] font-bold">
                            ⚠️ Day {patient.daysOngoing + 1} · Ongoing since {patient.visit_date}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[11px] bg-muted/40 font-medium">
                            Started Today
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground mt-1">
                        <span>ID: <strong className="text-foreground">{patient.patient_id}</strong></span>
                        <span>·</span>
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Visit Date: {patient.visit_date}</span>
                        {patient.diagnosis && (
                          <>
                            <span>·</span>
                            <span>Dx: <strong>{patient.diagnosis}</strong></span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
                    <Badge className="bg-primary text-primary-foreground font-semibold text-xs px-2.5 py-1">
                      {patient.currentStage.label}
                    </Badge>
                    <Badge variant="outline" className="text-xs flex items-center gap-1 bg-card">
                      <MapPin className="w-3 h-3 text-primary" />
                      {patient.currentStage.room}
                    </Badge>
                  </div>
                </div>

                {/* Card Middle: Pending Blocker & Action directive */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-muted/30 dark:bg-muted/15 p-3.5 rounded-xl text-xs">
                  <div>
                    <span className="font-bold uppercase tracking-wider text-muted-foreground text-[10px] block mb-1">
                      Current Blocker / Waiting On:
                    </span>
                    <p className="font-semibold text-amber-900 dark:text-amber-200">
                      {patient.waitingOn || 'Waiting for next department action'}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-[11px]">
                      Department: {patient.currentStage.department}
                    </p>
                  </div>

                  <div>
                    <span className="font-bold uppercase tracking-wider text-muted-foreground text-[10px] block mb-1">
                      Next Clinical Step:
                    </span>
                    <p className="font-semibold text-foreground">
                      {patient.nextStep || 'Review and update clinical encounter'}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-[11px]">
                      Last activity: {patient.lastActivityTime.relative} ({patient.lastActivityTime.formatted})
                    </p>
                  </div>
                </div>

                {/* Card Bottom: Journey Stepper & Action Buttons */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-border/50">
                  <PatientJourneyTimeline timeline={patient.stageTimeline} compact currentStageId={patient.currentStage.id} />
                  
                  <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectPatient(patient)}
                      className="text-xs font-semibold rounded-xl gap-1"
                    >
                      <Eye className="w-3.5 h-3.5 text-primary" />
                      View Dossier
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => navigate(`/doctor/queue?visit=${patient.id}`)}
                      className="text-xs font-semibold rounded-xl gap-1 bg-primary text-primary-foreground"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Consult in Queue
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
