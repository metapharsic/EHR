"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { 
  AlertTriangle, ChevronLeft, Bell, CheckCircle, Clock,
  Filter, Search, X, AlertOctagon, Info, User
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface Alert {
  id: string;
  type: "critical" | "warning" | "info";
  title: string;
  description: string;
  patient: string;
  patientId: string;
  timestamp: string;
  status: "new" | "acknowledged" | "resolved";
  category: string;
}

const ALERTS: Alert[] = [
  { id: "a1", type: "critical", title: "Critical Lab Value", description: "Potassium level critically high at 6.8 mEq/L", patient: "John Smith", patientId: "P12345", timestamp: "2 min ago", status: "new", category: "Lab" },
  { id: "a2", type: "warning", title: "Medication Interaction", description: "Warfarin and NSAID interaction detected", patient: "Sarah Johnson", patientId: "P12346", timestamp: "15 min ago", status: "acknowledged", category: "Medication" },
  { id: "a3", type: "critical", title: "Sepsis Alert", description: "SIRS criteria met, lactate elevated", patient: "Michael Brown", patientId: "P12347", timestamp: "32 min ago", status: "new", category: "Clinical" },
  { id: "a4", type: "warning", title: "Readmission Risk", description: "AI predicts 85% readmission risk within 30 days", patient: "Emily Davis", patientId: "P12348", timestamp: "1 hour ago", status: "acknowledged", category: "AI Prediction" },
  { id: "a5", type: "info", title: "Appointment Reminder", description: "Follow-up appointment overdue by 5 days", patient: "Robert Wilson", patientId: "P12349", timestamp: "2 hours ago", status: "resolved", category: "Administrative" },
  { id: "a6", type: "warning", title: "Allergy Alert", description: "Patient has documented penicillin allergy", patient: "Lisa Anderson", patientId: "P12350", timestamp: "3 hours ago", status: "new", category: "Allergy" },
];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>(ALERTS);
  const [filter, setFilter] = useState<"all" | "critical" | "warning" | "info">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "new" | "acknowledged" | "resolved">("all");

  const filteredAlerts = alerts.filter(alert => {
    if (filter !== "all" && alert.type !== filter) return false;
    if (statusFilter !== "all" && alert.status !== statusFilter) return false;
    return true;
  });

  const acknowledgeAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: "acknowledged" } : a));
  };

  const resolveAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: "resolved" } : a));
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "critical": return <AlertOctagon className="w-5 h-5 text-rose-500" />;
      case "warning": return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      default: return <Info className="w-5 h-5 text-cyan-500" />;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case "critical": return "bg-rose-50 border-rose-200";
      case "warning": return "bg-amber-50 border-amber-200";
      default: return "bg-cyan-50 border-cyan-200";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "new": return "bg-rose-100 text-rose-700";
      case "acknowledged": return "bg-amber-100 text-amber-700";
      default: return "bg-emerald-100 text-emerald-700";
    }
  };

  const stats = {
    total: alerts.length,
    critical: alerts.filter(a => a.type === "critical" && a.status !== "resolved").length,
    warning: alerts.filter(a => a.type === "warning" && a.status !== "resolved").length,
    new: alerts.filter(a => a.status === "new").length,
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
            <h1 className="text-2xl font-bold text-slate-900">Risk Alerts</h1>
            <p className="text-sm text-slate-500">Critical notifications and warnings</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-2">
              <Bell className="w-5 h-5 text-slate-400" />
              <span className="text-sm text-slate-500">Total Alerts</span>
            </div>
            <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-2">
              <AlertOctagon className="w-5 h-5 text-rose-500" />
              <span className="text-sm text-slate-500">Critical</span>
            </div>
            <p className="text-3xl font-bold text-rose-600">{stats.critical}</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span className="text-sm text-slate-500">Warnings</span>
            </div>
            <p className="text-3xl font-bold text-amber-600">{stats.warning}</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-cyan-500" />
              <span className="text-sm text-slate-500">New</span>
            </div>
            <p className="text-3xl font-bold text-cyan-600">{stats.new}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex gap-2">
            {(["all", "critical", "warning", "info"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize",
                  filter === f
                    ? "bg-cyan-500 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {(["all", "new", "acknowledged", "resolved"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize",
                  statusFilter === s
                    ? "bg-slate-800 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Alerts List */}
        <div className="space-y-4">
          {filteredAlerts.map((alert, index) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "p-6 rounded-2xl border-2 transition-all",
                getAlertColor(alert.type),
                alert.status === "resolved" && "opacity-60"
              )}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                  {getAlertIcon(alert.type)}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-slate-900">{alert.title}</h3>
                        <span className={cn("px-2 py-0.5 rounded text-xs font-medium capitalize", getStatusBadge(alert.status))}>
                          {alert.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">{alert.description}</p>
                    </div>
                    <span className="text-xs text-slate-400">{alert.timestamp}</span>
                  </div>
                  
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <User className="w-4 h-4" />
                      <span>{alert.patient}</span>
                      <span className="text-slate-300">•</span>
                      <span>{alert.patientId}</span>
                    </div>
                    <span className="px-2 py-1 bg-white rounded text-xs text-slate-600">
                      {alert.category}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {alert.status !== "acknowledged" && alert.status !== "resolved" && (
                    <button
                      onClick={() => acknowledgeAlert(alert.id)}
                      className="p-2 hover:bg-white rounded-lg transition-colors"
                      title="Acknowledge"
                    >
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                    </button>
                  )}
                  {alert.status !== "resolved" && (
                    <button
                      onClick={() => resolveAlert(alert.id)}
                      className="p-2 hover:bg-white rounded-lg transition-colors"
                      title="Resolve"
                    >
                      <X className="w-5 h-5 text-slate-400" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {filteredAlerts.length === 0 && (
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-emerald-200 mx-auto mb-4" />
            <p className="text-slate-500">No alerts matching your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}