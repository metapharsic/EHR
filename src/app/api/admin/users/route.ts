import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  role: z.enum(["ADMIN", "PHYSICIAN", "NURSE", "MEDICAL_ASSISTANT", "FRONT_DESK", "PATIENT"]),
  department: z.string().optional(),
  organizationId: z.string().optional(),
  isActive: z.boolean().default(true),
});

// Mock users storage
const mockUsers: any[] = [
  { id: "1", email: "admin@metapharsic.com", name: "Admin User", role: "ADMIN", isActive: true, twoFactorEnabled: true, lastLoginAt: new Date().toISOString(), createdAt: "2023-01-01", organization: { id: "1", name: "Metapharsic Medical Center" }, practitioner: { id: "1", department: "IT" } },
  { id: "2", email: "sarah.chen@metapharsic.com", name: "Dr. Sarah Chen", role: "PHYSICIAN", isActive: true, twoFactorEnabled: true, lastLoginAt: new Date().toISOString(), createdAt: "2023-01-15", organization: { id: "1", name: "Metapharsic Medical Center" }, practitioner: { id: "2", department: "Cardiology" } },
  { id: "3", email: "michael.ross@metapharsic.com", name: "Dr. Michael Ross", role: "PHYSICIAN", isActive: true, twoFactorEnabled: false, lastLoginAt: new Date(Date.now() - 3600000).toISOString(), createdAt: "2023-02-20", organization: { id: "1", name: "Metapharsic Medical Center" }, practitioner: { id: "3", department: "Internal Medicine" } },
];

// GET /api/admin/users - List all users
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const role = searchParams.get("role");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    let users = [...mockUsers];
    
    if (search) {
      const searchLower = search.toLowerCase();
      users = users.filter(u => 
        u.name.toLowerCase().includes(searchLower) || 
        u.email.toLowerCase().includes(searchLower)
      );
    }
    if (role) users = users.filter(u => u.role === role);
    if (status) users = users.filter(u => u.isActive === (status === "active"));

    const total = users.length;
    users = users.slice(offset, offset + limit);

    return NextResponse.json({
      users,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + users.length < total,
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// POST /api/admin/users - Create new user
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validated = createUserSchema.parse(body);

    // Check if email already exists
    const existingUser = mockUsers.find(u => u.email === validated.email);
    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 }
      );
    }

    const user = {
      id: `user_${Date.now()}`,
      ...validated,
      twoFactorEnabled: false,
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
      organization: { id: "1", name: "Metapharsic Medical Center" },
      practitioner: validated.department ? { id: `prac_${Date.now()}`, department: validated.department } : null,
    };

    mockUsers.push(user);

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}
