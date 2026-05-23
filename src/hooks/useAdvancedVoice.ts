"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

export type VoiceMode = 
  | "IDLE"
  | "CHART"
  | "DICTATE"
  | "SCRIBE"
  | "AUTO_DOCUMENT"
  | "SMART_SEARCH"
  | "FIND_PATIENT"
  | "NEW_PATIENT";

export interface VoiceCommandResult {
  mode: VoiceMode;
  intent: string;
  confidence: number;
  entities: Record<string, unknown>;
  action: string;
  response: string;
}

export function useAdvancedVoice(assistantName: string = "Metta") {
  const router = useRouter();
  const [mode, setMode] = useState<VoiceMode>("IDLE");
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [generatedNote, setGeneratedNote] = useState<string>("");
  const [lastResult, setLastResult] = useState<VoiceCommandResult | null>(null);
  const [conversation, setConversation] = useState<Array<{ role: "user" | "assistant"; text: string; mode?: VoiceMode }>>([]);
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);

  // Parse voice commands
  const parseCommand = useCallback((text: string, currentMode: VoiceMode): VoiceCommandResult => {
    const lowerText = text.toLowerCase();
    
    // Mode switching commands
    if (lowerText.includes("chart") || lowerText.includes("document encounter")) {
      return {
        mode: "CHART",
        intent: "clinical_charting",
        confidence: 0.95,
        entities: {},
        action: "switch_mode",
        response: "Clinical charting mode activated. I will help document this encounter.",
      };
    }

    if (lowerText.includes("dictate") || lowerText.includes("take notes")) {
      return {
        mode: "DICTATE",
        intent: "medical_dictation",
        confidence: 0.95,
        entities: {},
        action: "switch_mode",
        response: "Dictation mode active. Speak naturally and I will transcribe with medical formatting.",
      };
    }

    if (lowerText.includes("scribe") || lowerText.includes("ambient")) {
      return {
        mode: "SCRIBE",
        intent: "ambient_documentation",
        confidence: 0.95,
        entities: {},
        action: "switch_mode",
        response: "Ambient scribe activated. I will listen and generate a clinical note from your conversation.",
      };
    }

    if (lowerText.includes("auto document") || lowerText.includes("generate note")) {
      return {
        mode: "AUTO_DOCUMENT",
        intent: "auto_generate",
        confidence: 0.9,
        entities: {},
        action: "generate_note",
        response: "Generating comprehensive clinical note from encounter data...",
      };
    }

    if (lowerText.includes("smart search") || lowerText.includes("find patient")) {
      const query = lowerText.replace(/.*(?:find patient|smart search|search for)/i, "").trim();
      return {
        mode: "SMART_SEARCH",
        intent: "nlp_search",
        confidence: 0.88,
        entities: { query },
        action: "search",
        response: query ? `Searching for "${query}" using AI-powered semantic search.` : "What patient would you like me to find?",
      };
    }

    if (lowerText.includes("new patient") || lowerText.includes("register patient")) {
      return {
        mode: "NEW_PATIENT",
        intent: "voice_registration",
        confidence: 0.92,
        entities: {},
        action: "start_registration",
        response: "Starting voice-guided patient registration. What is the patient's full name?",
      };
    }

    // Context-aware responses
    if (currentMode === "CHART") {
      // Extract medical information
      const meds: string[] = [];
      const medMatch = text.match(/(\d+\s*mg\s+\w+|metformin|lisinopril|atorvastatin)/gi);
      if (medMatch) meds.push(...medMatch);

      const vitals: Record<string, string> = {};
      const bpMatch = text.match(/(?:blood pressure|bp)\s+(?:is|of)?\s*(\d{2,3}\/\d{2,3})/i);
      if (bpMatch) vitals.bp = bpMatch[1];
      const hrMatch = text.match(/(?:heart rate|pulse)\s+(?:is|of)?\s*(\d{2,3})/i);
      if (hrMatch) vitals.hr = hrMatch[1];

      return {
        mode: "CHART",
        intent: "document_data",
        confidence: 0.85,
        entities: { medications: meds, vitals },
        action: "document",
        response: `Documented ${meds.length} medications. Vitals: ${Object.entries(vitals).map(([k,v]) => `${k}: ${v}`).join(", ") || "none recorded"}.`,
      };
    }

    if (currentMode === "DICTATE") {
      return {
        mode: "DICTATE",
        intent: "transcribe",
        confidence: 0.9,
        entities: { text },
        action: "transcribe",
        response: "Transcribed and formatted.",
      };
    }

    if (currentMode === "NEW_PATIENT") {
      const nameMatch = text.match(/(?:name is|I'm|this is)\s+([\w\s]+)/i);
      if (nameMatch) {
        return {
          mode: "NEW_PATIENT",
          intent: "collect_name",
          confidence: 0.9,
          entities: { name: nameMatch[1].trim() },
          action: "collect",
          response: `Name recorded: ${nameMatch[1].trim()}. What is the date of birth?`,
        };
      }
      
      const dobMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
      if (dobMatch) {
        return {
          mode: "NEW_PATIENT",
          intent: "collect_dob",
          confidence: 0.9,
          entities: { dob: dobMatch[1] },
          action: "collect",
          response: `Date of birth: ${dobMatch[1]}. What is the phone number?`,
        };
      }
    }

    return {
      mode: currentMode,
      intent: "unknown",
      confidence: 0.3,
      entities: {},
      action: "clarify",
      response: `I can help with: "${assistantName}, chart", "${assistantName}, dictate", "${assistantName}, scribe", "${assistantName}, find patient", or "${assistantName}, new patient"`,
    };
  }, [assistantName]);

  // Start listening
  const startListening = useCallback(async (targetMode: VoiceMode = "IDLE") => {
    try {
      setMode(targetMode);
      setError(null);
      
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        throw new Error("Speech recognition not supported");
      }

      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onstart = () => setIsListening(true);

      recognitionRef.current.onresult = (event: any) => {
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += t;
          } else {
            interim += t;
          }
        }

        setInterimTranscript(interim);
        if (final) setTranscript(prev => prev + " " + final);
      };

      recognitionRef.current.onerror = (event: any) => {
        setError(event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => setIsListening(false);
      recognitionRef.current.start();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start");
    }
  }, []);

  // Stop and process
  const stopListening = useCallback(async () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    
    setIsListening(false);
    setIsProcessing(true);

    const fullTranscript = transcript.trim();
    
    if (fullTranscript) {
      const result = parseCommand(fullTranscript, mode);
      setLastResult(result);
      setMode(result.mode);
      
      setConversation(prev => [
        ...prev,
        { role: "user", text: fullTranscript, mode },
        { role: "assistant", text: result.response, mode: result.mode },
      ]);

      // Execute action
      if (result.action === "search" && result.entities.query) {
        router.push(`/patients?search=${encodeURIComponent(result.entities.query as string)}`);
      } else if (result.action === "start_registration") {
        router.push("/patients/new");
      } else if (result.action === "generate_note") {
        // Simulate note generation
        setGeneratedNote(`CLINICAL NOTE\n\nGenerated by AI Scribe\n\nTranscript Summary:\n${conversation.map(c => c.text).join("\n")}`);
      }
    }

    setTranscript("");
    setInterimTranscript("");
    setIsProcessing(false);
  }, [transcript, mode, parseCommand, router, conversation]);

  return {
    mode,
    isListening,
    isProcessing,
    transcript,
    interimTranscript,
    generatedNote,
    lastResult,
    conversation,
    error,
    startListening,
    stopListening,
    setMode,
  };
}
