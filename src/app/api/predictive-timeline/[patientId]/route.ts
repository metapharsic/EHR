import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/index";
import { hasPermission } from "@/lib/auth/roles";

// GET /api/predictive-timeline/[patientId] - Get patient's predictive health timeline
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
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get("range") || "1y";

    // Mock predictive timeline data
    const timeline = {
      id: "pt-" + patientId,
      patientId,
      timeRange,
      predictionModel: "ensemble-v2",
      currentHealthScore: 87.4,
      trajectory: "IMPROVING",
      dataPoints: [
        { month: "Jan", year: 2024, date: "2024-01-01", actualScore: 82, predictedScore: 82, optimisticScore: 82, pessimisticScore: 82, interventionCount: 0, isProjected: false },
        { month: "Feb", year: 2024, date: "2024-02-01", actualScore: 83, predictedScore: 84, optimisticScore: 86, pessimisticScore: 81, interventionCount: 1, isProjected: false },
        { month: "Mar", year: 2024, date: "2024-03-01", actualScore: 85, predictedScore: 86, optimisticScore: 89, pessimisticScore: 83, interventionCount: 0, isProjected: false },
        { month: "Apr", year: 2024, date: "2024-04-01", actualScore: 84, predictedScore: 87, optimisticScore: 91, pessimisticScore: 84, interventionCount: 2, isProjected: false },
        { month: "May", year: 2024, date: "2024-05-01", actualScore: 86, predictedScore: 88, optimisticScore: 93, pessimisticScore: 85, interventionCount: 1, isProjected: false },
        { month: "Jun", year: 2024, date: "2024-06-01", actualScore: 88, predictedScore: 89, optimisticScore: 94, pessimisticScore: 86, interventionCount: 0, isProjected: false },
        { month: "Jul", year: 2024, date: "2024-07-01", actualScore: null, predictedScore: 90, optimisticScore: 95, pessimisticScore: 87, interventionCount: 1, isProjected: true },
        { month: "Aug", year: 2024, date: "2024-08-01", actualScore: null, predictedScore: 91, optimisticScore: 96, pessimisticScore: 88, interventionCount: 0, isProjected: true },
        { month: "Sep", year: 2024, date: "2024-09-01", actualScore: null, predictedScore: 92, optimisticScore: 97, pessimisticScore: 89, interventionCount: 1, isProjected: true },
        { month: "Oct", year: 2024, date: "2024-10-01", actualScore: null, predictedScore: 93, optimisticScore: 98, pessimisticScore: 90, interventionCount: 0, isProjected: true },
        { month: "Nov", year: 2024, date: "2024-11-01", actualScore: null, predictedScore: 94, optimisticScore: 99, pessimisticScore: 91, interventionCount: 1, isProjected: true },
        { month: "Dec", year: 2024, date: "2024-12-01", actualScore: null, predictedScore: 95, optimisticScore: 100, pessimisticScore: 92, interventionCount: 0, isProjected: true },
      ],
      predictedEvents: [
        {
          id: "evt-1",
          title: "Diabetes Risk Assessment",
          description: "AI predicts 23% risk of Type 2 diabetes within 5 years based on current trajectory",
          eventType: "PREDICTION",
          predictedDate: "2024-07-15",
          dateRangeStart: "2024-07-01",
          dateRangeEnd: "2024-08-01",
          probability: 23,
          confidenceScore: 89,
          impactLevel: "HIGH",
          category: "Metabolic",
          isActionable: true,
          recommendedActions: ["Lifestyle counseling", "HbA1c screening", "Nutritionist referral"],
          occurred: false,
        },
        {
          id: "evt-2",
          title: "Preventive Care Window",
          description: "Optimal intervention period for lifestyle modifications to reduce cardiovascular risk",
          eventType: "INTERVENTION",
          predictedDate: "2024-08-01",
          probability: 94,
          confidenceScore: 94,
          impactLevel: "HIGH",
          category: "Cardiovascular",
          isActionable: true,
          recommendedActions: ["Exercise program", "Diet modification", "Stress management"],
          occurred: false,
        },
        {
          id: "evt-3",
          title: "Pharmacogenomic Alert",
          description: "Genetic markers suggest higher efficacy for alternative statin therapy",
          eventType: "GENETIC",
          predictedDate: "2024-09-20",
          probability: 87,
          confidenceScore: 87,
          impactLevel: "MEDIUM",
          category: "Genomics",
          isActionable: true,
          recommendedActions: ["Genetic testing", "Medication review", "Pharmacist consultation"],
          occurred: false,
        },
        {
          id: "evt-4",
          title: "Health Goal Projection",
          description: "Projected achievement of target BMI with current intervention plan",
          eventType: "MILESTONE",
          predictedDate: "2024-10-15",
          probability: 78,
          confidenceScore: 78,
          impactLevel: "MEDIUM",
          category: "Wellness",
          isActionable: false,
          recommendedActions: [],
          occurred: false,
        },
        {
          id: "evt-5",
          title: "Seasonal Risk Alert",
          description: "Historical data predicts increased respiratory vulnerability during flu season",
          eventType: "RISK",
          predictedDate: "2024-11-30",
          probability: 82,
          confidenceScore: 82,
          impactLevel: "MEDIUM",
          category: "Immunology",
          isActionable: true,
          recommendedActions: ["Flu vaccination", "Immune support", "Preventive care"],
          occurred: false,
        },
      ],
      interventions: [
        {
          id: "int-1",
          interventionType: "Medication Adjustment",
          description: "Started on Metformin 500mg daily",
          plannedDate: "2024-02-15",
          completedDate: "2024-02-15",
          expectedImpact: 5,
          actualImpact: 4,
          status: "COMPLETED",
        },
        {
          id: "int-2",
          interventionType: "Lifestyle Program",
          description: "Enrolled in cardiac rehabilitation",
          plannedDate: "2024-04-01",
          completedDate: "2024-04-01",
          expectedImpact: 8,
          actualImpact: 6,
          status: "COMPLETED",
        },
        {
          id: "int-3",
          interventionType: "Dietary Counseling",
          description: "Mediterranean diet plan initiation",
          plannedDate: "2024-07-01",
          completedDate: null,
          expectedImpact: 6,
          actualImpact: null,
          status: "IN_PROGRESS",
        },
      ],
    };

    return NextResponse.json({
      success: true,
      data: timeline,
    });
  } catch (error) {
    console.error("Error fetching predictive timeline:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch predictive timeline",
        },
      },
      { status: 500 }
    );
  }
}

// POST /api/predictive-timeline/[patientId] - Create intervention marker
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

    const { patientId } = params;
    const body = await request.json();

    // Mock create intervention
    const intervention = {
      id: "int-" + Date.now(),
      patientId,
      ...body,
      status: "PLANNED",
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: intervention,
    });
  } catch (error) {
    console.error("Error creating intervention:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to create intervention",
        },
      },
      { status: 500 }
    );
  }
}
