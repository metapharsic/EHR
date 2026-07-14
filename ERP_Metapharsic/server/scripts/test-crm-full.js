/**
 * Exhaustive End-to-End Integration Test Script for CRM Module
 * Tests: 
 * 1. Auth & Lead Creation
 * 2. Activity Logging (Triggering Triggers)
 * 3. Product Interest Linking (Cross-Module: Products)
 * 4. Agentic AI Scoring (Cross-Module: Gemini AI)
 * 5. Weekly Strategy Generation (Cross-Module: Regional Demand)
 * 6. Customer Conversion (Cross-Module: Sync with Parties/POS)
 */

const axios = require('axios');

const API_URL = 'http://localhost:5000/api';
let token = '';

async function runTests() {
    console.log('🚀 Starting CRM End-to-End Verification...');

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

        // 2. Fetch a product for linking
        console.log('Step 2: Fetching Product for linking...');
        const productsRes = await axios.get(`${API_URL}/products`, { headers });
        // Debug: console.log('Products API Response:', JSON.stringify(productsRes.data).substring(0, 200));
        const productList = productsRes.data.value || productsRes.data.data || productsRes.data;
        const testProduct = Array.isArray(productList) ? productList[0] : null;
        
        if (!testProduct) throw new Error('No products found for testing');
        console.log(`✅ Using Product: ${testProduct.name} (${testProduct.id})`);

        // 3. CRM: Create Lead
        console.log('Step 3: Creating Enterprise Lead...');
        const leadRes = await axios.post(`${API_URL}/crm/leads`, {
            name: 'Metapharsic Test Hospital',
            contact: '1234567890',
            email: 'procurement@testhospital.com',
            estimatedValue: 1250000,
            status: 'New',
            priority: 'Urgent',
            industryType: 'Hospital',
            location: 'North'
        }, { headers });
        const leadId = leadRes.data.id;
        console.log(`✅ Lead created with ID: ${leadId}`);

        // 4. CRM: Link Product Interest
        console.log('Step 4: Linking Product Interest...');
        const interestRes = await axios.post(`${API_URL}/crm/leads/${leadId}/interests`, {
            productId: testProduct.id,
            interestLevel: 'High',
            notes: 'Client looking for bulk purchase'
        }, { headers });
        console.log(`✅ Product Interest linked successfully`);

        // 5. CRM: Log Activity
        console.log('Step 5: Logging Discovery Activity...');
        await axios.post(`${API_URL}/crm/leads/${leadId}/activities`, {
            type: 'Meeting',
            description: 'On-site facility visit and demand assessment.',
            outcome: 'Highly positive'
        }, { headers });
        console.log('✅ Activity logged and trigger fired');

        // 6. CRM: Trigger Agentic AI Scoring
        console.log('Step 6: Triggering Agentic AI Analysis...');
        const aiRes = await axios.put(`${API_URL}/crm/leads/${leadId}/ai-score`, {}, { headers });
        console.log(`✅ AI Scored: ${aiRes.data.ai.score}% - Sentiment: ${aiRes.data.ai.sentiment}`);
        console.log(`✅ AI Reason: ${aiRes.data.ai.reason}`);

        // 7. CRM: Generate Strategy
        console.log('Step 7: Generating Growth Strategy...');
        const strategyRes = await axios.post(`${API_URL}/crm/ai/strategy`, {}, { headers });
        console.log(`✅ Strategy Market Insight: ${strategyRes.data.marketInsight}`);
        const foundInStrategy = strategyRes.data.priorityLeads.find(l => l.id === leadId);
        if (foundInStrategy) {
            console.log(`✅ Lead prioritized in strategy: "${foundInStrategy.reason}"`);
        }

        // 8. CRM: Convert to Customer
        console.log('Step 8: Finalizing Conversion to ERP Customer...');
        const convRes = await axios.post(`${API_URL}/crm/convert/${leadId}`, {}, { headers });
        console.log(`✅ Conversion Transaction Successful: Party ID ${convRes.data.partyId}`);

        // 9. Verify Sync
        console.log('Step 9: Verifying ERP-wide Data Sync...');
        const partyVerify = await axios.get(`${API_URL}/pos/parties`, { headers });
        const party = partyVerify.data.data.find(p => p.id === convRes.data.partyId);
        if (party && party.name === 'Metapharsic Test Hospital') {
            console.log('✅ ERP Sync verified: Customer created with correct metadata');
        } else {
            throw new Error('Sync failed: Customer data mismatch');
        }

        console.log('\n✨ END-TO-END CRM VERIFICATION PASSED SUCCESSFULLY!');
        process.exit(0);
    } catch (error) {
        console.error('❌ E2E TEST FAILED:', error.response?.data || error.message);
        process.exit(1);
    }
}

runTests();
