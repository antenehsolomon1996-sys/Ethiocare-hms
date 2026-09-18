import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useDoctorContext } from '@/lib/DoctorContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FlaskConical, Search, RefreshCw, Calendar, User, Eye, CheckCircle2, Clock, FileText } from 'lucide-react';
import { format } from 'date-fns';

export default function DoctorLabOrders() {
  const { selectedDoctor } = useDoctorContext();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['doctor-lab-orders'],
    queryFn: () => base44.entities.LabOrder.list('-created_date', 200),
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
      o.test_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || o.test_status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <FlaskConical className="w-6 h-6 text-primary" />
            Laboratory & Diagnostic Orders
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor lab test orders and inspect diagnostic results and lab technician notes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Tests
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
            placeholder="Search by patient name or test..."
            className="pl-9 text-xs"
          />
        </div>
        <div className="flex gap-1.5">
          {['all', 'pending', 'in_progress', 'completed'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                statusFilter === st
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/50 text-muted-foreground hover:text-foreground'
              }`}
            >
              {st.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Grid */}
      {filtered.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="p-10 text-center text-muted-foreground space-y-2">
            <FlaskConical className="w-8 h-8 mx-auto text-muted-foreground/50" />
            <p className="font-semibold text-foreground">No lab orders found</p>
            <p className="text-xs">Diagnostic lab test orders submitted in consultation queue will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(order => {
            const isPaid = order.payment_status === 'paid';
            const isCompleted = order.test_status === 'completed';
            return (
              <Card key={order.id} className="border-border/60 shadow-card hover:shadow-premium transition-all">
                <CardHeader className="pb-2.5">
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-bold uppercase tracking-wider ${
                          isPaid
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-700 border-amber-500/30'
                        }`}
                      >
                        {isPaid ? <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" /> : <Clock className="w-3 h-3 mr-1 text-amber-600" />}
                        {isPaid ? 'Paid' : 'Payment Required'}
                      </Badge>
                      {isPaid && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold capitalize ${
                            isCompleted
                              ? 'bg-purple-500/10 text-purple-700 border-purple-500/20'
                              : order.test_status === 'in_progress'
                              ? 'bg-sky-500/10 text-sky-600 border-sky-500/20'
                              : 'bg-slate-500/10 text-slate-700 border-slate-500/20'
                          }`}
                        >
                          {order.test_status ? order.test_status.replace(/_/g, ' ') : 'Pending'}
                        </Badge>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {order.created_at ? format(new Date(order.created_at), 'dd/MM/yy hh:mm a') : 'Recent'}
                    </span>
                  </div>
                  <CardTitle className="text-base font-bold text-foreground mt-2">
                    {order.test_name}
                  </CardTitle>
                  <CardDescription className="text-xs flex items-center gap-1">
                    <User className="w-3 h-3" /> {order.patient_name || 'Patient'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-1 text-xs">
                  <div className="p-2.5 rounded bg-muted/40 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Category:</span>
                      <span className="font-semibold">{order.test_category || 'General'}</span>
                    </div>
                    {order.price && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Test Fee:</span>
                        <span className="font-semibold">{Number(order.price).toLocaleString()} ETB</span>
                      </div>
                    )}
                    {order.urgency && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Priority:</span>
                        <span className="font-bold text-primary uppercase text-[10px]">{order.urgency}</span>
                      </div>
                    )}
                  </div>
                  {isCompleted && order.results ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedOrder(order)}
                      className="w-full text-xs text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" /> View Lab Results
                    </Button>
                  ) : !isPaid ? (
                    <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 text-center">
                      <p className="font-medium">Awaiting payment at Billing</p>
                      <p className="text-[10px] text-amber-700/80 mt-0.5">Laboratory specimen collection begins once settled.</p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground italic text-center py-1">
                      Payment verified — specimen processing in Laboratory...
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Lab Result Details Modal */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-md p-6 bg-card border-border/80 shadow-2xl">
          {selectedOrder && (
            <div className="space-y-4 font-sans text-xs">
              <DialogHeader className="border-b border-border/60 pb-3">
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <FlaskConical className="w-5 h-5 text-primary" />
                  {selectedOrder.test_name} — Diagnostic Report
                </DialogTitle>
                <p className="text-[11px] text-muted-foreground">
                  Patient: <strong className="text-foreground">{selectedOrder.patient_name}</strong>
                </p>
              </DialogHeader>

              <div className="space-y-2">
                <p className="font-semibold text-foreground text-xs">Reported Results:</p>
                <div className="p-3 rounded-lg bg-muted/40 font-mono text-xs whitespace-pre-wrap leading-relaxed">
                  {typeof selectedOrder.results === 'object'
                    ? JSON.stringify(selectedOrder.results, null, 2)
                    : selectedOrder.results || 'No specific numeric output recorded.'}
                </div>
              </div>

              {selectedOrder.technician_notes && (
                <div className="space-y-1">
                  <p className="font-semibold text-muted-foreground text-xs">Technician Notes:</p>
                  <p className="p-2 rounded bg-background border text-xs text-muted-foreground">{selectedOrder.technician_notes}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-border/60">
                <Button size="sm" onClick={() => setSelectedOrder(null)}>
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
