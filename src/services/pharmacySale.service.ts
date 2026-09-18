import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { logAudit } from '@/lib/auditLogger';
import { notificationService } from '@/services/notification.service';
import { movementService } from '@/services/movement.service';
import { differenceInDays, format } from 'date-fns';

export interface WalkInSaleItem {
  medicineId: string;
  name: string;
  genericName?: string;
  strength?: string;
  dosageForm?: string;
  batchNumber?: string;
  expiryDate?: string | null;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  dosageInstructions?: string;
}

export interface WalkInSale {
  id: string;
  receiptNumber: string;
  customerName: string;
  customerPhone: string;
  customerType: 'Walk-In';
  customerCategory?: 'Adult' | 'Child';
  customerGender?: 'Male' | 'Female' | 'Other';
  customerAge?: number;
  customerWeight?: number;
  prescriptionNumber?: string;
  cashierName: string;
  cashierRole: string;
  items: WalkInSaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: 'cash' | 'mobile_banking' | 'card' | 'telebirr' | 'cbe_birr' | 'bank_transfer';
  amountPaid: number;
  change: number;
  paymentStatus: 'paid';
  createdAt: string;
  notes?: string;
}

const STORAGE_KEY = 'ethiocare_walkin_sales';

function getStoredSales(): WalkInSale[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredSales(sales: WalkInSale[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sales.slice(0, 200)));
  } catch {
    // ignore
  }
}

export const pharmacySaleService = {
  /**
   * Get all walk-in sales from local cache + Supabase payments
   */
  async getSales(): Promise<WalkInSale[]> {
    const localSales = getStoredSales();

    if (!isSupabaseConfigured()) {
      return localSales;
    }

    try {
      // Query payments that represent walk-in pharmacy sales
      const { data: payments, error } = await supabase
        .from('payments')
        .select('*')
        .eq('reference_type', 'walk_in_sale')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error || !payments) {
        return localSales;
      }

      // Convert payments to WalkInSale format if they have order_notes payload
      const remoteSales: WalkInSale[] = [];
      for (const p of payments) {
        if (p.order_notes) {
          try {
            const parsed = JSON.parse(p.order_notes);
            if (parsed && parsed.id) {
              remoteSales.push(parsed);
              continue;
            }
          } catch {
            // fallback below
          }
        }
        // Fallback reconstruction from payment row
        remoteSales.push({
          id: p.reference_id || p.id,
          receiptNumber: p.receipt_number || `RCP-${p.id.slice(0, 8).toUpperCase()}`,
          customerName: p.patient_name || 'Walk-In Customer',
          customerPhone: '',
          customerType: 'Walk-In',
          cashierName: p.cashier_name || 'Pharmacist',
          cashierRole: 'pharmacist',
          items: [{
            medicineId: '',
            name: p.medication_name || 'Pharmaceutical Dispense',
            unitPrice: p.amount || 0,
            quantity: p.quantity || 1,
            subtotal: p.amount || 0
          }],
          subtotal: p.amount || 0,
          discount: 0,
          total: p.amount || 0,
          paymentMethod: (p.payment_method as any) || 'cash',
          amountPaid: p.amount || 0,
          change: 0,
          paymentStatus: 'paid',
          createdAt: p.created_at || new Date().toISOString()
        });
      }

      // Merge and deduplicate by id
      const map = new Map<string, WalkInSale>();
      localSales.forEach(s => map.set(s.id, s));
      remoteSales.forEach(s => map.set(s.id, s));

      const merged = Array.from(map.values()).sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      saveStoredSales(merged);
      return merged;
    } catch {
      return localSales;
    }
  },

  /**
   * Validate medicines in cart: stock quantity and expiry
   */
  validateItems(items: WalkInSaleItem[], medicinesCatalog: any[]): { valid: boolean; error?: string } {
    if (!items || items.length === 0) {
      return { valid: false, error: 'Please select at least one medicine to proceed.' };
    }

    for (const item of items) {
      if (!item.quantity || item.quantity <= 0) {
        return { valid: false, error: `Quantity for "${item.name}" must be greater than 0.` };
      }

      const med = medicinesCatalog.find(m => m.id === item.medicineId);
      if (!med) {
        return { valid: false, error: `Medicine "${item.name}" was not found in the inventory catalog.` };
      }

      // Check expiry date
      if (med.expiry_date) {
        const daysLeft = differenceInDays(new Date(med.expiry_date), new Date());
        if (daysLeft < 0) {
          return { valid: false, error: `Cannot sell "${med.name}": This batch expired on ${med.expiry_date}.` };
        }
      }

      // Check available stock
      const available = med.quantity || 0;
      if (item.quantity > available) {
        return { 
          valid: false, 
          error: `Insufficient stock for "${med.name}". Requested: ${item.quantity}, Available in stock: ${available}.` 
        };
      }
    }

    return { valid: true };
  },

  /**
   * Execute an atomic walk-in sale
   */
  async processSale({
    customerName,
    customerPhone,
    customerCategory,
    customerGender,
    customerAge,
    customerWeight,
    prescriptionNumber,
    items,
    discount = 0,
    paymentMethod,
    amountPaid,
    cashierName,
    cashierRole = 'pharmacist',
    notes
  }: {
    customerName?: string;
    customerPhone?: string;
    customerCategory?: 'Adult' | 'Child';
    customerGender?: 'Male' | 'Female' | 'Other';
    customerAge?: number;
    customerWeight?: number;
    prescriptionNumber?: string;
    items: WalkInSaleItem[];
    discount?: number;
    paymentMethod: 'cash' | 'mobile_banking' | 'card' | 'telebirr' | 'cbe_birr' | 'bank_transfer';
    amountPaid?: number;
    cashierName: string;
    cashierRole?: string;
    notes?: string;
  }): Promise<WalkInSale> {
    const now = new Date();
    const dateStr = format(now, 'yyyyMMdd');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const saleId = `WKS-${dateStr}-${randomSuffix}`;
    const receiptNumber = `RCP-WK-${dateStr}-${randomSuffix}`;

    // 1. Calculate totals
    const subtotal = items.reduce((sum, it) => sum + (it.unitPrice * it.quantity), 0);
    const safeDiscount = Math.min(subtotal, Math.max(0, discount || 0));
    const total = Math.max(0, subtotal - safeDiscount);
    const effectivePaid = paymentMethod === 'cash' ? (amountPaid ?? total) : total;
    const change = paymentMethod === 'cash' ? Math.max(0, effectivePaid - total) : 0;

    if (paymentMethod === 'cash' && effectivePaid < total) {
      throw new Error(`Amount paid (${effectivePaid} ETB) is less than total due (${total} ETB).`);
    }

    const saleRecord: WalkInSale = {
      id: saleId,
      receiptNumber,
      customerName: customerName?.trim() || 'Walk-In Customer',
      customerPhone: customerPhone?.trim() || '',
      customerType: 'Walk-In',
      customerCategory,
      customerGender,
      customerAge: customerAge ? Number(customerAge) : undefined,
      customerWeight: customerWeight ? Number(customerWeight) : undefined,
      prescriptionNumber: prescriptionNumber?.trim() || undefined,
      cashierName,
      cashierRole,
      items,
      subtotal,
      discount: safeDiscount,
      total,
      paymentMethod,
      amountPaid: effectivePaid,
      change,
      paymentStatus: 'paid',
      createdAt: now.toISOString(),
      notes: notes?.trim() || undefined
    };

    // 2. Decrement inventory and record WALK_IN_SALE movement for each medicine
    const stockErrors: string[] = [];
    for (const item of items) {
      try {
        // Fetch fresh quantity
        const { data: medData, error: fetchErr } = await supabase
          .from('medicines')
          .select('id, name, quantity, min_stock, unit_price')
          .eq('id', item.medicineId)
          .maybeSingle();

        if (!fetchErr && medData) {
          const currentQty = medData.quantity || 0;
          const minStock = medData.min_stock || 10;
          const newQty = Math.max(0, currentQty - item.quantity);
          const newStatus = newQty <= 0 ? 'out_of_stock' : newQty <= minStock ? 'low_stock' : 'in_stock';

          const { error: updateErr } = await supabase
            .from('medicines')
            .update({
              quantity: newQty,
              status: newStatus,
              updated_at: now.toISOString()
            })
            .eq('id', item.medicineId);

          if (updateErr) {
            console.warn(`[pharmacySale] Failed to update stock for ${item.name}:`, updateErr.message);
            stockErrors.push(item.name);
          } else {
            // Check for low stock alert
            if (newQty <= minStock) {
              notificationService.dispatch({
                title: 'Low Stock Alert',
                message: `"${item.name}" is running low (${newQty} left in inventory).`,
                type: 'alert',
                module: 'pharmacy',
                targetRoles: ['pharmacist', 'owner'],
                link: '/pharmacy/inventory'
              });
            }
          }
        }
      } catch (err: any) {
        console.warn(`[pharmacySale] Exception adjusting stock for ${item.name}:`, err);
      }

      // Record WALK_IN_SALE movement
      try {
        await movementService.recordMovement({
          medicineId: item.medicineId || `med-${item.name.toLowerCase().replace(/\s+/g, '-')}`,
          medicineName: item.name,
          movementType: 'WALK_IN_SALE',
          quantity: item.quantity,
          batchNumber: item.batchNumber,
          expiryDate: item.expiryDate || undefined,
          unitPrice: item.unitPrice,
          referenceType: 'walk_in_sale',
          referenceId: saleId,
          sourceLocation: 'Pharmacy POS Shelf',
          destinationLocation: 'Customer',
          notes: `Walk-in sale to ${saleRecord.customerName} (${receiptNumber})${item.dosageInstructions ? ` - Dosage: ${item.dosageInstructions}` : ''}`,
          performedBy: cashierName,
          performedByRole: cashierRole
        });
      } catch (mvtErr) {
        console.warn(`[pharmacySale] Movement record failed for ${item.name}:`, mvtErr);
      }
    }

    // 3. Record Payment in public.payments table
    const itemSummary = items.map(i => `${i.name} (x${i.quantity})`).join(', ');
    const paymentMethodMap: Record<string, 'cash' | 'mobile_banking' | 'card' | 'insurance'> = {
      cash: 'cash',
      card: 'card',
      mobile_banking: 'mobile_banking',
      telebirr: 'mobile_banking',
      cbe_birr: 'mobile_banking',
      bank_transfer: 'mobile_banking'
    };

    try {
      const paymentPayload = {
        payment_type: 'medicine',
        description: `Walk-In Pharmacy Sale: ${itemSummary}${safeDiscount > 0 ? ` (Disc: -${safeDiscount} ETB)` : ''}`,
        amount: total,
        status: 'paid',
        payment_method: paymentMethodMap[paymentMethod] || 'cash',
        receipt_number: receiptNumber,
        reference_id: saleId,
        reference_type: 'walk_in_sale',
        patient_name: saleRecord.customerName,
        cashier_name: cashierName,
        paid_date: format(now, 'yyyy-MM-dd'),
        medication_name: items[0]?.name || 'Medicine',
        quantity: items.reduce((acc, it) => acc + it.quantity, 0),
        order_notes: JSON.stringify(saleRecord)
      };

      const { error: pmtErr } = await supabase
        .from('payments')
        .insert(paymentPayload as any);

      if (pmtErr) {
        console.warn('[pharmacySale] Payments table direct insert failed, caching locally:', pmtErr.message);
        // Fallback local payments cache
        try {
          const cacheKey = 'ethiocare_cache_Payment';
          const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
          cached.unshift({
            ...paymentPayload,
            id: `pmt-${Date.now()}`,
            created_at: now.toISOString(),
            updated_at: now.toISOString()
          });
          localStorage.setItem(cacheKey, JSON.stringify(cached.slice(0, 200)));
        } catch {}
      }
    } catch (pmtEx) {
      console.warn('[pharmacySale] Payment recording exception:', pmtEx);
    }

    // 4. Record Audit Log in live Supabase
    try {
      await logAudit({
        userName: cashierName,
        userRole: cashierRole,
        action: 'create',
        module: 'PharmacySale',
        description: `Walk-In Sale ${receiptNumber} (${items.length} items, total ${total} ETB) via ${paymentMethod} to ${saleRecord.customerName}`,
        recordId: saleId,
        recordName: receiptNumber
      });
    } catch {
      // audit failure shouldn't abort checkout
    }

    // 5. Update local walk-in sales cache
    const currentSales = getStoredSales();
    saveStoredSales([saleRecord, ...currentSales]);

    // 6. Broadcast notification
    notificationService.dispatch({
      title: 'Walk-In Sale Completed',
      message: `Sale ${receiptNumber} processed for ${total.toLocaleString()} ETB (${paymentMethod.replace('_', ' ')}) by ${cashierName}.`,
      type: 'success',
      module: 'pharmacy',
      targetRoles: ['pharmacist', 'owner', 'accountant'],
      link: '/pharmacy/sales'
    });

    return saleRecord;
  }
};
