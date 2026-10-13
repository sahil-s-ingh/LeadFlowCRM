import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Loader2, AlertCircle, CheckCircle2, Save, Wallet, X,
  MessageSquare, TrendingUp, Shield, Zap, Plus, Trash2, IndianRupee, Package as PackageIcon,
} from 'lucide-react';

type Pricing = {
  marketing_rate: number;
  utility_rate: number;
  authentication_rate: number;
  service_rate: number;
  marketing_markup: number;
  utility_markup: number;
  authentication_markup: number;
  service_markup: number;
  currency: string;
  is_active: boolean;
};

type Package = {
  id: string;
  name: string;
  credits: number;
  price: number;
  currency: string;
  is_active: boolean;
  sort_order: number;
};

const currencySymbol = (c: string) => c === 'INR' ? '\u20B9' : c === 'EUR' ? '\u20AC' : c === 'GBP' ? '\u00A3' : '$';

export default function SuperAdminWhatsAppPricing() {
  const [loading, setLoading] = useState(true);
  const [savingPricing, setSavingPricing] = useState(false);
  const [savingPkg, setSavingPkg] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [allPackages, setAllPackages] = useState<Package[]>([]);

  const [form, setForm] = useState<Pricing>({
    marketing_rate: 0, utility_rate: 0, authentication_rate: 0, service_rate: 0,
    marketing_markup: 0, utility_markup: 0, authentication_markup: 0, service_markup: 0,
    currency: 'INR', is_active: false,
  });

  const [newPkg, setNewPkg] = useState({ name: '', credits: 100, price: 100, currency: 'INR', sort_order: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: rpcErr } = await supabase.rpc('get_wa_pricing');
      if (rpcErr) throw rpcErr;
      const result = data as { pricing: Pricing; packages: Package[] };
      if (result.pricing) {
        setPricing(result.pricing);
        setForm(result.pricing);
      }
      // Fetch ALL packages (including inactive) for admin view
      const { data: allPkgs } = await supabase
        .from('wa_credit_packages')
        .select('*')
        .order('sort_order', { ascending: true });
      if (allPkgs) setAllPackages(allPkgs as Package[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pricing data');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(''), 4000); return () => clearTimeout(t); }
  }, [success]);

  const savePricing = async () => {
    setSavingPricing(true);
    setError(''); setSuccess('');
    try {
      const { error: rpcErr } = await supabase.rpc('admin_set_wa_pricing', {
        p_marketing_rate: form.marketing_rate,
        p_utility_rate: form.utility_rate,
        p_authentication_rate: form.authentication_rate,
        p_service_rate: form.service_rate,
        p_marketing_markup: form.marketing_markup,
        p_utility_markup: form.utility_markup,
        p_authentication_markup: form.authentication_markup,
        p_service_markup: form.service_markup,
        p_currency: form.currency,
        p_is_active: form.is_active,
      });
      if (rpcErr) throw rpcErr;
      setSuccess('WhatsApp pricing updated successfully.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save pricing');
    }
    setSavingPricing(false);
  };

  const addPackage = async () => {
    if (!newPkg.name.trim() || newPkg.credits <= 0 || newPkg.price < 0) {
      setError('Package name, credits (>0), and price (>=0) are required.');
      return;
    }
    setSavingPkg(true);
    setError(''); setSuccess('');
    try {
      const { error: rpcErr } = await supabase.rpc('admin_set_wa_package', {
        p_name: newPkg.name.trim(),
        p_credits: newPkg.credits,
        p_price: newPkg.price,
        p_currency: newPkg.currency,
        p_is_active: true,
        p_sort_order: newPkg.sort_order,
      });
      if (rpcErr) throw rpcErr;
      setSuccess('Credit package added.');
      setNewPkg({ name: '', credits: 100, price: 100, currency: 'INR', sort_order: 0 });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add package');
    }
    setSavingPkg(false);
  };

  const togglePackage = async (pkg: Package) => {
    try {
      const { error: rpcErr } = await supabase.rpc('admin_set_wa_package', {
        p_package_id: pkg.id,
        p_is_active: !pkg.is_active,
      });
      if (rpcErr) throw rpcErr;
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update package');
    }
  };

  const deletePackage = async (pkgId: string) => {
    if (!confirm('Delete this credit package? This cannot be undone.')) return;
    try {
      const { error: rpcErr } = await supabase.rpc('admin_delete_wa_package', { p_package_id: pkgId });
      if (rpcErr) throw rpcErr;
      setSuccess('Package deleted.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete package');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
        <Loader2 size={32} className="crm-spin" style={{ color: '#0f766e' }} />
      </div>
    );
  }

  const sym = currencySymbol(form.currency);

  const categories = [
    { key: 'marketing', label: 'Marketing', icon: <TrendingUp size={16} />, color: '#d97706', desc: 'Promotional messages and offers' },
    { key: 'utility', label: 'Utility', icon: <Zap size={16} />, color: '#2563eb', desc: 'Account updates and confirmations' },
    { key: 'authentication', label: 'Authentication', icon: <Shield size={16} />, color: '#7c3aed', desc: 'OTP and verification codes' },
    { key: 'service', label: 'Service', icon: <MessageSquare size={16} />, color: '#0891b2', desc: 'Customer-initiated conversations' },
  ] as const;

  return (
    <div style={{ maxWidth: '860px' }}>
      {error && <Banner type="error" message={error} onClose={() => setError('')} />}
      {success && <Banner type="success" message={success} onClose={() => setSuccess('')} />}

      {/* Info card */}
      <div style={{ ...cardStyle, marginBottom: '20px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(15,118,110,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Wallet size={20} style={{ color: '#0f766e' }} />
        </div>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>WhatsApp Credit System</h3>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-dark)', lineHeight: 1.5 }}>
            Set per-message pricing for each WhatsApp conversation category. Customers buy prepaid credits from the CRM admin area using Razorpay checkout. When the credit system is active, broadcasts are blocked if the customer runs out of credits. Turn it off to allow free broadcasts.
          </p>
        </div>
      </div>

      {/* Pricing form */}
      <div style={{ ...cardStyle, marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
          <IndianRupee size={18} style={{ color: '#2563eb' }} />
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Message Pricing Configuration</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <Field label="Currency">
            <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} style={inputStyle}>
              <option value="INR">INR (Indian Rupee)</option>
              <option value="USD">USD (US Dollar)</option>
              <option value="EUR">EUR (Euro)</option>
              <option value="GBP">GBP (British Pound)</option>
            </select>
          </Field>
          <Field label="Credit System Status">
            <select value={form.is_active ? 'true' : 'false'} onChange={(e) => setForm({ ...form, is_active: e.target.value === 'true' })} style={inputStyle}>
              <option value="true">Active (credits required for broadcasts)</option>
              <option value="false">Disabled (broadcasts are free)</option>
            </select>
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
          {categories.map((cat) => (
            <div key={cat.key} style={{ background: 'var(--bg-light)', borderRadius: '12px', padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: `${cat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cat.color }}>{cat.icon}</div>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>{cat.label}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-dark)' }}>{cat.desc}</div>
                </div>
              </div>
              <Field label="Meta rate (per msg)">
                <input type="number" step="0.01" min="0" value={form[`${cat.key}_rate` as keyof Pricing] as number} onChange={(e) => setForm({ ...form, [`${cat.key}_rate`]: parseFloat(e.target.value) || 0 })} style={inputStyle} placeholder="0.00" />
              </Field>
              <div style={{ height: '8px' }} />
              <Field label="Platform markup (per msg)">
                <input type="number" step="0.01" min="0" value={form[`${cat.key}_markup` as keyof Pricing] as number} onChange={(e) => setForm({ ...form, [`${cat.key}_markup`]: parseFloat(e.target.value) || 0 })} style={inputStyle} placeholder="0.00" />
              </Field>
              <div style={{ marginTop: '8px', padding: '6px 10px', borderRadius: '7px', background: 'var(--bg-card)', fontSize: '0.76rem', fontWeight: 700, color: cat.color, display: 'flex', justifyContent: 'space-between' }}>
                <span>Total / msg</span>
                <span>{sym}{((form[`${cat.key}_rate` as keyof Pricing] as number) + (form[`${cat.key}_markup` as keyof Pricing] as number)).toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button type="button" onClick={savePricing} disabled={savingPricing} style={primaryBtn}>
            {savingPricing ? <Loader2 size={16} className="crm-spin" /> : <Save size={16} />} {pricing ? 'Update Pricing' : 'Save Pricing'}
          </button>
        </div>
      </div>

      {/* Add package */}
      <div style={{ ...cardStyle, marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <PackageIcon size={18} style={{ color: '#d97706' }} />
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Credit Packages</h2>
        </div>

        {/* New package form */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '10px', alignItems: 'flex-end', marginBottom: '16px', padding: '14px', background: 'var(--bg-light)', borderRadius: '12px' }}>
          <Field label="Package name">
            <input type="text" value={newPkg.name} onChange={(e) => setNewPkg({ ...newPkg, name: e.target.value })} placeholder="e.g. Starter Pack" style={inputStyle} />
          </Field>
          <Field label="Credits">
            <input type="number" min="1" value={newPkg.credits} onChange={(e) => setNewPkg({ ...newPkg, credits: parseInt(e.target.value) || 0 })} style={inputStyle} />
          </Field>
          <Field label={`Price (${sym})`}>
            <input type="number" min="0" step="0.01" value={newPkg.price} onChange={(e) => setNewPkg({ ...newPkg, price: parseFloat(e.target.value) || 0 })} style={inputStyle} />
          </Field>
          <Field label="Sort order">
            <input type="number" min="0" value={newPkg.sort_order} onChange={(e) => setNewPkg({ ...newPkg, sort_order: parseInt(e.target.value) || 0 })} style={inputStyle} />
          </Field>
          <button type="button" onClick={addPackage} disabled={savingPkg} style={{ ...primaryBtn, height: '38px' }}>
            {savingPkg ? <Loader2 size={15} className="crm-spin" /> : <Plus size={15} />} Add
          </button>
        </div>

        {/* Package list */}
        {allPackages.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-dark)', textAlign: 'center', padding: '20px 0' }}>No packages yet. Add one above.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {allPackages.map((pkg) => (
              <div key={pkg.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', border: '1px solid var(--border-subtle)', borderRadius: '10px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>{pkg.name}</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-dark)', marginTop: '2px' }}>
                    {pkg.credits.toLocaleString()} credits &middot; {currencySymbol(pkg.currency)}{Number(pkg.price).toFixed(0)} &middot; {currencySymbol(pkg.currency)}{(pkg.credits > 0 ? pkg.price / pkg.credits : 0).toFixed(2)}/msg
                  </div>
                </div>
                <button type="button" onClick={() => togglePackage(pkg)} style={{
                  padding: '5px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                  fontSize: '0.72rem', fontWeight: 700,
                  background: pkg.is_active ? 'rgba(22,163,74,0.1)' : 'rgba(148,163,184,0.1)',
                  color: pkg.is_active ? '#16a34a' : '#94a3b8',
                }}>
                  {pkg.is_active ? 'Active' : 'Inactive'}
                </button>
                <button type="button" onClick={() => deletePackage(pkg.id)} style={{
                  width: '32px', height: '32px', borderRadius: '7px', border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-card)', color: '#ef4444', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-subtle)', padding: '22px 24px',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid var(--border-subtle)', borderRadius: '8px',
  fontSize: '0.84rem', outline: 'none', color: 'var(--text-main)',
};

const primaryBtn: React.CSSProperties = {
  padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#0f766e',
  color: '#fff', fontSize: '0.84rem', fontWeight: 700, cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: '6px',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-dark)' }}>{label}</span>
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
