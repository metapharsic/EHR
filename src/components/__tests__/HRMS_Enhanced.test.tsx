
/**
 * HRMS Enhanced Modules Component Tests
 * Tests: Document Repository with Searchable Selector, Shared Selection Sync
 */
/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import HRMS from '../HRMS';
import hrmsService from '../../services/hrmsService';

// Mock dependencies
vi.mock('lucide-react', async () => {
  const actual = await vi.importActual('lucide-react');
  return { ...actual, 
    Users: () => <div data-testid="icon-users" />,
    ChevronDown: () => <div data-testid="icon-chevron-down" />,
    Search: () => <div data-testid="icon-search" />
  };
});

vi.mock('../../services/hrmsService', () => ({
  default: {
    getHeadcountAnalytics: vi.fn().mockResolvedValue({ total: 10, active: 10 }),
    getAttritionAnalytics: vi.fn().mockResolvedValue({ overall_rate: 0 }),
    aiWeeklyBriefing: vi.fn().mockResolvedValue({ executiveSummary: 'HR is doing well.' }),
    getEmployees: vi.fn().mockResolvedValue([
      { id: 'emp1', name: 'John Doe', employee_code: 'EMP001', status: 'Active', department_name: 'Engineering', designation_name: 'Lead' },
      { id: 'emp2', name: 'Jane Smith', employee_code: 'EMP002', status: 'Active', department_name: 'HR', designation_name: 'Manager' }
    ]),
    getDocuments: vi.fn().mockResolvedValue([
      { id: 'doc1', doc_type: 'Offer Letter', doc_name: 'offer.pdf', file_url: 'uploads/hr/offer.pdf', created_at: new Date().toISOString() }
    ]),
    getOffboarding: vi.fn().mockResolvedValue({}),
    getTimesheets: vi.fn().mockResolvedValue([]),
    getDepartments: vi.fn().mockResolvedValue([]),
    getDeptTree: vi.fn().mockResolvedValue([]),
    getRequisitions: vi.fn().mockResolvedValue([]),
    getCandidates: vi.fn().mockResolvedValue([]),
    getPayrollSlips: vi.fn().mockResolvedValue([]),
    getPayrollAnomalies: vi.fn().mockResolvedValue([]),
    getDiversityAnalytics: vi.fn().mockResolvedValue({}),
    getPayrollCostAnalytics: vi.fn().mockResolvedValue({}),
    getIncidents: vi.fn().mockResolvedValue([]),
    getRewards: vi.fn().mockResolvedValue([]),
    getTeamCalendar: vi.fn().mockResolvedValue({ leaves: [] }),
    getShifts: vi.fn().mockResolvedValue([]),
    getHolidays: vi.fn().mockResolvedValue([]),
    getSalaryStructures: vi.fn().mockResolvedValue([]),
    getPfRegister: vi.fn().mockResolvedValue([]),
    getEsicRegister: vi.fn().mockResolvedValue([]),
    getPtRegister: vi.fn().mockResolvedValue([]),
    getReimbursements: vi.fn().mockResolvedValue([]),
    getBenefitsPlans: vi.fn().mockResolvedValue([]),
    getBenefitsEnrollments: vi.fn().mockResolvedValue([]),
  }
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}));

describe('HRMS Enhanced Employee Selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Searchable EmployeeSelector in Documents', async () => {
    render(<HRMS />);
    
    // Go to Documents
    fireEvent.click(screen.getByText(/^Documents$/));
    
    // Check for Document Repository placeholder
    expect(await screen.findByText('Document Repository')).toBeInTheDocument();
    
    // Find the selector (it shows "— Select —" by default)
    // There are two: one in header, one in placeholder. We'll pick the one in the placeholder (larger box)
    const selectors = screen.getAllByText('— Select —');
    fireEvent.click(selectors[1]); // The one in the placeholder
    
    // Search for Jane
    const searchInput = screen.getByPlaceholderText(/Search name, code, or department/i);
    fireEvent.change(searchInput, { target: { value: 'Jane' } });
    
    // Should see Jane Smith
    expect(await screen.findByText('Jane Smith')).toBeInTheDocument();
    
    // Select Jane
    fireEvent.click(screen.getByText('Jane Smith'));
    
    // Check if documents loaded for Jane
    await waitFor(() => {
      expect(hrmsService.getDocuments).toHaveBeenCalledWith('emp2');
      expect(screen.getByText('offer.pdf')).toBeInTheDocument();
    });
  });

  it('synchronizes selection from Employee Profile to Documents', async () => {
    render(<HRMS />);
    
    // Go to Employees list
    fireEvent.click(screen.getByText(/^Employees$/));
    
    // Use findByText to wait for employees to load
    const johnEntry = await screen.findByText('John Doe');
    
    // Click view on John Doe (it sets selectedEmp)
    // Find the nearest eye button
    const johnRow = johnEntry.closest('tr');
    const johnViewButton = johnRow?.querySelector('button'); // First button is Eye
    if (johnViewButton) fireEvent.click(johnViewButton);

    // Now go to Documents
    fireEvent.click(screen.getByText(/^Documents$/));
    
    // It should automatically load John Doe's documents because of our sync useEffect
    await waitFor(() => {
      const selectors = screen.getAllByText(/John Doe \(EMP001\)/);
      expect(selectors.length).toBeGreaterThan(0);
      expect(hrmsService.getDocuments).toHaveBeenCalledWith('emp1');
    });
  });
});
