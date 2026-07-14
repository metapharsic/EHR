/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import PCD from '../PCD';

// Mock formatters
vi.mock('../../utils/formatters', () => ({
  formatDate: vi.fn(d => d),
  formatCurrency: vi.fn(v => `₹${v}`),
}));

// Mock the services
vi.mock('../../services/pcdService', () => ({
  pcdService: {
    getPartners: vi.fn().mockResolvedValue({
      data: [
        { id: 'p1', name: 'Partner One', territory: 'Zone A', partner_grade: 'GOLD', status: 'ACTIVE', total_business: 50000 },
        { id: 'p2', name: 'Partner Two', territory: 'Zone B', partner_grade: 'SILVER', status: 'PENDING', total_business: 0 }
      ]
    }),
    getSchemes: vi.fn().mockResolvedValue([]),
    getTargets: vi.fn().mockResolvedValue([]),
    getMRs: vi.fn().mockResolvedValue({ data: [] }),
    getSummary: vi.fn().mockResolvedValue({
      data: { totalPartners: 2, totalRevenue: 50000, activeSchemes: 0, avgTargetAchievement: 0 }
    }),
    getPartner: vi.fn().mockResolvedValue({ data: { id: 'p1', name: 'Partner One', territory: 'Zone A', assigned_mr_ids: [] } })
  }
}));

// Mock Notification Context
vi.mock('../../context/NotificationContext', () => ({
  useNotifications: () => ({
    addNotification: vi.fn(),
  })
}));

describe('PCD Network UI Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders PCD dashboard with summary stats', async () => {
    render(<PCD />);
    await waitFor(() => {
      expect(screen.getAllByText('Network Partners').length).toBeGreaterThan(0);
      expect(screen.getAllByText('2').length).toBeGreaterThan(0); 
    });
  });

  it('displays partner list from database', async () => {
    render(<PCD />);
    await waitFor(() => {
      expect(screen.getAllByText('Partner One').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Zone A').length).toBeGreaterThan(0);
    });
  });

  it('opens partner details when clicked', async () => {
    render(<PCD />);
    const partnerCards = await screen.findAllByText('Partner One');
    fireEvent.click(partnerCards[0]);

    await waitFor(() => {
      expect(screen.getByText('Strategic Profile')).toBeDefined();
    });
  });

  it('shows onboarding modal when clicking add button', async () => {
    render(<PCD />);
    const addButtons = await screen.findAllByText(/Onboard Partner/i);
    fireEvent.click(addButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Onboard PCD Franchise Partner')).toBeDefined();
    });
  });
});
