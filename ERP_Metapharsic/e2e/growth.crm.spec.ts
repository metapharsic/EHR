/**
 * E2E: Growth CRM & Opportunity Lifecycle
 * Tests: Navigate to CRM -> View Board -> Register Opportunity -> Verify AI tabs
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

async function navigateToCRM(page: Page) {
  // Click on CRM module in the Sidebar
  const crmLink = page.locator('text=/CRM/i').first();
  await expect(crmLink).toBeVisible({ timeout: 10000 });
  await crmLink.click();
  await page.waitForLoadState('networkidle');
}

test.describe('Growth CRM Command Center', () => {

  test('CRM pipeline dashboard renders stats and kanban columns', async ({ page }) => {
    await login(page);
    await navigateToCRM(page);

    // Verify stats ribbon is rendered
    const pipelineCard = page.locator('text=/Pipeline Leads/i').first();
    const valueCard = page.locator('text=/Pipeline Value/i').first();
    await expect(pipelineCard).toBeVisible({ timeout: 8000 });
    await expect(valueCard).toBeVisible();

    // Verify Kanban columns are visible
    const newCol = page.locator('text=/^New$/i').first();
    const contactedCol = page.locator('text=/^Contacted$/i').first();
    const proposalCol = page.locator('text=/^Proposal$/i').first();
    await expect(newCol).toBeVisible();
    await expect(contactedCol).toBeVisible();
    await expect(proposalCol).toBeVisible();
  });

  test('can open Opportunity Registration dialog and verify dropdowns & buttons', async ({ page }) => {
    await login(page);
    await navigateToCRM(page);

    // Locate and click the Register Opportunity button
    const regBtn = page.locator('button:has-text("Register Opportunity")').first();
    await expect(regBtn).toBeVisible({ timeout: 5000 });
    await regBtn.click();

    // Verify the Opportunity Registration modal headers
    const modalHeader = page.locator('text=/Register New Enterprise Opportunity/i').first();
    await expect(modalHeader).toBeVisible({ timeout: 5000 });

    // Validate form inputs are present
    const leadNameInput = page.locator('label:has-text("Lead Name") + input');
    const companyInput = page.locator('label:has-text("Company / Entity") + input');
    await expect(leadNameInput).toBeVisible();
    await expect(companyInput).toBeVisible();

    // Validate dropdown selections are present
    const typeDropdown = page.locator('label:has-text("Type") + select');
    const priorityDropdown = page.locator('label:has-text("Priority") + select');
    await expect(typeDropdown).toBeVisible();
    await expect(priorityDropdown).toBeVisible();

    // Ensure save button is visible
    const saveBtn = page.locator('button:has-text("Execute Registration")').first();
    await expect(saveBtn).toBeVisible();

    // Close the modal
    const dismissBtn = page.locator('button:has-text("Dismiss")').first();
    await dismissBtn.click();
    await expect(modalHeader).not.toBeVisible();
  });

  test('can navigate to AI Intelligence tab and verify strategy center', async ({ page }) => {
    await login(page);
    await navigateToCRM(page);

    // Click the AI Intelligence tab button
    const aiTab = page.locator('button:has-text("AI Intelligence")').first();
    await expect(aiTab).toBeVisible({ timeout: 5000 });
    await aiTab.click();

    // Verify AI charts container or optimizer card renders
    const aiStrategyHeader = page.locator('text=/Agentic AI Strategy Generator/i').first();
    await expect(aiStrategyHeader).toBeVisible({ timeout: 8000 });

    const optimizeBtn = page.locator('button:has-text("Initialize AI Optimization")').first();
    await expect(optimizeBtn).toBeVisible();
  });

  test('can navigate to Follow-up Queue tab and view scheduled lists', async ({ page }) => {
    await login(page);
    await navigateToCRM(page);

    // Click the Follow-up Queue tab button
    const queueTab = page.locator('button:has-text("Follow-up Queue")').first();
    await expect(queueTab).toBeVisible({ timeout: 5000 });
    await queueTab.click();

    // Verify queue header is present
    const queueHeader = page.locator('text=/Active Follow-up Queue/i').first();
    await expect(queueHeader).toBeVisible({ timeout: 5000 });

    // Table header verify
    const targetLeadHeader = page.locator('th:has-text("Target Lead")').first();
    await expect(targetLeadHeader).toBeVisible();
  });
});
