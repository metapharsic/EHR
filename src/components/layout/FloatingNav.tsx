"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SessionUser } from "@/types";
import { filterNavItemsByRole, NAV_ITEMS } from "@/lib/auth/roles";
import {
  LayoutDashboard,
  Users,
  Calendar,
  FileText,
  Stethoscope,
  Settings,
  Sparkles,
  Mic,
  Search,
  Bell,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Users,
  Calendar,
  Stethoscope,
  FileText,
  Settings,
  Sparkles,
  List,
  UserPlus,
  Activity,
  Pill,
  AlertTriangle,
  UserCog,
  ClipboardList,
};

function List({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function UserPlus({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  );
}

function Activity({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function Pill({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  );
}

function AlertTriangle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function UserCog({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ClipboardList({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}

interface FloatingNavProps {
  user: SessionUser;
  onExpandChange?: (expanded: boolean) => void;
}

export function FloatingNav({ user, onExpandChange }: FloatingNavProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const pathname = usePathname();
  
  const navItems = filterNavItemsByRole(NAV_ITEMS, user.role);

  const handleExpand = (val: boolean) => {
    setIsExpanded(val);
    onExpandChange?.(val);
  };
  
  const getIcon = (iconName: string) => {
    const Icon = iconMap[iconName];
    return Icon ? <Icon className="h-5 w-5" /> : null;
  };

  return (
    <>
      {/* Mobile Menu Overlay */}
      {isExpanded && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => handleExpand(false)}
        />
      )}

      {/* Sidebar Navigation - Fixed full height */}
      <nav className={cn(
        "fixed left-0 top-0 h-full z-50 hidden lg:flex flex-col",
        "bg-white/95 backdrop-blur-xl border-r border-slate-200/80 shadow-xl shadow-slate-200/40",
        "transition-all duration-300 ease-out",
        isExpanded ? "w-64" : "w-[72px]"
      )}>
        {/* Logo */}
        <div className={cn(
          "flex items-center gap-3 px-3 py-4 border-b border-slate-100",
          isExpanded ? "justify-start" : "justify-center"
        )}>
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-cyan-500/20">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          {isExpanded && (
            <div className="overflow-hidden">
              <p className="font-bold text-sm text-slate-800 whitespace-nowrap">Metapharsic</p>
              <p className="text-[10px] text-cyan-600 font-medium whitespace-nowrap">AI-Native EHR</p>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <div className="flex flex-col gap-1 flex-1 overflow-y-auto px-2 py-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group",
                  isExpanded ? "" : "justify-center",
                  isActive 
                    ? "bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg shadow-cyan-500/25" 
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                )}
                onMouseEnter={() => !isExpanded && setActiveTooltip(item.title)}
                onMouseLeave={() => setActiveTooltip(null)}
              >
                <span className={cn(
                  "flex-shrink-0 transition-transform duration-200",
                  isActive ? "scale-110" : "group-hover:scale-110"
                )}>
                  {getIcon(item.icon)}
                </span>
                
                {isExpanded && (
                  <span className="text-sm font-medium whitespace-nowrap overflow-hidden">
                    {item.title}
                  </span>
                )}
                
                {isActive && !isExpanded && (
                  <span className="absolute right-1 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-white animate-pulse" />
                )}

                {/* Tooltip */}
                {!isExpanded && activeTooltip === item.title && (
                  <div className="absolute left-full ml-3 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap z-50 pointer-events-none">
                    {item.title}
                    <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 border-4 border-transparent border-r-slate-800" />
                  </div>
                )}
              </Link>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="px-2 pb-2 border-t border-slate-100 pt-2">
          <button className={cn(
            "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-slate-500 hover:bg-cyan-50 hover:text-cyan-600 transition-all group",
            !isExpanded && "justify-center"
          )}>
            <Mic className="h-5 w-5 flex-shrink-0 group-hover:scale-110 transition-transform" />
            {isExpanded && <span className="text-sm font-medium whitespace-nowrap">Voice Command</span>}
          </button>
          <button className={cn(
            "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-slate-500 hover:bg-purple-50 hover:text-purple-600 transition-all group",
            !isExpanded && "justify-center"
          )}>
            <Search className="h-5 w-5 flex-shrink-0 group-hover:scale-110 transition-transform" />
            {isExpanded && <span className="text-sm font-medium whitespace-nowrap">Smart Search</span>}
          </button>
        </div>

        {/* Expand/Collapse Button */}
        <div className="px-2 pb-4 border-t border-slate-100 pt-2">
          <button
            onClick={() => handleExpand(!isExpanded)}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-slate-400 hover:bg-slate-100 transition-all",
              !isExpanded && "justify-center"
            )}
          >
            <ChevronRight className={cn(
              "h-5 w-5 flex-shrink-0 transition-transform duration-300",
              isExpanded && "rotate-180"
            )} />
            {isExpanded && <span className="text-sm font-medium text-slate-500">Collapse</span>}
          </button>
        </div>
      </nav>

      {/* Mobile Floating Action Button */}
      <button
        onClick={() => handleExpand(!isExpanded)}
        className="fixed bottom-6 left-6 z-50 lg:hidden h-14 w-14 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-xl shadow-cyan-500/30 flex items-center justify-center"
      >
        {isExpanded ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Mobile Navigation Menu */}
      <div className={cn(
        "fixed bottom-24 left-6 z-50 lg:hidden",
        "glass rounded-2xl p-4 w-64",
        "transition-all duration-300",
        isExpanded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      )}>
        <div className="flex flex-col gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsExpanded(false)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl transition-all",
                  isActive 
                    ? "bg-gradient-to-r from-cyan-500 to-purple-500 text-white" 
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                {getIcon(item.icon)}
                <span className="text-sm font-medium">{item.title}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Top Bar for Mobile */}
      <header className="fixed top-0 left-0 right-0 z-40 lg:hidden glass border-b-0">
        <div className="flex items-center justify-between px-4 h-16">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-sm text-slate-800 ">Metapharsic</p>
              <p className="text-[10px] text-cyan-600">AI-Native EHR</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 ">
              <Bell className="h-5 w-5" />
            </button>
            <button className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 ">
              <Search className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Spacer for mobile */}
      <div className="h-16 lg:hidden" />
    </>
  );
}
