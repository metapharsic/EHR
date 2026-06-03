
const axios = require('axios');

const API_URL = 'http://localhost:5000/api';
let token = '';

async function runVerification() {
    console.log('🚀 Verifying API Fixes...');

    try {
        // 1. Auth: Login
        console.log('Step 1: Authenticating as Admin...');
        const authRes = await axios.post(`${API_URL}/auth/login`, {
            username: 'admin',
            password: 'admin'
        });
        token = authRes.data.accessToken;
        const headers = { Authorization: `Bearer ${token}` };
        console.log('✅ Auth successful');

        // 2. Verify POS Terminal Summary
        console.log('\nStep 2: Verifying POS Terminal Summary...');
        try {
            const posRes = await axios.get(`${API_URL}/pos/terminal/summary`, { headers });
            console.log('✅ /api/pos/terminal/summary is working');
            console.log('Data:', JSON.stringify(posRes.data.data));
        } catch (e) {
            console.error('❌ /api/pos/terminal/summary FAILED:', e.response?.status, e.response?.data || e.message);
        }

        // 3. Verify Advanced Accounting Budgets
        console.log('\nStep 3: Verifying Advanced Accounting Budgets...');
        try {
            const budgetRes = await axios.get(`${API_URL}/accounting/advanced/budgets`, { headers });
            console.log('✅ /api/accounting/advanced/budgets is working');
            console.log('Count:', Array.isArray(budgetRes.data) ? budgetRes.data.length : 'N/A');
        } catch (e) {
            console.error('❌ /api/accounting/advanced/budgets FAILED:', e.response?.status, e.response?.data || e.message);
        }

        // 4. Verify Geospatial Analysis
        console.log('\nStep 4: Verifying Geospatial Analysis...');
        try {
            const geoRes = await axios.get(`${API_URL}/pcd/geospatial/analyze`, { headers });
            console.log('✅ /api/pcd/geospatial/analyze is working');
            console.log('Insights count:', geoRes.data.insights?.length);
        } catch (e) {
            console.error('❌ /api/pcd/geospatial/analyze FAILED:', e.response?.status, e.response?.data || e.message);
        }

        // 5. Verify CRM Strategy
        console.log('\nStep 5: Verifying CRM AI Strategy...');
        try {
            const crmRes = await axios.post(`${API_URL}/crm/ai/strategy`, {}, { headers });
            console.log('✅ /api/crm/ai/strategy is working');
        } catch (e) {
            console.error('❌ /api/crm/ai/strategy FAILED:', e.response?.status, e.response?.data || e.message);
        }

        console.log('\n✨ Verification Complete');
    } catch (error) {
        console.error('❌ Verification script crashed:', error.message);
    }
}

runVerification();
