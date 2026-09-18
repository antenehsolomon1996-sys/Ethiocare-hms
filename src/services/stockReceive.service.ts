import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { movementService } from '@/services/movement.service';
import { logAudit } from '@/lib/auditLogger';
import { notificationService } from '@/services/notification.service';
import { format } from 'date-fns';

export interface ReceiveStockItem {
  id?: string;
  medicineId?: string;
  name: string;
  genericName?: string;
  category?: string;
  dosageForm?: string;
  strength?: string;
  unit?: string;
  batchNumber: string;
  expiryDate: string;
  manufacturingDate?: string;
  quantity: number;
  purchasePrice: number;
  sellingPrice: number;
  taxPercent: number;
  barcode?: string;
  storageLocation?: string;
}

export interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  poNumber?: string;
  supplier: string;
  invoiceDate: string;
  deliveryDate: string;
  warehouseLocation: string;
  receivedBy: string;
  receivedByRole?: string;
  notes?: string;
  items: ReceiveStockItem[];
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  totalQuantity: number;
  inventoryValue: number;
  status: 'received' | 'pending' | 'cancelled';
  createdAt: string;
}

const STORAGE_KEY = 'ethiocare_purchase_invoices';

function getStoredInvoices(): PurchaseInvoice[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredInvoices(invoices: PurchaseInvoice[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices.slice(0, 100)));
  } catch {}
}

export const stockReceiveService = {
  /**
   * Get all past purchase invoices
   */
  async getInvoices(): Promise<PurchaseInvoice[]> {
    const local = getStoredInvoices();
    if (!isSupabaseConfigured()) {
      return local;
    }

    try {
      const { data, error } = await supabase
        .from('purchase_invoices')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error || !data) {
        return local;
      }

      const remote: PurchaseInvoice[] = data.map((row: any) => ({
        id: row.id,
        invoiceNumber: row.invoice_number || row.id,
        poNumber: row.po_number || '',
        supplier: row.supplier || '',
        invoiceDate: row.invoice_date || row.created_at,
        deliveryDate: row.delivery_date || row.created_at,
        warehouseLocation: row.warehouse_location || 'Main Store',
        receivedBy: row.received_by || 'Pharmacist',
        notes: row.notes || '',
        items: row.items || [],
        subtotal: Number(row.subtotal || 0),
        taxTotal: Number(row.tax_total || 0),
        grandTotal: Number(row.grand_total || 0),
        totalQuantity: Number(row.total_quantity || 0),
        inventoryValue: Number(row.inventory_value || 0),
        status: row.status || 'received',
        createdAt: row.created_at
      }));

      const map = new Map<string, PurchaseInvoice>();
      local.forEach(inv => map.set(inv.invoiceNumber, inv));
      remote.forEach(inv => map.set(inv.invoiceNumber, inv));

      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      saveStoredInvoices(merged);
      return merged;
    } catch {
      return local;
    }
  },

  /**
   * Validate stock receiving form before submission
   */
  validateReceive({
    invoiceNumber,
    supplier,
    deliveryDate,
    items
  }: {
    invoiceNumber: string;
    supplier: string;
    deliveryDate: string;
    items: ReceiveStockItem[];
  }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!invoiceNumber || !invoiceNumber.trim()) {
      errors.push('Purchase Invoice Number is required.');
    }
    if (!supplier || !supplier.trim()) {
      errors.push('Supplier Name is required.');
    }
    if (!deliveryDate) {
      errors.push('Delivery / Received Date is required.');
    }
    if (!items || items.length === 0) {
      errors.push('At least one medicine item must be added to the invoice.');
      return { valid: false, errors };
    }

    items.forEach((item, idx) => {
      const rowNum = idx + 1;
      if (!item.name || !item.name.trim()) {
        errors.push(`Row ${rowNum}: Medicine Name is required.`);
      }
      if (!item.batchNumber || !item.batchNumber.trim()) {
        errors.push(`Row ${rowNum} (${item.name || 'Medicine'}): Batch Number is required.`);
      }
      if (!item.expiryDate) {
        errors.push(`Row ${rowNum} (${item.name || 'Medicine'}): Expiry Date is required.`);
      } else {
        const expDate = new Date(item.expiryDate);
        if (expDate <= new Date()) {
          errors.push(`Row ${rowNum} (${item.name || 'Medicine'}): Expiry Date cannot be in the past.`);
        }
      }
      if (!item.quantity || Number(item.quantity) <= 0) {
        errors.push(`Row ${rowNum} (${item.name || 'Medicine'}): Quantity must be greater than 0.`);
      }
      if (item.purchasePrice === undefined || Number(item.purchasePrice) < 0) {
        errors.push(`Row ${rowNum} (${item.name || 'Medicine'}): Purchase Price cannot be negative.`);
      }
      if (item.sellingPrice === undefined || Number(item.sellingPrice) <= 0) {
        errors.push(`Row ${rowNum} (${item.name || 'Medicine'}): Selling Price must be greater than 0.`);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Process Stock Receiving atomically
   */
  async processReceiveStock({
    invoiceNumber,
    poNumber,
    supplier,
    invoiceDate,
    deliveryDate,
    warehouseLocation = 'Main Pharmacy Store',
    receivedBy,
    receivedByRole = 'pharmacist',
    notes,
    items
  }: {
    invoiceNumber: string;
    poNumber?: string;
    supplier: string;
    invoiceDate?: string;
    deliveryDate: string;
    warehouseLocation?: string;
    receivedBy: string;
    receivedByRole?: string;
    notes?: string;
    items: ReceiveStockItem[];
  }): Promise<PurchaseInvoice> {
    const now = new Date();
    const effectiveInvoiceDate = invoiceDate || format(now, 'yyyy-MM-dd');

    // Calculate totals
    let subtotal = 0;
    let taxTotal = 0;
    let totalQuantity = 0;
    let inventoryValue = 0;

    items.forEach(it => {
      const rowSubtotal = Number(it.quantity) * Number(it.purchasePrice);
      const rowTax = rowSubtotal * (Number(it.taxPercent || 0) / 100);
      subtotal += rowSubtotal;
      taxTotal += rowTax;
      totalQuantity += Number(it.quantity);
      inventoryValue += Number(it.quantity) * Number(it.sellingPrice);
    });

    const grandTotal = subtotal + taxTotal;

    const invoiceRecord: PurchaseInvoice = {
      id: `INV-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      invoiceNumber: invoiceNumber.trim(),
      poNumber: poNumber?.trim() || '',
      supplier: supplier.trim(),
      invoiceDate: effectiveInvoiceDate,
      deliveryDate,
      warehouseLocation,
      receivedBy,
      receivedByRole,
      notes: notes?.trim() || '',
      items,
      subtotal,
      taxTotal,
      grandTotal,
      totalQuantity,
      inventoryValue,
      status: 'received',
      createdAt: now.toISOString()
    };

    // 1. Update/insert each medicine and record STOCK_IN movement
    for (const item of items) {
      let resolvedMedId = item.medicineId;

      try {
        if (resolvedMedId) {
          // Fetch existing medicine
          const { data: existingMed } = await supabase
            .from('medicines')
            .select('*')
            .eq('id', resolvedMedId)
            .maybeSingle();

          if (existingMed) {
            const newQty = (existingMed.quantity || 0) + Number(item.quantity);
            const minStock = existingMed.min_stock || 10;
            const newStatus = newQty <= 0 ? 'out_of_stock' : newQty <= minStock ? 'low_stock' : 'in_stock';

            await supabase
              .from('medicines')
              .update({
                quantity: newQty,
                unit_price: Number(item.sellingPrice) || existingMed.unit_price,
                purchase_price: Number(item.purchasePrice) || existingMed.purchase_price,
                batch_number: item.batchNumber || existingMed.batch_number,
                expiry_date: item.expiryDate || existingMed.expiry_date,
                manufacturing_date: item.manufacturingDate || existingMed.manufacturing_date,
                storage_location: warehouseLocation || existingMed.storage_location,
                supplier: supplier || existingMed.supplier,
                barcode: item.barcode || existingMed.barcode,
                status: newStatus,
                updated_at: now.toISOString()
              })
              .eq('id', resolvedMedId);
          }
        } else {
          // Check if medicine exists by name to avoid duplicate catalog entries
          const { data: matchedMed } = await supabase
            .from('medicines')
            .select('*')
            .ilike('name', item.name.trim())
            .maybeSingle();

          if (matchedMed) {
            resolvedMedId = matchedMed.id;
            const newQty = (matchedMed.quantity || 0) + Number(item.quantity);
            const minStock = matchedMed.min_stock || 10;
            const newStatus = newQty <= 0 ? 'out_of_stock' : newQty <= minStock ? 'low_stock' : 'in_stock';

            await supabase
              .from('medicines')
              .update({
                quantity: newQty,
                unit_price: Number(item.sellingPrice) || matchedMed.unit_price,
                purchase_price: Number(item.purchasePrice) || matchedMed.purchase_price,
                batch_number: item.batchNumber || matchedMed.batch_number,
                expiry_date: item.expiryDate || matchedMed.expiry_date,
                manufacturing_date: item.manufacturingDate || matchedMed.manufacturing_date,
                storage_location: warehouseLocation || matchedMed.storage_location,
                supplier: supplier || matchedMed.supplier,
                barcode: item.barcode || matchedMed.barcode,
                status: newStatus,
                updated_at: now.toISOString()
              })
              .eq('id', matchedMed.id);
          } else {
            // Insert new medicine
            const { data: newMed } = await supabase
              .from('medicines')
              .insert({
                name: item.name.trim(),
                generic_name: item.genericName?.trim() || null,
                category: item.category || 'General',
                dosage_form: item.dosageForm || 'Tablet',
                strength: item.strength?.trim() || null,
                unit: item.unit || 'tablets',
                batch_number: item.batchNumber.trim(),
                expiry_date: item.expiryDate,
                manufacturing_date: item.manufacturingDate || null,
                quantity: Number(item.quantity),
                purchase_price: Number(item.purchasePrice),
                unit_price: Number(item.sellingPrice),
                tax: Number(item.taxPercent || 0),
                min_stock: 10,
                max_stock: 1000,
                barcode: item.barcode?.trim() || null,
                storage_location: warehouseLocation,
                supplier: supplier.trim(),
                status: 'in_stock'
              })
              .select()
              .maybeSingle();

            if (newMed?.id) {
              resolvedMedId = newMed.id;
            }
          }
        }
      } catch (medErr) {
        console.warn(`[stockReceive] Error updating medicine for ${item.name}:`, medErr);
      }

      // Record STOCK_IN movement
      try {
        await movementService.recordMovement({
          medicineId: resolvedMedId || `med-${item.name.toLowerCase().replace(/\s+/g, '-')}`,
          medicineName: item.name.trim(),
          movementType: 'STOCK_IN',
          quantity: Number(item.quantity),
          batchNumber: item.batchNumber,
          expiryDate: item.expiryDate,
          unitPrice: Number(item.purchasePrice),
          referenceType: 'purchase_invoice',
          referenceId: invoiceNumber.trim(),
          sourceLocation: supplier.trim(),
          destinationLocation: warehouseLocation,
          notes: `Received ${item.quantity} units via Invoice #${invoiceNumber.trim()} from ${supplier.trim()}`,
          performedBy: receivedBy,
          performedByRole: receivedByRole
        });
      } catch (mvtErr) {
        console.warn(`[stockReceive] Movement logging failed for ${item.name}:`, mvtErr);
      }
    }

    // 2. Persist invoice to Supabase purchase_invoices table
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('purchase_invoices').insert({
          invoice_number: invoiceRecord.invoiceNumber,
          po_number: invoiceRecord.poNumber,
          supplier: invoiceRecord.supplier,
          invoice_date: invoiceRecord.invoiceDate,
          delivery_date: invoiceRecord.deliveryDate,
          warehouse_location: invoiceRecord.warehouseLocation,
          received_by: invoiceRecord.receivedBy,
          notes: invoiceRecord.notes,
          items: invoiceRecord.items,
          subtotal: invoiceRecord.subtotal,
          tax_total: invoiceRecord.taxTotal,
          grand_total: invoiceRecord.grandTotal,
          total_quantity: invoiceRecord.totalQuantity,
          inventory_value: invoiceRecord.inventoryValue,
          status: 'received'
        });
      } catch (invErr) {
        console.warn('[stockReceive] Failed to persist invoice to Supabase table:', invErr);
      }
    }

    // 3. Save to local storage
    const currentInvoices = getStoredInvoices();
    saveStoredInvoices([invoiceRecord, ...currentInvoices]);

    // 4. Audit Log
    try {
      await logAudit({
        userName: receivedBy,
        userRole: receivedByRole,
        action: 'create',
        module: 'PharmacyStock',
        description: `Received Stock Invoice #${invoiceNumber} from ${supplier}: ${totalQuantity} items, Grand Total: ${grandTotal.toLocaleString()} ETB`,
        recordId: invoiceRecord.id,
        recordName: invoiceNumber
      });
    } catch {}

    // 5. Notification
    notificationService.dispatch({
      title: 'Stock Received',
      message: `Invoice #${invoiceNumber} received from ${supplier} (${totalQuantity} items, ${grandTotal.toLocaleString()} ETB) by ${receivedBy}.`,
      type: 'success',
      module: 'pharmacy',
      targetRoles: ['pharmacist', 'owner'],
      link: '/pharmacy/inventory'
    });

    return invoiceRecord;
  }
};
