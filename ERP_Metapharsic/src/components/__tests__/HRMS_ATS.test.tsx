
/**
 * HRMS ATS Modules Component Tests
 * Tests: Requisitions, Pipeline, Candidates, Offers, Search, Hire Automation
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
    UserPlus: () => <div data-testid="icon-user-plus" />,
    CheckCircle: () => <div data-testid="icon-check-circle" />,
    Plus: () => <div data-testid="icon-plus" />,
    Brain: () => <div data-testid="icon-brain" />,
    FilePlus: () => <div data-testid="icon-file-plus" />,
    Download: () => <div data-testid="icon-download" />,
    Eye: () => <div data-testid="icon-eye" />,
    Search: () => <div data-testid="icon-search" />
  };
});

vi.mock('../../services/hrmsService', () => ({
  default: {
    getHeadcountAnalytics: vi.fn().mockResolvedValue({ total: 10, active: 10 }),
    getAttritionAnalytics: vi.fn().mockResolvedValue({ overall_rate: 0 }),
    aiWeeklyBriefing: vi.fn().mockResolvedValue({ executiveSummary: 'ATS is active.' }),
    getEmployees: vi.fn().mockResolvedValue([]),
    getDepartments: vi.fn().mockResolvedValue([
      { id: 'dept1', name: 'Engineering' }
    ]),
    getRequisitions: vi.fn().mockResolvedValue([
      { id: 'req1', title: 'Software Engineer', department_name: 'Engineering', positions: 2, status: 'Approved' }
    ]),
    getCandidates: vi.fn().mockResolvedValue([
      { id: 'cand1', name: 'Alice Brown', email: 'alice@test.com', requisition_title: 'Software Engineer', stage: 'Sourced', ai_score: 85 }
    ]),
    getOffers: vi.fn().mockResolvedValue([]),
    getOnboarding: vi.fn().mockResolvedValue({}),
    getTimesheets: vi.fn().mockResolvedValue([]),
    getDeptTree: vi.fn().mockResolvedValue([]),
    approveRequisition: vi.fn().mockResolvedValue({ success: true }),
    createRequisition: vi.fn().mockResolvedValue({ success: true }),
    createCandidate: vi.fn().mockResolvedValue({ success: true }),
    moveCandidateStage: vi.fn().mockResolvedValue({ success: true }),
    hireCandidate: vi.fn().mockResolvedValue({ success: true }),
    aiScreenCandidate: vi.fn().mockResolvedValue({ fitScore: 90, strengths: [], gaps: [], recommendation: 'Shortlist', reason: 'Great' }),
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
    getDocuments: vi.fn().mockResolvedValue([]),
    getOffboarding: vi.fn().mockResolvedValue({}),
  }
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}));

describe('HRMS Recruitment / ATS Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Requisitions and creates new one', async () => {
    render(<HRMS />);
    
    // Go to Recruitment
    fireEvent.click(screen.getByText(/Recruitment \/ ATS/));
    
    // Should see current requisition
    expect(await screen.findByText('Software Engineer')).toBeInTheDocument();
    
    // Open Create Modal
    fireEvent.click(screen.getByText(/New Requisition/i));
    
    expect(screen.getByText(/Raise New Job Requisition/i)).toBeInTheDocument();
    
    // Fill form
    fireEvent.change(screen.getByPlaceholderText(/e.g. Senior Product Manager/i), { target: { value: 'Frontend Dev' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'dept1' } }); // Department
    
    // Submit
    fireEvent.click(screen.getByText('Raise Requisition'));
    
    await waitFor(() => {
      expect(hrmsService.createRequisition).toHaveBeenCalled();
    });
  });

  it('renders Pipeline and moves candidate stage', async () => {
    render(<HRMS />);
    fireEvent.click(screen.getByText(/Recruitment \/ ATS/));
    
    // Go to Pipeline
    fireEvent.click(screen.getByText(/^Pipeline$/));
    
    // Should see Alice Brown in Sourced
    expect(await screen.findByText('Alice Brown')).toBeInTheDocument();
    
    // Move stage
    const stageSelect = screen.getByRole('combobox');
    fireEvent.change(stageSelect, { target: { value: 'Screened' } });
    
    await waitFor(() => {
      expect(hrmsService.moveCandidateStage).toHaveBeenCalledWith('cand1', { stage: 'Screened' });
    });
  });

  it('searches for candidates', async () => {
    render(<HRMS />);
    fireEvent.click(screen.getByText(/Recruitment \/ ATS/));
    fireEvent.click(screen.getByText(/^Candidates$/));
    
    expect(await screen.findByText('Alice Brown')).toBeInTheDocument();
    
    // Search for Bob
    const searchInput = screen.getByPlaceholderText(/Search candidates/i);
    fireEvent.change(searchInput, { target: { value: 'Bob' } });
    
    expect(screen.queryByText('Alice Brown')).not.toBeInTheDocument();
    expect(screen.getByText(/No candidates matching filters/i)).toBeInTheDocument();
  });

  it('triggers AI Screening', async () => {
    render(<HRMS />);
    fireEvent.click(screen.getByText(/Recruitment \/ ATS/));
    fireEvent.click(screen.getByText(/^Candidates$/));
    
    const screenButtons = await screen.findAllByTitle(/AI Screen/i);
    fireEvent.click(screenButtons[0]);
    
    await waitFor(() => {
      expect(hrmsService.aiScreenCandidate).toHaveBeenCalledWith('cand1');
      expect(screen.getByText(/Fit Score/i)).toBeInTheDocument();
      expect(screen.getByText('90/100')).toBeInTheDocument();
    });
  });
});
