import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Shield, ShieldCheck, Lock, Mail, ArrowRight, Eye, EyeOff, Loader2,
  Building2, Users, Server, Zap, ServerCog, Check,
} from 'lucide-react';

const platformFeatures = [
  { icon: Building2, title: 'Multi-account oversight', detail: 'Manage every workspace from a single pane.' },
  { icon: Zap, title: 'Feature toggles & plans', detail: 'Control what each account can access instantly.' },
  { icon: Server, title: 'Platform infrastructure', detail: 'Email, payments, and WhatsApp — all configurable.' },
];

export default function SuperAdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
    }
  };

  return (
    <main className="sa-auth-page">
      {/* Left — story panel */}
      <section className="sa-auth-story" aria-label="Super Admin portal">
        <div className="sa-auth-story-glow sa-auth-story-glow-one" />
        <div className="sa-auth-story-glow sa-auth-story-glow-two" />
        <div className="sa-auth-story-content">
          <a href="#/" className="sa-auth-brand" aria-label="Back to LeadFlow CRM home">
            <span className="sa-auth-brand-mark"><Shield size={17} strokeWidth={2.6} /></span>
            <span>
              <strong>LeadFlow</strong>
              <small>SUPER ADMIN</small>
            </span>
          </a>

          <div className="sa-auth-story-copy">
            <span className="sa-auth-kicker"><span className="sa-auth-kicker-dot" /> PLATFORM CONTROL CENTER</span>
            <h1>Command every <em>workspace</em> from here.</h1>
            <p>A unified control panel for managing accounts, billing, features, and infrastructure across your entire CRM platform.</p>
          </div>

          <div className="sa-auth-features">
            {platformFeatures.map(({ icon: Icon, title, detail }) => (
              <div className="sa-auth-feature" key={title}>
                <span className="sa-auth-feature-icon"><Icon size={18} /></span>
                <span><strong>{title}</strong><small>{detail}</small></span>
              </div>
            ))}
          </div>

          <div className="sa-auth-stats">
            <div><strong>11<span>modules</span></strong><small>MANAGEMENT PANELS</small></div>
            <div><strong>30<span>+</span></strong><small>EDGE FUNCTIONS</small></div>
            <div><strong>40<span>+</span></strong><small>CRM FEATURES</small></div>
          </div>
        </div>
        <p className="sa-auth-story-footer">Platform administration <span>·</span> Authorized access only</p>
      </section>

      {/* Right — form panel */}
      <section className="sa-auth-panel">
        <div className="sa-auth-form-wrap">
          <div className="sa-auth-mobile-brand">
            <span className="sa-auth-brand-mark"><Shield size={16} /></span>
            <strong>Super Admin</strong>
          </div>
          <div className="sa-auth-heading">
            <span className="sa-auth-eyebrow">RESTRICTED ACCESS</span>
            <h2>Super Admin Portal</h2>
            <p>Sign in with your platform administrator credentials.</p>
          </div>

          <form onSubmit={handleSubmit} className="sa-auth-form">
            <label className="sa-auth-field">
              <span>Email address</span>
              <div className="sa-auth-input-wrap">
                <Mail size={18} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@leadflow.com"
                  autoComplete="email"
                />
              </div>
            </label>
            <label className="sa-auth-field">
              <span>Password</span>
              <div className="sa-auth-input-wrap">
                <Lock size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button type="button" className="sa-auth-password-toggle" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            {error && <div className="sa-auth-error" role="alert">{error}</div>}

            <button type="submit" className="sa-auth-submit" disabled={loading}>
              {loading ? <Loader2 size={19} className="crm-spin" /> : <>Sign in to dashboard<ArrowRight size={19} /></>}
            </button>
          </form>

          <div className="sa-auth-trust">
            <span><ShieldCheck size={15} /> Authorized only</span>
            <span><ServerCog size={14} /> Platform-level</span>
            <span><Check size={14} /> Audit logged</span>
          </div>
          <a href="#/" className="sa-auth-back">Back to LeadFlow home</a>
        </div>
      </section>
    </main>
  );
}
