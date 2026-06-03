/**
 * src/services/settingsService.ts
 * Typed API client for the Settings module.
 * Strategy: API is authoritative; localStorage is a read-through cache.
 *   - On LOAD  : fetch from API, fall back to localStorage if API fails
 *   - On SAVE  : write to API first, update localStorage on success
 */

import { apiClient } from './apiClient';

// ─── Shared Types ──────────────────────────────────────────────────────────────

export interface CompanyProfile {
  id?: string;
  name: string;
  businessType: string;
  taxStructure: string;
  valuationMethod: string;
  financialYearStart: string;
  financialYearEnd: string;
  gstin: string;
  vatNumber?: string;
  drugLicenseNo: string;
  foodLicenseNo?: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  country: string;
  phone: string;
  email: string;
  website?: string;
  logoUrl?: string;
  updatedAt?: string;
}

export interface AppParameters {
  financialYear: string;
  gstEnabled: boolean;
  inventoryMethod: string;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  autoPrint: boolean;
  expiryAlertDays: number;
  reorderAlertPercent: number;
  currency: string;
  dateFormat: string;
  sessionTimeoutMinutes: number;
  updatedAt?: string;
}

export interface NotificationPrefs {
  inventory: boolean;
  compliance: boolean;
  accounts: boolean;
  pos: boolean;
  hr: boolean;
  crm: boolean;
  updatedAt?: string;
}

export interface SecurityPolicy {
  loginAttempts: number;
  lockoutMinutes: number;
  requireStrongPassword: boolean;
  twoFactorForAdmin: boolean;
  ipWhitelistEnabled: boolean;
  auditAllActions: boolean;
  updatedAt?: string;
}

export interface AppearanceSettings {
  darkMode: boolean;
  fontSize: 'compact' | 'normal' | 'large';
  accentColor?: string;
  updatedAt?: string;
}

// ─── Storage Keys (mirror of server keys) ─────────────────────────────────────
const KEYS = {
  company:      'erp_company_profile',
  parameters:   'erp_app_parameters',
  notifications:'erp_notification_prefs',
  security:     'erp_security_settings',
  appearance:   'erp_appearance_settings',
} as const;

// ─── Cache helpers ─────────────────────────────────────────────────────────────
function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}

function writeCache(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
}

function removeCache(key: string): void {
  try { localStorage.removeItem(key); } catch { /* */ }
}

// ─── API helpers ───────────────────────────────────────────────────────────────
const unwrap = <T>(r: any): T => (r?.data !== undefined ? r.data : r);

// ─── Settings Service ──────────────────────────────────────────────────────────
export const settingsService = {

  // ── Company ───────────────────────────────────────────────────────────────────
  async getCompany(): Promise<CompanyProfile | null> {
    try {
      const res = await apiClient.get<any>('/settings/company');
      const data = unwrap<CompanyProfile | null>(res);
      if (data) writeCache(KEYS.company, data);
      return data;
    } catch {
      return readCache<CompanyProfile>(KEYS.company);
    }
  },

  async saveCompany(payload: Omit<CompanyProfile, 'updatedAt'>): Promise<CompanyProfile> {
    const res = await apiClient.put<any>('/settings/company', payload);
    const saved = unwrap<CompanyProfile>(res);
    writeCache(KEYS.company, saved);
    return saved;
  },

  // ── Parameters ────────────────────────────────────────────────────────────────
  async getParameters(): Promise<AppParameters | null> {
    try {
      const res = await apiClient.get<any>('/settings/parameters');
      const data = unwrap<AppParameters | null>(res);
      if (data) writeCache(KEYS.parameters, data);
      return data;
    } catch {
      return readCache<AppParameters>(KEYS.parameters);
    }
  },

  async saveParameters(payload: Omit<AppParameters, 'updatedAt'>): Promise<AppParameters> {
    const res = await apiClient.put<any>('/settings/parameters', payload);
    const saved = unwrap<AppParameters>(res);
    writeCache(KEYS.parameters, saved);
    return saved;
  },

  // ── Notification Prefs ────────────────────────────────────────────────────────
  async getNotifications(): Promise<NotificationPrefs | null> {
    try {
      const res = await apiClient.get<any>('/settings/notifications');
      const data = unwrap<NotificationPrefs | null>(res);
      if (data) writeCache(KEYS.notifications, data);
      return data;
    } catch {
      return readCache<NotificationPrefs>(KEYS.notifications);
    }
  },

  async saveNotifications(payload: NotificationPrefs): Promise<NotificationPrefs> {
    const res = await apiClient.put<any>('/settings/notifications', payload);
    const saved = unwrap<NotificationPrefs>(res);
    writeCache(KEYS.notifications, saved);
    return saved;
  },

  // ── Security Policy ───────────────────────────────────────────────────────────
  async getSecurity(): Promise<SecurityPolicy | null> {
    try {
      const res = await apiClient.get<any>('/settings/security');
      const data = unwrap<SecurityPolicy | null>(res);
      if (data) writeCache(KEYS.security, data);
      return data;
    } catch {
      return readCache<SecurityPolicy>(KEYS.security);
    }
  },

  async saveSecurity(payload: Omit<SecurityPolicy, 'updatedAt'>): Promise<SecurityPolicy> {
    const res = await apiClient.put<any>('/settings/security', payload);
    const saved = unwrap<SecurityPolicy>(res);
    writeCache(KEYS.security, saved);
    return saved;
  },

  // ── Appearance ────────────────────────────────────────────────────────────────
  async getAppearance(): Promise<AppearanceSettings | null> {
    try {
      const res = await apiClient.get<any>('/settings/appearance');
      const data = unwrap<AppearanceSettings | null>(res);
      if (data) writeCache(KEYS.appearance, data);
      return data;
    } catch {
      return readCache<AppearanceSettings>(KEYS.appearance);
    }
  },

  async saveAppearance(payload: Omit<AppearanceSettings, 'updatedAt'>): Promise<AppearanceSettings> {
    const res = await apiClient.put<any>('/settings/appearance', payload);
    const saved = unwrap<AppearanceSettings>(res);
    writeCache(KEYS.appearance, saved);
    return saved;
  },

  // ── Backup / Export ───────────────────────────────────────────────────────────
  async exportAll(): Promise<any> {
    const res = await apiClient.get<any>('/settings/export');
    return unwrap<any>(res);
  },

  async importAll(payload: any): Promise<void> {
    await apiClient.post<any>('/settings/import', payload);
    // Mirror into localStorage caches
    if (payload.company)                writeCache(KEYS.company,       payload.company);
    if (payload.appParameters)          writeCache(KEYS.parameters,    payload.appParameters);
    if (payload.notificationPreferences)writeCache(KEYS.notifications, payload.notificationPreferences);
    if (payload.securityPolicy)         writeCache(KEYS.security,      payload.securityPolicy);
    if (payload.appearance)             writeCache(KEYS.appearance,    payload.appearance);
  },

  // ── Factory Reset ─────────────────────────────────────────────────────────────
  async resetAll(): Promise<void> {
    await apiClient.post<any>('/settings/reset', {});
    Object.values(KEYS).forEach(removeCache);
  },

  // ── Cache utilities (for tests / forced refresh) ──────────────────────────────
  clearLocalCache(): void {
    Object.values(KEYS).forEach(removeCache);
  },

  readCacheCompany:      () => readCache<CompanyProfile>(KEYS.company),
  readCacheParameters:   () => readCache<AppParameters>(KEYS.parameters),
  readCacheNotifications:() => readCache<NotificationPrefs>(KEYS.notifications),
  readCacheSecurity:     () => readCache<SecurityPolicy>(KEYS.security),
  readCacheAppearance:   () => readCache<AppearanceSettings>(KEYS.appearance),
};

export default settingsService;
