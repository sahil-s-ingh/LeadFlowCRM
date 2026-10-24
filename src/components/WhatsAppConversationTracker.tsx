import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowLeft, Clock, MessageCircle, AlertTriangle, CheckCircle2,
  Loader2, RefreshCw, Users, Phone, Search,
} from 'lucide-react';

interface WaConversation {
  id: string;
  wa_phone_number: string;
  wa_name: string | null;
  wa_wa_id: string | null;
  profile_pic_url: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
  last_customer_message_at: string | null;
  unread_count: number;
  wa_settings_id: string | null;
  labels: string[];
}

interface WaNumber {
  id: string;
  label: string | null;
  connected_phone_number: string | null;
  phone_number_id: string | null;
  is_active: boolean;
}

const WINDOW_HOURS = 24;

function getTimeRemaining(lastAt: string | null): { remaining: number; expired: boolean; pct: number } {
  if (!lastAt) return { remaining: 0, expired: true, pct: 0 };
  const elapsed = Date.now() - new Date(lastAt).getTime();
  const windowMs = WINDOW_HOURS * 60 * 60 * 1000;
  const remaining = windowMs - elapsed;
  const expired = remaining <= 0;
  const pct = Math.max(0, Math.min(100, (remaining / windowMs) * 100));
  return { remaining, expired, pct };
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Expired';
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function WhatsAppConversationTracker({ session, onBack }: { session: Session; onBack: () => void }) {
  const [conversations, setConversations] = useState<WaConversation[]>([]);
  const [numbers, setNumbers] = useState<WaNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNumber, setSelectedNumber] = useState<string>('all');
  const [filter, setFilter] = useState<'all' | 'active' | 'expiring' | 'expired'>('all');
  const [search, setSearch] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [convRes, numRes] = await Promise.all([
        supabase
          .from('wa_conversations')
          .select('id, wa_phone_number, wa_name, wa_wa_id, profile_pic_url, last_message_text, last_message_at, last_customer_message_at, unread_count, wa_settings_id, labels')
          .eq('user_id', session.user.id)
          .order('last_message_at', { ascending: false, nullsFirst: false })
          .limit(500),
        supabase
          .from('whatsapp_settings')
          .select('id, label, connected_phone_number, phone_number_id, is_active')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: true }),
      ]);

      if (convRes.error) throw convRes.error;
      if (numRes.error) throw numRes.error;

      setConversations((convRes.data || []) as WaConversation[]);
      setNumbers((numRes.data || []) as WaNumber[]);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [session.user.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = conversations.filter((c) => {
    if (selectedNumber !== 'all' && c.wa_settings_id !== selectedNumber) return false;
    const { remaining, expired } = getTimeRemaining(c.last_customer_message_at || c.last_message_at);
    if (filter === 'active' && (expired || remaining < 2 * 60 * 60 * 1000)) return false;
    if (filter === 'expiring' && (expired || remaining >= 2 * 60 * 60 * 1000)) return false;
    if (filter === 'expired' && !expired) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!c.wa_phone_number.toLowerCase().includes(q) && !(c.wa_name || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const stats = {
    total: conversations.length,
    active: conversations.filter((c) => { const r = getTimeRemaining(c.last_customer_message_at || c.last_message_at); return !r.expired && r.remaining >= 2 * 60 * 60 * 1000; }).length,
    expiring: conversations.filter((c) => { const r = getTimeRemaining(c.last_customer_message_at || c.last_message_at); return !r.expired && r.remaining < 2 * 60 * 60 * 1000; }).length,
    expired: conversations.filter((c) => getTimeRemaining(c.last_customer_message_at || c.last_message_at).expired).length,
  };

  const cardStyle: React.CSSProperties = { background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', padding: '16px' };
  const statCardStyle: React.CSSProperties = { ...cardStyle, display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 };

  return (
    <div className="dash-overview">
      <div className="dash-page-header">
        <button className="dash-back-btn" onClick={onBack}><ArrowLeft size={18} /> Back</button>
        <h1>Conversation Window Tracker</h1>
        <p>See which customer conversations are still within the 24-hour reply window</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={statCardStyle}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(37,99,235,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <MessageCircle size={20} style={{ color: '#2563EB' }} />
          </div>
          <div><div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>{stats.total}</div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Total Conversations</div></div>
        </div>
        <div style={statCardStyle}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(34,197,94,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CheckCircle2 size={20} style={{ color: '#15803d' }} />
          </div>
          <div><div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>{stats.active}</div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Active Window</div></div>
        </div>
        <div style={statCardStyle}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(234,179,8,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Clock size={20} style={{ color: '#a16207' }} />
          </div>
          <div><div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>{stats.expiring}</div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Expiring (&lt;2h)</div></div>
        </div>
        <div style={statCardStyle}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertTriangle size={20} style={{ color: '#b91c1c' }} />
          </div>
          <div><div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>{stats.expired}</div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Window Expired</div></div>
        </div>
      </div>

      {/* Info banner */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '14px 16px', marginBottom: '16px', background: 'rgba(37,211,102,0.04)', borderRadius: '10px', border: '1px solid rgba(37,211,102,0.15)' }}>
        <MessageCircle size={16} style={{ color: '#25D366', flexShrink: 0, marginTop: '1px' }} />
        <div style={{ fontSize: '0.76rem', color: 'var(--text-dark)', lineHeight: 1.55 }}>
          WhatsApp's <strong>24-hour customer service window</strong> lets you send free-form messages to customers for 24 hours after their last message.
          Once the window expires, you can only send approved template messages. Reply promptly to keep windows open!
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={selectedNumber} onChange={(e) => setSelectedNumber(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.82rem', cursor: 'pointer' }}>
          <option value="all">All Numbers</option>
          {numbers.map((n) => (
            <option key={n.id} value={n.id}>{n.label || n.connected_phone_number || 'Unknown Number'}</option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)', padding: '2px' }}>
          {([['all', 'All'], ['active', 'Active'], ['expiring', 'Expiring'], ['expired', 'Expired']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)} style={{
              padding: '6px 14px', borderRadius: '6px', border: 'none', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer',
              background: filter === key ? '#25D366' : 'transparent', color: filter === key ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}>{label}</button>
          ))}
        </div>
        <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or phone..." style={{ width: '100%', paddingLeft: '34px', paddingRight: '12px', paddingY: '8px', paddingBlock: '8px', paddingInlineStart: '34px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.82rem', outline: 'none' }} />
        </div>
        <button onClick={loadData} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
          {loading ? <Loader2 size={15} className="crm-spin" /> : <RefreshCw size={15} />} Refresh
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
          <Loader2 size={28} className="crm-spin" style={{ marginBottom: 12, color: '#25D366' }} />
          <p style={{ fontSize: '0.85rem' }}>Loading conversations...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
          <Users size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
          <p style={{ fontSize: '0.85rem' }}>No conversations match your filters.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map((c) => {
            const { remaining, expired, pct } = getTimeRemaining(c.last_customer_message_at || c.last_message_at);
            const barColor = expired ? '#ef4444' : pct < 20 ? '#f59e0b' : '#22c55e';
            const numberLabel = numbers.find((n) => n.id === c.wa_settings_id)?.label || numbers.find((n) => n.id === c.wa_settings_id)?.connected_phone_number || '';
            return (
              <div key={c.id} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px' }}>
                {/* Avatar */}
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(37,211,102,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                  {c.profile_pic_url ? (
                    <img src={c.profile_pic_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#25D366' }}>{(c.wa_name || c.wa_phone_number || '?')[0]?.toUpperCase()}</span>
                  )}
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.wa_name || c.wa_phone_number}</span>
                    {c.unread_count > 0 && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '18px', height: '18px', borderRadius: '9px', background: '#25D366', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '0 4px' }}>{c.unread_count}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    <Phone size={11} /> {c.wa_phone_number}
                    {numberLabel && <span style={{ padding: '1px 6px', borderRadius: '4px', background: 'rgba(37,211,102,0.08)', color: '#25D366', fontSize: '0.65rem', fontWeight: 600 }}>{numberLabel}</span>}
                  </div>
                  {c.last_message_text && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dark)', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>{c.last_message_text}</div>
                  )}
                </div>
                {/* Window bar */}
                <div style={{ width: '160px', flexShrink: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: expired ? '#b91c1c' : pct < 20 ? '#a16207' : '#15803d' }}>
                      {expired ? 'Expired' : 'Window'}
                    </span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: expired ? '#b91c1c' : 'var(--text-muted)' }}>{formatRemaining(remaining)}</span>
                  </div>
                  <div style={{ height: '6px', borderRadius: '3px', background: 'var(--bg-light)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: '3px', transition: 'width 0.3s' }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* tick is used to force re-render every minute for countdown */}
      <span style={{ display: 'none' }} aria-hidden="true">{tick}</span>
    </div>
  );
}
