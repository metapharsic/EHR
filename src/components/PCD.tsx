/**
 * PCD NETWORK MANAGEMENT - REFACTORED
 * Synchronized with Database & Field Force
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
 Search, Map, Plus, Users, Shield, MapPin, Phone, Mail, 
 FileText, Gift, TrendingUp, Briefcase, X, ArrowLeft, 
 UserPlus, Target, RefreshCw, AlertCircle, CheckCircle,
 ChevronRight, DollarSign, Activity
} from 'lucide-react';

import { 
 ERPLayout, 
 StatCard, 
 Tabs, 
 Badge, 
 Modal 
} from './UniversalLayout';

import { pcdService, PCDPartner, PCDScheme, PCDTarget } from '../services/pcdService';
import { useNotifications } from '../context/NotificationContext';
import { formatCurrency, formatDate } from '../utils/formatters';

const PCD: React.FC = () => {
  const { addNotification } = useNotifications();

  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState('PARTNERS');
  const [selectedPartner, setSelectedPartner] = useState<PCDPartner | null>(null);

  // Data State
  const [partners, setPartners] = useState<PCDPartner[]>([]);
  const [schemes, setSchemes] = useState<PCDScheme[]>([]);
  const [targets, setTargets] = useState<PCDTarget[]>([]);
  const [mrs, setMrs] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // UI State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedMrId, setSelectedMrId] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    territory: '',
    contact_person: '',
    contact_number: '',
    email: '',
    drug_license_no: '',
    partner_grade: 'BRONZE',
    credit_limit: 100000
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, sRes, tRes, mRes, sumRes] = await Promise.all([
        pcdService.getPartners({ search: searchTerm, status: statusFilter }),
        pcdService.getSchemes(),
        pcdService.getTargets(),
        pcdService.getMRs(),
        pcdService.getSummary()
      ]);
      
      setPartners(pRes.data);
      setSchemes(sRes);
      setTargets(tRes);
      setMrs(mRes.data);
      setSummary(sumRes.data);
    } catch (err: any) {
      addNotification({ 
        title: 'Data Sync Error', 
        message: 'Failed to fetch PCD network data', 
        type: 'error', 
        priority: 'high' 
      });
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, addNotification]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await pcdService.createPartner(formData);
      addNotification({ 
        title: 'Partner Onboarded', 
        message: `PCD Partnership application for ${formData.name} submitted.`, 
        type: 'success' 
      });
      setShowAddModal(false);
      fetchData();
    } catch (err: any) {
      addNotification({ 
        title: 'Onboarding Failed', 
        message: err.data?.error || 'Database constraint violation', 
        type: 'error' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAssignMR = async () => {
    if (!selectedPartner || !selectedMrId) return;
    setIsSaving(true);
    try {
      await pcdService.assignMR(selectedPartner.id, selectedMrId);
      addNotification({ 
        title: 'Field Force Linked', 
        message: 'Medical Representative assigned successfully', 
        type: 'success' 
      });
      setShowAssignModal(false);
      
      // Update local partner state
      const updated = await pcdService.getPartner(selectedPartner.id);
      setSelectedPartner(updated.data);
      fetchData();
    } catch (err: any) {
      addNotification({ title: 'Assignment Failed', message: 'Could not link MR to partner', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  if (selectedPartner) {
    const assignedMrs = mrs.filter(mr => selectedPartner.assigned_mr_ids?.includes(mr.id));

    return (
      <ERPLayout
        title={selectedPartner.name}
        description={`Territory: ${selectedPartner.territory} | Grade: ${selectedPartner.partner_grade}`}
        onBack={() => setSelectedPartner(null)}
        isLoading={loading}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          <div className="lg:col-span-2 space-y-6">
            {/* Overview Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                <Shield size={16} className="text-blue-600" /> Strategic Profile
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contact Person</p>
                  <p className="text-sm font-bold text-slate-900">{selectedPartner.contact_person || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Email</p>
                  <p className="text-sm font-bold text-slate-900 truncate">{selectedPartner.email}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Mobile</p>
                  <p className="text-sm font-bold text-slate-900">{selectedPartner.contact_number}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Drug License</p>
                  <p className="text-sm font-mono font-bold text-blue-600">{selectedPartner.drug_license_no}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Credit Limit</p>
                  <p className="text-sm font-bold text-emerald-600">{formatCurrency(selectedPartner.credit_limit)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Business</p>
                  <p className="text-sm font-bold text-slate-900">{formatCurrency(selectedPartner.total_business || 0)}</p>
                </div>
              </div>
            </div>

            {/* Field Force Section */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <Briefcase size={16} className="text-blue-600" /> Assigned Field Force
                </h3>
                <button 
                  onClick={() => setShowAssignModal(true)}
                  className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center gap-2"
                >
                  <UserPlus size={14} /> Link New MR
                </button>
              </div>

              {assignedMrs.length > 0 ? (
                <div className="space-y-3">
                  {assignedMrs.map(mr => (
                    <div key={mr.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl group hover:border-blue-300 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-blue-600 font-black shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all">
                          {mr.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-800">{mr.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{mr.headquarters} · {mr.contact}</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-300" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-400">
                  <Users size={32} className="mb-2 opacity-20" />
                  <p className="text-[11px] font-black uppercase tracking-widest">No MRs Assigned</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Actions */}
          <div className="space-y-6">
             <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl shadow-slate-200 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4">Partner Status</p>
                <div className="flex items-center gap-4 mb-6">
                   <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10">
                      <TrendingUp size={24} className="text-blue-400" />
                   </div>
                   <div>
                      <h4 className="text-2xl font-black">{selectedPartner.status}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Growth Cycle Active</p>
                   </div>
                </div>
                <button 
                   onClick={async () => {
                      if (!selectedPartner) return;
                      setIsSaving(true);
                      try {
                         await pcdService.syncToParties(selectedPartner.id);
                         addNotification({ title: 'ERP Sync Successful', message: 'Partner now registered as ERP Customer', type: 'success' });
                         const updated = await pcdService.getPartner(selectedPartner.id);
                         setSelectedPartner(updated.data);
                      } catch (err: any) {
                         addNotification({ title: 'Sync Failed', message: err.message, type: 'error' });
                      } finally {
                         setIsSaving(false);
                      }
                   }}
                   disabled={isSaving || !!selectedPartner.converted_party_id}
                   className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50 mt-4"
                >
                   {selectedPartner.converted_party_id ? 'Synced with ERP' : 'Sync to ERP Customer'}
                </button>
             </div>

             <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Risk Assessment</h4>
                <div className="flex justify-between items-center mb-2">
                   <span className="text-xs font-bold text-slate-600">Credit Utilization</span>
                   <span className="text-xs font-black text-slate-900">0%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                   <div className="h-full bg-emerald-500 w-[5%]"></div>
                </div>
             </div>
          </div>
        </div>

        {showAssignModal && (
          <Modal isOpen={true} onClose={() => setShowAssignModal(false)} title="Assign Medical Representative" size="md">
             <div className="space-y-6 py-2">
                <p className="text-sm font-medium text-slate-500 leading-relaxed">
                   Linking a Field Agent to <strong>{selectedPartner.name}</strong> will allow them to log visits, deliver samples, and track orders for this monopoly territory.
                </p>
                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Select Representative</label>
                   <select 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all"
                      value={selectedMrId}
                      onChange={e => setSelectedMrId(e.target.value)}
                   >
                      <option value="">-- Choose MR --</option>
                      {mrs.filter(mr => !selectedPartner.assigned_mr_ids?.includes(mr.id)).map(mr => (
                         <option key={mr.id} value={mr.id}>{mr.name} ({mr.headquarters})</option>
                      ))}
                   </select>
                </div>
                <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                   <button onClick={() => setShowAssignModal(false)} className="px-6 py-3 text-xs font-black uppercase text-slate-400 hover:text-slate-600">Cancel</button>
                   <button 
                      onClick={handleAssignMR}
                      disabled={isSaving || !selectedMrId}
                      className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-[0.2em] flex items-center gap-3 hover:bg-blue-600 transition-all disabled:opacity-50"
                   >
                      {isSaving ? <Activity className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                      Confirm Link
                   </button>
                </div>
             </div>
          </Modal>
        )}
      </ERPLayout>
    );
  }

  return (
    <ERPLayout
      title="PCD Network Management"
      description="Monopoly Rights, Partner Tracking & Scheme Distribution"
      onRefresh={fetchData}
      isLoading={loading}
      actionButtons={[
        <button 
          key="add" 
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-wider flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
        >
          <Plus size={16} /> Onboard Partner
        </button>
      ]}
    >
      {/* Summary Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Network Partners" value={summary?.totalPartners || 0} icon={<Users className="text-blue-500" />} color="blue" />
        <StatCard label="Monopoly Revenue" value={formatCurrency(summary?.totalRevenue || 0)} icon={<DollarSign className="text-emerald-500" />} color="success" />
        <StatCard label="Active Schemes" value={summary?.activeSchemes || 0} icon={<Gift className="text-amber-500" />} color="warning" />
        <StatCard label="Target Reach" value={`${summary?.avgTargetAchievement || 0}%`} icon={<Target className="text-purple-500" />} color="purple" />
      </div>

      <Tabs 
        tabs={[
          { id: 'PARTNERS', label: 'Network Directory', icon: <Map size={14}/> },
          { id: 'TARGETS', label: 'Incentive Tracking', icon: <TrendingUp size={14}/> },
          { id: 'SCHEMES', label: 'Active Offers', icon: <Gift size={14}/> }
        ]} 
        activeTab={activeTab} 
        onChange={setActiveTab} 
      />

      {activeTab === 'PARTNERS' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex gap-4 mb-4">
             <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                   placeholder="Search partners, territories or grade..." 
                   className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all shadow-sm"
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                />
             </div>
             <button onClick={fetchData} className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all shadow-sm text-slate-500">
                <RefreshCw size={20} />
             </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {partners.map(partner => (
              <div 
                key={partner.id} 
                onClick={() => setSelectedPartner(partner)}
                className="bg-white rounded-3xl border border-slate-200 p-6 hover:shadow-xl hover:border-blue-300 transition-all cursor-pointer group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                   <Users size={80} />
                </div>
                
                <div className="flex justify-between items-start mb-6">
                   <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-900 font-black text-lg group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                      {partner.name.charAt(0)}
                   </div>
                   <Badge text={partner.partner_grade} variant="neutral" />
                </div>

                <h3 className="text-lg font-black text-slate-900 mb-1 group-hover:text-blue-600 truncate">{partner.name}</h3>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">
                   <MapPin size={12} className="text-blue-500" /> {partner.territory}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                   <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded ${partner.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                         {partner.status}
                      </span>
                   </div>
                   <div className="text-right">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Revenue</p>
                      <p className="text-xs font-black text-slate-800">{formatCurrency(partner.total_business || 0)}</p>
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'TARGETS' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm animate-fadeIn">
           <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                 <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                       <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Partner</th>
                       <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Period</th>
                       <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Target</th>
                       <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Achieved</th>
                       <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Achievement</th>
                       <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Status</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {targets.map(target => {
                       const perc = Math.min(100, (target.achieved_amount / target.target_amount) * 100);
                       return (
                          <tr key={target.id} className="hover:bg-slate-50 transition-colors">
                             <td className="p-6">
                                <p className="text-sm font-black text-slate-900">{target.partner_name}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">{target.period}</p>
                             </td>
                             <td className="p-6 text-xs font-bold text-slate-600">{formatDate(target.period_start)} — {formatDate(target.period_end)}</td>
                             <td className="p-6 text-sm font-black text-slate-800 text-right">{formatCurrency(target.target_amount)}</td>
                             <td className="p-6 text-sm font-black text-emerald-600 text-right">{formatCurrency(target.achieved_amount)}</td>
                             <td className="p-6">
                                <div className="flex items-center gap-3">
                                   <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                      <div className="h-full bg-blue-600" style={{ width: `${perc}%` }}></div>
                                   </div>
                                   <span className="text-[10px] font-black italic">{perc.toFixed(1)}%</span>
                                </div>
                             </td>
                             <td className="p-6 text-center">
                                <Badge text={target.status} variant={target.status === 'ACHIEVED' || target.status === 'EXCEEDED' ? 'success' : 'info'} />
                             </td>
                          </tr>
                       );
                    })}
                 </tbody>
              </table>
           </div>
        </div>
      )}

      {activeTab === 'SCHEMES' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn">
           {schemes.map(scheme => (
              <div key={scheme.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-amber-300 transition-all">
                 <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Gift size={100} className="text-amber-500" />
                 </div>
                 <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600 border border-amber-100">
                       <Gift size={16} />
                    </div>
                    <Badge text={scheme.scheme_type} variant="neutral" />
                 </div>
                 <h3 className="text-lg font-black text-slate-900 mb-2">{scheme.name}</h3>
                 <p className="text-xs font-medium text-slate-500 leading-relaxed mb-6">{scheme.description}</p>
                 <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Discount</p>
                    <p className="text-lg font-black text-amber-600">{scheme.discount_percentage}%</p>
                 </div>
              </div>
           ))}
           <div className="border-4 border-dashed border-slate-100 rounded-3xl flex flex-col items-center justify-center p-10 text-slate-300 hover:bg-slate-50 hover:border-slate-200 transition-all cursor-pointer">
              <Plus size={40} className="mb-2" />
              <p className="text-sm font-black uppercase tracking-widest text-slate-400">Design New Scheme</p>
           </div>
        </div>
      )}

      {/* Onboarding Modal */}
      {showAddModal && (
        <Modal isOpen={true} onClose={() => setShowAddModal(false)} title="Onboard PCD Franchise Partner" size="lg">
           <form onSubmit={handleRegister} className="space-y-6 py-2">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-2">Business Identity</h4>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Agency Name *</label>
                      <input required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Assigned Territory *</label>
                      <input required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" placeholder="District or Region" value={formData.territory} onChange={e => setFormData({...formData, territory: e.target.value})} />
                   </div>
                </div>
                <div className="space-y-4">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-2">Compliance</h4>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Drug License No</label>
                      <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold outline-none transition-all" value={formData.drug_license_no} onChange={e => setFormData({...formData, drug_license_no: e.target.value})} />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Grade</label>
                         <select className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-black uppercase outline-none" value={formData.partner_grade} onChange={e => setFormData({...formData, partner_grade: e.target.value})}>
                            {['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'].map(g => <option key={g} value={g}>{g}</option>)}
                         </select>
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Credit Limit</label>
                         <input type="number" className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-emerald-600 outline-none" value={formData.credit_limit} onChange={e => setFormData({...formData, credit_limit: Number(e.target.value)})} />
                      </div>
                   </div>
                </div>
              </div>

              <div className="space-y-4">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-2">Contact Details</h4>
                 <div className="grid grid-cols-3 gap-4">
                    <input required className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" placeholder="Contact Person" value={formData.contact_person} onChange={e => setFormData({...formData, contact_person: e.target.value})} />
                    <input required className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" placeholder="Mobile No" value={formData.contact_number} onChange={e => setFormData({...formData, contact_number: e.target.value})} />
                    <input type="email" className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" placeholder="Email Address" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                 </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-6 py-3 text-xs font-black uppercase text-slate-400 hover:text-slate-600">Dismiss</button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="px-10 py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-[0.2em] flex items-center gap-3 hover:bg-blue-600 transition-all disabled:opacity-50"
                >
                  {isSaving ? <Activity className="animate-spin" size={16} /> : <Save size={16} />}
                  Onboard Franchisee
                </button>
              </div>
           </form>
        </Modal>
      )}
    </ERPLayout>
  );
};

// Internal components for Save icon since it was missing from initial import list in thought but added in Lucide list
const Save = ({ size, className }: { size?: number, className?: string }) => <CheckCircle size={size} className={className} />;

export default PCD;
