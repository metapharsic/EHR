
/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { IntelligenceDashboard } from '../IntelligenceDashboard';
import React from 'react';

// Mock dependencies
vi.mock('../../store/useAppStore', () => ({
  useAppStore: () => ({
    addNotification: vi.fn(),
  }),
}));

describe('IntelligenceDashboard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    localStorage.setItem('accessToken', 'test-token');
  });

  it('renders stats from API correctly', async () => {
    // Mock API responses
    // Financials — kpis and intelligence are SIBLINGS, not nested
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          kpis: {
            forecastedCash30d: '1500000',
            currentRatio: '2.50',
            netProfitMargin: '18.5%',
            workingCapital: 500000,
            burnRate: '120000.00',
          },
          intelligence: { status: 'HEALTHY', recommendation: 'Stable' },
          trends: [],
        }
      })
    }); // Financials

    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { driftingCount: 5, lostCount: 2 }
      })
    }); // Customers

    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { monthlyRevenue: 50000, growth: 15.5 }
      })
    }); // POS Stats

    render(<IntelligenceDashboard />);

    // Wait for async data to render
    await waitFor(() => {
      expect(screen.getByText('₹50.0k')).toBeInTheDocument(); // 50000 / 1000 = 50.0k
      expect(screen.getByText('+15.5%')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument(); // driftingCount
    });

    expect(screen.getByText('POS Revenue (30d)')).toBeInTheDocument();
    expect(screen.getByText('Customers at Risk')).toBeInTheDocument();

    // Financial KPI — forecastedCash30d: 1500000 → ₹1.5M
    expect(screen.getByText('₹1.5M')).toBeInTheDocument();
    expect(screen.getByText('Cash Flow Prediction (30d)')).toBeInTheDocument();

    // Intelligence status — HEALTHY
    expect(screen.getByText('HEALTHY')).toBeInTheDocument();

    // Health score: CR=2.5→25pts, margin=18.5%→~23pts, WC>0→25pts, status HEALTHY→25pts = 98
    const healthScoreEl = screen.getByTestId('health-score');
    const score = parseInt(healthScoreEl.textContent ?? '0', 10);
    expect(score).toBeGreaterThanOrEqual(80); // should be "Excellent"
  });

  it('handles API failure gracefully', async () => {
    (fetch as any).mockRejectedValue(new Error('API Failure'));

    render(<IntelligenceDashboard />);

    await waitFor(() => {
      expect(screen.queryByText('₹50.0k')).not.toBeInTheDocument();
    });
  });
});
