const http = require('http');

async function req(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1', port: 5000, path, method,
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
  // Login
  const loginRes = await req('POST', '/api/auth/login', { username: 'admin', password: 'admin' });
  console.log('Login:', loginRes.status);
  const token = loginRes.body?.accessToken || loginRes.body?.token || '';
  console.log('Token:', token ? 'OK' : 'MISSING');
  
  if (!token) {
    console.error('Login failed:', JSON.stringify(loginRes.body));
    process.exit(1);
  }

  // Test /api/auth/me
  const meRes = await req('GET', '/api/auth/me', null, { 'Authorization': `Bearer ${token}` });
  console.log('GET /api/auth/me status:', meRes.status);
  console.log('Response:', JSON.stringify(meRes.body).substring(0, 300));
}

main().catch(e => { console.error(e); process.exit(1); });
