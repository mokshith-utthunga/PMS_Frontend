import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./contexts/AuthContext";
import { ActiveCycleProvider } from "./contexts/ActiveCycleContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Goals from "./pages/Goals";
import Evaluations from "./pages/Evaluations";
import Team from "./pages/Team";
import TeamMemberGoals from "./pages/TeamMemberGoals";
import ManagerEvaluation from "./pages/ManagerEvaluation";
import MyRating from "./pages/MyRating";
import Reports from "./pages/Reports";
import AdminDashboard from "./pages/admin/AdminDashboard";
import EmployeeList from "./pages/admin/EmployeeList";
import EmployeeImport from "./pages/admin/EmployeeImport";
import AdminEmployeeView from "./pages/admin/AdminEmployeeView";
import CycleList from "./pages/admin/CycleList";
import CycleForm from "./pages/admin/CycleForm";
import RoleManagement from "./pages/admin/RoleManagement";
import RatingRelease from "./pages/admin/RatingRelease";
import TemplateList from "./pages/admin/TemplateList";
import TemplateForm from "./pages/admin/TemplateForm";
import LateSubmissionManagement from "./pages/admin/LateSubmissionManagement";
import GoalsDeadlineConfig from "./pages/admin/GoalsDeadlineConfig";
import DepartmentSettings from "./pages/admin/settings/DepartmentSettings";
import GradeSettings from "./pages/admin/settings/GradeSettings";
import LocationSettings from "./pages/admin/settings/LocationSettings";
import CompetencySettings from "./pages/admin/settings/CompetencySettings";
import CalibrationSettings from "./pages/admin/settings/CalibrationSettings";
import CalibrationList from "./pages/calibration/CalibrationList";
import CalibrationForm from "./pages/calibration/CalibrationForm";
import CalibrationSession from "./pages/calibration/CalibrationSession";
import HRReview from "./pages/admin/HRReview";
import SSOCallback from "./pages/SSOCallback";
import NotFound from "./pages/NotFound";

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
            <Route path="/my-rating" element={<ProtectedRoute><MyRating /></ProtectedRoute>} />
            
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
            <Route path="/admin/cycles" element={<ProtectedRoute requiredRoles={['hr_admin']}><CycleList /></ProtectedRoute>} />
            <Route path="/admin/cycles/new" element={<ProtectedRoute requiredRoles={['hr_admin']}><CycleForm /></ProtectedRoute>} />
            <Route path="/admin/cycles/:cycleId/edit" element={<ProtectedRoute requiredRoles={['hr_admin']}><CycleForm /></ProtectedRoute>} />
            <Route path="/admin/roles" element={<ProtectedRoute requiredRoles={['hr_admin', 'system_admin']}><RoleManagement /></ProtectedRoute>} />
            <Route path="/admin/release" element={<ProtectedRoute requiredRoles={['hr_admin']}><RatingRelease /></ProtectedRoute>} />
            <Route path="/admin/templates" element={<ProtectedRoute requiredRoles={['hr_admin', 'system_admin']}><TemplateList /></ProtectedRoute>} />
            <Route path="/admin/templates/new" element={<ProtectedRoute requiredRoles={['hr_admin', 'system_admin']}><TemplateForm /></ProtectedRoute>} />
            <Route path="/admin/templates/:id" element={<ProtectedRoute requiredRoles={['hr_admin', 'system_admin']}><TemplateForm /></ProtectedRoute>} />
            <Route path="/admin/late-submissions" element={<ProtectedRoute requiredRoles={['hr_admin', 'system_admin']}><LateSubmissionManagement /></ProtectedRoute>} />
            <Route path="/admin/goals-deadlines" element={<ProtectedRoute requiredRoles={['hr_admin', 'system_admin']}><GoalsDeadlineConfig /></ProtectedRoute>} />
            
            {/* Admin settings */}
            <Route path="/admin/settings/departments" element={<ProtectedRoute requiredRoles={['hr_admin', 'system_admin']}><DepartmentSettings /></ProtectedRoute>} />
            <Route path="/admin/settings/grades" element={<ProtectedRoute requiredRoles={['hr_admin', 'system_admin']}><GradeSettings /></ProtectedRoute>} />
            <Route path="/admin/settings/locations" element={<ProtectedRoute requiredRoles={['hr_admin', 'system_admin']}><LocationSettings /></ProtectedRoute>} />
            <Route path="/admin/settings/competencies" element={<ProtectedRoute requiredRoles={['hr_admin']}><CompetencySettings /></ProtectedRoute>} />
            <Route path="/admin/settings/calibration" element={<ProtectedRoute requiredRoles={['hr_admin', 'system_admin']}><CalibrationSettings /></ProtectedRoute>} />
            
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </ActiveCycleProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </BrowserRouter>
);

export default App;
