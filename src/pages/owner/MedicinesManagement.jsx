import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import StatusBadge from '@/components/common/StatusBadge';
import StatCard from '@/components/common/StatCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Pencil, Trash2, Package, AlertTriangle, DollarSign, Calendar, Archive, RotateCcw } from 'lucide-react';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';

const DOSAGE_FORMS = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Drops', 'Inhaler', 'Cream', 'Suppository', 'Other'];

const CATEGORIES = ['Antibiotic', 'Analgesic', 'Antacid', 'Antihistamine', 'Cardiovascular', 'Diabetes', 'Respiratory', 'Vitamin', 'Other'];

const emptyForm = {
  name: '', generic_name: '', brand: '', category: '', dosage_form: '', strength: '',
  barcode: '', sku: '', batch_number: '', manufacturer: '', supplier: '',
  purchase_price: '', unit_price: '', tax: '', quantity: '', min_stock: '10', max_stock: '100',
  unit: 'pieces', expiry_date: '', manufacturing_date: '', storage_location: '',
  prescription_required: false, notes: '', image_url: ''
};

function computeStatus(med) {
  const qty = med.quantity || 0;
  if (qty <= 0) return 'out_of_stock';
  if (med.expiry_date) {
    const days = differenceInDays(new Date(med.expiry_date), new Date());
    if (days < 0) return 'expired';
  }
  if (qty <= (med.min_stock || 10)) return 'low_stock';
  return 'in_stock';
}

export default function MedicinesManagement() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: medicines = [], isLoading } = useQuery({
    queryKey: ['medicines'],
    queryFn: () => ethioCareClient.entities.Medicine.list('-created_date', 200)
  });

  // Compute status for each medicine
  const medicinesWithStatus = useMemo(() => medicines.map(m => ({
    ...m,
    computedStatus: m.status && m.status !== 'in_stock' ? m.status : computeStatus(m)
  })), [medicines]);

  const filtered = medicinesWithStatus.filter(m => {
    const matchSearch = !search ||
      m.name?.toLowerCase().includes(search.toLowerCase()) ||
      m.generic_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.barcode?.includes(search) ||
      m.sku?.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === 'all' || m.category === categoryFilter;
    const matchStatus = statusFilter === 'all' || m.computedStatus === statusFilter;
    return matchSearch && matchCategory && matchStatus;
  });

  // Dashboard stats
  const totalValue = medicines.reduce((s, m) => s + (m.unit_price || 0) * (m.quantity || 0), 0);
  const lowStock = medicinesWithStatus.filter(m => m.computedStatus === 'low_stock');
  const outOfStock = medicinesWithStatus.filter(m => m.computedStatus === 'out_of_stock');
  const expired = medicinesWithStatus.filter(m => m.computedStatus === 'expired');
  const expiringSoon = medicines.filter(m => {
    if (!m.expiry_date) return false;
    const days = differenceInDays(new Date(m.expiry_date), new Date());
    return days >= 0 && days <= 90;
  });

  const openAdd = () => { setForm(emptyForm); setEditId(null); setFormOpen(true); };

  const openEdit = (med) => {
    setForm({
      name: med.name || '', generic_name: med.generic_name || '', brand: med.brand || '',
      category: med.category || '', dosage_form: med.dosage_form || '', strength: med.strength || '',
      barcode: med.barcode || '', sku: med.sku || '', batch_number: med.batch_number || '',
      manufacturer: med.manufacturer || '', supplier: med.supplier || '',
      purchase_price: med.purchase_price?.toString() || '', unit_price: med.unit_price?.toString() || '',
      tax: med.tax?.toString() || '', quantity: med.quantity?.toString() || '',
      min_stock: med.min_stock?.toString() || '10', max_stock: med.max_stock?.toString() || '100',
      unit: med.unit || 'pieces', expiry_date: med.expiry_date || '', manufacturing_date: med.manufacturing_date || '',
      storage_location: med.storage_location || '', prescription_required: med.prescription_required || false,
      notes: med.notes || '', image_url: med.image_url || ''
    });
    setEditId(med.id);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || form.quantity === '' || form.unit_price === '') {
      toast.error('Name, quantity, and selling price are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        purchase_price: parseFloat(form.purchase_price) || 0,
        unit_price: parseFloat(form.unit_price) || 0,
        tax: parseFloat(form.tax) || 0,
        quantity: parseInt(form.quantity) || 0,
        min_stock: parseInt(form.min_stock) || 10,
        max_stock: parseInt(form.max_stock) || 100,
        expiry_date: form.expiry_date || null,
        manufacturing_date: form.manufacturing_date || null,
      };
      const status = computeStatus(payload);
      payload.status = status;
      if (editId) {
        await ethioCareClient.entities.Medicine.update(editId, payload);
        toast.success('Medicine updated');
      } else {
        await ethioCareClient.entities.Medicine.create(payload);
        toast.success('Medicine added to inventory');
      }
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      setFormOpen(false);
      setForm(emptyForm);
      setEditId(null);
    } catch (err) {
      toast.error(err.message || 'Failed to save medicine');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await ethioCareClient.entities.Medicine.delete(deleteTarget.id);
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      toast.success('Medicine deleted');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.message || 'Failed to delete medicine');
    }
  };

  const handleArchive = async (med) => {
    try {
      await ethioCareClient.entities.Medicine.update(med.id, { archived: !med.archived });
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      toast.success(med.archived ? 'Medicine restored' : 'Medicine archived');
    } catch (err) {
      toast.error(err.message || 'Failed to archive medicine');
    }
  };

  const handleAdjustStock = async (med, newQty) => {
    const qty = parseInt(newQty);
    if (isNaN(qty)) return;
    try {
      const status = computeStatus({ ...med, quantity: qty });
      await ethioCareClient.entities.Medicine.update(med.id, { quantity: qty, status });
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      toast.success(`Stock updated: ${med.name} → ${qty} ${med.unit || 'pieces'}`);
    } catch (err) {
      toast.error(err.message || 'Failed to update stock');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Pharmacy Inventory</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{medicines.length} medicines · {CATEGORIES.length} categories</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4 mr-2" />Add Medicine
        </Button>
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Total Medicines" value={medicines.length} icon={Package} color="blue" />
        <StatCard title="Inventory Value" value={`${totalValue.toLocaleString()} ETB`} icon={DollarSign} color="green" />
        <StatCard title="Low Stock" value={lowStock.length} icon={AlertTriangle} color="amber" />
        <StatCard title="Expired" value={expired.length} icon={Calendar} color="red" />
      </div>

      {/* Expiry Alerts */}
      {(expiringSoon.length > 0 || expired.length > 0) && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/50 rounded-xl p-4">
          <h3 className="font-heading text-sm font-bold text-amber-800 dark:text-amber-400 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Expiry Alerts
          </h3>
          <div className="space-y-1.5">
            {expired.slice(0, 3).map(m => (
              <p key={m.id} className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <strong>{m.name}</strong> — Expired {m.expiry_date ? format(new Date(m.expiry_date), 'MMM yyyy') : ''}
              </p>
            ))}
            {expiringSoon.slice(0, 5).map(m => {
              const days = differenceInDays(new Date(m.expiry_date), new Date());
              return (
                <p key={m.id} className="text-sm text-amber-700 dark:text-amber-500 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <strong>{m.name}</strong> — Expires in {days} days ({format(new Date(m.expiry_date), 'MMM yyyy')})
                </p>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by name, generic, barcode, or SKU..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="in_stock">In Stock</SelectItem>
            <SelectItem value="low_stock">Low Stock</SelectItem>
            <SelectItem value="out_of_stock">Out of Stock</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Medicine List */}
      <div className="bg-card rounded-xl border border-border/60 overflow-hidden shadow-soft">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No medicines found</p>
            <p className="text-sm mt-1">Click "Add Medicine" to add your first item</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider">Medicine</th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider">Stock &amp; Status</th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider">Price &amp; Expiry</th>
                    <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(m => (
                    <tr key={m.id} className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${m.archived ? 'opacity-50' : ''}`}>
                      {/* 1. Medicine */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-foreground">{m.name}</p>
                          {m.prescription_required && <Badge variant="warning" className="text-[9px] px-1 py-0">Rx</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {m.generic_name ? `${m.generic_name} · ` : ''}{m.category || 'General'}
                        </p>
                      </td>

                      {/* 2. Stock & Status */}
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <p className="font-semibold text-xs text-foreground">{m.quantity} {m.unit}</p>
                          <StatusBadge status={m.computedStatus} />
                        </div>
                      </td>

                      {/* 3. Price & Expiry */}
                      <td className="px-4 py-3">
                        <p className="font-medium text-xs text-foreground">{m.unit_price?.toLocaleString()} ETB</p>
                        <p className="text-[11px] text-muted-foreground">
                          Exp: {m.expiry_date ? format(new Date(m.expiry_date), 'MMM yyyy') : '-'}
                        </p>
                      </td>

                      {/* 4. Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Adjust Stock" onClick={() => {
                            const newQty = prompt(`Adjust stock for ${m.name} (current: ${m.quantity}):`, m.quantity);
                            if (newQty !== null) handleAdjustStock(m, newQty);
                          }}>
                            <Package className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title={m.archived ? 'Restore' : 'Archive'} onClick={() => handleArchive(m)}>
                            {m.archived ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => openEdit(m)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Delete" onClick={() => setDeleteTarget(m)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="md:hidden space-y-2 p-3">
              {filtered.map(m => (
                <div key={m.id} className={`border border-border/60 rounded-lg p-3 space-y-2 ${m.archived ? 'opacity-50' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.generic_name} · {m.category}</p>
                    </div>
                    <StatusBadge status={m.computedStatus} />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Qty: <strong className="text-foreground">{m.quantity} {m.unit}</strong></span>
                    <span className="text-muted-foreground">Price: <strong className="text-foreground">{m.unit_price?.toLocaleString()} ETB</strong></span>
                  </div>
                  {m.expiry_date && (
                    <p className="text-xs text-muted-foreground">Expires: {format(new Date(m.expiry_date), 'MMM yyyy')}</p>
                  )}
                  {m.prescription_required && <Badge variant="warning" className="text-[10px]">Prescription Required</Badge>}
                  <div className="flex items-center gap-2 pt-1 border-t border-border/60">
                    <Button variant="outline" size="sm" className="h-9 flex-1" onClick={() => {
                      const newQty = prompt(`Adjust stock for ${m.name} (current: ${m.quantity}):`, m.quantity);
                      if (newQty !== null) handleAdjustStock(m, newQty);
                    }}>Stock</Button>
                    <Button variant="outline" size="sm" className="h-9 w-9 p-0" onClick={() => openEdit(m)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" className="h-9 w-9 p-0 text-destructive" onClick={() => setDeleteTarget(m)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Medicine' : 'Add New Medicine'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            {/* Basic Info */}
            <div>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Basic Information</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Medicine Name *</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Paracetamol" />
                </div>
                <div>
                  <Label>Generic Name</Label>
                  <Input value={form.generic_name} onChange={e => setForm({ ...form, generic_name: e.target.value })} placeholder="e.g. Acetaminophen" />
                </div>
                <div>
                  <Label>Brand</Label>
                  <Input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} placeholder="e.g. Panadol" />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Dosage Form</Label>
                  <Select value={form.dosage_form} onValueChange={v => setForm({ ...form, dosage_form: v })}>
                    <SelectTrigger><SelectValue placeholder="Select form" /></SelectTrigger>
                    <SelectContent>
                      {DOSAGE_FORMS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Strength</Label>
                  <Input value={form.strength} onChange={e => setForm({ ...form, strength: e.target.value })} placeholder="e.g. 500mg" />
                </div>
              </div>
            </div>

            {/* Inventory */}
            <div>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Inventory</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <Label>Quantity *</Label>
                  <Input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} placeholder="0" />
                </div>
                <div>
                  <Label>Min Stock</Label>
                  <Input type="number" value={form.min_stock} onChange={e => setForm({ ...form, min_stock: e.target.value })} placeholder="10" />
                </div>
                <div>
                  <Label>Max Stock</Label>
                  <Input type="number" value={form.max_stock} onChange={e => setForm({ ...form, max_stock: e.target.value })} placeholder="100" />
                </div>
                <div>
                  <Label>Unit</Label>
                  <Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="pieces" />
                </div>
                <div>
                  <Label>Barcode</Label>
                  <Input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} placeholder="Barcode" />
                </div>
                <div>
                  <Label>SKU</Label>
                  <Input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} placeholder="SKU" />
                </div>
                <div>
                  <Label>Batch Number</Label>
                  <Input value={form.batch_number} onChange={e => setForm({ ...form, batch_number: e.target.value })} placeholder="Batch #" />
                </div>
                <div>
                  <Label>Storage Location</Label>
                  <Input value={form.storage_location} onChange={e => setForm({ ...form, storage_location: e.target.value })} placeholder="Shelf A-1" />
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Pricing</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <Label>Purchase Price (ETB)</Label>
                  <Input type="number" value={form.purchase_price} onChange={e => setForm({ ...form, purchase_price: e.target.value })} placeholder="0" />
                </div>
                <div>
                  <Label>Selling Price (ETB) *</Label>
                  <Input type="number" value={form.unit_price} onChange={e => setForm({ ...form, unit_price: e.target.value })} placeholder="0" />
                </div>
                <div>
                  <Label>Tax (%)</Label>
                  <Input type="number" value={form.tax} onChange={e => setForm({ ...form, tax: e.target.value })} placeholder="0" />
                </div>
              </div>
            </div>

            {/* Supplier & Dates */}
            <div>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Supplier & Dates</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Manufacturer</Label>
                  <Input value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })} placeholder="Manufacturer" />
                </div>
                <div>
                  <Label>Supplier</Label>
                  <Input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} placeholder="Supplier" />
                </div>
                <div>
                  <Label>Manufacturing Date</Label>
                  <Input type="date" value={form.manufacturing_date} onChange={e => setForm({ ...form, manufacturing_date: e.target.value })} />
                </div>
                <div>
                  <Label>Expiry Date</Label>
                  <Input type="date" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Other */}
            <div>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Other</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="rx" checked={form.prescription_required} onChange={e => setForm({ ...form, prescription_required: e.target.checked })} className="w-4 h-4 rounded" />
                  <Label htmlFor="rx" className="cursor-pointer">Prescription Required</Label>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Additional notes..." />
                </div>
              </div>
            </div>

            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editId ? 'Save Changes' : 'Add Medicine'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Medicine</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
          </p>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={handleDelete}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}