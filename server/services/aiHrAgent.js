/**
 * server/services/aiHrAgent.js
 * AI service for HRMS — mirrors aiCrmAgent/aiOmsAgent pattern.
 * Gemini-1.5-flash with deterministic heuristic fallback on every function.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const num = (v, d = 0) => (isNaN(parseFloat(v)) ? d : parseFloat(v));

function parseJson(text) {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
}

async function gemini(prompt) {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    return (await result.response).text();
}

// ============================================
// 1. ATS: RESUME SCREENING
// ============================================
async function screenResume(candidate, jobDescription = '') {
    const heuristic = () => {
        const skills = Array.isArray(candidate.skills) ? candidate.skills : [];
        const jdLower = jobDescription.toLowerCase();
        const matchCount = skills.filter(s => jdLower.includes(s.toLowerCase())).length;
        const fitScore = Math.min(Math.round((matchCount / Math.max(skills.length, 1)) * 100), 100);
        const expMatch = num(candidate.experience_years) >= (num(candidate.min_experience) || 0);
        const base = fitScore + (expMatch ? 15 : 0);
        const finalScore = Math.min(base, 100);
        return {
            fitScore: finalScore,
            strengths: skills.slice(0, 3).map(s => `Skilled in ${s}`),
            gaps: finalScore < 60 ? ['Limited matching skills for this role'] : [],
            recommendation: finalScore >= 70 ? 'Shortlist' : finalScore >= 45 ? 'Hold' : 'Reject',
            reason: `Heuristic: ${matchCount}/${skills.length} JD skills matched; experience ${expMatch ? 'meets' : 'below'} requirement.`,
        };
    };
    if (!genAI) return heuristic();
    try {
        const text = await gemini(`
You are a pharma HR recruiter. Screen this candidate against the job description.
Candidate: ${JSON.stringify(candidate)}
JD: ${jobDescription}
Return ONLY valid JSON: {"fitScore":number,"strengths":["string"],"gaps":["string"],"recommendation":"Shortlist|Hold|Reject","reason":"string"}`);
        const parsed = parseJson(text);
        return { fitScore: Math.min(Math.max(Math.round(num(parsed.fitScore)), 0), 100), ...parsed };
    } catch (e) {
        logger.error('AI screenResume error', { error: e.message });
        return heuristic();
    }
}

async function suggestInterviewQuestions(candidate, role = '') {
    const heuristic = () => ({
        technical: [`Describe your experience with ${role}.`, 'How do you handle tight deadlines?', 'What metrics did you own in your last role?'],
        behavioral: ['Tell me about a time you resolved a conflict.', 'Describe your biggest achievement.'],
        situational: ['If a distributor complains about supply delays, how would you handle it?'],
    });
    if (!genAI) return heuristic();
    try {
        const text = await gemini(`
Suggest interview questions for a ${role} candidate in a pharma company.
Candidate background: ${JSON.stringify({ name: candidate.name, experience: candidate.experience_years, skills: candidate.skills })}
Return ONLY valid JSON: {"technical":["string"],"behavioral":["string"],"situational":["string"]}`);
        return parseJson(text);
    } catch (e) {
        logger.error('AI interview questions error', { error: e.message });
        return heuristic();
    }
}

// ============================================
// 2. ONBOARDING PLAN
// ============================================
async function generateOnboardingPlan(employee, department = '', role = '') {
    const heuristic = () => ({
        tasks: [
            { name: 'Welcome session with HR', category: 'Orientation', dueDay: 1 },
            { name: 'System access setup', category: 'IT Setup', dueDay: 1 },
            { name: 'Meet team members', category: 'Orientation', dueDay: 2 },
            { name: 'Role briefing with manager', category: 'Training', dueDay: 3 },
            { name: 'Product & portfolio training', category: 'Training', dueDay: 7 },
            { name: '30-day check-in', category: 'Review', dueDay: 30 },
        ],
        timeline: '30-day standard onboarding',
        buddyRecommendation: 'Assign a senior team member from the same department',
        riskFlags: employee.employment_type === 'Contract' ? ['Contract employee — ensure NDA signed on Day 1'] : [],
    });
    if (!genAI) return heuristic();
    try {
        const text = await gemini(`
Design an onboarding plan for a new ${role} employee in ${department} department at a pharma company.
Employee: ${JSON.stringify({ name: employee.name, employment_type: employee.employment_type, grade: employee.grade })}
Return ONLY valid JSON: {"tasks":[{"name":"string","category":"string","dueDay":number}],"timeline":"string","buddyRecommendation":"string","riskFlags":["string"]}`);
        return parseJson(text);
    } catch (e) {
        logger.error('AI onboarding plan error', { error: e.message });
        return heuristic();
    }
}

// ============================================
// 3. ATTRITION PREDICTION
// ============================================
async function predictAttrition(employees, attendancePatterns = [], salaryData = []) {
    const heuristic = () => {
        const salMap = {};
        salaryData.forEach(s => { salMap[s.employee_id] = s; });
        const attMap = {};
        attendancePatterns.forEach(a => { attMap[a.employee_id] = a; });

        const atRisk = employees.map(emp => {
            let score = 20;
            const reasons = [];
            const att = attMap[emp.id] || {};
            const sal = salMap[emp.id] || {};

            // Late/absent signals
            if (num(att.late_days) > 5) { score += 20; reasons.push('High late arrivals'); }
            if (num(att.absent_days) > 3) { score += 15; reasons.push('Frequent absences'); }

            // Tenure
            if (emp.join_date) {
                const tenureMonths = (Date.now() - new Date(emp.join_date)) / (1000 * 60 * 60 * 24 * 30);
                if (tenureMonths > 18 && tenureMonths < 30) { score += 10; reasons.push('Typical mid-tenure attrition window'); }
            }

            // Salary below structure
            if (num(sal.current_salary) < num(sal.min_salary) * 0.9) { score += 15; reasons.push('Salary below grade minimum'); }

            return { id: emp.id, name: emp.name, department: emp.department_name, riskScore: Math.min(score, 100), reasons };
        });

        const high = atRisk.filter(e => e.riskScore >= 60);
        return {
            atRiskEmployees: high,
            departmentRisk: {},
            recommendedActions: [
                high.length > 0 ? `${high.length} employee(s) at high attrition risk — schedule 1-on-1s.` : 'Attrition risk is low.',
                'Review salary bands for employees below grade minimum.',
                'Monitor attendance patterns monthly.',
            ],
        };
    };
    if (!genAI) return heuristic();
    try {
        const text = await gemini(`
Analyze attrition risk for these employees in a pharma company.
Employees: ${JSON.stringify(employees.slice(0, 30))}
Attendance signals: ${JSON.stringify(attendancePatterns.slice(0, 30))}
Return ONLY valid JSON: {"atRiskEmployees":[{"id":"uuid","name":"string","department":"string","riskScore":number,"reasons":["string"]}],"departmentRisk":{},"recommendedActions":["string"]}`);
        return parseJson(text);
    } catch (e) {
        logger.error('AI attrition prediction error', { error: e.message });
        return heuristic();
    }
}

// ============================================
// 4. FLIGHT RISK ASSESSMENT
// ============================================
async function assessFlightRisk(employee, performanceHistory = []) {
    const heuristic = () => {
        let risk = 30;
        const levers = [];
        if (performanceHistory.length > 0) {
            const avgPerf = performanceHistory.reduce((s, p) => s + num(p.achievement_pct), 0) / performanceHistory.length;
            if (avgPerf < 75) { risk += 25; levers.push('Performance coaching & clear goal-setting'); }
            if (avgPerf > 110) { risk -= 10; levers.push('Recognition & growth opportunity to retain top performer'); }
        }
        return {
            flightRiskScore: Math.max(Math.min(risk, 100), 0),
            timeHorizon: risk > 60 ? '0-3 months' : risk > 40 ? '3-6 months' : '12+ months',
            retentionLevers: levers.length ? levers : ['Regular feedback sessions', 'Ensure market-aligned compensation'],
        };
    };
    if (!genAI) return heuristic();
    try {
        const text = await gemini(`
Assess flight risk for this employee.
Employee: ${JSON.stringify({ name: employee.name, grade: employee.grade, tenure_months: employee.tenure_months })}
Performance: ${JSON.stringify(performanceHistory)}
Return ONLY valid JSON: {"flightRiskScore":number,"timeHorizon":"string","retentionLevers":["string"]}`);
        return parseJson(text);
    } catch (e) {
        logger.error('AI flight risk error', { error: e.message });
        return heuristic();
    }
}

// ============================================
// 5. PROMOTION READINESS
// ============================================
async function identifyPromotionReadiness(employee, performanceHistory = [], designationLadder = []) {
    const heuristic = () => {
        const avgPerf = performanceHistory.length
            ? performanceHistory.reduce((s, p) => s + num(p.achievement_pct), 0) / performanceHistory.length
            : 0;
        const ready = avgPerf >= 105;
        return {
            ready,
            readinessScore: Math.min(Math.round(avgPerf), 100),
            gaps: ready ? [] : ['Sustained 105%+ target achievement required', 'Minimum 18 months in current grade'],
            developmentPlan: ready
                ? ['Assign stretch project', 'Leadership training', 'Prepare for promotion review']
                : ['Monthly performance coaching', 'Skill gap training plan'],
        };
    };
    if (!genAI) return heuristic();
    try {
        const text = await gemini(`
Assess promotion readiness for this pharma employee.
Employee: ${JSON.stringify({ name: employee.name, grade: employee.grade, designation: employee.designation_name })}
Performance: ${JSON.stringify(performanceHistory)}
Next designations: ${JSON.stringify(designationLadder)}
Return ONLY valid JSON: {"ready":boolean,"readinessScore":number,"gaps":["string"],"developmentPlan":["string"]}`);
        return parseJson(text);
    } catch (e) {
        logger.error('AI promotion readiness error', { error: e.message });
        return heuristic();
    }
}

// ============================================
// 6. WEEKLY HR BRIEFING
// ============================================
async function generateWeeklyHRBriefing(stats, incidents = [], attritionAlerts = []) {
    const heuristic = () => ({
        executiveSummary: `Heuristic: ${stats.total_employees || 0} employees, ${stats.pending_leaves || 0} pending leave requests, ${stats.pending_payroll || 0} payrolls to process, ${incidents.length} open incidents.`,
        priorityActions: [
            stats.pending_leaves > 0 ? `Clear ${stats.pending_leaves} pending leave approval(s).` : 'No pending leave approvals.',
            stats.pending_payroll > 0 ? `Process payroll for ${stats.pending_payroll} employee(s).` : 'Payroll is up to date.',
            attritionAlerts.length > 0 ? `${attritionAlerts.length} employee(s) flagged for attrition risk.` : 'No attrition alerts.',
        ],
        riskFlags: attritionAlerts.map(a => `${a.name} — risk score ${a.riskScore}`),
        celebrations: stats.new_joiners > 0 ? [`Welcome ${stats.new_joiners} new joiner(s) this week!`] : [],
    });
    if (!genAI) return heuristic();
    try {
        const text = await gemini(`
Generate a weekly HR executive briefing for a pharma company.
Stats: ${JSON.stringify(stats)}
Open incidents: ${JSON.stringify(incidents.slice(0, 5))}
Attrition alerts: ${JSON.stringify(attritionAlerts.slice(0, 5))}
Return ONLY valid JSON: {"executiveSummary":"string","priorityActions":["string"],"riskFlags":["string"],"celebrations":["string"]}`);
        return parseJson(text);
    } catch (e) {
        logger.error('AI HR briefing error', { error: e.message });
        return heuristic();
    }
}

// ============================================
// 7. AI COPILOT (Employee Query Handler)
// ============================================
async function handleCopilotQuery(query, context = {}) {
    // NEVER include sensitive data (bank, PAN, Aadhaar) in copilot responses
    const safeSanitize = (obj) => {
        if (!obj) return obj;
        const { bank_account_encrypted, pan, aadhar_last4, ...safe } = obj;
        return safe;
    };

    const heuristic = () => {
        const q = query.toLowerCase();
        if (q.includes('leave balance') || q.includes('leave remaining')) {
            return { answer: context.leave_balance ? `Your current leave balance: ${JSON.stringify(context.leave_balance)}` : 'Please check the Leave tab for your current balance.', intent: 'leave_balance' };
        }
        if (q.includes('payslip') || q.includes('salary slip') || q.includes('last month salary')) {
            return { answer: 'You can download your latest payslip from the Payroll tab.', intent: 'payslip' };
        }
        if (q.includes('holiday') || q.includes('public holiday')) {
            return { answer: 'The holiday calendar is available in the Leave > Holiday Calendar tab.', intent: 'holiday_calendar' };
        }
        if (q.includes('policy') || q.includes('handbook')) {
            return { answer: 'HR policies are available in the Documents tab. Please acknowledge them if not already done.', intent: 'policy' };
        }
        return { answer: 'I can help with leave balances, payslips, policies, and holidays. Please contact HR for complex queries.', intent: 'general' };
    };

    if (!genAI) return heuristic();
    try {
        const text = await gemini(`
You are a helpful HR assistant for a pharma company. Answer the employee query strictly based on the context provided.
IMPORTANT: NEVER reveal bank account numbers, PAN numbers, or Aadhaar numbers in any response.
Employee Context: ${JSON.stringify(safeSanitize(context))}
Query: ${query}
Return ONLY valid JSON: {"answer":"string","intent":"string","requiresHumanEscalation":boolean}`);
        return parseJson(text);
    } catch (e) {
        logger.error('AI copilot error', { error: e.message });
        return heuristic();
    }
}

module.exports = {
    screenResume,
    suggestInterviewQuestions,
    generateOnboardingPlan,
    predictAttrition,
    assessFlightRisk,
    identifyPromotionReadiness,
    generateWeeklyHRBriefing,
    handleCopilotQuery,
};
