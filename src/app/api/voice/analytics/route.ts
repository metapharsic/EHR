import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/index";

// GET /api/voice/analytics - Get voice analytics for PowerBI
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
    const period = searchParams.get("period") || "today"; // today, week, month
    const groupBy = searchParams.get("groupBy") || "day"; // hour, day, week, month

    // Generate analytics data for PowerBI
    const analytics = generateAnalyticsData(period, groupBy);

    return NextResponse.json({
      success: true,
      data: analytics,
      metadata: {
        period,
        groupBy,
        generatedAt: new Date().toISOString(),
        schema: {
          date: "Date of metrics",
          totalCommands: "Total voice commands executed",
          successfulCommands: "Successfully processed commands",
          successRate: "Percentage of successful commands",
          voiceChartCount: "Voice Chart feature usage",
          dictateNotesCount: "Dictate Notes feature usage",
          aiScribeCount: "AI Scribe feature usage",
          autoDocumentCount: "Auto Document feature usage",
          smartSearchCount: "Smart Search feature usage",
          findPatientCount: "Find Patient feature usage",
          avgAccuracyScore: "Average voice recognition accuracy",
          avgProcessingTimeMs: "Average command processing time",
          activeProviders: "Number of providers using voice",
          totalDurationMs: "Total session duration",
        },
      },
    });
  } catch (error) {
    console.error("Error fetching voice analytics:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch analytics" } },
      { status: 500 }
    );
  }
}

// POST /api/voice/analytics/export - Export for PowerBI
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
    const { format = "json", dateFrom, dateTo } = body;

    // Generate export data
    const data = generateExportData(dateFrom, dateTo);

    if (format === "csv") {
      const csv = convertToCSV(data);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="voice-analytics-${dateFrom}-${dateTo}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data,
      exportInfo: {
        format,
        recordCount: data.length,
        dateRange: { from: dateFrom, to: dateTo },
      },
    });
  } catch (error) {
    console.error("Error exporting analytics:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to export analytics" } },
      { status: 500 }
    );
  }
}

// Generate mock analytics data
function generateAnalyticsData(period: string, groupBy: string) {
  const data = [];
  const now = new Date();
  let days = 1;
  
  if (period === "week") days = 7;
  if (period === "month") days = 30;

  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    const totalCommands = Math.floor(Math.random() * 100) + 50;
    const successfulCommands = Math.floor(totalCommands * (0.9 + Math.random() * 0.09));
    
    data.push({
      date: date.toISOString().split("T")[0],
      totalCommands,
      successfulCommands,
      successRate: Math.round((successfulCommands / totalCommands) * 100),
      voiceChartCount: Math.floor(Math.random() * 20) + 5,
      dictateNotesCount: Math.floor(Math.random() * 30) + 10,
      aiScribeCount: Math.floor(Math.random() * 15) + 3,
      autoDocumentCount: Math.floor(Math.random() * 10) + 2,
      smartSearchCount: Math.floor(Math.random() * 25) + 8,
      findPatientCount: Math.floor(Math.random() * 35) + 12,
      avgAccuracyScore: 0.90 + Math.random() * 0.09,
      avgProcessingTimeMs: Math.floor(Math.random() * 500) + 200,
      activeProviders: Math.floor(Math.random() * 10) + 5,
      totalDurationMs: Math.floor(Math.random() * 3600000) + 1800000,
    });
  }

  return data.reverse();
}

// Generate detailed export data
function generateExportData(dateFrom?: string, dateTo?: string) {
  const data = [];
  const providers = ["Dr. Smith", "Dr. Johnson", "Dr. Williams", "Dr. Brown", "Dr. Davis"];
  const modes = ["VOICE_CHART", "DICTATE_NOTES", "AI_SCRIBE", "AUTO_DOCUMENT", "SMART_SEARCH", "FIND_PATIENT"];
  
  for (let i = 0; i < 100; i++) {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 30));
    
    data.push({
      id: `cmd-${i}`,
      timestamp: date.toISOString(),
      date: date.toISOString().split("T")[0],
      hour: date.getHours(),
      provider: providers[Math.floor(Math.random() * providers.length)],
      providerId: `prov-${Math.floor(Math.random() * 5)}`,
      mode: modes[Math.floor(Math.random() * modes.length)],
      command: `Sample command ${i}`,
      success: Math.random() > 0.1,
      processingTimeMs: Math.floor(Math.random() * 500) + 100,
      accuracyScore: 0.85 + Math.random() * 0.14,
      patientId: `pat-${Math.floor(Math.random() * 50)}`,
      sessionDurationMs: Math.floor(Math.random() * 60000) + 30000,
    });
  }

  return data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// Convert to CSV
function convertToCSV(data: any[]): string {
  if (data.length === 0) return "";
  
  const headers = Object.keys(data[0]);
  const rows = data.map(row => 
    headers.map(h => {
      const val = row[h];
      if (typeof val === "string" && val.includes(",")) {
        return `"${val}"`;
      }
      return val;
    }).join(",")
  );
  
  return [headers.join(","), ...rows].join("\n");
}
