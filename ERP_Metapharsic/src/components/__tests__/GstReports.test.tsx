import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GstReports } from '../GstReports';
import { GstService } from '../../services/accountingService';
import { useCompany } from '../../context/CompanyContext';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';

vi.mock('../../services/accountingService', () => ({
  GstService: {
    getGstr1: vi.fn(),
    getGstr2: vi.fn(),
    getGstr3b: vi.fn()
  }
}));

vi.mock('../../context/CompanyContext', () => ({
  useCompany: vi.fn()
}));

vi.mock('../../utils/accountingExport', () => ({
  printReport: vi.fn(),
  exportGSTReport: vi.fn()
}));

describe('GstReports Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useCompany as any).mockReturnValue({ company: { name: 'Test Co' } });
  });

  it('renders and loads GSTR-3B by default', async () => {
    (GstService.getGstr3b as any).mockResolvedValue({
      success: true,
      data: [{ id: '3.1.a', desc: 'Supplies', igst: 100, cgst: 50, sgst: 50, cess: 0 }]
    });

    render(<GstReports />);
    
    expect(screen.getByText(/GSTR-3B \(Summary\)/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('3.1.a')).toBeInTheDocument();
      expect(screen.getByText('Supplies')).toBeInTheDocument();
    });
  });

  it('switches to GSTR-1 and loads data', async () => {
    (GstService.getGstr3b as any).mockResolvedValue({ success: true, data: [] });
    (GstService.getGstr1 as any).mockResolvedValue({
      success: true,
      data: [{ invoiceNo: 'INV-001', partyName: 'Customer A', taxableValue: 1000, totalGst: 180, igst: 180, cgst: 0, sgst: 0, invoiceDate: '2025-04-10' }]
    });

    render(<GstReports />);
    
    const gstr1Tab = screen.getByText(/GSTR-1 \(Outward\)/i);
    fireEvent.click(gstr1Tab);

    await waitFor(() => {
      expect(screen.getByText('INV-001')).toBeInTheDocument();
      expect(screen.getByText('Customer A')).toBeInTheDocument();
    });
  });

  it('displays reconciliation status in GSTR-2', async () => {
    (GstService.getGstr3b as any).mockResolvedValue({ success: true, data: [] });
    (GstService.getGstr2 as any).mockResolvedValue({
      success: true,
      data: [{ 
        invoiceNo: 'PUR-001', 
        partyName: 'Supplier X', 
        taxableValue: 5000, 
        totalGst: 900, 
        igst: 900, 
        cgst: 0, 
        sgst: 0, 
        invoiceDate: '2025-04-15',
        status: 'Matched'
      }]
    });

    render(<GstReports />);
    
    const gstr2Tab = screen.getByText(/GSTR-2A\/2B \(Recon\)/i);
    fireEvent.click(gstr2Tab);

    await waitFor(() => {
      expect(screen.getByText('PUR-001')).toBeInTheDocument();
      expect(screen.getByText(/Matched/i)).toBeInTheDocument();
    });
  });

  it('displays error message on API failure', async () => {
    (GstService.getGstr3b as any).mockRejectedValue(new Error('API Error'));

    render(<GstReports />);
    
    await waitFor(() => {
      expect(screen.getByText('API Error')).toBeInTheDocument();
    });
  });
});
