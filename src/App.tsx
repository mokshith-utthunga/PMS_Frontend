import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./contexts/AuthContext";
import { ActiveCycleProvider } from "./contexts/ActiveCycleContext";
import ProtectedRoute from "./components/ProtectedRoute";
import { Loader2 } from "lucide-react";

// Lazy load pages for code splitting
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Goals = lazy(() => import("./pages/Goals"));
const Evaluations = lazy(() => import("./pages/Evaluations"));
const Team = lazy(() => import("./pages/Team"));
const TeamMemberGoals = lazy(() => import("./pages/TeamMemberGoals"));
const ManagerEvaluation = lazy(() => import("./pages/ManagerEvaluation"));
const MyRating = lazy(() => import("./pages/MyRating"));
const Reports = lazy(() => import("./pages/Reports"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const EmployeeList = lazy(() => import("./pages/admin/EmployeeList"));
const EmployeeImport = lazy(() => import("./pages/admin/EmployeeImport"));
const AdminEmployeeView = lazy(() => import("./pages/admin/AdminEmployeeView"));
const AdminEmployeeEvaluation = lazy(() => import("./pages/admin/AdminEmployeeEvaluation"));
const CycleList = lazy(() => import("./pages/admin/CycleList"));
const CycleForm = lazy(() => import("./pages/admin/CycleForm"));
const RoleManagement = lazy(() => import("./pages/admin/RoleManagement"));
const RatingRelease = lazy(() => import("./pages/admin/RatingRelease"));
const TemplateList = lazy(() => import("./pages/admin/TemplateList"));
const TemplateForm = lazy(() => import("./pages/admin/TemplateForm"));
const LateSubmissionManagement = lazy(() => import("./pages/admin/LateSubmissionManagement"));
const GoalsDeadlineConfig = lazy(() => import("./pages/admin/GoalsDeadlineConfig"));
const TransitionManagement = lazy(() => import("./pages/admin/TransitionManagement"));
const DepartmentSettings = lazy(() => import("./pages/admin/settings/DepartmentSettings"));
const GradeSettings = lazy(() => import("./pages/admin/settings/GradeSettings"));
const LocationSettings = lazy(() => import("./pages/admin/settings/LocationSettings"));
const CompetencySettings = lazy(() => import("./pages/admin/settings/CompetencySettings"));
const CalibrationSettings = lazy(() => import("./pages/admin/settings/CalibrationSettings"));
const CalibrationList = lazy(() => import("./pages/calibration/CalibrationList"));
const CalibrationForm = lazy(() => import("./pages/calibration/CalibrationForm"));
const CalibrationSession = lazy(() => import("./pages/calibration/CalibrationSession"));
const HRReview = lazy(() => import("./pages/admin/HRReview"));
const SSOCallback = lazy(() => import("./pages/SSOCallback"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Loading fallback component
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

// Configure React Query with default options for active-cycle query
// This ensures all components using ['active-cycle'] queryKey share the same cached data
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 60 * 1000, // 30 minutes - data is fresh for 30 minutes
      gcTime: 60 * 60 * 1000, // 1 hour - keep in cache for 1 hour (gcTime replaces cacheTime in v5)
      refetchOnWindowFocus: false, // Don't refetch on window focus
      refetchOnMount: false, // Don't refetch on mount if data exists
    },
  },
});

const App = () => (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AuthProvider>
          <ActiveCycleProvider>
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
            {/* Public routes */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/login" element={<Auth />} />
            <Route path="/external-auth" element={<SSOCallback />} />
            
            {/* Employee routes */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/goals" element={<ProtectedRoute><Goals /></ProtectedRoute>} />
            <Route path="/evaluations" element={<ProtectedRoute><Evaluations /></ProtectedRoute>} />
            <Route path="/my-rating" element={<ProtectedRoute requiredRoles={['employee', 'manager', 'dept_head','hr_admin']}><MyRating /></ProtectedRoute>} />
            
            {/* Manager routes */}
            <Route path="/team" element={<ProtectedRoute requiredRoles={['manager', 'dept_head', 'hr_admin', 'hrbp', 'system_admin']}><Team /></ProtectedRoute>} />
            <Route path="/team/:employeeId/goals" element={<ProtectedRoute requiredRoles={['manager', 'dept_head', 'hr_admin', 'hrbp', 'system_admin']}><TeamMemberGoals /></ProtectedRoute>} />
            <Route path="/team/:employeeId/evaluate" element={<ProtectedRoute requiredRoles={['manager', 'dept_head', 'hr_admin', 'hrbp', 'system_admin']}><ManagerEvaluation /></ProtectedRoute>} />
            
            {/* Calibration routes */}
            <Route path="/calibration" element={<ProtectedRoute requiredRoles={['hr_admin', 'hrbp']}><CalibrationList /></ProtectedRoute>} />
            <Route path="/calibration/new" element={<ProtectedRoute requiredRoles={['hr_admin', 'hrbp']}><CalibrationForm /></ProtectedRoute>} />
            <Route path="/calibration/:groupId" element={<ProtectedRoute requiredRoles={['hr_admin', 'hrbp']}><CalibrationSession /></ProtectedRoute>} />
            <Route path="/calibration/:groupId/session" element={<ProtectedRoute requiredRoles={['hr_admin', 'hrbp']}><CalibrationSession /></ProtectedRoute>} />
            
            {/* Reports */}
            <Route path="/reports" element={<ProtectedRoute requiredRoles={['hr_admin', 'hrbp', 'dept_head']}><Reports /></ProtectedRoute>} />
            
            {/* HR Review */}
            <Route path="/admin/review" element={<ProtectedRoute requiredRoles={['hr_admin', 'hrbp', 'system_admin', 'dept_head']}><HRReview /></ProtectedRoute>} />
            
            {/* Admin routes */}
            <Route path="/admin" element={<ProtectedRoute requiredRoles={['hr_admin', 'system_admin']}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/employees" element={<ProtectedRoute requiredRoles={['hr_admin', 'system_admin']}><EmployeeList /></ProtectedRoute>} />
            <Route path="/admin/employees/import" element={<ProtectedRoute requiredRoles={['hr_admin', 'system_admin']}><EmployeeImport /></ProtectedRoute>} />
            <Route path="/admin/employee/:id" element={<ProtectedRoute requiredRoles={['hr_admin', 'system_admin']}><AdminEmployeeView /></ProtectedRoute>} />
            <Route path="/admin/employee/:id/evaluation" element={<ProtectedRoute requiredRoles={['hr_admin', 'system_admin']}><AdminEmployeeEvaluation /></ProtectedRoute>} />
            <Route path="/admin/cycles" element={<ProtectedRoute requiredRoles={['hr_admin', 'system_admin']}><CycleList /></ProtectedRoute>} />
            <Route path="/admin/cycles/new" element={<ProtectedRoute requiredRoles={['hr_admin', 'system_admin']}><CycleForm /></ProtectedRoute>} />
            <Route path="/admin/cycles/:cycleId/view" element={<ProtectedRoute requiredRoles={['hr_admin', 'system_admin']}><CycleForm /></ProtectedRoute>} />
            <Route path="/admin/cycles/:cycleId/edit" element={<ProtectedRoute requiredRoles={['hr_admin', 'system_admin']}><CycleForm /></ProtectedRoute>} />
            <Route path="/admin/roles" element={<ProtectedRoute requiredRoles={['hr_admin', 'system_admin']}><RoleManagement /></ProtectedRoute>} />
            <Route path="/admin/release" element={<ProtectedRoute requiredRoles={['hr_admin']}><RatingRelease /></ProtectedRoute>} />
            <Route path="/admin/templates" element={<ProtectedRoute requiredRoles={['hr_admin', 'system_admin']}><TemplateList /></ProtectedRoute>} />
            <Route path="/admin/templates/new" element={<ProtectedRoute requiredRoles={['hr_admin', 'system_admin']}><TemplateForm /></ProtectedRoute>} />
            <Route path="/admin/templates/:id" element={<ProtectedRoute requiredRoles={['hr_admin', 'system_admin']}><TemplateForm /></ProtectedRoute>} />
            <Route path="/admin/late-submissions" element={<ProtectedRoute requiredRoles={['hr_admin', 'system_admin']}><LateSubmissionManagement /></ProtectedRoute>} />
            <Route path="/admin/goals-deadlines" element={<ProtectedRoute requiredRoles={['hr_admin', 'system_admin']}><GoalsDeadlineConfig /></ProtectedRoute>} />
            <Route path="/admin/transitions" element={<ProtectedRoute requiredRoles={['hr_admin', 'system_admin']}><TransitionManagement /></ProtectedRoute>} />
            
            {/* Admin settings */}
            <Route path="/admin/settings/departments" element={<ProtectedRoute requiredRoles={['hr_admin', 'system_admin']}><DepartmentSettings /></ProtectedRoute>} />
            <Route path="/admin/settings/grades" element={<ProtectedRoute requiredRoles={['hr_admin', 'system_admin']}><GradeSettings /></ProtectedRoute>} />
            <Route path="/admin/settings/locations" element={<ProtectedRoute requiredRoles={['hr_admin', 'system_admin']}><LocationSettings /></ProtectedRoute>} />
            <Route path="/admin/settings/competencies" element={<ProtectedRoute requiredRoles={['hr_admin']}><CompetencySettings /></ProtectedRoute>} />
            <Route path="/admin/settings/calibration" element={<ProtectedRoute requiredRoles={['hr_admin', 'system_admin']}><CalibrationSettings /></ProtectedRoute>} />
            
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ActiveCycleProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </BrowserRouter>
);

export default App;
