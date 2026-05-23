"use client";

import { useState, useEffect, useCallback } from "react";

export interface MetricDetail {
  [key: string]: number;
}

export interface DashboardMetric {
  value: number;
  change: number;
  changePercent: number;
  trend: "up" | "down" | "neutral";
  status: "live" | "offline" | "warning";
  link: string;
  details: MetricDetail;
}

export interface DashboardMetrics {
  activePatients: DashboardMetric;
  aiPredictions: DashboardMetric;
  riskAlerts: DashboardMetric;
  autoDocumented: DashboardMetric;
  voiceCommands: DashboardMetric;
  prescriptions: DashboardMetric;
  hourlyData: Array<{
    hour: number;
    activePatients: number;
    aiPredictions: number;
    autoDocuments: number;
    voiceCommands: number;
  }>;
  recentActivity: Array<{
    type: string;
    message: string;
    time: string;
    severity: string;
  }>;
}

interface UseDashboardMetricsOptions {
  refreshInterval?: number; // in milliseconds
  period?: "today" | "week" | "month";
}

export function useDashboardMetrics(options: UseDashboardMetricsOptions = {}) {
  const { refreshInterval = 30000, period = "today" } = options;

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/dashboard/metrics?period=${period}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || "Failed to fetch metrics");
      }

      setMetrics(result.data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.message);
      console.error("Error fetching dashboard metrics:", err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  // Initial fetch
  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Auto-refresh
  useEffect(() => {
    if (!refreshInterval) return;

    const interval = setInterval(fetchMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchMetrics, refreshInterval]);

  // Manual refresh
  const refresh = useCallback(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return {
    metrics,
    loading,
    error,
    lastUpdated,
    refresh,
  };
}

// Hook for a single metric with real-time updates
export function useMetric(
  metricKey: keyof DashboardMetrics,
  options: UseDashboardMetricsOptions = {}
) {
  const { metrics, loading, error, lastUpdated, refresh } = useDashboardMetrics(options);

  const metric = metrics?.[metricKey] as DashboardMetric | undefined;

  return {
    metric,
    loading,
    error,
    lastUpdated,
    refresh,
  };
}
