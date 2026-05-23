"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Scan, Heart, Brain, Wind, Shield, Activity, Bone, 
  ChevronLeft, Rotate3D, ScanLine, Dna, Microscope,
  ActivitySquare, Stethoscope
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface OrganSystem {
  id: string;
  name: string;
  score: number;
  status: "healthy" | "at-risk" | "critical";
  icon: any;
  color: string;
  biomarkers: { name: string; value: string; unit: string; status: "normal" | "warning" | "critical" }[];
}

const ORGAN_SYSTEMS: OrganSystem[] = [
  {
    id: "cardiovascular",
    name: "Cardiovascular",
    score: 87,
    status: "healthy",
    icon: Heart,
    color: "rose",
    biomarkers: [
      { name: "Heart Rate", value: "72", unit: "bpm", status: "normal" },
      { name: "Blood Pressure", value: "120/80", unit: "mmHg", status: "normal" },
      { name: "Cholesterol", value: "195", unit: "mg/dL", status: "warning" },
    ],
  },
  {
    id: "neurological",
    name: "Neurological",
    score: 94,
    status: "healthy",
    icon: Brain,
    color: "violet",
    biomarkers: [
      { name: "Cognitive Score", value: "98", unit: "%", status: "normal" },
      { name: "Reaction Time", value: "245", unit: "ms", status: "normal" },
      { name: "Sleep Quality", value: "85", unit: "%", status: "normal" },
    ],
  },
  {
    id: "respiratory",
    name: "Respiratory",
    score: 91,
    status: "healthy",
    icon: Wind,
    color: "cyan",
    biomarkers: [
      { name: "O2 Saturation", value: "98", unit: "%", status: "normal" },
      { name: "Lung Capacity", value: "4.2", unit: "L", status: "normal" },
      { name: "Respiratory Rate", value: "16", unit: "rpm", status: "normal" },
    ],
  },
  {
    id: "immune",
    name: "Immune System",
    score: 89,
    status: "healthy",
    icon: Shield,
    color: "emerald",
    biomarkers: [
      { name: "WBC Count", value: "7.5", unit: "K/μL", status: "normal" },
      { name: "Inflammation", value: "Low", unit: "", status: "normal" },
      { name: "Antibody Levels", value: "Normal", unit: "", status: "normal" },
    ],
  },
  {
    id: "metabolic",
    name: "Metabolic",
    score: 85,
    status: "at-risk",
    icon: Activity,
    color: "amber",
    biomarkers: [
      { name: "Glucose", value: "105", unit: "mg/dL", status: "warning" },
      { name: "HbA1c", value: "5.8", unit: "%", status: "warning" },
      { name: "BMI", value: "26.5", unit: "kg/m²", status: "warning" },
    ],
  },
  {
    id: "skeletal",
    name: "Skeletal",
    score: 92,
    status: "healthy",
    icon: Bone,
    color: "slate",
    biomarkers: [
      { name: "Bone Density", value: "Normal", unit: "", status: "normal" },
      { name: "Calcium", value: "9.5", unit: "mg/dL", status: "normal" },
      { name: "Vitamin D", value: "32", unit: "ng/mL", status: "normal" },
    ],
  },
];

const SCAN_MODES = [
  { id: "full", name: "Full Body", icon: Scan },
  { id: "dna", name: "DNA Analysis", icon: Dna },
  { id: "neural", name: "Neural Scan", icon: Brain },
  { id: "cellular", name: "Cellular", icon: Microscope },
];

export default function DigitalTwinPage() {
  const [selectedSystem, setSelectedSystem] = useState<OrganSystem | null>(null);
  const [scanMode, setScanMode] = useState("full");
  const [isScanning, setIsScanning] = useState(false);

  const handleScan = () => {
    setIsScanning(true);
    setTimeout(() => setIsScanning(false), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <button className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Holographic Patient Twin</h1>
            <p className="text-sm text-slate-500">3D Interactive Body Visualization</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Panel - 3D Visualization */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
              {/* Scan Mode Selector */}
              <div className="flex gap-2 mb-6">
                {SCAN_MODES.map((mode) => {
                  const Icon = mode.icon;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => setScanMode(mode.id)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                        scanMode === mode.id
                          ? "bg-cyan-50 text-cyan-600 border border-cyan-200"
                          : "bg-slate-50 text-slate-600 border border-slate-200 hover:border-slate-300"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {mode.name}
                    </button>
                  );
                })}
              </div>

              {/* 3D Body Visualization */}
              <div className="relative h-96 flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 rounded-2xl overflow-hidden">
                {/* Scanning Effect */}
                {isScanning && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-b from-cyan-500/20 to-transparent"
                    animate={{ y: ["-100%", "100%"] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  />
                )}

                {/* Body Silhouette */}
                <div className="relative">
                  <motion.div
                    className="w-40 h-64 rounded-full bg-gradient-to-b from-cyan-100 to-cyan-50 border-4 border-cyan-300"
                    animate={isScanning ? { scale: [1, 1.02, 1] } : {}}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  
                  {/* Organ System Hotspots */}
                  {ORGAN_SYSTEMS.map((system, index) => {
                    const Icon = system.icon;
                    const angle = (index * 60) * (Math.PI / 180);
                    const radius = 140;
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    
                    return (
                      <motion.button
                        key={system.id}
                        className={cn(
                          "absolute w-14 h-14 rounded-xl flex flex-col items-center justify-center border-2 transition-all shadow-lg",
                          selectedSystem?.id === system.id
                            ? `bg-${system.color}-100 border-${system.color}-400`
                            : "bg-white border-slate-200 hover:border-cyan-300"
                        )}
                        style={{ 
                          left: `calc(50% + ${x}px - 28px)`,
                          top: `calc(50% + ${y}px - 28px)`,
                        }}
                        onClick={() => setSelectedSystem(system)}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Icon className={`w-5 h-5 text-${system.color}-500`} />
                        <span className="text-[10px] font-bold text-slate-700">{system.score}%</span>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Scan Button */}
                <button
                  onClick={handleScan}
                  disabled={isScanning}
                  className="absolute bottom-4 right-4 px-4 py-2 bg-cyan-500 text-white rounded-xl text-sm font-medium hover:bg-cyan-600 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  <ScanLine className="w-4 h-4" />
                  {isScanning ? "Scanning..." : "Start Scan"}
                </button>
              </div>

              {/* Overall Health Score */}
              <div className="mt-6 p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">Overall Health Score</span>
                  <span className="text-2xl font-bold text-cyan-600">89.7%</span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full w-[89.7%] bg-gradient-to-r from-cyan-400 to-teal-400 rounded-full" />
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - System Details */}
          <div className="space-y-6">
            {/* System List */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Organ Systems</h3>
              <div className="space-y-3">
                {ORGAN_SYSTEMS.map((system) => {
                  const Icon = system.icon;
                  return (
                    <button
                      key={system.id}
                      onClick={() => setSelectedSystem(system)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left",
                        selectedSystem?.id === system.id
                          ? `bg-${system.color}-50 border border-${system.color}-200`
                          : "bg-slate-50 hover:bg-slate-100"
                      )}
                    >
                      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", `bg-${system.color}-100`)}>
                        <Icon className={cn("w-5 h-5", `text-${system.color}-500`)} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">{system.name}</p>
                        <p className={cn(
                          "text-xs",
                          system.status === "healthy" ? "text-emerald-600" :
                          system.status === "at-risk" ? "text-amber-600" :
                          "text-rose-600"
                        )}>
                          {system.status.charAt(0).toUpperCase() + system.status.slice(1)}
                        </p>
                      </div>
                      <span className="text-lg font-bold text-slate-700">{system.score}%</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected System Biomarkers */}
            {selectedSystem && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200"
              >
                <h3 className="text-lg font-bold text-slate-900 mb-4">{selectedSystem.name} Biomarkers</h3>
                <div className="space-y-3">
                  {selectedSystem.biomarkers.map((marker) => (
                    <div key={marker.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                      <div>
                        <p className="text-sm text-slate-700">{marker.name}</p>
                        <p className={cn(
                          "text-xs",
                          marker.status === "normal" ? "text-emerald-600" :
                          marker.status === "warning" ? "text-amber-600" :
                          "text-rose-600"
                        )}>
                          {marker.status}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-900">{marker.value}</p>
                        <p className="text-xs text-slate-500">{marker.unit}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
