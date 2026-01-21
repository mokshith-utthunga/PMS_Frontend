// Employee Service - All employee-related API calls
import { api } from './api';
import type { Employee, AppRole } from '@/types';

export interface EmployeeFilters {
  department?: string;
  status?: string;
  grade?: string;
  business_unit?: string;
  manager_id?: string;
  ids?: string[];
  limit?: number;
  offset?: number;
}

export interface UserWithRoles {
  id: string;
  email: string;
  employee?: Employee;
  roles: AppRole[];
}

export const employeeService = {
  // Get current logged-in employee
  getMe: () => 
    api.get<{ data: Employee }>('/api/employees/me'),

  // Get employee by ID
  getById: (id: string) => 
    api.get<{ data: Employee }>(`/api/employees/${id}`),

  // Get employees list with filters
  getList: (filters?: EmployeeFilters) => {
    const params = new URLSearchParams();
    if (filters?.department) params.append('department', filters.department);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.grade) params.append('grade', filters.grade);
    if (filters?.business_unit) params.append('business_unit', filters.business_unit);
    if (filters?.manager_id) params.append('manager_id', filters.manager_id);
    if (filters?.ids?.length) params.append('ids', filters.ids.join(','));
    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.offset) params.append('offset', String(filters.offset));
    
    const queryString = params.toString();
    return api.get<{ data: Employee[]; count: number }>(
      `/api/employees${queryString ? `?${queryString}` : ''}`
    );
  },

  // Get team members for a manager
  getTeam: (managerId: string) => 
    api.get<{ data: Employee[]; count: number }>(`/api/employees/${managerId}/team`),

  // Create employee
  create: (data: Partial<Employee>) => 
    api.post<{ data: Employee }>('/api/employees', data),

  // Update employee
  update: (id: string, data: Partial<Employee>) => 
    api.put<{ data: Employee }>(`/api/employees/${id}`, data),

  // Import employees from CSV
  import: (data: { employees: any[]; update_existing?: boolean }) => 
    api.post<{ imported: number; errors: string[] }>('/api/employees/import', data),

  // ========== User Roles ==========
  roles: {
    getUsersWithRoles: () => 
      api.get<{ data: UserWithRoles[] }>('/api/employees/users-with-roles'),

    addRole: (userId: string, role: AppRole) => 
      api.post(`/api/employees/users/${userId}/roles`, { role }),

    removeRole: (userId: string, role: AppRole) => 
      api.delete(`/api/employees/users/${userId}/roles/${role}`),
  },
};
