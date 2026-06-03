/**
 * Compliance Notification Service
 * Handles email (nodemailer/Gmail) + WhatsApp (CallMeBot)
 */
const nodemailer = require("nodemailer");
const axios = require("axios");
const db = require("../db");

// ?? Email transporter ??????????????????????????????????????????????????????
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ?? Send email ?????????????????????????????????????????????????????????????
async function sendEmail(to, subject, html) {
  await transporter.sendMail({
    from: `"Metapharsic ERP Compliance" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
}

// ?? Send WhatsApp via CallMeBot ????????????????????????????????????????????
async function sendWhatsApp(phone, apikey, message) {
  const encoded = encodeURIComponent(message);
  const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encoded}&apikey=${apikey}`;
  const response = await axios.get(url, { timeout: 10000 });
  return response.data;
}

// ?? Build expiry alert HTML email ?????????????????????????????????????????
function buildExpiryEmailHtml(licenses) {
  const rows = licenses.map(l => {
    const daysLeft = Math.ceil((new Date(l.expiry_date) - new Date()) / 86400000);
    const color = daysLeft <= 7 ? "#ef4444" : daysLeft <= 15 ? "#f97316" : "#f59e0b";
    return `<tr>
      <td style="padding:10px;border-bottom:1px solid #e2e8f0">${l.name}</td>
      <td style="padding:10px;border-bottom:1px solid #e2e8f0;font-family:monospace">${l.license_number}</td>
      <td style="padding:10px;border-bottom:1px solid #e2e8f0">${l.expiry_date}</td>
      <td style="padding:10px;border-bottom:1px solid #e2e8f0;color:${color};font-weight:bold">${daysLeft} days</td>
    </tr>`;
  }).join("");

  return `
  <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
    <div style="background:#1e293b;padding:20px 24px;border-radius:8px 8px 0 0">
      <h2 style="color:#fff;margin:0">? License Expiry Alert</h2>
      <p style="color:#94a3b8;margin:4px 0 0">Metapharsic ERP ? Regulatory Compliance</p>
    </div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px">
      <p style="color:#334155">The following license(s) are expiring soon and require immediate attention:</p>
      <table style="width:100%;border-collapse:collapse;margin-top:12px">
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b">License</th>
            <th style="padding:10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b">Number</th>
            <th style="padding:10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b">Expires</th>
            <th style="padding:10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b">Days Left</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#64748b;font-size:13px;margin-top:20px">Please renew these licenses at the earliest to maintain compliance.</p>
      <a href="${process.env.APP_URL || "https://erp.metapharsic.com"}/compliance" 
         style="display:inline-block;margin-top:12px;background:#0ea5e9;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
        View in ERP ?
      </a>
    </div>
    <p style="color:#94a3b8;font-size:11px;text-align:center;margin-top:12px">Metapharsic Lifesciences ERP ? Auto-generated alert</p>
  </div>`;
}

// ?? Build WhatsApp message ?????????????????????????????????????????????????
function buildWhatsAppMessage(licenses) {
  const lines = licenses.map(l => {
    const daysLeft = Math.ceil((new Date(l.expiry_date) - new Date()) / 86400000);
    return `? ${l.name} (${l.license_number}) ? expires ${l.expiry_date} [${daysLeft} days]`;
  }).join("\n");
  return `? *Metapharsic ERP ? License Expiry Alert*\n\nThe following license(s) need renewal:\n\n${lines}\n\nPlease take action immediately.`;
}

// ?? Main: send expiry alerts ???????????????????????????????????????????????
async function sendExpiryAlerts(licenses, settings) {
  const results = { email: null, whatsapp: null };
  if (!licenses.length) return results;

  // Email
  if (settings.email_enabled && settings.email_address) {
    try {
      await sendEmail(
        settings.email_address,
        `? ${licenses.length} License(s) Expiring Soon ? Action Required`,
        buildExpiryEmailHtml(licenses)
      );
      results.email = "sent";
      // Log
      for (const l of licenses) {
        await db.query(
          "INSERT INTO compliance_notification_log (license_id,channel,message,status) VALUES ($1,$2,$3,$4)",
          [l.id, "email", `Expiry alert sent to ${settings.email_address}`, "sent"]
        ).catch(() => {});
      }
    } catch (err) {
      results.email = `failed: ${err.message}`;
    }
  }

  // WhatsApp
  if (settings.whatsapp_enabled && settings.whatsapp_number && settings.whatsapp_apikey) {
    try {
      await sendWhatsApp(settings.whatsapp_number, settings.whatsapp_apikey, buildWhatsAppMessage(licenses));
      results.whatsapp = "sent";
      for (const l of licenses) {
        await db.query(
          "INSERT INTO compliance_notification_log (license_id,channel,message,status) VALUES ($1,$2,$3,$4)",
          [l.id, "whatsapp", `WhatsApp alert sent to ${settings.whatsapp_number}`, "sent"]
        ).catch(() => {});
      }
    } catch (err) {
      results.whatsapp = `failed: ${err.message}`;
    }
  }

  return results;
}

// ?? Test notification (single test email/WA) ??????????????????????????????
async function sendTestNotification(settings, channel) {
  if (channel === "email" && settings.email_address) {
    await sendEmail(
      settings.email_address,
      "? Metapharsic ERP ? Compliance Notification Test",
      `<div style="font-family:sans-serif;padding:24px">
        <h2>? Email Notifications Working!</h2>
        <p>This is a test notification from Metapharsic ERP Compliance module.</p>
        <p style="color:#64748b;font-size:13px">You will receive alerts at this email when licenses are expiring.</p>
      </div>`
    );
    return { success: true, message: `Test email sent to ${settings.email_address}` };
  }
  if (channel === "whatsapp" && settings.whatsapp_number && settings.whatsapp_apikey) {
    await sendWhatsApp(
      settings.whatsapp_number,
      settings.whatsapp_apikey,
      "? *Metapharsic ERP* ? WhatsApp notifications are working! You will receive license expiry alerts here."
    );
    return { success: true, message: `Test WhatsApp sent to ${settings.whatsapp_number}` };
  }
  throw new Error("Channel not configured");
}

module.exports = { sendExpiryAlerts, sendTestNotification };
