/**
 * src/services/crmService.ts
 * Frontend service for CRM module synchronization and AI features.
 */

import { apiClient } from './apiClient';

export interface Lead {
  id: string;
  name: string;
  company_name?: string;
  email?: string;
  contact: string;
  location?: string;
  status: string;
  priority: string;
  source?: string;
  next_follow_up?: string;
  estimated_value: number;
  assigned_to?: string;
  notes?: string;
  industry_type?: string;
  lead_score: number;
  ai_sentiment: string;
  converted_party_id?: string;
  created_at: string;
  updated_at: string;
  activity_count?: number;
  assignee_name?: string;
  last_activity_at?: string;
}

export interface LeadProductInterest {
  id: string;
  lead_id: string;
  product_id: string;
  product_name: string;
  product_category?: string;
  interest_level: string;
  notes?: string;
}

export const crmService = {
  // Leads
  getLeads: (filters?: any) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.keys(filters).forEach(key => {
        if (filters[key]) params.append(key, filters[key]);
      });
    }
    return apiClient.get<Lead[]>(`/crm/leads?${params.toString()}`);
  },
  getLead: (id: string) => apiClient.get<Lead>(`/crm/leads/${id}`),
  createLead: (data: any) => apiClient.post<Lead>('/crm/leads', data),
  updateLead: (id: string, data: any) => apiClient.put<Lead>(`/crm/leads/${id}`, data),
  deleteLead: (id: string) => apiClient.delete(`/crm/leads/${id}`),

  // Conversion
  convertToCustomer: (id: string) => apiClient.post<any>(`/crm/convert/${id}`, {}),

  // AI Features
  triggerAiScoring: (id: string) => apiClient.put<any>(`/crm/leads/${id}/ai-score`, {}),
  getAiDraft: (id: string) => apiClient.get<{ draft: string }>(`/crm/leads/${id}/ai-draft`),
  generateStrategy: () => apiClient.post<any>('/crm/ai/strategy', {}),
  getAnalytics: () => apiClient.get<{ velocity: any[]; distribution: any[] }>('/crm/analytics'),

  // Interests
  getInterests: (id: string) => apiClient.get<LeadProductInterest[]>(`/crm/leads/${id}/interests`),
  addInterest: (id: string, data: { productId: string; interestLevel?: string; notes?: string }) => 
    apiClient.post<LeadProductInterest>(`/crm/leads/${id}/interests`, data),

  // Stats
  getStats: () => apiClient.get<any>('/crm/stats'),

  // Activities
  getActivities: (id: string) => apiClient.get<any[]>(`/crm/leads/${id}/activities`),
  addActivity: (id: string, data: any) => apiClient.post<any>(`/crm/leads/${id}/activities`, data),
};
