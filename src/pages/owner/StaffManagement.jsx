import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import StatusBadge from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Search, Pencil, Trash2, CheckCircle2, Clock, KeyRound, Copy, RefreshCw, Mail, AtSign, Building2, Eye } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';

const HOSPITAL_DOMAIN = 'grandhorizonhospital.com';

const ROLES = [
  { value: 'owner', label: 'Hospital Owner' },
  { value: 'receptionist', label: 'Receptionist' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'nurse', label: 'Nurse' },
  { value: 'lab_technician', label: 'Lab Technician' },
  { value: 'pharmacist', label: 'Pharmacist' },
  { value: 'accountant', label: 'Accountant' },
];

const SPECIALTIES = [
  'General Practice', 'Cardiology', 'Pediatrics', 'Surgery', 'Internal Medicine',
  'Obstetrics & Gynecology', 'Orthopedics', 'Neurology', 'Dermatology', 'Ophthalmology',
  'ENT', 'Psychiatry', 'Emergency Medicine', 'Other'
];

const emptyForm = { 
  full_name: '', 
  email: '', 
  personal_email: '', 
  username: '', 
  role: 'doctor', 
  department: '', 
  specialization: '', 
  phone: '', 
  license_number: '', 
  status: 'active',
  assigned_room_id: '',
  assigned_room_number: ''
};

function generateActivationCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segment = (n) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `HMS-${segment(4)}-${segment(4)}`;
}

function generateHospitalEmail(fullName, existingEmails = []) {
  const cleanName = fullName.toLowerCase().trim().replace(/[^a-z\s]/g, '');
  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const base = parts.length >= 2 ? `${parts[0]}.${parts.slice(1).join('')}` : parts[0];
  const truncatedBase = base.substring(0, 30);
  let email = `${truncatedBase}@${HOSPITAL_DOMAIN}`;
  let counter = 2;
  const existing = existingEmails.map(e => e?.toLowerCase());
  while (existing.includes(email.toLowerCase())) {
    email = `${truncatedBase}${counter}@${HOSPITAL_DOMAIN}`;
    counter++;
  }
  return email;
}

function generateUsername(fullName, existingUsernames = []) {
  const cleanName = fullName.toLowerCase().trim().replace(/[^a-z\s]/g, '');
  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const base = parts.length >= 2 ? `${parts[0]}.${parts[1].substring(0, 10)}` : parts[0];
  const truncatedBase = base.substring(0, 20);
  let username = truncatedBase;
  let counter = 2;
  const existing = existingUsernames.map(u => u?.toLowerCase());
  while (existing.includes(username.toLowerCase())) {
    username = `${truncatedBase}${counter}`;
    counter++;
  }
  return username;
}

export default function StaffManagement() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [generatedCreds, setGeneratedCreds] = useState(null);
  const [detailStaff, setDetailStaff] = useState(null);
  const queryClient = useQueryClient();

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: () => ethioCareClient.entities.Staff.list('-created_date', 200)
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => ethioCareClient.entities.User.list()
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => ethioCareClient.entities.Room.list(),
    refetchInterval: 15000
  });

  const getUserStatus = (email) => {
    const user = users.find(u => u.email?.toLowerCase() === email?.toLowerCase());
    if (!user) return 'invited';
    return 'registered';
  };

  // Auto-generate hospital email + username when name changes (new staff only)
  useEffect(() => {
    if (!editId && form.full_name && form.full_name.trim().length >= 3) {
      const existingEmails = staff.map(s => s.email);
      const existingUsernames = staff.map(s => s.username);
      const generatedEmail = generateHospitalEmail(form.full_name, existingEmails);
      const generatedUsername = generateUsername(form.full_name, existingUsernames);
      // Only update if the email is still the auto-generated one or empty
      if (!form.email || form.email === generateHospitalEmail(form.full_name.replace(/.$/, ''), existingEmails)) {
        setForm(prev => ({ ...prev, email: generatedEmail, username: generatedUsername }));
      }
    }
  }, [form.full_name]);

  const filtered = staff.filter(s => {
    const matchSearch = !search ||
      s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase()) ||
      s.username?.toLowerCase().includes(search.toLowerCase()) ||
      s.assigned_room_number?.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || s.role === roleFilter;
    return matchSearch && matchRole;
  });

  const openAdd = () => { setForm(emptyForm); setEditId(null); setGeneratedCreds(null); setFormOpen(true); };

  const openEdit = (member) => {
    setForm({
      full_name: member.full_name || '',
      email: member.email || '',
      personal_email: member.personal_email || '',
      username: member.username || '',
      role: member.role || 'doctor',
      department: member.department || '',
      specialization: member.specialization || '',
      phone: member.phone || '',
      license_number: member.license_number || '',
      status: member.status || 'active',
      assigned_room_id: member.assigned_room_id || '',
      assigned_room_number: member.assigned_room_number || '',
    });
    setEditId(member.id);
    setGeneratedCreds(null);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.full_name || !form.email || !form.role) {
      toast.error('Name, email, and role are required');
      return;
    }

    // Exclusivity validation: Check if selected room is exclusive and already assigned to another active staff
    if (form.assigned_room_id) {
      const targetRoom = rooms.find(r => String(r.id) === String(form.assigned_room_id));
      const isExclusive = targetRoom?.is_exclusive !== false; // default true
      if (isExclusive) {
        const conflictingStaff = staff.find(s => 
          String(s.assigned_room_id) === String(form.assigned_room_id) &&
          s.status === 'active' &&
          (!editId || String(s.id) !== String(editId))
        );
        if (conflictingStaff) {
          toast.error(`Room Conflict: Room ${targetRoom.room_number} is exclusive and already assigned to ${conflictingStaff.full_name} (${conflictingStaff.role}).`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const selectedRoom = rooms.find(r => String(r.id) === String(form.assigned_room_id));
      const payload = {
        ...form,
        assigned_room_id: form.assigned_room_id || null,
        assigned_room_number: selectedRoom ? selectedRoom.room_number : (form.assigned_room_number || null)
      };

      let staffId = editId;

      if (editId) {
        await ethioCareClient.entities.Staff.update(editId, payload);
        toast.success('Staff member updated');
        setFormOpen(false);
      } else {
        const code = generateActivationCode();
        const newStaff = await ethioCareClient.entities.Staff.create({
          ...payload,
          activation_code: code,
          activation_used: false,
          password_set: false,
        });
        staffId = newStaff.id;

        // Ensure Supabase Auth user is provisioned for seamless Hospital Email + Code login
        try {
          await supabase.auth.signUp({
            email: form.email.trim().toLowerCase(),
            password: 'Hospital@2026',
          });
        } catch (authErr) {
          console.warn('[StaffManagement] Auth provisioning note:', authErr);
        }

        setGeneratedCreds({
          name: form.full_name,
          email: form.email,
          username: form.username,
          activationCode: code,
          role: ROLES.find(r => r.value === form.role)?.label || form.role,
          room: payload.assigned_room_number ? `Room ${payload.assigned_room_number}` : 'Unassigned'
        });
        toast.success('Staff member created', {
          description: `Hospital email: ${form.email}`,
          duration: 10000,
        });
      }

      // If room was assigned, update the Room's assigned staff info for quick cross-referencing
      if (payload.assigned_room_id) {
        try {
          await ethioCareClient.entities.Room.update(payload.assigned_room_id, {
            assigned_staff_id: staffId,
            assigned_staff_name: payload.full_name,
            assigned_staff_role: payload.role
          });
        } catch (rmErr) {
          console.warn('[StaffManagement] Room sync note:', rmErr);
        }
      }

      // If role is doctor, ensure a corresponding Doctor entity exists with room synchronization
      if (form.role === 'doctor') {
        try {
          const existingDocs = await ethioCareClient.entities.Doctor.list();
          const existingDoc = existingDocs.find(d => 
            (d.email && d.email.toLowerCase() === form.email.toLowerCase()) ||
            (d.full_name && d.full_name.toLowerCase() === form.full_name.toLowerCase()) ||
            (staffId && d.staff_id === staffId)
          );
          if (existingDoc) {
            await ethioCareClient.entities.Doctor.update(existingDoc.id, {
              full_name: form.full_name,
              email: form.email,
              specialty: form.specialization || form.department || 'General Practice',
              assigned_room_id: payload.assigned_room_id,
              assigned_room_number: payload.assigned_room_number,
              status: form.status || 'active'
            });
          } else {
            await ethioCareClient.entities.Doctor.create({
              staff_id: staffId,
              full_name: form.full_name,
              email: form.email,
              specialty: form.specialization || form.department || 'General Practice',
              doctor_type: 'Staff Doctor',
              status: form.status || 'active',
              availability: 'available',
              assigned_room_id: payload.assigned_room_id,
              assigned_room_number: payload.assigned_room_number
            });
          }
          queryClient.invalidateQueries({ queryKey: ['doctors'] });
        } catch (syncErr) {
          console.warn('[StaffManagement] Doctor sync note:', syncErr);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    } catch (err) {
      toast.error(err.message || 'Failed to save staff member');
    }
    setSaving(false);
  };

  const handleRegenerateCode = async (member) => {
    try {
      const code = generateActivationCode();
      await ethioCareClient.entities.Staff.update(member.id, {
        activation_code: code,
        activation_used: false,
        password_set: false,
      });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast.success(`New activation code generated`, {
        description: code,
        duration: 10000,
      });
    } catch (err) {
      toast.error(err.message || 'Failed to regenerate activation code');
    }
  };

  const handleToggleStatus = async (member) => {
    try {
      const newStatus = member.status === 'active' ? 'suspended' : 'active';
      await ethioCareClient.entities.Staff.update(member.id, { status: newStatus });
      if (member.role === 'doctor') {
        try {
          const docs = await ethioCareClient.entities.Doctor.list();
          const matched = docs.find(d => 
            (d.staff_id && String(d.staff_id) === String(member.id)) ||
            (d.email && member.email && d.email.toLowerCase() === member.email.toLowerCase())
          );
          if (matched) {
            await ethioCareClient.entities.Doctor.update(matched.id, { status: newStatus === 'active' ? 'active' : 'inactive' });
          }
        } catch (e) {
          console.warn('[StaffManagement] Doctor status sync note:', e);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
      toast.success(newStatus === 'active' ? 'Staff reactivated' : 'Staff suspended');
    } catch (err) {
      toast.error(err.message || 'Failed to update staff status');
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard?.writeText(code);
    toast.success('Copied to clipboard');
  };

  const handleCopyAll = (creds) => {
    const text = `Staff Account Details\nName: ${creds.name}\nHospital Email: ${creds.email}\nUsername: ${creds.username}\nActivation Code: ${creds.activationCode}\nRole: ${creds.role}`;
    navigator.clipboard?.writeText(text);
    toast.success('All credentials copied to clipboard');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await ethioCareClient.entities.Staff.delete(deleteTarget.id);
      if (deleteTarget.role === 'doctor') {
        try {
          const docs = await ethioCareClient.entities.Doctor.list();
          const matched = docs.find(d => 
            (d.staff_id && String(d.staff_id) === String(deleteTarget.id)) ||
            (d.email && deleteTarget.email && d.email.toLowerCase() === deleteTarget.email.toLowerCase())
          );
          if (matched) {
            await ethioCareClient.entities.Doctor.delete(matched.id);
          }
        } catch (e) {
          console.warn('[StaffManagement] Doctor delete sync note:', e);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
      toast.success('Staff member removed');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.message || 'Failed to remove staff member');
    }
  };

  const activatedCount = staff.filter(s => s.password_set === true).length;
  const pendingCount = staff.filter(s => s.password_set !== true).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Staff Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{staff.length} staff members · Hospital email: @{HOSPITAL_DOMAIN}</p>
        </div>
        <Button onClick={openAdd}>
          <UserPlus className="w-4 h-4 mr-2" />Add Staff Member
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl border border-border/60 p-4 text-center shadow-soft">
          <p className="text-2xl font-bold font-heading text-primary">{staff.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Total Staff</p>
        </div>
        <div className="bg-card rounded-xl border border-border/60 p-4 text-center shadow-soft">
          <p className="text-2xl font-bold font-heading text-emerald-600">{activatedCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Activated</p>
        </div>
        <div className="bg-card rounded-xl border border-border/60 p-4 text-center shadow-soft">
          <p className="text-2xl font-bold font-heading text-amber-600">{pendingCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Pending Activation</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by name, email, or username..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Filter by role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Staff Table */}
      <div className="bg-card rounded-xl border border-border/60 overflow-hidden shadow-soft">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <UserPlus className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No staff members found</p>
            <p className="text-sm mt-1">Click "Add Staff Member" to get started</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider">Staff Member</th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider">Role &amp; Room</th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider">Activation &amp; Status</th>
                    <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(member => {
                    const accountStatus = getUserStatus(member.email);
                    return (
                      <tr key={member.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        {/* 1. Staff Member */}
                        <td className="px-4 py-3">
                          <p className="font-semibold text-foreground text-sm">{member.full_name}</p>
                          <p className="text-xs text-muted-foreground">{member.email}</p>
                          {member.username && <p className="text-[11px] text-muted-foreground font-mono">@{member.username}</p>}
                        </td>

                        {/* 2. Role & Room */}
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <span className="font-medium text-xs text-foreground block">
                              {ROLES.find(r => r.value === member.role)?.label || member.role}
                            </span>
                            {member.assigned_room_number ? (
                              <Badge variant="outline" className="text-[10px] font-mono bg-primary/5 text-primary border-primary/20">
                                <Building2 className="w-3 h-3 mr-1" />
                                Room {member.assigned_room_number}
                              </Badge>
                            ) : (
                              <span className="text-[10px] text-muted-foreground italic">Unassigned Room</span>
                            )}
                          </div>
                        </td>

                        {/* 3. Activation & Status */}
                        <td className="px-4 py-3">
                          <div className="space-y-1.5">
                            <StatusBadge status={member.status || 'active'} />
                            <div>
                              {member.password_set ? (
                                <Badge variant="success" className="text-[10px] gap-1 py-0">
                                  <CheckCircle2 className="w-3 h-3" /> Activated
                                </Badge>
                              ) : member.activation_code ? (
                                <div className="flex items-center gap-1">
                                  <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">{member.activation_code}</code>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" title="Copy code" onClick={() => handleCopyCode(member.activation_code)}>
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                </div>
                              ) : (
                                <Badge variant="outline" className="text-[10px]">No code</Badge>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 4. Actions */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              title="View details"
                              onClick={() => setDetailStaff(member)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {!member.password_set && (
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="Regenerate activation code" onClick={() => handleRegenerateCode(member)}>
                                <RefreshCw className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8" title={member.status === 'active' ? 'Suspend' : 'Reactivate'} onClick={() => handleToggleStatus(member)}>
                              {member.status === 'active' ? <Clock className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Edit staff member" onClick={() => openEdit(member)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" aria-label="Delete staff member" onClick={() => setDeleteTarget(member)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Mobile card list */}
            <div className="md:hidden space-y-2 p-3">
              {filtered.map(member => (
                <div key={member.id} className="border border-border/60 rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm">{member.full_name}</p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                      {member.username && <p className="text-xs text-muted-foreground font-mono">@{member.username}</p>}
                    </div>
                    <StatusBadge status={member.status || 'active'} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs">
                      {ROLES.find(r => r.value === member.role)?.label || member.role}
                    </Badge>
                    {member.password_set ? (
                      <Badge variant="success" className="text-xs gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Activated
                      </Badge>
                    ) : member.activation_code ? (
                      <div className="flex items-center gap-1">
                        <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{member.activation_code}</code>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopyCode(member.activation_code)}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-xs">No code</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-border/60">
                    {!member.password_set && (
                      <Button variant="outline" size="sm" className="h-9 flex-1" onClick={() => handleRegenerateCode(member)}>
                        <RefreshCw className="w-3.5 h-3.5 mr-1" /> New Code
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="h-9 flex-1" onClick={() => handleToggleStatus(member)}>
                      {member.status === 'active' ? 'Suspend' : 'Reactivate'}
                    </Button>
                    <Button variant="outline" size="sm" className="h-9 w-9 p-0" onClick={() => openEdit(member)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" className="h-9 w-9 p-0 text-destructive" onClick={() => setDeleteTarget(member)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Staff Member' : 'Add New Staff Member'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Full Name *</Label>
              <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Dr. Abebe Kebede" />
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label>Hospital Email * <span className="text-xs text-muted-foreground font-normal">(used for login)</span></Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="pl-9" placeholder="auto-generated" />
                </div>
                {!editId && form.full_name && (
                  <p className="text-xs text-primary mt-1">Auto-generated from name</p>
                )}
              </div>
              <div>
                <Label>Username</Label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className="pl-9" placeholder="auto-generated" />
                </div>
              </div>
              <div>
                <Label>Personal Email <span className="text-xs text-muted-foreground font-normal">(for notifications, optional)</span></Label>
                <Input type="email" value={form.personal_email} onChange={e => setForm({ ...form, personal_email: e.target.value })} placeholder="personal@email.com" />
              </div>
            </div>
            <div>
              <Label>Role *</Label>
              <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Department</Label>
                <Input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} placeholder="e.g. Internal" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+251..." />
              </div>
            </div>
            {form.role === 'doctor' && (
              <div className="space-y-3">
                <div>
                  <Label>Specialty</Label>
                  <Select value={form.specialization} onValueChange={v => setForm({ ...form, specialization: v })}>
                    <SelectTrigger><SelectValue placeholder="Select specialty" /></SelectTrigger>
                    <SelectContent>
                      {SPECIALTIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>License Number</Label>
                  <Input value={form.license_number} onChange={e => setForm({ ...form, license_number: e.target.value })} placeholder="Medical license number" />
                </div>
              </div>
            )}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label>Assigned Physical Room / Workspace</Label>
                <span className="text-[11px] text-muted-foreground">Exclusivity enforced</span>
              </div>
              <Select 
                value={form.assigned_room_id || '__none'} 
                onValueChange={v => {
                  if (v === '__none') {
                    setForm({ ...form, assigned_room_id: '', assigned_room_number: '' });
                  } else {
                    const r = rooms.find(item => String(item.id) === String(v));
                    setForm({ ...form, assigned_room_id: v, assigned_room_number: r?.room_number || '' });
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select physical room or workspace..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">No Room Assigned (Float / Unassigned)</SelectItem>
                  {rooms.map(r => {
                    const isExclusive = r.is_exclusive !== false;
                    const occupant = staff.find(s => String(s.assigned_room_id) === String(r.id) && s.status === 'active' && (!editId || String(s.id) !== String(editId)));
                    return (
                      <SelectItem 
                        key={r.id} 
                        value={String(r.id)}
                        disabled={isExclusive && Boolean(occupant)}
                      >
                        Room {r.room_number} — {r.department || r.room_type} ({r.floor}) {isExclusive ? '[Exclusive]' : '[Shared]'} {occupant ? `(Occupied by ${occupant.full_name})` : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Account Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Generated Credentials Panel */}
            {!editId && !generatedCreds && (
              <div className="text-xs bg-primary/5 text-primary rounded-lg p-3 flex items-center gap-2">
                <KeyRound className="w-3.5 h-3.5 shrink-0" />
                A hospital email, username, and activation code will be generated automatically.
              </div>
            )}

            {generatedCreds && (
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  <p className="text-sm font-bold text-emerald-800 dark:text-emerald-400">Staff Account Created</p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Name:</span>
                    <span className="font-semibold">{generatedCreds.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Hospital Email:</span>
                    <span className="font-semibold text-xs">{generatedCreds.email}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Username:</span>
                    <span className="font-semibold font-mono text-xs">{generatedCreds.username}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Role:</span>
                    <span className="font-semibold">{generatedCreds.role}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-emerald-200 dark:border-emerald-900">
                    <span className="text-muted-foreground">Activation Code:</span>
                    <code className="text-lg font-mono font-bold text-emerald-900 dark:text-emerald-300">{generatedCreds.activationCode}</code>
                  </div>
                </div>
                <p className="text-xs text-emerald-700 dark:text-emerald-500">
                  Share these credentials with the staff member. They must visit the activation page and enter their hospital email + activation code to set their password.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => handleCopyAll(generatedCreds)}>
                    <Copy className="w-3.5 h-3.5 mr-1" /> Copy All
                  </Button>
                  <Button size="sm" className="flex-1" onClick={() => { setFormOpen(false); setGeneratedCreds(null); }}>
                    Done
                  </Button>
                </div>
              </div>
            )}

            {editId && (
              <Button className="w-full" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
            {!editId && !generatedCreds && (
              <Button className="w-full" onClick={handleSave} disabled={saving}>
                {saving ? 'Creating...' : 'Create Staff & Generate Credentials'}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Remove Staff Member</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to remove <strong>{deleteTarget?.full_name}</strong> from the staff list? This cannot be undone.
          </p>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={handleDelete}>Remove</Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Staff Profile Details Dialog */}
      <Dialog open={!!detailStaff} onOpenChange={(open) => !open && setDetailStaff(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              Staff Profile Details
            </DialogTitle>
          </DialogHeader>
          {detailStaff && (
            <div className="space-y-3 pt-2 text-xs">
              <div className="bg-muted/40 p-3.5 rounded-xl space-y-2.5 border border-border/60">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Full Name:</span>
                  <span className="font-semibold text-foreground text-sm">{detailStaff.full_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Hospital Email:</span>
                  <span className="font-mono text-primary">{detailStaff.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Username:</span>
                  <span className="font-mono text-muted-foreground">{detailStaff.username || 'Not set'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Role:</span>
                  <Badge variant="secondary" className="capitalize text-[10px]">
                    {ROLES.find(r => r.value === detailStaff.role)?.label || detailStaff.role}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Department:</span>
                  <span>{detailStaff.department || 'General'}</span>
                </div>
                {detailStaff.specialty && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-medium">Specialty:</span>
                    <span>{detailStaff.specialty}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Assigned Room:</span>
                  <span>
                    {detailStaff.assigned_room_number ? `Room ${detailStaff.assigned_room_number}` : 'Unassigned'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Account Status:</span>
                  <StatusBadge status={detailStaff.status || 'active'} />
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border/60">
                  <span className="text-muted-foreground font-medium">Activation Code:</span>
                  <code className="bg-muted px-2 py-0.5 rounded font-mono font-semibold">
                    {detailStaff.password_set ? 'Activated' : (detailStaff.activation_code || 'None')}
                  </code>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button variant="outline" size="sm" onClick={() => setDetailStaff(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}