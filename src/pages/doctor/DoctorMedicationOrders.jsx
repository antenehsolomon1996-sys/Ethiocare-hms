import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useDoctorContext } from '@/lib/DoctorContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Syringe, Search, RefreshCw, Calendar, User, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function DoctorMedicationOrders() {
  const { selectedDoctor } = useDoctorContext();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['doctor-med-orders'],
    queryFn: () => base44.entities.MedicationOrder.list('-created_date', 200),
  });

  const doctorId = selectedDoctor?.id;
  const doctorName = selectedDoctor?.full_name?.toLowerCase();

  const myOrders = orders.filter(o => {
    if (!doctorId && !doctorName) return true;
    if (o.doctor_id && doctorId) return o.doctor_id === doctorId;
    return o.doctor_name?.toLowerCase() === doctorName;
  });

  const filtered = myOrders.filter(o => {
    const matchSearch = !search ||
      o.patient_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.item_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || o.administration_status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Syringe className="w-6 h-6 text-primary" />
            Medication & Nursing Orders
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track real-time administration and nurse execution for prescribed inpatient and procedural medications.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Orders
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by patient name or medication..."
            className="pl-9 text-xs"
          />
        </div>
        <div className="flex gap-1.5">
          {['all', 'pending', 'administered'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                statusFilter === st
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/50 text-muted-foreground hover:text-foreground'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      {filtered.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="p-10 text-center text-muted-foreground space-y-2">
            <Syringe className="w-8 h-8 mx-auto text-muted-foreground/50" />
            <p className="font-semibold text-foreground">No medication orders found</p>
            <p className="text-xs">Medication orders submitted during patient consultations will be tracked here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(order => {
            const isDone = order.administration_status === 'administered';
            return (
              <Card key={order.id} className="border-border/60 shadow-card hover:shadow-premium transition-all">
                <CardHeader className="pb-2.5">
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        isDone
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                      }`}
                    >
                      {isDone ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                      {order.administration_status || 'Pending'}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {order.created_at ? format(new Date(order.created_at), 'dd/MM/yy hh:mm a') : 'Recent'}
                    </span>
                  </div>
                  <CardTitle className="text-base font-bold text-foreground mt-2">
                    {order.item_name}
                  </CardTitle>
                  <CardDescription className="text-xs flex items-center gap-1">
                    <User className="w-3 h-3" /> {order.patient_name || 'Patient'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2.5 pt-1 text-xs">
                  <div className="p-2 rounded bg-muted/40 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Dosage:</span>
                      <span className="font-semibold">{order.dosage || 'Standard'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Quantity:</span>
                      <span className="font-semibold">{order.quantity || 1}</span>
                    </div>
                    {order.urgency && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Urgency:</span>
                        <span className="font-bold text-primary uppercase text-[10px]">{order.urgency}</span>
                      </div>
                    )}
                  </div>
                  {order.instructions && (
                    <p className="text-[11px] text-muted-foreground italic font-sans">
                      Note: {order.instructions}
                    </p>
                  )}
                  {order.administered_by && (
                    <p className="text-[10px] text-emerald-600 font-medium">
                      Administered by: {order.administered_by} on {order.administered_date || 'Today'}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
