/**
 * Component Tests — HRMS Active Onboarding Panel
 * Covers: sidebar nav to Onboarding, Load button, spinner, checklist render,
 *         task completion, overdue badge, empty state, auto-reload after complete.
 *
 * Run: npx vitest run src/components/__tests__/HRMS.onboarding.test.tsx
 */
/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

// ── Lucide: keep real icons to avoid SVG render issues ──────────────────────
vi.mock('lucide-react', async () => {
  const actual = await vi.importActual('lucide-react');
  return { ...actual };
});

// ── Notification context ────────────────────────────────────────────────────
const mockAddNotification = vi.fn();
vi.mock('../../context/NotificationContext', () => ({
  useNotifications: () => ({ addNotification: mockAddNotification, notifications: [], removeNotification: vi.fn() }),
}));

// ── Zustand store ───────────────────────────────────────────────────────────
vi.mock('../../store/useAppStore', () => ({
  useAppStore: (selector: any) =>
    selector({ addNotification: mockAddNotification, notifications: [] }),
}));

// ── hrmsService — full mock ──────────────────────────────────────────────────
const mockHrmsService = {
  getActiveOnboardings: vi.fn(),
  updateOnboardingTask: vi.fn(),
  // All other methods used by HRMS on mount / route changes — return safe defaults
  getEmployees: vi.fn().mockResolvedValue([]),
  getDepartments: vi.fn().mockResolvedValue([]),
  getDesignations: vi.fn().mockResolvedValue([]),
  getSalaryStructures: vi.fn().mockResolvedValue([]),
  getDashboardStats: vi.fn().mockResolvedValue({ activeEmployees: 0, averageAchievement: 0 }),
  getHrStats: vi.fn().mockResolvedValue({}),
  getOrgChart: vi.fn().mockResolvedValue([]),
  getRequisitions: vi.fn().mockResolvedValue([]),
  getCandidates: vi.fn().mockResolvedValue([]),
  getOffers: vi.fn().mockResolvedValue([]),
  getAtsAnalytics: vi.fn().mockResolvedValue({}),
  getLeaves: vi.fn().mockResolvedValue([]),
  getLeaveBalances: vi.fn().mockResolvedValue([]),
  getAttendance: vi.fn().mockResolvedValue([]),
  getPayroll: vi.fn().mockResolvedValue([]),
  getIncidents: vi.fn().mockResolvedValue([]),
  getRewards: vi.fn().mockResolvedValue([]),
  getAiBriefing: vi.fn().mockResolvedValue({ summary: '' }),
  getPredictiveAnalytics: vi.fn().mockResolvedValue({}),
  getBenefits: vi.fn().mockResolvedValue([]),
  getShifts: vi.fn().mockResolvedValue([]),
  getTimesheets: vi.fn().mockResolvedValue([]),
  getStatutory: vi.fn().mockResolvedValue({}),
  getReimbursements: vi.fn().mockResolvedValue([]),
  getAnalytics: vi.fn().mockResolvedValue({}),
  getCopilot: vi.fn().mockResolvedValue({ response: '' }),
};

vi.mock('../../services/hrmsService', () => ({ default: mockHrmsService }));

// ── apiClient fallback ───────────────────────────────────────────────────────
vi.mock('../../services/apiClient', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ success: true, data: [] }),
    post: vi.fn().mockResolvedValue({ success: true }),
    put: vi.fn().mockResolvedValue({ success: true }),
    delete: vi.fn().mockResolvedValue({ success: true }),
  },
}));

// ── Mock data ────────────────────────────────────────────────────────────────
const MOCK_CHECKLISTS = [
  {
    id: 'cl-1',
    employee_id: 'emp-1',
    employee_name: 'Ananya Singh',
    employee_code: 'EMP-0042',
    status: 'In Progress' as const,
    start_date: '2026-05-01',
    created_at: '2026-05-01T00:00:00Z',
    tasks: [
      { id: 't-1', title: 'Send Welcome Email', task_name: 'Send Welcome Email', category: 'Communication', owner_type: 'HR', status: 'Completed', due_date: '2026-05-01', completed_at: '2026-05-01T10:00:00Z' },
      { id: 't-2', title: 'Laptop & Equipment Setup', task_name: 'Laptop & Equipment Setup', category: 'IT Setup', owner_type: 'IT', status: 'Pending', due_date: '2026-05-02' },
      { id: 't-3', title: 'PF & ESIC Enrollment', task_name: 'PF & ESIC Enrollment', category: 'Benefits', owner_type: 'HR', status: 'Pending', due_date: '2026-05-06' },
    ],
  },
  {
    id: 'cl-2',
    employee_id: 'emp-2',
    employee_name: 'Rahul Mehta',
    employee_code: 'EMP-0043',
    status: 'Overdue' as const,
    start_date: '2026-04-01',
    created_at: '2026-04-01T00:00:00Z',
    tasks: [
      { id: 't-4', title: 'Complete Joining Formalities', task_name: 'Complete Joining Formalities', category: 'Documentation', owner_type: 'HR', status: 'Pending', due_date: '2026-04-02' },
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
let HRMS: React.ComponentType;

beforeEach(async () => {
  vi.clearAllMocks();
  mockHrmsService.getActiveOnboardings.mockResolvedValue([]);
  mockHrmsService.updateOnboardingTask.mockResolvedValue({ success: true });

  // Re-import to pick up fresh mocks (vitest caches modules — clear first)
  vi.resetModules();
  const mod = await import('../HRMS');
  HRMS = mod.default;
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Render HRMS and navigate the sidebar to the Onboarding view */
async function renderAndGoToOnboarding() {
  await act(async () => {
    render(<HRMS />);
  });
  // The sidebar renders buttons with exact label text
  const onboardingBtn = await screen.findByRole('button', { name: /^Onboarding$/i });
  await act(async () => {
    fireEvent.click(onboardingBtn);
  });
}

// ── Empty state ──────────────────────────────────────────────────────────────
describe('Active Onboarding Panel — empty state', () => {
  it('shows empty-state after navigation (no Load clicked)', async () => {
    await renderAndGoToOnboarding();
    expect(await screen.findByText(/No active onboarding checklists/i)).toBeInTheDocument();
    expect(screen.getByText(/fetch current in-progress onboardings/i)).toBeInTheDocument();
  });
});

// ── Load button ──────────────────────────────────────────────────────────────
describe('Active Onboarding Panel — Load button', () => {
  it('Load button exists and is enabled initially', async () => {
    await renderAndGoToOnboarding();
    const loadBtn = await screen.findByRole('button', { name: /^Load$/i });
    expect(loadBtn).not.toBeDisabled();
  });

  it('clicking Load calls getActiveOnboardings', async () => {
    mockHrmsService.getActiveOnboardings.mockResolvedValueOnce(MOCK_CHECKLISTS);
    await renderAndGoToOnboarding();
    const loadBtn = screen.getByRole('button', { name: /^Load$/i });

    await act(async () => { fireEvent.click(loadBtn); });

    await waitFor(() =>
      expect(mockHrmsService.getActiveOnboardings).toHaveBeenCalledTimes(1)
    );
  });

  it('Load is disabled during fetch', async () => {
    let doResolve!: (v: any) => void;
    mockHrmsService.getActiveOnboardings.mockReturnValueOnce(
      new Promise((r) => { doResolve = r; })
    );
    await renderAndGoToOnboarding();
    const loadBtn = screen.getByRole('button', { name: /^Load$/i });

    fireEvent.click(loadBtn);
    expect(loadBtn).toBeDisabled();

    await act(async () => { doResolve([]); });
    await waitFor(() => expect(loadBtn).not.toBeDisabled());
  });

  it('renders employee names after Load', async () => {
    mockHrmsService.getActiveOnboardings.mockResolvedValueOnce(MOCK_CHECKLISTS);
    await renderAndGoToOnboarding();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Load$/i })); });

    expect(await screen.findByText('Ananya Singh')).toBeInTheDocument();
    expect(await screen.findByText('Rahul Mehta')).toBeInTheDocument();
  });

  it('shows error notification when API fails', async () => {
    mockHrmsService.getActiveOnboardings.mockRejectedValueOnce(new Error('network'));
    await renderAndGoToOnboarding();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Load$/i })); });

    await waitFor(() =>
      expect(mockAddNotification).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' })
      )
    );
  });
});

// ── Checklist card rendering ─────────────────────────────────────────────────
describe('Active Onboarding Panel — checklist cards', () => {
  beforeEach(() => {
    mockHrmsService.getActiveOnboardings.mockResolvedValue(MOCK_CHECKLISTS);
  });

  /** Find the expand chevron button that belongs to a specific card (by employee name) */
  function getExpandBtnForCard(employeeName: string) {
    const heading = screen.getByText(employeeName);
    // Walk up to the card div (has "rounded-xl" in className)
    let card: HTMLElement | null = heading.parentElement;
    while (card && !card.className.includes('rounded-xl')) {
      card = card.parentElement;
    }
    if (!card) throw new Error(`Card not found for ${employeeName}`);
    // The expand button has className "p-1 hover:bg-slate-50 rounded" and no text
    const buttons = Array.from(card.querySelectorAll('button'));
    const expandBtn = buttons.find((b) => !b.textContent?.trim());
    if (!expandBtn) throw new Error(`Expand button not found in card for ${employeeName}`);
    return expandBtn as HTMLElement;
  }

  async function loadChecklists() {
    await renderAndGoToOnboarding();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Load$/i })); });
    await screen.findByText('Ananya Singh');
  }

  it('renders progress percentage (1 Completed out of 3 = 33%)', async () => {
    await loadChecklists();
    expect(screen.getByText('33% Complete')).toBeInTheDocument();
    expect(screen.getByText('1/3 tasks')).toBeInTheDocument();
  });

  it('renders Overdue badge for the overdue checklist', async () => {
    await loadChecklists();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });

  it('renders employee code next to name', async () => {
    await loadChecklists();
    expect(screen.getByText('EMP-0042')).toBeInTheDocument();
  });

  it('expands task list when chevron is clicked', async () => {
    await loadChecklists();
    // Tasks should not be visible until expanded
    expect(screen.queryByText('Laptop & Equipment Setup')).toBeNull();

    const expand = getExpandBtnForCard('Ananya Singh');
    await act(async () => { fireEvent.click(expand); });

    expect(await screen.findByText('Laptop & Equipment Setup')).toBeInTheDocument();
  });

  it('shows category badge on expanded tasks', async () => {
    await loadChecklists();
    const expand = getExpandBtnForCard('Ananya Singh');
    await act(async () => { fireEvent.click(expand); });

    // Scope to the card so we don't collide with sidebar "Benefits" nav item
    const heading = screen.getByText('Ananya Singh');
    let card: HTMLElement | null = heading.parentElement;
    while (card && !card.className.includes('rounded-xl')) card = card.parentElement;

    const { within: rtlWithin } = await import('@testing-library/react');
    expect(rtlWithin(card!).getByText('IT Setup')).toBeInTheDocument();
    expect(rtlWithin(card!).getByText('Benefits')).toBeInTheDocument();
  });

  it('completed task title has line-through style', async () => {
    await loadChecklists();
    const expand = getExpandBtnForCard('Ananya Singh');
    await act(async () => { fireEvent.click(expand); });

    const completedTaskEl = await screen.findByText('Send Welcome Email');
    expect(completedTaskEl.className).toContain('line-through');
  });
});

// ── Task completion ──────────────────────────────────────────────────────────
describe('Active Onboarding Panel — task completion', () => {
  beforeEach(() => {
    mockHrmsService.getActiveOnboardings.mockResolvedValue(MOCK_CHECKLISTS);
    mockHrmsService.updateOnboardingTask.mockResolvedValue({ success: true });
  });

  function getExpandBtnForCard(employeeName: string) {
    const heading = screen.getByText(employeeName);
    let card: HTMLElement | null = heading.parentElement;
    while (card && !card.className.includes('rounded-xl')) {
      card = card.parentElement;
    }
    if (!card) throw new Error(`Card not found for ${employeeName}`);
    const buttons = Array.from(card.querySelectorAll('button'));
    const expandBtn = buttons.find((b) => !b.textContent?.trim());
    if (!expandBtn) throw new Error(`Expand button not found in card for ${employeeName}`);
    return expandBtn as HTMLElement;
  }

  async function loadAndExpand() {
    await renderAndGoToOnboarding();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Load$/i })); });
    await screen.findByText('Ananya Singh');

    const expand = getExpandBtnForCard('Ananya Singh');
    await act(async () => { fireEvent.click(expand); });
    await screen.findByText('Laptop & Equipment Setup');
  }

  it('Complete button calls updateOnboardingTask with Completed status', async () => {
    await loadAndExpand();
    const completeBtns = screen.getAllByRole('button', { name: /Complete/i });
    await act(async () => { fireEvent.click(completeBtns[0]); });

    await waitFor(() =>
      expect(mockHrmsService.updateOnboardingTask).toHaveBeenCalledWith(
        't-2',
        expect.objectContaining({ status: 'Completed' })
      )
    );
  });

  it('auto-reloads (calls getActiveOnboardings twice) after task complete', async () => {
    await loadAndExpand();
    // getActiveOnboardings already called once for Load
    const countBefore = (mockHrmsService.getActiveOnboardings as any).mock.calls.length;

    const completeBtns = screen.getAllByRole('button', { name: /Complete/i });
    await act(async () => { fireEvent.click(completeBtns[0]); });

    await waitFor(() =>
      expect(mockHrmsService.getActiveOnboardings).toHaveBeenCalledTimes(countBefore + 1)
    );
  });

  it('shows success notification after marking complete', async () => {
    await loadAndExpand();
    const completeBtns = screen.getAllByRole('button', { name: /Complete/i });
    await act(async () => { fireEvent.click(completeBtns[0]); });

    await waitFor(() =>
      expect(mockAddNotification).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'success' })
      )
    );
  });

  it('shows error notification when updateOnboardingTask fails', async () => {
    mockHrmsService.updateOnboardingTask.mockRejectedValueOnce(new Error('DB error'));
    await loadAndExpand();
    const completeBtns = screen.getAllByRole('button', { name: /Complete/i });
    await act(async () => { fireEvent.click(completeBtns[0]); });

    await waitFor(() =>
      expect(mockAddNotification).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', message: 'Failed to update task' })
      )
    );
  });

  it('Complete button is disabled while update is in flight', async () => {
    let doResolve!: (v: any) => void;
    mockHrmsService.updateOnboardingTask.mockReturnValueOnce(
      new Promise((r) => { doResolve = r; })
    );
    await loadAndExpand();

    const completeBtns = screen.getAllByRole('button', { name: /Complete/i });
    fireEvent.click(completeBtns[0]);
    // Button should be disabled immediately
    expect(completeBtns[0]).toBeDisabled();

    await act(async () => { doResolve({ success: true }); });
  });
});
