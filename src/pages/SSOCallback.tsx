import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

/**
 * SSO Callback page - handles SSO login redirects
 * This component processes SSO parameters and calls backend API
 */
export default function SSOCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const processSSO = async () => {
      const email = searchParams.get('email');
      const employeeCode = searchParams.get('employeeCode');
      const fullName = searchParams.get('fullName');
      const role = searchParams.get('role');

      if (!email || !employeeCode) {
        navigate('/login?error=missing_sso_params');
        return;
      }

      // Build query string
      const params = new URLSearchParams();
      params.set('email', email);
      params.set('employeeCode', employeeCode);
      if (fullName) params.set('fullName', fullName);
      if (role) params.set('role', role);

      // Redirect to backend SSO endpoint via proxy
      // The backend will handle authentication, set cookies, and redirect to /dashboard
      // The proxy will forward the request and the backend redirect will work correctly
      window.location.href = `/api/external-auth?${params.toString()}`;
    };

    processSSO();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Processing SSO login...</p>
      </div>
    </div>
  );
}
