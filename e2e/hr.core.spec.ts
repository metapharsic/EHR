
import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:5173'; // Standard Vite port

async function login(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="text"], input[placeholder*="username" i]', 'admin');
  await page.fill('input[type="password"]', 'admin');
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/**`);
}

test.describe('HRMS Core Modules E2E', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
    // Navigate to HRMS
    await page.click('text=/HRMS/i');
    await page.waitForLoadState('networkidle');
  });

  test('Dashboard displays HR stats and AI briefing', async ({ page }) => {
    // Check for StatCards
    await expect(page.locator('text=/Active Workforce|Total Employees/i').first()).toBeVisible();
    await expect(page.locator('text=/Attrition Rate/i').first()).toBeVisible();
    
    // Check for AI Briefing
    await expect(page.locator('text=/AI Weekly Briefing/i')).toBeVisible();
  });

  test('Employee directory loads and displays list', async ({ page }) => {
    await page.click('button:has-text("Employees")');
    await page.waitForLoadState('networkidle');
    
    // Check for table headers
    await expect(page.locator('th:has-text("Name")')).toBeVisible();
    await expect(page.locator('th:has-text("Code")')).toBeVisible();
    
    // Check for search bar
    await expect(page.locator('input[placeholder*="Search employees"]')).toBeVisible();
  });

  test('Organization chart renders correctly', async ({ page }) => {
    await page.click('button:has-text("Organization")');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('text=/Organization Chart/i')).toBeVisible();
    // Check for at least one org node
    await expect(page.locator('[class*="OrgNode"], .border-slate-300').first()).toBeVisible();
  });

  test('Documents module allows employee selection', async ({ page }) => {
    await page.click('button:has-text("Documents")');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('text=/Document Repository/i')).toBeVisible();
    await expect(page.locator('label:has-text("Select Employee")')).toBeVisible();
    
    // Check if employee dropdown has options
    const select = page.locator('select');
    await expect(select).toBeVisible();
  });
});
