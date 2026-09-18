import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import DataTable from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export default function ServicesManagement() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'consultation', price: '', description: '' });
  const queryClient = useQueryClient();
  const { data: services = [], isLoading } = useQuery({ queryKey: ['services'], queryFn: () => base44.entities.Service.list() });

  const handleSave = async () => {
    if (!form.name?.trim()) {
      toast.error('Please enter a service name');
      return;
    }
    const priceNum = parseFloat(form.price);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error('Please enter a valid price');
      return;
    }
    setSaving(true);
    try {
      await base44.entities.Service.create({ ...form, price: priceNum });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('Service created');
      setOpen(false);
      setForm({ name: '', category: 'consultation', price: '', description: '' });
    } catch (err) {
      toast.error(err.message || 'Failed to create service');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.Service.delete(id);
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('Service deleted');
    } catch (err) {
      toast.error(err.message || 'Failed to delete service');
    }
  };

  const columns = [
    { header: 'Service Name', accessor: 'name' },
    { header: 'Category', cell: (r) => <span className="capitalize">{r.category}</span> },
    { header: 'Price (ETB)', cell: (r) => r.price?.toLocaleString() },
    { header: 'Description', accessor: 'description' },
    { header: 'Actions', cell: (r) => (
      <Button variant="ghost" size="sm" className="text-red-500" onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}>Delete</Button>
    )}
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Services & Pricing</h1>
          <p className="text-sm text-muted-foreground">{services.length} services</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Add Service</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Service</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div><Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consultation">Consultation</SelectItem>
                    <SelectItem value="procedure">Procedure</SelectItem>
                    <SelectItem value="injection">Injection</SelectItem>
                    <SelectItem value="registration">Registration</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Price (ETB)</Label><Input type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} /></div>
              <div><Label>Description</Label><Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
              <Button className="w-full" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable columns={columns} data={services} isLoading={isLoading} />
    </div>
  );
}