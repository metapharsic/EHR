// Database Service for ERP System
// This service provides integration with backend databases
// Updated for Strategic PCD Network with real PostgreSQL API

import { SalesInvoice, Product, Party, Purchase, PurchaseReturn, Expense, Batch, MedicalRepresentative, Lead, LeadActivity, Branch, StockTransfer, BranchStock, InventoryAnalyticsData, InventoryAnalyticsItem, PCDPartner, PCDScheme, PCDTarget, SaleTransaction } from '../types';
import { apiClient } from './apiClient';

const pcdApiHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('erp_token') || localStorage.getItem('accessToken') || localStorage.getItem('token') || '';
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
};

// --- PCD Field transformers --------------------------------------------------

const dbToPartner = (row: any): PCDPartner => ({
  id: row.id,
  name: row.name || '',
  territory: row.territory || '',
  contact: row.contact_number || row.contact || '',
  email: row.email || '',
  drugLicenseNo: row.drug_license_no || row.drugLicenseNo || '',
  status: row.status === 'ACTIVE' || row.status === 'Active' ? 'Active'
    : row.status === 'PENDING' || row.status === 'APPLIED' ? 'Pending'
    : 'Inactive',
  joinDate: (row.join_date || row.joinDate || '').toString().split('T')[0],
  assignedMrIds: row.assigned_mr_ids || row.assignedMrIds || [],
  state: row.state,
  district: row.district,
  contact_person: row.contact_person,
  partner_grade: row.partner_grade || 'BRONZE',
  credit_limit: parseFloat(row.credit_limit || 0),
  discount_percentage: parseFloat(row.discount_percentage || 0),
  total_business: parseFloat(row.total_business || 0),
} as PCDPartner);

const partnerToDb = (p: PCDPartner): Record<string, any> => ({
  name:               p.name,
  territory:          p.territory,
  contact_number:     p.contact,
  email:              p.email,
  drug_license_no:    p.drugLicenseNo,
  gst_registration:   (p as any).gst_registration || null,
  status:             (p.status as string) === 'Active' ? 'ACTIVE' : (p.status as string) === 'Pending' ? 'PENDING' : 'INACTIVE',
  join_date:          (p as any).joinDate || p.joinDate,
  assigned_mr_ids:    p.assignedMrIds || [],
  state:              (p as any).state,
  district:           (p as any).district,
  contact_person:     (p as any).contact_person,
  partner_grade:      (p as any).partner_grade || 'BRONZE',
  credit_limit:       (p as any).credit_limit,
  discount_percentage:(p as any).discount_percentage,
});

const dbToMR = (row: any): MedicalRepresentative => ({
  id: row.id,
  name: row.name || '',
  contact: row.contact || '',
  email: row.email || '',
  headquarters: row.headquarters || '',
  assignedArea: row.assigned_area || row.assignedArea || '',
  salesTarget: parseFloat(row.sales_target || row.salesTarget || 0),
  totalSales: parseFloat(row.total_sales || row.totalSales || 0),
  targetAchievement: parseFloat(row.target_achievement || row.targetAchievement || 0),
  status: (row.status || 'Active') as MedicalRepresentative['status'],
  joinDate: (row.join_date || row.joinDate || '').toString().split('T')[0],
  baseSalary: parseFloat(row.base_salary || row.baseSalary || 0),
  incentives: parseFloat(row.fixed_allowances || row.incentives || 0),
  deductions: parseFloat(row.deductions || 0),
});

const mrToDb = (mr: MedicalRepresentative): Record<string, any> => ({
  name:           mr.name,
  contact:        mr.contact,
  email:          mr.email,
  headquarters:   mr.headquarters,
  assigned_area:  mr.assignedArea,
  sales_target:   mr.salesTarget,
  base_salary:    mr.baseSalary || 0,
  fixed_allowances: mr.incentives || 0,
  status:         mr.status,
  join_date:      mr.joinDate,
});

const SCHEME_TYPE_MAP: Record<string, string> = {
  'VOLUME': 'Volume', 'DISCOUNT': 'Value', 'PRODUCT': 'Product',
  'INCENTIVE': 'Incentive', 'LOYALTY': 'Loyalty', 'WELCOME': 'Welcome',
};
const SCHEME_TYPE_REVERSE: Record<string, string> = {
  'Volume': 'VOLUME', 'Value': 'DISCOUNT', 'Product': 'PRODUCT',
  'Incentive': 'INCENTIVE', 'Loyalty': 'LOYALTY', 'Welcome': 'WELCOME',
};

const dbToScheme = (row: any): PCDScheme => ({
  id: row.id,
  name: row.name || '',
  description: row.description || '',
  validFrom: (row.validity_start || '').toString().split('T')[0],
  validUntil: (row.validity_end || row.validUntil || '').toString().split('T')[0],
  type: (SCHEME_TYPE_MAP[row.scheme_type] || row.scheme_type || 'Volume') as PCDScheme['type'],
  minimumOrder: parseFloat(row.minimum_order || 0),
  discountPercentage: parseFloat(row.discount_percentage || 0),
  freeProductsQty: parseInt(row.free_products_qty || 0),
  freeProducts: row.free_product_name || '',
  bonusCash: parseFloat(row.bonus_cash || 0),
  applicableGrades: row.applicable_partner_grades || '',
  status: row.status || 'ACTIVE',
  terms: row.terms || '',
  eligibilityCriteria: row.eligibility_criteria || '',
  bonusIncentives: row.bonus_incentives || '',
  targetProducts: row.target_products || '',
  schemeCode: row.scheme_code || '',
} as any);

const schemeToDb = (s: PCDScheme): Record<string, any> => ({
  name: s.name,
  description: s.description,
  scheme_type: SCHEME_TYPE_REVERSE[(s as any).type] || 'VOLUME',
  validity_start: (s as any).validFrom || null,
  validity_end: s.validUntil || null,
  minimum_order: s.minimumOrder || 0,
  discount_percentage: s.discountPercentage || 0,
  free_products_qty: (s as any).freeProductsQty || 0,
  free_product_name: s.freeProducts || null,
  bonus_cash: (s as any).bonusCash || 0,
  applicable_partner_grades: (s as any).applicableGrades || null,
  status: (s as any).status || 'ACTIVE',
  terms: s.terms || null,
  eligibility_criteria: s.eligibilityCriteria || null,
  bonus_incentives: s.bonusIncentives || null,
  target_products: s.targetProducts || null,
  scheme_code: s.schemeCode || null,
});

const dbToTarget = (row: any): PCDTarget => ({
  id: row.id,
  partnerId: row.partner_id || row.partnerId || '',
  partnerName: row.partner_name || row.partnerName || '',
  period: row.period || '',
  targetAmount: parseFloat(row.target_amount || row.targetAmount || 0),
  achievedAmount: parseFloat(row.achieved_amount || row.achievedAmount || 0),
  incentivePercentage: parseFloat(row.incentive_percentage || row.incentivePercentage || 0),
  status: (row.status === 'ACHIEVED' || row.status === 'EXCEEDED') ? 'Achieved' : row.status === 'FAILED' ? 'Failed' : 'Pending',
});

const parsePeriodDates = (period: string): { start: string; end: string } => {
  const str = (period || '').toUpperCase().trim();
  const yearMatch = str.match(/(\d{4})/);
  const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
  if (str.startsWith('Q1')) return { start: `${year}-01-01`, end: `${year}-03-31` };
  if (str.startsWith('Q2')) return { start: `${year}-04-01`, end: `${year}-06-30` };
  if (str.startsWith('Q3')) return { start: `${year}-07-01`, end: `${year}-09-30` };
  if (str.startsWith('Q4')) return { start: `${year}-10-01`, end: `${year}-12-31` };
  if (str.startsWith('H1')) return { start: `${year}-01-01`, end: `${year}-06-30` };
  if (str.startsWith('H2')) return { start: `${year}-07-01`, end: `${year}-12-31` };
  if (str.startsWith('FY')) return { start: `${year}-04-01`, end: `${year+1}-03-31` };
  return { start: `${year}-01-01`, end: `${year}-12-31` };
};

const targetToDb = (t: PCDTarget): Record<string, any> => {
  const dates = parsePeriodDates(t.period);
  return {
    partner_id:           t.partnerId,
    period:               t.period,
    period_start:         (t as any).period_start || dates.start,
    period_end:           (t as any).period_end   || dates.end,
    target_amount:        t.targetAmount,
    achieved_amount:      t.achievedAmount,
    incentive_percentage: t.incentivePercentage,
    status: t.status === 'Achieved' ? 'ACHIEVED' : t.status === 'Failed' ? 'FAILED' : 'IN_PROGRESS',
  };
};

const dbToTransaction = (row: any): SaleTransaction => ({
  id: row.id,
  mrId: row.mr_id || row.mrId || '',
  partnerId: row.partner_id || row.partnerId || '',
  date: (row.order_date || row.date || '').toString().split('T')[0],
  chemist: row.chemist || row.product_name || '',
  area: row.area || '',
  productName: row.product_name || row.productName || '',
  quantity: parseInt(row.quantity || 0),
  amount: parseFloat(row.order_amount || row.amount || 0),
  category: 'PCD',
  status: (row.order_status === 'DELIVERED' || row.order_status === 'VERIFIED') ? 'Verified' : 'Pending',       
} as any);

const txToDb = (t: SaleTransaction): Record<string, any> => ({
  partner_id:    (t as any).partnerId || null,
  mr_id:         t.mrId || null,
  order_date:    t.date,
  product_name:  t.productName,
  quantity:      t.quantity,
  order_amount:  t.amount,
  order_status:  t.status === 'Verified' ? 'DELIVERED' : 'PROCESSING',
  payment_status: 'UNPAID',
});

// --- API Operations (PCD) --------------------------------------------------

export const getAllPCDSchemes = async (): Promise<PCDScheme[]> => {
  try {
    const res = await apiClient.get<any[]>('/pcd/schemes');
    const data = (res as any).data || res;
    return Array.isArray(data) ? data.map(dbToScheme) : [];
  } catch { return []; }
};

export const savePCDScheme = async (scheme: PCDScheme): Promise<boolean> => {
  try {
    const isRealId = scheme.id && !scheme.id.startsWith('SCH-');
    const method = isRealId ? 'put' : 'post';
    const url = isRealId ? `/pcd/schemes/${scheme.id}` : '/pcd/schemes';
    const res = await apiClient[method](url, schemeToDb(scheme));
    return !!res.success;
  } catch { return false; }
};

export const deletePCDScheme = async (id: string): Promise<boolean> => {
  try {
    const res = await apiClient.delete(`/pcd/schemes/${id}`);
    return !!res.success;
  } catch { return false; }
};

export const getAllPCDTargets = async (): Promise<PCDTarget[]> => {
  try {
    const res = await apiClient.get<any[]>('/pcd/targets');
    const data = (res as any).data || res;
    return Array.isArray(data) ? data.map(dbToTarget) : [];
  } catch { return []; }
};

export const savePCDTarget = async (target: PCDTarget): Promise<boolean> => {
  try {
    const isRealId = target.id && !target.id.toString().startsWith('TGT-');
    const method = isRealId ? 'put' : 'post';
    const url = isRealId ? `/pcd/targets/${target.id}` : '/pcd/targets';
    const res = await apiClient[method](url, targetToDb(target));
    return !!res.success;
  } catch { return false; }
};

export const deletePCDTarget = async (id: string): Promise<boolean> => {
  try {
    const res = await apiClient.delete(`/pcd/targets/${id}`);
    return !!res.success;
  } catch { return false; }
};

export const getAllPCDPartners = async (): Promise<PCDPartner[]> => {
  try {
    const res = await apiClient.get<any[]>('/pcd/partners?limit=1000');
    const data = (res as any).data || res;
    return Array.isArray(data) ? data.map(dbToPartner) : [];
  } catch { return []; }
};

export const savePCDPartner = async (partner: PCDPartner): Promise<boolean> => {
  try {
    const isRealId = partner.id && !partner.id.startsWith('PCD-');
    const method = isRealId ? 'put' : 'post';
    const url = isRealId ? `/pcd/partners/${partner.id}` : '/pcd/partners';
    const res = await apiClient[method](url, partnerToDb(partner));
    return !!res.success;
  } catch { return false; }
};

export const getAllMedicalRepresentatives = async (): Promise<MedicalRepresentative[]> => {
  try {
    const res = await apiClient.get<any[]>('/pcd/mrs');
    const data = (res as any).data || res;
    return Array.isArray(data) ? data.map(dbToMR) : [];
  } catch { return []; }
};

export const saveMedicalRepresentative = async (mr: MedicalRepresentative): Promise<boolean> => {
  try {
    const isRealId = mr.id && !mr.id.startsWith('MR-');
    const method = isRealId ? 'put' : 'post';
    const url = isRealId ? `/pcd/mrs/${mr.id}` : '/pcd/mrs';
    const res = await apiClient[method](url, mrToDb(mr));
    return !!res.success;
  } catch { return false; }
};

export const getAllPCDTransactions = async (): Promise<SaleTransaction[]> => {
  try {
    const res = await apiClient.get<any[]>('/pcd/transactions');
    const data = (res as any).data || res;
    return Array.isArray(data) ? data.map(dbToTransaction) : [];
  } catch { return []; }
};


export const savePCDTransaction = async (transaction: SaleTransaction): Promise<boolean> => {
  try {
    const res = await apiClient.post('/pcd/transactions', txToDb(transaction));
    return !!res.success;
  } catch { return false; }
};

// Fallback for missing methods used in App.tsx
export const getAllParties = async (): Promise<Party[]> => {
  try {
    const r = await apiClient.get('/parties');
    return r.success ? r.data : (Array.isArray(r) ? r : []);
  } catch { return []; }
};

export const saveParty = async (party: Party): Promise<boolean> => {
  try {
    const r = await apiClient.post('/parties', party);
    return !!r.success;
  } catch { return false; }
};

export const getAllEmployees = async (): Promise<MedicalRepresentative[]> => {
  return getAllMedicalRepresentatives();
};


export const deleteProduct = async (id: string): Promise<boolean> => {
  try {
    const response = await fetch('/api/products/' + id, { method: 'DELETE' });
    return true;
  } catch (error) { return false; }
};

export const deleteInvoice = async (id: string): Promise<boolean> => {
  try {
    const response = await fetch('/api/invoices/' + id, { method: 'DELETE' });
    return true;
  } catch (error) { return false; }
};

// deletePCDScheme — moved to PCD API section

// deletePCDTarget — moved to PCD API section

export const deleteMedicalRepresentative = async (id: string): Promise<boolean> => {
  try {
    await apiClient.delete('/employees/' + id);
    return true;
  } catch (error) { return false; }
};

export const getAllTasks = async (): Promise<any[]> => {
  try {
    const data = await apiClient.get('/tasks');
    return data.data || data || [];
  } catch (error) {
    console.warn('Backend API not available, falling back to local storage');
  }
  return JSON.parse(localStorage.getItem('erp_tasks') || '[]');
};

export const saveTask = async (task: any): Promise<boolean> => {
  try {
    const tasks = JSON.parse(localStorage.getItem('erp_tasks') || '[]');
    const existingIndex = tasks.findIndex((t: any) => t.id === task.id);
    if (existingIndex !== -1) {
      tasks[existingIndex] = task;
    } else {
      tasks.push(task);
    }
    localStorage.setItem('erp_tasks', JSON.stringify(tasks));

    await apiClient.post('/tasks', task);
    return true;
  } catch (error) {
    console.error('Error saving task:', error);
    return false;
  }
};

export const deleteTask = async (taskId: string): Promise<boolean> => {
  try {
    const tasks = JSON.parse(localStorage.getItem('erp_tasks') || '[]');
    const filteredTasks = tasks.filter((t: any) => t.id !== taskId);
    localStorage.setItem('erp_tasks', JSON.stringify(filteredTasks));

    await apiClient.delete('/tasks/' + taskId);
    return true;
  } catch (error) {
    console.error('Error deleting task:', error);
    return false;
  }
};

// Compatibility stub — data now initialized via API/DB
export const initializeSampleData = async (): Promise<void> => { /* no-op: data seeded in PostgreSQL */ };
/**
 * getEmployeePerformanceStats
 * Fetches aggregated KPIs from the MR-specific stats endpoint so the
 * Dashboard leaderboard and the stats banner stay in sync with the same
 * medical_representatives + pcd_transactions data source.
 */
export const getEmployeePerformanceStats = async (): Promise<any> => {
  try {
    const token = localStorage.getItem('erp_token') || localStorage.getItem('accessToken') || '';
    const r = await fetch('/api/pcd/mrs/stats', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const d = await r.json();
    return d.data || {};
  } catch {
    return {};
  }
};


export const getAllInvoices = async (): Promise<SalesInvoice[]> => {
  try {
    const r = await fetch('/api/pos/invoices', { headers: { Authorization: 'Bearer ' + (localStorage.getItem('accessToken') || '') } });
    const d = await r.json();
    return Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : [];
  } catch { return []; }
};

export const getInvoiceById = async (id: string): Promise<SalesInvoice | null> => {
  try {
    const r = await fetch('/api/pos/invoices/' + id, { headers: { Authorization: 'Bearer ' + (localStorage.getItem('accessToken') || '') } });
    const d = await r.json();
    return d.data || d || null;
  } catch { return null; }
};


export const getAllProducts = async (): Promise<Product[]> => {
  try {
    const r = await fetch('/api/pos/products', { headers: { Authorization: 'Bearer ' + (localStorage.getItem('accessToken') || '') } });
    const d = await r.json();
    return Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : [];
  } catch { return []; }
};

export const saveProduct = async (product: Partial<Product>): Promise<boolean> => {
  try {
    const method = (product as any).id ? 'PUT' : 'POST';
    const url = (product as any).id ? '/api/products/' + (product as any).id : '/api/products';
    await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('accessToken') || '') }, body: JSON.stringify(product) });
    return true;
  } catch { return false; }
};



export const deleteParty = async (id: string): Promise<boolean> => {
  try {
    await fetch('/api/pos/parties/' + id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + (localStorage.getItem('accessToken') || '') } });
    return true;
  } catch { return false; }
};

export interface Godown {
  id: string;
  name: string;
  address: string;
  manager_id?: string;
  is_default: boolean;
  status: string;
  created_at: string;
}

export const getAllGodowns = async (): Promise<Godown[]> => {
  try {
    const r = await fetch('/api/inventory/godowns', { headers: { Authorization: 'Bearer ' + (localStorage.getItem('accessToken') || '') } });
    const d = await r.json();
    return Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : [];
  } catch { return []; }
};

export const createGodown = async (godown: Partial<Godown>): Promise<boolean> => {
  try {
    const response = await fetch('/api/inventory/godowns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('accessToken') || '') },
      body: JSON.stringify(godown)
    });
    return response.ok;
  } catch { return false; }
};

export const updateGodown = async (id: string, godown: Partial<Godown>): Promise<boolean> => {
  try {
    const response = await fetch('/api/inventory/godowns/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('accessToken') || '') },
      body: JSON.stringify(godown)
    });
    return response.ok;
  } catch { return false; }
};

export const deleteGodown = async (id: string): Promise<boolean> => {
  try {
    const response = await fetch('/api/inventory/godowns/' + id, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('accessToken') || '') }
    });
    return response.ok;
  } catch { return false; }
};

export const initializeGodownSampleData = async (): Promise<void> => { /* data seeded in PostgreSQL */ };

export const getAllPurchases = async (): Promise<any[]> => {
  try {
    const r = await fetch('/api/purchase', { headers: { Authorization: 'Bearer ' + (localStorage.getItem('accessToken') || '') } });
    const d = await r.json();
    return Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : [];
  } catch { return []; }
};

export const saveInvoice = async (invoice: any): Promise<boolean> => {
  try {
    const method = invoice.id ? 'PUT' : 'POST';
    const url = invoice.id ? '/api/pos/invoices/' + invoice.id : '/api/pos/invoices';
    await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('accessToken') || '') }, body: JSON.stringify(invoice) });
    return true;
  } catch { return false; }
};

export const savePurchase = async (purchase: any): Promise<boolean> => {
  try {
    const method = purchase.id ? 'PUT' : 'POST';
    const url = purchase.id ? '/api/purchase/' + purchase.id : '/api/purchase';
    await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('accessToken') || '') }, body: JSON.stringify(purchase) });
    return true;
  } catch { return false; }
};

export const searchProducts = async (query: string): Promise<any[]> => {
  try {
    const r = await fetch('/api/pos/products?q=' + encodeURIComponent(query), { headers: { Authorization: 'Bearer ' + (localStorage.getItem('accessToken') || '') } });
    const d = await r.json();
    return Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : [];
  } catch { return []; }
};

export const getAllVoucherTypes = async (): Promise<any[]> => {
  try {
    const r = await fetch('/api/pos/voucher-types', { headers: { Authorization: 'Bearer ' + (localStorage.getItem('accessToken') || '') } });
    const d = await r.json();
    return Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : [];
  } catch { return []; }
};

export const saveVoucherType = async (vt: any): Promise<boolean> => {
  try {
    const method = vt.id ? 'PUT' : 'POST';
    const url = vt.id ? '/api/vouchers/types/' + vt.id : '/api/vouchers/types';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('accessToken') || '') }, body: JSON.stringify(vt) });
    return res.ok;
  } catch { return false; }
};

// --- STOCK JOURNALS, RECONCILIATIONS, TRANSFERS, AND BRANCHES ---

export const getAllStockJournals = async (): Promise<any[]> => {
  try {
    const r = await fetch('/api/inventory/stock-journals', { headers: { Authorization: 'Bearer ' + (localStorage.getItem('accessToken') || '') } });
    const d = await r.json();
    return Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : [];
  } catch { return []; }
};

export const getAllPhysicalStocks = async (): Promise<any[]> => {
  try {
    const r = await fetch('/api/inventory/reconciliations', { headers: { Authorization: 'Bearer ' + (localStorage.getItem('accessToken') || '') } });
    const d = await r.json();
    return Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : [];
  } catch { return []; }
};

export const getAllBranches = async (): Promise<any[]> => {
  try {
    const r = await fetch('/api/inventory-enterprise/branches', { headers: { Authorization: 'Bearer ' + (localStorage.getItem('accessToken') || '') } });
    const d = await r.json();
    return Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : [];
  } catch { return []; }
};

export const getAllStockTransfers = async (): Promise<any[]> => {
  try {
    const r = await fetch('/api/inventory/stock-transfers', { headers: { Authorization: 'Bearer ' + (localStorage.getItem('accessToken') || '') } });
    const d = await r.json();
    return Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : [];
  } catch { return []; }
};

export const saveStockJournal = async (sj: any): Promise<boolean> => {
  try {
    const method = 'POST';
    const url = '/api/inventory/stock-journals';
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + (localStorage.getItem('accessToken') || '')
      },
      body: JSON.stringify(sj)
    });
    return response.ok;
  } catch { return false; }
};

export const savePhysicalStock = async (ps: any): Promise<boolean> => {
  try {
    const method = 'POST';
    const url = '/api/inventory/reconciliations';
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + (localStorage.getItem('accessToken') || '')
      },
      body: JSON.stringify(ps)
    });
    return response.ok;
  } catch { return false; }
};

export const saveStockTransfer = async (st: any): Promise<boolean> => {
  try {
    const method = 'POST';
    const url = '/api/inventory/stock-transfers';
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + (localStorage.getItem('accessToken') || '')
      },
      body: JSON.stringify(st)
    });
    return response.ok;
  } catch { return false; }
};
