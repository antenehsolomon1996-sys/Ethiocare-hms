import { useQuery } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import StatCard from '@/components/common/StatCard';
import StatusBadge from '@/components/common/StatusBadge';
import { Users, Clock, UserPlus, CheckCircle, Search, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function ReceptionDashboard() {
  const { data: visits = [], isLoading } = useQuery({
    queryKey: ['visits'],
    queryFn: () => ethioCareClient.entities.Visit.list('-created_date', 100),
    refetchInterval: 15000
  });
  const { data: patients = [] } = useQuery({
    queryKey: ['patients'],
    queryFn: () => ethioCareClient.entities.Patient.list()
  });

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayVisits = visits.filter(v => v.visit_date === todayStr);
  const waiting = todayVisits.filter(v => v.status === 'waiting');
  const withDoctor = todayVisits.filter(v => v.status === 'with_doctor');
  const completed = todayVisits.filter(v => v.status === 'completed');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Reception Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/reception/search">
            <Button variant="outline"><Search className="w-4 h-4 mr-2" />Search Patient</Button>
          </Link>
          <Link to="/reception/register">
            <Button><UserPlus className="w-4 h-4 mr-2" />New Patient</Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Total Patients" value={patients.length} icon={Users} color="blue" />
        <StatCard title="Today's Visits" value={todayVisits.length} icon={Calendar} color="teal" />
        <StatCard title="Waiting" value={waiting.length} icon={Clock} color="amber" />
        <StatCard title="Completed" value={completed.length} icon={CheckCircle} color="green" />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Link to="/reception/register" className="card-hover bg-card border border-border/60 rounded-xl p-5 hover:border-primary/40 group">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <UserPlus className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-heading font-semibold">Register Patient</h3>
          </div>
          <p className="text-sm text-muted-foreground">Register a new patient and send to doctor queue</p>
        </Link>

        <Link to="/reception/search" className="card-hover bg-card border border-border/60 rounded-xl p-5 hover:border-primary/40 group">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
              <Search className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-heading font-semibold">Search Patient</h3>
          </div>
          <p className="text-sm text-muted-foreground">Find existing patients and view complete history</p>
        </Link>

        <Link to="/reception/queue" className="card-hover bg-card border border-border/60 rounded-xl p-5 hover:border-primary/40 group">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <h3 className="font-heading font-semibold">Today's Queue</h3>
          </div>
          <p className="text-sm text-muted-foreground">Monitor today's patient queue and status</p>
        </Link>
      </div>

      {/* Today's Queue */}
      <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-sm font-bold">Today's Queue</h3>
          <div className="flex gap-2 text-xs">
            <span className="text-amber-600 font-semibold">{waiting.length} waiting</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-blue-600 font-semibold">{withDoctor.length} with doctor</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-emerald-600 font-semibold">{completed.length} done</span>
          </div>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
        ) : (
          <div className="space-y-2">
            {todayVisits.slice(0, 15).map(v => (
              <div key={v.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/40 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {v.queue_number || '-'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{v.patient_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {v.assigned_doctor ? `Dr. ${v.assigned_doctor}` : 'Not assigned'}
                    </p>
                  </div>
                </div>
                <StatusBadge status={v.status} />
              </div>
            ))}
            {todayVisits.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No visits today</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}