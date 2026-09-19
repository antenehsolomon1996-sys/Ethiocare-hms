import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import DataTable from '@/components/common/DataTable';
import StatusBadge from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Building2, Plus, Pencil, Trash2, BedSingle, Users, CheckCircle2, AlertTriangle, Shield, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { logAudit } from '@/lib/auditLogger';

export default function RoomBedManagement() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('rooms');

  // Room modal state
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [roomForm, setRoomForm] = useState({
    room_number: '',
    room_type: 'standard',
    department: 'Inpatient Ward',
    floor: '1st Floor',
    daily_rate: '500',
    status: 'available'
  });

  // Bed modal state
  const [bedModalOpen, setBedModalOpen] = useState(false);
  const [editingBed, setEditingBed] = useState(null);
  const [bedForm, setBedForm] = useState({
    room_id: '',
    bed_number: '',
    bed_label: '',
    status: 'available'
  });

  const [saving, setSaving] = useState(false);

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

  const { data: assignments = [], isLoading: isLoadingAssignments } = useQuery({
    queryKey: ['bed_assignments'],
    queryFn: () => ethioCareClient.entities.BedAssignment.list('-created_date', 100),
    refetchInterval: 15000
  });

  // Room Handlers
  const handleOpenRoomModal = (room = null) => {
    if (room) {
      setEditingRoom(room);
      setRoomForm({
        room_number: room.room_number || '',
        room_type: room.room_type || 'standard',
        department: room.department || 'Inpatient Ward',
        floor: room.floor || '1st Floor',
        daily_rate: String(room.daily_rate || 500),
        status: room.status || 'available'
      });
    } else {
      setEditingRoom(null);
      setRoomForm({
        room_number: '',
        room_type: 'standard',
        department: 'Inpatient Ward',
        floor: '1st Floor',
        daily_rate: '500',
        status: 'available'
      });
    }
    setRoomModalOpen(true);
  };

  const handleSaveRoom = async () => {
    if (!roomForm.room_number.trim()) {
      toast.error('Room number is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...roomForm,
        room_number: roomForm.room_number.trim(),
        daily_rate: parseFloat(roomForm.daily_rate) || 500
      };

      if (editingRoom) {
        await ethioCareClient.entities.Room.update(editingRoom.id, payload);
        toast.success(`Room ${payload.room_number} updated`);
      } else {
        await ethioCareClient.entities.Room.create(payload);
        toast.success(`Room ${payload.room_number} created`);
      }
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setRoomModalOpen(false);
    } catch (err) {
      console.error('Error saving room:', err);
      toast.error(err.message || 'Failed to save room');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRoom = async (room) => {
    const bedsInRoom = beds.filter(b => String(b.room_id) === String(room.id));
    if (bedsInRoom.some(b => b.status === 'occupied')) {
      toast.error('Cannot delete room while beds are currently occupied');
      return;
    }
    const confirm = window.confirm(`Delete Room ${room.room_number} and all associated beds?`);
    if (!confirm) return;

    try {
      await ethioCareClient.entities.Room.delete(room.id);
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['beds'] });
      toast.success(`Room ${room.room_number} deleted`);
    } catch (err) {
      toast.error(err.message || 'Failed to delete room');
    }
  };

  // Bed Handlers
  const handleOpenBedModal = (bed = null) => {
    if (bed) {
      setEditingBed(bed);
      setBedForm({
        room_id: String(bed.room_id || ''),
        bed_number: bed.bed_number || '',
        bed_label: bed.bed_label || '',
        status: bed.status || 'available'
      });
    } else {
      setEditingBed(null);
      setBedForm({
        room_id: rooms[0]?.id ? String(rooms[0].id) : '',
        bed_number: '',
        bed_label: '',
        status: 'available'
      });
    }
    setBedModalOpen(true);
  };

  const handleSaveBed = async () => {
    if (!bedForm.room_id || !bedForm.bed_number.trim()) {
      toast.error('Room and bed number are required');
      return;
    }
    setSaving(true);
    try {
      const room = rooms.find(r => String(r.id) === String(bedForm.room_id));
      const bedNumber = bedForm.bed_number.trim().toUpperCase();
      const label = bedForm.bed_label?.trim() || `Room ${room?.room_number || ''} - Bed ${bedNumber}`;

      const payload = {
        room_id: bedForm.room_id,
        bed_number: bedNumber,
        bed_label: label,
        status: bedForm.status
      };

      if (editingBed) {
        await ethioCareClient.entities.Bed.update(editingBed.id, payload);
        toast.success(`Bed ${bedNumber} updated`);
      } else {
        await ethioCareClient.entities.Bed.create(payload);
        toast.success(`Bed ${bedNumber} created in Room ${room?.room_number}`);
      }
      queryClient.invalidateQueries({ queryKey: ['beds'] });
      setBedModalOpen(false);
    } catch (err) {
      console.error('Error saving bed:', err);
      toast.error(err.message || 'Failed to save bed');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBed = async (bed) => {
    if (bed.status === 'occupied') {
      toast.error('Cannot delete an occupied bed');
      return;
    }
    const confirm = window.confirm(`Delete Bed ${bed.bed_label || bed.bed_number}?`);
    if (!confirm) return;

    try {
      await ethioCareClient.entities.Bed.delete(bed.id);
      queryClient.invalidateQueries({ queryKey: ['beds'] });
      toast.success('Bed deleted');
    } catch (err) {
      toast.error(err.message || 'Failed to delete bed');
    }
  };

  // Direct Bed Status Changer
  const handleUpdateBedStatus = async (bedId, newStatus) => {
    try {
      await ethioCareClient.entities.Bed.update(bedId, { status: newStatus });
      queryClient.invalidateQueries({ queryKey: ['beds'] });
      toast.success(`Bed status updated to ${newStatus}`);
    } catch (err) {
      toast.error(err.message || 'Failed to update bed status');
    }
  };

  // Rooms Columns
  const roomColumns = [
    { header: 'Room No.', cell: (r) => <span className="font-bold text-foreground">Room {r.room_number}</span> },
    { header: 'Type', cell: (r) => <span className="capitalize">{r.room_type?.replace(/_/g, ' ')}</span> },
    { header: 'Department', accessor: 'department' },
    { header: 'Floor', accessor: 'floor' },
    { header: 'Daily Rate (ETB)', cell: (r) => <span className="font-mono font-bold text-primary">{r.daily_rate} ETB</span> },
    { header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
    { 
      header: 'Beds', 
      cell: (r) => {
        const count = beds.filter(b => String(b.room_id) === String(r.id)).length;
        return <Badge variant="outline">{count} registered</Badge>;
      } 
    },
    {
      header: 'Actions',
      cell: (r) => (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleOpenRoomModal(r)}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => handleDeleteRoom(r)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      )
    }
  ];

  // Beds Columns
  const bedColumns = [
    { header: 'Bed Label / ID', accessor: 'bed_label' },
    { 
      header: 'Room', 
      cell: (b) => {
        const r = rooms.find(room => String(room.id) === String(b.room_id));
        return <span>{r ? `Room ${r.room_number} (${r.department})` : 'Unknown'}</span>;
      }
    },
    { 
      header: 'Current Status', 
      cell: (b) => (
        <Select value={b.status} onValueChange={(val) => handleUpdateBedStatus(b.id, val)}>
          <SelectTrigger className="h-7 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="occupied">Occupied</SelectItem>
            <SelectItem value="reserved">Reserved</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
            <SelectItem value="released">Released</SelectItem>
          </SelectContent>
        </Select>
      )
    },
    { 
      header: 'Occupant', 
      cell: (b) => (
        b.current_patient_name ? (
          <span className="font-semibold text-purple-700 dark:text-purple-300 text-xs">
            {b.current_patient_name}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs italic">None</span>
        )
      )
    },
    {
      header: 'Actions',
      cell: (b) => (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleOpenBedModal(b)}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => handleDeleteBed(b)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      )
    }
  ];

  // Assignments Columns
  const assignmentColumns = [
    { header: 'Patient', accessor: 'patient_name' },
    { header: 'Admission Date', cell: (a) => format(new Date(a.admission_date || a.created_at), 'yyyy-MM-dd HH:mm') },
    { header: 'Discharge Date', cell: (a) => a.discharge_date ? format(new Date(a.discharge_date), 'yyyy-MM-dd HH:mm') : <span className="text-purple-600 font-semibold">Active Stay</span> },
    { header: 'Rate (ETB)', accessor: 'daily_rate' },
    { header: 'Payment Status', cell: (a) => <StatusBadge status={a.payment_status} /> },
    { header: 'Status', cell: (a) => <StatusBadge status={a.status} /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Room & Bed Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure hospital rooms, bed numbers, daily admission tariffs, and operational statuses.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => handleOpenRoomModal()}>
            <Plus className="w-4 h-4" />
            Add Room
          </Button>
          <Button className="gap-2" onClick={() => handleOpenBedModal()}>
            <Plus className="w-4 h-4" />
            Add Bed
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 max-w-md">
          <TabsTrigger value="rooms">Rooms ({rooms.length})</TabsTrigger>
          <TabsTrigger value="beds">Beds ({beds.length})</TabsTrigger>
          <TabsTrigger value="history">Stay Logs ({assignments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="rooms" className="mt-4">
          <DataTable columns={roomColumns} data={rooms} isLoading={isLoadingRooms} emptyMessage="No hospital rooms configured" />
        </TabsContent>

        <TabsContent value="beds" className="mt-4">
          <DataTable columns={bedColumns} data={beds} isLoading={isLoadingBeds} emptyMessage="No beds configured" />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <DataTable columns={assignmentColumns} data={assignments} isLoading={isLoadingAssignments} emptyMessage="No admission history recorded yet" />
        </TabsContent>
      </Tabs>

      {/* Room Modal */}
      <Dialog open={roomModalOpen} onOpenChange={setRoomModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRoom ? 'Edit Hospital Room' : 'Add New Hospital Room'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label>Room Number / Identifier *</Label>
              <Input
                placeholder="e.g. 101, 204, ICU-1"
                value={roomForm.room_number}
                onChange={e => setRoomForm(f => ({ ...f, room_number: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Room Type</Label>
                <Select value={roomForm.room_type} onValueChange={val => setRoomForm(f => ({ ...f, room_type: val }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general_ward">General Ward</SelectItem>
                    <SelectItem value="standard">Standard Inpatient</SelectItem>
                    <SelectItem value="semi_private">Semi-Private</SelectItem>
                    <SelectItem value="private">Private Room</SelectItem>
                    <SelectItem value="icu">ICU</SelectItem>
                    <SelectItem value="pediatric">Pediatric Ward</SelectItem>
                    <SelectItem value="maternity">Maternity Ward</SelectItem>
                    <SelectItem value="emergency">Emergency Bay</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Floor</Label>
                <Select value={roomForm.floor} onValueChange={val => setRoomForm(f => ({ ...f, floor: val }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ground Floor">Ground Floor</SelectItem>
                    <SelectItem value="1st Floor">1st Floor</SelectItem>
                    <SelectItem value="2nd Floor">2nd Floor</SelectItem>
                    <SelectItem value="3rd Floor">3rd Floor</SelectItem>
                    <SelectItem value="4th Floor">4th Floor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Department</Label>
                <Input
                  value={roomForm.department}
                  onChange={e => setRoomForm(f => ({ ...f, department: e.target.value }))}
                  placeholder="e.g. Inpatient Ward"
                />
              </div>

              <div>
                <Label>Daily Rate (ETB)</Label>
                <Input
                  type="number"
                  min="0"
                  value={roomForm.daily_rate}
                  onChange={e => setRoomForm(f => ({ ...f, daily_rate: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label>Room Status</Label>
              <Select value={roomForm.status} onValueChange={val => setRoomForm(f => ({ ...f, status: val }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available / Open</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRoomModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveRoom} disabled={saving}>
              {saving ? 'Saving...' : editingRoom ? 'Save Changes' : 'Create Room'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bed Modal */}
      <Dialog open={bedModalOpen} onOpenChange={setBedModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBed ? 'Edit Bed' : 'Register New Bed'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label>Assign to Room *</Label>
              <Select value={bedForm.room_id} onValueChange={val => setBedForm(f => ({ ...f, room_id: val }))}>
                <SelectTrigger><SelectValue placeholder="Choose room..." /></SelectTrigger>
                <SelectContent>
                  {rooms.map(r => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      Room {r.room_number} ({r.department || r.room_type} · {r.floor})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Bed Number / Code *</Label>
              <Input
                placeholder="e.g. B-01, B-02, Bed 1"
                value={bedForm.bed_number}
                onChange={e => setBedForm(f => ({ ...f, bed_number: e.target.value }))}
              />
            </div>

            <div>
              <Label>Display Label (optional)</Label>
              <Input
                placeholder="e.g. Room 204 - Bed B-02"
                value={bedForm.bed_label}
                onChange={e => setBedForm(f => ({ ...f, bed_label: e.target.value }))}
              />
            </div>

            <div>
              <Label>Initial Status</Label>
              <Select value={bedForm.status} onValueChange={val => setBedForm(f => ({ ...f, status: val }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="reserved">Reserved</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBedModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveBed} disabled={saving}>
              {saving ? 'Saving...' : editingBed ? 'Save Changes' : 'Register Bed'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
