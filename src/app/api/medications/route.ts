import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/index";

// Mock medication inventory
const MEDICATION_INVENTORY = [
  {
    id: "med-1",
    name: "Lisinopril",
    genericName: "Lisinopril",
    brandName: "Prinivil",
    category: "ANTIHYPERTENSIVE",
    therapeuticClass: "ACE Inhibitor",
    strength: "10mg",
    dosageForm: "TABLET",
    stockQuantity: 500,
    unitPrice: 15.99,
    manufacturer: "Merck",
    indications: ["Hypertension", "Heart Failure", "Post-MI"],
    contraindications: ["Pregnancy", "ACE inhibitor allergy", "Angioedema history"],
    sideEffects: ["Cough", "Dizziness", "Hyperkalemia"],
    drugInteractions: ["NSAIDs", "Potassium supplements", "Diuretics"],
    prescriptionCount: 1250,
    averageRating: 4.2,
  },
  {
    id: "med-2",
    name: "Amlodipine",
    genericName: "Amlodipine",
    brandName: "Norvasc",
    category: "ANTIHYPERTENSIVE",
    therapeuticClass: "Calcium Channel Blocker",
    strength: "5mg",
    dosageForm: "TABLET",
    stockQuantity: 450,
    unitPrice: 18.50,
    manufacturer: "Pfizer",
    indications: ["Hypertension", "Angina"],
    contraindications: ["Severe aortic stenosis"],
    sideEffects: ["Peripheral edema", "Dizziness", "Flushing"],
    drugInteractions: ["Simvastatin", "CYP3A4 inhibitors"],
    prescriptionCount: 980,
    averageRating: 4.0,
  },
  {
    id: "med-3",
    name: "Metformin",
    genericName: "Metformin",
    brandName: "Glucophage",
    category: "DIABETES",
    therapeuticClass: "Biguanide",
    strength: "500mg",
    dosageForm: "TABLET",
    stockQuantity: 800,
    unitPrice: 12.99,
    manufacturer: "Bristol-Myers Squibb",
    indications: ["Type 2 Diabetes", "PCOS", "Prediabetes"],
    contraindications: ["Severe kidney disease", "Metabolic acidosis", "Severe infection"],
    sideEffects: ["GI upset", "Diarrhea", "B12 deficiency"],
    drugInteractions: ["Contrast dye", "Alcohol"],
    prescriptionCount: 2100,
    averageRating: 4.5,
  },
  {
    id: "med-4",
    name: "Atorvastatin",
    genericName: "Atorvastatin",
    brandName: "Lipitor",
    category: "CARDIOVASCULAR",
    therapeuticClass: "Statin",
    strength: "20mg",
    dosageForm: "TABLET",
    stockQuantity: 600,
    unitPrice: 25.00,
    manufacturer: "Pfizer",
    indications: ["High cholesterol", "Cardiovascular prevention"],
    contraindications: ["Active liver disease", "Pregnancy"],
    sideEffects: ["Muscle pain", "Liver enzyme elevation"],
    drugInteractions: ["Grapefruit", "CYP3A4 inhibitors"],
    prescriptionCount: 1850,
    averageRating: 4.3,
  },
  {
    id: "med-5",
    name: "Amoxicillin",
    genericName: "Amoxicillin",
    brandName: "Amoxil",
    category: "ANTIBIOTIC",
    therapeuticClass: "Penicillin",
    strength: "500mg",
    dosageForm: "CAPSULE",
    stockQuantity: 1000,
    unitPrice: 8.99,
    manufacturer: "Various",
    indications: ["Bacterial infections", "Ear infections", "Strep throat"],
    contraindications: ["Penicillin allergy"],
    sideEffects: ["Diarrhea", "Rash", "Nausea"],
    drugInteractions: ["Probenecid", "Allopurinol"],
    prescriptionCount: 3200,
    averageRating: 4.1,
  },
  {
    id: "med-6",
    name: "Ibuprofen",
    genericName: "Ibuprofen",
    brandName: "Advil",
    category: "ANTIINFLAMMATORY",
    therapeuticClass: "NSAID",
    strength: "400mg",
    dosageForm: "TABLET",
    stockQuantity: 2000,
    unitPrice: 5.99,
    manufacturer: "Pfizer",
    indications: ["Pain", "Inflammation", "Fever"],
    contraindications: ["GI bleeding history", "Severe kidney disease"],
    sideEffects: ["Stomach upset", "GI bleeding", "Kidney damage"],
    drugInteractions: ["Anticoagulants", "ACE inhibitors"],
    prescriptionCount: 4500,
    averageRating: 3.9,
  },
  {
    id: "med-7",
    name: "Sertraline",
    genericName: "Sertraline",
    brandName: "Zoloft",
    category: "ANTIDEPRESSANT",
    therapeuticClass: "SSRI",
    strength: "50mg",
    dosageForm: "TABLET",
    stockQuantity: 400,
    unitPrice: 22.50,
    manufacturer: "Pfizer",
    indications: ["Depression", "Anxiety", "OCD", "PTSD"],
    contraindications: ["MAO inhibitor use", "Pimozide"],
    sideEffects: ["Nausea", "Insomnia", "Sexual dysfunction"],
    drugInteractions: ["MAOIs", "Pimozide", "Warfarin"],
    prescriptionCount: 1650,
    averageRating: 4.0,
  },
  {
    id: "med-8",
    name: "Albuterol",
    genericName: "Albuterol",
    brandName: "ProAir",
    category: "RESPIRATORY",
    therapeuticClass: "Beta-2 Agonist",
    strength: "90mcg",
    dosageForm: "INHALER",
    stockQuantity: 350,
    unitPrice: 35.00,
    manufacturer: "Teva",
    indications: ["Asthma", "COPD", "Bronchospasm"],
    contraindications: ["Hypersensitivity to albuterol"],
    sideEffects: ["Tremor", "Tachycardia", "Nervousness"],
    drugInteractions: ["Beta-blockers", "MAOIs"],
    prescriptionCount: 1400,
    averageRating: 4.4,
  },
];

// GET /api/medications - Search medication inventory
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.toLowerCase() || "";
    const indication = searchParams.get("indication")?.toLowerCase() || "";
    const category = searchParams.get("category") || "";

    let medications = [...MEDICATION_INVENTORY];

    // Filter by search query
    if (query) {
      medications = medications.filter(med => 
        med.name.toLowerCase().includes(query) ||
        med.genericName.toLowerCase().includes(query) ||
        med.therapeuticClass.toLowerCase().includes(query) ||
        med.indications.some(ind => ind.toLowerCase().includes(query))
      );
    }

    // Filter by indication
    if (indication) {
      medications = medications.filter(med =>
        med.indications.some(ind => ind.toLowerCase().includes(indication))
      );
    }

    // Filter by category
    if (category) {
      medications = medications.filter(med => med.category === category);
    }

    return NextResponse.json({
      success: true,
      data: medications,
      count: medications.length,
    });
  } catch (error) {
    console.error("Error fetching medications:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch medications" } },
      { status: 500 }
    );
  }
}

// POST /api/medications/suggest - AI-powered medication suggestions
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
    const { symptoms, diagnosis, transcript, patientAllergies = [], currentMedications = [] } = body;

    // AI matching algorithm
    const suggestions = MEDICATION_INVENTORY.map(med => {
      let score = 0;
      const reasons: string[] = [];

      // Match by diagnosis
      if (diagnosis) {
        const diagnosisLower = diagnosis.toLowerCase();
        med.indications.forEach(ind => {
          if (ind.toLowerCase().includes(diagnosisLower) || diagnosisLower.includes(ind.toLowerCase())) {
            score += 40;
            reasons.push(`Treats ${ind}`);
          }
        });
      }

      // Match by symptoms
      if (symptoms && symptoms.length > 0) {
        symptoms.forEach((symptom: string) => {
          const symptomLower = symptom.toLowerCase();
          med.indications.forEach(ind => {
            if (ind.toLowerCase().includes(symptomLower)) {
              score += 20;
              reasons.push(`Addresses ${symptom}`);
            }
          });
        });
      }

      // Check contraindications
      const allergyConflict = patientAllergies.some((allergy: string) =>
        med.contraindications.some(cont => cont.toLowerCase().includes(allergy.toLowerCase()))
      );
      if (allergyConflict) {
        score -= 100;
        reasons.push("⚠️ Allergy warning");
      }

      // Check drug interactions
      const interactionWarning = currentMedications.some((medName: string) =>
        med.drugInteractions.some(interaction => 
          interaction.toLowerCase().includes(medName.toLowerCase())
        )
      );
      if (interactionWarning) {
        score -= 50;
        reasons.push("⚠️ Possible interaction");
      }

      // Boost by popularity/rating
      score += (med.averageRating || 3) * 5;
      score += Math.min(med.prescriptionCount / 100, 10);

      // Stock availability bonus
      if (med.stockQuantity > 100) {
        score += 5;
        reasons.push("✓ In stock");
      } else if (med.stockQuantity < 20) {
        score -= 10;
        reasons.push("⚠️ Low stock");
      }

      const uniqueReasons: string[] = [];
      reasons.forEach(r => {
        if (!uniqueReasons.includes(r)) uniqueReasons.push(r);
      });
      
      return {
        medication: med,
        confidenceScore: Math.min(Math.max(score, 0), 100),
        reasons: uniqueReasons,
        alternatives: [] as { medication: typeof med; reason: string }[],
      };
    });

    // Sort by confidence and filter out conflicts
    const sortedSuggestions = suggestions
      .filter(s => s.confidenceScore > 10)
      .sort((a, b) => b.confidenceScore - a.confidenceScore)
      .slice(0, 5);

    // Find alternatives for top suggestion
    if (sortedSuggestions.length > 0) {
      const topMed = sortedSuggestions[0].medication;
      const alternatives = MEDICATION_INVENTORY
        .filter(med => 
          med.id !== topMed.id &&
          med.therapeuticClass === topMed.therapeuticClass
        )
        .slice(0, 3)
        .map(med => ({
          medication: med,
          reason: `Same class as ${topMed.name}`,
        }));

      sortedSuggestions[0] = { ...sortedSuggestions[0], alternatives };
    }

    return NextResponse.json({
      success: true,
      data: {
        suggestions: sortedSuggestions,
        basedOn: {
          symptoms,
          diagnosis,
          transcriptLength: transcript?.length || 0,
        },
      },
    });
  } catch (error) {
    console.error("Error suggesting medications:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to suggest medications" } },
      { status: 500 }
    );
  }
}
