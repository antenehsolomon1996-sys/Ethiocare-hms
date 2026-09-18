import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { movementService } from '@/services/movement.service';
import { logAudit } from '@/lib/auditLogger';
import { notificationService } from '@/services/notification.service';
import { pharmacySaleService, WalkInSale } from '@/services/pharmacySale.service';
import { format } from 'date-fns';

export interface ReturnItem {
  medicineId: string;
  name: string;
  batchNumber?: string;
  expiryDate?: string | null;
  soldQuantity: number;
  previouslyReturnedQuantity: number;
  returnQuantity: number;
  unitPrice: number;
  refundAmount: number;
  restockable: boolean;
  reason: 'defective' | 'expired' | 'customer_mistake' | 'prescriber_change' | 'adverse_reaction' | 'other';
  conditionNotes?: string;
}

export interface SalesReturnRecord {
  id: string;
  returnNumber: string;
  saleId: string;
  receiptNumber: string;
  customerName: string;
  customerPhone?: string;
  items: ReturnItem[];
  refundAmount: number;
  paymentMethod: string;
  reason: string;
  notes?: string;
  restocked: boolean;
  processedBy: string;
  processedByRole?: string;
  status: 'completed' | 'cancelled';
  createdAt: string;
}

const STORAGE_KEY = 'ethiocare_sales_returns';

function getStoredReturns(): SalesReturnRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredReturns(returns: SalesReturnRecord[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(returns.slice(0, 100)));
  } catch {}
}

export const salesReturnService = {
  /**
   * Get all past sales returns
   */
  async getReturns(): Promise<SalesReturnRecord[]> {
    const local = getStoredReturns();
    if (!isSupabaseConfigured()) {
      return local;
    }

    try {
      const { data, error } = await supabase
        .from('sales_returns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error || !data) {
        return local;
      }

      const remote: SalesReturnRecord[] = data.map((row: any) => ({
        id: row.id,
        returnNumber: row.return_number || row.id,
        saleId: row.sale_id || '',
        receiptNumber: row.receipt_number || '',
        customerName: row.customer_name || 'Walk-In Customer',
        customerPhone: row.customer_phone || '',
        items: row.items || [],
        refundAmount: Number(row.refund_amount || 0),
        paymentMethod: row.payment_method || 'cash',
        reason: row.reason || '',
        notes: row.notes || '',
        restocked: !!row.restocked,
        processedBy: row.processed_by || 'Pharmacist',
        status: row.status || 'completed',
        createdAt: row.created_at
      }));

      const map = new Map<string, SalesReturnRecord>();
      local.forEach(r => map.set(r.returnNumber, r));
      remote.forEach(r => map.set(r.returnNumber, r));

      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      saveStoredReturns(merged);
      return merged;
    } catch {
      return local;
    }
  },

  /**
   * Find a sale by Receipt Number or Sale ID and compute already-returned quantities
   */
  async findSaleForReturn(query: string): Promise<{
    sale: WalkInSale | null;
    itemsWithReturnHistory: ReturnItem[];
    error?: string;
  }> {
    if (!query || !query.trim()) {
      return { sale: null, itemsWithReturnHistory: [], error: 'Please enter a receipt number or sale ID.' };
    }

    const trimmed = query.trim().toUpperCase();
    const allSales = await pharmacySaleService.getSales();
    const matchedSale = allSales.find(
      s => s.receiptNumber?.toUpperCase() === trimmed || s.id?.toUpperCase() === trimmed
    );

    if (!matchedSale) {
      return {
        sale: null,
        itemsWithReturnHistory: [],
        error: `No sale found matching "${query.trim()}". Please verify the receipt number.`
      };
    }

    // Fetch existing returns for this sale to compute remaining returnable quantities
    const allReturns = await this.getReturns();
    const priorReturnsForSale = allReturns.filter(
      r => r.saleId === matchedSale.id || r.receiptNumber === matchedSale.receiptNumber
    );

    const previouslyReturnedMap = new Map<string, number>();
    priorReturnsForSale.forEach(ret => {
      ret.items.forEach(it => {
        const key = it.medicineId || it.name;
        const current = previouslyReturnedMap.get(key) || 0;
        previouslyReturnedMap.set(key, current + (it.returnQuantity || 0));
      });
    });

    const itemsWithHistory: ReturnItem[] = matchedSale.items.map(item => {
      const key = item.medicineId || item.name;
      const prevQty = previouslyReturnedMap.get(key) || 0;
      return {
        medicineId: item.medicineId,
        name: item.name,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        soldQuantity: item.quantity,
        previouslyReturnedQuantity: prevQty,
        returnQuantity: 0,
        unitPrice: item.unitPrice,
        refundAmount: 0,
        restockable: true,
        reason: 'customer_mistake',
        conditionNotes: ''
      };
    });

    return {
      sale: matchedSale,
      itemsWithReturnHistory: itemsWithHistory
    };
  },

  /**
   * Validate return items
   */
  validateReturn({
    sale,
    items
  }: {
    sale: WalkInSale;
    items: ReturnItem[];
  }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    const activeItems = items.filter(it => it.returnQuantity > 0);
    if (activeItems.length === 0) {
      errors.push('Please specify at least one item and quantity greater than 0 to return.');
      return { valid: false, errors };
    }

    activeItems.forEach(it => {
      const maxReturnable = it.soldQuantity - it.previouslyReturnedQuantity;
      if (it.returnQuantity > maxReturnable) {
        errors.push(
          `Cannot return ${it.returnQuantity} of "${it.name}". Maximum returnable quantity is ${maxReturnable}.`
        );
      }
      if (!it.reason) {
        errors.push(`Please provide a return reason for "${it.name}".`);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Process a sales return atomically
   */
  async processReturn({
    sale,
    items,
    processedBy,
    processedByRole = 'pharmacist',
    notes
  }: {
    sale: WalkInSale;
    items: ReturnItem[];
    processedBy: string;
    processedByRole?: string;
    notes?: string;
  }): Promise<SalesReturnRecord> {
    const now = new Date();
    const dateStr = format(now, 'yyyyMMdd');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const returnNumber = `RET-${dateStr}-${randomSuffix}`;

    const activeItems = items.filter(it => it.returnQuantity > 0);
    const totalRefund = activeItems.reduce(
      (sum, it) => sum + (it.returnQuantity * it.unitPrice),
      0
    );

    let hasAnyRestocked = false;

    // 1. Process each item: restock if applicable, log movement
    for (const item of activeItems) {
      if (item.restockable) {
        hasAnyRestocked = true;
        // Increase medicine quantity in Supabase
        if (item.medicineId) {
          try {
            const { data: medData } = await supabase
              .from('medicines')
              .select('id, quantity, min_stock')
              .eq('id', item.medicineId)
              .maybeSingle();

            if (medData) {
              const currentQty = medData.quantity || 0;
              const newQty = currentQty + item.returnQuantity;
              const minStock = medData.min_stock || 10;
              const newStatus = newQty <= 0 ? 'out_of_stock' : newQty <= minStock ? 'low_stock' : 'in_stock';

              await supabase
                .from('medicines')
                .update({
                  quantity: newQty,
                  status: newStatus,
                  updated_at: now.toISOString()
                })
                .eq('id', item.medicineId);
            }
          } catch (err) {
            console.warn(`[salesReturn] Stock adjustment error for ${item.name}:`, err);
          }
        }

        // Record RETURN_IN movement
        try {
          await movementService.recordMovement({
            medicineId: item.medicineId || `med-${item.name.toLowerCase().replace(/\s+/g, '-')}`,
            medicineName: item.name,
            movementType: 'RETURN_IN',
            quantity: item.returnQuantity,
            batchNumber: item.batchNumber,
            expiryDate: item.expiryDate || undefined,
            unitPrice: item.unitPrice,
            referenceType: 'sales_return',
            referenceId: returnNumber,
            notes: `Customer return from Receipt #${sale.receiptNumber}. Restocked to inventory. Reason: ${item.reason}. ${item.conditionNotes || ''}`,
            performedBy: processedBy,
            performedByRole: processedByRole
          });
        } catch (mvtErr) {
          console.warn(`[salesReturn] Movement error for ${item.name}:`, mvtErr);
        }
      } else {
        // Non-restockable (damaged / expired / contaminated)
        const movementType = item.reason === 'expired' ? 'EXPIRED' : 'DAMAGED';
        try {
          await movementService.recordMovement({
            medicineId: item.medicineId || `med-${item.name.toLowerCase().replace(/\s+/g, '-')}`,
            medicineName: item.name,
            movementType,
            quantity: item.returnQuantity,
            batchNumber: item.batchNumber,
            expiryDate: item.expiryDate || undefined,
            unitPrice: item.unitPrice,
            referenceType: 'sales_return',
            referenceId: returnNumber,
            notes: `Non-restockable return from Receipt #${sale.receiptNumber} (${item.reason}). Quarantined/discarded. ${item.conditionNotes || ''}`,
            performedBy: processedBy,
            performedByRole: processedByRole
          });
        } catch (mvtErr) {
          console.warn(`[salesReturn] Non-restockable movement error for ${item.name}:`, mvtErr);
        }
      }
    }

    const returnRecord: SalesReturnRecord = {
      id: `RET-${Date.now()}`,
      returnNumber,
      saleId: sale.id,
      receiptNumber: sale.receiptNumber,
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      items: activeItems,
      refundAmount: totalRefund,
      paymentMethod: sale.paymentMethod,
      reason: activeItems.map(it => `${it.name}: ${it.reason}`).join('; '),
      notes: notes?.trim() || '',
      restocked: hasAnyRestocked,
      processedBy,
      processedByRole,
      status: 'completed',
      createdAt: now.toISOString()
    };

    // 2. Persist to Supabase sales_returns table
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('sales_returns').insert({
          return_number: returnRecord.returnNumber,
          sale_id: returnRecord.saleId,
          receipt_number: returnRecord.receiptNumber,
          customer_name: returnRecord.customerName,
          customer_phone: returnRecord.customerPhone,
          items: returnRecord.items,
          refund_amount: returnRecord.refundAmount,
          payment_method: returnRecord.paymentMethod,
          reason: returnRecord.reason,
          notes: returnRecord.notes,
          restocked: returnRecord.restocked,
          processed_by: returnRecord.processedBy,
          status: 'completed'
        });
      } catch (err) {
        console.warn('[salesReturn] Supabase insert failed:', err);
      }
    }

    // 3. Save to local storage
    const currentReturns = getStoredReturns();
    saveStoredReturns([returnRecord, ...currentReturns]);

    // 4. Audit Log
    try {
      await logAudit({
        userName: processedBy,
        userRole: processedByRole,
        action: 'create',
        module: 'PharmacyReturn',
        description: `Processed Return #${returnNumber} for Sale ${sale.receiptNumber} (Refund: ${totalRefund.toLocaleString()} ETB, Items: ${activeItems.length})`,
        recordId: returnRecord.id,
        recordName: returnNumber
      });
    } catch {}

    // 5. Notification
    notificationService.dispatch({
      title: 'Sales Return Processed',
      message: `Return #${returnNumber} processed for ${sale.receiptNumber} (${totalRefund.toLocaleString()} ETB refund) by ${processedBy}.`,
      type: 'warning',
      module: 'pharmacy',
      targetRoles: ['pharmacist', 'owner', 'accountant'],
      link: '/pharmacy/returns'
    });

    return returnRecord;
  }
};
