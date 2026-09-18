import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { UserPlus, Search, Pencil, Trash2, Stethoscope, ChevronLeft, ChevronRight, Phone, Mail, Award } from 'lucide-react';
import { toast } from 'sonner';

const SPECIALTIES = [
  'General Practice', 'Cardiology', 'Pediatrics', 'Surgery', 'Internal Medicine',
  'Obstetrics & Gynecology', 'Orthopedics', 'Neurology', 'Dermatology', 'Ophthalmology',
  'ENT', 'Psychiatry', 'Radiology', 'Anesthesiology', 'Emergency Medicine',
  'Oncology', 'Urology', 'Nephrology', 'Endocrinology', 'Pulmonology', 'Other'
];

const DOCTOR_TYPES = ['General Practitioner', 'Specialist', 'Consultant', 'Resident'];

const SPECIALTY_COLORS = {
  'General Practice': 'bg-blue-100 text-blue-700',
  'Cardiology': 'bg-red-100 text-red-700',
  'Pediatrics': 'bg-pink-100 text-pink-700',
  'Surgery': 'bg-orange-100 text-orange-700',
  'Internal Medicine': 'bg-purple-100 text-purple-700',
  'Obstetrics & Gynecology': 'bg-rose-100 text-rose-700',
  'Orthopedics': 'bg-amber-100 text-amber-700',
  'Neurology': 'bg-violet-100 text-violet-700',
  'Dermatology': 'bg-green-100 text-green-700',
  'Ophthalmology': 'bg-cyan-100 text-cyan-700',
  'ENT': 'bg-teal-100 text-teal-700',
  'Psychiatry': 'bg-indigo-100 text-indigo-700',
  'Emergency Medicine': 'bg-red-100 text-red-800',
};

const ITEMS_PER_PAGE = 10;

const emptyForm = {
  full_name: '', email: '', phone: '', specialty: 'General Practice',
  doctor_type: 'General Practitioner', license_number: '', department: '',
  bio: '', years_experience: '', status: 'active', availability: 'available'
};

export default function DoctorManagement() {
  const [search, setSearch] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: doctors = [], isLoading } = useQuery({
    queryKey: ['doctors'],
    queryFn: () => base44.entities.Doctor.list('-created_date', 200)
  });

  // Ensure unique doctors by database ID and canonical identity
  const uniqueDoctors = useMemo(() => {
    const seenIds = new Set();
    const seenCanonical = new Set();
    return doctors.filter(d => {
      if (!d || !d.id || seenIds.has(d.id)) return false;
      // If two records share identical full_name, email, and specialty, consolidate to 1
      const canonicalKey = `${d.full_name?.toLowerCase().trim()}_${d.email?.toLowerCase().trim()}_${d.specialty?.toLowerCase().trim()}`;
      if (d.email && seenCanonical.has(canonicalKey)) return false;
      seenIds.add(d.id);
      if (d.email) seenCanonical.add(canonicalKey);
      return true;
    });
  }, [doctors]);

  const filtered = uniqueDoctors.filter(d => {
    const matchSearch = !search ||
      d.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      d.email?.toLowerCase().includes(search.toLowerCase()) ||
      d.license_number?.toLowerCase().includes(search.toLowerCase());
    const matchSpecialty = specialtyFilter === 'all' || d.specialty === specialtyFilter;
    return matchSearch && matchSpecialty;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const openAdd = () => { setForm(emptyForm); setEditId(null); setFormOpen(true); };
  const openEdit = (doc) => {
    setForm({
      full_name: doc.full_name || '', email: doc.email || '', phone: doc.phone || '',
      specialty: doc.specialty || 'General Practice', doctor_type: doc.doctor_type || 'General Practitioner',
      license_number: doc.license_number || '', department: doc.department || '',
      bio: doc.bio || '', years_experience: doc.years_experience || '',
      status: doc.status || 'active', availability: doc.availability || 'available'
    });
    setEditId(doc.id);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.full_name?.trim() || !form.specialty?.trim()) {
      toast.error('Doctor name and specialty are required');
      return;
    }
    setSaving(true);
    try {
      const data = {
        ...form,
        full_name: form.full_name.trim(),
        specialty: form.specialty.trim(),
        email: form.email?.trim() || null,
        phone: form.phone?.trim() || null,
        license_number: form.license_number?.trim() || null,
        department: form.department?.trim() || null,
        bio: form.bio?.trim() || null,
        years_experience: form.years_experience ? parseInt(form.years_experience) : 0
      };
      if (editId) {
        await base44.entities.Doctor.update(editId, data);
        toast.success('Doctor updated successfully');
      } else {
        await base44.entities.Doctor.create(data);
        toast.success('Doctor added successfully');
      }
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
      setFormOpen(false);
    } catch (err) {
      console.error('[DoctorManagement] Error saving doctor:', err);
      toast.error(err.message || 'Failed to save doctor');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await base44.entities.Doctor.delete(deleteTarget.id);
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
      toast.success('Doctor removed');
      setDeleteTarget(null);
    } catch (err) {
      console.error('[DoctorManagement] Error deleting doctor:', err);
      toast.error(err.message || 'Failed to delete doctor');
    }
  };

  const toggleStatus = async (doc) => {
    try {
      const newStatus = doc.status === 'active' ? 'inactive' : 'active';
      await base44.entities.Doctor.update(doc.id, { status: newStatus });
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
      toast.success(`Doctor ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
    } catch (err) {
      console.error('[DoctorManagement] Error toggling status:', err);
      toast.error(err.message || 'Failed to update doctor status');
    }
  };

  // Group by specialty
  const specialtyCounts = {};
  doctors.forEach(d => { specialtyCounts[d.specialty] = (specialtyCounts[d.specialty] || 0) + 1; });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Doctor Management</h1>
          <p className="text-sm text-muted-foreground">{doctors.length} doctors registered</p>
        </div>
        <Button onClick={openAdd}>
          <UserPlus className="w-4 h-4 mr-2" />Add Doctor
        </Button>
      </div>

      {/* Specialty Summary */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(specialtyCounts).map(([spec, count]) => (
          <button
            key={spec}
            onClick={() => setSpecialtyFilter(specialtyFilter === spec ? 'all' : spec)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              specialtyFilter === spec ? 'ring-2 ring-primary' : ''
            } ${SPECIALTY_COLORS[spec] || 'bg-gray-100 text-gray-700'}`}
          >
            {spec} ({count})
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by name, email, or license..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select value={specialtyFilter} onValueChange={v => { setSpecialtyFilter(v); setPage(1); }}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Filter by specialty" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Specialties</SelectItem>
            {SPECIALTIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Doctor Cards Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : paginated.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Stethoscope className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No doctors found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {paginated.map(doc => (
            <Card key={doc.id} className={`relative overflow-hidden transition-all hover:shadow-md ${doc.status === 'inactive' ? 'opacity-60' : ''}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                      <Stethoscope className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{doc.full_name}</h3>
                      <p className="text-xs text-muted-foreground">{doc.doctor_type}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Edit doctor" onClick={() => openEdit(doc)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive" aria-label="Delete doctor" onClick={() => setDeleteTarget(doc)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <Badge className={`text-xs mb-3 ${SPECIALTY_COLORS[doc.specialty] || 'bg-gray-100 text-gray-700'}`}>
                  {doc.specialty}
                </Badge>

                <div className="space-y-1.5 text-xs text-muted-foreground">
                  {doc.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3 h-3" /><span className="truncate">{doc.email}</span>
                    </div>
                  )}
                  {doc.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3 h-3" /><span>{doc.phone}</span>
                    </div>
                  )}
                  {doc.license_number && (
                    <div className="flex items-center gap-2">
                      <Award className="w-3 h-3" /><span>License: {doc.license_number}</span>
                    </div>
                  )}
                  {doc.years_experience && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{doc.years_experience} years experience</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                  <div className="flex gap-2">
                    <Badge className={doc.status === 'active' ? 'bg-emerald-100 text-emerald-700 text-xs' : 'bg-gray-100 text-gray-600 text-xs'}>
                      {doc.status}
                    </Badge>
                    <Badge className={
                      doc.availability === 'available' ? 'bg-green-100 text-green-700 text-xs' :
                      doc.availability === 'busy' ? 'bg-amber-100 text-amber-700 text-xs' :
                      'bg-red-100 text-red-700 text-xs'
                    }>
                      {doc.availability}
                    </Badge>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => toggleStatus(doc)}>
                    {doc.status === 'active' ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} doctors
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Previous page" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <Button key={p} variant={p === page ? 'default' : 'outline'} size="icon" className="h-8 w-8 text-xs" aria-label={`Page ${p}`} onClick={() => setPage(p)}>
                {p}
              </Button>
            ))}
            <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Next page" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Doctor' : 'Add New Doctor'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Full Name *</Label>
                <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Dr. Abebe Kebede" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+251..." />
              </div>
              <div>
                <Label>Specialty *</Label>
                <Select value={form.specialty} onValueChange={v => setForm({ ...form, specialty: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SPECIALTIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Doctor Type</Label>
                <Select value={form.doctor_type} onValueChange={v => setForm({ ...form, doctor_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DOCTOR_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>License Number</Label>
                <Input value={form.license_number} onChange={e => setForm({ ...form, license_number: e.target.value })} />
              </div>
              <div>
                <Label>Years of Experience</Label>
                <Input type="number" value={form.years_experience} onChange={e => setForm({ ...form, years_experience: e.target.value })} />
              </div>
              <div>
                <Label>Department</Label>
                <Input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="on_leave">On Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Availability</Label>
                <Select value={form.availability} onValueChange={v => setForm({ ...form, availability: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="busy">Busy</SelectItem>
                    <SelectItem value="off_duty">Off Duty</SelectItem>
                    <SelectItem value="on_leave">On Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Bio / Notes</Label>
                <Textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} rows={3} />
              </div>
            </div>
            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editId ? 'Save Changes' : 'Add Doctor'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Remove Doctor</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to remove <strong>{deleteTarget?.full_name}</strong>? This cannot be undone.
          </p>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={handleDelete}>Remove</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}