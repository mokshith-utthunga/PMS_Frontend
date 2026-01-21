import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
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
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatRating } from '@/lib/ratingCalculations';
import type { YearEndEvaluationData } from '@/services/evaluation.service';

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

type YearEndEvaluationState = 
  | 'no_data'                 // No year-end evaluation data
  | 'manager_pending'         // Manager hasn't submitted year-end evaluation
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
  const [employee, setEmployee] = useState<any>(null);
  const [activeCycle, setActiveCycle] = useState<any>(null);
  const [selectedQuarter, setSelectedQuarter] = useState<string>('1');
  const [viewMode, setViewMode] = useState<'quarterly' | 'year-end'>('quarterly');
  
  // Evaluation data
  const [selfReview, setSelfReview] = useState<any>(null);
  const [managerReview, setManagerReview] = useState<any>(null);
  const [goalRatings, setGoalRatings] = useState<GoalRating[]>([]);
  const [ratingScales, setRatingScales] = useState<RatingScaleDisplay[]>([]);
  const [evaluationState, setEvaluationState] = useState<EvaluationState>('no_self_eval');
  
  // Year-end evaluation data
  const [yearEndEvaluation, setYearEndEvaluation] = useState<YearEndEvaluationData | null>(null);
  const [yearEndState, setYearEndState] = useState<YearEndEvaluationState>('no_data');
  
  // Rejection modal state
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [showRejectionConfirmation, setShowRejectionConfirmation] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isYearEndRejection, setIsYearEndRejection] = useState(false);

  // Initialize quarter from URL or default to 1
  useEffect(() => {
    const quarterParam = searchParams.get('quarter');
    if (quarterParam === 'year-end') {
      setViewMode('year-end');
    } else if (quarterParam && ['1', '2', '3', '4'].includes(quarterParam)) {
      setViewMode('quarterly');
      setSelectedQuarter(quarterParam);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchData();
  }, [user, selectedQuarter, viewMode]);

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
      setEmployee(empResult.data);

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

      // Fetch year-end evaluation data (always fetch for both modes)
      try {
        const yearEndResult = await evaluationService.yearEndEvaluation.get(
          empResult.data.id,
          cycleResult.data.id
        );
        setYearEndEvaluation(yearEndResult.data);
        
        // Determine year-end evaluation state
        if (!yearEndResult.data) {
          setYearEndState('no_data');
        } else if (yearEndResult.data.status === 'pending' || yearEndResult.data.status === 'in_progress') {
          setYearEndState('manager_pending');
        } else if (yearEndResult.data.status === 'submitted' && !yearEndResult.data.released_at) {
          setYearEndState('hr_pending');
        } else if (yearEndResult.data.acknowledged_at) {
          setYearEndState('employee_accepted');
        } else if (yearEndResult.data.acknowledgment_comments && yearEndResult.data.released_at) {
          setYearEndState('employee_rejected');
        } else if (yearEndResult.data.released_at) {
          setYearEndState('hr_approved');
        } else {
          setYearEndState('no_data');
        }
      } catch {
        setYearEndEvaluation(null);
        setYearEndState('no_data');
      }

      // If year-end mode, we're done after fetching year-end data
      if (viewMode === 'year-end') {
        setLoading(false);
        return;
      }

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
  }, [user, selectedQuarter, viewMode, toast]);

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
    if (!rejectionReason.trim() || !activeCycle) return;

    setSaving(true);
    try {
      if (isYearEndRejection && yearEndEvaluation?.id) {
        // Year-end rejection
        await evaluationService.yearEndEmployeeRating.rejectRating(
          yearEndEvaluation.id,
          rejectionReason.trim(),
          activeCycle.id
        );
        toast({ title: 'Year-end rating rejection submitted' });
      } else if (managerReview) {
        // Quarterly rejection
        await evaluationService.employeeRating.rejectRating(
          managerReview.id,
          rejectionReason.trim(),
          activeCycle.id,
          parseInt(selectedQuarter)
        );
        toast({ title: 'Rating rejection submitted' });
      }
      setShowRejectionDialog(false);
      setRejectionReason('');
      setIsYearEndRejection(false);
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
  }, [managerReview, yearEndEvaluation, rejectionReason, activeCycle, selectedQuarter, isYearEndRejection, toast, fetchData]);

  const handleAcceptYearEndRating = useCallback(async () => {
    if (!yearEndEvaluation?.id) return;

    setSaving(true);
    try {
      await evaluationService.yearEndEmployeeRating.acceptRating(yearEndEvaluation.id);
      toast({ title: 'Year-end rating accepted successfully' });
      await fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to accept year-end rating',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [yearEndEvaluation, toast, fetchData]);

  const handleQuarterChange = useCallback((quarter: string) => {
    setSelectedQuarter(quarter);
    setViewMode('quarterly');
    setSearchParams({ quarter });
  }, [setSearchParams]);

  const handleViewModeChange = useCallback((mode: 'quarterly' | 'year-end') => {
    setViewMode(mode);
    if (mode === 'year-end') {
      setSearchParams({ quarter: 'year-end' });
    } else {
      setSearchParams({ quarter: selectedQuarter });
    }
  }, [selectedQuarter, setSearchParams]);

  const getRatingLabel = useCallback((value: number | null) => {
    if (!value) return '-';
    const scale = ratingScales.find(s => s.value === value);
    return scale ? `${value} - ${scale.name}` : value.toString();
  }, [ratingScales]);

  // Unified tab value: 'q1', 'q2', 'q3', 'q4', or 'year-end'
  const activeTab = useMemo(() => {
    if (viewMode === 'year-end') return 'year-end';
    return `q${selectedQuarter}`;
  }, [viewMode, selectedQuarter]);

  const handleTabChange = useCallback((tab: string) => {
    if (tab === 'year-end') {
      handleViewModeChange('year-end');
    } else {
      // Extract quarter number from 'q1', 'q2', etc.
      const quarter = tab.replace('q', '');
      setSelectedQuarter(quarter);
      handleViewModeChange('quarterly');
    }
  }, [handleViewModeChange]);

  // Helper function to format join date
  const formatJoinDate = (date: string | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Render Year-End Evaluation Content
  const renderYearEndContent = () => {
    if (!yearEndEvaluation) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg">No year-end evaluation available</h3>
            <p className="text-muted-foreground text-center">
              Your year-end evaluation has not been completed yet.
            </p>
          </CardContent>
        </Card>
      );
    }

    // Manager pending
    if (yearEndState === 'manager_pending' || yearEndState === 'no_data') {
      return (
        <>
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              Year-end evaluation is pending. Your manager has not completed your year-end evaluation yet.
            </AlertDescription>
          </Alert>
          
          {/* Show quarterly ratings summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Quarterly Ratings Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Q1', rating: yearEndEvaluation.q1_rating },
                  { label: 'Q2', rating: yearEndEvaluation.q2_rating },
                  { label: 'Q3', rating: yearEndEvaluation.q3_rating },
                  { label: 'Q4', rating: yearEndEvaluation.q4_rating },
                ].map((q) => (
                  <div key={q.label} className="p-3 rounded-lg bg-muted/50 text-center">
                    <div className="text-xs text-muted-foreground mb-1">{q.label}</div>
                    <div className="font-semibold">
                      {q.rating !== null && q.rating !== undefined ? formatRating(q.rating) : '-'}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      );
    }

    // HR pending
    if (yearEndState === 'hr_pending') {
      return (
        <>
          <Alert className="border-blue-200 bg-blue-50">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              Manager has submitted your year-end evaluation. HR review is in progress.
            </AlertDescription>
          </Alert>

          {/* Show quarterly ratings summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Quarterly Ratings Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Q1', rating: yearEndEvaluation.q1_rating },
                  { label: 'Q2', rating: yearEndEvaluation.q2_rating },
                  { label: 'Q3', rating: yearEndEvaluation.q3_rating },
                  { label: 'Q4', rating: yearEndEvaluation.q4_rating },
                ].map((q) => (
                  <div key={q.label} className="p-3 rounded-lg bg-muted/50 text-center">
                    <div className="text-xs text-muted-foreground mb-1">{q.label}</div>
                    <div className="font-semibold">
                      {q.rating !== null && q.rating !== undefined ? formatRating(q.rating) : '-'}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      );
    }

    // HR approved or employee accepted/rejected - show full details
    return (
      <>
        {/* Employee Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Employee Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-muted-foreground">Joining Date</Label>
                <p className="font-medium mt-1">{formatJoinDate(employee?.date_of_joining)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Quarters Evaluated</Label>
                <p className="font-medium mt-1">{yearEndEvaluation.completed_quarters || 0} of 4 Quarters</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quarterly Ratings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Quarterly Manager Ratings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Q1', rating: yearEndEvaluation.q1_rating },
                { label: 'Q2', rating: yearEndEvaluation.q2_rating },
                { label: 'Q3', rating: yearEndEvaluation.q3_rating },
                { label: 'Q4', rating: yearEndEvaluation.q4_rating },
              ].map((q) => (
                <div key={q.label} className="p-4 rounded-lg bg-muted/50 text-center">
                  <div className="text-sm text-muted-foreground mb-1">{q.label}</div>
                  <div className="text-xl font-bold">
                    {q.rating !== null && q.rating !== undefined ? formatRating(q.rating) : '-'}
                  </div>
                </div>
              ))}
            </div>
            
            <Separator className="my-4" />
            
            {/* Overall Year-End Rating */}
            <div className="text-center p-6 rounded-lg bg-primary/5 border-2 border-primary">
              <div className="text-sm text-muted-foreground mb-2">Year-End Overall Rating</div>
              <div className="text-4xl font-bold text-primary mb-2">
                {yearEndEvaluation.overall_rating 
                  ? formatRating(yearEndEvaluation.overall_rating)
                  : yearEndEvaluation.calculated_overall_rating
                    ? formatRating(yearEndEvaluation.calculated_overall_rating)
                    : '-'}
              </div>
              {yearEndEvaluation.calculated_overall_rating && !yearEndEvaluation.overall_rating && (
                <div className="text-xs text-muted-foreground">
                  (Auto-calculated average of quarterly ratings)
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Manager's Overall Feedback */}
        {yearEndEvaluation.overall_comments && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Manager's Overall Feedback
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{yearEndEvaluation.overall_comments}</p>
            </CardContent>
          </Card>
        )}

        {/* Development Recommendations */}
        {yearEndEvaluation.development_recommendations && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Development Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{yearEndEvaluation.development_recommendations}</p>
            </CardContent>
          </Card>
        )}

        {/* Accept/Reject Actions */}
        {yearEndState === 'hr_approved' && (
          <Card>
            <CardHeader>
              <CardTitle>Accept or Reject Your Year-End Rating</CardTitle>
              <CardDescription>
                Please review your year-end rating and either accept or reject it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Button 
                  onClick={handleAcceptYearEndRating} 
                  disabled={saving}
                  className="flex-1"
                  variant="default"
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Accept
                </Button>
                <Button 
                  onClick={() => {
                    setIsYearEndRejection(true);
                    setShowRejectionConfirmation(true);
                  }} 
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
    );
  };

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

  // Create single unified tab layout
  const renderTabs = (quarterContent: React.ReactNode) => (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
      <TabsList className="grid w-full grid-cols-5">
        {[1, 2, 3, 4].map(quarter => (
          <TabsTrigger key={quarter} value={`q${quarter}`}>
            Q{quarter}
          </TabsTrigger>
        ))}
        <TabsTrigger value="year-end" className="flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          Year-End
        </TabsTrigger>
      </TabsList>
      
      {[1, 2, 3, 4].map(quarter => (
        <TabsContent key={quarter} value={`q${quarter}`} className="space-y-4">
          {quarterContent}
        </TabsContent>
      ))}
      
      <TabsContent value="year-end" className="space-y-4">
        {renderYearEndContent()}
      </TabsContent>
    </Tabs>
  );

  // Case 2: No self-evaluation submitted for quarterly (or year-end mode)
  if (viewMode === 'year-end' || evaluationState === 'no_self_eval') {
    return (
      <MainLayout>
        <div className="space-y-6 max-w-4xl mx-auto">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Rating</h1>
            <p className="text-muted-foreground">View your performance rating</p>
          </div>
          
          {activeCycle && renderTabs(
            viewMode === 'year-end' ? null : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Star className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg">No rating available</h3>
                  <p className="text-muted-foreground">
                    Your performance rating has not been released yet.
                  </p>
                </CardContent>
              </Card>
            )
          )}
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
          
          {activeCycle && renderTabs(
            <>
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
            </>
          )}
        </div>
      </MainLayout>
    );
  }

  // Render quarterly content for HR pending / approved / accepted / rejected cases
  const renderQuarterlyContent = () => (
    <>
      {evaluationState === 'hr_pending' && (
        <>
          <Alert className="border-blue-200 bg-blue-50">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              Manager review submitted. HR review is under progress.
            </AlertDescription>
          </Alert>

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
        </>
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
                    onClick={() => {
                      setIsYearEndRejection(false);
                      setShowRejectionConfirmation(true);
                    }} 
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
    </>
  );

  // Case: HR pending or HR approved or employee accepted/rejected
  return (
    <MainLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Rating</h1>
            <p className="text-muted-foreground">
              {viewMode === 'year-end' 
                ? 'Year-End Performance Rating'
                : managerReview?.released_at 
                  ? `Released on ${new Date(managerReview.released_at).toLocaleDateString()}`
                  : `Q${selectedQuarter} Performance Rating`}
            </p>
          </div>
          {viewMode === 'quarterly' && evaluationState === 'employee_accepted' && (
            <Badge variant="outline" className="bg-green-50">
              <CheckCircle className="mr-1 h-3 w-3" />
              Accepted
            </Badge>
          )}
          {viewMode === 'quarterly' && evaluationState === 'employee_rejected' && (
            <Badge variant="outline" className="bg-red-50">
              <XCircle className="mr-1 h-3 w-3" />
              Rejected
            </Badge>
          )}
          {viewMode === 'year-end' && yearEndState === 'employee_accepted' && (
            <Badge variant="outline" className="bg-green-50">
              <CheckCircle className="mr-1 h-3 w-3" />
              Accepted
            </Badge>
          )}
          {viewMode === 'year-end' && yearEndState === 'employee_rejected' && (
            <Badge variant="outline" className="bg-red-50">
              <XCircle className="mr-1 h-3 w-3" />
              Rejected
            </Badge>
          )}
        </div>

        {activeCycle && renderTabs(renderQuarterlyContent())}
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
              Please provide a reason for rejecting your {isYearEndRejection ? 'year-end' : 'quarterly'} rating.
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
              setIsYearEndRejection(false);
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
