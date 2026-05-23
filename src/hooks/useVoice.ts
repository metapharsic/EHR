"use client";

import { useState, useCallback, useRef, useEffect } from "react";

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

export interface VoiceSession {
  id: string;
  sessionType: "COMMAND" | "DICTATION" | "AMBIENT_SCRIBE" | "SEARCH";
  transcript?: string;
  commandsDetected: string[];
  actionTaken?: string;
  success: boolean;
  startedAt: string;
}

export interface VoiceCommandResult {
  command: string;
  confidence: number;
  parameters: Record<string, unknown>;
  action: string;
  target?: string;
}

export function useVoice() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [lastCommand, setLastCommand] = useState<VoiceCommandResult | null>(null);
  const [sessions, setSessions] = useState<VoiceSession[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      setIsSupported(!!SpeechRecognition);
    }
  }, []);

  const startListening = useCallback(async (sessionType: VoiceSession["sessionType"] = "COMMAND", patientId?: string) => {
    try {
      setError(null);
      
      if (!isSupported) {
        throw new Error("Speech recognition not supported in this browser");
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onstart = () => {
        setIsListening(true);
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
  }, [isSupported]);

  const stopListening = useCallback(async (sessionType: VoiceSession["sessionType"] = "COMMAND", patientId?: string) => {
    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      
      setIsListening(false);
      setIsProcessing(true);

      // Send transcript to API for processing
      const response = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcript.trim(),
          sessionType,
          patientId,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setLastCommand(result.data.commands?.[0] || null);
        setSessions(prev => [result.data, ...prev]);
      }

      setTranscript("");
      setInterimTranscript("");
      return result.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process voice");
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [transcript]);

  const clearTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const response = await fetch("/api/voice");
      const result = await response.json();
      
      if (result.success) {
        setSessions(result.data);
      }
    } catch (err) {
      console.error("Error fetching voice sessions:", err);
    }
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    lastCommand,
    sessions,
    isProcessing,
    error,
    startListening,
    stopListening,
    clearTranscript,
    fetchSessions,
  };
}
