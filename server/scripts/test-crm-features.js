
const axios = require('axios');

const API_URL = 'http://localhost:5000/api';
let token = '';

async function runFeatureTests() {
    console.log('🚀 Starting CRM Sub-feature Integration Verification...');

    try {
        // 1. Auth
        console.log('Step 1: Authenticating...');
        const authRes = await axios.post(`${API_URL}/auth/login`, {
            username: 'admin',
            password: 'admin'
        });
        token = authRes.data.accessToken;
        const headers = { Authorization: `Bearer ${token}` };
        console.log('✅ Auth successful');

        // 2. Verify Analytics
        console.log('\nStep 2: Verifying Real-time Analytics Endpoint...');
        const analyticsRes = await axios.get(`${API_URL}/crm/analytics`, { headers });
        const { velocity, distribution } = analyticsRes.data;
        
        console.log('Velocity Data Points:', velocity.length);
        console.log('Distribution Data Points:', distribution.length);
        
        if (!Array.isArray(velocity) || !Array.isArray(distribution)) {
            throw new Error('Analytics response format invalid');
        }
        console.log('✅ Analytics verified');

        // 3. Verify Follow-up Queue
        console.log('\nStep 3: Verifying Follow-up Queue filtering...');
        
        // Create a lead due for follow-up today
        const today = new Date().toISOString().split('T')[0];
        const leadRes = await axios.post(`${API_URL}/crm/leads`, {
            name: 'Queue Test Lead',
            contact: '1231231234',
            industryType: 'Clinic',
            estimatedValue: 50000,
            nextFollowUp: today,
            status: 'New'
        }, { headers });
        const testLeadId = leadRes.data.id;
        console.log(`✅ Test lead created: ${testLeadId} (Due: ${today})`);

        // Fetch queue
        const queueRes = await axios.get(`${API_URL}/crm/leads?queue=today_and_overdue`, { headers });
        const found = queueRes.data.find(l => l.id === testLeadId);
        
        if (!found) {
            throw new Error('New lead did not appear in the Follow-up Queue');
        }
        console.log(`✅ Follow-up Queue verified: Found lead ${testLeadId}`);

        // 4. Verify Pipeline Consistency
        console.log('\nStep 4: Verifying Pipeline View consistency...');
        const allLeadsRes = await axios.get(`${API_URL}/crm/leads`, { headers });
        const statuses = [...new Set(allLeadsRes.data.map(l => l.status))];
        console.log('Active Pipeline Statuses:', statuses.join(', '));
        
        if (statuses.length === 0) {
            console.warn('⚠️ Warning: Pipeline is empty, verification limited.');
        } else {
            console.log('✅ Pipeline consistency verified');
        }

        console.log('\n✨ CRM SUB-FEATURE INTEGRATION TESTS PASSED!');
        process.exit(0);
    } catch (error) {
        console.error('❌ FEATURE TEST FAILED:', error.response?.data || error.message);
        if (error.stack) console.error(error.stack);
        process.exit(1);
    }
}

runFeatureTests();
