import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { ArrowLeft, Calendar, Loader2, ChevronDown, Users, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { PerformanceCycle } from '@/types';

export default function CycleForm() {
  const navigate = useNavigate();
  const { cycleId } = useParams();
  const isEditMode = Boolean(cycleId);
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

  const [formData, setFormData] = useState({
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
  }, [cycleId]);

  // Fetch teams once on component mount
  useEffect(() => {
    fetchTeams();
    // fetchTeams is memoized with useCallback and has no dependencies, so it's stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch cycle data when editing
  useEffect(() => {
    // Prevent multiple initial loads
    if (isInitialLoad.current && isEditMode && cycleId) {
      return;
    }
    
    // Prevent running during state updates to avoid infinite loops
    if (isUpdatingState.current) {
      return;
    }
    
    if (isEditMode && cycleId) {
      isInitialLoad.current = true;
      isUpdatingState.current = true;
      Promise.all([
        fetchCycle(),
        fetchGoalsQuarterlyCycles(),
        fetchQuarterlyCycles()
      ]).finally(() => {
        // Clear the flag after a short delay to ensure all state updates are complete
        setTimeout(() => {
          isUpdatingState.current = false;
        }, 100);
      });
    }
    // fetchCycle, fetchGoalsQuarterlyCycles, and fetchQuarterlyCycles are memoized and depend on cycleId
    // which is already in the dependency array, so we don't need to include them
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleId, isEditMode]);

  // Helper function to format date for HTML date input (YYYY-MM-DD)
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
    // Prevent multiple simultaneous calls
    if (hasFetchedCycle.current === cycleId) {
      return;
    }
    hasFetchedCycle.current = cycleId;
    setIsLoading(true);
    try {
      const result = await cycleService.getById(cycleId);

      if (result.data) {
        // Use type assertion to handle API response with additional fields
        const data = result.data as PerformanceCycle & {
          description?: string;
          q1_self_review_start?: string | null;
          q1_self_review_end?: string | null;
          q1_manager_review_start?: string | null;
          q1_manager_review_end?: string | null;
          q2_self_review_start?: string | null;
          q2_self_review_end?: string | null;
          q2_manager_review_start?: string | null;
          q2_manager_review_end?: string | null;
          q3_self_review_start?: string | null;
          q3_self_review_end?: string | null;
          q3_manager_review_start?: string | null;
          q3_manager_review_end?: string | null;
          q4_self_review_start?: string | null;
          q4_self_review_end?: string | null;
          q4_manager_review_start?: string | null;
          q4_manager_review_end?: string | null;
          applicable_departments?: string[] | null;
          applicable_business_units?: string[] | null;
        };
        
        // Only update formData if values actually changed to prevent infinite loops
        setFormData(prev => {
          const newFormData = {
            name: data.name || '',
            description: data.description || '',
            year: data.year || new Date().getFullYear(),
            goal_submission_start: '', // Deprecated - using quarterly goals now
            goal_submission_end: '', // Deprecated - using quarterly goals now
            goal_approval_end: '', // Deprecated - using quarterly goals now
            manager_evaluation_start: formatDateForInput(data.manager_evaluation_start),
            manager_evaluation_end: formatDateForInput(data.manager_evaluation_end),
            calibration_start: formatDateForInput(data.calibration_start),
            calibration_end: formatDateForInput(data.calibration_end),
            release_date: formatDateForInput(data.release_date),
            allow_late_goal_submission: false, // Deprecated - using quarterly goals now
            // Q1 Quarterly Review (dates loaded from quarterly_cycles table via fetchQuarterlyCycles)
            q1_quarter_start_date: prev.q1_quarter_start_date || '',
            q1_quarter_end_date: prev.q1_quarter_end_date || '',
            q1_self_review_start: formatDateForInput(data.q1_self_review_start),
            q1_self_review_end: formatDateForInput(data.q1_self_review_end),
            q1_manager_review_start: formatDateForInput(data.q1_manager_review_start),
            q1_manager_review_end: formatDateForInput(data.q1_manager_review_end),
            // Q2 Quarterly Review
            q2_quarter_start_date: prev.q2_quarter_start_date || '',
            q2_quarter_end_date: prev.q2_quarter_end_date || '',
            q2_self_review_start: formatDateForInput(data.q2_self_review_start),
            q2_self_review_end: formatDateForInput(data.q2_self_review_end),
            q2_manager_review_start: formatDateForInput(data.q2_manager_review_start),
            q2_manager_review_end: formatDateForInput(data.q2_manager_review_end),
            // Q3 Quarterly Review
            q3_quarter_start_date: prev.q3_quarter_start_date || '',
            q3_quarter_end_date: prev.q3_quarter_end_date || '',
            q3_self_review_start: formatDateForInput(data.q3_self_review_start),
            q3_self_review_end: formatDateForInput(data.q3_self_review_end),
            q3_manager_review_start: formatDateForInput(data.q3_manager_review_start),
            q3_manager_review_end: formatDateForInput(data.q3_manager_review_end),
            // Q4 Quarterly Review
            q4_quarter_start_date: prev.q4_quarter_start_date || '',
            q4_quarter_end_date: prev.q4_quarter_end_date || '',
            q4_self_review_start: formatDateForInput(data.q4_self_review_start),
            q4_self_review_end: formatDateForInput(data.q4_self_review_end),
            q4_manager_review_start: formatDateForInput(data.q4_manager_review_start),
            q4_manager_review_end: formatDateForInput(data.q4_manager_review_end),
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

        // Only update openQuarters if values actually changed
        setOpenQuarters(prev => {
          const quarters = { q1: false, q2: false, q3: false, q4: false };
          if (data.q1_self_review_start) quarters.q1 = true;
          if (data.q2_self_review_start) quarters.q2 = true;
          if (data.q3_self_review_start) quarters.q3 = true;
          if (data.q4_self_review_start) quarters.q4 = true;
          
          // Check if values changed
          if (
            quarters.q1 === prev.q1 &&
            quarters.q2 === prev.q2 &&
            quarters.q3 === prev.q3 &&
            quarters.q4 === prev.q4
          ) {
            return prev; // Return same object reference to prevent re-render
          }
          
          return quarters;
        });
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
    // Prevent multiple simultaneous calls - only check ref
    if (hasFetchedQuarterlyCycles.current === cycleId) {
      return;
    }
    hasFetchedQuarterlyCycles.current = cycleId;
    setIsLoadingQuarterlyCycles(true);
    try {
      const result = await cycleService.getQuarterlyCycles(cycleId);
      if (result.data && result.data.length > 0) {
        const quarterlyData: Record<string, string> = {};
        const quartersOpen: Record<string, boolean> = { q1: false, q2: false, q3: false, q4: false };
        let yearEndMgrStart = '';
        let yearEndMgrEnd = '';
        
        result.data.forEach((item: any) => {
          const quarterKey = `q${item.quarter}`;
          
          // Load quarter date range for validation
          quarterlyData[`${quarterKey}_quarter_start_date`] = formatDateForInput(item.quarter_start_date);
          quarterlyData[`${quarterKey}_quarter_end_date`] = formatDateForInput(item.quarter_end_date);
          
          // Load review dates
          quarterlyData[`${quarterKey}_self_review_start`] = formatDateForInput(item.self_review_start_date);
          quarterlyData[`${quarterKey}_self_review_end`] = formatDateForInput(item.self_review_end_date);
          
          // Always set quarterly manager review dates for all quarters (including Q4)
          quarterlyData[`${quarterKey}_manager_review_start`] = formatDateForInput(item.quarterly_manager_review_start_date);
          quarterlyData[`${quarterKey}_manager_review_end`] = formatDateForInput(item.quarterly_manager_review_end_date);
          
          // For Q4, ALSO use manager review dates for year-end manager evaluation
          // (Year-end evaluations can use Q4's manager review dates)
          if (item.quarter === 4) {
            if (item.quarterly_manager_review_start_date) {
              yearEndMgrStart = formatDateForInput(item.quarterly_manager_review_start_date);
            }
            if (item.quarterly_manager_review_end_date) {
              yearEndMgrEnd = formatDateForInput(item.quarterly_manager_review_end_date);
            }
          }
          
          // Open the quarter if it has any data
          if (item.quarter_start_date || item.self_review_start_date || item.quarterly_manager_review_start_date) {
            quartersOpen[quarterKey] = true;
          }
        });
        
        // Update formData with quarterly cycles data and year-end manager evaluation
        // Only update if values actually changed to prevent infinite loops
        setFormData(prev => {
          let hasChanges = false;
          
          // Check if quarterly data changed
          for (const key in quarterlyData) {
            const newValue = quarterlyData[key] || '';
            const oldValue = (prev[key as keyof typeof prev] as string) || '';
            if (newValue !== oldValue) {
              hasChanges = true;
              break;
            }
          }
          
          // Check if year-end manager evaluation changed
          if (!hasChanges) {
            const newYearEndStart = yearEndMgrStart || '';
            const oldYearEndStart = prev.manager_evaluation_start || '';
            const newYearEndEnd = yearEndMgrEnd || '';
            const oldYearEndEnd = prev.manager_evaluation_end || '';
            
            if (newYearEndStart !== oldYearEndStart || newYearEndEnd !== oldYearEndEnd) {
              hasChanges = true;
            }
          }
          
          if (!hasChanges) {
            return prev; // Return same object reference to prevent re-render
          }
          
          return {
            ...prev,
            ...quarterlyData,
            manager_evaluation_start: yearEndMgrStart || prev.manager_evaluation_start,
            manager_evaluation_end: yearEndMgrEnd || prev.manager_evaluation_end,
          };
        });
        
        // Only update openQuarters if values actually changed
        setOpenQuarters(prev => {
          // Check if values changed
          if (
            quartersOpen.q1 === prev.q1 &&
            quartersOpen.q2 === prev.q2 &&
            quartersOpen.q3 === prev.q3 &&
            quartersOpen.q4 === prev.q4
          ) {
            return prev; // Return same object reference to prevent re-render
          }
          
          return quartersOpen;
        });
      }
    } catch (error) {
      console.error('Error fetching quarterly cycles:', error);
      // Reset flag on error so we can retry if needed
      if (hasFetchedQuarterlyCycles.current === cycleId) {
        hasFetchedQuarterlyCycles.current = null;
      }
      // Don't show error toast - it's okay if no quarterly cycles exist yet
    } finally {
      setIsLoadingQuarterlyCycles(false);
    }
  }, [cycleId]);

  const fetchGoalsQuarterlyCycles = useCallback(async () => {
    if (!cycleId) return;
    // Prevent multiple simultaneous calls
    if (hasFetchedGoalsQuarterlyCycles.current === cycleId) {
      return;
    }
    hasFetchedGoalsQuarterlyCycles.current = cycleId;
    try {
      const result = await cycleService.getGoalsQuarterlyCycles(cycleId);
      if (result.data && result.data.length > 0) {
        const goalsData: Record<number, any> = { 1: {}, 2: {}, 3: {}, 4: {} };
        const quartersOpen: Record<string, boolean> = { q1: false, q2: false, q3: false, q4: false };
        
        result.data.forEach((cycle: any) => {
          goalsData[cycle.quarter] = {
            quarterly_start_date: cycle.quarterly_start_date || '',
            quarterly_end_date: cycle.quarterly_end_date || '',
            goal_submission_start_date: cycle.goal_submission_start_date || '',
            goal_submission_end_date: cycle.goal_submission_end_date || '',
            manager_review_start_date: cycle.goals_manager_review_start_date || '',
            manager_review_end_date: cycle.goals_manager_review_end_date || '',
            allow_late_goal_submission: cycle.allow_late_goal_submission || false,
          };
          if (cycle.goal_submission_start_date) {
            quartersOpen[`q${cycle.quarter}`] = true;
          }
        });
        
        setGoalsQuarterlyData(goalsData);
        // Merge with existing openQuarters - open quarters that have goals data
        setOpenQuarters(prev => ({
          ...prev,
          ...quartersOpen
        }));
      }
    } catch (error) {
      console.error('Error fetching goals quarterly cycles:', error);
      // Don't show error toast - it's okay if no goals cycles exist yet
    }
  }, [cycleId]);

  const fetchTeams = useCallback(async () => {
    // Prevent multiple calls
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
      // Reset flag on error so we can retry
      hasFetchedTeams.current = false;
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = {
        ...prev,
        [name]: value
      };
      
      // Validate quarterly reviews if a relevant field changed
      if (name.match(/^q[1-4]_(quarter_start_date|quarter_end_date|self_review_start|self_review_end|manager_review_start|manager_review_end)$/)) {
        const errors = validateAllQuarterlyReviews(newData);
        setQuarterlyReviewsValidationErrors(errors);
      }
      
      return newData;
    });
  };

  const toggleQuarter = (quarter: string) => {
    setOpenQuarters(prev => ({ ...prev, [quarter]: !prev[quarter] }));
  };

  // Validation helper: Check if a date is within a range
  const isDateInRange = (dateStr: string, startStr: string, endStr: string): boolean => {
    if (!dateStr || !startStr || !endStr) return true; // Skip validation if any date is missing
    const date = new Date(dateStr);
    const start = new Date(startStr);
    const end = new Date(endStr);
    return date >= start && date <= end;
  };

  // Validate goals quarterly data for a specific quarter
  // Quarter dates come from quarterly_cycles (via formData qX_quarter_start_date/qX_quarter_end_date)
  const validateGoalsQuarterlyDates = (quarter: number, data: any): Record<string, string> => {
    const errors: Record<string, string> = {};
    const quarterKey = `q${quarter}` as 'q1' | 'q2' | 'q3' | 'q4';
    
    // Get quarter dates from quarterly reviews (quarterly_cycles table)
    const quarterStart = formData[`${quarterKey}_quarter_start_date` as keyof typeof formData] as string || data.quarterly_start_date;
    const quarterEnd = formData[`${quarterKey}_quarter_end_date` as keyof typeof formData] as string || data.quarterly_end_date;

    if (!quarterStart || !quarterEnd) return errors; // Skip validation if quarter dates are not set

    const fieldsToValidate = [
      { field: 'goal_submission_start_date', label: 'Goal Submission Start' },
      { field: 'goal_submission_end_date', label: 'Goal Submission End' },
      { field: 'manager_review_start_date', label: 'Manager Review Start' },
      { field: 'manager_review_end_date', label: 'Manager Review End' },
    ];

    fieldsToValidate.forEach(({ field, label }) => {
      if (data[field] && !isDateInRange(data[field], quarterStart, quarterEnd)) {
        errors[field] = `${label} must be between ${quarterStart} and ${quarterEnd}`;
      }
    });

    return errors;
  };

  // Validate quarterly reviews data for a specific quarter
  // Only validates that all dates are within Quarter Start Date and Quarter End Date
  const validateQuarterlyReviewsDates = (quarter: 'q1' | 'q2' | 'q3' | 'q4', data: typeof formData): Record<string, string> => {
    const errors: Record<string, string> = {};
    const quarterStart = data[`${quarter}_quarter_start_date` as keyof typeof data] as string;
    const quarterEnd = data[`${quarter}_quarter_end_date` as keyof typeof data] as string;

    if (!quarterStart || !quarterEnd) return errors; // Skip validation if quarter dates are not set

    const fieldsToValidate = [
      { field: `${quarter}_self_review_start`, label: 'Employee Review Start' },
      { field: `${quarter}_self_review_end`, label: 'Employee Review End' },
      { field: `${quarter}_manager_review_start`, label: 'Manager Review Start' },
      { field: `${quarter}_manager_review_end`, label: 'Manager Review End' },
    ];

    fieldsToValidate.forEach(({ field, label }) => {
      const value = data[field as keyof typeof data] as string;
      if (value && !isDateInRange(value, quarterStart, quarterEnd)) {
        errors[field] = `${label} must be between ${quarterStart} and ${quarterEnd}`;
      }
    });

    return errors;
  };

  // Validate all quarterly reviews and update errors state
  const validateAllQuarterlyReviews = (data: typeof formData): Record<string, string> => {
    const allErrors: Record<string, string> = {};
    const quarters: Array<'q1' | 'q2' | 'q3' | 'q4'> = ['q1', 'q2', 'q3', 'q4'];
    
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
      
      // Validate the updated data
      const errors = validateGoalsQuarterlyDates(quarter, newData[quarter]);
      setGoalsValidationErrors(prevErrors => ({
        ...prevErrors,
        [quarter]: errors,
      }));
      
      return newData;
    });
  };

  const toggleDepartment = useCallback((dept: string) => {
    // Prevent updates during state updates to avoid infinite loops
    if (isUpdatingState.current) {
      return;
    }
    hasUserModifiedDepartments.current = true;
    // Set flag to prevent other updates
    isUpdatingState.current = true;
    setSelectedDepartments(prev => {
      const newValue = prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept];
      // Only update if value actually changed
      if (newValue.length === prev.length && newValue.every((val, idx) => val === prev[idx])) {
        isUpdatingState.current = false;
        return prev;
      }
      // Clear flag after state update
      setTimeout(() => {
        isUpdatingState.current = false;
      }, 0);
      return newValue;
    });
  }, []);

  const toggleBusinessUnit = useCallback((bu: string) => {
    // Prevent updates during state updates to avoid infinite loops
    if (isUpdatingState.current) {
      return;
    }
    hasUserModifiedBusinessUnits.current = true;
    // Set flag to prevent other updates
    isUpdatingState.current = true;
    setSelectedBusinessUnits(prev => {
      const newValue = prev.includes(bu) ? prev.filter(b => b !== bu) : [...prev, bu];
      // Only update if value actually changed
      if (newValue.length === prev.length && newValue.every((val, idx) => val === prev[idx])) {
        isUpdatingState.current = false;
        return prev;
      }
      // Clear flag after state update
      setTimeout(() => {
        isUpdatingState.current = false;
      }, 0);
      return newValue;
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all goals quarterly data before submission
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
    
    // Validate all quarterly reviews data before submission
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
        // Annual goal fields removed - using quarterly goals_quarterly_cycles instead
        // manager_evaluation_start/end removed - using quarterly_cycles table instead
        calibration_start: formData.calibration_start,
        calibration_end: formData.calibration_end,
        release_date: formData.release_date,
        applicable_departments: applyToAll ? null : (selectedDepartments.length > 0 ? selectedDepartments : null),
        applicable_business_units: applyToAll ? null : (selectedBusinessUnits.length > 0 ? selectedBusinessUnits : null),
        // allow_late_goal_submission removed - using quarterly goals_quarterly_cycles instead
      };

      if (!isEditMode) {
        submitData.created_by = user?.id;
        submitData.status = 'draft';
      }

      if (isEditMode && cycleId) {
        await cycleService.update(cycleId, submitData);
        
        // Save year-end manager evaluation dates to quarterly_cycles
        // Store them in Q4's quarterly_cycles entry (year-end evaluations happen after Q4)
        const yearEndMgrStart = formData.manager_evaluation_start;
        const yearEndMgrEnd = formData.manager_evaluation_end;
        
        // Save quarterly cycles (evaluations)
        for (let quarter = 1; quarter <= 4; quarter++) {
          const quarterKey = `q${quarter}` as 'q1' | 'q2' | 'q3' | 'q4';
          const quarterStart = formData[`${quarterKey}_quarter_start_date` as keyof typeof formData];
          const quarterEnd = formData[`${quarterKey}_quarter_end_date` as keyof typeof formData];
          const selfStart = formData[`${quarterKey}_self_review_start` as keyof typeof formData];
          const selfEnd = formData[`${quarterKey}_self_review_end` as keyof typeof formData];
          const mgrStart = formData[`${quarterKey}_manager_review_start` as keyof typeof formData];
          const mgrEnd = formData[`${quarterKey}_manager_review_end` as keyof typeof formData];
          
          try {
            const quarterlyData: any = {};
            
            // Save quarter date range (for validation purposes)
            if (quarterStart) quarterlyData.quarter_start_date = quarterStart;
            if (quarterEnd) quarterlyData.quarter_end_date = quarterEnd;
            
            // For Q4, handle quarterly review dates
            // Year-end manager evaluation dates can override Q4's manager review dates
            if (quarter === 4) {
              // Save Q4 quarterly review dates (self and manager)
              if (selfStart) quarterlyData.self_review_start_date = selfStart;
              if (selfEnd) quarterlyData.self_review_end_date = selfEnd;
              
              // Use year-end manager evaluation dates if provided, otherwise use Q4 quarterly manager dates
              if (yearEndMgrStart || yearEndMgrEnd) {
                // Year-end manager evaluation dates take precedence
                quarterlyData.manager_review_start_date = yearEndMgrStart || mgrStart;
                quarterlyData.manager_review_end_date = yearEndMgrEnd || mgrEnd;
              } else {
                // Use Q4 quarterly manager review dates
                if (mgrStart) quarterlyData.manager_review_start_date = mgrStart;
                if (mgrEnd) quarterlyData.manager_review_end_date = mgrEnd;
              }
            } else {
              // For Q1-Q3, save quarterly data normally
              if (selfStart) quarterlyData.self_review_start_date = selfStart;
              if (selfEnd) quarterlyData.self_review_end_date = selfEnd;
              if (mgrStart) quarterlyData.manager_review_start_date = mgrStart;
              if (mgrEnd) quarterlyData.manager_review_end_date = mgrEnd;
            }
            
            // Only save if at least one field is filled
            if (Object.keys(quarterlyData).length > 0) {
              await cycleService.updateQuarterlyCycle(cycleId, quarter, quarterlyData);
            }
          } catch (error: any) {
            console.error(`Error saving Q${quarter} evaluations:`, error);
            toast({
              title: 'Warning',
              description: `Failed to save Q${quarter} evaluation settings: ${error.message}`,
              variant: 'destructive'
            });
          }
        }
        
        // Save goals quarterly cycles
        for (let quarter = 1; quarter <= 4; quarter++) {
          const quarterData = goalsQuarterlyData[quarter];
          if (quarterData && Object.keys(quarterData).length > 0) {
            // Only save if at least one field is filled
            const hasData = Object.values(quarterData).some(v => v !== '' && v !== false);
            if (hasData) {
              try {
                await cycleService.updateGoalsQuarterlyCycle(cycleId, quarter, quarterData);
              } catch (error: any) {
                console.error(`Error saving Q${quarter} goals:`, error);
                toast({
                  title: 'Warning',
                  description: `Failed to save Q${quarter} goals settings: ${error.message}`,
                  variant: 'destructive'
                });
              }
            }
          }
        }
      } else {
        const createdCycle = await cycleService.create(submitData);
        
        // Save goals quarterly cycles for new cycle
        if (createdCycle.data?.id) {
          for (let quarter = 1; quarter <= 4; quarter++) {
            const quarterData = goalsQuarterlyData[quarter];
            if (quarterData && Object.keys(quarterData).length > 0) {
              const hasData = Object.values(quarterData).some(v => v !== '' && v !== false);
              if (hasData) {
                try {
                  await cycleService.updateGoalsQuarterlyCycle(createdCycle.data.id, quarter, quarterData);
                } catch (error: any) {
                  console.error(`Error saving Q${quarter} goals:`, error);
                }
              }
            }
          }
        }
      }

      toast({
        title: isEditMode ? 'Cycle Updated' : 'Cycle Created',
        description: `The performance cycle has been ${isEditMode ? 'updated' : 'created'} successfully.`
      });
      navigate('/admin/cycles');
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

  // Unified Quarterly Settings Section - combines Goals and Reviews
  const QuarterlySettingsSection = ({ quarter, label, quarterNum }: { quarter: 'q1' | 'q2' | 'q3' | 'q4'; label: string; quarterNum: number }) => {
    const goalsData = goalsQuarterlyData[quarterNum] || {};
    const goalsErrors = goalsValidationErrors[quarterNum] || {};
    
    // Review validation errors
    const selfStartError = quarterlyReviewsValidationErrors[`${quarter}_self_review_start`];
    const selfEndError = quarterlyReviewsValidationErrors[`${quarter}_self_review_end`];
    const evalMgrStartError = quarterlyReviewsValidationErrors[`${quarter}_manager_review_start`];
    const evalMgrEndError = quarterlyReviewsValidationErrors[`${quarter}_manager_review_end`];
    
    const hasGoalsErrors = Object.keys(goalsErrors).length > 0;
    const hasReviewErrors = selfStartError || selfEndError || evalMgrStartError || evalMgrEndError;
    const hasErrors = hasGoalsErrors || hasReviewErrors;
    
    const quarterStartDate = formData[`${quarter}_quarter_start_date` as keyof typeof formData] as string;
    const quarterEndDate = formData[`${quarter}_quarter_end_date` as keyof typeof formData] as string;
    
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
                      value={String(formData[`${quarter}_quarter_start_date` as keyof typeof formData] || '')}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${quarter}_quarter_end_date`}>Quarter End Date</Label>
                    <Input
                      id={`${quarter}_quarter_end_date`}
                      name={`${quarter}_quarter_end_date`}
                      type="date"
                      value={String(formData[`${quarter}_quarter_end_date` as keyof typeof formData] || '')}
                      onChange={handleChange}
                    />
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
                    <Label htmlFor={`${quarter}_self_review_start`}>Employee Review Start</Label>
                    <Input
                      id={`${quarter}_self_review_start`}
                      name={`${quarter}_self_review_start`}
                      type="date"
                      value={String(formData[`${quarter}_self_review_start` as keyof typeof formData] || '')}
                      onChange={handleChange}
                      className={cn(selfStartError && "border-destructive")}
                    />
                    {selfStartError && (
                      <p className="text-xs text-destructive">{selfStartError}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${quarter}_self_review_end`}>Employee Review End</Label>
                    <Input
                      id={`${quarter}_self_review_end`}
                      name={`${quarter}_self_review_end`}
                      type="date"
                      value={String(formData[`${quarter}_self_review_end` as keyof typeof formData] || '')}
                      onChange={handleChange}
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
                    <Label htmlFor={`${quarter}_manager_review_start`}>Manager Review Start</Label>
                    <Input
                      id={`${quarter}_manager_review_start`}
                      name={`${quarter}_manager_review_start`}
                      type="date"
                      value={String(formData[`${quarter}_manager_review_start` as keyof typeof formData] || '')}
                      onChange={handleChange}
                      className={cn(evalMgrStartError && "border-destructive")}
                    />
                    {evalMgrStartError && (
                      <p className="text-xs text-destructive">{evalMgrStartError}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${quarter}_manager_review_end`}>Manager Review End</Label>
                    <Input
                      id={`${quarter}_manager_review_end`}
                      name={`${quarter}_manager_review_end`}
                      type="date"
                      value={String(formData[`${quarter}_manager_review_end` as keyof typeof formData] || '')}
                      onChange={handleChange}
                      className={cn(evalMgrEndError && "border-destructive")}
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
    <MainLayout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-4">
          <Link to="/admin/cycles">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {isEditMode ? 'Edit Performance Cycle' : 'Create Performance Cycle'}
            </h1>
            <p className="text-muted-foreground">
              {isEditMode ? 'Update the performance review cycle settings' : 'Set up a new performance review cycle with dates for each phase'}
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
                    max="2030"
                    value={formData.year}
                    onChange={handleChange}
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
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

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
          </Card>

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

          <Card className="mt-6">
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
          </Card>

          <div className="mt-6 flex gap-4">
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
            <Link to="/admin/cycles">
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
