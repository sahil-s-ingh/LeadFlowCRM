import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Save, X, Loader2, AlertCircle, CheckCircle2, FileText, Eye, Plus, Trash2 } from 'lucide-react';

export type LegalPage = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  content: string;
  is_published: boolean;
  sort_order: number;
  updated_at: string;
};

export default function SuperAdminLegal() {
  const [pages, setPages] = useState<LegalPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<LegalPage | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSubtitle, setEditSubtitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editPublished, setEditPublished] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase.from('legal_pages').select('*').order('sort_order', { ascending: true });
    if (err) { setError(err.message); }
    else {
      setPages((data || []) as LegalPage[]);
      if (data && data.length > 0 && !selected) {
        selectPage((data[0] as LegalPage));
      }
    }
    setLoading(false);
  }, [selected]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(''), 3000); return () => clearTimeout(t); }
  }, [success]);

  const selectPage = (p: LegalPage) => {
    setSelected(p);
    setEditingId(p.id);
    setEditTitle(p.title);
    setEditSubtitle(p.subtitle || '');
    setEditContent(p.content);
    setEditPublished(p.is_published);
    setShowPreview(false);
  };

  const save = async () => {
    if (!selected || !editingId) return;
    if (!editTitle.trim()) { setError('Title is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const { error: err } = await supabase
        .from('legal_pages')
        .update({ title: editTitle, subtitle: editSubtitle, content: editContent, is_published: editPublished })
        .eq('id', editingId);
      if (err) throw err;
      setSuccess('Legal page updated and live on your site.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
    setSaving(false);
  };

  const createPage = async () => {
    const slug = prompt('Enter a URL slug for the new page (e.g. "shipping-policy"):');
    if (!slug || !slug.trim()) return;
    const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    setSaving(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('legal_pages')
        .insert({ slug: cleanSlug, title: cleanSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), content: '<p>Write your content here.</p>', is_published: true, sort_order: pages.length })
        .select()
        .single();
      if (err) throw err;
      setSuccess('New page created.');
      await load();
      if (data) selectPage(data as LegalPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create page');
    }
    setSaving(false);
  };

  const delPage = async (p: LegalPage) => {
    if (!confirm(`Delete "${p.title}"? This will remove it from your public site.`)) return;
    const { error: err } = await supabase.from('legal_pages').delete().eq('id', p.id);
    if (err) { setError(err.message); return; }
    setSuccess('Page deleted.');
    setSelected(null);
    await load();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <button type="button" onClick={createPage} disabled={saving} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#0f766e', color: 'var(--bg-card)', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={16} /> New Page
        </button>
      </div>

      {error && <Banner type="error" message={error} onClose={() => setError('')} />}
      {success && <Banner type="success" message={success} onClose={() => setSuccess('')} />}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <Loader2 size={28} className="crm-spin" style={{ color: '#0f766e' }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '20px' }}>
          {/* Sidebar list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {pages.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectPage(p)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '10px',
                  border: '1px solid', borderColor: selected?.id === p.id ? '#0f766e' : 'var(--border-subtle)',
                  background: selected?.id === p.id ? 'rgba(15,118,110,0.06)' : 'var(--bg-card)',
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                }}
              >
                <FileText size={15} style={{ color: selected?.id === p.id ? '#0f766e' : 'var(--text-dark)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-dark)' }}>/{p.slug}</div>
                </div>
                {!p.is_published && <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(148,163,184,0.15)', color: 'var(--text-dark)' }}>DRAFT</span>}
              </button>
            ))}
          </div>

          {/* Editor */}
          {selected ? (
            <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-subtle)', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Edit "{selected.title}"</h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" onClick={() => setShowPreview(!showPreview)} style={{ padding: '6px 12px', borderRadius: '7px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Eye size={14} /> {showPreview ? 'Edit' : 'Preview'}
                  </button>
                  <button type="button" onClick={() => delPage(selected)} style={{ padding: '6px 12px', borderRadius: '7px', border: '1px solid rgba(239,68,68,0.2)', background: 'var(--bg-card)', color: '#dc2626', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>

              {showPreview ? (
                <div style={{ padding: '20px', background: 'var(--bg-light)', borderRadius: '12px', border: '1px solid var(--border-subtle)', minHeight: '400px', fontSize: '0.88rem', lineHeight: 1.65, color: 'var(--text-muted)' }} dangerouslySetInnerHTML={{ __html: editContent }} />
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-dark)' }}>Page Title</span>
                      <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={inputStyle} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-dark)' }}>Subtitle (shown below title)</span>
                      <input type="text" value={editSubtitle} onChange={(e) => setEditSubtitle(e.target.value)} placeholder="Last updated: October 8, 2026" style={inputStyle} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-dark)' }}>Content (HTML)</span>
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={20}
                        style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.8rem', lineHeight: 1.5, resize: 'vertical' }}
                        placeholder="<h2>Section Title</h2><p>Your content here.</p>"
                      />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={editPublished} onChange={(e) => setEditPublished(e.target.checked)} /> Published (visible on your site)
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    <button type="button" onClick={save} disabled={saving} style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#0f766e', color: 'var(--bg-card)', fontSize: '0.85rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {saving ? <Loader2 size={16} className="crm-spin" /> : <Save size={16} />} Save & Publish
                    </button>
                  </div>
                </>
              )}
              <p style={{ marginTop: '16px', fontSize: '0.72rem', color: 'var(--text-dark)' }}>
                This page is visible at <a href={`#legal/${selected.slug}`} onClick={(e) => { e.preventDefault(); window.open(`#legal/${selected.slug}`, '_blank'); }} style={{ color: '#0f766e', fontWeight: 600 }}>#legal/{selected.slug}</a> on your site.
              </p>
            </div>
          ) : (
            <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-subtle)', padding: '48px', textAlign: 'center' }}>
              <FileText size={36} style={{ color: 'var(--text-dark)', marginBottom: '10px' }} />
              <p style={{ fontSize: '0.88rem', color: 'var(--text-dark)' }}>Select a page from the left to edit, or create a new one.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '0.85rem', outline: 'none' };

function Banner({ type, message, onClose }: { type: 'error' | 'success'; message: string; onClose: () => void }) {
  const isErr = type === 'error';
  return (
    <div style={{ padding: '12px 16px', borderRadius: '12px', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', background: isErr ? '#fef2f2' : '#f0fdf4', border: `1px solid ${isErr ? '#fecaca' : '#bbf7d0'}`, color: isErr ? '#dc2626' : '#16a34a' }}>
      {isErr ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />} {message}
      <button type="button" onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6 }}><X size={16} /></button>
    </div>
  );
}
