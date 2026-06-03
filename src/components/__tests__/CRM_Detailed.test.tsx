/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CRM from '../CRM';

// Mock formatters
vi.mock('../../utils/formatters', () => ({
  formatDate: vi.fn(d => d),
  formatCurrency: vi.fn(v => `₹${v}`),
}));

// Mock the services
vi.mock('../../services/crmService', () => ({
  crmService: {
    getLeads: vi.fn().mockResolvedValue([
      { id: '1', name: 'Lead One', company_name: 'Corp A', status: 'New', priority: 'High', lead_score: 80, ai_sentiment: 'Hot', estimated_value: 1000 },
      { id: '2', name: 'Lead Two', company_name: 'Corp B', status: 'Contacted', priority: 'Medium', lead_score: 50, ai_sentiment: 'Warm', estimated_value: 2000 }
    ]),
    getStats: vi.fn().mockResolvedValue({
      total_leads: 2,
      new_leads: 1,
      total_pipeline_value: 3000,
      conversion_rate: 10
    }),
    getAnalytics: vi.fn().mockResolvedValue({
      velocity: [{ name: 'Week 1', leads: 400, value: 2400 }],
      distribution: [{ name: '0-10k', value: 1200 }]
    }),
    triggerAiScoring: vi.fn().mockResolvedValue({ success: true }),
    getLead: vi.fn().mockResolvedValue({ id: '1', name: 'Lead One', lead_score: 85, ai_sentiment: 'Hot' }),
    generateStrategy: vi.fn().mockResolvedValue({
      priorityLeads: [{ id: '1', name: 'Lead One', reason: 'High demand' }],
      marketInsight: 'Strong growth in North',
      recommendedActions: ['Follow up Lead One']
    })
  }
}));

// Mock App Store
vi.mock('../../store/useAppStore', () => ({
  useAppStore: () => ({
    addNotification: vi.fn(),
  })
}));

// Mock Notification Context
vi.mock('../../context/NotificationContext', () => ({
  useNotifications: () => ({
    addNotification: vi.fn(),
  })
}));

describe('CRM High-Standard UI Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders stats ribbon with accurate data', async () => {
    render(<CRM />);
    await waitFor(() => {
      expect(screen.getByText('Pipeline Leads')).toBeDefined();
      expect(screen.getByText('2')).toBeDefined(); // stats.total_leads
    });
  });

  it('displays Kanban columns correctly', async () => {
    render(<CRM />);
    await waitFor(() => {
      // Find status headings
      expect(screen.getAllByText('New').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Contacted').length).toBeGreaterThan(0);
      // Find specific lead names
      expect(screen.getAllByText('Lead One').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Lead Two').length).toBeGreaterThan(0);
    });
  });

  it('opens the AI Intelligence tab and triggers optimization', async () => {
    render(<CRM />);
    const analyticsTabs = await screen.findAllByText(/AI Intelligence/i);
    fireEvent.click(analyticsTabs[0]);
    
    const optButton = await screen.findByText(/Initialize AI Optimization/i);
    fireEvent.click(optButton);

    await waitFor(() => {
      expect(screen.getByText(/AI Weekly Growth Strategy/i)).toBeDefined();
    }, { timeout: 3000 });
  });

  it('opens lead detail modal and shows AI Insights', async () => {
    render(<CRM />);
    const leadCards = await screen.findAllByText('Lead One');
    fireEvent.click(leadCards[0]);

    expect(screen.getByText(/Opportunity Intelligence/i)).toBeDefined();
    expect(screen.getByText(/Agentic Insights/i)).toBeDefined();
  });

  it('triggers AI recalculation in lead detail', async () => {
    render(<CRM />);
    const leadCards = await screen.findAllByText('Lead One');
    fireEvent.click(leadCards[0]);

    const recalcButton = screen.getByText(/Recalculate/i);
    fireEvent.click(recalcButton);

    await waitFor(() => {
      expect(screen.getByText('85%')).toBeDefined();
    });
  });
});
