"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Mic, MicOff, X, MessageSquare, Sparkles, 
  FileText, Stethoscope, Search, UserPlus, 
  ClipboardList, Bot, Activity, ChevronRight
} from "lucide-react";
import { useAdvancedVoice, VoiceMode } from "@/hooks/useAdvancedVoice";
import { cn } from "@/lib/utils";

interface AdvancedVoiceAssistantProps {
  assistantName?: string;
}

const MODE_CONFIG: Record<VoiceMode, { icon: any; label: string; color: string; description: string }> = {
  IDLE: { icon: Sparkles, label: "Ready", color: "cyan", description: "Say 'Hey Metta' to start" },
  CHART: { icon: Stethoscope, label: "Clinical Charting", color: "emerald", description: "Documenting encounter" },
  DICTATE: { icon: FileText, label: "Dictation", color: "blue", description: "Medical transcription active" },
  SCRIBE: { icon: Bot, label: "AI Scribe", color: "purple", description: "Ambient documentation" },
  AUTO_DOCUMENT: { icon: ClipboardList, label: "Auto-Document", color: "amber", description: "Generating note" },
  SMART_SEARCH: { icon: Search, label: "Smart Search", color: "rose", description: "AI-powered search" },
  FIND_PATIENT: { icon: Search, label: "Find Patient", color: "orange", description: "Searching patients" },
  NEW_PATIENT: { icon: UserPlus, label: "New Patient", color: "green", description: "Voice registration" },
};

export function AdvancedVoiceAssistant({ assistantName = "Metta" }: AdvancedVoiceAssistantProps) {
  const {
    mode,
    isListening,
    isProcessing,
    transcript,
    interimTranscript,
    generatedNote,
    conversation,
    error,
    startListening,
    stopListening,
    setMode,
  } = useAdvancedVoice(assistantName);

  const [isOpen, setIsOpen] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [showNote, setShowNote] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentMode = MODE_CONFIG[mode];
  const ModeIcon = currentMode.icon;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation, interimTranscript]);

  const handleToggleListening = async () => {
    if (isListening) {
      await stopListening();
    } else {
      await startListening(mode);
    }
  };

  const handleModeSwitch = (newMode: VoiceMode) => {
    setMode(newMode);
    if (!isListening) {
      startListening(newMode);
    }
  };

  return (
    <>
      {/* Floating Voice Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all",
          isListening 
            ? `bg-${currentMode.color}-500 shadow-${currentMode.color}-500/50` 
            : "bg-gradient-to-r from-cyan-500 to-blue-500 shadow-cyan-500/30"
        )}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        animate={isListening ? { 
          boxShadow: ["0 0 20px rgba(6,182,212,0.3)", "0 0 40px rgba(6,182,212,0.6)", "0 0 20px rgba(6,182,212,0.3)"]
        } : {}}
        transition={{ repeat: Infinity, duration: 1.5 }}
      >
        <AnimatePresence mode="wait">
          {isListening ? (
            <motion.div
              key="listening"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="relative"
            >
              <Activity className="w-7 h-7 text-white" />
              <motion.div
                className="absolute inset-0 rounded-full bg-white/30"
                animate={{ scale: [1, 2.5], opacity: [0.5, 0] }}
                transition={{ repeat: Infinity, duration: 1 }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <ModeIcon className="w-7 h-7 text-white" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Voice Assistant Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-28 right-6 z-50 w-[480px] max-w-[calc(100vw-3rem)]
                       bg-slate-900/95 backdrop-blur-xl rounded-3xl border border-slate-700/50
                       shadow-2xl shadow-black/50 overflow-hidden"
          >
            {/* Header with Mode Indicator */}
            <div className={cn(
              "px-5 py-4 border-b border-slate-700/50",
              "bg-gradient-to-r from-slate-800/50 to-slate-900/50"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    `bg-${currentMode.color}-500/20 border border-${currentMode.color}-500/30`
                  )}>
                    <ModeIcon className={cn("w-5 h-5", `text-${currentMode.color}-400`)} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-white">{assistantName}</h3>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider",
                        `bg-${currentMode.color}-500/20 text-${currentMode.color}-300 border border-${currentMode.color}-500/30`
                      )}>
                        {currentMode.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      {isListening ? "Listening..." : isProcessing ? "Processing..." : currentMode.description}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Mode Switcher */}
              <div className="flex gap-2 mt-4 overflow-x-auto pb-1 scrollbar-hide">
                {([
                  { id: "CHART", icon: Stethoscope, label: "Chart" },
                  { id: "DICTATE", icon: FileText, label: "Dictate" },
                  { id: "SCRIBE", icon: Bot, label: "Scribe" },
                  { id: "SMART_SEARCH", icon: Search, label: "Search" },
                  { id: "NEW_PATIENT", icon: UserPlus, label: "New" },
                ] as const).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleModeSwitch(m.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
                      mode === m.id
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                        : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                    )}
                  >
                    <m.icon className="w-3.5 h-3.5" />
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Main Content Area */}
            <div className="h-80 overflow-y-auto p-5 space-y-4">
              {/* Welcome State */}
              {conversation.length === 0 && !isListening && (
                <div className="text-center py-8">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 
                               border border-cyan-500/30 flex items-center justify-center"
                  >
                    <Sparkles className="w-8 h-8 text-cyan-400" />
                  </motion.div>
                  <p className="text-sm text-slate-300 mb-2">
                    Say <span className="text-cyan-400 font-semibold">"Hey {assistantName}"</span> to start
                  </p>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {[
                      { icon: Stethoscope, text: "Chart encounter", mode: "CHART" },
                      { icon: FileText, text: "Dictate notes", mode: "DICTATE" },
                      { icon: Bot, text: "AI Scribe", mode: "SCRIBE" },
                      { icon: Search, text: "Find patient", mode: "SMART_SEARCH" },
                    ].map((item, i) => (
                      <button
                        key={i}
                        onClick={() => handleModeSwitch(item.mode as VoiceMode)}
                        className="flex items-center gap-2 p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 
                                   border border-slate-700/50 hover:border-cyan-500/30 transition-all text-left"
                      >
                        <item.icon className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs text-slate-300">{item.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Conversation */}
              {conversation.map((msg, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] px-4 py-3 rounded-2xl text-sm",
                      msg.role === "user"
                        ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-br-md"
                        : "bg-slate-800 text-slate-200 rounded-bl-md border border-slate-700/50"
                    )}
                  >
                    {msg.text}
                    {msg.mode && msg.mode !== "IDLE" && (
                      <span className={cn(
                        "ml-2 text-[10px] px-1.5 py-0.5 rounded-full",
                        msg.role === "user" ? "bg-white/20" : `bg-${MODE_CONFIG[msg.mode].color}-500/20 text-${MODE_CONFIG[msg.mode].color}-300`
                      )}>
                        {MODE_CONFIG[msg.mode].label}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}

              {/* Live Transcript */}
              {(transcript || interimTranscript) && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-end"
                >
                  <div className="max-w-[85%] px-4 py-3 rounded-2xl text-sm 
                                  bg-slate-800/50 text-slate-400 rounded-br-md border border-slate-700/50">
                    {transcript}
                    <span className="text-slate-500">{interimTranscript}</span>
                    <span className="inline-block w-0.5 h-4 bg-cyan-400 ml-1 animate-pulse" />
                  </div>
                </motion.div>
              )}

              {/* Generated Note Preview */}
              {generatedNote && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-slate-800/50 rounded-xl border border-emerald-500/30 p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      Generated Note
                    </span>
                    <button
                      onClick={() => setShowNote(!showNote)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      {showNote ? "Hide" : "Show"}
                    </button>
                  </div>
                  {showNote && (
                    <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono bg-slate-900/50 p-3 rounded-lg">
                      {generatedNote}
                    </pre>
                  )}
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Error Display */}
            {error && (
              <div className="px-5 py-3 bg-red-500/10 border-t border-red-500/20">
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <X className="w-3 h-3" />
                  {error}
                </p>
              </div>
            )}

            {/* Input Area */}
            <div className="p-5 border-t border-slate-700/50 space-y-3 bg-slate-900/50">
              {/* Text Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={`Type command or message ${assistantName}...`}
                  className="flex-1 px-4 py-2.5 bg-slate-800 rounded-xl text-sm text-white 
                           placeholder-slate-500 border border-slate-700/50
                           focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
                />
                <button
                  className="px-4 py-2.5 bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Voice Control Button */}
              <button
                onClick={handleToggleListening}
                disabled={isProcessing}
                className={cn(
                  "w-full py-3.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2",
                  isListening
                    ? "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                    : "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40"
                )}
              >
                {isListening ? (
                  <>
                    <MicOff className="w-4 h-4" />
                    Stop Listening
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    Hold to Speak
                  </>
                )}
              </button>

              {/* Mode-specific hints */}
              <p className="text-[10px] text-center text-slate-500">
                {mode === "IDLE" && `Try: "${assistantName}, chart" or "${assistantName}, find patient John"`}
                {mode === "CHART" && "Document: vitals, symptoms, medications, assessments"}
                {mode === "DICTATE" && "Speak naturally - I'll format with medical terminology"}
                {mode === "SCRIBE" && "I'll listen to your consultation and generate a note"}
                {mode === "SMART_SEARCH" && "Describe the patient: name, symptoms, diagnosis, demographics"}
                {mode === "NEW_PATIENT" && "I'll guide you through registration step by step"}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
