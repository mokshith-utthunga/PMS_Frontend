import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { cycleService, settingsService } from '@/services';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Calendar, Loader2, ChevronDown, Users, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function CycleForm() {
  const navigate = useNavigate();
  const { cycleId } = useParams();
  const isEditMode = Boolean(cycleId);
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);
  const [businessUnits, setBusinessUnits] = useState<string[]>([]);
  const [applyToAll, setApplyToAll] = useState(true);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedBusinessUnits, setSelectedBusinessUnits] = useState<string[]>([]);
  const [openQuarters, setOpenQuarters] = useState<Record<string, boolean>>({
    q1: false,
    q2: false,
    q3: false,
    q4: false,
  });

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    year: new Date().getFullYear(),
    goal_submission_start: '',
    goal_submission_end: '',
    goal_approval_end: '',
    manager_evaluation_start: '',
    manager_evaluation_end: '',
    calibration_start: '',
    calibration_end: '',
    release_date: '',
    allow_late_goal_submission: false,
    q1_self_review_start: '',
    q1_self_review_end: '',
    q1_manager_review_start: '',
    q1_manager_review_end: '',
    q2_self_review_start: '',
    q2_self_review_end: '',
    q2_manager_review_start: '',
    q2_manager_review_end: '',
    q3_self_review_start: '',
    q3_self_review_end: '',
    q3_manager_review_start: '',
    q3_manager_review_end: '',
    q4_self_review_start: '',
    q4_self_review_end: '',
    q4_manager_review_start: '',
    q4_manager_review_end: '',
  });

  useEffect(() => {
    fetchTeams();
    if (isEditMode && cycleId) {
      fetchCycle();
    }
  }, [cycleId, isEditMode]);

  const fetchCycle = async () => {
    if (!cycleId) return;
    setIsLoading(true);
    try {
      const result = await cycleService.getById(cycleId);

      if (result.data) {
        const data = result.data;
        setFormData({
          name: data.name || '',
          description: data.description || '',
          year: data.year || new Date().getFullYear(),
          goal_submission_start: data.goal_submission_start || '',
          goal_submission_end: data.goal_submission_end || '',
          goal_approval_end: data.goal_approval_end || '',
          manager_evaluation_start: data.manager_evaluation_start || '',
          manager_evaluation_end: data.manager_evaluation_end || '',
          calibration_start: data.calibration_start || '',
          calibration_end: data.calibration_end || '',
          release_date: data.release_date || '',
          allow_late_goal_submission: data.allow_late_goal_submission || false,
          q1_self_review_start: data.q1_self_review_start || '',
          q1_self_review_end: data.q1_self_review_end || '',
          q1_manager_review_start: data.q1_manager_review_start || '',
          q1_manager_review_end: data.q1_manager_review_end || '',
          q2_self_review_start: data.q2_self_review_start || '',
          q2_self_review_end: data.q2_self_review_end || '',
          q2_manager_review_start: data.q2_manager_review_start || '',
          q2_manager_review_end: data.q2_manager_review_end || '',
          q3_self_review_start: data.q3_self_review_start || '',
          q3_self_review_end: data.q3_self_review_end || '',
          q3_manager_review_start: data.q3_manager_review_start || '',
          q3_manager_review_end: data.q3_manager_review_end || '',
          q4_self_review_start: data.q4_self_review_start || '',
          q4_self_review_end: data.q4_self_review_end || '',
          q4_manager_review_start: data.q4_manager_review_start || '',
          q4_manager_review_end: data.q4_manager_review_end || '',
        });

        if (data.applicable_departments || data.applicable_business_units) {
          setApplyToAll(false);
          setSelectedDepartments(data.applicable_departments || []);
          setSelectedBusinessUnits(data.applicable_business_units || []);
        }

        const quarters = { q1: false, q2: false, q3: false, q4: false };
        if (data.q1_self_review_start) quarters.q1 = true;
        if (data.q2_self_review_start) quarters.q2 = true;
        if (data.q3_self_review_start) quarters.q3 = true;
        if (data.q4_self_review_start) quarters.q4 = true;
        setOpenQuarters(quarters);
      }
    } catch (error) {
      console.error('Error fetching cycle:', error);
      toast({
        title: 'Error',
        description: 'Failed to load cycle data.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTeams = async () => {
    try {
      const [deptRes, buRes] = await Promise.all([
        settingsService.departments.getAll(),
        settingsService.businessUnits.getAll(),
      ]);
      
      if (deptRes.data) setDepartments(deptRes.data.map(d => d.name));
      if (buRes.data) setBusinessUnits(buRes.data.map(b => b.name));
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const toggleQuarter = (quarter: string) => {
    setOpenQuarters(prev => ({ ...prev, [quarter]: !prev[quarter] }));
  };

  const toggleDepartment = (dept: string) => {
    setSelectedDepartments(prev => 
      prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]
    );
  };

  const toggleBusinessUnit = (bu: string) => {
    setSelectedBusinessUnits(prev => 
      prev.includes(bu) ? prev.filter(b => b !== bu) : [...prev, bu]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const submitData: Record<string, any> = {
        name: formData.name,
        description: formData.description,
        year: Number(formData.year),
        goal_submission_start: formData.goal_submission_start,
        goal_submission_end: formData.goal_submission_end,
        goal_approval_end: formData.goal_approval_end,
        manager_evaluation_start: formData.manager_evaluation_start,
        manager_evaluation_end: formData.manager_evaluation_end,
        calibration_start: formData.calibration_start,
        calibration_end: formData.calibration_end,
        release_date: formData.release_date,
        applicable_departments: applyToAll ? null : (selectedDepartments.length > 0 ? selectedDepartments : null),
        applicable_business_units: applyToAll ? null : (selectedBusinessUnits.length > 0 ? selectedBusinessUnits : null),
        allow_late_goal_submission: formData.allow_late_goal_submission,
      };

      if (!isEditMode) {
        submitData.created_by = user?.id;
        submitData.status = 'draft';
      }

      const quarterlyFields = [
        'q1_self_review_start', 'q1_self_review_end', 'q1_manager_review_start', 'q1_manager_review_end',
        'q2_self_review_start', 'q2_self_review_end', 'q2_manager_review_start', 'q2_manager_review_end',
        'q3_self_review_start', 'q3_self_review_end', 'q3_manager_review_start', 'q3_manager_review_end',
        'q4_self_review_start', 'q4_self_review_end', 'q4_manager_review_start', 'q4_manager_review_end',
      ] as const;

      quarterlyFields.forEach(field => {
        submitData[field] = formData[field] || null;
      });

      if (isEditMode && cycleId) {
        await cycleService.update(cycleId, submitData);
      } else {
        await cycleService.create(submitData);
      }

      toast({
        title: isEditMode ? 'Cycle Updated' : 'Cycle Created',
        description: `The performance cycle has been ${isEditMode ? 'updated' : 'created'} successfully.`
      });
      navigate('/admin/cycles');
    } catch (error: any) {
      console.error('Error saving cycle:', error);
      toast({
        title: 'Error',
        description: error.message || `Failed to ${isEditMode ? 'update' : 'create'} cycle.`,
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const QuarterSection = ({ quarter, label }: { quarter: 'q1' | 'q2' | 'q3' | 'q4'; label: string }) => (
    <Collapsible open={openQuarters[quarter]} onOpenChange={() => toggleQuarter(quarter)}>
      <Card className="mt-4">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                <CardTitle className="text-base">{label} Quarterly Review</CardTitle>
              </div>
              <ChevronDown className={cn("h-5 w-5 transition-transform", openQuarters[quarter] && "rotate-180")} />
            </div>
            <CardDescription>Optional: Set dates for {label} progress reviews</CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`${quarter}_self_review_start`}>Employee Review Start</Label>
                <Input
                  id={`${quarter}_self_review_start`}
                  name={`${quarter}_self_review_start`}
                  type="date"
                  value={String(formData[`${quarter}_self_review_start` as keyof typeof formData] || '')}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${quarter}_self_review_end`}>Employee Review End</Label>
                <Input
                  id={`${quarter}_self_review_end`}
                  name={`${quarter}_self_review_end`}
                  type="date"
                  value={String(formData[`${quarter}_self_review_end` as keyof typeof formData] || '')}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`${quarter}_manager_review_start`}>Manager Review Start</Label>
                <Input
                  id={`${quarter}_manager_review_start`}
                  name={`${quarter}_manager_review_start`}
                  type="date"
                  value={String(formData[`${quarter}_manager_review_start` as keyof typeof formData] || '')}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${quarter}_manager_review_end`}>Manager Review End</Label>
                <Input
                  id={`${quarter}_manager_review_end`}
                  name={`${quarter}_manager_review_end`}
                  type="date"
                  value={String(formData[`${quarter}_manager_review_end` as keyof typeof formData] || '')}
                  onChange={handleChange}
                />
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-4">
          <Link to="/admin/cycles">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {isEditMode ? 'Edit Performance Cycle' : 'Create Performance Cycle'}
            </h1>
            <p className="text-muted-foreground">
              {isEditMode ? 'Update the performance review cycle settings' : 'Set up a new performance review cycle with dates for each phase'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Cycle Details</CardTitle>
              <CardDescription>Basic information about the performance cycle</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Cycle Name</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="e.g., FY 2024-25 Annual Review"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">Year</Label>
                  <Input
                    id="year"
                    name="year"
                    type="number"
                    min="2020"
                    max="2030"
                    value={formData.year}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Brief description of this performance cycle"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Applicable Teams
              </CardTitle>
              <CardDescription>Choose which teams this cycle applies to</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Apply to all teams</Label>
                  <p className="text-sm text-muted-foreground">
                    This cycle will apply to all departments and business units
                  </p>
                </div>
                <Switch
                  checked={applyToAll}
                  onCheckedChange={setApplyToAll}
                />
              </div>

              {!applyToAll && (
                <div className="space-y-4 pt-4 border-t">
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Select specific departments or business units. Leave empty to apply to all.
                    </AlertDescription>
                  </Alert>

                  {departments.length > 0 && (
                    <div className="space-y-2">
                      <Label>Departments</Label>
                      <div className="flex flex-wrap gap-2">
                        {departments.map(dept => (
                          <div
                            key={dept}
                            className={cn(
                              "flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer transition-colors",
                              selectedDepartments.includes(dept)
                                ? "bg-primary text-primary-foreground border-primary"
                                : "hover:bg-muted"
                            )}
                            onClick={() => toggleDepartment(dept)}
                          >
                            <Checkbox
                              checked={selectedDepartments.includes(dept)}
                              className="pointer-events-none"
                            />
                            <span className="text-sm">{dept}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {businessUnits.length > 0 && (
                    <div className="space-y-2">
                      <Label>Business Units</Label>
                      <div className="flex flex-wrap gap-2">
                        {businessUnits.map(bu => (
                          <div
                            key={bu}
                            className={cn(
                              "flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer transition-colors",
                              selectedBusinessUnits.includes(bu)
                                ? "bg-primary text-primary-foreground border-primary"
                                : "hover:bg-muted"
                            )}
                            onClick={() => toggleBusinessUnit(bu)}
                          >
                            <Checkbox
                              checked={selectedBusinessUnits.includes(bu)}
                              className="pointer-events-none"
                            />
                            <span className="text-sm">{bu}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Goal Setting Phase
              </CardTitle>
              <CardDescription>When employees can set and submit their goals</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="goal_submission_start">Submission Start</Label>
                  <Input
                    id="goal_submission_start"
                    name="goal_submission_start"
                    type="date"
                    value={formData.goal_submission_start}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="goal_submission_end">Submission End</Label>
                  <Input
                    id="goal_submission_end"
                    name="goal_submission_end"
                    type="date"
                    value={formData.goal_submission_end}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="goal_approval_end">Approval Deadline</Label>
                  <Input
                    id="goal_approval_end"
                    name="goal_approval_end"
                    type="date"
                    value={formData.goal_approval_end}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="space-y-0.5">
                  <Label htmlFor="allow_late_goal_submission">Allow Late Goal Submission</Label>
                  <p className="text-sm text-muted-foreground">
                    Employees can submit goals after the deadline while cycle is active
                  </p>
                </div>
                <Switch
                  id="allow_late_goal_submission"
                  checked={formData.allow_late_goal_submission}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, allow_late_goal_submission: checked }))}
                />
              </div>
            </CardContent>
          </Card>

          <div className="mt-6">
            <h2 className="text-lg font-semibold mb-2">Quarterly Reviews (Optional)</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Set up quarterly check-ins for progress tracking. The year-end rating will be auto-calculated as an average of Q1-Q4 ratings.
            </p>
            <QuarterSection quarter="q1" label="Q1" />
            <QuarterSection quarter="q2" label="Q2" />
            <QuarterSection quarter="q3" label="Q3" />
            <QuarterSection quarter="q4" label="Q4" />
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Year-End Manager Evaluation Phase
              </CardTitle>
              <CardDescription>
                When managers review combined Q1-Q4 performance and finalize ratings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Year-end rating is auto-calculated from quarterly reviews (Q1-Q4 average). Managers will review the combined performance and calibrate with HR.
                </AlertDescription>
              </Alert>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="manager_evaluation_start">Start Date</Label>
                  <Input
                    id="manager_evaluation_start"
                    name="manager_evaluation_start"
                    type="date"
                    value={formData.manager_evaluation_start}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manager_evaluation_end">End Date</Label>
                  <Input
                    id="manager_evaluation_end"
                    name="manager_evaluation_end"
                    type="date"
                    value={formData.manager_evaluation_end}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Calibration & Release
              </CardTitle>
              <CardDescription>HR calibration and final results release</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="calibration_start">Calibration Start</Label>
                  <Input
                    id="calibration_start"
                    name="calibration_start"
                    type="date"
                    value={formData.calibration_start}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="calibration_end">Calibration End</Label>
                  <Input
                    id="calibration_end"
                    name="calibration_end"
                    type="date"
                    value={formData.calibration_end}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="release_date">Results Release</Label>
                  <Input
                    id="release_date"
                    name="release_date"
                    type="date"
                    value={formData.release_date}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="mt-6 flex gap-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditMode ? 'Saving...' : 'Creating...'}
                </>
              ) : (
                isEditMode ? 'Save Changes' : 'Create Cycle'
              )}
            </Button>
            <Link to="/admin/cycles">
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
