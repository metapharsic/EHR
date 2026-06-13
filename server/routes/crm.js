const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { verifyTokenMiddleware } = require('../utils/jwt');
const aiAgent = require('../services/aiCrmAgent');

// Helper to wrap async routes
const asyncRoute = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// ============================================
// DASHBOARD STATS
// ============================================
router.get('/stats', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        const companyId = req.user.companyId || 1;
        const statsQuery = `
            SELECT 
                COUNT(*) as total_leads,
                COUNT(*) FILTER (WHERE status = 'New') as new_leads,
                COUNT(*) FILTER (WHERE status = 'Converted') as converted_leads,
                COUNT(*) FILTER (WHERE priority = 'Urgent') as urgent_leads,
                COALESCE(SUM(estimated_value), 0) as total_pipeline_value
            FROM leads 
            WHERE company_id = $1
        `;
        const { rows } = await db.query(statsQuery, [companyId]);
        
        const stats = rows[0];
        stats.conversion_rate = stats.total_leads > 0 
            ? ((stats.converted_leads / stats.total_leads) * 100).toFixed(1) 
            : 0;

        // Unified Growth Stats
        const pcdCount = await db.query("SELECT COUNT(*) FROM pcd_partners WHERE company_id = $1 AND status = 'ACTIVE'", [companyId]);
        const salesVol = await db.query("SELECT COALESCE(SUM(net_amount), 0) as vol FROM sales_invoices WHERE company_id = $1 AND date >= CURRENT_DATE - INTERVAL '30 days'", [companyId]);

        stats.active_pcd_partners = parseInt(pcdCount.rows[0].count);
        stats.monthly_sales_volume = parseFloat(salesVol.rows[0].vol);

        const velocityMoM = await db.query(`
            SELECT
                COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE)) AS this_month,
                COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
                                  AND created_at < date_trunc('month', CURRENT_DATE)) AS last_month
            FROM leads WHERE company_id = $1`, [companyId]);
        const tm = parseInt(velocityMoM.rows[0].this_month) || 0;
        const lm = parseInt(velocityMoM.rows[0].last_month) || 0;
        stats.lead_velocity = lm === 0
            ? (tm > 0 ? 100 : 0)
            : Math.round(((tm - lm) / lm) * 100);

        res.json(stats);
    } catch (error) {
        logger.error('Failed to fetch CRM stats', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch CRM stats' });
    }
}));

// ============================================
// LEADS CRUD
// ============================================

// GET all leads with full details
router.get('/leads', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        const { status, priority, search, queue } = req.query;
        const companyId = req.user.companyId || 1;
        
        let query = `
            SELECT l.*,
                   u.name AS assignee_name,
                   (SELECT COUNT(*) FROM lead_activities WHERE lead_id = l.id) AS activity_count
            FROM leads l
            LEFT JOIN users u ON u.id = l.assigned_to
            WHERE l.company_id = $1
        `;
        let params = [companyId];
        let paramIdx = 2;

        if (queue === 'today_and_overdue') {
            query += ` AND l.next_follow_up <= CURRENT_DATE AND l.status NOT IN ('Converted', 'Lost')`;
        }

        if (status && status !== 'All') {
            query += ` AND l.status = $${paramIdx++}`;
            params.push(status);
        }

        if (priority && priority !== 'All') {
            query += ` AND l.priority = $${paramIdx++}`;
            params.push(priority);
        }

        if (search) {
            query += ` AND (l.name ILIKE $${paramIdx} OR l.company_name ILIKE $${paramIdx} OR l.contact ILIKE $${paramIdx})`;
            params.push(`%${search}%`);
            paramIdx++;
        }

        query += ' ORDER BY l.created_at DESC';

        const { rows } = await db.query(query, params);
        res.json(rows);
    } catch (error) {
        logger.error('Failed to fetch leads', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch leads' });
    }
}));

// ============================================
// CRM ANALYTICS
// ============================================

router.get('/analytics', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        const companyId = req.user.companyId || 1;

        // 1. Pipeline Velocity (Leads per week, last 4 weeks)
        const velocityQuery = `
            WITH RECURSIVE weeks AS (
                SELECT CURRENT_DATE - INTERVAL '3 weeks' as week_start
                UNION ALL
                SELECT week_start + INTERVAL '1 week' FROM weeks WHERE week_start < CURRENT_DATE
            )
            SELECT 
                TO_CHAR(w.week_start, 'DD Mon') as name,
                COUNT(l.id) as leads,
                COALESCE(SUM(l.estimated_value), 0) as value
            FROM weeks w
            LEFT JOIN leads l ON l.created_at >= w.week_start 
                AND l.created_at < w.week_start + INTERVAL '1 week'
                AND l.company_id = $1
            GROUP BY w.week_start
            ORDER BY w.week_start ASC
        `;

        // 2. Deal Value Distribution (Value per status)
        const distributionQuery = `
            SELECT 
                status as name,
                COALESCE(SUM(estimated_value), 0) as value
            FROM leads
            WHERE company_id = $1
            GROUP BY status
        `;

        const [velocityRes, distributionRes] = await Promise.all([
            db.query(velocityQuery, [companyId]),
            db.query(distributionQuery, [companyId])
        ]);

        res.json({
            velocity: velocityRes.rows,
            distribution: distributionRes.rows
        });
    } catch (error) {
        logger.error('Failed to fetch CRM analytics', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
}));

// GET single lead
router.get('/leads/:id', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM leads WHERE id = $1 AND company_id = $2', [req.params.id, req.user.companyId || 1]);
        if (rows.length === 0) return res.status(404).json({ error: 'Lead not found' });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch lead' });
    }
}));

// DELETE lead (discard opportunity at any stage)
router.delete('/leads/:id', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        const { rowCount } = await db.query(
            'DELETE FROM leads WHERE id = $1 AND company_id = $2',
            [req.params.id, req.user.companyId || 1]
        );
        if (rowCount === 0) return res.status(404).json({ error: 'Lead not found' });
        res.json({ ok: true });
    } catch (error) {
        logger.error('Failed to delete lead', { error: error.message });
        res.status(500).json({ error: 'Failed to discard opportunity' });
    }
}));

// POST new lead
router.post('/leads', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    const { 
        name, companyName, company, email, contact, phone, location, status, priority, 
        source, nextFollowUp, estimatedValue, assignedTo, notes, industryType 
    } = req.body;

    try {
        const { rows } = await db.query(
            `INSERT INTO leads (
                name, company_name, email, contact, location, status, priority, 
                source, next_follow_up, estimated_value, assigned_to, notes, industry_type, company_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
            [
                name, companyName || company || 'N/A', email, contact || phone || 'N/A', location || 'N/A', status || 'New', priority || 'Medium',
                source, nextFollowUp || new Date(Date.now() + 3*24*60*60*1000).toISOString().slice(0,10), estimatedValue || 0, assignedTo || null, notes, industryType, req.user.companyId || 1
            ]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        logger.error('Failed to create lead', { error: error.message });
        res.status(500).json({ error: 'Failed to create lead' });
    }
}));

// PUT update lead
router.put('/leads/:id', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    const { 
        name, companyName, email, contact, location, status, priority, 
        source, nextFollowUp, estimatedValue, assignedTo, notes, industryType 
    } = req.body;

    try {
        const { rows } = await db.query(
            `UPDATE leads SET 
                name = $1, company_name = $2, email = $3, contact = $4, location = $5, 
                status = $6, priority = $7, source = $8, next_follow_up = $9, 
                estimated_value = $10, assigned_to = $11, notes = $12, industry_type = $13, updated_at = NOW()
            WHERE id = $14 AND company_id = $15 RETURNING *`,
            [
                name, companyName, email, contact, location, status, priority,
                source, nextFollowUp, estimatedValue, assignedTo, notes, industryType, req.params.id, req.user.companyId || 1
            ]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Lead not found' });
        res.json(rows[0]);
    } catch (error) {
        logger.error('Failed to update lead', { error: error.message });
        res.status(500).json({ error: 'Failed to update lead' });
    }
}));

// ============================================
// PRODUCT INTERESTS
// ============================================

router.get('/leads/:id/interests', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    const query = `
        SELECT lpi.*, p.name as product_name, p.therapeutic_category as product_category
        FROM lead_product_interests lpi
        JOIN products p ON lpi.product_id = p.id
        WHERE lpi.lead_id = $1
    `;
    const { rows } = await db.query(query, [req.params.id]);
    res.json(rows);
}));

router.post('/leads/:id/interests', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    const { productId, interestLevel, notes } = req.body;
    const { rows } = await db.query(
        `INSERT INTO lead_product_interests (lead_id, product_id, interest_level, notes)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (lead_id, product_id) DO UPDATE 
         SET interest_level = EXCLUDED.interest_level, notes = EXCLUDED.notes
         RETURNING *`,
        [req.params.id, productId, interestLevel || 'Medium', notes]
    );
    res.status(201).json(rows[0]);
}));

// DELETE product interest
router.delete('/leads/:id/interests/:interestId', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        const { rowCount } = await db.query(
            'DELETE FROM lead_product_interests WHERE id = $1 AND lead_id = $2',
            [req.params.interestId, req.params.id]
        );
        if (rowCount === 0) return res.status(404).json({ error: 'Interest not found' });
        res.json({ ok: true });
    } catch (error) {
        logger.error('Failed to delete interest', { error: error.message });
        res.status(500).json({ error: 'Failed to remove interest' });
    }
}));

// ============================================
// AI AGENT ROUTES
// ============================================

router.put('/leads/:id/ai-score', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        const leadRes = await db.query('SELECT * FROM leads WHERE id = $1', [req.params.id]);
        const activitiesRes = await db.query('SELECT * FROM lead_activities WHERE lead_id = $1', [req.params.id]);
        
        if (leadRes.rows.length === 0) return res.status(404).json({ error: 'Lead not found' });
        
        const aiResult = await aiAgent.calculateLeadScore(leadRes.rows[0], activitiesRes.rows);
        
        const updateRes = await db.query(
            `UPDATE leads SET lead_score = $1, ai_sentiment = $2, notes = COALESCE(notes, '') || '\nAI Insight: ' || $3
             WHERE id = $4 RETURNING *`,
            [aiResult.score, aiResult.sentiment, aiResult.reason, req.params.id]
        );
        
        res.json({ success: true, ai: aiResult, lead: updateRes.rows[0] });
    } catch (error) {
        logger.error('AI Scoring failed', { error: error.message });
        res.status(500).json({ error: 'AI Analysis failed' });
    }
}));

router.get('/leads/:id/ai-draft', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        const leadRes = await db.query('SELECT * FROM leads WHERE id = $1', [req.params.id]);
        const interestsRes = await db.query(`
            SELECT p.name as product_name FROM lead_product_interests lpi 
            JOIN products p ON lpi.product_id = p.id WHERE lpi.lead_id = $1`, [req.params.id]);
        
        if (leadRes.rows.length === 0) return res.status(404).json({ error: 'Lead not found' });
        
        const draft = await aiAgent.draftFollowUp(leadRes.rows[0], interestsRes.rows);
        res.json({ draft });
    } catch (error) {
        res.status(500).json({ error: 'Drafting failed' });
    }
}));

router.post('/ai/strategy', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        // 1. Fetch all active leads for the company
        const leadsRes = await db.query(
            'SELECT id, name, location, status, estimated_value, industry_type FROM leads WHERE company_id = $1 AND status NOT IN (\'Converted\', \'Lost\')',
            [req.user.companyId || 1]
        );

        // 2. Fetch regional demand data
        const demandRes = await db.query('SELECT * FROM regional_pharmaceutical_demand');

        // 3. Trigger AI Agent
        const strategy = await aiAgent.generateWeeklyStrategy(leadsRes.rows, demandRes.rows);

        res.json(strategy);
    } catch (error) {
        logger.error('Strategy generation failed', { error: error.message });
        res.status(500).json({ error: 'Failed to generate strategy' });
    }
}));

// ============================================
// SYNC & CONVERSION (LEAD -> PARTY)
// ============================================

router.post('/convert/:id', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    const client = await db.getClient();
    const companyId = req.user.companyId || 1;
    try {
        await client.query('BEGIN');
        
        const leadRes = await client.query('SELECT * FROM leads WHERE id = $1', [req.params.id]);
        if (leadRes.rows.length === 0) throw new Error('Lead not found');
        const lead = leadRes.rows[0];

        // 1. Create Party (Debtor)
        const partyQuery = `
            INSERT INTO parties (name, type, email, mobile, address, city, territory, status, company_id)
            VALUES ($1, 'Debtor', $2, $3, $4, $5, $6, 'Active', $7)
            RETURNING id
        `;
        const partyRes = await client.query(partyQuery, [
            lead.name, lead.email, lead.contact, lead.location, lead.location, lead.location, companyId
        ]);
        const partyId = partyRes.rows[0].id;

        // 2. If PCD Partner, Create PCD Partner entry
        if (lead.industry_type === 'PCD Partner') {
            await client.query(
                `INSERT INTO pcd_partners (
                    name, territory, contact_number, email, status, 
                    partner_grade, company_id, converted_party_id, address
                ) VALUES ($1, $2, $3, $4, 'ACTIVE', 'BRONZE', $5, $6, $7)`,
                [lead.name, lead.location || 'Default', lead.contact, lead.email, companyId, partyId, lead.location]
            );
        }

        // 3. Link Lead to Party
        await client.query(
            'UPDATE leads SET status = \'Converted\', converted_party_id = $1 WHERE id = $2',
            [partyId, lead.id]
        );

        await client.query('COMMIT');
        res.json({ success: true, partyId, message: `Lead successfully converted to ${lead.industry_type === 'PCD Partner' ? 'PCD Partner' : 'Customer'}` });
    } catch (error) {
        if (client) await client.query('ROLLBACK');
        logger.error('Conversion failed', { error: error.message });
        res.status(500).json({ success: false, error: 'Conversion failed', details: error.message });
    } finally {
        if (client) client.release();
    }
}));

// ============================================
// LEAD ACTIVITIES
// ============================================

router.get('/leads/:id/activities', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT * FROM lead_activities WHERE lead_id = $1 ORDER BY performed_at DESC',
            [req.params.id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch activities' });
    }
}));

router.post('/leads/:id/activities', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    const { type, description, duration, outcome, followUpRequired, followUpDate } = req.body;

    try {
        const { rows } = await db.query(
            `INSERT INTO lead_activities (
                lead_id, type, description, performed_by, duration, 
                outcome, follow_up_required, follow_up_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [
                req.params.id, type, description, req.user.userId, duration || null,
                outcome, followUpRequired || false, followUpDate || null
            ]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        logger.error('Failed to create activity', { error: error.message });
        res.status(500).json({ error: 'Failed to create activity' });
    }
}));

// DELETE activity
router.delete('/leads/:id/activities/:actId', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        const { rowCount } = await db.query(
            'DELETE FROM lead_activities WHERE id = $1 AND lead_id = $2',
            [req.params.actId, req.params.id]
        );
        if (rowCount === 0) return res.status(404).json({ error: 'Activity not found' });
        res.json({ ok: true });
    } catch (error) {
        logger.error('Failed to delete activity', { error: error.message });
        res.status(500).json({ error: 'Failed to remove activity' });
    }
}));

// ============================================
// CONTACTS LIST (needed for regression tests)
// ============================================
router.get('/contacts', verifyTokenMiddleware, asyncRoute(async (req, res) => {
    try {
        const { rows } = await db.query(
            "SELECT *, COALESCE(first_name || ' ' || last_name, first_name, last_name, '') AS name FROM crm_contacts ORDER BY first_name ASC"
        );
        res.json(rows);
    } catch (error) {
        logger.error('Failed to fetch contacts', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch contacts' });
    }
}));

module.exports = router;
