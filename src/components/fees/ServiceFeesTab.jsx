import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Search, Power, Filter } from 'lucide-react';
import MobileSheet from '@/components/common/MobileSheet';
import { toast } from 'sonner';
import { logAudit } from '@/lib/auditLogger';
import { useAuth } from '@/lib/AuthContext';

const REGISTRATION_CATEGORIES = ['registration', 'consultation'];
const NURSING_CATEGORIES = ['injection', 'procedure', 'nursing'];

export default function ServiceFeesTab({ category, title }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const defaultServiceCategory = category === 'nursing' ? 'nursing' : 'registration';
  const [form, setForm] = useState({
    name: '',
    price: '',
    description: '',
    status: 'active',
    serviceCategory: defaultServiceCategory
  });

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: () => ethioCareClient.entities.Service.list()
  });

  const validCategories = category === 'nursing' ? NURSING_CATEGORIES : REGISTRATION_CATEGORIES;

  const filtered = services.filter(s => {
    const matchType = validCategories.includes(s.category);
    const matchCat = catFilter === 'all' || s.category === catFilter;
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchSearch = !search ||
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.description?.toLowerCase().includes(search.toLowerCase()) ||
      s.category?.toLowerCase().includes(search.toLowerCase());

    return matchType && matchCat && matchStatus && matchSearch;
  });

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      price: '',
      description: '',
      status: 'active',
      serviceCategory: defaultServiceCategory
    });
    setSheetOpen(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({
      name: s.name,
      price: s.price?.toString() || '',
      description: s.description || '',
      status: s.status || 'active',
      serviceCategory: s.category || defaultServiceCategory
    });
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!form.name?.trim() || form.price === '') {
      toast.error('Name and price are required');
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
      description: form.description?.trim() || null,
      status: form.status,
      category: form.serviceCategory
    };

    setSaving(true);
    try {
      if (editing) {
        await ethioCareClient.entities.Service.update(editing.id, payload);
        toast.success(`Fee "${form.name}" updated successfully`);
        logAudit({
          userName: user?.full_name || 'Hospital Owner',
          userRole: user?.role || 'owner',
          action: 'update',
          module: 'ServiceFee',
          description: `Updated fee for ${payload.name} to ${payload.price} ETB (${payload.category})`,
          recordId: editing.id,
          recordName: payload.name
        });
      } else {
        const created = await ethioCareClient.entities.Service.create(payload);
        toast.success(`Fee "${form.name}" created successfully`);
        logAudit({
          userName: user?.full_name || 'Hospital Owner',
          userRole: user?.role || 'owner',
          action: 'create',
          module: 'ServiceFee',
          description: `Created new fee ${payload.name} at ${payload.price} ETB (${payload.category})`,
          recordId: created?.id,
          recordName: payload.name
        });
      }
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setSheetOpen(false);
    } catch (err) {
      console.error('[ServiceFeesTab] Save error:', err);
      toast.error(err.message || 'Failed to save fee');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s) => {
    if (!confirm(`Are you sure you want to delete "${s.name}"?`)) return;
    try {
      await ethioCareClient.entities.Service.delete(s.id);
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success(`Fee "${s.name}" deleted`);
      logAudit({
        userName: user?.full_name || 'Hospital Owner',
        userRole: user?.role || 'owner',
        action: 'delete',
        module: 'ServiceFee',
        description: `Deleted fee ${s.name} (${s.category})`,
        recordId: s.id,
        recordName: s.name
      });
    } catch (err) {
      toast.error(err.message || 'Failed to delete fee');
    }
  };

  const toggleStatus = async (s) => {
    const newStatus = s.status === 'active' ? 'inactive' : 'active';
    try {
      await ethioCareClient.entities.Service.update(s.id, { status: newStatus });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success(`${s.name} is now ${newStatus === 'active' ? 'Active' : 'Disabled'}`);
      logAudit({
        userName: user?.full_name || 'Hospital Owner',
        userRole: user?.role || 'owner',
        action: 'update',
        module: 'ServiceFee',
        description: `Changed status of ${s.name} to ${newStatus}`,
        recordId: s.id,
        recordName: s.name
      });
    } catch (err) {
      toast.error(err.message || 'Failed to update fee status');
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
        <div className="flex flex-1 flex-col sm:flex-row gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9 h-9"
              placeholder={`Search ${title.toLowerCase()}...`}
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
              {category === 'registration' ? (
                <>
                  <SelectItem value="registration">Registration Only</SelectItem>
                  <SelectItem value="consultation">Consultation Only</SelectItem>
                </>
              ) : (
                <>
                  <SelectItem value="injection">Injections</SelectItem>
                  <SelectItem value="procedure">Procedures</SelectItem>
                  <SelectItem value="nursing">General Nursing</SelectItem>
                </>
              )}
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
          <Plus className="w-4 h-4 mr-2" />Add Service Fee
        </Button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading fee catalog...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center text-muted-foreground">
          <p className="font-medium">No services found matching the criteria</p>
          <p className="text-sm mt-1">Click "Add Service Fee" to create a new tariff</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(s => {
            const isActive = s.status === 'active';
            return (
              <div
                key={s.id}
                className={`bg-card border rounded-xl p-4 flex flex-col gap-2.5 transition-all hover:shadow-soft ${
                  isActive ? 'border-border' : 'border-border/60 opacity-75 bg-muted/20'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm leading-tight text-foreground">{s.name}</p>
                    <Badge variant="outline" className="text-[10px] mt-1 capitalize font-medium">
                      {s.category}
                    </Badge>
                  </div>
                  <Badge className={isActive ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200'}>
                    {isActive ? 'Active' : 'Disabled'}
                  </Badge>
                </div>

                {s.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p>
                )}

                <div className="mt-auto pt-2 border-t border-border/50 flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">Fee (ETB)</span>
                  <p className="text-2xl font-bold text-primary">
                    {s.price?.toLocaleString()} <span className="text-xs font-medium text-muted-foreground">ETB</span>
                  </p>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => openEdit(s)}>
                    <Pencil className="w-3 h-3 mr-1" />Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className={`h-8 px-2.5 ${isActive ? 'text-amber-600 hover:text-amber-700' : 'text-emerald-600 hover:text-emerald-700'}`}
                    onClick={() => toggleStatus(s)}
                    title={isActive ? 'Disable Fee' : 'Enable Fee'}
                  >
                    <Power className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2.5 text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => handleDelete(s)}
                    title="Delete Fee"
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
      <MobileSheet open={sheetOpen} onOpenChange={setSheetOpen} title={editing ? 'Edit Service Fee' : 'Add New Service Fee'}>
        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-xs font-medium">Service Name *</Label>
            <Input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder={category === 'registration' ? 'e.g. VIP Consultation Fee' : 'e.g. IV Fluid Infusion Setup'}
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
            <Select value={form.serviceCategory} onValueChange={v => setForm({ ...form, serviceCategory: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {category === 'registration' ? (
                  <>
                    <SelectItem value="registration">Registration</SelectItem>
                    <SelectItem value="consultation">Consultation</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="nursing">General Nursing Care</SelectItem>
                    <SelectItem value="injection">Injection Administration</SelectItem>
                    <SelectItem value="procedure">Clinical Procedure</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-medium">Description</Label>
            <Textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={2}
              placeholder="Clinical or administrative notes regarding this tariff"
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-medium">Status</Label>
            <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active (Available across portals)</SelectItem>
                <SelectItem value="inactive">Disabled (Hidden from new orders)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button className="w-full mt-4" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving Fee...' : editing ? 'Save Changes' : 'Create Tariff'}
          </Button>
        </div>
      </MobileSheet>
    </div>
  );
}