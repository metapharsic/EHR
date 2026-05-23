"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { usePatients } from "@/hooks/usePatients";
import { formatAge, formatDate } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  Search,
  Plus,
  Phone,
  MessageCircle,
  MapPin,
  Sparkles,
  ShieldCheck,
  Activity,
  UserPlus,
  Loader2,
  Calendar,
  ChevronRight,
  Stethoscope,
  Mic,
  QrCode
} from "lucide-react";

export default function PatientsDashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAiSearching, setIsAiSearching] = useState(false);

  // In a real app, this hook would fetch data based on the query.
  // We're adapting the returned data to mirror Indian Standards visually.
  const { data, isLoading } = usePatients({
    query: searchQuery,
    page: 1,
    limit: 20,
    sortBy: "lastName",
    sortOrder: "asc",
  });

  const rawPatients = data?.data || [];
  
  // Transform standard mock data to Indian standards for demonstration of the "Premium Feature"
  const enhancedPatients = rawPatients.map((p: any, index: number) => ({
    ...p,
    fullName: `${p.firstName} ${p.lastName}`,
    phone: `+91 98${Math.floor(10000000 + Math.random() * 90000000)}`, // Generate fake +91 numbers
    abhaId: `${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
    location: ["Banjara Hills, Hyderabad", "Andheri West, Mumbai", "Koramangala, Bengaluru", "Cyber City, Gurugram"][index % 4],
    language: ["English, Telugu", "English, Hindi", "Hindi, Marathi", "English, Tamil"][index % 4],
    bloodType: ["O+", "A+", "B+", "AB-"][index % 4],
    lastVisit: ["Today, 10:30 AM", "Yesterday", "2 Days Ago", "Last Week"][index % 4],
    urgentAlert: index === 0 ? "Diabetic (Type 2)" : index === 2 ? "Penicillin Allergy" : null,
  }));

  const handleAiSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    setIsAiSearching(true);
    // Simulate AI parsing delay
    setTimeout(() => setIsAiSearching(false), 1200);
  };

  return (
    <div className="space-y-8 pb-10">
      
      {/* ─── Hero & AI Search ────────────────────────────────────────────────── */}
      <div 
        className="relative overflow-hidden rounded-3xl p-8 text-white mt-2"
        style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}
      >
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, #fff 1px, transparent 0)", backgroundSize: "32px 32px" }} />
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-violet-500/10 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" />

        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div>
              <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                Patient Intelligence Hub
                <Badge className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 border-0">LIVE</Badge>
              </h1>
              <p className="text-slate-400 mt-1">Manage patient demographics, ABHA records, and smart intake modalities.</p>
            </div>
          </div>

          {/* AI Search Bar */}
          <form onSubmit={handleAiSearch} className="relative max-w-3xl group">
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
            <div className="relative flex items-center bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden p-1 shadow-2xl">
              <div className="pl-4 pr-3 flex items-center justify-center">
                {isAiSearching ? (
                  <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                ) : (
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                )}
              </div>
              <input
                type="text"
                placeholder="Ask Metta AI... (e.g. 'Show me all active diabetic patients in Hyderabad')"
                className="flex-1 bg-transparent border-0 text-white placeholder-slate-400 focus:ring-0 text-base py-3 outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button 
                type="submit"
                className="bg-white/10 hover:bg-white/20 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-all mr-1 flex items-center gap-2"
              >
                Intelligent Search
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ─── Multi-modal Intake Action Bar ───────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 px-1">Quick Intake Modalities</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* WhatsApp Sync */}
          <Link href="/whatsapp-sync" className="group relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-5 shadow-sm hover:shadow-xl hover:border-emerald-300 transition-all cursor-pointer flex flex-col justify-between block">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-full -z-10 group-hover:bg-emerald-500/10 transition-colors" />
            <div>
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
                <MessageCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">WhatsApp Triage</h3>
              <p className="text-sm text-slate-500 mt-1">Sync medical history & records sent by patient via WhatsApp (+91).</p>
            </div>
            <div className="mt-5 flex items-center gap-2 text-emerald-600 text-sm font-semibold group-hover:translate-x-1 transition-transform">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-[10px]">3</span>
              Pending Syncs <ChevronRight className="w-4 h-4" />
            </div>
          </Link>

          {/* Voice Consultation Route */}
          <Link href="/voice" className="group relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-5 shadow-sm hover:shadow-xl hover:border-cyan-300 transition-all cursor-pointer flex flex-col justify-between block">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-bl-full -z-10 group-hover:bg-cyan-500/10 transition-colors" />
            <div>
              <div className="w-12 h-12 bg-cyan-100 text-cyan-600 rounded-xl flex items-center justify-center mb-4">
                <Mic className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Live Voice Consult</h3>
              <p className="text-sm text-slate-500 mt-1">Start a trilingual audio assessment. AI auto-extracts symptoms inline.</p>
            </div>
            <div className="mt-5 flex items-center text-cyan-600 text-sm font-semibold group-hover:translate-x-1 transition-transform">
              Launch Voice Hub <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </Link>

          {/* Manual Registration */}
          <Link href="/patients/new" className="group relative overflow-hidden rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-xl hover:border-violet-300 transition-all cursor-pointer flex flex-col justify-between block"
            style={{ background: "linear-gradient(to bottom right, #ffffff, #f8fafc)" }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-bl-full -z-10 group-hover:bg-violet-500/10 transition-colors" />
            <div>
              <div className="w-12 h-12 bg-violet-100 text-violet-600 rounded-xl flex items-center justify-center mb-4">
                <UserPlus className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Walk-in Registry</h3>
              <p className="text-sm text-slate-500 mt-1">Register walk-in patients manually. Requires active +91 mobile number.</p>
            </div>
            <div className="mt-5 flex items-center text-violet-600 text-sm font-semibold group-hover:translate-x-1 transition-transform">
              Register New Patient <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </Link>

        </div>
      </div>

      {/* ─── Premium Patient Database ────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Active Patient Directory</h2>
          <span className="text-xs font-semibold text-slate-400 border border-slate-200 px-3 py-1 rounded-full bg-white">
            {enhancedPatients.length} Records Found
          </span>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center rounded-3xl border border-slate-200 bg-white shadow-sm">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
          </div>
        ) : enhancedPatients.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 rounded-3xl border border-slate-200 bg-white shadow-sm text-center">
            <Search className="h-12 w-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-800">No Patient Records Found</h3>
            <p className="text-slate-500 mt-2">Adjust your AI search criteria or register a new patient via mobile number.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <AnimatePresence>
              {enhancedPatients.map((patient: any, i: number) => (
                <motion.div
                  key={patient.id || i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="group bg-white rounded-3xl border border-slate-200 p-5 hover:shadow-xl hover:border-cyan-200 transition-all"
                >
                  <div className="flex flex-col sm:flex-row gap-5">
                    {/* Avatar & Basics */}
                    <div className="flex items-start gap-4">
                      <Avatar className="h-16 w-16 shadow-md border-2 border-white rounded-2xl flex-shrink-0">
                        <AvatarImage src={patient.photoUrl} alt={patient.firstName} className="object-cover" />
                        <AvatarFallback className="bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 font-bold text-xl rounded-2xl">
                          {patient.firstName?.[0]}{patient.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <Link href={`/patients/${patient.id}`} className="hover:opacity-80 transition-opacity">
                          <h3 className="text-lg font-black text-slate-900 leading-tight">
                            {patient.fullName} <span className="text-sm text-slate-500 font-medium ml-1">({formatAge(patient.dateOfBirth)})</span>
                          </h3>
                        </Link>
                        
                        {/* Indian Standard Primary Anchor: Mobile Number */}
                        <div className="flex items-center gap-1.5 mt-1">
                          <Phone className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-sm font-bold text-slate-700 tracking-wide">{patient.phone}</span>
                          <ShieldCheck className="w-3.5 h-3.5 text-blue-500 ml-1" />
                        </div>
                        
                        {/* ABHA ID */}
                        <div className="flex items-center gap-1.5 mt-1.5 bg-slate-50 w-fit px-2 py-0.5 rounded text-xs border border-slate-100">
                          <QrCode className="w-3 h-3 text-slate-400" />
                          <span className="font-mono text-slate-600">ABHA: {patient.abhaId}</span>
                        </div>
                      </div>
                    </div>

                    <div className="hidden sm:block w-px bg-slate-100" /> {/* Divider */}

                    {/* Clinical Meta & Actions */}
                    <div className="flex-1 flex flex-col justify-between">
                      <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                          <div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Location</p>
                            <p className="text-xs text-slate-700 font-medium truncate max-w-[120px]">{patient.location}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Activity className="w-4 h-4 text-slate-400 mt-0.5" />
                          <div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Blood/Lang</p>
                            <p className="text-xs text-slate-700 font-medium">{patient.bloodType} • {patient.language.split(',')[0]}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 col-span-2">
                          <Calendar className="w-4 h-4 text-slate-400 mt-0.5" />
                          <div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Last Encounter</p>
                            <p className="text-xs text-cyan-600 font-semibold">{patient.lastVisit}</p>
                          </div>
                        </div>
                      </div>

                      {/* Badges / Alerts */}
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          {patient.urgentAlert && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-50 text-rose-600 text-xs font-bold border border-rose-100">
                              <Activity className="w-3 h-3" />
                              {patient.urgentAlert}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-100 xl:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 transition-colors">
                            <MessageCircle className="w-4 h-4" />
                          </button>
                          <Link href="/voice" className="w-8 h-8 rounded-full bg-cyan-50 text-cyan-600 flex items-center justify-center hover:bg-cyan-100 transition-colors">
                            <Stethoscope className="w-4 h-4" />
                          </Link>
                        </div>
                      </div>
                    </div>

                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", className)}>
      {children}
    </span>
  );
}
