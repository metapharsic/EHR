"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Search, Download, Share2, Mic, Sparkles, User, CheckCircle, Edit3, MoreVertical, Plus,
  DollarSign, Receipt, ChevronDown, ChevronUp, ClipboardList, Zap, BarChart3, RefreshCw, Printer, Send, Activity, ShieldCheck, FileCheck2, Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Document {
  id: string;
  title: string;
  type: "note" | "report" | "transcript" | "summary";
  patient: string;
  patientId: string;
  createdAt: string;
  status: "draft" | "completed" | "verified";
  source: "manual" | "ai-scribe" | "voice";
  size: string;
}

interface Claim {
  id: string;
  claimNumber: string;
  patientName: string;
  patientId: string;
  dob: string;
  insurance: string;
  insuranceId: string;
  dos: string;
  provider: string;
  facility: string;
  icdCodes: { code: string; description: string }[];
  cptCodes: { code: string; description: string; units: number; charge: number }[];
  totalCharge: number;
  status: "draft" | "submitted" | "accepted" | "denied" | "paid" | "partial";
  paidAmount?: number;
  denialReason?: string;
  submittedAt?: string;
}

interface ARItem {
  id: string;
  claimNumber: string;
  patientName: string;
  insurance: string;
  dos: string;
  billed: number;
  allowed: number;
  paid: number;
  balance: number;
  aging: "0-30" | "31-60" | "61-90" | "90+";
  status: string;
}

// ── Mock Data ──────────────────────────────────────────────────────────────────
const INITIAL_DOCUMENTS: Document[] = [
  { id: "d1", title: "Annual Physical - Progress Note", type: "note", patient: "John Smith", patientId: "P12345", createdAt: "2 hours ago", status: "completed", source: "ai-scribe", size: "245 KB" },
  { id: "d2", title: "Cardiology Consultation Report", type: "report", patient: "Sarah Johnson", patientId: "P12346", createdAt: "4 hours ago", status: "verified", source: "manual", size: "1.2 MB" },
  { id: "d3", title: "Voice Transcript - Follow-up", type: "transcript", patient: "Michael Brown", patientId: "P12347", createdAt: "5 hours ago", status: "draft", source: "voice", size: "89 KB" },
  { id: "d4", title: "AI-Generated Visit Summary", type: "summary", patient: "Emily Davis", patientId: "P12348", createdAt: "6 hours ago", status: "completed", source: "ai-scribe", size: "156 KB" },
  { id: "d5", title: "Lab Results Summary", type: "report", patient: "Robert Wilson", patientId: "P12349", createdAt: "1 day ago", status: "verified", source: "manual", size: "456 KB" },
  { id: "d6", title: "Discharge Summary", type: "summary", patient: "Lisa Anderson", patientId: "P12350", createdAt: "1 day ago", status: "completed", source: "ai-scribe", size: "312 KB" },
];

const INITIAL_CLAIMS: Claim[] = [
  {
    id: "c1", claimNumber: "CLM-2024-0012", patientName: "John Smith", patientId: "P12345", dob: "1979-03-15",
    insurance: "Blue Cross Blue Shield", insuranceId: "BCBS-123456789", dos: "2024-02-20",
    provider: "Dr. Sarah Chen", facility: "Metapharsic Medical Center",
    icdCodes: [{ code: "I10", description: "Essential Hypertension" }, { code: "E11.9", description: "Type 2 Diabetes" }],
    cptCodes: [
      { code: "99214", description: "Office Visit, Est. Patient", units: 1, charge: 250 },
      { code: "93000", description: "Electrocardiogram", units: 1, charge: 85 },
    ],
    totalCharge: 335, status: "submitted", submittedAt: "2024-02-20",
  },
  {
    id: "c2", claimNumber: "CLM-2024-0013", patientName: "Maria Garcia", patientId: "P12346", dob: "1992-07-22",
    insurance: "Aetna", insuranceId: "AET-987654321", dos: "2024-02-19",
    provider: "Dr. Michael Ross", facility: "Downtown Clinic",
    icdCodes: [{ code: "R07.9", description: "Chest Pain, unspecified" }],
    cptCodes: [
      { code: "99213", description: "Office Visit, Est. Patient", units: 1, charge: 180 },
      { code: "71046", description: "Chest X-ray 2 views", units: 1, charge: 120 },
    ],
    totalCharge: 300, status: "accepted", submittedAt: "2024-02-19",
  },
  {
    id: "c3", claimNumber: "CLM-2024-0010", patientName: "Robert Johnson", patientId: "P12347", dob: "1966-11-05",
    insurance: "Medicare", insuranceId: "MED-456789123", dos: "2024-02-10",
    provider: "Dr. James Wilson", facility: "Metapharsic Medical Center",
    icdCodes: [{ code: "M79.3", description: "Knee Pain" }],
    cptCodes: [{ code: "99215", description: "Office Visit, Complex", units: 1, charge: 320 }],
    totalCharge: 320, status: "denied", denialReason: "Missing prior authorization", submittedAt: "2024-02-10",
  },
  {
    id: "c4", claimNumber: "CLM-2024-0008", patientName: "Emma Thompson", patientId: "P12348", dob: "1996-04-18",
    insurance: "United Healthcare", insuranceId: "UHC-789123456", dos: "2024-02-05",
    provider: "Dr. Lisa Park", facility: "Downtown Clinic",
    icdCodes: [{ code: "L30.9", description: "Dermatitis, unspecified" }],
    cptCodes: [{ code: "99212", description: "Office Visit, Est. Patient", units: 1, charge: 140 }],
    totalCharge: 140, status: "paid", paidAmount: 112, submittedAt: "2024-02-05",
  },
];

const INITIAL_AR: ARItem[] = [
  { id: "ar1", claimNumber: "CLM-2024-0009", patientName: "David Lee", insurance: "Kaiser Permanente", dos: "2024-02-01", billed: 420, allowed: 380, paid: 0, balance: 380, aging: "0-30", status: "Pending" },
  { id: "ar2", claimNumber: "CLM-2024-0005", patientName: "Sarah Williams", insurance: "Cigna", dos: "2024-01-20", billed: 650, allowed: 600, paid: 300, balance: 300, aging: "31-60", status: "Partial" },
  { id: "ar3", claimNumber: "CLM-2023-0098", patientName: "Michael Brown", insurance: "Aetna", dos: "2023-12-15", billed: 890, allowed: 800, paid: 0, balance: 800, aging: "61-90", status: "Denied - Appeal" },
  { id: "ar4", claimNumber: "CLM-2023-0045", patientName: "Jennifer Davis", insurance: "Medicare", dos: "2023-11-01", billed: 1200, allowed: 1100, paid: 0, balance: 1100, aging: "90+", status: "Collections" },
];


// ── AI Build Modal ─────────────────────────────────────────────────────────────
function AIClaimBuilderModal({ onClose, onComplete }: { onClose: () => void, onComplete: (claim: Claim) => void }) {
  const [step, setStep] = useState(0);

  const steps = [
    { text: "Scanning recent clinical notes...", icon: Search },
    { text: "Extracting ICD-10 diagnosis codes...", icon: Activity },
    { text: "Determining optimal CPT E&M levels...", icon: DollarSign },
    { text: "Validating against NCCI edits...", icon: ShieldCheck },
    { text: "Claim assembled successfully.", icon: FileCheck2 }
  ];

  useEffect(() => {
    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      if (currentStep < steps.length) {
        setStep(currentStep);
      } else {
        clearInterval(interval);
        setTimeout(() => {
          onComplete({
            id: `c-new-${Date.now()}`,
            claimNumber: `CLM-2024-${Math.floor(Math.random() * 1000).toString().padStart(4, "0")}`,
            patientName: "Michael Brown",
            patientId: "P12347",
            dob: "1980-05-22",
            insurance: "Aetna",
            insuranceId: "AET-112233",
            dos: new Date().toISOString().split("T")[0],
            provider: "Dr. Sarah Chen",
            facility: "Metapharsic Medical Center",
            icdCodes: [{ code: "J01.90", description: "Acute sinusitis, unspecified" }],
            cptCodes: [{ code: "99213", description: "Office Visit, Est. Patient", units: 1, charge: 180 }],
            totalCharge: 180,
            status: "draft"
          });
        }, 1200);
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4">
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden relative">
        <div className="p-6 text-center pt-10 pb-8">
          <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-6 relative" style={{ background: "linear-gradient(135deg, #06b6d4, #8b5cf6)" }}>
            {step < steps.length - 1 ? (
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            ) : (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
                <CheckCircle className="w-8 h-8 text-white" />
              </motion.div>
            )}
            <div className="absolute -inset-2 rounded-full border border-cyan-400/30 animate-ping" />
          </div>
          
          <h3 className="text-xl font-bold text-slate-900 mb-2">Metta AI Claim Builder</h3>
          <p className="text-slate-500 text-sm mb-8 h-10">Intelligent coding from raw consultation data</p>

          <div className="space-y-3 text-left">
            {steps.map((s, idx) => {
              const Icon = s.icon;
              const isPast = idx < step;
              const isCurrent = idx === step;
              if (idx > step) return null;
              
              return (
                <motion.div key={idx} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  className={cn("flex items-center gap-3 p-3 rounded-lg border", 
                    isPast ? "bg-slate-50 border-slate-100 text-slate-500" :
                    isCurrent ? "bg-cyan-50 border-cyan-200 text-cyan-700 font-medium" : "hidden"
                  )}
                >
                  <Icon className={cn("w-4 h-4", isPast ? "text-slate-400" : "text-cyan-500")} />
                  <span className="text-sm">{s.text}</span>
                  {isCurrent && <span className="ml-auto flex w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />}
                  {isPast && <CheckCircle className="ml-auto w-4 h-4 text-emerald-500" />}
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>
  );
}


// ── Claim Card ──────────────────────────────────────────────────────────────────
function ClaimCard({ claim }: { claim: Claim }) {
  const [expanded, setExpanded] = useState(false);
  
  const statusConfig: Record<string, { color: string; label: string }> = {
    draft: { color: "bg-slate-100 text-slate-600 border border-slate-200", label: "Draft" },
    submitted: { color: "bg-blue-50 text-blue-700 border border-blue-200", label: "Submitted" },
    accepted: { color: "bg-cyan-50 text-cyan-700 border border-cyan-200", label: "Accepted" },
    denied: { color: "bg-rose-50 text-rose-700 border border-rose-200", label: "Denied" },
    paid: { color: "bg-emerald-50 text-emerald-700 border border-emerald-200", label: "Paid" },
    partial: { color: "bg-amber-50 text-amber-700 border border-amber-200", label: "Partial Pay" },
  };
  const cfg = statusConfig[claim.status] || statusConfig.draft;

  return (
    <div className={cn("bg-white rounded-xl border transition-all overflow-hidden", expanded ? "border-cyan-300 shadow-sm" : "border-slate-200 hover:border-cyan-300")}>
      <div className="p-4 cursor-pointer flex items-start justify-between gap-4" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 flex items-center justify-center">
            {claim.status === "draft" ? <Zap className="w-5 h-5 text-amber-500" /> : <Receipt className="w-5 h-5 text-slate-500" />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900">{claim.claimNumber}</span>
              <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold", cfg.color)}>{cfg.label}</span>
              {claim.status === "denied" && <span className="text-xs font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">{claim.denialReason}</span>}
              {claim.status === "draft" && <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1"><Sparkles className="w-3 h-3"/> AI Built</span>}
            </div>
            <p className="text-sm font-medium text-slate-700 mt-1">{claim.patientName} • <span className="text-slate-500 font-normal">DOS: {claim.dos}</span></p>
            <p className="text-xs text-slate-400 mt-0.5">{claim.insurance} • {claim.provider}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right">
            <p className="text-lg font-black text-slate-900">${claim.totalCharge.toFixed(2)}</p>
            {claim.paidAmount !== undefined && <p className="text-xs font-bold text-emerald-600">Paid: ${claim.paidAmount.toFixed(2)}</p>}
          </div>
          <div className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center border border-slate-200">
            {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-slate-100 bg-slate-50/50">
            <div className="p-5 grid md:grid-cols-2 gap-6">
              {/* ICD Codes */}
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Diagnosis Codes (ICD-10)</h4>
                <div className="space-y-2">
                  {claim.icdCodes.map((c) => (
                    <div key={c.code} className="flex items-start gap-3 bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="font-mono text-xs font-bold text-cyan-600 bg-cyan-50 px-2 py-1 rounded">{c.code}</span>
                      <span className="text-sm text-slate-700 font-medium leading-tight pt-0.5">{c.description}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* CPT Codes */}
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Procedure Codes (CPT)</h4>
                <div className="space-y-2">
                  {claim.cptCodes.map((c) => (
                    <div key={c.code} className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold text-violet-600 bg-violet-50 px-2 py-1 rounded">{c.code}</span>
                        <span className="text-sm text-slate-700 font-medium truncate max-w-[160px]">{c.description}</span>
                      </div>
                      <span className="font-bold text-slate-900">${c.charge}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-5 pb-5 flex items-center justify-end gap-2">
              {claim.status === "draft" && (
                <Button className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white gap-2 shadow-sm font-semibold">
                  <Send className="w-4 h-4" /> Finalize & Submit Claim
                </Button>
              )}
              {claim.status === "denied" && (
                <Button className="bg-amber-500 hover:bg-amber-600 text-white gap-2 shadow-sm font-semibold">
                  <RefreshCw className="w-4 h-4" /> AI Generate Appeal Letter
                </Button>
              )}
              <Button variant="outline" className="gap-2 font-semibold">
                <Printer className="w-4 h-4" /> print CMS-1500
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>(INITIAL_DOCUMENTS);
  const [claims, setClaims] = useState<Claim[]>(INITIAL_CLAIMS);
  const [filter, setFilter] = useState<"all" | "note" | "report" | "transcript" | "summary">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"documents" | "claims" | "superbill" | "ar">("documents");
  const [isBuildingClaim, setIsBuildingClaim] = useState(false);

  const filteredDocs = documents.filter((doc) => {
    if (filter !== "all" && doc.type !== filter) return false;
    if (searchTerm && !doc.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !doc.patient.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const handleAIBuildComplete = (newClaim: Claim) => {
    setIsBuildingClaim(false);
    setClaims([newClaim, ...claims]);
  };

  const claimStats = {
    total: claims.length,
    submitted: claims.filter((c) => c.status === "submitted").length,
    denied: claims.filter((c) => c.status === "denied").length,
    paid: claims.filter((c) => c.status === "paid").length,
    totalBilled: claims.reduce((s, c) => s + c.totalCharge, 0),
  };

  const tabs = [
    { id: "documents", label: "Documents", icon: FileText },
    { id: "claims", label: "Claim Builder", icon: Receipt, badge: claimStats.denied > 0 ? claimStats.denied : undefined },
    { id: "superbill", label: "Superbill", icon: ClipboardList },
    { id: "ar", label: "AR Aging", icon: BarChart3 },
  ];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "note": return <FileText className="w-5 h-5 text-cyan-500" />;
      case "report": return <Search className="w-5 h-5 text-violet-500" />;
      case "transcript": return <Mic className="w-5 h-5 text-rose-500" />;
      case "summary": return <Sparkles className="w-5 h-5 text-amber-500" />;
      default: return <FileText className="w-5 h-5 text-slate-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {isBuildingClaim && <AIClaimBuilderModal onClose={() => setIsBuildingClaim(false)} onComplete={handleAIBuildComplete} />}

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <FileText className="w-7 h-7 text-cyan-500" />
              Documents & Billing
            </h1>
            <p className="text-slate-500 text-sm font-medium mt-1">Auto-documentation, intelligent claim builder, and revenue lifecycle.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="gap-2 font-semibold bg-white">
              <Download className="w-4 h-4" /> Export All
            </Button>
            <Button className="gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 shadow-md font-bold" onClick={() => setActiveTab("claims")}>
              <Plus className="w-4 h-4" /> New Claim
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Documents", value: documents.length, icon: FileText, color: "text-slate-900" },
            { label: "AI Generated", value: documents.filter(d=>d.source==="ai-scribe").length, icon: Sparkles, color: "text-violet-600" },
            { label: "Active Claims", value: claimStats.total, icon: Receipt, color: "text-cyan-600" },
            { label: "Total Billed MTD", value: `$${claimStats.totalBilled.toLocaleString()}`, icon: DollarSign, color: "text-emerald-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0">
                <s.icon className={cn("w-6 h-6", s.color)} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{s.label}</p>
                <p className={cn("text-2xl font-black mt-0.5", s.color)}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-white p-1.5 rounded-xl border border-slate-200 w-fit shadow-sm">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "relative flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-300",
                activeTab === tab.id ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.badge !== undefined && (
                <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-rose-500 border-2 border-white text-white text-[10px] flex items-center justify-center font-black shadow-sm">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Documents Tab */}
        {activeTab === "documents" && (
          <motion.div key="docs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                {(["all", "note", "report", "transcript", "summary"] as const).map((f) => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all capitalize",
                      filter === f ? "bg-cyan-50 text-cyan-700 border border-cyan-200 shadow-sm" : "bg-transparent text-slate-500 hover:bg-slate-50")}>
                    {f}
                  </button>
                ))}
              </div>
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" placeholder="Search documents..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 shadow-sm" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocs.map((doc, index) => (
                <motion.div key={doc.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.05 }}
                  className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:border-cyan-300 hover:shadow-md transition-all group cursor-pointer relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8 bg-white/80 backdrop-blur shadow-sm border border-slate-100 text-slate-500 hover:text-cyan-600"><Download className="w-4 h-4"/></Button>
                  </div>
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center flex-shrink-0">
                      {getTypeIcon(doc.type)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 leading-tight group-hover:text-cyan-600 transition-colors line-clamp-2">{doc.title}</h3>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-medium"><User className="w-3.5 h-3.5"/> {doc.patient}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100 gap-2">
                    <div className="flex gap-2">
                      <span className={cn("px-2 py-1 rounded text-[10px] uppercase tracking-wider font-extrabold", doc.status==="completed"?"bg-cyan-50 text-cyan-700":"bg-emerald-50 text-emerald-700")}>{doc.status}</span>
                      {doc.source === "ai-scribe" && <span className="px-2 py-1 rounded bg-violet-50 text-violet-700 text-[10px] uppercase tracking-wider font-extrabold flex items-center gap-1"><Sparkles className="w-3 h-3"/> AI</span>}
                    </div>
                    <span className="text-xs font-semibold text-slate-400">{doc.createdAt}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Claims Tab */}
        {activeTab === "claims" && (
          <motion.div key="claims" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* AI Claim Builder Banner */}
            <div className="relative overflow-hidden bg-slate-900 rounded-2xl p-6 shadow-lg border border-slate-800">
              <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500 rounded-full blur-[80px] opacity-20 transform translate-x-1/2 -translate-y-1/2" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-500 rounded-full blur-[80px] opacity-20 transform -translate-x-1/2 translate-y-1/2" />
              
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #06b6d4, #8b5cf6)" }}>
                    <Sparkles className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white mb-1">Metta AI Claim Generator</h2>
                    <p className="text-slate-400 text-sm max-w-xl">Zero-click medical coding. Automatically analyse clinical notes to extract precise ICD-10 and CPT codes, validated in real-time against current payer rules.</p>
                  </div>
                </div>
                <Button onClick={() => setIsBuildingClaim(true)} className="bg-white hover:bg-slate-100 text-slate-900 font-bold px-6 py-6 h-auto shadow-xl flex-shrink-0 gap-2 w-full md:w-auto">
                  <Zap className="w-5 h-5 text-amber-500" fill="currentColor" />
                  Auto-Build from Latest Notes
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <AnimatePresence>
                {claims.map((claim) => <motion.div key={claim.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} layout><ClaimCard claim={claim} /></motion.div>)}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* Superbill Tab */}
        {activeTab === "superbill" && (
          <motion.div key="superbill" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center">
                    <ClipboardList className="w-6 h-6 text-cyan-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Superbill Generator</h2>
                    <p className="text-sm font-medium text-slate-500">Itemized receipt for patient self-pay & reimbursement</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="gap-2 font-semibold shadow-sm"><Printer className="w-4 h-4" /> Print PDF</Button>
                  <Button className="gap-2 font-bold bg-cyan-600 hover:bg-cyan-700 shadow-md"><Send className="w-4 h-4" /> Send to Portal</Button>
                </div>
              </div>

              {/* Practice Header */}
              <div className="flex justify-between items-start mb-10">
                <div>
                  <h3 className="font-black text-slate-900 text-xl tracking-tight">METAPHARSIC MEDICAL CENTER</h3>
                  <p className="text-sm text-slate-500 font-medium mt-1">123 Healthcare Ave, Medical City, CA 90210</p>
                  <p className="text-sm text-slate-500 font-medium">(555) 123-4567 • NPI: <span className="text-slate-900 font-bold">1234567890</span></p>
                </div>
                <div className="text-right">
                  <div className="inline-block bg-slate-50 border border-slate-200 rounded-lg px-4 py-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Receipt Number</p>
                    <p className="text-lg font-black text-cyan-700 font-mono">SB-2024-0012</p>
                  </div>
                  <p className="text-sm font-bold text-slate-500 mt-2">Date: {new Date().toLocaleDateString()}</p>
                </div>
              </div>

              {/* Patient & Insurance */}
              <div className="grid grid-cols-2 gap-6 mb-10">
                <div className="p-5 bg-slate-50 rounded-xl border border-slate-100">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Patient Details</h4>
                  <p className="font-black text-slate-900 text-lg mb-1">John Smith</p>
                  <p className="text-sm font-medium text-slate-600">DOB: 03/15/1979 • MRN: <span className="font-bold text-slate-800">PT12345</span></p>
                  <p className="text-sm font-medium text-slate-600">456 Main St, CA 90210</p>
                </div>
                <div className="p-5 bg-slate-50 rounded-xl border border-slate-100">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Coverage Info</h4>
                  <p className="font-bold text-slate-900 text-lg mb-1">Blue Cross Blue Shield</p>
                  <p className="text-sm font-medium text-slate-600">ID: BCBS-123456789</p>
                  <p className="text-sm font-medium text-slate-600">Group: GRP-456</p>
                </div>
              </div>

              {/* Services Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden mb-8">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {["DOS", "CPT/HCPCS", "Description", "ICD-10", "Qty", "Fee"].map((h) => (
                        <th key={h} className="px-5 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {[
                      { dos: "02/20/24", cpt: "99214", desc: "Office Visit, Est. Patient", icd: "I10, E11.9", units: 1, fee: 250 },
                      { dos: "02/20/24", cpt: "93000", desc: "Electrocardiogram, routine", icd: "I10", units: 1, fee: 85 },
                    ].map((row, i) => (
                      <tr key={i}>
                        <td className="px-5 py-4 font-medium text-slate-600">{row.dos}</td>
                        <td className="px-5 py-4 font-mono font-bold text-violet-600">{row.cpt}</td>
                        <td className="px-5 py-4 font-semibold text-slate-800">{row.desc}</td>
                        <td className="px-5 py-4 font-mono text-xs font-bold text-cyan-600">{row.icd}</td>
                        <td className="px-5 py-4 font-medium text-slate-600">{row.units}</td>
                        <td className="px-5 py-4 font-bold text-slate-900">${row.fee.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="bg-slate-50 p-5 px-6 border-t border-slate-200 flex justify-between items-center">
                  <p className="font-bold text-slate-600 uppercase tracking-widest text-xs">Total Amount Due</p>
                  <p className="font-black text-2xl text-slate-900">$335.00</p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-cyan-50/50 p-4 rounded-xl border border-cyan-100">
                <div className="flex flex-col gap-1 w-full pl-2">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Provider Signature Validation</h4>
                  <p className="text-sm font-bold text-cyan-900">Dr. Sarah Chen, MD <span className="font-normal text-cyan-700 mx-2">•</span> Electronically signed <span className="font-normal text-cyan-700 mx-2">•</span> {new Date().toLocaleDateString()}</p>
                </div>
                <div className="w-12 h-12 bg-white rounded-lg border border-cyan-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <ShieldCheck className="w-6 h-6 text-cyan-500" />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* AR Aging Tab */}
        {activeTab === "ar" && (
          <motion.div key="ar" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              {[
                { bucket: "0-30 Days", val: 640 },
                { bucket: "31-60 Days", val: 300 },
                { bucket: "61-90 Days", val: 800 },
                { bucket: "90+ Days (Critical)", val: 1100, color: "text-rose-600 bg-rose-50 border-rose-200" },
              ].map((b) => (
                <div key={b.bucket} className={cn("bg-white border text-center p-5 rounded-2xl shadow-sm", b.color || "border-slate-200")}>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">{b.bucket}</p>
                  <p className={cn("text-2xl font-black", b.color ? b.color.split(" ")[0] : "text-slate-900")}>${b.val.toLocaleString()}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-lg">Detailed Aging Report</h3>
                <div className="flex gap-2">
                  <Button variant="outline" className="gap-2 font-semibold shadow-sm"><Download className="w-4 h-4"/> CSV Export</Button>
                  <Button className="bg-slate-900 hover:bg-slate-800 text-white font-bold gap-2 shadow-md"><RefreshCw className="w-4 h-4"/> Sync Payer Data</Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {["Claim #", "Patient", "Payer", "DOS", "Total Billed", "Expected", "Paid", "Balance", "Bucket", "Status"].map((h) => (
                        <th key={h} className="px-5 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {INITIAL_AR.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-4 font-mono text-xs font-bold text-cyan-600">{item.claimNumber}</td>
                        <td className="px-5 py-4 font-bold text-slate-800">{item.patientName}</td>
                        <td className="px-5 py-4 font-semibold text-slate-600">{item.insurance}</td>
                        <td className="px-5 py-4 font-medium text-slate-500">{item.dos}</td>
                        <td className="px-5 py-4 font-bold text-slate-900">${item.billed.toLocaleString()}</td>
                        <td className="px-5 py-4 font-semibold text-slate-500">${item.allowed.toLocaleString()}</td>
                        <td className="px-5 py-4 font-bold text-emerald-600">${item.paid.toLocaleString()}</td>
                        <td className="px-5 py-4 font-black text-rose-600">${item.balance.toLocaleString()}</td>
                        <td className="px-5 py-4">
                          <span className={cn("px-2.5 py-1 rounded-md text-[10px] uppercase font-black tracking-wider", 
                            item.aging === "0-30" ? "bg-emerald-50 text-emerald-700" :
                            item.aging === "31-60" ? "bg-amber-50 text-amber-700" :
                            item.aging === "61-90" ? "bg-orange-50 text-orange-700" : "bg-rose-50 text-rose-700"
                          )}>
                            {item.aging}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-between gap-4">
                            <span className="font-bold text-[11px] uppercase tracking-wider text-slate-600">{item.status}</span>
                            {item.aging === "90+" && <Button size="sm" variant="outline" className="h-7 text-xs font-bold text-rose-600 border-rose-200 hover:bg-rose-50">Collections</Button>}
                            {item.aging === "61-90" && <Button size="sm" variant="outline" className="h-7 text-xs font-bold text-amber-600 border-amber-200 hover:bg-amber-50">Appeal</Button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

      </div>
    </div>
  );
}
