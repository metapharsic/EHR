// server/utils/password.js
// Secure Password Hashing & Validation

const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// BCRYPT_ROUNDS optimization:
// 8 rounds:  ~10ms   (not recommended - too fast)
// 9 rounds:  ~20ms   (okay for most apps)
// 10 rounds: ~50-100ms (RECOMMENDED - balanced speed & security)
// 11 rounds: ~100-150ms (high security)
// 12 rounds: ~150-300ms (maximum security, slow)
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 10; // Optimized for login speed

// ============================================
// PASSWORD HASHING
// ============================================

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password
 */
async function hashPassword(password) {
  try {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
  } catch (error) {
    throw new Error(`Password hashing failed: ${error.message}`);
  }
}

/**
 * Compare plain text password with hashed password
 * @param {string} plainPassword - Plain text password
 * @param {string} hashedPassword - Hashed password from DB
 * @returns {Promise<boolean>} - True if match
 */
async function comparePassword(plainPassword, hashedPassword) {
  try {
    return await bcrypt.compare(plainPassword, hashedPassword);
  } catch (error) {
    throw new Error(`Password comparison failed: ${error.message}`);
  }
}

// ============================================
// PASSWORD VALIDATION
// ============================================

/**
 * Validate password strength
 * Requirements:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 digit
 * - At least 1 special character
 */
function validatePasswordStrength(password) {
  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    digit: /\d/.test(password),
    specialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    noSpaces: !/\s/.test(password),
    notCommon: !isCommonPassword(password)
  };

  const isValid = Object.values(requirements).every(r => r);
  const score = Object.values(requirements).filter(r => r).length / 7 * 100;

  return {
    isValid,
    score: Math.round(score),
    requirements,
    feedback: generateFeedback(requirements)
  };
}

/**
 * Check against common passwords
 */
function isCommonPassword(password) {
  const commonPasswords = [
    'password', '123456', 'admin123', 'qwerty', 'password123',
    'admin', '12345678', '123123', 'password1', '111111'
  ];
  return commonPasswords.includes(password.toLowerCase());
}

/**
 * Generate user-friendly feedback
 */
function generateFeedback(requirements) {
  const missing = [];
  
  if (!requirements.length) missing.push('at least 8 characters');
  if (!requirements.uppercase) missing.push('at least 1 uppercase letter');
  if (!requirements.lowercase) missing.push('at least 1 lowercase letter');
  if (!requirements.digit) missing.push('at least 1 digit');
  if (!requirements.specialChar) missing.push('at least 1 special character');
  if (!requirements.noSpaces) missing.push('no spaces');
  if (!requirements.notCommon) missing.push('not a common password');

  if (missing.length === 0) {
    return '✓ Strong password';
  }

  return `Password must contain: ${missing.join(', ')}`;
}

// ============================================
// PASSWORD RESET TOKEN
// ============================================

/**
 * Generate secure reset token
 */
function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash reset token for storage (similar to password hashing)
 */
async function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Verify reset token
 */
async function verifyResetToken(token, hashedToken) {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return hash === hashedToken;
}

// ============================================
// PASSWORD HISTORY (prevent reuse)
// ============================================

/**
 * Check if new password is similar to old passwords
 * @param {string} newPassword - New password to check
 * @param {Array<string>} passwordHistory - Array of hashed old passwords
 * @returns {Promise<boolean>} - True if similar to any old password
 */
async function isPasswordReused(newPassword, passwordHistory = []) {
  for (const oldHashedPassword of passwordHistory) {
    const isSimilar = await bcrypt.compare(newPassword, oldHashedPassword);
    if (isSimilar) {
      return true;
    }
  }
  return false;
}

module.exports = {
  hashPassword,
  comparePassword,
  validatePasswordStrength,
  isCommonPassword,
  generateFeedback,
  generateResetToken,
  hashResetToken,
  verifyResetToken,
  isPasswordReused
};
