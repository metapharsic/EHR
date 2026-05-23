"use client";

import { useState, useEffect, useCallback } from "react";

export interface SymptomNode {
  id: string;
  name: string;
  category: string;
  x: number;
  y: number;
  severity: number;
  confidence: number;
  iconName: string;
  colorScheme: string;
  relatedConditions: string[];
  connections: string[];
}

export interface DiagnosisCluster {
  id: string;
  name: string;
  probability: number;
  symptoms: string[];
  urgency: "LOW" | "MEDIUM" | "HIGH";
  recommendedTests: string[];
  aiConfidence: number;
}

export interface SymptomAnalysis {
  identifiedClusters: {
    clusterId: string;
    name: string;
    matchProbability: number;
    matchingSymptoms: string[];
  }[];
  differentialDiagnosis: {
    diagnosis: string;
    probability: number;
  }[];
  recommendedTests: string[];
  aiConfidence: number;
}

export function useSymptomMapper() {
  const [nodes, setNodes] = useState<SymptomNode[]>([]);
  const [clusters, setClusters] = useState<DiagnosisCluster[]>([]);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<SymptomAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all symptom nodes and clusters
  const fetchSymptomData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch("/api/symptom-mapper");
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to fetch symptom data");
      }
      
      setNodes(result.data.nodes);
      setClusters(result.data.clusters);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Toggle symptom selection
  const toggleSymptom = useCallback((symptomId: string) => {
    setSelectedSymptoms(prev => 
      prev.includes(symptomId)
        ? prev.filter(id => id !== symptomId)
        : [...prev, symptomId]
    );
  }, []);

  // Clear all selected symptoms
  const clearSelection = useCallback(() => {
    setSelectedSymptoms([]);
    setAnalysis(null);
  }, []);

  // Analyze selected symptoms
  const analyzeSymptoms = useCallback(async (patientId?: string) => {
    if (selectedSymptoms.length === 0) return;
    
    try {
      setIsAnalyzing(true);
      
      const response = await fetch("/api/symptom-mapper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedSymptoms,
          patientId,
        }),
      });
      
      const result = await response.json();
      if (result.success) {
        setAnalysis(result.data);
      }
    } catch (err) {
      console.error("Error analyzing symptoms:", err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [selectedSymptoms]);

  // Get connected symptoms for a given node
  const getConnectedSymptoms = useCallback((nodeId: string): SymptomNode[] => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return [];
    return nodes.filter(n => node.connections.includes(n.id));
  }, [nodes]);

  // Get diagnosis clusters for selected symptoms
  const getRelevantClusters = useCallback((): DiagnosisCluster[] => {
    if (selectedSymptoms.length === 0) return clusters;
    
    const selectedNodeNames = selectedSymptoms
      .map(id => nodes.find(n => n.id === id)?.name)
      .filter(Boolean);
    
    return clusters.filter(cluster => 
      cluster.symptoms.some(s => selectedNodeNames.includes(s))
    ).sort((a, b) => b.probability - a.probability);
  }, [clusters, nodes, selectedSymptoms]);

  useEffect(() => {
    fetchSymptomData();
  }, [fetchSymptomData]);

  return {
    nodes,
    clusters,
    selectedSymptoms,
    analysis,
    isLoading,
    isAnalyzing,
    error,
    toggleSymptom,
    clearSelection,
    analyzeSymptoms,
    getConnectedSymptoms,
    getRelevantClusters,
    refetch: fetchSymptomData,
  };
}
