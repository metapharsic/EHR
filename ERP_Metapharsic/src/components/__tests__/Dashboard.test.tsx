/**
 * @vitest-environment jsdom
 *
 * Dashboard Component — UI Tests
 * Covers:
 *   - Renders executive dashboard header
 *   - Stat cards (Sales, Profit, Low Stock, Near Expiry) appear
 *   - Widget config panel open/close
 *   - Hide-all and show-all widget toggles actually hide/show sections
 *   - Task manager: add, toggle complete, delete, search, filter
 *   - Tasks loaded from DB on mount via getAllTasks()
 *   - Employee Performance Monitor renders MR leaderboard
 *   - AI Assistant section gated by widget config
 *
 * Run: npx vitest run src/components/__tests__/Dashboard.test.tsx
 */

/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import Dashboard from '../Dashboard';

// ── Mocks ──────────────────────────────────────────────────────────────────────

// vi.mock calls are hoisted — data must be defined INSIDE the factory (no top-level vars)

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', username: 'admin', name: 'Admin User', role: 'ADMIN' },
    hasPermission: () => true,
  }),
}));

vi.mock('../../services/geminiService', () => ({
  generateSmartInsights: vi.fn().mockResolvedValue('AI response text'),
}));

vi.mock('../../services/databaseService', () => ({
  getAllEmployees: vi.fn().mockResolvedValue([
    {
      id: 'mr-1', name: 'Rajesh Kumar', contact: '9876543210', email: 'r@test.com',
      headquarters: 'Hyderabad', assignedArea: 'Zone A',
      salesTarget: 500000, totalSales: 520000, targetAchievement: 104,
      status: 'Active', joinDate: '2023-01-01',
    },
    {
      id: 'mr-2', name: 'Priya Sharma', contact: '9876543211', email: 'p@test.com',
      headquarters: 'Secunderabad', assignedArea: 'Zone B',
      salesTarget: 400000, totalSales: 280000, targetAchievement: 70,
      status: 'Active', joinDate: '2023-03-15',
    },
  ]),
  getEmployeePerformanceStats: vi.fn().mockResolvedValue({
    totalEmployees: 2,
    activeEmployees: 2,
    starPerformers: 1,
    attentionNeeded: 1,
    averageAchievement: 87,
  }),
  initializeSampleData: vi.fn().mockResolvedValue(undefined),
  getAllTasks: vi.fn().mockResolvedValue([
    {
      id: 'task-1', title: 'Review Q1 Report', priority: 'High', completed: false,
      category: 'Accounts', dueDate: '2026-06-10',
    },
  ]),
}));

vi.mock('../../constants', () => ({
  DASHBOARD_STATS: {
    todaySales: 125000,
    todayProfit: 27500,
    lowStockCount: 8,
    nearExpiryCount: 3,
    paymentSummary: { Cash: 60000, UPI: 45000, Card: 20000 },
    outstandingCredit: 18500,
  },
  MOCK_SALES_DATA: [
    { date: 'Jan', sales: 100000 },
    { date: 'Feb', sales: 120000 },
  ],
  MOCK_PRODUCTS: [],
  MOCK_INVOICES: [],
}));

const onNavigate = vi.fn();

// ── Helpers ────────────────────────────────────────────────────────────────────

function renderDashboard() {
  return render(<Dashboard onNavigate={onNavigate} />);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Dashboard — Header', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(cleanup);

  it('renders the "Executive Dashboard" heading', async () => {
    renderDashboard();
    expect(screen.getByText('Executive Dashboard')).toBeInTheDocument();
  });

  it('shows a "Customize" button', async () => {
    renderDashboard();
    // The button has the text "Customize" (inside a span); use exact match
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /customize/i })).toBeInTheDocument()
    );
  });
});

describe('Dashboard — Stat Cards', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(cleanup);

  it("shows Today's Sales card with rupee value", async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByText("Today's Sales")).toBeInTheDocument());
    // Locale formatting varies (₹1,25,000 vs ₹125,000) — just verify a ₹ value is shown
    const salesCard = screen.getByText("Today's Sales").closest('[class*="rounded"]');
    const cardText = salesCard?.textContent ?? '';
    expect(cardText).toMatch(/₹[\d,]+/);
  });

  it("shows Today's Profit for admin", async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByText("Today's Profit")).toBeInTheDocument());
  });

  it('shows Low Stock Alert card', async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Low Stock Alert')).toBeInTheDocument());
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('shows Near Expiry card', async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Near Expiry')).toBeInTheDocument());
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});

describe('Dashboard — Widget Configuration', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(cleanup);

  it('opens widget config panel when Customize is clicked', async () => {
    renderDashboard();
    const btn = screen.getByRole('button', { name: /customize/i });
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByText('Dashboard Widgets')).toBeInTheDocument());
  });

  it('hides Sales Chart section when salesChart widget is toggled off', async () => {
    renderDashboard();
    const customizeBtn = screen.getByRole('button', { name: /customize/i });
    fireEvent.click(customizeBtn);

    // Find the Sales Performance widget toggle button
    await waitFor(() => screen.getByText('Sales Performance'));
    const widgets = screen.getAllByText('Sales Performance');
    const widgetCard = widgets[0].closest('[class*="rounded"]');
    const toggleBtn = widgetCard?.querySelector('button:last-of-type');
    if (toggleBtn) fireEvent.click(toggleBtn);

    await waitFor(() =>
      expect(screen.queryByText('Monthly Sales Overview')).not.toBeInTheDocument()
    );
  });

  it('Hide All hides all widgets, Show All restores them', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: /customize/i }));

    await waitFor(() => screen.getByText('Hide All'));
    fireEvent.click(screen.getByText('Hide All'));

    // Sales Chart and AI Assistant should be gone
    await waitFor(() => {
      expect(screen.queryByText('Monthly Sales Overview')).not.toBeInTheDocument();
      expect(screen.queryByText('Smart Assistant')).not.toBeInTheDocument();
    });

    // Show All restores them
    fireEvent.click(screen.getByText('Show All'));
    await waitFor(() => {
      expect(screen.getByText('Monthly Sales Overview')).toBeInTheDocument();
    });
  });
});

describe('Dashboard — Task Manager', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(cleanup);

  it('loads tasks from DB on mount', async () => {
    renderDashboard();
    // mockTasks includes "Review Q1 Report"
    await waitFor(() => expect(screen.getByText('Review Q1 Report')).toBeInTheDocument());
  });

  it('adds a new task via modal', async () => {
    renderDashboard();
    await waitFor(() => screen.getByTitle('Add New Task'));
    fireEvent.click(screen.getByTitle('Add New Task'));

    await waitFor(() => screen.getByPlaceholderText('Enter task title...'));
    fireEvent.change(screen.getByPlaceholderText('Enter task title...'), {
      target: { value: 'New urgent task' },
    });
    fireEvent.click(screen.getByText('Add Task'));

    await waitFor(() => expect(screen.getByText('New urgent task')).toBeInTheDocument());
  });

  it('toggles task completion', async () => {
    renderDashboard();
    await waitFor(() => screen.getByText('Review Q1 Report'));

    // The checkbox button is the first button in the task row
    const taskRow = screen.getByText('Review Q1 Report').closest('[class*="rounded"]');
    const checkBtn = taskRow?.querySelector('button:first-of-type');
    if (checkBtn) {
      fireEvent.click(checkBtn);
      await waitFor(() => {
        const taskText = screen.getByText('Review Q1 Report');
        expect(taskText).toHaveClass('line-through');
      });
    }
  });

  it('filters tasks by category', async () => {
    renderDashboard();
    await waitFor(() => screen.getByText('Review Q1 Report'));

    // Click "HR" category filter — task is Accounts so should not be visible
    fireEvent.click(screen.getByText('HR'));
    await waitFor(() =>
      expect(screen.queryByText('Review Q1 Report')).not.toBeInTheDocument()
    );
  });

  it('searches tasks by title', async () => {
    renderDashboard();
    await waitFor(() => screen.getByText('Review Q1 Report'));

    const searchInput = screen.getByPlaceholderText('Search tasks...');
    fireEvent.change(searchInput, { target: { value: 'zzznotfound' } });
    await waitFor(() =>
      expect(screen.queryByText('Review Q1 Report')).not.toBeInTheDocument()
    );
  });
});

describe('Dashboard — Employee Performance Monitor', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(cleanup);

  it('renders Employee Performance Monitor heading', async () => {
    renderDashboard();
    await waitFor(() =>
      expect(screen.getByText('Employee Performance Monitor')).toBeInTheDocument()
    );
  });

  it('shows Star Performers count from MR stats', async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Star Performers')).toBeInTheDocument());
    // starPerformers = 1 — find the specific KPI tile
    const starTile = screen.getByText('Star Performers').closest('[class*="rounded"]');
    expect(starTile?.textContent).toMatch(/1/);
  });

  it('lists MR names in the leaderboard', async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Rajesh Kumar')).toBeInTheDocument());
    expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
  });

  it('shows target achievement percentages', async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByText('104%')).toBeInTheDocument());
    expect(screen.getByText('70%')).toBeInTheDocument();
  });

  it('shows avg achievement in footer', async () => {
    renderDashboard();
    await waitFor(() =>
      expect(screen.getByText(/Avg: 87% Target/)).toBeInTheDocument()
    );
  });
});

describe('Dashboard — AI Assistant Widget', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(cleanup);

  it('renders Smart Assistant section by default', async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Smart Assistant')).toBeInTheDocument());
  });

  it('hides AI Assistant when aiAssistant widget is toggled off via Hide All', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: /customize/i }));
    await waitFor(() => screen.getByText('Hide All'));
    fireEvent.click(screen.getByText('Hide All'));
    await waitFor(() =>
      expect(screen.queryByText('Smart Assistant')).not.toBeInTheDocument()
    );
  });
});

describe('Dashboard — Field Force Chart', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(cleanup);

  it('renders Field Force Performance heading', async () => {
    renderDashboard();
    await waitFor(() =>
      expect(screen.getByText('Field Force Performance')).toBeInTheDocument()
    );
  });

  it('hides Field Force section when fieldForce widget disabled', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: /customize/i }));
    await waitFor(() => screen.getByText('Hide All'));
    fireEvent.click(screen.getByText('Hide All'));
    await waitFor(() =>
      expect(screen.queryByText('Field Force Performance')).not.toBeInTheDocument()
    );
  });
});
