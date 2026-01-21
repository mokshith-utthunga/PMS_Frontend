// Cycle Service - All performance cycle API calls
import { api } from './api';
import type { PerformanceCycle } from '@/types';

export const cycleService = {
  // Get active cycle
  getActive: () => 
    api.get<{ data: PerformanceCycle | null }>('/api/cycles/active'),

  // Get cycle by ID
  getById: (id: string) => 
    api.get<{ data: PerformanceCycle }>(`/api/cycles/${id}`),

  // Get all cycles
  getList: (status?: string) => {
    const url = status ? `/api/cycles?status=${status}` : '/api/cycles';
    return api.get<{ data: PerformanceCycle[] }>(url);
  },

  // Create cycle
  create: (data: Partial<PerformanceCycle>) => 
    api.post<{ data: PerformanceCycle }>('/api/cycles', data),

  // Update cycle
  update: (id: string, data: Partial<PerformanceCycle>) => 
    api.put<{ data: PerformanceCycle }>(`/api/cycles/${id}`, data),

  // Delete cycle
  delete: (id: string) => 
    api.delete(`/api/cycles/${id}`),
};
