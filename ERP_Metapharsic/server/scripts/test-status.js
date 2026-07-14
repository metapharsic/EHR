
const axios = require('axios');

async function testStatus() {
  const API_URL = 'http://localhost:5000/api';
  
  try {
    const authRes = await axios.post(`${API_URL}/auth/login`, { username: 'admin', password: 'admin' });
    const token = authRes.data.accessToken;
    const headers = { Authorization: `Bearer ${token}` };

    // 1. Get Amit Patel
    const empRes = await axios.get(`${API_URL}/hr/employees`, { headers });
    const amit = empRes.data.data.find(e => e.name === 'Amit Patel');
    if (!amit) throw new Error('Amit Patel not found');

    console.log(`Current status of Amit Patel: ${amit.status}`);

    // 2. Update status to 'On Leave'
    console.log('Updating status to "On Leave"...');
    await axios.put(`${API_URL}/hr/employees/${amit.id}/profile`, { status: 'On Leave' }, { headers });

    // 3. Verify
    const verifyRes = await axios.get(`${API_URL}/hr/employees`, { headers });
    const amitUpdated = verifyRes.data.data.find(e => e.name === 'Amit Patel');
    console.log(`New status of Amit Patel: ${amitUpdated.status}`);

    if (amitUpdated.status === 'On Leave') {
      console.log('✅ Status update is working correctly!');
    } else {
      console.error('❌ Status update failed!');
      process.exit(1);
    }

    // Reset back to Active
    await axios.put(`${API_URL}/hr/employees/${amit.id}/profile`, { status: 'Active' }, { headers });
    console.log('Status reset to "Active".');

  } catch (err) {
    console.error('❌ Error:', err.response?.data || err.message);
    process.exit(1);
  }
}

testStatus();
