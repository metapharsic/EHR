import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/index";

// GET /api/ai-dashboard - Get AI dashboard data (insights, metrics, voice status)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // Mock AI insights
    const aiInsights = [
      {
        id: "ins-1",
        insightType: "RISK_ALERT",
        title: "Cardiovascular Risk Detected",
        description: "Patient's recent ECG shows early signs of atrial fibrillation. Recommend cardiology consultation within 48 hours.",
        confidenceScore: 94,
        severity: "HIGH",
        category: "Cardiovascular",
        isActionable: true,
        suggestedActions: ["Schedule cardiology", "Order Holter monitor", "Review medications"],
        status: "ACTIVE",
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: "ins-2",
        insightType: "SUGGESTION",
        title: "Preventive Care Opportunity",
        description: "Patient due for annual wellness visit. AI suggests scheduling based on optimal health window prediction.",
        confidenceScore: 89,
        severity: "MEDIUM",
        category: "Preventive",
        isActionable: true,
        suggestedActions: ["Schedule wellness visit", "Order preventive labs", "Update vaccinations"],
        status: "ACTIVE",
        createdAt: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        id: "ins-3",
        insightType: "PREDICTION",
        title: "Medication Adherence Forecast",
        description: "AI predicts 87% medication adherence based on refill patterns. Consider adherence counseling.",
        confidenceScore: 91,
        severity: "LOW",
        category: "Medication",
        isActionable: true,
        suggestedActions: ["Review medication regimen", "Discuss barriers", "Consider pill organizer"],
        status: "ACTIVE",
        createdAt: new Date(Date.now() - 10800000).toISOString(),
      },
      {
        id: "ins-4",
        insightType: "ANOMALY",
        title: "Lab Value Anomaly",
        description: "Unexpected spike in HbA1c despite stable glucose logs. Possible measurement error or compliance issue.",
        confidenceScore: 86,
        severity: "MEDIUM",
        category: "Metabolic",
        isActionable: true,
        suggestedActions: ["Repeat HbA1c", "Review glucometer logs", "Assess compliance"],
        status: "ACTIVE",
        createdAt: new Date(Date.now() - 14400000).toISOString(),
      },
      {
        id: "ins-5",
        insightType: "OPPORTUNITY",
        title: "Genomic Test Results Available",
        description: "Pharmacogenomic analysis complete. 3 actionable drug-gene interactions identified.",
        confidenceScore: 98,
        severity: "MEDIUM",
        category: "Genomics",
        isActionable: true,
        suggestedActions: ["Review PGx report", "Adjust medications", "Patient education"],
        status: "ACTIVE",
        createdAt: new Date(Date.now() - 18000000).toISOString(),
      },
    ];

    // Mock live metrics
    const liveMetrics = [
      {
        id: "metric-1",
        metricName: "activePatients",
        displayName: "Active Patients",
        currentValue: "1,247",
        numericValue: 1247,
        changeValue: "+23",
        changeDirection: "UP",
        iconName: "Users",
        colorScheme: "cyan",
        lastUpdated: new Date().toISOString(),
      },
      {
        id: "metric-2",
        metricName: "aiInsights",
        displayName: "AI Insights Today",
        currentValue: "156",
        numericValue: 156,
        changeValue: "+12",
        changeDirection: "UP",
        iconName: "Brain",
        colorScheme: "purple",
        lastUpdated: new Date().toISOString(),
      },
      {
        id: "metric-3",
        metricName: "alerts",
        displayName: "Critical Alerts",
        currentValue: "8",
        numericValue: 8,
        changeValue: "-3",
        changeDirection: "DOWN",
        iconName: "AlertTriangle",
        colorScheme: "rose",
        lastUpdated: new Date().toISOString(),
      },
      {
        id: "metric-4",
        metricName: "appointments",
        displayName: "Today's Appointments",
        currentValue: "42",
        numericValue: 42,
        changeValue: "+5",
        changeDirection: "UP",
        iconName: "Calendar",
        colorScheme: "emerald",
        lastUpdated: new Date().toISOString(),
      },
    ];

    // Mock voice command status
    const voiceStatus = {
      isListening: false,
      lastCommand: "Show patient John Smith's records",
      lastCommandTime: new Date(Date.now() - 300000).toISOString(),
      availableCommands: [
        "Show patient [name]",
        "Schedule appointment",
        "Order lab tests",
        "Open scribe",
        "Show dashboard",
        "Search symptoms",
      ],
    };

    // Mock predictive scheduling
    const predictiveSchedule = [
      {
        id: "ps-1",
        patientId: "p-123",
        patientName: "Sarah Johnson",
        appointmentTime: "09:00 AM",
        aiPrepared: true,
        insights: ["Diabetes follow-up", "HbA1c trending up", "Medication adherence 94%"],
        riskScore: 23,
        suggestedTopics: ["Diet counseling", "Exercise plan", "Medication review"],
      },
      {
        id: "ps-2",
        patientId: "p-456",
        patientName: "Michael Chen",
        appointmentTime: "10:30 AM",
        aiPrepared: true,
        insights: ["Post-op cardiac surgery", "Recovery on track", "Physical therapy progressing"],
        riskScore: 15,
        suggestedTopics: ["Recovery assessment", "Cardiac rehab", "Medication adjustment"],
      },
      {
        id: "ps-3",
        patientId: "p-789",
        patientName: "Emily Rodriguez",
        appointmentTime: "02:00 PM",
        aiPrepared: true,
        insights: ["New patient intake", "Genomic profile pending", "Family history of CVD"],
        riskScore: 45,
        suggestedTopics: ["Comprehensive assessment", "Genetic counseling", "Prevention planning"],
      },
    ];

    return NextResponse.json({
      success: true,
      data: {
        insights: aiInsights,
        metrics: liveMetrics,
        voiceStatus,
        predictiveSchedule,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching AI dashboard data:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch AI dashboard data",
        },
      },
      { status: 500 }
    );
  }
}

// POST /api/ai-dashboard/insights/[insightId]/acknowledge - Acknowledge an insight
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
    const { insightId, action } = body;

    // Mock acknowledge
    return NextResponse.json({
      success: true,
      data: {
        insightId,
        status: action === "acknowledge" ? "ACKNOWLEDGED" : "DISMISSED",
        acknowledgedAt: new Date().toISOString(),
        acknowledgedBy: session.user.name || "Unknown",
      },
    });
  } catch (error) {
    console.error("Error acknowledging insight:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to acknowledge insight",
        },
      },
      { status: 500 }
    );
  }
}
