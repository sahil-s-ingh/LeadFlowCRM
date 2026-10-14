import { useState, useRef, useCallback, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  Shield,
  ShieldCheck,
  ServerCog,
  UsersRound,
  Globe2,
  Gauge,
} from 'lucide-react';

type Mode = 'login' | 'signup';

const features = [
  { icon: UsersRound, title: 'Manage every account', detail: 'Onboard, suspend, and oversee all CRM users.' },
  { icon: Gauge, title: 'Platform-wide analytics', detail: 'See usage, revenue, and growth at a glance.' },
  { icon: ServerCog, title: 'Full system control', detail: 'Configure plans, features, and integrations.' },
];

export default function SuperAdminLogin() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const storyRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleStoryTilt = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = storyRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(1200px) rotateY(${x * 4}deg) rotateX(${-y * 4}deg)`;
  }, []);

  const handleStoryReset = useCallback(() => {
    if (storyRef.current) storyRef.current.style.transform = 'perspective(1200px) rotateY(0deg) rotateX(0deg)';
  }, []);

  const handleCardTilt = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(1000px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg) translateZ(0)`;
  }, []);

  const handleCardReset = useCallback(() => {
    if (cardRef.current) cardRef.current.style.transform = 'perspective(1000px) rotateY(0deg) rotateX(0deg) translateZ(0)';
  }, []);

  const changeMode = (nextMode: Mode) => {
    setMode(nextMode);
    setError('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    if (mode === 'signup') {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: 'Super Admin' } },
      });

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
    <main className="sa-auth-page">
      <section className="sa-auth-story" aria-label="Super Admin portal overview">
        <div className="sa-auth-story-glow sa-auth-story-glow-one" />
        <div className="sa-auth-story-glow sa-auth-story-glow-two" />
        <div className="sa-auth-story-glow sa-auth-story-glow-three" />

        {/* 3D floating shapes */}
        <div className="sa-auth-shape sa-auth-shape-cube" />
        <div className="sa-auth-shape sa-auth-shape-sphere" />
        <div className="sa-auth-shape sa-auth-shape-ring" />
        <div className="sa-auth-shape sa-auth-shape-bars" />

        <div className="sa-auth-story-content" ref={storyRef} onMouseMove={handleStoryTilt} onMouseLeave={handleStoryReset} style={{ transformStyle: 'preserve-3d' }}>
          <a href="#/" className="sa-auth-brand" aria-label="Back to LeadFlow CRM home" style={{ transform: 'translateZ(40px)' }}>
            <span className="sa-auth-brand-mark"><Shield size={17} strokeWidth={2.6} /></span>
            <span>
              <strong>LeadFlow</strong>
              <small>SUPER ADMIN</small>
            </span>
          </a>

          <div className="sa-auth-story-copy" style={{ transform: 'translateZ(55px)' }}>
            <span className="sa-auth-kicker"><span className="sa-auth-kicker-dot" /> PLATFORM CONTROL CENTER</span>
            <h1>Command your entire <em>CRM platform.</em></h1>
            <p>The unified control panel for managing accounts, monitoring usage, configuring features, and keeping your platform running flawlessly.</p>
          </div>

          <div className="sa-auth-benefits" style={{ transform: 'translateZ(30px)' }}>
            {features.map(({ icon: Icon, title, detail }) => (
              <div className="sa-auth-benefit" key={title}>
                <span className="sa-auth-benefit-icon"><Icon size={18} /></span>
                <span><strong>{title}</strong><small>{detail}</small></span>
              </div>
            ))}
          </div>

          <div className="sa-auth-stats" style={{ transform: 'translateZ(20px)' }}>
            <div><strong>500<span>+</span></strong><small>ACCOUNTS MANAGED</small></div>
            <div><strong>99.9<span>%</span></strong><small>UPTIME GUARANTEE</small></div>
            <div><strong>24<span>/7</span></strong><small>MONITORING</small></div>
          </div>
        </div>
        <p className="sa-auth-story-footer">Total platform visibility <span>&middot;</span> Absolute control</p>
      </section>

      <section className="sa-auth-panel">
        <div className="sa-auth-form-wrap" ref={cardRef} onMouseMove={handleCardTilt} onMouseLeave={handleCardReset} style={{ transformStyle: 'preserve-3d' }}>
          <div className="sa-auth-mobile-brand">
            <span className="sa-auth-brand-mark"><Shield size={16} /></span>
            <strong>LeadFlow Super Admin</strong>
          </div>
          <div className="sa-auth-heading" style={{ transform: 'translateZ(30px)' }}>
            <span className="sa-auth-eyebrow">ADMINISTRATIVE ACCESS</span>
            <h2>{mode === 'login' ? 'Secure sign in' : 'Create admin account'}</h2>
            <p>{mode === 'login' ? 'Access the platform control center.' : 'Set up a new super admin account.'}</p>
          </div>

          <div className="sa-auth-mode-toggle" role="tablist" aria-label="Admin access" style={{ transform: 'translateZ(20px)' }}>
            <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => changeMode('login')}>Sign in</button>
            <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'active' : ''} onClick={() => changeMode('signup')}>Create account</button>
          </div>

          <form onSubmit={handleSubmit} className="sa-auth-form" style={{ transform: 'translateZ(15px)' }}>
            <label className="sa-auth-field">
              <span>Email address</span>
              <div className="sa-auth-input-wrap">
                <Mail size={18} />
                <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@leadcentre.com" autoComplete="email" />
              </div>
            </label>
            <label className="sa-auth-field">
              <span>Password</span>
              <div className="sa-auth-input-wrap">
                <LockKeyhole size={18} />
                <input type={showPassword ? 'text' : 'password'} required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
                <button type="button" className="sa-auth-password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            {error && <div className="sa-auth-error" role="alert">{error}</div>}

            <button type="submit" className="sa-auth-submit" disabled={loading}>
              {loading ? <Loader2 size={19} className="crm-spin" /> : <>{mode === 'login' ? 'Sign in to control center' : 'Create admin account'}<ArrowRight size={19} /></>}
            </button>
          </form>

          <div className="sa-auth-divider"><span>or</span></div>
          <p className="sa-auth-switch">
            {mode === 'login' ? "Don't have an admin account?" : 'Already have an account?'}{' '}
            <button type="button" onClick={() => changeMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? 'Sign up' : 'Sign in'}</button>
          </p>
          <div className="sa-auth-trust"><span><ShieldCheck size={15} /> Admin-grade security</span><span><Check size={14} /> Full platform access</span><span><Globe2 size={14} /> Global control</span></div>
          <a href="#/" className="sa-auth-back">Back to LeadFlow home</a>
        </div>
      </section>
    </main>
  );
}
