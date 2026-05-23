import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/index";

// POST /api/scribe - Start ambient scribe session
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
    const { patientId, encounterType, chiefComplaint } = body;

    // Mock start scribe session
    const scribeSession = {
      id: "scribe-" + Date.now(),
      patientId,
      providerId: session.user.email,
      encounterType,
      chiefComplaint,
      status: "RECORDING",
      transcriptSegments: [],
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: scribeSession,
    });
  } catch (error) {
    console.error("Error starting scribe session:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to start scribe session",
        },
      },
      { status: 500 }
    );
  }
}

// GET /api/scribe - Get scribe sessions
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
    const patientId = searchParams.get("patientId");

    // Mock scribe sessions
    const sessions = [
      {
        id: "scribe-1",
        patientId: patientId || "p-123",
        encounterType: "Office Visit",
        chiefComplaint: "Chest pain",
        recordingDuration: 1800,
        status: "COMPLETED",
        generatedNote: "HISTORY OF PRESENT ILLNESS: Patient presents with...",
        generatedNoteType: "Progress Note",
        aiInsights: [
          { type: "DIAGNOSIS", content: "Possible angina", confidence: 87 },
          { type: "MEDICATION", content: "Consider nitroglycerin PRN", confidence: 92 },
        ],
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        completedAt: new Date(Date.now() - 84600000).toISOString(),
      },
    ];

    return NextResponse.json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    console.error("Error fetching scribe sessions:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch scribe sessions",
        },
      },
      { status: 500 }
    );
  }
}

// PATCH /api/scribe/[sessionId] - Update scribe session (add transcript, complete, etc.)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { sessionId, action, transcriptSegment, generatedNote } = body;

    // Mock update
    let result;
    if (action === "add_transcript") {
      result = {
        segmentId: "seg-" + Date.now(),
        scribeSessionId: sessionId,
        speaker: transcriptSegment.speaker,
        text: transcriptSegment.text,
        startTime: transcriptSegment.startTime,
        endTime: transcriptSegment.endTime,
        confidence: 0.94,
        medicalTerms: ["chest pain", "radiating", "exertion"],
      };
    } else if (action === "complete") {
      result = {
        sessionId,
        status: "COMPLETED",
        generatedNote,
        completedAt: new Date().toISOString(),
      };
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error updating scribe session:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to update scribe session",
        },
      },
      { status: 500 }
    );
  }
}
