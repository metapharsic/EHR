const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { verifyTokenMiddleware } = require('../utils/jwt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer for DMS
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../../uploads/dms');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'DOC-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

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
                CASE WHEN file_size IS NOT NULL THEN ROUND(file_size / 1048576.0, 2)::text || ' MB' ELSE '—' END as "size"
            FROM dms_documents
            WHERE status != 'Deleted'
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
 * GET /api/dms/versions
 * All version history across all documents
 */
router.get('/versions', verifyTokenMiddleware, async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT
                v.id,
                v.document_id as "documentId",
                d.title,
                v.version_label as "version",
                v.uploaded_name as "uploadedBy",
                v.created_at as "uploadDate",
                v.file_size_bytes as "fileSize",
                v.status,
                v.change_log as "changeLog",
                v.approved_by as "approvedBy",
                v.approval_date as "approvalDate"
            FROM dms_versions v
            JOIN dms_documents d ON d.id = v.document_id
            WHERE d.status != 'Deleted'
            ORDER BY d.title, v.created_at DESC
        `);
        res.json({ success: true, data: rows });
    } catch (error) {
        logger.error('Failed to fetch version history', { error: error.message });
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

router.post('/', verifyTokenMiddleware, upload.single('file'), async (req, res) => {
    console.log('[DMS] POST / HIT - Body:', req.body);
    console.log('[DMS] File:', req.file ? req.file.originalname : 'MISSING');
    
    try {
        const {
            title, category, version, status, expiryDate, description
        } = req.body;

        if (!title || !category) {
            return res.status(400).json({ success: false, error: 'title and category are required' });
        }

        const file = req.file;
        if (!file) {
            return res.status(400).json({ success: false, error: 'Document file is required' });
        }

        // Generate a DOC-XXXXX style ID
        const countResult = await db.query("SELECT COUNT(*) FROM dms_documents");
        const seq = parseInt(countResult.rows[0].count) + 1;
        const docId = `DOC-${String(seq).padStart(5, '0')}`;

        const fileUrl = `/uploads/dms/${file.filename}`;
        const fileType = path.extname(file.originalname).substring(1).toUpperCase();
        
        // Safety for user object
        const userId = req.user?.userId || req.user?.id || null;
        const username = req.user?.username || req.user?.name || 'System';

        const { rows } = await db.query(
            `INSERT INTO dms_documents
             (id, title, category, file_type, current_version, status, expiry_date, 
              author_name, author_id, file_url, file_name, file_size, notes, company_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             RETURNING *`,
            [
                docId,
                title,
                category,
                fileType,
                version || '1.0',
                status || 'Active',
                expiryDate || null,
                username,
                userId,
                fileUrl,
                file.originalname,
                file.size,
                description || null,
                req.user.companyId || 1
            ]
        );

        // Log audit trail
        await db.query(
            `INSERT INTO dms_audit_trail (document_id, action, user_id, user_name, details, ip_address)
             VALUES ($1, 'Created', $2, $3, $4, $5)`,
            [docId, userId, username, `Document "${title}" created and file uploaded`, req.ip]
        );

        console.log('[DMS] SUCCESS - Created:', docId);
        res.status(201).json({ success: true, data: rows[0] });
    } catch (error) {
        console.error('[DMS] FAILED:', error);
        logger.error('Failed to create DMS document', { error: error.message, stack: error.stack });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/dms/:id
 * Update a document record
 */
router.put('/:id', verifyTokenMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, category, type, version, status, expiryDate } = req.body;

        const { rows } = await db.query(
            `UPDATE dms_documents
             SET title = COALESCE($1, title),
                 category = COALESCE($2, category),
                 file_type = COALESCE($3, file_type),
                 current_version = COALESCE($4, current_version),
                 status = COALESCE($5, status),
                 expiry_date = $6,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $7
             RETURNING *`,
            [title, category, type, version, status, expiryDate || null, id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }

        await db.query(
            `INSERT INTO dms_audit_trail (document_id, action, user_id, user_name, details)
             VALUES ($1, 'Modified', $2, $3, $4)`,
            [id, req.user.userId || null, req.user.username || 'System', `Document updated`]
        );

        res.json({ success: true, data: rows[0] });
    } catch (error) {
        logger.error('Failed to update DMS document', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/dms/:id
 * Soft-delete a document (sets status to Deleted)
 */
router.delete('/:id', verifyTokenMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        const { rows } = await db.query(
            `UPDATE dms_documents SET status = 'Deleted', updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND status != 'Deleted'
             RETURNING id, title`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }

        await db.query(
            `INSERT INTO dms_audit_trail (document_id, action, user_id, user_name, details)
             VALUES ($1, 'Deleted', $2, $3, $4)`,
            [id, req.user.userId || null, req.user.username || 'System', `Document "${rows[0].title}" deleted`]
        );

        res.json({ success: true, message: 'Document deleted', id });
    } catch (error) {
        logger.error('Failed to delete DMS document', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
