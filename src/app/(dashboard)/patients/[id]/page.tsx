"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { usePatient } from "@/hooks/usePatients";
import { formatDate, formatAge, formatName, formatPhone, initials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Edit, Calendar, Phone, Mail, MapPin, User, Heart, Shield,
  FileText, Activity, Loader2, AlertCircle, Printer, Stethoscope,
  Pill, FlaskConical, TrendingUp, TrendingDown, Minus, ClipboardList,
  CheckCircle, Clock, XCircle, AlertTriangle, Sparkles, ChevronRight,
  Download, Plus, Eye, UploadCloud, BrainCircuit, Waves,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Mock clinical data ───────────────────────────────────────────────────────
const MOCK_VITALS = [
  { date: "Today 09:15",   bp: "128/82", hr: 74,  rr: 16, temp: "98.6°F", spo2: "98%", weight: "185 lbs", bmi: "26.8" },
  { date: "Jan 15, 2024",  bp: "132/85", hr: 78,  rr: 18, temp: "98.4°F", spo2: "97%", weight: "187 lbs", bmi: "27.1" },
  { date: "Dec 10, 2023",  bp: "125/80", hr: 72,  rr: 16, temp: "98.7°F", spo2: "99%", weight: "183 lbs", bmi: "26.5" },
  { date: "Nov 05, 2023",  bp: "138/90", hr: 82,  rr: 17, temp: "99.1°F", spo2: "96%", weight: "189 lbs", bmi: "27.4" },
];

const MOCK_LABS = [
  { date: "Today",        name: "Complete Blood Count",   result: "WBC 7.2, RBC 4.8, Hgb 14.2", status: "normal",    orderedBy: "Dr. Smith" },
  { date: "Today",        name: "HbA1c",                  result: "7.2%",                       status: "abnormal",  orderedBy: "Dr. Smith" },
  { date: "Jan 15",       name: "Lipid Panel",             result: "LDL 142 mg/dL",              status: "high",      orderedBy: "Dr. Smith" },
  { date: "Jan 15",       name: "Comprehensive Metabolic", result: "BMP within normal limits",   status: "normal",    orderedBy: "Dr. Johnson" },
  { date: "Dec 10",       name: "TSH",                    result: "2.1 mIU/L",                  status: "normal",    orderedBy: "Dr. Smith" },
  { date: "Nov 05",       name: "Urinalysis",              result: "Trace protein, no blood",    status: "abnormal",  orderedBy: "Dr. Smith" },
];

const MOCK_MEDICATIONS = [
  { name: "Lisinopril",   dose: "10mg",   frequency: "Once daily",  route: "Oral", status: "active",  prescribedBy: "Dr. Smith",   indication: "Hypertension",    refills: 3 },
  { name: "Metformin",    dose: "500mg",  frequency: "Twice daily",  route: "Oral", status: "active",  prescribedBy: "Dr. Smith",   indication: "Type 2 Diabetes", refills: 2 },
  { name: "Atorvastatin", dose: "40mg",   frequency: "Once at night",route: "Oral", status: "active",  prescribedBy: "Dr. Smith",   indication: "Hyperlipidemia",  refills: 5 },
  { name: "Amoxicillin",  dose: "500mg",  frequency: "Three times/day",route:"Oral",status:"completed",prescribedBy: "Dr. Johnson",indication: "Sinusitis",        refills: 0 },
];

const MOCK_PROBLEMS = [
  { code: "I10",    name: "Essential Hypertension",    onset: "2018",  status: "active",   severity: "moderate" },
  { code: "E11.9",  name: "Type 2 Diabetes Mellitus",  onset: "2020",  status: "active",   severity: "moderate" },
  { code: "E78.5",  name: "Hyperlipidemia",             onset: "2019",  status: "active",   severity: "mild" },
  { code: "Z87.891",name: "Ex-Smoker",                  onset: "2015",  status: "resolved", severity: "" },
];

const MOCK_ALLERGIES = [
  { allergen: "Penicillin",    reaction: "Hives, Anaphylaxis",   severity: "severe",   type: "Drug" },
  { allergen: "Sulfa drugs",   reaction: "Rash",                 severity: "moderate", type: "Drug" },
  { allergen: "Peanuts",       reaction: "Anaphylaxis",          severity: "severe",   type: "Food" },
  { allergen: "Latex",         reaction: "Contact dermatitis",   severity: "mild",     type: "Environmental" },
];

const MOCK_ENCOUNTERS = [
  { date: "Today",       type: "Office Visit",    provider: "Dr. Smith",   reason: "Annual Physical",     status: "in-progress", note: "SOAP note in progress" },
  { date: "Jan 15",      type: "Follow-up",       provider: "Dr. Smith",   reason: "Diabetes management", status: "completed",   note: "HbA1c reviewed, dose unchanged" },
  { date: "Dec 10",      type: "Telehealth",      provider: "Dr. Johnson", reason: "Sinusitis",           status: "completed",   note: "Rx Amoxicillin 500mg x 10 days" },
  { date: "Nov 05",      type: "Urgent Care",     provider: "Dr. Smith",   reason: "Chest pain workup",   status: "completed",   note: "EKG normal, costochondritis" },
  { date: "Sep 20",      type: "Lab Review",      provider: "Dr. Smith",   reason: "Lipid panel review",  status: "completed",   note: "Started Atorvastatin" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function VitalBadge({ value, normal }: { value: string; normal: boolean }) {
  return (
    <span className={cn("text-sm font-semibold", normal ? "text-slate-800" : "text-rose-600")}>
      {value}
    </span>
  );
}

function LabStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    normal:   "bg-emerald-50 text-emerald-700 border-emerald-200",
    abnormal: "bg-amber-50 text-amber-700 border-amber-200",
    high:     "bg-rose-50 text-rose-700 border-rose-200",
    critical: "bg-red-100 text-red-800 border-red-300",
  };
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border", map[status] ?? map.normal)}>
      {status}
    </span>
  );
}

export default function PatientDetailPage() {
  const params = useParams();
  const patientId = params.id as string;
  const [activeTab, setActiveTab] = useState("overview");

  // Vision AI Document Upload States
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingDoc, setIsProcessingDoc] = useState(false);
  const [docProcessed, setDocProcessed] = useState(false);

  const { data, isLoading, error } = usePatient(patientId);

  // Use mock patient if API not available
  const patient = data?.data ?? {
    firstName: "John", lastName: "Smith", middleName: "",
    mrn: `P-2024-${String(patientId).padStart(3, "0")}`,
    status: "ACTIVE", gender: "Male", dateOfBirth: "1979-04-12",
    preferredName: "John", maritalStatus: "Married", race: "Caucasian",
    ethnicity: "Non-Hispanic", preferredLanguage: "English", birthSex: "Male",
    ssn: "123456789", photoUrl: "",
    addresses: [{ id:"a1", isPrimary:true, line1:"123 Main St", line2:"", city:"Boston", state:"MA", postalCode:"02101", use:"Home" }],
    telecoms: [
      { id:"t1", system:"PHONE", value:"6175551234", use:"Mobile", isPrimary:true },
      { id:"t2", system:"EMAIL", value:"john.smith@email.com", use:"Personal", isPrimary:true },
    ],
    insurancePolicies: [{ id:"i1", payerName:"Blue Cross Blue Shield", policyNumber:"BCB2024001", groupNumber:"GRP001", planName:"PPO Gold", planType:"PPO", subscriberName:"John Smith", subscriberRelationship:"Self", isPrimary:true, isActive:true }],
    emergencyContacts: [{ id:"e1", name:"Jane Smith", relationship:"Spouse", phone:"6175555678", isPrimary:true }],
    primaryPhysician: { firstName:"Robert", lastName:"Smith" },
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
        <span className="ml-2 text-slate-500">Loading patient chart...</span>
      </div>
    );
  }

  const primaryAddress    = patient.addresses?.find((a: any) => a.isPrimary) || patient.addresses?.[0];
  const primaryPhone      = patient.telecoms?.find((t: any) => t.system === "PHONE" && t.isPrimary)?.value;
  const primaryEmail      = patient.telecoms?.find((t: any) => t.system === "EMAIL")?.value;
  const primaryInsurance  = patient.insurancePolicies?.find((i: any) => i.isPrimary);
  const primaryEmergency  = patient.emergencyContacts?.find((c: any) => c.isPrimary);

  return (
    <div className="space-y-4">
      {/* ── Patient Header ──────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Link href="/patients">
              <Button variant="ghost" size="icon" className="rounded-xl">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <Avatar className="h-16 w-16 ring-2 ring-cyan-200">
              <AvatarImage src={patient.photoUrl} />
              <AvatarFallback className="text-lg bg-gradient-to-br from-cyan-500 to-purple-500 text-white font-bold">
                {patient.firstName?.[0]}{patient.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {formatName(patient.firstName, patient.lastName, patient.middleName)}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <code className="text-xs bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-mono">{patient.mrn}</code>
                <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold",
                  patient.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600")}>
                  {patient.status}
                </span>
                <span className="text-sm text-slate-500">{patient.gender} • {formatAge ? formatAge(patient.dateOfBirth) : "45"} yrs • DOB: {patient.dateOfBirth}</span>
              </div>
              <div className="flex gap-2 mt-2">
                {MOCK_ALLERGIES.filter(a => a.severity === "severe").map(a => (
                  <span key={a.allergen} className="flex items-center gap-1 px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-full font-medium">
                    <AlertTriangle className="w-3 h-3" /> ⚠ Allergy: {a.allergen}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="rounded-xl">
              <Printer className="mr-2 h-4 w-4" /> Print Chart
            </Button>
            <Link href="/schedule">
              <Button variant="outline" size="sm" className="rounded-xl">
                <Calendar className="mr-2 h-4 w-4" /> Schedule
              </Button>
            </Link>
            <Link href="/prescribe">
              <Button variant="outline" size="sm" className="rounded-xl">
                <Pill className="mr-2 h-4 w-4" /> Prescribe
              </Button>
            </Link>
            <Link href="/transcript">
              <Button size="sm" className="rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white border-0">
                <Sparkles className="mr-2 h-4 w-4" /> Start Encounter
              </Button>
            </Link>
          </div>
        </div>

        {/* Quick stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 pt-4 border-t border-slate-100">
          {[
            { label: "Last Visit",    value: "Today",           color: "text-cyan-600" },
            { label: "PCP",           value: `Dr. ${patient.primaryPhysician?.lastName || "Smith"}`, color: "text-slate-700" },
            { label: "Insurance",     value: primaryInsurance?.planType || "PPO",  color: "text-slate-700" },
            { label: "Active Meds",   value: `${MOCK_MEDICATIONS.filter(m=>m.status==="active").length} meds`, color: "text-amber-600" },
            { label: "Open Problems", value: `${MOCK_PROBLEMS.filter(p=>p.status==="active").length} active`, color: "text-rose-600" },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className={cn("text-sm font-bold", s.color)}>{s.value}</p>
              <p className="text-xs text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Chart Tabs ──────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <TabsList className="w-full grid grid-cols-4 md:grid-cols-8 bg-slate-50 rounded-t-2xl rounded-b-none h-auto p-1 gap-1">
            {[
              { value: "overview",     label: "Overview",     icon: User },
              { value: "vitals",       label: "Vitals",       icon: Activity },
              { value: "problems",     label: "Problems",     icon: ClipboardList },
              { value: "documents",    label: "Documents",    icon: FileText },
              { value: "medications",  label: "Medications",  icon: Pill },
              { value: "labs",         label: "Labs",         icon: FlaskConical },
              { value: "encounters",   label: "Encounters",   icon: Stethoscope },
              { value: "allergies",    label: "Allergies",    icon: AlertTriangle },
            ].map(tab => (
              <TabsTrigger key={tab.value} value={tab.value}
                className="flex items-center justify-center gap-1.5 py-2 px-1 text-xs font-medium rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-cyan-600">
                <tab.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="p-5">

            {/* ── OVERVIEW (EPIC 5: PREDICTIVE DIGITAL TWIN) ── */}
            <TabsContent value="overview" className="mt-0">
              {/* Epic 5 Predictive Digital Twin Matrix */}
              <div className="mb-6 rounded-2xl bg-slate-900 border border-slate-800 p-1 relative overflow-hidden shadow-2xl">
                {/* Background animations */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-fuchsia-500/10 rounded-full blur-3xl -ml-20 -mb-20"></div>
                
                <div className="relative bg-slate-950/50 backdrop-blur-xl rounded-[15px] p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-gradient-to-br from-cyan-500 to-fuchsia-500 rounded-xl">
                      <BrainCircuit className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold tracking-wide">Temporal Health Matrix Forecast</h3>
                      <p className="text-slate-400 text-xs mt-0.5">Powered by Metta AI • 12,000+ data points analyzed</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">10-Year ASCVD Risk</p>
                      <div className="flex items-end gap-3">
                        <span className="text-4xl font-black text-rose-500">18.4<span className="text-2xl">%</span></span>
                        <Badge className="bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold mb-1">ELEVATED</Badge>
                      </div>
                      <div className="mt-4 h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500 w-[70%]"></div>
                      </div>
                      <p className="text-slate-500 text-xs mt-3 mt-2 leading-relaxed">Trajectory mapped from rising HbA1c and Lipids over 24 months.</p>
                    </div>

                    <div className="md:col-span-2 bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">AI Intervention Recommendations</p>
                      <ul className="space-y-3">
                        <li className="flex items-start gap-3">
                          <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5" />
                          <div>
                            <p className="text-slate-200 text-sm font-medium">Initiate High-Intensity Statin Therapy</p>
                            <p className="text-slate-500 text-xs mt-0.5">Reduces calculated 10-year risk to 11.2%</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5" />
                          <div>
                            <p className="text-slate-200 text-sm font-medium">Schedule Cardiology Baseline Echo</p>
                            <p className="text-slate-500 text-xs mt-0.5">Patient turning 45 y.o with 2 concurrent risk flags</p>
                          </div>
                        </li>
                      </ul>
                      <Button size="sm" className="mt-4 w-full bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 border-0 text-white shadow-lg">
                        <Sparkles className="w-3 h-3 mr-2" /> One-Click Apply Interventions
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid lg:grid-cols-3 gap-4">
                <Card className="border-slate-200">
                  <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-slate-700">Contact</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {primaryPhone && <div className="flex items-center gap-2 text-slate-600"><Phone className="h-4 w-4 text-slate-400" />{formatPhone ? formatPhone(primaryPhone) : primaryPhone}</div>}
                    {primaryEmail && <div className="flex items-center gap-2 text-slate-600"><Mail className="h-4 w-4 text-slate-400" />{primaryEmail}</div>}
                    {primaryAddress && <div className="flex items-start gap-2 text-slate-600"><MapPin className="h-4 w-4 text-slate-400 mt-0.5" /><span>{primaryAddress.line1}, {primaryAddress.city}, {primaryAddress.state}</span></div>}
                  </CardContent>
                </Card>
                <Card className="border-slate-200">
                  <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-slate-700">Care Team</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500">PCP</span><span className="font-medium">Dr. {patient.primaryPhysician?.lastName || "Smith"}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Insurance</span><span className="font-medium">{primaryInsurance?.payerName || "BCBS"}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Emergency</span><span className="font-medium">{primaryEmergency?.name || "Jane Smith"}</span></div>
                  </CardContent>
                </Card>
                <Card className="border-slate-200">
                  <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-slate-700">Latest Vitals</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {[{l:"BP",v:"128/82",ok:true},{l:"HR",v:"74 bpm",ok:true},{l:"SpO₂",v:"98%",ok:true},{l:"Temp",v:"98.6°F",ok:true}].map(v=>(
                      <div key={v.l} className="flex justify-between">
                        <span className="text-slate-500">{v.l}</span>
                        <VitalBadge value={v.v} normal={v.ok} />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Recent encounters */}
              <div className="mt-4">
                <h3 className="font-semibold text-slate-700 mb-3">Recent Encounters</h3>
                <div className="space-y-2">
                  {MOCK_ENCOUNTERS.slice(0,3).map((enc,i)=>(
                    <div key={i} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-cyan-200 transition-colors">
                      <div className="w-9 h-9 rounded-xl bg-cyan-100 flex items-center justify-center flex-shrink-0">
                        <Stethoscope className="w-4 h-4 text-cyan-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-slate-800">{enc.type}</span>
                          <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium",
                            enc.status==="completed" ? "bg-emerald-50 text-emerald-700" :
                            enc.status==="in-progress" ? "bg-cyan-50 text-cyan-700" : "bg-slate-100 text-slate-600")}>
                            {enc.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{enc.reason} · {enc.provider}</p>
                      </div>
                      <span className="text-xs text-slate-400">{enc.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* ── VITALS ── */}
            <TabsContent value="vitals" className="mt-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-700">Vital Signs History</h3>
                <Button size="sm" className="rounded-xl bg-cyan-500 text-white">
                  <Plus className="w-4 h-4 mr-1" /> Record Vitals
                </Button>
              </div>
              {/* Trend cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {[
                  { label:"Blood Pressure", value:"128/82", unit:"mmHg", trend:"down", delta:"-4 pts", color:"cyan" },
                  { label:"Heart Rate",     value:"74",     unit:"bpm",  trend:"stable",delta:"→",    color:"violet" },
                  { label:"SpO₂",           value:"98",     unit:"%",    trend:"up",   delta:"+1%",  color:"emerald" },
                  { label:"Weight",         value:"185",    unit:"lbs",  trend:"down", delta:"-2 lbs",color:"amber" },
                ].map(v=>(
                  <div key={v.label} className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-xs text-slate-500 mb-1">{v.label}</p>
                    <div className="flex items-end gap-1">
                      <span className="text-2xl font-bold text-slate-800">{v.value}</span>
                      <span className="text-sm text-slate-400 mb-0.5">{v.unit}</span>
                    </div>
                    <div className={cn("flex items-center gap-1 text-xs mt-1 font-medium",
                      v.trend==="up" ? "text-emerald-600" : v.trend==="down" ? "text-rose-500" : "text-slate-500")}>
                      {v.trend==="up" ? <TrendingUp className="w-3 h-3"/> : v.trend==="down" ? <TrendingDown className="w-3 h-3"/> : <Minus className="w-3 h-3"/>}
                      {v.delta}
                    </div>
                  </div>
                ))}
              </div>
              {/* Vitals table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>{["Date","BP","HR","RR","Temp","SpO₂","Weight","BMI"].map(h=>(
                      <th key={h} className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {MOCK_VITALS.map((v,i)=>(
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{v.date}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{v.bp}</td>
                        <td className="px-4 py-3 text-slate-700">{v.hr}</td>
                        <td className="px-4 py-3 text-slate-700">{v.rr}</td>
                        <td className="px-4 py-3 text-slate-700">{v.temp}</td>
                        <td className="px-4 py-3 text-slate-700">{v.spo2}</td>
                        <td className="px-4 py-3 text-slate-700">{v.weight}</td>
                        <td className="px-4 py-3 text-slate-700">{v.bmi}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* ── PROBLEMS ── */}
            <TabsContent value="problems" className="mt-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-700">Problem List</h3>
                <Button size="sm" className="rounded-xl bg-cyan-500 text-white"><Plus className="w-4 h-4 mr-1"/>Add Problem</Button>
              </div>
              <div className="space-y-2">
                {MOCK_PROBLEMS.map((p,i)=>(
                  <div key={i} className={cn("flex items-center gap-4 p-4 rounded-xl border transition-colors",
                    p.status==="active" ? "border-slate-200 hover:border-cyan-200 bg-white" : "border-slate-100 bg-slate-50/50")}>
                    <code className="text-xs bg-slate-100 border border-slate-200 px-2 py-1 rounded font-mono text-slate-600 min-w-[72px] text-center">{p.code}</code>
                    <div className="flex-1">
                      <p className={cn("font-medium text-sm", p.status==="resolved" ? "text-slate-400 line-through" : "text-slate-800")}>{p.name}</p>
                      <p className="text-xs text-slate-400">Onset: {p.onset}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.severity && <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border",
                        p.severity==="severe"?"bg-rose-50 text-rose-700 border-rose-200":
                        p.severity==="moderate"?"bg-amber-50 text-amber-700 border-amber-200":
                        "bg-blue-50 text-blue-700 border-blue-200")}>{p.severity}</span>}
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold",
                        p.status==="active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                        {p.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* ── MEDICATIONS ── */}
            <TabsContent value="medications" className="mt-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-700">Medication List</h3>
                <Link href="/prescribe"><Button size="sm" className="rounded-xl bg-cyan-500 text-white"><Plus className="w-4 h-4 mr-1"/>New Rx</Button></Link>
              </div>
              <div className="space-y-2">
                {MOCK_MEDICATIONS.map((med,i)=>(
                  <div key={i} className={cn("flex items-center gap-4 p-4 rounded-xl border",
                    med.status==="active" ? "border-slate-200 bg-white hover:border-cyan-200" : "border-slate-100 bg-slate-50/50")}>
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                      med.status==="active" ? "bg-violet-100" : "bg-slate-100")}>
                      <Pill className={cn("w-5 h-5", med.status==="active" ? "text-violet-600" : "text-slate-400")} />
                    </div>
                    <div className="flex-1">
                      <p className={cn("font-semibold text-sm", med.status==="completed" && "text-slate-400 line-through")}>
                        {med.name} {med.dose}
                      </p>
                      <p className="text-xs text-slate-500">{med.frequency} · {med.route} · <span className="italic">{med.indication}</span></p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">{med.prescribedBy}</p>
                      <p className="text-xs text-slate-400">{med.refills} refills remaining</p>
                    </div>
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold",
                      med.status==="active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                      {med.status}
                    </span>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* ── LABS ── */}
            <TabsContent value="labs" className="mt-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-700">Lab Results</h3>
                <Button size="sm" className="rounded-xl bg-cyan-500 text-white"><Plus className="w-4 h-4 mr-1"/>Order Lab</Button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>{["Date","Test","Result","Status","Ordered By","Action"].map(h=>(
                      <th key={h} className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {MOCK_LABS.map((lab,i)=>(
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">{lab.date}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{lab.name}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">{lab.result}</td>
                        <td className="px-4 py-3"><LabStatusBadge status={lab.status}/></td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{lab.orderedBy}</td>
                        <td className="px-4 py-3">
                          <Button size="sm" variant="ghost" className="h-7 text-xs rounded-lg text-cyan-600 hover:bg-cyan-50">
                            <Eye className="w-3 h-3 mr-1"/>View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* ── ENCOUNTERS ── */}
            <TabsContent value="encounters" className="mt-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-700">Encounter History</h3>
                <Link href="/transcript">
                  <Button size="sm" className="rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white">
                    <Sparkles className="w-4 h-4 mr-1"/>New Encounter
                  </Button>
                </Link>
              </div>
              <div className="space-y-3">
                {MOCK_ENCOUNTERS.map((enc,i)=>(
                  <div key={i} className="flex items-start gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:border-cyan-200 transition-colors">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5",
                      enc.status==="in-progress" ? "bg-cyan-100" : "bg-slate-100")}>
                      <Stethoscope className={cn("w-5 h-5", enc.status==="in-progress" ? "text-cyan-600" : "text-slate-500")} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-800 text-sm">{enc.type}</span>
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium",
                          enc.status==="completed"   ? "bg-emerald-50 text-emerald-700" :
                          enc.status==="in-progress" ? "bg-cyan-50 text-cyan-700" :
                                                      "bg-slate-100 text-slate-600")}>
                          {enc.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mt-0.5">{enc.reason}</p>
                      <p className="text-xs text-slate-400 mt-1">{enc.note}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-medium text-slate-600">{enc.provider}</p>
                      <p className="text-xs text-slate-400">{enc.date}</p>
                      {enc.status==="completed" && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs rounded-lg text-cyan-600 hover:bg-cyan-50 mt-1">
                          <Eye className="w-3 h-3 mr-1"/>Note
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* ── ALLERGIES ── */}
            <TabsContent value="allergies" className="mt-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-700">Allergy & Adverse Reaction List</h3>
                <Button size="sm" className="rounded-xl bg-cyan-500 text-white"><Plus className="w-4 h-4 mr-1"/>Add Allergy</Button>
              </div>
              <div className="space-y-2">
                {MOCK_ALLERGIES.map((a,i)=>(
                  <div key={i} className={cn("flex items-center gap-4 p-4 rounded-xl border",
                    a.severity==="severe" ? "border-rose-200 bg-rose-50/50" :
                    a.severity==="moderate" ? "border-amber-200 bg-amber-50/30" :
                    "border-slate-200 bg-white")}>
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
                      a.severity==="severe" ? "bg-rose-100" : a.severity==="moderate" ? "bg-amber-100" : "bg-slate-100")}>
                      <AlertTriangle className={cn("w-4 h-4",
                        a.severity==="severe" ? "text-rose-600" : a.severity==="moderate" ? "text-amber-600" : "text-slate-400")} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-slate-800">{a.allergen}</p>
                      <p className="text-xs text-slate-500">Reaction: {a.reaction}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 border border-slate-200">{a.type}</span>
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold border",
                        a.severity==="severe" ? "bg-rose-100 text-rose-700 border-rose-200" :
                        a.severity==="moderate" ? "bg-amber-100 text-amber-700 border-amber-200" :
                        "bg-blue-50 text-blue-700 border-blue-200")}>
                        {a.severity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* ── INSURANCE ── */}
            <TabsContent value="insurance" className="mt-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-700">Insurance Coverage</h3>
                <Button size="sm" className="rounded-xl bg-cyan-500 text-white"><Plus className="w-4 h-4 mr-1"/>Add Policy</Button>
              </div>
              {patient.insurancePolicies?.length ? (
                <div className="space-y-4">
                  {patient.insurancePolicies.map((policy: any)=>(
                    <div key={policy.id} className="p-5 rounded-xl border border-slate-200 bg-white">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-slate-800">{policy.payerName}</h4>
                          <p className="text-xs text-slate-500">{policy.planName} · {policy.planType}</p>
                        </div>
                        <div className="flex gap-2">
                          {policy.isPrimary && <span className="px-2 py-0.5 bg-cyan-100 text-cyan-700 text-xs rounded-full font-semibold">Primary</span>}
                          <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold",
                            policy.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                            {policy.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        {[
                          ["Policy #",        policy.policyNumber],
                          ["Group #",         policy.groupNumber || "N/A"],
                          ["Subscriber",      policy.subscriberName],
                          ["Relationship",    policy.subscriberRelationship],
                        ].map(([k,v])=>(
                          <div key={k}><p className="text-xs text-slate-400">{k}</p><p className="font-medium text-slate-700">{v}</p></div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <Shield className="mx-auto h-12 w-12 mb-2 opacity-30" />
                  <p>No insurance on file</p>
                </div>
              )}
            </TabsContent>

            {/* ── DOCUMENTS (EPIC 4: VISION AI OCR) ── */}
            <TabsContent value="documents" className="mt-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-700">Intelligent Document Pipeline</h3>
                  <p className="text-slate-500 text-xs">Upload unstructured PDFs. Vision AI extracts biomarkers automatically.</p>
                </div>
                <Button size="sm" className="rounded-xl bg-cyan-500 text-white"><Plus className="w-4 h-4 mr-1"/>Upload</Button>
              </div>

              {/* Drag and Drop Zone */}
              <div 
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  setIsProcessingDoc(true);
                  setTimeout(() => {
                    setIsProcessingDoc(false);
                    setDocProcessed(true);
                  }, 4000);
                }}
                className={cn(
                  "border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer relative overflow-hidden",
                  isDragging ? "border-cyan-500 bg-cyan-50/50" : "border-slate-200 hover:border-cyan-300 bg-slate-50"
                )}
              >
                {isProcessingDoc ? (
                  <div className="flex flex-col items-center py-6">
                    <div className="w-16 h-16 rounded-2xl bg-fuchsia-100 flex items-center justify-center mb-4 relative shadow-inner">
                       <Waves className="w-8 h-8 text-fuchsia-500 relative z-10" />
                       <div className="absolute inset-0 rounded-2xl border-4 border-fuchsia-500/20 border-t-fuchsia-500 animate-spin"></div>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">Vision AI Actively Reading Document...</h3>
                    <p className="text-slate-500 text-sm mt-1">Extracting FHIR elements and plotting biomarkers to registry.</p>
                    <div className="w-64 h-2 bg-slate-200 rounded-full mt-6 overflow-hidden">
                      <div className="w-full h-full bg-gradient-to-r from-cyan-400 to-fuchsia-500 animate-pulse"></div>
                    </div>
                  </div>
                ) : docProcessed ? (
                  <div className="flex flex-col items-center py-6 text-emerald-600">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mb-4 shadow-inner">
                       <CheckCircle className="w-8 h-8 text-emerald-500" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">15-Page Legacy Report Parsed!</h3>
                    <p className="text-emerald-600/80 text-sm mt-1">Successfully extracted 42 discrete lab values including historical HbA1c and Lipids.</p>
                    <Button onClick={() => setDocProcessed(false)} size="sm" variant="outline" className="mt-6 rounded-xl border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700">
                      View Parsed Data Table
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-6">
                    <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center mb-4 shadow-sm border border-slate-100">
                       <UploadCloud className="w-8 h-8 text-cyan-500" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">Drag & Drop Legacy Medical Records</h3>
                    <p className="text-slate-500 text-sm mt-1">Support for dense PDFs, unstructured notes, and lab photos.</p>
                    <div className="flex gap-2 mt-6">
                      <Badge variant="secondary" className="bg-slate-200/50 text-slate-600 font-medium">Max 50 pages</Badge>
                      <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 font-medium">Auto-OCR Enabled</Badge>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

          </div>
        </div>
      </Tabs>
    </div>
  );
}