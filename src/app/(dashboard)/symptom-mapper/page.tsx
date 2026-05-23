"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Network, Brain, ChevronLeft, Sparkles, Activity, 
  AlertTriangle, CheckCircle, Search, Zap, Target,
  Stethoscope, FileText, Microscope
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface SymptomNode {
  id: string;
  name: string;
  category: string;
  x: number;
  y: number;
  selected: boolean;
  confidence: number;
}

interface DiagnosisCluster {
  id: string;
  name: string;
  probability: number;
  matchingSymptoms: string[];
  severity: "low" | "medium" | "high";
}

const SYMPTOM_NODES: SymptomNode[] = [
  { id: "s1", name: "Headache", category: "neurological", x: 20, y: 20, selected: false, confidence: 0.85 },
  { id: "s2", name: "Fever", category: "general", x: 50, y: 15, selected: false, confidence: 0.92 },
  { id: "s3", name: "Fatigue", category: "general", x: 80, y: 25, selected: false, confidence: 0.78 },
  { id: "s4", name: "Nausea", category: "gastrointestinal", x: 30, y: 45, selected: false, confidence: 0.88 },
  { id: "s5", name: "Chest Pain", category: "cardiovascular", x: 70, y: 40, selected: false, confidence: 0.95 },
  { id: "s6", name: "Shortness of Breath", category: "respiratory", x: 45, y: 60, selected: false, confidence: 0.91 },
  { id: "s7", name: "Joint Pain", category: "musculoskeletal", x: 15, y: 70, selected: false, confidence: 0.82 },
  { id: "s8", name: "Rash", category: "dermatological", x: 85, y: 65, selected: false, confidence: 0.76 },
  { id: "s9", name: "Dizziness", category: "neurological", x: 25, y: 85, selected: false, confidence: 0.87 },
  { id: "s10", name: "Cough", category: "respiratory", x: 60, y: 80, selected: false, confidence: 0.93 },
  { id: "s11", name: "Sore Throat", category: "respiratory", x: 75, y: 50, selected: false, confidence: 0.89 },
  { id: "s12", name: "Muscle Weakness", category: "neurological", x: 40, y: 30, selected: false, confidence: 0.84 },
];

const DIAGNOSIS_CLUSTERS: DiagnosisCluster[] = [
  { id: "d1", name: "Viral Respiratory Infection", probability: 0.87, matchingSymptoms: ["s2", "s6", "s10", "s11"], severity: "medium" },
  { id: "d2", name: "Migraine", probability: 0.72, matchingSymptoms: ["s1", "s3", "s9"], severity: "medium" },
  { id: "d3", name: "Acute Bronchitis", probability: 0.65, matchingSymptoms: ["s6", "s10", "s2"], severity: "low" },
  { id: "d4", name: "Cardiovascular Event", probability: 0.45, matchingSymptoms: ["s5", "s6", "s3"], severity: "high" },
];

const CATEGORY_COLORS: Record<string, string> = {
  neurological: "violet",
  general: "amber",
  gastrointestinal: "emerald",
  cardiovascular: "rose",
  respiratory: "cyan",
  musculoskeletal: "orange",
  dermatological: "pink",
};

export default function SymptomMapperPage() {
  const [symptoms, setSymptoms] = useState<SymptomNode[]>(SYMPTOM_NODES);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const toggleSymptom = (id: string) => {
    setSymptoms(prev => prev.map(s => 
      s.id === id ? { ...s, selected: !s.selected } : s
    ));
    setShowResults(false);
  };

  const analyzeSymptoms = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      setIsAnalyzing(false);
      setShowResults(true);
    }, 2000);
  };

  const selectedCount = symptoms.filter(s => s.selected).length;
  const filteredSymptoms = symptoms.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            <h1 className="text-2xl font-bold text-slate-900">Neural Symptom Mapper</h1>
            <p className="text-sm text-slate-500">33-Node AI Pattern Recognition Network</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Panel - Neural Network */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              {/* Search Bar */}
              <div className="flex gap-4 mb-6">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search symptoms..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  />
                </div>
                <button
                  onClick={analyzeSymptoms}
                  disabled={selectedCount === 0 || isAnalyzing}
                  className="px-4 py-2 bg-cyan-500 text-white rounded-xl text-sm font-medium hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  <Brain className="w-4 h-4" />
                  {isAnalyzing ? "Analyzing..." : "Analyze"}
                </button>
              </div>

              {/* Neural Network Visualization */}
              <div className="relative h-96 bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl overflow-hidden">
                {/* Connection Lines */}
                <svg className="absolute inset-0 w-full h-full">
                  {filteredSymptoms.map((symptom, i) => 
                    filteredSymptoms.slice(i + 1).map((other, j) => {
                      if (Math.random() > 0.7) return null;
                      return (
                        <motion.line
                          key={`${symptom.id}-${other.id}`}
                          x1={`${symptom.x}%`}
                          y1={`${symptom.y}%`}
                          x2={`${other.x}%`}
                          y2={`${other.y}%`}
                          stroke={symptom.selected && other.selected ? "#06b6d4" : "#e2e8f0"}
                          strokeWidth={symptom.selected && other.selected ? 2 : 1}
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 1, delay: i * 0.05 }}
                        />
                      );
                    })
                  )}
                </svg>

                {/* Symptom Nodes */}
                {filteredSymptoms.map((symptom) => {
                  const color = CATEGORY_COLORS[symptom.category] || "slate";
                  return (
                    <motion.button
                      key={symptom.id}
                      className={cn(
                        "absolute w-24 h-12 rounded-xl flex items-center justify-center text-xs font-medium border-2 transition-all shadow-sm",
                        symptom.selected
                          ? `bg-${color}-100 border-${color}-400 text-${color}-700`
                          : "bg-white border-slate-200 text-slate-600 hover:border-cyan-300"
                      )}
                      style={{ 
                        left: `calc(${symptom.x}% - 48px)`,
                        top: `calc(${symptom.y}% - 24px)`,
                      }}
                      onClick={() => toggleSymptom(symptom.id)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {symptom.name}
                      {symptom.selected && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-cyan-500 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-3 h-3 text-white" />
                        </span>
                      )}
                    </motion.button>
                  );
                })}

                {/* AI Processing Animation */}
                {isAnalyzing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
                    <div className="text-center">
                      <motion.div
                        className="w-16 h-16 border-4 border-cyan-200 border-t-cyan-500 rounded-full mx-auto mb-4"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                      <p className="text-slate-600 font-medium">AI Analyzing Patterns...</p>
                      <p className="text-sm text-slate-400">Processing neural connections</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 mt-4">
                {Object.entries(CATEGORY_COLORS).map(([category, color]) => (
                  <div key={category} className="flex items-center gap-2">
                    <span className={cn("w-3 h-3 rounded-full", `bg-${color}-400`)} />
                    <span className="text-xs text-slate-600 capitalize">{category}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel - Analysis Results */}
          <div className="space-y-6">
            {/* Selected Symptoms */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-cyan-500" />
                Selected Symptoms
              </h3>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-3xl font-bold text-cyan-600">{selectedCount}</span>
                <span className="text-sm text-slate-500">of {symptoms.length} nodes active</span>
              </div>
              
              {selectedCount > 0 ? (
                <div className="space-y-2">
                  {symptoms.filter(s => s.selected).map(symptom => (
                    <div key={symptom.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                      <span className="text-sm text-slate-700">{symptom.name}</span>
                      <span className="text-xs text-slate-400">{Math.round(symptom.confidence * 100)}% confidence</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-4">Select symptoms from the network</p>
              )}
            </div>

            {/* Diagnosis Clusters */}
            {showResults && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200"
              >
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-violet-500" />
                  AI Diagnosis Clusters
                </h3>
                
                <div className="space-y-4">
                  {DIAGNOSIS_CLUSTERS.map((diagnosis, index) => (
                    <div 
                      key={diagnosis.id}
                      className="p-4 rounded-xl border-2 transition-all hover:border-cyan-200 cursor-pointer"
                      style={{
                        borderColor: diagnosis.probability > 0.8 ? "#22c55e" : diagnosis.probability > 0.6 ? "#f59e0b" : "#e2e8f0"
                      }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-slate-900">{diagnosis.name}</p>
                          <p className="text-xs text-slate-500">{diagnosis.matchingSymptoms.length} matching symptoms</p>
                        </div>
                        <span className={cn(
                          "px-2 py-1 rounded text-xs font-medium",
                          diagnosis.severity === "high" ? "bg-rose-100 text-rose-600" :
                          diagnosis.severity === "medium" ? "bg-amber-100 text-amber-600" :
                          "bg-emerald-100 text-emerald-600"
                        )}>
                          {diagnosis.severity}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-cyan-400 to-violet-400 rounded-full"
                            style={{ width: `${diagnosis.probability * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-slate-700">{Math.round(diagnosis.probability * 100)}%</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-3 bg-amber-50 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    AI-generated suggestions require clinical verification. Always confirm with patient history and physical examination.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors text-left">
                  <Stethoscope className="w-5 h-5 text-cyan-500" />
                  <span className="text-sm text-slate-700">Order Tests</span>
                </button>
                <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors text-left">
                  <FileText className="w-5 h-5 text-violet-500" />
                  <span className="text-sm text-slate-700">Generate Report</span>
                </button>
                <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors text-left">
                  <Microscope className="w-5 h-5 text-emerald-500" />
                  <span className="text-sm text-slate-700">View Lab Results</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
