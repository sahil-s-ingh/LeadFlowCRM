import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Loader2, AlertCircle, CheckCircle2, Save, Wallet,
  Shield, Eye, EyeOff, X, IndianRupee, Smartphone,
} from 'lucide-react';

type PaymentConfig = {
  id: string;
  active_gateway: string | null;
  razorpay_key_id: string | null;
  razorpay_key_secret: string | null;
  phonepe_merchant_id: string | null;
  phonepe_salt_key: string | null;
  phonepe_salt_index: string | null;
  phonepe_environment: string | null;
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
  const [showRazorpaySecret, setShowRazorpaySecret] = useState(false);
  const [showPhonePeSalt, setShowPhonePeSalt] = useState(false);

  const [form, setForm] = useState({
    active_gateway: 'razorpay',
    razorpay_key_id: '',
    razorpay_key_secret: '',
    phonepe_merchant_id: '',
    phonepe_salt_key: '',
    phonepe_salt_index: '1',
    phonepe_environment: 'production',
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
          active_gateway: cfg.active_gateway || 'razorpay',
          razorpay_key_id: cfg.razorpay_key_id || '',
          razorpay_key_secret: cfg.razorpay_key_secret || '',
          phonepe_merchant_id: cfg.phonepe_merchant_id || '',
          phonepe_salt_key: cfg.phonepe_salt_key || '',
          phonepe_salt_index: cfg.phonepe_salt_index || '1',
          phonepe_environment: cfg.phonepe_environment || 'production',
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
    if (form.active_gateway === 'razorpay' && (!form.razorpay_key_id.trim() || !form.razorpay_key_secret.trim())) {
      setError('Razorpay Key ID and Key Secret are both required when Razorpay is the active gateway.');
      return;
    }
    if (form.active_gateway === 'phonepe' && (!form.phonepe_merchant_id.trim() || !form.phonepe_salt_key.trim())) {
      setError('PhonePe Merchant ID and Salt Key are both required when PhonePe is the active gateway.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        active_gateway: form.active_gateway,
        razorpay_key_id: form.razorpay_key_id.trim() || null,
        razorpay_key_secret: form.razorpay_key_secret.trim() || null,
        phonepe_merchant_id: form.phonepe_merchant_id.trim() || null,
        phonepe_salt_key: form.phonepe_salt_key.trim() || null,
        phonepe_salt_index: form.phonepe_salt_index || '1',
        phonepe_environment: form.phonepe_environment,
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

  const activeGateway = form.active_gateway;

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
          <h3 style={{ margin: '0 0 4px', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>How Multi-Gateway Payments Work</h3>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-dark)', lineHeight: 1.5 }}>
            Choose which payment gateway to use for your checkout. Razorpay opens a popup widget on your landing page. PhonePe redirects the visitor to PhonePe's checkout page (UPI, cards, wallets) and brings them back after payment. Both gateways verify payments server-side. You can keep credentials for both and switch anytime.
          </p>
        </div>
      </div>

      {/* Gateway selector */}
      <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-subtle)', padding: '24px', marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Active Payment Gateway</h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <GatewayOption
            id="razorpay"
            label="Razorpay"
            description="Popup checkout widget on your page"
            isActive={activeGateway === 'razorpay'}
            onClick={() => setForm({ ...form, active_gateway: 'razorpay' })}
            icon={<Wallet size={18} />}
          />
          <GatewayOption
            id="phonepe"
            label="PhonePe"
            description="Redirect to PhonePe UPI checkout page"
            isActive={activeGateway === 'phonepe'}
            onClick={() => setForm({ ...form, active_gateway: 'phonepe' })}
            icon={<Smartphone size={18} />}
          />
        </div>
      </div>

      {/* Razorpay Configuration Form */}
      <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: `1px solid ${activeGateway === 'razorpay' ? 'rgba(37,99,235,0.3)' : 'var(--border-subtle)'}`, padding: '24px', marginBottom: '20px', opacity: activeGateway === 'razorpay' ? 1 : 0.5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(37,99,235,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Wallet size={18} style={{ color: '#2563eb' }} />
          </div>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Razorpay API Credentials</h2>
          {activeGateway === 'razorpay' && (
            <span style={{ fontSize: '0.66rem', fontWeight: 800, padding: '2px 8px', borderRadius: '999px', background: 'rgba(37,99,235,0.1)', color: '#2563eb' }}>ACTIVE</span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Field label="Razorpay Key ID" fullWidth>
            <input type="text" value={form.razorpay_key_id} onChange={(e) => setForm({ ...form, razorpay_key_id: e.target.value })} placeholder="rzp_live_XXXXXXXXXX" style={inputStyle} />
          </Field>
          <Field label="Razorpay Key Secret">
            <div style={{ position: 'relative' }}>
              <input type={showRazorpaySecret ? 'text' : 'password'} value={form.razorpay_key_secret} onChange={(e) => setForm({ ...form, razorpay_key_secret: e.target.value })} placeholder="••••••••••••••••" style={{ ...inputStyle, paddingRight: '38px' }} />
              <button type="button" onClick={() => setShowRazorpaySecret(!showRazorpaySecret)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dark)', padding: '4px' }}>
                {showRazorpaySecret ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>
        </div>
      </div>

      {/* PhonePe Configuration Form */}
      <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: `1px solid ${activeGateway === 'phonepe' ? 'rgba(15,118,110,0.3)' : 'var(--border-subtle)'}`, padding: '24px', marginBottom: '20px', opacity: activeGateway === 'phonepe' ? 1 : 0.5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(15,118,110,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Smartphone size={18} style={{ color: '#0f766e' }} />
          </div>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>PhonePe API Credentials</h2>
          {activeGateway === 'phonepe' && (
            <span style={{ fontSize: '0.66rem', fontWeight: 800, padding: '2px 8px', borderRadius: '999px', background: 'rgba(15,118,110,0.1)', color: '#0f766e' }}>ACTIVE</span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Field label="PhonePe Merchant ID">
            <input type="text" value={form.phonepe_merchant_id} onChange={(e) => setForm({ ...form, phonepe_merchant_id: e.target.value })} placeholder="MERCHANT123" style={inputStyle} />
          </Field>
          <Field label="PhonePe Salt Key">
            <div style={{ position: 'relative' }}>
              <input type={showPhonePeSalt ? 'text' : 'password'} value={form.phonepe_salt_key} onChange={(e) => setForm({ ...form, phonepe_salt_key: e.target.value })} placeholder="••••••••••••••••" style={{ ...inputStyle, paddingRight: '38px' }} />
              <button type="button" onClick={() => setShowPhonePeSalt(!showPhonePeSalt)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dark)', padding: '4px' }}>
                {showPhonePeSalt ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>
          <Field label="Salt Index">
            <input type="text" value={form.phonepe_salt_index} onChange={(e) => setForm({ ...form, phonepe_salt_index: e.target.value })} placeholder="1" style={inputStyle} />
          </Field>
          <Field label="Environment">
            <select value={form.phonepe_environment} onChange={(e) => setForm({ ...form, phonepe_environment: e.target.value })} style={inputStyle}>
              <option value="production">Production (live payments)</option>
              <option value="sandbox">Sandbox (test payments)</option>
            </select>
          </Field>
        </div>
      </div>

      {/* Common settings */}
      <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-subtle)', padding: '24px', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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

      {/* How to get keys — Razorpay */}
      <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-subtle)', padding: '24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(234,179,8,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IndianRupee size={18} style={{ color: '#eab308' }} />
          </div>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>How to Get Your API Keys</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <h4 style={{ margin: '0 0 8px', fontSize: '0.82rem', fontWeight: 700, color: '#2563eb' }}>Razorpay</h4>
            <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '0.78rem', color: 'var(--text-dark)', lineHeight: 1.8 }}>
              <li>Log in to your <a href="https://dashboard.razorpay.com" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>Razorpay Dashboard</a>.</li>
              <li>Go to <strong>Settings &rarr; API Keys &rarr; Generate Keys</strong>.</li>
              <li>Copy the <strong>Key ID</strong> and <strong>Key Secret</strong>.</li>
              <li>Paste them above and select Razorpay as the active gateway.</li>
            </ol>
          </div>
          <div>
            <h4 style={{ margin: '0 0 8px', fontSize: '0.82rem', fontWeight: 700, color: '#0f766e' }}>PhonePe</h4>
            <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '0.78rem', color: 'var(--text-dark)', lineHeight: 1.8 }}>
              <li>Log in to your <a href="https://business.phonepe.com" target="_blank" rel="noopener noreferrer" style={{ color: '#0f766e', textDecoration: 'none' }}>PhonePe Business Dashboard</a>.</li>
              <li>Go to <strong>Developers &rarr; API Keys</strong> and generate a new key.</li>
              <li>Copy the <strong>Merchant ID</strong>, <strong>Salt Key</strong>, and note the <strong>Salt Index</strong>.</li>
              <li>Paste them above and select PhonePe as the active gateway.</li>
              <li>Use <strong>Sandbox</strong> environment for testing, then switch to <strong>Production</strong>.</li>
            </ol>
          </div>
        </div>
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
          {config ? (
            config.is_active
              ? `${config.active_gateway === 'phonepe' ? 'PhonePe' : 'Razorpay'} is active — checkout is live on your landing page`
              : 'Payments are disabled — visitors cannot complete checkout'
          ) : 'No payment settings configured yet'}
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

function GatewayOption({ label, description, isActive, onClick, icon }: { id: string; label: string; description: string; isActive: boolean; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1, padding: '16px', borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
        border: isActive ? '2px solid #0f766e' : '1px solid var(--border-subtle)',
        background: isActive ? 'rgba(15,118,110,0.04)' : 'transparent',
        transition: 'all 0.2s ease',
        display: 'flex', gap: '12px', alignItems: 'flex-start',
      }}
    >
      <div style={{
        width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
        background: isActive ? 'rgba(15,118,110,0.1)' : 'rgba(148,163,184,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: isActive ? '#0f766e' : 'var(--text-dark)',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '2px' }}>{label}</div>
        <div style={{ fontSize: '0.74rem', color: 'var(--text-dark)' }}>{description}</div>
      </div>
    </button>
  );
}

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
