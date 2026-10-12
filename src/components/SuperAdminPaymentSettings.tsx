import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Loader2, AlertCircle, CheckCircle2, Save, Wallet,
  Shield, Eye, EyeOff, X, IndianRupee,
} from 'lucide-react';

type PaymentConfig = {
  id: string;
  razorpay_key_id: string | null;
  razorpay_key_secret: string | null;
  is_active: boolean;
  currency: string | null;
  created_at: string;
  updated_at: string;
};

export default function SuperAdminPaymentSettings() {
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  const [form, setForm] = useState({
    razorpay_key_id: '',
    razorpay_key_secret: '',
    currency: 'INR',
    is_active: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('platform_payment_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (err) throw err;
      if (data) {
        const cfg = data as PaymentConfig;
        setConfig(cfg);
        setForm({
          razorpay_key_id: cfg.razorpay_key_id || '',
          razorpay_key_secret: cfg.razorpay_key_secret || '',
          currency: cfg.currency || 'INR',
          is_active: cfg.is_active,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payment settings');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(''), 4000); return () => clearTimeout(t); }
  }, [success]);

  const save = async () => {
    if (!form.razorpay_key_id.trim() || !form.razorpay_key_secret.trim()) {
      setError('Razorpay Key ID and Key Secret are both required.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        razorpay_key_id: form.razorpay_key_id.trim(),
        razorpay_key_secret: form.razorpay_key_secret.trim(),
        currency: form.currency,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      };
      if (config) {
        const { error: err } = await supabase.from('platform_payment_settings').update(payload).eq('id', config.id);
        if (err) throw err;
        setSuccess('Payment gateway settings updated successfully.');
      } else {
        const { error: err } = await supabase.from('platform_payment_settings').insert(payload);
        if (err) throw err;
        setSuccess('Payment gateway settings saved successfully.');
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={32} className="crm-spin" style={{ color: '#0f766e' }} />
          <p style={{ marginTop: '12px', color: 'var(--text-dark)', fontSize: '0.88rem' }}>Loading payment settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px' }}>
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
          <h3 style={{ margin: '0 0 4px', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>How Razorpay Payments Work</h3>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-dark)', lineHeight: 1.5 }}>
            These keys power the checkout drawer on your landing page. When a visitor clicks "Start Trial", the system creates a Razorpay order using these credentials, opens the Razorpay checkout widget, and verifies the payment signature server-side. The key secret is never exposed to the frontend — it stays on the server.
          </p>
        </div>
      </div>

      {/* Razorpay Configuration Form */}
      <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-subtle)', padding: '24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(37,99,235,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Wallet size={18} style={{ color: '#2563eb' }} />
          </div>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Razorpay API Credentials</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Field label="Razorpay Key ID" fullWidth>
            <input type="text" value={form.razorpay_key_id} onChange={(e) => setForm({ ...form, razorpay_key_id: e.target.value })} placeholder="rzp_live_XXXXXXXXXX" style={inputStyle} />
          </Field>
          <Field label="Razorpay Key Secret">
            <div style={{ position: 'relative' }}>
              <input type={showSecret ? 'text' : 'password'} value={form.razorpay_key_secret} onChange={(e) => setForm({ ...form, razorpay_key_secret: e.target.value })} placeholder="••••••••••••••••" style={{ ...inputStyle, paddingRight: '38px' }} />
              <button type="button" onClick={() => setShowSecret(!showSecret)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dark)', padding: '4px' }}>
                {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>
          <Field label="Currency">
            <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} style={inputStyle}>
              <option value="INR">INR (Indian Rupee)</option>
              <option value="USD">USD (US Dollar)</option>
              <option value="EUR">EUR (Euro)</option>
              <option value="GBP">GBP (British Pound)</option>
            </select>
          </Field>
          <Field label="Status">
            <select value={form.is_active ? 'true' : 'false'} onChange={(e) => setForm({ ...form, is_active: e.target.value === 'true' })} style={inputStyle}>
              <option value="true">Active (accept payments)</option>
              <option value="false">Disabled (checkout unavailable)</option>
            </select>
          </Field>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '22px' }}>
          <button type="button" onClick={save} disabled={saving} style={primaryBtn}>
            {saving ? <Loader2 size={16} className="crm-spin" /> : <Save size={16} />} {config ? 'Update Settings' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* How to get keys */}
      <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-subtle)', padding: '24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(234,179,8,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IndianRupee size={18} style={{ color: '#eab308' }} />
          </div>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>How to Get Your Razorpay Keys</h2>
        </div>
        <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '0.82rem', color: 'var(--text-dark)', lineHeight: 1.8 }}>
          <li>Log in to your <a href="https://dashboard.razorpay.com" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>Razorpay Dashboard</a>.</li>
          <li>Go to <strong>Settings &rarr; API Keys &rarr; Generate Keys</strong>.</li>
          <li>Copy the <strong>Key ID</strong> and <strong>Key Secret</strong>.</li>
          <li>Paste them above and click <strong>Save Settings</strong>.</li>
          <li>Use test keys (starting with <code>rzp_test_</code>) for testing, and live keys (starting with <code>rzp_live_</code>) for real payments.</li>
        </ol>
      </div>

      {/* Status indicator */}
      <div style={{
        padding: '16px 20px', borderRadius: '14px',
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
          {config ? (config.is_active ? 'Razorpay is active — checkout is live on your landing page' : 'Razorpay is disabled — visitors cannot complete checkout') : 'No Razorpay settings configured yet'}
        </span>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid var(--border-subtle)', borderRadius: '8px',
  fontSize: '0.85rem', outline: 'none', color: 'var(--text-main)',
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
