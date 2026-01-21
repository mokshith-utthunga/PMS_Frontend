// Auth Service - Authentication API calls
import { api } from './api';

export interface User {
  id: string;
  email: string;
}

export interface Session {
  access_token: string;
  user?: User;
}

export interface AuthResponse {
  user: User;
  session: Session;
}

export interface UserRole {
  role: string;
}

export const authService = {
  // Check current session
  getSession: () => 
    api.get<{ user: User; session: Session }>('/auth/session'),

  // Sign in with email/password
  signIn: (email: string, password: string) => 
    api.post<AuthResponse>('/auth/signin', { email, password }),

  // Sign up
  signUp: (email: string, password: string) => 
    api.post<AuthResponse>('/auth/signup', { email, password }),

  // Sign out
  signOut: () => 
    api.post('/auth/signout'),

  // Get user roles
  getUserRoles: () => 
    api.get<{ roles: string[] }>('/auth/roles').then(res => ({
      data: res.roles?.map(role => ({ role })) || []
    })),
};
