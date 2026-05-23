import { useState, useCallback, useEffect } from "react";

// Types
export interface AuditLog {
  id: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  action: string;
  resource: string;
  resourceId?: string;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
  status: "SUCCESS" | "FAILURE" | "WARNING";
  errorMessage?: string;
  metadata?: any;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt?: string;
  createdAt: string;
  organization?: {
    id: string;
    name: string;
  };
  practitioner?: {
    id: string;
    department?: string;
  };
}

export interface SystemHealth {
  id: string;
  serviceName: string;
  serviceType: string;
  status: "OPERATIONAL" | "DEGRADED" | "DOWN" | "MAINTENANCE";
  uptime: number;
  latency: number;
  cpuUsage?: number;
  memoryUsage?: number;
  diskUsage?: number;
  requestCount?: number;
  errorCount?: number;
  region?: string;
  version?: string;
  recordedAt: string;
}

export interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  totalPatients: number;
  totalEncounters: number;
  recentLogins: number;
}

export function useAdmin() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Audit Logs
  const fetchAuditLogs = useCallback(async (filters?: {
    userId?: string;
    action?: string;
    resource?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters?.userId) params.append("userId", filters.userId);
      if (filters?.action) params.append("action", filters.action);
      if (filters?.resource) params.append("resource", filters.resource);
      if (filters?.status) params.append("status", filters.status);
      if (filters?.startDate) params.append("startDate", filters.startDate);
      if (filters?.endDate) params.append("endDate", filters.endDate);
      if (filters?.limit) params.append("limit", filters.limit.toString());
      if (filters?.offset) params.append("offset", filters.offset.toString());

      const response = await fetch(`/api/admin/audit-logs?${params}`);
      if (!response.ok) throw new Error("Failed to fetch audit logs");
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createAuditLog = useCallback(async (data: Partial<AuditLog>) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/audit-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create audit log");
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Users
  const fetchUsers = useCallback(async (filters?: {
    search?: string;
    role?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters?.search) params.append("search", filters.search);
      if (filters?.role) params.append("role", filters.role);
      if (filters?.status) params.append("status", filters.status);
      if (filters?.limit) params.append("limit", filters.limit.toString());
      if (filters?.offset) params.append("offset", filters.offset.toString());

      const response = await fetch(`/api/admin/users?${params}`);
      if (!response.ok) throw new Error("Failed to fetch users");
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createUser = useCallback(async (data: {
    email: string;
    name: string;
    role: string;
    department?: string;
    organizationId?: string;
    isActive?: boolean;
    twoFactorEnabled?: boolean;
  }) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create user");
      }
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // System Health
  const fetchSystemHealth = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/system-health");
      if (!response.ok) throw new Error("Failed to fetch system health");
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const recordSystemHealth = useCallback(async (data: {
    serviceName: string;
    serviceType: string;
    status: string;
    uptime: number;
    latency: number;
    cpuUsage?: number;
    memoryUsage?: number;
    diskUsage?: number;
    requestCount?: number;
    errorCount?: number;
    region?: string;
    version?: string;
  }) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/system-health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to record system health");
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,
    fetchAuditLogs,
    createAuditLog,
    fetchUsers,
    createUser,
    fetchSystemHealth,
    recordSystemHealth,
  };
}

// Hook for polling system health
export function useSystemHealthPolling(intervalMs: number = 30000) {
  const [health, setHealth] = useState<{
    services: SystemHealth[];
    statistics: SystemStats;
    auditStats: Record<string, number>;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { fetchSystemHealth } = useAdmin();

  useEffect(() => {
    const poll = async () => {
      try {
        const data = await fetchSystemHealth();
        setHealth(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    poll(); // Initial fetch
    const interval = setInterval(poll, intervalMs);

    return () => clearInterval(interval);
  }, [fetchSystemHealth, intervalMs]);

  return { health, isLoading, error };
}
