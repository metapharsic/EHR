
/**
 * Journal Voucher Module Component Tests
 * Tests: F2 Shortcut, Automated Templates, Search/Filter logic
 */
/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { JournalVoucherManager } from '../JournalVoucherManager';
import { JournalVoucherService, ChartOfAccountsService } from '../../services/accountingService';

// Mock dependencies
vi.mock('../../services/accountingService', () => ({
  JournalVoucherService: {
    getAllJournalVouchers: vi.fn().mockResolvedValue([]),
    createJournalVoucher: vi.fn().mockResolvedValue({ id: 'jv1', voucherNo: 'JV-TEST-001' }),
    postJournalVoucher: vi.fn().mockResolvedValue({ status: 'Posted' }),
  },
  ChartOfAccountsService: {
    getAllAccounts: vi.fn().mockResolvedValue([
      { id: 'acc1', accountName: 'Rent Expense', accountCode: '5001' },
      { id: 'acc2', accountName: 'Provision for Rent', accountCode: '2001' },
      { id: 'acc3', accountName: 'Depreciation', accountCode: '5002' },
      { id: 'acc4', accountName: 'Accumulated Depreciation', accountCode: '1001' },
    ]),
  }
}));

vi.mock('../../context/CompanyContext', () => ({
  useCompany: () => ({ company: { name: 'Test Corp' } }),
}));

describe('JournalVoucherManager Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders JV list by default', async () => {
    render(<JournalVoucherManager />);
    expect(screen.getByText(/Journal Vouchers/i)).toBeInTheDocument();
    expect(screen.getByText(/Non-cash adjusting entries/i)).toBeInTheDocument();
  });

  it('opens new voucher form on F2 shortcut', async () => {
    render(<JournalVoucherManager />);
    fireEvent.keyDown(window, { key: 'F2' });
    expect(await screen.findByText(/Journal Voucher Entry/i)).toBeInTheDocument();
  });

  it('applies "Provision" template correctly', async () => {
    render(<JournalVoucherManager />);
    fireEvent.keyDown(window, { key: 'F2' });
    
    const provisionBtn = await screen.findByText('Provision');
    fireEvent.click(provisionBtn);
    
    // Check narration
    const narrationInput = screen.getByPlaceholderText(/Being amount paid\/received for/i);
    expect(narrationInput.value).toContain('Provision for expenses');
    
    // Check if rows are populated (Rent Expense and Provision for Rent should be matched)
    await waitFor(() => {
      const selects = screen.getAllByRole('combobox');
      // Each row has: Account (0), Dr/Cr (1), Cost Center (2)
      // Row 1: selects[0,1,2]
      // Row 2: selects[3,4,5]
      expect(selects[0].value).toBe('acc1'); // Matches 'expense'
      expect(selects[3].value).toBe('acc2'); // Matches 'provision' in 2nd row Account select
    });
  });

  it('applies "Depreciation" template correctly', async () => {
    render(<JournalVoucherManager />);
    fireEvent.keyDown(window, { key: 'F2' });
    
    const depBtn = await screen.findByText('Depreciation');
    fireEvent.click(depBtn);
    
    expect(screen.getByPlaceholderText(/Being amount paid\/received for/i).value).toContain('Depreciation');
    
    await waitFor(() => {
      const selects = screen.getAllByRole('combobox');
      expect(selects[0].value).toBe('acc3'); // Matches 'depreciation'
      expect(selects[3].value).toBe('acc4'); // Matches 'accumulated'
    });
  });

  it('triggers search/filter logic only on "Apply" click', async () => {
    render(<JournalVoucherManager />);
    
    const searchInput = screen.getByPlaceholderText(/Search voucher no/i);
    fireEvent.change(searchInput, { target: { value: 'JV-999' } });
    
    // Service should NOT have been called again yet (it's called once on mount)
    expect(JournalVoucherService.getAllJournalVouchers).toHaveBeenCalledTimes(1);
    
    const applyBtn = screen.getByText(/Apply/i);
    fireEvent.click(applyBtn);
    
    // Now it should be called again with filters
    expect(JournalVoucherService.getAllJournalVouchers).toHaveBeenCalledTimes(2);
  });
});
