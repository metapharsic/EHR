/**
 * User Management / RBAC Routes — Metapharsic ERP
 * Endpoints: /api/admin/...
 */

'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { verifyTokenMiddleware } = require('../utils/jwt');
const { requirePermission, invalidateRole } = require('../middleware/rbac');
const { hashPassword, validatePasswordStrength } = require('../utils/password');

router.use(verifyTokenMiddleware);

const auditLog = async (actorId, targetUserId, field, oldVal, newVal) => {
  try {
    await db.query(
      `INSERT INTO user_audit_log (actor_id, target_user_id, field_changed, old_value, new_value)
       VALUES ($1,$2,$3,$4,$5)`,
      [actorId || null, targetUserId || null, field, oldVal != null ? String(oldVal) : null, newVal != null ? String(newVal) : null]
    );
  } catch (e) {
    logger.error('user_audit_log insert failed', { error: e.message });
  }
};

// ── ROLES ───────────────────────────────────────────────────────────────
router.get('/roles', requirePermission('USER_MANAGEMENT', 'view'), async (req, res) => {
  try {
    const companyId = req.user.companyId || 1;
    const { rows } = await db.query(
      `SELECT r.*, COUNT(DISTINCT rp.permission_id) as permission_count,
              COUNT(DISTINCT u.id) as user_count
       FROM roles r
       LEFT JOIN role_permissions rp ON rp.role_id = r.id
       LEFT JOIN users u ON u.role_id = r.id
       WHERE r.company_id = $1
       GROUP BY r.id ORDER BY r.is_system DESC, r.name`,
      [companyId]
    );
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/roles/:id/permissions', requirePermission('USER_MANAGEMENT', 'view'), async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT p.id, p.module_key, p.action,
              EXISTS(SELECT 1 FROM role_permissions rp WHERE rp.role_id=$1 AND rp.permission_id=p.id) as granted
       FROM permissions p ORDER BY p.module_key, p.action`,
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/roles', requirePermission('USER_MANAGEMENT', 'create'), async (req, res) => {
  try {
    const { name, description, cloneFromRoleId } = req.body;
    const companyId = req.user.companyId || 1;
    if (!name) return res.status(400).json({ success: false, error: 'name required' });

    const { rows } = await db.query(
      `INSERT INTO roles (name, description, company_id, created_by)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [name, description || null, companyId, req.user.userId]
    );
    const role = rows[0];

    if (cloneFromRoleId) {
      await db.query(
        `INSERT INTO role_permissions (role_id, permission_id, granted_by)
         SELECT $1, permission_id, $2 FROM role_permissions WHERE role_id = $3
         ON CONFLICT DO NOTHING`,
        [role.id, req.user.userId, cloneFromRoleId]
      );
    }
    res.status(201).json({ success: true, data: role });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ success: false, error: 'Role name already exists' });
    res.status(500).json({ success: false, error: e.message });
  }
});

router.patch('/roles/:id/permissions', requirePermission('USER_MANAGEMENT', 'edit'), async (req, res) => {
  try {
    const { permissionId, granted } = req.body;
    if (!permissionId || typeof granted !== 'boolean') {
      return res.status(400).json({ success: false, error: 'permissionId and granted(boolean) required' });
    }
    const { rows: roleRows } = await db.query('SELECT is_system, name FROM roles WHERE id=$1', [req.params.id]);
    if (!roleRows.length) return res.status(404).json({ success: false, error: 'Role not found' });

    if (granted) {
      await db.query(
        `INSERT INTO role_permissions (role_id, permission_id, granted_by)
         VALUES ($1,$2,$3) ON CONFLICT (role_id, permission_id) DO NOTHING`,
        [req.params.id, permissionId, req.user.userId]
      );
    } else {
      await db.query(`DELETE FROM role_permissions WHERE role_id=$1 AND permission_id=$2`, [req.params.id, permissionId]);
    }
    invalidateRole(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.delete('/roles/:id', requirePermission('USER_MANAGEMENT', 'delete'), async (req, res) => {
  try {
    const { rows } = await db.query('SELECT is_system FROM roles WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Role not found' });
    if (rows[0].is_system) return res.status(400).json({ success: false, error: 'Cannot delete system role' });

    const { rows: usage } = await db.query('SELECT COUNT(*) FROM users WHERE role_id=$1', [req.params.id]);
    if (Number(usage[0].count) > 0) {
      return res.status(400).json({ success: false, error: 'Role in use — reassign users before deleting' });
    }
    await db.query('DELETE FROM roles WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── USERS ───────────────────────────────────────────────────────────────
router.get('/users', requirePermission('USER_MANAGEMENT', 'view'), async (req, res) => {
  try {
    const companyId = req.user.companyId || 1;
    const { rows } = await db.query(
      `SELECT u.id, u.username, u.email, u.name, u.role, u.role_id, r.name as role_name,
              u.phone, u.department, u.status, u.two_factor_enabled, u.last_login, u.created_at
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.company_id = $1
       ORDER BY u.created_at DESC`,
      [companyId]
    );
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/users', requirePermission('USER_MANAGEMENT', 'create'), async (req, res) => {
  try {
    const { username, email, name, password, roleId, phone, department } = req.body;
    const companyId = req.user.companyId || 1;
    if (!username || !email || !name || !password || !roleId) {
      return res.status(400).json({ success: false, error: 'username, email, name, password, roleId required' });
    }
    const pw = validatePasswordStrength(password);
    if (!pw.isValid) return res.status(400).json({ success: false, error: 'Weak password', feedback: pw.feedback });

    const dup = await db.query('SELECT id FROM users WHERE username=$1 OR email=$2', [username, email]);
    if (dup.rows.length) return res.status(409).json({ success: false, error: 'Username or email already exists' });

    const { rows: roleRows } = await db.query('SELECT name FROM roles WHERE id=$1 AND company_id=$2', [roleId, companyId]);
    if (!roleRows.length) return res.status(400).json({ success: false, error: 'Invalid roleId' });

    const hashed = await hashPassword(password);
    const { rows } = await db.query(
      `INSERT INTO users (username, email, password_hash, name, role, role_id, phone, department, company_id, status, login_attempts, risk_score, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Active',0,0,NOW(),NOW())
       RETURNING id, username, email, name, role, role_id, phone, department, status`,
      [username, email, hashed, name, roleRows[0].name, roleId, phone || null, department || null, companyId]
    );
    await auditLog(req.user.userId, rows[0].id, 'created', null, username);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.put('/users/:id', requirePermission('USER_MANAGEMENT', 'edit'), async (req, res) => {
  try {
    const { name, email, phone, department, roleId, status } = req.body;
    const { rows: existingRows } = await db.query('SELECT * FROM users WHERE id=$1', [req.params.id]);
    if (!existingRows.length) return res.status(404).json({ success: false, error: 'User not found' });
    const existing = existingRows[0];

    if (roleId && roleId !== existing.role_id) {
      const { rows: adminRoleRows } = await db.query(`SELECT id FROM roles WHERE name='ADMIN' AND company_id=$1`, [existing.company_id || 1]);
      const isRemovingLastAdmin = adminRoleRows.length && existing.role_id === adminRoleRows[0].id;
      if (isRemovingLastAdmin) {
        const { rows: adminCount } = await db.query(`SELECT COUNT(*) FROM users WHERE role_id=$1 AND status='Active'`, [existing.role_id]);
        if (Number(adminCount[0].count) <= 1) {
          return res.status(400).json({ success: false, error: 'Cannot remove last active admin' });
        }
      }
    }

    let roleName = existing.role;
    if (roleId) {
      const { rows: roleRows } = await db.query('SELECT name FROM roles WHERE id=$1', [roleId]);
      if (roleRows.length) roleName = roleRows[0].name;
    }

    const { rows } = await db.query(
      `UPDATE users SET
         name = COALESCE($1, name),
         email = COALESCE($2, email),
         phone = COALESCE($3, phone),
         department = COALESCE($4, department),
         role_id = COALESCE($5, role_id),
         role = $6,
         status = COALESCE($7, status),
         updated_at = NOW()
       WHERE id = $8
       RETURNING id, username, email, name, role, role_id, phone, department, status`,
      [name, email, phone, department, roleId, roleName, status, req.params.id]
    );

    if (roleId && roleId !== existing.role_id) {
      await auditLog(req.user.userId, req.params.id, 'role_id', existing.role_id, roleId);
    }
    if (status && status !== existing.status) {
      await auditLog(req.user.userId, req.params.id, 'status', existing.status, status);
    }
    res.json({ success: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/users/:id/reset-password', requirePermission('USER_MANAGEMENT', 'edit'), async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ success: false, error: 'newPassword required' });
    const pw = validatePasswordStrength(newPassword);
    if (!pw.isValid) return res.status(400).json({ success: false, error: 'Weak password', feedback: pw.feedback });

    const hashed = await hashPassword(newPassword);
    await db.query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [hashed, req.params.id]);
    await auditLog(req.user.userId, req.params.id, 'password_reset', null, null);
    res.json({ success: true, message: 'Password reset' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/users/:id/deactivate', requirePermission('USER_MANAGEMENT', 'delete'), async (req, res) => {
  try {
    if (req.params.id === req.user.userId) {
      return res.status(400).json({ success: false, error: 'Cannot deactivate your own account' });
    }
    const { rows: existingRows } = await db.query('SELECT status FROM users WHERE id=$1', [req.params.id]);
    if (!existingRows.length) return res.status(404).json({ success: false, error: 'User not found' });

    await db.query(`UPDATE users SET status='Inactive', updated_at=NOW() WHERE id=$1`, [req.params.id]);
    await db.query('DELETE FROM refresh_tokens WHERE user_id=$1', [req.params.id]);
    await auditLog(req.user.userId, req.params.id, 'status', existingRows[0].status, 'Inactive');
    res.json({ success: true, message: 'User deactivated' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/users/:id/reactivate', requirePermission('USER_MANAGEMENT', 'edit'), async (req, res) => {
  try {
    await db.query(`UPDATE users SET status='Active', updated_at=NOW() WHERE id=$1`, [req.params.id]);
    await auditLog(req.user.userId, req.params.id, 'status', 'Inactive', 'Active');
    res.json({ success: true, message: 'User reactivated' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── AUDIT ────────────────────────────────────────────────────────────────
router.get('/audit/users', requirePermission('USER_MANAGEMENT', 'view'), async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT a.*, actor.name as actor_name, target.name as target_name
       FROM user_audit_log a
       LEFT JOIN users actor ON actor.id = a.actor_id
       LEFT JOIN users target ON target.id = a.target_user_id
       ORDER BY a.created_at DESC LIMIT 200`
    );
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/audit/kafka-events', requirePermission('USER_MANAGEMENT', 'view'), async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT topic, event_type, module, entity_type, entity_id, path, method, actor_username, status, created_at
       FROM kafka_event_log ORDER BY created_at DESC LIMIT 200`
    );
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
