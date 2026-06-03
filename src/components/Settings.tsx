import React, { useState, useEffect, useRef } from 'react';
import {
  Save, Upload, Database, Shield, Server, FileJson, AlertTriangle, Download,
  RefreshCw, MessageCircle, CheckCircle, Building2, Bell, Users, Palette,
  Info, Settings as SettingsIcon, Lock, Zap, Globe, X, Eye, EyeOff,
  ChevronRight, Activity, FileText, CreditCard, Package, Loader2
} from 'lucide-react';
import CompanyForm from './CompanyForm';
import { getWhatsAppConfig, saveWhatsAppConfig, testWhatsAppConfig, getPendingMessages, markMessageAsSent } from '../services/whatsappService';
import { useNotifications } from '../context/NotificationContext';
import { useCompany } from '../context/CompanyContext';
import { useAppStore } from '../store/useAppStore';
import settingsService from '../services/settingsService';

// ─── Types ───────────────────────────────────────────────────────────────────

type SettingsTab =
  | 'general'
  | 'integrations'
  | 'backup'
  | 'security'
  | 'notifications'
  | 'appearance'
  | 'modules'
  | 'about';

interface AppParameters {
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
}

const DEFAULT_PARAMS: AppParameters = {
  financialYear: '',
  gstEnabled: true,
  inventoryMethod: 'FIFO',
  invoicePrefix: 'INV',
  nextInvoiceNumber: 1001,
  autoPrint: false,
  expiryAlertDays: 60,
  reorderAlertPercent: 20,
  currency: 'INR',
  dateFormat: 'DD/MM/YYYY',
  sessionTimeoutMinutes: 60,
};

const PARAMS_STORAGE_KEY = 'erp_app_parameters';
const NOTIFICATION_PREFS_KEY = 'erp_notification_prefs';

const loadParams = (): AppParameters => {
  try {
    const raw = localStorage.getItem(PARAMS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PARAMS };
    return { ...DEFAULT_PARAMS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PARAMS };
  }
};

const loadNotificationPrefs = () => {
  try {
    const raw = localStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (!raw) return { inventory: true, compliance: true, accounts: true, pos: true, hr: false, crm: false };
    return JSON.parse(raw);
  } catch {
    return { inventory: true, compliance: true, accounts: true, pos: true, hr: false, crm: false };
  }
};

// ─── Dynamic financial year options ──────────────────────────────────────────
const generateFinancialYears = (): string[] => {
  const now = new Date().getFullYear();
  const years: string[] = [];
  for (let y = now - 2; y <= now + 2; y++) {
    years.push(`${y} - ${y + 1}`);
  }
  return years;
};

// ─── Tiny reusable UI helpers ─────────────────────────────────────────────────

const Toggle: React.FC<{
  checked: boolean;
  onChange: (val: boolean) => void;
  id?: string;
  color?: 'green' | 'blue';
}> = ({ checked, onChange, id, color = 'green' }) => {
  const bg = color === 'blue'
    ? (checked ? 'bg-blue-500' : 'bg-slate-300')
    : (checked ? 'bg-green-500' : 'bg-slate-300');
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex w-12 h-6 rounded-full transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 ${color === 'blue' ? 'focus:ring-blue-500' : 'focus:ring-green-500'} ${bg}`}
    >
      <span
        className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow transition-transform duration-200 ${checked ? 'translate-x-6' : 'translate-x-0'}`}
      />
    </button>
  );
};

const SectionCard: React.FC<{
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, icon, children, className = '' }) => (
  <div className={`bg-white rounded-xl border border-slate-200 overflow-hidden ${className}`}>
    <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center gap-2.5">
      {icon && <span className="text-slate-600">{icon}</span>}
      <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const FormField: React.FC<{
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}> = ({ label, hint, error, required, children }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
      {label}{required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
    {hint && !error && <p className="text-[10px] text-slate-400 mt-1">{hint}</p>}
    {error && <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1"><AlertTriangle size={10} />{error}</p>}
  </div>
);

const SaveButton: React.FC<{
  onClick: () => void;
  loading?: boolean;
  label?: string;
}> = ({ onClick, loading, label = 'Save Changes' }) => (
  <button
    onClick={onClick}
    disabled={loading}
    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
  >
    {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={15} />}
    {loading ? 'Saving…' : label}
  </button>
);

// ─── Confirmation Modal ───────────────────────────────────────────────────────
const ConfirmModal: React.FC<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: 'red' | 'green';
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, title, message, confirmLabel = 'Confirm', confirmVariant = 'red', onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4" onClick={onCancel}>
      <div
        className="bg-white rounded-xl border border-slate-200 w-full max-w-md shadow-xl animate-fadeIn"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${confirmVariant === 'red' ? 'bg-red-100' : 'bg-green-100'}`}>
              <AlertTriangle size={18} className={confirmVariant === 'red' ? 'text-red-600' : 'text-green-600'} />
            </div>
            <h3 className="font-bold text-slate-800">{title}</h3>
          </div>
          <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
            <X size={16} />
          </button>
        </div>
        <div className="p-5">
          <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
        </div>
        <div className="px-5 pb-5 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-bold text-white rounded-lg transition-colors ${
              confirmVariant === 'red' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Sidebar Nav Item ─────────────────────────────────────────────────────────
const NavItem: React.FC<{
  id: SettingsTab;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  active: boolean;
  onClick: () => void;
}> = ({ icon, label, badge, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
      active
        ? 'bg-green-50 text-green-700 font-semibold shadow-[inset_3px_0_0_#22c55e]'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`}
  >
    <span className={`flex-shrink-0 ${active ? 'text-green-600' : 'text-slate-400'}`}>{icon}</span>
    <span className="flex-1 truncate">{label}</span>
    {badge !== undefined && badge > 0 && (
      <span className="text-[10px] font-bold bg-green-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
        {badge}
      </span>
    )}
    <ChevronRight size={14} className={`flex-shrink-0 transition-transform ${active ? 'text-green-500 translate-x-0.5' : 'text-slate-300'}`} />
  </button>
);

// ═══════════════════════════════════════════════════════════════════════════════
// TAB PANELS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── General Tab ─────────────────────────────────────────────────────────────
const GeneralTab: React.FC<{ addNotification: Function }> = ({ addNotification }) => {
  const [params, setParams] = useState<AppParameters>(loadParams);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const fy = generateFinancialYears();

  // On mount: load from API (authoritative), fall back to localStorage
  useEffect(() => {
    settingsService.getParameters().then(data => {
      if (data) {
        setParams(p => ({ ...DEFAULT_PARAMS, ...p, ...data }));
      } else if (!params.financialYear) {
        const now = new Date().getFullYear();
        setParams(p => ({ ...p, financialYear: `${now} - ${now + 1}` }));
      }
    }).catch(() => {
      if (!params.financialYear) {
        const now = new Date().getFullYear();
        setParams(p => ({ ...p, financialYear: `${now} - ${now + 1}` }));
      }
    }).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Persist to API + localStorage mirror
      await settingsService.saveParameters(params);

      // 2. Cross-module: broadcast to Zustand store so POS/Inventory react immediately
      window.dispatchEvent(new CustomEvent('erp:settings:parameters', { detail: params }));

      addNotification({
        type: 'success',
        title: 'Application Parameters Saved',
        message: 'Financial year, GST mode, and billing settings have been updated.',
        priority: 'low',
        module: 'SYSTEM',
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Save Failed',
        message: err?.message || 'Failed to save application parameters.',
        priority: 'high',
        module: 'SYSTEM',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Company Information */}
      <CompanyForm />

      {/* Application Parameters */}
      <SectionCard title="Application Parameters" icon={<Server size={16} />}>
        <div className="space-y-5">
          {/* Financial Year */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Financial Year" required>
              <select
                value={params.financialYear}
                onChange={e => setParams(p => ({ ...p, financialYear: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              >
                {fy.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </FormField>

            <FormField label="Inventory Valuation Method">
              <select
                value={params.inventoryMethod}
                onChange={e => setParams(p => ({ ...p, inventoryMethod: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              >
                <option value="FIFO">FIFO (First In, First Out)</option>
                <option value="LIFO">LIFO (Last In, First Out)</option>
                <option value="Average">Average Cost</option>
                <option value="LastPurchase">Last Purchase Rate</option>
              </select>
            </FormField>
          </div>

          {/* POS Settings */}
          <div className="border-t border-slate-100 pt-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">POS & Billing</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Invoice Prefix">
                <input
                  type="text"
                  value={params.invoicePrefix}
                  onChange={e => setParams(p => ({ ...p, invoicePrefix: e.target.value.toUpperCase() }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  placeholder="INV"
                  maxLength={6}
                />
              </FormField>
              <FormField label="Next Invoice Number">
                <input
                  type="number"
                  value={params.nextInvoiceNumber}
                  onChange={e => setParams(p => ({ ...p, nextInvoiceNumber: parseInt(e.target.value) || 1 }))}
                  min={1}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                />
              </FormField>
              <FormField label="Session Timeout">
                <select
                  value={params.sessionTimeoutMinutes}
                  onChange={e => setParams(p => ({ ...p, sessionTimeoutMinutes: parseInt(e.target.value) }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={120}>2 hours</option>
                  <option value={480}>8 hours</option>
                  <option value={0}>Never</option>
                </select>
              </FormField>
            </div>
          </div>

          {/* Inventory Alerts */}
          <div className="border-t border-slate-100 pt-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Inventory Alerts</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Expiry Alert (days before)" hint="Alert when a batch expires within this many days">
                <select
                  value={params.expiryAlertDays}
                  onChange={e => setParams(p => ({ ...p, expiryAlertDays: parseInt(e.target.value) }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                >
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days</option>
                  <option value={180}>180 days</option>
                </select>
              </FormField>
              <FormField label="Low Stock Alert (%)" hint="Alert when stock falls below this % of reorder level">
                <input
                  type="number"
                  value={params.reorderAlertPercent}
                  onChange={e => setParams(p => ({ ...p, reorderAlertPercent: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) }))}
                  min={0}
                  max={100}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                />
              </FormField>
            </div>
          </div>

          {/* Toggles Row */}
          <div className="border-t border-slate-100 pt-4 space-y-3">
            {[
              { key: 'gstEnabled', label: 'GST / Tax Mode Enabled', hint: 'Enables CGST/SGST/IGST calculations across all modules' },
              { key: 'autoPrint', label: 'Auto-print Invoice after Billing', hint: 'Automatically sends invoice to default printer after POS sale' },
            ].map(({ key, label, hint }) => (
              <div key={key} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-slate-700">{label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>
                </div>
                <Toggle
                  checked={(params as any)[key]}
                  onChange={v => setParams(p => ({ ...p, [key]: v }))}
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <SaveButton onClick={handleSave} loading={saving} />
          </div>
        </div>
      </SectionCard>
    </div>
  );
};

// ─── Integrations Tab ─────────────────────────────────────────────────────────
const IntegrationsTab: React.FC<{ addNotification: Function }> = ({ addNotification }) => {
  const [whatsappConfig, setWhatsappConfig] = useState(() => {
    const cfg = getWhatsAppConfig();
    return {
      phoneNumber: cfg.phoneNumber || '',
      apiKey: cfg.apiKey || '',
      businessAccountId: cfg.businessAccountId || '',
      enabled: cfg.enabled,
    };
  });
  const [testStatus, setTestStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [pendingMsgs, setPendingMsgs] = useState(getPendingMessages());

  const validatePhone = (val: string) => {
    if (!val) return 'Phone number is required';
    if (!/^\+[0-9]{10,15}$/.test(val.replace(/\s/g, '')))
      return 'Format: +91XXXXXXXXXX (with country code)';
    return '';
  };

  const handleSave = async () => {
    const err = validatePhone(whatsappConfig.phoneNumber);
    if (err) { setPhoneError(err); return; }
    setPhoneError('');
    setIsSaving(true);
    await new Promise(r => setTimeout(r, 400));
    saveWhatsAppConfig({
      phoneNumber: whatsappConfig.phoneNumber.replace(/\s/g, ''),
      apiKey: whatsappConfig.apiKey || undefined,
      businessAccountId: whatsappConfig.businessAccountId || undefined,
      enabled: whatsappConfig.enabled,
    });
    setIsSaving(false);
    addNotification({
      type: 'success',
      title: 'WhatsApp Configuration Saved',
      message: `Notifications ${whatsappConfig.enabled ? 'enabled' : 'disabled'} for ${whatsappConfig.phoneNumber}`,
      priority: 'low',
      module: 'SYSTEM',
    });
  };

  const handleTest = async () => {
    const err = validatePhone(whatsappConfig.phoneNumber);
    if (err) { setPhoneError(err); return; }
    setIsTesting(true);
    setTestStatus(null);
    const result = await testWhatsAppConfig();
    setTestStatus(result);
    setIsTesting(false);
  };

  return (
    <div className="space-y-6">
      {/* WhatsApp */}
      <SectionCard title="WhatsApp Business Notifications" icon={<MessageCircle size={16} />}>
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-100 rounded-lg p-4">
            <p className="text-xs text-green-700 leading-relaxed">
              Receive critical ERP alerts directly on WhatsApp — inventory shortages, compliance deadlines, 
              high-value accounts notifications, and employee performance alerts.
            </p>
          </div>

          <div className="space-y-4">
            <FormField label="WhatsApp Number" required hint="Include country code (e.g., +91 for India)" error={phoneError}>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={whatsappConfig.phoneNumber}
                onChange={e => {
                  setWhatsappConfig(c => ({ ...c, phoneNumber: e.target.value }));
                  if (phoneError) setPhoneError('');
                }}
                className={`w-full border ${phoneError ? 'border-red-400' : 'border-slate-300'} rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none`}
              />
            </FormField>

            <FormField label="WhatsApp Business API Key" hint="Optional – for automated message sending via Meta API">
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="Enter API key for automated sending"
                  value={whatsappConfig.apiKey}
                  onChange={e => setWhatsappConfig(c => ({ ...c, apiKey: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-10 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </FormField>

            <FormField label="Business Account ID" hint="Optional – WhatsApp Business Account ID from Meta dashboard">
              <input
                type="text"
                placeholder="Enter Business Account ID"
                value={whatsappConfig.businessAccountId}
                onChange={e => setWhatsappConfig(c => ({ ...c, businessAccountId: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
            </FormField>

            {/* Enable Toggle */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-slate-700">Enable WhatsApp Notifications</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {whatsappConfig.enabled ? 'Active — critical alerts will be sent to your number' : 'Disabled — no notifications will be sent'}
                </p>
              </div>
              <Toggle
                checked={whatsappConfig.enabled}
                onChange={v => setWhatsappConfig(c => ({ ...c, enabled: v }))}
              />
            </div>

            {/* Auto-notification toggles */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-2">
              <h5 className="text-xs font-bold text-blue-800 mb-2">Auto-Send Notifications For:</h5>
              {[
                { label: 'Critical inventory alerts (stock below minimum)', key: 'inv' },
                { label: 'Compliance deadlines (license renewals, GST filing)', key: 'comp' },
                { label: 'High-priority accounts notifications', key: 'acc' },
                { label: 'Employee performance alerts', key: 'emp' },
              ].map(item => (
                <div key={item.key} className="flex items-center gap-2 text-xs text-blue-700">
                  <CheckCircle size={12} className="text-blue-500 flex-shrink-0" />
                  {item.label}
                </div>
              ))}
            </div>

            {/* Test Status */}
            {testStatus && (
              <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${testStatus.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {testStatus.success ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                {testStatus.message}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleTest}
                disabled={isTesting || !whatsappConfig.phoneNumber}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {isTesting ? (
                  <><div className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />Testing…</>
                ) : (
                  <><RefreshCw size={15} />Test Connection</>
                )}
              </button>
              <SaveButton onClick={handleSave} loading={isSaving} />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Pending Messages */}
      {pendingMsgs.length > 0 && (
        <SectionCard title={`Pending WhatsApp Messages (${pendingMsgs.filter(m => !m.sent).length})`} icon={<MessageCircle size={16} />}>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {pendingMsgs.map(msg => (
              <div key={msg.id} className={`flex items-start gap-3 p-3 rounded-lg border text-xs ${msg.sent ? 'bg-green-50 border-green-100' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-slate-600 truncate">→ {msg.phone}</p>
                  <p className="text-slate-500 mt-0.5 truncate">{msg.message.substring(0, 80)}…</p>
                  <p className="text-slate-400 mt-0.5">{new Date(msg.timestamp).toLocaleString('en-IN')}</p>
                </div>
                {!msg.sent && (
                  <button
                    onClick={() => { markMessageAsSent(msg.id); setPendingMsgs(getPendingMessages()); }}
                    className="text-green-600 hover:text-green-800 font-medium whitespace-nowrap flex-shrink-0"
                  >
                    Mark sent
                  </button>
                )}
                {msg.sent && <CheckCircle size={14} className="text-green-500 flex-shrink-0 mt-0.5" />}
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
};

// ─── Backup & Restore Tab ─────────────────────────────────────────────────────
const BackupTab: React.FC<{ addNotification: Function; onFactoryReset: () => void }> = ({ addNotification, onFactoryReset }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState('');
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const exportData = await settingsService.exportAll();
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `metapharsic_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      addNotification({ type: 'success', title: 'Backup Downloaded', message: 'Full settings backup (from server database) downloaded.', priority: 'low', module: 'SYSTEM' });
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Backup Failed', message: err?.message || 'Failed to export settings.', priority: 'high', module: 'SYSTEM' });
    } finally { setIsBackingUp(false); }
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreError('');
    setRestoreSuccess(false);
    setIsRestoring(true);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        const payload = parsed.data || parsed;
        if (!payload.company && !payload.appParameters && !payload.notificationPreferences) {
          throw new Error('Invalid backup format — missing required settings keys');
        }
        await settingsService.importAll(payload);
        setRestoreSuccess(true);
        addNotification({
          type: 'success', title: 'Settings Restored',
          message: `Backup from ${payload.metadata?.exportedAt ? new Date(payload.metadata.exportedAt).toLocaleDateString('en-IN') : 'unknown date'} restored. Please refresh.`,
          priority: 'medium', module: 'SYSTEM',
        });
      } catch (err: any) {
        setRestoreError(err.message || 'Failed to restore. Ensure it is a valid Metapharsic ERP backup.');
      } finally {
        setIsRestoring(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Backup */}
      <SectionCard title="Data Backup" icon={<Database size={16} />}>
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3">
            <FileJson className="text-blue-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="font-semibold text-blue-800 text-sm">Settings & Configuration Export</h4>
              <p className="text-xs text-blue-700 mt-1">
                Downloads a complete snapshot of your ERP configuration — company profile, application parameters, 
                WhatsApp settings, and notification preferences. Use this to migrate to a new device or restore after a reset.
              </p>
            </div>
          </div>
          <button
            onClick={handleBackup}
            disabled={isBackingUp}
            className="flex items-center gap-3 px-5 py-3 border-2 border-slate-200 rounded-xl hover:border-green-400 hover:bg-green-50 transition-all group disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isBackingUp
              ? <div className="w-6 h-6 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              : <Download size={22} className="text-slate-400 group-hover:text-green-600 transition-colors" />
            }
            <div className="text-left">
              <p className="font-semibold text-slate-700 group-hover:text-green-700 transition-colors">
                {isBackingUp ? 'Preparing Backup…' : 'Download Settings Backup'}
              </p>
              <p className="text-xs text-slate-400">.json format · includes all configuration</p>
            </div>
          </button>
        </div>
      </SectionCard>

      {/* Restore */}
      <SectionCard title="Restore from Backup" icon={<Upload size={16} />}>
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 flex gap-3">
            <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={18} />
            <div>
              <h4 className="font-semibold text-amber-800 text-sm">Warning</h4>
              <p className="text-xs text-amber-700 mt-1">
                Restoring from a backup will overwrite your current settings. This action cannot be undone.
                Only upload backup files generated by this ERP.
              </p>
            </div>
          </div>

          {restoreError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2 text-sm">
              <AlertTriangle size={15} /> {restoreError}
            </div>
          )}
          {restoreSuccess && (
            <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center gap-2 text-sm">
              <CheckCircle size={15} /> Settings restored successfully. Please refresh the page to apply changes.
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleRestoreFile}
            className="hidden"
            id="restore-file-input"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isRestoring}
            className="flex items-center gap-3 px-5 py-3 border-2 border-slate-200 rounded-xl hover:border-amber-400 hover:bg-amber-50 transition-all group disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isRestoring
              ? <div className="w-6 h-6 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              : <Upload size={22} className="text-slate-400 group-hover:text-amber-600 transition-colors" />
            }
            <div className="text-left">
              <p className="font-semibold text-slate-700 group-hover:text-amber-700 transition-colors">
                {isRestoring ? 'Restoring…' : 'Select Backup File'}
              </p>
              <p className="text-xs text-slate-400">Select a .json backup file from your device</p>
            </div>
          </button>
        </div>
      </SectionCard>

      {/* Danger Zone */}
      <SectionCard title="Danger Zone" icon={<Shield size={16} />}>
        <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-red-600 flex-shrink-0" size={22} />
            <div>
              <h4 className="font-bold text-red-800 text-sm">Factory Reset</h4>
              <p className="text-xs text-red-600 mt-0.5">
                Clears all ERP settings and local data. Cannot be undone.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowResetConfirm(true)}
            className="px-4 py-2 bg-white border border-red-300 text-red-600 text-xs font-bold rounded-lg hover:bg-red-600 hover:text-white transition-colors"
          >
            Reset System
          </button>
        </div>

        <ConfirmModal
          open={showResetConfirm}
          title="Confirm Factory Reset"
          message="This will permanently delete your company profile, all application parameters, WhatsApp configuration, and notification history. This action cannot be undone. Are you absolutely sure?"
          confirmLabel="Yes, Reset Everything"
          confirmVariant="red"
          onConfirm={() => { setShowResetConfirm(false); onFactoryReset(); }}
          onCancel={() => setShowResetConfirm(false)}
        />
      </SectionCard>
    </div>
  );
};

// ─── Security Tab ─────────────────────────────────────────────────────────────
const SecurityTab: React.FC<{ addNotification: Function }> = ({ addNotification }) => {
  const [saving, setSaving] = useState(false);
  const [secSettings, setSecSettings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('erp_security_settings') || '{}');
    } catch { return {}; }
  });
  const defaults = {
    loginAttempts: 5,
    lockoutMinutes: 15,
    requireStrongPassword: true,
    twoFactorForAdmin: false,
    ipWhitelistEnabled: false,
    auditAllActions: true,
  };
  const cfg = { ...defaults, ...secSettings };

  useEffect(() => {
    settingsService.getSecurity().then(d => { if (d) setSecSettings(p => ({ ...defaults, ...p, ...d } as any)); }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsService.saveSecurity(cfg);
      addNotification({ type: 'success', title: 'Security Settings Saved', message: 'Login policy, lockout, and audit updated.', priority: 'low', module: 'SYSTEM' });
    } catch (e: any) {
      addNotification({ type: 'error', title: 'Save Failed', message: e?.message || 'Failed to save.', priority: 'high', module: 'SYSTEM' });
    } finally { setSaving(false); }
  };

  const update = (key: string, val: any) => setSecSettings((p: any) => ({ ...p, [key]: val }));

  return (
    <div className="space-y-6">
      <SectionCard title="Login & Access Policy" icon={<Lock size={16} />}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Max Login Attempts" hint="Account locks after this many failed attempts">
              <select
                value={cfg.loginAttempts}
                onChange={e => update('loginAttempts', parseInt(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-green-500 outline-none"
              >
                {[3, 5, 10].map(n => <option key={n} value={n}>{n} attempts</option>)}
              </select>
            </FormField>
            <FormField label="Lockout Duration" hint="How long to lock account after too many failures">
              <select
                value={cfg.lockoutMinutes}
                onChange={e => update('lockoutMinutes', parseInt(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-green-500 outline-none"
              >
                {[5, 15, 30, 60].map(n => <option key={n} value={n}>{n} minutes</option>)}
              </select>
            </FormField>
          </div>

          <div className="space-y-3 pt-2">
            {[
              { key: 'requireStrongPassword', label: 'Require Strong Passwords', hint: 'Minimum 8 chars, uppercase, number, symbol' },
              { key: 'twoFactorForAdmin', label: 'Require 2FA for Admin Role', hint: 'Admin users must verify via TOTP on every login' },
              { key: 'ipWhitelistEnabled', label: 'Enable IP Whitelist', hint: 'Restrict access to specific IP addresses only' },
              { key: 'auditAllActions', label: 'Audit All User Actions', hint: 'Log every create/update/delete action to Audit Log' },
            ].map(({ key, label, hint }) => (
              <div key={key} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-slate-700">{label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>
                </div>
                <Toggle
                  checked={cfg[key]}
                  onChange={v => update(key, v)}
                  color="blue"
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <SaveButton onClick={handleSave} loading={saving} />
          </div>
        </div>
      </SectionCard>

      {/* 2FA Info Panel */}
      <SectionCard title="Two-Factor Authentication" icon={<Shield size={16} />}>
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3">
          <Info size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-800 text-sm">2FA Available via Authentication App</h4>
            <p className="text-xs text-blue-700 mt-1">
              The server supports TOTP-based 2FA. Users can enable it during login after admin enables the requirement above. 
              Contact your system administrator to issue QR codes via the backend management panel.
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
};

// ─── Notifications Tab ────────────────────────────────────────────────────────
const NotificationsTab: React.FC<{ addNotification: Function }> = ({ addNotification }) => {
  const [prefs, setPrefs] = useState(loadNotificationPrefs);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsService.getNotifications().then(d => { if (d) setPrefs(p => ({ ...p, ...d })); }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsService.saveNotifications(prefs as any);
      addNotification({ type: 'success', title: 'Notification Preferences Saved', message: 'Your notification settings updated.', priority: 'low', module: 'SYSTEM' });
    } catch (e: any) {
      addNotification({ type: 'error', title: 'Save Failed', message: e?.message || 'Failed.', priority: 'high', module: 'SYSTEM' });
    } finally { setSaving(false); }
  };

  const modules = [
    { key: 'inventory', label: 'Inventory', description: 'Low stock, expiry alerts, reorder reminders', icon: <Package size={15} /> },
    { key: 'compliance', label: 'Compliance', description: 'License renewals, GST deadlines, drug schedule alerts', icon: <Shield size={15} /> },
    { key: 'accounts', label: 'Accounts & Finance', description: 'Outstanding dues, payment reminders, bank alerts', icon: <CreditCard size={15} /> },
    { key: 'pos', label: 'POS & Billing', description: 'Large sale alerts, payment failure, cash reconciliation', icon: <Zap size={15} /> },
    { key: 'hr', label: 'HR & Payroll', description: 'Attendance alerts, payroll reminders, leave approvals', icon: <Users size={15} /> },
    { key: 'crm', label: 'CRM & Sales', description: 'Follow-up reminders, new lead alerts, target achievement', icon: <Globe size={15} /> },
  ];

  return (
    <div className="space-y-6">
      <SectionCard title="Module Notifications" icon={<Bell size={16} />}>
        <div className="space-y-3">
          {modules.map(({ key, label, description, icon }) => (
            <div key={key} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                  {icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">{label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{description}</p>
                </div>
              </div>
              <Toggle
                checked={(prefs as any)[key]}
                onChange={v => setPrefs((p: any) => ({ ...p, [key]: v }))}
              />
            </div>
          ))}
          <div className="flex justify-end pt-2">
            <SaveButton onClick={handleSave} loading={saving} />
          </div>
        </div>
      </SectionCard>
    </div>
  );
};

// ─── Appearance Tab ───────────────────────────────────────────────────────────
const AppearanceTab: React.FC<{ addNotification: Function }> = ({ addNotification }) => {
  const { isDarkMode, toggleDarkMode } = useAppStore();
  const [fontSize, setFontSize] = useState(() => localStorage.getItem('erp_font_size') || 'normal');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsService.getAppearance().then(d => { if (d?.fontSize) setFontSize(d.fontSize as any); }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsService.saveAppearance({ darkMode: isDarkMode, fontSize });
      localStorage.setItem('erp_font_size', fontSize);
      addNotification({ type: 'success', title: 'Appearance Settings Saved', message: 'Visual preferences updated.', priority: 'low', module: 'SYSTEM' });
    } catch (e: any) {
      addNotification({ type: 'error', title: 'Save Failed', message: e?.message || 'Failed.', priority: 'high', module: 'SYSTEM' });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <SectionCard title="Display & Theme" icon={<Palette size={16} />}>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-slate-700">Dark Mode</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {isDarkMode ? 'Dark theme is active' : 'Light theme is active'}
              </p>
            </div>
            <Toggle checked={isDarkMode} onChange={toggleDarkMode} color="blue" />
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 flex gap-2">
            <Info size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">Dark mode theming is under active development. Some modules may not yet reflect the dark theme.</p>
          </div>

          <FormField label="Interface Font Size">
            <div className="grid grid-cols-3 gap-2">
              {(['compact', 'normal', 'large'] as const).map(size => (
                <button
                  key={size}
                  onClick={() => setFontSize(size)}
                  className={`py-2 px-3 rounded-lg border text-sm font-medium capitalize transition-all ${fontSize === size ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                >
                  {size}
                </button>
              ))}
            </div>
          </FormField>

          <div className="flex justify-end pt-2">
            <SaveButton onClick={handleSave} loading={saving} />
          </div>
        </div>
      </SectionCard>
    </div>
  );
};

// ─── About Tab ────────────────────────────────────────────────────────────────
const AboutTab: React.FC = () => {
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [serverInfo, setServerInfo] = useState<any>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/health', { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const data = await res.json();
          setServerInfo(data);
          setServerStatus('online');
        } else {
          setServerStatus('offline');
        }
      } catch {
        setServerStatus('offline');
      }
    };
    check();
  }, []);

  const { company: companyData } = useCompany();

  return (
    <div className="space-y-6">
      <SectionCard title="System Information" icon={<Info size={16} />}>
        <div className="space-y-3">
          {[
            { label: 'Application', value: 'Metapharsic Lifesciences ERP' },
            { label: 'Version', value: 'v4.2.0' },
            { label: 'Build Date', value: new Date().toLocaleDateString('en-IN') },
            { label: 'Licenced To', value: companyData?.name || 'Not configured' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
              <span className="text-sm text-slate-500">{label}</span>
              <span className="text-sm font-semibold text-slate-800">{value}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Server Status" icon={<Activity size={16} />}>
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${serverStatus === 'checking' ? 'bg-slate-400 animate-pulse' : serverStatus === 'online' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`} />
            <div>
              <p className="text-sm font-semibold text-slate-800">
                {serverStatus === 'checking' ? 'Checking server…' : serverStatus === 'online' ? 'API Server Online' : 'API Server Offline'}
              </p>
              {serverStatus === 'offline' && (
                <p className="text-xs text-slate-500 mt-0.5">Run the backend server to connect: <code className="font-mono bg-slate-200 px-1 rounded">npm run server</code></p>
              )}
            </div>
          </div>
          {serverInfo && (
            <div className="space-y-2">
              {[
                { label: 'Database', value: serverInfo.database || 'PostgreSQL' },
                { label: 'API Version', value: serverInfo.version || '2.0.0' },
                { label: 'Environment', value: serverInfo.environment || 'development' },
                { label: 'Uptime', value: serverInfo.uptime ? `${Math.floor(serverInfo.uptime / 60)}m ${Math.floor(serverInfo.uptime % 60)}s` : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-1.5 border-b border-slate-100 last:border-0">
                  <span className="text-xs text-slate-500">{label}</span>
                  <span className="text-xs font-semibold text-slate-700 font-mono">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Keyboard Shortcuts Reference" icon={<FileText size={16} />}>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {[
            { key: 'Ctrl + D', action: 'Go to Dashboard' },
            { key: 'Ctrl + P', action: 'Go to POS / Billing' },
            { key: 'Ctrl + I', action: 'Go to Inventory' },
            { key: 'Ctrl + A', action: 'Go to Accounts' },
            { key: 'Ctrl + ,', action: 'Go to Settings' },
            { key: 'Ctrl + R', action: 'Refresh current page' },
            { key: 'Ctrl + ?', action: 'Open shortcuts help' },
            { key: 'Esc', action: 'Close modal / panel' },
          ].map(({ key, action }) => (
            <div key={key} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
              <kbd className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono font-semibold text-slate-600 whitespace-nowrap flex-shrink-0 shadow-sm">{key}</kbd>
              <span className="text-slate-600">{action}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SETTINGS COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const { clearCompany } = useCompany();
  const { addNotification, clearAllNotifications } = useNotifications();

  const handleFactoryReset = async () => {
    try { await settingsService.resetAll(); } catch { /* best effort */ }
    const keys = [
      'erp_company_profile','erp_app_parameters','erp_notification_prefs','erp-notifications',
      'erp_security_settings','erp_font_size','erp_appearance_settings',
      'whatsapp_phone','whatsapp_api_key','whatsapp_business_id','whatsapp_enabled','whatsapp_pending',
    ];
    keys.forEach(k => localStorage.removeItem(k));
    clearCompany();
    clearAllNotifications();
    addNotification({ type: 'info', title: 'System Reset Complete', message: 'All ERP settings cleared. Please refresh.', priority: 'high', module: 'SYSTEM' });
    setActiveTab('general');
  };

  const navItems: { id: SettingsTab; icon: React.ReactNode; label: string; group: string }[] = [
    { id: 'general', icon: <SettingsIcon size={16} />, label: 'General', group: 'Configuration' },
    { id: 'security', icon: <Lock size={16} />, label: 'Security', group: 'Configuration' },
    { id: 'notifications', icon: <Bell size={16} />, label: 'Notifications', group: 'Configuration' },
    { id: 'appearance', icon: <Palette size={16} />, label: 'Appearance', group: 'Configuration' },
    { id: 'integrations', icon: <MessageCircle size={16} />, label: 'Integrations', group: 'System' },
    { id: 'backup', icon: <Database size={16} />, label: 'Backup & Restore', group: 'System' },
    { id: 'about', icon: <Info size={16} />, label: 'About', group: 'System' },
  ];

  const groups = ['Configuration', 'System'];

  const renderTab = () => {
    switch (activeTab) {
      case 'general': return <GeneralTab addNotification={addNotification} />;
      case 'security': return <SecurityTab addNotification={addNotification} />;
      case 'notifications': return <NotificationsTab addNotification={addNotification} />;
      case 'appearance': return <AppearanceTab addNotification={addNotification} />;
      case 'integrations': return <IntegrationsTab addNotification={addNotification} />;
      case 'backup': return <BackupTab addNotification={addNotification} onFactoryReset={handleFactoryReset} />;
      case 'about': return <AboutTab />;
    }
  };

  return (
    // ✅ SCROLL FIX: h-full overflow-y-auto on the root ensures Settings is self-scrolling
    <div className="h-full overflow-y-auto animate-fadeIn">
      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-4">
        {/* Page Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">System Settings</h2>
            <p className="text-slate-500 text-sm mt-1">Manage company profile, system configuration, integrations, and preferences.</p>
          </div>
        </div>

        {/* Two-column layout: sidebar nav + content */}
        <div className="flex gap-6 min-h-[600px]">
          {/* Left Sidebar Nav */}
          <aside className="w-52 flex-shrink-0">
            <div className="bg-white rounded-xl border border-slate-200 p-3 sticky top-4 space-y-1">
              {groups.map(group => (
                <div key={group}>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.12em] px-3 pt-3 pb-1.5">
                    {group}
                  </p>
                  {navItems.filter(n => n.group === group).map(item => (
                    <NavItem
                      key={item.id}
                      id={item.id}
                      icon={item.icon}
                      label={item.label}
                      active={activeTab === item.id}
                      onClick={() => setActiveTab(item.id)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {renderTab()}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Settings;
