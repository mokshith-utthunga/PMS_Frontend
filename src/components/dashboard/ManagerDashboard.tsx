import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, CheckSquare, ClipboardList, BarChart3, ArrowRight, AlertCircle, CheckCircle, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ManagerDashboardProps {
  teamCount: number;
  pendingApprovals: number;
  completedEvals: number;
  totalTeamEvals: number;
  pendingQuarterlyReviews?: number;
}

export function ManagerDashboard({
  teamCount,
  pendingApprovals,
  completedEvals,
  totalTeamEvals,
  pendingQuarterlyReviews = 0,
}: ManagerDashboardProps) {
  const pendingEvals = totalTeamEvals - completedEvals;

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamCount}</div>
            <p className="text-xs text-muted-foreground">direct reports</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Goals Pending</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingApprovals}</div>
            <p className="text-xs text-muted-foreground">awaiting approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quarterly Reviews</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingQuarterlyReviews}</div>
            <p className="text-xs text-muted-foreground">pending review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Evaluations Done</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedEvals}</div>
            <p className="text-xs text-muted-foreground">of {totalTeamEvals} team members</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Evals</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingEvals > 0 ? pendingEvals : 0}</div>
            <p className="text-xs text-muted-foreground">to complete</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5" />
              View Team
            </CardTitle>
            <CardDescription>See all direct reports</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/team">
              <Button className="w-full">
                View Team
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckSquare className="h-5 w-5" />
              Approve Goals
            </CardTitle>
            <CardDescription>Review submitted goals</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/team">
              <Button variant={pendingApprovals > 0 ? 'default' : 'outline'} className="w-full">
                {pendingApprovals > 0 && <AlertCircle className="mr-2 h-4 w-4" />}
                {pendingApprovals > 0 ? `${pendingApprovals} Pending` : 'All Approved'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-5 w-5" />
              Quarterly Reviews
            </CardTitle>
            <CardDescription>Review team progress</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/team">
              <Button variant={pendingQuarterlyReviews > 0 ? 'default' : 'outline'} className="w-full">
                {pendingQuarterlyReviews > 0 && <AlertCircle className="mr-2 h-4 w-4" />}
                {pendingQuarterlyReviews > 0 ? `${pendingQuarterlyReviews} Pending` : 'All Reviewed'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-5 w-5" />
              Team Evaluations
            </CardTitle>
            <CardDescription>Complete manager evaluations</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/team">
              <Button variant="outline" className="w-full">
                Manage Evaluations
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-5 w-5" />
              Team Performance
            </CardTitle>
            <CardDescription>Overview of team ratings</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/reports">
              <Button variant="outline" className="w-full">
                View Reports
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Team Status Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Team Status Summary</CardTitle>
          <CardDescription>Quick overview of pending actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {pendingApprovals > 0 ? (
                <AlertCircle className="h-5 w-5 text-destructive" />
              ) : (
                <CheckCircle className="h-5 w-5 text-primary" />
              )}
              <span className="text-sm">
                {pendingApprovals > 0
                  ? `${pendingApprovals} goal${pendingApprovals > 1 ? 's' : ''} pending approval`
                  : 'All goals approved'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {pendingQuarterlyReviews > 0 ? (
                <AlertCircle className="h-5 w-5 text-amber-500" />
              ) : (
                <CheckCircle className="h-5 w-5 text-primary" />
              )}
              <span className="text-sm">
                {pendingQuarterlyReviews > 0
                  ? `${pendingQuarterlyReviews} quarterly review${pendingQuarterlyReviews > 1 ? 's' : ''} pending`
                  : 'All quarterly reviews completed'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {pendingEvals > 0 ? (
                <AlertCircle className="h-5 w-5 text-destructive" />
              ) : (
                <CheckCircle className="h-5 w-5 text-primary" />
              )}
              <span className="text-sm">
                {pendingEvals > 0
                  ? `${pendingEvals} evaluation${pendingEvals > 1 ? 's' : ''} pending completion`
                  : 'All evaluations completed'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
