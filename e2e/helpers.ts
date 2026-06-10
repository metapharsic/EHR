/**
 * Shared E2E helpers for Metapharsic ERP tests.
 * Fixes the "Response has been disposed" issue by reading body
 * BEFORE disposing the APIRequestContext.
 */

import { request, Page } from '@playwright/test';

const API = 'http://127.0.0.1:5000';
let _authToken = '';

export async function getToken(): Promise<string> {
  if (_authToken) return _authToken;
  const ctx = await request.newContext();
  const res = await ctx.post(`${API}/api/auth/login`, {
    data: { username: 'admin', password: 'admin' }
  });
  const body = await res.json();        // read BEFORE dispose
  await ctx.dispose();
  _authToken = body.accessToken ?? body.token ?? '';
  return _authToken;
}

// Returns { status, body } — context disposed after body is read
export async function apiGet(path: string): Promise<{ status: number; body: any }> {
  const ctx = await request.newContext();
  const token = await getToken();
  const res = await ctx.get(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const status = res.status();
  let body: any = null;
  try { body = await res.json(); } catch { body = null; }
  await ctx.dispose();
  return { status, body };
}

export async function apiPost(path: string, data: object): Promise<{ status: number; body: any }> {
  const ctx = await request.newContext();
  const token = await getToken();
  const res = await ctx.post(`${API}${path}`, {
    data,
    headers: { Authorization: `Bearer ${token}` }
  });
  const status = res.status();
  let body: any = null;
  try { body = await res.json(); } catch { body = null; }
  await ctx.dispose();
  return { status, body };
}

export async function apiPut(path: string, data: object): Promise<{ status: number; body: any }> {
  const ctx = await request.newContext();
  const token = await getToken();
  const res = await ctx.put(`${API}${path}`, {
    data,
    headers: { Authorization: `Bearer ${token}` }
  });
  const status = res.status();
  let body: any = null;
  try { body = await res.json(); } catch { body = null; }
  await ctx.dispose();
  return { status, body };
}

export async function apiDelete(path: string): Promise<{ status: number; body: any }> {
  const ctx = await request.newContext();
  const token = await getToken();
  const res = await ctx.delete(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const status = res.status();
  let body: any = null;
  try { body = await res.json(); } catch { body = null; }
  await ctx.dispose();
  return { status, body };
}

// Unified method dispatcher
export async function api(
  method: 'get' | 'post' | 'put' | 'delete',
  path: string,
  data?: object
): Promise<{ status: number; body: any }> {
  if (method === 'get')    return apiGet(path);
  if (method === 'post')   return apiPost(path, data ?? {});
  if (method === 'put')    return apiPut(path, data ?? {});
  return apiDelete(path);
}

// Login and return true if fully authenticated (not 2FA blocked)
export async function loginAdmin(page: Page): Promise<boolean> {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('input[type="text"]', { timeout: 15000 });
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'admin');
  await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
  await page.waitForTimeout(3000);
  return !(await page.locator('text=/2FA|OTP/i').first().isVisible().catch(() => false));
}

// Click sidebar item by label
export async function navTo(page: Page, label: string): Promise<void> {
  const el = page.locator(`text=${label}`).first();
  if (await el.isVisible({ timeout: 4000 }).catch(() => false)) {
    await el.click();
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(800);
  }
}
