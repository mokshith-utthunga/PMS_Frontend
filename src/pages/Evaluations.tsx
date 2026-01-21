// Evaluations Page - Quarterly Self Evaluation
// Uses quarterly_self_reviews and quarterly_kpi_progress tables
import { useState, useEffect, useMemo, useCallback } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Save, Send, Target, AlertCircle, ChevronRight } from 'lucide-react';
import { PageLoader } from '@/loaders';
import { useAuth } from '@/contexts/AuthContext';
import { useEvaluationsData, useEvaluationOperations, type KpiRating } from '@/hooks';
import { isQuarterOpen } from '@/utils/quarterUtils';
import { calculateAllKRARatings, calculateQuarterRating, type KPIForCalculation } from '@/lib/ratingCalculations';
import type { Goal } from '@/types';
import { QuarterTabs } from '@/components/evaluation/QuarterTabs';
import { QuarterAlerts } from '@/components/evaluation/QuarterAlerts';
import { KRAEvaluationCard } from '@/components/evaluation/KRAEvaluationCard';
import { OverallAssessmentTab } from '@/components/evaluation/OverallAssessmentTab';

export default function Evaluations() {
  const { user, hasAnyRole } = useAuth();
  const isHR = hasAnyRole(['hr_admin', 'hrbp', 'system_admin']);

  // Fetch evaluations data
  const evalData = useEvaluationsData(user?.id);
  const {
    employeeId, activeCycle, kras, kpis, ratingScales,
    quarterlyReviews: initialQuarterlyReviews,
    kpiRatings: initialKpiRatings,
    currentQuarter, loading, refetch,
  } = evalData;

  // Local state for form data
  const [selectedQuarter, setSelectedQuarter] = useState<string>('1');
  const [quarterlyReviews, setQuarterlyReviews] = useState(initialQuarterlyReviews);
  const [kpiRatings, setKpiRatings] = useState(initialKpiRatings);
  const [overallComments, setOverallComments] = useState('');
  const [overallRating, setOverallRating] = useState<number | undefined>(undefined);
  const [evaluationTab, setEvaluationTab] = useState<Record<number, string>>({});

  // Sync initial data
  useEffect(() => {
    setQuarterlyReviews(initialQuarterlyReviews);
    setKpiRatings(initialKpiRatings);
  }, [initialQuarterlyReviews, initialKpiRatings]);

  // Set initial quarter
  useEffect(() => {
    if (activeCycle) {
      for (let q = 1; q <= 4; q++) {
        if (isQuarterOpen(activeCycle, q)) {
          setSelectedQuarter(String(q));
          return;
        }
      }
      setSelectedQuarter(String(currentQuarter));
    }
  }, [activeCycle, currentQuarter]);

  // Update form when quarter changes
  useEffect(() => {
    const q = parseInt(selectedQuarter);
    const review = quarterlyReviews[q];
    if (review) {
      setOverallComments(review.overall_comments || '');
      setOverallRating(review.overall_rating);
    } else {
      setOverallComments('');
      setOverallRating(undefined);
    }
    // Initialize tab state for quarter if not set
    setEvaluationTab(prev => {
      if (!prev[q]) {
        return { ...prev, [q]: 'goals' };
      }
      return prev;
    });
  }, [selectedQuarter, quarterlyReviews]);

  // Evaluation operations
  const evalOps = useEvaluationOperations({
    employeeId,
    cycleId: activeCycle?.id || null,
    quarterlyReviews,
    kpiRatings,
    kpis,
    onSuccess: refetch,
  });

  // Calculate ratings
  const calculatedRatings = useMemo(() => {
    const q = parseInt(selectedQuarter);
    const currentRatings = kpiRatings[q] || {};
    const kpiRatingsForCalc: Record<string, number | null> = {};
    // Filter KPIs that have kra_id (required for calculation) and map to KPIForCalculation
    const kpisWithKra: KPIForCalculation[] = kpis
      .filter((kpi): kpi is Goal & { kra_id: string } => !!kpi.kra_id)
      .map(kpi => ({
        id: kpi.id,
        kra_id: kpi.kra_id,
        weight: kpi.weight,
      }));
    kpisWithKra.forEach(kpi => {
      kpiRatingsForCalc[kpi.id] = currentRatings[kpi.id]?.self_rating || null;
    });
    const kraRatings = calculateAllKRARatings(kras, kpisWithKra, kpiRatingsForCalc);
    const overallCalc = calculateQuarterRating(kras, kraRatings);
    return { kraRatings, overallCalc };
  }, [selectedQuarter, kpiRatings, kras, kpis]);

  // Handlers
  const getKPIsForKRA = useCallback(
    (kraId: string) => kpis.filter(kpi => kpi.kra_id === kraId),
    [kpis]
  );

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

  const handleSave = useCallback(() => {
    const q = parseInt(selectedQuarter);
    evalOps.saveProgress(q, overallComments, overallRating, setQuarterlyReviews);
  }, [selectedQuarter, overallComments, overallRating, evalOps]);

  const handleSubmit = useCallback(() => {
    const q = parseInt(selectedQuarter);
    evalOps.submitEvaluation(q, overallComments, overallRating, setQuarterlyReviews);
  }, [selectedQuarter, overallComments, overallRating, evalOps]);

  const handleNext = useCallback(async () => {
    const q = parseInt(selectedQuarter);
    // Save current progress before navigating to ensure data persistence
    await evalOps.saveProgress(q, overallComments, overallRating, setQuarterlyReviews);
    // Navigate to overall assessment tab
    setEvaluationTab(prev => ({ ...prev, [q]: 'overall' }));
  }, [selectedQuarter, overallComments, overallRating, evalOps]);

  const handleTabChange = useCallback((quarter: number, value: string) => {
    setEvaluationTab(prev => ({ ...prev, [quarter]: value }));
  }, []);

  // Computed values
  const q = parseInt(selectedQuarter);
  const currentReview = quarterlyReviews[q];
  const isSubmitted = currentReview?.status === 'submitted';
  const isOpen = isQuarterOpen(activeCycle, q);
  const canEdit = isOpen && !isSubmitted;
  const currentKpiRatings = kpiRatings[q] || {};

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

  // No approved KRAs/KPIs
  if (kras.length === 0 || kpis.length === 0) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Self Evaluation</h1>
            <p className="text-muted-foreground">{activeCycle.name}</p>
          </div>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Target className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg">No approved KRAs/KPIs</h3>
              <p className="text-muted-foreground">
                Your KRAs and KPIs must be approved before you can start self evaluation
              </p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Self Evaluation</h1>
          <p className="text-muted-foreground">{activeCycle.name}</p>
        </div>

        {/* Quarter Tabs */}
        <QuarterTabs
          selectedQuarter={selectedQuarter}
          onQuarterChange={setSelectedQuarter}
          cycle={activeCycle}
          quarterlyEvaluations={Object.fromEntries(
            Object.entries(quarterlyReviews).map(([q, review]) => [
              q,
              review ? { status: review.status || 'in_progress' } : undefined
            ])
          )}
        >
          {[1, 2, 3, 4].map(quarter => (
            <TabsContent key={quarter} value={String(quarter)} className="space-y-4">
              <QuarterAlerts
                quarter={quarter}
                cycle={activeCycle}
                isSubmitted={quarter === q && isSubmitted}
              />

              <Tabs 
                value={evaluationTab[quarter] || 'goals'} 
                onValueChange={(value) => handleTabChange(quarter, value)}
                className="space-y-4"
              >
                <TabsList>
                  <TabsTrigger value="goals">KRA/KPI Ratings ({kpis.length})</TabsTrigger>
                  <TabsTrigger value="overall">Overall Assessment</TabsTrigger>
                </TabsList>

                <TabsContent value="goals" className="space-y-6">
                  {kras.map(kra => (
                    <KRAEvaluationCard
                      key={kra.id}
                      kra={kra}
                      kpis={getKPIsForKRA(kra.id)}
                      goalRatings={currentKpiRatings}
                      kraRating={calculatedRatings.kraRatings[kra.id]}
                      ratingScales={ratingScales}
                      canEdit={quarter === q && canEdit}
                      onRatingChange={handleKpiRatingChange}
                    />
                  ))}
                  
                  {/* Action Buttons for KRA/KPI Ratings Tab */}
                  {quarter === q && canEdit && (
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
                    quarter={quarter}
                    calculatedRating={quarter === q ? calculatedRatings.overallCalc : null}
                    overallRating={overallRating}
                    overallComments={overallComments}
                    canEdit={quarter === q && canEdit}
                    onRatingChange={setOverallRating}
                    onCommentsChange={setOverallComments}
                  />
                  
                  {/* Action Buttons for Overall Assessment Tab */}
                  {quarter === q && canEdit && (
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
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Submit
                      </Button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </TabsContent>
          ))}
        </QuarterTabs>
      </div>
    </MainLayout>
  );
}
