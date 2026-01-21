// Export all services from a single entry point
export { api, ApiError, API_BASE_URL } from './api';
export { authService } from './auth.service';
export { employeeService } from './employee.service';
export { cycleService } from './cycle.service';
export { goalsService } from './goals.service';
export { evaluationService } from './evaluation.service';
export { notificationService, notifyGoalApproval, notifyGoalApproved, notifyGoalReturned } from './notification.service';
export { settingsService } from './settings.service';
export { calibrationService } from './calibration.service';
export { templateService } from './template.service';
export { statsService } from './stats.service';
export { permissionsService } from './permissions.service';

// Re-export types
export type { EmployeeFilters, UserWithRoles } from './employee.service';
export type { 
  CreateKRAData, 
  UpdateKRAData, 
  CreateKPIData, 
  UpdateKPIData,
  CreateBonusKRAData,
  CreateBonusKPIData,
} from './goals.service';
export type { 
  QuarterlySelfReviewData,
  QuarterlyKpiProgressData,
  QuarterlyManagerReviewData,
  QuarterlyKpiManagerRatingData,
} from './evaluation.service';
export type { CreateNotificationData } from './notification.service';
export type { 
  CreateCalibrationGroupData, 
  CreateCalibrationEntryData,
  QuotaRuleData,
} from './calibration.service';
export type { TemplateFilters, KPITemplateData } from './template.service';
export type { User, Session, AuthResponse, UserRole } from './auth.service';
export type { LateSubmissionPermission } from './permissions.service';
export type { BusinessUnit } from './settings.service';
