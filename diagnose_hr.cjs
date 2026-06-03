const express = require('express');
const request = require('supertest');

const app = express();
app.use(express.json());

app.use((req, _res, next) => {
  req.user = { userId: '00000000-0000-0000-0000-000000000001', companyId: 1, role: 'ADMIN' };
  next();
});

// Mock JWT exports in require.cache
const path = require('path');
const jwtPath = path.resolve(__dirname, 'server', 'utils', 'jwt.js');
const jwtMock = {
  verifyTokenMiddleware: (req, res, next) => {
    req.user = { userId: '00000000-0000-0000-0000-000000000001', companyId: 1, role: 'ADMIN' };
    next();
  },
  verifyRoleMiddleware: (allowedRoles) => (req, res, next) => {
    next();
  },
  verify2FAMiddleware: (req, res, next) => {
    next();
  }
};
require.cache[jwtPath] = {
  id: jwtPath,
  filename: jwtPath,
  loaded: true,
  exports: jwtMock,
  parent: null,
  children: [],
  paths: []
};

const hrRouter = require('./server/routes/hr.js');
app.use('/api/hr', hrRouter);

app.use((err, _req, res, _next) => {
  res.status(err.status || 500).json({ success: false, error: err.message, stack: err.stack });
});

async function run() {
  console.log('--- POST /api/hr/departments ---');
  let res = await request(app)
    .post('/api/hr/departments')
    .send({ name: 'HRMS Test Department', code: 'HRMS-TEST' });
  console.log('Status:', res.status);
  console.log('Body:', res.body);

  console.log('--- GET /api/hr/analytics/headcount ---');
  res = await request(app).get('/api/hr/analytics/headcount');
  console.log('Status:', res.status);
  console.log('Body:', res.body);

  process.exit(0);
}

run();
