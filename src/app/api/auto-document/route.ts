import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

// Mock database for auto-documents (in-memory storage)
const autoDocuments: any[] = [];

// GET /api/auto-document - List documents
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get("patientId");
    const status = searchParams.get("status");

    let documents = autoDocuments;
    
    if (patientId) {
      documents = documents.filter(d => d.patientId === patientId);
    }
    if (status) {
      documents = documents.filter(d => d.status === status);
    }

    // Sort by createdAt desc
    documents = documents.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({
      documents,
      pagination: {
        total: documents.length,
        limit: 50,
        offset: 0,
        hasMore: false,
      },
    });
  } catch (error) {
    console.error("Error fetching auto-documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}

// POST /api/auto-document - Create new auto-document
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    
    const document = {
      id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...body,
      providerId: session.user.email,
      provider: {
        id: session.user.email,
        name: session.user.name || "Unknown Provider",
        role: "PHYSICIAN",
      },
      status: "GENERATED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    autoDocuments.push(document);

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error("Error creating auto-document:", error);
    return NextResponse.json(
      { error: "Failed to create document" },
      { status: 500 }
    );
  }
}

// PATCH /api/auto-document/:id - Update document status
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const body = await req.json();

    const docIndex = autoDocuments.findIndex(d => d.id === id);
    if (docIndex === -1) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    autoDocuments[docIndex] = {
      ...autoDocuments[docIndex],
      ...body,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(autoDocuments[docIndex]);
  } catch (error) {
    console.error("Error updating auto-document:", error);
    return NextResponse.json(
      { error: "Failed to update document" },
      { status: 500 }
    );
  }
}
