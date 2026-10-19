import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  TrendingUp, Loader2, Save, CheckCircle2, AlertTriangle, Bell, BellRing, UserCog, RefreshCw,
} from 'lucide-react';

type EscalationSettings = {
  id?: string;
  enabled: boolean;
  step1_enabled: boolean;
  step1_hours: number;
  step2_enabled: boolean;
  step2_hours: number;
  step2_manager_email: string;
  step3_enabled: boolean;
  step3_hours: number;
  step3_reassign_lead: boolean;
};

const DEFAULTS: EscalationSettings = {
  enabled: false,
  step1_enabled: true,
  step1_hours: 2,
  step2_enabled: true,
  step2_hours: 6,
  step2_manager_email: '',
  step3_enabled: false,
  step3_hours: 24,
  step3_reassign_lead: false,
};

export default function FollowupEscalationSettings({ userId }: { userId: string }) {
  const [settings, setSettings] = useState<EscalationSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [escalationLog, setEscalationLog] = useState<Array<{ id: string; step: number; action: string; notified_email: string | null; created_at: string; lead_id: string | null }>>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error: qErr } = await supabase
        .from('followup_escalation_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (cancelled) return;
      if (qErr) { setError(qErr.message); setLoading(false); return; }
      if (data) {
        setSettings({
          id: data.id,
          enabled: data.enabled ?? false,
          step1_enabled: data.step1_enabled ?? true,
          step1_hours: data.step1_hours ?? 2,
          step2_enabled: data.step2_enabled ?? true,
          step2_hours: data.step2_hours ?? 6,
          step2_manager_email: data.step2_manager_email ?? '',
          step3_enabled: data.step3_enabled ?? false,
          step3_hours: data.step3_hours ?? 24,
          step3_reassign_lead: data.step3_reassign_lead ?? false,
        });
      }
      // Fetch recent escalation log
      const { data: logs } = await supabase
        .from('followup_escalation_log')
        .select('id, step, action, notified_email, created_at, lead_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (logs) setEscalationLog(logs);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const update = <K extends keyof EscalationSettings>(key: K, value: EscalationSettings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    const payload = {
      user_id: userId,
      enabled: settings.enabled,
      step1_enabled: settings.step1_enabled,
      step1_hours: settings.step1_hours,
      step2_enabled: settings.step2_enabled,
      step2_hours: settings.step2_hours,
      step2_manager_email: settings.step2_manager_email.trim() || null,
      step3_enabled: settings.step3_enabled,
      step3_hours: settings.step3_hours,
      step3_reassign_lead: settings.step3_reassign_lead,
      updated_at: new Date().toISOString(),
    };
    try {
      if (settings.id) {
        const { error: uErr } = await supabase.from('followup_escalation_settings').update(payload).eq('id', settings.id);
        if (uErr) throw uErr;
      } else {
        const { data, error: iErr } = await supabase.from('followup_escalation_settings').insert(payload).select('id').single();
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

  const refreshLog = async () => {
    const { data: logs } = await supabase
      .from('followup_escalation_log')
      .select('id, step, action, notified_email, created_at, lead_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);
    if (logs) setEscalationLog(logs);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
        <Loader2 size={28} className="crm-spin" style={{ color: '#0891b2' }} />
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
  const toggle = (on: boolean, onClick: () => void, color = '#0891b2') => (
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

  const stepLabels: Record<number, string> = { 1: 'Agent Reminder', 2: 'Manager Escalation', 3: 'Final Escalation' };
  const stepColors: Record<number, string> = { 1: '#f59e0b', 2: '#ea580c', 3: '#dc2626' };

  return (
    <>
      <div className="crm-settings-card-header">
        <h2 className="crm-settings-card-title">
          <TrendingUp size={20} style={{ color: '#0891b2' }} /> Auto Follow-Up Escalation
        </h2>
        <p className="crm-settings-card-desc">
          Automatically escalate overdue follow-ups in stages. When a reminder goes past due, the system
          notifies the agent, then a manager, and can even reassign the lead — so no lead ever goes cold.
        </p>
      </div>

      {/* Master switch */}
      <div style={{ ...sectionStyle, ...rowStyle }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
            background: settings.enabled ? 'rgba(8,145,178,0.12)' : 'var(--bg-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={20} style={{ color: settings.enabled ? '#0891b2' : 'var(--text-dark)' }} />
          </div>
          <div>
            <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>Enable auto-escalation</strong>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-dark)', margin: '2px 0 0' }}>
              Master switch. When off, overdue follow-ups only send the standard email reminder.
            </p>
          </div>
        </div>
        {toggle(settings.enabled, () => update('enabled', !settings.enabled))}
      </div>

      {/* Step 1: Agent Reminder */}
      <div style={sectionStyle}>
        <div style={rowStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bell size={18} style={{ color: '#f59e0b' }} />
            <div>
              <strong style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>Step 1 — Agent reminder</strong>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-dark)', margin: '2px 0 0' }}>
                Re-send the overdue reminder to the agent after this many hours.
              </p>
            </div>
          </div>
          {toggle(settings.step1_enabled, () => update('step1_enabled', !settings.step1_enabled), '#f59e0b')}
        </div>
        {settings.step1_enabled && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dark)', fontWeight: 600 }}>Escalate after</span>
            <input type="number" min={1} max={168} value={settings.step1_hours}
              onChange={(e) => update('step1_hours', Math.max(1, parseInt(e.target.value, 10) || 1))}
              style={{ ...inputStyle, width: '70px' }} />
            <span style={{ fontSize: '0.76rem', color: 'var(--text-dark)' }}>hours overdue</span>
          </label>
        )}
      </div>

      {/* Step 2: Manager Escalation */}
      <div style={sectionStyle}>
        <div style={rowStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BellRing size={18} style={{ color: '#ea580c' }} />
            <div>
              <strong style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>Step 2 — Manager escalation</strong>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-dark)', margin: '2px 0 0' }}>
                Notify a manager by email when the follow-up is severely overdue.
              </p>
            </div>
          </div>
          {toggle(settings.step2_enabled, () => update('step2_enabled', !settings.step2_enabled), '#ea580c')}
        </div>
        {settings.step2_enabled && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '14px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-dark)', fontWeight: 600 }}>Escalate after (hours)</span>
              <input type="number" min={1} max={168} value={settings.step2_hours}
                onChange={(e) => update('step2_hours', Math.max(1, parseInt(e.target.value, 10) || 1))}
                style={inputStyle} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-dark)', fontWeight: 600 }}>Manager email</span>
              <input type="email" value={settings.step2_manager_email}
                onChange={(e) => update('step2_manager_email', e.target.value)}
                placeholder="manager@company.com" style={inputStyle} />
            </label>
          </div>
        )}
      </div>

      {/* Step 3: Reassignment */}
      <div style={sectionStyle}>
        <div style={rowStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <UserCog size={18} style={{ color: '#dc2626' }} />
            <div>
              <strong style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>Step 3 — Final escalation</strong>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-dark)', margin: '2px 0 0' }}>
                Last resort: escalate to manager again and optionally reassign the lead to another agent.
              </p>
            </div>
          </div>
          {toggle(settings.step3_enabled, () => update('step3_enabled', !settings.step3_enabled), '#dc2626')}
        </div>
        {settings.step3_enabled && (
          <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dark)', fontWeight: 600 }}>Escalate after</span>
              <input type="number" min={1} max={336} value={settings.step3_hours}
                onChange={(e) => update('step3_hours', Math.max(1, parseInt(e.target.value, 10) || 1))}
                style={{ ...inputStyle, width: '70px' }} />
              <span style={{ fontSize: '0.76rem', color: 'var(--text-dark)' }}>hours overdue</span>
            </label>
            <div style={rowStyle}>
              <div>
                <strong style={{ fontSize: '0.84rem', color: 'var(--text-main)' }}>Reassign lead to another agent</strong>
                <p style={{ fontSize: '0.74rem', color: 'var(--text-dark)', margin: '2px 0 0' }}>
                  Automatically transfer the lead to the next available agent on your team.
                </p>
              </div>
              {toggle(settings.step3_reassign_lead, () => update('step3_reassign_lead', !settings.step3_reassign_lead), '#dc2626')}
            </div>
          </div>
        )}
      </div>

      {/* Escalation Activity Log */}
      <div style={sectionStyle}>
        <div style={{ ...rowStyle, marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <strong style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>Recent escalation activity</strong>
          </div>
          <button type="button" onClick={refreshLog} style={{
            border: '1px solid var(--border-subtle)', borderRadius: '8px', background: 'var(--bg-card)',
            cursor: 'pointer', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)',
          }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
        {escalationLog.length === 0 ? (
          <p style={{ fontSize: '0.82rem', color: 'var(--text-dark)', textAlign: 'center', padding: '20px' }}>
            No escalations yet. When follow-ups go overdue, you'll see the escalation history here.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {escalationLog.map((log) => (
              <div key={log.id} style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                borderRadius: '8px', background: 'var(--bg-light)', border: '1px solid var(--border-subtle)',
              }}>
                <span style={{
                  fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '5px',
                  background: `${stepColors[log.step]}20`, color: stepColors[log.step], whiteSpace: 'nowrap',
                }}>
                  {stepLabels[log.step]}
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-main)', flex: 1 }}>
                  {log.action.replace(/_/g, ' ')}
                  {log.notified_email && ` → ${log.notified_email}`}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dark)', whiteSpace: 'nowrap' }}>
                  {new Date(log.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '8px', padding: '12px 16px', color: '#dc2626', fontSize: '0.85rem',
          fontWeight: 600, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}
      {saved && (
        <div style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)',
          borderRadius: '8px', padding: '12px 16px', color: '#16a34a', fontSize: '0.85rem',
          fontWeight: 600, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} /> Escalation settings saved.
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
        <button type="button" onClick={handleSave} disabled={saving} style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px',
          border: 'none', borderRadius: '10px',
          background: saving ? 'var(--bg-light)' : '#0891b2', color: saving ? 'var(--text-dark)' : '#fff',
          fontSize: '0.85rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s',
        }}>
          {saving ? <Loader2 size={16} className="crm-spin" /> : <Save size={16} />}
          {saving ? 'Saving…' : 'Save escalation settings'}
        </button>
      </div>
    </>
  );
}
