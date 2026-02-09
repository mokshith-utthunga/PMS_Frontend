import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { employeeService, goalsService, evaluationService, delegationService } from '@/services';
import type { QuarterlyCycle } from '@/services/cycle.service';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveCycle } from '@/contexts/ActiveCycleContext';
import { useCurrentEmployee } from '@/hooks/useCurrentEmployee';
import { DelegateButton } from '@/components/team/DelegateButton';
import { getCurrentQuarter } from '@/lib/evaluationPeriods';
import { Link } from 'react-router-dom';
import { 
  Users, 
  Target, 
  ClipboardCheck, 
  ChevronRight,
  Loader2,
  AlertCircle,
  Calendar,
  Lock,
  Clock,
  CheckCircle2,
  UserPlus
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface QuarterlyStatus {
  self_status: string | null;
  manager_status: string | null;
}

interface DirectReport {
  id: string;
  emp_id?: string;
  emp_code?: string;
  full_name: string;
  email: string;
  department: string;
  grade: string;
  goals_count: number;
  pending_goals: number;
  approved_goals: number;
  self_eval_status: string | null;
  manager_eval_status: string | null;
  quarterly_review_status: string | null;
  q1: QuarterlyStatus;
  q2: QuarterlyStatus;
  q3: QuarterlyStatus;
  q4: QuarterlyStatus;
  delegations?: Record<number, {
    id: string;
    delegate_name: string;
    delegate_email: string;
    quarter: number;
  }>;
  isDelegatedToMe?: boolean; 
  ReportsCount?: number; // True if this employee is delegated to current user
  delegatedBy?: {
    manager_name: string;
    manager_email: string;
    quarter: number;
  } | null; // Info about who delegated this employee to current user
}

// Helper function to get initials from name
const getInitials = (report: DirectReport): string => {
  if (report.full_name) {
    const parts = report.full_name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`;
    }
    return parts[0][0] || '';
  }
  return '??';
};

const getDisplayName = (report: DirectReport): string => {
  return report.full_name || 'Unknown';
};

const getEmailUsername = (email: string | null | undefined): string => {
  if (!email) return '';
  const atIndex = email.indexOf('@');
  return atIndex > 0 ? email.substring(0, atIndex) : email;
};

interface DashboardCounts {
  direct_reports_count: number;
  delegated_count: number;
  goals_pending_approval: number;
  evaluations_pending: number;
  quarterly_pending: number;
  year_end_pending: number;
  quarterly_open_pending: number;
}

export default function Team() {
  const { user, hasAnyRole } = useAuth();
  const isHR = hasAnyRole(['hr_admin', 'hrbp', 'system_admin']);
  
  const { activeCycle: activeCycleFromContext, quarterlyCycles: quarterlyCyclesFromContext, dashboard: dashboardFromContext } = useActiveCycle();
  const { employee: currentEmployee, isLoading: isLoadingEmployee } = useCurrentEmployee();
  
  const [loading, setLoading] = useState(true);
  const [directReports, setDirectReports] = useState<DirectReport[]>([]);
  const [managerId, setManagerId] = useState<string | null>(currentEmployee?.id || null);
  const [activeCycle, setActiveCycle] = useState<any>(activeCycleFromContext);
  const [quarterlyCycles, setQuarterlyCycles] = useState<QuarterlyCycle[]>((quarterlyCyclesFromContext || []) as QuarterlyCycle[]);
  const [dashboardCounts, setDashboardCounts] = useState<DashboardCounts | null>(dashboardFromContext as DashboardCounts | null);
  const [ratingRejections, setRatingRejections] = useState<any[]>([]);
  const [loadingRejections, setLoadingRejections] = useState(false);

  // Calculate current quarter based on active cycle
  const currentQuarter = getCurrentQuarter(activeCycleFromContext, quarterlyCyclesFromContext);

  // Update managerId when employee data changes
  useEffect(() => {
    if (currentEmployee) {
      setManagerId(currentEmployee.id);
    }
  }, [currentEmployee]);

  useEffect(() => {
    // Wait for employee to load before fetching team data
    if (!isLoadingEmployee && user) {
      fetchTeamData();
      fetchRatingRejections();
    }
  }, [user, currentEmployee, isLoadingEmployee, activeCycleFromContext]);

  const fetchTeamData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }


    if (!currentEmployee) {
      if (isHR) {
        setDirectReports([]);
        setLoading(false);
        return;
      }
      setLoading(false);
      return;
    }


    if (!currentEmployee.emp_code) {
      if (isHR) {

        setDirectReports([]);
        setLoading(false);
        return;
      }
      console.error('Current employee emp_code is missing. Cannot fetch team members.');
      setDirectReports([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const managerId = currentEmployee.id;

      if (activeCycleFromContext) {
        setActiveCycle(activeCycleFromContext);
      }
      if (quarterlyCyclesFromContext) {
        setQuarterlyCycles((quarterlyCyclesFromContext || []) as QuarterlyCycle[]);
      }
      if (dashboardFromContext) {
        setDashboardCounts(dashboardFromContext as DashboardCounts);
      }

      const reportsResult = await employeeService.getList({ 
        manager_code: currentEmployee.emp_code, 
        status: 'active' 
      });

      const delegationParams: any = {
        delegate_id: currentEmployee.id,
      };
      if (activeCycleFromContext?.id) {
        delegationParams.cycle_id = activeCycleFromContext.id;
      }
      const delegatedReportsResult = await delegationService.get(delegationParams);

      const delegatedEmployeesMap: Record<string, {
        employee: any;
        delegation: {
          manager_name: string;
          manager_email: string;
          quarter: number;
        };
      }> = {};
      
      if (delegatedReportsResult.data && delegatedReportsResult.data.length > 0) {
        const delegatedReporteeIds = [...new Set((delegatedReportsResult.data || []).map((d: any) => d.reportee_id))];
        
        const delegatedEmployeesPromises = delegatedReporteeIds.map(async (reporteeId: string) => {
          const empResult = await employeeService.getById(reporteeId);
          const delegationsForReportee = (delegatedReportsResult.data || []).filter((d: any) => d.reportee_id === reporteeId);
          const delegation = delegationsForReportee.find((d: any) => d.quarter === currentQuarter) 
            || delegationsForReportee[0]; // Use first available if current quarter not found
          
          return {
            employee: empResult.data,
            delegation: delegation ? {
              manager_name: delegation.manager_name || '',
              manager_email: delegation.manager_email || '',
              quarter: delegation.quarter
            } : null
          };
        });
        
        const delegatedEmployeesResults = await Promise.all(delegatedEmployeesPromises);
        delegatedEmployeesResults.forEach(({ employee, delegation }) => {
          if (employee && employee.status === 'active' && delegation) {
            delegatedEmployeesMap[employee.id] = { employee, delegation };
          }
        });
      }
      
      const delegatedEmployees = Object.values(delegatedEmployeesMap).map(item => item.employee);

      const directReportIds = new Set((reportsResult.data || []).map((r: any) => r.id));
      const ReportsCount = reportsResult.count;
      const allReports = [
        ...(reportsResult.data || []),
        ...delegatedEmployees.filter((emp: any) => emp && !directReportIds.has(emp.id)),
      ];

      if (allReports.length === 0) {
        setDirectReports([]);
        setLoading(false);
        return;
      }

      const delegationsResult = await delegationService.get({
        manager_id: currentEmployee.id,
        cycle_id: activeCycle?.id,
      });
      const delegationsMap: Record<string, Record<number, any>> = {};
      (delegationsResult.data || []).forEach((d: any) => {
        if (!delegationsMap[d.reportee_id]) {
          delegationsMap[d.reportee_id] = {};
        }
        delegationsMap[d.reportee_id][d.quarter] = d;
      });

      const reportsWithGoals = await Promise.all(
        allReports.map(async (report) => {
          let goals_count = 0;
          let pending_goals = 0;
          let approved_goals = 0;
          let self_eval_status = null;
          let manager_eval_status = null;
          let quarterly_review_status = null;
          const quarterlyStatuses: { q1: QuarterlyStatus; q2: QuarterlyStatus; q3: QuarterlyStatus; q4: QuarterlyStatus } = {
            q1: { self_status: null, manager_status: null },
            q2: { self_status: null, manager_status: null },
            q3: { self_status: null, manager_status: null },
            q4: { self_status: null, manager_status: null },
          };

          if (activeCycle) {
            // Get goals for this report
            const goalsResult = await goalsService.kpis.getByEmployee(report.id, activeCycle.id);
            goals_count = goalsResult.data?.length || 0;
            pending_goals = goalsResult.data?.filter(g => g.status === 'submitted').length || 0;
            approved_goals = goalsResult.data?.filter(g => g.status === 'approved').length || 0;

            const selfReviewsResult = await evaluationService.selfReviews.get(report.id, activeCycle.id);
            
            const mgrReviewsResult = await evaluationService.managerReviews.get(report.id, activeCycle.id);

            (selfReviewsResult.data || []).forEach((q: any) => {
              if (q.quarter) {
                const key = `q${q.quarter}` as keyof typeof quarterlyStatuses;
                if (quarterlyStatuses[key]) {
                  quarterlyStatuses[key].self_status = q.status;
                }
              }
            });

            (mgrReviewsResult.data || []).forEach((q: any) => {
              if (q.quarter) {
                const key = `q${q.quarter}` as keyof typeof quarterlyStatuses;
                if (quarterlyStatuses[key] && (q.status === 'submitted' || q.status === 'approved')) {
                  quarterlyStatuses[key].manager_status = 'submitted';
                }
              }
            });

            const latestSelfReview = (selfReviewsResult.data || [])
              .sort((a: any, b: any) => (b.quarter || 0) - (a.quarter || 0))[0];
            const latestMgrReview = (mgrReviewsResult.data || [])
              .sort((a: any, b: any) => (b.quarter || 0) - (a.quarter || 0))[0];
            
            self_eval_status = latestSelfReview?.status || null;
            manager_eval_status = latestMgrReview?.status || null;
            quarterly_review_status = latestSelfReview?.status || null;
          }

          const isDelegatedToMe = delegatedEmployeesMap[report.id] !== undefined;
          const delegatedBy = isDelegatedToMe && delegatedEmployeesMap[report.id] 
            ? delegatedEmployeesMap[report.id].delegation 
            : null;

          return {
            ...report,
            goals_count,
            pending_goals,
            approved_goals,
            self_eval_status,
            manager_eval_status,
            quarterly_review_status,
            ...quarterlyStatuses,
            delegations: delegationsMap[report.id] || {},
            isDelegatedToMe,
            delegatedBy,
            ReportsCount
          };
        })
      );

      setDirectReports(reportsWithGoals);
    } catch (error) {
      console.error('Error fetching team data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRatingRejections = async () => {
    if (!user || !currentEmployee || !activeCycleFromContext) {
      return;
    }

    try {
      setLoadingRejections(true);
      const result = await evaluationService.managerRatingRejections.get(
        activeCycleFromContext.id,
        'pending' // Only show pending rejections
      );
      setRatingRejections(result.data || []);
    } catch (error) {
      console.error('Error fetching rating rejections:', error);
      setRatingRejections([]);
    } finally {
      setLoadingRejections(false);
    }
  };

  const getQuarterTiming = (quarter: number): 'future' | 'current' | 'past' => {
    if (!activeCycle) return 'future';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    
    const qc = quarterlyCycles.find(qc => {
      const qcQuarter = typeof qc.quarter === 'string' ? parseInt(qc.quarter) : qc.quarter;
      return qcQuarter === quarter;
    });
    
    if (qc) {
      startDate = qc.quarterly_manager_review_start_date ? new Date(qc.quarterly_manager_review_start_date) : null;
      endDate = qc.quarterly_manager_review_end_date ? new Date(qc.quarterly_manager_review_end_date) : null;
    } else {
      const startField = `q${quarter}_manager_review_start` as keyof typeof activeCycle;
      const endField = `q${quarter}_manager_review_end` as keyof typeof activeCycle;
      startDate = activeCycle[startField] ? new Date(activeCycle[startField]) : null;
      endDate = activeCycle[endField] ? new Date(activeCycle[endField]) : null;
    }
    
    if (!startDate || !endDate) return 'future';
    
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    
    if (today < startDate) return 'future';
    if (today > endDate) return 'past';
    return 'current';
  };

  const getYearEndTiming = (): 'future' | 'current' | 'past' => {
    if (!activeCycle) return 'future';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startDate = activeCycle.manager_evaluation_start ? new Date(activeCycle.manager_evaluation_start) : null;
    const endDate = activeCycle.manager_evaluation_end ? new Date(activeCycle.manager_evaluation_end) : null;
    
    if (!startDate || !endDate) return 'future';
    
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    
    if (today < startDate) return 'future';
    if (today > endDate) return 'past';
    return 'current';
  };

  const getQuarterAction = (report: DirectReport, quarter: number) => {
    const qKey = `q${quarter}` as keyof Pick<DirectReport, 'q1' | 'q2' | 'q3' | 'q4'>;
    const selfStatus = report[qKey].self_status;
    const mgrStatus = report[qKey].manager_status;
    const timing = getQuarterTiming(quarter);

    if (selfStatus !== 'submitted') {
      return { label: 'Waiting for employee', disabled: true, icon: Clock, variant: 'outline' as const };
    }
    if (timing === 'future') {
      return { label: 'Not open yet', disabled: true, icon: Lock, variant: 'outline' as const };
    }
    if (mgrStatus === 'submitted' || mgrStatus === 'approved') {
      return { label: 'Approved', disabled: false, icon: CheckCircle2, variant: 'outline' as const };
    }
    if (timing === 'past') {
      return { label: 'Period closed', disabled: true, icon: Lock, variant: 'outline' as const };
    }
    return { label: 'Review', disabled: false, icon: ChevronRight, variant: 'default' as const };
  };

  const getYearEndAction = (report: DirectReport) => {
    const selfStatus = report.self_eval_status;
    const mgrStatus = report.manager_eval_status;
    const timing = getYearEndTiming();

    if (selfStatus !== 'submitted') {
      return { label: 'Waiting for employee', disabled: true, icon: Clock, variant: 'outline' as const };
    }
    if (timing === 'future') {
      return { label: 'Not open yet', disabled: true, icon: Lock, variant: 'outline' as const };
    }
    if (mgrStatus === 'submitted' || mgrStatus === 'released') {
      return { label: 'Completed', disabled: false, icon: CheckCircle2, variant: 'outline' as const };
    }
    if (timing === 'past') {
      return { label: 'Period closed', disabled: true, icon: Lock, variant: 'outline' as const };
    }
    return { label: 'Evaluate', disabled: false, icon: ChevronRight, variant: 'default' as const };
  };

  const pendingApprovals = directReports.filter(r => r.pending_goals > 0);

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </MainLayout>
    );
  }

  if (!managerId && !isHR) {
    return (
      <MainLayout>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Your employee profile is not set up. Please contact HR.
          </AlertDescription>
        </Alert>
      </MainLayout>
    );
  }

  if (!managerId && isHR) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Team</h1>
            <p className="text-muted-foreground">Manage goals and evaluations for your direct reports</p>
          </div>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              As an HR user without a team, you can view all employees from the Admin Panel.
            </AlertDescription>
          </Alert>
        </div>
      </MainLayout>
    );
  }

  const renderQuarterCard = (report: DirectReport, quarter: number) => {
    const action = getQuarterAction(report, quarter);
    const Icon = action.icon;
    
    return (
      <Card key={`${report.id}-q${quarter}`}>
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-4">
            <Avatar>
              <AvatarFallback className="bg-primary text-primary-foreground">
                {getInitials(report)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">
                {getDisplayName(report)}
              </p>
              <p className="text-sm text-muted-foreground">
                {report.department} • {report.grade}
              </p>
              {report.isDelegatedToMe && report.delegatedBy && (
                <p className="text-xs text-blue-600 mt-1">
                  Delegated by {getEmailUsername(report.delegatedBy.manager_email)} (Q{report.delegatedBy.quarter})
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {action.label === 'Approved' && (
              <Badge variant="outline" className="text-green-600 border-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Approved
              </Badge>
            )}
            {action.label === 'Waiting for employee' && (
              <Badge variant="secondary">
                <Clock className="h-3 w-3 mr-1" />
                Waiting
              </Badge>
            )}
            {(action.label === 'Not open yet' || action.label === 'Period closed') && (
              <Badge variant="outline">
                <Lock className="h-3 w-3 mr-1" />
                {action.label}
              </Badge>
            )}
            <Link to={`/team/${report.id}/evaluate?quarter=${quarter}`}>
              <Button 
                variant={action.variant} 
                disabled={action.disabled && action.label !== 'Approved'}
                size="sm"
              >
                {action.label === 'Review' ? 'Review' : 'View'}
                <Icon className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderYearEndCard = (report: DirectReport) => {
    const action = getYearEndAction(report);
    const Icon = action.icon;
    
    return (
      <Card key={`${report.id}-yearend`}>
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-4">
            <Avatar>
              <AvatarFallback className="bg-primary text-primary-foreground">
                {getInitials(report)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">
                {getDisplayName(report)}
              </p>
              <p className="text-sm text-muted-foreground">
                {report.department} • {report.grade}
              </p>
              {report.isDelegatedToMe && report.delegatedBy && (
                <p className="text-xs text-blue-600 mt-1">
                  Delegated by {getEmailUsername(report.delegatedBy.manager_email)} (Q{report.delegatedBy.quarter})
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {action.label === 'Completed' && (
              <Badge variant="outline" className="text-green-600 border-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Completed
              </Badge>
            )}
            {action.label === 'Waiting for employee' && (
              <Badge variant="secondary">
                <Clock className="h-3 w-3 mr-1" />
                Waiting
              </Badge>
            )}
            {(action.label === 'Not open yet' || action.label === 'Period closed') && (
              <Badge variant="outline">
                <Lock className="h-3 w-3 mr-1" />
                {action.label}
              </Badge>
            )}
            <Link to={`/team/${report.id}/evaluate`}>
              <Button 
                variant={action.variant} 
                disabled={action.disabled && action.label !== 'Completed'}
                size="sm"
              >
                {action.label === 'Evaluate' ? 'Evaluate' : 'View'}
                <Icon className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Team</h1>
          <p className="text-muted-foreground">
            Manage goals and evaluations for your direct reports
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Direct Reports</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardCounts?.direct_reports_count ?? directReports.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Delegated</CardTitle>
              <UserPlus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardCounts?.delegated_count ?? 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Goals Pending Approval</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardCounts?.goals_pending_approval ?? 0}
              </div>
              {(dashboardCounts?.goals_pending_approval ?? 0) > 0 && (
                <p className="text-xs text-destructive">Action required</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Evaluations Pending</CardTitle>
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardCounts?.evaluations_pending ?? 0}</div>
              {(dashboardCounts?.evaluations_pending ?? 0) > 0 && (
                <p className="text-xs text-destructive">
                  {(dashboardCounts?.quarterly_open_pending ?? 0) > 0 && `${dashboardCounts?.quarterly_open_pending} quarterly`}
                  {(dashboardCounts?.quarterly_open_pending ?? 0) > 0 && (dashboardCounts?.year_end_pending ?? 0) > 0 && ' + '}
                  {(dashboardCounts?.year_end_pending ?? 0) > 0 && `${dashboardCounts?.year_end_pending} year-end`}
                  {' '}ready for review
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Cycle</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold truncate">
                {activeCycle?.name || 'No active cycle'}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All Reports ({directReports.length})</TabsTrigger>
            {/* <TabsTrigger value="approvals">
              Pending Approvals
              {(dashboardCounts?.goals_pending_approval ?? pendingApprovals.length) > 0 && (
                <Badge variant="destructive" className="ml-2">{dashboardCounts?.goals_pending_approval ?? pendingApprovals.length}</Badge>
              )}
            </TabsTrigger> */}
            <TabsTrigger value="quarterly">
              Quarterly Reviews
              {(dashboardCounts?.quarterly_pending ?? 0) > 0 && (
                <Badge variant="secondary" className="ml-2">{dashboardCounts?.quarterly_pending ?? 0}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="rejections">
              Review Rejections
              {ratingRejections.length > 0 && (
                <Badge variant="secondary" className="ml-2">{ratingRejections.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="evaluations">
              Year-End Evals
              {(dashboardCounts?.year_end_pending ?? 0) > 0 && (
                <Badge variant="secondary" className="ml-2">{dashboardCounts?.year_end_pending ?? 0}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {directReports.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg">No direct reports</h3>
                  <p className="text-muted-foreground">
                    You don't have any team members assigned to you
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {directReports.map((report) => (
                  <Card key={report.id} className="border-card-border/30 hover:shadow-xl ">
                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {getInitials(report)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <CardTitle className="text-lg">
                            {getDisplayName(report)}
                          </CardTitle>
                          <CardDescription>{report.email}</CardDescription>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="outline">{report.department}</Badge>
                            <Badge variant="secondary">{report.grade}</Badge>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Goals:</span>
                          <span>
                            {report.approved_goals}/{report.goals_count} approved
                          </span>
                        </div>
                        <Progress 
                          value={report.goals_count ? (report.approved_goals / report.goals_count) * 100 : 0} 
                          className="h-2" 
                        />
                      </div> */}

                      <div className="flex flex-wrap gap-2">
                       
                        {report.pending_goals > 0 && (
                          <Badge variant="destructive">
                            {report.pending_goals} kpis pending approval
                          </Badge>
                        )}
                        {report.self_eval_status === 'submitted' && report.manager_eval_status !== 'submitted' && report.manager_eval_status !== 'released' && (
                          <Badge variant="secondary">Year-end eval pending</Badge>
                        )}
                        {(report.manager_eval_status === 'submitted' || report.manager_eval_status === 'released') && (
                          <Badge variant="outline">Evaluation completed</Badge>
                        )}
                         {report.isDelegatedToMe && report.delegatedBy && (
                          <Badge variant="outline" className="text-blue-600 border-blue-600">
                            Delegated by {getEmailUsername(report.delegatedBy.manager_email)} (Q{report.delegatedBy.quarter})
                          </Badge>
                        )}
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Link to={`/team/${report.id}/goals`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full">
                            <Target className="mr-2 h-4 w-4" />
                            Goals
                          </Button>
                        </Link>
                        <Link to={`/team/${report.id}/evaluate`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full">
                            <ClipboardCheck className="mr-2 h-4 w-4" />
                            Review
                          </Button>
                        </Link>
                      </div>
                      {activeCycleFromContext && currentQuarter && !report.isDelegatedToMe && (
                        <div className="pt-2 border-t mt-2">
                          <DelegateButton
                            reporteeId={report.id}
                            reporteeName={getDisplayName(report)}
                            currentDelegation={report.delegations?.[currentQuarter] || null}
                            quarter={currentQuarter}
                            onDelegationChange={fetchTeamData}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="approvals" className="space-y-4">
            {pendingApprovals.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Target className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg">No pending approvals</h3>
                  <p className="text-muted-foreground">
                    All team member goals have been reviewed
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {pendingApprovals.map((report) => (
                  <Card key={report.id}>
                    <CardContent className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-4">
                        <Avatar>
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {getInitials(report)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {getDisplayName(report)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {report.pending_goals} goals pending your approval
                          </p>
                        </div>
                      </div>
                      <Link to={`/team/${report.id}/goals`}>
                        <Button>
                          Review Goals
                          <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="quarterly" className="space-y-4">
            {directReports.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg">No direct reports</h3>
                  <p className="text-muted-foreground">
                    You don't have any team members to review
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Tabs defaultValue="q1" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="q1">Q1</TabsTrigger>
                  <TabsTrigger value="q2">Q2</TabsTrigger>
                  <TabsTrigger value="q3">Q3</TabsTrigger>
                  <TabsTrigger value="q4">Q4</TabsTrigger>
                </TabsList>

                {[1, 2, 3, 4].map(q => (
                  <TabsContent key={q} value={`q${q}`} className="space-y-4">
                    {getQuarterTiming(q) === 'future' && (
                      <Alert>
                        <Lock className="h-4 w-4" />
                        <AlertDescription>
                          Q{q} manager review period has not started yet.
                          {activeCycle?.[`q${q}_manager_review_start`] && (
                            <> Opens on {new Date(activeCycle[`q${q}_manager_review_start`]).toLocaleDateString()}.</>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}
                    {getQuarterTiming(q) === 'past' && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Q{q} manager review period has closed.
                        </AlertDescription>
                      </Alert>
                    )}
                    {getQuarterTiming(q) === 'current' && (
                      <Alert>
                        <Calendar className="h-4 w-4" />
                        <AlertDescription>
                          Q{q} manager review period is currently open.
                          {activeCycle?.[`q${q}_manager_review_end`] && (
                            <> Ends on {new Date(activeCycle[`q${q}_manager_review_end`]).toLocaleDateString()}.</>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    <div className="space-y-4">
                      {directReports.map((report) => renderQuarterCard(report, q))}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </TabsContent>

          <TabsContent value="rejections" className="space-y-4">
            {loadingRejections ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Loading rejections...</p>
                </CardContent>
              </Card>
            ) : ratingRejections.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg">No rating rejections</h3>
                  <p className="text-muted-foreground">
                    No team members have rejected their published ratings
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {ratingRejections.map((rejection) => (
                  <Card key={rejection.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <Avatar>
                            <AvatarFallback className="bg-primary text-primary-foreground">
                              {rejection.employee_name
                                ? rejection.employee_name
                                    .split(' ')
                                    .map((n: string) => n[0])
                                    .join('')
                                    .toUpperCase()
                                    .slice(0, 2)
                                : '??'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <CardTitle className="text-lg">
                              {rejection.employee_name || 'Unknown Employee'}
                            </CardTitle>
                            <CardDescription>
                              {rejection.employee_code || 'N/A'} • {rejection.quarter ? `Q${rejection.quarter}` : 'Year-End'} • {rejection.cycle_name || 'N/A'}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant="destructive">Rejected</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-sm font-medium mb-2">Rejection Reason</p>
                        <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                          {rejection.rejection_reason || 'No reason provided'}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium mb-1">Published Rating</p>
                          <p className="text-lg font-semibold">
                            {(() => {
                              if (rejection.calculated_overall_rating === null || rejection.calculated_overall_rating === undefined) {
                                return 'N/A';
                              }
                              const rating = typeof rejection.calculated_overall_rating === 'string' 
                                ? parseFloat(rejection.calculated_overall_rating) 
                                : Number(rejection.calculated_overall_rating);
                              return !isNaN(rating) ? rating.toFixed(2) : 'N/A';
                            })()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-1">Rejected On</p>
                          <p className="text-sm text-muted-foreground">
                            {rejection.created_at
                              ? new Date(rejection.created_at).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })
                              : 'N/A'}
                          </p>
                        </div>
                      </div>
                      {rejection.manager_comments && (
                        <div>
                          <p className="text-sm font-medium mb-2">Manager Comments</p>
                          <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                            {rejection.manager_comments}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="evaluations" className="space-y-4">
            {directReports.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <ClipboardCheck className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg">No direct reports</h3>
                  <p className="text-muted-foreground">
                    You don't have any team members to evaluate
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {getYearEndTiming() === 'future' && (
                  <Alert>
                    <Lock className="h-4 w-4" />
                    <AlertDescription>
                      Year-end evaluation period has not started yet.
                      {activeCycle?.manager_evaluation_start && (
                        <> Opens on {new Date(activeCycle.manager_evaluation_start).toLocaleDateString()}.</>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
                {getYearEndTiming() === 'past' && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Year-end evaluation period has closed.
                    </AlertDescription>
                  </Alert>
                )}
                {getYearEndTiming() === 'current' && (
                  <Alert>
                    <Calendar className="h-4 w-4" />
                    <AlertDescription>
                      Year-end evaluation period is currently open.
                      {activeCycle?.manager_evaluation_end && (
                        <> Ends on {new Date(activeCycle.manager_evaluation_end).toLocaleDateString()}.</>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-4">
                  {directReports.map((report) => renderYearEndCard(report))}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
