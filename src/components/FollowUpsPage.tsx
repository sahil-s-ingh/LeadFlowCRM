import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import {
  Bell, BellRing, Clock, CheckCircle2, X, PhoneCall, MessageCircle,
  Loader2, CalendarClock, ArrowLeft, AlertTriangle, Mail, StickyNote,
} from 'lucide-react';

type FollowUp = {
  id: string;
  lead_id: string | null;
  title: string;
  note: string | null;
  reminder_at: string;
  status: 'pending' | 'sent' | 'snoozed' | 'done';
  email_sent_at: string | null;
  created_at: string;
};

type Lead = {
  id: string;
  full_name: string;
  mobile_number: string;
  email: string;
  status: string;
};

type FollowUpFilter = 'all' | 'overdue' | 'upcoming' | 'done';

export default function FollowUpsPage({ session, onBack, onCall }: { session: Session; onBack: () => void; onCall?: (number: string) => void }) {
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [leads, setLeads] = useState<Record<string, Lead>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FollowUpFilter>('overdue');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchFollowups = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('lead_followups')
      .select('*')
      .order('reminder_at', { ascending: true });
    if (error) {
      setLoading(false);
      return;
    }
    setFollowups((data || []) as FollowUp[]);

    const leadIds = [...new Set((data || []).map((f: FollowUp) => f.lead_id).filter(Boolean))] as string[];
    if (leadIds.length > 0) {
      const { data: leadData } = await supabase
        .from('submissions')
        .select('id, full_name, mobile_number, email, status')
        .in('id', leadIds);
      if (leadData) {
        const map: Record<string, Lead> = {};
        for (const l of leadData as Lead[]) {
          map[l.id] = l;
        }
        setLeads(map);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFollowups();
  }, [fetchFollowups]);

  const handleMarkDone = async (id: string) => {
    setActionLoading(id);
    await supabase.from('lead_followups').update({ status: 'done', updated_at: new Date().toISOString() }).eq('id', id);
    setFollowups((prev) => prev.map((f) => f.id === id ? { ...f, status: 'done' } : f));
    setActionLoading(null);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('lead_followups').delete().eq('id', id);
    setFollowups((prev) => prev.filter((f) => f.id !== id));
  };

  const now = Date.now();

  const categorized = followups.map((f) => {
    const isOverdue = f.status === 'pending' && new Date(f.reminder_at).getTime() < now;
    const isUpcoming = f.status === 'pending' && new Date(f.reminder_at).getTime() >= now;
    const isDone = f.status === 'done';
    const isSent = f.status === 'sent';
    return { ...f, _category: isOverdue ? 'overdue' : isUpcoming ? 'upcoming' : isDone ? 'done' : isSent ? 'sent' : 'done' };
  });

  const filtered = categorized.filter((f) => {
    if (filter === 'overdue') return f._category === 'overdue';
    if (filter === 'upcoming') return f._category === 'upcoming';
    if (filter === 'done') return f._category === 'done' || f._category === 'sent';
    return true;
  }).filter((f) => {
    if (!search) return true;
    const lead = f.lead_id ? leads[f.lead_id] : null;
    const name = lead?.full_name || f.title || '';
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const overdueCount = categorized.filter((f) => f._category === 'overdue').length;
  const upcomingCount = categorized.filter((f) => f._category === 'upcoming').length;
  const doneCount = categorized.filter((f) => f._category === 'done' || f._category === 'sent').length;

  const formatRelative = (iso: string) => {
    const d = new Date(iso);
    const diffMs = d.getTime() - now;
    const diffMin = Math.round(diffMs / 60000);
    const diffHr = Math.round(diffMin / 60);
    const diffDay = Math.round(diffHr / 24);
    if (diffMin < 0) {
      if (diffMin > -60) return `${Math.abs(diffMin)} min ago`;
      if (diffHr > -24) return `${Math.abs(diffHr)} hr ago`;
      return `${Math.abs(diffDay)} day${Math.abs(diffDay) !== 1 ? 's' : ''} ago`;
    }
    if (diffMin < 60) return `in ${diffMin} min`;
    if (diffHr < 24) return `in ${diffHr} hr`;
    return `in ${diffDay} day${diffDay !== 1 ? 's' : ''}`;
  };

  const formatFull = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ' at ' +
      d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const filterTabs: { key: FollowUpFilter; label: string; count: number; color: string }[] = [
    { key: 'overdue', label: 'Overdue', count: overdueCount, color: '#ef4444' },
    { key: 'upcoming', label: 'Upcoming', count: upcomingCount, color: '#f59e0b' },
    { key: 'done', label: 'Completed', count: doneCount, color: '#22c55e' },
    { key: 'all', label: 'All', count: followups.length, color: '#64748b' },
  ];

  return (
    <div className="crm-followups-page">
      <div className="crm-followups-header">
        <button className="crm-followups-back" onClick={onBack}>
          <ArrowLeft size={18} /> Back
        </button>
        <div>
          <h1>Follow-Up Reminders</h1>
          <p>Track all upcoming, overdue, and completed follow-up reminders in one place</p>
        </div>
      </div>

      <div className="crm-followups-stats">
        <div className={`crm-followups-stat ${overdueCount > 0 ? 'alert' : ''}`}>
          <div className="crm-followups-stat-icon" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
            <BellRing size={20} />
          </div>
          <div>
            <span className="crm-followups-stat-num">{overdueCount}</span>
            <span className="crm-followups-stat-label">Overdue</span>
          </div>
        </div>
        <div className="crm-followups-stat">
          <div className="crm-followups-stat-icon" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
            <Clock size={20} />
          </div>
          <div>
            <span className="crm-followups-stat-num">{upcomingCount}</span>
            <span className="crm-followups-stat-label">Upcoming</span>
          </div>
        </div>
        <div className="crm-followups-stat">
          <div className="crm-followups-stat-icon" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span className="crm-followups-stat-num">{doneCount}</span>
            <span className="crm-followups-stat-label">Completed</span>
          </div>
        </div>
      </div>

      <div className="crm-followups-toolbar">
        <div className="crm-followups-tabs">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              className={`crm-followups-tab ${filter === tab.key ? 'active' : ''}`}
              onClick={() => setFilter(tab.key)}
              style={filter === tab.key ? { borderBottomColor: tab.color, color: tab.color } : {}}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className="crm-followups-tab-badge"
                  style={{ background: filter === tab.key ? tab.color : 'rgba(100,116,139,0.15)', color: filter === tab.key ? '#fff' : tab.color }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search by lead name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="crm-followups-search"
        />
      </div>

      {loading ? (
        <div className="crm-followups-loading">
          <Loader2 size={28} className="crm-spin" />
          <p>Loading follow-ups...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="crm-followups-empty">
          <CalendarClock size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
          <h3>No follow-ups here</h3>
          <p>{filter === 'overdue' ? 'No overdue reminders. You are all caught up!' : filter === 'upcoming' ? 'No upcoming reminders scheduled.' : filter === 'done' ? 'No completed follow-ups yet.' : 'No follow-up reminders have been set yet.'}</p>
        </div>
      ) : (
        <div className="crm-followups-grid">
          {filtered.map((f) => {
            const lead = f.lead_id ? leads[f.lead_id] : null;
            const leadName = lead?.full_name || f.title?.replace(/^Follow up:\s*/i, '') || 'Lead';
            const isOverdue = f._category === 'overdue';
            const isDone = f._category === 'done' || f._category === 'sent';
            const isSent = f._category === 'sent';
            const phone = lead?.mobile_number && lead.mobile_number !== 'N/A' ? lead.mobile_number : null;
            const borderColor = isOverdue ? '#ef4444' : isDone ? '#22c55e' : '#f59e0b';
            const accentBg = isOverdue ? 'rgba(239,68,68,0.06)' : isDone ? 'rgba(34,197,94,0.06)' : 'rgba(245,158,11,0.06)';

            return (
              <div
                key={f.id}
                className={`crm-followups-card ${isOverdue ? 'overdue' : ''} ${isDone ? 'done' : ''}`}
                style={{ borderLeftColor: borderColor }}
              >
                <div className="crm-followups-card-header">
                  <div className="crm-followups-card-icon" style={{ background: accentBg }}>
                    {isSent ? <Mail size={18} style={{ color: '#6366f1' }} /> :
                     isDone ? <CheckCircle2 size={18} style={{ color: '#22c55e' }} /> :
                     isOverdue ? <BellRing size={18} style={{ color: '#ef4444' }} /> :
                     <Bell size={18} style={{ color: '#f59e0b' }} />}
                  </div>
                  <span className={`crm-followups-card-badge ${isOverdue ? 'overdue' : isDone ? 'done' : 'upcoming'}`}>
                    {isOverdue ? 'Overdue' : isSent ? 'Email Sent' : isDone ? 'Done' : 'Upcoming'}
                  </span>
                </div>

                <h3 className="crm-followups-card-name">{leadName}</h3>

                <div className="crm-followups-card-date">
                  <Clock size={13} />
                  <span>{formatFull(f.reminder_at)}</span>
                  <span
                    className="crm-followups-card-chip"
                    style={{
                      background: isOverdue ? 'rgba(239,68,68,0.1)' : isDone ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                      color: isOverdue ? '#ef4444' : isDone ? '#22c55e' : '#f59e0b',
                    }}
                  >
                    {formatRelative(f.reminder_at)}
                  </span>
                </div>

                {f.note && (
                  <div className="crm-followups-card-note" style={{ borderLeftColor: borderColor }}>
                    <StickyNote size={13} className="crm-followups-card-note-icon" />
                    <p>{f.note}</p>
                  </div>
                )}

                {lead && (lead.email || phone) && (
                  <div className="crm-followups-card-meta">
                    {lead.email && (
                      <span><Mail size={12} /> {lead.email}</span>
                    )}
                    {phone && (
                      <span><PhoneCall size={12} /> {phone}</span>
                    )}
                  </div>
                )}

                <div className="crm-followups-card-actions">
                  {phone && !isDone && (
                    <button type="button" className="crm-followups-action call" onClick={() => { window.location.href = `tel:${phone.replace(/[^+\d]/g, '')}`; }} style={{ cursor: 'pointer', font: 'inherit' }}>
                      <PhoneCall size={14} /> Call
                    </button>
                  )}
                  {phone && !isDone && (
                    <a href={`https://wa.me/${phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="crm-followups-action wa">
                      <MessageCircle size={14} /> WhatsApp
                    </a>
                  )}
                  {!isDone && (
                    <button
                      className="crm-followups-action done"
                      onClick={() => handleMarkDone(f.id)}
                      disabled={actionLoading === f.id}
                    >
                      {actionLoading === f.id ? <Loader2 size={14} className="crm-spin" /> : <CheckCircle2 size={14} />}
                      Done
                    </button>
                  )}
                  <button className="crm-followups-action delete" onClick={() => handleDelete(f.id)}>
                    <X size={14} /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
