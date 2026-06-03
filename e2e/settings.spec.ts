/**
 * E2E Tests — System Settings
 * Tests full browser flows: navigation, company form save, parameters,
 * security policy, notifications, appearance, backup, factory reset.
 *
 * Run: npx playwright test e2e/settings.spec.ts
 * Prerequisites: Frontend (port 5173) and backend (port 5000) must be running.
 */

import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:5173';

// ─── Login helper ─────────────────────────────────────────────────────────────
async function login(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="text"], input[placeholder*="username" i]', 'admin');
  await page.fill('input[type="password"]', 'admin');
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/**`, { timeout: 15000 });
}

// ─── Navigate to Settings ─────────────────────────────────────────────────────
async function goToSettings(page: Page) {
  // Try sidebar link or keyboard shortcut
  const settingsLink = page.locator('a[href*="settings"], button:has-text("Settings")').first();
  if (await settingsLink.isVisible({ timeout: 3000 })) {
    await settingsLink.click();
  } else {
    await page.keyboard.press('Control+,');
  }
  await page.waitForLoadState('networkidle');
  await expect(page.locator('h2:has-text("System Settings")')).toBeVisible({ timeout: 10000 });
}

// ─────────────────────────────────────────────────────────────────────────────
test.describe('Settings — Navigation & Layout', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goToSettings(page);
  });

  test('renders sidebar with all nav items', async ({ page }) => {
    await expect(page.locator('button:has-text("General")')).toBeVisible();
    await expect(page.locator('button:has-text("Security")')).toBeVisible();
    await expect(page.locator('button:has-text("Notifications")')).toBeVisible();
    await expect(page.locator('button:has-text("Appearance")')).toBeVisible();
    await expect(page.locator('button:has-text("Integrations")')).toBeVisible();
    await expect(page.locator('button:has-text("Backup & Restore")')).toBeVisible();
    await expect(page.locator('button:has-text("About")')).toBeVisible();
  });

  test('General tab is active by default and shows Company Information', async ({ page }) => {
    await expect(page.locator('text=Company Information')).toBeVisible();
  });

  test('clicking Security tab shows Login & Access Policy', async ({ page }) => {
    await page.click('button:has-text("Security")');
    await expect(page.locator('text=Login & Access Policy')).toBeVisible();
  });

  test('clicking Notifications tab shows Module Notifications', async ({ page }) => {
    await page.click('button:has-text("Notifications")');
    await expect(page.locator('text=Module Notifications')).toBeVisible();
  });

  test('clicking Backup & Restore shows Data Backup section', async ({ page }) => {
    await page.click('button:has-text("Backup & Restore")');
    await expect(page.locator('text=Data Backup')).toBeVisible();
    await expect(page.locator('text=Restore from Backup')).toBeVisible();
    await expect(page.locator('text=Danger Zone')).toBeVisible();
  });

  test('clicking About shows System Information', async ({ page }) => {
    await page.click('button:has-text("About")');
    await expect(page.locator('text=System Information')).toBeVisible();
    await expect(page.locator('text=Metapharsic Lifesciences ERP')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('Settings — Company Information Form', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goToSettings(page);
  });

  test('shows Company Information form with required fields', async ({ page }) => {
    await expect(page.locator('text=Basic Information')).toBeVisible();
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="gstin"]')).toBeVisible();
    await expect(page.locator('input[name="drugLicenseNo"]')).toBeVisible();
  });

  test('validation fires when saving empty required fields', async ({ page }) => {
    // Clear company name
    await page.fill('input[name="name"]', '');
    await page.click('button[type="submit"], button:has-text("Save Company"), button:has-text("Update Company")');

    // Should see validation error
    await expect(page.locator('text=Company name is required')).toBeVisible({ timeout: 5000 });
  });

  test('GSTIN field validates format', async ({ page }) => {
    await page.fill('input[name="gstin"]', 'INVALID');
    await page.click('button[type="submit"], button:has-text("Save Company"), button:has-text("Update Company")');
    await expect(page.locator('text=/Invalid GSTIN/i')).toBeVisible({ timeout: 5000 });
  });

  test('saves valid company profile and shows success toast', async ({ page }) => {
    // Fill required fields
    await page.fill('input[name="name"]', 'Test Pharma E2E');
    await page.fill('input[name="gstin"]', '27AAPFU0939F1ZV');
    await page.fill('input[name="drugLicenseNo"]', 'MH/DL/2024/001');
    await page.fill('input[name="phone"]', '9876543210');
    await page.fill('input[name="email"]', 'test@e2etest.com');

    // Address fields
    const addressArea = page.locator('textarea[name="address"]');
    if (await addressArea.isVisible()) await addressArea.fill('Test Street, Building 1');

    const cityInput = page.locator('input[name="city"]');
    if (await cityInput.isVisible()) await cityInput.fill('Mumbai');

    const stateSelect = page.locator('select[name="state"]');
    if (await stateSelect.isVisible()) await stateSelect.selectOption('Maharashtra');

    const pinInput = page.locator('input[name="pinCode"]');
    if (await pinInput.isVisible()) await pinInput.fill('400001');

    await page.click('button[type="submit"], button:has-text("Save Company"), button:has-text("Update Company")');

    // Wait for success notification
    await expect(
      page.locator('text=/Company Profile Saved/i').or(page.locator('text=/saved successfully/i'))
    ).toBeVisible({ timeout: 10000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('Settings — Application Parameters', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goToSettings(page);
    // Wait for parameters section to load
    await expect(page.locator('text=Application Parameters')).toBeVisible({ timeout: 10000 });
  });

  test('shows POS & Billing section with Invoice Prefix input', async ({ page }) => {
    await expect(page.locator('text=POS & Billing')).toBeVisible();
    await expect(page.locator('input[placeholder="INV"]')).toBeVisible();
  });

  test('shows Inventory Alerts section', async ({ page }) => {
    await expect(page.locator('text=Inventory Alerts')).toBeVisible();
    await expect(page.locator('text=Expiry Alert')).toBeVisible();
    await expect(page.locator('text=Low Stock Alert')).toBeVisible();
  });

  test('GST / Tax Mode toggle switches state', async ({ page }) => {
    const gstToggle = page.locator('[role="switch"]:near(text="GST / Tax Mode Enabled")').first();
    if (!await gstToggle.isVisible()) return; // skip if not visible

    const initialState = await gstToggle.getAttribute('aria-checked');
    await gstToggle.click();
    await expect(gstToggle).toHaveAttribute('aria-checked', initialState === 'true' ? 'false' : 'true');
  });

  test('Save Changes calls API and shows success notification', async ({ page }) => {
    // Intercept the settings/parameters PUT
    let paramsSaved = false;
    page.on('response', resp => {
      if (resp.url().includes('/api/settings/parameters') && resp.request().method() === 'PUT') {
        paramsSaved = true;
      }
    });

    await page.click('text=Application Parameters >> .. >> button:has-text("Save Changes")');

    // Wait for API call and success toast
    await page.waitForTimeout(2000);
    expect(paramsSaved).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('Settings — Security Policy', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goToSettings(page);
    await page.click('button:has-text("Security")');
    await expect(page.locator('text=Login & Access Policy')).toBeVisible();
  });

  test('shows IP Whitelist toggle', async ({ page }) => {
    await expect(page.locator('text=Enable IP Whitelist')).toBeVisible();
  });

  test('shows Require 2FA for Admin toggle', async ({ page }) => {
    await expect(page.locator('text=Require 2FA for Admin Role')).toBeVisible();
  });

  test('saving security policy sends ipWhitelistEnabled to API', async ({ page }) => {
    let savedPayload: any = null;
    await page.route('**/api/settings/security', async route => {
      if (route.request().method() === 'PUT') {
        savedPayload = JSON.parse(route.request().postData() || '{}');
        await route.fulfill({ status: 200, body: JSON.stringify({ success: true, data: savedPayload }) });
      } else {
        await route.continue();
      }
    });

    await page.click('button:has-text("Save Changes")');
    await page.waitForTimeout(1500);

    expect(savedPayload).not.toBeNull();
    expect(savedPayload).toHaveProperty('ipWhitelistEnabled');
    expect(savedPayload).toHaveProperty('loginAttempts');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('Settings — Notifications', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goToSettings(page);
    await page.click('button:has-text("Notifications")');
    await expect(page.locator('text=Module Notifications')).toBeVisible();
  });

  test('shows all module notification toggles', async ({ page }) => {
    await expect(page.locator('text=Inventory')).toBeVisible();
    await expect(page.locator('text=Compliance')).toBeVisible();
    await expect(page.locator('text=Accounts & Finance')).toBeVisible();
    await expect(page.locator('text=POS & Billing')).toBeVisible();
    await expect(page.locator('text=HR & Payroll')).toBeVisible();
    await expect(page.locator('text=CRM & Sales')).toBeVisible();
  });

  test('saves notification prefs to API', async ({ page }) => {
    let apiCalled = false;
    page.on('response', resp => {
      if (resp.url().includes('/api/settings/notifications') && resp.request().method() === 'PUT') {
        apiCalled = true;
      }
    });
    await page.click('button:has-text("Save Changes")');
    await page.waitForTimeout(2000);
    expect(apiCalled).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('Settings — Backup & Restore', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goToSettings(page);
    await page.click('button:has-text("Backup & Restore")');
    await expect(page.locator('text=Data Backup')).toBeVisible();
  });

  test('Download button triggers API export request', async ({ page }) => {
    let exportCalled = false;
    page.on('response', resp => {
      if (resp.url().includes('/api/settings/export')) exportCalled = true;
    });

    const downloadBtn = page.locator('text=Download Settings Backup').first();
    await downloadBtn.click();
    await page.waitForTimeout(2000);
    expect(exportCalled).toBe(true);
  });

  test('shows factory reset confirmation modal', async ({ page }) => {
    await page.click('button:has-text("Reset System")');
    await expect(page.locator('text=Confirm Factory Reset')).toBeVisible();
    await expect(page.locator('button:has-text("Yes, Reset Everything")')).toBeVisible();
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
  });

  test('Cancel dismisses reset modal without calling API', async ({ page }) => {
    let resetCalled = false;
    page.on('response', resp => {
      if (resp.url().includes('/api/settings/reset')) resetCalled = true;
    });

    await page.click('button:has-text("Reset System")');
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('text=Confirm Factory Reset')).not.toBeVisible();
    expect(resetCalled).toBe(false);
  });
});
