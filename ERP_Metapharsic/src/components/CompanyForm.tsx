import React, { useState, useRef, useEffect } from 'react';
import { Building2, Save, CheckCircle, Upload, X, AlertCircle } from 'lucide-react';
import { Company } from '../types';
import { useCompany } from '../context/CompanyContext';
import { useNotifications } from '../context/NotificationContext';
import settingsService from '../services/settingsService';

// ─── Indian States + UTs ─────────────────────────────────────────────────────
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  // Union Territories
  'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir',
  'Ladakh', 'Lakshadweep', 'Puducherry',
];

// ─── Field wrapper ────────────────────────────────────────────────────────────
const Field: React.FC<{
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, required, error, hint, children }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
      {label}{required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
    {hint && !error && <p className="text-[10px] text-slate-400 mt-1">{hint}</p>}
    {error && (
      <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
        <AlertCircle size={10} className="flex-shrink-0" />{error}
      </p>
    )}
  </div>
);

// ─── Section divider ──────────────────────────────────────────────────────────
const SectionDivider: React.FC<{ title: string }> = ({ title }) => (
  <div className="border-t border-slate-100 pt-5 pb-1">
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.12em]">{title}</p>
  </div>
);

// ─── Shared input classes ─────────────────────────────────────────────────────
const inputCls = (hasError?: boolean) =>
  `w-full border ${hasError ? 'border-red-400 focus:ring-red-300' : 'border-slate-300 focus:ring-green-500 focus:border-green-500'}
   rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 transition-colors`;

// ═════════════════════════════════════════════════════════════════════════════
const CompanyForm: React.FC = () => {
  const { company, initializeCompany, updateCompany } = useCompany();
  const { addNotification } = useNotifications();
  const logoInputRef = useRef<HTMLInputElement>(null);

  type FormData = Omit<Company, 'id' | 'createdAt' | 'updatedAt'>;

  const [formData, setFormData] = useState<FormData>({
    name: company?.name || '',
    businessType: company?.businessType || 'Pharmaceutical',
    taxStructure: company?.taxStructure || 'Product Wise',
    financialYearStart: company?.financialYearStart || `${new Date().getFullYear() - (new Date().getMonth() < 3 ? 1 : 0)}-04-01`,
    financialYearEnd: company?.financialYearEnd || `${new Date().getFullYear() + (new Date().getMonth() >= 3 ? 1 : 0)}-03-31`,
    gstin: company?.gstin || '',
    vatNumber: company?.vatNumber || '',
    drugLicenseNo: company?.drugLicenseNo || '',
    foodLicenseNo: company?.foodLicenseNo || '',
    valuationMethod: company?.valuationMethod || 'Last Purchase',
    address: company?.address || '',
    city: company?.city || '',
    state: company?.state || '',
    pinCode: company?.pinCode || '',
    country: 'India',
    phone: company?.phone || '',
    email: company?.email || '',
    website: company?.website || '',
    logoUrl: company?.logoUrl || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string>(company?.logoUrl || '');

  // On mount: hydrate from localStorage first (instant), then refresh from API (authoritative)
  useEffect(() => {
    if (company) {
      setFormData({
        name: company.name,
        businessType: company.businessType,
        taxStructure: company.taxStructure,
        financialYearStart: company.financialYearStart,
        financialYearEnd: company.financialYearEnd,
        gstin: company.gstin,
        vatNumber: company.vatNumber || '',
        drugLicenseNo: company.drugLicenseNo,
        foodLicenseNo: company.foodLicenseNo || '',
        valuationMethod: company.valuationMethod,
        address: company.address,
        city: company.city,
        state: company.state,
        pinCode: company.pinCode,
        country: company.country || 'India',
        phone: company.phone,
        email: company.email,
        website: company.website || '',
        logoUrl: company.logoUrl || '',
      });
      setLogoPreview(company.logoUrl || '');
    }

    // Refresh from server in the background (authoritative source)
    settingsService.getCompany().then(serverData => {
      if (!serverData) return;
      setFormData({
        name: serverData.name || '',
        businessType: serverData.businessType || 'Pharmaceutical',
        taxStructure: serverData.taxStructure || 'Product Wise',
        financialYearStart: serverData.financialYearStart || '',
        financialYearEnd: serverData.financialYearEnd || '',
        gstin: serverData.gstin || '',
        vatNumber: serverData.vatNumber || '',
        drugLicenseNo: serverData.drugLicenseNo || '',
        foodLicenseNo: serverData.foodLicenseNo || '',
        valuationMethod: serverData.valuationMethod || 'Last Purchase',
        address: serverData.address || '',
        city: serverData.city || '',
        state: serverData.state || '',
        pinCode: serverData.pinCode || '',
        country: serverData.country || 'India',
        phone: serverData.phone || '',
        email: serverData.email || '',
        website: serverData.website || '',
        logoUrl: serverData.logoUrl || '',
      });
      setLogoPreview(serverData.logoUrl || '');
    }).catch(() => { /* silently fall back to localStorage */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setIsDirty(true);
    if (errors[name]) setErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
  };

  // Logo file upload handler
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, logoUrl: 'Please select a valid image file' }));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, logoUrl: 'Logo must be under 2MB' }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setLogoPreview(dataUrl);
      setFormData(prev => ({ ...prev, logoUrl: dataUrl }));
      setIsDirty(true);
      if (errors.logoUrl) setErrors(prev => { const n = { ...prev }; delete n.logoUrl; return n; });
    };
    reader.readAsDataURL(file);
  };

  const clearLogo = () => {
    setLogoPreview('');
    setFormData(prev => ({ ...prev, logoUrl: '' }));
    setIsDirty(true);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!formData.name.trim()) e.name = 'Company name is required';
    if (!formData.gstin.trim()) {
      e.gstin = 'GSTIN is required';
    } else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(formData.gstin.toUpperCase())) {
      e.gstin = 'Invalid GSTIN format (e.g. 27AAPFU0939F1ZV)';
    }
    if (!formData.drugLicenseNo.trim()) e.drugLicenseNo = 'Drug License No. is required';
    if (!formData.address.trim()) e.address = 'Address is required';
    if (!formData.city.trim()) e.city = 'City is required';
    if (!formData.state.trim()) e.state = 'State is required';
    if (!formData.pinCode.trim()) e.pinCode = 'PIN Code is required';
    else if (!/^\d{6}$/.test(formData.pinCode)) e.pinCode = 'PIN Code must be 6 digits';
    if (!formData.phone.trim()) e.phone = 'Phone is required';
    else if (!/^[0-9]{10,12}$/.test(formData.phone.replace(/\D/g, ''))) e.phone = 'Must be 10–12 digits';
    if (!formData.email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) e.email = 'Invalid email address';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSaving(true);
    const payload = { ...formData, gstin: formData.gstin.toUpperCase() };

    try {
      // 1. Persist to API (authoritative DB store)
      await settingsService.saveCompany(payload);

      // 2. Sync local context (localStorage mirror + in-memory state for other components)
      if (company) {
        updateCompany(payload);
      } else {
        initializeCompany(payload);
      }

      setIsDirty(false);
      addNotification({
        type: 'success',
        title: 'Company Profile Saved',
        message: `${formData.name} has been ${company ? 'updated' : 'registered'} successfully.`,
        priority: 'low',
        module: 'SYSTEM',
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Save Failed',
        message: err?.message || 'Failed to save company profile. Please try again.',
        priority: 'high',
        module: 'SYSTEM',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Card Header */}
      <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Building2 className="text-slate-600" size={16} />
          <h3 className="font-semibold text-slate-800 text-sm">Company Information</h3>
        </div>
        {company && (
          <span className="text-[10px] font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle size={10} />Configured
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4" noValidate>
        {/* ── Logo Upload ─────────────────────────────────────────────── */}
        <SectionDivider title="Company Logo" />
        <div className="flex items-start gap-4">
          {/* Preview */}
          <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden bg-slate-50 flex-shrink-0 relative group">
            {logoPreview ? (
              <>
                <img src={logoPreview} alt="Company logo" className="w-full h-full object-contain" />
                <button
                  type="button"
                  onClick={clearLogo}
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <X size={18} className="text-white" />
                </button>
              </>
            ) : (
              <Building2 size={28} className="text-slate-300" />
            )}
          </div>
          {/* Upload button */}
          <div className="flex-1 min-w-0">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
              id="logo-upload-input"
            />
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
            >
              <Upload size={13} />
              {logoPreview ? 'Change Logo' : 'Upload Logo'}
            </button>
            <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
              PNG, JPG or SVG. Max 2 MB.<br />
              Displayed on invoices and reports.
            </p>
            {errors.logoUrl && (
              <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle size={10} />{errors.logoUrl}
              </p>
            )}
          </div>
        </div>

        {/* ── Basic Info ──────────────────────────────────────────────── */}
        <SectionDivider title="Basic Information" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Company Name" required error={errors.name}>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={inputCls(!!errors.name)}
              placeholder="Metapharsic Lifesciences Pvt. Ltd."
            />
          </Field>
          <Field label="Business Type">
            <select name="businessType" value={formData.businessType} onChange={handleChange} className={inputCls()}>
              <option>Pharmaceutical</option>
              <option>Medical Device</option>
              <option>Food Supplement</option>
              <option>Cosmetic</option>
              <option>Biotech</option>
              <option>Generic Medicine</option>
              <option>Retail Pharmacy</option>
              <option>Wholesale Distributor</option>
              <option>C&F Agent</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Tax Structure">
            <select name="taxStructure" value={formData.taxStructure} onChange={handleChange} className={inputCls()}>
              <option value="Product Wise">Product Wise (per line item)</option>
              <option value="Invoice Wise">Invoice Wise (on total)</option>
            </select>
          </Field>
          <Field label="Inventory Valuation">
            <select name="valuationMethod" value={formData.valuationMethod} onChange={handleChange} className={inputCls()}>
              <option value="Last Purchase">Last Purchase Rate</option>
              <option value="Average Cost">Average Cost</option>
              <option value="FIFO">FIFO (First In, First Out)</option>
              <option value="LIFO">LIFO (Last In, First Out)</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Financial Year Start">
            <input type="date" name="financialYearStart" value={formData.financialYearStart} onChange={handleChange} className={inputCls()} />
          </Field>
          <Field label="Financial Year End">
            <input type="date" name="financialYearEnd" value={formData.financialYearEnd} onChange={handleChange} className={inputCls()} />
          </Field>
        </div>

        {/* ── Licenses ────────────────────────────────────────────────── */}
        <SectionDivider title="Licenses & Registrations" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="GSTIN" required error={errors.gstin} hint="15-character GST Identification Number">
            <input
              type="text"
              name="gstin"
              value={formData.gstin}
              onChange={handleChange}
              className={`${inputCls(!!errors.gstin)} uppercase font-mono`}
              placeholder="27AAPFU0939F1ZV"
              maxLength={15}
            />
          </Field>
          <Field label="VAT Number" hint="Optional — if registered under old VAT regime">
            <input
              type="text"
              name="vatNumber"
              value={formData.vatNumber}
              onChange={handleChange}
              className={inputCls()}
              placeholder="Optional VAT registration"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Drug License No." required error={errors.drugLicenseNo} hint="Required for pharmaceutical distribution">
            <input
              type="text"
              name="drugLicenseNo"
              value={formData.drugLicenseNo}
              onChange={handleChange}
              className={inputCls(!!errors.drugLicenseNo)}
              placeholder="MH/DL/2024/001234"
            />
          </Field>
          <Field label="FSSAI / Food License No." hint="Optional — for food or nutraceutical products">
            <input
              type="text"
              name="foodLicenseNo"
              value={formData.foodLicenseNo}
              onChange={handleChange}
              className={inputCls()}
              placeholder="10024001000123"
            />
          </Field>
        </div>

        {/* ── Contact ─────────────────────────────────────────────────── */}
        <SectionDivider title="Contact Information" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Phone" required error={errors.phone} hint="10–12 digits without spaces or dashes">
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className={inputCls(!!errors.phone)}
              placeholder="9876543210"
            />
          </Field>
          <Field label="Email" required error={errors.email}>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={inputCls(!!errors.email)}
              placeholder="accounts@company.com"
            />
          </Field>
        </div>

        <Field label="Website" hint="Optional — include https://">
          <input
            type="url"
            name="website"
            value={formData.website}
            onChange={handleChange}
            className={inputCls()}
            placeholder="https://www.company.com"
          />
        </Field>

        {/* ── Address ─────────────────────────────────────────────────── */}
        <SectionDivider title="Registered Address" />
        <Field label="Street Address" required error={errors.address}>
          <textarea
            name="address"
            value={formData.address}
            onChange={handleChange}
            rows={2}
            className={inputCls(!!errors.address)}
            placeholder="Plot No., Building Name, Street..."
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="City" required error={errors.city}>
            <input
              type="text"
              name="city"
              value={formData.city}
              onChange={handleChange}
              className={inputCls(!!errors.city)}
              placeholder="Mumbai"
            />
          </Field>

          {/* ✅ Indian States select instead of free-text input */}
          <Field label="State" required error={errors.state}>
            <select
              name="state"
              value={formData.state}
              onChange={handleChange}
              className={inputCls(!!errors.state)}
            >
              <option value="">— Select State —</option>
              {INDIAN_STATES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>

          <Field label="PIN Code" required error={errors.pinCode}>
            <input
              type="text"
              name="pinCode"
              value={formData.pinCode}
              onChange={handleChange}
              className={`${inputCls(!!errors.pinCode)} font-mono`}
              placeholder="400001"
              maxLength={6}
            />
          </Field>
        </div>

        {/* Country — read-only for Indian ERP */}
        <Field label="Country" hint="This ERP is configured for India (GST/drug law jurisdiction)">
          <input
            type="text"
            value="India"
            readOnly
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
          />
        </Field>

        {/* ── Sticky Save Bar ──────────────────────────────────────────── */}
        <div className="sticky bottom-0 bg-white border-t border-slate-100 pt-4 pb-1 flex items-center justify-between gap-4 -mx-5 px-5">
          {isDirty && (
            <p className="text-xs text-amber-600 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Unsaved changes
            </p>
          )}
          {!isDirty && company && (
            <p className="text-xs text-green-600 flex items-center gap-1.5">
              <CheckCircle size={12} />
              All changes saved
            </p>
          )}
          {!isDirty && !company && <div />}

          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-60 ml-auto"
          >
            {isSaving
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
              : <><Save size={15} />{company ? 'Update Company' : 'Save Company'}</>
            }
          </button>
        </div>
      </form>
    </div>
  );
};

export default CompanyForm;
