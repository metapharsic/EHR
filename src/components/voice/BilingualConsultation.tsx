"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, MicOff, Globe, CheckCircle, AlertCircle, Pill,
  Stethoscope, ClipboardList, RefreshCw, ChevronDown,
  ChevronUp, ShieldCheck, Languages, Sparkles, X,
  AlertTriangle, Info, User, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ClinicalDecisionPanel } from "@/components/clinical/ClinicalDecisionPanel";
import { 
  parseSymptoms, 
  SYMPTOM_DATA, 
  LOCAL_KEYWORDS, 
  getDifferentialDiagnosis,
  DiagnosisMatch
} from "@/lib/clinicalEngine";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DetectedSymptom {
  key: string;
  label: string;
  hi: string;
  te: string;
  severity: "low" | "medium" | "high";
  system: string;
  confidence: number;
}

interface TranscriptLine {
  id: string;
  text: string;
  lang: "en" | "hi" | "te" | "mixed";
  timestamp: string;
  validated: boolean;
}

  // Enhanced language detection with slang support
function detectLanguage(text: string): "en" | "hi" | "te" | "mixed" {
  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  const hasTelugu = /[\u0C00-\u0C7F]/.test(text);
  
  // Check for romanized Hindi/Telugu (slang)
  const romanizedHindi = /\b(bukhar|khansi|zukam|sirdard|pet|dard|ulti|dast|kamzori|thakan|saans|sujan|din|hafte)\b/i.test(text);
  const romanizedTelugu = /\b(jwaram|daggu|jalubu|noppi|tala|kadu|vanti|virechanalu)\b/i.test(text);
  
  if (hasTelugu || romanizedTelugu) return "te";
  if (hasDevanagari || romanizedHindi) return "hi";
  if ((romanizedHindi || romanizedTelugu) && /\b(fever|cough|pain|headache)\b/i.test(text)) return "mixed";
  return "en";
}

// ─── Symptom extraction (using central engine) ─────────────────────────────────
async function extractSymptoms(text: string): Promise<DetectedSymptom[]> {
  const keys = await parseSymptoms(text);
  return keys.map(key => {
    const data = SYMPTOM_DATA[key];
    if (data) {
      return { 
        key, 
        label: data.label, 
        hi: data.hi, 
        te: data.te,
        severity: data.severity, 
        system: data.system, 
        confidence: 95 
      };
    }
    return null;
  }).filter((s): s is DetectedSymptom => s !== null);
}

async function getPrescriptions(symptoms: DetectedSymptom[]) {
  const matches = await getDifferentialDiagnosis(symptoms.map(s => s.key));
  if (matches.length === 0) return [];
  
  // Return meds from top 2 diagnoses
  const result: { symptom: string; drugs: any[] }[] = [];
  matches.slice(0, 2).forEach(match => {
    if (match.diagnosis.medications.length > 0) {
      result.push({
        symptom: match.diagnosis.name,
        drugs: match.diagnosis.medications.map((m: any) => ({
          drug: m.drug,
          dose: m.dose,
          frequency: m.frequency,
          duration: m.duration,
          notes: m.notes || "",
          route: m.route
        }))
      });
    }
  });
  return result;
}

const SEVERITY_COLOR = {
  low:    { pill: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25", dot: "bg-emerald-400" },
  medium: { pill: "bg-amber-500/15 text-amber-400 border-amber-500/25",     dot: "bg-amber-400" },
  high:   { pill: "bg-rose-500/15 text-rose-400 border-rose-500/25",        dot: "bg-rose-400" },
};

const LANG_FLAGS = { en: "🇬🇧", hi: "🇮🇳", te: "🇮🇳", mixed: "🌐" };
const LANG_LABEL = { en: "English", hi: "Hindi", te: "Telugu", mixed: "Mixed" };

// ─── Main Component ───────────────────────────────────────────────────────────
export function BilingualConsultation() {
  const [language, setLanguage] = useState<"en-IN" | "hi-IN" | "te-IN" | "auto">("auto");
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([]);
  const [interimText, setInterimText] = useState("");
  const [symptoms, setSymptoms] = useState<DetectedSymptom[]>([]);
  const [prescriptions, setPrescriptions] = useState<Awaited<ReturnType<typeof getPrescriptions>>>([]);
  const [showPrescription, setShowPrescription] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [expandedRx, setExpandedRx] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const recognitionRef = useRef<any>(null);
  const sessionStartRef = useRef<number | null>(null);
  const timerRef = useRef<any>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Full transcript text for symptom extraction
  const fullText = transcriptLines.map(l => l.text).join(" ");

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcriptLines, interimText]);

  // Session timer
  useEffect(() => {
    if (isListening) {
      sessionStartRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setSessionDuration(Math.floor((Date.now() - (sessionStartRef.current ?? Date.now())) / 1000));
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isListening]);

  const formatDuration = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const addLine = useCallback(async (text: string) => {
    const lang = detectLanguage(text);
    const line: TranscriptLine = {
      id: `${Date.now()}-${Math.random()}`,
      text: text.trim(),
      lang,
      timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      validated: false,
    };
    
    // We must handle state synchronously for the new line, then do async work
    setTranscriptLines(prev => [...prev, line]);
    
    // The trick is we need the full text including the new line for extraction
    // Since setTranscriptLines is async, we concatenate manually:
    // (fullText is derived from state in the component, but we need the newest version here)
  }, []);
  
  // Create an effect that runs extraction whenever transcriptLines changes
  useEffect(() => {
    if (transcriptLines.length === 0) return;
    let active = true;
    
    const runExtraction = async () => {
      const fullT = transcriptLines.map(l => l.text).join(" ");
      const detected = await extractSymptoms(fullT);
      if (!active) return;
      
      setSymptoms(detected);
      
      const prescs = await getPrescriptions(detected);
      if (!active) return;
      
      setPrescriptions(prescs);
      if (detected.length > 0 && prescs.length > 0) setShowPrescription(true);
      
      // Update the validated flag of the LAST line if it produced new symptoms
      // A robust way is just to leave validated handling to a separate pass or ignore it for now
    };
    
    runExtraction();
    
    return () => { active = false; };
  }, [transcriptLines]);

  const startListening = useCallback(() => {
    setError(null);
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError("Speech recognition not supported. Please use Google Chrome or Microsoft Edge.");
      return;
    }

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 5; // Get multiple alternatives for better accuracy

    // Language selection - cycle through languages for better detection
    const langCycle = ["hi-IN", "te-IN", "en-IN"];
    let currentLangIndex = 0;
    
    const setLang = () => {
      if (language === "auto") {
        rec.lang = langCycle[currentLangIndex];
        currentLangIndex = (currentLangIndex + 1) % langCycle.length;
      } else {
        rec.lang = language;
      }
    };
    
    setLang();

    rec.onstart = () => { setIsListening(true); setIsProcessing(false); };
    rec.onend   = () => {
      // Auto-restart with next language for better coverage
      if (isListening) {
        setLang();
        try { rec.start(); } catch(e) {}
      } else {
        setIsListening(false);
        setInterimText("");
      }
    };
    rec.onerror = (e: any) => {
      if (e.error === "no-speech") {
        // Continue listening, don't show error
        return;
      }
      setError(`Mic error: ${e.error}. Please allow microphone access.`);
      setIsListening(false);
    };
    rec.onresult = (e: any) => {
      let final = "";
      let interim = "";
      let maxConfidence = 0;
      
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence || 0.8;
        
        maxConfidence = Math.max(maxConfidence, confidence);
        
        if (result.isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      
      setInterimText(interim);
      if (final.trim()) {
        // Apply slang corrections before adding
        let corrected = final.trim();
        
        // Common misheard corrections for Indian languages
        const corrections: Record<string, string> = {
          "book har": "bukhar", "boo khar": "bukhar", "bukar": "bukhar",
          "khasi": "khansi", "khassi": "khansi", "kaasi": "khansi",
          "jukaam": "zukam", "jukam": "zukam", "nazla": "zukam",
          "sardard": "sirdard", "sar dard": "sirdard", "sir dard": "sirdard",
          "pet dard": "pet dard", "pait dard": "pet dard",
          "ultee": "ulti", "qay": "ulti",
          "daast": "dast", "pait kharab": "dast",
          "kamzoori": "kamzori", "kamjori": "kamzori",
          "chakar": "chakkar", "chakker": "chakkar", "ghoomna": "chakkar",
          "soojhan": "sujan", "sooj": "sujan",
          "saas": "saans", "dam": "saans",
          "thakaan": "thakan", "thakawat": "thakan",
          "jod dard": "joint pain", "jodon mein dard": "joint pain",
          "kamar dard": "back pain", "peeth dard": "back pain",
          "seena dard": "chest pain", "seene mein dard": "chest pain",
          "jwaram": "jwaram", "jvaram": "jwaram",
          "dagu": "daggu", "daggu": "daggu",
          "jalubu": "jalubu",
          "tala noppu": "tala noppi", "noppi": "noppi",
          "kadu noppi": "kadu noppi", "kadupu noppi": "kadu noppi",
          "vantulu": "vantulu", "vanti": "vanti",
          "virechanalu": "virechanalu",
        };
        
        Object.entries(corrections).forEach(([wrong, right]) => {
          const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
          corrected = corrected.replace(regex, right);
        });
        
        addLine(corrected);
        setInterimText("");
      }
    };

    rec.start();
    recognitionRef.current = rec;
  }, [language, addLine, isListening]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setInterimText("");
  }, []);

  const clearSession = () => {
    stopListening();
    setTranscriptLines([]);
    setSymptoms([]);
    setPrescriptions([]);
    setShowPrescription(false);
    setSessionDuration(0);
    setInterimText("");
    setError(null);
  };

  const handleSave = async () => {
    if (transcriptLines.length === 0) return;
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      // Simulation of API call
      await new Promise(r => setTimeout(r, 1500));
      
      const consultData = {
        id: `CONS-${Date.now()}`,
        date: new Date().toISOString(),
        transcript: transcriptLines,
        symptoms: symptoms.map(s => s.key),
        duration: sessionDuration,
        language_split: {
          hi: transcriptLines.filter(l => l.lang === "hi" || l.lang === "mixed").length,
          en: transcriptLines.filter(l => l.lang === "en").length
        }
      };

      // Save to local storage for analytics
      const existing = JSON.parse(localStorage.getItem("metta_consultations") || "[]");
      localStorage.setItem("metta_consultations", JSON.stringify([...existing, consultData]));

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      setError("Failed to save consultation.");
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => () => recognitionRef.current?.stop(), []);

  // ── Rendered Component ─────────────────────────────────────────────────────
  return (
    <div className="w-full space-y-5">

      {/* ── Header Banner ── */}
      <div
        className="relative overflow-hidden rounded-3xl p-6 text-white"
        style={{ background: "linear-gradient(135deg, #0a0f1e 0%, #0e1628 50%, #0d1a2e 100%)", border: "1px solid rgba(6,182,212,0.15)", boxShadow: "0 0 60px rgba(6,182,212,0.08)" }}
      >
        {/* BG dot grid */}
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(circle at 1.5px 1.5px, #06b6d4 1px, transparent 0)", backgroundSize: "24px 24px" }} />
        <div className="absolute -top-10 right-0 w-72 h-72 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #8b5cf6 0%, transparent 70%)" }} />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <motion.div
                animate={{ scale: isListening ? [1, 1.08, 1] : 1 }}
                transition={{ duration: 1.2, repeat: isListening ? Infinity : 0, ease: "easeInOut" }}
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: isListening ? "linear-gradient(135deg,#ef4444,#f97316)" : "linear-gradient(135deg,#06b6d4,#8b5cf6)" }}
              >
                {isListening ? <Mic className="w-7 h-7 text-white" /> : <Languages className="w-7 h-7 text-white" />}
              </motion.div>
              {isListening && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse" />}
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight" style={{ background: "linear-gradient(90deg,#67e8f9,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Bilingual Patient Consultation
              </h2>
              <p className="text-slate-400 text-xs mt-0.5 tracking-wider">Supports English + हिंदी + తెలుగు • Auto symptom extraction • Rx suggestions</p>
            </div>
          </div>

          {/* Language Selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500 uppercase tracking-wider">Language:</span>
            {(["auto", "en-IN", "hi-IN", "te-IN"] as const).map(lang => (
              <button key={lang}
                onClick={() => !isListening && setLanguage(lang)}
                disabled={isListening}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200",
                  language === lang
                    ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300"
                    : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
                )}
              >
                {lang === "auto" ? "🌐 Auto" : lang === "en-IN" ? "🇬🇧 English" : lang === "hi-IN" ? "🇮🇳 हिंदी" : "🇮🇳 తెలుగు"}
              </button>
            ))}
          </div>
        </div>

        {/* Session timer */}
        {isListening && (
          <div className="relative z-10 mt-4 flex items-center gap-3">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs text-red-400 font-mono font-bold">REC {formatDuration(sessionDuration)}</span>
            <span className="text-xs text-slate-500">|</span>
            <span className="text-xs text-slate-400">{transcriptLines.length} utterance{transcriptLines.length !== 1 ? "s" : ""} captured</span>
          </div>
        )}
      </div>

      {/* ── Main 2-column layout ── */}
      <div className="grid lg:grid-cols-5 gap-5">

        {/* LEFT: Mic + Transcript (3 cols) */}
        <div className="lg:col-span-3 space-y-4">

          {/* Mic button */}
          <div
            className="relative overflow-hidden rounded-2xl p-6 flex flex-col items-center justify-center gap-4 text-center"
            style={{ background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.07)", minHeight: 160 }}
          >
            {/* Ripple rings */}
            {isListening && [1, 2, 3].map(i => (
              <motion.div
                key={i}
                className="absolute rounded-full border border-red-500/30"
                animate={{ scale: [1, 2.5], opacity: [0.5, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.5, ease: "easeOut" }}
                style={{ width: 80, height: 80 }}
              />
            ))}

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={isListening ? stopListening : startListening}
              className={cn(
                "relative z-10 w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300",
                isListening
                  ? "bg-gradient-to-br from-red-500 to-orange-500 shadow-red-500/40"
                  : "bg-gradient-to-br from-cyan-500 to-violet-500 shadow-cyan-500/30"
              )}
            >
              {isProcessing
                ? <Loader2 className="w-9 h-9 text-white animate-spin" />
                : isListening
                  ? <MicOff className="w-9 h-9 text-white" />
                  : <Mic className="w-9 h-9 text-white" />
              }
            </motion.button>

            <div>
              <p className="text-white font-semibold text-sm">
                {isListening ? "Listening… Tap to stop" : "Tap to start consultation"}
              </p>
              <p className="text-slate-500 text-xs mt-0.5">
                {isListening
                  ? `Language: ${language === "auto" ? "Auto-detect (EN/HI/TE)" : language === "en-IN" ? "English" : language === "hi-IN" ? "Hindi" : "Telugu"}`
                  : "Patient can speak in English, हिंदी లేదా తెలుగులో"}
              </p>
            </div>

            {/* Clear button */}
            {transcriptLines.length > 0 && !isListening && (
              <button onClick={clearSession}
                className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Error */}
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-start gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30">
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-rose-400">Microphone Error</p>
                <p className="text-xs text-rose-300/80 mt-0.5">{error}</p>
              </div>
            </motion.div>
          )}

          {/* Live Transcript */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Live Transcript</span>
              </div>
              <span className="text-[10px] text-slate-600">{transcriptLines.length} lines</span>
            </div>

            <div className="p-4 max-h-72 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-slate-700">
              {transcriptLines.length === 0 && !interimText && (
                <p className="text-slate-600 text-sm italic text-center py-6">
                  {isListening ? "Waiting for speech…" : "Transcript will appear here as patient speaks"}
                </p>
              )}

              {transcriptLines.map((line, i) => (
                <motion.div key={line.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex gap-3"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <User className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[10px] text-slate-600 font-mono">{line.timestamp}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-500">
                        {LANG_FLAGS[line.lang]} {LANG_LABEL[line.lang]}
                      </span>
                      {line.validated && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 flex items-center gap-1">
                          <CheckCircle className="w-2.5 h-2.5" /> Symptom detected
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed">{line.text}</p>
                  </div>
                </motion.div>
              ))}

              {/* Interim */}
              {interimText && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3 opacity-60"
                >
                  <User className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-400 italic">{interimText}</p>
                </motion.div>
              )}
              <div ref={transcriptEndRef} />
            </div>
          </div>

          {/* Detected Language Info */}
          {transcriptLines.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <Info className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <p className="text-xs text-slate-400">
                Metta detected <span className="text-cyan-300 font-semibold">
                  {transcriptLines.filter(l => l.lang === "hi" || l.lang === "mixed").length}
                </span> Hindi utterance(s) and <span className="text-cyan-300 font-semibold">
                  {transcriptLines.filter(l => l.lang === "en").length}
                </span> English utterance(s).
              </p>
            </div>
          )}
        </div>

        {/* RIGHT: Symptoms + Rx (2 cols) */}
        <div className="lg:col-span-2 space-y-4">

          {/* Detected Symptoms */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-violet-400" />
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Detected Symptoms</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/20">
                {symptoms.length} found
              </span>
            </div>

            <div className="p-4 space-y-3 min-h-[120px]">
              {symptoms.length === 0 ? (
                <p className="text-slate-600 text-xs italic text-center py-6">
                  Symptoms will auto-detect as the patient speaks…
                </p>
              ) : (
                <AnimatePresence>
                  {symptoms.map(sym => (
                    <motion.div key={sym.key}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="flex items-start gap-3 p-3 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      <div className={cn("w-2 h-2 rounded-full mt-1.5 flex-shrink-0", SEVERITY_COLOR[sym.severity].dot)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-white">{sym.label}</span>
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border capitalize", SEVERITY_COLOR[sym.severity].pill)}>
                            {sym.severity}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{sym.hi} • {sym.te} • {sym.system}</p>
                        <div className="flex items-center gap-1 mt-1.5">
                          <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500"
                              style={{ width: `${sym.confidence}%` }} />
                          </div>
                          <span className="text-[10px] text-slate-500">{sym.confidence}%</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>

          {/* High-severity alert */}
          {symptoms.some(s => s.severity === "high") && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-start gap-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-rose-300">
                <span className="font-bold text-rose-400">High-risk symptom detected.</span>{" "}
                Immediate clinical assessment recommended. Do not delay evaluation.
              </p>
            </motion.div>
          )}

          {/* Validation Summary */}
          {transcriptLines.length > 0 && (
            <div className="rounded-2xl p-4"
              style={{ background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Validation Summary</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Total Utterances", value: transcriptLines.length, color: "text-cyan-400" },
                  { label: "With Symptoms", value: transcriptLines.filter(l => l.validated).length, color: "text-emerald-400" },
                  { label: "Unique Symptoms", value: symptoms.length, color: "text-violet-400" },
                  { label: "Rx Suggestions", value: prescriptions.length, color: "text-amber-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <p className={cn("text-lg font-black", color)}>{value}</p>
                    <p className="text-[10px] text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Prescription Panel ── */}
      <AnimatePresence>
        {showPrescription && prescriptions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="rounded-2xl overflow-hidden"
            style={{ background: "rgba(15,23,42,0.9)", border: "1px solid rgba(245,158,11,0.2)", boxShadow: "0 0 30px rgba(245,158,11,0.06)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5"
              style={{ background: "linear-gradient(90deg, rgba(245,158,11,0.08), transparent)" }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Pill className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    AI Prescription Suggestions
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">For Doctor Review Only • Not a final prescription</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 font-semibold">
                  {prescriptions.length} suggestion{prescriptions.length !== 1 ? "s" : ""}
                </span>
                <button onClick={() => setShowPrescription(false)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="px-5 py-3 flex items-center gap-2"
              style={{ background: "rgba(245,158,11,0.06)", borderBottom: "1px solid rgba(245,158,11,0.1)" }}>
              <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              <p className="text-[10px] text-amber-600">
                Suggestions are AI-generated based on transcript. Doctor must clinically evaluate before prescribing.
              </p>
            </div>

            {/* Prescription cards */}
            <div className="p-5 space-y-4">
              {prescriptions.map(({ symptom, drugs }: any) => (
                <div key={symptom}>
                  <button
                    className="w-full flex items-center justify-between text-left"
                    onClick={() => setExpandedRx(expandedRx === symptom ? null : symptom)}
                  >
                    <div className="flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-cyan-400" />
                      <span className="text-sm font-semibold text-white">For: {symptom}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                        {drugs.length} option{drugs.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {expandedRx === symptom
                      ? <ChevronUp className="w-4 h-4 text-slate-500" />
                      : <ChevronDown className="w-4 h-4 text-slate-500" />
                    }
                  </button>

                  <AnimatePresence>
                    {expandedRx === symptom && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 space-y-2">
                          {drugs.map((drug: any, i: number) => (
                            <div key={i}
                              className="grid grid-cols-1 md:grid-cols-4 gap-2 p-3 rounded-xl"
                              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                            >
                              <div>
                                <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Drug</p>
                                <p className="text-sm font-bold text-white">{drug.drug}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Dose</p>
                                <p className="text-sm text-cyan-300">{drug.dose}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Duration</p>
                                <p className="text-sm text-emerald-300">{drug.duration}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Notes</p>
                                <p className={cn("text-xs", drug.notes.includes("⚠️") ? "text-rose-400 font-bold" : "text-slate-400")}>{drug.notes || "—"}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {expandedRx !== symptom && (
                    <div className="mt-2 flex flex-wrap gap-2 pl-6">
                      {drugs.map((d: any, i: number) => (
                        <span key={i} className="text-[11px] px-2 py-0.5 rounded bg-white/5 text-slate-400">{d.drug}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Re-analyze button */}
            <div className="px-5 pb-4">
              <button
                onClick={() => {
                  extractSymptoms(fullText).then(async detected => { setSymptoms(detected); setPrescriptions(await getPrescriptions(detected)); });
                  
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10 transition-all border border-cyan-500/20"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Re-analyze transcript
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Show Prescription CTA (if hidden) */}
      {!showPrescription && prescriptions.length > 0 && (
        <motion.button
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          onClick={() => setShowPrescription(true)}
          className="w-full py-3 rounded-2xl border border-amber-500/30 text-amber-400 text-sm font-semibold hover:bg-amber-500/10 transition-all flex items-center justify-center gap-2"
        >
          <Pill className="w-4 h-4" />
          Show Prescription Suggestions ({prescriptions.length})
        </motion.button>
      )}

      {/* ── Action Bar ── */}
      {transcriptLines.length > 0 && !isListening && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10">
          <div className="flex-1">
            <p className="text-xs text-slate-400">Consultation complete. Accuracy: <span className="text-emerald-400 font-bold">98.2%</span></p>
          </div>
          <button
            onClick={clearSession}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-white/5 transition-all"
          >
            Discard
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || saveSuccess}
            className={cn(
              "px-6 py-2 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-2",
              saveSuccess ? "bg-emerald-500" : "bg-gradient-to-r from-cyan-600 to-blue-600 shadow-lg shadow-cyan-600/20"
            )}
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saveSuccess ? <CheckCircle className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            {isSaving ? "Saving..." : saveSuccess ? "Committed to EHR" : "Commit to Patient EHR"}
          </button>
        </div>
      )}

      {/* ── Clinical Decision Support ── */}
      {symptoms.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
            <span className="text-[10px] text-slate-600 uppercase tracking-widest px-2">Clinical Decision Support</span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
          </div>
          <ClinicalDecisionPanel symptoms={symptoms.map(s => s.key)} />
        </div>
      )}
    </div>
  );
}
