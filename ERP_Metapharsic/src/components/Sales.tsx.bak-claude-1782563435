import React, { useState, useMemo, useRef } from 'react';
import {
  FileText, Download, AlertCircle, TrendingUp, ShoppingBag,
  CheckCircle, ExternalLink, Trash2, Loader2, Printer, X,
  Building2, Phone, Mail, MapPin, Hash
} from 'lucide-react';
import {
  ERPLayout, FilterBar, DataTable, StatCard, Badge, Tabs, Modal
} from './UniversalLayout';
import { useDataFetch, useDatabaseStatus, useSearch, usePagination, invalidateCache } from '../hooks/useDataFetch';
import { apiClient } from '../services/apiClient';

// ── Company info for invoice header (edit here or pull from settings API) ──
const COMPANY = {
  name: 'METAPHARSIC LIFESCIENCES',
  address: 'GROUND FLOOR, HMT NAGAR, STREET NO 5, HNO4-9-147, NACHARAM, UPPAL, Medchal Malkajgiri, Hyderabad, Telangana - 500076',
  phone: '9533388894, 9985589599, 99855895',
  email: 'metapharsic@gmail.com',
  gstin: '36ACHFM0773D1ZC',
  dl: 'TG/MDL/2026-147387, TG/MDL/2026-147387',
  bank_name: 'HDFC BANK',
  bank_branch: 'NACHARAM, HYDERABAD',
  bank_account: '50200111658794',
  bank_ifsc: 'HDFC0000108',
  logo: '/logo.svg'
};

const Sales: React.FC = () => {
  const { status: dbStatus } = useDatabaseStatus();

  const { data: salesData, loading, refetch } = useDataFetch<any[]>('/api/sales', { cacheTime: 60000 });
  const { data: statsResponse, loading: statsLoading, refetch: refetchStats } = useDataFetch<any>('/api/sales/stats');
  const { data: dropdownData } = useDataFetch<any>('/api/sales/dropdown');
  const { data: partiesData, loading: partiesLoading, refetch: refetchParties } = useDataFetch<any[]>('/api/pos/parties?status=All');
  const { data: productsData } = useDataFetch<any[]>('/api/sales/products');
  const { data: analyticsResp } = useDataFetch<any>('/api/sales/analytics');

  const [activeTab, setActiveTab] = useState('INVOICES');
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);
  const [invoiceFull, setInvoiceFull] = useState<any>(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filters, setFilters] = useState({ searchTerm: '', status: 'All' });
  const printRef = useRef<HTMLDivElement>(null);

  const blankForm = () => ({
    party_id: '', party_name: '',
    invoice_date: new Date().toISOString().split('T')[0],
    payment_mode: 'Credit',
    lr_no: '', lr_date: '', order_no: '', due_date: '',
    ewaybill_no: '', transport: '', weight: '',
    items: [] as any[]
  });
  const blankItem = () => ({
    product_id: '', name: '',
    hsn_code: '', pack: '',
    quantity: 1, free_quantity: 0,
    batch_no: '', manufacturer_code: '',
    expiry_date: '',
    old_mrp: 0, mrp: 0, rate: 0,
    discount_percent: 0, gst_percent: 12,
    scheme_type: 'none'
  });
  const [invoiceForm, setInvoiceForm] = useState(blankForm());
  const [pendingItem, setPendingItem] = useState(blankItem());

  const { query, setQuery, results: searchResults } = useSearch<any>(salesData || [], ['invoice_no', 'party_name']);

  const filteredData = useMemo(() => {
    if (!searchResults) return [];
    return searchResults.filter(s => filters.status === 'All' || s.status === filters.status);
  }, [searchResults, filters.status]);

  const pagination = usePagination<any>(filteredData, 10);

  const stats = useMemo(() => {
    const d = statsResponse?.data || statsResponse || {};
    return { totalRevenue: d.totalRevenue || 0, monthlyRevenue: d.monthlyRevenue || 0, totalInvoices: d.totalInvoices || 0 };
  }, [statsResponse]);

  const analytics = useMemo(() => {
    const d = analyticsResp?.data || {};
    return { trend: d.trend || [], topCategories: d.topCategories || [] };
  }, [analyticsResp]);

  const invoiceSubTotal = invoiceForm.items.reduce((s, i) => {
    const t = (parseFloat(i.quantity)||0) * (parseFloat(i.rate)||0) * (1 - (parseFloat(i.discount_percent)||0)/100);
    return s + t;
  }, 0);
  const invoiceTotalGst = invoiceForm.items.reduce((s, i) => {
    const t = (parseFloat(i.quantity)||0) * (parseFloat(i.rate)||0) * (1 - (parseFloat(i.discount_percent)||0)/100);
    return s + t * (parseFloat(i.gst_percent)||12) / 100;
  }, 0);
  const invoiceRoundOff = +(Math.round(invoiceSubTotal + invoiceTotalGst) - (invoiceSubTotal + invoiceTotalGst)).toFixed(2);
  const invoiceGrandTotal = Math.round(invoiceSubTotal + invoiceTotalGst);

  const handleRefresh = async () => {
    invalidateCache('/api/sales');
    await Promise.all([refetch(), refetchStats(), refetchParties()]);
  };

  const handleProductSelect = (product_id: string) => {
    const prod = (productsData || []).find((p: any) => p.id === product_id);
    if (prod) {
      setPendingItem(prev => ({
        ...prev,
        product_id: prod.id, name: prod.name,
        hsn_code: prod.hsn_code || prod.hsn || '',
        pack: prod.pack || prod.pack_size || '',
        mrp: parseFloat(prod.mrp) || 0,
        rate: parseFloat(prod.ptr) || parseFloat(prod.rate) || 0,
        gst_percent: parseFloat(prod.gst) || parseFloat(prod.gst_rate) || 12,
        manufacturer_code: prod.manufacturer || prod.manufacturer_code || '',
      }));
    } else setPendingItem(prev => ({ ...prev, product_id: '', name: '' }));
  };

  const handleAddItem = () => {
    if (!pendingItem.product_id) { alert('Select a product.'); return; }
    if (!pendingItem.quantity || pendingItem.quantity <= 0) { alert('Enter valid qty.'); return; }
    if (!pendingItem.rate || pendingItem.rate <= 0) { alert('Enter valid rate.'); return; }
    setInvoiceForm(prev => ({ ...prev, items: [...prev.items, { ...pendingItem }] }));
    setPendingItem(blankItem());
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceForm.party_id || invoiceForm.items.length === 0) { alert('Select distributor and add at least one item.'); return; }
    setIsSaving(true);
    try {
      const res = await apiClient.post('/api/sales', invoiceForm);
      if (res.success) {
        setShowInvoiceModal(false);
        invalidateCache('/api/sales');
        handleRefresh();
        setInvoiceForm(blankForm());
        setPendingItem(blankItem());
      } else alert(res.error || 'Failed to create invoice');
    } catch (error: any) {
      alert(error.message || 'Failed to create invoice');
    } finally { setIsSaving(false); }
  };

  const handleDeleteInvoice = async (inv: any) => {
    if (!window.confirm(`Cancel invoice ${inv.invoice_no}? This cannot be undone.`)) return;
    setDeletingId(inv.id);
    try {
      const res = await apiClient.delete(`/api/sales/${inv.id}`);
      if (res.success) { invalidateCache('/api/sales'); handleRefresh(); }
      else alert(res.error || 'Failed to cancel invoice');
    } catch (err: any) {
      alert(err?.data?.error || err?.message || 'Failed');
    } finally { setDeletingId(null); }
  };

  const handlePrint = () => {
    const inv2 = invoiceFull || selectedInvoice;
    if (!inv2) return;
    const w = window.open('', '_blank', 'width=1200,height=900');
    if (!w) return;

    const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g,'-'); } catch { return d||''; } };
    const fmtExp  = (d: string) => { if (!d) return ''; try { const dt=new Date(d); return `${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getFullYear()).slice(-2)}`; } catch { return d; } };
    const n2 = (n: number) => n.toFixed(2);
    const inr = (n: number) => n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});

    // Detect IGST (interstate) vs CGST+SGST (intrastate Telangana=36)
    const partyGstin = inv2.gstin || inv2.party_gstin || '';
    const isIGST = partyGstin && !partyGstin.startsWith('36');

    // Build per-item calcs
    type ItemCalc = { taxable:number; igst:number; cgst:number; sgst:number; amount:number; gst:number };
    const calcItems: ItemCalc[] = invoiceItems.map(item => {
      const qty   = Number(item.quantity)||0;
      const rate  = Number(item.ptr||item.rate||item.selling_price||0);
      const disc  = Number(item.discount_percent||0);
      const gst   = Number(item.gst_percent||item.gst_rate||12);
      const taxable = +(rate*qty*(1-disc/100)).toFixed(2);
      const tax   = +(taxable*gst/100).toFixed(2);
      return { taxable, gst, igst: isIGST?tax:0, cgst: isIGST?0:+(tax/2).toFixed(2), sgst: isIGST?0:+(tax/2).toFixed(2), amount: taxable };
    });

    // GST slab groups
    const slabs: Record<string,{total:number;scheme:number;disc:number;tax:number}> = {};
    [0,5,12,18,28].forEach(s => { slabs[s] = {total:0,scheme:0,disc:0,tax:0}; });
    invoiceItems.forEach((item,i) => {
      const g = Number(item.gst_percent||item.gst_rate||12);
      const k = [0,5,12,18,28].includes(g)?g:12;
      slabs[k].total  += calcItems[i].taxable;
      slabs[k].tax    += isIGST ? calcItems[i].igst : calcItems[i].cgst+calcItems[i].sgst;
    });

    const totalTaxable = calcItems.reduce((s,c)=>s+c.taxable,0);
    const totalIgst    = calcItems.reduce((s,c)=>s+c.igst,0);
    const totalCgst    = calcItems.reduce((s,c)=>s+c.cgst,0);
    const totalSgst    = calcItems.reduce((s,c)=>s+c.sgst,0);
    const totalTax     = isIGST ? totalIgst : totalCgst+totalSgst;
    const netBeforeRound = totalTaxable + totalTax;
    const roundOff     = +(Math.round(netBeforeRound) - netBeforeRound).toFixed(2);
    const grandTotal   = Math.round(netBeforeRound);
    const totalQty     = invoiceItems.reduce((s,i)=>s+(Number(i.quantity)||0),0);

    // Amount in words
    const numWords = (n: number): string => {
      const a=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
      const b=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
      const c=(x:number):string=>{
        if(x<20)return a[x];if(x<100)return b[Math.floor(x/10)]+(x%10?' '+a[x%10]:'');
        if(x<1000)return a[Math.floor(x/100)]+' Hundred'+(x%100?' '+c(x%100):'');
        if(x<100000)return c(Math.floor(x/1000))+' Thousand'+(x%1000?' '+c(x%1000):'');
        if(x<10000000)return c(Math.floor(x/100000))+' Lakh'+(x%100000?' '+c(x%100000):'');
        return c(Math.floor(x/10000000))+' Crore'+(x%10000000?' '+c(x%10000000):'');
      };
      const rs=Math.floor(n); const ps=Math.round((n-rs)*100);
      return 'Rs. '+c(rs)+' and '+c(ps)+' Paise only';
    };

    // Item rows
    const td = (val:string,align='left',bold=false,extra='')=>
      `<td style="border:1px solid #999;padding:3px 4px;font-size:9px;text-align:${align};${bold?'font-weight:700;':''}${extra}">${val}</td>`;

    const itemRows = invoiceItems.map((item,i)=>{
      const c = calcItems[i];
      const freeQty = Number(item.free_quantity||0);
      const schemeLabel = item.scheme_type&&item.scheme_type!=='none' ? item.scheme_type : (freeQty>0?`+${freeQty}`:' ');
      return `<tr>
        ${td(String(i+1),'center')}
        ${td(item.hsn_code||item.hsn||'','center')}
        ${td(item.product_name||'','left',true)}
        ${td(item.pack||item.pack_size||'','center')}
        ${td(n2(Number(item.quantity||0)),'center',true)}
        ${td(n2(freeQty),'center')}
        ${td(item.batch_no||'','center')}
        ${td(item.manufacturer||item.mfr_code||'','center')}
        ${td(fmtExp(item.expiry||item.expiry_date||''),'center')}
        ${td(n2(Number(item.old_mrp||0)),'right')}
        ${td(n2(Number(item.mrp||0)),'right')}
        ${td(n2(Number(item.ptr||item.rate||0)),'right',true)}
        ${td(n2(Number(item.discount_percent||0)),'right')}
        ${td(n2(c.gst),'right')}
        ${td(n2(isIGST?c.igst:c.cgst+c.sgst),'right','color:#00008B')}
        ${td(n2(c.taxable),'right',true)}
      </tr>`;
    }).join('');

    // GST class rows
    const classRows = [5,12,18,28].map(s=>{
      const sl = slabs[s];
      const label = isIGST ? `IGST ${n2(s)}%` : `GST ${n2(s)}%`;
      return `<tr>
        <td style="border:1px solid #999;padding:2px 4px;font-size:8.5px;">${label}</td>
        <td style="border:1px solid #999;padding:2px 4px;font-size:8.5px;text-align:right;">${n2(sl.total)}</td>
        <td style="border:1px solid #999;padding:2px 4px;font-size:8.5px;text-align:right;">0.00</td>
        <td style="border:1px solid #999;padding:2px 4px;font-size:8.5px;text-align:right;">0.00</td>
        <td style="border:1px solid #999;padding:2px 4px;font-size:8.5px;text-align:right;font-weight:700;">${n2(sl.tax)}</td>
      </tr>`;
    }).join('');

    const taxLabel = isIGST ? 'IGST PAYABLE' : 'CGST+SGST PAYABLE';

    w.document.write(`<!DOCTYPE html><html><head>
      <title>GST Invoice ${inv2.invoice_no}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:Arial,sans-serif;font-size:9.5px;color:#000;background:#fff;}
        .page{width:210mm;padding:6mm 8mm;margin:0 auto;}
        table{border-collapse:collapse;}
        @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
          @page{size:A4 portrait;margin:6mm;}}
      </style></head><body>
      <div class="page">

        <!-- TOP BORDER -->
        <div style="border:2px solid #000;padding:0;">

          <!-- ROW 1: Seller | Invoice | Buyer -->
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1.5px solid #000;">

            <!-- SELLER -->
            <div style="padding:6px 8px;border-right:1px solid #000;">
              <div style="font-size:13px;font-weight:900;color:#000;letter-spacing:0.5px;">${COMPANY.name}</div>
              <div style="font-size:8px;margin-top:2px;line-height:1.6;">${COMPANY.address}</div>
              <div style="font-size:8px;margin-top:2px;">GSTIN : <strong>${COMPANY.gstin}</strong></div>
              <div style="font-size:8px;">Phone : ${COMPANY.phone}</div>
              <div style="font-size:8px;">D.L. NO.: <strong>${COMPANY.dl}</strong></div>
            </div>

            <!-- GST INVOICE CENTRE -->
            <div style="padding:4px 6px;border-right:1px solid #000;text-align:center;">
              <div style="font-size:16px;font-weight:900;color:#000;letter-spacing:2px;">GST INVOICE</div>
              <div style="font-size:10px;font-weight:700;margin-bottom:4px;">${inv2.payment_mode||'CREDIT'}</div>
              <table style="width:100%;border-collapse:collapse;font-size:8.5px;">
                <tr><td style="padding:1.5px 3px;font-weight:700;">Invoice No</td><td style="padding:1.5px 3px;font-weight:900;font-family:monospace;">${inv2.invoice_no}</td><td style="padding:1.5px 3px;">L.R. No.</td><td style="padding:1.5px 3px;"></td></tr>
                <tr style="background:#f5f5f5;"><td style="padding:1.5px 3px;font-weight:700;">Invoice Date</td><td style="padding:1.5px 3px;font-weight:700;">${fmtDate(inv2.invoice_date)}</td><td style="padding:1.5px 3px;">L.R. Date</td><td style="padding:1.5px 3px;">${fmtDate(inv2.invoice_date)}</td></tr>
                <tr><td style="padding:1.5px 3px;font-weight:700;">Order No.</td><td style="padding:1.5px 3px;"></td><td style="padding:1.5px 3px;">Cases</td><td style="padding:1.5px 3px;font-weight:700;">${invoiceItems.length}</td></tr>
                <tr style="background:#f5f5f5;"><td style="padding:1.5px 3px;font-weight:700;">Order Date</td><td style="padding:1.5px 3px;"></td><td style="padding:1.5px 3px;">Due Date</td><td style="padding:1.5px 3px;font-weight:700;">${fmtDate(inv2.invoice_date)}</td></tr>
              </table>
              <div style="margin-top:4px;text-align:left;font-size:8px;">
                <span style="font-weight:700;">Ewaybill No:</span>&nbsp;
                <span style="font-weight:700;">Transport :-</span>&nbsp;
                <span style="font-weight:700;">Weight :-</span>
              </div>
            </div>

            <!-- BILLING DETAILS -->
            <div style="padding:6px 8px;">
              <div style="font-size:8px;font-weight:900;text-decoration:underline;margin-bottom:3px;">BILLING DETAILS</div>
              <div style="font-size:11px;font-weight:900;">${inv2.party_name||''}</div>
              <div style="font-size:8px;line-height:1.6;margin-top:2px;">${(inv2.party_address||'').replace(/,/g,',<br>')}</div>
              <div style="font-size:8px;">PHONE. : ${inv2.party_phone||''}</div>
              <div style="font-size:8px;">GSTIN : <strong>${partyGstin||''}</strong></div>
              <div style="font-size:8px;">DL No.: <strong>${inv2.party_dl||inv2.drug_license||''}</strong></div>
              <div style="font-size:8px;font-weight:900;text-decoration:underline;margin-top:4px;">SHIPPING DETAILS</div>
            </div>
          </div>

          <!-- LINE ITEMS TABLE -->
          <table style="width:100%;border-collapse:collapse;border-bottom:1px solid #000;">
            <thead>
              <tr style="background:#e8e8e8;">
                <th style="border:1px solid #999;padding:3px 2px;font-size:8px;text-align:center;width:20px;">S.N</th>
                <th style="border:1px solid #999;padding:3px 2px;font-size:8px;text-align:center;width:55px;">HSN</th>
                <th style="border:1px solid #999;padding:3px 4px;font-size:8px;text-align:left;">Product Name</th>
                <th style="border:1px solid #999;padding:3px 2px;font-size:8px;text-align:center;width:40px;">Pack</th>
                <th style="border:1px solid #999;padding:3px 2px;font-size:8px;text-align:center;width:36px;">Qty</th>
                <th style="border:1px solid #999;padding:3px 2px;font-size:8px;text-align:center;width:32px;">Free</th>
                <th style="border:1px solid #999;padding:3px 2px;font-size:8px;text-align:center;width:60px;">Batch No.</th>
                <th style="border:1px solid #999;padding:3px 2px;font-size:8px;text-align:center;width:28px;">Mfr</th>
                <th style="border:1px solid #999;padding:3px 2px;font-size:8px;text-align:center;width:32px;">Exp. DT</th>
                <th style="border:1px solid #999;padding:3px 2px;font-size:8px;text-align:right;width:46px;">OLD MRP</th>
                <th style="border:1px solid #999;padding:3px 2px;font-size:8px;text-align:right;width:46px;">NEW MRP</th>
                <th style="border:1px solid #999;padding:3px 2px;font-size:8px;text-align:right;width:44px;">Rate</th>
                <th style="border:1px solid #999;padding:3px 2px;font-size:8px;text-align:right;width:30px;">DIS%</th>
                <th style="border:1px solid #999;padding:3px 2px;font-size:8px;text-align:right;width:34px;">IGST<br>%</th>
                <th style="border:1px solid #999;padding:3px 2px;font-size:8px;text-align:right;width:52px;">VALUE</th>
                <th style="border:1px solid #999;padding:3px 2px;font-size:8px;text-align:right;width:58px;">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              ${itemRows||'<tr><td colspan="16" style="text-align:center;padding:20px;color:#888;">No items found</td></tr>'}
              <!-- empty rows to fill page -->
              ${Array(Math.max(0,10-invoiceItems.length)).fill('<tr>'+Array(16).fill('<td style="border:1px solid #eee;padding:8px;"></td>').join('')+'</tr>').join('')}
            </tbody>
          </table>

          <!-- FOOTER SECTION -->
          <div style="display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #000;">

            <!-- LEFT: GST CLASS TABLE -->
            <div style="border-right:1px solid #000;">
              <table style="width:100%;border-collapse:collapse;">
                <thead>
                  <tr style="background:#e8e8e8;">
                    <th style="border:1px solid #999;padding:3px 4px;font-size:8px;text-align:left;width:80px;">CLASS</th>
                    <th style="border:1px solid #999;padding:3px 4px;font-size:8px;text-align:right;">TOTAL</th>
                    <th style="border:1px solid #999;padding:3px 4px;font-size:8px;text-align:right;">SCHEME</th>
                    <th style="border:1px solid #999;padding:3px 4px;font-size:8px;text-align:right;">DISCOUNT</th>
                    <th style="border:1px solid #999;padding:3px 4px;font-size:8px;text-align:right;">${isIGST?'IGST':'GST'}</th>
                  </tr>
                </thead>
                <tbody>
                  ${classRows}
                  <tr style="background:#e8e8e8;font-weight:900;">
                    <td style="border:1px solid #999;padding:2px 4px;font-size:8.5px;">TOTAL</td>
                    <td style="border:1px solid #999;padding:2px 4px;font-size:8.5px;text-align:right;">${n2(totalTaxable)}</td>
                    <td style="border:1px solid #999;padding:2px 4px;font-size:8.5px;text-align:right;">0.00</td>
                    <td style="border:1px solid #999;padding:2px 4px;font-size:8.5px;text-align:right;">0.00</td>
                    <td style="border:1px solid #999;padding:2px 4px;font-size:8.5px;text-align:right;">${n2(totalTax)}</td>
                  </tr>
                </tbody>
              </table>
              <div style="padding:4px 6px;font-size:8.5px;font-style:italic;border-top:1px solid #ddd;">
                ${numWords(grandTotal)}
              </div>
              <div style="padding:4px 6px;font-size:8px;border-top:1px dotted #ccc;"><strong>MSG:</strong></div>
            </div>

            <!-- RIGHT: TOTALS BOX -->
            <div>
              <table style="width:100%;border-collapse:collapse;">
                <tr>
                  <td colspan="2" style="border:1px solid #999;padding:2px 6px;font-size:9px;text-align:right;">
                    Total Items :- <strong>${invoiceItems.length}</strong>
                    &nbsp;&nbsp;&nbsp; DIS AMT. &nbsp;&nbsp;
                    <strong style="font-size:10px;">0.00</strong>
                  </td>
                </tr>
                <tr>
                  <td style="border:1px solid #999;padding:2px 6px;font-size:9px;">Total Qty :- <strong>${totalQty}</strong></td>
                  <td style="border:1px solid #999;padding:2px 6px;font-size:9px;text-align:right;">${taxLabel} &nbsp; <strong>${n2(totalTax)}</strong></td>
                </tr>
                <tr>
                  <td style="border:1px solid #999;padding:2px 6px;font-size:9px;"></td>
                  <td style="border:1px solid #999;padding:2px 6px;font-size:9px;text-align:right;">Round off &nbsp; <strong>${n2(roundOff)}</strong></td>
                </tr>
                <tr>
                  <td style="border:1px solid #999;padding:2px 6px;font-size:9px;"></td>
                  <td style="border:1px solid #999;padding:2px 6px;font-size:9px;text-align:right;">CR/DR NOTE &nbsp; <strong>0.00</strong></td>
                </tr>
                <tr style="background:#e8e8e8;">
                  <td colspan="2" style="border:1px solid #999;padding:2px 6px;font-size:9px;font-weight:900;text-align:right;">
                    TOTAL &nbsp;&nbsp; ${n2(totalTaxable)}
                  </td>
                </tr>
              </table>

              <!-- BANK + SIGNATORY + GRAND TOTAL -->
              <div style="display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #000;">
                <div style="padding:5px 6px;border-right:1px solid #000;font-size:8px;">
                  <div style="font-weight:900;text-decoration:underline;margin-bottom:3px;">OUR BANK DETAILS AS :-</div>
                  <div>Bank Name : <strong>${COMPANY.bank_name}</strong></div>
                  <div>Branch Name : <strong>${COMPANY.bank_branch}</strong></div>
                  <div>Account No. : <strong>${COMPANY.bank_account}</strong></div>
                  <div>IFSC Code : <strong>${COMPANY.bank_ifsc}</strong></div>
                  <div style="margin-top:4px;font-weight:900;text-decoration:underline;">Terms &amp; Conditions</div>
                  <div style="line-height:1.5;margin-top:2px;">
                    1. Goods once sold will not be taken back or exchanged.<br>
                    2. Bills not paid due date will attract 24% interest.<br>
                    3. All disputes subject to Jurisdication only.<br>
                    4. MRP revised as per reduced GST slab.
                  </div>
                </div>
                <div style="padding:5px 6px;display:flex;flex-direction:column;justify-content:space-between;">
                  <div style="font-size:8.5px;text-align:center;font-weight:700;">FOR &nbsp; ${COMPANY.name}</div>
                  <div style="text-align:center;margin-top:8px;">
                    <div style="font-size:8px;color:#555;">Authorised Signatory</div>
                  </div>
                  <div style="border:2px solid #000;padding:6px;text-align:center;margin-top:8px;background:#f9f9f9;">
                    <div style="font-size:9px;font-weight:700;">Grand Total</div>
                    <div style="font-size:18px;font-weight:900;">${grandTotal.toLocaleString('en-IN')}.00</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div><!-- end border -->
      </div>
      <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}</script>
      </body></html>`);
    w.document.close();
  };

  const handleExport = () => {
    const headers = ['Invoice No', 'Date', 'Customer', 'Amount', 'Status'];
    const rows = filteredData.map(s => [s.invoice_no, s.invoice_date, s.party_name, s.net_payable, s.status]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `wholesale_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    pagination.goToPage(1);
  };

  const inv = selectedInvoice;
  const invSubTotal = Number(inv?.total_taxable || inv?.sub_total || 0);
  const invGst = Number(inv?.total_gst || (Number(inv?.total_cgst || 0) + Number(inv?.total_sgst || 0) + Number(inv?.total_igst || 0)));
  const invNet = Number(inv?.net_payable || 0);

  if (!dbStatus.connected) return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-2xl mx-auto mt-8">
      <div className="flex gap-3">
        <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
        <div>
          <h3 className="font-semibold text-red-900">Database Connection Failed</h3>
          <p className="text-red-700 text-sm mt-1">{dbStatus.error}</p>
          <button onClick={handleRefresh} className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm">Retry</button>
        </div>
      </div>
    </div>
  );

  return (
    <ERPLayout
      title="Sales Management (Wholesale)"
      description="Wholesale invoicing, distributor accounts, and revenue analytics"
      onRefresh={handleRefresh}
      onExport={handleExport}
      isLoading={loading || statsLoading || partiesLoading}
      actionButtons={[{ label: '+ New Wholesale Invoice', onClick: () => setShowInvoiceModal(true), variant: 'primary' }]}
    >
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard title="Total Revenue" value={`₹${stats.totalRevenue.toLocaleString()}`} color="blue" icon={<TrendingUp size={20} />} />
        <StatCard title="Monthly Sales" value={`₹${stats.monthlyRevenue.toLocaleString()}`} color="success" icon={<ShoppingBag size={20} />} />
        <StatCard title="Total Invoices" value={stats.totalInvoices} color="indigo" icon={<FileText size={20} />} />
      </div>

      <FilterBar filters={[
        { id: 'searchTerm', label: 'Search', type: 'text', value: filters.searchTerm, placeholder: 'Invoice No or Customer...', onChange: (v) => { handleFilterChange('searchTerm', v); setQuery(v); } },
        { id: 'status', label: 'Status', type: 'select', value: filters.status, onChange: (v) => handleFilterChange('status', v),
          options: dropdownData?.data?.statuses || [{ value: 'All', label: 'All Statuses' }, { value: 'Completed', label: 'Completed' }, { value: 'Pending', label: 'Pending' }, { value: 'Cancelled', label: 'Cancelled' }] }
      ]} />

      <Tabs activeTab={activeTab} onChange={setActiveTab} tabs={[
        { id: 'INVOICES', label: 'Wholesale Invoices', badge: filteredData.length },
        { id: 'CUSTOMERS', label: 'Distributor Master' },
        { id: 'ANALYTICS', label: 'Revenue Analysis' }
      ]} />

      {/* ── INVOICES TAB ── */}
      {activeTab === 'INVOICES' && (
        <>
          <DataTable
            loading={loading}
            emptyMessage="No wholesale invoices found"
            data={pagination.paginatedData}
            columns={[
              { key: 'invoice_no', label: 'Invoice No', width: '16%', render: (val) => <span className="font-bold text-primary font-mono">{val}</span> },
              { key: 'invoice_date', label: 'Date', width: '11%', render: (val) => <span className="text-slate-500">{new Date(val).toLocaleDateString()}</span> },
              { key: 'party_name', label: 'Distributor', width: '26%', render: (val) => <span className="font-medium text-slate-800">{val}</span> },
              { key: 'item_count', label: 'Items', width: '7%', align: 'center' },
              { key: 'net_payable', label: 'Amount', width: '14%', align: 'right', render: (val) => <span className="font-bold">₹{Number(val).toLocaleString()}</span> },
              { key: 'status', label: 'Status', width: '12%', render: (val) => <Badge text={val} variant={val === 'Completed' ? 'success' : val === 'Cancelled' ? 'danger' : 'warning'} /> },
              {
                key: 'actions', label: 'Actions', width: '14%', align: 'center',
                render: (_: any, row: any) => (
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={async () => {
                      setSelectedInvoice(row); setShowDetailsModal(true); setInvoiceItems([]); setInvoiceFull(null);
                      setLoadingItems(true);
                      try {
                        const r = await apiClient.get(`/api/sales/${row.id}`);
                        if (r.success) { setInvoiceItems(r.data.items || []); setInvoiceFull(r.data); }
                        else console.error('Sales detail API error:', r);
                      } catch (e) { console.error('Sales detail fetch failed:', e); } finally { setLoadingItems(false); }
                    }} title="View Invoice"
                      className="p-1.5 text-primary hover:bg-primary/10 rounded transition-colors">
                      <ExternalLink size={15} />
                    </button>
                    {row.status !== 'Cancelled' && (
                      <button onClick={() => handleDeleteInvoice(row)} disabled={deletingId === row.id} title="Cancel Invoice"
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-40">
                        {deletingId === row.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                      </button>
                    )}
                  </div>
                )
              }
            ]}
          />
          {pagination.totalPages > 1 && (
            <div className="mt-4 flex justify-between items-center">
              <p className="text-sm text-slate-500">Showing {pagination.paginatedData.length} of {filteredData.length}</p>
              <div className="flex gap-2">
                <button disabled={!pagination.hasPrevPage} onClick={() => pagination.goToPage(pagination.currentPage - 1)} className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
                <span className="px-3 py-1">Page {pagination.currentPage} of {pagination.totalPages}</span>
                <button disabled={!pagination.hasNextPage} onClick={() => pagination.goToPage(pagination.currentPage + 1)} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── DISTRIBUTOR MASTER TAB ── */}
      {activeTab === 'CUSTOMERS' && (
        <DataTable
          loading={partiesLoading}
          emptyMessage="No distributors found"
          data={partiesData || []}
          columns={[
            { key: 'name', label: 'Distributor', width: '28%', render: (val, row: any) => (
              <div><div className="font-bold text-slate-800">{val}</div><div className="text-[10px] text-slate-400 font-mono">{row.gstin || row.gst_number || '—'}</div></div>
            )},
            { key: 'city', label: 'Location', width: '14%', render: (val, row: any) => <span className="text-slate-600">{val || row.territory || '—'}</span> },
            { key: 'mobile', label: 'Contact', width: '14%', render: (val, row: any) => <span>{val || row.phone || '—'}</span> },
            { key: 'credit_limit', label: 'Credit Limit', width: '13%', align: 'right', render: (val) => <span className="font-mono text-slate-700">₹{Number(val || 0).toLocaleString()}</span> },
            { key: 'currentBalance', label: 'Outstanding', width: '14%', align: 'right', render: (val) => (
              <span className={`font-bold ${Number(val) > 0 ? 'text-red-600' : 'text-green-600'}`}>₹{Math.abs(Number(val)).toLocaleString()}</span>
            )},
            { key: 'status', label: 'Status', width: '10%', render: (val) => <Badge text={val} variant={val === 'Active' ? 'success' : 'neutral'} /> },
            { key: 'actions', label: '', width: '7%', align: 'center', render: (_: any, row: any) => (
              <button onClick={() => alert(`Ledger for ${row.name} — coming soon`)} className="text-primary hover:underline font-bold text-xs">Ledger →</button>
            )}
          ]}
        />
      )}

      {/* ── REVENUE ANALYSIS TAB ── */}
      {activeTab === 'ANALYTICS' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Trend */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <TrendingUp size={18} className="text-primary" /> Monthly Revenue (Last 6 Months)
              </h3>
              {analytics.trend.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">No data yet</div>
              ) : (() => {
                const maxVal = Math.max(...analytics.trend.map((t: any) => Number(t.revenue)));
                return (
                  <div className="h-[200px] flex items-end justify-between gap-2 pt-6">
                    {analytics.trend.map((t: any, i: number) => {
                      const pct = maxVal > 0 ? (Number(t.revenue) / maxVal) * 100 : 0;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                          <span className="text-[9px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            ₹{Number(t.revenue).toLocaleString()}
                          </span>
                          <div className="w-full bg-primary/20 hover:bg-primary/50 rounded-t transition-all" style={{ height: `${Math.max(pct, 4)}%` }} />
                          <span className="text-[10px] font-bold text-slate-500">{t.month}</span>
                          <span className="text-[9px] text-slate-400">{t.invoices} inv</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Top Categories */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <ShoppingBag size={18} className="text-emerald-500" /> Top Categories (Last 90 Days)
              </h3>
              {analytics.topCategories.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">No data yet</div>
              ) : (() => {
                const total = analytics.topCategories.reduce((s: number, c: any) => s + Number(c.revenue), 0);
                const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500', 'bg-rose-500'];
                return (
                  <div className="space-y-3 mt-2">
                    {analytics.topCategories.map((cat: any, i: number) => {
                      const pct = total > 0 ? Math.round((Number(cat.revenue) / total) * 100) : 0;
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-slate-600">{cat.category || 'Uncategorised'}</span>
                            <span className="text-slate-900">{pct}% · ₹{Number(cat.revenue).toLocaleString()}</span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full ${colors[i % colors.length]}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── NEW INVOICE MODAL ── */}
      <Modal isOpen={showInvoiceModal} title="GST Invoice Entry — Wholesale" onClose={() => { setShowInvoiceModal(false); setInvoiceForm(blankForm()); setPendingItem(blankItem()); }} size="xl">
        <form onSubmit={handleCreateInvoice} className="space-y-0">

          {/* ── HEADER: 3-column Arelion layout ── */}
          <div className="grid grid-cols-3 border border-slate-300 rounded-t-lg overflow-hidden text-xs mb-0">
            {/* Seller */}
            <div className="p-3 border-r border-slate-300 bg-slate-50">
              <div className="font-black text-sm text-slate-900">{COMPANY.name}</div>
              <div className="text-slate-500 mt-1 leading-relaxed">{COMPANY.address}</div>
              <div className="mt-1">GSTIN: <strong>{COMPANY.gstin}</strong></div>
              <div>Ph: {COMPANY.phone}</div>
              <div>D.L.: <strong>{COMPANY.dl}</strong></div>
            </div>
            {/* GST INVOICE centre */}
            <div className="p-3 border-r border-slate-300 text-center">
              <div className="font-black text-base tracking-widest">GST INVOICE</div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-2 text-left">
                <div className="text-slate-500">Invoice No</div><div className="font-mono font-bold text-sky-700">AUTO (WHO-...)</div>
                <div className="text-slate-500">Date *</div>
                <div><input type="date" required className="w-full border border-slate-300 rounded px-1 py-0.5 text-xs" value={invoiceForm.invoice_date} onChange={e => setInvoiceForm(f => ({...f, invoice_date: e.target.value}))} /></div>
                <div className="text-slate-500">L.R. No.</div>
                <div><input type="text" className="w-full border border-slate-300 rounded px-1 py-0.5 text-xs" placeholder="LR No." value={invoiceForm.lr_no} onChange={e => setInvoiceForm(f => ({...f, lr_no: e.target.value}))} /></div>
                <div className="text-slate-500">L.R. Date</div>
                <div><input type="date" className="w-full border border-slate-300 rounded px-1 py-0.5 text-xs" value={invoiceForm.lr_date} onChange={e => setInvoiceForm(f => ({...f, lr_date: e.target.value}))} /></div>
                <div className="text-slate-500">Order No.</div>
                <div><input type="text" className="w-full border border-slate-300 rounded px-1 py-0.5 text-xs" placeholder="Order No." value={invoiceForm.order_no} onChange={e => setInvoiceForm(f => ({...f, order_no: e.target.value}))} /></div>
                <div className="text-slate-500">Due Date</div>
                <div><input type="date" className="w-full border border-slate-300 rounded px-1 py-0.5 text-xs" value={invoiceForm.due_date} onChange={e => setInvoiceForm(f => ({...f, due_date: e.target.value}))} /></div>
                <div className="text-slate-500">Payment</div>
                <div><select className="w-full border border-slate-300 rounded px-1 py-0.5 text-xs bg-white" value={invoiceForm.payment_mode} onChange={e => setInvoiceForm(f => ({...f, payment_mode: e.target.value}))}>
                  <option>Credit</option><option>Cash</option><option>Bank Transfer</option><option>Cheque</option>
                </select></div>
              </div>
              <div className="grid grid-cols-3 gap-1 mt-1">
                <input type="text" className="border border-slate-300 rounded px-1 py-0.5 text-xs" placeholder="Ewaybill No." value={invoiceForm.ewaybill_no} onChange={e => setInvoiceForm(f => ({...f, ewaybill_no: e.target.value}))} />
                <input type="text" className="border border-slate-300 rounded px-1 py-0.5 text-xs" placeholder="Transport" value={invoiceForm.transport} onChange={e => setInvoiceForm(f => ({...f, transport: e.target.value}))} />
                <input type="text" className="border border-slate-300 rounded px-1 py-0.5 text-xs" placeholder="Weight" value={invoiceForm.weight} onChange={e => setInvoiceForm(f => ({...f, weight: e.target.value}))} />
              </div>
            </div>
            {/* Billing details */}
            <div className="p-3">
              <div className="font-black text-[10px] uppercase text-slate-400 underline mb-1">Billing Details</div>
              <select required className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs bg-white font-bold"
                value={invoiceForm.party_id}
                onChange={(e) => { const p = (partiesData || []).find((x: any) => x.id === e.target.value); setInvoiceForm(f => ({ ...f, party_id: e.target.value, party_name: p?.name || '' })); }}>
                <option value="">Select Distributor *</option>
                {(partiesData || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {invoiceForm.party_id && (() => { const p = (partiesData||[]).find((x:any)=>x.id===invoiceForm.party_id); return p ? (<div className="mt-1 text-[10px] text-slate-500 leading-relaxed">{p.address||''}{p.gstin?<><br/>GSTIN: <strong>{p.gstin}</strong></>:''}{p.phone?<><br/>Ph: {p.phone}</>:''}</div>) : null; })()}
            </div>
          </div>

          {/* ── ITEM ENTRY ROW ── */}
          <div className="border border-slate-200 rounded-b-lg bg-slate-50 p-3 mt-0 border-t-0">
            <div className="text-[10px] font-black uppercase text-slate-400 mb-2">Add Product Line</div>
            <div className="grid grid-cols-12 gap-1 items-end text-[10px]">
              <div className="col-span-3">
                <div className="font-bold text-slate-500 mb-0.5">Product *</div>
                <select className="w-full border border-slate-300 rounded px-1.5 py-1 text-xs bg-white" value={pendingItem.product_id} onChange={e => handleProductSelect(e.target.value)}>
                  <option value="">Select…</option>
                  {(productsData||[]).map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="col-span-1">
                <div className="font-bold text-slate-500 mb-0.5">HSN</div>
                <input className="w-full border border-slate-300 rounded px-1.5 py-1 text-xs bg-white" value={pendingItem.hsn_code} onChange={e=>setPendingItem(p=>({...p,hsn_code:e.target.value}))} />
              </div>
              <div className="col-span-1">
                <div className="font-bold text-slate-500 mb-0.5">Pack</div>
                <input className="w-full border border-slate-300 rounded px-1.5 py-1 text-xs bg-white" value={pendingItem.pack} onChange={e=>setPendingItem(p=>({...p,pack:e.target.value}))} />
              </div>
              <div className="col-span-1">
                <div className="font-bold text-slate-500 mb-0.5">Qty</div>
                <input type="number" min="1" className="w-full border border-slate-300 rounded px-1.5 py-1 text-xs bg-white" value={pendingItem.quantity} onChange={e=>setPendingItem(p=>({...p,quantity:parseInt(e.target.value)||1}))} />
              </div>
              <div className="col-span-1">
                <div className="font-bold text-slate-500 mb-0.5">Free</div>
                <input type="number" min="0" className="w-full border border-slate-300 rounded px-1.5 py-1 text-xs bg-white" value={pendingItem.free_quantity} onChange={e=>setPendingItem(p=>({...p,free_quantity:parseInt(e.target.value)||0}))} />
              </div>
              <div className="col-span-1">
                <div className="font-bold text-slate-500 mb-0.5">Batch</div>
                <input className="w-full border border-slate-300 rounded px-1.5 py-1 text-xs bg-white" value={pendingItem.batch_no} onChange={e=>setPendingItem(p=>({...p,batch_no:e.target.value}))} />
              </div>
              <div className="col-span-1">
                <div className="font-bold text-slate-500 mb-0.5">Exp</div>
                <input type="month" className="w-full border border-slate-300 rounded px-1.5 py-1 text-xs bg-white" value={pendingItem.expiry_date?pendingItem.expiry_date.slice(0,7):''} onChange={e=>setPendingItem(p=>({...p,expiry_date:e.target.value?e.target.value+'-01':''}))} />
              </div>
              <div className="col-span-1">
                <div className="font-bold text-slate-500 mb-0.5">MRP</div>
                <input type="number" min="0" step="0.01" className="w-full border border-slate-300 rounded px-1.5 py-1 text-xs bg-white" value={pendingItem.mrp} onChange={e=>setPendingItem(p=>({...p,mrp:parseFloat(e.target.value)||0}))} />
              </div>
              <div className="col-span-1">
                <div className="font-bold text-slate-500 mb-0.5">Rate</div>
                <input type="number" min="0" step="0.01" className="w-full border border-slate-300 rounded px-1.5 py-1 text-xs bg-white" value={pendingItem.rate} onChange={e=>setPendingItem(p=>({...p,rate:parseFloat(e.target.value)||0}))} />
              </div>
              <div className="col-span-1">
                <div className="font-bold text-slate-500 mb-0.5">Dis%</div>
                <input type="number" min="0" step="0.01" className="w-full border border-slate-300 rounded px-1.5 py-1 text-xs bg-white" value={pendingItem.discount_percent} onChange={e=>setPendingItem(p=>({...p,discount_percent:parseFloat(e.target.value)||0}))} />
              </div>
              <div className="col-span-1">
                <div className="font-bold text-slate-500 mb-0.5">GST%</div>
                <select className="w-full border border-slate-300 rounded px-1.5 py-1 text-xs bg-white" value={pendingItem.gst_percent} onChange={e=>setPendingItem(p=>({...p,gst_percent:parseFloat(e.target.value)}))}>
                  <option value="0">0</option><option value="5">5</option><option value="12">12</option><option value="18">18</option><option value="28">28</option>
                </select>
              </div>
              <div className="col-span-1">
                <div className="font-bold text-slate-500 mb-0.5">&nbsp;</div>
                <button type="button" onClick={handleAddItem} className="w-full py-1 bg-sky-600 text-white rounded text-xs font-bold hover:bg-sky-700">+ Add</button>
              </div>
            </div>
          </div>

          {/* ── LINE ITEMS TABLE (Arelion style) ── */}
          <div className="mt-3 border border-slate-300 rounded-lg overflow-auto">
            <table className="w-full text-xs" style={{minWidth:'900px'}}>
              <thead className="bg-slate-900 text-white">
                <tr>
                  {['S.N','HSN','Product Name','Pack','Qty','Free','Batch No.','Exp. DT','MRP','Rate','Dis%','IGST%','VALUE','AMOUNT',''].map((h,i)=>(
                    <th key={i} className={`px-2 py-1.5 font-bold text-[9px] uppercase whitespace-nowrap ${['Qty','Free','Dis%','IGST%','VALUE','AMOUNT','MRP','Rate'].includes(h)?'text-right':h==='S.N'?'text-center':'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoiceForm.items.length === 0
                  ? <tr><td colSpan={15} className="py-8 text-center text-slate-400 italic">No items — add product above.</td></tr>
                  : invoiceForm.items.map((item,idx)=>{
                    const qty=Number(item.quantity)||0; const rate=Number(item.rate)||0; const disc=Number(item.discount_percent)||0; const gst=Number(item.gst_percent)||12;
                    const taxable=+(qty*rate*(1-disc/100)).toFixed(2);
                    const igstAmt=+(taxable*gst/100).toFixed(2);
                    return <tr key={idx} className={idx%2===0?'bg-white':'bg-slate-50'}>
                      <td className="px-2 py-1 text-center text-slate-400">{idx+1}</td>
                      <td className="px-2 py-1">{item.hsn_code||''}</td>
                      <td className="px-2 py-1 font-semibold">{item.name}</td>
                      <td className="px-2 py-1 text-center">{item.pack||''}</td>
                      <td className="px-2 py-1 text-right font-bold">{qty}</td>
                      <td className="px-2 py-1 text-right text-emerald-600">{item.free_quantity||0}</td>
                      <td className="px-2 py-1 font-mono text-[9px]">{item.batch_no||''}</td>
                      <td className="px-2 py-1 text-center">{item.expiry_date?item.expiry_date.slice(0,7).replace('-','/')?.split('/').reverse().join('/')?.slice(0,5):''}</td>
                      <td className="px-2 py-1 text-right">{rate.toFixed(2)}</td>
                      <td className="px-2 py-1 text-right font-bold text-sky-700">{rate.toFixed(2)}</td>
                      <td className="px-2 py-1 text-right">{disc.toFixed(2)}</td>
                      <td className="px-2 py-1 text-right">{gst}</td>
                      <td className="px-2 py-1 text-right text-blue-700 font-bold">{igstAmt.toFixed(2)}</td>
                      <td className="px-2 py-1 text-right font-bold">{taxable.toFixed(2)}</td>
                      <td className="px-2 py-1 text-center"><button type="button" onClick={()=>{const ni=[...invoiceForm.items];ni.splice(idx,1);setInvoiceForm(f=>({...f,items:ni}));}} className="text-red-400 hover:text-red-600"><Trash2 size={12}/></button></td>
                    </tr>;
                  })
                }
              </tbody>
            </table>
          </div>

          {/* ── FOOTER: CLASS table + totals ── */}
          {invoiceForm.items.length > 0 && (
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                <table className="w-full">
                  <thead className="bg-slate-100"><tr>
                    <th className="px-2 py-1 text-left text-[9px] uppercase">CLASS</th>
                    <th className="px-2 py-1 text-right text-[9px] uppercase">Total</th>
                    <th className="px-2 py-1 text-right text-[9px] uppercase">IGST</th>
                  </tr></thead>
                  <tbody>
                    {[5,12,18,28].map(slab=>{
                      const slabItems=invoiceForm.items.filter(i=>Number(i.gst_percent)===slab);
                      if(!slabItems.length) return null;
                      const slabTaxable=slabItems.reduce((s,i)=>s+(Number(i.quantity)||0)*(Number(i.rate)||0)*(1-(Number(i.discount_percent)||0)/100),0);
                      const slabTax=slabItems.reduce((s,i)=>{const t=(Number(i.quantity)||0)*(Number(i.rate)||0)*(1-(Number(i.discount_percent)||0)/100);return s+t*slab/100;},0);
                      return <tr key={slab} className="border-t border-slate-100">
                        <td className="px-2 py-0.5">GST {slab}%</td>
                        <td className="px-2 py-0.5 text-right">{slabTaxable.toFixed(2)}</td>
                        <td className="px-2 py-0.5 text-right font-bold">{slabTax.toFixed(2)}</td>
                      </tr>;
                    })}
                    <tr className="bg-slate-50 font-bold border-t border-slate-300">
                      <td className="px-2 py-1">TOTAL</td>
                      <td className="px-2 py-1 text-right">{invoiceSubTotal.toFixed(2)}</td>
                      <td className="px-2 py-1 text-right">{invoiceTotalGst.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="border border-slate-200 rounded-lg p-3 text-xs space-y-1">
                <div className="flex justify-between"><span className="text-slate-500">Taxable (AMOUNT)</span><span className="font-bold">₹{invoiceSubTotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">IGST (VALUE)</span><span className="font-bold text-blue-700">₹{invoiceTotalGst.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Round off</span><span>{invoiceRoundOff.toFixed(2)}</span></div>
                <div className="flex justify-between border-t border-slate-200 pt-1 mt-1">
                  <span className="font-black text-sm">Grand Total</span>
                  <span className="font-black text-sm text-sky-700">₹{invoiceGrandTotal.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          )}

          <div className="pt-3 border-t flex justify-between items-center">
            <p className="text-slate-400 text-xs">Invoice posted under <span className="font-mono font-bold text-slate-600">WHO-</span> prefix.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => { setShowInvoiceModal(false); setInvoiceForm(blankForm()); setPendingItem(blankItem()); }} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">Cancel</button>
              <button type="submit" disabled={isSaving || invoiceForm.items.length === 0}
                className="px-8 py-2 bg-primary text-white font-bold rounded-lg hover:bg-sky-600 flex items-center gap-2 disabled:opacity-50 text-sm">
                {isSaving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />} Finalize & Post
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* ── INVOICE DETAILS + PRINT MODAL ── */}
      {showDetailsModal && inv && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-6">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-900 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <FileText size={18} className="text-sky-400" />
                <span className="font-bold text-white font-mono">{inv.invoice_no}</span>
                <Badge text={inv.status} variant={inv.status === 'Completed' ? 'success' : inv.status === 'Cancelled' ? 'danger' : 'warning'} />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handlePrint} disabled={loadingItems}
                  className="flex items-center gap-2 px-4 py-1.5 bg-sky-500 text-white text-sm font-bold rounded-lg hover:bg-sky-400 transition-colors disabled:opacity-50 disabled:cursor-wait">
                  <Printer size={15} /> {loadingItems ? 'Loading…' : 'Print Invoice'}
                </button>
                <button onClick={() => setShowDetailsModal(false)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"><X size={18} /></button>
              </div>
            </div>

            {/* Printable content */}
            <div ref={printRef} className="p-6 space-y-5">
              {/* Company Header */}
              <div className="flex items-start justify-between border-b-2 border-sky-500 pb-5">
                <div className="flex items-start gap-4">
                  <img src={COMPANY.logo} alt="Logo" className="h-14 w-14 object-contain border border-slate-200 rounded-xl p-1" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  <div>
                    <div className="text-xl font-black text-sky-600 tracking-tight">{COMPANY.name}</div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1"><MapPin size={10} /> {COMPANY.address}</div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                      <span className="flex items-center gap-1"><Phone size={10} /> {COMPANY.phone}</span>
                      <span className="flex items-center gap-1"><Mail size={10} /> {COMPANY.email}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500 mt-0.5">
                      <span className="flex items-center gap-1"><Hash size={9} /> GSTIN: {COMPANY.gstin}</span>
                      <span>DL: {COMPANY.dl}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-black text-slate-800 tracking-widest uppercase">Invoice</div>
                  <div className="font-mono font-bold text-sky-600 text-sm mt-1">{inv.invoice_no}</div>
                  <div className="text-xs text-slate-500 mt-1">Date: <strong>{new Date(inv.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></div>
                  <div className="text-xs text-slate-500">Mode: <strong>{inv.payment_mode || 'Credit'}</strong></div>
                </div>
              </div>

              {/* Bill To */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1"><Building2 size={9} /> Bill To</p>
                  <p className="font-bold text-slate-800 text-base">{inv.party_name}</p>
                </div>
                <div className="bg-sky-50 rounded-xl p-4 border border-sky-100">
                  <p className="text-[9px] font-black uppercase tracking-widest text-sky-400 mb-2">Summary</p>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <span className="text-slate-500">Items:</span><span className="font-bold text-right">{inv.item_count || '—'}</span>
                    <span className="text-slate-500">Taxable:</span><span className="font-bold text-right">₹{invSubTotal.toLocaleString()}</span>
                    <span className="text-slate-500">GST:</span><span className="font-bold text-right text-orange-600">₹{invGst.toLocaleString()}</span>
                    <span className="text-sky-600 font-black">Net:</span><span className="font-black text-sky-600 text-right">₹{invNet.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                {loadingItems ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-slate-400"><Loader2 size={16} className="animate-spin" /> Loading items…</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-900 text-white">
                        <th className="px-3 py-2 text-left w-6">#</th>
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2 text-center w-16">Batch</th>
                        <th className="px-3 py-2 text-center w-14">Expiry</th>
                        <th className="px-3 py-2 text-center w-10">Qty</th>
                        <th className="px-3 py-2 text-center w-12 text-emerald-400">Free</th>
                        <th className="px-3 py-2 text-center w-16 text-emerald-300">Scheme</th>
                        <th className="px-3 py-2 text-right w-16">MRP</th>
                        <th className="px-3 py-2 text-right w-16">PTR</th>
                        <th className="px-3 py-2 text-center w-12">GST%</th>
                        <th className="px-3 py-2 text-right w-20">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoiceItems.length === 0 ? (
                        <tr><td colSpan={11} className="px-3 py-6 text-center text-slate-400 italic">No items</td></tr>
                      ) : invoiceItems.map((item, i) => {
                        const freeQty = Number(item.free_quantity) || 0;
                        const schemeType = item.scheme_type && item.scheme_type !== 'none' ? item.scheme_type : '';
                        const hasScheme = freeQty > 0 || !!schemeType;
                        const schemeLabel = schemeType || (freeQty > 0 ? `+${freeQty} Free` : '—');
                        const expiry = item.expiry ? (() => { try { const d = new Date(item.expiry); return `${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; } catch { return item.expiry; } })() : '—';
                        return (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="px-3 py-2 text-slate-400">{i+1}</td>
                            <td className="px-3 py-2 font-semibold text-slate-800">{item.product_name}</td>
                            <td className="px-3 py-2 text-center font-mono text-slate-500">{item.batch_no || '—'}</td>
                            <td className="px-3 py-2 text-center text-slate-500">{expiry}</td>
                            <td className="px-3 py-2 text-center font-bold">{item.quantity}</td>
                            <td className="px-3 py-2 text-center font-bold text-emerald-600">{hasScheme ? freeQty : <span className="text-slate-300">—</span>}</td>
                            <td className="px-3 py-2 text-center text-xs font-bold text-emerald-700">{schemeLabel}</td>
                            <td className="px-3 py-2 text-right text-slate-600">₹{Number(item.mrp||0).toFixed(2)}</td>
                            <td className="px-3 py-2 text-right font-bold text-sky-700">₹{Number(item.ptr||0).toFixed(2)}</td>
                            <td className="px-3 py-2 text-center text-slate-500">{item.gst_percent||12}%</td>
                            <td className="px-3 py-2 text-right font-bold">₹{Number(item.total_amount||0).toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50"><td colSpan={10} className="px-3 py-2 text-right text-[10px] font-bold uppercase text-slate-500">Taxable</td><td className="px-3 py-2 text-right font-bold">₹{invSubTotal.toLocaleString()}</td></tr>
                      <tr className="bg-slate-50"><td colSpan={10} className="px-3 py-2 text-right text-[10px] font-bold uppercase text-orange-500">GST</td><td className="px-3 py-2 text-right font-bold text-orange-500">₹{invGst.toLocaleString()}</td></tr>
                      <tr className="bg-slate-900"><td colSpan={10} className="px-3 py-3 text-right font-black text-sky-400 text-sm uppercase tracking-wide">Net Payable</td><td className="px-3 py-3 text-right font-black text-sky-400 text-base">₹{invNet.toLocaleString()}</td></tr>
                    </tfoot>
                  </table>
                )}
              </div>

              {/* Footer note */}
              <div className="border-t border-slate-200 pt-4 flex justify-between items-end text-[10px] text-slate-400">
                <span>This is a computer-generated invoice. No signature required.</span>
                <span className="font-mono">{COMPANY.name}</span>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center bg-slate-50 rounded-b-2xl">
              <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-bold hover:bg-white">
                <Download size={15} /> Export CSV
              </button>
              <button onClick={() => setShowDetailsModal(false)} className="px-6 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-700">Close</button>
            </div>
          </div>
        </div>
      )}
    </ERPLayout>
  );
};

export default Sales;
