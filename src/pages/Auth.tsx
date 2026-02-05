import { useState } from 'react';
import { getApiUrl } from '@/utils/constants';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setMessage('Please enter email and password');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const res = await fetch(getApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || 'Sign in failed');
      } else {
        setMessage('Sign in successful! Redirecting...');
        window.location.href = '/dashboard';
      }
    } catch (err) {
      setMessage('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email || !password) {
      setMessage('Please enter email and password');
      return;
    }

    if (password.length < 6) {
      setMessage('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const res = await fetch(getApiUrl('/api/auth/signup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || 'Sign up failed');
      } else {
        setMessage('Account created! You can now sign in.');
      }
    } catch (err) {
      setMessage('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      backgroundColor: '#f5f5f5',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <h1 style={{ 
          fontSize: '24px', 
          fontWeight: 'bold', 
          marginBottom: '8px',
          textAlign: 'center'
        }}>
          Performance Management System
        </h1>
        <p style={{ 
          color: '#666', 
          marginBottom: '24px',
          textAlign: 'center'
        }}>
          Sign in to continue
        </p>

        {message && (
          <div style={{
            padding: '10px',
            marginBottom: '16px',
            borderRadius: '4px',
            backgroundColor: message.includes('successful') || message.includes('created') ? '#d4edda' : '#f8d7da',
            color: message.includes('successful') || message.includes('created') ? '#155724' : '#721c24',
            textAlign: 'center'
          }}>
            {message}
          </div>
        )}

        <form onSubmit={handleSignIn}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#1a1a2e',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              marginBottom: '12px'
            }}
          >
            {isLoading ? 'Please wait...' : 'Sign In'}
          </button>

          <button
            type="button"
            onClick={handleSignUp}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: 'transparent',
              color: '#1a1a2e',
              border: '1px solid #1a1a2e',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1
            }}
          >
            Create Account
          </button>
        </form>
      </div>
    </div>
  );
}
