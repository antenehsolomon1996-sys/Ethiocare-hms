import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { stockReceiveService } from '@/services/stockReceive.service';
import { formatDateEAT, getTodayEATString } from '@/lib/dateUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  PackagePlus,
  Plus,
  Trash2,
  CheckCircle2,
  Printer,
  History,
  Building2,
  FileSpreadsheet,
  DollarSign,
  Search,
  ArrowDownToLine
} from 'lucide-react';
import { toast } from 'sonner';

const EMPTY_ROW = {
  name: '',
  genericName: '',
  category: 'Antibiotic',
  dosageForm: 'Tablet',
  strength: '',
  unit: 'tablets',
  batchNumber: '',
  expiryDate: '',
  manufacturingDate: '',
  quantity: 100,
  purchasePrice: 10,
  sellingPrice: 15,
  taxPercent: 0,
  barcode: ''
};

export default function ReceiveStock() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const todayStr = getTodayEATString();

  // Inbound form state
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [supplier, setSupplier] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(todayStr);
  const [deliveryDate, setDeliveryDate] = useState(todayStr);
  const [warehouseLocation, setWarehouseLocation] = useState('Main Pharmacy Store');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ ...EMPTY_ROW }]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // GRN Receipt Modal
  const [completedInvoice, setCompletedInvoice] = useState(null);

  // Load existing medicines catalog for search/autocomplete
  const { data: medicines = [] } = useQuery({
    queryKey: ['medicines'],
    queryFn: () => base44.entities.Medicine.list('name', 300)
  });

  // Load past invoices
  const { data: pastInvoices = [], isLoading: isLoadingInvoices, refetch: refetchInvoices } = useQuery({
    queryKey: ['purchase_invoices'],
    queryFn: () => stockReceiveService.getInvoices()
  });

  // Calculations
  const calculatedTotals = useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;
    let totalQuantity = 0;
    let inventoryValue = 0;

    items.forEach(it => {
      const q = Number(it.quantity) || 0;
      const pp = Number(it.purchasePrice) || 0;
      const sp = Number(it.sellingPrice) || 0;
      const tax = Number(it.taxPercent) || 0;

      const rowSub = q * pp;
      const rowTax = rowSub * (tax / 100);

      subtotal += rowSub;
      taxTotal += rowTax;
      totalQuantity += q;
      inventoryValue += q * sp;
    });

    return {
      subtotal,
      taxTotal,
      grandTotal: subtotal + taxTotal,
      totalQuantity,
      inventoryValue
    };
  }, [items]);

  // Handle item change
  const handleItemChange = (index, field, value) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Autocomplete select from catalog
  const handleSelectMedicineCatalog = (index, medId) => {
    const med = medicines.find(m => m.id === medId);
    if (!med) return;

    setItems(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        medicineId: med.id,
        name: med.name,
        genericName: med.generic_name || '',
        category: med.category || 'General',
        dosageForm: med.dosage_form || 'Tablet',
        strength: med.strength || '',
        unit: med.unit || 'tablets',
        purchasePrice: med.purchase_price || 0,
        sellingPrice: med.unit_price || 0,
        barcode: med.barcode || ''
      };
      return updated;
    });
  };

  // Add new row
  const handleAddRow = () => {
    setItems(prev => [...prev, { ...EMPTY_ROW }]);
  };

  // Remove row
  const handleRemoveRow = (index) => {
    if (items.length === 1) {
      toast.error('At least one medicine item is required');
      return;
    }
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // Reset form
  const handleResetForm = () => {
    setInvoiceNumber('');
    setPoNumber('');
    setSupplier('');
    setInvoiceDate(todayStr);
    setDeliveryDate(todayStr);
    setWarehouseLocation('Main Pharmacy Store');
    setNotes('');
    setItems([{ ...EMPTY_ROW }]);
  };

  // Submit Receive Stock
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    const validation = stockReceiveService.validateReceive({
      invoiceNumber,
      supplier,
      deliveryDate,
      items
    });

    if (!validation.valid) {
      toast.error(validation.errors[0]);
      return;
    }

    setIsSubmitting(true);
    try {
      const received = await stockReceiveService.processReceiveStock({
        invoiceNumber,
        poNumber,
        supplier,
        invoiceDate,
        deliveryDate,
        warehouseLocation,
        receivedBy: user?.full_name || 'Pharmacist',
        receivedByRole: role || 'pharmacist',
        notes,
        items
      });

      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      queryClient.invalidateQueries({ queryKey: ['inventory_movements'] });
      refetchInvoices();

      toast.success(`Invoice #${received.invoiceNumber} received successfully!`);
      setCompletedInvoice(received);
      handleResetForm();
    } catch (err) {
      console.error('[ReceiveStock] Error submitting:', err);
      toast.error(err.message || 'Failed to receive stock');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <PackagePlus className="w-7 h-7 text-primary" />
            Receive Stock (Inbound Inventory)
          </h1>
          <p className="text-sm text-muted-foreground">
            Record supplier purchase invoices, update batch quantities, set retail prices, and log movements.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetForm}
            disabled={isSubmitting}
          >
            Clear Form
          </Button>
        </div>
      </div>

      <Tabs defaultValue="receive" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="receive" className="flex items-center gap-2">
            <ArrowDownToLine className="w-4 h-4" />
            Receive Invoice
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Past Invoices ({pastInvoices.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Receive Form */}
        <TabsContent value="receive" className="mt-4 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Invoice Header Details */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  Purchase Invoice Details
                </CardTitle>
                <CardDescription>Enter the supplier invoice header information</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="inv-num" className="text-xs font-semibold">
                    Invoice Number <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="inv-num"
                    placeholder="e.g. INV-2026-8841"
                    value={invoiceNumber}
                    onChange={e => setInvoiceNumber(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inv-supplier" className="text-xs font-semibold">
                    Supplier / Vendor <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="inv-supplier"
                    placeholder="e.g. Ethiopian Pharmaceuticals Supply (EPSA)"
                    value={supplier}
                    onChange={e => setSupplier(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inv-po" className="text-xs font-semibold">
                    PO Number (Optional)
                  </Label>
                  <Input
                    id="inv-po"
                    placeholder="e.g. PO-4092"
                    value={poNumber}
                    onChange={e => setPoNumber(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inv-wh" className="text-xs font-semibold">
                    Warehouse / Storage Location
                  </Label>
                  <Select value={warehouseLocation} onValueChange={setWarehouseLocation}>
                    <SelectTrigger id="inv-wh">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Main Pharmacy Store">Main Pharmacy Store</SelectItem>
                      <SelectItem value="Pharmacy Shelf A (Tablets)">Pharmacy Shelf A (Tablets)</SelectItem>
                      <SelectItem value="Pharmacy Shelf B (Syrups)">Pharmacy Shelf B (Syrups)</SelectItem>
                      <SelectItem value="Cold Storage Fridge">Cold Storage Fridge</SelectItem>
                      <SelectItem value="Emergency Cabinet">Emergency Cabinet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inv-date" className="text-xs font-semibold">
                    Invoice Date
                  </Label>
                  <Input
                    id="inv-date"
                    type="date"
                    value={invoiceDate}
                    onChange={e => setInvoiceDate(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inv-delivery" className="text-xs font-semibold">
                    Delivery / Received Date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="inv-delivery"
                    type="date"
                    value={deliveryDate}
                    onChange={e => setDeliveryDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="inv-notes" className="text-xs font-semibold">
                    Delivery Notes / Memo
                  </Label>
                  <Input
                    id="inv-notes"
                    placeholder="e.g. Delivered by refrigerated truck, seals intact"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Medicine Rows */}
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-primary" />
                    Inbound Medicine Items ({items.length})
                  </CardTitle>
                  <CardDescription>
                    Select existing medicine or type new. Specify batch, expiry, quantity, and prices.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddRow}
                  className="flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Add Row
                </Button>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <div className="min-w-[1100px] border-t divide-y">
                  {/* Table Header */}
                  <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-muted/60 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <div className="col-span-3">Medicine & Generic</div>
                    <div className="col-span-2">Category & Form</div>
                    <div className="col-span-1">Batch #</div>
                    <div className="col-span-2">Dates (Mfg / Exp)</div>
                    <div className="col-span-1 text-right">Quantity</div>
                    <div className="col-span-1 text-right">Cost Price</div>
                    <div className="col-span-1 text-right">Retail Price</div>
                    <div className="col-span-1 text-center">Action</div>
                  </div>

                  {/* Item Rows */}
                  {items.map((item, idx) => {
                    const rowSub = (Number(item.quantity) || 0) * (Number(item.purchasePrice) || 0);
                    return (
                      <div
                        key={idx}
                        className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-muted/30 transition-colors"
                      >
                        {/* Medicine & Generic */}
                        <div className="col-span-3 space-y-1.5">
                          <div className="flex gap-1">
                            <Input
                              placeholder="Medicine Name *"
                              value={item.name}
                              onChange={e => handleItemChange(idx, 'name', e.target.value)}
                              className="text-xs font-medium h-8"
                              required
                            />
                            {/* Autocomplete selector */}
                            <Select
                              value={item.medicineId || ''}
                              onValueChange={val => handleSelectMedicineCatalog(idx, val)}
                            >
                              <SelectTrigger className="h-8 w-8 px-1">
                                <Search className="w-3.5 h-3.5 text-muted-foreground" />
                              </SelectTrigger>
                              <SelectContent className="max-h-60">
                                <SelectItem value="_new">-- Create Brand New --</SelectItem>
                                {medicines.map((m) => (
                                  <SelectItem key={m.id} value={m.id}>
                                    {m.name} ({m.strength || m.dosage_form || 'Med'})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Input
                            placeholder="Generic Name (e.g. Amoxicillin)"
                            value={item.genericName || ''}
                            onChange={e => handleItemChange(idx, 'genericName', e.target.value)}
                            className="text-xs h-7 text-muted-foreground"
                          />
                        </div>

                        {/* Category & Form */}
                        <div className="col-span-2 space-y-1.5">
                          <Select
                            value={item.category}
                            onValueChange={val => handleItemChange(idx, 'category', val)}
                          >
                            <SelectTrigger className="text-xs h-8">
                              <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Antibiotic">Antibiotic</SelectItem>
                              <SelectItem value="Analgesic">Analgesic / Pain</SelectItem>
                              <SelectItem value="Antacid">Antacid / GI</SelectItem>
                              <SelectItem value="Antihypertensive">Antihypertensive</SelectItem>
                              <SelectItem value="Antidiabetic">Antidiabetic</SelectItem>
                              <SelectItem value="Antihistamine">Antihistamine</SelectItem>
                              <SelectItem value="Vitamins">Vitamins / Supplement</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="flex gap-1">
                            <Input
                              placeholder="Strength (e.g. 500mg)"
                              value={item.strength || ''}
                              onChange={e => handleItemChange(idx, 'strength', e.target.value)}
                              className="text-xs h-7 w-1/2"
                            />
                            <Input
                              placeholder="Barcode"
                              value={item.barcode || ''}
                              onChange={e => handleItemChange(idx, 'barcode', e.target.value)}
                              className="text-xs h-7 w-1/2"
                            />
                          </div>
                        </div>

                        {/* Batch Number */}
                        <div className="col-span-1">
                          <Input
                            placeholder="Batch *"
                            value={item.batchNumber}
                            onChange={e => handleItemChange(idx, 'batchNumber', e.target.value)}
                            className="text-xs font-mono h-8"
                            required
                          />
                        </div>

                        {/* Mfg & Expiry Dates */}
                        <div className="col-span-2 space-y-1">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-muted-foreground w-8">Exp *:</span>
                            <Input
                              type="date"
                              value={item.expiryDate}
                              onChange={e => handleItemChange(idx, 'expiryDate', e.target.value)}
                              className="text-xs h-8"
                              required
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-muted-foreground w-8">Mfg:</span>
                            <Input
                              type="date"
                              value={item.manufacturingDate || ''}
                              onChange={e => handleItemChange(idx, 'manufacturingDate', e.target.value)}
                              className="text-xs h-7 text-muted-foreground"
                            />
                          </div>
                        </div>

                        {/* Quantity */}
                        <div className="col-span-1">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={e => handleItemChange(idx, 'quantity', Number(e.target.value))}
                            className="text-xs text-right font-medium h-8"
                            required
                          />
                        </div>

                        {/* Cost Price */}
                        <div className="col-span-1">
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            value={item.purchasePrice}
                            onChange={e => handleItemChange(idx, 'purchasePrice', Number(e.target.value))}
                            className="text-xs text-right font-mono h-8"
                            required
                          />
                          <div className="text-[10px] text-right text-muted-foreground mt-0.5">
                            Sub: {rowSub.toLocaleString()} ETB
                          </div>
                        </div>

                        {/* Selling Price */}
                        <div className="col-span-1">
                          <Input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={item.sellingPrice}
                            onChange={e => handleItemChange(idx, 'sellingPrice', Number(e.target.value))}
                            className="text-xs text-right font-mono font-semibold h-8 text-primary"
                            required
                          />
                          <div className="text-[10px] text-right text-muted-foreground mt-0.5">
                            Margin: {(item.sellingPrice - item.purchasePrice).toFixed(1)} ETB
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="col-span-1 flex justify-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveRow(idx)}
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={items.length === 1}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Live Calculation Summary & Action */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Calculations Box */}
              <Card className="lg:col-span-2 bg-muted/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    Invoice Financial Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-3 bg-background rounded-lg border">
                    <div className="text-xs text-muted-foreground">Total Inbound Units</div>
                    <div className="text-xl font-bold mt-1 text-foreground">
                      {calculatedTotals.totalQuantity.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-3 bg-background rounded-lg border">
                    <div className="text-xs text-muted-foreground">Invoice Subtotal</div>
                    <div className="text-xl font-bold mt-1 font-mono text-foreground">
                      {calculatedTotals.subtotal.toLocaleString()} ETB
                    </div>
                  </div>
                  <div className="p-3 bg-background rounded-lg border">
                    <div className="text-xs text-muted-foreground">Invoice Grand Total</div>
                    <div className="text-xl font-bold mt-1 font-mono text-emerald-600">
                      {calculatedTotals.grandTotal.toLocaleString()} ETB
                    </div>
                  </div>
                  <div className="p-3 bg-background rounded-lg border">
                    <div className="text-xs text-muted-foreground">Retail Inventory Value</div>
                    <div className="text-xl font-bold mt-1 font-mono text-primary">
                      {calculatedTotals.inventoryValue.toLocaleString()} ETB
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Submit CTA */}
              <Card className="flex flex-col justify-between">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Ready to Process?</CardTitle>
                  <CardDescription>
                    Inventory will be increased immediately and a STOCK_IN movement will be logged.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-2">
                  <Button
                    type="submit"
                    className="w-full h-11 text-base font-semibold"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      'Processing Receive...'
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5 mr-2" />
                        Receive & Update Stock
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </form>
        </TabsContent>

        {/* Tab 2: Past Invoices History */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Purchase Invoices History</CardTitle>
                <CardDescription>All supplier shipments received into pharmacy inventory</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetchInvoices()}>
                Refresh
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {pastInvoices.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No supplier invoices recorded yet. Use the "Receive Invoice" tab to receive stock.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-muted/50 border-b">
                      <tr>
                        <th className="px-4 py-3">Invoice #</th>
                        <th className="px-4 py-3">Supplier</th>
                        <th className="px-4 py-3">Received Date</th>
                        <th className="px-4 py-3">Warehouse</th>
                        <th className="px-4 py-3 text-right">Items / Qty</th>
                        <th className="px-4 py-3 text-right">Grand Total</th>
                        <th className="px-4 py-3">Received By</th>
                        <th className="px-4 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {pastInvoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-semibold font-mono">{inv.invoiceNumber}</td>
                          <td className="px-4 py-3">{inv.supplier}</td>
                          <td className="px-4 py-3">{formatDateEAT(inv.deliveryDate)}</td>
                          <td className="px-4 py-3">{inv.warehouseLocation}</td>
                          <td className="px-4 py-3 text-right">
                            {inv.items?.length || 0} items ({inv.totalQuantity} units)
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-600">
                            {Number(inv.grandTotal).toLocaleString()} ETB
                          </td>
                          <td className="px-4 py-3">{inv.receivedBy}</td>
                          <td className="px-4 py-3 text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCompletedInvoice(inv)}
                              className="h-7 text-xs"
                            >
                              <Printer className="w-3.5 h-3.5 mr-1" />
                              View GRN
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Goods Received Note (GRN) Receipt Modal */}
      {completedInvoice && (
        <Dialog open={!!completedInvoice} onOpenChange={() => setCompletedInvoice(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Goods Received Note (GRN)
              </DialogTitle>
            </DialogHeader>

            <div id="grn-printable" className="space-y-4 p-4 border rounded-lg bg-card text-xs">
              <div className="border-b pb-3 flex justify-between items-start">
                <div>
                  <div className="text-lg font-bold text-primary">EthioCare Hospital Pharmacy</div>
                  <div className="text-muted-foreground">Inbound Goods Receiving Report</div>
                </div>
                <div className="text-right font-mono">
                  <div className="font-bold text-sm">GRN #{completedInvoice.invoiceNumber}</div>
                  <div className="text-muted-foreground">
                    Date: {formatDateEAT(completedInvoice.deliveryDate || completedInvoice.createdAt)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-semibold text-muted-foreground">Supplier: </span>
                  <span className="font-medium text-foreground">{completedInvoice.supplier}</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">Storage Location: </span>
                  <span className="font-medium text-foreground">{completedInvoice.warehouseLocation}</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">PO Number: </span>
                  <span className="font-medium text-foreground">{completedInvoice.poNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">Received By: </span>
                  <span className="font-medium text-foreground">{completedInvoice.receivedBy}</span>
                </div>
              </div>

              {/* Items list */}
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-muted font-semibold">
                    <tr>
                      <th className="p-2">Item</th>
                      <th className="p-2">Batch</th>
                      <th className="p-2">Expiry</th>
                      <th className="p-2 text-right">Qty</th>
                      <th className="p-2 text-right">Cost Price</th>
                      <th className="p-2 text-right">Retail Price</th>
                      <th className="p-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {completedInvoice.items?.map((it, i) => (
                      <tr key={i}>
                        <td className="p-2 font-medium">{it.name}</td>
                        <td className="p-2 font-mono">{it.batchNumber}</td>
                        <td className="p-2">{formatDateEAT(it.expiryDate)}</td>
                        <td className="p-2 text-right font-medium">{it.quantity}</td>
                        <td className="p-2 text-right font-mono">{Number(it.purchasePrice).toFixed(2)} ETB</td>
                        <td className="p-2 text-right font-mono">{Number(it.sellingPrice).toFixed(2)} ETB</td>
                        <td className="p-2 text-right font-mono font-medium">
                          {(Number(it.quantity) * Number(it.purchasePrice)).toFixed(2)} ETB
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="flex justify-end pt-2">
                <div className="w-64 space-y-1.5 font-mono">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Inbound Units:</span>
                    <span>{completedInvoice.totalQuantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Invoice Cost Total:</span>
                    <span className="font-bold text-emerald-600">
                      {Number(completedInvoice.grandTotal).toLocaleString()} ETB
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Retail Value:</span>
                    <span className="font-bold text-primary">
                      {Number(completedInvoice.inventoryValue).toLocaleString()} ETB
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="flex justify-between sm:justify-between">
              <Button variant="outline" onClick={() => setCompletedInvoice(null)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  window.print();
                }}
                className="flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                Print GRN
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
