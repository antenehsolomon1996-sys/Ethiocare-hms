import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Syringe, Activity, ClipboardList, Search, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

const TYPE_CONFIG = {
  medication: { icon: Syringe, label: 'Medication', badge: 'bg-violet-100 text-violet-700', iconBg: 'bg-violet-100 text-violet-600' },
  vitals: { icon: Activity, label: 'Vitals', badge: 'bg-blue-100 text-blue-700', iconBg: 'bg-blue-100 text-blue-600' },
  care: { icon: ClipboardList, label: 'Care', badge: 'bg-teal-100 text-teal-700', iconBg: 'bg-teal-100 text-teal-600' },
};

export default function NurseUnifiedTasks() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const { data: medOrders = [] } = useQuery({
    queryKey: ['medicationOrders'],
    queryFn: () => ethioCareClient.entities.MedicationOrder.list('-created_date', 200),
    refetchInterval: 10000
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ['nurseTasks'],
    queryFn: () => ethioCareClient.entities.NurseTask.list('-created_date', 100),
    refetchInterval: 10000
  });
  const { data: visits = [] } = useQuery({
    queryKey: ['visits'],
    queryFn: () => ethioCareClient.entities.Visit.list('-created_date', 100),
    refetchInterval: 15000
  });
  const { data: vitals = [] } = useQuery({
    queryKey: ['vitals'],
    queryFn: () => ethioCareClient.entities.Vital.list('-created_date', 100)
  });

  // Realtime subscriptions for immediate cross-portal sync
  useEffect(() => {
    const unsubMed = ethioCareClient.entities.MedicationOrder.subscribe(() => queryClient.invalidateQueries({ queryKey: ['medicationOrders'] }));
    const unsubTask = ethioCareClient.entities.NurseTask.subscribe(() => queryClient.invalidateQueries({ queryKey: ['nurseTasks'] }));
    const unsubVisit = ethioCareClient.entities.Visit.subscribe(() => queryClient.invalidateQueries({ queryKey: ['visits'] }));
    return () => { unsubMed(); unsubTask(); unsubVisit(); };
  }, [queryClient]);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Medication administration tasks — paid/waived, not completed or refused
  const medTasks = medOrders
    .filter(o => (o.payment_status === 'paid' || o.payment_status === 'waived') && o.administration_status !== 'completed' && o.administration_status !== 'refused')
    .map(o => ({
      id: `med-${o.id}`, type: 'medication',
      patient_name: o.patient_name, title: o.item_name,
      subtitle: [o.dosage, o.frequency, o.duration].filter(Boolean).join(' · '),
      status: o.administration_status, urgency: o.urgency,
      extra: o.instructions, link: '/nurse/medication-orders'
    }));

  // Vitals tasks — today's active visits without vitals recorded yet (registration fee paid only)
  const visitIdsWithVitals = new Set(vitals.map(v => v.visit_id));
  const vitalsTasks = visits
    .filter(v => v.visit_date === todayStr && v.status !== 'completed' && v.status !== 'cancelled' && v.registration_fee_paid === true && !visitIdsWithVitals.has(v.id))
    .map(v => ({
      id: `vit-${v.id}`, type: 'vitals',
      patient_name: v.patient_name, title: `Queue #${v.queue_number}`,
      subtitle: `Status: ${v.status?.replace(/_/g, ' ')}`,
      status: 'pending', urgency: 'routine', extra: null, link: '/nurse/vitals'
    }));

  // Care tasks — pending or in progress
  const careTasks = tasks
    .filter(t => t.status === 'pending' || t.status === 'in_progress')
    .map(t => ({
      id: `care-${t.id}`, type: 'care',
      patient_name: t.patient_name, title: t.task_type?.replace(/_/g, ' '),
      subtitle: t.description || t.instructions || '',
      status: t.status, urgency: 'routine', extra: t.instructions, link: '/nurse/tasks'
    }));

  // Combine and sort by urgency (STAT first)
  const urgencyOrder = { stat: 0, urgent: 1, routine: 2 };
  const allTasks = [...medTasks, ...vitalsTasks, ...careTasks]
    .sort((a, b) => (urgencyOrder[a.urgency] || 2) - (urgencyOrder[b.urgency] || 2));

  const filtered = allTasks.filter(t => {
    const matchFilter = filter === 'all' || t.type === filter;
    const matchSearch = !search || t.patient_name?.toLowerCase().includes(search.toLowerCase()) || t.title?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const counts = { all: allTasks.length, medication: medTasks.length, vitals: vitalsTasks.length, care: careTasks.length };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">My Tasks</h1>
        <p className="text-sm text-muted-foreground mt-0.5">All active tasks in one place — updated in real time</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search patient or task..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="all" className="text-xs flex-col gap-0.5 py-2 h-auto">
            <span>All</span><span className="text-[10px] opacity-60">{counts.all}</span>
          </TabsTrigger>
          <TabsTrigger value="medication" className="text-xs flex-col gap-0.5 py-2 h-auto">
            <span>Medication</span><span className="text-[10px] opacity-60">{counts.medication}</span>
          </TabsTrigger>
          <TabsTrigger value="vitals" className="text-xs flex-col gap-0.5 py-2 h-auto">
            <span>Vitals</span><span className="text-[10px] opacity-60">{counts.vitals}</span>
          </TabsTrigger>
          <TabsTrigger value="care" className="text-xs flex-col gap-0.5 py-2 h-auto">
            <span>Care</span><span className="text-[10px] opacity-60">{counts.care}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-10 text-center text-muted-foreground">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No active tasks</p>
          <p className="text-sm mt-1">All caught up!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => {
            const cfg = TYPE_CONFIG[task.type];
            const Icon = cfg.icon;
            const isStat = task.urgency === 'stat';
            return (
              <Link key={task.id} to={task.link}>
                <div className={`bg-card border rounded-xl p-3.5 flex items-center gap-3 transition-all hover:shadow-md ${isStat ? 'border-red-200 bg-red-50/30' : 'border-border'}`}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm truncate">{task.patient_name}</p>
                      {isStat && <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] px-1.5 py-0">STAT</Badge>}
                      <Badge variant="outline" className={`text-[10px] ${cfg.badge}`}>{cfg.label}</Badge>
                    </div>
                    <p className="text-sm text-foreground truncate">{task.title}</p>
                    {task.subtitle && <p className="text-xs text-muted-foreground truncate">{task.subtitle}</p>}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}