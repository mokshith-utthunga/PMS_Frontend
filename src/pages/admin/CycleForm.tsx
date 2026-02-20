import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
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
import { ArrowLeft, Calendar, Loader2, ChevronDown, Users, Info, Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { PerformanceCycle } from '@/types';
import type { FormData } from '@/utils/quarterHelpers';

export default function CycleForm() {
  const navigate = useNavigate();
  const { cycleId } = useParams();
  const location = useLocation();
  const isViewMode = location.pathname.includes('/view');
  const isEditMode = Boolean(cycleId) && !isViewMode;
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
  const [goalsQuarterlyData, setGoalsQuarterlyData] = useState<Record<number, any>>({
    1: {},
    2: {},
    3: {},
    4: {},
  });
  const [goalsValidationErrors, setGoalsValidationErrors] = useState<Record<number, Record<string, string>>>({
    1: {},
    2: {},
    3: {},
    4: {},
  });
  const [quarterlyReviewsValidationErrors, setQuarterlyReviewsValidationErrors] = useState<Record<string, string>>({});
  const [isLoadingQuarterlyCycles, setIsLoadingQuarterlyCycles] = useState(false);
  const hasFetchedQuarterlyCycles = useRef<string | null>(null);
  const hasFetchedCycle = useRef<string | null>(null);
  const hasFetchedGoalsQuarterlyCycles = useRef<string | null>(null);
  const hasFetchedTeams = useRef(false);
  const isInitialLoad = useRef(false);
  const hasUserModifiedDepartments = useRef(false);
  const hasUserModifiedBusinessUnits = useRef(false);
  const isUpdatingState = useRef(false);

  // Define quarter key types for type-safe access
  type QuarterKey = 'q1' | 'q2' | 'q3' | 'q4';
  type QuarterField = 
    | 'quarter_start_date'
    | 'quarter_end_date'
    | 'self_review_start'
    | 'self_review_end'
    | 'manager_review_start'
    | 'manager_review_end';

  // Define form data type with explicit quarterly fields

  const [formData, setFormData] = useState<FormData>({
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
    // Q1 Quarterly Review
    q1_quarter_start_date: '',
    q1_quarter_end_date: '',
    q1_self_review_start: '',
    q1_self_review_end: '',
    q1_manager_review_start: '',
    q1_manager_review_end: '',
    // Q2 Quarterly Review
    q2_quarter_start_date: '',
    q2_quarter_end_date: '',
    q2_self_review_start: '',
    q2_self_review_end: '',
    q2_manager_review_start: '',
    q2_manager_review_end: '',
    // Q3 Quarterly Review
    q3_quarter_start_date: '',
    q3_quarter_end_date: '',
    q3_self_review_start: '',
    q3_self_review_end: '',
    q3_manager_review_start: '',
    q3_manager_review_end: '',
    // Q4 Quarterly Review
    q4_quarter_start_date: '',
    q4_quarter_end_date: '',
    q4_self_review_start: '',
    q4_self_review_end: '',
    q4_manager_review_start: '',
    q4_manager_review_end: '',
  });

  // Helper function to safely get quarterly form data values with type safety
  const getQuarterlyValue = (quarter: QuarterKey, field: QuarterField): string => {
    const key = `${quarter}_${field}` as keyof FormData;
    const value = formData[key];
    return typeof value === 'string' ? value : '';
  };

  // Reset fetch flags when cycleId changes
  useEffect(() => {
    hasFetchedQuarterlyCycles.current = null;
    hasFetchedCycle.current = null;
    hasFetchedGoalsQuarterlyCycles.current = null;
    isInitialLoad.current = false;
    // Reset user modification flags when cycleId changes
    hasUserModifiedDepartments.current = false;
    hasUserModifiedBusinessUnits.current = false;
    // Don't reset hasFetchedTeams - teams are fetched once per component mount
    // Clear any existing validation errors for review dates (validation removed)
    setQuarterlyReviewsValidationErrors({});
  }, [cycleId]);

  // Fetch teams once on component mount - will be called after fetchTeams is defined

  const formatDateForInput = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  const fetchCycle = useCallback(async () => {
    if (!cycleId) return;
    // Allow re-fetching on refresh - don't block if already fetched
    // The ref check is handled in the useEffect
    hasFetchedCycle.current = cycleId;
    setIsLoading(true);
    try {
      const result = await cycleService.getById(cycleId);

      console.log(result.data);

      if (result.data) {
        const data = result.data as PerformanceCycle & {
          description?: string;
          applicable_departments?: string[] | null;
          applicable_business_units?: string[] | null;
        };

        setFormData(prev => {
          const newFormData = {
            name: data.name || '',
            description: data.description || '',
            year: data.year || new Date().getFullYear(),
            goal_submission_start: '',
            goal_submission_end: '',
            goal_approval_end: '',
            // manager_evaluation_start/end are loaded from Q4's quarterly_cycles via fetchQuarterlyCycles
            // Don't overwrite if already set by fetchQuarterlyCycles
            manager_evaluation_start: prev.manager_evaluation_start || formatDateForInput(data.manager_evaluation_start) || '',
            manager_evaluation_end: prev.manager_evaluation_end || formatDateForInput(data.manager_evaluation_end) || '',
            calibration_start: formatDateForInput(data.calibration_start),
            calibration_end: formatDateForInput(data.calibration_end),
            release_date: formatDateForInput(data.release_date),
            allow_late_goal_submission: false,
            // Quarterly dates are loaded from quarterly_cycles table via fetchQuarterlyCycles
            // Don't overwrite if already set by fetchQuarterlyCycles
            q1_quarter_start_date: prev.q1_quarter_start_date || '',
            q1_quarter_end_date: prev.q1_quarter_end_date || '',
            q1_self_review_start: prev.q1_self_review_start || '',
            q1_self_review_end: prev.q1_self_review_end || '',
            q1_manager_review_start: prev.q1_manager_review_start || '',
            q1_manager_review_end: prev.q1_manager_review_end || '',
            // Q2 Quarterly Review
            q2_quarter_start_date: prev.q2_quarter_start_date || '',
            q2_quarter_end_date: prev.q2_quarter_end_date || '',
            q2_self_review_start: prev.q2_self_review_start || '',
            q2_self_review_end: prev.q2_self_review_end || '',
            q2_manager_review_start: prev.q2_manager_review_start || '',
            q2_manager_review_end: prev.q2_manager_review_end || '',
            // Q3 Quarterly Review
            q3_quarter_start_date: prev.q3_quarter_start_date || '',
            q3_quarter_end_date: prev.q3_quarter_end_date || '',
            q3_self_review_start: prev.q3_self_review_start || '',
            q3_self_review_end: prev.q3_self_review_end || '',
            q3_manager_review_start: prev.q3_manager_review_start || '',
            q3_manager_review_end: prev.q3_manager_review_end || '',
            // Q4 Quarterly Review
            q4_quarter_start_date: prev.q4_quarter_start_date || '',
            q4_quarter_end_date: prev.q4_quarter_end_date || '',
            q4_self_review_start: prev.q4_self_review_start || '',
            q4_self_review_end: prev.q4_self_review_end || '',
            q4_manager_review_start: prev.q4_manager_review_start || '',
            q4_manager_review_end: prev.q4_manager_review_end || '',
          };

          // Check if any values actually changed
          let hasChanges = false;
          for (const key in newFormData) {
            const newValue = newFormData[key as keyof typeof newFormData];
            const oldValue = prev[key as keyof typeof prev];
            if (newValue !== oldValue) {
              hasChanges = true;
              break;
            }
          }

          if (!hasChanges) {
            return prev; // Return same object reference to prevent re-render
          }

          return newFormData;
        });

        if (data.applicable_departments || data.applicable_business_units) {
          setApplyToAll(false);
          // Only set departments/business units if user hasn't modified them yet
          if (!hasUserModifiedDepartments.current) {
            setSelectedDepartments(data.applicable_departments || []);
          }
          if (!hasUserModifiedBusinessUnits.current) {
            setSelectedBusinessUnits(data.applicable_business_units || []);
          }
        }

        // Don't update openQuarters here - let fetchQuarterlyCycles handle it
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
  }, [cycleId]);

  const fetchQuarterlyCycles = useCallback(async () => {
    if (!cycleId) return;
    // Allow re-fetching on refresh - the ref is reset in useEffect
    hasFetchedQuarterlyCycles.current = cycleId;
    setIsLoadingQuarterlyCycles(true);
    try {
      const result = await cycleService.getQuarterlyCycles(cycleId);
      console.log('quarterly cycles', result.data);
      if (result.data && result.data.length > 0) {
        const quarterlyData: Record<string, string> = {};
        const quartersOpen: Record<string, boolean> = { q1: false, q2: false, q3: false, q4: false };
        let yearEndMgrStart = '';
        let yearEndMgrEnd = '';

        result.data.forEach((item: any) => {
          const quarterKey = `q${item.quarter}`;

          // Load quarter date range for validation (only if values exist)
          if (item.quarter_start_date) {
            quarterlyData[`${quarterKey}_quarter_start_date`] = formatDateForInput(item.quarter_start_date);
          }
          if (item.quarter_end_date) {
            quarterlyData[`${quarterKey}_quarter_end_date`] = formatDateForInput(item.quarter_end_date);
          }

          // Load review dates (always set, format if value exists)
          quarterlyData[`${quarterKey}_self_review_start`] = item.self_review_start_date
            ? formatDateForInput(item.self_review_start_date)
            : '';
          quarterlyData[`${quarterKey}_self_review_end`] = item.self_review_end_date
            ? formatDateForInput(item.self_review_end_date)
            : '';

          // Load quarterly manager review dates (always set, format if value exists)
          // Backend returns manager_review_start_date and manager_review_end_date directly
          quarterlyData[`${quarterKey}_manager_review_start`] = item.manager_review_start_date
            ? formatDateForInput(item.manager_review_start_date)
            : '';
          quarterlyData[`${quarterKey}_manager_review_end`] = item.manager_review_end_date
            ? formatDateForInput(item.manager_review_end_date)
            : '';

          // For Q4, ALSO use manager review dates for year-end manager evaluation
          // (Year-end evaluations can use Q4's manager review dates)
          if (item.quarter === 4) {
            // Set year-end dates from Q4's quarterly manager review dates (only if they exist)
            if (item.manager_review_start_date) {
              yearEndMgrStart = formatDateForInput(item.manager_review_start_date);
            }
            if (item.manager_review_end_date) {
              yearEndMgrEnd = formatDateForInput(item.manager_review_end_date);
            }
          }

          // Open the quarter if it has any data
          if (item.quarter_start_date || item.self_review_start_date || item.manager_review_start_date) {
            quartersOpen[quarterKey] = true;
          }
        });


        setFormData(prev => {
          let hasChanges = false;
          const updatedData: any = { ...prev };

          for (const key in quarterlyData) {
            const newValue = quarterlyData[key];
            const oldValue = (prev[key as keyof typeof prev] as string) || '';
            if (newValue !== oldValue) {
              updatedData[key] = newValue;
              hasChanges = true;
            }
          }

          if (yearEndMgrStart && yearEndMgrStart !== prev.manager_evaluation_start) {
            updatedData.manager_evaluation_start = yearEndMgrStart;
            hasChanges = true;
          }
          if (yearEndMgrEnd && yearEndMgrEnd !== prev.manager_evaluation_end) {
            updatedData.manager_evaluation_end = yearEndMgrEnd;
            hasChanges = true;
          }

          if (!hasChanges) {
            return prev;
          }

          return updatedData;
        });


        setOpenQuarters(prev => {

          if (
            quartersOpen.q1 === prev.q1 &&
            quartersOpen.q2 === prev.q2 &&
            quartersOpen.q3 === prev.q3 &&
            quartersOpen.q4 === prev.q4
          ) {
            return prev;
          }

          return quartersOpen;
        });
      }
    } catch (error) {
      console.error('Error fetching quarterly cycles:', error);
      if (hasFetchedQuarterlyCycles.current === cycleId) {
        hasFetchedQuarterlyCycles.current = null;
      }
    } finally {
      setIsLoadingQuarterlyCycles(false);
    }
  }, [cycleId]);

  const fetchGoalsQuarterlyCycles = useCallback(async () => {
    if (!cycleId) return;
    // Allow re-fetching on refresh - the ref is reset in useEffect
    hasFetchedGoalsQuarterlyCycles.current = cycleId;
    try {
      const result = await cycleService.getGoalsQuarterlyCycles(cycleId);
      if (result.data && result.data.length > 0) {
        const goalsData: Record<number, any> = { 1: {}, 2: {}, 3: {}, 4: {} };
        const quartersOpen: Record<string, boolean> = { q1: false, q2: false, q3: false, q4: false };

        result.data.forEach((cycle: any) => {
          const quarterData: any = {
            allow_late_goal_submission: cycle.allow_late_goal_submission || false,
          };

          if (cycle.quarterly_start_date) {
            quarterData.quarterly_start_date = formatDateForInput(cycle.quarterly_start_date);
          }
          if (cycle.quarterly_end_date) {
            quarterData.quarterly_end_date = formatDateForInput(cycle.quarterly_end_date);
          }
          if (cycle.goal_submission_start_date) {
            quarterData.goal_submission_start_date = formatDateForInput(cycle.goal_submission_start_date);
          }
          if (cycle.goal_submission_end_date) {
            quarterData.goal_submission_end_date = formatDateForInput(cycle.goal_submission_end_date);
          }

          quarterData.manager_review_start_date = cycle.manager_review_start_date
            ? formatDateForInput(cycle.manager_review_start_date)
            : '';
          quarterData.manager_review_end_date = cycle.manager_review_end_date
            ? formatDateForInput(cycle.manager_review_end_date)
            : '';

          goalsData[cycle.quarter] = quarterData;

          if (cycle.goal_submission_start_date) {
            quartersOpen[`q${cycle.quarter}`] = true;
          }
        });

        setGoalsQuarterlyData(goalsData);
        setOpenQuarters(prev => ({
          ...prev,
          ...quartersOpen
        }));
      }
    } catch (error) {
      console.error('Error fetching goals quarterly cycles:', error);
    }
  }, [cycleId]);

  // Fetch cycle data when editing or viewing - placed after function definitions
  useEffect(() => {
    if (!cycleId || (!isEditMode && !isViewMode)) return;

    // Reset fetch flags to allow re-fetching on refresh
    hasFetchedCycle.current = null;
    hasFetchedQuarterlyCycles.current = null;
    hasFetchedGoalsQuarterlyCycles.current = null;
    isInitialLoad.current = false;

    // Fetch all data in parallel
    Promise.all([
      fetchCycle(),
      fetchQuarterlyCycles(), // This loads quarterly dates from quarterly_cycles table
      fetchGoalsQuarterlyCycles() // This loads goals dates from goals_quarterly_cycles table
    ]).catch(error => {
      console.error('Error fetching cycle data:', error);
    });
  }, [cycleId, isEditMode, isViewMode, fetchCycle, fetchQuarterlyCycles, fetchGoalsQuarterlyCycles]);

  const fetchTeams = useCallback(async () => {
    if (hasFetchedTeams.current) {
      return;
    }
    hasFetchedTeams.current = true;
    try {
      const [deptRes, buRes] = await Promise.all([
        settingsService.departments.getAll(),
        settingsService.businessUnits.getAll(),
      ]);

      if (deptRes.data) setDepartments(deptRes.data.map(d => d.name));
      if (buRes.data) setBusinessUnits(buRes.data.map(b => b.name));
    } catch (error) {
      console.error('Error fetching teams:', error);
      hasFetchedTeams.current = false;
    }
  }, []);

  // Fetch teams once on component mount
  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData: FormData = {
        ...prev,
        [name]: value
      };

      if (name.match(/^q[1-4]_(quarter_start_date|quarter_end_date|self_review_start|self_review_end|manager_review_start|manager_review_end)$/)) {
        // Validate quarter dates (including quarter end vs next quarter start validation)
        // This validates all quarters to catch cross-quarter dependencies
        const errors = validateAllQuarterlyReviews(newData);
        setQuarterlyReviewsValidationErrors(errors);
        
        // Also re-validate goals quarterly dates for all quarters when any quarter date changes
        // (since manager_review_start_date depends on quarter dates, and quarter dates affect adjacent quarters)
        [1, 2, 3, 4].forEach(q => {
          const goalsData = goalsQuarterlyData[q] || {};
          const goalsErrors = validateGoalsQuarterlyDates(q, goalsData);
          setGoalsValidationErrors(prevErrors => ({
            ...prevErrors,
            [q]: goalsErrors,
          }));
        });
      }

      return newData;
    });
  };

  const toggleQuarter = (quarter: string) => {
    setOpenQuarters(prev => ({ ...prev, [quarter]: !prev[quarter] }));
  };

  const isDateInRange = (dateStr: string, startStr: string, endStr: string): boolean => {
    if (!dateStr || !startStr || !endStr) return true; // Skip validation if any date is missing
    const date = new Date(dateStr);
    const start = new Date(startStr);
    const end = new Date(endStr);
    return date >= start && date <= end;
  };


  const validateGoalsQuarterlyDates = (quarter: number, data: any): Record<string, string> => {
    const errors: Record<string, string> = {};
    const quarterKey = `q${quarter}` as 'q1' | 'q2' | 'q3' | 'q4';

    const quarterStart = getQuarterlyValue(quarterKey as QuarterKey, 'quarter_start_date') || data.quarterly_start_date;
    const quarterEnd = getQuarterlyValue(quarterKey as QuarterKey, 'quarter_end_date') || data.quarterly_end_date;

    if (!quarterStart || !quarterEnd) return errors; // Skip validation if quarter dates are not set

    // Validate goal submission dates - they must be within quarter range
    const fieldsToValidate = [
      { field: 'goal_submission_start_date', label: 'Goal Submission Start' },
      { field: 'goal_submission_end_date', label: 'Goal Submission End' },
    ];

    fieldsToValidate.forEach(({ field, label }) => {
      if (data[field] && !isDateInRange(data[field], quarterStart, quarterEnd)) {
        errors[field] = `${label} must be between ${quarterStart} and ${quarterEnd}`;
      }
    });

    // Validation: Manager Goal Review Start Date must be:
    // 1. Between goal submission start date and goal submission end date
    // 2. Between quarter start date and quarter end date
    if (data.manager_review_start_date) {
      const managerReviewStart = data.manager_review_start_date;
      const goalSubmissionStart = data.goal_submission_start_date;
      const goalSubmissionEnd = data.goal_submission_end_date;

      // Check if manager review start is between goal submission dates
      if (goalSubmissionStart && goalSubmissionEnd) {
        if (!isDateInRange(managerReviewStart, goalSubmissionStart, goalSubmissionEnd)) {
          errors.manager_review_start_date = `Manager Goal Review Start Date must be between Goal Submission Start Date (${goalSubmissionStart}) and Goal Submission End Date (${goalSubmissionEnd})`;
        }
      }

      // Check if manager review start is between quarter dates
      if (!isDateInRange(managerReviewStart, quarterStart, quarterEnd)) {
        errors.manager_review_start_date = errors.manager_review_start_date 
          ? `${errors.manager_review_start_date} and between Quarter Start Date (${quarterStart}) and Quarter End Date (${quarterEnd})`
          : `Manager Goal Review Start Date must be between Quarter Start Date (${quarterStart}) and Quarter End Date (${quarterEnd})`;
      }
    }

    return errors;
  };


  const validateQuarterlyReviewsDates = (quarter: 'q1' | 'q2' | 'q3' | 'q4', data: FormData): Record<string, string> => {
    const errors: Record<string, string> = {};
    
    // Validation 1: Quarter end date should be before next quarter start date
    const quarterNum = parseInt(quarter.replace('q', ''));
    const currentQuarterEnd = getQuarterlyValue(quarter as QuarterKey, 'quarter_end_date');
    
    if (currentQuarterEnd && quarterNum < 4) {
      // Check against next quarter
      const nextQuarter = `q${quarterNum + 1}` as QuarterKey;
      const nextQuarterStart = getQuarterlyValue(nextQuarter, 'quarter_start_date');
      
      if (nextQuarterStart) {
        const currentEnd = new Date(currentQuarterEnd);
        const nextStart = new Date(nextQuarterStart);
        
        // Compare dates only (ignore time) - allow same day
        const currentEndDate = new Date(currentEnd.getFullYear(), currentEnd.getMonth(), currentEnd.getDate());
        const nextStartDate = new Date(nextStart.getFullYear(), nextStart.getMonth(), nextStart.getDate());
        
        // Q1 end date must be before or equal to Q2 start date (same day is valid)
        if (currentEndDate > nextStartDate) {
          errors[`${quarter}_quarter_end_date`] = `Quarter ${quarterNum} end date must be before or equal to Quarter ${quarterNum + 1} start date`;
        }
      }
    }
    
    // Validation 2: If this is not Q1, check previous quarter end date
    if (quarterNum > 1) {
      const prevQuarter = `q${quarterNum - 1}` as QuarterKey;
      const prevQuarterEnd = getQuarterlyValue(prevQuarter, 'quarter_end_date');
      const currentQuarterStart = getQuarterlyValue(quarter as QuarterKey, 'quarter_start_date');
      
      if (prevQuarterEnd && currentQuarterStart) {
        const prevEnd = new Date(prevQuarterEnd);
        const currentStart = new Date(currentQuarterStart);
        
        // Compare dates only (ignore time) - allow same day
        const prevEndDate = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), prevEnd.getDate());
        const currentStartDate = new Date(currentStart.getFullYear(), currentStart.getMonth(), currentStart.getDate());
        
        // Q2 start date must be after or equal to Q1 end date (same day is valid)
        if (prevEndDate > currentStartDate) {
          errors[`${quarter}_quarter_start_date`] = `Quarter ${quarterNum} start date must be after or equal to Quarter ${quarterNum - 1} end date`;
        }
      }
    }
    
    return errors;
  };


  const validateAllQuarterlyReviews = (data: FormData): Record<string, string> => {
    const allErrors: Record<string, string> = {};
    const quarters: Array<'q1' | 'q2' | 'q3' | 'q4'> = ['q1', 'q2', 'q3', 'q4'];

    // Validate all quarters to catch cross-quarter dependencies
    // (e.g., Q2 end date vs Q3 start date)
    quarters.forEach(quarter => {
      const quarterErrors = validateQuarterlyReviewsDates(quarter, data);
      Object.assign(allErrors, quarterErrors);
    });

    return allErrors;
  };

  const updateGoalsQuarterlyData = (quarter: number, field: string, value: any) => {
    setGoalsQuarterlyData(prev => {
      const newData = {
        ...prev,
        [quarter]: {
          ...prev[quarter],
          [field]: value,
        },
      };

      // Validate goals quarterly dates
      // This will also validate manager_review_start_date against goal submission dates and quarter dates
      const errors = validateGoalsQuarterlyDates(quarter, newData[quarter]);
      setGoalsValidationErrors(prevErrors => ({
        ...prevErrors,
        [quarter]: errors,
      }));

      // If goal submission dates changed, we need to re-validate manager_review_start_date
      // This is already handled in validateGoalsQuarterlyDates, but we ensure it runs
      if (field === 'goal_submission_start_date' || field === 'goal_submission_end_date') {
        // Re-validate to ensure manager_review_start_date is still valid
        const revalidatedErrors = validateGoalsQuarterlyDates(quarter, newData[quarter]);
        setGoalsValidationErrors(prevErrors => ({
          ...prevErrors,
          [quarter]: revalidatedErrors,
        }));
      }

      return newData;
    });
  };

  const toggleDepartment = useCallback((dept: string) => {
    if (isUpdatingState.current) {
      return;
    }
    hasUserModifiedDepartments.current = true;
    isUpdatingState.current = true;
    setSelectedDepartments(prev => {
      const newValue = prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept];
      if (newValue.length === prev.length && newValue.every((val, idx) => val === prev[idx])) {
        isUpdatingState.current = false;
        return prev;
      }
      setTimeout(() => {
        isUpdatingState.current = false;
      }, 0);
      return newValue;
    });
  }, []);

  const toggleBusinessUnit = useCallback((bu: string) => {
    if (isUpdatingState.current) {
      return;
    }
    hasUserModifiedBusinessUnits.current = true;
    isUpdatingState.current = true;
    setSelectedBusinessUnits(prev => {
      const newValue = prev.includes(bu) ? prev.filter(b => b !== bu) : [...prev, bu];
      if (newValue.length === prev.length && newValue.every((val, idx) => val === prev[idx])) {
        isUpdatingState.current = false;
        return prev;
      }
      setTimeout(() => {
        isUpdatingState.current = false;
      }, 0);
      return newValue;
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isViewMode) {
      return; // Prevent submission in view mode
    }

    let hasValidationErrors = false;
    const allGoalsErrors: Record<number, Record<string, string>> = { 1: {}, 2: {}, 3: {}, 4: {} };

    for (let quarter = 1; quarter <= 4; quarter++) {
      const quarterData = goalsQuarterlyData[quarter];
      if (quarterData && Object.keys(quarterData).length > 0) {
        const errors = validateGoalsQuarterlyDates(quarter, quarterData);
        allGoalsErrors[quarter] = errors;
        if (Object.keys(errors).length > 0) {
          hasValidationErrors = true;
        }
      }
    }

    setGoalsValidationErrors(allGoalsErrors);

    const quarterlyReviewsErrors = validateAllQuarterlyReviews(formData);
    setQuarterlyReviewsValidationErrors(quarterlyReviewsErrors);

    if (Object.keys(quarterlyReviewsErrors).length > 0) {
      hasValidationErrors = true;
    }

    if (hasValidationErrors) {
      toast({
        title: 'Validation Error',
        description: 'Some dates are outside their quarter date range. Please fix the errors before saving.',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const submitData: Record<string, any> = {
        name: formData.name,
        description: formData.description,
        year: Number(formData.year),

        calibration_start: formData.calibration_start,
        calibration_end: formData.calibration_end,
        release_date: formData.release_date,
        applicable_departments: applyToAll ? null : (selectedDepartments.length > 0 ? selectedDepartments : null),
        applicable_business_units: applyToAll ? null : (selectedBusinessUnits.length > 0 ? selectedBusinessUnits : null),
      };

      if (!isEditMode) {
        submitData.created_by = user?.id;
        submitData.status = 'draft';
      }

      let hasErrors = false;

      if (isEditMode && cycleId) {
        console.log('Updating cycle with data:', submitData);
        const updateResult = await cycleService.update(cycleId, submitData);
        console.log('Cycle update result:', updateResult);

        const yearEndMgrStart = formData.manager_evaluation_start;
        const yearEndMgrEnd = formData.manager_evaluation_end;

        for (let quarter = 1; quarter <= 4; quarter++) {
          const quarterKey = `q${quarter}` as 'q1' | 'q2' | 'q3' | 'q4';
          const quarterStart = getQuarterlyValue(quarterKey as QuarterKey, 'quarter_start_date');
          const quarterEnd = getQuarterlyValue(quarterKey as QuarterKey, 'quarter_end_date');
          const selfStart = getQuarterlyValue(quarterKey as QuarterKey, 'self_review_start');
          const selfEnd = getQuarterlyValue(quarterKey as QuarterKey, 'self_review_end');
          const mgrStart = getQuarterlyValue(quarterKey as QuarterKey, 'manager_review_start');
          const mgrEnd = getQuarterlyValue(quarterKey as QuarterKey, 'manager_review_end');

          try {
            const quarterlyData: any = {};

            // Always include quarter dates if they exist (even if empty string, backend will handle defaults)
            if (quarterStart && quarterStart.trim()) quarterlyData.quarter_start_date = quarterStart;
            if (quarterEnd && quarterEnd.trim()) quarterlyData.quarter_end_date = quarterEnd;

            if (quarter === 4) {
              // Q4: self review dates (nullable)
              if (selfStart && selfStart.trim()) quarterlyData.self_review_start_date = selfStart;
              if (selfEnd && selfEnd.trim()) quarterlyData.self_review_end_date = selfEnd;

              // Q4: manager review dates (use year-end if provided, otherwise quarterly)
              if (yearEndMgrStart && yearEndMgrStart.trim()) {
                quarterlyData.manager_review_start_date = yearEndMgrStart;
              } else if (mgrStart && mgrStart.trim()) {
                quarterlyData.manager_review_start_date = mgrStart;
              }
              
              if (yearEndMgrEnd && yearEndMgrEnd.trim()) {
                quarterlyData.manager_review_end_date = yearEndMgrEnd;
              } else if (mgrEnd && mgrEnd.trim()) {
                quarterlyData.manager_review_end_date = mgrEnd;
              }
            } else {
              // Q1-Q3: self review dates (nullable)
              if (selfStart && selfStart.trim()) quarterlyData.self_review_start_date = selfStart;
              if (selfEnd && selfEnd.trim()) quarterlyData.self_review_end_date = selfEnd;
              
              // Q1-Q3: manager review dates (required)
              if (mgrStart && mgrStart.trim()) quarterlyData.manager_review_start_date = mgrStart;
              if (mgrEnd && mgrEnd.trim()) quarterlyData.manager_review_end_date = mgrEnd;
            }

            // Save if we have at least one field to update
            if (Object.keys(quarterlyData).length > 0) {
              console.log(`Saving Q${quarter} quarterly cycle:`, quarterlyData);
              await cycleService.updateQuarterlyCycle(cycleId, quarter, quarterlyData);
            } else {
              console.log(`Skipping Q${quarter} - no data to save`);
            }
          } catch (error: any) {
            hasErrors = true;
            console.error(`Error saving Q${quarter} evaluations:`, error);
            const errorMessage = error.message || 'Unknown error';
            const errorDetails = error.details 
              ? (Array.isArray(error.details) ? error.details.join(', ') : error.details)
              : '';
            toast({
              title: 'Error',
              description: `Failed to save Q${quarter} evaluation settings: ${errorMessage}${errorDetails ? `. ${errorDetails}` : ''}`,
              variant: 'destructive'
            });
            // Don't return - continue saving other quarters
          }
        }

        for (let quarter = 1; quarter <= 4; quarter++) {
          const quarterData = goalsQuarterlyData[quarter];
          if (quarterData && Object.keys(quarterData).length > 0) {
            // Filter out empty strings and false values, but keep valid data
            const filteredData: any = {};
            Object.keys(quarterData).forEach(key => {
              const value = quarterData[key];
              if (value !== '' && value !== false && value !== null && value !== undefined) {
                filteredData[key] = value;
              }
            });
            
            if (Object.keys(filteredData).length > 0) {
              try {
                console.log(`Saving Q${quarter} goals quarterly cycle:`, filteredData);
                await cycleService.updateGoalsQuarterlyCycle(cycleId, quarter, filteredData);
              } catch (error: any) {
                hasErrors = true;
                console.error(`Error saving Q${quarter} goals:`, error);
                const errorMessage = error.message || 'Unknown error';
                const errorDetails = error.details 
                  ? (Array.isArray(error.details) ? error.details.join(', ') : error.details)
                  : '';
                toast({
                  title: 'Error',
                  description: `Failed to save Q${quarter} goals settings: ${errorMessage}${errorDetails ? `. ${errorDetails}` : ''}`,
                  variant: 'destructive'
                });
                // Don't return - continue saving other quarters
              }
            } else {
              console.log(`Skipping Q${quarter} goals - no valid data to save`);
            }
          }
        }
      } else {
        const createdCycle = await cycleService.create(submitData);

        if (createdCycle.data?.id) {
          for (let quarter = 1; quarter <= 4; quarter++) {
            const quarterData = goalsQuarterlyData[quarter];
            if (quarterData && Object.keys(quarterData).length > 0) {
              const hasData = Object.values(quarterData).some(v => v !== '' && v !== false);
              if (hasData) {
                try {
                  await cycleService.updateGoalsQuarterlyCycle(createdCycle.data.id, quarter, quarterData);
                } catch (error: any) {
                  hasErrors = true;
                  console.error(`Error saving Q${quarter} goals:`, error);
                  const errorMessage = error.message || 'Unknown error';
                  const errorDetails = error.details 
                    ? (Array.isArray(error.details) ? error.details.join(', ') : error.details)
                    : '';
                  toast({
                    title: 'Error',
                    description: `Failed to save Q${quarter} goals settings: ${errorMessage}${errorDetails ? `. ${errorDetails}` : ''}`,
                    variant: 'destructive'
                  });
                }
              }
            }
          }
        }
      }

      // Only show success toast and navigate if no errors occurred
      if (!hasErrors) {
        console.log('All updates completed successfully');
        toast({
          title: isEditMode ? 'Cycle Updated' : 'Cycle Created',
          description: `The performance cycle has been ${isEditMode ? 'updated' : 'created'} successfully.`
        });
        
        // Small delay before navigation to ensure toast is visible
        setTimeout(() => {
          navigate('/admin/cycles');
        }, 500);
      } else {
        // Show summary error if there were errors
        toast({
          title: 'Save Incomplete',
          description: 'Some settings could not be saved. Please check the error messages above and try again.',
          variant: 'destructive'
        });
      }
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

  const QuarterlySettingsSection = ({ quarter, label, quarterNum }: { quarter: 'q1' | 'q2' | 'q3' | 'q4'; label: string; quarterNum: number }) => {
    const goalsData = goalsQuarterlyData[quarterNum] || {};
    const goalsErrors = goalsValidationErrors[quarterNum] || {};

    const selfStartError = quarterlyReviewsValidationErrors[`${quarter}_self_review_start`];
    const selfEndError = quarterlyReviewsValidationErrors[`${quarter}_self_review_end`];
    const evalMgrStartError = quarterlyReviewsValidationErrors[`${quarter}_manager_review_start`];
    const evalMgrEndError = quarterlyReviewsValidationErrors[`${quarter}_manager_review_end`];

    const hasGoalsErrors = Object.keys(goalsErrors).length > 0;
    const hasReviewErrors = selfStartError || selfEndError || evalMgrStartError || evalMgrEndError;
    const hasErrors = hasGoalsErrors || hasReviewErrors;

    const quarterStartDate = getQuarterlyValue(quarter as QuarterKey, 'quarter_start_date');
    const quarterEndDate = getQuarterlyValue(quarter as QuarterKey, 'quarter_end_date');

    return (
      <Collapsible open={openQuarters[quarter]} onOpenChange={() => toggleQuarter(quarter)}>
        <Card className={cn("mt-4", hasErrors && "border-destructive")}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  <CardTitle className="text-base">{label} Quarterly Settings</CardTitle>
                  {/* {hasErrors && <span className="text-xs text-destructive">(Has validation errors)</span>} */}
                </div>
                <ChevronDown className={cn("h-5 w-5 transition-transform", openQuarters[quarter] && "rotate-180")} />
              </div>
              <CardDescription>Set goal submissions and review dates for {label}</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-6 pt-0">
              {/* Quarter Date Range */}
              <div>
                {/* <h4 className="text-sm font-medium mb-3 text-muted-foreground">Quarter Date Range</h4> */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`${quarter}_quarter_start_date`}>Quarter Start Date</Label>
                    <Input
                      id={`${quarter}_quarter_start_date`}
                      name={`${quarter}_quarter_start_date`}
                      type="date"
                      value={getQuarterlyValue(quarter as QuarterKey, 'quarter_start_date')}
                      onChange={handleChange}
                      readOnly={isViewMode}
                      className={cn(quarterlyReviewsValidationErrors[`${quarter}_quarter_start_date`] && "border-destructive")}
                    />
                    {quarterlyReviewsValidationErrors[`${quarter}_quarter_start_date`] && (
                      <p className="text-xs text-destructive">{quarterlyReviewsValidationErrors[`${quarter}_quarter_start_date`]}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${quarter}_quarter_end_date`}>Quarter End Date</Label>
                    <Input
                      id={`${quarter}_quarter_end_date`}
                      name={`${quarter}_quarter_end_date`}
                      type="date"
                      value={getQuarterlyValue(quarter as QuarterKey, 'quarter_end_date')}
                      onChange={handleChange}
                      readOnly={isViewMode}
                      className={cn(quarterlyReviewsValidationErrors[`${quarter}_quarter_end_date`] && "border-destructive")}
                    />
                    {quarterlyReviewsValidationErrors[`${quarter}_quarter_end_date`] && (
                      <p className="text-xs text-destructive">{quarterlyReviewsValidationErrors[`${quarter}_quarter_end_date`]}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* {quarterStartDate && quarterEndDate && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    All dates below must be between <strong>{quarterStartDate}</strong> and <strong>{quarterEndDate}</strong>
                  </AlertDescription>
                </Alert>
              )} */}

              {/* Goal Submission */}
              <div>
                {/* <h4 className="text-sm font-medium mb-3 text-muted-foreground">Goal Submission</h4> */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`${quarter}_goal_submission_start`}>Goal Submission Start</Label>
                    <Input
                      id={`${quarter}_goal_submission_start`}
                      type="date"
                      value={goalsData.goal_submission_start_date || ''}
                      readOnly={isViewMode}
                      onChange={(e) => updateGoalsQuarterlyData(quarterNum, 'goal_submission_start_date', e.target.value)}
                      className={cn(goalsErrors.goal_submission_start_date && "border-destructive")}
                    />
                    {goalsErrors.goal_submission_start_date && (
                      <p className="text-xs text-destructive">{goalsErrors.goal_submission_start_date}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${quarter}_goal_submission_end`}>Goal Submission End</Label>
                    <Input
                      id={`${quarter}_goal_submission_end`}
                      type="date"
                      value={goalsData.goal_submission_end_date || ''}
                      readOnly={isViewMode}
                      onChange={(e) => updateGoalsQuarterlyData(quarterNum, 'goal_submission_end_date', e.target.value)}
                      className={cn(goalsErrors.goal_submission_end_date && "border-destructive")}
                    />
                    {goalsErrors.goal_submission_end_date && (
                      <p className="text-xs text-destructive">{goalsErrors.goal_submission_end_date}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Manager Goal Review */}
              <div>
                {/* <h4 className="text-sm font-medium mb-3 text-muted-foreground">Manager Goal Review</h4> */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`${quarter}_mgr_goal_review_start`}>Manager Goal Review Start</Label>
                    <Input
                      id={`${quarter}_mgr_goal_review_start`}
                      type="date"
                      value={goalsData.manager_review_start_date || ''}
                      readOnly={isViewMode}
                      onChange={(e) => updateGoalsQuarterlyData(quarterNum, 'manager_review_start_date', e.target.value)}
                      className={cn(goalsErrors.manager_review_start_date && "border-destructive")}
                    />
                    {goalsErrors.manager_review_start_date && (
                      <p className="text-xs text-destructive">{goalsErrors.manager_review_start_date}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${quarter}_mgr_goal_review_end`}>Manager Goal Review End</Label>
                    <Input
                      id={`${quarter}_mgr_goal_review_end`}
                      type="date"
                      value={goalsData.manager_review_end_date || ''}
                      readOnly={isViewMode}
                      onChange={(e) => updateGoalsQuarterlyData(quarterNum, 'manager_review_end_date', e.target.value)}
                      className={cn(goalsErrors.manager_review_end_date && "border-destructive")}
                    />
                    {goalsErrors.manager_review_end_date && (
                      <p className="text-xs text-destructive">{goalsErrors.manager_review_end_date}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Employee Review (Self Review) */}
              <div>
                {/* <h4 className="text-sm font-medium mb-3 text-muted-foreground">Employee Review</h4> */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`${quarter}_self_review_start`}>Employee Performance Review Start</Label>
                    <Input
                      id={`${quarter}_self_review_start`}
                      name={`${quarter}_self_review_start`}
                      type="date"
                      value={getQuarterlyValue(quarter as QuarterKey, 'self_review_start')}
                      onChange={handleChange}
                      readOnly={isViewMode}
                      className={cn(selfStartError && "border-destructive")}
                    />
                    {selfStartError && (
                      <p className="text-xs text-destructive">{selfStartError}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${quarter}_self_review_end`}>Employee Performance Review End</Label>
                    <Input
                      id={`${quarter}_self_review_end`}
                      name={`${quarter}_self_review_end`}
                      type="date"
                      value={getQuarterlyValue(quarter as QuarterKey, 'self_review_end')}
                      onChange={handleChange}
                      readOnly={isViewMode}
                      className={cn(selfEndError && "border-destructive")}
                    />
                    {selfEndError && (
                      <p className="text-xs text-destructive">{selfEndError}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Manager Review (Evaluation) */}
              <div>
                {/* <h4 className="text-sm font-medium mb-3 text-muted-foreground">Manager Review</h4> */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`${quarter}_manager_review_start`}>Manager Employees Performance Review Start Date</Label>
                    <Input
                      id={`${quarter}_manager_review_start`}
                      name={`${quarter}_manager_review_start`}
                      type="date"
                      value={getQuarterlyValue(quarter as QuarterKey, 'manager_review_start')}
                      onChange={handleChange}
                      readOnly={isViewMode}
                      className={cn(evalMgrStartError && "border-destructive")}
                    />
                    {evalMgrStartError && (
                      <p className="text-xs text-destructive">{evalMgrStartError}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${quarter}_manager_review_end`} className="mb-2">Manager Employees Performance Review End Date</Label>
                    <Input
                      id={`${quarter}_manager_review_end`}
                      name={`${quarter}_manager_review_end`}
                      type="date"
                      value={getQuarterlyValue(quarter as QuarterKey, 'manager_review_end')}
                      onChange={handleChange}
                      readOnly={isViewMode}
                      className={cn(evalMgrEndError && "border-destructive margin-top-4")}
                    />
                    {evalMgrEndError && (
                      <p className="text-xs text-destructive">{evalMgrEndError}</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  };

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
    <MainLayout >
      <div className="space-y-6 max-w-3xl ">
        <div className="flex items-center gap-4">
          <Link to="/admin/cycles">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {isViewMode ? 'View Performance Cycle' : isEditMode ? 'Edit Performance Cycle' : 'Create Performance Cycle'}
            </h1>
            <p className="text-muted-foreground">
              {isViewMode ? 'View the performance review cycle details' : isEditMode ? 'Update the performance review cycle settings' : 'Set up a new performance review cycle with dates for each phase'}
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
                    readOnly={isViewMode}
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
                    value={formData.year}
                    onChange={handleChange}
                    readOnly={isViewMode}
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
                  readOnly={isViewMode}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
{/* 
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
                        {departments.map(dept => {
                          const isSelected = selectedDepartments.includes(dept);
                          return (
                            <div
                              key={dept}
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer transition-colors",
                                isSelected
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "hover:bg-muted"
                              )}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleDepartment(dept);
                              }}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  toggleDepartment(dept);
                                }
                              }}
                            >
                              <Checkbox
                                checked={isSelected}
                                className="pointer-events-none"
                                aria-checked={isSelected}
                              />
                              <span className="text-sm">{dept}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {businessUnits.length > 0 && (
                    <div className="space-y-2">
                      <Label>Business Units</Label>
                      <div className="flex flex-wrap gap-2">
                        {businessUnits.map(bu => {
                          const isSelected = selectedBusinessUnits.includes(bu);
                          return (
                            <div
                              key={bu}
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer transition-colors",
                                isSelected
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "hover:bg-muted"
                              )}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleBusinessUnit(bu);
                              }}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  toggleBusinessUnit(bu);
                                }
                              }}
                            >
                              <Checkbox
                                checked={isSelected}
                                className="pointer-events-none"
                                aria-checked={isSelected}
                              />
                              <span className="text-sm">{bu}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card> */}

          <div className="mt-6">
            <h2 className="text-lg font-semibold mb-2">Quarterly Settings</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Configure goal submissions, manager goal reviews, and performance evaluations for each quarter.
            </p>
            <QuarterlySettingsSection quarter="q1" label="Q1" quarterNum={1} />
            <QuarterlySettingsSection quarter="q2" label="Q2" quarterNum={2} />
            <QuarterlySettingsSection quarter="q3" label="Q3" quarterNum={3} />
            <QuarterlySettingsSection quarter="q4" label="Q4" quarterNum={4} />
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

          {/* <Card className="mt-6">
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
          </Card> */}

          <div className="mt-6 flex gap-4">
            {!isViewMode && (
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
            )}
            {isViewMode && cycleId && (
              <Link to={`/admin/cycles/${cycleId}/edit`}>
                <Button type="button">
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Cycle
                </Button>
              </Link>
            )}
            <Link to="/admin/cycles">
              <Button type="button" variant="outline">{isViewMode ? 'Back' : 'Cancel'}</Button>
            </Link>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
