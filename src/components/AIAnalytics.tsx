import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { BarChart3, MessageCircle, Send, Globe, Smile, Frown, Meh, Brain, Loader2, Trash2 } from 'lucide-react';

interface ReplyLog {
  id: string;
  platform: string;
  conversation_id: string | null;
  incoming_text: string | null;
  reply_text: string | null;
  used_kb: boolean;
  kb_entry_titles: string[];
  language: string | null;
  sentiment: string | null;
  confidence: string | null;
  created_at: string;
}

export default function AIAnalytics({ session }: { session: Session | null }) {
  const [logs, setLogs] = useState<ReplyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, usedKb: 0, fallback: 0, whatsapp: 0, telegram: 0, languages: {} as Record<string, number>, sentiments: { positive: 0, negative: 0, neutral: 0 } });
  const [filterKb, setFilterKb] = useState<'all' | 'kb' | 'no_kb'>('all');

  const fetchLogs = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('ai_reply_logs')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (err) throw err;
      const rows = (data || []) as ReplyLog[];
      setLogs(rows);

      const langCounts: Record<string, number> = {};
      const sentCounts = { positive: 0, negative: 0, neutral: 0 };
      let usedKb = 0, fallback = 0, wa = 0, tg = 0;
      for (const r of rows) {
        if (r.used_kb) usedKb++; else fallback++;
        if (r.platform === 'whatsapp') wa++;
        if (r.platform === 'telegram') tg++;
        if (r.language) langCounts[r.language] = (langCounts[r.language] || 0) + 1;
        if (r.sentiment === 'positive') sentCounts.positive++;
        else if (r.sentiment === 'negative') sentCounts.negative++;
        else sentCounts.neutral++;
      }
      setStats({ total: rows.length, usedKb, fallback, whatsapp: wa, telegram: tg, languages: langCounts, sentiments: sentCounts });
    } catch {
      // table might not exist
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleClearLogs = async () => {
    if (!session?.user?.id) return;
    try {
      await supabase.from('ai_reply_logs').delete().eq('user_id', session.user.id);
      fetchLogs();
    } catch { /* best effort */ }
  };

  const filtered = logs.filter((l) => {
    if (filterKb === 'kb') return l.used_kb;
    if (filterKb === 'no_kb') return !l.used_kb;
    return true;
  });

  if (loading) {
    return <div style={{ padding: '48px', textAlign: 'center' }}><Loader2 size={24} className="crm-spin" /></div>;
  }

  if (logs.length === 0) {
    return (
      <div className="crm-table-card" style={{ padding: '40px 24px', textAlign: 'center' }}>
        <BarChart3 size={32} style={{ color: '#94a3b8', marginBottom: '12px' }} />
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted, #64748b)', margin: 0 }}>
          No AI replies logged yet. Once your AI starts replying to customers, you'll see analytics here — total replies, knowledge base usage, languages, sentiment, and recent conversations.
        </p>
      </div>
    );
  }

  const kbRate = stats.total > 0 ? Math.round((stats.usedKb / stats.total) * 100) : 0;

  return (
    <div>
      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <StatCard icon={<BarChart3 size={18} />} label="Total Replies" value={stats.total} color="#2563eb" />
        <StatCard icon={<Brain size={18} />} label="KB Used" value={`${stats.usedKb} (${kbRate}%)`} color="#16a34a" />
        <StatCard icon={<MessageCircle size={18} />} label="WhatsApp" value={stats.whatsapp} color="#25D366" />
        <StatCard icon={<Send size={18} />} label="Telegram" value={stats.telegram} color="#0088cc" />
      </div>

      {/* Sentiment + Language breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
        <div className="crm-table-card" style={{ padding: '18px 20px' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Sentiment Breakdown
          </h3>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <SentimentBadge icon={<Smile size={16} color="#16a34a" />} label="Positive" count={stats.sentiments.positive} total={stats.total} color="#16a34a" />
            <SentimentBadge icon={<Meh size={16} color="#94a3b8" />} label="Neutral" count={stats.sentiments.neutral} total={stats.total} color="#94a3b8" />
            <SentimentBadge icon={<Frown size={16} color="#dc2626" />} label="Negative" count={stats.sentiments.negative} total={stats.total} color="#dc2626" />
          </div>
        </div>
        <div className="crm-table-card" style={{ padding: '18px 20px' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Globe size={16} /> Languages Detected
          </h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {Object.entries(stats.languages).map(([lang, count]) => (
              <span key={lang} style={{ fontSize: '0.75rem', padding: '4px 12px', borderRadius: '20px', background: 'rgba(37,99,235,0.08)', color: '#2563eb', fontWeight: 600 }}>
                {lang.toUpperCase()}: {count}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Recent replies */}
      <div className="crm-table-card" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0 }}>Recent AI Replies</h3>
          <div style={{ display: 'flex', gap: '6px' }}>
            <select value={filterKb} onChange={(e) => setFilterKb(e.target.value as 'all' | 'kb' | 'no_kb')} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border, #e2e8f0)', background: 'var(--bg-input, #fff)', fontSize: '0.75rem' }}>
              <option value="all">All Replies</option>
              <option value="kb">KB Used</option>
              <option value="no_kb">No KB</option>
            </select>
            <button onClick={handleClearLogs} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.04)', color: '#dc2626', cursor: 'pointer', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
              <Trash2 size={12} /> Clear
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '500px', overflowY: 'auto' }}>
          {filtered.map((log) => (
            <div key={log.id} style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border, #e2e8f0)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '20px', background: log.platform === 'whatsapp' ? 'rgba(37,211,102,0.1)' : 'rgba(0,136,204,0.1)', color: log.platform === 'whatsapp' ? '#16a34a' : '#0088cc', fontWeight: 600, textTransform: 'capitalize' }}>{log.platform}</span>
                <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '20px', background: log.used_kb ? 'rgba(34,197,94,0.1)' : 'rgba(148,163,184,0.1)', color: log.used_kb ? '#16a34a' : '#94a3b8', fontWeight: 600 }}>{log.used_kb ? 'KB used' : 'No KB'}</span>
                {log.language && <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '20px', background: 'rgba(37,99,235,0.08)', color: '#2563eb', fontWeight: 600 }}>{log.language.toUpperCase()}</span>}
                {log.sentiment && <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '20px', background: log.sentiment === 'negative' ? 'rgba(239,68,68,0.08)' : log.sentiment === 'positive' ? 'rgba(34,197,94,0.08)' : 'rgba(148,163,184,0.1)', color: log.sentiment === 'negative' ? '#dc2626' : log.sentiment === 'positive' ? '#16a34a' : '#94a3b8', fontWeight: 600, textTransform: 'capitalize' }}>{log.sentiment}</span>}
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #64748b)', marginLeft: 'auto' }}>{new Date(log.created_at).toLocaleString()}</span>
              </div>
              <div style={{ fontSize: '0.8rem', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>Customer: </span>
                <span>{log.incoming_text?.slice(0, 150)}{(log.incoming_text?.length || 0) > 150 ? '...' : ''}</span>
              </div>
              <div style={{ fontSize: '0.8rem' }}>
                <span style={{ color: '#7c3aed', fontWeight: 600 }}>AI: </span>
                <span>{log.reply_text?.slice(0, 200)}{(log.reply_text?.length || 0) > 200 ? '...' : ''}</span>
              </div>
              {log.kb_entry_titles.length > 0 && (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {log.kb_entry_titles.map((t) => (
                    <span key={t} style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(37,99,235,0.06)', color: '#2563eb' }}>{t}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="crm-table-card" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function SentimentBadge({ icon, label, count, total, color }: { icon: React.ReactNode; label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '8px 14px', borderRadius: '10px', background: `${color}08` }}>
      {icon}
      <span style={{ fontSize: '0.75rem', fontWeight: 600, color }}>{label}: {count} ({pct}%)</span>
    </div>
  );
}
