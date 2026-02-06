import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { statsService } from '@/services';
import { Settings, Calendar, Scale, FileText, Grid3X3, Unlock, ArrowRight, Users, Building } from 'lucide-react';
import { Link } from 'react-router-dom';

export function HRDashboard() {
  // Fetch HR dashboard stats from backend
  const { data: stats } = useQuery({
    queryKey: ['hr-dashboard-stats'],
    queryFn: () => statsService.getHRDashboard()
  });

  const totalEmployees = stats?.totalEmployees || 0;
  const activeCyclesCount = stats?.activeCycles || 0;
  const pendingCalibrations = stats?.pendingCalibrations || 0;
  const departmentsCount = stats?.departments || 0;

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEmployees}</div>
            <p className="text-xs text-muted-foreground">in the organization</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Cycles</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCyclesCount}</div>
            <p className="text-xs text-muted-foreground">performance cycles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Calibrations</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCalibrations}</div>
            <p className="text-xs text-muted-foreground">sessions in draft</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Departments</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{departmentsCount}</div>
            <p className="text-xs text-muted-foreground">configured</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="h-5 w-5" />
              Admin Panel
            </CardTitle>
            <CardDescription>Full administration dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/admin">
              <Button className="w-full">
                Go to Admin
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-5 w-5" />
              Manage Cycles
            </CardTitle>
            <CardDescription>Create and manage performance cycles</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/admin/cycles">
              <Button variant="outline" className="w-full">
                View Cycles
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-5 w-5" />
              Calibration
            </CardTitle>
            <CardDescription>Run calibration sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/calibration">
              <Button variant="outline" className="w-full">
                View Calibration
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5" />
              Reports
            </CardTitle>
            <CardDescription>Organization-wide reports</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/reports">
              <Button variant="outline" className="w-full">
                View Reports
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card> */}

        {/* <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Grid3X3 className="h-5 w-5" />
              9-Box Grid
            </CardTitle>
            <CardDescription>View talent matrix</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/9box">
              <Button variant="outline" className="w-full">
                View 9-Box
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card> */}
{/* 
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Unlock className="h-5 w-5" />
              Rating Release
            </CardTitle>
            <CardDescription>Control rating visibility</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/admin/rating-release">
              <Button variant="outline" className="w-full">
                Manage Release
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card> */}
      </div>
    </div>
  );
}
