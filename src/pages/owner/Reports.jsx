import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import StatCard from '@/components/common/StatCard';
import { 
  Users, DollarSign, FlaskConical, Pill, TrendingUp, 
  Activity, Stethoscope, Calendar, BarChart2 
} from 'lucide-react';
import { format, startOfDay, startOfWeek, startOfMonth, startOfYear, subMonths } from 'date-fns';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend 
} from 'recharts';

const COLORS = ['#3b82f6', '#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#f97316', '#6366f1'];

export default function Reports() {
  const { data: patients = [] } = useQuery({ queryKey: ['patients'], queryFn: () => base44.entities.Patient.list() });
  const { data: visits = [] } = useQuery({ queryKey: ['visits'], queryFn: () => base44.entities.Visit.list('-created_date', 200) });
  const { data: payments = [] } = useQuery({ queryKey: ['payments'], queryFn: () => base44.entities.Payment.list('-created_date', 200) });
  const { data: labOrders = [] } = useQuery({ queryKey: ['labOrders'], queryFn: () => base44.entities.LabOrder.list('-created_date', 200) });
  const { data: prescriptions = [] } = useQuery({ queryKey: ['prescriptions'], queryFn: () => base44.entities.Prescription.list('-created_date', 200) });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: doctors = [] } = useQuery({ queryKey: ['doctors'], queryFn: () => base44.entities.Doctor.list() });

  const today = startOfDay(new Date());
  const weekStart = startOfWeek(new Date());
  const monthStart = startOfMonth(new Date());
  const yearStart = startOfYear(new Date());

  const todayVisits = visits.filter(v => new Date(v.created_date) >= today);
  const weekVisits = visits.filter(v => new Date(v.created_date) >= weekStart);
  const monthVisits = visits.filter(v => new Date(v.created_date) >= monthStart);

  const paidPayments = payments.filter(p => p.status === 'paid');
  const todayRevenue = paidPayments.filter(p => new Date(p.created_date) >= today).reduce((s, p) => s + (p.amount || 0), 0);
  const weekRevenue = paidPayments.filter(p => new Date(p.created_date) >= weekStart).reduce((s, p) => s + (p.amount || 0), 0);
  const monthRevenue = paidPayments.filter(p => new Date(p.created_date) >= monthStart).reduce((s, p) => s + (p.amount || 0), 0);
  const yearRevenue = paidPayments.filter(p => new Date(p.created_date) >= yearStart).reduce((s, p) => s + (p.amount || 0), 0);

  // Disease distribution
  const diseaseMap = {};
  visits.forEach(v => { if (v.diagnosis) diseaseMap[v.diagnosis] = (diseaseMap[v.diagnosis] || 0) + 1; });
  const topDiseases = Object.entries(diseaseMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));

  // Lab tests distribution
  const labMap = {};
  labOrders.forEach(o => { labMap[o.test_type] = (labMap[o.test_type] || 0) + 1; });
  const labDist = Object.entries(labMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));

  // Doctor performance
  const doctorVisitMap = {};
  visits.forEach(v => {
    if (v.assigned_doctor) doctorVisitMap[v.assigned_doctor] = (doctorVisitMap[v.assigned_doctor] || 0) + 1;
  });
  const doctorPerf = Object.entries(doctorVisitMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, patients]) => ({ name, patients }));

  // Monthly visits trend (last 6 months)
  const monthlyData = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = subMonths(new Date(), i);
    const monthStr = format(monthDate, 'yyyy-MM');
    const count = visits.filter(v => v.visit_date?.startsWith(monthStr)).length;
    const revenue = paidPayments.filter(p => p.created_date?.startsWith(monthStr)).reduce((s, p) => s + (p.amount || 0), 0);
    monthlyData.push({ month: format(monthDate, 'MMM'), visits: count, revenue });
  }

  // Revenue by type (Distinguish Hospital Medication Orders vs Walk-In Pharmacy Sales)
  const revenueByType = {};
  paidPayments.forEach(p => {
    let typeName = p.payment_type || 'other';
    if (p.reference_type === 'walk_in_sale' || (p.payment_type === 'medicine' && !p.visit_id)) {
      typeName = 'Walk-In Pharmacy';
    } else if (p.payment_type === 'medicine') {
      typeName = 'Hospital Prescriptions';
    } else {
      typeName = typeName.charAt(0).toUpperCase() + typeName.slice(1);
    }
    revenueByType[typeName] = (revenueByType[typeName] || 0) + (p.amount || 0);
  });
  const revTypeDist = Object.entries(revenueByType).map(([name, value]) => ({ name, value }));

  // Medicine usage
  const medMap = {};
  prescriptions.forEach(rx => { if (rx.medicine_name) medMap[rx.medicine_name] = (medMap[rx.medicine_name] || 0) + 1; });
  const topMeds = Object.entries(medMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));

  const allDoctors = [...new Set([...staff.filter(s => s.role === 'doctor').map(s => s.full_name), ...doctors.map(d => d.full_name)])];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart2 className="w-6 h-6 text-primary" />Reports & Analytics
        </h1>
        <p className="text-sm text-muted-foreground">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      {/* Patient Statistics */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Patient Statistics</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Patients" value={patients.length} icon={Users} color="blue" />
          <StatCard title="Today's Visits" value={todayVisits.length} icon={Calendar} color="teal" />
          <StatCard title="This Week" value={weekVisits.length} icon={Activity} color="purple" />
          <StatCard title="This Month" value={monthVisits.length} icon={TrendingUp} color="green" />
        </div>
      </section>

      {/* Revenue */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Revenue (ETB)</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Today" value={`${todayRevenue.toLocaleString()}`} icon={DollarSign} color="green" />
          <StatCard title="This Week" value={`${weekRevenue.toLocaleString()}`} icon={TrendingUp} color="blue" />
          <StatCard title="This Month" value={`${monthRevenue.toLocaleString()}`} icon={DollarSign} color="amber" />
          <StatCard title="This Year" value={`${yearRevenue.toLocaleString()}`} icon={TrendingUp} color="purple" />
        </div>
      </section>

      {/* Summary Cards */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Department Summary</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Doctors" value={allDoctors.length} icon={Stethoscope} color="blue" />
          <StatCard title="Total Staff" value={staff.length} icon={Users} color="teal" />
          <StatCard title="Lab Tests" value={labOrders.length} icon={FlaskConical} color="purple" />
          <StatCard title="Prescriptions" value={prescriptions.length} icon={Pill} color="green" />
        </div>
      </section>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold mb-4">Monthly Visit Trends (Last 6 Months)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="visits" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold mb-4">Monthly Revenue Trend (ETB)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={v => [`${v.toLocaleString()} ETB`]} />
              <Bar dataKey="revenue" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold mb-4">Most Common Diagnoses</h3>
          {topDiseases.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topDiseases} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-10">No data yet</p>}
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold mb-4">Lab Test Distribution</h3>
          {labDist.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={labDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                  {labDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-10">No data yet</p>}
        </div>
      </div>

      {/* Charts Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold mb-4">Doctor Performance (Patient Count)</h3>
          {doctorPerf.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={doctorPerf} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                <Tooltip />
                <Bar dataKey="patients" fill="hsl(170, 60%, 45%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-10">No data yet</p>}
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold mb-4">Most Prescribed Medications</h3>
          {topMeds.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topMeds} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-10">No data yet</p>}
        </div>
      </div>

      {/* Revenue by Type */}
      {revTypeDist.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold mb-4">Revenue by Payment Type (ETB)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revTypeDist}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={v => [`${v.toLocaleString()} ETB`]} />
              <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}