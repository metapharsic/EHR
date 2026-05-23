"use client";

import { useState, useEffect, useCallback } from "react";

export interface OrganSystem {
  id: string;
  name: string;
  displayName: string;
  category: string;
  positionX: number;
  positionY: number;
  positionZ: number;
  healthScore: number;
  status: "HEALTHY" | "MONITORING" | "WARNING" | "CRITICAL";
  aiInsight?: string;
  aiConfidence: number;
  colorGradient: string;
  iconName: string;
  biomarkers: Biomarker[];
  connections: string[];
}

export interface Biomarker {
  name: string;
  value: string;
  numericValue?: number;
  unit?: string;
  trend: "UP" | "DOWN" | "STABLE";
  trendPercentage?: number;
}

export interface ScanSession {
  id: string;
  scanType: "FULL_BODY" | "DNA" | "NEURAL" | "CELLULAR";
  scanDuration: number;
  findings?: string;
  anomaliesDetected: number;
  aiConfidence?: number;
  startedAt: string;
  completedAt?: string;
}

export interface DigitalTwin {
  id: string;
  patientId: string;
  overallHealthScore: number;
  lastUpdated: string;
  modelVersion: string;
  scanMode: "FULL_BODY" | "DNA" | "NEURAL" | "CELLULAR";
  organSystems: OrganSystem[];
  particleConfig: {
    particleCount: number;
    colorScheme: string;
    animationSpeed: number;
    xRange: number[];
    yRange: number[];
    zRange: number[];
  };
  recentScans: ScanSession[];
}

export function useDigitalTwin(patientId: string) {
  const [twin, setTwin] = useState<DigitalTwin | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTwin = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/digital-twin/${patientId}`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to fetch digital twin");
      }
      
      setTwin(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [patientId]);

  const updateScanMode = useCallback(async (mode: DigitalTwin["scanMode"]) => {
    try {
      const response = await fetch(`/api/digital-twin/${patientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanMode: mode }),
      });
      
      const result = await response.json();
      if (result.success) {
        setTwin(prev => prev ? { ...prev, scanMode: mode } : null);
      }
    } catch (err) {
      console.error("Error updating scan mode:", err);
    }
  }, [patientId]);

  const refreshBiomarkers = useCallback(async () => {
    await fetchTwin();
  }, [fetchTwin]);

  useEffect(() => {
    fetchTwin();
  }, [fetchTwin]);

  return {
    twin,
    isLoading,
    error,
    refetch: fetchTwin,
    updateScanMode,
    refreshBiomarkers,
  };
}
