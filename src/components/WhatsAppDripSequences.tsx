import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import {
  Droplets, Plus, Trash2, Edit3, Save, X, Loader2, AlertCircle, CheckCircle2,
  ToggleLeft, ToggleRight, ArrowLeft, Clock, Users, Play, Pause,
} from 'lucide-react';

type DripStep = {
  id?: string;
  step_order: number;
  delay_hours: number;
  message_text: string;
  template_name?: string | null;
};

type DripSequence = {
  id: string;
  name: string;
  description: string | null;
  trigger_type: 'manual' | 'on_new_conversation' | 'on_lead_status';
  trigger_config: any;
  is_active: boolean;
  total_steps: number;
  enrolled_count: number;
  created_at: string;
};

const emptyForm = {
  name: '',
  description: '',
  trigger_type: 'manual' as const,
  is_active: true,
  steps: [{ step_order: 1, delay_hours: 0, message_text: '', template_name: '' }] as DripStep[],
};

export default function WhatsAppDripSequences({ session, onBack }: { session: Session; onBack: () => void }) {
  const [sequences, setSequences] = useState<DripSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [stepsCache, setStepsCache] = useState<Record<string, DripStep[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase.from('wa_drip_sequences').select('*').order('created_at', { ascending: false });
    if (err) { setError(err.message); }
    else { setSequences((data || []) as DripSequence[]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(''), 3000); return () => clearTimeout(t); }
  }, [success]);

  const loadSteps = async (seqId: string) => {
    const { data } = await supabase.from('wa_drip_steps').select('*').eq('sequence_id', seqId).order('step_order', { ascending: true });
    setStepsCache((prev) => ({ ...prev, [seqId]: (data || []) as DripStep[] }));
  };

  const toggleExpand = (seq: DripSequence) => {
    if (expandedId === seq.id) { setExpandedId(null); return; }
    setExpandedId(seq.id);
    if (!stepsCache[seq.id]) loadSteps(seq.id);
  };

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const startEdit = async (seq: DripSequence) => {
    const { data } = await supabase.from('wa_drip_steps').select('*').eq('sequence_id', seq.id).order('step_order', { ascending: true });
    setEditingId(seq.id);
    setForm({
      name: seq.name,
      description: seq.description || '',
      trigger_type: seq.trigger_type,
      is_active: seq.is_active,
      steps: (data && data.length > 0) ? (data as DripStep[]) : [{ step_order: 1, delay_hours: 0, message_text: '', template_name: '' }],
    });
    setShowForm(true);
  };

  const cancelForm = () => { setShowForm(false); setEditingId(null); setForm(emptyForm); };

  const addStep = () => {
    const nextOrder = form.steps.length + 1;
    setForm({ ...form, steps: [...form.steps, { step_order: nextOrder, delay_hours: 24, message_text: '', template_name: '' }] });
  };

  const removeStep = (idx: number) => {
    if (form.steps.length <= 1) return;
    const next = form.steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step_order: i + 1 }));
    setForm({ ...form, steps: next });
  };

  const updateStep = (idx: number, field: keyof DripStep, value: any) => {
    const next = [...form.steps];
    next[idx] = { ...next[idx], [field]: value };
    setForm({ ...form, steps: next });
  };

  const save = async () => {
    if (!form.name.trim()) { setError('Sequence name is required.'); return; }
    const validSteps = form.steps.filter((s) => s.message_text.trim());
    if (validSteps.length === 0) { setError('Add at least one step with a message.'); return; }
    setSaving(true);
    setError('');

    try {
      let seqId = editingId;
      const seqPayload: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        trigger_type: form.trigger_type,
        is_active: form.is_active,
        total_steps: validSteps.length,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error: err } = await supabase.from('wa_drip_sequences').update(seqPayload).eq('id', editingId);
        if (err) throw err;
        // Delete old steps and re-insert
        await supabase.from('wa_drip_steps').delete().eq('sequence_id', editingId);
      } else {
        const { data, error: err } = await supabase.from('wa_drip_sequences').insert({ ...seqPayload, enrolled_count: 0 }).select().single();
        if (err) throw err;
        seqId = data.id;
      }

      const stepRows = validSteps.map((s, i) => ({
        sequence_id: seqId,
        step_order: i + 1,
        delay_hours: s.delay_hours,
        message_text: s.message_text.trim(),
        template_name: s.template_name?.trim() || null,
      }));
      const { error: stepErr } = await supabase.from('wa_drip_steps').insert(stepRows);
      if (stepErr) throw stepErr;

      setSuccess(editingId ? 'Sequence updated.' : 'Sequence created.');
      cancelForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save sequence');
    }
    setSaving(false);
  };

  const toggleActive = async (seq: DripSequence) => {
    const { error: err } = await supabase.from('wa_drip_sequences').update({ is_active: !seq.is_active }).eq('id', seq.id);
    if (err) { setError(err.message); return; }
    await load();
  };

  const del = async (id: string) => {
    if (!confirm('Delete this drip sequence and all its steps? Active enrollments will be paused.')) return;
    const { error: err } = await supabase.from('wa_drip_sequences').delete().eq('id', id);
    if (err) { setError(err.message); return; }
    setSuccess('Sequence deleted.');
    await load();
  };

  const triggerLabel = (t: string) => {
    if (t === 'on_new_conversation') return 'On new conversation';
    if (t === 'on_lead_status') return 'On lead status change';
    return 'Manual enrollment';
  };

  return (
    <div className="wa-drip-page">
      <div className="wa-drip-header">
        <button className="wa-drip-back" onClick={onBack}><ArrowLeft size={18} /> Back</button>
        <div className="wa-drip-title-wrap">
          <div className="wa-drip-title-icon"><Droplets size={22} /></div>
          <div>
            <h1 className="wa-drip-title">WhatsApp Drip Sequences</h1>
            <p className="wa-drip-subtitle">Send a series of timed WhatsApp follow-ups. Enroll contacts manually or automatically when they start a new conversation.</p>
          </div>
        </div>
      </div>

      {error && <Banner type="error" message={error} onClose={() => setError('')} />}
      {success && <Banner type="success" message={success} onClose={() => setSuccess('')} />}

      <div className="wa-drip-tabs">
        <span className="wa-drip-tab-label">All Sequences</span>
        {!showForm && (
          <button className="wa-drip-add-btn" onClick={startCreate}><Plus size={16} /> New Sequence</button>
        )}
      </div>

      {showForm && (
        <div className="wa-drip-form-card">
          <div className="wa-drip-form-head">
            <h2>{editingId ? 'Edit Sequence' : 'Create Sequence'}</h2>
            <button className="wa-drip-form-close" onClick={cancelForm}><X size={18} /></button>
          </div>

          <div className="wa-drip-form-grid">
            <Field label="Sequence name">
              <input className="wa-drip-input" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. New lead nurture series" />
            </Field>
            <Field label="Trigger type">
              <select className="wa-drip-input" value={form.trigger_type} onChange={(e) => setForm({ ...form, trigger_type: e.target.value as 'manual' | 'on_new_conversation' | 'on_lead_status' })}>
                <option value="manual">Manual enrollment</option>
                <option value="on_new_conversation">Auto: when a new conversation starts</option>
                <option value="on_lead_status">Auto: on lead status change</option>
              </select>
            </Field>
          </div>

          <Field label="Description (optional)" style={{ marginTop: 14 }}>
            <input className="wa-drip-input" type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What does this sequence do?" />
          </Field>

          <div className="wa-drip-steps-section">
            <div className="wa-drip-steps-head">
              <span>Steps ({form.steps.length})</span>
              <button className="wa-drip-mini-add" onClick={addStep}><Plus size={13} /> Add step</button>
            </div>

            {form.steps.map((step, idx) => (
              <div key={idx} className="wa-drip-step-row">
                <div className="wa-drip-step-num">{idx + 1}</div>
                <div className="wa-drip-step-body">
                  <div className="wa-drip-step-top">
                    <Field label="Wait (hours) before sending">
                      <input className="wa-drip-input wa-drip-delay-input" type="number" min="0" value={step.delay_hours} onChange={(e) => updateStep(idx, 'delay_hours', parseInt(e.target.value) || 0)} />
                    </Field>
                    <Field label="Approved template name (optional — sends as template)">
                      <input className="wa-drip-input" type="text" value={step.template_name || ''} onChange={(e) => updateStep(idx, 'template_name', e.target.value)} placeholder="e.g. welcome_message" />
                    </Field>
                    {form.steps.length > 1 && (
                      <button className="wa-drip-step-remove" onClick={() => removeStep(idx)}><Trash2 size={14} /></button>
                    )}
                  </div>
                  <Field label="Message text">
                    <textarea className="wa-drip-textarea" value={step.message_text} onChange={(e) => updateStep(idx, 'message_text', e.target.value)} placeholder={`Hi {{name}}, here's update ${idx + 1}...`} rows={2} />
                  </Field>
                </div>
              </div>
            ))}
          </div>

          <div className="wa-drip-form-actions">
            <button className="wa-drip-save-btn" onClick={save} disabled={saving}>
              {saving ? <Loader2 size={16} className="crm-spin" /> : <Save size={16} />} {editingId ? 'Update Sequence' : 'Create Sequence'}
            </button>
            <button className="wa-drip-cancel-btn" onClick={cancelForm}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="wa-drip-loading"><Loader2 size={28} className="crm-spin" /></div>
      ) : sequences.length === 0 ? (
        <div className="wa-drip-empty">
          <Droplets size={40} />
          <h3>No drip sequences yet</h3>
          <p>Create a sequence to send a series of timed WhatsApp follow-ups to your contacts automatically.</p>
          <button className="wa-drip-add-btn" onClick={startCreate}><Plus size={16} /> Create your first sequence</button>
        </div>
      ) : (
        <div className="wa-drip-list">
          {sequences.map((seq) => {
            const steps = stepsCache[seq.id] || [];
            const isExpanded = expandedId === seq.id;
            return (
              <div key={seq.id} className={`wa-drip-card ${seq.is_active ? '' : 'inactive'}`}>
                <div className="wa-drip-card-top">
                  <div className="wa-drip-card-left" onClick={() => toggleExpand(seq)} style={{ cursor: 'pointer' }}>
                    <div className="wa-drip-card-name-row">
                      <span className={`wa-drip-trigger-badge wa-drip-trigger-${seq.trigger_type}`}>{triggerLabel(seq.trigger_type)}</span>
                      <strong className="wa-drip-card-name">{seq.name}</strong>
                    </div>
                    {seq.description && <p className="wa-drip-card-desc">{seq.description}</p>}
                    <div className="wa-drip-card-meta">
                      <span className="wa-drip-meta-chip"><Clock size={12} /> {seq.total_steps} step{seq.total_steps === 1 ? '' : 's'}</span>
                      <span className="wa-drip-meta-chip"><Users size={12} /> {seq.enrolled_count} enrolled</span>
                    </div>
                  </div>
                  <button className="wa-drip-toggle" onClick={() => toggleActive(seq)} title={seq.is_active ? 'Active — click to pause' : 'Paused — click to activate'}>
                    {seq.is_active ? <ToggleRight size={30} style={{ color: '#16a34a' }} /> : <ToggleLeft size={30} style={{ color: '#94a3b8' }} />}
                  </button>
                </div>
                <div className="wa-drip-card-bottom">
                  <div className="wa-drip-card-actions-left">
                    {seq.is_active ? <span className="wa-drip-status-active"><Play size={11} /> Running</span> : <span className="wa-drip-status-paused"><Pause size={11} /> Paused</span>}
                  </div>
                  <div className="wa-drip-card-actions">
                    <button className="wa-drip-icon-btn" onClick={() => startEdit(seq)}><Edit3 size={14} /></button>
                    <button className="wa-drip-icon-btn wa-drip-icon-danger" onClick={() => del(seq.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="wa-drip-steps-expand">
                    {steps.length === 0 ? (
                      <p className="wa-drip-no-steps">Loading steps...</p>
                    ) : (
                      <div className="wa-drip-timeline">
                        {steps.map((s, i) => (
                          <div key={s.id || i} className="wa-drip-timeline-item">
                            <div className="wa-drip-timeline-dot">{s.step_order}</div>
                            <div className="wa-drip-timeline-content">
                              <div className="wa-drip-timeline-delay"><Clock size={11} /> {s.delay_hours}h after previous</div>
                              <p className="wa-drip-timeline-msg">{s.message_text}</p>
                              {s.template_name && <span className="wa-drip-tmpl-tag">Template: {s.template_name}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <label className="wa-drip-field" style={style}>
      <span className="wa-drip-field-label">{label}</span>
      {children}
    </label>
  );
}

function Banner({ type, message, onClose }: { type: 'error' | 'success'; message: string; onClose: () => void }) {
  const isErr = type === 'error';
  return (
    <div className={`wa-drip-banner ${isErr ? 'wa-drip-banner-err' : 'wa-drip-banner-ok'}`}>
      {isErr ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />} {message}
      <button className="wa-drip-banner-close" onClick={onClose}><X size={16} /></button>
    </div>
  );
}
