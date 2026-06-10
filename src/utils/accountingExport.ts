/**
 * Accounting Export & Print Utilities
 * Provides real Excel export and print-ready HTML for all accounting modules.
 * Uses the xlsx library (SheetJS) for Excel generation.
 */
import { utils, writeFile } from 'xlsx';

export const ts = () => new Date().toISOString().replace('T', '_').slice(0, 16).replace(/:/g, '-');

// ─── Helper: auto-size columns ───────────────────────────────────────────────
function autoWidth(data: Record<string, any>[]): { wch: number }[] {
  if (!data.length) return [];
  return Object.keys(data[0]).map(k => ({
    wch: Math.max(k.length + 2, ...data.map(r => String(r[k] ?? '').length + 1))
  }));
}

// ─── Shared logo path (SVG — works in all modern browsers) ───────────────────
const LOGO_SRC = '/logo.svg';

// ─── Shared branded print header HTML ─────────────────────────────────────────
function buildPrintHeader(title: string, company?: any): string {
  const co = company || {};
  const generated = new Date().toLocaleString('en-IN');
  return `
    <!-- Branded Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;
      border-bottom:2.5px solid #1a56db;padding-bottom:12px;margin-bottom:20px">
      <!-- Logo + Company -->
      <div style="display:flex;align-items:center;gap:12px">
        <img src="${LOGO_SRC}" alt="Metapharsic" style="height:56px;width:56px;border-radius:50%;
          border:2px solid #e2e8f0"/>
        <div>
          <div style="font-size:18px;font-weight:900;color:#1e3a8a;letter-spacing:-0.5px">
            ${co.name || 'Metapharsic Lifesciences Pvt. Ltd.'}
          </div>
          <div style="font-size:9px;font-weight:600;color:#64748b;letter-spacing:2px;text-transform:uppercase">
            Lifesciences ERP System
          </div>
          ${co.address ? `<div style="font-size:9px;color:#94a3b8;margin-top:2px">
            ${co.address}${co.city ? ', ' + co.city : ''}${co.state ? ', ' + co.state : ''} ${co.pinCode || ''}
          </div>` : ''}
          ${co.gstin ? `<div style="font-size:9px;color:#1e3a8a;font-weight:700">GSTIN: ${co.gstin}${co.drugLicenseNo ? ' &nbsp;|&nbsp; DL: ' + co.drugLicenseNo : ''}</div>` : ''}
        </div>
      </div>
      <!-- Title block -->
      <div style="text-align:center;flex:1;padding:0 20px">
        <div style="font-size:17px;font-weight:900;color:#1e293b;text-transform:uppercase;
          letter-spacing:1px;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:4px">
          ${title}
        </div>
        ${co.phone ? `<div style="font-size:9px;color:#64748b">📞 ${co.phone}${co.email ? ' &nbsp;|&nbsp; ✉ ' + co.email : ''}</div>` : ''}
      </div>
      <!-- Meta -->
      <div style="text-align:right">
        <div style="font-size:10px;color:#475569;font-weight:600">📅 ${generated}</div>
        <div style="font-size:9px;border:1px solid #e2e8f0;border-radius:4px;
          padding:2px 8px;margin-top:4px;color:#94a3b8;display:inline-block">
          CONFIDENTIAL
        </div>
      </div>
    </div>`;
}

// ─── Shared print footer HTML ──────────────────────────────────────────────────
function buildPrintFooter(): string {
  return `
    <div style="margin-top:32px;border-top:1px dashed #e2e8f0;padding-top:10px;
      display:flex;align-items:center;justify-content:space-between;font-size:9px;color:#94a3b8">
      <div style="display:flex;align-items:center;gap:6px">
        <img src="${LOGO_SRC}" style="height:16px;opacity:0.5" alt=""/>
        <span>© 2026 Metapharsic Lifesciences Pvt. Ltd. — Confidential &amp; Internal Use Only</span>
      </div>
      <span>This is a computer-generated document. No signature required.</span>
    </div>`;
}

// ─── Helper: open a print window with styled HTML ────────────────────────────
export function printReport(title: string, html: string, company?: any) {
  const win = window.open('', '_blank', 'width=1100,height=780');
  if (!win) { alert('Please allow popups to print.'); return; }

  win.document.write(`<!DOCTYPE html><html><head>
    <title>${title} — Metapharsic ERP</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg"/>
    <style>
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .no-print { display: none !important; }
        @page { margin: 18mm 14mm; size: A4; }
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px;
             color: #1e293b; padding: 36px; position: relative; line-height: 1.5; }

      /* ── Watermark ── */
      .wm {
        position: fixed; top: 50%; left: 50%;
        transform: translate(-50%, -50%) rotate(-35deg);
        z-index: -1; pointer-events: none;
        display: flex; flex-direction: column; align-items: center;
        opacity: 0.05;
      }
      .wm img  { width: 220px; }
      .wm span { font-size: 26px; font-weight: 900; letter-spacing: 8px;
                 text-transform: uppercase; color: #1a56db;
                 font-family: 'Segoe UI', sans-serif; margin-top: 2px; }

      h1 { font-size: 18px; font-weight: 900; color: #1e3a8a; margin-bottom: 4px; }
      table { width: 100%; border-collapse: collapse; margin-top: 15px;
              border: 1px solid #e2e8f0; }
      th { background: #1e3a8a; color: #fff; padding: 9px 12px; text-align: left;
           font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;
           border: 1px solid #1e3a8a; }
      td { padding: 7px 12px; border: 1px solid #e2e8f0; font-size: 11px; }
      tr:nth-child(even) { background: #f8fafc; }
      .total-row td { font-weight: 900; background: #eff6ff;
                      border-top: 2px solid #1e3a8a; color: #0f172a; }
      .text-right  { text-align: right; }
      .text-center { text-align: center; }
      .badge       { padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; }
      .badge-green { background: #dcfce7; color: #166534; }
      .badge-blue  { background: #dbeafe; color: #1e40af; }
      .badge-red   { background: #fee2e2; color: #991b1b; }
    </style>
  </head><body>

    <!-- Watermark -->
    <div class="wm">
      <img src="${LOGO_SRC}" alt="Metapharsic"/>
      <span>Metapharsic</span>
    </div>

    ${buildPrintHeader(title, company)}
    <div class="content">${html}</div>
    ${buildPrintFooter()}

    <div class="no-print" style="position:fixed;bottom:20px;right:20px;display:flex;gap:8px">
      <button onclick="window.print()"
        style="padding:10px 20px;background:#1a56db;color:white;border:none;
               border-radius:8px;cursor:pointer;font-weight:700;font-size:13px;
               box-shadow:0 4px 12px rgba(26,86,219,0.3)">
        🖨️ Print / Save PDF
      </button>
    </div>
    <script>setTimeout(() => { window.print(); }, 900);</script>
  </body></html>`);
  win.document.close();
}

/**
 * Add branding to Excel sheet
 */
export function addExcelBranding(ws: any, title: string, company?: any) {
  const brandRows = [
    [company?.name || 'METAPHARSIC LIFESCIENCES PVT. LTD.'],
    [company ? `${company.address || ''}, ${company.city || ''}, ${company.state || ''}` : 'Lifesciences ERP System'],
    [company?.gstin ? `GSTIN: ${company.gstin}` : 'Confidential — Internal Use Only'],
    [title.toUpperCase()],
    [`Generated: ${new Date().toLocaleString('en-IN')} | © 2026 Metapharsic Lifesciences`],
    [] // empty row
  ];
  utils.sheet_add_aoa(ws, brandRows, { origin: 'A1' });
}

export function exportGeneralLedger(accountName: string, entries: any[], company?: any) {
  const rows = entries.map(e => ({
    'Date': e.date,
    'Voucher No': e.voucherNo,
    'Particulars': e.particulars,
    'Voucher Type': e.voucherType,
    'Narration': e.narration,
    'Debit (₹)': e.debit || 0,
    'Credit (₹)': e.credit || 0,
    'Balance (₹)': Math.abs(e.balance || 0),
    'Dr/Cr': (e.balance || 0) >= 0 ? 'Dr' : 'Cr'
  }));
  const ws = utils.aoa_to_sheet([[]]);
  addExcelBranding(ws, `General Ledger - ${accountName}`, company);
  utils.sheet_add_json(ws, rows, { origin: 'A6' });
  ws['!cols'] = autoWidth(rows);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'General Ledger');
  writeFile(wb, `General_Ledger_${accountName.replace(/\s+/g,'_')}_${ts()}.xlsx`);
}

export function printGeneralLedger(accountName: string, entries: any[], openingBal: number, company?: any) {
  const rows = entries.map(e => `<tr>
    <td>${e.date}</td><td>${e.voucherNo}</td><td>${e.particulars}</td><td>${e.voucherType}</td>
    <td class="text-right">${e.debit ? `₹${e.debit.toLocaleString()}` : '-'}</td>
    <td class="text-right">${e.credit ? `₹${e.credit.toLocaleString()}` : '-'}</td>
    <td class="text-right font-bold">₹${Math.abs(e.balance||0).toLocaleString()} ${(e.balance||0)>=0?'Dr':'Cr'}</td>
  </tr>`).join('');
  printReport(`General Ledger — ${accountName}`, `
    <table><thead><tr><th>Date</th><th>Voucher No</th><th>Particulars</th><th>Type</th><th class="text-right">Debit (₹)</th><th class="text-right">Credit (₹)</th><th class="text-right">Balance</th></tr></thead>
    <tbody><tr><td colspan="4"><b>Opening Balance</b></td><td></td><td></td><td class="text-right"><b>₹${Math.abs(openingBal).toLocaleString()} ${openingBal>=0?'Dr':'Cr'}</b></td></tr>
    ${rows}</tbody></table>`, company);
}

export function exportTrialBalance(periodLabel: string, accounts: any[], company?: any) {
  const rows = accounts.map(a => ({
    'Account Code': a.accountCode,
    'Account Name': a.accountName,
    'Account Group': a.accountGroup,
    'Opening Dr (₹)': a.openingDebit || 0,
    'Opening Cr (₹)': a.openingCredit || 0,
    'Period Dr (₹)': a.periodDebit || 0,
    'Period Cr (₹)': a.periodCredit || 0,
    'Closing Dr (₹)': a.closingDebit || 0,
    'Closing Cr (₹)': a.closingCredit || 0,
  }));
  const ws = utils.aoa_to_sheet([[]]);
  addExcelBranding(ws, `Trial Balance - ${periodLabel}`, company);
  utils.sheet_add_json(ws, rows, { origin: 'A6' });
  ws['!cols'] = autoWidth(rows);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Trial Balance');
  writeFile(wb, `Trial_Balance_${periodLabel.replace(/\s/g,'_')}_${ts()}.xlsx`);
}

export function printTrialBalance(periodLabel: string, accounts: any[], company?: any) {
  const rows = accounts.map(a => `<tr>
    <td>${a.accountCode}</td><td>${a.accountName}</td><td>${a.accountGroup}</td>
    <td class="text-right">${a.openingDebit ? `₹${a.openingDebit.toLocaleString()}` : '-'}</td>
    <td class="text-right">${a.openingCredit ? `₹${a.openingCredit.toLocaleString()}` : '-'}</td>
    <td class="text-right">${a.periodDebit ? `₹${a.periodDebit.toLocaleString()}` : '-'}</td>
    <td class="text-right">${a.periodCredit ? `₹${a.periodCredit.toLocaleString()}` : '-'}</td>
    <td class="text-right"><b>${a.closingDebit ? `₹${a.closingDebit.toLocaleString()}` : '-'}</b></td>
    <td class="text-right"><b>${a.closingCredit ? `₹${a.closingCredit.toLocaleString()}` : '-'}</b></td>
  </tr>`).join('');
  const totalDr = accounts.reduce((s, a) => s + (a.closingDebit || 0), 0);
  const totalCr = accounts.reduce((s, a) => s + (a.closingCredit || 0), 0);
  printReport(`Trial Balance — ${periodLabel}`, `
    <table><thead><tr><th>Code</th><th>Account</th><th>Group</th><th class="text-right">Op. Dr</th><th class="text-right">Op. Cr</th><th class="text-right">Pd. Dr</th><th class="text-right">Pd. Cr</th><th class="text-right">Cl. Dr</th><th class="text-right">Cl. Cr</th></tr></thead>
    <tbody>${rows}<tr class="total-row"><td colspan="7">TOTAL</td><td class="text-right">₹${totalDr.toLocaleString()}</td><td class="text-right">₹${totalCr.toLocaleString()}</td></tr></tbody></table>`, company);
}

export function exportJournalVouchers(vouchers: any[], company?: any) {
  const rows = vouchers.flatMap(v =>
    (v.entries || []).map((e: any) => ({
      'Voucher No': v.voucherNo || v.voucherNumber,
      'Date': v.date,
      'Reference': v.reference || v.referenceNumber || '',
      'Narration': v.narration,
      'Account Code': e.accountCode || e.accountId,
      'Account Name': e.accountName,
      'Cost Center': e.costCenter || '',
      'Debit (₹)': e.debit ?? e.debitAmount ?? 0,
      'Credit (₹)': e.credit ?? e.creditAmount ?? 0,
      'Status': v.status
    }))
  );
  const ws = utils.aoa_to_sheet([[]]);
  addExcelBranding(ws, 'Journal Vouchers Register', company);
  utils.sheet_add_json(ws, rows, { origin: 'A6' });
  ws['!cols'] = autoWidth(rows);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Journal Vouchers');
  writeFile(wb, `Journal_Vouchers_${ts()}.xlsx`);
}

export function printJournalVoucher(voucher: any, company?: any) {
  const entries = (voucher.entries || []).map((e: any) => `<tr>
    <td>${e.accountCode || ''} — ${e.accountName}</td>
    <td>${e.costCenter || '-'}</td>
    <td>${e.narration || e.lineNarration || ''}</td>
    <td class="text-right">${(e.debit || e.debitAmount) ? `₹${(e.debit || e.debitAmount).toLocaleString()}` : '-'}</td>
    <td class="text-right">${(e.credit || e.creditAmount) ? `₹${(e.credit || e.creditAmount).toLocaleString()}` : '-'}</td>
  </tr>`).join('');
  const totalDr = (voucher.entries || []).reduce((s: number, e: any) => s + (e.debit || e.debitAmount || 0), 0);
  const totalCr = (voucher.entries || []).reduce((s: number, e: any) => s + (e.credit || e.creditAmount || 0), 0);
  
  printReport(`Journal Voucher — ${voucher.voucherNo || voucher.voucherNumber}`, `
    <table style="margin-bottom:12px;width:auto">
      <tr><td style="padding:3px 12px 3px 0;color:#555">Voucher No:</td><td><b>${voucher.voucherNo || voucher.voucherNumber}</b></td></tr>
      <tr><td style="padding:3px 12px 3px 0;color:#555">Date:</td><td>${new Date(voucher.date).toLocaleDateString('en-IN')}</td></tr>
      <tr><td style="padding:3px 12px 3px 0;color:#555">Reference:</td><td>${voucher.reference || voucher.referenceNumber || 'N/A'}</td></tr>
      <tr><td style="padding:3px 12px 3px 0;color:#555">Narration:</td><td>${voucher.narration}</td></tr>
      <tr><td style="padding:3px 12px 3px 0;color:#555">Status:</td><td><span class="badge badge-blue">${voucher.status}</span></td></tr>
    </table>
    <table><thead><tr><th>Account</th><th>Cost Center</th><th>Line Narration</th><th class="text-right">Debit (₹)</th><th class="text-right">Credit (₹)</th></tr></thead>
    <tbody>${entries}<tr class="total-row"><td colspan="3">TOTAL</td><td class="text-right">₹${totalDr.toLocaleString()}</td><td class="text-right">₹${totalCr.toLocaleString()}</td></tr></tbody></table>`, company);
}

export function exportBudgetReport(budgets: any[], company?: any) {
  const rows = budgets.flatMap((b: any) =>
    (b.allocations || [{ accountName: b.name, costCenter: b.costCenter, budgetAmount: b.totalBudget, actualAmount: b.actualAmount }]).map((a: any) => ({
      'Budget Name': b.name || b.financialYear,
      'Financial Year': b.financialYear,
      'Account': a.accountName,
      'Cost Center': a.costCenter || '',
      'Budget Amt (₹)': a.budgetAmount || 0,
      'Actual Amt (₹)': a.actualAmount || 0,
      'Variance (₹)': (a.budgetAmount || 0) - (a.actualAmount || 0),
      'Variance %': a.budgetAmount > 0 ? (((a.budgetAmount - a.actualAmount) / a.budgetAmount) * 100).toFixed(1) + '%' : '0%',
      'Status': (a.actualAmount || 0) > (a.budgetAmount || 0) ? 'Over Budget' : 'Under Budget'
    }))
  );
  const ws = utils.aoa_to_sheet([[]]);
  addExcelBranding(ws, 'Budget Variance Report', company);
  utils.sheet_add_json(ws, rows, { origin: 'A6' });
  ws['!cols'] = autoWidth(rows);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Budget vs Actuals');
  writeFile(wb, `Budget_Variance_Report_${ts()}.xlsx`);
}

export function exportCostCenters(costCenters: any[], company?: any) {
  const rows = costCenters.map(cc => ({
    'Code': cc.costCenterCode,
    'Name': cc.costCenterName,
    'Category': cc.category,
    'Manager': cc.manager || '',
    'Annual Budget (₹)': cc.budget || 0,
    'Status': cc.isActive ? 'Active' : 'Inactive',
  }));
  const ws = utils.aoa_to_sheet([[]]);
  addExcelBranding(ws, 'Cost Center Master', company);
  utils.sheet_add_json(ws, rows, { origin: 'A6' });
  ws['!cols'] = autoWidth(rows);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Cost Centers');
  writeFile(wb, `Cost_Centers_${ts()}.xlsx`);
}

export function exportTDSRegister(entries: any[], period: string, company?: any) {
  const rows = entries.map(e => ({
    'Date': e.date,
    'Deductee': e.party,
    'PAN': e.pan,
    'Section': e.section,
    'Nature': e.nature,
    'TDS Rate %': e.tdsRate,
    'Gross Amount (₹)': e.grossAmount,
    'TDS Amount (₹)': e.tdsAmount,
    'Net Paid (₹)': e.netPaid,
    'Status': e.status,
    'Quarter': e.quarter
  }));
  const ws = utils.aoa_to_sheet([[]]);
  addExcelBranding(ws, `TDS Register (${period})`, company);
  utils.sheet_add_json(ws, rows, { origin: 'A6' });
  ws['!cols'] = autoWidth(rows);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'TDS Register');
  writeFile(wb, `TDS_Deduction_Register_${period.replace(/\s/g,'_')}_${ts()}.xlsx`);
}

export function printTDSRegister(entries: any[], period: string, company?: any) {
  const rows = entries.map(e => `<tr>
    <td>${e.date}</td><td><b>${e.party}</b></td><td style="font-family:monospace">${e.pan}</td>
    <td style="color:#1D3557;font-weight:900">${e.section}</td>
    <td class="text-right">${e.tdsRate}%</td>
    <td class="text-right">₹${e.grossAmount.toLocaleString()}</td>
    <td class="text-right" style="color:#b91c1c;font-weight:900">₹${e.tdsAmount.toLocaleString()}</td>
    <td class="text-right">₹${e.netPaid.toLocaleString()}</td>
    <td>${e.status}</td>
  </tr>`).join('');
  const totGross = entries.reduce((s, e) => s + (e.grossAmount || 0), 0);
  const totTDS = entries.reduce((s, e) => s + (e.tdsAmount || 0), 0);
  printReport(`TDS Deduction Register — ${period}`, `
    <table><thead><tr><th>Date</th><th>Deductee</th><th>PAN</th><th>Section</th><th class="text-right">Rate%</th><th class="text-right">Gross</th><th class="text-right">TDS</th><th class="text-right">Net Paid</th><th>Status</th></tr></thead>
    <tbody>${rows}<tr class="total-row"><td colspan="5">TOTAL</td><td class="text-right">₹${totGross.toLocaleString()}</td><td class="text-right">₹${totTDS.toLocaleString()}</td><td class="text-right">₹${(totGross-totTDS).toLocaleString()}</td><td></td></tr></tbody></table>`, company);
}

export function exportFixedAssets(assets: any[], company?: any) {
  const rows = assets.map(a => ({
    'Asset Code': a.assetCode,
    'Asset Name': a.assetName,
    'Category': a.category,
    'Purchase Date': a.purchaseDate,
    'Gross Block (₹)': a.grossBlock || a.purchaseCost || 0,
    'Acc. Depreciation (₹)': a.accumulatedDepreciation || 0,
    'Net Block (₹)': a.netBlock || 0,
    'Method': a.depreciationMethod,
    'Useful Life (Yrs)': a.usefulLife,
    'Salvage Value (₹)': a.salvageValue || 0,
    'Location': a.location || '',
    'Vendor': a.vendor || '',
    'Status': a.status
  }));
  const ws = utils.aoa_to_sheet([[]]);
  addExcelBranding(ws, 'Fixed Asset Register', company);
  utils.sheet_add_json(ws, rows, { origin: 'A6' });
  ws['!cols'] = autoWidth(rows);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Fixed Asset Register');
  writeFile(wb, `Fixed_Asset_Register_${ts()}.xlsx`);
}

export function printFixedAssets(assets: any[], company?: any) {
  const rows = assets.map(a => `<tr>
    <td style="font-family:monospace;font-weight:700">${a.assetCode}</td>
    <td><b>${a.assetName}</b><br/><span style="font-size:9px;color:#666">${a.category}</span></td>
    <td>${a.purchaseDate ? new Date(a.purchaseDate).toLocaleDateString('en-IN') : '-'}</td>
    <td class="text-right">₹${(a.grossBlock||a.purchaseCost||0).toLocaleString()}</td>
    <td class="text-right" style="color:#ea580c">₹${(a.accumulatedDepreciation||0).toLocaleString()}</td>
    <td class="text-right"><b>₹${(a.netBlock||0).toLocaleString()}</b></td>
    <td>${a.depreciationMethod?.includes('WDV') ? 'WDV' : 'SLM'}</td>
    <td>${a.status}</td>
  </tr>`).join('');
  const totalGross = assets.reduce((s, a) => s + (a.grossBlock || 0), 0);
  const totalAccDep = assets.reduce((s, a) => s + (a.accumulatedDepreciation || 0), 0);
  const totalNet = assets.reduce((s, a) => s + (a.netBlock || 0), 0);
  printReport('Fixed Asset Register', `
    <table><thead><tr><th>Code</th><th>Asset</th><th>Purchase Date</th><th class="text-right">Gross Block</th><th class="text-right">Acc. Depn</th><th class="text-right">Net Block</th><th>Method</th><th>Status</th></tr></thead>
    <tbody>${rows}<tr class="total-row"><td colspan="3">TOTAL (${assets.length} Assets)</td><td class="text-right">₹${totalGross.toLocaleString()}</td><td class="text-right">₹${totalAccDep.toLocaleString()}</td><td class="text-right">₹${totalNet.toLocaleString()}</td><td colspan="2"></td></tr></tbody></table>`, company);
}

// ─── DEPRECIATION SCHEDULE ────────────────────────────────────────────────────
export function exportDepreciationSchedule(asset: any) {
  const rows: any[] = [];
  const annualDep = (asset.purchaseCost - (asset.salvageValue || 0)) / asset.usefulLife;
  let wdv = asset.purchaseCost;
  for (let y = 1; y <= asset.usefulLife; y++) {
    const dep = asset.depreciationMethod?.includes('WDV') ? wdv * 0.15 : annualDep;
    rows.push({
      'Year': y,
      'Opening WDV (₹)': Math.round(wdv),
      'Depreciation (₹)': Math.round(dep),
      'Closing WDV (₹)': Math.round(Math.max(wdv - dep, asset.salvageValue || 0)),
      'Method': asset.depreciationMethod
    });
    wdv = Math.max(wdv - dep, asset.salvageValue || 0);
  }
  const ws = utils.json_to_sheet(rows);
  ws['!cols'] = autoWidth(rows);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Depreciation Schedule');
  writeFile(wb, `Depreciation_Schedule_${asset.assetCode}_${ts()}.xlsx`);
}

// ─── COST CENTER REPORT ───────────────────────────────────────────────────────
export function printCostCenterReport(costCenters: any[], company?: any) {
  const rows = costCenters.map(cc => `<tr>
    <td style="font-family:monospace;font-weight:900;color:#1D3557">${cc.costCenterCode}</td>
    <td><b>${cc.costCenterName}</b></td>
    <td>${cc.category}</td>
    <td>${cc.manager || '-'}</td>
    <td class="text-right">₹${(cc.budget || 0).toLocaleString()}</td>
    <td><span class="badge ${cc.isActive ? 'badge-green' : ''}">${cc.isActive ? 'Active' : 'Inactive'}</span></td>
  </tr>`).join('');
  const totalBudget = costCenters.reduce((s, c) => s + (c.budget || 0), 0);
  printReport('Cost Center Report', `
    <table><thead><tr><th>Code</th><th>Name</th><th>Category</th><th>Manager</th><th class="text-right">Budget (₹)</th><th>Status</th></tr></thead>
    <tbody>${rows}<tr class="total-row"><td colspan="4">TOTAL</td><td class="text-right">₹${totalBudget.toLocaleString()}</td><td></td></tr></tbody></table>`, company);
}

export function exportAuditLog(logs: any[], filters: string, company?: any) {
  const rows = logs.map(l => ({
    'Timestamp': new Date(l.timestamp).toLocaleString('en-IN'),
    'User': l.user,
    'Action': l.action,
    'Module': l.module,
    'Entity / Ref.': l.entityId,
    'Description': l.description,
    'IP Address': l.ipAddress || ''
  }));
  const ws = utils.aoa_to_sheet([[]]);
  addExcelBranding(ws, `Audit Trail - Filters: ${filters}`, company);
  utils.sheet_add_json(ws, rows, { origin: 'A6' });
  ws['!cols'] = autoWidth(rows);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Audit Trail');
  writeFile(wb, `Audit_Trail_${ts()}.xlsx`);
}

export function exportBankRecon(transactions: any[], accountName: string, statementDate: string, company?: any) {
  const rows = transactions.map(t => ({
    'Date': t.date,
    'Description': t.description,
    'Amount (₹)': t.amount,
    'Type': t.type,
    'Reference': t.reference || '',
    'Reconciled': t.reconciled ? 'Yes' : 'No',
    'Match Status': t.matchStatus || 'Unmatched'
  }));
  const ws = utils.aoa_to_sheet([[]]);
  addExcelBranding(ws, `Bank Recon - ${accountName} (${statementDate})`, company);
  utils.sheet_add_json(ws, rows, { origin: 'A6' });
  ws['!cols'] = autoWidth(rows);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Bank Reconciliation');
  writeFile(wb, `Bank_Recon_${accountName.replace(/\s/g,'_')}_${ts()}.xlsx`);
}

export function exportGSTReport(type: 'GSTR1' | 'GSTR2' | 'GSTR3B', data: any[], period: string, company?: any) {
  let rows: any[] = [];
  if (type === 'GSTR3B') {
    rows = data.map(r => ({
      'Sec': r.id,
      'Description': r.desc,
      'IGST (₹)': r.igst,
      'CGST (₹)': r.cgst,
      'SGST (₹)': r.sgst,
      'Cess (₹)': r.cess
    }));
  } else {
    rows = data.map(r => ({
      'GSTIN': r.partyGstin || r.supplierGstin || 'N/A',
      'Party Name': r.partyName || r.supplierName || 'Consumer',
      'Invoice No': r.invoiceNo,
      'Invoice Date': r.invoiceDate,
      'Taxable Value (₹)': r.taxableValue || 0,
      'IGST (₹)': r.igst || 0,
      'CGST (₹)': r.cgst || 0,
      'SGST (₹)': r.sgst || 0,
      'Total Tax (₹)': r.totalGst || r.totalTax || 0,
      'Net Amount (₹)': r.totalValue || 0,
      ...(r.status ? { 'Recon Status': r.status } : {})
    }));
  }
  
  const ws = utils.aoa_to_sheet([[]]);
  addExcelBranding(ws, `${type} Report - ${period}`, company);
  utils.sheet_add_json(ws, rows, { origin: 'A6' });
  ws['!cols'] = autoWidth(rows);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, type);
  writeFile(wb, `${type}_${period.replace(/\s/g,'_')}_${ts()}.xlsx`);
}

export function exportProfitLoss(pl: any, period: string, company?: any) {
  const rows = [
    { Particulars: 'Sales Revenue', Amount: pl.revenue },
    { Particulars: 'Less: Cost of Goods Sold', Amount: -pl.cogs },
    { Particulars: 'Gross Profit', Amount: pl.grossProfit },
    { Particulars: 'Operating Expenses', Amount: -pl.expenses },
    { Particulars: 'Operating Profit', Amount: pl.operatingProfit },
    { Particulars: 'Tax', Amount: -pl.tax },
    { Particulars: 'Net Profit', Amount: pl.netProfit }
  ];
  const ws = utils.aoa_to_sheet([[]]);
  addExcelBranding(ws, `Profit & Loss Statement - ${period}`, company);
  utils.sheet_add_json(ws, rows, { origin: 'A6' });
  ws['!cols'] = autoWidth(rows);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'P&L Statement');
  writeFile(wb, `Profit_Loss_${period.replace(/\s/g,'_')}_${ts()}.xlsx`);
}

export function exportBalanceSheet(liabilities: any[], assets: any[], date: string, company?: any) {
  // We'll create a side-by-side view in Excel if possible, or sequential
  const rows: any[] = [];
  const maxLen = Math.max(liabilities.length, assets.length);
  
  for (let i = 0; i < maxLen; i++) {
    rows.push({
      'Liabilities & Equity': liabilities[i]?.Particulars || '',
      'Amount (L)': liabilities[i]?.Amount || '',
      ' ': '',
      'Assets': assets[i]?.Particulars || '',
      'Amount (A)': assets[i]?.Amount || ''
    });
  }

  const ws = utils.aoa_to_sheet([[]]);
  addExcelBranding(ws, `Balance Sheet as on ${date}`, company);
  utils.sheet_add_json(ws, rows, { origin: 'A6' });
  ws['!cols'] = autoWidth(rows);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Balance Sheet');
  writeFile(wb, `Balance_Sheet_${date.replace(/\s/g,'_')}_${ts()}.xlsx`);
}

// ─── HELPERS ────────────────────────────────────────────────────────────────
export function amountToWords(amount: number): string {
  if (amount === 0) return 'Zero Only';
  
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const scales = ['', 'Thousand', 'Lakh', 'Crore'];

  const convertChunk = (num: number): string => {
    let str = '';
    if (num >= 100) {
      str += units[Math.floor(num / 100)] + ' Hundred ';
      num %= 100;
    }
    if (num >= 20) {
      str += tens[Math.floor(num / 10)] + ' ';
      num %= 10;
    }
    if (num > 0) {
      str += units[num] + ' ';
    }
    return str.trim();
  };

  let wholeNumber = Math.floor(amount);
  let result = '';
  let scaleIndex = 0;

  if (wholeNumber === 0) {
    result = 'Zero';
  } else {
    // Handle Lakhs and Crores (Indian Numbering System)
    // Last 3 digits
    let chunk = wholeNumber % 1000;
    if (chunk > 0) {
      result = convertChunk(chunk) + ' ' + result;
    }
    wholeNumber = Math.floor(wholeNumber / 1000);
    scaleIndex = 1;

    // Thousands (2 digits)
    if (wholeNumber > 0) {
      chunk = wholeNumber % 100;
      if (chunk > 0) {
        result = convertChunk(chunk) + ' Thousand ' + result;
      }
      wholeNumber = Math.floor(wholeNumber / 100);
    }

    // Lakhs (2 digits)
    if (wholeNumber > 0) {
      chunk = wholeNumber % 100;
      if (chunk > 0) {
        result = convertChunk(chunk) + ' Lakh ' + result;
      }
      wholeNumber = Math.floor(wholeNumber / 100);
    }

    // Crores (remaining)
    if (wholeNumber > 0) {
      result = convertChunk(wholeNumber) + ' Crore ' + result;
    }
  }

  result = result.trim() + ' Only';
  return 'Rs. ' + result;
}

// ─── POS INVOICE PRINTING ────────────────────────────────────────────────────
export function printPOSInvoice(invoice: any, company?: any) {
  const itemsHtml = (invoice.items || []).map((item: any, idx: number) => {
    const qty = parseFloat(item.quantity || 0);
    const rate = parseFloat(item.rate || item.selling_rate || 0);
    const amount = parseFloat(item.totalAmount || item.net_payable || (qty * rate));
    const gstPercent = parseFloat(item.gstPercent || 0);
    
    return `
    <tr style="height: 30px;">
      <td class="text-center">${idx + 1}.</td>
      <td style="font-weight: bold; text-transform: uppercase;">${item.productName || item.product_name}</td>
      <td class="text-center">${item.rack || '-'}</td>
      <td class="text-center">${item.hsn || '-'}</td>
      <td class="text-center" style="font-size: 8px;">${(item.manufacturer || '-').substring(0, 10)}</td>
      <td class="text-center">${item.scheduleType || '-'}</td>
      <td class="text-center">${item.batchNumber || item.batch_number || '-'}</td>
      <td class="text-center">${item.expiryDate ? new Date(item.expiryDate).toLocaleDateString('en-IN', { month: '2-digit', year: '2-digit' }) : '-'}</td>
      <td class="text-center" style="font-weight: bold;">${qty}</td>
      <td class="text-right">${rate.toFixed(2)}</td>
      <td class="text-center">${gstPercent}</td>
      <td class="text-right" style="font-weight: bold;">${amount.toFixed(2)}</td>
    </tr>
  `}).join('');

  // Pad empty rows to maintain height
  const emptyRowsCount = Math.max(0, 10 - (invoice.items?.length || 0));
  const emptyRows = Array(emptyRowsCount).fill(0).map(() => `
    <tr style="height: 30px;">
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
    </tr>
  `).join('');

  const rawNetAmount = parseFloat(invoice.netAmount || invoice.net_payable || invoice.net_amount || (invoice.items || []).reduce((acc: number, item: any) => {
    const qty = parseFloat(item.quantity || 0);
    const itemRate = parseFloat(item.rate || item.selling_rate || 0);
    return acc + parseFloat(item.totalAmount || item.net_payable || (qty * itemRate));
  }, 0));
  
  const totalDiscount = parseFloat(invoice.totalDiscount || invoice.total_discount || 0);
  
  const gstAmount = parseFloat(invoice.totalGst || invoice.total_gst || (invoice.items || []).reduce((acc: number, item: any) => {
    const qty = parseFloat(item.quantity || 0);
    const itemRate = parseFloat(item.rate || item.selling_rate || 0);
    const amount = parseFloat(item.totalAmount || item.net_payable || (qty * itemRate));
    const gstPercent = parseFloat(item.gstPercent || 0);
    return acc + (amount - (amount / (1 + gstPercent / 100)));
  }, 0));

  const taxableValue = parseFloat(invoice.taxableValue || invoice.taxable_value || invoice.total_taxable || (invoice.items || []).reduce((acc: number, item: any) => {
    const qty = parseFloat(item.quantity || 0);
    const itemRate = parseFloat(item.rate || item.selling_rate || 0);
    const amount = parseFloat(item.totalAmount || item.net_payable || (qty * itemRate));
    const gstPercent = parseFloat(item.gstPercent || 0);
    return acc + (amount / (1 + gstPercent / 100));
  }, 0));

  const roundOff = parseFloat(invoice.roundOff || invoice.round_off || 0) || (Math.round(rawNetAmount) - rawNetAmount);
  const netAmount = Math.round(rawNetAmount);

  // Calculate detailed GST breakdown string
  let gstBreakdownString = '';
  if (gstAmount > 0) {
    const uniqueGstRates = [...new Set((invoice.items || []).map((i: any) => parseFloat(i.gstPercent || 0)).filter((r: number) => r > 0))];
    
    if (uniqueGstRates.length > 0) {
      gstBreakdownString = uniqueGstRates.map(rate => {
        // Find items with this specific GST rate
        const itemsWithRate = (invoice.items || []).filter((i: any) => parseFloat(i.gstPercent || 0) === rate);
        
        // Calculate the subtotal for these specific items
        const rateSubTotal = itemsWithRate.reduce((acc: number, item: any) => {
          const qty = parseFloat(item.quantity || 0);
          const itemRate = parseFloat(item.rate || item.selling_rate || 0);
          const amount = parseFloat(item.totalAmount || item.net_payable || (qty * itemRate));
          return acc + (amount / (1 + (rate as number) / 100));
        }, 0);

        const rateGstAmount = rateSubTotal * ((rate as number) / 100);
        const halfRate = ((rate as number) / 2).toFixed(1);
        const halfGst = (rateGstAmount / 2).toFixed(2);
        
        return `GST ${rateSubTotal.toFixed(2)} * ${halfRate}% + ${halfRate}% = ${halfGst} SGST + ${halfGst} CGST`;
      }).join('<br/>');
    } else {
      // Fallback if no rates found but there is a GST amount
      gstBreakdownString = `GST ${taxableValue.toFixed(2)} = ${(gstAmount/2).toFixed(2)} SGST + ${(gstAmount/2).toFixed(2)} CGST`;
    }
  } else {
    gstBreakdownString = 'GST 0.00 * 0% + 0% = 0.00 SGST + 0.00 CGST';
  }

  const win = window.open('', '_blank', 'width=1000,height=700');
  if (!win) { alert('Please allow popups to print.'); return; }

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(invoice.invoiceNumber || invoice.invoice_no)}`;

  win.document.write(`<!DOCTYPE html><html><head>
    <title>Tax Invoice - ${invoice.invoiceNumber || invoice.invoice_no}</title>
    <style>
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 5mm; }
        .no-print { display: none; }
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; font-size: 10px; color: #000; line-height: 1.2; padding: 10px; }
      
      .invoice-container { border: 1px solid #000; width: 100%; max-width: 800px; margin: 0 auto; }
      
      .header { display: flex; border-bottom: 1px solid #000; }
      .header-left { flex: 2; padding: 5px; border-right: 1px solid #000; }
      .header-center { flex: 1.5; padding: 5px; border-right: 1px solid #000; }
      .header-right { flex: 1; padding: 5px; text-align: right; display: flex; flex-direction: column; align-items: flex-end; }
      
      .store-name { color: #00008B; font-size: 16px; font-weight: bold; margin-bottom: 2px; text-transform: uppercase; }
      
      .title-box { border: 1px solid #000; padding: 5px 25px; margin: 2px auto; display: inline-block; font-size: 18px; font-weight: bold; background: #fff; }
      
      .meta-section { display: flex; border-bottom: 1px solid #000; }
      .meta-left { flex: 1; padding: 2px 5px; border-right: 1px solid #000; }
      .meta-center { flex: 1; padding: 2px 5px; text-align: center; }
      .meta-right { flex: 1; padding: 2px 5px; border-left: 1px solid #000; }
      
      table { width: 100%; border-collapse: collapse; }
      th { background: #E0FFFF; border: 1px solid #000; padding: 4px 2px; font-size: 9px; text-transform: uppercase; }
      td { border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px; }
      
      .footer { display: flex; border-top: 1px solid #000; }
      .footer-left { flex: 3; padding: 5px; border-right: 1px solid #000; }
      .footer-right { flex: 1; padding: 0; }
      
      .totals-table td { border: none; padding: 2px 5px; }
      .totals-table tr { border-bottom: 1px solid #000; }
      .totals-table tr:last-child { border-bottom: none; }
      
      .grand-total { font-size: 16px; font-weight: bold; display: flex; justify-content: space-between; padding: 5px; }
      
      .text-right { text-align: right; }
      .text-center { text-align: center; }
      .bold { font-weight: bold; }
    </style>
  </head><body>
    <div class="invoice-container">
      <div class="header">
        <div class="header-left">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <img src="${LOGO_SRC}" alt="Logo" style="height:36px;width:36px;border-radius:50%;border:1.5px solid #e2e8f0"/>
            <div class="store-name" style="margin:0">${company?.name || 'METAPHARSIC LIFESCIENCES'}</div>
          </div>
          <div>${company?.address || '000, HMT NAGAR, NACHARAM,'}</div>
          <div>${company?.city || 'HYDERABAD'} - ${company?.pinCode || '500 076'}, ${company?.state || 'TELANGANA'} ${company?.phone || '0000000000'}</div>
          <div>Phone : ${company?.phone || '0000000000'}</div>
          <div>E-Mail : ${company?.email || 'XXXXXXXX@gmail.com'}</div>
          <div style="margin-top: 5px;">Dr. Name : <span class="bold">${invoice.doctorName || '-'}</span></div>
          <div>Dr. Reg No. : </div>
        </div>
        <div class="header-center">
          <div>Patient Name : <span class="bold">${invoice.patientName || invoice.customerName || '-'}</span></div>
          <div>Patient Address: <span class="bold">${invoice.patientAddress || '-'}</span></div>
          <div style="margin-top: 20px;">Mobile No. : <span class="bold">${invoice.customerMobile || '-'}</span></div>
          <div>ABHA No. : <span class="bold">${invoice.abhaNo || '-'}</span></div>
          <div style="display: flex; justify-content: space-between;">
            <span>ABHA Address : <span class="bold">${invoice.abhaAddress || '-'}</span></span>
          </div>
        </div>
      </div>
      
      <div class="meta-section">
        <div class="meta-left">
          <div>GSTIN : <span class="bold">${company?.gstin || 'XXXXXXXXX'}</span></div>
          <div>DL.No. : <span class="bold">${company?.drugLicenseNo || 'XXXXXXXXXXXX'}</span></div>
        </div>
        <div class="meta-center">
          <div class="title-box">TAX INVOICE</div>
        </div>
        <div class="meta-right">
          <div>Invoice No.: <span class="bold">${invoice.invoiceNumber || invoice.invoice_no}</span></div>
          <div>Date : <span class="bold">${invoice.date || new Date().toLocaleDateString('en-GB')} ${invoice.time || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span></div>
        </div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th style="width: 30px;">SN.</th>
            <th>PRODUCT NAME</th>
            <th style="width: 40px;">RACK</th>
            <th style="width: 60px;">HSN</th>
            <th style="width: 70px;">MFG</th>
            <th style="width: 30px;">SCH</th>
            <th style="width: 70px;">BATCH</th>
            <th style="width: 40px;">EXP</th>
            <th style="width: 40px;">QTY</th>
            <th style="width: 60px;">RATE</th>
            <th style="width: 30px;">GST%</th>
            <th style="width: 70px;">AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
          ${emptyRows}
        </tbody>
      </table>
      
      <div class="footer">
        <div class="footer-left">
          <div style="font-size: 9px; margin-bottom: 5px;">
            ${gstBreakdownString}
          </div>
          <div style="border-top: 1px solid #000; padding-top: 5px;">
            <div class="bold" style="text-decoration: underline;">Terms & Conditions</div>
            <div style="font-size: 8px;">
              Exchange only within 1 month of purchase, bill must be produced.<br/>
              Cutting strips and cold storage items will not be taken back.<br/>
              Kindly show the medicines to the doctor before use.<br/>
              We accept all major credit cards/Debit/UPI<br/>
              <span class="bold">For Home Delivery: ${company?.phone || 'xxxxxxxxxx, xxxxxxxxxx'}</span>
            </div>
          </div>
          <div style="margin-top: 15px; display: flex; justify-content: space-between; align-items: flex-end;">
            <div class="bold">${amountToWords(netAmount)}</div>
            <div class="bold">Pharmacist Sign</div>
          </div>
        </div>
        <div class="footer-right">
          <table class="totals-table">
            <tr>
              <td>Taxable Val.</td>
              <td class="text-right">${taxableValue.toFixed(2)}</td>
            </tr>
            <tr>
              <td>GST Amt.</td>
              <td class="text-right">${gstAmount.toFixed(2)}</td>
            </tr>
            ${totalDiscount > 0 ? `
            <tr>
              <td>Discount</td>
              <td class="text-right">${totalDiscount.toFixed(2)}</td>
            </tr>
            ` : ''}
            ${Math.abs(roundOff) > 0.01 ? `
            <tr>
              <td>Round Off</td>
              <td class="text-right">${roundOff.toFixed(2)}</td>
            </tr>
            ` : ''}
          </table>
          <div class="grand-total">
            <span>GRAND TOTAL</span>
            <span>${netAmount.toFixed(2)}</span>
          </div>
        </div>
      </div>
      
      <div style="text-align: center; font-size: 8px; font-style: italic; padding: 2px; border-top: 1px solid #000;">
        Get well soon. Scan the Healthcare QR Code for complete health services, insurance, and government benefits.
      </div>
    </div>
    
    <div class="no-print" style="text-align: center; margin-top: 20px;">
      <button onclick="window.print()" style="padding: 10px 20px; font-weight: bold; cursor: pointer;">Print Invoice</button>
    </div>
    
    <script>setTimeout(() => { window.print(); }, 800);</script>
  </body></html>`);
  win.document.close();
}

export function exportPOSInvoiceToExcel(invoice: any, company?: any) {
  const rows = (invoice.items || []).map((item: any) => ({
    'Description': item.productName || item.product_name,
    'Batch': item.batchNumber || item.batch_number || '-',
    'Qty': item.quantity,
    'Rate': item.rate || item.selling_rate,
    'Discount %': item.discountPercent || 0,
    'Total (₹)': item.totalAmount || item.total_amount
  }));

  const ws = utils.aoa_to_sheet([[]]);
  addExcelBranding(ws, `INVOICE: ${invoice.invoiceNumber}`, company);
  
  // Add metadata
  utils.sheet_add_aoa(ws, [
    ['Customer:', invoice.customerName],
    ['Date:', invoice.date],
    ['Payment:', invoice.paymentMode],
    []
  ], { origin: 'A6' });

  utils.sheet_add_json(ws, rows, { origin: 'A10' });
  
  // Add total at the bottom
  utils.sheet_add_aoa(ws, [
    ['', '', '', '', 'NET PAYABLE', invoice.netAmount]
  ], { origin: `A${11 + rows.length}` });

  ws['!cols'] = autoWidth([{ 'Description': 'A long description placeholder' }, ...rows]);
  
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Invoice');
  writeFile(wb, `Invoice_${invoice.invoiceNumber.replace(/\//g,'-')}_${ts()}.xlsx`);
}
