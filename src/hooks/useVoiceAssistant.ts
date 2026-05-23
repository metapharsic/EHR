"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

// Type definitions for Web Speech API
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export type VoiceCommandType = 
  | "NAVIGATE"
  | "SEARCH_PATIENT"
  | "OPEN_PATIENT"
  | "CREATE_APPOINTMENT"
  | "OPEN_SCRIBE"
  | "SHOW_DASHBOARD"
  | "SHOW_TIMELINE"
  | "SHOW_GENOMICS"
  | "LOGOUT"
  | "UNKNOWN";

export interface VoiceCommand {
  type: VoiceCommandType;
  action: string;
  parameters: Record<string, string>;
  confidence: number;
  rawText: string;
}

export interface VoiceAssistantResponse {
  text: string;
  action?: string;
  success: boolean;
}

export function useVoiceAssistant(assistantName: string = "Metta") {
  const router = useRouter();
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [lastResponse, setLastResponse] = useState<VoiceAssistantResponse | null>(null);
  const [conversation, setConversation] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const wakeupDetectedRef = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      setIsSupported(!!SpeechRecognition);
    }
  }, []);

  // Parse command from transcript
  const parseCommand = useCallback((text: string): VoiceCommand => {
    const lowerText = text.toLowerCase();
    
    // Check for wakeup word
    const wakeupPattern = new RegExp(`\\b${assistantName.toLowerCase()}\\b`);
    const hasWakeup = wakeupPattern.test(lowerText);
    
    if (!hasWakeup && !wakeupDetectedRef.current) {
      return { type: "UNKNOWN", action: "none", parameters: {}, confidence: 0, rawText: text };
    }

    // Remove wakeup word from command
    const commandText = lowerText.replace(wakeupPattern, "").trim();
    
    // Navigation commands
    if (commandText.includes("dashboard") || commandText.includes("home")) {
      return { type: "SHOW_DASHBOARD", action: "navigate", parameters: { path: "/" }, confidence: 0.9, rawText: text };
    }
    
    if (commandText.includes("timeline") || commandText.includes("predictions")) {
      return { type: "SHOW_TIMELINE", action: "navigate", parameters: { path: "/timeline" }, confidence: 0.9, rawText: text };
    }
    
    if (commandText.includes("genomics") || commandText.includes("dna") || commandText.includes("genetic")) {
      return { type: "SHOW_GENOMICS", action: "navigate", parameters: { path: "/genomics" }, confidence: 0.9, rawText: text };
    }

    // Patient commands
    if (commandText.includes("open patient") || commandText.includes("show patient")) {
      const patientMatch = commandText.match(/patient\s+(\w+\s*\w*)/i);
      const patientName = patientMatch ? patientMatch[1] : "";
      return { 
        type: "OPEN_PATIENT", 
        action: "navigate", 
        parameters: { path: "/patients", query: patientName }, 
        confidence: 0.85, 
        rawText: text 
      };
    }

    if (commandText.includes("find patient") || commandText.includes("search patient")) {
      const patientMatch = commandText.match(/patient\s+(\w+\s*\w*)/i);
      const patientName = patientMatch ? patientMatch[1] : "";
      return { 
        type: "SEARCH_PATIENT", 
        action: "search", 
        parameters: { query: patientName }, 
        confidence: 0.85, 
        rawText: text 
      };
    }

    // Scribe commands
    if (commandText.includes("scribe") || commandText.includes("take notes") || commandText.includes("start recording")) {
      return { type: "OPEN_SCRIBE", action: "open_modal", parameters: {}, confidence: 0.9, rawText: text };
    }

    // Appointment commands
    if (commandText.includes("schedule") || commandText.includes("appointment") || commandText.includes("book")) {
      return { type: "CREATE_APPOINTMENT", action: "open_modal", parameters: {}, confidence: 0.8, rawText: text };
    }

    // Logout
    if (commandText.includes("logout") || commandText.includes("sign out")) {
      return { type: "LOGOUT", action: "logout", parameters: {}, confidence: 0.95, rawText: text };
    }

    return { type: "UNKNOWN", action: "none", parameters: {}, confidence: 0.3, rawText: text };
  }, [assistantName]);

  // Execute command
  const executeCommand = useCallback(async (command: VoiceCommand): Promise<VoiceAssistantResponse> => {
    switch (command.type) {
      case "SHOW_DASHBOARD":
        router.push("/");
        return { text: `Opening dashboard, Doctor.`, action: "navigate", success: true };

      case "SHOW_TIMELINE":
        router.push("/timeline");
        return { text: `Showing predictive timeline.`, action: "navigate", success: true };

      case "SHOW_GENOMICS":
        router.push("/genomics");
        return { text: `Opening genomic profile view.`, action: "navigate", success: true };

      case "OPEN_PATIENT":
        if (command.parameters.query) {
          router.push(`/patients?search=${encodeURIComponent(command.parameters.query)}`);
          return { text: `Searching for patient ${command.parameters.query}.`, action: "search", success: true };
        }
        router.push("/patients");
        return { text: `Opening patient list.`, action: "navigate", success: true };

      case "SEARCH_PATIENT":
        return { text: `Searching for ${command.parameters.query || "patients"}...`, action: "search", success: true };

      case "OPEN_SCRIBE":
        return { text: `Starting ambient scribe. I'm listening.`, action: "open_scribe", success: true };

      case "CREATE_APPOINTMENT":
        return { text: `Opening appointment scheduler.`, action: "open_scheduler", success: true };

      case "LOGOUT":
        router.push("/auth/signout");
        return { text: `Signing you out. Have a great day, Doctor.`, action: "logout", success: true };

      case "UNKNOWN":
        return { text: `I'm sorry, I didn't understand that command. You can ask me to open the dashboard, find a patient, or start the scribe.`, success: false };

      default:
        return { text: `Command received.`, success: true };
    }
  }, [router]);

  // Start listening for commands
  const startListening = useCallback(() => {
    try {
      setError(null);
      
      if (!isSupported) {
        setError("Voice recognition not supported in this browser");
        return;
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        wakeupDetectedRef.current = false;
      };

      recognitionRef.current.onresult = (event: Event) => {
        const speechEvent = event as SpeechRecognitionEvent;
        let interim = "";
        let final = "";

        for (let i = speechEvent.resultIndex; i < speechEvent.results.length; i++) {
          const transcript = speechEvent.results[i][0].transcript;
          if (speechEvent.results[i].isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }

        setInterimTranscript(interim);
        
        if (final) {
          setTranscript(prev => prev + " " + final);
          
          // Check for wakeup word
          const wakeupPattern = new RegExp(`\\b${assistantName.toLowerCase()}\\b`, "i");
          if (wakeupPattern.test(final)) {
            wakeupDetectedRef.current = true;
          }
        }
      };

      recognitionRef.current.onerror = (event: Event) => {
        const errorEvent = event as SpeechRecognitionErrorEvent;
        console.error("Speech recognition error:", errorEvent.error);
        setError(errorEvent.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.start();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start listening");
    }
  }, [isSupported, assistantName]);

  // Stop listening and process command
  const stopListening = useCallback(async () => {
    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      
      setIsListening(false);
      setIsProcessing(true);

      const fullTranscript = transcript.trim();
      
      if (fullTranscript) {
        // Add user message to conversation
        setConversation(prev => [...prev, { role: "user", text: fullTranscript }]);

        // Parse and execute command
        const command = parseCommand(fullTranscript);
        const response = await executeCommand(command);
        
        // Add assistant response to conversation
        setConversation(prev => [...prev, { role: "assistant", text: response.text }]);
        setLastResponse(response);

        // Log to API
        await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: fullTranscript,
            sessionType: "COMMAND",
            command: command.type,
            response: response.text,
          }),
        });
      }

      setTranscript("");
      setInterimTranscript("");
      wakeupDetectedRef.current = false;
      
      return lastResponse;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process command");
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [transcript, parseCommand, executeCommand, lastResponse]);

  // Quick command without continuous listening
  const sendCommand = useCallback(async (text: string) => {
    setConversation(prev => [...prev, { role: "user", text }]);
    
    const command = parseCommand(text);
    const response = await executeCommand(command);
    
    setConversation(prev => [...prev, { role: "assistant", text: response.text }]);
    setLastResponse(response);
    
    return response;
  }, [parseCommand, executeCommand]);

  // Clear conversation
  const clearConversation = useCallback(() => {
    setConversation([]);
    setLastResponse(null);
    setTranscript("");
    setInterimTranscript("");
  }, []);

  // Speak response using TTS
  const speak = useCallback((text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  return {
    assistantName,
    isListening,
    isProcessing,
    isSupported,
    transcript,
    interimTranscript,
    lastResponse,
    conversation,
    error,
    startListening,
    stopListening,
    sendCommand,
    clearConversation,
    speak,
  };
}
