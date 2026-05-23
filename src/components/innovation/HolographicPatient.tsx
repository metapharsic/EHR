"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Brain,
  Heart,
  Activity,
  Dna,
  Microscope,
  Scan,
  Zap,
  Layers,
  Rotate3D,
  ChevronRight,
  ChevronLeft,
  Maximize2,
  Sparkles,
  Target,
  AlertTriangle,
  Shield,
  Bone,
  Eye,
  Ear,
  Stethoscope,
} from "lucide-react";

interface OrganSystem {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  health: number;
  status: "healthy" | "warning" | "critical" | "monitoring";
  aiInsight: string;
  biomarkers: { name: string; value: string; trend: "up" | "down" | "stable" }[];
  position: { x: number; y: number; z: number };
  color: string;
}

const organSystems: OrganSystem[] = [
  {
    id: "cardiovascular",
    name: "Cardiovascular",
    icon: Heart,
    health: 87,
    status: "monitoring",
    aiInsight: "AI detected 12% improvement in cardiac output after medication adjustment",
    biomarkers: [
      { name: "Heart Rate", value: "72 bpm", trend: "stable" },
      { name: "BP", value: "128/82", trend: "down" },
      { name: "Cholesterol", value: "195 mg/dL", trend: "down" },
    ],
    position: { x: 0, y: 10, z: 20 },
    color: "from-rose-500 to-pink-500",
  },
  {
    id: "neurological",
    name: "Neurological",
    icon: Brain,
    health: 94,
    status: "healthy",
    aiInsight: "Cognitive patterns stable. Sleep quality improved 23% this month",
    biomarkers: [
      { name: "Reaction Time", value: "245ms", trend: "stable" },
      { name: "Sleep Score", value: "87/100", trend: "up" },
      { name: "Stress Index", value: "32", trend: "down" },
    ],
    position: { x: 0, y: -30, z: 10 },
    color: "from-purple-500 to-indigo-500",
  },
  {
    id: "respiratory",
    name: "Respiratory",
    icon: Activity,
    health: 91,
    status: "healthy",
    aiInsight: "Lung capacity optimal. No signs of respiratory distress detected",
    biomarkers: [
      { name: "SpO2", value: "98%", trend: "stable" },
      { name: "Lung Capacity", value: "4.8L", trend: "up" },
      { name: "Breathing Rate", value: "14/min", trend: "stable" },
    ],
    position: { x: 0, y: 5, z: 15 },
    color: "from-cyan-500 to-blue-500",
  },
  {
    id: "skeletal",
    name: "Musculoskeletal",
    icon: Bone,
    health: 78,
    status: "warning",
    aiInsight: "Early signs of osteoarthritis in left knee. Recommend PT consultation",
    biomarkers: [
      { name: "Bone Density", value: "0.85 g/cm²", trend: "stable" },
      { name: "Joint Mobility", value: "82%", trend: "down" },
      { name: "Muscle Mass", value: "68%", trend: "stable" },
    ],
    position: { x: 0, y: -40, z: 0 },
    color: "from-amber-500 to-orange-500",
  },
  {
    id: "genetic",
    name: "Genomic Profile",
    icon: Dna,
    health: 96,
    status: "healthy",
    aiInsight: "Pharmacogenomic analysis complete. 3 drug sensitivities identified",
    biomarkers: [
      { name: "Genetic Risk", value: "Low", trend: "stable" },
      { name: "Epigenetic Age", value: "42.3 yrs", trend: "down" },
      { name: "Telomere Length", value: "Normal", trend: "stable" },
    ],
    position: { x: 25, y: 0, z: 5 },
    color: "from-emerald-500 to-teal-500",
  },
  {
    id: "immune",
    name: "Immune System",
    icon: Shield,
    health: 89,
    status: "monitoring",
    aiInsight: "Autoimmune markers stable. Vaccination protection at 94%",
    biomarkers: [
      { name: "WBC Count", value: "7.2 K/μL", trend: "stable" },
      { name: "CRP", value: "1.2 mg/L", trend: "down" },
      { name: "IgG Levels", value: "Normal", trend: "stable" },
    ],
    position: { x: -25, y: 0, z: 5 },
    color: "from-lime-500 to-green-500",
  },
];

interface Particle {
  id: number;
  x: number;
  y: number;
  z: number;
  color: string;
}

export function HolographicPatient() {
  const [selectedOrgan, setSelectedOrgan] = useState<OrganSystem | null>(null);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [scanMode, setScanMode] = useState<"full" | "dna" | "neural" | "cellular">("full");
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate floating particles
  useEffect(() => {
    const newParticles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100 - 50,
      y: Math.random() * 100 - 50,
      z: Math.random() * 100 - 50,
      color: ["#06b6d4", "#8b5cf6", "#ec4899", "#10b981"][Math.floor(Math.random() * 4)],
    }));
    setParticles(newParticles);
  }, []);

  // Auto-rotation
  useEffect(() => {
    if (!isAutoRotating) return;
    const interval = setInterval(() => {
      setRotation(prev => ({ x: prev.x, y: prev.y + 0.5 }));
    }, 50);
    return () => clearInterval(interval);
  }, [isAutoRotating]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isAutoRotating) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientY - rect.top) / rect.height - 0.5) * 60;
    const y = ((e.clientX - rect.left) / rect.width - 0.5) * 60;
    setRotation({ x, y });
  };

  return (
    <Card className="glass-card border-0 overflow-hidden">
      <CardHeader className="border-b border-slate-100 ">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-500">
              <Scan className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Holographic Patient Twin</CardTitle>
              <p className="text-xs text-slate-500">Real-time digital biomarker visualization</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-gradient-to-r from-cyan-500 to-purple-500 text-white border-0">
              <Sparkles className="h-3 w-3 mr-1" />
              AI-Generated
            </Badge>
            <Button
              size="icon"
              variant="ghost"
              className={cn("h-8 w-8", isAutoRotating && "text-cyan-500")}
              onClick={() => setIsAutoRotating(!isAutoRotating)}
            >
              <Rotate3D className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="grid lg:grid-cols-3">
          {/* 3D Holographic Visualization */}
          <div 
            ref={containerRef}
            className="lg:col-span-2 h-[500px] relative bg-gradient-to-b from-slate-900 to-slate-950 overflow-hidden cursor-move"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setIsAutoRotating(true)}
          >
            {/* Grid Floor */}
            <div 
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(6, 182, 212, 0.3) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(6, 182, 212, 0.3) 1px, transparent 1px)
                `,
                backgroundSize: '40px 40px',
                transform: `rotateX(60deg) translateY(100px)`,
              }}
            />

            {/* Floating Particles */}
            {particles.map((particle) => (
              <motion.div
                key={particle.id}
                className="absolute w-1 h-1 rounded-full"
                style={{ backgroundColor: particle.color }}
                animate={{
                  x: [particle.x * 2, particle.x * 2 + 10, particle.x * 2],
                  y: [particle.y * 2, particle.y * 2 - 10, particle.y * 2],
                  opacity: [0.3, 0.8, 0.3],
                }}
                transition={{
                  duration: 3 + Math.random() * 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            ))}

            {/* Central Holographic Body */}
            <div 
              className="absolute inset-0 flex items-center justify-center"
              style={{
                perspective: '1000px',
              }}
            >
              <motion.div
                className="relative w-64 h-96"
                animate={{
                  rotateX: rotation.x,
                  rotateY: rotation.y,
                }}
                transition={{ type: "spring", stiffness: 100, damping: 30 }}
                style={{ transformStyle: 'preserve-3d' }}
              >
                {/* Holographic Silhouette */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg viewBox="0 0 200 400" className="w-full h-full opacity-30">
                    <defs>
                      <linearGradient id="holoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#06b6d4" />
                        <stop offset="50%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#ec4899" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M100,20 C120,20 130,40 130,60 C130,80 120,90 110,100 L110,120 C130,130 150,150 150,200 L150,380 L130,380 L130,250 L110,250 L110,380 L90,380 L90,250 L70,250 L70,380 L50,380 L50,200 C50,150 70,130 90,120 L90,100 C80,90 70,80 70,60 C70,40 80,20 100,20 Z"
                      fill="none"
                      stroke="url(#holoGrad)"
                      strokeWidth="2"
                      className="animate-pulse"
                    />
                  </svg>
                </div>

                {/* Organ System Nodes */}
                {organSystems.map((organ, index) => {
                  const Icon = organ.icon;
                  return (
                    <motion.button
                      key={organ.id}
                      className={cn(
                        "absolute w-14 h-14 rounded-2xl flex items-center justify-center",
                        "bg-gradient-to-br shadow-lg transition-all duration-300",
                        "hover:scale-125 hover:z-10",
                        organ.color,
                        selectedOrgan?.id === organ.id && "ring-4 ring-white/50 scale-125 z-10"
                      )}
                      style={{
                        left: `calc(50% + ${organ.position.x * 1.5}px)`,
                        top: `calc(50% + ${organ.position.y * 2}px)`,
                        transform: `translateZ(${organ.position.z}px)`,
                        boxShadow: `0 0 30px ${organ.color.includes('rose') ? '#f43f5e' : organ.color.includes('purple') ? '#8b5cf6' : organ.color.includes('cyan') ? '#06b6d4' : '#10b981'}40`,
                      }}
                      onClick={() => setSelectedOrgan(organ)}
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.95 }}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Icon className="h-6 w-6 text-white" />
                      
                      {/* Status Indicator */}
                      <span className={cn(
                        "absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-white",
                        organ.status === "healthy" && "bg-emerald-400",
                        organ.status === "warning" && "bg-amber-400",
                        organ.status === "critical" && "bg-rose-400 animate-pulse",
                        organ.status === "monitoring" && "bg-cyan-400"
                      )} />
                    </motion.button>
                  );
                })}

                {/* Connection Lines */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {organSystems.map((organ, i) => (
                    organSystems.slice(i + 1).map((target, j) => (
                      <motion.line
                        key={`${organ.id}-${target.id}`}
                        x1={`calc(50% + ${organ.position.x * 1.5 + 28}px)`}
                        y1={`calc(50% + ${organ.position.y * 2 + 28}px)`}
                        x2={`calc(50% + ${target.position.x * 1.5 + 28}px)`}
                        y2={`calc(50% + ${target.position.y * 2 + 28}px)`}
                        stroke="url(#lineGrad)"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 0.3 }}
                        transition={{ duration: 2, delay: (i + j) * 0.2 }}
                      />
                    ))
                  ))}
                  <defs>
                    <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.5" />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.5" />
                    </linearGradient>
                  </defs>
                </svg>
              </motion.div>
            </div>

            {/* Scan Mode Overlay */}
            <div className="absolute bottom-4 left-4 right-4">
              <div className="glass rounded-xl p-2 flex gap-2">
                {(["full", "dna", "neural", "cellular"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setScanMode(mode)}
                    className={cn(
                      "flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all capitalize",
                      scanMode === mode
                        ? "bg-gradient-to-r from-cyan-500 to-purple-500 text-white"
                        : "text-slate-400 hover:text-white hover:bg-white/10"
                    )}
                  >
                    {mode} Scan
                  </button>
                ))}
              </div>
            </div>

            {/* Health Score Overlay */}
            <div className="absolute top-4 right-4">
              <div className="glass rounded-2xl p-4 text-center">
                <p className="text-xs text-slate-400 mb-1">Overall Health</p>
                <p className="text-3xl font-bold gradient-text">87.4</p>
                <p className="text-[10px] text-emerald-400">+2.3% this week</p>
              </div>
            </div>
          </div>

          {/* Organ Details Panel */}
          <div className="p-6 bg-slate-50 ">
            <AnimatePresence mode="wait">
              {selectedOrgan ? (
                <motion.div
                  key={selectedOrgan.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("p-3 rounded-xl bg-gradient-to-br", selectedOrgan.color)}>
                      <selectedOrgan.icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-800 ">
                        {selectedOrgan.name}
                      </h3>
                      <Badge 
                        className={cn(
                          "text-[10px] border-0",
                          selectedOrgan.status === "healthy" && "bg-emerald-100 text-emerald-700",
                          selectedOrgan.status === "warning" && "bg-amber-100 text-amber-700",
                          selectedOrgan.status === "critical" && "bg-rose-100 text-rose-700",
                          selectedOrgan.status === "monitoring" && "bg-cyan-100 text-cyan-700"
                        )}
                      >
                        {selectedOrgan.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Health Score */}
                  <div className="glass rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-500">Health Score</span>
                      <span className="text-2xl font-bold text-slate-800 ">
                        {selectedOrgan.health}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-200  rounded-full overflow-hidden">
                      <motion.div
                        className={cn("h-full rounded-full bg-gradient-to-r", selectedOrgan.color)}
                        initial={{ width: 0 }}
                        animate={{ width: `${selectedOrgan.health}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                      />
                    </div>
                  </div>

                  {/* AI Insight */}
                  <div className="glass rounded-xl p-4 border-l-4 border-cyan-500">
                    <div className="flex items-start gap-2">
                      <Brain className="h-4 w-4 text-cyan-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-slate-600 ">
                        {selectedOrgan.aiInsight}
                      </p>
                    </div>
                  </div>

                  {/* Biomarkers */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Biomarkers</h4>
                    <div className="space-y-2">
                      {selectedOrgan.biomarkers.map((marker, idx) => (
                        <motion.div
                          key={marker.name}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="flex items-center justify-between p-3 rounded-xl bg-white  shadow-sm"
                        >
                          <span className="text-sm text-slate-600 ">{marker.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800 ">{marker.value}</span>
                            <span className={cn(
                              "text-xs",
                              marker.trend === "up" && "text-emerald-500",
                              marker.trend === "down" && "text-rose-500",
                              marker.trend === "stable" && "text-slate-400"
                            )}>
                              {marker.trend === "up" && "↑"}
                              {marker.trend === "down" && "↓"}
                              {marker.trend === "stable" && "→"}
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Button size="sm" className="bg-gradient-to-r from-cyan-500 to-purple-500 text-white">
                      <Microscope className="h-3 w-3 mr-1" />
                      Deep Scan
                    </Button>
                    <Button size="sm" variant="outline">
                      <Target className="h-3 w-3 mr-1" />
                      Set Target
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full flex flex-col items-center justify-center text-slate-400"
                >
                  <Scan className="h-16 w-16 mb-4 opacity-30" />
                  <p className="text-sm">Select an organ system</p>
                  <p className="text-xs mt-1">to view detailed biomarkers</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
