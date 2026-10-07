import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { Lock, Mail, ArrowRight, TrendingUp, Eye, EyeOff, UserPlus, Loader2 } from 'lucide-react';

type Mode = 'login' | 'signup';

export default function CrmLogin({ initialMode = 'login' }: { initialMode?: 'login' | 'signup' }) {
  const [mode, setMode] = useState<Mode>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('invite')) return 'signup';
    return initialMode;
  });
  const [email, setEmail] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('invite') || '';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (mode === 'signup') {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }
      // After signup, sign in immediately (email confirmation is off)
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }
    }
    // Auth state change will trigger re-render in App
    setLoading(false);
  };

  return (
    <div className="crm-login-page">
      <div className="crm-login-card">
        {/* Brand */}
        <div className="crm-login-brand">
          <div className="crm-login-logo">
            <TrendingUp size={28} strokeWidth={2.5} />
          </div>
          <h1>LeadCentre CRM</h1>
          <p>{mode === 'login' ? 'Sign in to manage your leads' : 'Create your admin account'}</p>
        </div>

        {/* Mode Toggle */}
        <div className="crm-mode-toggle">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => { setMode('login'); setError(''); }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => { setMode('signup'); setError(''); }}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="crm-login-form">
          <div className="crm-field">
            <label htmlFor="crm-email">Email</label>
            <div className="crm-input-wrap">
              <Mail size={18} />
              <input
                id="crm-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                autoComplete="email"
              />
            </div>
          </div>

          <div className="crm-field">
            <label htmlFor="crm-password">Password</label>
            <div className="crm-input-wrap">
              <Lock size={18} />
              <input
                id="crm-password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'Min 6 characters' : 'Enter your password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                className="crm-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && <div className="crm-error">{error}</div>}

          <button type="submit" className="crm-login-button" disabled={loading}>
            {loading ? (
              <Loader2 size={20} className="crm-spin" />
            ) : (
              <>
                {mode === 'login' ? 'Sign In' : 'Create Account'}
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>

        {/* Switch Mode Link */}
        <div className="crm-switch-mode">
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button type="button" onClick={() => { setMode('signup'); setError(''); }}>
                <UserPlus size={14} /> Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button type="button" onClick={() => { setMode('login'); setError(''); }}>
                Sign in
              </button>
            </>
          )}
        </div>

        <div className="crm-back-link">
          <a href="#/">← Back to landing page</a>
        </div>
      </div>
    </div>
  );
}
