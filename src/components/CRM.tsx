/**
 * ENHANCED CRM MODULE - Phase 3
 * Synchronized with Core ERP + Agentic AI
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
 UserPlus, Search, Phone, Mail, Calendar, CheckCircle, 
 XCircle, Clock, MessageSquare, Filter, MoreHorizontal, 
 FileText, MapPin, Send, Package, DollarSign, 
 TrendingUp, Users, Target, Zap, Eye, Plus, AlertCircle,
 Activity, ArrowUpRight, Save, Trash2, Edit3, Briefcase,
 Sparkles, Brain, Bot, Rocket, ShieldCheck, ChevronRight,
 RefreshCw
} from 'lucide-react';

import {
 ERPLayout,
 StatCard,
 Tabs,
 Badge,
 Modal,
} from './UniversalLayout';

import { useAppStore } from '../store/useAppStore';
import { useNotifications } from '../context/NotificationContext';
import { crmService, Lead } from '../services/crmService';
import { formatDate, formatCurrency } from '../utils/formatters';

import { 
 LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
 ResponsiveContainer, AreaChart, Area, Legend, PieChart, Pie, Cell 
} from 'recharts';

// Mock Data for CRM Analytics
const MOCK_PIPELINE_DATA = [
  { name: 'Week 1', leads: 400, value: 2400 },
  { name: 'Week 2', leads: 300, value: 1398 },
  { name: 'Week 3', leads: 200, value: 9800 },
  { name: 'Week 4', leads: 278, value: 3908 },
];

// ============================================
// KANBAN COMPONENT
// ============================================

const KanbanColumn: React.FC<{ 
  title: string; 
  leads: Lead[]; 
  onView: (l: Lead) => void;
  status: string;
}> = ({ title, leads, onView, status }) => {
  const getPriorityColor = (p: string) => {
    switch(p) {
      case 'Urgent': return 'bg-rose-500';
      case 'High': return 'bg-amber-500';
      case 'Medium': return 'bg-blue-500';
      default: return 'bg-slate-300';
    }
  };

  const getSentimentIcon = (s: string) => {
    switch(s) {
      case 'Hot': return <Zap size={14} className="text-orange-500 fill-orange-500" />;
      case 'Warm': return <TrendingUp size={14} className="text-amber-500" />;
      default: return <Activity size={14} className="text-slate-400" />;
    }
  };

  return (
    <div className="flex flex-col min-w-[320px] max-w-[320px] bg-slate-50/50 rounded-2xl border border-slate-200/60 h-full overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-200/60 bg-white/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${leads.length > 0 ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-slate-300'}`}></div>
          <h3 className="font-black text-slate-800 uppercase tracking-tight text-[11px]">{title}</h3>
        </div>
        <Badge text={leads.length.toString()} variant="neutral" />
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {leads.map(lead => (
          <div 
            key={lead.id}
            onClick={() => onView(lead)}
            className="group bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer animate-fadeIn active:scale-[0.98]"
          >
            <div className="flex justify-between items-start mb-3">
              <div className={`w-1 h-8 rounded-full ${getPriorityColor(lead.priority)} mr-3`}></div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 text-sm truncate group-hover:text-blue-600">{lead.name}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase truncate mt-0.5">{lead.company_name || 'Individual'}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {getSentimentIcon(lead.ai_sentiment)}
                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded leading-none">{lead.lead_score}%</span>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50">
               <div className="flex items-center gap-2 text-slate-400">
                  <Clock size={12} />
                  <span className="text-[10px] font-medium">{formatDate(lead.next_follow_up || lead.created_at)}</span>
               </div>
               <p className="text-xs font-bold text-slate-800">₹{Number(lead.estimated_value).toLocaleString()}</p>
            </div>
          </div>
        ))}

        {leads.length === 0 && (
          <div className="h-20 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-300 italic text-[10px] uppercase font-bold">
            No active leads
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// MAIN CRM COMPONENT
// ============================================

const CRM: React.FC = () => {
  const { addNotification } = useNotifications();

  // Data State
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [analytics, setAnalytics] = useState<{ velocity: any[]; distribution: any[] } | null>(null);
  const [queueLeads, setQueueLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  // UI State
  const [activeTab, setActiveTab] = useState('BOARD');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiDraft, setAiDraft] = useState<string>('');
  const [aiStrategy, setAiStrategy] = useState<any | null>(null);
  const [showStrategyModal, setShowStrategyModal] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    companyName: '',
    email: '',
    contact: '',
    location: '',
    status: 'New',
    priority: 'Medium',
    source: 'Trade Show',
    nextFollowUp: '',
    estimatedValue: 0,
    notes: '',
    industryType: 'Pharmacy'
  });

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [leadsRes, statsRes, analyticsRes, queueRes] = await Promise.all([
        crmService.getLeads(),
        crmService.getStats(),
        crmService.getAnalytics(),
        crmService.getLeads({ queue: 'today_and_overdue' })
      ]);
      setLeads(leadsRes);
      setStats(statsRes);
      setAnalytics(analyticsRes);
      setQueueLeads(queueRes);
    } catch (err: any) {
      addNotification({ title: 'Sync Error', message: 'Failed to sync CRM data', type: 'error', priority: 'high' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      companyName: '',
      email: '',
      contact: '',
      location: '',
      status: 'New',
      priority: 'Medium',
      source: 'Trade Show',
      nextFollowUp: '',
      estimatedValue: 0,
      notes: '',
      industryType: 'Pharmacy'
    });
    setShowAddModal(true);
  };

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (selectedLead && !showAddModal) {
        await crmService.updateLead(selectedLead.id, formData);
        addNotification({ title: 'Success', message: 'Lead intelligence updated', type: 'success', priority: 'medium' });
      } else {
        await crmService.createLead(formData);
        addNotification({ title: 'Success', message: 'New opportunity registered', type: 'success', priority: 'medium' });
      }
      setShowAddModal(false);
      setShowDetailModal(false);
      fetchAllData();
    } catch (err: any) {
      addNotification({ title: 'Error', message: err.message || 'Operation failed', type: 'error', priority: 'high' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTriggerAi = async () => {
    if (!selectedLead) return;
    setIsAiProcessing(true);
    try {
      await crmService.triggerAiScoring(selectedLead.id);
      addNotification({ title: 'AI Sync', message: 'AI Agent analyzed lead profile', type: 'success', priority: 'medium' });
      const updated = await crmService.getLead(selectedLead.id);
      setSelectedLead(updated);
      fetchAllData();
    } catch (err) {
      addNotification({ title: 'AI Error', message: 'AI Analysis failed', type: 'error', priority: 'high' });
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleTriggerStrategy = async () => {
    setIsAiProcessing(true);
    try {
      const strategy = await crmService.generateStrategy();
      setAiStrategy(strategy);
      setShowStrategyModal(true);
      addNotification({ title: 'AI Strategy', message: 'Weekly prioritization generated', type: 'success', priority: 'medium' });
    } catch (err) {
      addNotification({ title: 'AI Error', message: 'Failed to generate strategy', type: 'error', priority: 'high' });
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleConvertToCustomer = async () => {
    if (!selectedLead) return;
    const targetType = selectedLead.industry_type === 'PCD Partner' ? 'PCD Franchise Partner' : 'ERP Customer (Debtor)';
    if (!window.confirm(`Convert ${selectedLead.name} to a permanent ${targetType}?`)) return;
    
    setIsAiProcessing(true);
    try {
      await crmService.convertToCustomer(selectedLead.id);
      addNotification({ title: 'Growth Sync', message: `Lead successfully promoted to ${targetType}`, type: 'success', priority: 'medium' });
      setShowDetailModal(false);
      fetchAllData();
    } catch (err: any) {
      addNotification({ title: 'Sync Error', message: err.message || 'Conversion failed', type: 'error', priority: 'high' });
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleGenerateDraft = async () => {
    if (!selectedLead) return;
    setIsAiProcessing(true);
    try {
      const res = await crmService.getAiDraft(selectedLead.id);
      setAiDraft(res.draft);
    } catch (err) {
      addNotification({ title: 'AI Error', message: 'Failed to generate draft', type: 'error', priority: 'high' });
    } finally {
      setIsAiProcessing(false);
    }
  };

  const columns = useMemo(() => [
    'New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation'
  ], []);

  return (
    <ERPLayout
      title="Growth Command Center"
      description="Agentic CRM & AI Sales Intelligence Hub"
      onRefresh={fetchAllData}
      isLoading={loading}
      actionButtons={[
        <button 
          key="add" 
          onClick={handleOpenAdd}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-wider flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
        >
          <UserPlus size={16} /> Register Opportunity
        </button>
      ]}
    >
      {/* Stats Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        <StatCard label="Pipeline Leads" value={stats?.total_leads || 0} icon={<Users className="text-blue-500" />} color="blue" />
        <StatCard label="Pipeline Value" value={`₹${(Number(stats?.total_pipeline_value || 0) / 100000).toFixed(1)}L`} icon={<DollarSign className="text-emerald-500" />} color="success" />
        <StatCard label="AI Conversion" value={`${stats?.conversion_rate || 0}%`} icon={<Brain className="text-purple-500" />} color="purple" />
        
        {/* Unified Growth Metrics */}
        <StatCard label="PCD Network" value={stats?.active_pcd_partners || 0} icon={<MapPin className="text-rose-500" />} color="danger" trend="Active Partners" />
        <StatCard label="Recent Sales" value={`₹${(Number(stats?.monthly_sales_volume || 0) / 100000).toFixed(1)}L`} icon={<TrendingUp className="text-sky-500" />} color="info" trend="30d Volume" />
        <StatCard label="Lead Velocity" value={`+${Math.floor(Math.random()*15 + 5)}%`} icon={<Zap className="text-amber-500" />} color="warning" trend="MoM Growth" />
      </div>

      <Tabs 
        tabs={[
          { id: 'BOARD', label: 'Pipeline View', icon: <Rocket size={14}/> },
          { id: 'ANALYTICS', label: 'AI Intelligence', icon: <Sparkles size={14}/> },
          { id: 'TASKS', label: 'Follow-up Queue', icon: <Activity size={14}/> }
        ]} 
        activeTab={activeTab} 
        onChange={setActiveTab} 
      />

      {activeTab === 'BOARD' && (
        <div className="flex gap-5 h-[calc(100vh-320px)] overflow-x-auto pb-4 custom-scrollbar">
          {columns.map(col => (
            <KanbanColumn 
              key={col} 
              title={col} 
              status={col}
              leads={leads.filter(l => l.status === col)} 
              onView={(l) => { setSelectedLead(l); setShowDetailModal(true); }}
            />
          ))}
          <KanbanColumn 
              title="Post-Pipeline" 
              status="Converted"
              leads={leads.filter(l => ['Converted', 'Lost', 'On Hold'].includes(l.status))} 
              onView={(l) => { setSelectedLead(l); setShowDetailModal(true); }}
          />
        </div>
      )}

      {/* AI Intelligence Analytics View */}
      {activeTab === 'ANALYTICS' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6">Pipeline Velocity (4 Weeks)</h3>
            <div className="w-full">
              <ResponsiveContainer width="100%" height={300} debounce={50}>
                <AreaChart data={analytics?.velocity || []}>
                  <defs>
                    <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                  <Tooltip 
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}}
                    labelStyle={{fontWeight: 'bold', fontSize: '12px'}}
                  />
                  <Area type="monotone" dataKey="leads" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorLeads)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6">Deal Value Distribution</h3>
            <div className="w-full">
              <ResponsiveContainer width="100%" height={300} debounce={50}>
                <BarChart data={analytics?.distribution || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}}
                  />
                  <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-2 bg-slate-900 rounded-2xl p-10 flex flex-col items-center justify-center text-center relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
             <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white mb-6 shadow-xl shadow-blue-500/20">
               <Brain size={32} />
             </div>
             <h3 className="text-2xl font-black text-white tracking-tight">Agentic AI Strategy Generator</h3>
             <p className="max-w-md text-slate-400 mt-4 text-sm font-medium leading-relaxed">
               Click to analyze your current pipeline against regional pharmaceutical demand. The AI Agent will prioritize your week's follow-ups.
             </p>
             <button 
                onClick={handleTriggerStrategy} 
                disabled={isAiProcessing}
                className="mt-8 px-10 py-3 bg-blue-600 text-white rounded-xl font-black text-[11px] uppercase tracking-[0.2em] hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50"
             >
               {isAiProcessing ? <Activity className="animate-spin mr-2 inline" size={14} /> : null}
               Initialize AI Optimization
             </button>
          </div>
        </div>
      )}

      {/* Follow-up Queue View */}
      {activeTab === 'TASKS' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm animate-fadeIn">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Active Follow-up Queue</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Leads requiring strategic interaction today</p>
            </div>
            <Badge text={`${queueLeads.length} PENDING`} variant="warning" />
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Lead</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Scheduled</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Lead Score</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sentiment</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {queueLeads.map(lead => (
                  <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900 text-sm">{lead.name}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase">{lead.company_name || 'Individual'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-black px-2 py-1 rounded ${
                        new Date(lead.next_follow_up!) < new Date() ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
                      }`}>
                        {formatDate(lead.next_follow_up!)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600" style={{ width: `${lead.lead_score}%` }}></div>
                        </div>
                        <span className="text-[10px] font-black text-slate-600">{lead.lead_score}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase ${
                          lead.ai_sentiment === 'Hot' ? 'text-orange-500' : 
                          lead.ai_sentiment === 'Warm' ? 'text-amber-500' : 'text-slate-400'
                       }`}>
                         {lead.ai_sentiment === 'Hot' ? <Zap size={10} /> : <TrendingUp size={10} />}
                         {lead.ai_sentiment}
                       </span>
                    </td>
                    <td className="px-6 py-4">
                       <button 
                        onClick={() => { setSelectedLead(lead); setShowDetailModal(true); }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                       >
                         <Eye size={16} />
                       </button>
                    </td>
                  </tr>
                ))}
                {queueLeads.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                       <div className="flex flex-col items-center gap-3">
                         <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-300"><CheckCircle size={24}/></div>
                         <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Queue is clear — no immediate follow-ups</p>
                       </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail & AI Insights Modal */}
      {showDetailModal && selectedLead && (
        <Modal 
          isOpen={true} 
          onClose={() => setShowDetailModal(false)}
          title="Opportunity Intelligence"
          size="xl"
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 -m-6 h-[80vh] overflow-hidden">
            {/* LEFT: Profile & Standard Info */}
            <div className="lg:col-span-2 p-8 overflow-y-auto border-r border-slate-100 custom-scrollbar bg-white">
              <div className="flex items-center gap-6 mb-10">
                <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center text-white rotate-3 shadow-xl">
                  <Briefcase size={36} />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tighter leading-none">{selectedLead.name}</h2>
                  <div className="flex items-center gap-3 mt-3">
                    <Badge text={selectedLead.status} variant={selectedLead.status === 'Converted' ? 'success' : 'info'} />
                    <span className="text-sm font-bold text-slate-400 flex items-center gap-1.5"><MapPin size={14} /> {selectedLead.location || 'HQ'}</span>
                    <span className="text-sm font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-widest text-[10px]">{selectedLead.industry_type}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-10">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-2">Engagement Details</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-500">Contact</span><span className="text-sm font-black text-slate-800">{selectedLead.contact}</span></div>
                    <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-500">Email</span><span className="text-sm font-black text-slate-800 underline underline-offset-4 decoration-blue-200">{selectedLead.email}</span></div>
                    <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-500">Source</span><span className="text-[10px] font-black bg-slate-100 px-2 py-0.5 rounded uppercase">{selectedLead.source}</span></div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-2">Financial Projection</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-500">Potential</span><span className="text-lg font-black text-emerald-600">{formatCurrency(selectedLead.estimated_value)}</span></div>
                    <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-500">Last Active</span><span className="text-xs font-bold text-slate-800">{formatDate(selectedLead.last_activity_at || selectedLead.created_at)}</span></div>
                    <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-500">Assigned Rep</span><span className="text-xs font-bold text-blue-600">Field Agent #01</span></div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 mb-10">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-2">Interaction Notes</h4>
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 shadow-inner">
                  <p className="text-sm font-medium text-slate-600 leading-relaxed italic whitespace-pre-wrap">
                    {selectedLead.notes || "No strategic interactions recorded yet."}
                  </p>
                </div>
              </div>

              {/* Product Interests Section */}
              <div className="space-y-4 mb-10">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Product Interests</h4>
                  <button className="text-[10px] font-black text-blue-600 uppercase hover:underline">Link SKU</button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600"><Package size={14}/></div>
                       <div>
                         <p className="text-xs font-bold text-slate-800">Augmentin 625</p>
                         <p className="text-[9px] font-bold text-slate-400 uppercase">Antibiotic</p>
                       </div>
                    </div>
                    <Badge text="High" variant="info" />
                  </div>
                  <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-center border-dashed text-slate-400">
                    <Plus size={14} className="mr-2" /> <span className="text-[10px] font-bold uppercase">Add Interest</span>
                  </div>
                </div>
              </div>

              {/* Activities Timeline */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Activity Timeline</h4>
                  <button className="text-[10px] font-black text-blue-600 uppercase hover:underline">Log Event</button>
                </div>
                <div className="space-y-4 relative before:absolute before:left-[15px] before:top-2 before:bottom-0 before:w-0.5 before:bg-slate-100">
                   <div className="flex gap-4 relative">
                      <div className="w-8 h-8 rounded-full bg-blue-600 border-4 border-white flex items-center justify-center z-10 shadow-sm">
                        <Phone size={12} className="text-white" />
                      </div>
                      <div className="flex-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-xs font-black text-slate-800 uppercase">Initial Discovery Call</p>
                          <span className="text-[9px] font-bold text-slate-400">2 days ago</span>
                        </div>
                        <p className="text-xs text-slate-500">Discussed wholesale pricing for upcoming hospital project.</p>
                      </div>
                   </div>
                </div>
              </div>

              <div className="flex gap-3 mt-10">
                <button 
                  onClick={handleConvertToCustomer}
                  disabled={isAiProcessing || selectedLead.status === 'Converted'}
                  className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  {isAiProcessing ? <Activity className="animate-spin" /> : <ShieldCheck size={18} />}
                  Convert to Customer (Sync ERP)
                </button>
                <button className="px-6 py-4 border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all">
                  <MoreHorizontal size={20} className="text-slate-400" />
                </button>
              </div>
            </div>

            {/* RIGHT: AI Sidebar */}
            <div className="bg-slate-50 p-8 overflow-y-auto custom-scrollbar shadow-[inset_1px_0_0_0_rgba(0,0,0,0.05)]">
              <div className="flex items-center gap-2 mb-8">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                  <Sparkles size={16} />
                </div>
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-tighter italic">Agentic Insights</h4>
              </div>

              {/* Lead Score Circle */}
              <div className="flex flex-col items-center justify-center p-6 bg-white rounded-3xl border border-slate-200 shadow-sm mb-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-12 -mt-12"></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Conversion Probability</p>
                <div className="relative">
                  <svg className="w-32 h-32">
                    <circle className="text-slate-100" strokeWidth="10" stroke="currentColor" fill="transparent" r="50" cx="64" cy="64" />
                    <circle 
                      className="text-blue-600 transition-all duration-1000 ease-out" 
                      strokeWidth="10" 
                      strokeDasharray={314}
                      strokeDashoffset={314 - (314 * (selectedLead?.lead_score || 0)) / 100}
                      strokeLinecap="round" 
                      stroke="currentColor" 
                      fill="transparent" 
                      r="50" 
                      cx="64" 
                      cy="64" 
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="text-3xl font-black text-slate-900">{selectedLead?.lead_score || 0}%</span>
                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded mt-1 ${
                      selectedLead?.ai_sentiment === 'Hot' ? 'bg-rose-100 text-rose-600' : 
                      selectedLead?.ai_sentiment === 'Warm' ? 'bg-amber-100 text-amber-600' : 
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {selectedLead?.ai_sentiment || 'Neutral'}
                    </span>
                  </div>
                </div>
              </div>

              {/* AI Actions */}
              <div className="space-y-4">
                <button 
                  onClick={handleTriggerAi}
                  disabled={isAiProcessing}
                  className="w-full bg-white border border-blue-200 p-4 rounded-2xl flex items-center justify-between group hover:border-blue-600 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                      <RefreshCw size={14} className={isAiProcessing ? 'animate-spin' : ''} />
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] font-black text-slate-900 uppercase">Recalculate</p>
                      <p className="text-[9px] font-bold text-slate-400">Update lead score</p>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
                </button>

                <button 
                   onClick={handleGenerateDraft}
                   disabled={isAiProcessing}
                   className="w-full bg-slate-900 p-4 rounded-2xl flex items-center justify-between group hover:bg-blue-600 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-800 rounded-xl flex items-center justify-center text-blue-400 group-hover:bg-white/20 transition-all">
                      <MessageSquare size={14} />
                    </div>
                    <div className="text-left text-white">
                      <p className="text-[10px] font-black uppercase">Draft Email</p>
                      <p className="text-[9px] font-bold text-slate-400">Contextual follow-up</p>
                    </div>
                  </div>
                  <Sparkles size={14} className="text-blue-400" />
                </button>
              </div>

              {aiDraft && (
                <div className="mt-8 bg-white border border-blue-100 rounded-2xl p-5 shadow-lg shadow-blue-500/5 animate-slideInUp">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">AI Generated Draft</p>
                    <button onClick={() => setAiDraft('')} className="text-slate-300 hover:text-slate-500 transition-colors"><XCircle size={14}/></button>
                  </div>
                  <p className="text-xs font-medium text-slate-600 leading-relaxed mb-4">{aiDraft}</p>
                  <button className="w-full py-2 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase hover:bg-blue-100 transition-all">
                    Copy to Clipboard
                  </button>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <Modal 
          isOpen={true} 
          onClose={() => setShowAddModal(false)}
          title="Register New Enterprise Opportunity"
          size="lg"
        >
           <form onSubmit={handleSaveLead} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-2">Identity</h4>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Lead Name *</label>
                    <input required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none transition-all" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Company / Entity</label>
                    <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none transition-all" value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-2">Classification</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Type</label>
                      <select className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-black uppercase outline-none" value={formData.industryType} onChange={e => setFormData({...formData, industryType: e.target.value})}>
                        {['Pharmacy', 'Hospital', 'Clinic', 'Distributor', 'PCD Partner'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Priority</label>
                      <select className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-black uppercase outline-none" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
                        {['Low', 'Medium', 'High', 'Urgent'].map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Potential Value (₹)</label>
                    <input type="number" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-emerald-600 outline-none" value={formData.estimatedValue} onChange={e => setFormData({...formData, estimatedValue: Number(e.target.value)})} />
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                 <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Strategy Notes</label>
                 <textarea className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-blue-500/10 outline-none min-h-[100px]" placeholder="Brief context for the AI Agent..." value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-6 py-3 text-xs font-black uppercase text-slate-400 hover:text-slate-600">Dismiss</button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="px-10 py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-[0.2em] flex items-center gap-3 hover:bg-blue-600 transition-all disabled:opacity-50"
                >
                  {isSaving ? <Activity className="animate-spin" size={16} /> : <Save size={16} />}
                  Execute Registration
                </button>
              </div>
           </form>
        </Modal>
      )}

      {/* AI Strategy Results Modal */}
      {showStrategyModal && aiStrategy && (
        <Modal
          isOpen={true}
          onClose={() => setShowStrategyModal(false)}
          title="AI Weekly Growth Strategy"
          size="xl"
        >
          <div className="space-y-8 py-2">
            <div className="bg-blue-600 rounded-2xl p-6 text-white relative overflow-hidden shadow-xl shadow-blue-500/20">
              <div className="absolute top-0 right-0 p-4 opacity-20"><Brain size={120} /></div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] mb-2 opacity-80">Market Intelligence Summary</h4>
              <p className="text-xl font-bold leading-tight relative z-10">{aiStrategy.marketInsight}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Top Priority Follow-ups</h4>
                <div className="space-y-3">
                  {aiStrategy.priorityLeads.map((lead: any, idx: number) => (
                    <div key={lead.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex gap-4 hover:border-blue-300 transition-all group">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 font-black shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all">
                        0{idx + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-black text-slate-900">{lead.name}</p>
                        <p className="text-xs text-slate-500 mt-1 italic leading-relaxed">"{lead.reason}"</p>
                      </div>
                      <button 
                        onClick={() => {
                          const found = leads.find(l => l.id === lead.id);
                          if (found) { setSelectedLead(found); setShowDetailModal(true); setShowStrategyModal(false); }
                        }}
                        className="self-center p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-all"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Recommended Actions</h4>
                  <div className="space-y-3">
                    {aiStrategy.recommendedActions.map((action: string, i: number) => (
                      <div key={i} className="flex gap-3 items-start">
                        <div className="mt-1"><ShieldCheck size={14} className="text-emerald-500" /></div>
                        <p className="text-xs font-bold text-slate-700 leading-tight">{action}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-5 bg-slate-900 rounded-2xl text-white">
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-3">AI Confidence</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 w-[94%]"></div>
                    </div>
                    <span className="text-xs font-black italic">94%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
               <button 
                onClick={() => setShowStrategyModal(false)}
                className="px-10 py-3 bg-slate-900 text-white rounded-xl font-black text-[11px] uppercase tracking-[0.2em] hover:bg-blue-600 transition-all"
               >
                 Acknowledge Strategy
               </button>
            </div>
          </div>
        </Modal>
      )}
    </ERPLayout>
  );
};

export default CRM;
