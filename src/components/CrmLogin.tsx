import { useState, useRef, useCallback, useEffect, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import {
  ArrowRight,
  BarChart3,
  Check,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  MessageSquare,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  Workflow,
} from 'lucide-react';

type Mode = 'login' | 'signup';

type SocialFlags = { google_enabled: boolean; facebook_enabled: boolean };

const benefits = [
  { icon: BarChart3, title: 'Live sales dashboard', detail: 'See every opportunity in one clear view.' },
  { icon: Workflow, title: 'Automated follow-ups', detail: 'Keep leads moving without manual reminders.' },
  { icon: MessageSquare, title: 'Conversations that convert', detail: 'Bring your customer messages together.' },
];

export default function CrmLogin({ initialMode = 'login' }: { initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has('invite') ? 'signup' : initialMode;
  });
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('invite') || '';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [socialFlags, setSocialFlags] = useState<SocialFlags | null>(null);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'facebook' | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('public_social_auth_flags').select('*').maybeSingle();
      if (data) setSocialFlags(data as SocialFlags);
    })();
  }, []);

  const handleOAuth = async (provider: 'google' | 'facebook') => {
    setOauthLoading(provider);
    setError('');
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}${window.location.pathname}#/admin` },
    });
    if (oauthError) {
      setError(oauthError.message);
      setOauthLoading(null);
    }
  };

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
        options: { data: { full_name: name.trim(), ...(phone.trim() ? { phone: phone.trim() } : {}) } },
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
    <main className="admin-auth-page">
      <section className="admin-auth-story" aria-label="HubbotsX CRM overview">
        <div className="admin-auth-story-glow admin-auth-story-glow-one" />
        <div className="admin-auth-story-glow admin-auth-story-glow-two" />
        <div className="admin-auth-story-glow admin-auth-story-glow-three" />

        {/* 3D floating shapes */}
        <div className="admin-auth-shape admin-auth-shape-cube" />
        <div className="admin-auth-shape admin-auth-shape-sphere" />
        <div className="admin-auth-shape admin-auth-shape-ring" />
        <div className="admin-auth-shape admin-auth-shape-bars" />

        <div className="admin-auth-story-content" ref={storyRef} onMouseMove={handleStoryTilt} onMouseLeave={handleStoryReset} style={{ transformStyle: 'preserve-3d' }}>
          <a href="#/" className="admin-auth-brand" aria-label="Back to HubbotsX CRM home" style={{ transform: 'translateZ(40px)' }}>
            <span className="admin-auth-brand-mark"><Sparkles size={17} strokeWidth={2.6} /></span>
            <span>
              <strong>HubbotsX</strong>
              <small>ADMIN PORTAL</small>
            </span>
          </a>

          <div className="admin-auth-story-copy" style={{ transform: 'translateZ(55px)' }}>
            <span className="admin-auth-kicker"><span className="admin-auth-kicker-dot" /> PREMIUM SALES PLATFORM</span>
            <h1>Turn every lead into your next <em>big win.</em></h1>
            <p>One calm, powerful workspace for your team to capture leads, build relationships, and close more business.</p>
          </div>

          <div className="admin-auth-benefits" style={{ transform: 'translateZ(30px)' }}>
            {benefits.map(({ icon: Icon, title, detail }) => (
              <div className="admin-auth-benefit" key={title}>
                <span className="admin-auth-benefit-icon"><Icon size={18} /></span>
                <span><strong>{title}</strong><small>{detail}</small></span>
              </div>
            ))}
          </div>

          <div className="admin-auth-stats" style={{ transform: 'translateZ(20px)' }}>
            <div><strong>10K<span>+</span></strong><small>LEADS MANAGED</small></div>
            <div><strong>42<span>%</span></strong><small>MORE CONVERSIONS</small></div>
            <div><strong>24<span>/7</span></strong><small>TEAM VISIBILITY</small></div>
          </div>
        </div>
        <p className="admin-auth-story-footer">Built for ambitious teams <span>&middot;</span> Designed for momentum</p>
      </section>

      <section className="admin-auth-panel">
        <div className="admin-auth-form-wrap" ref={cardRef} onMouseMove={handleCardTilt} onMouseLeave={handleCardReset} style={{ transformStyle: 'preserve-3d' }}>
          <div className="admin-auth-mobile-brand">
            <span className="admin-auth-brand-mark"><Sparkles size={16} /></span>
            <strong>HubbotsX</strong>
          </div>
          <div className="admin-auth-heading" style={{ transform: 'translateZ(30px)' }}>
            <span className="admin-auth-eyebrow">YOUR WORKSPACE AWAITS</span>
            <h2>{mode === 'login' ? 'Welcome back' : 'Create your workspace'}</h2>
            <p>{mode === 'login' ? 'Sign in to access your sales dashboard.' : 'Start building a clearer, faster sales process.'}</p>
          </div>

          <div className="admin-auth-mode-toggle" role="tablist" aria-label="Account access" style={{ transform: 'translateZ(20px)' }}>
            <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => changeMode('login')}>Sign in</button>
            <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'active' : ''} onClick={() => changeMode('signup')}>Create account</button>
          </div>

          <form onSubmit={handleSubmit} className="admin-auth-form" style={{ transform: 'translateZ(15px)' }}>
            {mode === 'signup' && (
              <label className="admin-auth-field">
                <span>Full name</span>
                <div className="admin-auth-input-wrap">
                  <UserRound size={18} />
                  <input type="text" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" autoComplete="name" />
                </div>
              </label>
            )}
            {mode === 'signup' && (
              <label className="admin-auth-field">
                <span>Phone number <small>(optional)</small></span>
                <div className="admin-auth-input-wrap">
                  <Phone size={18} />
                  <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+91 98765 43210" autoComplete="tel" inputMode="tel" />
                </div>
              </label>
            )}
            <label className="admin-auth-field">
              <span>Email address</span>
              <div className="admin-auth-input-wrap">
                <Mail size={18} />
                <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" autoComplete="email" />
              </div>
            </label>
            <label className="admin-auth-field">
              <span>Password</span>
              <div className="admin-auth-input-wrap">
                <LockKeyhole size={18} />
                <input type={showPassword ? 'text' : 'password'} required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
                <button type="button" className="admin-auth-password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            {error && <div className="admin-auth-error" role="alert">{error}</div>}

            <button type="submit" className="admin-auth-submit" disabled={loading}>
              {loading ? <Loader2 size={19} className="crm-spin" /> : <>{mode === 'login' ? 'Sign in to dashboard' : 'Create my account'}<ArrowRight size={19} /></>}
            </button>
          </form>

          <div className="admin-auth-divider"><span>or</span></div>

          {(socialFlags?.google_enabled || socialFlags?.facebook_enabled) && (
            <div className="admin-auth-social" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {socialFlags?.google_enabled && (
                <button type="button" onClick={() => handleOAuth('google')} disabled={oauthLoading !== null} className="admin-auth-social-btn" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '11px 16px', borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.86rem', fontWeight: 600, cursor: oauthLoading ? 'not-allowed' : 'pointer', opacity: oauthLoading && oauthLoading !== 'google' ? 0.5 : 1, transition: 'all 0.15s' }}>
                  {oauthLoading === 'google' ? <Loader2 size={18} className="crm-spin" /> : <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>}
                  Continue with Google
                </button>
              )}
              {socialFlags?.facebook_enabled && (
                <button type="button" onClick={() => handleOAuth('facebook')} disabled={oauthLoading !== null} className="admin-auth-social-btn" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '11px 16px', borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.86rem', fontWeight: 600, cursor: oauthLoading ? 'not-allowed' : 'pointer', opacity: oauthLoading && oauthLoading !== 'facebook' ? 0.5 : 1, transition: 'all 0.15s' }}>
                  {oauthLoading === 'facebook' ? <Loader2 size={18} className="crm-spin" /> : <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>}
                  Continue with Facebook
                </button>
              )}
            </div>
          )}

          <p className="admin-auth-switch">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button type="button" onClick={() => changeMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? 'Sign up free' : 'Sign in'}</button>
          </p>
          <div className="admin-auth-trust"><span><ShieldCheck size={15} /> Secure access</span><span><Check size={14} /> Your data stays yours</span><span><UsersRound size={14} /> Team-ready</span></div>
          <a href="#/" className="admin-auth-back">Back to HubbotsX home</a>
        </div>
      </section>
    </main>
  );
}
