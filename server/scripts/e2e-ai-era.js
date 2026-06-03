
const axios = require('axios');

const API_URL = 'http://localhost:5000/api';
let token = '';

async function runE2E() {
    console.log('🚀 Starting AI Era End-to-End Verification...');

    try {
        console.log('\nStep 1: Authenticating...');
        const authRes = await axios.post(`${API_URL}/auth/login`, { username: 'admin', password: 'admin' });
        token = authRes.data.accessToken;
        const headers = { Authorization: `Bearer ${token}` };
        console.log('✅ Auth successful');

        console.log('\nStep 2: Checking Payroll Anomaly Detection...');
        const anomRes = await axios.get(`${API_URL}/hr/payroll/anomalies`, { headers });
        console.log(`✅ Payroll anomalies retrieved: ${anomRes.data.data.length}`);

        console.log('\nStep 3: Checking Compliance Risk Score...');
        const compRes = await axios.get(`${API_URL}/compliance/risk-score`, { headers });
        console.log(`✅ Compliance risk fetched: Level ${compRes.data.data.level}`);

        console.log('\nStep 4: Executing Agentic AI Report Query...');
        const repRes = await axios.post(`${API_URL}/reports/ai-generate`, { query: 'Analyze recent expenses' }, { headers });
        console.log(`✅ AI Report title: ${repRes.data.data.title}`);

        console.log('\n✨ ALL AI ERA E2E VERIFICATIONS PASSED!');
        process.exit(0);
    } catch (error) {
        console.error('❌ E2E FAILED:', error.response?.data || error.message);
        process.exit(1);
    }
}
runE2E();
