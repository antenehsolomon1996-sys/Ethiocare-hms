import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import DataTable from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export default function LabTestsManagement() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'Blood', price: '', description: '', turnaround_time: '' });
  const queryClient = useQueryClient();
  const { data: tests = [], isLoading } = useQuery({ queryKey: ['labTests'], queryFn: () => ethioCareClient.entities.LabTest.list() });

  const handleSave = async () => {
    if (!form.name?.trim()) {
      toast.error('Please enter a test name');
      return;
    }
    const priceNum = parseFloat(form.price);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error('Please enter a valid price');
      return;
    }
    setSaving(true);
    try {
      await ethioCareClient.entities.LabTest.create({ ...form, price: priceNum });
      queryClient.invalidateQueries({ queryKey: ['labTests'] });
      toast.success('Lab test added');
      setOpen(false);
      setForm({ name: '', category: 'Blood', price: '', description: '', turnaround_time: '' });
    } catch (err) {
      toast.error(err.message || 'Failed to add lab test');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await ethioCareClient.entities.LabTest.delete(id);
      queryClient.invalidateQueries({ queryKey: ['labTests'] });
      toast.success('Deleted');
    } catch (err) {
      toast.error(err.message || 'Failed to delete lab test');
    }
  };

  const columns = [
    { 
      header: 'Test Name', 
      cell: (r) => (
        <div>
          <p className="font-semibold text-foreground text-sm">{r.name}</p>
          <span className="text-[11px] text-muted-foreground">{r.category}</span>
        </div>
      )
    },
    { header: 'Price (ETB)', cell: (r) => `${r.price?.toLocaleString()} ETB` },
    { header: 'Turnaround', accessor: 'turnaround_time' },
    { header: 'Actions', cell: (r) => (
      <Button variant="ghost" size="sm" className="text-red-500" onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}>
        Delete
      </Button>
    )}
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Lab Tests</h1></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Add Test</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Lab Test</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div><Label>Test Name</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div><Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Blood">Blood</SelectItem>
                    <SelectItem value="Urine">Urine</SelectItem>
                    <SelectItem value="Stool">Stool</SelectItem>
                    <SelectItem value="Imaging">Imaging</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Price (ETB)</Label><Input type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} /></div>
              <div><Label>Turnaround Time</Label><Input value={form.turnaround_time} onChange={e => setForm({...form, turnaround_time: e.target.value})} placeholder="e.g., 1 hour" /></div>
              <Button className="w-full" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable columns={columns} data={tests} isLoading={isLoading} />
    </div>
  );
}