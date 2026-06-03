
const axios = require('axios');

const API_URL = 'http://localhost:5000/api';
let token = '';

async function runE2E() {
    console.log('🚀 Starting CRM Sub-feature E2E Verification...');

    try {
        // 1. Auth
        console.log('\nStep 1: Authenticating...');
        const authRes = await axios.post(`${API_URL}/auth/login`, {
            username: 'admin',
            password: 'admin'
        });
        token = authRes.data.accessToken;
        const headers = { Authorization: `Bearer ${token}` };
        console.log('✅ Auth successful');

        // 2. Create Lead for Queue
        console.log('\nStep 2: Creating a lead due for immediate follow-up...');
        const today = new Date().toISOString().split('T')[0];
        const leadRes = await axios.post(`${API_URL}/crm/leads`, {
            name: 'E2E Queue Partner',
            companyName: 'Queue Ventures',
            contact: '7776665555',
            industryType: 'PCD Partner',
            estimatedValue: 1200000,
            nextFollowUp: today,
            status: 'Qualified'
        }, { headers });
        const leadId = leadRes.data.id;
        console.log(`✅ Lead created: ${leadId} (Follow-up: ${today})`);

        // 3. Verify in Pipeline (General List)
        console.log('\nStep 3: Verifying lead appearance in general pipeline...');
        const allLeads = await axios.get(`${API_URL}/crm/leads`, { headers });
        const inAll = allLeads.data.find(l => l.id === leadId);
        if (!inAll) throw new Error('Lead missing from general pipeline');
        console.log('✅ Lead found in pipeline');

        // 4. Verify in Follow-up Queue
        console.log('\nStep 4: Verifying lead presence in Follow-up Queue...');
        const queueLeads = await axios.get(`${API_URL}/crm/leads?queue=today_and_overdue`, { headers });
        const inQueue = queueLeads.data.find(l => l.id === leadId);
        if (!inQueue) throw new Error('Lead missing from targeted Follow-up Queue');
        console.log('✅ Lead verified in Follow-up Queue');

        // 5. Verify Analytics Impact
        console.log('\nStep 5: Verifying Real-time Analytics synchronization...');
        const analyticsRes = await axios.get(`${API_URL}/crm/analytics`, { headers });
        const qualifiedDist = analyticsRes.data.distribution.find(d => d.name === 'Qualified');
        console.log(`   Distribution for 'Qualified': ₹${qualifiedDist?.value}`);
        if (!qualifiedDist || parseFloat(qualifiedDist.value) < 1200000) {
            throw new Error('Analytics distribution does not reflect the new lead value');
        }
        console.log('✅ Analytics sync verified');

        // 6. Action: Update lead (Remove from queue)
        console.log('\nStep 6: Rescheduling follow-up (Actioning the queue)...');
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        
        await axios.put(`${API_URL}/crm/leads/${leadId}`, {
            ...leadRes.data,
            nextFollowUp: tomorrowStr
        }, { headers });
        console.log(`✅ Lead rescheduled for ${tomorrowStr}`);

        // 7. Verify removed from queue
        console.log('\nStep 7: Verifying removal from immediate queue...');
        const updatedQueue = await axios.get(`${API_URL}/crm/leads?queue=today_and_overdue`, { headers });
        const stillInQueue = updatedQueue.data.find(l => l.id === leadId);
        if (stillInQueue) throw new Error('Lead should have been removed from today\'s queue');
        console.log('✅ Follow-up Queue action verified');

        console.log('\n✨ ALL CRM SUB-FEATURE E2E VERIFICATIONS PASSED!');
        process.exit(0);
    } catch (error) {
        console.error('❌ E2E FAILED:', error.response?.data || error.message);
        if (error.stack) console.error(error.stack);
        process.exit(1);
    }
}

runE2E();
