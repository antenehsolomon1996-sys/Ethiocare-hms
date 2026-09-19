import React, { useState, useMemo } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import { 
  Calendar as CalendarIcon, 
  Users, 
  CheckCircle2, 
  Clock, 
  FlaskConical, 
  Syringe, 
  Receipt, 
  Search, 
  ArrowRight, 
  Eye, 
  MapPin 
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import PatientJourneyTimeline from './PatientJourneyTimeline';

export default function DailyPatientHistory({
  todayStr,
  yesterdayStr,
  getDailyPatientSummary,
  onSelectPatient
}) {
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [searchQuery, setSearchQuery] = useState('');

  // Daily summary for the currently selected date
  const summary = useMemo(() => {
    return getDailyPatientSummary(selectedDate);
  }, [selectedDate, getDailyPatientSummary]);

  const { visits = [], metrics = {} } = summary;

  // Filter by search query
  const filteredVisits = useMemo(() => {
    if (!searchQuery.trim()) return visits;
    const q = searchQuery.toLowerCase();
    return visits.filter(v => 
      v.patient_name?.toLowerCase().includes(q) ||
      v.patient_full_name?.toLowerCase().includes(q) ||
      v.patient_id?.toLowerCase().includes(q) ||
      v.diagnosis?.toLowerCase().includes(q)
    );
  }, [visits, searchQuery]);

  // Previous 5 days for quick buttons
  const quickDays = useMemo(() => {
    const days = [];
    const base = new Date();
    for (let i = 2; i <= 6; i++) {
      const d = subDays(base, i);
      days.push({
        dateStr: format(d, 'yyyy-MM-dd'),
        label: format(d, 'EEE, MMM d')
      });
    }
    return days;
  }, []);

  return (
    <div className="space-y-6">
      {/* Date Selection Bar */}
      <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={selectedDate === todayStr ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedDate(todayStr)}
              className="text-xs font-semibold rounded-xl"
            >
              Today ({todayStr})
            </Button>
            <Button
              variant={selectedDate === yesterdayStr ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedDate(yesterdayStr)}
              className="text-xs font-semibold rounded-xl"
            >
              Yesterday ({yesterdayStr})
            </Button>
            
            {/* Quick dropdown / pill for recent days */}
            {quickDays.slice(0, 3).map(day => (
              <Button
                key={day.dateStr}
                variant={selectedDate === day.dateStr ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedDate(day.dateStr)}
                className="hidden md:inline-flex text-xs rounded-xl"
              >
                {day.label}
              </Button>
            ))}
          </div>

          {/* Interactive Date Picker Input */}
          <div className="flex items-center gap-2">
            <div className="relative flex items-center">
              <CalendarIcon className="w-4 h-4 text-muted-foreground absolute left-3 pointer-events-none" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="h-9 pl-9 pr-3 rounded-xl border border-input bg-background text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-muted-foreground">
            Viewing historical patient records for: <strong className="text-foreground">{selectedDate}</strong>
          </p>
          <span className="text-xs text-primary font-medium">
            {metrics.seenCount || 0} patient{(metrics.seenCount || 0) === 1 ? '' : 's'} recorded
          </span>
        </div>
      </div>

      {/* Daily KPI Metrics Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="rounded-2xl border-border/80 shadow-sm bg-gradient-to-br from-blue-50/50 to-blue-100/30 dark:from-blue-950/20 dark:to-blue-900/10">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Seen That Day</p>
              <p className="text-lg font-bold text-foreground">{metrics.seenCount || 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 shadow-sm bg-gradient-to-br from-emerald-50/50 to-emerald-100/30 dark:from-emerald-950/20 dark:to-emerald-900/10">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Completed</p>
              <p className="text-lg font-bold text-foreground">{metrics.completedCount || 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 shadow-sm bg-gradient-to-br from-amber-50/50 to-amber-100/30 dark:from-amber-950/20 dark:to-amber-900/10">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Unfinished</p>
              <p className="text-lg font-bold text-foreground">{metrics.unfinishedCount || 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 shadow-sm bg-gradient-to-br from-purple-50/50 to-purple-100/30 dark:from-purple-950/20 dark:to-purple-900/10">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <FlaskConical className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Sent to Lab</p>
              <p className="text-lg font-bold text-foreground">{metrics.labCount || 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 shadow-sm bg-gradient-to-br from-pink-50/50 to-pink-100/30 dark:from-pink-950/20 dark:to-pink-900/10">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400 flex items-center justify-center shrink-0">
              <Syringe className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Sent to Nurse</p>
              <p className="text-lg font-bold text-foreground">{metrics.nurseCount || 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 shadow-sm bg-gradient-to-br from-indigo-50/50 to-indigo-100/30 dark:from-indigo-950/20 dark:to-indigo-900/10">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Sent to Billing</p>
              <p className="text-lg font-bold text-foreground">{metrics.billingCount || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9 h-10 rounded-xl"
          placeholder="Filter this day's patients by name or ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Patient List for Selected Date */}
      {filteredVisits.length === 0 ? (
        <div className="bg-card border border-border/80 rounded-2xl p-10 text-center">
          <Users className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-semibold text-sm">No patients recorded for {selectedDate}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Try choosing a different date or clearing the search filter.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredVisits.map((patient) => (
            <div
              key={patient.id}
              onClick={() => onSelectPatient(patient)}
              className="bg-card border border-border/80 hover:border-primary/50 hover:shadow-md rounded-2xl p-4 transition-all cursor-pointer space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                    {patient.queue_number ? `#${patient.queue_number}` : <Users className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-foreground">
                        {patient.patient_full_name || patient.patient_name}
                      </p>
                      {patient.patient_age && (
                        <span className="text-xs text-muted-foreground">({patient.patient_age}y, {patient.patient_gender})</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>ID: <strong>{patient.patient_id}</strong></span>
                      {patient.diagnosis && <span>· Diagnosis: {patient.diagnosis}</span>}
                      {patient.follow_up_date && (
                        <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          Follow-up: {patient.follow_up_date}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
                  <Badge className="text-xs font-semibold px-2.5 py-1">
                    {patient.currentStage.label}
                  </Badge>
                  <Badge variant="outline" className="text-xs flex items-center gap-1 bg-muted/30">
                    <MapPin className="w-3 h-3 text-primary" />
                    {patient.currentStage.room}
                  </Badge>
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-primary font-medium gap-1">
                    <Eye className="w-3.5 h-3.5" /> View Record
                  </Button>
                </div>
              </div>

              {/* Journey Stepper Rail */}
              <div className="pt-2 border-t border-border/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <PatientJourneyTimeline timeline={patient.stageTimeline} compact currentStageId={patient.currentStage.id} />
                <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-primary" />
                    Last activity: <strong>{patient.lastActivityTime.relative}</strong>
                  </span>
                  {patient.isOngoing && (
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      ● Unfinished
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
