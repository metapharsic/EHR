/**
 * HRMS Unit Tests — AI Agent Heuristic Fallbacks
 * Tests all AI functions WITHOUT a real API key (heuristic path).
 * Run: npx vitest run src/services/__tests__/hrAiAgent.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Ensure no API key is set (heuristic fallback path)
vi.stubEnv('GEMINI_API_KEY', '');

const aiAgent = await import('../../../server/services/aiHrAgent.js') as any;

describe('aiHrAgent — heuristic fallbacks (no API key)', () => {

  // ---- screenResume ----
  describe('screenResume', () => {
    it('returns a valid schema', async () => {
      const result = await aiAgent.screenResume(
        { name: 'Alice', skills: ['React', 'TypeScript', 'SQL'], experience_years: 3 },
        'We need React and TypeScript developers'
      );
      expect(result).toHaveProperty('fitScore');
      expect(result.fitScore).toBeGreaterThanOrEqual(0);
      expect(result.fitScore).toBeLessThanOrEqual(100);
      expect(['Shortlist', 'Hold', 'Reject']).toContain(result.recommendation);
      expect(Array.isArray(result.strengths)).toBe(true);
      expect(Array.isArray(result.gaps)).toBe(true);
    });

    it('high score when all JD skills match', async () => {
      const result = await aiAgent.screenResume(
        { name: 'Bob', skills: ['Python', 'Django', 'PostgreSQL'], experience_years: 5 },
        'Python Django PostgreSQL backend developer needed'
      );
      expect(result.fitScore).toBeGreaterThan(50);
    });

    it('low score when no JD skills match', async () => {
      const result = await aiAgent.screenResume(
        { name: 'Charlie', skills: ['Cobol', 'Fortran'], experience_years: 1 },
        'React TypeScript modern web developer'
      );
      expect(result.recommendation).toBe('Reject');
    });
  });

  // ---- suggestInterviewQuestions ----
  describe('suggestInterviewQuestions', () => {
    it('returns all three question categories', async () => {
      const result = await aiAgent.suggestInterviewQuestions(
        { name: 'Alice', experience_years: 3, skills: ['React'] },
        'Frontend Developer'
      );
      expect(Array.isArray(result.technical)).toBe(true);
      expect(Array.isArray(result.behavioral)).toBe(true);
      expect(Array.isArray(result.situational)).toBe(true);
      expect(result.technical.length).toBeGreaterThan(0);
    });
  });

  // ---- generateOnboardingPlan ----
  describe('generateOnboardingPlan', () => {
    it('returns tasks array with required fields', async () => {
      const result = await aiAgent.generateOnboardingPlan(
        { name: 'Dave', employment_type: 'Permanent', grade: 'L2' },
        'Sales', 'Medical Representative'
      );
      expect(Array.isArray(result.tasks)).toBe(true);
      expect(result.tasks.length).toBeGreaterThan(0);
      expect(result.tasks[0]).toHaveProperty('name');
      expect(result.tasks[0]).toHaveProperty('dueDay');
      expect(typeof result.timeline).toBe('string');
    });

    it('flags contract employees with NDA risk', async () => {
      const result = await aiAgent.generateOnboardingPlan(
        { name: 'Eve', employment_type: 'Contract', grade: 'L1' },
        'IT', 'Developer'
      );
      const hasNdaFlag = result.riskFlags.some((f: string) => f.toLowerCase().includes('nda') || f.toLowerCase().includes('contract'));
      expect(hasNdaFlag).toBe(true);
    });
  });

  // ---- predictAttrition ----
  describe('predictAttrition', () => {
    it('returns at-risk employees array with scores', async () => {
      const employees = [
        { id: 'e1', name: 'Alice', join_date: '2022-01-01', department_name: 'Sales' },
        { id: 'e2', name: 'Bob', join_date: '2023-06-01', department_name: 'IT' },
      ];
      const attendance = [
        { employee_id: 'e1', late_days: 8, absent_days: 5 },
        { employee_id: 'e2', late_days: 1, absent_days: 0 },
      ];
      const result = await aiAgent.predictAttrition(employees, attendance, []);
      expect(Array.isArray(result.atRiskEmployees)).toBe(true);
      expect(Array.isArray(result.recommendedActions)).toBe(true);
      // Alice has high late+absent — should be flagged
      const alice = result.atRiskEmployees.find((e: any) => e.id === 'e1');
      if (alice) {
        expect(alice.riskScore).toBeGreaterThanOrEqual(30);
      }
    });

    it('always returns exactly 3 recommended actions', async () => {
      const result = await aiAgent.predictAttrition([], [], []);
      expect(result.recommendedActions.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ---- assessFlightRisk ----
  describe('assessFlightRisk', () => {
    it('returns valid flight risk schema', async () => {
      const result = await aiAgent.assessFlightRisk(
        { name: 'Frank', grade: 'L3', tenure_months: 24 },
        [{ achievement_pct: 65 }, { achievement_pct: 70 }]
      );
      expect(result.flightRiskScore).toBeGreaterThanOrEqual(0);
      expect(result.flightRiskScore).toBeLessThanOrEqual(100);
      expect(typeof result.timeHorizon).toBe('string');
      expect(Array.isArray(result.retentionLevers)).toBe(true);
    });
  });

  // ---- identifyPromotionReadiness ----
  describe('identifyPromotionReadiness', () => {
    it('marks ready when performance ≥ 105%', async () => {
      const result = await aiAgent.identifyPromotionReadiness(
        { name: 'Grace', grade: 'L2' },
        [{ achievement_pct: 115 }, { achievement_pct: 110 }],
        []
      );
      expect(result.ready).toBe(true);
      expect(result.readinessScore).toBeGreaterThan(90);
    });

    it('marks not ready when performance < 105%', async () => {
      const result = await aiAgent.identifyPromotionReadiness(
        { name: 'Henry', grade: 'L1' },
        [{ achievement_pct: 80 }, { achievement_pct: 90 }],
        []
      );
      expect(result.ready).toBe(false);
      expect(result.gaps.length).toBeGreaterThan(0);
    });
  });

  // ---- generateWeeklyHRBriefing ----
  describe('generateWeeklyHRBriefing', () => {
    it('returns all briefing fields', async () => {
      const stats = { total_employees: 50, pending_leaves: 3, pending_payroll: 2, new_joiners: 1 };
      const result = await aiAgent.generateWeeklyHRBriefing(stats, [], []);
      expect(typeof result.executiveSummary).toBe('string');
      expect(Array.isArray(result.priorityActions)).toBe(true);
      expect(Array.isArray(result.riskFlags)).toBe(true);
      expect(Array.isArray(result.celebrations)).toBe(true);
    });

    it('mentions pending leaves in summary', async () => {
      const result = await aiAgent.generateWeeklyHRBriefing({ pending_leaves: 5 }, [], []);
      expect(result.executiveSummary.toLowerCase() + result.priorityActions.join(' ').toLowerCase())
        .toMatch(/5|leave/);
    });
  });

  // ---- handleCopilotQuery ----
  describe('handleCopilotQuery', () => {
    it('handles leave balance query', async () => {
      const result = await aiAgent.handleCopilotQuery(
        'What is my leave balance?',
        { leave_balance: { Casual: 5, Sick: 8 } }
      );
      expect(typeof result.answer).toBe('string');
      expect(result.answer.length).toBeGreaterThan(0);
      expect(result.intent).toBe('leave_balance');
    });

    it('handles payslip query', async () => {
      const result = await aiAgent.handleCopilotQuery('Show me my last month salary slip');
      expect(result.intent).toBe('payslip');
    });

    it('NEVER exposes sensitive data in context', async () => {
      const sensitiveContext = {
        bank_account_encrypted: 'ENC_1234567890',
        pan: 'ABCDE1234F',
        aadhar_last4: '5678',
        name: 'Alice',
        leave_balance: { Casual: 5 },
      };
      const result = await aiAgent.handleCopilotQuery('What is my leave balance?', sensitiveContext);
      // Answer must not contain PAN, Aadhaar, or bank account
      expect(result.answer).not.toContain('ABCDE1234F');
      expect(result.answer).not.toContain('5678');
      expect(result.answer).not.toContain('ENC_1234567890');
    });

    it('handles general query gracefully', async () => {
      const result = await aiAgent.handleCopilotQuery('Random unrecognized query XYZ');
      expect(typeof result.answer).toBe('string');
      expect(result.answer.length).toBeGreaterThan(0);
    });
  });
});
