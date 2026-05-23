import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/index";
import { hasPermission } from "@/lib/auth/roles";

// GET /api/digital-twin/[patientId] - Get patient's holographic digital twin
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

    if (!hasPermission(session.user.role as any, "patients:read")) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
        { status: 403 }
      );
    }

    const { patientId } = params;

    // Mock data - replace with actual database query
    const digitalTwin = {
      id: "dt-" + patientId,
      patientId,
      overallHealthScore: 87.4,
      lastUpdated: new Date().toISOString(),
      modelVersion: "2.1",
      scanMode: "FULL_BODY",
      organSystems: [
        {
          id: "os-1",
          name: "cardiovascular",
          displayName: "Cardiovascular",
          category: "cardiac",
          positionX: 0,
          positionY: 10,
          positionZ: 20,
          healthScore: 87,
          status: "MONITORING",
          aiInsight: "AI detected 12% improvement in cardiac output after medication adjustment",
          aiConfidence: 94,
          colorGradient: "from-rose-500 to-pink-500",
          iconName: "Heart",
          biomarkers: [
            { name: "Heart Rate", value: "72 bpm", numericValue: 72, unit: "bpm", trend: "STABLE", trendPercentage: 0 },
            { name: "Blood Pressure", value: "128/82", numericValue: 128, unit: "mmHg", trend: "DOWN", trendPercentage: -5 },
            { name: "Cholesterol", value: "195 mg/dL", numericValue: 195, unit: "mg/dL", trend: "DOWN", trendPercentage: -8 },
          ],
          connections: ["os-2", "os-3", "os-6"],
        },
        {
          id: "os-2",
          name: "neurological",
          displayName: "Neurological",
          category: "neurological",
          positionX: 0,
          positionY: -30,
          positionZ: 10,
          healthScore: 94,
          status: "HEALTHY",
          aiInsight: "Cognitive patterns stable. Sleep quality improved 23% this month",
          aiConfidence: 92,
          colorGradient: "from-purple-500 to-indigo-500",
          iconName: "Brain",
          biomarkers: [
            { name: "Reaction Time", value: "245ms", numericValue: 245, unit: "ms", trend: "STABLE", trendPercentage: 0 },
            { name: "Sleep Score", value: "87/100", numericValue: 87, unit: "score", trend: "UP", trendPercentage: 23 },
            { name: "Stress Index", value: "32", numericValue: 32, unit: "index", trend: "DOWN", trendPercentage: -15 },
          ],
          connections: ["os-1", "os-3", "os-8"],
        },
        {
          id: "os-3",
          name: "respiratory",
          displayName: "Respiratory",
          category: "respiratory",
          positionX: 0,
          positionY: 5,
          positionZ: 15,
          healthScore: 91,
          status: "HEALTHY",
          aiInsight: "Lung capacity optimal. No signs of respiratory distress detected",
          aiConfidence: 96,
          colorGradient: "from-cyan-500 to-blue-500",
          iconName: "Activity",
          biomarkers: [
            { name: "SpO2", value: "98%", numericValue: 98, unit: "%", trend: "STABLE", trendPercentage: 0 },
            { name: "Lung Capacity", value: "4.8L", numericValue: 4.8, unit: "L", trend: "UP", trendPercentage: 5 },
            { name: "Breathing Rate", value: "14/min", numericValue: 14, unit: "/min", trend: "STABLE", trendPercentage: 0 },
          ],
          connections: ["os-1", "os-5"],
        },
        {
          id: "os-4",
          name: "genetic",
          displayName: "Genomic Profile",
          category: "genetic",
          positionX: 25,
          positionY: 0,
          positionZ: 5,
          healthScore: 96,
          status: "HEALTHY",
          aiInsight: "Pharmacogenomic analysis complete. 3 drug sensitivities identified",
          aiConfidence: 98,
          colorGradient: "from-emerald-500 to-teal-500",
          iconName: "Dna",
          biomarkers: [
            { name: "Genetic Risk", value: "Low", numericValue: 20, unit: "score", trend: "STABLE", trendPercentage: 0 },
            { name: "Epigenetic Age", value: "42.3 yrs", numericValue: 42.3, unit: "years", trend: "DOWN", trendPercentage: -3 },
            { name: "Telomere Length", value: "Normal", numericValue: 85, unit: "percentile", trend: "STABLE", trendPercentage: 0 },
          ],
          connections: ["os-5", "os-6"],
        },
        {
          id: "os-5",
          name: "immune",
          displayName: "Immune System",
          category: "immunological",
          positionX: -25,
          positionY: 0,
          positionZ: 5,
          healthScore: 89,
          status: "MONITORING",
          aiInsight: "Autoimmune markers stable. Vaccination protection at 94%",
          aiConfidence: 91,
          colorGradient: "from-lime-500 to-green-500",
          iconName: "Shield",
          biomarkers: [
            { name: "WBC Count", value: "7.2 K/μL", numericValue: 7.2, unit: "K/μL", trend: "STABLE", trendPercentage: 0 },
            { name: "CRP", value: "1.2 mg/L", numericValue: 1.2, unit: "mg/L", trend: "DOWN", trendPercentage: -20 },
            { name: "IgG Levels", value: "Normal", numericValue: 95, unit: "percentile", trend: "STABLE", trendPercentage: 0 },
          ],
          connections: ["os-3", "os-4"],
        },
        {
          id: "os-6",
          name: "skeletal",
          displayName: "Musculoskeletal",
          category: "skeletal",
          positionX: 0,
          positionY: -40,
          positionZ: 0,
          healthScore: 78,
          status: "WARNING",
          aiInsight: "Early signs of osteoarthritis in left knee. Recommend PT consultation",
          aiConfidence: 84,
          colorGradient: "from-amber-500 to-orange-500",
          iconName: "Bone",
          biomarkers: [
            { name: "Bone Density", value: "0.85 g/cm²", numericValue: 0.85, unit: "g/cm²", trend: "STABLE", trendPercentage: 0 },
            { name: "Joint Mobility", value: "82%", numericValue: 82, unit: "%", trend: "DOWN", trendPercentage: -8 },
            { name: "Muscle Mass", value: "68%", numericValue: 68, unit: "%", trend: "STABLE", trendPercentage: 0 },
          ],
          connections: ["os-1", "os-4"],
        },
      ],
      particleConfig: {
        particleCount: 50,
        colorScheme: "cyan-purple",
        animationSpeed: 1.0,
        xRange: [-50, 50],
        yRange: [-50, 50],
        zRange: [-50, 50],
      },
      recentScans: [
        {
          id: "scan-1",
          scanType: "FULL_BODY",
          scanDuration: 120,
          findings: "No significant anomalies detected",
          anomaliesDetected: 0,
          aiConfidence: 96,
          startedAt: new Date(Date.now() - 86400000).toISOString(),
          completedAt: new Date(Date.now() - 86280000).toISOString(),
        },
      ],
    };

    return NextResponse.json({
      success: true,
      data: digitalTwin,
    });
  } catch (error) {
    console.error("Error fetching digital twin:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch digital twin data",
        },
      },
      { status: 500 }
    );
  }
}

// POST /api/digital-twin/[patientId] - Update digital twin configuration
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

    if (!hasPermission(session.user.role as any, "patients:update")) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { patientId } = params;

    // Mock update - replace with actual database update
    return NextResponse.json({
      success: true,
      data: {
        id: "dt-" + patientId,
        patientId,
        ...body,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error updating digital twin:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to update digital twin",
        },
      },
      { status: 500 }
    );
  }
}
