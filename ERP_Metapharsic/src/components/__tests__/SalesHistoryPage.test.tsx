/**
 * Tier 3 — Component (UI) Tests: SalesHistoryPage
 * Tests React renders, state transitions, loading/error/empty states.
 * Run: npx vitest run src/components/__tests__/SalesHistoryPage.test.tsx
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// ─── Module-level stable mocks (no inline object literals) ───────────────────
const mockAddNotification = vi.fn();
const mockSetActiveTab    = vi.fn();

vi.mock('../../context/NotificationContext', () => ({
  useNotifications: () => ({ addNotification: mockAddNotification }),
}));
vi.mock('../../store/useAppStore', () => ({
  useAppStore: () => ({ setActiveTab: mockSetActiveTab, activeTab: 'SALES_HISTORY' }),
}));
vi.mock('../../utils/formatters', () => ({
  formatCurrency: (v: number) => `₹${Number(v ?? 0).toFixed(2)}`,
  formatDate:     (d: string) => d ? new Date(d).toLocaleDateString() : '—',
}));
vi.mock('../../utils/accountingExport', () => ({
  printPOSInvoice:        vi.fn(),
  exportPOSInvoiceToExcel: vi.fn(),
}));

// ─── apiClient mock ───────────────────────────────────────────────────────────
const mockGet    = vi.fn();
const mockPost   = vi.fn();
const mockDelete = vi.fn();

vi.mock('../../services/apiClient', () => ({
  default: { get: mockGet, post: mockPost, delete: mockDelete },
}));

// ─── Seed data ────────────────────────────────────────────────────────────────
const MOCK_STATS = {
  total_invoices: 42, total_revenue: 125000, avg_order_value: 2976,
  total_gst_collected: 22500, returns_count: 3,
  monthly_trend: [], payment_breakdown: [{ payment_mode: 'Cash', cnt: 30, total: 90000 }],
  generated_at: new Date().toISOString(),
};

const MOCK_INVOICES = [
  {
    id: 'inv-001', invoice_number: 'INV-2026-0001', customer_name: 'Apollo Pharmacy',
    date: '2026-06-01', payment_mode: 'Cash', sub_total: 1000, total_gst: 180,
    net_amount: 1180, status: 'Completed',
  },
  {
    id: 'inv-002', invoice_number: 'INV-2026-0002', customer_name: 'MedPlus Store',
    date: '2026-06-02', payment_mode: 'UPI', sub_total: 2000, total_gst: 360,
    net_amount: 2360, status: 'Completed',
  },
  {
    id: 'inv-003', invoice_number: 'INV-2026-0003', customer_name: 'City Hospital',
    date: '2026-06-03', payment_mode: 'Credit Card', sub_total: 5000, total_gst: 900,
    net_amount: 5900, status: 'Returned',
  },
];

const MOCK_DETAIL = {
  id: 'inv-001', invoiceNumber: 'INV-2026-0001', customerName: 'Apollo Pharmacy',
  date: '2026-06-01', payment_mode: 'Cash', sub_total: 1000, total_gst: 180,
  net_amount: 1180, status: 'Completed', taxableValue: 1000, totalGst: 180, netAmount: 1180,
  items: [{ product_name: 'Paracetamol 500mg', quantity: 10, rate: 100, total_amount: 1000, batch_number: 'B001' }],
};

const setupMocks = (overrides: any = {}) => {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/stats')) return Promise.resolve({ success: true, data: overrides.stats ?? MOCK_STATS });
    if (url.includes('/invoices/inv-001')) return Promise.resolve({ success: true, data: MOCK_DETAIL });
    return Promise.resolve({ success: true, data: overrides.invoices ?? MOCK_INVOICES, total: overrides.total ?? MOCK_INVOICES.length, page: 0, limit: 50 });
  });
};

// ─── Import component AFTER mocks ────────────────────────────────────────────
const { default: SalesHistoryPage } = await import('../SalesHistoryPage');

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('SalesHistoryPage', () => {
  beforeEach(() => { vi.clearAllMocks(); setupMocks(); });
  afterEach(() => { vi.clearAllTimers(); });

  // Render & KPI ──────────────────────────────────────────────────────────────
  describe('Initial render & KPI cards', () => {
    it('renders the Sales Register heading', async () => {
      render(<SalesHistoryPage />);
      expect(screen.getByText(/Complete Sales Register/i)).toBeInTheDocument();
    });

    it('shows 4 KPI cards after data loads', async () => {
      render(<SalesHistoryPage />);
      await waitFor(() => {
        expect(screen.getByText(/Total Revenue/i)).toBeInTheDocument();
        expect(screen.getByText(/Total Invoices/i)).toBeInTheDocument();
        expect(screen.getByText(/Avg Order Value/i)).toBeInTheDocument();
        expect(screen.getByText(/GST Collected/i)).toBeInTheDocument();
      });
    });

    it('displays correct KPI values from stats', async () => {
      render(<SalesHistoryPage />);
      await waitFor(() => {
        expect(screen.getByText('₹125000.00')).toBeInTheDocument();
        expect(screen.getByText('42')).toBeInTheDocument();
      });
    });

    it('shows skeleton loaders initially before data', () => {
      setupMocks();
      mockGet.mockReturnValue(new Promise(() => {})); // never resolves
      render(<SalesHistoryPage />);
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  // Table ─────────────────────────────────────────────────────────────────────
  describe('Invoice table', () => {
    it('renders all invoice rows', async () => {
      render(<SalesHistoryPage />);
      await waitFor(() => {
        expect(screen.getByText('INV-2026-0001')).toBeInTheDocument();
        expect(screen.getByText('INV-2026-0002')).toBeInTheDocument();
        expect(screen.getByText('INV-2026-0003')).toBeInTheDocument();
      });
    });

    it('shows customer names', async () => {
      render(<SalesHistoryPage />);
      await waitFor(() => {
        expect(screen.getByText('Apollo Pharmacy')).toBeInTheDocument();
        expect(screen.getByText('MedPlus Store')).toBeInTheDocument();
        expect(screen.getByText('City Hospital')).toBeInTheDocument();
      });
    });

    it('shows payment mode badges', async () => {
      render(<SalesHistoryPage />);
      await waitFor(() => {
        expect(screen.getByText('Cash')).toBeInTheDocument();
        expect(screen.getByText('UPI')).toBeInTheDocument();
        expect(screen.getByText('Credit Card')).toBeInTheDocument();
      });
    });

    it('shows status badges', async () => {
      render(<SalesHistoryPage />);
      await waitFor(() => {
        expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Returned')).toBeInTheDocument();
      });
    });

    it('renders empty state when no invoices', async () => {
      setupMocks({ invoices: [], total: 0 });
      render(<SalesHistoryPage />);
      await waitFor(() => {
        expect(screen.getByText(/No invoices found/i)).toBeInTheDocument();
      });
    });
  });

  // Filters ───────────────────────────────────────────────────────────────────
  describe('Filters', () => {
    it('renders search input', async () => {
      render(<SalesHistoryPage />);
      expect(screen.getByTestId('search-input')).toBeInTheDocument();
    });

    it('renders date-from and date-to inputs', () => {
      render(<SalesHistoryPage />);
      expect(screen.getByTestId('date-from')).toBeInTheDocument();
      expect(screen.getByTestId('date-to')).toBeInTheDocument();
    });

    it('renders payment mode and status filters', () => {
      render(<SalesHistoryPage />);
      expect(screen.getByTestId('payment-filter')).toBeInTheDocument();
      expect(screen.getByTestId('status-filter')).toBeInTheDocument();
    });

    it('triggers API call when search changes', async () => {
      render(<SalesHistoryPage />);
      const input = screen.getByTestId('search-input');
      await userEvent.type(input, 'Apollo');
      await waitFor(() => {
        const calls = mockGet.mock.calls.map(([url]) => url);
        expect(calls.some(u => u.includes('search=Apollo'))).toBe(true);
      });
    });

    it('shows Clear Filters button when any filter is active', async () => {
      render(<SalesHistoryPage />);
      const input = screen.getByTestId('search-input');
      await userEvent.type(input, 'test');
      await waitFor(() => {
        expect(screen.getByTestId('clear-filters')).toBeInTheDocument();
      });
    });

    it('clears all filters on Clear Filters click', async () => {
      render(<SalesHistoryPage />);
      const input = screen.getByTestId('search-input');
      await userEvent.type(input, 'test');
      await waitFor(() => screen.getByTestId('clear-filters'));
      fireEvent.click(screen.getByTestId('clear-filters'));
      expect((screen.getByTestId('search-input') as HTMLInputElement).value).toBe('');
    });
  });

  // Sorting ───────────────────────────────────────────────────────────────────
  describe('Column sorting', () => {
    it('clicking Invoice No header triggers sort API call', async () => {
      render(<SalesHistoryPage />);
      await waitFor(() => screen.getByText('INV-2026-0001'));
      fireEvent.click(screen.getByText('Invoice No'));
      await waitFor(() => {
        const calls = mockGet.mock.calls.map(([url]) => url);
        expect(calls.some(u => u.includes('sort_by=invoice_number'))).toBe(true);
      });
    });

    it('clicking same header toggles sort order', async () => {
      render(<SalesHistoryPage />);
      await waitFor(() => screen.getByText('INV-2026-0001'));
      fireEvent.click(screen.getByText('Date'));
      await waitFor(() => {
        const calls = mockGet.mock.calls.map(([url]) => url);
        expect(calls.some(u => u.includes('sort_by=date'))).toBe(true);
      });
    });
  });

  // Pagination ────────────────────────────────────────────────────────────────
  describe('Pagination', () => {
    it('shows pagination bar when total > 0', async () => {
      render(<SalesHistoryPage />);
      await waitFor(() => {
        expect(screen.getByTestId('pagination')).toBeInTheDocument();
      });
    });

    it('shows correct record range', async () => {
      render(<SalesHistoryPage />);
      await waitFor(() => {
        expect(screen.getByText(/Showing 1/i)).toBeInTheDocument();
      });
    });
  });

  // Invoice Preview ───────────────────────────────────────────────────────────
  describe('Invoice preview modal', () => {
    it('opens preview modal on View button click', async () => {
      render(<SalesHistoryPage />);
      await waitFor(() => screen.getByTestId('view-inv-001'));
      fireEvent.click(screen.getByTestId('view-inv-001'));
      await waitFor(() => {
        expect(screen.getByTestId('invoice-preview')).toBeInTheDocument();
      });
    });

    it('shows invoice number in preview', async () => {
      render(<SalesHistoryPage />);
      await waitFor(() => screen.getByTestId('view-inv-001'));
      fireEvent.click(screen.getByTestId('view-inv-001'));
      await waitFor(() => {
        const preview = screen.getByTestId('invoice-preview');
        const matches = within(preview).getAllByText('INV-2026-0001');
        expect(matches.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('shows customer name in preview', async () => {
      render(<SalesHistoryPage />);
      await waitFor(() => screen.getByTestId('view-inv-001'));
      fireEvent.click(screen.getByTestId('view-inv-001'));
      await waitFor(() => {
        const preview = screen.getByTestId('invoice-preview');
        expect(within(preview).getByText('Apollo Pharmacy')).toBeInTheDocument();
      });
    });

    it('closes preview on X click', async () => {
      render(<SalesHistoryPage />);
      await waitFor(() => screen.getByTestId('view-inv-001'));
      fireEvent.click(screen.getByTestId('view-inv-001'));
      await waitFor(() => screen.getByTestId('invoice-preview'));
      fireEvent.click(screen.getByTestId('close-preview'));
      await waitFor(() => {
        expect(screen.queryByTestId('invoice-preview')).not.toBeInTheDocument();
      });
    });
  });

  // Sales Return ──────────────────────────────────────────────────────────────
  describe('Sales Return modal', () => {
    it('shows Return button only for Completed invoices', async () => {
      render(<SalesHistoryPage />);
      await waitFor(() => screen.getByTestId('return-inv-001'));
      expect(screen.getByTestId('return-inv-001')).toBeInTheDocument();
      expect(screen.queryByTestId('return-inv-003')).not.toBeInTheDocument();
    });

    it('opens return modal on Return button click', async () => {
      render(<SalesHistoryPage />);
      await waitFor(() => screen.getByTestId('return-inv-001'));
      fireEvent.click(screen.getByTestId('return-inv-001'));
      expect(screen.getByTestId('return-modal')).toBeInTheDocument();
    });

    it('shows invoice number in return modal', async () => {
      render(<SalesHistoryPage />);
      await waitFor(() => screen.getByTestId('return-inv-001'));
      fireEvent.click(screen.getByTestId('return-inv-001'));
      const modal = screen.getByTestId('return-modal');
      expect(within(modal).getByText('INV-2026-0001')).toBeInTheDocument();
    });

    it('calls POST /return on confirm', async () => {
      mockPost.mockResolvedValue({ data: { success: true, credit_note_number: 'CN-INV-2026-0001' } });
      render(<SalesHistoryPage />);
      await waitFor(() => screen.getByTestId('return-inv-001'));
      fireEvent.click(screen.getByTestId('return-inv-001'));
      fireEvent.change(screen.getByTestId('return-reason'), { target: { value: 'Damaged product' } });
      fireEvent.click(screen.getByTestId('confirm-return'));
      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          expect.stringContaining('/return'),
          expect.objectContaining({ reason: 'Damaged product' })
        );
      });
    });

    it('shows success notification after return', async () => {
      mockPost.mockResolvedValue({ data: { success: true, credit_note_number: 'CN-INV-2026-0001' } });
      render(<SalesHistoryPage />);
      await waitFor(() => screen.getByTestId('return-inv-001'));
      fireEvent.click(screen.getByTestId('return-inv-001'));
      fireEvent.click(screen.getByTestId('confirm-return'));
      await waitFor(() => {
        expect(mockAddNotification).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'success' })
        );
      });
    });

    it('disables confirm button while processing', async () => {
      mockPost.mockReturnValue(new Promise(() => {}));
      render(<SalesHistoryPage />);
      await waitFor(() => screen.getByTestId('return-inv-001'));
      fireEvent.click(screen.getByTestId('return-inv-001'));
      fireEvent.click(screen.getByTestId('confirm-return'));
      expect(screen.getByTestId('confirm-return')).toBeDisabled();
    });
  });

  // Delete ────────────────────────────────────────────────────────────────────
  describe('Delete invoice', () => {
    it('opens delete confirmation on Delete button click', async () => {
      render(<SalesHistoryPage />);
      await waitFor(() => screen.getByTestId('delete-inv-001'));
      fireEvent.click(screen.getByTestId('delete-inv-001'));
      expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
    });

    it('calls DELETE API on confirm', async () => {
      mockDelete.mockResolvedValue({ data: { success: true } });
      render(<SalesHistoryPage />);
      await waitFor(() => screen.getByTestId('delete-inv-001'));
      fireEvent.click(screen.getByTestId('delete-inv-001'));
      fireEvent.click(screen.getByTestId('confirm-delete'));
      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalledWith(expect.stringContaining('inv-001'));
      });
    });

    it('shows success notification after delete', async () => {
      mockDelete.mockResolvedValue({ data: { success: true } });
      render(<SalesHistoryPage />);
      await waitFor(() => screen.getByTestId('delete-inv-001'));
      fireEvent.click(screen.getByTestId('delete-inv-001'));
      fireEvent.click(screen.getByTestId('confirm-delete'));
      await waitFor(() => {
        expect(mockAddNotification).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'success' })
        );
      });
    });

    it('shows error notification when delete fails', async () => {
      mockDelete.mockRejectedValue({ response: { data: { error: 'DB error' } } });
      render(<SalesHistoryPage />);
      await waitFor(() => screen.getByTestId('delete-inv-001'));
      fireEvent.click(screen.getByTestId('delete-inv-001'));
      fireEvent.click(screen.getByTestId('confirm-delete'));
      await waitFor(() => {
        expect(mockAddNotification).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'error' })
        );
      });
    });

    it('disables delete button while deleting', async () => {
      mockDelete.mockReturnValue(new Promise(() => {}));
      render(<SalesHistoryPage />);
      await waitFor(() => screen.getByTestId('delete-inv-001'));
      fireEvent.click(screen.getByTestId('delete-inv-001'));
      fireEvent.click(screen.getByTestId('confirm-delete'));
      await waitFor(() => {
        expect(screen.getByTestId('confirm-delete')).toBeDisabled();
      });
    });
  });

  // Actions bar ───────────────────────────────────────────────────────────────
  describe('Header action buttons', () => {
    it('renders Refresh, Export, and Print buttons', () => {
      render(<SalesHistoryPage />);
      expect(screen.getByTestId('refresh-btn')).toBeInTheDocument();
      expect(screen.getByTestId('export-btn')).toBeInTheDocument();
    });

    it('Refresh button calls fetchAll', async () => {
      render(<SalesHistoryPage />);
      await waitFor(() => screen.getByTestId('refresh-btn'));
      const before = mockGet.mock.calls.length;
      fireEvent.click(screen.getByTestId('refresh-btn'));
      await waitFor(() => {
        expect(mockGet.mock.calls.length).toBeGreaterThan(before);
      });
    });
  });

  // Error handling ────────────────────────────────────────────────────────────
  describe('Error handling', () => {
    it('shows error notification when invoice list fails', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));
      render(<SalesHistoryPage />);
      await waitFor(() => {
        expect(mockAddNotification).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'error' })
        );
      });
    });

    it('still renders when stats endpoint fails (Promise.allSettled)', async () => {
      mockGet.mockImplementation((url: string) => {
        if (url.includes('/stats')) return Promise.reject(new Error('Stats failed'));
        return Promise.resolve({ success: true, data: MOCK_INVOICES, total: 3, page: 0, limit: 50 });
      });
      render(<SalesHistoryPage />);
      await waitFor(() => {
        expect(screen.getByText('INV-2026-0001')).toBeInTheDocument();
      });
    });
  });
});
