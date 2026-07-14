
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, UserPlus, Briefcase, Clock, Calendar, ShieldCheck, 
  Search, Plus, Eye, Edit, Trash2, Filter, Download, 
  TrendingUp, Award, AlertCircle, CheckCircle, Brain, 
  MessageSquare, Send, Activity, ChevronRight, MapPin, Loader2, Sparkles, Zap
} from 'lucide-react';
import ERPLayout from './common/ERPLayout';
import StatCard from './common/StatCard';
import Tabs from './common/Tabs';
import Badge from './common/Badge';
import DataTable from './common/DataTable';
import Modal from './common/Modal';
import { apiClient } from '../services/apiClient';
import { useNotifications } from '../context/NotificationContext';
import { MedicalRepresentative } from '../types';

const HR: React.FC = () => {
  const { addNotification } = useNotifications();
  
  // Tab State
  const [activeTab, setActiveTab] = useState('OVERVIEW');
  const [loading, setLoading] = useState(true);

  // Data States
  const [employees, setEmployees] = useState<MedicalRepresentative[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [predictiveStats, setPredictiveAnalytics] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);

  // AI Copilot States
  const [copilotQuery, setCopilotQuery] = useState('');
  const [copilotChat, setCopilotChat] = useState<{role: 'user'|'ai', text: string}[]>([]);
  const [isAiTyping, setIsAiTyping] = useState(false);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, statRes, predRes, candRes, leaveRes, attRes] = await Promise.all([
        apiClient.get<MedicalRepresentative[]>('/hr/employees'),
        apiClient.get<any>('/hr/performance-stats'),
        apiClient.get<any>('/hr/predictive-analytics'),
        apiClient.get<any[]>('/hr/ats/candidates'),
        apiClient.get<any[]>('/hr/leaves'),
        apiClient.get<any[]>('/hr/attendance')
      ]);

      if (empRes.success) setEmployees(empRes.data);
      if (statRes.success) setStats(statRes.data);
      if (predRes.success) setPredictiveAnalytics(predRes.data);
      if (candRes.success) setCandidates(candRes.data);
      if (leaveRes.success) setLeaves(leaveRes.data);
      if (attRes.success) setAttendance(attRes.data);

    } catch (error) {
      addNotification({ title: 'Sync Error', message: 'Failed to sync HRMS data', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  const handleCopilotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!copilotQuery.trim()) return;

    const userMsg = copilotQuery;
    setCopilotChat(prev => [...prev, { role: 'user', text: userMsg }]);
    setCopilotQuery('');
    setIsAiTyping(true);

    try {
      const res = await apiClient.post<{response: string}>('/hr/copilot', { prompt: userMsg });
      if (res.success) {
        setCopilotChat(prev => [...prev, { role: 'ai', text: res.response }]);
      }
    } catch (err) {
      setCopilotChat(prev => [...prev, { role: 'ai', text: "I'm having trouble connecting to my knowledge base right now." }]);
    } finally {
      setIsAiTyping(false);
    }
  };

  return (
    <ERPLayout
      title="Enterprise HRMS"
      description="Growth-Ready Human Resource Management & AI Command Center"
      isLoading={loading}
      onRefresh={fetchAllData}
    >
      {/* Dynamic Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Active Workforce" value={stats?.activeEmployees || 0} icon={<Users className="text-blue-500"/>} color="blue" trend="+2% Month" />
        <StatCard title="Open Requisitions" value={candidates?.filter((c:any) => c.status !== 'Hired').length || 0} icon={<UserPlus className="text-purple-500"/>} color="purple" trend="ATS Active" />
        <StatCard title="Pending Approvals" value={leaves?.filter((l:any) => l.status === 'Pending').length || 0} icon={<Clock className="text-amber-500"/>} color="warning" trend="Leaves/Visits" />
        <StatCard title="Avg Performance" value={`${Math.round(stats?.averageAchievement || 0)}%`} icon={<TrendingUp className="text-emerald-500"/>} color="success" trend="Target Achievement" />
      </div>

      <Tabs 
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'OVERVIEW', label: 'AI Insights', icon: <Brain size={14}/> },
          { id: 'TALENT', label: 'Talent & ATS', icon: <UserPlus size={14}/> },
          { id: 'WORKFORCE', label: 'Workforce', icon: <Users size={14}/> },
          { id: 'TIME', label: 'Time & Absence', icon: <Calendar size={14}/> },
          { id: 'GOVERNANCE', label: 'Governance', icon: <ShieldCheck size={14}/> },
        ]}
      />

      <div className="mt-6">
        {/* TAB: OVERVIEW & AI */}
        {activeTab === 'OVERVIEW' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
            {/* AI Predictive Analytics */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight mb-6 flex items-center gap-2">
                  <Sparkles size={16} className="text-purple-500" /> AI Workforce Prediction
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="p-4 bg-rose-50 rounded-xl border border-rose-100">
                    <p className="text-[10px] font-bold text-rose-600 uppercase">Attrition Risk</p>
                    <p className="text-2xl font-black text-rose-700 mt-1">{predictiveStats?.flightRisk || 0}</p>
                    <p className="text-[10px] text-rose-500 mt-2 italic">Employees at high flight risk</p>
                  </div>
                  <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                    <p className="text-[10px] font-bold text-indigo-600 uppercase">Hiring Forecast</p>
                    <p className="text-2xl font-black text-indigo-700 mt-1">+{predictiveStats?.hiringForecast || 0}</p>
                    <p className="text-[10px] text-indigo-500 mt-2 italic">Predicted need for Q3</p>
                  </div>
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase">Promotion Ready</p>
                    <p className="text-2xl font-black text-emerald-700 mt-1">{predictiveStats?.promotionReady || 0}</p>
                    <p className="text-[10px] text-emerald-500 mt-2 italic">High performing star-reps</p>
                  </div>
                </div>
              </div>

              {/* Productivity Feed */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                 <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Real-time Performance Feed</h3>
                    <Badge text="LIVE" variant="success" />
                 </div>
                 <div className="divide-y divide-slate-100">
                    {employees.slice(0, 5).map(emp => (
                      <div key={emp.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"><Users size={14}/></div>
                           <div>
                              <p className="text-sm font-bold text-slate-800">{emp.name}</p>
                              <p className="text-[10px] font-bold text-slate-400">{emp.assignedArea}</p>
                           </div>
                        </div>
                        <div className="text-right">
                           <p className="text-xs font-bold text-slate-700">{emp.targetAchievement}%</p>
                           <div className="w-24 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                              <div className={`h-full ${emp.targetAchievement > 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{width: `${Math.min(emp.targetAchievement, 100)}%`}}></div>
                           </div>
                        </div>
                      </div>
                    ))}
                 </div>
              </div>
            </div>

            {/* AI Copilot Chat */}
            <div className="bg-slate-900 rounded-2xl flex flex-col h-[500px] border border-slate-800 shadow-xl overflow-hidden">
               <div className="p-4 bg-slate-800/50 border-b border-slate-700 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                     <Brain size={18} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">Enterprise HR Copilot</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Always Active Assistant</p>
                  </div>
               </div>
               
               <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-900/50">
                  {copilotChat.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6">
                       <MessageSquare className="text-slate-700 mb-4" size={48} />
                       <p className="text-xs font-bold text-slate-500 uppercase leading-relaxed tracking-widest">
                          Ask me about leave policies, employee performance, or hiring forecasts.
                       </p>
                    </div>
                  )}
                  {copilotChat.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                       <div className={`max-w-[85%] p-3 rounded-2xl text-xs font-medium ${
                         msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'
                       }`}>
                         {msg.text}
                       </div>
                    </div>
                  ))}
                  {isAiTyping && (
                    <div className="flex justify-start">
                       <div className="bg-slate-800 text-slate-400 p-3 rounded-2xl">
                          <Loader2 size={14} className="animate-spin" />
                       </div>
                    </div>
                  )}
               </div>

               <form onSubmit={handleCopilotSubmit} className="p-4 border-t border-slate-800 bg-slate-900">
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="Ask Copilot..."
                      className="w-full bg-slate-800 border-none rounded-xl pl-4 pr-12 py-3 text-xs text-white placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      value={copilotQuery}
                      onChange={e => setCopilotQuery(e.target.value)}
                    />
                    <button 
                      type="submit"
                      disabled={!copilotQuery.trim() || isAiTyping}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-500 hover:text-blue-400 disabled:opacity-30 transition-colors"
                    >
                      <Send size={18} />
                    </button>
                  </div>
               </form>
            </div>
          </div>
        )}

        {/* TAB: TALENT & ATS */}
        {activeTab === 'TALENT' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
               <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Active Recruitment Pipeline</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Manage candidates and hiring flow</p>
               </div>
               <button className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2">
                  <Plus size={14}/> Create Requisition
               </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {['Sourced', 'Interviewing', 'Offered', 'Hired'].map(status => (
                <div key={status} className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{status}</h4>
                    <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                      {candidates.filter(c => c.status === status).length}
                    </span>
                  </div>
                  <div className="space-y-3 min-h-[400px] p-2 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                    {candidates.filter(c => c.status === status).map(cand => (
                      <div key={cand.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm group hover:border-blue-400 transition-all cursor-pointer">
                         <p className="text-xs font-bold text-slate-800">{cand.name}</p>
                         <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">{cand.role_applied}</p>
                         <div className="mt-3 flex items-center justify-between pt-3 border-t border-slate-50">
                            <div className="flex items-center gap-1.5 text-[9px] font-black text-emerald-600">
                               <Zap size={10}/> {cand.ai_score}% Match
                            </div>
                            <button className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-600 transition-all">
                               <ChevronRight size={14}/>
                            </button>
                         </div>
                      </div>
                    ))}
                    {candidates.filter(c => c.status === status).length === 0 && (
                      <div className="h-full flex items-center justify-center p-8 text-center">
                         <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest leading-relaxed">No candidates in this stage</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: WORKFORCE */}
        {activeTab === 'WORKFORCE' && (
           <div className="space-y-4 animate-fadeIn">
              <div className="flex justify-between items-center">
                 <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                    <input type="text" placeholder="Search employees..." className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none" />
                 </div>
                 <div className="flex gap-2">
                    <button className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"><Filter size={18}/></button>
                    <button className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"><Download size={18}/></button>
                 </div>
              </div>
              
              <DataTable 
                columns={[
                  { key: 'name', label: 'Employee Profile', width: '30%', render: (v, row) => (
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-black text-[10px]">
                          {v.split(' ').map((n:string) => n[0]).join('')}
                       </div>
                       <div>
                          <p className="text-sm font-bold text-slate-800">{v}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{row.email}</p>
                       </div>
                    </div>
                  )},
                  { key: 'assignedArea', label: 'Designation / Area', width: '25%', render: (v) => (
                    <div>
                       <p className="text-xs font-bold text-slate-700">Medical Representative</p>
                       <p className="text-[10px] font-medium text-slate-400 flex items-center gap-1 mt-0.5"><MapPin size={10}/> {v}</p>
                    </div>
                  )},
                  { key: 'status', label: 'Status', width: '15%', render: (v) => <Badge text={v} variant={v === 'Active' ? 'success' : 'neutral'} /> },
                  { key: 'targetAchievement', label: 'AI Risk', width: '15%', render: (v) => (
                     v < 70 ? <Badge text="HIGH RISK" variant="danger" /> : <Badge text="STABLE" variant="success" />
                  )},
                  { key: 'id', label: 'Actions', width: '15%', align: 'right', render: () => (
                    <div className="flex justify-end gap-2">
                       <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><Eye size={16}/></button>
                       <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"><Edit size={16}/></button>
                    </div>
                  )}
                ]}
                data={employees}
              />
           </div>
        )}

        {/* TAB: TIME & ABSENCE */}
        {activeTab === 'TIME' && (
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
              <div className="lg:col-span-2 space-y-6">
                 {/* Recent Attendance */}
                 <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                       <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2"><Clock size={16} className="text-blue-500"/> Workforce Attendance Log</h3>
                       <button className="text-xs font-bold text-blue-600 hover:underline">View All Logs</button>
                    </div>
                    <div className="overflow-x-auto">
                       <table className="w-full text-left border-collapse">
                          <thead>
                             <tr className="bg-slate-50/50">
                                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee</th>
                                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Clock In</th>
                                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</th>
                                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                             {attendance.length === 0 ? (
                               <tr><td colSpan={4} className="p-8 text-center text-xs font-bold text-slate-300 uppercase tracking-widest">No attendance logged today</td></tr>
                             ) : attendance.map(att => (
                               <tr key={att.id} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="px-6 py-4 text-xs font-bold text-slate-800">{att.employee_name}</td>
                                  <td className="px-6 py-4 text-xs font-medium text-slate-600">{new Date(att.clock_in).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                                  <td className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">{att.location_in || 'Headquarters'}</td>
                                  <td className="px-6 py-4"><Badge text={att.status} variant="success" /></td>
                               </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                 </div>

                 {/* Leave Requests */}
                 <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="p-5 border-b border-slate-100">
                       <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2"><Calendar size={16} className="text-rose-500"/> Open Leave Requests</h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                       {leaves.filter(l => l.status === 'Pending').map(leave => (
                         <div key={leave.id} className="p-5 flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                               <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex flex-col items-center justify-center font-black">
                                  <span className="text-[10px] leading-none">{new Date(leave.start_date).toLocaleString('default', { month: 'short' }).toUpperCase()}</span>
                                  <span className="text-lg leading-none mt-0.5">{new Date(leave.start_date).getDate()}</span>
                               </div>
                               <div>
                                  <p className="text-sm font-bold text-slate-800">{leave.employee_name}</p>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase">{leave.leave_type} · {leave.days} Day(s)</p>
                               </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                               <button className="px-3 py-1.5 bg-slate-900 text-white text-[10px] font-black uppercase rounded-lg hover:bg-slate-800">Approve</button>
                               <button className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase rounded-lg hover:bg-slate-50">Decline</button>
                            </div>
                         </div>
                       ))}
                       {leaves.filter(l => l.status === 'Pending').length === 0 && (
                          <div className="p-12 text-center">
                             <CheckCircle size={32} className="mx-auto text-slate-200 mb-2" />
                             <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">No pending leave requests</p>
                          </div>
                       )}
                    </div>
                 </div>
              </div>

              {/* Workforce Distribution */}
              <div className="space-y-6">
                 <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Absence Insights</h4>
                    <div className="space-y-4">
                       <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-600">Sick Leave (Month)</span>
                          <span className="text-xs font-black text-slate-900">12 Days</span>
                       </div>
                       <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500" style={{width: '45%'}}></div>
                       </div>
                       <div className="flex justify-between items-center pt-2">
                          <span className="text-xs font-bold text-slate-600">Casual Leave (Month)</span>
                          <span className="text-xs font-black text-slate-900">8 Days</span>
                       </div>
                       <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500" style={{width: '30%'}}></div>
                       </div>
                    </div>
                 </div>

                 <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-6 text-white shadow-xl shadow-blue-900/20">
                    <h4 className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-4">Pro-Tip</h4>
                    <p className="text-xs font-medium leading-relaxed">
                       AI predicts a 15% increase in leave requests for the upcoming week based on local holiday schedules. Consider adjusting sales coverage.
                    </p>
                 </div>
              </div>
           </div>
        )}

        {/* TAB: GOVERNANCE */}
        {activeTab === 'GOVERNANCE' && (
           <div className="bg-white rounded-2xl border border-slate-200 shadow-sm animate-fadeIn min-h-[400px] flex flex-col items-center justify-center p-12 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-6">
                 <ShieldCheck size={48} />
              </div>
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Governance & Risk Module</h3>
              <p className="max-w-md text-slate-500 text-sm mt-3 leading-relaxed">
                 Centralized tracking for disciplinary actions, grievances, and safety incidents will be fully enabled in the next deployment.
              </p>
              <div className="mt-8 flex gap-4">
                 <Badge text="0 ACTIVE GRIEVANCES" variant="success" />
                 <Badge text="STRICT COMPLIANCE" variant="info" />
              </div>
           </div>
        )}
      </div>
    </ERPLayout>
  );
};

export default HR;
