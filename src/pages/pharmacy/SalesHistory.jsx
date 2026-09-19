import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { pharmacySaleService } from '@/services/pharmacySale.service';
import PharmacyReceiptModal from '@/components/pharmacy/PharmacyReceiptModal';
import { formatDateTimeEAT, toEATDate } from '@/lib/dateUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import {
  History,
  Search,
  Printer,
  Calendar,
  CreditCard,
  DollarSign,
  TrendingUp,
  User,
  Eye,
  Filter,
  RefreshCw,
  ShoppingBag
} from 'lucide-react';
import { startOfDay, startOfWeek, startOfMonth, isAfter } from 'date-fns';
import { toast } from 'sonner';

export default function SalesHistory() {
  const [sales, setSales] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); // all, today, week, month
  const [methodFilter, setMethodFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Selected Sale Drawer State
  const [selectedSale, setSelectedSale] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Receipt Modal State
  const [reprintSale, setReprintSale] = useState(null);

  const fetchSales = async () => {
    setIsLoading(true);
    try {
      const data = await pharmacySaleService.getSales();
      setSales(data);
    } catch (err) {
      console.error('[SalesHistory] Failed to fetch sales:', err);
      toast.error('Failed to load sales history');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, []);

  // Filter logic
  const filteredSales = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);

    return sales.filter(s => {
      // 1. Search query
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchReceipt = s.receiptNumber?.toLowerCase().includes(q);
        const matchCustomer = s.customerName?.toLowerCase().includes(q);
        const matchPhone = s.customerPhone?.includes(q);
        const matchCashier = s.cashierName?.toLowerCase().includes(q);
        const matchItems = s.items?.some(it => it.name?.toLowerCase().includes(q));
        if (!matchReceipt && !matchCustomer && !matchPhone && !matchCashier && !matchItems) {
          return false;
        }
      }

      // 2. Date Filter using EAT timezone
      if (dateFilter !== 'all') {
        const saleDate = toEATDate(s.createdAt);
        if (dateFilter === 'today') {
          if (!isAfter(saleDate, todayStart)) return false;
        } else if (dateFilter === 'week') {
          if (!isAfter(saleDate, weekStart)) return false;
        } else if (dateFilter === 'month') {
          if (!isAfter(saleDate, monthStart)) return false;
        }
      }

      // 3. Payment Method Filter
      if (methodFilter !== 'all') {
        if (s.paymentMethod !== methodFilter) return false;
      }

      // 4. Customer Category Filter
      if (categoryFilter !== 'all') {
        if (s.customerCategory !== categoryFilter) return false;
      }

      return true;
    });
  }, [sales, search, dateFilter, methodFilter, categoryFilter]);

  // KPI Calculations
  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);

    const todaySales = sales.filter(s => isAfter(toEATDate(s.createdAt), todayStart));
    const todayRevenue = todaySales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);

    const filteredRevenue = filteredSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);

    return {
      todayCount: todaySales.length,
      todayRevenue,
      filteredCount: filteredSales.length,
      filteredRevenue
    };
  }, [sales, filteredSales]);

  const handleOpenDrawer = (sale) => {
    setSelectedSale(sale);
    setIsDrawerOpen(true);
  };

  const handleReprint = (sale) => {
    setReprintSale(sale);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <History className="w-6 h-6 text-primary" />
            Pharmacy Sales History
          </h1>
          <p className="text-sm text-muted-foreground">
            Complete log of retail walk-in customer transactions, payment breakdowns, and receipt archives.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchSales} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" asChild>
            <Link to="/pharmacy/sales" className="flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4" />
              New Sale POS
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 bg-muted/30 border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Sales Today</span>
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold mt-2 text-foreground">{stats.todayCount}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Transactions today</p>
        </Card>

        <Card className="p-4 bg-muted/30 border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Revenue Today</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold mt-2 font-mono text-emerald-600">
            {stats.todayRevenue.toLocaleString()} ETB
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Cash & digital total</p>
        </Card>

        <Card className="p-4 bg-muted/30 border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Filtered Sales</span>
            <Filter className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold mt-2 text-foreground">{stats.filteredCount}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Matching criteria</p>
        </Card>

        <Card className="p-4 bg-muted/30 border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Filtered Total</span>
            <DollarSign className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold mt-2 font-mono text-primary">
            {stats.filteredRevenue.toLocaleString()} ETB
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Filtered gross volume</p>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search receipt, customer, phone, medicine..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* Date Preset Filter */}
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="h-9 text-xs">
                <Calendar className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="today">Today (Local EAT)</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>

            {/* Payment Method Filter */}
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="h-9 text-xs">
                <CreditCard className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Payment Method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payment Methods</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="telebirr">Telebirr</SelectItem>
                <SelectItem value="cbe_birr">CBE Birr</SelectItem>
                <SelectItem value="mobile_banking">Mobile Banking</SelectItem>
                <SelectItem value="card">Card (POS)</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              </SelectContent>
            </Select>

            {/* Category Filter */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 text-xs">
                <User className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Customer Classification" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classifications</SelectItem>
                <SelectItem value="Adult">Adult</SelectItem>
                <SelectItem value="Child">Child (Pediatric)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Sales Data Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Loading sales history...</div>
          ) : filteredSales.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <History className="w-8 h-8 mx-auto text-muted-foreground/50" />
              <h3 className="font-semibold text-sm">No Sales Records Found</h3>
              <p className="text-xs text-muted-foreground">
                Try adjusting your search criteria or date filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 uppercase font-semibold text-muted-foreground border-b">
                  <tr>
                    <th className="p-3">Receipt & Time</th>
                    <th className="p-3">Customer Profile</th>
                    <th className="p-3 text-right">Total & Method</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredSales.map((sale) => {
                    const itemCount = sale.items?.length || 0;
                    return (
                      <tr key={sale.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3">
                          <div className="font-mono font-semibold text-foreground">
                            {sale.receiptNumber}
                          </div>
                          <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                            {formatDateTimeEAT(sale.createdAt)}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="font-medium text-foreground">{sale.customerName || 'Walk-In Customer'}</div>
                          <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-1.5 mt-0.5">
                            {sale.customerPhone && <span>{sale.customerPhone}</span>}
                            {sale.customerCategory && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0">
                                {sale.customerCategory}
                              </Badge>
                            )}
                            <span className="text-muted-foreground/75">({itemCount} items)</span>
                          </div>
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <div className="font-mono font-bold text-sm text-foreground">
                            {Number(sale.total).toLocaleString()} ETB
                          </div>
                          <div className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground mt-0.5">
                            <Badge variant="secondary" className="capitalize text-[9px] px-1 py-0">
                              {sale.paymentMethod?.replace(/_/g, ' ')}
                            </Badge>
                            {sale.cashierName && (
                              <span className="truncate max-w-[90px]">{sale.cashierName}</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDrawer(sale)}
                              title="View Details"
                              className="h-7 w-7"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleReprint(sale)}
                              title="Reprint Receipt"
                              className="h-7 w-7"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right Drawer for Sale Details */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedSale && (
            <div className="space-y-5">
              <SheetHeader>
                <SheetTitle className="flex items-center justify-between text-base">
                  <span>Sale Record Details</span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {selectedSale.receiptNumber}
                  </Badge>
                </SheetTitle>
                <SheetDescription className="text-xs">
                  Recorded on {formatDateTimeEAT(selectedSale.createdAt)}
                </SheetDescription>
              </SheetHeader>

              {/* Customer Info Card */}
              <div className="p-3 rounded-lg bg-muted/40 border space-y-2 text-xs">
                <div className="font-semibold text-foreground flex items-center gap-1.5 border-b pb-1.5">
                  <User className="w-3.5 h-3.5 text-primary" />
                  Customer Profile
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground">Name: </span>
                    <span className="font-medium text-foreground">{selectedSale.customerName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Phone: </span>
                    <span className="font-medium text-foreground">{selectedSale.customerPhone || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Category: </span>
                    <span className="font-medium text-foreground">{selectedSale.customerCategory || 'Adult'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Gender / Age: </span>
                    <span className="font-medium text-foreground">
                      {selectedSale.customerGender || 'N/A'} {selectedSale.customerAge ? `(${selectedSale.customerAge} yrs)` : ''}
                    </span>
                  </div>
                  {selectedSale.customerWeight && (
                    <div>
                      <span className="text-muted-foreground">Weight: </span>
                      <span className="font-medium text-foreground">{selectedSale.customerWeight} kg</span>
                    </div>
                  )}
                  {selectedSale.prescriptionNumber && (
                    <div>
                      <span className="text-muted-foreground">Prescription #: </span>
                      <span className="font-medium font-mono text-primary">{selectedSale.prescriptionNumber}</span>
                    </div>
                  )}
                </div>
                {selectedSale.notes && (
                  <div className="pt-1 text-muted-foreground italic border-t">
                    Remarks: {selectedSale.notes}
                  </div>
                )}
              </div>

              {/* Itemized Table */}
              <div className="space-y-2">
                <div className="font-semibold text-xs text-foreground">Purchased Medicines</div>
                <div className="border rounded-md divide-y text-xs">
                  {selectedSale.items?.map((it, idx) => (
                    <div key={idx} className="p-2.5 space-y-1">
                      <div className="flex justify-between items-start">
                        <span className="font-semibold text-foreground">{it.name}</span>
                        <span className="font-mono font-semibold text-primary">{it.subtotal?.toLocaleString()} ETB</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>
                          {it.quantity} units @ {it.unitPrice?.toLocaleString()} ETB
                        </span>
                        {it.batchNumber && <span>Batch: {it.batchNumber}</span>}
                      </div>
                      {it.dosageInstructions && (
                        <div className="text-[11px] text-amber-700 bg-amber-50 p-1 rounded">
                          Dosage: {it.dosageInstructions}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Summary */}
              <div className="p-3 rounded-lg bg-muted/40 border space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal:</span>
                  <span>{selectedSale.subtotal?.toLocaleString()} ETB</span>
                </div>
                {selectedSale.discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount:</span>
                    <span>-{selectedSale.discount?.toLocaleString()} ETB</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-foreground pt-1 border-t">
                  <span>Grand Total:</span>
                  <span className="text-primary">{selectedSale.total?.toLocaleString()} ETB</span>
                </div>
                <div className="flex justify-between text-muted-foreground pt-1">
                  <span>Payment Method:</span>
                  <span className="uppercase">{selectedSale.paymentMethod?.replace(/_/g, ' ')}</span>
                </div>
                {selectedSale.paymentMethod === 'cash' && (
                  <>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Amount Tendered:</span>
                      <span>{selectedSale.amountPaid?.toLocaleString()} ETB</span>
                    </div>
                    <div className="flex justify-between text-emerald-600 font-semibold">
                      <span>Change Given:</span>
                      <span>{selectedSale.change?.toLocaleString()} ETB</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-muted-foreground pt-1 border-t">
                  <span>Cashier / Pharmacist:</span>
                  <span>{selectedSale.cashierName}</span>
                </div>
              </div>

              {/* Drawer Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => handleReprint(selectedSale)}
                  className="w-full flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  Reprint Official Receipt
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Receipt Modal for Reprinting */}
      <PharmacyReceiptModal
        isOpen={!!reprintSale}
        onClose={() => setReprintSale(null)}
        sale={reprintSale}
      />
    </div>
  );
}
