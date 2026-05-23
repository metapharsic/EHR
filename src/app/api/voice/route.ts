import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/index";

// POST /api/voice - Process voice command
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
    const { audioData, transcript, sessionType, patientId } = body;

    // Mock voice command processing
    const commandResults = {
      commands: [
        {
          command: "show_patient",
          confidence: 0.94,
          parameters: { patientName: "John Smith" },
          action: "navigate",
          target: "/patients/p-123",
        },
      ],
      aiInterpretation: "User requested to view patient John Smith's records",
      success: true,
    };

    return NextResponse.json({
      success: true,
      data: {
        sessionId: "vs-" + Date.now(),
        userId: session.user.email,
        patientId,
        sessionType: sessionType || "COMMAND",
        audioDuration: audioData?.duration || 0,
        transcript,
        transcriptConfidence: 0.94,
        ...commandResults,
        startedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error processing voice command:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to process voice command",
        },
      },
      { status: 500 }
    );
  }
}

// GET /api/voice/sessions - Get voice session history
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // Mock voice session history
    const sessions = [
      {
        id: "vs-1",
        sessionType: "COMMAND",
        transcript: "Show patient Sarah Johnson",
        commandsDetected: ["show_patient"],
        actionTaken: "Navigated to patient record",
        success: true,
        startedAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: "vs-2",
        sessionType: "DICTATION",
        transcript: "Patient reports chest pain, radiating to left arm...",
        commandsDetected: ["dictate_note"],
        actionTaken: "Created progress note",
        success: true,
        startedAt: new Date(Date.now() - 7200000).toISOString(),
      },
    ];

    return NextResponse.json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    console.error("Error fetching voice sessions:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch voice sessions",
        },
      },
      { status: 500 }
    );
  }
}
