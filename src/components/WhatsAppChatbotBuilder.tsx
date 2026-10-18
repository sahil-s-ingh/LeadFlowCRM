import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import {
  Bot, Plus, Trash2, Edit3, Save, X, Loader2, AlertCircle, CheckCircle2,
  ToggleLeft, ToggleRight, ArrowLeft, MessageSquare, List, Type, Zap,
} from 'lucide-react';

type ChatbotRule = {
  id: string;
  name: string;
  keywords: string[];
  match_mode: 'any' | 'exact' | 'starts_with';
  reply_type: 'text' | 'buttons' | 'list';
  reply_text: string | null;
  buttons: { id: string; title: string }[] | null;
  list_title: string | null;
  list_options: { id: string; title: string; description?: string }[] | null;
  is_active: boolean;
  priority: number;
  hit_count: number;
  created_at: string;
};

type LogEntry = {
  id: string;
  trigger_message: string;
  matched_keyword: string;
  reply_type: string;
  created_at: string;
};

const emptyForm = {
  name: '',
  keywords: '',
  match_mode: 'any' as const,
  reply_type: 'text' as const,
  reply_text: '',
  buttons: [{ id: 'btn_1', title: '' }, { id: 'btn_2', title: '' }],
  list_title: '',
  list_options: [{ id: 'opt_1', title: '', description: '' }],
  priority: 0,
};

export default function WhatsAppChatbotBuilder({ session, onBack }: { session: Session; onBack: () => void }) {
  const [rules, setRules] = useState<ChatbotRule[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'rules' | 'logs'>('rules');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [rulesRes, logsRes] = await Promise.all([
      supabase.from('wa_chatbot_rules').select('*').order('priority', { ascending: false }),
      supabase.from('wa_chatbot_logs').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    if (rulesRes.error) setError(rulesRes.error.message);
    if (logsRes.error && !error) setError(logsRes.error.message);
    setRules((rulesRes.data || []) as ChatbotRule[]);
    setLogs((logsRes.data || []) as LogEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(''), 3000); return () => clearTimeout(t); }
  }, [success]);

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const startEdit = (r: ChatbotRule) => {
    setEditingId(r.id);
    setForm({
      name: r.name,
      keywords: (r.keywords || []).join(', '),
      match_mode: r.match_mode,
      reply_type: r.reply_type,
      reply_text: r.reply_text || '',
      buttons: (r.buttons && r.buttons.length > 0) ? r.buttons : [{ id: 'btn_1', title: '' }, { id: 'btn_2', title: '' }],
      list_title: r.list_title || '',
      list_options: (r.list_options && r.list_options.length > 0) ? r.list_options : [{ id: 'opt_1', title: '', description: '' }],
      priority: r.priority,
    });
    setShowForm(true);
  };

  const cancelForm = () => { setShowForm(false); setEditingId(null); setForm(emptyForm); };

  const save = async () => {
    if (!form.name.trim()) { setError('Rule name is required.'); return; }
    if (!form.keywords.trim()) { setError('At least one trigger keyword is required.'); return; }
    if (form.reply_type !== 'text' && !form.reply_text.trim()) { setError('Reply body text is required for button/list messages.'); return; }
    if (form.reply_type === 'text' && !form.reply_text.trim()) { setError('Reply text is required.'); return; }

    setSaving(true);
    setError('');
    const keywords = form.keywords.split(',').map((k) => k.trim()).filter(Boolean);
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      keywords,
      match_mode: form.match_mode,
      reply_type: form.reply_type,
      reply_text: form.reply_text.trim() || null,
      priority: form.priority,
    };

    if (form.reply_type === 'buttons') {
      const btns = form.buttons.filter((b) => b.title.trim()).slice(0, 3).map((b, i) => ({ id: b.id || `btn_${i + 1}`, title: b.title.trim() }));
      if (btns.length < 1) { setError('Add at least one button with a title.'); setSaving(false); return; }
      payload.buttons = btns;
      payload.list_title = null;
      payload.list_options = null;
    } else if (form.reply_type === 'list') {
      const opts = form.list_options.filter((o) => o.title.trim()).slice(0, 10).map((o, i) => ({ id: o.id || `opt_${i + 1}`, title: o.title.trim(), description: o.description?.trim() || '' }));
      if (opts.length < 1) { setError('Add at least one list option with a title.'); setSaving(false); return; }
      payload.list_options = opts;
      payload.list_title = form.list_title.trim() || 'Options';
      payload.buttons = null;
    } else {
      payload.buttons = null;
      payload.list_title = null;
      payload.list_options = null;
    }

    try {
      if (editingId) {
        const { error: err } = await supabase.from('wa_chatbot_rules').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingId);
        if (err) throw err;
        setSuccess('Rule updated.');
      } else {
        const { error: err } = await supabase.from('wa_chatbot_rules').insert(payload);
        if (err) throw err;
        setSuccess('Rule created.');
      }
      cancelForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rule');
    }
    setSaving(false);
  };

  const toggleActive = async (r: ChatbotRule) => {
    const { error: err } = await supabase.from('wa_chatbot_rules').update({ is_active: !r.is_active }).eq('id', r.id);
    if (err) { setError(err.message); return; }
    await load();
  };

  const del = async (id: string) => {
    if (!confirm('Delete this chatbot rule?')) return;
    const { error: err } = await supabase.from('wa_chatbot_rules').delete().eq('id', id);
    if (err) { setError(err.message); return; }
    setSuccess('Rule deleted.');
    await load();
  };

  const totalHits = rules.reduce((sum, r) => sum + (r.hit_count || 0), 0);
  const activeCount = rules.filter((r) => r.is_active).length;

  return (
    <div className="wa-chatbot-page">
      <div className="wa-chatbot-header">
        <button className="wa-chatbot-back" onClick={onBack}><ArrowLeft size={18} /> Back</button>
        <div className="wa-chatbot-title-wrap">
          <div className="wa-chatbot-title-icon"><Bot size={22} /></div>
          <div>
            <h1 className="wa-chatbot-title">WhatsApp Chatbot</h1>
            <p className="wa-chatbot-subtitle">Auto-reply to incoming WhatsApp messages based on keyword rules, with interactive buttons and lists.</p>
          </div>
        </div>
      </div>

      <div className="wa-chatbot-stats">
        <div className="wa-chatbot-stat-card">
          <div className="wa-chatbot-stat-icon wa-chatbot-stat-violet"><Zap size={18} /></div>
          <div>
            <div className="wa-chatbot-stat-value">{rules.length}</div>
            <div className="wa-chatbot-stat-label">Total Rules</div>
          </div>
        </div>
        <div className="wa-chatbot-stat-card">
          <div className="wa-chatbot-stat-icon wa-chatbot-stat-green"><ToggleRight size={18} /></div>
          <div>
            <div className="wa-chatbot-stat-value">{activeCount}</div>
            <div className="wa-chatbot-stat-label">Active</div>
          </div>
        </div>
        <div className="wa-chatbot-stat-card">
          <div className="wa-chatbot-stat-icon wa-chatbot-stat-blue"><MessageSquare size={18} /></div>
          <div>
            <div className="wa-chatbot-stat-value">{totalHits}</div>
            <div className="wa-chatbot-stat-label">Total Triggers</div>
          </div>
        </div>
      </div>

      {error && <Banner type="error" message={error} onClose={() => setError('')} />}
      {success && <Banner type="success" message={success} onClose={() => setSuccess('')} />}

      <div className="wa-chatbot-tabs">
        <button className={`wa-chatbot-tab ${tab === 'rules' ? 'active' : ''}`} onClick={() => setTab('rules')}>
          <Bot size={15} /> Rules
        </button>
        <button className={`wa-chatbot-tab ${tab === 'logs' ? 'active' : ''}`} onClick={() => setTab('logs')}>
          <List size={15} /> Recent Activity
        </button>
        {tab === 'rules' && !showForm && (
          <button className="wa-chatbot-add-btn" onClick={startCreate}><Plus size={16} /> New Rule</button>
        )}
      </div>

      {showForm && tab === 'rules' && (
        <div className="wa-chatbot-form-card">
          <div className="wa-chatbot-form-head">
            <h2>{editingId ? 'Edit Rule' : 'Create Rule'}</h2>
            <button className="wa-chatbot-form-close" onClick={cancelForm}><X size={18} /></button>
          </div>

          <div className="wa-chatbot-form-grid">
            <Field label="Rule name">
              <input className="wa-chatbot-input" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Pricing auto-reply" />
            </Field>
            <Field label="Trigger keywords (comma separated)">
              <input className="wa-chatbot-input" type="text" value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="price, pricing, cost, how much" />
            </Field>
            <Field label="Match mode">
              <select className="wa-chatbot-input" value={form.match_mode} onChange={(e) => setForm({ ...form, match_mode: e.target.value as 'any' | 'exact' | 'starts_with' })}>
                <option value="any">Any word match (recommended)</option>
                <option value="exact">Exact message match</option>
                <option value="starts_with">Starts with keyword</option>
              </select>
            </Field>
            <Field label="Priority (higher = checked first)">
              <input className="wa-chatbot-input" type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })} />
            </Field>
          </div>

          <div className="wa-chatbot-reply-type-row">
            <label className="wa-chatbot-reply-type-label">Reply type</label>
            <div className="wa-chatbot-reply-types">
              <button className={`wa-chatbot-reply-opt ${form.reply_type === 'text' ? 'active' : ''}`} onClick={() => setForm({ ...form, reply_type: 'text' })}>
                <Type size={15} /> Text
              </button>
              <button className={`wa-chatbot-reply-opt ${form.reply_type === 'buttons' ? 'active' : ''}`} onClick={() => setForm({ ...form, reply_type: 'buttons' })}>
                <MessageSquare size={15} /> Buttons
              </button>
              <button className={`wa-chatbot-reply-opt ${form.reply_type === 'list' ? 'active' : ''}`} onClick={() => setForm({ ...form, reply_type: 'list' })}>
                <List size={15} /> List
              </button>
            </div>
          </div>

          <Field label={form.reply_type === 'text' ? 'Reply message' : 'Body text (shown above buttons/list)'} style={{ marginTop: 16 }}>
            <textarea className="wa-chatbot-textarea" value={form.reply_text} onChange={(e) => setForm({ ...form, reply_text: e.target.value })} placeholder="Type the auto-reply message..." rows={3} />
          </Field>

          {form.reply_type === 'buttons' && (
            <div className="wa-chatbot-subsection">
              <div className="wa-chatbot-subsection-head">
                <span>Reply buttons (max 3)</span>
                {form.buttons.length < 3 && (
                  <button className="wa-chatbot-mini-add" onClick={() => setForm({ ...form, buttons: [...form.buttons, { id: `btn_${form.buttons.length + 1}`, title: '' }] })}>
                    <Plus size={13} /> Add button
                  </button>
                )}
              </div>
              {form.buttons.map((b, i) => (
                <div key={i} className="wa-chatbot-row-inline">
                  <input className="wa-chatbot-input" type="text" value={b.title} onChange={(e) => { const next = [...form.buttons]; next[i] = { ...b, title: e.target.value }; setForm({ ...form, buttons: next }); }} placeholder={`Button ${i + 1} title`} maxLength={20} />
                  {form.buttons.length > 1 && (
                    <button className="wa-chatbot-row-remove" onClick={() => setForm({ ...form, buttons: form.buttons.filter((_, idx) => idx !== i) })}><X size={15} /></button>
                  )}
                </div>
              ))}
              <p className="wa-chatbot-hint">When a lead taps a button, their choice is sent back as a normal WhatsApp message you can match with another rule.</p>
            </div>
          )}

          {form.reply_type === 'list' && (
            <div className="wa-chatbot-subsection">
              <Field label="List header">
                <input className="wa-chatbot-input" type="text" value={form.list_title} onChange={(e) => setForm({ ...form, list_title: e.target.value })} placeholder="e.g. Our Plans" />
              </Field>
              <div className="wa-chatbot-subsection-head" style={{ marginTop: 12 }}>
                <span>List options (max 10)</span>
                {form.list_options.length < 10 && (
                  <button className="wa-chatbot-mini-add" onClick={() => setForm({ ...form, list_options: [...form.list_options, { id: `opt_${form.list_options.length + 1}`, title: '', description: '' }] })}>
                    <Plus size={13} /> Add option
                  </button>
                )}
              </div>
              {form.list_options.map((o, i) => (
                <div key={i} className="wa-chatbot-list-opt-row">
                  <input className="wa-chatbot-input" type="text" value={o.title} onChange={(e) => { const next = [...form.list_options]; next[i] = { ...o, title: e.target.value }; setForm({ ...form, list_options: next }); }} placeholder={`Option ${i + 1} title`} maxLength={24} />
                  <input className="wa-chatbot-input" type="text" value={o.description || ''} onChange={(e) => { const next = [...form.list_options]; next[i] = { ...o, description: e.target.value }; setForm({ ...form, list_options: next }); }} placeholder="Description (optional)" maxLength={72} />
                  {form.list_options.length > 1 && (
                    <button className="wa-chatbot-row-remove" onClick={() => setForm({ ...form, list_options: form.list_options.filter((_, idx) => idx !== i) })}><X size={15} /></button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="wa-chatbot-form-actions">
            <button className="wa-chatbot-save-btn" onClick={save} disabled={saving}>
              {saving ? <Loader2 size={16} className="crm-spin" /> : <Save size={16} />} {editingId ? 'Update Rule' : 'Create Rule'}
            </button>
            <button className="wa-chatbot-cancel-btn" onClick={cancelForm}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="wa-chatbot-loading"><Loader2 size={28} className="crm-spin" /></div>
      ) : tab === 'rules' ? (
        rules.length === 0 ? (
          <div className="wa-chatbot-empty">
            <Bot size={40} />
            <h3>No chatbot rules yet</h3>
            <p>Create your first rule to auto-reply when a lead sends a matching keyword on WhatsApp.</p>
            <button className="wa-chatbot-add-btn" onClick={startCreate}><Plus size={16} /> Create your first rule</button>
          </div>
        ) : (
          <div className="wa-chatbot-rule-list">
            {rules.map((r) => (
              <div key={r.id} className={`wa-chatbot-rule-card ${r.is_active ? '' : 'inactive'}`}>
                <div className="wa-chatbot-rule-top">
                  <div className="wa-chatbot-rule-name-row">
                    <span className={`wa-chatbot-rule-badge wa-chatbot-rule-badge-${r.reply_type}`}>
                      {r.reply_type === 'text' ? <Type size={11} /> : r.reply_type === 'buttons' ? <MessageSquare size={11} /> : <List size={11} />}
                      {r.reply_type}
                    </span>
                    <strong className="wa-chatbot-rule-name">{r.name}</strong>
                  </div>
                  <button className="wa-chatbot-toggle" onClick={() => toggleActive(r)} title={r.is_active ? 'Active — click to pause' : 'Paused — click to activate'}>
                    {r.is_active ? <ToggleRight size={30} style={{ color: '#16a34a' }} /> : <ToggleLeft size={30} style={{ color: '#94a3b8' }} />}
                  </button>
                </div>
                <div className="wa-chatbot-rule-keywords">
                  {(r.keywords || []).map((k) => <span key={k} className="wa-chatbot-kw-chip">{k}</span>)}
                  <span className="wa-chatbot-match-mode">{r.match_mode === 'any' ? 'word match' : r.match_mode === 'exact' ? 'exact match' : 'starts with'}</span>
                </div>
                {r.reply_text && <p className="wa-chatbot-rule-preview">{r.reply_text}</p>}
                <div className="wa-chatbot-rule-bottom">
                  <span className="wa-chatbot-rule-hits"><Zap size={12} /> {r.hit_count} trigger{r.hit_count === 1 ? '' : 's'}</span>
                  <div className="wa-chatbot-rule-actions">
                    <button className="wa-chatbot-icon-btn" onClick={() => startEdit(r)}><Edit3 size={14} /></button>
                    <button className="wa-chatbot-icon-btn wa-chatbot-icon-danger" onClick={() => del(r.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="wa-chatbot-log-list">
          {logs.length === 0 ? (
            <div className="wa-chatbot-empty">
              <List size={40} />
              <h3>No activity yet</h3>
              <p>When a lead's message triggers one of your chatbot rules, it will show up here.</p>
            </div>
          ) : (
            logs.map((l) => (
              <div key={l.id} className="wa-chatbot-log-row">
                <div className="wa-chatbot-log-icon"><Zap size={14} /></div>
                <div className="wa-chatbot-log-body">
                  <div className="wa-chatbot-log-msg">"{l.trigger_message}"</div>
                  <div className="wa-chatbot-log-meta">
                    matched <strong>{l.matched_keyword}</strong> · {l.reply_type} reply
                  </div>
                </div>
                <div className="wa-chatbot-log-time">{new Date(l.created_at).toLocaleString()}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <label className="wa-chatbot-field" style={style}>
      <span className="wa-chatbot-field-label">{label}</span>
      {children}
    </label>
  );
}

function Banner({ type, message, onClose }: { type: 'error' | 'success'; message: string; onClose: () => void }) {
  const isErr = type === 'error';
  return (
    <div className={`wa-chatbot-banner ${isErr ? 'wa-chatbot-banner-err' : 'wa-chatbot-banner-ok'}`}>
      {isErr ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />} {message}
      <button className="wa-chatbot-banner-close" onClick={onClose}><X size={16} /></button>
    </div>
  );
}
