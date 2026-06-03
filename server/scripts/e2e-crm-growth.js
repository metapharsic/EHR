
const axios = require('axios');

const API_URL = 'http://localhost:5000/api';
let token = '';

async function runE2ETests() {
    console.log('🚀 Starting Growth Command Center E2E Verification...');

    try {
        // 1. Auth
        console.log('\nStep 1: Authenticating as Admin...');
        const authRes = await axios.post(`${API_URL}/auth/login`, {
            username: 'admin',
            password: 'admin'
        });
        token = authRes.data.accessToken;
        const headers = { Authorization: `Bearer ${token}` };
        console.log('✅ Auth successful');

        // 2. Create Lead
        console.log('\nStep 2: Registering a new Growth Opportunity (PCD Partner Lead)...');
        const leadName = 'E2E Expansion Partner ' + Math.floor(Math.random()*1000);
        const leadRes = await axios.post(`${API_URL}/crm/leads`, {
            name: leadName,
            companyName: 'Expansion Labs',
            email: 'expand@labs.com',
            contact: '8877665544',
            location: 'Sector 7G',
            industryType: 'PCD Partner',
            estimatedValue: 2500000,
            status: 'Qualified'
        }, { headers });
        const lead = leadRes.data;
        console.log(`✅ Lead ${leadName} registered`);

        // 3. AI Scoring
        console.log('\nStep 3: Triggering AI Agent for strategic scoring...');
        const aiRes = await axios.put(`${API_URL}/crm/leads/${lead.id}/ai-score`, {}, { headers });
        console.log(`✅ AI Result: ${aiRes.data.ai.sentiment} Sentiment, Score: ${aiRes.data.ai.score}%`);

        // 4. Conversion
        console.log('\nStep 4: Promoting Lead to Franchise Partner (Cross-Module Sync)...');
        const convRes = await axios.post(`${API_URL}/crm/convert/${lead.id}`, {}, { headers });
        const partyId = convRes.data.partyId;
        console.log(`✅ Promotion successful: ${convRes.data.message}`);

        // 5. Verify Cross-Module Impact
        console.log('\nStep 5: Verifying multi-module synchronization...');
        
        // A. Check Finance (Parties)
        const partyRes = await axios.get(`${API_URL}/pos/parties`, { headers });
        const party = partyRes.data.data.find(p => p.id === partyId);
        if (!party) throw new Error('Finance: Party record not found');
        console.log('   ✅ Finance: Party (Debtor) record verified');

        // B. Check PCD Network
        const pcdRes = await axios.get(`${API_URL}/pcd/partners`, { headers });
        const pcdPartner = pcdRes.data.data.find(p => p.converted_party_id === partyId);
        if (!pcdPartner) throw new Error('PCD: Partner record not found');
        console.log('   ✅ PCD Network: Franchise Partner record verified');

        // C. Check Growth Stats
        const statsRes = await axios.get(`${API_URL}/crm/stats`, { headers });
        console.log(`   ✅ Dashboard: Current Active Partners: ${statsRes.data.active_pcd_partners}`);

        console.log('\n✨ GROWTH COMMAND CENTER E2E VERIFICATION PASSED!');
        console.log('CRM is now fully integrated with Sales and PCD modules.');
        process.exit(0);
    } catch (error) {
        console.error('❌ E2E TEST FAILED:', error.response?.data || error.message);
        if (error.stack) console.error(error.stack);
        process.exit(1);
    }
}

runE2ETests();
