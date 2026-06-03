/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CRM from '../CRM';
import { crmService } from '../../services/crmService';

// Mock Notification Context
vi.mock('../../context/NotificationContext', () => ({
  useNotifications: () => ({
    addNotification: vi.fn(),
  }),
  NotificationProvider: ({ children }: any) => <div>{children}</div>,
}));

// Mock Lucide icons
vi.mock('lucide-react', async () => {
  const actual = await vi.importActual('lucide-react');
  return {
    ...actual,
    Sparkles: () => <div data-testid="sparkles-icon" />,
    Brain: () => <div data-testid="brain-icon" />,
  };
});

// Mock Recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  AreaChart: ({ children }: any) => <div>{children}</div>,
  Area: () => <div />,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
  PieChart: () => <div />,
  Pie: () => <div />,
  Cell: () => <div />,
}));

// Mock the services and store
vi.mock('../../services/crmService', () => ({
  crmService: {
    getLeads: vi.fn(),
    getStats: vi.fn(),
    getLead: vi.fn(),
    generateStrategy: vi.fn(),
    triggerAiScoring: vi.fn(),
    getAiDraft: vi.fn(),
    convertToCustomer: vi.fn(),
    getAnalytics: vi.fn(),
  }
}));

vi.mock('../../store/useAppStore', () => ({
  useAppStore: () => ({
    addNotification: vi.fn(),
    activeTab: 'BOARD',
    setActiveTab: vi.fn(),
  })
}));

describe('CRM Component (Growth Command Center)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementation
    (crmService.getLeads as any).mockImplementation((filters: any) => {
      if (filters?.queue === 'today_and_overdue') {
        return Promise.resolve([
          { id: 'q1', name: 'Queue Lead', company_name: 'Queue Corp', status: 'New', priority: 'Urgent', next_follow_up: new Date().toISOString() }
        ]);
      }
      return Promise.resolve([
        { id: '1', name: 'Test Lead', company_name: 'Test Corp', status: 'New', priority: 'High', estimated_value: 50000, ai_sentiment: 'Hot', lead_score: 85 }
      ]);
    });

    (crmService.getStats as any).mockResolvedValue({
      total_leads: 10,
      new_leads: 5,
      total_pipeline_value: 5000000,
      conversion_rate: 15.5,
      active_pcd_partners: 25,
      monthly_sales_volume: 750000
    });

    (crmService.getAnalytics as any).mockResolvedValue({
      velocity: [{ name: 'Week 1', leads: 5, value: 50000 }],
      distribution: [{ name: 'New', value: 100000 }]
    });
  });

  it('renders the Growth Command Center title and unified stats', async () => {
    render(<CRM />);
    
    expect(await screen.findByText(/Growth Command Center/i)).toBeInTheDocument();
    
    // Check for standard CRM stats
    expect(screen.getByText('10')).toBeInTheDocument(); 
    expect(screen.getByText('₹50.0L')).toBeInTheDocument(); 
    
    // Check for Unified Growth stats
    expect(screen.getByText('25')).toBeInTheDocument(); 
    expect(screen.getByText('₹7.5L')).toBeInTheDocument(); 
  });

  it('displays leads in the Kanban board', async () => {
    render(<CRM />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Lead')).toBeInTheDocument();
      expect(screen.getByText('Test Corp')).toBeInTheDocument();
    });
  });

  it('renders Follow-up Queue correctly', async () => {
    render(<CRM />);
    
    const tasksTab = screen.getByText(/Follow-up Queue/i);
    fireEvent.click(tasksTab);
    
    await waitFor(() => {
      expect(screen.getByText('Active Follow-up Queue')).toBeInTheDocument();
      expect(screen.getByText('Queue Lead')).toBeInTheDocument();
      expect(screen.getByText('1 PENDING')).toBeInTheDocument();
    });
  });

  it('switches between tabs correctly', async () => {
    render(<CRM />);
    
    const intelligenceTab = screen.getByText(/AI Intelligence/i);
    fireEvent.click(intelligenceTab);
    
    await waitFor(() => {
      expect(screen.getByText(/Agentic AI Strategy Generator/i)).toBeInTheDocument();
      expect(screen.getByText(/Pipeline Velocity/i)).toBeInTheDocument();
    });
  });

  it('opens the registration modal', async () => {
    render(<CRM />);
    
    const registerBtn = screen.getByText(/Register Opportunity/i);
    fireEvent.click(registerBtn);
    
    expect(screen.getByText(/Register New Enterprise Opportunity/i)).toBeInTheDocument();
  });
});
