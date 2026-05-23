"use client";

import { useState, useCallback } from "react";

export interface SwarmFactor {
  id: string;
  factorType: "SYMPTOM" | "LAB_RESULT" | "IMAGING" | "GENETIC" | "HISTORY" | "DEMOGRAPHIC" | "ENVIRONMENTAL" | "AI_PREDICTION";
  factorName: string;
  weight: number;
  confidence: number;
  direction: "SUPPORTS" | "CONTRADICTS" | "NEUTRAL";
  evidenceData?: Record<string, unknown>;
}

export interface SwarmAnalysis {
  id: string;
  patientId: string;
  caseType: string;
  presentingSymptoms: string[];
  swarmSize: number;
  convergenceScore: number;
  contributingFactors: SwarmFactor[];
  primaryDiagnosis?: string;
  differentialDiagnoses: string[];
  confidenceScores: Record<string, number>;
  recommendations: string[];
  createdAt: string;
}

export interface DiagnosisPattern {
  id: string;
  patternName: string;
  description: string;
  symptomPattern: string[];
  occurrenceCount: number;
  successRate: number;
  associatedDiagnoses: string[];
  typicalSeverity: string;
  discoveredByAI: boolean;
  discoveryDate: string;
  lastValidated?: string;
}

export function useSwarmIntelligence() {
  const [analysis, setAnalysis] = useState<SwarmAnalysis | null>(null);
  const [patterns, setPatterns] = useState<DiagnosisPattern[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoadingPatterns, setIsLoadingPatterns] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = useCallback(async (data: {
    patientId: string;
    symptoms: string[];
    labResults?: Record<string, unknown>;
    imaging?: Record<string, unknown>;
    history?: Record<string, unknown>;
  }) => {
    try {
      setIsAnalyzing(true);
      setError(null);
      
      const response = await fetch("/api/swarm/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to run swarm analysis");
      }
      
      setAnalysis(result.data);
      return result.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      throw err;
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const fetchPatterns = useCallback(async () => {
    try {
      setIsLoadingPatterns(true);
      setError(null);
      
      const response = await fetch("/api/swarm/patterns");
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to fetch patterns");
      }
      
      setPatterns(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoadingPatterns(false);
    }
  }, []);

  const getTopContributingFactors = useCallback((limit: number = 5) => {
    if (!analysis) return [];
    return analysis.contributingFactors
      .sort((a, b) => b.weight - a.weight)
      .slice(0, limit);
  }, [analysis]);

  const getConfidenceLevel = useCallback(() => {
    if (!analysis) return null;
    const score = analysis.convergenceScore;
    if (score >= 0.9) return { level: "Very High", color: "emerald" };
    if (score >= 0.8) return { level: "High", color: "cyan" };
    if (score >= 0.6) return { level: "Moderate", color: "yellow" };
    return { level: "Low", color: "orange" };
  }, [analysis]);

  const getPatternSuccessRate = useCallback(() => {
    if (patterns.length === 0) return 0;
    const totalSuccess = patterns.reduce((sum, p) => sum + p.successRate, 0);
    return (totalSuccess / patterns.length) * 100;
  }, [patterns]);

  return {
    analysis,
    patterns,
    isAnalyzing,
    isLoadingPatterns,
    error,
    runAnalysis,
    fetchPatterns,
    getTopContributingFactors,
    getConfidenceLevel,
    getPatternSuccessRate,
  };
}
