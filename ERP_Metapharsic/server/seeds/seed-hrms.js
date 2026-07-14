'use strict';
/**
 * seed-hrms.js
 * Comprehensive seed script to populate all modular HRMS data for Metapharsic ERP.
 * Run from: c:\ERP_3152026\server  =>  node seeds/seed-hrms.js
 */

const db = require('../db');

async function seedHRMS() {
  console.log('🚀 Starting Comprehensive HRMS Database Seeding...');
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // ─── CLEAN OLD HRMS DATA ────────────────────────────────────────────────
    console.log('  🧹 Cleaning old HRMS table data...');
    await client.query('UPDATE employees SET employee_code = NULL');
    await client.query('DELETE FROM hr_employee_timeline');
    await client.query('DELETE FROM hr_employee_documents');
    await client.query('DELETE FROM hr_leaves');
    await client.query('DELETE FROM hr_leave_balances');
    await client.query('DELETE FROM hr_attendance');
    await client.query('DELETE FROM hr_candidates');
    await client.query('DELETE FROM hr_job_requisitions');
    await client.query('DELETE FROM salary_slips');
    await client.query('DELETE FROM hr_pf_registers');
    await client.query('DELETE FROM hr_esic_registers');
    await client.query('DELETE FROM hr_pt_registers');
    await client.query('DELETE FROM hr_incidents');
    await client.query('DELETE FROM hr_designations');
    await client.query('DELETE FROM hr_departments');
    await client.query('DELETE FROM hr_salary_structures');

    // ─── 1. DEPARTMENTS ──────────────────────────────────────────────────────
    console.log('  🏢 Seeding Departments...');
    const depts = [
      { name: 'Executive Board', code: 'EXE', desc: 'Apex Decision Making Body of Metapharsic Lifesciences', parent_id: null },
      { name: 'Human Resources', code: 'HRD', desc: 'Talent Acquisition, Employee Relations & Compliance', parent_id: 'Executive Board' },
      { name: 'Engineering & R&D', code: 'ENG', desc: 'Pharmaceutical Formulations, AI Systems & Software development', parent_id: 'Executive Board' },
      { name: 'Sales & Marketing', code: 'MKT', desc: 'Domestic Wholesale Distribution & International Marketing', parent_id: 'Executive Board' },
      { name: 'Finance & Accounts', code: 'FIN', desc: 'Financial Planning, Accounts, Taxation & Auditing', parent_id: 'Executive Board' },
      { name: 'Quality Assurance', code: 'QAC', desc: 'Quality Audits, Compliance Logs & Lab Standards', parent_id: 'Executive Board' }
    ];

    const deptMap = {};
    for (const d of depts) {
      let parentUuid = null;
      if (d.parent_id) {
        parentUuid = deptMap[d.parent_id];
      }
      const res = await client.query(
        `INSERT INTO hr_departments (id, company_id, name, code, description, parent_dept_id, created_at)
         VALUES (uuid_generate_v4(), 1, $1, $2, $3, $4, NOW()) RETURNING id`,
        [d.name, d.code, d.desc, parentUuid]
      );
      deptMap[d.name] = res.rows[0].id;
    }

    // ─── 2. DESIGNATIONS ─────────────────────────────────────────────────────
    console.log('  🏷️ Seeding Designations...');
    const desigs = [
      { name: 'Managing Director', code: 'MD', dept: 'Executive Board', grade: 'L5' },
      { name: 'HR Manager', code: 'HRM', dept: 'Human Resources', grade: 'L4' },
      { name: 'HR Associate', code: 'HRA', dept: 'Human Resources', grade: 'L2' },
      { name: 'Technical Director', code: 'TD', dept: 'Engineering & R&D', grade: 'L5' },
      { name: 'Senior Software Engineer', code: 'SSE', dept: 'Engineering & R&D', grade: 'L3' },
      { name: 'Research Associate', code: 'RA', dept: 'Engineering & R&D', grade: 'L2' },
      { name: 'National Sales Manager', code: 'NSM', dept: 'Sales & Marketing', grade: 'L4' },
      { name: 'Sales Lead', code: 'SL', dept: 'Sales & Marketing', grade: 'L3' },
      { name: 'Senior Accountant', code: 'SA', dept: 'Finance & Accounts', grade: 'L3' },
      { name: 'Finance Analyst', code: 'FA', dept: 'Finance & Accounts', grade: 'L2' },
      { name: 'QA Manager', code: 'QAM', dept: 'Quality Assurance', grade: 'L4' },
      { name: 'QA Inspector', code: 'QAI', dept: 'Quality Assurance', grade: 'L2' }
    ];

    const desigMap = {};
    for (const dg of desigs) {
      const deptUuid = deptMap[dg.dept];
      const res = await client.query(
        `INSERT INTO hr_designations (id, company_id, name, grade, department_id, created_at)
         VALUES (uuid_generate_v4(), 1, $1, $2, $3, NOW()) RETURNING id`,
        [dg.name, dg.grade, deptUuid]
      );
      desigMap[dg.name] = res.rows[0].id;
    }

    // ─── 3. SALARY STRUCTURES ────────────────────────────────────────────────
    console.log('  💰 Seeding Salary Structures...');
    const salaryStructures = [
      { name: 'Executive Level A', basic: 50, hra: 20, da: 10, sa: 20, grade: 'L5' },
      { name: 'Professional Level B', basic: 45, hra: 20, da: 10, sa: 25, grade: 'L3' },
      { name: 'Standard Staff C', basic: 40, hra: 20, da: 10, sa: 30, grade: 'L2' }
    ];

    const salStructMap = {};
    for (const ss of salaryStructures) {
      const res = await client.query(
        `INSERT INTO hr_salary_structures (id, company_id, name, basic_pct, hra_pct, da_pct, special_allowance, grade, created_at)
         VALUES (uuid_generate_v4(), 1, $1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
        [ss.name, ss.basic, ss.hra, ss.da, ss.sa, ss.grade]
      );
      salStructMap[ss.name] = res.rows[0].id;
    }

    // ─── 4. LINK EMPLOYEES TO DEPTS & DESIGNATIONS ───────────────────────────
    console.log('  🔗 Mapping Employees to Departments & Designations...');
    
    // Fetch all active employees from the seed script
    const empRes = await client.query('SELECT id, name FROM employees');
    const employees = empRes.rows;

    const mappings = {
      'Rajesh Kumar':     { dept: 'Executive Board',      desig: 'Managing Director',        grade: 'L5', loc: 'Pune',      ss: 'Executive Level A' },
      'Priya Sharma':     { dept: 'Sales & Marketing',    desig: 'Sales Lead',               grade: 'L3', loc: 'Pune',      ss: 'Professional Level B' },
      'Vikram Nair':      { dept: 'Engineering & R&D',    desig: 'Technical Director',       grade: 'L5', loc: 'Mumbai',    ss: 'Executive Level A' },
      'Anita Patel':      { dept: 'Human Resources',      desig: 'HR Manager',               grade: 'L4', loc: 'Ahmedabad', ss: 'Executive Level A' },
      'Suresh Iyer':      { dept: 'Quality Assurance',    desig: 'QA Manager',               grade: 'L4', loc: 'Chennai',   ss: 'Executive Level A' },
      'Meena Krishnan':   { dept: 'Engineering & R&D',    desig: 'Senior Software Engineer', grade: 'L3', loc: 'Bengaluru', ss: 'Professional Level B' },
      'Arjun Desai':      { dept: 'Human Resources',      desig: 'HR Associate',             grade: 'L2', loc: 'Pune',      ss: 'Standard Staff C' },
      'Kavita Mehta':     { dept: 'Finance & Accounts',   desig: 'Senior Accountant',        grade: 'L3', loc: 'Delhi',     ss: 'Professional Level B', join_date: '2026-05-22' },
      'Amit Patel':       { dept: 'Finance & Accounts',   desig: 'Finance Analyst',          grade: 'L2', loc: 'Mumbai',    ss: 'Standard Staff C',     join_date: '2026-05-21T18:30:00.000Z' },
      'Ravi Shankar':     { dept: 'Sales & Marketing',    desig: 'Sales Lead',               grade: 'L3', loc: 'Hyderabad', ss: 'Professional Level B', join_date: '2026-05-22' },
      'Deepa Nambiar':    { dept: 'Quality Assurance',    desig: 'QA Inspector',             grade: 'L2', loc: 'Kochi',     ss: 'Standard Staff C' },
    };

    let reportingManagerId = null;
    const rajeshNode = employees.find(e => e.name === 'Rajesh Kumar');
    if (rajeshNode) reportingManagerId = rajeshNode.id;
    
    // Assign all other employees
    const remainingDepts = ['Engineering & R&D', 'Sales & Marketing', 'Finance & Accounts', 'Quality Assurance'];
    const remainingDesigs = ['Research Associate', 'Sales Lead', 'Finance Analyst', 'QA Inspector'];

    for (let i = 0; i < employees.length; i++) {
      const e = employees[i];
      let map = mappings[e.name];
      
      if (!map) {
        // Assign random parameters for generic seeds
        const rIdx = i % remainingDepts.length;
        map = {
          dept: remainingDepts[rIdx],
          desig: remainingDesigs[rIdx],
          grade: 'L2',
          loc: 'Pune',
          ss: 'Standard Staff C'
        };
      }

      const empCode = `EMP-${String(i + 1).padStart(4, '0')}`;

      if (e.name === 'Rajesh Kumar') {
        const rMap = mappings['Rajesh Kumar'];
        await client.query(
          `UPDATE employees SET employee_code=$1, department_id=$2, designation_id=$3, grade=$4, work_location=$5, salary_structure_id=$6, employment_type='Permanent', join_date=$7 WHERE id=$8`,
          [empCode, deptMap[rMap.dept], desigMap[rMap.desig], rMap.grade, rMap.loc, salStructMap[rMap.ss], rMap.join_date || '2026-05-22', e.id]
        );
      } else {
        await client.query(
          `UPDATE employees SET employee_code=$1, department_id=$2, designation_id=$3, grade=$4, work_location=$5, salary_structure_id=$6, reporting_manager_id=$7, employment_type='Permanent', join_date=$8 WHERE id=$9`,
          [empCode, deptMap[map.dept], desigMap[map.desig], map.grade, map.loc, salStructMap[map.ss], reportingManagerId, map.join_date || '2026-05-22', e.id]
        );
      }
    }

    // ─── 5. PROVISION LEAVE BALANCES ──────────────────────────────────────────
    console.log('  🌴 Seeding Leave Balances...');
    const leaveTypes = ['Casual', 'Sick', 'Earned', 'Maternity', 'Paternity'];
    
    for (const e of employees) {
      for (const lt of leaveTypes) {
        let allocated = 12;
        if (lt === 'Sick') allocated = 10;
        if (lt === 'Earned') allocated = 18;
        if (lt === 'Maternity') allocated = 0; // only allocated as needed
        if (lt === 'Paternity') allocated = 0;

        await client.query(
          `INSERT INTO hr_leave_balances (id, company_id, employee_id, year, leave_type, allocated, used, carried_forward, pending_approval, encashed, lapsed, updated_at)
           VALUES (uuid_generate_v4(), 1, $1, 2026, $2, $3, 0, 0, 0, 0, 0, NOW())`,
          [e.id, lt, allocated]
        );
      }
    }

    // ─── 6. SEED ATTENDANCE RECORDS (Past 15 days of May 2026) ────────────────
    console.log('  📅 Seeding Attendance Records...');
    const startDate = new Date('2026-05-01');
    const endDate = new Date('2026-05-15');

    for (const e of employees) {
      let cur = new Date(startDate);
      while (cur <= endDate) {
        const dateStr = cur.toISOString().slice(0, 10);
        const dayOfWeek = cur.getDay(); // 0 is Sunday, 6 is Saturday

        let status = 'Present';
        let clockIn = null;
        let clockOut = null;
        
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          status = 'Holiday';
        } else {
          // 10% chance of being absent or on WFH
          const rand = Math.random();
          if (rand < 0.05) {
            status = 'Absent';
          } else if (rand < 0.15) {
            status = 'WFH';
            clockIn = `${dateStr} 09:15:00`;
            clockOut = `${dateStr} 18:05:00`;
          } else {
            clockIn = `${dateStr} 08:55:00`;
            clockOut = `${dateStr} 18:02:00`;
          }
        }

        await client.query(
          `INSERT INTO hr_attendance (id, company_id, employee_id, date, status, clock_in, clock_out, device_id, work_from_home)
           VALUES (uuid_generate_v4(), 1, $1, $2, $3, $4, $5, 'BIOMETRIC_MAIN', $6)`,
          [e.id, dateStr, status, clockIn, clockOut, status === 'WFH']
        );

        cur.setDate(cur.getDate() + 1);
      }
    }

    // ─── 7. LEAVE REQUESTS ───────────────────────────────────────────────────
    console.log('  ✈️ Seeding Leave Requests...');
    const leaveRequests = [
      { emp: 'Priya Sharma', type: 'Casual', start: '2026-06-10', end: '2026-06-11', days: 2, reason: 'Family trip', status: 'Pending' },
      { emp: 'Meena Krishnan', type: 'Sick', start: '2026-05-04', end: '2026-05-05', days: 2, reason: 'Severe fever', status: 'Approved' },
      { emp: 'Vikram Nair', type: 'Earned', start: '2026-06-25', end: '2026-06-30', days: 5, reason: 'Personal work', status: 'Pending' }
    ];

    for (const lr of leaveRequests) {
      const emp = employees.find(x => x.name === lr.emp);
      if (emp) {
        await client.query(
          `INSERT INTO hr_leaves (id, company_id, employee_id, leave_type, start_date, end_date, days, reason, status, created_at)
           VALUES (uuid_generate_v4(), 1, $1, $2, $3, $4, $5, $6, $7, NOW())`,
          [emp.id, lr.type, lr.start, lr.end, lr.days, lr.reason, lr.status]
        );
        
        // Update balance if approved
        if (lr.status === 'Approved') {
          await client.query(
            `UPDATE hr_leave_balances SET used = used + $1 WHERE employee_id=$2 AND leave_type=$3`,
            [lr.days, emp.id, lr.type]
          );
        } else if (lr.status === 'Pending') {
          await client.query(
            `UPDATE hr_leave_balances SET pending_approval = pending_approval + $1 WHERE employee_id=$2 AND leave_type=$3`,
            [lr.days, emp.id, lr.type]
          );
        }
      }
    }

    // ─── 8. ATS JOB REQUISITIONS ─────────────────────────────────────────────
    console.log('  💼 Seeding ATS Requisitions...');
    const requisitions = [
      { title: 'Senior React & Node Engineer', dept: 'Engineering & R&D', desig: 'Senior Software Engineer', pos: 2, desc: 'Responsible for leading development of our unified agentic ERP system.' },
      { title: 'HR Recruiter Specialist', dept: 'Human Resources', desig: 'HR Associate', pos: 1, desc: 'Focus on hiring key clinical researchers and engineering personnel.' },
      { title: 'QA Compliance Officer', dept: 'Quality Assurance', desig: 'QA Inspector', pos: 3, desc: 'Handle compliance audit registers and lab batch verification testing.' }
    ];

    const reqMap = {};
    for (const r of requisitions) {
      const res = await client.query(
        `INSERT INTO hr_job_requisitions (id, company_id, title, department_id, designation_id, positions, filled_count, description, target_date, status, raised_by, created_at)
         VALUES (uuid_generate_v4(), 1, $1, $2, $3, $4, 0, $5, '2026-09-01', 'Approved', $6, NOW()) RETURNING id`,
        [r.title, deptMap[r.dept], desigMap[r.desig], r.pos, r.desc, '11111111-1111-1111-1111-111111111111']
      );
      reqMap[r.title] = res.rows[0].id;
    }

    // ─── 9. ATS CANDIDATES ───────────────────────────────────────────────────
    console.log('  👥 Seeding Candidates...');
    const candidates = [
      { name: 'Anjali Nair', email: 'anjali.nair@talent.com', phone: '9988776655', req: 'Senior React & Node Engineer', skills: ['React', 'NodeJS', 'TypeScript'], stage: 'Offer', score: 88 },
      { name: 'Amit Sharma', email: 'amit.sharma99@gmail.com', phone: '9988776656', req: 'Senior React & Node Engineer', skills: ['React', 'CSS', 'Vite'], stage: 'Screened', score: 72 },
      { name: 'Sneha Reddy', email: 'sneha.reddy@careers.com', phone: '9988776657', req: 'HR Recruiter Specialist', skills: ['Recruiting', 'Payroll', 'Sourcing'], stage: 'Sourced', score: 65 },
      { name: 'Rohan Deshmukh', email: 'rohan.desh@gmail.com', phone: '9988776658', req: 'QA Compliance Officer', skills: ['QA Testing', 'Lab Standards', 'Audit'], stage: 'Hired', score: 94 }
    ];

    for (const c of candidates) {
      await client.query(
        `INSERT INTO hr_candidates (id, company_id, name, email, phone, role_applied, experience_years, skills, source, status, ai_score, requisition_id, created_at)
         VALUES (uuid_generate_v4(), 1, $1, $2, $3, $4, 4, $5, 'LinkedIN', $6, $7, $8, NOW())`,
        [c.name, c.email, c.phone, c.req, JSON.stringify(c.skills), c.stage, c.score, reqMap[c.req]]
      );
    }

    // ─── 10. SALARY SLIPS May 2026 ───────────────────────────────────────────
    console.log('  💸 Seeding Salary Slips...');
    for (const e of employees) {
      const basic = 30000;
      const hra = 12000;
      const da = 6000;
      const sa = 5000;
      const gross = basic + hra + da + sa;
      const pf = 3600;
      const esic = 450;
      const pt = 200;
      const ded = pf + esic + pt;
      const net = gross - ded;

      const slipId = 'SLIP-' + Math.floor(Math.random() * 90000 + 10000);
      await client.query(
        `INSERT INTO salary_slips (id, company_id, employee_id, month, year, basic_salary, hra, da, special_allowance, gross_salary, pf_employee, esic_employer, pt_amount, total_deductions, net_pay, status, created_at)
         VALUES (uuid_generate_v4(), 1, $1, 'May', 2026, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Processed', NOW())`,
        [e.id, basic, hra, da, sa, gross, pf, esic, pt, ded, net]
      );

      // PF, ESIC & PT registries
      await client.query(
        `INSERT INTO hr_pf_registers (id, company_id, employee_id, month, year, wages, ee_epf_contribution, er_epf_contribution, er_eps_contribution, created_at)
         VALUES (uuid_generate_v4(), 1, $1, 'May', 2026, $2, $3, $3, 0, NOW())`,
        [e.id, basic, pf]
      );
      await client.query(
        `INSERT INTO hr_esic_registers (id, company_id, employee_id, month, year, gross_wages, ee_contribution, er_contribution, created_at)
         VALUES (uuid_generate_v4(), 1, $1, 'May', 2026, $2, $3, 1000, NOW())`,
        [e.id, basic, esic]
      );
      await client.query(
        `INSERT INTO hr_pt_registers (id, company_id, employee_id, month, year, gross_salary, pt_amount, created_at)
         VALUES (uuid_generate_v4(), 1, $1, 'May', 2026, $2, $3, NOW())`,
        [e.id, gross, pt]
      );
    }

    // ─── 11. COMPLIANCE INCIDENTS ────────────────────────────────────────────
    console.log('  🚨 Seeding Compliance Incidents...');
    const incidents = [
      { type: 'Safety Violations', desc: 'Cold storage unit alarm malfunctioned; temperature exceeded threshold for 15 minutes before backup triggered.', severity: 'High', status: 'Resolved' },
      { type: 'Policy Non-compliance', desc: 'Audit log showed bulk export of customer database performed without 2FA verification from unauthorized IP.', severity: 'Critical', status: 'Under Investigation' }
    ];

    for (const inc of incidents) {
      await client.query(
        `INSERT INTO hr_incidents (id, company_id, reported_by, involved_employee_id, incident_type, description, severity, status, created_at)
         VALUES (uuid_generate_v4(), 1, '11111111-1111-1111-1111-111111111111', $1, $2, $3, $4, $5, NOW())`,
        [reportingManagerId, inc.type, inc.desc, inc.severity, inc.status]
      );
    }

    await client.query('COMMIT');
    console.log('\n🎉 HRMS Seeding Completed Successfully! All database tables fully mapped.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ HRMS Seeding Failed:', err.message);
  } finally {
    client.release();
  }
}

seedHRMS().then(() => process.exit(0));
