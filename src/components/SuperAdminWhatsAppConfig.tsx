import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  MessageSquare, CheckCircle2, AlertCircle, Loader2, Save,
  Power, Zap, Smartphone, Info, ShieldCheck,
} from 'lucide-react';

type Config = {
  id: string;
  cloud_api_enabled: boolean;
  embedded_signup_enabled: boolean;
  coex_enabled: boolean;
};

export default function SuperAdminWhatsAppConfig() {
  const [config, setConfig] = useState<Config | null>(null);
  const [cloudApi, setCloudApi] = useState(true);
  const [embeddedSignup, setEmbeddedSignup] = useState(false);
  const [coex, setCoex] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: queryError } = await supabase
        .from('platform_whatsapp_config')
        .select('*')
        .maybeSingle();
      if (queryError) throw queryError;
      if (data) {
        setConfig(data as Config);
        setCloudApi(data.cloud_api_enabled);
        setEmbeddedSignup(data.embedded_signup_enabled);
        setCoex(data.coex_enabled);
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
      cloud_api_enabled: cloudApi,
      embedded_signup_enabled: embeddedSignup,
      coex_enabled: coex,
      updated_at: new Date().toISOString(),
    };
    try {
      if (config) {
        const { error: updateError } = await supabase
          .from('platform_whatsapp_config')
          .update(payload)
          .eq('id', config.id);
        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from('platform_whatsapp_config')
          .insert(payload)
          .select()
          .single();
        if (insertError) throw insertError;
        if (data) setConfig(data as Config);
      }
      setSuccess('WhatsApp configuration saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
        <Loader2 size={28} className="crm-spin" style={{ color: '#25D366' }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '720px' }}>
      {/* Hero */}
      <div style={{
        borderRadius: '20px', padding: '28px', marginBottom: '24px', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #0f172a 0%, #128C7E 50%, #075E54 100%)',
      }}>
        <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(37,211,102,0.15)', filter: 'blur(40px)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <MessageSquare size={18} style={{ color: '#25D366' }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#25D366', textTransform: 'uppercase', letterSpacing: '0.1em' }}>WhatsApp Cloud API</span>
          </div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            WhatsApp Platform Controls
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: '0.88rem', color: 'rgba(255,255,255,0.6)', maxWidth: '520px' }}>
            Master switches that control WhatsApp Cloud API access, embedded signup, and coexistence mode for all clients on your platform.
          </p>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '12px 16px', color: '#dc2626', fontSize: '0.85rem', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {success && (
        <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '10px', padding: '12px 16px', color: '#16a34a', fontSize: '0.85rem', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} /> {success}
        </div>
      )}

      {/* Info banner */}
      <div style={{ display: 'flex', gap: '12px', padding: '16px 18px', background: 'rgba(37,211,102,0.06)', border: '1px solid rgba(37,211,102,0.15)', borderRadius: '14px', marginBottom: '20px', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
        <Info size={18} style={{ color: '#25D366', flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong style={{ color: 'var(--text-main)' }}>How these switches work:</strong> The Cloud API master switch turns all WhatsApp features on or off for every client at once. Embedded Signup controls whether clients see the one-click "Connect with Facebook" button or must paste API credentials manually. Coexistence Mode lets clients run their WhatsApp number in App + API mode simultaneously — turn this off if you want API-only numbers.
        </div>
      </div>

      {/* Config card */}
      <div style={{ background: 'var(--bg-card)', borderRadius: '18px', border: '1px solid var(--border-subtle)', padding: '24px', boxShadow: '0 2px 12px -4px rgba(0,0,0,0.06)' }}>
        {/* Cloud API master toggle */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px', borderRadius: '12px', marginBottom: '16px',
          background: cloudApi ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.05)',
          border: `1px solid ${cloudApi ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
          transition: 'all 0.2s',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: cloudApi ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: cloudApi ? '#16a34a' : '#dc2626', flexShrink: 0,
            }}>
              <Power size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>WhatsApp Cloud API</div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-dark)', marginTop: '3px', maxWidth: '380px', lineHeight: 1.5 }}>
                Master switch for all WhatsApp messaging. When off, clients cannot connect numbers or send/receive messages.
              </div>
            </div>
          </div>
          <button type="button" onClick={() => setCloudApi(!cloudApi)} style={{
            width: '48px', height: '26px', borderRadius: '999px', border: 'none',
            background: cloudApi ? '#16a34a' : '#dc2626', position: 'relative',
            cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
          }}>
            <span style={{ position: 'absolute', top: '3px', left: cloudApi ? '25px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
          </button>
        </div>

        {/* Embedded signup toggle */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px', borderRadius: '12px', marginBottom: '16px',
          background: embeddedSignup ? 'rgba(37,211,102,0.06)' : 'var(--bg-light)',
          border: `1px solid ${embeddedSignup ? 'rgba(37,211,102,0.2)' : 'var(--border-subtle)'}`,
          transition: 'all 0.2s', opacity: cloudApi ? 1 : 0.5,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: embeddedSignup ? 'rgba(37,211,102,0.12)' : 'rgba(100,116,139,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: embeddedSignup ? '#25D366' : 'var(--text-dark)', flexShrink: 0,
            }}>
              <Zap size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>Embedded Signup</div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-dark)', marginTop: '3px', maxWidth: '380px', lineHeight: 1.5 }}>
                When on, clients see a "Connect with Facebook" button for one-click WhatsApp onboarding. When off, only manual API key entry is available.
              </div>
            </div>
          </div>
          <button type="button" onClick={() => cloudApi && setEmbeddedSignup(!embeddedSignup)} disabled={!cloudApi} style={{
            width: '48px', height: '26px', borderRadius: '999px', border: 'none',
            background: embeddedSignup ? '#25D366' : '#cbd5e1', position: 'relative',
            cursor: cloudApi ? 'pointer' : 'not-allowed', transition: 'background 0.2s', flexShrink: 0,
          }}>
            <span style={{ position: 'absolute', top: '3px', left: embeddedSignup ? '25px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
          </button>
        </div>

        {/* Coexistence toggle */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px', borderRadius: '12px', marginBottom: '24px',
          background: coex ? 'rgba(37,211,102,0.06)' : 'var(--bg-light)',
          border: `1px solid ${coex ? 'rgba(37,211,102,0.2)' : 'var(--border-subtle)'}`,
          transition: 'all 0.2s', opacity: cloudApi ? 1 : 0.5,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: coex ? 'rgba(37,211,102,0.12)' : 'rgba(100,116,139,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: coex ? '#25D366' : 'var(--text-dark)', flexShrink: 0,
            }}>
              <Smartphone size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>App Coexistence Mode</div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-dark)', marginTop: '3px', maxWidth: '380px', lineHeight: 1.5 }}>
                Lets clients use their WhatsApp number on both the phone app and the Cloud API at the same time (Meta's CoEx feature). Turn off to enforce API-only numbers.
              </div>
            </div>
          </div>
          <button type="button" onClick={() => cloudApi && setCoex(!coex)} disabled={!cloudApi} style={{
            width: '48px', height: '26px', borderRadius: '999px', border: 'none',
            background: coex ? '#25D366' : '#cbd5e1', position: 'relative',
            cursor: cloudApi ? 'pointer' : 'not-allowed', transition: 'background 0.2s', flexShrink: 0,
          }}>
            <span style={{ position: 'absolute', top: '3px', left: coex ? '25px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
          </button>
        </div>

        {/* Save */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={handleSave} disabled={saving} style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '10px 24px', border: 'none', borderRadius: '10px',
            background: saving ? '#94a3b8' : '#25D366', color: '#fff',
            fontSize: '0.86rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
          }}>
            {saving ? <Loader2 size={16} className="crm-spin" /> : <Save size={16} />}
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-dark)' }}>
            <ShieldCheck size={14} /> Changes apply to all clients instantly.
          </span>
        </div>
      </div>
    </div>
  );
}
