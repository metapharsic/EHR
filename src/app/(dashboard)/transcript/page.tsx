"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Mic, FileText, GitBranch, Sparkles, 
  ChevronRight, Save, Download, User, Database,
  CheckCircle, Clock, AlertCircle, Loader2,
  Search, Filter, Calendar, Eye, Trash2,
  RefreshCw, Brain, Zap, FileCheck,
  Lock, Unlock, PenLine, Stethoscope, FlaskConical,
  ClipboardList, Target, MessageSquare, Hash, Printer,
  ChevronDown, ChevronUp, Shield, Star, X,
  MicOff, Radio, Wand2, BrainCircuit, UserCheck, Bot
} from "lucide-react";
import { PlainTranscriptNotes, ExtractedDemographics, ReportRequest } from "@/components/transcript/PlainTranscriptNotes";
import { ConversationFlowDiagram, FlowNode } from "@/components/transcript/ConversationFlowDiagram";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAutoDocument, AutoDocument } from "@/hooks/useAutoDocument";

// ── Ambient Listening Panel (Epic 1) ─────────────────────────────────────────
interface DiarizedLine { speaker: "DOCTOR" | "PATIENT"; text: string; ts: string; }

const SIMULATED_CONVERSATION: DiarizedLine[] = [
  { speaker: "DOCTOR",  text: "Good morning Raj, how are you feeling today?", ts: "00:04" },
  { speaker: "PATIENT", text: "Not great doctor, I've been having chest tightness since yesterday evening, especially when I walk up stairs.", ts: "00:09" },
  { speaker: "DOCTOR",  text: "Any shortness of breath or pain radiating to your arm or jaw?", ts: "00:16" },
  { speaker: "PATIENT", text: "A little breathless, yes. No arm pain though.", ts: "00:21" },
  { speaker: "DOCTOR",  text: "How long have you been diabetic, and are you on Metformin currently?", ts: "00:28" },
  { speaker: "PATIENT", text: "About 8 years. Yes, 500 milligrams twice daily.", ts: "00:33" },
  { speaker: "DOCTOR",  text: "Your recent creatinine was 2.1, which is elevated. I'll need to check your kidney function before adjusting anything.", ts: "00:42" },
  { speaker: "PATIENT", text: "Is that serious?", ts: "00:46" },
  { speaker: "DOCTOR",  text: "We'll keep a close eye on it. I'm also ordering an ECG and troponin given the chest tightness. Assessment is likely unstable angina pending workup.", ts: "00:58" },
];

const SYNTHESIZED_SOAP = {
  subjective: "45-year-old male presenting with chest tightness since yesterday evening, exacerbated on exertion (climbing stairs). Reports associated mild dyspnea. Denies radiation of pain to arm or jaw. History of Type 2 Diabetes Mellitus x8 years, on Metformin 500mg BD.",
  objective: "Vitals pending. Recent labs: Creatinine 2.1 mg/dL (elevated, eGFR ~35 mL/min/1.73m²). ECG ordered. Troponin I x2 ordered.",
  assessment: "1. Unstable Angina – new onset exertional chest tightness, high-intermediate risk.\n2. Type 2 Diabetes Mellitus (E11.9) – stable on Metformin, however Metformin use requires review given CKD Stage 3b.\n3. Chronic Kidney Disease Stage 3b (N18.3) – Creatinine 2.1, eGFR 35.",
  plan: "1. 12-lead ECG – STAT.\n2. Troponin I at 0h and 3h.\n3. Cardiology referral for stress echo.\n4. Hold Metformin pending nephrology review.\n5. Start Aspirin 325mg loading dose.\n6. Patient education on angina warning signs.\n7. Follow-up in 48 hours or ER if symptoms worsen.",
  icdCodes: [
    { code: "I20.0", description: "Unstable Angina" },
    { code: "E11.9", description: "Type 2 Diabetes Mellitus, without complications" },
    { code: "N18.3", description: "Chronic Kidney Disease, Stage 3b" },
  ],
};

function AmbientListeningPanel() {
  const [isListening, setIsListening] = useState(false);
  const [lineIndex, setLineIndex] = useState(0);
  const [visibleLines, setVisibleLines] = useState<DiarizedLine[]>([]);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [soap, setSoap] = useState<typeof SYNTHESIZED_SOAP | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const startListening = useCallback(() => {
    setIsListening(true);
    setVisibleLines([]);
    setLineIndex(0);
    setSoap(null);
  }, []);

  const stopListening = useCallback(() => {
    setIsListening(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    if (isListening) {
      intervalRef.current = setInterval(() => {
        setLineIndex(prev => {
          if (prev >= SIMULATED_CONVERSATION.length) {
            clearInterval(intervalRef.current!);
            setIsListening(false);
            return prev;
          }
          setVisibleLines(l => [...l, SIMULATED_CONVERSATION[prev]]);
          return prev + 1;
        });
      }, 2200);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isListening]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleLines]);

  const handleSynthesize = () => {
    setIsSynthesizing(true);
    setTimeout(() => {
      setIsSynthesizing(false);
      setSoap(SYNTHESIZED_SOAP);
    }, 3000);
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Left: Live Diarized Transcript */}
      <div className="bg-slate-900 rounded-2xl border border-slate-700/50 overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("w-3 h-3 rounded-full", isListening ? "bg-rose-500 animate-pulse" : "bg-slate-600")} />
            <h3 className="text-white font-bold">Live Ambient Stream</h3>
            {isListening && <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 text-[10px]">RECORDING</Badge>}
          </div>
          <button
            onClick={isListening ? stopListening : startListening}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all",
              isListening
                ? "bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30"
                : "bg-cyan-500 text-white hover:bg-cyan-600 shadow-lg shadow-cyan-500/25"
            )}
          >
            {isListening ? <><MicOff className="w-4 h-4"/>Stop</> : <><Mic className="w-4 h-4"/>Start Ambient Session</>}
          </button>
        </div>

        {/* Waveform */}
        {isListening && (
          <div className="flex items-center justify-center gap-0.5 py-3 px-5">
            {Array.from({length: 40}).map((_, i) => (
              <motion.div
                key={i}
                className="w-1 bg-cyan-400 rounded-full"
                animate={{ height: [4, Math.random() * 28 + 4, 4] }}
                transition={{ repeat: Infinity, duration: 0.6 + Math.random() * 0.4, delay: i * 0.04 }}
              />
            ))}
          </div>
        )}

        {/* Transcript Lines */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 min-h-[300px]">
          {visibleLines.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 py-12">
              <Radio className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">Press "Start Ambient Session" to begin passive background listening.</p>
              <p className="text-xs mt-1 text-slate-600">AI will distinguish doctor vs. patient voices automatically.</p>
            </div>
          ) : (
            visibleLines.map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("flex gap-3 items-start", line.speaker === "DOCTOR" ? "flex-row" : "flex-row-reverse")}
              >
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold",
                  line.speaker === "DOCTOR" ? "bg-cyan-500/20 text-cyan-400" : "bg-fuchsia-500/20 text-fuchsia-400"
                )}>
                  {line.speaker === "DOCTOR" ? <Stethoscope className="w-3.5 h-3.5"/> : <UserCheck className="w-3.5 h-3.5"/>}
                </div>
                <div className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                  line.speaker === "DOCTOR"
                    ? "bg-slate-800 text-slate-200 rounded-tl-sm"
                    : "bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-100 rounded-tr-sm"
                )}>
                  <p className={cn("text-[10px] font-semibold mb-1", line.speaker === "DOCTOR" ? "text-cyan-400" : "text-fuchsia-400")}>
                    {line.speaker === "DOCTOR" ? "Dr. Chen" : "Patient"} · {line.ts}
                  </p>
                  {line.text}
                </div>
              </motion.div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Synthesize CTA */}
        {!isListening && visibleLines.length > 0 && !soap && (
          <div className="p-4 border-t border-slate-800">
            <button
              onClick={handleSynthesize}
              disabled={isSynthesizing}
              className="w-full py-3 bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-70"
            >
              {isSynthesizing ? <><Loader2 className="w-4 h-4 animate-spin"/>Metta AI Synthesizing SOAP Note...</> : <><Wand2 className="w-4 h-4"/>One-Click: Synthesize SOAP Note + ICD-10 Codes</>}
            </button>
          </div>
        )}
      </div>

      {/* Right: Generated SOAP Note */}
      <div>
        {!soap ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-20 rounded-2xl border border-dashed border-slate-300 bg-slate-50">
            <BrainCircuit className="w-16 h-16 text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium">Zero-Click Charting</p>
            <p className="text-slate-400 text-sm mt-1 max-w-xs">Record the consultation, then press Synthesize. Metta AI auto-drafts the complete SOAP note and assigns billing codes.</p>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-fuchsia-50 to-cyan-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-fuchsia-500 to-cyan-500 rounded-xl">
                  <Wand2 className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">AI-Synthesized SOAP Note</h3>
                  <p className="text-xs text-slate-500">Generated from ambient session · {new Date().toLocaleTimeString()}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge className="bg-emerald-100 text-emerald-700">Draft</Badge>
                <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1 h-7 text-xs">
                  <Shield className="w-3 h-3"/> Sign Note
                </Button>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {[
                { label: "Subjective", content: soap.subjective, color: "blue" },
                { label: "Objective", content: soap.objective, color: "violet" },
                { label: "Assessment", content: soap.assessment, color: "amber" },
                { label: "Plan", content: soap.plan, color: "emerald" },
              ].map(s => (
                <div key={s.label} className="p-4">
                  <p className={`text-xs font-bold text-${s.color}-600 uppercase tracking-wider mb-2`}>{s.label}</p>
                  <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{s.content}</p>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Hash className="w-3.5 h-3.5 text-cyan-500"/>Auto-Assigned ICD-10 Billing Codes</p>
              <div className="space-y-2">
                {soap.icdCodes.map(c => (
                  <div key={c.code} className="flex items-center gap-3">
                    <span className="font-mono font-bold text-xs text-cyan-700 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded">{c.code}</span>
                    <span className="text-sm text-slate-700">{c.description}</span>
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500 ml-auto" />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// SOAP Note types
interface SOAPNote {
  id: string;
  patientName: string;
  patientId: string;
  date: string;
  provider: string;
  status: "draft" | "signed" | "locked" | "cosign_pending";
  signedAt?: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  icdCodes: { code: string; description: string }[];
  cptCodes: { code: string; description: string; units: number }[];
  attestation?: string;
}

const MOCK_SOAP: SOAPNote = {
  id: "soap-001",
  patientName: "John Smith",
  patientId: "PT12345",
  date: new Date().toLocaleDateString(),
  provider: "Dr. Sarah Chen",
  status: "draft",
  subjective: "Patient is a 45-year-old male presenting with chief complaint of chest pain for the past few days. Pain is described as pressure-like, located in the center of the chest, rated 6/10 in severity. Worsens with exertion and partially relieved with rest. Associated symptoms include shortness of breath on exertion, mild diaphoresis. Denies nausea, vomiting, palpitations, or syncope. No prior cardiac history. Non-smoker, occasional alcohol use.",
  objective: "Vital Signs: BP 138/88 mmHg, HR 74 bpm, RR 16, Temp 98.6°F, SpO2 98% on room air, Weight 185 lbs.\n\nGeneral: Alert, oriented x3, no acute distress.\nCardiovascular: Regular rate and rhythm, S1/S2 normal, no murmurs, gallops, or rubs.\nPulmonary: Clear to auscultation bilaterally, no wheezing or crackles.\nAbdomen: Soft, non-tender, non-distended.\nExtremities: No edema, peripheral pulses intact.\n\nECG: Normal sinus rhythm, no ST changes.\nChest X-Ray: No cardiomegaly, no pulmonary infiltrates.",
  assessment: "1. Chest pain - likely musculoskeletal vs. cardiac origin, requires further evaluation.\n2. Essential Hypertension (I10) - currently on Lisinopril, BP slightly elevated today.\n3. Type 2 Diabetes Mellitus (E11.9) - well controlled per recent HbA1c 7.2%.\n\nRisk Stratification: Low-intermediate risk for ACS based on HEART score 3/10.",
  plan: "1. Order stress echocardiogram to rule out cardiac cause of chest pain.\n2. Order troponin I x2 (0 and 3 hours), BMP, CBC with differential.\n3. Increase Lisinopril from 10mg to 20mg daily for better BP control.\n4. Continue current diabetic medications.\n5. Patient education: return to ED if chest pain worsens, radiates to arm/jaw, or is associated with diaphoresis.\n6. Follow-up in cardiology clinic within 1 week.\n7. Referral to nutritionist for dietary counseling.",
  icdCodes: [
    { code: "R07.9", description: "Chest pain, unspecified" },
    { code: "I10", description: "Essential Hypertension" },
    { code: "E11.9", description: "Type 2 Diabetes Mellitus without complications" },
  ],
  cptCodes: [
    { code: "99214", description: "Office Visit, Established Patient (25 min)", units: 1 },
    { code: "93000", description: "Electrocardiogram, routine", units: 1 },
    { code: "71046", description: "Chest X-ray, 2 views", units: 1 },
  ],
};

// SOAP Note Panel Component
function SOAPNotePanel() {
  const [note, setNote] = useState<SOAPNote>(MOCK_SOAP);
  const [isLocked, setIsLocked] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [attestationText, setAttestationText] = useState("");
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [editField, setEditField] = useState<keyof SOAPNote | null>(null);
  const [editValue, setEditValue] = useState("");

  const statusColors: Record<string, string> = {
    draft: "bg-amber-50 text-amber-700 border-amber-200",
    signed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    locked: "bg-slate-100 text-slate-700 border-slate-300",
    cosign_pending: "bg-blue-50 text-blue-700 border-blue-200",
  };

  const handleSign = () => {
    if (!attestationText.trim()) return;
    setNote(prev => ({
      ...prev,
      status: "signed",
      signedAt: new Date().toLocaleString(),
      attestation: attestationText,
    }));
    setIsLocked(false);
    setShowSignModal(false);
  };

  const handleLock = () => {
    setNote(prev => ({ ...prev, status: "locked" }));
    setIsLocked(true);
  };

  const handleEditStart = (field: keyof SOAPNote, value: string) => {
    if (isLocked || note.status === "locked") return;
    setEditField(field);
    setEditValue(value);
  };

  const handleEditSave = () => {
    if (!editField) return;
    setNote(prev => ({ ...prev, [editField]: editValue } as SOAPNote));
    setEditField(null);
  };

  const soapSections = [
    { key: "subjective" as keyof SOAPNote, label: "Subjective", icon: MessageSquare, color: "bg-blue-50 border-blue-200", textColor: "text-blue-700", hint: "Chief complaint, history of present illness, review of systems" },
    { key: "objective" as keyof SOAPNote, label: "Objective", icon: Stethoscope, color: "bg-violet-50 border-violet-200", textColor: "text-violet-700", hint: "Vital signs, physical exam, diagnostic results" },
    { key: "assessment" as keyof SOAPNote, label: "Assessment", icon: ClipboardList, color: "bg-amber-50 border-amber-200", textColor: "text-amber-700", hint: "Diagnoses, clinical impression, risk stratification" },
    { key: "plan" as keyof SOAPNote, label: "Plan", icon: Target, color: "bg-emerald-50 border-emerald-200", textColor: "text-emerald-700", hint: "Orders, prescriptions, referrals, patient education, follow-up" },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* SOAP Header */}
      <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
              <PenLine className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">SOAP Note</h2>
              <p className="text-xs text-slate-500">{note.patientName} ({note.patientId}) • {note.date} • {note.provider}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={statusColors[note.status]}>
              {note.status === "locked" && <Lock className="w-3 h-3 mr-1" />}
              {note.status === "signed" && <CheckCircle className="w-3 h-3 mr-1" />}
              {note.status.replace("_", " ").toUpperCase()}
            </Badge>
            {note.status === "signed" && !isLocked && (
              <Button size="sm" variant="outline" onClick={handleLock} className="gap-1 border-slate-300">
                <Lock className="w-3 h-3" /> Lock Note
              </Button>
            )}
            {note.status === "draft" && (
              <Button size="sm" onClick={() => setShowSignModal(true)} className="gap-1 bg-emerald-500 hover:bg-emerald-600 text-white">
                <Shield className="w-3 h-3" /> Sign Note
              </Button>
            )}
            <Button size="sm" variant="outline" className="gap-1">
              <Printer className="w-3 h-3" /> Print
            </Button>
            <Button size="sm" variant="outline" className="gap-1">
              <Download className="w-3 h-3" /> PDF
            </Button>
          </div>
        </div>
        {note.signedAt && (
          <div className="mt-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-sm text-emerald-700 flex items-start gap-2">
            <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>Signed by {note.provider} on {note.signedAt}. {note.attestation && `Attestation: "${note.attestation}"`}</span>
          </div>
        )}
      </div>

      {/* SOAP Sections */}
      <div className="divide-y divide-slate-100">
        {soapSections.map((section) => (
          <div key={section.key} className="p-5">
            <div
              className="flex items-center justify-between mb-3 cursor-pointer"
              onClick={() => setExpandedSection(expandedSection === section.key ? null : section.key)}
            >
              <div className="flex items-center gap-2">
                <span className={cn("w-7 h-7 rounded-lg flex items-center justify-center border", section.color)}>
                  <section.icon className={cn("w-4 h-4", section.textColor)} />
                </span>
                <h3 className="font-semibold text-slate-900">{section.label}</h3>
                <span className="text-xs text-slate-400 hidden md:block">{section.hint}</span>
              </div>
              <div className="flex items-center gap-2">
                {!isLocked && note.status !== "locked" && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEditStart(section.key, String(note[section.key])); }}
                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <PenLine className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                )}
                {expandedSection === section.key ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </div>

            {editField === section.key ? (
              <div className="space-y-2">
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  rows={6}
                  className="w-full p-3 border border-cyan-300 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 resize-y"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleEditSave} className="bg-cyan-500 hover:bg-cyan-600 text-white gap-1">
                    <Save className="w-3 h-3" /> Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditField(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div
                className={cn(
                  "text-sm text-slate-700 whitespace-pre-line leading-relaxed rounded-xl p-4 border",
                  section.color,
                  expandedSection === section.key ? "" : "line-clamp-3"
                )}
              >
                {String(note[section.key])}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ICD-10 & CPT Codes */}
      <div className="p-5 border-t border-slate-100 grid md:grid-cols-2 gap-6">
        <div>
          <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Hash className="w-4 h-4 text-cyan-500" /> ICD-10 Codes
            <Badge className="bg-cyan-50 text-cyan-600 text-[10px]">{note.icdCodes.length}</Badge>
          </h4>
          <div className="space-y-2">
            {note.icdCodes.map((code) => (
              <div key={code.code} className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="font-mono text-xs font-bold text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded">{code.code}</span>
                <span className="text-sm text-slate-700 flex-1">{code.description}</span>
              </div>
            ))}
            {!isLocked && (
              <button className="w-full p-2 border border-dashed border-slate-300 rounded-lg text-xs text-slate-400 hover:border-cyan-400 hover:text-cyan-500 transition-colors">
                + Add ICD-10 Code
              </button>
            )}
          </div>
        </div>
        <div>
          <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Hash className="w-4 h-4 text-violet-500" /> CPT Codes
            <Badge className="bg-violet-50 text-violet-600 text-[10px]">{note.cptCodes.length}</Badge>
          </h4>
          <div className="space-y-2">
            {note.cptCodes.map((code) => (
              <div key={code.code} className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="font-mono text-xs font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded">{code.code}</span>
                <span className="text-sm text-slate-700 flex-1">{code.description}</span>
                <span className="text-xs text-slate-400">x{code.units}</span>
              </div>
            ))}
            {!isLocked && (
              <button className="w-full p-2 border border-dashed border-slate-300 rounded-lg text-xs text-slate-400 hover:border-violet-400 hover:text-violet-500 transition-colors">
                + Add CPT Code
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sign Modal */}
      <AnimatePresence>
        {showSignModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowSignModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Sign Clinical Note</h3>
                  <p className="text-sm text-slate-500">This action will sign and attest the note</p>
                </div>
                <button onClick={() => setShowSignModal(false)} className="ml-auto p-1 hover:bg-slate-100 rounded">
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 mb-4">
                <p className="text-xs text-amber-700 font-medium">By signing, you attest that this note accurately reflects the patient encounter and was personally reviewed.</p>
              </div>
              <div className="mb-4">
                <label className="text-sm font-medium text-slate-700 block mb-2">Attestation Statement</label>
                <textarea
                  value={attestationText}
                  onChange={(e) => setAttestationText(e.target.value)}
                  placeholder="I have personally examined the patient and the note accurately reflects my clinical findings and plan..."
                  rows={3}
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                />
              </div>
              <div className="flex gap-3">
                <Button onClick={handleSign} disabled={!attestationText.trim()} className="flex-1 bg-emerald-500 hover:bg-emerald-600">
                  <Shield className="w-4 h-4 mr-2" /> Sign Note
                </Button>
                <Button variant="outline" onClick={() => setShowSignModal(false)}>Cancel</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function TranscriptPage() {
  const [activeTab, setActiveTab] = useState<"transcript" | "flow" | "both" | "documents" | "soap" | "ambient">("ambient");
  const [currentFlowNode, setCurrentFlowNode] = useState("demographics");
  const [completedNodes, setCompletedNodes] = useState<string[]>(["start"]);
  const [extractedData, setExtractedData] = useState<ExtractedDemographics | null>(null);
  const [pendingReports, setPendingReports] = useState<ReportRequest[]>([]);
  const [showRephrasePanel, setShowRephrasePanel] = useState(false);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<AutoDocument | null>(null);
  
  // Auto-document hook
  const { 
    documents, 
    isLoading, 
    fetchDocuments, 
    generateFromTranscript,
    updateDocument 
  } = useAutoDocument();

  // Load documents on mount
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleDemographicsExtracted = (demographics: ExtractedDemographics) => {
    setExtractedData(demographics);
    // Auto-advance flow
    if (!completedNodes.includes("demographics")) {
      setCompletedNodes(prev => [...prev, "demographics"]);
      setCurrentFlowNode("medical_history");
    }
  };

  const handleReportRequested = (request: ReportRequest) => {
    setPendingReports(prev => [...prev, request]);
  };

  const handleNodeClick = (node: FlowNode) => {
    setSelectedNode(node);
    if (node.rephraseOptions) {
      setShowRephrasePanel(true);
    }
  };

  const handleRephraseRequest = (node: FlowNode) => {
    setSelectedNode(node);
    setShowRephrasePanel(true);
  };

  const advanceFlow = (nodeId: string) => {
    if (!completedNodes.includes(nodeId)) {
      setCompletedNodes(prev => [...prev, nodeId]);
    }
    // Determine next node
    const flowOrder = ["demographics", "medical_history", "symptoms", "diagnosis", "plan", "report"];
    const currentIndex = flowOrder.indexOf(nodeId);
    if (currentIndex < flowOrder.length - 1) {
      setCurrentFlowNode(flowOrder[currentIndex + 1]);
    }
  };

  // Handle save to database
  const handleSaveToDatabase = async () => {
    if (!extractedData) {
      alert("No data extracted yet. Please process a transcript first.");
      return;
    }

    setIsGenerating(true);
    try {
      // Mock transcript - in real app, this would come from the conversation
      const mockTranscript = `
Doctor: Good morning, how are you feeling today?
Patient: I've been having chest pain for the past few days.
Doctor: Can you describe the pain? Where is it located?
Patient: It's in the center of my chest, and it gets worse when I exercise.
Doctor: Any shortness of breath?
Patient: Yes, especially when climbing stairs.
      `.trim();

      const doc = await generateFromTranscript(
        "PT12345", // Mock patient ID
        mockTranscript,
        {
          demographics: extractedData,
          symptoms: { description: "Chest pain, shortness of breath" },
          diagnosis: { description: "Possible angina - pending ECG" },
        }
      );

      alert(`Document saved successfully! ID: ${doc.id}`);
      setActiveTab("documents");
    } catch (error) {
      alert("Failed to save document. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Get status badge color
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      GENERATED: "bg-blue-50 text-blue-600 border-blue-200",
      PENDING_REVIEW: "bg-amber-50 text-amber-600 border-amber-200",
      APPROVED: "bg-emerald-50 text-emerald-600 border-emerald-200",
      SENT: "bg-purple-50 text-purple-600 border-purple-200",
      ARCHIVED: "bg-slate-50 text-slate-600 border-slate-200",
    };
    return styles[status] || "bg-slate-50 text-slate-600";
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Mic className="w-6 h-6 text-cyan-500" />
              Voice Transcript & Auto-Documentation
            </h1>
            <p className="text-slate-500 mt-1">
              AI-powered transcript analysis with automatic clinical documentation
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Save to Database Button */}
            <Button
              onClick={handleSaveToDatabase}
              disabled={isGenerating || !extractedData}
              className="gap-2 bg-emerald-500 hover:bg-emerald-600"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Database className="w-4 h-4" />
              )}
              {isGenerating ? "Generating..." : "Save to Database"}
            </Button>

            <div className="flex bg-white rounded-xl p-1 border border-slate-200 shadow-sm">
              {[
                { id: "ambient",   label: "Ambient AI", icon: Mic },
                { id: "transcript", label: "Transcript", icon: FileText },
                { id: "both", label: "Split View", icon: GitBranch },
                { id: "flow", label: "Flow", icon: Sparkles },
                { id: "soap", label: "SOAP Note", icon: PenLine },
                { id: "documents", label: "Docs", icon: FileCheck, count: documents.length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all relative",
                    activeTab === tab.id
                      ? "bg-cyan-50 text-cyan-600 font-medium"
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {(tab as any).count > 0 && (
                    <span className="bg-cyan-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                      {(tab as any).count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* AI Status Banner */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 rounded-xl p-4 border border-cyan-200">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                Metta AI Auto-Documentation
                <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>
              </h3>
              <p className="text-sm text-slate-600">
                AI extracts demographics, symptoms, diagnoses, and generates clinical notes automatically.
                {documents.length > 0 && ` ${documents.length} document${documents.length !== 1 ? 's' : ''} saved.`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Zap className="w-4 h-4" />
                Configure
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        <div className={cn(
          "grid gap-6",
          activeTab === "both" ? "lg:grid-cols-2" : "grid-cols-1"
        )}>
          {/* Ambient AI Panel (Epic 1) */}
          {activeTab === "ambient" && (
            <motion.div
              key="ambient"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-2"
            >
              <AmbientListeningPanel />
            </motion.div>
          )}

          {/* Transcript Panel */}
          {(activeTab === "transcript" || activeTab === "both") && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={activeTab === "both" ? "lg:col-span-1" : "max-w-4xl mx-auto w-full"}
            >
              <PlainTranscriptNotes
                onDemographicsExtracted={handleDemographicsExtracted}
                onReportRequested={handleReportRequested}
              />
            </motion.div>
          )}

          {/* Flow Diagram Panel */}
          {(activeTab === "flow" || activeTab === "both") && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={activeTab === "both" ? "lg:col-span-1" : "max-w-4xl mx-auto w-full"}
            >
              <ConversationFlowDiagram
                currentNodeId={currentFlowNode}
                completedNodes={completedNodes}
                onNodeClick={handleNodeClick}
                onRephraseRequest={handleRephraseRequest}
              />

              {/* Quick Actions */}
              <div className="mt-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => advanceFlow(currentFlowNode)}
                  >
                    <ChevronRight className="w-4 h-4 mr-1" />
                    Mark Complete
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleSaveToDatabase}
                    disabled={isGenerating || !extractedData}
                    className="bg-emerald-50 border-emerald-200 hover:bg-emerald-100 text-emerald-700"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Database className="w-4 h-4 mr-1" />
                    )}
                    Save to DB
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* SOAP Note Panel */}
          {activeTab === "soap" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-2"
            >
              <SOAPNotePanel />
            </motion.div>
          )}

          {/* Documents Panel */}
          {activeTab === "documents" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-2"
            >
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <FileCheck className="w-6 h-6 text-cyan-500" />
                        Auto-Generated Documents
                      </h2>
                      <p className="text-slate-500 mt-1">
                        AI-generated clinical documents from voice transcripts
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => fetchDocuments()} className="gap-2">
                      <RefreshCw className="w-4 h-4" />
                      Refresh
                    </Button>
                  </div>
                </div>

                {isLoading ? (
                  <div className="p-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-cyan-500" />
                    <p className="text-slate-500">Loading documents...</p>
                  </div>
                ) : documents.length === 0 ? (
                  <div className="p-12 text-center">
                    <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">No documents yet</h3>
                    <p className="text-slate-500 mb-4">
                      Process a transcript and save to generate your first AI document
                    </p>
                    <Button onClick={() => setActiveTab("both")} className="bg-cyan-500 hover:bg-cyan-600">
                      Start Transcribing
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        onClick={() => setSelectedDocument(doc)}
                        className="p-6 hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center text-white">
                              <FileText className="w-6 h-6" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-slate-900">{doc.title}</h3>
                              <p className="text-sm text-slate-500 mt-1">
                                {doc.patient?.firstName} {doc.patient?.lastName} • {doc.patient?.mrn}
                              </p>
                              <div className="flex items-center gap-3 mt-2">
                                <Badge variant="outline" className={getStatusBadge(doc.status)}>
                                  {doc.status}
                                </Badge>
                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(doc.createdAt).toLocaleString()}
                                </span>
                                {doc.confidenceScore && (
                                  <span className="text-xs text-slate-400 flex items-center gap-1">
                                    <Brain className="w-3 h-3" />
                                    {(doc.confidenceScore * 100).toFixed(1)}% confidence
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Rephrase Panel Overlay */}
      {showRephrasePanel && selectedNode && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowRephrasePanel(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl border border-cyan-200 p-6 max-w-lg w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-cyan-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Rephrase Options</h3>
                <p className="text-sm text-slate-500">{selectedNode.label}</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              Use these suggested phrases to guide the conversation:
            </p>

            <div className="space-y-2">
              {selectedNode.rephraseOptions?.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    navigator.clipboard.writeText(option);
                    setShowRephrasePanel(false);
                  }}
                  className="w-full text-left p-3 bg-slate-50 hover:bg-cyan-50 
                           border border-slate-200 hover:border-cyan-300
                           rounded-lg transition-all group"
                >
                  <p className="text-sm text-slate-600 group-hover:text-cyan-700">{option}</p>
                </button>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-200 flex justify-end">
              <Button
                variant="outline"
                onClick={() => setShowRephrasePanel(false)}
              >
                Close
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
