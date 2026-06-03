
/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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
      return Promise.resolve({ success: true, data: [] });
    }),
  }
}));

describe('Payroll AI Enhancement', () => {
  it('renders anomaly warnings correctly', async () => {
    render(<Payroll />);
    await waitFor(() => {
      expect(screen.getByText(/AI Anomaly Detection/i)).toBeInTheDocument();
      expect(screen.getByText(/Excessive deductions/i)).toBeInTheDocument();
    });
  });
});
