with open('src/lib/clinicalEngine.ts', 'r', encoding='utf-8') as f:
    text = f.read()

sIdx = text.find('export const DIAGNOSIS_DB: Diagnosis[] = [')
eIdx = text.find('// ─── Symptom → Diagnosis Scoring Engine')

top = text[:sIdx]
data = text[sIdx:eIdx]
bottom = text[eIdx:]

with open('prisma/data.ts', 'w', encoding='utf-8') as f:
    f.write('import { Diagnosis, Medication, LabTest, Imaging, Referral } from "../src/lib/clinicalEngine";\\n' + data)

with open('prisma/seed_clinical.ts', 'r', encoding='utf-8') as f:
    seed = f.read()
seed = seed.replace("import { DIAGNOSIS_DB } from '../src/lib/clinicalEngine';", "import { DIAGNOSIS_DB } from './data';")
with open('prisma/seed_clinical.ts', 'w', encoding='utf-8') as f:
    f.write(seed)

new_funcs = """
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

  return list(symptoms);
}

// ─── Metadata Lookup for UI ──────────────────────────────────────────────────
"""

# fix python syntax inside typescript
new_funcs = new_funcs.replace("list(symptoms);", "Array.from(symptoms);")

bottom_idx = bottom.find('// ─── Metadata Lookup for UI')
new_engine = top + new_funcs + bottom[bottom_idx + len('// ─── Metadata Lookup for UI'):]

with open('src/lib/clinicalEngine.ts', 'w', encoding='utf-8') as f:
    f.write(new_engine)

print('Success!')
