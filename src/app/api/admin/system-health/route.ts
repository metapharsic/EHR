import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

// Mock system health data
const mockHealthMetrics: any[] = [
  { id: "1", serviceName: "API Server", serviceType: "API", status: "OPERATIONAL", uptime: 99.99, latency: 12, cpuUsage: 45, memoryUsage: 62, recordedAt: new Date().toISOString() },
  { id: "2", serviceName: "Database", serviceType: "DATABASE", status: "OPERATIONAL", uptime: 99.95, latency: 8, cpuUsage: 35, memoryUsage: 58, recordedAt: new Date().toISOString() },
  { id: "3", serviceName: "AI Engine", serviceType: "AI_ENGINE", status: "OPERATIONAL", uptime: 99.97, latency: 156, cpuUsage: 78, memoryUsage: 82, recordedAt: new Date().toISOString() },
];

// GET /api/admin/system-health - Get system health metrics
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get unique latest metrics per service
    const latestByService = new Map();
    mockHealthMetrics.forEach((metric) => {
      if (!latestByService.has(metric.serviceName)) {
        latestByService.set(metric.serviceName, metric);
      }
    });

    // Mock statistics
    const statistics = {
      totalUsers: 177,
      activeUsers: 145,
      totalPatients: 12584,
      totalEncounters: 45632,
      recentLogins: 23,
    };

    const auditStats = {
      SUCCESS: 145,
      FAILURE: 3,
      WARNING: 12,
    };

    return NextResponse.json({
      services: Array.from(latestByService.values()),
      statistics,
      auditStats,
    });
  } catch (error) {
    console.error("Error fetching system health:", error);
    return NextResponse.json(
      { error: "Failed to fetch system health" },
      { status: 500 }
    );
  }
}

// POST /api/admin/system-health - Record system health metric
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const metric = {
      id: `health_${Date.now()}`,
      ...body,
      recordedAt: new Date().toISOString(),
    };

    mockHealthMetrics.push(metric);

    return NextResponse.json(metric, { status: 201 });
  } catch (error) {
    console.error("Error recording system health:", error);
    return NextResponse.json(
      { error: "Failed to record system health" },
      { status: 500 }
    );
  }
}
