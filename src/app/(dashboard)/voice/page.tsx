"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, BookOpen, FileText, Sparkles, Search, User, ClipboardList,
  BarChart3, ChevronRight, TrendingUp, Clock, Zap, Languages,
  Activity, PlayCircle, Settings
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MettaVoiceInterface } from "@/components/voice/MettaVoiceInterface";
import { BilingualConsultation } from "@/components/voice/BilingualConsultation";

// ── Mock Data ──────────────────────────────────────────────────────────────────
const TABS = [
  { id: "bilingual",  label: "Clinical Intake", icon: Languages, badge: "AI Translation" },
  { id: "commands",   label: "Voice Commands",   icon: Mic,       badge: null },
  { id: "analytics",  label: "Usage Analytics",  icon: BarChart3, badge: null },
];

const VOICE_FEATURES = [
  { id: "voice-chart", title: "Voice Charting", desc: "Chart by voice - document chief complaints, HPI, and plans hands-free", icon: ClipboardList, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20", stats: { usage: 45, accuracy: "97%" }, examples: ["Metta, add chief complaint: chest pain", "Metta, document vital signs 120/80"] },
  { id: "dictate-notes", title: "Dictate Notes", desc: "Create structured clinical notes through natural flowing voice dictation", icon: FileText, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", stats: { usage: 78, accuracy: "96%" }, examples: ["Metta, dictate progress note", "Metta, create consultation note"] },
  { id: "ai-scribe", title: "Ambient Scribe", desc: "Ambient AI that listens to patient encounters and intelligently generates notes", icon: Sparkles, color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20", stats: { usage: 132, accuracy: "99%" }, examples: ["Metta, start AI scribe", "Metta, finalize encounter notes"] },
  { id: "auto-document", title: "Auto Document", desc: "Automatically generate visit summaries, care plans, and referral letters", icon: BookOpen, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", stats: { usage: 23, accuracy: "98%" }, examples: ["Metta, generate visit summary", "Metta, make referral letter to Dr. Smith"] },
  { id: "smart-search", title: "Global Voice Search", desc: "Voice-powered search across all patient records and clinical domains", icon: Search, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", stats: { usage: 56, accuracy: "95%" }, examples: ["Metta, search for diabetes protocols", "Metta, find my last 3 lab results"] },
  { id: "find-patient", title: "Patient Locator", desc: "Quickly locate active patients by name, MRN, or demographics via voice", icon: User, color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20", stats: { usage: 89, accuracy: "99%" }, examples: ["Metta, find patient John Smith", "Metta, open MRN 123456"] },
];

export default function VoiceHubPage() {
  const [activeTab, setActiveTab] = useState("commands");
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [showInterface, setShowInterface] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8 selection:bg-cyan-500/30 font-sans">
      <div className="max-w-[1400px] mx-auto">
        
        {/* ── Page Header ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-cyan-500 blur-xl opacity-20 animate-pulse rounded-full" />
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center relative shadow-[0_0_40px_rgba(6,182,212,0.3)] border border-white/20">
                <Mic className="w-8 h-8 text-white drop-shadow-md" />
              </div>
            </div>
            <div>
              <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight">Metta Voice Hub</h1>
              <p className="text-cyan-400 font-semibold mt-1 tracking-wide uppercase text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Bilingual Neural AI Assistant
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="px-5 py-2.5 rounded-xl border border-white/10 text-white font-medium hover:bg-white/5 transition-colors flex items-center gap-2 text-sm bg-slate-900/50 backdrop-blur-md">
              <Settings className="w-4 h-4 text-slate-400" /> Preferences
            </button>
          </div>
        </div>

        {/* ── Premium Tabs ── */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl mb-8 bg-slate-900 border border-slate-800 w-fit backdrop-blur-xl shadow-2xl">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300",
                  isActive ? "text-white shadow-lg overflow-hidden" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                )}
              >
                {isActive && <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-violet-500/20 border border-cyan-500/30 rounded-xl" />}
                <Icon className={cn("w-4 h-4 relative z-10", isActive ? "text-cyan-400" : "")} />
                <span className="relative z-10">{tab.label}</span>
                {tab.badge && (
                  <span className={cn(
                    "relative z-10 ml-1 text-[10px] px-2 py-0.5 rounded-md font-black uppercase tracking-wider",
                    isActive ? "bg-cyan-500 text-white" : "bg-slate-800 text-slate-400"
                  )}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Tab Panels ── */}
        <AnimatePresence mode="wait">
          
          {/* VOICE COMMANDS */}
          {activeTab === "commands" && (
            <motion.div key="commands" initial={{ opacity: 0, scale: 0.98, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: -10 }} transition={{ duration: 0.3 }} className="space-y-8">
              
              {/* Voice Command Activation Hero */}
              <div className="relative overflow-hidden rounded-[2rem] p-10 border border-white/10 bg-slate-900/50 shadow-2xl backdrop-blur-xl group">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-transparent to-violet-500/10 opacity-50 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1/2 bg-cyan-500/20 blur-[120px] rounded-full pointer-events-none" />
                
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="max-w-xl">
                    <h2 className="text-3xl font-black text-white mb-3">Command Center</h2>
                    <p className="text-slate-400 text-lg leading-relaxed">
                      Transform your workflow with zero-click operations. Simply speak naturally to document encounters, find records, and generate complex reports.
                    </p>
                    <div className="flex items-center gap-6 mt-6">
                      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /><span className="text-sm font-bold text-slate-300">System Ready</span></div>
                      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" /><span className="text-sm font-bold text-slate-300">Neural Net Online</span></div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setShowInterface(!showInterface)}
                    className={cn(
                      "group relative px-8 py-5 rounded-2xl font-black text-lg transition-all duration-300 flex items-center gap-4 border overflow-hidden shadow-2xl shrink-0 w-full md:w-auto justify-center",
                      showInterface 
                        ? "bg-slate-800 border-slate-700 hover:bg-slate-700 text-white" 
                        : "bg-white border-white text-slate-900 hover:scale-105"
                    )}
                  >
                    {!showInterface && <div className="absolute inset-0 bg-gradient-to-r from-cyan-200 to-white opacity-0 group-hover:opacity-100 transition-opacity" />}
                    <Mic className={cn("w-7 h-7 relative z-10", showInterface ? "text-rose-500" : "text-cyan-600")} />
                    <span className="relative z-10">{showInterface ? "Deactivate Metta" : "Activate Metta AI"}</span>
                  </button>
                </div>
              </div>

              {/* Active Voice Modal overlay inside the page */}
              <AnimatePresence>
                {showInterface && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="pt-2"><MettaVoiceInterface /></div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Enhanced Feature Grid */}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {VOICE_FEATURES.map((feature, index) => {
                  const Icon = feature.icon;
                  const isSelected = selectedFeature === feature.id;
                  return (
                    <motion.div
                      key={feature.id}
                      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
                      onClick={() => setSelectedFeature(isSelected ? null : feature.id)}
                      className={cn(
                        "p-6 rounded-3xl border cursor-pointer transition-all duration-300 relative overflow-hidden group hover:shadow-[0_0_30px_rgba(6,182,212,0.1)]",
                        isSelected ? cn("bg-slate-900 shadow-2xl", feature.border) : "bg-slate-900/40 border-white/5 hover:bg-slate-900/60 hover:border-white/10"
                      )}
                    >
                      {/* Gradient Hover Effect */}
                      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-10 transition-opacity duration-500", feature.border.replace('border-', 'from-').replace('/20', '/0'), "to-transparent")} />
                      
                      <div className="flex items-start justify-between mb-5 relative z-10">
                        <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center border", feature.bg, feature.border)}>
                          <Icon className={cn("w-7 h-7", feature.color)} />
                        </div>
                        <div className="text-right">
                          <div className={cn("flex items-center justify-end gap-1.5 font-black text-lg", feature.color)}>
                            {feature.stats.accuracy} <Activity className="w-4 h-4 opacity-50" />
                          </div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-0.5">{feature.stats.usage} Uses</p>
                        </div>
                      </div>
                      
                      <h3 className="text-xl font-bold text-white mb-2 relative z-10">{feature.title}</h3>
                      <p className="text-sm font-medium text-slate-400 mb-4 line-clamp-2 relative z-10 leading-relaxed">{feature.desc}</p>
                      
                      <AnimatePresence>
                        {isSelected && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-white/10 pt-4 overflow-hidden relative z-10">
                            <p className="text-xs font-bold text-cyan-500 mb-3 uppercase tracking-wider flex items-center gap-2"><PlayCircle className="w-4 h-4" /> Try commands:</p>
                            <ul className="space-y-2.5">
                              {feature.examples.map((ex, i) => (
                                <li key={i} className="flex items-start gap-3 bg-black/20 p-3 rounded-xl border border-white/5 hover:border-cyan-500/30 transition-colors">
                                  <Mic className={cn("w-4 h-4 mt-0.5 flex-shrink-0", feature.color)} />
                                  <span className="text-sm font-medium text-slate-300">"{ex}"</span>
                                </li>
                              ))}
                            </ul>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      
                      {!isSelected && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 group-hover:text-cyan-400 transition-colors relative z-10 mt-auto">
                          View Examples <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* BILINGUAL */}
          {activeTab === "bilingual" && (
            <motion.div key="bilingual" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
              <BilingualConsultation />
            </motion.div>
          )}

          {/* ANALYTICS */}
          {activeTab === "analytics" && (
            <motion.div key="analytics" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }} className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { icon: Zap,      label: "Commands Executed",  value: "8,247", sub: "Top 1% User",  color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
                  { icon: Clock,    label: "Time Reclaimed",      value: "148 hrs", sub: "Since Activation", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
                  { icon: Sparkles, label: "AI Suggestions", value: "3.4k",    sub: "94% Acceptance",  color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" },
                  { icon: Activity, label: "Engine Accuracy",    value: "98.7%", sub: "Consistently High", color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
                ].map(({ icon: Icon, label, value, sub, color, bg, border }) => (
                  <div key={label} className={cn("p-6 rounded-3xl border relative overflow-hidden", bg, border)}>
                    <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-[80px] bg-white/10" />
                    <Icon className={cn("w-8 h-8 mb-4", color)} />
                    <p className="text-3xl font-black text-white">{value}</p>
                    <p className="text-sm font-bold text-slate-400 mt-1">{label}</p>
                    <p className={cn("text-xs font-bold mt-2", color)}>{sub}</p>
                  </div>
                ))}
              </div>
              <div className="h-96 w-full rounded-3xl bg-slate-900 border border-white/10 flex items-center justify-center p-8">
                <p className="text-slate-500 font-bold uppercase tracking-widest text-sm flex items-center gap-2">
                  <BarChart3 className="w-5 h-5"/> Enhanced Analytics Dashboard Disabled in Demo
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
