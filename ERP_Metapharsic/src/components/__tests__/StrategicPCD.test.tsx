
/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

// 1. Mocks must be before imports that use them
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    hasPermission: () => true,
    user: { name: 'Admin', id: '1' }
  }),
  AuthProvider: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../../services/apiClient', () => {
  const mockApiClient = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  };
  return {
    apiClient: mockApiClient,
    default: mockApiClient,
  };
});

// Mock Database Service
vi.mock('../../services/databaseService', () => ({
  getAllPCDPartners: vi.fn(),
  getAllMedicalRepresentatives: vi.fn(),
  getAllPCDSchemes: vi.fn(),
  getAllPCDTargets: vi.fn(),
  getAllPCDTransactions: vi.fn(),
  savePCDPartner: vi.fn(),
  savePCDScheme: vi.fn(),
  savePCDTarget: vi.fn(),
  savePCDTransaction: vi.fn(),
}));

// Mock Lucide icons
vi.mock('lucide-react', async () => {
  const actual = await vi.importActual('lucide-react');
  return {
    ...actual,
  };
});

// Mock Recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="recharts-container">{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Cell: () => <div />,
  PieChart: ({ children }: any) => <div>{children}</div>,
  Pie: () => <div />,
  LineChart: ({ children }: any) => <div>{children}</div>,
  Line: () => <div />,
}));

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import StrategicPCD from '../StrategicPCD';
import apiClient from '../../services/apiClient';
import * as dbService from '../../services/databaseService';

describe('StrategicPCD Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Comprehensive mock for all GET calls
    (apiClient.get as any).mockImplementation((url: string) => {
      if (url.includes('/pcd/dashboard/summary')) {
        return Promise.resolve({
          success: true,
          data: { totalPartners: 15, totalRevenue: 2500000, avgTargetAchievement: 78.5 }
        });
      }
      if (url.includes('/pcd/partners')) {
        return Promise.resolve({
          success: true,
          data: [
            { id: '1', name: 'Global Pharma', territory: 'North', contact_number: '1234567890', email: 'global@pharma.com', drug_license_no: 'DL-12345', status: 'ACTIVE', join_date: '2026-01-01' }
          ]
        });
      }
      return Promise.resolve({ success: true, data: [] });
    });

    // Default DB mocks
    (dbService.getAllPCDPartners as any).mockResolvedValue([
      { id: '1', name: 'Global Pharma', territory: 'North', contact: '1234567890', email: 'global@pharma.com', drugLicenseNo: 'DL-12345', status: 'Active', joinDate: '2026-01-01' }
    ]);
    (dbService.getAllMedicalRepresentatives as any).mockResolvedValue([]);
    (dbService.getAllPCDSchemes as any).mockResolvedValue([]);
    (dbService.getAllPCDTargets as any).mockResolvedValue([]);
    (dbService.getAllPCDTransactions as any).mockResolvedValue([]);
  });

  it('renders dashboard with summary statistics from API', async () => {
    render(<StrategicPCD />);
    
    await waitFor(() => {
      expect(screen.getByText('15')).toBeInTheDocument(); 
      expect(screen.getByText('78.5%')).toBeInTheDocument();
    });

    expect(screen.getByText(/Strategic PCD Network Management/i)).toBeInTheDocument();
  });

  it('switches to Partners Network tab and loads data', async () => {
    render(<StrategicPCD />);
    
    // Switch tab by role
    const partnersTab = await screen.findByRole('button', { name: /Partners Network/i });
    fireEvent.click(partnersTab);

    // Wait for the data to appear in the content area
    const partnerName = await screen.findByText(/Global Pharma/i, {}, { timeout: 5000 });
    expect(partnerName).toBeInTheDocument();
  });

  it('opens onboarding modal', async () => {
    render(<StrategicPCD />);
    
    const onboardBtn = screen.getByText(/Add Partner/i);
    fireEvent.click(onboardBtn);

    await waitFor(() => {
      expect(screen.getByText(/Register New PCD Partner/i)).toBeInTheDocument();
    });
  });

  it('opens transaction modal when applying a scheme', async () => {
    (dbService.getAllPCDSchemes as any).mockResolvedValue([
      { id: 'S1', name: 'Summer Cardiac Drive', type: 'Volume', minimumOrder: 75000, discountPercentage: 4, description: 'Boost cardiac sales', validUntil: '2026-06-29' }
    ]);

    render(<StrategicPCD />);
    
    const schemesTab = await screen.findByText(/Schemes & Offers/i);
    fireEvent.click(schemesTab);

    // Wait for the card and click Apply
    const applyBtn = await screen.findByText(/Apply Scheme/i, {}, { timeout: 3000 });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(screen.getByText(/Apply Promotional Scheme/i)).toBeInTheDocument();
      // Check for name in the modal specifically (the amber alert box)
      expect(screen.getByText(/Applying: Summer Cardiac Drive/i)).toBeInTheDocument();
    });
  });
});
