// Evaluation Service - Quarterly evaluation API calls
// Uses quarterly_self_reviews and quarterly_manager_reviews tables
import { api, API_BASE_URL } from './api';
import type { PeriodType } from './transition.service';

// Quarterly Self Review Types
export interface QuarterlySelfReviewData {
  id?: string;
  employee_id: string;
  cycle_id: string;
  quarter: number;
  overall_rating?: number;
  overall_comments?: string;
  status?: string;
  period_type?: PeriodType;
  transition_id?: string | null;
  period_start_date?: string | null;
  period_end_date?: string | null;
  submitted_at?: string;
  created_at?: string;
  updated_at?: string;
  admin_override?: boolean;
  admin_override_by?: string | null;
  admin_override_at?: string | null;
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
  period_type?: PeriodType;
  transition_id?: string | null;
  period_start_date?: string | null;
  period_end_date?: string | null;
  is_old_manager_review?: boolean;
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
    get: (employeeId: string, cycleId: string, quarter?: number, periodType?: PeriodType | null, transitionId?: string | null) => {
      let url = `/api/evaluations/quarterly-self-reviews?employee_id=${employeeId}&cycle_id=${cycleId}`;
      if (quarter) url += `&quarter=${quarter}`;
      if (periodType) url += `&period_type=${periodType}`;
      if (transitionId) url += `&transition_id=${transitionId}`;
      return api.get<{ data: QuarterlySelfReviewData[] }>(url);
    },

    getByQuarter: (employeeId: string, cycleId: string, quarter: number, periodType?: PeriodType | null, transitionId?: string | null) => {
      let url = `/api/evaluations/quarterly-self-reviews?employee_id=${employeeId}&cycle_id=${cycleId}&quarter=${quarter}`;
      if (periodType) url += `&period_type=${periodType}`;
      if (transitionId) url += `&transition_id=${transitionId}`;
      return api.get<{ data: QuarterlySelfReviewData | null }>(url);
    },

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
    get: (employeeId: string, cycleId: string, quarter?: number, periodType?: PeriodType | null, transitionId?: string | null) => {
      let url = `/api/evaluations/quarterly-manager-reviews?employee_id=${employeeId}&cycle_id=${cycleId}`;
      if (quarter) url += `&quarter=${quarter}`;
      if (periodType) url += `&period_type=${periodType}`;
      if (transitionId) url += `&transition_id=${transitionId}`;
      return api.get<{ data: QuarterlyManagerReviewData[] }>(url);
    },

    getByQuarter: (employeeId: string, cycleId: string, quarter: number, periodType?: PeriodType | null, transitionId?: string | null) => {
      let url = `/api/evaluations/quarterly-manager-reviews?employee_id=${employeeId}&cycle_id=${cycleId}&quarter=${quarter}`;
      if (periodType) url += `&period_type=${periodType}`;
      if (transitionId) url += `&transition_id=${transitionId}`;
      return api.get<{ data: QuarterlyManagerReviewData | null }>(url);
    },

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

  // ========== Period Ratings ==========
  periodRatings: {
    get: (employeeId: string, cycleId: string, quarter?: number, periodType?: PeriodType | null) => {
      let url = `/api/evaluations/period-ratings?employee_id=${employeeId}&cycle_id=${cycleId}`;
      if (quarter) url += `&quarter=${quarter}`;
      if (periodType) url += `&period_type=${periodType}`;
      return api.get<{ data: any[] }>(url);
    },

    calculateFinal: (employeeId: string, cycleId: string, quarter: number, useTimeWeighted?: boolean) =>
      api.post<{ data: any }>(
        '/api/evaluations/calculate-final-rating',
        { employee_id: employeeId, cycle_id: cycleId, quarter, use_time_weighted: useTimeWeighted }
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

  // ========== Manager Rating Rejections ==========
  managerRatingRejections: {
    get: (cycleId?: string, status?: string) => {
      let url = '/api/evaluations/manager-rating-rejections';
      const params = new URLSearchParams();
      if (cycleId) params.append('cycle_id', cycleId);
      if (status) params.append('status', status);
      if (params.toString()) url += `?${params.toString()}`;
      return api.get<{ data: any[] }>(url);
    },
  },

  // ========== Normalized Ratings Workflow ==========
  normalization: {
    normalize: (quarter: number, cycleId: string) =>
      api.post<{ data: { processed: number; skipped: number; message: string } }>(
        `/api/evaluations/hr/normalize?quarter=${quarter}&cycle_id=${cycleId}`
      ),

    getRatings: (quarter: number, cycleId: string, status?: string) => {
      let url = `/api/evaluations/hr/normalized-ratings?quarter=${quarter}&cycle_id=${cycleId}`;
      if (status) url += `&status=${status}`;
      return api.get<{ data: any[] }>(url);
    },

    sendToManager: (employeeIds: string[], quarter: number, cycleId: string) =>
      api.post<{ data: any[]; count: number }>('/api/evaluations/hr/send-to-manager', {
        employeeIds,
        quarter,
        cycleId,
      }),

    managerReview: (employeeId: string, quarter: number, cycleId: string, action: 'ACCEPT' | 'REJECT') =>
      api.post<{ data: any }>('/api/evaluations/manager/review', {
        employeeId,
        quarter,
        cycleId,
        action,
      }),

    getManagerRatings: (managerId: string, quarter: number, cycleId: string) =>
      api.get<{ data: any[] }>(
        `/api/evaluations/manager/normalized-ratings?manager_id=${managerId}&quarter=${quarter}&cycle_id=${cycleId}`
      ),

    publish: (employeeIds: string[], quarter: number, cycleId: string) =>
      api.post<{ data: any[]; count: number }>('/api/evaluations/hr/publish', {
        employeeIds,
        quarter,
        cycleId,
      }),

    updateRating: (id: string, finalNormalizedRating: number, calibratedRating?: number | null) =>
      api.put<{ data: any }>(`/api/evaluations/hr/normalized-rating/${id}`, {
        final_normalized_rating: finalNormalizedRating,
        ...(calibratedRating !== undefined && { calibrated_rating: calibratedRating }),
      }),

    calibrate: (quarter: number, cycleId: string) =>
      api.post<{ data: { processed: number; skipped: number; message: string; distribution?: any } }>(
        `/api/evaluations/hr/calibrate?quarter=${quarter}&cycle_id=${cycleId}`
      ),

    getEmployeeRating: (employeeId: string, quarter: number, cycleId: string, periodType?: PeriodType | null, transitionId?: string | null) => {
      let url = `/api/evaluations/employee/normalized-rating?employee_id=${employeeId}&quarter=${quarter}&cycle_id=${cycleId}`;
      if (periodType) url += `&period_type=${periodType}`;
      if (transitionId) url += `&transition_id=${transitionId}`;
      return api.get<{ data: { calibrated_rating: number | null; status: string; period_type?: PeriodType; transition_id?: string | null } | null }>(url);
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

  // ========== KRA/KPI Rejection Workflow ==========
  kraKpiRejections: {
    get: (params: {
      manager_review_id?: string;
      employee_id?: string;
      cycle_id?: string;
      quarter?: number;
      kra_id?: string;
      goal_id?: string;
    }) => {
      let url = '/api/evaluations/kra-kpi-rejections';
      const queryParams = new URLSearchParams();
      if (params.manager_review_id) queryParams.append('manager_review_id', params.manager_review_id);
      if (params.employee_id) queryParams.append('employee_id', params.employee_id);
      if (params.cycle_id) queryParams.append('cycle_id', params.cycle_id);
      if (params.quarter) queryParams.append('quarter', params.quarter.toString());
      if (params.kra_id) queryParams.append('kra_id', params.kra_id);
      if (params.goal_id) queryParams.append('goal_id', params.goal_id);
      if (queryParams.toString()) url += `?${queryParams.toString()}`;
      return api.get<{ data: any[] }>(url);
    },

    reject: (params: {
      manager_review_id: string;
      kra_id?: string;
      goal_id?: string;
      rejection_reason: string;
      quarter: number;
      cycle_id: string;
      employee_id: string;
      rejection_documents?: string;
    }) =>
      api.post<{ data: any }>('/api/evaluations/reject-kra-kpi', params),

    // Upload rejection documents
    uploadDocuments: async (
      empCode: string,
      quarter: number,
      year: number,
      file: File
    ) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('emp_code', empCode);
      formData.append('quarter', String(quarter));
      formData.append('year', String(year));
      
      console.log('[Upload Documents] Uploading file:', { empCode, quarter, year, fileName: file.name });
      
      const response = await fetch(`${API_BASE_URL}/api/evaluations/rejection-documents/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('[Upload Documents] Upload failed:', error);
        throw new Error(error.message || error.error || 'Failed to upload rejection document');
      }
      
      const result = await response.json();
      console.log('[Upload Documents] Upload success:', result);
      return result;
    },

    resubmit: (rejection_id: string) =>
      api.post<{ data: any }>('/api/evaluations/resubmit-kra-kpi', { rejection_id }),
  },

  // ========== KPI Evidence File Upload ==========
  kpiEvidence: {
    upload: async (
      goalId: string,
      empCode: string,
      quarter: number,
      year: number,
      file: File
    ) => {
      const formData = new FormData();
      formData.append('goal_id', goalId);
      formData.append('emp_code', empCode);
      formData.append('quarter', quarter.toString());
      formData.append('year', year.toString());
      formData.append('file', file); // Single file upload

      // Don't set Content-Type header - browser will set it automatically with boundary
      return api.post<{ success: boolean; files: string[]; message: string }>(
        '/api/evaluations/kpi-evidence/upload',
        formData
      );
    },

    getFiles: (goalId: string, employeeId: string, quarter: number) =>
      api.get<{ files: string[] }>(
        `/api/evaluations/kpi-evidence/files/${goalId}?employee_id=${employeeId}&quarter=${quarter}`
      ),

    deleteFile: (
      goalId: string,
      filePath: string,
      empCode: string,
      quarter: number,
      year: number
    ) =>
      api.delete<{ success: boolean; message: string }>(
        '/api/evaluations/kpi-evidence/file',
        {
          goal_id: goalId,
          file_path: filePath,
          emp_code: empCode,
          quarter,
          year,
        }
      ),
  },

  // ========== Manager Evidence File Upload ==========
  managerEvidence: {
    upload: async (
      managerReviewId: string,
      goalId: string,
      empCode: string,
      quarter: number,
      year: number,
      file: File
    ) => {
      const formData = new FormData();
      formData.append('manager_review_id', managerReviewId);
      formData.append('goal_id', goalId);
      formData.append('emp_code', empCode);
      formData.append('quarter', quarter.toString());
      formData.append('year', year.toString());
      formData.append('file', file); // Single file upload

      // Don't set Content-Type header - browser will set it automatically with boundary
      return api.post<{ success: boolean; files: string[]; message: string }>(
        '/api/evaluations/manager-evidence/upload',
        formData
      );
    },

    getFiles: (goalId: string, managerReviewId: string) =>
      api.get<{ files: string[] }>(
        `/api/evaluations/manager-evidence/files/${goalId}?manager_review_id=${managerReviewId}`
      ),

    deleteFile: (
      managerReviewId: string,
      goalId: string,
      filePath: string
    ) =>
      api.delete<{ success: boolean; message: string }>(
        '/api/evaluations/manager-evidence/file',
        {
          manager_review_id: managerReviewId,
          goal_id: goalId,
          file_path: filePath,
        }
      ),
  },
};
