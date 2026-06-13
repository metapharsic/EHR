import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  ShieldCheck, AlertTriangle, FileText, Thermometer, CheckSquare,
  Download, Search, AlertCircle, CheckCircle, Clock, Plus, Edit,
  Trash2, X, Eye, Upload, Bell, Send, Settings2, Loader2,
  RefreshCw, Image as ImageIcon, LayoutDashboard, TrendingUp,
  Calendar, Activity, Filter, ChevronDown,
} from 'lucide-react';

const API = '/api/compliance';
const getToken = () => localStorage.getItem('accessToken') || localStorage.getItem('token') || '';
const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` });

// ── License templates ────────────────────────────────────────────────────────
const LICENSE_TEMPLATES = [
  { label:'20B',    name:'Drug License (20B)',          category:'Retail',          issued_by:'Drug Control Department' },
  { label:'21B',    name:'Drug License (21B)',          category:'Wholesale',       issued_by:'Drug Control Department' },
  { label:'FSSAI',  name:'FSSAI License',               category:'Food Safety',     issued_by:'Food Safety & Standards Authority' },
  { label:'GST',    name:'GST Registration',            category:'Tax',             issued_by:'Goods & Services Tax Network' },
  { label:'NDPS',   name:'Narcotic (NDPS) License',     category:'Controlled',      issued_by:'Narcotics Control Bureau' },
  { label:'Trade',  name:'Trade License',               category:'Municipal',       issued_by:'Municipal Corporation' },
  { label:'Import', name:'Import License',              category:'Import/Export',   issued_by:'DGFT' },
  { label:'Mfg',    name:'Manufacturing License (28B)', category:'Manufacturing',   issued_by:'Drug Control Department' },
];
const LICENSE_CATEGORIES = ['All','Retail','Wholesale','Food Safety','Tax','Controlled','Municipal','Import/Export','Manufacturing','Other'];

// ── Default audit checklist items ────────────────────────────────────────────
const DEFAULT_CHECKLIST = [
  'Premises are clean, dry, and well-ventilated.',
  'Refrigerator temperature is within 2°C – 8°C.',
  'No expired medicines on display shelves.',
  'Schedule H1 Register updated for yesterday.',
  'Pharmacist Registration Certificate displayed.',
  'Fire Extinguisher is valid and accessible.',
  'Dustbins are covered and labeled.',
  'Pest control measures are in place.',
  'Narcotics register is up to date.',
  'Purchase and sales registers are maintained.',
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}
function computeStatus(expiry: string | null): string {
  if (!expiry) return 'Valid';
  const d = daysUntil(expiry)!;
  if (d < 0)   return 'Expired';
  if (d <= 30) return 'Expiring Soon';
  return 'Valid';
}
function statusClass(status: string) {
  if (status === 'Valid')          return 'bg-green-100 text-green-700 border-green-200';
  if (status === 'Expiring Soon')  return 'bg-orange-100 text-orange-700 border-orange-200';
  if (status === 'Expired')        return 'bg-red-100 text-red-700 border-red-200';
  if (status === 'Suspended')      return 'bg-purple-100 text-purple-700 border-purple-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}
function exportCSV(rows: any[][], filename: string) {
  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = filename;
  a.click();
}

// ── Small reusable components ─────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, icon, color = 'slate' }: any) => {
  const colors: Record<string,string> = {
    green: 'bg-green-50 text-green-600', orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600', blue: 'bg-blue-50 text-blue-600',
    slate: 'bg-slate-50 text-slate-600', purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-slate-800 leading-none">{value}</p>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-0.5">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
const Compliance: React.FC = () => {
  type Tab = 'OVERVIEW' | 'LICENSES' | 'H1' | 'TEMP' | 'AUDIT' | 'SETTINGS';
  const [tab, setTab]       = useState<Tab>('OVERVIEW');
  const [search, setSearch] = useState('');
  const [toast, setToast]   = useState<{ msg: string; type: 'ok'|'err' } | null>(null);

  const showToast = (msg: string, type: 'ok'|'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  };

  // ── Risk Score ─────────────────────────────────────────────────────────────
  const [riskData, setRiskData] = useState<any>(null);
  const fetchRiskScore = useCallback(async () => {
    try {
      const r = await fetch(`${API}/risk-score`, { headers: authHeaders() });
      const d = await r.json();
      if (d.success) setRiskData(d.data);
    } catch {}
  }, []);

  // ── Overview stats ─────────────────────────────────────────────────────────
  const [overviewStats, setOverviewStats] = useState<any>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const fetchOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const [sr, rr] = await Promise.all([
        fetch(`${API}/stats`, { headers: authHeaders() }).then(r => r.json()),
        fetch(`${API}/risk-score`, { headers: authHeaders() }).then(r => r.json()),
      ]);
      if (sr.success) setOverviewStats(sr.data);
      if (rr.success) setRiskData(rr.data);
    } catch {}
    finally { setLoadingOverview(false); }
  }, []);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  // ── Licenses ───────────────────────────────────────────────────────────────
  const [licenses, setLicenses]       = useState<any[]>([]);
  const [loadingLic, setLoadingLic]   = useState(true);
  const [licCategory, setLicCategory] = useState('All');
  const [licSortExpiry, setLicSortExpiry] = useState(false);
  const [showLicModal, setShowLicModal]       = useState(false);
  const [showCertViewer, setShowCertViewer]   = useState(false);
  const [viewingLic, setViewingLic]           = useState<any>(null);
  const [editingLic, setEditingLic]           = useState<any>(null);
  const [uploadingId, setUploadingId]         = useState<string|null>(null);
  const [alertingId, setAlertingId]           = useState<string|null>(null);
  const fileRef  = useRef<HTMLInputElement>(null);
  const dropRef  = useRef<HTMLDivElement>(null);
  const [licForm, setLicForm] = useState({ name:'', license_number:'', expiry_date:'', start_date:'', category:'Retail', status:'Valid', notes:'', issued_by:'' });
  const [pendingFile, setPendingFile]         = useState<File|null>(null);
  const [pendingPreview, setPendingPreview]   = useState<string|null>(null);
  const [dragOverDrop, setDragOverDrop]       = useState(false);
  const [isSavingLic, setIsSavingLic]         = useState(false);
  const [viewerBlobUrl, setViewerBlobUrl]     = useState<string|null>(null);
  const [viewerBlobLoading, setViewerBlobLoading] = useState(false);
  const [editThumbUrl, setEditThumbUrl]       = useState<string|null>(null);

  const fetchBlobUrl = async (licId: string): Promise<string|null> => {
    try {
      const r = await fetch(`${API}/licenses/${licId}/certificate`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!r.ok) return null;
      return URL.createObjectURL(await r.blob());
    } catch { return null; }
  };

  const fetchLicenses = useCallback(async () => {
    setLoadingLic(true);
    try {
      const url = licCategory !== 'All' ? `${API}/licenses?category=${encodeURIComponent(licCategory)}` : `${API}/licenses`;
      const r = await fetch(url, { headers: authHeaders() });
      const d = await r.json();
      setLicenses(d.success ? d.data : []);
    } catch { setLicenses([]); }
    finally { setLoadingLic(false); }
  }, [licCategory]);

  useEffect(() => { fetchLicenses(); }, [fetchLicenses]);

  const licStats = useMemo(() => ({
    valid:    licenses.filter(l => computeStatus(l.expiry_date) === 'Valid').length,
    expiring: licenses.filter(l => computeStatus(l.expiry_date) === 'Expiring Soon').length,
    expired:  licenses.filter(l => computeStatus(l.expiry_date) === 'Expired').length,
  }), [licenses]);

  const filteredLicenses = useMemo(() => {
    const q = search.toLowerCase();
    let list = q ? licenses.filter(l =>
      l.name.toLowerCase().includes(q) ||
      l.license_number.toLowerCase().includes(q) ||
      (l.category||'').toLowerCase().includes(q)
    ) : [...licenses];
    if (licSortExpiry) list.sort((a,b) => (daysUntil(a.expiry_date) ?? 9999) - (daysUntil(b.expiry_date) ?? 9999));
    return list;
  }, [licenses, search, licSortExpiry]);

  const expiryAlerts = useMemo(() =>
    licenses.filter(l => { const d = daysUntil(l.expiry_date); return d !== null && d <= 30 && d >= 0; })
      .sort((a,b) => daysUntil(a.expiry_date)! - daysUntil(b.expiry_date)!),
  [licenses]);

  const openLicModal = async (lic: any = null) => {
    setEditingLic(lic); setPendingFile(null); setPendingPreview(null); setEditThumbUrl(null);
    if (lic?.file_path) { const u = await fetchBlobUrl(lic.id); setEditThumbUrl(u); }
    setLicForm(lic ? {
      name: lic.name, license_number: lic.license_number,
      expiry_date: lic.expiry_date||'', start_date: lic.start_date||'',
      category: lic.category||'Retail', status: lic.status||'Valid',
      notes: lic.notes||'', issued_by: lic.issued_by||''
    } : { name:'', license_number:'', expiry_date:'', start_date:'', category:'Retail', status:'Valid', notes:'', issued_by:'' });
    setShowLicModal(true);
  };

  const handleExpiryChange = (val: string) => {
    setLicForm(p => ({ ...p, expiry_date: val, status: val ? computeStatus(val) : 'Valid' }));
  };

  const applyPendingFile = (file: File) => {
    setPendingFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = e => setPendingPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else { setPendingPreview('pdf'); }
  };

  const saveLicense = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSavingLic(true);
    try {
      const method = editingLic ? 'PUT' : 'POST';
      const url = editingLic ? `${API}/licenses/${editingLic.id}` : `${API}/licenses`;
      const r = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(licForm) });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      if (!editingLic && pendingFile && d.data?.id) await handleUpload(d.data.id, pendingFile);
      showToast(editingLic ? 'License updated ✓' : 'License added ✓');
      setShowLicModal(false); setPendingFile(null); setPendingPreview(null);
      fetchLicenses(); fetchOverview();
    } catch (err: any) { showToast(err.message, 'err'); }
    finally { setIsSavingLic(false); }
  };

  const deleteLicense = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      const r = await fetch(`${API}/licenses/${id}`, { method: 'DELETE', headers: authHeaders() });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      showToast('Deleted ✓'); fetchLicenses(); fetchOverview();
    } catch (err: any) { showToast(err.message, 'err'); }
  };

  const handleUpload = async (licId: string, file: File) => {
    setUploadingId(licId);
    try {
      const fd = new FormData(); fd.append('certificate', file);
      const r = await fetch(`${API}/licenses/${licId}/upload`, { method:'POST', headers:{ Authorization:`Bearer ${getToken()}` }, body:fd });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      showToast('Certificate uploaded ✓'); fetchLicenses();
      if (viewingLic?.id === licId) { setViewingLic(d.data); viewCert(d.data); }
      if (editingLic?.id === licId) { setEditingLic(d.data); setEditThumbUrl(await fetchBlobUrl(licId)); }
    } catch (err: any) { showToast(err.message, 'err'); }
    finally { setUploadingId(null); }
  };

  const viewCert = async (lic: any) => {
    setViewingLic(lic); setShowCertViewer(true);
    if (lic.file_path) {
      setViewerBlobLoading(true); setViewerBlobUrl(null);
      setViewerBlobUrl(await fetchBlobUrl(lic.id));
      setViewerBlobLoading(false);
    }
  };

  const closeCertViewer = () => {
    setShowCertViewer(false);
    if (viewerBlobUrl) URL.revokeObjectURL(viewerBlobUrl);
    setViewerBlobUrl(null); setViewerBlobLoading(false);
  };

  const sendAlert = async (id: string) => {
    setAlertingId(id);
    try {
      const r = await fetch(`${API}/licenses/${id}/send-alert`, { method:'POST', headers:authHeaders() });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      const { email, whatsapp } = d.result;
      showToast(`Alert sent — Email: ${email||'—'} | WhatsApp: ${whatsapp||'—'}`);
    } catch (err: any) { showToast(err.message, 'err'); }
    finally { setAlertingId(null); }
  };

  const exportLicensesCSV = () => {
    const rows = [
      ['Name','License Number','Category','Status','Issue Date','Expiry Date','Issued By','Notes'],
      ...filteredLicenses.map(l => [l.name, l.license_number, l.category, computeStatus(l.expiry_date), 
      l.start_date ? new Date(l.start_date).toLocaleDateString('en-IN') : '', 
      l.expiry_date ? new Date(l.expiry_date).toLocaleDateString('en-IN') : 'Perpetual', 
      l.issued_by||'', l.notes||'']),
    ];
    exportCSV(rows, `licenses_${new Date().toISOString().slice(0,10)}.csv`);
  };

  // ── H1 Register ───────────────────────────────────────────────────────────
  const [h1Records, setH1Records]   = useState<any[]>([]);
  const [h1Loading, setH1Loading]   = useState(false);
  const [showH1Modal, setShowH1Modal] = useState(false);
  const [h1DateFrom, setH1DateFrom] = useState('');
  const [h1DateTo, setH1DateTo]     = useState('');
  const [h1Form, setH1Form] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    patient_name:'', doctor_name:'', drug_name:'', batch_number:'', quantity:'', invoice_no:''
  });

  const fetchH1 = useCallback(async () => {
    setH1Loading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('drug', search);
      if (h1DateFrom) params.set('from', h1DateFrom);
      if (h1DateTo)   params.set('to',   h1DateTo);
      const r = await fetch(`${API}/h1?${params}`, { headers: authHeaders() });
      const d = await r.json();
      if (d.success) setH1Records(d.data);
    } catch {}
    finally { setH1Loading(false); }
  }, [search, h1DateFrom, h1DateTo]);

  useEffect(() => { if (tab === 'H1') fetchH1(); }, [tab, fetchH1]);

  const saveH1 = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await fetch(`${API}/h1`, { method:'POST', headers:authHeaders(), body:JSON.stringify(h1Form) });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      setH1Records(p => [d.data, ...p]); showToast('Entry added ✓'); setShowH1Modal(false);
      setH1Form({ entry_date:new Date().toISOString().split('T')[0], patient_name:'', doctor_name:'', drug_name:'', batch_number:'', quantity:'', invoice_no:'' });
      fetchOverview();
    } catch (err: any) { showToast(err.message, 'err'); }
  };

  const deleteH1 = async (id: any) => {
    if (!confirm('Delete this H1 entry?')) return;
    try {
      const r = await fetch(`${API}/h1/${id}`, { method:'DELETE', headers:authHeaders() });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      setH1Records(p => p.filter(x => x.id !== id)); showToast('Deleted ✓');
    } catch (err: any) { showToast(err.message, 'err'); }
  };

  const exportH1CSV = () => {
    exportCSV([
      ['Date','Drug Name','Batch','Qty','Patient','Doctor','Invoice'],
      ...h1Records.map(r => [r.entry_date, r.drug_name, r.batch_number||'', r.quantity, r.patient_name, r.doctor_name||'', r.invoice_no||'']),
    ], `h1_register_${new Date().toISOString().slice(0,10)}.csv`);
  };

  const h1Stats = useMemo(() => ({
    totalQty: h1Records.reduce((s,r) => s + (parseInt(r.quantity)||0), 0),
    uniqueDrugs: new Set(h1Records.map(r => r.drug_name)).size,
  }), [h1Records]);

  // ── Temperature Logs ──────────────────────────────────────────────────────
  const [tempLogs, setTempLogs]         = useState<any[]>([]);
  const [tempEquipment, setTempEquipment] = useState<string[]>([]);
  const [activeEquipment, setActiveEquipment] = useState('All');
  const [showTempModal, setShowTempModal] = useState(false);
  const [tempForm, setTempForm] = useState({ temperature:'', checked_by:'', equipment_name:'Refrigerator 1', remarks:'' });

  const fetchTemp = useCallback(async () => {
    try {
      const [tr, er] = await Promise.all([
        fetch(`${API}/temp-logs?equipment=${encodeURIComponent(activeEquipment)}`, { headers: authHeaders() }).then(r=>r.json()),
        fetch(`${API}/temp-equipment`, { headers: authHeaders() }).then(r=>r.json()),
      ]);
      if (tr.success) setTempLogs(tr.data);
      if (er.success) setTempEquipment(er.data);
    } catch {}
  }, [activeEquipment]);

  useEffect(() => { if (tab === 'TEMP') fetchTemp(); }, [tab, fetchTemp]);

  const saveTemp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await fetch(`${API}/temp-logs`, { method:'POST', headers:authHeaders(), body:JSON.stringify(tempForm) });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      setTempLogs(p => [d.data, ...p]); showToast('Temperature logged ✓'); setShowTempModal(false);
      setTempForm({ temperature:'', checked_by:'', equipment_name:activeEquipment==='All'?'Refrigerator 1':activeEquipment, remarks:'' });
      fetchOverview();
    } catch (err: any) { showToast(err.message, 'err'); }
  };

  const tempStats = useMemo(() => {
    if (!tempLogs.length) return { min: null, max: null, avg: null, breaches: 0 };
    const vals = tempLogs.slice(0, 50).map(l => parseFloat(l.temperature)).filter(v => !isNaN(v));
    return {
      min: Math.min(...vals).toFixed(1),
      max: Math.max(...vals).toFixed(1),
      avg: (vals.reduce((s,v)=>s+v,0)/vals.length).toFixed(1),
      breaches: tempLogs.filter(l => l.status === 'Warning').length,
    };
  }, [tempLogs]);

  const tempChartData = useMemo(() =>
    [...tempLogs].slice(0,30).reverse().map((l, i) => ({
      name: `${l.log_date?.slice(5)||''} ${l.log_time?.slice(0,5)||''}`.trim() || `#${i+1}`,
      temp: parseFloat(l.temperature),
      min: 2, max: 8,
    })),
  [tempLogs]);

  const exportTempCSV = () => {
    exportCSV([
      ['Date','Time','Equipment','Temperature (°C)','Checked By','Status','Remarks'],
      ...tempLogs.map(l => [l.log_date, l.log_time||'', l.equipment_name||'', l.temperature, l.checked_by||'', l.status, l.remarks||'']),
    ], `temp_logs_${new Date().toISOString().slice(0,10)}.csv`);
  };

  // ── Audit Checklist (now DB-backed) ───────────────────────────────────────
  const [checklist, setChecklist] = useState<{id:number;text:string;checked:boolean}[]>(() =>
    DEFAULT_CHECKLIST.map((text, i) => ({ id: i+1, text, checked: false }))
  );
  const [newItem, setNewItem]         = useState('');
  const [auditorName, setAuditorName] = useState('');
  const [auditNotes, setAuditNotes]   = useState('');
  const [savingAudit, setSavingAudit] = useState(false);
  const [auditHistory, setAuditHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchAuditHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const r = await fetch(`${API}/audits`, { headers: authHeaders() });
      const d = await r.json();
      if (d.success) setAuditHistory(d.data);
    } catch {}
    finally { setLoadingHistory(false); }
  }, []);

  useEffect(() => { if (tab === 'AUDIT') fetchAuditHistory(); }, [tab, fetchAuditHistory]);

  const toggleCheck = (id: number) => setChecklist(p => p.map(i => i.id===id ? {...i, checked:!i.checked} : i));
  const addItem = () => {
    if (!newItem.trim()) return;
    setChecklist(p => [...p, { id: Date.now(), text: newItem.trim(), checked: false }]);
    setNewItem('');
  };
  const removeItem = (id: number) => setChecklist(p => p.filter(i => i.id !== id));

  const completionPct = checklist.length ? Math.round(checklist.filter(i=>i.checked).length/checklist.length*100) : 0;

  const submitAudit = async () => {
    setSavingAudit(true);
    try {
      const r = await fetch(`${API}/audits`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({
          audit_date: new Date().toISOString().slice(0,10),
          auditor_name: auditorName || 'Self',
          score_percentage: completionPct,
          status: completionPct === 100 ? 'Passed' : completionPct >= 75 ? 'Completed' : 'Needs Attention',
          notes: auditNotes,
        }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      showToast('Audit report saved ✓');
      setAuditHistory(p => [d.data, ...p]);
      setAuditorName(''); setAuditNotes('');
      fetchOverview();
    } catch (err: any) { showToast(err.message, 'err'); }
    finally { setSavingAudit(false); }
  };

  const deleteAudit = async (id: any) => {
    if (!confirm('Delete this audit record?')) return;
    try {
      const r = await fetch(`${API}/audits/${id}`, { method:'DELETE', headers:authHeaders() });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      setAuditHistory(p => p.filter(a => a.id !== id)); showToast('Deleted ✓');
    } catch (err: any) { showToast(err.message, 'err'); }
  };

  // ── Notification Settings ─────────────────────────────────────────────────
  const [notifSettings, setNotifSettings] = useState<any>({
    email_enabled:false, email_address:'', whatsapp_enabled:false,
    whatsapp_number:'', whatsapp_apikey:'',
    alert_days_30:true, alert_days_15:true, alert_days_7:true, alert_days_1:true,
  });
  const [savingNotif, setSavingNotif]       = useState(false);
  const [testingChannel, setTestingChannel] = useState<string|null>(null);
  const [notifLogs, setNotifLogs]           = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API}/notification-settings`, { headers: authHeaders() })
      .then(r=>r.json()).then(d=>{ if(d.success&&d.data) setNotifSettings((p:any)=>({...p,...d.data})); }).catch(()=>{});
    fetch(`${API}/notification-logs`, { headers: authHeaders() })
      .then(r=>r.json()).then(d=>{ if(d.success) setNotifLogs(d.data); }).catch(()=>{});
  }, []);

  const saveNotifSettings = async (e: React.FormEvent) => {
    e.preventDefault(); setSavingNotif(true);
    try {
      const r = await fetch(`${API}/notification-settings`, { method:'POST', headers:authHeaders(), body:JSON.stringify(notifSettings) });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      showToast('Notification settings saved ✓');
    } catch (err: any) { showToast(err.message, 'err'); }
    finally { setSavingNotif(false); }
  };

  const testNotification = async (channel: string) => {
    setTestingChannel(channel);
    try {
      await fetch(`${API}/notification-settings`, { method:'POST', headers:authHeaders(), body:JSON.stringify(notifSettings) });
      const r = await fetch(`${API}/notification-test`, { method:'POST', headers:authHeaders(), body:JSON.stringify({ channel }) });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      showToast(d.message || `Test ${channel} sent ✓`);
    } catch (err: any) { showToast(err.message, 'err'); }
    finally { setTestingChannel(null); }
  };

  // ── Tabs config ────────────────────────────────────────────────────────────
  const TABS: [Tab, string, React.ReactNode][] = [
    ['OVERVIEW', 'Overview',    <LayoutDashboard size={14}/>],
    ['LICENSES', 'Licenses',    <ShieldCheck size={14}/>],
    ['H1',       'H1 Register', <FileText size={14}/>],
    ['TEMP',     'Cold Chain',  <Thermometer size={14}/>],
    ['AUDIT',    'Inspections', <CheckSquare size={14}/>],
    ['SETTINGS', 'Alerts',      <Bell size={14}/>],
  ];

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-5 animate-fadeIn">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-5 py-3 rounded-xl shadow-xl text-white text-sm font-medium flex items-center gap-2 animate-fadeIn ${toast.type==='ok'?'bg-green-600':'bg-red-600'}`}>
          {toast.type==='ok'?<CheckCircle size={16}/>:<AlertCircle size={16}/>} {toast.msg}
        </div>
      )}

      {/* Expiry banner */}
      {tab==='LICENSES' && expiryAlerts.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-orange-500 flex-shrink-0 mt-0.5"/>
          <div className="flex-1">
            <p className="font-bold text-orange-800 text-sm">{expiryAlerts.length} license{expiryAlerts.length>1?'s':''} expiring within 30 days</p>
            <p className="text-orange-700 text-xs mt-0.5">{expiryAlerts.map(l=>`${l.name} (${daysUntil(l.expiry_date)}d)`).join(' · ')}</p>
          </div>
          <button onClick={()=>setTab('SETTINGS')} className="text-xs text-orange-700 font-bold underline whitespace-nowrap">Configure Alerts →</button>
        </div>
      )}

      {/* Header + Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Regulatory Compliance</h2>
          <p className="text-slate-500 text-sm">Drug Licenses · Schedule Registers · Cold Chain · Inspections</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-1 flex overflow-x-auto max-w-full gap-0.5">
          {TABS.map(([id,label,icon]) => (
            <button key={id} onClick={()=>{ setTab(id); setSearch(''); }}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 whitespace-nowrap ${tab===id?'bg-slate-800 text-white shadow-sm':'text-slate-600 hover:bg-slate-50'}`}>
              {icon}{label}
              {id==='LICENSES' && licStats.expired > 0 && (
                <span className="w-4 h-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">{licStats.expired}</span>
              )}
              {id==='SETTINGS' && (notifSettings.email_enabled||notifSettings.whatsapp_enabled) && (
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full"/>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Hidden file input */}
      <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
        onChange={e=>{ const f=e.target.files?.[0]; const id=fileRef.current?.dataset.licid;
          if(f&&id){ id==='__pending__'?applyPendingFile(f):handleUpload(id,f); } e.target.value=''; }}/>

      {/* ══ OVERVIEW ══════════════════════════════════════════════════════════ */}
      {tab==='OVERVIEW' && (
        <div className="space-y-5">
          {loadingOverview ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array(4).fill(0).map((_,i)=>(
              <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 animate-pulse h-24"/>
            ))}</div>
          ) : (
            <>
              {/* KPI row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Valid Licenses"   value={overviewStats?.licenses.valid ?? '—'}    color="green"  icon={<CheckCircle size={22}/>} sub={`of ${overviewStats?.licenses.total??0} total`}/>
                <KpiCard label="Expiring (30d)"   value={overviewStats?.licenses.expiring ?? '—'} color="orange" icon={<Clock size={22}/>}       sub="need renewal soon"/>
                <KpiCard label="Temp Breaches"    value={overviewStats?.temperature.breaches30d ?? '—'} color="blue" icon={<Thermometer size={22}/>} sub="last 30 days"/>
                <KpiCard label="H1 Entries"       value={overviewStats?.h1.totalMonth ?? '—'}     color="purple" icon={<FileText size={22}/>}    sub="last 30 days"/>
              </div>

              {/* Risk score + Last audit */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Risk score */}
                {riskData && (
                  <div className="lg:col-span-2 bg-slate-900 rounded-xl p-6 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-20 translate-x-20"/>
                    <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start">
                      <div className="flex-shrink-0 text-center bg-white/5 rounded-xl p-5 border border-white/10 w-36">
                        <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest mb-1">Risk Score</p>
                        <p className={`text-5xl font-black ${riskData.level==='Critical'?'text-red-400':riskData.level==='Medium'?'text-orange-400':'text-green-400'}`}>{riskData.score}</p>
                        <p className="text-white/40 text-xs font-bold">/100</p>
                        <span className={`mt-2 inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase ${riskData.level==='Critical'?'bg-red-500/20 text-red-300':riskData.level==='Medium'?'bg-orange-500/20 text-orange-300':'bg-green-500/20 text-green-300'}`}>{riskData.level}</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-white font-bold text-base mb-1 flex items-center gap-2"><ShieldCheck size={18} className="text-indigo-400"/> Compliance Risk Factors</h3>
                        <p className="text-slate-400 text-xs mb-4">Last analyzed: {new Date(riskData.lastAnalyzed).toLocaleTimeString('en-IN')}</p>
                        <div className="grid grid-cols-1 gap-2">
                          {riskData.factors.map((f: any, i: number) => (
                            <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm ${f.impact==='High'?'bg-red-500/10 border-red-500/20':'f.impact'==='Medium'?'bg-orange-500/10 border-orange-500/20':'bg-white/5 border-white/10'}`}>
                              <div className="flex items-center gap-2">
                                {f.impact==='High'?<AlertCircle size={13} className="text-red-400"/>:f.impact==='Medium'?<AlertTriangle size={13} className="text-orange-400"/>:<CheckCircle size={13} className="text-green-400"/>}
                                <span className="text-slate-200 font-medium">{f.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-slate-400 text-xs">{f.detail}</span>
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${f.impact==='High'?'bg-red-500/20 text-red-300':f.impact==='Medium'?'bg-orange-500/20 text-orange-300':'bg-green-500/20 text-green-300'}`}>{f.impact}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Last audit + upcoming renewals */}
                <div className="space-y-4">
                  {overviewStats?.lastAudit ? (
                    <div className="bg-white rounded-xl border border-slate-200 p-5">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5"><CheckSquare size={13}/> Last Audit</p>
                      <div className="flex items-center gap-4">
                        <div className="relative w-16 h-16 flex-shrink-0">
                          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="3"/>
                            <circle cx="18" cy="18" r="15.9" fill="none"
                              stroke={overviewStats.lastAudit.score>=80?'#22c55e':overviewStats.lastAudit.score>=60?'#f59e0b':'#ef4444'}
                              strokeWidth="3" strokeDasharray={`${overviewStats.lastAudit.score} ${100-overviewStats.lastAudit.score}`}/>
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-800">{overviewStats.lastAudit.score}%</span>
                        </div>
                        <div>
                          <p className={`font-bold text-lg ${overviewStats.lastAudit.score>=80?'text-green-600':overviewStats.lastAudit.score>=60?'text-amber-600':'text-red-600'}`}>
                            {overviewStats.lastAudit.score>=80?'Excellent':overviewStats.lastAudit.score>=60?'Good':'Needs Work'}
                          </p>
                          <p className="text-xs text-slate-400">{new Date(overviewStats.lastAudit.date).toLocaleDateString('en-IN')}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl border border-dashed border-slate-300 p-5 text-center">
                      <CheckSquare size={28} className="mx-auto text-slate-300 mb-2"/>
                      <p className="text-slate-500 text-sm font-medium">No audit on record</p>
                      <button onClick={()=>setTab('AUDIT')} className="mt-2 text-xs text-primary font-bold hover:underline">Run inspection →</button>
                    </div>
                  )}

                  {/* Upcoming renewals */}
                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5"><Calendar size={13}/> Upcoming Renewals</p>
                    {expiryAlerts.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-3">No renewals in 30 days ✓</p>
                    ) : (
                      <div className="space-y-2">
                        {expiryAlerts.slice(0,4).map(l => (
                          <div key={l.id} className="flex items-center justify-between text-sm">
                            <span className="text-slate-700 font-medium truncate max-w-[140px]">{l.name}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${daysUntil(l.expiry_date)!<=7?'bg-red-100 text-red-600':'bg-orange-100 text-orange-600'}`}>{daysUntil(l.expiry_date)}d</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick actions */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label:'Add License',       icon:<Plus size={16}/>,        onClick:()=>{ setTab('LICENSES'); openLicModal(); }, color:'bg-primary text-white' },
                  { label:'Log Temperature',   icon:<Thermometer size={16}/>, onClick:()=>{ setTab('TEMP'); setShowTempModal(true); }, color:'bg-blue-600 text-white' },
                  { label:'Add H1 Entry',      icon:<FileText size={16}/>,    onClick:()=>{ setTab('H1'); setShowH1Modal(true); }, color:'bg-slate-800 text-white' },
                  { label:'Run Inspection',    icon:<CheckSquare size={16}/>, onClick:()=>setTab('AUDIT'), color:'bg-emerald-600 text-white' },
                ].map(a => (
                  <button key={a.label} onClick={a.onClick} className={`${a.color} px-4 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-sm`}>
                    {a.icon}{a.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ LICENSES ══════════════════════════════════════════════════════════ */}
      {tab==='LICENSES' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <KpiCard label="Valid"         value={licStats.valid}    color="green"  icon={<CheckCircle size={20}/>}/>
            <KpiCard label="Expiring Soon" value={licStats.expiring} color="orange" icon={<Clock size={20}/>}/>
            <KpiCard label="Expired"       value={licStats.expired}  color="red"    icon={<AlertCircle size={20}/>}/>
          </div>

          {/* Category filter pills */}
          <div className="flex flex-wrap gap-1.5">
            {LICENSE_CATEGORIES.map(cat => (
              <button key={cat} onClick={()=>setLicCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${licCategory===cat?'bg-slate-800 text-white border-slate-800':'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
                {cat}
              </button>
            ))}
          </div>

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
              <input type="text" placeholder="Search licenses..." value={search} onChange={e=>setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"/>
            </div>
            <div className="flex gap-2 w-full sm:w-auto flex-wrap">
              <button onClick={()=>setLicSortExpiry(p=>!p)}
                className={`flex-1 sm:flex-none px-3 py-2 rounded-lg text-sm font-medium border flex items-center justify-center gap-1.5 transition-all ${licSortExpiry?'bg-orange-50 border-orange-300 text-orange-700':'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                <Calendar size={14}/> By Expiry
              </button>
              <button onClick={exportLicensesCSV} className="flex-1 sm:flex-none px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1.5">
                <Download size={14}/> Export CSV
              </button>
              <button onClick={fetchLicenses} className="flex-1 sm:flex-none px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1.5">
                <RefreshCw size={14} className={loadingLic?'animate-spin':''}/> Refresh
              </button>
              <button onClick={()=>openLicModal()} className="flex-1 sm:flex-none bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sky-600 flex items-center justify-center gap-1.5">
                <Plus size={15}/> Add License
              </button>
            </div>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {loadingLic ? Array(3).fill(0).map((_,i)=>(
              <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 animate-pulse h-52">
                <div className="flex justify-between mb-4"><div className="w-10 h-10 bg-slate-100 rounded-lg"/><div className="w-16 h-6 bg-slate-100 rounded"/></div>
                <div className="h-4 bg-slate-100 rounded w-3/4 mb-2"/><div className="h-3 bg-slate-100 rounded w-1/2 mb-4"/>
                <div className="h-9 bg-slate-100 rounded w-full mt-auto"/>
              </div>
            )) : filteredLicenses.length > 0 ? filteredLicenses.map(lic => {
              const uiStatus = computeStatus(lic.expiry_date);
              const days     = daysUntil(lic.expiry_date);
              return (
                <div key={lic.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                  <div className="absolute top-0 right-0 p-2 opacity-[0.06] group-hover:opacity-[0.12] transition-opacity pointer-events-none">
                    <ShieldCheck size={90} className="text-slate-800"/>
                  </div>
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-3">
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-100"><FileText size={22} className="text-primary"/></div>
                      <div className="flex items-center gap-1 flex-wrap justify-end">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${statusClass(uiStatus)}`}>{uiStatus}</span>
                        <button onClick={()=>viewCert(lic)} title="View Certificate" className="p-1 hover:bg-slate-100 rounded text-primary"><Eye size={14}/></button>
                        <button onClick={()=>{ if(fileRef.current){ fileRef.current.dataset.licid=lic.id; fileRef.current.click(); }}} title="Upload"
                          disabled={uploadingId===lic.id} className="p-1 hover:bg-blue-50 rounded text-blue-500">
                          {uploadingId===lic.id?<Loader2 size={14} className="animate-spin"/>:<Upload size={14}/>}
                        </button>
                        <button onClick={()=>sendAlert(lic.id)} disabled={alertingId===lic.id} title="Send Alert" className="p-1 hover:bg-orange-50 rounded text-orange-500">
                          {alertingId===lic.id?<Loader2 size={14} className="animate-spin"/>:<Send size={14}/>}
                        </button>
                        <button onClick={()=>openLicModal(lic)} title="Edit" className="p-1 hover:bg-slate-100 rounded text-slate-500"><Edit size={14}/></button>
                        <button onClick={()=>deleteLicense(lic.id, lic.name)} title="Delete" className="p-1 hover:bg-red-50 rounded text-red-400"><Trash2 size={14}/></button>
                      </div>
                    </div>
                    <h3 className="text-base font-bold text-slate-800 mb-0.5">{lic.name}</h3>
                    <p className="text-xs font-mono text-slate-500 mb-0.5">{lic.license_number}</p>
                    {lic.category && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold">{lic.category}</span>}
                    {lic.notes && <p className="text-xs text-slate-400 italic mt-1.5 line-clamp-1">{lic.notes}</p>}
                    <div className="flex items-center justify-between text-sm pt-3 mt-2 border-t border-slate-100">
                      <span className="text-slate-500 text-xs">Expires</span>
                      <div className="text-right">
                        <span className={`font-bold text-xs ${uiStatus==='Expiring Soon'?'text-orange-600':uiStatus==='Expired'?'text-red-600':'text-slate-700'}`}>
                          {lic.expiry_date ? new Date(lic.expiry_date).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : 'Perpetual'}
                        </span>
                        {days!==null && days>=0 && days<=60 && (
                          <p className={`text-[10px] font-bold ${days<=7?'text-red-500':days<=30?'text-orange-500':'text-yellow-600'}`}>{days} days left</p>
                        )}
                      </div>
                    </div>
                    <button onClick={()=>viewCert(lic)}
                      className={`w-full mt-3 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${lic.file_path?'bg-primary text-white hover:bg-sky-600':'bg-slate-50 text-slate-400 border border-slate-200 hover:bg-slate-100'}`}>
                      {lic.file_path?<><Eye size={13}/> View Certificate</>:<><ImageIcon size={13}/> No Certificate</>}
                    </button>
                  </div>
                </div>
              );
            }) : (
              <div className="col-span-full py-14 text-center bg-white rounded-xl border border-dashed border-slate-300">
                <Search size={28} className="mx-auto text-slate-300 mb-3"/>
                <p className="text-slate-500 font-medium">No licenses match your filters</p>
                <button onClick={()=>{ setSearch(''); setLicCategory('All'); }} className="mt-3 text-primary text-sm font-bold hover:underline">Clear filters</button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══ H1 REGISTER ═══════════════════════════════════════════════════════ */}
      {tab==='H1' && (
        <div className="space-y-4">
          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-4">
            <KpiCard label="Entries Shown"   value={h1Records.length}    color="slate"  icon={<FileText size={20}/>}/>
            <KpiCard label="Total Qty Dispensed" value={h1Stats.totalQty} color="red"   icon={<Activity size={20}/>}/>
            <KpiCard label="Unique Drugs"   value={h1Stats.uniqueDrugs}   color="purple" icon={<Filter size={20}/>}/>
          </div>

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
              <input type="text" placeholder="Search drug, patient, invoice…" value={search} onChange={e=>setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"/>
            </div>
            <input type="date" value={h1DateFrom} onChange={e=>setH1DateFrom(e.target.value)} title="From"
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-primary"/>
            <input type="date" value={h1DateTo} onChange={e=>setH1DateTo(e.target.value)} title="To"
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-primary"/>
            <button onClick={fetchH1} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-1.5">
              <RefreshCw size={14} className={h1Loading?'animate-spin':''}/> Apply
            </button>
            <button onClick={()=>setShowH1Modal(true)} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sky-600 flex items-center gap-1.5 whitespace-nowrap">
              <Plus size={15}/> Add Entry
            </button>
            <button onClick={exportH1CSV} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm flex items-center gap-1.5 hover:bg-slate-50 whitespace-nowrap">
              <Download size={15}/> Export CSV
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-slate-50 flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-500"/>
              <h3 className="font-bold text-slate-800">Schedule H1 Drug Register</h3>
              <span className="ml-auto text-xs text-slate-400">{h1Records.length} records</span>
            </div>
            {h1Loading ? (
              <div className="p-8 text-center"><Loader2 size={24} className="animate-spin text-primary mx-auto"/></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
                    <tr>{['Date','Drug Name','Batch','Qty','Patient','Doctor','Invoice',''].map(h=><th key={h} className="p-3">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {h1Records.length === 0 ? (
                      <tr><td colSpan={8} className="p-8 text-center text-slate-400 text-sm">No records found</td></tr>
                    ) : h1Records.map(r=>(
                      <tr key={r.id} className="hover:bg-slate-50 group">
                        <td className="p-3 text-sm text-slate-500">{r.entry_date}</td>
                        <td className="p-3 text-sm font-bold text-red-700">{r.drug_name}</td>
                        <td className="p-3 text-xs font-mono text-slate-400">{r.batch_number||'—'}</td>
                        <td className="p-3 text-sm font-bold">{r.quantity}</td>
                        <td className="p-3 text-sm">{r.patient_name}</td>
                        <td className="p-3 text-sm text-slate-500">{r.doctor_name||'—'}</td>
                        <td className="p-3 text-sm text-blue-600">{r.invoice_no||'—'}</td>
                        <td className="p-3">
                          <button onClick={()=>deleteH1(r.id)} className="text-slate-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 size={14}/>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ COLD CHAIN ════════════════════════════════════════════════════════ */}
      {tab==='TEMP' && (
        <div className="space-y-5">
          {/* Equipment tabs */}
          <div className="flex gap-2 flex-wrap">
            {['All', ...tempEquipment].filter((v,i,a)=>a.indexOf(v)===i).map(eq=>(
              <button key={eq} onClick={()=>setActiveEquipment(eq)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all flex items-center gap-1.5 ${activeEquipment===eq?'bg-slate-800 text-white border-slate-800':'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                <Thermometer size={13}/> {eq}
              </button>
            ))}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Current" value={tempLogs[0]?.temperature ? `${parseFloat(tempLogs[0].temperature).toFixed(1)}°C` : '—'} color={tempLogs[0]?.status==='Warning'?'red':'green'} icon={<Thermometer size={20}/>} sub={tempLogs[0]?.equipment_name}/>
            <KpiCard label="Min (last 50)" value={tempStats.min ? `${tempStats.min}°C` : '—'} color="blue"   icon={<TrendingUp size={20}/>}/>
            <KpiCard label="Max (last 50)" value={tempStats.max ? `${tempStats.max}°C` : '—'} color="orange" icon={<TrendingUp size={20}/>}/>
            <KpiCard label="Breaches Shown" value={tempStats.breaches} color="red" icon={<AlertTriangle size={20}/>} sub="in filtered view"/>
          </div>

          {/* Chart + table */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* Chart */}
            <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><Activity size={16} className="text-blue-500"/> Temperature Trend</h3>
                <div className="flex gap-2">
                  <button onClick={exportTempCSV} className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-xs flex items-center gap-1 hover:bg-slate-100">
                    <Download size={12}/> CSV
                  </button>
                  <button onClick={fetchTemp} className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-xs flex items-center gap-1 hover:bg-slate-100">
                    <RefreshCw size={12}/>
                  </button>
                </div>
              </div>
              {tempChartData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={tempChartData} margin={{ top:5, right:10, left:-20, bottom:5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                    <XAxis dataKey="name" tick={{ fontSize:10 }} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
                    <YAxis tick={{ fontSize:10 }} domain={[0, 12]} tickLine={false} axisLine={false}/>
                    <Tooltip formatter={(v: any) => [`${v}°C`, 'Temperature']} labelStyle={{ fontSize:11 }} contentStyle={{ fontSize:11, borderRadius:8 }}/>
                    {/* Ideal zone shading */}
                    <Area type="monotone" dataKey="max" stroke="none" fill="#dcfce7" fillOpacity={0.5} name="Max OK"/>
                    <Area type="monotone" dataKey="min" stroke="none" fill="#fff" fillOpacity={1} name="Min OK"/>
                    <Area type="monotone" dataKey="temp" stroke="#3b82f6" fill="#dbeafe" fillOpacity={0.7} strokeWidth={2} dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      const isBreech = payload.temp < 2 || payload.temp > 8;
                      return <circle key={cx} cx={cx} cy={cy} r={4} fill={isBreech?'#ef4444':'#3b82f6'} stroke="white" strokeWidth={1}/>;
                    }} activeDot={{ r:5 }} name="Temperature"/>
                  </AreaChart>
                </ResponsiveContainer>
              )}
              <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><span className="w-3 h-1 bg-green-200 rounded inline-block"/> Ideal zone (2–8°C)</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-400 rounded-full inline-block"/> Breach</span>
              </div>
            </div>

            {/* Log table */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 text-sm">Temperature Log</h3>
                <button onClick={()=>setShowTempModal(true)} className="bg-slate-900 text-white text-xs px-3 py-1.5 rounded-lg font-bold hover:bg-slate-700 flex items-center gap-1">
                  <Plus size={12}/> Log Now
                </button>
              </div>
              <div className="max-h-[280px] overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase sticky top-0">
                    <tr><th className="p-2.5">Date/Time</th><th className="p-2.5">°C</th><th className="p-2.5">By</th><th className="p-2.5">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tempLogs.length === 0 ? (
                      <tr><td colSpan={4} className="p-6 text-center text-slate-400 text-sm">No logs yet</td></tr>
                    ) : tempLogs.map(l=>(
                      <tr key={l.id} className="hover:bg-slate-50">
                        <td className="p-2.5 text-xs text-slate-500">{l.log_date}<br/><span className="text-slate-400">{l.log_time?.slice(0,5)||''}</span></td>
                        <td className={`p-2.5 text-sm font-bold ${l.status==='Warning'?'text-red-600':'text-slate-800'}`}>{parseFloat(l.temperature).toFixed(1)}</td>
                        <td className="p-2.5 text-xs text-slate-500 truncate max-w-[60px]">{l.checked_by||'—'}</td>
                        <td className="p-2.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${l.status==='OK'?'bg-green-100 text-green-700 border-green-200':'bg-red-100 text-red-700 border-red-200'}`}>{l.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ INSPECTIONS ═══════════════════════════════════════════════════════ */}
      {tab==='AUDIT' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Checklist */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><CheckSquare size={18} className="text-primary"/> Daily Self-Inspection</h3>
                <p className="text-slate-500 text-sm">{new Date().toLocaleDateString('en-IN',{dateStyle:'full'})}</p>
              </div>
              {/* Circular progress */}
              <div className="relative w-16 h-16 flex-shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="3.5"/>
                  <circle cx="18" cy="18" r="15.9" fill="none"
                    stroke={completionPct===100?'#22c55e':completionPct>=75?'#f59e0b':'#3b82f6'}
                    strokeWidth="3.5" strokeDasharray={`${completionPct} ${100-completionPct}`} strokeLinecap="round"/>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-sm font-black text-slate-800 leading-none">{completionPct}%</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-5">
              {checklist.map(item=>(
                <div key={item.id} className="flex items-start gap-3 p-3 border border-slate-100 rounded-lg hover:bg-slate-50 group cursor-pointer" onClick={()=>toggleCheck(item.id)}>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${item.checked?'bg-primary border-primary':'border-slate-300'}`}>
                    {item.checked && <CheckCircle size={12} className="text-white"/>}
                  </div>
                  <span className={`text-sm flex-1 leading-snug select-none ${item.checked?'text-slate-400 line-through':'text-slate-700'}`}>{item.text}</span>
                  <button onClick={e=>{e.stopPropagation();removeItem(item.id);}} className="text-slate-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <Trash2 size={13}/>
                  </button>
                </div>
              ))}
            </div>

            {/* Add item */}
            <div className="flex gap-2 mb-5 pt-3 border-t border-slate-100">
              <input type="text" value={newItem} onChange={e=>setNewItem(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addItem()}
                placeholder="Add new inspection point…" className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"/>
              <button onClick={addItem} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 font-bold"><Plus size={16}/></button>
            </div>

            {/* Submit report */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-200">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Submit Inspection Report</p>
              <input type="text" value={auditorName} onChange={e=>setAuditorName(e.target.value)}
                placeholder="Auditor name (or leave blank for Self)"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary bg-white"/>
              <textarea rows={2} value={auditNotes} onChange={e=>setAuditNotes(e.target.value)}
                placeholder="Observations, corrective actions taken…"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary resize-none bg-white"/>
              <button onClick={submitAudit} disabled={savingAudit}
                className="w-full py-2.5 bg-primary text-white font-bold rounded-lg hover:bg-sky-600 flex items-center justify-center gap-2 disabled:opacity-60">
                {savingAudit?<Loader2 size={15} className="animate-spin"/>:<CheckCircle size={15}/>}
                Save Report ({completionPct}% Complete)
              </button>
            </div>
          </div>

          {/* Audit history */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-slate-50 flex items-center gap-2">
              <TrendingUp size={16} className="text-slate-500"/>
              <h3 className="font-bold text-slate-800 text-sm">Audit History</h3>
              <span className="ml-auto text-xs text-slate-400">{auditHistory.length} records</span>
            </div>
            {loadingHistory ? (
              <div className="p-8 text-center"><Loader2 size={22} className="animate-spin text-primary mx-auto"/></div>
            ) : auditHistory.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">No audits saved yet</div>
            ) : (
              <div className="max-h-[520px] overflow-y-auto divide-y divide-slate-100">
                {auditHistory.map(a => (
                  <div key={a.id} className="p-4 flex items-start gap-3 group hover:bg-slate-50">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 ${parseFloat(a.score_percentage)>=80?'bg-green-100 text-green-700':parseFloat(a.score_percentage)>=60?'bg-amber-100 text-amber-700':'bg-red-100 text-red-600'}`}>
                      {parseFloat(a.score_percentage||0).toFixed(0)}%
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800">{a.status}</p>
                      <p className="text-xs text-slate-500">{new Date(a.audit_date).toLocaleDateString('en-IN',{dateStyle:'medium'})} · {a.auditor_name||'Self'}</p>
                      {a.notes && <p className="text-xs text-slate-400 mt-0.5 truncate">{a.notes}</p>}
                    </div>
                    <button onClick={()=>deleteAudit(a.id)} className="text-slate-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <Trash2 size={13}/>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ NOTIFICATION SETTINGS ═════════════════════════════════════════════ */}
      {tab==='SETTINGS' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <form onSubmit={saveNotifSettings} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><Settings2 size={18} className="text-primary"/> Alert Configuration</h3>

            {/* Email */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-slate-800"><span>📧</span> Email Alerts</div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={notifSettings.email_enabled} onChange={e=>setNotifSettings((p:any)=>({...p,email_enabled:e.target.checked}))} className="sr-only peer"/>
                  <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:bg-green-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:w-4 after:h-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-5"/>
                </label>
              </div>
              {notifSettings.email_enabled && (
                <div className="space-y-2">
                  <input type="email" value={notifSettings.email_address} onChange={e=>setNotifSettings((p:any)=>({...p,email_address:e.target.value}))}
                    placeholder="alerts@yourcompany.com" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"/>
                  <button type="button" onClick={()=>testNotification('email')} disabled={!notifSettings.email_address||testingChannel==='email'}
                    className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50">
                    {testingChannel==='email'?<Loader2 size={13} className="animate-spin"/>:<Send size={13}/>} Send Test Email
                  </button>
                </div>
              )}
            </div>

            {/* WhatsApp */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-slate-800"><span>💬</span> WhatsApp Alerts</div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={notifSettings.whatsapp_enabled} onChange={e=>setNotifSettings((p:any)=>({...p,whatsapp_enabled:e.target.checked}))} className="sr-only peer"/>
                  <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:bg-green-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:w-4 after:h-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-5"/>
                </label>
              </div>
              {notifSettings.whatsapp_enabled && (
                <div className="space-y-2">
                  <input type="tel" value={notifSettings.whatsapp_number} onChange={e=>setNotifSettings((p:any)=>({...p,whatsapp_number:e.target.value}))}
                    placeholder="+919876543210" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"/>
                  <input type="text" value={notifSettings.whatsapp_apikey} onChange={e=>setNotifSettings((p:any)=>({...p,whatsapp_apikey:e.target.value}))}
                    placeholder="CallMeBot API key" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"/>
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-2.5 text-xs text-blue-700">
                    <strong>Setup:</strong> Send "<code>I allow callmebot to send me messages</code>" to <strong>+34 644 51 82 23</strong> on WhatsApp.
                  </div>
                  <button type="button" onClick={()=>testNotification('whatsapp')} disabled={!notifSettings.whatsapp_number||!notifSettings.whatsapp_apikey||testingChannel==='whatsapp'}
                    className="w-full py-1.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50">
                    {testingChannel==='whatsapp'?<Loader2 size={13} className="animate-spin"/>:<Send size={13}/>} Send Test WhatsApp
                  </button>
                </div>
              )}
            </div>

            {/* Thresholds */}
            <div className="border border-slate-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-slate-700 mb-3">Send alert when license expires in:</p>
              <div className="grid grid-cols-2 gap-2">
                {([['alert_days_30','30 days before'],['alert_days_15','15 days before'],['alert_days_7','7 days before'],['alert_days_1','1 day before']] as [string,string][]).map(([key,label])=>(
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={notifSettings[key]} onChange={e=>setNotifSettings((p:any)=>({...p,[key]:e.target.checked}))} className="w-4 h-4 text-primary rounded border-slate-300"/>
                    <span className="text-sm text-slate-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button type="submit" disabled={savingNotif}
              className="w-full py-2.5 bg-primary text-white font-bold rounded-lg hover:bg-sky-600 flex items-center justify-center gap-2 disabled:opacity-60">
              {savingNotif?<Loader2 size={16} className="animate-spin"/>:<CheckCircle size={16}/>} Save Settings
            </button>
          </form>

          {/* Notification log */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-slate-50 flex items-center gap-2">
              <Bell size={16} className="text-slate-500"/>
              <h3 className="font-bold text-slate-800">Notification Log</h3>
              <span className="ml-auto text-xs text-slate-400">{notifLogs.length} sent</span>
            </div>
            {notifLogs.length===0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">No notifications sent yet</div>
            ) : (
              <div className="max-h-[480px] overflow-y-auto divide-y divide-slate-100">
                {notifLogs.map(l=>(
                  <div key={l.id} className="p-3 flex items-start gap-3">
                    <span className="text-lg">{l.channel==='email'?'📧':'💬'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{l.license_name||'License'}</p>
                      <p className="text-xs text-slate-400 truncate">{l.message}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${l.status==='sent'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{l.status}</span>
                      <p className="text-[10px] text-slate-400 mt-0.5">{new Date(l.sent_at).toLocaleDateString('en-IN')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ CERTIFICATE VIEWER ════════════════════════════════════════════════ */}
      {showCertViewer && viewingLic && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-slate-900 animate-fadeIn">
          <div className="bg-slate-900 text-white px-5 py-3 flex justify-between items-center border-b border-white/10 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                <ShieldCheck size={16} className="text-primary"/>
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm truncate">{viewingLic.name}</h3>
                <p className="text-xs text-slate-400">{viewingLic.license_number}{viewingLic.category?` · ${viewingLic.category}`:''}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <button onClick={()=>{ if(fileRef.current){ fileRef.current.dataset.licid=viewingLic.id; fileRef.current.click(); }}} disabled={uploadingId===viewingLic.id}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium disabled:opacity-50">
                {uploadingId===viewingLic.id?<Loader2 size={13} className="animate-spin"/>:<Upload size={13}/>} Upload
              </button>
              {viewerBlobUrl && (
                <a href={viewerBlobUrl} download={viewingLic.file_name||'certificate'}
                  className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg font-medium">
                  <Download size={13}/> Download
                </a>
              )}
              <button onClick={closeCertViewer} className="p-1.5 hover:bg-white/10 rounded-lg ml-1"><X size={20}/></button>
            </div>
          </div>
          <div className="flex-1 bg-slate-800 flex items-center justify-center overflow-hidden" style={{minHeight:0}}>
            {viewerBlobLoading ? (
              <div className="flex flex-col items-center gap-3"><Loader2 size={40} className="animate-spin text-primary"/><p className="text-sm text-slate-400">Loading…</p></div>
            ) : viewerBlobUrl ? (
              viewingLic.file_name?.toLowerCase().endsWith('.pdf')
                ? <iframe src={viewerBlobUrl} title="Certificate PDF" className="w-full h-full border-0"/>
                : <img src={viewerBlobUrl} alt={viewingLic.name} className="w-full h-full object-contain p-3"/>
            ) : (
              <div className="text-center p-10">
                <div className="w-20 h-20 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4"><FileText size={36} className="text-slate-400"/></div>
                <h4 className="text-lg font-bold text-slate-300">No Certificate Uploaded</h4>
                <p className="text-slate-500 text-sm mt-2 max-w-xs mx-auto">Upload a scanned copy or photo of this license.</p>
                <button onClick={()=>{ closeCertViewer(); if(fileRef.current){ fileRef.current.dataset.licid=viewingLic.id; fileRef.current.click(); }}}
                  className="mt-5 px-6 py-2.5 bg-primary text-white rounded-lg font-bold hover:bg-sky-600">Upload Certificate</button>
              </div>
            )}
          </div>
          <div className="px-5 py-2.5 bg-slate-900 border-t border-white/10 flex justify-between items-center flex-shrink-0">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-400">Status:</span>
              <span className={`font-bold text-xs px-2 py-0.5 rounded border ${statusClass(computeStatus(viewingLic.expiry_date))}`}>{computeStatus(viewingLic.expiry_date)}</span>
            </div>
            <div className="text-sm text-slate-400">
              Expires: <span className="font-semibold text-slate-200">{viewingLic.expiry_date?new Date(viewingLic.expiry_date).toLocaleDateString('en-IN',{dateStyle:'medium'}):'Perpetual'}</span>
            </div>
          </div>
        </div>
      )}

      {/* ══ ADD / EDIT LICENSE MODAL ══════════════════════════════════════════ */}
      {showLicModal && (() => {
        const expiryDays  = licForm.expiry_date ? daysUntil(licForm.expiry_date) : null;
        const expiryColor = expiryDays===null?'':expiryDays<0?'text-red-500':expiryDays<=7?'text-red-500':expiryDays<=30?'text-orange-500':'text-green-600';
        const expiryLabel = expiryDays===null?'':expiryDays<0?`Expired ${Math.abs(expiryDays)} days ago`:expiryDays===0?'Expires today!':`Expires in ${expiryDays} day${expiryDays===1?'':'s'}`;
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-fadeIn max-h-[95vh] overflow-y-auto">
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-5 py-4 flex justify-between items-center rounded-t-2xl sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center"><ShieldCheck size={18} className="text-primary"/></div>
                  <div>
                    <h3 className="font-bold text-base">{editingLic?'Edit License':'Add New License'}</h3>
                    <p className="text-xs text-slate-400">{editingLic?editingLic.license_number:'Fill in the details below'}</p>
                  </div>
                </div>
                <button onClick={()=>setShowLicModal(false)} className="p-1.5 hover:bg-white/10 rounded-lg"><X size={18}/></button>
              </div>
              {!editingLic && (
                <div className="px-5 pt-4 pb-0">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Quick Fill</p>
                  <div className="flex flex-wrap gap-1.5">
                    {LICENSE_TEMPLATES.map(t=>(
                      <button key={t.label} type="button" onClick={()=>setLicForm(p=>({...p,name:t.name,category:t.category,issued_by:t.issued_by}))}
                        className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-primary hover:text-white text-slate-600 text-xs font-semibold transition-all border border-slate-200 hover:border-primary">
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2">
                {/* Certificate drop zone */}
                <div className="p-5 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col gap-3">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5"><FileText size={12}/> Certificate Document</p>
                  <div ref={dropRef}
                    onDragOver={e=>{e.preventDefault();setDragOverDrop(true);}} onDragLeave={()=>setDragOverDrop(false)}
                    onDrop={e=>{e.preventDefault();setDragOverDrop(false);const f=e.dataTransfer.files[0];if(f){editingLic?handleUpload(editingLic.id,f):applyPendingFile(f);}}}
                    onClick={()=>{if(fileRef.current){fileRef.current.dataset.licid=editingLic?.id||'__pending__';fileRef.current.click();}}}
                    className={`relative cursor-pointer rounded-xl border-2 border-dashed overflow-hidden flex items-center justify-center transition-all ${dragOverDrop?'border-primary bg-blue-50':'border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300'}`}
                    style={{minHeight:200}}>
                    {editingLic&&editingLic.file_path&&!uploadingId&&(
                      editingLic.file_name?.toLowerCase().endsWith('.pdf')
                        ?<div className="flex flex-col items-center gap-2 p-4 text-center"><FileText size={44} className="text-red-400"/><p className="text-xs font-semibold text-slate-600 truncate max-w-[160px]">{editingLic.file_name}</p><p className="text-[11px] text-slate-400">PDF · click to replace</p></div>
                        :editThumbUrl
                          ?<div className="w-full h-full p-1"><img src={editThumbUrl} alt="cert" className="w-full h-48 object-contain rounded-lg"/><p className="text-[11px] text-slate-400 text-center mt-1">Click to replace</p></div>
                          :<div className="flex flex-col items-center gap-2 py-8 text-slate-400"><Loader2 size={24} className="animate-spin text-primary"/><p className="text-[11px]">Loading…</p></div>
                    )}
                    {!editingLic&&pendingPreview&&!uploadingId&&(
                      pendingPreview==='pdf'
                        ?<div className="flex flex-col items-center gap-2 p-4 text-center"><FileText size={44} className="text-red-400"/><p className="text-xs font-semibold text-slate-600 truncate max-w-[160px]">{pendingFile?.name}</p><p className="text-[11px] text-slate-400">click to change</p></div>
                        :<div className="w-full h-full p-1"><img src={pendingPreview} alt="preview" className="w-full h-48 object-contain rounded-lg"/><p className="text-[11px] text-slate-400 text-center mt-1">Click to change</p></div>
                    )}
                    {uploadingId&&<div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center gap-2"><Loader2 size={30} className="animate-spin text-primary"/><p className="text-xs text-slate-500 font-medium">Uploading…</p></div>}
                    {((editingLic&&!editingLic.file_path)||(!editingLic&&!pendingPreview))&&!uploadingId&&(
                      <div className="flex flex-col items-center gap-2 p-6 text-center pointer-events-none">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${dragOverDrop?'bg-primary/10':'bg-slate-200'}`}>
                          <Upload size={26} className={dragOverDrop?'text-primary':'text-slate-400'}/>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-600">{dragOverDrop?'Drop to upload':'Upload Certificate'}</p>
                          <p className="text-xs text-slate-400 mt-0.5">Drag & drop or click to browse</p>
                          <p className="text-[11px] text-slate-300 mt-0.5">JPG · PNG · PDF · max 10 MB</p>
                        </div>
                      </div>
                    )}
                  </div>
                  {editingLic&&editingLic.file_path&&(
                    <button type="button" onClick={()=>{setShowLicModal(false);viewCert(editingLic);}}
                      className="flex items-center justify-center gap-1.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold">
                      <Eye size={13}/> View Full Screen
                    </button>
                  )}
                  {!editingLic&&pendingFile&&(
                    <button type="button" onClick={()=>{setPendingFile(null);setPendingPreview(null);}}
                      className="flex items-center justify-center gap-1.5 py-1.5 text-red-400 hover:text-red-600 text-xs font-medium">
                      <X size={12}/> Remove file
                    </button>
                  )}
                </div>

                {/* Form */}
                <form onSubmit={saveLicense} className="p-5 space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">License Name *</label>
                    <input required type="text" placeholder="e.g. Drug License (20B)"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-slate-50 focus:bg-white transition"
                      value={licForm.name} onChange={e=>setLicForm({...licForm,name:e.target.value})}/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">License Number *</label>
                    <input required type="text" placeholder="e.g. MH-PUN-2024001"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-slate-50 focus:bg-white transition font-mono"
                      value={licForm.license_number} onChange={e=>setLicForm({...licForm,license_number:e.target.value})}/>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Issue Date</label>
                      <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary bg-slate-50 focus:bg-white transition"
                        value={licForm.start_date} onChange={e=>setLicForm({...licForm,start_date:e.target.value})}/>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Expiry Date</label>
                      <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary bg-slate-50 focus:bg-white transition"
                        value={licForm.expiry_date} onChange={e=>handleExpiryChange(e.target.value)}/>
                    </div>
                  </div>
                  {expiryLabel && (
                    <div className={`flex items-center gap-1.5 text-xs font-semibold ${expiryColor}`}><Clock size={12}/> {expiryLabel}</div>
                  )}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Status</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(['Valid','Expiring Soon','Expired','Suspended'] as string[]).map(s=>(
                        <button key={s} type="button" onClick={()=>setLicForm(p=>({...p,status:s}))}
                          className={`py-1.5 rounded-lg text-[11px] font-bold border transition-all ${licForm.status===s?statusClass(s)+' shadow-sm':'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Category</label>
                    <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary bg-slate-50 focus:bg-white transition"
                      value={licForm.category} onChange={e=>setLicForm({...licForm,category:e.target.value})}>
                      {LICENSE_CATEGORIES.filter(c=>c!=='All').map(c=><option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Issued By</label>
                    <input type="text" placeholder="e.g. Drug Control Department"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary bg-slate-50 focus:bg-white transition"
                      value={licForm.issued_by} onChange={e=>setLicForm({...licForm,issued_by:e.target.value})}/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Notes</label>
                    <textarea rows={2} placeholder="Renewal conditions, contact, etc."
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary bg-slate-50 focus:bg-white transition resize-none"
                      value={licForm.notes} onChange={e=>setLicForm({...licForm,notes:e.target.value})}/>
                  </div>
                  <button type="submit" disabled={isSavingLic}
                    className="w-full bg-primary text-white py-2.5 rounded-xl font-bold hover:bg-sky-600 flex items-center justify-center gap-2 disabled:opacity-60 text-sm mt-1">
                    {isSavingLic?<><Loader2 size={15} className="animate-spin"/> Saving…</>:editingLic?<><CheckCircle size={15}/> Update License</>:<><Plus size={15}/> Add License</>}
                  </button>
                </form>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ H1 MODAL ══════════════════════════════════════════════════════════ */}
      {showH1Modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-fadeIn">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center rounded-t-xl">
              <h3 className="font-bold">Add H1 Register Entry</h3>
              <button onClick={()=>setShowH1Modal(false)}><X size={18}/></button>
            </div>
            <form onSubmit={saveH1} className="p-5 space-y-3">
              <div><label className="block text-xs font-semibold text-slate-600 mb-1 uppercase">Drug Name *</label>
                <input required type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" value={h1Form.drug_name} onChange={e=>setH1Form({...h1Form,drug_name:e.target.value})}/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-slate-600 mb-1 uppercase">Batch No</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" value={h1Form.batch_number} onChange={e=>setH1Form({...h1Form,batch_number:e.target.value})}/></div>
                <div><label className="block text-xs font-semibold text-slate-600 mb-1 uppercase">Quantity *</label>
                  <input required type="number" min="1" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" value={h1Form.quantity} onChange={e=>setH1Form({...h1Form,quantity:e.target.value})}/></div>
              </div>
              <div><label className="block text-xs font-semibold text-slate-600 mb-1 uppercase">Patient Name *</label>
                <input required type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" value={h1Form.patient_name} onChange={e=>setH1Form({...h1Form,patient_name:e.target.value})}/></div>
              <div><label className="block text-xs font-semibold text-slate-600 mb-1 uppercase">Doctor Name</label>
                <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" value={h1Form.doctor_name} onChange={e=>setH1Form({...h1Form,doctor_name:e.target.value})}/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-slate-600 mb-1 uppercase">Date</label>
                  <input type="date" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" value={h1Form.entry_date} onChange={e=>setH1Form({...h1Form,entry_date:e.target.value})}/></div>
                <div><label className="block text-xs font-semibold text-slate-600 mb-1 uppercase">Invoice No</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" value={h1Form.invoice_no} onChange={e=>setH1Form({...h1Form,invoice_no:e.target.value})}/></div>
              </div>
              <button type="submit" className="w-full bg-primary text-white py-2.5 rounded-lg font-bold hover:bg-sky-600">Save Entry</button>
            </form>
          </div>
        </div>
      )}

      {/* ══ TEMP LOG MODAL ════════════════════════════════════════════════════ */}
      {showTempModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm animate-fadeIn">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center rounded-t-xl">
              <h3 className="font-bold">Log Temperature</h3>
              <button onClick={()=>setShowTempModal(false)}><X size={18}/></button>
            </div>
            <form onSubmit={saveTemp} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase">Temperature (°C) *</label>
                <input required autoFocus type="number" step="0.1"
                  className={`w-full border-2 rounded-lg px-3 py-2 text-2xl font-black outline-none text-center transition-colors ${
                    tempForm.temperature && (parseFloat(tempForm.temperature)<2||parseFloat(tempForm.temperature)>8)
                      ?'border-red-400 bg-red-50 text-red-700'
                      :tempForm.temperature?'border-green-400 bg-green-50 text-green-700':'border-slate-300'
                  }`}
                  value={tempForm.temperature} onChange={e=>setTempForm({...tempForm,temperature:e.target.value})}/>
                {tempForm.temperature && (
                  <p className={`text-xs font-bold mt-1 text-center ${parseFloat(tempForm.temperature)<2||parseFloat(tempForm.temperature)>8?'text-red-500':'text-green-600'}`}>
                    {parseFloat(tempForm.temperature)<2||parseFloat(tempForm.temperature)>8?'⚠ Outside ideal range (2–8°C)':'✓ Within ideal range'}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase">Equipment</label>
                <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                  value={tempForm.equipment_name} onChange={e=>setTempForm({...tempForm,equipment_name:e.target.value})}>
                  {(tempEquipment.length?tempEquipment:['Refrigerator 1']).map(eq=><option key={eq}>{eq}</option>)}
                  <option value="__new__">+ Other…</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase">Checked By *</label>
                <input required type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                  value={tempForm.checked_by} onChange={e=>setTempForm({...tempForm,checked_by:e.target.value})}/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase">Remarks</label>
                <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                  value={tempForm.remarks} onChange={e=>setTempForm({...tempForm,remarks:e.target.value})}/>
              </div>
              <button type="submit" className="w-full bg-primary text-white py-2.5 rounded-lg font-bold hover:bg-sky-600">Save Log</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Compliance;
