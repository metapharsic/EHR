
const axios = require('axios');

const API_URL = 'http://localhost:5000/api';
let token = '';

async function runTests() {
    console.log('🚀 Starting AI Era Integration Tests...');

    try {
        const authRes = await axios.post(`${API_URL}/auth/login`, { username: 'admin', password: 'admin' });
        token = authRes.data.accessToken;
        const headers = { Authorization: `Bearer ${token}` };

        // Test Payroll Anomalies
        console.log('Testing GET /hr/payroll/anomalies...');
        const hrRes = await axios.get(`${API_URL}/hr/payroll/anomalies`, { headers });
        if (!hrRes.data.success) throw new Error('HR anomalies failed');
        console.log('✅ Payroll anomalies endpoint is active');

        // Test Compliance Risk Score
        console.log('Testing GET /compliance/risk-score...');
        const compRes = await axios.get(`${API_URL}/compliance/risk-score`, { headers });
        if (!compRes.data.success || !compRes.data.data.level) throw new Error('Compliance risk failed');
        console.log(`✅ Compliance risk score calculated: ${compRes.data.data.score} (${compRes.data.data.level})`);

        // Test AI Reporting
        console.log('Testing POST /reports/ai-generate...');
        const repRes = await axios.post(`${API_URL}/reports/ai-generate`, { query: 'Show me revenue forecast' }, { headers });
        if (!repRes.data.success || !repRes.data.data.chartData) throw new Error('AI Report failed');
        console.log(`✅ AI Report generated: ${repRes.data.data.title}`);

        console.log('✨ All AI Integration tests passed!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}
runTests();
