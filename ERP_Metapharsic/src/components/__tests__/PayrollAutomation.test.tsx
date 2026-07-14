
/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Payroll from '../Payroll';

vi.mock('../../services/apiClient', () => ({
  apiClient: {
    get: vi.fn().mockImplementation((url: string) => {
      if (url.includes('/hr/employees')) {
        return Promise.resolve({ success: true, data: [{ id: '1', name: 'John Doe', baseSalary: 30000 }] });
      }
      if (url.includes('/hr/payroll/anomalies')) {
        return Promise.resolve({ success: true, data: [{ name: 'John Doe', description: 'Excessive deductions' }] });
      }
      if (url.includes('/hr/payroll/slips')) {
        return Promise.resolve({ success: true, data: [{ id: 'slip-1', employeeId: '1', employeeName: 'John Doe', netPay: 28000 }] });
      }
      return Promise.resolve({ success: true, data: [] });
    }),
    post: vi.fn().mockImplementation((url: string) => {
      if (url.includes('/hr/payroll/process-bulk')) {
        return Promise.resolve({ success: true, slipsProcessed: 1, voucherId: 'v-123' });
      }
      return Promise.resolve({ success: false });
    })
  }
}));

describe('Payroll Bulk Automation', () => {
  it('renders anomaly warnings correctly', async () => {
    render(<Payroll />);
    await waitFor(() => {
      expect(screen.getByText(/AI Anomaly Detection/i)).toBeInTheDocument();
      expect(screen.getByText(/Excessive deductions/i)).toBeInTheDocument();
    });
  });

  it('renders the bulk automation button and handles click', async () => {
    // Mock window.confirm
    vi.stubGlobal('confirm', () => true);
    // Mock window.alert
    const alertMock = vi.fn();
    vi.stubGlobal('alert', alertMock);

    render(<Payroll />);
    
    // Wait for the button to render
    const btn = await screen.findByRole('button', { name: /Run Automated Payroll Batch/i });
    expect(btn).toBeInTheDocument();

    fireEvent.click(btn);

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('Processed 1 slips'));
    });
  });
});
