import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { salesReturnService } from '@/services/salesReturn.service';
import { formatDateEAT, formatDateTimeEAT } from '@/lib/dateUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  RotateCcw,
  Search,
  CheckCircle2,
  Printer,
  History,
  DollarSign,
  Receipt
} from 'lucide-react';
import { toast } from 'sonner';

export default function SalesReturns() {
  const { user, role } = useAuth();

  // Search state
  const [receiptQuery, setReceiptQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [matchedSale, setMatchedSale] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnNotes, setReturnNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Credit Note Modal State
  const [completedReturn, setCompletedReturn] = useState(null);

  // Past Returns History Tab
  const [pastReturns, setPastReturns] = useState([]);
  const [isLoadingPastReturns, setIsLoadingPastReturns] = useState(false);

  const loadPastReturns = async () => {
    setIsLoadingPastReturns(true);
    try {
      const data = await salesReturnService.getReturns();
      setPastReturns(data);
    } catch {
      // ignore
    } finally {
      setIsLoadingPastReturns(false);
    }
  };

  useEffect(() => {
    loadPastReturns();
  }, []);

  // Search sale handler
  const handleSearchSale = async (e) => {
    e.preventDefault();
    if (!receiptQuery.trim()) {
      toast.error('Please enter a receipt number or sale ID.');
      return;
    }

    setIsSearching(true);
    try {
      const result = await salesReturnService.findSaleForReturn(receiptQuery);
      if (result.error || !result.sale) {
        toast.error(result.error || 'Sale not found.');
        setMatchedSale(null);
        setReturnItems([]);
      } else {
        setMatchedSale(result.sale);
        setReturnItems(result.itemsWithReturnHistory);
        toast.success(`Found sale ${result.sale.receiptNumber}`);
      }
    } catch (err) {
      toast.error('Error finding sale');
    } finally {
      setIsSearching(false);
    }
  };

  // Adjust return item quantity
  const handleItemQtyChange = (idx, qty) => {
    setReturnItems(prev => {
      const updated = [...prev];
      const maxReturnable = updated[idx].soldQuantity - updated[idx].previouslyReturnedQuantity;
      const safeQty = Math.max(0, Math.min(qty, maxReturnable));
      updated[idx] = {
        ...updated[idx],
        returnQuantity: safeQty,
        refundAmount: safeQty * updated[idx].unitPrice
      };
      return updated;
    });
  };

  // Toggle restockable
  const handleToggleRestockable = (idx, checked) => {
    setReturnItems(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], restockable: checked };
      return updated;
    });
  };

  // Change return reason
  const handleReasonChange = (idx, reason) => {
    setReturnItems(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], reason };
      return updated;
    });
  };

  // Total refund calculation
  const totalRefund = useMemo(() => {
    return returnItems.reduce((sum, it) => sum + (it.returnQuantity * it.unitPrice), 0);
  }, [returnItems]);

  const activeReturnCount = useMemo(() => {
    return returnItems.filter(it => it.returnQuantity > 0).length;
  }, [returnItems]);

  // Submit return
  const handleProcessReturn = async () => {
    if (!matchedSale) return;

    const validation = salesReturnService.validateReturn({
      sale: matchedSale,
      items: returnItems
    });

    if (!validation.valid) {
      toast.error(validation.errors[0]);
      return;
    }

    setIsProcessing(true);
    try {
      const ret = await salesReturnService.processReturn({
        sale: matchedSale,
        items: returnItems,
        processedBy: user?.full_name || 'Pharmacist',
        processedByRole: role || 'pharmacist',
        notes: returnNotes
      });

      toast.success(`Return #${ret.returnNumber} processed successfully!`);
      setCompletedReturn(ret);
      setMatchedSale(null);
      setReturnItems([]);
      setReceiptQuery('');
      setReturnNotes('');
      loadPastReturns();
    } catch (err) {
      console.error('[SalesReturns] Return error:', err);
      toast.error(err.message || 'Failed to process return');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-primary" />
            Pharmacy Sales Returns & Refunds
          </h1>
          <p className="text-sm text-muted-foreground">
            Search customer receipts, verify returnable quantities, inspect restockable condition, and issue refunds.
          </p>
        </div>
      </div>

      <Tabs defaultValue="return" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="return" className="flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            Process Return
          </TabsTrigger>
          <TabsTrigger value="archive" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Returns Archive ({pastReturns.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Process Return */}
        <TabsContent value="return" className="space-y-6 mt-4">
          {/* Lookup Card */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">1. Search Eligible Sale Receipt</CardTitle>
              <CardDescription>
                Enter the receipt number from the customer's cash receipt (e.g. RCP-WK-20260917-4821)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearchSale} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Enter Receipt Number (RCP-WK-...) or Sale ID (WKS-...)"
                    value={receiptQuery}
                    onChange={e => setReceiptQuery(e.target.value)}
                    className="pl-9 font-mono text-xs uppercase h-10"
                    required
                  />
                </div>
                <Button type="submit" disabled={isSearching} className="h-10 px-5">
                  {isSearching ? 'Searching...' : 'Find Receipt'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Matched Sale Details & Return Form */}
          {matchedSale && (
            <div className="space-y-6">
              {/* Sale Info Summary Banner */}
              <Card className="bg-muted/40 border-primary/20">
                <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground block">Customer:</span>
                    <span className="font-semibold text-foreground text-sm">{matchedSale.customerName}</span>
                    {matchedSale.customerPhone && (
                      <span className="text-muted-foreground block">{matchedSale.customerPhone}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Sale Date:</span>
                    <span className="font-semibold text-foreground">{formatDateTimeEAT(matchedSale.createdAt)}</span>
                    <span className="text-muted-foreground block">Cashier: {matchedSale.cashierName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Original Total:</span>
                    <span className="font-bold text-foreground font-mono text-sm">
                      {Number(matchedSale.total).toLocaleString()} ETB
                    </span>
                    <Badge variant="secondary" className="mt-0.5 text-[10px] capitalize">
                      {matchedSale.paymentMethod?.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Receipt Reference:</span>
                    <span className="font-mono font-semibold text-primary">{matchedSale.receiptNumber}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Returnable Items Selection Table */}
              <Card>
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-base font-semibold">2. Select Items to Return</CardTitle>
                  <CardDescription>
                    Specify quantity to return, condition, restock eligibility, and reason for return
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/60 uppercase font-semibold text-muted-foreground border-b">
                      <tr>
                        <th className="p-3">Medicine & Batch</th>
                        <th className="p-3 text-center">Return Qty</th>
                        <th className="p-3 text-right">Refund Amount</th>
                        <th className="p-3">Reason & Restock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {returnItems.map((item, idx) => {
                        const maxReturnable = item.soldQuantity - item.previouslyReturnedQuantity;
                        const isFullyReturned = maxReturnable <= 0;
                        return (
                          <tr
                            key={idx}
                            className={`hover:bg-muted/30 ${isFullyReturned ? 'opacity-40 bg-muted/20' : ''}`}
                          >
                            <td className="p-3 font-medium">
                              <div className="text-foreground font-semibold">{item.name}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {item.batchNumber ? `Batch: ${item.batchNumber}` : ''}
                                {item.expiryDate ? ` · Exp: ${item.expiryDate}` : ''}
                              </div>
                              <div className="text-[10px] mt-0.5">
                                <span className="text-muted-foreground">{item.soldQuantity} sold</span>
                                {item.previouslyReturnedQuantity > 0 && (
                                  <span className="text-destructive ml-1">
                                    ({item.previouslyReturnedQuantity} ret.)
                                  </span>
                                )}
                                <span className="text-emerald-600 font-medium ml-1">
                                  (Max: {maxReturnable})
                                </span>
                              </div>
                            </td>

                            <td className="p-3 text-center">
                              <Input
                                type="number"
                                min="0"
                                max={maxReturnable}
                                disabled={isFullyReturned}
                                value={item.returnQuantity}
                                onChange={e => handleItemQtyChange(idx, Number(e.target.value))}
                                className="h-8 w-20 text-center font-semibold mx-auto"
                              />
                            </td>

                            <td className="p-3 text-right font-mono">
                              <div className="font-bold text-primary">
                                {(item.returnQuantity * item.unitPrice).toLocaleString()} ETB
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                @ {item.unitPrice.toLocaleString()} ETB
                              </div>
                            </td>

                            <td className="p-3">
                              <div className="flex flex-col gap-1.5 min-w-[140px]">
                                <Select
                                  disabled={item.returnQuantity === 0}
                                  value={item.reason}
                                  onValueChange={val => handleReasonChange(idx, val)}
                                >
                                  <SelectTrigger className="h-7 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="customer_mistake">Wrong Medicine</SelectItem>
                                    <SelectItem value="prescriber_change">Prescription Changed</SelectItem>
                                    <SelectItem value="defective">Defective / Damaged</SelectItem>
                                    <SelectItem value="expired">Near Expiry / Expired</SelectItem>
                                    <SelectItem value="adverse_reaction">Adverse Reaction</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                                <div className="flex items-center gap-1.5">
                                  <Switch
                                    disabled={item.returnQuantity === 0}
                                    checked={item.restockable}
                                    onCheckedChange={checked => handleToggleRestockable(idx, checked)}
                                  />
                                  <span className="text-[10px] text-muted-foreground">
                                    {item.restockable ? 'Restock' : 'Quarantine'}
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Financial & Authorization Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Return Remarks / Audit Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Input
                      placeholder="e.g. Unopened blister pack verified, returned within 24h, approved by head pharmacist"
                      value={returnNotes}
                      onChange={e => setReturnNotes(e.target.value)}
                      className="text-xs h-10"
                    />
                  </CardContent>
                </Card>

                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center justify-between">
                      <span>Total Refund Amount</span>
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-3xl font-bold font-mono text-emerald-600 text-center py-1">
                      {totalRefund.toLocaleString()} ETB
                    </div>
                    <p className="text-[11px] text-muted-foreground text-center">
                      Refund mode: Original Payment Method ({matchedSale.paymentMethod?.replace(/_/g, ' ')})
                    </p>
                    <Button
                      onClick={handleProcessReturn}
                      disabled={activeReturnCount === 0 || isProcessing}
                      className="w-full h-11 text-sm font-semibold"
                    >
                      {isProcessing ? (
                        'Processing Return...'
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Issue Refund ({totalRefund.toLocaleString()} ETB)
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Returns Archive */}
        <TabsContent value="archive" className="mt-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Processed Returns Archive</CardTitle>
                <CardDescription>History of processed refunds and restocked medications</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={loadPastReturns}>
                Refresh
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {pastReturns.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground text-sm">
                  No return transactions processed yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 border-b uppercase font-semibold text-muted-foreground">
                      <tr>
                        <th className="p-3">Return # & Date</th>
                        <th className="p-3">Receipt & Customer</th>
                        <th className="p-3 text-right">Refund & Items</th>
                        <th className="p-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {pastReturns.map(ret => (
                        <tr key={ret.id} className="hover:bg-muted/30">
                          <td className="p-3">
                            <div className="font-mono font-semibold text-foreground">{ret.returnNumber}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {formatDateEAT(ret.createdAt)} • By {ret.processedBy}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="font-mono text-primary font-medium">{ret.receiptNumber}</div>
                            <div className="text-foreground">{ret.customerName}</div>
                          </td>
                          <td className="p-3 text-right">
                            <div className="font-mono font-bold text-emerald-600">
                              {Number(ret.refundAmount).toLocaleString()} ETB
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate max-w-[200px] ml-auto" title={ret.items?.map(it => `${it.name} (x${it.returnQuantity})`).join(', ')}>
                              {ret.items?.map(it => `${it.name} (x${it.returnQuantity})`).join(', ')}
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCompletedReturn(ret)}
                              className="h-7 text-xs"
                            >
                              <Printer className="w-3.5 h-3.5 mr-1" />
                              Voucher
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

      {/* Credit Note Voucher Modal */}
      {completedReturn && (
        <Dialog open={!!completedReturn} onOpenChange={() => setCompletedReturn(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Sales Return Credit Voucher
              </DialogTitle>
            </DialogHeader>

            <div className="p-4 border rounded-lg bg-card space-y-3 text-xs">
              <div className="text-center border-b pb-2">
                <div className="font-bold text-base text-primary">EthioCare Hospital Pharmacy</div>
                <div className="text-muted-foreground text-[11px]">Return Credit Voucher & Cash Refund Receipt</div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-muted-foreground">Voucher #: </span>
                  <span className="font-semibold font-mono">{completedReturn.returnNumber}</span>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground">Date: </span>
                  <span>{formatDateEAT(completedReturn.createdAt)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Original Receipt: </span>
                  <span className="font-mono">{completedReturn.receiptNumber}</span>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground">Customer: </span>
                  <span className="font-medium">{completedReturn.customerName}</span>
                </div>
              </div>

              {/* Items */}
              <div className="border rounded divide-y">
                {completedReturn.items?.map((it, idx) => (
                  <div key={idx} className="p-2 flex justify-between text-xs">
                    <div>
                      <div className="font-medium">{it.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {it.returnQuantity} returned @ {it.unitPrice} ETB ({it.reason})
                      </div>
                    </div>
                    <div className="font-mono font-bold text-primary">
                      {(it.returnQuantity * it.unitPrice).toLocaleString()} ETB
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-2 font-bold text-sm border-t">
                <span>Total Cash Refunded:</span>
                <span className="font-mono text-emerald-600">
                  {Number(completedReturn.refundAmount).toLocaleString()} ETB
                </span>
              </div>

              <div className="text-[10px] text-muted-foreground text-center pt-2 italic">
                Approved by {completedReturn.processedBy} · Goods received into pharmacy inventory
              </div>
            </div>

            <DialogFooter className="flex justify-between sm:justify-between">
              <Button variant="outline" onClick={() => setCompletedReturn(null)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  window.print();
                }}
                className="flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                Print Voucher
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
