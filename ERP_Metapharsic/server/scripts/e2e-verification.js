
const axios = require('axios');

const API_URL = 'http://localhost:5000/api';
let token = '';

async function runE2E() {
    console.log('🚀 Starting Comprehensive E2E Verification...');

    try {
        // 1. Auth: Login
        console.log('\nStep 1: Authenticating...');
        const authRes = await axios.post(`${API_URL}/auth/login`, {
            username: 'admin',
            password: 'admin'
        });
        token = authRes.data.accessToken;
        const headers = { Authorization: `Bearer ${token}` };
        console.log('✅ Logged in');

        // 2. Database Linking: POS Terminal Summary
        console.log('\nStep 2: Verifying POS Database Linking...');
        const initialPos = await axios.get(`${API_URL}/pos/terminal/summary`, { headers });
        const initialRevenue = initialPos.data.data.monthlyRevenue;
        console.log(`Current 30d Revenue: ${initialRevenue}`);

        console.log('Creating a test invoice to verify linking...');
        const nextInvRes = await axios.get(`${API_URL}/pos/next-invoice-number`, { headers });
        const invNo = nextInvRes.data.data.invoiceNumber + '-E2E';

        // Get a product for the invoice
        const productsRes = await axios.get(`${API_URL}/pos/products`, { headers });
        const product = productsRes.data.data[0];
        if (!product) throw new Error('No products available for E2E test');
        const batch = product.batches[0];
        if (!batch) throw new Error(`No batches for product ${product.name}`);

        const testAmount = 5000;
        await axios.post(`${API_URL}/pos/invoices`, {
            invoice_number: invNo,
            date: new Date().toISOString().split('T')[0],
            customer_name: 'E2E Test Customer',
            payment_mode: 'Cash',
            sub_total: testAmount,
            taxable_value: testAmount / 1.12,
            total_gst: testAmount - (testAmount / 1.12),
            net_amount: testAmount,
            items: [{
                product_id: product.id,
                batch_id: batch.id,
                quantity: 1,
                rate: testAmount,
                total_amount: testAmount,
                gst_percent: 12
            }]
        }, { headers });
        console.log(`✅ Invoice ${invNo} created for ₹${testAmount}`);

        const updatedPos = await axios.get(`${API_URL}/pos/terminal/summary`, { headers });
        const updatedRevenue = updatedPos.data.data.monthlyRevenue;
        console.log(`Updated 30d Revenue: ${updatedRevenue}`);

        if (updatedRevenue === initialRevenue + testAmount) {
            console.log('✅ POS Linking Verified: Revenue updated correctly');
        } else {
            console.warn(`⚠️ POS Linking Warning: Expected ${initialRevenue + testAmount}, got ${updatedRevenue}`);
        }

        // 3. Database Linking: Budgets
        console.log('\nStep 3: Verifying Budgets Database Linking...');
        // Get an account and cost center
        const coaRes = await axios.get(`${API_URL}/accounting/chart-of-accounts`, { headers });
        const account = coaRes.data.data?.[0] || coaRes.data?.[0];
        
        // Find a cost center
        const ccRes = await axios.get(`${API_URL}/accounting/advanced/cost-centers`, { headers }).catch(() => ({ data: [] }));
        const costCenter = ccRes.data[0];

        const budgetAmount = 75000;
        const fy = '2025-26';
        
        console.log(`Creating budget for ${fy}...`);
        await axios.post(`${API_URL}/accounting/advanced/budgets`, {
            accountId: account.id,
            costCenterId: costCenter?.id,
            financialYear: fy,
            budgetAmount: budgetAmount
        }, { headers });
        console.log('✅ Budget created');

        const budgetsRes = await axios.get(`${API_URL}/accounting/advanced/budgets`, { headers });
        const found = budgetsRes.data.find(b => b.financial_year === fy && parseFloat(b.budget_amount) === budgetAmount);
        if (found) {
            console.log('✅ Budget Linking Verified: Budget retrieved successfully');
        } else {
            console.error('❌ Budget Linking FAILED: Created budget not found in list');
        }

        // 4. Geospatial Data Linking
        console.log('\nStep 4: Verifying Geospatial Data Linking...');
        const geoRes = await axios.get(`${API_URL}/pcd/geospatial/analyze`, { headers });
        if (geoRes.data.success && geoRes.data.insights?.length > 0) {
            console.log(`✅ Geospatial Linking Verified: Found ${geoRes.data.insights.length} insights from DB`);
        } else {
            console.error('❌ Geospatial Linking FAILED or No Data');
        }

        console.log('\n✨ ALL E2E VERIFICATIONS COMPLETE');
    } catch (error) {
        console.error('❌ E2E FAILED:', error.response?.status, error.response?.data || error.message);
        if (error.stack) console.error(error.stack);
    }
}

runE2E();
