"use client";

import { useState, useEffect, useCallback } from "react";

export interface GeneVariant {
  id: string;
  geneName: string;
  rsId?: string;
  chromosome: string;
  position: number;
  referenceAllele: string;
  alternateAllele: string;
  zygosity: "HOMOZYGOUS_REF" | "HETEROZYGOUS" | "HOMOZYGOUS_ALT";
  clinicalSignificance?: string;
  associatedConditions: string[];
}

export interface DrugSensitivity {
  id: string;
  drugName: string;
  drugClass?: string;
  sensitivityType: "EFFICACY" | "ADVERSE_REACTION" | "METABOLISM" | "DOSAGE";
  severity: string;
  affectedGene?: string;
  mechanism?: string;
  recommendation: string;
  alternativeDrugs: string[];
}

export interface GeneticTrait {
  id: string;
  traitName: string;
  traitCategory: string;
  predictedStatus: string;
  confidence: number;
  associatedVariants: string[];
}

export interface GenomicProfile {
  id: string;
  patientId: string;
  sampleId: string;
  sampleType: string;
  sequencedAt?: string;
  geneticAge?: number;
  telomereLength?: string;
  overallGeneticRisk: "VERY_LOW" | "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";
  geneVariants: GeneVariant[];
  drugSensitivities: DrugSensitivity[];
  traitPredictions: GeneticTrait[];
  createdAt: string;
  updatedAt: string;
}

export function useGenomics(patientId: string) {
  const [profile, setProfile] = useState<GenomicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/genomics/${patientId}`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to fetch genomic profile");
      }
      
      setProfile(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [patientId]);

  const getPharmacogenomicAlerts = useCallback(() => {
    if (!profile) return [];
    return profile.drugSensitivities.filter(
      ds => ds.severity === "moderate" || ds.severity === "severe"
    );
  }, [profile]);

  const getPathogenicVariants = useCallback(() => {
    if (!profile) return [];
    return profile.geneVariants.filter(
      v => v.clinicalSignificance === "pathogenic" || 
           v.clinicalSignificance === "likely pathogenic"
    );
  }, [profile]);

  const getHighRiskTraits = useCallback(() => {
    if (!profile) return [];
    return profile.traitPredictions.filter(
      t => t.traitCategory === "disease risk" && t.confidence > 80
    );
  }, [profile]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    isLoading,
    error,
    refetch: fetchProfile,
    getPharmacogenomicAlerts,
    getPathogenicVariants,
    getHighRiskTraits,
  };
}
