"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, MessageCircle, CheckCircle2, Loader2, FileText, Smartphone, AlertCircle } from "lucide-react";

export default function WhatsAppSyncPage() {
  const [syncing, setSyncing] = useState(true);
  const [syncStep, setSyncStep] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setShowSummary(true);
    }, 1500);
  };

  useEffect(() => {
    const timer1 = setTimeout(() => setSyncStep(1), 1500); // Extracting Chat
    const timer2 = setTimeout(() => setSyncStep(2), 3500); // Parsing Medical Entities
    const timer3 = setTimeout(() => {
      setSyncStep(3);
      setSyncing(false);
    }, 5500); // Complete

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/patients" className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-slate-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-emerald-500" /> WhatsApp Intake Sync
          </h1>
          <p className="text-slate-500">Securely parsing unstructured messages into Patient EHR data.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left: Original Chat View (Mock) */}
        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 relative overflow-hidden">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-200 pb-4">
            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-slate-800">+91 98765 43210</p>
              <p className="text-xs text-slate-500">Incoming Message Queue</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-white p-4 rounded-b-xl rounded-tr-xl border border-slate-200 shadow-sm w-[85%]">
              <p className="text-sm text-slate-700">"Doctor, since yesterday I am getting severe thala noppi (headache) and slightly feverish. Should I come to the clinic?"</p>
              <span className="text-[10px] text-slate-400 mt-2 block">10:42 AM</span>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }} className="bg-white p-4 rounded-b-xl rounded-tr-xl border border-slate-200 shadow-sm w-[85%]">
              <div className="flex items-center gap-2 mb-2 p-2 bg-slate-50 rounded border border-slate-100">
                <FileText className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-semibold text-slate-600">blood_report_jan.pdf</span>
              </div>
              <p className="text-sm text-slate-700">"Attaching my previous reports."</p>
              <span className="text-[10px] text-slate-400 mt-2 block">10:43 AM</span>
            </motion.div>
          </div>
        </div>

        {/* Right: AI Parsing Engine View */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-cyan-400" />
          
          <h3 className="font-bold text-slate-800 mb-6 flex items-center justify-between">
            Metta Engine Processing
            {syncing && <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />}
          </h3>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="mt-1">
                {syncStep >= 1 ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : <div className="w-6 h-6 rounded-full border-2 border-slate-200" />}
              </div>
              <div>
                <p className={`font-semibold ${syncStep >= 1 ? 'text-slate-800' : 'text-slate-400'}`}>Connecting to WhatsApp API</p>
                <p className="text-xs text-slate-500">Decrypting E2E messages for incoming number.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="mt-1">
                {syncStep >= 2 ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : <div className="w-6 h-6 rounded-full border-2 border-slate-200" />}
              </div>
              <div>
                <p className={`font-semibold ${syncStep >= 2 ? 'text-slate-800' : 'text-slate-400'}`}>Translating & Entity Extraction</p>
                <AnimatePresence>
                  {syncStep >= 2 && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 grid gap-2">
                      <span className="text-xs font-mono bg-rose-50 text-rose-600 px-2 py-1 rounded border border-rose-100 w-fit">Symptom: Headache (High)</span>
                      <span className="text-xs font-mono bg-orange-50 text-orange-600 px-2 py-1 rounded border border-orange-100 w-fit">Symptom: Fever (Low)</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="mt-1">
                {syncStep >= 3 ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : <div className="w-6 h-6 rounded-full border-2 border-slate-200" />}
              </div>
              <div>
                <p className={`font-semibold ${syncStep >= 3 ? 'text-slate-800' : 'text-slate-400'}`}>OCR PDF Analysis</p>
                <AnimatePresence>
                  {syncStep >= 3 && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3">
                      <div className="text-xs bg-slate-50 text-slate-600 p-2 rounded border border-slate-200 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        Extracted: HbA1c 6.2%, Fasting Glucose 110mg/dL. Match to Patient +919876543210 profile successful.
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {!syncing && !showSummary && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 pt-6 border-t border-slate-100">
                <button 
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  {isGenerating ? "Generating Insights..." : "Generate Clinical Summary & Draft Reply"}
                </button>
              </motion.div>
            )}

            {showSummary && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 pt-6 border-t border-slate-100 space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h4 className="font-bold text-slate-800 mb-2">Clinical Draft</h4>
                  <p className="text-sm text-slate-700">Pt reports severe headache and feverish feeling since yesterday. Recent labs (from automatically parsed PDF) exhibit HbA1c at 6.2% indicating prediabetes. Recommend in-clinic consult for comprehensive evaluation.</p>
                </div>
                
                <div>
                  <h4 className="font-bold text-slate-800 mb-2 mt-4 text-sm flex justify-between items-end">
                    <span>Draft WhatsApp Reply</span>
                    <button className="text-xs text-emerald-600 font-bold hover:underline">Edit</button>
                  </h4>
                  <textarea 
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                    rows={4}
                    defaultValue={"Hello! We have reviewed your messages and your attached lab reports. Considering your headache and fever, Doctor recommends coming into the clinic today for a quick check-up. Shall we book you an appointment for 2:00 PM?"}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button className="flex-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-3 rounded-xl transition-colors shadow-sm">
                    Discard
                  </button>
                  <Link href="/patients" className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-colors text-center inline-block shadow-sm">
                    Approve & Send (WhatsApp)
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
