"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Mic, MicOff, Download, Copy, Trash2, X,
  User, FileText, Calendar, Phone, MapPin,
  Sparkles, CheckCircle, AlertCircle, Edit3,
  ChevronRight, Save, RotateCcw, Play, Pause
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface TranscriptSegment {
  id: string;
  timestamp: Date;
  speaker: "PATIENT" | "PROVIDER" | "SYSTEM";
  text: string;
  confidence: number;
  category?: "DEMOGRAPHICS" | "MEDICAL_HISTORY" | "SYMPTOMS" | "DIAGNOSIS" | "PLAN" | "GENERAL";
  extractedData?: Record<string, any>;
}

export interface ExtractedDemographics {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  phone?: string;
  email?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  insurance?: {
    provider?: string;
    policyNumber?: string;
    groupNumber?: string;
  };
  emergencyContact?: {
    name?: string;
    relationship?: string;
    phone?: string;
  };
}

export interface ReportRequest {
  type: "LAB_RESULTS" | "IMAGING" | "MEDICATION_LIST" | "VISIT_SUMMARY" | "REFERRAL";
  description: string;
  urgency: "ROUTINE" | "URGENT" | "STAT";
  dateRange?: { from?: Date; to?: Date };
}

interface PlainTranscriptNotesProps {
  patientId?: string;
  onDemographicsExtracted?: (demographics: ExtractedDemographics) => void;
  onReportRequested?: (request: ReportRequest) => void;
}

export function PlainTranscriptNotes({ 
  patientId, 
  onDemographicsExtracted,
  onReportRequested 
}: PlainTranscriptNotesProps) {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<"PATIENT" | "PROVIDER">("PROVIDER");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [extractedDemographics, setExtractedDemographics] = useState<ExtractedDemographics>({});
  const [pendingReports, setPendingReports] = useState<ReportRequest[]>([]);
  const [showRephrasePanel, setShowRephrasePanel] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<TranscriptSegment | null>(null);
  const [rephraseSuggestions, setRephraseSuggestions] = useState<string[]>([]);
  
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [segments, liveTranscript]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("Speech recognition not supported. Please use Chrome or Edge.");
        return;
      }

      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onresult = (event: any) => {
        let final = "";
        let interim = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }

        if (final) {
          addSegment(final, currentSpeaker);
        }
        setLiveTranscript(interim);
      };

      recognitionRef.current.onstart = () => setIsRecording(true);
      recognitionRef.current.onend = () => setIsRecording(false);
      recognitionRef.current.onerror = () => setIsRecording(false);

      recognitionRef.current.start();
    } catch (err) {
      console.error("Recording error:", err);
    }
  }, [currentSpeaker]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
    setLiveTranscript("");
  }, []);

  // Add transcript segment
  const addSegment = useCallback((text: string, speaker: "PATIENT" | "PROVIDER") => {
    const segment: TranscriptSegment = {
      id: `seg-${Date.now()}`,
      timestamp: new Date(),
      speaker,
      text,
      confidence: 0.95,
      category: categorizeText(text),
      extractedData: extractData(text),
    };

    setSegments(prev => [...prev, segment]);
    
    // Auto-extract demographics
    const demographics = extractDemographics(text);
    if (Object.keys(demographics).length > 0) {
      setExtractedDemographics(prev => ({ ...prev, ...demographics }));
    }

    // Check for report requests
    const reportRequest = detectReportRequest(text);
    if (reportRequest) {
      setPendingReports(prev => [...prev, reportRequest]);
    }
  }, []);

  // Categorize text
  const categorizeText = (text: string): TranscriptSegment["category"] => {
    const lower = text.toLowerCase();
    if (lower.match(/name|address|phone|birth|age|gender/)) return "DEMOGRAPHICS";
    if (lower.match(/history|past medical|surgery|medication/)) return "MEDICAL_HISTORY";
    if (lower.match(/pain|symptom|complaint|feeling/)) return "SYMPTOMS";
    if (lower.match(/diagnosis|assessment|impression/)) return "DIAGNOSIS";
    if (lower.match(/plan|treatment|prescription|referral/)) return "PLAN";
    return "GENERAL";
  };

  // Extract data from text
  const extractData = (text: string) => {
    const data: Record<string, any> = {};
    
    // Name extraction
    const nameMatch = text.match(/(?:my name is|i am|this is)\s+([\w\s]+)/i);
    if (nameMatch) data.name = nameMatch[1].trim();
    
    // Date extraction
    const dateMatch = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
    if (dateMatch) data.date = dateMatch[1];
    
    // Phone extraction
    const phoneMatch = text.match(/(\d{3}[\-\.]?\d{3}[\-\.]?\d{4})/);
    if (phoneMatch) data.phone = phoneMatch[1];
    
    return data;
  };

  // Extract demographics
  const extractDemographics = (text: string): Partial<ExtractedDemographics> => {
    const demographics: Partial<ExtractedDemographics> = {};
    const lower = text.toLowerCase();

    // Name
    const fullNameMatch = text.match(/(?:name is|i'm|i am)\s+([\w]+)\s+([\w]+)/i);
    if (fullNameMatch) {
      demographics.firstName = fullNameMatch[1];
      demographics.lastName = fullNameMatch[2];
    }

    // Date of Birth
    const dobMatch = text.match(/(?:born|birth|dob|birthday).{0,10}(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
    if (dobMatch) demographics.dateOfBirth = dobMatch[1];

    // Gender
    if (lower.match(/\bmale\b/)) demographics.gender = "Male";
    else if (lower.match(/\bfemale\b/)) demographics.gender = "Female";

    // Phone
    const phoneMatch = text.match(/(\d{3}[\-\.]?\d{3}[\-\.]?\d{4})/);
    if (phoneMatch) demographics.phone = phoneMatch[1];

    // Email
    const emailMatch = text.match(/([\w\.-]+@[\w\.-]+\.\w+)/);
    if (emailMatch) demographics.email = emailMatch[1];

    // Address
    const addressMatch = text.match(/(\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd))/i);
    if (addressMatch) {
      demographics.address = { street: addressMatch[1] };
    }

    return demographics;
  };

  // Detect report requests
  const detectReportRequest = (text: string): ReportRequest | null => {
    const lower = text.toLowerCase();
    
    if (lower.match(/lab results?|blood work|test results?/)) {
      return {
        type: "LAB_RESULTS",
        description: text,
        urgency: lower.match(/urgent|stat|asap/) ? "URGENT" : "ROUTINE",
      };
    }
    
    if (lower.match(/x-ray|mri|ct scan|ultrasound|imaging/)) {
      return {
        type: "IMAGING",
        description: text,
        urgency: lower.match(/urgent|stat|asap/) ? "URGENT" : "ROUTINE",
      };
    }
    
    if (lower.match(/medication list|prescription list|current meds/)) {
      return {
        type: "MEDICATION_LIST",
        description: text,
        urgency: "ROUTINE",
      };
    }

    return null;
  };

  // Generate rephrase suggestions
  const generateRephrases = (segment: TranscriptSegment): string[] => {
    const suggestions: string[] = [];
    const text = segment.text;

    if (segment.category === "DEMOGRAPHICS") {
      if (text.toLowerCase().includes("name")) {
        suggestions.push(
          "Could you please confirm your full name for me?",
          "May I have your first and last name as it appears on your ID?",
          "What name should I use for your medical records?"
        );
      }
      if (text.toLowerCase().includes("birth") || text.toLowerCase().includes("age")) {
        suggestions.push(
          "What is your date of birth (MM/DD/YYYY)?",
          "Could you confirm your birthdate for verification?",
          "I need your date of birth to pull up your records."
        );
      }
      if (text.toLowerCase().includes("address")) {
        suggestions.push(
          "What is your current home address?",
          "Could you provide your mailing address?",
          "Where do you currently reside?"
        );
      }
      if (text.toLowerCase().includes("phone")) {
        suggestions.push(
          "What is the best phone number to reach you?",
          "Could you provide a contact number?",
          "What phone number should we use for appointments?"
        );
      }
      if (text.toLowerCase().includes("insurance")) {
        suggestions.push(
          "Could you tell me your insurance provider?",
          "What insurance do you have?",
          "May I see your insurance card?"
        );
      }
    }

    if (segment.category === "MEDICAL_HISTORY") {
      suggestions.push(
        "Could you tell me more about your medical history?",
        "Have you had any previous surgeries or hospitalizations?",
        "What medications are you currently taking?"
      );
    }

    // Report retrieval rephrases
    if (text.toLowerCase().match(/report|result|record/)) {
      suggestions.push(
        "I can pull those records for you. Which specific report do you need?",
        "Let me retrieve those results. Do you need the most recent ones?",
        "I can generate that report. Would you like it printed or emailed?"
      );
    }

    return suggestions.length > 0 ? suggestions : [
      "Could you provide more details about that?",
      "Let me make sure I understand correctly...",
      "Could you clarify that for me?"
    ];
  };

  // Handle segment click for rephrasing
  const handleSegmentClick = (segment: TranscriptSegment) => {
    setSelectedSegment(segment);
    setRephraseSuggestions(generateRephrases(segment));
    setShowRephrasePanel(true);
  };

  // Export transcript
  const exportTranscript = () => {
    const content = segments.map(s => 
      `[${s.timestamp.toLocaleTimeString()}] ${s.speaker}: ${s.text}`
    ).join("\n");
    
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
  };

  // Clear all
  const clearAll = () => {
    setSegments([]);
    setExtractedDemographics({});
    setPendingReports([]);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 
                          flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Plain Transcript Notes</h2>
            <p className="text-xs text-slate-400">
              {segments.length} segments • {isRecording ? "Recording..." : "Ready"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportTranscript}
            disabled={segments.length === 0}
            className="bg-slate-800 border-slate-700 hover:bg-slate-700"
          >
            <Download className="w-4 h-4 mr-1" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearAll}
            disabled={segments.length === 0}
            className="bg-slate-800 border-slate-700 hover:bg-red-500/20 hover:text-red-400"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Main Transcript Area */}
        <div className="lg:col-span-2 space-y-4">
          {/* Recording Controls */}
          <div className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              className={cn(
                "w-14 h-14 rounded-full",
                isRecording 
                  ? "bg-red-500 hover:bg-red-600 animate-pulse" 
                  : "bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
              )}
            >
              {isRecording ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </Button>
            
            <div className="flex-1">
              <p className="text-sm font-medium text-white">
                {isRecording ? "Recording..." : "Click to start recording"}
              </p>
              <p className="text-xs text-slate-400">
                Speaker: 
                <button
                  onClick={() => setCurrentSpeaker(currentSpeaker === "PROVIDER" ? "PATIENT" : "PROVIDER")}
                  className="ml-1 px-2 py-0.5 rounded bg-slate-700 text-cyan-400 hover:bg-slate-600"
                >
                  {currentSpeaker}
                </button>
              </p>
            </div>

            {isRecording && (
              <div className="flex gap-1">
                <span className="w-1 h-6 bg-cyan-400 rounded-full animate-pulse" />
                <span className="w-1 h-8 bg-cyan-400 rounded-full animate-pulse" style={{ animationDelay: "0.1s" }} />
                <span className="w-1 h-5 bg-cyan-400 rounded-full animate-pulse" style={{ animationDelay: "0.2s" }} />
              </div>
            )}
          </div>

          {/* Transcript Display */}
          <div className="h-96 overflow-y-auto p-4 bg-slate-900/30 rounded-xl border border-slate-700/50 space-y-3">
            {segments.length === 0 && !liveTranscript && (
              <div className="text-center py-12 text-slate-500">
                <Mic className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Start recording to capture conversation</p>
                <p className="text-xs mt-1">Click the microphone button above</p>
              </div>
            )}

            {segments.map((segment, index) => (
              <motion.div
                key={segment.id}
                initial={{ opacity: 0, x: segment.speaker === "PROVIDER" ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => handleSegmentClick(segment)}
                className={cn(
                  "group cursor-pointer p-3 rounded-xl border transition-all hover:scale-[1.02]",
                  segment.speaker === "PROVIDER" 
                    ? "bg-cyan-500/10 border-cyan-500/20 ml-8" 
                    : "bg-slate-800/50 border-slate-700/50 mr-8",
                  "hover:border-cyan-500/30"
                )}
              >
                <div className="flex items-start gap-2">
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-[10px] shrink-0",
                      segment.speaker === "PROVIDER" 
                        ? "border-cyan-500/30 text-cyan-400" 
                        : "border-slate-600 text-slate-400"
                    )}
                  >
                    {segment.speaker === "PROVIDER" ? "DR" : "PT"}
                  </Badge>
                  <div className="flex-1">
                    <p className="text-sm text-slate-200">{segment.text}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-slate-500">
                        {segment.timestamp.toLocaleTimeString()}
                      </span>
                      {segment.category && segment.category !== "GENERAL" && (
                        <Badge className="text-[8px] bg-slate-700 text-slate-300">
                          {segment.category}
                        </Badge>
                      )}
                      <Sparkles className="w-3 h-3 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Live Transcript */}
            {liveTranscript && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={cn(
                  "p-3 rounded-xl border border-dashed",
                  currentSpeaker === "PROVIDER" 
                    ? "bg-cyan-500/5 border-cyan-500/20 ml-8" 
                    : "bg-slate-800/30 border-slate-700/30 mr-8"
                )}
              >
                <p className="text-sm text-slate-400">{liveTranscript}</p>
                <span className="inline-block w-0.5 h-4 bg-cyan-400 animate-pulse ml-1" />
              </motion.div>
            )}

            <div ref={scrollRef} />
          </div>
        </div>

        {/* Sidebar - Extracted Data */}
        <div className="space-y-4">
          {/* Demographics Card */}
          <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">Extracted Demographics</h3>
            </div>
            
            {Object.keys(extractedDemographics).length === 0 ? (
              <p className="text-xs text-slate-500">No demographics extracted yet</p>
            ) : (
              <div className="space-y-2">
                {extractedDemographics.firstName && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Name:</span>
                    <span className="text-slate-200">
                      {extractedDemographics.firstName} {extractedDemographics.lastName}
                    </span>
                  </div>
                )}
                {extractedDemographics.dateOfBirth && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">DOB:</span>
                    <span className="text-slate-200">{extractedDemographics.dateOfBirth}</span>
                  </div>
                )}
                {extractedDemographics.gender && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Gender:</span>
                    <span className="text-slate-200">{extractedDemographics.gender}</span>
                  </div>
                )}
                {extractedDemographics.phone && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Phone:</span>
                    <span className="text-slate-200">{extractedDemographics.phone}</span>
                  </div>
                )}
                {extractedDemographics.email && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Email:</span>
                    <span className="text-slate-200">{extractedDemographics.email}</span>
                  </div>
                )}
                
                {onDemographicsExtracted && (
                  <Button 
                    size="sm" 
                    className="w-full mt-3 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
                    onClick={() => onDemographicsExtracted(extractedDemographics)}
                  >
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Confirm & Save
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Pending Reports */}
          <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-white">Report Requests</h3>
            </div>
            
            {pendingReports.length === 0 ? (
              <p className="text-xs text-slate-500">No report requests detected</p>
            ) : (
              <div className="space-y-2">
                {pendingReports.map((report, idx) => (
                  <div key={idx} className="p-2 bg-slate-900/50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-300">{report.type}</span>
                      <Badge className={cn(
                        "text-[8px]",
                        report.urgency === "URGENT" ? "bg-red-500/20 text-red-400" : "bg-slate-700"
                      )}>
                        {report.urgency}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 truncate">{report.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rephrase Panel */}
      <AnimatePresence>
        {showRephrasePanel && selectedSegment && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-x-4 bottom-4 z-50 max-w-2xl mx-auto"
          >
            <div className="p-4 bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-cyan-500/30 shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  Suggested Rephrases
                </h3>
                <button 
                  onClick={() => setShowRephrasePanel(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="mb-3 p-2 bg-slate-800/50 rounded-lg">
                <p className="text-xs text-slate-400">Original:</p>
                <p className="text-sm text-slate-300">"{selectedSegment.text}"</p>
              </div>

              <div className="space-y-2">
                {rephraseSuggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      navigator.clipboard.writeText(suggestion);
                      setShowRephrasePanel(false);
                    }}
                    className="w-full text-left p-3 bg-slate-800/50 hover:bg-cyan-500/10 
                             border border-slate-700/50 hover:border-cyan-500/30
                             rounded-lg transition-all group"
                  >
                    <p className="text-sm text-slate-300 group-hover:text-cyan-300">{suggestion}</p>
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500">
                      <Copy className="w-3 h-3" />
                      Click to copy
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
