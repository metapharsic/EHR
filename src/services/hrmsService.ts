/**
 * src/services/hrmsService.ts
 * Typed API client for the full HRMS module (Phases 0-6).
 * All calls through apiClient — JWT auto-injected.
 */

import { apiClient } from './apiClient';
import type {
  HrDepartment, HrDesignation, HrSalaryStructure,
  HrEmployee, HrEmployeeDocument, HrTimeline,
  HrJobRequisition, HrCandidate, HrOfferLetter,
  HrOnboardingChecklist, HrOnboardingTask, HrAssetAllocation,
  HrAttendanceRecord, HrLeave, HrLeaveBalance, HrShift,
  SalarySlip, HrPfRegister, HrIncrement, HrReimbursementClaim,
  HrIncident, HrReward, HrStats,
  HrAnalyticsHeadcount, HrAnalyticsAttrition,
  AiResumeScreen, AiInterviewQuestions, AiAttritionPrediction,
  AiHrBriefing, AiCopilotResponse,
} from '../types';

const ok = <T>(r: any): T => (r?.data !== undefined ? r.data : r);
const qs = (p: Record<string, any> = {}) => {
  const s = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => { if (v != null && v !== '') s.append(k, String(v)); });
  const q = s.toString(); return q ? `₹${q}` : '';
};

export const hrmsService = {

  // ======== DEPARTMENTS ========
  getDepartments: () => apiClient.get<any>('/hr/departments').then(ok<HrDepartment[]>),
  getDeptTree: () => apiClient.get<any>('/hr/departments/tree').then(ok<HrDepartment[]>),
  createDepartment: (data: Partial<HrDepartment>) => apiClient.post<any>('/hr/departments', data),

  // ======== DESIGNATIONS ========
  getDesignations: () => apiClient.get<any>('/hr/designations').then(ok<HrDesignation[]>),
  createDesignation: (data: Partial<HrDesignation>) => apiClient.post<any>('/hr/designations', data),

  // ======== SALARY STRUCTURES ========
  getSalaryStructures: () => apiClient.get<any>('/hr/salary-structures').then(ok<HrSalaryStructure[]>),
  createSalaryStructure: (data: Partial<HrSalaryStructure>) => apiClient.post<any>('/hr/salary-structures', data),

  // ======== EMPLOYEES ========
  getEmployees: (params: Record<string, any> = {}) =>
    apiClient.get<any>(`/hr/employees${qs(params)}`).then(ok<HrEmployee[]>),
  createEmployee: (data: Partial<HrEmployee>) => apiClient.post<any>('/hr/employees', data),
  getEmployeeProfile: (id: string) => apiClient.get<any>(`/hr/employees/${id}/profile`).then(ok<HrEmployee>),
  updateEmployeeProfile: (id: string, data: Partial<HrEmployee>) =>
    apiClient.put<any>(`/hr/employees/${id}/profile`, data),
  terminateEmployee: (id: string, data: { exit_date: string; exit_reason: string }) =>
    apiClient.delete<any>(`/hr/employees/${id}`),
  getOrgChart: () => apiClient.get<any>('/hr/org-chart').then(ok<HrDepartment[]>),

  // ======== DOCUMENTS ========
  getDocuments: (empId: string) =>
    apiClient.get<any>(`/hr/employees/${empId}/documents`).then(ok<HrEmployeeDocument[]>),
  deleteDocument: (empId: string, docId: string) =>
    apiClient.delete<any>(`/hr/employees/${empId}/documents/${docId}`),
  // Document upload uses FormData — handled directly via fetch in the component

  // ======== ATS ========
  getRequisitions: (p: Record<string, any> = {}) =>
    apiClient.get<any>(`/hr/ats/requisitions${qs(p)}`).then(ok<HrJobRequisition[]>),
  createRequisition: (data: Partial<HrJobRequisition>) => apiClient.post<any>('/hr/ats/requisitions', data),
  approveRequisition: (id: string) => apiClient.put<any>(`/hr/ats/requisitions/${id}/approve`, {}),
  getCandidates: (p: Record<string, any> = {}) =>
    apiClient.get<any>(`/hr/ats/candidates${qs(p)}`).then(ok<HrCandidate[]>),
  createCandidate: (data: Partial<HrCandidate>) => apiClient.post<any>('/hr/ats/candidates', data),
  moveCandidateStage: (id: string, data: { stage: string; notes?: string; interviewerId?: string; scheduledAt?: string }) =>
    apiClient.put<any>(`/hr/ats/candidates/${id}/stage`, data),
  aiScreenCandidate: (id: string) => apiClient.post<any>(`/hr/ats/candidates/${id}/ai-screen`, {}).then(ok<AiResumeScreen>),
  createOffer: (candidateId: string, data: Partial<HrOfferLetter>) =>
    apiClient.post<any>(`/hr/ats/offers/${candidateId}`, data),
  updateOffer: (offerId: string, data: Partial<HrOfferLetter>) =>
    apiClient.put<any>(`/hr/ats/offers/${offerId}`, data),
  hireCandidate: (id: string) => apiClient.post<any>(`/hr/ats/candidates/${id}/hire`, {}),
  getOffers: () => apiClient.get<any>('/hr/ats/offers').then(ok<any[]>),
  getAtsAnalytics: () => apiClient.get<any>('/hr/ats/analytics').then(ok),

  // ======== ONBOARDING ========
  getActiveOnboardings: () =>
    apiClient.get<any>('/hr/onboarding/active').then(ok<HrOnboardingChecklist[]>),
  triggerOnboarding: (empId: string) => apiClient.post<any>(`/hr/onboarding/trigger/${empId}`, {}),
  getOnboarding: (empId: string) =>
    apiClient.get<any>(`/hr/onboarding/${empId}`).then(ok<HrOnboardingChecklist>),
  updateOnboardingTask: (taskId: string, data: { status: string; notes?: string }) =>
    apiClient.put<any>(`/hr/onboarding/tasks/${taskId}`, data),

  // ======== ASSETS ========
  allocateAsset: (data: Partial<HrAssetAllocation> & { decrementInventory?: boolean }) =>
    apiClient.post<any>('/hr/assets/allocate', data),
  getEmployeeAssets: (empId: string) =>
    apiClient.get<any>(`/hr/assets/employee/${empId}`).then(ok<HrAssetAllocation[]>),
  returnAsset: (assetId: string, data: { return_condition?: string; notes?: string }) =>
    apiClient.put<any>(`/hr/assets/${assetId}/return`, data),

  // ======== POLICIES ========
  acknowledgePolicy: (data: { employee_id: string; policy_name: string; policy_version?: string; policy_doc_url?: string }) =>
    apiClient.post<any>('/hr/policies/acknowledge', data),
  getEmployeePolicies: (empId: string) =>
    apiClient.get<any>(`/hr/policies/employee/${empId}`).then(ok),

  // ======== OFFBOARDING ========
  initiateOffboarding: (empId: string, data: { exit_date: string; exit_type?: string; notice_period_days?: number }) =>
    apiClient.post<any>(`/hr/offboarding/initiate/${empId}`, data),
  getOffboarding: (empId: string) => apiClient.get<any>(`/hr/offboarding/${empId}`).then(ok),
  updateOffboardingClearance: (id: string, data: Record<string, boolean>) =>
    apiClient.put<any>(`/hr/offboarding/${id}/clearance`, data),

  // ======== ATTENDANCE ========
  clockIn: (data: { employee_id: string; location_in?: string; device_id?: string; work_from_home?: boolean }) =>
    apiClient.post<any>('/hr/attendance/clock-in', data),
  clockOut: (data: { employee_id: string; location_out?: string }) =>
    apiClient.post<any>('/hr/attendance/clock-out', data),
  getAttendanceSummary: (p: { empId: string; month: number; year: number }) =>
    apiClient.get<any>(`/hr/attendance/summary${qs(p)}`).then(ok),
  regularizeAttendance: (id: string, data: { reason: string }) =>
    apiClient.put<any>(`/hr/attendance/${id}/regularize`, data),

  // ======== LEAVE ========
  getLeaveBalances: (empId: string, year?: number) =>
    apiClient.get<any>(`/hr/leave-balances/${empId}${year ? `?year=${year}` : ''}`).then(ok<HrLeaveBalance[]>),
  applyLeave: (data: Partial<HrLeave>) => apiClient.post<any>('/hr/leave/apply', data),
  approveLeave: (id: string) => apiClient.put<any>(`/hr/leave/${id}/approve`, {}),
  rejectLeave: (id: string, reason: string) => apiClient.put<any>(`/hr/leave/${id}/reject`, { rejection_reason: reason }),
  getTeamCalendar: (p: { month: number; year: number; deptId?: string }) =>
    apiClient.get<any>(`/hr/leave/team-calendar${qs(p)}`).then(ok),
  encashLeave: (data: { employee_id: string; leave_type: string; days: number }) =>
    apiClient.post<any>('/hr/leave/encash', data),
  requestCompOff: (data: { employee_id: string; worked_date: string; reason: string; hours_worked: number }) =>
    apiClient.post<any>('/hr/comp-off/request', data),
  approveCompOff: (id: string) => apiClient.put<any>(`/hr/comp-off/${id}/approve`, {}),

  // ======== SHIFTS ========
  getShifts: () => apiClient.get<any>('/hr/shifts').then(ok<HrShift[]>),
  createShift: (data: Partial<HrShift>) => apiClient.post<any>('/hr/shifts', data),
  assignShift: (data: { employee_id: string; shift_id: string; effective_from: string }) =>
    apiClient.post<any>('/hr/shifts/assign', data),

  // ======== HOLIDAYS ========
  getHolidays: (year?: number) => apiClient.get<any>(`/hr/holidays${year ? `?year=${year}` : ''}`).then(ok),
  createHoliday: (data: any) => apiClient.post<any>('/hr/holidays', data),

  // ======== TIMESHEETS ========
  submitTimesheet: (data: any) => apiClient.post<any>('/hr/timesheets', data),
  getTimesheets: (empId: string, p?: Record<string, any>) =>
    apiClient.get<any>(`/hr/timesheets/${empId}${qs(p)}`).then(ok),

  // ======== OVERTIME ========
  requestOvertime: (data: any) => apiClient.post<any>('/hr/overtime/request', data),
  approveOvertime: (id: string) => apiClient.put<any>(`/hr/overtime/${id}/approve`, {}),

  // ======== PAYROLL ========
  getPayrollSlips: (month: string, year: number) =>
    apiClient.get<any>(`/hr/payroll/slips?month=${month}&year=${year}`).then(ok<SalarySlip[]>),
  getPayrollSlip: (id: string) => apiClient.get<any>(`/hr/payroll/slips/${id}`).then(ok<SalarySlip>),
  processBulkPayroll: (month: string, year: number) =>
    apiClient.post<any>('/hr/payroll/process-bulk', { month, year }),
  markSlipPaid: (id: string, bankRef?: string) =>
    apiClient.put<any>(`/hr/payroll/slips/${id}/mark-paid`, { bank_transfer_ref: bankRef }),
  getPfRegister: (month: string, year: number) =>
    apiClient.get<any>(`/hr/payroll/pf-register?month=${month}&year=${year}`).then(ok<HrPfRegister[]>),
  getEsicRegister: (month: string, year: number) =>
    apiClient.get<any>(`/hr/payroll/esic-register?month=${month}&year=${year}`).then(ok),
  getPtRegister: (month: string, year: number) =>
    apiClient.get<any>(`/hr/payroll/pt-register?month=${month}&year=${year}`).then(ok),
  getTdsWorkings: (empId: string) =>
    apiClient.get<any>(`/hr/payroll/tds-workings/${empId}`).then(ok),
  computeTds: (empId: string, data: any) =>
    apiClient.post<any>(`/hr/payroll/tds/compute/${empId}`, data).then(ok),
  getPayrollAnomalies: () =>
    apiClient.get<any>('/hr/payroll/anomalies').then(ok),
  getPayrollCostSummary: (month: string, year: number) =>
    apiClient.get<any>(`/hr/payroll/cost-summary?month=${month}&year=${year}`).then(ok),
  createIncrementCycle: (data: any) => apiClient.post<any>('/hr/increments/create', data),
  processBonuses: (data: any) => apiClient.post<any>('/hr/bonuses/process', data),
  getReimbursements: (p?: Record<string, any>) =>
    apiClient.get<any>(`/hr/reimbursements${qs(p)}`).then(ok<HrReimbursementClaim[]>),
  submitReimbursement: (data: any) => apiClient.post<any>('/hr/reimbursements', data),
  approveReimbursement: (id: string) => apiClient.put<any>(`/hr/reimbursements/${id}/approve`, {}),

  // ======== BENEFITS ========
  getBenefitsPlans: () => apiClient.get<any>('/hr/benefits/plans').then(ok<any[]>),
  getBenefitsEnrollments: () => apiClient.get<any>('/hr/benefits/enrollments').then(ok<any[]>),
  enrollBenefit: (data: any) => apiClient.post<any>('/hr/benefits/enroll', data),

  // ======== INCIDENTS ========
  getIncidents: (p?: Record<string, any>) =>
    apiClient.get<any>(`/hr/incidents${qs(p)}`).then(ok<HrIncident[]>),
  createIncident: (data: Partial<HrIncident>) => apiClient.post<any>('/hr/incidents', data),
  updateIncident: (id: string, data: Partial<HrIncident>) => apiClient.put<any>(`/hr/incidents/${id}`, data),

  // ======== REWARDS ========
  getRewards: () => apiClient.get<any>('/hr/rewards').then(ok<HrReward[]>),
  giveReward: (data: Partial<HrReward>) => apiClient.post<any>('/hr/rewards', data),

  // ======== ANALYTICS ========
  getHeadcountAnalytics: () => apiClient.get<any>('/hr/analytics/headcount').then(ok<HrAnalyticsHeadcount>),
  getAttritionAnalytics: () => apiClient.get<any>('/hr/analytics/attrition').then(ok<HrAnalyticsAttrition>),
  getDiversityAnalytics: () => apiClient.get<any>('/hr/analytics/diversity').then(ok),
  getHiringAnalytics: () => apiClient.get<any>('/hr/analytics/hiring').then(ok),
  getPayrollCostAnalytics: () => apiClient.get<any>('/hr/analytics/payroll-cost').then(ok),
  getLeaveUtilization: () => apiClient.get<any>('/hr/analytics/leave-utilization').then(ok),
  getComplianceScore: () => apiClient.get<any>('/hr/analytics/compliance-score').then(ok),

  // ======== AI ========
  aiPredictAttrition: () =>
    apiClient.post<any>('/hr/ai/attrition', {}).then(ok<AiAttritionPrediction>),
  aiFlightRisk: (empId: string) =>
    apiClient.post<any>(`/hr/ai/flight-risk/${empId}`, {}).then(ok),
  aiPromotionReadiness: (empId: string) =>
    apiClient.post<any>(`/hr/ai/promotion-readiness/${empId}`, {}).then(ok),
  aiWeeklyBriefing: () =>
    apiClient.post<any>('/hr/ai/weekly-briefing', {}).then(ok<AiHrBriefing>),
  aiCopilot: (query: string, context?: any) =>
    apiClient.post<any>('/hr/ai/copilot', { query, context }).then(ok<AiCopilotResponse>),
};

export default hrmsService;
