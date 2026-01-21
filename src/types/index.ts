// Database Types - Matches PostgreSQL schema

// ==================== Enums ====================

export type AppRole = 'employee' | 'manager' | 'dept_head' | 'hr_admin' | 'hrbp' | 'system_admin';
export type CycleStatus = 'draft' | 'active' | 'closed' | 'archived';
export type EmployeeStatus = 'active' | 'inactive' | 'on_leave' | 'terminated';
export type GoalStatus = 'draft' | 'submitted' | 'approved' | 'returned' | 'locked';
export type GoalType = 'kpi' | 'okr' | 'competency';
export type MetricType = 'number' | 'percentage' | 'milestone' | 'qualitative';
export type EvaluationStatus = 'pending' | 'in_progress' | 'submitted' | 'calibrated' | 'released';
export type NotificationType = 'goal_approval' | 'goal_returned' | 'evaluation_pending' | 'calibration_pending' | 'results_released' | 'general';

// ==================== Table Types ====================

export interface Profile {
  id: string;
  email: string;
  password_hash?: string;
  full_name?: string | null;
  role: AppRole;
  created_at: string;
  updated_at: string;
}

// UserRole interface kept for backward compatibility
// Note: Roles are now stored directly in profiles.role
export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Employee {
  id: string;
  emp_code: string;
  // Backward compatibility: support old emp_id field name
  emp_id?: string;
  user_id?: string;
  full_name: string;
  // Backward compatibility: support old first_name/last_name field names
  first_name?: string;
  last_name?: string;
  email: string;
  department: string;
  business_unit: string;
  grade: string;
  location: string;
  sub_department?: string;
  manager_code?: string;
  // Backward compatibility: support old manager_id field name
  manager_id?: string;
  date_of_joining: string;
  status: EmployeeStatus;
  created_at: string;
  updated_at: string;
}

export interface PerformanceCycle {
  id: string;
  name: string;
  year: number;
  status: CycleStatus;
  goal_submission_start: string;
  goal_submission_end: string;
  goal_approval_end: string;
  self_evaluation_start?: string;
  self_evaluation_end?: string;
  manager_evaluation_start: string;
  manager_evaluation_end: string;
  calibration_start: string;
  calibration_end: string;
  release_date: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type RatingValue = 1 | 2 | 3 | 4 | 5;

export interface RatingScale {
  id: string;
  value: RatingValue;
  name: string;
  color: string | null;
  description?: string;
  created_at: string;
}

export interface Competency {
  id: string;
  name: string;
  description?: string;
  category?: string;
  is_active: boolean;
  created_at: string;
}

export interface KRA {
  id: string;
  employee_id: string;
  cycle_id: string;
  quarter?: number | null;
  title: string;
  description?: string;
  weight: number;
  order_index: number;
  status: GoalStatus;
  manager_comments?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Goal {
  id: string;
  employee_id: string;
  cycle_id: string;
  kra_id?: string;
  quarter?: number | null;
  title: string;
  description?: string;
  goal_type: GoalType;
  metric_type: MetricType;
  target_value?: string;
  weight: number;
  due_date?: string | null;
  status: GoalStatus;
  manager_comments?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BonusKRA {
  id: string;
  employee_id: string;
  cycle_id: string;
  title: string;
  description?: string;
  weight: number;
  order_index: number;
  status: GoalStatus;
  manager_comments?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BonusKPI {
  id: string;
  bonus_kra_id: string;
  employee_id: string;
  cycle_id: string;
  title: string;
  description?: string;
  metric_type: MetricType;
  target_value?: string;
  weight: number;
  due_date?: string | null;
  status: GoalStatus;
  manager_comments?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SelfEvaluation {
  id: string;
  employee_id: string;
  cycle_id: string;
  quarter?: number;
  overall_rating?: number;
  overall_comments?: string;
  status: EvaluationStatus;
  submitted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface GoalSelfRating {
  id: string;
  self_evaluation_id: string;
  goal_id: string;
  achievement_percentage: number;
  self_rating: number;
  comments?: string;
  created_at: string;
}

export interface ManagerEvaluation {
  id: string;
  employee_id: string;
  evaluator_id: string;
  cycle_id: string;
  overall_comments?: string;
  strengths?: string;
  areas_for_improvement?: string;
  recommended_rating?: number;
  final_rating?: number;
  status: EvaluationStatus;
  submitted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface GoalManagerRating {
  id: string;
  manager_evaluation_id: string;
  goal_id: string;
  achievement_percentage: number;
  manager_rating: number;
  feedback?: string;
  created_at: string;
}

export interface CalibrationGroup {
  id: string;
  cycle_id: string;
  name: string;
  department?: string;
  grade?: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CalibrationEntry {
  id: string;
  group_id: string;
  employee_id: string;
  original_rating: number;
  calibrated_rating?: number;
  justification?: string;
  calibrated_by?: string;
  calibrated_at?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

export interface Department {
  id: string;
  name: string;
  code?: string;
  is_active: boolean;
  created_at: string;
}

export interface Grade {
  id: string;
  name: string;
  level?: number;
  is_active: boolean;
  created_at: string;
}

export interface Location {
  id: string;
  name: string;
  code?: string;
  is_active: boolean;
  created_at: string;
}

export interface KRATemplate {
  id: string;
  title: string;
  description: string | null;
  suggested_weight: number;
  department: string | null;
  grade: string | null;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  kpi_templates?: any[];
  kpi_count?: number;
}

// ==================== API Response Types ====================

export interface ApiResponse<T> {
  data: T;
  error?: string;
  count?: number;
}

export interface User {
  id: string;
  email: string;
  full_name?: string | null;
}

export interface Session {
  access_token: string;
  user: User;
}
