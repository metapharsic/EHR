import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Search, Map, Plus, Users, Shield, MapPin, Phone, Mail, FileText, Gift, TrendingUp, Briefcase, X, ArrowLeft, UserPlus, Target, Calendar, DollarSign, BarChart3, PieChart, Award, CheckCircle, AlertCircle, Clock, Pencil, Trash2, Eye, Download, Printer, Filter, RefreshCcw, Building2, CreditCard, Truck, Package, Zap, Activity, MessageCircle } from 'lucide-react';
import apiClient from '../services/apiClient';
import { PCDPartner, MedicalRepresentative, PCDScheme, PCDTarget, SaleTransaction } from '../types';
import { useAuth } from '../context/AuthContext';
import PCDPartnerOnboarding from './PCDPartnerOnboarding';
import PCDCommissionEngine from './PCDCommissionEngine';
import PCDReceivablesTracker from './PCDReceivablesTracker';
import PCDTerritoryHeatMap from './PCDTerritoryHeatMap';
import PCDBroadcastCenter from './PCDBroadcastCenter';
import PCDActivityFeed from './PCDActivityFeed';
import { 
  getAllParties, saveParty, 
  getAllPCDSchemes, savePCDScheme, 
  getAllPCDTargets, savePCDTarget,
  getAllMedicalRepresentatives, saveMedicalRepresentative,
  getAllPCDTransactions, savePCDTransaction,
  getAllPCDPartners, savePCDPartner
} from '../services/databaseService';
import { 
  exportPCDPartnerPerformanceReport, 
  exportPCDTerritoryAnalysisReport, 
  exportPCDIncentiveStatementReport,
  exportPCDTargetVsAchievementReport,
  exportPCDSchemePerformanceReport,
  exportPCDMRPerformanceReport,
  exportPCDOverallAnalyticsReport
} from '../utils/excelExport';

const StrategicPCD: React.FC = () => {
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'PARTNERS' | 'SCHEMES' | 'TARGETS' | 'REPORTS' | 'ANALYTICS' | 'ONBOARDING' | 'COMMISSIONS' | 'RECEIVABLES' | 'BROADCAST' | 'ACTIVITY'>('DASHBOARD');
  
  // Data State
  const [partners, setPartners] = useState<PCDPartner[]>([]);
  const [mrs, setMrs] = useState<MedicalRepresentative[]>([]);
  const [schemes, setSchemes] = useState<PCDScheme[]>([]);
  const [targets, setTargets] = useState<PCDTarget[]>([]);
  const [transactions, setTransactions] = useState<SaleTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedPartner, setSelectedPartner] = useState<PCDPartner | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
  
  // Modals
  const [showAddPartnerModal, setShowAddPartnerModal] = useState(false);
  const [showAssignMRModal, setShowAssignMRModal] = useState(false);
  const [showSchemeModal, setShowSchemeModal] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [selectedSchemeForTx, setSelectedSchemeForTx] = useState<PCDScheme | null>(null);
  
  // Form States
  const [partnerForm, setPartnerForm] = useState({
    id: '',
    name: '',
    territory: '',
    contact: '',
    email: '',
    drugLicenseNo: '',
    gstin: '',
    address: '',
    creditLimit: 0,
    paymentTerms: '30 Days'
  });
  
  const [schemeForm, setSchemeForm] = useState({
    id: '',
    name: '',
    description: '',
    validUntil: '',
    type: 'Volume' as 'Volume' | 'Value' | 'Product',
    minimumOrder: 0,
    discountPercentage: 0,
    freeProducts: '',
    terms: '',
    eligibilityCriteria: '',
    bonusIncentives: '',
    targetProducts: '',
    schemeCode: ''
  });

  const [targetForm, setTargetForm] = useState({
    id: '',
    partnerId: '',
    partnerName: '',
    period: '',
    targetAmount: 0,
    achievedAmount: 0,
    incentivePercentage: 0,
    status: 'Pending' as 'Pending' | 'Achieved' | 'Failed'
  });

  const [txForm, setTxForm] = useState({
    partnerId: '',
    productId: '',
    batchId: '',
    quantity: 1,
    amount: 0,
    orderStatus: 'VERIFIED'
  });
  
  const [selectedMrIdToAssign, setSelectedMrIdToAssign] = useState('');
  const [selectedPartnerForTarget, setSelectedPartnerForTarget] = useState<PCDPartner | null>(null);

  const canEdit = hasPermission(['ADMIN', 'SALES_MANAGER']);

  // Partners Network state (real API)
  const [networkPartners, setNetworkPartners] = useState<any[]>([]);
  const [networkLoading, setNetworkLoading] = useState(false);
  const [netStatusFilter, setNetStatusFilter] = useState('');
  const [netTerritoryFilter, setNetTerritoryFilter] = useState('');
  const [editPartner, setEditPartner] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editSaving, setEditSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [netToast, setNetToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showNetToast = useCallback((type: 'success' | 'error', msg: string) => {
    setNetToast({ type, msg });
    setTimeout(() => setNetToast(null), 5000);
  }, []);

  const loadNetworkPartners = useCallback(async () => {
    setNetworkLoading(true);
    try {
      const res = await apiClient.get('/pcd/partners?limit=200');
      if (res.success) setNetworkPartners(res.data);
    } catch (e: any) {
      showNetToast('error', e.message || 'Failed to load partners');
    } finally {
      setNetworkLoading(false);
    }
  }, [showNetToast]);

  useEffect(() => {
    if (activeTab === 'PARTNERS') loadNetworkPartners();
  }, [activeTab, loadNetworkPartners]);

  const handleEditPartner = (p: any) => {
    setEditPartner(p);
    setEditForm({
      name: p.name || '',
      territory: p.territory || '',
      state: p.state || '',
      district: p.district || '',
      contact_person: p.contact_person || '',
      contact_number: p.contact_number || '',
      email: p.email || '',
      drug_license_no: p.drug_license_no || '',
      drug_license_expiry: p.drug_license_expiry ? p.drug_license_expiry.split('T')[0] : '',
      gst_registration: p.gst_registration || '',
      gstin_expiry: p.gstin_expiry ? p.gstin_expiry.split('T')[0] : '',
      credit_limit: p.credit_limit || 100000,
      discount_percentage: p.discount_percentage || 5,
      partner_grade: p.partner_grade || 'BRONZE',
      status: p.status || 'APPLIED',
      monopoly_territory: p.monopoly_territory || '',
    });
  };

  const handleSaveEdit = async () => {
    setEditSaving(true);
    try {
      const res = await apiClient.put(`/pcd/partners/${editPartner.id}`, editForm);
      if (res.success) {
        showNetToast('success', `${editForm.name} updated successfully`);
        setEditPartner(null);
        await loadNetworkPartners();
      } else {
        showNetToast('error', res.error || 'Update failed');
      }
    } catch (e: any) {
      showNetToast('error', e?.data?.error || e?.message || 'Failed');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeletePartner = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await apiClient.delete(`/pcd/partners/${deleteConfirm.id}`);
      if (res.success) {
        showNetToast('success', `${deleteConfirm.name} removed from network`);
        setDeleteConfirm(null);
        await loadNetworkPartners();
      } else {
        showNetToast('error', res.error || 'Delete failed');
      }
    } catch (e: any) {
      showNetToast('error', e?.data?.error || e?.message || 'Failed');
    } finally {
      setDeleting(false);
    }
  };

  // Report state
  const [rptPartners, setRptPartners] = useState<any[]>([]);
  const [rptTargets, setRptTargets] = useState<any[]>([]);
  const [rptTransactions, setRptTransactions] = useState<any[]>([]);
  const [rptMrs, setRptMrs] = useState<any[]>([]);
  const [rptCommissions, setRptCommissions] = useState<any[]>([]);
  const [rptReceivables, setRptReceivables] = useState<any[]>([]);
  const [rptSummary, setRptSummary] = useState<any>(null);
  const [rptLoading, setRptLoading] = useState(false);
  const [rptError, setRptError] = useState('');
  const [rptDateFrom, setRptDateFrom] = useState('');
  const [rptDateTo, setRptDateTo] = useState('');
  const [rptActiveSection, setRptActiveSection] = useState<'partners'|'targets'|'transactions'|'mrs'|'commissions'|'receivables'>('partners');

  const loadReportData = useCallback(async () => {
    setRptLoading(true);
    setRptError('');
    try {
      const fromQ = rptDateFrom ? `&from=${rptDateFrom}` : '';
      const toQ = rptDateTo ? `&to=${rptDateTo}` : '';
      const [sumRes, partRes, tgtRes, txRes, mrRes, comRes, recRes] = await Promise.all([
        apiClient.get('/pcd/dashboard/summary'),
        apiClient.get('/pcd/partners?limit=200'),
        apiClient.get('/pcd/targets'),
        apiClient.get(`/pcd/transactions?${fromQ}${toQ}`),
        apiClient.get('/pcd/mrs'),
        apiClient.get('/pcd/commissions'),
        apiClient.get('/pcd/receivables'),
      ]);
      if (sumRes.success) setRptSummary(sumRes.data);
      if (partRes.success) setRptPartners(partRes.data);
      if (tgtRes.success) setRptTargets(tgtRes.data);
      if (txRes.success) setRptTransactions(txRes.data);
      if (mrRes.success) setRptMrs(mrRes.data);
      if (comRes.success) setRptCommissions(comRes.data);
      if (recRes.success) setRptReceivables(recRes.data);
    } catch (e: any) {
      setRptError(e.message || 'Failed to load report data');
    } finally {
      setRptLoading(false);
    }
  }, [rptDateFrom, rptDateTo]);

  useEffect(() => {
    if (activeTab === 'REPORTS') loadReportData();
  }, [activeTab, loadReportData]);

  const [refreshing, setRefreshing] = useState(false);
  const [dashboardStats, setDashboardStats] = useState<any>(null);

  // Load data on component mount (REAL API)
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setRefreshing(true);
      
      const [sumRes, partRes, mrRes, schRes, tgtRes, txRes] = await Promise.all([
        apiClient.get('/pcd/dashboard/summary'),
        getAllPCDPartners(),
        getAllMedicalRepresentatives(),
        getAllPCDSchemes(),
        getAllPCDTargets(),
        getAllPCDTransactions()
      ]);

      if (sumRes.success) setDashboardStats(sumRes.data);
      setPartners(partRes);
      setMrs(mrRes);
      setSchemes(schRes);
      setTargets(tgtRes);
      setTransactions(txRes);

    } catch (error) {
      console.error('Error loading PCD data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredPartners = partners.filter(p => 
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.territory?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.contact?.includes(searchTerm)
  );

  // Calculate statistics from API or fallback (Using transformed types)
  const activePartners = dashboardStats?.totalPartners || partners.filter(p => p.status === 'Active').length;
  const totalTerritories = new Set(partners.map(p => p.territory)).size;
  const totalSales = dashboardStats?.totalRevenue || transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const avgTargetAchievement = dashboardStats?.avgTargetAchievement || (targets.length > 0 
    ? targets.reduce((sum, t) => sum + (t.targetAmount > 0 ? (t.achievedAmount / t.targetAmount * 100) : 0), 0) / targets.length 
    : 0);

  const handleAddPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await apiClient.post('/pcd/partners', {
        name: partnerForm.name,
        territory: partnerForm.territory,
        contact_number: partnerForm.contact,
        email: partnerForm.email,
        drug_license_no: partnerForm.drugLicenseNo,
        gst_registration: partnerForm.gstin,
        address: partnerForm.address,
        credit_limit: partnerForm.creditLimit,
        status: 'ACTIVE'
      });
      
      if (res.success) {
        setShowAddPartnerModal(false);
        resetPartnerForm();
        loadData();
      }
    } catch (error: any) {
      console.error('Error adding partner:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveScheme = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const payload = {
        name: schemeForm.name,
        description: schemeForm.description,
        validity_end: schemeForm.validUntil,
        scheme_type: schemeForm.type === 'Value' ? 'DISCOUNT' : schemeForm.type.toUpperCase(),
        minimum_order: schemeForm.minimumOrder,
        discount_percentage: schemeForm.discountPercentage,
        free_product_name: schemeForm.freeProducts,
        terms: schemeForm.terms,
        eligibility_criteria: schemeForm.eligibilityCriteria,
        bonus_incentives: schemeForm.bonusIncentives,
        target_products: schemeForm.targetProducts,
        scheme_code: schemeForm.schemeCode
      };

      const res = schemeForm.id && !schemeForm.id.startsWith('SCH-')
        ? await apiClient.put(`/pcd/schemes/${schemeForm.id}`, payload)
        : await apiClient.post('/pcd/schemes', payload);
      
      if (res.success) {
        setShowSchemeModal(false);
        resetSchemeForm();
        loadData();
      }
    } catch (error) {
      console.error('Error saving scheme:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const payload = {
        partner_id: targetForm.partnerId,
        period: targetForm.period,
        target_amount: targetForm.targetAmount,
        achieved_amount: targetForm.achievedAmount,
        incentive_percentage: targetForm.incentivePercentage,
        status: targetForm.status.toUpperCase()
      };

      const res = targetForm.id && !targetForm.id.startsWith('TGT-')
        ? await apiClient.put(`/pcd/targets/${targetForm.id}`, payload)
        : await apiClient.post('/pcd/targets', payload);
        
      if (res.success) {
        setShowTargetModal(false);
        resetTargetForm();
        loadData();
      }
    } catch (error) {
      console.error('Error saving target:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditTarget = (target: PCDTarget) => {
    setTargetForm(target);
    setShowTargetModal(true);
  };

  const handleDeleteTarget = async (id: string) => {
    try {
      // For now, we'll just remove from the list
      const updatedTargets = targets.filter(t => t.id !== id);
      setTargets(updatedTargets);
      
      // Also update in database
      localStorage.setItem('pcd_targets', JSON.stringify(updatedTargets));
    } catch (error) {
      console.error('Error deleting target:', error);
    }
  };

  const resetTargetForm = () => {
    setTargetForm({
      id: '',
      partnerId: '',
      partnerName: '',
      period: '',
      targetAmount: 0,
      achievedAmount: 0,
      incentivePercentage: 0,
      status: 'Pending'
    });
  };

  const handleSetNewTarget = () => {
    resetTargetForm();
    setShowTargetModal(true);
  };

  const handleAIGenerateTarget = () => {
    if (!targetForm.partnerId) return;
    
    const partnerTerritory = partners.find(p => p.id === targetForm.partnerId)?.territory || '';
    const partnerMrs = mrs.filter(mr => mr.assignedArea.includes(partnerTerritory));
    const partnerSales = transactions
      .filter(t => partnerMrs.some(mr => mr.id === t.mrId))
      .reduce((sum, t) => sum + t.amount, 0);
      
    const baseAmount = partnerSales > 0 ? partnerSales : 250000;
    const aiSuggestedTarget = Math.round((baseAmount * 1.15) / 10000) * 10000;
    
    setTargetForm({
      ...targetForm,
      period: `Q${Math.floor(new Date().getMonth() / 3) + 1} ${new Date().getFullYear()}`,
      targetAmount: aiSuggestedTarget,
      achievedAmount: 0,
      incentivePercentage: aiSuggestedTarget > 500000 ? 3.5 : 2.5,
      status: 'Pending'
    });
  };

  const handleApplyScheme = (scheme: PCDScheme) => {
    setSelectedSchemeForTx(scheme);
    setTxForm({
      ...txForm,
      amount: scheme.minimumOrder || 0
    });
    setShowTransactionModal(true);
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await apiClient.post('/pcd/transactions', {
        partner_id: txForm.partnerId,
        product_id: txForm.productId,
        batch_id: txForm.batchId,
        order_amount: txForm.amount,
        quantity: txForm.quantity,
        order_status: txForm.orderStatus,
        scheme_applied_id: selectedSchemeForTx?.id
      });

      if (res.success) {
        addNotification({ title: 'Order Processed', message: `Transaction created and synced with ERP`, type: 'success' });
        setShowTransactionModal(false);
        setTxForm({ partnerId: '', productId: '', batchId: '', quantity: 1, amount: 0, orderStatus: 'VERIFIED' });
        setSelectedSchemeForTx(null);
        loadData();
      }
    } catch (error: any) {
      addNotification({ title: 'Order Failed', message: error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTargetAchievement = async (id: string, newAchievedAmount: number) => {
    try {
      const target = targets.find(t => t.id === id);
      if (!target) return;
      
      const res = await apiClient.put(`/pcd/targets/${id}`, {
        ...target,
        achieved_amount: newAchievedAmount,
        status: newAchievedAmount >= target.targetAmount ? 'ACHIEVED' : 'IN_PROGRESS'
      });
      
      if (res.success) {
        loadData();
      }
    } catch (error) {
      console.error('Error updating target achievement:', error);
    }
  };

  const handleTogglePartnerStatus = async (partner: PCDPartner) => {
    const newStatus = partner.status === 'Active' || partner.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await apiClient.put(`/pcd/partners/${partner.id}`, {
        ...partner,
        status: newStatus
      });
      if (res.success) {
        loadData();
      }
    } catch (error) {
      console.error('Error toggling partner status:', error);
    }
  };

  const handleSetTargetForPartner = (partner: PCDPartner) => {
    setSelectedPartnerForTarget(partner);
    resetTargetForm();
    setTargetForm({
      ...targetForm,
      partnerId: partner.id,
      partnerName: partner.name
    });
    setShowTargetModal(true);
  };

  if (selectedPartner) {
    const assignedMrs = mrs.filter(mr => selectedPartner.assignedMrIds?.includes(mr.id));
    const partnerTarget = targets.find(t => t.partnerId === selectedPartner.id);
    const achievementPercent = partnerTarget ? (partnerTarget.achievedAmount / partnerTarget.targetAmount) * 100 : 0;
    
    let churnRisk = 12;
    if (partnerTarget) {
      if (achievementPercent < 50) churnRisk = 88;
      else if (achievementPercent < 80) churnRisk = 45;
    }
    if (selectedPartner.status === 'Inactive') churnRisk = 99;

    return (
      <div className="space-y-6 animate-fadeIn p-4">
        <div className="flex items-center gap-4 mb-2">
          <button 
            onClick={() => setSelectedPartner(null)}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">{selectedPartner.name}</h2>
            <p className="text-slate-500 text-sm">Strategic PCD Partner Management</p>
          </div>
          <div className="ml-auto flex gap-2">
            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-lg text-xs font-bold border border-yellow-200 flex items-center gap-2">
              <Shield size={12} /> MONOPOLY RIGHTS
            </span>
            <button
              onClick={() => handleTogglePartnerStatus(selectedPartner)}
              title={`Click to toggle partner status`}
              className={`px-3 py-1 rounded-lg text-sm font-bold border flex items-center gap-2 cursor-pointer transition-colors ${
                selectedPartner.status === 'Active' 
                  ? 'bg-green-50 text-green-700 border-green-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200' 
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200'
              }`}
            >
              <CheckCircle size={16} /> {selectedPartner.status} (click to toggle)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Partner Overview */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Building2 size={20} className="text-primary"/> Partner Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-slate-500 font-bold uppercase mb-1">Territory & License</p>
                    <p className="font-medium text-slate-800 flex items-center gap-2">
                      <MapPin size={16} className="text-slate-400"/> {selectedPartner.territory}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">Drug License: 
                      <span className="font-mono bg-slate-100 px-2 py-1 rounded ml-2">{selectedPartner.drugLicenseNo}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-bold uppercase mb-1">Partnership Details</p>
                    <p className="font-medium text-slate-800">Joined: {selectedPartner.joinDate}</p>
                    <p className="text-sm text-slate-600">Status: 
                      <span className={`ml-2 px-2 py-1 rounded-full text-xs font-bold ${
                        selectedPartner.status === 'Active' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {selectedPartner.status}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-slate-500 font-bold uppercase mb-1">Contact Information</p>
                    <p className="font-medium text-slate-800 flex items-center gap-2">
                      <Phone size={16} className="text-slate-400"/> {selectedPartner.contact}
                    </p>
                    <p className="font-medium text-slate-800 flex items-center gap-2 mt-1">
                      <Mail size={16} className="text-slate-400"/> {selectedPartner.email}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-bold uppercase mb-1">Financial Terms</p>
                    <p className="text-sm text-slate-600">Credit Limit: ₹{selectedPartner.creditLimit?.toLocaleString() || 'N/A'}</p>
                    <p className="text-sm text-slate-600">Payment Terms: {selectedPartner.paymentTerms || '30 Days'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Predictive Insights */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 rounded-xl border border-slate-700 shadow-sm text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Zap size={100} />
              </div>
              <h3 className="font-bold text-slate-100 mb-4 flex items-center gap-2">
                <Activity size={20} className="text-yellow-400"/> AI Predictive Insights
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                  <p className="text-slate-400 text-xs font-bold uppercase mb-2">Churn Probability</p>
                  <div className="flex items-end gap-3">
                    <h4 className={`text-3xl font-bold ${
                      churnRisk > 75 ? 'text-red-400' :
                      churnRisk > 40 ? 'text-orange-400' :
                      'text-emerald-400'
                    }`}>{churnRisk}%</h4>
                    <span className="text-sm text-slate-300 mb-1">Risk Level</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    {churnRisk > 75 ? 'High risk of network drop-off. Immediate retention scheme required.' :
                     churnRisk > 40 ? 'Moderate risk. Monitoring order velocity closely.' :
                     'Partner is secure and highly engaged.'}
                  </p>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                  <p className="text-slate-400 text-xs font-bold uppercase mb-2">Financial AI Assessment</p>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-300 text-sm">Suggested Credit Limit</span>
                    <span className="font-bold text-blue-400">
                      ₹{churnRisk > 50 ? Math.floor(selectedPartner.creditLimit * 0.5).toLocaleString() : Math.floor(selectedPartner.creditLimit * 1.5).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300 text-sm">Payment Health</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${churnRisk > 50 ? 'bg-orange-500/20 text-orange-400' : 'bg-green-500/20 text-green-400'}`}>
                      {churnRisk > 50 ? 'Delayed' : 'Excellent'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Field Force Assignment */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Briefcase size={20} className="text-primary"/> Assigned Field Force (MR)
                </h3>
                {canEdit && (
                  <button 
                    onClick={() => setShowAssignMRModal(true)}
                    className="text-sm bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-sky-600 transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <UserPlus size={16} /> Assign MR
                  </button>
                )}
              </div>
              
              {assignedMrs.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {assignedMrs.map(mr => (
                    <div key={mr.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-300 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-primary text-sm shadow-sm">
                          {mr.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{mr.name}</p>
                          <p className="text-xs text-slate-500">{mr.headquarters} • {mr.contact}</p>
                          <p className="text-xs text-slate-500 mt-1">Area: {mr.assignedArea}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500 mb-1">Target Achievement</p>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          mr.targetAchievement >= 100 
                            ? 'bg-green-100 text-green-700' 
                            : mr.targetAchievement >= 80 
                              ? 'bg-blue-100 text-blue-700' 
                              : 'bg-orange-100 text-orange-700'
                        }`}>
                          {mr.targetAchievement}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <Users size={32} className="mx-auto text-slate-300 mb-2"/>
                  <p className="text-slate-500">No Medical Representatives assigned to this partner yet.</p>
                  {canEdit && (
                    <button 
                      onClick={() => setShowAssignMRModal(true)} 
                      className="text-primary text-sm font-medium mt-2 hover:underline"
                    >
                      Assign Now
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Recent Transactions */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <BarChart3 size={20} className="text-primary"/> Recent Transactions
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-left">Product</th>
                      <th className="p-2 text-left">MR</th>
                      <th className="p-2 text-right">Quantity</th>
                      <th className="p-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions
                      .filter(t => assignedMrs.some(mr => mr.id === t.mrId))
                      .slice(0, 5)
                      .map(transaction => {
                        const mr = mrs.find(m => m.id === transaction.mrId);
                        return (
                          <tr key={transaction.id} className="hover:bg-slate-50">
                            <td className="p-2 text-slate-600">{transaction.date}</td>
                            <td className="p-2 font-medium">{transaction.productName}</td>
                            <td className="p-2 text-slate-600">{mr?.name || 'Unknown'}</td>
                            <td className="p-2 text-right">{transaction.quantity}</td>
                            <td className="p-2 text-right font-bold">₹{transaction.amount.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <button 
                  className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-2"
                  onClick={() => setActiveTab('REPORTS')}
                >
                  <FileText size={16} /> Generate Sales Statement
                </button>
                <button 
                  className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-2"
                  onClick={() => setActiveTab('SCHEMES')}
                >
                  <Gift size={16} /> View Promotional Schemes
                </button>
                <button 
                  className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-2"
                  onClick={() => setActiveTab('TARGETS')}
                >
                  <Target size={16} /> View Sales Targets
                </button>
                <button 
                  className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-2"
                  onClick={() => setActiveTab('ANALYTICS')}
                >
                  <BarChart3 size={16} /> View Analytics
                </button>
              </div>
            </div>

            {/* Performance Dashboard */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-xl shadow-lg text-white">
              <p className="text-slate-400 text-xs font-bold uppercase mb-2">Current Quarter Performance</p>
              <h3 className="text-3xl font-bold mb-1">₹5,00,000</h3>
              <p className="text-slate-300 text-sm mb-4">Target: ₹7,50,000</p>
              <div className="flex justify-between text-xs text-slate-400 mb-4">
                <span>Achieved: ₹3,50,000</span>
                <span>46.7%</span>
              </div>
              <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                <div className="bg-primary h-full rounded-full" style={{width: '46.7%'}}></div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-700">
                <p className="text-slate-400 text-xs font-bold uppercase mb-2">Key Metrics</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-slate-300">Active MRs</p>
                    <p className="font-bold">{assignedMrs.length}</p>
                  </div>
                  <div>
                    <p className="text-slate-300">Avg Achievement</p>
                    <p className="font-bold">
                      {assignedMrs.length > 0 
                        ? Math.round(assignedMrs.reduce((sum, mr) => sum + mr.targetAchievement, 0) / assignedMrs.length) + '%'
                        : '0%'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Incentive Status */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Award size={20} className="text-yellow-500"/> Incentive Status
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Q3 2023 Target</span>
                  <span className="font-bold">₹5,00,000</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Achieved</span>
                  <span className="font-bold text-green-600">₹3,50,000</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Incentive Rate</span>
                  <span className="font-bold text-blue-600">2%</span>
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800">Expected Incentive</span>
                    <span className="font-bold text-green-600">₹7,000</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Assign MR Modal */}
        {showAssignMRModal && (
          <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-fadeIn overflow-hidden">
              <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2"><UserPlus size={18}/> Assign Medical Representative</h3>
                <button onClick={() => setShowAssignMRModal(false)} className="hover:bg-slate-700 p-1 rounded"><X size={18} /></button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-slate-600">
                  Select an MR to assign to <strong>{selectedPartner.name}</strong>. This enables tracking of sales performance and territory management.
                </p>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Select Medical Representative</label>
                  <select 
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary bg-white"
                    value={selectedMrIdToAssign}
                    onChange={(e) => setSelectedMrIdToAssign(e.target.value)}
                  >
                    <option value="">-- Choose MR --</option>
                    {mrs.filter(mr => !selectedPartner.assignedMrIds?.includes(mr.id)).map(mr => (
                      <option key={mr.id} value={mr.id}>
                        {mr.name} ({mr.headquarters}) - {mr.assignedArea}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button 
                    onClick={() => setShowAssignMRModal(false)} 
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleAssignMR} 
                    disabled={!selectedMrIdToAssign}
                    className="px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <CheckCircle size={16} /> Confirm Assignment
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Strategic PCD Network Management</h2>
          <p className="text-slate-500 text-sm">Comprehensive Partner, Territory & Performance Management</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowAddPartnerModal(true)}
            className="bg-primary text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-sky-600 transition-colors shadow-sm"
          >
            <Plus size={18} /> Add Partner
          </button>
          <button onClick={loadData} disabled={refreshing}
            className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-60">
            <RefreshCcw size={16} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Dashboard Tabs */}
      <div className="border-b border-slate-200 overflow-x-auto">
        <div className="flex gap-6 min-w-max">
          <button 
            onClick={() => setActiveTab('DASHBOARD')}
            className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'DASHBOARD' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <BarChart3 size={18} /> Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('PARTNERS')}
            className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'PARTNERS' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users size={18} /> Partners Network
          </button>
          <button 
            onClick={() => setActiveTab('SCHEMES')}
            className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'SCHEMES' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Gift size={18} /> Schemes & Offers
          </button>
          <button 
            onClick={() => setActiveTab('TARGETS')}
            className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'TARGETS' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Target size={18} /> Targets & Incentives
          </button>
          <button 
            onClick={() => setActiveTab('REPORTS')}
            className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'REPORTS' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText size={18} /> Reports
          </button>
          <button
            onClick={() => setActiveTab('ANALYTICS')}
            className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'ANALYTICS'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <PieChart size={18} /> Analytics
          </button>
          <button
            onClick={() => setActiveTab('ONBOARDING')}
            className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'ONBOARDING'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <UserPlus size={18} /> Onboarding
          </button>
          <button
            onClick={() => setActiveTab('COMMISSIONS')}
            className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'COMMISSIONS'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <DollarSign size={18} /> Commissions
          </button>
          <button
            onClick={() => setActiveTab('RECEIVABLES')}
            className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'RECEIVABLES'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <CreditCard size={18} /> Receivables
          </button>
          <button
            onClick={() => setActiveTab('BROADCAST')}
            className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'BROADCAST'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <MessageCircle size={18} /> Broadcast
          </button>
          <button
            onClick={() => setActiveTab('ACTIVITY')}
            className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'ACTIVITY'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Activity size={18} /> Activity Feed
          </button>
        </div>
      </div>

      {/* DASHBOARD TAB */}
      {activeTab === 'DASHBOARD' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">Active Partners</p>
                <h3 className="text-2xl font-bold text-slate-800">{activePartners}</h3>
                <p className="text-xs text-green-600 mt-1">+2 from last month</p>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Users size={24} /></div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">Territory Coverage</p>
                <h3 className="text-2xl font-bold text-slate-800">{totalTerritories}</h3>
                <p className="text-xs text-slate-500 mt-1">Unique regions</p>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg"><Map size={24} /></div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">Total Sales</p>
                <h3 className="text-2xl font-bold text-slate-800">₹{totalSales.toLocaleString()}</h3>
                <p className="text-xs text-green-600 mt-1">+15% from Q2</p>
              </div>
              <div className="p-3 bg-green-50 text-green-600 rounded-lg"><DollarSign size={24} /></div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">Avg Achievement</p>
                <h3 className="text-2xl font-bold text-slate-800">{avgTargetAchievement.toFixed(1)}%</h3>
                <p className="text-xs text-blue-600 mt-1">Target vs Actual</p>
              </div>
              <div className="p-3 bg-purple-50 text-purple-600 rounded-lg"><TrendingUp size={24} /></div>
            </div>
          </div>

          {/* Performance Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Target size={20} className="text-primary"/> Target Achievement
              </h3>
              <div className="space-y-4">
                {targets.slice(0, 3).map(target => {
                  const percentage = Math.min(100, (target.achievedAmount / target.targetAmount) * 100);
                  return (
                    <div key={target.id} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium text-slate-800">{target.partnerName}</span>
                        <span className={`text-sm font-bold ${
                          target.status === 'Achieved' ? 'text-green-600' : 
                          target.status === 'Failed' ? 'text-red-600' : 'text-blue-600'
                        }`}>
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            percentage >= 100 ? 'bg-green-500' : 'bg-primary'
                          }`} 
                          style={{width: `${percentage}%`}}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>₹{target.achievedAmount.toLocaleString()}</span>
                        <span>Target: ₹{target.targetAmount.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <BarChart3 size={20} className="text-primary"/> Top Performing Partners
              </h3>
              <div className="space-y-3">
                {partners
                  .filter(p => p.status === 'Active')
                  .sort((a, b) => {
                    const aSales = transactions
                      .filter(t => mrs.filter(mr => mr.assignedArea.includes(a.territory)).some(mr => mr.id === t.mrId))
                      .reduce((sum, t) => sum + t.amount, 0);
                    const bSales = transactions
                      .filter(t => mrs.filter(mr => mr.assignedArea.includes(b.territory)).some(mr => mr.id === t.mrId))
                      .reduce((sum, t) => sum + t.amount, 0);
                    return bSales - aSales;
                  })
                  .slice(0, 5)
                  .map((partner, index) => {
                    const partnerSales = transactions
                      .filter(t => mrs.filter(mr => mr.assignedArea.includes(partner.territory)).some(mr => mr.id === t.mrId))
                      .reduce((sum, t) => sum + t.amount, 0);
                    
                    return (
                      <div key={partner.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                            index === 0 ? 'bg-yellow-500' : 
                            index === 1 ? 'bg-gray-400' : 
                            index === 2 ? 'bg-amber-700' : 'bg-slate-300'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium text-slate-800">{partner.name}</p>
                            <p className="text-xs text-slate-600">{partner.territory}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-800">₹{partnerSales.toLocaleString()}</p>
                          <p className="text-xs text-slate-500">Sales Volume</p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Geospatial AI Territory Analysis */}
          <div className="bg-slate-900 rounded-xl shadow-lg p-6 text-white relative overflow-hidden border border-slate-700 mt-6 lg:col-span-2">
            <div className="absolute top-0 right-0 p-6 opacity-5">
              <Map size={150} />
            </div>
            <div className="flex justify-between items-center mb-6 relative z-10">
              <div>
                <h3 className="font-bold text-xl flex items-center gap-2">
                  <MapPin className="text-blue-400" /> Geospatial Territory Intelligence
                </h3>
                <p className="text-sm text-slate-400">AI-driven mapping of network coverage and structural overlap.</p>
              </div>
              <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-bold border border-blue-500/30 flex items-center gap-1">
                <Shield size={12} /> AI ACTIVE
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
              <div className="bg-slate-800/80 p-5 rounded-lg border border-slate-700 hover:border-blue-500/50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg"><AlertCircle size={20} /></div>
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">UNDERSERVED</span>
                </div>
                <h4 className="font-bold text-white mb-1">Vidarbha Region</h4>
                <p className="text-xs text-slate-400 mb-3">High search volume for cardiovascular range but 0 active PCD partners within a 150km radius.</p>
                <button className="text-xs font-bold text-blue-400 hover:text-blue-300">Run Acquisition Campaign →</button>
              </div>
              
              <div className="bg-slate-800/80 p-5 rounded-lg border border-slate-700 hover:border-orange-500/50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 bg-orange-500/10 text-orange-400 rounded-lg"><Zap size={20} /></div>
                  <span className="text-xs font-bold text-orange-400 bg-orange-500/10 px-2 py-1 rounded">CANNIBALIZATION RISK</span>
                </div>
                <h4 className="font-bold text-white mb-1">Pune Central & PCMC</h4>
                <p className="text-xs text-slate-400 mb-3">3 partners operating with overlapping monopoly lines. Territory friction detected in recent order drops.</p>
                <button className="text-xs font-bold text-blue-400 hover:text-blue-300">View Friction Map →</button>
              </div>
              
              <div className="bg-slate-800/80 p-5 rounded-lg border border-slate-700 hover:border-purple-500/50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg"><TrendingUp size={20} /></div>
                  <span className="text-xs font-bold text-purple-400 bg-purple-500/10 px-2 py-1 rounded">OPTIMAL GROWTH</span>
                </div>
                <h4 className="font-bold text-white mb-1">Nashik Corridor</h4>
                <p className="text-xs text-slate-400 mb-3">Perfect 1:1 distributor-to-retailer density. Partner is capturing 85% of target market share without friction.</p>
                <button className="text-xs font-bold text-blue-400 hover:text-blue-300">Analyze Strategy →</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PARTNERS TAB */}
      {activeTab === 'PARTNERS' && (
        <div className="space-y-6">
          {/* Toast */}
          {netToast && (
            <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 ${netToast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
              {netToast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />} {netToast.msg}
            </div>
          )}

          {/* Search and Filters */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                <input type="text" placeholder="Search name, territory, license�"
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
              <div className="flex gap-2 flex-wrap">
                <select value={netStatusFilter} onChange={e => setNetStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary">
                  <option value="">All Status</option>
                  {Array.from(new Set(networkPartners.map(p => p.status))).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={netTerritoryFilter} onChange={e => setNetTerritoryFilter(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary">
                  <option value="">All Territories</option>
                  {Array.from(new Set(networkPartners.map(p => p.territory))).sort().map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <button onClick={loadNetworkPartners}
                  className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                  <RefreshCcw size={14} className={networkLoading ? 'animate-spin' : ''} /> Refresh
                </button>
              </div>
            </div>
          </div>

          {networkLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 bg-white rounded-xl border border-slate-200">
              <RefreshCcw size={22} className="animate-spin mr-2" /> Loading partners�
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {networkPartners
                .filter(p =>
                  (!searchTerm || p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || p.territory?.toLowerCase().includes(searchTerm.toLowerCase()) || p.drug_license_no?.includes(searchTerm)) &&
                  (!netStatusFilter || p.status === netStatusFilter) &&
                  (!netTerritoryFilter || p.territory === netTerritoryFilter)
                )
                .map(p => (
                  <div key={p.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                    {/* Card header */}
                    <div className="p-5 flex-1">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow">
                            {p.name?.charAt(0)}
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-800 leading-tight">{p.name}</h3>
                            <p className="text-xs text-slate-500">{p.territory}{p.state ? ` � ${p.state}` : ''}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${p.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : p.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}>
                            {p.status}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${p.partner_grade === 'PLATINUM' ? 'bg-purple-100 text-purple-700' : p.partner_grade === 'GOLD' ? 'bg-yellow-100 text-yellow-700' : p.partner_grade === 'SILVER' ? 'bg-slate-200 text-slate-700' : 'bg-orange-100 text-orange-700'}`}>
                            {p.partner_grade}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-600">
                        {p.contact_person && <div className="flex items-center gap-1.5"><Users size={12} className="text-slate-400" />{p.contact_person}</div>}
                        {p.contact_number && <div className="flex items-center gap-1.5"><Phone size={12} className="text-slate-400" />{p.contact_number}</div>}
                        {p.email && <div className="flex items-center gap-1.5"><Mail size={12} className="text-slate-400" />{p.email}</div>}
                        {p.drug_license_no && <div className="flex items-center gap-1.5"><FileText size={12} className="text-slate-400" /><span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{p.drug_license_no}</span></div>}
                        {p.gst_registration && <div className="flex items-center gap-1.5"><Shield size={12} className="text-slate-400" /><span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{p.gst_registration}</span></div>}
                      </div>

                      <div className="mt-3 flex gap-3 text-xs text-slate-500">
                        <span>Credit: <strong className="text-slate-700">?{Number(p.credit_limit || 0).toLocaleString('en-IN')}</strong></span>
                        <span>Discount: <strong className="text-slate-700">{p.discount_percentage}%</strong></span>
                        <span>Business: <strong className="text-sky-700">?{Number(p.total_business || 0).toLocaleString('en-IN')}</strong></span>
                      </div>
                    </div>

                    {/* Card actions */}
                    <div className="border-t border-slate-100 px-4 py-3 flex gap-2">
                      <button onClick={() => handleEditPartner(p)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200 rounded-lg hover:bg-sky-100 transition-colors">
                        <Pencil size={12} /> Edit
                      </button>
                      <button onClick={() => setSelectedPartner(p as any)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">
                        <Eye size={12} /> Deep Dive
                      </button>
                      <button onClick={() => setDeleteConfirm(p)}
                        className="flex items-center justify-center gap-1 py-1.5 px-2 text-xs font-medium bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              {networkPartners.length === 0 && !networkLoading && (
                <div className="col-span-3 text-center py-16 text-slate-400">No partners found. Add one using "Add Partner" above.</div>
              )}
            </div>
          )}

          {/* Edit Partner Modal */}
          {editPartner && (
            <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-auto">
                <div className="bg-slate-900 text-white px-5 py-4 flex justify-between items-center rounded-t-xl">
                  <h3 className="font-bold flex items-center gap-2"><Pencil size={16} /> Edit Partner � {editPartner.name}</h3>
                  <button onClick={() => setEditPartner(null)} className="hover:bg-slate-700 p-1 rounded"><X size={18} /></button>
                </div>
                <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Company Name *', key: 'name', span: 2 },
                      { label: 'Territory *', key: 'territory' },
                      { label: 'State', key: 'state' },
                      { label: 'District', key: 'district' },
                      { label: 'Monopoly Territory', key: 'monopoly_territory' },
                      { label: 'Contact Person', key: 'contact_person' },
                      { label: 'Phone', key: 'contact_number' },
                      { label: 'Email', key: 'email', span: 2 },
                      { label: 'Drug License No.', key: 'drug_license_no' },
                      { label: 'License Expiry', key: 'drug_license_expiry', type: 'date' },
                      { label: 'GSTIN', key: 'gst_registration' },
                      { label: 'GST Expiry', key: 'gstin_expiry', type: 'date' },
                      { label: 'Credit Limit (?)', key: 'credit_limit', type: 'number' },
                      { label: 'Discount %', key: 'discount_percentage', type: 'number' },
                    ].map(f => (
                      <div key={f.key} className={f.span === 2 ? 'col-span-2' : ''}>
                        <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                        <input type={f.type || 'text'} value={editForm[f.key] || ''}
                          onChange={e => setEditForm((ef: any) => ({ ...ef, [f.key]: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-400" />
                      </div>
                    ))}
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Partner Grade</label>
                      <select value={editForm.partner_grade || 'BRONZE'}
                        onChange={e => setEditForm((ef: any) => ({ ...ef, partner_grade: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-400">
                        {['BRONZE','SILVER','GOLD','PLATINUM'].map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                      <select value={editForm.status || 'APPLIED'}
                        onChange={e => setEditForm((ef: any) => ({ ...ef, status: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-400">
                        {['APPLIED','ACTIVE','PENDING','INACTIVE','SUSPENDED'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-slate-200 flex gap-3 bg-slate-50 rounded-b-xl">
                  <button onClick={() => setEditPartner(null)}
                    className="flex-1 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-white">Cancel</button>
                  <button onClick={handleSaveEdit} disabled={editSaving}
                    className="flex-1 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 disabled:opacity-50 flex items-center justify-center gap-2">
                    {editSaving ? <><RefreshCcw size={14} className="animate-spin" /> Saving�</> : <><CheckCircle size={14} /> Save Changes</>}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Confirmation */}
          {deleteConfirm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                    <Trash2 size={18} className="text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">Remove Partner</h3>
                    <p className="text-sm text-slate-500">This is a soft delete � data is retained</p>
                  </div>
                </div>
                <p className="text-sm text-slate-700 mb-5 bg-slate-50 rounded-lg p-3 border border-slate-200">
                  Remove <strong>{deleteConfirm.name}</strong> ({deleteConfirm.territory}) from the PCD network? Their commissions, receivables, and transaction history will be preserved.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setDeleteConfirm(null)}
                    className="flex-1 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                  <button onClick={handleDeletePartner} disabled={deleting}
                    className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
                    {deleting ? <><RefreshCcw size={14} className="animate-spin" /> Removing�</> : <><Trash2 size={14} /> Remove</>}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SCHEMES TAB */}
      {activeTab === 'SCHEMES' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-slate-800">Promotional Schemes</h2>
            {canEdit && (
              <button 
                onClick={() => {
                  resetSchemeForm();
                  setShowSchemeModal(true);
                }}
                className="text-sm bg-primary text-white px-4 py-2 rounded-lg hover:bg-sky-600 transition-colors flex items-center gap-2 shadow-sm"
              >
                <Plus size={16} /> Add New Scheme
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {schemes.map(scheme => (
              <div key={scheme.id} className="bg-gradient-to-br from-white to-slate-50 rounded-xl border border-slate-200 shadow-sm p-6 relative overflow-hidden group hover:shadow-lg transition-shadow">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Gift size={80} className="text-primary" />
                </div>
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-3">
                    <span className={`text-xs font-bold uppercase tracking-widest border px-2 py-1 rounded ${
                      scheme.type === 'Volume' 
                        ? 'border-blue-200 text-blue-700 bg-blue-50' 
                        : scheme.type === 'Value' 
                          ? 'border-green-200 text-green-700 bg-green-50' 
                          : 'border-purple-200 text-purple-700 bg-purple-50'
                    }`}>
                      {scheme.type} Scheme
                    </span>
                    {canEdit && (
                      <div className="flex gap-1">
                        <button 
                          onClick={() => handleEditScheme(scheme)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button 
                          onClick={() => handleDeleteScheme(scheme.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">{scheme.name}</h3>
                  <p className="text-slate-600 text-sm mb-3 leading-relaxed">{scheme.description}</p>
                  
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Calendar size={12} /> <span className="font-medium">Valid Until:</span> {scheme.validUntil}
                    </div>
                    {scheme.minimumOrder && (
                      <div className="flex items-center gap-2 text-slate-500">
                        <Target size={12} /> <span className="font-medium">Min. Order:</span> ₹{scheme.minimumOrder.toLocaleString()}
                      </div>
                    )}
                    {scheme.discountPercentage && (
                      <div className="flex items-center gap-2 text-slate-500">
                        <Award size={12} /> <span className="font-medium">Discount:</span> {scheme.discountPercentage}%
                      </div>
                    )}
                    {scheme.eligibilityCriteria && (
                      <div className="flex items-start gap-2 text-slate-500">
                        <CheckCircle size={12} /> <span className="font-medium">Eligibility:</span> {scheme.eligibilityCriteria}
                      </div>
                    )}
                  </div>
                  
                  {scheme.bonusIncentives && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-xs text-slate-600 font-medium">Bonus Incentives: {scheme.bonusIncentives}</p>
                    </div>
                  )}
                  
                  <button 
                    onClick={() => handleApplyScheme(scheme)}
                    className="w-full mt-4 bg-primary text-white py-2 rounded-lg hover:bg-sky-600 transition-colors font-medium"
                  >
                    Apply Scheme
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TRANSACTION MODAL (Apply Scheme) */}
      {showTransactionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-xl my-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Zap className="text-amber-500"/> Apply Promotional Scheme
              </h3>
              <button 
                onClick={() => setShowTransactionModal(false)}
                className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateTransaction} className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg mb-4">
                <p className="text-sm text-amber-800 font-bold">Applying: {selectedSchemeForTx?.name}</p>
                <p className="text-xs text-amber-700 mt-1">Benefit: {selectedSchemeForTx?.discountPercentage}% Discount (Min Order: ₹{selectedSchemeForTx?.minimumOrder?.toLocaleString()})</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select Franchise Partner *</label>
                <select
                  required
                  value={txForm.partnerId}
                  onChange={(e) => setTxForm({...txForm, partnerId: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  <option value="">-- Choose Partner --</option>
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.territory})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Product *</label>
                  <select
                    required
                    value={txForm.productId}
                    onChange={(e) => {
                      const product = rptTransactions.find(t => t.product_id === e.target.value) || {}; // Placeholder for real product list
                      setTxForm({...txForm, productId: e.target.value});
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  >
                    <option value="">-- Choose Product --</option>
                    {/* In a real app, you'd fetch the full product list here. 
                        For this POC, we'll use the existing transaction data to pull product IDs or hardcode common ones */}
                    <option value="8c2abe12-1114-4a4b-9e48-84227f2f1111">Augmentin 625 Duo</option>
                    <option value="9d3bcf23-2225-5b5c-0f59-95338g3g2222">Amlodipine 5mg</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Batch *</label>
                  <select
                    required
                    value={txForm.batchId}
                    onChange={(e) => setTxForm({...txForm, batchId: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  >
                    <option value="">-- Choose Batch --</option>
                    <option value="b1111111-1111-1111-1111-111111111111">B-AUG-001</option>
                    <option value="b2222222-2222-2222-2222-222222222222">BT-AMLO-2024A</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Quantity *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={txForm.quantity}
                    onChange={(e) => setTxForm({...txForm, quantity: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Order Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    value={txForm.amount}
                    onChange={(e) => setTxForm({...txForm, amount: parseFloat(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowTransactionModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-sky-600 transition-colors flex items-center gap-2 shadow-lg"
                >
                  <CheckCircle size={16} /> Execute Scheme Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TARGETS TAB */}
      {activeTab === 'TARGETS' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Performance Targets & Incentives</h3>
              {canEdit && (
                <div className="flex gap-2">
                  <button 
                    onClick={handleSetNewTarget}
                    className="text-sm bg-primary hover:bg-sky-600 px-3 py-1.5 rounded-lg text-white font-medium transition-colors flex items-center gap-2"
                  >
                    <Plus size={14} /> Set New Target
                  </button>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
                  <tr>
                    <th className="p-4">Partner</th>
                    <th className="p-4">Territory</th>
                    <th className="p-4">Period</th>
                    <th className="p-4 text-right">Target</th>
                    <th className="p-4 text-right">Achieved</th>
                    <th className="p-4 w-48">Progress</th>
                    <th className="p-4 text-right">Incentive</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {targets.map(target => {
                    const percentage = Math.min(100, (target.achievedAmount / target.targetAmount) * 100);
                    const partner = partners.find(p => p.id === target.partnerId);
                    return (
                      <tr key={target.id} className="hover:bg-slate-50">
                        <td className="p-4 font-medium text-slate-800">
                          <div className="flex items-center gap-2">
                            <span>{target.partnerName}</span>
                            <button 
                              onClick={() => handleSetTargetForPartner(partners.find(p => p.id === target.partnerId) || partners[0])}
                              className="text-xs text-blue-600 hover:text-blue-800 underline"
                              title="Manage this partner's targets"
                            >
                              Manage
                            </button>
                          </div>
                        </td>
                        <td className="p-4 text-sm text-slate-600">{partner?.territory || 'N/A'}</td>
                        <td className="p-4 text-sm text-slate-600">{target.period}</td>
                        <td className="p-4 text-right text-sm text-slate-600">₹{target.targetAmount.toLocaleString()}</td>
                        <td className="p-4 text-right text-sm font-bold text-slate-800">₹{target.achievedAmount.toLocaleString()}</td>
                        <td className="p-4">
                          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                percentage >= 100 ? 'bg-green-500' : 'bg-primary'
                              }`} 
                              style={{width: `${percentage}%`}}
                            ></div>
                          </div>
                          <p className="text-xs text-right mt-1 text-slate-500">{percentage.toFixed(1)}%</p>
                        </td>
                        <td className="p-4 text-right text-sm font-bold text-green-600">
                          {target.incentivePercentage}%
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                            target.status === 'Achieved' ? 'bg-green-100 text-green-700' : 
                            target.status === 'Failed' ? 'bg-red-100 text-red-700' : 
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {target.status}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex gap-2 justify-center">
                            <button 
                              onClick={() => handleEditTarget(target)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded" 
                              title="Edit Target"
                            >
                              <Pencil size={16} />
                            </button>
                            <button 
                              onClick={() => handleDeleteTarget(target.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded" 
                              title="Delete Target"
                            >
                              <Trash2 size={16} />
                            </button>
                            <button 
                              onClick={() => {
                                const newAmount = prompt('Enter new achieved amount:', target.achievedAmount.toString());
                                if(newAmount && !isNaN(Number(newAmount))) {
                                  handleUpdateTargetAchievement(target.id, Number(newAmount));
                                }
                              }}
                              className="p-1 text-green-600 hover:bg-green-50 rounded" 
                              title="Update Achievement"
                            >
                              <Target size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Targets Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-slate-500 text-sm">Total Targets</p>
              <h3 className="text-2xl font-bold text-slate-800">{targets.length}</h3>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-slate-500 text-sm">Achieved</p>
              <h3 className="text-2xl font-bold text-green-600">
                {targets.filter(t => t.status === 'Achieved').length}
              </h3>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-slate-500 text-sm">Pending</p>
              <h3 className="text-2xl font-bold text-orange-600">
                {targets.filter(t => t.status === 'Pending').length}
              </h3>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-slate-500 text-sm">Total Incentives</p>
              <h3 className="text-2xl font-bold text-blue-600">
                ₹{targets.reduce((sum, t) => sum + (t.targetAmount * t.incentivePercentage / 100), 0).toLocaleString()}
              </h3>
            </div>
          </div>
        </div>
      )}

      {/* SCHEME MODAL */}
      {showSchemeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-2xl my-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Gift className="text-primary"/> {schemeForm.id ? 'Edit Scheme' : 'Create New Promotional Scheme'}
              </h3>
              <div className="flex items-center gap-4">
                {!schemeForm.id && (
                  <button 
                    type="button"
                    onClick={handleAIGenerateScheme}
                    className="bg-purple-100 text-purple-700 hover:bg-purple-200 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors border border-purple-200 shadow-sm"
                  >
                    <Zap size={16} /> Auto-Generate Smart Scheme
                  </button>
                )}
                <button 
                  onClick={() => {
                    setShowSchemeModal(false);
                    resetSchemeForm();
                  }}
                  className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <form onSubmit={handleSaveScheme} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Scheme Name *</label>
                  <input
                    type="text"
                    required
                    value={schemeForm.name}
                    onChange={(e) => setSchemeForm({...schemeForm, name: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                    placeholder="Enter scheme name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Scheme Type *</label>
                  <select
                    required
                    value={schemeForm.type}
                    onChange={(e) => setSchemeForm({...schemeForm, type: e.target.value as any})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  >
                    <option value="Volume">Volume Based</option>
                    <option value="Value">Value Based</option>
                    <option value="Product">Product Based</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Scheme Code</label>
                  <input
                    type="text"
                    value={schemeForm.schemeCode}
                    onChange={(e) => setSchemeForm({...schemeForm, schemeCode: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                    placeholder="Enter scheme code"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Valid Until *</label>
                  <input
                    type="date"
                    required
                    value={schemeForm.validUntil}
                    onChange={(e) => setSchemeForm({...schemeForm, validUntil: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Minimum Order Amount</label>
                  <input
                    type="number"
                    value={schemeForm.minimumOrder || ''}
                    onChange={(e) => setSchemeForm({...schemeForm, minimumOrder: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                    placeholder="0"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Discount Percentage</label>
                  <input
                    type="number"
                    value={schemeForm.discountPercentage || ''}
                    onChange={(e) => setSchemeForm({...schemeForm, discountPercentage: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                    placeholder="0"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
                <textarea
                  required
                  rows={3}
                  value={schemeForm.description}
                  onChange={(e) => setSchemeForm({...schemeForm, description: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  placeholder="Describe the scheme in detail"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Eligibility Criteria</label>
                <input
                  type="text"
                  value={schemeForm.eligibilityCriteria}
                  onChange={(e) => setSchemeForm({...schemeForm, eligibilityCriteria: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  placeholder="Enter eligibility criteria"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Bonus Incentives</label>
                <input
                  type="text"
                  value={schemeForm.bonusIncentives}
                  onChange={(e) => setSchemeForm({...schemeForm, bonusIncentives: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  placeholder="Enter bonus incentives"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Free Products (if any)</label>
                <input
                  type="text"
                  value={schemeForm.freeProducts}
                  onChange={(e) => setSchemeForm({...schemeForm, freeProducts: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  placeholder="Enter free products"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Target Products</label>
                <input
                  type="text"
                  value={schemeForm.targetProducts}
                  onChange={(e) => setSchemeForm({...schemeForm, targetProducts: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  placeholder="Enter target products"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Terms & Conditions</label>
                <textarea
                  rows={2}
                  value={schemeForm.terms}
                  onChange={(e) => setSchemeForm({...schemeForm, terms: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  placeholder="Enter terms and conditions"
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowSchemeModal(false);
                    resetSchemeForm();
                  }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-sky-600 transition-colors"
                >
                  {schemeForm.id ? 'Update' : 'Create'} Scheme
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TARGET MODAL */}
      {showTargetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-2xl my-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Target className="text-primary"/> {targetForm.id ? 'Edit Target' : 'Set New Target'}
              </h3>
              <div className="flex items-center gap-4">
                {!targetForm.id && targetForm.partnerId && (
                  <button 
                    type="button"
                    onClick={handleAIGenerateTarget}
                    className="bg-purple-100 text-purple-700 hover:bg-purple-200 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors border border-purple-200 shadow-sm"
                  >
                    <Zap size={16} /> Auto-Generate Smart Target
                  </button>
                )}
                <button 
                  onClick={() => {
                    setShowTargetModal(false);
                    resetTargetForm();
                  }}
                  className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <form onSubmit={handleSaveTarget} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Partner *</label>
                  <select
                    required
                    value={targetForm.partnerId}
                    onChange={(e) => {
                      const partner = partners.find(p => p.id === e.target.value);
                      setTargetForm({...targetForm, partnerId: e.target.value, partnerName: partner?.name || ''});
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                    disabled={!!targetForm.id} // Disable for edit mode
                  >
                    <option value="">Select Partner</option>
                    {partners.map(partner => (
                      <option key={partner.id} value={partner.id}>{partner.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Period *</label>
                  <input
                    type="text"
                    required
                    value={targetForm.period}
                    onChange={(e) => setTargetForm({...targetForm, period: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                    placeholder="e.g., Q1 2024"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Target Amount *</label>
                  <input
                    type="number"
                    required
                    value={targetForm.targetAmount || ''}
                    onChange={(e) => setTargetForm({...targetForm, targetAmount: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                    placeholder="0"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Achieved Amount</label>
                  <input
                    type="number"
                    value={targetForm.achievedAmount || ''}
                    onChange={(e) => setTargetForm({...targetForm, achievedAmount: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                    placeholder="0"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Incentive Percentage *</label>
                  <input
                    type="number"
                    required
                    value={targetForm.incentivePercentage || ''}
                    onChange={(e) => setTargetForm({...targetForm, incentivePercentage: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                    placeholder="0"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status *</label>
                  <select
                    required
                    value={targetForm.status}
                    onChange={(e) => setTargetForm({...targetForm, status: e.target.value as any})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Achieved">Achieved</option>
                    <option value="Failed">Failed</option>
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowTargetModal(false);
                    resetTargetForm();
                  }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-sky-600 transition-colors"
                >
                  {targetForm.id ? 'Update' : 'Set'} Target
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REPORTS TAB */}
      {activeTab === 'REPORTS' && (
        <div className="space-y-6">
          {/* Header + filters */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">PCD Network Reports</h2>
              <p className="text-slate-500 text-sm">Live data from database — filter, analyse, export</p>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <input type="date" value={rptDateFrom} onChange={e => setRptDateFrom(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary" />
              <span className="text-slate-400 text-sm">to</span>
              <input type="date" value={rptDateTo} onChange={e => setRptDateTo(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary" />
              <button onClick={loadReportData}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-sky-600 transition-colors flex items-center gap-2 text-sm">
                <RefreshCcw size={14} /> Refresh
              </button>
            </div>
          </div>

          {rptError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
              <AlertCircle size={16} /> {rptError}
            </div>
          )}

          {rptLoading ? (
            <div className="flex items-center justify-center py-24 text-slate-400">
              <RefreshCcw size={24} className="animate-spin mr-3" /> Loading report data…
            </div>
          ) : (
            <>
              {/* KPI Summary Cards */}
              {rptSummary && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                    <div className="text-sky-500 mb-2"><Users size={18} /></div>
                    <div className="text-xl font-bold text-slate-800">{rptSummary.totalPartners}</div>
                    <div className="text-xs text-slate-500 mt-0.5">Active Partners</div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                    <div className="text-green-500 mb-2"><DollarSign size={18} /></div>
                    <div className="text-xl font-bold text-slate-800">₹{Number(rptSummary.totalRevenue).toLocaleString('en-IN')}</div>
                    <div className="text-xs text-slate-500 mt-0.5">Total Revenue</div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                    <div className="text-purple-500 mb-2"><Target size={18} /></div>
                    <div className="text-xl font-bold text-slate-800">{rptSummary.avgTargetAchievement}%</div>
                    <div className="text-xs text-slate-500 mt-0.5">Avg Achievement</div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                    <div className="text-orange-500 mb-2"><Gift size={18} /></div>
                    <div className="text-xl font-bold text-slate-800">{rptSummary.activeSchemes}</div>
                    <div className="text-xs text-slate-500 mt-0.5">Active Schemes</div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                    <div className="text-yellow-500 mb-2"><Clock size={18} /></div>
                    <div className="text-xl font-bold text-slate-800">{rptSummary.pendingApprovals}</div>
                    <div className="text-xs text-slate-500 mt-0.5">Pending Approvals</div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                    <div className="text-red-500 mb-2"><CreditCard size={18} /></div>
                    <div className="text-xl font-bold text-slate-800">₹{Number(rptSummary.outstandingReceivables).toLocaleString('en-IN')}</div>
                    <div className="text-xs text-slate-500 mt-0.5">Receivables</div>
                  </div>
                </div>
              )}

              {/* Territory Revenue Bar Chart */}
              {rptPartners.length > 0 && (() => {
                const byTerritory = rptPartners.reduce((acc: any, p: any) => {
                  const t = p.territory || 'Unknown';
                  acc[t] = (acc[t] || 0) + Number(p.total_business || 0);
                  return acc;
                }, {});
                const chartData = Object.entries(byTerritory)
                  .map(([territory, revenue]) => ({ territory, revenue: Number(revenue) }))
                  .sort((a, b) => b.revenue - a.revenue)
                  .slice(0, 12);
                const COLORS = ['#0ea5e9','#22c55e','#a855f7','#f97316','#ef4444','#06b6d4','#84cc16','#f59e0b','#6366f1','#ec4899','#14b8a6','#8b5cf6'];
                return (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <BarChart3 size={18} className="text-sky-500" /> Revenue by Territory
                    </h3>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="territory" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']} />
                        <Bar dataKey="revenue" radius={[4,4,0,0]}>
                          {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}

              {/* Section tabs */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="flex border-b border-slate-200 overflow-x-auto">
                  {([
                    { id: 'partners', label: 'Partners', icon: <Users size={14} /> },
                    { id: 'targets', label: 'Targets', icon: <Target size={14} /> },
                    { id: 'transactions', label: 'Transactions', icon: <FileText size={14} /> },
                    { id: 'mrs', label: 'MR Performance', icon: <Briefcase size={14} /> },
                    { id: 'commissions', label: 'Commissions', icon: <DollarSign size={14} /> },
                    { id: 'receivables', label: 'Receivables', icon: <CreditCard size={14} /> },
                  ] as const).map(s => (
                    <button key={s.id} onClick={() => setRptActiveSection(s.id)}
                      className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${rptActiveSection === s.id ? 'border-sky-500 text-sky-600 bg-sky-50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
                      {s.icon} {s.label}
                    </button>
                  ))}
                </div>

                <div className="p-4">
                  {/* Partners Table */}
                  {rptActiveSection === 'partners' && (
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm text-slate-500">{rptPartners.length} partners</span>
                        <button onClick={() => exportPCDPartnerPerformanceReport(rptPartners, rptTargets, rptTransactions)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                          <Download size={14} /> Export Excel
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-max w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              {['Partner Name','Territory','Grade','Status','Total Business','Credit Limit','Drug License'].map(h => (
                                <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rptPartners.map((p: any) => (
                              <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="px-3 py-2 font-medium text-slate-800">{p.name}</td>
                                <td className="px-3 py-2 text-slate-600">{p.territory}</td>
                                <td className="px-3 py-2">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.partner_grade === 'PLATINUM' ? 'bg-purple-100 text-purple-700' : p.partner_grade === 'GOLD' ? 'bg-yellow-100 text-yellow-700' : p.partner_grade === 'SILVER' ? 'bg-slate-100 text-slate-700' : 'bg-orange-100 text-orange-700'}`}>
                                    {p.partner_grade || 'BRONZE'}
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{p.status}</span>
                                </td>
                                <td className="px-3 py-2 font-semibold text-slate-800">₹{Number(p.total_business || 0).toLocaleString('en-IN')}</td>
                                <td className="px-3 py-2 text-slate-600">₹{Number(p.credit_limit || 0).toLocaleString('en-IN')}</td>
                                <td className="px-3 py-2 text-slate-500 text-xs">{p.drug_license_no || '—'}</td>
                              </tr>
                            ))}
                            {rptPartners.length === 0 && (
                              <tr><td colSpan={7} className="text-center py-8 text-slate-400">No partner data found</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Targets Table */}
                  {rptActiveSection === 'targets' && (
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm text-slate-500">{rptTargets.length} targets</span>
                        <button onClick={() => exportPCDTargetVsAchievementReport(rptTargets, rptPartners)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                          <Download size={14} /> Export Excel
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-max w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              {['Partner','Period','Target (₹)','Achieved (₹)','Achievement %','Incentive %','Bonus (₹)','Status'].map(h => (
                                <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rptTargets.map((t: any) => {
                              const pct = t.target_amount > 0 ? ((t.achieved_amount / t.target_amount) * 100).toFixed(1) : '0.0';
                              const pctNum = parseFloat(pct);
                              return (
                                <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                                  <td className="px-3 py-2 font-medium text-slate-800">{t.partner_name || t.partner_id}</td>
                                  <td className="px-3 py-2 text-slate-600">{t.period}</td>
                                  <td className="px-3 py-2">₹{Number(t.target_amount).toLocaleString('en-IN')}</td>
                                  <td className="px-3 py-2 font-semibold">₹{Number(t.achieved_amount || 0).toLocaleString('en-IN')}</td>
                                  <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <div className="w-20 bg-slate-200 rounded-full h-1.5">
                                        <div className={`h-1.5 rounded-full ${pctNum >= 100 ? 'bg-green-500' : pctNum >= 70 ? 'bg-yellow-500' : 'bg-red-400'}`} style={{ width: `${Math.min(pctNum, 100)}%` }} />
                                      </div>
                                      <span className={`text-xs font-semibold ${pctNum >= 100 ? 'text-green-600' : pctNum >= 70 ? 'text-yellow-600' : 'text-red-500'}`}>{pct}%</span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-slate-600">{t.incentive_percentage}%</td>
                                  <td className="px-3 py-2 text-slate-600">₹{Number(t.bonus_amount || 0).toLocaleString('en-IN')}</td>
                                  <td className="px-3 py-2">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.status === 'ACHIEVED' || t.status === 'EXCEEDED' ? 'bg-green-100 text-green-700' : t.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{t.status}</span>
                                  </td>
                                </tr>
                              );
                            })}
                            {rptTargets.length === 0 && (
                              <tr><td colSpan={8} className="text-center py-8 text-slate-400">No target data found</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Transactions Table */}
                  {rptActiveSection === 'transactions' && (
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm text-slate-500">{rptTransactions.length} transactions</span>
                        <button onClick={() => exportPCDPartnerPerformanceReport(rptPartners, rptTargets, rptTransactions)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                          <Download size={14} /> Export Excel
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-max w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              {['Date','Partner','Product','Qty','Amount (₹)','Discount','Order Status','Payment'].map(h => (
                                <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rptTransactions.slice(0, 200).map((tx: any) => (
                              <tr key={tx.id} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{tx.order_date ? new Date(tx.order_date).toLocaleDateString('en-IN') : '—'}</td>
                                <td className="px-3 py-2 font-medium text-slate-800">{tx.partner_name || tx.partner_id}</td>
                                <td className="px-3 py-2 text-slate-600">{tx.product_name || '—'}</td>
                                <td className="px-3 py-2 text-slate-600">{tx.quantity}</td>
                                <td className="px-3 py-2 font-semibold">₹{Number(tx.order_amount).toLocaleString('en-IN')}</td>
                                <td className="px-3 py-2 text-slate-500">{tx.discount_given ? `${tx.discount_given}%` : '—'}</td>
                                <td className="px-3 py-2">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tx.order_status === 'VERIFIED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{tx.order_status}</span>
                                </td>
                                <td className="px-3 py-2">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tx.payment_status === 'PAID' ? 'bg-green-100 text-green-700' : tx.payment_status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{tx.payment_status}</span>
                                </td>
                              </tr>
                            ))}
                            {rptTransactions.length === 0 && (
                              <tr><td colSpan={8} className="text-center py-8 text-slate-400">No transactions found for selected date range</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* MR Performance Table */}
                  {rptActiveSection === 'mrs' && (
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm text-slate-500">{rptMrs.length} medical representatives</span>
                        <button onClick={() => exportPCDMRPerformanceReport(rptMrs, rptTransactions, rptPartners)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                          <Download size={14} /> Export Excel
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-max w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              {['MR Name','HQ','Assigned Area','Sales Target','Total Sales','Achievement %','Base Salary','Status'].map(h => (
                                <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rptMrs.map((mr: any) => {
                              const totalSales = rptTransactions.filter((tx: any) => tx.mr_id === mr.id).reduce((s: number, tx: any) => s + Number(tx.order_amount || 0), 0);
                              const pct = mr.sales_target > 0 ? ((totalSales / mr.sales_target) * 100).toFixed(1) : '0.0';
                              return (
                                <tr key={mr.id} className="border-b border-slate-100 hover:bg-slate-50">
                                  <td className="px-3 py-2 font-medium text-slate-800">{mr.name}</td>
                                  <td className="px-3 py-2 text-slate-600">{mr.headquarters}</td>
                                  <td className="px-3 py-2 text-slate-600">{mr.assigned_area}</td>
                                  <td className="px-3 py-2">₹{Number(mr.sales_target || 0).toLocaleString('en-IN')}</td>
                                  <td className="px-3 py-2 font-semibold">₹{totalSales.toLocaleString('en-IN')}</td>
                                  <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <div className="w-16 bg-slate-200 rounded-full h-1.5">
                                        <div className={`h-1.5 rounded-full ${parseFloat(pct) >= 100 ? 'bg-green-500' : parseFloat(pct) >= 70 ? 'bg-yellow-500' : 'bg-red-400'}`} style={{ width: `${Math.min(parseFloat(pct), 100)}%` }} />
                                      </div>
                                      <span className="text-xs font-semibold text-slate-700">{pct}%</span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2">₹{Number(mr.base_salary || 0).toLocaleString('en-IN')}</td>
                                  <td className="px-3 py-2">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${mr.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{mr.status}</span>
                                  </td>
                                </tr>
                              );
                            })}
                            {rptMrs.length === 0 && (
                              <tr><td colSpan={8} className="text-center py-8 text-slate-400">No MR data found</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Commissions Table */}
                  {rptActiveSection === 'commissions' && (
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm text-slate-500">{rptCommissions.length} commission records</span>
                        <button onClick={() => exportPCDIncentiveStatementReport(rptTargets, rptPartners)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                          <Download size={14} /> Export Excel
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-max w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              {['Partner','Grade','Period','Base Commission','Scheme Bonus','Deductions','Net Commission','Status','Paid On'].map(h => (
                                <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rptCommissions.map((c: any) => (
                              <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="px-3 py-2 font-medium text-slate-800">{c.partner_name || c.partner_id}</td>
                                <td className="px-3 py-2">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.partner_grade === 'PLATINUM' ? 'bg-purple-100 text-purple-700' : c.partner_grade === 'GOLD' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {c.partner_grade || '—'}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-slate-600">{c.period}</td>
                                <td className="px-3 py-2">₹{Number(c.base_commission || 0).toLocaleString('en-IN')}</td>
                                <td className="px-3 py-2 text-green-600">+₹{Number(c.scheme_bonus || 0).toLocaleString('en-IN')}</td>
                                <td className="px-3 py-2 text-red-500">-₹{Number(c.deductions || 0).toLocaleString('en-IN')}</td>
                                <td className="px-3 py-2 font-bold text-slate-800">₹{Number(c.net_commission || 0).toLocaleString('en-IN')}</td>
                                <td className="px-3 py-2">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.payment_status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{c.payment_status}</span>
                                </td>
                                <td className="px-3 py-2 text-slate-500">{c.paid_on ? new Date(c.paid_on).toLocaleDateString('en-IN') : '—'}</td>
                              </tr>
                            ))}
                            {rptCommissions.length === 0 && (
                              <tr><td colSpan={9} className="text-center py-8 text-slate-400">No commission records. Generate commissions from the Commissions tab.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Receivables Table */}
                  {rptActiveSection === 'receivables' && (
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm text-slate-500">{rptReceivables.length} receivable entries</span>
                        <button onClick={() => exportPCDOverallAnalyticsReport(rptPartners, rptMrs, [], rptTargets, rptTransactions)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                          <Download size={14} /> Export Excel
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-max w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              {['Partner','Invoice ID','Invoice Date','Invoice Amt','Paid Amt','Outstanding','Due Date','Days Overdue','Status'].map(h => (
                                <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rptReceivables.map((r: any) => (
                              <tr key={r.id} className={`border-b border-slate-100 hover:bg-slate-50 ${r.days_overdue > 0 && r.status !== 'CLEARED' ? 'bg-red-50/40' : ''}`}>
                                <td className="px-3 py-2 font-medium text-slate-800">{r.partner_name || r.partner_id}</td>
                                <td className="px-3 py-2 text-slate-600 text-xs font-mono">{r.invoice_id}</td>
                                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.invoice_date ? new Date(r.invoice_date).toLocaleDateString('en-IN') : '—'}</td>
                                <td className="px-3 py-2">₹{Number(r.invoice_amount).toLocaleString('en-IN')}</td>
                                <td className="px-3 py-2 text-green-600">₹{Number(r.paid_amount || 0).toLocaleString('en-IN')}</td>
                                <td className="px-3 py-2 font-bold text-slate-800">₹{Number(r.outstanding_amount || 0).toLocaleString('en-IN')}</td>
                                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.due_date ? new Date(r.due_date).toLocaleDateString('en-IN') : '—'}</td>
                                <td className="px-3 py-2">
                                  {r.days_overdue > 0 && r.status !== 'CLEARED'
                                    ? <span className="text-red-600 font-semibold">{r.days_overdue}d</span>
                                    : <span className="text-slate-400">—</span>}
                                </td>
                                <td className="px-3 py-2">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.status === 'CLEARED' ? 'bg-green-100 text-green-700' : r.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700' : r.days_overdue > 0 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{r.status}</span>
                                </td>
                              </tr>
                            ))}
                            {rptReceivables.length === 0 && (
                              <tr><td colSpan={9} className="text-center py-8 text-slate-400">No receivables found</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ANALYTICS TAB */}

      {/* ONBOARDING TAB */}
      {activeTab === 'ONBOARDING' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Partner Onboarding</h2>
            <p className="text-slate-500 text-sm">New application + document verification against live database</p>
          </div>
          <PCDPartnerOnboarding />
        </div>
      )}

      {/* COMMISSIONS TAB */}
      {activeTab === 'COMMISSIONS' && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-slate-800">Commission Management</h2>
          <PCDCommissionEngine />
        </div>
      )}

      {/* RECEIVABLES TAB */}
      {activeTab === 'RECEIVABLES' && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-slate-800">Receivables & Outstanding Dues</h2>
          <PCDReceivablesTracker />
        </div>
      )}

      {/* BROADCAST TAB */}
      {activeTab === 'BROADCAST' && (
        <div className="space-y-6">
          <PCDBroadcastCenter />
        </div>
      )}

      {/* ACTIVITY FEED TAB */}
      {activeTab === 'ACTIVITY' && (
        <div className="space-y-6">
          <PCDActivityFeed />
        </div>
      )}

      {/* ENHANCED ANALYTICS TAB */}
      {activeTab === 'ANALYTICS' && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-slate-800">Territory & Performance Analytics</h2>
          <PCDTerritoryHeatMap />
        </div>
      )}

      {/* Add Partner Modal */}
      {showAddPartnerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl animate-fadeIn my-auto">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center rounded-t-xl">
              <h3 className="font-bold flex items-center gap-2">
                <Building2 size={18} /> Register New PCD Partner
              </h3>
              <button onClick={() => setShowAddPartnerModal(false)} className="hover:bg-slate-700 p-1 rounded">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddPartner} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Partner / Agency Name *</label>
                  <input 
                    required 
                    type="text" 
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
                    value={partnerForm.name}
                    onChange={e => setPartnerForm({...partnerForm, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Assigned Territory *</label>
                  <input 
                    required 
                    type="text" 
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g. Pune District"
                    value={partnerForm.territory}
                    onChange={e => setPartnerForm({...partnerForm, territory: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contact Number *</label>
                  <input 
                    required 
                    type="tel" 
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
                    value={partnerForm.contact}
                    onChange={e => setPartnerForm({...partnerForm, contact: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email Address *</label>
                  <input 
                    required 
                    type="email" 
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
                    value={partnerForm.email}
                    onChange={e => setPartnerForm({...partnerForm, email: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Drug License Number *</label>
                  <input 
                    required 
                    type="text" 
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
                    value={partnerForm.drugLicenseNo}
                    onChange={e => setPartnerForm({...partnerForm, drugLicenseNo: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">GSTIN</label>
                  <input 
                    type="text" 
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
                    value={partnerForm.gstin}
                    onChange={e => setPartnerForm({...partnerForm, gstin: e.target.value})}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Registered Address</label>
                <textarea 
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  value={partnerForm.address}
                  onChange={e => setPartnerForm({...partnerForm, address: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Credit Limit (₹)</label>
                  <input 
                    type="number" 
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
                    value={partnerForm.creditLimit}
                    onChange={e => setPartnerForm({...partnerForm, creditLimit: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Payment Terms</label>
                  <select 
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
                    value={partnerForm.paymentTerms}
                    onChange={e => setPartnerForm({...partnerForm, paymentTerms: e.target.value})}
                  >
                    <option value="Immediate">Immediate</option>
                    <option value="7 Days">7 Days</option>
                    <option value="15 Days">15 Days</option>
                    <option value="30 Days">30 Days</option>
                    <option value="45 Days">45 Days</option>
                    <option value="60 Days">60 Days</option>
                  </select>
                </div>
              </div>
              
              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowAddPartnerModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-sky-600 flex items-center gap-2"
                >
                  <CheckCircle size={16} /> Register Partner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StrategicPCD;


