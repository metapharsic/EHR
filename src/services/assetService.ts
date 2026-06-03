import { apiClient } from './apiClient';

const API_BASE = '/assets';

export interface AssetCategory {
    id: string;
    name: string;
    description: string;
    icon: string;
    useful_life_years: number;
    depreciation_rate: number;
}

export interface Asset {
    id: string;
    asset_name: string;
    asset_code: string;
    category_id: string;
    category_name?: string;
    category_icon?: string;
    purchase_date: string;
    purchase_value: number;
    current_value: number;
    location: string;
    model_no?: string;
    serial_no?: string;
    status: 'Active' | 'Maintenance' | 'Retired' | 'Disposed';
    depreciation_method: string;
    depreciation_rate_percent: number;
    last_maintenance_date?: string;
    next_maintenance_date?: string;
    maintenance_count?: number;
    total_maintenance_cost?: number;
}

export interface MaintenanceLog {
    id: string;
    asset_id: string;
    maintenance_date: string;
    type: 'Preventive' | 'Repair' | 'Overhaul';
    description: string;
    cost: number;
    performed_by: string;
    status: string;
}

export const AssetService = {
    // Fetch all assets
    async getAllAssets(filters?: { category?: string; status?: string; search?: string }): Promise<Asset[]> {
        try {
            const params = new URLSearchParams();
            if (filters?.category) params.append('category', filters.category);
            if (filters?.status) params.append('status', filters.status);
            if (filters?.search) params.append('search', filters.search);

            const response = await apiClient.get<{ success: boolean; data: Asset[] }>(`${API_BASE}?${params.toString()}`);
            return response.data || [];
        } catch (error) {
            console.error('❌ Error fetching assets:', error);
            throw error;
        }
    },

    // Get all categories
    async getCategories(): Promise<AssetCategory[]> {
        try {
            const response = await apiClient.get<{ success: boolean; data: AssetCategory[] }>(`${API_BASE}/categories`);
            return response.data || [];
        } catch (error) {
            console.error('❌ Error fetching asset categories:', error);
            throw error;
        }
    },

    // Create a new asset
    async createAsset(asset: Partial<Asset>): Promise<Asset> {
        try {
            const response = await apiClient.post<{ success: boolean; data: Asset }>(API_BASE, asset);
            return response.data;
        } catch (error) {
            console.error('❌ Error creating asset:', error);
            throw error;
        }
    },

    // Log maintenance
    async logMaintenance(log: Partial<MaintenanceLog>): Promise<MaintenanceLog> {
        try {
            const response = await apiClient.post<{ success: boolean; data: MaintenanceLog }>(`${API_BASE}/maintenance`, log);
            return response.data;
        } catch (error) {
            console.error('❌ Error logging maintenance:', error);
            throw error;
        }
    },

    // Get asset history
    async getAssetHistory(id: string): Promise<{ maintenance: MaintenanceLog[]; transfers: any[]; insurance: any[] }> {
        try {
            const response = await apiClient.get<{ success: boolean; data: any }>(`${API_BASE}/${id}/history`);
            return response.data;
        } catch (error) {
            console.error('❌ Error fetching asset history:', error);
            throw error;
        }
    }
};

export default AssetService;
