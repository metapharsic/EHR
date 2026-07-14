/**
 * Integration Test Script for CRM Module
 * Tests Database -> Backend -> AI logic
 */

const axios = require('axios');

const API_URL = 'http://localhost:5000/api';
let token = '';

async function runTests() {
    console.log('🚀 Starting CRM Integration Tests...');

    try {
        // 1. Auth: Login
        console.log('Step 1: Authenticating...');
        const authRes = await axios.post(`${API_URL}/auth/login`, {
            username: 'admin',
            password: 'admin'
        });
        token = authRes.data.accessToken;
        const headers = { Authorization: `Bearer ${token}` };
        console.log('✅ Auth successful');

        // 2. CRM: Create Lead
        console.log('Step 2: Creating Test Lead...');
        const leadRes = await axios.post(`${API_URL}/crm/leads`, {
            name: 'Test Pharmacy Corp',
            contact: '9999988888',
            email: 'test@pharmacy.com',
            estimatedValue: 500000,
            status: 'New',
            priority: 'High',
            industryType: 'Pharmacy'
        }, { headers });
        const leadId = leadRes.data.id;
        console.log(`✅ Lead created with ID: ${leadId}`);

        // 3. CRM: Log Activity
        console.log('Step 3: Logging Activity...');
        await axios.post(`${API_URL}/crm/leads/${leadId}/activities`, {
            type: 'Call',
            description: 'Discussed high volume antibiotic supply',
            outcome: 'Positive interest'
        }, { headers });
        console.log('✅ Activity logged');

        // 4. CRM: Trigger AI Scoring
        console.log('Step 4: Triggering Agentic AI Scoring...');
        const aiRes = await axios.put(`${API_URL}/crm/leads/${leadId}/ai-score`, {}, { headers });
        console.log(`✅ AI Scored: ${aiRes.data.ai.score}% - Sentiment: ${aiRes.data.ai.sentiment}`);

        // 5. CRM: Trigger Agentic AI Strategy
        console.log('Step 5: Generating Weekly Agentic Strategy...');
        const strategyRes = await axios.post(`${API_URL}/crm/ai/strategy`, {}, { headers });
        console.log(`✅ Strategy Generated: ${strategyRes.data.priorityLeads.length} priority leads found.`);
        console.log(`✅ Market Insight: ${strategyRes.data.marketInsight}`);

        // 6. CRM: Sync/Convert to ERP Party (Sync)
        console.log('Step 6: Converting Lead to ERP Party (Sync)...');
        const convRes = await axios.post(`${API_URL}/crm/convert/${leadId}`, {}, { headers });
        console.log(`✅ Converted to Party ID: ${convRes.data.partyId}`);

        // 7. Verify Party exists
        console.log('Step 7: Verifying Party in Database...');
        const partyRes = await axios.get(`${API_URL}/pos/parties`, { headers });
        const party = partyRes.data.data.find(p => p.id === convRes.data.partyId);
        if (party) {
            console.log('✅ Sync verified: Party found in POS/Sales module');
        } else {
            throw new Error('Sync failed: Party not found');
        }

        console.log('\n✨ ALL CRM INTEGRATION TESTS PASSED SUCCESSFULLY!');
    } catch (error) {
        console.error('❌ TEST FAILED:', error.response?.data || error.message);
        process.exit(1);
    }
}

runTests();
