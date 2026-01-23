import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { employeeService, cycleService, goalsService, evaluationService } from '@/services';
import type { QuarterlyCycle } from '@/services/cycle.service';
import { useAuth } from '@/contexts/AuthContext';
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
  CheckCircle2
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

// Helper function to get display name
const getDisplayName = (report: DirectReport): string => {
  return report.full_name || 'Unknown';
};

interface DashboardCounts {
  direct_reports_count: number;
  goals_pending_approval: number;
  evaluations_pending: number;
  quarterly_pending: number;
  year_end_pending: number;
  quarterly_open_pending: number;
}

export default function Team() {
  const { user, hasAnyRole } = useAuth();
  const isHR = hasAnyRole(['hr_admin', 'hrbp', 'system_admin']);
  const [loading, setLoading] = useState(true);
  const [directReports, setDirectReports] = useState<DirectReport[]>([]);
  const [managerId, setManagerId] = useState<string | null>(null);
  const [activeCycle, setActiveCycle] = useState<any>(null);
  const [quarterlyCycles, setQuarterlyCycles] = useState<QuarterlyCycle[]>([]);
  const [dashboardCounts, setDashboardCounts] = useState<DashboardCounts | null>(null);

  useEffect(() => {
    fetchTeamData();
  }, [user]);

  const fetchTeamData = async () => {
    if (!user) return;

    try {
      // Get current user's employee record
      const managerResult = await employeeService.getMe();

      if (!managerResult.data) {
        setLoading(false);
        return;
      }

      setManagerId(managerResult.data.id);

      // Get active cycle with dashboard counts from API
      const cycleResult = await cycleService.getActive();
      setActiveCycle(cycleResult.data);
      setQuarterlyCycles((cycleResult.quarterly_cycles || []) as QuarterlyCycle[]);
      setDashboardCounts((cycleResult as any).dashboard || null);

      // Get direct reports for display (still need individual report data for the list)
      const reportsResult = await employeeService.getList({ manager_id: managerResult.data.id, status: 'active' });

      if (!reportsResult.data || reportsResult.data.length === 0) {
        setDirectReports([]);
        setLoading(false);
        return;
      }

      // Fetch additional data for each report (for display purposes only)
      const reportsWithGoals = await Promise.all(
        reportsResult.data.map(async (report) => {
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

          if (cycleResult.data) {
            // Get goals for this report
            const goalsResult = await goalsService.kpis.getByEmployee(report.id, cycleResult.data.id);
            goals_count = goalsResult.data?.length || 0;
            pending_goals = goalsResult.data?.filter(g => g.status === 'submitted').length || 0;
            approved_goals = goalsResult.data?.filter(g => g.status === 'approved').length || 0;

            // Get quarterly self reviews for this report (from quarterly_self_reviews table)
            const selfReviewsResult = await evaluationService.selfReviews.get(report.id, cycleResult.data.id);
            
            // Get quarterly manager reviews for this report (from quarterly_manager_reviews table)
            const mgrReviewsResult = await evaluationService.managerReviews.get(report.id, cycleResult.data.id);

            // Map quarterly self reviews to statuses
            (selfReviewsResult.data || []).forEach((q: any) => {
              if (q.quarter) {
                const key = `q${q.quarter}` as keyof typeof quarterlyStatuses;
                if (quarterlyStatuses[key]) {
                  quarterlyStatuses[key].self_status = q.status;
                }
              }
            });

            // Map quarterly manager reviews to statuses
            (mgrReviewsResult.data || []).forEach((q: any) => {
              if (q.quarter) {
                const key = `q${q.quarter}` as keyof typeof quarterlyStatuses;
                if (quarterlyStatuses[key] && (q.status === 'submitted' || q.status === 'approved')) {
                  quarterlyStatuses[key].manager_status = 'submitted';
                }
              }
            });

            // Set overall statuses from the latest quarter
            const latestSelfReview = (selfReviewsResult.data || [])
              .sort((a: any, b: any) => (b.quarter || 0) - (a.quarter || 0))[0];
            const latestMgrReview = (mgrReviewsResult.data || [])
              .sort((a: any, b: any) => (b.quarter || 0) - (a.quarter || 0))[0];
            
            self_eval_status = latestSelfReview?.status || null;
            manager_eval_status = latestMgrReview?.status || null;
            quarterly_review_status = latestSelfReview?.status || null;
          }

          return {
            ...report,
            goals_count,
            pending_goals,
            approved_goals,
            self_eval_status,
            manager_eval_status,
            quarterly_review_status,
            ...quarterlyStatuses
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

  const getQuarterTiming = (quarter: number): 'future' | 'current' | 'past' => {
    if (!activeCycle) return 'future';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get dates from quarterly_cycles (preferred)
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
      // Fallback to deprecated cycle fields
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

  // Use counts from API (dashboardCounts) - no local calculation needed
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

        <div className="grid gap-4 md:grid-cols-4">
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
            <TabsTrigger value="all">All Reports ({dashboardCounts?.direct_reports_count ?? directReports.length})</TabsTrigger>
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
                  <Card key={report.id}>
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
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Goals</span>
                          <span>
                            {report.approved_goals}/{report.goals_count} approved
                          </span>
                        </div>
                        <Progress 
                          value={report.goals_count ? (report.approved_goals / report.goals_count) * 100 : 0} 
                          className="h-2" 
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {report.pending_goals > 0 && (
                          <Badge variant="destructive">
                            {report.pending_goals} goals pending approval
                          </Badge>
                        )}
                        {report.self_eval_status === 'submitted' && report.manager_eval_status !== 'submitted' && report.manager_eval_status !== 'released' && (
                          <Badge variant="secondary">Year-end eval pending</Badge>
                        )}
                        {(report.manager_eval_status === 'submitted' || report.manager_eval_status === 'released') && (
                          <Badge variant="outline">Evaluation completed</Badge>
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
