// server/utils/2fa.js
// Two-Factor Authentication (2FA) - TOTP & Email OTP

const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');

// ============================================
// TOTP (Time-based One-Time Password)
// ============================================

/**
 * Generate TOTP secret for user
 */
async function generateTOTPSecret(userEmail) {
  const secret = speakeasy.generateSecret({
    name: `Metapharsic ERP (${userEmail})`,
    issuer: 'Metapharsic Enterprise Hub',
    length: 32
  });

  return {
    secret: secret.base32,
    qrCode: await QRCode.toDataURL(secret.otpauth_url),
    manualEntry: secret.base32,
    backupCodes: generateBackupCodes(8) // 8 backup codes
  };
}

/**
 * Verify TOTP token
 */
function verifyTOTPToken(secret, token) {
  const window = parseInt(process.env.TOTP_WINDOW) || 2;

  const verified = speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: window
  });

  return verified;
}

/**
 * Generate backup codes (in case user loses authenticator)
 */
function generateBackupCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const formattedCode = `${code.substring(0, 4)}-${code.substring(4)}`;
    codes.push({
      code: formattedCode,
      used: false,
      createdAt: new Date()
    });
  }
  return codes;
}

/**
 * Verify and use backup code (one-time use)
 */
function verifyBackupCode(backupCodes, code) {
  const backupCode = backupCodes.find(bc => bc.code === code && !bc.used);

  if (!backupCode) {
    return { valid: false, message: 'Invalid or already used backup code' };
  }

  backupCode.used = true;
  backupCode.usedAt = new Date();

  return { valid: true, message: 'Backup code verified' };
}

// ============================================
// EMAIL OTP (for backup 2FA method)
// ============================================

/**
 * Generate email OTP
 */
function generateEmailOTP() {
  const otp = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  return {
    otp,
    expiresAt,
    createdAt: new Date()
  };
}

/**
 * Verify email OTP
 */
function verifyEmailOTP(storedOTP, providedOTP) {
  console.log('2FA Debug:', { 
    hasStored: !!storedOTP, 
    provided: providedOTP, 
    storedMatch: storedOTP ? (storedOTP.otp === providedOTP) : 'N/A'
  });

  if (!storedOTP) {
    return { valid: false, message: 'No OTP found' };
  }

  if (new Date() > storedOTP.expiresAt) {
    return { valid: false, message: 'OTP has expired', expired: true };
  }

  if (storedOTP.otp !== providedOTP) {
    return { valid: false, message: 'Invalid OTP' };
  }

  if (storedOTP.attempts >= 3) {
    return { valid: false, message: 'Too many failed attempts', locked: true };
  }

  return { valid: true, message: 'OTP verified' };
}

// ============================================
// 2FA STATUS & MANAGEMENT
// ============================================

/**
 * Initialize 2FA for user
 */
function initiate2FA(method = 'totp') {
  return {
    method, // 'totp', 'email', 'sms'
    initiatedAt: new Date(),
    verified: false,
    backupCodesGenerated: method === 'totp'
  };
}

/**
 * Complete 2FA setup
 */
function complete2FA(user2FAData, verificationCode) {
  if (verificationCode && verificationCode.length >= 6) {
    user2FAData.verified = true;
    user2FAData.enabledAt = new Date();
    return { success: true, message: '2FA enabled successfully' };
  }
  return { success: false, message: 'Invalid verification code' };
}

/**
 * Disable 2FA for user
 */
function disable2FA(user2FAData) {
  return {
    ...user2FAData,
    verified: false,
    enabledAt: null,
    disabledAt: new Date()
  };
}

// ============================================
// 2FA MIDDLEWARE
// ============================================

function verify2FAMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check if user has 2FA enabled
  if (!req.user.twoFactorEnabled) {
    return next(); // Skip 2FA if not enabled
  }

  // Check if 2FA is verified in session
  if (!req.session?.twoFactorVerified) {
    return res.status(403).json({
      error: '2FA verification required',
      code: 'REQUIRE_2FA'
    });
  }

  next();
}

// ============================================
// GENERATE OTP EMAIL TEMPLATE
// ============================================

function generateOTPEmailHTML(otp, userName) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
        .otp-box { background: white; border: 2px solid #2563eb; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
        .otp-code { font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 5px; font-family: monospace; }
        .footer { background: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
        .warning { color: #dc2626; font-size: 12px; margin-top: 10px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Metapharsic ERP - Two-Factor Authentication</h1>
        </div>
        <div class="content">
          <p>Hello ${userName},</p>
          <p>You have requested to sign in to your Metapharsic ERP account. To proceed, please use the following One-Time Password (OTP):</p>
          
          <div class="otp-box">
            <p style="margin: 0; color: #6b7280; font-size: 12px;">Your OTP is:</p>
            <div class="otp-code">${otp}</div>
            <p style="margin: 0; color: #6b7280; font-size: 12px;">Valid for 10 minutes</p>
          </div>
          
          <p><strong>Important Security Notes:</strong></p>
          <ul>
            <li>Never share this OTP with anyone</li>
            <li>Metapharsic staff will never ask for your OTP</li>
            <li>If you didn't request this code, ignore this email</li>
            <li>This OTP will expire in 10 minutes</li>
          </ul>
          
          <p>If you need further assistance, contact support@metapharsic.com</p>
        </div>
        <div class="footer">
          <p>&copy; 2026 Metapharsic Enterprise Hub. All rights reserved.</p>
          <p class="warning">⚠️ This is an automated message. Please do not reply.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = {
  generateTOTPSecret,
  verifyTOTPToken,
  generateBackupCodes,
  verifyBackupCode,
  generateEmailOTP,
  verifyEmailOTP,
  initiate2FA,
  complete2FA,
  disable2FA,
  verify2FAMiddleware,
  generateOTPEmailHTML
};
