import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { pharmacySaleService } from '@/services/pharmacySale.service';
import PharmacyReceiptModal from '@/components/pharmacy/PharmacyReceiptModal';
import StatCard from '@/components/common/StatCard';
import StatusBadge from '@/components/common/StatusBadge';
import { 
  Pill, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  ChevronRight, 
  ShoppingCart, 
  DollarSign, 
  Receipt, 
  ClipboardList, 
  Calendar, 
  Printer,
  PackagePlus,
  RotateCcw,
  BarChart3,
  Settings,
  History
} from 'lucide-react';
import { startOfDay, differenceInDays } from 'date-fns';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDateEAT, formatDateTimeEAT } from '@/lib/dateUtils';

export default function PharmacyDashboard() {
  const [walkInSales, setWalkInSales] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // 1. Hospital Prescriptions Query
  const { data: prescriptions = [] } = useQuery({
    queryKey: ['prescriptions'],
    queryFn: () => base44.entities.Prescription.list('-created_date', 100),
    refetchInterval: 10000
  });

  // 2. Medicine Inventory Query
  const { data: medicines = [] } = useQuery({
    queryKey: ['medicines'],
    queryFn: () => base44.entities.Medicine.list('-created_date', 300)
  });

  // 3. Load Walk-In Sales
  useEffect(() => {
    pharmacySaleService.getSales().then(setWalkInSales);
  }, []);

  const today = startOfDay(new Date());

  // Hospital Workflow Stats
  const pendingRx = prescriptions.filter((p) => p.status === 'pending');
  const todayDispensedRx = prescriptions.filter((p) => p.status === 'dispensed' && new Date(p.updated_date || p.created_date) >= today);

  // Walk-In Workflow Stats
  const todayWalkInSales = walkInSales.filter((s) => new Date(s.createdAt) >= today);
  const todayWalkInRevenue = todayWalkInSales.reduce((sum, s) => sum + (s.total || 0), 0);

  // Inventory & Safety Stats
  const lowStock = medicines.filter((m) => (m.quantity || 0) <= (m.min_stock || 10) && (m.quantity || 0) > 0);
  const outOfStock = medicines.filter((m) => (m.quantity || 0) <= 0);
  const expiringSoon = medicines.filter((m) => {
    if (!m.expiry_date) return false;
    const days = differenceInDays(new Date(m.expiry_date), new Date());
    return days >= 0 && days <= 90;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Pharmacy Operations Command Center</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Unified management of Hospital Dispensing, Walk-In Sales, Inbound Stock, and Inventory
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm">
            <Link to="/pharmacy/sales">
              <ShoppingCart className="w-4 h-4" /> Walk-In POS
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link to="/pharmacy/receive-stock">
              <PackagePlus className="w-4 h-4 text-primary" /> Receive Stock
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link to="/pharmacy/prescriptions">
              <ClipboardList className="w-4 h-4" /> Hospital Orders
            </Link>
          </Button>
        </div>
      </div>

      {/* Quick Action Navigation Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Link
          to="/pharmacy/receive-stock"
          className="p-3 rounded-xl border bg-card hover:bg-muted/40 transition-colors flex flex-col items-center text-center space-y-1 group"
        >
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <PackagePlus className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-foreground">Receive Stock</span>
          <span className="text-[10px] text-muted-foreground">Inbound Invoices</span>
        </Link>

        <Link
          to="/pharmacy/sales"
          className="p-3 rounded-xl border bg-card hover:bg-muted/40 transition-colors flex flex-col items-center text-center space-y-1 group"
        >
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-foreground">Walk-In POS</span>
          <span className="text-[10px] text-muted-foreground">Retail Checkout</span>
        </Link>

        <Link
          to="/pharmacy/sales-history"
          className="p-3 rounded-xl border bg-card hover:bg-muted/40 transition-colors flex flex-col items-center text-center space-y-1 group"
        >
          <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <History className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-foreground">Sales History</span>
          <span className="text-[10px] text-muted-foreground">Receipts Archive</span>
        </Link>

        <Link
          to="/pharmacy/returns"
          className="p-3 rounded-xl border bg-card hover:bg-muted/40 transition-colors flex flex-col items-center text-center space-y-1 group"
        >
          <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <RotateCcw className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-foreground">Returns & Refunds</span>
          <span className="text-[10px] text-muted-foreground">Credit Vouchers</span>
        </Link>

        <Link
          to="/pharmacy/reports"
          className="p-3 rounded-xl border bg-card hover:bg-muted/40 transition-colors flex flex-col items-center text-center space-y-1 group"
        >
          <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <BarChart3 className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-foreground">Reports</span>
          <span className="text-[10px] text-muted-foreground">Financial & Velocity</span>
        </Link>

        <Link
          to="/pharmacy/settings"
          className="p-3 rounded-xl border bg-card hover:bg-muted/40 transition-colors flex flex-col items-center text-center space-y-1 group"
        >
          <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Settings className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-foreground">POS Settings</span>
          <span className="text-[10px] text-muted-foreground">Governance Rules</span>
        </Link>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard 
          title="Today's Walk-In Revenue" 
          value={`${todayWalkInRevenue.toLocaleString()} ETB`} 
          icon={DollarSign} 
          color="green" 
        />
        <StatCard 
          title="Today's Walk-In Sales" 
          value={todayWalkInSales.length} 
          icon={Receipt} 
          color="blue" 
        />
        <StatCard 
          title="Pending Hospital Rx" 
          value={pendingRx.length} 
          icon={Clock} 
          color="amber" 
        />
        <StatCard 
          title="Low / Out of Stock" 
          value={lowStock.length + outOfStock.length} 
          icon={AlertTriangle} 
          color="red" 
        />
      </div>

      {/* Expiry & Stock Warning Banner */}
      {(expiringSoon.length > 0 || outOfStock.length > 0 || lowStock.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Stock Depletion Alerts */}
          {(outOfStock.length > 0 || lowStock.length > 0) && (
            <div className="bg-red-50/80 dark:bg-red-950/20 border border-red-200/60 rounded-xl p-4">
              <h3 className="text-xs font-bold text-red-700 dark:text-red-400 mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Critical Inventory Alerts
                </span>
                <Link to="/pharmacy/inventory" className="text-[11px] underline hover:no-underline">Manage</Link>
              </h3>
              <div className="space-y-1.5 text-xs">
                {outOfStock.slice(0, 3).map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-red-600 dark:text-red-400">
                    <span className="truncate"><strong>{m.name}</strong></span>
                    <Badge variant="destructive" className="text-[10px] h-4">Out of Stock</Badge>
                  </div>
                ))}
                {lowStock.slice(0, 3).map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-amber-700 dark:text-amber-400">
                    <span className="truncate">{m.name}</span>
                    <span className="font-semibold text-[11px]">{m.quantity} {m.unit || 'units'} left</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expiring Soon Alerts */}
          {expiringSoon.length > 0 && (
            <div className="bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/60 rounded-xl p-4">
              <h3 className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Expiring Within 90 Days
                </span>
                <Link to="/pharmacy/inventory" className="text-[11px] underline hover:no-underline">Inspect</Link>
              </h3>
              <div className="space-y-1.5 text-xs text-amber-900 dark:text-amber-200">
                {expiringSoon.slice(0, 4).map((m) => {
                  const days = differenceInDays(new Date(m.expiry_date), new Date());
                  return (
                    <div key={m.id} className="flex items-center justify-between">
                      <span className="truncate">{m.name} (Batch: {m.batch_number || 'N/A'})</span>
                      <span className="font-medium text-[11px]">{days} days left ({formatDateEAT(m.expiry_date)})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Two Distinct Operational Streams */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stream 1: Walk-In Customer Sales Stream */}
        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border/40">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-emerald-600" />
              <h3 className="font-heading text-sm font-bold">Recent Walk-In Sales</h3>
            </div>
            <Link to="/pharmacy/sales-history" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
              Sales History <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2">
            {walkInSales.slice(0, 5).map((sale) => (
              <div 
                key={sale.id}
                className="p-2.5 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground">{sale.receiptNumber}</p>
                    <Badge variant="outline" className="text-[10px] h-4 capitalize">
                      {sale.paymentMethod?.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {sale.customerName || 'Walk-In Customer'} · {sale.items?.length || 1} items
                  </p>
                </div>
                <div className="text-right shrink-0 flex items-center gap-2">
                  <div>
                    <p className="font-bold text-foreground">{Number(sale.total).toLocaleString()} ETB</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDateTimeEAT(sale.createdAt)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="View Receipt"
                    onClick={() => {
                      setSelectedSale(sale);
                      setIsReceiptOpen(true);
                    }}
                  >
                    <Printer className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ))}

            {walkInSales.length === 0 && (
              <div className="py-8 text-center text-muted-foreground">
                <p className="text-xs">No walk-in sales recorded today.</p>
                <Link to="/pharmacy/sales">
                  <Button size="sm" variant="link" className="text-xs text-primary mt-1">
                    Open POS Terminal
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Stream 2: Hospital Patient Medication Orders Stream */}
        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border/40">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" />
              <h3 className="font-heading text-sm font-bold">Hospital Orders & Prescriptions</h3>
            </div>
            <Link to="/pharmacy/prescriptions" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
              View All <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2">
            {pendingRx.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/40 transition-colors border border-border/40 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Pill className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{p.patient_name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{p.medicine_name} ({p.dosage || '1 dose'})</p>
                  </div>
                </div>
                <StatusBadge status={p.status} />
              </div>
            ))}

            {pendingRx.length === 0 && (
              <div className="py-8 text-center text-muted-foreground">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-1 opacity-70" />
                <p className="text-xs">All hospital medication orders are dispensed!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Printable Receipt Modal */}
      <PharmacyReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        sale={selectedSale}
      />
    </div>
  );
}
