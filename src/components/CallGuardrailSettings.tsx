import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  ShieldCheck, Loader2, Save, CheckCircle2, AlertTriangle, Plus, X, Clock, Ban, Timer, Mic,
} from 'lucide-react';

type GuardrailSettings = {
  id?: string;
  enabled: boolean;
  dnd_phone_numbers: string[];
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  timezone: string;
  cooldown_enabled: boolean;
  cooldown_minutes: number;
  require_recording_consent: boolean;
};

const DEFAULTS: GuardrailSettings = {
  enabled: false,
  dnd_phone_numbers: [],
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '08:00',
  timezone: 'Asia/Kolkata',
  cooldown_enabled: false,
  cooldown_minutes: 180,
  require_recording_consent: false,
};

const TIMEZONES = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo',
  'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Chicago',
  'America/Los_Angeles', 'Australia/Sydney', 'UTC',
];

export default function CallGuardrailSettings({ userId }: { userId: string }) {
  const [settings, setSettings] = useState<GuardrailSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [newDnd, setNewDnd] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error: qErr } = await supabase
        .from('call_guardrail_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (cancelled) return;
      if (qErr) {
        setError(qErr.message);
        setLoading(false);
        return;
      }
      if (data) {
        setSettings({
          id: data.id,
          enabled: data.enabled ?? false,
          dnd_phone_numbers: data.dnd_phone_numbers ?? [],
          quiet_hours_enabled: data.quiet_hours_enabled ?? false,
          quiet_hours_start: data.quiet_hours_start ?? '22:00',
          quiet_hours_end: data.quiet_hours_end ?? '08:00',
          timezone: data.timezone ?? 'Asia/Kolkata',
          cooldown_enabled: data.cooldown_enabled ?? false,
          cooldown_minutes: data.cooldown_minutes ?? 180,
          require_recording_consent: data.require_recording_consent ?? false,
        });
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const update = <K extends keyof GuardrailSettings>(key: K, value: GuardrailSettings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
    setSaved(false);
  };

  const addDnd = () => {
    const cleaned = newDnd.replace(/[^\d+]/g, '').trim();
    if (!cleaned) return;
    if (settings.dnd_phone_numbers.includes(cleaned)) {
      setNewDnd('');
      return;
    }
    update('dnd_phone_numbers', [...settings.dnd_phone_numbers, cleaned]);
    setNewDnd('');
  };

  const removeDnd = (num: string) => {
    update('dnd_phone_numbers', settings.dnd_phone_numbers.filter((n) => n !== num));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    const payload = {
      user_id: userId,
      enabled: settings.enabled,
      dnd_phone_numbers: settings.dnd_phone_numbers,
      quiet_hours_enabled: settings.quiet_hours_enabled,
      quiet_hours_start: settings.quiet_hours_start,
      quiet_hours_end: settings.quiet_hours_end,
      timezone: settings.timezone,
      cooldown_enabled: settings.cooldown_enabled,
      cooldown_minutes: settings.cooldown_minutes,
      require_recording_consent: settings.require_recording_consent,
      updated_at: new Date().toISOString(),
    };
    try {
      if (settings.id) {
        const { error: uErr } = await supabase
          .from('call_guardrail_settings')
          .update(payload)
          .eq('id', settings.id);
        if (uErr) throw uErr;
      } else {
        const { data, error: iErr } = await supabase
          .from('call_guardrail_settings')
          .insert(payload)
          .select('id')
          .single();
        if (iErr) throw iErr;
        if (data) setSettings((s) => ({ ...s, id: data.id }));
      }
      setSaved(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save settings';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
        <Loader2 size={28} className="crm-spin" style={{ color: '#0f766e' }} />
      </div>
    );
  }

  const sectionStyle: React.CSSProperties = {
    border: '1px solid var(--border-subtle)',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '18px',
    background: 'var(--bg-card)',
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
  };

  const toggle = (on: boolean, onClick: () => void, color = '#0d9488') => (
    <button
      type="button"
      onClick={onClick}
      aria-label="Toggle"
      style={{
        width: '44px', height: '24px', borderRadius: '999px', border: 'none',
        background: on ? color : 'var(--bg-light)', position: 'relative',
        cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: '3px', left: on ? '23px' : '3px',
        width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
      }} />
    </button>
  );

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', border: '1px solid var(--border-subtle)', borderRadius: '8px',
    background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.83rem',
  };

  return (
    <>
      <div className="crm-settings-card-header">
        <h2 className="crm-settings-card-title">
          <ShieldCheck size={20} style={{ color: '#0d9488' }} /> Call Guardrails
        </h2>
        <p className="crm-settings-card-desc">
          Protect your callers and stay compliant. Block calls to specific numbers, enforce quiet hours,
          prevent call-bombing the same lead, and require recording consent — all checked server-side
          before any call connects.
        </p>
      </div>

      {/* Master switch */}
      <div style={{ ...sectionStyle, ...rowStyle }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
            background: settings.enabled ? 'rgba(13,148,136,0.12)' : 'var(--bg-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ShieldCheck size={20} style={{ color: settings.enabled ? '#0d9488' : 'var(--text-dark)' }} />
          </div>
          <div>
            <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>Enable call guardrails</strong>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-dark)', margin: '2px 0 0' }}>
              Master switch. When off, all calls go through regardless of the rules below.
            </p>
          </div>
        </div>
        {toggle(settings.enabled, () => update('enabled', !settings.enabled))}
      </div>

      {/* DND list */}
      <div style={sectionStyle}>
        <div style={rowStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Ban size={18} style={{ color: '#dc2626' }} />
            <div>
              <strong style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>Do-Not-Call list</strong>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-dark)', margin: '2px 0 0' }}>
                Numbers here can never be called, even if a teammate tries.
              </p>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
          <input
            type="tel"
            value={newDnd}
            onChange={(e) => setNewDnd(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDnd(); } }}
            placeholder="+91 98765 43210"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            type="button"
            onClick={addDnd}
            style={{
              padding: '8px 14px', border: '1px solid var(--border-subtle)', borderRadius: '8px',
              background: 'var(--bg-card)', cursor: 'pointer', display: 'flex',
              alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600,
              color: 'var(--text-main)',
            }}
          >
            <Plus size={16} /> Add
          </button>
        </div>
        {settings.dnd_phone_numbers.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
            {settings.dnd_phone_numbers.map((num) => (
              <span
                key={num}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '5px 10px 5px 12px', borderRadius: '999px',
                  background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)',
                  fontSize: '0.78rem', color: '#dc2626', fontWeight: 600,
                }}
              >
                {num}
                <button
                  type="button"
                  onClick={() => removeDnd(num)}
                  aria-label={`Remove ${num}`}
                  style={{
                    border: 'none', background: 'transparent', cursor: 'pointer',
                    color: '#dc2626', display: 'flex', padding: 0,
                  }}
                >
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Quiet hours */}
      <div style={sectionStyle}>
        <div style={rowStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Clock size={18} style={{ color: '#7c3aed' }} />
            <div>
              <strong style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>Quiet hours</strong>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-dark)', margin: '2px 0 0' }}>
                Block all outgoing calls during a set window each day.
              </p>
            </div>
          </div>
          {toggle(settings.quiet_hours_enabled, () => update('quiet_hours_enabled', !settings.quiet_hours_enabled), '#7c3aed')}
        </div>
        {settings.quiet_hours_enabled && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '16px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-dark)', fontWeight: 600 }}>Start</span>
              <input
                type="time"
                value={settings.quiet_hours_start}
                onChange={(e) => update('quiet_hours_start', e.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-dark)', fontWeight: 600 }}>End</span>
              <input
                type="time"
                value={settings.quiet_hours_end}
                onChange={(e) => update('quiet_hours_end', e.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-dark)', fontWeight: 600 }}>Timezone</span>
              <select
                value={settings.timezone}
                onChange={(e) => update('timezone', e.target.value)}
                style={inputStyle}
              >
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </label>
          </div>
        )}
      </div>

      {/* Cooldown */}
      <div style={sectionStyle}>
        <div style={rowStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Timer size={18} style={{ color: '#ea580c' }} />
            <div>
              <strong style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>Per-lead cooldown</strong>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-dark)', margin: '2px 0 0' }}>
                Wait a minimum time between calls to the same lead.
              </p>
            </div>
          </div>
          {toggle(settings.cooldown_enabled, () => update('cooldown_enabled', !settings.cooldown_enabled), '#ea580c')}
        </div>
        {settings.cooldown_enabled && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '16px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dark)', fontWeight: 600 }}>Minimum minutes between calls</span>
            <input
              type="number"
              min={1}
              max={10080}
              value={settings.cooldown_minutes}
              onChange={(e) => update('cooldown_minutes', Math.max(1, parseInt(e.target.value, 10) || 1))}
              style={{ ...inputStyle, width: '90px' }}
            />
            <span style={{ fontSize: '0.76rem', color: 'var(--text-dark)' }}>min</span>
          </label>
        )}
      </div>

      {/* Recording consent */}
      <div style={sectionStyle}>
        <div style={rowStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Mic size={18} style={{ color: '#2563eb' }} />
            <div>
              <strong style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>Require recording consent</strong>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-dark)', margin: '2px 0 0' }}>
                Block recorded calls unless the caller confirms the lead has agreed to be recorded.
              </p>
            </div>
          </div>
          {toggle(settings.require_recording_consent, () => update('require_recording_consent', !settings.require_recording_consent), '#2563eb')}
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '8px', padding: '12px 16px', color: '#dc2626', fontSize: '0.85rem',
          fontWeight: 600, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {saved && (
        <div style={{
          background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)',
          borderRadius: '8px', padding: '12px 16px', color: '#16a34a', fontSize: '0.85rem',
          fontWeight: 600, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <CheckCircle2 size={16} /> Guardrail settings saved.
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px',
            border: 'none', borderRadius: '10px',
            background: saving ? 'var(--bg-light)' : '#0d9488', color: saving ? 'var(--text-dark)' : '#fff',
            fontSize: '0.85rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
          }}
        >
          {saving ? <Loader2 size={16} className="crm-spin" /> : <Save size={16} />}
          {saving ? 'Saving…' : 'Save guardrails'}
        </button>
      </div>
    </>
  );
}
