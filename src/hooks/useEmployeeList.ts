// Custom hook for Employee List data and operations
import { useState, useEffect, useCallback, useMemo } from 'react';
import { employeeService, settingsService } from '@/services';
import { logError } from '@/errors';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';
import type { Employee } from '@/types';

export interface EmployeeListData {
  employees: Employee[];
  departments: string[];
  totalCount: number;
  loading: boolean;
}

export interface EmployeeListFilters {
  search: string;
  department: string;
  status: string;
  page: number;
}

export function useEmployeeList() {
  const [data, setData] = useState<EmployeeListData>({
    employees: [],
    departments: [],
    totalCount: 0,
    loading: true,
  });

  const [filters, setFilters] = useState<EmployeeListFilters>({
    search: '',
    department: 'all',
    status: 'all',
    page: 0,
  });

  // Fetch departments
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const result = await settingsService.departments.getAll();
        setData(prev => ({
          ...prev,
          departments: result.data?.map(d => d.name) || [],
        }));
      } catch (error) {
        logError(error, 'fetchDepartments');
      }
    };
    fetchDepartments();
  }, []);

  // Fetch employees
  const fetchEmployees = useCallback(async () => {
    setData(prev => ({ ...prev, loading: true }));
    try {
      const result = await employeeService.getList({
        department: filters.department !== 'all' ? filters.department : undefined,
        status: filters.status !== 'all' ? filters.status : undefined,
        limit: DEFAULT_PAGE_SIZE,
        offset: filters.page * DEFAULT_PAGE_SIZE,
      });

      setData(prev => ({
        ...prev,
        employees: result.data || [],
        totalCount: result.count || 0,
        loading: false,
      }));
    } catch (error) {
      logError(error, 'fetchEmployees');
      setData(prev => ({ ...prev, loading: false }));
    }
  }, [filters.department, filters.status, filters.page]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Filter by search (client-side for current page)
  const filteredEmployees = useMemo(() => {
    if (!filters.search) return data.employees;
    const searchLower = filters.search.toLowerCase();
    return data.employees.filter(emp => {
      const fullName = (emp.full_name || '').toLowerCase();
      const firstName = (emp.first_name || '').toLowerCase();
      const lastName = (emp.last_name || '').toLowerCase();
      const email = (emp.email || '').toLowerCase();
      const empCode = (emp.emp_code || emp.emp_id || '').toLowerCase();
      
      return (
        fullName.includes(searchLower) ||
        firstName.includes(searchLower) ||
        lastName.includes(searchLower) ||
        email.includes(searchLower) ||
        empCode.includes(searchLower)
      );
    });
  }, [data.employees, filters.search]);

  const totalPages = Math.ceil(data.totalCount / DEFAULT_PAGE_SIZE);

  // Update filters
  const setSearch = useCallback((search: string) => {
    setFilters(prev => ({ ...prev, search }));
  }, []);

  const setDepartment = useCallback((department: string) => {
    setFilters(prev => ({ ...prev, department, page: 0 }));
  }, []);

  const setStatus = useCallback((status: string) => {
    setFilters(prev => ({ ...prev, status, page: 0 }));
  }, []);

  const setPage = useCallback((page: number) => {
    setFilters(prev => ({ ...prev, page }));
  }, []);

  const nextPage = useCallback(() => {
    setFilters(prev => ({ ...prev, page: Math.min(totalPages - 1, prev.page + 1) }));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setFilters(prev => ({ ...prev, page: Math.max(0, prev.page - 1) }));
  }, []);

  return {
    employees: filteredEmployees,
    departments: data.departments,
    totalCount: data.totalCount,
    loading: data.loading,
    filters,
    totalPages,
    setSearch,
    setDepartment,
    setStatus,
    setPage,
    nextPage,
    prevPage,
    refetch: fetchEmployees,
  };
}
