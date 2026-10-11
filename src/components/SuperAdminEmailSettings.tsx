import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft, Loader2, AlertCircle, CheckCircle2, Save, Mail, Server,
  Shield, Eye, EyeOff, Send, TestTube, X,
} from 'lucide-react';

type PlatformSmtpConfig = {
  id: string;
  smtp_host: string | null;
  smtp_port: number;
  smtp_username: string | null;
  smtp_password: string | null;
  from_email: string | null;
  from_name: string | null;
  use_tls: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export default function SuperAdminEmailSettings({ onBack }: { onBack: () => void }) {
  const [config, setConfig] = useState<PlatformSmtpConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [form, setForm] = useState({
    smtp_host: '',
    smtp_port: 587,
    smtp_username: '',
    smtp_password: '',
    from_email: '',
    from_name: '',
    use_tls: true,
    is_active: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('platform_smtp_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (err) throw err;

      if (data) {
        const cfg = data as PlatformSmtpConfig;
        setConfig(cfg);
        setForm({
          smtp_host: cfg.smtp_host || '',
          smtp_port: cfg.smtp_port || 587,
          smtp_username: cfg.smtp_username || '',
          smtp_password: cfg.smtp_password || '',
          from_email: cfg.from_email || '',
          from_name: cfg.from_name || '',
          use_tls: cfg.use_tls,
          is_active: cfg.is_active,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(''), 4000); return () => clearTimeout(t); }
  }, [success]);

  const save = async () => {
    if (!form.smtp_host.trim() || !form.smtp_username.trim() || !form.smtp_password.trim()) {
      setError('SMTP host, username, and password are required.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        smtp_host: form.smtp_host.trim(),
        smtp_port: form.smtp_port,
        smtp_username: form.smtp_username.trim(),
        smtp_password: form.smtp_password.trim(),
        from_email: form.from_email.trim() || null,
        from_name: form.from_name.trim() || null,
        use_tls: form.use_tls,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      };

      if (config) {
        const { error: err } = await supabase
          .from('platform_smtp_settings')
          .update(payload)
          .eq('id', config.id);
        if (err) throw err;
        setSuccess('Platform SMTP settings updated successfully.');
      } else {
        const { error: err } = await supabase
          .from('platform_smtp_settings')
          .insert(payload);
        if (err) throw err;
        setSuccess('Platform SMTP settings created successfully.');
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    }
    setSaving(false);
  };

  const sendTestEmail = async () => {
    if (!testEmail.trim()) {
      setTestResult({ type: 'error', message: 'Enter a recipient email address.' });
      return;
    }
    if (!config && (!form.smtp_host || !form.smtp_username || !form.smtp_password)) {
      setTestResult({ type: 'error', message: 'Save SMTP settings before testing.' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('No active session');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          to: testEmail.trim(),
          subject: 'Platform SMTP Test — LeadCentre CRM',
          body: 'This is a test email from the LeadCentre CRM platform SMTP configuration. If you received this, your SMTP settings are working correctly.',
          is_bulk: false,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Send failed (${response.status})`);
      }
      setTestResult({ type: 'success', message: `Test email sent to ${testEmail.trim()}! Check the inbox.` });
    } catch (err) {
      setTestResult({ type: 'error', message: err instanceof Error ? err.message : 'Failed to send test email' });
    }
    setTesting(false);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={32} className="crm-spin" style={{ color: '#0f766e' }} />
          <p style={{ marginTop: '12px', color: 'var(--text-dark)', fontSize: '0.88rem' }}>Loading email settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-light)' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a, #0f766e)',
        padding: '18px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button type="button" onClick={onBack} style={backBtnStyle}>
            <ArrowLeft size={15} /> Back
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--bg-card)' }}>Platform Email Settings</h1>
            <p style={{ margin: 0, fontSize: '0.76rem', color: 'rgba(255,255,255,0.7)' }}>Configure default SMTP for all accounts</p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 20px' }}>
        {error && <Banner type="error" message={error} onClose={() => setError('')} />}
        {success && <Banner type="success" message={success} onClose={() => setSuccess('')} />}

        {/* Info card */}
        <div style={{
          background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border-subtle)',
          padding: '18px 22px', marginBottom: '20px',
          display: 'flex', gap: '14px', alignItems: 'flex-start',
        }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(15,118,110,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Shield size={20} style={{ color: '#0f766e' }} />
          </div>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>How Platform SMTP Works</h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-dark)', lineHeight: 1.5 }}>
              These settings act as a fallback for all CRM accounts. When an account sends an email and hasn't configured its own SMTP, the system uses these credentials. If an account has its own SMTP settings, those take priority.
            </p>
          </div>
        </div>

        {/* SMTP Configuration Form */}
        <div style={{
          background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-subtle)', padding: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(37,99,235,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Server size={18} style={{ color: '#2563eb' }} />
            </div>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>SMTP Server Configuration</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label="SMTP Host" fullWidth>
              <input type="text" value={form.smtp_host} onChange={(e) => setForm({ ...form, smtp_host: e.target.value })} placeholder="smtp.gmail.com" style={inputStyle} />
            </Field>
            <Field label="SMTP Port">
              <input type="number" value={form.smtp_port} onChange={(e) => setForm({ ...form, smtp_port: parseInt(e.target.value) || 587 })} placeholder="587" style={inputStyle} />
            </Field>
            <Field label="Use TLS / SSL">
              <select value={form.use_tls ? 'true' : 'false'} onChange={(e) => setForm({ ...form, use_tls: e.target.value === 'true' })} style={inputStyle}>
                <option value="true">Yes (recommended)</option>
                <option value="false">No</option>
              </select>
            </Field>
            <Field label="SMTP Username">
              <input type="text" value={form.smtp_username} onChange={(e) => setForm({ ...form, smtp_username: e.target.value })} placeholder="your@email.com" style={inputStyle} />
            </Field>
            <Field label="SMTP Password / App Password">
              <div style={{ position: 'relative' }}>
                <input type={showPassword ? 'text' : 'password'} value={form.smtp_password} onChange={(e) => setForm({ ...form, smtp_password: e.target.value })} placeholder="••••••••••" style={{ ...inputStyle, paddingRight: '38px' }} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dark)', padding: '4px' }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>
            <Field label="From Email Address">
              <input type="email" value={form.from_email} onChange={(e) => setForm({ ...form, from_email: e.target.value })} placeholder="noreply@leadcentre.com" style={inputStyle} />
            </Field>
            <Field label="From Name (Display Name)">
              <input type="text" value={form.from_name} onChange={(e) => setForm({ ...form, from_name: e.target.value })} placeholder="LeadCentre CRM" style={inputStyle} />
            </Field>
            <Field label="Status">
              <select value={form.is_active ? 'true' : 'false'} onChange={(e) => setForm({ ...form, is_active: e.target.value === 'true' })} style={inputStyle}>
                <option value="true">Active (use as fallback)</option>
                <option value="false">Disabled (no fallback)</option>
              </select>
            </Field>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '22px' }}>
            <button type="button" onClick={save} disabled={saving} style={primaryBtn}>
              {saving ? <Loader2 size={16} className="crm-spin" /> : <Save size={16} />} {config ? 'Update Settings' : 'Save Settings'}
            </button>
          </div>
        </div>

        {/* Test Email Section */}
        <div style={{
          background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-subtle)', padding: '24px', marginTop: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(234,179,8,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TestTube size={18} style={{ color: '#eab308' }} />
            </div>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Test Configuration</h2>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-dark)', margin: '0 0 14px' }}>
            Send a test email to verify your SMTP settings are working. Make sure you've saved the settings first.
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="test@example.com" style={{ ...inputStyle, flex: '1', minWidth: '240px' }} />
            <button type="button" onClick={sendTestEmail} disabled={testing} style={{ ...primaryBtn, whiteSpace: 'nowrap' }}>
              {testing ? <Loader2 size={16} className="crm-spin" /> : <Send size={16} />} Send Test
            </button>
          </div>
          {testResult && (
            <div style={{
              marginTop: '14px', padding: '12px 16px', borderRadius: '10px', fontSize: '0.84rem',
              display: 'flex', alignItems: 'center', gap: '8px',
              background: testResult.type === 'success' ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${testResult.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
              color: testResult.type === 'success' ? '#16a34a' : '#dc2626',
            }}>
              {testResult.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {testResult.message}
              <button type="button" onClick={() => setTestResult(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6 }}><X size={14} /></button>
            </div>
          )}
        </div>

        {/* Status indicator */}
        <div style={{
          marginTop: '20px', padding: '16px 20px', borderRadius: '14px',
          background: config?.is_active ? 'rgba(22,163,74,0.06)' : 'rgba(148,163,184,0.08)',
          border: `1px solid ${config?.is_active ? 'rgba(22,163,74,0.2)' : 'rgba(148,163,184,0.2)'}`,
          display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <div style={{
            width: '10px', height: '10px', borderRadius: '50%',
            background: config?.is_active ? '#16a34a' : 'var(--text-dark)',
            boxShadow: config?.is_active ? '0 0 8px rgba(22,163,74,0.4)' : 'none',
          }} />
          <span style={{ fontSize: '0.84rem', fontWeight: 600, color: config?.is_active ? '#16a34a' : 'var(--text-dark)' }}>
            {config ? (config.is_active ? 'Platform SMTP is active — serving as fallback for all accounts' : 'Platform SMTP is disabled — accounts must use their own SMTP') : 'No platform SMTP configured yet'}
          </span>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid var(--border-subtle)', borderRadius: '8px',
  fontSize: '0.85rem', outline: 'none', color: 'var(--text-main)',
};

const backBtnStyle: React.CSSProperties = {
  padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.1)', color: 'var(--bg-card)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', fontWeight: 600,
};

const primaryBtn: React.CSSProperties = {
  padding: '10px 18px', borderRadius: '8px', border: 'none', background: '#0f766e',
  color: 'var(--bg-card)', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: '6px',
};

function Field({ label, children, fullWidth }: { label: string; children: React.ReactNode; fullWidth?: boolean }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', gridColumn: fullWidth ? '1 / -1' : undefined }}>
      <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-dark)' }}>{label}</span>
      {children}
    </label>
  );
}

function Banner({ type, message, onClose }: { type: 'error' | 'success'; message: string; onClose: () => void }) {
  const isErr = type === 'error';
  return (
    <div style={{
      padding: '12px 16px', borderRadius: '12px', fontSize: '0.85rem', marginBottom: '16px',
      display: 'flex', alignItems: 'center', gap: '10px',
      background: isErr ? '#fef2f2' : '#f0fdf4', border: `1px solid ${isErr ? '#fecaca' : '#bbf7d0'}`,
      color: isErr ? '#dc2626' : '#16a34a',
    }}>
      {isErr ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />} {message}
      <button type="button" onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6 }}><X size={16} /></button>
    </div>
  );
}
