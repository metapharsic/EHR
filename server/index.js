require('dotenv').config();
const express = require('express');
const { WebSocketServer } = require('ws');
const db = require('./db');
const logger = require('./utils/logger');
const authController = require('./controllers/authController');
const {
  helmetMiddleware,
  corsMiddleware,
  globalLimiter,
  authLimiter,
  mongoSanitizeMiddleware,
  xssMiddleware,
  hppMiddleware,
  validateInput,
  validateHeaders,
  httpsRedirect,
  securityLogger
} = require('./middleware/security');
const {
  verifyTokenMiddleware,
  verifyRoleMiddleware,
  verify2FAMiddleware
} = require('./utils/jwt');

const { swaggerUi, specs } = require('./config/swagger');

const app = express();
const port = process.env.PORT || 5000;

// ============================================
// API DOCUMENTATION
// ============================================
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// ============================================
// SECURITY MIDDLEWARE (Applied First)
// ============================================

// HTTPS redirect in production
app.use(httpsRedirect);

// Security headers
app.use(helmetMiddleware);

// CORS with specific origins
app.use(corsMiddleware);

// Request logging & security check
app.use(securityLogger);

// GLOBAL LOGGER for debugging routing issues
app.use((req, res, next) => {
  console.log(`[SERVER] INCOMING: ${req.method} ${req.url} (Original: ${req.originalUrl})`);
  next();
});

// Global rate limiting
app.use(globalLimiter);

// Validate headers
app.use(validateHeaders);

// Body parser with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Input sanitization
app.use(mongoSanitizeMiddleware);
app.use(xssMiddleware);
app.use(hppMiddleware);

// Custom input validation
app.use(validateInput);

logger.info('Security middleware initialized');

/**
 * @openapi
 * /api/health:
 *   get:
 *     summary: Check API and Database status
 *     description: Returns the current status of the ERP API and its connection to the PostgreSQL database.
 *     responses:
 *       200:
 *         description: System is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 connected:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 database:
 *                   type: string
 *       503:
 *         description: Database connection failed
 */
app.get('/api/health', async (req, res) => {
    try {
        // Test DB connection
        const dbCheck = await db.query('SELECT 1');
        res.json({ 
            status: 'OK',
            connected: true,
            message: 'Metapharsic ERP API & Database are running',
            version: '2.0.0-secure',
            environment: process.env.NODE_ENV || 'development',
            database: 'PostgreSQL',
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(503).json({
            status: 'ERROR',
            connected: false,
            message: 'Database connection failed',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ============================================
// AUTHENTICATION ROUTES (Public)
// ============================================

app.post('/api/auth/register', authLimiter, async (req, res) => {
    await authController.register(req, res);
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
    await authController.login(req, res);
});

app.post('/api/auth/verify-2fa', authLimiter, async (req, res) => {
    await authController.verify2FA(req, res);
});

app.post('/api/auth/refresh-token', async (req, res) => {
    await authController.refreshToken(req, res);
});

app.get('/api/auth/me', verifyTokenMiddleware, verify2FAMiddleware, async (req, res) => {
    await authController.getCurrentUser(req, res);
});

app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
    await authController.forgotPassword(req, res);
});

app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
    await authController.resetPassword(req, res);
});

// ============================================
// PROTECTED ROUTES (Require JWT)
// ============================================

app.post('/api/auth/logout', verifyTokenMiddleware, verify2FAMiddleware, async (req, res) => {
    await authController.logout(req, res);
});

app.post('/api/auth/enable-2fa', verifyTokenMiddleware, verify2FAMiddleware, async (req, res) => {
    await authController.enable2FA(req, res);
});

app.post('/api/auth/confirm-2fa', verifyTokenMiddleware, verify2FAMiddleware, async (req, res) => {
    await authController.confirm2FA(req, res);
});

// ============================================
// MODULAR ROUTES
// ============================================
const inventoryRoutes = require('./routes/inventory');
const inventoryRoutesFull = require('./routes/inventoryRoutes');
const reportRoutes = require('./routes/reports');
const hrRoutes = require('./routes/hr');
const posRoutes = require('./routes/pos');
const purchaseRoutes = require('./routes/purchase');
const analyticRoutes = require('./routes/analytics');
const accountingRoutes = require('./routes/accounting');
const advancedAccountingRoutes = require('./routes/advancedAccountingRoutes');
const manufacturingRoutes = require('./routes/manufacturing');
const crmRoutes = require('./routes/crm');
const pcdRoutes = require('./routes/pcd');
const productRoutes = require('./routes/products');
const invoiceRoutes = require('./routes/invoices');
const assetRoutes = require('./routes/assets');
const logisticsRoutes = require('./routes/logistics');
const auditRoutes = require('./routes/audit');
const qcRoutes = require('./routes/qc');
const rndRoutes = require('./routes/rnd');
const salesRoutes = require('./routes/sales');
const omsRoutes = require('./routes/oms');
const complianceRoutes = require('./routes/compliance');
const dmsRoutes = require('./routes/dms');
const inventoryEnterpriseRoutes = require('./routes/inventory-enterprise');
const voucherRoutes = require('./routes/vouchers');
const settingsRoutes = require('./routes/settings');
const geospatialRoutes = require('./routes/geospatial');
const gstRoutes = require('./routes/gst');
const tdsRoutes = require('./routes/tds');
const taskRoutes = require('./routes/tasks');

app.use('/api/pcd/geospatial', geospatialRoutes);
app.use('/api/pcd', pcdRoutes);
app.use('/api/gst', gstRoutes);
app.use('/api/tds', tdsRoutes);
app.use('/api/analytics', analyticRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/inventory-full', inventoryRoutesFull);
app.use('/api/reports', reportRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/purchase', purchaseRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/accounting/advanced', advancedAccountingRoutes);
app.use('/api/manufacturing', manufacturingRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/products', productRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/logistics', logisticsRoutes);
app.use('/api/audit', auditRoutes);
const deerflowRoutes = require('./routes/deerflow');
app.use('/api/deerflow', deerflowRoutes);
app.use('/api/qc', qcRoutes);
app.use('/api/rnd', rndRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/oms', omsRoutes);
const omsPortalRoutes = require('./routes/omsPortal');
app.use('/api/portal', omsPortalRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api', inventoryRoutesFull); // Support /api/godowns, /api/stock-ledger etc.
app.use('/api', manufacturingRoutes); // Support /api/boms, /api/raw-materials etc.
app.use('/api', posRoutes);       // Support /api/parties
app.use('/uploads', require('express').static(require('path').join(__dirname, '..', 'uploads')));
require('./services/complianceCron').startComplianceCron();
require('./services/omsSlaService').startSlaCron();
app.use('/api/dms', dmsRoutes);
app.use('/api/inventory-enterprise', inventoryEnterpriseRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/settings', settingsRoutes);
const aiRoutes = require('./routes/ai');
app.use('/api/ai', aiRoutes);

// Helper to wrap async routes
const asyncRoute = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// ============================================
// PRODUCTS API (Protected)
// ============================================
const initializeDatabase = async () => {
    try {
        await db.query('SELECT 1');
        return true;
    } catch (error) {
        throw new Error('Database connection failed: ' + error.message);
    }
};

// Initialize DB before starting server
initializeDatabase().then(() => {
    console.log('✅ Database ready');
}).catch(error => {
    console.error('⚠️  DB init warning:', error.message);
});

// ============================================
// ERROR HANDLING MIDDLEWARE (Applied Last)
// ============================================

// ============================================
// SERVE STATIC FILES (Production)
// ============================================
if (process.env.NODE_ENV === 'production') {
    const path = require('path');
    const distPath = path.join(__dirname, '..', 'dist');
    app.use(express.static(distPath));
    
    // Support SPA routing (redirect all non-API requests to index.html)
    app.get('*', (req, res, next) => {
        if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
            res.sendFile(path.join(distPath, 'index.html'));
        } else {
            next();
        }
    });
}

// 404 Handler
app.use((req, res) => {
    logger.warn('404 Route not found', { method: req.method, path: req.path, ip: req.ip });
    res.status(404).json({ error: 'Route not found' });
});

// Error Handler
app.use((err, req, res, next) => {
    logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        ip: req.ip,
        userId: req.user?.userId
    });

    // Don't expose error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    const errorMessage = isDevelopment ? err.message : 'Internal Server Error';

    res.status(err.status || 500).json({
        error: errorMessage,
        status: err.status || 500,
        ...(isDevelopment && { stack: err.stack })
    });
});

// ── WebSocket server for real-time push notifications ──────────────────────
// Attached to the same HTTP server — no extra port needed.
// Clients connect at ws://localhost:5000/ws and receive JSON events.
const wss = new WebSocketServer({ noServer: true });
const wsClients = new Map(); // userId → Set<WebSocket>

const broadcastToUser = (userId, event) => {
    const sockets = wsClients.get(String(userId));
    if (!sockets) return;
    const payload = JSON.stringify(event);
    sockets.forEach(ws => { if (ws.readyState === 1) ws.send(payload); });
};

const broadcastAll = (event) => {
    const payload = JSON.stringify(event);
    wsClients.forEach(sockets => sockets.forEach(ws => { if (ws.readyState === 1) ws.send(payload); }));
};

wss.on('connection', (ws, req) => {
    // Expect first message: { type: 'auth', token: '...' }
    ws.once('message', async (raw) => {
        try {
            const { token } = JSON.parse(raw);
            const { verifyAccessToken } = require('./utils/jwt');
            const result = verifyAccessToken(token);
            if (!result.valid) { ws.close(4001, 'Unauthorized'); return; }
            const userId = String(result.decoded.userId);
            if (!wsClients.has(userId)) wsClients.set(userId, new Set());
            wsClients.get(userId).add(ws);
            ws.send(JSON.stringify({ type: 'connected', userId }));
            ws.on('close', () => { wsClients.get(userId)?.delete(ws); });
        } catch { ws.close(4001, 'Unauthorized'); }
    });
    ws.on('error', err => logger.error('WS error:', err.message));
});

// Export so routes can push events
app.set('broadcastToUser', broadcastToUser);
app.set('broadcastAll', broadcastAll);

const server = app.listen(port, () => {
    logger.info(`🚀 Metapharsic ERP Server running`, {
        port,
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version
    });
    console.log(`
╔════════════════════════════════════════════╗
║   Metapharsic Lifesciences ERP - Secure   ║
║                                            ║
║  🔒 Security: ENABLED                      ║
║  🔑 JWT Authentication: ENABLED             ║
║  🛡️  Rate Limiting: ENABLED                 ║
║  📝 Audit Logging: ENABLED                  ║
║                                            ║
║  Server: http://localhost:${port}          ║
║  Health: http://localhost:${port}/health   ║
╚════════════════════════════════════════════╝
    `);
});

// Attach WebSocket upgrade to the HTTP server
server.on('upgrade', (req, socket, head) => {
    if (req.url === '/ws') {
        wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
    } else {
        socket.destroy();
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT signal received: closing HTTP server');
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
});

// Unhandled rejection
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', { promise, reason });
});
