
import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, TrendingUp, AlertTriangle, AlertOctagon, CreditCard, ShoppingBag, Sparkles, Briefcase, UserCheck, CheckSquare, Flag, Plus, Trash2, Check, Settings, Grid, Filter, Eye, EyeOff, BarChart3, PieChart as PieChartIcon, Calendar, Users, Package, Truck, FileText, TrendingDown, Zap, X, Edit2, Pill, ShoppingCart, ClipboardList, Briefcase as BriefcaseIcon, Shield, MoreHorizontal, Search, RefreshCw } from 'lucide-react';
import { DASHBOARD_STATS, MOCK_SALES_DATA } from '../constants';
import { getAllEmployees, getEmployeePerformanceStats, initializeSampleData, getAllTasks } from '../services/databaseService';
import { generateSmartInsights } from '../services/geminiService';
import { useAuth } from '../context/AuthContext';
import { useAppStore } from '../store/useAppStore';
import { Tab, Task, MedicalRepresentative } from '../types';

const Dashboard: React.FC = () => {
  const [insightQuery, setInsightQuery] = useState('');
  const [insightResult, setInsightResult] = useState<string | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const { user, hasPermission } = useAuth();
  const { setActiveTab: onNavigate } = useAppStore();

  // Task State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [taskSaving, setTaskSaving] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [newTaskCategory, setNewTaskCategory] = useState<Task['category']>('General');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskFilter, setTaskFilter] = useState<'All' | Task['category']>('All');
  const [taskSearch, setTaskSearch] = useState('');
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);

  // Employee Stats State
  const [employeeFilter, setEmployeeFilter] = useState<'All' | 'Top Performers' | 'Active' | 'On Leave' | 'Attention Needed'>('All');
  const [selectedEmployee, setSelectedEmployee] = useState<MedicalRepresentative | null>(null);
  const [employees, setEmployees] = useState<MedicalRepresentative[]>([]);
  const [employeeStats, setEmployeeStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    starPerformers: 0,
    attentionNeeded: 0,
    averageAchievement: 0
  });
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  // Widget Configuration State
  const [showWidgetConfig, setShowWidgetConfig] = useState(false);
  const [visibleWidgets, setVisibleWidgets] = useState<Record<string, boolean>>(() => {
    // Load saved preferences from localStorage, or use defaults
    const saved = localStorage.getItem('dashboard-widgets');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn('Failed to parse saved widget preferences, using defaults');
      }
    }
    // Default configuration
    return {
      aiAssistant: true,
      salesStats: true,
      financialStats: true,
      inventoryAlerts: true,
      expiryAlerts: true,
      salesChart: true,
      paymentSummary: true,
      fieldForce: true,
      employeeStats: true,
      taskManager: true,
      quickActions: true,
      recentActivity: true,
      topProducts: true,
      compliance: true
    };
  });

  const showFinancials = hasPermission(['ADMIN', 'PHARMACIST']);
  const showAI = hasPermission(['ADMIN', 'PHARMACIST']);

  const handleAskAI = async () => {
    if (!insightQuery) return;
    setLoadingInsight(true);
    const result = await generateSmartInsights(insightQuery);
    setInsightResult(result);
    setLoadingInsight(false);
  };

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    const newTask: Task = {
      id: `t-${Date.now()}`,
      title: newTaskTitle,
      priority: newTaskPriority,
      completed: false,
      category: newTaskCategory,
      dueDate: newTaskDueDate || undefined,
      description: newTaskDescription || undefined
    };
    setTasks([newTask, ...tasks]);
    resetTaskForm();
    setShowAddTaskModal(false);
  };

  const handleUpdateTask = () => {
    if (!editingTask || !newTaskTitle.trim()) return;
    setTasks(tasks.map(t => t.id === editingTask.id ? {
      ...t,
      title: newTaskTitle,
      priority: newTaskPriority,
      category: newTaskCategory,
      dueDate: newTaskDueDate || undefined,
      description: newTaskDescription || undefined
    } : t));
    resetTaskForm();
    setEditingTask(null);
  };

  const resetTaskForm = () => {
    setNewTaskTitle('');
    setNewTaskPriority('Medium');
    setNewTaskCategory('General');
    setNewTaskDueDate('');
    setNewTaskDescription('');
  };

  const startEditTask = (task: Task) => {
    setEditingTask(task);
    setNewTaskTitle(task.title);
    setNewTaskPriority(task.priority);
    setNewTaskCategory(task.category);
    setNewTaskDueDate(task.dueDate || '');
    setNewTaskDescription(task.description || '');
    setShowAddTaskModal(true);
  };

  const toggleTask = (id: string) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesFilter = taskFilter === 'All' || task.category === taskFilter;
      const matchesSearch = task.title.toLowerCase().includes(taskSearch.toLowerCase()) ||
                           task.description?.toLowerCase().includes(taskSearch.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [tasks, taskFilter, taskSearch]);

  // Widget Configuration Functions
  const toggleWidget = (widgetId: string) => {
    setVisibleWidgets(prev => ({
      ...prev,
      [widgetId]: !prev[widgetId]
    }));
  };

  const toggleAllWidgets = (show: boolean) => {
    setVisibleWidgets(prev => {
      const newVisible = {...prev};
      Object.keys(newVisible).forEach(key => {
        newVisible[key] = show;
      });
      return newVisible;
    });
  };

  const resetWidgets = () => {
    const defaultWidgets = {
      aiAssistant: true,
      salesStats: true,
      financialStats: true,
      inventoryAlerts: true,
      expiryAlerts: true,
      salesChart: true,
      paymentSummary: true,
      fieldForce: true,
      employeeStats: true,
      taskManager: true,
      quickActions: true,
      recentActivity: true,
      topProducts: true,
      compliance: true
    };
    setVisibleWidgets(defaultWidgets);
    // Save to localStorage
    localStorage.setItem('dashboard-widgets', JSON.stringify(defaultWidgets));
  };

  // Save widget preferences to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('dashboard-widgets', JSON.stringify(visibleWidgets));
  }, [visibleWidgets]);

  // Load tasks from DB on mount
  useEffect(() => {
    const loadTasks = async () => {
      setLoadingTasks(true);
      try {
        const dbTasks = await getAllTasks();
        if (dbTasks && dbTasks.length > 0) setTasks(dbTasks);
      } catch (err) {
        console.warn('Could not load tasks from DB, starting empty:', err);
      } finally {
        setLoadingTasks(false);
      }
    };
    loadTasks();
  }, []);

  // Load employees from database
  useEffect(() => {
    const loadEmployees = async () => {
      setLoadingEmployees(true);
      try {
        // Initialize sample data if database is empty (await — it's async)
        await initializeSampleData();

        const [allEmployees, stats] = await Promise.all([
          getAllEmployees(),
          getEmployeePerformanceStats()
        ]);
        setEmployees(allEmployees);
        setEmployeeStats({
          totalEmployees: stats.totalEmployees,
          activeEmployees: stats.activeEmployees,
          starPerformers: stats.starPerformers,
          attentionNeeded: stats.attentionNeeded,
          averageAchievement: stats.averageAchievement
        });
      } catch (error) {
        console.error('Error loading employees:', error);
      } finally {
        setLoadingEmployees(false);
      }
    };
    loadEmployees();
  }, []);

  const getWidgetIcon = (widgetId: string) => {
    switch(widgetId) {
      case 'aiAssistant': return <Sparkles size={16} />;
      case 'salesStats': return <BarChart3 size={16} />;
      case 'financialStats': return <DollarSign size={16} />;
      case 'inventoryAlerts': return <Package size={16} />;
      case 'expiryAlerts': return <Calendar size={16} />;
      case 'salesChart': return <BarChart3 size={16} />;
      case 'paymentSummary': return <CreditCard size={16} />;
      case 'fieldForce': return <Users size={16} />;
      case 'employeeStats': return <UserCheck size={16} />;
      case 'taskManager': return <CheckSquare size={16} />;
      case 'quickActions': return <Zap size={16} />;
      case 'recentActivity': return <FileText size={16} />;
      case 'topProducts': return <TrendingUp size={16} />;
      case 'compliance': return <AlertTriangle size={16} />;
      default: return <Grid size={16} />;
    }
  };

  const getWidgetTitle = (widgetId: string) => {
    switch(widgetId) {
      case 'aiAssistant': return 'AI Assistant';
      case 'salesStats': return 'Sales Statistics';
      case 'financialStats': return 'Financial Overview';
      case 'inventoryAlerts': return 'Inventory Alerts';
      case 'expiryAlerts': return 'Expiry Alerts';
      case 'salesChart': return 'Sales Performance';
      case 'paymentSummary': return 'Payment Summary';
      case 'fieldForce': return 'Field Force';
      case 'employeeStats': return 'Employee Stats';
      case 'taskManager': return 'Task Manager';
      case 'quickActions': return 'Quick Actions';
      case 'recentActivity': return 'Recent Activity';
      case 'topProducts': return 'Top Products';
      case 'compliance': return 'Compliance';
      default: return 'Widget';
    }
  };

  const widgetConfigItems = [
    { id: 'aiAssistant', title: 'AI Assistant', description: 'Smart insights and analytics' },
    { id: 'salesStats', title: 'Sales Statistics', description: 'Today\'s sales and performance' },
    { id: 'financialStats', title: 'Financial Overview', description: 'Profit and financial metrics' },
    { id: 'inventoryAlerts', title: 'Inventory Alerts', description: 'Low stock warnings' },
    { id: 'expiryAlerts', title: 'Expiry Alerts', description: 'Expiring products' },
    { id: 'salesChart', title: 'Sales Performance', description: 'Monthly sales trends' },
    { id: 'paymentSummary', title: 'Payment Summary', description: 'Payment mode breakdown' },
    { id: 'fieldForce', title: 'Field Force', description: 'MR performance charts' },
    { id: 'employeeStats', title: 'Employee Stats', description: 'Team performance leaderboard' },
    { id: 'taskManager', title: 'Task Manager', description: 'Daily task tracking' },
    { id: 'quickActions', title: 'Quick Actions', description: 'Common actions shortcuts' },
    { id: 'recentActivity', title: 'Recent Activity', description: 'Latest system events' },
    { id: 'topProducts', title: 'Top Products', description: 'Best selling items' },
    { id: 'compliance', title: 'Compliance', description: 'Regulatory compliance status' }
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-700 border-red-200';
      case 'Medium': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Low': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Medical': return 'bg-rose-100 text-rose-700';
      case 'Sales': return 'bg-green-100 text-green-700';
      case 'Inventory': return 'bg-purple-100 text-purple-700';
      case 'Accounts': return 'bg-cyan-100 text-cyan-700';
      case 'HR': return 'bg-amber-100 text-amber-700';
      case 'Compliance': return 'bg-indigo-100 text-indigo-700';
      case 'General': return 'bg-slate-100 text-slate-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const isOverdue = (dueDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    return due < today;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Employee Stats Helper Functions
  const getFilteredEmployees = () => {
    let filtered = [...employees].sort((a, b) => b.targetAchievement - a.targetAchievement);
    
    switch (employeeFilter) {
      case 'Top Performers':
        return filtered.filter(m => m.targetAchievement >= 100);
      case 'Active':
        return filtered.filter(m => m.status === 'Active');
      case 'On Leave':
        return filtered.filter(m => m.status === 'On Leave');
      case 'Attention Needed':
        return filtered.filter(m => m.targetAchievement < 80);
      default:
        return filtered;
    }
  };

  const getRankIcon = (achievement: number) => {
    if (achievement >= 100) return '★';
    if (achievement >= 90) return '●';
    if (achievement >= 80) return '◐';
    if (achievement >= 60) return '○';
    return '!';
  };

  const StatCard = ({ title, value, subtext, icon, color, type = "normal", onClick }: any) => (
    <div 
      onClick={onClick}
      className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer hover:-translate-y-1"
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-slate-500 text-sm font-medium mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
          {subtext && <p className={`text-xs mt-2 font-medium ${type === 'danger' ? 'text-red-500' : 'text-green-500'}`}>{subtext}</p>}
        </div>
        <div className={`p-3 rounded-lg ${color} text-white`}>
          {icon}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Enhanced Dashboard Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg text-white">
              <BarChart3 size={24} />
            </div>
            Executive Dashboard
          </h2>
          <p className="text-slate-500 text-sm mt-1">Customize your view with the widgets that matter most</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-500 hidden sm:block">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
          
          <button
            onClick={() => setShowWidgetConfig(!showWidgetConfig)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${showWidgetConfig ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            <Settings size={18} />
            <span className="hidden sm:inline">Customize</span>
          </button>
        </div>
      </div>

      {/* Widget Configuration Panel */}
      {showWidgetConfig && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6 animate-fadeIn">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Grid size={20} className="text-blue-600" />
              Dashboard Widgets
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleAllWidgets(true)}
                className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
              >
                Show All
              </button>
              <button
                onClick={() => toggleAllWidgets(false)}
                className="text-xs px-3 py-1 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Hide All
              </button>
              <button
                onClick={resetWidgets}
                className="text-xs px-3 py-1 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors"
              >
                Reset
              </button>
              <button
                onClick={() => setShowWidgetConfig(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {widgetConfigItems.map((widget) => (
              <div 
                key={widget.id}
                className={`p-4 rounded-lg border-2 transition-all ${visibleWidgets[widget.id] ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${visibleWidgets[widget.id] ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                      {getWidgetIcon(widget.id)}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-800">{widget.title}</h4>
                      <p className="text-xs text-slate-500 mt-1">{widget.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleWidget(widget.id)}
                    className={`p-1.5 rounded-lg transition-colors ${visibleWidgets[widget.id] ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}
                  >
                    {visibleWidgets[widget.id] ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Assistant Section - Hidden for Cashiers and when widget disabled */}
      {showAI && visibleWidgets.aiAssistant && (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Sparkles size={100} className="text-indigo-600" />
          </div>
          <div className="relative z-10">
            <h3 className="text-lg font-semibold text-indigo-900 flex items-center gap-2">
              <Sparkles size={20} className="text-indigo-600" />
              Smart Assistant
            </h3>
            <p className="text-indigo-700 text-sm mb-4">Ask insights about your sales, stock, or expiry status.</p>
            <div className="flex gap-2 max-w-2xl">
              <input
                type="text"
                placeholder="e.g., Which medicines are expiring soon?"
                className="flex-1 border border-indigo-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-300 outline-none"
                value={insightQuery}
                onChange={(e) => setInsightQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
              />
              <button
                onClick={handleAskAI}
                disabled={loadingInsight}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-70"
              >
                {loadingInsight ? 'Analyzing...' : 'Ask AI'}
              </button>
            </div>
            {insightResult && (
              <div className="mt-4 bg-white/80 p-4 rounded-lg border border-indigo-100 text-indigo-900 text-sm leading-relaxed animate-fadeIn">
                <strong className="block mb-2">AI Insight:</strong>
                <div className="space-y-1">
                  {insightResult.split('\n').map((line, i) => {
                    if (!line.trim()) return null;
                    // Render list items
                    const isBullet = line.trimStart().startsWith('- ');
                    const text = isBullet ? line.replace(/^[\s-]+/, '') : line;
                    // Bold (**text**) → <strong>
                    const parts = text.split(/\*\*(.+?)\*\*/g).map((part, j) =>
                      j % 2 === 1 ? <strong key={j}>{part}</strong> : part
                    );
                    return isBullet
                      ? <div key={i} className="flex gap-2"><span className="text-indigo-400">•</span><span>{parts}</span></div>
                      : <div key={i}>{parts}</div>;
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats Grid - Only show if widgets are visible */}
      {(visibleWidgets.salesStats || visibleWidgets.financialStats || visibleWidgets.inventoryAlerts || visibleWidgets.expiryAlerts) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {visibleWidgets.salesStats && (
            <StatCard
              title="Today's Sales"
              value={`₹${DASHBOARD_STATS.todaySales.toLocaleString()}`}
              subtext="+12% from yesterday"
              icon={<DollarSign size={24} />}
              color="bg-primary"
              onClick={() => onNavigate(Tab.REPORTS)}
            />
          )}
          
          {/* Only Admin/Pharmacist can see profit */}
          {visibleWidgets.financialStats && showFinancials ? (
            <StatCard
              title="Today's Profit"
              value={`₹${DASHBOARD_STATS.todayProfit.toLocaleString()}`}
              subtext="22% Margin"
              icon={<TrendingUp size={24} />}
              color="bg-success"
              onClick={() => onNavigate(Tab.REPORTS)}
            />
          ) : visibleWidgets.financialStats && !showFinancials ? (
            <StatCard
              title="Transactions"
              value="42"
              subtext="Bills generated today"
              icon={<ShoppingBag size={24} />}
              color="bg-purple-500"
              onClick={() => onNavigate(Tab.POS)}
            />
          ) : null}

          {visibleWidgets.inventoryAlerts && (
            <StatCard
              title="Low Stock Alert"
              value={DASHBOARD_STATS.lowStockCount}
              subtext="Items below reorder level"
              icon={<AlertTriangle size={24} />}
              color="bg-warning"
              type="danger"
              onClick={() => onNavigate(Tab.INVENTORY_HUB)}
            />
          )}
          {visibleWidgets.expiryAlerts && (
            <StatCard
              title="Near Expiry"
              value={DASHBOARD_STATS.nearExpiryCount}
              subtext="Expiring in < 60 days"
              icon={<AlertOctagon size={24} />}
              color="bg-danger"
              type="danger"
              onClick={() => onNavigate(Tab.INVENTORY_HUB)}
            />
          )}
        </div>
      )}

      {(visibleWidgets.salesChart || visibleWidgets.paymentSummary) && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Chart */}
        {visibleWidgets.salesChart && (
          <div
            className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onNavigate(Tab.REPORTS)}
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-6 flex justify-between items-center">
               Monthly Sales Overview
               <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded">View Full Report</span>
            </h3>
            <div className="w-full">
              <ResponsiveContainer width="100%" height={320} debounce={50}>
                <AreaChart data={MOCK_SALES_DATA}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(value) => `₹${value/1000}k`} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Sales']}
                  />
                  <Area type="monotone" dataKey="sales" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Payment Summary */}
        {visibleWidgets.paymentSummary && (
          <div
            className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onNavigate(Tab.ACCOUNTS)}
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-6 flex justify-between items-center">
              Payment Mode Summary
              <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded">View Accounts</span>
            </h3>
            <div className="flex-1 flex flex-col justify-center space-y-6">
              {Object.entries(DASHBOARD_STATS.paymentSummary).map(([mode, amount]) => (
                <div key={mode} className="relative">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      {mode === 'Cash' && <DollarSign size={16} className="text-green-500" />}
                      {mode === 'UPI' && <ShoppingBag size={16} className="text-blue-500" />}
                      {mode === 'Card' && <CreditCard size={16} className="text-purple-500" />}
                      <span className="font-medium text-slate-700">{mode}</span>
                    </div>
                    <span className="font-bold text-slate-900">₹{amount.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        mode === 'Cash' ? 'bg-green-500' : mode === 'UPI' ? 'bg-blue-500' : 'bg-purple-500'
                      }`}
                      style={{ width: `${(amount / DASHBOARD_STATS.todaySales) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-6 border-t border-slate-100">
               <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Outstanding Credit</span>
                  <span className="text-red-500 font-bold">₹{DASHBOARD_STATS.outstandingCredit.toLocaleString()}</span>
               </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Region, Employee Stats & Task Manager */}
      {(visibleWidgets.fieldForce || visibleWidgets.employeeStats || visibleWidgets.taskManager) && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Field Force Chart - Spans 1 column */}
         {visibleWidgets.fieldForce && (
           <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm lg:col-span-1">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Briefcase size={20} className="text-primary"/>
                  Field Force Performance
              </h3>
              <div className="w-full">
                  <ResponsiveContainer width="100%" height={300} debounce={50}>
                      <BarChart data={employees} layout="vertical" margin={{top: 5, right: 30, left: 20, bottom: 5}}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9"/>
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#475569'}}/>
                          <Tooltip 
                              cursor={{fill: '#f8fafc'}}
                              contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                          />
                          <Legend wrapperStyle={{fontSize: '10px'}} />
                          <Bar dataKey="salesTarget" name="Target" fill="#e2e8f0" radius={[0, 4, 4, 0]} barSize={10} />
                          <Bar dataKey="totalSales" name="Achieved" fill="#0ea5e9" radius={[0, 4, 4, 0]} barSize={10} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
           </div>
         )}

         {/* Enhanced Employee Stats - Spans 1 column */}
         {visibleWidgets.employeeStats && (
           <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col lg:col-span-1">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <UserCheck size={20} className="text-primary"/>
                    Employee Performance Monitor
                </h3>
                <div className="flex items-center gap-2">
                    {loadingEmployees && (
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                            <div className="w-3 h-3 border-2 border-slate-300 border-t-primary rounded-full animate-spin"></div>
                            Loading...
                        </div>
                    )}
                    <button 
                        onClick={async () => {
                            setLoadingEmployees(true);
                            initializeSampleData();
                            const allEmployees = await getAllEmployees();
                            setEmployees(allEmployees);
                            const stats = await getEmployeePerformanceStats();
                            setEmployeeStats({
                                totalEmployees: stats.totalEmployees,
                                activeEmployees: stats.activeEmployees,
                                starPerformers: stats.starPerformers,
                                attentionNeeded: stats.attentionNeeded,
                                averageAchievement: stats.averageAchievement
                            });
                            setLoadingEmployees(false);
                        }}
                        className="p-1.5 text-slate-400 hover:text-primary transition-colors disabled:opacity-50"
                        title="Refresh Data"
                        disabled={loadingEmployees}
                    >
                        <RefreshCw size={14} />
                    </button>
                    <button onClick={() => onNavigate(Tab.EMPLOYEES)} className="text-xs font-medium text-primary hover:underline">View All</button>
                </div>
            </div>
            
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-2 p-3 border-b border-slate-100 bg-white">
                <div className="text-center p-2 bg-green-50 rounded-lg">
                    <p className="text-lg font-bold text-green-600">{employeeStats.starPerformers}</p>
                    <p className="text-[10px] text-green-700 font-medium">Star Performers</p>
                </div>
                <div className="text-center p-2 bg-blue-50 rounded-lg">
                    <p className="text-lg font-bold text-blue-600">{employeeStats.activeEmployees}</p>
                    <p className="text-[10px] text-blue-700 font-medium">Active Now</p>
                </div>
                <div className="text-center p-2 bg-orange-50 rounded-lg">
                    <p className="text-lg font-bold text-orange-600">{employeeStats.attentionNeeded}</p>
                    <p className="text-[10px] text-orange-700 font-medium">Need Attention</p>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-1 px-3 py-2 border-b border-slate-100 overflow-x-auto">
                {(['All', 'Top Performers', 'Active', 'On Leave', 'Attention Needed'] as const).map(filter => (
                    <button
                        key={filter}
                        onClick={() => setEmployeeFilter(filter)}
                        className={`px-2 py-1 text-[10px] font-medium rounded-full whitespace-nowrap transition-colors ${
                            employeeFilter === filter 
                                ? 'bg-primary text-white' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        {filter}
                    </button>
                ))}
            </div>
            
            {/* Employee List */}
            <div className="flex-1 overflow-auto">
                <table className="w-full text-left">
                    <thead className="bg-white text-[10px] font-bold text-slate-500 uppercase border-b border-slate-100">
                        <tr>
                            <th className="p-2 pl-3">Employee</th>
                            <th className="p-2 text-right">Sales</th>
                            <th className="p-2 text-center">Target</th>
                            <th className="p-2 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {employees.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-slate-400">
                                    <Users size={32} className="mx-auto mb-2 opacity-30"/>
                                    <p className="text-xs">No employees found</p>
                                    <button 
                                        onClick={() => {
                                            initializeSampleData();
                                            getAllEmployees().then(setEmployees);
                                            getEmployeePerformanceStats().then(stats => setEmployeeStats({
                                                totalEmployees: stats.totalEmployees,
                                                activeEmployees: stats.activeEmployees,
                                                starPerformers: stats.starPerformers,
                                                attentionNeeded: stats.attentionNeeded,
                                                averageAchievement: stats.averageAchievement
                                            }));
                                        }}
                                        className="mt-2 text-xs text-primary hover:underline"
                                    >
                                        Load Sample Data
                                    </button>
                                </td>
                            </tr>
                        ) : getFilteredEmployees().length === 0 ? (
                            <tr>
                                <td colSpan={4} className="p-4 text-center text-xs text-slate-400">
                                    No employees match the selected filter
                                </td>
                            </tr>
                        ) : (
                            getFilteredEmployees().map((mr, idx) => (
                            <tr key={mr.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setSelectedEmployee(mr)}>
                                <td className="p-2 pl-3">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                                            mr.targetAchievement >= 100 ? 'bg-yellow-100 text-yellow-700' : 
                                            mr.targetAchievement >= 80 ? 'bg-green-100 text-green-700' :
                                            mr.targetAchievement >= 60 ? 'bg-blue-100 text-blue-700' :
                                            'bg-red-100 text-red-700'
                                        }`}>
                                            {getRankIcon(mr.targetAchievement)}
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-slate-800">{mr.name}</p>
                                            <p className="text-[9px] text-slate-400">{mr.assignedArea}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-2 text-right">
                                    <p className="text-xs font-semibold text-slate-700">₹{(mr.totalSales / 100000).toFixed(1)}L</p>
                                    <p className="text-[9px] text-slate-400">of ₹{(mr.salesTarget / 100000).toFixed(1)}L</p>
                                </td>
                                <td className="p-2 text-center">
                                    <div className="flex flex-col items-center">
                                        <div className="w-10 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full ${
                                                    mr.targetAchievement >= 100 ? 'bg-green-500' : 
                                                    mr.targetAchievement >= 80 ? 'bg-blue-500' :
                                                    mr.targetAchievement >= 60 ? 'bg-orange-500' : 'bg-red-500'
                                                }`}
                                                style={{ width: `${Math.min(mr.targetAchievement, 100)}%` }}
                                            />
                                        </div>
                                        <span className={`text-[9px] font-bold mt-0.5 ${
                                            mr.targetAchievement >= 100 ? 'text-green-600' : 
                                            mr.targetAchievement >= 80 ? 'text-blue-600' :
                                            mr.targetAchievement >= 60 ? 'text-orange-600' : 'text-red-600'
                                        }`}>
                                            {mr.targetAchievement}%
                                        </span>
                                    </div>
                                </td>
                                <td className="p-2 text-center">
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                                        mr.status === 'Active' ? 'bg-green-100 text-green-700' : 
                                        mr.status === 'On Leave' ? 'bg-amber-100 text-amber-700' :
                                        'bg-slate-100 text-slate-600'
                                    }`}>
                                        {mr.status}
                                    </span>
                                </td>
                            </tr>
                        )))}
                    </tbody>
                </table>
            </div>
            
            {/* Footer Summary */}
            <div className="px-3 py-2 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-500 flex justify-between">
                <span>Total: {employeeStats.totalEmployees} Employees</span>
                <span>Avg: {employeeStats.averageAchievement}% Target</span>
            </div>
            </div>
            )}

            {/* Task Manager - Spans 1 column */}
            {visibleWidgets.taskManager && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm flex flex-col lg:col-span-1 h-full max-h-[450px]">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <CheckSquare size={20} className="text-primary"/>
                    My Daily Tasks
                </h3>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium bg-white px-2 py-1 rounded border text-slate-500">{tasks.filter(t => !t.completed).length} Pending</span>
                    <button 
                        onClick={() => setShowAddTaskModal(true)}
                        className="p-1.5 bg-primary hover:bg-sky-600 text-white rounded-lg transition-colors"
                        title="Add New Task"
                    >
                        <Plus size={16} />
                    </button>
                </div>
            </div>

            {/* Category Filter */}
            <div className="px-3 py-2 border-b border-slate-100 bg-white">
                <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                    {(['All', 'Medical', 'Sales', 'Inventory', 'Accounts', 'HR', 'Compliance', 'General'] as const).map(cat => (
                        <button
                            key={cat}
                            onClick={() => setTaskFilter(cat)}
                            className={`px-2 py-1 text-[10px] font-medium rounded-full whitespace-nowrap transition-colors ${
                                taskFilter === cat 
                                    ? 'bg-primary text-white' 
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Search */}
            <div className="px-3 py-2 border-b border-slate-100">
                <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search tasks..."
                        value={taskSearch}
                        onChange={(e) => setTaskSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary outline-none"
                    />
                </div>
            </div>

            {/* Task List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {filteredTasks.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                        <CheckSquare size={32} className="mx-auto mb-2 opacity-30"/>
                        <p className="text-xs">{taskSearch || taskFilter !== 'All' ? 'No matching tasks' : 'No tasks yet. Add one!'}</p>
                    </div>
                ) : (
                    filteredTasks.map(task => (
                        <div key={task.id} className={`p-2.5 rounded-lg border transition-all group ${task.completed ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-200 hover:border-primary/50 hover:shadow-sm'}`}>
                            <div className="flex items-start gap-2">
                                <button 
                                    onClick={() => toggleTask(task.id)}
                                    className={`flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors mt-0.5 ${task.completed ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 hover:border-primary'}`}
                                >
                                    {task.completed && <Check size={12} strokeWidth={3} />}
                                </button>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium truncate ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                        {task.title}
                                    </p>
                                    {task.description && (
                                        <p className={`text-[10px] truncate mt-0.5 ${task.completed ? 'text-slate-300' : 'text-slate-500'}`}>
                                            {task.description}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${getCategoryColor(task.category)}`}>
                                            {task.category}
                                        </span>
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getPriorityColor(task.priority)}`}>
                                            {task.priority}
                                        </span>
                                        {task.dueDate && (
                                            <span className={`text-[9px] flex items-center gap-0.5 ${isOverdue(task.dueDate) && !task.completed ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                                                <Calendar size={9} />
                                                {formatDate(task.dueDate)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => startEditTask(task)}
                                        className="text-slate-300 hover:text-blue-500 p-0.5"
                                        title="Edit"
                                    >
                                        <Edit2 size={12} />
                                    </button>
                                    <button 
                                        onClick={() => deleteTask(task.id)}
                                        className="text-slate-300 hover:text-red-500 p-0.5"
                                        title="Delete"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Task Summary */}
            <div className="px-3 py-2 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-500 flex justify-between items-center rounded-b-xl">
                <span>{filteredTasks.filter(t => t.completed).length}/{filteredTasks.length} completed</span>
                <span>{tasks.filter(t => !t.completed && t.dueDate && isOverdue(t.dueDate)).length} overdue</span>
            </div>
            </div>
            )}

      </div>
      )}

         {/* Add/Edit Task Modal */}
         {showAddTaskModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800">
                            {editingTask ? 'Edit Task' : 'Add New Task'}
                        </h3>
                        <button 
                            onClick={() => {
                                setShowAddTaskModal(false);
                                setEditingTask(null);
                                resetTaskForm();
                            }}
                            className="text-slate-400 hover:text-slate-600"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    <div className="p-4 space-y-4">
                        <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">Task Title *</label>
                            <input
                                type="text"
                                placeholder="Enter task title..."
                                value={newTaskTitle}
                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">Description</label>
                            <textarea
                                placeholder="Add details about this task..."
                                value={newTaskDescription}
                                onChange={(e) => setNewTaskDescription(e.target.value)}
                                rows={2}
                                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Category</label>
                                <select
                                    value={newTaskCategory}
                                    onChange={(e) => setNewTaskCategory(e.target.value as Task['category'])}
                                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
                                >
                                    <option value="General">General</option>
                                    <option value="Medical">Medical</option>
                                    <option value="Sales">Sales</option>
                                    <option value="Inventory">Inventory</option>
                                    <option value="Accounts">Accounts</option>
                                    <option value="HR">HR</option>
                                    <option value="Compliance">Compliance</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Priority</label>
                                <select
                                    value={newTaskPriority}
                                    onChange={(e) => setNewTaskPriority(e.target.value as 'High' | 'Medium' | 'Low')}
                                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
                                >
                                    <option value="High">High</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Low">Low</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">Due Date</label>
                            <input
                                type="date"
                                value={newTaskDueDate}
                                onChange={(e) => setNewTaskDueDate(e.target.value)}
                                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                            />
                        </div>
                    </div>
                    <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-2">
                        <button
                            onClick={() => {
                                setShowAddTaskModal(false);
                                setEditingTask(null);
                                resetTaskForm();
                            }}
                            className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={editingTask ? handleUpdateTask : handleAddTask}
                            disabled={!newTaskTitle.trim()}
                            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                        >
                            {editingTask ? 'Update Task' : 'Add Task'}
                        </button>
                    </div>
                </div>
            </div>
         )}
    </div>
  );
};

export default Dashboard;
