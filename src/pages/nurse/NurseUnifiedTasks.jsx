import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Syringe, Activity, ClipboardList, Search, ChevronRight, Building2, User, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';

const TYPE_CONFIG = {
  medication: { icon: Syringe, label: 'Medication', badge: 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300', iconBg: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400' },
  vitals: { icon: Activity, label: 'Vitals', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300', iconBg: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' },
  care: { icon: ClipboardList, label: 'Care', badge: 'bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300', iconBg: 'bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400' },
};

export default function NurseUnifiedTasks() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [filter, setFilter] = useState('all');
  const [scope, setScope] = useState('my'); // 'my' | 'all'
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

  // Helper to resolve room & bed info
  const getBedInfo = (patientId, visitId) => {
    const v = (visitId && visits.find(vis => vis.id === visitId)) || 
              (patientId && visits.find(vis => vis.patient_id === patientId && (vis.bed_assigned || vis.room_number)));
    if (v && v.room_number && v.bed_number) {
      return `Room ${v.room_number} → Bed ${v.bed_number}`;
    }
    if (v && v.room_number) {
      return `Room ${v.room_number}`;
    }
    return null;
  };

  // Helper for nurse assignment filtering
  const isAssignedToMe = (item) => {
    if (!user) return true;
    const myId = String(user.id || '').trim();
    const myName = String(user.full_name || '').toLowerCase().trim();

    const assignedId = String(item.assigned_nurse_id || '').trim();
    const assignedName = String(item.assigned_nurse_name || '').toLowerCase().trim();

    // If unassigned, available to any nurse on duty
    if (!assignedId && !assignedName) return true;
    // If assigned to this nurse specifically
    if (assignedId && myId && assignedId === myId) return true;
    if (assignedName && myName && (assignedName.includes(myName) || myName.includes(assignedName))) return true;
    return false;
  };

  // Medication administration tasks — paid/waived, not completed or refused
  const medTasks = useMemo(() => {
    return medOrders
      .filter(o => (o.payment_status === 'paid' || o.payment_status === 'waived') && o.administration_status !== 'completed' && o.administration_status !== 'refused')
      .map(o => ({
        id: `med-${o.id}`,
        type: 'medication',
        patient_name: o.patient_name,
        patient_id: o.patient_id,
        visit_id: o.visit_id,
        title: o.item_name,
        subtitle: [o.dosage, o.frequency, o.duration].filter(Boolean).join(' · '),
        status: o.administration_status,
        urgency: o.urgency,
        extra: o.instructions,
        link: '/nurse/medication-orders',
        assigned_nurse_id: o.assigned_nurse_id,
        assigned_nurse_name: o.assigned_nurse_name,
        bedInfo: getBedInfo(o.patient_id, o.visit_id)
      }));
  }, [medOrders, visits]);

  // Vitals tasks — today's active visits without vitals recorded yet (registration fee paid only)
  const visitIdsWithVitals = useMemo(() => new Set(vitals.map(v => v.visit_id)), [vitals]);
  const vitalsTasks = useMemo(() => {
    return visits
      .filter(v => v.visit_date === todayStr && v.status !== 'completed' && v.status !== 'cancelled' && v.registration_fee_paid === true && !visitIdsWithVitals.has(v.id))
      .map(v => ({
        id: `vit-${v.id}`,
        type: 'vitals',
        patient_name: v.patient_name,
        patient_id: v.patient_id,
        visit_id: v.id,
        title: `Queue #${v.queue_number}`,
        subtitle: `Status: ${v.status?.replace(/_/g, ' ')}`,
        status: 'pending',
        urgency: 'routine',
        extra: null,
        link: '/nurse/vitals',
        assigned_nurse_id: v.assigned_nurse_id,
        assigned_nurse_name: v.assigned_nurse_name,
        bedInfo: getBedInfo(v.patient_id, v.id)
      }));
  }, [visits, visitIdsWithVitals, todayStr]);

  // Care tasks — pending or in progress
  const careTasks = useMemo(() => {
    return tasks
      .filter(t => t.status === 'pending' || t.status === 'in_progress')
      .map(t => ({
        id: `care-${t.id}`,
        type: 'care',
        patient_name: t.patient_name,
        patient_id: t.patient_id,
        visit_id: t.visit_id,
        title: t.task_type?.replace(/_/g, ' '),
        subtitle: t.description || t.instructions || '',
        status: t.status,
        urgency: 'routine',
        extra: t.instructions,
        link: '/nurse/tasks',
        assigned_nurse_id: t.assigned_nurse_id,
        assigned_nurse_name: t.assigned_nurse_name,
        bedInfo: getBedInfo(t.patient_id, t.visit_id)
      }));
  }, [tasks, visits]);

  // Combine and sort by urgency (STAT first)
  const urgencyOrder = { stat: 0, urgent: 1, routine: 2 };
  const allTasks = useMemo(() => {
    return [...medTasks, ...vitalsTasks, ...careTasks]
      .sort((a, b) => (urgencyOrder[a.urgency] || 2) - (urgencyOrder[b.urgency] || 2));
  }, [medTasks, vitalsTasks, careTasks]);

  // Filter by scope (my assigned vs all ward) and search / type filter
  const scopedTasks = useMemo(() => {
    if (scope === 'my') {
      return allTasks.filter(isAssignedToMe);
    }
    return allTasks;
  }, [allTasks, scope, user]);

  const filtered = useMemo(() => {
    return scopedTasks.filter(t => {
      const matchFilter = filter === 'all' || t.type === filter;
      const matchSearch = !search || 
        t.patient_name?.toLowerCase().includes(search.toLowerCase()) || 
        t.title?.toLowerCase().includes(search.toLowerCase()) ||
        t.bedInfo?.toLowerCase().includes(search.toLowerCase());
      return matchFilter && matchSearch;
    });
  }, [scopedTasks, filter, search]);

  const counts = {
    all: scopedTasks.length,
    medication: scopedTasks.filter(t => t.type === 'medication').length,
    vitals: scopedTasks.filter(t => t.type === 'vitals').length,
    care: scopedTasks.filter(t => t.type === 'care').length
  };

  return (
    <div className="space-y-4">
      {/* Header with Scope Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {user?.full_name ? `Welcome, ${user.full_name}` : 'Nurse Care & Tasks'}
          </h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-muted-foreground">
            <span>Staff ID: <strong className="font-mono text-foreground">{user?.id?.slice(0, 8).toUpperCase() || 'NURS-01'}</strong></span>
            <span>•</span>
            {user?.assigned_room_number ? (
              <Badge variant="outline" className="text-[11px] font-mono bg-primary/10 text-primary border-primary/30">
                <Building2 className="w-3 h-3 mr-1" />
                Station: Room {user.assigned_room_number}
              </Badge>
            ) : (
              <span className="italic">General Nursing Station</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border border-border shrink-0 self-start sm:self-auto">
          <Button
            size="sm"
            variant={scope === 'my' ? 'default' : 'ghost'}
            className="h-8 text-xs font-medium rounded-lg px-3"
            onClick={() => setScope('my')}
          >
            <User className="w-3.5 h-3.5 mr-1.5" />
            Assigned to Me
          </Button>
          <Button
            size="sm"
            variant={scope === 'all' ? 'default' : 'ghost'}
            className="h-8 text-xs font-medium rounded-lg px-3"
            onClick={() => setScope('all')}
          >
            <Building2 className="w-3.5 h-3.5 mr-1.5" />
            All Ward Tasks
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by patient, task, or room/bed..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
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
          <p className="text-sm mt-1">
            {scope === 'my' ? 'You have no assigned tasks right now. Switch to "All Ward Tasks" to view available duties.' : 'All ward tasks caught up!'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(task => {
            const cfg = TYPE_CONFIG[task.type];
            const Icon = cfg.icon;
            const isStat = task.urgency === 'stat';
            return (
              <Link key={task.id} to={task.link}>
                <div className={`bg-card border rounded-xl p-4 flex items-center gap-3.5 transition-all hover:shadow-md ${isStat ? 'border-red-300 dark:border-red-900 bg-red-50/40 dark:bg-red-950/20' : 'border-border'}`}>
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-bold text-sm text-foreground truncate">{task.patient_name}</p>
                      
                      {/* Prominent Bed Information Display */}
                      {task.bedInfo && (
                        <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[11px] font-semibold px-2 py-0.5 flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {task.bedInfo} → {task.patient_name}
                        </Badge>
                      )}

                      {isStat && <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] px-1.5 py-0 font-bold">STAT</Badge>}
                      <Badge variant="outline" className={`text-[10px] ${cfg.badge}`}>{cfg.label}</Badge>
                      
                      {task.assigned_nurse_name && (
                        <span className="text-[10px] text-muted-foreground bg-muted/80 px-2 py-0.5 rounded-full font-medium">
                          Assigned: {task.assigned_nurse_name}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                    {task.subtitle && <p className="text-xs text-muted-foreground truncate mt-0.5">{task.subtitle}</p>}
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