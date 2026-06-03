const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { verifyTokenMiddleware } = require('../utils/jwt');

/**
 * GET /api/dms
 * Fetch all documents with optional filtering
 */
router.get('/', verifyTokenMiddleware, async (req, res) => {
    try {
        const { search = '', category = 'All', status = 'All' } = req.query;
        
        let query = `
            SELECT 
                id,
                title,
                category,
                file_type as "type",
                current_version as "version",
                status,
                expiry_date as "expiryDate",
                author_name as "author",
                created_at as "uploadDate",
                '2.4 MB' as "size" -- Placeholder for size logic
            FROM dms_documents
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            params.push(`%${search}%`);
            query += ` AND (title ILIKE $${params.length} OR id ILIKE $${params.length})`;
        }

        if (category !== 'All') {
            params.push(category);
            query += ` AND category = $${params.length}`;
        }

        if (status !== 'All') {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }

        query += ` ORDER BY created_at DESC`;

        const result = await db.query(query, params);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        logger.error('Failed to fetch DMS documents', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/dms/stats
 * Dashboard summary stats
 */
router.get('/stats', verifyTokenMiddleware, async (req, res) => {
    try {
        const total = await db.query('SELECT COUNT(*) FROM dms_documents');
        const active = await db.query("SELECT COUNT(*) FROM dms_documents WHERE status = 'Active'");
        const expiring = await db.query("SELECT COUNT(*) FROM dms_documents WHERE status = 'Expiring' OR expiry_date <= CURRENT_DATE + INTERVAL '30 days'");
        const draft = await db.query("SELECT COUNT(*) FROM dms_documents WHERE status = 'Draft'");
        const pending = await db.query("SELECT COUNT(*) FROM dms_documents WHERE status = 'Pending'");

        res.json({
            success: true,
            data: {
                total: parseInt(total.rows[0].count),
                active: parseInt(active.rows[0].count),
                expiring: parseInt(expiring.rows[0].count),
                draft: parseInt(draft.rows[0].count),
                pending: parseInt(pending.rows[0].count)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/dms/:id
 * Document details with version history and workflow
 */
router.get('/:id', verifyTokenMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const document = await db.query('SELECT * FROM dms_documents WHERE id = $1', [id]);
        
        if (document.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }

        const versions = await db.query('SELECT * FROM dms_versions WHERE document_id = $1 ORDER BY created_at DESC', [id]);
        const workflow = await db.query('SELECT * FROM dms_workflows WHERE document_id = $1', [id]);
        const audits = await db.query('SELECT * FROM dms_audit_trail WHERE document_id = $1 ORDER BY created_at DESC LIMIT 10', [id]);

        res.json({
            success: true,
            data: {
                ...document.rows[0],
                versions: versions.rows,
                workflow: workflow.rows[0] || null,
                audits: audits.rows
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
