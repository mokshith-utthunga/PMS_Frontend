// Admin Dashboard - Refactored
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Calendar, Upload, Shield, Building2, GraduationCap, MapPin, Target, FileText, ArrowRightLeft } from 'lucide-react';
import { statsService } from '@/services/stats.service';
import { StatCard } from '@/components/admin/StatCard';
import { QuickActionCard } from '@/components/admin/QuickActionCard';
import { GettingStartedCard } from '@/components/admin/GettingStartedCard';
import { SettingsCard } from '@/components/admin/SettingsCard';

export default function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: async () => {
      const result = await statsService.getAdminDashboard();
      return result.data;
    },
  });

  const employeeCount = stats?.totalEmployees || 0;
  const activeCyclesCount = stats?.activeCycles || 0;
  const departmentCount = stats?.departments || 0;
  const gradeCount = stats?.grades || 0;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
          <p className="text-muted-foreground">
            Manage employees, performance cycles, and system configuration.
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="employees">Employees</TabsTrigger>
            <TabsTrigger value="cycles">Cycles</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Total Employees"
                value={employeeCount}
                description="in the system"
                emptyDescription="Import employees to get started"
                icon={Users}
              />
              <StatCard
                title="Active Cycles"
                value={activeCyclesCount}
                description="performance cycles"
                emptyDescription="Create a performance cycle"
                icon={Calendar}
              />
              <StatCard
                title="Departments"
                value={departmentCount}
                description="configured"
                emptyDescription="Add departments"
                icon={Building2}
              />
              <StatCard
                title="Grades"
                value={gradeCount}
                description="grade levels"
                emptyDescription="Configure grade levels"
                icon={GraduationCap}
              />
            </div>

            {/* Quick Actions */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <QuickActionCard
                title="Import Employees"
                description="Bulk import employees from CSV file"
                icon={Upload}
                link="/admin/employees/import"
                buttonText="Import CSV"
              />
              <QuickActionCard
                title="Create Cycle"
                description="Set up a new performance review cycle"
                icon={Calendar}
                link="/admin/cycles/new"
                buttonText="New Cycle"
              />
              {/* <QuickActionCard
                title="Manage Roles"
                description="Assign roles and permissions to users"
                icon={Shield}
                link="/admin/roles"
                buttonText="Manage Roles"
                variant="secondary"
              /> */}
              <QuickActionCard
                title="Goal Templates"
                description="Create KRA/KPI templates for roles"
                icon={FileText}
                link="/admin/templates"
                buttonText="Manage Templates"
                variant="secondary"
              />
              <QuickActionCard
                title="Transitions"
                description="Manage mid-quarter employee transitions"
                icon={ArrowRightLeft}
                link="/admin/transitions"
                buttonText="Manage Transitions"
                variant="secondary"
              />
            </div>

            {/* Getting Started */}
            <GettingStartedCard
              departmentCount={departmentCount}
              employeeCount={employeeCount}
              activeCyclesCount={activeCyclesCount}
            />
          </TabsContent>

          {/* Employees Tab */}
          <TabsContent value="employees" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Employee Management</CardTitle>
                <CardDescription>View, add, and manage employee records</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Link to="/admin/employees">
                    <Button>
                      <Users className="mr-2 h-4 w-4" />
                      View All Employees
                    </Button>
                  </Link>
                  <Link to="/admin/employees/import">
                    <Button variant="outline">
                      <Upload className="mr-2 h-4 w-4" />
                      Import CSV
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cycles Tab */}
          <TabsContent value="cycles" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance Cycles</CardTitle>
                <CardDescription>Manage performance review cycles and their phases</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Link to="/admin/cycles">
                    <Button>
                      <Calendar className="mr-2 h-4 w-4" />
                      View All Cycles
                    </Button>
                  </Link>
                  <Link to="/admin/cycles/new">
                    <Button variant="outline">
                      <Calendar className="mr-2 h-4 w-4" />
                      Create New Cycle
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <SettingsCard
                title="Departments & Business Units"
                description="Configure organizational structure"
                icon={Building2}
                link="/admin/settings/departments"
              />
              <SettingsCard
                title="Grades"
                description="Define employee grade levels"
                icon={GraduationCap}
                link="/admin/settings/grades"
              />
              {/* <SettingsCard
                title="Locations"
                description="Configure office locations"
                icon={MapPin}
                link="/admin/settings/locations"
              /> */}
              {/* <SettingsCard
                title="Competencies"
                description="Define competency framework"
                icon={Target}
                link="/admin/settings/competencies"
              /> */}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
