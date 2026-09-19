import { useQuery } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import { useDoctorContext } from '@/lib/DoctorContext';
import StatCard from '@/components/common/StatCard';
import StatusBadge from '@/components/common/StatusBadge';
import { Users, Clock, Stethoscope, FlaskConical, CheckCircle, BookOpen, Calendar, TrendingUp, UserCheck, AlertTriangle, Building2 } from 'lucide-react';
import { format, startOfWeek, startOfMonth } from 'date-fns';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function DoctorDashboard() {
  const { selectedDoctor: doctorProfile } = useDoctorContext();

  const { data: visits = [] } = useQuery({
    queryKey: ['visits'],
    queryFn: () => ethioCareClient.entities.Visit.list('-created_date', 500),
    refetchInterval: 15000
  });

  const { data: labOrders = [] } = useQuery({
    queryKey: ['labOrders'],
    queryFn: () => ethioCareClient.entities.LabOrder.list('-created_date', 200),
    refetchInterval: 15000
  });

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const weekStart = format(startOfWeek(new Date()), 'yyyy-MM-dd');
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');

  const myDoctorId = doctorProfile?.id;

  const isMyVisit = (v) => {
    if (!myDoctorId) return false;
    if (v.assigned_doctor_id) return v.assigned_doctor_id === myDoctorId;
    return v.assigned_doctor?.toLowerCase() === doctorProfile?.full_name?.toLowerCase();
  };

  const myAllVisits = visits.filter(isMyVisit);
  const myTodayVisits = myAllVisits.filter(v => v.visit_date === todayStr);
  const myWeekVisits = myAllVisits.filter(v => v.visit_date >= weekStart);
  const myMonthVisits = myAllVisits.filter(v => v.visit_date >= monthStart);

  const waitingNow = myTodayVisits.filter(v => 
    ['waiting', 'with_doctor', 'lab_complete'].includes(v.status) && 
    !v.consultation_completed && 
    v.registration_fee_paid === true
  );
  const pendingPaymentVisits = myTodayVisits.filter(v => 
    ['waiting', 'with_doctor'].includes(v.status) && 
    !v.consultation_completed && 
    v.registration_fee_paid !== true
  );
  const completedToday = myTodayVisits.filter(v => v.consultation_completed === true || ['pharmacy', 'completed'].includes(v.status));
  const followUps = myAllVisits.filter(v => v.follow_up_date && v.follow_up_date >= todayStr);

  const myLabResults = labOrders.filter(o => o.test_status === 'completed' && (
    myDoctorId ? visits.some(v => v.id === o.visit_id && isMyVisit(v)) : false
  ));

  return (
    <div className="space-y-6">
      {!doctorProfile && (
        <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-4 text-sm text-amber-800 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>No doctor selected. Use the <strong>Doctor Selector</strong> in the sidebar to choose a doctor and view their data.</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">{doctorProfile ? `Welcome, Dr. ${doctorProfile.full_name}` : 'Doctor Portal'}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <p className="text-sm text-muted-foreground">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
            {doctorProfile?.specialty && (
              <Badge variant="secondary" className="text-xs">
                <Stethoscope className="w-3 h-3 mr-1" />{doctorProfile.specialty}
              </Badge>
            )}
            {doctorProfile?.assigned_room_number && (
              <Badge variant="outline" className="text-xs font-mono bg-primary/10 text-primary border-primary/20">
                <Building2 className="w-3 h-3 mr-1" />Room {doctorProfile.assigned_room_number}
              </Badge>
            )}
            {doctorProfile?.doctor_type && (
              <Badge variant="outline" className="text-xs">{doctorProfile.doctor_type}</Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/doctor/history">
            <Button variant="outline" size="sm"><BookOpen className="w-4 h-4 mr-2" />Patient History</Button>
          </Link>
          <Link to="/doctor/queue">
            <Button size="sm"><Stethoscope className="w-4 h-4 mr-2" />My Queue</Button>
          </Link>
        </div>
      </div>

      {/* Doctor Profile Card */}
      {doctorProfile && (
        <div className="gradient-hero border border-primary/15 rounded-xl p-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Stethoscope className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-heading font-bold">{doctorProfile.full_name}</h3>
              <p className="text-sm text-muted-foreground">{doctorProfile.doctor_type} · {doctorProfile.specialty}</p>
              <div className="flex flex-wrap gap-3 mt-1 items-center">
                {doctorProfile.assigned_room_number && (
                  <Badge variant="outline" className="text-xs font-mono bg-primary/10 text-primary border-primary/30">
                    <Building2 className="w-3 h-3 mr-1" />Assigned Room: {doctorProfile.assigned_room_number}
                  </Badge>
                )}
                {doctorProfile.department && <p className="text-xs text-muted-foreground">{doctorProfile.department} Dept.</p>}
                {doctorProfile.license_number && <p className="text-xs text-muted-foreground">License: {doctorProfile.license_number}</p>}
                {doctorProfile.years_experience && <p className="text-xs text-muted-foreground">{doctorProfile.years_experience} yrs exp.</p>}
              </div>
            </div>
            <Badge className={
              doctorProfile.availability === 'available' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
              doctorProfile.availability === 'busy' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
              'bg-red-50 text-red-700 border border-red-200'
            }>
              {doctorProfile.availability}
            </Badge>
          </div>
        </div>
      )}

      {/* My Stats */}
      <div>
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">My Patient Statistics</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard title="Today's Patients" value={myTodayVisits.length} icon={Users} color="blue" />
          <StatCard title="This Week" value={myWeekVisits.length} icon={Calendar} color="teal" />
          <StatCard title="This Month" value={myMonthVisits.length} icon={TrendingUp} color="purple" />
          <StatCard title="Completed Today" value={completedToday.length} icon={CheckCircle} color="green" />
          <StatCard title="Lab Results Ready" value={myLabResults.length} icon={FlaskConical} color="amber" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* My Queue Today */}
        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-sm font-bold flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              My Queue ({waitingNow.length} waiting)
            </h3>
            <Link to="/doctor/queue" className="text-xs text-primary font-medium hover:underline">Open Queue →</Link>
          </div>
          <div className="space-y-2">
            {waitingNow.map(v => (
              <Link
                key={v.id}
                to={`/doctor/queue?visit=${v.id}`}
                className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/40 hover:border-primary/30 transition-all border border-transparent"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    #{v.queue_number}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{v.patient_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{v.symptoms || 'No symptoms noted'}</p>
                  </div>
                </div>
                <StatusBadge status={v.status} />
              </Link>
            ))}
            {waitingNow.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No patients waiting in your queue</p>
            )}
            {pendingPaymentVisits.length > 0 && (
              <div className="mt-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-medium">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  {pendingPaymentVisits.length} patient{pendingPaymentVisits.length > 1 ? 's' : ''} awaiting registration fee
                </span>
                <span className="text-[10px] text-amber-600/80 font-normal">Consultation blocked until paid</span>
              </div>
            )}
          </div>
        </div>

        {/* Lab Results & Follow-ups */}
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
            <h3 className="font-heading text-sm font-bold mb-3 flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-violet-600" />
              Lab Results Ready ({myLabResults.length})
            </h3>
            <div className="space-y-2">
              {myLabResults.slice(0, 4).map(lab => (
                <div key={lab.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{lab.patient_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{lab.test_type}{lab.test_name ? ` — ${lab.test_name}` : ''}</p>
                  </div>
                  <Link to="/doctor/queue">
                    <Badge className="text-xs bg-violet-50 text-violet-700 border border-violet-200 cursor-pointer hover:bg-violet-100">Review</Badge>
                  </Link>
                </div>
              ))}
              {myLabResults.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">No lab results pending</p>
              )}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
            <h3 className="font-heading text-sm font-bold mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              Upcoming Follow-ups ({followUps.length})
            </h3>
            <div className="space-y-2">
              {followUps.slice(0, 3).map(v => (
                <div key={v.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{v.patient_name}</p>
                    <p className="text-xs text-muted-foreground">Follow-up: {v.follow_up_date}</p>
                  </div>
                  <Badge className="text-xs bg-blue-50 text-blue-700 border border-blue-200">Scheduled</Badge>
                </div>
              ))}
              {followUps.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">No upcoming follow-ups</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Completed Today */}
      {completedToday.length > 0 && (
        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
          <h3 className="font-heading text-sm font-bold mb-3 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            Completed Today ({completedToday.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {completedToday.map(v => (
              <div key={v.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{v.patient_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{v.final_diagnosis || v.diagnosis || 'Diagnosis recorded'}</p>
                </div>
                <StatusBadge status={v.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}