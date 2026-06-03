
const axios = require('axios');

const API_URL = 'http://localhost:5000/api';
let token = '';

async function runIntegrationTests() {
    console.log('🚀 Starting PCD Integration Verification...');

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

        // 2. Setup: Get a real product and batch for testing
        console.log('\nStep 2: Fetching Product & Batch for transaction test...');
        const productsRes = await axios.get(`${API_URL}/pos/products`, { headers });
        const product = productsRes.data.data.find(p => p.batches.length > 0);
        if (!product) throw new Error('No product with available batches found for testing');
        const batch = product.batches[0];
        console.log(`Using Product: ${product.name}, Batch: ${batch.batchNumber}`);

        // 3. Partner -> Party Sync
        console.log('\nStep 3: Creating ACTIVE PCD Partner & Verifying Party Sync...');
        const partnerName = 'Integration Test Partner ' + Date.now();
        const partnerRes = await axios.post(`${API_URL}/pcd/partners`, {
            name: partnerName,
            territory: 'Test Territory ' + Date.now(),
            contact_person: 'Test Person',
            contact_number: '1234567890',
            email: 'test@pcd.com',
            status: 'ACTIVE',
            partner_grade: 'PLATINUM',
            credit_limit: 500000
        }, { headers });
        const partner = partnerRes.data.data;
        console.log(`✅ Partner created: ${partner.id}`);
        
        if (!partner.converted_party_id) throw new Error('Partner was not automatically synced to Party');
        console.log(`✅ Auto-sync verified: Party ID ${partner.converted_party_id}`);

        // 4. Set Target (BEFORE Transaction)
        console.log('\nStep 4: Setting Sales Target...');
        const period = 'Q2-2026-' + Math.floor(Math.random()*1000);
        await axios.post(`${API_URL}/pcd/targets`, {
            partner_id: partner.id,
            period: period,
            target_amount: 100000,
            incentive_percentage: 10
        }, { headers });
        console.log(`✅ Target set for ${period}`);

        // 5. Transaction -> Invoice -> GL/Stock Sync
        console.log('\nStep 5: Placing VERIFIED Transaction & Verifying ERP integration...');
        const orderAmount = 75000;
        const txRes = await axios.post(`${API_URL}/pcd/transactions`, {
            partner_id: partner.id,
            product_id: product.id,
            batch_id: batch.id,
            product_name: product.name,
            quantity: 10,
            order_amount: orderAmount,
            order_status: 'VERIFIED',
            payment_status: 'UNPAID'
        }, { headers });
        const tx = txRes.data.data;
        console.log(`✅ Transaction created: ${tx.id}`);

        if (!tx.sales_invoice_id) throw new Error('Transaction did not trigger Sales Invoice creation');
        console.log(`✅ Sales Invoice created: ${tx.sales_invoice_id}`);

        // Verify Target Achievement
        const targetCheck = await axios.get(`${API_URL}/pcd/targets?partner_id=${partner.id}`, { headers });
        const target = targetCheck.data.data[0];
        console.log(`✅ Target Achievement updated: ₹${target?.achieved_amount} / ₹${target?.target_amount} (Status: ${target?.status})`);
        
        if (!target || parseFloat(target.achieved_amount) === 0) throw new Error('Target achievement was not updated by transaction');

        // 6. Commission -> JV Sync
        console.log('\nStep 6: Generating Commission & Verifying Ledger integration...');
        await axios.post(`${API_URL}/pcd/commissions/generate`, { period }, { headers });
        const commRes = await axios.get(`${API_URL}/pcd/commissions?partner_id=${partner.id}&period=${period}`, { headers });
        const comm = commRes.data.data[0];
        if (!comm) throw new Error('Commission was not generated');
        console.log(`✅ Commission generated: ₹${comm.net_commission}`);

        if (!comm.journal_voucher_id) throw new Error('Commission did not trigger Journal Voucher creation');
        console.log(`✅ Journal Voucher created: ${comm.journal_voucher_id}`);

        console.log('\n✨ PCD INTEGRATION TESTS PASSED SUCCESSFULLY!');
        process.exit(0);
    } catch (error) {
        console.error('❌ INTEGRATION TEST FAILED:', error.response?.data || error.message);
        if (error.stack) console.error(error.stack);
        process.exit(1);
    }
}

runIntegrationTests();
