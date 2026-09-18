import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useDoctorContext } from '@/lib/DoctorContext';
import StatusBadge from '@/components/common/StatusBadge';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, User, Calendar, Clock, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { format, startOfWeek, startOfMonth } from 'date-fns';
import PatientHistoryView from '@/pages/shared/PatientHistoryView';

export default function MyPatients() {
  const { selectedDoctor } = useDoctorContext();
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ['visits'],
    queryFn: () => base44.entities.Visit.list('-created_date', 500),
    refetchInterval: 20000
  });

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const weekStart = format(startOfWeek(new Date()), 'yyyy-MM-dd');
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');

  const myDoctorId = selectedDoctor?.id;

  // Filter visits for the selected doctor
  const isMyVisit = (v) => {
    if (!selectedDoctor) return false;
    if (myDoctorId && v.assigned_doctor_id) return v.assigned_doctor_id === myDoctorId;
    if (v.assigned_doctor && selectedDoctor.full_name) {
      return v.assigned_doctor.toLowerCase() === selectedDoctor.full_name.toLowerCase();
    }
    return false;
  };

  const myVisits = visits.filter(isMyVisit);

  const filterVisits = (list) => {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(v =>
      v.patient_name?.toLowerCase().includes(q) ||
      v.patient_id?.toLowerCase().includes(q)
    );
  };

  const activeVisits = filterVisits(myVisits.filter(v =>
    ['waiting', 'with_doctor', 'lab_pending', 'lab_paid', 'lab_processing', 'lab_complete', 'pharmacy'].includes(v.status)
  ));
  const todayVisits = filterVisits(myVisits.filter(v => v.visit_date === todayStr));
  const weekVisits = filterVisits(myVisits.filter(v => v.visit_date >= weekStart));
  const monthVisits = filterVisits(myVisits.filter(v => v.visit_date >= monthStart));
  const followUpVisits = filterVisits(myVisits.filter(v => v.follow_up_date && v.follow_up_date >= todayStr));
  const allVisits = filterVisits(myVisits);

  const VisitRow = ({ v }) => {
    const isExpanded = expandedId === v.id;
    return (
      <div className={`border rounded-lg overflow-hidden transition-all ${isExpanded ? 'border-primary' : 'border-border'}`}>
        <div
          className={`flex items-center justify-between py-3 px-4 cursor-pointer transition-colors ${isExpanded ? 'bg-primary/5' : 'hover:bg-muted/30'}`}
          onClick={() => setExpandedId(isExpanded ? null : v.id)}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{v.patient_name}</p>
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />{v.visit_date}
                </span>
                {v.diagnosis && <span className="text-xs text-muted-foreground">· {v.diagnosis}</span>}
                {v.follow_up_date && (
                  <Badge className="text-xs bg-blue-100 text-blue-700">Follow-up {v.follow_up_date}</Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={v.status} />
            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>
        {isExpanded && (
          <div className="border-t border-border p-4 bg-card">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Complete Medical History — {v.patient_name}
            </h4>
            <PatientHistoryView patientId={v.patient_id} patientName={v.patient_name} />
          </div>
        )}
      </div>
    );
  };

  const VisitList = ({ visits: list }) => (
    <div className="space-y-2 mt-4">
      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No patients found</p>
      ) : (
        list.map(v => <VisitRow key={v.id} v={v} />)
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Patients</h1>
          <p className="text-sm text-muted-foreground">
            {selectedDoctor ? `Patients assigned to Dr. ${selectedDoctor.full_name}` : 'Select a doctor from the sidebar'}
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <span className="bg-primary/10 text-primary px-3 py-1.5 rounded-lg font-semibold">{myVisits.length} total visits</span>
          <span className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg font-semibold">{activeVisits.length} active</span>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by patient name or ID..."
          value={search}
          onChange={e => { setSearch(e.target.value); setExpandedId(null); }}
        />
      </div>

      <Tabs defaultValue="active">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="active" className="text-xs">
            <Clock className="w-3 h-3 mr-1" />Active ({activeVisits.length})
          </TabsTrigger>
          <TabsTrigger value="today" className="text-xs">
            Today ({todayVisits.length})
          </TabsTrigger>
          <TabsTrigger value="week" className="text-xs">
            This Week ({weekVisits.length})
          </TabsTrigger>
          <TabsTrigger value="month" className="text-xs">
            This Month ({monthVisits.length})
          </TabsTrigger>
          <TabsTrigger value="followup" className="text-xs">
            <Calendar className="w-3 h-3 mr-1" />Follow-ups ({followUpVisits.length})
          </TabsTrigger>
          <TabsTrigger value="all" className="text-xs">
            <CheckCircle className="w-3 h-3 mr-1" />All ({allVisits.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active"><VisitList visits={activeVisits} /></TabsContent>
        <TabsContent value="today"><VisitList visits={todayVisits} /></TabsContent>
        <TabsContent value="week"><VisitList visits={weekVisits} /></TabsContent>
        <TabsContent value="month"><VisitList visits={monthVisits} /></TabsContent>
        <TabsContent value="followup"><VisitList visits={followUpVisits} /></TabsContent>
        <TabsContent value="all"><VisitList visits={allVisits} /></TabsContent>
      </Tabs>
    </div>
  );
}