/**
 * Integration Test for Geospatial Territory Intelligence
 */

const axios = require('axios');

const API_URL = 'http://localhost:5000/api';
let token = '';

async function runGeospatialTests() {
    console.log('🚀 Starting Geospatial Intelligence Verification...');

    try {
        // 1. Auth
        const authRes = await axios.post(`${API_URL}/auth/login`, {
            username: 'admin',
            password: 'admin'
        });
        token = authRes.data.accessToken;
        const headers = { Authorization: `Bearer ${token}` };
        console.log('✅ Auth successful');

        // 2. Seed test data for Cannibalization (2 partners close to each other in Pune)
        console.log('Step 2: Seeding partners for overlap detection...');
        const uniqueId = Date.now();
        const p1 = await axios.post(`${API_URL}/pcd/partners`, {
            name: 'Pune Partner Alpha',
            territory: 'Pune Cluster A ' + uniqueId,
            latitude: 18.5204,
            longitude: 73.8567,
            contact_number: '1111111111',
            drug_license_no: 'DL-A-' + uniqueId,
            status: 'ACTIVE'
        }, { headers });

        const p2 = await axios.post(`${API_URL}/pcd/partners`, {
            name: 'Pune Partner Beta',
            territory: 'Pune Cluster B ' + uniqueId,
            latitude: 18.5210, // Very close to Alpha
            longitude: 73.8570,
            contact_number: '2222222222',
            drug_license_no: 'DL-B-' + uniqueId,
            status: 'ACTIVE'
        }, { headers });
        
        const p3 = await axios.post(`${API_URL}/pcd/partners`, {
            name: 'Pune Partner Gamma',
            territory: 'Pune Cluster C ' + uniqueId,
            latitude: 18.5220, 
            longitude: 73.8580,
            contact_number: '3333333333',
            drug_license_no: 'DL-C-' + uniqueId,
            status: 'ACTIVE'
        }, { headers });

        console.log('✅ 3 Partners seeded in Pune cluster');

        // 3. Trigger Analysis
        console.log('Step 3: Triggering AI Geospatial Analysis...');
        const analysisRes = await axios.get(`${API_URL}/pcd/geospatial/analyze`, { headers });
        const insights = analysisRes.data.insights;

        // 4. Verify UNDERSERVED (Vidarbha)
        const underserved = insights.find(i => i.type === 'UNDERSERVED');
        if (underserved) {
            console.log(`✅ UNDERSERVED Detected: ${underserved.region_name} - ${underserved.description}`);
        } else {
            throw new Error('Underserved detection failed');
        }

        // 5. Verify CANNIBALIZATION (Pune)
        const cannibalization = insights.find(i => i.type === 'CANNIBALIZATION');
        if (cannibalization) {
            console.log(`✅ CANNIBALIZATION Detected: ${cannibalization.region_name} - ${cannibalization.description}`);
        } else {
            throw new Error('Cannibalization detection failed');
        }

        // 6. Verify OPTIMAL
        const optimal = insights.find(i => i.type === 'OPTIMAL');
        if (optimal) {
            console.log(`✅ OPTIMAL Growth Detected: ${optimal.region_name}`);
        }

        console.log('\n✨ GEOSPATIAL INTELLIGENCE VERIFICATION PASSED SUCCESSFULLY!');
        process.exit(0);
    } catch (error) {
        console.error('❌ GEOSPATIAL TEST FAILED:', error.response?.data || error.message);
        process.exit(1);
    }
}

runGeospatialTests();
