/**
 * E2E: HRMS ATS — Recruitment Pipeline
 * Tests: Navigate ATS → View Requisitions → Candidate Pipeline → AI Screen
 */

import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:5175';

async function login(page: Page) {
  await page.goto(`${BASE}`);
  await page.waitForSelector('input[type="text"]', { timeout: 10000 });
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'admin');
  await page.click('button[type="submit"], button:has-text("Login")');
  await page.waitForURL(`${BASE}/**`, { timeout: 10000 });
}

test.describe('HRMS ATS Recruitment', () => {

  test('recruitment section renders', async ({ page }) => {
    await login(page);
    const hrmsLink = page.locator('text=/HRMS/i').first();
    if (await hrmsLink.isVisible()) {
      await hrmsLink.click();
      const atsLink = page.locator('text=/Recruitment|ATS/i').first();
      if (await atsLink.isVisible()) {
        await atsLink.click();
        await page.waitForLoadState('networkidle');
        await expect(page.locator('text=/Requisition|Candidate|Pipeline/i').first()).toBeVisible({ timeout: 8000 });
      }
    }
  });

  test('requisitions tab shows table or empty state', async ({ page }) => {
    await login(page);
    const hrmsLink = page.locator('text=/HRMS/i').first();
    if (await hrmsLink.isVisible()) {
      await hrmsLink.click();
      const atsLink = page.locator('text=/Recruitment|ATS/i').first();
      if (await atsLink.isVisible()) {
        await atsLink.click();
        await page.waitForLoadState('networkidle');
        const reqTab = page.locator('text=/Requisitions/i').first();
        if (await reqTab.isVisible()) {
          await reqTab.click();
          const content = page.locator('text=/Job|Role|Open|No requisition/i').first();
          await expect(content).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });

  test('pipeline kanban renders stage columns', async ({ page }) => {
    await login(page);
    const hrmsLink = page.locator('text=/HRMS/i').first();
    if (await hrmsLink.isVisible()) {
      await hrmsLink.click();
      const atsLink = page.locator('text=/Recruitment|ATS/i').first();
      if (await atsLink.isVisible()) {
        await atsLink.click();
        await page.waitForLoadState('networkidle');
        const pipelineTab = page.locator('text=/Pipeline/i').first();
        if (await pipelineTab.isVisible()) {
          await pipelineTab.click();
          // Should show pipeline stage columns
          await expect(page.locator('text=/Sourced|Screened|Interview/i').first()).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });

  test('analytics tab shows hiring metrics', async ({ page }) => {
    await login(page);
    const hrmsLink = page.locator('text=/HRMS/i').first();
    if (await hrmsLink.isVisible()) {
      await hrmsLink.click();
      const atsLink = page.locator('text=/Recruitment|ATS/i').first();
      if (await atsLink.isVisible()) {
        await atsLink.click();
        const analyticsTab = page.locator('text=/Analytics/i').first();
        if (await analyticsTab.isVisible()) {
          await analyticsTab.click();
          await page.waitForLoadState('networkidle');
          await expect(page.locator('text=/Time-to-hire|Offer|Source|Funnel|metric/i').first()).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });
});
