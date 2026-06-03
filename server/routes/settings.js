/**
 * Settings Routes — Metapharsic Lifesciences ERP
 * Endpoints: /api/settings/...
 *
 * Provides server-side persistence for:
 *  - Company profile
 *  - Application parameters (financialYear, GST, POS, inventory alerts)
 *  - Notification preferences
 *  - Security policy
 *  - Appearance settings
 *  - Full export / import / factory reset
 */

'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { verifyTokenMiddleware } = require('../utils/jwt');

// All settings routes require authentication
router.use(verifyTokenMiddleware);

// ─────────────────────────────────────────────────────────────────────────────
// DB TABLE BOOTSTRAP (idempotent)
// ─────────────────────────────────────────────────────────────────────────────
const bootstrapTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS erp_settings (
        key        VARCHAR(100) PRIMARY KEY,
        value      TEXT         NOT NULL,
        updated_at TIMESTAMPTZ  DEFAULT NOW()
      )
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_erp_settings_key ON erp_settings(key)
    `);
  } catch (e) {
    logger.warn('Settings table bootstrap warning', { error: e.message });
  }
};
bootstrapTable();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const getSetting = async (key) => {
  try {
    const result = await db.query(
      'SELECT value FROM erp_settings WHERE key = $1', [key]
    );
    if (!result.rows.length) return null;
    return JSON.parse(result.rows[0].value);
  } catch (e) {
    logger.warn(`getSetting(${key}) failed`, { error: e.message });
    return null;
  }
};

const upsertSetting = async (key, value) => {
  const json = JSON.stringify({ ...value, updatedAt: new Date().toISOString() });
  await db.query(`
    INSERT INTO erp_settings (key, value, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (key) DO UPDATE
      SET value      = EXCLUDED.value,
          updated_at = NOW()
  `, [key, json]);
};

const asyncRoute = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ─────────────────────────────────────────────────────────────────────────────
// COMPANY PROFILE
// ─────────────────────────────────────────────────────────────────────────────

router.get('/company', asyncRoute(async (req, res) => {
  const company = await getSetting('company_profile');
  res.json({ success: true, data: company });
}));

router.put('/company', asyncRoute(async (req, res) => {
  const {
    name, businessType, taxStructure, valuationMethod,
    financialYearStart, financialYearEnd,
    gstin, vatNumber, drugLicenseNo, foodLicenseNo,
    address, city, state, pinCode, country,
    phone, email, website, logoUrl,
  } = req.body;

  // Required field validation
  const errs = {};
  if (!name?.trim())          errs.name = 'Company name is required';
  if (!gstin?.trim())         errs.gstin = 'GSTIN is required';
  else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin.toUpperCase()))
    errs.gstin = 'Invalid GSTIN format';
  if (!drugLicenseNo?.trim()) errs.drugLicenseNo = 'Drug License No. is required';
  if (!address?.trim())       errs.address = 'Address is required';
  if (!city?.trim())          errs.city = 'City is required';
  if (!state?.trim())         errs.state = 'State is required';
  if (!pinCode?.trim())       errs.pinCode = 'PIN Code is required';
  else if (!/^\d{6}$/.test(pinCode.trim())) errs.pinCode = 'PIN Code must be 6 digits';
  if (!phone?.trim())         errs.phone = 'Phone is required';
  else if (!/^[0-9]{10,12}$/.test(phone.replace(/\D/g, '')))
    errs.phone = 'Must be 10–12 digits';
  if (!email?.trim())         errs.email = 'Email is required';
  else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Invalid email address';

  if (Object.keys(errs).length) {
    return res.status(422).json({ success: false, errors: errs });
  }

  const company = {
    name: name.trim(),
    businessType: businessType || 'Pharmaceutical',
    taxStructure: taxStructure || 'Product Wise',
    valuationMethod: valuationMethod || 'FIFO',
    financialYearStart: financialYearStart || null,
    financialYearEnd: financialYearEnd || null,
    gstin: gstin.toUpperCase().trim(),
    vatNumber: vatNumber?.trim() || null,
    drugLicenseNo: drugLicenseNo.trim(),
    foodLicenseNo: foodLicenseNo?.trim() || null,
    address: address.trim(),
    city: city.trim(),
    state: state.trim(),
    pinCode: pinCode.trim(),
    country: country || 'India',
    phone: phone.replace(/\D/g, ''),
    email: email.trim().toLowerCase(),
    website: website?.trim() || null,
    logoUrl: logoUrl || null,
  };

  await upsertSetting('company_profile', company);
  res.json({ success: true, data: company });
}));

// ─────────────────────────────────────────────────────────────────────────────
// APPLICATION PARAMETERS
// ─────────────────────────────────────────────────────────────────────────────

router.get('/parameters', asyncRoute(async (req, res) => {
  const params = await getSetting('app_parameters');
  res.json({ success: true, data: params });
}));

router.put('/parameters', asyncRoute(async (req, res) => {
  const {
    financialYear, gstEnabled, inventoryMethod,
    invoicePrefix, nextInvoiceNumber, autoPrint,
    expiryAlertDays, reorderAlertPercent,
    currency, dateFormat, sessionTimeoutMinutes,
  } = req.body;

  const errs = {};
  if (!financialYear?.trim()) errs.financialYear = 'Financial year is required';
  if (nextInvoiceNumber != null && (isNaN(nextInvoiceNumber) || nextInvoiceNumber < 1))
    errs.nextInvoiceNumber = 'Must be a positive integer';
  if (expiryAlertDays != null && (isNaN(expiryAlertDays) || expiryAlertDays < 1))
    errs.expiryAlertDays = 'Must be a positive number of days';
  if (reorderAlertPercent != null && (isNaN(reorderAlertPercent) || reorderAlertPercent < 0 || reorderAlertPercent > 100))
    errs.reorderAlertPercent = 'Must be between 0 and 100';

  if (Object.keys(errs).length) {
    return res.status(422).json({ success: false, errors: errs });
  }

  const params = {
    financialYear: (financialYear || '').trim(),
    gstEnabled: gstEnabled !== false,
    inventoryMethod: inventoryMethod || 'FIFO',
    invoicePrefix: (invoicePrefix || 'INV').toUpperCase().substring(0, 6),
    nextInvoiceNumber: Math.max(1, parseInt(nextInvoiceNumber) || 1001),
    autoPrint: autoPrint === true,
    expiryAlertDays: Math.max(1, parseInt(expiryAlertDays) || 60),
    reorderAlertPercent: Math.max(0, Math.min(100, parseInt(reorderAlertPercent) || 20)),
    currency: currency || 'INR',
    dateFormat: dateFormat || 'DD/MM/YYYY',
    sessionTimeoutMinutes: parseInt(sessionTimeoutMinutes) || 60,
  };

  await upsertSetting('app_parameters', params);

  // Cross-module sync: update company_profile.valuationMethod to stay in sync
  try {
    const company = await getSetting('company_profile');
    if (company && company.valuationMethod !== params.inventoryMethod) {
      await upsertSetting('company_profile', { ...company, valuationMethod: params.inventoryMethod });
    }
  } catch (e) {
    logger.warn('Parameters: company valuationMethod sync failed', { error: e.message });
  }

  res.json({ success: true, data: params });
}));

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION PREFERENCES
// ─────────────────────────────────────────────────────────────────────────────

router.get('/notifications', asyncRoute(async (req, res) => {
  const prefs = await getSetting('notification_prefs');
  res.json({ success: true, data: prefs });
}));

router.put('/notifications', asyncRoute(async (req, res) => {
  const { inventory, compliance, accounts, pos, hr, crm } = req.body;
  const prefs = {
    inventory: inventory !== false,
    compliance: compliance !== false,
    accounts: accounts !== false,
    pos: pos !== false,
    hr: hr === true,
    crm: crm === true,
  };
  await upsertSetting('notification_prefs', prefs);
  res.json({ success: true, data: prefs });
}));

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY POLICY
// ─────────────────────────────────────────────────────────────────────────────

router.get('/security', asyncRoute(async (req, res) => {
  const policy = await getSetting('security_policy');
  res.json({ success: true, data: policy });
}));

router.put('/security', asyncRoute(async (req, res) => {
  const {
    loginAttempts, lockoutMinutes,
    requireStrongPassword, twoFactorForAdmin,
    ipWhitelistEnabled, auditAllActions,
  } = req.body;

  const errs = {};
  if (loginAttempts != null && ![3, 5, 10].includes(parseInt(loginAttempts)))
    errs.loginAttempts = 'Must be 3, 5 or 10';
  if (lockoutMinutes != null && ![5, 15, 30, 60].includes(parseInt(lockoutMinutes)))
    errs.lockoutMinutes = 'Must be 5, 15, 30 or 60';

  if (Object.keys(errs).length) {
    return res.status(422).json({ success: false, errors: errs });
  }

  const policy = {
    loginAttempts: parseInt(loginAttempts) || 5,
    lockoutMinutes: parseInt(lockoutMinutes) || 15,
    requireStrongPassword: requireStrongPassword !== false,
    twoFactorForAdmin: twoFactorForAdmin === true,
    ipWhitelistEnabled: ipWhitelistEnabled === true,
    auditAllActions: auditAllActions !== false,
  };
  await upsertSetting('security_policy', policy);
  res.json({ success: true, data: policy });
}));

// ─────────────────────────────────────────────────────────────────────────────
// APPEARANCE SETTINGS  (new endpoint)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/appearance', asyncRoute(async (req, res) => {
  const appearance = await getSetting('appearance_settings');
  res.json({ success: true, data: appearance });
}));

router.put('/appearance', asyncRoute(async (req, res) => {
  const { darkMode, fontSize, accentColor } = req.body;
  const allowed = ['compact', 'normal', 'large'];
  const appearance = {
    darkMode: darkMode === true,
    fontSize: allowed.includes(fontSize) ? fontSize : 'normal',
    accentColor: accentColor || null,
  };
  await upsertSetting('appearance_settings', appearance);
  res.json({ success: true, data: appearance });
}));

// ─────────────────────────────────────────────────────────────────────────────
// FULL EXPORT (backup)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/export', asyncRoute(async (req, res) => {
  const [company, params, notifPrefs, security, appearance] = await Promise.all([
    getSetting('company_profile'),
    getSetting('app_parameters'),
    getSetting('notification_prefs'),
    getSetting('security_policy'),
    getSetting('appearance_settings'),
  ]);

  res.json({
    success: true,
    data: {
      metadata: {
        version: '4.2.0',
        exportedAt: new Date().toISOString(),
        appName: 'Metapharsic Lifesciences ERP',
        type: 'full_settings_backup',
      },
      company,
      appParameters: params,
      notificationPreferences: notifPrefs,
      securityPolicy: security,
      appearance,
    },
  });
}));

// ─────────────────────────────────────────────────────────────────────────────
// FULL IMPORT (restore)
// ─────────────────────────────────────────────────────────────────────────────

router.post('/import', asyncRoute(async (req, res) => {
  const { company, appParameters, notificationPreferences, securityPolicy, appearance } = req.body;

  if (!company && !appParameters && !notificationPreferences && !securityPolicy) {
    return res.status(422).json({ success: false, error: 'No valid settings payload found' });
  }

  const ops = [];
  if (company)                ops.push(upsertSetting('company_profile',    company));
  if (appParameters)          ops.push(upsertSetting('app_parameters',     appParameters));
  if (notificationPreferences)ops.push(upsertSetting('notification_prefs', notificationPreferences));
  if (securityPolicy)         ops.push(upsertSetting('security_policy',    securityPolicy));
  if (appearance)             ops.push(upsertSetting('appearance_settings', appearance));

  await Promise.all(ops);
  res.json({ success: true, message: 'Settings imported successfully' });
}));

// ─────────────────────────────────────────────────────────────────────────────
// FACTORY RESET  (new endpoint — clears all settings rows)
// ─────────────────────────────────────────────────────────────────────────────

router.post('/reset', asyncRoute(async (req, res) => {
  await db.query(`
    DELETE FROM erp_settings
     WHERE key IN ('company_profile','app_parameters','notification_prefs','security_policy','appearance_settings')
  `);
  logger.info('Factory reset executed', { userId: req.user?.userId });
  res.json({ success: true, message: 'All settings reset to factory defaults' });
}));

// ─────────────────────────────────────────────────────────────────────────────
// ERROR HANDLER (local — surfaces validation errors cleanly)
// ─────────────────────────────────────────────────────────────────────────────
router.use((err, req, res, _next) => {
  logger.error('Settings route error', { path: req.path, error: err.message });
  res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

module.exports = router;
