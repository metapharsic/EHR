"use client";

import { useState, useEffect } from "react";
import { Mic, AlertCircle, CheckCircle, Info } from "lucide-react";

export function VoiceDiagnostic() {
  const [diagnostics, setDiagnostics] = useState<{
    speechRecognition: boolean;
    speechSynthesis: boolean;
    microphone: boolean;
    https: boolean;
    browser: string;
  }>({
    speechRecognition: false,
    speechSynthesis: false,
    microphone: false,
    https: false,
    browser: "",
  });

  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkCapabilities = async () => {
      const results = {
        speechRecognition: !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition,
        speechSynthesis: "speechSynthesis" in window,
        microphone: false,
        https: window.location.protocol === "https:" || window.location.hostname === "localhost",
        browser: navigator.userAgent,
      };

      // Check microphone permission
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        results.microphone = true;
        stream.getTracks().forEach(track => track.stop());
      } catch {
        results.microphone = false;
      }

      setDiagnostics(results);
      setIsChecking(false);
    };

    checkCapabilities();
  }, []);

  if (isChecking) {
    return (
      <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
        <div className="flex items-center gap-2 text-slate-400">
          <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          Checking voice capabilities...
        </div>
      </div>
    );
  }

  const allGood = diagnostics.speechRecognition && diagnostics.speechSynthesis && diagnostics.microphone;

  return (
    <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 space-y-3">
      <div className="flex items-center gap-2">
        <Mic className="w-5 h-5 text-cyan-400" />
        <h3 className="text-sm font-semibold text-white">Voice Assistant Diagnostics</h3>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Speech Recognition</span>
          {diagnostics.speechRecognition ? (
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400" />
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Text-to-Speech</span>
          {diagnostics.speechSynthesis ? (
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400" />
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Microphone Access</span>
          {diagnostics.microphone ? (
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-400" />
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Secure Context</span>
          {diagnostics.https ? (
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          ) : (
            <Info className="w-4 h-4 text-amber-400" />
          )}
        </div>
      </div>

      {!allGood && (
        <div className="pt-2 border-t border-slate-700/50">
          <p className="text-xs text-amber-400">
            {!diagnostics.speechRecognition && "• Use Chrome/Edge for best voice support\n"}
            {!diagnostics.microphone && "• Allow microphone access when prompted\n"}
            {!diagnostics.https && "• Use localhost or HTTPS for voice features"}
          </p>
        </div>
      )}

      {allGood && (
        <div className="pt-2 border-t border-slate-700/50">
          <p className="text-xs text-emerald-400">
            ✓ Voice assistant is ready! Click the microphone button to start.
          </p>
        </div>
      )}
    </div>
  );
}
