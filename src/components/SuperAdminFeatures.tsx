import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, Edit3, Save, X, Loader2, AlertCircle, CheckCircle2, ArrowLeft, ToggleLeft, ToggleRight } from 'lucide-react';

export type Toggle = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  category: string;
  is_enabled: boolean;
  is_public: boolean;
  sort_order: number;
  updated_at: string;
};

const CATEGORIES = ['general', 'communication', 'automation', 'analytics', 'integrations', 'leads', 'team'];

const emptyForm = {
  key: '',
  label: '',
  description: '',
  category: 'general',
  is_enabled: true,
  is_public: true,
  sort_order: 0,
};

export default function SuperAdminFeatures({ onBack }: { onBack: () => void }) {
  const [toggles, setToggles] = useState<Toggle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('feature_toggles')
      .select('*')
      .order('sort_order', { ascending: true });
    if (err) { setError(err.message); }
    else { setToggles((data || []) as Toggle[]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(''), 3000); return () => clearTimeout(t); }
  }, [success]);

  const startEdit = (t: Toggle) => {
    setEditingId(t.id);
    setShowForm(true);
    setForm({ key: t.key, label: t.label, description: t.description || '', category: t.category, is_enabled: t.is_enabled, is_public: t.is_public, sort_order: t.sort_order });
  };

  const startCreate = () => {
    setEditingId(null);
    setShowForm(true);
    setForm({ ...emptyForm, sort_order: toggles.length });
  };

  const cancelForm = () => { setShowForm(false); setEditingId(null); setForm(emptyForm); };

  const save = async () => {
    if (!form.key.trim() || !form.label.trim()) { setError('Key and label are required.'); return; }
    setSaving(true);
    setError('');
    const payload = { ...form, key: form.key.toLowerCase().replace(/[^a-z0-9_]/g, '_') };
    try {
      if (editingId) {
        const { error: err } = await supabase.from('feature_toggles').update(payload).eq('id', editingId);
        if (err) throw err;
        setSuccess('Feature toggle updated.');
      } else {
        const { error: err } = await supabase.from('feature_toggles').insert(payload);
        if (err) throw err;
        setSuccess('Feature toggle created.');
      }
      cancelForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
    setSaving(false);
  };

  const quickToggle = async (t: Toggle) => {
    const { error: err } = await supabase.from('feature_toggles').update({ is_enabled: !t.is_enabled }).eq('id', t.id);
    if (err) { setError(err.message); return; }
    await load();
  };

  const del = async (id: string) => {
    if (!confirm('Delete this feature toggle?')) return;
    const { error: err } = await supabase.from('feature_toggles').delete().eq('id', id);
    if (err) { setError(err.message); return; }
    setSuccess('Toggle deleted.');
    await load();
  };

  const grouped = toggles
    .filter((t) => filterCat === 'all' || t.category === filterCat)
    .reduce((acc, t) => { (acc[t.category] = acc[t.category] || []).push(t); return acc; }, {} as Record<string, Toggle[]>);

  const categoryLabel = (cat: string) => cat.charAt(0).toUpperCase() + cat.slice(1);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-light)' }}>
      <div style={{ background: 'linear-gradient(135deg, #0f172a, #0f766e)', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button type="button" onClick={onBack} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: 'var(--bg-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', fontWeight: 600 }}>
            <ArrowLeft size={15} /> Back
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--bg-card)' }}>Feature Toggles</h1>
            <p style={{ margin: 0, fontSize: '0.76rem', color: 'rgba(255,255,255,0.7)' }}>Enable or disable platform features</p>
          </div>
        </div>
        <button type="button" onClick={startCreate} disabled={showForm} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--bg-card)', color: '#0f766e', fontSize: '0.82rem', fontWeight: 700, cursor: showForm ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={16} /> New Toggle
        </button>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px 20px' }}>
        {error && <Banner type="error" message={error} onClose={() => setError('')} />}
        {success && <Banner type="success" message={success} onClose={() => setSuccess('')} />}

        {showForm && (
          <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-subtle)', padding: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>{editingId ? 'Edit Toggle' : 'Create Toggle'}</h2>
              <button type="button" onClick={cancelForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dark)' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              <Field label="Label">
                <input type="text" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. WhatsApp Calling" style={inputStyle} />
              </Field>
              <Field label="Key (unique identifier)">
                <input type="text" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="whatsapp_calling" style={inputStyle} />
              </Field>
              <Field label="Category">
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={inputStyle}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
                </select>
              </Field>
              <Field label="Sort Order">
                <input type="number" min="0" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} style={inputStyle} />
              </Field>
            </div>
            <Field label="Description" style={{ marginTop: '14px' }}>
              <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short description of what this feature does" style={inputStyle} />
            </Field>
            <div style={{ display: 'flex', gap: '14px', marginTop: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_enabled} onChange={(e) => setForm({ ...form, is_enabled: e.target.checked })} /> Enabled
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_public} onChange={(e) => setForm({ ...form, is_public: e.target.checked })} /> Visible publicly
              </label>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button type="button" onClick={save} disabled={saving} style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#0f766e', color: 'var(--bg-card)', fontSize: '0.85rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {saving ? <Loader2 size={16} className="crm-spin" /> : <Save size={16} />} {editingId ? 'Update' : 'Create'}
              </button>
              <button type="button" onClick={cancelForm} style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-dark)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Category filter */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '18px', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setFilterCat('all')} style={filterBtn(filterCat === 'all')}>All</button>
          {CATEGORIES.map((c) => (
            <button key={c} type="button" onClick={() => setFilterCat(c)} style={filterBtn(filterCat === c)}>{categoryLabel(c)}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <Loader2 size={28} className="crm-spin" style={{ color: '#0f766e' }} />
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-subtle)', padding: '48px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-dark)', fontSize: '0.88rem' }}>No feature toggles yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cat, items]) => (
              <div key={cat}>
                <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>{categoryLabel(cat)} <span style={{ color: 'var(--text-dark)', fontWeight: 500 }}>({items.length})</span></h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px' }}>
                  {items.map((t) => (
                    <div key={t.id} style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>{t.label}</strong>
                          {t.description && <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: 'var(--text-dark)' }}>{t.description}</p>}
                        </div>
                        <button type="button" onClick={() => quickToggle(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: t.is_enabled ? '#16a34a' : 'var(--text-dark)' }} title={t.is_enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}>
                          {t.is_enabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: t.is_enabled ? 'rgba(22,163,74,0.1)' : 'rgba(148,163,184,0.1)', color: t.is_enabled ? '#16a34a' : 'var(--text-dark)' }}>
                          {t.is_enabled ? 'ON' : 'OFF'}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-dark)' }}>/{t.key}</span>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                          <button type="button" onClick={() => startEdit(t)} style={iconBtn}><Edit3 size={13} /></button>
                          <button type="button" onClick={() => del(t.id)} style={{ ...iconBtn, color: '#dc2626', borderColor: 'rgba(239,68,68,0.2)' }}><Trash2 size={13} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '0.85rem', outline: 'none' };
const iconBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-muted)', cursor: 'pointer' };

function filterBtn(active: boolean): React.CSSProperties {
  return {
    padding: '5px 12px', borderRadius: '8px', border: '1px solid',
    borderColor: active ? '#0f766e' : 'var(--border-subtle)',
    background: active ? 'rgba(15,118,110,0.08)' : 'var(--bg-card)',
    color: active ? '#0f766e' : 'var(--text-dark)',
    fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
  };
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (<label style={{ display: 'flex', flexDirection: 'column', gap: '4px', ...style }}><span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-dark)' }}>{label}</span>{children}</label>);
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
