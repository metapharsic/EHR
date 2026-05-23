"use server";
import { DIAGNOSIS_DB } from '../../prisma/data';
import prisma from './prisma';

// ─── Clinical Decision Support Engine ─────────────────────────────────────────
// Wide-range diagnosis database for General Physicians

export type Severity = "mild" | "moderate" | "severe" | "emergency";
export type System = "Respiratory" | "Cardiac" | "Gastrointestinal" | "Neurological" |
  "Musculoskeletal" | "Dermatological" | "ENT" | "Urological" | "Endocrine" |
  "Psychiatric" | "Infectious" | "Haematological" | "Gynaecological" | "Ophthalmological" | "General";

export interface LabTest {
  name: string;
  code: string;
  urgency: "routine" | "urgent" | "stat";
  reason: string;
}

export interface Imaging {
  type: "X-Ray" | "CT" | "MRI" | "USG" | "Echo" | "ECG" | "PFT" | "Endoscopy" | "Mammography" | "Bone Density";
  region: string;
  urgency: "routine" | "urgent" | "stat";
  reason: string;
}

export interface Medication {
  drug: string;
  dose: string;
  route: "Oral" | "IV" | "IM" | "Topical" | "Inhaled" | "Sublingual";
  frequency: string;
  duration: string;
  notes?: string;
}

export interface Referral {
  specialty: string;
  urgency: "routine" | "urgent" | "emergency";
  reason: string;
}

export interface Referral {
  specialty: string;
  urgency: "routine" | "urgent" | "emergency";
  reason: string;
}

// ─── Shared Clinical Dictionaries ─────────────────────────────────────────────
export const LOCAL_KEYWORDS: Record<string, string> = {
  // Hindi - Romanized Slang
  bukhar: "fever", bukhaar: "fever", bukar: "fever", "बुखार": "fever",
  "boo khar": "fever", "book har": "fever",
  khansi: "cough", khaansi: "cough", kaasi: "cough", "खांसी": "cough",
  zukam: "cold", jukam: "cold", jukaam: "cold", nazla: "cold", "जुकाम": "cold",
  sirdard: "headache", "sar dard": "headache", "sir dard": "headache", 
  sardard: "headache", "सिरदर्द": "headache",
  ulti: "vomiting", ultee: "vomiting", qay: "vomiting", "उल्टी": "vomiting",
  dast: "diarrhea", daast: "diarrhea", "pait kharab": "diarrhea", "दस्त": "diarrhea",
  dard: "pain", "दर्द": "pain",
  kamzori: "weakness", kamjori: "weakness", kamzoori: "weakness", "कमजोरी": "weakness",
  thakan: "fatigue", thakaan: "fatigue", thakawat: "fatigue", "थकान": "fatigue",
  chakkar: "dizziness", chakar: "dizziness", chakker: "dizziness", ghoomna: "dizziness", "चक्कर": "dizziness",
  sujan: "swelling", soojhan: "swelling", sooj: "swelling", "सूजन": "swelling",
  saans: "breathless", saas: "breathless", dam: "breathless", "सांस": "breathless",
  "seena dard": "chest pain", "seene mein dard": "chest pain", seena: "chest pain", "छाती": "chest pain",
  "pet dard": "stomach ache", "pait dard": "stomach ache", "pet mein dard": "stomach ache", "पेट": "stomach ache",
  "kamar dard": "back pain", "peeth dard": "back pain", "kamar": "back pain",
  "jod dard": "joint pain", "jodon mein dard": "joint pain", "jodon": "joint pain",
  "gale mein dard": "sore throat", "gala": "sore throat", "गले में दर्द": "sore throat",
  "loose motion": "diarrhea", "loose motions": "diarrhea",
  "jalan": "burning",
  "khoon": "bleeding", "khoon aana": "bleeding",
  "chot": "injury", "zakhm": "injury",
  "khasi": "cough",
  
  // Telugu - Romanized Slang
  jwaram: "fever", jwar: "fever", jvaram: "fever", "జ్వరం": "fever",
  daggu: "cough", dagu: "cough", "దగ్గు": "cough",
  jalubu: "cold", "జలుబు": "cold",
  thala: "headache", "tala noppi": "headache", "tala": "headache", "తల నొప్పి": "headache",
  vanthulu: "vomiting", vantulu: "vomiting", vanti: "vomiting", "వాంతులు": "vomiting",
  virechanalu: "diarrhea", "విరేచనాలు": "diarrhea",
  noppi: "pain", "నొప్పి": "pain", 
  neerasam: "weakness", "నీరసం": "weakness",
  ayasam: "breathless", "ఆయాసం": "breathless",
  gunde: "chest pain", "gunde noppi": "chest pain", "గుండె నొప్పి": "chest pain",
  "kadu noppi": "stomach ache", "kadupu noppi": "stomach ache", "కడుపు నొప్పి": "stomach ache",
  vapu: "swelling", "వాపు": "swelling",
  "tala thirugudu": "dizziness", "kallu tiragadam": "dizziness",
  "ganta noppi": "sore throat", "gontu noppi": "sore throat", "గొంతు నొప్పి": "sore throat",
  "vennu noppi": "back pain", "వెన్ను నొప్పి": "back pain",
  "mokal noppulu": "joint pain", "మోకాళ్ల నొప్పులు": "joint pain",
  "raktham": "bleeding", "rakthapravaham": "bleeding",
  "gaya": "injury", "gayaalu": "injury",
};


export interface Diagnosis {
  id: string;
  name: string;
  icd10: string;
  system: System;
  severity: Severity;
  symptoms: string[];          // symptom keywords that match
  redFlags: string[];          // alarm symptoms
  medications: Medication[];
  labTests: LabTest[];
  imaging: Imaging[];
  referrals: Referral[];
  notes: string;
  prevalence: "common" | "uncommon" | "rare";
}

// ─── Master Diagnosis Database (80+ conditions) ───────────────────────────────

// ─── Symptom → Diagnosis Scoring Engine ──────────────────────────────────────
export interface DiagnosisMatch {
  diagnosis: any; // Mapped from DB
  score: number;
  matchedSymptoms: string[];
  missedRedFlags: string[];
}

export async function getDifferentialDiagnosis(symptoms: string[]): Promise<DiagnosisMatch[]> {
  if (symptoms.length === 0) return [];
  const lowerSymptoms = symptoms.map(s => s.toLowerCase());
  
  let dbDiagnoses = [];
  try {
    dbDiagnoses = await prisma.clinicalDiagnosis.findMany({
      include: { medications: true, labTests: true, imaging: true, referrals: true }
    });
  } catch (err) {
    console.warn("DB Fallback triggered: returning empty or fetching from data.ts locally");
    dbDiagnoses = DIAGNOSIS_DB;
  }

  const results: DiagnosisMatch[] = dbDiagnoses.map((diag: any) => {
    const matched: string[] = [];
    const diagSymptoms = diag.symptoms || [];
    const diagRedFlags = diag.redFlags || [];

    for (const diagSymptom of diagSymptoms) {
      const ds = diagSymptom.toLowerCase();
      const isMatch = lowerSymptoms.some(us => us.includes(ds) || ds.includes(us));
      if (isMatch) matched.push(diagSymptom);
    }

    const score = diagSymptoms.length > 0
      ? Math.round((matched.length / diagSymptoms.length) * 100 *
          (diag.prevalence === "common" ? 1.2 : diag.prevalence === "uncommon" ? 0.9 : 0.7))
      : 0;

    const missedRedFlags = diagRedFlags.filter((rf: string) =>
      lowerSymptoms.some(us => us.includes(rf.toLowerCase()))
    );

    return { diagnosis: diag, score: Math.min(score, 100), matchedSymptoms: matched, missedRedFlags };
  });

  return results.filter(r => r.score > 10).sort((a, b) => b.score - a.score).slice(0, 10);
}

// ─── Centralized Symptom Parsing ─────────────────────────────────────────────
export async function parseSymptoms(text: string): Promise<string[]> {
  const lower = text.toLowerCase();
  const symptoms = new Set<string>();

  try {
     const dbDiagnoses = await prisma.clinicalDiagnosis.findMany({ select: { symptoms: true } });
     dbDiagnoses.forEach((d: any) => {
       (d.symptoms || []).forEach((s: string) => {
         if (lower.includes(s.toLowerCase())) symptoms.add(s.toLowerCase());
       });
     });
  } catch (err) {
     DIAGNOSIS_DB.forEach((d: any) => {
       d.symptoms.forEach((s: string) => {
         if (lower.includes(s.toLowerCase())) symptoms.add(s.toLowerCase());
       });
     });
  }

  Object.entries(LOCAL_KEYWORDS).forEach(([local, englishKey]) => {
    if (text.includes(local) || lower.includes(local.toLowerCase())) {
      symptoms.add(englishKey.toLowerCase());
    }
  });

  return Array.from(symptoms);
}

// ─── Metadata Lookup for UI ──────────────────────────────────────────────────
export const SYMPTOM_DATA: Record<string, { label: string; hi: string; te: string; severity: "low" | "medium" | "high"; system: string }> = {
  "fever": { label: "Fever", hi: "बुखार", te: "జ్వరం", severity: "medium", system: "General" },
  "cough": { label: "Cough", hi: "खांसी", te: "దగ్గు", severity: "low", system: "Respiratory" },
  "chest pain": { label: "Chest Pain", hi: "छाती में दर्द", te: "గుండె నొప్పి", severity: "high", system: "Cardiac" },
  "breathless": { label: "Breathless", hi: "सांस फूलना", te: "ఆయాసం", severity: "high", system: "Respiratory" },
  "headache": { label: "Headache", hi: "सिरदर्द", te: "తల నొప్పి", severity: "medium", system: "Neurological" },
  "vomiting": { label: "Vomiting", hi: "उल्टी", te: "వాంతులు", severity: "medium", system: "Gastrointestinal" },
  "diarrhea": { label: "Diarrhea", hi: "दस्त", te: "విరేచనాలు", severity: "medium", system: "Gastrointestinal" },
  "pain": { label: "Pain", hi: "दर्द", te: "నొప్పి", severity: "medium", system: "General" },
  "weakness": { label: "Weakness", hi: "कमजोरी", te: "నీరసం", severity: "low", system: "General" },
  "fatigue": { label: "Fatigue", hi: "थकान", te: "అలసట", severity: "low", system: "General" },
  "nausea": { label: "Nausea", hi: "जी मिचलाना", te: "వికారం", severity: "medium", system: "Gastrointestinal" },
  "dizziness": { label: "Dizziness", hi: "चक्कर", te: "కళ్ళు తిరగడం", severity: "medium", system: "Neurological" },
  "rash": { label: "Skin Rash", hi: "चकत्ते", te: "తద్దురు", severity: "medium", system: "Dermatological" },
  "swelling": { label: "Swelling", hi: "सूजन", te: "వాపు", severity: "medium", system: "General" },
  "sore throat": { label: "Sore Throat", hi: "गले में दर्द", te: "గొంతు నొప్పి", severity: "low", system: "ENT" },
  "stomach ache": { label: "Stomach Ache", hi: "पेट दर्द", te: "కడుపు నొప్పి", severity: "medium", system: "Gastrointestinal" },
  "back pain": { label: "Back Pain", hi: "पीठ दर्द", te: "వెన్ను నొప్పి", severity: "medium", system: "Musculoskeletal" },
  "polyuria": { label: "Frequent Urination", hi: "बार-बार पेशाब", te: "అధిక మూత్రవిసర్జన", severity: "medium", system: "Endocrine" },
  "blurred vision": { label: "Blurred Vision", hi: "धुंधली दृष्टि", te: "మసక చూపు", severity: "medium", system: "Ophthalmological" },
  "dysuria": { label: "Painful Urination", hi: "पेशाब में दर्द", te: "మూత్రవిసర్జనలో నొప్పి", severity: "medium", system: "Urological" },
};


