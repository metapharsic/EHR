import React, { useState, useEffect, useCallback } from 'react';
import { Search, FileText, Download, ChevronRight, Calculator, Printer, RefreshCw, AlertCircle } from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import { printReport, exportGSTReport } from '../utils/accountingExport';
import { GstService } from '../services/accountingService';

export const GstReports: React.FC = () => {
  const [reportType, setReportType] = useState<'GSTR-1' | 'GSTR-2' | 'GSTR-3B'>('GSTR-3B');
  const [drillDown, setDrillDown] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any[]>([]);
  const [period, setPeriod] = useState({ month: 4, year: 2025 }); // Default to April 2025 as requested
  const { company } = useCompany();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (reportType === 'GSTR-1') {
        const res = await GstService.getGstr1(period.month, period.year);
        setData(res.data || []);
      } else if (reportType === 'GSTR-2') {
        const res = await GstService.getGstr2(period.month, period.year, true); // true for recon
        setData(res.data || []);
      } else if (reportType === 'GSTR-3B') {
        const res = await GstService.getGstr3b(period.month, period.year);
        setSummary(res.data || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load report');
      // If API fails, we could potentially show mock data or empty state
      setData([]);
      setSummary([]);
    } finally {
      setLoading(false);
    }
  }, [reportType, period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const handlePrint = () => {
    let content = '';
    const title = `GST Report - ${reportType} (${monthNames[period.month-1]} ${period.year})`;
    
    if (reportType === 'GSTR-3B') {
      const rows = summary.map(r => `<tr><td>${r.id}</td><td>${r.desc}</td><td class="text-right">${r.igst.toLocaleString()}</td><td class="text-right">${r.cgst.toLocaleString()}</td><td class="text-right">${r.sgst.toLocaleString()}</td></tr>`).join('');
      content = `
        <table style="width:100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f1f5f9;">
              <th style="border: 1px solid #ddd; padding: 8px;">Sec</th>
              <th style="border: 1px solid #ddd; padding: 8px;">Description</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">IGST</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">CGST</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">SGST</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`;
    } else {
      const rows = data.map(v => `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">${v.invoiceDate}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${v.invoiceNo}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${v.partyName}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${(v.taxableValue || 0).toLocaleString()}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${(v.totalGst || 0).toLocaleString()}</td>
          ${reportType === 'GSTR-2' ? `<td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${v.status || 'N/A'}</td>` : ''}
        </tr>`).join('');
      
      content = `
        <table style="width:100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f1f5f9;">
              <th style="border: 1px solid #ddd; padding: 8px;">Date</th>
              <th style="border: 1px solid #ddd; padding: 8px;">Invoice No</th>
              <th style="border: 1px solid #ddd; padding: 8px;">Party</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Taxable Value</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">GST</th>
              ${reportType === 'GSTR-2' ? '<th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Status</th>' : ''}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`;
    }
    
    printReport(title, content, company);
  };

  const handleExport = () => {
    const exportData = reportType === 'GSTR-3B' ? summary : data;
    const type = reportType === 'GSTR-1' ? 'GSTR1' : reportType === 'GSTR-2' ? 'GSTR2' : 'GSTR3B';
    exportGSTReport(type, exportData, `${monthNames[period.month-1]} ${period.year}`, company);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
        <div>
          <h3 className="text-lg font-bold text-slate-800 tracking-tight">GST Compliance Reports</h3>
          <p className="text-xs text-slate-500 font-medium">Auto-generated GSTR-1, GSTR-2A/2B Recon, and GSTR-3B</p>
        </div>
        <div className="flex gap-2">
          <select 
            value={`${period.month}-${period.year}`}
            onChange={(e) => {
              const [m, y] = e.target.value.split('-');
              setPeriod({ month: parseInt(m), year: parseInt(y) });
            }}
            className="border border-slate-300 rounded px-3 py-1.5 text-sm font-bold bg-white text-slate-700 outline-none shadow-sm mr-2"
          >
            <option value="4-2025">April 2025</option>
            <option value="3-2025">March 2025</option>
            <option value="2-2025">February 2025</option>
            <option value="1-2025">January 2025</option>
          </select>
          <button 
            onClick={handlePrint}
            disabled={loading || (reportType === 'GSTR-3B' ? summary.length === 0 : data.length === 0)}
            className="flex items-center gap-1 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-slate-700 px-3 py-1.5 rounded text-sm font-bold shadow-sm"
          >
            <Printer size={16} /> Print
          </button>
          <button 
            onClick={handleExport}
            disabled={loading || (reportType === 'GSTR-3B' ? summary.length === 0 : data.length === 0)}
            className="flex items-center gap-1 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-[#1D3557] px-3 py-1.5 rounded text-sm font-bold shadow-sm transition-colors"
          >
            <Download size={16} /> Excel Export
          </button>
          <button 
            onClick={loadData}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
            title="Refresh Data"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex bg-[#1D3557] text-white shrink-0">
        <button onClick={() => { setReportType('GSTR-1'); setDrillDown(null); }} className={`flex-1 py-2 font-bold text-xs uppercase tracking-wider ${reportType === 'GSTR-1' ? 'bg-white text-[#1D3557]' : 'hover:bg-white/10'}`}>GSTR-1 (Outward)</button>
        <button onClick={() => { setReportType('GSTR-2'); setDrillDown(null); }} className={`flex-1 py-2 font-bold text-xs uppercase tracking-wider ${reportType === 'GSTR-2' ? 'bg-white text-[#1D3557]' : 'hover:bg-white/10'}`}>GSTR-2A/2B (Recon)</button>
        <button onClick={() => { setReportType('GSTR-3B'); setDrillDown(null); }} className={`flex-1 py-2 font-bold text-xs uppercase tracking-wider ${reportType === 'GSTR-3B' ? 'bg-accent text-white' : 'hover:bg-white/10'}`}>GSTR-3B (Summary)</button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto bg-slate-100 p-4">
        
        {loading && (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
            <RefreshCw size={40} className="animate-spin text-accent" />
            <p className="font-bold">Generating GST Report...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex items-center gap-3 text-red-700 max-w-2xl mx-auto">
            <AlertCircle size={20} />
            <p className="font-medium">{error}</p>
          </div>
        )}
        
        {!loading && !error && (
          <>
            {/* GSTR-3B Summary View */}
            {reportType === 'GSTR-3B' && (
              <div className="bg-white border border-slate-200 shadow-sm max-w-5xl mx-auto">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                  <h4 className="font-bold text-[#1D3557] flex items-center gap-2"><FileText size={18}/> Form GSTR-3B</h4>
                  <span className="text-xs font-bold text-slate-500 bg-white px-2 py-1 rounded border">Tax Period: {monthNames[period.month-1]} {period.year}</span>
                </div>
                
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-[#E4ECEF] border-b text-xs text-slate-700">
                    <tr>
                      <th className="p-3 font-bold border-r border-slate-300">Nature of Supplies / Details</th>
                      <th className="p-3 font-bold border-r border-slate-300 text-right w-32">Integrated Tax (₹)</th>
                      <th className="p-3 font-bold border-r border-slate-300 text-right w-32">Central Tax (₹)</th>
                      <th className="p-3 font-bold border-r border-slate-300 text-right w-32">State/UT Tax (₹)</th>
                      <th className="p-3 font-bold text-right w-32">Cess (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {summary.map(r => (
                      <tr key={r.id} className="hover:bg-blue-50/50 cursor-pointer group" onClick={() => {
                        if (r.id === '3.1.a') setReportType('GSTR-1');
                        else if (r.id === '4.A.5') setReportType('GSTR-2');
                      }}>
                        <td className="p-3 border-r border-slate-200">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-500 w-10">{r.id}</span>
                            <span className="font-semibold text-[#1D3557] group-hover:underline">{r.desc}</span>
                          </div>
                        </td>
                        <td className="p-3 border-r border-slate-200 text-right font-bold text-slate-700">{r.igst > 0 ? r.igst.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}</td>
                        <td className="p-3 border-r border-slate-200 text-right font-bold text-slate-700">{r.cgst > 0 ? r.cgst.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}</td>
                        <td className="p-3 border-r border-slate-200 text-right font-bold text-slate-700">{r.sgst > 0 ? r.sgst.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}</td>
                        <td className="p-3 text-right font-bold text-slate-700">{r.cess > 0 ? r.cess.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}</td>
                      </tr>
                    ))}
                    {summary.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400">No data found for this period.</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <div className="bg-green-50 p-4 border-t flex justify-between items-center text-green-800">
                  <div className="flex items-center gap-2 text-sm font-bold"><Calculator size={16}/> Auto-calculated from vouchers</div>
                  <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded text-sm font-bold shadow-sm">Mark as Return Ready</button>
                </div>
              </div>
            )}

            {/* GSTR-1 & GSTR-2 List View */}
            {(reportType === 'GSTR-1' || reportType === 'GSTR-2') && (
              <div className="bg-white border text-sm border-slate-200 shadow-sm flex flex-col h-full max-w-6xl mx-auto">
                <div className="p-3 border-b border-slate-200 bg-[#E4ECEF] flex justify-between items-center text-[#1D3557]">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setReportType('GSTR-3B')} className="font-bold hover:underline cursor-pointer">GST Reports</button>
                    <ChevronRight size={16}/>
                    <span className="font-bold">{reportType} Detail ({monthNames[period.month-1]} {period.year})</span>
                  </div>
                  <div className="text-xs font-bold text-slate-500">{data.length} Transactions Found</div>
                </div>
                
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 shadow-sm text-xs text-slate-600 uppercase">
                      <tr>
                        <th className="p-3 font-bold border-r border-slate-200">Date</th>
                        <th className="p-3 font-bold border-r border-slate-200">Voucher No</th>
                        <th className="p-3 font-bold border-r border-slate-200">{reportType === 'GSTR-1' ? 'Customer' : 'Supplier'} / GSTIN</th>
                        <th className="p-3 font-bold border-r border-slate-200 text-right">Taxable Val</th>
                        <th className="p-3 font-bold border-r border-slate-200 text-right">IGST</th>
                        <th className="p-3 font-bold border-r border-slate-200 text-right">CGST</th>
                        <th className="p-3 font-bold border-r border-slate-200 text-right">SGST</th>
                        {reportType === 'GSTR-2' && <th className="p-3 font-bold text-center">Status</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.map((v, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/50 cursor-pointer">
                          <td className="p-3 border-r border-slate-100">{v.invoiceDate}</td>
                          <td className="p-3 border-r border-slate-100 font-bold text-indigo-600 underline">{v.invoiceNo}</td>
                          <td className="p-3 border-r border-slate-100">
                            <div className="font-bold text-[#1D3557]">{v.partyName}</div>
                            <div className="text-[10px] text-slate-500">{v.partyGstin}</div>
                          </td>
                          <td className="p-3 border-r border-slate-100 text-right font-bold text-slate-800">₹ {v.taxableValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="p-3 border-r border-slate-100 text-right font-bold text-slate-800">{v.igst > 0 ? v.igst.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}</td>
                          <td className="p-3 border-r border-slate-100 text-right font-bold text-slate-800">{v.cgst > 0 ? v.cgst.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}</td>
                          <td className="p-3 border-r border-slate-100 text-right font-bold text-slate-800">{v.sgst > 0 ? v.sgst.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}</td>
                          {reportType === 'GSTR-2' && (
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                v.status === 'Matched' ? 'bg-green-100 text-green-700' :
                                v.status === 'Mismatched' ? 'bg-amber-100 text-amber-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {v.status || 'Unknown'}
                              </span>
                            </td>
                          )}
                        </tr>
                      ))}
                      {data.length === 0 && (
                        <tr>
                          <td colSpan={reportType === 'GSTR-2' ? 8 : 7} className="p-12 text-center text-slate-400">
                            <div className="flex flex-col items-center gap-2">
                              <Search size={32} />
                              <p>No transactions found for the selected period.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {data.length > 0 && (
                      <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-200">
                        <tr>
                          <td colSpan={3} className="p-3 text-right">Totals:</td>
                          <td className="p-3 text-right">₹ {data.reduce((s, v) => s + (v.taxableValue || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="p-3 text-right">₹ {data.reduce((s, v) => s + (v.igst || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="p-3 text-right">₹ {data.reduce((s, v) => s + (v.cgst || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="p-3 text-right">₹ {data.reduce((s, v) => s + (v.sgst || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          {reportType === 'GSTR-2' && <td className=""></td>}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
};
