import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/index";

// GET /api/dashboard/metrics - Get real-time dashboard metrics
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
    const period = searchParams.get("period") || "today";

    // Calculate metrics based on period
    const metrics = await calculateMetrics(period);

    return NextResponse.json({
      success: true,
      data: metrics,
      period,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching dashboard metrics:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch metrics" } },
      { status: 500 }
    );
  }
}

// Calculate real-time metrics
async function calculateMetrics(period: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Mock data - Replace with actual database queries
  // In production, these would be:
  // await prisma.patientSession.count({ where: { status: "ACTIVE" } })
  // await prisma.aIPrediction.count({ where: { createdAt: { gte: today } } })
  // etc.

  const metrics = {
    // Active Patients
    activePatients: {
      value: 1284,
      change: 12,
      changePercent: 0.94,
      trend: "up",
      status: "live",
      link: "/patients/active",
      details: {
        inPerson: 892,
        telehealth: 312,
        pending: 80,
      },
    },

    // AI Predictions
    aiPredictions: {
      value: 48,
      change: 8,
      changePercent: 20,
      trend: "up",
      status: "live",
      link: "/ai/predictions",
      details: {
        highRisk: 12,
        mediumRisk: 18,
        lowRisk: 18,
        byType: {
          readmission: 15,
          sepsis: 8,
          fall: 10,
          noShow: 15,
        },
      },
    },

    // Risk Alerts
    riskAlerts: {
      value: 3,
      change: -2,
      changePercent: -40,
      trend: "down",
      status: "live",
      link: "/alerts",
      details: {
        critical: 1,
        high: 2,
        medium: 0,
        acknowledged: 12,
        resolved: 45,
      },
    },

    // Auto-Documented
    autoDocumented: {
      value: 156,
      change: 23,
      changePercent: 17.3,
      trend: "up",
      status: "live",
      link: "/documents/auto",
      details: {
        visitSummaries: 89,
        carePlans: 34,
        referralLetters: 23,
        dischargeNotes: 10,
      },
    },

    // Additional metrics for the dashboard
    voiceCommands: {
      value: 1247,
      change: 156,
      changePercent: 14.3,
      trend: "up",
      status: "live",
      link: "/voice",
      details: {
        voiceChart: 45,
        dictateNotes: 78,
        aiScribe: 32,
        smartSearch: 56,
      },
    },

    prescriptions: {
      value: 342,
      change: 28,
      changePercent: 8.9,
      trend: "up",
      status: "live",
      link: "/prescribe",
      details: {
        new: 198,
        renewals: 89,
        controlled: 55,
      },
    },

    // Time-based data for charts
    hourlyData: generateHourlyData(),
    
    // Recent activity
    recentActivity: generateRecentActivity(),
  };

  return metrics;
}

// Generate hourly data for charts
function generateHourlyData() {
  const data = [];
  for (let i = 0; i < 24; i++) {
    data.push({
      hour: i,
      activePatients: Math.floor(Math.random() * 200) + 1000,
      aiPredictions: Math.floor(Math.random() * 5),
      autoDocuments: Math.floor(Math.random() * 15),
      voiceCommands: Math.floor(Math.random() * 100),
    });
  }
  return data;
}

// Generate recent activity feed
function generateRecentActivity() {
  const activities = [
    { type: "prediction", message: "High readmission risk detected for Patient #12345", time: "2 min ago", severity: "high" },
    { type: "document", message: "Auto-generated visit summary for John Smith", time: "5 min ago", severity: "info" },
    { type: "voice", message: "Voice chart entry completed via Metta", time: "8 min ago", severity: "info" },
    { type: "alert", message: "Critical lab value alert acknowledged", time: "12 min ago", severity: "critical" },
    { type: "patient", message: "New patient admitted: Sarah Johnson", time: "15 min ago", severity: "info" },
    { type: "prescription", message: "Prescription sent to pharmacy for Lisinopril", time: "18 min ago", severity: "info" },
    { type: "prediction", message: "Sepsis risk alert for Patient #67890", time: "22 min ago", severity: "high" },
    { type: "document", message: "AI Scribe session completed - 15 min encounter", time: "25 min ago", severity: "info" },
  ];
  return activities;
}

// POST /api/dashboard/metrics/update - Update a metric (for internal use)
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
    const { metricKey, value, operation = "set" } = body;

    // TODO: Update metric in database
    // await prisma.dashboardMetric.update({
    //   where: { metricKey },
    //   data: { currentValue: value }
    // });

    return NextResponse.json({
      success: true,
      message: `Metric ${metricKey} updated`,
    });
  } catch (error) {
    console.error("Error updating metric:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to update metric" } },
      { status: 500 }
    );
  }
}
