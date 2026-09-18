import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import { pharmacySaleService } from '@/services/pharmacySale.service';
import { salesReturnService } from '@/services/salesReturn.service';
import { movementService } from '@/services/movement.service';
import { toEATDate } from '@/lib/dateUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  DollarSign,
  Package,
  Activity,
  Printer,
  Calendar,
  RefreshCw,
  ShoppingBag,
  TrendingUp
} from 'lucide-react';
import { startOfDay, startOfWeek, startOfMonth, isAfter, differenceInDays } from 'date-fns';

export default function PharmacyReports() {
  const [period, setPeriod] = useState('month');

  // Load medicines
  const { data: medicines = [], isLoading: isLoadingMeds, refetch: refetchMeds } = useQuery({
    queryKey: ['medicines'],
    queryFn: () => ethioCareClient.entities.Medicine.list('name', 500)
  });

  // Load prescriptions (Hospital Dispensing)
  const { data: prescriptions = [], isLoading: isLoadingRx, refetch: refetchRx } = useQuery({
    queryKey: ['prescriptions'],
    queryFn: () => ethioCareClient.entities.Prescription.list('-created_date', 500)
  });

  // Load Walk-In Sales
  const { data: walkInSales = [], isLoading: isLoadingSales, refetch: refetchSales } = useQuery({
    queryKey: ['walk_in_sales'],
    queryFn: () => pharmacySaleService.getSales()
  });

  // Load Sales Returns
  const { data: salesReturns = [], isLoading: isLoadingReturns, refetch: refetchReturns } = useQuery({
    queryKey: ['sales_returns'],
    queryFn: () => salesReturnService.getReturns()
  });

  // Load Movements
  const { data: movements = [], isLoading: isLoadingMovements, refetch: refetchMovements } = useQuery({
    queryKey: ['inventory_movements'],
    queryFn: () => movementService.getMovements()
  });

  const handleRefreshAll = () => {
    refetchMeds();
    refetchRx();
    refetchSales();
    refetchReturns();
    refetchMovements();
  };

  // Date filtering helper
  const isDateInPeriod = (dateStr) => {
    if (period === 'all') return true;
    const d = toEATDate(dateStr);
    const now = new Date();
    if (period === 'today') return isAfter(d, startOfDay(now));
    if (period === 'week') return isAfter(d, startOfWeek(now, { weekStartsOn: 1 }));
    if (period === 'month') return isAfter(d, startOfMonth(now));
    return true;
  };

  // Aggregated Analytics
  const analytics = useMemo(() => {
    // 1. Current Total Inventory Valuation (Owner Price & Cost Price)
    let totalStockQty = 0;
    let inventoryRetailValue = 0;
    let inventoryCostValue = 0;
    let outOfStockCount = 0;
    let lowStockCount = 0;
    let expiringSoonCount = 0;

    medicines.forEach((m) => {
      const q = Number(m.quantity) || 0;
      const sp = Number(m.unit_price) || 0;
      const cp = Number(m.purchase_price) || 0;
      totalStockQty += q;
      inventoryRetailValue += q * sp;
      inventoryCostValue += q * cp;

      if (q <= 0) outOfStockCount++;
      else if (q <= (m.min_stock || 10)) lowStockCount++;

      if (m.expiry_date) {
        const days = differenceInDays(new Date(m.expiry_date), new Date());
        if (days >= 0 && days <= 60) expiringSoonCount++;
      }
    });

    // 2. Hospital Dispensing in Period
    const filteredPrescriptions = prescriptions.filter((p) => isDateInPeriod(p.created_date || p.created_at));
    const dispensedPrescriptions = filteredPrescriptions.filter((p) => p.status === 'dispensed');
    let hospitalDispensedUnits = 0;
    let hospitalEstimatedRevenue = 0;

    dispensedPrescriptions.forEach((p) => {
      const q = Number(p.quantity) || 1;
      hospitalDispensedUnits += q;
      const med = medicines.find((m) => m.name?.toLowerCase() === p.medicine_name?.toLowerCase());
      const price = Number(med?.unit_price) || 0;
      hospitalEstimatedRevenue += q * price;
    });

    // 3. Walk-In Sales in Period
    const filteredSales = walkInSales.filter(s => isDateInPeriod(s.createdAt));
    const grossRetailRevenue = filteredSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);

    // 4. Sales Returns in Period
    const filteredReturns = salesReturns.filter(r => isDateInPeriod(r.createdAt));
    const totalRefunded = filteredReturns.reduce((sum, r) => sum + (Number(r.refundAmount) || 0), 0);
    const netRetailRevenue = Math.max(0, grossRetailRevenue - totalRefunded);

    // 5. Combined Total Revenue
    const combinedRevenue = hospitalEstimatedRevenue + netRetailRevenue;

    // 6. Movement Breakdown in Period
    const filteredMovements = movements.filter(m => isDateInPeriod(m.performedAt));
    const movementCounts = {};
    const movementVolumes = {};

    filteredMovements.forEach(m => {
      movementCounts[m.movementType] = (movementCounts[m.movementType] || 0) + 1;
      movementVolumes[m.movementType] = (movementVolumes[m.movementType] || 0) + Number(m.quantity);
    });

    // 7. Top Moving Medicines (combined walk-in + hospital)
    const medicineMovementMap = {};

    filteredSales.forEach(s => {
      s.items?.forEach(it => {
        const key = it.name;
        if (!medicineMovementMap[key]) {
          medicineMovementMap[key] = { name: it.name, quantity: 0, revenue: 0 };
        }
        medicineMovementMap[key].quantity += Number(it.quantity) || 0;
        medicineMovementMap[key].revenue += Number(it.subtotal) || 0;
      });
    });

    dispensedPrescriptions.forEach((p) => {
      const key = p.medicine_name || 'Prescription';
      if (!medicineMovementMap[key]) {
        medicineMovementMap[key] = { name: key, quantity: 0, revenue: 0 };
      }
      const q = Number(p.quantity) || 1;
      medicineMovementMap[key].quantity += q;
      const med = medicines.find((m) => m.name?.toLowerCase() === key.toLowerCase());
      medicineMovementMap[key].revenue += q * (Number(med?.unit_price) || 0);
    });

    const topMedicines = Object.values(medicineMovementMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8);

    return {
      totalStockQty,
      inventoryRetailValue,
      inventoryCostValue,
      outOfStockCount,
      lowStockCount,
      expiringSoonCount,
      dispensedPrescriptionsCount: dispensedPrescriptions.length,
      hospitalDispensedUnits,
      hospitalEstimatedRevenue,
      walkInSalesCount: filteredSales.length,
      grossRetailRevenue,
      returnsCount: filteredReturns.length,
      totalRefunded,
      netRetailRevenue,
      combinedRevenue,
      movementCounts,
      movementVolumes,
      topMedicines
    };
  }, [medicines, prescriptions, walkInSales, salesReturns, movements, period]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Pharmacy Financial & Operations Reports
          </h1>
          <p className="text-sm text-muted-foreground">
            Aggregated real metrics: Hospital dispensing, net walk-in retail sales, inventory valuation, and stock velocity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Period selector */}
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-36 h-9 text-xs">
              <Calendar className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={handleRefreshAll}>
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => window.print()}
            className="flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </Button>
        </div>
      </div>

      {/* Primary KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Combined Revenue */}
        <Card className="p-4 bg-primary/5 border-primary/20 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Combined Revenue</span>
            <DollarSign className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold font-mono mt-2 text-primary">
            {analytics.combinedRevenue.toLocaleString()} ETB
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Hospital + Net Retail ({period})
          </p>
        </Card>

        {/* Net Retail Sales */}
        <Card className="p-4 bg-muted/30 border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Net Walk-In Sales</span>
            <ShoppingBag className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono mt-2 text-emerald-600">
            {analytics.netRetailRevenue.toLocaleString()} ETB
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {analytics.walkInSalesCount} sales (net of -{analytics.totalRefunded.toLocaleString()} ETB returns)
          </p>
        </Card>

        {/* Hospital Dispensing */}
        <Card className="p-4 bg-muted/30 border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Hospital Dispensed</span>
            <Activity className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono mt-2 text-foreground">
            {analytics.hospitalEstimatedRevenue.toLocaleString()} ETB
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {analytics.dispensedPrescriptionsCount} Rx ({analytics.hospitalDispensedUnits} units dispensed)
          </p>
        </Card>

        {/* Inventory Value */}
        <Card className="p-4 bg-muted/30 border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Total Inventory Value</span>
            <Package className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold font-mono mt-2 text-foreground">
            {analytics.inventoryRetailValue.toLocaleString()} ETB
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {analytics.totalStockQty.toLocaleString()} units on shelf (Cost: {analytics.inventoryCostValue.toLocaleString()} ETB)
          </p>
        </Card>
      </div>

      {/* Revenue Breakdown Detailed Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Financial Breakdown Card */}
        <Card className="lg:col-span-1 shadow-sm">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-semibold">Revenue Stream Distribution</CardTitle>
            <CardDescription>Breakdown between in-hospital care and retail counter</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4 text-xs">
            <div className="space-y-2">
              <div className="flex justify-between font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Gross Walk-In Counter Sales:
                </span>
                <span className="font-mono font-semibold">{analytics.grossRetailRevenue.toLocaleString()} ETB</span>
              </div>
              <div className="flex justify-between font-medium text-destructive">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-destructive" />
                  Customer Refunds & Returns ({analytics.returnsCount}):
                </span>
                <span className="font-mono font-semibold">-{analytics.totalRefunded.toLocaleString()} ETB</span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-2 text-emerald-600">
                <span>Net Walk-In Revenue:</span>
                <span className="font-mono">{analytics.netRetailRevenue.toLocaleString()} ETB</span>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <div className="flex justify-between font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  Inpatient & OPD Prescriptions:
                </span>
                <span className="font-mono font-semibold">{analytics.hospitalEstimatedRevenue.toLocaleString()} ETB</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Prescriptions dispensed: {analytics.dispensedPrescriptionsCount} orders
              </div>
            </div>

            <div className="p-3 bg-muted/40 rounded-lg space-y-1 font-semibold border">
              <div className="flex justify-between text-sm">
                <span>Grand Combined Total:</span>
                <span className="font-mono text-primary">{analytics.combinedRevenue.toLocaleString()} ETB</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Center: Inventory Health & Alerts */}
        <Card className="lg:col-span-1 shadow-sm">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-semibold">Inventory Health & Stock Limits</CardTitle>
            <CardDescription>Live monitoring of catalog stock thresholds</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
              <div className="font-medium">Total Medicine SKUs in Catalog</div>
              <div className="text-base font-bold font-mono">{medicines.length}</div>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
              <div>
                <div className="font-medium">Low Stock Warning (≤ Min Stock)</div>
                <div className="text-[10px] text-amber-700">Needs replenishment</div>
              </div>
              <div className="text-base font-bold font-mono">{analytics.lowStockCount}</div>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
              <div>
                <div className="font-medium">Out of Stock Medicines</div>
                <div className="text-[10px]">Zero inventory available</div>
              </div>
              <div className="text-base font-bold font-mono">{analytics.outOfStockCount}</div>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
              <div>
                <div className="font-medium">Expiring Soon (Next 60 Days)</div>
                <div className="text-[10px] text-blue-700">Near-expiry review recommended</div>
              </div>
              <div className="text-base font-bold font-mono">{analytics.expiringSoonCount}</div>
            </div>
          </CardContent>
        </Card>

        {/* Right: Movement Volume Breakdown */}
        <Card className="lg:col-span-1 shadow-sm">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-semibold">Inventory Movement Flow</CardTitle>
            <CardDescription>Activity count by movement category ({period})</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-2 text-xs">
            {Object.keys(analytics.movementCounts).length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">No movements recorded in this period.</div>
            ) : (
              <div className="space-y-2">
                {Object.entries(analytics.movementCounts).map(([type, count]) => {
                  const vol = analytics.movementVolumes[type] || 0;
                  return (
                    <div key={type} className="flex justify-between items-center p-2 rounded bg-muted/40 border">
                      <span className="font-medium font-mono text-[11px]">{type}</span>
                      <div className="text-right">
                        <span className="font-bold">{count} ops</span>
                        <span className="text-muted-foreground text-[10px] block">({vol} units)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fast-Moving Top Medicines Table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Top Fast-Moving Medicines ({period})
          </CardTitle>
          <CardDescription>
            Ranked by total units dispensed across hospital prescriptions and walk-in counter sales
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {analytics.topMedicines.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No dispensing or sales recorded in selected period.
            </div>
          ) : (
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 uppercase font-semibold text-muted-foreground border-b">
                <tr>
                  <th className="p-3">Rank</th>
                  <th className="p-3">Medicine Name</th>
                  <th className="p-3 text-right">Units Dispensed / Sold</th>
                  <th className="p-3 text-right">Generated Revenue</th>
                  <th className="p-3 text-center">Velocity</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {analytics.topMedicines.map((med, idx) => (
                  <tr key={idx} className="hover:bg-muted/30">
                    <td className="p-3 font-bold text-muted-foreground">#{idx + 1}</td>
                    <td className="p-3 font-semibold text-foreground">{med.name}</td>
                    <td className="p-3 text-right font-mono font-bold text-foreground">
                      {med.quantity.toLocaleString()} units
                    </td>
                    <td className="p-3 text-right font-mono font-semibold text-primary">
                      {med.revenue.toLocaleString()} ETB
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">
                        High Demand
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
