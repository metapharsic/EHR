"use client";

import { useState, useEffect, useCallback } from "react";

export interface TimelineDataPoint {
  month: string;
  year: number;
  date: string;
  actualScore: number | null;
  predictedScore: number;
  optimisticScore: number;
  pessimisticScore: number;
  interventionCount: number;
  isProjected: boolean;
}

export interface PredictedEvent {
  id: string;
  title: string;
  description: string;
  eventType: "PREDICTION" | "MILESTONE" | "RISK" | "INTERVENTION" | "GENETIC";
  predictedDate: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  probability: number;
  confidenceScore: number;
  impactLevel: "LOW" | "MEDIUM" | "HIGH";
  category: string;
  isActionable: boolean;
  recommendedActions: string[];
  occurred: boolean;
}

export interface Intervention {
  id: string;
  interventionType: string;
  description: string;
  plannedDate: string;
  completedDate?: string;
  expectedImpact?: number;
  actualImpact?: number;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
}

export interface PredictiveTimeline {
  id: string;
  patientId: string;
  timeRange: string;
  predictionModel: string;
  currentHealthScore: number;
  trajectory: "IMPROVING" | "STABLE" | "DECLINING";
  dataPoints: TimelineDataPoint[];
  predictedEvents: PredictedEvent[];
  interventions: Intervention[];
}

export function usePredictiveTimeline(patientId: string) {
  const [timeline, setTimeline] = useState<PredictiveTimeline | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState("1y");

  const fetchTimeline = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/predictive-timeline/${patientId}?range=${timeRange}`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to fetch timeline");
      }
      
      setTimeline(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [patientId, timeRange]);

  const createIntervention = useCallback(async (interventionData: Partial<Intervention>) => {
    try {
      const response = await fetch(`/api/predictive-timeline/${patientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(interventionData),
      });
      
      const result = await response.json();
      if (result.success) {
        setTimeline(prev => prev ? {
          ...prev,
          interventions: [...prev.interventions, result.data],
        } : null);
      }
      return result.data;
    } catch (err) {
      console.error("Error creating intervention:", err);
      throw err;
    }
  }, [patientId]);

  const getChartData = useCallback(() => {
    if (!timeline) return [];
    
    return timeline.dataPoints.map(point => ({
      month: point.month,
      actual: point.actualScore,
      predicted: point.predictedScore,
      optimistic: point.optimisticScore,
      pessimistic: point.pessimisticScore,
      isProjected: point.isProjected,
    }));
  }, [timeline]);

  const getUpcomingEvents = useCallback((limit: number = 5) => {
    if (!timeline) return [];
    
    return timeline.predictedEvents
      .filter(e => !e.occurred)
      .sort((a, b) => new Date(a.predictedDate).getTime() - new Date(b.predictedDate).getTime())
      .slice(0, limit);
  }, [timeline]);

  const getActiveInterventions = useCallback(() => {
    if (!timeline) return [];
    
    return timeline.interventions.filter(
      i => i.status === "PLANNED" || i.status === "IN_PROGRESS"
    );
  }, [timeline]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  return {
    timeline,
    isLoading,
    error,
    timeRange,
    setTimeRange,
    refetch: fetchTimeline,
    createIntervention,
    getChartData,
    getUpcomingEvents,
    getActiveInterventions,
  };
}
