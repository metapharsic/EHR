"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Mic,
  MicOff,
  Sparkles,
  FileText,
  Stethoscope,
  Pill,
  Activity,
  ClipboardList,
  CheckCircle2,
  RotateCcw,
  Save,
  X,
  Volume2,
  Settings,
  Zap,
  Brain,
} from "lucide-react";

interface AmbientScribeProps {
  patientName?: string;
  onClose?: () => void;
}

interface TranscriptSegment {
  id: string;
  speaker: "doctor" | "patient";
  text: string;
  timestamp: Date;
  confidence: number;
}

interface AIInsight {
  id: string;
  type: "diagnosis" | "medication" | "followup" | "coding";
  content: string;
  confidence: number;
}

export function AmbientScribe({ patientName = "Patient", onClose }: AmbientScribeProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptSegment[]>([]);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Simulate audio levels when recording
  useEffect(() => {
    if (!isRecording || isPaused) {
      setAudioLevel(0);
      return;
    }
    const interval = setInterval(() => {
      setAudioLevel(Math.random() * 100);
    }, 100);
    return () => clearInterval(interval);
  }, [isRecording, isPaused]);

  // Timer
  useEffect(() => {
    if (!isRecording || isPaused) return;
    const interval = setInterval(() => setElapsedTime(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isRecording, isPaused]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  // Simulate transcription
  useEffect(() => {
    if (!isRecording || isPaused) return;
    
    const demoTranscripts: TranscriptSegment[] = [
      { id: "1", speaker: "doctor", text: "Good morning! How are you feeling today?", timestamp: new Date(), confidence: 98 },
      { id: "2", speaker: "patient", text: "I've been having some chest pain, especially when I exercise.", timestamp: new Date(), confidence: 95 },
      { id: "3", speaker: "doctor", text: "Can you describe the pain? Is it sharp, dull, or pressure-like?", timestamp: new Date(), confidence: 97 },
      { id: "4", speaker: "patient", text: "It's more like pressure, and it radiates to my left arm.", timestamp: new Date(), confidence: 94 },
    ];

    let index = 0;
    const interval = setInterval(() => {
      if (index < demoTranscripts.length) {
        setTranscripts(prev => [...prev, demoTranscripts[index]]);
        index++;
        
        // Generate AI insights based on transcript
        if (index === 2) {
          setInsights(prev => [...prev, {
            id: "1",
            type: "diagnosis",
            content: "Possible angina pectoris - consider ECG and troponin levels",
            confidence: 87
          }]);
        }
        if (index === 4) {
          setInsights(prev => [...prev, {
            id: "2",
            type: "coding",
            content: "Suggested ICD-10: I20.9 (Angina pectoris, unspecified)",
            confidence: 92
          }]);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isRecording, isPaused]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getInsightIcon = (type: AIInsight["type"]) => {
    switch (type) {
      case "diagnosis": return Stethoscope;
      case "medication": return Pill;
      case "followup": return Activity;
      case "coding": return FileText;
      default: return Sparkles;
    }
  };

  const getInsightColor = (type: AIInsight["type"]) => {
    switch (type) {
      case "diagnosis": return "from-rose-500 to-pink-500";
      case "medication": return "from-cyan-500 to-blue-500";
      case "followup": return "from-amber-500 to-orange-500";
      case "coding": return "from-purple-500 to-indigo-500";
      default: return "from-cyan-500 to-purple-500";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <Card className="w-full max-w-5xl h-[90vh] glass-card border-0 flex flex-col">
        {/* Header */}
        <CardHeader className="border-b border-slate-100  flex flex-row items-center justify-between py-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className={cn(
                "h-12 w-12 rounded-xl flex items-center justify-center transition-all",
                isRecording 
                  ? "bg-gradient-to-br from-rose-500 to-pink-500 animate-pulse" 
                  : "bg-gradient-to-br from-cyan-500 to-purple-500"
              )}>
                {isRecording ? <Mic className="h-6 w-6 text-white" /> : <MicOff className="h-6 w-6 text-white" />}
              </div>
              {isRecording && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500"></span>
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">Ambient Clinical Documentation</CardTitle>
                <Badge className="bg-gradient-to-r from-cyan-500 to-purple-500 text-white border-0">
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI Powered
                </Badge>
              </div>
              <p className="text-sm text-slate-500">Patient: <span className="font-semibold text-slate-700">{patientName}</span></p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Timer */}
            <div className="px-4 py-2 rounded-xl bg-slate-100  font-mono text-lg font-semibold">
              {formatTime(elapsedTime)}
            </div>
            
            {/* Audio Visualizer */}
            {isRecording && (
              <div className="hidden sm:flex items-center gap-0.5 h-8 px-3 rounded-xl bg-slate-100 ">
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-gradient-to-t from-cyan-500 to-purple-500 rounded-full transition-all duration-100"
                    style={{
                      height: `${Math.max(8, Math.min(32, audioLevel * Math.random()))}%`,
                      animationDelay: `${i * 50}ms`
                    }}
                  />
                ))}
              </div>
            )}
            
            <Button size="icon" variant="ghost" onClick={() => setShowSettings(!showSettings)}>
              <Settings className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        {/* Main Content */}
        <CardContent className="flex-1 flex gap-6 p-6 overflow-hidden">
          {/* Left: Transcript */}
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800  flex items-center gap-2">
                <FileText className="h-4 w-4 text-cyan-500" />
                Live Transcript
              </h3>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setTranscripts([])}
                  className="text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              </div>
            </div>
            
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto rounded-xl bg-slate-50  p-4 space-y-4"
            >
              {transcripts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <Mic className="h-12 w-12 mb-4 opacity-30" />
                  <p>Start recording to begin transcription</p>
                  <p className="text-sm">AI will automatically document the encounter</p>
                </div>
              ) : (
                transcripts.map((segment) => (
                  <div 
                    key={segment.id}
                    className={cn(
                      "flex gap-3",
                      segment.speaker === "doctor" ? "flex-row" : "flex-row-reverse"
                    )}
                  >
                    <div className={cn(
                      "px-4 py-3 rounded-2xl max-w-[80%]",
                      segment.speaker === "doctor" 
                        ? "bg-cyan-500 text-white rounded-tl-sm" 
                        : "bg-slate-200  text-slate-800  rounded-tr-sm"
                    )}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold opacity-80">
                          {segment.speaker === "doctor" ? "Dr." : "Patient"}
                        </span>
                        <span className="text-[10px] opacity-60">
                          {segment.confidence}%
                        </span>
                      </div>
                      <p className="text-sm">{segment.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Control Bar */}
            <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-slate-100 ">
              <Button
                size="lg"
                className={cn(
                  "h-14 px-8 rounded-full text-lg font-semibold transition-all",
                  isRecording 
                    ? "bg-rose-500 hover:bg-rose-600 text-white" 
                    : "bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white"
                )}
                onClick={() => setIsRecording(!isRecording)}
              >
                {isRecording ? (
                  <><MicOff className="h-5 w-5 mr-2" /> Stop Recording</>
                ) : (
                  <><Mic className="h-5 w-5 mr-2" /> Start Recording</>
                )}
              </Button>
              
              {isRecording && (
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 px-6 rounded-full"
                  onClick={() => setIsPaused(!isPaused)}
                >
                  {isPaused ? "Resume" : "Pause"}
                </Button>
              )}
            </div>
          </div>

          {/* Right: AI Insights */}
          <div className="w-80 flex flex-col">
            <h3 className="font-semibold text-slate-800  flex items-center gap-2 mb-4">
              <Brain className="h-4 w-4 text-purple-500" />
              AI Insights
            </h3>
            
            <div className="flex-1 overflow-y-auto space-y-3">
              {insights.length === 0 ? (
                <div className="text-center text-slate-400 py-8">
                  <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">AI insights will appear here</p>
                  <p className="text-xs mt-1">Based on conversation analysis</p>
                </div>
              ) : (
                insights.map((insight) => {
                  const Icon = getInsightIcon(insight.type);
                  return (
                    <div 
                      key={insight.id}
                      className="glass-card rounded-xl p-4 hover-lift cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn("p-2 rounded-lg bg-gradient-to-br", getInsightColor(insight.type))}>
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-600  uppercase">
                              {insight.type}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {insight.confidence}%
                            </span>
                          </div>
                          <p className="text-sm text-slate-800  mt-1">
                            {insight.content}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick Actions */}
            <div className="mt-4 pt-4 border-t border-slate-100  space-y-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase">Quick Actions</h4>
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline" className="text-xs">
                  <ClipboardList className="h-3 w-3 mr-1" />
                  Generate Note
                </Button>
                <Button size="sm" variant="outline" className="text-xs">
                  <Zap className="h-3 w-3 mr-1" />
                  Suggest Orders
                </Button>
              </div>
              <Button className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 text-white">
                <Save className="h-4 w-4 mr-2" />
                Save to EHR
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
