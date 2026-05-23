"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Brain,
  Network,
  Zap,
  Search,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Microscope,
  Dna,
  Activity,
  Target,
  ChevronRight,
  RotateCcw,
  Lightbulb,
  Stethoscope,
  Thermometer,
  Heart,
  Wind,
  BrainCircuit,
} from "lucide-react";

interface SymptomNode {
  id: string;
  name: string;
  category: string;
  x: number;
  y: number;
  connections: string[];
  severity: number;
  confidence: number;
  relatedConditions: string[];
}

interface DiagnosisCluster {
  id: string;
  name: string;
  probability: number;
  symptoms: string[];
  urgency: "critical" | "high" | "medium" | "low";
  recommendedTests: string[];
  aiConfidence: number;
}

const initialSymptoms: SymptomNode[] = [
  { id: "1", name: "Chest Pain", category: "cardiac", x: 50, y: 30, connections: ["2", "3", "4"], severity: 8, confidence: 95, relatedConditions: ["Angina", "MI", "Costochondritis"] },
  { id: "2", name: "Shortness of Breath", category: "respiratory", x: 70, y: 40, connections: ["1", "5", "6"], severity: 7, confidence: 92, relatedConditions: ["COPD", "Heart Failure", "Anxiety"] },
  { id: "3", name: "Fatigue", category: "systemic", x: 30, y: 50, connections: ["1", "7", "8"], severity: 6, confidence: 88, relatedConditions: ["Anemia", "Hypothyroidism", "Depression"] },
  { id: "4", name: "Palpitations", category: "cardiac", x: 60, y: 20, connections: ["1", "9"], severity: 5, confidence: 90, relatedConditions: ["Arrhythmia", "Anxiety", "Hyperthyroidism"] },
  { id: "5", name: "Cough", category: "respiratory", x: 80, y: 50, connections: ["2", "10"], severity: 4, confidence: 94, relatedConditions: ["Pneumonia", "Bronchitis", "COVID-19"] },
  { id: "6", name: "Dizziness", category: "neurological", x: 40, y: 35, connections: ["2", "11"], severity: 5, confidence: 85, relatedConditions: ["Vertigo", "Hypotension", "Anemia"] },
  { id: "7", name: "Weight Loss", category: "metabolic", x: 20, y: 60, connections: ["3", "12"], severity: 6, confidence: 87, relatedConditions: ["Diabetes", "Hyperthyroidism", "Cancer"] },
  { id: "8", name: "Sleep Issues", category: "psychological", x: 25, y: 40, connections: ["3", "13"], severity: 4, confidence: 91, relatedConditions: ["Insomnia", "Sleep Apnea", "Anxiety"] },
  { id: "9", name: "Anxiety", category: "psychological", x: 55, y: 15, connections: ["4", "13"], severity: 5, confidence: 93, relatedConditions: ["GAD", "Panic Disorder", "Hyperthyroidism"] },
  { id: "10", name: "Fever", category: "infectious", x: 85, y: 60, connections: ["5", "14"], severity: 6, confidence: 96, relatedConditions: ["Infection", "Inflammation", "Autoimmune"] },
  { id: "11", name: "Headache", category: "neurological", x: 35, y: 25, connections: ["6", "15"], severity: 5, confidence: 89, relatedConditions: ["Migraine", "Tension", "Hypertension"] },
  { id: "12", name: "Increased Thirst", category: "metabolic", x: 15, y: 70, connections: ["7", "16"], severity: 5, confidence: 88, relatedConditions: ["Diabetes", "Dehydration", "Hypercalcemia"] },
  { id: "13", name: "Depression", category: "psychological", x: 30, y: 30, connections: ["8", "9"], severity: 7, confidence: 90, relatedConditions: ["MDD", "Bipolar", "Hypothyroidism"] },
  { id: "14", name: "Night Sweats", category: "infectious", x: 75, y: 70, connections: ["10", "17"], severity: 5, confidence: 82, relatedConditions: ["TB", "Lymphoma", "Menopause"] },
  { id: "15", name: "Visual Changes", category: "neurological", x: 45, y: 20, connections: ["11", "18"], severity: 7, confidence: 86, relatedConditions: ["Migraine", "Stroke", "Glaucoma"] },
  { id: "16", name: "Frequent Urination", category: "metabolic", x: 10, y: 65, connections: ["12", "19"], severity: 4, confidence: 91, relatedConditions: ["Diabetes", "UTI", "BPH"] },
  { id: "17", name: "Swollen Lymph Nodes", category: "immunological", x: 70, y: 75, connections: ["14", "20"], severity: 6, confidence: 84, relatedConditions: ["Infection", "Lymphoma", "Autoimmune"] },
  { id: "18", name: "Weakness", category: "neurological", x: 40, y: 45, connections: ["15", "3"], severity: 6, confidence: 87, relatedConditions: ["Stroke", "MS", "Guillain-Barré"] },
  { id: "19", name: "Nausea", category: "gastrointestinal", x: 5, y: 55, connections: ["16", "21"], severity: 4, confidence: 89, relatedConditions: ["Gastritis", "Pregnancy", "Medication"] },
  { id: "20", name: "Joint Pain", category: "immunological", x: 65, y: 80, connections: ["17", "22"], severity: 5, confidence: 85, relatedConditions: ["Arthritis", "Lupus", "Lyme Disease"] },
  { id: "21", name: "Abdominal Pain", category: "gastrointestinal", x: 8, y: 45, connections: ["19", "23"], severity: 6, confidence: 88, relatedConditions: ["Appendicitis", "IBS", "Pancreatitis"] },
  { id: "22", name: "Rash", category: "dermatological", x: 60, y: 85, connections: ["20", "24"], severity: 3, confidence: 86, relatedConditions: ["Allergic Reaction", "Autoimmune", "Infection"] },
  { id: "23", name: "Diarrhea", category: "gastrointestinal", x: 3, y: 40, connections: ["21", "25"], severity: 4, confidence: 92, relatedConditions: ["Gastroenteritis", "IBD", "Celiac"] },
  { id: "24", name: "Photosensitivity", category: "dermatological", x: 50, y: 90, connections: ["22", "26"], severity: 4, confidence: 81, relatedConditions: ["Lupus", "Porphyria", "Medication"] },
  { id: "25", name: "Bloating", category: "gastrointestinal", x: 6, y: 35, connections: ["23", "27"], severity: 3, confidence: 87, relatedConditions: ["IBS", "SIBO", "Food Intolerance"] },
  { id: "26", name: "Hair Loss", category: "dermatological", x: 45, y: 95, connections: ["24", "28"], severity: 3, confidence: 83, relatedConditions: ["Thyroid", "Alopecia", "Stress"] },
  { id: "27", name: "Heartburn", category: "gastrointestinal", x: 12, y: 30, connections: ["25", "29"], severity: 3, confidence: 93, relatedConditions: ["GERD", "Hiatal Hernia", "Ulcer"] },
  { id: "28", name: "Dry Skin", category: "dermatological", x: 38, y: 92, connections: ["26", "30"], severity: 2, confidence: 85, relatedConditions: ["Hypothyroidism", "Dehydration", "Eczema"] },
  { id: "29", name: "Difficulty Swallowing", category: "gastrointestinal", x: 18, y: 25, connections: ["27", "31"], severity: 5, confidence: 84, relatedConditions: ["Achalasia", "Stricture", "Stroke"] },
  { id: "30", name: "Brittle Nails", category: "dermatological", x: 32, y: 88, connections: ["28", "32"], severity: 2, confidence: 79, relatedConditions: ["Iron Deficiency", "Hypothyroidism", "Psoriasis"] },
  { id: "31", name: "Hoarseness", category: "respiratory", x: 25, y: 20, connections: ["29", "33"], severity: 4, confidence: 88, relatedConditions: ["Laryngitis", "Thyroid", "Laryngeal Cancer"] },
  { id: "32", name: "Cold Intolerance", category: "metabolic", x: 28, y: 75, connections: ["30", "7"], severity: 3, confidence: 86, relatedConditions: ["Hypothyroidism", "Anemia", "Circulation"] },
  { id: "33", name: "Wheezing", category: "respiratory", x: 35, y: 15, connections: ["31", "2"], severity: 6, confidence: 91, relatedConditions: ["Asthma", "COPD", "Heart Failure"] },
];

const diagnosisClusters: DiagnosisCluster[] = [
  {
    id: "c1",
    name: "Cardiovascular Syndrome",
    probability: 78,
    symptoms: ["Chest Pain", "Shortness of Breath", "Palpitations", "Fatigue"],
    urgency: "high",
    recommendedTests: ["ECG", "Troponin", "Echocardiogram", "Stress Test"],
    aiConfidence: 89,
  },
  {
    id: "c2",
    name: "Metabolic Disorder",
    probability: 65,
    symptoms: ["Increased Thirst", "Frequent Urination", "Fatigue", "Weight Loss"],
    urgency: "medium",
    recommendedTests: ["HbA1c", "Fasting Glucose", "Insulin Level", "C-Peptide"],
    aiConfidence: 92,
  },
  {
    id: "c3",
    name: "Autoimmune Pattern",
    probability: 43,
    symptoms: ["Joint Pain", "Rash", "Fatigue", "Swollen Lymph Nodes"],
    urgency: "medium",
    recommendedTests: ["ANA", "RF", "Anti-CCP", "ESR/CRP"],
    aiConfidence: 76,
  },
];

export function NeuralSymptomMapper() {
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>(["1", "2", "3"]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showConnections, setShowConnections] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const toggleSymptom = useCallback((id: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }, []);

  const filteredSymptoms = initialSymptoms.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getConnectedNodes = (nodeId: string) => {
    const node = initialSymptoms.find((s) => s.id === nodeId);
    return node?.connections || [];
  };

  return (
    <Card className="glass-card border-0 overflow-hidden">
      <CardHeader className="border-b border-slate-100 ">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500">
              <Network className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Neural Symptom Mapper</CardTitle>
              <p className="text-xs text-slate-500">AI-powered pattern recognition & differential diagnosis</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search symptoms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            <Button
              variant="outline"
              className={showConnections ? "bg-cyan-50 text-cyan-600" : ""}
              onClick={() => setShowConnections(!showConnections)}
            >
              <Network className="h-4 w-4 mr-1" />
              Connections
            </Button>
            <Button variant="outline" onClick={() => setSelectedSymptoms([])}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="grid lg:grid-cols-3">
          {/* Neural Network Visualization */}
          <div className="lg:col-span-2 h-[600px] relative bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 overflow-hidden">
            {/* Background Grid */}
            <div className="absolute inset-0 opacity-10">
              <svg width="100%" height="100%">
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#06b6d4" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>
            </div>

            {/* Connection Lines */}
            {showConnections && selectedSymptoms.map((symptomId) => {
              const node = initialSymptoms.find((s) => s.id === symptomId);
              if (!node) return null;
              
              return node.connections.map((targetId) => {
                const target = initialSymptoms.find((s) => s.id === targetId);
                if (!target) return null;
                
                const isHighlighted = hoveredNode === symptomId || hoveredNode === targetId;
                const isSelected = selectedSymptoms.includes(targetId);
                
                return (
                  <svg
                    key={`${symptomId}-${targetId}`}
                    className="absolute inset-0 pointer-events-none"
                    style={{ zIndex: 1 }}
                  >
                    <motion.line
                      x1={`${node.x}%`}
                      y1={`${node.y}%`}
                      x2={`${target.x}%`}
                      y2={`${target.y}%`}
                      stroke={isSelected ? "#06b6d4" : "#475569"}
                      strokeWidth={isHighlighted ? 3 : 1}
                      strokeOpacity={isSelected ? 0.8 : 0.3}
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.5 }}
                    />
                  </svg>
                );
              });
            })}

            {/* Symptom Nodes */}
            {filteredSymptoms.map((symptom) => {
              const isSelected = selectedSymptoms.includes(symptom.id);
              const isConnected = selectedSymptoms.some((id) =>
                getConnectedNodes(id).includes(symptom.id)
              );
              const isHighlighted = hoveredNode === symptom.id;
              
              const categoryColors: Record<string, string> = {
                cardiac: "from-rose-500 to-pink-500",
                respiratory: "from-cyan-500 to-blue-500",
                neurological: "from-purple-500 to-indigo-500",
                metabolic: "from-amber-500 to-orange-500",
                psychological: "from-violet-500 to-purple-500",
                infectious: "from-emerald-500 to-teal-500",
                immunological: "from-lime-500 to-green-500",
                gastrointestinal: "from-yellow-500 to-amber-500",
                dermatological: "from-fuchsia-500 to-pink-500",
                systemic: "from-slate-500 to-gray-500",
              };

              return (
                <motion.button
                  key={symptom.id}
                  className={cn(
                    "absolute transform -translate-x-1/2 -translate-y-1/2",
                    "px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300",
                    "border-2",
                    isSelected
                      ? cn("bg-gradient-to-r text-white border-transparent shadow-lg", categoryColors[symptom.category])
                      : isConnected
                      ? "bg-slate-800 text-cyan-400 border-cyan-500/50"
                      : "bg-slate-800/50 text-slate-400 border-slate-700 hover:border-slate-500"
                  )}
                  style={{
                    left: `${symptom.x}%`,
                    top: `${symptom.y}%`,
                    zIndex: isHighlighted ? 10 : isSelected ? 5 : 2,
                    boxShadow: isSelected
                      ? `0 0 20px ${symptom.severity > 7 ? '#f43f5e' : '#06b6d4'}40`
                      : undefined,
                  }}
                  onClick={() => toggleSymptom(symptom.id)}
                  onMouseEnter={() => setHoveredNode(symptom.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: parseInt(symptom.id) * 0.02 }}
                >
                  {symptom.name}
                  {isSelected && (
                    <span className="ml-1.5 text-[10px] opacity-80">
                      {symptom.confidence}%
                    </span>
                  )}
                </motion.button>
              );
            })}

            {/* Center AI Hub */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <motion.div
                className="relative"
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              >
                <div className="w-24 h-24 rounded-full bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 opacity-20 blur-xl" />
              </motion.div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                  <Brain className="h-8 w-8 text-white" />
                </div>
              </div>
              {/* Orbiting dots */}
              {[0, 1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 rounded-full bg-cyan-400"
                  animate={{
                    x: [0, 60, 0, -60, 0],
                    y: [60, 0, -60, 0, 60],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    delay: i * 1,
                    ease: "linear",
                  }}
                  style={{
                    left: '50%',
                    top: '50%',
                    marginLeft: '-4px',
                    marginTop: '-4px',
                  }}
                />
              ))}
            </div>

            {/* Stats Overlay */}
            <div className="absolute top-4 left-4 right-4 flex justify-between">
              <div className="glass rounded-xl px-4 py-2">
                <p className="text-xs text-slate-400">Selected Symptoms</p>
                <p className="text-xl font-bold text-white">{selectedSymptoms.length}</p>
              </div>
              <div className="glass rounded-xl px-4 py-2">
                <p className="text-xs text-slate-400">Pattern Matches</p>
                <p className="text-xl font-bold text-cyan-400">{diagnosisClusters.length}</p>
              </div>
              <div className="glass rounded-xl px-4 py-2">
                <p className="text-xs text-slate-400">AI Confidence</p>
                <p className="text-xl font-bold text-purple-400">
                  {Math.round(diagnosisClusters.reduce((acc, c) => acc + c.aiConfidence, 0) / diagnosisClusters.length)}%
                </p>
              </div>
            </div>
          </div>

          {/* Diagnosis Panel */}
          <div className="p-6 bg-slate-50  border-l border-slate-100 ">
            <div className="flex items-center gap-2 mb-4">
              <BrainCircuit className="h-5 w-5 text-purple-500" />
              <h3 className="font-semibold text-slate-800 ">AI Diagnosis Clusters</h3>
            </div>

            <div className="space-y-4">
              {diagnosisClusters.map((cluster, index) => (
                <motion.div
                  key={cluster.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    "glass-card rounded-xl p-4 cursor-pointer transition-all",
                    "hover:shadow-lg border-l-4",
                    cluster.urgency === "critical" && "border-l-rose-500",
                    cluster.urgency === "high" && "border-l-amber-500",
                    cluster.urgency === "medium" && "border-l-cyan-500",
                    cluster.urgency === "low" && "border-l-emerald-500"
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-sm text-slate-800 ">
                        {cluster.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          className={cn(
                            "text-[10px] border-0",
                            cluster.urgency === "critical" && "bg-rose-100 text-rose-700",
                            cluster.urgency === "high" && "bg-amber-100 text-amber-700",
                            cluster.urgency === "medium" && "bg-cyan-100 text-cyan-700",
                            cluster.urgency === "low" && "bg-emerald-100 text-emerald-700"
                          )}
                        >
                          {cluster.urgency} urgency
                        </Badge>
                        <span className="text-[10px] text-slate-400">
                          {cluster.aiConfidence}% AI confidence
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-slate-800 ">
                        {cluster.probability}%
                      </p>
                      <p className="text-[10px] text-slate-400">match</p>
                    </div>
                  </div>

                  {/* Matching Symptoms */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {cluster.symptoms.map((symptom) => (
                      <span
                        key={symptom}
                        className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full",
                          selectedSymptoms.some(
                            (id) => initialSymptoms.find((s) => s.id === id)?.name === symptom
                          )
                            ? "bg-cyan-100 text-cyan-700"
                            : "bg-slate-100 text-slate-600"
                        )}
                      >
                        {symptom}
                      </span>
                    ))}
                  </div>

                  {/* Recommended Tests */}
                  <div className="pt-3 border-t border-slate-100 ">
                    <p className="text-[10px] text-slate-500 mb-2 flex items-center gap-1">
                      <Microscope className="h-3 w-3" />
                      Recommended Tests
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {cluster.recommendedTests.map((test) => (
                        <span
                          key={test}
                          className="text-[10px] px-2 py-0.5 rounded bg-purple-100 text-purple-700"
                        >
                          {test}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* AI Insight */}
            <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-4 w-4 text-indigo-500 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-slate-700 ">
                    Pattern Recognition Insight
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    The selected symptoms show strong correlation with cardiovascular and metabolic 
                    patterns. Consider comprehensive metabolic panel and cardiac workup.
                  </p>
                </div>
              </div>
            </div>

            <Button className="w-full mt-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
              <Stethoscope className="h-4 w-4 mr-2" />
              Generate Differential
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
