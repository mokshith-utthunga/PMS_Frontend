import { useState, useMemo, useEffect } from 'react';
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
import { cycleService, permissionsService } from '@/services';
import type { LateSubmissionEmployee } from '@/services/permissions.service';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Users, CheckCircle2, XCircle, Clock, Loader2, UserCheck, UserX } from 'lucide-react';
import type { PerformanceCycle } from '@/lib/evaluationPeriods';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [targetEmployeeId, setTargetEmployeeId] = useState<string | null>(null);
  const [submissionType, setSubmissionType] = useState<'goals' | 'evaluations'>('goals');

  // Get quarter and tab from URL - handle "year-end" as special case
  const urlQuarter = searchParams.get('quarter');
  const urlTab = searchParams.get('tab') as 'goals' | 'evaluations' | null;
  const isYearEnd = urlQuarter === 'year-end';
  const selectedQuarter = isYearEnd ? null : (urlQuarter ? parseInt(urlQuarter, 10) : null);
  
  // Sync submissionType with URL tab
  useEffect(() => {
    if (urlTab && (urlTab === 'goals' || urlTab === 'evaluations')) {
      setSubmissionType(urlTab);
    }
  }, [urlTab]);

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

  // Fetch employees who missed deadline from API (includes submission status and permissions)
  const { data: lateSubmissionEmployees = [], isLoading: employeesLoading, error: employeesError } = useQuery({
    queryKey: ['late-submission-employees', effectiveCycleId, effectiveSelectedQuarter, submissionType],
    enabled: !!effectiveCycleId,
    queryFn: async () => {
      const result = await permissionsService.lateSubmission.getByCycle(effectiveCycleId, effectiveSelectedQuarter, submissionType);
      return result.data || [];
    },
  });

  // Fetch late submission details from API
  const { 
    data: submissionDetails, 
    isLoading: detailsLoading,
    error: detailsError 
  } = useQuery({
    queryKey: ['late-submission-details', effectiveCycleId, effectiveSelectedQuarter, submissionType],
    enabled: !!effectiveCycleId,
    queryFn: async () => {
      const result = await permissionsService.lateSubmission.getDetails(effectiveCycleId, effectiveSelectedQuarter, submissionType);
      return result.data;
    },
  });

  // Use API data for stats - separate goals and evaluations
  const totalEmployees = submissionDetails?.totalEmployees || 0;
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
  
  // Use stats based on selected type
  const currentStats = submissionType === 'goals' ? goalsStats : evaluationsStats;
  const submittedCount = currentStats.submitted;
  const missedCount = currentStats.missedDeadline;
  const lateAccessCount = currentStats.lateAccessGranted;
  const isPastDeadline = currentStats.isPastDeadline;
  const hasStarted = currentStats.hasStarted ?? true; // Default to true for backwards compatibility
  const startDate = currentStats.startDate;

  // Filter employees who missed the deadline (haven't submitted for the selected quarter)
  const missedDeadlineEmployees = lateSubmissionEmployees.filter(
    (emp: LateSubmissionEmployee) => !emp.has_submitted
  );

  // Group employees by manager for year-end view
  const employeesByManager = useMemo(() => {
    if (!isYearEnd) return new Map();
    
    const grouped = new Map<string, {
      manager_code: string;
      manager_name: string;
      manager_emp_code: string;
      reportees: LateSubmissionEmployee[];
    }>();
    
    missedDeadlineEmployees.forEach((emp: any) => {
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
  }, [missedDeadlineEmployees, isYearEnd]);

  // Check if employee has late permission
  const hasLatePermission = (employeeId: string) => {
    const emp = lateSubmissionEmployees.find((e: LateSubmissionEmployee) => e.employee_id === employeeId);
    return emp?.permission && !emp.permission.revoked_at;
  };

  // Grant permission mutation
  const grantMutation = useMutation({
    mutationFn: async (employeeIds: string[]) => {
      for (const empId of employeeIds) {
        await permissionsService.lateSubmission.grant({
          cycle_id: effectiveCycleId,
          employee_id: empId,
          granted_by: user?.id || '',
          reason: reason || undefined,
          quarter: effectiveSelectedQuarter,  // Quarter-specific permission or 'year-end'
        });
      }
    },
    onSuccess: () => {
      const periodLabel = isYearEnd ? 'Year-End Evaluation' : `Q${effectiveSelectedQuarter}`;
      toast({ title: `Late submission access granted for ${periodLabel}` });
      queryClient.invalidateQueries({ queryKey: ['late-submission-employees', effectiveCycleId, effectiveSelectedQuarter] });
      queryClient.invalidateQueries({ queryKey: ['late-submission-details', effectiveCycleId, effectiveSelectedQuarter] });
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
    onSuccess: () => {
      const periodLabel = isYearEnd ? 'Year-End Evaluation' : `Q${effectiveSelectedQuarter}`;
      toast({ title: `Late submission access revoked for ${periodLabel}` });
      queryClient.invalidateQueries({ queryKey: ['late-submission-employees', effectiveCycleId, effectiveSelectedQuarter] });
      queryClient.invalidateQueries({ queryKey: ['late-submission-details', effectiveCycleId, effectiveSelectedQuarter] });
      setRevokeDialogOpen(false);
      setTargetEmployeeId(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEmployees(new Set(missedDeadlineEmployees.filter(e => !hasLatePermission(e.employee_id)).map(e => e.employee_id)));
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
            newParams.delete('tab'); // Year-end doesn't have goals/evaluations tabs
          } else {
            const q = parseInt(value.replace('q', ''));
            // Don't allow switching to a quarter that hasn't started yet
            if (!isQuarterAccessible(q)) {
              return;
            }
              newParams.set('quarter', q.toString());
            // Ensure tab is set when switching to quarterly view
            if (!newParams.get('tab')) {
              newParams.set('tab', submissionType);
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

        {/* Goals vs Evaluations Tabs */}
        {!isYearEnd && (
          <Tabs value={submissionType} onValueChange={(value) => {
            const newType = value as 'goals' | 'evaluations';
            setSubmissionType(newType);
            // Update URL with tab parameter
            const newParams = new URLSearchParams(searchParams);
            newParams.set('tab', newType);
            setSearchParams(newParams);
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
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(employeesLoading || detailsLoading) ? '-' : totalEmployees}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Submitted</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{submittedCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalEmployees > 0 ? `${Math.round((submittedCount / totalEmployees) * 100)}%` : '0%'} of total
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Missed Deadline</CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{missedCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {isPastDeadline 
                  ? `${missedCount} not submitted` 
                  : 'Deadline not passed'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Late Access Granted</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{lateAccessCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Active permissions
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Employees Table / Accordion */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {isYearEnd 
                    ? `Managers with Pending Year-End Evaluations (${employeesByManager.size})`
                    : `Employees Who Missed ${submissionType === 'goals' ? 'Goals' : 'Evaluations'} Deadline (${missedCount})`}
                </CardTitle>
                <CardDescription>
                  {isYearEnd
                    ? 'Managers with reportees who have not submitted their year-end evaluations'
                    : (isPastDeadline 
                      ? `These employees have not submitted their ${submissionType === 'goals' ? 'goals' : 'self-evaluations'} for this quarter`
                      : 'Deadline has not passed yet')}
                </CardDescription>
              </div>
              {selectedEmployees.size > 0 && (
                <Button onClick={() => setGrantDialogOpen(true)}>
                  <UserCheck className="mr-2 h-4 w-4" />
                  Grant Access ({selectedEmployees.size})
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!hasStarted && !isYearEnd ? (
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
            ) : !isPastDeadline && !isYearEnd ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-lg font-medium mb-2">
                  {submissionType === 'goals' ? 'Goal submission' : 'Evaluation'} period is still ongoing
                </p>
                <p className="text-sm">
                  The deadline has not passed yet. Employees can still submit their {submissionType === 'goals' ? 'goals' : 'self-evaluations'}.
                </p>
              </div>
            ) : (isYearEnd ? (
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
            ) : missedDeadlineEmployees.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                All employees have submitted their {submissionType === 'goals' ? 'goals' : 'self-evaluations'} on time!
              </div>
            ) : (
              // Regular Quarter Table View
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          missedDeadlineEmployees.filter(e => !hasLatePermission(e.employee_id)).length > 0 &&
                          selectedEmployees.size === missedDeadlineEmployees.filter(e => !hasLatePermission(e.employee_id)).length
                        }
                        onCheckedChange={handleSelectAll}
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
                  {missedDeadlineEmployees.map((emp) => {
                    const hasPermission = hasLatePermission(emp.employee_id);
                    return (
                      <TableRow key={emp.employee_id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedEmployees.has(emp.employee_id)}
                            onCheckedChange={(checked) => handleSelectEmployee(emp.employee_id, !!checked)}
                            disabled={hasPermission}
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
                        <TableCell>-</TableCell>
                        <TableCell>
                          <Badge variant={emp.has_submitted ? 'default' : 'destructive'}>
                            {emp.has_submitted ? 'Submitted' : 'Not Submitted'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {hasPermission ? (
                            <Badge className="bg-amber-500 hover:bg-amber-600">
                              <Clock className="mr-1 h-3 w-3" />
                              Granted
                            </Badge>
                          ) : (
                            <Badge variant="outline">Not Granted</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
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
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ))}
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
