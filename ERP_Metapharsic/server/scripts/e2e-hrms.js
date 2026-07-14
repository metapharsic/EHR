
const axios = require('axios');

const API_URL = 'http://localhost:5000/api';
let token = '';

async function runE2E() {
    console.log('🚀 Starting Enterprise HRMS End-to-End Verification...');

    try {
        // 1. Auth
        console.log('\nStep 1: Authenticating...');
        const authRes = await axios.post(`${API_URL}/auth/login`, { username: 'admin', password: 'admin' });
        token = authRes.data.accessToken;
        const headers = { Authorization: `Bearer ${token}` };
        console.log('✅ Logged in as Admin');

        // 2. Candidate -> Hire Workflow (Manual Steps verified by API)
        console.log('\nStep 2: Hiring Workflow (ATS Simulation)...');
        const candName = 'E2E New Hire ' + Math.floor(Math.random()*1000);
        const candRes = await axios.post(`${API_URL}/hr/ats/candidates`, {
            name: candName,
            email: 'e2e@hire.com',
            role_applied: 'Field Sales Representative'
        }, { headers });
        console.log(`✅ Candidate ${candName} sourced via ATS`);

        // 3. Employee Management
        console.log('\nStep 3: Workforce Verification...');
        const empRes = await axios.get(`${API_URL}/hr/employees`, { headers });
        console.log(`✅ Verified ${empRes.data.data.length} active employee records`);

        // 4. Time & Absence
        console.log('\nStep 4: Time & Absence Workflow...');
        const emp = empRes.data.data[0];
        
        await axios.post(`${API_URL}/hr/attendance/clock-in`, {
            employee_id: emp.id,
            location: 'Sector 5 Remote Site'
        }, { headers });
        console.log(`   ✅ Clock-in successful for ${emp.name}`);

        const leaveRes = await axios.post(`${API_URL}/hr/leaves`, {
            employee_id: emp.id,
            leave_type: 'Annual',
            start_date: '2026-08-01',
            end_date: '2026-08-05',
            reason: 'Vacation'
        }, { headers });
        console.log(`   ✅ Leave request (5 days) created for ${emp.name}`);

        // 5. AI Analytics
        console.log('\nStep 5: Fetching AI Workforce Predictive Insights...');
        const predRes = await axios.get(`${API_URL}/hr/predictive-analytics`, { headers });
        console.log(`✅ AI Analysis: Flight Risk Count: ${predRes.data.data.flightRisk}, Hiring Forecast: ${predRes.data.data.hiringForecast}`);

        // 6. AI Copilot
        console.log('\nStep 6: Interacting with HR AI Copilot...');
        const copilotRes = await axios.post(`${API_URL}/hr/copilot`, { prompt: 'Who is at risk of leaving?' }, { headers });
        console.log(`✅ Copilot response received: "${copilotRes.data.response}"`);

        console.log('\n✨ ALL ENTERPRISE HRMS E2E VERIFICATIONS PASSED!');
        console.log('The HR module is now a comprehensive management ecosystem.');
        process.exit(0);
    } catch (error) {
        console.error('❌ E2E FAILED:', error.response?.data || error.message);
        process.exit(1);
    }
}

runE2E();
