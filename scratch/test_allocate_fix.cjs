const http = require('http');

async function req(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port: 5000,
      path,
      method,
      headers: { 'Content-Type': 'application/json', ...headers }
    };
    const r = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function main() {
  // Get token
  const loginRes = await req('POST', '/api/auth/login', { username: 'admin', password: 'admin' });
  console.log('Login status:', loginRes.status);
  const token = loginRes.body?.accessToken || loginRes.body?.token || '';
  console.log('Token:', token ? token.substring(0, 30) + '...' : 'MISSING');

  const authHeader = { 'Authorization': `Bearer ${token}` };

  // Create an asset
  const ts = Date.now();
  const createRes = await req('POST', '/api/assets', {
    name: 'Test Laptop ' + ts,
    asset_code: 'TST-' + ts,
    category: 'IT Equipment',
    purchase_date: '2026-01-01',
    purchase_value: 50000,
    location: 'HQ'
  }, authHeader);
  console.log('Create asset status:', createRes.status, 'ID:', createRes.body?.id || createRes.body?.data?.id);
  const assetId = createRes.body?.id || createRes.body?.data?.id;

  if (!assetId) {
    console.error('Failed to create asset, body:', JSON.stringify(createRes.body));
    process.exit(1);
  }

  // Get employees
  const empRes = await req('GET', '/api/hr/employees', null, authHeader);
  const employees = Array.isArray(empRes.body) ? empRes.body : (empRes.body?.employees || []);
  console.log('Employees count:', employees.length);

  if (employees.length === 0) {
    console.log('No employees available for allocation test');
    await req('DELETE', `/api/assets/${assetId}`, null, authHeader);
    process.exit(0);
  }

  // Allocate asset
  const allocRes = await req('POST', `/api/assets/${assetId}/allocate`, {
    employee_id: employees[0].id,
    allocation_date: new Date().toISOString().split('T')[0]
  }, authHeader);
  console.log('Allocate status:', allocRes.status, allocRes.status === 201 ? '✅ FIXED!' : '❌ STILL BROKEN');
  if (allocRes.status !== 201 && allocRes.status !== 200) {
    console.log('Error body:', JSON.stringify(allocRes.body).substring(0, 300));
  } else {
    console.log('Allocation data:', JSON.stringify(allocRes.body?.data || {}).substring(0, 200));
  }

  // Cleanup
  const delRes = await req('DELETE', `/api/assets/${assetId}`, null, authHeader);
  console.log('Delete asset:', delRes.status);
}

main().catch(e => { console.error(e); process.exit(1); });
