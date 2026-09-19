import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import StatCard from '@/components/common/StatCard';
import StatusBadge from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  Building2, Users, CheckCircle2, Clock, Search, 
  LogOut, BedSingle, ShieldCheck, AlertCircle, Sparkles 
} from 'lucide-react';
import RoomBedServiceModal from '@/components/reception/RoomBedServiceModal';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { notificationService } from '@/services/notification.service';
import { logAudit } from '@/lib/auditLogger';

export default function BedManagement() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [floorFilter, setFloorFilter] = useState('all');
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedVisitForAdmission, setSelectedVisitForAdmission] = useState(null);
  const [isDischarging, setIsDischarging] = useState(false);

  // Queries
  const { data: rooms = [], isLoading: isLoadingRooms } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => ethioCareClient.entities.Room.list(),
    refetchInterval: 15000
  });

  const { data: beds = [], isLoading: isLoadingBeds } = useQuery({
    queryKey: ['beds'],
    queryFn: () => ethioCareClient.entities.Bed.list(),
    refetchInterval: 10000
  });

  const { data: visits = [] } = useQuery({
    queryKey: ['visits'],
    queryFn: () => ethioCareClient.entities.Visit.list('-created_date', 200),
    refetchInterval: 10000
  });

  // Pending admission requests from Doctors
  const pendingRequests = useMemo(() => {
    return visits.filter(v => v.bed_status === 'bed_requested' && !v.bed_assigned);
  }, [visits]);

  // Bed stats
  const totalBeds = beds.length;
  const occupiedBeds = beds.filter(b => b.status === 'occupied').length;
  const availableBeds = beds.filter(b => b.status === 'available' || b.status === 'released').length;
  const maintenanceBeds = beds.filter(b => b.status === 'maintenance').length;

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter(r => {
      const matchFloor = floorFilter === 'all' || r.floor?.toLowerCase().includes(floorFilter.toLowerCase());
      const matchSearch = !search || 
        r.room_number?.toLowerCase().includes(search.toLowerCase()) || 
        r.department?.toLowerCase().includes(search.toLowerCase()) ||
        r.room_type?.toLowerCase().includes(search.toLowerCase());
      return matchFloor && matchSearch;
    });
  }, [rooms, floorFilter, search]);

  // Discharge patient from bed
  const handleDischargePatient = async (bed) => {
    if (!bed || bed.status !== 'occupied') return;
    const confirm = window.confirm(`Discharge patient "${bed.current_patient_name || 'Patient'}" and release bed "${bed.bed_label || bed.bed_number}"?`);
    if (!confirm) return;

    setIsDischarging(true);
    try {
      const now = new Date().toISOString();
      const patientName = bed.current_patient_name;
      const visitId = bed.current_visit_id;

      // 1. Update Bed to available
      await ethioCareClient.entities.Bed.update(bed.id, {
        status: 'available',
        current_patient_id: null,
        current_patient_name: null,
        current_visit_id: null,
        assigned_at: null
      });

      // 2. Update Visit if present
      if (visitId) {
        try {
          await ethioCareClient.entities.Visit.update(visitId, {
            bed_status: 'discharged'
          });
        } catch (vErr) {
          console.warn('Visit update warning on discharge:', vErr);
        }
      }

      // 3. Log Audit
      logAudit({
        userName: 'Reception Staff',
        userRole: 'receptionist',
        action: 'update',
        module: 'BedAssignment',
        description: `Discharged ${patientName} from bed ${bed.bed_label || bed.bed_number}. Bed marked available.`,
        recordId: bed.id,
        recordName: bed.bed_label || bed.bed_number
      });

      // 4. Dispatch notification
      notificationService.dispatch({
        title: 'Bed Released & Cleaned',
        message: `${bed.bed_label || `Bed ${bed.bed_number}`} released from ${patientName}. Now available for new admissions.`,
        type: 'info',
        module: 'patient',
        targetRoles: ['doctor', 'nurse', 'receptionist', 'owner'],
        link: '/reception/beds'
      });

      queryClient.invalidateQueries({ queryKey: ['beds'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['bed_assignments'] });

      toast.success(`${patientName || 'Patient'} discharged. Bed is now available.`);
    } catch (err) {
      console.error('[BedManagement] Error discharging patient:', err);
      toast.error(err.message || 'Failed to discharge patient from bed');
    } finally {
      setIsDischarging(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inpatient Bed Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time ward occupancy, room rates, admission workflow, and bed status tracking.
          </p>
        </div>

        {pendingRequests.length > 0 && (
          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 px-3 py-1 text-xs self-start sm:self-auto font-semibold animate-pulse">
            <AlertCircle className="w-3.5 h-3.5 mr-1" />
            {pendingRequests.length} Pending Admission {pendingRequests.length === 1 ? 'Request' : 'Requests'}
          </Badge>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Total Beds" value={totalBeds} icon={BedSingle} color="blue" />
        <StatCard title="Occupied" value={occupiedBeds} icon={Users} color="purple" />
        <StatCard title="Available" value={availableBeds} icon={CheckCircle2} color="green" />
        <StatCard title="Pending Requests" value={pendingRequests.length} icon={Clock} color="amber" />
      </div>

      {/* Pending Admission Requests Section */}
      {pendingRequests.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/10 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              Doctor Admission Requests Awaiting Bed Allocation ({pendingRequests.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Patients referred by doctors for inpatient care. Verify deposit and allocate an available bed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {pendingRequests.map(v => (
              <div 
                key={v.id} 
                className="bg-card border border-border rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-sm text-foreground">{v.patient_name}</p>
                    <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                      Admission Requested
                    </Badge>
                    {v.assigned_doctor && (
                      <span className="text-xs text-muted-foreground">
                        Referred by: <strong>Dr. {v.assigned_doctor}</strong>
                      </span>
                    )}
                  </div>
                  {v.notes && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {v.notes}
                    </p>
                  )}
                </div>

                <Button 
                  size="sm"
                  className="gap-1.5 shrink-0 self-start sm:self-auto"
                  onClick={() => {
                    setSelectedVisitForAdmission(v);
                    setAssignModalOpen(true);
                  }}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  Assign Room & Bed
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Search by room number, department..."
            className="pl-9 h-10 text-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border border-border">
          {['all', '1st Floor', '2nd Floor', '3rd Floor'].map(floor => (
            <Button
              key={floor}
              size="sm"
              variant={floorFilter === floor ? 'default' : 'ghost'}
              className="h-8 text-xs px-3 rounded-lg"
              onClick={() => setFloorFilter(floor)}
            >
              {floor === 'all' ? 'All Floors' : floor}
            </Button>
          ))}
        </div>
      </div>

      {/* Live Room & Bed Floor Plan Grid */}
      <div className="space-y-4">
        {isLoadingRooms || isLoadingBeds ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading hospital bed matrix...</p>
        ) : filteredRooms.length === 0 ? (
          <div className="bg-card border border-dashed rounded-xl p-10 text-center text-muted-foreground">
            <Building2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="font-medium">No rooms found</p>
            <p className="text-xs mt-1">Configure rooms in Admin portal or clear filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredRooms.map(room => {
              const bedsInRoom = beds.filter(b => String(b.room_id) === String(room.id));
              const occupiedCount = bedsInRoom.filter(b => b.status === 'occupied').length;
              const totalCount = bedsInRoom.length;

              return (
                <Card key={room.id} className="shadow-xs border-border/80">
                  <CardHeader className="pb-3 border-b border-border/40">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
                          {room.room_number}
                        </div>
                        <div>
                          <CardTitle className="text-base font-bold">
                            Room {room.room_number}
                          </CardTitle>
                          <CardDescription className="text-xs mt-0.5">
                            {room.department || 'Inpatient Ward'} · {room.floor || 'Floor 1'} · {room.daily_rate} ETB/day
                          </CardDescription>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
                          occupiedCount === totalCount && totalCount > 0
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200'
                        }`}>
                          {occupiedCount}/{totalCount} Occupied
                        </span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-3 space-y-2.5">
                    {bedsInRoom.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic py-2">No beds registered in this room</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {bedsInRoom.map(bed => {
                          const isOccupied = bed.status === 'occupied';
                          return (
                            <div
                              key={bed.id}
                              className={`p-3 rounded-xl border transition-all ${
                                isOccupied 
                                  ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/60' 
                                  : 'bg-muted/30 border-border'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                                  <BedSingle className={`w-3.5 h-3.5 ${isOccupied ? 'text-purple-600' : 'text-emerald-600'}`} />
                                  {bed.bed_number}
                                </span>
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                                  isOccupied 
                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-200' 
                                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200'
                                }`}>
                                  {isOccupied ? 'Occupied' : 'Available'}
                                </Badge>
                              </div>

                              {isOccupied ? (
                                <div className="space-y-1.5 mt-2 pt-2 border-t border-purple-200/50 dark:border-purple-800/40">
                                  <p className="text-xs font-semibold text-foreground truncate">
                                    {bed.current_patient_name || 'Patient'}
                                  </p>
                                  {bed.assigned_at && (
                                    <p className="text-[10px] text-muted-foreground">
                                      Since: {format(new Date(bed.assigned_at), 'MMM d, h:mm a')}
                                    </p>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full h-7 text-[11px] text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 mt-1"
                                    onClick={() => handleDischargePatient(bed)}
                                    disabled={isDischarging}
                                  >
                                    <LogOut className="w-3 h-3 mr-1" />
                                    Discharge / Release
                                  </Button>
                                </div>
                              ) : (
                                <p className="text-[11px] text-muted-foreground mt-2">
                                  Ready for admission
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Assignment Modal */}
      {selectedVisitForAdmission && (
        <RoomBedServiceModal
          open={assignModalOpen}
          onOpenChange={(val) => {
            setAssignModalOpen(val);
            if (!val) setSelectedVisitForAdmission(null);
          }}
          visit={selectedVisitForAdmission}
          onAssigned={() => {
            queryClient.invalidateQueries({ queryKey: ['beds'] });
            queryClient.invalidateQueries({ queryKey: ['visits'] });
            setSelectedVisitForAdmission(null);
          }}
        />
      )}
    </div>
  );
}
