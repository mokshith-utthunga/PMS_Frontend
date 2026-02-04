// Admin Employee Evaluation Page - HR/Admin can do self-evaluation on behalf of employee
// Similar to Evaluations.tsx but uses admin override endpoints
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Save, Send, Target, AlertCircle, ChevronRight, Calendar, ArrowLeft, Star } from 'lucide-react';
import { PageLoader } from '@/loaders';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveCycle } from '@/contexts/ActiveCycleContext';
import { employeeService, goalsService, evaluationService, settingsService, cycleService } from '@/services';
import { getPeriodLabel, getPeriodBadgeVariant, formatPeriodDateRange } from '@/utils/periodHelpers';
import { useTransition } from '@/hooks';
import { 
  hasQuarterStarted, 
  hasQuarterEnded, 
  formatDateShort,
  getQuarterEndDateFromCycle,
  type CycleWithQuarterDates
} from '@/utils/quarterHelpers';
import { calculateAllKRARatings, calculateQuarterRating, type KPIForCalculation } from '@/lib/ratingCalculations';
import { calculateRatingFromCalibration } from '@/components/evaluation/CalibrationDisplay';
import type { Goal, Employee, KRA, RatingScale } from '@/types';
import { QuarterAlerts } from '@/components/evaluation/QuarterAlerts';
import { KRAEvaluationCard } from '@/components/evaluation/KRAEvaluationCard';
import { OverallAssessmentTab } from '@/components/evaluation/OverallAssessmentTab';
import { useToast } from '@/hooks/use-toast';
import type { QuarterlySelfReviewData, GoalSelfRatingData } from '@/services/evaluation.service';
import type { QuarterlyCycle } from '@/services/cycle.service';
import { parseNumericTarget } from '@/components/evaluation/AchievementSlider';

interface KpiRating {
  goal_id: string;
  achievement?: string;
  self_rating: number | null;
  achieved_value?: number | null;
  target_value?: number | null;
  evidence?: string;
}

export default function AdminEmployeeEvaluation() {
  const { id: employeeId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, hasAnyRole } = useAuth();
  const { toast } = useToast();
  const { activeCycle } = useActiveCycle();

  const isAdmin = hasAnyRole(['hr_admin', 'system_admin']);

  // Get quarter from URL
  const quarterParam = searchParams.get('quarter');
  const selectedQuarter = quarterParam ? parseInt(quarterParam) : 1;

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [quarterlyCycles, setQuarterlyCycles] = useState<QuarterlyCycle[]>([]);
  const [ratingScales, setRatingScales] = useState<RatingScale[]>([]);
  const [quarterKras, setQuarterKras] = useState<Record<number, KRA[]>>({});
  const [quarterKpis, setQuarterKpis] = useState<Record<number, Goal[]>>({});
  const [quarterlyReviews, setQuarterlyReviews] = useState<Record<number, QuarterlySelfReviewData | null>>({});
  const [kpiRatings, setKpiRatings] = useState<Record<number, Record<string, KpiRating>>>({});
  const [overallComments, setOverallComments] = useState('');
  const [evaluationTab, setEvaluationTab] = useState<Record<number, string>>({});

  // Fetch transition data
  const { transition, loading: transitionLoading } = useTransition({
    employeeId: employeeId || undefined,
    cycleId: activeCycle?.id,
    quarter: selectedQuarter,
    enabled: !!employeeId && !!activeCycle,
  });

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

  // Fetch evaluation data
  const fetchData = useCallback(async () => {
    if (!employeeId || !activeCycle) return;

    setLoading(true);
    try {
      const cycleId = activeCycle.id;

      // Fetch all data in parallel
      const [scalesResult, selfReviewsResult, quarterlyCyclesResult] = await Promise.all([
        settingsService.ratingScales.getDefault(),
        evaluationService.selfReviews.get(employeeId, cycleId),
        cycleService.getQuarterlyCycles(cycleId),
      ]);

      const ratingScalesData = (scalesResult.data || []).sort((a, b) => b.value - a.value);
      setRatingScales(ratingScalesData);
      setQuarterlyCycles(quarterlyCyclesResult.data || []);

      // Fetch goals for all 4 quarters
      const quarterPromises = [1, 2, 3, 4].map(async (q) => {
        const [krasResult, kpisResult] = await Promise.all([
          goalsService.kras.getByEmployee(employeeId, cycleId, undefined, q),
          goalsService.kpis.getByEmployee(employeeId, cycleId, undefined, q),
        ]);
        const filteredKras = (krasResult.data || []).filter((kra: KRA) => 
          kra.status === 'approved' || kra.status === 'locked'
        );
        const filteredKpis = (kpisResult.data || []).filter((g: Goal) => 
          g.kra_id && (g.status === 'approved' || g.status === 'locked')
        ) as Goal[];
        return {
          quarter: q,
          kras: filteredKras,
          kpis: filteredKpis,
        };
      });

      const quarterResults = await Promise.all(quarterPromises);

      // Build quarter-specific maps
      const quarterKrasMap: Record<number, KRA[]> = {};
      const quarterKpisMap: Record<number, Goal[]> = {};

      quarterResults.forEach(({ quarter, kras, kpis }) => {
        quarterKrasMap[quarter] = kras;
        quarterKpisMap[quarter] = kpis;
      });

      setQuarterKras(quarterKrasMap);
      setQuarterKpis(quarterKpisMap);

      // Process quarterly self reviews
      const reviewsMap: Record<number, QuarterlySelfReviewData | null> = {
        1: null, 2: null, 3: null, 4: null
      };

      (selfReviewsResult.data || []).forEach((review: QuarterlySelfReviewData) => {
        if (review.quarter) {
          const q = review.quarter;
          if (!reviewsMap[q] || review.admin_override) {
            reviewsMap[q] = review;
          }
        }
      });

      setQuarterlyReviews(reviewsMap);

      // Fetch goal self ratings
      const ratingsMap: Record<number, Record<string, KpiRating>> = {};
      
      for (const [quarter, review] of Object.entries(reviewsMap)) {
        const q = parseInt(quarter);
        const quarterRatings: Record<string, KpiRating> = {};
        const qKpis = quarterKpisMap[q] || [];

        if (review?.id) {
          const ratingsResult = await evaluationService.goalSelfRatings.get(review.id);
          
          (ratingsResult.data || []).forEach((r: GoalSelfRatingData) => {
            quarterRatings[r.goal_id] = {
              goal_id: r.goal_id,
              achievement: r.achievement || '',
              self_rating: r.self_rating || null,
              achieved_value: r.achieved_value,
              target_value: r.target_value,
              evidence: r.evidence || '',
            };
          });
        }

        // Initialize missing goals
        qKpis.forEach((g: Goal) => {
          if (!quarterRatings[g.id]) {
            const numericTarget = parseNumericTarget(g.target_value);
            quarterRatings[g.id] = {
              goal_id: g.id,
              achievement: '',
              self_rating: null,
              achieved_value: null,
              target_value: numericTarget,
              evidence: '',
            };
          }
        });

        ratingsMap[q] = quarterRatings;
      }

      setKpiRatings(ratingsMap);

      // Set overall comments for selected quarter
      const selectedReview = reviewsMap[selectedQuarter];
      if (selectedReview) {
        setOverallComments(selectedReview.overall_comments || '');
      }

    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load evaluation data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [employeeId, activeCycle, selectedQuarter, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle KPI rating change
  const handleKpiRatingChange = useCallback(
    (goalId: string, field: keyof KpiRating, value: unknown) => {
      setKpiRatings(prev => ({
        ...prev,
        [selectedQuarter]: {
          ...prev[selectedQuarter],
          [goalId]: {
            ...prev[selectedQuarter]?.[goalId],
            [field]: value,
          },
        },
      }));
    },
    [selectedQuarter]
  );

  // Calculate overall rating
  const calculateOverallRatingForQuarter = useCallback((quarterNum: number) => {
    const qKras = quarterKras[quarterNum] || [];
    const qKpis = quarterKpis[quarterNum] || [];
    const qKpiRatings = kpiRatings[quarterNum] || {};

    const qKpisWithKra: KPIForCalculation[] = qKpis
      .filter((kpi): kpi is Goal & { kra_id: string } => !!kpi.kra_id)
      .map(kpi => ({
        id: kpi.id,
        kra_id: kpi.kra_id,
        weight: kpi.weight,
      }));

    const qKpiRatingsForCalc: Record<string, number | null> = {};
    qKpis.forEach(kpi => {
      const achievedValue = qKpiRatings[kpi.id]?.achieved_value;
      if (kpi.calibration && kpi.calibration.length > 0 && achievedValue !== null && achievedValue !== undefined) {
        qKpiRatingsForCalc[kpi.id] = calculateRatingFromCalibration(achievedValue, kpi.calibration);
      } else {
        qKpiRatingsForCalc[kpi.id] = qKpiRatings[kpi.id]?.self_rating || null;
      }
    });

    const qKraRatings = calculateAllKRARatings(qKras, qKpisWithKra, qKpiRatingsForCalc);
    return calculateQuarterRating(qKras, qKraRatings);
  }, [quarterKras, quarterKpis, kpiRatings]);

  // Save progress (admin override)
  const handleSave = useCallback(async () => {
    if (!employeeId || !activeCycle) return;

    setSaving(true);
    try {
      const calculatedRating = calculateOverallRatingForQuarter(selectedQuarter);
      const currentRatings = kpiRatings[selectedQuarter] || {};

      // Use admin override endpoint
      await employeeService.admin.overrideSelfReview(employeeId, {
        cycle_id: activeCycle.id,
        quarter: selectedQuarter,
        overall_rating: calculatedRating ?? undefined,
        overall_comments: overallComments,
        status: quarterlyReviews[selectedQuarter]?.status === 'submitted' ? 'submitted' : 'in_progress',
        goal_ratings: Object.values(currentRatings).map(rating => ({
          goal_id: rating.goal_id,
          achievement: rating.achievement,
          self_rating: rating.self_rating,
          evidence: rating.evidence,
          achieved_value: rating.achieved_value,
          target_value: rating.target_value,
        })),
      });

      toast({
        title: 'Success',
        description: 'Self evaluation saved successfully',
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save evaluation',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [employeeId, activeCycle, selectedQuarter, overallComments, kpiRatings, quarterlyReviews, calculateOverallRatingForQuarter, fetchData, toast]);

  // Submit evaluation (admin override)
  const handleSubmit = useCallback(async () => {
    if (!employeeId || !activeCycle) return;

    setSaving(true);
    try {
      const calculatedRating = calculateOverallRatingForQuarter(selectedQuarter);
      const currentRatings = kpiRatings[selectedQuarter] || {};

      // Use admin override endpoint with submitted status
      await employeeService.admin.overrideSelfReview(employeeId, {
        cycle_id: activeCycle.id,
        quarter: selectedQuarter,
        overall_rating: calculatedRating ?? undefined,
        overall_comments: overallComments,
        status: 'submitted',
        goal_ratings: Object.values(currentRatings).map(rating => ({
          goal_id: rating.goal_id,
          achievement: rating.achievement,
          self_rating: rating.self_rating,
          evidence: rating.evidence,
          achieved_value: rating.achieved_value,
          target_value: rating.target_value,
        })),
      });

      toast({
        title: 'Success',
        description: 'Self evaluation submitted successfully',
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit evaluation',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [employeeId, activeCycle, selectedQuarter, overallComments, kpiRatings, quarterlyReviews, calculateOverallRatingForQuarter, fetchData, toast]);

  // Update overall comments when quarter changes
  useEffect(() => {
    const review = quarterlyReviews[selectedQuarter];
    if (review) {
      setOverallComments(review.overall_comments || '');
    } else {
      setOverallComments('');
    }

    setEvaluationTab(prev => {
      if (!prev[selectedQuarter]) {
        return { ...prev, [selectedQuarter]: 'goals' };
      }
      return prev;
    });
  }, [selectedQuarter, quarterlyReviews]);

  // Handle quarter change
  const handleQuarterChange = useCallback((quarter: number) => {
    setSearchParams({ quarter: quarter.toString() });
  }, [setSearchParams]);

  if (loading) {
    return (
      <MainLayout>
        <PageLoader />
      </MainLayout>
    );
  }

  if (!activeCycle) {
    return (
      <MainLayout>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>No active performance cycle. Please contact HR.</AlertDescription>
        </Alert>
      </MainLayout>
    );
  }

  // Render quarter content
  const renderQuarterContent = (quarterNum: number) => {
    const qKras = quarterKras[quarterNum] || [];
    const qKpis = quarterKpis[quarterNum] || [];
    const qHasGoals = qKras.length > 0 && qKpis.length > 0;
    const qReview = quarterlyReviews[quarterNum];
    const qIsSubmitted = qReview?.status === 'submitted';
    const qKpiRatings = kpiRatings[quarterNum] || {};

    // Admin can always edit (override)
    const qCanEdit = true;

    if (!qHasGoals) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg">No Goals Found for Q{quarterNum}</h3>
            <p className="text-muted-foreground text-center mt-2">
              This employee has not created goals for Q{quarterNum} yet.
            </p>
          </CardContent>
        </Card>
      );
    }

    const qKpisWithKra: KPIForCalculation[] = qKpis
      .filter((kpi): kpi is Goal & { kra_id: string } => !!kpi.kra_id)
      .map(kpi => ({
        id: kpi.id,
        kra_id: kpi.kra_id,
        weight: kpi.weight,
      }));

    const qKpiRatingsForCalc: Record<string, number | null> = {};
    qKpis.forEach(kpi => {
      const achievedValue = qKpiRatings[kpi.id]?.achieved_value;
      if (kpi.calibration && kpi.calibration.length > 0 && achievedValue !== null && achievedValue !== undefined) {
        qKpiRatingsForCalc[kpi.id] = calculateRatingFromCalibration(achievedValue, kpi.calibration);
      } else {
        qKpiRatingsForCalc[kpi.id] = qKpiRatings[kpi.id]?.self_rating || null;
      }
    });

    const qKraRatings = calculateAllKRARatings(qKras, qKpisWithKra, qKpiRatingsForCalc);
    const qOverallCalc = calculateQuarterRating(qKras, qKraRatings);

    return (
      <>
        {/* Admin Override Alert */}
        <Alert className="border-amber-200 bg-amber-50">
          <Star className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <span className="font-semibold">Admin Override Mode:</span> You are performing self-evaluation on behalf of this employee. All changes will be marked as admin override.
          </AlertDescription>
        </Alert>

        <QuarterAlerts
          quarter={quarterNum}
          cycle={activeCycle}
          quarterlyCycles={quarterlyCycles}
          isSubmitted={qIsSubmitted}
        />

        <Tabs 
          value={evaluationTab[quarterNum] || 'goals'} 
          onValueChange={(value) => setEvaluationTab(prev => ({ ...prev, [quarterNum]: value }))}
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="goals">KRA/KPI Ratings ({qKpis.length})</TabsTrigger>
            <TabsTrigger value="overall">Overall Assessment</TabsTrigger>
          </TabsList>

          <TabsContent value="goals" className="space-y-6">
            {qKras.map(kra => (
              <KRAEvaluationCard
                key={kra.id}
                kra={kra}
                kpis={qKpis.filter(kpi => kpi.kra_id === kra.id)}
                goalRatings={qKpiRatings}
                kraRating={qKraRatings[kra.id]}
                ratingScales={ratingScales}
                canEdit={qCanEdit}
                onRatingChange={handleKpiRatingChange}
              />
            ))}

            {qCanEdit && (
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={handleSave} 
                  disabled={saving}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </Button>
                <Button 
                  onClick={() => {
                    setEvaluationTab(prev => ({ ...prev, [quarterNum]: 'overall' }));
                  }}
                  disabled={saving}
                >
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="overall" className="space-y-4">
            <OverallAssessmentTab
              quarter={quarterNum}
              calculatedRating={qOverallCalc}
              overallComments={quarterNum === selectedQuarter ? overallComments : ''}
              canEdit={qCanEdit}
              onCommentsChange={setOverallComments}
            />
            
            {qCanEdit && (
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={handleSave} 
                  disabled={saving}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={saving}
                  className="bg-blue-600 text-white hover:bg-blue-700/90"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Submit
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/employee/${employeeId}`)} aria-label="Back to employee view">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">Self Evaluation</h1>
            {employee && (
              <p className="text-muted-foreground">
                {employee.full_name} ({employee.emp_code || employee.emp_id}) • {activeCycle.name}
              </p>
            )}
          </div>
        </div>

        {/* Quarter Tabs */}
        <Tabs 
          value={String(selectedQuarter)} 
          onValueChange={(value) => handleQuarterChange(parseInt(value))}
          className="space-y-4"
        >
          <TabsList className="grid w-full grid-cols-4">
            {[1, 2, 3, 4].map(quarter => (
              <TabsTrigger 
                key={quarter} 
                value={String(quarter)}
                aria-label={`Select quarter ${quarter}`}
              >
                Q{quarter}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Quarter Content */}
          {[1, 2, 3, 4].map(quarterNum => (
            <TabsContent key={quarterNum} value={String(quarterNum)} className="space-y-4">
              {renderQuarterContent(quarterNum)}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </MainLayout>
  );
}
