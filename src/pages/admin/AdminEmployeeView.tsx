import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { employeeService, goalsService, evaluationService, settingsService } from '@/services';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveCycle } from '@/contexts/ActiveCycleContext';
import {
  Loader2,
  ArrowLeft,
  Edit,
  Save,
  X,
  Star,
  Eye,
  User,
  Target,
  FileText,
  ClipboardCheck,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { KPIEvidenceView } from '@/components/evaluation/KPIEvidenceView';
import { ManagerEvidenceView } from '@/components/evaluation/ManagerEvidenceView';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageLoader } from '@/loaders';
import type { Employee, Goal, KRA } from '@/types';

type ViewMode = 'view' | 'edit';

interface QuarterlyReviewData {
  kras: KRA[];
  kpis: Goal[];
  selfReview: any | null;
  goalSelfRatings: any[];
  managerReview: any | null;
  managerKpiFeedback: any[];
}

export default function AdminEmployeeView() {
  const { id: employeeId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, hasAnyRole } = useAuth();
  const { toast } = useToast();
  const { activeCycle } = useActiveCycle();

  const isAdmin = hasAnyRole(['hr_admin', 'system_admin']);

  // Quarter selection
  const selectedQuarter = useMemo(() => {
    const q = searchParams.get('quarter');
    return q ? parseInt(q) : 1;
  }, [searchParams]);

  const setSelectedQuarter = useCallback((quarter: number) => {
    setSearchParams({ quarter: quarter.toString() });
  }, [setSearchParams]);

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [reviewData, setReviewData] = useState<QuarterlyReviewData | null>(null);
  const [adminOverrideQuarters, setAdminOverrideQuarters] = useState<number[]>([]);
  
  // Edit modes
  const [goalsEditMode, setGoalsEditMode] = useState<ViewMode>('view');
  const [selfEvalEditMode, setSelfEvalEditMode] = useState<ViewMode>('view');
  const [managerEvalEditMode, setManagerEvalEditMode] = useState<ViewMode>('view');

  // Edit state
  const [editedGoals, setEditedGoals] = useState<Record<string, Partial<Goal>>>({});
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editedSelfReview, setEditedSelfReview] = useState<any>(null);
  const [editedManagerReview, setEditedManagerReview] = useState<any>(null);

  // Fetch employee data
  useEffect(() => {
    if (!employeeId) return;
    
    const fetchEmployee = async () => {
      try {
        const result = await employeeService.getById(employeeId);
        setEmployee(result.data);
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to load employee',
          variant: 'destructive',
        });
      }
    };

    fetchEmployee();
  }, [employeeId, toast]);

  // Fetch quarterly review data
  const fetchQuarterlyReview = useCallback(async () => {
    if (!employeeId || !activeCycle) return;

    setLoading(true);
    try {
      const [reviewResult, overrideQuartersResult] = await Promise.all([
        employeeService.admin.getQuarterlyReview(employeeId, activeCycle.id, selectedQuarter),
        employeeService.admin.getAdminOverrideQuarters(employeeId, activeCycle.id),
      ]);

      setReviewData(reviewResult.data);
      setAdminOverrideQuarters(overrideQuartersResult.data);
      
      // Initialize edit state
      setEditedGoals({});
      setEditedSelfReview(reviewResult.data.selfReview);
      setEditedManagerReview(reviewResult.data.managerReview);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load quarterly review',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [employeeId, activeCycle, selectedQuarter, toast]);

  useEffect(() => {
    fetchQuarterlyReview();
  }, [fetchQuarterlyReview]);

  // Save goals
  const handleSaveGoals = async () => {
    if (!employeeId || !activeCycle || !reviewData) return;

    setSaving(true);
    try {
      const promises = Object.entries(editedGoals).map(([goalId, updates]) =>
        employeeService.admin.overrideGoal(employeeId, goalId, {
          ...updates,
          quarter: selectedQuarter,
        })
      );

      await Promise.all(promises);
      
      toast({
        title: 'Success',
        description: 'Goals updated successfully',
      });
      
      setGoalsEditMode('view');
      setEditedGoals({});
      fetchQuarterlyReview();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save goals',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Approve KRA
  const handleApproveKRA = async (kraId: string) => {
    if (!employeeId || !activeCycle) return;

    setSaving(true);
    try {
      await goalsService.kras.approve(kraId);
      
      // Also approve all associated KPIs
      const kpisForKRA = reviewData?.kpis.filter(kpi => kpi.kra_id === kraId && kpi.status === 'submitted') || [];
      for (const kpi of kpisForKRA) {
        await goalsService.kpis.approve(kpi.id);
      }
      
      toast({
        title: 'Success',
        description: 'KRA and KPIs approved successfully',
      });
      
      fetchQuarterlyReview();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve KRA',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Approve KPI
  const handleApproveKPI = async (kpiId: string) => {
    if (!employeeId || !activeCycle) return;

    setSaving(true);
    try {
      await goalsService.kpis.approve(kpiId);
      
      toast({
        title: 'Success',
        description: 'KPI approved successfully',
      });
      
      fetchQuarterlyReview();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve KPI',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Save self review
  const handleSaveSelfReview = async () => {
    if (!employeeId || !activeCycle) return;

    setSaving(true);
    try {
      await employeeService.admin.overrideSelfReview(employeeId, {
        cycle_id: activeCycle.id,
        quarter: selectedQuarter,
        ...editedSelfReview,
      });

      toast({
        title: 'Success',
        description: 'Self evaluation updated successfully',
      });

      setSelfEvalEditMode('view');
      fetchQuarterlyReview();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save self evaluation',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Save manager review
  const handleSaveManagerReview = async () => {
    if (!employeeId || !activeCycle || !user) return;

    setSaving(true);
    try {
      await employeeService.admin.overrideManagerReview(employeeId, {
        cycle_id: activeCycle.id,
        quarter: selectedQuarter,
        reviewer_id: user.id,
        ...editedManagerReview,
      });

      toast({
        title: 'Success',
        description: 'Manager evaluation updated successfully',
      });

      setManagerEvalEditMode('view');
      fetchQuarterlyReview();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save manager evaluation',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Get employee initials
  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  if (loading && !reviewData) {
    return (
      <MainLayout>
        <PageLoader />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/employees')} aria-label="Back to employees">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">Employee Review</h1>
            {employee && (
              <p className="text-muted-foreground">
                {employee.full_name} ({employee.emp_code || employee.emp_id})
              </p>
            )}
          </div>
        </div>

        {/* Employee Profile Card */}
        {employee && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback>{getInitials(employee.full_name || '')}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <CardTitle>{employee.full_name}</CardTitle>
                  <CardDescription>
                    {employee.department} • {employee.grade} • {employee.location}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map((q) => (
                    <Button
                      key={q}
                      variant={selectedQuarter === q ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedQuarter(q)}
                      aria-label={`Select quarter ${q}`}
                    >
                      Q{q}
                      {adminOverrideQuarters.includes(q) && (
                        <Star className="h-3 w-3 ml-1 fill-yellow-400 text-yellow-400" aria-label="Modified by Admin/HR" />
                      )}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
          </Card>
        )}

        {/* Quarterly Review Content */}
        {reviewData && (
          <Tabs defaultValue="goals" className="space-y-4">
            <TabsList>
              <TabsTrigger value="goals">
                <Target className="h-4 w-4 mr-2" />
                Goals
              </TabsTrigger>
              <TabsTrigger value="self-eval">
                <FileText className="h-4 w-4 mr-2" />
                Self Evaluation
              </TabsTrigger>
              <TabsTrigger value="manager-eval">
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Manager Evaluation
              </TabsTrigger>
            </TabsList>

            {/* Goals Tab */}
            <TabsContent value="goals" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Goals - Q{selectedQuarter}</CardTitle>
                      <CardDescription>Key Result Areas and Key Performance Indicators</CardDescription>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2">
                        {goalsEditMode === 'view' ? (
                          <>
                            {/* <Button onClick={() => setGoalsEditMode('edit')} variant="outline" aria-label="Edit goals">
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </Button> */}
                            {/* <Button 
                              onClick={() => navigate(`/team/${employeeId}/evaluate?quarter=${selectedQuarter}`)} 
                              aria-label="Create manager evaluation"
                            >
                              <ClipboardCheck className="h-4 w-4 mr-2" />
                              Create Manager Evaluation
                            </Button> */}
                          </>
                        ) : (
                          <>
                            <Button onClick={handleSaveGoals} disabled={saving} aria-label="Save goals">
                              {saving ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4 mr-2" />
                              )}
                              Save
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setGoalsEditMode('view');
                                setEditedGoals({});
                              }}
                              aria-label="Cancel editing"
                            >
                              <X className="h-4 w-4 mr-2" />
                              Cancel
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {reviewData.kras.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No goals found for this quarter</p>
                  ) : (
                    reviewData.kras.map((kra) => {
                      const kpis = reviewData.kpis.filter((kpi) => kpi.kra_id === kra.id);
                      return (
                        <div key={kra.id} className="space-y-4">
                          <div className="flex items-start justify-between p-4 border rounded-lg">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">{kra.title}</h3>
                                <Badge variant={kra.status === 'approved' ? 'submitted' : kra.status === 'submitted' ? 'submitted' : 'outline'}>
                                  {kra.status}
                                </Badge>
                              </div>
                              {kra.description && (
                                <p className="text-sm text-muted-foreground mt-1">{kra.description}</p>
                              )}
                              <Badge variant="outline" className="mt-2">
                                Weight: {kra.weight}%
                              </Badge>
                            </div>
                            {isAdmin && goalsEditMode === 'view' && kra.status === 'submitted' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleApproveKRA(kra.id)}
                                disabled={saving}
                                aria-label={`Approve KRA ${kra.title}`}
                              >
                                {saving ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                )}
                                Approve
                              </Button>
                            )}
                          </div>
                          {kpis.length > 0 && (
                            <div className="ml-4 space-y-3">
                              {kpis.map((kpi) => {
                                const isEditing = editingGoalId === kpi.id;
                                const editedKpi = editedGoals[kpi.id] || kpi;
                                return (
                                  <div key={kpi.id} className="p-3 border rounded-lg bg-muted/50">
                                    {isEditing ? (
                                      <div className="space-y-3">
                                        <div className="space-y-2">
                                          <Label>Title</Label>
                                          <Input
                                            value={editedKpi.title || ''}
                                            onChange={(e) =>
                                              setEditedGoals((prev) => ({
                                                ...prev,
                                                [kpi.id]: { ...prev[kpi.id], title: e.target.value },
                                              }))
                                            }
                                            aria-label="KPI title"
                                          />
                                        </div>
                                        <div className="space-y-2">
                                          <Label>Description</Label>
                                          <Textarea
                                            value={editedKpi.description || ''}
                                            onChange={(e) =>
                                              setEditedGoals((prev) => ({
                                                ...prev,
                                                [kpi.id]: { ...prev[kpi.id], description: e.target.value },
                                              }))
                                            }
                                            rows={3}
                                            aria-label="KPI description"
                                          />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                          <div className="space-y-2">
                                            <Label>Target Value</Label>
                                            <Input
                                              value={editedKpi.target_value || ''}
                                              onChange={(e) =>
                                                setEditedGoals((prev) => ({
                                                  ...prev,
                                                  [kpi.id]: { ...prev[kpi.id], target_value: e.target.value },
                                                }))
                                              }
                                              aria-label="Target value"
                                            />
                                          </div>
                                          <div className="space-y-2">
                                            <Label>Weight (%)</Label>
                                            <Input
                                              type="number"
                                              min="0"
                                              max="100"
                                              value={editedKpi.weight || ''}
                                              onChange={(e) =>
                                                setEditedGoals((prev) => ({
                                                  ...prev,
                                                  [kpi.id]: { ...prev[kpi.id], weight: e.target.value ? parseFloat(e.target.value) : null },
                                                }))
                                              }
                                              aria-label="Weight"
                                            />
                                          </div>
                                        </div>
                                        <div className="flex gap-2">
                                          <Button
                                            size="sm"
                                            onClick={() => setEditingGoalId(null)}
                                            aria-label="Done editing"
                                          >
                                            Done
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2">
                                            <h4 className="font-medium">{editedKpi.title}</h4>
                                            <Badge variant={editedKpi.status === 'approved' ? 'submitted' : editedKpi.status === 'submitted' ? 'submitted' : 'outline'}>
                                              {editedKpi.status}
                                            </Badge>
                                          </div>
                                          {editedKpi.description && (
                                            <p className="text-sm text-muted-foreground mt-1">{editedKpi.description}</p>
                                          )}
                                          <div className="flex gap-4 mt-2 text-sm">
                                            <span>Target: {editedKpi.target_value || 'N/A'}</span>
                                            <span>Weight: {editedKpi.weight}%</span>
                                          </div>
                                        </div>
                                        <div className="flex gap-2">
                                          {goalsEditMode === 'edit' && isAdmin && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => {
                                                setEditingGoalId(kpi.id);
                                                setEditedGoals((prev) => ({
                                                  ...prev,
                                                  [kpi.id]: { ...prev[kpi.id], ...kpi },
                                                }));
                                              }}
                                              aria-label={`Edit KPI ${kpi.title}`}
                                            >
                                              <Edit className="h-4 w-4" />
                                            </Button>
                                          )}
                                          {isAdmin && goalsEditMode === 'view' && editedKpi.status === 'submitted' && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => handleApproveKPI(kpi.id)}
                                              disabled={saving}
                                              aria-label={`Approve KPI ${kpi.title}`}
                                            >
                                              {saving ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                              ) : (
                                                <CheckCircle2 className="h-4 w-4" />
                                              )}
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Self Evaluation Tab */}
            <TabsContent value="self-eval" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Self Evaluation - Q{selectedQuarter}</CardTitle>
                      <CardDescription>Employee's self-assessment</CardDescription>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2">
                        {selfEvalEditMode === 'view' ? (
                          <>
                            {/* <Button 
                              onClick={() => navigate(`/admin/employee/${employeeId}/evaluation?quarter=${selectedQuarter}`)} 
                              aria-label="Edit self evaluation in full page"
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Evaluation
                              <ExternalLink className="h-4 w-4 ml-2" />
                            </Button>
                            <Button 
                              variant="outline"
                              onClick={() => setSelfEvalEditMode('edit')} 
                              aria-label="Edit self evaluation inline"
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Inline
                            </Button> */}
                          </>
                        ) : (
                          <>
                            <Button onClick={handleSaveSelfReview} disabled={saving} aria-label="Save self evaluation">
                              {saving ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4 mr-2" />
                              )}
                              Save
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setSelfEvalEditMode('view');
                                setEditedSelfReview(reviewData.selfReview);
                              }}
                              aria-label="Cancel editing"
                            >
                              <X className="h-4 w-4 mr-2" />
                              Cancel
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!reviewData.selfReview ? (
                    <p className="text-muted-foreground text-center py-8">No self evaluation found for this quarter</p>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label>Overall Rating</Label>
                        {selfEvalEditMode === 'edit' ? (
                          <Input
                            type="number"
                            min="1"
                            max="5"
                            value={editedSelfReview?.overall_rating || ''}
                            onChange={(e) =>
                              setEditedSelfReview((prev: any) => ({
                                ...prev,
                                overall_rating: e.target.value ? parseInt(e.target.value) : null,
                              }))
                            }
                            aria-label="Overall rating"
                          />
                        ) : (
                          <p className="text-lg font-semibold">
                            {reviewData.selfReview.overall_rating || 'N/A'}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Overall Comments</Label>
                        {selfEvalEditMode === 'edit' ? (
                          <Textarea
                            value={editedSelfReview?.overall_comments || ''}
                            onChange={(e) =>
                              setEditedSelfReview((prev: any) => ({
                                ...prev,
                                overall_comments: e.target.value,
                              }))
                            }
                            rows={6}
                            aria-label="Overall comments"
                          />
                        ) : (
                          <p className="text-muted-foreground whitespace-pre-wrap">
                            {reviewData.selfReview.overall_comments || 'No comments'}
                          </p>
                        )}
                      </div>
                      {reviewData.goalSelfRatings.length > 0 && (
                        <div className="space-y-2">
                          <Label>Goal Ratings</Label>
                          <div className="space-y-2">
                            {reviewData.goalSelfRatings.map((rating) => {
                              const kpi = reviewData.kpis.find((k) => k.id === rating.goal_id);
                              return (
                                <div key={rating.goal_id} className="p-3 border rounded-lg">
                                  <p className="font-medium">{kpi?.title || 'Unknown Goal'}</p>
                                  <div className="flex gap-4 mt-2 text-sm">
                                    <span>Rating: {rating.self_rating || 'N/A'}</span>
                                    {rating.achieved_value && (
                                      <span>Achieved: {rating.achieved_value}</span>
                                    )}
                                  </div>
                                  {rating.achievement && (
                                    <p className="text-sm text-muted-foreground mt-2">{rating.achievement}</p>
                                  )}
                                  {rating.evidence && employeeId && (
                                    <div className="mt-3">
                                      <KPIEvidenceView
                                        evidence={rating.evidence}
                                        goalId={rating.goal_id}
                                        employeeId={employeeId}
                                        quarter={selectedQuarter}
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Manager Evaluation Tab */}
            <TabsContent value="manager-eval" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Manager Evaluation - Q{selectedQuarter}</CardTitle>
                      <CardDescription>Manager's assessment and feedback</CardDescription>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2">
                        {managerEvalEditMode === 'view' ? (
                          <>
                            {/* <Button 
                              onClick={() => navigate(`/team/${employeeId}/evaluate?quarter=${selectedQuarter}`)} 
                              variant="outline"
                              aria-label="Edit manager evaluation in full page"
                            >
                              <ClipboardCheck className="h-4 w-4 mr-2" />
                              Edit Evaluation
                              <ExternalLink className="h-4 w-4 ml-2" />
                            </Button>
                            <Button onClick={() => setManagerEvalEditMode('edit')} aria-label="Edit manager evaluation inline">
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Inline
                            </Button> */}
                          </>
                        ) : (
                          <>
                            <Button onClick={handleSaveManagerReview} disabled={saving} aria-label="Save manager evaluation">
                              {saving ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4 mr-2" />
                              )}
                              Save
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setManagerEvalEditMode('view');
                                setEditedManagerReview(reviewData.managerReview);
                              }}
                              aria-label="Cancel editing"
                            >
                              <X className="h-4 w-4 mr-2" />
                              Cancel
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!reviewData.managerReview ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">No manager evaluation found for this quarter</p>
                      {/* {isAdmin && managerEvalEditMode === 'view' && (
                        <div className="flex gap-2 justify-center">
                          <Button 
                            onClick={() => navigate(`/team/${employeeId}/evaluate?quarter=${selectedQuarter}`)} 
                            aria-label="Create manager evaluation"
                          >
                            <ClipboardCheck className="h-4 w-4 mr-2" />
                            Create Manager Evaluation
                            <ExternalLink className="h-4 w-4 ml-2" />
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => setManagerEvalEditMode('edit')} 
                            aria-label="Create manager evaluation inline"
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Create Inline
                          </Button>
                        </div>
                      )} */}
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label>Overall Rating</Label>
                        {managerEvalEditMode === 'edit' ? (
                          <Input
                            type="number"
                            step="0.01"
                            min="1"
                            max="5"
                            value={editedManagerReview?.calculated_overall_rating || ''}
                            onChange={(e) =>
                              setEditedManagerReview((prev: any) => ({
                                ...prev,
                                calculated_overall_rating: e.target.value ? parseFloat(e.target.value) : null,
                              }))
                            }
                            aria-label="Overall rating"
                          />
                        ) : (
                          <p className="text-lg font-semibold">
                            {reviewData.managerReview.calculated_overall_rating || 'N/A'}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Overall Comments</Label>
                        {managerEvalEditMode === 'edit' ? (
                          <Textarea
                            value={editedManagerReview?.overall_comments || ''}
                            onChange={(e) =>
                              setEditedManagerReview((prev: any) => ({
                                ...prev,
                                overall_comments: e.target.value,
                              }))
                            }
                            rows={6}
                            aria-label="Overall comments"
                          />
                        ) : (
                          <p className="text-muted-foreground whitespace-pre-wrap">
                            {reviewData.managerReview.overall_comments || 'No comments'}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Guidance</Label>
                        {managerEvalEditMode === 'edit' ? (
                          <Textarea
                            value={editedManagerReview?.guidance || ''}
                            onChange={(e) =>
                              setEditedManagerReview((prev: any) => ({
                                ...prev,
                                guidance: e.target.value,
                              }))
                            }
                            rows={4}
                            aria-label="Guidance"
                          />
                        ) : (
                          <p className="text-muted-foreground whitespace-pre-wrap">
                            {reviewData.managerReview.guidance || 'No guidance provided'}
                          </p>
                        )}
                      </div>
                      {reviewData.managerKpiFeedback.length > 0 && (
                        <div className="space-y-2">
                          <Label>KPI Feedback</Label>
                          <div className="space-y-2">
                            {reviewData.managerKpiFeedback.map((feedback) => {
                              const kpi = reviewData.kpis.find((k) => k.id === feedback.goal_id);
                              return (
                                <div key={feedback.goal_id} className="p-3 border rounded-lg">
                                  <p className="font-medium">{kpi?.title || 'Unknown Goal'}</p>
                                  <div className="flex gap-4 mt-2 text-sm">
                                    <span>Rating: {feedback.rating || 'N/A'}</span>
                                  </div>
                                  {feedback.comments && (
                                    <p className="text-sm text-muted-foreground mt-2">{feedback.comments}</p>
                                  )}
                                  {feedback.evidence && reviewData.managerReview?.id && (
                                    <div className="mt-3">
                                      <ManagerEvidenceView
                                        evidence={feedback.evidence}
                                        goalId={feedback.goal_id}
                                        managerReviewId={reviewData.managerReview.id}
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </MainLayout>
  );
}
