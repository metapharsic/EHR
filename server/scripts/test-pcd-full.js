/**
 * E2E Integration Test Script for PCD Network Management
 */

const axios = require('axios');

const API_URL = 'http://localhost:5000/api';
let token = '';

async function runPcdTests() {
    console.log('🚀 Starting PCD Network E2E Verification...');

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

        // 2. PCD: Create Partner
        console.log('Step 2: Creating PCD Partner Application...');
        const partnerRes = await axios.post(`${API_URL}/pcd/partners`, {
            name: 'Sunrise Pharma Distributors',
            territory: 'Mumbai South ' + Date.now(), // Ensure unique territory for test
            state: 'Maharashtra',
            contact_person: 'John Doe',
            contact_number: '9876543210',
            email: 'john@sunrise.com',
            drug_license_no: 'DL-' + Date.now(),
            gst_registration: '27AAAAA0000A1Z' + Math.floor(Math.random()*9),
            partner_grade: 'GOLD',
            status: 'APPLIED'
        }, { headers });
        const partnerId = partnerRes.data.data.id;
        console.log(`✅ Partner created with ID: ${partnerId}`);

        // 3. PCD: Verify Documents (Simulated)
        console.log('Step 3: Verifying Partner Documents...');
        const docsRes = await axios.get(`${API_URL}/pcd/partner-documents?partner_id=${partnerId}`, { headers });
        for (const doc of docsRes.data.data) {
            await axios.put(`${API_URL}/pcd/partner-documents/${doc.id}/verify`, { status: 'VERIFIED' }, { headers });
            console.log(`   ✅ Document ${doc.document_type} verified`);
        }

        // 4. PCD: Set Target
        console.log('Step 4: Setting Sales Target...');
        const targetRes = await axios.post(`${API_URL}/pcd/targets`, {
            partner_id: partnerId,
            period: 'Q2-2026',
            target_amount: 1000000,
            incentive_percentage: 5
        }, { headers });
        console.log(`✅ Target set for Q2-2026: ₹1,000,000`);

        // 5. PCD: Create Transaction (Order)
        console.log('Step 5: Logging Partner Order (Transaction)...');
        const transRes = await axios.post(`${API_URL}/pcd/transactions`, {
            partner_id: partnerId,
            order_amount: 50000,
            product_name: 'Augmentin 625',
            quantity: 500,
            order_status: 'VERIFIED',
            payment_status: 'UNPAID'
        }, { headers });
        console.log(`✅ Order ₹50,000 logged`);

        // 6. Verify Target Update
        console.log('Step 6: Verifying Target Achievement Update...');
        const updatedTarget = await axios.get(`${API_URL}/pcd/targets?partner_id=${partnerId}`, { headers });
        const target = updatedTarget.data.data[0];
        console.log(`✅ Target progress: ₹${target.achieved_amount} / ₹${target.target_amount} (${target.status})`);
        if (parseFloat(target.achieved_amount) !== 50000) throw new Error('Target achievement sync failed');

        // 7. PCD: Generate Commission
        console.log('Step 7: Generating Commissions...');
        await axios.post(`${API_URL}/pcd/commissions/generate`, { period: 'Q2-2026' }, { headers });
        const commRes = await axios.get(`${API_URL}/pcd/commissions?partner_id=${partnerId}&period=Q2-2026`, { headers });
        if (commRes.data.data.length > 0) {
            const comm = commRes.data.data[0];
            console.log(`✅ Commission generated: ₹${comm.net_commission} (${comm.payment_status})`);
        } else {
            throw new Error('Commission generation failed');
        }

        console.log('\n✨ PCD NETWORK VERIFICATION PASSED SUCCESSFULLY!');
        process.exit(0);
    } catch (error) {
        console.error('❌ PCD E2E TEST FAILED:', error.response?.data || error.message);
        process.exit(1);
    }
}

runPcdTests();
