"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export type VoiceMode = 
  | "IDLE"
  | "VOICE_CHART"
  | "DICTATE_NOTES"
  | "AI_SCRIBE"
  | "AUTO_DOCUMENT"
  | "SMART_SEARCH"
  | "FIND_PATIENT";

export interface VoiceCommand {
  command: string;
  timestamp: Date;
  mode: VoiceMode;
  success: boolean;
  result?: any;
}

export interface MettaSession {
  id: string;
  activationWord: string;
  mode: VoiceMode;
  transcript: string;
  commands: VoiceCommand[];
  startTime: Date;
}

interface UseMettaVoiceOptions {
  activationWord?: string;
  onCommand?: (command: string, mode: VoiceMode) => void;
  onTranscript?: (transcript: string) => void;
  onModeChange?: (mode: VoiceMode) => void;
}

export function useMettaVoice(options: UseMettaVoiceOptions = {}) {
  const { 
    activationWord = "Metta", 
    onCommand, 
    onTranscript,
    onModeChange 
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentMode, setCurrentMode] = useState<VoiceMode>("IDLE");
  const [transcript, setTranscript] = useState("");
  const [session, setSession] = useState<MettaSession | null>(null);
  const [lastCommand, setLastCommand] = useState<VoiceCommand | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const sessionRef = useRef<MettaSession | null>(null);

  // Command patterns for mode detection - ENHANCED with more variations
  const commandPatterns: { mode: VoiceMode; patterns: string[] }[] = [
    {
      mode: "VOICE_CHART",
      patterns: [
        "voice chart", "chart mode", "start charting", "open chart",
        "document in chart", "add to chart", "chart encounter",
        "chart patient", "chart this", "chart visit", "chart note",
        "start chart", "begin chart", "new chart", "create chart",
        "chart chief complaint", "chart hpi", "chart assessment",
      ],
    },
    {
      mode: "DICTATE_NOTES",
      patterns: [
        "dictate", "dictation mode", "take a note", "create note",
        "new note", "document note", "dictate notes", "start dictation",
        "begin dictation", "voice note", "record note", "take notes",
        "write note", "make note", "add note",
      ],
    },
    {
      mode: "AI_SCRIBE",
      patterns: [
        "ai scribe", "scribe mode", "start scribe", "ambient documentation",
        "listen and document", "auto document", "scribe", "start scribing",
        "begin scribe", "activate scribe", "turn on scribe", "scribe on",
        "ambient mode", "ambient scribe", "auto scribe",
      ],
    },
    {
      mode: "AUTO_DOCUMENT",
      patterns: [
        "generate report", "create document", "auto document", "make summary",
        "generate summary", "visit summary", "create summary", "write report",
        "make report", "document visit", "summarize visit", "patient summary",
        "care summary", "discharge summary", "referral letter", "care plan",
      ],
    },
    {
      mode: "SMART_SEARCH",
      patterns: [
        "search", "find information", "look up", "smart search", "search for",
        "find in records", "lookup", "find", "search patient", "search records",
        "find data", "search database", "query", "find information about",
        "look for", "search by",
      ],
    },
    {
      mode: "FIND_PATIENT",
      patterns: [
        "find patient", "search patient", "lookup patient", "patient search",
        "find my patient", "open patient", "locate patient", "get patient",
        "show patient", "patient lookup", "find person", "search for patient",
        "find by mrn", "open mrn", "patient named", "patient name",
      ],
    },
  ];

  // Detect mode from command
  const detectMode = (command: string): VoiceMode => {
    const lowerCommand = command.toLowerCase();
    
    for (const { mode, patterns } of commandPatterns) {
      if (patterns.some(pattern => lowerCommand.includes(pattern))) {
        return mode;
      }
    }
    
    return currentMode === "IDLE" ? "IDLE" : currentMode;
  };

  // Process voice command
  const processCommand = useCallback(async (commandText: string) => {
    setIsProcessing(true);
    
    try {
      // Check for activation word
      if (!commandText.toLowerCase().includes(activationWord.toLowerCase()) && currentMode === "IDLE") {
        // Not activated yet
        return;
      }

      // Remove activation word from command
      const cleanCommand = commandText.replace(new RegExp(activationWord, "gi"), "").trim();
      
      // Detect mode
      const detectedMode = detectMode(cleanCommand);
      
      if (detectedMode !== currentMode) {
        setCurrentMode(detectedMode);
        onModeChange?.(detectedMode);
      }

      // Create command record
      const command: VoiceCommand = {
        command: cleanCommand,
        timestamp: new Date(),
        mode: detectedMode,
        success: true,
      };

      // Execute based on mode
      switch (detectedMode) {
        case "VOICE_CHART":
          command.result = await executeVoiceChart(cleanCommand);
          break;
        case "DICTATE_NOTES":
          command.result = await executeDictateNotes(cleanCommand);
          break;
        case "AI_SCRIBE":
          command.result = await executeAIScribe(cleanCommand);
          break;
        case "AUTO_DOCUMENT":
          command.result = await executeAutoDocument(cleanCommand);
          break;
        case "SMART_SEARCH":
          command.result = await executeSmartSearch(cleanCommand);
          break;
        case "FIND_PATIENT":
          command.result = await executeFindPatient(cleanCommand);
          break;
        default:
          command.result = { message: "Waiting for command..." };
      }

      setLastCommand(command);
      
      // Update session
      if (sessionRef.current) {
        sessionRef.current.commands.push(command);
        sessionRef.current.transcript += `\n${commandText}`;
      }

      onCommand?.(cleanCommand, detectedMode);

      // Save to backend
      await saveCommandToBackend(command);

    } catch (err: any) {
      setError(err.message);
      console.error("Command processing error:", err);
    } finally {
      setIsProcessing(false);
    }
  }, [activationWord, currentMode, onCommand, onModeChange]);

  // Feature executors
  const executeVoiceChart = async (command: string) => {
    // Parse chart section and content
    const sections = [
      "chief complaint", "hpi", "history", "review of systems", "ros",
      "vitals", "physical exam", "assessment", "plan", "medications"
    ];
    
    const detectedSection = sections.find(s => 
      command.toLowerCase().includes(s)
    );

    return {
      type: "VOICE_CHART",
      section: detectedSection || "general",
      content: command,
      timestamp: new Date().toISOString(),
    };
  };

  const executeDictateNotes = async (command: string) => {
    return {
      type: "DICTATE_NOTES",
      content: command,
      noteType: detectNoteType(command),
      timestamp: new Date().toISOString(),
    };
  };

  const executeAIScribe = async (command: string) => {
    return {
      type: "AI_SCRIBE",
      action: command.toLowerCase().includes("stop") ? "STOP" : "START",
      timestamp: new Date().toISOString(),
    };
  };

  const executeAutoDocument = async (command: string) => {
    const docTypes = [
      "visit summary", "care plan", "referral", "discharge", 
      "procedure note", "lab summary"
    ];
    
    const detectedType = docTypes.find(t => 
      command.toLowerCase().includes(t)
    );

    return {
      type: "AUTO_DOCUMENT",
      documentType: detectedType || "visit summary",
      timestamp: new Date().toISOString(),
    };
  };

  const executeSmartSearch = async (command: string) => {
    return {
      type: "SMART_SEARCH",
      query: command,
      timestamp: new Date().toISOString(),
    };
  };

  const executeFindPatient = async (command: string) => {
    // Enhanced patient name extraction - handles various formats
    // "find patient John Smith", "patient named John", "John Smith", etc.
    const namePatterns = [
      /patient\s+(?:named?\s+)?([a-z]+(?:\s+[a-z]+){0,2})/i,
      /find\s+(?:patient\s+)?([a-z]+(?:\s+[a-z]+){0,2})/i,
      /search\s+(?:for\s+)?(?:patient\s+)?([a-z]+(?:\s+[a-z]+){0,2})/i,
      /(?:named?|called)\s+([a-z]+(?:\s+[a-z]+){0,2})/i,
      /^([a-z]+(?:\s+[a-z]+){0,2})$/i, // Just a name like "John Smith"
    ];
    
    let patientName = null;
    for (const pattern of namePatterns) {
      const match = command.match(pattern);
      if (match && match[1] && match[1].length > 2) {
        patientName = match[1].trim();
        break;
      }
    }
    
    // MRN extraction - handles "MRN 12345", "mrn12345", "number 12345"
    const mrnPatterns = [
      /mrn\s*(?:number)?\s*[:#]?\s*(\d+)/i,
      /(?:medical\s+record\s+)?number\s*(?:is)?\s*[:#]?\s*(\d+)/i,
      /\b(\d{5,10})\b/, // Any 5-10 digit number could be MRN
    ];
    
    let mrn = null;
    for (const pattern of mrnPatterns) {
      const match = command.match(pattern);
      if (match && match[1]) {
        mrn = match[1];
        break;
      }
    }
    
    return {
      type: "FIND_PATIENT",
      patientName,
      mrn,
      timestamp: new Date().toISOString(),
    };
  };

  const detectNoteType = (command: string): string => {
    const types = [
      { keyword: "progress", type: "PROGRESS_NOTE" },
      { keyword: "consult", type: "CONSULTATION_NOTE" },
      { keyword: "procedure", type: "PROCEDURE_NOTE" },
      { keyword: "discharge", type: "DISCHARGE_SUMMARY" },
      { keyword: "operative", type: "OPERATIVE_NOTE" },
      { keyword: "follow", type: "FOLLOW_UP_NOTE" },
    ];
    
    const found = types.find(t => command.toLowerCase().includes(t.keyword));
    return found?.type || "PROGRESS_NOTE";
  };

  const saveCommandToBackend = async (command: VoiceCommand) => {
    try {
      await fetch("/api/voice/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: command.command,
          mode: command.mode,
          success: command.success,
          result: command.result,
          sessionId: sessionRef.current?.id,
        }),
      });
    } catch (err) {
      console.error("Failed to save command:", err);
    }
  };

  // Start listening
  const startListening = useCallback(async () => {
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setError("Speech recognition not supported. Use Chrome or Edge.");
        return;
      }

      // Create new session
      const newSession: MettaSession = {
        id: `session-${Date.now()}`,
        activationWord,
        mode: "IDLE",
        transcript: "",
        commands: [],
        startTime: new Date(),
      };
      
      setSession(newSession);
      sessionRef.current = newSession;

      // Initialize recognition with better settings
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "en-US";
      recognitionRef.current.maxAlternatives = 3; // Get multiple alternatives for better accuracy

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = "";
        let interimTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          setTranscript(prev => prev + " " + finalTranscript);
          processCommand(finalTranscript);
        }
        
        onTranscript?.(interimTranscript || finalTranscript);
      };

      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onend = () => {
        setIsListening(false);
        // Auto-restart if still in session
        if (sessionRef.current) {
          recognitionRef.current?.start();
        }
      };
      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setError(event.error);
      };

      recognitionRef.current.start();

      // Save session to backend
      await fetch("/api/voice/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionType: "GENERAL",
          activationWord,
        }),
      });

    } catch (err: any) {
      setError(err.message);
      console.error("Failed to start listening:", err);
    }
  }, [activationWord, processCommand, onTranscript]);

  // Stop listening
  const stopListening = useCallback(async () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    
    setIsListening(false);
    setCurrentMode("IDLE");
    
    // End session
    if (sessionRef.current) {
      await fetch(`/api/voice/sessions/${sessionRef.current.id}/end`, {
        method: "POST",
      });
      sessionRef.current = null;
      setSession(null);
    }
  }, []);

  // Switch mode manually
  const switchMode = useCallback((mode: VoiceMode) => {
    setCurrentMode(mode);
    onModeChange?.(mode);
  }, [onModeChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  return {
    isListening,
    isProcessing,
    currentMode,
    transcript,
    session,
    lastCommand,
    error,
    activationWord,
    startListening,
    stopListening,
    switchMode,
  };
}
