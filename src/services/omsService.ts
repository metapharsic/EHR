/**
 * src/services/omsService.ts
 * Typed API client for the Order Management System (OMS) module.
 * All calls route through apiClient (auto JWT injection + refresh).
 */

import { apiClient } from './apiClient';
import type {
  OmsStats,
  DistributorOrder,
  OrderDetail,
  OmsDropdown,
  AiOrderRisk,
  AiFulfillment,
  OmsPortfolioInsights,
  OrderReturn,
  DispatchPayload,
  OmsAnalyticsData,
  OmsSlaBreachEntry,
  OmsDemandPrediction,
  OmsAutoReorderSuggestion,
  OmsOutstandingEntry,
} from '../types';

interface ListResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface OrderListParams {
  search?: string;
  status?: string;
  priority?: string;
  page?: number;
  limit?: number;
}

const qs = (params: Record<string, any> = {}) => {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') sp.append(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
};

export const omsService = {
  getStats: () =>
    apiClient.get<{ success: boolean; data: OmsStats }>('/oms/stats').then((r) => r.data),

  getDropdown: () =>
    apiClient.get<{ success: boolean; data: OmsDropdown }>('/oms/dropdown').then((r) => r.data),

  getOrders: (params: OrderListParams = {}) =>
    apiClient.get<ListResponse<DistributorOrder>>(`/oms${qs(params)}`),

  getOrder: (id: string) =>
    apiClient.get<{ success: boolean; data: OrderDetail }>(`/oms/${id}`).then((r) => r.data),

  createOrder: (payload: {
    distributorId: string;
    distributorName: string;
    items: Array<{ productId: string; productName: string; quantity: number; rate: number; gstPercent?: number }>;
    packingSpecs?: string;
    labelingSpecs?: string;
    priority?: string;
    remarks?: string;
    godownId?: string;
    expectedDeliveryDate?: string;
    discountAmount?: number;
  }) => apiClient.post<{ success: boolean; data: { id: string; orderNumber: string }; message: string }>('/oms', payload),

  approveOrder: (id: string, approvals: Array<{ itemId: string; approvedQuantity: number }> = [], note?: string) =>
    apiClient.put<{ success: boolean; message: string }>(`/oms/${id}/approve`, { approvals, note }),

  updateStatus: (
    id: string,
    status: string,
    extra: { note?: string; carrier?: string; trackingNumber?: string } = {}
  ) => apiClient.put<{ success: boolean; message: string }>(`/oms/${id}/status`, { status, ...extra }),

  cancelOrder: (id: string) =>
    apiClient.delete<{ success: boolean; message: string }>(`/oms/${id}`),

  runAiRisk: (id: string) =>
    apiClient.post<{ success: boolean; ai: AiOrderRisk }>(`/oms/${id}/ai-risk`).then((r) => r.ai),

  getAiFulfillment: (id: string) =>
    apiClient.get<{ success: boolean; data: AiFulfillment }>(`/oms/${id}/ai-fulfillment`).then((r) => r.data),

  getAiConfirmation: (id: string) =>
    apiClient.get<{ success: boolean; data: { draft: string } }>(`/oms/${id}/ai-confirmation`).then((r) => r.data.draft),

  getPortfolioInsights: () =>
    apiClient.post<{ success: boolean; data: OmsPortfolioInsights }>('/oms/ai/insights').then((r) => r.data),

  convertToInvoice: (id: string) =>
    apiClient.post<{ success: boolean; data: { invoiceId: string; invoiceNumber: string }; message: string }>(
      `/oms/${id}/convert-to-invoice`
    ),

  // ---- Analytics ----
  getAnalytics: () =>
    apiClient.get<{ success: boolean; data: OmsAnalyticsData }>('/oms/analytics').then((r) => r.data),

  getSlaBreaches: () =>
    apiClient.get<{ success: boolean; data: OmsSlaBreachEntry[] }>('/oms/sla-breaches').then((r) => r.data),

  exportOrders: () =>
    apiClient.get<any>('/oms/analytics/export'),

  // ---- Returns ----
  createReturn: (
    orderId: string,
    payload: {
      items: Array<{
        orderItemId: string;
        productId: string;
        productName: string;
        quantity: number;
        rate: number;
        reason?: string;
        condition: string;
        restock: boolean;
        batchId?: string;
      }>;
      reason?: string;
    }
  ) =>
    apiClient.post<{ success: boolean; data: { id: string; returnNumber: string }; message: string }>(
      `/oms/${orderId}/return`,
      payload
    ),

  approveReturn: (returnId: string) =>
    apiClient.put<{ success: boolean; message: string }>(`/oms/returns/${returnId}/approve`, {}),

  getReturns: (params: { status?: string; page?: number; limit?: number } = {}) =>
    apiClient.get<{ success: boolean; data: OrderReturn[]; total: number }>(`/oms/returns${qs(params)}`),

  getOrderReturns: (orderId: string) =>
    apiClient.get<{ success: boolean; data: OrderReturn[] }>(`/oms/${orderId}/returns`).then((r) => r.data),

  // ---- Partial Dispatch ----
  dispatchPartial: (orderId: string, payload: DispatchPayload) =>
    apiClient.post<{ success: boolean; message: string; data: { shipmentNumber: string; status: string } }>(
      `/oms/${orderId}/dispatch`,
      payload
    ),

  // ---- Outstanding ----
  getOutstanding: () =>
    apiClient.get<{ success: boolean; data: OmsOutstandingEntry[] }>('/oms/outstanding').then((r) => r.data),

  getDistributorStatement: (distId: string) =>
    apiClient
      .get<{ success: boolean; data: { distributor: any; orders: any[]; totalOutstanding: number } }>(
        `/oms/outstanding/${distId}/statement`
      )
      .then((r) => r.data),

  // ---- AI Predictions ----
  predictNextOrders: () =>
    apiClient
      .post<{ success: boolean; data: { predictions: OmsDemandPrediction[]; insight: string } }>(
        '/oms/ai/predict-orders'
      )
      .then((r) => r.data),

  suggestAutoReorder: () =>
    apiClient
      .post<{ success: boolean; data: { suggestions: OmsAutoReorderSuggestion[]; summary: string } }>(
        '/oms/ai/auto-reorder'
      )
      .then((r) => r.data),
};

export default omsService;
