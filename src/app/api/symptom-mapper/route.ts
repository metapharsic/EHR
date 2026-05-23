import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/index";
import { hasPermission } from "@/lib/auth/roles";

// GET /api/symptom-mapper - Get all symptom nodes and connections
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // Mock 33-node neural network data
    const symptomNodes = [
      { id: "1", name: "Chest Pain", category: "CARDIAC", x: 50, y: 30, severity: 8, confidence: 95, iconName: "Heart", colorScheme: "rose", relatedConditions: ["Angina", "MI", "Costochondritis"], connections: ["2", "3", "4"] },
      { id: "2", name: "Shortness of Breath", category: "RESPIRATORY", x: 70, y: 40, severity: 7, confidence: 92, iconName: "Wind", colorScheme: "cyan", relatedConditions: ["COPD", "Heart Failure", "Anxiety"], connections: ["1", "5", "6"] },
      { id: "3", name: "Fatigue", category: "SYSTEMIC", x: 30, y: 50, severity: 6, confidence: 88, iconName: "Battery", colorScheme: "slate", relatedConditions: ["Anemia", "Hypothyroidism", "Depression"], connections: ["1", "7", "8"] },
      { id: "4", name: "Palpitations", category: "CARDIAC", x: 60, y: 20, severity: 5, confidence: 90, iconName: "Activity", colorScheme: "rose", relatedConditions: ["Arrhythmia", "Anxiety", "Hyperthyroidism"], connections: ["1", "9"] },
      { id: "5", name: "Cough", category: "RESPIRATORY", x: 80, y: 50, severity: 4, confidence: 94, iconName: "Mic", colorScheme: "cyan", relatedConditions: ["Pneumonia", "Bronchitis", "COVID-19"], connections: ["2", "10"] },
      { id: "6", name: "Dizziness", category: "NEUROLOGICAL", x: 40, y: 35, severity: 5, confidence: 85, iconName: "Rotate3D", colorScheme: "purple", relatedConditions: ["Vertigo", "Hypotension", "Anemia"], connections: ["2", "11"] },
      { id: "7", name: "Weight Loss", category: "METABOLIC", x: 20, y: 60, severity: 6, confidence: 87, iconName: "TrendingDown", colorScheme: "amber", relatedConditions: ["Diabetes", "Hyperthyroidism", "Cancer"], connections: ["3", "12"] },
      { id: "8", name: "Sleep Issues", category: "PSYCHOLOGICAL", x: 25, y: 40, severity: 4, confidence: 91, iconName: "Moon", colorScheme: "violet", relatedConditions: ["Insomnia", "Sleep Apnea", "Anxiety"], connections: ["3", "13"] },
      { id: "9", name: "Anxiety", category: "PSYCHOLOGICAL", x: 55, y: 15, severity: 5, confidence: 93, iconName: "Brain", colorScheme: "violet", relatedConditions: ["GAD", "Panic Disorder", "Hyperthyroidism"], connections: ["4", "13"] },
      { id: "10", name: "Fever", category: "INFECTIOUS", x: 85, y: 60, severity: 6, confidence: 96, iconName: "Thermometer", colorScheme: "emerald", relatedConditions: ["Infection", "Inflammation", "Autoimmune"], connections: ["5", "14"] },
      { id: "11", name: "Headache", category: "NEUROLOGICAL", x: 35, y: 25, severity: 5, confidence: 89, iconName: "AlertCircle", colorScheme: "purple", relatedConditions: ["Migraine", "Tension", "Hypertension"], connections: ["6", "15"] },
      { id: "12", name: "Increased Thirst", category: "METABOLIC", x: 15, y: 70, severity: 5, confidence: 88, iconName: "Droplets", colorScheme: "amber", relatedConditions: ["Diabetes", "Dehydration", "Hypercalcemia"], connections: ["7", "16"] },
      { id: "13", name: "Depression", category: "PSYCHOLOGICAL", x: 30, y: 30, severity: 7, confidence: 90, iconName: "CloudRain", colorScheme: "violet", relatedConditions: ["MDD", "Bipolar", "Hypothyroidism"], connections: ["8", "9"] },
      { id: "14", name: "Night Sweats", category: "INFECTIOUS", x: 75, y: 70, severity: 5, confidence: 82, iconName: "Flame", colorScheme: "emerald", relatedConditions: ["TB", "Lymphoma", "Menopause"], connections: ["10", "17"] },
      { id: "15", name: "Visual Changes", category: "NEUROLOGICAL", x: 45, y: 20, severity: 7, confidence: 86, iconName: "Eye", colorScheme: "purple", relatedConditions: ["Migraine", "Stroke", "Glaucoma"], connections: ["11", "18"] },
      { id: "16", name: "Frequent Urination", category: "METABOLIC", x: 10, y: 65, severity: 4, confidence: 91, iconName: "Clock", colorScheme: "amber", relatedConditions: ["Diabetes", "UTI", "BPH"], connections: ["12", "19"] },
      { id: "17", name: "Swollen Lymph Nodes", category: "IMMUNOLOGICAL", x: 70, y: 75, severity: 6, confidence: 84, iconName: "CircleDot", colorScheme: "lime", relatedConditions: ["Infection", "Lymphoma", "Autoimmune"], connections: ["14", "20"] },
      { id: "18", name: "Weakness", category: "NEUROLOGICAL", x: 40, y: 45, severity: 6, confidence: 87, iconName: "BatteryWarning", colorScheme: "purple", relatedConditions: ["Stroke", "MS", "Guillain-Barré"], connections: ["15", "3"] },
      { id: "19", name: "Nausea", category: "GASTROINTESTINAL", x: 5, y: 55, severity: 4, confidence: 89, iconName: "Waves", colorScheme: "yellow", relatedConditions: ["Gastritis", "Pregnancy", "Medication"], connections: ["16", "21"] },
      { id: "20", name: "Joint Pain", category: "IMMUNOLOGICAL", x: 65, y: 80, severity: 5, confidence: 85, iconName: "Bone", colorScheme: "lime", relatedConditions: ["Arthritis", "Lupus", "Lyme Disease"], connections: ["17", "22"] },
      { id: "21", name: "Abdominal Pain", category: "GASTROINTESTINAL", x: 8, y: 45, severity: 6, confidence: 88, iconName: "Circle", colorScheme: "yellow", relatedConditions: ["Appendicitis", "IBS", "Pancreatitis"], connections: ["19", "23"] },
      { id: "22", name: "Rash", category: "DERMATOLOGICAL", x: 60, y: 85, severity: 3, confidence: 86, iconName: "Palette", colorScheme: "fuchsia", relatedConditions: ["Allergic Reaction", "Autoimmune", "Infection"], connections: ["20", "24"] },
      { id: "23", name: "Diarrhea", category: "GASTROINTESTINAL", x: 3, y: 40, severity: 4, confidence: 92, iconName: "ArrowDown", colorScheme: "yellow", relatedConditions: ["Gastroenteritis", "IBD", "Celiac"], connections: ["21", "25"] },
      { id: "24", name: "Photosensitivity", category: "DERMATOLOGICAL", x: 50, y: 90, severity: 4, confidence: 81, iconName: "Sun", colorScheme: "fuchsia", relatedConditions: ["Lupus", "Porphyria", "Medication"], connections: ["22", "26"] },
      { id: "25", name: "Bloating", category: "GASTROINTESTINAL", x: 6, y: 35, severity: 3, confidence: 87, iconName: "Expand", colorScheme: "yellow", relatedConditions: ["IBS", "SIBO", "Food Intolerance"], connections: ["23", "27"] },
      { id: "26", name: "Hair Loss", category: "DERMATOLOGICAL", x: 45, y: 95, severity: 3, confidence: 83, iconName: "Scissors", colorScheme: "fuchsia", relatedConditions: ["Thyroid", "Alopecia", "Stress"], connections: ["24", "28"] },
      { id: "27", name: "Heartburn", category: "GASTROINTESTINAL", x: 12, y: 30, severity: 3, confidence: 93, iconName: "Flame", colorScheme: "yellow", relatedConditions: ["GERD", "Hiatal Hernia", "Ulcer"], connections: ["25", "29"] },
      { id: "28", name: "Dry Skin", category: "DERMATOLOGICAL", x: 38, y: 92, severity: 2, confidence: 85, iconName: "Droplet", colorScheme: "fuchsia", relatedConditions: ["Hypothyroidism", "Dehydration", "Eczema"], connections: ["26", "30"] },
      { id: "29", name: "Difficulty Swallowing", category: "GASTROINTESTINAL", x: 18, y: 25, severity: 5, confidence: 84, iconName: "ArrowRight", colorScheme: "yellow", relatedConditions: ["Achalasia", "Stricture", "Stroke"], connections: ["27", "31"] },
      { id: "30", name: "Brittle Nails", category: "DERMATOLOGICAL", x: 32, y: 88, severity: 2, confidence: 79, iconName: "GripVertical", colorScheme: "fuchsia", relatedConditions: ["Iron Deficiency", "Hypothyroidism", "Psoriasis"], connections: ["28", "32"] },
      { id: "31", name: "Hoarseness", category: "RESPIRATORY", x: 25, y: 20, severity: 4, confidence: 88, iconName: "MicOff", colorScheme: "cyan", relatedConditions: ["Laryngitis", "Thyroid", "Laryngeal Cancer"], connections: ["29", "33"] },
      { id: "32", name: "Cold Intolerance", category: "METABOLIC", x: 28, y: 75, severity: 3, confidence: 86, iconName: "Snowflake", colorScheme: "amber", relatedConditions: ["Hypothyroidism", "Anemia", "Circulation"], connections: ["30", "7"] },
      { id: "33", name: "Wheezing", category: "RESPIRATORY", x: 35, y: 15, severity: 6, confidence: 91, iconName: "Wind", colorScheme: "cyan", relatedConditions: ["Asthma", "COPD", "Heart Failure"], connections: ["31", "2"] },
    ];

    const diagnosisClusters = [
      {
        id: "c1",
        name: "Cardiovascular Syndrome",
        probability: 78,
        symptoms: ["Chest Pain", "Shortness of Breath", "Palpitations", "Fatigue"],
        urgency: "HIGH",
        recommendedTests: ["ECG", "Troponin", "Echocardiogram", "Stress Test"],
        aiConfidence: 89,
      },
      {
        id: "c2",
        name: "Metabolic Disorder",
        probability: 65,
        symptoms: ["Increased Thirst", "Frequent Urination", "Fatigue", "Weight Loss"],
        urgency: "MEDIUM",
        recommendedTests: ["HbA1c", "Fasting Glucose", "Insulin Level", "C-Peptide"],
        aiConfidence: 92,
      },
      {
        id: "c3",
        name: "Autoimmune Pattern",
        probability: 43,
        symptoms: ["Joint Pain", "Rash", "Fatigue", "Swollen Lymph Nodes"],
        urgency: "MEDIUM",
        recommendedTests: ["ANA", "RF", "Anti-CCP", "ESR/CRP"],
        aiConfidence: 76,
      },
    ];

    return NextResponse.json({
      success: true,
      data: {
        nodes: symptomNodes,
        clusters: diagnosisClusters,
        totalNodes: symptomNodes.length,
        totalConnections: symptomNodes.reduce((acc, node) => acc + node.connections.length, 0),
      },
    });
  } catch (error) {
    console.error("Error fetching symptom mapper data:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch symptom mapper data",
        },
      },
      { status: 500 }
    );
  }
}

// POST /api/symptom-mapper - Analyze selected symptoms
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
    const { selectedSymptoms, patientId } = body;

    // Mock AI analysis
    const analysis = {
      identifiedClusters: [
        {
          clusterId: "c1",
          name: "Cardiovascular Syndrome",
          matchProbability: 78,
          matchingSymptoms: selectedSymptoms.filter((s: string) => ["1", "2", "4", "3"].includes(s)),
        },
      ],
      differentialDiagnosis: [
        { diagnosis: "Angina Pectoris", probability: 45 },
        { diagnosis: "Anxiety Disorder", probability: 30 },
        { diagnosis: "Costochondritis", probability: 15 },
      ],
      recommendedTests: ["ECG", "Troponin I", "CBC", "Thyroid Panel"],
      aiConfidence: 87,
    };

    return NextResponse.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error("Error analyzing symptoms:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to analyze symptoms",
        },
      },
      { status: 500 }
    );
  }
}
