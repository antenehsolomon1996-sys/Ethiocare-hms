import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Search, Filter, Package, AlertTriangle, DollarSign } from 'lucide-react';
import MobileSheet from '@/components/common/MobileSheet';
import { toast } from 'sonner';
import { logAudit } from '@/lib/auditLogger';
import { useAuth } from '@/lib/AuthContext';

const MED_CATEGORIES = [
  'Antibiotic', 'Analgesic', 'Antacid', 'Antipyretic', 'Antihypertensive',
  'Antidiabetic', 'Antihistamine', 'Cardiovascular', 'Respiratory', 'Other'
];

const statusColors = {
  in_stock: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  low_stock: 'bg-amber-100 text-amber-700 border-amber-200',
  out_of_stock: 'bg-red-100 text-red-700 border-red-200',
  expired: 'bg-rose-100 text-rose-700 border-rose-200'
};

export default function MedicineFeesTab() {
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
    generic_name: '',
    category: 'Antibiotic',
    strength: '',
    unit: 'tablets',
    purchase_price: '',
    unit_price: '',
    quantity: '0',
    min_stock: '50',
    status: 'in_stock'
  });

  const { data: medicines = [], isLoading } = useQuery({
    queryKey: ['medicines'],
    queryFn: () => ethioCareClient.entities.Medicine.list()
  });

  const filtered = medicines.filter(m => {
    const matchCat = catFilter === 'all' || m.category?.toLowerCase() === catFilter.toLowerCase();
    const matchStatus = statusFilter === 'all' || m.status === statusFilter;
    const matchSearch = !search ||
      m.name?.toLowerCase().includes(search.toLowerCase()) ||
      m.generic_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.category?.toLowerCase().includes(search.toLowerCase()) ||
      m.strength?.toLowerCase().includes(search.toLowerCase());

    return matchCat && matchStatus && matchSearch;
  });

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      generic_name: '',
      category: 'Antibiotic',
      strength: '',
      unit: 'tablets',
      purchase_price: '',
      unit_price: '',
      quantity: '0',
      min_stock: '50',
      status: 'in_stock'
    });
    setSheetOpen(true);
  };

  const openEdit = (m) => {
    setEditing(m);
    setForm({
      name: m.name || '',
      generic_name: m.generic_name || '',
      category: m.category || 'Antibiotic',
      strength: m.strength || '',
      unit: m.unit || 'tablets',
      purchase_price: m.purchase_price?.toString() || '',
      unit_price: m.unit_price?.toString() || '',
      quantity: m.quantity?.toString() || '0',
      min_stock: m.min_stock?.toString() || '50',
      status: m.status || 'in_stock'
    });
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!form.name?.trim() || form.unit_price === '') {
      toast.error('Medicine name and selling price are required');
      return;
    }
    const sellPrice = parseFloat(form.unit_price);
    if (isNaN(sellPrice) || sellPrice < 0) {
      toast.error('Please enter a valid selling price');
      return;
    }
    const purchasePrice = form.purchase_price ? parseFloat(form.purchase_price) : 0;
    const qty = parseInt(form.quantity) || 0;
    const minStock = parseInt(form.min_stock) || 10;

    // Automatic status determination if in_stock
    let finalStatus = form.status;
    if (qty <= 0) finalStatus = 'out_of_stock';
    else if (qty <= minStock) finalStatus = 'low_stock';
    else if (form.status !== 'expired') finalStatus = 'in_stock';

    const payload = {
      name: form.name.trim(),
      generic_name: form.generic_name?.trim() || null,
      category: form.category,
      strength: form.strength?.trim() || null,
      unit: form.unit?.trim() || 'tablets',
      purchase_price: purchasePrice,
      unit_price: sellPrice,
      quantity: qty,
      min_stock: minStock,
      status: finalStatus
    };

    setSaving(true);
    try {
      if (editing) {
        await ethioCareClient.entities.Medicine.update(editing.id, payload);
        toast.success(`Medicine "${form.name}" updated successfully`);
        logAudit({
          userName: user?.full_name || 'Hospital Owner',
          userRole: user?.role || 'owner',
          action: 'update',
          module: 'MedicineTariff',
          description: `Updated medicine ${payload.name} selling price to ${payload.unit_price} ETB (Stock: ${payload.quantity})`,
          recordId: editing.id,
          recordName: payload.name
        });
      } else {
        const created = await ethioCareClient.entities.Medicine.create(payload);
        toast.success(`Medicine "${form.name}" added to catalog`);
        logAudit({
          userName: user?.full_name || 'Hospital Owner',
          userRole: user?.role || 'owner',
          action: 'create',
          module: 'MedicineTariff',
          description: `Added new medicine ${payload.name} at ${payload.unit_price} ETB (${payload.category})`,
          recordId: created?.id,
          recordName: payload.name
        });
      }
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      setSheetOpen(false);
    } catch (err) {
      console.error('[MedicineFeesTab] Save error:', err);
      toast.error(err.message || 'Failed to save medicine');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (m) => {
    if (!confirm(`Are you sure you want to remove "${m.name}" from catalog?`)) return;
    try {
      await ethioCareClient.entities.Medicine.delete(m.id);
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      toast.success(`Medicine "${m.name}" removed`);
      logAudit({
        userName: user?.full_name || 'Hospital Owner',
        userRole: user?.role || 'owner',
        action: 'delete',
        module: 'MedicineTariff',
        description: `Removed medicine ${m.name} from catalog`,
        recordId: m.id,
        recordName: m.name
      });
    } catch (err) {
      toast.error(err.message || 'Failed to delete medicine');
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
              placeholder="Search medicine, generic name, strength..."
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
              {MED_CATEGORIES.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="in_stock">In Stock</SelectItem>
              <SelectItem value="low_stock">Low Stock</SelectItem>
              <SelectItem value="out_of_stock">Out of Stock</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={openCreate} className="shrink-0 h-9">
          <Plus className="w-4 h-4 mr-2" />Add Medicine
        </Button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading pharmacy catalog...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center text-muted-foreground">
          <p className="font-medium">No medications found</p>
          <p className="text-sm mt-1">Click "Add Medicine" to add to catalog</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(m => {
            const isLow = m.status === 'low_stock' || (m.quantity || 0) <= (m.min_stock || 10);
            return (
              <div
                key={m.id}
                className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2.5 transition-all hover:shadow-soft"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <p className="font-semibold text-sm leading-tight text-foreground">{m.name}</p>
                      {m.strength && (
                        <span className="text-xs font-medium text-muted-foreground">({m.strength})</span>
                      )}
                    </div>
                    {m.generic_name && (
                      <p className="text-xs text-muted-foreground mt-0.5">{m.generic_name}</p>
                    )}
                    <Badge variant="outline" className="text-[10px] mt-1 font-medium">
                      {m.category || 'General'}
                    </Badge>
                  </div>
                  <Badge className={statusColors[m.status] || 'bg-gray-100 text-gray-600 border-gray-200'}>
                    {m.status?.replace(/_/g, ' ')}
                  </Badge>
                </div>

                {/* Stock & Cost breakdown */}
                <div className="grid grid-cols-2 gap-2 bg-muted/30 p-2.5 rounded-lg text-xs mt-1">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Stock Level</span>
                    <span className={`font-semibold flex items-center gap-1 ${isLow ? 'text-amber-600' : 'text-foreground'}`}>
                      <Package className="w-3 h-3" />
                      {m.quantity ?? 0} {m.unit || 'units'}
                    </span>
                    <span className="text-[10px] text-muted-foreground/80 block">Min: {m.min_stock || 10}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Purchase Price</span>
                    <span className="font-semibold text-foreground">
                      {m.purchase_price ? `${m.purchase_price} ETB` : '-'}
                    </span>
                    <span className="text-[10px] text-muted-foreground/80 block">Cost basis</span>
                  </div>
                </div>

                <div className="mt-auto pt-2 border-t border-border/50 flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground font-medium">Selling Price</span>
                  <p className="text-2xl font-bold text-emerald-600">
                    {m.unit_price?.toLocaleString()} <span className="text-xs font-medium text-muted-foreground">ETB</span>
                  </p>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => openEdit(m)}>
                    <Pencil className="w-3 h-3 mr-1" />Edit Tariff
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2.5 text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => handleDelete(m)}
                    title="Delete Medicine"
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
      <MobileSheet open={sheetOpen} onOpenChange={setSheetOpen} title={editing ? 'Edit Medicine Tariff' : 'Add Medicine to Catalog'}>
        <div className="space-y-3.5 pt-2">
          <div>
            <Label className="text-xs font-medium">Medicine Name *</Label>
            <Input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Amoxicillin"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">Generic Name</Label>
              <Input
                value={form.generic_name}
                onChange={e => setForm({ ...form, generic_name: e.target.value })}
                placeholder="e.g. Amoxicillin Trihydrate"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Strength</Label>
              <Input
                value={form.strength}
                onChange={e => setForm({ ...form, strength: e.target.value })}
                placeholder="e.g. 500mg, 10ml"
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">Category</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MED_CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium">Unit of Measure</Label>
              <Input
                value={form.unit}
                onChange={e => setForm({ ...form, unit: e.target.value })}
                placeholder="tablets, capsules, bottles"
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">Selling Price (ETB) *</Label>
              <Input
                type="number"
                value={form.unit_price}
                onChange={e => setForm({ ...form, unit_price: e.target.value })}
                placeholder="0.00"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Purchase Cost (ETB)</Label>
              <Input
                type="number"
                value={form.purchase_price}
                onChange={e => setForm({ ...form, purchase_price: e.target.value })}
                placeholder="0.00"
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">Current Stock</Label>
              <Input
                type="number"
                value={form.quantity}
                onChange={e => setForm({ ...form, quantity: e.target.value })}
                placeholder="0"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Min Reorder Level</Label>
              <Input
                type="number"
                value={form.min_stock}
                onChange={e => setForm({ ...form, min_stock: e.target.value })}
                placeholder="50"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-medium">Status</Label>
            <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="in_stock">In Stock</SelectItem>
                <SelectItem value="low_stock">Low Stock</SelectItem>
                <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button className="w-full mt-4" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add to Catalog'}
          </Button>
        </div>
      </MobileSheet>
    </div>
  );
}