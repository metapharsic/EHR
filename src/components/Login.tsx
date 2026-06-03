import React, { useState, useEffect } from 'react';
import { Lock, User, ArrowRight, Play, X, LayoutDashboard, ShoppingCart, Package, Truck, CreditCard, Map, UserPlus, Globe, Factory, ClipboardCheck, Activity, Database, FileText, Briefcase, BarChart3, ShieldCheck, Layers, Settings, CheckCircle, Mail, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import { Tab } from '../types';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [activeDemoTab, setActiveDemoTab] = useState(0);
  const { login, verify2FA, twoFactorRequired, twoFactorUserId } = useAuth();
  const [verificationCode, setVerificationCode] = useState('');
  const [currentSlide, setCurrentSlide] = useState(0);

  // Authentication View Modes logic
  const [viewMode, setViewMode] = useState<'login' | 'forgot' | 'reset'>('login');
  const [emailInput, setEmailInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const slides = [
    {
      title: "Centralized Enterprise Hub.",
      description: "Unified operation portal designed for pharmaceutical agility and business intelligence.",
      image: "/slide-hub.png",
      accent: "from-emerald-50/80 to-teal-50/80"
    },
    {
      title: "Intelligent Financial Ledger.",
      description: "Experience next-generation accounting with automated reconciliation, smart analytics, and precise tracking.",
      image: "/slide-ledger.png",
      accent: "from-blue-50/80 to-indigo-50/80"
    },
    {
      title: "Secured Data Governance.",
      description: "Enterprise-grade encryption and comprehensive audit trails ensure sensitive data remains protected and compliant.",
      image: "/slide-governance.png",
      accent: "from-cyan-50/80 to-sky-50/80"
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  // Auto-launch demo mode
  const launchDemo = async () => {
    setUsername('admin');
    setPassword('admin');
    setIsLoading(true);
    setError('');
    
    setTimeout(async () => {
      try {
        const result = await login('admin', 'admin');
        if (!result.success && result.error) {
          setError(result.error);
          setIsLoading(false);
        }
      } catch (err: any) {
        setError(err.message || 'Demo launch failed');
        setIsLoading(false);
      }
    }, 500);
  };

  // ERP Modules for Demo
  const demoModules = [
    {
      category: 'Core Operations',
      items: [
        { id: Tab.DASHBOARD, name: 'Dashboard', icon: LayoutDashboard, desc: 'Executive overview with KPIs, analytics, and real-time business intelligence', color: 'blue' },
        { id: Tab.POS, name: 'POS / Billing', icon: ShoppingCart, desc: 'Point of Sale with GST compliance, multi-payment modes, and invoice generation', color: 'green' },
        { id: Tab.INVENTORY, name: 'Inventory', icon: Package, desc: 'Stock management with expiry tracking, batch control, and reorder alerts', color: 'purple' },
        { id: Tab.PURCHASE, name: 'Purchase', icon: Truck, desc: 'Purchase orders, supplier management, and GRN processing', color: 'orange' },
        { id: Tab.ACCOUNTS, name: 'Accounts', icon: CreditCard, desc: 'Financial accounting, ledgers, and payment tracking', color: 'cyan' },
      ]
    },
    {
      category: 'Sales & Distribution',
      items: [
        { id: Tab.PCD, name: 'PCD Network', icon: Map, desc: 'Pharma franchise management with territory tracking and partner analytics', color: 'indigo' },
        { id: Tab.CRM, name: 'CRM (Leads)', icon: UserPlus, desc: 'Customer relationship management with lead scoring and opportunity pipeline', color: 'pink' },
        { id: Tab.OMS, name: 'Order Management', icon: Globe, desc: 'Order processing, dispatch tracking, and delivery management', color: 'teal' },
      ]
    },
    {
      category: 'Production & Quality',
      items: [
        { id: Tab.MANUFACTURING, name: 'Manufacturing', icon: Factory, desc: 'Production planning, batch processing, and BOM management', color: 'amber' },
        { id: Tab.QC, name: 'Quality Control', icon: ClipboardCheck, desc: 'Quality testing, batch approval, and compliance tracking', color: 'emerald' },
        { id: Tab.R_AND_D, name: 'R&D', icon: Activity, desc: 'Research management, formulation development, and trials', color: 'violet' },
      ]
    },
    {
      category: 'Operations & Assets',
      items: [
        { id: Tab.LOGISTICS, name: 'Logistics', icon: Truck, desc: 'Transport management, route optimization, and e-Way bills', color: 'rose' },
        { id: Tab.ASSETS, name: 'Assets & Maint.', icon: Database, desc: 'Asset tracking, maintenance schedules, and depreciation', color: 'slate' },
        { id: Tab.DOCUMENTS, name: 'Documents (DMS)', icon: FileText, desc: 'Document management with version control and workflows', color: 'zinc' },
      ]
    },
    {
      category: 'Administration',
      items: [
        { id: Tab.EMPLOYEES, name: 'HR & Payroll', icon: Briefcase, desc: 'Employee management, attendance, and payroll processing', color: 'sky' },
        { id: Tab.REPORTS, name: 'Reports', icon: BarChart3, desc: 'Advanced analytics, custom reports, and Power BI integration', color: 'lime' },
        { id: Tab.COMPLIANCE, name: 'Compliance', icon: ShieldCheck, desc: 'Regulatory compliance, GST filing, and audit trails', color: 'fuchsia' },
        { id: Tab.AUDIT, name: 'Audit Logs', icon: Layers, desc: 'System activity tracking and security monitoring', color: 'stone' },
        { id: Tab.SETTINGS, name: 'Settings', icon: Settings, desc: 'System configuration, user management, and preferences', color: 'neutral' },
      ]
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!username || !password) {
        setError("Please enter both username and password");
        return;
    }
    setIsLoading(true);
    try {
      const result = await login(username, password);
      if (result.success) {
        setError('');
      } else if (!result.requiresTwoFactor) {
        setError(result.error || 'Invalid credentials. Try "admin" / "admin".');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Ensure backend is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!emailInput) {
      setError("Please enter your registered email");
      return;
    }
    setIsLoading(true);
    try {
      const response = await apiClient.post('/auth/forgot-password', { email: emailInput });
      setSuccessMsg(response.message || 'Instructions sent!');
      
      // Inject token immediately to facilitate flow in this workspace context automatically
      if (response.debug_token) {
        setTokenInput(response.debug_token);
      }
      
      // Switch mode after slight delay
      setTimeout(() => {
        setViewMode('reset');
        setSuccessMsg('');
      }, 2000);
    } catch (err: any) {
      setError(err.data?.message || err.message || 'Could not request reset. Check email.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!tokenInput || !newPassword) {
      setError("Reset token and new password are required");
      return;
    }
    setIsLoading(true);
    try {
      await apiClient.post('/auth/reset-password', { 
        token: tokenInput, 
        newPassword 
      });
      setSuccessMsg('Password updated successfully! Redirecting...');
      
      setTimeout(() => {
        setViewMode('login');
        setSuccessMsg('');
        setTokenInput('');
        setNewPassword('');
        setError('');
      }, 2500);
    } catch (err: any) {
      setError(err.data?.message || err.message || 'Password reset failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode || !twoFactorUserId) return;
    setIsLoading(true);
    setError('');
    try {
      const result = await verify2FA(verificationCode, twoFactorUserId);
      if (!result.success) {
        setError(result.error || 'Verification failed');
      }
    } catch (err: any) {
      setError(err.message || '2FA verification error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] w-full bg-[#F3F7F9] flex items-center justify-center p-2 md:p-6 lg:p-8 overflow-hidden relative">
      {/* Subtle background floating elements for depth */}
      <div className="absolute top-[-10%] left-[-5%] w-96 h-96 bg-blue-100/40 rounded-full blur-3xl pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] right-[-5%] w-96 h-96 bg-emerald-100/40 rounded-full blur-3xl pointer-events-none z-0"></div>

      {/* Main Container */}
      <div className="w-full max-w-6xl h-full max-h-[min(95vh,820px)] bg-white rounded-[1.5rem] md:rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(15,23,42,0.1)] overflow-hidden flex relative z-10 animate-fadeIn border border-white/50">
        
        {/* Left Section: Login Form */}
        <div className="w-full lg:w-[45%] h-full flex flex-col bg-white p-6 md:p-10 lg:p-12 overflow-y-auto overflow-x-hidden custom-scrollbar">
          
          {/* Brand Logo */}
          <div className="mb-6 md:mb-8 flex items-center gap-3 flex-shrink-0">
            <div className="p-1">
              <img src="/logo.png" alt="Metapharsic Logo" className="h-16 w-auto object-contain drop-shadow-sm" />
            </div>
            <div className="flex flex-col justify-center">
              <span className="font-black tracking-tighter text-xl text-[#0F172A] leading-none">Metapharsic</span>
              <span className="text-[9px] font-bold text-slate-400 tracking-widest uppercase mt-0.5">Lifesciences</span>
            </div>
          </div>

          {/* Centered Login Content */}
          <div className="flex-1 flex flex-col justify-center py-4 md:py-6 max-w-md mx-auto w-full flex-shrink-0">
            <h1 className="text-3xl md:text-4xl font-black text-[#0F172A] mb-1.5 tracking-tight">Welcome back!</h1>
            <p className="text-slate-500 text-sm md:text-base font-medium mb-6 md:mb-10">Access your unified enterprise gateway dashboard.</p>

            {!twoFactorRequired ? (
              <>
                {viewMode === 'login' && (
                  <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5 animate-fadeIn">
                    {error && (
                      <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-2xl text-center font-semibold animate-shake">
                        {error}
                      </div>
                    )}
                    {successMsg && (
                      <div className="p-3 text-sm text-green-700 bg-green-50 border border-green-100 rounded-2xl text-center font-semibold animate-pulse">
                        {successMsg}
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-[#475569] ml-1">Username</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#0F172A] transition-colors">
                          <User size={18} />
                        </div>
                        <input 
                          type="text" 
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="block w-full pl-12 pr-4 py-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl text-[#0F172A] font-semibold placeholder-slate-400 focus:bg-white focus:ring-4 focus:ring-[#0F172A]/5 focus:border-[#0F172A] outline-none transition-all duration-200"
                          placeholder="Enter your ID"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center ml-1 mr-1">
                        <label className="block text-sm font-bold text-[#475569]">Password</label>
                        <button type="button" onClick={() => setViewMode('forgot')} className="text-sm font-bold text-blue-600 hover:text-blue-700 hover:underline transition-all">Forgot Password?</button>
                      </div>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#0F172A] transition-colors">
                          <Lock size={18} />
                        </div>
                        <input 
                          type="password" 
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="block w-full pl-12 pr-4 py-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl text-[#0F172A] font-semibold placeholder-slate-400 focus:bg-white focus:ring-4 focus:ring-[#0F172A]/5 focus:border-[#0F172A] outline-none transition-all duration-200"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      disabled={isLoading}
                      className="w-full flex justify-center items-center gap-2 py-4 px-4 bg-[#0F172A] text-white rounded-full text-base font-bold shadow-lg shadow-slate-900/10 hover:bg-black hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-4 md:mt-6"
                    >
                      {isLoading ? (
                        <>
                          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Signing in...</span>
                        </>
                      ) : (
                        <>Sign in <ArrowRight size={18} /></>
                      )}
                    </button>
                  </form>
                )}

                {viewMode === 'forgot' && (
                  <form onSubmit={handleForgotPassword} className="space-y-4 md:space-y-5 animate-fadeIn">
                    <div className="mb-2 text-center bg-blue-50/50 border border-blue-100 rounded-2xl p-4">
                       <Mail className="mx-auto text-blue-600 mb-2" size={28} />
                       <h3 className="text-lg font-bold text-[#0F172A]">Password Recovery</h3>
                       <p className="text-xs font-medium text-slate-500 mt-1">We'll send recovery instructions to your inbox.</p>
                    </div>

                    {error && (
                      <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-2xl text-center font-semibold animate-shake">
                        {error}
                      </div>
                    )}
                    {successMsg && (
                      <div className="p-3 text-sm text-green-700 bg-green-50 border border-green-100 rounded-2xl text-center font-semibold">
                        {successMsg}
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-[#475569] ml-1">Email Address</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#0F172A] transition-colors">
                          <Mail size={18} />
                        </div>
                        <input 
                          type="email" 
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          className="block w-full pl-12 pr-4 py-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl text-[#0F172A] font-semibold placeholder-slate-400 focus:bg-white focus:ring-4 focus:ring-[#0F172A]/5 focus:border-[#0F172A] outline-none transition-all duration-200"
                          placeholder="Enter registered email"
                          required
                        />
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      disabled={isLoading}
                      className="w-full flex justify-center items-center gap-2 py-4 px-4 bg-[#0F172A] text-white rounded-full text-base font-bold shadow-lg hover:bg-black transition-all disabled:opacity-70"
                    >
                      {isLoading ? 'Processing...' : 'Send Reset Instructions'}
                    </button>

                    <button type="button" onClick={() => setViewMode('login')} className="w-full text-center text-sm font-bold text-slate-500 hover:text-[#0F172A] mt-2">
                      ← Back to Sign In
                    </button>
                  </form>
                )}

                {viewMode === 'reset' && (
                  <form onSubmit={handleResetPassword} className="space-y-4 md:space-y-5 animate-fadeIn">
                    <div className="mb-2 text-center bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4">
                       <KeyRound className="mx-auto text-emerald-600 mb-2" size={28} />
                       <h3 className="text-lg font-bold text-[#0F172A]">Set New Password</h3>
                       <p className="text-xs font-medium text-slate-500 mt-1">Enter the code sent to you and pick your new password.</p>
                    </div>

                    {error && (
                      <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-2xl text-center font-semibold animate-shake">
                        {error}
                      </div>
                    )}
                    {successMsg && (
                      <div className="p-3 text-sm text-green-700 bg-green-50 border border-green-100 rounded-2xl text-center font-semibold animate-pulse">
                        {successMsg}
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-[#475569] ml-1">Verification Token</label>
                      <div className="relative group">
                        <input 
                          type="text" 
                          value={tokenInput}
                          onChange={(e) => setTokenInput(e.target.value)}
                          className="block w-full px-4 py-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl text-[#0F172A] font-black tracking-widest text-center placeholder-slate-300 focus:bg-white focus:border-[#0F172A] outline-none transition-all"
                          placeholder="Enter Token"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-[#475569] ml-1">New Password</label>
                      <div className="relative group">
                         <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#0F172A] transition-colors">
                          <Lock size={18} />
                        </div>
                        <input 
                          type="password" 
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="block w-full pl-12 pr-4 py-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl text-[#0F172A] font-semibold placeholder-slate-400 focus:bg-white focus:border-[#0F172A] outline-none transition-all"
                          placeholder="New secure password"
                          required
                        />
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      disabled={isLoading}
                      className="w-full flex justify-center items-center gap-2 py-4 px-4 bg-emerald-600 text-white rounded-full text-base font-bold shadow-lg hover:bg-emerald-700 transition-all disabled:opacity-70"
                    >
                      {isLoading ? 'Updating...' : 'Reset My Password'}
                    </button>

                    <button type="button" onClick={() => setViewMode('login')} className="w-full text-center text-sm font-bold text-slate-500 hover:text-[#0F172A] mt-2">
                      Cancel & Go Back
                    </button>
                  </form>
                )}
              </>
            ) : (
              <form onSubmit={handleVerify2FA} className="space-y-6 animate-fadeIn">
                <div className="text-center mb-4">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-50 text-blue-600 mb-4 border border-blue-100">
                    <ShieldCheck size={28} />
                  </div>
                  <h3 className="text-xl font-black text-[#0F172A]">2FA Authentication</h3>
                  <p className="text-sm text-slate-500 mt-1">Input code sent to security channel.</p>
                </div>

                {error && (
                  <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl text-center font-semibold">
                    {error}
                  </div>
                )}

                <input 
                  type="text" 
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  className="block w-full px-4 py-5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl text-[#0F172A] text-center text-3xl font-black tracking-[0.4em] placeholder-slate-300 focus:bg-white focus:border-[#0F172A] outline-none shadow-sm transition-all"
                  placeholder="000000"
                  autoFocus
                />

                <div className="flex flex-col gap-3">
                  <button 
                    type="submit" 
                    disabled={isLoading || verificationCode.length < 6}
                    className="w-full flex justify-center py-4 px-4 bg-[#0F172A] text-white rounded-full text-base font-bold shadow-lg hover:bg-black transition-all disabled:opacity-50"
                  >
                    {isLoading ? 'Verifying...' : 'Verify Identity'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => window.location.reload()}
                    className="text-sm font-bold text-slate-400 hover:text-[#0F172A] transition-colors"
                  >
                    Cancel Verification
                  </button>
                </div>
              </form>
            )}

            {/* Quick Access Action Panel */}
            <div className="mt-8 md:mt-12 flex-shrink-0">
              <div className="flex items-center gap-4 mb-4 md:mb-6">
                <div className="h-[1px] flex-1 bg-[#F1F5F9]"></div>
                <span className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase whitespace-nowrap">Quick Access</span>
                <div className="h-[1px] flex-1 bg-[#F1F5F9]"></div>
              </div>
              
              <div className="flex justify-center gap-6">
                <div className="flex flex-col items-center gap-2">
                  <button 
                    onClick={() => { setUsername('admin'); setPassword('admin'); setViewMode('login'); }}
                    className="w-14 h-14 rounded-full border border-[#E2E8F0] bg-white flex items-center justify-center text-slate-500 hover:text-[#0F172A] hover:border-[#0F172A] hover:bg-[#F8FAFC] hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group relative"
                    title="Admin Portal"
                  >
                    <ShieldCheck size={22} className="group-hover:scale-110 transition-transform" />
                  </button>
                  <span className="text-[11px] font-bold text-slate-500 tracking-wide uppercase">Admin</span>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <button 
                    onClick={() => { setUsername('pharmacist'); setPassword('user'); setViewMode('login'); }}
                    className="w-14 h-14 rounded-full border border-[#E2E8F0] bg-white flex items-center justify-center text-slate-500 hover:text-[#0F172A] hover:border-[#0F172A] hover:bg-[#F8FAFC] hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group relative"
                    title="Pharmacist View"
                  >
                    <Activity size={22} className="group-hover:scale-110 transition-transform" />
                  </button>
                  <span className="text-[11px] font-bold text-slate-500 tracking-wide uppercase">Pharma</span>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <button 
                    onClick={() => { setUsername('cashier'); setPassword('user'); setViewMode('login'); }}
                    className="w-14 h-14 rounded-full border border-[#E2E8F0] bg-white flex items-center justify-center text-slate-500 hover:text-[#0F172A] hover:border-[#0F172A] hover:bg-[#F8FAFC] hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group relative"
                    title="Cashier Desk"
                  >
                    <CreditCard size={22} className="group-hover:scale-110 transition-transform" />
                  </button>
                  <span className="text-[11px] font-bold text-slate-500 tracking-wide uppercase">Cashier</span>
                </div>
              </div>
            </div>
          </div>

          {/* Links Footer */}
          <div className="mt-8 md:mt-auto flex items-center justify-center gap-4 pt-6 md:pt-8 border-t border-slate-100 text-[13px] font-bold flex-shrink-0">
            <span className="text-[#64748B] font-medium">Want to see more?</span>
            
            <button onClick={() => setShowDemo(true)} className="flex items-center gap-1.5 text-[#0F172A] hover:opacity-80 transition-opacity">
              <LayoutDashboard size={16} className="text-slate-400" /> Modules
            </button>

            <div className="w-[1px] h-4 bg-[#E2E8F0]"></div>

            <button onClick={launchDemo} className="flex items-center gap-1.5 text-[#0369A1] hover:opacity-80 transition-opacity">
              <Play size={14} className="fill-current" /> Launch Demo
            </button>
          </div>
        </div>

        {/* Right Section: The Dynamic Presentation Sidebar */}
        <div className="hidden lg:flex w-[55%] p-6 bg-white relative">
          <div className="w-full h-full bg-[#F2FAF7] rounded-[2rem] p-10 flex flex-col border border-[#E4F3ED] relative overflow-hidden shadow-inner group">
            
            {/* Pattern Dots Background mimicking screenshot */}
            <div className="absolute inset-0 opacity-[0.04] pointer-events-none" 
                 style={{ backgroundImage: 'radial-gradient(#059669 2px, transparent 2px)', backgroundSize: '24px 24px' }}>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-transparent to-white/40 pointer-events-none"></div>

            {/* Carousel Illustration Space */}
            <div className="relative z-10 flex-1 flex items-center justify-center mb-6">
              <div className="relative w-[85%] aspect-square bg-white/60 rounded-[2rem] shadow-[0_8px_30px_rgba(0,0,0,0.02)] border border-white/60 flex items-center justify-center p-8 transform transition-all duration-700 group-hover:scale-[1.01]">
                <img 
                  key={currentSlide} 
                  src={slides[currentSlide].image} 
                  alt={slides[currentSlide].title} 
                  className="w-full h-full object-contain mix-blend-multiply animate-fadeIn duration-500"
                />
              </div>
            </div>

            {/* Dynamic Descriptive Text Block locked dimension */}
            <div className="relative z-10 text-center px-8 pt-4 pb-6 min-h-[190px] flex flex-col justify-start flex-shrink-0">
              <h2 className="text-[2.2rem] font-black text-[#0F172A] leading-[1.1] tracking-tight mb-4 transition-all animate-fadeIn duration-700">
                {slides[currentSlide].title}
              </h2>
              <p className="text-[#64748B] text-base font-medium leading-relaxed max-w-md mx-auto animate-fadeIn duration-700" style={{animationDelay: '100ms'}}>
                {slides[currentSlide].description}
              </p>
            </div>
              
              {/* Interactive Slide Dots Indicators */}
              <div className="flex justify-center items-center gap-2 mt-4 flex-shrink-0">
                {slides.map((_, i) => (
                  <button 
                    key={i}
                    onClick={() => setCurrentSlide(i)}
                    className={`h-2 rounded-full transition-all duration-300 ${i === currentSlide ? 'w-8 bg-[#0F172A]' : 'w-2 bg-slate-300 hover:bg-slate-400'}`}
                  />
                ))}
              </div>
            </div>

            {/* Corner Decorative accent */}
            <div className="absolute bottom-8 left-8 z-20 text-emerald-600 opacity-20">
               <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21l18-18"/><path d="M21 11V3h-8"/></svg>
            </div>
          </div>
        </div>

      {/* Legacy System Info watermark */}
      <div className="fixed bottom-4 right-6 text-[10px] font-black text-slate-300 tracking-[0.3em] uppercase pointer-events-none z-0">
        Enterprise Ver 4.5 • Antigravity Framework
      </div>

      {/* Modules Explorer Demo Modal (Kept functional from project scope) */}
      {showDemo && (
        <div className="fixed inset-0 bg-[#0F172A]/60 backdrop-blur-md z-[999] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col scale-95 animate-scaleIn">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center p-8 border-b border-slate-100 bg-[#F8FAFC]">
              <div>
                <h2 className="text-3xl font-black text-[#0F172A] tracking-tight">Metapharsic ERP Modules</h2>
                <p className="text-slate-500 text-sm font-medium mt-1">Explore complete ecosystem mapping across all tiers.</p>
              </div>
              <button 
                onClick={() => setShowDemo(false)}
                className="p-3 rounded-full bg-white shadow-sm border border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-[#0F172A] transition-all active:scale-90"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Category Sidebar */}
              <div className="w-64 bg-[#F8FAFC] border-r border-slate-100 overflow-y-auto py-6 flex flex-col gap-1">
                {demoModules.map((module, index) => (
                  <button
                    key={module.category}
                    onClick={() => setActiveDemoTab(index)}
                    className={`text-left px-8 py-4 text-sm font-bold transition-all relative ${
                      activeDemoTab === index 
                        ? 'text-[#0F172A] bg-white shadow-[inset_4px_0_0_#0F172A]' 
                        : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {module.category}
                  </button>
                ))}
              </div>

              {/* Modules Grid */}
              <div className="flex-1 overflow-y-auto p-8 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {demoModules[activeDemoTab].items.map((item) => {
                    const IconComponent = item.icon;
                    const colorClasses: Record<string, string> = {
                      blue: 'text-blue-600 bg-blue-50',
                      green: 'text-emerald-600 bg-emerald-50',
                      purple: 'text-purple-600 bg-purple-50',
                      orange: 'text-orange-600 bg-orange-50',
                      cyan: 'text-cyan-600 bg-cyan-50',
                      indigo: 'text-indigo-600 bg-indigo-50',
                      pink: 'text-pink-600 bg-pink-50',
                      teal: 'text-teal-600 bg-teal-50',
                      amber: 'text-amber-600 bg-amber-50',
                      emerald: 'text-emerald-600 bg-emerald-50',
                      violet: 'text-violet-600 bg-violet-50',
                      rose: 'text-rose-600 bg-rose-50',
                      slate: 'text-slate-600 bg-slate-50',
                      zinc: 'text-zinc-600 bg-zinc-50',
                      sky: 'text-sky-600 bg-sky-50',
                      lime: 'text-lime-600 bg-lime-50',
                      fuchsia: 'text-fuchsia-600 bg-fuchsia-50',
                      stone: 'text-stone-600 bg-stone-50',
                      neutral: 'text-slate-600 bg-slate-50',
                    };
                    
                    return (
                      <div 
                        key={item.id}
                        onClick={() => {
                           setShowDemo(false);
                           launchDemo();
                        }}
                        className="p-5 rounded-2xl bg-white border border-slate-100 hover:border-[#0F172A] hover:shadow-xl hover:shadow-slate-200/40 hover:-translate-y-1 transition-all cursor-pointer group flex items-start gap-4"
                      >
                        <div className={`p-3 rounded-xl ${colorClasses[item.color] || 'bg-slate-100'} transition-transform group-hover:scale-110 duration-300`}>
                          <IconComponent size={24} strokeWidth={2.2} />
                        </div>
                        <div>
                          <h4 className="font-black text-base text-[#0F172A] mb-1 group-hover:text-blue-700 transition-colors">
                            {item.name}
                          </h4>
                          <p className="text-xs font-medium text-slate-500 leading-relaxed">
                            {item.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 px-8 border-t border-slate-100 bg-[#F8FAFC] flex justify-between items-center">
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-600">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                Total System Integration Enabled
              </div>
              <button 
                onClick={launchDemo}
                className="flex items-center gap-2 px-8 py-3.5 bg-[#0F172A] text-white rounded-full text-sm font-bold shadow-lg shadow-slate-900/10 hover:shadow-xl hover:bg-black hover:-translate-y-0.5 transition-all active:scale-95"
              >
                <Play size={16} className="fill-current" /> Launch System Demo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
