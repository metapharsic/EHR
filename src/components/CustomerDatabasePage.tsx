import React, {
  useState, useEffect, useCallback, useMemo, useRef, useId,
} from 'react';
import {
  Plus, Search, X, Pencil, Trash2, Eye, Download, Upload, RefreshCw,
  AlertCircle, Users, Building2, Phone, Mail, MapPin, CreditCard,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight, LayoutGrid,
  List, FileText, CheckCircle2, Loader2, XCircle, MoreHorizontal,
  User, Banknote, BookOpen, Shield, ShieldCheck, ShieldAlert, ShieldOff,
  ClipboardList, Bell,
} from 'lucide-react';
import { Party, PartyLedgerEntry, Tab } from '../types';
import { getAllParties, saveParty, deleteParty } from '../services/databaseService';
import { useNotifications } from '../context/NotificationContext';
import { useAppStore } from '../store/useAppStore';
import { apiClient } from '../services/apiClient';


/* ─────────────────────────────── Constants ─────────────────────────────── */

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand',
  'West Bengal','Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli',
  'Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry',
];

const CATEGORIES = ['Regular','Premium','VIP','Corporate','Walkin'] as const;

const ENTITY_TYPES = ['Retail Chemist','Wholesale Dealer','Hospital','Clinic','Doctor','Government','Other'] as const;

// Required fields per entity type (mirrors server/routes/customers.js)
const REQUIRED_BY_ENTITY: Record<string, string[]> = {
  'Retail Chemist':   ['dl_20a','dl_20a_expiry','dl_20b','dl_20b_expiry','pharmacist_name','pharmacist_reg_no','gstin','mobile'],
  'Wholesale Dealer': ['dl_20c','dl_20c_expiry','dl_20d','dl_20d_expiry','gstin','mobile'],
  'Hospital':         ['hospital_reg_no','hospital_reg_expiry','gstin','mobile'],
  'Clinic':           ['doctor_reg_no','doctor_degree','mobile'],
  'Doctor':           ['doctor_reg_no','doctor_degree','mobile'],
  'Government':       ['firm_reg_no','mobile'],
  'Other':            ['mobile'],
};

type ComplianceStatus = 'COMPLETE'|'EXPIRING_SOON'|'CRITICAL'|'EXPIRED'|'INCOMPLETE';

function computeComplianceFE(p: any): { status: ComplianceStatus; score: number } {
  if (!p.entity_type) return { status: 'INCOMPLETE', score: 0 };
  const required = REQUIRED_BY_ENTITY[p.entity_type] || ['mobile'];
  const today = new Date();
  const d30 = new Date(); d30.setDate(d30.getDate() + 30);
  const d90 = new Date(); d90.setDate(d90.getDate() + 90);

  const expiryDates = [
    p.dl_20a_expiry, p.dl_20b_expiry, p.dl_20c_expiry, p.dl_20d_expiry,
    p.dl_expiry_date, p.pharmacist_reg_expiry, p.hospital_reg_expiry,
    p.fssai_expiry, p.firm_reg_expiry,
  ].filter(Boolean).map((d: string) => new Date(d));

  const missing = required.filter(f => !p[f] || p[f] === '');
  if (missing.length > 0) return { status: 'INCOMPLETE', score: Math.round((1 - missing.length / required.length) * 100) };
  if (expiryDates.some(d => d < today)) return { status: 'EXPIRED', score: 10 };
  if (expiryDates.some(d => d <= d30)) return { status: 'CRITICAL', score: 50 };
  if (expiryDates.some(d => d <= d90)) return { status: 'EXPIRING_SOON', score: 75 };
  return { status: 'COMPLETE', score: 100 };
}

const COMPLIANCE_UI: Record<ComplianceStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  COMPLETE:      { label: 'Compliant',    cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <ShieldCheck size={11}/> },
  EXPIRING_SOON: { label: 'Expiring',     cls: 'bg-amber-100  text-amber-700  border-amber-200',  icon: <ShieldAlert size={11}/> },
  CRITICAL:      { label: 'Critical',     cls: 'bg-orange-100 text-orange-700 border-orange-200', icon: <ShieldAlert size={11}/> },
  EXPIRED:       { label: 'EXPIRED',      cls: 'bg-red-100    text-red-700    border-red-200',    icon: <ShieldOff size={11}/> },
  INCOMPLETE:    { label: 'Incomplete',   cls: 'bg-slate-100  text-slate-600  border-slate-200',  icon: <Shield size={11}/> },
};

const PAGE_SIZE_OPTIONS = [25, 50, 100];

type SortField = 'name' | 'city' | 'currentBalance' | 'creditLimit' | 'category' | 'status';
type SortDir   = 'asc' | 'desc';
type ViewMode  = 'card' | 'table';
type StatusFilter = 'Active' | 'Inactive' | 'All';

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

/* ─────────────────────────────── Empty form ─────────────────────────────── */

const emptyParty = (): Omit<Party,'id'|'ledger'> => ({
  name:'', type:'Debtor', status:'Active', gstin:'', mobile:'', email:'',
  address:'', city:'', state:'', pinCode:'',
  creditLimit:0, currentBalance:0, creditDays:0,
  category:'Regular', route:'', territory:'', contactPerson:'', pan:'',
  drugLicenseNo:'', bankName:'', accountNumber:'', ifscCode:'', remarks:'',
});

/* ─────────────────── Validation ─────────────────── */

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_RE   = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const MOBILE_RE = /^[6-9]\d{9}$/;
const PIN_RE   = /^\d{6}$/;

function validate(form: Omit<Party,'id'|'ledger'>) {
  const e: Record<string,string> = {};
  if (!form.name.trim())              e.name = 'Name is required';
  if (!form.mobile.trim())            e.mobile = 'Mobile is required';
  else if (!MOBILE_RE.test(form.mobile.replace(/\D/g,''))) e.mobile = 'Enter a valid 10-digit mobile';
  if (form.gstin && !GSTIN_RE.test(form.gstin.toUpperCase())) e.gstin = 'Invalid GSTIN format';
  if (form.pan  && !PAN_RE.test(form.pan.toUpperCase()))  e.pan  = 'Invalid PAN format';
  if (form.pinCode && !PIN_RE.test(form.pinCode))         e.pinCode = 'PIN must be 6 digits';
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
  if ((form.creditLimit ?? 0) < 0)    e.creditLimit = 'Cannot be negative';
  if ((form.creditDays ?? 0) < 0 || (form.creditDays ?? 0) > 365) e.creditDays = 'Must be 0–365 days';
  return e;
}

/* ─────────────────────────────── Types ─────────────────────────────────── */

interface LedgerEntry extends PartyLedgerEntry {}

/* ─────────────────────────────── Sub-components ────────────────────────── */

/** Generic field wrapper */
const Field = ({ label, error, required, children }: {
  label: string; error?: string; required?: boolean; children: React.ReactNode;
}) => (
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
    {error && <p className="mt-1 text-xs text-red-600 flex items-center gap-1"><AlertCircle size={11}/>{error}</p>}
  </div>
);

/** Styled input */
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }>(
  ({ error, className = '', ...props }, ref) => (
    <input
      ref={ref}
      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 transition-colors
        ${error ? 'border-red-400 focus:ring-red-300 bg-red-50' : 'border-slate-300 focus:ring-green-300 focus:border-green-500'}
        ${className}`}
      {...props}
    />
  )
);

/** Styled select */
const Select = ({ error, className='', children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) => (
  <select
    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 transition-colors
      ${error ? 'border-red-400 focus:ring-red-300 bg-red-50' : 'border-slate-300 focus:ring-green-300 focus:border-green-500'}
      ${className}`}
    {...props}
  >
    {children}
  </select>
);

/** Confirmation modal — replaces window.confirm */
const ConfirmModal = ({
  open, title, message, confirmLabel = 'Confirm', danger = false,
  onConfirm, onCancel,
}: {
  open: boolean; title: string; message: string; confirmLabel?: string;
  danger?: boolean; onConfirm: () => void; onCancel: () => void;
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
         role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel}/>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fadeIn">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto
          ${danger ? 'bg-red-100' : 'bg-amber-100'}`}>
          <AlertCircle size={24} className={danger ? 'text-red-600' : 'text-amber-600'}/>
        </div>
        <h3 id="confirm-title" className="text-base font-bold text-slate-800 text-center mb-2">{title}</h3>
        <p className="text-sm text-slate-600 text-center mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm font-medium border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm}
            className={`flex-1 px-4 py-2 text-sm font-semibold rounded-lg text-white transition-colors
              ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

/** Status badge */
const StatusBadge = ({ status }: { status?: string }) => (
  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full
    ${status === 'Inactive' ? 'bg-slate-100 text-slate-500' : 'bg-green-100 text-green-700'}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${status === 'Inactive' ? 'bg-slate-400' : 'bg-green-500'}`}/>
    {status ?? 'Active'}
  </span>
);

/** Category badge */
const CategoryBadge = ({ category }: { category?: string }) => {
  const colours: Record<string,string> = {
    VIP:       'bg-purple-100 text-purple-700',
    Premium:   'bg-amber-100 text-amber-700',
    Corporate: 'bg-blue-100 text-blue-700',
    Regular:   'bg-slate-100 text-slate-600',
    Walkin:    'bg-teal-100 text-teal-700',
  };
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${colours[category ?? 'Regular'] ?? colours.Regular}`}>
      {category ?? 'Regular'}
    </span>
  );
};

/* ──────────────────────────── Completeness helper ───────────────────────── */

function completenessScore(p: Party) {
  const checks = [
    !!p.mobile, !!p.city, !!p.state, !!p.pinCode, !!p.email,
    !!p.gstin,  !!p.pan,  !!p.drugLicenseNo,
    !!(p.creditLimit && p.creditLimit > 0),
    !!p.address, !!p.contactPerson,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

/* ──────────────────────── Full-Profile Drawer ───────────────────────────── */

const DOC_TYPE_LABELS: Record<string, string> = {
  DL_20A: 'License 20A (OTC)', DL_20B: 'License 20B (Rx)',
  DL_20C: 'License 20C (Wholesale OTC)', DL_20D: 'License 20D (Wholesale H)',
  PHARMACIST_CERT: 'Pharmacist Certificate', FSSAI: 'FSSAI License',
  GST: 'GST Certificate', PAN: 'PAN Card', TRADE_LICENSE: 'Trade License',
  HOSPITAL_REG: 'Hospital Registration', DOCTOR_REG: 'Doctor Registration',
  FIRM_REG: 'Firm Registration', OTHER: 'Other Document',
};

const DOC_TYPES = Object.keys(DOC_TYPE_LABELS);

const CustomerDocuments: React.FC<{ partyId: string }> = ({ partyId }) => {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ doc_type: 'DL_20A', doc_number: '', expiry_date: '', notes: '' });
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/api/customers/${partyId}/documents`);
      setDocs(res.data || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [partyId]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { alert('Select a file first'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('doc_type', form.doc_type);
      if (form.doc_number) fd.append('doc_number', form.doc_number);
      if (form.expiry_date) fd.append('expiry_date', form.expiry_date);
      if (form.notes) fd.append('notes', form.notes);
      const token = localStorage.getItem('erp_token') || localStorage.getItem('token') || '';
      const resp = await fetch(`/api/customers/${partyId}/documents/upload`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      const json = await resp.json();
      if (json.success) { setShowForm(false); if (fileRef.current) fileRef.current.value = ''; fetchDocs(); }
      else alert(json.error || 'Upload failed');
    } catch (e: any) { alert(e.message || 'Upload failed'); }
    finally { setUploading(false); }
  };

  const handleDelete = async (docId: string) => {
    if (!window.confirm('Delete this document?')) return;
    await apiClient.delete(`/api/customers/documents/${docId}`);
    fetchDocs();
  };

  const handleVerify = async (docId: string) => {
    await apiClient.put(`/api/customers/documents/${docId}/verify`, {});
    fetchDocs();
  };

  const daysLeft = (expiry: string) => {
    if (!expiry) return null;
    return Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Documents</h4>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">
          <Upload size={11}/> {showForm ? 'Cancel' : 'Upload'}
        </button>
      </div>

      {showForm && (
        <div className="border border-dashed border-primary/40 rounded-xl p-3 mb-3 bg-sky-50/40 space-y-2">
          <select className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
            value={form.doc_type} onChange={e => setForm(f => ({ ...f, doc_type: e.target.value }))}>
            {DOC_TYPES.map(t => <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder="License / Doc Number"
              className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
              value={form.doc_number} onChange={e => setForm(f => ({ ...f, doc_number: e.target.value }))}/>
            <input type="date" className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
              value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))}/>
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="w-full text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-primary file:text-white file:text-xs cursor-pointer"/>
          <button onClick={handleUpload} disabled={uploading}
            className="w-full py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-sky-600 disabled:opacity-50 flex items-center justify-center gap-1">
            {uploading ? <><Loader2 size={12} className="animate-spin"/> Uploading...</> : <><Upload size={12}/> Upload Document</>}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-400 py-2"><Loader2 size={12} className="animate-spin"/> Loading...</div>
      ) : docs.length === 0 ? (
        <p className="text-xs text-slate-400 italic py-2">No documents uploaded yet.</p>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => {
            const dl = daysLeft(doc.expiry_date);
            const expired = dl !== null && dl < 0;
            const critical = dl !== null && dl <= 30 && dl >= 0;
            return (
              <div key={doc.id} className={`rounded-lg border p-2.5 text-xs ${expired ? 'border-red-200 bg-red-50' : critical ? 'border-orange-200 bg-orange-50' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 truncate">{DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}</p>
                    {doc.doc_number && <p className="font-mono text-slate-500 text-[10px]">{doc.doc_number}</p>}
                    {doc.expiry_date && (
                      <p className={`text-[10px] font-bold mt-0.5 ${expired ? 'text-red-600' : critical ? 'text-orange-600' : 'text-slate-500'}`}>
                        {expired ? `⚠ EXPIRED ${Math.abs(dl!)} days ago` : `Expires: ${new Date(doc.expiry_date).toLocaleDateString('en-IN')} (${dl} days)`}
                      </p>
                    )}
                    {doc.verified && <p className="text-[10px] text-emerald-600 font-bold mt-0.5">✓ Verified by {doc.verified_by}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {doc.file_path && (
                      <a href={doc.file_path} target="_blank" rel="noopener noreferrer"
                        className="p-1 text-primary hover:bg-primary/10 rounded" title="View">
                        <Eye size={13}/>
                      </a>
                    )}
                    {!doc.verified && (
                      <button onClick={() => handleVerify(doc.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded" title="Mark verified">
                        <CheckCircle2 size={13}/>
                      </button>
                    )}
                    <button onClick={() => handleDelete(doc.id)} className="p-1 text-red-400 hover:bg-red-50 rounded" title="Delete">
                      <Trash2 size={13}/>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

const ProfileDrawer = ({
  party, onClose, onEdit, onNavigateLedger,
}: {
  party: Party; onClose: () => void; onEdit: () => void;
  onNavigateLedger: (p: Party) => void;
}) => {
  const score = completenessScore(party);
  return (
    <div className="fixed inset-0 z-[110] flex">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative ml-auto w-full max-w-md bg-white h-full flex flex-col shadow-2xl animate-slideInRight overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm">
              {party.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-none">{party.name}</h2>
              <div className="flex items-center gap-1.5 mt-1">
                <StatusBadge status={party.status}/>
                <CategoryBadge category={party.category}/>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Close profile">
            <X size={18}/>
          </button>
        </div>

        {/* Completeness */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-500">Profile completeness</span>
            <span className={`font-bold ${score < 50 ? 'text-red-600' : score < 80 ? 'text-amber-600' : 'text-green-600'}`}>{score}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-200">
            <div className={`h-full rounded-full transition-all
              ${score < 50 ? 'bg-red-500' : score < 80 ? 'bg-amber-400' : 'bg-green-500'}`}
              style={{ width: `${score}%` }}/>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Balance */}
          <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-500">Current Balance</p>
              <p className={`text-base font-bold ${(party.currentBalance ?? 0) >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                {currency.format(Math.abs(party.currentBalance ?? 0))}
                <span className="text-xs ml-1 font-medium">{(party.currentBalance ?? 0) >= 0 ? 'Dr' : 'Cr'}</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Credit Limit</p>
              <p className="text-base font-bold text-slate-800">{currency.format(party.creditLimit ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Credit Days</p>
              <p className="text-sm font-semibold text-slate-700">{party.creditDays ?? 0} days</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Route / Beat</p>
              <p className="text-sm font-semibold text-slate-700">{party.route || '—'}</p>
            </div>
          </div>

          {/* Contact */}
          <section>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Contact</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2 text-slate-700"><Phone size={14} className="text-slate-400 shrink-0"/>{party.mobile}</li>
              {party.email && <li className="flex items-center gap-2 text-slate-700"><Mail size={14} className="text-slate-400 shrink-0"/>{party.email}</li>}
              {party.contactPerson && <li className="flex items-center gap-2 text-slate-700"><User size={14} className="text-slate-400 shrink-0"/>{party.contactPerson}</li>}
            </ul>
          </section>

          {/* Address */}
          <section>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Address</h4>
            <p className="text-sm text-slate-700 leading-relaxed">
              {[party.address, party.city, party.state, party.pinCode].filter(Boolean).join(', ') || '—'}
            </p>
            {party.territory && <p className="text-xs text-slate-500 mt-1">Territory: {party.territory}</p>}
          </section>

          {/* Compliance */}
          <section>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Compliance & Tax</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-slate-400 text-xs">GSTIN</span><p className="font-mono font-medium text-slate-800">{party.gstin || '—'}</p></div>
              <div><span className="text-slate-400 text-xs">PAN</span><p className="font-mono font-medium text-slate-800">{party.pan || '—'}</p></div>
              <div className="col-span-2"><span className="text-slate-400 text-xs">Drug License No.</span><p className="font-mono font-medium text-slate-800">{party.drugLicenseNo || '—'}</p></div>
              {(party as any).entity_type && (
                <div className="col-span-2">
                  <span className="text-slate-400 text-xs">Entity Type</span>
                  <p className="font-medium text-slate-800">{(party as any).entity_type}</p>
                </div>
              )}
            </div>
            {/* Compliance status badge */}
            {(() => {
              const { status, score: cs } = computeComplianceFE(party);
              const ui = COMPLIANCE_UI[status];
              return (
                <div className={`mt-2 flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-lg border ${ui.cls}`}>
                  {ui.icon} {ui.label} — {cs}% complete
                </div>
              );
            })()}
          </section>

          {/* Documents */}
          <CustomerDocuments partyId={(party as any).id || ''} />

          {/* Bank */}
          {(party.bankName || party.accountNumber) && (
            <section>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Bank Details</h4>
              <div className="text-sm space-y-1 text-slate-700">
                {party.bankName && <p><span className="text-slate-400 text-xs">Bank: </span>{party.bankName}</p>}
                {party.accountNumber && <p><span className="text-slate-400 text-xs">A/c: </span><span className="font-mono">{party.accountNumber}</span></p>}
                {party.ifscCode && <p><span className="text-slate-400 text-xs">IFSC: </span><span className="font-mono">{party.ifscCode}</span></p>}
              </div>
            </section>
          )}

          {party.remarks && (
            <section>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Remarks</h4>
              <p className="text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{party.remarks}</p>
            </section>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-white flex gap-3">
          <button onClick={() => onNavigateLedger(party)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-slate-700">
            <BookOpen size={15}/> Ledger
          </button>
          <button onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors">
            <Pencil size={15}/> Edit Profile
          </button>
        </div>
      </div>
    </div>
  );
};

/* ────────────────────── Ledger Modal ────────────────────────────────────── */

const LedgerModal = ({ party, onClose }: { party: Party; onClose: () => void }) => {
  const [entries, setEntries]   = useState<LedgerEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate]     = useState('');
  const [page, setPage]         = useState(1);

  const fetchLedger = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), limit: '50' });
      if (fromDate) qs.set('from', fromDate);
      if (toDate)   qs.set('to', toDate);
      const res = await apiClient.get(`/pos/parties/${party.id}/ledger?${qs}`);
      setEntries(res.success ? res.data : (party.ledger ?? []));
    } catch {
      setEntries(party.ledger ?? []);
    } finally {
      setLoading(false);
    }
  }, [party, fromDate, toDate, page]);

  useEffect(() => { fetchLedger(); }, [fetchLedger]);

  const runningBalance = useMemo(() => {
    let bal = 0;
    return entries.map(e => {
      bal += (Number(e.debit) - Number(e.credit));
      return { ...e, balance: bal };
    }).reverse();
  }, [entries]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4"
         role="dialog" aria-modal="true" aria-labelledby="ledger-title">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div>
            <h2 id="ledger-title" className="text-base font-bold text-slate-900">Party Ledger</h2>
            <p className="text-xs text-slate-500 mt-0.5">{party.name} · {party.mobile}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Close"><X size={18}/></button>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b border-slate-100 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">From</label>
            <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }}
              className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-300"/>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">To</label>
            <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }}
              className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-300"/>
          </div>
          <button onClick={fetchLedger} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-700 transition-colors">
            <RefreshCw size={13}/> Refresh
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-slate-400">
              <Loader2 size={24} className="animate-spin text-green-500"/>
              <span className="text-sm">Loading ledger…</span>
            </div>
          ) : runningBalance.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-slate-400">
              <BookOpen size={32} className="opacity-30"/>
              <span className="text-sm">No ledger entries found</span>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Voucher</th>
                  <th className="px-4 py-3 text-left">Narration</th>
                  <th className="px-4 py-3 text-right">Debit</th>
                  <th className="px-4 py-3 text-right">Credit</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {runningBalance.map((e, i) => (
                  <tr key={e.id ?? i} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{e.date?.slice(0,10) ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="text-slate-800 font-medium">{e.voucherType}</div>
                      <div className="text-slate-400 text-xs">{e.voucherNo}</div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 max-w-[160px] truncate">{e.narration ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right text-red-600 font-medium">{e.debit ? currency.format(Number(e.debit)) : '—'}</td>
                    <td className="px-4 py-2.5 text-right text-green-600 font-medium">{e.credit ? currency.format(Number(e.credit)) : '—'}</td>
                    <td className={`px-4 py-2.5 text-right font-bold ${e.balance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {currency.format(Math.abs(e.balance))}{e.balance >= 0 ? ' Dr' : ' Cr'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-between items-center">
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
              className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-40 transition-colors"><ChevronLeft size={16}/></button>
            <span className="text-sm text-slate-500">Page {page}</span>
            <button onClick={() => setPage(p => p+1)} disabled={entries.length < 50}
              className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-40 transition-colors"><ChevronRight size={16}/></button>
          </div>
          <p className="text-xs text-slate-500">{runningBalance.length} entries</p>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────── Customer Form Modal ──────────────────────────── */

const CustomerFormModal = ({
  initial, onSave, onCancel, loading: saving,
}: {
  initial: Partial<Party> | null;
  onSave: (data: Omit<Party,'id'|'ledger'>) => void;
  onCancel: () => void;
  loading?: boolean;
}) => {
  const isEdit = !!initial?.id;
  const [form, setForm]     = useState<Omit<Party,'id'|'ledger'>>({ ...emptyParty(), ...(initial ?? {}) });
  const [errors, setErrors] = useState<Record<string,string>>({});
  const [dirty, setDirty]   = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const [tab, setTab]       = useState<'basic'|'financial'|'bank'|'notes'>('basic');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const set = (field: keyof typeof form, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setDirty(true);
    if (errors[field]) setErrors(prev => { const n = {...prev}; delete n[field]; return n; });
  };

  const handleSubmit = () => {
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSave(form);
  };

  const handleCancel = () => {
    if (dirty) setShowDiscard(true);
    else onCancel();
  };

  const TABS = [
    { key:'basic',      label:'Basic Info',  icon:<User size={13}/> },
    { key:'compliance', label:'Compliance',  icon:<Shield size={13}/> },
    { key:'financial',  label:'Financial',   icon:<CreditCard size={13}/> },
    { key:'bank',       label:'Bank',        icon:<Banknote size={13}/> },
    { key:'notes',      label:'Notes',       icon:<FileText size={13}/> },
  ] as const;

  return (
    <>
      <ConfirmModal
        open={showDiscard}
        title="Discard changes?"
        message="You have unsaved changes. Are you sure you want to close without saving?"
        confirmLabel="Discard"
        danger
        onConfirm={onCancel}
        onCancel={() => setShowDiscard(false)}
      />

      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
           role="dialog" aria-modal="true" aria-labelledby="form-title">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCancel}/>

        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] animate-fadeIn">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center">
                {isEdit ? <Pencil size={16} className="text-white"/> : <Plus size={16} className="text-white"/>}
              </div>
              <div>
                <h2 id="form-title" className="text-base font-bold text-slate-900">
                  {isEdit ? 'Edit Customer' : 'Add New Customer'}
                </h2>
                <p className="text-xs text-slate-400">{isEdit ? `Editing: ${initial?.name}` : 'Fill in the customer details below'}</p>
              </div>
            </div>
            <button onClick={handleCancel} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400" aria-label="Close">
              <X size={18}/>
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-slate-100 px-6">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition-colors mr-1
                  ${tab === t.key
                    ? 'border-green-500 text-green-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                {t.icon}{t.label}
                {/* Show error dot if tab has errors */}
                {t.key === 'basic' && (errors.name||errors.mobile||errors.gstin||errors.pan||errors.email||errors.pinCode)
                  && <span className="w-1.5 h-1.5 rounded-full bg-red-500 ml-1"/>}
                {t.key === 'financial' && (errors.creditLimit||errors.creditDays)
                  && <span className="w-1.5 h-1.5 rounded-full bg-red-500 ml-1"/>}
              </button>
            ))}
          </div>

          {/* Form body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {tab === 'basic' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Field label="Customer Name" required error={errors.name}>
                      <Input ref={nameRef} value={form.name} onChange={e => set('name', e.target.value)}
                        placeholder="Full business name" error={!!errors.name} autoComplete="organization"/>
                    </Field>
                  </div>
                  <Field label="Mobile" required error={errors.mobile}>
                    <Input value={form.mobile} onChange={e => set('mobile', e.target.value)}
                      placeholder="10-digit mobile" error={!!errors.mobile} type="tel" autoComplete="tel" maxLength={10}/>
                  </Field>
                  <Field label="Email" error={errors.email}>
                    <Input value={form.email ?? ''} onChange={e => set('email', e.target.value)}
                      placeholder="email@example.com" error={!!errors.email} type="email" autoComplete="email"/>
                  </Field>
                  <Field label="GSTIN" error={errors.gstin}>
                    <Input value={form.gstin ?? ''} onChange={e => set('gstin', e.target.value.toUpperCase())}
                      placeholder="22AAAAA0000A1Z5" error={!!errors.gstin} maxLength={15}/>
                  </Field>
                  <Field label="PAN" error={errors.pan}>
                    <Input value={form.pan ?? ''} onChange={e => set('pan', e.target.value.toUpperCase())}
                      placeholder="ABCDE1234F" error={!!errors.pan} maxLength={10}/>
                  </Field>
                  <div className="col-span-2">
                    <Field label="Drug License No.">
                      <Input value={form.drugLicenseNo ?? ''} onChange={e => set('drugLicenseNo', e.target.value)}
                        placeholder="MH/DL/2024/1234"/>
                    </Field>
                  </div>
                  <Field label="Contact Person">
                    <Input value={form.contactPerson ?? ''} onChange={e => set('contactPerson', e.target.value)}
                      placeholder="Name of the owner/manager" autoComplete="name"/>
                  </Field>
                  <Field label="Status">
                    <Select value={form.status ?? 'Active'} onChange={e => set('status', e.target.value)}>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </Select>
                  </Field>
                  <div className="col-span-2">
                    <Field label="Address">
                      <textarea value={form.address ?? ''} onChange={e => set('address', e.target.value)}
                        rows={2} placeholder="Street / locality"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-300 resize-none"/>
                    </Field>
                  </div>
                  <Field label="City">
                    <Input value={form.city ?? ''} onChange={e => set('city', e.target.value)} placeholder="City" autoComplete="address-level2"/>
                  </Field>
                  <Field label="State">
                    <Select value={form.state ?? ''} onChange={e => set('state', e.target.value)}>
                      <option value="">— Select State —</option>
                      {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </Select>
                  </Field>
                  <Field label="PIN Code" error={errors.pinCode}>
                    <Input value={form.pinCode ?? ''} onChange={e => set('pinCode', e.target.value.replace(/\D/,''))}
                      placeholder="6-digit PIN" maxLength={6} error={!!errors.pinCode} autoComplete="postal-code"/>
                  </Field>
                  <Field label="Category">
                    <Select value={form.category ?? 'Regular'} onChange={e => set('category', e.target.value)}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </Select>
                  </Field>
                  <Field label="Route / Beat">
                    <Input value={form.route ?? ''} onChange={e => set('route', e.target.value)} placeholder="e.g. Route A"/>
                  </Field>
                  <Field label="Territory">
                    <Input value={form.territory ?? ''} onChange={e => set('territory', e.target.value)} placeholder="e.g. North Zone"/>
                  </Field>
                </div>
              </div>
            )}

            {tab === 'compliance' && (
              <div className="space-y-5">
                {/* Entity Type */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Field label="Entity Type" required>
                      <Select value={(form as any).entity_type ?? ''} onChange={e => set('entity_type' as any, e.target.value)}>
                        <option value="">— Select Entity Type —</option>
                        {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </Select>
                    </Field>
                  </div>
                  <Field label="WhatsApp Number">
                    <Input value={(form as any).whatsapp_number ?? ''} onChange={e => set('whatsapp_number' as any, e.target.value)}
                      placeholder="10-digit (for alerts)" maxLength={10}/>
                  </Field>
                  <Field label="Primary DL Expiry">
                    <Input type="date" value={(form as any).dl_expiry_date ?? ''} onChange={e => set('dl_expiry_date' as any, e.target.value)}/>
                  </Field>
                </div>

                {/* Retail Chemist */}
                {((form as any).entity_type === 'Retail Chemist') && (
                  <div className="border border-blue-200 rounded-xl p-4 space-y-3 bg-blue-50/40">
                    <p className="text-xs font-bold text-blue-700 uppercase tracking-wide flex items-center gap-1"><Shield size={12}/> Retail Drug License (Form 20A / 20B)</p>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="License 20A (OTC)" required><Input value={(form as any).dl_20a ?? ''} onChange={e => set('dl_20a' as any, e.target.value)} placeholder="MH/20A/2024/XXXX"/></Field>
                      <Field label="20A Expiry" required><Input type="date" value={(form as any).dl_20a_expiry ?? ''} onChange={e => set('dl_20a_expiry' as any, e.target.value)}/></Field>
                      <Field label="License 20B (Rx)" required><Input value={(form as any).dl_20b ?? ''} onChange={e => set('dl_20b' as any, e.target.value)} placeholder="MH/20B/2024/XXXX"/></Field>
                      <Field label="20B Expiry" required><Input type="date" value={(form as any).dl_20b_expiry ?? ''} onChange={e => set('dl_20b_expiry' as any, e.target.value)}/></Field>
                      <Field label="Pharmacist Name" required><Input value={(form as any).pharmacist_name ?? ''} onChange={e => set('pharmacist_name' as any, e.target.value)} placeholder="Registered pharmacist name"/></Field>
                      <Field label="Pharmacist Reg. No." required><Input value={(form as any).pharmacist_reg_no ?? ''} onChange={e => set('pharmacist_reg_no' as any, e.target.value)} placeholder="Pharmacy Council Reg. No."/></Field>
                      <Field label="Pharmacist Cert. Expiry"><Input type="date" value={(form as any).pharmacist_reg_expiry ?? ''} onChange={e => set('pharmacist_reg_expiry' as any, e.target.value)}/></Field>
                      <Field label="FSSAI No. (if applicable)"><Input value={(form as any).fssai_no ?? ''} onChange={e => set('fssai_no' as any, e.target.value)}/></Field>
                    </div>
                  </div>
                )}

                {/* Wholesale Dealer */}
                {((form as any).entity_type === 'Wholesale Dealer') && (
                  <div className="border border-purple-200 rounded-xl p-4 space-y-3 bg-purple-50/40">
                    <p className="text-xs font-bold text-purple-700 uppercase tracking-wide flex items-center gap-1"><Shield size={12}/> Wholesale Drug License (Form 20C / 20D)</p>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="License 20C (OTC)" required><Input value={(form as any).dl_20c ?? ''} onChange={e => set('dl_20c' as any, e.target.value)} placeholder="MH/20C/2024/XXXX"/></Field>
                      <Field label="20C Expiry" required><Input type="date" value={(form as any).dl_20c_expiry ?? ''} onChange={e => set('dl_20c_expiry' as any, e.target.value)}/></Field>
                      <Field label="License 20D (H/Rx)" required><Input value={(form as any).dl_20d ?? ''} onChange={e => set('dl_20d' as any, e.target.value)} placeholder="MH/20D/2024/XXXX"/></Field>
                      <Field label="20D Expiry" required><Input type="date" value={(form as any).dl_20d_expiry ?? ''} onChange={e => set('dl_20d_expiry' as any, e.target.value)}/></Field>
                    </div>
                  </div>
                )}

                {/* Hospital */}
                {((form as any).entity_type === 'Hospital') && (
                  <div className="border border-teal-200 rounded-xl p-4 space-y-3 bg-teal-50/40">
                    <p className="text-xs font-bold text-teal-700 uppercase tracking-wide flex items-center gap-1"><Shield size={12}/> Hospital / Nursing Home Registration</p>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Hospital Reg. No." required><Input value={(form as any).hospital_reg_no ?? ''} onChange={e => set('hospital_reg_no' as any, e.target.value)} placeholder="Dist. CMO / State Reg. No."/></Field>
                      <Field label="Registration Expiry" required><Input type="date" value={(form as any).hospital_reg_expiry ?? ''} onChange={e => set('hospital_reg_expiry' as any, e.target.value)}/></Field>
                      <Field label="Firm Reg. / Trade License"><Input value={(form as any).firm_reg_no ?? ''} onChange={e => set('firm_reg_no' as any, e.target.value)}/></Field>
                      <Field label="Trade License Expiry"><Input type="date" value={(form as any).firm_reg_expiry ?? ''} onChange={e => set('firm_reg_expiry' as any, e.target.value)}/></Field>
                    </div>
                  </div>
                )}

                {/* Clinic / Doctor */}
                {(['Clinic','Doctor'].includes((form as any).entity_type)) && (
                  <div className="border border-indigo-200 rounded-xl p-4 space-y-3 bg-indigo-50/40">
                    <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide flex items-center gap-1"><Shield size={12}/> Medical Registration</p>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Doctor Reg. No. (MCI/SMC)" required><Input value={(form as any).doctor_reg_no ?? ''} onChange={e => set('doctor_reg_no' as any, e.target.value)} placeholder="State Medical Council Reg."/></Field>
                      <Field label="Qualification" required><Input value={(form as any).doctor_degree ?? ''} onChange={e => set('doctor_degree' as any, e.target.value)} placeholder="MBBS, MD, BDS..."/></Field>
                      <Field label="Firm Reg. No."><Input value={(form as any).firm_reg_no ?? ''} onChange={e => set('firm_reg_no' as any, e.target.value)} placeholder="Trade/Shop license"/></Field>
                      <Field label="Firm Reg. Expiry"><Input type="date" value={(form as any).firm_reg_expiry ?? ''} onChange={e => set('firm_reg_expiry' as any, e.target.value)}/></Field>
                    </div>
                  </div>
                )}

                {/* Government */}
                {((form as any).entity_type === 'Government') && (
                  <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/40">
                    <p className="text-xs font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1"><Shield size={12}/> Govt. Institution</p>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Sanction / Order No." required><Input value={(form as any).firm_reg_no ?? ''} onChange={e => set('firm_reg_no' as any, e.target.value)} placeholder="Govt. sanction letter ref."/></Field>
                      <Field label="Expiry / Validity"><Input type="date" value={(form as any).firm_reg_expiry ?? ''} onChange={e => set('firm_reg_expiry' as any, e.target.value)}/></Field>
                    </div>
                  </div>
                )}

                {/* Live compliance preview */}
                {(form as any).entity_type && (() => {
                  const { status, score } = computeComplianceFE(form);
                  const ui = COMPLIANCE_UI[status];
                  const required = REQUIRED_BY_ENTITY[(form as any).entity_type] || [];
                  const missing = required.filter(f => !(form as any)[f]);
                  return (
                    <div className={`rounded-xl p-3 border text-sm flex items-start gap-3 ${ui.cls}`}>
                      <div className="mt-0.5">{ui.icon}</div>
                      <div className="flex-1">
                        <p className="font-bold">{ui.label} — {score}% complete</p>
                        {missing.length > 0 && <p className="text-xs mt-0.5 opacity-80">Missing: {missing.map(f => f.replace(/_/g,' ')).join(', ')}</p>}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {tab === 'financial' && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Opening Balance (₹)">
                  <Input type="number" value={form.currentBalance} onChange={e => set('currentBalance', parseFloat(e.target.value)||0)} step="0.01"/>
                </Field>
                <Field label="Credit Limit (₹)" error={errors.creditLimit}>
                  <Input type="number" value={form.creditLimit ?? 0} onChange={e => set('creditLimit', parseFloat(e.target.value)||0)}
                    min="0" step="1000" error={!!errors.creditLimit}/>
                </Field>
                <Field label="Credit Days" error={errors.creditDays}>
                  <Input type="number" value={form.creditDays ?? 0} onChange={e => set('creditDays', parseInt(e.target.value)||0)}
                    min="0" max="365" error={!!errors.creditDays}/>
                </Field>
                <div className="col-span-2">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                    <strong>Opening balance:</strong> Enter positive value for amount to be received (Dr), negative for amount payable (Cr).
                  </div>
                </div>
              </div>
            )}

            {tab === 'bank' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Field label="Bank Name">
                    <Input value={form.bankName ?? ''} onChange={e => set('bankName', e.target.value)} placeholder="e.g. State Bank of India"/>
                  </Field>
                </div>
                <Field label="Account Number">
                  <Input value={form.accountNumber ?? ''} onChange={e => set('accountNumber', e.target.value)} placeholder="Account number" autoComplete="off"/>
                </Field>
                <Field label="IFSC Code">
                  <Input value={form.ifscCode ?? ''} onChange={e => set('ifscCode', e.target.value.toUpperCase())} placeholder="e.g. SBIN0001234" maxLength={11}/>
                </Field>
              </div>
            )}

            {tab === 'notes' && (
              <div>
                <Field label="Remarks / Notes">
                  <textarea value={form.remarks ?? ''} onChange={e => set('remarks', e.target.value)}
                    rows={5} placeholder="Any notes, special instructions, payment terms, or important information…"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-300 resize-none"/>
                </Field>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex items-center gap-3">
            <button onClick={handleCancel}
              className="px-5 py-2 text-sm font-medium border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors">
              Cancel
            </button>
            <div className="flex-1"/>
            <button onClick={handleSubmit} disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm">
              {saving ? <Loader2 size={15} className="animate-spin"/> : <CheckCircle2 size={15}/>}
              {isEdit ? 'Save Changes' : 'Add Customer'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

/* ────────────────────── Sort icon helper ────────────────────── */

const SortIcon = ({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) => {
  if (sortField !== field) return <ChevronUp size={12} className="opacity-20"/>;
  return sortDir === 'asc' ? <ChevronUp size={12} className="text-green-600"/> : <ChevronDown size={12} className="text-green-600"/>;
};

/* ══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════ */

const CustomerDatabasePage: React.FC = () => {
  const { addNotification } = useNotifications();
  const { setActiveTab, addNotification: storeNotify } = useAppStore();
  // Use context notification if available, fall back to store
  const notify = addNotification ?? storeNotify;


  /* ── State ── */
  const [customers, setCustomers]       = useState<Party[]>([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [deletingId, setDeletingId]     = useState<string | null>(null);
  const [error, setError]               = useState<string | null>(null);

  // Modals
  const [formParty, setFormParty]       = useState<Partial<Party> | null>(null);
  const [profileParty, setProfileParty] = useState<Party | null>(null);
  const [ledgerParty, setLedgerParty]   = useState<Party | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Party | null>(null);

  // Filters / search / sort / pagination / view
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Active');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortField, setSortField]     = useState<SortField>('name');
  const [sortDir, setSortDir]         = useState<SortDir>('asc');
  const [viewMode, setViewMode]       = useState<ViewMode>(() =>
    (localStorage.getItem('cdp_view') as ViewMode) ?? 'card'
  );
  const [pageSize, setPageSize]       = useState(() =>
    Number(localStorage.getItem('cdp_pagesize')) || 50
  );
  const [currentPage, setCurrentPage] = useState(1);

  // CSV
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchId = useId();

  /* ── Persist preferences ── */
  useEffect(() => { localStorage.setItem('cdp_view', viewMode); }, [viewMode]);
  useEffect(() => { localStorage.setItem('cdp_pagesize', String(pageSize)); }, [pageSize]);

  /* ── Load customers ── */
  const loadCustomers = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await getAllParties();
      const debtors = Array.isArray(data)
        ? data.filter((p: Party) => p.type === 'Debtor' || p.type === ('Customer' as any))
        : [];
      setCustomers(debtors);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  /* ── Derived: filter + sort + paginate ── */
  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return customers.filter(c => {
      const matchSearch = !term ||
        c.name.toLowerCase().includes(term) ||
        (c.mobile ?? '').includes(term) ||
        (c.gstin ?? '').toLowerCase().includes(term) ||
        (c.city ?? '').toLowerCase().includes(term) ||
        (c.category ?? '').toLowerCase().includes(term) ||
        (c.route ?? '').toLowerCase().includes(term);
      const matchStatus   = statusFilter === 'All' || (c.status ?? 'Active') === statusFilter;
      const matchCategory = !categoryFilter || c.category === categoryFilter;
      return matchSearch && matchStatus && matchCategory;
    });
  }, [customers, search, statusFilter, categoryFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va: any, vb: any;
      switch (sortField) {
        case 'name':           va = a.name.toLowerCase();       vb = b.name.toLowerCase();      break;
        case 'city':           va = (a.city ?? '').toLowerCase(); vb = (b.city ?? '').toLowerCase(); break;
        case 'currentBalance': va = a.currentBalance ?? 0;      vb = b.currentBalance ?? 0;     break;
        case 'creditLimit':    va = a.creditLimit ?? 0;         vb = b.creditLimit ?? 0;        break;
        case 'category':       va = a.category ?? '';           vb = b.category ?? '';          break;
        case 'status':         va = a.status ?? 'Active';       vb = b.status ?? 'Active';      break;
        default:               va = a.name.toLowerCase();       vb = b.name.toLowerCase();
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
  }, [filtered, sortField, sortDir]);

  const totalPages  = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage    = Math.min(currentPage, totalPages);
  const paginated   = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => { setCurrentPage(1); }, [search, statusFilter, categoryFilter, sortField, sortDir, pageSize]);

  /* ── Sort toggle ── */
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  /* ── Stats ── */
  const stats = useMemo(() => {
    const active    = customers.filter(c => (c.status ?? 'Active') === 'Active');
    const totalDr   = active.reduce((s, c) => s + Math.max(0, c.currentBalance ?? 0), 0);
    const totalCr   = active.reduce((s, c) => s + Math.abs(Math.min(0, c.currentBalance ?? 0)), 0);
    const overLimit = active.filter(c => Number(c.creditLimit ?? 0) > 0 && Number(c.currentBalance ?? 0) > Number(c.creditLimit ?? 0));
    const incomplete = active.filter(c => completenessScore(c) < 70);
    return { total: customers.length, active: active.length, totalDr, totalCr, overLimit: overLimit.length, incomplete: incomplete.length };
  }, [customers]);

  /* ── Save / Delete ── */
  const handleSave = async (data: Omit<Party,'id'|'ledger'>) => {
    setSaving(true);
    try {
      const isEdit = !!formParty?.id;
      const party: Party = {
        ...data,
        id: formParty?.id ?? `C-${Date.now()}`,
        ledger: formParty?.ledger ?? [],
        gstin: data.gstin?.toUpperCase() || undefined,
        pan:   data.pan?.toUpperCase()   || undefined,
      };

      // Duplicate checks
      const dup = customers.find(c =>
        c.id !== party.id && (
          (data.mobile && c.mobile === data.mobile) ||
          (data.gstin  && c.gstin  === party.gstin)
        )
      );
      if (dup) {
        const field = (data.mobile && dup.mobile === data.mobile) ? 'mobile' : 'gstin';
        notify({
          type: 'error',
          message: `A customer with this ${field === 'mobile' ? 'mobile number' : 'GSTIN'} already exists: ${dup.name}`,
        });
        setSaving(false);
        return;
      }

      const saved = await saveParty(party);
      if (!saved) throw new Error('Save failed');

      setCustomers(prev => {
        const idx = prev.findIndex(c => c.id === party.id || c.id === saved.id);
        if (idx !== -1) { const n = [...prev]; n[idx] = saved; return n; }
        return [...prev, saved];
      });
      setFormParty(null);
      notify({ type: 'success', message: isEdit ? `${party.name} updated successfully` : `${party.name} added to customer database` });
    } catch (e: any) {
      notify({ type: 'error', message: e.message ?? 'Failed to save customer' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (party: Party) => {
    setDeletingId(party.id);
    try {
      const ok = await deleteParty(party.id);
      if (!ok) throw new Error('Delete failed');
      setCustomers(prev => prev.filter(c => c.id !== party.id));
      notify({ type: 'success', message: `${party.name} has been deactivated` });
    } catch (e: any) {
      notify({ type: 'error', message: e.message ?? 'Failed to deactivate customer' });
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  };

  /* ── CSV Export ── */
  const handleExport = () => {
    const headers = [
      'Name','Mobile','Email','GSTIN','PAN','Drug License No',
      'Contact Person','Address','City','State','PIN',
      'Category','Route','Territory',
      'Credit Limit','Credit Days','Current Balance',
      'Bank Name','Account Number','IFSC','Status','Remarks',
    ];
    const rows = filtered.map(c => [
      c.name, c.mobile, c.email ?? '', c.gstin ?? '', c.pan ?? '', c.drugLicenseNo ?? '',
      c.contactPerson ?? '', c.address ?? '', c.city ?? '', c.state ?? '', c.pinCode ?? '',
      c.category ?? 'Regular', c.route ?? '', c.territory ?? '',
      c.creditLimit ?? 0, c.creditDays ?? 0, c.currentBalance ?? 0,
      c.bankName ?? '', c.accountNumber ?? '', c.ifscCode ?? '',
      c.status ?? 'Active', c.remarks ?? '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `customers_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    notify({ type: 'success', message: `Exported ${filtered.length} customers` });
  };

  /* ── CSV Import ── */
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text   = ev.target?.result as string;
        const lines  = text.split('\n').map(l => l.trim()).filter(Boolean);
        const header = lines[0].split(',').map(h => h.replace(/^"|"$/g,'').trim().toLowerCase());
        let imported = 0, skipped = 0;
        for (let i = 1; i < lines.length; i++) {
          const vals = lines[i].split(',').map(v => v.replace(/^"|"$/g,'').trim());
          const get  = (col: string) => vals[header.indexOf(col)] ?? '';
          const name = get('name'); const mobile = get('mobile');
          if (!name || !mobile) { skipped++; continue; }
          const party: Party = {
            id: `C-${Date.now()}-${i}`, ledger: [],
            name, mobile, type: 'Debtor',
            email: get('email'), gstin: get('gstin'), pan: get('pan'),
            drugLicenseNo: get('drug license no'), contactPerson: get('contact person'),
            address: get('address'), city: get('city'), state: get('state'), pinCode: get('pin'),
            category: (get('category') as any) || 'Regular',
            route: get('route'), territory: get('territory'),
            creditLimit:    parseFloat(get('credit limit'))   || 0,
            creditDays:     parseInt(get('credit days'))      || 0,
            currentBalance: parseFloat(get('current balance'))|| 0,
            bankName: get('bank name'), accountNumber: get('account number'), ifscCode: get('ifsc'),
            status: (get('status') || 'Active') as any,
            remarks: get('remarks'),
          };
          await saveParty(party);
          imported++;
        }
        await loadCustomers();
        notify({ type: 'success', message: `Imported ${imported} customers${skipped ? `, skipped ${skipped} invalid rows` : ''}` });
      } catch (err: any) {
        notify({ type: 'error', message: `Import failed: ${err.message}` });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  /* ── Navigate to sales history ── */
  const handleViewInvoices = (party: Party) => {
    localStorage.setItem('cdp_filter_customer', party.name);
    setActiveTab(Tab.SALES_HISTORY);
  };

  /* ═══════════════════════════════════════════════════════ Render ═════ */

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* ─── Modals ─── */}
      {formParty !== null && (
        <CustomerFormModal
          initial={formParty}
          onSave={handleSave}
          onCancel={() => setFormParty(null)}
          loading={saving}
        />
      )}
      {profileParty && (
        <ProfileDrawer
          party={profileParty}
          onClose={() => setProfileParty(null)}
          onEdit={() => { setFormParty(profileParty); setProfileParty(null); }}
          onNavigateLedger={p => { setLedgerParty(p); setProfileParty(null); }}
        />
      )}
      {ledgerParty && <LedgerModal party={ledgerParty} onClose={() => setLedgerParty(null)}/>}
      <ConfirmModal
        open={!!confirmDelete}
        title="Deactivate customer?"
        message={`"${confirmDelete?.name}" will be marked as Inactive. They can be reactivated later. All their transaction history will be preserved.`}
        confirmLabel="Deactivate"
        danger
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* ─── Page Header ─── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Users size={20} className="text-green-600"/> Customer Database
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {stats.active} active · {stats.total} total · {stats.overLimit > 0 && <span className="text-red-600 font-medium">{stats.overLimit} over limit · </span>}
              {stats.incomplete > 0 && <span className="text-amber-600 font-medium">{stats.incomplete} incomplete</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImport}/>
            <button onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors">
              <Upload size={14}/> Import CSV
            </button>
            <button onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors">
              <Download size={14}/> Export
            </button>
            <button onClick={() => setFormParty({})}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm">
              <Plus size={14}/> Add Customer
            </button>
          </div>
        </div>

        {/* ─── Stats strip ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {[
            { label:'Total Customers',    value: stats.total,                     sub:'in database',          color:'text-slate-800' },
            { label:'Receivable (Dr)',     value: currency.format(stats.totalDr),  sub:'outstanding dues',     color:'text-red-600' },
            { label:'Payable (Cr)',        value: currency.format(stats.totalCr),  sub:'credit balance',       color:'text-green-600' },
            { label:'Over Credit Limit',  value: stats.overLimit,                 sub:'need attention',        color:'text-amber-600' },
          ].map(m => (
            <div key={m.label} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-500 font-medium">{m.label}</p>
              <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
              <p className="text-xs text-slate-400">{m.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Toolbar ─── */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 shrink-0 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input
            id={searchId}
            aria-label="Search customers"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, mobile, GSTIN, city…"
            className="w-full pl-9 pr-9 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-green-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Clear search">
              <X size={14}/>
            </button>
          )}
        </div>

        {/* Status filter */}
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)}
          className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-300 text-slate-700 bg-white">
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="All">All Status</option>
        </select>

        {/* Category filter */}
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-300 text-slate-700 bg-white">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <div className="flex-1"/>

        {/* Page size */}
        <div className="flex items-center gap-1.5 text-sm text-slate-500">
          Show
          <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}
            className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white">
            {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          per page
        </div>

        {/* View toggle */}
        <div className="flex items-center bg-slate-100 rounded-lg p-1">
          <button onClick={() => setViewMode('card')} aria-label="Card view"
            className={`p-1.5 rounded ${viewMode === 'card' ? 'bg-white shadow text-green-700' : 'text-slate-500 hover:text-slate-800'} transition-all`}>
            <LayoutGrid size={15}/>
          </button>
          <button onClick={() => setViewMode('table')} aria-label="Table view"
            className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-white shadow text-green-700' : 'text-slate-500 hover:text-slate-800'} transition-all`}>
            <List size={15}/>
          </button>
        </div>

        {/* Refresh */}
        <button onClick={loadCustomers} disabled={loading} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 disabled:opacity-40 transition-colors" aria-label="Refresh">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''}/>
        </button>
      </div>

      {/* ─── Content ─── */}
      <div className="flex-1 min-h-0 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400">
            <Loader2 size={32} className="animate-spin text-green-500"/>
            <span className="text-sm font-medium">Loading customers…</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-red-500">
            <XCircle size={36}/>
            <p className="text-sm font-medium">{error}</p>
            <button onClick={loadCustomers} className="px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 hover:bg-red-100 transition-colors">
              Retry
            </button>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400">
            <Users size={36} className="opacity-30"/>
            <p className="text-base font-medium text-slate-500">{search || categoryFilter || statusFilter !== 'Active' ? 'No customers match your filters' : 'No customers yet'}</p>
            {!search && !categoryFilter && statusFilter === 'Active' && (
              <button onClick={() => setFormParty({})} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors">
                <Plus size={14}/> Add Your First Customer
              </button>
            )}
          </div>
        ) : viewMode === 'table' ? (
          /* ──────────── TABLE VIEW ──────────── */
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {[
                      { field:'name' as SortField,           label:'Customer' },
                      { field:'city' as SortField,           label:'Location' },
                      { field:'category' as SortField,       label:'Category' },
                      { field:'currentBalance' as SortField, label:'Balance' },
                      { field:'creditLimit' as SortField,    label:'Limit' },
                      { field:'status' as SortField,         label:'Status' },
                    ].map(col => (
                      <th key={col.field}
                        onClick={() => toggleSort(col.field)}
                        className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer hover:text-slate-900 select-none whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {col.label}
                          <SortIcon field={col.field} sortField={sortField} sortDir={sortDir}/>
                        </div>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map(c => {
                    const score = completenessScore(c);
                    const isDeleting = deletingId === c.id;
                    return (
                      <tr key={c.id} className="hover:bg-slate-50 group transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">{c.name}</p>
                              <p className="text-xs text-slate-400">{c.mobile}{c.email ? ` · ${c.email}` : ''}</p>
                            </div>
                            {score < 70 && <span className="text-amber-500" title="Incomplete profile"><AlertCircle size={13}/></span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {c.city || '—'}
                          {c.state && <span className="text-slate-400 text-xs block">{c.state}</span>}
                        </td>
                        <td className="px-4 py-3"><CategoryBadge category={c.category}/></td>
                        <td className={`px-4 py-3 font-semibold ${(c.currentBalance??0) >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {currency.format(Math.abs(c.currentBalance??0))}
                          <span className="text-xs font-normal ml-0.5">{(c.currentBalance??0) >= 0 ? 'Dr':'Cr'}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {c.creditLimit ? currency.format(c.creditLimit) : '—'}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={c.status}/></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setProfileParty(c)} title="View profile"
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-green-700 transition-colors">
                              <Eye size={14}/>
                            </button>
                            <button onClick={() => setLedgerParty(c)} title="View ledger"
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-blue-700 transition-colors">
                              <BookOpen size={14}/>
                            </button>
                            <button onClick={() => handleViewInvoices(c)} title="View invoices"
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-purple-700 transition-colors">
                              <FileText size={14}/>
                            </button>
                            <button onClick={() => setFormParty(c)} title="Edit"
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-amber-700 transition-colors">
                              <Pencil size={14}/>
                            </button>
                            <button onClick={() => setConfirmDelete(c)} disabled={isDeleting} title="Deactivate"
                              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-500 hover:text-red-700 disabled:opacity-40 transition-colors">
                              {isDeleting ? <Loader2 size={14} className="animate-spin"/> : <Trash2 size={14}/>}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ──────────── CARD VIEW ──────────── */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginated.map(c => {
              const score     = completenessScore(c);
              const balance   = c.currentBalance ?? 0;
              const overLimit = Number(c.creditLimit ?? 0) > 0 && Number(balance) > Number(c.creditLimit ?? 0);
              const isDeleting = deletingId === c.id;

              return (
                <article key={c.id} aria-label={`Customer: ${c.name}`}
                  className={`bg-white rounded-2xl border transition-all hover:shadow-md group
                    ${overLimit ? 'border-red-300' : score < 70 ? 'border-amber-200' : 'border-slate-200'}`}>
                  {/* Card header */}
                  <div className="p-4 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 text-sm leading-tight truncate">{c.name}</p>
                          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            <StatusBadge status={c.status}/>
                            <CategoryBadge category={c.category}/>
                          </div>
                        </div>
                      </div>
                      {(score < 70 || overLimit) && (
                        <div className="flex gap-1 shrink-0">
                          {score < 70 && (
                            <span title={`Profile ${score}% complete`} className="text-amber-500"><AlertCircle size={14}/></span>
                          )}
                          {overLimit && (
                            <span title="Over credit limit" className="text-red-500"><Shield size={14}/></span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Contact info */}
                    <div className="mt-3 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <Phone size={11} className="text-slate-400 shrink-0"/>
                        <span>{c.mobile}</span>
                        {c.gstin && <span className="text-slate-300">·</span>}
                        {c.gstin && <span className="font-mono text-slate-500 truncate">{c.gstin}</span>}
                      </div>
                      {(c.city || c.state) && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <MapPin size={11} className="text-slate-400 shrink-0"/>
                          <span>{[c.city, c.state].filter(Boolean).join(', ')}{c.pinCode ? ` ${c.pinCode}` : ''}</span>
                        </div>
                      )}
                      {(() => {
                        const { status } = computeComplianceFE(c);
                        const ui = COMPLIANCE_UI[status];
                        return (
                          <div className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${ui.cls}`}>
                            {ui.icon} {(c as any).entity_type || 'No Entity'} · {ui.label}
                          </div>
                        );
                      })()}
                      {c.drugLicenseNo && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Shield size={11} className="text-slate-400 shrink-0"/>
                          <span className="font-mono">{c.drugLicenseNo}</span>
                        </div>
                      )}
                      {c.route && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <MapPin size={11} className="text-slate-400 shrink-0"/>
                          <span>Route: {c.route}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Balance strip */}
                  <div className={`mx-3 mb-3 rounded-xl px-3 py-2 flex justify-between items-center
                    ${overLimit ? 'bg-red-50 border border-red-200' : 'bg-slate-50'}`}>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Balance</p>
                      <p className={`text-sm font-bold ${balance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {currency.format(Math.abs(balance))}
                        <span className="text-xs font-normal ml-1">{balance >= 0 ? 'Dr':'Cr'}</span>
                      </p>
                    </div>
                    {(c.creditLimit ?? 0) > 0 && (
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Limit</p>
                        <p className={`text-sm font-semibold ${overLimit ? 'text-red-700' : 'text-slate-700'}`}>
                          {currency.format(c.creditLimit ?? 0)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="px-3 pb-3 flex gap-1.5">
                    <button onClick={() => setProfileParty(c)} title="Full profile"
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200">
                      <Eye size={12}/> Profile
                    </button>
                    <button onClick={() => setLedgerParty(c)} title="Ledger"
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors border border-slate-200">
                      <BookOpen size={12}/> Ledger
                    </button>
                    <button onClick={() => setFormParty(c)} title="Edit"
                      className="p-1.5 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors border border-slate-200">
                      <Pencil size={13}/>
                    </button>
                    <button onClick={() => setConfirmDelete(c)} disabled={isDeleting} title="Deactivate"
                      className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors border border-slate-200 disabled:opacity-40">
                      {isDeleting ? <Loader2 size={13} className="animate-spin"/> : <Trash2 size={13}/>}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Pagination footer ─── */}
      {!loading && sorted.length > 0 && (
        <div className="shrink-0 bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing <strong>{((safePage - 1) * pageSize) + 1}</strong>–<strong>{Math.min(safePage * pageSize, sorted.length)}</strong> of <strong>{sorted.length}</strong> customers
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentPage(1)} disabled={safePage === 1}
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-600 transition-colors text-xs font-bold px-2">«</button>
            <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={safePage === 1}
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-600 transition-colors"><ChevronLeft size={15}/></button>
            {/* Page numbers */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(safePage - 2, totalPages - 4));
              const pg = start + i;
              return (
                <button key={pg} onClick={() => setCurrentPage(pg)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors
                    ${pg === safePage ? 'bg-green-600 text-white' : 'hover:bg-slate-100 text-slate-600'}`}>
                  {pg}
                </button>
              );
            })}
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={safePage === totalPages}
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-600 transition-colors"><ChevronRight size={15}/></button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={safePage === totalPages}
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-600 transition-colors text-xs font-bold px-2">»</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerDatabasePage;
