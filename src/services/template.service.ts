// Template Service - KRA Templates
import { api } from './api';
import type { KRATemplate } from '@/types';

export interface TemplateFilters {
  department?: string;
  grade?: string;
  is_active?: boolean;
}

export interface KPITemplateData {
  id?: string;
  kra_template_id?: string;
  title: string;
  description?: string | null;
  metric_type: string;
  suggested_target?: string | null;
  suggested_weight?: number;
  target_value?: string; // Legacy field name
  weight?: number; // Legacy field name
  calibration?: Array<{ threshold: number; rating: number }> | null;
  created_at?: string;
  updated_at?: string;
}

export const templateService = {
  // ========== KRA Templates ==========
  kra: {
    getAll: (filters?: TemplateFilters) => {
      const params = new URLSearchParams();
      if (filters?.department) params.append('department', filters.department);
      if (filters?.grade) params.append('grade', filters.grade);
      if (filters?.is_active !== undefined) {
        params.append('is_active', String(filters.is_active));
      }
      const queryString = params.toString();
      return api.get<{ data: KRATemplate[] }>(
        `/api/templates/kra${queryString ? `?${queryString}` : ''}`
      );
    },

    getById: (id: string) => 
      api.get<{ data: KRATemplate }>(`/api/templates/kra/${id}`),

    create: (data: Partial<KRATemplate>) => 
      api.post<{ data: KRATemplate }>('/api/templates/kra', data),

    update: (id: string, data: Partial<KRATemplate>) => 
      api.put<{ data: KRATemplate }>(`/api/templates/kra/${id}`, data),

    delete: (id: string) => 
      api.delete(`/api/templates/kra/${id}`),

    duplicate: (id: string) => 
      api.post<{ data: KRATemplate }>(`/api/templates/kra/${id}/duplicate`),
  },

  // ========== KPI Templates ==========
  kpi: {
    getByKRATemplate: (kraTemplateId: string) => 
      api.get<{ data: KPITemplateData[] }>(`/api/kras/kpi-templates?kra_template_id=${kraTemplateId}`),

    create: (data: { kra_template_id: string } & KPITemplateData) => 
      api.post('/api/kras/kpi-templates', data),

    update: (id: string, data: Partial<KPITemplateData>) => 
      api.put<{ data: KPITemplateData }>(`/api/kras/kpi-templates/${id}`, data),

    delete: (id: string) => 
      api.delete(`/api/kras/kpi-templates/${id}`),

    deleteByKRATemplate: (kraTemplateId: string) => 
      api.delete(`/api/kras/templates/${kraTemplateId}/kpi-templates`),
  },

  // Legacy methods for backward compatibility
  getAll: (filters?: TemplateFilters) => {
    const params = new URLSearchParams();
    if (filters?.department) params.append('department', filters.department);
    if (filters?.grade) params.append('grade', filters.grade);
    if (filters?.is_active !== undefined) {
      params.append('is_active', String(filters.is_active));
    }
    const queryString = params.toString();
    return api.get<{ data: KRATemplate[] }>(
      `/api/templates${queryString ? `?${queryString}` : ''}`
    );
  },

  getById: (id: string) => 
    api.get<{ data: KRATemplate }>(`/api/templates/${id}`),

  create: (data: Partial<KRATemplate>) => 
    api.post<{ data: KRATemplate }>('/api/templates', data),

  update: (id: string, data: Partial<KRATemplate>) => 
    api.put<{ data: KRATemplate }>(`/api/templates/${id}`, data),

  delete: (id: string) => 
    api.delete(`/api/templates/${id}`),
};
