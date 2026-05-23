"use client";

import { motion } from "framer-motion";
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  ArrowRight,
  Users,
  Brain,
  AlertTriangle,
  FileText,
  Mic,
  Pill
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface MetricCardProps {
  title: string;
  value: number;
  change: number;
  changePercent: number;
  trend: "up" | "down" | "neutral";
  status: "live" | "offline" | "warning";
  link: string;
  icon: "patients" | "predictions" | "alerts" | "documents" | "voice" | "prescriptions";
  details?: Record<string, number>;
  isLoading?: boolean;
}

const iconMap = {
  patients: Users,
  predictions: Brain,
  alerts: AlertTriangle,
  documents: FileText,
  voice: Mic,
  prescriptions: Pill,
};

const colorMap = {
  patients: { bg: "bg-cyan-500/20", text: "text-cyan-400", border: "border-cyan-500/30" },
  predictions: { bg: "bg-violet-500/20", text: "text-violet-400", border: "border-violet-500/30" },
  alerts: { bg: "bg-rose-500/20", text: "text-rose-400", border: "border-rose-500/30" },
  documents: { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/30" },
  voice: { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/30" },
  prescriptions: { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/30" },
};

export function MetricCard({
  title,
  value,
  change,
  changePercent,
  trend,
  status,
  link,
  icon,
  details,
  isLoading = false,
}: MetricCardProps) {
  const Icon = iconMap[icon];
  const colors = colorMap[icon];

  if (isLoading) {
    return (
      <div className="p-6 bg-slate-900/50 rounded-2xl border border-slate-700/50 animate-pulse">
        <div className="h-20 bg-slate-800/50 rounded-xl" />
      </div>
    );
  }

  return (
    <Link href={link}>
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "p-6 bg-slate-900/50 rounded-2xl border transition-all cursor-pointer group",
          "hover:border-slate-600 hover:bg-slate-800/50",
          colors.border
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", colors.bg)}>
            <Icon className={cn("w-6 h-6", colors.text)} />
          </div>
          
          {/* Live Indicator */}
          {status === "live" && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-xs text-emerald-400 font-medium">Live</span>
            </div>
          )}
        </div>

        {/* Value */}
        <div className="mb-3">
          <h3 className="text-3xl font-bold text-white mb-1">
            {value.toLocaleString()}
          </h3>
          <p className="text-sm text-slate-400">{title}</p>
        </div>

        {/* Change Indicator */}
        <div className="flex items-center gap-2 mb-4">
          <div
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium",
              trend === "up"
                ? "bg-emerald-500/20 text-emerald-400"
                : trend === "down"
                ? "bg-rose-500/20 text-rose-400"
                : "bg-slate-700 text-slate-400"
            )}
          >
            {trend === "up" ? (
              <TrendingUp className="w-3 h-3" />
            ) : trend === "down" ? (
              <TrendingDown className="w-3 h-3" />
            ) : (
              <Activity className="w-3 h-3" />
            )}
            <span>
              {change > 0 ? "+" : ""}
              {change}
            </span>
          </div>
          <span className="text-xs text-slate-500">today</span>
        </div>

        {/* Details Preview */}
        {details && Object.keys(details).length > 0 && (
          <div className="pt-3 border-t border-slate-700/50">
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(details).slice(0, 2).map(([key, val]) => (
                <div key={key} className="text-xs">
                  <span className="text-slate-500 capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                  <p className="text-white font-medium">{val.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* View Link */}
        <div className="mt-4 flex items-center gap-1 text-xs text-slate-500 group-hover:text-cyan-400 transition-colors">
          <span>View details</span>
          <ArrowRight className="w-3 h-3" />
        </div>
      </motion.div>
    </Link>
  );
}
