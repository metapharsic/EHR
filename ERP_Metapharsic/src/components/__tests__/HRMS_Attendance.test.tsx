
/**
 * HRMS Attendance & Leave Modules Component Tests
 * Tests: Attendance Grid (June 2026), Leave Requests, Auto-load Automation
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
    Clock: () => <div data-testid="icon-clock" />,
    RefreshCw: () => <div data-testid="icon-refresh" />,
    CheckCircle: () => <div data-testid="icon-check-circle" />,
    Plus: () => <div data-testid="icon-plus" />,
    Calendar: () => <div data-testid="icon-calendar" />,
    Sun: () => <div data-testid="icon-sun" />,
    X: () => <div data-testid="icon-x" />
  };
});

vi.mock('../../services/hrmsService', () => ({
  default: {
    getHeadcountAnalytics: vi.fn().mockResolvedValue({ total: 10, active: 10 }),
    getAttritionAnalytics: vi.fn().mockResolvedValue({ overall_rate: 0 }),
    aiWeeklyBriefing: vi.fn().mockResolvedValue({ executiveSummary: 'Attendance looks good.' }),
    getEmployees: vi.fn().mockResolvedValue([{ id: 'emp1', name: 'John Doe', employee_code: 'EMP001' }]),
    getAttendanceSummary: vi.fn().mockResolvedValue([
      { 
        employee_id: 'emp1', 
        employee_name: 'John Doe', 
        days: [
          { date: '2026-06-01', status: 'Present' },
          { date: '2026-06-02', status: 'Late' },
          { date: '2026-06-03', status: 'WFH' },
          { date: '2026-06-04', status: 'Leave' }
        ] 
      }
    ]),
    getTeamCalendar: vi.fn().mockResolvedValue({ 
      leaves: [
        { id: 'l1', employee_id: 'emp1', employee_name: 'John Doe', leave_type: 'Casual', start_date: '2026-06-10', end_date: '2026-06-12', days: 3, status: 'Pending' }
      ] 
    }),
    approveLeave: vi.fn().mockResolvedValue({ success: true }),
    applyLeave: vi.fn().mockResolvedValue({ success: true }),
    getPayrollSlips: vi.fn().mockResolvedValue([]),
    getPayrollAnomalies: vi.fn().mockResolvedValue([]),
    getDiversityAnalytics: vi.fn().mockResolvedValue({}),
    getPayrollCostAnalytics: vi.fn().mockResolvedValue({}),
    getIncidents: vi.fn().mockResolvedValue([]),
    getRewards: vi.fn().mockResolvedValue([]),
    getShifts: vi.fn().mockResolvedValue([]),
    getHolidays: vi.fn().mockResolvedValue([]),
    getSalaryStructures: vi.fn().mockResolvedValue([]),
    getPfRegister: vi.fn().mockResolvedValue([]),
    getEsicRegister: vi.fn().mockResolvedValue([]),
    getPtRegister: vi.fn().mockResolvedValue([]),
    getReimbursements: vi.fn().mockResolvedValue([]),
    getBenefitsPlans: vi.fn().mockResolvedValue([]),
    getBenefitsEnrollments: vi.fn().mockResolvedValue([]),
    getDepartments: vi.fn().mockResolvedValue([]),
    getDeptTree: vi.fn().mockResolvedValue([]),
    getRequisitions: vi.fn().mockResolvedValue([]),
    getCandidates: vi.fn().mockResolvedValue([]),
    getOffers: vi.fn().mockResolvedValue([]),
    getDocuments: vi.fn().mockResolvedValue([]),
    getOffboarding: vi.fn().mockResolvedValue({}),
    getOnboarding: vi.fn().mockResolvedValue({}),
  }
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}));

describe('HRMS Attendance & Leave Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('auto-loads June 2026 Attendance Grid', async () => {
    render(<HRMS />);
    
    // Switch to Attendance
    fireEvent.click(screen.getByText(/^Attendance$/));
    
    // Check for auto-load trigger
    await waitFor(() => {
      expect(hrmsService.getAttendanceSummary).toHaveBeenCalledWith({ empId: '', month: 6, year: 2026 });
    });
    
    // Check for indicators
    expect(await screen.findByText('John Doe')).toBeInTheDocument();
    
    // Specific indicators (using titles or text)
    expect(screen.getByTitle(/Present - 1 June/)).toBeInTheDocument();
    expect(screen.getByTitle(/Late - 2 June/)).toBeInTheDocument();
    expect(screen.getByTitle(/WFH - 3 June/)).toBeInTheDocument();
    expect(screen.getByTitle(/Leave - 4 June/)).toBeInTheDocument();
  });

  it('renders Leave Requests and automates Attendance Refresh on approval', async () => {
    render(<HRMS />);
    
    // Switch to Attendance first to populate attendanceData state
    fireEvent.click(screen.getByText(/^Attendance$/));
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Go to Leave
    fireEvent.click(screen.getByText(/Leave Management/i));
    
    // Should auto-load leave
    await waitFor(() => {
      expect(hrmsService.getTeamCalendar).toHaveBeenCalled();
    });
    
    expect(await screen.findByText('John Doe')).toBeInTheDocument();
    
    // Approve Leave
    const approveButton = screen.getByTitle('Approve');
    fireEvent.click(approveButton);
    
    await waitFor(() => {
      expect(hrmsService.approveLeave).toHaveBeenCalledWith('l1');
      // Should trigger attendance refresh (it's the 2nd call now, 1st was on init)
      expect(hrmsService.getAttendanceSummary).toHaveBeenCalledTimes(2);
    });
  });

  it('allows applying for new leave', async () => {
    render(<HRMS />);
    fireEvent.click(screen.getByText(/Leave Management/i));
    
    // Initial load of employees happens when view is active
    await waitFor(() => {
       expect(hrmsService.getEmployees).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText(/Apply Leave/i));
    
    expect(screen.getByText(/Grant \/ Apply for Leave/i)).toBeInTheDocument();
    
    // Select Recipient (using the new searchable selector)
    const selectors = screen.getAllByText('— Select —');
    fireEvent.click(selectors[0]);
    
    // Find the one in the search results - it's usually inside a custom-scrollbar div or has specific classes
    const searchResults = screen.getAllByText('John Doe');
    // The search result is the last one added to the DOM or we can check parent
    fireEvent.click(searchResults[searchResults.length - 1]);

    const fromInput = screen.getByLabelText(/From Date/i);
    const toInput = screen.getByLabelText(/To Date/i);
    
    fireEvent.change(fromInput, { target: { value: '2026-06-15' } });
    fireEvent.change(toInput, { target: { value: '2026-06-16' } });
    fireEvent.change(screen.getByPlaceholderText(/Explain the purpose/i), { target: { value: 'Family event' } });
    
    fireEvent.click(screen.getByText('Submit Application'));
    
    await waitFor(() => {
      // Should have been called with days: 2 (15th and 16th)
      expect(hrmsService.applyLeave).toHaveBeenCalledWith(expect.objectContaining({
        employee_id: 'emp1',
        days: 2
      }));
    });
  });
});
