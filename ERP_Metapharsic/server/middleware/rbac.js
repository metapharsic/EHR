// server/middleware/rbac.js
// Permission gate backed by roles/permissions/role_permissions tables.

const db = require('../db');

const permCache = new Map(); // role_id -> Set('MODULE:action')
const CACHE_TTL_MS = 60 * 1000;
let lastFlush = Date.now();

async function loadPermissions(roleId) {
  if (!roleId) return new Set();
  if (Date.now() - lastFlush > CACHE_TTL_MS) {
    permCache.clear();
    lastFlush = Date.now();
  }
  if (permCache.has(roleId)) return permCache.get(roleId);

  const { rows } = await db.query(
    `SELECT p.module_key, p.action
     FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id
     WHERE rp.role_id = $1`,
    [roleId]
  );
  const set = new Set(rows.map(r => `${r.module_key}:${r.action}`));
  permCache.set(roleId, set);
  return set;
}

function invalidateRole(roleId) {
  permCache.delete(roleId);
}

/**
 * requirePermission('ACCOUNTS', 'delete')
 * Legacy ADMIN role (no role_id yet) is always allowed — fail-open only for that
 * transition case, everyone else is fail-closed.
 */
function requirePermission(moduleKey, action) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      if (String(req.user.role || '').toUpperCase() === 'ADMIN' && !req.user.roleId) {
        return next(); // legacy admin token predating RBAC rollout
      }
      const roleId = req.user.roleId;
      if (!roleId) {
        return res.status(403).json({ error: 'Forbidden', message: 'No role assigned' });
      }
      const perms = await loadPermissions(roleId);
      if (!perms.has(`${moduleKey}:${action}`)) {
        return res.status(403).json({ error: 'Forbidden', message: `Missing permission ${moduleKey}:${action}` });
      }
      next();
    } catch (e) {
      res.status(500).json({ error: 'Permission check failed', detail: e.message });
    }
  };
}

module.exports = { requirePermission, invalidateRole, loadPermissions };
