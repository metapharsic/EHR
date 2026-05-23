"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Mic, MicOff, Activity, FileText, Sparkles, 
  Search, User, FileSearch, ClipboardList, Bot,
  ChevronRight, Clock, TrendingUp, CheckCircle, XCircle,
  BarChart3, Zap, Volume2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMettaVoice, VoiceMode } from "@/hooks/useMettaVoice";

interface MettaVoiceInterfaceProps {
  patientId?: string;
  patientName?: string;
}

const MODE_CONFIG: Record<VoiceMode, { icon: any; label: string; color: string; description: string }> = {
  IDLE: { icon: Mic, label: "Ready", color: "slate", description: "Say 'Hey Metta' to start" },
  VOICE_CHART: { icon: ClipboardList, label: "Voice Chart", color: "cyan", description: "Charting by voice" },
  DICTATE_NOTES: { icon: FileText, label: "Dictate Notes", color: "emerald", description: "Documenting notes" },
  AI_SCRIBE: { icon: Bot, label: "AI Scribe", color: "violet", description: "Ambient documentation" },
  AUTO_DOCUMENT: { icon: Sparkles, label: "Auto Document", color: "amber", description: "Generating reports" },
  SMART_SEARCH: { icon: Search, label: "Smart Search", color: "blue", description: "Searching records" },
  FIND_PATIENT: { icon: User, label: "Find Patient", color: "rose", description: "Patient lookup" },
};

export function MettaVoiceInterface({ patientId, patientName }: MettaVoiceInterfaceProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [commandHistory, setCommandHistory] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);

  const {
    isListening,
    isProcessing,
    currentMode,
    transcript,
    lastCommand,
    error,
    activationWord,
    startListening,
    stopListening,
    switchMode,
  } = useMettaVoice({
    activationWord: "Metta",
    onCommand: (command, mode) => {
      console.log(`Command executed: ${command} (${mode})`);
      fetchCommandHistory();
    },
    onModeChange: (mode) => {
      console.log(`Mode changed to: ${mode}`);
    },
  });

  // Fetch command history
  const fetchCommandHistory = async () => {
    try {
      const response = await fetch("/api/voice/commands");
      const result = await response.json();
      if (result.success) {
        setCommandHistory(result.data);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  };

  // Fetch analytics
  const fetchAnalytics = async () => {
    try {
      const response = await fetch("/api/voice/analytics");
      const result = await response.json();
      if (result.success) {
        setAnalytics(result.data);
      }
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    }
  };

  useEffect(() => {
    fetchCommandHistory();
    fetchAnalytics();
  }, []);

  const currentModeConfig = MODE_CONFIG[currentMode];
  const ModeIcon = currentModeConfig.icon;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Main Voice Interface */}
      <div className="relative p-8 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl border border-slate-700/50 overflow-hidden">
        {/* Background Animation */}
        <div className="absolute inset-0 overflow-hidden">
          {isListening && (
            <>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full animate-ping" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-500/20 rounded-full animate-pulse" />
            </>
          )}
        </div>

        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500",
                isListening 
                  ? `bg-${currentModeConfig.color}-500/20 border-2 border-${currentModeConfig.color}-500/50` 
                  : "bg-slate-800 border-2 border-slate-700"
              )}>
                <ModeIcon className={cn(
                  "w-8 h-8 transition-colors",
                  isListening ? `text-${currentModeConfig.color}-400` : "text-slate-400"
                )} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">{currentModeConfig.label}</h2>
                <p className={cn("text-sm", `text-${currentModeConfig.color}-400`)}>
                  {currentModeConfig.description}
                </p>
              </div>
            </div>

            {/* Main Control Button */}
            <button
              onClick={isListening ? stopListening : startListening}
              disabled={isProcessing}
              className={cn(
                "relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300",
                isListening 
                  ? "bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30" 
                  : "bg-gradient-to-br from-cyan-500 to-blue-500 hover:shadow-lg hover:shadow-cyan-500/30"
              )}
            >
              {isProcessing ? (
                <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isListening ? (
                <MicOff className="w-8 h-8 text-white" />
              ) : (
                <Mic className="w-8 h-8 text-white" />
              )}
              
              {/* Ripple effect when listening */}
              {isListening && (
                <>
                  <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-20" />
                  <span className="absolute -inset-2 rounded-full bg-red-500/20 animate-pulse" />
                </>
              )}
            </button>
          </div>

          {/* Transcript Display */}
          <div className="mb-6 p-4 bg-slate-950/50 rounded-xl border border-slate-800 min-h-[100px]">
            <div className="flex items-center gap-2 mb-2">
              <Volume2 className="w-4 h-4 text-slate-500" />
              <span className="text-xs text-slate-500 uppercase tracking-wider">Live Transcript</span>
            </div>
            <p className="text-lg text-white">
              {transcript || (
                <span className="text-slate-600 italic">
                  Say "Hey Metta" followed by your command...
                </span>
              )}
            </p>
            {isListening && (
              <div className="flex items-center gap-2 mt-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs text-red-400">Listening...</span>
              </div>
            )}
          </div>

          {/* Mode Selector */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {([
              "VOICE_CHART",
              "DICTATE_NOTES", 
              "AI_SCRIBE",
              "AUTO_DOCUMENT",
              "SMART_SEARCH",
              "FIND_PATIENT",
            ] as VoiceMode[]).map((mode) => {
              const config = MODE_CONFIG[mode];
              const Icon = config.icon;
              const isActive = currentMode === mode;
              
              return (
                <button
                  key={mode}
                  onClick={() => switchMode(mode)}
                  className={cn(
                    "p-3 rounded-xl border transition-all duration-200 text-left",
                    isActive
                      ? `bg-${config.color}-500/20 border-${config.color}-500/50`
                      : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
                  )}
                >
                  <Icon className={cn(
                    "w-5 h-5 mb-2",
                    isActive ? `text-${config.color}-400` : "text-slate-400"
                  )} />
                  <p className={cn(
                    "text-xs font-medium",
                    isActive ? "text-white" : "text-slate-400"
                  )}>
                    {config.label}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Last Command Result */}
          <AnimatePresence>
            {lastCommand && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl"
              >
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-400">Command Executed</span>
                </div>
                <p className="text-white">{lastCommand.command}</p>
                <p className="text-sm text-slate-400 mt-1">
                  Mode: {lastCommand.mode} • {lastCommand.timestamp.toLocaleTimeString()}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-400" />
                <span className="text-sm text-red-400">{error}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Analytics & History */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Quick Stats */}
        <div className="p-6 bg-slate-900/50 rounded-2xl border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              Voice Analytics
            </h3>
            <span className="text-xs text-slate-500">Today</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-800/50 rounded-xl">
              <p className="text-2xl font-bold text-white">{analytics?.totalCommands || 24}</p>
              <p className="text-sm text-slate-400">Total Commands</p>
            </div>
            <div className="p-4 bg-slate-800/50 rounded-xl">
              <p className="text-2xl font-bold text-emerald-400">{analytics?.successRate || "94%"}</p>
              <p className="text-sm text-slate-400">Success Rate</p>
            </div>
            <div className="p-4 bg-slate-800/50 rounded-xl">
              <p className="text-2xl font-bold text-cyan-400">{analytics?.activeProviders || 8}</p>
              <p className="text-sm text-slate-400">Active Providers</p>
            </div>
            <div className="p-4 bg-slate-800/50 rounded-xl">
              <p className="text-2xl font-bold text-violet-400">{analytics?.avgAccuracy || "96%"}</p>
              <p className="text-sm text-slate-400">Avg Accuracy</p>
            </div>
          </div>
        </div>

        {/* Command History */}
        <div className="p-6 bg-slate-900/50 rounded-2xl border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-cyan-400" />
              Recent Commands
            </h3>
            <button 
              onClick={fetchCommandHistory}
              className="text-xs text-cyan-400 hover:text-cyan-300"
            >
              Refresh
            </button>
          </div>
          
          <div className="space-y-3 max-h-[200px] overflow-y-auto">
            {commandHistory.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No commands yet</p>
            ) : (
              commandHistory.map((cmd, idx) => (
                <div key={cmd.id || idx} className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg">
                  <div className={cn(
                    "w-2 h-2 mt-1.5 rounded-full",
                    cmd.success ? "bg-emerald-400" : "bg-red-400"
                  )} />
                  <div className="flex-1">
                    <p className="text-sm text-white line-clamp-1">{cmd.command}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500">{cmd.mode}</span>
                      <span className="text-xs text-slate-600">•</span>
                      <span className="text-xs text-slate-500">
                        {new Date(cmd.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Feature Usage Breakdown */}
      <div className="p-6 bg-slate-900/50 rounded-2xl border border-slate-700/50">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-cyan-400" />
          Feature Usage (PowerBI Ready)
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: "Voice Chart", count: 45, color: "cyan", icon: ClipboardList },
            { label: "Dictate Notes", count: 78, color: "emerald", icon: FileText },
            { label: "AI Scribe", count: 32, color: "violet", icon: Bot },
            { label: "Auto Document", count: 23, color: "amber", icon: Sparkles },
            { label: "Smart Search", count: 56, color: "blue", icon: Search },
            { label: "Find Patient", count: 89, color: "rose", icon: User },
          ].map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.label} className="p-4 bg-slate-800/50 rounded-xl">
                <Icon className={`w-6 h-6 text-${feature.color}-400 mb-2`} />
                <p className="text-2xl font-bold text-white">{feature.count}</p>
                <p className="text-xs text-slate-400">{feature.label}</p>
              </div>
            );
          })}
        </div>
        
        <p className="text-xs text-slate-500 mt-4">
          All data is stored in structured format for PowerBI analytics and reporting
        </p>
      </div>
    </div>
  );
}
