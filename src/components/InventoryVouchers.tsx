import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Save, Search, Plus, Calculator, FileText, Printer, Download, AlertCircle } from 'lucide-react';
import { DenseGrid, ColumnDef } from './common/DenseGrid';
import { useCompany } from '../context/CompanyContext';
import { printReport, addExcelBranding, ts } from '../utils/accountingExport';
import { getAllProducts, getAllInvoices, getAllPurchases, saveInvoice, savePurchase } from '../services/databaseService';
import { utils, writeFile } from 'xlsx';

export const InventoryVouchers: React.FC = () => {
 const [view, setView] = useState<'LIST' | 'FORM'>('LIST');
 const [voucherType, setVoucherType] = useState('Sales'); // Sales, Purchase, Stock Journal, Physical Stock, Stock Transfer
 const { company } = useCompany();

 // Data States
 const [vouchers, setVouchers] = useState<any[]>([]);
 const [products, setProducts] = useState<any[]>([]);
 const [branches, setBranches] = useState<any[]>([]);
 const [godowns, setGodowns] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);

 const [form, setForm] = useState({
 no: 'SAL-002', date: new Date().toISOString().split('T')[0], party: 'Apollo Hospitals',
 placeOfSupply: 'Delhi (07)',
 srcGodown: 'Main', destGodown: 'Cold',
 sourceBranch: 'BR-001', destBranch: 'BR-002'
 });

 const [items, setItems] = useState<any[]>([
 { item: 'Paracetamol 500mg', godown: 'Main', batch: 'B001', qty: 100, freeQty: 0, rate: 50, discount: 5, amount: 4750, gstRate: 12, physicalQty: 100 }
 ]);
 
 const [selectedItem, setSelectedItem] = useState<any>(null);

 const loadData = useCallback(async () => {
 setLoading(true);
 try {
 const { 
 getAllProducts, getAllInvoices, getAllPurchases, getAllStockJournals, getAllPhysicalStocks, getAllBranches, getAllStockTransfers, getAllGodowns
 } = await import('../services/databaseService');
 
 const [pData, invData, purData, sjData, psData, brData, stData, gData] = await Promise.all([
 getAllProducts(),
 getAllInvoices(),
 getAllPurchases(),
 getAllStockJournals(),
 getAllPhysicalStocks(),
 getAllBranches(),
 getAllStockTransfers(),
 getAllGodowns()
 ]);
 setProducts(Array.isArray(pData) ? pData : []);
 setBranches(Array.isArray(brData) ? brData : []);
 setGodowns(Array.isArray(gData) ? gData : []);
 
 const safeGData = Array.isArray(gData) ? gData : [];
 if (safeGData.length > 0) {
 setForm(f => ({ ...f, srcGodown: safeGData[0].id, destGodown: safeGData[safeGData.length > 1 ? 1 : 0].id, placeOfSupply: safeGData[0].id }));
 }
 
 const safeInvData = Array.isArray(invData) ? invData : [];
 const safePurData = Array.isArray(purData) ? purData : [];
 const safeSjData = Array.isArray(sjData) ? sjData : [];
 const safePsData = Array.isArray(psData) ? psData : [];
 const safeStData = Array.isArray(stData) ? stData : [];

 const allVouchers = [
 ...safeInvData.map(i => ({ ...i, no: i.invoiceNumber || 'N/A', amount: Number(i.netAmount) || 0, type: 'Sales' })),
 ...safePurData.map(p => ({ ...p, no: p.invoiceNo || 'N/A', amount: Number(p.totalAmount) || 0, type: 'Purchase' })),
 ...safeSjData.map(s => ({ ...s, amount: 0, type: 'Stock Journal' })),
 ...safePsData.map(p => ({ ...p, amount: 0, type: 'Physical Stock' })),
 ...safeStData.map(t => ({ ...t, no: t.transferNo || 'N/A', amount: 0, type: 'Stock Transfer' }))
 ];
 setVouchers(allVouchers);
 } catch (err) {
 console.error('Error loading inventory data:', err);
 } finally {
 setLoading(false);
 }
 }, []);

 useEffect(() => {
 loadData();
 }, [loadData]);

 const PROD_DATA = products;

 const columns: ColumnDef<any>[] = useMemo(() => {
 const cols: (ColumnDef<any> & { hidden?: boolean })[] = [
 { key: 'item', header: 'Item Name', type: 'select', options: products.map(p => ({ value: p.name, label: p.name })) },
 { key: 'godown', header: 'Godown', type: 'select', width: '120px', options: godowns.length > 0 ? godowns.map(g => ({value: g.id, label: g.name})) : [
 {value: 'Main', label: 'Main'},{value: 'Cold', label: 'Cold'}
 ]},
 { key: 'batch', header: 'Batch', type: 'text', width: '100px' },
 { key: 'qty', header: voucherType === 'Physical Stock' ? 'System Qty' : 'Qty', type: 'number', align: 'right', width: '80px' },
 { key: 'freeQty', header: 'Free', type: 'number', align: 'right', width: '60px', hidden: !['Sales', 'Purchase'].includes(voucherType) },
 { key: 'physicalQty', header: 'Physical Qty', type: 'number', align: 'right', width: '90px', hidden: voucherType !== 'Physical Stock' },
 { key: 'rate', header: 'Rate/UOM', type: 'number', align: 'right', width: '80px', hidden: ['Stock Journal', 'Physical Stock'].includes(voucherType) },
 { key: 'discount', header: 'Disc %', type: 'number', align: 'right', width: '80px', hidden: ['Stock Journal', 'Physical Stock'].includes(voucherType) },
 { key: 'gstRate', header: 'GST %', type: 'select', width: '80px', options: [
 {value: '0', label: '0%'},{value: '5', label: '5%'},{value: '12', label: '12%'},{value: '18', label: '18%'}
 ], hidden: ['Stock Journal', 'Physical Stock'].includes(voucherType) },
 { key: 'amount', header: 'Amount (₹)', type: 'number', align: 'right', width: '120px', hidden: ['Stock Journal', 'Physical Stock'].includes(voucherType) }
 ];
 return cols.filter(c => !c.hidden);
 }, [voucherType]);

 // Auto-GST and calculations
 const calculateTotals = () => {
 let subtotal = 0;
 let totalGst = 0;
 items.forEach(it => {
 subtotal += it.amount || 0;
 totalGst += (it.amount || 0) * ((Number(it.gstRate) || 0) / 100);
 });
 
 let grandTotal = subtotal + totalGst;
 let roundOff = Math.round(grandTotal) - grandTotal;
 grandTotal = Math.round(grandTotal);

 return { subtotal, totalGst, roundOff, grandTotal };
 };

 const totals = calculateTotals();

 const handleExport = () => {
 const rows = vouchers.map(v => ({
 'Date': v.date,
 'Voucher No': v.no,
 'Type': v.type,
 'Party': v.party,
 'Amount (₹)': v.amount
 }));
 const ws = utils.aoa_to_sheet([[]]);
 addExcelBranding(ws, 'Inventory Vouchers Register', company);
 utils.sheet_add_json(ws, rows, { origin: 'A6' });
 const wb = utils.book_new();
 utils.book_append_sheet(wb, ws, 'Vouchers');
 writeFile(wb, `Inventory_Vouchers_${ts()}.xlsx`);
 };

 const handlePrintList = () => {
 const rows = vouchers.map(v => `<tr>
 <td>${v.date}</td><td><b>${v.no}</b></td><td>${v.type}</td><td>${v.party || 'N/A'}</td><td class="text-right">₹${Number(v.amount || 0).toLocaleString()}</td>
 </tr>`).join('');
 printReport('Inventory Vouchers Register', `<table><thead><tr><th>Date</th><th>Voucher No</th><th>Type</th><th>Party</th><th class="text-right">Amount</th></tr></thead><tbody>${rows}</tbody></table>`, company);
 };

 if (view === 'FORM') {
 return (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col h-full overflow-hidden">
 <div className={`text-white px-4 py-2 flex justify-between items-center shrink-0 ${voucherType === 'Sales' ? 'bg-[#1D3557]' : voucherType === 'Purchase' ? 'bg-emerald-700' : 'bg-slate-700'}`}>
 <h3 className="font-bold tracking-wider text-sm flex items-center gap-2">
 <FileText size={16}/> {voucherType} Voucher
 </h3>
 <button onClick={() => setView('LIST')} className="text-white/70 hover:text-white uppercase text-xs font-bold px-2">Close (Esc)</button>
 </div>
 
 <div className="flex-1 overflow-auto p-4 bg-slate-50 flex flex-col gap-4">
 {/* Header / Party Selection (Desktop Mode style) */}
 <div className="bg-white p-3 rounded border border-slate-200 shadow-sm shrink-0 grid grid-cols-12 gap-4 items-end">
 <div className="col-span-2">
 <label className="block text-[10px] font-bold text-slate-500 uppercase">Voucher No.</label>
 <input value={form.no} onChange={e => setForm({...form, no: e.target.value})} className="w-full text-sm font-bold border-b border-slate-300 p-1 outline-none text-red-700"/>
 </div>
 <div className="col-span-2">
 <label className="block text-[10px] font-bold text-slate-500 uppercase">Date</label>
 <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full text-sm font-bold border-b border-slate-300 p-1 outline-none"/>
 </div>
 <div className="col-span-4">
 <label className="block text-[10px] font-bold text-slate-500 uppercase">{['Stock Journal', 'Physical Stock'].includes(voucherType) ? 'Transfer/Adjustment Note' : 'Party A/c Name (Sundry Debtor/Creditor)'}</label>
 {voucherType === 'Stock Journal' ? (
 <div className="flex gap-2">
 <select value={form.srcGodown} onChange={e => setForm({...form, srcGodown: e.target.value})} className="flex-1 text-sm font-bold border-b border-slate-300 p-1 bg-red-50 outline-none uppercase">
 {godowns.length > 0 ? godowns.map(g => <option key={g.id} value={g.id}>{g.name}</option>) : <><option>Main Godown</option><option>Cold Storage</option></>}
 </select>
 <span className="text-slate-400 self-center">➔</span>
 <select value={form.destGodown} onChange={e => setForm({...form, destGodown: e.target.value})} className="flex-1 text-sm font-bold border-b border-slate-300 p-1 bg-green-50 outline-none uppercase">
 {godowns.length > 0 ? godowns.map(g => <option key={g.id} value={g.id}>{g.name}</option>) : <><option>Main Godown</option><option>Cold Storage</option></>}
 </select>
 </div>
 ) : voucherType === 'Stock Transfer' ? (
 <div className="flex gap-2">
 <select value={form.sourceBranch} onChange={e => setForm({...form, sourceBranch: e.target.value})} className="flex-1 text-sm font-bold border-b border-slate-300 p-1 bg-red-50 outline-none uppercase">
 {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
 </select>
 <span className="text-slate-400 self-center">➔</span>
 <select value={form.destBranch} onChange={e => setForm({...form, destBranch: e.target.value})} className="flex-1 text-sm font-bold border-b border-slate-300 p-1 bg-green-50 outline-none uppercase">
 {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
 </select>
 </div>
 ) : (
 <select value={form.party} onChange={e => setForm({...form, party: e.target.value})} className="w-full text-sm font-bold border-b border-slate-300 p-1 bg-yellow-50 outline-none text-[#1D3557]">
 <option>Apollo Hospitals</option>
 <option>Cash Account</option>
 <option>MedPlus Pharmacy</option>
 </select>
 )}
 </div>
 <div className="col-span-4">
 <label className="block text-[10px] font-bold text-slate-500 uppercase">{voucherType === 'Physical Stock' ? 'Verified By' : 'Place of Supply'}</label>
 <input value={form.placeOfSupply} onChange={e => setForm({...form, placeOfSupply: e.target.value})} className="w-full text-sm font-bold border-b border-slate-300 p-1 outline-none"/>
 </div>
 </div>

 {/* Inventory Grid with Auto-Calc and Sidebar */}
 <div className="bg-white border flex-1 border-slate-200 shadow-sm flex flex-col min-h-[300px]">
 <div className="bg-[#E4ECEF] px-3 py-1.5 border-b border-slate-300 text-xs font-bold text-slate-700 uppercase tracking-widest">
 Godown / Batch-wise Allocation Grid
 </div>
 <div className="flex-1 flex overflow-hidden">
 <div className="flex-1 overflow-auto border-r border-slate-200">
 <DenseGrid 
 columns={columns}
 data={items}
 onChange={(rIdx, col, val) => {
 const newI = [...items];
 (newI[rIdx] as any)[col] = val;
 
 if (col === 'item') {
 const p = PROD_DATA.find(pd => pd.name === val);
 setSelectedItem(p);
 if (p) {
 newI[rIdx].rate = (p.mrp || 0) * 0.8; // Default to 80% of MRP
 newI[rIdx].gstRate = 12;
 }
 }

 // Scheme Auto-Apply!
 if (col === 'qty' || col === 'item') {
 const p = PROD_DATA.find(pd => pd.name === newI[rIdx].item);
 if (p && p.scheme && p.scheme.includes('+')) {
 const [buy, free] = p.scheme.split('+').map(Number);
 const q = Number(newI[rIdx].qty) || 0;
 newI[rIdx].freeQty = Math.floor(q / buy) * free;
 }
 }

 // Auto Line Calculations!
 if (['qty', 'rate', 'discount'].includes(col)) {
 const q = Number(newI[rIdx].qty) || 0;
 const r = Number(newI[rIdx].rate) || 0;
 const d = Number(newI[rIdx].discount) || 0;
 const gross = q * r;
 newI[rIdx].amount = Number((gross - (gross * d / 100)).toFixed(2));
 }
 
 setItems(newI);
 }}
 onAddRow={() => setItems([...items, { item: '', godown: 'Main', batch: '', qty: 0, freeQty: 0, rate: 0, discount: 0, gstRate: 12, amount: 0, physicalQty: 0 }])}
 onRemoveRow={(rIdx) => { const newI = [...items]; newI.splice(rIdx, 1); setItems(newI); }}
 />
 </div>

 {/* Live Inventory Sidebar */}
 {selectedItem && (
 <div className="w-64 bg-slate-50 p-4 border-l border-slate-200 overflow-auto animate-in slide-in-from-right-4 duration-300 shadow-inner">
 <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 border-b pb-2 flex items-center justify-between">
 <span>Live Batch Stock</span>
 <button onClick={() => setSelectedItem(null)} className="text-slate-400 hover:text-slate-600">×</button>
 </h4>
 <div className="space-y-3">
 {(selectedItem.batches || []).map((b: any) => {
 const isNearExpiry = new Date(b.expiry) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
 return (
 <div key={b.id} className={`p-2 rounded border bg-white shadow-sm transition-all hover:ring-2 hover:ring-blue-500/20 cursor-pointer ${isNearExpiry ? 'border-red-200' : 'border-slate-200'}`}>
 <div className="flex justify-between items-start mb-1">
 <span className="text-xs font-bold text-slate-700">{b.no}</span>
 <span className={`text-[10px] font-bold px-1 rounded ${isNearExpiry ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{b.stock} Left</span>
 </div>
 <div className="flex justify-between items-center">
 <span className="text-[10px] text-slate-500 font-medium uppercase tracking-tighter">Exp: {b.expiry}</span>
 {isNearExpiry && <AlertCircle size={10} className="text-red-500 animate-pulse"/>}
 </div>
 </div>
 );
 })}
 </div>
 
 <div className="mt-6 pt-4 border-t border-slate-200">
 <div className="text-[10px] font-bold text-purple-600 uppercase mb-2 text-center">Applied Scheme</div>
 <div className="bg-accent text-white rounded p-3 text-center text-sm font-bold shadow-none">
 {selectedItem.scheme || 'NO SCHEME'}
 </div>
 </div>

 <div className="mt-6 pt-4 border-t border-slate-200 font-mono text-[10px] space-y-2">
 <div className="flex justify-between"><span>MRP:</span> <span className="text-slate-900 font-bold">₹{(selectedItem.mrp || 0).toFixed(2)}</span></div>
 <div className="flex justify-between"><span>PUR:</span> <span className="text-slate-900 font-bold">₹{(selectedItem.purchaseRate || 0).toFixed(2)}</span></div>
 <div className="flex justify-between mt-2 pt-2 border-t border-slate-100 font-bold text-accent text-xs">
 <span>MAX PROFIT:</span> 
 <span>₹{((selectedItem.mrp || 0) - (selectedItem.purchaseRate || 0)).toFixed(2)}</span>
 </div>
 </div>
 </div>
 )}
 </div>

 {/* Auto-GST Calculation Engine Footers */}
 {['Sales', 'Purchase'].includes(voucherType) ? (
 <div className="flex flex-col bg-white border-t border-slate-300 text-xs text-slate-800">
 <div className="flex justify-between items-center p-2 border-b">
 <div className="flex items-center gap-2 text-slate-500">
 <Calculator size={14}/> <span>Auto-Calculating Tax (CGST + SGST)</span>
 </div>
 <div className="flex items-center gap-4 text-sm font-bold">
 <span className="text-slate-500">Taxable Subtotal:</span>
 <span className="text-[#1D3557] w-32 text-right">₹ {totals.subtotal.toFixed(2)}</span>
 </div>
 </div>
 <div className="flex justify-end p-2 border-b">
 <div className="flex flex-col gap-1 text-sm font-bold text-slate-600">
 <div className="flex justify-between w-64">
 <span>Add: Tax (GST/IGST)</span>
 <span className="text-right">₹ {totals.totalGst.toFixed(2)}</span>
 </div>
 <div className="flex justify-between w-64 text-slate-400 border-b pb-1">
 <span>Round Off</span>
 <span className="text-right">{totals.roundOff > 0 ? '+' : ''}{totals.roundOff.toFixed(2)}</span>
 </div>
 <div className="flex justify-between w-64 text-base text-[#1D3557] pt-1">
 <span>Grand Total</span>
 <span className="text-right">₹ {totals.grandTotal.toFixed(2)}</span>
 </div>
 </div>
 </div>
 </div>
 ) : (
 <div className="bg-slate-50 p-3 italic text-xs text-slate-500 flex justify-between items-center shadow-inner font-medium">
 <span>{voucherType === 'Stock Journal' ? 'Items will be moved from Source to Destination godown upon saving.' : 'Physical stock differences will be adjusted in the ledger.'}</span>
 <span className="font-bold">Total Items: {items.length}</span>
 </div>
 )}
 </div>
 
 <div className="bg-white p-2 rounded border border-slate-200 shadow-sm shrink-0">
 <label className="block text-[10px] font-bold text-slate-500 uppercase">Narration / Remarks</label>
 <input className="w-full text-sm font-bold border-b border-slate-300 p-1 outline-none italic text-slate-600" placeholder="Being goods sold..."/>
 </div>
 </div>
 
 <div className="bg-slate-100 p-3 border-t border-slate-300 flex justify-end gap-3 shrink-0">
 <button onClick={() => setView('LIST')} className="px-6 py-1.5 text-sm font-bold text-slate-600 border border-slate-400 rounded bg-white hover:bg-slate-50">Cancel</button>
 <button 
 onClick={() => {
 const rows = items.map(it => `<tr><td>${it.item}</td><td>${it.godown}</td><td>${it.batch}</td><td class="text-right">${it.qty}</td><td class="text-right">₹${it.rate}</td><td class="text-right">₹${it.amount}</td></tr>`).join('');
 printReport(`${voucherType} Voucher - ${form.no}`, `
 <div style="margin-bottom:20px">
 <b>${voucherType === 'Stock Transfer' ? 'Source Branch' : 'Party'}:</b> ${voucherType === 'Stock Transfer' ? (branches.find(b => b.id === form.sourceBranch)?.name || form.sourceBranch) : form.party}<br/>
 ${voucherType === 'Stock Transfer' ? `<b>Destination Branch:</b> ${branches.find(b => b.id === form.destBranch)?.name || form.destBranch}<br/>` : ''}
 <b>Date:</b> ${form.date}<br/>
 <b>${voucherType === 'Physical Stock' ? 'Verified By' : 'Place of Supply'}:</b> ${form.placeOfSupply}
 </div>
 <table><thead><tr><th>Item</th><th>Godown</th><th>Batch</th><th class="text-right">Qty</th><th class="text-right">Rate</th><th class="text-right">Amount</th></tr></thead>
 <tbody>${rows}</tbody></table>
 <div style="margin-top:20px;text-align:right">
 <b>Subtotal:</b> ₹${totals.subtotal.toFixed(2)}<br/>
 <b>Tax:</b> ₹${totals.totalGst.toFixed(2)}<br/>
 <h3 style="margin-top:5px">Grand Total: ₹${totals.grandTotal.toFixed(2)}</h3>
 </div>
 `, company);
 }}
 className="px-4 py-1.5 text-sm font-bold text-slate-600 border border-slate-400 rounded bg-white hover:bg-slate-50 flex items-center gap-2"
 >
 <Printer size={14}/> Print
 </button>
 <button 
 onClick={async () => {
 try {
 const db = await import('../services/databaseService');
 const commonData = {
 ...form,
 id: `${voucherType}-${Date.now()}`,
 items: items.map(i => {
 const product = products.find(p => p.name === i.item);
 const bObj = product?.batches?.find((b: any) => b.no === i.batch || b.batch_number === i.batch || b.id === i.batch);
 return { 
 ...i, 
 productName: i.item, 
 productId: product?.id || i.item,
 batchId: bObj?.id || bObj?.batch_id || null
 };
 })
 };

 if (voucherType === 'Sales') {
 await db.saveInvoice({
 ...commonData,
 invoiceNumber: form.no,
 totalItems: items.length,
 totalQuantity: items.reduce((s,i) => s + (i.qty || 0), 0),
 subTotal: totals.subtotal,
 totalGst: totals.totalGst,
 netAmount: totals.grandTotal
 } as any);
 } else if (voucherType === 'Purchase') {
 await db.savePurchase({
 ...commonData,
 invoiceNo: form.no,
 totalAmount: totals.grandTotal
 } as any);
 } else if (voucherType === 'Stock Journal') {
 await db.saveStockJournal(commonData);
 } else if (voucherType === 'Physical Stock') {
 await db.savePhysicalStock(commonData);
 } else if (voucherType === 'Stock Transfer') {
 await db.saveStockTransfer({
 ...commonData,
 transferNo: form.no,
 sourceBranchId: form.sourceBranch,
 sourceBranchName: branches.find(b => b.id === form.sourceBranch)?.name || 'N/A',
 destBranchId: form.destBranch,
 destBranchName: branches.find(b => b.id === form.destBranch)?.name || 'N/A',
 totalItems: items.length,
 totalQuantity: items.reduce((s,i) => s + (i.qty || 0), 0),
 status: 'In Transit'
 } as any);
 }

 alert(`${voucherType} saved successfully!`);
 setView('LIST');
 loadData();
 } catch (err) {
 console.error('Save failed:', err);
 alert('Failed to save voucher');
 }
 }} 
 className={`px-6 py-1.5 text-sm font-bold text-white rounded flex items-center gap-2 shadow-sm ${voucherType === 'Sales' ? 'bg-[#1D3557] hover:bg-[#2A4B7C]' : voucherType === 'Purchase' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-600 hover:bg-slate-700'}`}
 >
 <Save size={14}/> Save {voucherType}
 </button>
 </div>
 </div>
 );
 }

 return (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col h-full overflow-hidden">
 <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
 <div>
 <h3 className="text-lg font-bold text-slate-800 tracking-tight">Inventory Vouchers</h3>
 <p className="text-xs text-slate-500 font-medium">Record Sales, Purchases, Stock Journal, and Physical Stock</p>
 </div>
 <div className="flex gap-2">
 <button onClick={handlePrintList} className="flex items-center gap-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded text-sm font-bold shadow-sm"><Printer size={16} /> Print</button>
 <button onClick={handleExport} className="flex items-center gap-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded text-sm font-bold shadow-sm"><Download size={16} /> Export</button>
 <button onClick={() => { setVoucherType('Physical Stock'); setView('FORM'); }} className="flex items-center gap-1 bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded text-sm font-bold shadow-sm transition-colors">
 <Plus size={16} /> Physical Stock
 </button>
 <button onClick={() => { setVoucherType('Stock Journal'); setView('FORM'); }} className="flex items-center gap-1 bg-slate-600 hover:bg-slate-700 text-white px-3 py-1.5 rounded text-sm font-bold shadow-sm transition-colors">
 <Plus size={16} /> Stock Journal (F7)
 </button>
 <button onClick={() => { setVoucherType('Purchase'); setView('FORM'); }} className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-sm font-bold shadow-sm transition-colors">
 <Plus size={16} /> Purchase (F9)
 </button>
 <button onClick={() => { setVoucherType('Stock Transfer'); setView('FORM'); }} className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded text-sm font-bold shadow-sm transition-colors">
 <Plus size={16} /> Stock Transfer (F10)
 </button>
 <button onClick={() => { setVoucherType('Sales'); setView('FORM'); }} className="flex items-center gap-1 bg-[#1D3557] hover:bg-[#2A4B7C] text-white px-3 py-1.5 rounded text-sm font-bold shadow-sm transition-colors">
 <Plus size={16} /> Sales (F8)
 </button>
 </div>
 </div>

 <div className="flex-1 overflow-auto">
 <table className="w-full text-left border-collapse text-sm">
 <thead className="bg-[#E4ECEF] sticky top-0 border-b border-slate-300 shadow-sm text-xs uppercase tracking-wider text-slate-600">
 <tr>
 <th className="p-3 font-bold border-r border-white/50 w-32">Date</th>
 <th className="p-3 font-bold border-r border-white/50 w-32">Voucher No</th>
 <th className="p-3 font-bold border-r border-white/50 w-24">Type</th>
 <th className="p-3 font-bold border-r border-white/50">Party A/c</th>
 <th className="p-3 font-bold text-right">Amount (₹)</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {vouchers.map(v => (
 <tr key={v.id} className="hover:bg-blue-50/50 cursor-pointer text-slate-700" onClick={() => setView('FORM')}>
 <td className="p-3 border-r border-slate-100">{v.date}</td>
 <td className="p-3 border-r border-slate-100 font-bold text-red-700">{v.no}</td>
 <td className="p-3 border-r border-slate-100 font-bold text-xs">{v.type}</td>
 <td className="p-3 border-r border-slate-100 font-bold text-[#1D3557]">{v.party}</td>
 <td className="p-3 text-right font-bold text-slate-800">₹ {Number(v.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 );
};


