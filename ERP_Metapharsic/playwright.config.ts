import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  // HTML reporter for full phase-by-phase results + list for console
  reporter: [['list'], ['html', { outputFolder: 'test-results/html', open: 'never' }]],
  timeout: 45000,

  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    actionTimeout: 15000,
    navigationTimeout: 20000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // ─── Phase execution order ───────────────────────────────────────────────
  // Run phases in order with: npx playwright test --project=chromium
  //
  // Phase 0  DB:       psql -U erp_user -d metapharsic_erp -f e2e/phase0.db.baseline.sql
  // Phase 1  Auth:     npx playwright test e2e/phase1.auth.spec.ts
  // Phase 2  Nav:      npx playwright test e2e/phase2.navigation.spec.ts
  // Phase 3  Accounts: npx playwright test e2e/phase3.accounts.spec.ts
  // Phase 4  Inventory:npx playwright test e2e/phase4.inventory.spec.ts
  // Phase 5  POS:      npx playwright test e2e/phase5.pos.spec.ts
  // Phase 6  Purchase: npx playwright test e2e/phase6.purchase.spec.ts
  // Phase 7  OMS:      npx playwright test e2e/phase7.oms.spec.ts
  // Phase 8  CRM:      npx playwright test e2e/phase8.crm.gaps.spec.ts
  // Phase 9  PCD:      npx playwright test e2e/phase9.pcd.spec.ts
  // Phase 10 Mfg/QC:  npx playwright test e2e/phase10.manufacturing.qc.spec.ts
  // Phase 11 Compl:   npx playwright test e2e/phase11.compliance.assets.spec.ts
  // Phase 12 HRMS:    npx playwright test e2e/phase12.hrms.extensions.spec.ts
  // Phase 14 X-Mod:   npx playwright test e2e/phase14.cross.module.spec.ts
  //
  // Existing suites (HRMS + CRM — keep running):
  // npx playwright test e2e/hr.payroll.spec.ts e2e/hr.leave.spec.ts e2e/hr.ats.spec.ts
  // npx playwright test e2e/hr.onboarding.spec.ts e2e/hr.analytics.spec.ts e2e/growth.crm.spec.ts
  //
  // Run ALL phases:  npx playwright test
  // Dev servers must be started manually before running E2E:
  //   Terminal 1: node server/index.js
  //   Terminal 2: npm run dev
});
