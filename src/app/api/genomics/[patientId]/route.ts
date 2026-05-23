import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/index";

// GET /api/genomics/[patientId] - Get patient's genomic profile
export async function GET(
  request: NextRequest,
  { params }: { params: { patientId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { patientId } = params;

    // Mock genomic profile data
    const genomicProfile = {
      id: "genome-" + patientId,
      patientId,
      sampleId: "SAMPLE-2024-001",
      sampleType: "saliva",
      sequencedAt: "2024-01-15T10:30:00Z",
      geneticAge: 42.3,
      telomereLength: "normal",
      overallGeneticRisk: "LOW",
      
      geneVariants: [
        {
          id: "gv-1",
          geneName: "CYP2C19",
          rsId: "rs4244285",
          chromosome: "10",
          position: 96522463,
          referenceAllele: "G",
          alternateAllele: "A",
          zygosity: "HETEROZYGOUS",
          clinicalSignificance: "pharmacogenomic",
          associatedConditions: ["Clopidogrel metabolism"],
        },
        {
          id: "gv-2",
          geneName: "SLCO1B1",
          rsId: "rs4149056",
          chromosome: "12",
          position: 21331549,
          referenceAllele: "T",
          alternateAllele: "C",
          zygosity: "HETEROZYGOUS",
          clinicalSignificance: "pharmacogenomic",
          associatedConditions: ["Statin myopathy risk"],
        },
        {
          id: "gv-3",
          geneName: "APOE",
          rsId: "rs429358",
          chromosome: "19",
          position: 45411941,
          referenceAllele: "T",
          alternateAllele: "T",
          zygosity: "HOMOZYGOUS_REF",
          clinicalSignificance: "benign",
          associatedConditions: ["Alzheimer's disease risk"],
        },
        {
          id: "gv-4",
          geneName: "MTHFR",
          rsId: "rs1801133",
          chromosome: "1",
          position: 11856378,
          referenceAllele: "G",
          alternateAllele: "A",
          zygosity: "HETEROZYGOUS",
          clinicalSignificance: "likely benign",
          associatedConditions: ["Folate metabolism"],
        },
        {
          id: "gv-5",
          geneName: "FTO",
          rsId: "rs9939609",
          chromosome: "16",
          position: 53786615,
          referenceAllele: "T",
          alternateAllele: "A",
          zygosity: "HETEROZYGOUS",
          clinicalSignificance: "risk factor",
          associatedConditions: ["Obesity susceptibility"],
        },
      ],
      
      drugSensitivities: [
        {
          id: "ds-1",
          drugName: "Clopidogrel (Plavix)",
          drugClass: "Antiplatelet",
          sensitivityType: "EFFICACY",
          severity: "moderate",
          affectedGene: "CYP2C19",
          mechanism: "Poor metabolizer - reduced active metabolite formation",
          recommendation: "Consider alternative antiplatelet (prasugrel/ticagrelor)",
          alternativeDrugs: ["Prasugrel", "Ticagrelor"],
        },
        {
          id: "ds-2",
          drugName: "Simvastatin",
          drugClass: "Statin",
          sensitivityType: "ADVERSE_REACTION",
          severity: "mild",
          affectedGene: "SLCO1B1",
          mechanism: "Reduced hepatic uptake - increased plasma levels",
          recommendation: "Use lower dose or alternative statin",
          alternativeDrugs: ["Pravastatin", "Rosuvastatin"],
        },
        {
          id: "ds-3",
          drugName: "Warfarin",
          drugClass: "Anticoagulant",
          sensitivityType: "DOSAGE",
          severity: "moderate",
          affectedGene: "CYP2C9",
          mechanism: "Altered metabolism affects dosing requirements",
          recommendation: "Start with lower dose, monitor INR closely",
          alternativeDrugs: ["DOACs (apixaban, rivaroxaban)"],
        },
      ],
      
      traitPredictions: [
        {
          id: "gt-1",
          traitName: "Lactose Intolerance",
          traitCategory: "physical",
          predictedStatus: "likely present",
          confidence: 89,
          associatedVariants: ["MCM6 rs4988235"],
        },
        {
          id: "gt-2",
          traitName: "Caffeine Metabolism",
          traitCategory: "metabolic",
          predictedStatus: "fast metabolizer",
          confidence: 92,
          associatedVariants: ["CYP1A2 rs762551"],
        },
        {
          id: "gt-3",
          traitName: "Vitamin D Levels",
          traitCategory: "physical",
          predictedStatus: "lower baseline",
          confidence: 76,
          associatedVariants: ["GC rs2282679", "CYP2R1 rs10741657"],
        },
        {
          id: "gt-4",
          traitName: "Type 2 Diabetes Risk",
          traitCategory: "disease risk",
          predictedStatus: "1.3x average risk",
          confidence: 84,
          associatedVariants: ["TCF7L2 rs7903146", "FTO rs9939609"],
        },
      ],
      
      createdAt: "2024-01-15T10:30:00Z",
      updatedAt: "2024-02-20T14:45:00Z",
    };

    return NextResponse.json({
      success: true,
      data: genomicProfile,
    });
  } catch (error) {
    console.error("Error fetching genomic profile:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch genomic profile",
        },
      },
      { status: 500 }
    );
  }
}

// POST /api/genomics/[patientId] - Create or update genomic profile
export async function POST(
  request: NextRequest,
  { params }: { params: { patientId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { patientId } = params;
    const body = await request.json();

    // Mock create/update
    const profile = {
      id: "genome-" + patientId,
      patientId,
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error("Error updating genomic profile:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to update genomic profile",
        },
      },
      { status: 500 }
    );
  }
}
