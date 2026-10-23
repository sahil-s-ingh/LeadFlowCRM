import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  KeyRound, CheckCircle2, AlertCircle, Loader2, Save,
  ShieldCheck, Eye, EyeOff, Info, ExternalLink,
} from 'lucide-react';

type Config = {
  id: string;
  google_enabled: boolean;
  facebook_enabled: boolean;
  google_client_id: string | null;
  google_client_secret: string | null;
  facebook_client_id: string | null;
  facebook_client_secret: string | null;
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--border-subtle)',
  borderRadius: '8px',
  background: 'var(--bg-card)',
  color: 'var(--text-main)',
  fontSize: '0.85rem',
  outline: 'none',
  transition: 'border-color 0.15s',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.82rem',
  fontWeight: 600,
  color: 'var(--text-main)',
  marginBottom: '6px',
};

export default function SuperAdminSocialAuthSettings() {
  const [config, setConfig] = useState<Config | null>(null);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [facebookEnabled, setFacebookEnabled] = useState(false);
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [facebookClientId, setFacebookClientId] = useState('');
  const [facebookClientSecret, setFacebookClientSecret] = useState('');
  const [showGoogleSecret, setShowGoogleSecret] = useState(false);
  const [showFbSecret, setShowFbSecret] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: queryError } = await supabase
        .from('platform_social_auth_config')
        .select('*')
        .maybeSingle();
      if (queryError) throw queryError;
      if (data) {
        setConfig(data as Config);
        setGoogleEnabled(data.google_enabled);
        setFacebookEnabled(data.facebook_enabled);
        setGoogleClientId(data.google_client_id || '');
        setGoogleClientSecret(data.google_client_secret || '');
        setFacebookClientId(data.facebook_client_id || '');
        setFacebookClientSecret(data.facebook_client_secret || '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(''), 4000); return () => clearTimeout(t); }
  }, [success]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    const payload = {
      google_enabled: googleEnabled,
      facebook_enabled: facebookEnabled,
      google_client_id: googleClientId.trim() || null,
      google_client_secret: googleClientSecret.trim() || null,
      facebook_client_id: facebookClientId.trim() || null,
      facebook_client_secret: facebookClientSecret.trim() || null,
      updated_at: new Date().toISOString(),
    };
    try {
      if (config) {
        const { error: updateError } = await supabase
          .from('platform_social_auth_config')
          .update(payload)
          .eq('id', config.id);
        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from('platform_social_auth_config')
          .insert(payload)
          .select()
          .single();
        if (insertError) throw insertError;
        if (data) setConfig(data as Config);
      }
      setSuccess('Social login configuration saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    }
    setSaving(false);
  };

  const Toggle = ({ on, onClick, label, color }: { on: boolean; onClick: () => void; label: string; color: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 16px', background: 'var(--bg-light)', borderRadius: '10px' }}>
      <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)' }}>{label}</span>
      <button type="button" onClick={onClick} style={{ width: '44px', height: '24px', borderRadius: '999px', border: 'none', background: on ? color : 'var(--border-subtle)', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
        <span style={{ position: 'absolute', top: '2px', left: on ? '22px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
        <Loader2 size={28} className="crm-spin" style={{ color: '#0f766e' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, #2563eb, #db2777)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <KeyRound size={24} style={{ color: '#fff' }} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>Social Login</h2>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Enable "Continue with Google" and "Continue with Facebook" on the admin login page</p>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '12px 16px', color: '#dc2626', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {success && (
        <div style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: '10px', padding: '12px 16px', color: '#16a34a', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} /> {success}
        </div>
      )}

      {/* Important setup notice */}
      <div style={{ display: 'flex', gap: '12px', padding: '16px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: '10px', fontSize: '0.84rem', color: '#854d0e', lineHeight: 1.6 }}>
        <Info size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
        <div>
          <strong>How this works:</strong> The toggles below control which buttons appear on the login page. For the buttons to actually work, you must also enable the provider in your Supabase Dashboard under <em>Authentication → Providers</em> and paste the same client ID and secret there. Supabase handles the OAuth handshake server-side — storing the credentials here is for your reference only.
          <a href="https://supabase.com/dashboard/project/_/auth/providers" target="_blank" rel="noreferrer" style={{ color: '#2563eb', marginLeft: '6px', display: 'inline-flex', alignItems: 'center', gap: '3px', textDecoration: 'none', fontWeight: 600 }}>Open Supabase Auth Providers <ExternalLink size={12} /></a>
        </div>
      </div>

      {/* Google section */}
      <div style={{ background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border-subtle)', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>Google</h3>
        </div>
        <Toggle on={googleEnabled} onClick={() => setGoogleEnabled(!googleEnabled)} label="Show Continue with Google button" color="#2563eb" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
          <div>
            <label style={labelStyle}>Google Client ID</label>
            <input type="text" value={googleClientId} onChange={(e) => setGoogleClientId(e.target.value)} placeholder="xxxxx.apps.googleusercontent.com" style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.82rem' }} />
            <small style={{ fontSize: '0.74rem', color: 'var(--text-dark)', marginTop: '4px', display: 'block' }}>From Google Cloud Console → Credentials → OAuth 2.0 Client ID.</small>
          </div>
          <div>
            <label style={labelStyle}>Google Client Secret</label>
            <div style={{ position: 'relative' }}>
              <input type={showGoogleSecret ? 'text' : 'password'} value={googleClientSecret} onChange={(e) => setGoogleClientSecret(e.target.value)} placeholder="GOCSPX-xxxx" style={{ ...inputStyle, paddingRight: '38px', fontFamily: 'monospace', fontSize: '0.82rem' }} />
              <button type="button" onClick={() => setShowGoogleSecret(!showGoogleSecret)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dark)', padding: '4px' }}>
                {showGoogleSecret ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <small style={{ fontSize: '0.74rem', color: 'var(--text-dark)', marginTop: '4px', display: 'block' }}>From Google Cloud Console → Credentials.</small>
          </div>
        </div>
      </div>

      {/* Facebook section */}
      <div style={{ background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border-subtle)', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>Facebook</h3>
        </div>
        <Toggle on={facebookEnabled} onClick={() => setFacebookEnabled(!facebookEnabled)} label="Show Continue with Facebook button" color="#1877F2" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
          <div>
            <label style={labelStyle}>Facebook App ID</label>
            <input type="text" value={facebookClientId} onChange={(e) => setFacebookClientId(e.target.value)} placeholder="1234567890123456" style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.82rem' }} />
            <small style={{ fontSize: '0.74rem', color: 'var(--text-dark)', marginTop: '4px', display: 'block' }}>From Meta for Developers → App Settings → Basic.</small>
          </div>
          <div>
            <label style={labelStyle}>Facebook App Secret</label>
            <div style={{ position: 'relative' }}>
              <input type={showFbSecret ? 'text' : 'password'} value={facebookClientSecret} onChange={(e) => setFacebookClientSecret(e.target.value)} placeholder="••••••••••••••••" style={{ ...inputStyle, paddingRight: '38px', fontFamily: 'monospace', fontSize: '0.82rem' }} />
              <button type="button" onClick={() => setShowFbSecret(!showFbSecret)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dark)', padding: '4px' }}>
                {showFbSecret ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <small style={{ fontSize: '0.74rem', color: 'var(--text-dark)', marginTop: '4px', display: 'block' }}>Click "Show" in Meta App Dashboard to reveal.</small>
          </div>
        </div>
      </div>

      {/* Save */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button type="button" onClick={handleSave} disabled={saving} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#0f766e', color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {saving ? <Loader2 size={16} className="crm-spin" /> : <Save size={16} />} Save Configuration
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-dark)', marginTop: '4px' }}>
        <ShieldCheck size={14} /> Client secrets are stored in your database and never sent to the browser of end users.
      </div>
    </div>
  );
}
