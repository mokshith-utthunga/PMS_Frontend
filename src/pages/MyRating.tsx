import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { employeeService, goalsService, evaluationService, settingsService, cycleService } from '@/services';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Loader2, 
  Star,
  CheckCircle,
  Target,
  TrendingUp,
  AlertCircle,
  MessageSquare,
  Calculator,
  CalendarDays,
  XCircle,
  CheckCircle2
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatRating } from '@/lib/ratingCalculations';
import { QuarterTabs } from '@/components/evaluation/QuarterTabs';
import type { Quarter } from '@/lib/evaluationPeriods';

interface GoalRating {
  id: string;
  title: string;
  weight: number;
  goal_type: string;
  self_rating: number | null;
  manager_rating: number | null;
  manager_comments: string | null;
}

interface RatingScaleDisplay {
  value: number;
  name: string;
  description: string | null;
  color: string | null;
}

type EvaluationState = 
  | 'no_self_eval'           // Employee hasn't submitted self-evaluation
  | 'manager_pending'         // Self-eval submitted, manager review pending
  | 'hr_pending'             // Manager submitted, HR approval pending
  | 'hr_approved'            // HR approved, employee can accept/reject
  | 'employee_accepted'      // Employee accepted rating
  | 'employee_rejected';     // Employee rejected rating

export default function MyRating() {
  const { user, hasAnyRole } = useAuth();
  const isHR = hasAnyRole(['hr_admin', 'hrbp', 'system_admin']);
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [activeCycle, setActiveCycle] = useState<any>(null);
  const [selectedQuarter, setSelectedQuarter] = useState<string>('1');
  
  // Evaluation data
  const [selfReview, setSelfReview] = useState<any>(null);
  const [managerReview, setManagerReview] = useState<any>(null);
  const [goalRatings, setGoalRatings] = useState<GoalRating[]>([]);
  const [ratingScales, setRatingScales] = useState<RatingScaleDisplay[]>([]);
  const [evaluationState, setEvaluationState] = useState<EvaluationState>('no_self_eval');
  
  // Rejection modal state
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [showRejectionConfirmation, setShowRejectionConfirmation] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Initialize quarter from URL or default to 1
  useEffect(() => {
    const quarterParam = searchParams.get('quarter');
    if (quarterParam && ['1', '2', '3', '4'].includes(quarterParam)) {
      setSelectedQuarter(quarterParam);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchData();
  }, [user, selectedQuarter]);

  const fetchData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Get current user's employee record
      const empResult = await employeeService.getMe();
      if (!empResult.data) {
        setLoading(false);
        return;
      }
      setEmployeeId(empResult.data.id);

      // Get rating scales
      const scalesResult = await settingsService.ratingScales.getDefault();
      const scales = (scalesResult.data || []).map((s: any) => ({
        value: s.rating ?? s.value,
        name: s.label ?? s.name,
        description: s.description || null,
        color: s.color || null,
      }));
      setRatingScales(scales.sort((a, b) => b.value - a.value));

      // Get active cycle
      const cycleResult = await cycleService.getActive();
      if (!cycleResult.data) {
        setLoading(false);
        return;
      }
      setActiveCycle(cycleResult.data);

      const quarter = parseInt(selectedQuarter);
      
      // Get self-review for selected quarter
      const selfReviewsResult = await evaluationService.selfReviews.get(
        empResult.data.id, 
        cycleResult.data.id, 
        quarter
      );
      const selfReviewData = selfReviewsResult.data?.find((r: any) => r.quarter === quarter);
      setSelfReview(selfReviewData || null);

      // Determine evaluation state
      if (!selfReviewData || selfReviewData.status !== 'submitted') {
        setEvaluationState('no_self_eval');
        setManagerReview(null);
        setGoalRatings([]);
        setLoading(false);
        return;
      }

      // Get manager review for selected quarter
      const mgrReviewsResult = await evaluationService.managerReviews.get(
        empResult.data.id, 
        cycleResult.data.id, 
        quarter
      );
      const mgrReviewData = mgrReviewsResult.data?.find((r: any) => r.quarter === quarter);
      setManagerReview(mgrReviewData || null);

      if (!mgrReviewData) {
        setEvaluationState('manager_pending');
        setGoalRatings([]);
        setLoading(false);
        return;
      }

      // Check HR approval status
      if (!mgrReviewData.hr_approved_at) {
        setEvaluationState('hr_pending');
      } else if (mgrReviewData.employee_acknowledged_at) {
        setEvaluationState('employee_accepted');
      } else if (mgrReviewData.employee_rejected_at) {
        setEvaluationState('employee_rejected');
      } else {
        setEvaluationState('hr_approved');
      }

      // Get goals and ratings
      const goalsResult = await goalsService.kpis.getByEmployee(
        empResult.data.id, 
        cycleResult.data.id, 
        'approved'
      );

      // Get self ratings
      let selfRatings: any[] = [];
      if (selfReviewData?.id) {
        const selfProgressResult = await evaluationService.goalSelfRatings.get(selfReviewData.id);
        selfRatings = selfProgressResult.data || [];
      }

      // Get manager KPI feedback (only if HR approved or employee can see)
      let mgrFeedback: any[] = [];
      if (mgrReviewData.hr_approved_at || mgrReviewData.status === 'submitted') {
        const mgrFeedbackResult = await evaluationService.kpiManagerFeedback.getByReview(mgrReviewData.id);
        mgrFeedback = mgrFeedbackResult.data || [];
      }

      const combinedGoals: GoalRating[] = (goalsResult.data || []).map((goal: any) => {
        const selfRating = selfRatings.find((r: any) => r.goal_id === goal.id);
        const mgrFeedbackItem = mgrFeedback.find((r: any) => r.goal_id === goal.id);

        return {
          ...goal,
          self_rating: selfRating?.self_rating || null,
          manager_rating: mgrReviewData.hr_approved_at ? (mgrFeedbackItem?.rating || null) : null,
          manager_comments: mgrReviewData.hr_approved_at ? (mgrFeedbackItem?.comments || null) : null
        };
      });

      setGoalRatings(combinedGoals);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load rating data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, selectedQuarter, toast]);

  const handleAcceptRating = useCallback(async () => {
    if (!managerReview) return;

    setSaving(true);
    try {
      await evaluationService.employeeRating.acceptRating(managerReview.id);
      toast({ title: 'Rating accepted successfully' });
      await fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to accept rating',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [managerReview, toast, fetchData]);

  const handleRejectRating = useCallback(async () => {
    if (!managerReview || !rejectionReason.trim() || !activeCycle) return;

    setSaving(true);
    try {
      await evaluationService.employeeRating.rejectRating(
        managerReview.id,
        rejectionReason.trim(),
        activeCycle.id,
        parseInt(selectedQuarter)
      );
      toast({ title: 'Rating rejection submitted' });
      setShowRejectionDialog(false);
      setRejectionReason('');
      await fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit rejection',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [managerReview, rejectionReason, activeCycle, selectedQuarter, toast, fetchData]);

  const handleQuarterChange = useCallback((quarter: string) => {
    setSelectedQuarter(quarter);
    setSearchParams({ quarter });
  }, [setSearchParams]);

  const getRatingLabel = useCallback((value: number | null) => {
    if (!value) return '-';
    const scale = ratingScales.find(s => s.value === value);
    return scale ? `${value} - ${scale.name}` : value.toString();
  }, [ratingScales]);

  const quarterlyEvaluations = useMemo(() => {
    // This would ideally come from API, but for now return empty
    return {};
  }, []);

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </MainLayout>
    );
  }

  if (!employeeId && !isHR) {
    return (
      <MainLayout>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Your employee profile is not set up. Please contact HR.
          </AlertDescription>
        </Alert>
      </MainLayout>
    );
  }

  if (!employeeId && isHR) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Rating</h1>
            <p className="text-muted-foreground">View your performance rating</p>
          </div>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              As an HR user, you can view employee ratings from the Reports page.
            </AlertDescription>
          </Alert>
        </div>
      </MainLayout>
    );
  }

  // Case 2: No self-evaluation submitted
  if (evaluationState === 'no_self_eval') {
    return (
      <MainLayout>
        <div className="space-y-6 max-w-4xl mx-auto">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Rating</h1>
            <p className="text-muted-foreground">View your performance rating</p>
          </div>
          
          {activeCycle && (
            <QuarterTabs
              selectedQuarter={selectedQuarter}
              onQuarterChange={handleQuarterChange}
              cycle={activeCycle}
              quarterlyEvaluations={quarterlyEvaluations}
            >
              <div></div>
            </QuarterTabs>
          )}

          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Star className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg">No rating available</h3>
              <p className="text-muted-foreground">
                Your performance rating has not been released yet.
              </p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  // Case 1: Manager review pending
  if (evaluationState === 'manager_pending') {
    return (
      <MainLayout>
        <div className="space-y-6 max-w-4xl mx-auto">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Rating</h1>
            <p className="text-muted-foreground">View your performance rating</p>
          </div>
          
          {activeCycle && (
            <QuarterTabs
              selectedQuarter={selectedQuarter}
              onQuarterChange={handleQuarterChange}
              cycle={activeCycle}
              quarterlyEvaluations={quarterlyEvaluations}
            >
              <div></div>
            </QuarterTabs>
          )}

          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              Manager review is under progress
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Your Self-Evaluation
              </CardTitle>
              <CardDescription>Q{selectedQuarter} Self-Review</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {goalRatings.map((goal) => (
                <div key={goal.id} className="p-4 rounded-lg border">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{goal.goal_type.toUpperCase()}</Badge>
                        <span className="text-sm text-muted-foreground">Weight: {goal.weight}%</span>
                      </div>
                      <h4 className="font-medium">{goal.title}</h4>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <div className="p-3 rounded bg-muted/30">
                      <div className="text-xs text-muted-foreground mb-1">Your Self Rating</div>
                      <div className="font-medium">{getRatingLabel(goal.self_rating)}</div>
                    </div>
                  </div>
                </div>
              ))}
              
              {selfReview?.overall_comments && (
                <div className="mt-4 p-4 rounded-lg bg-muted/20">
                  <div className="text-sm font-medium mb-2">Overall Comments</div>
                  <p className="text-sm text-muted-foreground">{selfReview.overall_comments}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  // Case: HR pending or HR approved or employee accepted/rejected
  return (
    <MainLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Rating</h1>
            <p className="text-muted-foreground">
              {managerReview?.released_at 
                ? `Released on ${new Date(managerReview.released_at).toLocaleDateString()}`
                : `Q${selectedQuarter} Performance Rating`}
            </p>
          </div>
          {evaluationState === 'employee_accepted' && (
            <Badge variant="outline" className="bg-green-50">
              <CheckCircle className="mr-1 h-3 w-3" />
              Accepted
            </Badge>
          )}
          {evaluationState === 'employee_rejected' && (
            <Badge variant="outline" className="bg-red-50">
              <XCircle className="mr-1 h-3 w-3" />
              Rejected
            </Badge>
          )}
        </div>

        {activeCycle && (
          <QuarterTabs
            selectedQuarter={selectedQuarter}
            onQuarterChange={handleQuarterChange}
            cycle={activeCycle}
            quarterlyEvaluations={quarterlyEvaluations}
          >
            <div></div>
          </QuarterTabs>
        )}

        {evaluationState === 'hr_pending' && (
          <Alert className="border-blue-200 bg-blue-50">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              Manager review submitted. HR review is under progress.
            </AlertDescription>
          </Alert>
        )}

        {evaluationState === 'hr_pending' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Your Self-Evaluation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {goalRatings.map((goal) => (
                <div key={goal.id} className="p-4 rounded-lg border">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{goal.goal_type.toUpperCase()}</Badge>
                        <span className="text-sm text-muted-foreground">Weight: {goal.weight}%</span>
                      </div>
                      <h4 className="font-medium">{goal.title}</h4>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <div className="p-3 rounded bg-muted/30">
                      <div className="text-xs text-muted-foreground mb-1">Your Self Rating</div>
                      <div className="font-medium">{getRatingLabel(goal.self_rating)}</div>
                    </div>
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
        )}

        {(evaluationState === 'hr_approved' || evaluationState === 'employee_accepted' || evaluationState === 'employee_rejected') && (
          <>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Overall Assessment
            </CardTitle>
          </CardHeader>
          <CardContent>
              <div className="text-center p-6 rounded-lg bg-primary/5 border-2 border-primary">
                  <div className="text-sm text-muted-foreground mb-2">Performance Rating</div>
                <div className="text-4xl font-bold text-primary mb-2">
                    {managerReview?.calculated_overall_rating 
                      ? formatRating(managerReview.calculated_overall_rating)
                      : '-'}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Goal Ratings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
                {goalRatings.map((goal) => (
              <div key={goal.id} className="p-4 rounded-lg border">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{goal.goal_type.toUpperCase()}</Badge>
                      <span className="text-sm text-muted-foreground">Weight: {goal.weight}%</span>
                    </div>
                    <h4 className="font-medium">{goal.title}</h4>
                  </div>
                </div>
                
                <div className="grid gap-4 sm:grid-cols-2 mt-4">
                  <div className="p-3 rounded bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Your Self Rating</div>
                    <div className="font-medium">{getRatingLabel(goal.self_rating)}</div>
                  </div>
                  <div className="p-3 rounded bg-primary/5">
                    <div className="text-xs text-muted-foreground mb-1">Manager Rating</div>
                    <div className="font-medium">{getRatingLabel(goal.manager_rating)}</div>
                  </div>
                </div>

                {goal.manager_comments && (
                  <div className="mt-3 p-3 rounded bg-muted/20">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      <MessageSquare className="h-3 w-3" />
                      Manager Feedback
                    </div>
                    <p className="text-sm">{goal.manager_comments}</p>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

            {managerReview?.overall_comments && (
          <Card>
            <CardHeader>
              <CardTitle>Overall Feedback</CardTitle>
            </CardHeader>
            <CardContent>
                  <p>{managerReview.overall_comments}</p>
            </CardContent>
          </Card>
        )}

            {managerReview?.guidance && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Development Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
                  <p>{managerReview.guidance}</p>
            </CardContent>
          </Card>
        )}

            {evaluationState === 'hr_approved' && (
          <Card>
            <CardHeader>
                  <CardTitle>Accept or Reject Your Rating</CardTitle>
              <CardDescription>
                    Please review your rating and either accept or reject it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                  <div className="flex gap-4">
              <Button 
                      onClick={handleAcceptRating} 
                      disabled={saving}
                      className="flex-1"
                      variant="default"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Accept
                    </Button>
                    <Button 
                      onClick={() => setShowRejectionConfirmation(true)} 
                      disabled={saving}
                      className="flex-1"
                      variant="destructive"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
              </Button>
                  </div>
            </CardContent>
          </Card>
              )}
          </>
        )}
      </div>

      {/* Rejection Confirmation Dialog */}
      <AlertDialog open={showRejectionConfirmation} onOpenChange={setShowRejectionConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Rating</AlertDialogTitle>
            <AlertDialogDescription>
              Please discuss with your manager once before rejecting your rating.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowRejectionConfirmation(false);
              setShowRejectionDialog(true);
            }}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rejection Reason Dialog */}
      <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Justify your review / reason</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting your rating.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Comment</Label>
              <Textarea
                placeholder="Enter your reason for rejecting the rating..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowRejectionDialog(false);
              setRejectionReason('');
            }}>
              Close
            </Button>
            <Button 
              onClick={handleRejectRating} 
              disabled={!rejectionReason.trim() || saving}
              variant="destructive"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
