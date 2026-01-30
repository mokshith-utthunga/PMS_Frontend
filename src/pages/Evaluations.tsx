// Evaluations Page - Quarterly Self Evaluation
// Uses quarterly_self_reviews and quarterly_kpi_progress tables
import { useState, useEffect, useMemo, useCallback } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Save, Send, Target, AlertCircle, ChevronRight, Calendar, AlertTriangle } from 'lucide-react';
import { PageLoader } from '@/loaders';
import { useAuth } from '@/contexts/AuthContext';
import { useEvaluationsData, useEvaluationOperations, type KpiRating } from '@/hooks';
import { useQuarterFromUrl } from '@/hooks/useQuarterFromUrl';
import { isQuarterOpen, getQuarterTiming, formatQuarterDates } from '@/utils/quarterUtils';
import { 
  hasQuarterStarted, 
  hasQuarterEnded, 
  canWorkOnQuarter,
  formatDateShort,
  getQuarterEndDateFromCycle,
  type CycleWithQuarterDates
} from '@/utils/quarterHelpers';
import { calculateAllKRARatings, calculateQuarterRating, type KPIForCalculation } from '@/lib/ratingCalculations';
import { calculateRatingFromCalibration } from '@/components/evaluation/CalibrationDisplay';
import type { Goal } from '@/types';
import { QuarterTabs } from '@/components/evaluation/QuarterTabs';
import { QuarterAlerts } from '@/components/evaluation/QuarterAlerts';
import { KRAEvaluationCard } from '@/components/evaluation/KRAEvaluationCard';
import { OverallAssessmentTab } from '@/components/evaluation/OverallAssessmentTab';
import PeriodClose from '@/components/evaluation/PeriodClose';

export default function Evaluations() {
  const { user, hasAnyRole } = useAuth();
  const isHR = hasAnyRole(['hr_admin', 'hrbp', 'system_admin']);

  // URL-based quarter handling
  const { quarter, setQuarter, isValidQuarter } = useQuarterFromUrl();

  // Local state for form data - sync with URL quarter
  const [selectedQuarter, setSelectedQuarter] = useState<string>(quarter ? String(quarter) : '1');

  // Fetch evaluations data with selected quarter
  const evalData = useEvaluationsData(user?.id, parseInt(selectedQuarter));
  const {
    employeeId, activeCycle, quarterlyCycles, ratingScales,
    quarterlyReviews: initialQuarterlyReviews,
    kpiRatings: initialKpiRatings,
    currentQuarter, loading, refetch,
    quarterKras, quarterKpis,
    latePermissions,
  } = evalData;
  
  // Sync selectedQuarter with URL quarter
  useEffect(() => {
    if (quarter) {
      setSelectedQuarter(String(quarter));
    } else if (currentQuarter) {
      setSelectedQuarter(String(currentQuarter));
      setQuarter(currentQuarter as 1 | 2 | 3 | 4);
    }
  }, [quarter, currentQuarter, setQuarter]);
  const [quarterlyReviews, setQuarterlyReviews] = useState(initialQuarterlyReviews);
  const [kpiRatings, setKpiRatings] = useState(initialKpiRatings);
  const [overallComments, setOverallComments] = useState('');
  const [evaluationTab, setEvaluationTab] = useState<Record<number, string>>({});

  useEffect(() => {
    setQuarterlyReviews(initialQuarterlyReviews);
    setKpiRatings(initialKpiRatings);
  }, [initialQuarterlyReviews, initialKpiRatings]);

  useEffect(() => {
    if (activeCycle && !isValidQuarter) {
      for (let q = 1; q <= 4; q++) {
        // Only select quarters that are current or past (not future)
        const timing = getQuarterTiming(activeCycle, q, quarterlyCycles);
        if (timing !== 'future' && isQuarterOpen(activeCycle, q, quarterlyCycles)) {
          setSelectedQuarter(String(q));
          setQuarter(q as 1 | 2 | 3 | 4);
          return;
        }
      }
      if (currentQuarter) {
        const timing = getQuarterTiming(activeCycle, currentQuarter, quarterlyCycles);
        if (timing !== 'future') {
          setSelectedQuarter(String(currentQuarter));
          setQuarter(currentQuarter as 1 | 2 | 3 | 4);
        } else {
          // Find the latest non-future quarter
          for (let q = 4; q >= 1; q--) {
            const t = getQuarterTiming(activeCycle, q, quarterlyCycles);
            if (t !== 'future') {
              setSelectedQuarter(String(q));
              setQuarter(q as 1 | 2 | 3 | 4);
              return;
            }
          }
        }
      }
    }
  }, [activeCycle, currentQuarter, isValidQuarter, setQuarter, quarterlyCycles]);

  useEffect(() => {
    const q = parseInt(selectedQuarter);
    if (q >= 1 && q <= 4) {
      setQuarter(q as 1 | 2 | 3 | 4);
    }
    const review = quarterlyReviews[q];
    if (review) {
      setOverallComments(review.overall_comments || '');
    } else {
      setOverallComments('');
    }

    setEvaluationTab(prev => {
      if (!prev[q]) {
        return { ...prev, [q]: 'goals' };
      }
      return prev;
    });
  }, [selectedQuarter, quarterlyReviews, setQuarter]);

  const currentQuarterKpis = useMemo(() => {
    return quarterKpis[parseInt(selectedQuarter)] || [];
  }, [quarterKpis, selectedQuarter]);

  const evalOps = useEvaluationOperations({
    employeeId,
    cycleId: activeCycle?.id || null,
    quarterlyReviews,
    kpiRatings,
    kpis: currentQuarterKpis,
    onSuccess: refetch,
  });


  const handleKpiRatingChange = useCallback(
    (goalId: string, field: keyof KpiRating, value: unknown) => {
      const q = parseInt(selectedQuarter);
      setKpiRatings(prev => ({
        ...prev,
        [q]: {
          ...prev[q],
          [goalId]: {
            ...prev[q]?.[goalId],
            [field]: value,
          },
        },
      }));
    },
    [selectedQuarter]
  );

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

  const handleSave = useCallback(() => {
    const q = parseInt(selectedQuarter);
    const calculatedRating = calculateOverallRatingForQuarter(q);
    evalOps.saveProgress(q, overallComments, calculatedRating ?? undefined, setQuarterlyReviews);
  }, [selectedQuarter, overallComments, evalOps, calculateOverallRatingForQuarter]);

  const handleSubmit = useCallback(() => {
    const q = parseInt(selectedQuarter);
    const calculatedRating = calculateOverallRatingForQuarter(q);
    evalOps.submitEvaluation(q, overallComments, calculatedRating ?? undefined, setQuarterlyReviews);
  }, [selectedQuarter, overallComments, evalOps, calculateOverallRatingForQuarter]);

  const handleNext = useCallback(async () => {
    const q = parseInt(selectedQuarter);
    const calculatedRating = calculateOverallRatingForQuarter(q);
    await evalOps.saveProgress(q, overallComments, calculatedRating ?? undefined, setQuarterlyReviews);
    setEvaluationTab(prev => ({ ...prev, [q]: 'overall' }));
  }, [selectedQuarter, overallComments, evalOps, calculateOverallRatingForQuarter]);

  const handleTabChange = useCallback((quarter: number, value: string) => {
    setEvaluationTab(prev => ({ ...prev, [quarter]: value }));
  }, []);

  // Computed values
  const q = parseInt(selectedQuarter);

  // Loading state
  if (loading) {
    return <MainLayout><PageLoader /></MainLayout>;
  }

  // No employee profile (non-HR)
  if (!employeeId && !isHR) {
    return (
      <MainLayout>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Your employee profile is not set up. Please contact HR.</AlertDescription>
        </Alert>
      </MainLayout>
    );
  }

  // HR user without profile
  if (!employeeId && isHR) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Self Evaluation</h1>
            <p className="text-muted-foreground">Employee self-evaluation portal</p>
          </div>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              As an HR user, you can view employee evaluations from the Reports page or Team page.
            </AlertDescription>
          </Alert>
        </div>
      </MainLayout>
    );
  }

  // No active cycle
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


  // Determine what content to render for the selected quarter
  const renderQuarterContent = (quarterNum: number) => {
    const qTiming = getQuarterTiming(activeCycle, quarterNum, quarterlyCycles);
    const qHasGoals = (quarterKras[quarterNum] || []).length > 0 && (quarterKpis[quarterNum] || []).length > 0;
    const qKras = quarterKras[quarterNum] || [];
    const qKpis = quarterKpis[quarterNum] || [];
    const qHasLatePermission = latePermissions[quarterNum] || false;
    const qEnded = hasQuarterEnded(activeCycle as CycleWithQuarterDates, quarterNum, quarterlyCycles);
    const qEndDate = getQuarterEndDateFromCycle(activeCycle as CycleWithQuarterDates, quarterNum, quarterlyCycles);

    // If quarter is in the future, show not accessible message
    if (qTiming === 'future') {
      const qDates = formatQuarterDates(activeCycle, quarterNum, quarterlyCycles);
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg">Q{quarterNum} Self-Review Period is Not Open Yet</h3>
            <p className="text-muted-foreground text-center mt-2">
              {qDates 
                ? `The Q${quarterNum} self-review period will open from ${qDates.start} to ${qDates.end}.`
                : `The Q${quarterNum} self-review period has not been scheduled yet.`
              }
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Please check back when the review period begins.
            </p>
          </CardContent>
        </Card>
      );
    }

    // If quarter has ended and no late permission, show message
    if (qEnded && !qHasLatePermission) {
      return <PeriodClose quarterNum={quarterNum} qEndDate={qEndDate} title="Self-Review" />
 
    }

    if (!qHasGoals) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg">Please Complete Your Goals for Q{quarterNum}</h3>
            <p className="text-muted-foreground text-center mt-2">
              You need to create and get approval for your Q{quarterNum} goals before starting self evaluation.
            </p>
            <Button 
              className="mt-4" 
              onClick={() => window.location.href = `/goals?quarter=q${quarterNum}`}
            >
              Go to Goals
            </Button>
          </CardContent>
        </Card>
      );
    }

    // Quarter has goals and is accessible (or has late permission) - show evaluation content
    const qIsOpen = isQuarterOpen(activeCycle, quarterNum, quarterlyCycles);
    const qReview = quarterlyReviews[quarterNum];
    const qIsSubmitted = qReview?.status === 'submitted';
    const qCanEdit = (qIsOpen || qHasLatePermission) && !qIsSubmitted;
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
    const qOverallCalc = calculateQuarterRating(qKras, qKraRatings);
    console.log('kras',qKras,'kpis',qKpis)
    return (
      <>
        <QuarterAlerts
          quarter={quarterNum}
          cycle={activeCycle}
          quarterlyCycles={quarterlyCycles}
          isSubmitted={qIsSubmitted}
        />

        {/* Late permission notice */}
        {qEnded && qHasLatePermission && !qIsSubmitted && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="py-3">
              <p className="text-sm text-amber-800">
                <AlertTriangle className="inline h-4 w-4 mr-2" />
                You have been granted late submission access for Q{quarterNum} by HR/Admin.
              </p>
            </CardContent>
          </Card>
        )}

        <Tabs 
          value={evaluationTab[quarterNum] || 'goals'} 
          onValueChange={(value) => handleTabChange(quarterNum, value)}
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
                  disabled={evalOps.saving}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </Button>
                <Button 
                  onClick={handleNext}
                  disabled={evalOps.saving}
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
              overallComments={quarterNum === q ? overallComments : ''}
              canEdit={qCanEdit}
              onCommentsChange={setOverallComments}
            />
            
            {/* Action Buttons for Overall Assessment Tab */}
            {qCanEdit && (
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={handleSave} 
                  disabled={evalOps.saving}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={evalOps.saving}
                  className="bg-blue-600 text-white hover:bg-blue-700/90"
                >
                  <Send className="mr-2 h-4 w-4 " />
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
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Self Evaluation</h1>
          <p className="text-muted-foreground">{activeCycle.name}</p>
        </div>

        <QuarterTabs
          selectedQuarter={selectedQuarter}
          onQuarterChange={(qStr) => {
            setSelectedQuarter(qStr);
            const quarterNum = parseInt(qStr);
            if (quarterNum >= 1 && quarterNum <= 4) {
              setQuarter(quarterNum as 1 | 2 | 3 | 4);
            }
          }}
          cycle={activeCycle}
          quarterlyCycles={quarterlyCycles}
          quarterlyEvaluations={Object.fromEntries(
            Object.entries(quarterlyReviews).map(([qKey, review]) => [
              qKey,
              review ? { status: review.status || 'in_progress' } : undefined
            ])
          )}
          restrictToOpenQuarters={true}
        >
          {[1, 2, 3, 4].map(quarterNum => (
            <TabsContent key={quarterNum} value={String(quarterNum)} className="space-y-4">
              {renderQuarterContent(quarterNum)}
            </TabsContent>
          ))}
        </QuarterTabs>
      </div>
    </MainLayout>
  );
}
