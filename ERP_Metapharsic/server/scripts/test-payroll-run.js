
const axios = require('axios');

async function testPayroll() {
  const API_URL = 'http://localhost:5000/api';
  
  try {
    const authRes = await axios.post(`${API_URL}/auth/login`, { username: 'admin', password: 'admin' });
    const token = authRes.data.accessToken;
    const headers = { Authorization: `Bearer ${token}` };

    console.log('Running payroll for June 2026...');
    const runRes = await axios.post(`${API_URL}/hr/payroll/run`, { month: 6, year: 2026 }, { headers });
    
    console.log('Payroll run successful:', JSON.stringify(runRes.data, null, 2));

    if (runRes.data.data.anomalies.length > 0) {
      console.log('Anomalies found:', runRes.data.data.anomalies);
    }

    // Check slips for June 2026
    const slipsRes = await axios.get(`${API_URL}/hr/payroll/slips?month=6&year=2026`, { headers });
    const slips = slipsRes.data.data;
    
    console.log(`Generated ${slips.length} slips for June 2026.`);
    
    const amitSlip = slips.find(s => s.employee_name === 'Amit Patel');
    if (amitSlip) {
      console.log('✅ Found June slip for Amit Patel:');
      console.log(`   Gross: ${amitSlip.gross_salary}`);
      console.log(`   Net:   ${amitSlip.net_pay}`);
      console.log(`   TDS:   ${amitSlip.tds}`);
      console.log(`   Status: ${amitSlip.payment_status}`);
    } else {
      console.error('❌ Amit Patel slip not found for June');
      process.exit(1);
    }

  } catch (err) {
    console.error('❌ Error:', err.response?.data || err.message);
    process.exit(1);
  }
}

testPayroll();
