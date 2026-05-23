"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Stethoscope, FlaskConical, Scan, Pill, ChevronDown, ChevronUp,
  CheckSquare, Square, Printer, AlertTriangle, Sparkles, X,
  ClipboardList, Activity, ShieldAlert, RefreshCw, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getDifferentialDiagnosis, DiagnosisMatch, Diagnosis,
  LabTest, Imaging, Medication, Referral,
} from "@/lib/clinicalEngine";

// ─── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  symptoms: string[];   // plain-text symptom keywords from transcript/form
}

// ─── Severity colours ─────────────────────────────────────────────────────────
const SEV = {
  mild:      "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  moderate:  "bg-amber-500/15 text-amber-400 border-amber-500/25",
  severe:    "bg-orange-500/15 text-orange-400 border-orange-500/25",
  emergency: "bg-rose-600/20 text-rose-400 border-rose-500/35",
};

const SCORE_COLOR = (s: number) =>
  s >= 70 ? "text-emerald-400" : s >= 40 ? "text-amber-400" : "text-slate-500";

// ─── Order Summary types ─────────────────────────────────────────────────────
interface Orders {
  meds: Set<string>;
  labs: Set<string>;
  imaging: Set<string>;
  referrals: Set<string>;
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function ClinicalDecisionPanel({ symptoms }: Props) {
  const [selectedDxId, setSelectedDxId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Orders>({ meds: new Set(), labs: new Set(), imaging: new Set(), referrals: new Set() });
  const [showOrders, setShowOrders] = useState(false);
  const [expandSection, setExpandSection] = useState<"meds" | "labs" | "imaging" | "referrals" | null>("meds");

  const [matches, setMatches] = useState<DiagnosisMatch[]>([]);

  useEffect(() => {
    let active = true;
    if (symptoms.length > 0) {
      getDifferentialDiagnosis(symptoms).then(res => {
        if (active) setMatches(res);
      }).catch(err => console.error(err));
    } else {
      setMatches([]);
    }
    return () => { active = false; };
  }, [symptoms]);
  const selectedMatch = matches.find(m => m.diagnosis.id === selectedDxId);
  const dx = selectedMatch?.diagnosis;

  const toggle = (set: keyof Orders, val: string) => {
    setOrders(prev => {
      const copy = new Set(prev[set]);
      copy.has(val) ? copy.delete(val) : copy.add(val);
      return { ...prev, [set]: copy };
    });
  };

  const color = SEV[dx?.severity as keyof typeof SEV] || SEV.mild;
  const totalOrders = orders.meds.size + orders.labs.size + orders.imaging.size + orders.referrals.size;

  const selectAll = (dx: Diagnosis) => {
    setOrders({
      meds:     new Set(dx.medications.map(m => m.drug)),
      labs:     new Set(dx.labTests.map(l => l.name)),
      imaging:  new Set(dx.imaging.map(i => `${i.type} — ${i.region}`)),
      referrals:new Set(dx.referrals.map(r => r.specialty)),
    });
  };

  const clearAll = () => setOrders({ meds: new Set(), labs: new Set(), imaging: new Set(), referrals: new Set() });

  if (symptoms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20 }}>
        <Stethoscope className="w-10 h-10 text-slate-700 mb-3" />
        <p className="text-slate-500 text-sm">Enter patient symptoms to generate differential diagnoses</p>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <Activity className="w-9 h-9 text-slate-600 mb-3" />
        <p className="text-slate-500 text-sm">No matching diagnoses found. Try adding more specific symptoms.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Differential Diagnosis List ── */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: "rgba(10,15,30,0.9)", border: "1px solid rgba(6,182,212,0.12)" }}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Differential Diagnosis
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/20">
              {matches.length} suggestions
            </span>
          </div>
          <span className="text-[10px] text-slate-600">Click a diagnosis to proceed</span>
        </div>

        <div className="p-4 space-y-2">
          {matches.map((match, idx) => {
            const { diagnosis: d, score, matchedSymptoms } = match;
            const isSelected = selectedDxId === d.id;
            return (
              <motion.button
                key={d.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
                onClick={() => {
                  setSelectedDxId(isSelected ? null : d.id);
                  if (!isSelected) clearAll();
                }}
                className={cn(
                  "w-full text-left p-4 rounded-xl border transition-all duration-200",
                  isSelected
                    ? "bg-cyan-500/10 border-cyan-500/40"
                    : "bg-white/[0.025] border-white/[0.06] hover:bg-white/[0.05]"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Rank */}
                    <div className="min-w-[28px] h-7 flex items-center justify-center rounded-lg text-xs font-black"
                      style={{ background: isSelected ? "rgba(6,182,212,0.2)" : "rgba(255,255,255,0.05)", color: isSelected ? "#67e8f9" : "#64748b" }}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-white">{d.name}</span>
                        <span className="text-[10px] text-slate-500">{d.icd10}</span>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border capitalize", SEV[d.severity as keyof typeof SEV] || SEV.mild)}>
                          {d.severity}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-slate-500 border border-white/10">
                          {d.system}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {matchedSymptoms.slice(0, 5).map(s => (
                          <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                            ✓ {s}
                          </span>
                        ))}
                        {matchedSymptoms.length > 5 && (
                          <span className="text-[10px] text-slate-500">+{matchedSymptoms.length - 5} more</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Score */}
                  <div className="flex-shrink-0 text-right">
                    <p className={cn("text-xl font-black tabular-nums", SCORE_COLOR(score))}>{score}%</p>
                    <p className="text-[10px] text-slate-600">match</p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── Doctor's Order Panel ── */}
      <AnimatePresence>
        {dx && selectedMatch && (
          <motion.div
            key={dx.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="rounded-2xl overflow-hidden"
            style={{ background: "rgba(10,15,30,0.95)", border: "1px solid rgba(139,92,246,0.2)", boxShadow: "0 0 40px rgba(139,92,246,0.05)" }}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-white/5"
              style={{ background: "linear-gradient(90deg, rgba(139,92,246,0.08), transparent)" }}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <ClipboardList className="w-4 h-4 text-violet-400" />
                    <span className="text-xs text-slate-400 uppercase tracking-wider">Working Diagnosis</span>
                  </div>
                  <h3 className="text-lg font-black text-white">{dx.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{dx.notes}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => selectAll(dx)}
                    className="text-[10px] px-2.5 py-1.5 rounded-lg bg-violet-500/15 text-violet-400 border border-violet-500/20 hover:bg-violet-500/25 transition-all"
                  >
                    Select All
                  </button>
                  <button
                    onClick={clearAll}
                    className="text-[10px] px-2.5 py-1.5 rounded-lg bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 transition-all"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Red flags */}
              {dx.redFlags.length > 0 && (
                <div className="mt-3 flex items-start gap-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold text-rose-400 uppercase">Red Flags: </span>
                    <span className="text-[10px] text-rose-300">{dx.redFlags.join(" • ")}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Sections */}
            <div className="divide-y divide-white/5">
              {/* ── Medications ── */}
              <OrderSection
                icon={<Pill className="w-4 h-4 text-amber-400" />}
                label="Medications"
                badge={`${orders.meds.size}/${dx.medications.length}`}
                count={orders.meds.size}
                isOpen={expandSection === "meds"}
                onToggle={() => setExpandSection(expandSection === "meds" ? null : "meds")}
              >
                {dx.medications.map((med: any) => {
                  const key = med.drug;
                  const checked = orders.meds.has(key);
                  return (
                    <OrderRow key={key} checked={checked} onClick={() => toggle("meds", key)}
                      label={<span className="font-semibold text-white">{med.drug}</span>}
                      detail={
                        <span className="text-slate-400">
                          {med.dose} • {med.frequency} • {med.route} • {med.duration}
                          {med.notes && <span className={cn("ml-1", med.notes.includes("⚠️") ? "text-rose-400 font-bold" : "text-slate-500")}> — {med.notes}</span>}
                        </span>
                      }
                    />
                  );
                })}
              </OrderSection>

              {/* ── Lab Tests ── */}
              {dx.labTests.length > 0 && (
                <OrderSection
                  icon={<FlaskConical className="w-4 h-4 text-cyan-400" />}
                  label="Laboratory Tests"
                  badge={`${orders.labs.size}/${dx.labTests.length}`}
                  count={orders.labs.size}
                  isOpen={expandSection === "labs"}
                  onToggle={() => setExpandSection(expandSection === "labs" ? null : "labs")}
                >
                  {dx.labTests.map((lab: any) => {
                    const checked = orders.labs.has(lab.name);
                    return (
                      <OrderRow key={lab.name} checked={checked} onClick={() => toggle("labs", lab.name)}
                        label={<span className="font-semibold text-white">{lab.name}</span>}
                        detail={
                          <div className="flex items-center gap-2">
                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border",
                              lab.urgency === "stat" ? "bg-rose-500/15 text-rose-400 border-rose-500/20" :
                              lab.urgency === "urgent" ? "bg-amber-500/15 text-amber-400 border-amber-500/20" :
                              "bg-slate-500/15 text-slate-400 border-slate-500/20"
                            )}>
                              {lab.urgency.toUpperCase()}
                            </span>
                            <span className="text-slate-500 text-xs">{lab.reason}</span>
                          </div>
                        }
                      />
                    );
                  })}
                </OrderSection>
              )}

              {/* ── Imaging ── */}
              {dx.imaging.length > 0 && (
                <OrderSection
                  icon={<Scan className="w-4 h-4 text-violet-400" />}
                  label="Investigations & Imaging"
                  badge={`${orders.imaging.size}/${dx.imaging.length}`}
                  count={orders.imaging.size}
                  isOpen={expandSection === "imaging"}
                  onToggle={() => setExpandSection(expandSection === "imaging" ? null : "imaging")}
                >
                  {dx.imaging.map((img: any) => {
                    const key = `${img.type} — ${img.region}`;
                    const checked = orders.imaging.has(key);
                    return (
                      <OrderRow key={key} checked={checked} onClick={() => toggle("imaging", key)}
                        label={
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 font-bold">{img.type}</span>
                            <span className="font-semibold text-white">{img.region}</span>
                          </div>
                        }
                        detail={
                          <div className="flex items-center gap-2">
                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border",
                              img.urgency === "stat" ? "bg-rose-500/15 text-rose-400 border-rose-500/20" :
                              img.urgency === "urgent" ? "bg-amber-500/15 text-amber-400 border-amber-500/20" :
                              "bg-slate-500/15 text-slate-400 border-slate-500/20"
                            )}>
                              {img.urgency.toUpperCase()}
                            </span>
                            <span className="text-slate-500 text-xs">{img.reason}</span>
                          </div>
                        }
                      />
                    );
                  })}
                </OrderSection>
              )}

              {/* ── Referrals ── */}
              {dx.referrals.length > 0 && (
                <OrderSection
                  icon={<Activity className="w-4 h-4 text-rose-400" />}
                  label="Referrals"
                  badge={`${orders.referrals.size}/${dx.referrals.length}`}
                  count={orders.referrals.size}
                  isOpen={expandSection === "referrals"}
                  onToggle={() => setExpandSection(expandSection === "referrals" ? null : "referrals")}
                >
                  {dx.referrals.map((ref: any) => {
                    const checked = orders.referrals.has(ref.specialty);
                    return (
                      <OrderRow key={ref.specialty} checked={checked} onClick={() => toggle("referrals", ref.specialty)}
                        label={<span className="font-semibold text-white">{ref.specialty}</span>}
                        detail={
                          <div className="flex items-center gap-2">
                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border",
                              ref.urgency === "emergency" ? "bg-rose-500/15 text-rose-400 border-rose-500/20" :
                              ref.urgency === "urgent" ? "bg-amber-500/15 text-amber-400 border-amber-500/20" :
                              "bg-slate-500/15 text-slate-400 border-slate-500/20"
                            )}>
                              {ref.urgency.toUpperCase()}
                            </span>
                            <span className="text-slate-500 text-xs">{ref.reason}</span>
                          </div>
                        }
                      />
                    );
                  })}
                </OrderSection>
              )}
            </div>

            {/* Footer — Generate Order */}
            {totalOrders > 0 && (
              <div className="p-4 flex items-center justify-between border-t border-white/5"
                style={{ background: "rgba(255,255,255,0.02)" }}>
                <span className="text-xs text-slate-400">
                  <span className="text-cyan-300 font-bold">{totalOrders}</span> order{totalOrders !== 1 ? "s" : ""} selected
                  {orders.meds.size > 0 && ` • ${orders.meds.size} Rx`}
                  {orders.labs.size > 0 && ` • ${orders.labs.size} Labs`}
                  {orders.imaging.size > 0 && ` • ${orders.imaging.size} Imaging`}
                  {orders.referrals.size > 0 && ` • ${orders.referrals.size} Referrals`}
                </span>
                <button
                  onClick={() => setShowOrders(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all"
                  style={{ background: "linear-gradient(135deg, #06b6d4, #8b5cf6)" }}
                >
                  <Printer className="w-4 h-4" />
                  Generate Order Sheet
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Order Sheet Modal ── */}
      <AnimatePresence>
        {showOrders && dx && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.8)" }}
            onClick={() => setShowOrders(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl"
              style={{ background: "#0a0f1e", border: "1px solid rgba(6,182,212,0.2)" }}
              onClick={e => e.stopPropagation()}
            >
              {/* Order sheet header */}
              <div className="p-6 border-b border-white/10"
                style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.1), rgba(139,92,246,0.1))" }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs text-slate-400 uppercase tracking-wider">Clinical Order Sheet</span>
                    </div>
                    <h3 className="text-xl font-black text-white">{dx.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} •
                      Generated by Metta AI
                    </p>
                  </div>
                  <button onClick={() => setShowOrders(false)}
                    className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-[10px] text-slate-500">Active Symptoms:</span>
                  {symptoms.slice(0, 8).map(s => (
                    <span key={s} className="text-[10px] px-1.5 py-px rounded bg-white/5 text-slate-400">{s}</span>
                  ))}
                </div>
              </div>

              <div className="p-6 space-y-5">
                {/* Medications */}
                {orders.meds.size > 0 && (
                  <OrderSheetSection icon={<Pill className="w-4 h-4 text-amber-400" />} title="Prescription (Rx)">
                    {dx.medications.filter((m: any) => orders.meds.has(m.drug)).map((med: any, i: number) => (
                      <div key={med.drug} className="flex gap-3 p-3 rounded-lg"
                        style={{ background: "rgba(255,255,255,0.03)" }}>
                        <span className="text-xs text-slate-600 w-5">{i + 1}.</span>
                        <div>
                          <p className="text-sm font-bold text-white">{med.drug}</p>
                          <p className="text-xs text-slate-400">{med.dose} — {med.frequency} — {med.route} — {med.duration}</p>
                          {med.notes && <p className={cn("text-xs mt-0.5", med.notes.includes("⚠️") ? "text-rose-400 font-semibold" : "text-slate-500")}>{med.notes}</p>}
                        </div>
                      </div>
                    ))}
                  </OrderSheetSection>
                )}

                {/* Lab tests */}
                {orders.labs.size > 0 && (
                  <OrderSheetSection icon={<FlaskConical className="w-4 h-4 text-cyan-400" />} title="Laboratory Investigations">
                    {dx.labTests.filter((l: any) => orders.labs.has(l.name)).map((lab: any, i: number) => (
                      <div key={lab.name} className="flex items-start gap-3 p-3 rounded-lg"
                        style={{ background: "rgba(255,255,255,0.03)" }}>
                        <span className="text-xs text-slate-600 w-5">{i + 1}.</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-white">{lab.name}</p>
                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-bold",
                              lab.urgency === "stat" ? "text-rose-400 bg-rose-500/10" :
                              lab.urgency === "urgent" ? "text-amber-400 bg-amber-500/10" : "text-slate-400 bg-white/5"
                            )}>
                              {lab.urgency.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">{lab.reason}</p>
                        </div>
                      </div>
                    ))}
                  </OrderSheetSection>
                )}

                {/* Imaging */}
                {orders.imaging.size > 0 && (
                  <OrderSheetSection icon={<Scan className="w-4 h-4 text-violet-400" />} title="Imaging & Investigations">
                    {dx.imaging.filter((im: any) => orders.imaging.has(`${im.type} — ${im.region}`)).map((img: any, i: number) => (
                      <div key={`${img.type}-${img.region}`} className="flex items-start gap-3 p-3 rounded-lg"
                        style={{ background: "rgba(255,255,255,0.03)" }}>
                        <span className="text-xs text-slate-600 w-5">{i + 1}.</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 font-bold">{img.type}</span>
                            <span className="text-sm font-bold text-white">{img.region}</span>
                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-bold",
                              img.urgency === "stat" ? "text-rose-400 bg-rose-500/10" :
                              img.urgency === "urgent" ? "text-amber-400 bg-amber-500/10" : "text-slate-400 bg-white/5"
                            )}>
                              {img.urgency.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{img.reason}</p>
                        </div>
                      </div>
                    ))}
                  </OrderSheetSection>
                )}

                {/* Referrals */}
                {orders.referrals.size > 0 && (
                  <OrderSheetSection icon={<Activity className="w-4 h-4 text-rose-400" />} title="Referrals">
                    {dx.referrals.filter((r: any) => orders.referrals.has(r.specialty)).map((ref: any, i: number) => (
                      <div key={ref.specialty} className="flex items-start gap-3 p-3 rounded-lg"
                        style={{ background: "rgba(255,255,255,0.03)" }}>
                        <span className="text-xs text-slate-600 w-5">{i + 1}.</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-white">{ref.specialty}</p>
                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-bold",
                              ref.urgency === "emergency" ? "text-rose-400 bg-rose-500/10" :
                              ref.urgency === "urgent" ? "text-amber-400 bg-amber-500/10" : "text-slate-400 bg-white/5"
                            )}>
                              {ref.urgency.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">{ref.reason}</p>
                        </div>
                      </div>
                    ))}
                  </OrderSheetSection>
                )}

                {/* Notes */}
                <div className="p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs text-slate-500 uppercase tracking-wider">Clinical Notes</span>
                  </div>
                  <p className="text-xs text-slate-400">{dx.notes}</p>
                </div>

                <p className="text-[10px] text-slate-600 text-center">
                  ⚠️ This is an AI-generated clinical decision aid. Final orders must be reviewed and approved by the treating physician. Not a substitute for clinical judgment.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function OrderSection({ icon, label, badge, count, isOpen, onToggle, children }: {
  icon: React.ReactNode; label: string; badge: string; count: number;
  isOpen: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div>
      <button onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/[0.03] transition-all">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold text-slate-200">{label}</span>
          {count > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold">{count} selected</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-600">{badge}</span>
          {isOpen ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
        </div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden px-4 pb-3 space-y-1.5"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function OrderRow({ checked, onClick, label, detail }: {
  checked: boolean; onClick: () => void;
  label: React.ReactNode; detail: React.ReactNode;
}) {
  return (
    <button onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all duration-150",
        checked ? "bg-cyan-500/8 border-cyan-500/25" : "bg-white/[0.025] border-white/[0.05] hover:bg-white/[0.05]"
      )}>
      {checked
        ? <CheckSquare className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
        : <Square className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />
      }
      <div className="flex-1 min-w-0">
        <div className="text-sm">{label}</div>
        <div className="text-xs mt-0.5">{detail}</div>
      </div>
    </button>
  );
}

function OrderSheetSection({ icon, title, children }: {
  icon: React.ReactNode; title: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider">{title}</h4>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
