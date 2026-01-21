import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { employeeService, cycleService, goalsService, evaluationService, settingsService } from '@/services';
import { useAuth } from '@/contexts/AuthContext';
import {
  Loader2,
  AlertCircle,
  Save,
  Send,
  Star,
  ArrowLeft,
  User,
  ChevronDown,
  ChevronRight,
  Calculator,
  ClipboardCheck,
  CheckCircle2,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DualAchievementSlider, parseNumericTarget, calculateRatingFromAchievement } from '@/components/evaluation/AchievementSlider';
import { EvaluationPeriodTabs } from '@/components/evaluation/EvaluationPeriodTabs';
import { 
  calculateAllKRARatings, 
  calculateQuarterRating, 
  calculateYearEndRating, 
  formatRating,
} from '@/lib/ratingCalculations';
import {
  Quarter,
  getCurrentQuarter,
  getQuarterManagerReviewStatus,
  getYearEndManagerEvalStatus,
  PerformanceCycle,
} from '@/lib/evaluationPeriods';
import type { Employee } from '@/types';

// Helper function to get initials from employee name
const getEmployeeInitials = (employee: Employee): string => {
  if (employee.full_name) {
    const parts = employee.full_name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`;
    }
    return parts[0][0] || '';
  }
  return '??';
};

// Helper function to get display name
const getEmployeeDisplayName = (employee: Employee): string => {
  return employee.full_name || 'Unknown';
};

// Helper function to get first name only (for messages)
const getEmployeeFirstName = (employee: Employee): string => {
  if (employee.full_name) {
    return employee.full_name.trim().split(/\s+/)[0];
  }
  return 'Unknown';
};

interface KRADisplay {
  id: string;
  title: string;
  description?: string | null;
  weight: number;
}

interface KPIDisplay {
  id: string;
  kra_id: string;
  title: string;
  description?: string | null;
  weight: number;
  target_value?: string | null;
}

interface GoalSelfRating {
  goal_id: string;
  achievement: string | null;
  self_rating: number | null;
  evidence: string | null;
  achieved_value?: number | null;
  target_value?: number | null;
}

interface GoalManagerRating {
  goal_id: string;
  rating: number | null;
  comments: string;
  manager_achieved_value?: number | null;
  progress_percentage?: number | null;
}

interface RatingScaleDisplay {
  name: string;
  value: number;
  description: string | null;
  color: string | null;
}


interface QuarterlySelfEval {
  id: string;
  quarter: number;
  status: string;
  overall_rating: number | null;
  overall_comments: string | null;
  calculated_overall_rating: number | null;
}

export default function ManagerEvaluation() {
  const { employeeId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuarter = searchParams.get('quarter');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [managerId, setManagerId] = useState<string | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [activeCycle, setActiveCycle] = useState<PerformanceCycle | null>(null);
  const [kras, setKras] = useState<KRADisplay[]>([]);
  const [kpis, setKpis] = useState<KPIDisplay[]>([]);
  const [ratingScales, setRatingScales] = useState<RatingScaleDisplay[]>([]);
  
  const [quarterlySelfEvals, setQuarterlySelfEvals] = useState<Record<number, QuarterlySelfEval>>({});
  const [quarterlyGoalSelfRatings, setQuarterlyGoalSelfRatings] = useState<Record<number, Record<string, GoalSelfRating>>>({});
  
  const [selfEvaluation, setSelfEvaluation] = useState<any>(null);
  const [goalSelfRatings, setGoalSelfRatings] = useState<Record<string, GoalSelfRating>>({});
  
  const [managerEvaluation, setManagerEvaluation] = useState<any>(null);
  const [yearEndManagerEvaluation, setYearEndManagerEvaluation] = useState<any>(null);
  const [goalManagerRatings, setGoalManagerRatings] = useState<Record<string, GoalManagerRating>>({});
  const [overallRating, setOverallRating] = useState<number | null>(null);
  const [potentialRating, setPotentialRating] = useState<number | null>(null);
  const [overallComments, setOverallComments] = useState('');
  const [yearEndOverallComments, setYearEndOverallComments] = useState('');
  const [developmentRecommendations, setDevelopmentRecommendations] = useState('');
  const [expandedKRAs, setExpandedKRAs] = useState<Set<string>>(new Set());
  const [quarterlyRatings, setQuarterlyRatings] = useState<{
    q1: number | null;
    q2: number | null;
    q3: number | null;
    q4: number | null;
  }>({ q1: null, q2: null, q3: null, q4: null });
  
  // Evaluation mode: 'quarterly' or 'year-end'
  const [evaluationMode, setEvaluationMode] = useState<'quarterly' | 'year-end'>('quarterly');
  const [selectedQuarter, setSelectedQuarter] = useState<Quarter>(1);
  const [evaluationTab, setEvaluationTab] = useState<string>('goals');
  
  // Determine current quarter from cycle
  const currentQuarter = useMemo(() => {
    return getCurrentQuarter(activeCycle);
  }, [activeCycle]);

  // Initialize selected quarter based on URL or current quarter
  useEffect(() => {
    if (activeCycle) {
      if (initialQuarter && parseInt(initialQuarter) >= 1 && parseInt(initialQuarter) <= 4) {
        setSelectedQuarter(parseInt(initialQuarter) as Quarter);
        setEvaluationMode('quarterly');
      } else {
        setSelectedQuarter(currentQuarter);
        setEvaluationMode('quarterly');
      }
    }
  }, [activeCycle, initialQuarter, currentQuarter]);

  useEffect(() => {
    fetchData();
  }, [user, employeeId]);

  useEffect(() => {
    if (kras.length > 0) {
      setExpandedKRAs(new Set(kras.map((k) => k.id)));
    }
  }, [kras]);

  const fetchData = async () => {
    if (!user || !employeeId) return;

    try {
      // Fetch current manager's employee record
      const mgrResult = await employeeService.getMe();

      if (!mgrResult.data) {
        setLoading(false);
        return;
      }
      setManagerId(mgrResult.data.id);

      // Fetch the employee being evaluated
      const empResult = await employeeService.getById(employeeId);

      if (!empResult.data) {
        toast({ title: 'Employee not found', variant: 'destructive' });
        navigate('/team');
        setLoading(false);
        return;
      }

      // Check authorization: manager_code references emp_code, not id
      const employee = empResult.data as any;
      const managerCode = employee.manager_code;
      const managerEmpCode = mgrResult.data.emp_code;
      
      if (managerCode !== managerEmpCode) {
        toast({ title: 'Not authorized to evaluate this employee', variant: 'destructive' });
        navigate('/team');
        setLoading(false);
        return;
      }

      setEmployee(employee);

      // Fetch active cycle
      const cycleResult = await cycleService.getActive();

      if (!cycleResult.data) {
        setLoading(false);
        return;
      }
      setActiveCycle(cycleResult.data);

      // Fetch rating scales
      const scalesResult = await settingsService.ratingScales.getDefault();
      const scales = (scalesResult.data || []).map((s: any) => ({
        value: s.rating ?? s.value,
        name: s.label ?? s.name,
        description: s.description || null,
        color: s.color || null,
      }));
      setRatingScales(scales);

      // Fetch approved KRAs for this employee
      const krasResult = await goalsService.kras.getByEmployee(employeeId, cycleResult.data.id, 'approved');
      setKras((krasResult.data || []) as KRADisplay[]);

      // Fetch approved KPIs (goals with kra_id)
      const kpisResult = await goalsService.kpis.getByEmployee(employeeId, cycleResult.data.id, 'approved');
      const filteredKpis = (kpisResult.data || [])
        .filter((kpi: any) => kpi.kra_id)
        .map((kpi: any) => ({
          id: kpi.id,
          kra_id: kpi.kra_id as string,
          title: kpi.title,
          description: kpi.description,
          weight: kpi.weight,
          target_value: kpi.target_value,
        }));
      setKpis(filteredKpis);

      // Fetch quarterly self reviews (from quarterly_self_reviews table)
      const allQuarterlySelfResult = await evaluationService.selfReviews.get(employeeId, cycleResult.data.id);

      const qSelfEvalsMap: Record<number, QuarterlySelfEval> = {};
      (allQuarterlySelfResult.data || []).forEach((e: any) => {
        if (e.quarter) {
          qSelfEvalsMap[e.quarter] = {
            id: e.id,
            quarter: e.quarter,
            status: e.status,
            overall_rating: e.overall_rating ?? null,
            overall_comments: e.overall_comments,
            calculated_overall_rating: null, // Not stored in quarterly_self_reviews
          };
        }
      });
      setQuarterlySelfEvals(qSelfEvalsMap);

      // Fetch goal self ratings for each quarterly self review
      const qGoalRatingsMap: Record<number, Record<string, GoalSelfRating>> = {};
      for (const [quarter, qEval] of Object.entries(qSelfEvalsMap)) {
        if (!qEval.id) {
          qGoalRatingsMap[parseInt(quarter)] = {};
          continue;
        }
        
        try {
          const qRatingsResult = await evaluationService.goalSelfRatings.get(qEval.id);

          const ratingsMap: Record<string, GoalSelfRating> = {};
          (qRatingsResult.data || []).forEach((r: any) => {
            ratingsMap[r.goal_id] = {
              goal_id: r.goal_id,
              achievement: r.achievement || '',
              self_rating: r.self_rating,
              evidence: r.evidence || '',
              achieved_value: r.achieved_value,
              target_value: r.target_value,
            };
          });
          qGoalRatingsMap[parseInt(quarter)] = ratingsMap;
        } catch (error) {
          console.error(`Error fetching goal self ratings for Q${quarter}:`, error);
          qGoalRatingsMap[parseInt(quarter)] = {};
        }
      }
      setQuarterlyGoalSelfRatings(qGoalRatingsMap);

      // For year-end, use the same data (no separate year-end table now)
      // Just use Q4 data as a proxy for now
      const q4SelfEval = qSelfEvalsMap[4];
      if (q4SelfEval) {
        setSelfEvaluation(q4SelfEval as any);
        setGoalSelfRatings(qGoalRatingsMap[4] || {});
      }

      // Fetch or create quarterly manager review (instead of manager_evaluations)
      const mgrReviewsResult = await evaluationService.managerReviews.get(employeeId, cycleResult.data.id);
      
      // Create a map of manager reviews by quarter
      const mgrReviewsByQuarter: Record<number, any> = {};
      (mgrReviewsResult.data || []).forEach((r: any) => {
        mgrReviewsByQuarter[r.quarter] = r;
      });

      // Use the first found manager review or create one
      const existingReview = mgrReviewsByQuarter[selectedQuarter] || Object.values(mgrReviewsByQuarter)[0];

      if (existingReview) {
        setManagerEvaluation(existingReview);
        setOverallComments(existingReview.overall_comments || '');
        setDevelopmentRecommendations(existingReview.guidance || '');

        // Fetch KPI manager feedback
        const mgrRatingsMap: Record<string, GoalManagerRating> = {};
        
        if (existingReview.id) {
          try {
            const mgrFeedbackResult = await evaluationService.kpiManagerFeedback.getByReview(existingReview.id);
            (mgrFeedbackResult.data || []).forEach((r: any) => {
              // Calculate manager_achieved_value from progress_percentage if available
              let managerAchievedValue = null;
              if (r.progress_percentage !== null && r.progress_percentage !== undefined) {
                // Find the KPI to get target_value
                const kpi = filteredKpis.find((k: any) => k.id === r.goal_id);
                if (kpi && kpi.target_value) {
                  const numericTarget = parseNumericTarget(kpi.target_value);
                  if (numericTarget) {
                    managerAchievedValue = (r.progress_percentage / 100) * numericTarget;
                  }
                }
              }
              
              mgrRatingsMap[r.goal_id] = {
                goal_id: r.goal_id,
                rating: r.rating,
                comments: r.comments || '',
                manager_achieved_value: managerAchievedValue,
                progress_percentage: r.progress_percentage,
              };
            });
          } catch (error) {
            console.error('Error fetching manager feedback:', error);
          }
        }

        filteredKpis.forEach((g: any) => {
          if (!mgrRatingsMap[g.id]) {
            mgrRatingsMap[g.id] = {
              goal_id: g.id,
              rating: null,
              comments: '',
              manager_achieved_value: null,
            };
          }
        });

        setGoalManagerRatings(mgrRatingsMap);

        // Set quarterly ratings from manager reviews
        const qRatings: Record<string, number | null> = { q1: null, q2: null, q3: null, q4: null };
        Object.entries(mgrReviewsByQuarter).forEach(([q, review]: [string, any]) => {
          const key = `q${q}` as keyof typeof qRatings;
          qRatings[key] = review.calculated_overall_rating;
        });
        setQuarterlyRatings(qRatings as any);
      } else {
        // Initialize empty manager ratings
        const emptyRatingsMap: Record<string, GoalManagerRating> = {};
        filteredKpis.forEach((g: any) => {
          emptyRatingsMap[g.id] = {
            goal_id: g.id,
            rating: null,
            comments: '',
            manager_achieved_value: null,
            progress_percentage: null,
          };
        });
        setGoalManagerRatings(emptyRatingsMap);
      }

      // Always fetch year-end evaluation data (outside of quarterly review block)
      try {
        const yearEndResult = await evaluationService.yearEndEvaluation.get(employeeId, cycleResult.data.id);
        if (yearEndResult.data) {
          setYearEndManagerEvaluation(yearEndResult.data);
          // Populate year-end specific form fields
          if (yearEndResult.data.overall_rating !== null && yearEndResult.data.overall_rating !== undefined) {
            setOverallRating(yearEndResult.data.overall_rating);
          }
          if (yearEndResult.data.overall_comments) {
            // Store year-end comments in separate state variable
            setYearEndOverallComments(yearEndResult.data.overall_comments);
          }
          if (yearEndResult.data.potential_rating !== null && yearEndResult.data.potential_rating !== undefined) {
            setPotentialRating(yearEndResult.data.potential_rating);
          }
          // Also populate quarterly ratings from the year-end record if available
          if (yearEndResult.data.q1_rating !== undefined || 
              yearEndResult.data.q2_rating !== undefined ||
              yearEndResult.data.q3_rating !== undefined ||
              yearEndResult.data.q4_rating !== undefined) {
            setQuarterlyRatings({
              q1: yearEndResult.data.q1_rating ?? null,
              q2: yearEndResult.data.q2_rating ?? null,
              q3: yearEndResult.data.q3_rating ?? null,
              q4: yearEndResult.data.q4_rating ?? null,
            });
          }
        }
      } catch (error) {
        console.log('No year-end evaluation found yet - this is normal for new evaluations');
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error loading evaluation data',
        description: error.message || 'Failed to load employee evaluation data. Please try again.',
        variant: 'destructive',
      });
      navigate('/team');
    } finally {
      setLoading(false);
    }
  };

  const getKPIsForKRA = (kraId: string) => kpis.filter((kpi) => kpi.kra_id === kraId);

  // Auto-calculate ratings from achievement values when KPI data and self-ratings load
  useEffect(() => {
    if (kpis.length === 0) return;
    
    // Get the appropriate self ratings based on selected quarter
    const currentSelfRatings = selectedQuarter && evaluationMode === 'quarterly'
      ? quarterlyGoalSelfRatings[selectedQuarter] || {}
      : goalSelfRatings;
    
    if (Object.keys(currentSelfRatings).length === 0) return;

    const updatedRatings = { ...goalManagerRatings };
    let hasChanges = false;

    kpis.forEach((kpi) => {
      const numericTarget = parseNumericTarget(kpi.target_value);
      if (numericTarget !== null) {
        const selfRating = currentSelfRatings[kpi.id];
        const employeeAchieved = selfRating?.achieved_value ?? 0;
        const managerAchieved = updatedRatings[kpi.id]?.manager_achieved_value ?? employeeAchieved;
        
        // If no rating set yet, auto-calculate from achievement
        if (!updatedRatings[kpi.id]?.rating && managerAchieved > 0) {
          const percentage = numericTarget > 0 ? Math.round((managerAchieved / numericTarget) * 100) : 0;
          const autoRating = calculateRatingFromAchievement(percentage);
          
          updatedRatings[kpi.id] = {
            ...updatedRatings[kpi.id],
            goal_id: kpi.id,
            rating: autoRating,
            comments: updatedRatings[kpi.id]?.comments || '',
            manager_achieved_value: managerAchieved,
          };
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      setGoalManagerRatings(updatedRatings);
    }
  }, [kpis, selectedQuarter, evaluationMode, quarterlyGoalSelfRatings, goalSelfRatings]);

  const calculatedYearEndRating = useMemo(() => {
    return calculateYearEndRating(quarterlyRatings);
  }, [quarterlyRatings]);

  const calculatedKRARatings = useMemo(() => {
    const kpiRatings: Record<string, number | null> = {};
    kpis.forEach(kpi => {
      kpiRatings[kpi.id] = goalManagerRatings[kpi.id]?.rating || null;
    });
    return calculateAllKRARatings(kras, kpis, kpiRatings);
  }, [kras, kpis, goalManagerRatings]);

  const calculatedQuarterRating = useMemo(() => {
    return calculateQuarterRating(kras, calculatedKRARatings);
  }, [kras, calculatedKRARatings]);

  const toggleKRA = (kraId: string) => {
    const newExpanded = new Set(expandedKRAs);
    if (newExpanded.has(kraId)) {
      newExpanded.delete(kraId);
    } else {
      newExpanded.add(kraId);
    }
    setExpandedKRAs(newExpanded);
  };

  const handleGoalRatingChange = (goalId: string, field: keyof GoalManagerRating, value: any) => {
    setGoalManagerRatings((prev) => {
      const updated = {
      ...prev,
      [goalId]: {
        ...prev[goalId],
          goal_id: goalId,
        [field]: value,
        }
      };
      
      // If manager_achieved_value changed, calculate and update progress_percentage
      if (field === 'manager_achieved_value' && value !== null && value !== undefined) {
        const kpi = kpis.find((k: any) => k.id === goalId);
        if (kpi && kpi.target_value) {
          const numericTarget = parseNumericTarget(kpi.target_value);
          if (numericTarget && numericTarget > 0) {
            const progressPercentage = Math.round((value / numericTarget) * 100);
            updated[goalId].progress_percentage = progressPercentage;
          }
        }
      }
      
      return updated;
    });
  };

  const handleSave = useCallback(async () => {
    if (!activeCycle || !managerId || !employeeId) return;

    setSaving(true);
    try {
      // For year-end evaluation, save to year-end evaluation API
      if (evaluationMode === 'year-end') {
        const result = await evaluationService.yearEndEvaluation.upsert({
          employee_id: employeeId,
          cycle_id: activeCycle.id,
          evaluator_id: managerId,
          overall_rating: overallRating,
          overall_comments: yearEndOverallComments,
          potential_rating: potentialRating,
          status: 'pending',
        });

        if (result.data) {
          setYearEndManagerEvaluation(result.data);
        }

        toast({ title: 'Year-end evaluation draft saved' });
        return;
      }

      // Create or update quarterly manager review
      const mgrReviewResult = await evaluationService.managerReviews.upsert({
        employee_id: employeeId,
        cycle_id: activeCycle.id,
        quarter: selectedQuarter,
        reviewer_id: managerId,
        overall_comments: overallComments,
        guidance: developmentRecommendations,
        status: 'in_progress',
      });

      if (mgrReviewResult.data) {
        setManagerEvaluation(mgrReviewResult.data);

        // Save KPI manager feedback
        const ratingsToSave = Object.values(goalManagerRatings).map(rating => ({
          goal_id: rating.goal_id,
          rating: rating.rating,
          comments: rating.comments,
        }));

        if (ratingsToSave.length > 0) {
          await evaluationService.kpiManagerFeedback.bulkUpsert(mgrReviewResult.data.id, ratingsToSave);
        }
      }

      toast({ title: 'Progress saved' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [activeCycle, managerId, employeeId, selectedQuarter, evaluationMode, overallRating, overallComments, yearEndOverallComments, potentialRating, developmentRecommendations, goalManagerRatings, toast]);

  const handleNext = useCallback(async () => {
    // Save current progress before navigating to ensure data persistence
    await handleSave();
    // Navigate to overall assessment tab
    setEvaluationTab('overall');
  }, [handleSave]);

  const handleTabChange = useCallback((value: string) => {
    setEvaluationTab(value);
  }, []);

  const handleSubmit = useCallback(async () => {
    // For year-end evaluation, handle differently
    if (evaluationMode === 'year-end') {
      // Check for overall rating (required)
      if (!overallRating) {
        toast({
          title: 'Rating required',
          description: 'Please select an overall rating before submitting year-end evaluation',
          variant: 'destructive',
        });
        return;
      }

      // Check for overall feedback (required)
      if (!yearEndOverallComments.trim()) {
        toast({
          title: 'Feedback required',
          description: 'Please provide overall feedback before submitting year-end evaluation',
          variant: 'destructive',
        });
        return;
      }

      // Check quarterly ratings
      const hasQuarterlyRatings = Object.values(quarterlyRatings).some(r => r !== null);
      if (!hasQuarterlyRatings) {
        toast({
          title: 'No quarterly ratings',
          description: 'At least one quarterly review must be completed before year-end evaluation',
          variant: 'destructive',
        });
        return;
      }

      if (!activeCycle || !managerId || !employeeId) return;

      setSaving(true);
      try {
        // Submit year-end evaluation
        const result = await evaluationService.yearEndEvaluation.upsert({
          employee_id: employeeId,
          cycle_id: activeCycle.id,
          evaluator_id: managerId,
          overall_rating: overallRating,
          overall_comments: yearEndOverallComments,
          potential_rating: potentialRating,
          status: 'submitted',
        });

        // Update the local state
        if (result.data) {
          setYearEndManagerEvaluation(result.data);
        }

        toast({ title: 'Year-end evaluation submitted successfully' });
        navigate('/team');
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      } finally {
        setSaving(false);
      }
      return;
    }

    // Quarterly evaluation logic
    // Check for missing ratings
    const missingRatings = kpis.filter((g) => !goalManagerRatings[g.id]?.rating);
    if (missingRatings.length > 0) {
      toast({
        title: 'Incomplete ratings',
        description: 'Please rate all KPIs before submitting',
        variant: 'destructive',
      });
      return;
    }

    // Check for missing comments (comments are required)
    const missingComments = kpis.filter((g) => !goalManagerRatings[g.id]?.comments?.trim());
    if (missingComments.length > 0) {
      toast({
        title: 'Comments required',
        description: `Please provide comments for all KPIs (${missingComments.length} missing)`,
        variant: 'destructive',
      });
      return;
    }

    if (!activeCycle || !managerId || !employeeId) return;

    setSaving(true);
    try {
      // Calculate the quarterly rating from KPI ratings
      const kpiRatingsValues = Object.values(goalManagerRatings);
      const validRatings = kpiRatingsValues.filter(r => r.rating !== null && r.rating !== undefined);
      const avgRating = validRatings.length > 0 
        ? validRatings.reduce((sum, r) => sum + (r.rating || 0), 0) / validRatings.length 
        : null;

      // Create or update quarterly manager review with submitted status
      const mgrReviewResult = await evaluationService.managerReviews.upsert({
        employee_id: employeeId,
        cycle_id: activeCycle.id,
        quarter: selectedQuarter,
        reviewer_id: managerId,
        overall_comments: overallComments,
        guidance: developmentRecommendations,
        calculated_overall_rating: avgRating,
        status: 'submitted',
      });

      if (mgrReviewResult.data) {
        // Save KPI manager feedback
        const ratingsToSave = Object.values(goalManagerRatings).map(rating => {
          // Calculate progress_percentage from manager_achieved_value
          let progressPercentage = null;
          if (rating.manager_achieved_value !== null && rating.manager_achieved_value !== undefined) {
            const kpi = kpis.find((k: any) => k.id === rating.goal_id);
            if (kpi && kpi.target_value) {
              const numericTarget = parseNumericTarget(kpi.target_value);
              if (numericTarget && numericTarget > 0) {
                progressPercentage = Math.round((rating.manager_achieved_value / numericTarget) * 100);
              }
            }
          }
          
          return {
          goal_id: rating.goal_id,
          rating: rating.rating,
          comments: rating.comments,
            progress_percentage: progressPercentage ?? rating.progress_percentage ?? null,
          };
        });

        if (ratingsToSave.length > 0) {
          await evaluationService.kpiManagerFeedback.bulkUpsert(mgrReviewResult.data.id, ratingsToSave);
        }
      }

      toast({ title: `Q${selectedQuarter} Manager review submitted` });
      navigate('/team');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [activeCycle, managerId, employeeId, goalManagerRatings, kpis, overallComments, yearEndOverallComments, developmentRecommendations, overallRating, potentialRating, evaluationMode, selectedQuarter, quarterlyRatings, calculatedQuarterRating, calculatedYearEndRating, managerEvaluation, toast, navigate]);

  const getRatingLabel = (value: number | null) => {
    if (!value) return 'Not rated';
    const scale = ratingScales.find((s) => s.value === value);
    return scale ? `${value} - ${scale.name}` : value.toString();
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

  if (!managerId || !employee) {
    return (
      <MainLayout>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Unable to load evaluation data. Please try again.</AlertDescription>
        </Alert>
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

  if (kras.length === 0 || kpis.length === 0) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => navigate('/team')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Team
          </Button>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <User className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg">No approved KRAs/KPIs</h3>
              <p className="text-muted-foreground">
                {getEmployeeFirstName(employee)} does not have approved KRAs/KPIs for evaluation
              </p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  // Determine which quarter or year-end view based on evaluation mode
  const quarterNumber = evaluationMode === 'quarterly' ? selectedQuarter : null;

  const relevantSelfEval = quarterNumber 
    ? quarterlySelfEvals[quarterNumber]
    : selfEvaluation;

  // Get the appropriate goal self ratings based on quarterly or year-end view
  const relevantGoalSelfRatings = quarterNumber 
    ? quarterlyGoalSelfRatings[quarterNumber] || {}
    : goalSelfRatings;

  // Get period status for the current view
  const quarterPeriodStatus = getQuarterManagerReviewStatus(activeCycle, selectedQuarter);
  const yearEndPeriodStatus = getYearEndManagerEvalStatus(activeCycle);
  
  // Handler for tab changes
  const handleEvaluationTabChange = (tab: 'quarterly' | 'year-end', quarter?: Quarter) => {
    setEvaluationMode(tab);
    if (quarter) {
      setSelectedQuarter(quarter);
      setSearchParams({ quarter: quarter.toString() });
    } else {
      setSearchParams({});
    }
  };

  const handleQuarterChange = (quarter: Quarter) => {
    setSelectedQuarter(quarter);
    setSearchParams({ quarter: quarter.toString() });
  };

  // Check if evaluation can proceed
  // For quarterly: period is open and self-eval is submitted
  // For year-end: always allow (no self-eval required, no period restriction)
  const canEvaluate = evaluationMode === 'quarterly'
    ? quarterPeriodStatus.timing === 'current' && relevantSelfEval?.status === 'submitted'
    : true;

  // Check submission status based on evaluation mode
  // For year-end: only consider submitted if yearEndManagerEvaluation exists AND has status 'submitted'
  const isSubmitted = evaluationMode === 'quarterly' 
    ? managerEvaluation?.status === 'submitted'
    : Boolean(yearEndManagerEvaluation && yearEndManagerEvaluation.status === 'submitted');
  const hasHRRejection = evaluationMode === 'quarterly'
    ? managerEvaluation?.hr_rejection_reason && managerEvaluation?.status === 'pending'
    : yearEndManagerEvaluation?.hr_rejection_reason && yearEndManagerEvaluation?.status === 'pending';

  // Render KRA/KPI rating content (quarterly only)
  const renderQuarterlyRatingContent = () => (
    <div className="space-y-6">
      <Tabs 
        value={evaluationTab} 
        onValueChange={handleTabChange}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="goals">KRA/KPI Ratings ({kpis.length})</TabsTrigger>
          <TabsTrigger value="overall">Overall Assessment</TabsTrigger>
        </TabsList>

        <TabsContent value="goals" className="space-y-6">
          <Card className="border-2 border-primary/20 bg-primary/5">
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <Star className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">
                      {quarterNumber ? `Q${quarterNumber}` : 'Overall'} Rating
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Weighted average of all KRA ratings
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold text-primary">
                    {calculatedQuarterRating !== null 
                      ? calculatedQuarterRating.toFixed(2) 
                      : '-'}
                  </div>
                  <div className="text-sm text-muted-foreground">out of 5</div>
                </div>
              </div>
            </CardContent>
          </Card>

            {kras.map((kra) => {
              const kraKpis = getKPIsForKRA(kra.id);
              const isExpanded = expandedKRAs.has(kra.id);

              return (
                <Card key={kra.id} className="border-l-4 border-l-card-border">
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 mt-1"
                        onClick={() => toggleKRA(kra.id)}
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-[hsl(var(--card-arrow))]" /> : <ChevronRight className="h-4 w-4 text-[hsl(var(--card-arrow))]" />}
                      </Button>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="bg-primary/10">
                            KRA
                          </Badge>
                          <span className="text-sm font-medium text-primary">Weight: {kra.weight}%</span>
                        </div>
                        <CardTitle className="text-lg">{kra.title}</CardTitle>
                        {kra.description && <CardDescription className="mt-1">{kra.description}</CardDescription>}
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calculator className="h-3 w-3" />
                          KRA Rating
                        </div>
                        <div className="text-xl font-bold text-primary">
                          {formatRating(calculatedKRARatings[kra.id])}
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="space-y-4">
                      {kraKpis.map((kpi) => (
                        <div key={kpi.id} className="border rounded-lg p-4 space-y-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="secondary">KPI</Badge>
                              <span className="text-sm text-muted-foreground">Weight: {kpi.weight}%</span>
                            </div>
                            <h4 className="font-medium">{kpi.title}</h4>
                            {kpi.description && (
                              <p className="text-sm text-muted-foreground mt-1">{kpi.description}</p>
                            )}
                            {kpi.target_value && (
                              <p className="text-sm mt-1">
                                <span className="text-muted-foreground">Target: </span>
                                {kpi.target_value}
                              </p>
                            )}
                          </div>

                          {relevantGoalSelfRatings[kpi.id] && (
                            <div className="bg-muted/50 p-3 rounded-lg space-y-2">
                              <h5 className="font-medium text-sm flex items-center gap-2">
                                <User className="h-4 w-4" />
                                Employee Self Assessment
                              </h5>
                              <div className="grid gap-2 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Self Rating: </span>
                                  <Badge variant="secondary">
                                    {getRatingLabel(relevantGoalSelfRatings[kpi.id].self_rating)}
                                  </Badge>
                                </div>
                                {relevantGoalSelfRatings[kpi.id].achievement && (
                                  <div>
                                    <span className="text-muted-foreground">Achievement: </span>
                                    <p className="mt-1">{relevantGoalSelfRatings[kpi.id].achievement}</p>
                                  </div>
                                )}
                                {relevantGoalSelfRatings[kpi.id].evidence && (
                                  <div>
                                    <span className="text-muted-foreground">Evidence: </span>
                                    <p className="mt-1">{relevantGoalSelfRatings[kpi.id].evidence}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {(() => {
                            const numericTarget = parseNumericTarget(kpi.target_value);
                            const selfRating = relevantGoalSelfRatings[kpi.id];
                            if (numericTarget !== null) {
                              const employeeAchieved = selfRating?.achieved_value ?? 0;
                              const managerAchieved = goalManagerRatings[kpi.id]?.manager_achieved_value ?? employeeAchieved;
                              return (
                                <DualAchievementSlider
                                  targetValue={numericTarget}
                                  employeeAchieved={employeeAchieved}
                                  managerAchieved={managerAchieved}
                                  onManagerChange={(value) => handleGoalRatingChange(kpi.id, 'manager_achieved_value' as keyof GoalManagerRating, value)}
                                  onRatingChange={(rating) => handleGoalRatingChange(kpi.id, 'rating', rating)}
                                  disabled={isSubmitted}
                                />
                              );
                            }
                            return null;
                          })()}

                          <Separator />

                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                            <h5 className="font-medium text-sm">Your Rating</h5>
                              {(() => {
                                // Check if progress bar has been used
                                const currentRating = goalManagerRatings[kpi.id];
                                const numericTarget = parseNumericTarget(kpi.target_value);
                                
                                if (numericTarget === null) return null;
                                
                                const employeeAchieved = relevantGoalSelfRatings[kpi.id]?.achieved_value ?? 0;
                                const managerAchieved = currentRating?.manager_achieved_value ?? employeeAchieved;
                                
                                // Progress bar has been used if:
                                // 1. progress_percentage is explicitly set, OR
                                // 2. manager_achieved_value is set and differs from employee's value
                                const hasProgressBarValue = 
                                  (currentRating?.progress_percentage !== null && 
                                   currentRating?.progress_percentage !== undefined) ||
                                  (currentRating?.manager_achieved_value !== null &&
                                   currentRating?.manager_achieved_value !== undefined &&
                                   managerAchieved !== employeeAchieved);
                                
                                if (hasProgressBarValue && !isSubmitted) {
                                  return (
                                    <span className="text-xs text-muted-foreground italic">
                                      Rating controlled by progress bar
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                            </div>

                            <div className="space-y-2">
                              <Label>Rating *</Label>
                              {(() => {
                                // Check if progress bar has been used
                                const currentRating = goalManagerRatings[kpi.id];
                                const numericTarget = parseNumericTarget(kpi.target_value);
                                
                                if (numericTarget === null) {
                                  // No progress bar for this KPI, allow manual rating
                                  return (
                              <RadioGroup
                                value={goalManagerRatings[kpi.id]?.rating?.toString() || ''}
                                onValueChange={(value) => handleGoalRatingChange(kpi.id, 'rating', parseInt(value))}
                                disabled={isSubmitted}
                                className="flex flex-wrap gap-4"
                              >
                                {ratingScales.map((scale) => (
                                  <div key={scale.value} className="flex items-center space-x-2">
                                    <RadioGroupItem
                                      value={scale.value.toString()}
                                      id={`mgr-${kpi.id}-${scale.value}`}
                                            disabled={isSubmitted}
                                    />
                                    <Label
                                      htmlFor={`mgr-${kpi.id}-${scale.value}`}
                                            className={`flex items-center gap-1 ${isSubmitted ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                                    >
                                      <Star className="h-4 w-4" style={{ color: scale.color || undefined }} />
                                      {scale.value} - {scale.name}
                                    </Label>
                                  </div>
                                ))}
                              </RadioGroup>
                                  );
                                }
                                
                                const employeeAchieved = relevantGoalSelfRatings[kpi.id]?.achieved_value ?? 0;
                                const managerAchieved = currentRating?.manager_achieved_value ?? employeeAchieved;
                                
                                // Progress bar has been used if:
                                // 1. progress_percentage is explicitly set, OR
                                // 2. manager_achieved_value is set and differs from employee's value
                                const hasProgressBarValue = 
                                  (currentRating?.progress_percentage !== null && 
                                   currentRating?.progress_percentage !== undefined) ||
                                  (currentRating?.manager_achieved_value !== null &&
                                   currentRating?.manager_achieved_value !== undefined &&
                                   managerAchieved !== employeeAchieved);
                                
                                const isRatingDisabled = isSubmitted || hasProgressBarValue;
                                
                                return (
                                  <RadioGroup
                                    value={goalManagerRatings[kpi.id]?.rating?.toString() || ''}
                                    onValueChange={(value) => {
                                      // Prevent manual rating change if progress bar has been used
                                      if (!hasProgressBarValue) {
                                        handleGoalRatingChange(kpi.id, 'rating', parseInt(value));
                                      }
                                    }}
                                    disabled={isRatingDisabled}
                                    className="flex flex-wrap gap-4"
                                  >
                                    {ratingScales.map((scale) => (
                                      <div key={scale.value} className="flex items-center space-x-2">
                                        <RadioGroupItem
                                          value={scale.value.toString()}
                                          id={`mgr-${kpi.id}-${scale.value}`}
                                          disabled={isRatingDisabled}
                                        />
                                        <Label
                                          htmlFor={`mgr-${kpi.id}-${scale.value}`}
                                          className={`flex items-center gap-1 ${isRatingDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                                        >
                                          <Star className="h-4 w-4" style={{ color: scale.color || undefined }} />
                                          {scale.value} - {scale.name}
                                        </Label>
                                      </div>
                                    ))}
                                  </RadioGroup>
                                );
                              })()}
                            </div>

                            <div className="space-y-2">
                              <Label>Comments <span className="text-destructive">*</span></Label>
                              <Textarea
                                placeholder="Provide feedback on this KPI (required)..."
                                value={goalManagerRatings[kpi.id]?.comments || ''}
                                onChange={(e) => handleGoalRatingChange(kpi.id, 'comments', e.target.value)}
                                disabled={isSubmitted}
                                rows={2}
                                className={!goalManagerRatings[kpi.id]?.comments?.trim() && !isSubmitted ? 'border-orange-300' : ''}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  )}
                </Card>
              );
            })}
            
            {/* Action Buttons for KRA/KPI Ratings Tab */}
            {!isSubmitted && canEvaluate && (
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
                  onClick={handleNext}
                  disabled={saving}
                >
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="overall" className="space-y-4">
            {relevantSelfEval && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Employee Self Assessment Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="text-muted-foreground">Overall Self Rating</Label>
                      <p className="font-medium mt-1">{getRatingLabel(relevantSelfEval.overall_rating)}</p>
                    </div>
                  </div>
                  {relevantSelfEval.overall_comments && (
                    <div>
                      <Label className="text-muted-foreground">Overall Comments</Label>
                      <p className="mt-1">{relevantSelfEval.overall_comments}</p>
                    </div>
                  )}
                  {relevantSelfEval.development_plan && (
                    <div>
                      <Label className="text-muted-foreground">Development Plan</Label>
                      <p className="mt-1">{relevantSelfEval.development_plan}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Calculated Quarterly Rating */}
            <Card className="border-2 border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Q{selectedQuarter} Manager Rating (Auto-Calculated)
                </CardTitle>
                <CardDescription>
                  Calculated as weighted average of your KPI ratings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 rounded-lg bg-background border-2 border-primary">
                  <span className="font-medium text-lg">Your Overall Rating for Q{selectedQuarter}</span>
                  <span className="text-3xl font-bold text-primary">
                    {(() => {
                      const ratings = Object.values(goalManagerRatings);
                      const validRatings = ratings.filter(r => r.rating !== null && r.rating !== undefined);
                      if (validRatings.length === 0) return '-';
                      const avg = validRatings.reduce((sum, r) => sum + (r.rating || 0), 0) / validRatings.length;
                      return avg.toFixed(2);
                    })()}
                  </span>
                </div>
                {Object.values(goalManagerRatings).filter(r => r.rating).length === 0 && (
                  <Alert className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Rate all KPIs to see the calculated overall rating.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Manager Overall Assessment */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5" />
                  Manager Assessment Summary
                </CardTitle>
                <CardDescription>
                  Provide your overall assessment of {getEmployeeFirstName(employee)}'s performance for Q{selectedQuarter}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Overall Comments</Label>
                  <Textarea
                    placeholder={`Summarize ${getEmployeeFirstName(employee)}'s key achievements, strengths, and areas for improvement this quarter...`}
                    value={overallComments}
                    onChange={(e) => setOverallComments(e.target.value)}
                    disabled={isSubmitted}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Guidance & Development Recommendations</Label>
                  <Textarea
                    placeholder="Provide guidance for improvement, suggest training, projects, or focus areas for the next quarter..."
                    value={developmentRecommendations}
                    onChange={(e) => setDevelopmentRecommendations(e.target.value)}
                    disabled={isSubmitted}
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>
            
            {/* Action Buttons for Overall Assessment Tab */}
            {!isSubmitted && canEvaluate && (
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
                >
                  <Send className="mr-2 h-4 w-4" />
                  Submit
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    );

  // Render Year-End Evaluation Content (Only Overall Assessment - no KRA/KPI tabs)
  const renderYearEndEvaluationContent = () => {
    // For year-end, check if already submitted or released (HR approved)
    const yearEndSubmitted = Boolean(yearEndManagerEvaluation && 
      (yearEndManagerEvaluation.status === 'submitted' || yearEndManagerEvaluation.status === 'released'));
    const yearEndReleased = Boolean(yearEndManagerEvaluation && yearEndManagerEvaluation.status === 'released');
    
    return (
      <div className="space-y-6">
        {yearEndSubmitted && (
          <Alert className={yearEndReleased ? 'border-green-200 bg-green-50' : ''}>
            {yearEndReleased ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>
              {yearEndReleased 
                ? 'This year-end evaluation has been approved by HR and released to the employee.'
                : 'This year-end evaluation has been submitted and is pending HR review.'}
            </AlertDescription>
          </Alert>
        )}

        {/* Quarterly Ratings Summary */}
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Year-End Rating
            </CardTitle>
            <CardDescription>
              Calculated as the average of quarterly ratings. You can adjust the final rating below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              {(['q1', 'q2', 'q3', 'q4'] as const).map((q, idx) => (
                <div key={q} className="p-3 rounded-lg bg-background border text-center">
                  <div className="text-xs text-muted-foreground mb-1">Q{idx + 1}</div>
                  <div className="font-semibold">
                    {quarterlyRatings[q] !== null ? formatRating(quarterlyRatings[q]) : '-'}
                  </div>
                </div>
              ))}
            </div>
            <Separator />
            <div className="flex items-center justify-between p-4 rounded-lg bg-background border-2 border-primary">
              <span className="font-medium text-lg">Auto-Calculated Average</span>
              <span className="text-3xl font-bold text-primary">
                {formatRating(calculatedYearEndRating)}
              </span>
            </div>
            {calculatedYearEndRating === null && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Complete at least one quarterly review to calculate the year-end rating.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Manager's Editable Overall Rating */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Manager's Overall Rating <span className="text-destructive">*</span>
            </CardTitle>
            <CardDescription>
              Select the final year-end rating for {getEmployeeFirstName(employee)}. The auto-calculated rating is shown above for reference.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup
              value={overallRating?.toString() || ''}
              onValueChange={(value) => setOverallRating(parseInt(value))}
              disabled={yearEndSubmitted}
              className="space-y-3"
            >
              {ratingScales.map((scale) => (
                <div key={scale.value} className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <RadioGroupItem
                    value={scale.value.toString()}
                    id={`year-end-rating-${scale.value}`}
                    className="mt-1"
                    disabled={yearEndSubmitted}
                  />
                  <Label htmlFor={`year-end-rating-${scale.value}`} className="cursor-pointer flex-1">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4" style={{ color: scale.color || undefined }} />
                      <span className="font-medium">
                        {scale.value} - {scale.name}
                      </span>
                    </div>
                    {scale.description && (
                      <p className="text-sm text-muted-foreground mt-1">{scale.description}</p>
                    )}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            {!overallRating && !yearEndSubmitted && (
              <p className="text-sm text-orange-600">Please select an overall rating</p>
            )}
          </CardContent>
        </Card>

        {/* Overall Feedback - Required */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Overall Feedback <span className="text-destructive">*</span>
            </CardTitle>
            <CardDescription>
              Provide comprehensive feedback on {getEmployeeFirstName(employee)}'s performance, achievements, and areas for improvement (Required)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Summarize key achievements, challenges, strengths, areas for improvement, and overall assessment for the year..."
              value={yearEndOverallComments}
              onChange={(e) => setYearEndOverallComments(e.target.value)}
              disabled={yearEndSubmitted}
              rows={5}
              className={!yearEndOverallComments.trim() && !yearEndSubmitted ? 'border-orange-300' : ''}
            />
            {!yearEndOverallComments.trim() && !yearEndSubmitted && (
              <p className="text-sm text-orange-600 mt-2">Overall feedback is required for submission</p>
            )}
          </CardContent>
        </Card>

        {/* Potential Rating */}
        <Card>
          <CardHeader>
            <CardTitle>Potential Rating</CardTitle>
            <CardDescription>Assess {getEmployeeFirstName(employee)}'s growth potential for succession planning</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup
              value={potentialRating?.toString() || ''}
              onValueChange={(value) => setPotentialRating(parseInt(value))}
              disabled={yearEndSubmitted}
              className="space-y-3"
            >
              <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="3" id="ye-potential-3" className="mt-1" disabled={yearEndSubmitted} />
                <Label htmlFor="ye-potential-3" className="cursor-pointer flex-1">
                  <div className="font-medium">High Potential</div>
                  <p className="text-sm text-muted-foreground">
                    Ready for promotion within 1-2 years, demonstrates leadership capabilities
                  </p>
                </Label>
              </div>
              <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="2" id="ye-potential-2" className="mt-1" disabled={yearEndSubmitted} />
                <Label htmlFor="ye-potential-2" className="cursor-pointer flex-1">
                  <div className="font-medium">Medium Potential</div>
                  <p className="text-sm text-muted-foreground">
                    Growing in role, may be ready for advancement with development
                  </p>
                </Label>
              </div>
              <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="1" id="ye-potential-1" className="mt-1" disabled={yearEndSubmitted} />
                <Label htmlFor="ye-potential-1" className="cursor-pointer flex-1">
                  <div className="font-medium">Low Potential</div>
                  <p className="text-sm text-muted-foreground">
                    Performing well in current role, limited growth trajectory
                  </p>
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        {!yearEndSubmitted && (
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={handleSave} 
              disabled={saving}
            >
              <Save className="mr-2 h-4 w-4" />
              Save Draft
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={saving || !overallRating || !yearEndOverallComments.trim()}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Send className="mr-2 h-4 w-4" />
              Submit for HR Review
            </Button>
          </div>
        )}

      
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/team')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                  {getEmployeeInitials(employee)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <CardTitle className="text-2xl">
                  {getEmployeeDisplayName(employee)}
                </CardTitle>
                <CardDescription>{employee.email}</CardDescription>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline">{employee.department}</Badge>
                  <Badge variant="secondary">{employee.grade}</Badge>
                  <Badge>{employee.emp_id}</Badge>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {hasHRRejection && (
          <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800 dark:text-orange-200">
              <div className="font-semibold mb-2">HR Review Rejected</div>
              <div className="text-sm">
                <strong>Rejection Reason:</strong> {managerEvaluation.hr_rejection_reason}
              </div>
              <div className="text-xs mt-2 italic">
                Please review the feedback above and resubmit your evaluation after making necessary changes.
              </div>
            </AlertDescription>
          </Alert>
        )}

        {isSubmitted && !hasHRRejection && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>This evaluation has been submitted and is pending HR review.</AlertDescription>
          </Alert>
        )}

        {/* Centralized Evaluation Period Tabs */}
        <EvaluationPeriodTabs
          cycle={activeCycle}
          quarterlySelfEvals={quarterlySelfEvals}
          yearEndSelfEvalStatus={selfEvaluation?.status}
          defaultTab={evaluationMode}
          selectedQuarter={selectedQuarter}
          onTabChange={handleEvaluationTabChange}
          onQuarterChange={handleQuarterChange}
          quarterlyContent={
            canEvaluate || isSubmitted ? (
              renderQuarterlyRatingContent()
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <User className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg">Cannot evaluate yet</h3>
                  <p className="text-muted-foreground text-center">
                    {quarterPeriodStatus.timing !== 'current' 
                      ? quarterPeriodStatus.message
                      : `${getEmployeeFirstName(employee)} must complete their Q${selectedQuarter} self-review first`}
                  </p>
                </CardContent>
              </Card>
            )
          }
          yearEndContent={renderYearEndEvaluationContent()}
        />
      </div>
    </MainLayout>
  );
}
