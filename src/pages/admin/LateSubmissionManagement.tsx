import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cycleService, permissionsService } from '@/services';
import type { LateSubmissionEmployee } from '@/services/permissions.service';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Users, CheckCircle2, XCircle, Clock, Loader2, UserCheck, UserX, Search, Filter } from 'lucide-react';
import type { PerformanceCycle } from '@/lib/evaluationPeriods';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useActiveCycle } from '@/contexts/ActiveCycleContext';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from '@/components/ui/pagination';
import { DEFAULT_PAGE_SIZE, LATE_SUBMISSION_GRANT_EXTENSION_DAYS } from '@/utils/constants';

interface Employee {
  id: string;
  emp_code: string;
  emp_id?: string; // Backward compatibility
  full_name: string;
  first_name?: string; // Backward compatibility
  last_name?: string; // Backward compatibility
  email: string;
  department: string;
  manager_code?: string | null;
  manager_id?: string | null; // Backward compatibility
  manager_name?: string | null;
}


interface LatePermission {
  id: string;
  employee_id: string;
  revoked_at: string | null;
}

export default function LateSubmissionManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { quarterlyCycles } = useActiveCycle();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [targetEmployeeId, setTargetEmployeeId] = useState<string | null>(null);
  
  // Get quarter and tabs from URL - new structure: ?quarter=1&tab=employee&type=goals
  // Also support old format: ?quarter=1&type=manager-evaluations
  const urlQuarter = searchParams.get('quarter');
  const urlTab = searchParams.get('tab') as 'employee' | 'manager' | null;
  const urlType = searchParams.get('type') as 'goals' | 'evaluations' | 'manager-evaluations' | null;
  
  // Initialize state from URL (handle old format: type=manager-evaluations)
  const getInitialTopLevelTab = (): 'employee' | 'manager' => {
    if (urlTab === 'employee' || urlTab === 'manager') return urlTab;
    if (urlType === 'manager-evaluations') return 'manager';
    return 'employee';
  };
  
  const getInitialSubType = (): 'goals' | 'evaluations' => {
    if (urlType === 'goals' || urlType === 'evaluations') return urlType;
    if (urlType === 'manager-evaluations') return 'evaluations';
    return 'goals';
  };
  
  // New tab structure: top-level (employee/manager) and sub-type (goals/evaluations)
  const [topLevelTab, setTopLevelTab] = useState<'employee' | 'manager'>(getInitialTopLevelTab());
  const [subType, setSubType] = useState<'goals' | 'evaluations'>(getInitialSubType());
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Employee details search state
  const [showDetails, setShowDetails] = useState(false);
  const [quarterlyStatusData, setQuarterlyStatusData] = useState<any>(null);
  const [quarterlyStatusLoading, setQuarterlyStatusLoading] = useState(false);
  const [quarterlyStatusError, setQuarterlyStatusError] = useState<string | null>(null);
  
  // Ref to track if state update is from user interaction (prevents URL sync loop)
  const isUserInteraction = useRef(false);

  const isYearEnd = urlQuarter === 'year-end';
  const selectedQuarter = isYearEnd ? null : (urlQuarter ? parseInt(urlQuarter, 10) : null);
  
  // Sync state with URL params (handle both new and old URL formats)
  // Only runs when URL changes, not when state changes from user interaction
  useEffect(() => {
    // Skip if this update is from user interaction
    if (isUserInteraction.current) {
      isUserInteraction.current = false;
      return;
    }
    
    // Handle old format: type=manager-evaluations means manager tab + evaluations
    if (urlType === 'manager-evaluations') {
      setTopLevelTab('manager');
      setSubType('evaluations');
      // Update URL to new format
      const newParams = new URLSearchParams(searchParams);
      newParams.set('tab', 'manager');
      newParams.set('type', 'evaluations');
      setSearchParams(newParams, { replace: true });
      return;
    }
    
    // Only update state if URL params differ from current state
    if (urlTab === 'employee' || urlTab === 'manager') {
      if (topLevelTab !== urlTab) {
        setTopLevelTab(urlTab);
      }
    } else if (!urlTab && topLevelTab !== 'employee') {
      // Default to employee if no tab in URL
      setTopLevelTab('employee');
    }
    
    if (urlType === 'goals' || urlType === 'evaluations') {
      if (subType !== urlType) {
        setSubType(urlType);
      }
    } else if (!urlType && subType !== 'goals') {
      // Default to goals if no type in URL
      setSubType('goals');
    }
  }, [urlTab, urlType, searchParams, setSearchParams, topLevelTab, subType]);
  
  // Update URL when tabs change (only if URL doesn't match state)
  useEffect(() => {
    const currentTab = searchParams.get('tab');
    const currentType = searchParams.get('type');
    
    // Only update URL if it doesn't match current state
    if (currentTab !== topLevelTab || currentType !== subType) {
      // Mark as user interaction to prevent URL sync effect from running
      isUserInteraction.current = true;
      const newParams = new URLSearchParams(searchParams);
      newParams.set('tab', topLevelTab);
      newParams.set('type', subType);
      setSearchParams(newParams, { replace: true });
    }
  }, [topLevelTab, subType, searchParams, setSearchParams]);
  
  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(0);
  }, [selectedDepartment, debouncedSearchQuery, topLevelTab, subType, selectedQuarter]);
  
  // Map to API submissionType based on tab and type
  const submissionType = useMemo(() => {
    if (topLevelTab === 'manager' && subType === 'evaluations') {
      return 'manager-evaluations' as const;
    }
    if (topLevelTab === 'manager' && subType === 'goals') {
      return 'manager-goals-approval' as const;
    }
    // For employee + goals/evaluations, use the subType directly
    return subType as 'goals' | 'evaluations';
  }, [topLevelTab, subType]);

  // Debounce search query
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchQuery]);

  // Fetch all cycles (not just active) 
  const { data: cycles = [] } = useQuery({
    queryKey: ['all-cycles'],
    queryFn: async () => {
      const result = await cycleService.getList();
      return result.data || [];
    },
  });

  // Auto-select active cycle
  const activeCycle = cycles.find(c => c.status === 'active') as PerformanceCycle | undefined;
  const effectiveCycleId = selectedCycleId || activeCycle?.id || '';

  // Handle details button click - search for employee quarterly status
  const handleDetailsSearch = async () => {
    if (!searchQuery.trim() || !effectiveCycleId) {
      setQuarterlyStatusError('Please enter an employee code or email');
      return;
    }

    setShowDetails(true);
    setQuarterlyStatusLoading(true);
    setQuarterlyStatusError(null);
    setQuarterlyStatusData(null);

    try {
      // Try searching by emp_code first, then by email
      const result = await permissionsService.lateSubmission.getEmployeeQuarterlyStatus(
        searchQuery.trim(),
        effectiveCycleId
      );
      setQuarterlyStatusData(result.data);
    } catch (error: any) {
      setQuarterlyStatusError(error.message || 'Failed to fetch employee quarterly status');
      setQuarterlyStatusData(null);
    } finally {
      setQuarterlyStatusLoading(false);
    }
  };

  // Clear details when search query changes
  useEffect(() => {
    if (showDetails) {
      setShowDetails(false);
      setQuarterlyStatusData(null);
      setQuarterlyStatusError(null);
    }
  }, [searchQuery]);

  // Determine current active quarter based on business rules:
  // Case 1: If a quarter is currently active (between start and end), select it
  // Case 2: If no active quarter, select the most recent past quarter (end date has passed)
  // Case 3: Default to current quarter (highest started quarter) if no quarters have ended yet
  const currentActiveQuarter = useMemo(() => {
    if (!activeCycle) return 1;
    
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    // Case 1: Find the quarter that is currently active (between start and end)
    for (let q = 1; q <= 4; q++) {
      const startField = `q${q}_self_review_start` as keyof PerformanceCycle;
      const endField = `q${q}_self_review_end` as keyof PerformanceCycle;
      const start = activeCycle[startField] as string | null | undefined;
      const end = activeCycle[endField] as string | null | undefined;
      
      if (start && end) {
        const startDate = new Date(start);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(end);
        endDate.setHours(23, 59, 59, 999);
        
        // If current quarter (between start and end) - Case 1
        if (now >= startDate && now <= endDate) {
          return q;
        }
      }
    }
    
    // Case 2: If no active quarter, find the most recent past quarter (end date has passed)
    // This handles:
    // - Q2 ended, Q3 started -> select Q2 (most recent past)
    // - Q2 ended, Q3 not started -> select Q2 (most recent past)
    let mostRecentPastQ = null;
    for (let q = 1; q <= 4; q++) {
      const endField = `q${q}_self_review_end` as keyof PerformanceCycle;
      const end = activeCycle[endField] as string | null | undefined;
      
      if (end) {
        const endDate = new Date(end);
        endDate.setHours(23, 59, 59, 999);
        
        // If this quarter has ended, it's a candidate for most recent past quarter
        if (now > endDate) {
          mostRecentPastQ = Math.max(mostRecentPastQ || q, q);
        }
      }
    }
    
    // Case 3: If no quarters have ended yet, default to current quarter (highest started quarter)
    if (mostRecentPastQ === null) {
      let currentQ = 1;
      for (let q = 1; q <= 4; q++) {
        const startField = `q${q}_self_review_start` as keyof PerformanceCycle;
        const start = activeCycle[startField] as string | null | undefined;
        
        if (start) {
          const startDate = new Date(start);
          startDate.setHours(0, 0, 0, 0);
          
          // Track highest quarter that has started
          if (now >= startDate) {
            currentQ = Math.max(currentQ, q);
          }
        }
      }
      return currentQ;
    }
    
    return mostRecentPastQ;
  }, [activeCycle]);

  // Determine highest quarter that has started (for validation purposes)
  const highestStartedQuarter = useMemo(() => {
    if (!activeCycle) return 1;
    
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    let highestQ = 1;
    
    for (let q = 1; q <= 4; q++) {
      const startField = `q${q}_self_review_start` as keyof PerformanceCycle;
      const start = activeCycle[startField] as string | null | undefined;
      
      if (start) {
        const startDate = new Date(start);
        startDate.setHours(0, 0, 0, 0);
        
        // Track highest quarter that has started
        if (now >= startDate) {
          highestQ = Math.max(highestQ, q);
        }
      }
    }
    
    return highestQ;
  }, [activeCycle]);

  // Auto-select current active quarter and tab if not in URL (but not for year-end)
  useEffect(() => {
    let needsUpdate = false;
      const newParams = new URLSearchParams(searchParams);
    
    if (!urlQuarter && activeCycle && !isYearEnd) {
      newParams.set('quarter', currentActiveQuarter.toString());
      needsUpdate = true;
    }
    
    if (!urlTab && !isYearEnd) {
      newParams.set('tab', 'goals');
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      setSearchParams(newParams, { replace: true });
    }
  }, [urlQuarter, urlTab, activeCycle, currentActiveQuarter, searchParams, setSearchParams, isYearEnd]);

  // Use selectedQuarter from URL or currentActiveQuarter as fallback (for quarters only)
  const effectiveSelectedQuarter = isYearEnd ? 'year-end' : (selectedQuarter ?? currentActiveQuarter);

  // Auto-select highest started quarter if selected quarter hasn't started yet
  useEffect(() => {
    if (selectedQuarter !== null && selectedQuarter > highestStartedQuarter) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('quarter', highestStartedQuarter.toString());
      setSearchParams(newParams, { replace: true });
    }
  }, [highestStartedQuarter, selectedQuarter, searchParams, setSearchParams]);

  // Check if a quarter is accessible (has started or is current/past)
  const isQuarterAccessible = useMemo(() => {
    return (quarter: number): boolean => {
      if (!activeCycle) return quarter === 1;
      
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      
      const startField = `q${quarter}_self_review_start` as keyof PerformanceCycle;
      const start = activeCycle[startField] as string | null | undefined;
      
      if (start) {
        const startDate = new Date(start);
        startDate.setHours(0, 0, 0, 0);
        // Quarter is accessible if it has started
        return now >= startDate;
      }
      
      // If no start date, only allow Q1
      return quarter === 1;
    };
  }, [activeCycle]);

  // Fetch employees/managers who missed deadline from API (includes submission status and permissions)
  const { data: lateSubmissionEmployees = [], isLoading: employeesLoading, error: employeesError, refetch: refetchEmployees } = useQuery({
    queryKey: ['late-submission-employees', effectiveCycleId, effectiveSelectedQuarter, submissionType, topLevelTab],
    enabled: !!effectiveCycleId,
    queryFn: async () => {
      const result = await permissionsService.lateSubmission.getByCycle(
        effectiveCycleId, 
        effectiveSelectedQuarter, 
        submissionType,
        topLevelTab // Pass role parameter
      );
      return result.data || [];
    },
  });

  // Fetch late submission details from API
  const { 
    data: submissionDetails, 
    isLoading: detailsLoading,
    error: detailsError,
    refetch: refetchDetails
  } = useQuery({
    queryKey: ['late-submission-details', effectiveCycleId, effectiveSelectedQuarter, submissionType],
    enabled: !!effectiveCycleId,
    queryFn: async () => {
      const result = await permissionsService.lateSubmission.getDetails(effectiveCycleId, effectiveSelectedQuarter, submissionType);
      return result.data;
    },
  });

  // Use API data for stats - separate goals, evaluations, and manager evaluations
  const totalEmployees = submissionDetails?.totalEmployees || 0;
  const totalManagers = submissionDetails?.totalManagers || 0;
  const goalsStats = submissionDetails?.goals || {
    submitted: 0,
    missedDeadline: 0,
    lateAccessGranted: 0,
    quarter: null,
    isPastDeadline: false,
    hasStarted: false,
    startDate: null,
  };
  const evaluationsStats = submissionDetails?.evaluations || {
    submitted: 0,
    missedDeadline: 0,
    lateAccessGranted: 0,
    quarter: null,
    isPastDeadline: false,
    hasStarted: false,
    startDate: null,
  };
  const managerEvaluationsStats = submissionDetails?.managerEvaluations || {
    submitted: 0,
    missedDeadline: 0,
    lateAccessGranted: 0,
    quarter: null,
    isPastDeadline: false,
    hasStarted: false,
    startDate: null,
  };
  const managerGoalsApprovalStats = submissionDetails?.managerGoalsApproval || {
    submitted: 0,
    missedDeadline: 0,
    lateAccessGranted: 0,
    quarter: null,
    isPastDeadline: false,
    hasStarted: false,
    startDate: null,
  };
  
  // Extract unique departments from employees
  const uniqueDepartments = useMemo(() => {
    const departments = new Set<string>();
    lateSubmissionEmployees.forEach((emp: LateSubmissionEmployee) => {
      if (emp.department) {
        departments.add(emp.department);
      }
    });
    return Array.from(departments).sort();
  }, [lateSubmissionEmployees]);

  // Filter employees/managers who missed the deadline (haven't submitted for the selected quarter)
  const missedDeadlineEmployees = lateSubmissionEmployees.filter(
    (emp: LateSubmissionEmployee) => !emp.has_submitted
  );

  // Apply search and department filters
  const filteredMissedDeadlineEmployees = useMemo(() => {
    let filtered = missedDeadlineEmployees;

    // Apply department filter
    if (selectedDepartment !== 'all') {
      filtered = filtered.filter((emp: LateSubmissionEmployee) => emp.department === selectedDepartment);
    }

    // Apply search filter (emp_code and email)
    if (debouncedSearchQuery.trim()) {
      const searchLower = debouncedSearchQuery.toLowerCase().trim();
      filtered = filtered.filter((emp: LateSubmissionEmployee) => {
        const empCode = (emp.emp_code || '').toLowerCase();
        const email = (emp.employee_email || '').toLowerCase();
        return empCode.includes(searchLower) || email.includes(searchLower);
      });
    }

    return filtered;
  }, [missedDeadlineEmployees, selectedDepartment, debouncedSearchQuery]);

  // Pagination for filtered employees
  const totalPages = Math.ceil(filteredMissedDeadlineEmployees.length / DEFAULT_PAGE_SIZE);
  const paginatedEmployees = useMemo(() => {
    const start = currentPage * DEFAULT_PAGE_SIZE;
    const end = start + DEFAULT_PAGE_SIZE;
    return filteredMissedDeadlineEmployees.slice(start, end);
  }, [filteredMissedDeadlineEmployees, currentPage]);

  // Recalculate stats based on filtered employees
  const filteredStats = useMemo(() => {
    // Get all employees (not just missed deadline) for the selected department
    let allFilteredEmployees = lateSubmissionEmployees;
    
    if (selectedDepartment !== 'all') {
      allFilteredEmployees = allFilteredEmployees.filter(
        (emp: LateSubmissionEmployee) => emp.department === selectedDepartment
      );
    }

    // Apply search filter to all employees
    if (debouncedSearchQuery.trim()) {
      const searchLower = debouncedSearchQuery.toLowerCase().trim();
      allFilteredEmployees = allFilteredEmployees.filter((emp: LateSubmissionEmployee) => {
        const empCode = (emp.emp_code || '').toLowerCase();
        const email = (emp.employee_email || '').toLowerCase();
        return empCode.includes(searchLower) || email.includes(searchLower);
      });
    }

    const totalFiltered = allFilteredEmployees.length;
    const submittedFiltered = allFilteredEmployees.filter((emp: LateSubmissionEmployee) => emp.has_submitted).length;
    const missedFiltered = allFilteredEmployees.filter((emp: LateSubmissionEmployee) => !emp.has_submitted).length;
    const lateAccessFiltered = allFilteredEmployees.filter((emp: LateSubmissionEmployee) => 
      emp.permission && !emp.permission.revoked_at
    ).length;

    return {
      totalEmployees: totalFiltered,
      submitted: submittedFiltered,
      missedDeadline: missedFiltered,
      lateAccessGranted: lateAccessFiltered,
    };
  }, [lateSubmissionEmployees, selectedDepartment, debouncedSearchQuery]);
  
  // Use stats based on selected type
  const currentStats = submissionType === 'goals'
    ? goalsStats 
    : submissionType === 'evaluations' 
    ? evaluationsStats 
    : submissionType === 'manager-goals-approval'
    ? managerGoalsApprovalStats
    : managerEvaluationsStats;
  
  // Use filtered stats if filters are applied, otherwise use API stats
  const hasActiveFilters = selectedDepartment !== 'all' || debouncedSearchQuery.trim() !== '';
  const submittedCount = hasActiveFilters ? filteredStats.submitted : currentStats.submitted;
  const missedCount = hasActiveFilters ? filteredStats.missedDeadline : currentStats.missedDeadline;
  const lateAccessCount = hasActiveFilters ? filteredStats.lateAccessGranted : currentStats.lateAccessGranted;
  // For manager views:
  // - For manager-goals-approval: use totalEmployees (all managers from profiles table)
  //   totalManagers (from API) represents managers with reportees who have goals
  // - For manager-evaluations: use totalManagers (from API response)
  // For employee views: use totalEmployees directly
  const totalCount = hasActiveFilters 
    ? filteredStats.totalEmployees 
    : (submissionType === 'manager-goals-approval' 
        ? totalEmployees  // Use totalEmployees (all managers from profiles) for display
        : submissionType === 'manager-evaluations' 
        ? totalManagers  // Use totalManagers from API for manager evaluations
        : totalEmployees);
  const isPastDeadline = currentStats.isPastDeadline;
  const hasStarted = currentStats.hasStarted ?? true; // Default to true for backwards compatibility
  const startDate = currentStats.startDate;
  
  // Check if manager evaluations tab is eligible (only show when manager review window has ended)
  // This should be checked regardless of current tab selection
  const isManagerEvaluationsEligible = useMemo(() => {
    if (!selectedQuarter || !quarterlyCycles || isYearEnd) {
      return false;
    }
    
    const quarterlyCycle = quarterlyCycles.find(qc => {
      const qcQuarter = typeof qc.quarter === 'string' ? parseInt(qc.quarter) : qc.quarter;
      return qcQuarter === selectedQuarter;
    });
    
    if (!quarterlyCycle?.quarterly_manager_review_end_date) {
      return false;
    }
    
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const endDate = new Date(quarterlyCycle.quarterly_manager_review_end_date);
    endDate.setHours(23, 59, 59, 999);
    
    return now > endDate;
  }, [selectedQuarter, quarterlyCycles, isYearEnd]);
  
  // Group managers by pending reportees for manager-evaluations view
  const managersByPendingReportees = useMemo(() => {
    if (submissionType !== 'manager-evaluations') return new Map();
    
    const grouped = new Map<string, {
      manager_id: string;
      manager_emp_code: string;
      manager_name: string;
      reportees: Array<{
        employee_id: string;
        emp_code: string;
        employee_name: string;
        date_of_joining?: string;
      }>;
    }>();
    
    filteredMissedDeadlineEmployees.forEach((manager: any) => {
      if (manager.pending_reportees && manager.pending_reportees.length > 0) {
        grouped.set(manager.employee_id, {
          manager_id: manager.employee_id,
          manager_emp_code: manager.emp_code,
          manager_name: manager.employee_name,
          reportees: manager.pending_reportees
        });
      }
    });
    
    return grouped;
  }, [filteredMissedDeadlineEmployees, submissionType]);

  // Group managers by pending employees for Manager tab with Goals
  const managersByPendingEmployees = useMemo(() => {
    if (topLevelTab !== 'manager' || subType !== 'goals') return new Map();
    
    const grouped = new Map<string, {
      manager_id: string;
      manager_emp_code: string;
      manager_name: string;
      employees: Array<{
        employee_id: string;
        emp_code: string;
        employee_name: string;
        pending_goals_count?: number;
      }>;
    }>();
    
    filteredMissedDeadlineEmployees.forEach((manager: any) => {
      if (manager.pending_employees && manager.pending_employees.length > 0) {
        grouped.set(manager.employee_id, {
          manager_id: manager.employee_id,
          manager_emp_code: manager.emp_code,
          manager_name: manager.employee_name,
          employees: manager.pending_employees
        });
      }
    });
    
    return grouped;
  }, [filteredMissedDeadlineEmployees, topLevelTab, subType]);

  // Group employees by manager for year-end view
  const employeesByManager = useMemo(() => {
    if (!isYearEnd) return new Map();
    
    const grouped = new Map<string, {
      manager_code: string;
      manager_name: string;
      manager_emp_code: string;
      reportees: LateSubmissionEmployee[];
    }>();
    
    filteredMissedDeadlineEmployees.forEach((emp: any) => {
      const managerCode = emp.manager_code || '__no_manager__';
      const managerName = emp.manager_name || 'No Manager Assigned';
      const managerEmpCode = emp.manager_emp_code || emp.manager_code || '-';
      
      if (!grouped.has(managerCode)) {
        grouped.set(managerCode, {
          manager_code: managerCode === '__no_manager__' ? '' : managerCode,
          manager_name: managerName,
          manager_emp_code: managerEmpCode,
          reportees: []
        });
      }
      
      grouped.get(managerCode)!.reportees.push(emp);
    });
    
    return grouped;
  }, [filteredMissedDeadlineEmployees, isYearEnd]);

  // Check if employee has late permission
  const hasLatePermission = (employeeId: string) => {
    const emp = lateSubmissionEmployees.find((e: LateSubmissionEmployee) => e.employee_id === employeeId);
    return emp?.permission && !emp.permission.revoked_at;
  };

  // Grant permission mutation with configurable expiry
  const grantMutation = useMutation({
    mutationFn: async (employeeIds: string[]) => {
      // Calculate expiry date using constant
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + LATE_SUBMISSION_GRANT_EXTENSION_DAYS);
      expiresAt.setHours(23, 59, 59, 999); // End of day
      
      for (const empId of employeeIds) {
        await permissionsService.lateSubmission.grant({
          cycle_id: effectiveCycleId,
          employee_id: empId,
          granted_by: user?.id || '',
          reason: reason || undefined,
          expires_at: expiresAt.toISOString(),
          quarter: effectiveSelectedQuarter,  // Quarter-specific permission or 'year-end'
          type: submissionType,  // Include type (goals, evaluations, manager-goals-approval, or manager-evaluations)
          role: topLevelTab,  // Include role (employee or manager) to scope the permission
        });
      }
    },
    onSuccess: async () => {
      const periodLabel = isYearEnd ? 'Year-End Evaluation' : `Q${effectiveSelectedQuarter}`;
      toast({ title: `Late submission access granted for ${periodLabel}` });
      // Invalidate and refetch queries to immediately show updated permissions
      await queryClient.invalidateQueries({ queryKey: ['late-submission-employees', effectiveCycleId, effectiveSelectedQuarter, submissionType] });
      await queryClient.invalidateQueries({ queryKey: ['late-submission-details', effectiveCycleId, effectiveSelectedQuarter, submissionType] });
      // Explicitly refetch to ensure UI updates immediately
      await refetchEmployees();
      await refetchDetails();
      setSelectedEmployees(new Set());
      setGrantDialogOpen(false);
      setReason('');
      setTargetEmployeeId(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Revoke permission mutation
  const revokeMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      await permissionsService.lateSubmission.revoke(effectiveCycleId, employeeId, effectiveSelectedQuarter);
    },
    onSuccess: async () => {
      const periodLabel = isYearEnd ? 'Year-End Evaluation' : `Q${effectiveSelectedQuarter}`;
      toast({ title: `Late submission access revoked for ${periodLabel}` });
      await queryClient.invalidateQueries({ queryKey: ['late-submission-employees', effectiveCycleId, effectiveSelectedQuarter, submissionType] });
      await queryClient.invalidateQueries({ queryKey: ['late-submission-details', effectiveCycleId, effectiveSelectedQuarter, submissionType] });
      // Explicitly refetch to ensure UI updates immediately
      await refetchEmployees();
      await refetchDetails();
      setRevokeDialogOpen(false);
      setTargetEmployeeId(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEmployees(new Set(filteredMissedDeadlineEmployees.filter(e => !hasLatePermission(e.employee_id)).map(e => e.employee_id)));
    } else {
      setSelectedEmployees(new Set());
    }
  };

  const handleSelectEmployee = (employeeId: string, checked: boolean) => {
    const newSet = new Set(selectedEmployees);
    if (checked) {
      newSet.add(employeeId);
    } else {
      newSet.delete(employeeId);
    }
    setSelectedEmployees(newSet);
  };

  const handleGrantSingle = (employeeId: string) => {
    setTargetEmployeeId(employeeId);
    setGrantDialogOpen(true);
  };

  const handleRevokeSingle = (employeeId: string) => {
    setTargetEmployeeId(employeeId);
    setRevokeDialogOpen(true);
  };

  const handleGrantConfirm = () => {
    const employeeIds = targetEmployeeId ? [targetEmployeeId] : Array.from(selectedEmployees);
    grantMutation.mutate(employeeIds);
  };

  const handleRevokeConfirm = () => {
    if (targetEmployeeId) {
      revokeMutation.mutate(targetEmployeeId);
    }
  };

  // Show loading state while checking auth
  if (!user) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Checking authentication...</span>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Late Submission Management</h1>
            <p className="text-muted-foreground">
              Grant late goal submission access to employees who missed the deadline
            </p>
          </div>
          <Select value={effectiveCycleId} onValueChange={setSelectedCycleId}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Select cycle" />
            </SelectTrigger>
            <SelectContent>
              {cycles.map((cycle) => (
                <SelectItem key={cycle.id} value={cycle.id}>
                  {cycle.name} {cycle.status === 'active' && '(Active)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Error/Loading States */}
        {(employeesLoading || detailsLoading) && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>Loading data...</AlertDescription>
          </Alert>
        )}
        {employeesError && (
          <Alert variant="destructive">
            <AlertDescription>
              Failed to load employees: {(employeesError as Error).message}
            </AlertDescription>
          </Alert>
        )}
        {detailsError && (
          <Alert variant="destructive">
            <AlertDescription>
              Failed to load submission details: {(detailsError as Error).message}
            </AlertDescription>
          </Alert>
        )}

        {/* Quarter Tabs */}
        <Tabs value={isYearEnd ? 'year-end' : `q${effectiveSelectedQuarter}`} onValueChange={(value) => {
            const newParams = new URLSearchParams(searchParams);
          if (value === 'year-end') {
            newParams.set('quarter', 'year-end');
            newParams.set('tab', 'employee'); // Default to employee for year-end
            newParams.set('type', 'goals');
          } else {
            const q = parseInt(value.replace('q', ''));
            // Don't allow switching to a quarter that hasn't started yet
            if (!isQuarterAccessible(q)) {
              return;
            }
              newParams.set('quarter', q.toString());
            // Ensure tab and type are set when switching to quarterly view
            if (!newParams.get('tab')) {
              newParams.set('tab', topLevelTab);
            }
            if (!newParams.get('type')) {
              newParams.set('type', subType);
            }
          }
          setSearchParams(newParams);
        }}>
          <TabsList>
            <TabsTrigger value="q1" disabled={!isQuarterAccessible(1)}>Q1</TabsTrigger>
            <TabsTrigger value="q2" disabled={!isQuarterAccessible(2)}>Q2</TabsTrigger>
            <TabsTrigger value="q3" disabled={!isQuarterAccessible(3)}>Q3</TabsTrigger>
            <TabsTrigger value="q4" disabled={!isQuarterAccessible(4)}>Q4</TabsTrigger>
            <TabsTrigger value="year-end">Year-End Eval</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Top-level Tabs: Employee / Manager */}
        {!isYearEnd && (
          <Tabs value={topLevelTab} onValueChange={(value) => {
            const newTab = value as 'employee' | 'manager';
            // Mark as user interaction to prevent URL sync loop
            isUserInteraction.current = true;
            setTopLevelTab(newTab);
            // Reset type to goals when switching top-level tabs
            setSubType('goals');
          }}>
            <TabsList>
              <TabsTrigger value="employee">Employee</TabsTrigger>
              <TabsTrigger value="manager">Manager</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {/* Sub-tabs: Goals / Evaluations (inside each top-level tab) */}
        {!isYearEnd && (
          <Tabs value={subType} onValueChange={(value) => {
            const newType = value as 'goals' | 'evaluations';
            // Mark as user interaction to prevent URL sync loop
            isUserInteraction.current = true;
            setSubType(newType);
          }}>
            <TabsList>
              <TabsTrigger value="goals">Goals</TabsTrigger>
              <TabsTrigger value="evaluations">Evaluations</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {submissionType === 'manager-evaluations' || submissionType === 'manager-goals-approval' ? 'Total Managers' : 'Total Employees'}
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" aria-live="polite" aria-atomic="true">
                {(employeesLoading || detailsLoading) 
                  ? '-' 
                  : totalCount}
              </div>
              {hasActiveFilters && (
                <p className="text-xs text-muted-foreground mt-1" role="status">
                  Filtered results
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Submitted</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" aria-live="polite" aria-atomic="true">{submittedCount}</div>
              <p className="text-xs text-muted-foreground mt-1" role="status">
                {totalCount > 0 ? `${Math.round((submittedCount / totalCount) * 100)}%` : '0%'} of total
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Missed Deadline</CardTitle>
              <XCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive" aria-live="polite" aria-atomic="true">{missedCount}</div>
              <p className="text-xs text-muted-foreground mt-1" role="status">
                {isPastDeadline 
                  ? `${missedCount} not submitted` 
                  : 'Deadline not passed'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Late Access Granted</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600" aria-live="polite" aria-atomic="true">{lateAccessCount}</div>
              <p className="text-xs text-muted-foreground mt-1" role="status">
                Active permissions
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Employees Table / Accordion */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>
                    {isYearEnd 
                      ? `Managers with Pending Year-End Evaluations (${employeesByManager.size})`
                      : topLevelTab === 'manager'
                      ? `Managers with Pending ${subType === 'goals' ? 'Goal Approvals' : 'Evaluation Approvals'} (${filteredMissedDeadlineEmployees.length})`
                      : `Employees Who Missed ${subType === 'goals' ? 'Goals' : 'Evaluations'} Deadline (${filteredMissedDeadlineEmployees.length})`}
                  </CardTitle>
                  <CardDescription>
                    {isYearEnd
                      ? 'Managers with reportees who have not submitted their year-end evaluations'
                      : topLevelTab === 'manager'
                      ? (isPastDeadline 
                        ? `Managers who have not approved ${subType === 'goals' ? 'goals' : 'evaluations'} for their reportees`
                        : 'Deadline has not passed yet')
                      : (isPastDeadline 
                        ? `These employees have not submitted their ${subType === 'goals' ? 'goals' : 'self-evaluations'} for this quarter`
                        : 'Deadline has not passed yet')}
                  </CardDescription>
                </div>
                {selectedEmployees.size > 0 && (
                  <Button onClick={() => setGrantDialogOpen(true)}>
                    <UserCheck className="mr-2 h-4 w-4" aria-hidden="true" />
                    Grant Access ({selectedEmployees.size})
                  </Button>
                )}
              </div>
              
              {/* Search and Filter Controls */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Label htmlFor="employee-search" className="sr-only">
                    Search employees by employee code or email
                  </Label>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="employee-search"
                    type="search"
                    placeholder="Search by employee code or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    aria-label="Search employees by employee code or email"
                    aria-describedby="search-description"
                  />
                  <span id="search-description" className="sr-only">
                    Enter employee code or email to filter the list. Results update automatically as you type.
                  </span>
                </div>
                <Button
                  onClick={handleDetailsSearch}
                  disabled={!searchQuery.trim() || quarterlyStatusLoading}
                  variant="outline"
                  className="sm:w-auto"
                  aria-label="View employee quarterly details"
                >
                  {quarterlyStatusLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" aria-hidden="true" />
                      Details
                    </>
                  )}
                </Button>
                <div className="sm:w-[200px]">
                  <Label htmlFor="department-filter" className="sr-only">
                    Filter by department
                  </Label>
                  <Select 
                    value={selectedDepartment} 
                    onValueChange={setSelectedDepartment}
                  >
                    <SelectTrigger id="department-filter" aria-label="Filter by department">
                      <Filter className="mr-2 h-4 w-4" aria-hidden="true" />
                      <SelectValue placeholder="All Departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {uniqueDepartments.map((dept) => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Quarterly Status Results (shown when Details button is clicked) */}
            {showDetails && (
              <>
                {quarterlyStatusError && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{quarterlyStatusError}</AlertDescription>
                  </Alert>
                )}
                
                {quarterlyStatusLoading && (
                  <div className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" aria-hidden="true" />
                    <p className="text-sm text-muted-foreground">Loading quarterly status...</p>
                  </div>
                )}
                
                {quarterlyStatusData && !quarterlyStatusLoading && (
                  <div className="mb-6 space-y-4">
                    <div className="border-b pb-3 mb-4">
                      <h3 className="font-semibold text-lg">{quarterlyStatusData.employee.full_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {quarterlyStatusData.employee.emp_code} • {quarterlyStatusData.employee.department}
                      </p>
                    </div>
                    
                    <div className="space-y-4">
                      {quarterlyStatusData.quarters.map((q: any) => (
                        <Card key={q.quarter}>
                          <CardHeader>
                            <CardTitle className="text-base">Q{q.quarter}</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {/* Goals Section */}
                            <div>
                              <h4 className="font-medium mb-3">Goals</h4>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Employee: </span>
                                  <Badge variant={q.goals.employee_status === 'submitted' ? 'default' : 'destructive'}>
                                    {q.goals.employee_status}
                                  </Badge>
                                  {q.goals.employee_submitted_at && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Submitted: {new Date(q.goals.employee_submitted_at).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Manager: </span>
                                  <Badge variant={q.goals.manager_status === 'approved' ? 'default' : 'destructive'}>
                                    {q.goals.manager_status}
                                  </Badge>
                                  {q.goals.manager_approved_at && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Approved: {new Date(q.goals.manager_approved_at).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {/* Evaluations Section */}
                            <div>
                              <h4 className="font-medium mb-3">Evaluations</h4>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Employee: </span>
                                  <Badge variant={q.evaluations.employee_status === 'submitted' ? 'default' : 'destructive'}>
                                    {q.evaluations.employee_status}
                                  </Badge>
                                  {q.evaluations.employee_submitted_at && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Submitted: {new Date(q.evaluations.employee_submitted_at).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Manager: </span>
                                  <Badge variant={q.evaluations.manager_status === 'submitted' ? 'default' : 'destructive'}>
                                    {q.evaluations.manager_status}
                                  </Badge>
                                  {q.evaluations.manager_submitted_at && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Submitted: {new Date(q.evaluations.manager_submitted_at).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            
            {/* Original content - only show if details is not active */}
            {!showDetails && (
              <>
                {!hasStarted && !isYearEnd && submissionType !== 'manager-evaluations' && submissionType !== 'manager-goals-approval' ? (
                  <div className="text-center py-8 text-muted-foreground">
                <p className="text-lg font-medium mb-2">
                  {submissionType === 'goals' ? 'Goal submission period' : 'Evaluation period'} has not started yet
                </p>
                <p className="text-sm">
                  {startDate 
                    ? `Starts on ${new Date(startDate).toLocaleDateString()}. Check back later.`
                    : 'Start date is not configured for this quarter.'}
                </p>
              </div>
            ) : !isPastDeadline && !isYearEnd && submissionType !== 'manager-evaluations' && submissionType !== 'manager-goals-approval' ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-lg font-medium mb-2">
                  {submissionType === 'goals' ? 'Goal submission' : 'Evaluation'} period is still ongoing
                </p>
                <p className="text-sm">
                  The deadline has not passed yet. Employees can still submit their {submissionType === 'goals' ? 'goals' : 'self-evaluations'}.
                </p>
              </div>
            ) : !isManagerEvaluationsEligible && submissionType === 'manager-evaluations' ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-lg font-medium mb-2">
                  Manager review window has not ended yet
                </p>
                <p className="text-sm">
                  Manager evaluations late submission data will be available after the manager review deadline has passed.
                </p>
              </div>
            ) : isYearEnd ? (
              // Year-End Accordion View
              employeesByManager.size === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  All employees have submitted their year-end evaluations on time!
                </div>
              ) : (
                <Accordion type="single" collapsible className="w-full">
                  {Array.from(employeesByManager.entries()).map(([managerCode, managerData]) => {
                    const pendingCount = managerData.reportees.filter(e => !hasLatePermission(e.employee_id)).length;
                    const allReporteeIds = managerData.reportees.map(e => e.employee_id);
                    const selectedForManager = allReporteeIds.filter(id => selectedEmployees.has(id));
                    
                    return (
                      <AccordionItem key={managerCode} value={managerCode}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center justify-between w-full pr-4">
                            <div className="flex items-center gap-4">
                              <div className="text-left">
                                <div className="font-medium">
                                  {managerData.manager_name} ({managerData.manager_emp_code})
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  Pending: {pendingCount} reportee{pendingCount !== 1 ? 's' : ''}
                                </div>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                const pendingIds = managerData.reportees
                                  .filter(e => !hasLatePermission(e.employee_id))
                                  .map(e => e.employee_id);
                                if (pendingIds.length > 0) {
                                  setSelectedEmployees(new Set(pendingIds));
                                  setGrantDialogOpen(true);
                                }
                              }}
                              disabled={pendingCount === 0}
                            >
                              <UserCheck className="mr-1 h-3 w-3" />
                              Grant Access
                            </Button>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2 pt-2">
                            {managerData.reportees.map((emp) => {
                              const hasPermission = hasLatePermission(emp.employee_id);
                              return (
                                <div
                                  key={emp.employee_id}
                                  className="flex items-center justify-between p-3 border rounded-lg"
                                >
                                  <div className="flex items-center gap-4 flex-1">
                                    <Checkbox
                                      checked={selectedEmployees.has(emp.employee_id)}
                                      onCheckedChange={(checked) => handleSelectEmployee(emp.employee_id, !!checked)}
                                      disabled={hasPermission}
                                    />
                                    <div className="flex-1">
                                      <div className="font-medium">{emp.employee_name || 'Unknown'}</div>
                                      <div className="text-sm text-muted-foreground">
                                        {emp.emp_code} • Joined: {emp.date_of_joining ? new Date(emp.date_of_joining).toLocaleDateString() : 'N/A'}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <Badge variant={emp.has_submitted ? 'default' : 'destructive'}>
                                      {emp.has_submitted ? 'Submitted' : 'Not Submitted'}
                                    </Badge>
                                    {hasPermission ? (
                                      <Badge className="bg-amber-500 hover:bg-amber-600">
                                        <Clock className="mr-1 h-3 w-3" />
                                        Granted
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline">Not Granted</Badge>
                                    )}
                                    {hasPermission ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleRevokeSingle(emp.employee_id)}
                                      >
                                        <UserX className="mr-1 h-3 w-3" />
                                        Revoke
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        onClick={() => handleGrantSingle(emp.employee_id)}
                                      >
                                        <UserCheck className="mr-1 h-3 w-3" />
                                        Grant
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )
            ) : submissionType === 'manager-goals-approval' ? (
              // Manager Goals Accordion View
              // Only show managers who have reportees with pending goal approvals
              managersByPendingEmployees.size === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-lg font-medium mb-2">All managers have approved all pending goals on time!</p>
                  <p className="text-sm">No managers with pending goal approvals found.</p>
                </div>
              ) : (
                <Accordion type="single" collapsible className="w-full">
                  {Array.from(managersByPendingEmployees.entries()).map(([managerId, managerData]) => {
                    const pendingCount = managerData.employees.length;
                    const hasPermission = hasLatePermission(managerId);
                    
                    return (
                      <AccordionItem key={managerId} value={managerId}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center justify-between w-full pr-4">
                            <div className="flex items-center gap-4">
                              <div className="text-left">
                                <div className="font-medium">
                                  {managerData.manager_name} ({managerData.manager_emp_code})
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {pendingCount} reportee{pendingCount !== 1 ? 's' : ''} with pending goal{pendingCount !== 1 ? 's' : ''}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {hasPermission ? (
                                <>
                                  <Badge className="bg-amber-500 hover:bg-amber-600">
                                    <Clock className="mr-1 h-3 w-3" aria-hidden="true" />
                                    Granted
                                  </Badge>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRevokeSingle(managerId);
                                    }}
                                    aria-label={`Revoke late submission access for ${managerData.manager_name}`}
                                  >
                                    <UserX className="mr-1 h-3 w-3" aria-hidden="true" />
                                    Revoke
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTargetEmployeeId(managerId);
                                    setGrantDialogOpen(true);
                                  }}
                                  aria-label={`Grant late submission access to ${managerData.manager_name} for goal approvals`}
                                >
                                  <UserCheck className="mr-1 h-3 w-3" aria-hidden="true" />
                                  Grant Access
                                </Button>
                              )}
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2 pt-2">
                            {managerData.employees.map((employee) => {
                              return (
                                <div
                                  key={employee.employee_id}
                                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                  <div className="flex-1">
                                    <div className="font-medium">{employee.employee_name || 'Unknown'}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {employee.emp_code} • {employee.pending_goals_count || 0} goal{(employee.pending_goals_count || 0) !== 1 ? 's' : ''} pending approval
                                    </div>
                                  </div>
                                  <Badge variant="destructive" aria-label="Approval pending">
                                    Approval Pending
                                  </Badge>
                                </div>
                              );
                            })}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )
            ) : (topLevelTab === 'manager' && subType === 'evaluations') || submissionType === 'manager-evaluations' ? (
              // Manager Evaluations Accordion View
              managersByPendingReportees.size === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  All managers have completed reviews for all their reportees on time!
                </div>
              ) : (
                <Accordion type="single" collapsible className="w-full">
                  {Array.from(managersByPendingReportees.entries()).map(([managerId, managerData]) => {
                    const pendingCount = managerData.reportees.length;
                    const hasPermission = hasLatePermission(managerId);
                    
                    return (
                      <AccordionItem key={managerId} value={managerId}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center justify-between w-full pr-4">
                            <div className="flex items-center gap-4">
                              <div className="text-left">
                                <div className="font-medium">
                                  {managerData.manager_name} ({managerData.manager_emp_code})
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  Pending: {pendingCount} reportee{pendingCount !== 1 ? 's' : ''}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {hasPermission ? (
                                <>
                                  <Badge className="bg-amber-500 hover:bg-amber-600">
                                    <Clock className="mr-1 h-3 w-3" />
                                    Granted
                                  </Badge>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRevokeSingle(managerId);
                                    }}
                                  >
                                    <UserX className="mr-1 h-3 w-3" />
                                    Revoke
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTargetEmployeeId(managerId);
                                    setGrantDialogOpen(true);
                                  }}
                                >
                                  <UserCheck className="mr-1 h-3 w-3" />
                                  Grant Access
                                </Button>
                              )}
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2 pt-2">
                            {managerData.reportees.map((reportee) => {
                              return (
                                <div
                                  key={reportee.employee_id}
                                  className="flex items-center justify-between p-3 border rounded-lg"
                                >
                                  <div className="flex-1">
                                    <div className="font-medium">{reportee.employee_name || 'Unknown'}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {reportee.emp_code} • Joined: {reportee.date_of_joining ? new Date(reportee.date_of_joining).toLocaleDateString() : 'N/A'}
                                    </div>
                                  </div>
                                  <Badge variant="destructive">Review Pending</Badge>
                                </div>
                              );
                            })}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )
            ) : filteredMissedDeadlineEmployees.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" role="status">
                {hasActiveFilters ? (
                  <div>
                    <p className="text-lg font-medium mb-2">No employees found matching your filters</p>
                    <p className="text-sm">Try adjusting your search or department filter</p>
                  </div>
                ) : (
                  <p>All employees have submitted their {submissionType === 'goals' ? 'goals' : 'self-evaluations'} on time!</p>
                )}
              </div>
            ) : (
              // Regular Quarter Table View with Pagination
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={
                              paginatedEmployees.filter(e => !hasLatePermission(e.employee_id)).length > 0 &&
                              paginatedEmployees.filter(e => !hasLatePermission(e.employee_id)).every(e => selectedEmployees.has(e.employee_id))
                            }
                            onCheckedChange={(checked) => {
                              if (checked) {
                                const pageEmployeeIds = paginatedEmployees
                                  .filter(e => !hasLatePermission(e.employee_id))
                                  .map(e => e.employee_id);
                                setSelectedEmployees(new Set([...Array.from(selectedEmployees), ...pageEmployeeIds]));
                              } else {
                                const pageEmployeeIds = new Set(paginatedEmployees.map(e => e.employee_id));
                                setSelectedEmployees(new Set(Array.from(selectedEmployees).filter(id => !pageEmployeeIds.has(id))));
                              }
                            }}
                            aria-label="Select all employees on this page"
                          />
                        </TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Manager</TableHead>
                        <TableHead>{submissionType === 'goals' ? 'Goal Status' : 'Evaluation Status'}</TableHead>
                        <TableHead>Late Access</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedEmployees.map((emp) => {
                      const hasPermission = hasLatePermission(emp.employee_id);
                      return (
                        <TableRow key={emp.employee_id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedEmployees.has(emp.employee_id)}
                              onCheckedChange={(checked) => handleSelectEmployee(emp.employee_id, !!checked)}
                              disabled={hasPermission}
                              aria-label={`Select ${emp.employee_name || emp.emp_code}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {emp.employee_name || 'Unknown'}
                              </div>
                              <div className="text-xs text-muted-foreground">{emp.emp_code}</div>
                            </div>
                          </TableCell>
                          <TableCell>{emp.department}</TableCell>
                          <TableCell>{emp.manager_name || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={emp.has_submitted ? 'default' : 'destructive'} aria-label={emp.has_submitted ? 'Submitted' : 'Not submitted'}>
                              {emp.has_submitted ? 'Submitted' : 'Not Submitted'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {hasPermission ? (
                              <Badge className="bg-amber-500 hover:bg-amber-600" aria-label="Late access granted">
                                <Clock className="mr-1 h-3 w-3" aria-hidden="true" />
                                Granted
                              </Badge>
                            ) : (
                              <Badge variant="outline" aria-label="Late access not granted">Not Granted</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {hasPermission ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRevokeSingle(emp.employee_id)}
                                aria-label={`Revoke late access for ${emp.employee_name || emp.emp_code}`}
                              >
                                <UserX className="mr-1 h-3 w-3" aria-hidden="true" />
                                Revoke
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleGrantSingle(emp.employee_id)}
                                aria-label={`Grant late access for ${emp.employee_name || emp.emp_code}`}
                              >
                                <UserCheck className="mr-1 h-3 w-3" aria-hidden="true" />
                                Grant
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
                
                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Showing {currentPage * DEFAULT_PAGE_SIZE + 1} to {Math.min((currentPage + 1) * DEFAULT_PAGE_SIZE, filteredMissedDeadlineEmployees.length)} of {filteredMissedDeadlineEmployees.length} employees
                    </div>
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious 
                            onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                            className={currentPage === 0 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                            aria-disabled={currentPage === 0}
                          />
                        </PaginationItem>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i;
                          } else if (currentPage < 3) {
                            pageNum = i;
                          } else if (currentPage > totalPages - 4) {
                            pageNum = totalPages - 5 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          return (
                            <PaginationItem key={pageNum}>
                              <PaginationLink
                                onClick={() => setCurrentPage(pageNum)}
                                isActive={currentPage === pageNum}
                                className="cursor-pointer"
                              >
                                {pageNum + 1}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        })}
                        <PaginationItem>
                          <PaginationNext 
                            onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                            className={currentPage >= totalPages - 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                            aria-disabled={currentPage >= totalPages - 1}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Grant Dialog */}
        <Dialog open={grantDialogOpen} onOpenChange={(open) => {
          setGrantDialogOpen(open);
          if (!open) {
            // Clear reason and target when dialog closes
            setReason('');
            setTargetEmployeeId(null);
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Grant Late Submission Access</DialogTitle>
              <DialogDescription>
                {targetEmployeeId
                  ? 'Grant late submission access to this employee.'
                  : `Grant late submission access to ${selectedEmployees.size} employee(s).`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reason">Reason (optional)</Label>
                <Textarea
                  id="reason"
                  placeholder="Enter a reason for granting late access..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGrantDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleGrantConfirm} disabled={grantMutation.isPending}>
                {grantMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Grant Access
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Revoke Dialog */}
        <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Revoke Late Submission Access</DialogTitle>
              <DialogDescription>
                This will remove the employee's ability to submit goals late.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRevokeDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleRevokeConfirm} 
                disabled={revokeMutation.isPending}
              >
                {revokeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Revoke Access
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
