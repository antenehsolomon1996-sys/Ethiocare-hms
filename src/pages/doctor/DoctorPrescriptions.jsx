import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useDoctorContext } from '@/lib/DoctorContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pill, Search, Printer, Calendar, User, Eye, RefreshCw, FileText } from 'lucide-react';
import { format } from 'date-fns';

export default function DoctorPrescriptions() {
  const { selectedDoctor } = useDoctorContext();
  const [search, setSearch] = useState('');
  const [selectedRx, setSelectedRx] = useState(null);

  const { data: prescriptions = [], isLoading, refetch } = useQuery({
    queryKey: ['doctor-prescriptions'],
    queryFn: () => base44.entities.Prescription.list('-created_date', 200),
  });

  const doctorId = selectedDoctor?.id;
  const doctorName = selectedDoctor?.full_name?.toLowerCase();

  const myPrescriptions = prescriptions.filter(rx => {
    if (!doctorId && !doctorName) return true;
    if (rx.doctor_id && doctorId) return rx.doctor_id === doctorId;
    return rx.doctor_name?.toLowerCase() === doctorName;
  });

  const filtered = myPrescriptions.filter(rx => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      rx.patient_name?.toLowerCase().includes(q) ||
      rx.diagnosis?.toLowerCase().includes(q) ||
      rx.items?.some(i => i.name?.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Pill className="w-6 h-6 text-primary" />
            Prescription Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review prescriptions issued during outpatient and inpatient consultations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by patient name, diagnosis, or medicine..."
            className="pl-9 text-xs"
          />
        </div>
      </div>

      {/* Table / Cards */}
      {filtered.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="p-10 text-center text-muted-foreground space-y-2">
            <Pill className="w-8 h-8 mx-auto text-muted-foreground/50" />
            <p className="font-semibold text-foreground">No prescriptions found</p>
            <p className="text-xs">Prescriptions authored during patient consultations in &quot;My Queue&quot; will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((rx) => (
            <Card key={rx.id} className="border-border/60 shadow-card hover:shadow-premium transition-all">
              <CardHeader className="pb-2.5">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-primary/5 text-primary border-primary/20">
                    {rx.status || 'Active'}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {rx.created_at ? format(new Date(rx.created_at), 'dd MMM yyyy') : 'Recent'}
                  </span>
                </div>
                <CardTitle className="text-base font-bold text-foreground mt-2 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-primary shrink-0" />
                  {rx.patient_name || 'Patient'}
                </CardTitle>
                <CardDescription className="text-xs line-clamp-1">
                  Dx: {rx.diagnosis || 'Clinical evaluation'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-1">
                <div className="bg-muted/40 p-2.5 rounded-lg text-xs space-y-1">
                  <p className="font-semibold text-muted-foreground text-[10px] uppercase">Medicines ({rx.items?.length || 0}):</p>
                  <ul className="space-y-0.5">
                    {(rx.items || []).slice(0, 3).map((item, idx) => (
                      <li key={idx} className="truncate text-foreground font-medium text-xs flex items-center justify-between">
                        <span>• {item.name}</span>
                        <span className="text-[11px] text-muted-foreground">Qty: {item.quantity}</span>
                      </li>
                    ))}
                    {(rx.items?.length || 0) > 3 && (
                      <li className="text-[10px] text-muted-foreground italic">+{rx.items.length - 3} more items...</li>
                    )}
                  </ul>
                </div>

                <div className="flex justify-end pt-1">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedRx(rx)} className="text-xs">
                    <Eye className="w-3.5 h-3.5 mr-1" /> View Prescription
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Prescription Detail Modal */}
      <Dialog open={!!selectedRx} onOpenChange={() => setSelectedRx(null)}>
        <DialogContent className="max-w-md p-6 bg-card border-border/80 shadow-2xl">
          {selectedRx && (
            <div className="space-y-4 font-sans text-xs">
              <DialogHeader className="border-b border-border/60 pb-3">
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <Pill className="w-5 h-5 text-primary" />
                  Prescription Details
                </DialogTitle>
                <p className="text-[11px] text-muted-foreground">
                  Patient: <strong className="text-foreground">{selectedRx.patient_name}</strong> · Date: {selectedRx.created_at ? format(new Date(selectedRx.created_at), 'dd/MM/yyyy') : 'N/A'}
                </p>
              </DialogHeader>

              <div className="space-y-2">
                <p className="font-semibold text-foreground text-xs">Diagnosis / Clinical Indication:</p>
                <p className="p-2 rounded bg-muted/40 text-xs text-muted-foreground">{selectedRx.diagnosis || 'General medical consultation'}</p>
              </div>

              <div className="space-y-2">
                <p className="font-semibold text-foreground text-xs">Prescribed Items:</p>
                <div className="border border-border/60 rounded-lg divide-y divide-border/40 overflow-hidden">
                  {(selectedRx.items || []).map((item, idx) => (
                    <div key={idx} className="p-2.5 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-bold text-foreground">{item.name}</p>
                        {item.dosage && <p className="text-[11px] text-muted-foreground font-sans">Dosage: {item.dosage}</p>}
                        {item.instructions && <p className="text-[10px] text-primary/80 italic font-sans">{item.instructions}</p>}
                      </div>
                      <Badge variant="outline" className="text-xs font-semibold">
                        Qty: {item.quantity}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border/60">
                <Button variant="outline" size="sm" onClick={() => setSelectedRx(null)}>
                  Close
                </Button>
                <Button size="sm" onClick={() => window.print()} className="gradient-primary text-primary-foreground shadow-soft">
                  <Printer className="w-4 h-4 mr-1.5" /> Print Rx
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
