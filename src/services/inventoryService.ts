// ============================================
// INVENTORY SERVICE LAYER - Phase 1
// Path: services/inventoryService.ts
// Purpose: API communication for Godowns, Stock Ledger, Reconciliation, Returns
// ============================================

import { apiClient } from './apiClient';
import { getAllGodowns as getLocalGodowns, getAllProducts } from './databaseService';

const API_BASE = '/inventory';
const LOCAL_RECONCILIATIONS_KEY = 'erp_inventory_reconciliations';
const LOCAL_RECONCILIATION_ITEMS_KEY = 'erp_inventory_reconciliation_items';
const LOCAL_RETURN_NOTES_KEY = 'erp_inventory_return_notes';

// Type Definitions
export interface Godown {
  id: string;
  company_id: number;
  name: string;
  address?: string;
  manager_id?: string;
  is_default: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface StockLedgerEntry {
  id: string;
  product_id: string;
  batch_id: string;
  godown_id?: string;
  movement_type: 'Purchase' | 'Sale' | 'Production' | 'Adjustment' | 'Transfer' | 'Return' | 'Opening' | 'Closing';
  reference_type?: string;
  reference_number?: string;
  in_qty: number;
  out_qty: number;
  running_balance: number;
  cost_per_unit: number;
  total_cost: number;
  movement_date: string;
  narration?: string;
  product_name?: string;
  batch_number?: string;
  godown_name?: string;
  created_at: string;
}

export interface StockReconciliation {
  id: string;
  reconciliation_number: string;
  reconciliation_date: string;
  status: 'Draft' | 'InProgress' | 'Completed' | 'Approved' | 'Rejected' | 'Cancelled';
  total_system_qty: number;
  total_physical_qty: number;
  total_variance_qty: number;
  total_variance_value: number;
  godown_name?: string;
  created_by_name?: string;
  verified_by_name?: string;
  approved_by_name?: string;
  created_at: string;
}

export interface ReconciliationItem {
  id: string;
  product_id: string;
  batch_id: string;
  system_qty: number;
  physical_qty: number;
  variance_qty: number;
  variance_reason?: string;
  variance_value: number;
  notes?: string;
  product_name?: string;
  batch_number?: string;
}

export interface ReturnNote {
  id: string;
  return_number: string;
  note_type: 'Supplier Return' | 'Customer Return';
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Received' | 'Closed';
  party_name?: string;
  return_date: string;
  total_qty: number;
  total_value: number;
  created_at: string;
}

const readLocalList = <T,>(key: string): T[] => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error(`Failed to read local inventory data for ${key}:`, error);
    return [];
  }
};

const writeLocalList = <T,>(key: string, value: T[]) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const generateSequence = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

const generateRunningNumber = (prefix: string, count: number) => {
  const month = new Date().toISOString().slice(0, 7).replace('-', '');
  return `${prefix}-${month}-${String(count + 1).padStart(5, '0')}`;
};

const loadLocalReconciliations = () => readLocalList<StockReconciliation>(LOCAL_RECONCILIATIONS_KEY);
const saveLocalReconciliations = (records: StockReconciliation[]) => writeLocalList(LOCAL_RECONCILIATIONS_KEY, records);

const loadLocalReconciliationItems = () => readLocalList<(ReconciliationItem & { reconciliation_id: string })>(LOCAL_RECONCILIATION_ITEMS_KEY);
const saveLocalReconciliationItems = (records: (ReconciliationItem & { reconciliation_id: string })[]) =>
  writeLocalList(LOCAL_RECONCILIATION_ITEMS_KEY, records);

const loadLocalReturnNotes = () => readLocalList<ReturnNote>(LOCAL_RETURN_NOTES_KEY);
const saveLocalReturnNotes = (records: ReturnNote[]) => writeLocalList(LOCAL_RETURN_NOTES_KEY, records);

// ============================================
// GODOWN SERVICE
// ============================================

export const GodownService = {
  // Get all godowns
  async getAllGodowns(): Promise<Godown[]> {
    try {
      const response = await apiClient.get<{ data: Godown[] }>(`${API_BASE}/godowns`);
      return response.data || [];
    } catch (error) {
      console.error('❌ Error fetching godowns:', error);
      throw error;
    }
  },

  // Get single godown
  async getGodown(id: string): Promise<Godown> {
    try {
      const response = await apiClient.get<{ data: Godown }>(`${API_BASE}/godowns/${id}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching godown:', error);
      throw error;
    }
  },

  // Create godown
  async createGodown(data: Partial<Godown>): Promise<Godown> {
    try {
      const response = await apiClient.post<{ data: Godown }>(`${API_BASE}/godowns`, data);
      return response.data;
    } catch (error) {
      console.error('❌ Error creating godown:', error);
      throw error;
    }
  },

  // Update godown
  async updateGodown(id: string, data: Partial<Godown>): Promise<Godown> {
    try {
      const response = await apiClient.put<{ data: Godown }>(`${API_BASE}/godowns/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('❌ Error updating godown:', error);
      throw error;
    }
  }
};

// ============================================
// STOCK LEDGER SERVICE
// ============================================

export const StockLedgerService = {
  // Get stock ledger with filters
  async getStockLedger(filters: {
    product_id?: string;
    batch_id?: string;
    godown_id?: string;
    from_date?: string;
    to_date?: string;
    movement_type?: string;
    page?: number;
    limit?: number;
  }): Promise<{ entries: StockLedgerEntry[]; total: number; page: number }> {
    try {
      const params = new URLSearchParams();
      if (filters.product_id) params.append('product_id', filters.product_id);
      if (filters.batch_id) params.append('batch_id', filters.batch_id);
      if (filters.godown_id) params.append('godown_id', filters.godown_id);
      if (filters.from_date) params.append('from_date', filters.from_date);
      if (filters.to_date) params.append('to_date', filters.to_date);
      if (filters.movement_type) params.append('movement_type', filters.movement_type);
      params.append('page', String(filters.page || 1));
      params.append('limit', String(filters.limit || 100));

      const response = await apiClient.get<{ data: StockLedgerEntry[]; total: number; page: number }>(
        `${API_BASE}/stock-ledger?${params.toString()}`
      );

      return {
        entries: response.data || [],
        total: response.total || 0,
        page: response.page || 1
      };
    } catch (error) {
      console.error('❌ Error fetching stock ledger:', error);
      throw error;
    }
  }
};

// ============================================
// STOCK RECONCILIATION SERVICE
// ============================================

export const StockReconciliationService = {
  // Start reconciliation
async startReconciliation(data: {
    godown_id: string;
    reconciliation_period_from?: string;
    reconciliation_period_to?: string;
  }): Promise<StockReconciliation> {
    try {
      const response = await apiClient.post<{ data: StockReconciliation }>(
        `${API_BASE}/reconciliation/start`,
        data
      );
      return response.data;
    } catch (error) {
      console.error('Inventory API reconciliation start failed, using local fallback:', error);
      const localGodowns = await getLocalGodowns();
      const existing = loadLocalReconciliations();
      const selectedGodown = localGodowns.find((item) => item.id === data.godown_id);
      const now = new Date().toISOString();
      const record: StockReconciliation = {
        id: generateSequence('LOCAL-REC'),
        reconciliation_number: generateRunningNumber('REC', existing.length),
        reconciliation_date: now,
        status: 'Draft',
        total_system_qty: 0,
        total_physical_qty: 0,
        total_variance_qty: 0,
        total_variance_value: 0,
        godown_name: selectedGodown?.name || 'Local Godown',
        created_at: now
      };
      saveLocalReconciliations([record, ...existing]);
      return record;
    }
  },

  // Get reconciliation details
async getReconciliation(id: string): Promise<{ header: StockReconciliation; items: ReconciliationItem[] }> {
    try {
      const response = await apiClient.get<{ header: StockReconciliation; items: ReconciliationItem[] }>(
        `${API_BASE}/reconciliation/${id}`
      );
      return response;
    } catch (error) {
      console.error('Inventory API reconciliation fetch failed, using local fallback:', error);
      const header = loadLocalReconciliations().find((item) => item.id === id);
      if (!header) {
        throw error;
      }
      const items = loadLocalReconciliationItems()
        .filter((item) => item.reconciliation_id === id)
        .map(({ reconciliation_id, ...rest }) => rest);
      return { header, items };
    }
  },

  // Add item to reconciliation
  async addReconciliationItem(
    reconciliationId: string,
    data: {
      product_id: string;
      batch_id: string;
      physical_qty: number;
      variance_reason?: string;
      notes?: string;
    }
  ): Promise<ReconciliationItem> {
    try {
      const response = await apiClient.post<{ data: ReconciliationItem }>(
        `${API_BASE}/reconciliation/${reconciliationId}/entry`,
        data
      );
      return response.data;
    } catch (error) {
      console.error('Inventory API reconciliation entry failed, using local fallback:', error);
      const products = await getAllProducts();
      const product = products.find((item) => item.id === data.product_id);
      const batch = product?.batches?.find((item) => item.id === data.batch_id);
      const systemQty = batch?.stock || 0;
      const varianceQty = data.physical_qty - systemQty;
      const varianceValue = varianceQty * (batch?.purchaseRate || 0);
      const item: ReconciliationItem & { reconciliation_id: string } = {
        id: generateSequence('LOCAL-ITEM'),
        reconciliation_id: reconciliationId,
        product_id: data.product_id,
        batch_id: data.batch_id,
        system_qty: systemQty,
        physical_qty: data.physical_qty,
        variance_qty: varianceQty,
        variance_reason: data.variance_reason,
        variance_value: varianceValue,
        notes: data.notes,
        product_name: product?.name || data.product_id,
        batch_number: batch?.batchNumber || data.batch_id
      };
      saveLocalReconciliationItems([...loadLocalReconciliationItems(), item]);
      saveLocalReconciliations(
        loadLocalReconciliations().map((record) =>
          record.id !== reconciliationId
            ? record
            : {
                ...record,
                status: record.status === 'Draft' ? 'InProgress' : record.status,
                total_system_qty: record.total_system_qty + systemQty,
                total_physical_qty: record.total_physical_qty + data.physical_qty,
                total_variance_qty: record.total_variance_qty + varianceQty,
                total_variance_value: record.total_variance_value + varianceValue
              }
        )
      );
      const { reconciliation_id, ...rest } = item;
      return rest;
    }
  },

  // Update reconciliation status
async updateReconciliationStatus(id: string, status: string): Promise<StockReconciliation> {
    try {
      const response = await apiClient.put<{ data: StockReconciliation }>(
        `${API_BASE}/reconciliation/${id}/status`,
        { status }
      );
      return response.data;
    } catch (error) {
      console.error('Inventory API reconciliation status update failed, using local fallback:', error);
      const reconciliations = loadLocalReconciliations();
      const updated = reconciliations.find((item) => item.id === id);
      if (!updated) {
        throw error;
      }
      const nextRecord = { ...updated, status: status as StockReconciliation['status'] };
      saveLocalReconciliations(reconciliations.map((item) => (item.id === id ? nextRecord : item)));
      return nextRecord;
    }
  }
};

// ============================================
// RETURN NOTES SERVICE
// ============================================

export const ReturnNotesService = {
  // Create return note
  async createReturnNote(data: {
    note_type: 'Supplier Return' | 'Customer Return';
    party_id: string;
    party_name?: string;
    reference_invoice?: string;
    return_date?: string;
    reason?: string;
  }): Promise<ReturnNote> {
    try {
      const response = await apiClient.post<{ data: ReturnNote }>(`${API_BASE}/returns`, data);
      return response.data;
    } catch (error) {
      console.error('Inventory API return note create failed, using local fallback:', error);
      const existing = loadLocalReturnNotes();
      const now = new Date().toISOString();
      const note: ReturnNote = {
        id: generateSequence('LOCAL-RET'),
        return_number: generateRunningNumber('RET', existing.length),
        note_type: data.note_type,
        status: 'Draft',
        party_name: data.party_name || data.party_id,
        return_date: data.return_date || now,
        total_qty: 0,
        total_value: 0,
        created_at: now
      };
      saveLocalReturnNotes([note, ...existing]);
      return note;
    }
  },

  // Get return notes
  async getReturnNotes(filters: {
    note_type?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ notes: ReturnNote[]; count: number }> {
    try {
      const params = new URLSearchParams();
      if (filters.note_type) params.append('note_type', filters.note_type);
      if (filters.status) params.append('status', filters.status);
      params.append('page', String(filters.page || 1));
      params.append('limit', String(filters.limit || 50));

      const response = await apiClient.get<{ data: ReturnNote[]; count: number }>(
        `${API_BASE}/returns?${params.toString()}`
      );

      return {
        notes: response.data || [],
        count: response.count || 0
      };
    } catch (error) {
      console.error('Inventory API return notes fetch failed, using local fallback:', error);
      const notes = loadLocalReturnNotes().filter((note) => {
        if (filters.note_type && note.note_type !== filters.note_type) return false;
        if (filters.status && note.status !== filters.status) return false;
        return true;
      });
      return { notes, count: notes.length };
    }
  },

  // Add item to return note
  async addReturnItem(
    returnNoteId: string,
    data: {
      product_id: string;
      batch_id?: string;
      qty_returned: number;
      mrp?: number;
      purchase_rate?: number;
      return_reason?: string;
      return_value?: number;
    }
  ): Promise<any> {
    try {
      const response = await apiClient.post(`${API_BASE}/returns/${returnNoteId}/items`, data);
      return response;
    } catch (error) {
      console.error('❌ Error adding return item:', error);
      throw error;
    }
  },

  // Update return note status
async updateReturnStatus(id: string, status: string): Promise<ReturnNote> {
    try {
      const response = await apiClient.put<{ data: ReturnNote }>(
        `${API_BASE}/returns/${id}/status`,
        { status }
      );
      return response.data;
    } catch (error) {
      console.error('Inventory API return note status update failed, using local fallback:', error);
      const notes = loadLocalReturnNotes();
      const updated = notes.find((note) => note.id === id);
      if (!updated) {
        throw error;
      }
      const next = { ...updated, status: status as ReturnNote['status'] };
      saveLocalReturnNotes(notes.map((note) => (note.id === id ? next : note)));
      return next;
    }
  }
};

export default {
  GodownService,
  StockLedgerService,
  StockReconciliationService,
  ReturnNotesService
};
