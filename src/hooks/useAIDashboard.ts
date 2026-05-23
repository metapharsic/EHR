"use client";

import { useState, useEffect, useCallback } from "react";

export interface AIInsight {
  id: string;
  insightType: "RISK_ALERT" | "SUGGESTION" | "PREDICTION" | "ANOMALY" | "OPPORTUNITY";
  title: string;
  description: string;
  confidenceScore: number;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  category: string;
  isActionable: boolean;
  suggestedActions: string[];
  status: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED";
  createdAt: string;
}

export interface LiveMetric {
  id: string;
  metricName: string;
  displayName: string;
  currentValue: string;
  numericValue?: number;
  changeValue: string;
  changeDirection: "UP" | "DOWN" | "NEUTRAL";
  iconName: string;
  colorScheme: string;
  lastUpdated: string;
}

export interface PredictiveScheduleItem {
  id: string;
  patientId: string;
  patientName: string;
  appointmentTime: string;
  aiPrepared: boolean;
  insights: string[];
  riskScore: number;
  suggestedTopics: string[];
}

export interface VoiceStatus {
  isListening: boolean;
  lastCommand?: string;
  lastCommandTime?: string;
  availableCommands: string[];
}

export interface AIDashboardData {
  insights: AIInsight[];
  metrics: LiveMetric[];
  voiceStatus: VoiceStatus;
  predictiveSchedule: PredictiveScheduleItem[];
  lastUpdated: string;
}

export function useAIDashboard() {
  const [data, setData] = useState<AIDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch("/api/ai-dashboard");
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to fetch dashboard");
      }
      
      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const acknowledgeInsight = useCallback(async (insightId: string, action: "acknowledge" | "dismiss") => {
    try {
      const response = await fetch("/api/ai-dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insightId, action }),
      });
      
      const result = await response.json();
      if (result.success && data) {
        setData(prev => prev ? {
          ...prev,
          insights: prev.insights.map(i => 
            i.id === insightId 
              ? { ...i, status: action === "acknowledge" ? "ACKNOWLEDGED" : "DISMISSED" }
              : i
          ),
        } : null);
      }
      return result.data;
    } catch (err) {
      console.error("Error acknowledging insight:", err);
      throw err;
    }
  }, [data]);

  const getCriticalInsights = useCallback(() => {
    if (!data) return [];
    return data.insights.filter(i => i.severity === "CRITICAL" && i.status === "ACTIVE");
  }, [data]);

  const getHighPriorityInsights = useCallback(() => {
    if (!data) return [];
    return data.insights.filter(i => i.severity === "HIGH" && i.status === "ACTIVE");
  }, [data]);

  const getActionableInsights = useCallback(() => {
    if (!data) return [];
    return data.insights.filter(i => i.isActionable && i.status === "ACTIVE");
  }, [data]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchDashboard,
    acknowledgeInsight,
    getCriticalInsights,
    getHighPriorityInsights,
    getActionableInsights,
  };
}
