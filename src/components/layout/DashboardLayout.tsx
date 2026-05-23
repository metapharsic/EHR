"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { SessionUser } from "@/types";
import { FloatingNav } from "./FloatingNav";
import { cn, initials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getRoleDisplayName } from "@/lib/auth/roles";
import { AdvancedVoiceAssistant } from "@/components/ai/AdvancedVoiceAssistant";
import {
  Sparkles, Bell, Settings, LogOut, ChevronDown, ChevronRight,
  Mic, Brain, Users, FileText, Calendar, Stethoscope,
  ClipboardList, TrendingUp, Search, X, Command, Activity, Zap
} from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
  user: SessionUser;
}

export function DashboardLayout({ children, user }: DashboardLayoutProps) {
  const router = useRouter();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  // Smart Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchResults = async () => {
      if (searchQuery.length === 0) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSearchResults(data.results || []);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(fetchResults, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  const handleResultClick = (href: string) => {
    router.push(href);
    setSearchOpen(false);
    setSearchQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && searchQuery) {
      if (searchResults.length > 0) {
        handleResultClick(searchResults[0].href);
      } else {
        router.push(`/patients?q=${encodeURIComponent(searchQuery)}`);
        setSearchOpen(false);
        setSearchQuery("");
      }
    }
    if (e.key === "Escape") setSearchOpen(false);
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <FloatingNav user={user} onExpandChange={setSidebarExpanded} />

      <div className="min-h-screen flex flex-col transition-all duration-300 ease-out" style={{ marginLeft: sidebarExpanded ? 256 : 72 }}>
        
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md shadow-sm">
          <div className="px-6 py-3 flex items-center justify-between gap-4">
            
            {/* Server / AI Status Badge */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 shadow-sm cursor-pointer hover:bg-slate-800 transition-colors">
              <div className="relative flex items-center justify-center w-4 h-4">
                <span className="absolute w-full h-full rounded-full border border-cyan-400/40 animate-ping" />
                <span className="relative w-2 h-2 rounded-full bg-cyan-400" />
              </div>
              <span className="text-xs font-bold text-white tracking-wide">Metta AI Core</span>
              <span className="text-[10px] text-cyan-400 font-mono font-medium">12ms</span>
            </div>

            {/* Faux Search Bar (Triggers Modal) */}
            <div className="flex-1 max-w-2xl mx-auto relative group">
              <div 
                onClick={() => setSearchOpen(true)}
                className="w-full flex items-center gap-3 bg-slate-100 hover:bg-slate-200/60 border border-slate-200 hover:border-cyan-300 rounded-2xl px-4 py-2.5 cursor-text transition-all duration-300 shadow-sm group-hover:shadow-md"
              >
                <Search className="w-5 h-5 text-slate-400 group-hover:text-cyan-500 transition-colors" />
                <span className="text-sm font-medium text-slate-500 flex-1 flex items-center gap-2">Search patients, records, or ask Metta <Sparkles className="w-3.5 h-3.5 text-amber-500"/></span>
                <div className="flex items-center gap-1.5 opacity-60">
                  <kbd className="h-6 px-2 rounded-md bg-white border border-slate-200 text-xs font-bold text-slate-600 flex items-center">
                    <Command className="w-3 h-3 mr-1" /> K
                  </kbd>
                </div>
              </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-3">
              <Button size="icon" className={cn("h-10 w-10 rounded-2xl transition-all duration-300 shadow-sm", isListening ? "bg-rose-500 hover:bg-rose-600 text-white animate-pulse" : "bg-white border border-slate-200 hover:border-cyan-300 text-slate-600 hover:text-cyan-600")} onClick={() => setIsListening(!isListening)}>
                <Mic className="h-5 w-5" />
              </Button>

              <Button size="icon" variant="ghost" className="h-10 w-10 rounded-2xl relative text-slate-600 hover:bg-slate-100 border border-transparent hover:border-slate-200">
                <Bell className="h-5 w-5" />
                <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
              </Button>

              <div className="relative">
                <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="flex items-center gap-3 p-1.5 pr-4 rounded-2xl hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500/20">
                  <Avatar className="h-9 w-9 shadow-sm">
                    <AvatarImage src={user.image} alt={user.name} />
                    <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-500 text-white text-xs font-bold shadow-inner">
                      {user.name ? initials(user.name.split(" ")[0], user.name.split(" ").pop() || "") : "??"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-bold text-slate-900 leading-tight">{user.name}</p>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{getRoleDisplayName(user.role)}</p>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform hidden md:block", userMenuOpen && "rotate-180")} />
                </button>

                {/* User Menu Dropdown */}
                <AnimatePresence>
                  {userMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                      <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute right-0 top-full mt-3 w-72 bg-white rounded-3xl border border-slate-200 shadow-[0_20px_60px_rgba(0,0,0,0.08)] p-2 z-50 overflow-hidden">
                        <div className="p-4 bg-slate-50/50 rounded-2xl mb-2">
                          <p className="font-black text-slate-900 text-base">{user.name}</p>
                          <p className="text-xs font-medium text-slate-500">{user.email}</p>
                        </div>
                        <Link href="/admin" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-cyan-600 transition-colors w-full group">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-cyan-100 flex items-center justify-center transition-colors"><Settings className="w-4 h-4" /></div>
                          Administration
                        </Link>
                        <button className="w-full flex items-center gap-3 p-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-purple-600 transition-colors group">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-purple-100 flex items-center justify-center transition-colors"><Sparkles className="w-4 h-4" /></div>
                          AI Preferences
                        </button>
                        <div className="h-px bg-slate-100 my-2 mx-2" />
                        <Link href="/api/auth/signout" className="flex items-center gap-3 p-3 rounded-xl text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors w-full">
                          <LogOut className="h-4 h-4 mr-1" /> Sign Out
                        </Link>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        {/* Global Smart Search Modal */}
        <AnimatePresence>
          {searchOpen && (
            <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSearchOpen(false)} />
              
              <motion.div initial={{ opacity: 0, scale: 0.98, y: -20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: -20 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="relative w-full max-w-3xl bg-white rounded-3xl shadow-[0_40px_100px_rgba(0,0,0,0.2)] border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]">
                
                {/* Search Input Area */}
                <div className="relative flex items-center px-6 py-5 border-b border-slate-100">
                  <Search className="w-6 h-6 text-cyan-500 mr-4 flex-shrink-0" />
                  <input
                    ref={searchInputRef}
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search patients, conditions, or ask Metta AI..."
                    className="w-full bg-transparent border-none outline-none text-xl font-medium text-slate-900 placeholder:text-slate-400"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 absolute right-16">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  <div className="px-3 py-1 bg-slate-100 rounded-lg border border-slate-200 ml-4 flex items-center gap-1">
                    <Command className="w-3 h-3 text-slate-500" />
                    <span className="text-xs font-bold text-slate-500">K</span>
                  </div>
                </div>

                {/* Loading State */}
                {isSearching && (
                  <div className="p-8 flex items-center gap-4 text-slate-500 bg-slate-50/50">
                    <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                    <p className="font-medium">Metta AI Neural Net Scanning...</p>
                  </div>
                )}

                {/* Search Results Area */}
                {!isSearching && (
                  <div className="overflow-y-auto flex-1 p-2">
                    {searchQuery.length > 0 && searchResults.length === 0 ? (
                      <div className="p-12 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                          <Search className="w-8 h-8 text-slate-300" />
                        </div>
                        <p className="text-slate-900 font-bold text-lg mb-1">No results found for "{searchQuery}"</p>
                        <p className="text-slate-500 text-sm">Try asking Metta AI to generate a report instead.</p>
                      </div>
                    ) : searchQuery.length > 0 ? (
                      <div className="p-2 space-y-1">
                        <p className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-cyan-600 flex items-center gap-2">
                          <Activity className="w-4 h-4" /> AI Correlated Results
                        </p>
                        {searchResults.map((result, i) => {
                          const iconMap: Record<string, any> = { LayoutDashboard: TrendingUp, Calendar, ClipboardList, FileText, Users, MessageCircle: Sparkles, Settings, Sparkles, Mic, Brain, User: Users, Stethoscope };
                          const Icon = iconMap[result.iconName] || Search;

                          if (result.isExecutable) {
                            const isExecuting = executingAction === result.title;
                            return (
                              <div key={i} className="mb-4 mt-2 p-[2px] rounded-[1.25rem] bg-gradient-to-r from-cyan-400 to-violet-500 shadow-md">
                                <div className="bg-white rounded-[1.15rem] p-5 relative overflow-hidden">
                                  <div className="flex items-start gap-5">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-50 to-violet-50 border border-white shadow-inner flex items-center justify-center flex-shrink-0">
                                      <Icon className="w-6 h-6 text-cyan-600" />
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                                        <span className="text-[10px] font-black text-violet-600 uppercase tracking-widest bg-violet-50 px-2 py-0.5 rounded-md">Autonomous Workflow</span>
                                      </div>
                                      <h4 className="font-bold text-slate-900 text-lg">{result.title}</h4>
                                      <div className="mt-3 grid grid-cols-2 gap-3">
                                        {Object.entries(result.actionPayload).map(([key, val]) => (
                                          <div key={key} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                            <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">{key}</p>
                                            <p className="text-sm font-semibold text-slate-800 truncate">{String(val)}</p>
                                          </div>
                                        ))}
                                      </div>
                                      <div className="mt-4 flex gap-3">
                                        <Button onClick={() => {
                                          setExecutingAction(result.title);
                                          setTimeout(() => {
                                            setExecutingAction(null);
                                            setSearchOpen(false);
                                            setSearchQuery("");
                                          }, 2000);
                                        }} disabled={isExecuting} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-lg h-12 font-bold text-sm">
                                          {isExecuting ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3"/> Executing Automation...</> : <>Approve & Execute Workflow <ChevronRight className="w-4 h-4 ml-2" /></>}
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <button key={i} onClick={() => handleResultClick(result.href)} className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-slate-50 cursor-pointer transition-all border border-transparent hover:border-slate-200 hover:shadow-sm text-left group">
                              <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-cyan-50 flex items-center justify-center flex-shrink-0 transition-colors border border-slate-200/60">
                                <Icon className="w-5 h-5 text-slate-500 group-hover:text-cyan-600" />
                              </div>
                              <div className="flex-1 overflow-hidden">
                                <p className="text-base font-bold text-slate-900 truncate">{result.title}</p>
                                <p className="text-sm font-medium text-slate-500 truncate mt-0.5">{result.subtitle}</p>
                              </div>
                              <span className="ml-auto flex items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-100 border border-slate-200 px-2 py-1.5 rounded-lg group-hover:border-cyan-200 group-hover:bg-cyan-50 group-hover:text-cyan-700 transition-colors">
                                {result.type}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4">
                        <p className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Suggested Workflows</p>
                        <div className="grid grid-cols-2 gap-3 mb-6">
                          {[
                            { icon: Sparkles, text: "Generate Waitlist Report", color: "text-violet-500", bg: "bg-violet-50", border: "border-violet-100" },
                            { icon: Users, text: "Find High-Risk Patients", color: "text-rose-500", bg: "bg-rose-50", border: "border-rose-100" },
                            { icon: FileText, text: "Auto-draft Clinical Notes", color: "text-cyan-500", bg: "bg-cyan-50", border: "border-cyan-100" },
                            { icon: Activity, text: "Analyze Revenue Impact", color: "text-emerald-500", bg: "bg-emerald-50", border: "border-emerald-100" },
                          ].map((item, i) => (
                            <button key={i} className={cn("flex flex-col items-start p-4 rounded-2xl border transition-all hover:shadow-md text-left", item.bg, item.border)}>
                              <item.icon className={cn("w-6 h-6 mb-3", item.color)} />
                              <span className="font-bold text-slate-800 text-sm leading-tight">{item.text}</span>
                            </button>
                          ))}
                        </div>
                        <p className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Quick Navigation</p>
                        <div className="flex flex-wrap gap-2 px-1">
                          {[ { name: "Dashboard", href: "/" }, { name: "Voice Hub", href: "/voice" }, { name: "Patient Directory", href: "/patients" }, { name: "Billing & Claims", href: "/documents" }, { name: "System Admin", href: "/admin" }].map(n => (
                            <Link key={n.name} href={n.href} onClick={() => setSearchOpen(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-colors">
                              {n.name}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
                    <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 rounded border border-slate-300 bg-white">↑↓</kbd> Navigate</span>
                    <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 rounded border border-slate-300 bg-white">↵</kbd> Select</span>
                    <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 rounded border border-slate-300 bg-white">ESC</kbd> Close</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-500" />
                    <span className="text-xs font-bold text-cyan-600">Metta AI Command Center</span>
                  </div>
                </div>

              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <main className="p-4 lg:p-6 pt-6 flex-1">
          {children}
        </main>
      </div>

      <AdvancedVoiceAssistant assistantName="Metta" />
    </div>
  );
}
