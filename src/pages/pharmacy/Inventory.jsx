import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ethioCareClient } from '@/api/ethioCareClient';
import StatusBadge from '@/components/common/StatusBadge';
import StatCard from '@/components/common/StatCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Package,
  AlertTriangle,
  DollarSign,
  Plus,
  Minus,
  Pencil,
  ArrowDownToLine,
  History,
  Layers
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { logAudit } from '@/lib/auditLogger';
import { notificationService } from '@/services/notification.service';
import { movementService } from '@/services/movement.service';
import { formatDateEAT, formatDateTimeEAT } from '@/lib/dateUtils';

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

export default function Inventory() {
  const { user, role } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [movementTypeFilter, setMovementTypeFilter] = useState('all');
  const [stockAdjust, setStockAdjust] = useState({ open: false, med: null, action: 'set', value: '' });
  const queryClient = useQueryClient();

  // Load medicines
  const { data: medicines = [], isLoading } = useQuery({
    queryKey: ['medicines'],
    queryFn: () => ethioCareClient.entities.Medicine.list('-created_date', 300)
  });

  // Load inventory movements
  const { data: movements = [], isLoading: isLoadingMovements } = useQuery({
    queryKey: ['inventory_movements'],
    queryFn: () => movementService.getMovements()
  });

  const medicinesWithStatus = useMemo(() => medicines.map((m) => ({
    ...m,
    computedStatus: m.status && m.status !== 'in_stock' ? m.status : computeStatus(m)
  })), [medicines]);

  const filtered = medicinesWithStatus.filter((m) => {
    const matchSearch = !search ||
      m.name?.toLowerCase().includes(search.toLowerCase()) ||
      m.generic_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.barcode?.includes(search) ||
      m.sku?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || m.computedStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      const matchSearch = !search ||
        m.medicineName?.toLowerCase().includes(search.toLowerCase()) ||
        m.batchNumber?.toLowerCase().includes(search.toLowerCase()) ||
        m.referenceId?.toLowerCase().includes(search.toLowerCase());
      const matchType = movementTypeFilter === 'all' || m.movementType === movementTypeFilter;
      return matchSearch && matchType;
    });
  }, [movements, search, movementTypeFilter]);

  const totalValue = medicines.reduce((s, m) => s + (m.unit_price || 0) * (m.quantity || 0), 0);
  const lowStock = medicinesWithStatus.filter((m) => m.computedStatus === 'low_stock');
  const outOfStock = medicinesWithStatus.filter((m) => m.computedStatus === 'out_of_stock');
  const expired = medicinesWithStatus.filter((m) => m.computedStatus === 'expired');

  const [isSavingStock, setIsSavingStock] = useState(false);

  const handleStockSave = async () => {
    if (!stockAdjust.med) return;
    setIsSavingStock(true);
    try {
      const currentQty = stockAdjust.med.quantity || 0;
      let newQty;
      const inputVal = parseInt(stockAdjust.value) || 0;

      if (stockAdjust.action === 'set') {
        newQty = inputVal;
      } else if (stockAdjust.action === 'add') {
        newQty = currentQty + inputVal;
      } else {
        newQty = currentQty - inputVal;
      }
      if (newQty < 0) newQty = 0;

      const diff = Math.abs(newQty - currentQty);
      const isPositive = newQty >= currentQty;
      const movementType = isPositive ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';

      const status = computeStatus({ ...stockAdjust.med, quantity: newQty });
      await ethioCareClient.entities.Medicine.update(stockAdjust.med.id, { quantity: newQty, status });

      // Record movement
      if (diff > 0) {
        try {
          await movementService.recordMovement({
            medicineId: stockAdjust.med.id,
            medicineName: stockAdjust.med.name,
            movementType,
            quantity: diff,
            batchNumber: stockAdjust.med.batch_number,
            expiryDate: stockAdjust.med.expiry_date,
            unitPrice: stockAdjust.med.unit_price,
            referenceType: 'manual_adjustment',
            referenceId: `ADJ-${Date.now().toString().slice(-6)}`,
            notes: `Manual stock adjustment (${stockAdjust.action}): ${currentQty} -> ${newQty}`,
            performedBy: user?.full_name || 'Staff',
            performedByRole: role || 'pharmacist'
          });
        } catch (mErr) {
          console.warn('[Inventory] Movement logging failed:', mErr);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      queryClient.invalidateQueries({ queryKey: ['inventory_movements'] });

      toast.success(`${stockAdjust.med.name}: ${currentQty} → ${newQty} ${stockAdjust.med.unit || 'pieces'}`);
      logAudit({
        userName: user?.full_name || 'Staff',
        userRole: role || 'pharmacist',
        action: 'update',
        module: 'Inventory',
        description: `Adjusted stock for ${stockAdjust.med.name}: ${currentQty} → ${newQty} ${stockAdjust.med.unit || 'pieces'} (${stockAdjust.action})`,
        recordId: stockAdjust.med.id,
        recordName: stockAdjust.med.name
      });

      if (newQty <= (stockAdjust.med.min_stock || 10)) {
        notificationService.dispatch({
          title: 'Low Medicine Stock',
          message: `${stockAdjust.med.name} is now low on stock (${newQty} remaining).`,
          type: 'alert',
          module: 'pharmacy',
          targetRoles: ['pharmacist', 'owner'],
          link: '/pharmacy/inventory'
        });
      }
      setStockAdjust({ open: false, med: null, action: 'set', value: '' });
    } catch (err) {
      console.error('[Inventory] Error adjusting stock:', err);
      toast.error(err.message || 'Failed to update stock');
    } finally {
      setIsSavingStock(false);
    }
  };

  const openStockAdjust = (med, action) => {
    setStockAdjust({ open: true, med, action, value: '' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Pharmacy Inventory</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{medicines.length} medicines in inventory</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="shadow-sm">
            <Link to="/pharmacy/receive-stock" className="flex items-center gap-1.5">
              <ArrowDownToLine className="w-4 h-4" />
              Receive Stock
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Total Medicines" value={medicines.length} icon={Package} color="blue" />
        <StatCard title="Inventory Value" value={`${totalValue.toLocaleString()} ETB`} icon={DollarSign} color="green" />
        <StatCard title="Low Stock" value={lowStock.length} icon={AlertTriangle} color="amber" />
        <StatCard title="Expired" value={expired.length} icon={AlertTriangle} color="red" />
      </div>

      {/* Tab Navigation */}
      <Tabs defaultValue="stock" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="stock" className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Medicines Stock ({medicines.length})
          </TabsTrigger>
          <TabsTrigger value="movements" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Movements Audit Log ({movements.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Stock Inventory */}
        <TabsContent value="stock" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by name, generic, barcode, or SKU..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
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
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b border-border sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider">Medicine</th>
                        <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider">Category</th>
                        <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider">Stock</th>
                        <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider">Price (ETB)</th>
                        <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider">Expiry</th>
                        <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider">Status</th>
                        <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((m) => (
                        <tr key={m.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-semibold">{m.name}</p>
                            {m.generic_name && <p className="text-xs text-muted-foreground">{m.generic_name}</p>}
                            {m.strength && <p className="text-xs text-muted-foreground">{m.strength} · {m.dosage_form}</p>}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{m.category || '-'}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium">{m.quantity} {m.unit}</p>
                            <p className="text-xs text-muted-foreground">Min: {m.min_stock || 10}</p>
                          </td>
                          <td className="px-4 py-3 font-medium">{m.unit_price?.toLocaleString()}</td>
                          <td className="px-4 py-3 text-xs">
                            {m.expiry_date ? formatDateEAT(m.expiry_date) : '-'}
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={m.computedStatus} /></td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-9 w-9" title="Stock In" onClick={() => openStockAdjust(m, 'add')}>
                                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-9 w-9" title="Stock Out" onClick={() => openStockAdjust(m, 'remove')}>
                                <Minus className="w-3.5 h-3.5 text-red-600" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-9 w-9" title="Set Stock" onClick={() => openStockAdjust(m, 'set')}>
                                <Pencil className="w-3.5 h-3.5" />
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
                  {filtered.map((m) => (
                    <div key={m.id} className="border border-border/60 rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-sm">{m.name}</p>
                          <p className="text-xs text-muted-foreground">{m.generic_name} · {m.strength}</p>
                        </div>
                        <StatusBadge status={m.computedStatus} />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Stock: <strong className="text-foreground">{m.quantity} {m.unit}</strong></span>
                        <span className="text-muted-foreground">Price: <strong className="text-foreground">{m.unit_price?.toLocaleString()} ETB</strong></span>
                      </div>
                      {m.expiry_date && <p className="text-xs text-muted-foreground">Expires: {formatDateEAT(m.expiry_date)}</p>}
                      <div className="flex items-center gap-2 pt-1 border-t border-border/60">
                        <Button variant="outline" size="sm" className="h-9 flex-1" onClick={() => openStockAdjust(m, 'add')}>
                          <Plus className="w-3.5 h-3.5 mr-1" /> In
                        </Button>
                        <Button variant="outline" size="sm" className="h-9 flex-1" onClick={() => openStockAdjust(m, 'remove')}>
                          <Minus className="w-3.5 h-3.5 mr-1" /> Out
                        </Button>
                        <Button variant="outline" size="sm" className="h-9 flex-1" onClick={() => openStockAdjust(m, 'set')}>
                          <Pencil className="w-3.5 h-3.5 mr-1" /> Set
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* TAB 2: Movements Audit Log */}
        <TabsContent value="movements" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search movements by medicine, batch, or reference..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={movementTypeFilter} onValueChange={setMovementTypeFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Movement Types</SelectItem>
                <SelectItem value="STOCK_IN">STOCK_IN (Receiving)</SelectItem>
                <SelectItem value="HOSPITAL_DISPENSE">HOSPITAL_DISPENSE</SelectItem>
                <SelectItem value="WALK_IN_SALE">WALK_IN_SALE</SelectItem>
                <SelectItem value="RETURN_IN">RETURN_IN (Refunds)</SelectItem>
                <SelectItem value="DAMAGED">DAMAGED</SelectItem>
                <SelectItem value="EXPIRED">EXPIRED</SelectItem>
                <SelectItem value="ADJUSTMENT_IN">ADJUSTMENT_IN</SelectItem>
                <SelectItem value="ADJUSTMENT_OUT">ADJUSTMENT_OUT</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-card rounded-xl border border-border/60 overflow-hidden shadow-soft">
            {isLoadingMovements ? (
              <div className="p-8 text-center text-muted-foreground">Loading movements...</div>
            ) : filteredMovements.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No movements recorded matching filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-b border-border uppercase font-semibold text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Timestamp (EAT)</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Medicine</th>
                      <th className="px-4 py-3">Batch / Expiry</th>
                      <th className="px-4 py-3 text-right">Quantity</th>
                      <th className="px-4 py-3">Reference</th>
                      <th className="px-4 py-3">Performed By</th>
                      <th className="px-4 py-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredMovements.map(m => {
                      const isInbound = ['STOCK_IN', 'RETURN_IN', 'ADJUSTMENT_IN', 'TRANSFER_IN'].includes(m.movementType);
                      return (
                        <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                            {formatDateTimeEAT(m.performedAt)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-mono font-bold ${
                                isInbound
                                  ? 'text-emerald-700 border-emerald-300 bg-emerald-50/50'
                                  : 'text-amber-700 border-amber-300 bg-amber-50/50'
                              }`}
                            >
                              {m.movementType}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">
                            {m.medicineName}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground font-mono">
                            {m.batchNumber || '-'}
                            {m.expiryDate && <span className="text-[10px] block">Exp: {formatDateEAT(m.expiryDate)}</span>}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-sm">
                            <span className={isInbound ? 'text-emerald-600' : 'text-amber-600'}>
                              {isInbound ? '+' : '-'}{m.quantity}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-muted-foreground">
                            {m.referenceId || '-'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {m.performedBy}
                          </td>
                          <td className="px-4 py-3 max-w-xs truncate text-muted-foreground" title={m.notes}>
                            {m.notes || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Stock Adjust Dialog */}
      <Dialog open={stockAdjust.open} onOpenChange={open => !open && setStockAdjust({ open: false, med: null, action: 'set', value: '' })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {stockAdjust.action === 'add' ? 'Stock In' : stockAdjust.action === 'remove' ? 'Stock Out' : 'Adjust Stock'}
              : {stockAdjust.med?.name}
            </DialogTitle>
          </DialogHeader>
          {stockAdjust.med && (
            <div className="space-y-4 pt-2">
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current Stock:</span>
                  <span className="font-semibold">{stockAdjust.med.quantity} {stockAdjust.med.unit}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Min Stock:</span>
                  <span className="font-semibold">{stockAdjust.med.min_stock || 10}</span>
                </div>
              </div>
              <div>
                <Label>
                  {stockAdjust.action === 'add' ? 'Quantity to Add' : stockAdjust.action === 'remove' ? 'Quantity to Remove' : 'New Quantity'}
                </Label>
                <Input
                  type="number"
                  autoFocus
                  value={stockAdjust.value}
                  onChange={e => setStockAdjust({ ...stockAdjust, value: e.target.value })}
                  placeholder="0"
                />
              </div>
              <Button className="w-full" onClick={handleStockSave} disabled={!stockAdjust.value || isSavingStock}>
                {isSavingStock ? 'Updating Stock...' : 'Confirm'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
