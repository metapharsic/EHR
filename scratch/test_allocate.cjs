const axios = require('c:/ERP_3152026/server/node_modules/axios');

async function run() {
  const API_URL = 'http://localhost:5000/api';
  try {
    console.log('Logging in...');
    const authRes = await axios.post(`${API_URL}/auth/login`, { username: 'admin', password: 'admin' });
    const token = authRes.data.accessToken;
    const headers = { Authorization: `Bearer ${token}` };

    console.log('Fetching assets...');
    const assetsRes = await axios.get(`${API_URL}/assets`, { headers });
    const assets = assetsRes.data.data;
    if (!assets || assets.length === 0) {
      throw new Error('No assets found');
    }
    const assetId = assets[0].id;

    console.log('Fetching employees...');
    const empRes = await axios.get(`${API_URL}/hr/employees`, { headers });
    const employees = empRes.data.employees || empRes.data.data;
    if (!employees || employees.length === 0) {
      throw new Error('No employees found');
    }
    const employeeId = employees[0].id;

    console.log(`Allocating asset ${assetId} to employee ${employeeId}...`);
    const allocRes = await axios.post(`${API_URL}/assets/${assetId}/allocate`, {
      employee_id: employeeId,
      allocation_date: '2026-06-08',
      notes: 'Test allocation'
    }, { headers });
    console.log('Allocation response:', allocRes.data);
  } catch (error) {
    console.error('❌ Error executing test:', error.response?.data || error.message);
    process.exit(1);
  }
}

run();
