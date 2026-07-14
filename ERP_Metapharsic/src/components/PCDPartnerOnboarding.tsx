import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronRight, ChevronLeft, Check, AlertCircle, FileText,
  DollarSign, Building2, Shield, RefreshCcw, Users, CheckCircle,
  Clock, XCircle, Eye
} from 'lucide-react';
import apiClient from '../services/apiClient';

interface PartnerForm {
  name: string;
  territory: string;
  state: string;
  district: string;
  contactPerson: string;
  contactNumber: string;
  email: string;
  drugLicenseNo: string;
  drugLicenseExpiry: string;
  gstRegistration: string;
  gstinExpiry: string;
  creditLimit: number;
  discountPercentage: number;
  partnerGrade: string;
}

const STEPS = [
  { step: 1, label: 'Basic Info',    icon: Building2 },
  { step: 2, label: 'Drug License',  icon: Shield },
  { step: 3, label: 'GST Details',   icon: FileText },
  { step: 4, label: 'Credit Terms',  icon: DollarSign },
  { step: 5, label: 'Review',        icon: Check },
];

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal','Delhi','Jammu & Kashmir','Ladakh',
];

const EMPTY_FORM: PartnerForm = {
  name: '', territory: '', state: '', district: '',
  contactPerson: '', contactNumber: '', email: '',
  drugLicenseNo: '', drugLicenseExpiry: '',
  gstRegistration: '', gstinExpiry: '',
  creditLimit: 100000, discountPercentage: 5, partnerGrade: 'BRONZE',
};

interface Props { onComplete?: () => void; }

const PCDPartnerOnboarding: React.FC<Props> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<PartnerForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Applications list
  const [applications, setApplications] = useState<any[]>([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [appDocs, setAppDocs] = useState<any[]>([]);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 5000);
  };

  const loadApplications = useCallback(async () => {
    setAppsLoading(true);
    try {
      const res = await apiClient.get('/pcd/onboarding/applications');
      if (res.success) setApplications(res.data);
    } catch { /* silent */ }
    finally { setAppsLoading(false); }
  }, []);

  useEffect(() => { loadApplications(); }, [loadApplications]);

  const set = (field: keyof PartnerForm, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => { const e = { ...prev }; delete e[field]; return e; });
  };

  const validate = (s: number): boolean => {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (!form.name.trim()) e.name = 'Company name required';
      if (!form.territory.trim()) e.territory = 'Territory required';
      if (!form.state) e.state = 'State required';
      if (!form.contactPerson.trim()) e.contactPerson = 'Contact person required';
      if (!/^\+?[\d\s-]{10,}$/.test(form.contactNumber)) e.contactNumber = 'Valid phone required';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Valid email required';
    }
    if (s === 2) {
      if (!form.drugLicenseNo.trim()) e.drugLicenseNo = 'Drug license number required';
      if (!form.drugLicenseExpiry) e.drugLicenseExpiry = 'Expiry date required';
      else if (new Date(form.drugLicenseExpiry) <= new Date()) e.drugLicenseExpiry = 'License must not be expired';
    }
    if (s === 3) {
      if (!form.gstRegistration.trim()) e.gstRegistration = 'GST number required';
      else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gstRegistration.toUpperCase()))
        e.gstRegistration = 'Invalid GSTIN format (e.g. 27AAPFU0939F1ZV)';
    }
    if (s === 4) {
      if (form.creditLimit < 10000) e.creditLimit = 'Minimum credit limit ₹10,000';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => { if (validate(step)) setStep(s => Math.min(s + 1, 5)); };
  const handleBack = () => { setStep(s => Math.max(s - 1, 1)); setErrors({}); };

  const handleSubmit = async () => {
    if (!validate(5)) return;
    setSubmitting(true);
    try {
      const res = await apiClient.post('/pcd/partners', {
        name: form.name,
        territory: form.territory,
        state: form.state,
        district: form.district,
        contact_person: form.contactPerson,
        contact_number: form.contactNumber,
        email: form.email,
        drug_license_no: form.drugLicenseNo,
        drug_license_expiry: form.drugLicenseExpiry || null,
        gst_registration: form.gstRegistration.toUpperCase(),
        gstin_expiry: form.gstinExpiry || null,
        credit_limit: form.creditLimit,
        discount_percentage: form.discountPercentage,
        partner_grade: form.partnerGrade,
        status: 'APPLIED',
      });
      if (res.success) {
        showToast('success', `Partner "${form.name}" application submitted. Documents pending verification.`);
        setForm(EMPTY_FORM);
        setStep(1);
        await loadApplications();
        onComplete?.();
      } else {
        showToast('error', res.error || 'Submission failed');
      }
    } catch (e: any) {
      const msg = e?.data?.error || e?.message || 'Submission failed';
      showToast('error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const viewDocs = async (app: any) => {
    setSelectedApp(app);
    try {
      const res = await apiClient.get(`/pcd/partner-documents?partner_id=${app.id}`);
      if (res.success) setAppDocs(res.data);
    } catch { setAppDocs([]); }
  };

  const verifyDoc = async (docId: string, status: 'VERIFIED' | 'REJECTED') => {
    try {
      await apiClient.put(`/pcd/partner-documents/${docId}/verify`, { status });
      const res = await apiClient.get(`/pcd/partner-documents?partner_id=${selectedApp.id}`);
      if (res.success) setAppDocs(res.data);
      await loadApplications();
    } catch (e: any) {
      showToast('error', e?.message || 'Failed to update document');
    }
  };

  const inputCls = (field: string) =>
    `w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-400 transition ${
      errors[field] ? 'border-red-400 bg-red-50' : 'border-slate-300'
    }`;

  const renderStep = () => {
    switch (step) {
      case 1: return (
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Building2 size={18} className="text-sky-500" /> Basic Information</h3>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Company / Agency Name *</label>
            <input className={inputCls('name')} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Sunrise Pharma Distributors" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Territory *</label>
              <input className={inputCls('territory')} value={form.territory} onChange={e => set('territory', e.target.value)} placeholder="e.g. Mumbai North" />
              {errors.territory && <p className="text-red-500 text-xs mt-1">{errors.territory}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">State *</label>
              <select className={inputCls('state')} value={form.state} onChange={e => set('state', e.target.value)}>
                <option value="">Select State</option>
                {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {errors.state && <p className="text-red-500 text-xs mt-1">{errors.state}</p>}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">District</label>
            <input className={inputCls('district')} value={form.district} onChange={e => set('district', e.target.value)} placeholder="e.g. Thane" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Contact Person *</label>
            <input className={inputCls('contactPerson')} value={form.contactPerson} onChange={e => set('contactPerson', e.target.value)} placeholder="Full name" />
            {errors.contactPerson && <p className="text-red-500 text-xs mt-1">{errors.contactPerson}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Phone *</label>
              <input className={inputCls('contactNumber')} value={form.contactNumber} onChange={e => set('contactNumber', e.target.value)} placeholder="+91-XXXXXXXXXX" />
              {errors.contactNumber && <p className="text-red-500 text-xs mt-1">{errors.contactNumber}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email *</label>
              <input type="email" className={inputCls('email')} value={form.email} onChange={e => set('email', e.target.value)} placeholder="contact@company.com" />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>
          </div>
        </div>
      );

      case 2: return (
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Shield size={18} className="text-sky-500" /> Drug License Details</h3>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            Drug License No. must be unique. Contact your State Drug Authority if unsure.
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Drug License Number *</label>
            <input className={inputCls('drugLicenseNo')} value={form.drugLicenseNo} onChange={e => set('drugLicenseNo', e.target.value)} placeholder="e.g. MH-MUM-20B-2024-001" />
            {errors.drugLicenseNo && <p className="text-red-500 text-xs mt-1">{errors.drugLicenseNo}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">License Expiry Date *</label>
            <input type="date" className={inputCls('drugLicenseExpiry')} value={form.drugLicenseExpiry}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => set('drugLicenseExpiry', e.target.value)} />
            {errors.drugLicenseExpiry && <p className="text-red-500 text-xs mt-1">{errors.drugLicenseExpiry}</p>}
          </div>
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
            A document record will be created in <strong>pcd_partner_documents</strong> with status PENDING for admin verification.
          </div>
        </div>
      );

      case 3: return (
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2"><FileText size={18} className="text-sky-500" /> GST Registration</h3>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">GSTIN *</label>
            <input className={inputCls('gstRegistration')} value={form.gstRegistration}
              onChange={e => set('gstRegistration', e.target.value.toUpperCase())}
              placeholder="e.g. 27AAPFU0939F1ZV" maxLength={15} />
            {errors.gstRegistration && <p className="text-red-500 text-xs mt-1">{errors.gstRegistration}</p>}
            {form.gstRegistration && !errors.gstRegistration && (
              <p className="text-green-600 text-xs mt-1 flex items-center gap-1"><CheckCircle size={12} /> Valid GSTIN format</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">GST Certificate Expiry</label>
            <input type="date" className={inputCls('gstinExpiry')} value={form.gstinExpiry} onChange={e => set('gstinExpiry', e.target.value)} />
          </div>
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
            GST certificate will be stored in <strong>pcd_partner_documents</strong> and verified by admin.
          </div>
        </div>
      );

      case 4: return (
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2"><DollarSign size={18} className="text-sky-500" /> Credit & Grade</h3>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Credit Limit (₹) *</label>
            <input type="number" className={inputCls('creditLimit')} value={form.creditLimit}
              onChange={e => set('creditLimit', Number(e.target.value))} min={10000} step={5000} />
            {errors.creditLimit && <p className="text-red-500 text-xs mt-1">{errors.creditLimit}</p>}
            <p className="text-slate-400 text-xs mt-1">Adjustable after approval based on payment history</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Partner Grade</label>
              <select className={inputCls('partnerGrade')} value={form.partnerGrade} onChange={e => set('partnerGrade', e.target.value)}>
                <option value="BRONZE">Bronze</option>
                <option value="SILVER">Silver</option>
                <option value="GOLD">Gold</option>
                <option value="PLATINUM">Platinum</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Discount % Offered</label>
              <input type="number" className={inputCls('discountPercentage')} value={form.discountPercentage}
                onChange={e => set('discountPercentage', Number(e.target.value))} min={0} max={30} step={0.5} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs text-slate-600 bg-slate-50 rounded-lg p-3 border border-slate-200">
            <div><strong>Bronze:</strong> Commission 5%</div>
            <div><strong>Silver:</strong> Commission 7%</div>
            <div><strong>Gold:</strong> Commission 8.5%</div>
            <div><strong>Platinum:</strong> Commission 10%</div>
          </div>
        </div>
      );

      case 5: return (
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Check size={18} className="text-sky-500" /> Review & Submit</h3>
          <div className="space-y-3">
            {[
              { label: 'Company', value: form.name },
              { label: 'Territory', value: `${form.territory}${form.district ? ` — ${form.district}` : ''}, ${form.state}` },
              { label: 'Contact', value: `${form.contactPerson} | ${form.contactNumber}` },
              { label: 'Email', value: form.email },
              { label: 'Drug License', value: `${form.drugLicenseNo} (exp: ${form.drugLicenseExpiry || '—'})` },
              { label: 'GSTIN', value: `${form.gstRegistration} (exp: ${form.gstinExpiry || '—'})` },
              { label: 'Credit Limit', value: `₹${form.creditLimit.toLocaleString('en-IN')}` },
              { label: 'Grade', value: form.partnerGrade },
              { label: 'Discount', value: `${form.discountPercentage}%` },
            ].map(r => (
              <div key={r.label} className="flex gap-3 text-sm border-b border-slate-100 pb-2">
                <span className="text-slate-500 w-28 flex-shrink-0">{r.label}:</span>
                <span className="font-medium text-slate-800">{r.value}</span>
              </div>
            ))}
          </div>
          <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg text-xs text-sky-700">
            On submit: partner record saved to <strong>pcd_partners</strong> with status APPLIED, and document records created in <strong>pcd_partner_documents</strong> for admin verification.
          </div>
        </div>
      );
    }
  };

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Stepper form card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Step indicator */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
          <div className="flex items-center">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = step > s.step;
              const active = step === s.step;
              return (
                <React.Fragment key={s.step}>
                  <div className="flex flex-col items-center gap-1 min-w-[64px]">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                      done ? 'bg-green-500 text-white' : active ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {done ? <Check size={16} /> : <Icon size={16} />}
                    </div>
                    <span className={`text-xs font-medium text-center leading-tight ${active ? 'text-sky-600' : done ? 'text-green-600' : 'text-slate-400'}`}>
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 mb-5 rounded ${step > s.step ? 'bg-green-500' : 'bg-slate-200'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Form content */}
        <div className="p-6">{renderStep()}</div>

        {/* Navigation */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
          <button onClick={handleBack} disabled={step === 1}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <ChevronLeft size={16} /> Back
          </button>
          {step < 5 ? (
            <button onClick={handleNext}
              className="flex items-center gap-2 px-5 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 transition-colors">
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
              {submitting ? <><RefreshCcw size={14} className="animate-spin" /> Submitting…</> : <><CheckCircle size={16} /> Submit Application</>}
            </button>
          )}
        </div>
      </div>

      {/* Existing Applications List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Users size={18} className="text-sky-500" /> Partner Applications
          </h3>
          <button onClick={loadApplications} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
            <RefreshCcw size={14} /> Refresh
          </button>
        </div>

        {appsLoading ? (
          <div className="flex items-center justify-center py-10 text-slate-400">
            <RefreshCcw size={18} className="animate-spin mr-2" /> Loading…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-max w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Partner Name','Territory','State','Grade','Status','Drug License','GSTIN','Credit Limit','Docs','Created','Action'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applications.map(app => (
                  <tr key={app.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{app.name}</td>
                    <td className="px-4 py-3 text-slate-600">{app.territory}</td>
                    <td className="px-4 py-3 text-slate-500">{app.state || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        app.partner_grade === 'PLATINUM' ? 'bg-purple-100 text-purple-700'
                        : app.partner_grade === 'GOLD' ? 'bg-yellow-100 text-yellow-700'
                        : app.partner_grade === 'SILVER' ? 'bg-slate-200 text-slate-700'
                        : 'bg-orange-100 text-orange-700'
                      }`}>{app.partner_grade}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        app.status === 'ACTIVE' ? 'bg-green-100 text-green-700'
                        : app.status === 'APPLIED' ? 'bg-blue-100 text-blue-700'
                        : app.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-slate-100 text-slate-500'
                      }`}>{app.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono">{app.drug_license_no || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono">{app.gst_registration || '—'}</td>
                    <td className="px-4 py-3 text-slate-700">₹{Number(app.credit_limit || 0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-green-600 font-semibold">{app.verified_docs}✓</span>
                        <span className="text-yellow-600">{app.pending_docs}⏳</span>
                        {Number(app.rejected_docs) > 0 && <span className="text-red-500">{app.rejected_docs}✗</span>}
                        <span className="text-slate-400">/{app.total_docs}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                      {app.created_at ? new Date(app.created_at).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => viewDocs(app)}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-sky-50 text-sky-700 border border-sky-200 rounded hover:bg-sky-100">
                        <Eye size={12} /> Docs
                      </button>
                    </td>
                  </tr>
                ))}
                {applications.length === 0 && (
                  <tr><td colSpan={11} className="text-center py-10 text-slate-400">No applications yet. Submit the form above to create one.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Document verification drawer */}
      {selectedApp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-end" onClick={() => setSelectedApp(null)}>
          <div className="bg-white h-full w-full max-w-lg shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="font-bold">{selectedApp.name}</h3>
                <p className="text-xs text-slate-300">{selectedApp.territory} · Document Verification</p>
              </div>
              <button onClick={() => setSelectedApp(null)} className="text-slate-300 hover:text-white text-xl leading-none">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Drug License', selectedApp.drug_license_no || '—'],
                  ['GSTIN', selectedApp.gst_registration || '—'],
                  ['State', selectedApp.state || '—'],
                  ['Grade', selectedApp.partner_grade],
                  ['Credit Limit', `₹${Number(selectedApp.credit_limit).toLocaleString('en-IN')}`],
                  ['Status', selectedApp.status],
                ].map(([k, v]) => (
                  <div key={k} className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500">{k}</p>
                    <p className="font-semibold text-slate-800">{v}</p>
                  </div>
                ))}
              </div>

              <h4 className="font-semibold text-slate-700 mt-4">Documents</h4>
              {appDocs.length === 0 ? (
                <p className="text-slate-400 text-sm">No documents on file.</p>
              ) : (
                appDocs.map(doc => (
                  <div key={doc.id} className="border border-slate-200 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-slate-800 text-sm">{doc.document_name}</p>
                        <p className="text-xs text-slate-500">{doc.document_type}</p>
                        {doc.expiry_date && (
                          <p className="text-xs text-slate-500">Expires: {new Date(doc.expiry_date).toLocaleDateString('en-IN')}</p>
                        )}
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        doc.status === 'VERIFIED' ? 'bg-green-100 text-green-700'
                        : doc.status === 'REJECTED' ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {doc.status === 'VERIFIED' ? <CheckCircle size={10} className="inline mr-1" /> : doc.status === 'REJECTED' ? <XCircle size={10} className="inline mr-1" /> : <Clock size={10} className="inline mr-1" />}
                        {doc.status}
                      </span>
                    </div>
                    {doc.status === 'PENDING' && (
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => verifyDoc(doc.id, 'VERIFIED')}
                          className="flex-1 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">
                          ✓ Verify
                        </button>
                        <button onClick={() => verifyDoc(doc.id, 'REJECTED')}
                          className="flex-1 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">
                          ✗ Reject
                        </button>
                      </div>
                    )}
                    {doc.status !== 'PENDING' && doc.approved_at && (
                      <p className="text-xs text-slate-400 mt-2">Updated: {new Date(doc.approved_at).toLocaleDateString('en-IN')}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PCDPartnerOnboarding;
