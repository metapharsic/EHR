
const axios = require('axios');

const API_URL = 'http://localhost:5000/api';
let token = '';

async function runIntegrationTests() {
    console.log('🚀 Starting Growth Command Center Integration Verification...');

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

        // 2. Verify Stats Enhancement
        console.log('\nStep 2: Verifying Unified Growth Stats...');
        const statsRes = await axios.get(`${API_URL}/crm/stats`, { headers });
        const stats = statsRes.data;
        console.log('Stats:', JSON.stringify(stats));
        if (stats.active_pcd_partners === undefined || stats.monthly_sales_volume === undefined) {
            throw new Error('Enhanced stats (PCD/Sales) missing from response');
        }
        console.log('✅ Stats verified');

        // 3. Lead -> PCD Partner Conversion
        console.log('\nStep 3: Creating PCD Partner Lead & Converting...');
        const leadName = 'Growth Integration Lead ' + Date.now();
        const leadRes = await axios.post(`${API_URL}/crm/leads`, {
            name: leadName,
            companyName: 'Integrated Growth Corp',
            email: 'growth@corp.com',
            contact: '1234567890',
            location: 'Growth Zone',
            industryType: 'PCD Partner',
            estimatedValue: 1000000
        }, { headers });
        const lead = leadRes.data;
        console.log(`✅ Lead created: ${lead.id}`);

        console.log('Converting lead to PCD Partner...');
        const convRes = await axios.post(`${API_URL}/crm/convert/${lead.id}`, {}, { headers });
        console.log(`✅ Conversion response: ${convRes.data.message}`);

        // Verify Party Sync
        const partyRes = await axios.get(`${API_URL}/pos/parties`, { headers });
        const party = partyRes.data.data.find(p => p.id === convRes.data.partyId);
        if (!party) throw new Error('ERP Party was not created');
        console.log('✅ ERP Party Sync verified');

        // Verify PCD Partner Sync
        const pcdRes = await axios.get(`${API_URL}/pcd/partners`, { headers });
        const pcdPartner = pcdRes.data.data.find(p => p.converted_party_id === party.id);
        if (!pcdPartner) throw new Error('PCD Partner record was not created for the lead');
        console.log(`✅ PCD Partner Sync verified: ID ${pcdPartner.id}`);

        console.log('\n✨ GROWTH COMMAND CENTER INTEGRATION TESTS PASSED!');
        process.exit(0);
    } catch (error) {
        console.error('❌ INTEGRATION TEST FAILED:', error.response?.data || error.message);
        if (error.stack) console.error(error.stack);
        process.exit(1);
    }
}

runIntegrationTests();
