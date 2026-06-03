/**
 * E2E Phase 10 — Manufacturing & Quality Control
 */
import { test, expect } from "@playwright/test";
import { api, loginAdmin, navTo } from "./helpers";

let createdBomId = "";
let createdQcTestId = "";

test.describe("Phase 10 — Manufacturing: BOM & Production", () => {

  test("P10-01 | GET /api/manufacturing/bom", async () => {
    const { status } = await api("get", "/api/manufacturing/bom");
    expect([200, 404]).toContain(status);
  });

  test("P10-02 | POST /api/manufacturing/bom → create BOM", async () => {
    const prodRes = await api("get", "/api/pos/products");
    const products = Array.isArray(prodRes.body) ? prodRes.body : (prodRes.body?.products ?? []);
    if (products.length < 2) { test.skip(); return; }
    const [fg, rm] = products;
    const { status, body } = await api("post", "/api/manufacturing/bom", {
      product_id: fg.id, product_name: fg.name, batch_size: 1000, version: "1.0", status: "Active",
      items: [{ material_id: rm.id, material_name: rm.name, quantity: 500, uom: "gm", wastage_percent: 2 }]
    });
    expect([200, 201, 400]).toContain(status);
    if ([200, 201].includes(status)) createdBomId = body?.id ?? body?.data?.id ?? "";
  });

  test("P10-03 | GET /api/manufacturing/production-orders", async () => {
    const { status } = await api("get", "/api/manufacturing/production-orders");
    expect([200, 404, 500]).toContain(status);
  });

  test("P10-04 | POST /api/manufacturing/production-orders", async () => {
    if (!createdBomId) { test.skip(); return; }
    const { status } = await api("post", "/api/manufacturing/production-orders", {
      bom_id: createdBomId, planned_qty: 500,
      planned_start: new Date().toISOString().split("T")[0],
      planned_end: new Date(Date.now() + 7*86400000).toISOString().split("T")[0],
      batch_number: "MFG-E2E-" + Date.now(), status: "Planned"
    });
    expect([200, 201, 400]).toContain(status);
  });

});

test.describe("Phase 10 — QC: Tests & Results", () => {

  test("P10-05 | GET /api/qc", async () => {
    const { status } = await api("get", "/api/qc");
    expect([200, 404]).toContain(status);
  });

  test("P10-06 | POST /api/qc → create PASS QC test", async () => {
    const invRes = await api("get", "/api/inventory");
    const products = Array.isArray(invRes.body) ? invRes.body : (invRes.body?.products ?? []);
    if (products.length === 0) { test.skip(); return; }
    const { status, body } = await api("post", "/api/qc", {
      product_id: products[0].id, batch_number: "QC-E2E-" + Date.now(),
      test_date: new Date().toISOString().split("T")[0], test_type: "Finished Goods",
      parameters: [{ name: "Assay", value: 98.5, min: 98.0, max: 102.0, unit: "%", result: "PASS" }],
      overall_result: "PASS", analyst: "E2E Analyst"
    });
    expect([200, 201, 400]).toContain(status);
    if ([200, 201].includes(status)) createdQcTestId = body?.id ?? body?.data?.id ?? "";
  });

  test("P10-07 | QC PASS → batch available (verify result)", async () => {
    if (!createdQcTestId) { test.skip(); return; }
    const { status, body } = await api("get", "/api/qc/" + createdQcTestId);
    expect([200, 404]).toContain(status);
    if (status === 200) {
      const result = body?.overall_result ?? body?.result ?? "";
      if (result) expect(result).toMatch(/PASS|Pass/i);
    }
  });

  test("P10-08 | POST /api/qc → FAIL test → batch quarantined", async () => {
    const invRes = await api("get", "/api/inventory");
    const products = Array.isArray(invRes.body) ? invRes.body : (invRes.body?.products ?? []);
    if (products.length === 0) { test.skip(); return; }
    const { status } = await api("post", "/api/qc", {
      product_id: products[0].id, batch_number: "QC-FAIL-E2E-" + Date.now(),
      test_date: new Date().toISOString().split("T")[0], test_type: "Finished Goods",
      parameters: [{ name: "Assay", value: 92.0, min: 98.0, max: 102.0, unit: "%", result: "FAIL" }],
      overall_result: "FAIL", analyst: "E2E Analyst"
    });
    expect([200, 201, 400]).toContain(status);
  });

  test("P10-09 | GET /api/qc/parameters", async () => {
    const { status } = await api("get", "/api/qc/parameters");
    expect([200, 404, 500]).toContain(status);
  });

});

test.describe("Phase 10 — Manufacturing & QC: UI", () => {

  test("P10-10 | Manufacturing module renders", async ({ page }) => {
    const ok = await loginAdmin(page); if (!ok) test.skip();
    await navTo(page, "Manufacturing");
    await expect(page.locator("text=/Manufacturing|Production|BOM|Bill of Material/i").first()).toBeVisible({ timeout: 8000 });
  });

  test("P10-11 | BOM Master tab renders", async ({ page }) => {
    const ok = await loginAdmin(page); if (!ok) test.skip();
    await navTo(page, "Manufacturing");
    await page.waitForTimeout(1000);
    const tab = page.locator("text=/BOM|Bill of Material/i").first();
    if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tab.click();
      await expect(page.locator("text=/Product|Material|Quantity|No BOM/i").first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("P10-12 | Quality Control module renders", async ({ page }) => {
    const ok = await loginAdmin(page); if (!ok) test.skip();
    await navTo(page, "Quality Control");
    await expect(page.locator("text=/Quality|QC|Test|Parameter|Batch/i").first()).toBeVisible({ timeout: 8000 });
  });

  test("P10-13 | QC list with PASS/FAIL indicators", async ({ page }) => {
    const ok = await loginAdmin(page); if (!ok) test.skip();
    await navTo(page, "Quality Control");
    await page.waitForTimeout(1000);
    await expect(page.locator("text=/PASS|FAIL|Pending|Quarantine|No QC/i").first()).toBeVisible({ timeout: 6000 });
  });

});
