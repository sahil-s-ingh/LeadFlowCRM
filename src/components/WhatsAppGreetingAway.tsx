import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowLeft, MessageCircle, Moon, Clock, Save, Loader2,
  CheckCircle2, AlertTriangle, Building2, Sun, Plus, X,
} from 'lucide-react';

interface GreetingSettings {
  id: string;
  wa_settings_id: string;
  greeting_enabled: boolean;
  greeting_text: string | null;
  greeting_trigger_keywords: string[];
  away_enabled: boolean;
  away_text: string | null;
  business_hours_enabled: boolean;
  business_hours_start: string;
  business_hours_end: string;
  business_days: number[];
  timezone: string;
}

interface WaNumber {
  id: string;
  label: string | null;
  connected_phone_number: string | null;
  phone_number_id: string | null;
  is_active: boolean;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const COMMON_TZ = ['UTC', 'Asia/Kolkata', 'America/New_York', 'America/Los_Angeles', 'America/Chicago', 'Europe/London', 'Europe/Paris', 'Asia/Dubai', 'Asia/Singapore', 'Australia/Sydney', 'Africa/Johannesburg', 'Asia/Tokyo'];

export default function WhatsAppGreetingAway({ session, onBack }: { session: Session; onBack: () => void }) {
  const [numbers, setNumbers] = useState<WaNumber[]>([]);
  const [selectedNumberId, setSelectedNumberId] = useState<string>('');
  const [settings, setSettings] = useState<GreetingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [keywordInput, setKeywordInput] = useState('');

  // Form state
  const [greetingEnabled, setGreetingEnabled] = useState(false);
  const [greetingText, setGreetingText] = useState('');
  const [greetingKeywords, setGreetingKeywords] = useState<string[]>(['hi', 'hello', 'hey', 'start', 'menu']);
  const [awayEnabled, setAwayEnabled] = useState(false);
  const [awayText, setAwayText] = useState('');
  const [businessHoursEnabled, setBusinessHoursEnabled] = useState(false);
  const [bhStart, setBhStart] = useState('09:00');
  const [bhEnd, setBhEnd] = useState('18:00');
  const [businessDays, setBusinessDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [timezone, setTimezone] = useState('UTC');

  const loadNumbers = useCallback(async () => {
    try {
      const { data, error: err } = await supabase
        .from('whatsapp_settings')
        .select('id, label, connected_phone_number, phone_number_id, is_active')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: true });
      if (err) throw err;
      const nums = (data || []) as WaNumber[];
      setNumbers(nums);
      if (nums.length > 0 && !selectedNumberId) setSelectedNumberId(nums[0].id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load numbers');
    } finally {
      setLoading(false);
    }
  }, [session.user.id, selectedNumberId]);

  useEffect(() => { loadNumbers(); }, [loadNumbers]);

  const loadSettings = useCallback(async () => {
    if (!selectedNumberId) return;
    setError(''); setSuccess('');
    try {
      const { data, error: err } = await supabase
        .from('wa_greeting_settings')
        .select('*')
        .eq('wa_settings_id', selectedNumberId)
        .maybeSingle();
      if (err) throw err;
      if (data) {
        const s = data as GreetingSettings;
        setSettings(s);
        setGreetingEnabled(s.greeting_enabled);
        setGreetingText(s.greeting_text || '');
        setGreetingKeywords(s.greeting_trigger_keywords || ['hi', 'hello', 'hey', 'start', 'menu']);
        setAwayEnabled(s.away_enabled);
        setAwayText(s.away_text || '');
        setBusinessHoursEnabled(s.business_hours_enabled);
        setBhStart(s.business_hours_start || '09:00');
        setBhEnd(s.business_hours_end || '18:00');
        setBusinessDays(s.business_days || [1, 2, 3, 4, 5]);
        setTimezone(s.timezone || 'UTC');
      } else {
        setSettings(null);
        setGreetingEnabled(false);
        setGreetingText('');
        setGreetingKeywords(['hi', 'hello', 'hey', 'start', 'menu']);
        setAwayEnabled(false);
        setAwayText('');
        setBusinessHoursEnabled(false);
        setBhStart('09:00');
        setBhEnd('18:00');
        setBusinessDays([1, 2, 3, 4, 5]);
        setTimezone('UTC');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load settings');
    }
  }, [selectedNumberId]);

  useEffect(() => { if (selectedNumberId) loadSettings(); }, [loadSettings]);

  const handleSave = async () => {
    if (!selectedNumberId) return;
    if (greetingEnabled && !greetingText.trim()) { setError('Greeting message text is required when greeting is enabled.'); return; }
    if (awayEnabled && !awayText.trim()) { setError('Away message text is required when away message is enabled.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const payload = {
        wa_settings_id: selectedNumberId,
        user_id: session.user.id,
        greeting_enabled: greetingEnabled,
        greeting_text: greetingEnabled ? greetingText.trim() : null,
        greeting_trigger_keywords: greetingKeywords,
        away_enabled: awayEnabled,
        away_text: awayEnabled ? awayText.trim() : null,
        business_hours_enabled: businessHoursEnabled,
        business_hours_start: bhStart,
        business_hours_end: bhEnd,
        business_days: businessDays,
        timezone,
        updated_at: new Date().toISOString(),
      };
      if (settings) {
        const { error: err } = await supabase
          .from('wa_greeting_settings')
          .update(payload)
          .eq('id', settings.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase
          .from('wa_greeting_settings')
          .insert(payload);
        if (err) throw err;
      }
      setSuccess('Settings saved successfully. Greeting and away messages will be active for new incoming messages.');
      await loadSettings();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const addKeyword = () => {
    const k = keywordInput.trim().toLowerCase();
    if (k && !greetingKeywords.includes(k)) setGreetingKeywords([...greetingKeywords, k]);
    setKeywordInput('');
  };

  const toggleDay = (day: number) => {
    setBusinessDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort());
  };

  const cardStyle: React.CSSProperties = { background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', padding: '20px' };
  const labelStyle: React.CSSProperties = { fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', display: 'block', color: 'var(--text-main)' };
  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-light)', fontSize: '0.82rem', color: 'var(--text-main)', outline: 'none' };
  const toggleStyle = (on: boolean): React.CSSProperties => ({ width: '40px', height: '22px', borderRadius: '11px', background: on ? '#25D366' : 'var(--border-subtle)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 });

  return (
    <div className="dash-overview">
      <div className="dash-page-header">
        <button className="dash-back-btn" onClick={onBack}><ArrowLeft size={18} /> Back</button>
        <h1>Greeting & Away Messages</h1>
        <p>Automatically reply to customers when they first message you or outside business hours</p>
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
      ) : numbers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
          <Building2 size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
          <p style={{ fontSize: '0.85rem' }}>Connect a WhatsApp number first to configure greeting and away messages.</p>
        </div>
      ) : (
        <>
          {/* Number selector */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Select WhatsApp Number</label>
            <select value={selectedNumberId} onChange={(e) => setSelectedNumberId(e.target.value)} style={inputStyle}>
              {numbers.map((n) => (
                <option key={n.id} value={n.id}>{n.label || n.connected_phone_number || 'Unknown'} {n.is_active ? '' : '(inactive)'}</option>
              ))}
            </select>
          </div>

          {/* Greeting section */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageCircle size={18} style={{ color: '#25D366' }} />
                <strong style={{ fontSize: '0.88rem' }}>Greeting Message</strong>
              </div>
              <div style={toggleStyle(greetingEnabled)} onClick={() => setGreetingEnabled(!greetingEnabled)} role="switch" aria-checked={greetingEnabled}>
                <div style={{ position: 'absolute', top: '2px', left: greetingEnabled ? '20px' : '2px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </div>
            </div>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '0 0 14px' }}>When a customer sends one of your trigger keywords as their first message, this greeting is sent automatically. Great for welcoming new leads.</p>
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Greeting Message</label>
              <textarea style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} rows={3} value={greetingText} onChange={(e) => setGreetingText(e.target.value)} disabled={!greetingEnabled} placeholder="Hi! Thanks for reaching out. How can we help you today?" />
              <small style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>{greetingText.length} / 4096 characters</small>
            </div>
            <div>
              <label style={labelStyle}>Trigger Keywords</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                {greetingKeywords.map((kw) => (
                  <span key={kw} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(37,211,102,0.08)', color: '#25D366', fontSize: '0.72rem', fontWeight: 600 }}>
                    {kw}
                    {greetingEnabled && <button type="button" onClick={() => setGreetingKeywords(greetingKeywords.filter((k) => k !== kw))} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#25D366' }}><X size={12} /></button>}
                  </span>
                ))}
              </div>
              {greetingEnabled && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input style={inputStyle} value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }} placeholder="Add keyword..." />
                  <button type="button" onClick={addKeyword} style={{ padding: '0 12px', border: '1px solid var(--border-subtle)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-muted)', cursor: 'pointer' }}><Plus size={16} /></button>
                </div>
              )}
            </div>
          </div>

          {/* Away section */}
          <div style={{ ...cardStyle, marginTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Moon size={18} style={{ color: '#25D366' }} />
                <strong style={{ fontSize: '0.88rem' }}>Away Message</strong>
              </div>
              <div style={toggleStyle(awayEnabled)} onClick={() => setAwayEnabled(!awayEnabled)} role="switch" aria-checked={awayEnabled}>
                <div style={{ position: 'absolute', top: '2px', left: awayEnabled ? '20px' : '2px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </div>
            </div>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '0 0 14px' }}>When a customer messages you outside your business hours, this away message is sent automatically so they know when to expect a reply.</p>
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Away Message</label>
              <textarea style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} rows={3} value={awayText} onChange={(e) => setAwayText(e.target.value)} disabled={!awayEnabled} placeholder="Thanks for your message! Our team is currently away. We'll get back to you during business hours (Mon-Fri, 9am-6pm)." />
            </div>

            {/* Business hours */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={15} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>Business Hours</span>
              </div>
              <div style={toggleStyle(businessHoursEnabled)} onClick={() => setBusinessHoursEnabled(!businessHoursEnabled)} role="switch" aria-checked={businessHoursEnabled}>
                <div style={{ position: 'absolute', top: '2px', left: businessHoursEnabled ? '20px' : '2px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </div>
            </div>
            {businessHoursEnabled && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                  <div>
                    <label style={labelStyle}>Start Time</label>
                    <input type="time" style={inputStyle} value={bhStart} onChange={(e) => setBhStart(e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>End Time</label>
                    <input type="time" style={inputStyle} value={bhEnd} onChange={(e) => setBhEnd(e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Timezone</label>
                    <select style={inputStyle} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                      {COMMON_TZ.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Working Days</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {DAYS.map((day, idx) => (
                      <button key={day} type="button" onClick={() => toggleDay(idx)} style={{
                        flex: 1, padding: '8px 0', borderRadius: '8px', border: '1px solid var(--border-subtle)',
                        background: businessDays.includes(idx) ? 'rgba(37,211,102,0.08)' : 'var(--bg-light)',
                        color: businessDays.includes(idx) ? '#25D366' : 'var(--text-muted)',
                        fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                      }}>{day}</button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Save */}
          <div style={{ marginTop: '18px' }}>
            <button type="button" onClick={handleSave} disabled={saving} style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 24px', border: 'none', borderRadius: '8px',
              background: saving ? '#94a3b8' : '#25D366', color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
            }}>
              {saving ? <Loader2 size={16} className="crm-spin" /> : <Save size={16} />} Save Settings
            </button>
          </div>
        </>
      )}
    </div>
  );
}
