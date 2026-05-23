"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Users, Building2, Settings, Activity, Database, FileText, Bell,
  Lock, Key, Plus, Search, Filter, MoreHorizontal, CheckCircle, XCircle,
  AlertCircle, TrendingUp, TrendingDown, Clock, Download, Upload,
  RefreshCw, Trash2, Edit, X, Sparkles, Zap, Server, HardDrive,
  Wifi, Layers, History, UserPlus, Fingerprint, ShieldAlert, Cpu
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ── Types ──────────────────────────────────────────────────────────────────────
interface User { id: string; name: string; email: string; role: string; department: string; status: "active" | "inactive" | "pending"; lastLogin: string; createdAt: string; avatar: string; twoFactorEnabled: boolean; }
interface SystemMetric { name: string; value: string; change: number; trend: "up" | "down"; icon: any; color: string; bg: string; }
interface AuditLog { id: string; user: string; action: string; resource: string; timestamp: string; ip: string; status: "success" | "failure" | "warning"; }
interface Role { id: string; name: string; description: string; permissions: string[]; usersCount: number; }

// ── Mock Data ──────────────────────────────────────────────────────────────────
const mockUsers: User[] = [
  { id: "1", name: "Dr. Sarah Chen", email: "sarah@metapharsic.com", role: "Physician", department: "Cardiology", status: "active", lastLogin: "Just now", createdAt: "2023-01-15", avatar: "SC", twoFactorEnabled: true },
  { id: "2", name: "Dr. Michael Ross", email: "michael@metapharsic.com", role: "Physician", department: "Internal Med", status: "active", lastLogin: "1h ago", createdAt: "2023-02-20", avatar: "MR", twoFactorEnabled: true },
  { id: "3", name: "Nurse Johnson", email: "johnson@metapharsic.com", role: "Nurse", department: "Emergency", status: "active", lastLogin: "3h ago", createdAt: "2023-03-10", avatar: "NJ", twoFactorEnabled: false },
  { id: "4", name: "System Admin", email: "admin@metapharsic.com", role: "Admin", department: "IT", status: "active", lastLogin: "5h ago", createdAt: "2023-01-01", avatar: "SA", twoFactorEnabled: true },
  { id: "5", name: "Jane Smith", email: "jane@metapharsic.com", role: "Assistant", department: "Pediatrics", status: "pending", lastLogin: "Never", createdAt: "2024-02-20", avatar: "JS", twoFactorEnabled: false },
];

const mockMetrics: SystemMetric[] = [
  { name: "Active Users", value: "842", change: 12, trend: "up", icon: Users, color: "text-cyan-500", bg: "bg-cyan-500/10" },
  { name: "Threats Blocked", value: "1,204", change: 34, trend: "up", icon: ShieldAlert, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  { name: "System Uptime", value: "99.99%", change: 0.01, trend: "up", icon: Server, color: "text-violet-500", bg: "bg-violet-500/10" },
  { name: "API Latency", value: "24ms", change: 5, trend: "down", icon: Cpu, color: "text-amber-500", bg: "bg-amber-500/10" },
];

const mockAuditLogs: AuditLog[] = [
  { id: "1", user: "Dr. Sarah Chen", action: "Accessed Patient Record", resource: "PT-12345", timestamp: "2024-02-23 15:30", ip: "192.168.1.100", status: "success" },
  { id: "2", user: "System Admin", action: "Changed Role Permissions", resource: "Role: Nurse", timestamp: "2024-02-23 14:15", ip: "192.168.1.50", status: "success" },
  { id: "3", user: "Unknown (Russia)", action: "Failed Login Attempt", resource: "Auth Gateway", timestamp: "2024-02-23 12:45", ip: "203.0.113.45", status: "failure" },
  { id: "4", user: "Nurse Johnson", action: "Password Reset Request", resource: "User Profile", timestamp: "2024-02-23 11:20", ip: "192.168.1.101", status: "warning" },
];

// ── Components ────────────────────────────────────────────────────────────────
function StatCard({ metric }: { metric: SystemMetric }) {
  const Icon = metric.icon;
  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-6 border border-white/40 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all relative overflow-hidden group">
      <div className={cn("absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity", metric.bg.replace('/10', ''))} />
      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center", metric.bg)}>
            <Icon className={cn("w-7 h-7", metric.color)} />
          </div>
          <div className={cn("flex items-center gap-1 text-sm font-bold", metric.trend === "up" ? "text-emerald-500" : "text-amber-500")}>
            {metric.trend === "up" ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {metric.change}%
          </div>
        </div>
        <div className="mt-6">
          <p className="text-4xl font-black text-slate-800 tracking-tight">{metric.value}</p>
          <p className="text-sm font-semibold text-slate-500 mt-1">{metric.name}</p>
        </div>
      </div>
    </div>
  );
}

function AIInsights() {
  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-8 border border-slate-700 shadow-xl relative overflow-hidden text-white mb-8">
      <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500 rounded-full blur-[120px] opacity-20 animate-pulse" />
      <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 bg-white/10 backdrop-blur-xl border border-white/20 shadow-inner">
          <Sparkles className="w-8 h-8 text-cyan-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">Metta AI Security & Optimization Insights <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/30">Active Analysis</Badge></h2>
          <p className="text-slate-300 text-sm mb-6 max-w-2xl leading-relaxed">Neural network monitoring has detected 3 unused roles and 2 pending accounts requiring attention. System architecture is running at optimal latency. Security protocols have automatically blocked 45 brute-force attempts from unrecognized IPs in the last hour.</p>
          <div className="flex gap-4">
            <Button className="bg-white hover:bg-cyan-50 text-slate-900 font-bold px-6 shadow-[0_0_20px_rgba(6,182,212,0.4)]">
              <Zap className="w-4 h-4 mr-2 text-amber-500 fill-amber-500" /> Apply Recommended Optimizations
            </Button>
            <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 font-medium">View Security Report</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Layout ─────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-[1600px] mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 mt-2">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <Shield className="w-10 h-10 text-cyan-500" strokeWidth={2.5} />
              System Administration
            </h1>
            <p className="text-slate-500 font-medium mt-2">Manage infrastructure, security policies, and access control.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="bg-white font-bold h-12 px-6 rounded-xl border-slate-200 text-slate-700 shadow-sm">
              <Download className="w-5 h-5 mr-2" /> Audit Export
            </Button>
            <Button className="font-bold h-12 px-6 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-lg hover:shadow-xl transition-all">
              <Settings className="w-5 h-5 mr-2" /> Global Settings
            </Button>
          </div>
        </div>

        <AIInsights />

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {mockMetrics.map(m => <StatCard key={m.name} metric={m} />)}
        </div>

        {/* Main Content Area */}
        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Left / Center Column: Users & Audit */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Users Panel */}
            <div className="bg-white rounded-[2rem] p-8 border border-white/40 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">User Management</h3>
                  <p className="text-sm font-medium text-slate-500">Active sessions and permissions</p>
                </div>
                <Button className="bg-cyan-50 font-bold text-cyan-700 hover:bg-cyan-100 rounded-xl px-5 h-10 shadow-sm border border-cyan-200">
                  <UserPlus className="w-4 h-4 mr-2" /> Invite User
                </Button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="pb-4 font-bold text-slate-400 text-xs uppercase tracking-wider">User</th>
                      <th className="pb-4 font-bold text-slate-400 text-xs uppercase tracking-wider">Role & Dept</th>
                      <th className="pb-4 font-bold text-slate-400 text-xs uppercase tracking-wider">Status</th>
                      <th className="pb-4 font-bold text-slate-400 text-xs uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {mockUsers.map(user => (
                      <tr key={user.id} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="py-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-100 to-purple-100 text-cyan-800 font-bold text-sm flex items-center justify-center border border-white shadow-sm">
                              {user.avatar}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800">{user.name}</p>
                              <p className="text-xs font-medium text-slate-500 mt-0.5">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4">
                          <p className="font-semibold text-slate-700">{user.role}</p>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">{user.department}</p>
                        </td>
                        <td className="py-4">
                          <span className={cn("px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wide", 
                            user.status === "active" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                            user.status === "pending" ? "bg-amber-50 text-amber-600 border border-amber-100" : "bg-slate-50 text-slate-600"
                          )}>
                            {user.status}
                          </span>
                        </td>
                        <td className="py-4 text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50"><Edit className="w-4 h-4"/></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 className="w-4 h-4"/></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Audit Log Panel */}
            <div className="bg-white rounded-[2rem] p-8 border border-white/40 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Live Security Audit</h3>
                  <p className="text-sm font-medium text-slate-500">Real-time system event monitoring</p>
                </div>
                <Button variant="outline" size="icon" className="rounded-xl border-slate-200"><Filter className="w-4 h-4" /></Button>
              </div>

              <div className="space-y-4">
                {mockAuditLogs.map(log => (
                  <div key={log.id} className="flex items-start gap-4 p-4 rounded-2xl border border-slate-100 hover:border-slate-200 transition-colors bg-slate-50/50">
                    <div className={cn("mt-1 w-2 h-2 rounded-full", 
                      log.status === "success" ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" :
                      log.status === "warning" ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" :
                      "bg-rose-500 shadow-[0_0_10px_rgba(225,29,72,0.5)]"
                    )} />
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <p className="font-bold text-slate-800 text-sm">{log.action}</p>
                        <p className="text-xs font-semibold text-slate-400">{log.timestamp}</p>
                      </div>
                      <p className="text-xs font-medium text-slate-500 mt-1">User: <span className="text-slate-700">{log.user}</span> • IP: <span className="font-mono bg-white px-1.5 py-0.5 rounded text-[10px] border border-slate-200">{log.ip}</span> • Resource: <span className="italic">{log.resource}</span></p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
          </div>

          {/* Right Column: Roles & Server Status */}
          <div className="space-y-8">
            
            {/* Server Status Widget */}
            <div className="bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 rounded-full blur-[100px] opacity-10" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-bold flex items-center gap-2"><Server className="w-5 h-5 text-emerald-400" /> Infrastructure</h3>
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10">All Systems Go</Badge>
                </div>
                
                <div className="space-y-6">
                  {["Database Cluster", "AI Gateway", "Auth Service"].map((sys, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-semibold text-slate-300">{sys}</span>
                        <span className="text-emerald-400 font-mono text-xs font-bold">99.99%</span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: "95%" }} transition={{ duration: 1, delay: i * 0.2 }} className="h-full bg-emerald-500 rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-[2rem] p-8 border border-white/40 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2"><Settings className="w-5 h-5 text-violet-500" /> Configuration</h3>
              <div className="space-y-3">
                <Button variant="outline" className="w-full justify-start h-14 rounded-xl font-bold bg-slate-50 hover:bg-slate-100 border-slate-200">
                  <Key className="w-4 h-4 mr-3 text-slate-400" /> Manage Roles & Permissions
                </Button>
                <Button variant="outline" className="w-full justify-start h-14 rounded-xl font-bold bg-slate-50 hover:bg-slate-100 border-slate-200">
                  <Building2 className="w-4 h-4 mr-3 text-slate-400" /> Organization Settings
                </Button>
                <Button variant="outline" className="w-full justify-start h-14 rounded-xl font-bold bg-slate-50 hover:bg-slate-100 border-slate-200">
                  <Fingerprint className="w-4 h-4 mr-3 text-slate-400" /> Biometric Access Rules
                </Button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
