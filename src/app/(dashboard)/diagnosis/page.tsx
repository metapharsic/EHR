"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ClinicalDecisionPanel } from "@/components/clinical/ClinicalDecisionPanel";
import { parseSymptoms, LOCAL_KEYWORDS, SYMPTOM_DATA } from "@/lib/clinicalEngine";
import { Stethoscope, Plus, X, Search, Languages, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const COMMON_SYMPTOMS = [
  "fever","cough","headache","chest pain","breathlessness","nausea","vomiting",
  "diarrhea","fatigue","dizziness","abdominal pain","joint pain","rash","swelling",
  "back pain","sore throat","cold","wheezing","palpitations","weakness","weight loss",
  "polyuria","polydipsia","leg swelling","blurred vision","dysuria","heartburn","regurgitation",
];

// Reverse map: English keyword → all local aliases for display
const LOCAL_ALIAS_MAP: Record<string, string[]> = {};
for (const [local, eng] of Object.entries(LOCAL_KEYWORDS)) {
  if (!LOCAL_ALIAS_MAP[eng]) LOCAL_ALIAS_MAP[eng] = [];
  LOCAL_ALIAS_MAP[eng].push(local);
}

export default function DiagnosisPage() {
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [input, setInput]       = useState("");
  const [lastResolved, setLastResolved] = useState<{ raw: string; mapped: string[] } | null>(null);

  const [liveHint, setLiveHint] = useState<string[] | null>(null);

  useEffect(() => {
    const rawLower = input.trim().toLowerCase();
    if (!rawLower) {
      setLiveHint(null);
      return;
    }
    let active = true;
    const fetchHint = async () => {
      const parsed = await parseSymptoms(rawLower);
      if (!active) return;
      const directMatch = COMMON_SYMPTOMS.find(s => s.includes(rawLower) || rawLower.includes(s));
      const combined = Array.from(new Set([...parsed, ...(directMatch ? [directMatch] : [])]));
      setLiveHint(combined.length > 0 ? combined : null);
    };
    fetchHint();
    return () => { active = false; };
  }, [input]);

  const addSymptom = async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    // 1) Try to parse via the multilingual engine
    const parsed = await parseSymptoms(trimmed);
    // 2) Also check raw as English
    const rawLower = trimmed.toLowerCase();

    let toAdd: string[] = [];

    if (parsed.length > 0) {
      toAdd = parsed;
    } else if (COMMON_SYMPTOMS.some(s => s.includes(rawLower) || rawLower.includes(s))) {
      // fuzzy direct match
      toAdd = [rawLower];
    } else {
      // fallback: add as-is (user may have typed a valid English symptom not in COMMON_SYMPTOMS)
      toAdd = [rawLower];
    }

    const newOnes = toAdd.filter(s => !symptoms.includes(s));
    if (newOnes.length > 0) {
      setSymptoms(prev => [...prev, ...newOnes]);
      if (rawLower !== newOnes[0]) {
        setLastResolved({ raw: trimmed, mapped: newOnes });
        setTimeout(() => setLastResolved(null), 3500);
      }
    }
    setInput("");
  };

  const removeSymptom = (s: string) => setSymptoms(prev => prev.filter(x => x !== s));

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#06b6d4,#8b5cf6)" }}>
            <Stethoscope className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Clinical Decision Support</h1>
            <p className="text-slate-400 text-sm">Differential diagnosis • Lab tests • Imaging • Prescriptions</p>
          </div>
          {/* Multilingual badge */}
          <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full" 
            style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)" }}>
            <Languages className="w-4 h-4 text-violet-400" />
            <span className="text-xs font-semibold text-violet-300">Hindi • తెలుగు • English</span>
          </div>
        </div>

        {/* Symptom Entry */}
        <div className="rounded-2xl p-5 space-y-4"
          style={{ background: "rgba(10,15,30,0.9)", border: "1px solid rgba(6,182,212,0.15)" }}>

          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-bold text-slate-200">Enter Patient Symptoms</span>
            </div>
            <span className="text-[10px] text-slate-500">Type in English, हिन्दी, or తెలుగు</span>
          </div>

          {/* Text input */}
          <form onSubmit={e => { e.preventDefault(); addSymptom(input); }} className="flex gap-2">
            <div className="flex-1 relative">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder='e.g. "fever", "बुखार", "జ్వరం", "chest pain", "سینے میں درد"'
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-slate-600 outline-none pr-32"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
              />
              {/* Live hint badge */}
              <AnimatePresence>
                {liveHint && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: "rgba(6,182,212,0.2)", color: "#67e8f9", border: "1px solid rgba(6,182,212,0.3)" }}
                  >
                    → {liveHint.slice(0, 2).join(", ")}
                    {liveHint.length > 2 && ` +${liveHint.length - 2}`}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <button type="submit"
              className="px-4 py-3 rounded-xl text-sm font-semibold text-white transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg,#06b6d4,#8b5cf6)" }}>
              <Plus className="w-4 h-4" />
            </button>
          </form>

          {/* Translation resolved toast */}
          <AnimatePresence>
            {lastResolved && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)" }}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span className="text-xs text-emerald-300">
                  <span className="font-bold">"{lastResolved.raw}"</span> recognised →{" "}
                  <span className="font-bold">{lastResolved.mapped.join(", ")}</span> added
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Multilingual quick-add hints */}
          <div className="grid grid-cols-1 gap-3">
            {/* Common symptoms */}
            <div>
              <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-2">Quick add (click):</p>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_SYMPTOMS.filter(s => !symptoms.includes(s)).map(s => (
                  <button key={s} onClick={() => addSymptom(s)}
                    className="text-xs px-2.5 py-1 rounded-lg border border-white/10 text-slate-400 hover:border-cyan-500/40 hover:text-cyan-300 hover:bg-cyan-500/10 transition-all">
                    + {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Language guide */}
            <div className="rounded-xl p-3" style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.12)" }}>
              <div className="flex items-center gap-2 mb-2">
                <Languages className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-[10px] text-violet-400 font-semibold uppercase tracking-wider">Multilingual Examples</span>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                {[
                  { hi: "बुखार", te: "జ్వరం", en: "fever" },
                  { hi: "खांसी", te: "దగ్గు", en: "cough" },
                  { hi: "छाती में दर्द", te: "గుండె నొప్పి", en: "chest pain" },
                  { hi: "सिरदर्द", te: "తల నొప్పి", en: "headache" },
                  { hi: "सांस फूलना", te: "ఆయాసం", en: "breathlessness" },
                  { hi: "उल्टी", te: "వాంతులు", en: "vomiting" },
                  { hi: "दस्त", te: "విరేచనాలు", en: "diarrhea" },
                  { hi: "चक्कर", te: "కళ్ళు తిరగడం", en: "dizziness" },
                ].map(row => (
                  <button
                    key={row.en}
                    onClick={() => addSymptom(row.en)}
                    disabled={symptoms.includes(row.en)}
                    className={cn(
                      "flex items-center gap-2 text-left py-0.5 transition-all",
                      symptoms.includes(row.en) ? "opacity-30 cursor-default" : "hover:opacity-80"
                    )}
                  >
                    <span className="text-[10px] text-violet-300 font-semibold w-20 flex-shrink-0">{row.hi}</span>
                    <span className="text-[10px] text-violet-200 w-24 flex-shrink-0">{row.te}</span>
                    <span className="text-[10px] text-slate-500">→ {row.en}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Active symptoms */}
          {symptoms.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Active symptoms ({symptoms.length})</p>
                <button onClick={() => setSymptoms([])}
                  className="text-[10px] text-rose-400 hover:text-rose-300 transition-all">Clear all</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {symptoms.map(s => {
                  const meta = SYMPTOM_DATA[s];
                  return (
                    <motion.div key={s}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border"
                      style={{ background: "rgba(6,182,212,0.12)", border: "1px solid rgba(6,182,212,0.3)", color: "#67e8f9" }}>
                      {s}
                      {meta && (
                        <span className="text-[9px] text-slate-500">{meta.hi && `(${meta.hi})`}</span>
                      )}
                      <button onClick={() => removeSymptom(s)}>
                        <X className="w-3 h-3 hover:text-white" />
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Clinical Decision Panel */}
        <ClinicalDecisionPanel symptoms={symptoms} />
      </div>
    </div>
  );
}
