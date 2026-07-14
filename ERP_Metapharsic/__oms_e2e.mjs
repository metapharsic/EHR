// Temporary OMS end-to-end API test. Deleted after run.
const BASE = 'http://localhost:5000/api';
const DIST = { value: '55555555-5555-5555-5555-555555555553', label: 'City Hospital Pharmacy' };
const PRODUCT = { id: '8c2abe12-1114-4dfa-b5bc-7ad5fa276f0d', name: 'MetaMol 650' };
const QTY = 20, RATE = 150, GST = 12;

let token = '';
const H = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });
const log = (...a) => console.log(...a);

async function call(method, path, body, auth = true) {
  const res = await fetch(BASE + path, {
    method,
    headers: auth ? H() : { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

(async () => {
  // 1. Login
  const login = await call('POST', '/auth/login', { username: 'admin', password: 'admin' }, false);
  if (login.status !== 200) { log('LOGIN FAILED', login.status, login.data); process.exit(1); }
  token = login.data.accessToken || login.data.token || login.data?.data?.accessToken;
  log('1. LOGIN ok, token?', !!token);

  // 2. Stats + list
  const stats = await call('GET', '/oms/stats');
  log('2. STATS', stats.status, JSON.stringify(stats.data.data));
  const list = await call('GET', '/oms?limit=200');
  log('   LIST total =', list.data.total, '| sample =', list.data.data?.[0]?.orderNumber, list.data.data?.[0]?.status);

  // 3. Create order
  const create = await call('POST', '/oms', {
    distributorId: DIST.value, distributorName: DIST.label, priority: 'High',
    items: [{ productId: PRODUCT.id, productName: PRODUCT.name, quantity: QTY, rate: RATE, gstPercent: GST }],
    packingSpecs: 'Box of 10 strips', labelingSpecs: 'For supply to hospitals',
  });
  log('3. CREATE', create.status, JSON.stringify(create.data.data), create.data.message);
  const orderId = create.data.data.id;
  const orderNo = create.data.data.orderNumber;

  // 4. AI risk
  const risk = await call('POST', `/oms/${orderId}/ai-risk`);
  log('4. AI-RISK', risk.status, JSON.stringify(risk.ai || risk.data.ai));

  // 5. AI fulfillment
  const fulfil = await call('GET', `/oms/${orderId}/ai-fulfillment`);
  log('5. AI-FULFILLMENT', fulfil.status, JSON.stringify(fulfil.data.data));

  // 6. AI confirmation draft (truncated)
  const draft = await call('GET', `/oms/${orderId}/ai-confirmation`);
  log('6. AI-CONFIRMATION', draft.status, 'draftLen=', (draft.data.data?.draft || '').length);

  // 7. Approve (reserve stock)
  const approve = await call('PUT', `/oms/${orderId}/approve`, { note: 'E2E approve' });
  log('7. APPROVE', approve.status, approve.data.message, 'reservation=', JSON.stringify(approve.data.reservation));

  // 8. Ship (decrement stock)
  const ship = await call('PUT', `/oms/${orderId}/status`, { status: 'Shipped', carrier: 'BlueDart', trackingNumber: 'BD123' });
  log('8. SHIP', ship.status, ship.data.message);

  // 9. Deliver
  const deliver = await call('PUT', `/oms/${orderId}/status`, { status: 'Delivered' });
  log('9. DELIVER', deliver.status, deliver.data.message);

  // 10. Convert to invoice
  const inv = await call('POST', `/oms/${orderId}/convert-to-invoice`);
  log('10. INVOICE', inv.status, JSON.stringify(inv.data.data), inv.data.message);

  // 11. Portfolio insights
  const insights = await call('POST', '/oms/ai/insights');
  log('11. INSIGHTS', insights.status, 'priority#=', insights.data.data?.priorityOrders?.length, '| actions#=', insights.data.data?.recommendedActions?.length);

  // 12. Detail (status history)
  const detail = await call('GET', `/oms/${orderId}`);
  const hist = (detail.data.data.statusHistory || []).map(h => h.to_status).join(' -> ');
  log('12. DETAIL', detail.status, '| status=', detail.data.data.status, '| history=', hist, '| invoiceLinked=', !!detail.data.data.sales_invoice_id);

  log('\nORDER_UNDER_TEST', orderNo, orderId);
  process.exit(0);
})().catch(e => { console.error('E2E ERROR', e); process.exit(1); });
