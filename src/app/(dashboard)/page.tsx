"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { 
  LayoutDashboard, Users, Calendar, FileText, Activity, 
  TrendingUp, TrendingDown, Clock,
  ChevronRight, Stethoscope, Pill, FlaskConical, Heart,
  AlertCircle, CheckCircle, Plus, MoreHorizontal, Filter,
  ArrowUpRight, ArrowDownRight, Phone, Mail, MapPin,
  CreditCard, Receipt, BarChart, PieChart, LineChart,
  UserPlus, ClipboardList, Microscope, Scan, Brain,
  Sparkles, Zap, Shield, Award, Cpu, Network, ActivitySquare,
  Eye, Ear, MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";

// Quick Action Button
function QuickAction({ icon: Icon, label, href, color }: { icon: any; label: string; href: string; color: string }) {
  return (
    <Link href={href}>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all w-full",
          color
        )}
      >
        <Icon className="w-5 h-5" />
        {label}
      </motion.button>
    </Link>
  );
}

// Neural AI Live Panel Component
function NeuralAIPanel() {
  const [activeNodes, setActiveNodes] = useState(154);
  const [inferenceTime, setInferenceTime] = useState(11.7);
  const [accuracy, setAccuracy] = useState(98.3);
  const [processedToday, setProcessedToday] = useState(2855);
  const [waveHeights, setWaveHeights] = useState([40, 65, 30, 80, 50, 90, 35, 70, 45, 85, 55, 75]);
  const [tick, setTick] = useState(0);

  // Simulate live AI activity
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveNodes(prev => Math.max(120, prev + Math.floor(Math.random() * 10) - 4));
      setInferenceTime(prev => parseFloat(Math.max(8, Math.min(20, prev + Math.random() * 2 - 1)).toFixed(1)));
      setAccuracy(prev => parseFloat(Math.max(96, Math.min(99.9, prev + (Math.random() * 0.3 - 0.15))).toFixed(1)));
      setProcessedToday(prev => prev + Math.floor(Math.random() * 5));
      setWaveHeights(() => Array.from({ length: 12 }, () => 20 + Math.floor(Math.random() * 75)));
      setTick(t => t + 1);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  const aiModules = [
    { name: "Neural Symptom Mapper",   status: "active",      load: 87, icon: Brain,          href: "/patients",    color: "from-cyan-500 to-blue-500" },
    { name: "Predictive Health Engine",status: "active",      load: 92, icon: ActivitySquare,  href: "/patients",    color: "from-violet-500 to-purple-500" },
    { name: "Holographic Patient Twin",status: "active",      load: 76, icon: Scan,            href: "/patients",    color: "from-emerald-500 to-teal-500" },
    { name: "Genomic Analysis",        status: "processing",  load: 64, icon: Microscope,      href: "/transcript",  color: "from-amber-500 to-orange-500" },
    { name: "Swarm Intelligence",      status: "active",      load: 81, icon: Network,         href: "/admin",       color: "from-rose-500 to-pink-500" },
  ];

  const subSystems = [
    { label: "Computer Vision", icon: Eye,          href: "/patients" },
    { label: "Voice Recognition", icon: Ear,         href: "/voice" },
    { label: "NLP Engine",       icon: MessageSquare,href: "/transcript" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="mb-6 rounded-3xl text-white overflow-hidden relative"
      style={{
        background: "linear-gradient(135deg, #0a0f1e 0%, #0e1628 40%, #071620 70%, #0d1a2e 100%)",
        boxShadow: "0 0 80px rgba(6,182,212,0.12), 0 0 0 1px rgba(6,182,212,0.08)",
      }}
    >
      {/* ── Layered background effects ── */}
      {/* Dot grid */}
      <div className="absolute inset-0 opacity-[0.07]" style={{
        backgroundImage: `radial-gradient(circle at 1.5px 1.5px, rgba(6,182,212,1) 1px, transparent 0)`,
        backgroundSize: "28px 28px",
      }} />

      {/* Radial glow center-right */}
      <div className="absolute -top-20 right-8 w-96 h-96 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)" }} />
      <div className="absolute -bottom-24 left-0 w-80 h-80 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(6,182,212,0.14) 0%, transparent 70%)" }} />

      {/* Animated shimmer stripe */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.03) 50%, transparent 70%)" }}
        animate={{ x: ["-100%", "200%"] }}
        transition={{ duration: 5, repeat: Infinity, ease: "linear", repeatDelay: 3 }}
      />

      {/* Floating orbs */}
      {[
        { cx: "12%", cy: "20%", size: 6, color: "rgba(6,182,212,0.7)", dur: 9 },
        { cx: "28%", cy: "65%", size: 4, color: "rgba(139,92,246,0.7)", dur: 12 },
        { cx: "55%", cy: "18%", size: 5, color: "rgba(16,185,129,0.7)", dur: 7 },
        { cx: "72%", cy: "72%", size: 4, color: "rgba(245,158,11,0.7)", dur: 11 },
        { cx: "88%", cy: "35%", size: 6, color: "rgba(244,63,94,0.6)",  dur: 8 },
        { cx: "42%", cy: "85%", size: 3, color: "rgba(6,182,212,0.5)",  dur: 14 },
      ].map((orb, i) => (
        <motion.div key={i}
          className="absolute rounded-full"
          style={{ left: orb.cx, top: orb.cy, width: orb.size, height: orb.size, background: orb.color, filter: "blur(1px)" }}
          animate={{ y: [0, -18, 0, 18, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: orb.dur, repeat: Infinity, delay: i * 0.8, ease: "easeInOut" }}
        />
      ))}

      {/* ░░░ MAIN CONTENT ░░░ */}
      <div className="relative z-10 p-6">

        {/* ── TOP HEADER ── */}
        <div className="flex items-center justify-between mb-7">
          <div className="flex items-center gap-4">
            {/* Animated neural core icon */}
            <div className="relative flex items-center justify-center">
              {/* Outer spinning ring */}
              <motion.div
                className="absolute w-20 h-20 rounded-full border border-cyan-500/20"
                animate={{ rotate: 360 }}
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                style={{ borderStyle: "dashed" }}
              />
              {/* Mid ring */}
              <motion.div
                className="absolute w-14 h-14 rounded-full border border-violet-500/30"
                animate={{ rotate: -360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              />
              {/* Core */}
              <motion.div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #06b6d4, #8b5cf6)" }}
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <Cpu className="w-6 h-6 text-white" />
              </motion.div>
              {/* Live pulse dot */}
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-slate-900 animate-pulse" />
            </div>

            <div>
              <h2 className="text-2xl font-black tracking-tight"
                style={{ background: "linear-gradient(90deg, #67e8f9, #a78bfa, #67e8f9)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundSize: "200% auto" }}>
                Metta Neural AI Engine
              </h2>
              <p className="text-slate-400 text-xs mt-0.5 tracking-widest uppercase">Real-time Clinical Intelligence Processing</p>
            </div>
          </div>

          {/* Status badge */}
          <Link href="/admin" className="group flex flex-col items-end gap-1 hover:opacity-90 transition-opacity">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">System Status</span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)" }}>
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-emerald-400 text-xs font-bold tracking-widest">OPERATIONAL</span>
            </div>
          </Link>
        </div>

        {/* ── METRICS STRIP + WAVEFORM ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">

          {/* Metrics (4 cards) */}
          {[
            { href: "/admin",      Icon: Network,         label: "Active Neural Nodes", value: activeNodes.toLocaleString(), sub: "+12 this hour",   accent: "#06b6d4", glow: "rgba(6,182,212,0.15)"   },
            { href: "/admin",      Icon: Zap,             label: "Inference Latency",   value: `${inferenceTime}ms`,         sub: "Optimal range",   accent: "#f59e0b", glow: "rgba(245,158,11,0.15)"  },
            { href: "/patients",   Icon: Award,           label: "Prediction Accuracy", value: `${accuracy}%`,               sub: "Clinical grade",  accent: "#a78bfa", glow: "rgba(167,139,250,0.15)" },
            { href: "/transcript", Icon: Activity,        label: "Processed Today",     value: processedToday.toLocaleString(), sub: "Data points",  accent: "#f43f5e", glow: "rgba(244,63,94,0.15)"  },
          ].map(({ href, Icon, label, value, sub, accent, glow }) => (
            <Link key={label} href={href}
              className="group relative overflow-hidden rounded-2xl p-4 transition-all duration-300 cursor-pointer"
              style={{ background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.08)` }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = glow; (e.currentTarget as HTMLElement).style.borderColor = accent + "55"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
            >
              {/* Top accent line */}
              <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl opacity-60"
                style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: `${accent}22` }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
                </div>
                <span className="text-[11px] text-slate-400 leading-tight">{label}</span>
              </div>
              <p className="text-2xl font-black tabular-nums" style={{ color: accent }}>{value}</p>
              <p className="text-[11px] text-emerald-400 mt-1 font-medium">{sub}</p>
            </Link>
          ))}

          {/* Live waveform visualizer */}
          <div className="rounded-2xl p-4 flex flex-col justify-between"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(6,182,212,0.15)" }}>
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <span className="text-[11px] text-slate-400">Neural Signal</span>
            </div>
            <div className="flex items-end justify-center gap-1 h-14">
              {waveHeights.map((h, i) => (
                <motion.div key={i}
                  animate={{ height: `${h}%` }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="w-1.5 rounded-full"
                  style={{ background: `linear-gradient(to top, #06b6d4, #8b5cf6)`, opacity: 0.7 + (h / 300) }}
                />
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-2 text-center">LIVE INFERENCE FEED</p>
          </div>
        </div>

        {/* ── AI MODULES ── */}
        <div className="rounded-2xl p-5 mb-4"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Active AI Modules
            </h3>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">{aiModules.filter(m => m.status === "active").length} / {aiModules.length} online</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {aiModules.map((module, index) => {
              const Icon = module.icon;
              return (
                <motion.div key={module.name}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.07 }}
                >
                  <Link href={module.href}
                    className="group flex flex-col gap-3 p-3 rounded-xl transition-all duration-200 cursor-pointer"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.09)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                  >
                    {/* Icon + Status */}
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: `linear-gradient(135deg, ${module.color.includes("cyan") ? "#06b6d4" : module.color.includes("violet") ? "#8b5cf6" : module.color.includes("emerald") ? "#10b981" : module.color.includes("amber") ? "#f59e0b" : "#f43f5e"}22, transparent)` }}>
                        <Icon className="w-4 h-4 text-cyan-400 group-hover:text-white transition-colors" />
                      </div>
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-semibold",
                        module.status === "active"
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                          : "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                      )}>
                        {module.status}
                      </span>
                    </div>

                    {/* Name */}
                    <span className="text-xs text-slate-300 font-medium leading-tight group-hover:text-white transition-colors">{module.name}</span>

                    {/* Progress bar */}
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-[10px] text-slate-500">Load</span>
                        <span className="text-[10px] font-bold text-slate-300">{module.load}%</span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                        <motion.div
                          className={`h-full rounded-full bg-gradient-to-r ${module.color}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${module.load}%` }}
                          transition={{ duration: 1.2, delay: index * 0.15, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ── BOTTOM SUBSYSTEM ROW ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {subSystems.map(({ label, icon: Icon, href }) => (
              <Link key={label} href={href}
                className="group flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-200"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(6,182,212,0.12)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(6,182,212,0.3)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <Icon className="w-3 h-3 text-slate-400 group-hover:text-cyan-400 transition-colors" />
                <span className="text-[11px] text-slate-400 group-hover:text-cyan-300 transition-colors">{label}: <span className="text-emerald-400 font-semibold">Active</span></span>
              </Link>
            ))}
          </div>

          <Link href="/admin"
            className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-emerald-400 transition-colors">
            <motion.span
              key={tick}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"
            />
            Last update: Just now
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

// Stat Card
function StatCard({ title, value, change, trend, icon: Icon, color, subtitle, href }: any) {
  const content = (
    <div className={cn(
      "bg-white rounded-2xl p-6 border border-slate-200 shadow-sm transition-all duration-200",
      href && "hover:border-cyan-300 hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
    )}>
      <div className="flex items-start justify-between mb-4">
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", color)}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium",
          trend === "up" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
        )}>
          {trend === "up" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {change}%
        </div>
      </div>
      <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
      <p className="text-sm text-slate-600 mt-1">{title}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
      {href && (
        <div className="mt-3 flex items-center gap-1 text-xs font-medium text-cyan-600">
          <span>View details</span>
          <ArrowUpRight className="w-3 h-3" />
        </div>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

// Appointment Card
function AppointmentCard({ time, patient, type, status, provider }: any) {
  const statusColors: any = {
    scheduled: "bg-blue-50 text-blue-600 border-blue-200",
    "in-progress": "bg-amber-50 text-amber-600 border-amber-200",
    completed: "bg-emerald-50 text-emerald-600 border-emerald-200",
    cancelled: "bg-slate-50 text-slate-600 border-slate-200",
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:border-cyan-300 transition-all">
      <div className="text-center min-w-[60px]">
        <p className="text-lg font-bold text-slate-900">{time}</p>
        <p className="text-xs text-slate-500">{type}</p>
      </div>
      <div className="flex-1">
        <p className="font-semibold text-slate-900">{patient}</p>
        <p className="text-sm text-slate-500">{provider}</p>
      </div>
      <span className={cn("px-3 py-1 rounded-full text-xs font-medium border", statusColors[status])}>
        {status}
      </span>
      <button className="p-2 hover:bg-slate-100 rounded-lg">
        <MoreHorizontal className="w-4 h-4 text-slate-400" />
      </button>
    </div>
  );
}

// Patient Row
function PatientRow({ id, name, age, condition, lastVisit, status }: any) {
  // Derive URL slug from id, e.g. P-2024-001 → 1
  const slug = id.split('-').pop();
  return (
    <Link href={`/patients/${slug}`}>
      <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:border-cyan-300 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-teal-400 flex items-center justify-center text-white font-bold text-sm">
          {name.split(' ').map((n: string) => n[0]).join('')}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-slate-900">{name}</p>
          <p className="text-sm text-slate-500">{id} • {age} years</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-700">{condition}</p>
          <p className="text-xs text-slate-400">Last visit: {lastVisit}</p>
        </div>
        <span className={cn(
          "px-2 py-1 rounded text-xs font-medium",
          status === "active" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
        )}>
          {status}
        </span>
        <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
      </div>
    </Link>
  );
}

// Alert Badge
function AlertBadge({ type, message, time, href }: any) {
  const colors: any = {
    critical: "bg-rose-50 border-rose-200 text-rose-700 hover:border-rose-400",
    warning: "bg-amber-50 border-amber-200 text-amber-700 hover:border-amber-400",
    info: "bg-blue-50 border-blue-200 text-blue-700 hover:border-blue-400",
  };

  const content = (
    <div className={cn("flex items-start gap-3 p-4 rounded-xl border transition-all duration-200", colors[type], href && "cursor-pointer hover:shadow-sm")}>
      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium">{message}</p>
        <p className="text-xs opacity-70 mt-1">{time}</p>
      </div>
      {href && <ChevronRight className="w-4 h-4 flex-shrink-0 mt-0.5 opacity-50" />}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

// Revenue Metric
function RevenueMetric({ label, value, change, trend, href }: any) {
  const content = (
    <div className={cn(
      "p-4 bg-white rounded-xl border border-slate-200 transition-all duration-200",
      href && "hover:border-cyan-300 hover:shadow-sm hover:-translate-y-0.5 cursor-pointer"
    )}>
      <p className="text-sm text-slate-500">{label}</p>
      <div className="flex items-end gap-2 mt-1">
        <p className="text-xl font-bold text-slate-900">{value}</p>
        <span className={cn(
          "text-xs font-medium mb-1",
          trend === "up" ? "text-emerald-600" : "text-rose-600"
        )}>
          {trend === "up" ? "+" : ""}{change}%
        </span>
      </div>
      {href && (
        <p className="text-[10px] text-cyan-500 mt-2 font-medium">View details →</p>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        {/* Welcome Banner */}
        <div className="mb-6 p-6 bg-gradient-to-r from-cyan-500 to-teal-500 rounded-2xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Welcome back, Dr. Smith</h2>
              <p className="text-cyan-100 mt-1">You have 12 appointments today and 3 urgent alerts</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-4 py-2 bg-white/20 rounded-xl text-sm font-medium">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </span>
            </div>
          </div>
        </div>

        {/* Neural AI Live Status Panel */}
        <NeuralAIPanel />

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <StatCard
            title="Total Patients"
            value="1,284"
            change={12}
            trend="up"
            icon={Users}
            color="bg-cyan-500"
            subtitle="Active patients in care"
            href="/patients"
          />
          <StatCard
            title="Today's Appointments"
            value="24"
            change={8}
            trend="up"
            icon={Calendar}
            color="bg-violet-500"
            subtitle="12 completed, 12 remaining"
            href="/schedule"
          />
          <StatCard
            title="Pending Tasks"
            value="18"
            change={-5}
            trend="down"
            icon={ClipboardList}
            color="bg-amber-500"
            subtitle="Lab reviews, prescriptions"
            href="/prescribe"
          />
          <StatCard
            title="Monthly Revenue"
            value="$124.5K"
            change={15}
            trend="up"
            icon={CreditCard}
            color="bg-emerald-500"
            subtitle="vs $108.2K last month"
            href="/documents"
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Today's Schedule */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Today's Schedule</h3>
                  <p className="text-sm text-slate-500">12 appointments scheduled</p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-4 py-2 bg-cyan-50 text-cyan-600 rounded-xl text-sm font-medium hover:bg-cyan-100 transition-colors">
                    <Plus className="w-4 h-4 inline mr-1" />
                    New Appointment
                  </button>
                  <button className="p-2 hover:bg-slate-100 rounded-xl">
                    <Filter className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-3">
                <AppointmentCard
                  time="9:00 AM"
                  patient="John Smith"
                  type="Follow-up"
                  status="completed"
                  provider="Dr. Smith"
                />
                <AppointmentCard
                  time="9:30 AM"
                  patient="Sarah Johnson"
                  type="New Patient"
                  status="in-progress"
                  provider="Dr. Smith"
                />
                <AppointmentCard
                  time="10:00 AM"
                  patient="Michael Brown"
                  type="Annual Physical"
                  status="scheduled"
                  provider="Dr. Smith"
                />
                <AppointmentCard
                  time="10:30 AM"
                  patient="Emily Davis"
                  type="Consultation"
                  status="scheduled"
                  provider="Dr. Smith"
                />
                <AppointmentCard
                  time="11:00 AM"
                  patient="Robert Wilson"
                  type="Follow-up"
                  status="scheduled"
                  provider="Dr. Smith"
                />
              </div>
              <div className="p-4 border-t border-slate-100">
                <button className="w-full py-2 text-sm text-cyan-600 font-medium hover:bg-cyan-50 rounded-xl transition-colors">
                  View All Appointments
                </button>
              </div>
            </div>

            {/* Recent Patients */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Recent Patients</h3>
                  <p className="text-sm text-slate-500">Last 5 active patients</p>
                </div>
                <Link href="/patients" className="flex items-center gap-1 text-sm text-cyan-600 font-medium hover:text-cyan-700 transition-colors">
                  View All
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="p-6 space-y-3">
                <PatientRow
                  id="P-2024-001"
                  name="John Smith"
                  age={45}
                  condition="Hypertension"
                  lastVisit="Today"
                  status="active"
                />
                <PatientRow
                  id="P-2024-002"
                  name="Sarah Johnson"
                  age={32}
                  condition="Diabetes Type 2"
                  lastVisit="Today"
                  status="active"
                />
                <PatientRow
                  id="P-2024-003"
                  name="Michael Brown"
                  age={58}
                  condition="Annual Checkup"
                  lastVisit="Yesterday"
                  status="active"
                />
                <PatientRow
                  id="P-2024-004"
                  name="Emily Davis"
                  age={29}
                  condition="Prenatal Care"
                  lastVisit="2 days ago"
                  status="active"
                />
                <PatientRow
                  id="P-2024-005"
                  name="Robert Wilson"
                  age={67}
                  condition="Cardiac Monitoring"
                  lastVisit="3 days ago"
                  status="follow-up"
                />
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <QuickAction
                  icon={UserPlus}
                  label="Register New Patient"
                  href="/patients/new"
                  color="bg-cyan-50 text-cyan-700 hover:bg-cyan-100"
                />
                <QuickAction
                  icon={Calendar}
                  label="Schedule Appointment"
                  href="/appointments/new"
                  color="bg-violet-50 text-violet-700 hover:bg-violet-100"
                />
                <QuickAction
                  icon={FileText}
                  label="Create Clinical Note"
                  href="/notes/new"
                  color="bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                />
                <QuickAction
                  icon={Pill}
                  label="Write Prescription"
                  href="/prescribe"
                  color="bg-amber-50 text-amber-700 hover:bg-amber-100"
                />
                <QuickAction
                  icon={FlaskConical}
                  label="Order Lab Tests"
                  href="/labs/order"
                  color="bg-rose-50 text-rose-700 hover:bg-rose-100"
                />
                <QuickAction
                  icon={Receipt}
                  label="Process Billing"
                  href="/billing"
                  color="bg-blue-50 text-blue-700 hover:bg-blue-100"
                />
              </div>
            </div>

            {/* Alerts */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Alerts & Notifications</h3>
                <span className="px-2 py-1 bg-rose-100 text-rose-600 text-xs font-medium rounded-full">
                  3 New
                </span>
              </div>
              <div className="space-y-3">
                <AlertBadge
                  type="critical"
                  message="Critical lab result for Patient P-2024-003 requires immediate attention"
                  time="5 minutes ago"
                  href="/alerts?type=critical&patient=P-2024-003"
                />
                <AlertBadge
                  type="warning"
                  message="Prescription refill request pending for 3 patients"
                  time="1 hour ago"
                  href="/prescribe?filter=refill-pending"
                />
                <AlertBadge
                  type="info"
                  message="Insurance authorization approved for MRI scan"
                  time="2 hours ago"
                  href="/alerts?type=info"
                />
              </div>
              <Link
                href="/alerts"
                className="flex items-center justify-center gap-2 w-full mt-4 py-2 text-sm text-cyan-600 font-medium hover:bg-cyan-50 rounded-xl transition-colors"
              >
                View All Alerts
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Revenue Overview */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Revenue Overview</h3>
                <Link href="/documents" className="flex items-center gap-1 text-sm text-cyan-600 font-medium hover:text-cyan-700 transition-colors">
                  View Full Report
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <RevenueMetric
                  label="Today's Collections"
                  value="$4,250"
                  change={12}
                  trend="up"
                  href="/documents?filter=collections"
                />
                <RevenueMetric
                  label="Pending Claims"
                  value="$18,600"
                  change={-5}
                  trend="down"
                  href="/documents?filter=pending-claims"
                />
                <RevenueMetric
                  label="Insurance Payments"
                  value="$89,400"
                  change={8}
                  trend="up"
                  href="/documents?filter=insurance"
                />
                <RevenueMetric
                  label="Patient Payments"
                  value="$12,100"
                  change={15}
                  trend="up"
                  href="/documents?filter=patient-payments"
                />
              </div>
            </div>

                        {/* AI Assistant - Metta AI */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-6 text-white shadow-lg shadow-violet-500/30">
              {/* Animated background orbs */}
              <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute -bottom-8 -left-4 w-24 h-24 rounded-full bg-cyan-400/20 blur-2xl" />

              {/* Header */}
              <div className="relative flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-yellow-300" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-none">Metta AI</h3>
                    <p className="text-violet-200 text-xs mt-0.5">AI Clinical Assistant</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-400/20 border border-emerald-400/40 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-semibold text-emerald-300">LIVE</span>
                </div>
              </div>

              {/* Summary */}
              <p className="relative text-sm text-violet-100 mb-5 leading-relaxed">
                Metta AI has documented <span className="font-bold text-white">24 encounters</span> today and identified <span className="font-bold text-yellow-300">3 potential diagnoses</span> requiring attention.
              </p>

              {/* Stats Row */}
              <div className="relative grid grid-cols-3 gap-2 mb-5">
                <Link href="/voice" className="flex flex-col items-center p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all duration-200 cursor-pointer group">
                  <span className="text-xl font-bold text-white group-hover:scale-110 transition-transform">24</span>
                  <span className="text-[10px] text-violet-200 mt-0.5 text-center">Notes</span>
                </Link>
                <Link href="/patients" className="flex flex-col items-center p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all duration-200 cursor-pointer group">
                  <span className="text-xl font-bold text-yellow-300 group-hover:scale-110 transition-transform">3</span>
                  <span className="text-[10px] text-violet-200 mt-0.5 text-center">Insights</span>
                </Link>
                <Link href="/health" className="flex flex-col items-center p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all duration-200 cursor-pointer group">
                  <span className="text-xl font-bold text-cyan-300 group-hover:scale-110 transition-transform">98.7%</span>
                  <span className="text-[10px] text-violet-200 mt-0.5 text-center">Accuracy</span>
                </Link>
              </div>

              {/* Feature Pills */}
              <div className="relative flex flex-wrap gap-1.5 mb-5">
                {[
                  { label: "Auto-Documentation", href: "/voice" },
                  { label: "Symptom Mapper", href: "/health" },
                  { label: "Predictive Timeline", href: "/health" },
                  { label: "AI Prescribe", href: "/prescribe" },
                ].map((f) => (
                  <Link key={f.label} href={f.href}
                    className="px-2.5 py-1 bg-white/10 hover:bg-white/25 border border-white/20 rounded-full text-[10px] font-medium text-violet-100 transition-all duration-200">
                    {f.label}
                  </Link>
                ))}
              </div>

              {/* CTA */}
              <Link href="/voice"
                className="relative flex items-center justify-center gap-2 w-full py-2.5 bg-white text-violet-700 font-semibold text-sm rounded-xl hover:bg-violet-50 transition-all duration-200 shadow-md">
                <Sparkles className="w-4 h-4" />
                Open Metta AI
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
