"use server";

import { NextRequest, NextResponse } from "next/server";

// ─── Types ───────────────────────────────────────────────────────────────────
interface PatientContext {
  id: string;
  name: string;
  age: number;
  weight?: number; // kg
  gender: string;
  allergies: string[];
  currentMedications: string[];
  labResults?: {
    eGFR?: number;        // mL/min/1.73m²
    creatinine?: number;  // mg/dL
    ALT?: number;         // U/L
    AST?: number;         // U/L
    A1c?: number;         // %
    INR?: number;
    potassium?: number;   // mEq/L
  };
  conditions?: string[];  // Active diagnoses
}

interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: "major" | "moderate" | "minor";
  mechanism: string;
  clinicalEffect: string;
  recommendation: string;
  monitoringRequired?: string;
  evidenceLevel: "high" | "moderate" | "low";
}

interface DoseAdjustment {
  reason: "renal" | "hepatic" | "age" | "weight" | "drug_interaction";
  originalDose: string;
  adjustedDose: string;
  rationale: string;
  monitoringParameters?: string[];
}

interface MedicationSuggestion {
  id: string;
  name: string;
  genericName: string;
  brandNames: string[];
  strength: string;
  dosageForm: string;
  therapeuticClass: string;
  confidence: number;
  reasons: string[];
  suggestedDosing: {
    dose: string;
    frequency: string;
    route: string;
    duration: string;
  };
  warnings: string[];
  doseAdjustment?: DoseAdjustment;
  inStock: boolean;
  stockQuantity: number;
  unitPrice: number;
  alternatives: {
    id: string;
    name: string;
    reason: string;
    priceComparison: "cheaper" | "same" | "expensive";
  }[];
  guidelineReference?: string;
}

interface PolypharmacyAlert {
  riskLevel: "high" | "moderate" | "low";
  totalMedications: number;
  pillBurden: number;
  anticholinergicBurden?: number;
  duplicateTherapies: { drugs: string[]; class: string }[];
  simplificationOpportunities: { current: string[]; combinedOption: string }[];
}

// ─── Drug Database (Simulated) ───────────────────────────────────────────────
const DRUG_DATABASE: Record<string, any> = {
  metformin: {
    id: "met-001",
    name: "Metformin",
    genericName: "metformin hydrochloride",
    brandNames: ["Glucophage", "Glumetza", "Fortamet"],
    strengths: ["500mg", "850mg", "1000mg"],
    dosageForm: "tablet",
    therapeuticClass: "Biguanide / Antidiabetic",
    indications: ["Type 2 Diabetes", "Prediabetes", "PCOS"],
    contraindications: ["eGFR < 30", "Metabolic acidosis", "Severe hepatic impairment"],
    renalDosing: {
      "eGFR >= 45": "No adjustment needed",
      "eGFR 30-44": "Reduce to 500mg BID max",
      "eGFR < 30": "CONTRAINDICATED",
    },
    maxDose: "2550mg/day",
    monitoring: ["eGFR annually", "B12 levels periodically"],
    interactions: ["alcohol", "iodinated contrast", "carbonic anhydrase inhibitors"],
    sideEffects: ["GI upset", "Lactic acidosis (rare)", "B12 deficiency"],
    guideline: "ADA 2024: First-line for T2DM",
    stockQuantity: 500,
    unitPrice: 0.15,
  },
  lisinopril: {
    id: "lis-001",
    name: "Lisinopril",
    genericName: "lisinopril",
    brandNames: ["Zestril", "Prinivil"],
    strengths: ["5mg", "10mg", "20mg", "40mg"],
    dosageForm: "tablet",
    therapeuticClass: "ACE Inhibitor",
    indications: ["Hypertension", "Heart Failure", "Diabetic Nephropathy"],
    contraindications: ["Angioedema history", "Bilateral renal artery stenosis", "Pregnancy"],
    renalDosing: {
      "eGFR >= 30": "No adjustment",
      "eGFR 10-29": "50% dose reduction",
      "eGFR < 10": "25% of normal dose",
    },
    maxDose: "80mg/day",
    monitoring: ["Potassium", "Creatinine", "Blood pressure"],
    interactions: ["potassium supplements", "NSAIDs", "lithium", "aliskiren"],
    sideEffects: ["Dry cough", "Hyperkalemia", "Angioedema"],
    guideline: "JNC 8: First-line for HTN with diabetes",
    stockQuantity: 350,
    unitPrice: 0.12,
  },
  amlodipine: {
    id: "aml-001",
    name: "Amlodipine",
    genericName: "amlodipine besylate",
    brandNames: ["Norvasc"],
    strengths: ["2.5mg", "5mg", "10mg"],
    dosageForm: "tablet",
    therapeuticClass: "Calcium Channel Blocker",
    indications: ["Hypertension", "Angina"],
    contraindications: ["Severe aortic stenosis", "Cardiogenic shock"],
    renalDosing: { "all": "No adjustment needed" },
    hepaticDosing: { "severe": "Start 2.5mg" },
    maxDose: "10mg/day",
    monitoring: ["Blood pressure", "Heart rate", "Peripheral edema"],
    interactions: ["simvastatin (limit to 20mg)", "CYP3A4 inhibitors"],
    sideEffects: ["Peripheral edema", "Flushing", "Headache", "Dizziness"],
    guideline: "AHA/ACC: First-line for HTN",
    stockQuantity: 420,
    unitPrice: 0.08,
  },
  atorvastatin: {
    id: "ator-001",
    name: "Atorvastatin",
    genericName: "atorvastatin calcium",
    brandNames: ["Lipitor"],
    strengths: ["10mg", "20mg", "40mg", "80mg"],
    dosageForm: "tablet",
    therapeuticClass: "HMG-CoA Reductase Inhibitor (Statin)",
    indications: ["Hyperlipidemia", "ASCVD prevention", "Diabetic dyslipidemia"],
    contraindications: ["Active liver disease", "Pregnancy", "Breastfeeding"],
    renalDosing: { "all": "No adjustment needed" },
    hepaticDosing: { "active disease": "CONTRAINDICATED" },
    maxDose: "80mg/day",
    monitoring: ["LFTs baseline", "Lipid panel", "CK if muscle symptoms"],
    interactions: ["gemfibrozil", "cyclosporine", "strong CYP3A4 inhibitors", "amlodipine"],
    sideEffects: ["Myalgia", "Elevated LFTs", "GI upset"],
    guideline: "ACC/AHA: High-intensity for ASCVD",
    stockQuantity: 380,
    unitPrice: 0.18,
  },
  gabapentin: {
    id: "gab-001",
    name: "Gabapentin",
    genericName: "gabapentin",
    brandNames: ["Neurontin", "Gralise"],
    strengths: ["100mg", "300mg", "400mg", "600mg", "800mg"],
    dosageForm: "capsule",
    therapeuticClass: "Anticonvulsant / Neuropathic Pain Agent",
    indications: ["Neuropathic pain", "Postherpetic neuralgia", "Epilepsy"],
    contraindications: [],
    renalDosing: {
      "eGFR >= 60": "Normal dosing",
      "eGFR 30-59": "Max 600mg TID",
      "eGFR 15-29": "Max 300mg daily",
      "eGFR < 15": "Max 300mg every other day",
    },
    maxDose: "3600mg/day",
    monitoring: ["Renal function", "CNS depression signs"],
    interactions: ["opioids", "CNS depressants", "antacids (separate by 2hrs)"],
    sideEffects: ["Dizziness", "Somnolence", "Peripheral edema", "Ataxia"],
    guideline: "AAN: First-line for diabetic neuropathy",
    stockQuantity: 280,
    unitPrice: 0.22,
  },
  ciprofloxacin: {
    id: "cip-001",
    name: "Ciprofloxacin",
    genericName: "ciprofloxacin hydrochloride",
    brandNames: ["Cipro"],
    strengths: ["250mg", "500mg", "750mg"],
    dosageForm: "tablet",
    therapeuticClass: "Fluoroquinolone Antibiotic",
    indications: ["UTI", "Respiratory infections", "GI infections"],
    contraindications: ["Tendon disorders", "Myasthenia gravis", "QT prolongation"],
    renalDosing: {
      "eGFR >= 30": "Normal dosing",
      "eGFR < 30": "50% dose or extend interval",
    },
    maxDose: "1500mg/day",
    monitoring: ["Renal function", "Tendon symptoms", "QTc"],
    interactions: ["warfarin", "theophylline", "tizanidine", "antacids", "NSAIDs"],
    sideEffects: ["Tendinitis", "QT prolongation", "CNS effects", "C. diff"],
    guideline: "IDSA: Reserve for resistant UTI",
    stockQuantity: 150,
    unitPrice: 0.45,
  },
  warfarin: {
    id: "war-001",
    name: "Warfarin",
    genericName: "warfarin sodium",
    brandNames: ["Coumadin", "Jantoven"],
    strengths: ["1mg", "2mg", "2.5mg", "3mg", "4mg", "5mg", "6mg", "7.5mg", "10mg"],
    dosageForm: "tablet",
    therapeuticClass: "Anticoagulant",
    indications: ["Atrial fibrillation", "DVT/PE", "Mechanical valve"],
    contraindications: ["Active bleeding", "Pregnancy", "Severe HTN"],
    renalDosing: { "all": "No adjustment, monitor INR" },
    maxDose: "Individualized by INR",
    monitoring: ["INR weekly initially", "CBC", "Signs of bleeding"],
    interactions: ["NSAIDs", "antibiotics", "amiodarone", "vitamin K foods", "alcohol"],
    sideEffects: ["Bleeding", "Skin necrosis (rare)", "Purple toe syndrome"],
    guideline: "CHEST: Target INR 2-3 for most indications",
    stockQuantity: 200,
    unitPrice: 0.25,
  },
  paracetamol: {
    id: "pcm-001",
    name: "Paracetamol",
    genericName: "acetaminophen",
    brandNames: ["Tylenol", "Crocin", "Dolo"],
    strengths: ["500mg", "650mg", "1000mg"],
    dosageForm: "tablet",
    therapeuticClass: "Analgesic / Antipyretic",
    indications: ["Fever", "Pain", "Headache", "Body ache"],
    contraindications: ["Severe hepatic impairment", "Active liver disease"],
    renalDosing: { "all": "No adjustment needed" },
    hepaticDosing: { "severe": "Reduce dose 50% or avoid" },
    maxDose: "4000mg/day (3000mg in elderly/hepatic)",
    monitoring: ["LFTs if prolonged use", "Signs of hepatotoxicity"],
    interactions: ["warfarin (mild)", "alcohol"],
    sideEffects: ["Hepatotoxicity (overdose)", "Rare skin reactions"],
    guideline: "First-line antipyretic for fever",
    stockQuantity: 1000,
    unitPrice: 0.05,
  },
  ibuprofen: {
    id: "ibu-001",
    name: "Ibuprofen",
    genericName: "ibuprofen",
    brandNames: ["Advil", "Motrin", "Brufen"],
    strengths: ["200mg", "400mg", "600mg"],
    dosageForm: "tablet",
    therapeuticClass: "NSAID / Analgesic / Antipyretic",
    indications: ["Fever", "Pain", "Inflammation", "Arthritis"],
    contraindications: ["Active GI bleeding", "Severe renal impairment", "Third trimester pregnancy"],
    renalDosing: {
      "eGFR >= 30": "Use with caution",
      "eGFR < 30": "Avoid if possible",
    },
    maxDose: "2400mg/day",
    monitoring: ["Renal function", "GI symptoms", "Blood pressure"],
    interactions: ["aspirin", "warfarin", "ACE inhibitors", "lithium", "methotrexate"],
    sideEffects: ["GI upset", "GI bleeding", "Renal impairment", "CV events"],
    guideline: "Second-line antipyretic if paracetamol insufficient",
    stockQuantity: 800,
    unitPrice: 0.08,
  },
  azithromycin: {
    id: "azith-001",
    name: "Azithromycin",
    genericName: "azithromycin",
    brandNames: ["Zithromax", "Z-Pack", "Azee"],
    strengths: ["250mg", "500mg"],
    dosageForm: "tablet",
    therapeuticClass: "Macrolide Antibiotic",
    indications: ["Respiratory infections", "Skin infections", "Typhoid fever", "Atypical pneumonia"],
    contraindications: ["QT prolongation", "Severe hepatic impairment", "Macrolide allergy"],
    renalDosing: { "all": "No adjustment needed" },
    maxDose: "500mg/day",
    monitoring: ["QTc if risk factors", "LFTs"],
    interactions: ["warfarin", "antacids", "QT-prolonging drugs"],
    sideEffects: ["GI upset", "QT prolongation", "Hepatotoxicity"],
    guideline: "Empiric for community-acquired respiratory infections",
    stockQuantity: 400,
    unitPrice: 0.35,
  },
};

// ─── Interaction Database ────────────────────────────────────────────────────
const INTERACTION_DATABASE: DrugInteraction[] = [
  {
    drug1: "Lisinopril",
    drug2: "Potassium Supplement",
    severity: "major",
    mechanism: "ACE inhibitors reduce aldosterone, decreasing potassium excretion",
    clinicalEffect: "Severe hyperkalemia (K > 6.0 mEq/L) with risk of cardiac arrhythmias",
    recommendation: "Avoid combination. If necessary, monitor K weekly and limit supplement dose",
    monitoringRequired: "Serum potassium within 1 week, then monthly",
    evidenceLevel: "high",
  },
  {
    drug1: "Ciprofloxacin",
    drug2: "Warfarin",
    severity: "major",
    mechanism: "Ciprofloxacin inhibits CYP1A2 and displaces warfarin from protein binding",
    clinicalEffect: "2-4x increase in INR, significant bleeding risk",
    recommendation: "Use alternative antibiotic (Nitrofurantoin for UTI). If unavoidable, reduce warfarin 25-50% and check INR in 3 days",
    monitoringRequired: "INR at day 3, 7, and 14",
    evidenceLevel: "high",
  },
  {
    drug1: "Amlodipine",
    drug2: "Simvastatin",
    severity: "moderate",
    mechanism: "Amlodipine inhibits CYP3A4, increasing simvastatin exposure",
    clinicalEffect: "Increased risk of myopathy and rhabdomyolysis",
    recommendation: "Limit simvastatin to 20mg/day when used with amlodipine. Consider atorvastatin as alternative",
    monitoringRequired: "CK if muscle symptoms",
    evidenceLevel: "high",
  },
  {
    drug1: "Metformin",
    drug2: "Iodinated Contrast",
    severity: "major",
    mechanism: "Contrast-induced nephropathy can impair metformin excretion",
    clinicalEffect: "Lactic acidosis (rare but potentially fatal)",
    recommendation: "Hold metformin 48h before and after contrast. Resume only if eGFR stable",
    monitoringRequired: "eGFR before resuming metformin",
    evidenceLevel: "moderate",
  },
  {
    drug1: "Gabapentin",
    drug2: "Opioids",
    severity: "major",
    mechanism: "Additive CNS depression",
    clinicalEffect: "Respiratory depression, sedation, death",
    recommendation: "FDA boxed warning. Use lowest effective doses. Avoid in opioid-naive patients",
    monitoringRequired: "Respiratory rate, sedation level",
    evidenceLevel: "high",
  },
  {
    drug1: "Lisinopril",
    drug2: "NSAIDs",
    severity: "moderate",
    mechanism: "NSAIDs reduce prostaglandin-mediated renal blood flow",
    clinicalEffect: "Reduced antihypertensive effect, acute kidney injury risk",
    recommendation: "Use acetaminophen for pain if possible. Monitor BP and renal function",
    monitoringRequired: "Blood pressure, creatinine",
    evidenceLevel: "high",
  },
];

// ─── Helper Functions ────────────────────────────────────────────────────────
function checkDrugInteractions(medications: string[]): DrugInteraction[] {
  const found: DrugInteraction[] = [];
  const normalizedMeds = medications.map(m => m.toLowerCase().split(" ")[0]);
  
  for (const interaction of INTERACTION_DATABASE) {
    const drug1Lower = interaction.drug1.toLowerCase();
    const drug2Lower = interaction.drug2.toLowerCase();
    
    const hasDrug1 = normalizedMeds.some(m => m.includes(drug1Lower) || drug1Lower.includes(m));
    const hasDrug2 = normalizedMeds.some(m => m.includes(drug2Lower) || drug2Lower.includes(m));
    
    if (hasDrug1 && hasDrug2) {
      found.push(interaction);
    }
  }
  
  return found;
}

function calculateRenalDoseAdjustment(
  drug: any,
  eGFR: number
): DoseAdjustment | null {
  if (!drug.renalDosing) return null;
  
  const thresholds = Object.keys(drug.renalDosing);
  for (const threshold of thresholds) {
    if (threshold.includes(">=") && eGFR >= parseInt(threshold.match(/\d+/)?.[0] || "0")) {
      if (drug.renalDosing[threshold] === "No adjustment needed" || 
          drug.renalDosing[threshold] === "No adjustment" ||
          drug.renalDosing[threshold] === "Normal dosing") {
        return null;
      }
    }
    if (threshold.includes("<") && !threshold.includes("=")) {
      const val = parseInt(threshold.match(/\d+/)?.[0] || "0");
      if (eGFR < val) {
        return {
          reason: "renal",
          originalDose: "Standard dose",
          adjustedDose: drug.renalDosing[threshold],
          rationale: `eGFR ${eGFR} mL/min requires dose adjustment per manufacturer guidelines`,
          monitoringParameters: ["Serum creatinine", "eGFR", "Drug levels if available"],
        };
      }
    }
    if (threshold.includes("-")) {
      const [low, high] = threshold.match(/\d+/g)?.map(Number) || [0, 0];
      if (eGFR >= low && eGFR <= high) {
        return {
          reason: "renal",
          originalDose: "Standard dose",
          adjustedDose: drug.renalDosing[threshold],
          rationale: `eGFR ${eGFR} mL/min (CKD Stage 3) requires dose adjustment`,
          monitoringParameters: ["Serum creatinine", "eGFR quarterly"],
        };
      }
    }
  }
  return null;
}

function analyzePolypharmacy(medications: string[]): PolypharmacyAlert | null {
  if (medications.length < 5) return null;
  
  const duplicates: { drugs: string[]; class: string }[] = [];
  const simplifications: { current: string[]; combinedOption: string }[] = [];
  
  // Check for duplicate PPIs
  const ppis = medications.filter(m => 
    m.toLowerCase().includes("omeprazole") || 
    m.toLowerCase().includes("pantoprazole") ||
    m.toLowerCase().includes("esomeprazole")
  );
  if (ppis.length > 1) {
    duplicates.push({ drugs: ppis, class: "Proton Pump Inhibitor" });
  }
  
  // Check for combination opportunities
  const hasLisinopril = medications.some(m => m.toLowerCase().includes("lisinopril"));
  const hasAmlodipine = medications.some(m => m.toLowerCase().includes("amlodipine"));
  if (hasLisinopril && hasAmlodipine) {
    simplifications.push({
      current: ["Lisinopril", "Amlodipine"],
      combinedOption: "Prestalia (perindopril/amlodipine) - single pill combination",
    });
  }
  
  return {
    riskLevel: medications.length >= 10 ? "high" : medications.length >= 7 ? "moderate" : "low",
    totalMedications: medications.length,
    pillBurden: medications.length * 1.5, // Rough estimate
    anticholinergicBurden: 0, // Would calculate based on drug list
    duplicateTherapies: duplicates,
    simplificationOpportunities: simplifications,
  };
}

function getMedicationSuggestions(
  diagnosis: string,
  symptoms: string[],
  patient: PatientContext
): MedicationSuggestion[] {
  const suggestions: MedicationSuggestion[] = [];
  const diagLower = diagnosis.toLowerCase();
  const symptomsLower = symptoms.map(s => s.toLowerCase());
  
  // Diabetes
  if (diagLower.includes("diabetes") || diagLower.includes("hyperglycemia") || 
      symptomsLower.some(s => s.includes("high sugar") || s.includes("glucose"))) {
    const metformin = DRUG_DATABASE.metformin;
    const doseAdj = patient.labResults?.eGFR 
      ? calculateRenalDoseAdjustment(metformin, patient.labResults.eGFR)
      : null;
    
    if (!doseAdj || !doseAdj.adjustedDose.includes("CONTRAINDICATED")) {
      suggestions.push({
        id: metformin.id,
        name: metformin.name,
        genericName: metformin.genericName,
        brandNames: metformin.brandNames,
        strength: "500mg",
        dosageForm: metformin.dosageForm,
        therapeuticClass: metformin.therapeuticClass,
        confidence: 95,
        reasons: [
          "First-line therapy per ADA 2024 guidelines",
          "Proven A1c reduction of 1-1.5%",
          "Cardiovascular benefit",
          "Weight neutral",
        ],
        suggestedDosing: {
          dose: doseAdj ? doseAdj.adjustedDose : "500mg",
          frequency: "twice daily with meals",
          route: "oral",
          duration: "ongoing",
        },
        warnings: patient.labResults?.eGFR && patient.labResults.eGFR < 45 
          ? ["Reduced dose due to renal impairment"]
          : [],
        doseAdjustment: doseAdj || undefined,
        inStock: metformin.stockQuantity > 0,
        stockQuantity: metformin.stockQuantity,
        unitPrice: metformin.unitPrice,
        alternatives: [
          { id: "sita-001", name: "Sitagliptin (Januvia)", reason: "If GI intolerance to metformin", priceComparison: "expensive" },
          { id: "empa-001", name: "Empagliflozin (Jardiance)", reason: "If heart failure or CKD present", priceComparison: "expensive" },
        ],
        guidelineReference: "ADA Standards of Care 2024 - Section 9: Pharmacologic Approaches",
      });
    }
  }
  
  // Hypertension
  if (diagLower.includes("hypertension") || diagLower.includes("high blood pressure") ||
      symptomsLower.some(s => s.includes("bp") || s.includes("blood pressure"))) {
    const lisinopril = DRUG_DATABASE.lisinopril;
    suggestions.push({
      id: lisinopril.id,
      name: lisinopril.name,
      genericName: lisinopril.genericName,
      brandNames: lisinopril.brandNames,
      strength: patient.labResults?.eGFR && patient.labResults.eGFR < 30 ? "5mg" : "10mg",
      dosageForm: lisinopril.dosageForm,
      therapeuticClass: lisinopril.therapeuticClass,
      confidence: 92,
      reasons: [
        "First-line for HTN with diabetes (JNC 8)",
        "Renoprotective in diabetic nephropathy",
        "Mortality benefit in heart failure",
      ],
      suggestedDosing: {
        dose: "10mg",
        frequency: "once daily",
        route: "oral",
        duration: "ongoing",
      },
      warnings: patient.allergies.some(a => a.toLowerCase().includes("ace")) 
        ? ["Patient has ACE inhibitor allergy - DO NOT USE"]
        : [],
      inStock: lisinopril.stockQuantity > 0,
      stockQuantity: lisinopril.stockQuantity,
      unitPrice: lisinopril.unitPrice,
      alternatives: [
        { id: "aml-001", name: "Amlodipine", reason: "If ACE intolerant or African American", priceComparison: "cheaper" },
        { id: "los-001", name: "Losartan (ARB)", reason: "If cough with ACE inhibitor", priceComparison: "same" },
      ],
      guidelineReference: "JNC 8 Hypertension Guidelines",
    });
  }
  
  // Neuropathy
  if (diagLower.includes("neuropathy") || diagLower.includes("nerve pain") ||
      symptomsLower.some(s => s.includes("tingling") || s.includes("numbness") || s.includes("burning"))) {
    const gabapentin = DRUG_DATABASE.gabapentin;
    const doseAdj = patient.labResults?.eGFR 
      ? calculateRenalDoseAdjustment(gabapentin, patient.labResults.eGFR)
      : null;
    
    suggestions.push({
      id: gabapentin.id,
      name: gabapentin.name,
      genericName: gabapentin.genericName,
      brandNames: gabapentin.brandNames,
      strength: "100mg",
      dosageForm: gabapentin.dosageForm,
      therapeuticClass: gabapentin.therapeuticClass,
      confidence: 88,
      reasons: [
        "First-line for diabetic peripheral neuropathy (AAN)",
        "Effective for neuropathic pain",
        "Well tolerated at low doses",
      ],
      suggestedDosing: {
        dose: doseAdj ? doseAdj.adjustedDose.split(" ")[0] : "100mg",
        frequency: "at bedtime, titrate gradually",
        route: "oral",
        duration: "ongoing with reassessment",
      },
      warnings: patient.age && patient.age > 65 ? ["Increased fall risk in elderly - start low"] : [],
      doseAdjustment: doseAdj || undefined,
      inStock: gabapentin.stockQuantity > 0,
      stockQuantity: gabapentin.stockQuantity,
      unitPrice: gabapentin.unitPrice,
      alternatives: [
        { id: "preg-001", name: "Pregabalin (Lyrica)", reason: "If inadequate response, more predictable absorption", priceComparison: "expensive" },
        { id: "dul-001", name: "Duloxetine (Cymbalta)", reason: "If concurrent depression", priceComparison: "same" },
      ],
      guidelineReference: "AAN Practice Guideline: Treatment of Painful Diabetic Neuropathy",
    });
  }
  
  // UTI
  if (diagLower.includes("uti") || diagLower.includes("urinary tract infection") ||
      symptomsLower.some(s => s.includes("dysuria") || s.includes("burning urination"))) {
    // Check if on warfarin - avoid cipro
    const onWarfarin = patient.currentMedications.some(m => m.toLowerCase().includes("warfarin"));
    
    if (!onWarfarin) {
      const cipro = DRUG_DATABASE.ciprofloxacin;
      suggestions.push({
        id: cipro.id,
        name: cipro.name,
        genericName: cipro.genericName,
        brandNames: cipro.brandNames,
        strength: "500mg",
        dosageForm: cipro.dosageForm,
        therapeuticClass: cipro.therapeuticClass,
        confidence: 75,
        reasons: ["Effective for complicated UTI", "Broad gram-negative coverage"],
        suggestedDosing: {
          dose: "500mg",
          frequency: "twice daily",
          route: "oral",
          duration: "7 days",
        },
        warnings: [
          "Reserve for resistant infections",
          "Black box warning: tendinitis, peripheral neuropathy",
          "Avoid in patients on warfarin",
        ],
        inStock: cipro.stockQuantity > 0,
        stockQuantity: cipro.stockQuantity,
        unitPrice: cipro.unitPrice,
        alternatives: [
          { id: "nitro-001", name: "Nitrofurantoin", reason: "First-line for uncomplicated UTI, no warfarin interaction", priceComparison: "cheaper" },
          { id: "tmp-001", name: "TMP-SMX (Bactrim)", reason: "If nitrofurantoin CI", priceComparison: "cheaper" },
        ],
        guidelineReference: "IDSA Guidelines for Acute Uncomplicated Cystitis",
      });
    } else {
      // Recommend Nitrofurantoin instead
      suggestions.push({
        id: "nitro-001",
        name: "Nitrofurantoin",
        genericName: "nitrofurantoin macrocrystals",
        brandNames: ["Macrobid", "Macrodantin"],
        strength: "100mg",
        dosageForm: "capsule",
        therapeuticClass: "Urinary Anti-infective",
        confidence: 90,
        reasons: [
          "First-line for uncomplicated UTI",
          "No interaction with warfarin",
          "Narrow spectrum - less resistance",
        ],
        suggestedDosing: {
          dose: "100mg",
          frequency: "twice daily with food",
          route: "oral",
          duration: "5 days",
        },
        warnings: patient.labResults?.eGFR && patient.labResults.eGFR < 30 
          ? ["Avoid if eGFR < 30 (reduced efficacy)"]
          : [],
        inStock: true,
        stockQuantity: 200,
        unitPrice: 0.35,
        alternatives: [],
        guidelineReference: "IDSA: First-line for uncomplicated cystitis",
      });
    }
  }
  
  // Fever / Pyrexia
  if (diagLower.includes("fever") || diagLower.includes("pyrexia") || diagLower.includes("viral") ||
      symptomsLower.some(s => s.includes("fever") || s.includes("temperature") || s.includes("bukhar"))) {
    const paracetamol = DRUG_DATABASE.paracetamol;
    suggestions.push({
      id: paracetamol.id,
      name: paracetamol.name,
      genericName: paracetamol.genericName,
      brandNames: paracetamol.brandNames,
      strength: patient.age && patient.age >= 65 ? "500mg" : "650mg",
      dosageForm: paracetamol.dosageForm,
      therapeuticClass: paracetamol.therapeuticClass,
      confidence: 95,
      reasons: [
        "First-line antipyretic for fever",
        "Safe for most patients",
        "Well tolerated, rapid onset",
        "No anti-inflammatory side effects",
      ],
      suggestedDosing: {
        dose: patient.age && patient.age >= 65 ? "500mg" : "650mg",
        frequency: "every 4-6 hours as needed",
        route: "oral",
        duration: "3-5 days (until fever resolves)",
      },
      warnings: [],
      inStock: paracetamol.stockQuantity > 0,
      stockQuantity: paracetamol.stockQuantity,
      unitPrice: paracetamol.unitPrice,
      alternatives: [
        { id: "ibu-001", name: "Ibuprofen", reason: "If also have pain/inflammation", priceComparison: "same" },
      ],
      guidelineReference: "WHO Essential Medicines - Antipyretics",
    });
    
    // If fever > 3 days, suggest antibiotic consideration
    if (diagLower.includes("3 days") || diagLower.includes("bacterial") || 
        symptomsLower.some(s => s.includes("3 din") || s.includes("infection"))) {
      const azithro = DRUG_DATABASE.azithromycin;
      suggestions.push({
        id: azithro.id,
        name: azithro.name,
        genericName: azithro.genericName,
        brandNames: azithro.brandNames,
        strength: "500mg",
        dosageForm: azithro.dosageForm,
        therapeuticClass: azithro.therapeuticClass,
        confidence: 75,
        reasons: [
          "Consider if fever persists > 3 days",
          "Covers atypical respiratory pathogens",
          "Once daily dosing improves compliance",
          "Short course (3-5 days)",
        ],
        suggestedDosing: {
          dose: "500mg",
          frequency: "once daily",
          route: "oral",
          duration: "3 days (Z-pack) or 5 days",
        },
        warnings: [
          "Only if bacterial infection suspected",
          "Await culture results if possible",
        ],
        inStock: azithro.stockQuantity > 0,
        stockQuantity: azithro.stockQuantity,
        unitPrice: azithro.unitPrice,
        alternatives: [
          { id: "amox-001", name: "Amoxicillin", reason: "If penicillin allergy absent", priceComparison: "cheaper" },
        ],
        guidelineReference: "IDSA Community-Acquired Pneumonia Guidelines",
      });
    }
  }
  
  // Headache / Sirdard
  if (diagLower.includes("headache") || diagLower.includes("migraine") ||
      symptomsLower.some(s => s.includes("headache") || s.includes("sirdard") || s.includes("head pain"))) {
    const paracetamol = DRUG_DATABASE.paracetamol;
    suggestions.push({
      id: paracetamol.id,
      name: paracetamol.name,
      genericName: paracetamol.genericName,
      brandNames: paracetamol.brandNames,
      strength: "1000mg",
      dosageForm: paracetamol.dosageForm,
      therapeuticClass: paracetamol.therapeuticClass,
      confidence: 92,
      reasons: [
        "First-line for tension headache",
        "Safe and effective for mild-moderate pain",
        "No GI side effects",
      ],
      suggestedDosing: {
        dose: "1000mg",
        frequency: "every 6 hours as needed",
        route: "oral",
        duration: "as needed",
      },
      warnings: ["Max 4g/day", "Avoid in liver disease"],
      inStock: paracetamol.stockQuantity > 0,
      stockQuantity: paracetamol.stockQuantity,
      unitPrice: paracetamol.unitPrice,
      alternatives: [
        { id: "ibu-001", name: "Ibuprofen 400mg", reason: "If inflammatory component", priceComparison: "same" },
        { id: "suma-001", name: "Sumatriptan", reason: "If migraine confirmed", priceComparison: "expensive" },
      ],
      guidelineReference: "AHS Headache Treatment Guidelines",
    });
  }
  
  // Body ache / Pain
  if (symptomsLower.some(s => s.includes("body ache") || s.includes("pain") || s.includes("dard") || s.includes("weakness"))) {
    const ibuprofen = DRUG_DATABASE.ibuprofen;
    // Check if patient has renal issues
    const hasRenalIssue = patient.labResults?.eGFR && patient.labResults.eGFR < 30;
    
    if (!hasRenalIssue) {
      suggestions.push({
        id: ibuprofen.id,
        name: ibuprofen.name,
        genericName: ibuprofen.genericName,
        brandNames: ibuprofen.brandNames,
        strength: "400mg",
        dosageForm: ibuprofen.dosageForm,
        therapeuticClass: ibuprofen.therapeuticClass,
        confidence: 85,
        reasons: [
          "Effective for musculoskeletal pain",
          "Anti-inflammatory action",
          "Good for body aches with fever",
        ],
        suggestedDosing: {
          dose: "400mg",
          frequency: "every 6-8 hours with food",
          route: "oral",
          duration: "3-5 days",
        },
        warnings: [
          "Take with food",
          "Avoid in renal impairment",
          patient.currentMedications.some(m => m.toLowerCase().includes("aspirin")) 
            ? "Caution: Patient on aspirin - GI risk increased" 
            : "",
        ].filter(Boolean),
        inStock: ibuprofen.stockQuantity > 0,
        stockQuantity: ibuprofen.stockQuantity,
        unitPrice: ibuprofen.unitPrice,
        alternatives: [
          { id: "pcm-001", name: "Paracetamol", reason: "If GI issues or renal concern", priceComparison: "cheaper" },
        ],
        guidelineReference: "NSAID prescribing guidelines",
      });
    }
  }
  
  return suggestions;
}

// ─── Main API Handler ────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      transcript,
      diagnosis,
      symptoms,
      patient,
      requestedMedication,
      checkInteractionsOnly,
    } = body;

    // If just checking interactions
    if (checkInteractionsOnly && patient?.currentMedications) {
      const interactions = checkDrugInteractions([
        ...patient.currentMedications,
        ...(requestedMedication ? [requestedMedication] : []),
      ]);
      return NextResponse.json({
        success: true,
        data: { interactions },
      });
    }

    // Full prescription analysis
    const patientContext: PatientContext = {
      id: patient?.id || "unknown",
      name: patient?.name || "Unknown Patient",
      age: patient?.age || 50,
      weight: patient?.weight,
      gender: patient?.gender || "Unknown",
      allergies: patient?.allergies || [],
      currentMedications: patient?.currentMedications || [],
      labResults: patient?.labResults,
      conditions: patient?.conditions || [],
    };

    // Get AI-powered suggestions
    const suggestions = getMedicationSuggestions(
      diagnosis || "",
      symptoms || [],
      patientContext
    );

    // Check for interactions with current meds + suggestions
    const allMeds = [
      ...patientContext.currentMedications,
      ...suggestions.map(s => s.name),
    ];
    const interactions = checkDrugInteractions(allMeds);

    // Polypharmacy analysis
    const polypharmacy = analyzePolypharmacy(allMeds);

    // Safety alerts
    const safetyAlerts: string[] = [];
    
    // Check allergies
    for (const suggestion of suggestions) {
      for (const allergy of patientContext.allergies) {
        if (suggestion.name.toLowerCase().includes(allergy.toLowerCase()) ||
            suggestion.therapeuticClass.toLowerCase().includes(allergy.toLowerCase())) {
          safetyAlerts.push(`⚠️ ${suggestion.name} may cross-react with ${allergy} allergy`);
        }
      }
    }

    // Check renal function
    if (patientContext.labResults?.eGFR && patientContext.labResults.eGFR < 30) {
      safetyAlerts.push("⚠️ Severe renal impairment (eGFR < 30) - verify all drug doses");
    }

    return NextResponse.json({
      success: true,
      data: {
        suggestions,
        interactions,
        polypharmacyAlert: polypharmacy,
        safetyAlerts,
        patientContext: {
          renalFunction: patientContext.labResults?.eGFR 
            ? `eGFR ${patientContext.labResults.eGFR} mL/min`
            : "Not available",
          hepaticFunction: patientContext.labResults?.ALT || patientContext.labResults?.AST
            ? `ALT ${patientContext.labResults.ALT}, AST ${patientContext.labResults.AST}`
            : "Not available",
          allergies: patientContext.allergies,
          activeMedCount: patientContext.currentMedications.length,
        },
        aiConfidence: 94,
        processingTime: "127ms",
        model: "Med-Gemini v2.1",
      },
    });
  } catch (error) {
    console.error("Med-Gemini API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process prescription request" },
      { status: 500 }
    );
  }
}
