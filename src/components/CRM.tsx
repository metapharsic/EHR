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
 Activity, ArrowUpRight, Save, Trash2, Pencil, Briefcase,
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

// ============================================
// KANBAN COMPONENT
// ============================================

const KanbanColumn: React.FC<{
  title: string;
  leads: Lead[];
  onView: (l: Lead) => void;
  status: string;
  onDrop?: (leadId: string, newStatus: string) => void;
}> = ({ title, leads, onView, status, onDrop }) => {
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
    <div
      className="flex flex-col min-w-[320px] max-w-[320px] bg-slate-50/50 rounded-2xl border-2 border-slate-200/60 h-full overflow-hidden shadow-sm transition-colors"
      onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-blue-400', 'bg-blue-50/20'); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50/20'); }}
      onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50/20'); const id = e.dataTransfer.getData('leadId'); if (id && onDrop) onDrop(id, status); }}
    >
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
            draggable
            onDragStart={e => { e.dataTransfer.setData('leadId', lead.id); e.dataTransfer.effectAllowed = 'move'; }}
            onClick={() => onView(lead)}
            className="group bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-grab animate-fadeIn active:scale-[0.98]"
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

            {(lead as any).assignee_name && (
              <div className="flex items-center gap-1 mt-2">
                <div className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-black text-slate-500">
                  {(lead as any).assignee_name.charAt(0)}
                </div>
                <span className="text-[9px] font-bold text-slate-400 truncate">{(lead as any).assignee_name}</span>
              </div>
            )}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50">
              <div className="flex items-center gap-2 text-slate-400">
                <Clock size={12} />
                <span className="text-[10px] font-medium">{formatDate(lead.next_follow_up || lead.created_at)}</span>
                {Number((lead as any).activity_count) > 0 && (
                  <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-1 rounded">{(lead as any).activity_count} acts</span>
                )}
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
  const [isEditMode, setIsEditMode] = useState(false);
  const [boardSearch, setBoardSearch] = useState('');
  const [boardPriority, setBoardPriority] = useState('All');

  // Detail sub-data
  const [leadInterests, setLeadInterests] = useState<any[]>([]);
  const [leadActivities, setLeadActivities] = useState<any[]>([]);
  const [repUsers, setRepUsers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Interest modal state
  const [showInterestModal, setShowInterestModal] = useState(false);
  const [interestForm, setInterestForm] = useState({ productId: '', interestLevel: 'High', notes: '' });
  const [savingInterest, setSavingInterest] = useState(false);

  // Activity modal state
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityForm, setActivityForm] = useState({ type: 'CALL', description: '', outcome: '', followUpRequired: false, followUpDate: '' });
  const [savingActivity, setSavingActivity] = useState(false);

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
      const [leadsRes, statsRes, analyticsRes, queueRes, usersRes, productsRes] = await Promise.all([
        crmService.getLeads(),
        crmService.getStats(),
        crmService.getAnalytics(),
        crmService.getLeads({ queue: 'today_and_overdue' }),
        crmService.getUsers().catch(() => ({})),
        crmService.getProducts().catch(() => []),
      ]);
      setLeads(leadsRes);
      setStats(statsRes);
      setAnalytics(analyticsRes);
      setQueueLeads(queueRes);
      setRepUsers(Array.isArray(usersRes) ? usersRes : (usersRes?.data || []));
      setProducts(Array.isArray(productsRes) ? productsRes : (productsRes?.data || []));
    } catch (err: any) {
      addNotification({ title: 'Sync Error', message: 'Failed to sync CRM data', type: 'error', priority: 'high' });
    } finally {
      setLoading(false);
    }
  };

  const loadLeadDetails = async (leadId: string) => {
    setLoadingDetail(true);
    try {
      const [interests, activities] = await Promise.all([
        crmService.getInterests(leadId),
        crmService.getActivities(leadId),
      ]);
      setLeadInterests(interests);
      setLeadActivities(activities);
    } catch {
      setLeadInterests([]);
      setLeadActivities([]);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => { fetchAllData(); }, []);

  useEffect(() => {
    if (selectedLead) loadLeadDetails(selectedLead.id);
    else { setLeadInterests([]); setLeadActivities([]); }
  }, [selectedLead?.id]);

  const blankForm = () => ({
    name: '', companyName: '', email: '', contact: '', location: '',
    status: 'New', priority: 'Medium', source: 'Trade Show',
    nextFollowUp: '', estimatedValue: 0, notes: '', industryType: 'Pharmacy'
  });

  const handleOpenAdd = () => {
    setFormData(blankForm());
    setIsEditMode(false);
    setShowAddModal(true);
  };

  const handleEditLead = () => {
    if (!selectedLead) return;
    setFormData({
      name: selectedLead.name || '',
      companyName: selectedLead.company_name || '',
      email: selectedLead.email || '',
      contact: selectedLead.contact || '',
      location: selectedLead.location || '',
      status: selectedLead.status || 'New',
      priority: selectedLead.priority || 'Medium',
      source: selectedLead.source || 'Trade Show',
      nextFollowUp: selectedLead.next_follow_up ? selectedLead.next_follow_up.split('T')[0] : '',
      estimatedValue: Number(selectedLead.estimated_value) || 0,
      notes: selectedLead.notes || '',
      industryType: selectedLead.industry_type || 'Pharmacy',
    });
    setIsEditMode(true);
    setShowAddModal(true);
  };

  const handleDiscardLead = async () => {
    if (!selectedLead) return;
    if (!window.confirm(`Discard opportunity for ${selectedLead.name}? This cannot be undone.`)) return;
    setIsSaving(true);
    try {
      await crmService.deleteLead(selectedLead.id);
      addNotification({ title: 'Discarded', message: `Opportunity for ${selectedLead.name} removed`, type: 'success', priority: 'medium' });
      setShowDetailModal(false);
      setSelectedLead(null);
      fetchAllData();
    } catch (err: any) {
      addNotification({ title: 'Error', message: err.message || 'Failed to discard opportunity', type: 'error', priority: 'high' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleMoveLead = async (leadId: string, newStatus: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead || lead.status === newStatus) return;
    try {
      await crmService.updateLead(leadId, {
        name: lead.name,
        companyName: (lead as any).company_name,
        email: lead.email,
        contact: lead.contact,
        location: lead.location,
        status: newStatus,
        priority: lead.priority,
        source: lead.source,
        nextFollowUp: (lead as any).next_follow_up || null,
        estimatedValue: (lead as any).estimated_value,
        assignedTo: (lead as any).assigned_to || null,
        notes: lead.notes,
        industryType: (lead as any).industry_type || null,
      });
      addNotification({ title: 'Moved', message: `${lead.name} moved to ${newStatus}`, type: 'success', priority: 'low' });
      fetchAllData();
    } catch {
      addNotification({ title: 'Error', message: 'Failed to move lead', type: 'error', priority: 'high' });
    }
  };

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (isEditMode && selectedLead) {
        const updated = await crmService.updateLead(selectedLead.id, formData);
        setSelectedLead(updated);
        addNotification({ title: 'Updated', message: 'Opportunity updated successfully', type: 'success', priority: 'medium' });
      } else {
        await crmService.createLead(formData);
        addNotification({ title: 'Registered', message: 'New opportunity registered', type: 'success', priority: 'medium' });
      }
      setShowAddModal(false);
      setIsEditMode(false);
      fetchAllData();
    } catch (err: any) {
      addNotification({ title: 'Error', message: err.message || 'Operation failed', type: 'error', priority: 'high' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveInterest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !interestForm.productId) return;
    setSavingInterest(true);
    try {
      await crmService.addInterest(selectedLead.id, interestForm);
      addNotification({ title: 'Linked', message: 'Product interest linked', type: 'success', priority: 'medium' });
      setShowInterestModal(false);
      setInterestForm({ productId: '', interestLevel: 'High', notes: '' });
      loadLeadDetails(selectedLead.id);
    } catch (err: any) {
      addNotification({ title: 'Error', message: err.message || 'Failed to link product', type: 'error', priority: 'high' });
    } finally {
      setSavingInterest(false);
    }
  };

  const handleDeleteInterest = async (interestId: string) => {
    if (!selectedLead) return;
    if (!window.confirm('Remove this product interest?')) return;
    try {
      await fetch(`/api/crm/leads/${selectedLead.id}/interests/${interestId}`, { method: 'DELETE' });
      loadLeadDetails(selectedLead.id);
    } catch {
      addNotification({ title: 'Error', message: 'Failed to remove interest', type: 'error', priority: 'high' });
    }
  };

  const handleSaveActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    setSavingActivity(true);
    try {
      await crmService.addActivity(selectedLead.id, activityForm);
      addNotification({ title: 'Logged', message: 'Activity recorded', type: 'success', priority: 'medium' });
      setShowActivityModal(false);
      setActivityForm({ type: 'CALL', description: '', outcome: '', followUpRequired: false, followUpDate: '' });
      loadLeadDetails(selectedLead.id);
      const updated = await crmService.getLead(selectedLead.id);
      setSelectedLead(updated);
    } catch (err: any) {
      addNotification({ title: 'Error', message: err.message || 'Failed to log activity', type: 'error', priority: 'high' });
    } finally {
      setSavingActivity(false);
    }
  };

  const handleDeleteActivity = async (actId: string) => {
    if (!selectedLead) return;
    if (!window.confirm('Remove this activity?')) return;
    try {
      await fetch(`/api/crm/leads/${selectedLead.id}/activities/${actId}`, { method: 'DELETE' });
      loadLeadDetails(selectedLead.id);
    } catch {
      addNotification({ title: 'Error', message: 'Failed to remove activity', type: 'error', priority: 'high' });
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

  const filteredLeads = useMemo(() => {
    let list = leads;
    if (boardPriority !== 'All') list = list.filter(l => l.priority === boardPriority);
    if (boardSearch.trim()) {
      const q = boardSearch.toLowerCase();
      list = list.filter(l =>
        l.name.toLowerCase().includes(q) ||
        (l.company_name || '').toLowerCase().includes(q) ||
        (l.location || '').toLowerCase().includes(q) ||
        ((l as any).assignee_name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [leads, boardSearch, boardPriority]);

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
        <StatCard label="Lead Velocity" value={stats ? `${(stats.lead_velocity || 0) >= 0 ? '+' : ''}${stats.lead_velocity || 0}%` : '—'} icon={<Zap className="text-amber-500" />} color="warning" trend="MoM Growth" />
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
        <div className="flex flex-col h-[calc(100vh-300px)]">
          {/* Search + Filter bar */}
          <div className="flex items-center gap-3 mb-4 flex-shrink-0">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 transition-colors"
                placeholder="Search leads, companies, reps…"
                value={boardSearch}
                onChange={e => setBoardSearch(e.target.value)}
              />
              {boardSearch && (
                <button onClick={() => setBoardSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <XCircle size={14} />
                </button>
              )}
            </div>
            <select
              className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-black uppercase outline-none focus:border-blue-500 transition-colors"
              value={boardPriority}
              onChange={e => setBoardPriority(e.target.value)}
            >
              {['All', 'Urgent', 'High', 'Medium', 'Low'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            {(boardSearch || boardPriority !== 'All') && (
              <span className="text-[10px] font-bold text-slate-400">{filteredLeads.length} of {leads.length} leads</span>
            )}
          </div>
          <div className="flex gap-5 flex-1 overflow-x-auto pb-4 custom-scrollbar">
            {columns.map(col => (
              <KanbanColumn
                key={col}
                title={col}
                status={col}
                leads={filteredLeads.filter(l => l.status === col)}
                onView={(l) => { setSelectedLead(l); setShowDetailModal(true); }}
                onDrop={handleMoveLead}
              />
            ))}
            <KanbanColumn
              title="Post-Pipeline"
              status="Converted"
              leads={filteredLeads.filter(l => ['Converted', 'Lost', 'On Hold'].includes(l.status))}
              onView={(l) => { setSelectedLead(l); setShowDetailModal(true); }}
            />
          </div>
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
                        (lead.next_follow_up ? lead.next_follow_up.slice(0,10) < new Date().toLocaleDateString('en-CA') : false) ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
                      }`}>
                        {lead.next_follow_up ? formatDate(lead.next_follow_up) : 'Not set'}
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
                <div className="flex-1">
                  <h2 className="text-3xl font-black text-slate-900 tracking-tighter leading-none">{selectedLead.name}</h2>
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <Badge text={selectedLead.status} variant={selectedLead.status === 'Converted' ? 'success' : 'info'} />
                    <span className="text-sm font-bold text-slate-400 flex items-center gap-1.5"><MapPin size={14} /> {selectedLead.location || 'HQ'}</span>
                    <span className="text-sm font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-widest text-[10px]">{selectedLead.industry_type}</span>
                  </div>
                  {/* Status changer */}
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Move to:</span>
                    {['New','Contacted','Qualified','Proposal','Negotiation'].filter(s => s !== selectedLead.status).map(s => (
                      <button key={s} onClick={async () => {
                        try {
                          const updated = await crmService.updateLead(selectedLead.id, {
                            name: selectedLead.name,
                            companyName: (selectedLead as any).company_name,
                            email: selectedLead.email,
                            contact: selectedLead.contact,
                            location: selectedLead.location,
                            status: s,
                            priority: selectedLead.priority,
                            source: selectedLead.source,
                            nextFollowUp: (selectedLead as any).next_follow_up || null,
                            estimatedValue: (selectedLead as any).estimated_value,
                            assignedTo: (selectedLead as any).assigned_to || null,
                            notes: selectedLead.notes,
                            industryType: (selectedLead as any).industry_type || null,
                          });
                          setSelectedLead(updated);
                          fetchAllData();
                        } catch { addNotification({ title: 'Error', message: 'Status update failed', type: 'error', priority: 'high' }); }
                      }} className="text-[9px] font-black uppercase px-2 py-1 rounded-lg bg-slate-100 hover:bg-blue-100 hover:text-blue-700 transition-all">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={handleEditLead} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-blue-600 transition-all">
                  <Pencil size={14} /> Edit
                </button>
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
                    <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-500">Assigned Rep</span><span className="text-xs font-bold text-blue-600">{repUsers.find((u: any) => u.id === selectedLead.assigned_to)?.name || 'Unassigned'}</span></div>
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
                  <button onClick={() => setShowInterestModal(true)} className="text-[10px] font-black text-blue-600 uppercase hover:underline">+ Link SKU</button>
                </div>
                {loadingDetail ? (
                  <p className="text-[10px] text-slate-400 italic">Loading...</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {leadInterests.map((i: any) => (
                      <div key={i.id} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600"><Package size={14}/></div>
                          <div>
                            <p className="text-xs font-bold text-slate-800">{i.product_name}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">{i.product_category || i.therapeutic_category || '—'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge text={i.interest_level} variant="info" />
                          <button onClick={() => handleDeleteInterest(i.id)} className="opacity-0 group-hover:opacity-100 p-1 text-rose-400 hover:text-rose-600 transition-all"><Trash2 size={12}/></button>
                        </div>
                      </div>
                    ))}
                    <button onClick={() => setShowInterestModal(true)} className="p-3 bg-white border border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-all">
                      <Plus size={14} className="mr-2" /> <span className="text-[10px] font-bold uppercase">Add Interest</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Activities Timeline */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Activity Timeline</h4>
                  <button onClick={() => setShowActivityModal(true)} className="text-[10px] font-black text-blue-600 uppercase hover:underline">+ Log Event</button>
                </div>
                {loadingDetail ? (
                  <p className="text-[10px] text-slate-400 italic">Loading...</p>
                ) : leadActivities.length === 0 ? (
                  <div className="flex flex-col items-center py-6 text-slate-300">
                    <Activity size={24} className="mb-2" />
                    <p className="text-[10px] font-bold uppercase">No activities logged yet</p>
                  </div>
                ) : (
                  <div className="space-y-4 relative before:absolute before:left-[15px] before:top-2 before:bottom-0 before:w-0.5 before:bg-slate-100">
                    {leadActivities.map((a: any) => {
                      const iconMap: Record<string, React.ReactNode> = {
                        CALL: <Phone size={12} className="text-white" />,
                        EMAIL: <Mail size={12} className="text-white" />,
                        MEETING: <Users size={12} className="text-white" />,
                        VISIT: <MapPin size={12} className="text-white" />,
                      };
                      const timeAgo = (d: string) => {
                        const diff = Date.now() - new Date(d).getTime();
                        const days = Math.floor(diff / 86400000);
                        return days === 0 ? 'Today' : days === 1 ? '1 day ago' : `${days} days ago`;
                      };
                      return (
                        <div key={a.id} className="flex gap-4 relative group">
                          <div className="w-8 h-8 rounded-full bg-blue-600 border-4 border-white flex items-center justify-center z-10 shadow-sm flex-shrink-0">
                            {iconMap[a.type] || <Activity size={12} className="text-white" />}
                          </div>
                          <div className="flex-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <div className="flex justify-between items-start mb-1">
                              <p className="text-xs font-black text-slate-800 uppercase">{a.type} {a.outcome ? `— ${a.outcome}` : ''}</p>
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] font-bold text-slate-400">{timeAgo(a.performed_at || a.created_at)}</span>
                                <button onClick={() => handleDeleteActivity(a.id)} className="opacity-0 group-hover:opacity-100 p-0.5 text-rose-400 hover:text-rose-600 transition-all"><Trash2 size={10}/></button>
                              </div>
                            </div>
                            <p className="text-xs text-slate-500">{a.description}</p>
                            {a.follow_up_required && a.follow_up_date && (
                              <p className="text-[9px] text-amber-600 font-bold mt-1">Follow-up: {formatDate(a.follow_up_date)}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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
                <button
                  onClick={handleDiscardLead}
                  disabled={isSaving}
                  className="px-6 py-4 border border-rose-200 rounded-2xl hover:bg-rose-50 transition-all disabled:opacity-50"
                  title="Discard this opportunity"
                >
                  <Trash2 size={20} className="text-rose-400" />
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
          onClose={() => { setShowAddModal(false); setIsEditMode(false); }}
          title={isEditMode ? `Edit — ${formData.name}` : 'Register New Enterprise Opportunity'}
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
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Contact Number *</label>
                  <input required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none transition-all" value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} placeholder="e.g. 9876543210" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Email</label>
                  <input type="email" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none transition-all" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="e.g. name@company.com" />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-2">Classification</h4>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Location</label>
                  <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none transition-all" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="City / Territory" />
                </div>
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Source</label>
                    <select className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-black uppercase outline-none" value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})}>
                      {['Referral', 'Trade Show', 'Cold Call', 'Website', 'LinkedIn', 'MR Visit', 'Other'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Status</label>
                    <select className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-black uppercase outline-none" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                      {['New','Contacted','Qualified','Proposal','Negotiation'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Potential Value (₹)</label>
                  <input type="number" min="0" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-emerald-600 outline-none" value={formData.estimatedValue} onChange={e => setFormData({...formData, estimatedValue: Number(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Next Follow-up</label>
                  <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" value={formData.nextFollowUp} onChange={e => setFormData({...formData, nextFollowUp: e.target.value})} />
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Strategy Notes</label>
              <textarea className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-blue-500/10 outline-none min-h-[80px]" placeholder="Brief context for the AI Agent..." value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
              <button type="button" onClick={() => { setShowAddModal(false); setIsEditMode(false); }} className="px-6 py-3 text-xs font-black uppercase text-slate-400 hover:text-slate-600">Cancel</button>
              <button type="submit" disabled={isSaving} className="px-10 py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-[0.2em] flex items-center gap-3 hover:bg-blue-600 transition-all disabled:opacity-50">
                {isSaving ? <Activity className="animate-spin" size={16} /> : <Save size={16} />}
                {isEditMode ? 'Save Changes' : 'Execute Registration'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Link SKU Modal */}
      {showInterestModal && (
        <Modal isOpen={true} onClose={() => setShowInterestModal(false)} title="Link Product Interest" size="sm">
          <form onSubmit={handleSaveInterest} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Product *</label>
              <select required className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" value={interestForm.productId} onChange={e => setInterestForm({...interestForm, productId: e.target.value})}>
                <option value="">— Select Product —</option>
                {products.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({p.generic_name})</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Interest Level</label>
              <select className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" value={interestForm.interestLevel} onChange={e => setInterestForm({...interestForm, interestLevel: e.target.value})}>
                {['Low', 'Medium', 'High'].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Notes</label>
              <textarea className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none min-h-[60px]" value={interestForm.notes} onChange={e => setInterestForm({...interestForm, notes: e.target.value})} placeholder="e.g. bulk order, sample request..." />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button type="button" onClick={() => setShowInterestModal(false)} className="px-5 py-2.5 text-xs font-black uppercase text-slate-400 hover:text-slate-600">Cancel</button>
              <button type="submit" disabled={savingInterest} className="px-8 py-2.5 bg-slate-900 text-white rounded-xl font-black text-xs uppercase hover:bg-blue-600 transition-all disabled:opacity-50">
                {savingInterest ? <Activity className="animate-spin" size={14} /> : 'Link SKU'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Log Event Modal */}
      {showActivityModal && (
        <Modal isOpen={true} onClose={() => setShowActivityModal(false)} title="Log Activity" size="sm">
          <form onSubmit={handleSaveActivity} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Type</label>
                <select className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" value={activityForm.type} onChange={e => setActivityForm({...activityForm, type: e.target.value})}>
                  {['CALL', 'EMAIL', 'MEETING', 'VISIT', 'NOTE'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Outcome</label>
                <input className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" value={activityForm.outcome} onChange={e => setActivityForm({...activityForm, outcome: e.target.value})} placeholder="e.g. Interested, No Answer" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Description *</label>
              <textarea required className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none min-h-[80px]" value={activityForm.description} onChange={e => setActivityForm({...activityForm, description: e.target.value})} placeholder="What happened in this interaction?" />
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="followup" checked={activityForm.followUpRequired} onChange={e => setActivityForm({...activityForm, followUpRequired: e.target.checked})} className="w-4 h-4 rounded" />
              <label htmlFor="followup" className="text-xs font-bold text-slate-600">Follow-up required</label>
              {activityForm.followUpRequired && (
                <input type="date" className="ml-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none" value={activityForm.followUpDate} onChange={e => setActivityForm({...activityForm, followUpDate: e.target.value})} />
              )}
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button type="button" onClick={() => setShowActivityModal(false)} className="px-5 py-2.5 text-xs font-black uppercase text-slate-400 hover:text-slate-600">Cancel</button>
              <button type="submit" disabled={savingActivity} className="px-8 py-2.5 bg-slate-900 text-white rounded-xl font-black text-xs uppercase hover:bg-blue-600 transition-all disabled:opacity-50">
                {savingActivity ? <Activity className="animate-spin" size={14} /> : 'Log Event'}
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
