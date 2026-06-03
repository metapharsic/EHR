const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyTokenMiddleware } = require('../utils/jwt');
const logger = require('../utils/logger');

router.use(verifyTokenMiddleware);

// Helper to wrap async routes
const asyncRoute = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * GSTR-1: Outward Supplies
 * Fetches B2B and B2C sales summary from sales_invoices
 */
router.get('/gstr1', asyncRoute(async (req, res) => {
    try {
        const { month, year } = req.query;
        const companyId = req.user.companyId || 1;
        
        const date = new Date();
        const m = month || date.getMonth() + 1;
        const y = year || date.getFullYear();
        
        const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
        const endDate = new Date(y, m, 0).toISOString().split('T')[0];

        const query = `
            SELECT 
                p.gstin as party_gstin,
                p.name as party_name,
                si.invoice_number,
                si.date as invoice_date,
                si.taxable_value,
                si.total_gst,
                si.net_amount as total_value,
                COALESCE(SUM(sii.cgst_amount), 0) as total_cgst,
                COALESCE(SUM(sii.sgst_amount), 0) as total_sgst,
                COALESCE(SUM(sii.igst_amount), 0) as total_igst
            FROM sales_invoices si
            LEFT JOIN parties p ON si.party_id = p.id
            LEFT JOIN sales_invoice_items sii ON si.id = sii.invoice_id
            WHERE COALESCE(si.company_id, $1) = $1 
              AND si.date BETWEEN $2 AND $3
              AND si.status = 'Completed'
            GROUP BY p.gstin, p.name, si.invoice_number, si.date, si.taxable_value, si.total_gst, si.net_amount
            ORDER BY si.date ASC
        `;

        const { rows } = await db.query(query, [companyId, startDate, endDate]);
        
        const data = rows.map(r => ({
            partyGstin: r.party_gstin || 'B2C',
            partyName: r.party_name || 'Consumer',
            invoiceNo: r.invoice_number,
            invoiceDate: new Date(r.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
            taxableValue: parseFloat(r.taxable_value || 0),
            totalGst: parseFloat(r.total_gst || 0),
            totalValue: parseFloat(r.total_value || 0),
            igst: parseFloat(r.total_igst || 0),
            cgst: parseFloat(r.total_cgst || 0),
            sgst: parseFloat(r.total_sgst || 0)
        }));

        res.json({ success: true, data });
    } catch (error) {
        logger.error('GSTR-1 Report Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}));

/**
 * GSTR-2A/2B: Inward Supplies (Purchases)
 * Fetches data from purchase_invoices
 */
router.get('/gstr2', asyncRoute(async (req, res) => {
    try {
        const { month, year, recon } = req.query;
        const companyId = req.user.companyId || 1;
        
        const date = new Date();
        const m = month || date.getMonth() + 1;
        const y = year || date.getFullYear();
        
        const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
        const endDate = new Date(y, m, 0).toISOString().split('T')[0];

        // Fetch Books Data (Purchase Invoices)
        const booksQuery = `
            SELECT 
                p.gstin as party_gstin,
                p.name as party_name,
                pi.vendor_invoice_no as invoice_no,
                pi.invoice_date,
                pi.taxable_amount as taxable_value,
                pi.igst,
                pi.cgst,
                pi.sgst,
                (COALESCE(pi.igst, 0) + COALESCE(pi.cgst, 0) + COALESCE(pi.sgst, 0)) as total_gst,
                pi.net_amount as total_value
            FROM purchase_invoices pi
            JOIN parties p ON pi.party_id = p.id
            WHERE COALESCE(p.company_id, $1) = $1
              AND pi.invoice_date BETWEEN $2 AND $3
        `;

        const { rows: books } = await db.query(booksQuery, [companyId, startDate, endDate]);

        if (recon === 'true') {
            // Fetch Portal Data
            const portalQuery = `
                SELECT 
                    gstin as party_gstin,
                    trade_name as party_name,
                    invoice_number as invoice_no,
                    invoice_date,
                    taxable_value,
                    igst,
                    cgst,
                    sgst,
                    total_gst,
                    total_value,
                    source
                FROM gst_portal_data
                WHERE company_id = $1
                  AND period_month = $2
                  AND period_year = $3
            `;
            const { rows: portal } = await db.query(portalQuery, [companyId, m, y]);

            const reconData = [];
            const processedPortalInvoices = new Set();

            // Match Books with Portal
            books.forEach(b => {
                const match = portal.find(p => 
                    p.party_gstin === b.party_gstin && 
                    p.invoice_no === b.invoice_no
                );

                const bookEntry = {
                    partyGstin: b.party_gstin,
                    partyName: b.party_name,
                    invoiceNo: b.invoice_no,
                    invoiceDate: new Date(b.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
                    taxableValue: parseFloat(b.taxable_value || 0),
                    igst: parseFloat(b.igst || 0),
                    cgst: parseFloat(b.cgst || 0),
                    sgst: parseFloat(b.sgst || 0),
                    totalGst: parseFloat(b.total_gst || 0),
                    totalValue: parseFloat(b.total_value || 0)
                };

                if (match) {
                    processedPortalInvoices.add(`${match.party_gstin}-${match.invoice_no}`);
                    const diff = Math.abs(parseFloat(b.taxable_value) - parseFloat(match.taxable_value)) + 
                                 Math.abs(parseFloat(b.total_gst) - parseFloat(match.total_gst));
                    
                    reconData.push({
                        ...bookEntry,
                        portalData: match,
                        status: diff < 1 ? 'Matched' : 'Mismatched',
                        diff: diff.toFixed(2)
                    });
                } else {
                    reconData.push({
                        ...bookEntry,
                        status: 'Missing in Portal',
                        diff: 0
                    });
                }
            });

            // Add Portal Invoices not in Books
            portal.forEach(p => {
                if (!processedPortalInvoices.has(`${p.party_gstin}-${p.invoice_no}`)) {
                    reconData.push({
                        partyGstin: p.party_gstin,
                        partyName: p.party_name,
                        invoiceNo: p.invoice_no,
                        invoiceDate: new Date(p.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
                        taxableValue: 0,
                        igst: 0,
                        cgst: 0,
                        sgst: 0,
                        totalGst: 0,
                        totalValue: 0,
                        portalData: p,
                        status: 'Missing in Books',
                        diff: p.total_value
                    });
                }
            });

            return res.json({ success: true, data: reconData });
        }
        
        const data = books.map(r => ({
            partyGstin: r.party_gstin,
            partyName: r.party_name,
            invoiceNo: r.invoice_no,
            invoiceDate: new Date(r.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
            taxableValue: parseFloat(r.taxable_value || 0),
            totalGst: parseFloat(r.total_gst || 0),
            totalValue: parseFloat(r.total_value || 0),
            igst: parseFloat(r.igst || 0),
            cgst: parseFloat(r.cgst || 0),
            sgst: parseFloat(r.sgst || 0)
        }));

        res.json({ success: true, data });
    } catch (error) {
        logger.error('GSTR-2 Report Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}));

/**
 * GSTR-3B: Monthly Summary
 */
router.get('/gstr3b', asyncRoute(async (req, res) => {
    try {
        const { month, year } = req.query;
        const companyId = req.user.companyId || 1;
        
        const date = new Date();
        const m = month || date.getMonth() + 1;
        const y = year || date.getFullYear();
        
        const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
        const endDate = new Date(y, m, 0).toISOString().split('T')[0];

        // Outward Supplies Summary
        const outwardQuery = `
            SELECT 
                SUM(sii.taxable_value) as total_taxable,
                SUM(sii.cgst_amount) as total_cgst,
                SUM(sii.sgst_amount) as total_sgst,
                SUM(sii.igst_amount) as total_igst
            FROM sales_invoice_items sii
            JOIN sales_invoices si ON sii.invoice_id = si.id
            WHERE COALESCE(si.company_id, $1) = $1 
              AND si.date BETWEEN $2 AND $3
              AND si.status = 'Completed'
        `;

        // Inward Supplies (ITC) Summary
        const inwardQuery = `
            SELECT 
                SUM(taxable_amount) as total_inward_taxable,
                SUM(pi.cgst) as total_cgst,
                SUM(pi.sgst) as total_sgst,
                SUM(pi.igst) as total_igst
            FROM purchase_invoices pi
            JOIN parties p ON pi.party_id = p.id
            WHERE COALESCE(p.company_id, $1) = $1
              AND pi.invoice_date BETWEEN $2 AND $3
              AND pi.status = 'Approved'
        `;

        const [outward, inward] = await Promise.all([
            db.query(outwardQuery, [companyId, startDate, endDate]),
            db.query(inwardQuery, [companyId, startDate, endDate])
        ]);

        const out = outward.rows[0] || {};
        const inv = inward.rows[0] || {};

        const summary = [
            { 
                id: '3.1.a', 
                desc: 'Outward taxable supplies (other than zero rated, nil rated and exempted)', 
                igst: parseFloat(out.total_igst || 0), 
                cgst: parseFloat(out.total_cgst || 0), 
                sgst: parseFloat(out.total_sgst || 0), 
                cess: 0 
            },
            { id: '3.1.b', desc: 'Outward taxable supplies (zero rated)', igst: 0, cgst: 0, sgst: 0, cess: 0 },
            { id: '3.1.c', desc: 'Other outward supplies (Nil rated, exempted)', igst: 0, cgst: 0, sgst: 0, cess: 0 },
            { id: '3.1.d', desc: 'Inward supplies (liable to reverse charge)', igst: 0, cgst: 0, sgst: 0, cess: 0 },
            { 
                id: '4.A.5', 
                desc: 'All other ITC (Input Tax Credit)', 
                igst: parseFloat(inv.total_igst || 0), 
                cgst: parseFloat(inv.total_cgst || 0), 
                sgst: parseFloat(inv.total_sgst || 0), 
                cess: 0 
            },
        ];

        res.json({ success: true, data: summary });
    } catch (error) {
        logger.error('GSTR-3B Report Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}));

module.exports = router;
