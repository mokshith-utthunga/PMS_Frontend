import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cycleService, employeeService, goalsService, evaluationService, calibrationService, settingsService } from '@/services';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Download,
  Loader2,
  Target,
  Users,
  ClipboardCheck,
  TrendingUp,
} from 'lucide-react';

interface CycleStats {
  total_employees: number;
  goals_submitted: number;
  goals_approved: number;
  self_evals_submitted: number;
  manager_evals_submitted: number;
  calibration_completed: number;
}

interface DepartmentRating {
  department: string;
  avg_rating: number;
  employee_count: number;
  rating_1: number;
  rating_2: number;
  rating_3: number;
  rating_4: number;
  rating_5: number;
}

interface GoalTypeData {
  type: string;
  count: number;
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'];

export default function Reports() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [cycles, setCycles] = useState<any[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [cycleStats, setCycleStats] = useState<CycleStats | null>(null);
  const [departmentRatings, setDepartmentRatings] = useState<DepartmentRating[]>([]);
  const [goalTypeData, setGoalTypeData] = useState<GoalTypeData[]>([]);
  const [ratingDistribution, setRatingDistribution] = useState<any[]>([]);
  const [completionTimeline, setCompletionTimeline] = useState<any[]>([]);

  useEffect(() => {
    fetchCycles();
  }, []);

  useEffect(() => {
    if (selectedCycleId) {
      fetchReportData();
    }
  }, [selectedCycleId]);

  const fetchCycles = async () => {
    try {
      const result = await cycleService.getList();
      const allCycles = (result.data || []).filter(c => ['active', 'closed', 'archived'].includes(c.status));
      setCycles(allCycles);
      if (allCycles.length > 0) {
        setSelectedCycleId(allCycles[0].id);
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const fetchReportData = async () => {
    setLoading(true);
    try {
      // Get all employees
      const empResult = await employeeService.getList({ status: 'active' });
      const employees = empResult.data || [];
      const totalEmployees = empResult.count || employees.length;

      // Get goals stats - we need to fetch for all employees in this cycle
      // Using a simple approach: fetch all goals for this cycle
      const goalsPromises = employees.map(emp => goalsService.kpis.getByEmployee(emp.id, selectedCycleId));
      const goalsResults = await Promise.all(goalsPromises);
      const goals = goalsResults.flatMap(r => r.data || []);

      const goalsSubmitted = new Set(goals.filter(g => g.status !== 'draft').map(g => g.employee_id)).size;
      const goalsApproved = new Set(goals.filter(g => g.status === 'approved').map(g => g.employee_id)).size;

      // Goal type distribution
      const goalTypeCounts: Record<string, number> = {};
      goals.forEach(g => {
        goalTypeCounts[g.goal_type] = (goalTypeCounts[g.goal_type] || 0) + 1;
      });
      setGoalTypeData(Object.entries(goalTypeCounts).map(([type, count]) => ({ type, count })));

      // Get quarterly self reviews for each employee
      const selfReviewsPromises = employees.map(emp => evaluationService.selfReviews.get(emp.id, selectedCycleId));
      const selfReviewsResults = await Promise.all(selfReviewsPromises);
      const selfReviews = selfReviewsResults.flatMap(r => r.data || []);
      const selfEvalsSubmitted = selfReviews.filter(e => e.status === 'submitted').length;

      // Get quarterly manager reviews for each employee
      const mgrReviewsPromises = employees.map(emp => evaluationService.managerReviews.get(emp.id, selectedCycleId));
      const mgrReviewsResults = await Promise.all(mgrReviewsPromises);
      const mgrEvals = mgrReviewsResults.flatMap(r => r.data || []);
      const mgrEvalsSubmitted = mgrEvals.filter((e: any) => e.status === 'submitted').length;

      // Rating distribution
      const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      mgrEvals.filter((e: any) => e.status === 'submitted' && e.overall_rating).forEach((e: any) => {
        if (e.overall_rating) {
          ratingCounts[e.overall_rating] = (ratingCounts[e.overall_rating] || 0) + 1;
        }
      });

      const ratingScalesResult = await settingsService.ratingScales.getDefault();
      const ratingScales = (ratingScalesResult.data || []).sort((a: any, b: any) => (a.rating ?? a.value) - (b.rating ?? b.value));

      setRatingDistribution(
        ratingScales.map((scale: any) => ({
          name: `${scale.rating ?? scale.value} - ${scale.label ?? scale.name}`,
          value: ratingCounts[scale.rating ?? scale.value] || 0,
          color: scale.color || COLORS[(scale.rating ?? scale.value) - 1],
        }))
      );

      // Get calibration entries
      const calibrationResult = await calibrationService.groups.getAll(selectedCycleId);
      const calibrationGroups = calibrationResult.data || [];
      const completedCalibrations = calibrationGroups.filter(g => g.status === 'completed').length;

      // Calculate department ratings
      const deptRatings: Record<string, { total: number; count: number; ratings: Record<number, number> }> = {};

      employees.forEach(emp => {
        if (!deptRatings[emp.department]) {
          deptRatings[emp.department] = { total: 0, count: 0, ratings: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
        }
      });

      mgrEvals.filter((e: any) => e.status === 'submitted' && e.overall_rating).forEach((eval_: any) => {
        const emp = employees.find(e => e.id === eval_.employee_id);
        if (emp && deptRatings[emp.department]) {
          deptRatings[emp.department].total += eval_.overall_rating!;
          deptRatings[emp.department].count += 1;
          deptRatings[emp.department].ratings[eval_.overall_rating!] += 1;
        }
      });

      setDepartmentRatings(
        Object.entries(deptRatings)
          .filter(([_, data]) => data.count > 0)
          .map(([department, data]) => ({
            department,
            avg_rating: data.count > 0 ? data.total / data.count : 0,
            employee_count: data.count,
            rating_1: data.ratings[1],
            rating_2: data.ratings[2],
            rating_3: data.ratings[3],
            rating_4: data.ratings[4],
            rating_5: data.ratings[5],
          }))
      );

      // Set cycle stats
      setCycleStats({
        total_employees: totalEmployees,
        goals_submitted: goalsSubmitted,
        goals_approved: goalsApproved,
        self_evals_submitted: selfEvalsSubmitted,
        manager_evals_submitted: mgrEvalsSubmitted,
        calibration_completed: completedCalibrations,
      });

      // Completion timeline
      setCompletionTimeline([
        { phase: 'Goal Setting', target: 100, actual: totalEmployees ? (goalsSubmitted / totalEmployees) * 100 : 0 },
        { phase: 'Goal Approval', target: 100, actual: totalEmployees ? (goalsApproved / totalEmployees) * 100 : 0 },
        { phase: 'Self Evaluation', target: 100, actual: totalEmployees ? (selfEvalsSubmitted / totalEmployees) * 100 : 0 },
        { phase: 'Manager Evaluation', target: 100, actual: totalEmployees ? (mgrEvalsSubmitted / totalEmployees) * 100 : 0 },
      ]);

    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      toast({ title: 'No data to export', variant: 'destructive' });
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const exportFullReport = async () => {
    try {
      const empResult = await employeeService.getList({ status: 'active' });
      const employees = empResult.data || [];

      // Get quarterly reviews for each employee
      const mgrReviewsPromises = employees.map(emp => evaluationService.managerReviews.get(emp.id, selectedCycleId));
      const mgrReviewsResults = await Promise.all(mgrReviewsPromises);
      const mgrReviews = mgrReviewsResults.flatMap(r => r.data || []);

      const selfReviewsPromises = employees.map(emp => evaluationService.selfReviews.get(emp.id, selectedCycleId));
      const selfReviewsResults = await Promise.all(selfReviewsPromises);
      const selfReviews = selfReviewsResults.flatMap(r => r.data || []);

      const reportData = employees.map(emp => {
        // Get latest quarterly manager review for this employee
        const mgrReview = mgrReviews
          .filter((e: any) => e.employee_id === emp.id)
          .sort((a: any, b: any) => (b.quarter || 0) - (a.quarter || 0))[0];
        // Get latest quarterly self review for this employee
        const selfReview = selfReviews
          .filter((e: any) => e.employee_id === emp.id)
          .sort((a: any, b: any) => (b.quarter || 0) - (a.quarter || 0))[0];

        return {
          emp_id: emp.emp_id,
          first_name: emp.first_name,
          last_name: emp.last_name,
          email: emp.email,
          department: emp.department,
          grade: emp.grade,
          business_unit: emp.business_unit,
          self_rating: (selfReview as any)?.calculated_overall_rating || '',
          self_eval_status: selfReview?.status || 'pending',
          manager_rating: (mgrReview as any)?.calculated_overall_rating || '',
          manager_eval_status: mgrReview?.status || 'pending',
        };
      });

      exportToCSV(reportData, 'performance_report');
      toast({ title: 'Report exported successfully' });
    } catch (error: any) {
      toast({ title: 'Export failed', description: error.message, variant: 'destructive' });
    }
  };

  if (loading && !cycleStats) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
            <p className="text-muted-foreground">
              Performance analytics and insights
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={selectedCycleId} onValueChange={setSelectedCycleId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select cycle" />
              </SelectTrigger>
              <SelectContent>
                {cycles.map(cycle => (
                  <SelectItem key={cycle.id} value={cycle.id}>
                    {cycle.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={exportFullReport}>
              <Download className="mr-2 h-4 w-4" />
              Export Report
            </Button>
          </div>
        </div>

        {cycleStats && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{cycleStats.total_employees}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Goals Approved</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{cycleStats.goals_approved}</div>
                <p className="text-xs text-muted-foreground">
                  {cycleStats.total_employees > 0
                    ? `${((cycleStats.goals_approved / cycleStats.total_employees) * 100).toFixed(1)}% completion`
                    : '0%'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Self Evaluations</CardTitle>
                <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{cycleStats.self_evals_submitted}</div>
                <p className="text-xs text-muted-foreground">
                  {cycleStats.total_employees > 0
                    ? `${((cycleStats.self_evals_submitted / cycleStats.total_employees) * 100).toFixed(1)}% completion`
                    : '0%'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Manager Evaluations</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{cycleStats.manager_evals_submitted}</div>
                <p className="text-xs text-muted-foreground">
                  {cycleStats.total_employees > 0
                    ? `${((cycleStats.manager_evals_submitted / cycleStats.total_employees) * 100).toFixed(1)}% completion`
                    : '0%'}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="completion" className="space-y-4">
          <TabsList>
            <TabsTrigger value="completion">Completion Status</TabsTrigger>
            <TabsTrigger value="ratings">Rating Distribution</TabsTrigger>
            <TabsTrigger value="departments">By Department</TabsTrigger>
            <TabsTrigger value="goals">Goal Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="completion" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Cycle Completion Progress</CardTitle>
                <CardDescription>Completion rates across performance cycle phases</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={completionTimeline} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <YAxis type="category" dataKey="phase" width={120} />
                      <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                      <Legend />
                      <Bar dataKey="actual" name="Actual" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="target" name="Target" fill="hsl(var(--muted))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ratings" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Rating Distribution</CardTitle>
                    <CardDescription>Distribution of manager ratings</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToCSV(ratingDistribution, 'rating_distribution')}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={ratingDistribution}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {ratingDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Rating Breakdown</CardTitle>
                  <CardDescription>Detailed rating counts</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ratingDistribution}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" name="Employees">
                          {ratingDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="departments" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Average Rating by Department</CardTitle>
                  <CardDescription>Compare performance across departments</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportToCSV(departmentRatings, 'department_ratings')}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={departmentRatings}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="department" angle={-45} textAnchor="end" height={100} />
                      <YAxis domain={[0, 5]} />
                      <Tooltip
                        formatter={(value: number, name: string) => {
                          if (name === 'avg_rating') return [value.toFixed(2), 'Avg Rating'];
                          return [value, name];
                        }}
                      />
                      <Legend />
                      <Bar dataKey="avg_rating" name="Average Rating" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rating Distribution by Department</CardTitle>
                <CardDescription>Stacked view of ratings per department</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={departmentRatings}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="department" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="rating_5" name="5 - Outstanding" stackId="a" fill={COLORS[4]} />
                      <Bar dataKey="rating_4" name="4 - Exceeds" stackId="a" fill={COLORS[3]} />
                      <Bar dataKey="rating_3" name="3 - Meets" stackId="a" fill={COLORS[2]} />
                      <Bar dataKey="rating_2" name="2 - Needs Improvement" stackId="a" fill={COLORS[1]} />
                      <Bar dataKey="rating_1" name="1 - Unsatisfactory" stackId="a" fill={COLORS[0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="goals" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Goals by Type</CardTitle>
                    <CardDescription>Distribution of goal types</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToCSV(goalTypeData, 'goal_types')}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={goalTypeData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ type, count }) => `${type}: ${count}`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="count"
                          nameKey="type"
                        >
                          {goalTypeData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Goal Type Breakdown</CardTitle>
                  <CardDescription>Number of goals by category</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={goalTypeData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="type" width={120} />
                        <Tooltip />
                        <Bar dataKey="count" name="Goals" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
