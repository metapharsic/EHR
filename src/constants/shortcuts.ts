import { Tab } from '../types';

export interface ShortcutDefinition {
  id: string;
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
}

export const ERP_SHORTCUTS: Partial<Record<Tab, ShortcutDefinition>> = {
  [Tab.DASHBOARD]: {
    id: 'navigate-dashboard',
    key: 'd',
    ctrl: true,
    alt: false,
    description: 'Go to Dashboard'
  },
  [Tab.POS]: {
    id: 'navigate-pos',
    key: 'p',
    ctrl: true,
    alt: false,
    description: 'Go to Point of Sale'
  },
  [Tab.INVENTORY]: {
    id: 'navigate-inventory',
    key: 'i',
    ctrl: true,
    alt: false,
    description: 'Go to Inventory'
  },
  [Tab.PURCHASE]: {
    id: 'navigate-purchase',
    key: 'u',
    ctrl: true,
    alt: false,
    description: 'Go to Purchase'
  },
  [Tab.ACCOUNTS]: {
    id: 'navigate-accounts',
    key: 'a',
    ctrl: true,
    alt: false,
    description: 'Go to Accounts'
  },
  [Tab.INVENTORY_VOUCHERS]: {
    id: 'navigate-inventory-vouchers',
    key: 'v',
    ctrl: true,
    alt: false,
    description: 'Go to Inventory Vouchers'
  },
  [Tab.TALLY_VOUCHER_ENTRY]: {
    id: 'navigate-tally-voucher-entry',
    key: 'y',
    ctrl: true,
    alt: false,
    description: 'Go to Voucher Entry'
  },
  [Tab.FINANCIAL_STATEMENTS]: {
    id: 'navigate-financial-statements',
    key: 'f',
    ctrl: true,
    alt: false,
    description: 'Go to Financial Statements'
  },
  [Tab.GENERAL_LEDGER]: {
    id: 'navigate-general-ledger',
    key: 'z',
    ctrl: true,
    alt: false,
    description: 'Go to General Ledger'
  },
  [Tab.STRATEGIC_ACCOUNTS]: {
    id: 'navigate-strategic-accounts',
    key: 'x',
    ctrl: true,
    alt: false,
    description: 'Go to Strategic Accounts'
  },
  [Tab.STOCK_SUMMARY]: {
    id: 'navigate-stock-summary',
    key: 'w',
    ctrl: true,
    alt: false,
    description: 'Go to Stock Summary'
  },
  [Tab.CRM]: {
    id: 'navigate-crm',
    key: 'r',
    ctrl: true,
    alt: false,
    description: 'Go to CRM'
  },
  [Tab.OMS]: {
    id: 'navigate-oms',
    key: 'o',
    ctrl: true,
    alt: false,
    description: 'Go to Order Management System'
  },
  [Tab.SALES]: {
    id: 'navigate-sales',
    key: 's',
    ctrl: true,
    alt: false,
    description: 'Go to Sales'
  },
  [Tab.MANUFACTURING]: {
    id: 'navigate-manufacturing',
    key: 'm',
    ctrl: true,
    alt: false,
    description: 'Go to Manufacturing'
  },
  [Tab.QC]: {
    id: 'navigate-qc',
    key: 'q',
    ctrl: true,
    alt: false,
    description: 'Go to Quality Control'
  },
  [Tab.R_AND_D]: {
    id: 'navigate-rnd',
    key: 'n',
    ctrl: true,
    alt: false,
    description: 'Go to Research & Development'
  },
  [Tab.LOGISTICS]: {
    id: 'navigate-logistics',
    key: 'l',
    ctrl: true,
    alt: false,
    description: 'Go to Logistics'
  },
  [Tab.ASSETS]: {
    id: 'navigate-assets',
    key: 's',
    ctrl: true,
    alt: false,
    description: 'Go to Asset Management'
  },
  [Tab.DOCUMENTS]: {
    id: 'navigate-documents',
    key: 'f',
    ctrl: true,
    alt: false,
    description: 'Go to Document Management'
  },
  [Tab.EMPLOYEES]: {
    id: 'navigate-employees',
    key: 'e',
    ctrl: true,
    alt: false,
    description: 'Go to HR & Employees'
  },
  [Tab.REPORTS]: {
    id: 'navigate-reports',
    key: 't',
    ctrl: true,
    alt: false,
    description: 'Go to Reports'
  },
  [Tab.COMPLIANCE]: {
    id: 'navigate-compliance',
    key: 'k',
    ctrl: true,
    alt: false,
    description: 'Go to Compliance'
  },
  [Tab.AUDIT]: {
    id: 'navigate-audit',
    key: 'h',
    ctrl: true,
    alt: false,
    description: 'Go to Audit Log'
  },
  [Tab.BUDGET]: {
    id: 'navigate-budget',
    key: 'b',
    ctrl: true,
    alt: false,
    description: 'Go to Budget Management'
  },
  [Tab.SETTINGS]: {
    id: 'navigate-settings',
    key: ',',
    ctrl: true,
    alt: false,
    description: 'Go to Settings'
  },
  [Tab.MULTI_BRANCH]: {
    id: 'navigate-multi-branch',
    key: 'j',
    ctrl: true,
    alt: false,
    description: 'Go to Multi Branch'
  },
  [Tab.INVENTORY_ANALYTICS]: {
    id: 'navigate-inventory-analytics',
    key: 'y',
    ctrl: true,
    alt: false,
    description: 'Go to Inventory Intelligence'
  },
  [Tab.INTELLIGENCE_DASHBOARD]: {
    id: 'navigate-intelligence-dashboard',
    key: 'g',
    ctrl: true,
    alt: false,
    description: 'Go to Intelligence Dashboard'
  },
  [Tab.LEDGER_CREATION]: {
    id: 'navigate-ledger-creation',
    key: 'l',
    ctrl: true,
    alt: false,
    description: 'Go to Ledger Creation'
  }
};

// Additional global shortcuts
export const GLOBAL_SHORTCUTS = [
  {
    id: 'global-search',
    key: 'k',
    ctrl: true,
    shift: true,
    alt: false,
    description: 'Open global search'
  },
  {
    id: 'toggle-sidebar',
    key: '\\',
    ctrl: true,
    shift: false,
    alt: false,
    description: 'Toggle sidebar'
  },
  {
    id: 'help-shortcuts',
    key: '?',
    ctrl: true,
    shift: true,
    alt: false,
    description: 'Show keyboard shortcuts help'
  }
];
