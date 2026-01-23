import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { employeeService, cycleService, goalsService, evaluationService } from '@/services';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, User, Users, Briefcase, AlertCircle } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { Link } from 'react-router-dom';
import { EmployeeDashboard } from '@/components/dashboard/EmployeeDashboard';
import { ManagerDashboard } from '@/components/dashboard/ManagerDashboard';
import { HRDashboard } from '@/components/dashboard/HRDashboard';
import type { PerformanceCycle } from '@/types';

export default function Dashboard() {
  const { user, hasAnyRole } = useAuth();
  const isManager = hasAnyRole(['manager', 'dept_head']);
  const isHR = hasAnyRole(['hr_admin', 'hrbp']);

  // Fetch current employee
  const { data: employee } = useQuery({
    queryKey: ['my-employee'],
    queryFn: () => employeeService.getMe().then(r => r.data).catch(() => null),
    enabled: !!user?.id
  });

  // Fetch active cycle with quarterly cycles data (cached and memorized)
  // This single API call includes:
  // - Active cycle data
  // - Quarterly cycles (quarterly_cycles table)
  // - Goals quarterly cycles (goals_quarterly_cycles table)
  // All data is cached for 5 minutes to reduce API calls
  const { data: activeCycleData } = useQuery({
    queryKey: ['active-cycle'],
    queryFn: async () => {
      const result = await cycleService.getActive();
      return result.data;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    cacheTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
  
  const activeCycle = activeCycleData?.data || null;
  const quarterlyCycles = activeCycleData?.quarterly_cycles || [];
  const goalsQuarterlyCycles = activeCycleData?.goals_quarterly_cycles || [];

  // Fetch my goals
  const { data: goals = [] } = useQuery({
    queryKey: ['my-goals', activeCycle?.id],
    queryFn: () => goalsService.kpis.getByEmployee(employee!.id, activeCycle!.id).then(r => r.data || []),
    enabled: !!employee?.id && !!activeCycle?.id
  });

  const goalsData = {
    count: goals.length,
    totalWeight: goals.reduce((sum, g) => sum + Number(g.weight || 0), 0),
    submitted: goals.length > 0 && goals.every(g => ['submitted', 'approved', 'locked'].includes(g.status))
  };

  // Fetch self evaluation (using quarterly self reviews)
  const { data: selfReviewsData } = useQuery({
    queryKey: ['my-self-reviews', activeCycle?.id, employee?.id],
    queryFn: () => evaluationService.selfReviews.get(employee!.id, activeCycle!.id),
    enabled: !!employee?.id && !!activeCycle?.id
  });
  // Get the latest quarterly self review
  const selfEvaluation = selfReviewsData?.data?.sort((a, b) => (b.quarter || 0) - (a.quarter || 0))[0] || null;

  // Manager: Fetch team count
  const { data: teamData } = useQuery({
    queryKey: ['my-team', employee?.id],
    queryFn: () => employeeService.getTeam(employee!.id),
    enabled: !!employee?.id && isManager
  });
  const teamCount = teamData?.count || teamData?.data?.length || 0;

  // Manager: Pending approvals
  const { data: pendingData } = useQuery({
    queryKey: ['pending-approvals', activeCycle?.id],
    queryFn: () => goalsService.kpis.getPendingApprovals(activeCycle!.id),
    enabled: !!employee?.id && !!activeCycle?.id && isManager
  });
  const pendingApprovals = pendingData?.count || 0;

  // Manager: Completed evaluations (using quarterly manager reviews)
  const { data: completedData } = useQuery({
    queryKey: ['completed-evals', activeCycle?.id, employee?.id],
    queryFn: () => evaluationService.managerReviews.getCompletedCount(activeCycle!.id, employee!.id),
    enabled: !!employee?.id && !!activeCycle?.id && isManager
  });
  const completedEvals = completedData?.count || 0;

  const getSelfEvalStatus = () => {
    if (!selfEvaluation) return { label: 'Not Started', variant: 'secondary' as const };
    const status = selfEvaluation.status;
    if (status === 'submitted') return { label: 'Submitted', variant: 'default' as const };
    if (status === 'in_progress') return { label: 'In Progress', variant: 'outline' as const };
    return { label: 'Pending', variant: 'secondary' as const };
  };

  const getSelfEvalDueText = () => {
    if (!activeCycle?.self_evaluation_end) return 'Set up a cycle first';
    const dueDate = new Date(activeCycle.self_evaluation_end);
    const daysLeft = differenceInDays(dueDate, new Date());
    if (daysLeft < 0) return 'Overdue';
    if (daysLeft === 0) return 'Due today';
    return `Due in ${daysLeft} days`;
  };

  const getCyclePhase = () => {
    if (!activeCycle) return 'No active cycle';
    const now = new Date();
    if (activeCycle.goal_submission_end && now < new Date(activeCycle.goal_submission_end)) return 'Goal Setting Phase';
    if (activeCycle.goal_approval_end && now < new Date(activeCycle.goal_approval_end)) return 'Goal Approval Phase';
    if (activeCycle.self_evaluation_end && now < new Date(activeCycle.self_evaluation_end)) return 'Self Evaluation Phase';
    if (activeCycle.manager_evaluation_end && now < new Date(activeCycle.manager_evaluation_end)) return 'Manager Evaluation Phase';
    if (activeCycle.calibration_end && now < new Date(activeCycle.calibration_end)) return 'Calibration Phase';
    return 'Release Phase';
  };

  const getTimelineItems = () => {
    if (!activeCycle) {
      return [
        { label: 'Goal Submission', date: 'Set up a performance cycle first', status: 'pending', badge: 'Pending Setup' },
        { label: 'Self Evaluation', date: 'After goals are approved', status: 'upcoming', badge: 'Upcoming' },
        { label: 'Manager Evaluation', date: 'After self evaluation', status: 'upcoming', badge: 'Upcoming' },
        { label: 'Calibration & Release', date: 'HR reviews and finalizes', status: 'upcoming', badge: 'Upcoming' },
      ];
    }

    const now = new Date();
    const items = [];

    // Goal Submission
    if (activeCycle.goal_submission_start && activeCycle.goal_submission_end) {
    items.push({
      label: 'Goal Submission',
      date: `${format(new Date(activeCycle.goal_submission_start), 'MMM d')} - ${format(new Date(activeCycle.goal_submission_end), 'MMM d, yyyy')}`,
      status: now <= new Date(activeCycle.goal_submission_end) ? 'active' : 'done',
      badge: now <= new Date(activeCycle.goal_submission_end) ? 'Current' : 'Completed',
    });
    } else {
      items.push({ label: 'Goal Submission', date: 'Not configured', status: 'upcoming', badge: 'Not Set' });
    }

    // Self Evaluation
    if (activeCycle.self_evaluation_start && activeCycle.self_evaluation_end) {
      items.push({
        label: 'Self Evaluation',
        date: `${format(new Date(activeCycle.self_evaluation_start), 'MMM d')} - ${format(new Date(activeCycle.self_evaluation_end), 'MMM d, yyyy')}`,
        status: now < new Date(activeCycle.self_evaluation_start) ? 'upcoming' : now <= new Date(activeCycle.self_evaluation_end) ? 'active' : 'done',
        badge: now < new Date(activeCycle.self_evaluation_start) ? 'Upcoming' : now <= new Date(activeCycle.self_evaluation_end) ? 'Current' : 'Completed',
      });
    } else {
      items.push({ label: 'Self Evaluation', date: 'Not configured', status: 'upcoming', badge: 'Not Set' });
    }

    // Manager Evaluation
    if (activeCycle.manager_evaluation_start && activeCycle.manager_evaluation_end) {
    items.push({
      label: 'Manager Evaluation',
      date: `${format(new Date(activeCycle.manager_evaluation_start), 'MMM d')} - ${format(new Date(activeCycle.manager_evaluation_end), 'MMM d, yyyy')}`,
      status: now < new Date(activeCycle.manager_evaluation_start) ? 'upcoming' : now <= new Date(activeCycle.manager_evaluation_end) ? 'active' : 'done',
      badge: now < new Date(activeCycle.manager_evaluation_start) ? 'Upcoming' : now <= new Date(activeCycle.manager_evaluation_end) ? 'Current' : 'Completed',
    });
    } else {
      items.push({ label: 'Manager Evaluation', date: 'Not configured', status: 'upcoming', badge: 'Not Set' });
    }

    // Calibration & Release
    if (activeCycle.calibration_start && activeCycle.release_date) {
    items.push({
      label: 'Calibration & Release',
      date: `${format(new Date(activeCycle.calibration_start), 'MMM d')} - ${format(new Date(activeCycle.release_date), 'MMM d, yyyy')}`,
      status: now < new Date(activeCycle.calibration_start) ? 'upcoming' : now <= new Date(activeCycle.release_date) ? 'active' : 'done',
      badge: now < new Date(activeCycle.calibration_start) ? 'Upcoming' : now <= new Date(activeCycle.release_date) ? 'Current' : 'Completed',
    });
    } else {
      items.push({ label: 'Calibration & Release', date: 'Not configured', status: 'upcoming', badge: 'Not Set' });
    }

    return items;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Welcome back!</h1>
          <p className="text-muted-foreground">Here's an overview of your performance management activities.</p>
        </div>

        <Tabs defaultValue="employee" className="space-y-6">
          <TabsList>
            <TabsTrigger value="employee" className="gap-2"><User className="h-4 w-4" />Employee</TabsTrigger>
            {isManager && <TabsTrigger value="manager" className="gap-2"><Users className="h-4 w-4" />Manager</TabsTrigger>}
            {isHR && <TabsTrigger value="hr" className="gap-2"><Briefcase className="h-4 w-4" />HR</TabsTrigger>}
          </TabsList>

          <TabsContent value="employee">
            {!employee && isHR ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg">Set Up Your Employee Profile</h3>
                  <p className="text-muted-foreground mt-2">To manage your own goals and evaluations, create an employee record for yourself.</p>
                  <Link to="/admin/employees"><Button className="mt-4">Go to Employee Management</Button></Link>
                </CardContent>
              </Card>
            ) : !employee ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg">Employee Profile Not Found</h3>
                  <p className="text-muted-foreground mt-2">Your employee profile is not set up. Please contact HR.</p>
                </CardContent>
              </Card>
            ) : (
              <EmployeeDashboard
                goalsData={goalsData}
                selfEvaluation={selfEvaluation}
                selfEvalStatus={getSelfEvalStatus()}
                selfEvalDueText={getSelfEvalDueText()}
                activeCycle={activeCycle}
                cyclePhase={getCyclePhase()}
                goalsSubmitted={goalsData?.submitted || false}
              />
            )}
          </TabsContent>

          {isManager && (
            <TabsContent value="manager">
              <ManagerDashboard teamCount={teamCount} pendingApprovals={pendingApprovals} completedEvals={completedEvals} totalTeamEvals={teamCount} />
            </TabsContent>
          )}

          {isHR && <TabsContent value="hr"><HRDashboard /></TabsContent>}
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle>Performance Cycle Timeline</CardTitle>
            <CardDescription>Key dates for the current performance cycle</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative space-y-4">
              {getTimelineItems().map((item, index) => (
                <div key={index} className={`flex items-center gap-4 ${item.status === 'upcoming' ? 'opacity-50' : ''}`}>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    item.status === 'done' || item.status === 'active' ? 'bg-primary text-primary-foreground' : 'border-2 border-dashed'
                  }`}>
                    {item.status === 'done' || item.status === 'active' ? <CheckCircle className="h-5 w-5" /> : <Clock className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.date}</p>
                  </div>
                  <Badge variant={item.status === 'active' ? 'default' : item.status === 'done' ? 'outline' : 'secondary'}>{item.badge}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
