"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, MicOff, Sparkles, AlertTriangle, ShieldAlert, CheckCircle,
  Pill, ChevronDown, ChevronRight, Plus, X, Clock, RefreshCw,
  Brain, Zap, FlaskConical, Heart, Activity, AlertCircle, Info,
  Package, DollarSign, FileText, Send, Save, TrendingUp, Beaker,
  Stethoscope, Syringe, BadgeAlert, Scale, Droplet, HeartPulse, User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── Types ───────────────────────────────────────────────────────────────────
interface PatientContext {
  id: string;
  name: string;
  age: number;
  weight?: number;
  gender: string;
  allergies: string[];
  currentMedications: string[];
  labResults?: {
    eGFR?: number;
    creatinine?: number;
    ALT?: number;
    AST?: number;
    A1c?: number;
    INR?: number;
    potassium?: number;
  };
  conditions?: string[];
}

interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: "major" | "moderate" | "minor";
  mechanism: string;
  clinicalEffect: string;
  recommendation: string;
  monitoringRequired?: string;
  evidenceLevel: "high" | "moderate" | "low";
}

interface DoseAdjustment {
  reason: "renal" | "hepatic" | "age" | "weight" | "drug_interaction";
  originalDose: string;
  adjustedDose: string;
  rationale: string;
  monitoringParameters?: string[];
}

interface MedicationSuggestion {
  id: string;
  name: string;
  genericName: string;
  brandNames: string[];
  strength: string;
  dosageForm: string;
  therapeuticClass: string;
  confidence: number;
  reasons: string[];
  suggestedDosing: {
    dose: string;
    frequency: string;
    route: string;
    duration: string;
  };
  warnings: string[];
  doseAdjustment?: DoseAdjustment;
  inStock: boolean;
  stockQuantity: number;
  unitPrice: number;
  alternatives: {
    id: string;
    name: string;
    reason: string;
    priceComparison: "cheaper" | "same" | "expensive";
  }[];
  guidelineReference?: string;
}

interface PolypharmacyAlert {
  riskLevel: "high" | "moderate" | "low";
  totalMedications: number;
  pillBurden: number;
  anticholinergicBurden?: number;
  duplicateTherapies: { drugs: string[]; class: string }[];
  simplificationOpportunities: { current: string[]; combinedOption: string }[];
}

interface SelectedMedication {
  id: string;
  medication: MedicationSuggestion;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  quantity: number;
  instructions: string;
  refills: number;
}

interface MedGeminiPrescriptionPanelProps {
  patient: PatientContext;
  onPrescriptionSaved?: (prescription: any) => void;
}

// ─── Severity Styles ─────────────────────────────────────────────────────────
const SEVERITY_STYLES = {
  major: {
    bg: "bg-rose-50",
    border: "border-rose-300",
    text: "text-rose-800",
    icon: "text-rose-500",
    badge: "bg-rose-100 text-rose-700",
  },
  moderate: {
    bg: "bg-amber-50",
    border: "border-amber-300",
    text: "text-amber-800",
    icon: "text-amber-500",
    badge: "bg-amber-100 text-amber-700",
  },
  minor: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    icon: "text-blue-500",
    badge: "bg-blue-100 text-blue-700",
  },
};

// ─── Drug Interaction Card ───────────────────────────────────────────────────
function InteractionCard({ interaction }: { interaction: DrugInteraction }) {
  const [expanded, setExpanded] = useState(false);
  const style = SEVERITY_STYLES[interaction.severity];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("rounded-xl border p-4 transition-all", style.bg, style.border)}
    >
      <div
        className="flex items-start gap-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {interaction.severity === "major" ? (
          <ShieldAlert className={cn("w-5 h-5 flex-shrink-0 mt-0.5", style.icon)} />
        ) : interaction.severity === "moderate" ? (
          <AlertTriangle className={cn("w-5 h-5 flex-shrink-0 mt-0.5", style.icon)} />
        ) : (
          <Info className={cn("w-5 h-5 flex-shrink-0 mt-0.5", style.icon)} />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("font-semibold", style.text)}>{interaction.drug1}</span>
            <span className="text-slate-400">+</span>
            <span className={cn("font-semibold", style.text)}>{interaction.drug2}</span>
            <Badge className={cn("text-[10px] uppercase ml-auto", style.badge)}>
              {interaction.severity}
            </Badge>
            <Badge variant="outline" className="text-[10px] text-slate-500">
              Evidence: {interaction.evidenceLevel}
            </Badge>
          </div>
          <p className={cn("text-sm mt-1", style.text, "opacity-80")}>
            {interaction.clinicalEffect}
          </p>
        </div>
        <ChevronDown className={cn("w-5 h-5 transition-transform text-slate-400", expanded && "rotate-180")} />
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className={cn("mt-3 pt-3 border-t space-y-3", style.border.replace("border", "border-t"))}>
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-1">Mechanism</p>
                <p className={cn("text-sm", style.text)}>{interaction.mechanism}</p>
              </div>
              <div className={cn("p-3 rounded-lg", style.bg, "border", style.border)}>
                <p className="text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> AI Recommendation
                </p>
                <p className={cn("text-sm font-medium", style.text)}>{interaction.recommendation}</p>
              </div>
              {interaction.monitoringRequired && (
                <div className="flex items-start gap-2 text-sm">
                  <Activity className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <span className="font-medium text-slate-700">Monitoring: </span>
                    <span className="text-slate-600">{interaction.monitoringRequired}</span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Dose Adjustment Alert ───────────────────────────────────────────────────
function DoseAdjustmentAlert({ adjustment }: { adjustment: DoseAdjustment }) {
  const iconMap = {
    renal: Droplet,
    hepatic: HeartPulse,
    age: User,
    weight: Scale,
    drug_interaction: AlertTriangle,
  };
  const Icon = iconMap[adjustment.reason] || AlertCircle;

  return (
    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
      <div className="flex items-start gap-2">
        <Icon className="w-4 h-4 text-amber-600 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-800 capitalize">
            {adjustment.reason} Dose Adjustment Required
          </p>
          <div className="flex items-center gap-2 mt-1 text-sm">
            <span className="text-slate-500 line-through">{adjustment.originalDose}</span>
            <ChevronRight className="w-4 h-4 text-amber-500" />
            <span className="font-bold text-amber-700">{adjustment.adjustedDose}</span>
          </div>
          <p className="text-xs text-amber-700 mt-1">{adjustment.rationale}</p>
          {adjustment.monitoringParameters && (
            <div className="flex flex-wrap gap-1 mt-2">
              {adjustment.monitoringParameters.map((param, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                  Monitor: {param}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Medication Suggestion Card ──────────────────────────────────────────────
function MedicationCard({
  suggestion,
  onAdd,
  onShowAlternatives,
  showingAlternatives,
}: {
  suggestion: MedicationSuggestion;
  onAdd: (med: MedicationSuggestion) => void;
  onShowAlternatives: (id: string | null) => void;
  showingAlternatives: boolean;
}) {
  const confidenceColor =
    suggestion.confidence >= 85 ? "text-emerald-500" :
    suggestion.confidence >= 70 ? "text-cyan-500" :
    "text-amber-500";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 bg-white rounded-xl border border-slate-200 hover:border-cyan-300 hover:shadow-md transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-bold text-slate-900">{suggestion.name}</h4>
            <span className="text-xs text-slate-400">({suggestion.genericName})</span>
            <div className={cn("flex items-center gap-1 text-sm font-bold", confidenceColor)}>
              <TrendingUp className="w-4 h-4" />
              {suggestion.confidence}%
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {suggestion.strength} {suggestion.dosageForm} • {suggestion.therapeuticClass}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => onAdd(suggestion)}
            className="bg-cyan-500 hover:bg-cyan-600 h-8 gap-1"
          >
            <Plus className="w-3 h-3" /> Add
          </Button>
        </div>
      </div>

      {/* Dose Adjustment Alert */}
      {suggestion.doseAdjustment && (
        <div className="mb-3">
          <DoseAdjustmentAlert adjustment={suggestion.doseAdjustment} />
        </div>
      )}

      {/* Warnings */}
      {suggestion.warnings.length > 0 && (
        <div className="mb-3 space-y-1">
          {suggestion.warnings.map((warning, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-rose-600 bg-rose-50 px-2 py-1 rounded">
              <AlertCircle className="w-3 h-3" />
              {warning}
            </div>
          ))}
        </div>
      )}

      {/* Reasons */}
      <div className="flex flex-wrap gap-1 mb-3">
        {suggestion.reasons.slice(0, 3).map((reason, i) => (
          <span key={i} className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
            ✓ {reason}
          </span>
        ))}
      </div>

      {/* Suggested Dosing */}
      <div className="p-2 bg-slate-50 rounded-lg text-xs text-slate-600 mb-3">
        <span className="font-semibold">Suggested: </span>
        {suggestion.suggestedDosing.dose} {suggestion.suggestedDosing.route} {suggestion.suggestedDosing.frequency} × {suggestion.suggestedDosing.duration}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span className={cn("flex items-center gap-1", suggestion.inStock ? "text-emerald-600" : "text-rose-600")}>
            <Package className="w-3 h-3" />
            {suggestion.inStock ? `${suggestion.stockQuantity} in stock` : "Out of stock"}
          </span>
          <span className="flex items-center gap-1 text-slate-500">
            <DollarSign className="w-3 h-3" />
            ${suggestion.unitPrice.toFixed(2)}/unit
          </span>
        </div>
        {suggestion.alternatives.length > 0 && (
          <button
            onClick={() => onShowAlternatives(showingAlternatives ? null : suggestion.id)}
            className="text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
          >
            {suggestion.alternatives.length} alternatives
            <ChevronDown className={cn("w-3 h-3 transition-transform", showingAlternatives && "rotate-180")} />
          </button>
        )}
      </div>

      {/* Guideline Reference */}
      {suggestion.guidelineReference && (
        <p className="text-[10px] text-slate-400 mt-2 italic">
          📚 {suggestion.guidelineReference}
        </p>
      )}

      {/* Alternatives */}
      <AnimatePresence>
        {showingAlternatives && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
              <p className="text-xs font-semibold text-slate-600">Alternative Options:</p>
              {suggestion.alternatives.map((alt) => (
                <div key={alt.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-slate-700">{alt.name}</span>
                    <p className="text-xs text-slate-500">{alt.reason}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn(
                      "text-[10px]",
                      alt.priceComparison === "cheaper" ? "text-emerald-600 border-emerald-300" :
                      alt.priceComparison === "expensive" ? "text-rose-600 border-rose-300" :
                      "text-slate-600"
                    )}>
                      {alt.priceComparison === "cheaper" ? "💰 Cheaper" :
                       alt.priceComparison === "expensive" ? "💸 Premium" : "Same price"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Polypharmacy Alert Panel ────────────────────────────────────────────────
function PolypharmacyPanel({ alert }: { alert: PolypharmacyAlert }) {
  const [expanded, setExpanded] = useState(false);
  const riskColors = {
    high: { bg: "bg-rose-50", border: "border-rose-300", text: "text-rose-700" },
    moderate: { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-700" },
    low: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" },
  };
  const style = riskColors[alert.riskLevel];

  return (
    <div className={cn("rounded-xl border p-4", style.bg, style.border)}>
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <Pill className={cn("w-5 h-5", style.text)} />
          <div>
            <p className={cn("font-semibold", style.text)}>
              Polypharmacy Alert: {alert.totalMedications} Medications
            </p>
            <p className="text-xs text-slate-500">
              Pill burden: ~{alert.pillBurden} pills/day
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={cn("uppercase text-[10px]", style.text, style.bg)}>
            {alert.riskLevel} risk
          </Badge>
          <ChevronDown className={cn("w-5 h-5 text-slate-400 transition-transform", expanded && "rotate-180")} />
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-3">
              {alert.duplicateTherapies.length > 0 && (
                <div className="p-3 bg-white/50 rounded-lg border border-slate-200">
                  <p className="text-xs font-semibold text-slate-700 mb-2">⚠️ Duplicate Therapies Detected</p>
                  {alert.duplicateTherapies.map((dup, i) => (
                    <div key={i} className="text-sm text-slate-600">
                      <span className="font-medium">{dup.class}:</span> {dup.drugs.join(", ")}
                    </div>
                  ))}
                </div>
              )}
              {alert.simplificationOpportunities.length > 0 && (
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <p className="text-xs font-semibold text-emerald-700 mb-2">💡 Simplification Opportunities</p>
                  {alert.simplificationOpportunities.map((opp, i) => (
                    <div key={i} className="text-sm text-emerald-700">
                      Combine {opp.current.join(" + ")} → <span className="font-semibold">{opp.combinedOption}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Patient Context Sidebar ─────────────────────────────────────────────────
function PatientContextBar({ patient }: { patient: PatientContext }) {
  return (
    <div className="p-4 bg-slate-100 rounded-xl space-y-3">
      <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
        <User className="w-4 h-4" /> Patient Context
      </h4>
      
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2 bg-white rounded-lg">
          <p className="text-slate-500">Age</p>
          <p className="font-semibold text-slate-800">{patient.age} years</p>
        </div>
        {patient.weight && (
          <div className="p-2 bg-white rounded-lg">
            <p className="text-slate-500">Weight</p>
            <p className="font-semibold text-slate-800">{patient.weight} kg</p>
          </div>
        )}
      </div>

      {/* Lab Results */}
      {patient.labResults && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-600">Recent Labs</p>
          <div className="grid grid-cols-2 gap-1 text-xs">
            {patient.labResults.eGFR && (
              <div className={cn(
                "p-1.5 rounded",
                patient.labResults.eGFR < 30 ? "bg-rose-100 text-rose-700" :
                patient.labResults.eGFR < 60 ? "bg-amber-100 text-amber-700" :
                "bg-emerald-100 text-emerald-700"
              )}>
                <Droplet className="w-3 h-3 inline mr-1" />
                eGFR: {patient.labResults.eGFR}
              </div>
            )}
            {patient.labResults.A1c && (
              <div className={cn(
                "p-1.5 rounded",
                patient.labResults.A1c > 9 ? "bg-rose-100 text-rose-700" :
                patient.labResults.A1c > 7 ? "bg-amber-100 text-amber-700" :
                "bg-emerald-100 text-emerald-700"
              )}>
                A1c: {patient.labResults.A1c}%
              </div>
            )}
            {patient.labResults.INR && (
              <div className="p-1.5 bg-slate-200 rounded text-slate-700">
                INR: {patient.labResults.INR}
              </div>
            )}
            {patient.labResults.potassium && (
              <div className={cn(
                "p-1.5 rounded",
                patient.labResults.potassium > 5.5 ? "bg-rose-100 text-rose-700" :
                "bg-slate-200 text-slate-700"
              )}>
                K+: {patient.labResults.potassium}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Allergies */}
      {patient.allergies.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-rose-600 mb-1">⚠️ Allergies</p>
          <div className="flex flex-wrap gap-1">
            {patient.allergies.map((a, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full">
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Current Medications */}
      <div>
        <p className="text-xs font-semibold text-slate-600 mb-1">
          Current Medications ({patient.currentMedications.length})
        </p>
        <div className="max-h-24 overflow-y-auto space-y-0.5">
          {patient.currentMedications.map((med, i) => (
            <p key={i} className="text-[11px] text-slate-600 bg-white px-2 py-1 rounded">
              {med}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function MedGeminiPrescriptionPanel({
  patient,
  onPrescriptionSaved,
}: MedGeminiPrescriptionPanelProps) {
  const [isListening, setIsListening] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false); // Shows extraction in progress
  const [transcript, setTranscript] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<MedicationSuggestion[]>([]);
  const [interactions, setInteractions] = useState<DrugInteraction[]>([]);
  const [polypharmacyAlert, setPolypharmacyAlert] = useState<PolypharmacyAlert | null>(null);
  const [safetyAlerts, setSafetyAlerts] = useState<string[]>([]);
  const [selectedMedications, setSelectedMedications] = useState<SelectedMedication[]>([]);
  const [showAlternativesFor, setShowAlternativesFor] = useState<string | null>(null);
  const [aiStats, setAiStats] = useState({ confidence: 0, processingTime: "", model: "" });
  const [interimText, setInterimText] = useState(""); // Shows words as spoken
  const [voiceConfidence, setVoiceConfidence] = useState(0); // Speech confidence
  const [selectedLang, setSelectedLang] = useState<"auto" | "hi-IN" | "en-IN" | "te-IN">("auto");

  const recognitionRef = useRef<any>(null);
  const langCycleRef = useRef(0); // For auto language cycling

  // Language options for voice
  const VOICE_LANGUAGES = [
    { code: "hi-IN", label: "Hindi", flag: "🇮🇳" },
    { code: "en-IN", label: "English (India)", flag: "🇬🇧" },
    { code: "te-IN", label: "Telugu", flag: "🇮🇳" },
    { code: "auto", label: "Auto-detect", flag: "🌐" },
  ];

  // Common misheard word corrections
  const VOICE_CORRECTIONS: Record<string, string> = {
    // Common misheard English
    "fever": "fever", "fevar": "fever", "fiver": "fever",
    "cough": "cough", "cof": "cough", "kof": "cough",
    "headache": "headache", "head ache": "headache", "headeck": "headache",
    "stomach": "stomach", "stomak": "stomach", "tummy": "stomach",
    "vomiting": "vomiting", "vomit": "vomiting", "vomitting": "vomiting",
    "diarrhea": "diarrhea", "diarea": "diarrhea", "loose motion": "diarrhea", "loose motions": "diarrhea",
    "weakness": "weakness", "weekness": "weakness", "weak": "weakness",
    "dizziness": "dizziness", "dizzy": "dizziness", "giddiness": "dizziness",
    "breathlessness": "breathlessness", "breath less": "breathlessness", "breathing problem": "breathlessness",
    "chest pain": "chest pain", "chest pains": "chest pain",
    "body pain": "body pain", "body pains": "body pain", "body ache": "body pain",
    "joint pain": "joint pain", "joints pain": "joint pain",
    "back pain": "back pain", "backpain": "back pain",
    "acidity": "acidity", "gas": "acidity", "gastric": "acidity",
    "cold": "cold", "running nose": "cold", "runny nose": "cold",
    "sore throat": "sore throat", "throat pain": "sore throat",
    // Hindi romanized variations (slang/colloquial)
    "bukhar": "fever", "bukhaar": "fever", "bukaar": "fever", "bokhaar": "fever",
    "khasi": "cough", "khansi": "cough", "khaansi": "cough", "kaasi": "cough",
    "jukam": "cold", "zukam": "cold", "jukaam": "cold", "nazla": "cold",
    "sirdard": "headache", "sar dard": "headache", "sardard": "headache", "sir dard": "headache",
    "pet dard": "stomach pain", "pet mein dard": "stomach pain", "pait dard": "stomach pain",
    "ulti": "vomiting", "ultee": "vomiting", "qay": "vomiting",
    "dast": "diarrhea", "daast": "diarrhea", "pait kharab": "diarrhea", "potty": "diarrhea",
    "kamzori": "weakness", "kamjori": "weakness", "kamzoori": "weakness",
    "chakkar": "dizziness", "chakar": "dizziness", "chakker": "dizziness", "ghoomna": "dizziness",
    "sujan": "swelling", "soojhan": "swelling", "sooj": "swelling",
    "sans": "breathlessness", "saans": "breathlessness", "dam": "breathlessness", "saas phoolna": "breathlessness",
    "thakan": "fatigue", "thakaan": "fatigue", "thakawat": "fatigue",
    "badan dard": "body pain", "jod dard": "joint pain", "jodon mein dard": "joint pain",
    "kamar dard": "back pain", "peeth dard": "back pain",
    "seena dard": "chest pain", "seene mein dard": "chest pain",
    "gala kharab": "sore throat", "gale mein dard": "sore throat",
    "neend nahi": "insomnia", "neend na aana": "insomnia",
    "bhookh nahi": "loss of appetite", "khana nahi khata": "loss of appetite",
    // Telugu romanized variations
    "jwaram": "fever", "jvaram": "fever", "jwaram vastundi": "fever",
    "daggu": "cough", "dagu": "cough", "daggu vastundi": "cough",
    "jalubu": "cold", "jalubu chesinadi": "cold",
    "tala noppi": "headache", "tala noppu": "headache",
    "kadu noppi": "stomach pain", "kadupu noppi": "stomach pain",
    "vantulu": "vomiting", "vanti": "vomiting",
    "virechanalu": "diarrhea",
    "balaveenam": "weakness", "balam ledu": "weakness",
    "tirugutundi": "dizziness", "tala tirugutundi": "dizziness",
    // Duration variations
    "din": "days", "dino": "days", "dinon": "days", "roj": "days",
    "hafte": "week", "hafta": "week", "saptah": "week",
    "mahine": "month", "mahina": "month",
    "kal": "yesterday", "parso": "2 days ago",
    "subah": "morning", "raat": "night", "shaam": "evening",
  };

  // Enhanced voice recognition with multi-language support
  const toggleListening = useCallback(async () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      setInterimText("");
      return;
    }

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("Speech recognition not supported. Use Chrome or Edge.");
        return;
      }

      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.maxAlternatives = 3; // Get multiple alternatives for better accuracy
      
      // Set language based on selection
      if (selectedLang === "auto") {
        // Start with Hindi-Indian English mix
        recognitionRef.current.lang = "hi-IN";
      } else {
        recognitionRef.current.lang = selectedLang;
      }

      recognitionRef.current.onresult = (event: any) => {
        let interim = "";
        let finalText = "";
        let maxConfidence = 0;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          const confidence = result[0].confidence || 0.8;
          
          maxConfidence = Math.max(maxConfidence, confidence);

          if (result.isFinal) {
            // Apply corrections to final text
            let corrected = transcript.toLowerCase();
            
            // Apply word-by-word corrections
            Object.entries(VOICE_CORRECTIONS).forEach(([wrong, right]) => {
              const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
              corrected = corrected.replace(regex, right);
            });
            
            finalText += corrected + " ";
          } else {
            interim += transcript;
          }
        }

        setVoiceConfidence(Math.round(maxConfidence * 100));
        setInterimText(interim);
        
        if (finalText.trim()) {
          setTranscript(prev => {
            const newText = (prev + " " + finalText).trim();
            return newText;
          });
        }
      };

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        setVoiceConfidence(0);
      };
      
      recognitionRef.current.onend = () => {
        // Auto-restart for continuous listening in auto mode
        if (isListening && selectedLang === "auto") {
          // Cycle through languages
          const langs = ["hi-IN", "en-IN", "te-IN"];
          langCycleRef.current = (langCycleRef.current + 1) % langs.length;
          recognitionRef.current.lang = langs[langCycleRef.current];
          try {
            recognitionRef.current.start();
          } catch (e) {
            setIsListening(false);
          }
        } else {
          setIsListening(false);
        }
        setInterimText("");
      };
      
      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech error:", event.error);
        if (event.error === "no-speech") {
          // Continue listening, don't stop
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current.start();
    } catch (err) {
      console.error("Voice error:", err);
    }
  }, [isListening, selectedLang]);

  // Multilingual keyword mapping (uses same comprehensive list as VOICE_CORRECTIONS)
  // This is used for symptom extraction from the corrected transcript
  const LOCAL_SYMPTOMS: Record<string, string> = {
    // Use the comprehensive VOICE_CORRECTIONS for extraction too
    ...VOICE_CORRECTIONS,
    // Additional Devanagari script mappings
    "बुखार": "fever", "खांसी": "cough", "जुकाम": "cold",
    "सिरदर्द": "headache", "उल्टी": "vomiting", "दस्त": "diarrhea",
    "दर्द": "pain", "कमजोरी": "weakness", "थकान": "fatigue",
    "सूजन": "swelling", "सांस": "breathlessness", "पेट": "stomach",
    // Telugu script
    "జ్వరం": "fever", "దగ్గు": "cough", "జలుబు": "cold", "నొప్పి": "pain",
    // Duration Devanagari
    "दिन": "days", "हफ्ते": "week",
  };

  // Extract diagnosis from transcript (multilingual)
  useEffect(() => {
    if (!transcript) return;
    
    setIsExtracting(true); // Show extraction is happening
    
    const lower = transcript.toLowerCase();
    const extractedSymptoms: string[] = [];
    let extractedDuration = "";
    
    // Extract local language symptoms
    Object.entries(LOCAL_SYMPTOMS).forEach(([local, english]) => {
      if (lower.includes(local.toLowerCase())) {
        if (!extractedSymptoms.includes(english) && !['days', 'week'].includes(english)) {
          extractedSymptoms.push(english);
        }
      }
    });
    
    // Extract duration (e.g., "3 din", "2 days")
    const durationMatch = lower.match(/(\d+)\s*(din|days?|hafte|weeks?|दिन|हफ्ते)/i);
    if (durationMatch) {
      extractedDuration = `${durationMatch[1]} ${durationMatch[2].includes('din') || durationMatch[2].includes('दिन') ? 'days' : durationMatch[2]}`;
    }
    
    // English patterns
    const diagMatch = transcript.match(/(?:diagnosed with|diagnosis is|assessment|impression|looks like)\s+([^.]+)/i);
    if (diagMatch) setDiagnosis(diagMatch[1].trim());

    const symptomMatches = transcript.match(/(?:complaining of|symptoms?|c\/o|has|experiencing|fever|cough|pain|headache)\s*([^.]*)/gi);
    if (symptomMatches) {
      symptomMatches.forEach(s => {
        const cleaned = s.replace(/(?:complaining of|symptoms?|c\/o|has|experiencing)\s*/i, "").trim();
        if (cleaned && !extractedSymptoms.includes(cleaned.toLowerCase())) {
          extractedSymptoms.push(cleaned.toLowerCase());
        }
      });
    }
    
    // Set symptoms and auto-generate diagnosis
    if (extractedSymptoms.length > 0) {
      setSymptoms(extractedSymptoms);
      
      // Auto-generate likely diagnosis based on symptoms
      if (!diagnosis) {
        if (extractedSymptoms.includes('fever')) {
          setDiagnosis(`Fever${extractedDuration ? ` (${extractedDuration})` : ''} - Viral syndrome vs bacterial infection`);
        } else if (extractedSymptoms.includes('cough')) {
          setDiagnosis('Upper respiratory infection');
        } else if (extractedSymptoms.includes('headache')) {
          setDiagnosis('Tension headache vs migraine');
        }
      }
    }
    
    setIsExtracting(false); // Extraction complete
  }, [transcript, diagnosis]);

  // Analyze with Med-Gemini
  const analyzeWithMedGemini = useCallback(async () => {
    if (!diagnosis && symptoms.length === 0) return;

    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/med-gemini/prescribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          diagnosis,
          symptoms,
          patient,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuggestions(data.data.suggestions || []);
        setInteractions(data.data.interactions || []);
        setPolypharmacyAlert(data.data.polypharmacyAlert);
        setSafetyAlerts(data.data.safetyAlerts || []);
        setAiStats({
          confidence: data.data.aiConfidence,
          processingTime: data.data.processingTime,
          model: data.data.model,
        });
      }
    } catch (err) {
      console.error("Med-Gemini error:", err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [diagnosis, symptoms, transcript, patient]);

  // Auto-analyze on diagnosis change (reduced debounce for faster response)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (diagnosis || symptoms.length > 0) {
        analyzeWithMedGemini();
      }
    }, 300); // Reduced from 1000ms for faster response
    return () => clearTimeout(timer);
  }, [diagnosis, symptoms, analyzeWithMedGemini]);

  // Add medication to prescription
  const addMedication = (med: MedicationSuggestion) => {
    setSelectedMedications(prev => [
      ...prev,
      {
        id: `sel-${Date.now()}`,
        medication: med,
        dosage: med.doseAdjustment?.adjustedDose || med.suggestedDosing.dose,
        frequency: med.suggestedDosing.frequency,
        route: med.suggestedDosing.route,
        duration: med.suggestedDosing.duration,
        quantity: 30,
        instructions: "",
        refills: 2,
      },
    ]);
  };

  const removeMedication = (id: string) => {
    setSelectedMedications(prev => prev.filter(m => m.id !== id));
  };

  const savePrescription = async () => {
    // Would call API to save
    onPrescriptionSaved?.({
      patientId: patient.id,
      diagnosis,
      medications: selectedMedications,
      transcript,
    });
  };

  const majorInteractions = interactions.filter(i => i.severity === "major").length;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between p-6 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl text-white">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Brain className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Med-Gemini Prescription Intelligence</h1>
              <p className="text-violet-200">AI-powered prescribing with safety guardrails</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-white/20 text-white border-white/30">
              <Sparkles className="w-3 h-3 mr-1" /> {aiStats.model || "Med-Gemini v2.1"}
            </Badge>
            {aiStats.processingTime && (
              <Badge variant="outline" className="border-white/30 text-white">
                <Zap className="w-3 h-3 mr-1" /> {aiStats.processingTime}
              </Badge>
            )}
          </div>
        </div>

        {/* Safety Alerts Banner */}
        {(safetyAlerts.length > 0 || majorInteractions > 0) && (
          <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl">
            <div className="flex items-center gap-2 text-rose-700 font-semibold mb-2">
              <ShieldAlert className="w-5 h-5" />
              Safety Alerts ({safetyAlerts.length + majorInteractions})
            </div>
            <div className="space-y-1">
              {safetyAlerts.map((alert, i) => (
                <p key={i} className="text-sm text-rose-600">{alert}</p>
              ))}
              {majorInteractions > 0 && (
                <p className="text-sm text-rose-600">
                  ⚠️ {majorInteractions} major drug interaction(s) detected - review below
                </p>
              )}
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Input & Context */}
          <div className="space-y-4">
            {/* Voice Capture */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Mic className="w-4 h-4 text-violet-500" />
                  Voice Capture
                  {voiceConfidence > 0 && (
                    <Badge variant="outline" className={cn(
                      "text-[10px] ml-1",
                      voiceConfidence >= 80 ? "text-emerald-600 border-emerald-300" :
                      voiceConfidence >= 50 ? "text-amber-600 border-amber-300" :
                      "text-rose-600 border-rose-300"
                    )}>
                      {voiceConfidence}% confidence
                    </Badge>
                  )}
                </h3>
                <div className="flex items-center gap-2">
                  {/* Language Selector */}
                  <select
                    value={selectedLang}
                    onChange={(e) => setSelectedLang(e.target.value as any)}
                    disabled={isListening}
                    className="text-xs border border-slate-200 rounded px-2 py-1 bg-slate-50"
                  >
                    {VOICE_LANGUAGES.map(lang => (
                      <option key={lang.code} value={lang.code}>
                        {lang.flag} {lang.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    onClick={toggleListening}
                    className={cn(
                      "gap-1",
                      isListening ? "bg-rose-500 hover:bg-rose-600 animate-pulse" : "bg-violet-500 hover:bg-violet-600"
                    )}
                  >
                    {isListening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                    {isListening ? "Stop" : "Record"}
                  </Button>
                </div>
              </div>
              
              {/* Real-time interim text (words being spoken) */}
              {isListening && interimText && (
                <div className="mb-2 p-2 bg-violet-50 rounded-lg border border-violet-200">
                  <p className="text-xs text-violet-500 mb-1">Hearing...</p>
                  <p className="text-sm text-violet-700 italic animate-pulse">{interimText}</p>
                </div>
              )}
              
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Record or type the doctor-patient conversation..."
                className="w-full h-28 p-3 bg-slate-50 rounded-lg text-sm border border-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />

              {/* Listening/Extracting indicator */}
              {isListening && (
                <div className="mt-2 flex items-center gap-2 text-xs text-violet-600">
                  <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                  Listening... Speak in Hindi or English
                </div>
              )}
              {isExtracting && !isListening && (
                <div className="mt-2 flex items-center gap-2 text-xs text-violet-600">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Extracting symptoms...
                </div>
              )}

              {/* Extracted Info */}
              {(diagnosis || symptoms.length > 0) && (
                <div className="mt-3 p-3 bg-violet-50 rounded-lg space-y-2">
                  {diagnosis && (
                    <div className="flex items-center gap-2 text-xs">
                      <Stethoscope className="w-3 h-3 text-violet-500" />
                      <span className="text-slate-500">Diagnosis:</span>
                      <Badge className="bg-violet-100 text-violet-700">{diagnosis}</Badge>
                    </div>
                  )}
                  {symptoms.length > 0 && (
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      <span className="text-slate-500">Symptoms:</span>
                      {symptoms.map((s, i) => (
                        <Badge key={i} variant="outline" className="text-slate-600">{s}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <Button
                onClick={analyzeWithMedGemini}
                disabled={isAnalyzing || (!diagnosis && symptoms.length === 0)}
                className="w-full mt-3 bg-gradient-to-r from-violet-500 to-indigo-500 gap-2"
              >
                {isAnalyzing ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Analyzing with Med-Gemini...</>
                ) : (
                  <><Brain className="w-4 h-4" /> Analyze & Suggest</>
                )}
              </Button>
            </div>

            {/* Patient Context */}
            <PatientContextBar patient={patient} />
          </div>

          {/* Middle Column - AI Suggestions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-500" />
                AI Medication Suggestions
              </h3>
              {aiStats.confidence > 0 && (
                <Badge className="bg-emerald-100 text-emerald-700">
                  {aiStats.confidence}% confidence
                </Badge>
              )}
            </div>

            {suggestions.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
                <Brain className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Record conversation or enter diagnosis to get AI suggestions</p>
              </div>
            ) : (
              <div className="space-y-3">
                {suggestions.map((sug) => (
                  <MedicationCard
                    key={sug.id}
                    suggestion={sug}
                    onAdd={addMedication}
                    onShowAlternatives={setShowAlternativesFor}
                    showingAlternatives={showAlternativesFor === sug.id}
                  />
                ))}
              </div>
            )}

            {/* Drug Interactions */}
            {interactions.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-rose-500" />
                  Drug Interactions ({interactions.length})
                </h3>
                {interactions.map((int, i) => (
                  <InteractionCard key={i} interaction={int} />
                ))}
              </div>
            )}

            {/* Polypharmacy Alert */}
            {polypharmacyAlert && <PolypharmacyPanel alert={polypharmacyAlert} />}
          </div>

          {/* Right Column - Prescription Builder */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-500" />
              Prescription ({selectedMedications.length})
            </h3>

            {selectedMedications.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
                <Pill className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Add medications from AI suggestions</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedMedications.map((item) => (
                  <div key={item.id} className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-bold text-slate-800">{item.medication.name}</h4>
                        <p className="text-xs text-slate-500">{item.medication.strength}</p>
                      </div>
                      <button onClick={() => removeMedication(item.id)} className="text-slate-400 hover:text-rose-500">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {item.medication.doseAdjustment && (
                      <div className="mb-2 p-2 bg-amber-50 rounded text-xs text-amber-700">
                        ⚠️ Dose adjusted: {item.medication.doseAdjustment.adjustedDose}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-slate-50 rounded">
                        <p className="text-slate-500">Dose</p>
                        <p className="font-medium">{item.dosage}</p>
                      </div>
                      <div className="p-2 bg-slate-50 rounded">
                        <p className="text-slate-500">Frequency</p>
                        <p className="font-medium">{item.frequency}</p>
                      </div>
                      <div className="p-2 bg-slate-50 rounded">
                        <p className="text-slate-500">Route</p>
                        <p className="font-medium">{item.route}</p>
                      </div>
                      <div className="p-2 bg-slate-50 rounded">
                        <p className="text-slate-500">Duration</p>
                        <p className="font-medium">{item.duration}</p>
                      </div>
                    </div>
                  </div>
                ))}

                <Button
                  onClick={savePrescription}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 gap-2"
                >
                  <Save className="w-4 h-4" /> Sign & Send to Pharmacy
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
