"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, X, MessageSquare, Sparkles } from "lucide-react";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";

interface VoiceAssistantProps {
  assistantName?: string;
}

export function VoiceAssistant({ assistantName = "Metta" }: VoiceAssistantProps) {
  const {
    assistantName: name,
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
  } = useVoiceAssistant(assistantName);

  const [isOpen, setIsOpen] = useState(false);
  const [textInput, setTextInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  // Speak response when received
  useEffect(() => {
    if (lastResponse?.text && isOpen) {
      speak(lastResponse.text);
    }
  }, [lastResponse, isOpen, speak]);

  const handleToggleListening = async () => {
    if (isListening) {
      await stopListening();
    } else {
      startListening();
    }
  };

  const handleSendText = async () => {
    if (!textInput.trim()) return;
    await sendCommand(textInput);
    setTextInput("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSendText();
    }
  };

  if (!isSupported) {
    return null;
  }

  return (
    <>
      {/* Floating Voice Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 
                   shadow-lg shadow-cyan-500/30 flex items-center justify-center
                   hover:shadow-cyan-500/50 transition-shadow"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        animate={isListening ? { scale: [1, 1.1, 1] } : {}}
        transition={isListening ? { repeat: Infinity, duration: 1.5 } : {}}
      >
        {isListening ? (
          <div className="relative">
            <Mic className="w-6 h-6 text-white" />
            {/* Ripple effect */}
            <motion.div
              className="absolute inset-0 rounded-full bg-white/30"
              animate={{ scale: [1, 2], opacity: [0.5, 0] }}
              transition={{ repeat: Infinity, duration: 1 }}
            />
          </div>
        ) : (
          <Sparkles className="w-6 h-6 text-white" />
        )}
      </motion.button>

      {/* Voice Assistant Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-3rem)]
                       bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-slate-700/50
                       shadow-2xl shadow-black/50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 
                                flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">{name}</h3>
                  <p className="text-xs text-slate-400">
                    {isListening ? "Listening..." : isProcessing ? "Thinking..." : "Say my name to wake me"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={clearConversation}
                  className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                  title="Clear conversation"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="h-80 overflow-y-auto p-4 space-y-4">
              {conversation.length === 0 ? (
                <div className="text-center text-slate-500 py-8">
                  <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Say <span className="text-cyan-400 font-medium">"Hey {name}"</span> to start</p>
                  <div className="mt-4 space-y-2 text-xs text-slate-600">
                    <p>• "{name}, open dashboard"</p>
                    <p>• "{name}, find patient John Smith"</p>
                    <p>• "{name}, start scribe"</p>
                    <p>• "{name}, show timeline"</p>
                  </div>
                </div>
              ) : (
                <>
                  {conversation.map((msg, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
                          msg.role === "user"
                            ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-br-md"
                            : "bg-slate-800 text-slate-200 rounded-bl-md"
                        }`}
                      >
                        {msg.text}
                      </div>
                    </motion.div>
                  ))}
                  
                  {/* Live transcript */}
                  {(transcript || interimTranscript) && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex justify-end"
                    >
                      <div className="max-w-[80%] px-4 py-2 rounded-2xl text-sm 
                                      bg-slate-800/50 text-slate-400 rounded-br-md border border-slate-700/50">
                        {transcript} <span className="text-slate-500">{interimTranscript}</span>
                        <span className="inline-block w-0.5 h-4 bg-cyan-400 ml-1 animate-pulse" />
                      </div>
                    </motion.div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            {/* Input Area */}
            <div className="p-4 border-t border-slate-700/50 space-y-3">
              {/* Text Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={`Or type "${name}, ..."`}
                  className="flex-1 px-3 py-2 bg-slate-800 rounded-lg text-sm text-white 
                           placeholder-slate-500 border border-slate-700/50
                           focus:outline-none focus:border-cyan-500/50"
                />
                <button
                  onClick={handleSendText}
                  disabled={!textInput.trim() || isProcessing}
                  className="px-3 py-2 bg-slate-800 rounded-lg text-slate-400 
                           hover:text-white disabled:opacity-50 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              </div>

              {/* Voice Button */}
              <button
                onClick={handleToggleListening}
                disabled={isProcessing}
                className={`w-full py-3 rounded-xl font-medium text-sm transition-all
                          flex items-center justify-center gap-2
                          ${isListening 
                            ? "bg-red-500/20 text-red-400 border border-red-500/30" 
                            : "bg-gradient-to-r from-cyan-500 to-blue-500 text-white"
                          }`}
              >
                {isListening ? (
                  <>
                    <MicOff className="w-4 h-4" />
                    Stop Listening
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    Hold to Speak to {name}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
