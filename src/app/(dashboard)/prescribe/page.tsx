"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AIPrescriptionWriter } from "@/components/prescription/AIPrescriptionWriter";
import { MedGeminiPrescriptionPanel } from "@/components/prescription/MedGeminiPrescriptionPanel";
import {
  Pill, User, ChevronRight, Clock, FileText,
  AlertCircle, CheckCircle, History, AlertTriangle,
  RefreshCw, Search, X, ShieldAlert, Zap, Plus,
  ChevronDown, FlaskConical, Printer, Send, Eye,
  CalendarClock, BarChart3, Info, Star
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────
interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: "major" | "moderate" | "minor";
  description: string;
  recommendation: string;
}

interface RefillRequest {
  id: string;
  patientName: string;
  patientId: string;
  medication: string;
  dose: string;
  lastFilled: string;
  daysSupply: number;
  refillsRemaining: number;
  pharmacy: string;
  status: "pending" | "approved" | "denied" | "sent";
  requestedAt: string;
  provider: string;
}

interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  mrn: string;
  allergies: string[];
  currentMedications: string[];
  lastVisit: string;
}

// ── Mock Data ──────────────────────────────────────────────────────────────────
const MOCK_PATIENTS: Patient[] = [
  {
    id: "p-123",
    name: "John Smith",
    age: 45,
    gender: "Male",
    mrn: "MRN2024001",
    allergies: ["Penicillin", "Sulfa"],
    currentMedications: ["Lisinopril 10mg", "Metformin 500mg", "Amlodipine 5mg"],
    lastVisit: "2024-01-15",
  },
  {
    id: "p-456",
    name: "Sarah Johnson",
    age: 32,
    gender: "Female",
    mrn: "MRN2024002",
    allergies: ["Aspirin"],
    currentMedications: ["Levothyroxine 50mcg", "Warfarin 5mg"],
    lastVisit: "2024-01-20",
  },
];

const MOCK_INTERACTIONS: DrugInteraction[] = [
  {
    drug1: "Lisinopril",
    drug2: "Potassium Supplement",
    severity: "moderate",
    description: "ACE inhibitors like Lisinopril can increase potassium levels. Combined use may cause hyperkalemia.",
    recommendation: "Monitor potassium levels closely. Consider alternative or dose adjustment.",
  },
  {
    drug1: "Metformin",
    drug2: "Alcohol",
    severity: "major",
    description: "Combined use increases risk of lactic acidosis, a rare but serious condition.",
    recommendation: "Advise patient to avoid alcohol. Discontinue if signs of lactic acidosis develop.",
  },
  {
    drug1: "Amlodipine",
    drug2: "Simvastatin",
    severity: "moderate",
    description: "Amlodipine can increase Simvastatin plasma levels, raising risk of myopathy.",
    recommendation: "Limit Simvastatin dose to 20mg/day when co-administered with Amlodipine.",
  },
];

const MOCK_REFILLS: RefillRequest[] = [
  {
    id: "rf-001",
    patientName: "John Smith",
    patientId: "PT12345",
    medication: "Lisinopril",
    dose: "10mg daily",
    lastFilled: "2024-01-15",
    daysSupply: 30,
    refillsRemaining: 2,
    pharmacy: "CVS Pharmacy #4521",
    status: "pending",
    requestedAt: "Today 08:32 AM",
    provider: "Dr. Sarah Chen",
  },
  {
    id: "rf-002",
    patientName: "Maria Garcia",
    patientId: "PT12346",
    medication: "Metformin",
    dose: "500mg twice daily",
    lastFilled: "2024-01-20",
    daysSupply: 30,
    refillsRemaining: 4,
    pharmacy: "Walgreens #2210",
    status: "pending",
    requestedAt: "Today 09:15 AM",
    provider: "Dr. Michael Ross",
  },
  {
    id: "rf-003",
    patientName: "Robert Johnson",
    patientId: "PT12347",
    medication: "Warfarin",
    dose: "5mg daily",
    lastFilled: "2024-01-10",
    daysSupply: 30,
    refillsRemaining: 0,
    pharmacy: "Rite Aid #1122",
    status: "approved",
    requestedAt: "Yesterday 03:45 PM",
    provider: "Dr. James Wilson",
  },
  {
    id: "rf-004",
    patientName: "Emma Thompson",
    patientId: "PT12348",
    medication: "Atorvastatin",
    dose: "20mg nightly",
    lastFilled: "2024-01-05",
    daysSupply: 90,
    refillsRemaining: 1,
    pharmacy: "CVS Pharmacy #4521",
    status: "sent",
    requestedAt: "Yesterday 01:20 PM",
    provider: "Dr. Sarah Chen",
  },
];

const MOCK_PRESCRIPTION_HISTORY = [
  {
    id: "rx-001",
    rxNumber: "RX2024001",
    date: "2024-01-15",
    medications: ["Lisinopril 10mg", "Amlodipine 5mg"],
    status: "ACTIVE",
    diagnosis: "Hypertension",
  },
  {
    id: "rx-002",
    rxNumber: "RX2024002",
    date: "2024-01-10",
    medications: ["Amoxicillin 500mg"],
    status: "COMPLETED",
    diagnosis: "Bacterial Infection",
  },
];

// ── Drug Interaction Alert ─────────────────────────────────────────────────────
function InteractionAlert({ interaction }: { interaction: DrugInteraction }) {
  const [expanded, setExpanded] = useState(false);
  const severityStyle = {
    major: "bg-rose-50 border-rose-300 text-rose-800",
    moderate: "bg-amber-50 border-amber-300 text-amber-800",
    minor: "bg-blue-50 border-blue-200 text-blue-700",
  };
  const sevIcon = {
    major: <ShieldAlert className="w-4 h-4 text-rose-500 flex-shrink-0" />,
    moderate: <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />,
    minor: <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />,
  };

  return (
    <div className={cn("rounded-xl border p-3 text-sm transition-all", severityStyle[interaction.severity])}>
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {sevIcon[interaction.severity]}
        <span className="font-semibold">{interaction.drug1}</span>
        <span className="opacity-60">+</span>
        <span className="font-semibold">{interaction.drug2}</span>
        <Badge className={cn(
          "ml-auto text-[10px] capitalize",
          interaction.severity === "major" ? "bg-rose-200 text-rose-800" :
          interaction.severity === "moderate" ? "bg-amber-200 text-amber-800" :
          "bg-blue-200 text-blue-800"
        )}>
          {interaction.severity}
        </Badge>
        <ChevronDown className={cn("w-4 h-4 transition-transform", expanded && "rotate-180")} />
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 pt-2 border-t border-current/20 space-y-1">
              <p className="opacity-80">{interaction.description}</p>
              <p className="font-medium flex items-start gap-1">
                <CheckCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                {interaction.recommendation}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Refill Queue Row ───────────────────────────────────────────────────────────
function RefillRow({ refill, onUpdate }: { refill: RefillRequest; onUpdate: (id: string, status: RefillRequest["status"]) => void }) {
  const statusStyle: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    denied: "bg-rose-50 text-rose-700 border-rose-200",
    sent: "bg-blue-50 text-blue-700 border-blue-200",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 bg-white rounded-xl border border-slate-200 hover:border-cyan-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-50 to-violet-50 border border-slate-200 flex items-center justify-center">
            <Pill className="w-5 h-5 text-cyan-500" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-900">{refill.medication}</span>
              <span className="text-slate-500 text-sm">{refill.dose}</span>
              {refill.refillsRemaining === 0 && (
                <Badge className="bg-rose-100 text-rose-700 text-[10px]">No Refills Left</Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
              <span className="flex items-center gap-1"><User className="w-3 h-3" /> {refill.patientName} ({refill.patientId})</span>
              <span className="flex items-center gap-1"><FlaskConical className="w-3 h-3" /> {refill.pharmacy}</span>
              <span className="flex items-center gap-1"><CalendarClock className="w-3 h-3" /> Requested {refill.requestedAt}</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{refill.refillsRemaining} refills remaining • {refill.daysSupply}d supply • Last filled {refill.lastFilled}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <Badge variant="outline" className={statusStyle[refill.status]}>
            {refill.status.charAt(0).toUpperCase() + refill.status.slice(1)}
          </Badge>
          {refill.status === "pending" && (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => onUpdate(refill.id, "approved")} className="bg-emerald-500 hover:bg-emerald-600 text-white h-7 text-xs gap-1">
                <CheckCircle className="w-3 h-3" /> Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => onUpdate(refill.id, "denied")} className="border-rose-300 text-rose-600 hover:bg-rose-50 h-7 text-xs gap-1">
                <X className="w-3 h-3" /> Deny
              </Button>
            </div>
          )}
          {refill.status === "approved" && (
            <Button size="sm" onClick={() => onUpdate(refill.id, "sent")} className="bg-cyan-500 hover:bg-cyan-600 text-white h-7 text-xs gap-1">
              <Send className="w-3 h-3" /> Send to Pharmacy
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function PrescribePage() {
  const searchParams = useSearchParams();
  const patientId = searchParams.get("patientId") || "p-123";

  const [selectedPatient, setSelectedPatient] = useState(MOCK_PATIENTS[0]);
  const [activeTab, setActiveTab] = useState<"medgemini" | "new" | "interactions" | "refills" | "history">("medgemini");
  const [prescriptionHistory, setPrescriptionHistory] = useState(MOCK_PRESCRIPTION_HISTORY);
  const [showSuccess, setShowSuccess] = useState(false);
  const [interactions, setInteractions] = useState(MOCK_INTERACTIONS);
  const [refills, setRefills] = useState(MOCK_REFILLS);
  const [refillSearch, setRefillSearch] = useState("");
  const [checkingInteractions, setCheckingInteractions] = useState(false);

  useEffect(() => {
    const patient = MOCK_PATIENTS.find((p) => p.id === patientId);
    if (patient) setSelectedPatient(patient);
  }, [patientId]);

  const handlePrescriptionSaved = (prescription: any) => {
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
    setPrescriptionHistory((prev) => [{
      id: prescription.id,
      rxNumber: prescription.rxNumber,
      date: new Date().toISOString().split("T")[0],
      medications: prescription.items.map((item: any) => item.medicationName || "Medication"),
      status: "ACTIVE",
      diagnosis: prescription.diagnosis,
    }, ...prev]);
  };

  const handleRunInteractionCheck = () => {
    setCheckingInteractions(true);
    setTimeout(() => setCheckingInteractions(false), 1500);
  };

  const handleRefillUpdate = (id: string, status: RefillRequest["status"]) => {
    setRefills((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
  };

  const filteredRefills = refills.filter((r) =>
    r.patientName.toLowerCase().includes(refillSearch.toLowerCase()) ||
    r.medication.toLowerCase().includes(refillSearch.toLowerCase())
  );

  const pendingCount = refills.filter((r) => r.status === "pending").length;
  const majorInteractions = interactions.filter((i) => i.severity === "major").length;

  const tabs = [
    { id: "medgemini", label: "Med-Gemini AI", icon: Zap, badge: undefined, badgeColor: "bg-violet-500", highlight: true },
    { id: "new", label: "New Rx", icon: Plus },
    { id: "interactions", label: "Drug Interactions", icon: ShieldAlert, badge: majorInteractions > 0 ? majorInteractions : undefined, badgeColor: "bg-rose-500" },
    { id: "refills", label: "Refill Queue", icon: RefreshCw, badge: pendingCount > 0 ? pendingCount : undefined, badgeColor: "bg-amber-500" },
    { id: "history", label: "Rx History", icon: History },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-6 right-6 z-50 bg-emerald-500 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3"
          >
            <CheckCircle className="w-5 h-5" />
            <div>
              <p className="font-semibold">Prescription Saved!</p>
              <p className="text-sm text-emerald-100">Sent to pharmacy successfully.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Pill className="w-7 h-7 text-cyan-500" />
              E-Prescribing
            </h1>
            <p className="text-slate-500 mt-1">AI-assisted prescriptions, drug interaction checker, and refill management</p>
          </div>

          {/* Patient Card */}
          <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white font-bold">
              {selectedPatient.name.split(" ").map((n) => n[0]).join("")}
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">{selectedPatient.name}</h3>
              <p className="text-xs text-slate-400">{selectedPatient.age}y • {selectedPatient.gender} • {selectedPatient.mrn}</p>
            </div>
            <div className="ml-4 pl-4 border-l border-slate-200 space-y-1">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                <span className="text-xs text-slate-600 font-medium">{selectedPatient.allergies.join(", ")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Pill className="w-4 h-4 text-cyan-400" />
                <span className="text-xs text-slate-500">{selectedPatient.currentMedications.length} active meds</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Active Medications", value: selectedPatient.currentMedications.length, color: "text-cyan-600", bg: "bg-cyan-50" },
            { label: "Known Allergies", value: selectedPatient.allergies.length, color: "text-rose-600", bg: "bg-rose-50" },
            { label: "Drug Interactions", value: interactions.length, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Pending Refills", value: pendingCount, color: "text-violet-600", bg: "bg-violet-50" },
          ].map((stat) => (
            <div key={stat.label} className={cn("rounded-xl p-4 border border-slate-200 bg-white")}>
              <p className={cn("text-2xl font-bold", stat.color)}>{stat.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-white p-1 rounded-xl border border-slate-200 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                activeTab === tab.id
                  ? (tab as any).highlight ? "bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-sm" : "bg-cyan-500 text-white shadow-sm"
                  : (tab as any).highlight ? "text-violet-600 hover:text-violet-700 hover:bg-violet-50 border border-violet-200" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {(tab as any).highlight && activeTab !== tab.id && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
              )}
              {tab.badge !== undefined && (
                <span className={cn("absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-white text-[10px] flex items-center justify-center font-bold", tab.badgeColor)}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === "medgemini" && (
            <motion.div key="medgemini" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <MedGeminiPrescriptionPanel
                patient={{
                  id: selectedPatient.id,
                  name: selectedPatient.name,
                  age: selectedPatient.age,
                  weight: 75,
                  gender: selectedPatient.gender,
                  allergies: selectedPatient.allergies,
                  currentMedications: selectedPatient.currentMedications,
                  labResults: {
                    eGFR: 72,
                    creatinine: 1.1,
                    A1c: 8.2,
                    potassium: 4.5,
                    ALT: 28,
                    AST: 32,
                  },
                  conditions: ["Type 2 Diabetes", "Hypertension", "Hyperlipidemia"],
                }}
                onPrescriptionSaved={handlePrescriptionSaved}
              />
            </motion.div>
          )}

          {activeTab === "new" && (
            <motion.div key="new" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <AIPrescriptionWriter
                patientId={selectedPatient.id}
                patientName={selectedPatient.name}
                onPrescriptionSaved={handlePrescriptionSaved}
              />
            </motion.div>
          )}

          {activeTab === "interactions" && (
            <motion.div key="interactions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-rose-500" />
                      Drug Interaction Checker
                    </h2>
                    <p className="text-sm text-slate-500">AI-powered cross-referencing against current medication list</p>
                  </div>
                  <Button onClick={handleRunInteractionCheck} disabled={checkingInteractions} className="gap-2 bg-cyan-500 hover:bg-cyan-600">
                    {checkingInteractions ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /> Checking...</>
                    ) : (
                      <><Zap className="w-4 h-4" /> Run Check</>
                    )}
                  </Button>
                </div>

                {/* Severity Summary */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {[
                    { sev: "major", count: interactions.filter((i) => i.severity === "major").length, color: "rose" },
                    { sev: "moderate", count: interactions.filter((i) => i.severity === "moderate").length, color: "amber" },
                    { sev: "minor", count: interactions.filter((i) => i.severity === "minor").length, color: "blue" },
                  ].map(({ sev, count, color }) => (
                    <div key={sev} className={`p-3 rounded-xl bg-${color}-50 border border-${color}-200 text-center`}>
                      <p className={`text-2xl font-bold text-${color}-600`}>{count}</p>
                      <p className={`text-xs capitalize text-${color}-700`}>{sev}</p>
                    </div>
                  ))}
                </div>

                {/* Current Meds */}
                <div className="mb-5">
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Current Medications ({selectedPatient.currentMedications.length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedPatient.currentMedications.map((med) => (
                      <span key={med} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium border border-slate-200">
                        {med}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Interactions */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-700">Detected Interactions</h4>
                  {interactions.map((interaction, i) => (
                    <InteractionAlert key={i} interaction={interaction} />
                  ))}
                  {interactions.length === 0 && (
                    <div className="p-8 text-center bg-emerald-50 rounded-xl border border-emerald-200">
                      <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                      <p className="font-semibold text-emerald-700">No interactions detected</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "refills" && (
            <motion.div key="refills" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <RefreshCw className="w-5 h-5 text-cyan-500" />
                      Refill Request Queue
                    </h2>
                    <p className="text-sm text-slate-500">{pendingCount} pending requests require your attention</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search refills..."
                        value={refillSearch}
                        onChange={(e) => setRefillSearch(e.target.value)}
                        className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                      />
                    </div>
                    <Button variant="outline" className="gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Approve All Pending
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {["pending", "approved", "sent", "denied"].map((group) => {
                    const groupItems = filteredRefills.filter((r) => r.status === group);
                    if (groupItems.length === 0) return null;
                    return (
                      <div key={group}>
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <span className={cn(
                            "w-2 h-2 rounded-full",
                            group === "pending" ? "bg-amber-500" :
                            group === "approved" ? "bg-emerald-500" :
                            group === "sent" ? "bg-blue-500" : "bg-rose-500"
                          )} />
                          {group} ({groupItems.length})
                        </h4>
                        <div className="space-y-2">
                          {groupItems.map((r) => (
                            <RefillRow key={r.id} refill={r} onUpdate={handleRefillUpdate} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {filteredRefills.length === 0 && (
                    <div className="p-8 text-center">
                      <RefreshCw className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500">No refill requests found</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "history" && (
            <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <History className="w-5 h-5 text-cyan-500" />
                  Prescription History ({prescriptionHistory.length})
                </h2>
                <div className="space-y-3">
                  {prescriptionHistory.map((rx, i) => (
                    <motion.div
                      key={rx.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="p-5 rounded-xl border border-slate-200 hover:border-cyan-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-50 to-violet-50 border border-slate-200 flex items-center justify-center">
                            <FileText className="w-6 h-6 text-cyan-500" />
                          </div>
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="font-bold text-slate-900">{rx.rxNumber}</h3>
                              <Badge className={rx.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600"}>
                                {rx.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-cyan-600 font-medium">{rx.diagnosis}</p>
                            <p className="text-sm text-slate-500 mt-1">{rx.medications.join(" • ")}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-slate-400">{rx.date}</p>
                          <Button size="sm" variant="outline" className="mt-2 gap-1 h-7 text-xs">
                            <Eye className="w-3 h-3" /> View
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
