import { useState, useEffect, useCallback } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { evaluationService, cycleService, goalsService, employeeService } from '@/services';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  CalendarDays,
  MessageSquare,
  Target,
  Calculator,
  TrendingUp,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatRating } from '@/lib/ratingCalculations';

interface PendingReview {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  manager_name: string;
  manager_code: string;
  cycle_id: string;
  cycle_name: string;
  quarter: number;
  calculated_overall_rating: number | null;
  overall_comments: string | null;
  guidance: string | null;
  created_at: string;
}

interface RatingRejection {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  cycle_id: string;
  cycle_name: string;
  quarter: number;
  rejection_reason: string;
  status: string;
  manager_review_id: string;
  calculated_overall_rating: number | null;
  manager_comments: string | null;
  created_at: string;
}

export default function HRReview() {
  const { hasAnyRole } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [activeCycle, setActiveCycle] = useState<any>(null);
  
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
  const [ratingRejections, setRatingRejections] = useState<RatingRejection[]>([]);
  
  const [selectedReview, setSelectedReview] = useState<PendingReview | null>(null);
  const [selectedRejection, setSelectedRejection] = useState<RatingRejection | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Review detail data
  const [reviewDetails, setReviewDetails] = useState<any>(null);
  const [selfReview, setSelfReview] = useState<any>(null);
  const [goalRatings, setGoalRatings] = useState<any[]>([]);
  
  // Rejection detail data
  const [rejectionSelfReview, setRejectionSelfReview] = useState<any>(null);
  const [rejectionGoalRatings, setRejectionGoalRatings] = useState<any[]>([]);

  const isHR = hasAnyRole(['hr_admin', 'hrbp', 'system_admin']);
  const isBUHead = hasAnyRole(['dept_head']);

  useEffect(() => {
    if (!isHR && !isBUHead) {
      setLoading(false);
      return;
    }
    fetchData();
  }, [isHR, isBUHead]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      const cycleResult = await cycleService.getActive();
      if (cycleResult.data) {
        setActiveCycle(cycleResult.data);
        
        // Fetch pending reviews
        const reviewsResult = await evaluationService.hrReview.getPendingReviews(cycleResult.data.id);
        setPendingReviews(reviewsResult.data || []);
        
        // Fetch rating rejections
        const rejectionsResult = await evaluationService.ratingRejections.get(cycleResult.data.id);
        setRatingRejections(rejectionsResult.data || []);
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load review data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchReviewDetails = useCallback(async (review: PendingReview) => {
    try {
      // Get self-review
      const selfReviewResult = await evaluationService.selfReviews.get(
        review.employee_id,
        review.cycle_id,
        review.quarter
      );
      const selfReviewData = selfReviewResult.data?.find((r: any) => r.quarter === review.quarter);
      setSelfReview(selfReviewData || null);

      // Get goals and ratings
      const goalsResult = await goalsService.kpis.getByEmployee(
        review.employee_id,
        review.cycle_id,
        'approved'
      );

      // Get self ratings
      let selfRatings: any[] = [];
      if (selfReviewData?.id) {
        const selfProgressResult = await evaluationService.goalSelfRatings.get(selfReviewData.id);
        selfRatings = selfProgressResult.data || [];
      }

      // Get manager KPI feedback
      const mgrFeedbackResult = await evaluationService.kpiManagerFeedback.getByReview(review.id);
      const mgrFeedback = mgrFeedbackResult.data || [];

      const combinedGoals = (goalsResult.data || []).map((goal: any) => {
        const selfRating = selfRatings.find((r: any) => r.goal_id === goal.id);
        const mgrFeedbackItem = mgrFeedback.find((r: any) => r.goal_id === goal.id);

        return {
          ...goal,
          self_rating: selfRating?.self_rating || null,
          manager_rating: mgrFeedbackItem?.rating || null,
          manager_comments: mgrFeedbackItem?.comments || null,
          self_achievement: selfRating?.achievement || null,
          self_evidence: selfRating?.evidence || null,
        };
      });

      setGoalRatings(combinedGoals);
      setReviewDetails(review);
    } catch (error: any) {
      console.error('Error fetching review details:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load review details',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const handleApproveReview = useCallback(async (reviewId: string) => {
    setSaving(reviewId);
    try {
      await evaluationService.hrReview.approveReview(reviewId);
      toast({ title: 'Review approved and released to employee' });
      setShowApproveDialog(false);
      setShowReviewDialog(false);
      await fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve review',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  }, [toast, fetchData]);

  const handleRejectReview = useCallback(async () => {
    // Use reviewDetails if selectedReview is not set (when coming from review details dialog)
    const reviewToReject = selectedReview || reviewDetails;
    
    if (!reviewToReject || !rejectionReason.trim()) {
      toast({
        title: 'Error',
        description: 'Please select a review and provide a rejection reason',
        variant: 'destructive',
      });
      return;
    }

    if (!reviewToReject.id) {
      toast({
        title: 'Error',
        description: 'Invalid review ID',
        variant: 'destructive',
      });
      return;
    }

    setSaving(reviewToReject.id);
    try {
      await evaluationService.hrReview.rejectReview(reviewToReject.id, rejectionReason.trim());
      toast({ title: 'Review rejected and sent back to manager' });
      setShowReviewDialog(false);
      setShowRejectDialog(false);
      setRejectionReason('');
      setSelectedReview(null);
      setReviewDetails(null);
      await fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject review',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  }, [selectedReview, reviewDetails, rejectionReason, toast, fetchData]);


  const openReviewDialog = useCallback(async (review: PendingReview) => {
    setSelectedReview(review);
    setShowReviewDialog(true);
    await fetchReviewDetails(review);
  }, [fetchReviewDetails]);

  const fetchRejectionDetails = useCallback(async (rejection: RatingRejection) => {
    try {
      // Get self-review
      const selfReviewResult = await evaluationService.selfReviews.get(
        rejection.employee_id,
        rejection.cycle_id,
        rejection.quarter
      );
      const selfReviewData = selfReviewResult.data?.find((r: any) => r.quarter === rejection.quarter);
      setRejectionSelfReview(selfReviewData || null);

      // Get goals and ratings
      const goalsResult = await goalsService.kpis.getByEmployee(
        rejection.employee_id,
        rejection.cycle_id,
        'approved'
      );

      // Get self ratings
      let selfRatings: any[] = [];
      if (selfReviewData?.id) {
        const selfProgressResult = await evaluationService.goalSelfRatings.get(selfReviewData.id);
        selfRatings = selfProgressResult.data || [];
      }

      // Get manager KPI feedback
      const mgrFeedbackResult = await evaluationService.kpiManagerFeedback.getByReview(rejection.manager_review_id);
      const mgrFeedback = mgrFeedbackResult.data || [];

      const combinedGoals = (goalsResult.data || []).map((goal: any) => {
        const selfRating = selfRatings.find((r: any) => r.goal_id === goal.id);
        const mgrFeedbackItem = mgrFeedback.find((r: any) => r.goal_id === goal.id);

        return {
          ...goal,
          self_rating: selfRating?.self_rating || null,
          manager_rating: mgrFeedbackItem?.rating || null,
          manager_comments: mgrFeedbackItem?.comments || null,
          self_achievement: selfRating?.achievement || null,
          self_evidence: selfRating?.evidence || null,
        };
      });

      setRejectionGoalRatings(combinedGoals);
    } catch (error: any) {
      console.error('Error fetching rejection details:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load rejection details',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const openRejectionDialog = useCallback(async (rejection: RatingRejection) => {
    setSelectedRejection(rejection);
    setShowRejectionDialog(true);
    await fetchRejectionDetails(rejection);
  }, [fetchRejectionDetails]);

  if (!isHR && !isBUHead) {
    return (
      <MainLayout>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You do not have permission to access this page.
          </AlertDescription>
        </Alert>
      </MainLayout>
    );
  }

  if (loading) {
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
        <div>
          <h1 className="text-3xl font-bold tracking-tight">HR Review</h1>
          <p className="text-muted-foreground">
            Review and approve manager evaluations, manage rating rejections
          </p>
        </div>

        <Tabs defaultValue="reviews" className="space-y-4">
          <TabsList>
            <TabsTrigger value="reviews">
              Review ({pendingReviews.length})
            </TabsTrigger>
            <TabsTrigger value="rejections">
              Rating Rejection ({ratingRejections.filter(r => r.status === 'pending').length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reviews" className="space-y-4">
            {pendingReviews.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg">No pending reviews</h3>
                  <p className="text-muted-foreground">
                    All manager evaluations have been reviewed.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {pendingReviews.map((review) => (
                  <Card key={review.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" />
                            {review.employee_name}
                            <Badge variant="outline">{review.employee_code}</Badge>
                          </CardTitle>
                          <CardDescription className="mt-2">
                            <div className="flex items-center gap-4">
                              <span>Q{review.quarter} • {review.cycle_name}</span>
                              <span>Manager: {review.manager_name}</span>
                            </div>
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">
                            {review.calculated_overall_rating 
                              ? formatRating(review.calculated_overall_rating)
                              : '-'}
                          </div>
                          <div className="text-xs text-muted-foreground">Overall Rating</div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => openReviewDialog(review)}
                          variant="outline"
                          className="flex-1"
                        >
                          View Details
                        </Button>
                        <Button
                          onClick={() => {
                            setSelectedReview(review);
                            setShowApproveDialog(true);
                          }}
                          disabled={saving === review.id}
                        >
                          {saving === review.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Approve
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="rejections" className="space-y-4">
            {ratingRejections.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg">No rating rejections</h3>
                  <p className="text-muted-foreground">
                    No employee rating rejections to review.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {ratingRejections.map((rejection) => (
                  <Card 
                    key={rejection.id} 
                    className={`hover:shadow-md transition-shadow ${
                      rejection.status === 'pending' ? 'border-yellow-200' : ''
                    }`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" />
                            {rejection.employee_name}
                            <Badge variant="outline">{rejection.employee_code}</Badge>
                            {rejection.status === 'pending' && (
                              <Badge variant="destructive">Pending</Badge>
                            )}
                            {rejection.status === 'resolved' && (
                              <Badge variant="outline" className="bg-green-50">Resolved</Badge>
                            )}
                            {rejection.status === 'dismissed' && (
                              <Badge variant="outline" className="bg-gray-50">Dismissed</Badge>
                            )}
                          </CardTitle>
                          <CardDescription className="mt-2">
                            Q{rejection.quarter} • {rejection.cycle_name}
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">
                            {rejection.calculated_overall_rating 
                              ? formatRating(rejection.calculated_overall_rating)
                              : '-'}
                          </div>
                          <div className="text-xs text-muted-foreground">Rating</div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <Label className="text-sm font-medium">Rejection Reason</Label>
                          <p className="text-sm text-muted-foreground mt-1 bg-muted/50 p-3 rounded">
                            {rejection.rejection_reason}
                          </p>
                        </div>
                        {rejection.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button
                              onClick={() => openRejectionDialog(rejection)}
                              variant="outline"
                              className="flex-1"
                            >
                              View Details
                            </Button>
                            <Button
                              onClick={() => {
                                setShowRejectionDialog(false);
                                setSelectedRejection(null);
                              }}
                              variant="outline"
                            >
                              Dismiss
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Review Details Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Details</DialogTitle>
            <DialogDescription>
              {selectedReview && (
                <>
                  {selectedReview.employee_name} • Q{selectedReview.quarter} • {selectedReview.cycle_name}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {reviewDetails && (
            <div className="space-y-6">
              {/* Overall Rating */}
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
                      {reviewDetails.calculated_overall_rating 
                        ? formatRating(reviewDetails.calculated_overall_rating)
                        : '-'}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Self Evaluation */}
              {selfReview && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Employee Self-Evaluation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selfReview.overall_comments && (
                      <div className="mb-4">
                        <Label className="text-sm font-medium">Overall Comments</Label>
                        <p className="text-sm text-muted-foreground mt-1 bg-muted/50 p-3 rounded">
                          {selfReview.overall_comments}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Goal Ratings */}
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
                          <div className="text-xs text-muted-foreground mb-1">Employee Self Rating</div>
                          <div className="font-medium">{goal.self_rating || '-'}</div>
                          {goal.self_achievement && (
                            <div className="text-xs text-muted-foreground mt-2">
                              {goal.self_achievement}
                            </div>
                          )}
                        </div>
                        <div className="p-3 rounded bg-primary/5">
                          <div className="text-xs text-muted-foreground mb-1">Manager Rating</div>
                          <div className="font-medium">{goal.manager_rating || '-'}</div>
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

              {/* Manager Comments */}
              {reviewDetails.overall_comments && (
                <Card>
                  <CardHeader>
                    <CardTitle>Overall Feedback</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>{reviewDetails.overall_comments}</p>
                  </CardContent>
                </Card>
              )}

              {/* Development Recommendations */}
              {reviewDetails.guidance && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Development Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>{reviewDetails.guidance}</p>
                  </CardContent>
                </Card>
              )}

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (reviewDetails) {
                      setSelectedReview(reviewDetails);
                    }
                    setShowReviewDialog(false);
                    setShowRejectDialog(true);
                  }}
                >
                  Reject
                </Button>
                <Button
                  onClick={() => {
                    if (reviewDetails) {
                      setSelectedReview(reviewDetails);
                    }
                    setShowReviewDialog(false);
                    setShowApproveDialog(true);
                  }}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve Confirmation Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Review</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve this review? Once approved, the ratings will be released to the employee.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedReview && handleApproveReview(selectedReview.id)}
            >
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rejection Reason Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Review</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this review. It will be sent back to the manager.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Rejection Reason</Label>
              <Textarea
                placeholder="Enter reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowRejectDialog(false);
              setRejectionReason('');
            }}>
              Cancel
            </Button>
            <Button onClick={async () => {
              await handleRejectReview();
              setShowRejectDialog(false);
            }} disabled={!rejectionReason.trim() || saving !== null}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Details Dialog */}
      <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rating Rejection Details</DialogTitle>
            <DialogDescription>
              {selectedRejection && (
                <>
                  {selectedRejection.employee_name} • Q{selectedRejection.quarter} • {selectedRejection.cycle_name}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedRejection && (
            <div className="space-y-6">
              {/* Rejection Reason */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Rejection Reason
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                    {selectedRejection.rejection_reason}
                  </p>
                </CardContent>
              </Card>

              {/* Overall Rating */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Overall Assessment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center p-6 rounded-lg bg-primary/5 border-2 border-primary">
                    <div className="text-sm text-muted-foreground mb-2">Manager Rating</div>
                    <div className="text-4xl font-bold text-primary mb-2">
                      {selectedRejection.calculated_overall_rating 
                        ? formatRating(selectedRejection.calculated_overall_rating)
                        : '-'}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Employee Self-Evaluation */}
              {rejectionSelfReview && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Employee Self-Evaluation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {rejectionSelfReview.overall_comments && (
                      <div className="mb-4">
                        <Label className="text-sm font-medium">Overall Comments</Label>
                        <p className="text-sm text-muted-foreground mt-1 bg-muted/50 p-3 rounded">
                          {rejectionSelfReview.overall_comments}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Goal Ratings */}
              {rejectionGoalRatings.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Goal Ratings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {rejectionGoalRatings.map((goal) => (
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
                            <div className="text-xs text-muted-foreground mb-1">Employee Self Rating</div>
                            <div className="font-medium">{goal.self_rating || '-'}</div>
                            {goal.self_achievement && (
                              <div className="text-xs text-muted-foreground mt-2">
                                {goal.self_achievement}
                              </div>
                            )}
                          </div>
                          <div className="p-3 rounded bg-primary/5">
                            <div className="text-xs text-muted-foreground mb-1">Manager Rating</div>
                            <div className="font-medium">{goal.manager_rating || '-'}</div>
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
              )}

              {/* Manager Comments */}
              {selectedRejection.manager_comments && (
                <Card>
                  <CardHeader>
                    <CardTitle>Overall Feedback</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>{selectedRejection.manager_comments}</p>
                  </CardContent>
                </Card>
              )}

              {selectedRejection.status === 'pending' && (
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowRejectionDialog(false);
                      setSelectedRejection(null);
                      setRejectionSelfReview(null);
                      setRejectionGoalRatings([]);
                    }}
                  >
                    Dismiss
                  </Button>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
