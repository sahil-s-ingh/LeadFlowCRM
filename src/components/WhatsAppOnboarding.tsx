import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import {
  Loader2, AlertCircle, CheckCircle2, Phone, Zap, ChevronRight,
  Facebook, MessageSquare, Info, ArrowRight, Plus,
} from 'lucide-react';

type WaNumberConfig = {
  id: string;
  label: string;
  phone_number_id: string;
  access_token: string;
  verify_token: string;
  waba_id: string | null;
  welcome_message: string;
  connected_phone_number: string | null;
  meta_app_id: string | null;
  is_active: boolean;
  created_at: string;
  onboarding_method?: string;
};

type EmbeddedConfig = {
  meta_app_id: string | null;
  config_id: string | null;
  enabled: boolean;
};

type PlatformFlags = {
  cloud_api_enabled: boolean;
  embedded_signup_enabled: boolean;
  coex_enabled: boolean;
};

// Facebook SDK type declarations
declare global {
  interface Window {
    FB?: {
      init: (params: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void;
      getLoginStatus: (cb: (response: FBLoginResponse) => void) => void;
      login: (cb: (response: FBLoginResponse) => void, params: { config_id: string; response_type: string; override_default_response_type: boolean; extras: { setup: string } }) => void;
    };
    fbAsyncInit?: () => void;
  }
}

type FBLoginResponse = {
  status: string;
  authResponse?: {
    code: string;
    accessToken?: string;
    expiresIn?: number;
    dataAccessExpirationTime?: number;
    userID?: string;
  };
};

export default function WhatsAppOnboarding({
  session,
  onNumberAdded,
}: {
  session: Session;
  onNumberAdded: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [embedConfig, setEmbedConfig] = useState<EmbeddedConfig | null>(null);
  const [platformFlags, setPlatformFlags] = useState<PlatformFlags | null>(null);
  const [mode, setMode] = useState<'choose' | 'embedded' | 'manual'>('choose');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Manual form state
  const [manualLabel, setManualLabel] = useState('');
  const [manualPhoneId, setManualPhoneId] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [manualWabaId, setManualWabaId] = useState('');
  const [manualDisplayNum, setManualDisplayNum] = useState('');
  const [manualWelcome, setManualWelcome] = useState('Hi! Thanks for reaching out. Our team will get back to you shortly.');
  const [showToken, setShowToken] = useState(false);

  const fbLoadedRef = useRef(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const [flagsRes, sessionData] = await Promise.all([
        supabase.from('public_whatsapp_flags').select('*').maybeSingle(),
        supabase.auth.getSession(),
      ]);
      if (flagsRes.data) setPlatformFlags(flagsRes.data as PlatformFlags);

      const token = sessionData.data?.session?.access_token;
      if (!token) { setLoading(false); return; }

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wa-embedded-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'get_config' }),
      });
      if (res.ok) {
        const data = await res.json();
        setEmbedConfig(data.config);
      }
    } catch {
      // Silent — just fall back to manual only
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  // Load Facebook SDK when entering embedded mode
  const loadFacebookSDK = useCallback(() => {
    if (fbLoadedRef.current || !embedConfig?.meta_app_id) return;
    fbLoadedRef.current = true;

    window.fbAsyncInit = function () {
      window.FB?.init({
        appId: embedConfig.meta_app_id!,
        cookie: true,
        xfbml: true,
        version: 'v21.0',
      });
    };

    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, [embedConfig]);

  const handleEmbeddedSignup = useCallback(() => {
    if (!window.FB) {
      setError('Facebook SDK not loaded yet. Please wait a moment and try again.');
      return;
    }
    if (!embedConfig?.config_id) {
      setError('Embedded signup is not properly configured. Please contact your platform admin.');
      return;
    }

    setError('');
    setSaving(true);

    window.FB.login(
      (response: FBLoginResponse) => {
        if (response.status !== 'connected' || !response.authResponse?.code) {
          setSaving(false);
          if (response.status === 'not_authorized') {
            setError('You cancelled the Facebook login. Please try again.');
          }
          return;
        }

        // The response.code is what we need for server-side exchange
        // But we also get phone_number_id and waba_id from the response
        // Meta returns these in the response when using embedded signup
        // The code alone is enough to exchange, and the phone number selection
        // happens in the popup — we get the code back and need to figure out
        // which phone number was selected via the Graph API

        // For now, we need to get the phone numbers from the WABA
        // The authResponse.code can be exchanged for a token, then we
        // query the /me/accounts endpoint to get WABA IDs and phone numbers

        // Let's do the exchange + phone number fetch server-side
        (async () => {
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;
            if (!token) { setError('Not authenticated'); setSaving(false); return; }

            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wa-embedded-signup`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                action: 'exchange_code',
                code: response.authResponse!.code,
                access_token: response.authResponse.accessToken || undefined,
                phone_number_id: '', // Will be resolved server-side
                waba_id: '', // Will be resolved server-side
              }),
            });

            const data = await res.json();
            if (!res.ok || data.error) {
              setError(data.error || 'Failed to complete embedded signup');
              setSaving(false);
              return;
            }

            setSuccess(true);
            setSaving(false);
            onNumberAdded();
            setTimeout(() => { setSuccess(false); setMode('choose'); }, 3000);
          } catch {
            setError('Failed to connect to the server during signup');
            setSaving(false);
          }
        })();
      },
      {
        config_id: embedConfig.config_id,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: JSON.stringify({
            // This tells Meta to show the WhatsApp embedded signup flow
            feature: 'whatsapp_embedded_signup',
            version: '2',
          }),
        },
      }
    );
  }, [embedConfig, onNumberAdded]);

  const handleManualSave = async () => {
    setSaving(true);
    setError('');
    if (!manualPhoneId.trim() || !manualToken.trim()) {
      setError('Phone Number ID and Access Token are required.');
      setSaving(false);
      return;
    }
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { setError('Not authenticated'); setSaving(false); return; }

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wa-embedded-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'save_manual',
          phone_number_id: manualPhoneId.trim(),
          access_token: manualToken.trim(),
          waba_id: manualWabaId.trim() || undefined,
          display_phone_number: manualDisplayNum.trim() || undefined,
          label: manualLabel.trim() || undefined,
          welcome_message: manualWelcome.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Failed to save number');
        setSaving(false);
        return;
      }

      setSuccess(true);
      setSaving(false);
      onNumberAdded();
      // Reset form
      setManualLabel(''); setManualPhoneId(''); setManualToken('');
      setManualWabaId(''); setManualDisplayNum('');
      setManualWelcome('Hi! Thanks for reaching out. Our team will get back to you shortly.');
      setTimeout(() => { setSuccess(false); setMode('choose'); }, 3000);
    } catch {
      setError('Failed to save number');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
        <Loader2 size={24} className="crm-spin" style={{ color: '#25D366' }} />
      </div>
    );
  }

  const cloudApiDisabled = platformFlags ? !platformFlags.cloud_api_enabled : false;
  const embeddedAvailable = embedConfig?.enabled && embedConfig?.meta_app_id && embedConfig?.config_id && (platformFlags?.embedded_signup_enabled ?? false);

  return (
    <div>
      {cloudApiDisabled && (
        <div style={{
          marginBottom: '14px', padding: '14px 16px',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: '10px', color: '#dc2626', fontSize: '0.84rem',
          display: 'flex', alignItems: 'center', gap: '8px', lineHeight: 1.5,
        }}>
          <AlertCircle size={16} /> WhatsApp Cloud API is currently disabled by the platform administrator. You cannot connect new numbers or send messages until it is re-enabled.
        </div>
      )}
      {error && (
        <div style={{
          marginBottom: '14px', padding: '10px 14px',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: '10px', color: '#dc2626', fontSize: '0.82rem',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {success && (
        <div style={{
          marginBottom: '14px', padding: '10px 14px',
          background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
          borderRadius: '10px', color: '#15803d', fontSize: '0.82rem',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <CheckCircle2 size={16} /> WhatsApp number connected successfully!
        </div>
      )}

      {/* Choose mode */}
      {mode === 'choose' && !cloudApiDisabled && (
        <div style={{
          padding: '24px', background: 'var(--bg-card)', borderRadius: '14px',
          border: '1px solid var(--border-subtle)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Plus size={18} style={{ color: '#25D366' }} />
            <strong style={{ fontSize: '0.9rem' }}>Add a WhatsApp Number</strong>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-dark)', marginBottom: '18px', lineHeight: 1.5 }}>
            Choose how you'd like to connect your WhatsApp Business number.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {/* Embedded signup option */}
            <button
              type="button"
              onClick={() => {
                if (!embeddedAvailable) return;
                setMode('embedded');
                loadFacebookSDK();
              }}
              disabled={!embeddedAvailable}
              style={{
                padding: '20px', borderRadius: '14px', textAlign: 'left', cursor: embeddedAvailable ? 'pointer' : 'not-allowed',
                border: embeddedAvailable ? '2px solid rgba(37,211,102,0.3)' : '1px solid var(--border-subtle)',
                background: embeddedAvailable ? 'rgba(37,211,102,0.04)' : 'var(--bg-light)',
                transition: 'all 0.2s', opacity: embeddedAvailable ? 1 : 0.6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px',
                  background: 'linear-gradient(135deg, #25D366, #128C7E)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', flexShrink: 0,
                }}>
                  <Zap size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>Quick Connect</div>
                  <div style={{ fontSize: '0.72rem', color: '#25D366', fontWeight: 600 }}>Recommended</div>
                </div>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-dark)', margin: 0, lineHeight: 1.5 }}>
                Sign in with Facebook and select your WhatsApp number. No manual API keys needed — everything is set up automatically.
              </p>
              {!embeddedAvailable && (
                <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '8px', fontStyle: 'italic' }}>
                  Not available — contact your platform admin to enable this.
                </p>
              )}
            </button>

            {/* Manual option */}
            <button
              type="button"
              onClick={() => setMode('manual')}
              style={{
                padding: '20px', borderRadius: '14px', textAlign: 'left', cursor: 'pointer',
                border: '1px solid var(--border-subtle)', background: 'var(--bg-card)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0f766e'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px',
                  background: 'var(--bg-light)', border: '1px solid var(--border-subtle)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-muted)', flexShrink: 0,
                }}>
                  <Phone size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>Manual Setup</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dark)' }}>Advanced users</div>
                </div>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-dark)', margin: 0, lineHeight: 1.5 }}>
                Enter your Phone Number ID, Access Token, and WABA ID manually from your Meta Business Manager.
              </p>
            </button>
          </div>
        </div>
      )}

      {/* Embedded signup mode */}
      {mode === 'embedded' && !cloudApiDisabled && (
        <div style={{
          padding: '24px', background: 'var(--bg-card)', borderRadius: '14px',
          border: '1px solid var(--border-subtle)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Facebook size={20} style={{ color: '#1877F2' }} />
            <strong style={{ fontSize: '0.9rem' }}>Connect with Facebook</strong>
            <button type="button" onClick={() => { setMode('choose'); setError(''); }}
              style={{ marginLeft: 'auto', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-dark)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', background: 'var(--bg-card)' }}>
              Back
            </button>
          </div>
          <div style={{
            padding: '16px', borderRadius: '12px', background: 'rgba(37,211,102,0.06)',
            border: '1px solid rgba(37,211,102,0.15)', marginBottom: '16px',
          }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <Info size={16} style={{ color: '#25D366', flexShrink: 0, marginTop: '2px' }} />
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                Click the button below to open Facebook's WhatsApp signup popup. You'll log in to your Meta Business account, select your WhatsApp Business number, and we'll automatically save everything — no copy-pasting required.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleEmbeddedSignup}
            disabled={saving}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '12px',
              padding: '12px 24px', border: 'none', borderRadius: '10px',
              background: saving ? '#94a3b8' : '#1877F2',
              color: '#fff', fontSize: '0.9rem', fontWeight: 600,
              fontFamily: 'inherit',
              cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
              boxShadow: saving ? 'none' : '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
            }}
            onMouseEnter={(e) => { if (!saving) e.currentTarget.style.background = '#0f6bd6'; }}
            onMouseLeave={(e) => { if (!saving) e.currentTarget.style.background = '#1877F2'; }}
          >
            {saving ? <Loader2 size={18} className="crm-spin" /> : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"/>
              </svg>
            )}
            {saving ? 'Connecting...' : 'Continue with Facebook'}
          </button>
        </div>
      )}

      {/* Manual setup mode */}
      {mode === 'manual' && !cloudApiDisabled && (
        <div style={{
          padding: '24px', background: 'var(--bg-card)', borderRadius: '14px',
          border: '1px solid var(--border-subtle)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Phone size={18} style={{ color: '#25D366' }} />
            <strong style={{ fontSize: '0.9rem' }}>Manual WhatsApp Setup</strong>
            <button type="button" onClick={() => { setMode('choose'); setError(''); }}
              style={{ marginLeft: 'auto', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-dark)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', background: 'var(--bg-card)' }}>
              Back
            </button>
          </div>
          <div className="crm-add-lead-grid">
            <label className="crm-add-lead-field" style={{ gridColumn: '1 / -1' }}>
              <span>Label (optional)</span>
              <input type="text" value={manualLabel} onChange={(e) => setManualLabel(e.target.value)} placeholder="e.g. Sales Line, Support Line" />
            </label>
            <label className="crm-add-lead-field" style={{ gridColumn: '1 / -1' }}>
              <span>Connected WhatsApp Number</span>
              <input type="tel" value={manualDisplayNum} onChange={(e) => setManualDisplayNum(e.target.value)} placeholder="e.g. +1234567890" />
            </label>
            <label className="crm-add-lead-field" style={{ gridColumn: '1 / -1' }}>
              <span>Phone Number ID <em>*</em></span>
              <input type="text" required value={manualPhoneId} onChange={(e) => setManualPhoneId(e.target.value)} placeholder="123456789012345" style={{ fontFamily: 'monospace', fontSize: '0.82rem' }} />
            </label>
            <label className="crm-add-lead-field" style={{ gridColumn: '1 / -1' }}>
              <span>Access Token <em>*</em></span>
              <div style={{ position: 'relative' }}>
                <input type={showToken ? 'text' : 'password'} required value={manualToken} onChange={(e) => setManualToken(e.target.value)} placeholder="EAAxxxxxxxxxxxxxxxxx" style={{ width: '100%', paddingRight: '40px', fontFamily: 'monospace', fontSize: '0.82rem' }} />
                <button type="button" onClick={() => setShowToken(!showToken)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-dark)', fontSize: '0.75rem', padding: '4px' }}>
                  {showToken ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>
            <label className="crm-add-lead-field">
              <span>WhatsApp Business Account ID</span>
              <input type="text" value={manualWabaId} onChange={(e) => setManualWabaId(e.target.value)} placeholder="Optional" style={{ fontFamily: 'monospace', fontSize: '0.82rem' }} />
            </label>
            <label className="crm-add-lead-field" style={{ gridColumn: '1 / -1' }}>
              <span>Welcome Message</span>
              <textarea value={manualWelcome} onChange={(e) => setManualWelcome(e.target.value)} rows={2} placeholder="Hi! Thanks for reaching out." style={{ fontFamily: 'inherit', resize: 'vertical' }} />
            </label>
          </div>
          <div style={{ marginTop: '14px', display: 'flex', gap: '8px' }}>
            <button type="button" onClick={handleManualSave} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 20px', border: 'none', borderRadius: '8px', background: saving ? '#94a3b8' : '#25D366', color: 'var(--bg-card)', fontSize: '0.82rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {saving ? 'Saving...' : 'Add Number'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
