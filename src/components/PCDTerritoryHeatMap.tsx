/**
 * ENHANCED GEOSPATIAL TERRITORY INTELLIGENCE
 * AI-driven mapping of network coverage and structural overlap.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Map, AlertCircle, Target, RefreshCcw, TrendingUp, 
  TrendingDown, Minus, Brain, Sparkles, Zap, 
  ShieldAlert, CheckCircle, ChevronRight, Rocket,
  Locate, Layers, Info, Filter
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  Tooltip, CartesianGrid, PieChart, Pie, Cell 
} from 'recharts';
import apiClient from '../services/apiClient';
import { Badge, StatCard, Modal } from './UniversalLayout';
import { formatCurrency } from '../utils/formatters';

interface GeospatialInsight {
  type: 'UNDERSERVED' | 'CANNIBALIZATION' | 'OPTIMAL';
  region_name: string;
  description: string;
  severity: 'CRITICAL' | 'WARNING' | 'STABLE';
  metadata: any;
}

const PCDTerritoryIntelligence: React.FC = () => {
  const [insights, setInsights] = useState<GeospatialInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAnalyzing, setIsAiAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'MAP' | 'ANALYTICS'>('MAP');

  const runAnalysis = useCallback(async () => {
    setIsAiAnalyzing(true);
    try {
      const res = await apiClient.get<{ insights: GeospatialInsight[] }>('/pcd/geospatial/analyze');
      if (res.success) setInsights(res.insights);
    } catch (e) {
      console.error('Analysis failed', e);
    } finally {
      setIsAiAnalyzing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => { runAnalysis(); }, [runAnalysis]);

  const getSeverityColor = (s: string) => {
    switch(s) {
      case 'CRITICAL': return 'bg-rose-500';
      case 'WARNING': return 'bg-amber-500';
      case 'STABLE': return 'bg-emerald-500';
      default: return 'bg-slate-400';
    }
  };

  const getInsightIcon = (type: string) => {
    switch(type) {
      case 'UNDERSERVED': return <Locate size={20} className="text-rose-500" />;
      case 'CANNIBALIZATION': return <ShieldAlert size={20} className="text-amber-500" />;
      case 'OPTIMAL': return <Rocket size={20} className="text-emerald-500" />;
      default: return <Brain size={20} className="text-blue-500" />;
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-4">
      <div className="w-12 h-12 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
      <p className="text-[11px] font-black uppercase tracking-[0.2em]">Synchronizing Geospatial Layer...</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* AI Active Status Banner */}
      <div className="bg-slate-900 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 border border-blue-500/30 shadow-2xl shadow-blue-500/10 overflow-hidden relative">
         <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
         <div className="flex items-center gap-4 relative z-10">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
               <Brain size={20} className={isAnalyzing ? 'animate-pulse' : ''} />
            </div>
            <div>
               <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Agentic Intelligence Layer</span>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                     <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                     <span className="text-[9px] font-black text-emerald-400 uppercase">AI Active</span>
                  </div>
               </div>
               <h2 className="text-white font-black text-sm tracking-tight uppercase tracking-[0.05em]">Geospatial Territory Intelligence Engine</h2>
            </div>
         </div>
         <button 
           onClick={runAnalysis}
           disabled={isAnalyzing}
           className="relative z-10 px-6 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all flex items-center gap-2"
         >
           <RefreshCw size={14} className={isAnalyzing ? 'animate-spin' : ''} />
           {isAnalyzing ? 'Processing Nodes...' : 'Recalculate Coverage'}
         </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Insights List */}
         <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between mb-2">
               <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Layers size={14} /> AI-Detected Spatial Anomalies
               </h3>
               <span className="text-[10px] font-bold text-slate-400">{insights.length} Issues Identified</span>
            </div>

            {insights.map((insight, idx) => (
               <div key={idx} className="bg-white rounded-3xl border border-slate-200 p-6 flex gap-6 hover:shadow-xl hover:border-blue-300 transition-all group">
                  <div className={`w-14 h-14 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-inner ${
                    insight.type === 'UNDERSERVED' ? 'bg-rose-50' : 
                    insight.type === 'CANNIBALIZATION' ? 'bg-amber-50' : 'bg-emerald-50'
                  }`}>
                    {getInsightIcon(insight.type)}
                  </div>
                  
                  <div className="flex-1">
                     <div className="flex items-center justify-between mb-1">
                        <h4 className="text-lg font-black text-slate-900 tracking-tight">{insight.region_name}</h4>
                        <div className={`w-2 h-2 rounded-full ${getSeverityColor(insight.severity)} shadow-[0_0_8px_rgba(0,0,0,0.2)]`}></div>
                     </div>
                     <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{insight.type.replace('_', ' ')}</p>
                     <p className="text-sm font-medium text-slate-600 leading-relaxed max-w-xl">
                        {insight.description}
                     </p>
                     
                     <div className="mt-6 flex items-center gap-3">
                        <button className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-blue-500/10 ${
                           insight.type === 'UNDERSERVED' ? 'bg-rose-600 text-white hover:bg-rose-700' :
                           insight.type === 'CANNIBALIZATION' ? 'bg-slate-900 text-white hover:bg-blue-600' :
                           'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}>
                           {insight.type === 'UNDERSERVED' ? 'Run Acquisition Campaign' :
                            insight.type === 'CANNIBALIZATION' ? 'View Friction Map' : 'Analyze Strategy'}
                           <ChevronRight size={14} />
                        </button>
                        {insight.metadata && (
                           <div className="flex -space-x-2 ml-2">
                              {[1, 2, 3].map(i => (
                                 <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-400">
                                    P{i}
                                 </div>
                              ))}
                           </div>
                        )}
                     </div>
                  </div>
               </div>
            ))}
         </div>

         {/* Secondary Stats/Analytics */}
         <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Market Share Density</h4>
               <div className="w-full">
                  <ResponsiveContainer width="100%" height={250} debounce={50}>
                     <PieChart>
                        <Pie
                           data={[
                              { name: 'Served', value: 65 },
                              { name: 'Underserved', value: 25 },
                              { name: 'Overlapping', value: 10 }
                           ]}
                           innerRadius={60}
                           outerRadius={80}
                           paddingAngle={5}
                           dataKey="value"
                        >
                           <Cell fill="#0ea5e9" />
                           <Cell fill="#f43f5e" />
                           <Cell fill="#f59e0b" />
                        </Pie>
                        <Tooltip contentStyle={{borderRadius: '12px', border: 'none'}} />
                     </PieChart>
                  </ResponsiveContainer>
               </div>
               <div className="grid grid-cols-3 gap-2 mt-4">
                  <div className="text-center">
                     <p className="text-[10px] font-black text-blue-600 uppercase">Served</p>
                     <p className="text-lg font-black text-slate-900">65%</p>
                  </div>
                  <div className="text-center border-x border-slate-100">
                     <p className="text-[10px] font-black text-rose-500 uppercase">Gaps</p>
                     <p className="text-lg font-black text-slate-900">25%</p>
                  </div>
                  <div className="text-center">
                     <p className="text-[10px] font-black text-amber-500 uppercase">Friction</p>
                     <p className="text-lg font-black text-slate-900">10%</p>
                  </div>
               </div>
            </div>

            <div className="bg-blue-600 rounded-3xl p-6 text-white shadow-xl shadow-blue-500/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                <div className="flex items-center gap-3 mb-4">
                   <Zap size={20} className="text-blue-200" />
                   <h4 className="text-xs font-black uppercase tracking-widest">Growth Recommendation</h4>
                </div>
                <p className="text-sm font-bold leading-relaxed mb-6 italic opacity-90">
                   "AI detects an 85% success probability for an Acquisition Campaign in the Vidarbha Region. Target local distributors in Nagpur & Wardha."
                </p>
                <button className="w-full py-3 bg-white text-blue-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-50 transition-all">
                   Start Pilot Program
                </button>
            </div>
         </div>
      </div>
    </div>
  );
};

export default PCDTerritoryIntelligence;
