"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Dna, ChevronLeft, Microscope, Activity, Pill, AlertTriangle,
  FileText, Search, Filter, Download, Share2, Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface GeneticMarker {
  id: string;
  gene: string;
  variant: string;
  significance: "pathogenic" | "likely_pathogenic" | "uncertain" | "benign";
  condition: string;
  confidence: number;
}

interface DrugResponse {
  drug: string;
  response: "normal" | "reduced" | "enhanced" | "adverse";
  recommendation: string;
  evidence: string;
}

const GENETIC_MARKERS: GeneticMarker[] = [
  { id: "g1", gene: "BRCA1", variant: "c.68_69delAG", significance: "pathogenic", condition: "Hereditary Breast/Ovarian Cancer", confidence: 99.8 },
  { id: "g2", gene: "CYP2C19", variant: "*2", significance: "likely_pathogenic", condition: "Clopidogrel Metabolism", confidence: 98.5 },
  { id: "g3", gene: "SLCO1B1", variant: "*5", significance: "uncertain", condition: "Statin Myopathy Risk", confidence: 85.2 },
  { id: "g4", gene: "APOE", variant: "ε4", significance: "likely_pathogenic", condition: "Alzheimer's Disease Risk", confidence: 92.1 },
  { id: "g5", gene: "MTHFR", variant: "C677T", significance: "benign", condition: "Folate Metabolism", confidence: 78.5 },
];

const DRUG_RESPONSES: DrugResponse[] = [
  { drug: "Warfarin", response: "reduced", recommendation: "Start with lower dose (3-4mg)", evidence: "CYP2C9 *2/*3 variants detected" },
  { drug: "Clopidogrel", response: "reduced", recommendation: "Consider alternative antiplatelet", evidence: "CYP2C19 poor metabolizer" },
  { drug: "Codeine", response: "enhanced", recommendation: "Avoid or use lowest effective dose", evidence: "CYP2D6 ultra-rapid metabolizer" },
  { drug: "Simvastatin", response: "adverse", recommendation: "Use lower dose or alternative statin", evidence: "SLCO1B1 variant increases myopathy risk" },
];

const RISK_ASSESSMENTS = [
  { category: "Cardiovascular", risk: "Moderate", score: 45, color: "amber" },
  { category: "Oncological", risk: "High", score: 72, color: "rose" },
  { category: "Neurological", risk: "Low", score: 28, color: "emerald" },
  { category: "Metabolic", risk: "Moderate", score: 52, color: "amber" },
];

export default function GenomicsPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedMarker, setSelectedMarker] = useState<GeneticMarker | null>(null);

  const getSignificanceColor = (sig: string) => {
    switch (sig) {
      case "pathogenic": return "bg-rose-100 text-rose-700 border-rose-200";
      case "likely_pathogenic": return "bg-amber-100 text-amber-700 border-amber-200";
      case "uncertain": return "bg-slate-100 text-slate-700 border-slate-200";
      default: return "bg-emerald-100 text-emerald-700 border-emerald-200";
    }
  };

  const getResponseColor = (response: string) => {
    switch (response) {
      case "adverse": return "bg-rose-100 text-rose-700";
      case "reduced": return "bg-amber-100 text-amber-700";
      case "enhanced": return "bg-violet-100 text-violet-700";
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
            <h1 className="text-2xl font-bold text-slate-900">Genomic Integration</h1>
            <p className="text-sm text-slate-500">DNA-Based Personalized Medicine</p>
          </div>
          <span className="ml-auto px-3 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
            Beta Feature
          </span>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8">
          {[
            { id: "overview", label: "Overview", icon: Activity },
            { id: "variants", label: "Genetic Variants", icon: Dna },
            { id: "pharmacogenomics", label: "Drug Response", icon: Pill },
            { id: "reports", label: "Reports", icon: FileText },
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
        {activeTab === "overview" && (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* DNA Helix Visualization */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-900">Genomic Profile</h3>
                  <div className="flex gap-2">
                    <button className="p-2 hover:bg-slate-100 rounded-lg">
                      <Download className="w-4 h-4 text-slate-600" />
                    </button>
                    <button className="p-2 hover:bg-slate-100 rounded-lg">
                      <Share2 className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                </div>

                {/* DNA Visualization */}
                <div className="h-64 flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 rounded-xl overflow-hidden relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    {[...Array(8)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute w-4 h-4 rounded-full"
                        style={{
                          backgroundColor: i % 2 === 0 ? "#06b6d4" : "#8b5cf6",
                          left: `calc(50% + ${Math.sin(i * 0.8) * 80}px)`,
                          top: `${20 + i * 25}px`,
                        }}
                        animate={{ 
                          scale: [1, 1.2, 1],
                          opacity: [0.7, 1, 0.7]
                        }}
                        transition={{ 
                          duration: 2, 
                          repeat: Infinity, 
                          delay: i * 0.2 
                        }}
                      />
                    ))}
                    {/* DNA Strands */}
                    <svg className="absolute w-48 h-48" viewBox="0 0 200 200">
                      <motion.path
                        d="M60,20 Q100,60 60,100 Q100,140 60,180"
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth="3"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 2 }}
                      />
                      <motion.path
                        d="M140,20 Q100,60 140,100 Q100,140 140,180"
                        fill="none"
                        stroke="#8b5cf6"
                        strokeWidth="3"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 2, delay: 0.5 }}
                      />
                    </svg>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4 mt-6">
                  <div className="text-center p-4 bg-slate-50 rounded-xl">
                    <p className="text-2xl font-bold text-cyan-600">3.2B</p>
                    <p className="text-xs text-slate-500">Base Pairs</p>
                  </div>
                  <div className="text-center p-4 bg-slate-50 rounded-xl">
                    <p className="text-2xl font-bold text-violet-600">24,589</p>
                    <p className="text-xs text-slate-500">Genes Analyzed</p>
                  </div>
                  <div className="text-center p-4 bg-slate-50 rounded-xl">
                    <p className="text-2xl font-bold text-amber-600">156</p>
                    <p className="text-xs text-slate-500">Variants Found</p>
                  </div>
                  <div className="text-center p-4 bg-slate-50 rounded-xl">
                    <p className="text-2xl font-bold text-emerald-600">99.9%</p>
                    <p className="text-xs text-slate-500">Coverage</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Risk Assessments */}
            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Risk Assessments</h3>
                <div className="space-y-4">
                  {RISK_ASSESSMENTS.map((risk) => (
                    <div key={risk.category} className="p-4 bg-slate-50 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-700">{risk.category}</span>
                        <span className={cn(
                          "px-2 py-0.5 rounded text-xs font-medium",
                          risk.color === "rose" ? "bg-rose-100 text-rose-600" :
                          risk.color === "amber" ? "bg-amber-100 text-amber-600" :
                          "bg-emerald-100 text-emerald-600"
                        )}>
                          {risk.risk}
                        </span>
                      </div>
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className={cn("h-full rounded-full", `bg-${risk.color}-500`)}
                          style={{ width: `${risk.score}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-400 mt-1">Risk Score: {risk.score}%</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-6 text-white">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5" />
                  <h3 className="font-bold">AI Recommendation</h3>
                </div>
                <p className="text-sm text-violet-100">
                  Based on genomic profile, consider enhanced screening for BRCA-related cancers 
                  and personalized medication dosing.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "variants" && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900">Genetic Variants</h3>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search genes..."
                    className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  />
                </div>
                <button className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                  <Filter className="w-4 h-4" />
                  Filter
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {GENETIC_MARKERS.map((marker) => (
                <motion.div
                  key={marker.id}
                  className="p-4 border border-slate-200 rounded-xl hover:border-cyan-300 cursor-pointer transition-all"
                  onClick={() => setSelectedMarker(marker)}
                  whileHover={{ scale: 1.01 }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-cyan-50 rounded-xl flex items-center justify-center">
                        <Dna className="w-6 h-6 text-cyan-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{marker.gene}</p>
                        <p className="text-sm text-slate-500">{marker.variant}</p>
                        <p className="text-xs text-slate-400 mt-1">{marker.condition}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={cn("px-3 py-1 rounded-full text-xs font-medium border", getSignificanceColor(marker.significance))}>
                        {marker.significance.replace("_", " ")}
                      </span>
                      <p className="text-xs text-slate-400 mt-2">{marker.confidence}% confidence</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "pharmacogenomics" && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Pharmacogenomic Analysis</h3>
            
            <div className="grid md:grid-cols-2 gap-6">
              {DRUG_RESPONSES.map((drug, index) => (
                <motion.div
                  key={drug.drug}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-5 border border-slate-200 rounded-xl"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-slate-900">{drug.drug}</h4>
                    <span className={cn("px-3 py-1 rounded-full text-xs font-medium capitalize", getResponseColor(drug.response))}>
                      {drug.response} Response
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Recommendation</p>
                      <p className="text-sm text-slate-700">{drug.recommendation}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Evidence</p>
                      <p className="text-sm text-slate-600">{drug.evidence}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-amber-50 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Important Notice</p>
                <p className="text-xs text-amber-700 mt-1">
                  Pharmacogenomic recommendations should be used as guidance only. 
                  Always consider patient history, comorbidities, and current medications.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "reports" && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Genomic Reports</h3>
            
            <div className="space-y-4">
              {[
                { name: "Whole Genome Sequencing Report", date: "2024-01-15", status: "Complete", size: "2.4 MB" },
                { name: "Pharmacogenomics Panel", date: "2024-01-15", status: "Complete", size: "856 KB" },
                { name: "Cancer Risk Assessment", date: "2024-01-15", status: "Complete", size: "1.2 MB" },
                { name: "Cardiovascular Risk Panel", date: "2024-01-15", status: "Complete", size: "945 KB" },
              ].map((report, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-cyan-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{report.name}</p>
                      <p className="text-xs text-slate-500">{report.date} • {report.size}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded">
                      {report.status}
                    </span>
                    <button className="p-2 hover:bg-white rounded-lg">
                      <Download className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
