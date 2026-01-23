import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Target, ClipboardCheck, Star, Calendar, ArrowRight, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, differenceInDays } from 'date-fns';

interface EmployeeDashboardProps {
  goalsData: { count: number; totalWeight: number } | undefined;
  krasData?: { count: number; totalWeight: number } | undefined;
  selfEvaluation: { status?: string } | null | undefined;
  selfEvalStatus: { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' };
  selfEvalDueText: string;
  activeCycle: {
    name: string;
    goal_submission_end?: string | null;
    allow_late_goal_submission?: boolean;
    status?: string;
  } | null | undefined;
  cyclePhase: string;
  goalsSubmitted?: boolean;
}

export function EmployeeDashboard({
  goalsData,
  krasData,
  selfEvaluation,
  selfEvalStatus,
  selfEvalDueText,
  activeCycle,
  cyclePhase,
  goalsSubmitted = false,
}: EmployeeDashboardProps) {
  // Calculate pending status and deadline info
  const getPendingStatus = () => {
    if (!activeCycle) return { status: 'No Cycle', variant: 'secondary' as const, icon: Clock };
    
    if (!activeCycle.goal_submission_end) {
      return { status: 'No Deadline Set', variant: 'secondary' as const, icon: Clock };
    }
    
    const now = new Date();
    const goalDeadline = new Date(activeCycle.goal_submission_end);
    const daysUntilDeadline = differenceInDays(goalDeadline, now);
    
    if (goalsSubmitted) {
      return { status: 'Goals Submitted', variant: 'default' as const, icon: CheckCircle2 };
    }
    
    if (daysUntilDeadline < 0) {
      // Past deadline
      if (activeCycle.allow_late_goal_submission && activeCycle.status === 'active') {
        return { status: 'Late Submission Open', variant: 'outline' as const, icon: AlertTriangle };
      }
      return { status: 'Overdue', variant: 'destructive' as const, icon: AlertTriangle };
    }
    
    if (daysUntilDeadline <= 3) {
      return { status: 'Due Soon', variant: 'destructive' as const, icon: Clock };
    }
    
    return { status: 'Goals Pending', variant: 'secondary' as const, icon: Clock };
  };

  const getDeadlineText = () => {
    if (!activeCycle) return '';
    
    if (!activeCycle.goal_submission_end) {
      return 'Deadline not set';
    }
    
    const now = new Date();
    const goalDeadline = new Date(activeCycle.goal_submission_end);
    const daysUntilDeadline = differenceInDays(goalDeadline, now);
    
    if (goalsSubmitted) {
      return 'Awaiting manager approval';
    }
    
    if (daysUntilDeadline < 0) {
      const daysOverdue = Math.abs(daysUntilDeadline);
      if (activeCycle.allow_late_goal_submission) {
        return `${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue - HR has enabled late submission`;
      }
      return `${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue`;
    }
    
    if (daysUntilDeadline === 0) {
      return 'Due today!';
    }
    
    return `${daysUntilDeadline} day${daysUntilDeadline !== 1 ? 's' : ''} remaining`;
  };

  const pendingInfo = getPendingStatus();
  const StatusIcon = pendingInfo.icon;

  return (
    <div className="space-y-6">
      {/* Active Cycle Status Card */}
      {activeCycle && (
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{activeCycle.name}</h3>
                  <p className="text-sm text-muted-foreground">{cyclePhase}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:text-right">
                <div className="flex-1 sm:flex-none">
                  <Badge variant={pendingInfo.variant} className="gap-1">
                    <StatusIcon className="h-3 w-3" />
                    {pendingInfo.status}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">{getDeadlineText()}</p>
                </div>
                {!goalsSubmitted && (
                  <Link to="/goals">
                    <Button size="sm" variant={pendingInfo.variant === 'destructive' ? 'destructive' : 'default'}>
                      {pendingInfo.status === 'Overdue' || pendingInfo.status === 'Late Submission Open' ? 'Submit Now' : 'Set Goals'}
                    </Button>
                  </Link>
                )}
              </div>
            </div>
            {activeCycle.goal_submission_end && (
              <div className="mt-3 pt-3 border-t border-primary/10 text-xs text-muted-foreground">
                <span className="font-medium">Goal Submission Deadline:</span>{' '}
                {format(new Date(activeCycle.goal_submission_end), 'MMMM d, yyyy')}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My KRAs</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{krasData?.count || 0}</div>
            <p className="text-xs text-muted-foreground">{goalsData?.count || 0} KPIs total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Self Evaluation</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge variant={selfEvalStatus.variant}>{selfEvalStatus.label}</Badge>
            <p className="text-xs text-muted-foreground mt-1">{selfEvalDueText}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">KRA Weight</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{krasData?.totalWeight || 0}%</div>
            <Progress value={krasData?.totalWeight || 0} className="h-2 mt-1" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Cycle</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCycle?.name || 'None'}</div>
            <p className="text-xs text-muted-foreground">{cyclePhase}</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-5 w-5" />
              Manage Goals
            </CardTitle>
            <CardDescription>Set and submit performance goals</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/goals">
              <Button className="w-full">
                Go to Goals
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-5 w-5" />
              Quarterly Review
            </CardTitle>
            <CardDescription>Submit quarterly progress updates</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/quarterly-review">
              <Button variant="outline" className="w-full" disabled={!activeCycle}>
                Update Progress
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-5 w-5" />
              Self Evaluation
            </CardTitle>
            <CardDescription>Complete your self-assessment</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/evaluations">
              <Button variant="outline" className="w-full" disabled={!activeCycle}>
                {selfEvaluation?.status === 'submitted' ? 'View Evaluation' : 'Start Evaluation'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="h-5 w-5" />
              View My Rating
            </CardTitle>
            <CardDescription>See your final performance rating</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/my-rating">
              <Button variant="outline" className="w-full">
                View Rating
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-5 w-5" />
              Timeline
            </CardTitle>
            <CardDescription>View cycle phases and deadlines</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              <p className="font-medium">{cyclePhase}</p>
              <p className="text-xs mt-1">Check timeline below for details</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}