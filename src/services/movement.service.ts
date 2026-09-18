import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export type MovementType =
  | 'STOCK_IN'
  | 'HOSPITAL_DISPENSE'
  | 'WALK_IN_SALE'
  | 'RETURN_IN'
  | 'RETURN_OUT'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'EXPIRED'
  | 'DAMAGED'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT';

export interface InventoryMovement {
  id: string;
  medicineId?: string | null;
  medicineName: string;
  batchNumber?: string | null;
  movementType: MovementType;
  quantity: number;
  previousQuantity?: number | null;
  newQuantity?: number | null;
  referenceId?: string | null;
  referenceType?: string | null;
  reason?: string | null;
  storageLocation?: string | null;
  performedBy: string;
  userRole?: string | null;
  createdAt: string;
}

const STORAGE_KEY = 'ethiocare_inventory_movements';

function getLocalMovements(): InventoryMovement[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalMovements(items: InventoryMovement[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 500)));
  } catch {
    // ignore
  }
}

export const movementService = {
  /**
   * Record a traceable inventory movement in Supabase and local cache
   */
  async recordMovement(data: {
    medicineId?: string | null;
    medicineName: string;
    batchNumber?: string | null;
    movementType: MovementType;
    quantity: number;
    previousQuantity?: number | null;
    newQuantity?: number | null;
    referenceId?: string | null;
    referenceType?: string | null;
    reason?: string | null;
    storageLocation?: string | null;
    performedBy: string;
    userRole?: string | null;
  }): Promise<InventoryMovement> {
    const now = new Date().toISOString();
    const movementRecord: InventoryMovement = {
      id: `mov-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      medicineId: data.medicineId || null,
      medicineName: data.medicineName,
      batchNumber: data.batchNumber || null,
      movementType: data.movementType,
      quantity: Number(data.quantity) || 0,
      previousQuantity: data.previousQuantity != null ? Number(data.previousQuantity) : null,
      newQuantity: data.newQuantity != null ? Number(data.newQuantity) : null,
      referenceId: data.referenceId || null,
      referenceType: data.referenceType || null,
      reason: data.reason || null,
      storageLocation: data.storageLocation || 'Main Pharmacy Dispensary',
      performedBy: data.performedBy,
      userRole: data.userRole || 'pharmacist',
      createdAt: now
    };

    // Save to local cache first for instant feedback and offline resilience
    const current = getLocalMovements();
    saveLocalMovements([movementRecord, ...current]);

    // Try persisting to Supabase inventory_movements table
    if (isSupabaseConfigured()) {
      try {
        const payload: any = {
          medicine_name: data.medicineName,
          batch_number: data.batchNumber || null,
          movement_type: data.movementType,
          quantity: Number(data.quantity) || 0,
          previous_quantity: data.previousQuantity != null ? Number(data.previousQuantity) : null,
          new_quantity: data.newQuantity != null ? Number(data.newQuantity) : null,
          reference_id: data.referenceId || null,
          reference_type: data.referenceType || null,
          reason: data.reason || null,
          storage_location: data.storageLocation || 'Main Pharmacy Dispensary',
          performed_by: data.performedBy,
          user_role: data.userRole || 'pharmacist',
        };

        // Only pass valid UUID for medicine_id if present
        if (data.medicineId && /^[0-9a-fA-F-]{36}$/.test(data.medicineId)) {
          payload.medicine_id = data.medicineId;
        }

        const { data: inserted, error } = await supabase
          .from('inventory_movements')
          .insert(payload)
          .select()
          .single();

        if (!error && inserted) {
          movementRecord.id = inserted.id;
        }
      } catch (err) {
        console.warn('[movementService] Note: Supabase movement insert silent fallback:', err);
      }
    }

    return movementRecord;
  },

  /**
   * Fetch all inventory movements with optional filters
   */
  async getMovements(filters?: {
    medicineId?: string;
    movementType?: string;
    limit?: number;
  }): Promise<InventoryMovement[]> {
    const local = getLocalMovements();

    if (!isSupabaseConfigured()) {
      return this._applyFilters(local, filters);
    }

    try {
      let query = supabase
        .from('inventory_movements')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.movementType && filters.movementType !== 'all') {
        query = query.eq('movement_type', filters.movementType);
      }
      if (filters?.medicineId) {
        query = query.eq('medicine_id', filters.medicineId);
      }
      if (filters?.limit) {
        query = query.limit(filters.limit);
      } else {
        query = query.limit(200);
      }

      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        return this._applyFilters(local, filters);
      }

      const remote: InventoryMovement[] = data.map((d: any) => ({
        id: d.id,
        medicineId: d.medicine_id,
        medicineName: d.medicine_name,
        batchNumber: d.batch_number,
        movementType: d.movement_type,
        quantity: d.quantity,
        previousQuantity: d.previous_quantity,
        newQuantity: d.new_quantity,
        referenceId: d.reference_id,
        referenceType: d.reference_type,
        reason: d.reason,
        storageLocation: d.storage_location,
        performedBy: d.performed_by,
        userRole: d.user_role,
        createdAt: d.created_at
      }));

      // Merge and deduplicate
      const map = new Map<string, InventoryMovement>();
      local.forEach(m => map.set(m.id, m));
      remote.forEach(m => map.set(m.id, m));

      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      saveLocalMovements(merged);
      return this._applyFilters(merged, filters);
    } catch {
      return this._applyFilters(local, filters);
    }
  },

  _applyFilters(items: InventoryMovement[], filters?: { medicineId?: string; movementType?: string; limit?: number }) {
    let res = items;
    if (filters?.movementType && filters.movementType !== 'all') {
      res = res.filter(m => m.movementType === filters.movementType);
    }
    if (filters?.medicineId) {
      res = res.filter(m => m.medicineId === filters.medicineId);
    }
    if (filters?.limit) {
      res = res.slice(0, filters.limit);
    }
    return res;
  },

  /**
   * Compute movement distribution counts
   */
  async getMovementDistribution(): Promise<{ name: string; value: number }[]> {
    const movements = await this.getMovements({ limit: 500 });
    const counts: Record<string, number> = {};

    movements.forEach(m => {
      const type = m.movementType || 'OTHER';
      counts[type] = (counts[type] || 0) + 1;
    });

    return Object.entries(counts).map(([name, value]) => ({
      name: name.replace(/_/g, ' '),
      value
    }));
  }
};
