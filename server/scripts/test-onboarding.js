
const axios = require('axios');

async function testOnboarding() {
  const API_URL = 'http://localhost:5000/api';
  
  try {
    const authRes = await axios.post(`${API_URL}/auth/login`, { username: 'admin', password: 'admin' });
    const token = authRes.data.accessToken;
    const headers = { Authorization: `Bearer ${token}` };

    // 1. Create a new employee to trigger onboarding
    console.log('Creating new employee to trigger onboarding...');
    const empData = {
      name: `Onboard Test ${Date.now()}`,
      email: `onboard${Date.now()}@metapharsic.com`,
      department_id: null,
      designation_id: null
    };
    
    // get random dept/desig
    const depts = await axios.get(`${API_URL}/hr/departments`, { headers });
    if(depts.data.data.length > 0) empData.department_id = depts.data.data[0].id;
    
    const desigs = await axios.get(`${API_URL}/hr/designations`, { headers });
    if(desigs.data.data.length > 0) empData.designation_id = desigs.data.data[0].id;

    const empRes = await axios.post(`${API_URL}/hr/employees`, empData, { headers });
    const empId = empRes.data.data.id;
    console.log(`Created employee: ${empId}`);

    // Wait a moment for async trigger
    await new Promise(r => setTimeout(r, 1000));

    // 2. Fetch active onboarding lists
    console.log('Fetching active onboarding lists...');
    const onbRes = await axios.get(`${API_URL}/hr/onboarding/checklists/active`, { headers });
    const checklists = onbRes.data.data;
    
    console.log(`Found ${checklists.length} active checklists.`);
    if (checklists.length > 0) {
      console.log('✅ Onboarding successfully generated:');
      console.log(`   Employee: ${checklists[0].employee_name}`);
      console.log(`   Tasks: ${checklists[0].tasks.length}`);
    } else {
      console.error('❌ Onboarding checklist NOT generated!');
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Error:', err.response ? err.response.data : err.message);
    process.exit(1);
  }
}

testOnboarding();
