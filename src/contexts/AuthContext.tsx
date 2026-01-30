// Authentication Context - Simple email/password auth
import React, { createContext, useContext, useState, useEffect } from 'react';
import { clearAllCacheFromLocalStorage } from '@/utils/localStorageCache';

type AppRole = 'employee' | 'manager' | 'dept_head' | 'hr_admin' | 'hrbp' | 'system_admin';

interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  roles: AppRole[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true); // Start with loading true

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/session', {
          credentials: 'include',
        });
        
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUser(data.user);
            // Fetch roles
            try {
              const rolesRes = await fetch('/api/auth/roles', { credentials: 'include' });
              if (rolesRes.ok) {
                const rolesData = await rolesRes.json();
                setRoles(rolesData.roles || []);
              } else {
                console.error('Failed to fetch roles:', rolesRes.status, rolesRes.statusText);
                // Default to empty array if role fetch fails
                setRoles([]);
              }
            } catch (error) {
              console.error('Error fetching roles:', error);
              // Default to empty array if role fetch fails
              setRoles([]);
            }
          }
        }
      } catch {
        // Session check failed, user is not logged in
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  // Login - POST /api/auth/login
  const signIn = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        return { error: new Error(data.error || 'Login failed') };
      }
      
      setUser(data.user);
      // Fetch roles after login
      try {
        const rolesRes = await fetch('/api/auth/roles', { credentials: 'include' });
        if (rolesRes.ok) {
          const rolesData = await rolesRes.json();
          setRoles(rolesData.roles || []);
        } else {
          console.error('Failed to fetch roles after login:', rolesRes.status, rolesRes.statusText);
          // Default to empty array if role fetch fails
          setRoles([]);
        }
      } catch (error) {
        console.error('Error fetching roles after login:', error);
        // Default to empty array if role fetch fails
        setRoles([]);
      }
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Network error') };
    }
  };

  // Signup - POST /api/auth/signup
  const signUp = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        return { error: new Error(data.error || 'Signup failed') };
      }
      
      setUser(data.user);
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Network error') };
    }
  };

  // Logout - POST /api/auth/logout
  const signOut = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore logout errors
    }
    
    // Clear cached data from localStorage on logout
    clearAllCacheFromLocalStorage();
    
    // Also clear all localStorage (in case there are other items)
    try {
      localStorage.clear();
    } catch (e) {
      console.warn('Failed to clear localStorage on logout:', e);
    }
    
    setUser(null);
    setRoles([]);
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  const hasAnyRole = (checkRoles: AppRole[]) => checkRoles.some(role => roles.includes(role));

  return (
    <AuthContext.Provider value={{
      user, roles, loading,
      signIn, signUp, signOut,
      hasRole, hasAnyRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
