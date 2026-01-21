// Settings Service - Departments, Grades, Rating Scales, etc.
import { api } from './api';
import type { Department, Grade, Location, RatingScale, Competency } from '@/types';

export interface BusinessUnit {
  id: string;
  name: string;
}

export const settingsService = {
  // ========== Departments ==========
  departments: {
    getAll: () => 
      api.get<{ data: Department[] }>('/api/settings/departments'),
    
    create: (data: { name: string }) => 
      api.post<{ data: Department }>('/api/settings/departments', data),
    
    update: (id: string, data: { name: string }) => 
      api.put<{ data: Department }>(`/api/settings/departments/${id}`, data),
    
    delete: (id: string) => 
      api.delete(`/api/settings/departments/${id}`),
  },

  // ========== Grades ==========
  grades: {
    getAll: () => 
      api.get<{ data: Grade[] }>('/api/settings/grades'),
    
    create: (data: { name: string; level?: number }) => 
      api.post<{ data: Grade }>('/api/settings/grades', data),
    
    update: (id: string, data: { name?: string; level?: number }) => 
      api.put<{ data: Grade }>(`/api/settings/grades/${id}`, data),
    
    delete: (id: string) => 
      api.delete(`/api/settings/grades/${id}`),
  },

  // ========== Locations ==========
  locations: {
    getAll: () => 
      api.get<{ data: Location[] }>('/api/settings/locations'),
    
    create: (data: { name: string }) => 
      api.post<{ data: Location }>('/api/settings/locations', data),
    
    update: (id: string, data: { name: string }) => 
      api.put<{ data: Location }>(`/api/settings/locations/${id}`, data),
    
    delete: (id: string) => 
      api.delete(`/api/settings/locations/${id}`),
  },

  // ========== Business Units ==========
  businessUnits: {
    getAll: () => 
      api.get<{ data: BusinessUnit[] }>('/api/settings/business-units'),

    create: (data: { name: string }) => 
      api.post<{ data: BusinessUnit }>('/api/settings/business-units', data),

    update: (id: string, data: { name: string }) => 
      api.put<{ data: BusinessUnit }>(`/api/settings/business-units/${id}`, data),

    delete: (id: string) => 
      api.delete(`/api/settings/business-units/${id}`),
  },

  // ========== Competencies ==========
  competencies: {
    getAll: () => 
      api.get<{ data: Competency[] }>('/api/settings/competencies'),

    create: (data: Partial<Competency>) => 
      api.post<{ data: Competency }>('/api/settings/competencies', data),

    update: (id: string, data: Partial<Competency>) => 
      api.put<{ data: Competency }>(`/api/settings/competencies/${id}`, data),

    delete: (id: string) => 
      api.delete(`/api/settings/competencies/${id}`),
  },

  // ========== Rating Scales ==========
  ratingScales: {
    getDefault: () => 
      api.get<{ data: RatingScale[] }>('/api/settings/rating-scales?is_default=true'),
    
    getAll: () => 
      api.get<{ data: RatingScale[] }>('/api/settings/rating-scales'),
  },

  // ========== Calibration Settings ==========
  calibration: {
    get: () => api.get<{ data: { is_enabled: boolean } }>('/api/settings/calibration'),
    
    update: (data: { is_enabled: boolean }) => 
      api.put('/api/settings/calibration', data),

    getDefaultQuotas: () => 
      api.get<{ data: { rating_value: number; percentage: number }[] }>(
        '/api/settings/calibration/default-quotas'
      ),
    
    updateDefaultQuotas: (quotas: { rating_value: number; percentage: number }[]) => 
      api.put('/api/settings/calibration/default-quotas', { quotas }),

    getDepartmentQuotas: () => 
      api.get<{ data: { department: string; rating_value: number; percentage: number }[] }>(
        '/api/settings/calibration/department-quotas'
      ),

    updateDepartmentQuotas: (overrides: { department: string; rating_value: number; percentage: number }[]) => 
      api.put('/api/settings/calibration/department-quotas', { overrides }),
  },

  // Legacy - kept for backward compatibility
  calibrationQuotas: {
    getDefaults: () => 
      api.get<{ data: { rating_value: number; percentage: number }[] }>(
        '/api/settings/calibration/default-quotas'
      ),
    
    getByDepartment: () => 
      api.get<{ data: { department: string; rating_value: number; percentage: number }[] }>(
        '/api/settings/calibration/department-quotas'
      ),
  },
};
