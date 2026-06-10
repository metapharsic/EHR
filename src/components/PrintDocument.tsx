/**
 * PrintDocument — Wraps any report/document with:
 *   • Metapharsic Lifesciences logo header
 *   • Confidential watermark (print-only, 5% opacity diagonal)
 *   • Branded footer with page meta
 *
 * Usage:
 *   <PrintDocument title="Day Book Report" subtitle="April 2026">
 *     {children}
 *   </PrintDocument>
 *
 * Then call window.print() or use the built-in Print button.
 */

import React, { useRef } from 'react';
import logoSvg from '/logo.svg';

interface PrintDocumentProps {
  title: string;
  subtitle?: string;
  date?: string;
  children: React.ReactNode;
  /** If true, shows a Print button inside the component */
  showPrintButton?: boolean;
  /** Additional class for the outer wrapper */
  className?: string;
}

export function PrintDocument({
  title,
  subtitle,
  date,
  children,
  showPrintButton = true,
  className = '',
}: PrintDocumentProps) {
  const today = date ?? new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  const handlePrint = () => window.print();

  return (
    <div className={`print-document-root ${className}`}>

      {/* ── Global print styles ── */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-document-root,
          .print-document-root * { visibility: visible !important; }
          .print-document-root {
            position: absolute;
            inset: 0;
            padding: 0;
            margin: 0;
          }
          .no-print { display: none !important; }
          @page { margin: 18mm 14mm; size: A4; }
        }
        @media screen {
          .print-doc-watermark { display: none !important; }
        }
        /* ── Watermark ── */
        .print-doc-watermark {
          position: fixed;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%) rotate(-35deg);
          z-index: 9999;
          pointer-events: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          opacity: 0.055;
          page-break-inside: avoid;
        }
        .print-doc-watermark img  { width: 240px; }
        .print-doc-watermark span {
          font-size: 30px;
          font-weight: 900;
          letter-spacing: 8px;
          text-transform: uppercase;
          color: #1a56db;
          font-family: 'Segoe UI', sans-serif;
          margin-top: 4px;
        }
        /* ── Print Header ── */
        .print-doc-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 2.5px solid #1a56db;
          padding-bottom: 10px;
          margin-bottom: 20px;
        }
        .print-doc-header-logo { display: flex; align-items: center; gap: 10px; }
        .print-doc-header-logo img { height: 48px; width: 48px; border-radius: 50%; }
        .print-doc-header-company { }
        .print-doc-header-company .company-name {
          font-size: 15px; font-weight: 800; color: #1e3a8a;
          font-family: 'Segoe UI', sans-serif;
        }
        .print-doc-header-company .company-sub {
          font-size: 9px; font-weight: 600; letter-spacing: 2px;
          color: #64748b; text-transform: uppercase;
        }
        .print-doc-header-title { text-align: center; flex: 1; padding: 0 16px; }
        .print-doc-header-title .doc-title {
          font-size: 16px; font-weight: 800; color: #1e293b;
          font-family: 'Segoe UI', sans-serif;
        }
        .print-doc-header-title .doc-subtitle {
          font-size: 11px; color: #64748b; margin-top: 2px;
        }
        .print-doc-header-meta { text-align: right; }
        .print-doc-header-meta .meta-date {
          font-size: 11px; color: #475569; font-weight: 600;
        }
        .print-doc-header-meta .meta-conf {
          font-size: 9px; color: #94a3b8; margin-top: 2px;
          border: 1px solid #e2e8f0; border-radius: 4px;
          padding: 1px 6px; display: inline-block;
        }
        /* ── Print Footer ── */
        .print-doc-footer {
          border-top: 1px solid #e2e8f0;
          margin-top: 24px;
          padding-top: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 9px;
          color: #94a3b8;
        }
        .print-doc-footer .footer-left  { display: flex; align-items: center; gap: 6px; }
        .print-doc-footer .footer-left img { height: 18px; opacity: 0.6; }
        /* ── Print button (screen only) ── */
        .print-btn {
          display: inline-flex; align-items: center; gap: 6px;
          background: #1a56db; color: white; border: none; border-radius: 8px;
          padding: 8px 18px; font-size: 13px; font-weight: 600;
          cursor: pointer; margin-bottom: 16px;
          font-family: 'Segoe UI', sans-serif;
        }
        .print-btn:hover { background: #1e429f; }
      `}</style>

      {/* Watermark — shows only during print */}
      <div className="print-doc-watermark">
        <img src={logoSvg} alt="Metapharsic" />
        <span>Metapharsic</span>
      </div>

      {/* Print Button (screen only) */}
      {showPrintButton && (
        <div className="no-print" style={{ marginBottom: 8 }}>
          <button className="print-btn" onClick={handlePrint}>
            🖨️ Print / Save as PDF
          </button>
        </div>
      )}

      {/* Header — always visible in print */}
      <div className="print-doc-header">
        <div className="print-doc-header-logo">
          <img src={logoSvg} alt="Metapharsic Lifesciences" />
          <div className="print-doc-header-company">
            <div className="company-name">Metapharsic</div>
            <div className="company-sub">Lifesciences</div>
          </div>
        </div>

        <div className="print-doc-header-title">
          <div className="doc-title">{title}</div>
          {subtitle && <div className="doc-subtitle">{subtitle}</div>}
        </div>

        <div className="print-doc-header-meta">
          <div className="meta-date">📅 {today}</div>
          <div className="meta-conf">CONFIDENTIAL</div>
        </div>
      </div>

      {/* Document body */}
      <div className="print-doc-body">
        {children}
      </div>

      {/* Footer */}
      <div className="print-doc-footer">
        <div className="footer-left">
          <img src={logoSvg} alt="" />
          <span>© 2026 Metapharsic Lifesciences Pvt. Ltd. — Confidential &amp; Internal Use Only</span>
        </div>
        <span>Generated: {today}</span>
        <span>accounts@metapharsic.com</span>
      </div>

    </div>
  );
}

export default PrintDocument;
