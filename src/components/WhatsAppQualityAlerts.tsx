import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowLeft, ShieldAlert, Bell, Mail, Save, Loader2, CheckCircle2,
  AlertTriangle, TrendingDown, Activity, Clock, ChevronRight,
} from 'lucide-react';

interface QualityAlertSettings {
  id: string;
  email_alerts_enabled: boolean;
  alert_email: string | null;
  in_app_alerts_enabled: boolean;
  alert_on_yellow: boolean;
  alert_on_red: boolean;
  alert_on_tier_downgrade: boolean;
  last_alerted_quality: string | null;
  last_alerted_at: string | null;
}

interface QualityHistory {
  id: string;
  wa_settings_id: string;
  quality_rating: string;
  messaging_limit_tier: string | null;
  checked_at: string;
}

interface WaNumber {
  id: string;
  label: string | null;
  connected_phone_number: string | null;
  quality_rating: string | null;
  messaging_limit_tier: string | null;
}

const QUALITY_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  GREEN: { label: 'Green', color: '#15803d', bg: 'rgba(34,197,94,0.08)', icon: CheckCircle2 },
  YELLOW: { label: 'Yellow', color: '#a16207', bg: 'rgba(234,179,8,0.08)', icon: AlertTriangle },
  RED: { label: 'Red', color: '#b91c1c', bg: 'rgba(239,68,68,0.08)', icon: ShieldAlert },
};

export default function WhatsAppQualityAlerts({ session, onBack }: { session: Session; onBack: () => void }) {
  const [settings, setSettings] = useState<QualityAlertSettings | null>(null);
  const [numbers, setNumbers] = useState<WaNumber[]>([]);
  const [history, setHistory] = useState<QualityHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedNumberId, setSelectedNumberId] = useState<string>('');

  // Form state
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [alertEmail, setAlertEmail] = useState('');
  const [inAppAlerts, setInAppAlerts] = useState(true);
  const [alertOnYellow, setAlertOnYellow] = useState(true);
  const [alertOnRed, setAlertOnRed] = useState(true);
  const [alertOnTierDowngrade, setAlertOnTierDowngrade] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [settingsRes, numbersRes] = await Promise.all([
        supabase
          .from('wa_quality_alert_settings')
          .select('*')
          .eq('user_id', session.user.id)
          .maybeSingle(),
        supabase
          .from('whatsapp_settings')
          .select('id, label, connected_phone_number, quality_rating, messaging_limit_tier')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: true }),
      ]);

      if (settingsRes.error) throw settingsRes.error;
      if (numbersRes.error) throw numbersRes.error;

      setNumbers((numbersRes.data || []) as WaNumber[]);
      if (numbersRes.data && numbersRes.data.length > 0) setSelectedNumberId(numbersRes.data[0].id);

      if (settingsRes.data) {
        const s = settingsRes.data as QualityAlertSettings;
        setSettings(s);
        setEmailAlerts(s.email_alerts_enabled);
        setAlertEmail(s.alert_email || '');
        setInAppAlerts(s.in_app_alerts_enabled);
        setAlertOnYellow(s.alert_on_yellow);
        setAlertOnRed(s.alert_on_red);
        setAlertOnTierDowngrade(s.alert_on_tier_downgrade);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [session.user.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadHistory = useCallback(async () => {
    if (!selectedNumberId) return;
    try {
      const { data, error: err } = await supabase
        .from('wa_quality_history')
        .select('id, wa_settings_id, quality_rating, messaging_limit_tier, checked_at')
        .eq('wa_settings_id', selectedNumberId)
        .order('checked_at', { ascending: false })
        .limit(20);
      if (err) throw err;
      setHistory((data || []) as QualityHistory[]);
    } catch {
      setHistory([]);
    }
  }, [selectedNumberId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleSave = async () => {
    if (emailAlerts && !alertEmail.trim()) { setError('Alert email is required when email alerts are enabled.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const payload = {
        user_id: session.user.id,
        email_alerts_enabled: emailAlerts,
        alert_email: emailAlerts ? alertEmail.trim() : null,
        in_app_alerts_enabled: inAppAlerts,
        alert_on_yellow: alertOnYellow,
        alert_on_red: alertOnRed,
        alert_on_tier_downgrade: alertOnTierDowngrade,
        updated_at: new Date().toISOString(),
      };
      if (settings) {
        const { error: err } = await supabase
          .from('wa_quality_alert_settings')
          .update(payload)
          .eq('id', settings.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase
          .from('wa_quality_alert_settings')
          .insert(payload);
        if (err) throw err;
      }
      setSuccess('Alert preferences saved. You\'ll be notified when your number quality changes.');
      await loadData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const cardStyle: React.CSSProperties = { background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', padding: '20px' };
  const labelStyle: React.CSSProperties = { fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', display: 'block', color: 'var(--text-main)' };
  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-light)', fontSize: '0.82rem', color: 'var(--text-main)', outline: 'none' };
  const toggleStyle = (on: boolean): React.CSSProperties => ({ width: '40px', height: '22px', borderRadius: '11px', background: on ? '#25D366' : 'var(--border-subtle)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 });

  return (
    <div className="dash-overview">
      <div className="dash-page-header">
        <button className="dash-back-btn" onClick={onBack}><ArrowLeft size={18} /> Back</button>
        <h1>Quality Health Alerts</h1>
        <p>Get notified when your WhatsApp number quality rating drops or messaging tier changes</p>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', marginBottom: '12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: '#dc2626', fontSize: '0.78rem' }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}
      {success && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', marginBottom: '12px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '8px', color: '#15803d', fontSize: '0.78rem' }}>
          <CheckCircle2 size={14} /> {success}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
          <Loader2 size={28} className="crm-spin" style={{ marginBottom: 12, color: '#25D366' }} />
        </div>
      ) : (
        <>
          {/* Current quality status */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Activity size={18} style={{ color: '#25D366' }} />
              <strong style={{ fontSize: '0.88rem' }}>Current Number Quality</strong>
            </div>
            {numbers.length === 0 ? (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No WhatsApp numbers connected yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {numbers.map((n) => {
                  const rating = (n.quality_rating || 'UNKNOWN').toUpperCase();
                  const qc = QUALITY_CONFIG[rating] || { label: 'Unknown', color: 'var(--text-muted)', bg: 'var(--bg-light)', icon: Clock };
                  const QIcon = qc.icon;
                  return (
                    <div key={n.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'var(--bg-light)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: qc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <QIcon size={20} style={{ color: qc.color }} />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>{n.label || n.connected_phone_number || 'Unknown'}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{n.connected_phone_number || ''}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {n.messaging_limit_tier && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{n.messaging_limit_tier}</span>
                        )}
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 12px', borderRadius: '9999px', background: qc.bg, color: qc.color, fontSize: '0.72rem', fontWeight: 700 }}>
                          <QIcon size={13} /> {qc.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quality history chart */}
          {numbers.length > 0 && (
            <div style={{ ...cardStyle, marginTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingDown size={18} style={{ color: '#25D366' }} />
                  <strong style={{ fontSize: '0.88rem' }}>Quality History</strong>
                </div>
                <select value={selectedNumberId} onChange={(e) => setSelectedNumberId(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: '160px' }}>
                  {numbers.map((n) => (
                    <option key={n.id} value={n.id}>{n.label || n.connected_phone_number || 'Unknown'}</option>
                  ))}
                </select>
              </div>
              {history.length === 0 ? (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No quality checks recorded yet. Quality is checked when you use the "Check Status" feature.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {history.map((h) => {
                    const rating = (h.quality_rating || 'UNKNOWN').toUpperCase();
                    const qc = QUALITY_CONFIG[rating] || { label: 'Unknown', color: 'var(--text-muted)', bg: 'var(--bg-light)', icon: Clock };
                    const QIcon = qc.icon;
                    return (
                      <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-light)' }}>
                        <QIcon size={16} style={{ color: qc.color, flexShrink: 0 }} />
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: qc.color }}>{qc.label}</span>
                        {h.messaging_limit_tier && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{h.messaging_limit_tier}</span>}
                        <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {new Date(h.checked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at {new Date(h.checked_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Alert preferences */}
          <div style={{ ...cardStyle, marginTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Bell size={18} style={{ color: '#25D366' }} />
              <strong style={{ fontSize: '0.88rem' }}>Alert Preferences</strong>
            </div>

            {/* Email alerts */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Mail size={16} style={{ color: 'var(--text-muted)' }} />
                <div><div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>Email Alerts</div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Receive quality alerts via email</div></div>
              </div>
              <div style={toggleStyle(emailAlerts)} onClick={() => setEmailAlerts(!emailAlerts)} role="switch" aria-checked={emailAlerts}>
                <div style={{ position: 'absolute', top: '2px', left: emailAlerts ? '20px' : '2px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </div>
            </div>
            {emailAlerts && (
              <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <label style={labelStyle}>Alert Email Address</label>
                <input style={inputStyle} value={alertEmail} onChange={(e) => setAlertEmail(e.target.value)} placeholder="alerts@yourcompany.com" />
              </div>
            )}

            {/* In-app alerts */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Bell size={16} style={{ color: 'var(--text-muted)' }} />
                <div><div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>In-App Alerts</div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Show alerts in the CRM dashboard</div></div>
              </div>
              <div style={toggleStyle(inAppAlerts)} onClick={() => setInAppAlerts(!inAppAlerts)} role="switch" aria-checked={inAppAlerts}>
                <div style={{ position: 'absolute', top: '2px', left: inAppAlerts ? '20px' : '2px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </div>
            </div>

            {/* Alert triggers */}
            <div style={{ padding: '12px 0' }}>
              <label style={labelStyle}>Alert Me When...</label>
              {([
                ['alertOnYellow', alertOnYellow, setAlertOnYellow, 'Quality drops to Yellow', 'Number quality is below standard — reduce messaging volume', '#a16207', 'rgba(234,179,8,0.08)'],
                ['alertOnRed', alertOnRed, setAlertOnRed, 'Quality drops to Red', 'Number is at risk of being flagged — stop bulk messaging immediately', '#b91c1c', 'rgba(239,68,68,0.08)'],
                ['alertOnTierDowngrade', alertOnTierDowngrade, setAlertOnTierDowngrade, 'Messaging tier is downgraded', 'Daily messaging limit has been reduced by Meta', '#2563EB', 'rgba(37,99,235,0.08)'],
              ] as const).map(([key, val, setter, title, desc, color, bg]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', marginBottom: '6px', borderRadius: '8px', border: `1px solid ${bg}`, background: bg, cursor: 'pointer' }} onClick={() => setter(!val)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <ChevronRight size={16} style={{ color, flexShrink: 0 }} />
                    <div><div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)' }}>{title}</div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{desc}</div></div>
                  </div>
                  <div style={toggleStyle(val)} onClick={(e: React.MouseEvent) => { e.stopPropagation(); setter(!val); }} role="switch" aria-checked={val}>
                    <div style={{ position: 'absolute', top: '2px', left: val ? '20px' : '2px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Save */}
          <div style={{ marginTop: '18px' }}>
            <button type="button" onClick={handleSave} disabled={saving} style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 24px', border: 'none', borderRadius: '8px',
              background: saving ? '#94a3b8' : '#25D366', color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
            }}>
              {saving ? <Loader2 size={16} className="crm-spin" /> : <Save size={16} />} Save Preferences
            </button>
          </div>
        </>
      )}
    </div>
  );
}
