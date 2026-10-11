import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, Edit3, Save, X, GripVertical, Star, Loader2, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';

export type Plan = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  monthly_price: number;
  annual_price: number;
  currency: string;
  lead_limit: number;
  team_seats: number;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  features: string[];
  cta_label: string;
  created_at: string;
  updated_at: string;
};

const emptyForm = {
  name: '',
  slug: '',
  description: '',
  monthly_price: 0,
  annual_price: 0,
  currency: 'USD',
  lead_limit: 100,
  team_seats: 1,
  is_active: true,
  is_featured: false,
  sort_order: 0,
  features: [] as string[],
  cta_label: 'Get Started',
};

export default function SuperAdminPlans({ onBack }: { onBack: () => void }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [featureInput, setFeatureInput] = useState('');
  const [saving, setSaving] = useState(false);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('sort_order', { ascending: true });
    if (err) {
      setError(err.message);
    } else {
      setPlans((data || []) as Plan[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadPlans(); }, [loadPlans]);
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(''), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  const startEdit = (plan: Plan) => {
    setEditingId(plan.id);
    setShowForm(true);
    setForm({
      name: plan.name,
      slug: plan.slug,
      description: plan.description || '',
      monthly_price: plan.monthly_price,
      annual_price: plan.annual_price,
      currency: plan.currency,
      lead_limit: plan.lead_limit,
      team_seats: plan.team_seats,
      is_active: plan.is_active,
      is_featured: plan.is_featured,
      sort_order: plan.sort_order,
      features: plan.features || [],
      cta_label: plan.cta_label,
    });
  };

  const startCreate = () => {
    setEditingId(null);
    setShowForm(true);
    setForm({ ...emptyForm, sort_order: plans.length });
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setFeatureInput('');
  };

  const addFeature = () => {
    const f = featureInput.trim();
    if (!f) return;
    setForm((prev) => ({ ...prev, features: [...prev.features, f] }));
    setFeatureInput('');
  };

  const removeFeature = (idx: number) => {
    setForm((prev) => ({ ...prev, features: prev.features.filter((_, i) => i !== idx) }));
  };

  const save = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      setError('Plan name and slug are required.');
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      ...form,
      features: form.features,
    };
    try {
      if (editingId) {
        const { error: err } = await supabase
          .from('subscription_plans')
          .update(payload)
          .eq('id', editingId);
        if (err) throw err;
        setSuccess('Plan updated successfully.');
      } else {
        const { error: err } = await supabase
          .from('subscription_plans')
          .insert(payload);
        if (err) throw err;
        setSuccess('Plan created successfully.');
      }
      cancelForm();
      await loadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save plan');
    }
    setSaving(false);
  };

  const deletePlan = async (id: string) => {
    if (!confirm('Delete this plan? Existing subscriptions on this plan will keep their data but become unlinked.')) return;
    const { error: err } = await supabase.from('subscription_plans').delete().eq('id', id);
    if (err) { setError(err.message); return; }
    setSuccess('Plan deleted.');
    await loadPlans();
  };

  const toggleFeatured = async (plan: Plan) => {
    const { error: err } = await supabase
      .from('subscription_plans')
      .update({ is_featured: !plan.is_featured })
      .eq('id', plan.id);
    if (err) { setError(err.message); return; }
    await loadPlans();
  };

  const toggleActive = async (plan: Plan) => {
    const { error: err } = await supabase
      .from('subscription_plans')
      .update({ is_active: !plan.is_active })
      .eq('id', plan.id);
    if (err) { setError(err.message); return; }
    await loadPlans();
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-light)' }}>
      <div style={{ background: 'linear-gradient(135deg, #0f172a, #0f766e)', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button type="button" onClick={onBack} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: 'var(--bg-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', fontWeight: 600 }}>
            <ArrowLeft size={15} /> Back
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--bg-card)' }}>Plans & Pricing</h1>
            <p style={{ margin: 0, fontSize: '0.76rem', color: 'rgba(255,255,255,0.7)' }}>Manage subscription plans and pricing</p>
          </div>
        </div>
        <button type="button" onClick={startCreate} disabled={showForm} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--bg-card)', color: '#0f766e', fontSize: '0.82rem', fontWeight: 700, cursor: showForm ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={16} /> New Plan
        </button>
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 20px' }}>
        {error && <Banner type="error" message={error} onClose={() => setError('')} />}
        {success && <Banner type="success" message={success} onClose={() => setSuccess('')} />}

        {showForm && (
          <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-subtle)', padding: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>{editingId ? 'Edit Plan' : 'Create New Plan'}</h2>
              <button type="button" onClick={cancelForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dark)' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <Field label="Plan Name">
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Pro" style={inputStyle} />
              </Field>
              <Field label="Slug (URL key)">
                <input type="text" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} placeholder="pro" style={inputStyle} />
              </Field>
              <Field label="Currency">
                <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} style={inputStyle}>
                  <option value="USD">USD ($)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </Field>
              <Field label="Monthly Price">
                <input type="number" min="0" step="any" value={form.monthly_price} onChange={(e) => setForm({ ...form, monthly_price: parseFloat(e.target.value) || 0 })} style={inputStyle} />
              </Field>
              <Field label="Annual Price">
                <input type="number" min="0" step="any" value={form.annual_price} onChange={(e) => setForm({ ...form, annual_price: parseFloat(e.target.value) || 0 })} style={inputStyle} />
              </Field>
              <Field label="Lead Limit">
                <input type="number" min="1" value={form.lead_limit} onChange={(e) => setForm({ ...form, lead_limit: parseInt(e.target.value) || 0 })} style={inputStyle} />
              </Field>
              <Field label="Team Seats">
                <input type="number" min="1" value={form.team_seats} onChange={(e) => setForm({ ...form, team_seats: parseInt(e.target.value) || 1 })} style={inputStyle} />
              </Field>
              <Field label="CTA Button Label">
                <input type="text" value={form.cta_label} onChange={(e) => setForm({ ...form, cta_label: e.target.value })} style={inputStyle} />
              </Field>
              <Field label="Sort Order">
                <input type="number" min="0" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} style={inputStyle} />
              </Field>
            </div>

            <Field label="Description" style={{ marginTop: '14px' }}>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Short description shown on the pricing card" style={{ ...inputStyle, resize: 'vertical' }} />
            </Field>

            <Field label="Features (one per line or add individually)" style={{ marginTop: '14px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input type="text" value={featureInput} onChange={(e) => setFeatureInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFeature(); } }} placeholder="Add a feature..." style={inputStyle} />
                <button type="button" onClick={addFeature} style={{ padding: '0 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-light)', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', color: '#0f766e', whiteSpace: 'nowrap' }}>
                  <Plus size={14} style={{ display: 'inline', marginRight: '4px' }} /> Add
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {form.features.map((f, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '8px', background: 'rgba(15,118,110,0.06)', border: '1px solid rgba(15,118,110,0.15)', fontSize: '0.78rem', color: '#0f766e', fontWeight: 600 }}>
                    {f}
                    <button type="button" onClick={() => removeFeature(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dark)', padding: 0 }}><X size={13} /></button>
                  </span>
                ))}
              </div>
            </Field>

            <div style={{ display: 'flex', gap: '14px', marginTop: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} /> Featured (highlighted)
              </label>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button type="button" onClick={save} disabled={saving} style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#0f766e', color: 'var(--bg-card)', fontSize: '0.85rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {saving ? <Loader2 size={16} className="crm-spin" /> : <Save size={16} />} {editingId ? 'Update Plan' : 'Create Plan'}
              </button>
              <button type="button" onClick={cancelForm} style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-dark)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <Loader2 size={28} className="crm-spin" style={{ color: '#0f766e' }} />
          </div>
        ) : plans.length === 0 ? (
          <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-subtle)', padding: '48px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-dark)', fontSize: '0.88rem' }}>No plans yet. Click "New Plan" to create one.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '18px' }}>
            {plans.map((plan) => (
              <div key={plan.id} style={{ background: 'var(--bg-card)', borderRadius: '16px', border: plan.is_featured ? '2px solid #0f766e' : '1px solid var(--border-subtle)', padding: '22px', position: 'relative', transition: 'box-shadow 0.2s', boxShadow: plan.is_featured ? '0 8px 30px -10px rgba(15,118,110,0.25)' : 'none' }}>
                {plan.is_featured && (
                  <div style={{ position: 'absolute', top: '-10px', right: '20px', padding: '3px 12px', borderRadius: '9999px', background: '#0f766e', color: 'var(--bg-card)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Star size={11} fill="currentColor" /> Featured
                  </div>
                )}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>{plan.name}</h3>
                    <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 700, background: plan.is_active ? 'rgba(22,163,74,0.1)' : 'rgba(148,163,184,0.15)', color: plan.is_active ? '#16a34a' : 'var(--text-dark)' }}>
                      {plan.is_active ? 'Active' : 'Hidden'}
                    </span>
                  </div>
                  {plan.description && <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-dark)' }}>{plan.description}</p>}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '14px' }}>
                  <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {plan.currency === 'INR' ? '₹' : plan.currency === 'EUR' ? '€' : plan.currency === 'GBP' ? '£' : '$'}{plan.monthly_price}
                  </span>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-dark)' }}>/mo</span>
                  {plan.annual_price > 0 && (
                    <span style={{ fontSize: '0.76rem', color: '#0f766e', fontWeight: 600, marginLeft: '6px' }}>
                      · {plan.currency === 'INR' ? '₹' : '$'}{plan.annual_price}/yr
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  <span><strong style={{ color: 'var(--text-main)' }}>{plan.lead_limit.toLocaleString()}</strong> leads</span>
                  <span><strong style={{ color: 'var(--text-main)' }}>{plan.team_seats}</strong> seats</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {plan.features.slice(0, 5).map((f, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      <CheckCircle2 size={14} style={{ color: '#0f766e', flexShrink: 0, marginTop: 2 }} /> {f}
                    </li>
                  ))}
                  {plan.features.length > 5 && <li style={{ fontSize: '0.76rem', color: 'var(--text-dark)', paddingLeft: '20px' }}>+{plan.features.length - 5} more</li>}
                </ul>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => startEdit(plan)} style={btnIconStyle}><Edit3 size={14} /> Edit</button>
                  <button type="button" onClick={() => toggleFeatured(plan)} style={btnIconStyle}><Star size={14} /> {plan.is_featured ? 'Unfeature' : 'Feature'}</button>
                  <button type="button" onClick={() => toggleActive(plan)} style={btnIconStyle}>{plan.is_active ? 'Hide' : 'Show'}</button>
                  <button type="button" onClick={() => deletePlan(plan.id)} style={{ ...btnIconStyle, color: '#dc2626', borderColor: 'rgba(239,68,68,0.2)' }}><Trash2 size={14} /> Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid var(--border-subtle)',
  borderRadius: '8px',
  fontSize: '0.85rem',
  outline: 'none',
};

const btnIconStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  padding: '6px 10px',
  borderRadius: '7px',
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-card)',
  color: 'var(--text-muted)',
  fontSize: '0.75rem',
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'all 0.15s',
};

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', ...style }}>
      <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-dark)' }}>{label}</span>
      {children}
    </label>
  );
}

function Banner({ type, message, onClose }: { type: 'error' | 'success'; message: string; onClose: () => void }) {
  const isErr = type === 'error';
  return (
    <div style={{ padding: '12px 16px', borderRadius: '12px', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', background: isErr ? '#fef2f2' : '#f0fdf4', border: `1px solid ${isErr ? '#fecaca' : '#bbf7d0'}`, color: isErr ? '#dc2626' : '#16a34a' }}>
      {isErr ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />} {message}
      <button type="button" onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6 }}><X size={16} /></button>
    </div>
  );
}
