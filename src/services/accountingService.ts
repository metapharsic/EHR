/**
 * Comprehensive Accounting Service - Tally ERP Like Features
 * Handles Chart of Accounts, GL, Journal Vouchers, Trial Balance, P&L, Balance Sheet, etc.
 */

import {
  ChartOfAccount,
  GeneralLedgerEntry,
  JournalVoucher,
  TrialBalanceEntry,
  BalanceSheetReport,
  ProfitLossReport,
  CostCenter,
  BudgetMaster,
  BankReconciliation,
  TDSEntry,
  EInvoice,
  AgingAnalysis,
  AuditEntry
} from '../types';

// ============================================
// HELPER: GET AUTH HEADERS
// ============================================
const getAuthHeaders = () => {
  const token = localStorage.getItem('accessToken');
  console.log('🔐 getAuthHeaders - Token exists:', !!token);
  if (token) {
    console.log('🔐 Token first 20 chars:', token.substring(0, 20) + '...');
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};

// ============================================
// HELPER: CONVERT SNAKE_CASE TO CAMEL_CASE
// ============================================
const toCamelCase = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(item => toCamelCase(item));
  }
  
  if (obj !== null && typeof obj === 'object') {
    const camelCased: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      camelCased[camelKey] = toCamelCase(value);
    }
    return camelCased;
  }
  
  return obj;
};

// ============================================
// HELPER: VALIDATE AND TRANSFORM DATA
// ============================================
const validateAndTransform = (rawData: any, context: string): any => {
  try {
    if (!rawData) {
      console.warn('⚠️ No data received in', context);
      return Array.isArray(rawData) ? [] : {};
    }
    const transformed = toCamelCase(rawData);
    console.log(`✅ Validated & transformed ${context}:`, typeof transformed);
    return transformed;
  } catch (error) {
    console.error(`❌ Error transforming ${context}:`, error);
    return Array.isArray(rawData) ? [] : {};
  }
};

// ============================================
// CHART OF ACCOUNTS MANAGEMENT
// ============================================

export const ChartOfAccountsService = {
  /**
   * Create new account
   */
  createAccount: async (account: Omit<ChartOfAccount, 'id' | 'createdAt'>) => {
    try {
      console.log('🔍 ChartOfAccountsService.createAccount() - Sending:', account);
      const response = await fetch('/api/accounting/chart-of-accounts', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(account)
      });
      
      console.log('📡 Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);
        
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || errorText);
        } catch {
          throw new Error(`HTTP ${response.status}: ${errorText || 'Unknown error'}`);
        }
      }
      
      const data = await response.json();
      console.log('✅ Account created, response:', data);
      return data;
    } catch (error) {
      console.error('❌ Error creating account:', error);
      throw error;
    }
  },

  /**
   * Get all accounts with hierarchical structure
   */
  getAllAccounts: async () => {
    try {
      console.log('📡 ChartOfAccountsService.getAllAccounts() - Starting API call to /api/accounting/chart-of-accounts');
      const headers = getAuthHeaders();
      console.log('📡 Headers:', { 
        'Content-Type': headers['Content-Type'],
        'Authorization': headers['Authorization'] ? '✅ Present' : '❌ Missing'
      });
      
      const response = await fetch('/api/accounting/chart-of-accounts', {
        headers: headers
      });
      
      console.log('📡 API Response Status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const rawData = await response.json();
      console.log('📦 Raw API data received:', Array.isArray(rawData) ? `${rawData.length} items` : 'object');
      const data = validateAndTransform(rawData, 'Chart of Accounts');
      console.log('✅ ChartOfAccountsService.getAllAccounts() - Success! Returning', data.length, 'accounts');
      return data;
    } catch (error) {
      console.error('❌ Error in ChartOfAccountsService.getAllAccounts():', error);
      throw error;
    }
  },

  /**
   * Get accounts by type (Assets, Liabilities, Income, Expense, Equity)
   */
  getAccountsByType: async (accountType: string) => {
    try {
      const response = await fetch(`/api/accounting/chart-of-accounts?type=${accountType}`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch accounts');
      return await response.json();
    } catch (error) {
      console.error('Error fetching accounts by type:', error);
      throw error;
    }
  },

  /**
   * Get account with balance
   */
  getAccountWithBalance: async (accountId: string, asOnDate: string) => {
    try {
      const response = await fetch(
        `/api/accounting/chart-of-accounts/${accountId}?asOnDate=${asOnDate}`,
        {
          headers: getAuthHeaders()
        }
      );
      if (!response.ok) throw new Error('Failed to fetch account');
      return await response.json();
    } catch (error) {
      console.error('Error fetching account:', error);
      throw error;
    }
  },

  /**
   * Update account details
   */
  updateAccount: async (accountId: string, updates: Partial<ChartOfAccount>) => {
    try {
      const response = await fetch(`/api/accounting/chart-of-accounts/${accountId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates)
      });
      if (!response.ok) throw new Error('Failed to update account');
      return await response.json();
    } catch (error) {
      console.error('Error updating account:', error);
      throw error;
    }
  }
};

// ============================================
// JOURNAL VOUCHER MANAGEMENT
// ============================================

export const JournalVoucherService = {
  /**
   * Create new journal voucher
   */
  createJournalVoucher: async (voucher: Omit<JournalVoucher, 'id' | 'createdAt'>) => {
    try {
      // Validate debit = credit
      if (voucher.totalDebit !== voucher.totalCredit) {
        throw new Error('Debit and Credit must be equal');
      }

      const response = await fetch('/api/accounting/journal-vouchers', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(voucher)
      });
      if (!response.ok) throw new Error('Failed to create journal voucher');
      return await response.json();
    } catch (error) {
      console.error('Error creating journal voucher:', error);
      throw error;
    }
  },

  /**
   * Get all journal vouchers
   */
  getAllJournalVouchers: async (filters?: {
    dateFrom?: string;
    dateTo?: string;
    status?: string;
    costCenter?: string;
  }) => {
    try {
      const params = new URLSearchParams();
      if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters?.dateTo) params.append('dateTo', filters.dateTo);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.costCenter) params.append('costCenter', filters.costCenter);

      const url = `/api/accounting/journal-vouchers?${params.toString()}`;
      console.log('📡 JournalVoucherService.getAllJournalVouchers() - API call to:', url);

      const response = await fetch(url, { 
        headers: getAuthHeaders() 
      });
      
      console.log('📡 API Response Status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const rawData = await response.json();
      console.log('📦 Raw API data received:', Array.isArray(rawData) ? `${rawData.length} items` : typeof rawData, rawData);
      
      // Handle both array and object responses
      let data: any[];
      if (Array.isArray(rawData)) {
        data = rawData;
      } else if (rawData?.value && Array.isArray(rawData.value)) {
        data = rawData.value;
      } else if (rawData?.rows && Array.isArray(rawData.rows)) {
        data = rawData.rows;
      } else {
        console.warn('⚠️ Unexpected response format:', rawData);
        data = [];
      }
      
      const transformed = toCamelCase(data);
      console.log('✅ JournalVoucherService.getAllJournalVouchers() - Success! Returning', transformed.length, 'vouchers');
      return transformed;
    } catch (error) {
      console.error('❌ Error in JournalVoucherService.getAllJournalVouchers():', error);
      throw error;
    }
  },

  /**
   * Post journal voucher (approve and create GL entries)
   */
  postJournalVoucher: async (voucherId: string) => {
    try {
      const response = await fetch(
        `/api/accounting/journal-vouchers/${voucherId}/post`,
        {
          method: 'POST',
          headers: getAuthHeaders()
        }
      );
      if (!response.ok) throw new Error('Failed to post journal voucher');
      return await response.json();
    } catch (error) {
      console.error('Error posting journal voucher:', error);
      throw error;
    }
  },

  /**
   * Reverse journal voucher (create reversal entry)
   */
  reverseJournalVoucher: async (voucherId: string, reason: string) => {
    try {
      const response = await fetch(
        `/api/accounting/journal-vouchers/${voucherId}/reverse`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ reason })
        }
      );
      if (!response.ok) throw new Error('Failed to reverse journal voucher');
      return await response.json();
    } catch (error) {
      console.error('Error reversing journal voucher:', error);
      throw error;
    }
  }
};

// ============================================
// GENERAL LEDGER MANAGEMENT
// ============================================

export const GeneralLedgerService = {
  /**
   * Get GL entries for an account
   */
  getAccountLedger: async (
    accountId: string,
    options?: {
      dateFrom?: string;
      dateTo?: string;
      costCenter?: string;
      voucherType?: string;
    }
  ) => {
    try {
      const params = new URLSearchParams();
      if (options?.dateFrom) params.append('dateFrom', options.dateFrom);
      if (options?.dateTo) params.append('dateTo', options.dateTo);
      if (options?.costCenter) params.append('costCenter', options.costCenter);
      if (options?.voucherType) params.append('voucherType', options.voucherType);

      const response = await fetch(
        `/api/accounting/general-ledger/${accountId}?${params.toString()}`,
        { headers: getAuthHeaders() }
      );
      if (!response.ok) throw new Error('Failed to fetch GL entries');
      return await response.json();
    } catch (error) {
      console.error('Error fetching GL entries:', error);
      throw error;
    }
  },

  /**
   * Get GL entries with filters
   */
  getGLEntries: async (filters: {
    dateFrom: string;
    dateTo: string;
    accountIds?: string[];
    voucherType?: string;
    costCenter?: string;
  }) => {
    try {
      const response = await fetch('/api/accounting/general-ledger', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(filters)
      });
      if (!response.ok) throw new Error('Failed to fetch GL entries');
      return await response.json();
    } catch (error) {
      console.error('Error fetching GL entries:', error);
      throw error;
    }
  },

  /**
   * Reconcile GL entry (mark as reconciled)
   */
  reconcileEntry: async (entryId: string, reconcilationDetails?: any) => {
    try {
      const response = await fetch(
        `/api/accounting/general-ledger/${entryId}/reconcile`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(reconcilationDetails)
        }
      );
      if (!response.ok) throw new Error('Failed to reconcile entry');
      return await response.json();
    } catch (error) {
      console.error('Error reconciling entry:', error);
      throw error;
    }
  }
};

// ============================================
// TRIAL BALANCE
// ============================================

export const TrialBalanceService = {
  /**
   * Generate trial balance for a period
   */
  generateTrialBalance: async (
    asOnDate: string,
    showZeroBalance: boolean = false
  ): Promise<any> => {
    try {
      console.log('📡 TrialBalanceService.generateTrialBalance() - Generating for date:', asOnDate);
      const response = await fetch('/api/accounting/trial-balance', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ asOnDate, showZeroBalance, startDate: '2024-04-01' }) // Default FY start
      });
      if (!response.ok) throw new Error('Failed to generate trial balance');
      const rawData = await response.json();
      const data = toCamelCase(rawData);
      console.log('✅ Trial balance generated:', data);
      return data; // returns { entries, totalDebit, totalCredit, isBalanced }
    } catch (error) {
      console.error('Error generating trial balance:', error);
      throw error;
    }
  },

  /**
   * Validate trial balance (Debit = Credit)
   */
  validateTrialBalance: async (
    trialBalance: TrialBalanceEntry[]
  ): Promise<{
    isBalanced: boolean;
    totalDebit: number;
    totalCredit: number;
    difference: number;
  }> => {
    const totalDebit = trialBalance.reduce((sum, entry) => sum + entry.debit, 0);
    const totalCredit = trialBalance.reduce((sum, entry) => sum + entry.credit, 0);
    const difference = Math.abs(totalDebit - totalCredit);

    return {
      isBalanced: difference < 0.01, // Allow for rounding
      totalDebit,
      totalCredit,
      difference
    };
  },

  /**
   * Export trial balance
   */
  exportTrialBalance: async (
    trialBalance: TrialBalanceEntry[],
    format: 'PDF' | 'Excel' = 'Excel'
  ) => {
    try {
      const response = await fetch('/api/accounting/trial-balance/export', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ trialBalance, format })
      });
      if (!response.ok) throw new Error('Failed to export trial balance');
      return await response.blob();
    } catch (error) {
      console.error('Error exporting trial balance:', error);
      throw error;
    }
  }
};

// ============================================
// BALANCE SHEET
// ============================================

export const BalanceSheetService = {
  /**
   * Generate balance sheet
   */
  generateBalanceSheet: async (
    asOnDate: string,
    comparePreviousYear: boolean = false
  ): Promise<any> => {
    try {
      console.log('📡 BalanceSheetService.generateBalanceSheet() - Generating for date:', asOnDate);
      const response = await fetch('/api/accounting/balance-sheet', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ asOnDate, comparePreviousYear })
      });
      if (!response.ok) throw new Error('Failed to generate balance sheet');
      const rawData = await response.json();
      
      // The backend now returns { assets: { total, groups: { name: { total, accounts: [] } } }, liabilities, equity }
      // We'll transform this into the hierarchy the UI expects
      const data = toCamelCase(rawData);
      
      const mapGroupsToTree = (reportSection: any) => {
        if (!reportSection || !reportSection.groups) return { subtotal: 0, items: [] };
        return {
          subtotal: reportSection.total,
          items: Object.entries(reportSection.groups).map(([groupName, groupData]: [string, any]) => ({
            name: groupName,
            amount: groupData.total,
            children: (groupData.accounts || []).map((acc: any) => ({
              name: acc.accountName,
              amount: parseFloat(acc.balance)
            }))
          }))
        };
      };

      const finalReport = {
        totalAssets: data.assets?.total || 0,
        totalLiabilities: data.liabilities?.total || 0,
        totalEquity: data.equity?.total || 0,
        assets: mapGroupsToTree(data.assets),
        liabilities: mapGroupsToTree(data.liabilities),
        equity: mapGroupsToTree(data.equity)
      };

      console.log('✅ Balance sheet mapped successfully');
      return finalReport;
    } catch (error) {
      console.error('Error generating balance sheet:', error);
      throw error;
    }
  },

  /**
   * Validate balance sheet (Assets = Liabilities + Equity)
   */
  validateBalanceSheet: async (
    balanceSheet: BalanceSheetReport
  ): Promise<{
    isBalanced: boolean;
    totalAssets: number;
    totalLiabilitiesAndEquity: number;
    difference: number;
  }> => {
    const totalAssets = balanceSheet.totalAssets || 0;
    const totalLiabilitiesAndEquity =
      (balanceSheet.totalLiabilities || 0) + (balanceSheet.totalEquity || 0);
    const difference = Math.abs(totalAssets - totalLiabilitiesAndEquity);

    return {
      isBalanced: difference < 0.01,
      totalAssets,
      totalLiabilitiesAndEquity,
      difference
    };
  }
};

// ============================================
// PROFIT & LOSS STATEMENT
// ============================================

export const ProfitLossService = {
  /**
   * Generate P&L statement
   */
  generateProfitLoss: async (
    periodStart: string,
    periodEnd: string,
    comparePreviousPeriod: boolean = false
  ): Promise<any> => {
    try {
      console.log('📡 ProfitLossService.generateProfitLoss() - Generating for period:', periodStart, 'to', periodEnd);
      const response = await fetch('/api/accounting/profit-loss', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          startDate: periodStart,
          endDate: periodEnd,
          comparePreviousPeriod
        })
      });
      if (!response.ok) throw new Error('Failed to generate P&L');
      const rawData = await response.json();
      const data = toCamelCase(rawData);

      const mapGroupsToTree = (reportSection: any) => {
        if (!reportSection || !reportSection.groups) return { subtotal: 0, items: [] };
        return {
          subtotal: reportSection.total || 0,
          items: Object.entries(reportSection.groups).map(([groupName, groupData]: [string, any]) => ({
            name: groupName,
            amount: groupData.total || 0,
            children: (groupData.accounts || []).map((acc: any) => ({
              name: acc.accountName,
              amount: parseFloat(acc.amount || acc.balance || 0)
            }))
          }))
        };
      };

      const finalReport = {
        income: mapGroupsToTree(data.income),
        expenses: mapGroupsToTree(data.expense || data.expenses), // Handle both
        grossProfit: data.grossProfit || 0,
        netProfitAfterTax: data.netProfit || 0,
        operatingIncome: data.netProfit || 0
      };

      console.log('✅ P&L statement generated successfully');
      return finalReport;
    } catch (error) {
      console.error('Error generating P&L:', error);
      throw error;
    }
  },

  /**
   * Calculate key financial ratios
   */
  calculateRatios: async (
    profitLoss: ProfitLossReport,
    balanceSheet: BalanceSheetReport
  ): Promise<{
    profitMargin: number;
    operatingMargin: number;
    returnOnAssets: number;
    returnOnEquity: number;
    currentRatio?: number;
    quickRatio?: number;
    debtToEquity?: number;
  }> => {
    const revenue = profitLoss.revenue.subtotal || 1; // Avoid division by zero

    return {
      profitMargin: (profitLoss.netProfitAfterTax / revenue) * 100,
      operatingMargin: (profitLoss.operatingIncome / revenue) * 100,
      returnOnAssets: (profitLoss.netProfitAfterTax / balanceSheet.totalAssets) * 100,
      returnOnEquity:
        (profitLoss.netProfitAfterTax / balanceSheet.totalEquity) * 100,
      currentRatio: balanceSheet.assets.currentItems.length
        ? balanceSheet.assets.subtotal / balanceSheet.liabilities.subtotal
        : undefined,
      debtToEquity: balanceSheet.totalLiabilities / balanceSheet.totalEquity
    };
  }
};

// ============================================
// CASH FLOW SERVICE
// ============================================
export const CashFlowService = {
  getStatement: async (startDate: string, endDate: string) => {
    try {
      const response = await fetch('/api/accounting/cash-flow', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ startDate, endDate })
      });
      if (!response.ok) throw new Error('Failed to fetch cash flow');
      const rawData = await response.json();
      return toCamelCase(rawData);
    } catch (error) {
      console.error('Error in CashFlowService:', error);
      throw error;
    }
  }
};

// ============================================
// BANK RECONCILIATION
// ============================================

export const BankReconciliationService = {
  /**
   * Create bank reconciliation
   */
  createReconciliation: async (
    reconciliation: Omit<BankReconciliation, 'id' | 'createdAt'>
  ) => {
    try {
      const response = await fetch('/api/accounting/advanced/bank-reconciliation', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(reconciliation)
      });
      if (!response.ok) throw new Error('Failed to create reconciliation');
      return await response.json();
    } catch (error) {
      console.error('Error creating reconciliation:', error);
      throw error;
    }
  },

  /**
   * Get bank reconcilations for account
   */
  getReconciliations: async (bankAccountId: string) => {
    try {
      const response = await fetch(
        `/api/accounting/advanced/bank-reconciliation?bankAccountId=${bankAccountId}`,
        { headers: getAuthHeaders() }
      );
      if (!response.ok) throw new Error('Failed to fetch reconciliations');
      return await response.json();
    } catch (error) {
      console.error('Error fetching reconciliations:', error);
      throw error;
    }
  }
};

// ============================================
// AGING ANALYSIS (Receivables/Payables)
// ============================================

export const AgingAnalysisService = {
  /**
   * Get aging analysis for debtors/creditors
   */
  getAgingAnalysis: async (
    asOnDate: string,
    partyType: 'Debtor' | 'Creditor'
  ): Promise<any[]> => {
    try {
      const response = await fetch('/api/accounting/aging-analysis', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ asOnDate, type: partyType })
      });
      if (!response.ok) throw new Error('Failed to get aging analysis');
      const rawData = await response.json();
      
      // Backend returns { summary, data: [{ party_name, balance_amount, bucket }] }
      // The UI expects { name, current_balance, bucket_0_30, bucket_31_60, ... }
      const items = rawData.data || [];
      const partyMap: Record<string, any> = {};

      items.forEach((item: any) => {
        const name = item.party_name;
        if (!partyMap[name]) {
          partyMap[name] = {
            id: name,
            name: name,
            current_balance: 0,
            bucket_0_30: 0,
            bucket_31_60: 0,
            bucket_61_90: 0,
            bucket_90_plus: 0
          };
        }
        const val = parseFloat(item.balance_amount);
        partyMap[name].current_balance += val;
        
        if (item.bucket === '0-30 Days') partyMap[name].bucket_0_30 += val;
        else if (item.bucket === '31-60 Days') partyMap[name].bucket_31_60 += val;
        else if (item.bucket === '61-90 Days') partyMap[name].bucket_61_90 += val;
        else if (item.bucket === '90+ Days') partyMap[name].bucket_90_plus += val;
      });

      return Object.values(partyMap);
    } catch (error) {
      console.error('Error getting aging analysis:', error);
      throw error;
    }
  },

  /**
   * Generate dunning letter for overdue invoices
   */
  generateDunningLetter: async (partyId: string, invoiceIds: string[]) => {
    try {
      const response = await fetch('/api/accounting/dunning-letter', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ partyId, invoiceIds })
      });
      if (!response.ok) throw new Error('Failed to generate dunning letter');
      return await response.blob();
    } catch (error) {
      console.error('Error generating dunning letter:', error);
      throw error;
    }
  }
};

// ============================================
// BUDGET VS ACTUAL
// ============================================

export const BudgetService = {
  /**
   * Get all budgets
   */
  getBudgets: async () => {
    try {
      const response = await fetch('/api/accounting/advanced/budgets', { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch budgets');
      return await response.json();
    } catch (error) {
      console.error('Error getting budgets:', error);
      throw error;
    }
  },

  /**
   * Create budget
   */
  createBudget: async (budget: Omit<BudgetMaster, 'id' | 'createdAt'>) => {
    try {
      const response = await fetch('/api/accounting/advanced/budgets', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(budget)
      });
      if (!response.ok) throw new Error('Failed to create budget');
      return await response.json();
    } catch (error) {
      console.error('Error creating budget:', error);
      throw error;
    }
  },

  /**
   * Get budget vs actual analysis
   */
  getBudgetAnalysis: async (budgetId: string) => {
    try {
      const response = await fetch(`/api/accounting/budget/${budgetId}/analysis`, { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to get budget analysis');
      return await response.json();
    } catch (error) {
      console.error('Error getting budget analysis:', error);
      throw error;
    }
  }
};

// ============================================
// AUDIT TRAIL
// ============================================

export const AuditService = {
  /**
   * Get all audit logs
   */
  getAllLogs: async () => {
    try {
      const response = await fetch('/api/accounting/audit-logs', { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch audit logs');
      return await response.json();
    } catch (error) {
      console.error('Error getting audit logs:', error);
      throw error;
    }
  },

  /**
   * Get audit trail for transaction
   */
  getAuditTrail: async (
    voucherId: string,
    voucherType?: string
  ): Promise<AuditEntry[]> => {
    try {
      const params = new URLSearchParams();
      params.append('voucherId', voucherId);
      if (voucherType) params.append('voucherType', voucherType);

      const response = await fetch(`/api/accounting/audit-trail?${params.toString()}`, { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to get audit trail');
      return await response.json();
    } catch (error) {
      console.error('Error getting audit trail:', error);
      throw error;
    }
  },

  /**
   * Export audit trail report
   */
  exportAuditTrail: async (
    dateFrom: string,
    dateTo: string,
    filters?: { user?: string; action?: string; module?: string }
  ) => {
    try {
      const response = await fetch('/api/accounting/audit-trail/export', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ dateFrom, dateTo, filters })
      });
      if (!response.ok) throw new Error('Failed to export audit trail');
      return await response.blob();
    } catch (error) {
      console.error('Error exporting audit trail:', error);
      throw error;
    }
  }
};

// ============================================
// COST CENTER MANAGEMENT
// ============================================

export const CostCenterService = {
  /**
   * Create cost center
   */
  createCostCenter: async (costCenter: Omit<CostCenter, 'id'>) => {
    try {
      const response = await fetch('/api/accounting/cost-center', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(costCenter)
      });
      if (!response.ok) throw new Error('Failed to create cost center');
      return await response.json();
    } catch (error) {
      console.error('Error creating cost center:', error);
      throw error;
    }
  },

  /**
   * Get all cost centers
   */
  getAllCostCenters: async () => {
    try {
      const response = await fetch('/api/accounting/cost-center', { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch cost centers');
      return await response.json();
    } catch (error) {
      console.error('Error fetching cost centers:', error);
      throw error;
    }
  },

  /**
   * Get cost center-wise expenses
   */
  getCostCenterAnalysis: async (costCenterId: string, period: string) => {
    try {
      const response = await fetch(
        `/api/accounting/cost-center/${costCenterId}/analysis?period=${period}`,
        { headers: getAuthHeaders() }
      );
      if (!response.ok) throw new Error('Failed to get cost center analysis');
      return await response.json();
    } catch (error) {
      console.error('Error getting cost center analysis:', error);
      throw error;
    }
  }
};

// ============================================
// TDS/TCS MANAGEMENT
// ============================================

export const TDSService = {
  /**
   * Calculate TDS on transaction
   */
  calculateTDS: async (
    vendorId: string,
    transactionAmount: number,
    transactionType: 'Purchase' | 'Payment'
  ) => {
    try {
      const response = await fetch('/api/accounting/tds/calculate', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          vendorId,
          transactionAmount,
          transactionType
        })
      });
      if (!response.ok) throw new Error('Failed to calculate TDS');
      return await response.json();
    } catch (error) {
      console.error('Error calculating TDS:', error);
      throw error;
    }
  },

  /**
   * Get TDS summary for period
   */
  getTDSSummary: async (periodStart: string, periodEnd: string) => {
    try {
      const response = await fetch(
        `/api/accounting/tds/summary?periodStart=${periodStart}&periodEnd=${periodEnd}`,
        { headers: getAuthHeaders() }
      );
      if (!response.ok) throw new Error('Failed to get TDS summary');
      return await response.json();
    } catch (error) {
      console.error('Error getting TDS summary:', error);
      throw error;
    }
  }
};

// ============================================
// E-INVOICING (GST)
// ============================================

export const EInvoicingService = {
  /**
   * Generate e-invoice
   */
  generateEInvoice: async (invoiceId: string) => {
    try {
      const response = await fetch(
        `/api/accounting/e-invoicing/generate/${invoiceId}`,
        {
          method: 'POST',
          headers: getAuthHeaders()
        }
      );
      if (!response.ok) throw new Error('Failed to generate e-invoice');
      return await response.json();
    } catch (error) {
      console.error('Error generating e-invoice:', error);
      throw error;
    }
  },

  /**
   * Get e-invoice status
   */
  getEInvoiceStatus: async (einvoiceNo: string) => {
    try {
      const response = await fetch(
        `/api/accounting/e-invoicing/status/${einvoiceNo}`,
        { headers: getAuthHeaders() }
      );
      if (!response.ok) throw new Error('Failed to get e-invoice status');
      return await response.json();
    } catch (error) {
      console.error('Error getting e-invoice status:', error);
      throw error;
    }
  },

  /**
   * Cancel e-invoice
   */
  cancelEInvoice: async (einvoiceNo: string, reason: string) => {
    try {
      const response = await fetch(
        `/api/accounting/e-invoicing/cancel/${einvoiceNo}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason })
        }
      );
      if (!response.ok) throw new Error('Failed to cancel e-invoice');
      return await response.json();
    } catch (error) {
      console.error('Error cancelling e-invoice:', error);
      throw error;
    }
  }
};

export const FixedAssetService = {
  getAssets: async () => {
    try {
      const response = await fetch('/api/accounting/advanced/fixed-assets', { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch fixed assets');
      return await response.json();
    } catch (error) {
      console.error('Error getting fixed assets:', error);
      throw error;
    }
  },
  createAsset: async (assetData: any) => {
    try {
      const response = await fetch('/api/accounting/advanced/fixed-assets', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(assetData)
      });
      if (!response.ok) throw new Error('Failed to create fixed asset');
      return await response.json();
    } catch (error) {
      console.error('Error creating fixed asset:', error);
      throw error;
    }
  }
};

export const TaxConfigurationService = {
  getTaxes: async () => {
    try {
      const response = await fetch('/api/accounting/advanced/taxes', { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch taxes');
      return await response.json();
    } catch (error) {
      console.error('Error getting taxes:', error);
      throw error;
    }
  },
  createTax: async (taxData: any) => {
    try {
      const response = await fetch('/api/accounting/advanced/taxes', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(taxData)
      });
      if (!response.ok) throw new Error('Failed to create tax config');
      return await response.json();
    } catch (error) {
      console.error('Error creating tax:', error);
      throw error;
    }
  }
};

export const ForexService = {
  getRates: async () => {
    try {
      const response = await fetch('/api/accounting/advanced/forex', { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch forex rates');
      return await response.json();
    } catch (error) {
      console.error('Error getting forex rates:', error);
      throw error;
    }
  },
  createRate: async (rateData: any) => {
    try {
      const response = await fetch('/api/accounting/advanced/forex', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(rateData)
      });
      if (!response.ok) throw new Error('Failed to create forex rate');
      return await response.json();
    } catch (error) {
      console.error('Error creating forex rate:', error);
      throw error;
    }
  }
};

// NOTE: export default is at the bottom of the file, after all service declarations.


const API = '/api';
const hdr = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}` });

export const ItemMasterService = {
  getAll: async () => {
    const r = await fetch(`${API}/items`, { headers: hdr() });
    if (!r.ok) throw new Error('Failed to fetch items');
    return r.json();
  },
  create: async (data: any) => {
    const r = await fetch(`${API}/items`, { method: 'POST', headers: hdr(), body: JSON.stringify(data) });
    if (!r.ok) throw new Error('Failed to create item');
    return r.json();
  },
  update: async (id: string, data: any) => {
    const r = await fetch(`${API}/items/${id}`, { method: 'PUT', headers: hdr(), body: JSON.stringify(data) });
    if (!r.ok) throw new Error('Failed to update item');
    return r.json();
  },
  delete: async (id: string) => {
    const r = await fetch(`${API}/items/${id}`, { method: 'DELETE', headers: hdr() });
    if (!r.ok) throw new Error('Failed to delete item');
    return r.json();
  }
};

// ============================================================
// GODOWN / LOCATION SERVICE
// ============================================================
export const GodownService = {
  getAll: async () => {
    const r = await fetch(`${API}/godowns`, { headers: hdr() });
    if (!r.ok) throw new Error('Failed to fetch godowns');
    return r.json();
  },
  create: async (data: any) => {
    const r = await fetch(`${API}/godowns`, { method: 'POST', headers: hdr(), body: JSON.stringify(data) });
    if (!r.ok) throw new Error('Failed to create godown');
    return r.json();
  },
  update: async (id: string, data: any) => {
    const r = await fetch(`${API}/godowns/${id}`, { method: 'PUT', headers: hdr(), body: JSON.stringify(data) });
    if (!r.ok) throw new Error('Failed to update godown');
    return r.json();
  },
  delete: async (id: string) => {
    const r = await fetch(`${API}/godowns/${id}`, { method: 'DELETE', headers: hdr() });
    if (!r.ok) throw new Error('Failed to delete godown');
    return r.json();
  }
};

// ============================================================
// BILL OF MATERIALS (BOM) SERVICE
// ============================================================
export const BOMService = {
  getAll: async () => {
    const r = await fetch(`${API}/boms`, { headers: hdr() });
    if (!r.ok) throw new Error('Failed to fetch BOMs');
    return r.json();
  },
  getById: async (id: string) => {
    const r = await fetch(`${API}/boms/${id}`, { headers: hdr() });
    if (!r.ok) throw new Error('Failed to fetch BOM');
    return r.json();
  },
  create: async (data: any) => {
    const r = await fetch(`${API}/boms`, { method: 'POST', headers: hdr(), body: JSON.stringify(data) });
    if (!r.ok) throw new Error('Failed to create BOM');
    return r.json();
  },
  update: async (id: string, data: any) => {
    const r = await fetch(`${API}/boms/${id}`, { method: 'PUT', headers: hdr(), body: JSON.stringify(data) });
    if (!r.ok) throw new Error('Failed to update BOM');
    return r.json();
  }
};

// ============================================================
// STOCK SUMMARY SERVICE
// ============================================================
export const StockSummaryService = {
  getSummary: async (valuationMethod = 'FIFO') => {
    try {
      const response = await fetch('/api/stock-summary', { 
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ valuationMethod })
      });
      if (!response.ok) throw new Error('Failed to fetch stock summary');
      const rawData = await response.json();
      
      // Transform flat product list into category tree for UI
      const products = rawData.data || [];
      const categories: Record<string, any> = {};

      products.forEach((p: any) => {
        const cat = p.category || 'General';
        if (!categories[cat]) {
          categories[cat] = { name: cat, qty: 0, value: 0, children: [] };
        }
        const qty = parseFloat(p.closing_qty);
        const val = qty * (p.unit_price || 0); // Valuation logic simplified here for summary
        
        categories[cat].children.push({
          name: p.name,
          sku: p.sku || p.code,
          qty: isNaN(qty) ? 0 : qty,
          uom: p.unit || p.uom,
          // FIX: p.unitPrice is undefined (no toCamelCase applied here); use snake_case field
          rate: parseFloat(p.unit_price || p.purchase_rate || 0),
          value: isNaN(val) ? 0 : val,
        });
        categories[cat].qty += qty;
        categories[cat].value += val;
      });

      return Object.values(categories);
    } catch (error) {
      console.error('Error in StockSummaryService:', error);
      throw error;
    }
  },
  getItemStock: async (itemId: string) => {
    const r = await fetch(`${API}/stock/item/${itemId}`, { headers: hdr() });
    if (!r.ok) throw new Error('Failed to fetch item stock');
    return r.json();
  }
};

// ============================================================
// DAY BOOK SERVICE
// ============================================================
export const DayBookService = {
  getEntries: async (dateFrom: string, dateTo: string, voucherType = 'All') => {
    const params = new URLSearchParams({ dateFrom, dateTo, voucherType });
    const r = await fetch(`/api/accounting/daybook?${params}`, { headers: hdr() });
    if (!r.ok) throw new Error('Failed to fetch day book entries');
    return r.json();
  }
};

// ============================================================
// GST COMPLIANCE SERVICE
// ============================================================
export const GstService = {
  getGstr1: async (month: number, year: number) => {
    try {
      const response = await fetch(`/api/gst/gstr1?month=${month}&year=${year}`, { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch GSTR-1');
      return await response.json();
    } catch (error) {
      console.error('Error in GstService.getGstr1:', error);
      throw error;
    }
  },
  getGstr2: async (month: number, year: number, recon: boolean = false) => {
    try {
      const response = await fetch(`/api/gst/gstr2?month=${month}&year=${year}&recon=${recon}`, { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch GSTR-2');
      return await response.json();
    } catch (error) {
      console.error('Error in GstService.getGstr2:', error);
      throw error;
    }
  },
  getGstr3b: async (month: number, year: number) => {
    try {
      const response = await fetch(`/api/gst/gstr3b?month=${month}&year=${year}`, { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch GSTR-3B');
      return await response.json();
    } catch (error) {
      console.error('Error in GstService.getGstr3b:', error);
      throw error;
    }
  }
};

export default {
  ChartOfAccountsService,
  JournalVoucherService,
  GeneralLedgerService,
  TrialBalanceService,
  BalanceSheetService,
  ProfitLossService,
  BankReconciliationService,
  AgingAnalysisService,
  BudgetService,
  AuditService,
  CostCenterService,
  TDSService,
  EInvoicingService,
  FixedAssetService,
  TaxConfigurationService,
  ForexService,
  ItemMasterService,
  GodownService,
  BOMService,
  StockSummaryService,
  DayBookService,
  GstService
};
