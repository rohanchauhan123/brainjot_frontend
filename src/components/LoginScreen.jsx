import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';

export default function LoginScreen({ onLoginSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [useOtp, setUseOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [requiresRegDetails, setRequiresRegDetails] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState(null); // null | 'checking' | 'available' | 'taken' | string (error)
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  
  const googleBtnRef = useRef(null);
  const debounceRef = useRef(null);

  // Auto-suggest username from name
  useEffect(() => {
    if ((mode === 'register' || requiresRegDetails) && name && !username) {
      const suggested = name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9_]/g, '').slice(0, 20);
      if (suggested.length >= 3) setUsername(suggested);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  // Debounced availability check
  useEffect(() => {
    if ((mode !== 'register' && !requiresRegDetails) || !username) { setUsernameStatus(null); return; }
    clearTimeout(debounceRef.current);
    setUsernameStatus('checking');
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await api('check_username', null, 'GET', `&username=${encodeURIComponent(username)}`);
        if (r.error) setUsernameStatus(r.error);
        else setUsernameStatus(r.available ? 'available' : 'taken');
      } catch {
        setUsernameStatus(null);
      }
    }, 500);
    return () => clearTimeout(debounceRef.current);
  }, [username, mode, requiresRegDetails]);

  // Google authentication credential handler
  const handleGoogleCredentialResponse = async (response) => {
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const r = await api('google_auth', { credential: response.credential });
      if (r.ok) {
        onLoginSuccess(r.user);
      } else {
        setError(r.error || 'Google Authentication failed. Please try again.');
      }
    } catch (err) {
      setError('An error occurred during Google sign-in.');
    } finally {
      setLoading(false);
    }
  };

  // Render Google Button on component mount / state updates
  useEffect(() => {
    /* global google */
    if (typeof google !== 'undefined' && google.accounts && googleBtnRef.current) {
      try {
        google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || 'dummy_client_id.apps.googleusercontent.com',
          callback: handleGoogleCredentialResponse,
        });
        google.accounts.id.renderButton(
          googleBtnRef.current,
          { theme: 'filled_dark', size: 'large', width: '100%', text: mode === 'login' ? 'signin_with' : 'signup_with' }
        );
      } catch (err) {
        console.error('Error rendering Google Sign-In button', err);
      }
    }
  }, [mode, useOtp]); // Re-render when switching layouts

  const sendOtpCode = async () => {
    setError('');
    setInfo('');
    if (!email?.trim()) { setError('Email is required'); return; }
    setLoading(true);
    try {
      const r = await api('send_otp', { email });
      if (r.ok) {
        setOtpSent(true);
        setInfo(r.message || 'OTP sent successfully to your email.');
      } else {
        setError(r.error || 'Failed to send OTP.');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const doSubmit = async () => {
    setError('');
    setInfo('');
    setLoading(true);
    try {
      if (useOtp) {
        // Verification / Registration with OTP
        const body = { email, otp };
        if (requiresRegDetails) {
          if (usernameStatus !== 'available') { setError('Please choose a valid, available username'); setLoading(false); return; }
          body.name = name;
          body.username = username;
        }
        const r = await api('verify_otp', body);
        if (r.ok) {
          if (r.requiresRegistration) {
            setRequiresRegDetails(true);
            setInfo('Verification successful! Please provide a name and username to complete your profile.');
          } else {
            onLoginSuccess(r.user);
          }
        } else {
          setError(r.error || 'Invalid OTP code.');
        }
      } else {
        // Standard Password Login / Registration
        if (mode === 'register' && usernameStatus !== 'available') {
          setError('Please choose a valid, available username');
          setLoading(false);
          return;
        }
        const body = mode === 'register' ? { name, email, password, username } : { email, password };
        const r = await api(mode, body);
        if (r.ok) {
          onLoginSuccess(r.user);
        } else {
          setError(r.error || 'Something went wrong. Please try again.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setInfo('');
    setUsernameStatus(null);
    setShowForgot(false);
    setUseOtp(false);
    setOtpSent(false);
    setRequiresRegDetails(false);
  };

  const unHint = (() => {
    const activeUsername = username;
    const isRegMode = mode === 'register' || requiresRegDetails;
    if (!activeUsername || !isRegMode) return null;
    if (usernameStatus === 'checking') return { color: 'var(--muted)', text: 'Checking…' };
    if (usernameStatus === 'available') return { color: '#10b981', text: '✓ @' + activeUsername + ' is available' };
    if (usernameStatus === 'taken') return { color: '#ef4444', text: '✕ @' + activeUsername + ' is taken' };
    if (typeof usernameStatus === 'string') return { color: '#ef4444', text: usernameStatus };
    return null;
  })();

  return (
    <div id="login-screen">
      <div className="login-box">
        <div className="login-year">BJ</div>
        <div className="login-title">
          {requiresRegDetails ? 'Complete your Profile' : mode === 'login' ? 'Welcome back' : 'Create your account'}
        </div>
        <div className="login-sub">
          {requiresRegDetails 
            ? 'Choose how others see you in BrainJot.' 
            : useOtp 
              ? 'Sign in or Sign up securely using email OTP.' 
              : mode === 'login' 
                ? 'Sign in to your workspace.' 
                : 'Get started with BrainJot.'}
        </div>

        {/* Google Login Button */}
        {!requiresRegDetails && (
          <div style={{ marginBottom: '18px' }}>
            <div ref={googleBtnRef} style={{ width: '100%', minHeight: '40px' }} />
            <div className="login-divider" style={{ display: 'flex', alignItems: 'center', margin: '20px 0', color: 'var(--faint)', fontSize: '12px' }}>
              <span style={{ flex: 1, height: '1px', background: 'var(--surface2)' }} />
              <span style={{ padding: '0 10px', fontWeight: '600' }}>OR</span>
              <span style={{ flex: 1, height: '1px', background: 'var(--surface2)' }} />
            </div>
          </div>
        )}

        {/* Standard Fields */}
        {mode === 'register' && !useOtp && (
          <div className="field">
            <label>Name</label>
            <input
              type="text"
              placeholder="Your name"
              value={name}
              autoComplete="name"
              onChange={e => setName(e.target.value)}
            />
          </div>
        )}

        {!requiresRegDetails && (
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              autoComplete="email"
              disabled={otpSent}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
        )}

        {/* OTP Verification Mode */}
        {useOtp && !requiresRegDetails && otpSent && (
          <div className="field">
            <label>6-Digit OTP</label>
            <input
              type="text"
              placeholder="123456"
              value={otp}
              maxLength={6}
              onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
              onKeyDown={e => e.key === 'Enter' && doSubmit()}
            />
          </div>
        )}

        {/* Registration details screen after verifying OTP */}
        {requiresRegDetails && (
          <>
            <div className="field">
              <label>Name</label>
              <input
                type="text"
                placeholder="Your name"
                value={name}
                autoComplete="name"
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Username</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: '14px', fontWeight: '700', pointerEvents: 'none' }}>@</span>
                <input
                  type="text"
                  placeholder="yourhandle"
                  value={username}
                  autoComplete="username"
                  style={{ paddingLeft: '26px' }}
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))}
                  onKeyDown={e => e.key === 'Enter' && doSubmit()}
                />
              </div>
              {unHint && (
                <div style={{ fontSize: '12px', color: unHint.color, marginTop: '4px', fontWeight: '600' }}>{unHint.text}</div>
              )}
            </div>
          </>
        )}

        {/* Password field for standard login */}
        {!useOtp && (
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && mode !== 'register' && doSubmit()}
            />
          </div>
        )}

        {/* Username field for standard register */}
        {mode === 'register' && !useOtp && (
          <div className="field">
            <label>Username</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: '14px', fontWeight: '700', pointerEvents: 'none' }}>@</span>
              <input
                type="text"
                placeholder="yourhandle"
                value={username}
                autoComplete="username"
                style={{ paddingLeft: '26px' }}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))}
                onKeyDown={e => e.key === 'Enter' && doSubmit()}
              />
            </div>
            {unHint && (
              <div style={{ fontSize: '12px', color: unHint.color, marginTop: '4px', fontWeight: '600' }}>{unHint.text}</div>
            )}
            <div style={{ fontSize: '11px', color: 'var(--faint)', marginTop: '4px' }}>
              This is your permanent unique handle in BrainJot — choose wisely.
            </div>
          </div>
        )}

        {/* Action Button */}
        {useOtp && !otpSent ? (
          <button className="btn-primary" onClick={sendOtpCode} disabled={loading}>
            {loading ? 'Sending OTP…' : 'Send Verification OTP'}
          </button>
        ) : (
          <button className="btn-primary" onClick={doSubmit} disabled={loading}>
            {loading 
              ? (requiresRegDetails ? 'Saving profile…' : useOtp ? 'Verifying…' : mode === 'login' ? 'Signing in…' : 'Creating account…') 
              : (requiresRegDetails ? 'Complete Sign Up' : useOtp ? 'Verify & Continue' : mode === 'login' ? 'Sign in' : 'Create account')}
          </button>
        )}

        {error && <div className="login-err" style={{ display: 'block' }}>{error}</div>}
        {info && <div className="login-info" style={{ display: 'block', color: 'var(--accent)', fontSize: '13px', marginTop: '10px', textAlign: 'center', fontWeight: '500' }}>{info}</div>}

        {/* Toggle standard / OTP method */}
        {!requiresRegDetails && (
          <div style={{ textAlign: 'center', marginTop: '14px' }}>
            <button
              style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '13px', padding: 0, textDecoration: 'underline' }}
              onClick={() => { setUseOtp(!useOtp); setError(''); setInfo(''); setOtpSent(false); }}
            >
              {useOtp ? 'Use password instead' : 'Sign in / Sign up with Email OTP'}
            </button>
          </div>
        )}

        {mode === 'login' && !useOtp && (
          <div style={{ textAlign: 'center', marginTop: '10px' }}>
            {!showForgot ? (
              <button
                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '13px', padding: 0, textDecoration: 'underline' }}
                onClick={() => setShowForgot(true)}
              >
                Forgot password?
              </button>
            ) : (
              <div style={{ fontSize: '13px', color: 'var(--muted)', background: 'var(--surface2)', borderRadius: '10px', padding: '10px 14px', lineHeight: '1.5' }}>
                Password reset is not available via email yet. Contact your workspace admin or reach out to support.
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
          {mode === 'login' ? (
            <>
              No account?{' '}
              <button
                style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '13px', padding: 0 }}
                onClick={() => switchMode('register')}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '13px', padding: 0 }}
                onClick={() => switchMode('login')}
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
