// server/middleware/security.js
// Comprehensive Security Middleware for ERP System

const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const logger = require('../utils/logger');

// ============================================
// 1. HELMET - Security Headers
// ============================================
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        "http://localhost:5000",
        "http://localhost:5177",   // current Vite dev server
        "http://localhost:5175",
        "ws://localhost:5177",   // Vite HMR
        "ws://localhost:5175",
        "ws://localhost:5173",   // legacy fallback
        "http://localhost:5173",
        "https://api.metapharsic.com",
        "https://generativelanguage.googleapis.com"  // Gemini AI
      ],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: true
  }
});

// ============================================
// 2. CORS - Prevent Cross-Origin Attacks
// ============================================
const corsMiddleware = cors({
  origin: process.env.CORS_ORIGINS?.split(',') || [
    'http://localhost:5177',   // current Vite dev server
    'http://localhost:5175',
    'http://localhost:5173',   // legacy
    'http://localhost:3000',
    'http://localhost:3005',
  ],
  credentials: process.env.CORS_CREDENTIALS === 'true',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  optionsSuccessStatus: 200,
  maxAge: 86400 // 24 hours
});

// ============================================
// 3. RATE LIMITING - DDoS & Brute Force Protection
// ============================================

// Global rate limiter (all requests)
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 5000, // High limit for dev
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  keyGenerator: (req, res) => {
    // Use user ID if authenticated, otherwise use IP
    return req.user?.id || req.ip;
  },
  skip: (req, res) => {
    // Skip rate limiting for health checks, localhost, and in development
    if (process.env.NODE_ENV === 'development') return true;
    return req.path === '/health' || req.ip === '::1' || req.ip === '127.0.0.1' || req.ip.includes('localhost');
  },
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: req.rateLimit.resetTime
    });
  }
});

// Strict rate limiter for auth endpoints (prevent brute force)
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.AUTH_LIMIT_MAX_ATTEMPTS) || 50, // 50 attempts per window (more lenient for dev)
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true, // Don't count successful requests
  skipFailedRequests: false,
  keyGenerator: (req, res) => {
    return req.body.username || req.ip; // Rate limit by username or IP
  },
  handler: (req, res) => {
    logger.error(`Brute force attempt detected for user: ${req.body.username} from IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many login attempts. Please try again later.',
      retryAfter: req.rateLimit?.resetTime
    });
  }
});

// Password reset rate limiter
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts
  message: 'Too many password reset attempts',
  skipSuccessfulRequests: true,
  keyGenerator: (req, res) => req.body.email || req.ip
});

// Signup rate limiter
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 signups per hour
  skipSuccessfulRequests: false,
  keyGenerator: (req, res) => req.ip
});

// ============================================
// 4. INPUT SANITIZATION
// ============================================

// Prevent NoSQL injection
const mongoSanitizeMiddleware = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    logger.warn(`Potential NoSQL injection detected in ${key}`);
  }
});

// Prevent XSS attacks
const xssMiddleware = xss();

// Prevent HTTP Parameter Pollution
const hppMiddleware = hpp({
  whitelist: ['sort', 'fields', 'page', 'limit', 'search']
});

// ============================================
// 5. CUSTOM INPUT VALIDATION
// ============================================
const validateInput = (req, res, next) => {
  // Check for typical SQL injection patterns
  const sqlPatterns = [
    /('|")(\s)*(or|and)(\s)*(=|<|>)/gi,
    /union(\s)+select/gi,
    /exec(\s)*\(/gi,
    /execute(\s)*\(/gi,
    /drop(\s)+table/gi,
    /delete(\s)+from/gi,
    /update(\s)+.*(\s)+set/gi
  ];

  const checkValue = (value) => {
    if (typeof value === 'string') {
      return sqlPatterns.some(pattern => pattern.test(value));
    }
    if (value && typeof value === 'object') {
      return Object.values(value).some(v => checkValue(v));
    }
    return false;
  };

  if (checkValue(req.body) || checkValue(req.query)) {
    logger.error(`Potential SQL injection attempt from IP: ${req.ip}`);
    return res.status(400).json({
      error: 'Invalid input detected'
    });
  }

  next();
};

// ============================================
// 6. AUTHENTICATION HEADER VALIDATION
// ============================================
const validateHeaders = (req, res, next) => {
  const headers = req.headers;

  // Check for suspicious headers
  if (headers['content-length'] && parseInt(headers['content-length']) > 50 * 1024 * 1024) {
    // 50MB limit
    return res.status(413).json({ error: 'Payload too large' });
  }

  if (headers['authorization'] && !headers['authorization'].startsWith('Bearer ')) {
    if (!headers['authorization'].startsWith('Basic ')) {
      return res.status(400).json({ error: 'Invalid authorization header' });
    }
  }

  next();
};

// ============================================
// 7. HTTPS REDIRECT (Production)
// ============================================
const httpsRedirect = (req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.header('x-forwarded-proto') !== 'https') {
    return res.redirect(301, `https://${req.header('host')}${req.url}`);
  }
  next();
};

// ============================================
// 8. SECURITY LOGGING
// ============================================
const securityLogger = (req, res, next) => {
  // Log suspicious patterns - Refined to avoid false positives with common words
  const suspiciousPatterns = {
    admin_panel: /\/(admin|control|panel)(?!-)/gi,
    sql_injection: /('|"|;|union\s+select|drop\s+table|delete\s+from|update\s+.*set)/gi,
    xss: /<script|javascript:|onerror\s*=|onload\s*=/gi,
    path_traversal: /\.\.\//gi
  };

  Object.entries(suspiciousPatterns).forEach(([pattern, regex]) => {
    // Check URL and Body for patterns
    const urlMatches = regex.test(req.url);
    const bodyMatches = req.body && typeof req.body === 'object' ? regex.test(JSON.stringify(req.body)) : false;

    if (urlMatches || bodyMatches) {
      // Re-check for 'performance' or 'accounting' false positives if the regex was simple
      if (pattern === 'sql_injection' && (req.url.includes('performance') || req.url.includes('accounting'))) {
        // Double check if it's REALLY a suspicious pattern (e.g., contains quotes or semicolons)
        const moreSpecificSql = /('|"|;|--|\/\*)/g;
        if (!moreSpecificSql.test(req.url)) return;
      }
      
      logger.warn(`[SECURITY] ${pattern} pattern detected in ${req.method} ${req.path} from ${req.ip}`);
    }
  });

  next();
};

// ============================================
// EXPORT ALL MIDDLEWARE
// ============================================
module.exports = {
  helmetMiddleware,
  corsMiddleware,
  globalLimiter,
  authLimiter,
  passwordResetLimiter,
  signupLimiter,
  mongoSanitizeMiddleware,
  xssMiddleware,
  hppMiddleware,
  validateInput,
  validateHeaders,
  httpsRedirect,
  securityLogger
};
