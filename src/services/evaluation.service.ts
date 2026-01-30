// Evaluation Service - Quarterly evaluation API calls
// Uses quarterly_self_reviews and quarterly_manager_reviews tables
import { api } from './api';

// Quarterly Self Review Types
export interface QuarterlySelfReviewData {
  id?: string;
  employee_id: string;
  cycle_id: string;
  quarter: number;
  overall_rating?: number;
  overall_comments?: string;
  status?: string;
  submitted_at?: string;
  created_at?: string;
  updated_at?: string;
}

// Quarterly KPI Progress Types (employee self-ratings)
export interface QuarterlyKpiProgressData {
  id?: string;
  quarterly_review_id: string;
  goal_id: string;
  progress_percentage?: number;
  achievement_to_date?: string;
  challenges?: string;
  self_rating?: number;
  achieved_value?: number | null;
  target_value?: number | null;
  evidence?: string;
}

// Quarterly Manager Review Types
export interface QuarterlyManagerReviewData {
  id?: string;
  employee_id: string;
  cycle_id: string;
  quarter: number;
  reviewer_id: string;
  overall_comments?: string;
  guidance?: string;
  calculated_overall_rating?: number | null;
  status?: string;
  approved_at?: string;
  hr_approved_at?: string;
  released_at?: string;
  employee_acknowledged_at?: string;
  employee_rejected_at?: string;
  created_at?: string;
  updated_at?: string;
}

// Quarterly KPI Manager Rating Types
export interface QuarterlyKpiManagerRatingData {
  id?: string;
  manager_review_id: string;
  goal_id: string;
  rating?: number | null;
  comments?: string;
  manager_achieved_value?: number | null;
  progress_percentage?: number | null;
}

// Goal Self Rating Types (for quarterly reviews)
export interface GoalSelfRatingData {
  id?: string;
  quarterly_review_id: string;
  goal_id: string;
  achievement?: string;
  self_rating?: number;
  evidence?: string;
  achieved_value?: number | null;
  target_value?: number | null;
  created_at?: string;
  updated_at?: string;
}

// Year-End Evaluation Types
export interface YearEndEvaluationData {
  id?: string;
  employee_id: string;
  cycle_id: string;
  evaluator_id: string;
  q1_rating?: number | null;
  q2_rating?: number | null;
  q3_rating?: number | null;
  q4_rating?: number | null;
  calculated_overall_rating?: number | null;
  overall_rating?: number | null;
  overall_comments?: string | null;
  development_recommendations?: string | null;
  potential_rating?: number | null;
  status?: string;
  submitted_at?: string | null;
  released_at?: string | null;
  acknowledged_at?: string | null;
  acknowledgment_comments?: string | null;
  completed_quarters?: number;
  // Joined fields
  employee_name?: string;
  employee_code?: string;
  date_of_joining?: string;
  department?: string;
  evaluator_name?: string;
  evaluator_code?: string;
  created_at?: string;
  updated_at?: string;
}

export const evaluationService = {
  // ========== Quarterly Self Reviews ==========
  selfReviews: {
    get: (employeeId: string, cycleId: string, quarter?: number) => {
      let url = `/api/evaluations/quarterly-self-reviews?employee_id=${employeeId}&cycle_id=${cycleId}`;
      if (quarter) url += `&quarter=${quarter}`;
      return api.get<{ data: QuarterlySelfReviewData[] }>(url);
    },

    getByQuarter: (employeeId: string, cycleId: string, quarter: number) => 
      api.get<{ data: QuarterlySelfReviewData | null }>(
        `/api/evaluations/quarterly-self-reviews?employee_id=${employeeId}&cycle_id=${cycleId}&quarter=${quarter}&single=true`
      ),

    upsert: (data: Omit<QuarterlySelfReviewData, 'id' | 'created_at' | 'updated_at'>) => 
      api.post<{ data: QuarterlySelfReviewData }>(
        '/api/evaluations/quarterly-self-reviews',
        data
      ),
  },

  // ========== Goal Self Ratings (for quarterly reviews) ==========
  goalSelfRatings: {
    get: (quarterlyReviewId: string, goalId?: string) => {
      let url = `/api/evaluations/goal-self-ratings?quarterly_review_id=${quarterlyReviewId}`;
      if (goalId) url += `&goal_id=${goalId}`;
      return api.get<{ data: GoalSelfRatingData[] }>(url);
    },

    upsert: (data: Omit<GoalSelfRatingData, 'id' | 'created_at' | 'updated_at'>) => 
      api.post<{ data: GoalSelfRatingData }>(
        '/api/evaluations/goal-self-ratings',
        data
      ),

    bulkUpsert: (quarterlyReviewId: string, ratings: Omit<GoalSelfRatingData, 'quarterly_review_id' | 'id' | 'created_at' | 'updated_at'>[]) => 
      api.post<{ data: GoalSelfRatingData[] }>(
        '/api/evaluations/goal-self-ratings/bulk',
        { quarterly_review_id: quarterlyReviewId, ratings }
      ),
  },

  // ========== Quarterly Manager Reviews ==========
  managerReviews: {
    get: (employeeId: string, cycleId: string, quarter?: number) => {
      let url = `/api/evaluations/quarterly-manager-reviews?employee_id=${employeeId}&cycle_id=${cycleId}`;
      if (quarter) url += `&quarter=${quarter}`;
      return api.get<{ data: QuarterlyManagerReviewData[] }>(url);
    },

    getByQuarter: (employeeId: string, cycleId: string, quarter: number) => 
      api.get<{ data: QuarterlyManagerReviewData | null }>(
        `/api/evaluations/quarterly-manager-reviews?employee_id=${employeeId}&cycle_id=${cycleId}&quarter=${quarter}&single=true`
      ),

    getCompletedCount: (cycleId: string, reviewerId?: string) => {
      let url = `/api/evaluations/quarterly-manager-reviews/count?cycle_id=${cycleId}&status=submitted`;
      if (reviewerId) url += `&reviewer_id=${reviewerId}`;
      return api.get<{ count: number }>(url);
    },

    upsert: (data: Omit<QuarterlyManagerReviewData, 'id' | 'created_at' | 'updated_at'>) => 
      api.post<{ data: QuarterlyManagerReviewData }>(
        '/api/evaluations/quarterly-manager-reviews',
        data
      ),
  },

  // ========== Quarterly KPI Manager Feedback ==========
  kpiManagerFeedback: {
    getByReview: (managerReviewId: string) => 
      api.get<{ data: QuarterlyKpiManagerRatingData[] }>(
        `/api/evaluations/quarterly-kpi-manager-feedback?manager_review_id=${managerReviewId}`
      ),

    upsert: (data: Omit<QuarterlyKpiManagerRatingData, 'id'>) => 
      api.post<{ data: QuarterlyKpiManagerRatingData }>(
        '/api/evaluations/quarterly-kpi-manager-feedback',
        data
      ),

    bulkUpsert: (managerReviewId: string, ratings: Omit<QuarterlyKpiManagerRatingData, 'manager_review_id' | 'id'>[]) => 
      api.post<{ data: QuarterlyKpiManagerRatingData[] }>(
        '/api/evaluations/quarterly-kpi-manager-feedback/bulk',
        { manager_review_id: managerReviewId, ratings }
      ),
  },

  // ========== HR Review Workflow ==========
  hrReview: {
    getPendingReviews: (cycleId?: string) => {
      let url = '/api/evaluations/hr-pending-reviews';
      if (cycleId) url += `?cycle_id=${cycleId}`;
      return api.get<{ data: any[] }>(url);
    },

    approveReview: (managerReviewId: string) =>
      api.post<{ data: any }>('/api/evaluations/hr-approve-review', { manager_review_id: managerReviewId }),

    rejectReview: (managerReviewId: string, rejectionReason: string) =>
      api.post<{ data: any }>('/api/evaluations/hr-reject-review', { 
        manager_review_id: managerReviewId, 
        rejection_reason: rejectionReason 
      }),
  },

  // ========== Employee Rating Actions ==========
  employeeRating: {
    rejectRating: (managerReviewId: string, rejectionReason: string, cycleId: string, quarter: number) =>
      api.post<{ data: any }>('/api/evaluations/employee-reject-rating', {
        manager_review_id: managerReviewId,
        rejection_reason: rejectionReason,
        cycle_id: cycleId,
        quarter,
      }),

    acceptRating: (managerReviewId: string) =>
      api.post<{ data: any }>('/api/evaluations/employee-accept-rating', { manager_review_id: managerReviewId }),
  },

  // ========== Rating Rejections ==========
  ratingRejections: {
    get: (cycleId?: string, status?: string) => {
      let url = '/api/evaluations/rating-rejections';
      const params = new URLSearchParams();
      if (cycleId) params.append('cycle_id', cycleId);
      if (status) params.append('status', status);
      if (params.toString()) url += `?${params.toString()}`;
      return api.get<{ data: any[] }>(url);
    },
  },

  // ========== Year-End Evaluation ==========
  yearEndEvaluation: {
    get: (employeeId: string, cycleId: string) =>
      api.get<{ data: YearEndEvaluationData | null }>(
        `/api/evaluations/year-end-evaluation?employee_id=${employeeId}&cycle_id=${cycleId}`
      ),

    upsert: (data: Omit<YearEndEvaluationData, 'id' | 'created_at' | 'updated_at'>) =>
      api.post<{ data: YearEndEvaluationData }>(
        '/api/evaluations/year-end-evaluation',
        data
      ),
  },

  // ========== Year-End HR Review ==========
  yearEndHRReview: {
    getPendingReviews: (cycleId?: string) => {
      let url = '/api/evaluations/hr-pending-year-end-reviews';
      if (cycleId) url += `?cycle_id=${cycleId}`;
      return api.get<{ data: any[] }>(url);
    },

    approveReview: (managerEvaluationId: string) =>
      api.post<{ data: any }>('/api/evaluations/hr-approve-year-end-review', { 
        manager_evaluation_id: managerEvaluationId 
      }),

    rejectReview: (managerEvaluationId: string, rejectionReason: string) =>
      api.post<{ data: any }>('/api/evaluations/hr-reject-year-end-review', { 
        manager_evaluation_id: managerEvaluationId, 
        rejection_reason: rejectionReason 
      }),
  },

  // ========== Year-End Employee Rating Actions ==========
  yearEndEmployeeRating: {
    acceptRating: (managerEvaluationId: string) =>
      api.post<{ data: any }>('/api/evaluations/employee-accept-year-end-rating', { 
        manager_evaluation_id: managerEvaluationId 
      }),

    rejectRating: (managerEvaluationId: string, rejectionReason: string, cycleId: string) =>
      api.post<{ data: any }>('/api/evaluations/employee-reject-year-end-rating', {
        manager_evaluation_id: managerEvaluationId,
        rejection_reason: rejectionReason,
        cycle_id: cycleId,
      }),
  },
};
