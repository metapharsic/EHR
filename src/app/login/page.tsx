"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Eye, EyeOff, Sparkles, Brain, FileText, Activity, Zap, Shield } from "lucide-react";

const aiFeatures = [
  { icon: Brain, label: "Neural Symptom Mapper", desc: "AI-powered diagnosis assistance" },
  { icon: FileText, label: "Auto-Documentation", desc: "Voice-to-chart in real time" },
  { icon: Activity, label: "Predictive Timeline", desc: "Forecast patient health risks" },
  { icon: Zap, label: "Ambient Scribe", desc: "Hands-free clinical notes" },
];

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const result = await signIn("credentials", {
        email, password, redirect: false, callbackUrl,
      });
      if (result?.error) {
        setError("Invalid email or password");
      } else if (result?.ok) {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* Left Panel - Metta AI Showcase */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden bg-gradient-to-br from-violet-900 via-purple-900 to-indigo-950">
        {/* Background glows */}
        <div className="absolute top-0 left-0 w-96 h-96 rounded-full bg-violet-500/20 blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-cyan-500/15 blur-3xl translate-x-1/3 translate-y-1/3" />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 rounded-full bg-purple-400/10 blur-2xl -translate-x-1/2 -translate-y-1/2" />

        {/* Logo */}
        <div className="relative flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center shadow-lg">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-bold text-xl text-white">Metapharsic</p>
            <p className="text-violet-300 text-sm">Lifesciences EHR</p>
          </div>
        </div>

        {/* Center Hero */}
        <div className="relative">
          {/* Live badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-300 text-xs font-semibold">METTA AI · LIVE · 98.7% Accuracy</span>
          </div>

          <h1 className="text-4xl font-bold text-white leading-tight mb-3">
            The World's First
            <br />
            <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
              AI-Native EHR
            </span>
          </h1>
          <p className="text-violet-200 text-base leading-relaxed mb-8">
            Metta AI works alongside you — documenting encounters, mapping symptoms, predicting outcomes, and writing prescriptions in real time.
          </p>

          {/* AI Feature Cards */}
          <div className="grid grid-cols-2 gap-3">
            {aiFeatures.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3 p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all duration-200">
                <div className="w-9 h-9 rounded-xl bg-violet-500/30 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-violet-200" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold leading-none">{label}</p>
                  <p className="text-violet-300 text-xs mt-1 leading-snug">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom stats */}
        <div className="relative flex items-center gap-6">
          {[
            { value: "1,284", label: "Active Patients" },
            { value: "24", label: "AI Notes Today" },
            { value: "<12ms", label: "Inference Speed" },
          ].map(({ value, label }) => (
            <div key={label}>
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-violet-300 text-xs">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-slate-950">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-white">Metapharsic</p>
            <p className="text-violet-400 text-xs">Lifesciences EHR</p>
          </div>
        </div>

        <div className="w-full max-w-sm">
          {/* Metta AI badge */}
          <div className="flex items-center gap-2 mb-6">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/20 border border-violet-500/30 rounded-full">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-violet-300 text-xs font-medium">Powered by Metta AI</span>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-white mb-1">Welcome back</h2>
          <p className="text-slate-400 text-sm mb-8">Sign in to your clinical workspace</p>

          {error && (
            <Alert variant="destructive" className="mb-5 bg-rose-500/10 border-rose-500/30">
              <AlertCircle className="h-4 w-4 text-rose-400" />
              <AlertDescription className="text-rose-300">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
                Email address
              </label>
              <Input
                id="email"
                type="email"
                placeholder="name@metapharsic.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20 h-11"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="text-sm font-medium text-slate-300">
                  Password
                </label>
                <Link href="/forgot-password" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20 h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="remember"
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-violet-500 focus:ring-violet-500/20"
              />
              <label htmlFor="remember" className="text-sm text-slate-400">Remember me for 30 days</label>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-violet-500/25 transition-all duration-200 border-0"
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</>
              ) : (
                <><Sparkles className="mr-2 h-4 w-4" />Sign in to Workspace</>
              )}
            </Button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-6 p-4 bg-slate-800/60 border border-slate-700/50 rounded-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-3.5 h-3.5 text-slate-400" />
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Demo Credentials</p>
            </div>
            <div className="space-y-1.5">
              {[
                { role: "Admin", email: "admin@metapharsic.com", pass: "admin123" },
                { role: "Physician", email: "physician@metapharsic.com", pass: "physician123" },
                { role: "Nurse", email: "nurse@metapharsic.com", pass: "nurse123" },
              ].map(({ role, email: e, pass }) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => { setEmail(e); setPassword(pass); }}
                  className="w-full flex items-center justify-between px-3 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors group"
                >
                  <span className="text-xs font-medium text-slate-300 group-hover:text-white">{role}</span>
                  <span className="text-[10px] text-slate-500 font-mono group-hover:text-slate-400">{e}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="text-center text-xs text-slate-600 mt-6">
            Protected by HIPAA-compliant security · Unauthorized access is prohibited
          </p>
        </div>
      </div>
    </div>
  );
}
