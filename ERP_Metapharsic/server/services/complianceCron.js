/**
 * Compliance Expiry Cron Job
 * Runs daily at 9:00 AM ? checks expiring licenses and sends alerts
 */
const cron = require("node-cron");
const db = require("../db");
const { sendExpiryAlerts, sendEmail } = require("./complianceNotificationService");

async function checkAndAlert() {
  try {
    const settingsRes = await db.query("SELECT * FROM compliance_notification_settings LIMIT 1");
    if (!settingsRes.rows.length) return;
    const settings = settingsRes.rows[0];

    // Build alert days from settings
    const days = [];
    if (settings.alert_days_30) days.push(30);
    if (settings.alert_days_15) days.push(15);
    if (settings.alert_days_7)  days.push(7);
    if (settings.alert_days_1)  days.push(1);
    if (!days.length) return;

    // Find licenses expiring on those exact day-counts
    const placeholders = days.map((_, i) => `$${i + 1}`).join(",");
    const { rows: expiring } = await db.query(
      `SELECT * FROM drug_licenses
       WHERE expiry_date IS NOT NULL
         AND EXTRACT(DAY FROM expiry_date - CURRENT_DATE) = ANY(ARRAY[${placeholders}]::int[])
         AND status != 'Expired'
       ORDER BY expiry_date ASC`,
      days
    );

    if (expiring.length > 0) {
      const result = await sendExpiryAlerts(expiring, settings);
      console.log(`[ComplianceCron] Sent alerts for ${expiring.length} license(s):`, result);
    } else {
      console.log("[ComplianceCron] No licenses expiring today's alert thresholds.");
    }
  } catch (err) {
    console.error("[ComplianceCron] Error:", err.message);
  }
}

// Customer compliance alert — checks parties table for expiring/expired docs
async function checkCustomerCompliance() {
  try {
    const { rows } = await db.query(`
      SELECT p.name, p.drug_license_no as license_number, p.mobile,
             p.whatsapp_number, p.email, p.entity_type,
             LEAST(p.dl_20a_expiry, p.dl_20b_expiry, p.dl_20c_expiry, p.dl_20d_expiry,
                   p.dl_expiry_date, p.pharmacist_reg_expiry, p.hospital_reg_expiry,
                   p.fssai_expiry, p.firm_reg_expiry) as expiry_date
      FROM parties p
      WHERE p.type IN ('Debtor','Both')
        AND p.status = 'Active'
        AND LEAST(p.dl_20a_expiry, p.dl_20b_expiry, p.dl_20c_expiry, p.dl_20d_expiry,
                  p.dl_expiry_date, p.pharmacist_reg_expiry, p.hospital_reg_expiry,
                  p.fssai_expiry, p.firm_reg_expiry) <= CURRENT_DATE + 90
      ORDER BY expiry_date ASC
    `);
    if (rows.length) {
      await sendExpiryAlerts(rows);
      console.log(`[CustomerComplianceCron] Alerted for ${rows.length} customer(s)`);
    } else {
      console.log('[CustomerComplianceCron] All customer docs OK.');
    }
  } catch (err) {
    console.error('[CustomerComplianceCron] Error:', err.message);
  }
}

// Mirrors frontend completenessScore() in CustomerDatabasePage.tsx — same 11 fields, same weight.
// Keep both in sync if the required-field list ever changes.
function profileCompletionScore(p) {
  const checks = [
    !!p.mobile, !!p.city, !!p.state, !!p.pin_code, !!p.email,
    !!p.gstin, !!p.pan, !!p.drug_license_no,
    !!(p.credit_limit && Number(p.credit_limit) > 0),
    !!p.address, !!p.contact_person,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

// Daily reminder: any Active customer profile below 80% complete → email admin + escalation contact.
async function checkProfileCompletion() {
  try {
    const settingsRes = await db.query("SELECT * FROM compliance_notification_settings LIMIT 1");
    if (!settingsRes.rows.length) return;
    const settings = settingsRes.rows[0];

    const { rows: customers } = await db.query(`
      SELECT name, mobile, city, state, pin_code, email, gstin, pan, drug_license_no, credit_limit, address, contact_person
      FROM parties WHERE type IN ('Debtor','Both') AND status = 'Active'
    `);

    const incomplete = customers
      .map(c => ({ ...c, score: profileCompletionScore(c) }))
      .filter(c => c.score < 80)
      .sort((a, b) => a.score - b.score);

    if (!incomplete.length) {
      console.log('[ProfileCompletionCron] All customer profiles ≥80% complete.');
      return;
    }

    const recipients = [settings.email_address, settings.escalation_email].filter(Boolean);
    if (!recipients.length) {
      console.warn('[ProfileCompletionCron] No admin/escalation email configured — skipping alert.');
      return;
    }

    const rows = incomplete.map(c => `<tr>
      <td style="padding:10px;border-bottom:1px solid #e2e8f0">${c.name}</td>
      <td style="padding:10px;border-bottom:1px solid #e2e8f0">${c.mobile || '—'}</td>
      <td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:bold;color:${c.score < 50 ? '#ef4444' : '#f59e0b'}">${c.score}%</td>
    </tr>`).join('');

    const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#1e293b;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="color:#fff;margin:0">Customer Database — Incomplete Profiles</h2>
        <p style="color:#94a3b8;margin:4px 0 0">Metapharsic ERP — Data Quality Reminder</p>
      </div>
      <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px">
        <p style="color:#334155">${incomplete.length} customer(s) are below the 80% profile-completion target:</p>
        <table style="width:100%;border-collapse:collapse;margin-top:12px">
          <thead><tr style="background:#f8fafc">
            <th style="padding:10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b">Customer</th>
            <th style="padding:10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b">Mobile</th>
            <th style="padding:10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b">Completion</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="color:#64748b;font-size:13px;margin-top:20px">Please complete these customer records (address, GST, license, contact person, etc.) in Customer DB.</p>
      </div>
    </div>`;

    for (const to of recipients) {
      await sendEmail(to, `⚠️ ${incomplete.length} Customer Profile(s) Below 80% Complete`, html)
        .catch(e => console.error(`[ProfileCompletionCron] Email to ${to} failed:`, e.message));
    }
    console.log(`[ProfileCompletionCron] Alerted ${recipients.length} recipient(s) for ${incomplete.length} incomplete profile(s)`);
  } catch (err) {
    console.error('[ProfileCompletionCron] Error:', err.message);
  }
}

// Schedule: every day at 9:00 AM
function startComplianceCron() {
  cron.schedule("0 9 * * *", checkAndAlert, { timezone: "Asia/Kolkata" });
  cron.schedule("0 9 * * *", checkCustomerCompliance, { timezone: "Asia/Kolkata" });
  cron.schedule("0 9 * * *", checkProfileCompletion, { timezone: "Asia/Kolkata" });
  console.log("[ComplianceCron] Scheduled daily license + customer compliance + profile-completion checks at 9:00 AM IST");
}

module.exports = { startComplianceCron, checkAndAlert, checkCustomerCompliance, checkProfileCompletion };
