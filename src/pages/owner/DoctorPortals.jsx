import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Stethoscope, Users, Calendar, TrendingUp, Search, Activity, FlaskConical, Pill } from 'lucide-react';
import { format, startOfMonth, startOfWeek } from 'date-fns';

const SPECIALTY_COLORS = {
  'General Practice': 'bg-blue-100 text-blue-700',
  'Cardiology': 'bg-red-100 text-red-700',
  'Pediatrics': 'bg-pink-100 text-pink-700',
  'Surgery': 'bg-orange-100 text-orange-700',
  'Internal Medicine': 'bg-purple-100 text-purple-700',
  'Obstetrics & Gynecology': 'bg-rose-100 text-rose-700',
  'Orthopedics': 'bg-amber-100 text-amber-700',
  'Neurology': 'bg-violet-100 text-violet-700',
  'Emergency Medicine': 'bg-red-100 text-red-800',
};

export default function DoctorPortals() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const { data: doctors = [] } = useQuery({ queryKey: ['doctors'], queryFn: () => ethioCareClient.entities.Doctor.list() });
  const { data: visits = [] } = useQuery({ queryKey: ['visits'], queryFn: () => ethioCareClient.entities.Visit.list('-created_date', 200) });
  const { data: labOrders = [] } = useQuery({ queryKey: ['labOrders'], queryFn: () => ethioCareClient.entities.LabOrder.list('-created_date', 200) });
  const { data: prescriptions = [] } = useQuery({ queryKey: ['prescriptions'], queryFn: () => ethioCareClient.entities.Prescription.list('-created_date', 200) });
  const { data: patientHistory = [] } = useQuery({ queryKey: ['patientHistory'], queryFn: () => ethioCareClient.entities.PatientHistory.list('-created_date', 200) });

  const uniqueDoctors = useMemo(() => {
    const seenIds = new Set();
    const seenCanonical = new Set();
    return doctors.filter(d => {
      if (!d || !d.id) return false;
      if (seenIds.has(d.id)) return false;
      const canonicalKey = `${d.full_name?.toLowerCase().trim()}_${d.email?.toLowerCase().trim()}_${d.specialty?.toLowerCase().trim()}`;
      if (d.email && seenCanonical.has(canonicalKey)) return false;
      seenIds.add(d.id);
      if (d.email) seenCanonical.add(canonicalKey);
      return true;
    });
  }, [doctors]);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const weekStart = format(startOfWeek(new Date()), 'yyyy-MM-dd');

  const getDoctorStats = (doc) => {
    // Match by ID first (reliable), fall back to name for legacy records
    const doctorVisits = visits.filter(v => {
      if (doc.id && v.assigned_doctor_id) return v.assigned_doctor_id === doc.id;
      return v.assigned_doctor === doc.full_name;
    });
    const todayV = doctorVisits.filter(v => v.visit_date === todayStr);
    const weekV = doctorVisits.filter(v => v.visit_date >= weekStart);
    const monthV = doctorVisits.filter(v => v.visit_date >= monthStart);
    const completed = doctorVisits.filter(v => v.status === 'completed');
    const active = doctorVisits.filter(v => ['waiting', 'with_doctor', 'lab_pending', 'lab_processing', 'lab_complete', 'pharmacy'].includes(v.status));
    const labs = labOrders.filter(o => o.doctor_name === doc.full_name || o.doctor_id === doc.id);
    const rxs = prescriptions.filter(p => p.doctor_name === doc.full_name || p.doctor_id === doc.id);
    const history = patientHistory.filter(h => h.doctor_name === doc.full_name || h.doctor_id === doc.id);

    return { doctorVisits, todayV, weekV, monthV, completed, active, labs, rxs, history };
  };

  const filteredDoctors = uniqueDoctors.filter(d => {
    const q = search.toLowerCase();
    return !search || d.full_name?.toLowerCase().includes(q) || d.specialty?.toLowerCase().includes(q);
  });

  const activeDoctors = uniqueDoctors.filter(d => d.status === 'active');
  const inactiveDoctors = uniqueDoctors.filter(d => d.status !== 'active');

  // Hospital-wide totals (all doctors combined)
  const totalVisitsToday = visits.filter(v => v.visit_date === todayStr).length;
  const totalVisitsMonth = visits.filter(v => v.visit_date >= monthStart).length;

  const selectedStats = selected ? getDoctorStats(selected) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Doctor Portal Management</h1>
        <p className="text-sm text-muted-foreground">Monitor and manage all {doctors.length} doctor portals</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Stethoscope className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{doctors.length}</p>
                <p className="text-xs text-muted-foreground">Total Doctors</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                <Activity className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeDoctors.length}</p>
                <p className="text-xs text-muted-foreground">Active Portals</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalVisitsToday}</p>
                <p className="text-xs text-muted-foreground">Visits Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalVisitsMonth}</p>
                <p className="text-xs text-muted-foreground">Visits This Month</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search doctors..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Portals ({doctors.length})</TabsTrigger>
          <TabsTrigger value="active">Active ({activeDoctors.length})</TabsTrigger>
          <TabsTrigger value="inactive">Inactive ({inactiveDoctors.length})</TabsTrigger>
        </TabsList>

        {['all', 'active', 'inactive'].map(tab => {
          const list = tab === 'all' ? filteredDoctors : tab === 'active'
            ? filteredDoctors.filter(d => d.status === 'active')
            : filteredDoctors.filter(d => d.status !== 'active');

          return (
            <TabsContent key={tab} value={tab} className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {list.map(doc => {
                  const stats = getDoctorStats(doc);
                  const isSelected = selected?.id === doc.id;
                  return (
                    <Card
                      key={doc.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${isSelected ? 'ring-2 ring-primary border-primary' : ''} ${doc.status !== 'active' ? 'opacity-60' : ''}`}
                      onClick={() => setSelected(isSelected ? null : doc)}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0">
                              <Stethoscope className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-sm">{doc.full_name}</h3>
                              <p className="text-xs text-muted-foreground">{doc.doctor_type}</p>
                            </div>
                          </div>
                          <Badge className={doc.status === 'active' ? 'bg-emerald-100 text-emerald-700 text-xs' : 'bg-gray-100 text-gray-600 text-xs'}>
                            {doc.status}
                          </Badge>
                        </div>

                        <Badge className={`text-xs mb-3 ${SPECIALTY_COLORS[doc.specialty] || 'bg-gray-100 text-gray-700'}`}>
                          {doc.specialty}
                        </Badge>

                        {/* Portal Stats */}
                        <div className="grid grid-cols-3 gap-2 text-center mt-3 pt-3 border-t border-border">
                          <div>
                            <p className="text-lg font-bold text-primary">{stats.todayV.length}</p>
                            <p className="text-xs text-muted-foreground">Today</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-purple-600">{stats.monthV.length}</p>
                            <p className="text-xs text-muted-foreground">Month</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-green-600">{stats.completed.length}</p>
                            <p className="text-xs text-muted-foreground">Done</p>
                          </div>
                        </div>

                        <div className="flex gap-2 mt-3">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <FlaskConical className="w-3 h-3" />{stats.labs.length} labs
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Pill className="w-3 h-3" />{stats.rxs.length} prescriptions
                          </div>
                        </div>

                        {stats.active.length > 0 && (
                          <div className="mt-2">
                            <Badge className="bg-amber-100 text-amber-700 text-xs">
                              {stats.active.length} active patient{stats.active.length > 1 ? 's' : ''}
                            </Badge>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}

                {list.length === 0 && (
                  <div className="col-span-3 text-center py-12 text-muted-foreground">
                    <Stethoscope className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>No doctors found</p>
                  </div>
                )}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Detailed Doctor Portal View */}
      {selected && selectedStats && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-base">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Stethoscope className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p>Portal Overview — Dr. {selected.full_name}</p>
                <p className="text-sm font-normal text-muted-foreground">{selected.specialty} · {selected.doctor_type}</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-blue-700">{selectedStats.todayV.length}</p>
                <p className="text-xs text-blue-600 mt-1">Today's Patients</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-purple-700">{selectedStats.weekV.length}</p>
                <p className="text-xs text-purple-600 mt-1">This Week</p>
              </div>
              <div className="bg-teal-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-teal-700">{selectedStats.monthV.length}</p>
                <p className="text-xs text-teal-600 mt-1">This Month</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-700">{selectedStats.doctorVisits.length}</p>
                <p className="text-xs text-green-600 mt-1">Total Visits</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Recent Patients */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Recent Patients</h4>
                <div className="space-y-2">
                  {selectedStats.doctorVisits.slice(0, 5).map(v => (
                    <div key={v.id} className="flex items-center justify-between py-2 px-3 border border-border rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{v.patient_name}</p>
                        <p className="text-xs text-muted-foreground">{v.visit_date} · {v.diagnosis || 'Pending'}</p>
                      </div>
                      <Badge className={v.status === 'completed' ? 'bg-green-100 text-green-700 text-xs' : 'bg-amber-100 text-amber-700 text-xs'}>
                        {v.status}
                      </Badge>
                    </div>
                  ))}
                  {selectedStats.doctorVisits.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">No patients assigned yet</p>
                  )}
                </div>
              </div>

              {/* Activity Summary */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Portal Activity</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2"><Users className="w-4 h-4 text-blue-600" /><span className="text-sm">Total Patients Seen</span></div>
                    <span className="font-semibold">{selectedStats.doctorVisits.length}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2"><Users className="w-4 h-4 text-green-600" /><span className="text-sm">Completed Visits</span></div>
                    <span className="font-semibold">{selectedStats.completed.length}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2"><FlaskConical className="w-4 h-4 text-purple-600" /><span className="text-sm">Lab Orders</span></div>
                    <span className="font-semibold">{selectedStats.labs.length}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2"><Pill className="w-4 h-4 text-amber-600" /><span className="text-sm">Prescriptions</span></div>
                    <span className="font-semibold">{selectedStats.rxs.length}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2"><Activity className="w-4 h-4 text-teal-600" /><span className="text-sm">History Records</span></div>
                    <span className="font-semibold">{selectedStats.history.length}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 px-3 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex items-center gap-2"><Activity className="w-4 h-4 text-amber-600" /><span className="text-sm">Currently Active</span></div>
                    <span className="font-semibold text-amber-700">{selectedStats.active.length}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Doctor Info */}
            <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {selected.email && <div><span className="text-muted-foreground">Email: </span>{selected.email}</div>}
              {selected.phone && <div><span className="text-muted-foreground">Phone: </span>{selected.phone}</div>}
              {selected.license_number && <div><span className="text-muted-foreground">License: </span>{selected.license_number}</div>}
              {selected.years_experience && <div><span className="text-muted-foreground">Experience: </span>{selected.years_experience} years</div>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}