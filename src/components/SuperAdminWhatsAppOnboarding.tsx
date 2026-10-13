import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  MessageSquare, Loader2, AlertCircle, CheckCircle2, Save, Zap, Settings,
  Phone, Shield, ExternalLink, Info,
} from 'lucide-react';

export default function SuperAdminWhatsAppOnboarding() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const [metaAppId, setMetaAppId] = useState('');
  const [configId, setConfigId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [appSecret, setAppSecret] = useState('');
  const [showAppSecret, setShowAppSecret] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('wa_embedded_signup_config')
        .select('*')
        .maybeSingle();
      if (err) throw err;
      if (data) {
        setMetaAppId(data.meta_app_id || '');
        setConfigId(data.config_id || '');
        setEnabled(data.enabled || false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load config';
      setError(msg);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const payload = {
        meta_app_id: metaAppId.trim() || null,
        config_id: configId.trim() || null,
        enabled,
        updated_at: new Date().toISOString(),
      };
      const { data: existing } = await supabase
        .from('wa_embedded_signup_config')
        .select('id')
        .maybeSingle();
      const result = existing
        ? await supabase.from('wa_embedded_signup_config').update(payload).eq('id', existing.id)
        : await supabase.from('wa_embedded_signup_config').insert(payload);
      if (result.error) throw result.error;
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save';
      setError(msg);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={32} className="crm-spin" style={{ color: '#0f766e' }} />
          <p style={{ marginTop: '12px', color: 'var(--text-dark)', fontSize: '0.88rem' }}>Loading WhatsApp onboarding config...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '720px' }}>
      {/* Hero */}
      <div style={{
        borderRadius: '20px', padding: '28px', marginBottom: '24px', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #0f172a 0%, #0f766e 50%, #134e4a 100%)',
      }}>
        <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(20,184,166,0.15)', filter: 'blur(40px)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <MessageSquare size={18} style={{ color: '#5eead4' }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#5eead4', textTransform: 'uppercase', letterSpacing: '0.1em' }}>WhatsApp Embedded Signup</span>
          </div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            WhatsApp Onboarding Settings
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: '0.88rem', color: 'rgba(255,255,255,0.6)', maxWidth: '520px' }}>
            Configure Meta's embedded signup so your clients can connect their WhatsApp Business number with one click — no manual API keys needed.
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div style={{
        marginBottom: '20px', padding: '16px 18px', borderRadius: '14px',
        background: 'rgba(15,118,110,0.06)', border: '1px solid rgba(15,118,110,0.15)',
        display: 'flex', gap: '12px', alignItems: 'flex-start',
      }}>
        <Info size={18} style={{ color: '#0f766e', flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text-main)' }}>How embedded signup works:</strong> Your clients click a "Connect WhatsApp" button, a Facebook popup opens, they log in to their Meta Business Manager and select their WhatsApp number. The system automatically saves the access token and phone number ID — no copy-pasting required. You'll need a Meta App with WhatsApp Business API enabled and an Embedded Signup configuration ID from the Meta App Dashboard.
        </div>
      </div>

      {error && (
        <div style={{
          padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid #fecaca',
          borderRadius: '14px', fontSize: '0.85rem', color: '#dc2626', marginBottom: '20px',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {saved && (
        <div style={{
          padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid #bbf7d0',
          borderRadius: '14px', fontSize: '0.85rem', color: '#16a34a', marginBottom: '20px',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <CheckCircle2 size={18} /> Configuration saved successfully!
        </div>
      )}

      {/* Config form */}
      <div style={{
        background: 'var(--bg-card)', borderRadius: '18px', border: '1px solid var(--border-subtle)',
        padding: '24px', boxShadow: '0 2px 12px -4px rgba(0,0,0,0.06)',
      }}>
        {/* Enable toggle */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderRadius: '12px',
          background: enabled ? 'rgba(34,197,94,0.08)' : 'var(--bg-light)',
          border: `1px solid ${enabled ? 'rgba(34,197,94,0.2)' : 'var(--border-subtle)'}`,
          marginBottom: '24px', transition: 'all 0.2s',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: enabled ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: enabled ? '#16a34a' : 'var(--text-dark)', flexShrink: 0,
            }}>
              <Zap size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>Enable Embedded Signup</div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-dark)', marginTop: '2px' }}>
                When enabled, clients see a "Connect with Facebook" button in their WhatsApp settings
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            style={{
              width: '48px', height: '26px', borderRadius: '999px', border: 'none',
              background: enabled ? '#16a34a' : '#cbd5e1', position: 'relative',
              cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
            }}
          >
            <span style={{
              position: 'absolute', top: '3px', left: enabled ? '25px' : '3px',
              width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
              transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </button>
        </div>

        {/* Meta App ID */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Settings size={14} style={{ color: 'var(--text-dark)' }} />
              Meta App ID
            </span>
          </label>
          <input
            type="text"
            value={metaAppId}
            onChange={(e) => setMetaAppId(e.target.value)}
            placeholder="e.g. 1234567890123456"
            style={{
              width: '100%', padding: '10px 14px', border: '1px solid var(--border-subtle)',
              borderRadius: '10px', fontSize: '0.86rem', fontFamily: 'monospace',
              background: 'var(--bg-card)', color: 'var(--text-main)', outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => { e.target.style.borderColor = '#0f766e'; }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; }}
          />
          <p style={{ fontSize: '0.74rem', color: 'var(--text-dark)', marginTop: '5px' }}>
            Found in your Meta App Dashboard under App Settings &raquo; Basic.
          </p>
        </div>

        {/* Configuration ID */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Phone size={14} style={{ color: 'var(--text-dark)' }} />
              Embedded Signup Configuration ID
            </span>
          </label>
          <input
            type="text"
            value={configId}
            onChange={(e) => setConfigId(e.target.value)}
            placeholder="e.g. 9876543210987"
            style={{
              width: '100%', padding: '10px 14px', border: '1px solid var(--border-subtle)',
              borderRadius: '10px', fontSize: '0.86rem', fontFamily: 'monospace',
              background: 'var(--bg-card)', color: 'var(--text-main)', outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => { e.target.style.borderColor = '#0f766e'; }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; }}
          />
          <p style={{ fontSize: '0.74rem', color: 'var(--text-dark)', marginTop: '5px' }}>
            Found in WhatsApp Manager under WhatsApp Account &raquo; Embedded Signup &raquo; Configuration.
          </p>
        </div>

        {/* App Secret (optional, for server-side code exchange) */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Shield size={14} style={{ color: 'var(--text-dark)' }} />
              App Secret <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--text-dark)' }}>(stored as edge function secret)</span>
            </span>
          </label>
          <p style={{ fontSize: '0.74rem', color: 'var(--text-dark)', marginTop: '0', marginBottom: '8px' }}>
            If set as the <code style={{ fontSize: '0.72rem', background: 'var(--bg-light)', padding: '2px 5px', borderRadius: '4px' }}>WA_APP_SECRET</code> edge function secret, the server securely exchanges the signup code for a long-lived token. Without it, the client-side SDK token is used directly.
          </p>
          <div style={{ position: 'relative' }}>
            <input
              type={showAppSecret ? 'text' : 'password'}
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
              placeholder="Optional — set WA_APP_SECRET in edge function secrets"
              style={{
                width: '100%', padding: '10px 14px', paddingRight: '60px',
                border: '1px solid var(--border-subtle)', borderRadius: '10px',
                fontSize: '0.86rem', fontFamily: 'monospace',
                background: 'var(--bg-card)', color: 'var(--text-main)', outline: 'none',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#0f766e'; }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; }}
            />
            <button
              type="button"
              onClick={() => setShowAppSecret(!showAppSecret)}
              style={{
                position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                border: 'none', background: 'none', cursor: 'pointer',
                color: 'var(--text-dark)', fontSize: '0.75rem', padding: '4px',
              }}
            >
              {showAppSecret ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {/* Webhook URL info */}
        <div style={{
          marginBottom: '24px', padding: '14px 16px', borderRadius: '12px',
          background: 'var(--bg-light)', border: '1px solid var(--border-subtle)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <ExternalLink size={14} style={{ color: 'var(--text-dark)' }} />
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>Webhook URL</span>
          </div>
          <p style={{ fontSize: '0.76rem', color: 'var(--text-dark)', margin: 0, fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook
          </p>
          <p style={{ fontSize: '0.74rem', color: 'var(--text-dark)', marginTop: '6px' }}>
            The embedded signup flow automatically registers this webhook with the client's WhatsApp Business Account. Make sure this URL is also set in your Meta App's webhook settings.
          </p>
        </div>

        {/* Save button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '10px 24px', border: 'none', borderRadius: '10px',
            background: saving ? '#94a3b8' : '#0f766e', color: '#fff',
            fontSize: '0.86rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {saving ? <Loader2 size={16} className="crm-spin" /> : <Save size={16} />}
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
}
