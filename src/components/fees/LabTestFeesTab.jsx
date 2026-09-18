import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Search, Power, Filter, Clock } from 'lucide-react';
import MobileSheet from '@/components/common/MobileSheet';
import { toast } from 'sonner';
import { logAudit } from '@/lib/auditLogger';
import { useAuth } from '@/lib/AuthContext';

const LAB_CATEGORIES = ['Blood', 'Urine', 'Stool', 'Imaging', 'Chemistry', 'Microbiology', 'Other'];

export default function LabTestFeesTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    price: '',
    category: 'Blood',
    description: '',
    turnaround_time: '',
    status: 'active'
  });

  const { data: tests = [], isLoading } = useQuery({
    queryKey: ['labTests'],
    queryFn: () => ethioCareClient.entities.LabTest.list()
  });

  const filtered = tests.filter(t => {
    const matchCat = catFilter === 'all' || t.category?.toLowerCase() === catFilter.toLowerCase();
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchSearch = !search ||
      t.name?.toLowerCase().includes(search.toLowerCase()) ||
      t.category?.toLowerCase().includes(search.toLowerCase()) ||
      t.description?.toLowerCase().includes(search.toLowerCase());

    return matchCat && matchStatus && matchSearch;
  });

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      price: '',
      category: 'Blood',
      description: '',
      turnaround_time: '',
      status: 'active'
    });
    setSheetOpen(true);
  };

  const openEdit = (t) => {
    setEditing(t);
    setForm({
      name: t.name,
      price: t.price?.toString() || '',
      category: t.category || 'Blood',
      description: t.description || '',
      turnaround_time: t.turnaround_time || '',
      status: t.status || 'active'
    });
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!form.name?.trim() || form.price === '') {
      toast.error('Test name and price are required');
      return;
    }
    const priceNum = parseFloat(form.price);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error('Please enter a valid price');
      return;
    }

    const payload = {
      name: form.name.trim(),
      price: priceNum,
      category: form.category,
      description: form.description?.trim() || null,
      turnaround_time: form.turnaround_time?.trim() || null,
      status: form.status
    };

    setSaving(true);
    try {
      if (editing) {
        await ethioCareClient.entities.LabTest.update(editing.id, payload);
        toast.success(`Lab test "${form.name}" updated successfully`);
        logAudit({
          userName: user?.full_name || 'Hospital Owner',
          userRole: user?.role || 'owner',
          action: 'update',
          module: 'LabTestFee',
          description: `Updated lab test tariff ${payload.name} to ${payload.price} ETB`,
          recordId: editing.id,
          recordName: payload.name
        });
      } else {
        const created = await ethioCareClient.entities.LabTest.create(payload);
        toast.success(`Lab test "${form.name}" created successfully`);
        logAudit({
          userName: user?.full_name || 'Hospital Owner',
          userRole: user?.role || 'owner',
          action: 'create',
          module: 'LabTestFee',
          description: `Created new lab test tariff ${payload.name} at ${payload.price} ETB (${payload.category})`,
          recordId: created?.id,
          recordName: payload.name
        });
      }
      queryClient.invalidateQueries({ queryKey: ['labTests'] });
      setSheetOpen(false);
    } catch (err) {
      console.error('[LabTestFeesTab] Save error:', err);
      toast.error(err.message || 'Failed to save lab test');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t) => {
    if (!confirm(`Are you sure you want to delete "${t.name}"?`)) return;
    try {
      await ethioCareClient.entities.LabTest.delete(t.id);
      queryClient.invalidateQueries({ queryKey: ['labTests'] });
      toast.success(`Lab test "${t.name}" deleted`);
      logAudit({
        userName: user?.full_name || 'Hospital Owner',
        userRole: user?.role || 'owner',
        action: 'delete',
        module: 'LabTestFee',
        description: `Deleted lab test tariff ${t.name}`,
        recordId: t.id,
        recordName: t.name
      });
    } catch (err) {
      toast.error(err.message || 'Failed to delete lab test');
    }
  };

  const toggleStatus = async (t) => {
    const newStatus = t.status === 'active' ? 'inactive' : 'active';
    try {
      await ethioCareClient.entities.LabTest.update(t.id, { status: newStatus });
      queryClient.invalidateQueries({ queryKey: ['labTests'] });
      toast.success(`${t.name} is now ${newStatus === 'active' ? 'Active' : 'Disabled'}`);
      logAudit({
        userName: user?.full_name || 'Hospital Owner',
        userRole: user?.role || 'owner',
        action: 'update',
        module: 'LabTestFee',
        description: `Changed status of lab test ${t.name} to ${newStatus}`,
        recordId: t.id,
        recordName: t.name
      });
    } catch (err) {
      toast.error(err.message || 'Failed to update lab test status');
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
        <div className="flex flex-1 flex-col sm:flex-row gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9 h-9"
              placeholder="Search test name, category..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-[160px] h-9">
              <Filter className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {LAB_CATEGORIES.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={openCreate} className="shrink-0 h-9">
          <Plus className="w-4 h-4 mr-2" />Add Lab Test
        </Button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading laboratory tests...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center text-muted-foreground">
          <p className="font-medium">No lab tests found</p>
          <p className="text-sm mt-1">Click "Add Lab Test" to configure a new diagnostic test</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(t => {
            const isActive = t.status === 'active';
            return (
              <div
                key={t.id}
                className={`bg-card border rounded-xl p-4 flex flex-col gap-2.5 transition-all hover:shadow-soft ${
                  isActive ? 'border-border' : 'border-border/60 opacity-75 bg-muted/20'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm leading-tight text-foreground">{t.name}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge variant="outline" className="text-[10px] font-medium">
                        {t.category}
                      </Badge>
                      {t.turnaround_time && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3 text-muted-foreground/70" />
                          {t.turnaround_time}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge className={isActive ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200'}>
                    {isActive ? 'Active' : 'Disabled'}
                  </Badge>
                </div>

                {t.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                )}

                <div className="mt-auto pt-2 border-t border-border/50 flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">Tariff (ETB)</span>
                  <p className="text-2xl font-bold text-primary">
                    {t.price?.toLocaleString()} <span className="text-xs font-medium text-muted-foreground">ETB</span>
                  </p>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => openEdit(t)}>
                    <Pencil className="w-3 h-3 mr-1" />Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className={`h-8 px-2.5 ${isActive ? 'text-amber-600 hover:text-amber-700' : 'text-emerald-600 hover:text-emerald-700'}`}
                    onClick={() => toggleStatus(t)}
                    title={isActive ? 'Disable Test' : 'Enable Test'}
                  >
                    <Power className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2.5 text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => handleDelete(t)}
                    title="Delete Test"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Sheet */}
      <MobileSheet open={sheetOpen} onOpenChange={setSheetOpen} title={editing ? 'Edit Lab Test' : 'Add New Lab Test'}>
        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-xs font-medium">Test Name *</Label>
            <Input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Complete Blood Count (CBC)"
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-medium">Price (ETB) *</Label>
            <Input
              type="number"
              value={form.price}
              onChange={e => setForm({ ...form, price: e.target.value })}
              placeholder="0.00"
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-medium">Category</Label>
            <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LAB_CATEGORIES.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-medium">Turnaround Time</Label>
            <Input
              value={form.turnaround_time}
              onChange={e => setForm({ ...form, turnaround_time: e.target.value })}
              placeholder="e.g. 1 hour, 30 mins, 24 hours"
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-medium">Description</Label>
            <Textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={2}
              placeholder="Clinical specimen details, normal reference ranges, or notes"
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-medium">Status</Label>
            <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active (Available for doctor order)</SelectItem>
                <SelectItem value="inactive">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button className="w-full mt-4" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Lab Test'}
          </Button>
        </div>
      </MobileSheet>
    </div>
  );
}