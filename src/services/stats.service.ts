// Stats Service - Dashboard statistics
import { api } from './api';

export interface AdminDashboardStats {
  totalEmployees: number;
  activeCycles: number;
  departments: number;
  grades: number;
}

export interface HRDashboardStats {
  totalEmployees: number;
  activeCycles: number;
  pendingCalibrations: number;
  departments: number;
}

export const statsService = {
  getAdminDashboard: () =>
    api.get<{ data: AdminDashboardStats }>('/api/stats/admin-dashboard'),

  getHRDashboard: () =>
    api.get<HRDashboardStats>('/api/stats/hr-dashboard'),
};
