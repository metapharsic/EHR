"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PatientSearchInput, PatientInput } from "@/lib/validation/patient";
import { ApiResponse } from "@/types";

const API_BASE = "/api/patients";

// Fetch patients with search and pagination
async function fetchPatients(params: PatientSearchInput): Promise<ApiResponse<any>> {
  const searchParams = new URLSearchParams();
  
  if (params.query) searchParams.set("query", params.query);
  if (params.gender) searchParams.set("gender", params.gender);
  if (params.status) searchParams.set("status", params.status);
  if (params.dateOfBirthFrom) searchParams.set("dateOfBirthFrom", params.dateOfBirthFrom);
  if (params.dateOfBirthTo) searchParams.set("dateOfBirthTo", params.dateOfBirthTo);
  if (params.providerId) searchParams.set("providerId", params.providerId);
  
  searchParams.set("page", String(params.page || 1));
  searchParams.set("limit", String(params.limit || 20));
  searchParams.set("sortBy", params.sortBy || "lastName");
  searchParams.set("sortOrder", params.sortOrder || "asc");

  const response = await fetch(`${API_BASE}?${searchParams.toString()}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch patients");
  }
  
  return response.json();
}

// Fetch single patient
async function fetchPatient(id: string): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE}/${id}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch patient");
  }
  
  return response.json();
}

// Create patient
async function createPatient(data: PatientInput): Promise<ApiResponse<any>> {
  const response = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to create patient");
  }
  
  return response.json();
}

// Update patient
async function updatePatient(id: string, data: Partial<PatientInput>): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to update patient");
  }
  
  return response.json();
}

// Delete patient
async function deletePatient(id: string): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: "DELETE",
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to delete patient");
  }
  
  return response.json();
}

// Hook for fetching patients list
export function usePatients(params: PatientSearchInput) {
  return useQuery({
    queryKey: ["patients", params],
    queryFn: () => fetchPatients(params),
    staleTime: 30000, // 30 seconds
  });
}

// Hook for fetching single patient
export function usePatient(id: string) {
  return useQuery({
    queryKey: ["patient", id],
    queryFn: () => fetchPatient(id),
    enabled: !!id,
    staleTime: 60000, // 1 minute
  });
}

// Hook for creating patient
export function useCreatePatient() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createPatient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
  });
}

// Hook for updating patient
export function useUpdatePatient() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PatientInput> }) =>
      updatePatient(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["patient", variables.id] });
    },
  });
}

// Hook for deleting patient
export function useDeletePatient() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deletePatient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
  });
}
