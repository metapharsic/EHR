const fs = require('fs');

const tsFile = fs.readFileSync('src/lib/clinicalEngine.ts', 'utf8');

const sIdx = tsFile.indexOf('export const DIAGNOSIS_DB: Diagnosis[] = [');
const eIdx = tsFile.indexOf('// ─── Symptom → Diagnosis Scoring Engine');

const dataTsContent = tsFile.substring(sIdx, eIdx);
const top = tsFile.substring(0, sIdx);
let bottom = tsFile.substring(eIdx);

fs.writeFileSync('prisma/data.ts', top + '\\n' + dataTsContent);

let seed = fs.readFileSync('prisma/seed_clinical.ts', 'utf8');
seed = seed.replace("import { DIAGNOSIS_DB } from '../src/lib/clinicalEngine';", "import { DIAGNOSIS_DB } from './data';");
fs.writeFileSync('prisma/seed_clinical.ts', seed);

const newEngine = top + \`
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

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
    const { DIAGNOSIS_DB } = require('../../prisma/data');
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
     const { DIAGNOSIS_DB } = require('../../prisma/data');
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
\` + bottom.substring(bottom.indexOf('export const SYMPTOM_DATA'));

fs.writeFileSync('src/lib/clinicalEngine.ts', newEngine);
console.log('Success!');
