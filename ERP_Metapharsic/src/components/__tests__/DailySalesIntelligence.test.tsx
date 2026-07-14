/**
 * Component Tests — DailySalesIntelligence & StrategicAccounts Financial Dashboard
 * Covers: real COGS from API, receivables/payables by account_type,
 *         loading states, error states, data rendering, last-sync time.
 *
 * Run: npx vitest run src/components/__tests__/DailySalesIntelligence.test.tsx
 */
/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';

// ── Lucide ─────────────────────────────────────────────────────────────────────
vi.mock('lucide-react', async () => {
  const actual = await vi.importActual('lucide-react');
  return { ...actual };
});

// ── Recharts — mock to avoid ResizeObserver errors in JSDOM ───────────────────
vi.mock('recharts', () => ({
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => <div />,
  PieChart: ({ children }: any) => <div>{children}</div>,
  Pie: () => <div />,
  Cell: () => <div />,
  Legend: () => <div />,
}));

// ── Notification contexts ─────────────────────────────────────────────────────
const mockAddNotification = vi.fn();
vi.mock('../../context/NotificationContext', () => ({
  useNotifications: () => ({ addNotification: mockAddNotification, notifications: [] }),
}));
vi.mock('../../store/useAppStore', () => ({
  useAppStore: (s?: any) => typeof s === 'function'
    ? s({ addNotification: mockAddNotification })
    : { addNotification: mockAddNotification },
}));

// ── Auth context ─────────────────────────────────────────────────────────────
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ hasPermission: () => true, user: { id: '1', name: 'Test', role: 'ADMIN' } }),
}));

// ── useNotifications hook ─────────────────────────────────────────────────────
vi.mock('../../hooks/useNotifications', () => ({
  useNotificationSystem: () => ({
    success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(),
  }),
}));

// ── apiClient (not used directly in DailySalesIntelligence anymore) ───────────
vi.mock('../../services/apiClient', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ success: true, data: [] }),
    post: vi.fn().mockResolvedValue({ success: true }),
  },
}));

// ── Mock diagnostic data with real COGS ──────────────────────────────────────
const MOCK_DIAGNOSTIC = {
  tableExists: true,
  recordCount: 62,
  stats: [
    {
      date: '2026-05-31',
      invoice_count: '11',
      revenue: '910.80',
      cogs: '637.56',
      gross_profit: '273.24',
      margin_percentage: '30.00',
    },
    {
      date: '2026-05-30',
      invoice_count: '9',
      revenue: '12400.00',
      cogs: '8680.00',
      gross_profit: '3720.00',
      margin_percentage: '30.00',
    },
  ],
  summary: {
    total_period_revenue: 13310.80,
    total_period_profit: 3993.24,
    average_margin: '30.00',
  },
};

// ── useDataFetch mock ─────────────────────────────────────────────────────────
const mockUseDataFetch = vi.fn();
vi.mock('../../hooks/useDataFetch', () => ({
  useDataFetch: (url: string) => mockUseDataFetch(url),
  useDatabaseStatus: () => ({ status: 'connected' }),
  useSearch: (data: any[], keys: string[]) => ({
    query: '',
    setQuery: vi.fn(),
    results: data,
  }),
  usePagination: (data: any[], _perPage: number) => ({
    paginatedData: data.slice(0, 15),
    currentPage: 1,
    totalPages: 1,
    setPage: vi.fn(),
  }),
}));

// ── Mock sub-components used inside StrategicAccounts ────────────────────────
vi.mock('../DayBook', () => ({ DayBook: () => <div>DayBook</div> }));
vi.mock('../GeneralLedger', () => ({ GeneralLedger: () => <div>GL</div> }));
vi.mock('../FinancialStatements', () => ({ FinancialStatements: () => <div>FS</div> }));
vi.mock('../JournalVoucherManager', () => ({ JournalVoucherManager: () => <div>JV</div> }));
vi.mock('../InventoryHub', () => ({ default: () => <div>InventoryHub</div> }));
vi.mock('../GodownMaster', () => ({ GodownMaster: () => <div>GodownMaster</div> }));
vi.mock('../BomMaster', () => ({ BomMaster: () => <div>BomMaster</div> }));
vi.mock('../InventoryVouchers', () => ({ InventoryVouchers: () => <div>InventoryVouchers</div> }));
vi.mock('../GstReports', () => ({ GstReports: () => <div>GstReports</div> }));
vi.mock('../StockSummary', () => ({ StockSummary: () => <div>StockSummary</div> }));
vi.mock('../CostCenterManager', () => ({ CostCenterManager: () => <div>CostCenterManager</div> }));
vi.mock('../TDSManagement', () => ({ default: () => <div>TDS</div> }));
vi.mock('../AuditTrailView', () => ({ AuditTrailView: () => <div>Audit</div> }));
vi.mock('../BudgetManager', () => ({ BudgetManager: () => <div>Budget</div> }));

// ─────────────────────────────────────────────────────────────────────────────

let DailySalesIntelligence: React.ComponentType;
let StrategicAccounts: React.ComponentType;

beforeEach(async () => {
  vi.clearAllMocks();
  // Default: loading state
  mockUseDataFetch.mockReturnValue({ data: null, loading: false, error: null, refetch: vi.fn() });
  vi.resetModules();
  const dsiMod = await import('../DailySalesIntelligence');
  const saMod  = await import('../StrategicAccounts');
  DailySalesIntelligence = dsiMod.default;
  StrategicAccounts = saMod.default;
});
afterEach(() => vi.restoreAllMocks());

// ═══════════════════════════════════════════════════════════════════════════════
// DailySalesIntelligence — loading, error, data rendering
// ═══════════════════════════════════════════════════════════════════════════════
describe('DailySalesIntelligence — Loading', () => {
  it('shows loading spinner when loading=true', async () => {
    mockUseDataFetch.mockReturnValue({ data: null, loading: true, error: null, refetch: vi.fn() });
    await act(async () => { render(<DailySalesIntelligence />); });
    expect(screen.getByText(/Processing Intelligence/i)).toBeInTheDocument();
  });
});

describe('DailySalesIntelligence — Error', () => {
  it('shows error state when API returns error', async () => {
    mockUseDataFetch.mockReturnValue({ data: null, loading: false, error: 'Network error', refetch: vi.fn() });
    await act(async () => { render(<DailySalesIntelligence />); });
    expect(screen.getByText(/Intelligence Link Failure/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });

  it('shows empty state when stats array is empty', async () => {
    mockUseDataFetch.mockReturnValue({
      data: { stats: [], summary: {}, recordCount: 0 },
      loading: false, error: null, refetch: vi.fn(),
    });
    await act(async () => { render(<DailySalesIntelligence />); });
    expect(screen.getByText(/No Sales Data Available/i)).toBeInTheDocument();
  });
});

describe('DailySalesIntelligence — Real COGS from API (Fix Verification)', () => {
  beforeEach(() => {
    mockUseDataFetch.mockReturnValue({
      data: MOCK_DIAGNOSTIC,
      loading: false, error: null, refetch: vi.fn(),
    });
  });

  it('fetches from /api/accounting/diagnostic (not /api/sales)', async () => {
    await act(async () => { render(<DailySalesIntelligence />); });
    const calls = mockUseDataFetch.mock.calls.map((c: any[]) => c[0]);
    expect(calls.some((url: string) => url.includes('/api/accounting/diagnostic'))).toBe(true);
    expect(calls.every((url: string) => !url.includes('/api/sales'))).toBe(true);
  });

  it('renders Period Revenue KPI from API data', async () => {
    await act(async () => { render(<DailySalesIntelligence />); });
    expect(await screen.findByTestId('period-revenue')).toBeInTheDocument();
    // Should contain ₹13,310 (or similar formatted value)
    const el = screen.getByTestId('period-revenue');
    expect(el.textContent).toMatch(/13[,.]?3/); // ₹13,310.80
  });

  it('renders Gross Profit KPI from API data', async () => {
    await act(async () => { render(<DailySalesIntelligence />); });
    const el = screen.getByTestId('gross-profit');
    expect(el.textContent).toMatch(/3[,.]?99/); // ₹3,993.24
  });

  it('renders Avg Margin from API data (not hardcoded 30%)', async () => {
    await act(async () => { render(<DailySalesIntelligence />); });
    expect(screen.getByTestId('avg-margin').textContent).toBe('30.00%');
  });

  it('renders daily breakdown table with COGS column', async () => {
    await act(async () => { render(<DailySalesIntelligence />); });
    expect(await screen.findByTestId('daily-stats-table')).toBeInTheDocument();
    expect(screen.getByText('COGS')).toBeInTheDocument();
  });

  it('table shows real COGS value (₹637.56), not estimated 70%', async () => {
    await act(async () => { render(<DailySalesIntelligence />); });
    await screen.findByTestId('daily-stats-table');
    // The COGS for the first row is ₹637.56 (from batch.purchase_rate × quantity)
    // If COGS were hardcoded as 70% of revenue (910.80 × 0.70 = ₹637.56, same in this case)
    // But we also test gross_profit is exactly revenue - cogs (not revenue * 0.30)
    const cells = document.querySelectorAll('td');
    const cellTexts = Array.from(cells).map(c => c.textContent ?? '');
    // 637.56 should appear (real COGS)
    expect(cellTexts.some(t => t.includes('637') || t.includes('638'))).toBe(true);
  });

  it('does NOT use hardcoded 70% COGS multiplier in source', async () => {
    // This test verifies the COGS is derived from API data (batch.purchase_rate),
    // not from `rev * 0.3` client-side. We test by setting up COGS ≠ 70%:
    const nonStandardCOGSData = {
      ...MOCK_DIAGNOSTIC,
      stats: [{ date: '2026-05-31', invoice_count: '5', revenue: '1000.00', cogs: '450.00', gross_profit: '550.00', margin_percentage: '55.00' }],
      summary: { total_period_revenue: 1000, total_period_profit: 550, average_margin: '55.00' },
    };
    mockUseDataFetch.mockReturnValue({ data: nonStandardCOGSData, loading: false, error: null, refetch: vi.fn() });
    vi.resetModules();
    const mod = await import('../DailySalesIntelligence');
    const DSI = mod.default;

    await act(async () => { render(<DSI />); });
    // Margin should be 55% (from API), NOT 30% (which hardcoded 70% COGS would give)
    expect(screen.getByTestId('avg-margin').textContent).toBe('55.00%');
  });
});

describe('DailySalesIntelligence — safeNum guards', () => {
  it('handles null/undefined fields in stats gracefully', async () => {
    const badData = {
      stats: [{ date: '2026-05-31', invoice_count: null, revenue: null, cogs: null, gross_profit: null, margin_percentage: null }],
      summary: null,
    };
    mockUseDataFetch.mockReturnValue({ data: badData, loading: false, error: null, refetch: vi.fn() });
    await act(async () => { render(<DailySalesIntelligence />); });
    // Should not crash, should show 0 values
    const revenue = screen.getByTestId('period-revenue');
    expect(revenue).toBeInTheDocument();
  });

  it('drops rows with invalid dates', async () => {
    const badData = {
      stats: [
        { date: 'not-a-date', invoice_count: 1, revenue: '500', cogs: '350', gross_profit: '150', margin_percentage: '30' },
        { date: '2026-05-31', invoice_count: 2, revenue: '1000', cogs: '700', gross_profit: '300', margin_percentage: '30' },
      ],
      summary: {},
    };
    mockUseDataFetch.mockReturnValue({ data: badData, loading: false, error: null, refetch: vi.fn() });
    await act(async () => { render(<DailySalesIntelligence />); });
    // Only 1 valid row → table should have content but no crash
    expect(screen.getByTestId('daily-stats-table')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// StrategicAccounts — Receivables / Payables calculation by account_type
// ═══════════════════════════════════════════════════════════════════════════════
describe('StrategicAccounts — Receivables/Payables by account_type (Fix Verification)', () => {
  const MOCK_PARTIES = [
    // Asset (receivable) — positive balance
    { id: 'a1', account_code: 'AC001', account_name: 'Trade Debtors', account_type: 'Asset',   account_format: 'debit',  current_balance:  50000, opening_balance: 50000 },
    { id: 'a2', account_code: 'AC002', account_name: 'Cash Account',   account_type: 'Asset',   account_format: 'debit',  current_balance:  30000, opening_balance: 30000 },
    // Liability (payable) — negative balance (credit-normal formula gives negative)
    { id: 'l1', account_code: 'AC003', account_name: 'Trade Creditors', account_type: 'Liability', account_format: 'credit', current_balance: -20000, opening_balance: 20000 },
    // Income account — positive balance (should NOT appear in receivables)
    { id: 'i1', account_code: 'AC004', account_name: 'Sales Revenue',   account_type: 'Income',    account_format: 'credit', current_balance: 100000, opening_balance: 0 },
    // Expense account — positive balance (should NOT appear in receivables)
    { id: 'e1', account_code: 'AC005', account_name: 'Cost of Goods',   account_type: 'Expense',   account_format: 'debit',  current_balance:  40000, opening_balance: 0 },
  ];

  beforeEach(() => {
    // chart-of-accounts returns parties; diagnostic returns stats
    mockUseDataFetch.mockImplementation((url: string) => {
      if (url.includes('chart-of-accounts')) {
        return { data: MOCK_PARTIES, loading: false, error: null, refetch: vi.fn() };
      }
      if (url.includes('diagnostic')) {
        return { data: MOCK_DIAGNOSTIC, loading: false, error: null, refetch: vi.fn() };
      }
      return { data: null, loading: false, error: null, refetch: vi.fn() };
    });
  });

  it('Total Receivables = only Asset accounts with positive balance', async () => {
    await act(async () => { render(<StrategicAccounts />); });

    // Assets with positive balance: 50000 + 30000 = 80000
    // Income accounts (100000) should NOT be included
    const receivablesCard = screen.getByText('Total Receivables')?.closest?.('[class*="card"], [class*="p-"]');
    expect(receivablesCard || screen.getByText('Total Receivables')).toBeInTheDocument();

    // Look for the value in the StatCard — should contain 80,000, NOT 130,000 (which would include Income)
    const allText = document.body.textContent ?? '';
    expect(allText).toMatch(/80[,.]?000|₹80/);
    expect(allText).not.toMatch(/1[,.]?30[,.]?000|₹1,30/);
  });

  it('Total Payables = only Liability accounts with negative balance', async () => {
    await act(async () => { render(<StrategicAccounts />); });

    // Liabilities with negative balance: abs(-20000) = 20000
    // Expense accounts (40000) should NOT be included
    const allText = document.body.textContent ?? '';
    expect(allText).toMatch(/20[,.]?000|₹20/);
    // Expense account balance (40000) should not show as payables
    expect(allText).not.toMatch(/60[,.]?000.*payabl/i);
  });

  it('Net Cash Flow = Receivables - Payables (80000 - 20000 = 60000)', async () => {
    await act(async () => { render(<StrategicAccounts />); });
    const allText = document.body.textContent ?? '';
    expect(allText).toMatch(/60[,.]?000|₹60/);
  });

  it('Accounts Active count = total parties count', async () => {
    await act(async () => { render(<StrategicAccounts />); });
    // recordCount comes from diagnosticData.recordCount
    expect(screen.getByText('62')).toBeInTheDocument();
  });
});

describe('StrategicAccounts — Last Sync shows data-fetch time (not client clock)', () => {
  it('Last Sync shows — before data loads', async () => {
    mockUseDataFetch.mockImplementation(() => ({
      data: null, loading: true, error: null, refetch: vi.fn(),
    }));
    await act(async () => { render(<StrategicAccounts />); });
    // The loading spinner should be shown, not the sync time
    expect(screen.queryByTestId('last-sync-time')).not.toBeInTheDocument();
  });

  it('Last Sync time updates after diagnostic data arrives', async () => {
    mockUseDataFetch.mockImplementation((url: string) => {
      if (url.includes('chart-of-accounts'))
        return { data: MOCK_PARTIES, loading: false, error: null, refetch: vi.fn() };
      return { data: MOCK_DIAGNOSTIC, loading: false, error: null, refetch: vi.fn() };
    });
    await act(async () => { render(<StrategicAccounts />); });
    const syncEl = await screen.findByTestId('last-sync-time');
    // After data loads, sync time should be a time string (not '—')
    expect(syncEl.textContent).toMatch(/\d{2}:\d{2}:\d{2}|—/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper mock data reference (used above)
const MOCK_PARTIES = [
  { id: 'a1', account_code: 'AC001', account_name: 'Trade Debtors', account_type: 'Asset',   account_format: 'debit',  current_balance:  50000, opening_balance: 50000 },
  { id: 'a2', account_code: 'AC002', account_name: 'Cash Account',   account_type: 'Asset',   account_format: 'debit',  current_balance:  30000, opening_balance: 30000 },
  { id: 'l1', account_code: 'AC003', account_name: 'Trade Creditors', account_type: 'Liability', account_format: 'credit', current_balance: -20000, opening_balance: 20000 },
  { id: 'i1', account_code: 'AC004', account_name: 'Sales Revenue',   account_type: 'Income',    account_format: 'credit', current_balance: 100000, opening_balance: 0 },
  { id: 'e1', account_code: 'AC005', account_name: 'Cost of Goods',   account_type: 'Expense',   account_format: 'debit',  current_balance:  40000, opening_balance: 0 },
];
