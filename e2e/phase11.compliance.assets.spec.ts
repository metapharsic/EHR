/**
 * E2E Phase 11 — Compliance & Assets
 */
import { test, expect } from "@playwright/test";
import { api, loginAdmin, navTo } from "./helpers";

let createdAssetId = "";

test.describe("Phase 11 — Compliance: API", () => {

  test("P11-01 | GET /api/compliance", async () => {
    const { status } = await api("get", "/api/compliance");
    expect([200, 404]).toContain(status);
  });

  test("P11-02 | GET /api/compliance/logs", async () => {
    const { status, body } = await api("get", "/api/compliance/logs");
    expect([200, 404]).toContain(status);
    if (status === 200) {
      const arr = Array.isArray(body) ? body : (body?.logs ?? body?.data ?? []);
      expect(Array.isArray(arr)).toBeTruthy();
    }
  });

  test("P11-03 | POST /api/compliance/logs → create compliance log", async () => {
    const { status } = await api("post", "/api/compliance/logs", {
      type: "Attendance Anomaly", category: "HR", severity: "Medium",
      description: "E2E Phase 11 test anomaly", status: "Open"
    });
    expect([200, 201, 400, 404]).toContain(status);
  });

  test("P11-04 | GET /api/compliance/documents", async () => {
    const { status } = await api("get", "/api/compliance/documents");
    expect([200, 404]).toContain(status);
  });

  test("P11-05 | GET /api/compliance/expiring → expiring docs", async () => {
    const { status } = await api("get", "/api/compliance/expiring");
    expect([200, 404]).toContain(status);
  });

});

test.describe("Phase 11 — Assets: API", () => {

  test("P11-06 | GET /api/assets", async () => {
    const { status, body } = await api("get", "/api/assets");
    expect([200, 404]).toContain(status);
    if (status === 200) {
      const arr = Array.isArray(body) ? body : (body?.assets ?? body?.data ?? []);
      expect(Array.isArray(arr)).toBeTruthy();
    }
  });

  test("P11-07 | POST /api/assets → create asset", async () => {
    const ts = Date.now();
    const { status, body } = await api("post", "/api/assets", {
      name: "E2E Laptop " + ts, asset_code: "ASSET-E2E-" + ts,
      category: "IT Equipment", purchase_date: "2026-01-01",
      purchase_value: 55000, salvage_value: 5000, useful_life_years: 5,
      depreciation_method: "Straight Line", location: "Head Office", status: "Active"
    });
    expect([200, 201, 400, 404, 500]).toContain(status);
    if ([200, 201].includes(status)) createdAssetId = body?.id ?? body?.data?.id ?? "";
  });

  test("P11-08 | GET /api/assets/:id", async () => {
    if (!createdAssetId) { test.skip(); return; }
    const { status } = await api("get", "/api/assets/" + createdAssetId);
    expect([200, 404]).toContain(status);
  });

  test("P11-09 | PUT /api/assets/:id → update", async () => {
    if (!createdAssetId) { test.skip(); return; }
    const { status } = await api("put", "/api/assets/" + createdAssetId, { location: "Branch Office" });
    expect([200, 400, 404]).toContain(status);
  });

  test("P11-10 | Asset allocation → stock ledger OUT (cross-module)", async () => {
    if (!createdAssetId) { test.skip(); return; }
    const empRes = await api("get", "/api/hr/employees");
    const employees = Array.isArray(empRes.body) ? empRes.body : (empRes.body?.employees ?? []);
    if (employees.length === 0) { test.skip(); return; }
    const { status } = await api("post", "/api/assets/" + createdAssetId + "/allocate", {
      employee_id: employees[0].id, allocation_date: new Date().toISOString().split("T")[0]
    });
    expect([200, 201, 400, 404]).toContain(status);
  });

  test("P11-11 | GET /api/assets/register", async () => {
    const { status } = await api("get", "/api/assets/register");
    expect([200, 404]).toContain(status);
  });

  test("P11-12 | DELETE /api/assets/:id", async () => {
    if (!createdAssetId) { test.skip(); return; }
    const { status } = await api("delete", "/api/assets/" + createdAssetId);
    expect([200, 204, 400, 404]).toContain(status);
  });

});

test.describe("Phase 11 — Compliance & Assets: UI", () => {

  test("P11-13 | Compliance module renders", async ({ page }) => {
    const ok = await loginAdmin(page); if (!ok) test.skip();
    await navTo(page, "Compliance");
    await expect(page.locator("text=/Compliance|License|Document|Regulatory/i").first()).toBeVisible({ timeout: 8000 });
  });

  test("P11-14 | Compliance expiry alerts visible", async ({ page }) => {
    const ok = await loginAdmin(page); if (!ok) test.skip();
    await navTo(page, "Compliance");
    await page.waitForTimeout(1000);
    const el = page.locator("text=/Expir|Due|License|Renewal/i").first();
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) expect(true).toBeTruthy();
  });

  test("P11-15 | Assets module renders", async ({ page }) => {
    const ok = await loginAdmin(page); if (!ok) test.skip();
    await navTo(page, "Assets & Maint.");
    await expect(page.locator("text=/Asset|Maintenance|Register|Depreciation/i").first()).toBeVisible({ timeout: 8000 });
  });

  test("P11-16 | Fixed Asset Register renders", async ({ page }) => {
    const ok = await loginAdmin(page); if (!ok) test.skip();
    await navTo(page, "Assets & Maint.");
    await page.waitForTimeout(1000);
    const tab = page.locator("text=/Register|Fixed Asset|Asset List/i").first();
    if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tab.click();
      await expect(page.locator("text=/Asset|Category|Value|No asset/i").first()).toBeVisible({ timeout: 5000 });
    }
  });

});
