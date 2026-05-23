import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

// Mock audit logs storage
const mockAuditLogs: any[] = [
  { id: "1", userId: "1", userEmail: "admin@metapharsic.com", userName: "Admin User", action: "USER_CREATED", resource: "User", resourceId: "5", description: "Created user Jane Smith", status: "SUCCESS", ipAddress: "192.168.1.50", createdAt: new Date().toISOString() },
  { id: "2", userId: "2", userEmail: "sarah.chen@metapharsic.com", userName: "Dr. Sarah Chen", action: "PATIENT_RECORD_ACCESSED", resource: "Patient", resourceId: "PT12345", description: "Viewed medical history", status: "SUCCESS", ipAddress: "192.168.1.100", createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: "3", userId: "system", userEmail: "system", userName: "System", action: "BACKUP_COMPLETED", resource: "Database", description: "Daily backup completed successfully", status: "SUCCESS", ipAddress: "127.0.0.1", createdAt: new Date(Date.now() - 7200000).toISOString() },
];

// GET /api/admin/audit-logs - Get audit logs with filters
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const action = searchParams.get("action");
    const resource = searchParams.get("resource");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    let logs = [...mockAuditLogs];
    
    if (userId) logs = logs.filter(l => l.userId === userId);
    if (action) logs = logs.filter(l => l.action.toLowerCase().includes(action.toLowerCase()));
    if (resource) logs = logs.filter(l => l.resource === resource);
    if (status) logs = logs.filter(l => l.status === status);

    const total = logs.length;
    logs = logs.slice(offset, offset + limit);

    return NextResponse.json({
      logs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + logs.length < total,
      },
    });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}

// POST /api/admin/audit-logs - Create audit log entry
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    const body = await req.json();

    const log = {
      id: `log_${Date.now()}`,
      ...body,
      userId: session?.user?.email || body.userId,
      userEmail: session?.user?.email || body.userEmail,
      userName: session?.user?.name || body.userName,
      createdAt: new Date().toISOString(),
    };

    mockAuditLogs.unshift(log);

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error("Error creating audit log:", error);
    return NextResponse.json(
      { error: "Failed to create audit log" },
      { status: 500 }
    );
  }
}
