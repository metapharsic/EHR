
const axios = require('axios');

const API_URL = 'http://localhost:5000/api';
let token = '';

async function runIntegrationTests() {
    console.log('🚀 Starting Enterprise HRMS Integration Verification...');

    try {
        // 1. Auth
        console.log('Step 1: Authenticating...');
        const authRes = await axios.post(`${API_URL}/auth/login`, {
            username: 'admin',
            password: 'admin'
        });
        token = authRes.data.accessToken;
        const headers = { Authorization: `Bearer ${token}` };
        console.log('✅ Auth successful');

        // 2. ATS: Create Candidate
        console.log('\nStep 2: Creating ATS Candidate...');
        const candRes = await axios.post(`${API_URL}/hr/ats/candidates`, {
            name: 'HRMS Test Candidate',
            email: 'cand@hrms.com',
            phone: '1112223334',
            role_applied: 'Senior Sales Rep'
        }, { headers });
        const candidate = candRes.data.data;
        if (!candidate || candidate.status !== 'Sourced') throw new Error('ATS Candidate creation failed');
        console.log(`✅ Candidate created: ${candidate.id}`);

        // 3. Leave: Apply for Leave
        console.log('\nStep 3: Submitting Leave Request...');
        const empRes = await axios.get(`${API_URL}/hr/employees`, { headers });
        const emp = empRes.data.data[0];
        if (!emp) throw new Error('No employees available for leave test');

        const leaveRes = await axios.post(`${API_URL}/hr/leaves`, {
            employee_id: emp.id,
            leave_type: 'Sick',
            start_date: '2026-07-01',
            end_date: '2026-07-02',
            reason: 'Test Sick Leave'
        }, { headers });
        const leave = leaveRes.data.data;
        if (leave.days !== 2) throw new Error(`Leave day calculation mismatch: expected 2, got ${leave.days}`);
        console.log(`✅ Leave requested for ${emp.name}: ${leave.days} day(s)`);

        // 4. Attendance: Clock In
        console.log('\nStep 4: Logging GPS Attendance (Clock In)...');
        const attRes = await axios.post(`${API_URL}/hr/attendance/clock-in`, {
            employee_id: emp.id,
            location: 'Latitude: 18.52, Longitude: 73.85'
        }, { headers });
        if (attRes.data.data.status !== 'Present') throw new Error('Attendance status incorrect');
        console.log(`✅ Clock-in successful for ${emp.name}`);

        // 5. AI Copilot: Query Policy
        console.log('\nStep 5: Querying Enterprise AI Copilot...');
        const copilotRes = await axios.post(`${API_URL}/hr/copilot`, { prompt: 'What is the sick leave policy?' }, { headers });
        if (!copilotRes.data.response.includes('Sick')) throw new Error('AI Copilot response unrelated to query');
        console.log(`✅ AI Copilot verified: "${copilotRes.data.response.slice(0, 40)}..."`);

        console.log('\n✨ HRMS INTEGRATION TESTS PASSED SUCCESSFULLY!');
        process.exit(0);
    } catch (error) {
        console.error('❌ INTEGRATION TEST FAILED:', error.response?.data || error.message);
        process.exit(1);
    }
}

runIntegrationTests();
