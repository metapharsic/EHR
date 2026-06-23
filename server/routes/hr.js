'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const db = require('../db');
const logger = require('../utils/logger');
const { verifyTokenMiddleware, verifyRoleMiddleware } = require('../utils/jwt');
const ledgerHelper = require('../utils/ledgerHelper');
const payrollEngine = require('../utils/hrPayrollEngine');
const aiAgent = require('../services/aiHrAgent');
const { v4: uuidv4 } = require('uuid');

// ─── Helpers ────────────────────────────────────────────────────────────────

const asyncRoute = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const isUUID = (val) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join('uploads', 'hr', String(req.params.id || 'misc'));
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
});

// ─── PERFORMANCE STATS (legacy alias — keep before :id routes) ───────────────

router.get(
  ['/performance-stats', '/performance'],
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    const result = await db.query(`
      SELECT
        COUNT(*)::INT                                            AS "totalEmployees",
        COUNT(*) FILTER (WHERE status = 'Active')::INT          AS "activeEmployees",
        COUNT(*) FILTER (WHERE target_achievement >= 100)::INT  AS "starPerformers",
        COUNT(*) FILTER (WHERE target_achievement < 80)::INT    AS "attentionNeeded",
        ROUND(COALESCE(AVG(target_achievement),0)::NUMERIC,2)::FLOAT AS "averageAchievement"
      FROM employees
    `);
    res.json({ success: true, data: result.rows[0] });
  })
);

// ═══════════════════════════════════════════════════════════════════════════
// FOUNDATION — DEPARTMENTS / DESIGNATIONS / SALARY STRUCTURES
// ═══════════════════════════════════════════════════════════════════════════

router.get(
  '/departments',
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    const result = await db.query(`
      SELECT d.*, COUNT(e.id)::INT AS headcount
      FROM hr_departments d
      LEFT JOIN employees e ON e.department_id = d.id AND e.status = 'Active'
      GROUP BY d.id
      ORDER BY d.name
    `);
    res.json({ success: true, data: result.rows });
  })
);

router.post(
  '/departments',
  verifyTokenMiddleware,
  verifyRoleMiddleware(['ADMIN', 'HR_MANAGER']),
  asyncRoute(async (req, res) => {
    const { name, code, parent_id, head_employee_id, description } = req.body;
    const result = await db.query(
      `INSERT INTO hr_departments (id, name, code, parent_dept_id, head_employee_id, description, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING *`,
      [uuidv4(), name, code, parent_id || null, head_employee_id || null, description || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  })
);

router.get(
  '/departments/tree',
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    const result = await db.query(`
      WITH RECURSIVE dept_hierarchy AS (
        SELECT d.id, d.name, d.code, d.parent_dept_id, d.head_employee_id, 0 AS depth, e.name as manager_name
        FROM hr_departments d
        LEFT JOIN employees e ON d.head_employee_id = e.id
        WHERE d.parent_dept_id IS NULL
        UNION ALL
        SELECT d.id, d.name, d.code, d.parent_dept_id, d.head_employee_id, dh.depth + 1, e.name as manager_name
        FROM hr_departments d
        LEFT JOIN employees e ON d.head_employee_id = e.id
        JOIN dept_hierarchy dh ON d.parent_dept_id = dh.id
      )
      SELECT dh.*, (SELECT COUNT(*)::INT FROM employees WHERE department_id = dh.id) as headcount
      FROM dept_hierarchy dh
      ORDER BY depth, name
    `);
    
    // Nest the flat result into a tree
    const list = result.rows;
    const map = {};
    const tree = [];
    
    list.forEach(node => {
      map[node.id] = { ...node, children: [] };
    });
    
    list.forEach(node => {
      if (node.parent_dept_id && map[node.parent_dept_id]) {
        map[node.parent_dept_id].children.push(map[node.id]);
      } else {
        tree.push(map[node.id]);
      }
    });

    res.json({ success: true, data: tree });
  })
);

router.get(
  '/designations',
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    const result = await db.query('SELECT * FROM hr_designations ORDER BY name');
    res.json({ success: true, data: result.rows });
  })
);

router.post(
  '/designations',
  verifyTokenMiddleware,
  verifyRoleMiddleware(['ADMIN', 'HR_MANAGER']),
  asyncRoute(async (req, res) => {
    const { name, code, grade, department_id } = req.body;
    const result = await db.query(
      `INSERT INTO hr_designations (id, name, code, grade, department_id, created_at)
       VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING *`,
      [uuidv4(), name, code, grade || null, department_id || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  })
);

router.get(
  '/salary-structures',
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    const result = await db.query('SELECT * FROM hr_salary_structures ORDER BY name');
    res.json({ success: true, data: result.rows });
  })
);

router.post(
  '/salary-structures',
  verifyTokenMiddleware,
  verifyRoleMiddleware(['ADMIN', 'HR_MANAGER']),
  asyncRoute(async (req, res) => {
    const { name, basic_pct, hra_pct, da_pct, special_allowance, grade, description } = req.body;
    const gr = grade || description || 'L2';
    const result = await db.query(
      `INSERT INTO hr_salary_structures (id, name, basic_pct, hra_pct, da_pct, special_allowance, grade, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()) RETURNING *`,
      [uuidv4(), name, basic_pct || 50, hra_pct || 20, da_pct || 10, special_allowance || 0, gr]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  })
);

// ═══════════════════════════════════════════════════════════════════════════
// EMPLOYEES
// ═══════════════════════════════════════════════════════════════════════════

router.get(
  '/employees',
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    const { dept, designation, status, search } = req.query;
    const conditions = [];
    const params = [];
    if (dept)        { params.push(dept);        conditions.push(`e.department_id = $${params.length}`); }
    if (designation) { params.push(designation); conditions.push(`e.designation_id = $${params.length}`); }
    if (status)      { params.push(status);      conditions.push(`e.status = $${params.length}`); }
    if (search)      { params.push(`%${search}%`); conditions.push(`(e.name ILIKE $${params.length} OR e.email ILIKE $${params.length})`); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const result = await db.query(`
      SELECT e.*,
             d.name  AS department_name,
             dg.name AS designation_name,
             m.name  AS manager_name
      FROM employees e
      LEFT JOIN hr_departments  d  ON d.id  = e.department_id
      LEFT JOIN hr_designations dg ON dg.id = e.designation_id
      LEFT JOIN employees       m  ON m.id  = e.reporting_manager_id
      ${where}
      ORDER BY e.name
    `, params);
    res.json({ success: true, data: result.rows, employees: result.rows });
  })
);

router.post(
  '/employees',
  verifyTokenMiddleware,
  verifyRoleMiddleware(['ADMIN', 'HR_MANAGER']),
  asyncRoute(async (req, res) => {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Auto-generate employee_code
      const codeRes = await client.query(
        `SELECT COALESCE(MAX(CAST(SUBSTRING(employee_code FROM 5) AS INT)), 0) + 1 AS next_num FROM employees WHERE employee_code ~ '^EMP-[0-9]+$'`
      );
      const empNum = String(codeRes.rows[0].next_num).padStart(4, '0');
      const employee_code = `EMP-${empNum}`;

      const {
        name, contact, email, headquarters, assignedArea, salesTarget, baseSalary,
        department_id, designation_id, reporting_manager_id, employment_type, gender,
        dob, join_date, salary_structure_id, location,
      } = req.body;

      const empId = uuidv4();
      const result = await client.query(
        `INSERT INTO employees (
           id, employee_code, name, contact, email, headquarters, assigned_area,
           sales_target, base_salary, department_id, designation_id, reporting_manager_id,
           employment_type, gender, dob, join_date, salary_structure_id,
           work_location, status, created_by, created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'Active',$19,NOW())
         RETURNING *`,
        [
          empId, employee_code, name, contact, email, headquarters || null,
          assignedArea || null, salesTarget || 0, baseSalary || 0,
          department_id || null, designation_id || null, reporting_manager_id || null,
          employment_type || 'Full-Time', gender || null, dob || null,
          join_date || new Date(), salary_structure_id || null, location || null,
          req.user.userId,
        ]
      );

      // Timeline entry
      await client.query(
        `INSERT INTO hr_employee_timeline (id, employee_id, event_type, event_date, description, performed_by, created_at)
         VALUES ($1,$2,'Joined',$3,'Employee onboarded',$4,NOW())`,
        [uuidv4(), empId, join_date || new Date(), req.user.userId]
      );

      // Provision leave balances (call DB function if exists, swallow if not)
      try {
        await client.query('SELECT fn_provision_leave_balances($1)', [empId]);
      } catch (_) { /* function may not exist yet */ }

      await client.query('COMMIT');


      // Trigger onboarding async (non-blocking)
      setImmediate(async () => {
        try {
          const tpl = await db.query(
            `SELECT id, tasks FROM hr_onboarding_templates WHERE is_default = TRUE LIMIT 1`
          );
          if (tpl.rows.length) {
            const tmplId = tpl.rows[0].id;
            const tasksJson = tpl.rows[0].tasks || [];
            const checklistId = uuidv4();
            await db.query(
              `INSERT INTO hr_onboarding_checklists (id, employee_id, template_id, status, created_at)
               VALUES ($1,$2,$3,'In Progress',NOW())`,
              [checklistId, empId, tmplId]
            );
            let i = 0;
            for (const t of tasksJson) {
              await db.query(
                `INSERT INTO hr_onboarding_tasks (id, checklist_id, task_name, category, owner_type, status, due_date, display_order, created_at)
                 VALUES ($1, $2, $3, $4, $5, 'Pending', CURRENT_DATE + ($6 || ' day')::interval, $7, NOW())`,
                [
                  uuidv4(),
                  checklistId,
                  t.name || t.title || 'Onboarding Task',
                  t.category || 'General',
                  t.owner_type || t.assigned_role || 'HR',
                  Number(t.due_day_offset || t.due_days || 0),
                  i++
                ]
              );
            }
          }
        } catch (e) {
          logger.error('Onboarding trigger failed', { error: e.message });
        }
      });

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create employee', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    } finally {
      client.release();
    }
  })
);

router.get(
  '/employees/:id/profile',
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    const { id } = req.params;
    if (!isUUID(id)) {
      return res.status(400).json({ success: false, error: 'Invalid ID format' });
    }
    const [empRes, docsRes, timelineRes] = await Promise.all([
      db.query(`
        SELECT e.*,
               d.name  AS department_name,
               dg.name AS designation_name,
               m.name  AS manager_name,
               m.email AS manager_email
        FROM employees e
        LEFT JOIN hr_departments  d  ON d.id  = e.department_id
        LEFT JOIN hr_designations dg ON dg.id = e.designation_id
        LEFT JOIN employees       m  ON m.id  = e.reporting_manager_id
        WHERE e.id = $1
      `, [id]),
      db.query(
        `SELECT * FROM hr_employee_documents WHERE employee_id = $1 ORDER BY created_at DESC`,
        [id]
      ),
      db.query(
        `SELECT * FROM hr_employee_timeline WHERE employee_id = $1 ORDER BY event_date DESC LIMIT 50`,
        [id]
      ),
    ]);
    if (!empRes.rows.length) return res.status(404).json({ success: false, error: 'Employee not found' });
    const profile = {
      ...empRes.rows[0],
      documents: docsRes.rows,
      timeline: timelineRes.rows,
    };
    res.json({ success: true, data: profile });
  })
);

router.put(
  '/employees/:id/profile',
  verifyTokenMiddleware,
  verifyRoleMiddleware(['ADMIN', 'HR_MANAGER']),
  asyncRoute(async (req, res) => {
    const { id } = req.params;
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      
      // Fetch existing employee details first
      const empRes = await client.query('SELECT * FROM employees WHERE id = $1', [id]);
      if (!empRes.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: 'Employee not found' });
      }
      const existing = empRes.rows[0];

      const name = req.body.name !== undefined ? req.body.name : existing.name;
      const contact = req.body.contact !== undefined ? req.body.contact : existing.contact;
      const email = req.body.email !== undefined ? req.body.email : existing.email;
      const headquarters = req.body.headquarters !== undefined ? req.body.headquarters : existing.headquarters;
      const assignedArea = req.body.assignedArea !== undefined ? req.body.assignedArea : (req.body.assigned_area !== undefined ? req.body.assigned_area : existing.assigned_area);
      const salesTarget = req.body.salesTarget !== undefined ? req.body.salesTarget : (req.body.sales_target !== undefined ? req.body.sales_target : existing.sales_target);
      const baseSalary = req.body.baseSalary !== undefined ? req.body.baseSalary : (req.body.base_salary !== undefined ? req.body.base_salary : existing.base_salary);
      const department_id = req.body.department_id !== undefined ? req.body.department_id : existing.department_id;
      const designation_id = req.body.designation_id !== undefined ? req.body.designation_id : existing.designation_id;
      const reporting_manager_id = req.body.reporting_manager_id !== undefined ? req.body.reporting_manager_id : existing.reporting_manager_id;
      const employment_type = req.body.employment_type !== undefined ? req.body.employment_type : existing.employment_type;
      const gender = req.body.gender !== undefined ? req.body.gender : existing.gender;
      const dob = req.body.dob !== undefined ? req.body.dob : existing.dob;
      const join_date = req.body.join_date !== undefined ? req.body.join_date : existing.join_date;
      const salary_structure_id = req.body.salary_structure_id !== undefined ? req.body.salary_structure_id : existing.salary_structure_id;
      const location = req.body.location !== undefined ? req.body.location : (req.body.work_location !== undefined ? req.body.work_location : existing.work_location);
      const status = req.body.status !== undefined ? req.body.status : existing.status;
      const grade = req.body.grade !== undefined ? req.body.grade : existing.grade;

      const result = await client.query(
        `UPDATE employees SET
           name=$1, contact=$2, email=$3, headquarters=$4, assigned_area=$5,
           sales_target=$6, base_salary=$7, department_id=$8, designation_id=$9,
           reporting_manager_id=$10, employment_type=$11, gender=$12, dob=$13,
           join_date=$14, salary_structure_id=$15, work_location=$16, status=$17,
           grade=$18, updated_at=NOW()
         WHERE id=$19 RETURNING *`,
        [
          name, contact, email, headquarters, assignedArea, salesTarget, baseSalary,
          department_id, designation_id, reporting_manager_id, employment_type, gender,
          dob, join_date, salary_structure_id, location, status, grade, id,
        ]
      );

      await client.query(
        `INSERT INTO hr_employee_timeline (id, employee_id, event_type, description, event_date, performed_by, created_at)
         VALUES ($1,$2,'Profile Updated','Profile fields updated',NOW(),$3,NOW())`,
        [uuidv4(), id, req.user.userId]
      );

      await client.query('COMMIT');
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to update employee profile', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    } finally {
      client.release();
    }
  })
);

router.delete(
  '/employees/:id',
  verifyTokenMiddleware,
  verifyRoleMiddleware(['ADMIN', 'HR_MANAGER']),
  asyncRoute(async (req, res) => {
    const { id } = req.params;
    const { exit_date, exit_reason } = req.body || {};
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE employees SET status='Terminated', exit_date=$1, exit_reason=$2, updated_at=NOW() WHERE id=$3 RETURNING *`,
        [exit_date || new Date(), exit_reason || null, id]
      );
      if (!result.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: 'Employee not found' });
      }
      await client.query(
        `INSERT INTO hr_employee_timeline (id, employee_id, event_type, description, event_date, performed_by, created_at)
         VALUES ($1,$2,'Terminated','Employee terminated',$3,$4,NOW())`,
        [uuidv4(), id, exit_date || new Date(), req.user.userId]
      );
      if (exit_date) {
        // trigger offboarding async
        setImmediate(async () => {
          try {
            await db.query(
              `INSERT INTO hr_offboarding_checklists (id, employee_id, exit_date, status, initiated_by, created_at)
               VALUES ($1,$2,$3,'Initiated',$4,NOW()) ON CONFLICT (employee_id) DO NOTHING`,
              [uuidv4(), id, exit_date, req.user.userId]
            );
          } catch (e) {
            logger.error('Offboarding trigger failed', { error: e.message });
          }
        });
      }
      await client.query('COMMIT');
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to terminate employee', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    } finally {
      client.release();
    }
  })
);

router.post(
  '/employees/:id/terminate',
  verifyTokenMiddleware,
  verifyRoleMiddleware(['ADMIN', 'HR_MANAGER']),
  asyncRoute(async (req, res) => {
    const { id } = req.params;
    const { exit_date, exit_reason } = req.body || {};
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE employees SET status='Terminated', exit_date=$1, exit_reason=$2, updated_at=NOW() WHERE id=$3 RETURNING *`,
        [exit_date || new Date(), exit_reason || null, id]
      );
      if (!result.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: 'Employee not found' });
      }
      await client.query(
        `INSERT INTO hr_employee_timeline (id, employee_id, event_type, description, event_date, performed_by, created_at)
         VALUES ($1,$2,'Terminated','Employee terminated',$3,$4,NOW())`,
        [uuidv4(), id, exit_date || new Date(), req.user.userId]
      );
      if (exit_date) {
        // trigger offboarding async
        setImmediate(async () => {
          try {
            await db.query(
              `INSERT INTO hr_offboarding_checklists (id, employee_id, exit_date, status, initiated_by, created_at)
               VALUES ($1,$2,$3,'Initiated',$4,NOW()) ON CONFLICT (employee_id) DO NOTHING`,
              [uuidv4(), id, exit_date, req.user.userId]
            );
          } catch (e) {
            logger.error('Offboarding trigger failed', { error: e.message });
          }
        });
      }
      await client.query('COMMIT');
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to terminate employee', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    } finally {
      client.release();
    }
  })
);

// ═══════════════════════════════════════════════════════════════════════════
// DOCUMENTS
// ═══════════════════════════════════════════════════════════════════════════

router.post(
  '/employees/:id/documents',
  verifyTokenMiddleware,
  upload.single('file'),
  asyncRoute(async (req, res) => {
    const { id } = req.params;
    const { doc_type, description } = req.body;
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    const result = await db.query(
      `INSERT INTO hr_employee_documents (id, employee_id, doc_type, doc_name, file_url, file_size, remarks, uploaded_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW()) RETURNING *`,
      [uuidv4(), id, doc_type, req.file.originalname, req.file.path, req.file.size || null, description || null, req.user.userId]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  })
);

router.get(
  '/employees/:id/documents',
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    const { id } = req.params;
    if (!isUUID(id)) {
      return res.status(400).json({ success: false, error: 'Invalid ID format' });
    }
    const result = await db.query(
      `SELECT * FROM hr_employee_documents WHERE employee_id = $1 ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json({ success: true, data: result.rows });
  })
);

router.delete(
  '/employees/:id/documents/:docId',
  verifyTokenMiddleware,
  verifyRoleMiddleware(['ADMIN', 'HR_MANAGER']),
  asyncRoute(async (req, res) => {
    const { docId } = req.params;
    const doc = await db.query(
      `DELETE FROM hr_employee_documents WHERE id=$1 RETURNING *`, [docId]
    );
    if (!doc.rows.length) return res.status(404).json({ success: false, error: 'Document not found' });
    try { fs.unlinkSync(doc.rows[0].file_url); } catch (_) {}
    res.json({ success: true, data: doc.rows[0] });
  })
);

// ═══════════════════════════════════════════════════════════════════════════
// ORG CHART
// ═══════════════════════════════════════════════════════════════════════════

router.get(
  '/org-chart',
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    const result = await db.query(`
      WITH RECURSIVE org AS (
        SELECT e.id, e.name, e.employee_code, e.reporting_manager_id, e.designation_id, e.department_id,
               dg.name AS designation_name, d.name AS department_name, 0 AS depth
        FROM employees e
        LEFT JOIN hr_designations dg ON dg.id = e.designation_id
        LEFT JOIN hr_departments  d  ON d.id  = e.department_id
        WHERE e.reporting_manager_id IS NULL AND e.status = 'Active'
        UNION ALL
        SELECT e.id, e.name, e.employee_code, e.reporting_manager_id, e.designation_id, e.department_id,
               dg.name, d.name, org.depth + 1
        FROM employees e
        JOIN org ON e.reporting_manager_id = org.id
        LEFT JOIN hr_designations dg ON dg.id = e.designation_id
        LEFT JOIN hr_departments  d  ON d.id  = e.department_id
        WHERE e.status = 'Active'
      )
      SELECT * FROM org ORDER BY depth, name
    `);
    res.json({ success: true, data: result.rows });
  })
);

// ═══════════════════════════════════════════════════════════════════════════
// ATS — REQUISITIONS
// ═══════════════════════════════════════════════════════════════════════════

router.get(
  '/ats/requisitions',
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    const { status, dept } = req.query;
    const conds = []; const params = [];
    if (status) { params.push(status); conds.push(`r.status = $${params.length}`); }
    if (dept)   { params.push(dept);   conds.push(`r.department_id = $${params.length}`); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const result = await db.query(
      `SELECT r.*, d.name AS department_name FROM hr_job_requisitions r
       LEFT JOIN hr_departments d ON d.id = r.department_id
       ${where} ORDER BY r.created_at DESC`,
      params
    );
    res.json({ success: true, data: result.rows });
  })
);

router.post(
  '/ats/requisitions',
  verifyTokenMiddleware,
  verifyRoleMiddleware(['ADMIN', 'HR_MANAGER']),
  asyncRoute(async (req, res) => {
    const { title, department_id, designation_id, openings, positions, job_description, description, closing_date } = req.body;
    const pos = positions || openings || 1;
    const desc = description || job_description || '';
    const result = await db.query(
      `INSERT INTO hr_job_requisitions (id, title, department_id, designation_id, positions, filled_count, description, target_date, status, raised_by, created_at)
       VALUES ($1,$2,$3,$4,$5,0,$6,$7,'Open',$8,NOW()) RETURNING *`,
      [uuidv4(), title, department_id, designation_id, pos, desc, closing_date || null, req.user.userId]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  })
);

router.put(
  '/ats/requisitions/:id/approve',
  verifyTokenMiddleware,
  verifyRoleMiddleware(['ADMIN', 'HR_MANAGER']),
  asyncRoute(async (req, res) => {
    const result = await db.query(
      `UPDATE hr_job_requisitions SET status='Approved', approved_by=$1, approved_at=NOW(), updated_at=NOW() WHERE id=$2 RETURNING *`,
      [req.user.userId, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Requisition not found' });
    res.json({ success: true, data: result.rows[0] });
  })
);

// ─── ATS — CANDIDATES ────────────────────────────────────────────────────

router.get(
  '/ats/candidates',
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    const { status, requisition_id } = req.query;
    const conds = []; const params = [];
    if (status)         { params.push(status);         conds.push(`c.stage = $${params.length}`); }
    if (requisition_id) { params.push(requisition_id); conds.push(`c.requisition_id = $${params.length}`); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const result = await db.query(
      `SELECT c.*, r.title AS requisition_title FROM hr_candidates c
       LEFT JOIN hr_job_requisitions r ON r.id = c.requisition_id
       ${where} ORDER BY c.created_at DESC`,
      params
    );
    res.json({ success: true, data: result.rows });
  })
);

router.post(
  '/ats/candidates',
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    const { requisition_id, name, email, phone, resume_url, experience_years, skills, source } = req.body;
    const result = await db.query(
      `INSERT INTO hr_candidates (id, requisition_id, name, email, phone, resume_url, experience_years, skills, source, stage, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Applied',NOW()) RETURNING *`,
      [uuidv4(), requisition_id, name, email, phone, resume_url, experience_years || 0, JSON.stringify(skills || []), source || 'Direct']
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  })
);

router.put(
  '/ats/candidates/:id/stage',
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    const { id } = req.params;
    const { stage, notes } = req.body;
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE hr_candidates SET stage=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
        [stage, id]
      );
      if (!result.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: 'Candidate not found' });
      }
      await client.query(
        `INSERT INTO hr_candidate_stages (id, candidate_id, stage, notes, created_by, created_at)
         VALUES ($1,$2,$3,$4,$5,NOW())`,
        [uuidv4(), id, stage, notes || null, req.user.userId]
      );
      await client.query('COMMIT');
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to move candidate stage', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    } finally {
      client.release();
    }
  })
);

router.post(
  '/ats/candidates/:id/ai-screen',
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    const { id } = req.params;
    const candRes = await db.query(
      `SELECT c.*, r.description AS job_description FROM hr_candidates c LEFT JOIN hr_job_requisitions r ON r.id = c.requisition_id WHERE c.id = $1`,
      [id]
    );
    if (!candRes.rows.length) return res.status(404).json({ success: false, error: 'Candidate not found' });
    const candidate = candRes.rows[0];
    const screening = await aiAgent.screenResume(candidate, candidate.job_description || '');
    await db.query(
      `UPDATE hr_candidates SET ai_score=$1, ai_summary=$2, updated_at=NOW() WHERE id=$3`,
      [screening.fitScore, JSON.stringify(screening), id]
    );
    res.json({ success: true, data: { candidate_id: id, ...screening } });
  })
);

// ─── ATS — OFFERS ────────────────────────────────────────────────────────

router.get(
  '/ats/offers',
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    const result = await db.query(
      `SELECT o.*, c.name AS candidate_name FROM hr_offer_letters o
       LEFT JOIN hr_candidates c ON c.id = o.candidate_id
       ORDER BY o.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  })
);

router.post(
  '/ats/offers/:candidateId',
  verifyTokenMiddleware,
  verifyRoleMiddleware(['ADMIN', 'HR_MANAGER']),
  asyncRoute(async (req, res) => {
    const { candidateId } = req.params;
    const { offered_ctc, joining_date, valid_till, terms } = req.body;
    const result = await db.query(
      `INSERT INTO hr_offer_letters (id, candidate_id, offered_ctc, joining_date, valid_till, terms, status, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,'Sent',$7,NOW()) RETURNING *`,
      [uuidv4(), candidateId, offered_ctc, joining_date, valid_till, terms || null, req.user.userId]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  })
);

router.put(
  '/ats/offers/:offerId',
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    const { status, decline_reason } = req.body;
    const result = await db.query(
      `UPDATE hr_offer_letters SET status=$1, decline_reason=$2, updated_at=NOW() WHERE id=$3 RETURNING *`,
      [status, decline_reason || null, req.params.offerId]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Offer not found' });
    res.json({ success: true, data: result.rows[0] });
  })
);

// ─── ATS — HIRE ──────────────────────────────────────────────────────────

router.post(
  '/ats/candidates/:id/hire',
  verifyTokenMiddleware,
  verifyRoleMiddleware(['ADMIN', 'HR_MANAGER']),
  asyncRoute(async (req, res) => {
    const { id } = req.params;
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const candRes = await client.query('SELECT * FROM hr_candidates WHERE id=$1', [id]);
      if (!candRes.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: 'Candidate not found' });
      }
      const cand = candRes.rows[0];

      // Auto employee_code
      const codeRes = await client.query(
        `SELECT COALESCE(MAX(CAST(SUBSTRING(employee_code FROM 5) AS INT)),0)+1 AS n FROM employees WHERE employee_code ~ '^EMP-[0-9]+$'`
      );
      const employee_code = `EMP-${String(codeRes.rows[0].n).padStart(4, '0')}`;
      const empId = uuidv4();

      await client.query(
        `INSERT INTO employees (id, employee_code, name, email, contact, department_id, status, join_date, created_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,'Active',NOW(),$7,NOW())`,
        [empId, employee_code, cand.name, cand.email, cand.phone, cand.department_id || null, req.user.userId]
      );

      // Auto-provision leave balances for current year
      await client.query(`SELECT fn_provision_leave_balances($1)`, [empId]);

      // Update requisition filled_count
      await client.query(
        `UPDATE hr_job_requisitions SET filled_count = filled_count + 1, updated_at=NOW() WHERE id=$1`,
        [cand.requisition_id]
      );

      // Mark candidate stage = Hired
      await client.query(
        `UPDATE hr_candidates SET stage='Hired', updated_at=NOW() WHERE id=$1`, [id]
      );
      await client.query(
        `INSERT INTO hr_candidate_stages (id, candidate_id, stage, notes, created_by, created_at)
         VALUES ($1,$2,'Hired','Converted to employee',$3,NOW())`,
        [uuidv4(), id, req.user.userId]
      );

      await client.query('COMMIT');

      // Trigger onboarding async (non-blocking) — same pattern as createEmployee
      setImmediate(async () => {
        try {
          const tpl = await db.query(
            `SELECT id, tasks FROM hr_onboarding_templates WHERE is_default = TRUE LIMIT 1`
          );
          if (tpl.rows.length) {
            const tmpl = tpl.rows[0];
            const checklistId = uuidv4();
            await db.query(
              `INSERT INTO hr_onboarding_checklists
                 (id, employee_id, template_id, status,
                  target_completion_date, created_at)
               VALUES ($1,$2,$3,'In Progress',
                       CURRENT_DATE + '30 day'::interval, NOW())
               ON CONFLICT (employee_id) DO NOTHING`,
              [checklistId, empId, tmpl.id]
            );
            // Only insert tasks if checklist was freshly created
            const inserted = await db.query(
              `SELECT id FROM hr_onboarding_checklists WHERE employee_id=$1`, [empId]
            );
            if (inserted.rows.length && inserted.rows[0].id === checklistId) {
              await _insertOnboardingTasks(checklistId, tmpl.tasks || []);
            }
          }
        } catch (e) {
          logger.error('Hire onboarding trigger failed', { error: e.message });
        }
      });

      res.status(201).json({ success: true, data: { employee_id: empId, employee_code, candidate_id: id } });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Hire transaction failed', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    } finally {
      client.release();
    }
  })
);

router.get(
  '/ats/analytics',
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    const result = await db.query(`
      SELECT r.id, r.title,
             COUNT(c.id)::INT                                          AS total_candidates,
             COUNT(c.id) FILTER (WHERE c.stage='Applied')::INT AS applied,
             COUNT(c.id) FILTER (WHERE c.stage='Screening')::INT AS screening,
             COUNT(c.id) FILTER (WHERE c.stage='Interview')::INT AS interview,
             COUNT(c.id) FILTER (WHERE c.stage='Offer')::INT   AS offer,
             COUNT(c.id) FILTER (WHERE c.stage='Hired')::INT   AS hired,
             COUNT(c.id) FILTER (WHERE c.stage='Rejected')::INT AS rejected
      FROM hr_job_requisitions r
      LEFT JOIN hr_candidates c ON c.requisition_id = r.id
      GROUP BY r.id, r.title
      ORDER BY r.created_at DESC
    `);
    res.json({ success: true, data: result.rows });
  })
);

// ═══════════════════════════════════════════════════════════════════════════
// ONBOARDING
// ═══════════════════════════════════════════════════════════════════════════

// Shared helper: insert tasks from template into a checklist
async function _insertOnboardingTasks(checklistId, tasksJson) {
  for (let i = 0; i < tasksJson.length; i++) {
    const t = tasksJson[i];
    await db.query(
      `INSERT INTO hr_onboarding_tasks
         (id, checklist_id, task_name, category, owner_type, status, due_date, display_order, created_at)
       VALUES ($1, $2, $3, $4, $5, 'Pending',
               CURRENT_DATE + ($6 || ' day')::interval, $7, NOW())`,
      [
        uuidv4(), checklistId,
        t.name || t.title || 'Onboarding Task',
        t.category || 'General',
        t.owner_type || t.assigned_role || 'HR',
        Number(t.due_day_offset || t.due_days || 0),
        i,
      ]
    );
  }
}

// GET /onboarding/active — all in-progress / overdue checklists with employee names & tasks
router.get(
  '/onboarding/active',
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    // Auto-mark overdue checklists
    await db.query(
      `UPDATE hr_onboarding_checklists
          SET status = 'Overdue'
        WHERE status = 'In Progress'
          AND target_completion_date IS NOT NULL
          AND target_completion_date < CURRENT_DATE`
    );

    const chkRes = await db.query(
      `SELECT c.*, e.name AS employee_name, e.employee_code
         FROM hr_onboarding_checklists c
         JOIN employees e ON e.id = c.employee_id
        WHERE c.status IN ('In Progress','Overdue')
        ORDER BY c.created_at DESC`
    );

    const checklists = await Promise.all(
      chkRes.rows.map(async (checklist) => {
        const tasks = await db.query(
          `SELECT id, checklist_id, task_name AS title, task_name, category,
                  owner_type, status, due_date, display_order, completed_at, notes
             FROM hr_onboarding_tasks
            WHERE checklist_id = $1
            ORDER BY display_order ASC, created_at ASC`,
          [checklist.id]
        );
        return { ...checklist, tasks: tasks.rows };
      })
    );

    res.json({ success: true, data: checklists });
  })
);

// POST /onboarding/trigger/:employeeId — (re)trigger onboarding; idempotent
router.post(
  '/onboarding/trigger/:employeeId',
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    const { employeeId } = req.params;
    if (!isUUID(employeeId)) {
      return res.status(400).json({ success: false, error: 'Invalid employee ID format' });
    }
    const tpl = await db.query(
      `SELECT * FROM hr_onboarding_templates WHERE is_default = TRUE LIMIT 1`
    );
    if (!tpl.rows.length)
      return res.status(404).json({ success: false, error: 'No default onboarding template found' });

    const tmpl = tpl.rows[0];
    const tasksJson = tmpl.tasks || [];
    const checklistId = uuidv4();

    // ON CONFLICT: delete stale checklist + tasks, then re-insert fresh
    const existing = await db.query(
      `SELECT id FROM hr_onboarding_checklists WHERE employee_id = $1`, [employeeId]
    );
    if (existing.rows.length) {
      await db.query(
        `DELETE FROM hr_onboarding_tasks WHERE checklist_id = $1`, [existing.rows[0].id]
      );
      await db.query(
        `DELETE FROM hr_onboarding_checklists WHERE employee_id = $1`, [employeeId]
      );
    }

    await db.query(
      `INSERT INTO hr_onboarding_checklists
         (id, employee_id, template_id, status,
          target_completion_date, created_at)
       VALUES ($1, $2, $3, 'In Progress',
               CURRENT_DATE + '30 day'::interval, NOW())`,
      [checklistId, employeeId, tmpl.id]
    );
    await _insertOnboardingTasks(checklistId, tasksJson);

    res.status(201).json({ success: true, data: { checklist_id: checklistId } });
  })
);

// GET /onboarding/:employeeId — single employee's latest checklist
router.get(
  '/onboarding/:employeeId',
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    const { employeeId } = req.params;
    if (!isUUID(employeeId)) {
      return res.status(400).json({ success: false, error: 'Invalid employee ID format' });
    }
    const chkRes = await db.query(
      `SELECT c.*, e.name AS employee_name, e.employee_code
         FROM hr_onboarding_checklists c
         JOIN employees e ON e.id = c.employee_id
        WHERE c.employee_id = $1
        ORDER BY c.created_at DESC
        LIMIT 1`,
      [req.params.employeeId]
    );
    if (!chkRes.rows.length) return res.json({ success: true, data: null });
    const checklist = chkRes.rows[0];
    const tasks = await db.query(
      `SELECT id, checklist_id, task_name AS title, task_name, category,
              owner_type, status, due_date, display_order, completed_at, notes
         FROM hr_onboarding_tasks
        WHERE checklist_id = $1
        ORDER BY display_order ASC, created_at ASC`,
      [checklist.id]
    );
    res.json({ success: true, data: { ...checklist, tasks: tasks.rows } });
  })
);

// PUT /onboarding/tasks/:taskId — update task; auto-completes checklist when all tasks done
router.put(
  '/onboarding/tasks/:taskId',
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    const { status, notes } = req.body;
    const completedAt = status === 'Completed' ? new Date() : null;

    const result = await db.query(
      `UPDATE hr_onboarding_tasks
          SET status=$1, completed_at=$2, notes=$3, completed_by=$4
        WHERE id=$5
        RETURNING *`,
      [status, completedAt, notes || null, req.user.userId, req.params.taskId]
    );
    if (!result.rows.length)
      return res.status(404).json({ success: false, error: 'Task not found' });

    const task = result.rows[0];

    // Auto-close checklist when every task is completed or skipped
    const remaining = await db.query(
      `SELECT COUNT(*) AS cnt
         FROM hr_onboarding_tasks
        WHERE checklist_id = $1
          AND status NOT IN ('Completed','Skipped')`,
      [task.checklist_id]
    );
    if (Number(remaining.rows[0].cnt) === 0) {
      await db.query(
        `UPDATE hr_onboarding_checklists
            SET status = 'Completed', completed_at = NOW()
          WHERE id = $1`,
        [task.checklist_id]
      );
    }

    res.json({ success: true, data: task });
  })
);

// ─── ASSETS ──────────────────────────────────────────────────────────────

router.post(
  '/assets/allocate',
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    const {
      employee_id, asset_type, asset_name, serial_number,
      batch_id, product_id, company_id, godown_id,
    } = req.body;
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const assetId = uuidv4();
      await client.query(
        `INSERT INTO hr_asset_allocations (id, company_id, employee_id, product_id, asset_type, asset_name, serial_number, condition, allocated_on, allocated_by, inventory_decremented, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'Good',CURRENT_DATE,$8,$9,NOW())`,
        [assetId, company_id || 1, employee_id, product_id || null, asset_type, asset_name, serial_number || null, req.user.userId, !!(batch_id && product_id)]
      );

      if (batch_id && product_id) {
        await ledgerHelper.postToStockLedger(client, {
          companyId: company_id, godownId: godown_id, productId: product_id,
          batchId: batch_id, movementType: 'OUT', referenceType: 'AssetAllocation',
          referenceId: assetId, referenceNumber: serial_number || assetId,
          quantity: 1, costPerUnit: 0, movementDate: new Date(),
          narration: `Asset allocated to employee ${employee_id}`,
        });
      }

      await client.query('COMMIT');
      res.status(201).json({ success: true, data: { asset_id: assetId } });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Asset allocation failed', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    } finally {
      client.release();
    }
  })
);

router.get(
  '/assets/employee/:empId',
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    const result = await db.query(
      `SELECT * FROM hr_asset_allocations WHERE employee_id=$1 ORDER BY allocated_on DESC`,
      [req.params.empId]
    );
    res.json({ success: true, data: result.rows });
  })
);

router.put(
  '/assets/:assetId/return',
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    const { batch_id, product_id, company_id, godown_id, return_condition, notes } = req.body;
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE hr_asset_allocations SET returned_on=CURRENT_DATE, return_condition=$1, notes=$2 WHERE id=$3 RETURNING *`,
        [return_condition || 'Good', notes || null, req.params.assetId]
      );
      if (!result.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: 'Asset not found' });
      }
      const asset = result.rows[0];
      if (batch_id && product_id) {
        await ledgerHelper.postToStockLedger(client, {
          companyId: company_id, godownId: godown_id, productId: product_id,
          batchId: batch_id, movementType: 'IN', referenceType: 'AssetReturn',
          referenceId: asset.id, referenceNumber: asset.serial_number || asset.id,
          quantity: 1, costPerUnit: 0, movementDate: new Date(),
          narration: `Asset returned by employee ${asset.employee_id}`,
        });
      }
      await client.query('COMMIT');
      res.json({ success: true, data: asset });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Asset return failed', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    } finally {
      client.release();
    }
  })
);

// ─── POLICIES ────────────────────────────────────────────────────────────

router.post(
  '/policies/acknowledge',
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    const { employee_id, policy_name, policy_version, policy_doc_url } = req.body;
    const version = policy_version || '1.0';
    const result = await db.query(
      `INSERT INTO hr_policy_acknowledgments (id, employee_id, policy_name, policy_version, policy_doc_url, acknowledged_at)
       VALUES ($1,$2,$3,$4,$5,NOW()) 
       ON CONFLICT (employee_id, policy_name, policy_version) DO UPDATE SET acknowledged_at=NOW() RETURNING *`,
      [uuidv4(), employee_id, policy_name, version, policy_doc_url || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  })
);

router.get(
  '/policies/employee/:empId',
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    const result = await db.query(
      `SELECT id, employee_id, policy_name AS policy_title, policy_version AS version, acknowledged_at 
       FROM hr_policy_acknowledgments
       WHERE employee_id=$1 ORDER BY acknowledged_at DESC`,
      [req.params.empId]
    );
    res.json({ success: true, data: result.rows });
  })
);

// ═══════════════════════════════════════════════════════════════════════════
// OFFBOARDING
// ═══════════════════════════════════════════════════════════════════════════

router.post(
  '/offboarding/initiate/:empId',
  verifyTokenMiddleware,
  verifyRoleMiddleware(['ADMIN', 'HR_MANAGER']),
  asyncRoute(async (req, res) => {
    const { empId } = req.params;
    const { exit_date, exit_type, notice_period_days, reason } = req.body;
    const result = await db.query(
      `INSERT INTO hr_offboarding_checklists (id, employee_id, exit_date, exit_type, notice_period_days, exit_interview_notes, status, clearance_status, initiated_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,'Initiated','{}', $7,NOW())
       ON CONFLICT (employee_id) DO UPDATE SET exit_date=$3, exit_type=$4, notice_period_days=$5, exit_interview_notes=$6, status='Initiated', updated_at=NOW()
       RETURNING *`,
      [uuidv4(), empId, exit_date || new Date(), exit_type || 'Resigned', notice_period_days || 30, reason || null, req.user.userId]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  })
);

router.get(
  '/offboarding/:empId',
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    const result = await db.query(
      `SELECT * FROM hr_offboarding_checklists WHERE employee_id=$1 ORDER BY created_at DESC LIMIT 1`,
      [req.params.empId]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'No offboarding record found' });
    res.json({ success: true, data: result.rows[0] });
  })
);

router.put(
  '/offboarding/:id/clearance',
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    let clearance_status = req.body.clearance_status;
    if (clearance_status === undefined) {
      clearance_status = req.body;
    } // object e.g. { IT: true, Finance: false }
    const result = await db.query(
      `UPDATE hr_offboarding_checklists SET clearance_status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [JSON.stringify(clearance_status), req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Offboarding record not found' });
    res.json({ success: true, data: result.rows[0] });
  })
);

// ═══════════════════════════════════════════════════════════════════════════
// ATTENDANCE
// ═══════════════════════════════════════════════════════════════════════════

router.post(
  '/attendance/clock-in',
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    const { employee_id, location } = req.body;
    const today = new Date().toISOString().slice(0, 10);
    const existing = await db.query(
      `SELECT id FROM hr_attendance WHERE employee_id=$1 AND DATE(date)=$2 LIMIT 1`,
      [employee_id, today]
    );
    if (existing.rows.length) return res.status(400).json({ success: false, error: 'Already clocked in today' });
    const result = await db.query(
      `INSERT INTO hr_attendance (id, employee_id, date, clock_in, location_in, status, created_at)
       VALUES ($1,$2,NOW(),NOW(),$3,'Present',NOW()) RETURNING *`,
      [uuidv4(), employee_id, location || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  })
);

router.post(
  '/attendance/clock-out',
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    const { employee_id } = req.body;
    const today = new Date().toISOString().slice(0, 10);
    const result = await db.query(
      `UPDATE hr_attendance SET clock_out=NOW()
       WHERE employee_id=$1 AND DATE(date)=$2 AND clock_out IS NULL RETURNING *`,
      [employee_id, today]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'No open clock-in found for today' });
    res.json({ success: true, data: result.rows[0] });
  })
);

router.get(
  '/attendance/summary',
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    const { empId, month, year } = req.query;
    if (!month || !year) return res.status(400).json({ success: false, error: 'month, year required' });
    
    let sql;
    let params;
    
    if (empId) {
      sql = `
        SELECT DATE(date)::TEXT AS date, status, clock_in, clock_out, is_regularized
        FROM hr_attendance
        WHERE employee_id=$1 AND EXTRACT(MONTH FROM date)=$2 AND EXTRACT(YEAR FROM date)=$3
        ORDER BY date`;
      params = [empId, parseInt(month), parseInt(year)];
      const result = await db.query(sql, params);
      return res.json({ success: true, data: { grid: result.rows } });
    } else {
      // Full Org View
      const employees = await db.query(`SELECT id, name FROM employees WHERE status='Active'`);
      const attendance = await db.query(`
        SELECT employee_id, DATE(date)::TEXT AS date, status
        FROM hr_attendance
        WHERE EXTRACT(MONTH FROM date)=$1 AND EXTRACT(YEAR FROM date)=$2
      `, [parseInt(month), parseInt(year)]);

      const leaves = await db.query(`
        SELECT employee_id, DATE(start_date)::TEXT as start_date, DATE(end_date)::TEXT as end_date
        FROM hr_leaves
        WHERE status='Approved' AND (
          (EXTRACT(MONTH FROM start_date)=$1 AND EXTRACT(YEAR FROM start_date)=$2) OR
          (EXTRACT(MONTH FROM end_date)=$1 AND EXTRACT(YEAR FROM end_date)=$2)
        )
      `, [parseInt(month), parseInt(year)]);

      const grid = employees.rows.map(e => {
        const empDays = attendance.rows.filter(a => a.employee_id === e.id);
        const empLeaves = leaves.rows.filter(l => l.employee_id === e.id);
        
        // Merge attendance and leaves
        const mergedDays = [...empDays];
        // Simplified leave expansion for the month
        empLeaves.forEach(l => {
          let curr = new Date(l.start_date);
          const end = new Date(l.end_date);
          while(curr <= end) {
            if (curr.getMonth() + 1 === parseInt(month)) {
              const dStr = curr.toISOString().split('T')[0];
              if (!mergedDays.find(md => md.date === dStr)) {
                mergedDays.push({ date: dStr, status: 'Leave' });
              }
            }
            curr.setDate(curr.getDate() + 1);
          }
        });

        return {
          employee_id: e.id,
          employee_name: e.name,
          days: mergedDays
        };
      });

      return res.json({ success: true, data: grid });
    }
  })
);

router.post(
  '/attendance/bulk-upload',
  verifyTokenMiddleware,
  verifyRoleMiddleware(['ADMIN', 'HR_MANAGER']),
  asyncRoute(async (req, res) => {
    const { records } = req.body; // array of { employee_id, date, status, clock_in, clock_out }
    if (!Array.isArray(records) || !records.length)
      return res.status(400).json({ success: false, error: 'records array required' });
    let inserted = 0;
    for (const r of records) {
      try {
        await db.query(
          `INSERT INTO hr_attendance (id, employee_id, date, status, clock_in, clock_out, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,NOW())
           ON CONFLICT (employee_id, date) DO UPDATE SET status=$4, clock_in=$5, clock_out=$6`,
          [uuidv4(), r.employee_id, r.date, r.status || 'Present', r.clock_in || null, r.clock_out || null]
        );
        inserted++;
      } catch (_) {}
    }
    res.json({ success: true, data: { inserted, total: records.length } });
  })
);

router.put(
  '/attendance/:id/regularize',
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    const { reason } = req.body;
    const result = await db.query(
      `UPDATE hr_attendance SET is_regularized=TRUE, regularize_reason=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [reason || null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Attendance record not found' });
    res.json({ success: true, data: result.rows[0] });
  })
);

// ═══════════════════════════════════════════════════════════════════════════
// LEAVE
// ═══════════════════════════════════════════════════════════════════════════

router.get(
  '/leave-balances/:empId',
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    const result = await db.query(
      `SELECT * FROM vw_leave_balance WHERE employee_id=$1`,
      [req.params.empId]
    );
    res.json({ success: true, data: result.rows });
  })
);

router.post(
  '/leave/apply',
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    let { employee_id, leave_policy_id, leave_type, start_date, end_date, days, reason } = req.body;
    
    if (!leave_type && leave_policy_id) {
      const policyRes = await db.query('SELECT leave_type FROM hr_leave_policies WHERE id = $1', [leave_policy_id]);
      if (policyRes.rows.length) {
        leave_type = policyRes.rows[0].leave_type;
      }
    }
    if (!leave_type) {
      leave_type = 'Casual';
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Validate balance
      let balRes = await client.query(
        `SELECT (allocated + carried_forward - used - pending_approval) AS available FROM hr_leave_balances WHERE employee_id=$1 AND leave_type=$2`,
        [employee_id, leave_type]
      );

      // AUTO-PROVISION IF MISSING
      if (!balRes.rows.length) {
        await client.query(`SELECT fn_provision_leave_balances($1)`, [employee_id]);
        balRes = await client.query(
          `SELECT (allocated + carried_forward - used - pending_approval) AS available FROM hr_leave_balances WHERE employee_id=$1 AND leave_type=$2`,
          [employee_id, leave_type]
        );
      }

      if (!balRes.rows.length || parseFloat(balRes.rows[0].available) < parseFloat(days)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: 'Insufficient leave balance' });
      }

      const leaveId = uuidv4();
      await client.query(
        `INSERT INTO hr_leaves (id, employee_id, leave_type, leave_policy_id, start_date, end_date, days, reason, status, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Pending',NOW())`,
        [leaveId, employee_id, leave_type, leave_policy_id || null, start_date, end_date, days, reason]
      );

      // Deduct pending_approval (actually add to it)
      await client.query(
        `UPDATE hr_leave_balances SET pending_approval = COALESCE(pending_approval,0) + $1 WHERE employee_id=$2 AND leave_type=$3`,
        [days, employee_id, leave_type]
      );

      await client.query('COMMIT');
      res.status(201).json({ success: true, data: { leave_id: leaveId } });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Leave apply failed', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    } finally {
      client.release();
    }
  })
);

router.put(
  '/leave/:id/approve',
  verifyTokenMiddleware,
  verifyRoleMiddleware(['ADMIN', 'HR_MANAGER']),
  asyncRoute(async (req, res) => {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const leaveRes = await client.query('SELECT * FROM hr_leaves WHERE id=$1', [req.params.id]);
      if (!leaveRes.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: 'Leave not found' });
      }
      const leave = leaveRes.rows[0];
      await client.query(
        `UPDATE hr_leaves SET status='Approved', approved_by=$1, approved_at=NOW(), updated_at=NOW() WHERE id=$2`,
        [req.user.userId, req.params.id]
      );
      await client.query(
        `UPDATE hr_leave_balances
         SET used = COALESCE(used,0) + $1,
             pending_approval = GREATEST(COALESCE(pending_approval,0) - $1, 0)
         WHERE employee_id=$2 AND leave_type=$3`,
        [leave.days, leave.employee_id, leave.leave_type || 'Casual']
      );
      await client.query('COMMIT');
      res.json({ success: true, data: { leave_id: req.params.id, status: 'Approved' } });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Leave approve failed', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    } finally {
      client.release();
    }
  })
);

router.put(
  '/leave/:id/reject',
  verifyTokenMiddleware,
  verifyRoleMiddleware(['ADMIN', 'HR_MANAGER']),
  asyncRoute(async (req, res) => {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const leaveRes = await client.query('SELECT * FROM hr_leaves WHERE id=$1', [req.params.id]);
      if (!leaveRes.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: 'Leave not found' });
      }
      const leave = leaveRes.rows[0];
      await client.query(
        `UPDATE hr_leaves SET status='Rejected', rejected_by=$1, updated_at=NOW() WHERE id=$2`,
        [req.user.userId, req.params.id]
      );
      await client.query(
        `UPDATE hr_leave_balances
         SET pending_approval = GREATEST(COALESCE(pending_approval,0) - $1, 0)
         WHERE employee_id=$2 AND leave_type=$3`,
        [leave.days, leave.employee_id, leave.leave_type || 'Casual']
      );
      await client.query('COMMIT');
      res.json({ success: true, data: { leave_id: req.params.id, status: 'Rejected' } });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Leave reject failed', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    } finally {
      client.release();
    }
  })
);

router.get(
  '/leave/team-calendar',
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    const { month, year, deptId } = req.query;
    const conds = [`EXTRACT(MONTH FROM l.start_date)=$1`, `EXTRACT(YEAR FROM l.start_date)=$2`, `l.status='Approved'`];
    const params = [parseInt(month), parseInt(year)];
    if (deptId) { params.push(deptId); conds.push(`e.department_id=$${params.length}`); }
    const result = await db.query(`
      SELECT l.*, e.name AS employee_name, e.department_id, lt.name AS leave_type
      FROM hr_leaves l
      JOIN employees e ON e.id = l.employee_id
      LEFT JOIN hr_leave_policies lt ON lt.id = l.leave_policy_id
      WHERE ${conds.join(' AND ')}
      ORDER BY l.start_date
    `, params);
    res.json({ success: true, data: result.rows });
  })
);

router.post(
  '/leave/encash',
  verifyTokenMiddleware,
  asyncRoute(async (req, res) => {
    const { employee_id, leave_policy_id, days, amount } = req.body;
    const result = await db.query(
      `INSERT INTO hr_leave_encashment (id, employee_id, leave_policy_id, days, amount, status, created_at)
       VALUES ($1,$2,$3,$4,$5,'Pending',NOW()) RETURNING *`,
      [uuidv4(), employee_id, leave_policy_id, days, amount]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  })
);

// ─── SHIFTS ──────────────────────────────────────────────────────────────

router.get('/shifts', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const result = await db.query('SELECT * FROM hr_shifts ORDER BY name');
  res.json({ success: true, data: result.rows });
}));

router.post('/shifts', verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'HR_MANAGER']), asyncRoute(async (req, res) => {
  const { name, start_time, end_time, grace_minutes, is_night_shift } = req.body;
  const result = await db.query(
    `INSERT INTO hr_shifts (id, name, start_time, end_time, grace_minutes, is_night_shift, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING *`,
    [uuidv4(), name, start_time, end_time, grace_minutes || 15, is_night_shift || false]
  );
  res.status(201).json({ success: true, data: result.rows[0] });
}));

router.post('/shifts/assign', verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'HR_MANAGER']), asyncRoute(async (req, res) => {
  const { employee_id, shift_id, effective_from, effective_to } = req.body;
  const result = await db.query(
    `INSERT INTO hr_employee_shifts (id, employee_id, shift_id, effective_from, effective_to, created_at)
     VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING *`,
    [uuidv4(), employee_id, shift_id, effective_from, effective_to || null]
  );
  res.status(201).json({ success: true, data: result.rows[0] });
}));

// ─── HOLIDAYS ─────────────────────────────────────────────────────────────

router.get('/holidays', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const { year, location } = req.query;
  const conds = []; const params = [];
  if (year)     { params.push(parseInt(year)); conds.push(`year=$${params.length}`); }
  if (location) { params.push(location);       conds.push(`(location=$${params.length} OR location='All')`); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const result = await db.query(`SELECT id, name, date, is_optional, location, year FROM hr_holiday_calendars ${where} ORDER BY date`, params);
  res.json({ success: true, data: result.rows });
}));

router.post('/holidays', verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'HR_MANAGER']), asyncRoute(async (req, res) => {
  const { name, date, location, is_optional } = req.body;
  const year = new Date(date).getFullYear();
  const result = await db.query(
    `INSERT INTO hr_holiday_calendars (id, name, date, year, location, is_optional, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING *`,
    [uuidv4(), name, date, year, location || 'All', is_optional || false]
  );
  res.status(201).json({ success: true, data: result.rows[0] });
}));

// ─── TIMESHEETS ───────────────────────────────────────────────────────────

router.post('/timesheets', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const { employee_id, project, task, work_date, hours, description } = req.body;
  const result = await db.query(
    `INSERT INTO hr_timesheet_entries (id, employee_id, date, project, task, hours, description, status, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'Approved',NOW()) RETURNING *`,
    [uuidv4(), employee_id, work_date, project, task, hours, description || null]
  );
  res.status(201).json({ success: true, data: result.rows[0] });
}));

router.get('/timesheets/:empId', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const { from, to } = req.query;
  const conds = ['employee_id=$1']; const params = [req.params.empId];
  if (from) { params.push(from); conds.push(`date >= $${params.length}`); }
  if (to)   { params.push(to);   conds.push(`date <= $${params.length}`); }
  const result = await db.query(
    `SELECT * FROM hr_timesheet_entries WHERE ${conds.join(' AND ')} ORDER BY date DESC`, params
  );
  res.json({ success: true, data: result.rows });
}));

// ─── OVERTIME ─────────────────────────────────────────────────────────────

router.post('/overtime/request', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const { employee_id, date, extra_hours, reason } = req.body;
  const result = await db.query(
    `INSERT INTO hr_overtime_requests (id, employee_id, date, extra_hours, reason, status, created_at)
     VALUES ($1,$2,$3,$4,$5,'Pending',NOW()) RETURNING *`,
    [uuidv4(), employee_id, date, extra_hours, reason]
  );
  res.status(201).json({ success: true, data: result.rows[0] });
}));

router.put('/overtime/:id/approve', verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'HR_MANAGER']), asyncRoute(async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const otRes = await client.query('SELECT * FROM hr_overtime_requests WHERE id=$1', [req.params.id]);
    if (!otRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'OT request not found' });
    }
    const ot = otRes.rows[0];
    const empRes = await client.query('SELECT base_salary FROM employees WHERE id=$1', [ot.employee_id]);
    const salary = empRes.rows[0] ? parseFloat(empRes.rows[0].base_salary) : 0;
    const ot_amount = payrollEngine.computeOvertimePay
      ? payrollEngine.computeOvertimePay(salary, ot.extra_hours)
      : parseFloat((salary / 26 / 8 * 1.5 * ot.extra_hours).toFixed(2));

    const result = await client.query(
      `UPDATE hr_overtime_requests SET status='Approved', ot_amount=$1, approved_by=$2, approved_at=NOW(), updated_at=NOW() WHERE id=$3 RETURNING *`,
      [ot_amount, req.user.userId, req.params.id]
    );
    await client.query('COMMIT');
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('OT approve failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
}));

// ─── COMP-OFF ─────────────────────────────────────────────────────────────

router.post('/comp-off/request', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const { employee_id, worked_date, reason } = req.body;
  const result = await db.query(
    `INSERT INTO hr_compensatory_off (id, employee_id, worked_date, reason, status, created_at)
     VALUES ($1,$2,$3,$4,'Pending',NOW()) RETURNING *`,
    [uuidv4(), employee_id, worked_date, reason]
  );
  res.status(201).json({ success: true, data: result.rows[0] });
}));

router.put('/comp-off/:id/approve', verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'HR_MANAGER']), asyncRoute(async (req, res) => {
  const result = await db.query(
    `UPDATE hr_compensatory_off SET status='Approved', approved_by=$1, approved_at=NOW(), updated_at=NOW() WHERE id=$2 RETURNING *`,
    [req.user.userId, req.params.id]
  );
  if (!result.rows.length) return res.status(404).json({ success: false, error: 'Comp-off record not found' });
  res.json({ success: true, data: result.rows[0] });
}));

// ═══════════════════════════════════════════════════════════════════════════
// PAYROLL v2
// ═══════════════════════════════════════════════════════════════════════════

router.get('/payroll/slips', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const { month, year } = req.query;
  const conds = []; const params = [];
  if (month) {
    const cleanMonthStr = String(month).trim();
    const m = parseMonth(month);
    params.push(cleanMonthStr, String(m), cleanMonthStr, m);
    conds.push(`(s.month = $${params.length - 3} OR s.month = $${params.length - 2} OR s.month ILIKE $${params.length - 1} OR (s.month ~ '^[0-9]+$' AND CAST(s.month AS INTEGER) = $${params.length}))`);
  }
  if (year) {
    params.push(parseInt(year));
    conds.push(`s.year = $${params.length}`);
  }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const result = await db.query(
    `SELECT s.*, e.name AS employee_name, e.employee_code FROM salary_slips s
     LEFT JOIN employees e ON e.id = s.employee_id
     ${where} ORDER BY s.created_at DESC`,
    params
  );
  res.json({ success: true, data: result.rows });
}));

router.post(['/payroll/run', '/payroll/process-bulk'], verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'HR_MANAGER']), asyncRoute(async (req, res) => {
  const { month, year, company_id } = req.body;
  if (!month || !year) return res.status(400).json({ success: false, error: 'month and year required' });

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const mName = monthNames[parseInt(month) - 1];

  const empRes = await db.query(`SELECT * FROM employees WHERE status='Active'`);
  const employees = empRes.rows;

  // BUG-1 FIX: fetch ALL statutory config rows and build proper engine config object.
  // Previously LIMIT 1 returned one raw row; engine expects pfConfig/esicConfig/ptSlabs/tdsConfig.
  const statutoryRes = await db.query(
    `SELECT config_type, state, config_data FROM hr_statutory_config
     WHERE company_id = $1 AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
     ORDER BY effective_from DESC`,
    [company_id || 1]
  );
  const sRows = statutoryRes.rows;
  const findCfg = (type) => sRows.find(r => r.config_type === type)?.config_data || {};

  // GL accounts from chart_of_accounts (looked up once per payroll run)
  const glAccRes = await db.query(
    `SELECT id, account_code FROM chart_of_accounts
     WHERE account_code IN ('5100','2300') AND company_id = $1`,
    [company_id || 1]
  );
  const glAccounts   = glAccRes.rows;
  const salaryExpAcc = glAccounts.find(a => a.account_code === '5100')?.id || null;
  const salaryPayAcc = glAccounts.find(a => a.account_code === '2300')?.id || null;

  // Build base statutory — PT slabs resolved per employee below (BUG-5)
  const baseStatutory = {
    pfConfig:   findCfg('PF_CEILING'),
    esicConfig: findCfg('ESIC_CEILING'),
    tdsConfig:  findCfg('TDS_SLAB'),
    // ptSlabs injected per employee based on work_location
  };
  // Map state → PT slabs for quick lookup
  const ptSlabsByState = {};
  for (const r of sRows.filter(r => r.config_type === 'PT_SLAB')) {
    const key = (r.state || 'DEFAULT').toUpperCase();
    ptSlabsByState[key] = r.config_data?.slabs || [];
  }

  const slipsProcessed = [];
  const voucherIds = [];
  const anomalies = [];

  for (const emp of employees) {
    try {
      console.log(`Processing ${emp.name}...`);
      // 1. Salary structure
      let structure = {};
      if (emp.salary_structure_id) {
        console.log(`Q1...`);
        const sRes = await db.query('SELECT * FROM hr_salary_structures WHERE id=$1', [emp.salary_structure_id]);
        if (sRes.rows.length) structure = sRes.rows[0];
      }

      console.log(`Q2...`);
      // 2. Attendance stats
      const attRes = await db.query(`
        SELECT
          COUNT(*) FILTER (WHERE status IN ('Present','WFH','Half-Day'))::INT AS present_days,
          COUNT(*) FILTER (WHERE status='Absent')::INT AS absent_days,
          COUNT(*) AS total_marked
        FROM hr_attendance
        WHERE employee_id=$1 AND EXTRACT(MONTH FROM date)=$2 AND EXTRACT(YEAR FROM date)=$3
      `, [emp.id, month, year]);
      const att = attRes.rows[0] || { present_days: 26, absent_days: 0 };

      console.log(`Q3...`);
      // 3. Approved OT hours
      const otRes = await db.query(`
        SELECT COALESCE(SUM(extra_hours),0) AS total_ot_hours, COALESCE(SUM(ot_amount),0) AS total_ot_amount
        FROM hr_overtime_requests
        WHERE employee_id=$1 AND status='Approved' AND EXTRACT(MONTH FROM date)=$2 AND EXTRACT(YEAR FROM date)=$3
      `, [emp.id, month, year]).catch(e => { throw new Error('Query 3 failed: ' + e.message); });
      const ot = otRes.rows[0];

      // 4. Leave encashments
      const encRes = await db.query(`
        SELECT COALESCE(SUM(amount),0) AS encashment_amount
        FROM hr_leave_encashment
        WHERE employee_id=$1 AND status='Approved'
        AND (month = $2 OR month = $3) AND year = $4
      `, [emp.id, String(month), mName, parseInt(year)]);
      const encashAmount = parseFloat(encRes.rows[0]?.encashment_amount || 0);

      // 5. Bonuses + reimbursements
      const bonusRes = await db.query(`
        SELECT COALESCE(SUM(amount),0) AS bonus_amount FROM hr_employee_bonuses
        WHERE employee_id=$1 AND status='Approved'
        AND (month = $2 OR month = $3) AND year = $4
      `, [emp.id, String(month), mName, parseInt(year)]);
      const bonusAmount = parseFloat(bonusRes.rows[0]?.bonus_amount || 0);

      const reimRes = await db.query(`
        SELECT COALESCE(SUM(amount),0) AS reimb_amount FROM hr_reimbursement_claims
        WHERE employee_id=$1 AND status='Approved'
        AND month = $2 AND year = $3
      `, [emp.id, String(month), parseInt(year)]);
      const reimbAmount = parseFloat(reimRes.rows[0]?.reimb_amount || 0);

      // 7. Compute payslip — BUG-5 FIX: inject employee state-specific PT slabs
      const empState = (emp.work_location || 'MAHARASHTRA').toUpperCase();
      const ptSlabs  = ptSlabsByState[empState]
                    || ptSlabsByState['MAHARASHTRA']
                    || ptSlabsByState['DEFAULT']
                    || [];
      const statutory = { ...baseStatutory, ptSlabs };

      const payslip = payrollEngine.computeFullPayslip(
        emp,
        structure,
        att,
        {
          overtime_hours: parseFloat(ot.total_ot_hours),
          overtime_amount: parseFloat(ot.total_ot_amount),
          leave_encash_days: 0,
          bonus: bonusAmount,
          reimbursement: reimbAmount,
        },
        statutory
      );

      // 8. Upsert salary_slips
      const slipId = uuidv4();
      await db.query(`
        INSERT INTO salary_slips (
          id, employee_id, month, year, gross_salary, net_pay, pf_employee,
          pf_employer, esic_employer, professional_tax, tds, bonus_amount, reimbursement_amount, overtime_amount,
          leave_encashment_amount, lop_days, lop_deduction, payment_status, created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'Pending',NOW())
        ON CONFLICT (employee_id, month, year) DO UPDATE SET
          gross_salary=$5, net_pay=$6, pf_employee=$7, pf_employer=$8,
          esic_employer=$9, professional_tax=$10, tds=$11, bonus_amount=$12,
          reimbursement_amount=$13, overtime_amount=$14, leave_encashment_amount=$15, lop_days=$16,
          lop_deduction=$17, updated_at=NOW()
        RETURNING id
      `, [
        slipId, emp.id, String(month), parseInt(year),
        payslip.grossSalary || 0, payslip.netPay || 0,
        payslip.pfEmployee || 0, payslip.pfEmployer || 0,
        payslip.esicEmployer || 0, payslip.ptAmount || 0, payslip.tds || 0,
        bonusAmount, reimbAmount, parseFloat(ot.total_ot_amount),
        encashAmount, payslip.lopDays || 0, payslip.lopDeduction || 0,
      ]).catch(e => { throw new Error('Query 8 failed: ' + e.message); });

      // 9. PF / ESIC / PT registers
      await db.query(`
        INSERT INTO hr_pf_registers (
          id, employee_id, month, year, uan, wages, ee_epf_contribution, er_epf_contribution, er_eps_contribution, edli_contribution, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
        ON CONFLICT (employee_id, month, year) DO UPDATE SET
          wages=$6, ee_epf_contribution=$7, er_epf_contribution=$8, er_eps_contribution=$9, edli_contribution=$10, created_at=NOW()
      `, [
        uuidv4(), emp.id, String(month), parseInt(year), emp.uan || null,
        payslip.pfDetail?.wages || 0,
        payslip.pfDetail?.eeContribution || 0,
        payslip.pfDetail?.erEpfContribution || 0,
        payslip.pfDetail?.erEpsContribution || 0,
        payslip.pfDetail?.edliContribution || 0
      ]);

      await db.query(`
        INSERT INTO hr_esic_registers (
          id, employee_id, month, year, esic_ip_number, gross_wages, ee_contribution, er_contribution, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
        ON CONFLICT (employee_id, month, year) DO UPDATE SET
          gross_wages=$6, ee_contribution=$7, er_contribution=$8, created_at=NOW()
      `, [
        uuidv4(), emp.id, String(month), parseInt(year), emp.esic_ip_number || null,
        payslip.grossSalary || 0,
        payslip.esicDetail?.eeContribution || 0,
        payslip.esicDetail?.erContribution || 0
      ]);

      await db.query(`
        INSERT INTO hr_pt_registers (
          id, employee_id, month, year, state, gross_salary, pt_amount, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
        ON CONFLICT (employee_id, month, year) DO UPDATE SET
          gross_salary=$6, pt_amount=$7, created_at=NOW()
      `, [
        uuidv4(), emp.id, String(month), parseInt(year), emp.work_location || null,
        payslip.grossSalary || 0, payslip.ptAmount || 0
      ]);

      // 10. Post GL journal
      // BUG-2 FIX: use salaryExpAcc/salaryPayAcc from chart_of_accounts (resolved once above)
      // BUG-3 FIX: engine returns netPay not netSalary
      // BUG-4 FIX: check acc_periods.is_locked before writing to GL
      const voucherId = uuidv4();
      const vDate = new Date(`${year}-${String(month).padStart(2, '0')}-28`);

      if (salaryExpAcc && salaryPayAcc) {
        const glClient = await db.getClient();
        try {
          // AP-014: check period lock
          const periodCheck = await glClient.query(
            `SELECT is_locked FROM acc_periods
             WHERE start_date <= $1 AND end_date >= $1 LIMIT 1`,
            [vDate]
          );
          if (periodCheck.rows[0]?.is_locked) {
            anomalies.push({ employee_id: emp.id, name: emp.name, issue: `GL skipped — period ${month}/${year} is locked` });
          } else {
            await glClient.query('BEGIN');
            await ledgerHelper.postToGeneralLedger(glClient, {
              accountId: salaryExpAcc, voucherId, voucherType: 'Payroll',
              transactionDate: vDate, debit: payslip.grossSalary || 0,
              narration: `Salary expense ${emp.name} ${month}/${year}`,
            });
            await ledgerHelper.postToGeneralLedger(glClient, {
              accountId: salaryPayAcc, voucherId, voucherType: 'Payroll',
              transactionDate: vDate, credit: payslip.netPay || 0,
              narration: `Net salary payable ${emp.name} ${month}/${year}`,
            });
            await glClient.query('COMMIT');
            voucherIds.push(voucherId);
          }
        } catch (glErr) {
          await glClient.query('ROLLBACK');
          anomalies.push({ employee_id: emp.id, name: emp.name, issue: `GL posting failed: ${glErr.message}` });
        } finally {
          glClient.release();
        }
      } else {
        logger.warn(`Payroll GL skipped for ${emp.name} — accounts 5100/2300 not found in chart_of_accounts`);
      }

      slipsProcessed.push({ employee_id: emp.id, name: emp.name, net: payslip.netPay });
    } catch (empErr) {
      logger.error(`Payroll processing failed for employee ${emp.id}`, { error: empErr.message });
      anomalies.push({ employee_id: emp.id, name: emp.name, issue: empErr.message });
    }
  }

  res.json({ success: true, data: { slipsProcessed: slipsProcessed.length, voucherIds, anomalies } });
}));

router.get('/payroll/slips/:id', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const result = await db.query(`
    SELECT
      s.id, s.employee_id AS "employeeId", s.month, s.year,
      s.gross_salary AS "grossSalary", s.net_pay AS "netPay",
      s.pf_employee AS "pfEmployee", s.pf_employer AS "pfEmployer",
      s.esic_employer AS "esicEmployer", s.professional_tax AS "professionalTax",
      s.tds, s.bonus_amount AS "bonusAmount",
      s.reimbursement_amount AS "reimbursementAmount",
      s.overtime_amount AS "overtimeAmount",
      s.leave_encashment_amount AS "leaveEncashmentAmount",
      s.lop_days AS "lopDays", s.lop_deduction AS "lopDeduction",
      s.payment_status AS "paymentStatus", s.bank_transfer_ref AS "bankTransferRef",
      s.paid_at AS "paidAt", s.created_at AS "createdAt",
      e.name AS "employeeName", e.employee_code AS "employeeCode",
      e.department_id AS "departmentId", e.designation_id AS "designationId",
      d.name AS "departmentName", dg.name AS "designationName"
    FROM salary_slips s
    LEFT JOIN employees e ON e.id = s.employee_id
    LEFT JOIN hr_departments d ON d.id = e.department_id
    LEFT JOIN hr_designations dg ON dg.id = e.designation_id
    WHERE s.id = $1
  `, [req.params.id]);
  if (!result.rows.length) return res.status(404).json({ success: false, error: 'Slip not found' });
  res.json({ success: true, data: result.rows[0] });
}));

router.put('/payroll/slips/:id/mark-paid', verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'HR_MANAGER']), asyncRoute(async (req, res) => {
  const { bank_transfer_ref } = req.body;
  const result = await db.query(
    `UPDATE salary_slips SET payment_status='Paid', bank_transfer_ref=$1, paid_at=NOW(), updated_at=NOW() WHERE id=$2 RETURNING *`,
    [bank_transfer_ref || null, req.params.id]
  );
  if (!result.rows.length) return res.status(404).json({ success: false, error: 'Slip not found' });
  res.json({ success: true, data: result.rows[0] });
}));

router.get('/payroll/pf-register', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const { month, year } = req.query;
  const result = await db.query(
    `SELECT r.*, e.name AS employee_name, e.employee_code FROM hr_pf_registers r LEFT JOIN employees e ON e.id=r.employee_id
     WHERE r.month=$1 AND r.year=$2 ORDER BY e.name`,
    [month, parseInt(year)]
  );
  res.json({ success: true, data: result.rows });
}));

router.get('/payroll/esic-register', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const { month, year } = req.query;
  const result = await db.query(
    `SELECT r.*, e.name AS employee_name, e.employee_code FROM hr_esic_registers r LEFT JOIN employees e ON e.id=r.employee_id
     WHERE r.month=$1 AND r.year=$2 ORDER BY e.name`,
    [month, parseInt(year)]
  );
  res.json({ success: true, data: result.rows });
}));

router.get('/payroll/pt-register', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const { month, year } = req.query;
  const result = await db.query(
    `SELECT r.*, e.name AS employee_name, e.employee_code FROM hr_pt_registers r LEFT JOIN employees e ON e.id=r.employee_id
     WHERE r.month=$1 AND r.year=$2 ORDER BY e.name`,
    [month, parseInt(year)]
  );
  res.json({ success: true, data: result.rows });
}));

router.get('/payroll/tds-workings/:empId', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const result = await db.query(
    `SELECT * FROM hr_tds_workings WHERE employee_id=$1 ORDER BY financial_year DESC LIMIT 1`,
    [req.params.empId]
  );
  res.json({ success: true, data: result.rows[0] || null });
}));

router.post('/payroll/tds/compute/:empId', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const { empId } = req.params;
  const { financial_year, regime } = req.body;
  const empRes = await db.query('SELECT * FROM employees WHERE id=$1', [empId]);
  if (!empRes.rows.length) return res.status(404).json({ success: false, error: 'Employee not found' });
  const emp = empRes.rows[0];

  const tds = payrollEngine.computeTDS
    ? payrollEngine.computeTDS(emp, { regime: regime || 'New', financial_year })
    : { estimated_annual_tax: 0, monthly_tds: 0, regime: regime || 'New' };

  await db.query(`
    INSERT INTO hr_tds_workings (id, employee_id, financial_year, regime, estimated_annual_tax, monthly_tds, computed_at)
    VALUES ($1,$2,$3,$4,$5,$6,NOW())
    ON CONFLICT (employee_id, financial_year) DO UPDATE SET
      regime=$4, estimated_annual_tax=$5, monthly_tds=$6, computed_at=NOW()
  `, [uuidv4(), empId, financial_year || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      tds.regime, tds.estimated_annual_tax || 0, tds.monthly_tds || 0]);

  res.json({ success: true, data: tds });
}));

const parseMonth = (monthStr) => {
  if (!monthStr) return new Date().getMonth() + 1;
  const parsed = parseInt(monthStr, 10);
  if (!isNaN(parsed)) return parsed;
  const months = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
    may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, september: 9,
    oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12
  };
  const clean = String(monthStr).trim().toLowerCase();
  return months[clean] || new Date().getMonth() + 1;
};

router.get('/payroll/anomalies', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const { month, year } = req.query;
  const cleanMonthStr = String(month || '').trim();
  const m = parseMonth(month);
  const y = parseInt(year) || new Date().getFullYear();
  const slips = await db.query(
    `SELECT s.*, e.name, e.base_salary FROM salary_slips s JOIN employees e ON e.id=s.employee_id
     WHERE (s.month = $1 OR s.month = $2 OR s.month ILIKE $3 OR (s.month ~ '^[0-9]+$' AND CAST(s.month AS INTEGER) = $4)) AND s.year = $5`,
    [cleanMonthStr, String(m), cleanMonthStr, m, y]
  );
  const anomalies = slips.rows.filter(s => parseFloat(s.net_pay || 0) <= 0 || parseFloat(s.net_pay || 0) > parseFloat(s.base_salary || 0) * 2)
             .map(s => ({ employee_id: s.employee_id, name: s.name, issue: 'Abnormal net salary', net: s.net_pay }));
  res.json({ success: true, data: anomalies });
}));

router.post('/payroll/anomalies', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const { month, year } = req.body;
  const cleanMonthStr = String(month || '').trim();
  const m = parseMonth(month);
  const y = parseInt(year) || new Date().getFullYear();
  const slips = await db.query(
    `SELECT s.*, e.name, e.base_salary FROM salary_slips s JOIN employees e ON e.id=s.employee_id
     WHERE (s.month = $1 OR s.month = $2 OR s.month ILIKE $3 OR (s.month ~ '^[0-9]+$' AND CAST(s.month AS INTEGER) = $4)) AND s.year = $5`,
    [cleanMonthStr, String(m), cleanMonthStr, m, y]
  );
  const anomalies = slips.rows.filter(s => parseFloat(s.net_pay || 0) <= 0 || parseFloat(s.net_pay || 0) > parseFloat(s.base_salary || 0) * 2)
             .map(s => ({ employee_id: s.employee_id, name: s.name, issue: 'Abnormal net salary', net: s.net_pay }));
  res.json({ success: true, data: { month: m, year: y, count: anomalies.length, anomalies } });
}));

router.get('/payroll/cost-summary', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const { month, year } = req.query;
  const cleanMonthStr = String(month || '').trim();
  const m = parseMonth(month);
  const y = parseInt(year) || new Date().getFullYear();
  const result = await db.query(`
    SELECT d.name AS department, COUNT(s.id)::INT AS headcount,
           SUM(s.gross_salary)::NUMERIC AS gross_total,
           SUM(s.net_pay)::NUMERIC      AS net_total,
           SUM(s.pf_employer)::NUMERIC  AS pf_employer_total
    FROM salary_slips s
    JOIN employees e ON e.id = s.employee_id
    LEFT JOIN hr_departments d ON d.id = e.department_id
    WHERE (s.month = $1 OR s.month = $2 OR s.month ILIKE $3 OR (s.month ~ '^[0-9]+$' AND CAST(s.month AS INTEGER) = $4)) AND s.year = $5
    GROUP BY d.name
    ORDER BY gross_total DESC
  `, [cleanMonthStr, String(m), cleanMonthStr, m, y]);
  res.json({ success: true, data: result.rows });
}));

// ─── INCREMENTS ───────────────────────────────────────────────────────────

router.post('/increments/create', verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'HR_MANAGER']), asyncRoute(async (req, res) => {
  const { cycle_name, effective_date, increments } = req.body;
  // increments: [{ employee_id, increment_amount, increment_pct, new_salary, reason }]
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const cycleId = uuidv4();
    await client.query(
      `INSERT INTO hr_increment_cycles (id, name, effective_date, created_by, created_at) VALUES ($1,$2,$3,$4,NOW())`,
      [cycleId, cycle_name, effective_date, req.user.userId]
    );
    for (const inc of (increments || [])) {
      await client.query(
        `INSERT INTO hr_employee_increments (id, cycle_id, employee_id, increment_amount, increment_pct, new_salary, reason, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
        [uuidv4(), cycleId, inc.employee_id, inc.increment_amount, inc.increment_pct, inc.new_salary, inc.reason || null]
      );
      await client.query(
        `UPDATE employees SET base_salary=$1, updated_at=NOW() WHERE id=$2`,
        [inc.new_salary, inc.employee_id]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ success: true, data: { cycle_id: cycleId, processed: (increments || []).length } });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Increment creation failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
}));

// ─── BONUSES ──────────────────────────────────────────────────────────────

router.post('/bonuses/process', verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'HR_MANAGER']), asyncRoute(async (req, res) => {
  const { scheme_id, bonus_date, employee_ids } = req.body;
  const schemeRes = await db.query('SELECT * FROM hr_bonus_schemes WHERE id=$1', [scheme_id]);
  if (!schemeRes.rows.length) return res.status(404).json({ success: false, error: 'Bonus scheme not found' });
  const scheme = schemeRes.rows[0];

  const emps = employee_ids?.length
    ? await db.query(`SELECT * FROM employees WHERE id = ANY($1::uuid[]) AND status='Active'`, [employee_ids])
    : await db.query(`SELECT * FROM employees WHERE status='Active'`);

  let processed = 0;
  for (const emp of emps.rows) {
    const amount = parseFloat((parseFloat(emp.base_salary || 0) * parseFloat(scheme.pct || 0) / 100).toFixed(2));
    await db.query(
      `INSERT INTO hr_employee_bonuses (id, employee_id, scheme_id, amount, bonus_date, status, created_at)
       VALUES ($1,$2,$3,$4,$5,'Approved',NOW()) ON CONFLICT DO NOTHING`,
      [uuidv4(), emp.id, scheme_id, amount, bonus_date || new Date()]
    );
    processed++;
  }
  res.json({ success: true, data: { processed } });
}));

// ─── REIMBURSEMENTS ───────────────────────────────────────────────────────

router.get('/reimbursements', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const result = await db.query(`
    SELECT r.*, e.name AS employee_name FROM hr_reimbursement_claims r
    LEFT JOIN employees e ON e.id = r.employee_id
    WHERE r.status = 'Pending' ORDER BY r.created_at DESC
  `);
  res.json({ success: true, data: result.rows });
}));

router.put('/reimbursements/:id/approve', verifyTokenMiddleware, verifyRoleMiddleware(['ADMIN', 'HR_MANAGER']), asyncRoute(async (req, res) => {
  const result = await db.query(
    `UPDATE hr_reimbursement_claims SET status='Approved', approved_by=$1, approved_at=NOW(), updated_at=NOW() WHERE id=$2 RETURNING *`,
    [req.user.userId, req.params.id]
  );
  if (!result.rows.length) return res.status(404).json({ success: false, error: 'Reimbursement not found' });
  res.json({ success: true, data: result.rows[0] });
}));

router.post('/reimbursements', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const { employee_id, category, amount, description } = req.body;
  const result = await db.query(
    `INSERT INTO hr_reimbursement_claims (id, employee_id, category, amount, description, claim_date, status, created_at)
     VALUES ($1,$2,$3,$4,$5,NOW(),'Pending',NOW()) RETURNING *`,
    [uuidv4(), employee_id, category, amount, description || null]
  );
  res.status(201).json({ success: true, data: result.rows[0] });
}));

// ─── BENEFITS ─────────────────────────────────────────────────────────────

router.get('/benefits/plans', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  let result = await db.query('SELECT * FROM hr_benefits_plans ORDER BY name');
  if (result.rows.length === 0) {
    // Seed default plans
    const defaultPlans = [
      { id: uuidv4(), name: 'Comprehensive Health Insurance (Family)', benefit_type: 'Insurance', description: 'Group health cover of ₹5L for self, spouse, and children.', is_mandatory: false },
      { id: uuidv4(), name: 'Provident Fund (EPF Compliance)', benefit_type: 'Gratuity', description: 'Statutory 12% retirement benefit fund allocation.', is_mandatory: true },
      { id: uuidv4(), name: 'NPS Enrollment Plan', benefit_type: 'NPS', description: 'National Pension Scheme voluntary retirement allocation.', is_mandatory: false },
      { id: uuidv4(), name: 'Executive Gym & Health Club', benefit_type: 'Flexible', description: 'Gym and sports facility premium membership.', is_mandatory: false }
    ];
    for (const p of defaultPlans) {
      await db.query(
        `INSERT INTO hr_benefits_plans (id, name, benefit_type, description, is_mandatory, created_at)
         VALUES ($1,$2,$3,$4,$5,NOW())`,
        [p.id, p.name, p.benefit_type, p.description, p.is_mandatory]
      );
    }
    result = await db.query('SELECT * FROM hr_benefits_plans ORDER BY name');
  }
  res.json({ success: true, data: result.rows });
}));

router.get('/benefits/enrollments', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const result = await db.query(`
    SELECT eb.*, e.name AS employee_name, bp.name AS plan_name
    FROM hr_employee_benefits eb
    JOIN employees e ON e.id = eb.employee_id
    JOIN hr_benefits_plans bp ON bp.id = eb.plan_id
    ORDER BY eb.created_at DESC
  `);
  res.json({ success: true, data: result.rows });
}));

router.post('/benefits/enroll', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const { employee_id, plan_id, premium_employee, premium_employer } = req.body;
  const result = await db.query(
    `INSERT INTO hr_employee_benefits (id, employee_id, plan_id, enrolled_on, premium_employee, premium_employer, status, created_at)
     VALUES ($1,$2,$3,NOW(),$4,$5,'Active',NOW()) RETURNING *`,
    [uuidv4(), employee_id, plan_id, premium_employee || 0, premium_employer || 0]
  );
  res.status(201).json({ success: true, data: result.rows[0] });
}));

// ═══════════════════════════════════════════════════════════════════════════
// COMPLIANCE / INCIDENTS
// ═══════════════════════════════════════════════════════════════════════════

router.get('/incidents', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const { status, type } = req.query;
  const conds = []; const params = [];
  if (status) { params.push(status); conds.push(`r.status=$${params.length}`); }
  if (type)   { params.push(type);   conds.push(`r.incident_type=$${params.length}`); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const result = await db.query(
    `SELECT r.*, e.name AS employee_name FROM hr_incidents r
     LEFT JOIN employees e ON e.id = r.involved_employee_id
     ${where} ORDER BY r.created_at DESC`,
    params
  );
  res.json({ success: true, data: result.rows });
}));

router.post('/incidents', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const { employee_id, involved_employee_id, incident_type, description, severity } = req.body;
  const targetEmp = involved_employee_id || employee_id;
  const result = await db.query(
    `INSERT INTO hr_incidents (id, involved_employee_id, incident_type, description, severity, status, reported_by, created_at)
     VALUES ($1,$2,$3,$4,$5,'Open',$6,NOW()) RETURNING *`,
    [uuidv4(), targetEmp, incident_type, description, severity || 'Medium', req.user.userId]
  );
  res.status(201).json({ success: true, data: result.rows[0] });
}));

router.put('/incidents/:id', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const { status, resolution } = req.body;
  const result = await db.query(
    `UPDATE hr_incidents SET status=$1, resolution=$2, updated_at=NOW() WHERE id=$3 RETURNING *`,
    [status, resolution || null, req.params.id]
  );
  if (!result.rows.length) return res.status(404).json({ success: false, error: 'Incident not found' });
  res.json({ success: true, data: result.rows[0] });
}));

// ═══════════════════════════════════════════════════════════════════════════
// REWARDS
// ═══════════════════════════════════════════════════════════════════════════

router.get('/rewards', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const result = await db.query(
    `SELECT r.*, e.name AS receiver_name, g.name AS giver_name
     FROM hr_rewards r
     LEFT JOIN employees e ON e.id = r.receiver_id
     LEFT JOIN employees g ON g.id = r.giver_id
     WHERE r.is_public = TRUE ORDER BY r.created_at DESC LIMIT 100`
  );
  res.json({ success: true, data: result.rows });
}));

router.post('/rewards', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const { employee_id, receiver_id, reward_type, message, points } = req.body;
  const targetReceiver = receiver_id || employee_id;
  
  let giverId = null;
  const empCheck = await db.query('SELECT id FROM employees WHERE id = $1', [req.user.userId]);
  if (empCheck.rows.length) {
    giverId = req.user.userId;
  }
  
  const result = await db.query(
    `INSERT INTO hr_rewards (id, receiver_id, reward_type, message, points, giver_id, is_public, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,TRUE,NOW()) RETURNING *`,
    [uuidv4(), targetReceiver, reward_type || 'Recognition', message, points || 0, giverId]
  );
  res.status(201).json({ success: true, data: result.rows[0] });
}));

// ═══════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════

router.get('/analytics/headcount', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const [byDept, byGrade, byType, byLocation, totalRes, activeRes] = await Promise.all([
    db.query(`SELECT d.name AS department, COUNT(e.id)::INT AS count FROM employees e LEFT JOIN hr_departments d ON d.id=e.department_id WHERE LOWER(e.status)='active' GROUP BY d.name ORDER BY count DESC`),
    db.query(`SELECT dg.grade, COUNT(e.id)::INT AS count FROM employees e LEFT JOIN hr_designations dg ON dg.id=e.designation_id WHERE LOWER(e.status)='active' GROUP BY dg.grade ORDER BY count DESC`),
    db.query(`SELECT employment_type, COUNT(*)::INT AS count FROM employees WHERE LOWER(status)='active' GROUP BY employment_type`),
    db.query(`SELECT work_location AS location, COUNT(*)::INT AS count FROM employees WHERE LOWER(status)='active' GROUP BY work_location ORDER BY count DESC`),
    db.query(`SELECT COUNT(*)::INT FROM employees WHERE LOWER(status) != 'terminated'`),
    db.query(`SELECT COUNT(*)::INT FROM employees WHERE LOWER(status)='active'`),
  ]);
  res.json({ success: true, data: { total: totalRes.rows[0].count, active: activeRes.rows[0].count, byDept: byDept.rows, byGrade: byGrade.rows, byType: byType.rows, byLocation: byLocation.rows } });
}));

router.get('/analytics/attrition', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const result = await db.query(`
    SELECT
      TO_CHAR(exit_date,'YYYY-MM') AS month,
      COUNT(*)::INT AS exits,
      exit_reason
    FROM employees
    WHERE status='Terminated' AND exit_date IS NOT NULL
    GROUP BY TO_CHAR(exit_date,'YYYY-MM'), exit_reason
    ORDER BY month DESC
  `);
  
  const totalEmployeesRes = await db.query(`SELECT COUNT(*)::INT FROM employees WHERE LOWER(status)='active'`);
  const activeCount = parseInt(totalEmployeesRes.rows[0].count || 0, 10);
  const exitsCount = result.rows.reduce((sum, row) => sum + row.exits, 0);
  const totalEmployees = activeCount + exitsCount;
  const overall_rate = totalEmployees > 0 ? Number(((exitsCount / totalEmployees) * 100).toFixed(2)) : 0.0;

  res.json({ success: true, data: { overall_rate, exits: result.rows } });
}));

router.get('/analytics/diversity', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const [gender, ageBands] = await Promise.all([
    db.query(`SELECT gender, COUNT(*)::INT AS count FROM employees WHERE LOWER(status)='active' AND gender IS NOT NULL GROUP BY gender`),
    db.query(`
      SELECT
        CASE
          WHEN AGE(dob) < INTERVAL '30 years' THEN 'Under 30'
          WHEN AGE(dob) < INTERVAL '40 years' THEN '30-39'
          WHEN AGE(dob) < INTERVAL '50 years' THEN '40-49'
          ELSE '50+'
        END AS age_band,
        COUNT(*)::INT AS count
      FROM employees WHERE LOWER(status)='active' AND dob IS NOT NULL
      GROUP BY age_band
    `),
  ]);
  res.json({ success: true, data: { gender: gender.rows, ageBands: ageBands.rows } });
}));

router.get('/analytics/hiring', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const result = await db.query(`
    SELECT
      r.title,
      COUNT(c.id)::INT AS total_applicants,
      COUNT(c.id) FILTER (WHERE c.stage='Hired')::INT AS hired,
      COUNT(ol.id) FILTER (WHERE ol.status='Accepted')::INT AS offers_accepted,
      ROUND(AVG(EXTRACT(EPOCH FROM (MIN(cs2.moved_at) - c.applied_at))/86400)::NUMERIC,1)::FLOAT AS avg_days_to_hire,
      c.source
    FROM hr_job_requisitions r
    LEFT JOIN hr_candidates c ON c.requisition_id = r.id
    LEFT JOIN hr_offer_letters ol ON ol.candidate_id = c.id
    LEFT JOIN hr_candidate_stages cs2 ON cs2.candidate_id = c.id AND cs2.stage='Hired'
    GROUP BY r.id, r.title, c.source
    ORDER BY r.created_at DESC
  `);
  res.json({ success: true, data: result.rows });
}));

router.get('/analytics/payroll-cost', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const result = await db.query(`
    SELECT year, month,
           SUM(gross_salary)::NUMERIC AS gross_total,
           SUM(net_pay)::NUMERIC      AS net_total,
           SUM(pf_employer)::NUMERIC  AS pf_cost,
           SUM(esic_employer)::NUMERIC AS esic_cost
    FROM salary_slips
    GROUP BY year, month
    ORDER BY year DESC, month DESC
    LIMIT 24
  `);
  res.json({ success: true, data: result.rows });
}));

router.get('/analytics/leave-utilization', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const result = await db.query(`
    SELECT lt.name AS leave_type,
           SUM(l.days)::NUMERIC AS total_days,
           COUNT(l.id)::INT     AS total_applications,
           COUNT(l.id) FILTER (WHERE l.status='Approved')::INT AS approved
    FROM hr_leaves l
    LEFT JOIN hr_leave_policies lt ON lt.id = l.leave_policy_id
    GROUP BY lt.name ORDER BY total_days DESC
  `);
  res.json({ success: true, data: result.rows });
}));

router.get('/analytics/compliance-score', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const [ackRes, incRes, empCount] = await Promise.all([
    db.query(`SELECT COUNT(DISTINCT employee_id)::INT AS acked FROM hr_policy_acknowledgments`),
    db.query(`SELECT COUNT(*)::INT AS total, COUNT(*) FILTER (WHERE status='Resolved')::INT AS resolved FROM hr_incidents`),
    db.query(`SELECT COUNT(*)::INT AS total FROM employees WHERE LOWER(status)='active'`),
  ]);
  const totalEmp = parseInt(empCount.rows[0]?.total) || 1;
  const ackRate = Math.round((parseInt(ackRes.rows[0]?.acked) / totalEmp) * 100);
  const incTotal = parseInt(incRes.rows[0]?.total) || 0;
  const incResRate = incTotal > 0 ? Math.round((parseInt(incRes.rows[0]?.resolved) / incTotal) * 100) : 100;
  res.json({ success: true, data: { policy_ack_pct: ackRate, incident_resolution_pct: incResRate, total_employees: totalEmp } });
}));

// ═══════════════════════════════════════════════════════════════════════════
// AI ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

router.post('/ai/attrition', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const emps = await db.query(`
    SELECT e.*, d.name AS department_name FROM employees e
    LEFT JOIN hr_departments d ON d.id = e.department_id
    WHERE LOWER(e.status) = 'active'
  `);
  const result = await aiAgent.predictAttrition(emps.rows);
  res.json({ success: true, data: result });
}));

router.post('/ai/flight-risk/:empId', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const empRes = await db.query(`
    SELECT e.*, d.name AS department_name, dg.name AS designation_name
    FROM employees e
    LEFT JOIN hr_departments d ON d.id = e.department_id
    LEFT JOIN hr_designations dg ON dg.id = e.designation_id
    WHERE e.id = $1
  `, [req.params.empId]);
  if (!empRes.rows.length) return res.status(404).json({ success: false, error: 'Employee not found' });
  const result = await aiAgent.assessFlightRisk(empRes.rows[0]);
  res.json({ success: true, data: result });
}));

router.post('/ai/promotion-readiness/:empId', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const empRes = await db.query('SELECT * FROM employees WHERE id=$1', [req.params.empId]);
  if (!empRes.rows.length) return res.status(404).json({ success: false, error: 'Employee not found' });
  const result = await aiAgent.identifyPromotionReadiness(empRes.rows[0]);
  res.json({ success: true, data: result });
}));

router.post('/ai/weekly-briefing', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const [activeRes, totalRes, pendingLeavesRes, openIncidentsRes, pendingPayrollRes, newJoinersRes] = await Promise.all([
    db.query(`SELECT COUNT(*)::INT FROM employees WHERE LOWER(status)='active'`),
    db.query(`SELECT COUNT(*)::INT FROM employees WHERE LOWER(status) != 'terminated'`),
    db.query(`SELECT COUNT(*)::INT FROM hr_leaves WHERE status='Pending'`),
    db.query(`SELECT * FROM hr_incidents WHERE status='Open'`),
    db.query(`SELECT COUNT(*)::INT FROM salary_slips WHERE payment_status='Pending'`),
    db.query(`SELECT COUNT(*)::INT FROM employees WHERE join_date >= NOW() - INTERVAL '7 days' AND LOWER(status) != 'terminated'`),
  ]);

  const stats = {
    total_employees: totalRes.rows[0].count,
    active_employees: activeRes.rows[0].count,
    pending_leaves: pendingLeavesRes.rows[0].count,
    pending_payroll: pendingPayrollRes.rows[0].count,
    new_joiners: newJoinersRes.rows[0].count,
  };

  const result = await aiAgent.generateWeeklyHRBriefing(stats, openIncidentsRes.rows);
  res.json({ success: true, data: result });
}));

router.post('/ai/copilot', verifyTokenMiddleware, asyncRoute(async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ success: false, error: 'query is required' });
  const BLOCKED = /bank|account.?number|pan|aadhaar|ifsc/i;
  if (BLOCKED.test(query)) {
    return res.status(403).json({ success: false, error: 'Query contains sensitive fields that cannot be disclosed.' });
  }
  const result = await aiAgent.handleCopilotQuery(query, { user: req.user });
  res.json({ success: true, data: result });
}));

// ─── Global error handler for this router ────────────────────────────────

router.use((err, req, res, _next) => {
  logger.error('HR route error', { error: err.message, path: req.path });
  res.status(500).json({ success: false, error: err.message });
});

module.exports = router;
