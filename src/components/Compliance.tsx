
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShieldCheck, AlertTriangle, FileText, Thermometer, CheckSquare,
  Download, Search, AlertCircle, CheckCircle, Clock, Plus, Edit,
  Trash2, X, Eye, Upload, Bell, Send, Settings2, Loader2,
  RefreshCw, Image as ImageIcon
} from 'lucide-react';

// ── API base ────────────────────────────────────────────────────────────────
const API = '/api/compliance';
const getToken = () => localStorage.getItem('accessToken') || localStorage.getItem('token') || '';
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` });

// ── License quick-fill templates ────────────────────────────────────────────
const LICENSE_TEMPLATES = [
  { label:'20B',     name:'Drug License (20B)',       category:'Retail',         issued_by:'Drug Control Department' },
  { label:'21B',     name:'Drug License (21B)',       category:'Wholesale',      issued_by:'Drug Control Department' },
  { label:'FSSAI',   name:'FSSAI License',            category:'Food Safety',    issued_by:'Food Safety & Standards Authority' },
  { label:'GST',     name:'GST Registration',         category:'Tax',            issued_by:'Goods & Services Tax Network' },
  { label:'NDPS',    name:'Narcotic (NDPS) License',  category:'Controlled',     issued_by:'Narcotics Control Bureau' },
  { label:'Trade',   name:'Trade License',            category:'Municipal',      issued_by:'Municipal Corporation' },
  { label:'Import',  name:'Import License',           category:'Import/Export',  issued_by:'DGFT' },
  { label:'Mfg 28',  name:'Manufacturing License (28B)', category:'Manufacturing', issued_by:'Drug Control Department' },
];

const LICENSE_CATEGORIES = ['Retail','Wholesale','Food Safety','Tax','Controlled','Municipal','Import/Export','Manufacturing','Other'];

// ── Seed fallback ───────────────────────────────────────────────────────────
const SEED_LICENSES = [
  { id: '1', name: 'Drug License (20B)', license_number: 'MH-PUN-2023001', expiry_date: '2025-12-31', status: 'Valid',          category: 'Retail',     notes: '', file_path: null, file_name: null },
  { id: '2', name: 'Drug License (21B)', license_number: 'MH-PUN-2023002', expiry_date: '2025-12-31', status: 'Valid',          category: 'Retail',     notes: '', file_path: null, file_name: null },
  { id: '3', name: 'FSSAI License',      license_number: '11522000000123',  expiry_date: '2025-11-30', status: 'Expiring Soon', category: 'Food Safety', notes: '', file_path: null, file_name: null },
  { id: '4', name: 'GST Registration',   license_number: '27ABCDE1234F1Z5', expiry_date: null,         status: 'Valid',          category: 'Tax',         notes: '', file_path: null, file_name: null },
  { id: '5', name: 'Narcotic (NDPS)',    license_number: 'NDPS/2023/55',    expiry_date: '2025-06-15', status: 'Valid',          category: 'Controlled',  notes: '', file_path: null, file_name: null },
];

const SEED_H1 = [
  { id: 101, entry_date: '2023-10-26', invoice_no: 'INV-001', patient_name: 'John Doe',  doctor_name: 'Dr. Smith',   drug_name: 'MetaClav 625',    quantity: 10, batch_number: 'MC-202' },
  { id: 102, entry_date: '2023-10-26', invoice_no: 'INV-002', patient_name: 'Jane Roe',  doctor_name: 'Dr. Adams',   drug_name: 'Azithral 500',    quantity: 5,  batch_number: 'AZ-55'  },
  { id: 103, entry_date: '2023-10-25', invoice_no: 'INV-004', patient_name: 'Rahul K',   doctor_name: 'Dr. P.Kumar', drug_name: 'Alprazolam 0.5',  quantity: 30, batch_number: 'AL-99'  },
  { id: 104, entry_date: '2023-10-24', invoice_no: 'INV-008', patient_name: 'S. Mehta',  doctor_name: 'Dr. Smith',   drug_name: 'MetaClav 625',    quantity: 6,  batch_number: 'MC-201' },
];

const SEED_TEMPS = [
  { id: 1, log_date: '2023-10-26', log_time: '09:00 AM', temperature: '4.2', checked_by: 'Priya S',  status: 'OK'      },
  { id: 2, log_date: '2023-10-26', log_time: '02:00 PM', temperature: '5.1', checked_by: 'Rahul V',  status: 'OK'      },
  { id: 3, log_date: '2023-10-25', log_time: '09:00 AM', temperature: '3.8', checked_by: 'Priya S',  status: 'OK'      },
  { id: 4, log_date: '2023-10-25', log_time: '02:00 PM', temperature: '6.5', checked_by: 'Rahul V',  status: 'Warning' },
];

// ── Helpers ─────────────────────────────────────────────────────────────────
function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function computeStatus(expiry: string | null): string {
  if (!expiry) return 'Valid';
  const d = daysUntil(expiry)!;
  if (d < 0)  return 'Expired';
  if (d <= 30) return 'Expiring Soon';
  return 'Valid';
}

function statusClass(status: string) {
  if (status === 'Valid')          return 'bg-green-100 text-green-700 border-green-200';
  if (status === 'Expiring Soon')  return 'bg-orange-100 text-orange-700 border-orange-200';
  if (status === 'Expired')        return 'bg-red-100 text-red-700 border-red-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

// ═══════════════════════════════════════════════════════════════════════════
const Compliance: React.FC = () => {
  type Tab = 'LICENSES' | 'H1' | 'TEMP' | 'AUDIT' | 'SETTINGS';
  const [tab, setTab]           = useState<Tab>('LICENSES');
  const [search, setSearch]     = useState('');
  const [toast, setToast]       = useState<{ msg: string; type: 'ok'|'err' } | null>(null);
  const [riskData, setRiskData] = useState<any>(null);

  const showToast = (msg: string, type: 'ok'|'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Risk Score ────────────────────────────────────────────────────────────
  const fetchRiskScore = async () => {
    try {
      const r = await fetch(`${API}/risk-score`, { headers: headers() });
      const d = await r.json();
      if (d.success) setRiskData(d.data);
    } catch { console.error('Failed to fetch risk score'); }
  };

  useEffect(() => {
    fetchRiskScore();
  }, []);

  // ── Licenses ──────────────────────────────────────────────────────────────
  const [licenses, setLicenses]   = useState<any[]>([]);
  const [loadingLic, setLoadingLic] = useState(true);
  const [showLicModal, setShowLicModal]       = useState(false);
  const [showCertViewer, setShowCertViewer]   = useState(false);
  const [viewingLic, setViewingLic]           = useState<any>(null);
  const [editingLic, setEditingLic]           = useState<any>(null);
  const [uploadingId, setUploadingId]         = useState<string|null>(null);
  const [alertingId, setAlertingId]           = useState<string|null>(null);
  const fileRef    = useRef<HTMLInputElement>(null);
  const dropRef    = useRef<HTMLDivElement>(null);
  const [licForm, setLicForm] = useState({
    name:'', license_number:'', expiry_date:'', start_date:'',
    category:'Retail', status:'Valid', notes:'', issued_by:''
  });
  const [pendingFile, setPendingFile]       = useState<File|null>(null);
  const [pendingPreview, setPendingPreview] = useState<string|null>(null);
  const [dragOverDrop, setDragOverDrop]     = useState(false);
  const [isSavingLic, setIsSavingLic]       = useState(false);
  // Blob URLs for authenticated file display
  const [viewerBlobUrl, setViewerBlobUrl]   = useState<string|null>(null);
  const [viewerBlobLoading, setViewerBlobLoading] = useState(false);
  const [editThumbUrl, setEditThumbUrl]     = useState<string|null>(null);

  const fetchBlobUrl = async (licId: string): Promise<string|null> => {
    try {
      const r = await fetch(`${API}/licenses/${licId}/certificate`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (!r.ok) return null;
      const blob = await r.blob();
      return URL.createObjectURL(blob);
    } catch { return null; }
  };

  const fetchLicenses = async () => {
    setLoadingLic(true);
    try {
      const r = await fetch(`${API}/licenses`, { headers: headers() });
      const d = await r.json();
      setLicenses(d.success && d.data.length ? d.data : SEED_LICENSES);
    } catch { setLicenses(SEED_LICENSES); }
    finally { setLoadingLic(false); }
  };

  useEffect(() => { fetchLicenses(); }, []);

  const stats = useMemo(() => ({
    valid:    licenses.filter(l => computeStatus(l.expiry_date) === 'Valid').length,
    expiring: licenses.filter(l => computeStatus(l.expiry_date) === 'Expiring Soon').length,
    expired:  licenses.filter(l => computeStatus(l.expiry_date) === 'Expired').length,
  }), [licenses]);

  const filteredLicenses = useMemo(() => {
    const q = search.toLowerCase();
    return q ? licenses.filter(l =>
      l.name.toLowerCase().includes(q) ||
      l.license_number.toLowerCase().includes(q) ||
      (l.category||'').toLowerCase().includes(q)
    ) : licenses;
  }, [licenses, search]);

  const openLicModal = async (lic: any = null) => {
    setEditingLic(lic);
    setPendingFile(null);
    setPendingPreview(null);
    setEditThumbUrl(null);
    if (lic?.file_path) {
      const url = await fetchBlobUrl(lic.id);
      setEditThumbUrl(url);
    }
    setLicForm(lic ? {
      name: lic.name, license_number: lic.license_number,
      expiry_date: lic.expiry_date || '', start_date: lic.start_date || '',
      category: lic.category || 'Retail',
      status: lic.status || 'Valid', notes: lic.notes || '', issued_by: lic.issued_by || ''
    } : {
      name:'', license_number:'', expiry_date:'', start_date:'',
      category:'Retail', status:'Valid', notes:'', issued_by:''
    });
    setShowLicModal(true);
  };

  // Auto-compute status when expiry date changes
  const handleExpiryChange = (val: string) => {
    const autoStatus = val ? computeStatus(val) : 'Valid';
    setLicForm(p => ({ ...p, expiry_date: val, status: autoStatus }));
  };

  // Pending file helpers (drag & drop / file pick for Add mode)
  const applyPendingFile = (file: File) => {
    setPendingFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = e => setPendingPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPendingPreview('pdf');
    }
  };

  const saveLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingLic(true);
    try {
      const method = editingLic ? 'PUT' : 'POST';
      const url    = editingLic ? `${API}/licenses/${editingLic.id}` : `${API}/licenses`;
      const r = await fetch(url, { method, headers: headers(), body: JSON.stringify(licForm) });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      // Auto-upload pending certificate on new license creation
      if (!editingLic && pendingFile && d.data?.id) {
        await handleUpload(d.data.id, pendingFile);
      }
      showToast(editingLic ? 'License updated ✓' : 'License added ✓');
      setShowLicModal(false);
      setPendingFile(null); setPendingPreview(null);
      fetchLicenses();
    } catch (err: any) { showToast(err.message, 'err'); }
    finally { setIsSavingLic(false); }
  };

  const deleteLicense = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      const r = await fetch(`${API}/licenses/${id}`, { method: 'DELETE', headers: headers() });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      showToast('Deleted ✓');
      fetchLicenses();
    } catch (err: any) { showToast(err.message, 'err'); }
  };

  // ── Certificate upload ────────────────────────────────────────────────────
  const handleUpload = async (licId: string, file: File) => {
    setUploadingId(licId);
    try {
      const fd = new FormData();
      fd.append('certificate', file);
      const r = await fetch(`${API}/licenses/${licId}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      showToast('Certificate uploaded ✓');
      fetchLicenses();
      // Refresh viewer and edit modal if open
      if (viewingLic?.id === licId) { setViewingLic(d.data); viewCert(d.data); }
      if (editingLic?.id === licId) {
        setEditingLic(d.data);
        const thumb = await fetchBlobUrl(licId);
        setEditThumbUrl(thumb);
      }
    } catch (err: any) { showToast(err.message, 'err'); }
    finally { setUploadingId(null); }
  };

  const viewCert = async (lic: any) => {
    setViewingLic(lic);
    setShowCertViewer(true);
    if (lic.file_path) {
      setViewerBlobLoading(true);
      setViewerBlobUrl(null);
      const url = await fetchBlobUrl(lic.id);
      setViewerBlobUrl(url);
      setViewerBlobLoading(false);
    }
  };

  const closeCertViewer = () => {
    setShowCertViewer(false);
    if (viewerBlobUrl) URL.revokeObjectURL(viewerBlobUrl);
    setViewerBlobUrl(null);
    setViewerBlobLoading(false);
  };

  // ── Manual alert ─────────────────────────────────────────────────────────
  const sendAlert = async (id: string) => {
    setAlertingId(id);
    try {
      const r = await fetch(`${API}/licenses/${id}/send-alert`, { method: 'POST', headers: headers() });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      const { email, whatsapp } = d.result;
      showToast(`Alert sent — Email: ${email||'—'} | WhatsApp: ${whatsapp||'—'}`);
    } catch (err: any) { showToast(err.message, 'err'); }
    finally { setAlertingId(null); }
  };

  // ── H1 Register ──────────────────────────────────────────────────────────
  const [h1Records, setH1Records] = useState<any[]>(SEED_H1);
  const [showH1Modal, setShowH1Modal] = useState(false);
  const [h1Form, setH1Form] = useState({ entry_date: new Date().toISOString().split('T')[0], patient_name:'', doctor_name:'', drug_name:'', batch_number:'', quantity:'', invoice_no:'' });

  useEffect(() => {
    fetch(`${API}/h1`, { headers: headers() })
      .then(r => r.json())
      .then(d => { if (d.success && d.data.length) setH1Records(d.data); })
      .catch(() => {});
  }, []);

  const saveH1 = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await fetch(`${API}/h1`, { method: 'POST', headers: headers(), body: JSON.stringify(h1Form) });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      setH1Records(p => [d.data, ...p]);
      showToast('Entry added ✓');
      setShowH1Modal(false);
      setH1Form({ entry_date: new Date().toISOString().split('T')[0], patient_name:'', doctor_name:'', drug_name:'', batch_number:'', quantity:'', invoice_no:'' });
    } catch (err: any) { showToast(err.message, 'err'); }
  };

  const filteredH1 = useMemo(() => {
    const q = search.toLowerCase();
    return q ? h1Records.filter(r =>
      r.drug_name?.toLowerCase().includes(q) ||
      r.patient_name?.toLowerCase().includes(q) ||
      r.invoice_no?.toLowerCase().includes(q)
    ) : h1Records;
  }, [h1Records, search]);

  // ── Temperature Logs ─────────────────────────────────────────────────────
  const [tempLogs, setTempLogs]   = useState<any[]>(SEED_TEMPS);
  const [showTempModal, setShowTempModal] = useState(false);
  const [tempForm, setTempForm]   = useState({ temperature:'', checked_by:'', equipment_name:'Refrigerator 1', remarks:'' });

  useEffect(() => {
    fetch(`${API}/temp-logs`, { headers: headers() })
      .then(r => r.json())
      .then(d => { if (d.success && d.data.length) setTempLogs(d.data); })
      .catch(() => {});
  }, []);

  const saveTemp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await fetch(`${API}/temp-logs`, { method: 'POST', headers: headers(), body: JSON.stringify(tempForm) });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      setTempLogs(p => [d.data, ...p]);
      showToast('Temperature logged ✓');
      setShowTempModal(false);
      setTempForm({ temperature:'', checked_by:'', equipment_name:'Refrigerator 1', remarks:'' });
    } catch (err: any) { showToast(err.message, 'err'); }
  };

  // ── Audit Checklist (localStorage) ───────────────────────────────────────
  const [checklist, setChecklist] = useState<any[]>(() => {
    const s = localStorage.getItem('erp_audit_checklist');
    return s ? JSON.parse(s) : [
      { id:1, text:'Premises are clean, dry, and well-ventilated.',     checked:true  },
      { id:2, text:'Refrigerator temperature is within 2°C – 8°C.',     checked:true  },
      { id:3, text:'No expired medicines on display shelves.',           checked:true  },
      { id:4, text:'Schedule H1 Register updated for yesterday.',        checked:true  },
      { id:5, text:'Pharmacist Registration Certificate displayed.',     checked:true  },
      { id:6, text:'Fire Extinguisher is valid and accessible.',         checked:true  },
      { id:7, text:'Dustbins are covered and labeled.',                  checked:false },
      { id:8, text:'Pest control measures are in place.',               checked:false },
    ];
  });
  const [newItem, setNewItem] = useState('');

  const toggleCheck = (id: number) => {
    const u = checklist.map(i => i.id===id ? {...i, checked:!i.checked} : i);
    setChecklist(u); localStorage.setItem('erp_audit_checklist', JSON.stringify(u));
  };
  const addItem = () => {
    if (!newItem.trim()) return;
    const u = [...checklist, { id: Date.now(), text: newItem, checked: false }];
    setChecklist(u); localStorage.setItem('erp_audit_checklist', JSON.stringify(u));
    setNewItem('');
  };
  const removeItem = (id: number) => {
    const u = checklist.filter(i => i.id !== id);
    setChecklist(u); localStorage.setItem('erp_audit_checklist', JSON.stringify(u));
  };

  // ── Notification Settings ────────────────────────────────────────────────
  const [notifSettings, setNotifSettings] = useState<any>({
    email_enabled: true, email_address: '',
    whatsapp_enabled: false, whatsapp_number: '', whatsapp_apikey: '',
    alert_days_30: true, alert_days_15: true, alert_days_7: true, alert_days_1: true,
  });
  const [savingNotif, setSavingNotif]     = useState(false);
  const [testingChannel, setTestingChannel] = useState<string|null>(null);
  const [notifLogs, setNotifLogs]         = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API}/notification-settings`, { headers: headers() })
      .then(r => r.json())
      .then(d => { if (d.success && d.data) setNotifSettings((p: any) => ({...p, ...d.data})); })
      .catch(() => {});
    fetch(`${API}/notification-logs`, { headers: headers() })
      .then(r => r.json())
      .then(d => { if (d.success) setNotifLogs(d.data); })
      .catch(() => {});
  }, []);

  const saveNotifSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingNotif(true);
    try {
      const r = await fetch(`${API}/notification-settings`, { method: 'POST', headers: headers(), body: JSON.stringify(notifSettings) });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      showToast('Notification settings saved ✓');
    } catch (err: any) { showToast(err.message, 'err'); }
    finally { setSavingNotif(false); }
  };

  const testNotification = async (channel: string) => {
    setTestingChannel(channel);
    try {
      // Save first
      await fetch(`${API}/notification-settings`, { method: 'POST', headers: headers(), body: JSON.stringify(notifSettings) });
      const r = await fetch(`${API}/notification-test`, { method: 'POST', headers: headers(), body: JSON.stringify({ channel }) });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      showToast(d.message || `Test ${channel} sent ✓`);
    } catch (err: any) { showToast(err.message, 'err'); }
    finally { setTestingChannel(null); }
  };

  // ── Expiry alert banner ───────────────────────────────────────────────────
  const expiryAlerts = useMemo(() =>
    licenses.filter(l => {
      const d = daysUntil(l.expiry_date);
      return d !== null && d <= 30 && d >= 0;
    }).sort((a,b) => daysUntil(a.expiry_date)! - daysUntil(b.expiry_date)!),
  [licenses]);

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-5 animate-fadeIn">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-5 py-3 rounded-xl shadow-xl text-white text-sm font-medium flex items-center gap-2 animate-fadeIn ${toast.type==='ok' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type==='ok' ? <CheckCircle size={16}/> : <AlertCircle size={16}/>} {toast.msg}
        </div>
      )}

      {/* Expiry banner */}
      {tab === 'LICENSES' && expiryAlerts.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-orange-500 flex-shrink-0 mt-0.5"/>
          <div className="flex-1">
            <p className="font-bold text-orange-800 text-sm">
              {expiryAlerts.length} license{expiryAlerts.length>1?'s':''} expiring within 30 days
            </p>
            <p className="text-orange-700 text-xs mt-0.5">
              {expiryAlerts.map(l => `${l.name} (${daysUntil(l.expiry_date)}d)`).join(' · ')}
            </p>
          </div>
          <button onClick={() => setTab('SETTINGS')} className="text-xs text-orange-700 font-bold underline whitespace-nowrap">Configure Alerts →</button>
        </div>
      )}

      {/* Header + Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Regulatory Compliance</h2>
          <p className="text-slate-500 text-sm">Manage Drug Licenses, Schedule Registers, and Audits.</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-1 flex overflow-x-auto max-w-full gap-1">
          {([['LICENSES','Licenses',<ShieldCheck size={15}/>], ['H1','H1 Register',<FileText size={15}/>], ['TEMP','Cold Chain',<Thermometer size={15}/>], ['AUDIT','Inspections',<CheckSquare size={15}/>], ['SETTINGS','Alerts',<Bell size={15}/>]] as [Tab,string,React.ReactNode][]).map(([id,label,icon]) => (
            <button key={id} onClick={() => { setTab(id); setSearch(''); }}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 whitespace-nowrap ${tab===id ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
              {icon}{label}
              {id==='SETTINGS' && (notifSettings.email_enabled || notifSettings.whatsapp_enabled) && (
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full"/>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Hidden file input */}
      <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
        onChange={e => {
          const f  = e.target.files?.[0];
          const id = fileRef.current?.dataset.licid;
          if (f && id) {
            if (id === '__pending__') { applyPendingFile(f); }
            else                      { handleUpload(id, f); }
          }
          e.target.value = '';
        }}
      />

      {/* ══ LICENSES ══════════════════════════════════════════════════════════ */}
      {tab === 'LICENSES' && (
        <>
          {/* AI Risk Score Board */}
          {riskData && (
            <div className="bg-slate-900 rounded-xl p-5 mb-2 shadow-lg relative overflow-hidden flex flex-col md:flex-row items-center gap-6">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full -mr-32 -mt-32 blur-3xl"></div>
              
              <div className="flex-shrink-0 flex flex-col items-center justify-center p-4 bg-white/5 rounded-xl border border-white/10 w-40">
                <p className="text-white/60 text-xs font-bold uppercase tracking-wider mb-1">Risk Score</p>
                <div className="flex items-end gap-1">
                  <span className={`text-4xl font-black tracking-tighter ${
                    riskData.level === 'Critical' ? 'text-red-400' : 
                    riskData.level === 'Medium' ? 'text-orange-400' : 'text-green-400'
                  }`}>{riskData.score}</span>
                  <span className="text-white/40 font-bold mb-1">/100</span>
                </div>
                <div className={`mt-2 px-2.5 py-0.5 rounded text-[10px] font-black uppercase ${
                  riskData.level === 'Critical' ? 'bg-red-500/20 text-red-300' : 
                  riskData.level === 'Medium' ? 'bg-orange-500/20 text-orange-300' : 'bg-green-500/20 text-green-300'
                }`}>
                  {riskData.level} RISK
                </div>
              </div>

              <div className="flex-1 z-10 text-center md:text-left">
                <h3 className="text-lg font-bold text-white mb-2 flex items-center justify-center md:justify-start gap-2">
                  <ShieldCheck className="text-primary" size={20}/> 
                  AI Compliance Analysis
                </h3>
                <p className="text-sm text-slate-400 max-w-xl leading-relaxed mb-4">
                  Real-time regulatory risk assessment based on license validities, suspension history, and upcoming deadlines.
                </p>
                <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                  {riskData.factors.map((f: any, i: number) => (
                    <span key={i} className={`text-xs px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${
                      f.impact === 'High' ? 'bg-red-500/10 border-red-500/20 text-red-300' :
                      'bg-white/5 border-white/10 text-slate-300'
                    }`}>
                      {f.impact === 'High' ? <AlertCircle size={12}/> : <CheckCircle size={12}/>}
                      {f.name}: <strong className="uppercase">{f.impact}</strong>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600"><CheckCircle size={20}/></div>
              <div><p className="text-2xl font-bold text-slate-800">{stats.valid}</p><p className="text-xs text-slate-500 uppercase font-medium">Valid</p></div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600"><Clock size={20}/></div>
              <div><p className="text-2xl font-bold text-slate-800">{stats.expiring}</p><p className="text-xs text-slate-500 uppercase font-medium">Expiring Soon</p></div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600"><AlertCircle size={20}/></div>
              <div><p className="text-2xl font-bold text-slate-800">{stats.expired}</p><p className="text-xs text-slate-500 uppercase font-medium">Expired</p></div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
              <input type="text" placeholder="Search licenses..." value={search} onChange={e=>setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"/>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button onClick={fetchLicenses} className="flex-1 sm:flex-none px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1.5">
                <RefreshCw size={14} className={loadingLic?'animate-spin':''}/> Refresh
              </button>
              <button onClick={() => openLicModal()} className="flex-1 sm:flex-none bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sky-600 flex items-center justify-center gap-1.5">
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
                        <button onClick={() => viewCert(lic)} title="View Certificate" className="p-1 hover:bg-slate-100 rounded text-primary"><Eye size={14}/></button>
                        <button onClick={() => { if(fileRef.current){ fileRef.current.dataset.licid=lic.id; fileRef.current.click(); }}} title="Upload Certificate"
                          className="p-1 hover:bg-blue-50 rounded text-blue-500" disabled={uploadingId===lic.id}>
                          {uploadingId===lic.id ? <Loader2 size={14} className="animate-spin"/> : <Upload size={14}/>}
                        </button>
                        <button onClick={() => sendAlert(lic.id)} title="Send Alert" disabled={alertingId===lic.id}
                          className="p-1 hover:bg-orange-50 rounded text-orange-500">
                          {alertingId===lic.id ? <Loader2 size={14} className="animate-spin"/> : <Send size={14}/>}
                        </button>
                        <button onClick={() => openLicModal(lic)} title="Edit" className="p-1 hover:bg-slate-100 rounded text-slate-500"><Edit size={14}/></button>
                        <button onClick={() => deleteLicense(lic.id, lic.name)} title="Delete" className="p-1 hover:bg-red-50 rounded text-red-400"><Trash2 size={14}/></button>
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-slate-800 mb-0.5 leading-snug">{lic.name}</h3>
                    <p className="text-xs font-mono text-slate-500 mb-1">{lic.license_number}</p>
                    {lic.notes && <p className="text-xs text-slate-400 italic mb-2 line-clamp-1">{lic.notes}</p>}

                    <div className="flex items-center justify-between text-sm pt-3 border-t border-slate-100">
                      <span className="text-slate-500 text-xs">Expires</span>
                      <div className="text-right">
                        <span className={`font-bold text-xs ${uiStatus==='Expiring Soon' ? 'text-orange-600' : uiStatus==='Expired' ? 'text-red-600' : 'text-slate-700'}`}>
                          {lic.expiry_date || 'Perpetual'}
                        </span>
                        {days !== null && days >= 0 && days <= 60 && (
                          <p className={`text-[10px] font-bold ${days<=7?'text-red-500':days<=30?'text-orange-500':'text-yellow-600'}`}>{days} days left</p>
                        )}
                      </div>
                    </div>

                    <button onClick={() => viewCert(lic)}
                      className={`w-full mt-3 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${lic.file_path ? 'bg-primary text-white hover:bg-sky-600 shadow-sm' : 'bg-slate-50 text-slate-400 border border-slate-200 hover:bg-slate-100'}`}>
                      {lic.file_path ? <><Eye size={13}/> View Certificate</> : <><ImageIcon size={13}/> No Certificate</>}
                    </button>
                  </div>
                </div>
              );
            }) : (
              <div className="col-span-full py-14 text-center bg-white rounded-xl border border-dashed border-slate-300">
                <Search size={28} className="mx-auto text-slate-300 mb-3"/>
                <p className="text-slate-500 font-medium">No licenses match "{search}"</p>
                <button onClick={()=>setSearch('')} className="mt-3 text-primary text-sm font-bold hover:underline">Clear search</button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══ H1 REGISTER ═══════════════════════════════════════════════════════ */}
      {tab === 'H1' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
              <input type="text" placeholder="Search drug, patient…" value={search} onChange={e=>setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"/>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button onClick={()=>setShowH1Modal(true)} className="flex-1 sm:flex-none bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sky-600 flex items-center justify-center gap-1.5"><Plus size={15}/> Add Entry</button>
              <button className="flex-1 sm:flex-none px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm flex items-center justify-center gap-1.5 hover:bg-slate-50"><Download size={15}/> Export PDF</button>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-slate-50 flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-500"/><h3 className="font-bold text-slate-800">Schedule H1 Drug Register</h3>
              <span className="ml-auto text-xs text-slate-400">{filteredH1.length} records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
                  <tr>{['Date','Drug Name','Batch','Qty','Patient','Doctor','Invoice'].map(h=><th key={h} className="p-3">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredH1.map(r=>(
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="p-3 text-sm text-slate-500">{r.entry_date}</td>
                      <td className="p-3 text-sm font-bold text-red-700">{r.drug_name}</td>
                      <td className="p-3 text-xs font-mono text-slate-400">{r.batch_number}</td>
                      <td className="p-3 text-sm font-bold">{r.quantity}</td>
                      <td className="p-3 text-sm">{r.patient_name}</td>
                      <td className="p-3 text-sm text-slate-500">{r.doctor_name}</td>
                      <td className="p-3 text-sm text-blue-600 cursor-pointer hover:underline">{r.invoice_no}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══ COLD CHAIN ════════════════════════════════════════════════════════ */}
      {tab === 'TEMP' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 lg:col-span-1">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Thermometer size={18} className="text-blue-500"/> Current Status</h3>
            <div className="text-center py-5 bg-blue-50 rounded-xl border border-blue-100 mb-4">
              <span className="text-4xl font-bold text-blue-700">{tempLogs[0]?.temperature || '--'}°C</span>
              <p className="text-sm text-blue-600 mt-1 font-medium">Refrigerator 1 (Vaccines)</p>
            </div>
            <div className="flex justify-between text-sm p-2 bg-slate-50 rounded mb-4">
              <span className="text-slate-500">Ideal Range</span>
              <span className="font-bold text-green-600">2°C – 8°C</span>
            </div>
            <button onClick={()=>setShowTempModal(true)} className="w-full py-2.5 bg-slate-900 text-white rounded-lg font-bold text-sm hover:bg-slate-700">
              Log Temperature Now
            </button>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden lg:col-span-2">
            <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Temperature History</h3>
              <button className="text-xs text-primary hover:underline">Download CSV</button>
            </div>
            <div className="max-h-[480px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-white text-xs font-bold text-slate-500 uppercase border-b sticky top-0">
                  <tr>{['Date','Time','Reading','Checked By','Status'].map(h=><th key={h} className="p-3">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tempLogs.map(l=>(
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="p-3 text-sm text-slate-500">{l.log_date}</td>
                      <td className="p-3 text-sm text-slate-400">{l.log_time}</td>
                      <td className="p-3 text-sm font-bold">{l.temperature}°C</td>
                      <td className="p-3 text-sm">{l.checked_by}</td>
                      <td className="p-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${l.status==='OK' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>{l.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══ INSPECTIONS ═══════════════════════════════════════════════════════ */}
      {tab === 'AUDIT' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <div><h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><CheckSquare size={18} className="text-primary"/> Daily Self-Inspection</h3>
              <p className="text-slate-500 text-sm">{new Date().toLocaleDateString('en-IN',{dateStyle:'full'})}</p></div>
            <div className="text-right">
              <p className="text-xs text-slate-400 font-bold uppercase">Completion</p>
              <p className="text-2xl font-bold text-green-600">
                {checklist.length ? Math.round(checklist.filter(i=>i.checked).length/checklist.length*100) : 0}%
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {checklist.map(item=>(
              <div key={item.id} className="flex items-start gap-3 p-3 border border-slate-100 rounded-lg hover:bg-slate-50 group">
                <input type="checkbox" checked={item.checked} onChange={()=>toggleCheck(item.id)}
                  className="w-5 h-5 text-primary rounded border-slate-300 mt-0.5 cursor-pointer"/>
                <span className={`text-sm flex-1 ${item.checked?'text-slate-400 line-through':'text-slate-700'}`}>{item.text}</span>
                <button onClick={()=>removeItem(item.id)} className="text-slate-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t flex gap-3">
            <input type="text" value={newItem} onChange={e=>setNewItem(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addItem()}
              placeholder="Add new audit point…" className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"/>
            <button onClick={addItem} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 font-bold"><Plus size={18}/></button>
            <button className="px-6 py-2 bg-primary text-white font-bold rounded-lg hover:bg-sky-600">Save Report</button>
          </div>
        </div>
      )}

      {/* ══ NOTIFICATION SETTINGS ═════════════════════════════════════════════ */}
      {tab === 'SETTINGS' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Settings form */}
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
                  <button type="button" onClick={()=>testNotification('email')} disabled={!notifSettings.email_address || testingChannel==='email'}
                    className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50">
                    {testingChannel==='email' ? <Loader2 size={13} className="animate-spin"/> : <Send size={13}/>} Send Test Email
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
                    placeholder="+919876543210 (with country code)" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"/>
                  <input type="text" value={notifSettings.whatsapp_apikey} onChange={e=>setNotifSettings((p:any)=>({...p,whatsapp_apikey:e.target.value}))}
                    placeholder="CallMeBot API key" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"/>
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-2.5 text-xs text-blue-700">
                    <strong>Setup:</strong> Send "<code>I allow callmebot to send me messages</code>" to <strong>+34 644 51 82 23</strong> on WhatsApp to get your free API key.
                  </div>
                  <button type="button" onClick={()=>testNotification('whatsapp')} disabled={!notifSettings.whatsapp_number || !notifSettings.whatsapp_apikey || testingChannel==='whatsapp'}
                    className="w-full py-1.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50">
                    {testingChannel==='whatsapp' ? <Loader2 size={13} className="animate-spin"/> : <Send size={13}/>} Send Test WhatsApp
                  </button>
                </div>
              )}
            </div>

            {/* Alert thresholds */}
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
              {savingNotif ? <Loader2 size={16} className="animate-spin"/> : <CheckCircle size={16}/>}
              Save Settings
            </button>
          </form>

          {/* Notification log */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-slate-50 flex items-center gap-2">
              <Bell size={16} className="text-slate-500"/><h3 className="font-bold text-slate-800">Notification Log</h3>
              <span className="ml-auto text-xs text-slate-400">{notifLogs.length} sent</span>
            </div>
            {notifLogs.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">No notifications sent yet</div>
            ) : (
              <div className="max-h-[480px] overflow-y-auto divide-y divide-slate-100">
                {notifLogs.map(l=>(
                  <div key={l.id} className="p-3 flex items-start gap-3">
                    <span className="text-lg">{l.channel==='email'?'📧':'💬'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{l.license_name || 'License'}</p>
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

      {/* ══ MODALS ════════════════════════════════════════════════════════════ */}

      {/* Certificate Viewer — true fullscreen */}
      {showCertViewer && viewingLic && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-slate-900 animate-fadeIn">
          <div className="w-full flex flex-col" style={{ height: '100vh' }}>

            {/* ── Header ── */}
            <div className="bg-slate-900 text-white px-5 py-3 flex justify-between items-center flex-shrink-0 border-b border-white/10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck size={16} className="text-primary"/>
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm truncate">{viewingLic.name}</h3>
                  <p className="text-xs text-slate-400 truncate">{viewingLic.license_number}{viewingLic.category ? ` · ${viewingLic.category}` : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                <button
                  onClick={() => { if(fileRef.current){ fileRef.current.dataset.licid = viewingLic.id; fileRef.current.click(); }}}
                  disabled={uploadingId === viewingLic.id}
                  className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium disabled:opacity-50 transition">
                  {uploadingId === viewingLic.id ? <Loader2 size={13} className="animate-spin"/> : <Upload size={13}/>} Upload
                </button>
                {viewerBlobUrl && (
                  <a href={viewerBlobUrl} download={viewingLic.file_name || 'certificate'}
                    className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg font-medium transition">
                    <Download size={13}/> Download
                  </a>
                )}
                <button onClick={closeCertViewer} className="p-1.5 hover:bg-white/10 rounded-lg transition ml-1">
                  <X size={20}/>
                </button>
              </div>
            </div>

            {/* ── Document area — fills all remaining height ── */}
            <div className="flex-1 bg-slate-800 flex items-center justify-center overflow-hidden" style={{ minHeight: 0 }}>
              {viewerBlobLoading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 size={40} className="animate-spin text-primary"/>
                  <p className="text-sm text-slate-500 font-medium">Loading certificate…</p>
                </div>
              ) : viewerBlobUrl ? (
                viewingLic.file_name?.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={viewerBlobUrl}
                    title="Certificate PDF"
                    className="w-full h-full border-0"
                    style={{ display: 'block' }}
                  />
                ) : (
                  <img
                    src={viewerBlobUrl}
                    alt={viewingLic.name}
                    className="w-full h-full object-contain"
                    style={{ padding: '12px' }}
                  />
                )
              ) : (
                <div className="text-center p-10">
                  <div className="w-20 h-20 bg-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText size={36} className="text-slate-500"/>
                  </div>
                  <h4 className="text-lg font-bold text-slate-700">No Certificate Uploaded</h4>
                  <p className="text-slate-500 text-sm mt-2 max-w-xs mx-auto">Upload a scanned copy or photo of this license to view it here.</p>
                  <button
                    onClick={() => { closeCertViewer(); if(fileRef.current){ fileRef.current.dataset.licid = viewingLic.id; fileRef.current.click(); }}}
                    className="mt-5 px-6 py-2.5 bg-primary text-white rounded-lg font-bold hover:bg-sky-600">
                    Upload Certificate
                  </button>
                </div>
              )}
            </div>

            {/* ── Footer ── */}
            <div className="px-5 py-2.5 bg-slate-900 border-t border-white/10 flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-400">Status:</span>
                <span className={`font-bold text-xs px-2 py-0.5 rounded border ${statusClass(computeStatus(viewingLic.expiry_date))}`}>
                  {computeStatus(viewingLic.expiry_date)}
                </span>
              </div>
              <div className="text-sm text-slate-400">
                Expires:{' '}
                <span className="font-semibold text-slate-200">
                  {viewingLic.expiry_date
                    ? new Date(viewingLic.expiry_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                    : 'Perpetual'}
                </span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ══ Add / Edit License Modal ══════════════════════════════════════════ */}
      {showLicModal && (() => {
        const expiryDays  = licForm.expiry_date ? daysUntil(licForm.expiry_date) : null;
        const expiryColor = expiryDays === null ? '' : expiryDays < 0 ? 'text-red-500' : expiryDays <= 7 ? 'text-red-500' : expiryDays <= 30 ? 'text-orange-500' : 'text-green-600';
        const expiryLabel = expiryDays === null ? '' : expiryDays < 0 ? `Expired ${Math.abs(expiryDays)} days ago` : expiryDays === 0 ? 'Expires today!' : `Expires in ${expiryDays} day${expiryDays===1?'':'s'}`;

        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-fadeIn max-h-[95vh] overflow-y-auto">

              {/* Header */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-5 py-4 flex justify-between items-center rounded-t-2xl sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                    <ShieldCheck size={18} className="text-primary"/>
                  </div>
                  <div>
                    <h3 className="font-bold text-base">{editingLic ? 'Edit License' : 'Add New License'}</h3>
                    <p className="text-xs text-slate-400">{editingLic ? editingLic.license_number : 'Fill in the details below'}</p>
                  </div>
                </div>
                <button onClick={()=>setShowLicModal(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition"><X size={18}/></button>
              </div>

              {/* Quick templates (Add mode only) */}
              {!editingLic && (
                <div className="px-5 pt-4 pb-0">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Quick Fill</p>
                  <div className="flex flex-wrap gap-1.5">
                    {LICENSE_TEMPLATES.map(t => (
                      <button key={t.label} type="button"
                        onClick={() => setLicForm(p => ({ ...p, name: t.name, category: t.category, issued_by: t.issued_by }))}
                        className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-primary hover:text-white text-slate-600 text-xs font-semibold transition-all border border-slate-200 hover:border-primary">
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Body: 2-column */}
              <div className="grid grid-cols-1 md:grid-cols-2">

                {/* ── Left: Certificate ── */}
                <div className="p-5 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col gap-3">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                    <FileText size={12}/> Certificate Document
                  </p>

                  {/* Drop zone */}
                  <div
                    ref={dropRef}
                    onDragOver={e => { e.preventDefault(); setDragOverDrop(true); }}
                    onDragLeave={() => setDragOverDrop(false)}
                    onDrop={e => {
                      e.preventDefault(); setDragOverDrop(false);
                      const f = e.dataTransfer.files[0];
                      if (f) { if (editingLic) { handleUpload(editingLic.id, f); } else { applyPendingFile(f); } }
                    }}
                    onClick={() => {
                      if (fileRef.current) {
                        fileRef.current.dataset.licid = editingLic?.id || '__pending__';
                        fileRef.current.click();
                      }
                    }}
                    className={`relative cursor-pointer rounded-xl border-2 border-dashed overflow-hidden flex items-center justify-center transition-all ${dragOverDrop ? 'border-primary bg-blue-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300'}`}
                    style={{ minHeight: 200 }}
                  >
                    {/* Edit mode: show existing cert */}
                    {editingLic && editingLic.file_path && !uploadingId && (
                      editingLic.file_name?.toLowerCase().endsWith('.pdf')
                        ? <div className="flex flex-col items-center gap-2 p-4 text-center">
                            <FileText size={44} className="text-red-400"/>
                            <p className="text-xs font-semibold text-slate-600 truncate max-w-[160px]">{editingLic.file_name}</p>
                            <p className="text-[11px] text-slate-400">PDF · click to replace</p>
                          </div>
                        : editThumbUrl
                          ? <div className="w-full h-full p-1">
                              <img src={editThumbUrl} alt="cert" className="w-full h-48 object-contain rounded-lg"/>
                              <p className="text-[11px] text-slate-400 text-center mt-1">Click to replace</p>
                            </div>
                          : <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
                              <Loader2 size={24} className="animate-spin text-primary"/>
                              <p className="text-[11px]">Loading preview…</p>
                            </div>
                    )}
                    {/* Add mode: pending preview */}
                    {!editingLic && pendingPreview && !uploadingId && (
                      pendingPreview === 'pdf'
                        ? <div className="flex flex-col items-center gap-2 p-4 text-center">
                            <FileText size={44} className="text-red-400"/>
                            <p className="text-xs font-semibold text-slate-600 truncate max-w-[160px]">{pendingFile?.name}</p>
                            <p className="text-[11px] text-slate-400">PDF · click to change</p>
                          </div>
                        : <div className="w-full h-full p-1">
                            <img src={pendingPreview} alt="preview" className="w-full h-48 object-contain rounded-lg"/>
                            <p className="text-[11px] text-slate-400 text-center mt-1">Click to change</p>
                          </div>
                    )}
                    {/* Upload in progress */}
                    {uploadingId && (
                      <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center gap-2">
                        <Loader2 size={30} className="animate-spin text-primary"/>
                        <p className="text-xs text-slate-500 font-medium">Uploading…</p>
                      </div>
                    )}
                    {/* No file yet */}
                    {((editingLic && !editingLic.file_path) || (!editingLic && !pendingPreview)) && !uploadingId && (
                      <div className="flex flex-col items-center gap-2 p-6 text-center pointer-events-none">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${dragOverDrop ? 'bg-primary/10' : 'bg-slate-200'}`}>
                          <Upload size={26} className={dragOverDrop ? 'text-primary' : 'text-slate-400'}/>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-600">{dragOverDrop ? 'Drop to upload' : 'Upload Certificate'}</p>
                          <p className="text-xs text-slate-400 mt-0.5">Drag & drop or click to browse</p>
                          <p className="text-[11px] text-slate-300 mt-0.5">JPG · PNG · PDF · max 10 MB</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* View Full (edit with cert) */}
                  {editingLic && editingLic.file_path && (
                    <button type="button" onClick={() => { setShowLicModal(false); viewCert(editingLic); }}
                      className="flex items-center justify-center gap-1.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold">
                      <Eye size={13}/> View Full Screen
                    </button>
                  )}
                  {/* Clear pending (add mode) */}
                  {!editingLic && pendingFile && (
                    <button type="button" onClick={() => { setPendingFile(null); setPendingPreview(null); }}
                      className="flex items-center justify-center gap-1.5 py-1.5 text-red-400 hover:text-red-600 text-xs font-medium">
                      <X size={12}/> Remove file
                    </button>
                  )}
                </div>

                {/* ── Right: Form ── */}
                <form onSubmit={saveLicense} className="p-5 space-y-3.5">

                  {/* License Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">License Name *</label>
                    <input required type="text" placeholder="e.g. Drug License (20B)"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-slate-50 focus:bg-white transition"
                      value={licForm.name} onChange={e=>setLicForm({...licForm,name:e.target.value})}/>
                  </div>

                  {/* License Number */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">License Number *</label>
                    <input required type="text" placeholder="e.g. MH-PUN-2024001"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-slate-50 focus:bg-white transition font-mono"
                      value={licForm.license_number} onChange={e=>setLicForm({...licForm,license_number:e.target.value})}/>
                  </div>

                  {/* Dates row */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Issue Date</label>
                      <input type="date"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-slate-50 focus:bg-white transition"
                        value={licForm.start_date} onChange={e=>setLicForm({...licForm,start_date:e.target.value})}/>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Expiry Date</label>
                      <input type="date"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-slate-50 focus:bg-white transition"
                        value={licForm.expiry_date} onChange={e=>handleExpiryChange(e.target.value)}/>
                    </div>
                  </div>

                  {/* Expiry countdown pill */}
                  {expiryLabel && (
                    <div className={`flex items-center gap-1.5 text-xs font-semibold ${expiryColor}`}>
                      <Clock size={12}/> {expiryLabel}
                    </div>
                  )}

                  {/* Status (auto + manual override) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Status</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(['Valid','Expiring Soon','Expired','Suspended'] as string[]).map(s => (
                        <button key={s} type="button" onClick={() => setLicForm(p=>({...p,status:s}))}
                          className={`py-1.5 rounded-lg text-[11px] font-bold border transition-all ${licForm.status===s ? statusClass(s)+' shadow-sm' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Category</label>
                    <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-slate-50 focus:bg-white transition"
                      value={licForm.category} onChange={e=>setLicForm({...licForm,category:e.target.value})}>
                      {LICENSE_CATEGORIES.map(c=><option key={c}>{c}</option>)}
                    </select>
                  </div>

                  {/* Issued By */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Issued By</label>
                    <input type="text" placeholder="e.g. Drug Control Department"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-slate-50 focus:bg-white transition"
                      value={licForm.issued_by} onChange={e=>setLicForm({...licForm,issued_by:e.target.value})}/>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Notes</label>
                    <textarea rows={2} placeholder="Renewal conditions, contact person, etc."
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-slate-50 focus:bg-white transition resize-none"
                      value={licForm.notes} onChange={e=>setLicForm({...licForm,notes:e.target.value})}/>
                  </div>

                  {/* Submit */}
                  <button type="submit" disabled={isSavingLic}
                    className="w-full bg-primary text-white py-2.5 rounded-xl font-bold hover:bg-sky-600 flex items-center justify-center gap-2 disabled:opacity-60 transition-all text-sm mt-1">
                    {isSavingLic
                      ? <><Loader2 size={15} className="animate-spin"/> Saving…</>
                      : editingLic ? <><CheckCircle size={15}/> Update License</> : <><Plus size={15}/> Add License</>
                    }
                  </button>
                </form>
              </div>
            </div>
          </div>
        );
      })()}

      {/* H1 Modal */}
      {showH1Modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-fadeIn">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center rounded-t-xl">
              <h3 className="font-bold">Add H1 Register Entry</h3><button onClick={()=>setShowH1Modal(false)}><X size={18}/></button>
            </div>
            <form onSubmit={saveH1} className="p-5 space-y-3">
              <div><label className="block text-xs font-semibold text-slate-600 mb-1 uppercase">Drug Name *</label>
                <input required type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" value={h1Form.drug_name} onChange={e=>setH1Form({...h1Form,drug_name:e.target.value})}/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-slate-600 mb-1 uppercase">Batch No</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" value={h1Form.batch_number} onChange={e=>setH1Form({...h1Form,batch_number:e.target.value})}/></div>
                <div><label className="block text-xs font-semibold text-slate-600 mb-1 uppercase">Quantity *</label>
                  <input required type="number" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" value={h1Form.quantity} onChange={e=>setH1Form({...h1Form,quantity:e.target.value})}/></div>
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

      {/* Temp Modal */}
      {showTempModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm animate-fadeIn">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center rounded-t-xl">
              <h3 className="font-bold">Log Temperature</h3><button onClick={()=>setShowTempModal(false)}><X size={18}/></button>
            </div>
            <form onSubmit={saveTemp} className="p-5 space-y-3">
              <div><label className="block text-xs font-semibold text-slate-600 mb-1 uppercase">Temperature (°C) *</label>
                <input required autoFocus type="number" step="0.1" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-lg font-bold outline-none focus:border-primary" value={tempForm.temperature} onChange={e=>setTempForm({...tempForm,temperature:e.target.value})}/></div>
              <div><label className="block text-xs font-semibold text-slate-600 mb-1 uppercase">Equipment</label>
                <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" value={tempForm.equipment_name} onChange={e=>setTempForm({...tempForm,equipment_name:e.target.value})}/></div>
              <div><label className="block text-xs font-semibold text-slate-600 mb-1 uppercase">Checked By *</label>
                <input required type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" value={tempForm.checked_by} onChange={e=>setTempForm({...tempForm,checked_by:e.target.value})}/></div>
              <div><label className="block text-xs font-semibold text-slate-600 mb-1 uppercase">Remarks</label>
                <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" value={tempForm.remarks} onChange={e=>setTempForm({...tempForm,remarks:e.target.value})}/></div>
              <button type="submit" className="w-full bg-primary text-white py-2.5 rounded-lg font-bold hover:bg-sky-600">Save Log</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Compliance;
