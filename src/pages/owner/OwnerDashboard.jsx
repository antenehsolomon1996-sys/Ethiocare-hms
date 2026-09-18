import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import StatCard from '@/components/common/StatCard';
import StatusBadge from '@/components/common/StatusBadge';
import {
  Users, Heart, DollarSign, FlaskConical, Pill, Activity,
  TrendingUp, Calendar, Stethoscope, Shield, BarChart2, ArrowRight,
  Wallet, AlertTriangle, ArrowUpRight, CreditCard
} from 'lucide-react';
import { format, startOfDay, startOfWeek, startOfMonth, startOfYear } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { salaryService } from '@/services/salary.service';
import { financeService } from '@/services/finance.service';

const COLORS = ['hsl(222 85% 50%)', 'hsl(190 85% 45%)', 'hsl(280 55% 55%)', 'hsl(35 90% 50%)', 'hsl(0 75% 55%)', 'hsl(142 65% 42%)'];

export default function OwnerDashboard() {
  const { data: patients = [] } = useQuery({ queryKey: ['patients'], queryFn: () => base44.entities.Patient.list() });
  const { data: visits = [] } = useQuery({ queryKey: ['visits'], queryFn: () => base44.entities.Visit.list('-created_date', 100) });
  const { data: payments = [] } = useQuery({ queryKey: ['payments'], queryFn: () => base44.entities.Payment.list('-created_date', 100) });
  const { data: labOrders = [] } = useQuery({ queryKey: ['labOrders'], queryFn: () => base44.entities.LabOrder.list('-created_date', 50) });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: doctors = [] } = useQuery({ queryKey: ['doctors'], queryFn: () => base44.entities.Doctor.list() });

  const { data: finSummary } = useQuery({
    queryKey: ['financialSummary'],
    queryFn: () => financeService.getFinancialSummary(),
  });

  const { data: salaryAlerts = [] } = useQuery({
    queryKey: ['salaryDueAlerts'],
    queryFn: () => salaryService.getSalaryDueNotifications(new Date()),
  });

  const today = startOfDay(new Date());
  const weekStart = startOfWeek(new Date());
  const monthStart = startOfMonth(new Date());
  const yearStart = startOfYear(new Date());

  const todayVisits = visits.filter(v => new Date(v.created_date) >= today);
  const weekVisits = visits.filter(v => new Date(v.created_date) >= weekStart);
  const monthVisits = visits.filter(v => new Date(v.created_date) >= monthStart);

  const todayRevenue = finSummary?.today.income ?? payments.filter(p => p.status === 'paid' && new Date(p.created_date) >= today).reduce((s, p) => s + (p.amount || 0), 0);
  const weekRevenue = finSummary?.thisWeek.income ?? payments.filter(p => p.status === 'paid' && new Date(p.created_date) >= weekStart).reduce((s, p) => s + (p.amount || 0), 0);
  const monthRevenue = finSummary?.thisMonth.income ?? payments.filter(p => p.status === 'paid' && new Date(p.created_date) >= monthStart).reduce((s, p) => s + (p.amount || 0), 0);
  const yearRevenue = payments.filter(p => p.status === 'paid' && new Date(p.created_date) >= yearStart).reduce((s, p) => s + (p.amount || 0), 0);

  const diseaseMap = {};
  visits.forEach(v => { if (v.diagnosis) diseaseMap[v.diagnosis] = (diseaseMap[v.diagnosis] || 0) + 1; });
  const topDiseases = Object.entries(diseaseMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));

  const labMap = {};
  labOrders.forEach(o => { labMap[o.test_type] = (labMap[o.test_type] || 0) + 1; });
  const labDist = Object.entries(labMap).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value }));

  const activeDoctorCount = [...new Set([
    ...staff.filter(s => s.role === 'doctor' && s.status === 'active').map(s => s.full_name),
    ...doctors.filter(d => d.status === 'active').map(d => d.full_name)
  ])].length;

  const specialtyMap = {};
  doctors.forEach(d => { specialtyMap[d.specialty] = (specialtyMap[d.specialty] || 0) + 1; });
  const specialtyDist = Object.entries(specialtyMap).slice(0, 6).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <Link to="/owner/reports">
          <Button variant="outline" size="sm">
            <BarChart2 className="w-4 h-4 mr-2" />Full Reports
          </Button>
        </Link>
      </div>

      {/* Salary Due Notifications Widget */}
      {salaryAlerts.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                  Staff Salary Payments Approaching / Due ({salaryAlerts.length})
                </h3>
                <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10 text-[10px]">
                  Payroll Alert
                </Badge>
              </div>
              <p className="text-xs text-amber-800/90 dark:text-amber-400/90 mt-0.5">
                {salaryAlerts.slice(0, 2).map(a => `${a.employeeName} (${a.urgencyLabel})`).join(', ')}
                {salaryAlerts.length > 2 ? ` and ${salaryAlerts.length - 2} more staff` : ''}
              </p>
            </div>
          </div>
          <Link to="/owner/salaries">
            <Button size="sm" variant="secondary" className="bg-amber-600 hover:bg-amber-700 text-white text-xs whitespace-nowrap">
              Manage Payroll <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </Link>
        </div>
      )}

      {/* Patient Stats */}
      <div>
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Patient Statistics</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="Total Patients" value={patients.length} icon={Users} color="blue" />
          <StatCard title="Today's Visits" value={todayVisits.length} icon={Calendar} color="teal" />
          <StatCard title="This Week" value={weekVisits.length} icon={Activity} color="purple" />
          <StatCard title="This Month" value={monthVisits.length} icon={TrendingUp} color="green" />
        </div>
      </div>

      {/* Revenue & Net Profit Stats */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Hospital Finances &amp; Margins</h2>
          <Link to="/owner/finances" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
            Finance Tracker <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            title="Today's Net"
            value={`${(finSummary?.today.net ?? 0).toLocaleString()} ETB`}
            subtitle={`In: ${(finSummary?.today.income ?? 0).toLocaleString()} | Out: ${(finSummary?.today.expense ?? 0).toLocaleString()}`}
            icon={DollarSign}
            color={(finSummary?.today.net ?? 0) >= 0 ? 'green' : 'rose'}
          />
          <StatCard
            title="This Month's Net"
            value={`${(finSummary?.thisMonth.net ?? 0).toLocaleString()} ETB`}
            subtitle={`In: ${(finSummary?.thisMonth.income ?? 0).toLocaleString()} | Out: ${(finSummary?.thisMonth.expense ?? 0).toLocaleString()}`}
            icon={TrendingUp}
            color={(finSummary?.thisMonth.net ?? 0) >= 0 ? 'blue' : 'rose'}
          />
          <StatCard
            title="Total Revenue"
            value={`${(finSummary?.total.income ?? monthRevenue).toLocaleString()} ETB`}
            subtitle="All recorded clinical & pharmacy income"
            icon={Wallet}
            color="amber"
          />
          <StatCard
            title="Total Expenses"
            value={`${(finSummary?.total.expense ?? 0).toLocaleString()} ETB`}
            subtitle="Salaries, supplies & operating costs"
            icon={DollarSign}
            color="purple"
          />
        </div>
      </div>

      {/* Staff Summary */}
      <div>
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Staff Overview</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="Active Doctors" value={activeDoctorCount} icon={Stethoscope} color="blue" />
          <StatCard title="Total Staff" value={staff.length} icon={Users} color="teal" />
          <StatCard title="Lab Orders" value={labOrders.length} icon={FlaskConical} color="purple" />
          <StatCard title="Specialties" value={Object.keys(specialtyMap).length} icon={Heart} color="green" />
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { to: '/owner/finances', icon: DollarSign, label: 'Finance Tracker', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
          { to: '/owner/salaries', icon: Wallet, label: 'Employee Salaries', color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/30' },
          { to: '/owner/doctors', icon: Stethoscope, label: 'Doctor Management', color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30' },
          { to: '/owner/staff', icon: Users, label: 'Staff Management', color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/30' },
          { to: '/owner/fees', icon: CreditCard, label: 'Fee Management', color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30' },
          { to: '/owner/reports', icon: BarChart2, label: 'Reports & Analytics', color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/30' },
        ].map(({ to, icon: QuickIcon, label, color }) => (
          <Link key={to} to={to} className="card-hover bg-card border border-border/60 rounded-xl p-3 hover:border-primary/30 group">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${color}`}>
              <QuickIcon className="w-4 h-4" />
            </div>
            <p className="text-xs font-semibold leading-snug">{label}</p>
            <ArrowRight className="w-3 h-3 text-muted-foreground mt-1 group-hover:translate-x-1 transition-transform" />
          </Link>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-sm font-bold">Most Common Diagnoses</h3>
            <Link to="/owner/reports" className="text-xs text-primary font-medium hover:underline">View All</Link>
          </div>
          {topDiseases.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topDiseases}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(215 15% 45%)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(215 15% 45%)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid hsl(220 15% 91%)', boxShadow: '0 4px 24px -6px rgba(0,0,0,0.08)' }} />
                <Bar dataKey="count" fill="hsl(222 85% 50%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">No diagnosis data yet</p>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-sm font-bold">Lab Tests Distribution</h3>
            <Link to="/owner/reports" className="text-xs text-primary font-medium hover:underline">View All</Link>
          </div>
          {labDist.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={labDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                  {labDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid hsl(220 15% 91%)' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">No lab data yet</p>
          )}
        </div>
      </div>

      {/* Recent Visits */}
      <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-sm font-bold">Recent Visits</h3>
          <Link to="/owner/patients" className="text-xs text-primary font-medium hover:underline">View All</Link>
        </div>
        <div className="space-y-2">
          {visits.slice(0, 8).map(v => (
            <div key={v.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/40 transition-colors">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{v.patient_name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {v.assigned_doctor ? `Dr. ${v.assigned_doctor}` : 'Not assigned'} · {v.diagnosis || 'Pending diagnosis'}
                </p>
              </div>
              <StatusBadge status={v.status} />
            </div>
          ))}
          {visits.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No visits yet</p>}
        </div>
      </div>
    </div>
  );
}