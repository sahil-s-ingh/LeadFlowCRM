import { useState, useRef, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { Lock, Mail, ArrowRight, TrendingUp, Eye, EyeOff, UserPlus, Loader2, Sparkles, BarChart3, Users, Zap } from 'lucide-react';

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

  const cardRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    tiltRef.current = { x: dy, y: dx };
    card.style.transform = `perspective(1200px) rotateX(${-dy * 7}deg) rotateY(${dx * 7}deg) translateZ(10px)`;
  };

  const handleMouseLeave = () => {
    const card = cardRef.current;
    if (!card) return;
    tiltRef.current = { x: 0, y: 0 };
    card.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg) translateZ(0px)';
  };

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
    setLoading(false);
  };

  return (
    <div className="crm3d-page">
      {/* 3D Floating Shapes Background */}
      <div className="crm3d-bg-shapes" aria-hidden="true">
        <div className="crm3d-shape crm3d-cube crm3d-float-1" />
        <div className="crm3d-shape crm3d-cube-small crm3d-float-2" />
        <div className="crm3d-shape crm3d-sphere crm3d-float-3" />
        <div className="crm3d-shape crm3d-pyramid crm3d-float-4" />
        <div className="crm3d-shape crm3d-cube crm3d-float-5" />
        <div className="crm3d-shape crm3d-ring crm3d-float-6" />
        <div className="crm3d-shape crm3d-cube-small crm3d-float-1" />
        <div className="crm3d-shape crm3d-sphere-small crm3d-float-3" />
        <div className="crm3d-orb crm3d-glow-1" />
        <div className="crm3d-orb crm3d-glow-2" />
      </div>

      {/* Grid Floor */}
      <div className="crm3d-grid-floor" aria-hidden="true" />

      {/* 3D Card */}
      <div className="crm3d-card-outer">
        <div
          ref={cardRef}
          className="crm3d-card"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Card layers for 3D depth */}
          <div className="crm3d-card-edge" />

          {/* Shine effect */}
          <div className="crm3d-card-shine" />

          {/* Brand */}
          <div className="crm3d-brand">
            <div className="crm3d-logo">
              <div className="crm3d-logo-inner">
                <TrendingUp size={26} strokeWidth={2.5} />
              </div>
              <div className="crm3d-logo-shadow" />
            </div>
            <h1>LeadCentre CRM</h1>
            <p>{mode === 'login' ? 'Sign in to manage your leads' : 'Create your admin account'}</p>
          </div>

          {/* Mode Toggle — 3D segmented control */}
          <div className="crm3d-toggle">
            <div className={`crm3d-toggle-slider ${mode === 'signup' ? 'right' : ''}`} />
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
          <form onSubmit={handleSubmit} className="crm3d-form">
            <div className="crm3d-field">
              <label htmlFor="crm-email">Email</label>
              <div className="crm3d-input-3d">
                <div className="crm3d-input-face">
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
                  <div className="crm3d-input-glow" />
                </div>
              </div>
            </div>

            <div className="crm3d-field">
              <label htmlFor="crm-password">Password</label>
              <div className="crm3d-input-3d">
                <div className="crm3d-input-face">
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
                  <div className="crm3d-input-glow" />
                  <button
                    type="button"
                    className="crm3d-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            {error && <div className="crm3d-error">{error}</div>}

            <button type="submit" className="crm3d-submit-btn" disabled={loading}>
              <span className="crm3d-btn-text">
                {loading ? (
                  <Loader2 size={20} className="crm-spin" />
                ) : (
                  <>
                    {mode === 'login' ? 'Sign In' : 'Create Account'}
                    <ArrowRight size={20} />
                  </>
                )}
              </span>
              <span className="crm3d-btn-side" />
              <span className="crm3d-btn-bottom" />
            </button>
          </form>

          {/* Switch Mode */}
          <div className="crm3d-switch">
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

          <div className="crm3d-back">
            <a href="#/">← Back to landing page</a>
          </div>
        </div>
      </div>

      {/* 3D Feature badges */}
      <div className="crm3d-features" aria-hidden="true">
        <div className="crm3d-feature-badge">
          <BarChart3 size={16} />
          <span>Analytics</span>
        </div>
        <div className="crm3d-feature-badge">
          <Users size={16} />
          <span>Lead Tracking</span>
        </div>
        <div className="crm3d-feature-badge">
          <Zap size={16} />
          <span>Automation</span>
        </div>
        <div className="crm3d-feature-badge">
          <Sparkles size={16} />
          <span>AI Powered</span>
        </div>
      </div>
    </div>
  );
}
