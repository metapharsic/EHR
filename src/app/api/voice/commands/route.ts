import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/index";

// POST /api/voice/commands - Log voice command
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
    const { command, mode, success, result, sessionId } = body;

    // Log command for analytics
    const commandLog = {
      id: `cmd-${Date.now()}`,
      sessionId,
      providerId: (session.user as any).id || session.user.email,
      command,
      mode,
      success,
      result,
      timestamp: new Date().toISOString(),
    };

    // TODO: Save to database
    // await prisma.voiceCommandLog.create({ data: commandLog });

    // Update analytics
    await updateVoiceAnalytics(mode, success);

    return NextResponse.json({
      success: true,
      data: commandLog,
    });
  } catch (error) {
    console.error("Error logging voice command:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to log command" } },
      { status: 500 }
    );
  }
}

// GET /api/voice/commands - Get command history
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
    const mode = searchParams.get("mode");
    const limit = parseInt(searchParams.get("limit") || "50");

    // Mock command history
    const commands = [
      {
        id: "cmd-1",
        command: "Metta, start charting for John Smith",
        mode: "VOICE_CHART",
        success: true,
        timestamp: new Date(Date.now() - 300000).toISOString(),
      },
      {
        id: "cmd-2",
        command: "Metta, dictate progress note",
        mode: "DICTATE_NOTES",
        success: true,
        timestamp: new Date(Date.now() - 600000).toISOString(),
      },
      {
        id: "cmd-3",
        command: "Metta, find patient with MRN 12345",
        mode: "FIND_PATIENT",
        success: true,
        timestamp: new Date(Date.now() - 900000).toISOString(),
      },
    ];

    return NextResponse.json({
      success: true,
      data: commands,
    });
  } catch (error) {
    console.error("Error fetching commands:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch commands" } },
      { status: 500 }
    );
  }
}

// Helper to update analytics
async function updateVoiceAnalytics(mode: string, success: boolean) {
  const today = new Date().toISOString().split("T")[0];
  
  // TODO: Update VoiceAnalyticsDaily record
  // This will be used for PowerBI dashboards
  const analyticsUpdate = {
    date: today,
    totalCommands: { increment: 1 },
    successfulCommands: success ? { increment: 1 } : undefined,
    [getModeCounterKey(mode)]: { increment: 1 },
  };
  
  console.log("Analytics update:", analyticsUpdate);
}

function getModeCounterKey(mode: string): string {
  const modeMap: Record<string, string> = {
    "VOICE_CHART": "voiceChartCount",
    "DICTATE_NOTES": "dictateNotesCount",
    "AI_SCRIBE": "aiScribeCount",
    "AUTO_DOCUMENT": "autoDocumentCount",
    "SMART_SEARCH": "smartSearchCount",
    "FIND_PATIENT": "findPatientCount",
  };
  return modeMap[mode] || "totalCommands";
}
