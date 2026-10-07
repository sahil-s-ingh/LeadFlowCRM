import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowLeft, RefreshCw, Loader2, Search,
  Phone, PhoneOutgoing, Mail, MessageCircle, StickyNote, Tag,
  UserCheck, CheckCircle2, XCircle, Zap, Activity,
  TrendingUp, Bell, ChevronDown, Calendar, Filter,
} from 'lucide-react';

interface ActivityItem {
  id: string;
  lead_id: string | null;
  activity_type: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
  source: 'lead_activities' | 'email_log' | 'wa_messages' | 'call_logs' | 'lead_followups';
  lead_name?: string;
}

interface LeadActivityTimelineProps {
  session: Session;
  onBack: () => void;
}

const ACTIVITY_ICONS: Record<string, { icon: typeof Phone; color: string; bg: string; border: string; label: string }> = {
  status_change:    { icon: TrendingUp,      color: '#2563EB', bg: 'rgba(37,99,235,0.08)',  border: 'rgba(37,99,235,0.2)',  label: 'Status Change' },
  note:             { icon: StickyNote,      color: '#D97706', bg: 'rgba(217,119,6,0.08)',  border: 'rgba(217,119,6,0.2)',  label: 'Note' },
  email_sent:       { icon: Mail,            color: '#6366F1', bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.2)', label: 'Email Sent' },
  email_opened:     { icon: Mail,            color: '#6366F1', bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.2)', label: 'Email Opened' },
  email_clicked:    { icon: Mail,            color: '#16A34A', bg: 'rgba(22,163,74,0.08)',  border: 'rgba(22,163,74,0.2)',  label: 'Email Clicked' },
  telegram_message: { icon: MessageCircle,   color: '#0891B2', bg: 'rgba(8,145,178,0.08)',  border: 'rgba(8,145,178,0.2)',  label: 'Telegram' },
  whatsapp_message: { icon: MessageCircle,   color: '#16A34A', bg: 'rgba(22,163,74,0.08)',  border: 'rgba(22,163,74,0.2)',  label: 'WhatsApp' },
  follow_up_created:{ icon: Bell,            color: '#D97706', bg: 'rgba(217,119,6,0.08)',  border: 'rgba(217,119,6,0.2)',  label: 'Follow-Up' },
  follow_up_done:   { icon: CheckCircle2,    color: '#16A34A', bg: 'rgba(22,163,74,0.08)',  border: 'rgba(22,163,74,0.2)',  label: 'Follow-Up Done' },
  lead_created:     { icon: Zap,             color: '#2563EB', bg: 'rgba(37,99,235,0.08)',  border: 'rgba(37,99,235,0.2)',  label: 'Lead Created' },
  tag_added:        { icon: Tag,             color: '#0891B2', bg: 'rgba(8,145,178,0.08)',  border: 'rgba(8,145,178,0.2)',  label: 'Tag Added' },
  tag_removed:      { icon: Tag,             color: '#6B7280', bg: 'rgba(107,114,128,0.08)',border: 'rgba(107,114,128,0.2)',label: 'Tag Removed' },
  call:             { icon: PhoneOutgoing,   color: '#2563EB', bg: 'rgba(37,99,235,0.08)',  border: 'rgba(37,99,235,0.2)',  label: 'Call' },
  call_completed:   { icon: CheckCircle2,    color: '#16A34A', bg: 'rgba(22,163,74,0.08)',  border: 'rgba(22,163,74,0.2)',  label: 'Call Completed' },
  call_failed:      { icon: XCircle,         color: '#DC2626', bg: 'rgba(220,38,38,0.08)',  border: 'rgba(220,38,38,0.2)',  label: 'Call Failed' },
  assignment:       { icon: UserCheck,       color: '#0891B2', bg: 'rgba(8,145,178,0.08)',  border: 'rgba(8,145,178,0.2)',  label: 'Assignment' },
  wa_message:       { icon: MessageCircle,   color: '#16A34A', bg: 'rgba(22,163,74,0.08)',  border: 'rgba(22,163,74,0.2)',  label: 'WhatsApp Msg' },
  email:            { icon: Mail,            color: '#6366F1', bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.2)', label: 'Email' },
  followup:         { icon: Bell,            color: '#D97706', bg: 'rgba(217,119,6,0.08)',  border: 'rgba(217,119,6,0.2)',  label: 'Follow-Up' },
};

function getIconConfig(type: string, source: string) {
  return ACTIVITY_ICONS[type] || ACTIVITY_ICONS[source] || ACTIVITY_ICONS[type.replace(/ /g, '_')] || { icon: Activity, color: '#6B7280', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.2)', label: type };
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFullDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' at ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function getDateGroup(iso: string): string {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const input = new Date(d); input.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - input.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'This Week';
  if (diffDays < 30) return 'This Month';
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function LeadActivityTimeline({ session, onBack }: LeadActivityTimelineProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showAll, setShowAll] = useState(false);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const [activitiesRes, emailRes, waRes, callRes, followupRes] = await Promise.all([
        supabase.from('lead_activities').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('email_log').select('id, lead_id, recipient_email, subject, status, sent_at, created_at').order('created_at', { ascending: false }).limit(100),
        supabase.from('wa_messages').select('id, conversation_id, sender, text_content, message_type, created_at').order('created_at', { ascending: false }).limit(100),
        supabase.from('call_logs').select('id, lead_id, lead_name, status, duration, direction, created_at').order('created_at', { ascending: false }).limit(100),
        supabase.from('lead_followups').select('id, lead_id, title, note, status, reminder_at, created_at').order('created_at', { ascending: false }).limit(50),
      ]);

      const merged: ActivityItem[] = [];

      (activitiesRes.data || []).forEach((r: Record<string, unknown>) => {
        merged.push({
          id: r.id as string, lead_id: r.lead_id as string | null, activity_type: r.activity_type as string,
          description: r.description as string, metadata: (r.metadata as Record<string, unknown>) || {},
          created_at: r.created_at as string, source: 'lead_activities',
        });
      });

      (emailRes.data || []).forEach((r: Record<string, unknown>) => {
        merged.push({
          id: r.id as string, lead_id: r.lead_id as string | null,
          activity_type: r.status === 'opened' ? 'email_opened' : r.status === 'clicked' ? 'email_clicked' : 'email_sent',
          description: `Email "${r.subject}" ${r.status === 'opened' ? 'was opened' : r.status === 'clicked' ? 'had a link clicked' : `sent to ${r.recipient_email}`}`,
          metadata: { recipient: r.recipient_email, subject: r.subject, status: r.status },
          created_at: (r.sent_at as string) || (r.created_at as string), source: 'email_log',
        });
      });

      (waRes.data || []).forEach((r: Record<string, unknown>) => {
        merged.push({
          id: r.id as string, lead_id: null, activity_type: 'wa_message',
          description: `${r.sender === 'admin' ? 'You sent' : 'Received'} a WhatsApp ${r.message_type}: ${(r.text_content as string)?.slice(0, 80) || '[media]'}`,
          metadata: { sender: r.sender, message_type: r.message_type },
          created_at: r.created_at as string, source: 'wa_messages',
        });
      });

      (callRes.data || []).forEach((r: Record<string, unknown>) => {
        merged.push({
          id: r.id as string, lead_id: r.lead_id as string | null,
          activity_type: r.status === 'completed' ? 'call_completed' : r.status === 'failed' ? 'call_failed' : 'call',
          description: `${r.direction === 'outbound' ? 'Outbound' : 'Inbound'} call to ${r.lead_name || 'lead'} — ${r.status} (${r.duration}s)`,
          metadata: { status: r.status, duration: r.duration, direction: r.direction },
          created_at: r.created_at as string, source: 'call_logs',
        });
      });

      (followupRes.data || []).forEach((r: Record<string, unknown>) => {
        merged.push({
          id: r.id as string, lead_id: r.lead_id as string | null,
          activity_type: r.status === 'done' ? 'follow_up_done' : 'follow_up_created',
          description: `${r.status === 'done' ? 'Completed' : 'Scheduled'} follow-up: ${r.title}`,
          metadata: { status: r.status, note: r.note, reminder_at: r.reminder_at },
          created_at: r.created_at as string, source: 'lead_followups',
        });
      });

      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setActivities(merged);
    } catch (err) {
      console.error('Failed to load activities:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);

  const filteredActivities = useMemo(() => {
    let result = activities;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((a) => a.description.toLowerCase().includes(q) || a.activity_type.toLowerCase().includes(q));
    }
    if (typeFilter !== 'all') {
      const filterMap: Record<string, string[]> = {
        calls: ['call', 'call_completed', 'call_failed'],
        emails: ['email_sent', 'email_opened', 'email_clicked', 'email'],
        messages: ['telegram_message', 'whatsapp_message', 'wa_message'],
        notes: ['note'],
        followups: ['follow_up_created', 'follow_up_done', 'followup'],
        status: ['status_change', 'lead_created', 'assignment'],
        tags: ['tag_added', 'tag_removed'],
      };
      const types = filterMap[typeFilter] || [typeFilter];
      result = result.filter((a) => types.includes(a.activity_type));
    }
    return result;
  }, [activities, search, typeFilter]);

  const visibleActivities = showAll ? filteredActivities : filteredActivities.slice(0, 50);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    activities.forEach((a) => {
      const cfg = getIconConfig(a.activity_type, a.source);
      counts[cfg.label] = (counts[cfg.label] || 0) + 1;
    });
    return counts;
  }, [activities]);

  const todayCount = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return activities.filter((a) => new Date(a.created_at) >= today).length;
  }, [activities]);

  const groupedActivities = useMemo(() => {
    const groups: { label: string; items: ActivityItem[] }[] = [];
    let currentLabel = '';
    for (const item of visibleActivities) {
      const label = getDateGroup(item.created_at);
      if (label !== currentLabel) {
        groups.push({ label, items: [item] });
        currentLabel = label;
      } else {
        groups[groups.length - 1].items.push(item);
      }
    }
    return groups;
  }, [visibleActivities]);

  const stats = [
    { label: 'Total Activities', value: activities.length, icon: Activity, color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' },
    { label: 'Today', value: todayCount, icon: Zap, color: '#22C55E', bg: 'rgba(34,197,94,0.08)' },
    { label: 'Calls', value: (typeCounts['Call'] || 0) + (typeCounts['Call Completed'] || 0) + (typeCounts['Call Failed'] || 0), icon: Phone, color: '#06B6D4', bg: 'rgba(6,182,212,0.08)' },
    { label: 'Emails', value: (typeCounts['Email Sent'] || 0) + (typeCounts['Email Opened'] || 0) + (typeCounts['Email Clicked'] || 0) + (typeCounts['Email'] || 0), icon: Mail, color: '#6366F1', bg: 'rgba(99,102,241,0.08)' },
    { label: 'Messages', value: (typeCounts['WhatsApp'] || 0) + (typeCounts['WhatsApp Msg'] || 0) + (typeCounts['Telegram'] || 0), icon: MessageCircle, color: '#EF4444', bg: 'rgba(239,68,68,0.08)' },
  ];

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 20px 48px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={onBack}
            aria-label="Go back"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '40px', height: '40px', borderRadius: '10px',
              border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer',
              transition: 'all 0.2s', color: '#475569',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#f8fafc'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#fff'; }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>Activity Timeline</h1>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '2px 0 0', fontWeight: 500 }}>Every call, message, email, note, and status change across all leads</p>
          </div>
        </div>
        <button
          onClick={fetchActivities}
          disabled={loading}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '9px 18px', borderRadius: '10px', border: '1px solid #e2e8f0',
            background: '#fff', color: '#334155', fontSize: '0.84rem', fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
            opacity: loading ? 0.6 : 1,
          }}
          onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#f8fafc'; } }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#fff'; }}
        >
          {loading ? <Loader2 size={15} className="crm-spin" /> : <RefreshCw size={15} />}
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '28px' }}>
        {stats.map((s) => (
          <div
            key={s.label}
            style={{
              padding: '18px 16px', borderRadius: '14px', background: '#fff',
              border: '1px solid #e2e8f0', position: 'relative', overflow: 'hidden',
              transition: 'all 0.25s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.06)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <div style={{
              width: '38px', height: '38px', borderRadius: '10px', display: 'flex',
              alignItems: 'center', justifyContent: 'center', background: s.bg, color: s.color, marginBottom: '12px',
            }}>
              <s.icon size={18} />
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', lineHeight: 1, letterSpacing: '-0.03em' }}>{s.value}</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Main Card */}
      <div style={{
        background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden',
      }}>
        {/* Toolbar */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(59,130,246,0.08)', color: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={16} />
            </div>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Activity Feed</h2>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, background: '#f1f5f9', padding: '2px 8px', borderRadius: '20px' }}>
              {filteredActivities.length}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search activities..."
                style={{
                  paddingLeft: '34px', paddingRight: '12px', padding: '9px 12px 9px 34px',
                  border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '0.82rem',
                  background: '#f8fafc', color: '#334155', outline: 'none', width: '220px',
                  transition: 'all 0.2s',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#93c5fd'; e.currentTarget.style.background = '#fff'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc'; }}
              />
            </div>
            <div style={{ position: 'relative' }}>
              <Filter size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{
                  paddingLeft: '32px', paddingRight: '28px', padding: '9px 28px 9px 32px',
                  border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '0.82rem',
                  background: '#f8fafc', color: '#334155', cursor: 'pointer', outline: 'none',
                  appearance: 'none', WebkitAppearance: 'none',
                }}
              >
                <option value="all">All Types</option>
                <option value="calls">Calls</option>
                <option value="emails">Emails</option>
                <option value="messages">Messages</option>
                <option value="notes">Notes</option>
                <option value="followups">Follow-Ups</option>
                <option value="status">Status & Leads</option>
                <option value="tags">Tags</option>
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ padding: '80px 20px', textAlign: 'center' }}>
            <Loader2 size={28} className="crm-spin" style={{ color: '#3B82F6', marginBottom: '12px' }} />
            <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>Loading activities...</p>
          </div>
        ) : visibleActivities.length === 0 ? (
          <div style={{ padding: '80px 20px', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: '#f1f5f9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              <Activity size={28} style={{ color: '#cbd5e1' }} />
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: 500 }}>No activities found. Try adjusting your filters.</p>
          </div>
        ) : (
          <div style={{ padding: '8px 0' }}>
            {groupedActivities.map((group) => (
              <div key={group.label}>
                {/* Date group header */}
                <div style={{
                  padding: '14px 20px 6px', display: 'flex', alignItems: 'center', gap: '10px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    <Calendar size={12} style={{ color: '#94a3b8' }} />
                    {group.label}
                  </div>
                  <div style={{ flex: 1, height: '1px', background: '#f1f5f9' }} />
                  <span style={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 600 }}>{group.items.length}</span>
                </div>

                {/* Timeline items */}
                {group.items.map((item, idx) => {
                  const cfg = getIconConfig(item.activity_type, item.source);
                  const Icon = cfg.icon;
                  const isLastInGroup = idx === group.items.length - 1;
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex', gap: '14px', padding: '10px 20px',
                        transition: 'background 0.15s', cursor: 'default',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      {/* Timeline rail */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: '36px' }}>
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '10px', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', background: cfg.bg,
                          color: cfg.color, border: `1px solid ${cfg.border}`, transition: 'all 0.2s',
                        }}>
                          <Icon size={16} />
                        </div>
                        {!isLastInGroup && (
                          <div style={{ width: '2px', flex: 1, background: '#f1f5f9', marginTop: '4px', minHeight: '20px' }} />
                        )}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0, paddingBottom: isLastInGroup ? '4px' : '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '4px' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            fontSize: '0.72rem', fontWeight: 700, color: cfg.color, background: cfg.bg,
                            border: `1px solid ${cfg.border}`, padding: '3px 9px', borderRadius: '20px',
                            whiteSpace: 'nowrap', letterSpacing: '0.01em',
                          }}>
                            {cfg.label}
                          </span>
                          <span
                            title={formatFullDate(item.created_at)}
                            style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}
                          >
                            {formatRelativeTime(item.created_at)}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.55, margin: 0, wordBreak: 'break-word' }}>
                          {item.description}
                        </p>
                        {item.metadata && Object.keys(item.metadata).length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                            {Object.entries(item.metadata).slice(0, 3).map(([k, v]) => (
                              v != null && typeof v !== 'object' && (
                                <span key={k} style={{
                                  fontSize: '0.7rem', color: '#64748b', background: '#f8fafc',
                                  border: '1px solid #f1f5f9', padding: '2px 8px', borderRadius: '6px', fontWeight: 500,
                                }}>
                                  {k}: {String(v).slice(0, 50)}
                                </span>
                              )
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* Load more */}
        {!showAll && filteredActivities.length > 50 && (
          <div style={{ padding: '14px', textAlign: 'center', borderTop: '1px solid #f1f5f9' }}>
            <button
              onClick={() => setShowAll(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '8px 20px', borderRadius: '10px', border: '1px solid #e2e8f0',
                background: '#fff', color: '#334155', fontSize: '0.82rem', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#f8fafc'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#fff'; }}
            >
              <ChevronDown size={16} /> Show {filteredActivities.length - 50} more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
