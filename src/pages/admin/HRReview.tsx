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
import { evaluationService, goalsService, employeeService, settingsService } from '@/services';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveCycle } from '@/contexts/ActiveCycleContext';
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
  Calendar,
  Clock,
  ChevronDown,
  ChevronRight,
  Send,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { formatRating } from '@/lib/ratingCalculations';
import { KPIEvidenceView } from '@/components/evaluation/KPIEvidenceView';
import { ManagerEvidenceView } from '@/components/evaluation/ManagerEvidenceView';

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
  display_rating: number | null; // For transition employees, this is the average of pre + post
  period_type: string | null;
  transition_id: string | null;
  overall_comments: string | null;
  guidance: string | null;
  created_at: string;
}

interface PendingYearEndReview {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  manager_name: string;
  manager_code: string;
  cycle_id: string;
  cycle_name: string;
  date_of_joining: string;
  department: string;
  q1_rating: number | null;
  q2_rating: number | null;
  q3_rating: number | null;
  q4_rating: number | null;
  calculated_overall_rating: number | null;
  overall_rating: number | null;
  overall_comments: string | null;
  development_recommendations: string | null;
  potential_rating: number | null;
  completed_quarters: number;
  submitted_at: string;
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
  
  // Get active cycle and quarterly cycles from context (fetched once at app initialization)
  const { activeCycle: activeCycleFromContext, quarterlyCycles } = useActiveCycle();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [activeCycle, setActiveCycle] = useState<any>(activeCycleFromContext);
  
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
  const [pendingYearEndReviews, setPendingYearEndReviews] = useState<PendingYearEndReview[]>([]);
  const [ratingRejections, setRatingRejections] = useState<RatingRejection[]>([]);
  
  const [selectedReview, setSelectedReview] = useState<PendingReview | null>(null);
  const [selectedYearEndReview, setSelectedYearEndReview] = useState<PendingYearEndReview | null>(null);
  const [selectedRejection, setSelectedRejection] = useState<RatingRejection | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [showYearEndReviewDialog, setShowYearEndReviewDialog] = useState(false);
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showYearEndApproveDialog, setShowYearEndApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showYearEndRejectDialog, setShowYearEndRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Review detail data
  const [reviewDetails, setReviewDetails] = useState<any>(null);
  const [selfReview, setSelfReview] = useState<any>(null);
  const [goalRatings, setGoalRatings] = useState<any[]>([]);
  const [kraRatings, setKraRatings] = useState<any[]>([]); // Store KRAs with their KPIs
  
  // Rejection detail data
  const [rejectionSelfReview, setRejectionSelfReview] = useState<any>(null);
  const [rejectionGoalRatings, setRejectionGoalRatings] = useState<any[]>([]);
  const [rejectionKraRatings, setRejectionKraRatings] = useState<any[]>([]);

  // Normalized ratings state
  const [normalizedRatings, setNormalizedRatings] = useState<any[]>([]);
  const [normalizedRatingsLoading, setNormalizedRatingsLoading] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState<number>(1);
  const [normalizing, setNormalizing] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [editingRating, setEditingRating] = useState<string | null>(null);
  const [editedRatingValue, setEditedRatingValue] = useState<number>(0);
  const [editedCalibratedRatingValue, setEditedCalibratedRatingValue] = useState<number | null>(null);
  const [expandedRatings, setExpandedRatings] = useState<Set<string>>(new Set());

  const isHR = hasAnyRole(['hr_admin', 'hrbp', 'system_admin']);
  const isBUHead = hasAnyRole(['dept_head']);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Use active cycle from context (already fetched at app initialization)
      const currentActiveCycle = activeCycleFromContext || activeCycle;
      if (!currentActiveCycle) {
        setLoading(false);
        return;
      }
      setActiveCycle(currentActiveCycle);
      
      // Fetch pending quarterly reviews
      const reviewsResult = await evaluationService.hrReview.getPendingReviews(currentActiveCycle.id);
      setPendingReviews(reviewsResult.data || []);
      
      // Fetch pending year-end reviews
      const yearEndReviewsResult = await evaluationService.yearEndHRReview.getPendingReviews(currentActiveCycle.id);
      setPendingYearEndReviews(yearEndReviewsResult.data || []);
      
      // Fetch rating rejections
      const rejectionsResult = await evaluationService.ratingRejections.get(currentActiveCycle.id);
      setRatingRejections(rejectionsResult.data || []);
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
  }, [toast, activeCycleFromContext, activeCycle]);

  useEffect(() => {
    if (!isHR && !isBUHead) {
      setLoading(false);
      return;
    }
    fetchData();
  }, [isHR, isBUHead, activeCycleFromContext, activeCycle, fetchData]);

  // Update activeCycle when context data changes
  useEffect(() => {
    if (activeCycleFromContext) {
      setActiveCycle(activeCycleFromContext);
    }
  }, [activeCycleFromContext]);

  const fetchNormalizedRatings = useCallback(async (quarter?: number, status?: string) => {
    if (!activeCycle) {
      console.log('No active cycle, skipping fetchNormalizedRatings');
      return;
    }
    
    try {
      setNormalizedRatingsLoading(true);
      const quarterToFetch = quarter || selectedQuarter;
      console.log(`Fetching normalized ratings for Q${quarterToFetch}, cycle: ${activeCycle.id}, status: ${status || 'all'}`);
      
      const result = await evaluationService.normalization.getRatings(
        quarterToFetch,
        activeCycle.id,
        status
      );
      
      console.log('Fetched normalized ratings:', result.data);
      setNormalizedRatings(result.data || []);
    } catch (error: any) {
      console.error('Error fetching normalized ratings:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load normalized ratings',
        variant: 'destructive',
      });
    } finally {
      setNormalizedRatingsLoading(false);
    }
  }, [activeCycle, selectedQuarter, toast]);

  const handleNormalize = useCallback(async (quarter: number) => {
    if (!activeCycle) {
      toast({
        title: 'Error',
        description: 'No active cycle found',
        variant: 'destructive',
      });
      return;
    }
    
    setNormalizing(true);
    try {
      console.log(`Normalizing ratings for Q${quarter}, cycle: ${activeCycle.id}`);
      const result = await evaluationService.normalization.normalize(quarter, activeCycle.id);
      console.log('Normalization result:', result);
      
      toast({
        title: 'Normalization Complete',
        description: result.data?.message || `Normalized ${result.data?.processed || 0} ratings for Q${quarter}.`,
      });
      
      // Check if calibration is enabled before auto-running
      try {
        const calibrationSettings = await settingsService.calibration.get();
        const isCalibrationEnabled = calibrationSettings.data?.is_enabled ?? true; // Default to true for backward compatibility
        
        if (isCalibrationEnabled) {
          // Automatically run calibration after normalization
          console.log(`Calibrating ratings for Q${quarter}, cycle: ${activeCycle.id}`);
          const calibrationResult = await evaluationService.normalization.calibrate(quarter, activeCycle.id);
          console.log('Calibration result:', calibrationResult);
          
          // Check if calibration was actually disabled (returned from backend)
          if (!isCalibrationEnabled) {
            toast({
              title: 'Normalization Complete',
              description: `Normalized ${result.data?.processed || 0} ratings for Q${quarter}. Calibration is disabled.`,
            });
          } else {
            const distribution = calibrationResult.data?.distribution;
            const distText = distribution 
              ? ` (5★: ${distribution[5] || 0}, 4★: ${distribution[4] || 0}, 3★: ${distribution[3] || 0}, 2★: ${distribution[2] || 0}, 1★: ${distribution[1] || 0})`
              : '';
            
            toast({
              title: 'Success',
              description: (calibrationResult.data?.message || `Normalized and calibrated ${calibrationResult.data?.processed || 0} ratings for Q${quarter}`) + distText,
            });
          }
        } else {
          toast({
            title: 'Normalization Complete',
            description: `Normalized ${result.data?.processed || 0} ratings for Q${quarter}. Calibration is disabled.`,
          });
        }
      } catch (calibrationError: any) {
        console.error('Calibration error:', calibrationError);
        toast({
          title: 'Calibration Warning',
          description: calibrationError.message || 'Normalization completed but calibration check failed. You can try calibrating manually.',
          variant: 'destructive',
        });
      }
      
      // Refresh normalized ratings for the HR Review Rating tab
      await fetchNormalizedRatings(quarter);
      
      // Refresh pending reviews to reflect any changes
      await fetchData();
    } catch (error: any) {
      console.error('Normalization error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to normalize ratings',
        variant: 'destructive',
      });
    } finally {
      setNormalizing(false);
    }
  }, [activeCycle, toast, fetchNormalizedRatings, fetchData]);

  const handleCalibrate = useCallback(async (quarter: number) => {
    if (!activeCycle) {
      toast({
        title: 'Error',
        description: 'No active cycle found',
        variant: 'destructive',
      });
      return;
    }
    
    setCalibrating(true);
    try {
      console.log(`Calibrating ratings for Q${quarter}, cycle: ${activeCycle.id}`);
      const result = await evaluationService.normalization.calibrate(quarter, activeCycle.id);
      console.log('Calibration result:', result);
      
      const distribution = result.data?.distribution;
      const distText = distribution 
        ? ` (5★: ${distribution[5] || 0}, 4★: ${distribution[4] || 0}, 3★: ${distribution[3] || 0}, 2★: ${distribution[2] || 0}, 1★: ${distribution[1] || 0})`
        : '';
      
      toast({
        title: 'Success',
        description: (result.data?.message || `Calibrated ${result.data?.processed || 0} ratings for Q${quarter}`) + distText,
      });
      
      // Refresh normalized ratings to show calibrated_rating
      await fetchNormalizedRatings(quarter);
    } catch (error: any) {
      console.error('Calibration error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to calibrate ratings',
        variant: 'destructive',
      });
    } finally {
      setCalibrating(false);
    }
  }, [activeCycle, toast, fetchNormalizedRatings]);

  const handleSendToManager = useCallback(async (employeeIds: string[]) => {
    if (!activeCycle) return;
    
    setSaving('bulk');
    try {
      await evaluationService.normalization.sendToManager(employeeIds, selectedQuarter, activeCycle.id);
      toast({
        title: 'Success',
        description: `Sent ${employeeIds.length} rating(s) to manager(s)`,
      });
      await fetchNormalizedRatings(selectedQuarter);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send to manager',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  }, [activeCycle, selectedQuarter, toast, fetchNormalizedRatings]);

  const handleBulkSendToManagers = useCallback(async () => {
    if (!activeCycle) return;
    
    // Get all DRAFT and REJECTED ratings for the selected quarter
    const draftRatings = normalizedRatings.filter(
      r => (r.status === 'DRAFT' || r.status === 'REJECTED') && r.calibrated_rating !== null && r.calibrated_rating !== undefined
    );
    
    if (draftRatings.length === 0) {
      toast({
        title: 'No ratings to send',
        description: 'No DRAFT or REJECTED ratings with calibration found for this quarter.',
        variant: 'destructive',
      });
      return;
    }
    
    const employeeIds = draftRatings.map(r => r.employee_id);
    
    setSaving('bulk-send-all');
    try {
      await evaluationService.normalization.sendToManager(employeeIds, selectedQuarter, activeCycle.id);
      toast({
        title: 'Success',
        description: `Sent ${employeeIds.length} rating(s) to their respective managers`,
      });
      await fetchNormalizedRatings(selectedQuarter);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send ratings to managers',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  }, [activeCycle, selectedQuarter, normalizedRatings, toast, fetchNormalizedRatings]);

  const handlePublish = useCallback(async (employeeIds: string[]) => {
    if (!activeCycle) return;
    
    setSaving('bulk');
    try {
      await evaluationService.normalization.publish(employeeIds, selectedQuarter, activeCycle.id);
      toast({
        title: 'Success',
        description: `Published ${employeeIds.length} rating(s)`,
      });
      await fetchNormalizedRatings(selectedQuarter);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to publish ratings',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  }, [activeCycle, selectedQuarter, toast, fetchNormalizedRatings]);

  const handleUpdateRating = useCallback(async (id: string, normalizedValue: number, calibratedValue: number | null) => {
    try {
      await evaluationService.normalization.updateRating(id, normalizedValue, calibratedValue);
      toast({
        title: 'Success',
        description: 'Rating updated successfully',
      });
      setEditingRating(null);
      setEditedCalibratedRatingValue(null);
      await fetchNormalizedRatings(selectedQuarter);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update rating',
        variant: 'destructive',
      });
    }
  }, [selectedQuarter, toast, fetchNormalizedRatings]);

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

      // Get KRAs using the specified API
      const krasResult = await goalsService.kras.getByEmployee(
        review.employee_id,
        review.cycle_id,
        'approved',
        review.quarter
      );

      // Get goals (KPIs) using the specified API
      const goalsResult = await goalsService.kpis.getByEmployee(
        review.employee_id,
        review.cycle_id,
        'approved',
        review.quarter
      );

      // Get self ratings using the specified API
      let selfRatings: any[] = [];
      if (selfReviewData?.id) {
        const selfProgressResult = await evaluationService.goalSelfRatings.get(selfReviewData.id);
        selfRatings = selfProgressResult.data || [];
      }

      // Get manager KPI feedback using the specified API
      const mgrFeedbackResult = await evaluationService.kpiManagerFeedback.getByReview(review.id);
      const mgrFeedback = mgrFeedbackResult.data || [];

      // Combine goals with ratings
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
          manager_evidence: (mgrFeedbackItem as any)?.evidence || null,
          manager_review_id: review?.id || null,
        };
      });

      setGoalRatings(combinedGoals);

      // Organize KRAs with their KPIs hierarchically
      const krasWithKpis = (krasResult.data || []).map((kra: any) => {
        const kpisForKra = combinedGoals.filter((goal: any) => goal.kra_id === kra.id);
        
        // Calculate KRA rating as weighted average of KPI ratings
        let kraRating = null;
        let totalWeight = 0;
        let weightedSum = 0;
        
        kpisForKra.forEach((kpi: any) => {
          if (kpi.manager_rating !== null && kpi.manager_rating !== undefined) {
            const kpiWeight = parseFloat(kpi.weight || 0);
            weightedSum += parseFloat(kpi.manager_rating) * kpiWeight;
            totalWeight += kpiWeight;
          }
        });
        
        if (totalWeight > 0) {
          kraRating = weightedSum / totalWeight;
        }

        return {
          ...kra,
          kpis: kpisForKra,
          calculated_rating: kraRating,
        };
      });

      setKraRatings(krasWithKpis);
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

      // Get KRAs using the specified API
      const krasResult = await goalsService.kras.getByEmployee(
        rejection.employee_id,
        rejection.cycle_id,
        'approved',
        rejection.quarter
      );

      // Get goals (KPIs) using the specified API
      const goalsResult = await goalsService.kpis.getByEmployee(
        rejection.employee_id,
        rejection.cycle_id,
        'approved',
        rejection.quarter
      );

      // Get self ratings using the specified API
      let selfRatings: any[] = [];
      if (selfReviewData?.id) {
        const selfProgressResult = await evaluationService.goalSelfRatings.get(selfReviewData.id);
        selfRatings = selfProgressResult.data || [];
      }

      // Get manager KPI feedback using the specified API
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
          manager_evidence: (mgrFeedbackItem as any)?.evidence || null,
          manager_review_id: rejection.manager_review_id || null,
        };
      });

      setRejectionGoalRatings(combinedGoals);

      // Organize KRAs with their KPIs hierarchically
      const krasWithKpis = (krasResult.data || []).map((kra: any) => {
        const kpisForKra = combinedGoals.filter((goal: any) => goal.kra_id === kra.id);
        
        // Calculate KRA rating as weighted average of KPI ratings
        let kraRating = null;
        let totalWeight = 0;
        let weightedSum = 0;
        
        kpisForKra.forEach((kpi: any) => {
          if (kpi.manager_rating !== null && kpi.manager_rating !== undefined) {
            const kpiWeight = parseFloat(kpi.weight || 0);
            weightedSum += parseFloat(kpi.manager_rating) * kpiWeight;
            totalWeight += kpiWeight;
          }
        });
        
        if (totalWeight > 0) {
          kraRating = weightedSum / totalWeight;
        }

        return {
          ...kra,
          kpis: kpisForKra,
          calculated_rating: kraRating,
        };
      });

      setRejectionKraRatings(krasWithKpis);
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

  // Year-end review handlers
  const handleApproveYearEndReview = useCallback(async (reviewId: string) => {
    setSaving(reviewId);
    try {
      await evaluationService.yearEndHRReview.approveReview(reviewId);
      toast({ title: 'Year-end review approved and released to employee' });
      setShowYearEndApproveDialog(false);
      setShowYearEndReviewDialog(false);
      await fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve year-end review',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  }, [toast, fetchData]);

  const handleRejectYearEndReview = useCallback(async () => {
    if (!selectedYearEndReview || !rejectionReason.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a rejection reason',
        variant: 'destructive',
      });
      return;
    }

    setSaving(selectedYearEndReview.id);
    try {
      await evaluationService.yearEndHRReview.rejectReview(selectedYearEndReview.id, rejectionReason.trim());
      toast({ title: 'Year-end review rejected and sent back to manager' });
      setShowYearEndReviewDialog(false);
      setShowYearEndRejectDialog(false);
      setRejectionReason('');
      setSelectedYearEndReview(null);
      await fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject year-end review',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  }, [selectedYearEndReview, rejectionReason, toast, fetchData]);

  const openYearEndReviewDialog = useCallback((review: PendingYearEndReview) => {
    setSelectedYearEndReview(review);
    setShowYearEndReviewDialog(true);
  }, []);

  // Helper to format join date
  const formatJoinDate = (date: string | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

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
              Quarterly ({pendingReviews.length})
            </TabsTrigger>
            <TabsTrigger value="year-end">
              <Calendar className="h-4 w-4 mr-1" />
              Year-End ({pendingYearEndReviews.length})
            </TabsTrigger>
            {isHR && (
              <>
                <TabsTrigger 
                  value="hr-review-rating" 
                  onClick={() => {
                    // Fetch normalized ratings when tab is clicked
                    if (activeCycle) {
                      fetchNormalizedRatings(selectedQuarter);
                    }
                  }}
                >
                  HR Review Rating
                </TabsTrigger>
                <TabsTrigger 
                  value="manager-status" 
                  onClick={() => {
                    // Fetch normalized ratings when tab is clicked
                    if (activeCycle) {
                      fetchNormalizedRatings(selectedQuarter);
                    }
                  }}
                >
                  Manager Status
                </TabsTrigger>
              </>
            )}
            <TabsTrigger value="rejections">
              Rejections ({ratingRejections.filter(r => r.status === 'pending').length})
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
              <div className="space-y-6">
                {/* Group reviews by quarter and add Normalize button for each quarter */}
                {[1, 2, 3, 4].map((quarter) => {
                  const quarterReviews = pendingReviews.filter(r => r.quarter === quarter);
                  if (quarterReviews.length === 0) return null;
                  
                  return (
                    <div key={quarter} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold">Q{quarter} Reviews ({quarterReviews.length})</h3>
                        </div>
                        {isHR && (() => {
                          // Check if manager review end date has passed for this quarter
                          // quarterlyCycles is already cached in ActiveCycleContext (from localStorage)
                          // so this will work even when data is loaded from cache
                          const quarterlyCycle = quarterlyCycles?.find(qc => qc.quarter === quarter);
                          const managerReviewEndDate = quarterlyCycle?.quarterly_manager_review_end_date;
                          
                          // Compare dates (not datetime) - button should appear only after the end date has passed
                          let canNormalize = false;
                          if (managerReviewEndDate) {
                            const endDate = new Date(managerReviewEndDate);
                            endDate.setHours(23, 59, 59, 999); // Set to end of day
                            const now = new Date();
                            canNormalize = now > endDate; // Strictly after the end date
                          }
                          
                          return (
                            <div className="flex items-center gap-2">
                              {canNormalize ? (
                                <Button
                                  onClick={() => handleNormalize(quarter)}
                                  disabled={normalizing || !activeCycle}
                                  className="bg-green-600 text-white hover:opacity-90 transition hover:bg-green-700"
                                >
                                  {normalizing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                  <Calculator className="mr-2 h-4 w-4" />
                                  Normalize & Calibrate Q{quarter}
                                </Button>
                              ) : (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Clock className="h-4 w-4" />
                                  <span>
                                    Normalize available after {managerReviewEndDate 
                                      ? new Date(managerReviewEndDate).toLocaleDateString()
                                      : 'manager review end date'}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="grid gap-4">
                        {quarterReviews.map((review) => (
                          <Card key={review.id} className="hover:shadow-md transition-shadow">
                            <CardHeader>
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <CardTitle className="flex items-center gap-2">
                                    <User className="h-5 w-5" />
                                    {review.employee_name}
                                    <Badge variant="outline">{review.employee_code}</Badge>
                                  </CardTitle>
                                  <CardDescription className="mt-2 flex items-center gap-4">
                                    <span>Q{review.quarter} • {review.cycle_name}</span>
                                    <span>Manager: {review.manager_name}</span>
                                  </CardDescription>
                                </div>
                                <div className="text-right">
                                  <div className="text-2xl font-bold text-primary">
                                    {review.display_rating || review.calculated_overall_rating
                                      ? formatRating(review.display_rating || review.calculated_overall_rating)
                                      : '-'}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {review.period_type === 'post_transition' && review.transition_id
                                      ? 'Average Rating (Pre + Post)'
                                      : 'Overall Rating'}
                                  </div>
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
                                  variant="outline"
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
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Year-End Reviews Tab */}
          <TabsContent value="year-end" className="space-y-4">
            {pendingYearEndReviews.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg">No pending year-end reviews</h3>
                  <p className="text-muted-foreground">
                    All year-end evaluations have been reviewed.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {pendingYearEndReviews.map((review) => (
                  <Card key={review.id} className="hover:shadow-md transition-shadow border-l-4 border-l-card-border">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" />
                            {review.employee_name}
                            <Badge variant="outline">{review.employee_code}</Badge>
                            <Badge variant="secondary" className="bg-primary/10">
                              <Calendar className="h-3 w-3 mr-1" />
                              Year-End
                            </Badge>
                          </CardTitle>
                          <CardDescription className="mt-2 flex flex-wrap items-center gap-4">
                            <span>{review.cycle_name}</span>
                            <span>Manager: {review.manager_name}</span>
                            <span>Joined: {formatJoinDate(review.date_of_joining)}</span>
                            <span>{review.completed_quarters}/4 Quarters</span>
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">
                            {review.overall_rating 
                              ? formatRating(review.overall_rating)
                              : review.calculated_overall_rating
                                ? formatRating(review.calculated_overall_rating)
                                : '-'}
                          </div>
                          <div className="text-xs text-muted-foreground">Year-End Rating</div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {/* Quarterly Ratings Summary */}
                      <div className="grid grid-cols-4 gap-2 mb-4">
                        {[
                          { label: 'Q1', rating: review.q1_rating },
                          { label: 'Q2', rating: review.q2_rating },
                          { label: 'Q3', rating: review.q3_rating },
                          { label: 'Q4', rating: review.q4_rating },
                        ].map((q) => (
                          <div key={q.label} className="p-2 rounded bg-muted/50 text-center">
                            <div className="text-xs text-muted-foreground">{q.label}</div>
                            <div className="font-semibold text-sm">
                              {q.rating !== null && q.rating !== undefined ? formatRating(q.rating) : '-'}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          onClick={() => openYearEndReviewDialog(review)}
                          variant="outline"
                          className="flex-1"
                        >
                          View Details
                        </Button>
                        <Button
                          onClick={() => {
                            setSelectedYearEndReview(review);
                            setShowYearEndApproveDialog(true);
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

          {/* HR Review Rating Tab */}
          {isHR && (
            <TabsContent value="hr-review-rating" className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Label>Quarter:</Label>
                  <select
                    value={selectedQuarter}
                    onChange={(e) => {
                      const q = parseInt(e.target.value);
                      setSelectedQuarter(q);
                      fetchNormalizedRatings(q);
                    }}
                    className="px-3 py-2 border rounded-md"
                  >
                    <option value={1}>Q1</option>
                    <option value={2}>Q2</option>
                    <option value={3}>Q3</option>
                    <option value={4}>Q4</option>
                  </select>
                  <p className="text-sm text-muted-foreground">
                    Normalized ratings will appear here after clicking "Normalize Q{selectedQuarter}" in the Quarterly tab
                  </p>
                </div>
                {normalizedRatings.filter(r => (r.status === 'DRAFT' || r.status === 'REJECTED') && r.calibrated_rating !== null && r.calibrated_rating !== undefined).length > 0 && (
                  <Button
                    onClick={handleBulkSendToManagers}
                    disabled={saving === 'bulk-send-all' || !activeCycle}
                    className="bg-blue-600 text-white hover:bg-blue-700"
                    size="lg"
                  >
                    {saving === 'bulk-send-all' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Send className="mr-2 h-4 w-4" />
                    Send All to Managers ({normalizedRatings.filter(r => (r.status === 'DRAFT' || r.status === 'REJECTED') && r.calibrated_rating !== null && r.calibrated_rating !== undefined).length})
                  </Button>
                )}
              </div>

              {/* Explanation Card */}
              {/* <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Calculator className="h-4 w-4" />
                      How Normalization Works
                    </h4>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>
                        <strong>Box-Cox Transform:</strong> Moves the distribution closer to a bell curve (normal distribution) when sufficient data is available, reducing manager bias.
                      </p>
                      <p>
                        <strong>Min-Max Scaling:</strong> Scales transformed values to [1, 5] range while preserving relative differences.
                      </p>
                      <p>
                        <strong>Winsorization:</strong> Clips extreme outliers (P5/P95) to prevent one extreme rating from distorting the whole team/grade.
                      </p>
                      <p>
                        <strong>Two-Level Normalization:</strong>
                      </p>
                      <ul className="list-disc list-inside ml-2 space-y-1">
                        <li><strong>Manager Level:</strong> Normalizes within each manager's team (requires ≥3 employees for full normalization)</li>
                        <li><strong>Grade Level:</strong> Normalizes within each grade/band (requires ≥3 employees for full normalization)</li>
                        <li><strong>Final Rating:</strong> Weighted average of manager-level and grade-level (configurable weights, default 50/50)</li>
                      </ul>
                      <p className="mt-2 text-orange-600">
                        <strong>Note:</strong> Groups with &lt;3 employees use global scaling fallback. Changes are capped at ±2.0 from raw rating for fairness.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card> */}

              {normalizedRatingsLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  {normalizedRatings.length === 0 ? (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <Calculator className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="font-semibold text-lg">No normalized ratings found</h3>
                        <p className="text-muted-foreground text-center">
                          Click "Normalize Q{selectedQuarter}" in the Quarterly tab to generate normalized ratings.
                        </p>
                        <p className="text-xs text-muted-foreground mt-2 text-center max-w-md">
                          Note: Normalization requires at least 2 employees per manager or grade. Single employees will use raw ratings.
                        </p>
                      </CardContent>
                    </Card>
                  ) : normalizedRatings.filter(r => r.status === 'DRAFT' || r.status === 'REJECTED').length === 0 ? (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="font-semibold text-lg">No ratings to review</h3>
                        <p className="text-muted-foreground">
                          All normalized ratings have been processed (sent to manager or published).
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-4">
                      {normalizedRatings
                        .filter(r => r.status === 'DRAFT' || r.status === 'REJECTED')
                        .map((rating) => (
                          <Card key={rating.id}>
                            <CardHeader>
                              <div className="flex items-start justify-between">
                                <div>
                                  <CardTitle className="flex items-center gap-2">
                                    <User className="h-5 w-5" />
                                    {rating.employee_name}
                                    <Badge variant="outline">{rating.employee_code}</Badge>
                                    <Badge variant={rating.status === 'REJECTED' ? 'destructive' : 'secondary'}>
                                      {rating.status}
                                    </Badge>
                                  </CardTitle>
                                  <CardDescription>
                                    Grade: {rating.grade} • Manager: {rating.manager_name}
                                  </CardDescription>
                                </div>
                                <div className="text-right">
                                  <div className="space-y-2">
                                    <div>
                                      <div className="text-xs text-muted-foreground mb-1">Raw Rating</div>
                                      <div className="text-lg font-semibold">{formatRating(rating.raw_rating)}</div>
                                    </div>
                                    <div className="pt-2 border-t">
                                      <div className="text-xs text-muted-foreground mb-1">Normalized Rating</div>
                                      <div className="text-2xl font-bold text-primary">
                                        {editingRating === rating.id ? (
                                          <input
                                            type="number"
                                            min="1"
                                            max="5"
                                            step="0.01"
                                            value={editedRatingValue}
                                            onChange={(e) => setEditedRatingValue(parseFloat(e.target.value))}
                                            className="w-20 px-2 py-1 border rounded"
                                          />
                                        ) : (
                                          formatRating(rating.final_normalized_rating)
                                        )}
                                      </div>
                                      {rating.final_normalized_rating && rating.raw_rating && (
                                        <div className="text-xs mt-1">
                                          {Math.abs(parseFloat(rating.final_normalized_rating) - parseFloat(rating.raw_rating)) < 0.01 ? (
                                            <span className="text-muted-foreground">No change</span>
                                          ) : parseFloat(rating.final_normalized_rating) > parseFloat(rating.raw_rating) ? (
                                            <span className="text-green-600">
                                              ↑ +{(parseFloat(rating.final_normalized_rating) - parseFloat(rating.raw_rating)).toFixed(2)}
                                            </span>
                                          ) : (
                                            <span className="text-red-600">
                                              ↓ {(parseFloat(rating.final_normalized_rating) - parseFloat(rating.raw_rating)).toFixed(2)}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    <div className="pt-2 border-t">
                                      <div className="text-xs text-muted-foreground mb-1">Calibrated Rating (Bell Curve)</div>
                                      {editingRating === rating.id ? (
                                        <input
                                          type="number"
                                          min="1"
                                          max="5"
                                          step="1"
                                          value={editedCalibratedRatingValue ?? ''}
                                          onChange={(e) => setEditedCalibratedRatingValue(e.target.value ? parseInt(e.target.value) : null)}
                                          className="w-20 px-2 py-1 border rounded"
                                          placeholder="1-5"
                                        />
                                      ) : rating.calibrated_rating !== null && rating.calibrated_rating !== undefined ? (
                                        <div className="text-2xl font-bold text-purple-600">
                                          {'★'.repeat(rating.calibrated_rating)} ({rating.calibrated_rating})
                                        </div>
                                      ) : (
                                        <div className="text-sm text-muted-foreground">Not calibrated</div>
                                      )}
                                      {rating.calibrated_rating !== null && rating.calibrated_rating !== undefined && !editingRating && (
                                        <div className="text-xs text-muted-foreground mt-1">
                                          Based on final_normalized_rating within grade
                                        </div>
                                      )}
                                    </div>
                                    {rating.boxcox_manager_level_rating !== null && rating.boxcox_grade_level_rating !== null && (
                                      <div className="pt-2 border-t text-xs text-muted-foreground space-y-1">
                                        <div>Manager Level: {formatRating(rating.boxcox_manager_level_rating)}</div>
                                        <div>Grade Level: {formatRating(rating.boxcox_grade_level_rating)}</div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent>
                              {/* KPI and KRA Breakdown */}
                              {(rating.normalized_kpi_ratings || rating.normalized_kra_ratings) && (
                                <div className="mb-4">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const newExpanded = new Set(expandedRatings);
                                      if (newExpanded.has(rating.id)) {
                                        newExpanded.delete(rating.id);
                                      } else {
                                        newExpanded.add(rating.id);
                                      }
                                      setExpandedRatings(newExpanded);
                                    }}
                                    className="w-full justify-between"
                                  >
                                    <span className="text-sm font-medium">
                                      {expandedRatings.has(rating.id) ? 'Hide' : 'Show'} KPI & KRA Breakdown
                                    </span>
                                    {expandedRatings.has(rating.id) ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </Button>
                                  
                                  {expandedRatings.has(rating.id) && (
                                    <div className="mt-4 space-y-4 border-t pt-4">
                                      {/* KRA Ratings */}
                                      {rating.normalized_kra_ratings && Array.isArray(rating.normalized_kra_ratings) && rating.normalized_kra_ratings.length > 0 && (
                                        <div>
                                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                            <Target className="h-4 w-4" />
                                            KRA Ratings
                                          </h4>
                                          <div className="space-y-2">
                                            {rating.normalized_kra_ratings.map((kra: any, idx: number) => (
                                              <div key={idx} className="text-sm p-2 bg-muted rounded">
                                                <div className="flex justify-between items-center">
                                                  <span className="font-medium">KRA {idx + 1} (Weight: {kra.weight}%)</span>
                                                  <div className="flex gap-4 text-xs">
                                                    <div>
                                                      <span className="text-muted-foreground">Raw: </span>
                                                      <span className="font-medium">{kra.raw_rating ? formatRating(kra.raw_rating) : 'N/A'}</span>
                                                    </div>
                                                    <div>
                                                      <span className="text-muted-foreground">Normalized: </span>
                                                      <span className="font-medium text-primary">{kra.final_normalized ? formatRating(kra.final_normalized) : 'N/A'}</span>
                                                    </div>
                                                    {kra.raw_rating && kra.final_normalized && (
                                                      <div className={parseFloat(kra.final_normalized) > parseFloat(kra.raw_rating) ? 'text-green-600' : parseFloat(kra.final_normalized) < parseFloat(kra.raw_rating) ? 'text-red-600' : 'text-muted-foreground'}>
                                                        {parseFloat(kra.final_normalized) > parseFloat(kra.raw_rating) ? '↑' : parseFloat(kra.final_normalized) < parseFloat(kra.raw_rating) ? '↓' : '='}
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* KPI Ratings */}
                                      {rating.normalized_kpi_ratings && Array.isArray(rating.normalized_kpi_ratings) && rating.normalized_kpi_ratings.length > 0 && (
                                        <div>
                                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                            <Target className="h-4 w-4" />
                                            KPI Ratings
                                          </h4>
                                          <div className="space-y-2 max-h-64 overflow-y-auto">
                                            {rating.normalized_kpi_ratings.map((kpi: any, idx: number) => (
                                              <div key={idx} className="text-sm p-2 bg-muted rounded">
                                                <div className="flex justify-between items-center">
                                                  <span className="font-medium">KPI {idx + 1} (Weight: {kpi.weight}%)</span>
                                                  <div className="flex gap-3 text-xs">
                                                    <div>
                                                      <span className="text-muted-foreground">Raw: </span>
                                                      <span className="font-medium">{kpi.raw_rating ? formatRating(kpi.raw_rating) : 'N/A'}</span>
                                                    </div>
                                                    {kpi.normalized_manager !== null && (
                                                      <div>
                                                        <span className="text-muted-foreground">Mgr: </span>
                                                        <span className="font-medium">{formatRating(kpi.normalized_manager)}</span>
                                                      </div>
                                                    )}
                                                    {kpi.normalized_grade !== null && (
                                                      <div>
                                                        <span className="text-muted-foreground">Grade: </span>
                                                        <span className="font-medium">{formatRating(kpi.normalized_grade)}</span>
                                                      </div>
                                                    )}
                                                    <div>
                                                      <span className="text-muted-foreground">Final: </span>
                                                      <span className="font-medium text-primary">{kpi.final_normalized ? formatRating(kpi.final_normalized) : 'N/A'}</span>
                                                    </div>
                                                    {kpi.raw_rating && kpi.final_normalized && (
                                                      <div className={parseFloat(kpi.final_normalized) > parseFloat(kpi.raw_rating) ? 'text-green-600' : parseFloat(kpi.final_normalized) < parseFloat(kpi.raw_rating) ? 'text-red-600' : 'text-muted-foreground'}>
                                                        {parseFloat(kpi.final_normalized) > parseFloat(kpi.raw_rating) ? '↑' : parseFloat(kpi.final_normalized) < parseFloat(kpi.raw_rating) ? '↓' : '='}
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              <div className="flex gap-2">
                                {editingRating === rating.id ? (
                                  <>
                                    <Button
                                      onClick={() => handleUpdateRating(rating.id, editedRatingValue, editedCalibratedRatingValue)}
                                      size="sm"
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      variant="outline"
                                      onClick={() => {
                                        setEditingRating(null);
                                        setEditedCalibratedRatingValue(null);
                                      }}
                                      size="sm"
                                    >
                                      Cancel
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    {rating.status === 'REJECTED' && (
                                      <Button
                                        variant="outline"
                                        onClick={() => {
                                          setEditingRating(rating.id);
                                          setEditedRatingValue(rating.final_normalized_rating);
                                          setEditedCalibratedRatingValue(rating.calibrated_rating ?? null);
                                        }}
                                        size="sm"
                                      >
                                        Edit Rating
                                      </Button>
                                    )}
                                    <Button
                                      onClick={() => handleSendToManager([rating.employee_id])}
                                      disabled={saving === rating.id}
                                      size="sm"
                                    >
                                      {saving === rating.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                      Send to Manager
                                    </Button>
                                  </>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          )}

          {/* Manager Status Tab */}
          {isHR && (
            <TabsContent value="manager-status" className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Label>Quarter:</Label>
                  <select
                    value={selectedQuarter}
                    onChange={(e) => {
                      const q = parseInt(e.target.value);
                      setSelectedQuarter(q);
                      fetchNormalizedRatings(q);
                    }}
                    className="px-3 py-2 border rounded-md"
                  >
                    <option value={1}>Q1</option>
                    <option value={2}>Q2</option>
                    <option value={3}>Q3</option>
                    <option value={4}>Q4</option>
                  </select>
                </div>
                {(() => {
                  const acceptedRatings = normalizedRatings.filter(r => r.status === 'ACCEPTED');
                  const hasAcceptedRatings = acceptedRatings.length > 0;
                  return (
                    <Button
                      onClick={() => {
                        const employeeIds = acceptedRatings.map(r => r.employee_id);
                        handlePublish(employeeIds);
                      }}
                      disabled={!hasAcceptedRatings || saving === 'bulk'}
                      variant="default"
                    >
                      {saving === 'bulk' ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Publishing...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Publish to All ({acceptedRatings.length})
                        </>
                      )}
                    </Button>
                  );
                })()}
              </div>

              {normalizedRatingsLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  {normalizedRatings.filter(r => ['ACCEPTED', 'REJECTED', 'PUBLISHED'].includes(r.status)).length === 0 ? (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="font-semibold text-lg">No ratings in review</h3>
                        <p className="text-muted-foreground">
                          No ratings have been sent to managers yet.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-4">
                      {normalizedRatings
                        .filter(r => ['ACCEPTED', 'REJECTED', 'PUBLISHED'].includes(r.status))
                        .map((rating) => (
                          <Card key={rating.id}>
                            <CardHeader>
                              <div className="flex items-start justify-between">
                                <div>
                                  <CardTitle className="flex items-center gap-2">
                                    <User className="h-5 w-5" />
                                    {rating.employee_name}
                                    <Badge variant="outline">{rating.employee_code}</Badge>
                                    <Badge
                                      variant={
                                        rating.status === 'PUBLISHED' ? 'default' :
                                        rating.status === 'ACCEPTED' ? 'secondary' :
                                        'destructive'
                                      }
                                    >
                                      {rating.status}
                                    </Badge>
                                  </CardTitle>
                                  <CardDescription>
                                    Grade: {rating.grade} • Manager: {rating.manager_name}
                                  </CardDescription>
                                </div>
                                <div className="text-right">
                                  <div className="space-y-2">
                                    <div>
                                      <div className="text-xs text-muted-foreground mb-1">Raw Rating</div>
                                      <div className="text-lg font-semibold">{formatRating(rating.raw_rating)}</div>
                                    </div>
                                    <div className="pt-2 border-t">
                                      <div className="text-xs text-muted-foreground mb-1">Normalized Rating</div>
                                      <div className="text-2xl font-bold text-primary">
                                        {editingRating === rating.id ? (
                                          <input
                                            type="number"
                                            min="1"
                                            max="5"
                                            step="0.01"
                                            value={editedRatingValue}
                                            onChange={(e) => setEditedRatingValue(parseFloat(e.target.value))}
                                            className="w-20 px-2 py-1 border rounded"
                                          />
                                        ) : (
                                          formatRating(rating.final_normalized_rating)
                                        )}
                                      </div>
                                      {rating.final_normalized_rating && rating.raw_rating && (
                                        <div className="text-xs mt-1">
                                          {Math.abs(parseFloat(rating.final_normalized_rating) - parseFloat(rating.raw_rating)) < 0.01 ? (
                                            <span className="text-muted-foreground">No change</span>
                                          ) : parseFloat(rating.final_normalized_rating) > parseFloat(rating.raw_rating) ? (
                                            <span className="text-green-600">
                                              ↑ +{(parseFloat(rating.final_normalized_rating) - parseFloat(rating.raw_rating)).toFixed(2)}
                                            </span>
                                          ) : (
                                            <span className="text-red-600">
                                              ↓ {(parseFloat(rating.final_normalized_rating) - parseFloat(rating.raw_rating)).toFixed(2)}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    <div className="pt-2 border-t">
                                      <div className="text-xs text-muted-foreground mb-1">Calibrated Rating (Bell Curve)</div>
                                      {editingRating === rating.id ? (
                                        <input
                                          type="number"
                                          min="1"
                                          max="5"
                                          step="1"
                                          value={editedCalibratedRatingValue ?? ''}
                                          onChange={(e) => setEditedCalibratedRatingValue(e.target.value ? parseInt(e.target.value) : null)}
                                          className="w-20 px-2 py-1 border rounded"
                                          placeholder="1-5"
                                        />
                                      ) : rating.calibrated_rating !== null && rating.calibrated_rating !== undefined ? (
                                        <div className="text-2xl font-bold text-purple-600">
                                          {'★'.repeat(rating.calibrated_rating)} ({rating.calibrated_rating})
                                        </div>
                                      ) : (
                                        <div className="text-sm text-muted-foreground">Not calibrated</div>
                                      )}
                                      {rating.calibrated_rating !== null && rating.calibrated_rating !== undefined && !editingRating && (
                                        <div className="text-xs text-muted-foreground mt-1">
                                          Based on final_normalized_rating within grade
                                        </div>
                                      )}
                                    </div>
                                    <div className="pt-2 border-t text-xs text-muted-foreground space-y-1">
                                      {/* <div className="font-semibold mb-1">Intermediate Ratings:</div> */}
                                      {/* <div className="grid grid-cols-2 gap-2"> */}
                                        {/* <div>
                                          <div>Manager Level:</div>
                                          <div className="font-medium">{formatRating(rating.boxcox_manager_level_rating)}</div>
                                          {rating.manager_lambda !== null && (
                                            <div className="text-[10px]">λ={parseFloat(rating.manager_lambda).toFixed(2)}</div>
                                          )}
                                          {rating.manager_group_size !== null && (
                                            <div className="text-[10px]">n={rating.manager_group_size}</div>
                                          )}
                                        </div> */}
                                        {/* <div>
                                          <div>Grade Level:</div>
                                          <div className="font-medium">{formatRating(rating.boxcox_grade_level_rating)}</div>
                                          {rating.grade_lambda !== null && (
                                            <div className="text-[10px]">λ={parseFloat(rating.grade_lambda).toFixed(2)}</div>
                                          )}
                                          {rating.grade_group_size !== null && (
                                            <div className="text-[10px]">n={rating.grade_group_size}</div>
                                          )}
                                        </div> */}
                                      {/* </div> */}
                                      {rating.manager_weight && rating.grade_weight && (
                                        <div className="mt-1 text-[10px]">
                                          Weights: {Math.round(parseFloat(rating.manager_weight) * 100)}% Manager / {Math.round(parseFloat(rating.grade_weight) * 100)}% Grade
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent>
                              {/* KPI and KRA Breakdown */}
                              {(rating.normalized_kpi_ratings || rating.normalized_kra_ratings) && (
                                <div className="mb-4">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const newExpanded = new Set(expandedRatings);
                                      if (newExpanded.has(rating.id)) {
                                        newExpanded.delete(rating.id);
                                      } else {
                                        newExpanded.add(rating.id);
                                      }
                                      setExpandedRatings(newExpanded);
                                    }}
                                    className="w-full justify-between"
                                  >
                                    <span className="text-sm font-medium">
                                      {expandedRatings.has(rating.id) ? 'Hide' : 'Show'} KPI & KRA Breakdown
                                    </span>
                                    {expandedRatings.has(rating.id) ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </Button>
                                  
                                  {expandedRatings.has(rating.id) && (
                                    <div className="mt-4 space-y-4 border-t pt-4">
                                      {/* KRA Ratings */}
                                      {rating.normalized_kra_ratings && Array.isArray(rating.normalized_kra_ratings) && rating.normalized_kra_ratings.length > 0 && (
                                        <div>
                                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                            <Target className="h-4 w-4" />
                                            KRA Ratings
                                          </h4>
                                          <div className="space-y-2">
                                            {rating.normalized_kra_ratings.map((kra: any, idx: number) => (
                                              <div key={idx} className="text-sm p-2 bg-muted rounded">
                                                <div className="flex justify-between items-center">
                                                  <span className="font-medium">KRA {idx + 1} (Weight: {kra.weight}%)</span>
                                                  <div className="flex gap-4 text-xs">
                                                    <div>
                                                      <span className="text-muted-foreground">Raw: </span>
                                                      <span className="font-medium">{kra.raw_rating ? formatRating(kra.raw_rating) : 'N/A'}</span>
                                                    </div>
                                                    <div>
                                                      <span className="text-muted-foreground">Normalized: </span>
                                                      <span className="font-medium text-primary">{kra.final_normalized ? formatRating(kra.final_normalized) : 'N/A'}</span>
                                                    </div>
                                                    {kra.raw_rating && kra.final_normalized && (
                                                      <div className={parseFloat(kra.final_normalized) > parseFloat(kra.raw_rating) ? 'text-green-600' : parseFloat(kra.final_normalized) < parseFloat(kra.raw_rating) ? 'text-red-600' : 'text-muted-foreground'}>
                                                        {parseFloat(kra.final_normalized) > parseFloat(kra.raw_rating) ? '↑' : parseFloat(kra.final_normalized) < parseFloat(kra.raw_rating) ? '↓' : '='}
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* KPI Ratings */}
                                      {rating.normalized_kpi_ratings && Array.isArray(rating.normalized_kpi_ratings) && rating.normalized_kpi_ratings.length > 0 && (
                                        <div>
                                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                            <Target className="h-4 w-4" />
                                            KPI Ratings
                                          </h4>
                                          <div className="space-y-2 max-h-64 overflow-y-auto">
                                            {rating.normalized_kpi_ratings.map((kpi: any, idx: number) => (
                                              <div key={idx} className="text-sm p-2 bg-muted rounded">
                                                <div className="flex justify-between items-center">
                                                  <span className="font-medium">KPI {idx + 1} (Weight: {kpi.weight}%)</span>
                                                  <div className="flex gap-3 text-xs">
                                                    <div>
                                                      <span className="text-muted-foreground">Raw: </span>
                                                      <span className="font-medium">{kpi.raw_rating ? formatRating(kpi.raw_rating) : 'N/A'}</span>
                                                    </div>
                                                    {kpi.normalized_manager !== null && (
                                                      <div>
                                                        <span className="text-muted-foreground">Mgr: </span>
                                                        <span className="font-medium">{formatRating(kpi.normalized_manager)}</span>
                                                      </div>
                                                    )}
                                                    {kpi.normalized_grade !== null && (
                                                      <div>
                                                        <span className="text-muted-foreground">Grade: </span>
                                                        <span className="font-medium">{formatRating(kpi.normalized_grade)}</span>
                                                      </div>
                                                    )}
                                                    <div>
                                                      <span className="text-muted-foreground">Final: </span>
                                                      <span className="font-medium text-primary">{kpi.final_normalized ? formatRating(kpi.final_normalized) : 'N/A'}</span>
                                                    </div>
                                                    {kpi.raw_rating && kpi.final_normalized && (
                                                      <div className={parseFloat(kpi.final_normalized) > parseFloat(kpi.raw_rating) ? 'text-green-600' : parseFloat(kpi.final_normalized) < parseFloat(kpi.raw_rating) ? 'text-red-600' : 'text-muted-foreground'}>
                                                        {parseFloat(kpi.final_normalized) > parseFloat(kpi.raw_rating) ? '↑' : parseFloat(kpi.final_normalized) < parseFloat(kpi.raw_rating) ? '↓' : '='}
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              <div className="flex gap-2">
                                {rating.status === 'ACCEPTED' && (
                                  <Button
                                    onClick={() => handlePublish([rating.employee_id])}
                                    disabled={saving === rating.id}
                                    size="sm"
                                  >
                                    {saving === rating.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Publish
                                  </Button>
                                )}
                                {rating.status === 'REJECTED' && (
                                  <>
                                    {editingRating === rating.id ? (
                                      <>
                                        <Button
                                          onClick={() => handleUpdateRating(rating.id, editedRatingValue, editedCalibratedRatingValue)}
                                          size="sm"
                                        >
                                          Save
                                        </Button>
                                        <Button
                                          variant="outline"
                                          onClick={() => {
                                            setEditingRating(null);
                                            setEditedCalibratedRatingValue(null);
                                          }}
                                          size="sm"
                                        >
                                          Cancel
                                        </Button>
                                      </>
                                    ) : (
                                      <>
                                        <Button
                                          variant="outline"
                                          onClick={() => {
                                            setEditingRating(rating.id);
                                            setEditedRatingValue(rating.final_normalized_rating);
                                            setEditedCalibratedRatingValue(rating.calibrated_rating ?? null);
                                          }}
                                          size="sm"
                                        >
                                          Edit Rating
                                        </Button>
                                        <Button
                                          onClick={() => handleSendToManager([rating.employee_id])}
                                          disabled={saving === rating.id}
                                          size="sm"
                                        >
                                          {saving === rating.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                          Save & Resend
                                        </Button>
                                      </>
                                    )}
                                  </>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          )}
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
                    {reviewDetails.period_type === 'post_transition' && reviewDetails.transition_id && (
                      <Badge variant="outline" className="ml-2">
                        Average (Pre + Post)
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center p-6 rounded-lg bg-primary/5 border-2 border-primary">
                    <div className="text-sm text-muted-foreground mb-2">Performance Rating</div>
                    <div className="text-4xl font-bold text-primary mb-2">
                      {reviewDetails.display_rating || reviewDetails.calculated_overall_rating
                        ? formatRating(reviewDetails.display_rating || reviewDetails.calculated_overall_rating)
                        : '-'}
                    </div>
                    {reviewDetails.period_type === 'post_transition' && reviewDetails.transition_id && (
                      <div className="text-xs text-muted-foreground mt-2">
                        Calculated as average of pre-transition (HR approved) and post-transition ratings
                      </div>
                    )}
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
                    {selfReview.overall_rating && (
                      <div className="mb-4">
                        <Label className="text-sm font-medium">Overall Rating</Label>
                        <p className="text-lg text-normal font-bold p-3 rounded">
                          {formatRating(selfReview.overall_rating)}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Goal Ratings - Hierarchical Structure: KRAs -> KPIs */}
              {/* <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Goal Ratings (KRAs → KPIs)
                  </CardTitle>
                  <CardDescription>
                    Overall Rating = Goal Rating = Weighted Average of KRAs
                    <br />
                    KRA Rating = Weighted Average of KPIs
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6"> */}
                  {/* {kraRatings.length > 0 ? (
                    kraRatings.map((kra) => (
                      <div key={kra.id} className="p-4 rounded-lg border-2 border-primary/20 bg-primary/5">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="default" className="bg-primary">KRA</Badge>
                              <span className="text-sm text-muted-foreground">Weight: {kra.weight}%</span>
                              {kra.calculated_rating !== null && (
                                <span className="text-sm font-semibold text-primary">
                                  KRA Rating: {formatRating(kra.calculated_rating)}
                                </span>
                              )}
                            </div>
                            <h4 className="font-semibold text-lg">{kra.title}</h4>
                            {kra.description && (
                              <p className="text-sm text-muted-foreground mt-1">{kra.description}</p>
                            )}
                          </div>
                        </div> */}

                        {/* {kra.kpis && kra.kpis.length > 0 ? (
                          <div className="space-y-3 mt-4 pl-4 border-l-2 border-primary/30">
                            <div className="text-xs font-medium text-muted-foreground mb-2">KPIs:</div>
                            {kra.kpis.map((kpi: any) => (
                              <div key={kpi.id} className="p-3 rounded-lg border bg-background">
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge variant="outline">{kpi.goal_type?.toUpperCase() || 'KPI'}</Badge>
                                      <span className="text-xs text-muted-foreground">Weight: {kpi.weight}%</span>
                                    </div>
                                    <h5 className="font-medium text-sm">{kpi.title}</h5>
                                  </div>
                                </div>
                                
                                <div className="grid gap-3 sm:grid-cols-2 mt-3">
                                  <div className="p-2 rounded bg-muted/30">
                                    <div className="text-xs text-muted-foreground mb-1">Employee Self Rating</div>
                                    <div className="font-medium text-sm">{kpi.self_rating || '-'}</div>
                                    {kpi.self_achievement && (
                                      <div className="text-xs text-muted-foreground mt-1">
                                        {kpi.self_achievement}
                                      </div>
                                    )}
                                  </div>
                                  <div className="p-2 rounded bg-primary/5">
                                    <div className="text-xs text-muted-foreground mb-1">Manager Rating</div>
                                    <div className="font-medium text-sm">{kpi.manager_rating ? formatRating(kpi.manager_rating) : '-'}</div>
                                  </div>
                                </div>

                                {kpi.manager_comments && (
                                  <div className="mt-2 p-2 rounded bg-muted/20">
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                      <MessageSquare className="h-3 w-3" />
                                      Manager Feedback
                                    </div>
                                    <p className="text-xs">{kpi.manager_comments}</p>
                                  </div>
                                )}

                                {kpi.self_evidence && (
                                  <div className="mt-2">
                                    <KPIEvidenceView
                                      evidence={kpi.self_evidence}
                                      goalId={kpi.id}
                                      employeeId={selectedReview?.employee_id || ''}
                                      quarter={selectedReview?.quarter || 1}
                                    />
                                  </div>
                                )} */}

                                {/* {kpi.manager_evidence && kpi.manager_review_id && (
                                  <div className="mt-2">
                                    <ManagerEvidenceView
                                      evidence={kpi.manager_evidence}
                                      goalId={kpi.id}
                                      managerReviewId={kpi.manager_review_id}
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground mt-2 pl-4">No KPIs found for this KRA</div>
                        )}
                      </div>
                    )) */}
                  {/* ) : goalRatings.length > 0 ? (
                    goalRatings.map((goal) => (
                      <div key={goal.id} className="p-4 rounded-lg border">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline">{goal.goal_type?.toUpperCase() || 'KPI'}</Badge>
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
                            <div className="font-medium">{goal.manager_rating ? formatRating(goal.manager_rating) : '-'}</div>
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
                        )} */}

                        {/* Employee Evidence */}
                        {/* {goal.self_evidence && (
                          <div className="mt-3">
                            <KPIEvidenceView
                              evidence={goal.self_evidence}
                              goalId={goal.id}
                              employeeId={selectedReview?.employee_id || ''}
                              quarter={selectedReview?.quarter || 1}
                            />
                          </div>
                        )} */}

                        {/* Manager Evidence */}
                        {/* {goal.manager_evidence && goal.manager_review_id && (
                          <div className="mt-3">
                            <ManagerEvidenceView
                              evidence={goal.manager_evidence}
                              goalId={goal.id}
                              managerReviewId={goal.manager_review_id}
                            />
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-4">No goals found</div>
                  )} */}
                {/* </CardContent>
              </Card> */}

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

      {/* Year-End Review Details Dialog */}
      <Dialog open={showYearEndReviewDialog} onOpenChange={setShowYearEndReviewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Year-End Review Details
            </DialogTitle>
            <DialogDescription>
              {selectedYearEndReview && (
                <>
                  {selectedYearEndReview.employee_name} • {selectedYearEndReview.cycle_name}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedYearEndReview && (
            <div className="space-y-6">
              {/* Employee Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Employee Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <Label className="text-muted-foreground">Employee</Label>
                      <p className="font-medium mt-1">{selectedYearEndReview.employee_name} ({selectedYearEndReview.employee_code})</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Joining Date</Label>
                      <p className="font-medium mt-1">{formatJoinDate(selectedYearEndReview.date_of_joining)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Quarters Evaluated</Label>
                      <p className="font-medium mt-1">{selectedYearEndReview.completed_quarters} of 4</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quarterly Ratings */}
              
                  <Separator className="my-4" />
                  <span className="flex items-center gap-2"><Clock className="h-5 w-5" />
                    <div className="font-semibold text-lg ">Year-End Overall Rating</div>
                    </span>
                  <div className="text-center p-6 rounded-lg bg-primary/5 border-2 ">
                    <div className="text-4xl font-bold text-primary mb-2">
                      {selectedYearEndReview.overall_rating 
                        ? parseFloat(formatRating(selectedYearEndReview.overall_rating)).toFixed(1)
                        : selectedYearEndReview.calculated_overall_rating
                          ? formatRating(selectedYearEndReview.calculated_overall_rating)
                          : '-'}
                    </div>
                    {selectedYearEndReview.calculated_overall_rating && !selectedYearEndReview.overall_rating && (
                      <div className="text-xs text-muted-foreground">
                        (Auto-calculated average of quarterly ratings)
                      </div>
                    )}
                  </div>

              {/* Potential Rating */}
              {selectedYearEndReview.potential_rating !== null && selectedYearEndReview.potential_rating !== undefined && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-start justify-start gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Potential Rating
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="text-start">
                        <div className="text-2xl font-normal mb-2">
                          {selectedYearEndReview.potential_rating === 3 && 'High Potential'}
                          {selectedYearEndReview.potential_rating === 2 && 'Medium Potential'}
                          {selectedYearEndReview.potential_rating === 1 && 'Low Potential'}
                        </div>
                        <p className="text-sm text-gray-500">
                          {selectedYearEndReview.potential_rating === 3 && 'Ready for promotion within 1-2 years, demonstrates leadership capabilities'}
                          {selectedYearEndReview.potential_rating === 2 && 'Growing in role, may be ready for advancement with development'}
                          {selectedYearEndReview.potential_rating === 1 && 'Performing in current role, focus on current responsibilities'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}



              {/* Manager's Overall Feedback */}
              {selectedYearEndReview.overall_comments && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Manager's Overall Feedback
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap">{selectedYearEndReview.overall_comments}</p>
                  </CardContent>
                </Card>
              )}

<Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-normal text-lg">
                    <Calculator className="h-5 w-5" />
                    Quarterly Manager Ratings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    {[
                      { label: 'Q1', rating: selectedYearEndReview.q1_rating },
                      { label: 'Q2', rating: selectedYearEndReview.q2_rating },
                      { label: 'Q3', rating: selectedYearEndReview.q3_rating },
                      { label: 'Q4', rating: selectedYearEndReview.q4_rating },
                    ].map((q) => (
                      <div key={q.label} className="p-4 rounded-lg bg-muted/50 text-center">
                        <div className="text-sm text-muted-foreground mb-1">{q.label}</div>
                        <div className="text-xl font-bold">
                          {q.rating !== null && q.rating !== undefined ? formatRating(q.rating) : '-'}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  
                  {/* Overall Year-End Rating */}
                </CardContent>
              </Card>

              {/* Development Recommendations */}
              {selectedYearEndReview.development_recommendations && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Development Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap">{selectedYearEndReview.development_recommendations}</p>
                  </CardContent>
                </Card>
              )}

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowYearEndReviewDialog(false);
                    setShowYearEndRejectDialog(true);
                  }}
                >
                  Reject
                </Button>
                <Button
                  onClick={() => {
                    setShowYearEndReviewDialog(false);
                    setShowYearEndApproveDialog(true);
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

      {/* Year-End Approve Confirmation Dialog */}
      <AlertDialog open={showYearEndApproveDialog} onOpenChange={setShowYearEndApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Year-End Review</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve this year-end review? Once approved, the ratings will be released to the employee.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedYearEndReview && handleApproveYearEndReview(selectedYearEndReview.id)}
            >
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Year-End Rejection Reason Dialog */}
      <Dialog open={showYearEndRejectDialog} onOpenChange={setShowYearEndRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Year-End Review</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this year-end review. It will be sent back to the manager.
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
              setShowYearEndRejectDialog(false);
              setRejectionReason('');
            }}>
              Cancel
            </Button>
            <Button onClick={handleRejectYearEndReview} disabled={!rejectionReason.trim() || saving !== null}>
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

              {/* Goal Ratings - Hierarchical Structure: KRAs -> KPIs */}
              {(rejectionKraRatings.length > 0 || rejectionGoalRatings.length > 0) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Goal Ratings (KRAs → KPIs)
                    </CardTitle>
                    <CardDescription>
                      Overall Rating = Goal Rating = Weighted Average of KRAs
                      <br />
                      KRA Rating = Weighted Average of KPIs
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {rejectionKraRatings.length > 0 ? (
                      rejectionKraRatings.map((kra) => (
                        <div key={kra.id} className="p-4 rounded-lg border-2 border-primary/20 bg-primary/5">
                          {/* KRA Header */}
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="default" className="bg-primary">KRA</Badge>
                                <span className="text-sm text-muted-foreground">Weight: {kra.weight}%</span>
                                {kra.calculated_rating !== null && (
                                  <span className="text-sm font-semibold text-primary">
                                    KRA Rating: {formatRating(kra.calculated_rating)}
                                  </span>
                                )}
                              </div>
                              <h4 className="font-semibold text-lg">{kra.title}</h4>
                              {kra.description && (
                                <p className="text-sm text-muted-foreground mt-1">{kra.description}</p>
                              )}
                            </div>
                          </div>

                          {/* KPIs under this KRA */}
                          {kra.kpis && kra.kpis.length > 0 ? (
                            <div className="space-y-3 mt-4 pl-4 border-l-2 border-primary/30">
                              <div className="text-xs font-medium text-muted-foreground mb-2">KPIs:</div>
                              {kra.kpis.map((kpi: any) => (
                                <div key={kpi.id} className="p-3 rounded-lg border bg-background">
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <Badge variant="outline">{kpi.goal_type?.toUpperCase() || 'KPI'}</Badge>
                                        <span className="text-xs text-muted-foreground">Weight: {kpi.weight}%</span>
                                      </div>
                                      <h5 className="font-medium text-sm">{kpi.title}</h5>
                                    </div>
                                  </div>
                                  
                                  <div className="grid gap-3 sm:grid-cols-2 mt-3">
                                    <div className="p-2 rounded bg-muted/30">
                                      <div className="text-xs text-muted-foreground mb-1">Employee Self Rating</div>
                                      <div className="font-medium text-sm">{kpi.self_rating || '-'}</div>
                                      {kpi.self_achievement && (
                                        <div className="text-xs text-muted-foreground mt-1">
                                          {kpi.self_achievement}
                                        </div>
                                      )}
                                    </div>
                                    <div className="p-2 rounded bg-primary/5">
                                      <div className="text-xs text-muted-foreground mb-1">Manager Rating</div>
                                      <div className="font-medium text-sm">{kpi.manager_rating ? formatRating(kpi.manager_rating) : '-'}</div>
                                    </div>
                                  </div>

                                  {kpi.manager_comments && (
                                    <div className="mt-2 p-2 rounded bg-muted/20">
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                        <MessageSquare className="h-3 w-3" />
                                        Manager Feedback
                                      </div>
                                      <p className="text-xs">{kpi.manager_comments}</p>
                                    </div>
                                  )}

                                  {/* Employee Evidence */}
                                  {kpi.self_evidence && (
                                    <div className="mt-2">
                                      <KPIEvidenceView
                                        evidence={kpi.self_evidence}
                                        goalId={kpi.id}
                                        employeeId={selectedRejection?.employee_id || ''}
                                        quarter={selectedRejection?.quarter || 1}
                                      />
                                    </div>
                                  )}

                                  {/* Manager Evidence */}
                                  {kpi.manager_evidence && kpi.manager_review_id && (
                                    <div className="mt-2">
                                      <ManagerEvidenceView
                                        evidence={kpi.manager_evidence}
                                        goalId={kpi.id}
                                        managerReviewId={kpi.manager_review_id}
                                      />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground mt-2 pl-4">No KPIs found for this KRA</div>
                          )}
                        </div>
                      ))
                    ) : (
                      // Fallback to flat structure if KRAs not available
                      rejectionGoalRatings.map((goal) => (
                        <div key={goal.id} className="p-4 rounded-lg border">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline">{goal.goal_type?.toUpperCase() || 'KPI'}</Badge>
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
                              <div className="font-medium">{goal.manager_rating ? formatRating(goal.manager_rating) : '-'}</div>
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

                          {/* Employee Evidence */}
                          {goal.self_evidence && (
                            <div className="mt-3">
                              <KPIEvidenceView
                                evidence={goal.self_evidence}
                                goalId={goal.id}
                                employeeId={selectedRejection?.employee_id || ''}
                                quarter={selectedRejection?.quarter || 1}
                              />
                            </div>
                          )}

                          {/* Manager Evidence */}
                          {goal.manager_evidence && goal.manager_review_id && (
                            <div className="mt-3">
                              <ManagerEvidenceView
                                evidence={goal.manager_evidence}
                                goalId={goal.id}
                                managerReviewId={goal.manager_review_id}
                              />
                            </div>
                          )}
                        </div>
                      ))
                    )}
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
                      setRejectionKraRatings([]);
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
