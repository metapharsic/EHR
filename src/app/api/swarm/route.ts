import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/index";

// POST /api/swarm/analyze - Run swarm intelligence analysis
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { patientId, symptoms, labResults, imaging, history } = body;

    // Mock swarm intelligence analysis
    const swarmAnalysis = {
      id: "swarm-" + Date.now(),
      patientId,
      caseType: "diagnostic",
      presentingSymptoms: symptoms,
      swarmSize: 8,
      convergenceScore: 0.87,
      
      contributingFactors: [
        {
          id: "f1",
          factorType: "SYMPTOM",
          factorName: "Chest Pain",
          weight: 0.95,
          confidence: 0.94,
          direction: "SUPPORTS",
          evidenceData: { severity: 8, duration: "acute", radiation: "left arm" },
        },
        {
          id: "f2",
          factorType: "SYMPTOM",
          factorName: "Shortness of Breath",
          weight: 0.88,
          confidence: 0.92,
          direction: "SUPPORTS",
          evidenceData: { onset: "exertional", relief: "rest" },
        },
        {
          id: "f3",
          factorType: "LAB_RESULT",
          factorName: "Troponin I",
          weight: 0.92,
          confidence: 0.98,
          direction: "SUPPORTS",
          evidenceData: { value: 0.45, unit: "ng/mL", normal: "<0.04" },
        },
        {
          id: "f4",
          factorType: "LAB_RESULT",
          factorName: "BNP",
          weight: 0.76,
          confidence: 0.89,
          direction: "SUPPORTS",
          evidenceData: { value: 450, unit: "pg/mL", normal: "<100" },
        },
        {
          id: "f5",
          factorType: "IMAGING",
          factorName: "ECG",
          weight: 0.85,
          confidence: 0.91,
          direction: "SUPPORTS",
          evidenceData: { findings: ["ST elevation", "T-wave inversion"], location: "anterior leads" },
        },
        {
          id: "f6",
          factorType: "HISTORY",
          factorName: "Hypertension",
          weight: 0.65,
          confidence: 0.95,
          direction: "SUPPORTS",
          evidenceData: { duration: "10 years", control: "poor" },
        },
        {
          id: "f7",
          factorType: "HISTORY",
          factorName: "Smoking",
          weight: 0.70,
          confidence: 0.90,
          direction: "SUPPORTS",
          evidenceData: { packYears: 20, status: "former" },
        },
        {
          id: "f8",
          factorType: "AI_PREDICTION",
          factorName: "ML Risk Score",
          weight: 0.82,
          confidence: 0.88,
          direction: "SUPPORTS",
          evidenceData: { score: 0.87, model: "cardiac_risk_v3" },
        },
      ],
      
      primaryDiagnosis: "Acute Coronary Syndrome - STEMI",
      differentialDiagnoses: [
        "Unstable Angina",
        "Non-STEMI",
        "Myocarditis",
        "Pericarditis",
      ],
      
      confidenceScores: {
        "Acute Coronary Syndrome - STEMI": 0.92,
        "Unstable Angina": 0.45,
        "Non-STEMI": 0.38,
        "Myocarditis": 0.15,
        "Pericarditis": 0.12,
      },
      
      recommendations: [
        "Immediate cardiology consultation",
        "Serial troponins q6h",
        "Echocardiogram",
        "Cardiac catheterization",
        "Dual antiplatelet therapy",
        "Statin therapy",
      ],
      
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: swarmAnalysis,
    });
  } catch (error) {
    console.error("Error running swarm analysis:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to run swarm analysis",
        },
      },
      { status: 500 }
    );
  }
}

// GET /api/swarm/patterns - Get discovered diagnosis patterns
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // Mock discovered patterns
    const patterns = [
      {
        id: "pat-1",
        patternName: "Silent Cardiac Pattern",
        description: "Atypical presentation of cardiac events in diabetic patients with autonomic neuropathy",
        symptomPattern: ["Fatigue", "Nausea", "Diaphoresis", "Dyspnea"],
        labPattern: { troponin: "elevated", glucose: "uncontrolled" },
        demographicPattern: { age: ">65", diabetes: true },
        occurrenceCount: 247,
        successRate: 0.94,
        associatedDiagnoses: ["Silent MI", "NSTEMI", "Unstable Angina"],
        typicalSeverity: "HIGH",
        discoveredByAI: true,
        discoveryDate: "2023-08-15",
        lastValidated: "2024-01-20",
      },
      {
        id: "pat-2",
        patternName: "Autoimmune Cascade",
        description: "Progressive multi-system involvement in undiagnosed autoimmune conditions",
        symptomPattern: ["Joint pain", "Fatigue", "Rash", "Fever"],
        labPattern: { ANA: "positive", ESR: "elevated", CRP: "elevated" },
        demographicPattern: { age: "30-50", female: true },
        occurrenceCount: 189,
        successRate: 0.89,
        associatedDiagnoses: ["Lupus", "RA", "Mixed Connective Tissue Disease"],
        typicalSeverity: "MEDIUM",
        discoveredByAI: true,
        discoveryDate: "2023-09-22",
        lastValidated: "2024-02-10",
      },
      {
        id: "pat-3",
        patternName: "Metabolic Syndrome Progression",
        description: "Early indicators of metabolic syndrome before full criteria met",
        symptomPattern: ["Central obesity", "Fatigue", "Polyuria", "Blurred vision"],
        labPattern: { HbA1c: "prediabetic", triglycerides: "elevated", HDL: "low" },
        demographicPattern: { age: "40-60", sedentary: true },
        occurrenceCount: 523,
        successRate: 0.91,
        associatedDiagnoses: ["Metabolic Syndrome", "Type 2 Diabetes", "NAFLD"],
        typicalSeverity: "MEDIUM",
        discoveredByAI: true,
        discoveryDate: "2023-10-05",
        lastValidated: "2024-02-15",
      },
    ];

    return NextResponse.json({
      success: true,
      data: patterns,
    });
  } catch (error) {
    console.error("Error fetching swarm patterns:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch swarm patterns",
        },
      },
      { status: 500 }
    );
  }
}
