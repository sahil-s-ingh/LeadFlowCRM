import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import {
  Award, Loader2, Save, CheckCircle2, AlertTriangle, Phone, Clock,
  TrendingUp, ArrowLeft, Mic, Gauge, FileText, Flag, Star,
} from 'lucide-react';

type QualitySettings = {
  id?: string;
  enabled: boolean;
  auto_score_new_calls: boolean;
  min_call_duration_sec: number;
  script_weight: number;
  objection_weight: number;
  tone_weight: number;
  pacing_weight: number;
};

type QualityScore = {
  id: string;
  call_session_id: string | null;
  call_log_id: string | null;
  lead_phone: string | null;
  agent_email: string | null;
  call_duration_sec: number | null;
  overall_score: number;
  script_adherence_score: number;
  objection_handling_score: number;
  tone_score: number;
  pacing_score: number;
  feedback_summary: string | null;
  key_moments: Array<{ time: string; event: string; type: string }> | null;
  red_flags: string[] | null;
  transcript_snippet: string | null;
  scored_at: string;
};

const DEFAULTS: QualitySettings = {
  enabled: false,
  auto_score_new_calls: true,
  min_call_duration_sec: 30,
  script_weight: 30,
  objection_weight: 25,
  tone_weight: 25,
  pacing_weight: 20,
};

export default function CallQualityScoring({ session, onBack }: { session: Session; onBack: () => void }) {
  const [settings, setSettings] = useState<QualitySettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [scores, setScores] = useState<QualityScore[]>([]);
  const [selectedScore, setSelectedScore] = useState<QualityScore | null>(null);
  const [scoring, setScoring] = useState(false);

  const fetchScores = useCallback(async () => {
    const { data, error: qErr } = await supabase
      .from('call_quality_scores')
      .select('*')
      .eq('user_id', session.user.id)
      .order('scored_at', { ascending: false })
      .limit(50);
    if (qErr) return;
    setScores((data || []) as QualityScore[]);
  }, [session.user.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error: qErr } = await supabase
        .from('call_quality_settings')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (qErr) { setError(qErr.message); setLoading(false); return; }
      if (data) {
        setSettings({
          id: data.id,
          enabled: data.enabled ?? false,
          auto_score_new_calls: data.auto_score_new_calls ?? true,
          min_call_duration_sec: data.min_call_duration_sec ?? 30,
          script_weight: data.script_weight ?? 30,
          objection_weight: data.objection_weight ?? 25,
          tone_weight: data.tone_weight ?? 25,
          pacing_weight: data.pacing_weight ?? 20,
        });
      }
      await fetchScores();
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [session.user.id, fetchScores]);

  const update = <K extends keyof QualitySettings>(key: K, value: QualitySettings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    const payload = {
      user_id: session.user.id,
      enabled: settings.enabled,
      auto_score_new_calls: settings.auto_score_new_calls,
      min_call_duration_sec: settings.min_call_duration_sec,
      script_weight: settings.script_weight,
      objection_weight: settings.objection_weight,
      tone_weight: settings.tone_weight,
      pacing_weight: settings.pacing_weight,
      updated_at: new Date().toISOString(),
    };
    try {
      if (settings.id) {
        const { error: uErr } = await supabase.from('call_quality_settings').update(payload).eq('id', settings.id);
        if (uErr) throw uErr;
      } else {
        const { data, error: iErr } = await supabase.from('call_quality_settings').insert(payload).select('id').single();
        if (iErr) throw iErr;
        if (data) setSettings((s) => ({ ...s, id: data.id }));
      }
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleScoreCall = async (callSessionId: string) => {
    setScoring(true);
    setError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/call-quality-scoring`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'score_call', call_session_id: callSessionId, user_id: session.user.id }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Failed to score call');
      } else {
        await fetchScores();
      }
    } catch {
      setError('Failed to score call');
    }
    setScoring(false);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
        <Loader2 size={28} className="crm-spin" style={{ color: '#7c3aed' }} />
      </div>
    );
  }

  const sectionStyle: React.CSSProperties = {
    border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px',
    marginBottom: '18px', background: 'var(--bg-card)',
  };
  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
  };
  const toggle = (on: boolean, onClick: () => void, color = '#7c3aed') => (
    <button type="button" onClick={onClick} aria-label="Toggle"
      style={{ width: '44px', height: '24px', borderRadius: '999px', border: 'none',
        background: on ? color : 'var(--bg-light)', position: 'relative', cursor: 'pointer',
        transition: 'background 0.2s', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: '3px', left: on ? '23px' : '3px',
        width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
    </button>
  );
  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', border: '1px solid var(--border-subtle)', borderRadius: '8px',
    background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.83rem',
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#16a34a';
    if (score >= 60) return '#f59e0b';
    if (score >= 40) return '#ea580c';
    return '#dc2626';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Needs Work';
    return 'Poor';
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  // Detail view
  if (selectedScore) {
    const s = selectedScore;
    const moments = Array.isArray(s.key_moments) ? s.key_moments : [];
    const flags = Array.isArray(s.red_flags) ? s.red_flags : [];
    const subScores = [
      { label: 'Script Adherence', value: s.script_adherence_score, icon: FileText, color: '#2563eb' },
      { label: 'Objection Handling', value: s.objection_handling_score, icon: TrendingUp, color: '#0891b2' },
      { label: 'Tone', value: s.tone_score, icon: Mic, color: '#7c3aed' },
      { label: 'Pacing', value: s.pacing_score, icon: Gauge, color: '#ea580c' },
    ];

    return (
      <div className="crm-followups-page">
        <div className="crm-followups-header">
          <button className="crm-followups-back" onClick={() => setSelectedScore(null)}>
            <ArrowLeft size={18} /> Back
          </button>
          <div>
            <h1>Call Quality Report</h1>
            <p>Detailed breakdown of this call's quality scores</p>
          </div>
        </div>

        {/* Overall Score Card */}
        <div style={{
          ...sectionStyle, display: 'flex', alignItems: 'center', gap: '24px',
          background: `linear-gradient(135deg, ${getScoreColor(s.overall_score)}08, transparent)`,
          border: `1px solid ${getScoreColor(s.overall_score)}30`,
        }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%', flexShrink: 0,
            background: getScoreColor(s.overall_score), display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
          }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{s.overall_score}</span>
            <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>SCORE</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <Award size={20} style={{ color: getScoreColor(s.overall_score) }} />
              <strong style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>{getScoreLabel(s.overall_score)}</strong>
              <span style={{
                fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: '6px',
                background: `${getScoreColor(s.overall_score)}15`, color: getScoreColor(s.overall_score),
              }}>{s.overall_score}/100</span>
            </div>
            {s.lead_phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-dark)' }}>
                <Phone size={13} /> {s.lead_phone}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
              {s.call_duration_sec && (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} /> {formatDuration(s.call_duration_sec)}
                </span>
              )}
              <span style={{ fontSize: '0.78rem', color: 'var(--text-dark)' }}>
                {new Date(s.scored_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>

        {/* Sub-scores */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '18px' }}>
          {subScores.map((sub) => {
            const Icon = sub.icon;
            return (
              <div key={sub.label} style={sectionStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: `${sub.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={18} style={{ color: sub.color }} />
                  </div>
                  <strong style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>{sub.label}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ flex: 1, height: '8px', borderRadius: '4px', background: 'var(--bg-light)', overflow: 'hidden' }}>
                    <div style={{ width: `${sub.value}%`, height: '100%', borderRadius: '4px', background: getScoreColor(sub.value), transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: getScoreColor(sub.value), minWidth: '36px', textAlign: 'right' }}>{sub.value}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Feedback */}
        {s.feedback_summary && (
          <div style={sectionStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Star size={18} style={{ color: '#f59e0b' }} />
              <strong style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>AI Feedback</strong>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.6, margin: 0 }}>{s.feedback_summary}</p>
          </div>
        )}

        {/* Key Moments */}
        {moments.length > 0 && (
          <div style={sectionStyle}>
            <strong style={{ fontSize: '0.88rem', color: 'var(--text-main)', marginBottom: '12px', display: 'block' }}>Key Moments</strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {moments.map((m, i) => {
                const color = m.type === 'positive' ? '#16a34a' : m.type === 'negative' ? '#dc2626' : '#64748b';
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px', background: `${color}08`, border: `1px solid ${color}20` }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-dark)', fontWeight: 600, whiteSpace: 'nowrap' }}>{m.time}</span>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>{m.event}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Red Flags */}
        {flags.length > 0 && (
          <div style={sectionStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Flag size={18} style={{ color: '#dc2626' }} />
              <strong style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>Red Flags</strong>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {flags.map((flag, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--text-main)' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#dc2626', flexShrink: 0 }} />
                  {flag}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transcript Snippet */}
        {s.transcript_snippet && (
          <div style={sectionStyle}>
            <strong style={{ fontSize: '0.88rem', color: 'var(--text-main)', marginBottom: '10px', display: 'block' }}>Transcript Preview</strong>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-dark)', lineHeight: 1.5, margin: 0, fontStyle: 'italic' }}>{s.transcript_snippet}...</p>
          </div>
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="crm-followups-page">
      <div className="crm-followups-header">
        <button className="crm-followups-back" onClick={onBack}>
          <ArrowLeft size={18} /> Back
        </button>
        <div>
          <h1>Call Quality Scoring</h1>
          <p>AI-powered analysis of your sales calls — script adherence, objection handling, tone, and pacing</p>
        </div>
      </div>

      {/* Settings Section */}
      <div style={sectionStyle}>
        <div style={{ ...rowStyle, marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
              background: settings.enabled ? 'rgba(124,58,237,0.12)' : 'var(--bg-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={20} style={{ color: settings.enabled ? '#7c3aed' : 'var(--text-dark)' }} />
            </div>
            <div>
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>Enable call quality scoring</strong>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-dark)', margin: '2px 0 0' }}>
                Analyze call transcripts and generate quality scores automatically.
              </p>
            </div>
          </div>
          {toggle(settings.enabled, () => update('enabled', !settings.enabled))}
        </div>

        {settings.enabled && (
          <>
            <div style={{ ...rowStyle, marginBottom: '14px' }}>
              <div>
                <strong style={{ fontSize: '0.84rem', color: 'var(--text-main)' }}>Auto-score new calls</strong>
                <p style={{ fontSize: '0.74rem', color: 'var(--text-dark)', margin: '2px 0 0' }}>
                  Automatically score calls as soon as the transcript is available.
                </p>
              </div>
              {toggle(settings.auto_score_new_calls, () => update('auto_score_new_calls', !settings.auto_score_new_calls))}
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dark)', fontWeight: 600 }}>Minimum call duration to score</span>
              <input type="number" min={10} max={600} value={settings.min_call_duration_sec}
                onChange={(e) => update('min_call_duration_sec', Math.max(10, parseInt(e.target.value, 10) || 30))}
                style={{ ...inputStyle, width: '80px' }} />
              <span style={{ fontSize: '0.76rem', color: 'var(--text-dark)' }}>seconds</span>
            </label>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
              <strong style={{ fontSize: '0.84rem', color: 'var(--text-main)', marginBottom: '10px', display: 'block' }}>Scoring Criteria Weights</strong>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-dark)', margin: '0 0 12px' }}>
                Adjust how much each factor contributes to the overall score. Weights should total 100.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                {([
                  { key: 'script_weight' as const, label: 'Script Adherence', color: '#2563eb' },
                  { key: 'objection_weight' as const, label: 'Objection Handling', color: '#0891b2' },
                  { key: 'tone_weight' as const, label: 'Tone', color: '#7c3aed' },
                  { key: 'pacing_weight' as const, label: 'Pacing', color: '#ea580c' },
                ]).map((w) => (
                  <label key={w.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.74rem', color: w.color, fontWeight: 600 }}>{w.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input type="number" min={0} max={100} value={settings[w.key]}
                        onChange={(e) => update(w.key, Math.max(0, parseInt(e.target.value, 10) || 0))}
                        style={{ ...inputStyle, width: '70px' }} />
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-dark)' }}>%</span>
                    </div>
                  </label>
                ))}
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-dark)', marginTop: '8px' }}>
                Total: {settings.script_weight + settings.objection_weight + settings.tone_weight + settings.pacing_weight}%
              </p>
            </div>
          </>
        )}
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '8px', padding: '12px 16px', color: '#dc2626', fontSize: '0.85rem',
          fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}
      {saved && (
        <div style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)',
          borderRadius: '8px', padding: '12px 16px', color: '#16a34a', fontSize: '0.85rem',
          fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} /> Settings saved.
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
        <button type="button" onClick={handleSave} disabled={saving} style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px',
          border: 'none', borderRadius: '10px',
          background: saving ? 'var(--bg-light)' : '#7c3aed', color: saving ? 'var(--text-dark)' : '#fff',
          fontSize: '0.85rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
        }}>
          {saving ? <Loader2 size={16} className="crm-spin" /> : <Save size={16} />}
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>

      {/* Score History */}
      <div style={sectionStyle}>
        <div style={{ ...rowStyle, marginBottom: '14px' }}>
          <strong style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>Score History</strong>
          {scoring && <Loader2 size={16} className="crm-spin" style={{ color: '#7c3aed' }} />}
        </div>
        {scores.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <Award size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
            <p style={{ fontSize: '0.85rem', color: 'var(--text-dark)' }}>
              No call quality scores yet. When you enable scoring and make calls with transcripts,
              they'll appear here with detailed analysis.
            </p>
          </div>
        ) : (
          <div className="crm-followups-grid">
            {scores.map((s) => (
              <div key={s.id} className="crm-followups-card" style={{ borderLeftColor: getScoreColor(s.overall_score), cursor: 'pointer' }}
                onClick={() => setSelectedScore(s)}>
                <div className="crm-followups-card-header">
                  <div className="crm-followups-card-icon" style={{ background: `${getScoreColor(s.overall_score)}10` }}>
                    <Award size={18} style={{ color: getScoreColor(s.overall_score) }} />
                  </div>
                  <span className="crm-followups-card-badge" style={{
                    background: `${getScoreColor(s.overall_score)}15`, color: getScoreColor(s.overall_score),
                  }}>
                    {getScoreLabel(s.overall_score)}
                  </span>
                </div>
                <h3 className="crm-followups-card-name">
                  {s.lead_phone || 'Unknown number'}
                </h3>
                <div className="crm-followups-card-date">
                  <Clock size={13} />
                  <span>{new Date(s.scored_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  <span className="crm-followups-card-chip" style={{
                    background: `${getScoreColor(s.overall_score)}10`, color: getScoreColor(s.overall_score),
                  }}>
                    {s.overall_score}/100
                  </span>
                </div>
                {s.call_duration_sec && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: 'var(--text-dark)', marginTop: '4px' }}>
                    <Phone size={12} /> {formatDuration(s.call_duration_sec)}
                  </div>
                )}
                {s.feedback_summary && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-dark)', marginTop: '8px', lineHeight: 1.4,
                    overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {s.feedback_summary}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
