import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/index";

// POST /api/voice/sessions - Start new voice session
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
    const { sessionType, activationWord, patientId } = body;

    // Create session
    const voiceSession = {
      id: `vs-${Date.now()}`,
      providerId: (session.user as any).id || session.user.email,
      sessionType: sessionType || "GENERAL",
      activationWord: activationWord || "Metta",
      patientId: patientId || null,
      transcript: "",
      commandsExecuted: [],
      durationMs: 0,
      accuracyScore: null,
      commandsCount: 0,
      successfulCommands: 0,
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
    };

    // TODO: Save to database
    // await prisma.voiceCommandSession.create({ data: voiceSession });

    return NextResponse.json({
      success: true,
      data: voiceSession,
    });
  } catch (error) {
    console.error("Error creating voice session:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to create session" } },
      { status: 500 }
    );
  }
}

// GET /api/voice/sessions - Get voice sessions
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
    const providerId = searchParams.get("providerId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    // Mock data - replace with database query
    const sessions = [
      {
        id: "vs-1",
        providerId: (session.user as any).id || session.user.email,
        sessionType: "AI_SCRIBE",
        activationWord: "Metta",
        durationMs: 1250000,
        commandsCount: 15,
        successfulCommands: 14,
        accuracyScore: 0.94,
        status: "COMPLETED",
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: "vs-2",
        providerId: (session.user as any).id || session.user.email,
        sessionType: "VOICE_CHART",
        activationWord: "Metta",
        durationMs: 450000,
        commandsCount: 8,
        successfulCommands: 8,
        accuracyScore: 0.97,
        status: "COMPLETED",
        createdAt: new Date(Date.now() - 7200000).toISOString(),
      },
    ];

    return NextResponse.json({
      success: true,
      data: sessions,
      count: sessions.length,
    });
  } catch (error) {
    console.error("Error fetching voice sessions:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch sessions" } },
      { status: 500 }
    );
  }
}
