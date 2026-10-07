import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { Shield, Lock, Mail, ArrowRight, Eye, EyeOff, UserPlus, Loader2, TrendingUp } from 'lucide-react';

type Mode = 'login' | 'signup';

export default function SuperAdminLogin() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');

    if (mode === 'signup') {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }
      // Auto sign-in after signup
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }
      // Try to bootstrap as first super admin
      if (signUpData.user) {
        const { data: bootstrapped, error: bootstrapError } = await supabase.rpc('bootstrap_super_admin');
        if (bootstrapError) {
 setError(bootstrapError.message);
          setLoading(false);
          return;
        }
        if (bootstrapped === true) {
          setInfo('Welcome! You are now the first super admin. Loading dashboard...');
          // Auth state change will redirect to dashboard
        } else {
          setInfo('Account created! An existing super admin needs to promote you before you can access this portal.');
        }
      }
    } else {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }
      // Try to bootstrap as first super admin (if no super admins exist yet)
      if (signInData.user) {
        const { data: bootstrapped } = await supabase.rpc('bootstrap_super_admin');
        if (bootstrapped === true) {
          setInfo('Welcome! You are now the first super admin. Loading dashboard...');
          // Auth state change will redirect
          setLoading(false);
          return;
        }

        // Check if already a super admin
        const { data: adminCheck } = await supabase
          .from('super_admins')
          .select('id')
          .eq('id', signInData.user.id)
          .maybeSingle();

        if (!adminCheck) {
          setError('You are not authorized as a super admin. If you believe this is an error, contact the platform owner.');
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }
      }
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f766e 100%)',
      padding: '20px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: '#fff',
        borderRadius: '20px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0f172a, #0f766e)',
          padding: '32px 28px',
          textAlign: 'center',
          color: '#fff',
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: 'rgba(255,255,255,0.15)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '14px',
            backdropFilter: 'blur(10px)',
          }}>
            <Shield size={28} strokeWidth={2.5} />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Super Admin Portal</h1>
          <p style={{ fontSize: '0.85rem', opacity: 0.8, marginTop: '6px', marginBottom: 0 }}>
            {mode === 'login' ? 'Sign in to manage your CRM platform' : 'Create your super admin account'}
          </p>
        </div>

        {/* Mode Toggle */}
        <div style={{ display: 'flex', padding: '20px 28px 0', gap: '4px', background: '#fff' }}>
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); setInfo(''); }}
            style={{
              flex: 1, padding: '10px', border: 'none', borderRadius: '8px 8px 0 0',
              fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
              background: mode === 'login' ? '#0f766e' : '#f1f5f9',
              color: mode === 'login' ? '#fff' : '#64748b',
              transition: 'all 0.2s',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(''); setInfo(''); }}
            style={{
              flex: 1, padding: '10px', border: 'none', borderRadius: '8px 8px 0 0',
              fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
              background: mode === 'signup' ? '#0f766e' : '#f1f5f9',
              color: mode === 'signup' ? '#fff' : '#64748b',
              transition: 'all 0.2s',
            }}
          >
            <UserPlus size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 28px 28px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="sa-email" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                id="sa-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@leadcentre.com"
                autoComplete="email"
                style={{
                  width: '100%', padding: '12px 12px 12px 40px', border: '2px solid #e2e8f0',
                  borderRadius: '10px', fontSize: '0.88rem', outline: 'none',
                  transition: 'border-color 0.2s', boxSizing: 'border-box',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#0f766e'; }}
                onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="sa-password" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                id="sa-password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'Min 6 characters' : 'Enter your password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                style={{
                  width: '100%', padding: '12px 40px 12px 40px', border: '2px solid #e2e8f0',
                  borderRadius: '10px', fontSize: '0.88rem', outline: 'none',
                  transition: 'border-color 0.2s', boxSizing: 'border-box',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#0f766e'; }}
                onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                  border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px',
                }}
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              padding: '12px 14px', background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: '10px', fontSize: '0.82rem', color: '#dc2626', marginBottom: '16px',
            }}>
              {error}
            </div>
          )}

          {info && (
            <div style={{
              padding: '12px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0',
              borderRadius: '10px', fontSize: '0.82rem', color: '#16a34a', marginBottom: '16px',
            }}>
              {info}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '13px', border: 'none', borderRadius: '10px',
              background: loading ? '#94a3b8' : '#0f766e', color: '#fff',
              fontSize: '0.9rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'background 0.2s',
            }}
          >
            {loading ? (
              <Loader2 size={20} className="crm-spin" />
            ) : (
              <>
                {mode === 'login' ? 'Sign In' : 'Create Super Admin Account'}
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', paddingBottom: '20px' }}>
          <a href="#/" style={{ fontSize: '0.8rem', color: '#64748b', textDecoration: 'none' }}>
            <TrendingUp size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
            Back to LeadCentre
          </a>
        </div>
      </div>
    </div>
  );
}
