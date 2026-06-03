/**
 * HRMS.tsx — Metapharsic ERP Human Resource Management System
 * Comprehensive production-quality React 19 + TypeScript component
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LayoutDashboard, Users, Building2, FileText, UserPlus, ClipboardCheck,
  LogOut, Clock, Calendar, Sun, Timer, IndianRupee, BarChart2, Shield,
  Receipt, AlertTriangle, Award, Heart, TrendingUp, Brain, MessageSquare,
  ChevronRight, X, Send, CheckCircle, Circle, RefreshCw, Plus, Eye, Edit2,
  Loader2, Download, CheckSquare, ChevronDown, Search, Briefcase, FilePlus,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts';

import { ERPLayout, EnterpriseLayout, Tabs, DataTable, StatCard, Badge, Modal, FilterBar } from './UniversalLayout';
import { useDataFetch, useDatabaseStatus } from '../hooks/useDataFetch';
import { useAppStore } from '../store/useAppStore';
import hrmsService from '../services/hrmsService';
import type {
  HrDepartment, HrEmployee, HrJobRequisition, HrCandidate,
  HrOnboardingChecklist, HrAttendanceRecord, HrLeave, HrLeaveBalance,
  SalarySlip, HrIncident, HrReward, HrStats,
  HrAnalyticsHeadcount, HrAnalyticsAttrition,
  AiResumeScreen, AiAttritionPrediction, AiHrBriefing, AiCopilotResponse,
  HrEmployeeDocument, HrShift, HrSalaryStructure, HrReimbursementClaim,
} from '../types';

// ─── helpers ────────────────────────────────────────────────────────────────
const inr = (v: any) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const nowDate = new Date();
const STAGES: HrCandidate['stage'][] = ['Sourced','Screened','Interview 1','Interview 2','HR Round','Offered','Hired'];

const Spinner = () => <Loader2 size={14} className="animate-spin" />;

const EmployeeSelector: React.FC<{
  value: string;
  onChange: (id: string) => void;
  employees: HrEmployee[];
  label?: string;
  loading?: boolean;
}> = ({ value, onChange, employees, label = "Select Employee", loading }) => {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  
  const filtered = employees.filter(e => 
    e.name.toLowerCase().includes(search.toLowerCase()) || 
    e.employee_code.toLowerCase().includes(search.toLowerCase()) ||
    e.department_name?.toLowerCase().includes(search.toLowerCase())
  );

  const selected = employees.find(e => e.id === value);

  return (
    <div className="relative z-20 min-w-[240px]">
      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5 block ml-1">{label}</label>
      <div 
        onClick={() => !loading && setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-3 border border-slate-200 rounded-xl px-4 py-2 text-xs bg-white font-medium cursor-pointer transition-all shadow-sm hover:border-indigo-300 hover:shadow-md ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <Users size={14} className="text-slate-400 shrink-0" />
          <span className={`truncate ${selected ? 'text-slate-700 font-semibold' : 'text-slate-400'}`}>
            {loading ? 'Loading employees...' : selected ? `${selected.name} (${selected.employee_code})` : '— Select —'}
          </span>
        </div>
        {loading ? <Spinner /> : <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
      </div>
      
      {isOpen && !loading && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div className="absolute z-40 mt-2 w-full bg-white border border-slate-200 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
            <div className="p-3 border-b border-slate-100 bg-slate-50/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search name, code, or department..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto p-1.5 custom-scrollbar">
              {filtered.length > 0 ? filtered.map(e => (
                <div
                  key={e.id}
                  onClick={() => {
                    onChange(e.id);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`group px-3 py-2.5 text-xs rounded-xl cursor-pointer flex flex-col gap-0.5 transition-colors ${value === e.id ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-indigo-50 text-slate-600'}`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold">{e.name}</span>
                    <span className={`text-[9px] uppercase tracking-tighter px-1.5 py-0.5 rounded ${value === e.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{e.employee_code}</span>
                  </div>
                  <span className={`text-[10px] ${value === e.id ? 'text-indigo-100' : 'text-slate-400 group-hover:text-indigo-400'}`}>
                    {e.department_name} • {e.designation_name} • <Badge value={e.status || 'Active'} variant={e.status === 'Active' ? 'success' : 'default'} />
                  </span>
                </div>
              )) : (
                <div className="px-3 py-8 text-center space-y-2">
                  <div className="text-2xl opacity-20">🔍</div>
                  <div className="text-xs text-slate-400">No employees found matching "{search}"</div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};


// ─── Sub-components ──────────────────────────────────────────────────────────

// ── OrgNode ──────────────────────────────────────────────────────────────────
const OrgNode: React.FC<{ dept: HrDepartment; depth?: number }> = ({ dept, depth = 0 }) => (
  <div className="flex flex-col items-center">
    <div className={`border border-slate-300 rounded-lg px-4 py-2 bg-white shadow-sm text-center min-w-[140px] ${depth === 0 ? 'border-indigo-400 bg-indigo-50' : ''}`}>
      <div className="font-semibold text-xs text-slate-800">{dept.name}</div>
      {dept.manager_name && <div className="text-[10px] text-slate-500">{dept.manager_name}</div>}
      {dept.headcount !== undefined && (
        <div className="text-[10px] text-indigo-500 mt-1">{dept.headcount} members</div>
      )}
    </div>
    {dept.children && dept.children.length > 0 && (
      <div className="flex gap-6 mt-4 relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-slate-300" />
        {dept.children.map((child: HrDepartment) => (
          <div key={child.id} className="flex flex-col items-center pt-4">
            <OrgNode dept={child} depth={depth + 1} />
          </div>
        ))}
      </div>
    )}
  </div>
);

const ProfileDrawer: React.FC<{
  emp: HrEmployee;
  onClose: () => void;
  addNotification: (n: any) => void;
}> = ({ emp, onClose, addNotification }) => {
  const [tab, setTab] = useState('personal');
  const [profile, setProfile] = useState<HrEmployee>(emp);
  const [leaveBalances, setLeaveBalances] = useState<HrLeaveBalance[]>([]);
  const [slips, setSlips] = useState<SalarySlip[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      try {
        const data = await hrmsService.getEmployeeProfile(emp.id);
        setProfile(data);
        if ((data as any).timeline) setTimeline((data as any).timeline);
      } catch (err) {
        addNotification({ type: 'error', message: 'Failed to load full profile' });
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [emp.id]);

  useEffect(() => {
    if (tab === 'leave') {
      setLoading(true);
      hrmsService.getLeaveBalances(emp.id).then(setLeaveBalances).catch(() =>
        addNotification({ type: 'error', message: 'Failed to load leave balances' })
      ).finally(() => setLoading(false));
    }
    if (tab === 'payroll') {
      setLoading(true);
      hrmsService.getPayrollSlips(months[nowDate.getMonth()], nowDate.getFullYear())
        .then(all => setSlips(all.filter((s: SalarySlip) => s.employee_id === emp.id).slice(0, 3)))
        .catch(() => addNotification({ type: 'error', message: 'Failed to load payslips' }))
        .finally(() => setLoading(false));
    }
  }, [tab, emp.id]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await hrmsService.updateEmployeeProfile(emp.id, profile);
      if (res.success) {
        addNotification({ type: 'success', message: 'Profile updated successfully' });
        setIsEditing(false);
      }
    } catch (err) {
      addNotification({ type: 'error', message: 'Failed to update profile' });
    } finally {
      setLoading(false);
    }
  };

  const ptabs = [
    { id: 'personal', label: 'Personal Info' },
    { id: 'job', label: 'Job Details' },
    { id: 'leave', label: 'Leave Balances' },
    { id: 'payroll', label: 'Payroll' },
    { id: 'timeline', label: 'Timeline' },
  ];

  const statusVariant: Record<string, string> = {
    Active: 'success', 'On Leave': 'warning', Terminated: 'error', Inactive: 'default',
  };

  const p = profile;

  return (
    <div className="fixed inset-y-0 right-0 w-[520px] bg-white shadow-2xl z-50 flex flex-col overflow-hidden border-l border-slate-200 animate-slideInRight">
      {/* header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">
            {p.name?.[0]}
          </div>
          <div>
            <div className="font-semibold text-sm">{p.name}</div>
            <div className="text-[11px] text-indigo-200">{p.designation_name} · {p.department_name}</div>
            <div className="mt-1 flex items-center gap-2">
              <Badge value={p.status || 'Active'} variant={statusVariant[p.status || 'Active'] as any} />
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${isEditing ? 'bg-white text-indigo-600 border-white' : 'bg-transparent text-white border-white/40 hover:bg-white/10'}`}
              >
                {isEditing ? 'Cancel' : 'Edit'}
              </button>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded"><X size={18} /></button>
      </div>

      {/* sub-tabs */}
      <div className="flex border-b border-slate-100 text-[11px] font-semibold shrink-0 overflow-x-auto bg-slate-50">
        {ptabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 border-b-2 whitespace-nowrap transition-colors ${tab === t.id ? 'border-indigo-500 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleUpdate} className="flex-1 overflow-y-auto flex flex-col">
        <div className="flex-1 p-4 text-xs">
          {loading && !isEditing && <div className="flex justify-center py-8"><Spinner /></div>}
          
          {(!loading || isEditing) && tab === 'personal' && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Name', key: 'name', type: 'text' },
                { label: 'Email', key: 'email', type: 'email' },
                { label: 'Contact', key: 'contact', type: 'text' },
                { label: 'Gender', key: 'gender', type: 'select', options: ['Male', 'Female', 'Other'] },
                { label: 'Date of Birth', key: 'dob', type: 'date' },
                { label: 'UAN', key: 'uan', type: 'text' },
                { label: 'PAN', key: 'pan', type: 'text' },
                { label: 'Work Location', key: 'work_location', type: 'text' },
              ].map((f: any) => (
                <div key={f.key} className="bg-slate-50 rounded p-2">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wide">{f.label}</div>
                  {isEditing ? (
                    f.type === 'select' ? (
                      <select 
                        value={p[f.key as keyof HrEmployee] || ''} 
                        onChange={e => setProfile({...p, [f.key]: e.target.value})}
                        className="w-full bg-white border border-slate-200 rounded px-1 py-0.5 mt-0.5"
                      >
                        <option value="">Select...</option>
                        {f.options.map((o: string) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input 
                        type={f.type} 
                        value={p[f.key as keyof HrEmployee] || ''} 
                        onChange={e => setProfile({...p, [f.key]: e.target.value})}
                        className="w-full bg-white border border-slate-200 rounded px-1 py-0.5 mt-0.5"
                      />
                    )
                  ) : (
                    <div className="font-medium text-slate-700 mt-0.5">
                      {f.key === 'pan' ? '••••' + (p.pan?.slice(-4) || '••••') : (p[f.key as keyof HrEmployee] || '—')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {(!loading || isEditing) && tab === 'job' && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Department', key: 'department_name', readonly: true },
                { label: 'Designation', key: 'designation_name', readonly: true },
                { label: 'Grade', key: 'grade', type: 'text' },
                { label: 'Employment Type', key: 'employment_type', type: 'select', options: ['Permanent', 'Contract', 'Probation', 'Intern'] },
                { label: 'Join Date', key: 'join_date', type: 'date' },
                { label: 'Probation End', key: 'probation_end_date', type: 'date' },
                { label: 'Status', key: 'status', type: 'select', options: ['Active', 'On Leave', 'Terminated', 'Inactive'] },
                { label: 'Work Location', key: 'work_location', type: 'text' },
              ].map((f: any) => (
                <div key={f.key} className="bg-slate-50 rounded p-2">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wide">{f.label}</div>
                  {isEditing && !f.readonly ? (
                    f.type === 'select' ? (
                      <select 
                        value={p[f.key as keyof HrEmployee] || ''} 
                        onChange={e => setProfile({...p, [f.key]: e.target.value})}
                        className="w-full bg-white border border-slate-200 rounded px-1 py-0.5 mt-0.5"
                      >
                        <option value="">Select...</option>
                        {f.options.map((o: string) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input 
                        type={f.type} 
                        value={p[f.key as keyof HrEmployee] || ''} 
                        onChange={e => setProfile({...p, [f.key]: e.target.value})}
                        className="w-full bg-white border border-slate-200 rounded px-1 py-0.5 mt-0.5"
                      />
                    )
                  ) : (
                    <div className="font-medium text-slate-700 mt-0.5">{p[f.key as keyof HrEmployee] || '—'}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {!loading && tab === 'leave' && (
            <div className="border border-slate-100 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead><tr className="bg-slate-50 text-slate-500 uppercase text-[9px] tracking-wider">
                  <th className="px-3 py-2 text-left font-bold">Leave Type</th>
                  <th className="px-3 py-2 text-right font-bold">Allocated</th>
                  <th className="px-3 py-2 text-right font-bold">Used</th>
                  <th className="px-3 py-2 text-right font-bold">Balance</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {leaveBalances.map(lb => (
                    <tr key={lb.leave_type} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2 font-medium text-slate-700">{lb.leave_type}</td>
                      <td className="px-3 py-2 text-right text-slate-500">{lb.allocated}</td>
                      <td className="px-3 py-2 text-right text-amber-600">{lb.used}</td>
                      <td className="px-3 py-2 text-right text-indigo-600 font-bold">{lb.available_balance}</td>
                    </tr>
                  ))}
                  {!leaveBalances.length && <tr><td colSpan={4} className="text-center py-6 text-slate-400 italic">No leave data provisioned</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {!loading && tab === 'payroll' && (
            <div className="space-y-3">
              {slips.map(s => (
                <div key={s.id} className="border border-slate-100 rounded-xl p-3 bg-white shadow-sm hover:border-indigo-200 transition-all">
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-bold text-slate-800 text-[13px]">{s.month} {s.year}</div>
                    <Badge value={s.status} variant={s.status === 'Paid' ? 'success' : s.status === 'Processed' ? 'info' : 'error'} />
                  </div>
                  <div className="grid grid-cols-3 gap-1 py-2 border-t border-slate-50">
                    <div><div className="text-[9px] text-slate-400 uppercase">Gross</div><div className="font-bold text-slate-700">{inr(s.gross_salary)}</div></div>
                    <div><div className="text-[9px] text-slate-400 uppercase">Deductions</div><div className="font-bold text-red-500">{inr(s.total_deductions)}</div></div>
                    <div><div className="text-[9px] text-slate-400 uppercase">Net Pay</div><div className="font-black text-indigo-600">{inr(s.net_pay)}</div></div>
                  </div>
                </div>
              ))}
              {!slips.length && <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-xl italic">No payslips found for current year</div>}
            </div>
          )}

          {!loading && tab === 'timeline' && (
            <div className="space-y-4 px-2">
              {timeline.length === 0 && (
                <div className="text-slate-400 text-center py-10 bg-slate-50 rounded-xl italic">No timeline events recorded</div>
              )}
              {timeline.map((ev: any, i: number) => (
                <div key={i} className="relative pl-6 pb-4 border-l-2 border-slate-100 last:border-0 last:pb-0">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-indigo-500 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  </div>
                  <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-tighter mb-0.5">{new Date(ev.event_date || ev.created_at).toLocaleDateString()}</div>
                  <div className="font-bold text-slate-800 text-xs mb-0.5">{ev.event_type}</div>
                  <div className="text-slate-500 leading-relaxed text-[11px]">{ev.description}</div>
                  {ev.performed_by_name && <div className="text-[9px] text-slate-400 mt-1 italic">By {ev.performed_by_name}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {isEditing && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0 flex gap-2">
            <button 
              type="submit"
              disabled={loading}
              className="flex-1 bg-indigo-600 text-white py-2 rounded font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Spinner /> : <CheckCircle size={14} />} Save Changes
            </button>
            <button 
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 border border-slate-200 rounded font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

// ── PayslipModal ──────────────────────────────────────────────────────────────
const PayslipModal: React.FC<{
  slip: SalarySlip;
  onClose: () => void;
  onMarkPaid: (id: string) => void;
  markingPaid: boolean;
}> = ({ slip, onClose, onMarkPaid, markingPaid }) => (
  <Modal isOpen title={`Payslip — ${slip.employee_name} · ${slip.month} ${slip.year}`} onClose={onClose} size="lg">
    <div className="grid grid-cols-2 gap-6 text-xs">
      <div>
        <div className="font-semibold text-slate-600 mb-2 uppercase tracking-wide text-[10px]">Earnings</div>
        <table className="w-full">
          <tbody className="divide-y divide-slate-100">
            {[
              ['Basic Salary', slip.basic_salary],
              ['HRA', slip.hra],
              ['DA', slip.da],
              ['Special Allowance', slip.special_allowance],
              ['Fixed Allowance', slip.fixed_allowance],
              ['Performance Incentive', slip.performance_incentive],
              ['Overtime Amount', slip.overtime_amount],
              ['Bonus', slip.bonus_amount],
            ].filter(([,v]) => Number(v) > 0).map(([k, v]) => (
              <tr key={k as string}>
                <td className="py-1 text-slate-500">{k}</td>
                <td className="py-1 text-right font-medium">{inr(v)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-200 font-bold text-green-700">
              <td className="py-1.5">Gross Salary</td>
              <td className="py-1.5 text-right">{inr(slip.gross_salary)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div>
        <div className="font-semibold text-slate-600 mb-2 uppercase tracking-wide text-[10px]">Deductions</div>
        <table className="w-full">
          <tbody className="divide-y divide-slate-100">
            {[
              ['PF (Employee)', slip.pf_employee],
              ['ESIC (Employee)', slip.esic_employee],
              ['Professional Tax', slip.pt_amount || slip.professional_tax],
              ['TDS', slip.tds],
              ['LOP Deduction', slip.lop_deduction],
              ['Other Deductions', slip.other_deductions],
            ].filter(([,v]) => Number(v) > 0).map(([k, v]) => (
              <tr key={k as string}>
                <td className="py-1 text-slate-500">{k}</td>
                <td className="py-1 text-right text-red-500">{inr(v)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-200 font-bold text-red-600">
              <td className="py-1.5">Total Deductions</td>
              <td className="py-1.5 text-right">{inr(slip.total_deductions)}</td>
            </tr>
          </tbody>
        </table>
        <div className="mt-3 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
          <div className="flex justify-between items-center">
            <span className="font-bold text-indigo-700">Net Pay</span>
            <span className="text-xl font-bold text-indigo-700">{inr(slip.net_pay)}</span>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[['Present', slip.present_days], ['Absent', slip.lop_days], ['Leave', slip.leave_days]].map(([k, v]) => (
            <div key={k as string} className="bg-slate-50 rounded p-2 text-center">
              <div className="text-[10px] text-slate-400">{k}</div>
              <div className="font-bold text-slate-700">{v || 0}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
    <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100">
      <button onClick={onClose} className="px-4 py-2 text-xs border border-slate-200 rounded-lg hover:bg-slate-50">Close</button>
      {slip.status !== 'Paid' && (
        <button onClick={() => onMarkPaid(slip.id)} disabled={markingPaid}
          className="px-4 py-2 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1">
          {markingPaid ? <Spinner /> : <CheckCircle size={12} />} Mark Paid
        </button>
      )}
    </div>
  </Modal>
);

// ── AICopilot ─────────────────────────────────────────────────────────────────
const AICopilot: React.FC<{ addNotification: (n: any) => void }> = ({ addNotification }) => {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<{ role: 'user' | 'ai'; text: string }[]>([
    { role: 'ai', text: 'Hello! I\'m your HR Copilot. Ask me about leave policies, headcount, payroll, or anything HR-related.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const sensitiveWords = ['bank account', 'pan', 'aadhaar', 'password', 'salary of'];

  const send = useCallback(async () => {
    if (!input.trim()) return;
    const q = input.trim();
    setInput('');
    setMsgs(m => [...m, { role: 'user', text: q }]);
    const isSensitive = sensitiveWords.some(w => q.toLowerCase().includes(w));
    if (isSensitive) {
      setMsgs(m => [...m, { role: 'ai', text: '⚠️ Your query may contain sensitive personal data (bank/PAN/Aadhaar). Please do not share this information here. Contact the HR team directly for such queries.' }]);
      return;
    }
    setLoading(true);
    try {
      const res: AiCopilotResponse = await hrmsService.aiCopilot(q);
      setMsgs(m => [...m, { role: 'ai', text: res.answer }]);
    } catch {
      addNotification({ type: 'error', message: 'AI Copilot unavailable' });
      setMsgs(m => [...m, { role: 'ai', text: 'Sorry, I\'m having trouble connecting. Please try again.' }]);
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [input]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  return (
    <>
      <button onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-700 transition-colors">
        <Brain size={20} />
      </button>
      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-[350px] h-[500px] bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
          <div className="bg-indigo-600 text-white px-4 py-3 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2 font-semibold text-sm"><Brain size={16} /> HR Copilot</div>
            <button onClick={() => setOpen(false)}><X size={16} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs bg-slate-50">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-lg leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 flex gap-1">
                  {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="p-3 border-t border-slate-100 bg-white shrink-0">
            <div className="flex gap-2">
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder="Ask HR anything..." disabled={loading}
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-400 disabled:bg-slate-50" />
              <button onClick={send} disabled={loading || !input.trim()}
                className="bg-indigo-600 text-white rounded-lg px-3 py-2 disabled:opacity-50 hover:bg-indigo-700">
                <Send size={12} />
              </button>
            </div>
            <div className="text-[9px] text-slate-400 mt-1.5 text-center">Powered by AI · Do not share sensitive personal data</div>
          </div>
        </div>
      )}
    </>
  );
};

// ─── Main HRMS Component ─────────────────────────────────────────────────────
const HRMS: React.FC = () => {
  const addNotification = useAppStore((s: any) => s.addNotification);
  const [activeView, setActiveView] = useState('dashboard');

  // ── shared state ──
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [empSearch, setEmpSearch] = useState('');
  const [empDeptFilter, setEmpDeptFilter] = useState('');
  const [empStatusFilter, setEmpStatusFilter] = useState('');
  const [selectedEmp, setSelectedEmp] = useState<HrEmployee | null>(null);
  const [departments, setDepartments] = useState<HrDepartment[]>([]);
  const [deptTree, setDeptTree] = useState<HrDepartment[]>([]);
  const [stats, setStats] = useState<HrStats | null>(null);
  const [briefing, setBriefing] = useState<AiHrBriefing | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [loadingView, setLoadingView] = useState(false);

  // ── ATS ──
  const [atsTab, setAtsTab] = useState('requisitions');
  const [requisitions, setRequisitions] = useState<HrJobRequisition[]>([]);
  const [candidates, setCandidates] = useState<HrCandidate[]>([]);
  const [approvingReq, setApprovingReq] = useState<string | null>(null);
  const [screeningId, setScreeningId] = useState<string | null>(null);
  const [screenResult, setScreenResult] = useState<AiResumeScreen | null>(null);
  const [movingStage, setMovingStage] = useState<string | null>(null);

  // New ATS States
  const [showCreateReq, setShowCreateReq] = useState(false);
  const [newReq, setNewReq] = useState({ title: '', department_id: '', openings: 1, description: '', closing_date: '' });
  const [savingReq, setSavingReq] = useState(false);

  const [showAddCandidate, setShowAddCandidate] = useState(false);
  const [newCand, setNewCand] = useState({ name: '', email: '', phone: '', requisition_id: '', experience_years: 0, skills: '', source: 'Direct' });
  const [savingCand, setSavingCand] = useState(false);

  const [offers, setOffers] = useState<any[]>([]);
  const [showCreateOffer, setShowCreateOffer] = useState<string | null>(null); // Candidate ID
  const [newOffer, setNewOffer] = useState({ offered_ctc: 0, joining_date: '', valid_till: '', terms: '' });
  const [savingOffer, setSavingOffer] = useState(false);

  // ── Onboarding ──
  const [onboardingList, setOnboardingList] = useState<any[]>([]);
  const [expandedOnboarding, setExpandedOnboarding] = useState<string | null>(null);
  const [completingTask, setCompletingTask] = useState<string | null>(null);

  // ── Attendance ──
  const [attMonth, setAttMonth] = useState(5); // June (0-indexed)
  const [attYear, setAttYear] = useState(2026);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [regularizing, setRegularizing] = useState<string | null>(null);

  // ── Leave ──
  const [leaveTab, setLeaveTab] = useState('requests');
  const [leaveRequests, setLeaveRequests] = useState<HrLeave[]>([]);
  const [leaveLoading, setLeaveLoading] = useState<string | null>(null);

  const loadLeave = useCallback(async () => {
    setLoadingView(true);
    try {
      const data: any = await hrmsService.getTeamCalendar({ month: attMonth + 1, year: attYear });
      setLeaveRequests(Array.isArray(data?.leaves) ? data.leaves : []);
    } catch {
      addNotification({ type: 'error', message: 'Failed to load leave data' });
    } finally {
      setLoadingView(false);
    }
  }, [attMonth, attYear, addNotification]);

  // Auto-load handlers for Attendance & Leave
  useEffect(() => {
    if (activeView === 'attendance') {
      setLoadingView(true);
      hrmsService.getAttendanceSummary({ empId: '', month: attMonth + 1, year: attYear })
        .then((d: any) => setAttendanceData(Array.isArray(d) ? d : (d && Array.isArray(d.grid) ? d.grid : [])))
        .catch(() => {})
        .finally(() => setLoadingView(false));
    } else if (activeView === 'leave') {
      loadLeave();
    }
  }, [activeView, attMonth, attYear, loadLeave]);

  // ── Payroll ──
  const [payMonth, setPayMonth] = useState(months[nowDate.getMonth() > 0 ? nowDate.getMonth() - 1 : 11]);
  const [payYear, setPayYear] = useState(nowDate.getMonth() > 0 ? nowDate.getFullYear() : nowDate.getFullYear() - 1);
  const [slips, setSlips] = useState<SalarySlip[]>([]);
  const [runningPayroll, setRunningPayroll] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState<SalarySlip | null>(null);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [pfRegister, setPfRegister] = useState<any[]>([]);
  const [statutoryTab, setStatutoryTab] = useState('pf');
  const [payrollSubTab, setPayrollSubTab] = useState('slips');

  // ── Analytics ──
  const [headcount, setHeadcount] = useState<HrAnalyticsHeadcount | null>(null);
  const [attrition, setAttrition] = useState<HrAnalyticsAttrition | null>(null);
  const [diversity, setDiversity] = useState<any>(null);
  const [payrollCost, setPayrollCost] = useState<any>(null);

  // ── AI Insights ──
  const [attritionPred, setAttritionPred] = useState<AiAttritionPrediction | null>(null);
  const [predLoading, setPredLoading] = useState(false);
  const [flightRiskLoading, setFlightRiskLoading] = useState<string | null>(null);
  const [flightRiskResults, setFlightRiskResults] = useState<Record<string, any>>({});

  // ── Incidents ──
  const [incidents, setIncidents] = useState<HrIncident[]>([]);
  const [incSeverity, setIncSeverity] = useState('');
  const [incStatus, setIncStatus] = useState('');
  const [incidentModal, setIncidentModal] = useState(false);
  const [newIncident, setNewIncident] = useState<Partial<HrIncident>>({ severity: 'Low', status: 'Open' });
  const [savingIncident, setSavingIncident] = useState(false);

  // ── Rewards ──
  const [rewards, setRewards] = useState<HrReward[]>([]);
  const [rewardModal, setRewardModal] = useState(false);
  const [newReward, setNewReward] = useState<Partial<HrReward>>({ reward_type: 'Star Performer', points: 100, is_public: true });
  const [givingReward, setGivingReward] = useState(false);

  // ─── New sub-modules states ───
  // 1. Documents
  const [empDocs, setEmpDocs] = useState<HrEmployeeDocument[]>([]);
  const [selectedDocEmp, setSelectedDocEmp] = useState<string>('');
  const [newDocType, setNewDocType] = useState('Offer Letter');
  const [newDocRemarks, setNewDocRemarks] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // 2. Offboarding
  const [offboardingDetail, setOffboardingDetail] = useState<any>(null);
  const [selectedOffboardEmp, setSelectedOffboardEmp] = useState<string>('');
  const [initiatingOffboard, setInitiatingOffboard] = useState(false);
  const [offboardNoticeDays, setOffboardNoticeDays] = useState(30);
  const [offboardExitDate, setOffboardExitDate] = useState('');
  const [offboardExitType, setOffboardExitType] = useState('Resigned');
  const [offboardNotes, setOffboardNotes] = useState('');
  const [updatingClearance, setUpdatingClearance] = useState(false);

  // 3. Shifts & Holidays
  const [shiftsList, setShiftsList] = useState<HrShift[]>([]);
  const [holidaysList, setHolidaysList] = useState<any[]>([]);
  const [selectedShiftEmp, setSelectedShiftEmp] = useState('');
  const [selectedAssignShift, setSelectedAssignShift] = useState('');
  const [shiftAssigning, setShiftAssigning] = useState(false);
  const [newShift, setNewShift] = useState({ name: '', start_time: '09:00', end_time: '18:00', grace_minutes: 15, is_night_shift: false });
  const [newHoliday, setNewHoliday] = useState({ name: '', date: '', location: '', is_optional: false });
  const [savingShift, setSavingShift] = useState(false);
  const [savingHoliday, setSavingHoliday] = useState(false);

  // 4. Timesheets
  const [timesheetEmp, setTimesheetEmp] = useState('');
  const [timesheetsList, setTimesheetsList] = useState<any[]>([]);
  const [newTimesheet, setNewTimesheet] = useState({ date: '', project: '', task: '', hours: 8, description: '' });
  const [savingTimesheet, setSavingTimesheet] = useState(false);

  // 5. Salary Structures
  const [salaryStructures, setSalaryStructures] = useState<HrSalaryStructure[]>([]);
  const [newSalaryStructure, setNewSalaryStructure] = useState({ name: '', basic_pct: 50, hra_pct: 20, da_pct: 10, special_allowance: 0, grade: 'L2' });
  const [savingSalaryStructure, setSavingSalaryStructure] = useState(false);

  // 6. Statutory Compliance
  const [statutoryPfList, setStatutoryPfList] = useState<any[]>([]);
  const [statutoryEsicList, setStatutoryEsicList] = useState<any[]>([]);
  const [statutoryPtList, setStatutoryPtList] = useState<any[]>([]);
  const [statutoryMonth, setStatutoryMonth] = useState(payMonth);
  const [statutoryYear, setStatutoryYear] = useState(payYear);

  // 7. Reimbursements
  const [reimbursementsList, setReimbursementsList] = useState<HrReimbursementClaim[]>([]);
  const [newReimbursement, setNewReimbursement] = useState({ employee_id: '', category: 'Travel', amount: 0, description: '' });
  const [savingReimbursement, setSavingReimbursement] = useState(false);
  const [reimbursementActionLoading, setReimbursementActionLoading] = useState<string | null>(null);

  // 8. Benefits Management
  const [benefitsPlans, setBenefitsPlans] = useState<any[]>([]);
  const [benefitsEnrollments, setBenefitsEnrollments] = useState<any[]>([]);
  const [selectedEnrollEmp, setSelectedEnrollEmp] = useState('');
  const [selectedEnrollPlan, setSelectedEnrollPlan] = useState('');
  const [enrollPremiumEmployee, setEnrollPremiumEmployee] = useState(1500);
  const [enrollPremiumEmployer, setEnrollPremiumEmployer] = useState(1500);
  const [enrollingBenefit, setEnrollingBenefit] = useState(false);

  // ─── data loaders ─────────────────────────────────────────────────────────
  const loadDashboard = useCallback(async () => {
    setLoadingView(true);
    try {
      const [hc, att] = await Promise.all([
        hrmsService.getHeadcountAnalytics(),
        hrmsService.getAttritionAnalytics(),
      ]);
      setStats({
        total_employees: hc.total || 0,
        active_employees: hc.active || 0,
        on_leave_today: 0,
        new_joiners_month: 0,
        pending_leaves: 0,
        pending_payroll: 0,
        open_positions: 0,
        attrition_rate_ytd: att.overall_rate || 0,
        pending_onboarding: 0,
        open_incidents: 0,
      });
    } catch {
      addNotification({ type: 'error', message: 'Failed to load dashboard stats' });
    } finally {
      setLoadingView(false);
    }
  }, []);

  const loadBriefing = useCallback(async () => {
    setBriefingLoading(true);
    try {
      const b = await hrmsService.aiWeeklyBriefing();
      setBriefing(b);
    } catch {
      addNotification({ type: 'warning', message: 'AI briefing unavailable' });
    } finally {
      setBriefingLoading(false);
    }
  }, []);

  const loadEmployees = useCallback(async () => {
    setLoadingView(true);
    try {
      const [emps, depts] = await Promise.all([
        hrmsService.getEmployees({ search: empSearch, department_id: empDeptFilter, status: empStatusFilter }),
        hrmsService.getDepartments(),
      ]);
      setEmployees(emps);
      setDepartments(depts);
    } catch {
      addNotification({ type: 'error', message: 'Failed to load employees' });
    } finally {
      setLoadingView(false);
    }
  }, [empSearch, empDeptFilter, empStatusFilter]);

  const loadOrgChart = useCallback(async () => {
    setLoadingView(true);
    try {
      const tree = await hrmsService.getDeptTree();
      setDeptTree(Array.isArray(tree) ? tree : [tree]);
    } catch {
      addNotification({ type: 'error', message: 'Failed to load org chart' });
    } finally {
      setLoadingView(false);
    }
  }, []);

  const loadATS = useCallback(async () => {
    setLoadingView(true);
    try {
      const [reqs, cands, offrs] = await Promise.all([
        hrmsService.getRequisitions(),
        hrmsService.getCandidates(),
        hrmsService.getOffers(),
      ]);
      setRequisitions(reqs);
      setCandidates(cands);
      setOffers(offrs);
    } catch {
      addNotification({ type: 'error', message: 'Failed to load ATS data' });
    } finally {
      setLoadingView(false);
    }
  }, [addNotification]);

  const loadPayroll = useCallback(async () => {
    setLoadingView(true);
    try {
      const [s, a] = await Promise.all([
        hrmsService.getPayrollSlips(payMonth, payYear),
        hrmsService.getPayrollAnomalies(),
      ]);
      setSlips(s);
      setAnomalies(Array.isArray(a) ? a : []);
    } catch {
      addNotification({ type: 'error', message: 'Failed to load payroll' });
    } finally {
      setLoadingView(false);
    }
  }, [payMonth, payYear]);

  const loadAnalytics = useCallback(async () => {
    setLoadingView(true);
    try {
      const [hc, att, div, pc] = await Promise.all([
        hrmsService.getHeadcountAnalytics(),
        hrmsService.getAttritionAnalytics(),
        hrmsService.getDiversityAnalytics(),
        hrmsService.getPayrollCostAnalytics(),
      ]);
      setHeadcount(hc);
      setAttrition(att);
      setDiversity(div);
      setPayrollCost(pc);
    } catch {
      addNotification({ type: 'error', message: 'Failed to load analytics' });
    } finally {
      setLoadingView(false);
    }
  }, []);

  const loadIncidents = useCallback(async () => {
    setLoadingView(true);
    try {
      const data = await hrmsService.getIncidents({ severity: incSeverity, status: incStatus });
      setIncidents(data);
    } catch {
      addNotification({ type: 'error', message: 'Failed to load incidents' });
    } finally {
      setLoadingView(false);
    }
  }, [incSeverity, incStatus]);

  const loadRewards = useCallback(async () => {
    setLoadingView(true);
    try {
      const data = await hrmsService.getRewards();
      setRewards(data);
    } catch {
      addNotification({ type: 'error', message: 'Failed to load rewards' });
    } finally {
      setLoadingView(false);
    }
  }, []);

  const loadDocuments = useCallback(async (empId: string) => {
    if (!empId) {
      setEmpDocs([]);
      return;
    }
    setLoadingView(true);
    try {
      const data = await hrmsService.getDocuments(empId);
      setEmpDocs(data);
    } catch {
      addNotification({ type: 'error', message: 'Failed to load documents' });
    } finally {
      setLoadingView(false);
    }
  }, [addNotification]);

  const loadOffboarding = useCallback(async (empId: string) => {
    if (!empId) return;
    setLoadingView(true);
    try {
      const data = await hrmsService.getOffboarding(empId);
      setOffboardingDetail(data);
    } catch {
      setOffboardingDetail(null);
    } finally {
      setLoadingView(false);
    }
  }, [addNotification]);

  const loadShiftsAndHolidays = useCallback(async () => {
    setLoadingView(true);
    try {
      const [s, h] = await Promise.all([
        hrmsService.getShifts(),
        hrmsService.getHolidays(payYear)
      ]) as [any, any];
      setShiftsList(s);
      setHolidaysList(Array.isArray(h) ? h : (h?.data || []));
    } catch {
      addNotification({ type: 'error', message: 'Failed to load shifts and holidays' });
    } finally {
      setLoadingView(false);
    }
  }, [payYear, addNotification]);

  const loadTimesheets = useCallback(async (empId: string) => {
    if (!empId) return;
    setLoadingView(true);
    try {
      const data = await hrmsService.getTimesheets(empId) as any;
      setTimesheetsList(Array.isArray(data) ? data : (data?.data || []));
    } catch {
      addNotification({ type: 'error', message: 'Failed to load timesheets' });
    } finally {
      setLoadingView(false);
    }
  }, [addNotification]);

  // Sync selected employee across modules
  useEffect(() => {
    if (activeView === 'documents' && !selectedDocEmp && selectedEmp) {
      setSelectedDocEmp(selectedEmp.id);
      loadDocuments(selectedEmp.id);
    } else if (activeView === 'offboarding' && !selectedOffboardEmp && selectedEmp) {
      setSelectedOffboardEmp(selectedEmp.id);
      loadOffboarding(selectedEmp.id);
    } else if (activeView === 'timesheets' && !timesheetEmp && selectedEmp) {
      setTimesheetEmp(selectedEmp.id);
      loadTimesheets(selectedEmp.id);
    }
  }, [activeView, selectedEmp, selectedDocEmp, selectedOffboardEmp, timesheetEmp, loadDocuments, loadOffboarding, loadTimesheets]);

  const loadSalaryStructures = useCallback(async () => {
    setLoadingView(true);
    try {
      const data = await hrmsService.getSalaryStructures();
      setSalaryStructures(data);
    } catch {
      addNotification({ type: 'error', message: 'Failed to load salary structures' });
    } finally {
      setLoadingView(false);
    }
  }, [addNotification]);

  const loadStatutoryData = useCallback(async (m: string, y: number) => {
    setLoadingView(true);
    try {
      const [pf, esic, pt] = await Promise.all([
        hrmsService.getPfRegister(m, y),
        hrmsService.getEsicRegister(m, y),
        hrmsService.getPtRegister(m, y)
      ]) as [any, any, any];
      setStatutoryPfList(pf);
      setStatutoryEsicList(Array.isArray(esic) ? esic : (esic?.data || []));
      setStatutoryPtList(Array.isArray(pt) ? pt : (pt?.data || []));
    } catch {
      addNotification({ type: 'error', message: 'Failed to load statutory compliance data' });
    } finally {
      setLoadingView(false);
    }
  }, [addNotification]);

  const loadReimbursements = useCallback(async () => {
    setLoadingView(true);
    try {
      const data = await hrmsService.getReimbursements();
      setReimbursementsList(data);
    } catch {
      addNotification({ type: 'error', message: 'Failed to load reimbursements' });
    } finally {
      setLoadingView(false);
    }
  }, [addNotification]);

  const loadBenefits = useCallback(async () => {
    setLoadingView(true);
    try {
      const [plans, enrolls] = await Promise.all([
        hrmsService.getBenefitsPlans(),
        hrmsService.getBenefitsEnrollments()
      ]) as [any[], any[]];
      setBenefitsPlans(plans);
      setBenefitsEnrollments(enrolls);
    } catch {
      addNotification({ type: 'error', message: 'Failed to load benefits from database' });
    } finally {
      setLoadingView(false);
    }
  }, [addNotification]);

  useEffect(() => {
    if (activeView === 'dashboard') { loadDashboard(); loadBriefing(); }
    else if (activeView === 'employees') loadEmployees();
    else if (activeView === 'organization') loadOrgChart();
    else if (activeView === 'recruitment') loadATS();
    else if (activeView === 'payroll') loadPayroll();
    // Use local statutory data sync
    else if (activeView === 'statutory') loadStatutoryData(statutoryMonth, statutoryYear);
    else if (activeView === 'analytics') loadAnalytics();
    else if (activeView === 'incidents') loadIncidents();
    else if (activeView === 'rewards') loadRewards();
    else if (activeView === 'leave') { 
      loadLeave(); 
      hrmsService.getEmployees({ status: 'Active' }).then(setEmployees); 
    }
    else if (activeView === 'documents') { loadEmployees(); if (selectedDocEmp) loadDocuments(selectedDocEmp); }
    else if (activeView === 'offboarding') { loadEmployees(); if (selectedOffboardEmp) loadOffboarding(selectedOffboardEmp); }
    else if (activeView === 'shifts') loadShiftsAndHolidays();
    else if (activeView === 'timesheets') { loadEmployees(); if (timesheetEmp) loadTimesheets(timesheetEmp); }
    else if (activeView === 'salary') loadSalaryStructures();
    else if (activeView === 'reimbursements') { loadEmployees(); loadReimbursements(); }
    else if (activeView === 'benefits') { loadEmployees(); loadBenefits(); }
  }, [activeView, selectedDocEmp, selectedOffboardEmp, timesheetEmp, statutoryMonth, statutoryYear]);

  // ─── sidebar items ────────────────────────────────────────────────────────
  const nav = (id: string, label: string, icon: React.ReactNode, group: string) => ({
    id, label, icon, group, isActive: activeView === id, onClick: () => setActiveView(id),
  });

  const sidebarItems = [
    nav('dashboard', 'Dashboard', <LayoutDashboard size={14} />, 'Core HR'),
    nav('employees', 'Employees', <Users size={14} />, 'Core HR'),
    nav('organization', 'Organization', <Building2 size={14} />, 'Core HR'),
    nav('documents', 'Documents', <FileText size={14} />, 'Core HR'),
    nav('recruitment', 'Recruitment / ATS', <UserPlus size={14} />, 'Talent'),
    nav('onboarding', 'Onboarding', <ClipboardCheck size={14} />, 'Talent'),
    nav('offboarding', 'Offboarding', <LogOut size={14} />, 'Talent'),
    nav('attendance', 'Attendance', <Clock size={14} />, 'Time & Leave'),
    nav('leave', 'Leave Management', <Calendar size={14} />, 'Time & Leave'),
    nav('shifts', 'Shifts & Holidays', <Sun size={14} />, 'Time & Leave'),
    nav('timesheets', 'Timesheets', <Timer size={14} />, 'Time & Leave'),
    nav('payroll', 'Payroll', <IndianRupee size={14} />, 'Payroll'),
    nav('salary', 'Salary Structures', <BarChart2 size={14} />, 'Payroll'),
    nav('statutory', 'Statutory', <Shield size={14} />, 'Payroll'),
    nav('reimbursements', 'Reimbursements', <Receipt size={14} />, 'Payroll'),
    nav('incidents', 'Incidents', <AlertTriangle size={14} />, 'People'),
    nav('rewards', 'Rewards', <Award size={14} />, 'People'),
    nav('benefits', 'Benefits', <Heart size={14} />, 'People'),
    nav('analytics', 'Analytics', <TrendingUp size={14} />, 'Intelligence'),
    nav('aiinsights', 'AI Insights', <Brain size={14} />, 'Intelligence'),
    nav('copilot', 'AI Copilot', <MessageSquare size={14} />, 'Intelligence'),
  ];

  // ─── action handlers ──────────────────────────────────────────────────────
  const handleApproveReq = async (id: string) => {
    setApprovingReq(id);
    try {
      await hrmsService.approveRequisition(id);
      addNotification({ type: 'success', message: 'Requisition approved' });
      setRequisitions(r => r.map(x => x.id === id ? { ...x, status: 'Approved' as any } : x));
    } catch {
      addNotification({ type: 'error', message: 'Failed to approve requisition' });
    } finally {
      setApprovingReq(null);
    }
  };

  const handleAiScreen = async (id: string) => {
    setScreeningId(id);
    try {
      const res = await hrmsService.aiScreenCandidate(id);
      setScreenResult(res);
    } catch {
      addNotification({ type: 'error', message: 'AI screening failed' });
    } finally {
      setScreeningId(null);
    }
  };

  const handleMoveStage = async (id: string, stage: string) => {
    setMovingStage(id);
    try {
      await hrmsService.moveCandidateStage(id, { stage });
      setCandidates(c => c.map(x => x.id === id ? { ...x, stage: stage as any } : x));
      addNotification({ type: 'success', message: `Moved to ${stage}` });
    } catch {
      addNotification({ type: 'error', message: 'Failed to move stage' });
    } finally {
      setMovingStage(null);
    }
  };

  const handleRunPayroll = async () => {
    if (!window.confirm(`Run payroll for ${payMonth} ${payYear}?`)) return;
    setRunningPayroll(true);
    try {
      const res: any = await hrmsService.processBulkPayroll(payMonth, payYear);
      addNotification({ type: 'success', message: `Payroll processed: ${res?.slipsProcessed || 0} slips, ${res?.anomalies || 0} anomalies` });
      loadPayroll();
    } catch {
      addNotification({ type: 'error', message: 'Payroll processing failed' });
    } finally {
      setRunningPayroll(false);
    }
  };

  const handleMarkPaid = async (id: string) => {
    setMarkingPaid(true);
    try {
      await hrmsService.markSlipPaid(id);
      addNotification({ type: 'success', message: 'Slip marked as paid' });
      setSlips(s => s.map(x => x.id === id ? { ...x, status: 'Paid' } : x));
      setSelectedSlip(null);
    } catch {
      addNotification({ type: 'error', message: 'Failed to mark as paid' });
    } finally {
      setMarkingPaid(false);
    }
  };

  const handleApproveLeave = async (id: string) => {
    setLeaveLoading(id);
    try {
      await hrmsService.approveLeave(id);
      addNotification({ type: 'success', message: 'Leave approved' });
      setLeaveRequests(l => l.map(x => x.id === id ? { ...x, status: 'Approved' } : x));
      // Automate attendance refresh to reflect the new leave
      if (attendanceData.length > 0) {
        hrmsService.getAttendanceSummary({ empId: '', month: attMonth + 1, year: attYear })
          .then((d: any) => setAttendanceData(Array.isArray(d) ? d : (d && Array.isArray(d.grid) ? d.grid : [])));
      }
    } catch {
      addNotification({ type: 'error', message: 'Failed to approve leave' });
    } finally {
      setLeaveLoading(null);
    }
  };

  const handleRejectLeave = async (id: string) => {
    setLeaveLoading(id);
    try {
      await hrmsService.rejectLeave(id, 'Rejected by HR');
      addNotification({ type: 'info', message: 'Leave rejected' });
      setLeaveRequests(l => l.map(x => x.id === id ? { ...x, status: 'Rejected' } : x));
    } catch {
      addNotification({ type: 'error', message: 'Failed to reject leave' });
    } finally {
      setLeaveLoading(null);
    }
  };

  const handleCreateIncident = async () => {
    setSavingIncident(true);
    try {
      await hrmsService.createIncident(newIncident);
      addNotification({ type: 'success', message: 'Incident reported' });
      setIncidentModal(false);
      setNewIncident({ severity: 'Low', status: 'Open' });
      loadIncidents();
    } catch {
      addNotification({ type: 'error', message: 'Failed to create incident' });
    } finally {
      setSavingIncident(false);
    }
  };

  const handleGiveReward = async () => {
    setGivingReward(true);
    try {
      await hrmsService.giveReward(newReward);
      addNotification({ type: 'success', message: 'Recognition given!' });
      setRewardModal(false);
      setNewReward({ reward_type: 'Star Performer', points: 100, is_public: true });
      loadRewards();
    } catch {
      addNotification({ type: 'error', message: 'Failed to give reward' });
    } finally {
      setGivingReward(false);
    }
  };

  const handleAttritionPredict = async () => {
    setPredLoading(true);
    try {
      const res = await hrmsService.aiPredictAttrition();
      setAttritionPred(res);
    } catch {
      addNotification({ type: 'error', message: 'AI prediction failed' });
    } finally {
      setPredLoading(false);
    }
  };

  const handleFlightRisk = async (empId: string) => {
    setFlightRiskLoading(empId);
    try {
      const res = await hrmsService.aiFlightRisk(empId);
      setFlightRiskResults(r => ({ ...r, [empId]: res }));
      addNotification({ type: 'info', message: 'Flight risk assessed' });
    } catch {
      addNotification({ type: 'error', message: 'Flight risk assessment failed' });
    } finally {
      setFlightRiskLoading(null);
    }
  };

  const loadStatutory = async (tab: string) => {
    setStatutoryTab(tab);
    try {
      if (tab === 'pf') {
        const d = await hrmsService.getPfRegister(payMonth, payYear);
        setPfRegister(d);
      }
    } catch {
      addNotification({ type: 'error', message: 'Failed to load statutory register' });
    }
  };

  // ─── filtered employees ───────────────────────────────────────────────────
  const filteredEmps = useMemo(() => employees.filter(e => {
    const q = empSearch.toLowerCase();
    const matchSearch = !q || `${e.first_name} ${e.last_name} ${e.employee_code}`.toLowerCase().includes(q);
    const matchStatus = !empStatusFilter || e.status === empStatusFilter;
    const matchDept = !empDeptFilter || e.department_id === empDeptFilter;
    return matchSearch && matchStatus && matchDept;
  }), [employees, empSearch, empStatusFilter, empDeptFilter]);

  const candidatesByStage = useMemo(() =>
    STAGES.reduce((acc, s) => ({ ...acc, [s]: candidates.filter(c => c.stage === s) }), {} as Record<string, HrCandidate[]>),
    [candidates]);

  // ─── color helpers ────────────────────────────────────────────────────────
  const attColor: Record<string, string> = {
    Present: 'bg-green-100 text-green-700',
    Absent: 'bg-red-100 text-red-700',
    Leave: 'bg-yellow-100 text-yellow-700',
    Holiday: 'bg-purple-100 text-purple-700',
    WFH: 'bg-blue-100 text-blue-700',
    'Half Day': 'bg-orange-100 text-orange-700',
    Late: 'bg-amber-100 text-amber-700',
  };

  const severityVariant: Record<string, string> = {
    Low: 'success', Medium: 'warning', High: 'error', Critical: 'error',
  };

  const CHART_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

  // ─── views ────────────────────────────────────────────────────────────────

  const renderDashboard = () => (
    <div className="space-y-6 p-4">
      {/* Stats band */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Total Employees" value={stats?.total_employees ?? '—'} icon={<Users size={18} />} color="indigo" />
        <StatCard label="Active" value={stats?.active_employees ?? '—'} icon={<CheckCircle size={18} />} color="green" />
        <StatCard label="On Leave Today" value={stats?.on_leave_today ?? '—'} icon={<Calendar size={18} />} color="yellow" />
        <StatCard label="New Joiners (Month)" value={stats?.new_joiners_month ?? '—'} icon={<UserPlus size={18} />} color="blue" />
        <StatCard label="Pending Leaves" value={stats?.pending_leaves ?? '—'} icon={<Clock size={18} />} color="orange" />
        <StatCard label="Open Positions" value={stats?.open_positions ?? '—'} icon={<UserPlus size={18} />} color="purple" />
        <StatCard label="Attrition Rate YTD" value={stats ? `${stats.attrition_rate_ytd?.toFixed(1)}%` : '—'} icon={<TrendingUp size={18} />} color="red" />
        <StatCard label="Open Incidents" value={stats?.open_incidents ?? '—'} icon={<AlertTriangle size={18} />} color="red" />
      </div>

      {/* AI Briefing */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-indigo-800 flex items-center gap-2"><Brain size={16} /> AI Weekly Briefing</div>
          <button onClick={loadBriefing} disabled={briefingLoading}
            className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 disabled:opacity-50">
            {briefingLoading ? <Spinner /> : <RefreshCw size={12} />} Refresh
          </button>
        </div>
        {briefingLoading && <div className="flex justify-center py-4"><Spinner /></div>}
        {briefing && !briefingLoading && (
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div className="col-span-3 text-slate-700 leading-relaxed bg-white/60 rounded-lg p-3">{briefing.executiveSummary}</div>
            <div>
              <div className="font-semibold text-slate-600 mb-2 uppercase text-[10px] tracking-wide">Priority Actions</div>
              <ul className="space-y-1">
                {briefing.priorityActions?.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-slate-600">
                    <CheckSquare size={12} className="text-indigo-500 mt-0.5 shrink-0" />{a}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="font-semibold text-red-600 mb-2 uppercase text-[10px] tracking-wide">Risk Flags</div>
              <ul className="space-y-1">
                {briefing.riskFlags?.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-red-600">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />{r}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="font-semibold text-green-600 mb-2 uppercase text-[10px] tracking-wide">Celebrations</div>
              <ul className="space-y-1">
                {briefing.celebrations?.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-green-600">
                    <Award size={12} className="mt-0.5 shrink-0" />{c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {!briefing && !briefingLoading && (
          <div className="text-center py-4 text-slate-400 text-xs">Click Refresh to load AI briefing</div>
        )}
      </div>
    </div>
  );

  const renderEmployees = () => (
    <div className="p-4 space-y-4">
      <FilterBar
        filters={[
          { type: 'search', key: 'search', placeholder: 'Search employees...', value: empSearch, onChange: setEmpSearch },
          { type: 'select', key: 'status', label: 'Status', value: empStatusFilter, onChange: setEmpStatusFilter,
            options: [{ value: '', label: 'All Status' }, { value: 'Active', label: 'Active' }, { value: 'On Leave', label: 'On Leave' }, { value: 'Inactive', label: 'Inactive' }] },
          { type: 'select', key: 'dept', label: 'Department', value: empDeptFilter, onChange: setEmpDeptFilter,
            options: [{ value: '', label: 'All Departments' }, ...departments.map(d => ({ value: d.id, label: d.name }))] },
        ]}
        onRefresh={loadEmployees}
      />
      <DataTable
        columns={[
          { key: 'employee_code', label: 'Code', width: 90 },
          { key: 'name', label: 'Name', render: (_, r: HrEmployee) => r.name },
          { key: 'department_name', label: 'Department' },
          { key: 'designation_name', label: 'Designation' },
          { key: 'grade', label: 'Grade', width: 70 },
          { key: 'status', label: 'Status', render: (_, r: HrEmployee) => (
            <Badge value={r.status || 'Active'} variant={r.status === 'Active' ? 'success' : r.status === 'On Leave' ? 'warning' : 'default'} />
          )},
          { key: 'join_date', label: 'Join Date', width: 100, render: (v) => v ? new Date(v).toLocaleDateString() : '—' },
           { key: 'actions', label: 'Actions', render: (_, r: HrEmployee) => (
             <div className="flex gap-1">
               <button onClick={() => setSelectedEmp(r)} className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded"><Eye size={13} /></button>
               <button onClick={() => { setSelectedEmp(r); /* optional: set default tab or edit mode */ }} className="p-1.5 hover:bg-slate-50 text-slate-500 rounded"><Edit2 size={13} /></button>
             </div>
           )},
        ]}
        data={filteredEmps}
        loading={loadingView}
        emptyMessage="No employees found"
      />
      {selectedEmp && (
        <ProfileDrawer emp={selectedEmp} onClose={() => setSelectedEmp(null)} addNotification={addNotification} />
      )}
    </div>
  );

  const renderOrganization = () => (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-slate-700">Organization Chart</h3>
        <button onClick={loadOrgChart} className="text-xs text-indigo-600 flex items-center gap-1"><RefreshCw size={12} /> Refresh</button>
      </div>
      {loadingView ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="overflow-auto pb-8">
          <div className="flex gap-8 pt-4 min-w-max">
            {deptTree.map(dept => <OrgNode key={dept.id} dept={dept} />)}
          </div>
        </div>
      )}
    </div>
  );

  const [atsSearch, setAtsSearch] = useState('');
  const renderATS = () => {
    const filteredReqs = requisitions.filter(r => 
      r.title.toLowerCase().includes(atsSearch.toLowerCase()) || 
      r.department_name?.toLowerCase().includes(atsSearch.toLowerCase())
    );
    const filteredCandidates = candidates.filter(c => 
      c.name.toLowerCase().includes(atsSearch.toLowerCase()) || 
      c.applied_for?.toLowerCase().includes(atsSearch.toLowerCase()) ||
      c.requisition_title?.toLowerCase().includes(atsSearch.toLowerCase())
    );

    const candidatesByStage = STAGES.reduce((acc, stage) => {
      acc[stage] = candidates.filter(c => c.stage === stage);
      return acc;
    }, {} as Record<string, HrCandidate[]>);

    return (
      <div className="p-4 space-y-4 animate-fadeIn">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <Tabs
            tabs={['requisitions', 'pipeline', 'candidates', 'offers'].map(t => ({
              id: t, label: t.charAt(0).toUpperCase() + t.slice(1),
            }))}
            activeTab={atsTab}
            onChange={setAtsTab}
          />
          <div className="flex items-center gap-3">
            <FilterBar 
              searchPlaceholder={`Search ${atsTab}...`}
              searchValue={atsSearch}
              onSearchChange={setAtsSearch}
            />
            <div className="flex gap-2">
              {atsTab === 'requisitions' && (
                <button
                  onClick={() => setShowCreateReq(true)}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-[11px] font-bold uppercase tracking-wider rounded-lg hover:bg-indigo-700 flex items-center gap-2 shadow-lg transition-all"
                >
                  <Plus size={14} /> New Requisition
                </button>
              )}
              {atsTab === 'candidates' && (
                <button
                  onClick={() => setShowAddCandidate(true)}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-[11px] font-bold uppercase tracking-wider rounded-lg hover:bg-indigo-700 flex items-center gap-2 shadow-lg transition-all"
                >
                  <UserPlus size={14} /> Add Candidate
                </button>
              )}
            </div>
          </div>
        </div>

        {atsTab === 'requisitions' && (
          <DataTable
            columns={[
              { key: 'title', label: 'Job Title' },
              { key: 'department_name', label: 'Department' },
              { key: 'positions', label: 'Vacancies', width: '15%', render: (v, r: any) => `${r.filled_count || 0} / ${v}` },
              { key: 'status', label: 'Status', width: '15%', render: (_, r: HrJobRequisition) => (
                <Badge value={r.status} variant={r.status === 'Approved' ? 'success' : r.status === 'Filled' ? 'info' : r.status === 'Pending Approval' ? 'warning' : 'default'} />
              )},
              { key: 'actions', label: 'Actions', width: '15%', align: 'right', render: (_, r: HrJobRequisition) => (
                <div className="flex justify-end gap-1.5">
                  {r.status === 'Pending Approval' && (
                    <button onClick={() => handleApproveReq(r.id)} disabled={approvingReq === r.id}
                      className="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors" title="Approve">
                      {approvingReq === r.id ? <Spinner /> : <CheckCircle size={14} />}
                    </button>
                  )}
                  <button className="p-1.5 hover:bg-slate-100 text-slate-400 rounded"><Eye size={14} /></button>
                </div>
              )},
            ]}
            data={filteredReqs}
            loading={loadingView}
            emptyMessage="No job requisitions found. Create one to start hiring."
          />
        )}

        {atsTab === 'pipeline' && (
          <div className="flex gap-4 overflow-x-auto pb-6 custom-scrollbar min-h-[500px]">
            {STAGES.filter(s => s !== 'Rejected' && s !== 'Withdrawn').map(stage => (
              <div key={stage} className="min-w-[280px] bg-slate-50/50 border border-slate-200/60 rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-tighter">{stage}</span>
                  <span className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded-full font-bold text-slate-500 shadow-sm">
                    {candidatesByStage[stage]?.length || 0}
                  </span>
                </div>
                <div className="space-y-3 flex-1">
                  {candidatesByStage[stage]?.filter(c => 
                    c.name.toLowerCase().includes(atsSearch.toLowerCase())
                  ).map(c => (
                    <div key={c.id} className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex justify-between items-start">
                        <div className="font-bold text-xs text-slate-800">{c.name}</div>
                        {c.ai_score != null && (
                          <div className={`text-[10px] font-black px-1.5 py-0.5 rounded ${c.ai_score > 80 ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700'}`}>
                            {c.ai_score}%
                          </div>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-medium">{c.requisition_title || 'Direct Application'}</div>
                      
                      <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between">
                        <div className="flex -space-x-1.5">
                          <div className="w-5 h-5 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-slate-400">?</div>
                        </div>
                        <select 
                          onChange={e => handleMoveStage(c.id, e.target.value)} 
                          value={c.stage}
                          disabled={movingStage === c.id}
                          className="bg-slate-50 border-none text-[9px] font-bold uppercase tracking-wider text-slate-500 rounded-lg px-2 py-1 focus:ring-0 cursor-pointer hover:bg-slate-100 transition-colors"
                        >
                          {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                  ))}
                  {(!candidatesByStage[stage] || candidatesByStage[stage].length === 0) && (
                    <div className="h-24 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center">
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Empty</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {atsTab === 'candidates' && (
          <DataTable
            columns={[
              { key: 'name', label: 'Candidate', render: (v, r: HrCandidate) => (
                <div className="flex flex-col">
                  <span className="font-bold text-slate-800">{v}</span>
                  <span className="text-[10px] text-slate-400">{r.email}</span>
                </div>
              )},
              { key: 'requisition_title', label: 'Role', render: (v) => v || 'Direct Application' },
              { key: 'stage', label: 'Stage', render: (_, r: HrCandidate) => <Badge value={r.stage} variant="info" /> },
              { key: 'ai_score', label: 'AI Score', width: '15%', render: (_, r: HrCandidate) => (
                r.ai_score != null ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${r.ai_score > 80 ? 'bg-green-500' : 'bg-indigo-500'}`} style={{ width: `${r.ai_score}%` }} />
                    </div>
                    <span className="text-[11px] font-black text-slate-700">{r.ai_score}%</span>
                  </div>
                ) : <span className="text-slate-400 text-xs">—</span>
              )},
              { key: 'actions', label: 'Actions', width: '20%', align: 'right', render: (_, r: HrCandidate) => (
                <div className="flex justify-end gap-1.5">
                  <button onClick={() => handleAiScreen(r.id)} disabled={screeningId === r.id}
                    className="p-1.5 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition-colors" title="AI Screen">
                    {screeningId === r.id ? <Spinner /> : <Brain size={14} />}
                  </button>
                  {r.stage === 'Offered' && (
                    <button onClick={async () => {
                      if (!window.confirm(`Hire ${r.name} and convert to employee?`)) return;
                      setMovingStage(r.id);
                      try {
                        await hrmsService.hireCandidate(r.id);
                        addNotification({ type: 'success', message: `${r.name} hired successfully!` });
                        loadEmployees();
                        loadATS();
                      } catch {
                        addNotification({ type: 'error', message: 'Hiring process failed' });
                      } finally {
                        setMovingStage(null);
                      }
                    }} disabled={movingStage === r.id}
                    className="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors" title="Hire">
                      {movingStage === r.id ? <Spinner /> : <CheckCircle size={14} />}
                    </button>
                  )}
                  {r.stage === 'HR Round' && (
                    <button onClick={() => setShowCreateOffer(r.id)}
                      className="p-1.5 bg-amber-50 text-amber-600 rounded hover:bg-amber-100 transition-colors" title="Generate Offer">
                      <FilePlus size={14} />
                    </button>
                  )}
                </div>
              )},
            ]}
            data={filteredCandidates}
            loading={loadingView}
            emptyMessage="No candidates matching filters."
          />
        )}

        {atsTab === 'offers' && (
          <DataTable
            columns={[
              { key: 'candidate_name', label: 'Candidate' },
              { key: 'offered_ctc', label: 'CTC', render: (v) => inr(v) },
              { key: 'joining_date', label: 'Joining Date', render: (v) => new Date(v).toLocaleDateString() },
              { key: 'status', label: 'Status', render: (v) => <Badge value={v} variant={v === 'Accepted' ? 'success' : v === 'Declined' ? 'error' : 'warning'} /> },
              { key: 'actions', label: 'Actions', align: 'right', render: (_, r: any) => (
                <div className="flex justify-end gap-1.5">
                  <button className="p-1.5 hover:bg-slate-100 text-slate-400 rounded"><Download size={14} /></button>
                  {r.status === 'Sent' && (
                    <div className="flex gap-1">
                      <button onClick={async () => {
                        await hrmsService.updateOffer(r.id, { status: 'Accepted' });
                        addNotification({ type: 'success', message: 'Offer Accepted' });
                        loadATS();
                      }} className="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100"><CheckCircle size={14} /></button>
                      <button onClick={async () => {
                        await hrmsService.updateOffer(r.id, { status: 'Declined' });
                        addNotification({ type: 'error', message: 'Offer Declined' });
                        loadATS();
                      }} className="p-1.5 bg-rose-50 text-rose-600 rounded hover:bg-rose-100"><X size={14} /></button>
                    </div>
                  )}
                </div>
              )}
            ]}
            data={offers}
            loading={loadingView}
            emptyMessage="No active offers found."
          />
        )}

        {/* Create Requisition Modal */}
        <Modal isOpen={showCreateReq} title="Raise New Job Requisition" onClose={() => setShowCreateReq(false)} size="md">
          <form className="space-y-4" onSubmit={async (e) => {
            e.preventDefault();
            setSavingReq(true);
            try {
              await hrmsService.createRequisition(newReq);
              addNotification({ type: 'success', message: 'Requisition raised' });
              setShowCreateReq(false);
              loadATS();
            } catch {
              addNotification({ type: 'error', message: 'Failed to create' });
            } finally {
              setSavingReq(false);
            }
          }}>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Job Title</label>
                <input type="text" required value={newReq.title} onChange={e => setNewReq({...newReq, title: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none" placeholder="e.g. Senior Product Manager" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Department</label>
                <select value={newReq.department_id} onChange={e => setNewReq({...newReq, department_id: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs bg-slate-50 outline-none">
                  <option value="">— Select —</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Vacancies</label>
                <input type="number" value={newReq.openings} onChange={e => setNewReq({...newReq, openings: Number(e.target.value)})} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs bg-slate-50 outline-none" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Description / Requirements</label>
              <textarea rows={4} value={newReq.description} onChange={e => setNewReq({...newReq, description: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs bg-slate-50 outline-none resize-none" placeholder="Enter key responsibilities and required skills..." />
            </div>
            <button type="submit" disabled={savingReq} className="w-full py-3 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 shadow-lg transition-all disabled:opacity-50">
              {savingReq ? <Spinner /> : 'Raise Requisition'}
            </button>
          </form>
        </Modal>

        {/* Add Candidate Modal */}
        <Modal isOpen={showAddCandidate} title="Register New Candidate" onClose={() => setShowAddCandidate(false)} size="md">
          <form className="space-y-4" onSubmit={async (e) => {
            e.preventDefault();
            setSavingCand(true);
            try {
              await hrmsService.createCandidate(newCand);
              addNotification({ type: 'success', message: 'Candidate registered' });
              setShowAddCandidate(false);
              loadATS();
            } catch {
              addNotification({ type: 'error', message: 'Registration failed' });
            } finally {
              setSavingCand(false);
            }
          }}>
             <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Applied For (Requisition)</label>
              <select required value={newCand.requisition_id} onChange={e => setNewCand({...newCand, requisition_id: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs bg-slate-50 outline-none">
                <option value="">— Direct / General Pool —</option>
                {requisitions.filter(r => r.status === 'Approved' || r.status === 'Open').map(r => <option key={r.id} value={r.id}>{r.title} ({r.department_name})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                <input type="text" required value={newCand.name} onChange={e => setNewCand({...newCand, name: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs bg-slate-50 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email</label>
                <input type="email" required value={newCand.email} onChange={e => setNewCand({...newCand, email: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs bg-slate-50 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Phone</label>
                <input type="text" required value={newCand.phone} onChange={e => setNewCand({...newCand, phone: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs bg-slate-50 outline-none" />
              </div>
            </div>
            <button type="submit" disabled={savingCand} className="w-full py-3 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 shadow-lg transition-all disabled:opacity-50">
              {savingCand ? <Spinner /> : 'Register Candidate'}
            </button>
          </form>
        </Modal>

        {/* Generate Offer Modal */}
        <Modal isOpen={!!showCreateOffer} title="Generate Employment Offer" onClose={() => setShowCreateOffer(null)} size="sm">
          <form className="space-y-4" onSubmit={async (e) => {
            e.preventDefault();
            if (!showCreateOffer) return;
            setSavingOffer(true);
            try {
              await hrmsService.createOffer(showCreateOffer, newOffer);
              await hrmsService.moveCandidateStage(showCreateOffer, { stage: 'Offered' });
              addNotification({ type: 'success', message: 'Offer letter generated & sent' });
              setShowCreateOffer(null);
              loadATS();
            } catch {
              addNotification({ type: 'error', message: 'Failed to generate offer' });
            } finally {
              setSavingOffer(false);
            }
          }}>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Offered Annual CTC (INR)</label>
              <input type="number" required value={newOffer.offered_ctc} onChange={e => setNewOffer({...newOffer, offered_ctc: Number(e.target.value)})} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-indigo-700 bg-slate-50 outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Joining Date</label>
                <input type="date" required value={newOffer.joining_date} onChange={e => setNewOffer({...newOffer, joining_date: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs bg-slate-50 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Offer Validity</label>
                <input type="date" required value={newOffer.valid_till} onChange={e => setNewOffer({...newOffer, valid_till: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs bg-slate-50 outline-none" />
              </div>
            </div>
            <button type="submit" disabled={savingOffer} className="w-full py-3 bg-amber-600 text-white font-black uppercase tracking-widest rounded-xl hover:bg-amber-700 shadow-lg transition-all">
              {savingOffer ? <Spinner /> : 'Generate & Send Offer'}
            </button>
          </form>
        </Modal>

        {screenResult && (
          <Modal isOpen title="AI Resume Screening Result" onClose={() => setScreenResult(null)}>
            <div className="space-y-4 text-xs">
              <div>
                <div className="flex justify-between mb-1"><span className="font-semibold">Fit Score</span><span className="text-indigo-600 font-bold">{screenResult.fitScore}/100</span></div>
                <div className="w-full bg-slate-100 rounded-full h-3">
                  <div className="bg-indigo-500 h-3 rounded-full transition-all" style={{ width: `${screenResult.fitScore}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="font-semibold text-green-700 mb-1">Strengths</div>
                  <ul className="space-y-1">{screenResult.strengths.map((s, i) => <li key={i} className="text-green-600 flex gap-1"><CheckCircle size={11} className="mt-0.5 shrink-0" />{s}</li>)}</ul>
                </div>
                <div>
                  <div className="font-semibold text-red-600 mb-1">Gaps</div>
                  <ul className="space-y-1">{screenResult.gaps.map((g, i) => <li key={i} className="text-red-500 flex gap-1"><Circle size={11} className="mt-0.5 shrink-0" />{g}</li>)}</ul>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <span className="font-semibold">Recommendation:</span>
                <Badge value={screenResult.recommendation}
                  variant={screenResult.recommendation === 'Shortlist' ? 'success' : screenResult.recommendation === 'Reject' ? 'error' : 'warning'} />
                <span className="text-slate-600">{screenResult.reason}</span>
              </div>
            </div>
          </Modal>
        )}
      </div>
    );
  };


  const loadActiveOnboardings = async () => {
    setLoadingView(true);
    try {
      const data = await hrmsService.getActiveOnboardings();
      setOnboardingList(Array.isArray(data) ? data : []);
    } catch {
      addNotification({ type: 'error', message: 'Failed to load onboarding checklists' });
    } finally {
      setLoadingView(false);
    }
  };

  const CATEGORY_COLORS: Record<string, string> = {
    Documentation: 'bg-blue-100 text-blue-700',
    'IT Setup': 'bg-purple-100 text-purple-700',
    Training: 'bg-amber-100 text-amber-700',
    Orientation: 'bg-teal-100 text-teal-700',
    Finance: 'bg-green-100 text-green-700',
    Benefits: 'bg-pink-100 text-pink-700',
    Policy: 'bg-orange-100 text-orange-700',
    Communication: 'bg-cyan-100 text-cyan-700',
    Review: 'bg-slate-100 text-slate-700',
    General: 'bg-slate-100 text-slate-500',
  };

  const renderOnboarding = () => (
    <div className="p-4 space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-slate-700">Active Onboarding</h3>
        <button
          onClick={loadActiveOnboardings}
          disabled={loadingView}
          className="text-xs text-indigo-600 flex items-center gap-1 disabled:opacity-50"
        >
          <RefreshCw size={12} className={loadingView ? 'animate-spin' : ''} /> Load
        </button>
      </div>

      {loadingView && <div className="flex justify-center py-8"><Spinner /></div>}

      {!loadingView && onboardingList.map((checklist: HrOnboardingChecklist) => {
        const total = checklist.tasks?.length || 0;
        const done = checklist.tasks?.filter((t: any) => t.status === 'Completed' || t.status === 'Skipped').length || 0;
        const pct = total ? Math.round((done / total) * 100) : 0;
        const isOverdue = checklist.status === 'Overdue';

        return (
          <div
            key={checklist.id}
            className={`bg-white border rounded-xl p-4 ${isOverdue ? 'border-red-300' : 'border-slate-200'}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                  {checklist.employee_name || 'Unknown Employee'}
                  {(checklist as any).employee_code && (
                    <span className="text-[10px] text-slate-400 font-normal">{(checklist as any).employee_code}</span>
                  )}
                  {isOverdue && (
                    <span className="text-[10px] bg-red-100 text-red-600 font-semibold px-1.5 py-0.5 rounded">Overdue</span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Started {checklist.start_date
                    ? new Date(checklist.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                    : new Date((checklist as any).created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className={`text-xs font-semibold ${pct === 100 ? 'text-green-600' : isOverdue ? 'text-red-600' : 'text-indigo-600'}`}>
                    {pct}% Complete
                  </div>
                  <div className="text-[10px] text-slate-400">{done}/{total} tasks</div>
                </div>
                <button
                  onClick={() => setExpandedOnboarding(expandedOnboarding === checklist.id ? null : checklist.id)}
                  className="p-1 hover:bg-slate-50 rounded"
                >
                  <ChevronRight
                    size={16}
                    className={`transition-transform ${expandedOnboarding === checklist.id ? 'rotate-90' : ''}`}
                  />
                </button>
              </div>
            </div>

            <div className="mt-2 w-full bg-slate-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${pct === 100 ? 'bg-green-500' : isOverdue ? 'bg-red-400' : 'bg-indigo-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>

            {expandedOnboarding === checklist.id && (
              <div className="mt-3 space-y-2">
                {checklist.tasks?.map((task: any) => {
                  const isTaskOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status === 'Pending';
                  return (
                    <div
                      key={task.id}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                        task.status === 'Completed' ? 'bg-green-50' : isTaskOverdue ? 'bg-red-50' : 'bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {task.status === 'Completed'
                          ? <CheckCircle size={14} className="text-green-500 shrink-0" />
                          : <Circle size={14} className={`shrink-0 ${isTaskOverdue ? 'text-red-300' : 'text-slate-300'}`} />}
                        <div className="min-w-0">
                          <div className={`text-xs font-medium truncate ${task.status === 'Completed' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                            {task.title || task.task_name}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${CATEGORY_COLORS[task.category] || CATEGORY_COLORS.General}`}>
                              {task.category || 'General'}
                            </span>
                            <span className="text-[10px] text-slate-400">{task.owner_type}</span>
                            {task.due_date && (
                              <span className={`text-[10px] ${isTaskOverdue ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>
                                Due {new Date(task.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {task.status !== 'Completed' && task.status !== 'Skipped' && (
                        <button
                          onClick={async () => {
                            setCompletingTask(task.id);
                            try {
                              await hrmsService.updateOnboardingTask(task.id, { status: 'Completed' });
                              addNotification({ type: 'success', message: `"${task.title || task.task_name}" marked complete` });
                              await loadActiveOnboardings();
                            } catch {
                              addNotification({ type: 'error', message: 'Failed to update task' });
                              setLoadingView(false);
                            } finally {
                              setCompletingTask(null);
                            }
                          }}
                          disabled={completingTask === task.id}
                          className="ml-2 shrink-0 px-2 py-1 text-[10px] bg-indigo-600 text-white rounded disabled:opacity-50 flex items-center gap-1"
                        >
                          {completingTask === task.id ? <Spinner /> : <CheckCircle size={10} />} Complete
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {!loadingView && !onboardingList.length && (
        <div className="text-center py-12 text-slate-400">
          <div className="text-sm font-medium mb-1">No active onboarding checklists</div>
          <div className="text-xs">Click <span className="font-semibold text-indigo-500">Load</span> to fetch current in-progress onboardings</div>
        </div>
      )}
    </div>
  );

  const renderAttendance = () => {
    const dayLabels = Array.from({ length: 31 }, (_, i) => i + 1);
    
    return (
      <div className="p-4 space-y-4 animate-fadeIn">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <select value={attMonth} onChange={e => setAttMonth(Number(e.target.value))}
              className="border border-slate-200 rounded-lg px-4 py-2 text-xs bg-slate-50 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all">
              {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <select value={attYear} onChange={e => setAttYear(Number(e.target.value))}
              className="border border-slate-200 rounded-lg px-4 py-2 text-xs bg-slate-50 font-bold text-slate-700 outline-none">
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button 
              onClick={() => {
                setLoadingView(true);
                hrmsService.getAttendanceSummary({ empId: '', month: attMonth + 1, year: attYear })
                  .then((d: any) => setAttendanceData(Array.isArray(d) ? d : (d && Array.isArray(d.grid) ? d.grid : [])))
                  .catch(() => addNotification({ type: 'error', message: 'Failed to load attendance' }))
                  .finally(() => setLoadingView(false));
              }} 
              className="px-4 py-2 text-xs bg-indigo-600 text-white font-bold uppercase tracking-widest rounded-lg flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all"
            >
              {loadingView ? <Spinner /> : <RefreshCw size={14} />} Load
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {Object.entries(attColor).map(([status, colorClass]) => (
              <div key={status} className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-md border border-slate-100">
                <div className={`w-2 h-2 rounded-full ${colorClass.split(' ')[0]}`} />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="text-[10px] min-w-full border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left font-black text-slate-400 uppercase tracking-widest min-w-[180px] sticky left-0 bg-slate-50 z-10 border-r border-slate-200">Employee</th>
                  {dayLabels.map(i => (
                    <th key={i} className={`px-1 py-3 border-r border-slate-100 min-w-[32px] text-center font-bold ${[6, 7, 13, 14, 20, 21, 27, 28].includes(i) ? 'bg-slate-100/50 text-slate-400' : 'text-slate-500'}`}>{i}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {attendanceData.map((row: any, ri: number) => (
                  <tr key={ri} className="hover:bg-indigo-50/30 transition-colors border-b border-slate-100">
                    <td className="px-4 py-2 font-bold text-slate-700 sticky left-0 bg-white z-10 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      <div className="flex flex-col">
                        <span>{row.employee_name || row.employee_id}</span>
                        <span className="text-[9px] text-slate-400 font-medium">EMP-{ri + 101}</span>
                      </div>
                    </td>
                    {dayLabels.map(di => {
                      const dayData = row.days?.find((d: any) => parseInt(d.date?.split('-')[2] || '0') === di) || row.days?.[di-1];
                      const status = dayData?.status || (di % 7 === 0 || di % 7 === 6 ? 'Holiday' : '');
                      
                      return (
                        <td key={di} className={`px-0.5 py-2 border-r border-slate-50 text-center`}>
                          {status ? (
                            <div 
                              className={`w-6 h-6 mx-auto flex items-center justify-center rounded-lg text-[9px] font-black transition-transform hover:scale-110 cursor-help ${attColor[status] || 'bg-slate-100 text-slate-400'}`}
                              title={`${status} - ${di} ${months[attMonth]}`}
                            >
                              {status === 'Half Day' ? '½' : status === 'Present' ? 'P' : status === 'Absent' ? 'A' : status === 'Leave' ? 'L' : status === 'Holiday' ? 'H' : status === 'WFH' ? 'W' : status === 'Late' ? 'T' : '·'}
                            </div>
                          ) : <span className="text-slate-200">·</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {!attendanceData.length && !loadingView && (
                  <tr>
                    <td colSpan={32} className="py-24 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 border border-dashed border-slate-200">
                          <Clock size={32} />
                        </div>
                        <div className="text-sm font-bold text-slate-400 uppercase tracking-tighter">Click Load to view attendance records</div>
                        <p className="text-xs text-slate-400 max-w-xs mx-auto">Select a month and year above to pull real-time biometric and leave data.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const [showApplyLeave, setShowApplyLeave] = useState(false);
  const [newLeave, setNewLeave] = useState({ employee_id: '', leave_type: 'Casual', start_date: '', end_date: '', reason: '' });
  const [applyingLeave, setApplyingLeave] = useState(false);

  const renderLeave = () => (
    <div className="p-4 space-y-4 animate-fadeIn">
      <div className="flex justify-between items-center">
        <Tabs tabs={['requests', 'balances', 'calendar'].map(t => ({
          id: t, label: t.charAt(0).toUpperCase() + t.slice(1),
        }))} activeTab={leaveTab} onChange={setLeaveTab} />
        
        <button 
          onClick={() => setShowApplyLeave(true)}
          className="px-3 py-1.5 bg-indigo-600 text-white text-[11px] font-bold uppercase tracking-wider rounded-lg hover:bg-indigo-700 flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all"
        >
          <Plus size={14} /> Apply Leave
        </button>
      </div>

      {leaveTab === 'requests' && (
        <DataTable
          columns={[
            { key: 'employee_name', label: 'Employee', render: (v, r: HrLeave) => (
              <div className="flex flex-col">
                <span className="font-bold text-slate-700">{v}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-slate-400 font-medium uppercase tracking-tighter">{r.leave_type}</span>
                  <div className="w-1 h-1 rounded-full bg-slate-300" />
                  <span className="text-[9px] text-indigo-500 font-bold uppercase tracking-tighter">Granted To</span>
                </div>
              </div>
            )},
            { key: 'start_date', label: 'Duration', render: (_, r: HrLeave) => (
              <div className="text-xs font-medium text-slate-600">
                {new Date(r.start_date).toLocaleDateString()} → {new Date(r.end_date).toLocaleDateString()}
                <span className="ml-2 text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{r.days} days</span>
              </div>
            )},
            { key: 'status', label: 'Status', width: '15%', render: (_, r: HrLeave) => (
              <Badge value={r.status} variant={r.status === 'Approved' ? 'success' : r.status === 'Rejected' ? 'error' : 'warning'} />
            )},
            { key: 'actions', label: 'Actions', width: '20%', align: 'right', render: (_, r: HrLeave) => r.status === 'Pending' ? (
              <div className="flex justify-end gap-1.5">
                <button onClick={() => handleApproveLeave(r.id)} disabled={leaveLoading === r.id}
                  className="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors" title="Approve">
                  {leaveLoading === r.id ? <Spinner /> : <CheckCircle size={14} />}
                </button>
                <button onClick={() => handleRejectLeave(r.id)} disabled={leaveLoading === r.id}
                  className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors" title="Reject">
                  {leaveLoading === r.id ? <Spinner /> : <X size={14} />}
                </button>
              </div>
            ) : <span className="text-slate-400 text-xs">—</span> },
          ]}
          data={leaveRequests}
          loading={loadingView}
          emptyMessage="No leave requests pending your review."
        />
      )}

      {/* Apply Leave Modal */}
      <Modal isOpen={showApplyLeave} title="Grant / Apply for Leave" onClose={() => setShowApplyLeave(false)} size="sm">
        <form className="space-y-4" onSubmit={async (e) => {
          e.preventDefault();
          if (!newLeave.employee_id) {
             addNotification({ type: 'warning', message: 'Please select an employee' });
             return;
          }
          
          // Auto-calculate days
          const start = new Date(newLeave.start_date);
          const end = new Date(newLeave.end_date);
          const diffTime = Math.abs(end.getTime() - start.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          
          if (isNaN(diffDays) || diffDays <= 0) {
            addNotification({ type: 'warning', message: 'Invalid date range' });
            return;
          }

          setApplyingLeave(true);
          try {
            await hrmsService.applyLeave({
              ...newLeave,
              days: diffDays
            });
            addNotification({ type: 'success', message: `Leave of ${diffDays} day(s) submitted successfully` });
            setShowApplyLeave(false);
            setNewLeave({ employee_id: '', leave_type: 'Casual', start_date: '', end_date: '', reason: '' });
            loadLeave();
          } catch (err: any) {
            addNotification({ type: 'error', message: err.message || 'Failed to apply for leave' });
          } finally {
            setApplyingLeave(false);
          }
        }}>
          <div className="space-y-4">
            <EmployeeSelector 
              value={newLeave.employee_id}
              onChange={id => setNewLeave({...newLeave, employee_id: id})}
              employees={employees}
              label="Select Recipient (Grant To)"
              loading={employees.length === 0}
            />

            <div className="space-y-1">
              <label htmlFor="leave-type" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Leave Type</label>
              <select id="leave-type" value={newLeave.leave_type} onChange={e => setNewLeave({...newLeave, leave_type: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs bg-slate-50 outline-none">
                {['Casual', 'Sick', 'Earned', 'LWP', 'Maternity', 'Paternity'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="leave-start" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">From Date</label>
              <input id="leave-start" type="date" required value={newLeave.start_date} onChange={e => setNewLeave({...newLeave, start_date: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs bg-slate-50 outline-none" />
            </div>
            <div className="space-y-1">
              <label htmlFor="leave-end" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">To Date</label>
              <input id="leave-end" type="date" required value={newLeave.end_date} onChange={e => setNewLeave({...newLeave, end_date: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs bg-slate-50 outline-none" />
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="leave-reason" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Reason</label>
            <textarea id="leave-reason" rows={3} value={newLeave.reason} onChange={e => setNewLeave({...newLeave, reason: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs bg-slate-50 outline-none resize-none" placeholder="Explain the purpose of your leave..." />
          </div>
          <button type="submit" disabled={applyingLeave} className="w-full py-3 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 shadow-lg transition-all">
            {applyingLeave ? <Spinner /> : 'Submit Application'}
          </button>
        </form>
      </Modal>

      {leaveTab === 'balances' && (
        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-3xl p-16 text-center max-w-2xl mx-auto mt-12 flex flex-col items-center gap-6 shadow-inner">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg border border-slate-100 text-indigo-500"><Calendar size={40} /></div>
          <div>
            <h4 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Leave Balances</h4>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">Select an employee from the Employees view to manage individual leave entitlements and track history.</p>
          </div>
        </div>
      )}
      {leaveTab === 'calendar' && (
        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-3xl p-16 text-center max-w-2xl mx-auto mt-12 flex flex-col items-center gap-6 shadow-inner">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg border border-slate-100 text-indigo-500"><Sun size={40} /></div>
          <div>
            <h4 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Team Calendar</h4>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">Visualize team availability and avoid resource bottlenecks with an automated overlap detector.</p>
          </div>
        </div>
      )}
    </div>
  );

  const renderPayroll = () => (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={payMonth} onChange={e => setPayMonth(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-xs">
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={payYear} onChange={e => setPayYear(Number(e.target.value))}
          className="border border-slate-200 rounded-lg px-3 py-2 text-xs">
          {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={loadPayroll} className="px-3 py-2 text-xs border border-slate-200 rounded-lg flex items-center gap-1"><RefreshCw size={12} /> Load</button>
        <button onClick={handleRunPayroll} disabled={runningPayroll}
          className="px-4 py-2 text-xs bg-indigo-600 text-white rounded-lg disabled:opacity-50 flex items-center gap-2 ml-auto">
          {runningPayroll ? <><Spinner /> Processing...</> : <><IndianRupee size={12} /> Run Payroll</>}
        </button>
      </div>

      <Tabs tabs={['slips', 'anomalies', 'statutory'].map(t => ({
        id: t, label: t.charAt(0).toUpperCase() + t.slice(1), isActive: payrollSubTab === t,
        onClick: () => setPayrollSubTab(t), onClose: () => {},
      }))} activeTab={payrollSubTab} onChange={setPayrollSubTab} />

      {payrollSubTab === 'slips' && (
        <DataTable
          columns={[
            { key: 'employee_name', label: 'Employee' },
            { key: 'gross_salary', label: 'Gross', render: (_, r: SalarySlip) => inr(r.gross_salary) },
            { key: 'total_deductions', label: 'Deductions', render: (_, r: SalarySlip) => <span className="text-red-500">{inr(r.total_deductions)}</span> },
            { key: 'net_pay', label: 'Net Pay', render: (_, r: SalarySlip) => <span className="font-bold text-indigo-700">{inr(r.net_pay)}</span> },
            { key: 'status', label: 'Status', render: (_, r: SalarySlip) => (
              <Badge value={r.status} variant={r.status === 'Paid' ? 'success' : r.status === 'Processed' ? 'info' : 'error'} />
            )},
            { key: 'actions', label: 'Actions', render: (_, r: SalarySlip) => (
              <div className="flex gap-1">
                <button onClick={() => setSelectedSlip(r)} className="px-2 py-1 text-[10px] border border-slate-200 rounded hover:bg-slate-50 flex items-center gap-1">
                  <Eye size={10} /> View
                </button>
                {r.status !== 'Paid' && (
                  <button onClick={() => handleMarkPaid(r.id)} disabled={markingPaid}
                    className="px-2 py-1 text-[10px] bg-green-600 text-white rounded disabled:opacity-50 flex items-center gap-1">
                    {markingPaid ? <Spinner /> : <CheckCircle size={10} />} Paid
                  </button>
                )}
              </div>
            )},
          ]}
          data={slips}
          loading={loadingView}
          emptyMessage="No salary slips — run payroll or change month"
        />
      )}

      {payrollSubTab === 'anomalies' && (
        <div className="space-y-2">
          {anomalies.length === 0 && <div className="text-center py-12 text-slate-400">No anomalies detected</div>}
          {anomalies.map((a: any, i: number) => (
            <div key={i} className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs">
              <AlertTriangle size={14} className="text-amber-500 shrink-0" />
              <div className="flex-1">
                <span className="font-semibold">{a.employee_name}</span> — {a.anomaly_type || a.message}
              </div>
              {a.severity && <Badge value={a.severity} variant={a.severity === 'High' ? 'error' : 'warning'} />}
            </div>
          ))}
        </div>
      )}

      {payrollSubTab === 'statutory' && (
        <div>
          <div className="flex gap-2 mb-4">
            {['pf', 'esic', 'pt'].map(t => (
              <button key={t} onClick={() => loadStatutory(t)}
                className={`px-3 py-1.5 text-xs rounded-lg ${statutoryTab === t ? 'bg-indigo-600 text-white' : 'border border-slate-200 hover:bg-slate-50'}`}>
                {t.toUpperCase()}
              </button>
            ))}
          </div>
          <DataTable
            columns={[
              { key: 'employee_name', label: 'Employee' },
              { key: 'uan', label: 'UAN' },
              { key: 'wages', label: 'Wages', render: (_, r: any) => inr(r.wages) },
              { key: 'ee_epf_contribution', label: 'EE EPF', render: (_, r: any) => inr(r.ee_epf_contribution) },
              { key: 'er_epf_contribution', label: 'ER EPF', render: (_, r: any) => inr(r.er_epf_contribution) },
              { key: 'er_eps_contribution', label: 'EPS', render: (_, r: any) => inr(r.er_eps_contribution) },
            ]}
            data={pfRegister}
            loading={loadingView}
            emptyMessage="Click PF / ESIC / PT to load register"
          />
        </div>
      )}

      {selectedSlip && (
        <PayslipModal slip={selectedSlip} onClose={() => setSelectedSlip(null)} onMarkPaid={handleMarkPaid} markingPaid={markingPaid} />
      )}
    </div>
  );

  const renderAnalytics = () => (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-slate-700">HR Analytics Dashboard</h3>
        <button onClick={loadAnalytics} disabled={loadingView}
          className="text-xs text-indigo-600 flex items-center gap-1 disabled:opacity-50"><RefreshCw size={12} /> Refresh</button>
      </div>
      {loadingView && <div className="flex justify-center py-12"><Spinner /></div>}
      {!loadingView && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="font-semibold text-slate-700 text-sm mb-3">Headcount by Department</div>
            <ResponsiveContainer width="100%" height={250} debounce={50}>
              <BarChart data={headcount?.by_department || []}>
                <XAxis dataKey="department" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="font-semibold text-slate-700 text-sm mb-3">Monthly Attrition Trend</div>
            <ResponsiveContainer width="100%" height={250} debounce={50}>
              <LineChart data={attrition?.monthly || []}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="rate" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="font-semibold text-slate-700 text-sm mb-3">Gender Diversity</div>
            <ResponsiveContainer width="100%" height={200} debounce={50}>
              <PieChart>
                <Pie data={diversity?.by_gender || []} dataKey="count" nameKey="gender" cx="50%" cy="50%" outerRadius={80} label>
                  {(diversity?.by_gender || []).map((_: any, i: number) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="font-semibold text-slate-700 text-sm mb-3">Payroll Cost Trend</div>
            <ResponsiveContainer width="100%" height={250} debounce={50}>
              <AreaChart data={payrollCost?.monthly || []}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `₹${(v / 100000).toFixed(1)}L`} />
                <Tooltip formatter={(v: number) => inr(v)} />
                <Area type="monotone" dataKey="total_cost" stroke="#8b5cf6" fill="#ede9fe" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );

  const renderAIInsights = () => (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-700">AI Attrition Predictions</h3>
        <button onClick={handleAttritionPredict} disabled={predLoading}
          className="px-4 py-2 text-xs bg-indigo-600 text-white rounded-lg disabled:opacity-50 flex items-center gap-2">
          {predLoading ? <><Spinner /> Analyzing...</> : <><Brain size={12} /> Run Prediction</>}
        </button>
      </div>

      {attritionPred && (
        <>
          <div className="text-xs text-slate-500 mb-2">Overall Rate: <strong>{attritionPred.atRiskEmployees?.length || 0}</strong> employees at risk</div>
          <DataTable
            columns={[
              { key: 'name', label: 'Employee' },
              { key: 'department', label: 'Department' },
              { key: 'riskScore', label: 'Risk Score', render: (_, r: any) => (
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-slate-100 rounded-full h-2">
                    <div className={`h-2 rounded-full ${r.riskScore > 70 ? 'bg-red-500' : r.riskScore > 40 ? 'bg-amber-400' : 'bg-green-400'}`}
                      style={{ width: `${r.riskScore}%` }} />
                  </div>
                  <span className="font-semibold text-xs">{r.riskScore}%</span>
                </div>
              )},
              { key: 'reasons', label: 'Reasons', render: (_, r: any) => (
                <div className="flex flex-wrap gap-1">
                  {r.reasons?.slice(0, 2).map((reason: string, i: number) => (
                    <span key={i} className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded">{reason}</span>
                  ))}
                </div>
              )},
              { key: 'actions', label: 'Actions', render: (_, r: any) => (
                <div className="flex gap-1">
                  <button onClick={() => handleFlightRisk(r.id)} disabled={flightRiskLoading === r.id}
                    className="px-2 py-1 text-[10px] bg-orange-500 text-white rounded disabled:opacity-50 flex items-center gap-1">
                    {flightRiskLoading === r.id ? <Spinner /> : <AlertTriangle size={10} />} Flight Risk
                  </button>
                  <button onClick={async () => {
                    try {
                      const res = await hrmsService.aiPromotionReadiness(r.id);
                      addNotification({ type: 'info', message: `Promotion readiness assessed` });
                    } catch {
                      addNotification({ type: 'error', message: 'Promotion assessment failed' });
                    }
                  }} className="px-2 py-1 text-[10px] bg-green-600 text-white rounded flex items-center gap-1">
                    <Award size={10} /> Readiness
                  </button>
                </div>
              )},
            ]}
            data={attritionPred.atRiskEmployees || []}
            emptyMessage="No at-risk employees found"
          />
          {Object.keys(flightRiskResults).length > 0 && (
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="font-semibold text-xs text-slate-600 mb-2 uppercase tracking-wide">Flight Risk Results</div>
              {Object.entries(flightRiskResults).map(([id, r]: [string, any]) => (
                <div key={id} className="text-xs text-slate-700 border-b border-slate-100 py-2">
                  <strong>{id}</strong>: {r?.recommendation || JSON.stringify(r)}
                </div>
              ))}
            </div>
          )}
          {attritionPred.recommendedActions?.length > 0 && (
            <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
              <div className="font-semibold text-indigo-700 text-xs mb-2 uppercase tracking-wide">Recommended Actions</div>
              <ul className="space-y-1">
                {attritionPred.recommendedActions.map((a, i) => (
                  <li key={i} className="text-xs text-indigo-700 flex items-start gap-2">
                    <ChevronRight size={12} className="mt-0.5 shrink-0" />{a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {!attritionPred && !predLoading && (
        <div className="text-center py-16 text-slate-400">
          <Brain size={36} className="mx-auto mb-3 opacity-30" />
          <div className="text-sm">Click "Run Prediction" to analyze attrition risk across your workforce</div>
        </div>
      )}
    </div>
  );

  const renderIncidents = () => (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <FilterBar
          filters={[
            { type: 'select', key: 'severity', label: 'Severity', value: incSeverity, onChange: setIncSeverity,
              options: [{ value: '', label: 'All Severity' }, ...['Low','Medium','High','Critical'].map(v => ({ value: v, label: v }))] },
            { type: 'select', key: 'status', label: 'Status', value: incStatus, onChange: setIncStatus,
              options: [{ value: '', label: 'All Status' }, ...['Open','Under Investigation','Resolved'].map(v => ({ value: v, label: v }))] },
          ]}
          onRefresh={loadIncidents}
        />
        <button onClick={() => setIncidentModal(true)} className="px-4 py-2 text-xs bg-red-600 text-white rounded-lg flex items-center gap-1 ml-4">
          <Plus size={12} /> Report Incident
        </button>
      </div>
      <DataTable
        columns={[
          { key: 'incident_type', label: 'Type' },
          { key: 'employee_name', label: 'Involved Employee' },
          { key: 'severity', label: 'Severity', render: (_, r: HrIncident) => (
            <Badge value={r.severity} variant={severityVariant[r.severity] as any} />
          )},
          { key: 'status', label: 'Status', render: (_, r: HrIncident) => (
            <Badge value={r.status} variant={r.status === 'Resolved' ? 'success' : r.status === 'Open' ? 'error' : 'warning'} />
          )},
          { key: 'description', label: 'Description', render: (_, r: HrIncident) => (
            <span className="text-xs text-slate-600 line-clamp-1">{r.description}</span>
          )},
          { key: 'created_at', label: 'Reported', width: 100 },
          { key: 'actions', label: 'Actions', render: (_, r: HrIncident) => r.status !== 'Resolved' ? (
            <select onChange={async e => {
              try {
                await hrmsService.updateIncident(r.id, { status: e.target.value as any });
                setIncidents(inc => inc.map(x => x.id === r.id ? { ...x, status: e.target.value as any } : x));
                addNotification({ type: 'success', message: 'Status updated' });
              } catch {
                addNotification({ type: 'error', message: 'Update failed' });
              }
            }} value={r.status}
              className="border border-slate-200 rounded px-1.5 py-1 text-[10px]">
              {['Open','Under Investigation','Resolved'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : <span className="text-green-500 text-xs">✓ Resolved</span> },
        ]}
        data={incidents}
        loading={loadingView}
        emptyMessage="No incidents found"
      />
      {incidentModal && (
        <Modal isOpen title="Report Incident" onClose={() => setIncidentModal(false)}>
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-medium text-slate-600 mb-1">Involved Employee</label>
              <select value={newIncident.involved_employee_id || ''} onChange={e => setNewIncident(n => ({ ...n, involved_employee_id: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2">
                <option value="">— Select Employee —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-600 mb-1">Incident Type</label>
                <input value={newIncident.incident_type || ''} onChange={e => setNewIncident(n => ({ ...n, incident_type: e.target.value }))}
                  placeholder="e.g. Safety, Misconduct..." className="w-full border border-slate-200 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block font-medium text-slate-600 mb-1">Severity</label>
                <select value={newIncident.severity} onChange={e => setNewIncident(n => ({ ...n, severity: e.target.value as any }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2">
                  {['Low','Medium','High','Critical'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block font-medium text-slate-600 mb-1">Description</label>
              <textarea value={newIncident.description || ''} onChange={e => setNewIncident(n => ({ ...n, description: e.target.value }))}
                rows={3} placeholder="Describe the incident..." className="w-full border border-slate-200 rounded-lg px-3 py-2 resize-none" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setIncidentModal(false)} className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={handleCreateIncident} disabled={savingIncident || !newIncident.description}
                className="px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50 flex items-center gap-2">
                {savingIncident ? <><Spinner /> Saving...</> : 'Report Incident'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );

  const renderRewards = () => (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-slate-700">Recognition Feed</h3>
        <button onClick={() => setRewardModal(true)} className="px-4 py-2 text-xs bg-amber-500 text-white rounded-lg flex items-center gap-1">
          <Award size={12} /> Give Recognition
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {rewards.map(r => (
          <div key={r.id} className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center text-white text-xs font-bold">
                  {r.giver_name?.[0] || '?'}
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-800">{r.giver_name || 'Anonymous'}</div>
                  <div className="text-[10px] text-slate-500">gave to {r.receiver_name}</div>
                </div>
              </div>
              <div className="text-right">
                <Badge value={r.reward_type} variant="warning" />
                <div className="text-xs font-bold text-amber-600 mt-1">+{r.points} pts</div>
              </div>
            </div>
            {r.message && <div className="text-xs text-slate-600 italic bg-white/60 rounded p-2">"{r.message}"</div>}
            <div className="text-[10px] text-slate-400 mt-2">{new Date(r.created_at).toLocaleDateString()}</div>
          </div>
        ))}
        {!rewards.length && !loadingView && (
          <div className="col-span-2 text-center py-12 text-slate-400">
            <Award size={36} className="mx-auto mb-3 opacity-30" />
            No recognitions yet. Be the first to give one!
          </div>
        )}
      </div>
      {rewardModal && (
        <Modal isOpen title="Give Recognition" onClose={() => setRewardModal(false)}>
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-medium text-slate-600 mb-1">Recipient</label>
              <select value={newReward.receiver_id || ''} onChange={e => setNewReward(n => ({ ...n, receiver_id: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2">
                <option value="">— Select Employee —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-600 mb-1">Reward Type</label>
                <select value={newReward.reward_type || 'Star Performer'} onChange={e => setNewReward(n => ({ ...n, reward_type: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2">
                  {['Star Performer','Team Player','Innovation Award','Leadership','Customer Hero','Rising Star'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-600 mb-1">Points</label>
                <input type="number" value={newReward.points || 100} min={10} max={1000}
                  onChange={e => setNewReward(n => ({ ...n, points: Number(e.target.value) }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2" />
              </div>
            </div>
            <div>
              <label className="block font-medium text-slate-600 mb-1">Message</label>
              <textarea value={newReward.message || ''} onChange={e => setNewReward(n => ({ ...n, message: e.target.value }))}
                rows={3} placeholder="What did they do that was remarkable?" className="w-full border border-slate-200 rounded-lg px-3 py-2 resize-none" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setRewardModal(false)} className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={handleGiveReward} disabled={givingReward || !newReward.receiver_id}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg disabled:opacity-50 flex items-center gap-2">
                {givingReward ? <><Spinner /> Sending...</> : <><Award size={12} /> Give Recognition</>}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );

  const renderPlaceholder = (label: string) => (
    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
      <div className="text-4xl mb-3 opacity-30">⚙</div>
      <div className="font-semibold">{label}</div>
      <div className="text-xs mt-1">This module is available — select sub-section to begin</div>
    </div>
  );

  const renderDocuments = () => {
    return (
      <div className="p-4 space-y-4 animate-fadeIn">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center justify-between">
          <EmployeeSelector 
            value={selectedDocEmp} 
            onChange={empId => {
              setSelectedDocEmp(empId);
              loadDocuments(empId);
            }} 
            employees={employees}
            loading={loadingView && employees.length === 0}
          />

          {selectedDocEmp && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!docFile) {
                  addNotification({ type: 'warning', message: 'Please select a file' });
                  return;
                }
                setUploadingDoc(true);
                const formData = new FormData();
                formData.append('file', docFile);
                formData.append('doc_type', newDocType);
                formData.append('description', newDocRemarks);
                
                try {
                  const token = localStorage.getItem('accessToken');
                  const url = `${import.meta.env.VITE_API_URL || '/api'}/hr/employees/${selectedDocEmp}/documents`;
                  const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${token}`
                    },
                    body: formData
                  });
                  const resData = await res.json();
                  if (resData.success) {
                    addNotification({ type: 'success', message: 'Document uploaded' });
                    setNewDocRemarks('');
                    setDocFile(null);
                    const fileInput = document.getElementById('doc-file-input') as HTMLInputElement;
                    if (fileInput) fileInput.value = '';
                    loadDocuments(selectedDocEmp);
                  } else {
                    addNotification({ type: 'error', message: resData.error || 'Upload failed' });
                  }
                } catch {
                  addNotification({ type: 'error', message: 'Network error during upload' });
                } finally {
                  setUploadingDoc(false);
                }
              }}
              className="flex items-center gap-2 flex-wrap"
            >
              <select
                value={newDocType}
                onChange={e => setNewDocType(e.target.value)}
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-slate-50 font-medium"
              >
                {['Offer Letter', 'ID Proof', 'PAN Card', 'Aadhar Card', 'Degree', 'Experience Letter', 'Appointment Letter', 'Resignation Letter'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Remarks/Description"
                value={newDocRemarks}
                onChange={e => setNewDocRemarks(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <input
                id="doc-file-input"
                type="file"
                onChange={e => setDocFile(e.target.files?.[0] || null)}
                className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
              <button
                type="submit"
                disabled={uploadingDoc || !docFile}
                className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
              >
                {uploadingDoc ? <Spinner /> : <Plus size={12} />} Upload
              </button>
            </form>
          )}
        </div>

        {selectedDocEmp ? (
          <DataTable
            columns={[
              { key: 'doc_type', label: 'Document Type', width: '25%' },
              { key: 'doc_name', label: 'File Name', width: '35%' },
              { key: 'file_size', label: 'Size', width: '15%', render: (v) => v ? `${(Number(v) / 1024).toFixed(1)} KB` : '—' },
              { key: 'created_at', label: 'Uploaded At', width: '15%', render: (v) => new Date(v).toLocaleDateString() },
              {
                key: 'actions',
                label: 'Actions',
                width: '10%',
                align: 'right',
                render: (_, r: HrEmployeeDocument) => (
                  <div className="flex justify-end gap-1.5">
                    <a
                      href={`${import.meta.env.VITE_API_URL || ''}/${r.file_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 hover:bg-indigo-50 text-indigo-600 rounded"
                      title="Download/View Document"
                    >
                      <Download size={13} />
                    </a>
                    <button
                      onClick={async () => {
                        if (!window.confirm('Delete this document?')) return;
                        try {
                          await hrmsService.deleteDocument(selectedDocEmp, r.id);
                          addNotification({ type: 'success', message: 'Document deleted' });
                          loadDocuments(selectedDocEmp);
                        } catch {
                          addNotification({ type: 'error', message: 'Delete failed' });
                        }
                      }}
                      className="p-1 hover:bg-rose-50 text-rose-600 rounded"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )
              }
            ]}
            data={empDocs}
            loading={loadingView}
            emptyMessage="No documents found for this employee."
          />
        ) : (
          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-3xl p-16 text-center max-w-2xl mx-auto mt-12 flex flex-col items-center gap-6 shadow-inner">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg border border-slate-100">
              <FileText className="text-indigo-500" size={40} />
            </div>
            <div>
              <h4 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Document Repository</h4>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed max-w-md mx-auto">
                Manage official employment documents (Offer Letters, ID proofs, degrees, and certificates) with enterprise-grade security.
              </p>
            </div>
            <div className="w-full max-w-xs">
              <EmployeeSelector 
                value={selectedDocEmp} 
                onChange={empId => {
                  setSelectedDocEmp(empId);
                  loadDocuments(empId);
                }} 
                employees={employees}
                label="Get Started — Select an Employee"
                loading={loadingView && employees.length === 0}
              />
            </div>
            <div className="grid grid-cols-3 gap-4 w-full mt-4">
              {['Offer Letters', 'ID Proofs', 'Certificates'].map(tag => (
                <div key={tag} className="bg-white px-3 py-2 rounded-xl border border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{tag}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderOffboarding = () => {
    const clearanceDeps = ['IT', 'Finance', 'HR', 'Admin'];
    const currentClearance = offboardingDetail?.clearance_status || {};
    const totalDeps = clearanceDeps.length;
    const clearedDepsCount = clearanceDeps.filter(d => currentClearance[d] === true).length;
    const clearancePct = totalDeps ? Math.round((clearedDepsCount / totalDeps) * 100) : 0;

    return (
      <div className="p-4 space-y-4 animate-fadeIn">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <EmployeeSelector 
            value={selectedOffboardEmp}
            onChange={empId => {
              setSelectedOffboardEmp(empId);
              if (empId) loadOffboarding(empId);
            }}
            employees={employees}
            label="Select Employee for Exit & Offboarding"
            loading={loadingView && employees.length === 0}
          />
        </div>

        {selectedOffboardEmp ? (
          offboardingDetail ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Clearance Status Matrix</h3>
                  <p className="text-[10px] text-slate-400 uppercase mt-0.5">Toggle department clearance boxes</p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-semibold text-indigo-600 mb-1">
                    <span>Clearance Progress</span>
                    <span>{clearancePct}% Done</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5">
                    <div className="bg-indigo-600 h-2.5 rounded-full transition-all" style={{ width: `${clearancePct}%` }} />
                  </div>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
                  {clearanceDeps.map(dep => {
                    const isCleared = currentClearance[dep] === true;
                    return (
                      <div key={dep} className="flex justify-between items-center p-3 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-2">
                          {isCleared ? <CheckCircle size={14} className="text-green-500" /> : <Circle size={14} className="text-slate-300" />}
                          <span className="text-xs font-semibold text-slate-700">{dep} Department</span>
                        </div>
                        <button
                          onClick={async () => {
                            setUpdatingClearance(true);
                            const updatedClearance = { ...currentClearance, [dep]: !isCleared };
                            try {
                              await hrmsService.updateOffboardingClearance(offboardingDetail.id, updatedClearance);
                              addNotification({ type: 'success', message: `${dep} clearance toggled` });
                              loadOffboarding(selectedOffboardEmp);
                            } catch {
                              addNotification({ type: 'error', message: 'Clearance update failed' });
                            } finally {
                              setUpdatingClearance(false);
                            }
                          }}
                          disabled={updatingClearance}
                          className={`px-3 py-1 text-[10px] font-bold uppercase rounded ${
                            isCleared ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-green-50 text-green-600 hover:bg-green-100'
                          }`}
                        >
                          {isCleared ? 'Revoke' : 'Clear'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 text-xs">
                <div className="border-b border-slate-100 pb-2">
                  <h3 className="text-sm font-bold text-slate-800">Initiated Offboarding Details</h3>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-2.5 rounded">
                    <span className="text-[10px] text-slate-400 uppercase">Exit Date</span>
                    <p className="font-semibold text-slate-700 mt-0.5">{offboardingDetail.exit_date ? new Date(offboardingDetail.exit_date).toLocaleDateString() : '—'}</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded">
                    <span className="text-[10px] text-slate-400 uppercase">Notice Period</span>
                    <p className="font-semibold text-slate-700 mt-0.5">{offboardingDetail.notice_period_days || 30} Days</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded">
                    <span className="text-[10px] text-slate-400 uppercase">Settlement Status</span>
                    <p className="font-bold text-indigo-600 mt-0.5">{offboardingDetail.full_final_status || 'Pending'}</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded">
                    <span className="text-[10px] text-slate-400 uppercase">Exit Type</span>
                    <p className="font-semibold text-slate-700 mt-0.5">{offboardingDetail.exit_type || 'Resigned'}</p>
                  </div>
                </div>

                {offboardingDetail.exit_interview_notes && (
                  <div className="bg-slate-50 p-3 rounded">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Exit Notes/Reason</span>
                    <p className="text-slate-600 mt-1 italic leading-relaxed">"{offboardingDetail.exit_interview_notes}"</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-md mx-auto space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Initiate Exit Process</h3>
                <p className="text-[10px] text-slate-400 uppercase mt-0.5">Start formal employee termination/resignation sequence</p>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!offboardExitDate) {
                    addNotification({ type: 'warning', message: 'Exit date is required' });
                    return;
                  }
                  setInitiatingOffboard(true);
                  try {
                    await hrmsService.initiateOffboarding(selectedOffboardEmp, {
                      exit_date: offboardExitDate,
                      exit_type: offboardExitType,
                      notice_period_days: offboardNoticeDays
                    });
                    
                    await hrmsService.terminateEmployee(selectedOffboardEmp, {
                      exit_date: offboardExitDate,
                      exit_reason: offboardNotes
                    });

                    addNotification({ type: 'success', message: 'Offboarding sequence initiated' });
                    loadOffboarding(selectedOffboardEmp);
                    loadEmployees();
                  } catch {
                    addNotification({ type: 'error', message: 'Initiation failed' });
                  } finally {
                    setInitiatingOffboard(false);
                  }
                }}
                className="space-y-3 text-xs"
              >
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Exit Type</label>
                  <select
                    value={offboardExitType}
                    onChange={e => setOffboardExitType(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <option value="Resigned">Resigned (Voluntary)</option>
                    <option value="Terminated">Terminated (Involuntary)</option>
                    <option value="Retired">Retired</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Notice Days</label>
                    <input
                      type="number"
                      value={offboardNoticeDays}
                      onChange={e => setOffboardNoticeDays(Number(e.target.value))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Last Working Day</label>
                    <input
                      type="date"
                      value={offboardExitDate}
                      onChange={e => setOffboardExitDate(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Exit Notes/Reason</label>
                  <textarea
                    value={offboardNotes}
                    onChange={e => setOffboardNotes(e.target.value)}
                    placeholder="Enter reason for departure or exit interview details..."
                    rows={3}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={initiatingOffboard}
                  className="w-full py-2 bg-indigo-600 text-white font-bold uppercase rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {initiatingOffboard ? <Spinner /> : <LogOut size={13} />} Initiate Offboarding
                </button>
              </form>
            </div>
          )
        ) : (
          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-12 text-center max-w-lg mx-auto mt-8">
            <LogOut className="mx-auto text-slate-300 mb-3" size={48} />
            <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Offboarding Clearance Matrix</h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Select an employee from the dropdown list to initiate their exit process or to manage clearance approvals across HR, IT, Finance, and Administration departments.
            </p>
          </div>
        )}
      </div>
    );
  };

  const [shiftsSubTab, setShiftsSubTab] = useState('shifts');
  const renderShifts = () => {
    return (
      <div className="p-4 space-y-4 animate-fadeIn">
        <Tabs
          tabs={[
            { id: 'shifts', label: 'Shifts & Rostering' },
            { id: 'holidays', label: 'Holiday Planner' }
          ]}
          activeTab={shiftsSubTab}
          onChange={setShiftsSubTab}
        />

        {shiftsSubTab === 'shifts' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <DataTable
                columns={[
                  { key: 'name', label: 'Shift Name', width: '30%' },
                  { key: 'start_time', label: 'Start Time', width: '20%' },
                  { key: 'end_time', label: 'End Time', width: '20%' },
                  { key: 'grace_minutes', label: 'Grace Mins', width: '15%', render: (v) => `${v || 0}m` },
                  { key: 'is_night_shift', label: 'Type', width: '15%', render: (v) => v ? <Badge value="NIGHT" variant="warning" /> : <Badge value="DAY" variant="success" /> }
                ]}
                data={shiftsList}
                loading={loadingView}
                emptyMessage="No rostered shifts found."
              />
            </div>

            <div className="space-y-4">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newShift.name) return;
                  setSavingShift(true);
                  try {
                    await hrmsService.createShift(newShift);
                    addNotification({ type: 'success', message: 'Shift created successfully' });
                    setNewShift({ name: '', start_time: '09:00', end_time: '18:00', grace_minutes: 15, is_night_shift: false });
                    loadShiftsAndHolidays();
                  } catch {
                    addNotification({ type: 'error', message: 'Failed to create shift' });
                  } finally {
                    setSavingShift(false);
                  }
                }}
                className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 text-xs"
              >
                <div className="border-b border-slate-100 pb-1.5"><h3 className="font-bold text-slate-800">Create Roster Shift</h3></div>
                <div>
                  <label className="block text-slate-500 mb-1">Shift Name</label>
                  <input type="text" value={newShift.name} onChange={e => setNewShift({...newShift, name: e.target.value})} placeholder="e.g. Evening Shift" className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-500 mb-1">Start Time</label>
                    <input type="time" value={newShift.start_time} onChange={e => setNewShift({...newShift, start_time: e.target.value})} className="w-full border border-slate-200 rounded-lg px-2 py-1" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">End Time</label>
                    <input type="time" value={newShift.end_time} onChange={e => setNewShift({...newShift, end_time: e.target.value})} className="w-full border border-slate-200 rounded-lg px-2 py-1" />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Grace Minutes</label>
                  <input type="number" value={newShift.grace_minutes} onChange={e => setNewShift({...newShift, grace_minutes: Number(e.target.value)})} className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5" />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={newShift.is_night_shift} onChange={e => setNewShift({...newShift, is_night_shift: e.target.checked})} id="is_night_shift" />
                  <label htmlFor="is_night_shift" className="font-semibold text-slate-600 select-none">Is Night Shift?</label>
                </div>
                <button type="submit" disabled={savingShift || !newShift.name} className="w-full py-2 bg-indigo-600 text-white font-bold uppercase rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {savingShift ? <Spinner /> : 'Save Shift'}
                </button>
              </form>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!selectedShiftEmp || !selectedAssignShift) return;
                  setShiftAssigning(true);
                  try {
                    await hrmsService.assignShift({
                      employee_id: selectedShiftEmp,
                      shift_id: selectedAssignShift,
                      effective_from: new Date().toISOString().slice(0, 10)
                    });
                    addNotification({ type: 'success', message: 'Shift assigned successfully' });
                    setSelectedShiftEmp('');
                    setSelectedAssignShift('');
                  } catch {
                    addNotification({ type: 'error', message: 'Failed to assign shift' });
                  } finally {
                    setShiftAssigning(false);
                  }
                }}
                className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 text-xs"
              >
                <div className="border-b border-slate-100 pb-1.5"><h3 className="font-bold text-slate-800">Assign Shift Roster</h3></div>
                <EmployeeSelector 
                  value={selectedShiftEmp}
                  onChange={setSelectedShiftEmp}
                  employees={employees}
                  label="Select Employee"
                  loading={loadingView && employees.length === 0}
                />
                <div>
                  <label className="block text-slate-500 mb-1">Select Shift</label>
                  <select value={selectedAssignShift} onChange={e => setSelectedAssignShift(e.target.value)} className="w-full border border-slate-200 rounded-lg px-2 py-1.5">
                    <option value="">— Select —</option>
                    {shiftsList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.start_time}-{s.end_time})</option>)}
                  </select>
                </div>
                <button type="submit" disabled={shiftAssigning || !selectedShiftEmp || !selectedAssignShift} className="w-full py-2 bg-indigo-600 text-white font-bold uppercase rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg hover:shadow-indigo-500/20">
                  {shiftAssigning ? <Spinner /> : 'Assign Shift'}
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <DataTable
                columns={[
                  { key: 'name', label: 'Holiday Name', width: '40%' },
                  { key: 'date', label: 'Holiday Date', width: '30%', render: (v) => new Date(v).toLocaleDateString() },
                  { key: 'location', label: 'Branch Location', width: '20%', render: (v) => v || 'All Branches' },
                  { key: 'is_optional', label: 'Type', width: '10%', render: (v) => v ? <Badge value="OPTIONAL" variant="info" /> : <Badge value="MANDATORY" variant="neutral" /> }
                ]}
                data={holidaysList}
                loading={loadingView}
                emptyMessage="No company holidays configured."
              />
            </div>

            <div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newHoliday.name || !newHoliday.date) return;
                  setSavingHoliday(true);
                  try {
                    await hrmsService.createHoliday(newHoliday);
                    addNotification({ type: 'success', message: 'Holiday created successfully' });
                    setNewHoliday({ name: '', date: '', location: '', is_optional: false });
                    loadShiftsAndHolidays();
                  } catch {
                    addNotification({ type: 'error', message: 'Failed to create holiday' });
                  } finally {
                    setSavingHoliday(false);
                  }
                }}
                className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 text-xs"
              >
                <div className="border-b border-slate-100 pb-1.5"><h3 className="font-bold text-slate-800">Add Company Holiday</h3></div>
                <div>
                  <label className="block text-slate-500 mb-1">Holiday Name</label>
                  <input type="text" value={newHoliday.name} onChange={e => setNewHoliday({...newHoliday, name: e.target.value})} placeholder="e.g. Independence Day" className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Date</label>
                  <input type="date" value={newHoliday.date} onChange={e => setNewHoliday({...newHoliday, date: e.target.value})} className="w-full border border-slate-200 rounded-lg px-2 py-1.5" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Location Restrict (optional)</label>
                  <input type="text" value={newHoliday.location} onChange={e => setNewHoliday({...newHoliday, location: e.target.value})} placeholder="e.g. Mumbai, HQ" className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5" />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={newHoliday.is_optional} onChange={e => setNewHoliday({...newHoliday, is_optional: e.checked})} id="is_optional" />
                  <label htmlFor="is_optional" className="font-semibold text-slate-600 select-none">Is Optional Holiday?</label>
                </div>
                <button type="submit" disabled={savingHoliday || !newHoliday.name || !newHoliday.date} className="w-full py-2 bg-indigo-600 text-white font-bold uppercase rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {savingHoliday ? <Spinner /> : 'Save Holiday'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTimesheets = () => {
    return (
      <div className="p-4 space-y-4 animate-fadeIn">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center justify-between">
          <EmployeeSelector 
            value={timesheetEmp}
            onChange={empId => {
              setTimesheetEmp(empId);
              if (empId) loadTimesheets(empId);
            }}
            employees={employees}
            label="Timesheet Management"
            loading={loadingView && employees.length === 0}
          />

          {timesheetEmp && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newTimesheet.date || !newTimesheet.project || !newTimesheet.task) return;
                setSavingTimesheet(true);
                try {
                  await hrmsService.submitTimesheet({
                    employee_id: timesheetEmp,
                    project_id: null,
                    work_date: newTimesheet.date,
                    project: newTimesheet.project,
                    task: newTimesheet.task,
                    hours: newTimesheet.hours,
                    description: newTimesheet.description,
                    billable: true
                  });
                  addNotification({ type: 'success', message: 'Timesheet logged' });
                  setNewTimesheet({ date: '', project: '', task: '', hours: 8, description: '' });
                  loadTimesheets(timesheetEmp);
                } catch {
                  addNotification({ type: 'error', message: 'Failed to log timesheet' });
                } finally {
                  setSavingTimesheet(false);
                }
              }}
              className="flex items-center gap-2 flex-wrap text-xs"
            >
              <input type="date" value={newTimesheet.date} onChange={e => setNewTimesheet({...newTimesheet, date: e.target.value})} className="border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none" />
              <input type="text" value={newTimesheet.project} onChange={e => setNewTimesheet({...newTimesheet, project: e.target.value})} placeholder="Project" className="border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none w-24" />
              <input type="text" value={newTimesheet.task} onChange={e => setNewTimesheet({...newTimesheet, task: e.target.value})} placeholder="Task description" className="border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none w-44" />
              <input type="number" value={newTimesheet.hours} onChange={e => setNewTimesheet({...newTimesheet, hours: Number(e.target.value)})} placeholder="Hours" className="border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none w-14 text-center" />
              <button type="submit" disabled={savingTimesheet || !newTimesheet.date || !newTimesheet.project} className="px-3 py-1.5 bg-indigo-600 text-white font-bold uppercase rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {savingTimesheet ? <Spinner /> : 'Log Hours'}
              </button>
            </form>
          )}
        </div>

        {timesheetEmp ? (
          <DataTable
            columns={[
              { key: 'date', label: 'Date', width: '15%', render: (v) => new Date(v).toLocaleDateString() },
              { key: 'project', label: 'Project', width: '20%' },
              { key: 'task', label: 'Task Detail', width: '40%' },
              { key: 'hours', label: 'Hours', width: '10%', align: 'center', render: (v) => <strong>{v} hrs</strong> },
              { key: 'status', label: 'Status', width: '15%', render: (v) => <Badge value={v || 'Approved'} variant={v === 'Pending' ? 'warning' : 'success'} /> }
            ]}
            data={timesheetsList}
            loading={loadingView}
            emptyMessage="No logged hours found for this employee."
          />
        ) : (
          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-12 text-center max-w-lg mx-auto mt-8">
            <Timer className="mx-auto text-slate-300 mb-3" size={48} />
            <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Project Timesheet Desk</h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Select an employee from the dropdown list to manage, log, or review weekly task hours and project allocations.
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderSalaryStructures = () => {
    return (
      <div className="p-4 space-y-4 animate-fadeIn">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <DataTable
              columns={[
                { key: 'name', label: 'Structure Name', width: '30%' },
                { key: 'grade', label: 'Grade Map', width: '15%', align: 'center', render: (v) => <Badge value={v} variant="info" /> },
                { key: 'basic_pct', label: 'Basic Salary %', width: '15%', render: (v) => `${v || 50}%` },
                { key: 'hra_pct', label: 'HRA Allowance %', width: '15%', render: (v) => `${v || 20}%` },
                { key: 'da_pct', label: 'Dearness %', width: '10%', render: (v) => `${v || 10}%` },
                { key: 'special_allowance', label: 'Special Allowance', width: '15%', render: (v) => inr(v) }
              ]}
              data={salaryStructures}
              loading={loadingView}
              emptyMessage="No salary structures master configured."
            />
          </div>

          <div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newSalaryStructure.name) return;
                setSavingSalaryStructure(true);
                try {
                  await hrmsService.createSalaryStructure(newSalaryStructure);
                  addNotification({ type: 'success', message: 'Salary structure saved' });
                  setNewSalaryStructure({ name: '', basic_pct: 50, hra_pct: 20, da_pct: 10, special_allowance: 0, grade: 'L2' });
                  loadSalaryStructures();
                } catch {
                  addNotification({ type: 'error', message: 'Failed to create structure' });
                } finally {
                  setSavingSalaryStructure(false);
                }
              }}
              className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 text-xs"
            >
              <div className="border-b border-slate-100 pb-1.5"><h3 className="font-bold text-slate-800">Add Salary Structure</h3></div>
              <div>
                <label className="block text-slate-500 mb-1">Structure Name</label>
                <input type="text" value={newSalaryStructure.name} onChange={e => setNewSalaryStructure({...newSalaryStructure, name: e.target.value})} placeholder="e.g. Executive Staff Plan" className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 mb-1">Basic salary %</label>
                  <input type="number" value={newSalaryStructure.basic_pct} onChange={e => setNewSalaryStructure({...newSalaryStructure, basic_pct: Number(e.target.value)})} className="w-full border border-slate-200 rounded-lg px-2 py-1.5" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">HRA Allowance %</label>
                  <input type="number" value={newSalaryStructure.hra_pct} onChange={e => setNewSalaryStructure({...newSalaryStructure, hra_pct: Number(e.target.value)})} className="w-full border border-slate-200 rounded-lg px-2 py-1.5" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 mb-1">Dearness (DA) %</label>
                  <input type="number" value={newSalaryStructure.da_pct} onChange={e => setNewSalaryStructure({...newSalaryStructure, da_pct: Number(e.target.value)})} className="w-full border border-slate-200 rounded-lg px-2 py-1.5" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Special Allowance</label>
                  <input type="number" value={newSalaryStructure.special_allowance} onChange={e => setNewSalaryStructure({...newSalaryStructure, special_allowance: Number(e.target.value)})} className="w-full border border-slate-200 rounded-lg px-2 py-1.5" />
                </div>
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Grade Level Mapping</label>
                <select value={newSalaryStructure.grade} onChange={e => setNewSalaryStructure({...newSalaryStructure, grade: e.target.value})} className="w-full border border-slate-200 rounded-lg px-2 py-1.5">
                  {['L1','L2','L3','L4','L5','L6'].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <button type="submit" disabled={savingSalaryStructure || !newSalaryStructure.name} className="w-full py-2 bg-indigo-600 text-white font-bold uppercase rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {savingSalaryStructure ? <Spinner /> : 'Save Structure'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  };

  const [statutoryInnerTab, setStatutoryInnerTab] = useState('pf');
  const renderStatutory = () => {
    const pfTotals = statutoryPfList.reduce((acc, r) => ({
      wages: acc.wages + Number(r.wages || 0),
      ee: acc.ee + Number(r.ee_epf_contribution || 0),
      er: acc.er + Number(r.er_epf_contribution || 0),
      eps: acc.eps + Number(r.er_eps_contribution || 0)
    }), { wages: 0, ee: 0, er: 0, eps: 0 });

    const esicTotals = statutoryEsicList.reduce((acc, r) => ({
      wages: acc.wages + Number(r.gross_wages || 0),
      ee: acc.ee + Number(r.ee_contribution || 0),
      er: acc.er + Number(r.er_contribution || 0)
    }), { wages: 0, ee: 0, er: 0 });

    const ptTotals = statutoryPtList.reduce((acc, r) => ({
      gross: acc.gross + Number(r.gross_salary || 0),
      amount: acc.amount + Number(r.pt_amount || 0)
    }), { gross: 0, amount: 0 });

    return (
      <div className="p-4 space-y-4 animate-fadeIn">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <select value={statutoryMonth} onChange={e => { setStatutoryMonth(e.target.value); loadStatutoryData(e.target.value, statutoryYear); }} className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-slate-50">
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={statutoryYear} onChange={e => { setStatutoryYear(Number(e.target.value)); loadStatutoryData(statutoryMonth, Number(e.target.value)); }} className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-slate-50">
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={() => loadStatutoryData(statutoryMonth, statutoryYear)} className="p-1.5 text-indigo-600 hover:bg-slate-50 border border-slate-200 rounded-lg"><RefreshCw size={13} /></button>
          </div>

          <div className="flex gap-2 ml-auto">
            {['pf', 'esic', 'pt'].map(t => (
              <button key={t} onClick={() => setStatutoryInnerTab(t)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  statutoryInnerTab === t ? 'bg-indigo-600 text-white shadow-md' : 'border border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}>
                {t.toUpperCase()} Register
              </button>
            ))}
          </div>
        </div>

        {statutoryInnerTab === 'pf' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <StatCard label="PF Covered Wages" value={inr(pfTotals.wages)} icon={<Shield size={16} />} color="blue" />
              <StatCard label="EE EPF (12%) Share" value={inr(pfTotals.ee)} icon={<IndianRupee size={16} />} color="green" />
              <StatCard label="ER EPF (3.67%) Share" value={inr(pfTotals.er)} icon={<IndianRupee size={16} />} color="orange" />
              <StatCard label="ER EPS (8.33%) Share" value={inr(pfTotals.eps)} icon={<IndianRupee size={16} />} color="purple" />
            </div>
            <DataTable
              columns={[
                { key: 'employee_name', label: 'Employee Name', width: '25%' },
                { key: 'uan', label: 'UAN Identifier', width: '20%', render: (v) => v || '—' },
                { key: 'wages', label: 'Eligible Wages', width: '15%', render: (v) => inr(v) },
                { key: 'ee_epf_contribution', label: 'Employee EPF (12%)', width: '15%', render: (v) => inr(v) },
                { key: 'er_epf_contribution', label: 'Employer EPF (3.67%)', width: '15%', render: (v) => inr(v) },
                { key: 'er_eps_contribution', label: 'EPS Pension (8.33%)', width: '10%', render: (v) => inr(v) }
              ]}
              data={statutoryPfList}
              loading={loadingView}
              emptyMessage="No PF statutory register found for this month."
            />
          </div>
        )}

        {statutoryInnerTab === 'esic' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <StatCard label="ESIC Covered Gross" value={inr(esicTotals.wages)} icon={<Shield size={16} />} color="blue" />
              <StatCard label="EE ESIC (0.75%)" value={inr(esicTotals.ee)} icon={<IndianRupee size={16} />} color="green" />
              <StatCard label="ER ESIC (3.25%)" value={inr(esicTotals.er)} icon={<IndianRupee size={16} />} color="orange" />
            </div>
            <DataTable
              columns={[
                { key: 'employee_name', label: 'Employee Name', width: '30%' },
                { key: 'esic_ip_number', label: 'ESIC IP Number', width: '25%', render: (v) => v || '—' },
                { key: 'gross_wages', label: 'Gross Wages', width: '15%', render: (v) => inr(v) },
                { key: 'ee_contribution', label: 'EE ESIC (0.75%)', width: '15%', render: (v) => inr(v) },
                { key: 'er_contribution', label: 'ER ESIC (3.25%)', width: '15%', render: (v) => inr(v) }
              ]}
              data={statutoryEsicList}
              loading={loadingView}
              emptyMessage="No ESIC statutory register found for this month."
            />
          </div>
        )}

        {statutoryInnerTab === 'pt' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <StatCard label="Gross salary assessed" value={inr(ptTotals.gross)} icon={<Shield size={16} />} color="blue" />
              <StatCard label="PT Tax Collected" value={inr(ptTotals.amount)} icon={<IndianRupee size={16} />} color="purple" />
            </div>
            <DataTable
              columns={[
                { key: 'employee_name', label: 'Employee Name', width: '40%' },
                { key: 'state', label: 'PT Collection State', width: '20%', render: (v) => v || 'HQ Location' },
                { key: 'gross_salary', label: 'PT Gross Salary', width: '20%', render: (v) => inr(v) },
                { key: 'pt_amount', label: 'PT Amount Deducted', width: '20%', render: (v) => inr(v) }
              ]}
              data={statutoryPtList}
              loading={loadingView}
              emptyMessage="No Professional Tax (PT) register found for this month."
            />
          </div>
        )}
      </div>
    );
  };

  const renderReimbursements = () => {
    return (
      <div className="p-4 space-y-4 animate-fadeIn">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <DataTable
              columns={[
                { key: 'employee_name', label: 'Employee Name', width: '25%' },
                { key: 'category', label: 'Category', width: '20%', render: (v) => <Badge value={v} variant="info" /> },
                { key: 'amount', label: 'Claim Amount', width: '15%', render: (v) => inr(v) },
                { key: 'claim_date', label: 'Date Claimed', width: '15%', render: (v) => new Date(v).toLocaleDateString() },
                { key: 'description', label: 'Reason', width: '15%' },
                { key: 'status', label: 'Status', width: '10%', render: (v) => (
                  <Badge value={v} variant={v === 'Approved' ? 'success' : v === 'Rejected' ? 'error' : 'warning'} />
                )},
                {
                  key: 'actions',
                  label: 'Actions',
                  width: '10%',
                  align: 'right',
                  render: (_, r: HrReimbursementClaim) => (
                    r.status === 'Pending' ? (
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={async () => {
                            setReimbursementActionLoading(r.id);
                            try {
                              await hrmsService.approveReimbursement(r.id);
                              addNotification({ type: 'success', message: 'Reimbursement approved!' });
                              loadReimbursements();
                            } catch {
                              addNotification({ type: 'error', message: 'Failed to approve' });
                            } finally {
                              setReimbursementActionLoading(null);
                            }
                          }}
                          disabled={reimbursementActionLoading === r.id}
                          className="p-1 hover:bg-green-50 text-green-600 rounded"
                          title="Approve Claim"
                        >
                          <CheckCircle size={13} />
                        </button>
                      </div>
                    ) : <span className="text-slate-400 text-xs">—</span>
                  )
                }
              ]}
              data={reimbursementsList}
              loading={loadingView}
              emptyMessage="No reimbursement claims."
            />
          </div>

          <div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newReimbursement.employee_id || !newReimbursement.amount) return;
                setSavingReimbursement(true);
                try {
                  const token = localStorage.getItem('accessToken');
                  const url = `${import.meta.env.VITE_API_URL || '/api'}/hr/reimbursements`;
                  const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                      employee_id: newReimbursement.employee_id,
                      category: newReimbursement.category,
                      amount: Number(newReimbursement.amount),
                      description: newReimbursement.description
                    })
                  });
                  const resData = await res.json();
                  if (resData.success) {
                    addNotification({ type: 'success', message: 'Reimbursement claim submitted' });
                    setNewReimbursement({ employee_id: '', category: 'Travel', amount: 0, description: '' });
                    loadReimbursements();
                  } else {
                    addNotification({ type: 'error', message: resData.error || 'Submission failed' });
                  }
                } catch {
                  addNotification({ type: 'error', message: 'Failed to save reimbursement claim' });
                } finally {
                  setSavingReimbursement(false);
                }
              }}
              className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 text-xs"
            >
              <div className="border-b border-slate-100 pb-1.5"><h3 className="font-bold text-slate-800">File Expense Claim</h3></div>
              <div>
                <label className="block text-slate-500 mb-1">Select Employee</label>
                <select value={newReimbursement.employee_id} onChange={e => setNewReimbursement({...newReimbursement, employee_id: e.target.value})} className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5">
                  <option value="">— Select —</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 mb-1">Category</label>
                  <select value={newReimbursement.category} onChange={e => setNewReimbursement({...newReimbursement, category: e.target.value})} className="w-full border border-slate-200 rounded-lg px-2 py-1.5">
                    {['Travel', 'Medical', 'Telephone', 'Internet', 'Meal', 'Misc'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Amount</label>
                  <input type="number" value={newReimbursement.amount || ''} onChange={e => setNewReimbursement({...newReimbursement, amount: Number(e.target.value)})} placeholder="Amount in ₹" className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5" />
                </div>
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Claim Justification</label>
                <textarea value={newReimbursement.description} onChange={e => setNewReimbursement({...newReimbursement, description: e.target.value})} rows={3} placeholder="Explain expense details..." className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 resize-none" />
              </div>
              <button type="submit" disabled={savingReimbursement || !newReimbursement.employee_id || !newReimbursement.amount} className="w-full py-2 bg-indigo-600 text-white font-bold uppercase rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {savingReimbursement ? <Spinner /> : 'Submit Claim'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  };

  const renderBenefits = () => {
    return (
      <div className="p-4 space-y-4 animate-fadeIn">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div>
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Benefit Plans Master</h4>
              <DataTable
                columns={[
                  { key: 'name', label: 'Plan Name', width: '35%' },
                  { key: 'benefit_type', label: 'Plan Type', width: '20%', render: (v) => <Badge value={v} variant="info" /> },
                  { key: 'description', label: 'Details', width: '35%' },
                  { key: 'is_mandatory', label: 'Mandatory', width: '10%', align: 'center', render: (v) => v ? <Badge value="YES" variant="success" /> : <Badge value="NO" variant="neutral" /> }
                ]}
                data={benefitsPlans}
                emptyMessage="No benefit plans defined."
              />
            </div>

            <div>
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Active Enrollments</h4>
              <DataTable
                columns={[
                  { key: 'employee_name', label: 'Employee', width: '30%' },
                  { key: 'plan_name', label: 'Benefit Plan', width: '30%' },
                  { key: 'premium_employee', label: 'EE premium', width: '15%', render: (v) => inr(v) },
                  { key: 'premium_employer', label: 'ER premium', width: '15%', render: (v) => inr(v) },
                  { key: 'status', label: 'Status', width: '10%', render: (v) => <Badge value={v} variant="success" /> }
                ]}
                data={benefitsEnrollments}
                emptyMessage="No active employee enrollments. Enroll someone using the form."
              />
            </div>
          </div>

          <div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!selectedEnrollEmp || !selectedEnrollPlan) return;
                setEnrollingBenefit(true);
                try {
                  await hrmsService.enrollBenefit({
                    employee_id: selectedEnrollEmp,
                    plan_id: selectedEnrollPlan,
                    premium_employee: enrollPremiumEmployee,
                    premium_employer: enrollPremiumEmployer
                  });
                  addNotification({ type: 'success', message: 'Employee enrolled in benefit plan!' });
                  setSelectedEnrollEmp('');
                  setSelectedEnrollPlan('');
                  loadBenefits();
                } catch {
                  addNotification({ type: 'error', message: 'Failed to enroll employee' });
                } finally {
                  setEnrollingBenefit(false);
                }
              }}
              className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 text-xs"
            >
              <div className="border-b border-slate-100 pb-1.5"><h3 className="font-bold text-slate-800">Enroll in Benefit Plan</h3></div>
              <div>
                <label className="block text-slate-500 mb-1">Select Employee</label>
                <select value={selectedEnrollEmp} onChange={e => setSelectedEnrollEmp(e.target.value)} className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5">
                  <option value="">— Select —</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Benefit Plan</label>
                <select value={selectedEnrollPlan} onChange={e => setSelectedEnrollPlan(e.target.value)} className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5">
                  <option value="">— Select —</option>
                  {benefitsPlans.map(p => <option key={p.id} value={p.id}>{p.name} [{p.benefit_type}]</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 mb-1">EE Premium Share</label>
                  <input type="number" value={enrollPremiumEmployee} onChange={e => setEnrollPremiumEmployee(Number(e.target.value))} className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">ER Premium Share</label>
                  <input type="number" value={enrollPremiumEmployer} onChange={e => setEnrollPremiumEmployer(Number(e.target.value))} className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5" />
                </div>
              </div>
              <button type="submit" disabled={enrollingBenefit || !selectedEnrollEmp || !selectedEnrollPlan} className="w-full py-2 bg-indigo-600 text-white font-bold uppercase rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1">
                {enrollingBenefit ? <Spinner /> : <Heart size={13} />} Enroll Staff
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  };

  // ─── view router ──────────────────────────────────────────────────────────
  const renderView = () => {
    switch (activeView) {
      case 'dashboard': return renderDashboard();
      case 'employees': return renderEmployees();
      case 'organization': return renderOrganization();
      case 'documents': return renderDocuments();
      case 'recruitment': return renderATS();
      case 'onboarding': return renderOnboarding();
      case 'offboarding': return renderOffboarding();
      case 'attendance': return renderAttendance();
      case 'leave': return renderLeave();
      case 'shifts': return renderShifts();
      case 'timesheets': return renderTimesheets();
      case 'payroll': return renderPayroll();
      case 'salary': return renderSalaryStructures();
      case 'statutory': return renderStatutory();
      case 'reimbursements': return renderReimbursements();
      case 'incidents': return renderIncidents();
      case 'rewards': return renderRewards();
      case 'benefits': return renderBenefits();
      case 'analytics': return renderAnalytics();
      case 'aiinsights': return renderAIInsights();
      case 'copilot': return (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
          <Brain size={40} className="mb-3 text-indigo-400" />
          <div className="font-semibold text-slate-600">AI Copilot</div>
          <div className="text-xs mt-1">Use the floating button at the bottom-right to open the AI Copilot chat</div>
        </div>
      );
      default: return renderDashboard();
    }
  };

  const activeLabel = sidebarItems.find(s => s.id === activeView)?.label || 'HRMS';

  return (
    <>
      <EnterpriseLayout
        title="HRMS"
        subtitle={activeLabel}
        sidebarItems={sidebarItems}
        showSidebar
        topActions={[
          { label: 'Add Employee', icon: <UserPlus size={13} />, onClick: () => { setActiveView('employees'); addNotification({ type: 'info', message: 'Use the Employees module to add staff' }); } },
          { label: 'Run Payroll', icon: <IndianRupee size={13} />, onClick: () => setActiveView('payroll') },
          { label: 'Analytics', icon: <TrendingUp size={13} />, onClick: () => setActiveView('analytics') },
        ]}
      >
        <div className="flex-1 overflow-y-auto">
          {renderView()}
        </div>
      </EnterpriseLayout>
      <AICopilot addNotification={addNotification} />
    </>
  );
};

export default HRMS;
