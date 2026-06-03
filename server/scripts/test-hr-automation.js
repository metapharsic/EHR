
const axios = require('axios');

const API_URL = 'http://localhost:5000/api';
let token = '';

async function runTests() {
    console.log('🚀 Starting HR & Payroll Bulk Automation Integration Tests...');

    try {
        const authRes = await axios.post(`${API_URL}/auth/login`, { username: 'admin', password: 'admin' });
        token = authRes.data.accessToken;
        const headers = { Authorization: `Bearer ${token}` };

        // Test Bulk Process
        console.log('\nTesting POST /hr/payroll/process-bulk...');
        const month = 'June';
        const year = 2026;
        const procRes = await axios.post(`${API_URL}/hr/payroll/process-bulk`, { month, year }, { headers });
        
        if (!procRes.data.success) throw new Error('Bulk processing failed');
        console.log(`✅ Bulk processed ${procRes.data.slipsProcessed} salary slips`);
        
        const voucherId = procRes.data.voucherId;
        if (!voucherId) throw new Error('No Journal Voucher generated');
        console.log(`✅ Linked Journal Voucher generated: ${voucherId}`);

        // Verify Fetch
        console.log('\nTesting GET /hr/payroll/slips...');
        const slipsRes = await axios.get(`${API_URL}/hr/payroll/slips?month=${month}&year=${year}`, { headers });
        if (!slipsRes.data.success || slipsRes.data.data.length !== procRes.data.slipsProcessed) {
            throw new Error('Mismatch in generated vs fetched slips');
        }
        console.log(`✅ Fetched ${slipsRes.data.data.length} stored slips correctly`);

        console.log('\n✨ HR/Payroll Automation Integration tests passed!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        process.exit(1);
    }
}
runTests();
