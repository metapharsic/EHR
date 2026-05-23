"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { 
  TrendingUp, ChevronLeft, Calendar, Activity, AlertCircle,
  Shield, Heart, Brain, Wind, ChevronRight, Target, Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, ReferenceLine 
} from "recharts";

interface TimelineEvent {
  month: string;
  riskScore: number;
  confidence: number;
  interventions: string[];
  alerts: string[];
}

const TIMELINE_DATA: TimelineEvent[] = [
  { month: "Jan", riskScore: 25, confidence: 85, interventions: ["Lifestyle counseling"], alerts: [] },
  { month: "Feb", riskScore: 28, confidence: 83, interventions: ["Diet plan"], alerts: [] },
  { month: "Mar", riskScore: 32, confidence: 80, interventions: ["Exercise program"], alerts: ["BP trending up"] },
  { month: "Apr", riskScore: 35, confidence: 78, interventions: ["Medication review"], alerts: [] },
  { month: "May", riskScore: 38, confidence: 75, interventions: ["Cardiology referral"], alerts: ["High risk detected"] },
  { month: "Jun", riskScore: 42, confidence: 72, interventions: ["Intensive monitoring"], alerts: ["Intervention required"] },
  { month: "Jul", riskScore: 45, confidence: 70, interventions: ["Treatment adjustment"], alerts: ["Critical threshold"] },
  { month: "Aug", riskScore: 48, confidence: 68, interventions: ["Specialist consult"], alerts: ["Urgent action"] },
  { month: "Sep", riskScore: 52, confidence: 65, interventions: ["Aggressive therapy"], alerts: ["High priority"] },
  { month: "Oct", riskScore: 55, confidence: 62, interventions: ["Hospitalization risk"], alerts: ["Emergency protocol"] },
  { month: "Nov", riskScore: 58, confidence: 60, interventions: ["Preventive care"], alerts: ["Max risk level"] },
  { month: "Dec", riskScore: 62, confidence: 58, interventions: ["Critical intervention"], alerts: ["Immediate action"] },
];

const HEALTH_METRICS = [
  { name: "Cardiovascular", current: 87, predicted: 72, icon: Heart, color: "rose" },
  { name: "Neurological", current: 94, predicted: 88, icon: Brain, color: "violet" },
  { name: "Respiratory", current: 91, predicted: 85, icon: Wind, color: "cyan" },
  { name: "Overall", current: 89, predicted: 78, icon: Activity, color: "emerald" },
];

export default function PredictiveTimelinePage() {
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [showInterventions, setShowInterventions] = useState(true);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <button className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Predictive Health Timeline</h1>
            <p className="text-sm text-slate-500">12-Month AI Health Forecasting</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Chart */}
          <div className="lg:col-span-2 space-y-6">
            {/* Risk Timeline Chart */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Risk Trajectory</h3>
                  <p className="text-sm text-slate-500">AI-predicted health risk over 12 months</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowInterventions(!showInterventions)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                      showInterventions ? "bg-cyan-100 text-cyan-700" : "bg-slate-100 text-slate-600"
                    )}
                  >
                    Show Interventions
                  </button>
                </div>
              </div>

              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={TIMELINE_DATA}>
                    <defs>
                      <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "white", 
                        border: "1px solid #e2e8f0",
                        borderRadius: "12px",
                        padding: "12px"
                      }}
                    />
                    <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="5 5" label="Risk Threshold" />
                    <ReferenceLine y={75} stroke="#f43f5e" strokeDasharray="5 5" label="Critical" />
                    <Area 
                      type="monotone" 
                      dataKey="riskScore" 
                      stroke="#f43f5e" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#riskGradient)" 
                    />
                    {showInterventions && (
                      <Line 
                        type="monotone" 
                        dataKey="confidence" 
                        stroke="#06b6d4" 
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="flex gap-6 mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500" />
                  <span className="text-xs text-slate-600">Risk Score</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-cyan-500" />
                  <span className="text-xs text-slate-600">AI Confidence</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-xs text-slate-600">Risk Threshold</span>
                </div>
              </div>
            </div>

            {/* Monthly Breakdown */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Monthly Forecast</h3>
              <div className="grid grid-cols-6 gap-3">
                {TIMELINE_DATA.map((data, index) => (
                  <motion.button
                    key={data.month}
                    onClick={() => setSelectedMonth(index)}
                    className={cn(
                      "p-3 rounded-xl text-center transition-all",
                      selectedMonth === index 
                        ? "bg-cyan-50 border-2 border-cyan-400" 
                        : "bg-slate-50 hover:bg-slate-100 border-2 border-transparent"
                    )}
                    whileHover={{ scale: 1.05 }}
                  >
                    <p className="text-xs text-slate-500 mb-1">{data.month}</p>
                    <p className={cn(
                      "text-lg font-bold",
                      data.riskScore > 50 ? "text-rose-600" : 
                      data.riskScore > 30 ? "text-amber-600" : "text-emerald-600"
                    )}>
                      {data.riskScore}%
                    </p>
                    {data.alerts.length > 0 && (
                      <AlertCircle className="w-4 h-4 text-amber-500 mx-auto mt-1" />
                    )}
                  </motion.button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel */}
          <div className="space-y-6">
            {/* Health Metrics Comparison */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Predicted Changes</h3>
              <div className="space-y-4">
                {HEALTH_METRICS.map((metric) => {
                  const Icon = metric.icon;
                  const change = metric.predicted - metric.current;
                  return (
                    <div key={metric.name} className="p-4 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", `bg-${metric.color}-100`)}>
                          <Icon className={cn("w-5 h-5", `text-${metric.color}-500`)} />
                        </div>
                        <span className="font-medium text-slate-900">{metric.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <p className="text-xs text-slate-400">Current</p>
                          <p className="text-lg font-bold text-slate-700">{metric.current}%</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                        <div className="flex-1">
                          <p className="text-xs text-slate-400">Predicted</p>
                          <p className={cn(
                            "text-lg font-bold",
                            change < 0 ? "text-rose-600" : "text-emerald-600"
                          )}>
                            {metric.predicted}%
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className={cn("h-full rounded-full", `bg-${metric.color}-500`)}
                          style={{ width: `${metric.predicted}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Month Details */}
            {selectedMonth !== null && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200"
              >
                <h3 className="text-lg font-bold text-slate-900 mb-4">
                  {TIMELINE_DATA[selectedMonth].month} Forecast
                </h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <span className="text-sm text-slate-600">Risk Score</span>
                    <span className={cn(
                      "text-lg font-bold",
                      TIMELINE_DATA[selectedMonth].riskScore > 50 ? "text-rose-600" : "text-slate-900"
                    )}>
                      {TIMELINE_DATA[selectedMonth].riskScore}%
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <span className="text-sm text-slate-600">AI Confidence</span>
                    <span className="text-lg font-bold text-cyan-600">
                      {TIMELINE_DATA[selectedMonth].confidence}%
                    </span>
                  </div>

                  {TIMELINE_DATA[selectedMonth].interventions.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-slate-700 mb-2">Recommended Interventions</p>
                      {TIMELINE_DATA[selectedMonth].interventions.map((intervention, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg mb-1">
                          <Shield className="w-4 h-4 text-emerald-500" />
                          <span className="text-sm text-emerald-700">{intervention}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {TIMELINE_DATA[selectedMonth].alerts.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-slate-700 mb-2">Alerts</p>
                      {TIMELINE_DATA[selectedMonth].alerts.map((alert, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg mb-1">
                          <AlertCircle className="w-4 h-4 text-amber-500" />
                          <span className="text-sm text-amber-700">{alert}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* AI Insights */}
            <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-6 text-white">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5" />
                <h3 className="font-bold">AI Insights</h3>
              </div>
              <p className="text-sm text-violet-100 mb-4">
                Based on current trajectory, patient shows increasing cardiovascular risk. 
                Early intervention recommended within next 3 months.
              </p>
              <button className="w-full py-2 bg-white/20 rounded-xl text-sm font-medium hover:bg-white/30 transition-colors">
                View Full Report
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
