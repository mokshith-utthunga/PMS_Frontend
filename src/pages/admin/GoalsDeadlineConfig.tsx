import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { cycleService } from '@/services';
import { ArrowLeft, Calendar, Loader2, Save, AlertCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface GoalsDeadlineFormData {
  quarterly_start_date: string;
  quarterly_end_date: string;
  goal_submission_start_date: string;
  goal_submission_end_date: string;
  manager_review_start_date: string;
  manager_review_end_date: string;
  allow_late_goal_submission: boolean;
  status: string;
}

export default function GoalsDeadlineConfig() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const cycleId = searchParams.get('cycle_id') || '';
  const selectedQuarter = parseInt(searchParams.get('quarter') || '1');

  // Fetch cycles list
  const { data: cyclesData, isLoading: cyclesLoading } = useQuery({
    queryKey: ['cycles', 'active'],
    queryFn: () => cycleService.getList('active'),
  });

  // Fetch goals quarterly cycles for selected cycle
  const { data: goalsCyclesData, isLoading: goalsCyclesLoading } = useQuery({
    queryKey: ['goals-quarterly-cycles', cycleId],
    queryFn: () => cycleService.getGoalsQuarterlyCycles(cycleId),
    enabled: !!cycleId,
  });

  // Fetch specific quarter's goals cycle
  const { data: quarterCycleData, isLoading: quarterCycleLoading } = useQuery({
    queryKey: ['goals-quarterly-cycle', cycleId, selectedQuarter],
    queryFn: () => cycleService.getGoalsQuarterlyCycle(cycleId, selectedQuarter),
    enabled: !!cycleId && selectedQuarter >= 1 && selectedQuarter <= 4,
  });

  const [formData, setFormData] = useState<GoalsDeadlineFormData>({
    quarterly_start_date: '',
    quarterly_end_date: '',
    goal_submission_start_date: '',
    goal_submission_end_date: '',
    manager_review_start_date: '',
    manager_review_end_date: '',
    allow_late_goal_submission: false,
    status: 'draft',
  });

  // Update form data when quarter cycle data loads
  useEffect(() => {
    if (quarterCycleData?.data) {
      const data = quarterCycleData.data;
      setFormData({
        quarterly_start_date: data.quarterly_start_date || '',
        quarterly_end_date: data.quarterly_end_date || '',
        goal_submission_start_date: data.goal_submission_start_date || '',
        goal_submission_end_date: data.goal_submission_end_date || '',
        manager_review_start_date: data.goals_manager_review_start_date || '',
        manager_review_end_date: data.goals_manager_review_end_date || '',
        allow_late_goal_submission: data.allow_late_goal_submission || false,
        status: data.status || 'draft',
      });
    }
  }, [quarterCycleData]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<GoalsDeadlineFormData>) => {
      if (!cycleId) throw new Error('Cycle ID is required');
      return cycleService.updateGoalsQuarterlyCycle(cycleId, selectedQuarter, data);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: `Q${selectedQuarter} goals deadline configuration updated successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['goals-quarterly-cycles', cycleId] });
      queryClient.invalidateQueries({ queryKey: ['goals-quarterly-cycle', cycleId, selectedQuarter] });
    },
    onError: (error: any) => {
      const errorMessage = error.message || 'Failed to update goals deadline configuration';
      const errorDetails = error.details 
        ? (Array.isArray(error.details) ? error.details.join(', ') : error.details)
        : '';
      toast({
        title: 'Error',
        description: `${errorMessage}${errorDetails ? `. ${errorDetails}` : ''}`,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cycleId) {
      toast({
        title: 'Error',
        description: 'Please select a performance cycle',
        variant: 'destructive',
      });
      return;
    }

    updateMutation.mutate(formData);
  };

  const handleCycleChange = (newCycleId: string) => {
    setSearchParams({ cycle_id: newCycleId, quarter: selectedQuarter.toString() });
  };

  const handleQuarterChange = (quarter: number) => {
    setSearchParams({ cycle_id: cycleId, quarter: quarter.toString() });
  };

  const isLoading = cyclesLoading || goalsCyclesLoading || quarterCycleLoading;

  return (
    <MainLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Goals Deadline Configuration</h1>
            <p className="text-muted-foreground">
              Set goal submission and approval deadlines for each quarter
            </p>
          </div>
        </div>

        {/* Cycle Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Performance Cycle</CardTitle>
            <CardDescription>Choose the performance cycle to configure goal deadlines</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="cycle">Performance Cycle</Label>
                <Select
                  value={cycleId}
                  onValueChange={handleCycleChange}
                  disabled={cyclesLoading}
                >
                  <SelectTrigger id="cycle">
                    <SelectValue placeholder="Select a cycle" />
                  </SelectTrigger>
                  <SelectContent>
                    {cyclesData?.data?.map((cycle) => (
                      <SelectItem key={cycle.id} value={cycle.id}>
                        {cycle.name} ({cycle.year})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!cycleId && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please select a performance cycle to configure goal deadlines.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quarter Selection and Form */}
        {cycleId && (
          <Card>
            <CardHeader>
              <CardTitle>Quarter Configuration</CardTitle>
              <CardDescription>
                Configure goal deadlines for each quarter. Select a quarter tab below.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={selectedQuarter.toString()} onValueChange={(v) => handleQuarterChange(parseInt(v))}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="1">Q1</TabsTrigger>
                  <TabsTrigger value="2">Q2</TabsTrigger>
                  <TabsTrigger value="3">Q3</TabsTrigger>
                  <TabsTrigger value="4">Q4</TabsTrigger>
                </TabsList>

                {[1, 2, 3, 4].map((quarter) => (
                  <TabsContent key={quarter} value={quarter.toString()}>
                    {isLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          {/* Quarterly Period */}
                          <div className="space-y-2">
                            <Label htmlFor={`q${quarter}_quarterly_start`}>
                              Quarterly Start Date
                            </Label>
                            <Input
                              id={`q${quarter}_quarterly_start`}
                              type="date"
                              value={formData.quarterly_start_date}
                              onChange={(e) =>
                                setFormData({ ...formData, quarterly_start_date: e.target.value })
                              }
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`q${quarter}_quarterly_end`}>
                              Quarterly End Date
                            </Label>
                            <Input
                              id={`q${quarter}_quarterly_end`}
                              type="date"
                              value={formData.quarterly_end_date}
                              onChange={(e) =>
                                setFormData({ ...formData, quarterly_end_date: e.target.value })
                              }
                              required
                            />
                          </div>

                          {/* Goal Submission Period */}
                          <div className="space-y-2">
                            <Label htmlFor={`q${quarter}_goal_submission_start`}>
                              Goal Submission Start Date
                            </Label>
                            <Input
                              id={`q${quarter}_goal_submission_start`}
                              type="date"
                              value={formData.goal_submission_start_date}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  goal_submission_start_date: e.target.value,
                                })
                              }
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`q${quarter}_goal_submission_end`}>
                              Goal Submission End Date
                            </Label>
                            <Input
                              id={`q${quarter}_goal_submission_end`}
                              type="date"
                              value={formData.goal_submission_end_date}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  goal_submission_end_date: e.target.value,
                                })
                              }
                              required
                            />
                          </div>

                          {/* Manager Review Period */}
                          <div className="space-y-2">
                            <Label htmlFor={`q${quarter}_manager_review_start`}>
                              Manager Review Start Date
                            </Label>
                            <Input
                              id={`q${quarter}_manager_review_start`}
                              type="date"
                              value={formData.manager_review_start_date}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  manager_review_start_date: e.target.value,
                                })
                              }
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`q${quarter}_manager_review_end`}>
                              Manager Review End Date
                            </Label>
                            <Input
                              id={`q${quarter}_manager_review_end`}
                              type="date"
                              value={formData.manager_review_end_date}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  manager_review_end_date: e.target.value,
                                })
                              }
                              required
                            />
                          </div>
                        </div>

                        {/* Allow Late Submission */}
                        <div className="flex items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <Label htmlFor={`q${quarter}_allow_late`} className="text-base">
                              Allow Late Goal Submission
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Enable late submission for all employees after the deadline
                            </p>
                          </div>
                          <Switch
                            id={`q${quarter}_allow_late`}
                            checked={formData.allow_late_goal_submission}
                            onCheckedChange={(checked) =>
                              setFormData({
                                ...formData,
                                allow_late_goal_submission: checked,
                              })
                            }
                          />
                        </div>

                        <div className="flex justify-end gap-2">
                          <Button
                            type="submit"
                            disabled={updateMutation.isPending}
                          >
                            {updateMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="mr-2 h-4 w-4" />
                                Save Q{quarter} Configuration
                              </>
                            )}
                          </Button>
                        </div>
                      </form>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
