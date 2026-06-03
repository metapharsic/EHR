import React, { useState, useEffect, useCallback } from 'react';
import { Download, Search, ChevronRight, ChevronDown, Package, Layers, RefreshCw, Printer, AlertCircle } from 'lucide-react';
import { StockSummaryService } from '../services/accountingService';
import { utils, writeFile } from 'xlsx';
import { printReport, addExcelBranding } from '../utils/accountingExport';
import { useCompany } from '../context/CompanyContext';
import { formatNumber, formatCurrency } from '../utils/formatters';

const DEMO_INVENTORY = [
 { name: 'Medicines', qty: 15500, uom: '', rate: 0, value: 1250000, category: 'General', children: [
 { name: 'Antibiotics', qty: 5000, uom: 'Box', rate: 100, value: 500000, children: [
 { name: 'Amoxicillin 250mg', qty: 3000, uom: 'Box', rate: 100, value: 300000, reorderLevel: 5000 },
 { name: 'Ciprofloxacin 500mg', qty: 2000, uom: 'Box', rate: 100, value: 200000, reorderLevel: 1000 }
 ]},
 { name: 'Painkillers', qty: 10500, uom: 'Strip', rate: 0, value: 750000, children: [
 { name: 'Paracetamol 500mg', qty: 10000, uom: 'Strip', rate: 50, value: 500000, reorderLevel: 2000 },
 { name: 'Ibuprofen 400mg', qty: 500, uom: 'Strip', rate: 500, value: 250000, reorderLevel: 1000 }
 ]}
 ]},
 { name: 'Surgicals', qty: 5000, uom: 'Nos', rate: 50, value: 250000, children: [
 { name: 'Syringe 5ml', qty: 4000, uom: 'Nos', rate: 10, value: 40000, reorderLevel: 1000 },
 { name: 'Surgical Gloves', qty: 1000, uom: 'Nos', rate: 210, value: 210000, reorderLevel: 2000 }
 ]}
];

function flattenForExport(nodes: any[], depth = 0): any[] {
 const rows: any[] = [];
 for (const n of nodes) {
 rows.push({
 'Level': depth,
 'Group / Item': ' '.repeat(depth) + n.name,
 'Closing Qty': n.qty,
 'UOM': n.uom,
 'Rate (₹)': n.rate || '',
 'Value (₹)': n.value
 });
 if (n.children) rows.push(...flattenForExport(n.children, depth + 1));
 }
 return rows;
}

export const StockSummary: React.FC = () => {
 const { company } = useCompany();
 const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({ 'Medicines': true, 'Surgicals': true });
 const [valuationMethod, setValuationMethod] = useState('FIFO');
 const [inventory, setInventory] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [usingDemo, setUsingDemo] = useState(false);

 const loadStock = useCallback(async () => {
 setLoading(true);
 try {
 const data = await StockSummaryService.getSummary(valuationMethod);
 setInventory(Array.isArray(data) ? data : []);
 setUsingDemo(false);
 } catch {
 setInventory(DEMO_INVENTORY);
 setUsingDemo(true);
 } finally { setLoading(false); }
 }, [valuationMethod]);

 useEffect(() => { loadStock(); }, [loadStock]);

 const toggleNode = (name: string) => setExpandedNodes(prev => ({ ...prev, [name]: !prev[name] }));

 const totalValue = inventory.reduce((s, n) => s + (n.value || 0), 0);
 const totalQty = inventory.reduce((s, n) => s + (n.qty || 0), 0);

 const handleExport = () => {
 const rows = flattenForExport(inventory);
 rows.push({ 'Level': 0, 'Group / Item': 'GRAND TOTAL', 'Closing Qty': totalQty, 'UOM': '', 'Rate (₹)': '', 'Value (₹)': totalValue });
 const ws = utils.aoa_to_sheet([[]]);
 addExcelBranding(ws, `Stock Summary (Valuation: ${valuationMethod})`, company);
 utils.sheet_add_json(ws, rows, { origin: 'A6' });
 ws['!cols'] = [{ wch: 5 }, { wch: 35 }, { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 16 }];
 const wb = utils.book_new();
 utils.book_append_sheet(wb, ws, 'Stock Summary');
 writeFile(wb, `Stock_Summary_${valuationMethod}_${new Date().toISOString().slice(0, 10)}.xlsx`);
 };

 const handlePrint = () => {
 const rows = flattenForExport(inventory).map(r => `<tr>
 <td style="padding-left: ${r.Level * 20}px">${r.Level > 0 ? '↳ ' : ''}${r['Group / Item']}</td>
 <td class="text-right">${r['Closing Qty'].toLocaleString()} ${r.UOM}</td>
 <td class="text-right">${r['Rate (₹)'] ? `₹${r['Rate (₹)'].toLocaleString()}` : '-'}</td>
 <td class="text-right font-bold">₹${r['Value (₹)'].toLocaleString()}</td>
 </tr>`).join('');
 printReport(`Stock Summary (Valuation: ${valuationMethod})`, `<table><thead><tr><th>Group / Item</th><th class="text-right">Closing Qty</th><th class="text-right">Rate</th><th class="text-right">Value</th></tr></thead><tbody>${rows}
 <tr class="total-row"><td>GRAND TOTAL</td><td class="text-right">${totalQty.toLocaleString()}</td><td></td><td class="text-right">₹${totalValue.toLocaleString('en-IN',{minimumFractionDigits:2})}</td></tr>
 </tbody></table>`, company);
 };

 const TreeNode: React.FC<{ data: any; depth?: number }> = ({ data, depth = 0 }) => {
 const isExpanded = expandedNodes[data.name];
 const hasChildren = data.children?.length > 0;
 return (
 <div className="flex flex-col">
 <div
 className={`flex items-center justify-between p-2 border-b border-slate-100 hover:bg-emerald-50 cursor-pointer ${depth === 0 ? 'font-bold text-[#1D3557] bg-slate-50' : depth === 1 ? 'font-bold text-slate-700' : 'text-slate-600 text-sm'}`}
 style={{ paddingLeft: `${depth * 20 + 12}px` }}
 onClick={() => hasChildren ? toggleNode(data.name) : undefined}
 >
 <div className="flex items-center gap-2">
 {hasChildren ? (isExpanded ? <ChevronDown size={15} className="text-slate-400"/> : <ChevronRight size={15} className="text-slate-400"/>) : <div className="w-4"/>}
 {hasChildren ? <Layers size={15} className="text-emerald-600"/> : <Package size={15} className="text-slate-400"/>}
 <span className="flex items-center gap-2">
 {data.name}
 {data.reorderLevel > 0 && data.qty < data.reorderLevel && (
 <span className="flex items-center gap-1 text-[9px] bg-red-100 text-red-600 px-1.5 rounded-full font-bold animate-pulse">
 <AlertCircle size={10}/> REORDER
 </span>
 )}
 </span>
 </div>
 <div className="flex text-right tabular-nums w-1/2 justify-end gap-8">
 <div className="w-32"><span className="font-bold">{formatNumber(data.qty)}</span> {data.uom}</div>
 <div className="w-24 text-slate-500">{data.rate > 0 ? `₹${data.rate.toFixed(2)}` : ''}</div>
 <div className="w-36 font-bold text-slate-800">{formatCurrency(data.value)}</div>
 </div>
 </div>
 {isExpanded && hasChildren && (
 <div className="flex flex-col border-l-2 border-slate-200 ml-5">
 {data.children.map((child: any) => <TreeNode key={child.name} data={child} depth={depth + 1}/>)}
 <div className="flex justify-between items-center p-2 text-xs font-bold text-slate-500 border-t border-slate-200 bg-slate-50" style={{ paddingLeft: `${(depth + 1) * 20 + 12}px` }}>
 <span>Total {data.name}:</span>
 <div className="flex text-right tabular-nums w-1/2 justify-end gap-8">
 <div className="w-32">{formatNumber(data.qty)} {data.uom}</div>
 <div className="w-24"></div>
 <div className="w-36">{formatCurrency(data.value)}</div>
 </div>
 </div>
 </div>
 )}
 </div>
 );
 };

 return (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col h-full overflow-hidden">
 <div className="p-4 border-b border-slate-200 bg-slate-50 shrink-0 flex justify-between items-center">
 <div>
 <h3 className="text-lg font-bold text-[#1D3557] tracking-tight">Stock Summary</h3>
 <p className="text-xs text-slate-500">Real-time inventory valuation and quantities {usingDemo && '(demo data — API unavailable)'}</p>
 </div>
 <div className="flex gap-3 items-center">
 <div className="flex items-center gap-2">
 <span className="text-xs font-bold text-slate-500">Valuation:</span>
 <select value={valuationMethod} onChange={e => setValuationMethod(e.target.value)} className="border border-slate-300 rounded px-2 py-1.5 text-sm font-bold bg-white text-[#1D3557] outline-none shadow-sm">
 <option value="FIFO">FIFO</option>
 <option value="LIFO">LIFO</option>
 <option value="AvgCost">Weighted Average</option>
 <option value="StdCost">Standard Cost</option>
 </select>
 </div>
 <button onClick={() => setExpandedNodes({})} className="bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded text-sm font-bold shadow-sm">Collapse All</button>
 <button onClick={handlePrint} className="flex items-center gap-1 bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded text-sm font-bold shadow-sm"><Printer size={14}/> Print</button>
 <button onClick={handleExport} className="flex items-center gap-1 bg-[#1D3557] hover:bg-[#2A4B7C] text-white px-3 py-1.5 rounded text-sm font-bold shadow-sm"><Download size={14}/> Export Excel</button>
 </div>
 </div>

 <div className="flex-1 flex flex-col text-sm bg-white overflow-hidden">
 <div className="bg-[#1D3557] text-white px-4 py-3 font-bold flex justify-between uppercase tracking-widest text-xs shrink-0 shadow">
 <span>Particulars</span>
 <div className="flex w-1/2 justify-end gap-8 text-right">
 <span className="w-32">Closing Qty</span>
 <span className="w-24">Rate (₹)</span>
 <span className="w-36">Value (₹)</span>
 </div>
 </div>
 {loading ? (
 <div className="flex items-center justify-center flex-1 gap-2 text-slate-400 text-sm">
 <div className="animate-spin w-5 h-5 border-2 border-accent border-t-transparent rounded-full"/>Loading stock...
 </div>
 ) : (
 <div className="flex-1 overflow-auto bg-white pb-10">
 {inventory.map(node => <TreeNode key={node.name} data={node}/>)}
 </div>
 )}
 <div className="bg-[#1D3557] text-white px-4 py-3 font-bold flex justify-between uppercase tracking-widest text-sm shrink-0 shadow-inner">
 <span>Grand Total</span>
 <div className="flex w-1/2 justify-end gap-8 text-right">
 <span className="w-32">{totalQty.toLocaleString()}</span>
 <span className="w-24"></span>
 <span className="w-36">₹{totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
 </div>
 </div>
 </div>
 </div>
 );
};

