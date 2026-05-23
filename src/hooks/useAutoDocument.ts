import { useState, useCallback } from "react";

export interface AutoDocument {
  id: string;
  patientId: string;
  patient?: {
    id: string;
    firstName: string;
    lastName: string;
    mrn: string;
  };
  providerId: string;
  provider?: {
    id: string;
    name: string;
    role: string;
  };
  encounterId?: string;
  documentType: 
    | "VISIT_SUMMARY"
    | "CARE_PLAN"
    | "REFERRAL_LETTER"
    | "PRIOR_AUTH_REQUEST"
    | "DISABILITY_CERTIFICATE"
    | "RETURN_TO_WORK"
    | "MEDICAL_CERTIFICATE"
    | "LAB_SUMMARY"
    | "IMAGING_SUMMARY";
  title: string;
  sourceData: {
    transcript: string;
    extractedData: {
      demographics?: any;
      medicalHistory?: any;
      symptoms?: any;
      diagnosis?: any;
      plan?: any;
      reports?: any;
    };
    conversationFlow?: any[];
  };
  generatedContent: string;
  summary?: string;
  sections?: Record<string, any>;
  generationTimeMs?: number;
  confidenceScore?: number;
  status: "GENERATED" | "PENDING_REVIEW" | "APPROVED" | "SENT" | "ARCHIVED";
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAutoDocumentInput {
  patientId: string;
  encounterId?: string;
  documentType: AutoDocument["documentType"];
  title: string;
  sourceData: AutoDocument["sourceData"];
  generatedContent: string;
  summary?: string;
  sections?: Record<string, any>;
  generationTimeMs?: number;
  confidenceScore?: number;
}

export function useAutoDocument() {
  const [documents, setDocuments] = useState<AutoDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch documents
  const fetchDocuments = useCallback(async (filters?: { patientId?: string; status?: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters?.patientId) params.append("patientId", filters.patientId);
      if (filters?.status) params.append("status", filters.status);

      const response = await fetch(`/api/auto-document?${params}`);
      if (!response.ok) throw new Error("Failed to fetch documents");
      
      const data = await response.json();
      setDocuments(data.documents);
      return data.documents;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create new document
  const createDocument = useCallback(async (input: CreateAutoDocumentInput) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auto-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!response.ok) throw new Error("Failed to create document");
      
      const newDoc = await response.json();
      setDocuments(prev => [newDoc, ...prev]);
      return newDoc;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update document status
  const updateDocument = useCallback(async (id: string, updates: Partial<AutoDocument>) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/auto-document?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error("Failed to update document");
      
      const updatedDoc = await response.json();
      setDocuments(prev => 
        prev.map(d => d.id === id ? updatedDoc : d)
      );
      return updatedDoc;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Generate document from transcript (AI simulation)
  const generateFromTranscript = useCallback(async (
    patientId: string,
    transcript: string,
    extractedData: AutoDocument["sourceData"]["extractedData"]
  ) => {
    const startTime = Date.now();
    
    // Simulate AI processing
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const generationTimeMs = Date.now() - startTime;
    const confidenceScore = 0.85 + Math.random() * 0.14; // 85-99%

    // Generate structured content based on extracted data
    const sections: Record<string, any> = {};
    
    if (extractedData.demographics) {
      sections.demographics = {
        title: "Patient Demographics",
        content: `Patient: ${extractedData.demographics.name || "Unknown"}`,
        data: extractedData.demographics,
      };
    }
    
    if (extractedData.symptoms) {
      sections.chiefComplaint = {
        title: "Chief Complaint",
        content: extractedData.symptoms.description || "Not specified",
        data: extractedData.symptoms,
      };
    }
    
    if (extractedData.diagnosis) {
      sections.assessment = {
        title: "Assessment & Plan",
        content: extractedData.diagnosis.description || "Pending",
        data: extractedData.diagnosis,
      };
    }

    const generatedContent = `
# Clinical Documentation

Generated by Metta AI on ${new Date().toLocaleString()}
Confidence Score: ${(confidenceScore * 100).toFixed(1)}%

## Transcript Summary
${transcript.substring(0, 500)}...

## Key Information Extracted
${Object.entries(extractedData).map(([key, value]) => 
  `- ${key}: ${JSON.stringify(value)}`
).join("\n")}

## Generated Notes
This document was automatically generated from the clinical conversation.
Please review and approve before finalizing.
    `.trim();

    const input: CreateAutoDocumentInput = {
      patientId,
      documentType: "VISIT_SUMMARY",
      title: `Visit Summary - ${new Date().toLocaleDateString()}`,
      sourceData: {
        transcript,
        extractedData,
      },
      generatedContent,
      summary: generatedContent.substring(0, 200) + "...",
      sections,
      generationTimeMs,
      confidenceScore,
    };

    return createDocument(input);
  }, [createDocument]);

  return {
    documents,
    isLoading,
    error,
    fetchDocuments,
    createDocument,
    updateDocument,
    generateFromTranscript,
  };
}
