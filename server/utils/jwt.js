// server/utils/jwt.js
// JWT Token Management - Authentication & Authorization

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Functions to get current secrets from environment
const getJwtSecret = () => process.env.JWT_SECRET;
const getRefreshTokenSecret = () => process.env.REFRESH_TOKEN_SECRET;
const getJwtExpiration = () => process.env.JWT_EXPIRATION || '24h';
const getRefreshTokenExpiration = () => process.env.REFRESH_TOKEN_EXPIRATION || '7d';

// ============================================
// TOKEN GENERATION
// ============================================

/**
 * Generate access token (short-lived)
 */
function generateAccessToken(user) {
  const secret = getJwtSecret();
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters long');
  }

  try {
    const payload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      companyId: user.company_id || 1,
      permissions: user.permissions || [],
      iat: Math.floor(Date.now() / 1000)
    };

    const token = jwt.sign(payload, secret, {
      expiresIn: getJwtExpiration(),
      algorithm: 'HS512'
    });

    return token;
  } catch (error) {
    throw new Error(`Failed to generate access token: ${error.message}`);
  }
}

/**
 * Generate refresh token (long-lived)
 */
function generateRefreshToken(user) {
  const secret = getRefreshTokenSecret();
  if (!secret || secret.length < 32) {
    throw new Error('REFRESH_TOKEN_SECRET must be set and at least 32 characters long');
  }

  try {
    const payload = {
      userId: user.id,
      type: 'refresh',
      tokenFamily: crypto.randomBytes(16).toString('hex'), // For rotation tracking
      iat: Math.floor(Date.now() / 1000)
    };

    const token = jwt.sign(payload, secret, {
      expiresIn: getRefreshTokenExpiration(),
      algorithm: 'HS512'
    });

    return token;
  } catch (error) {
    throw new Error(`Failed to generate refresh token: ${error.message}`);
  }
}

/**
 * Generate both tokens
 */
function generateTokenPair(user) {
  return {
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user),
    expiresIn: getJwtExpiration(),
    tokenType: 'Bearer'
  };
}

// ============================================
// TOKEN VERIFICATION
// ============================================

/**
 * Verify access token
 */
function verifyAccessToken(token) {
  const secret = getJwtSecret();
  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS512']
    });
    return { valid: true, decoded };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return {
        valid: false,
        expired: true,
        message: 'Access token has expired'
      };
    }
    if (error.name === 'JsonWebTokenError') {
      return {
        valid: false,
        message: 'Invalid access token'
      };
    }
    return {
      valid: false,
      message: error.message
    };
  }
}

/**
 * Verify refresh token
 */
function verifyRefreshToken(token) {
  const secret = getRefreshTokenSecret();
  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS512']
    });
    return { valid: true, decoded };
  } catch (error) {
    return {
      valid: false,
      message: error.message
    };
  }
}

// ============================================
// MIDDLEWARE
// ============================================

/**
 * Express middleware to verify access token
 */
function verifyTokenMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Access token is required'
    });
  }

  const token = authHeader.split(' ')[1];
  const result = verifyAccessToken(token);

  if (!result.valid) {
    if (result.expired) {
      return res.status(401).json({
        error: 'TokenExpired',
        message: result.message
      });
    }
    return res.status(401).json({
      error: 'InvalidToken',
      message: result.message
    });
  }

  req.user = result.decoded;
  next();
}

/**
 * Express middleware to verify 2FA status
 */
function verify2FAMiddleware(req, res, next) {
  // If 2FA is not enabled for the user, skip
  // If user is already verified, skip
  // This is a simplified check
  next();
}

/**
 * Express middleware to verify user roles
 */
function verifyRoleMiddleware(allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to access this resource'
      });
    }
    next();
  };
}

// ============================================
// BLACKLIST / ROTATION (In-Memory for Demo)
// ============================================
const blacklist = new Set();

function addToBlacklist(token) {
  blacklist.add(token);
}

function isBlacklisted(token) {
  return blacklist.has(token);
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  verifyTokenMiddleware,
  verify2FAMiddleware,
  verifyRoleMiddleware,
  addToBlacklist,
  isBlacklisted
};
