import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveCycle } from '@/contexts/ActiveCycleContext';
import { useCurrentEmployee } from '@/hooks/useCurrentEmployee';
import { employeeService, goalsService, evaluationService } from '@/services';
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

  // Get current employee from cached hook (fetched once at app initialization)
  const { employee } = useCurrentEmployee();

  // Get active cycle data from context (fetched once at app initialization)
  const { activeCycle, quarterlyCycles, goalsQuarterlyCycles, goalSetting, selfReview, managerReview, dashboard } = useActiveCycle();

  // Fetch my goals
  const { data: goals = [] } = useQuery({
    queryKey: ['my-goals', activeCycle?.id],
    queryFn: () => goalsService.kpis.getByEmployee(employee!.id, activeCycle!.id).then(r => r.data || []),
    enabled: !!employee?.id && !!activeCycle?.id
  });

  const { data: kras = [] } = useQuery({
    queryKey: ['my-kras', activeCycle?.id],
    queryFn: () => goalsService.kras.getByEmployee(employee!.id, activeCycle!.id).then(r => r.data || []),
    enabled: !!employee?.id && !!activeCycle?.id
  });

  const goalsData = {
    count: goals.length,
    totalWeight: goals.reduce((sum, g) => sum + Number(g.weight || 0), 0),
    submitted: goals.length > 0 && goals.every(g => ['submitted', 'approved', 'locked'].includes(g.status))
  };
  const krasData = {
    count: kras.length,
    totalWeight: kras.reduce((sum, k) => sum + Number(k.weight || 0), 0),
    submitted: kras.length > 0 && kras.every(k => ['submitted', 'approved', 'locked'].includes(k.status))
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

  // Get quarterly pending reviews from dashboard data
  const pendingQuarterlyReviews = dashboard?.quarterly_pending || 0;

  const getSelfEvalStatus = () => {
    if (!selfEvaluation) return { label: 'Not Started', variant: 'secondary' as const };
    const status = selfEvaluation.status;
    if (status === 'submitted') return { label: 'Submitted', variant: 'default' as const };
    if (status === 'in_progress') return { label: 'In Progress', variant: 'outline' as const };
    return { label: 'Pending', variant: 'secondary' as const };
  };

  const getSelfEvalDueText = () => {
    // Use quarterlyCycles data for self evaluation dates
    if (!selfReview?.review_for_quarter || !quarterlyCycles) return 'Set up a cycle first';

    const reviewQuarter = selfReview.review_for_quarter;
    const quarterlyCycle = quarterlyCycles.find(qc => qc.quarter === reviewQuarter);

    if (!quarterlyCycle?.self_review_end_date) return 'Set up a cycle first';

    const dueDate = new Date(quarterlyCycle.self_review_end_date);
    const daysLeft = differenceInDays(dueDate, new Date());
    if (daysLeft < 0) return 'Overdue';
    if (daysLeft === 0) return 'Due today';
    return `Due in ${daysLeft} days`;
  };

  const getCyclePhase = () => {
    if (!activeCycle) return 'No active cycle';
    const now = new Date();

    // Check goal setting phase using goalsQuarterlyCycles
    if (goalSetting?.enabled && goalSetting?.quarter) {
      const currentGoalsCycle = goalsQuarterlyCycles?.find(gqc => gqc.quarter === goalSetting.quarter);
      if (currentGoalsCycle?.goal_submission_end_date && now <= new Date(currentGoalsCycle.goal_submission_end_date)) {
        return 'Goal Setting Phase';
      }
    }

    // Check goal approval phase using goalsQuarterlyCycles
    if (goalSetting?.quarter) {
      const currentGoalsCycle = goalsQuarterlyCycles?.find(gqc => gqc.quarter === goalSetting.quarter);
      if (currentGoalsCycle?.goals_manager_review_end_date && now <= new Date(currentGoalsCycle.goals_manager_review_end_date)) {
        return 'Goal Approval Phase';
      }
    }

    // Check self evaluation phase using quarterlyCycles
    if (selfReview?.enabled && selfReview?.review_for_quarter) {
      const reviewQuarterlyCycle = quarterlyCycles?.find(qc => qc.quarter === selfReview.review_for_quarter);
      if (reviewQuarterlyCycle?.self_review_end_date && now <= new Date(reviewQuarterlyCycle.self_review_end_date)) {
        return 'Self Evaluation Phase';
      }
    }

    // Check manager evaluation phase using quarterlyCycles
    if (managerReview?.enabled && managerReview?.review_for_quarter) {
      const reviewQuarterlyCycle = quarterlyCycles?.find(qc => qc.quarter === managerReview.review_for_quarter);
      if (reviewQuarterlyCycle?.quarterly_manager_review_end_date && now <= new Date(reviewQuarterlyCycle.quarterly_manager_review_end_date)) {
        return 'Manager Evaluation Phase';
      }
    }

    // Check calibration phase (from activeCycle)
    if (activeCycle.calibration_end && now <= new Date(activeCycle.calibration_end)) return 'Calibration Phase';

    return 'Release Phase';
  };

  const getTimelineItems = () => {
    if (!activeCycle) {
      return [
        { label: 'Goal Submission', date: 'Set up a performance cycle first', status: 'pending', badge: 'Pending Setup' },
        { label: 'Self Evaluation', date: 'After goals are approved', status: 'upcoming', badge: 'Upcoming' },
        { label: 'Manager Evaluation', date: 'After self evaluation', status: 'upcoming', badge: 'Upcoming' },
        // { label: 'Calibration & Release', date: 'HR reviews and finalizes', status: 'upcoming', badge: 'Upcoming' },
      ];
    }

    const now = new Date();
    const items = [];

    // Goal Submission - Use goalsQuarterlyCycles for current quarter
    if (goalSetting?.quarter) {
      const currentGoalsCycle = goalsQuarterlyCycles?.find(gqc => gqc.quarter === goalSetting.quarter);
      if (currentGoalsCycle?.goal_submission_start_date && currentGoalsCycle?.goal_submission_end_date) {
        const startDate = new Date(currentGoalsCycle.goal_submission_start_date);
        const endDate = new Date(currentGoalsCycle.goal_submission_end_date);
        const isActive = now >= startDate && now <= endDate;
        const isDone = now > endDate;

        items.push({
          label: 'Goal Submission',
          date: `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`,
          status: isActive ? 'active' : isDone ? 'done' : 'upcoming',
          badge: isActive ? 'Current' : isDone ? 'Completed' : 'Upcoming',
        });
      } else {
        items.push({ label: 'Goal Submission', date: 'Not configured', status: 'upcoming', badge: 'Not Set' });
      }
    } else {
      items.push({ label: 'Goal Submission', date: 'Not configured', status: 'upcoming', badge: 'Not Set' });
    }

    // Self Evaluation - Use quarterlyCycles for review quarter
    if (selfReview?.review_for_quarter) {
      const reviewQuarterlyCycle = quarterlyCycles?.find(qc => qc.quarter === selfReview.review_for_quarter);
      if (reviewQuarterlyCycle?.self_review_start_date && reviewQuarterlyCycle?.self_review_end_date) {
        const startDate = new Date(reviewQuarterlyCycle.self_review_start_date);
        const endDate = new Date(reviewQuarterlyCycle.self_review_end_date);
        const isActive = now >= startDate && now <= endDate;
        const isDone = now > endDate;

        items.push({
          label: 'Self Evaluation',
          date: `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`,
          status: isActive ? 'active' : isDone ? 'done' : 'upcoming',
          badge: isActive ? 'Current' : isDone ? 'Completed' : 'Upcoming',
        });
      } else {
        items.push({ label: 'Self Evaluation', date: 'Not configured', status: 'upcoming', badge: 'Not Set' });
      }
    } else {
      items.push({ label: 'Self Evaluation', date: 'Not configured', status: 'upcoming', badge: 'Not Set' });
    }

    // Manager Evaluation - Use quarterlyCycles for review quarter
    if (managerReview?.review_for_quarter) {
      const reviewQuarterlyCycle = quarterlyCycles?.find(qc => qc.quarter === managerReview.review_for_quarter);
      if (reviewQuarterlyCycle?.quarterly_manager_review_start_date && reviewQuarterlyCycle?.quarterly_manager_review_end_date) {
        const startDate = new Date(reviewQuarterlyCycle.quarterly_manager_review_start_date);
        const endDate = new Date(reviewQuarterlyCycle.quarterly_manager_review_end_date);
        const isActive = now >= startDate && now <= endDate;
        const isDone = now > endDate;

        items.push({
          label: 'Manager Evaluation',
          date: `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`,
          status: isActive ? 'active' : isDone ? 'done' : 'upcoming',
          badge: isActive ? 'Current' : isDone ? 'Completed' : 'Upcoming',
        });
      } else {
        items.push({ label: 'Manager Evaluation', date: 'Not configured', status: 'upcoming', badge: 'Not Set' });
      }
    } else {
      items.push({ label: 'Manager Evaluation', date: 'Not configured', status: 'upcoming', badge: 'Not Set' });
    }

    // Calibration & Release - Use activeCycle data
    // if (activeCycle.calibration_start && activeCycle.release_date) {
    //   const startDate = new Date(activeCycle.calibration_start);
    //   const endDate = new Date(activeCycle.release_date);
    //   const isActive = now >= startDate && now <= endDate;
    //   const isDone = now > endDate;

    //   items.push({
    //     label: 'Calibration & Release',
    //     date: `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`,
    //     status: isActive ? 'active' : isDone ? 'done' : 'upcoming',
    //     badge: isActive ? 'Current' : isDone ? 'Completed' : 'Upcoming',
    //   });
    // } else {
    //   items.push({ label: 'Calibration & Release', date: 'Not configured', status: 'upcoming', badge: 'Not Set' });
    // }

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
                krasData={krasData}
                selfEvaluation={selfEvaluation}
                selfEvalStatus={getSelfEvalStatus()}
                selfEvalDueText={getSelfEvalDueText()}
                activeCycle={{
                  ...activeCycle,
                  goal_submission_end: goalSetting?.quarter
                    ? goalsQuarterlyCycles?.find(gqc => gqc.quarter === goalSetting.quarter)?.goal_submission_end_date || activeCycle?.goal_submission_end
                    : activeCycle?.goal_submission_end,
                  allow_late_goal_submission: goalSetting?.quarter
                    ? goalsQuarterlyCycles?.find(gqc => gqc.quarter === goalSetting.quarter)?.allow_late_goal_submission || activeCycle?.allow_late_goal_submission
                    : activeCycle?.allow_late_goal_submission
                }}
                cyclePhase={getCyclePhase()}
                goalsSubmitted={goalsData?.submitted || false}
              />
            )}
          </TabsContent>

          {isManager && (
            <TabsContent value="manager">
              <ManagerDashboard
                teamCount={teamCount}
                pendingApprovals={pendingApprovals}
                completedEvals={completedEvals}
                totalTeamEvals={teamCount}
                pendingQuarterlyReviews={pendingQuarterlyReviews}
              />
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
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${item.status === 'done' || item.status === 'active' ? 'bg-primary text-primary-foreground' : 'border-2 border-dashed'
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
