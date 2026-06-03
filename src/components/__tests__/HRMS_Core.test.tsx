
/**
 * HRMS Core Modules Component Tests
 * Tests: Dashboard, Employees, Organization, Documents
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
  return { ...actual };
});

vi.mock('../../context/NotificationContext', () => ({
  useNotifications: () => ({
    addNotification: vi.fn(),
    notifications: [],
    removeNotification: vi.fn(),
  }),
}));

vi.mock('../../services/hrmsService', () => ({
  default: {
    getHeadcountAnalytics: vi.fn().mockResolvedValue({ total: 100, active: 95 }),
    getAttritionAnalytics: vi.fn().mockResolvedValue({ overall_rate: 2.5 }),
    aiWeeklyBriefing: vi.fn().mockResolvedValue({ executiveSummary: 'HR is doing well.' }),
    getEmployees: vi.fn().mockResolvedValue([
      { id: 'emp1', name: 'John Doe', first_name: 'John', last_name: 'Doe', employee_code: 'EMP001', status: 'Active', department_name: 'Engineering', join_date: '2026-05-21T18:30:00.000Z' }
    ]),
    getDepartments: vi.fn().mockResolvedValue([
      { id: 'dept1', name: 'Engineering' }
    ]),
    getDeptTree: vi.fn().mockResolvedValue([
      { id: 'dept1', name: 'Engineering', manager_name: 'Manager X', headcount: 10, children: [] }
    ]),
    getDocuments: vi.fn().mockResolvedValue([
      { id: 'doc1', doc_type: 'ID Proof', doc_name: 'passport.pdf', file_url: 'uploads/hr/passport.pdf', created_at: new Date().toISOString() }
    ]),
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

describe('HRMS Core Modules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Dashboard with stats and AI briefing', async () => {
    render(<HRMS />);
    
    // Check stats cards
    await waitFor(() => {
      expect(screen.getByText('100')).toBeInTheDocument(); // total_employees
      expect(screen.getByText('95')).toBeInTheDocument();  // active_employees
      expect(screen.getByText('2.5%')).toBeInTheDocument(); // attrition_rate
    });

    // Check AI Briefing
    expect(screen.getByText(/AI Weekly Briefing/i)).toBeInTheDocument();
    expect(screen.getByText('HR is doing well.')).toBeInTheDocument();
  });

  it('renders Employee list correctly', async () => {
    render(<HRMS />);
    
    const empNav = screen.getByText(/^Employees$/);
    fireEvent.click(empNav);
    
    // Use findByText for async data rendering
    expect(await screen.findByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('EMP001')).toBeInTheDocument();
    expect(screen.getAllByText('Engineering').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Organization chart', async () => {
    render(<HRMS />);
    
    const orgNav = screen.getByText(/^Organization$/);
    fireEvent.click(orgNav);
    
    expect(await screen.findByText('Organization Chart')).toBeInTheDocument();
    expect(screen.getByText('Manager X')).toBeInTheDocument();
    expect(screen.getByText('10 members')).toBeInTheDocument();
  });

  it('renders Documents module', async () => {
    render(<HRMS />);
    
    const docNav = screen.getByText(/^Documents$/);
    fireEvent.click(docNav);
    
    expect(await screen.findByText('Document Repository')).toBeInTheDocument();

    // Select employee
    const selectTrigger = screen.getAllByText('— Select —')[0];
    fireEvent.click(selectTrigger);
    
    // Choose the employee option John Doe
    const option = screen.getByText('John Doe');
    fireEvent.click(option);

    expect(await screen.findByText('ID Proof')).toBeInTheDocument();
    expect(screen.getByText('passport.pdf')).toBeInTheDocument();
  });
});
