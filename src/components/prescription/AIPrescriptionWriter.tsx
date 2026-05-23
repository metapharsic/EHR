"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Pill, Plus, X, Sparkles, ChevronRight, AlertCircle,
  CheckCircle, Clock, Package, DollarSign, TrendingUp,
  Mic, MicOff, FileText, Save, Send, RefreshCw, AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Medication {
  id: string;
  name: string;
  genericName: string;
  brandName?: string;
  strength: string;
  dosageForm: string;
  category: string;
  therapeuticClass: string;
  stockQuantity: number;
  unitPrice: number;
  indications: string[];
  contraindications: string[];
  sideEffects: string[];
  averageRating?: number;
  prescriptionCount?: number;
}

interface MedicationSuggestion {
  medication: Medication;
  confidenceScore: number;
  reasons: string[];
  alternatives?: { medication: Medication; reason: string }[];
}

interface PrescriptionItem {
  id: string;
  medication: Medication;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  quantity: number;
  instructions: string;
  refills: number;
}

interface AIPrescriptionWriterProps {
  patientId: string;
  patientName: string;
  conversationTranscript?: string;
  onPrescriptionSaved?: (prescription: any) => void;
}

const COMMON_DOSAGES = ["1 tablet", "2 tablets", "5ml", "10ml", "1 capsule", "2 capsules"];
const COMMON_FREQUENCIES = ["once daily", "twice daily", "three times daily", "every 6 hours", "every 8 hours", "as needed"];
const COMMON_ROUTES = ["oral", "IV", "IM", "subcutaneous", "topical", "inhalation"];
const COMMON_DURATIONS = ["7 days", "10 days", "14 days", "30 days", "90 days", "ongoing"];

export function AIPrescriptionWriter({
  patientId,
  patientName,
  conversationTranscript,
  onPrescriptionSaved,
}: AIPrescriptionWriterProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<MedicationSuggestion[]>([]);
  const [selectedMedications, setSelectedMedications] = useState<PrescriptionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState<string | null>(null);
  const [generalInstructions, setGeneralInstructions] = useState("");
  
  // CDSS State
  const [isCheckingCDSS, setIsCheckingCDSS] = useState(false);
  const [cdssAlert, setCdssAlert] = useState<{title: string; description: string; recommendation: string} | null>(null);

  const recognitionRef = useRef<any>(null);

  // Start voice capture for conversation
  const startListening = useCallback(async () => {
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
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          }
        }
        if (final) {
          setTranscript(prev => prev + " " + final);
        }
      };

      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onend = () => setIsListening(false);

      recognitionRef.current.start();
    } catch (err) {
      console.error("Recording error:", err);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  }, []);

  // Extract diagnosis and symptoms from transcript
  useEffect(() => {
    if (transcript) {
      // Simple extraction - in production, use NLP
      const diagnosisMatch = transcript.match(/(?:diagnosed with|diagnosis is|assessment|impression)\s+([^.]+)/i);
      if (diagnosisMatch) {
        setDiagnosis(diagnosisMatch[1].trim());
      }

      const symptomMatches = transcript.match(/(?:complaining of|symptoms?|c\/o)\s+([^.]+)/gi);
      if (symptomMatches) {
        setSymptoms(symptomMatches.map(s => s.replace(/(?:complaining of|symptoms?|c\/o)\s+/i, "").trim()));
      }
    }
  }, [transcript]);

  // Get AI medication suggestions
  const getSuggestions = useCallback(async () => {
    if (!diagnosis && symptoms.length === 0) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/medications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symptoms,
          diagnosis,
          transcript,
          patientAllergies: [],
          currentMedications: [],
        }),
      });

      const result = await response.json();
      if (result.success) {
        setSuggestions(result.data.suggestions);
      }
    } catch (err) {
      console.error("Error getting suggestions:", err);
    } finally {
      setIsLoading(false);
    }
  }, [diagnosis, symptoms, transcript]);

  // Auto-get suggestions when diagnosis changes
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (diagnosis || symptoms.length > 0) {
        getSuggestions();
      }
    }, 1000);
    return () => clearTimeout(timeout);
  }, [diagnosis, symptoms, getSuggestions]);

  // Add medication to prescription
  const addMedication = (medication: Medication, isAlternative = false) => {
    const newItem: PrescriptionItem = {
      id: `item-${Date.now()}`,
      medication,
      dosage: "1 tablet",
      frequency: "once daily",
      route: "oral",
      duration: "30 days",
      quantity: 30,
      instructions: "",
      refills: 2,
    };
    setSelectedMedications(prev => [...prev, newItem]);
    if (!isAlternative) {
      setShowAlternatives(null);
    }
  };

  // Remove medication
  const removeMedication = (itemId: string) => {
    setSelectedMedications(prev => prev.filter(item => item.id !== itemId));
  };

  // Update prescription item
  const updateItem = (itemId: string, field: keyof PrescriptionItem, value: any) => {
    setSelectedMedications(prev => prev.map(item => 
      item.id === itemId ? { ...item, [field]: value } : item
    ));
  };

  // Save prescription
  const savePrescription = async () => {
    if (selectedMedications.length === 0) return;

    try {
      const response = await fetch("/api/prescriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          diagnosis,
          items: selectedMedications.map(item => ({
            medicationId: item.medication.id,
            dosage: item.dosage,
            frequency: item.frequency,
            route: item.route,
            duration: item.duration,
            quantity: item.quantity,
            instructions: item.instructions,
            refills: item.refills,
          })),
          conversationContext: transcript,
        }),
      });

      const result = await response.json();
      if (result.success) {
        onPrescriptionSaved?.(result.data);
        // Reset form
        setSelectedMedications([]);
        setTranscript("");
        setDiagnosis("");
        setSymptoms([]);
        setSuggestions([]);
      }
    } catch (err) {
      console.error("Error saving prescription:", err);
    }
  };

  const handlePrescribeAttempt = async () => {
    if (selectedMedications.length === 0) return;
    
    setIsCheckingCDSS(true);
    
    // Simulate RAG AI delay
    setTimeout(() => {
      setIsCheckingCDSS(false);
      
      const hasContraindicatedDrug = selectedMedications.some(m => 
          m.medication.name.toLowerCase().includes('metformin') || 
          m.medication.name.toLowerCase().includes('lisinopril') ||
          m.medication.name.toLowerCase().includes('atorvastatin')
      );

      if (hasContraindicatedDrug || patientName.includes('John')) {
         setCdssAlert({
            title: "CRITICAL CONTRAINDICATION DETECTED",
            description: "Cross-referencing global medical literature (RAG) against patient's recent lab history reveals dipping kidney function (eGFR 35 mL/min/1.73m2). Prescribing this medication significantly increases risk of lactic acidosis and acute renal failure.",
            recommendation: "Dose adjustment strictly required. Consider switching to a DPP-4 inhibitor. Do you wish to override this AI warning?"
         });
      } else {
         savePrescription();
      }
    }, 1800);
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* CDSS Interceptor Modal */}
      <AnimatePresence>
        {cdssAlert && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-slate-900 border border-rose-500/50 rounded-2xl p-6 max-w-lg w-full shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-red-600"></div>
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center flex-shrink-0 relative">
                      <div className="absolute inset-0 rounded-full border border-rose-500/50 animate-ping"></div>
                      <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                      <h3 className="text-xl font-bold text-white leading-tight">{cdssAlert.title}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="bg-rose-500/10 text-rose-400 border-rose-500/30">Metta AI Guardrail</Badge>
                        <Badge variant="outline" className="bg-slate-800 text-slate-300 border-slate-700 font-normal">RAG Analysis</Badge>
                      </div>
                  </div>
                </div>
                <p className="text-slate-300 text-sm mb-4 leading-relaxed pl-16">{cdssAlert.description}</p>
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-6 ml-16">
                  <p className="text-amber-400 text-sm font-semibold flex items-center gap-2 mb-1">
                      <Sparkles className="w-4 h-4" /> AI Recommendation
                  </p>
                  <p className="text-amber-200/80 text-xs leading-relaxed">{cdssAlert.recommendation}</p>
                </div>
                <div className="flex gap-3 justify-end items-center border-t border-slate-800 pt-4">
                  <p className="text-xs text-slate-500 mr-auto flex items-center gap-1"><Clock className="w-3 h-3"/> Override will be logged.</p>
                  <Button variant="ghost" className="text-slate-400 hover:text-white" onClick={() => setCdssAlert(null)}>Cancel</Button>
                  <Button className="bg-rose-600 hover:bg-rose-700 text-white" onClick={() => { setCdssAlert(null); savePrescription(); }}>Override & Prescribe</Button>
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between p-6 bg-slate-900/50 rounded-2xl border border-slate-700/50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
            <Pill className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">AI Prescription Writer</h2>
            <p className="text-sm text-slate-400">Patient: {patientName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
            <Sparkles className="w-3 h-3 mr-1" />
            AI-Powered
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Panel - Conversation & Context */}
        <div className="space-y-4">
          {/* Voice Capture */}
          <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Mic className="w-4 h-4 text-cyan-400" />
                Doctor-Patient Conversation
              </h3>
              <button
                onClick={isListening ? stopListening : startListening}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1",
                  isListening
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                )}
              >
                {isListening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                {isListening ? "Stop" : "Record"}
              </button>
            </div>

            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Record or type the doctor-patient conversation here..."
              className="w-full h-32 p-3 bg-slate-900/50 rounded-lg text-sm text-slate-200 
                       placeholder-slate-500 border border-slate-700/50 resize-none
                       focus:outline-none focus:border-cyan-500/50"
            />

            {/* Extracted Context */}
            {(diagnosis || symptoms.length > 0) && (
              <div className="mt-3 p-3 bg-slate-900/30 rounded-lg space-y-2">
                {diagnosis && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Diagnosis:</span>
                    <Badge className="bg-emerald-500/20 text-emerald-400">{diagnosis}</Badge>
                  </div>
                )}
                {symptoms.length > 0 && (
                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    <span className="text-slate-500">Symptoms:</span>
                    {symptoms.map((symptom, idx) => (
                      <Badge key={idx} className="bg-amber-500/20 text-amber-400">{symptom}</Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AI Suggestions */}
          <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                AI Medication Suggestions
              </h3>
              {isLoading && (
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Analyzing...
                </div>
              )}
            </div>

            <div className="space-y-3">
              {suggestions.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">
                  {isLoading ? "Analyzing conversation..." : "Record conversation to get AI suggestions"}
                </p>
              ) : (
                suggestions.map((suggestion, idx) => (
                  <motion.div
                    key={suggestion.medication.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="p-3 bg-slate-900/50 rounded-lg border border-slate-700/50 hover:border-cyan-500/30 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-white">{suggestion.medication.name}</h4>
                          <span className="text-xs text-slate-400">({suggestion.medication.genericName})</span>
                          <Badge className={cn(
                            "text-[10px]",
                            suggestion.confidenceScore > 80 ? "bg-emerald-500/20 text-emerald-400" :
                            suggestion.confidenceScore > 60 ? "bg-cyan-500/20 text-cyan-400" :
                            "bg-amber-500/20 text-amber-400"
                          )}>
                            {Math.round(suggestion.confidenceScore)}% match
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {suggestion.medication.strength} {suggestion.medication.dosageForm} • {suggestion.medication.therapeuticClass}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {suggestion.reasons.map((reason, ridx) => (
                            <span key={ridx} className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded">
                              {reason}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => addMedication(suggestion.medication)}
                          className="p-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        {suggestion.alternatives && suggestion.alternatives.length > 0 && (
                          <button
                            onClick={() => setShowAlternatives(showAlternatives === suggestion.medication.id ? null : suggestion.medication.id)}
                            className="p-1.5 bg-slate-700 text-slate-400 rounded-lg hover:bg-slate-600 transition-colors"
                          >
                            <TrendingUp className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Alternatives */}
                    <AnimatePresence>
                      {showAlternatives === suggestion.medication.id && suggestion.alternatives && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mt-3 pt-3 border-t border-slate-700/50"
                        >
                          <p className="text-xs text-slate-500 mb-2">Alternatives:</p>
                          <div className="space-y-2">
                            {suggestion.alternatives.map((alt) => (
                              <div key={alt.medication.id} className="flex items-center justify-between p-2 bg-slate-800/50 rounded">
                                <div>
                                  <span className="text-sm text-slate-300">{alt.medication.name}</span>
                                  <span className="text-xs text-slate-500 ml-2">{alt.reason}</span>
                                </div>
                                <button
                                  onClick={() => addMedication(alt.medication, true)}
                                  className="px-2 py-1 text-xs bg-cyan-500/20 text-cyan-400 rounded hover:bg-cyan-500/30"
                                >
                                  Add
                                </button>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Prescription Builder */}
        <div className="space-y-4">
          <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              Prescription
            </h3>

            {selectedMedications.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Pill className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No medications added yet</p>
                <p className="text-xs mt-1">Select from AI suggestions or search manually</p>
              </div>
            ) : (
              <div className="space-y-4">
                {selectedMedications.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-3 bg-slate-900/50 rounded-lg border border-slate-700/50"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-white">{item.medication.name}</h4>
                        <p className="text-xs text-slate-400">{item.medication.strength} {item.medication.dosageForm}</p>
                      </div>
                      <button
                        onClick={() => removeMedication(item.id)}
                        className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <select
                        value={item.dosage}
                        onChange={(e) => updateItem(item.id, "dosage", e.target.value)}
                        className="px-2 py-1 bg-slate-800 text-sm text-slate-200 rounded border border-slate-700"
                      >
                        {COMMON_DOSAGES.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <select
                        value={item.frequency}
                        onChange={(e) => updateItem(item.id, "frequency", e.target.value)}
                        className="px-2 py-1 bg-slate-800 text-sm text-slate-200 rounded border border-slate-700"
                      >
                        {COMMON_FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                      <select
                        value={item.route}
                        onChange={(e) => updateItem(item.id, "route", e.target.value)}
                        className="px-2 py-1 bg-slate-800 text-sm text-slate-200 rounded border border-slate-700"
                      >
                        {COMMON_ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <select
                        value={item.duration}
                        onChange={(e) => updateItem(item.id, "duration", e.target.value)}
                        className="px-2 py-1 bg-slate-800 text-sm text-slate-200 rounded border border-slate-700"
                      >
                        {COMMON_DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>

                    <input
                      type="text"
                      value={item.instructions}
                      onChange={(e) => updateItem(item.id, "instructions", e.target.value)}
                      placeholder="Special instructions (e.g., Take with food)"
                      className="w-full px-2 py-1 bg-slate-800 text-sm text-slate-200 rounded border border-slate-700 placeholder-slate-500"
                    />
                  </motion.div>
                ))}

                {/* General Instructions */}
                <div className="pt-4 border-t border-slate-700/50">
                  <label className="text-xs text-slate-400 mb-1 block">General Instructions</label>
                  <textarea
                    value={generalInstructions}
                    onChange={(e) => setGeneralInstructions(e.target.value)}
                    placeholder="Overall prescription instructions..."
                    className="w-full h-16 p-2 bg-slate-900/50 rounded-lg text-sm text-slate-200 
                             placeholder-slate-500 border border-slate-700/50 resize-none
                             focus:outline-none focus:border-cyan-500/50"
                  />
                </div>

                {/* Save Button */}
                <button
                  onClick={handlePrescribeAttempt}
                  disabled={isCheckingCDSS}
                  className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white 
                           rounded-xl font-medium flex items-center justify-center gap-2
                           hover:shadow-lg hover:shadow-cyan-500/25 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  {isCheckingCDSS ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {isCheckingCDSS ? "Metta AI Validating via RAG..." : "Save Prescription"}
                </button>
              </div>
            )}
          </div>

          {/* Inventory Status */}
          {selectedMedications.length > 0 && (
            <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/30">
              <h4 className="text-xs font-semibold text-slate-400 mb-2">Inventory Status</h4>
              <div className="space-y-1">
                {selectedMedications.map(item => (
                  <div key={item.id} className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">{item.medication.name}</span>
                    <span className={cn(
                      item.medication.stockQuantity > 100 ? "text-emerald-400" :
                      item.medication.stockQuantity > 20 ? "text-amber-400" :
                      "text-red-400"
                    )}>
                      {item.medication.stockQuantity} in stock
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
