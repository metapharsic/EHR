/**
 * src/services/pcdService.ts
 * Frontend service for PCD Network Management.
 */

import { apiClient } from './apiClient';

export interface PCDPartner {
  id: string;
  name: string;
  territory: string;
  state?: string;
  district?: string;
  contact_person?: string;
  contact_number?: string;
  email?: string;
  drug_license_no?: string;
  drug_license_expiry?: string;
  gst_registration?: string;
  gstin_expiry?: string;
  credit_limit: number;
  discount_percentage: number;
  status: string;
  partner_grade: string;
  join_date?: string;
  total_business?: number;
  assigned_mr_ids?: string[];
}

export interface PCDTarget {
  id: string;
  partner_id: string;
  partner_name: string;
  period: string;
  period_start: string;
  period_end: string;
  target_amount: number;
  achieved_amount: number;
  incentive_percentage: number;
  status: string;
}

export interface PCDScheme {
  id: string;
  name: string;
  description?: string;
  scheme_type: string;
  validity_start?: string;
  validity_end?: string;
  minimum_order: number;
  discount_percentage: number;
  status: string;
}

export const pcdService = {
  // Partners
  getPartners: (params?: any) => apiClient.get<any>('/pcd/partners', params),
  getPartner: (id: string) => apiClient.get<PCDPartner>(`/pcd/partners/${id}`),
  createPartner: (data: any) => apiClient.post<PCDPartner>('/pcd/partners', data),
  updatePartner: (id: string, data: any) => apiClient.put<PCDPartner>(`/pcd/partners/${id}`, data),
  
  // Sync
  syncToParties: (id: string) => apiClient.post<any>(`/pcd/partners/${id}/sync`, {}),

  // MRs
  getMRs: () => apiClient.get<any[]>('/pcd/mrs'),
  assignMR: (partnerId: string, mrId: string) => 
    apiClient.put<any>(`/pcd/partners/${partnerId}/assign-mr`, { mr_id: mrId }),

  // Schemes
  getSchemes: () => apiClient.get<PCDScheme[]>('/pcd/schemes'),
  
  // Targets
  getTargets: (params?: any) => apiClient.get<PCDTarget[]>('/pcd/targets', params),
  
  // Dashboard
  getSummary: () => apiClient.get<any>('/pcd/dashboard/summary'),
};
