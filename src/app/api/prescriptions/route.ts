import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/index";

// GET /api/prescriptions - Get prescriptions for a patient
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
    const status = searchParams.get("status");

    // Mock prescriptions data
    const prescriptions = [
      {
        id: "rx-1",
        rxNumber: "RX2024001",
        patientId: patientId || "p-123",
        providerId: session.user.email,
        status: "ACTIVE",
        diagnosis: "Hypertension",
        diagnosisCodes: ["I10"],
        writtenDate: new Date().toISOString(),
        items: [
          {
            id: "item-1",
            medication: {
              id: "med-1",
              name: "Lisinopril",
              genericName: "Lisinopril",
              strength: "10mg",
              dosageForm: "TABLET",
            },
            dosage: "1 tablet",
            frequency: "once daily",
            route: "oral",
            duration: "30 days",
            quantity: 30,
            instructions: "Take in the morning with food",
          },
        ],
        refillsAuthorized: 2,
        refillsRemaining: 2,
      },
    ];

    return NextResponse.json({
      success: true,
      data: prescriptions,
    });
  } catch (error) {
    console.error("Error fetching prescriptions:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch prescriptions" } },
      { status: 500 }
    );
  }
}

// POST /api/prescriptions - Create new prescription
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
    const { patientId, items, diagnosis, conversationContext } = body;

    // Generate Rx Number
    const rxNumber = `RX${Date.now()}`;

    // Mock create prescription
    const prescription = {
      id: `rx-${Date.now()}`,
      rxNumber,
      patientId,
      providerId: session.user.email,
      status: "ACTIVE",
      diagnosis,
      conversationContext,
      items: items.map((item: any, idx: number) => ({
        id: `item-${idx}`,
        ...item,
        createdAt: new Date().toISOString(),
      })),
      writtenDate: new Date().toISOString(),
      refillsAuthorized: 2,
      refillsRemaining: 2,
    };

    return NextResponse.json({
      success: true,
      data: prescription,
    });
  } catch (error) {
    console.error("Error creating prescription:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to create prescription" } },
      { status: 500 }
    );
  }
}
