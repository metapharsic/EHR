/**
 * Compliance Expiry Cron Job
 * Runs daily at 9:00 AM ? checks expiring licenses and sends alerts
 */
const cron = require("node-cron");
const db = require("../db");
const { sendExpiryAlerts } = require("./complianceNotificationService");

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

// Schedule: every day at 9:00 AM
function startComplianceCron() {
  cron.schedule("0 9 * * *", checkAndAlert, { timezone: "Asia/Kolkata" });
  cron.schedule("0 9 * * *", checkCustomerCompliance, { timezone: "Asia/Kolkata" });
  console.log("[ComplianceCron] Scheduled daily license + customer compliance checks at 9:00 AM IST");
}

module.exports = { startComplianceCron, checkAndAlert, checkCustomerCompliance };
