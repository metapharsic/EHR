"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Sparkles, ChevronLeft, Users, Brain, Target, Activity,
  Network, Share2, MessageSquare, ThumbsUp, AlertCircle,
  Zap, Clock, BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface SwarmInsight {
  id: string;
  type: "diagnosis" | "treatment" | "risk" | "pattern";
  confidence: number;
  description: string;
  contributors: number;
  votes: number;
  timestamp: string;
}

interface ClusterData {
  id: string;
  name: string;
  patientCount: number;
  commonSymptoms: string[];
  avgAge: number;
  riskLevel: "low" | "medium" | "high";
  aiConsensus: number;
}

const SWARM_INSIGHTS: SwarmInsight[] = [
  { id: "i1", type: "diagnosis", confidence: 94, description: "Pattern suggests early-stage autoimmune condition", contributors: 12, votes: 89, timestamp: "2 min ago" },
  { id: "i2", type: "treatment", confidence: 87, description: "Consider combination therapy for resistant hypertension", contributors: 8, votes: 76, timestamp: "5 min ago" },
  { id: "i3", type: "risk", confidence: 91, description: "High readmission risk within 30 days", contributors: 15, votes: 92, timestamp: "8 min ago" },
  { id: "i4", type: "pattern", confidence: 82, description: "Seasonal allergy correlation with respiratory symptoms", contributors: 6, votes: 68, timestamp: "12 min ago" },
];

const CLUSTERS: ClusterData[] = [
  { id: "c1", name: "Type 2 Diabetes Cluster A", patientCount: 234, commonSymptoms: ["Hyperglycemia", "Fatigue", "Polyuria"], avgAge: 58, riskLevel: "high", aiConsensus: 89 },
  { id: "c2", name: "Hypertension Group B", patientCount: 189, commonSymptoms: ["Elevated BP", "Headache", "Dizziness"], avgAge: 62, riskLevel: "medium", aiConsensus: 85 },
  { id: "c3", name: "Respiratory Pattern C", patientCount: 156, commonSymptoms: ["Cough", "SOB", "Wheezing"], avgAge: 45, riskLevel: "medium", aiConsensus: 78 },
  { id: "c4", name: "Cardiac Risk Cluster D", patientCount: 98, commonSymptoms: ["Chest Pain", "Palpitations", "Fatigue"], avgAge: 67, riskLevel: "high", aiConsensus: 92 },
];

export default function SwarmIntelligencePage() {
  const [activeTab, setActiveTab] = useState("insights");
  const [selectedCluster, setSelectedCluster] = useState<ClusterData | null>(null);

  const getTypeColor = (type: string) => {
    switch (type) {
      case "diagnosis": return "bg-violet-100 text-violet-700";
      case "treatment": return "bg-emerald-100 text-emerald-700";
      case "risk": return "bg-rose-100 text-rose-700";
      default: return "bg-amber-100 text-amber-700";
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "high": return "bg-rose-100 text-rose-700";
      case "medium": return "bg-amber-100 text-amber-700";
      default: return "bg-emerald-100 text-emerald-700";
    }
  };

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
            <h1 className="text-2xl font-bold text-slate-900">Swarm Intelligence</h1>
            <p className="text-sm text-slate-500">Multi-Factor Diagnosis Clustering</p>
          </div>
          <span className="ml-auto px-3 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
            Beta Feature
          </span>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          {[
            { label: "Active Clusters", value: "34", icon: Network, color: "cyan" },
            { label: "AI Contributors", value: "156", icon: Brain, color: "violet" },
            { label: "Insights Today", value: "89", icon: Sparkles, color: "amber" },
            { label: "Consensus Rate", value: "87%", icon: Target, color: "emerald" },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", `bg-${stat.color}-50`)}>
                    <Icon className={cn("w-5 h-5", `text-${stat.color}-500`)} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                <p className="text-xs text-slate-500">{stat.label}</p>
              </div>
            );
          })}
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8">
          {[
            { id: "insights", label: "AI Insights", icon: Sparkles },
            { id: "clusters", label: "Diagnosis Clusters", icon: Network },
            { id: "collaboration", label: "Collaboration", icon: Users },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                  activeTab === tab.id
                    ? "bg-cyan-500 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {activeTab === "insights" && (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-900">Swarm Insights</h3>
                  <button className="flex items-center gap-2 px-3 py-1.5 bg-cyan-50 text-cyan-600 rounded-lg text-sm font-medium">
                    <Zap className="w-4 h-4" />
                    Generate New
                  </button>
                </div>

                <div className="space-y-4">
                  {SWARM_INSIGHTS.map((insight, index) => (
                    <motion.div
                      key={insight.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="p-5 border border-slate-200 rounded-xl hover:border-cyan-300 transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className={cn("px-3 py-1 rounded-full text-xs font-medium capitalize", getTypeColor(insight.type))}>
                            {insight.type}
                          </span>
                          <span className="text-xs text-slate-400">{insight.timestamp}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-400">
                          <ThumbsUp className="w-4 h-4" />
                          <span className="text-xs">{insight.votes}</span>
                        </div>
                      </div>

                      <p className="text-slate-700 mb-4">{insight.description}</p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1 text-sm text-slate-500">
                            <Brain className="w-4 h-4" />
                            <span>{insight.contributors} AI agents</span>
                          </div>
                          <div className="flex items-center gap-1 text-sm">
                            <Target className="w-4 h-4 text-cyan-500" />
                            <span className="font-medium text-cyan-600">{insight.confidence}% confidence</span>
                          </div>
                        </div>
                        <button className="p-2 hover:bg-slate-100 rounded-lg">
                          <Share2 className="w-4 h-4 text-slate-400" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Consensus Distribution</h3>
                <div className="space-y-4">
                  {[
                    { range: "90-100%", count: 23, color: "emerald" },
                    { range: "80-89%", count: 34, color: "cyan" },
                    { range: "70-79%", count: 18, color: "amber" },
                    { range: "<70%", count: 12, color: "rose" },
                  ].map((item) => (
                    <div key={item.range}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-slate-600">{item.range}</span>
                        <span className="text-sm font-medium text-slate-900">{item.count}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={cn("h-full rounded-full", `bg-${item.color}-500`)}
                          style={{ width: `${(item.count / 34) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-6 text-white">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="w-5 h-5" />
                  <h3 className="font-bold">Swarm Activity</h3>
                </div>
                <div className="flex items-center gap-4 mb-4">
                  <div>
                    <p className="text-2xl font-bold">156</p>
                    <p className="text-xs text-violet-200">Active agents</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">2.4k</p>
                    <p className="text-xs text-violet-200">Calculations/min</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-xs text-violet-200">Processing real-time data</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "clusters" && (
          <div className="grid lg:grid-cols-2 gap-6">
            {CLUSTERS.map((cluster, index) => (
              <motion.div
                key={cluster.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:border-cyan-300 cursor-pointer transition-all"
                onClick={() => setSelectedCluster(cluster)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-slate-900">{cluster.name}</h3>
                    <p className="text-sm text-slate-500">{cluster.patientCount} patients</p>
                  </div>
                  <span className={cn("px-3 py-1 rounded-full text-xs font-medium capitalize", getRiskColor(cluster.riskLevel))}>
                    {cluster.riskLevel} Risk
                  </span>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-slate-400 mb-2">Common Symptoms</p>
                  <div className="flex flex-wrap gap-2">
                    {cluster.commonSymptoms.map((symptom) => (
                      <span key={symptom} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-lg">
                        {symptom}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-lg font-bold text-slate-900">{cluster.avgAge}</p>
                      <p className="text-xs text-slate-400">Avg Age</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-cyan-600">{cluster.aiConsensus}%</p>
                      <p className="text-xs text-slate-400">AI Consensus</p>
                    </div>
                  </div>
                  <button className="flex items-center gap-1 text-sm text-cyan-600 font-medium">
                    View Details
                    <ChevronLeft className="w-4 h-4 rotate-180" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {activeTab === "collaboration" && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Collaborative AI Network</h3>
            
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              {[
                { name: "Diagnostic AI", role: "Pattern Recognition", status: "Active", icon: Brain },
                { name: "Risk Assessment AI", role: "Predictive Analysis", status: "Active", icon: AlertCircle },
                { name: "Treatment AI", role: "Protocol Optimization", status: "Active", icon: Activity },
              ].map((ai, index) => {
                const Icon = ai.icon;
                return (
                  <div key={ai.name} className="p-4 bg-slate-50 rounded-xl text-center">
                    <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <Icon className="w-6 h-6 text-cyan-600" />
                    </div>
                    <p className="font-medium text-slate-900">{ai.name}</p>
                    <p className="text-xs text-slate-500">{ai.role}</p>
                    <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      {ai.status}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="p-6 bg-gradient-to-r from-cyan-50 to-violet-50 rounded-xl">
              <div className="flex items-center gap-3 mb-4">
                <MessageSquare className="w-5 h-5 text-cyan-600" />
                <h4 className="font-semibold text-slate-900">Recent Collaboration</h4>
              </div>
              <div className="space-y-3">
                {[
                  { ai: "Diagnostic AI", message: "Detected pattern match with cluster C2", time: "2 min ago" },
                  { ai: "Risk Assessment AI", message: "Calculated 30-day readmission probability: 23%", time: "5 min ago" },
                  { ai: "Treatment AI", message: "Recommended protocol adjustment based on similar cases", time: "8 min ago" },
                ].map((msg, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-white rounded-lg">
                    <div className="w-8 h-8 bg-cyan-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Brain className="w-4 h-4 text-cyan-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">{msg.ai}</p>
                      <p className="text-sm text-slate-600">{msg.message}</p>
                    </div>
                    <span className="text-xs text-slate-400">{msg.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
