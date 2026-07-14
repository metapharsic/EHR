/**
 * Component Tests — Settings Module
 * Tests: tab navigation, form validation, API calls on save/load,
 *        error handling, backup/restore, factory reset confirmation.
 *
 * Run: npx vitest run src/components/__tests__/Settings.test.tsx
 */
/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

// ── Lucide ────────────────────────────────────────────────────────────────────
vi.mock('lucide-react', async () => {
  const actual = await vi.importActual('lucide-react');
  return { ...actual };
});

// ── Notification context ──────────────────────────────────────────────────────
const mockAddNotification = vi.fn();
vi.mock('../../context/NotificationContext', () => ({
  useNotifications: () => ({ addNotification: mockAddNotification, notifications: [], removeNotification: vi.fn(), clearAllNotifications: vi.fn() }),
}));

// ── Zustand store ─────────────────────────────────────────────────────────────
const mockStore = {
  addNotification: mockAddNotification,
  isDarkMode: false,
  toggleDarkMode: vi.fn(),
  notifications: [],
};
vi.mock('../../store/useAppStore', () => ({
  useAppStore: (selector?: any) =>
    typeof selector === 'function' ? selector(mockStore) : mockStore,
}));

// ── CompanyContext ────────────────────────────────────────────────────────────
const mockClearCompany = vi.fn();
vi.mock('../../context/CompanyContext', () => ({
  useCompany: () => ({
    company: null,
    initializeCompany: vi.fn(),
    updateCompany: vi.fn(),
    clearCompany: mockClearCompany,
  }),
}));

// ── settingsService ───────────────────────────────────────────────────────────
const mockSettingsService = {
  getCompany: vi.fn().mockResolvedValue(null),
  saveCompany: vi.fn().mockResolvedValue({ name: 'Test Co' }),
  getParameters: vi.fn().mockResolvedValue(null),
  saveParameters: vi.fn().mockResolvedValue({ financialYear: '2026 - 2027' }),
  getNotifications: vi.fn().mockResolvedValue(null),
  saveNotifications: vi.fn().mockResolvedValue({}),
  getSecurity: vi.fn().mockResolvedValue(null),
  saveSecurity: vi.fn().mockResolvedValue({}),
  getAppearance: vi.fn().mockResolvedValue(null),
  saveAppearance: vi.fn().mockResolvedValue({}),
  exportAll: vi.fn().mockResolvedValue({ metadata: { exportedAt: new Date().toISOString() }, company: null }),
  importAll: vi.fn().mockResolvedValue(undefined),
  resetAll: vi.fn().mockResolvedValue(undefined),
};
vi.mock('../../services/settingsService', () => ({ default: mockSettingsService }));

// ── WhatsApp service ──────────────────────────────────────────────────────────
vi.mock('../../services/whatsappService', () => ({
  getWhatsAppConfig: () => ({ phoneNumber: '', apiKey: '', businessAccountId: '', enabled: false }),
  saveWhatsAppConfig: vi.fn(),
  testWhatsAppConfig: vi.fn().mockResolvedValue({ success: true, message: 'Connected' }),
  getPendingMessages: () => [],
  markMessageAsSent: vi.fn(),
}));

// ── apiClient ─────────────────────────────────────────────────────────────────
vi.mock('../../services/apiClient', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ success: true, data: null }),
    post: vi.fn().mockResolvedValue({ success: true }),
    put: vi.fn().mockResolvedValue({ success: true, data: {} }),
  },
}));

// ── CompanyForm (mock it to avoid its own API calls in these tests) ───────────
vi.mock('../CompanyForm', () => ({
  default: () => <div data-testid="company-form">CompanyForm</div>,
}));

// ── Import component after mocks ──────────────────────────────────────────────
let Settings: React.ComponentType;
beforeEach(async () => {
  vi.clearAllMocks();
  mockSettingsService.getParameters.mockResolvedValue(null);
  mockSettingsService.getNotifications.mockResolvedValue(null);
  mockSettingsService.getSecurity.mockResolvedValue(null);
  mockSettingsService.getAppearance.mockResolvedValue(null);
  mockSettingsService.saveParameters.mockResolvedValue({ financialYear: '2026 - 2027', gstEnabled: true });
  mockSettingsService.saveNotifications.mockResolvedValue({});
  mockSettingsService.saveSecurity.mockResolvedValue({});
  mockSettingsService.saveAppearance.mockResolvedValue({});
  mockSettingsService.exportAll.mockResolvedValue({ metadata: { exportedAt: new Date().toISOString() }, company: null });
  mockSettingsService.importAll.mockResolvedValue(undefined);
  mockSettingsService.resetAll.mockResolvedValue(undefined);

  vi.resetModules();
  const mod = await import('../Settings');
  Settings = mod.default;
});
afterEach(() => vi.restoreAllMocks());

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT & NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────
describe('Settings Layout', () => {
  it('renders the page header', async () => {
    await act(async () => { render(<Settings />); });
    expect(screen.getByText('System Settings')).toBeInTheDocument();
    expect(screen.getByText(/Manage company profile/i)).toBeInTheDocument();
  });

  it('renders all sidebar nav items', async () => {
    await act(async () => { render(<Settings />); });
    expect(screen.getByRole('button', { name: /^General$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Security$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Notifications$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Appearance$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Integrations$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Backup & Restore$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^About$/i })).toBeInTheDocument();
  });

  it('shows General tab content by default (CompanyForm stub)', async () => {
    await act(async () => { render(<Settings />); });
    expect(await screen.findByTestId('company-form')).toBeInTheDocument();
  });

  it('navigates to Security tab', async () => {
    await act(async () => { render(<Settings />); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Security$/i })); });
    expect(await screen.findByText('Login & Access Policy')).toBeInTheDocument();
  });

  it('navigates to Notifications tab', async () => {
    await act(async () => { render(<Settings />); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Notifications$/i })); });
    expect(await screen.findByText('Module Notifications')).toBeInTheDocument();
  });

  it('navigates to Backup & Restore tab', async () => {
    await act(async () => { render(<Settings />); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Backup & Restore$/i })); });
    expect(await screen.findByText('Data Backup')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GENERAL TAB — calls API on mount + save
// ─────────────────────────────────────────────────────────────────────────────
describe('GeneralTab — API integration', () => {
  it('calls getParameters on mount', async () => {
    await act(async () => { render(<Settings />); });
    await waitFor(() => expect(mockSettingsService.getParameters).toHaveBeenCalledTimes(1));
  });

  it('hydrates form from API response', async () => {
    mockSettingsService.getParameters.mockResolvedValueOnce({
      financialYear: '2025 - 2026',
      gstEnabled: false,
      inventoryMethod: 'Average',
      invoicePrefix: 'ORD',
      nextInvoiceNumber: 500,
      autoPrint: true,
      expiryAlertDays: 90,
      reorderAlertPercent: 30,
      currency: 'INR',
      dateFormat: 'DD/MM/YYYY',
      sessionTimeoutMinutes: 30,
    });
    await act(async () => { render(<Settings />); });

    await waitFor(() => {
      const invoicePrefixInput = document.querySelector('input[placeholder="INV"]') as HTMLInputElement;
      expect(invoicePrefixInput?.value).toBe('ORD');
    });
  });

  it('calls saveParameters when Save Changes is clicked', async () => {
    await act(async () => { render(<Settings />); });
    await waitFor(() => {});

    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    await act(async () => { fireEvent.click(saveBtn); });

    await waitFor(() => expect(mockSettingsService.saveParameters).toHaveBeenCalledTimes(1));
  });

  it('shows success notification after save', async () => {
    await act(async () => { render(<Settings />); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Save Changes/i })); });

    await waitFor(() =>
      expect(mockAddNotification).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'success', title: 'Application Parameters Saved' })
      )
    );
  });

  it('shows error notification when saveParameters fails', async () => {
    mockSettingsService.saveParameters.mockRejectedValueOnce(new Error('Network error'));
    await act(async () => { render(<Settings />); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Save Changes/i })); });

    await waitFor(() =>
      expect(mockAddNotification).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', title: 'Save Failed' })
      )
    );
  });

  it('dispatches erp:settings:parameters custom event after save', async () => {
    const listener = vi.fn();
    window.addEventListener('erp:settings:parameters', listener);
    await act(async () => { render(<Settings />); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Save Changes/i })); });

    await waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
    window.removeEventListener('erp:settings:parameters', listener);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY TAB
// ─────────────────────────────────────────────────────────────────────────────
describe('SecurityTab — API integration', () => {
  async function goToSecurity() {
    await act(async () => { render(<Settings />); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Security$/i })); });
  }

  it('calls getSecurity on navigation to Security tab', async () => {
    await goToSecurity();
    await waitFor(() => expect(mockSettingsService.getSecurity).toHaveBeenCalledTimes(1));
  });

  it('renders ipWhitelistEnabled toggle', async () => {
    await goToSecurity();
    expect(await screen.findByText('Enable IP Whitelist')).toBeInTheDocument();
  });

  it('calls saveSecurity when Save Changes clicked', async () => {
    await goToSecurity();
    const saveBtn = await screen.findByRole('button', { name: /Save Changes/i });
    await act(async () => { fireEvent.click(saveBtn); });

    await waitFor(() => expect(mockSettingsService.saveSecurity).toHaveBeenCalledTimes(1));
  });

  it('saveSecurity payload includes ipWhitelistEnabled field', async () => {
    await goToSecurity();
    const saveBtn = await screen.findByRole('button', { name: /Save Changes/i });
    await act(async () => { fireEvent.click(saveBtn); });

    await waitFor(() => {
      const call = mockSettingsService.saveSecurity.mock.calls[0][0];
      expect(call).toHaveProperty('ipWhitelistEnabled');
      expect(call).toHaveProperty('loginAttempts');
      expect(call).toHaveProperty('lockoutMinutes');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS TAB
// ─────────────────────────────────────────────────────────────────────────────
describe('NotificationsTab — API integration', () => {
  async function goToNotifications() {
    await act(async () => { render(<Settings />); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Notifications$/i })); });
  }

  it('calls getNotifications on mount', async () => {
    await goToNotifications();
    await waitFor(() => expect(mockSettingsService.getNotifications).toHaveBeenCalledTimes(1));
  });

  it('calls saveNotifications when Save Changes clicked', async () => {
    await goToNotifications();
    const saveBtn = await screen.findByRole('button', { name: /Save Changes/i });
    await act(async () => { fireEvent.click(saveBtn); });
    await waitFor(() => expect(mockSettingsService.saveNotifications).toHaveBeenCalledTimes(1));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// APPEARANCE TAB
// ─────────────────────────────────────────────────────────────────────────────
describe('AppearanceTab — API integration', () => {
  async function goToAppearance() {
    await act(async () => { render(<Settings />); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Appearance$/i })); });
  }

  it('calls getAppearance on mount', async () => {
    await goToAppearance();
    await waitFor(() => expect(mockSettingsService.getAppearance).toHaveBeenCalledTimes(1));
  });

  it('calls saveAppearance when Save Changes clicked', async () => {
    await goToAppearance();
    const saveBtn = await screen.findByRole('button', { name: /Save Changes/i });
    await act(async () => { fireEvent.click(saveBtn); });
    await waitFor(() => expect(mockSettingsService.saveAppearance).toHaveBeenCalledTimes(1));
  });

  it('saveAppearance payload includes darkMode and fontSize', async () => {
    await goToAppearance();
    const saveBtn = await screen.findByRole('button', { name: /Save Changes/i });
    await act(async () => { fireEvent.click(saveBtn); });

    await waitFor(() => {
      const call = mockSettingsService.saveAppearance.mock.calls[0][0];
      expect(call).toHaveProperty('darkMode');
      expect(call).toHaveProperty('fontSize');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BACKUP & RESTORE TAB
// ─────────────────────────────────────────────────────────────────────────────
describe('BackupTab — API integration', () => {
  async function goToBackup() {
    await act(async () => { render(<Settings />); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Backup & Restore$/i })); });
  }

  it('calls exportAll when Download Settings Backup is clicked', async () => {
    // Mock URL methods used in download
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
    global.URL.revokeObjectURL = vi.fn();

    await goToBackup();
    const downloadBtn = screen.getByText(/Download Settings Backup/i).closest('button')!;
    await act(async () => { fireEvent.click(downloadBtn); });

    await waitFor(() => expect(mockSettingsService.exportAll).toHaveBeenCalledTimes(1));
  });

  it('shows error notification if exportAll fails', async () => {
    mockSettingsService.exportAll.mockRejectedValueOnce(new Error('Server down'));
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:test');

    await goToBackup();
    const downloadBtn = screen.getByText(/Download Settings Backup/i).closest('button')!;
    await act(async () => { fireEvent.click(downloadBtn); });

    await waitFor(() =>
      expect(mockAddNotification).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', title: 'Backup Failed' })
      )
    );
  });

  it('shows Danger Zone / Factory Reset section', async () => {
    await goToBackup();
    expect(await screen.findByText('Factory Reset')).toBeInTheDocument();
    expect(screen.getByText(/Clears all ERP settings/i)).toBeInTheDocument();
  });

  it('opens confirmation modal when Reset System is clicked', async () => {
    await goToBackup();
    const resetBtn = screen.getByRole('button', { name: /Reset System/i });
    await act(async () => { fireEvent.click(resetBtn); });

    expect(await screen.findByText('Confirm Factory Reset')).toBeInTheDocument();
  });

  it('calls resetAll and clearCompany when confirmed', async () => {
    await goToBackup();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Reset System/i })); });
    const confirmBtn = await screen.findByRole('button', { name: /Yes, Reset Everything/i });
    await act(async () => { fireEvent.click(confirmBtn); });

    await waitFor(() => {
      expect(mockSettingsService.resetAll).toHaveBeenCalledTimes(1);
      expect(mockClearCompany).toHaveBeenCalledTimes(1);
    });
  });

  it('Cancel button dismisses the confirmation modal', async () => {
    await goToBackup();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Reset System/i })); });
    expect(screen.getByText('Confirm Factory Reset')).toBeInTheDocument();

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Cancel$/i })); });
    await waitFor(() => expect(screen.queryByText('Confirm Factory Reset')).not.toBeInTheDocument());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ABOUT TAB — uses CompanyContext not localStorage
// ─────────────────────────────────────────────────────────────────────────────
describe('AboutTab', () => {
  it('shows System Information section', async () => {
    await act(async () => { render(<Settings />); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^About$/i })); });
    expect(await screen.findByText('System Information')).toBeInTheDocument();
    expect(screen.getByText('Metapharsic Lifesciences ERP')).toBeInTheDocument();
  });
});
