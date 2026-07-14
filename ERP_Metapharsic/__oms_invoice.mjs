// Retry convert-to-invoice on the already-Delivered ORD-2026-00005. Deleted after run.
const BASE = 'http://localhost:5000/api';
const ORDER_ID = 'afa36152-f3c4-4e41-8a29-e2bc07e8e292';
let token = '';
const H = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });
async function call(method, path, body, auth = true) {
  const res = await fetch(BASE + path, { method, headers: auth ? H() : { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  let data; const t = await res.text(); try { data = JSON.parse(t); } catch { data = t; }
  return { status: res.status, data };
}
(async () => {
  const login = await call('POST', '/auth/login', { username: 'admin', password: 'admin' }, false);
  token = login.data.accessToken || login.data.token;
  const inv = await call('POST', `/oms/${ORDER_ID}/convert-to-invoice`);
  console.log('INVOICE', inv.status, JSON.stringify(inv.data));
  const detail = await call('GET', `/oms/${ORDER_ID}`);
  console.log('ORDER status =', detail.data.data.status, '| invoiceLinked =', !!detail.data.data.sales_invoice_id);
  process.exit(inv.status === 200 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
