import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ethioCareClient } from '@/api/ethioCareClient';
import { useAuth } from '@/lib/AuthContext';
import { pharmacySaleService } from '@/services/pharmacySale.service';
import { pharmacySettingsService, DEFAULT_PHARMACY_SETTINGS } from '@/services/pharmacySettings.service';
import PharmacyReceiptModal from '@/components/pharmacy/PharmacyReceiptModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  DollarSign,
  CheckCircle2,
  Receipt,
  ScanBarcode,
  History,
  Pill,
  User,
  Settings,
  ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';

export default function WalkInSales() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const searchInputRef = useRef(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Cart state
  const [cart, setCart] = useState([]);

  // Customer Profile State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCategory, setCustomerCategory] = useState('Adult');
  const [customerGender, setCustomerGender] = useState('Male');
  const [customerAge, setCustomerAge] = useState('');
  const [customerWeight, setCustomerWeight] = useState('');
  const [prescriptionNumber, setPrescriptionNumber] = useState('');
  const [saleNotes, setSaleNotes] = useState('');

  // Payment State
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Completed Receipt Modal State
  const [completedSale, setCompletedSale] = useState(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Settings State
  const [settings, setSettings] = useState(DEFAULT_PHARMACY_SETTINGS);

  // Fetch Settings
  useEffect(() => {
    pharmacySettingsService.getSettings().then(setSettings);
  }, []);

  // Fetch live medicines catalog
  const { data: medicines = [], isLoading: isLoadingMeds } = useQuery({
    queryKey: ['medicines'],
    queryFn: () => ethioCareClient.entities.Medicine.list('name', 300)
  });

  // Filtered search results for top search bar
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return medicines
      .filter((m) => {
        const matchName = m.name?.toLowerCase().includes(q);
        const matchGeneric = m.generic_name?.toLowerCase().includes(q);
        const matchBarcode = m.barcode?.includes(q);
        return matchName || matchGeneric || matchBarcode;
      })
      .slice(0, 10);
  }, [medicines, searchQuery]);

  // Check if any cart item requires prescription
  const hasRxItem = useMemo(() => {
    return cart.some(item => {
      const med = medicines.find(m => m.id === item.medicineId);
      return med?.prescription_required === true;
    });
  }, [cart, medicines]);

  // Cart Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, it) => sum + (it.unitPrice * it.quantity), 0);
  }, [cart]);

  const numDiscount = Math.max(0, Math.min(subtotal, Number(discount) || 0));
  const grandTotal = Math.max(0, subtotal - numDiscount);

  const numAmountPaid = paymentMethod === 'cash' 
    ? (amountPaid === '' ? grandTotal : Number(amountPaid) || 0) 
    : grandTotal;
  const change = paymentMethod === 'cash' ? Math.max(0, numAmountPaid - grandTotal) : 0;

  // Add medicine to cart
  const handleAddToCart = (med) => {
    const existingIndex = cart.findIndex(it => it.medicineId === med.id);
    const availableQty = med.quantity || 0;

    if (availableQty <= 0) {
      toast.error(`"${med.name}" is out of stock!`);
      return;
    }

    if (existingIndex >= 0) {
      const currentQty = cart[existingIndex].quantity;
      if (currentQty + 1 > availableQty) {
        toast.error(`Cannot add more: only ${availableQty} units available in stock.`);
        return;
      }
      setCart(prev => {
        const updated = [...prev];
        const newQty = currentQty + 1;
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQty,
          subtotal: newQty * updated[existingIndex].unitPrice
        };
        return updated;
      });
    } else {
      const newItem = {
        medicineId: med.id,
        name: med.name,
        genericName: med.generic_name || '',
        strength: med.strength || '',
        dosageForm: med.dosage_form || '',
        batchNumber: med.batch_number || '',
        expiryDate: med.expiry_date || null,
        unitPrice: Number(med.unit_price || 0),
        quantity: 1,
        subtotal: Number(med.unit_price || 0),
        dosageInstructions: ''
      };
      setCart(prev => [...prev, newItem]);
    }

    setSearchQuery('');
    setShowSearchResults(false);
    toast.success(`Added ${med.name} to cart`);
  };

  // Adjust quantity
  const handleUpdateQty = (index, delta) => {
    const item = cart[index];
    const med = medicines.find(m => m.id === item.medicineId);
    const available = med?.quantity || 999;
    const newQty = item.quantity + delta;

    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }

    if (newQty > available) {
      toast.error(`Only ${available} units available in stock.`);
      return;
    }

    setCart(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        quantity: newQty,
        subtotal: newQty * updated[index].unitPrice
      };
      return updated;
    });
  };

  // Direct quantity input change
  const handleQuantityInput = (index, val) => {
    const item = cart[index];
    const med = medicines.find(m => m.id === item.medicineId);
    const available = med?.quantity || 999;

    if (val <= 0) return;
    const safeQty = Math.min(val, available);

    setCart(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        quantity: safeQty,
        subtotal: safeQty * updated[index].unitPrice
      };
      return updated;
    });
  };

  // Update dosage instructions
  const handleDosageChange = (index, text) => {
    setCart(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], dosageInstructions: text };
      return updated;
    });
  };

  // Remove item
  const handleRemoveItem = (index) => {
    setCart(prev => prev.filter((_, idx) => idx !== index));
  };

  // Clear Cart
  const handleClearCart = () => {
    setCart([]);
    setDiscount(0);
    setAmountPaid('');
  };

  // Checkout submission
  const handleCheckout = async (e) => {
    e.preventDefault();

    // 1. Check if retail sales enabled
    if (!settings.enable_retail_sales) {
      toast.error('Retail sales are currently locked by pharmacy management.');
      return;
    }

    // 2. Validate items
    const itemValidation = pharmacySaleService.validateItems(cart, medicines);
    if (!itemValidation.valid) {
      toast.error(itemValidation.error || 'Cart items validation failed.');
      return;
    }

    // 3. Validate checkout rules from settings
    const ruleValidation = pharmacySettingsService.validateCheckoutRules({
      settings,
      customer: {
        name: customerName,
        phone: customerPhone,
        type: customerCategory,
        age: customerAge,
        weight: customerWeight,
        prescriptionNumber
      },
      items: cart,
      medicinesCatalog: medicines
    });

    if (!ruleValidation.valid) {
      toast.error(ruleValidation.errors[0]);
      return;
    }

    // 4. Validate cash amount
    if (paymentMethod === 'cash' && numAmountPaid < grandTotal) {
      toast.error(`Amount paid (${numAmountPaid} ETB) is less than total due (${grandTotal} ETB).`);
      return;
    }

    setIsProcessing(true);
    try {
      const sale = await pharmacySaleService.processSale({
        customerName,
        customerPhone,
        customerCategory,
        customerGender,
        customerAge: customerAge ? Number(customerAge) : undefined,
        customerWeight: customerWeight ? Number(customerWeight) : undefined,
        prescriptionNumber,
        items: cart,
        discount: numDiscount,
        paymentMethod,
        amountPaid: numAmountPaid,
        cashierName: user?.full_name || 'Pharmacist',
        cashierRole: role || 'pharmacist',
        notes: saleNotes
      });

      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      queryClient.invalidateQueries({ queryKey: ['inventory_movements'] });

      setCompletedSale(sale);
      setIsReceiptOpen(true);
      handleClearCart();
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAge('');
      setCustomerWeight('');
      setPrescriptionNumber('');
      setSaleNotes('');

      toast.success(`Sale completed! Receipt #${sale.receiptNumber}`);
    } catch (err) {
      console.error('[WalkInSales] Checkout error:', err);
      toast.error(err.message || 'Checkout failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto pb-10">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-primary" />
            Walk-In Customer Pharmacy POS
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Direct retail sales point. Automatically applies Owner pricing, decreases inventory, and logs WALK_IN_SALE movements.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/pharmacy/sales-history" className="flex items-center gap-1.5 text-xs">
              <History className="w-3.5 h-3.5" />
              Sales History
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/pharmacy/returns" className="flex items-center gap-1.5 text-xs">
              <Receipt className="w-3.5 h-3.5" />
              Returns & Refunds
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/pharmacy/settings" className="flex items-center gap-1.5 text-xs">
              <Settings className="w-3.5 h-3.5" />
              POS Settings
            </Link>
          </Button>
        </div>
      </div>

      {/* Retail Sales Disabled Warning Banner */}
      {!settings.enable_retail_sales && (
        <div className="p-3 bg-destructive/15 border border-destructive/30 rounded-lg flex items-center justify-between text-destructive text-sm font-medium">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <span>
              Retail sales are currently <strong>DISABLED</strong> in Pharmacy Settings. You cannot process walk-in checkouts until re-enabled.
            </span>
          </div>
          <Button size="sm" variant="outline" asChild className="border-destructive/40 text-destructive text-xs">
            <Link to="/pharmacy/settings">Change Setting</Link>
          </Button>
        </div>
      )}

      {/* 1. TOP FULL-WIDTH SEARCH BAR (medicine, generic, barcode, scanner) */}
      <div className="relative w-full">
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search medicine by Brand Name, Generic, SKU, or Barcode (e.g. Paracetamol, Amoxicillin, 123456)..."
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setShowSearchResults(true);
            }}
            onFocus={() => setShowSearchResults(true)}
            className="pl-11 pr-24 h-12 text-sm sm:text-base rounded-xl border-2 border-primary/20 focus:border-primary shadow-sm"
          />
          <div className="absolute right-2 flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                searchInputRef.current?.focus();
                toast.info('Barcode scanner active. Scan barcode to add.');
              }}
              className="h-8 px-2 text-xs flex items-center gap-1 text-muted-foreground hover:text-primary"
            >
              <ScanBarcode className="w-4 h-4" />
              <span className="hidden sm:inline">Scanner</span>
            </Button>
          </div>
        </div>

        {/* Live Search Autocomplete Dropdown */}
        {showSearchResults && searchQuery.trim().length > 0 && (
          <div className="absolute z-50 left-0 right-0 mt-1 bg-background border rounded-xl shadow-2xl overflow-hidden max-h-96 overflow-y-auto">
            <div className="p-2 bg-muted/40 text-xs font-semibold text-muted-foreground flex justify-between items-center border-b">
              <span>Matching Medicines ({searchResults.length})</span>
              <button
                type="button"
                onClick={() => setShowSearchResults(false)}
                className="text-xs hover:underline text-muted-foreground"
              >
                Close
              </button>
            </div>
            {searchResults.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No medicines found matching "{searchQuery}".
              </div>
            ) : (
              <div className="divide-y">
                {searchResults.map((med) => {
                  const isOutOfStock = (med.quantity || 0) <= 0;
                  const isLow = !isOutOfStock && (med.quantity || 0) <= (med.min_stock || 10);
                  return (
                    <div
                      key={med.id}
                      onClick={() => !isOutOfStock && handleAddToCart(med)}
                      className={`p-3 flex items-center justify-between hover:bg-muted/40 cursor-pointer transition-colors ${
                        isOutOfStock ? 'opacity-50 cursor-not-allowed bg-destructive/5' : ''
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-foreground">{med.name}</span>
                          {med.prescription_required && (
                            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                              Rx Required
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-[10px]">
                            {med.category || 'General'}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span>{med.generic_name || 'Generic'}</span>
                          {med.strength && <span>· {med.strength}</span>}
                          {med.batch_number && <span>· Batch: {med.batch_number}</span>}
                          {med.expiry_date && <span>· Exp: {med.expiry_date}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <div className="font-mono font-bold text-sm text-primary">
                            {Number(med.unit_price || 0).toLocaleString()} ETB
                          </div>
                          <div className="text-xs">
                            {isOutOfStock ? (
                              <span className="text-destructive font-medium">Out of Stock</span>
                            ) : (
                              <span className={isLow ? 'text-amber-600 font-medium' : 'text-emerald-600 font-medium'}>
                                {med.quantity} in stock
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          disabled={isOutOfStock}
                          className="h-8 text-xs font-semibold"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          Add
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. ONE-ROW DESKTOP LAYOUT (65-70% Cart | 30-35% Customer & Checkout) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: POS Cart (approx 67% width) */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-primary" />
                  Cart Items ({cart.length})
                </CardTitle>
                <CardDescription>
                  Review items, adjust quantities, and enter patient dosage instructions
                </CardDescription>
              </div>
              {cart.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearCart}
                  className="text-xs text-destructive hover:bg-destructive/10 h-7"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Clear Cart
                </Button>
              )}
            </CardHeader>

            <CardContent className="p-0">
              {cart.length === 0 ? (
                <div className="py-12 px-4 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                    <Pill className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-foreground">POS Cart is Empty</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Use the search bar above or pick from quick-dispense medicines below.
                    </p>
                  </div>

                  {/* Quick Pick Pills */}
                  <div className="pt-2">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Popular Fast-Moving Medicines
                    </div>
                    <div className="flex flex-wrap justify-center gap-2 max-w-xl mx-auto">
                      {medicines
                        .filter(m => (m.quantity || 0) > 0)
                        .slice(0, 6)
                        .map(med => (
                          <Button
                            key={med.id}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddToCart(med)}
                            className="text-xs h-7 border-primary/20 hover:border-primary"
                          >
                            <Plus className="w-3 h-3 mr-1 text-primary" />
                            {med.name} ({Number(med.unit_price || 0)} ETB)
                          </Button>
                        ))}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Mobile Cart View (< md) */}
                  <div className="md:hidden divide-y divide-border/60">
                    {cart.map((item, idx) => (
                      <div key={idx} className="p-3.5 space-y-3 bg-card">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-sm text-foreground flex items-center gap-1.5 flex-wrap">
                              <span className="truncate">{item.name}</span>
                              {medicines.find(m => m.id === item.medicineId)?.prescription_required && (
                                <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-300 shrink-0">
                                  Rx
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                              Batch: {item.batchNumber || 'N/A'} · Exp: {item.expiryDate || 'N/A'}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(idx)}
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        {/* Dosage Instructions */}
                        <Input
                          placeholder={
                            settings.require_dosage_instructions
                              ? 'Dosage Instructions * (e.g. 1 tab tid po x 5d)'
                              : 'Dosage instructions (optional)...'
                          }
                          value={item.dosageInstructions || ''}
                          onChange={e => handleDosageChange(idx, e.target.value)}
                          className={`h-8 text-xs ${
                            settings.require_dosage_instructions && !item.dosageInstructions
                              ? 'border-amber-400 bg-amber-50/30'
                              : ''
                          }`}
                        />

                        {/* Quantity and Price summary */}
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 border border-border/50">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleUpdateQty(idx, -1)}
                              className="h-7 w-7 rounded-md"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </Button>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={e => handleQuantityInput(idx, Number(e.target.value))}
                              className="h-7 w-12 text-center text-xs font-semibold p-1 border-0 bg-transparent"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleUpdateQty(idx, 1)}
                              className="h-7 w-7 rounded-md"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </Button>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-muted-foreground block">{item.unitPrice.toLocaleString()} ETB each</span>
                            <span className="text-sm font-bold font-mono text-primary">{item.subtotal.toLocaleString()} ETB</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Cart View (>= md) */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50 border-b uppercase font-semibold text-muted-foreground">
                        <tr>
                          <th className="p-3">Medicine & Dosage Instructions</th>
                          <th className="p-3">Batch / Exp</th>
                          <th className="p-3 text-right">Price</th>
                          <th className="p-3 text-center w-28">Quantity</th>
                          <th className="p-3 text-right">Subtotal</th>
                          <th className="p-3 text-center w-12">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {cart.map((item, idx) => (
                          <tr key={idx} className="hover:bg-muted/20">
                            {/* Medicine & Dosage */}
                            <td className="p-3 space-y-1.5 min-w-[200px]">
                              <div className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                                {item.name}
                                {medicines.find(m => m.id === item.medicineId)?.prescription_required && (
                                  <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-300">
                                    Rx
                                  </Badge>
                                )}
                              </div>
                              <Input
                                placeholder={
                                  settings.require_dosage_instructions
                                    ? 'Dosage Instructions * (e.g. 1 tab tid po x 5d)'
                                    : 'Dosage instructions (optional)...'
                                }
                                value={item.dosageInstructions || ''}
                                onChange={e => handleDosageChange(idx, e.target.value)}
                                className={`h-7 text-xs ${
                                  settings.require_dosage_instructions && !item.dosageInstructions
                                    ? 'border-amber-400 bg-amber-50/30'
                                    : ''
                                }`}
                              />
                            </td>

                            {/* Batch & Expiry */}
                            <td className="p-3 font-mono text-[11px] whitespace-nowrap text-muted-foreground">
                              <div>{item.batchNumber || 'N/A'}</div>
                              <div>{item.expiryDate || 'N/A'}</div>
                            </td>

                            {/* Price */}
                            <td className="p-3 text-right font-mono font-medium whitespace-nowrap">
                              {item.unitPrice.toLocaleString()} ETB
                            </td>

                            {/* Quantity Controls */}
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleUpdateQty(idx, -1)}
                                  className="h-7 w-7"
                                >
                                  <Minus className="w-3 h-3" />
                                </Button>
                                <Input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={e => handleQuantityInput(idx, Number(e.target.value))}
                                  className="h-7 w-12 text-center text-xs font-semibold p-1"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleUpdateQty(idx, 1)}
                                  className="h-7 w-7"
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </div>
                            </td>

                            {/* Subtotal */}
                            <td className="p-3 text-right font-mono font-semibold text-primary whitespace-nowrap">
                              {item.subtotal.toLocaleString()} ETB
                            </td>

                            {/* Remove */}
                            <td className="p-3 text-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveItem(idx)}
                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Customer Info & Checkout (approx 33% width) */}
        <div className="lg:col-span-4 space-y-4">
          <form onSubmit={handleCheckout} className="space-y-4">
            {/* Customer Details Card */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  Customer Profile
                </CardTitle>
                <CardDescription className="text-xs">
                  Retail customer details (No hospital patient record created)
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-3 space-y-3">
                {/* Name */}
                <div className="space-y-1">
                  <Label htmlFor="cust-name" className="text-xs font-semibold flex items-center justify-between">
                    <span>
                      Customer Name {settings.require_customer_name && <span className="text-destructive">*</span>}
                    </span>
                    {!settings.require_customer_name && (
                      <span className="text-[10px] text-muted-foreground font-normal">Optional</span>
                    )}
                  </Label>
                  <Input
                    id="cust-name"
                    placeholder="e.g. Abebe Balcha"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="h-8 text-xs"
                    required={settings.require_customer_name}
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1">
                  <Label htmlFor="cust-phone" className="text-xs font-semibold flex items-center justify-between">
                    <span>
                      Phone Number {settings.require_customer_phone && <span className="text-destructive">*</span>}
                    </span>
                    {!settings.require_customer_phone && (
                      <span className="text-[10px] text-muted-foreground font-normal">Optional</span>
                    )}
                  </Label>
                  <Input
                    id="cust-phone"
                    placeholder="e.g. 0911234567"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    className="h-8 text-xs"
                    required={settings.require_customer_phone}
                  />
                </div>

                {/* Classification & Gender */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">
                      Classification {settings.require_customer_type && <span className="text-destructive">*</span>}
                    </Label>
                    <Select
                      value={customerCategory}
                      onValueChange={setCustomerCategory}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Adult">Adult</SelectItem>
                        <SelectItem value="Child">Child (Pediatric)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Gender</Label>
                    <Select
                      value={customerGender}
                      onValueChange={setCustomerGender}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Age & Weight */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="cust-age" className="text-xs font-semibold">
                      Age (Years) {settings.require_customer_age && <span className="text-destructive">*</span>}
                    </Label>
                    <Input
                      id="cust-age"
                      type="number"
                      min="0"
                      placeholder="e.g. 28"
                      value={customerAge}
                      onChange={e => setCustomerAge(e.target.value)}
                      className="h-8 text-xs"
                      required={settings.require_customer_age}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="cust-weight" className="text-xs font-semibold">
                      Weight (kg) {settings.require_customer_weight && <span className="text-destructive">*</span>}
                    </Label>
                    <Input
                      id="cust-weight"
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="e.g. 65"
                      value={customerWeight}
                      onChange={e => setCustomerWeight(e.target.value)}
                      className="h-8 text-xs"
                      required={settings.require_customer_weight}
                    />
                  </div>
                </div>

                {/* Prescription Number (Highlighted if cart has Rx items) */}
                <div className="space-y-1">
                  <Label htmlFor="cust-rx" className="text-xs font-semibold flex items-center justify-between">
                    <span className={hasRxItem ? 'text-amber-600 font-bold' : ''}>
                      Prescription Number {hasRxItem && <span className="text-destructive">*</span>}
                    </span>
                    {hasRxItem && (
                      <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                        Rx Item in Cart
                      </Badge>
                    )}
                  </Label>
                  <Input
                    id="cust-rx"
                    placeholder="e.g. RX-2026-9901"
                    value={prescriptionNumber}
                    onChange={e => setPrescriptionNumber(e.target.value)}
                    className={`h-8 text-xs ${hasRxItem && !prescriptionNumber ? 'border-amber-400 bg-amber-50/30' : ''}`}
                    required={hasRxItem || settings.require_prescription_number}
                  />
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <Label htmlFor="cust-notes" className="text-xs font-semibold text-muted-foreground">
                    Sale Remarks / Allergies
                  </Label>
                  <Input
                    id="cust-notes"
                    placeholder="e.g. Penicillin allergy noted"
                    value={saleNotes}
                    onChange={e => setSaleNotes(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Payment & Checkout Card */}
            <Card className="shadow-sm bg-card border-primary/20">
              <CardHeader className="pb-3 border-b bg-muted/20">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  Payment & Checkout
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3 space-y-3">
                {/* Subtotal & Discount */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal:</span>
                    <span className="font-mono font-medium text-foreground">{subtotal.toLocaleString()} ETB</span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="disc-input" className="text-xs text-muted-foreground">
                      Discount (ETB):
                    </Label>
                    <Input
                      id="disc-input"
                      type="number"
                      min="0"
                      max={subtotal}
                      value={discount}
                      onChange={e => setDiscount(Number(e.target.value))}
                      className="h-7 w-28 text-right font-mono text-xs"
                    />
                  </div>

                  <div className="flex justify-between text-base font-bold pt-2 border-t text-foreground">
                    <span>Grand Total:</span>
                    <span className="font-mono text-primary">{grandTotal.toLocaleString()} ETB</span>
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className="space-y-1 pt-1">
                  <Label className="text-xs font-semibold">Payment Method</Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={setPaymentMethod}
                  >
                    <SelectTrigger className="h-8 text-xs font-medium">
                      <SelectValue placeholder="Select Method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash (Local Birr)</SelectItem>
                      <SelectItem value="telebirr">Telebirr (Ethio Telecom)</SelectItem>
                      <SelectItem value="cbe_birr">CBE Birr (Commercial Bank)</SelectItem>
                      <SelectItem value="mobile_banking">Mobile Banking App</SelectItem>
                      <SelectItem value="card">Debit / Credit Card (POS Terminal)</SelectItem>
                      <SelectItem value="bank_transfer">Direct Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Cash Tendered & Change if Cash */}
                {paymentMethod === 'cash' && (
                  <div className="p-2.5 rounded-lg bg-muted/40 space-y-2 border">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="amt-paid" className="text-xs font-semibold">
                        Cash Tendered:
                      </Label>
                      <Input
                        id="amt-paid"
                        type="number"
                        min={grandTotal}
                        placeholder={grandTotal.toString()}
                        value={amountPaid}
                        onChange={e => setAmountPaid(e.target.value)}
                        className="h-7 w-28 text-right font-mono text-xs font-bold"
                      />
                    </div>
                    <div className="flex justify-between text-xs font-semibold text-emerald-600">
                      <span>Change to Return:</span>
                      <span className="font-mono">{change.toLocaleString()} ETB</span>
                    </div>
                  </div>
                )}

                {/* Action Button */}
                <Button
                  type="submit"
                  disabled={cart.length === 0 || isProcessing || !settings.enable_retail_sales}
                  className="w-full h-11 text-sm font-semibold shadow-md"
                >
                  {isProcessing ? (
                    'Processing Transaction...'
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Complete Sale ({grandTotal.toLocaleString()} ETB)
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </form>
        </div>
      </div>

      {/* Printable Receipt Modal */}
      <PharmacyReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => {
          setIsReceiptOpen(false);
          setCompletedSale(null);
        }}
        sale={completedSale}
      />
    </div>
  );
}
