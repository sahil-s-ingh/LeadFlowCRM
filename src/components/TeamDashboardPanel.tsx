import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import {
  Users, Loader2, TrendingUp, Clock, CheckCircle2,
  Mail, MessageCircle, StickyNote, Bell, Activity, ChevronDown, ChevronUp,
  UserCheck, AlertCircle, PhoneCall, FileText, Tag, GitMerge,
  Trophy, Medal, AlertTriangle, Calendar, Radio, LogIn,
} from 'lucide-react';

type TeamMember = {
  id: string;
  owner_id: string;
  email: string;
  role: 'admin' | 'manager' | 'agent';
  full_name: string | null;
  status: 'pending' | 'active' | 'disabled';
  created_at: string;
  last_seen_at: string | null;
  last_login_at: string | null;
};

type LeadRow = {
  id: string;
  full_name: string;
  status: string;
  assigned_to: string | null;
  fund_amount: number | null;
  created_at: string;
  last_contacted_at: string | null;
};

type ActivityRow = {
  id: string;
  user_id: string;
  lead_id: string | null;
  activity_type: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

type FollowUpRow = {
  id: string;
  lead_id: string | null;
  title: string;
  note: string | null;
  reminder_at: string;
  status: string;
  created_at: string;
};

type MemberStats = {
  member: TeamMember;
  totalLeads: number;
  newLeads: number;
  contactedLeads: number;
  interestedLeads: number;
  convertedLeads: number;
  notInterestedLeads: number;
  convertedFunds: number;
  pendingFollowups: number;
  overdueFollowups: number;
  recentActivities: ActivityRow[];
  lastActivityAt: string | null;
  periodActivities: number;
  periodConversions: number;
  conversionRate: number;
};

type TimeRange = 'today' | '7d' | '30d' | 'all';

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  admin: { bg: 'rgba(220,38,38,0.1)', text: '#dc2626', border: 'rgba(220,38,38,0.3)' },
  manager: { bg: 'rgba(37,99,235,0.1)', text: '#2563eb', border: 'rgba(37,99,235,0.3)' },
  agent: { bg: 'rgba(100,116,139,0.1)', text: 'var(--text-dark)', border: 'rgba(100,116,139,0.3)' },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  new: { bg: 'rgba(37,99,235,0.1)', text: '#2563eb' },
  called_no_response: { bg: 'rgba(234,179,8,0.1)', text: '#a16207' },
  called_responded: { bg: 'rgba(13,148,136,0.1)', text: '#0d9488' },
  interested: { bg: 'rgba(124,58,237,0.1)', text: '#7c3aed' },
  not_interested: { bg: 'rgba(239,68,68,0.1)', text: '#dc2626' },
  converted: { bg: 'rgba(22,163,74,0.1)', text: '#16a34a' },
};

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  status_change: <GitMerge size={14} style={{ color: '#2563eb' }} />,
  note: <StickyNote size={14} style={{ color: 'var(--text-dark)' }} />,
  email_sent: <Mail size={14} style={{ color: '#2563eb' }} />,
  telegram_message: <MessageCircle size={14} style={{ color: '#0088cc' }} />,
  whatsapp_message: <MessageCircle size={14} style={{ color: '#25D366' }} />,
  follow_up_created: <Bell size={14} style={{ color: '#eab308' }} />,
  follow_up_done: <CheckCircle2 size={14} style={{ color: '#16a34a' }} />,
  lead_created: <UserCheck size={14} style={{ color: '#2563eb' }} />,
  tag_added: <Tag size={14} style={{ color: '#7c3aed' }} />,
  tag_removed: <Tag size={14} style={{ color: '#dc2626' }} />,
  call: <PhoneCall size={14} style={{ color: '#0d9488' }} />,
  assignment: <Users size={14} style={{ color: 'var(--text-dark)' }} />,
};

const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
  { key: 'all', label: 'All Time' },
];

function getRangeStart(range: TimeRange): number | null {
  if (range === 'all') return null;
  const now = Date.now();
  if (range === 'today') {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  if (range === '7d') return now - 7 * 24 * 60 * 60 * 1000;
  if (range === '30d') return now - 30 * 24 * 60 * 60 * 1000;
  return null;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

function isOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS;
}

function formatLastLogin(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function TeamDashboardPanel({ session }: { session: Session }) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [memberStats, setMemberStats] = useState<MemberStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [nowTick, setNowTick] = useState(0);

  // Re-render every 30s so online/offline status stays fresh without refetching
  useEffect(() => {
    const t = setInterval(() => setNowTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [teamRes, leadsRes, activitiesRes, followupsRes] = await Promise.all([
        supabase.from('team_members').select('*').order('created_at', { ascending: false }),
        supabase.from('submissions').select('id, full_name, status, assigned_to, fund_amount, created_at, last_contacted_at').is('deleted_at', null),
        supabase.from('lead_activities').select('id, user_id, lead_id, activity_type, description, metadata, created_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('lead_followups').select('id, lead_id, title, note, reminder_at, status, created_at').order('reminder_at', { ascending: true }),
      ]);

      if (teamRes.error) throw teamRes.error;

      const teamMembers = (teamRes.data || []) as TeamMember[];
      const allLeads = (leadsRes.data || []) as LeadRow[];
      const allActivities = (activitiesRes.data || []) as ActivityRow[];
      const allFollowups = (followupsRes.data || []) as FollowUpRow[];

      setMembers(teamMembers);

      const rangeStart = getRangeStart(timeRange);
      const now = Date.now();

      const stats: MemberStats[] = teamMembers.map((member) => {
        const memberLeads = allLeads.filter((l) => l.assigned_to === member.id);
        const converted = memberLeads.filter((l) => l.status === 'converted');
        const convertedFunds = converted.reduce((sum, l) => sum + (l.fund_amount || 0), 0);
        const memberFollowups = allFollowups.filter((f) => memberLeads.some((l) => l.id === f.lead_id) && f.status === 'pending');
        const overdueFollowups = memberFollowups.filter((f) => new Date(f.reminder_at).getTime() < now);

        const memberActivities = allActivities
          .filter((a) => memberLeads.some((l) => l.id === a.lead_id));

        const periodActivities = rangeStart
          ? memberActivities.filter((a) => new Date(a.created_at).getTime() >= rangeStart).length
          : memberActivities.length;

        const periodConverted = rangeStart
          ? converted.filter((l) => l.last_contacted_at && new Date(l.last_contacted_at).getTime() >= rangeStart).length
          : converted.length;

        const recentActivities = memberActivities.slice(0, 8);
        const lastActivity = memberActivities.length > 0 ? memberActivities[0].created_at : null;
        const conversionRate = memberLeads.length > 0 ? (converted.length / memberLeads.length) * 100 : 0;

        return {
          member,
          totalLeads: memberLeads.length,
          newLeads: memberLeads.filter((l) => l.status === 'new').length,
          contactedLeads: memberLeads.filter((l) => l.status === 'called_no_response' || l.status === 'called_responded').length,
          interestedLeads: memberLeads.filter((l) => l.status === 'interested').length,
          convertedLeads: converted.length,
          notInterestedLeads: memberLeads.filter((l) => l.status === 'not_interested').length,
          convertedFunds,
          pendingFollowups: memberFollowups.length,
          overdueFollowups: overdueFollowups.length,
          recentActivities,
          lastActivityAt: lastActivity,
          periodActivities,
          periodConversions: periodConverted,
          conversionRate,
        };
      });

      setMemberStats(stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
        <Loader2 size={28} className="crm-spin" style={{ color: '#0f766e' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px 16px', color: '#dc2626', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <AlertCircle size={16} /> {error}
      </div>
    );
  }

  const activeMembers = memberStats.filter((s) => s.member.status === 'active');
  const pendingMembers = memberStats.filter((s) => s.member.status === 'pending');
  const onlineMembers = memberStats.filter((s) => s.member.status === 'active' && isOnline(s.member.last_seen_at));
  const totalLeads = memberStats.reduce((sum, s) => sum + s.totalLeads, 0);
  const totalConverted = memberStats.reduce((sum, s) => sum + s.convertedLeads, 0);
  const totalFunds = memberStats.reduce((sum, s) => sum + s.convertedFunds, 0);
  const totalFollowups = memberStats.reduce((sum, s) => sum + s.pendingFollowups, 0);
  const totalOverdue = memberStats.reduce((sum, s) => sum + s.overdueFollowups, 0);

  // Leaderboard: sort by period conversions, then by conversion rate, then by total funds
  const leaderboard = [...memberStats]
    .filter((s) => s.member.status === 'active')
    .sort((a, b) => {
      if (b.periodConversions !== a.periodConversions) return b.periodConversions - a.periodConversions;
      if (b.conversionRate !== a.conversionRate) return b.conversionRate - a.conversionRate;
      return b.convertedFunds - a.convertedFunds;
    });

  const MEDAL_COLORS = [
    { bg: 'linear-gradient(135deg, #fbbf24, #f59e0b)', text: '#92400e', label: '1st' },
    { bg: 'linear-gradient(135deg, #cbd5e1, #94a3b8)', text: 'var(--text-muted)', label: '2nd' },
    { bg: 'linear-gradient(135deg, #d97706, #b45309)', text: '#78350f', label: '3rd' },
  ];

  return (
    <>
      <div className="crm-settings-card-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 className="crm-settings-card-title"><Activity size={20} style={{ color: '#0f766e' }} /> Team Dashboard</h2>
            <p className="crm-settings-card-desc">See what each team member is working on — their leads, conversions, follow-ups, and recent activity.</p>
          </div>
          <div className="td-header-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {/* Time range filter */}
            <div className="td-time-range" style={{ display: 'flex', gap: '4px', padding: '4px', background: 'var(--bg-light)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              {TIME_RANGES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setTimeRange(r.key)}
                  style={{
                    padding: '6px 12px',
                    border: 'none',
                    borderRadius: '7px',
                    background: timeRange === r.key ? '#fff' : 'transparent',
                    color: timeRange === r.key ? '#0f766e' : 'var(--text-dark)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    boxShadow: timeRange === r.key ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {r.key === 'today' && <Calendar size={12} />}
                  {r.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={loadData}
              disabled={refreshing}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', border: '1px solid var(--border-subtle)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600, cursor: refreshing ? 'not-allowed' : 'pointer', opacity: refreshing ? 0.6 : 1, flexShrink: 0 }}
            >
              {refreshing ? <Loader2 size={14} className="crm-spin" /> : <TrendingUp size={14} />}
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Overdue follow-up alert banner */}
      {totalOverdue > 0 && (
        <div style={{ marginBottom: '16px', padding: '14px 16px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertTriangle size={18} style={{ color: '#dc2626' }} />
          </div>
          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: '0.85rem', color: '#dc2626' }}>{totalOverdue} overdue follow-up{totalOverdue !== 1 ? 's' : ''}</strong>
            <div style={{ fontSize: '0.76rem', color: '#b91c1c', marginTop: '2px' }}>
              {memberStats.filter((s) => s.overdueFollowups > 0).map((s) => s.member.full_name || s.member.email.split('@')[0]).join(', ')} {memberStats.filter((s) => s.overdueFollowups > 0).length === 1 ? 'has' : 'have'} follow-ups past their due date.
            </div>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="td-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Online Now', value: onlineMembers.length, icon: <Radio size={18} />, color: '#16a34a', bg: 'rgba(22,163,74,0.08)' },
          { label: 'Team Members', value: activeMembers.length, icon: <Users size={18} />, color: '#2563eb', bg: 'rgba(37,99,235,0.08)' },
          { label: 'Pending Invites', value: pendingMembers.length, icon: <Clock size={18} />, color: '#eab308', bg: 'rgba(234,179,8,0.08)' },
          { label: 'Assigned Leads', value: totalLeads, icon: <UserCheck size={18} />, color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
          { label: 'Conversions', value: totalConverted, icon: <CheckCircle2 size={18} />, color: '#16a34a', bg: 'rgba(22,163,74,0.08)' },
          { label: 'Total Funds', value: `$${totalFunds.toLocaleString()}`, icon: <TrendingUp size={18} />, color: '#0d9488', bg: 'rgba(13,148,136,0.08)' },
          { label: 'Pending Follow-ups', value: totalFollowups, icon: <Bell size={18} />, color: totalOverdue > 0 ? '#dc2626' : 'var(--text-dark)', bg: totalOverdue > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(100,116,139,0.08)' },
        ].map((card) => (
          <div key={card.label} style={{ padding: '16px', background: card.bg, borderRadius: '12px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: card.color, border: '1px solid var(--border-subtle)' }}>
                {card.icon}
              </div>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1 }}>{card.value}</span>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-dark)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{card.label}</span>
          </div>
        ))}
      </div>

      {/* Performance Leaderboard */}
      {leaderboard.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Trophy size={16} style={{ color: '#f59e0b' }} /> Performance Leaderboard
            <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-dark)' }}>
              · {TIME_RANGES.find((r) => r.key === timeRange)?.label}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {leaderboard.map((stat, idx) => {
              const medal = idx < 3 ? MEDAL_COLORS[idx] : null;
              const roleColor = ROLE_COLORS[stat.member.role] || ROLE_COLORS.agent;
              const initials = (stat.member.full_name || stat.member.email)[0]?.toUpperCase() || '?';
              return (
                <div key={stat.member.id} className="td-leaderboard-row" style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 16px', background: medal ? `${medal.bg}10` : 'var(--bg-light)',
                  borderRadius: '10px', border: medal ? `1px solid ${medal.text}20` : '1px solid var(--border-subtle)',
                }}>
                  {/* Rank */}
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: medal ? medal.bg : 'var(--border-subtle)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: medal ? medal.text : 'var(--text-dark)', fontWeight: 800, fontSize: '0.78rem',
                    flexShrink: 0,
                  }}>
                    {medal ? <Medal size={16} /> : idx + 1}
                  </div>
                  {/* Avatar */}
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: `linear-gradient(135deg, ${roleColor.text}, ${roleColor.text}dd)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--bg-card)', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0,
                  }}>
                    {initials}
                  </div>
                  {/* Name */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>{stat.member.full_name || stat.member.email}</strong>
                      {medal && <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: medal.bg, color: medal.text }}>{medal.label}</span>}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dark)' }}>{stat.periodConversions} conversion{stat.periodConversions !== 1 ? 's' : ''} · {stat.conversionRate.toFixed(1)}% rate</span>
                  </div>
                  {/* Stats */}
                  <div className="td-leaderboard-stats" style={{ display: 'flex', gap: '16px', flexShrink: 0 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#16a34a', lineHeight: 1 }}>{stat.periodConversions}</div>
                      <div style={{ fontSize: '0.58rem', color: 'var(--text-dark)', textTransform: 'uppercase', fontWeight: 600 }}>Won</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#2563eb', lineHeight: 1 }}>{stat.periodActivities}</div>
                      <div style={{ fontSize: '0.58rem', color: 'var(--text-dark)', textTransform: 'uppercase', fontWeight: 600 }}>Actions</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0d9488', lineHeight: 1 }}>${stat.convertedFunds.toLocaleString()}</div>
                      <div style={{ fontSize: '0.58rem', color: 'var(--text-dark)', textTransform: 'uppercase', fontWeight: 600 }}>Funds</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Member cards */}
      {memberStats.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dark)', fontSize: '0.9rem' }}>
          <Users size={32} style={{ margin: '0 auto 12px', color: 'var(--text-dark)' }} />
          No team members yet. Invite people from the Team tab to see their activity here.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {memberStats.map((stat) => {
            const isExpanded = expandedMember === stat.member.id;
            const roleColor = ROLE_COLORS[stat.member.role] || ROLE_COLORS.agent;
            const initials = (stat.member.full_name || stat.member.email)[0]?.toUpperCase() || '?';
            const hasOverdue = stat.overdueFollowups > 0;
            const online = stat.member.status === 'active' && isOnline(stat.member.last_seen_at);

            return (
              <div
                key={stat.member.id}
                style={{
                  border: hasOverdue ? '1px solid rgba(239,68,68,0.3)' : '1px solid var(--border-subtle)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  transition: 'box-shadow 0.2s',
                  background: hasOverdue ? 'rgba(239,68,68,0.02)' : 'transparent',
                }}
              >
                {/* Member header row */}
                <button
                  type="button"
                  onClick={() => setExpandedMember(isExpanded ? null : stat.member.id)}
                  className="td-member-header"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '14px 16px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {/* Avatar with online dot */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{
                      width: '42px', height: '42px', borderRadius: '50%',
                      background: stat.member.status === 'active' ? `linear-gradient(135deg, ${roleColor.text}, ${roleColor.text}dd)` : 'var(--border-subtle)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--bg-card)', fontWeight: 700, fontSize: '1rem',
                    }}>
                      {initials}
                    </div>
                    {online && (
                      <div style={{
                        position: 'absolute', bottom: '0px', right: '0px',
                        width: '12px', height: '12px', borderRadius: '50%',
                        background: '#22c55e', border: '2px solid #fff',
                      }} />
                    )}
                  </div>

                  {/* Name & email */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="td-member-badges" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                        {stat.member.full_name || stat.member.email}
                      </strong>
                      {online ? (
                        <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: 'rgba(22,163,74,0.1)', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                          Online
                        </span>
                      ) : stat.member.status === 'active' && stat.member.last_seen_at ? (
                        <span style={{ fontSize: '0.62rem', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: 'rgba(100,116,139,0.08)', color: 'var(--text-dark)' }}>
                          Last seen {formatRelative(stat.member.last_seen_at)}
                        </span>
                      ) : null}
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px', background: roleColor.bg, color: roleColor.text }}>
                        {stat.member.role}
                      </span>
                      {stat.member.status !== 'active' && (
                        <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: 'rgba(234,179,8,0.1)', color: '#a16207' }}>
                          {stat.member.status}
                        </span>
                      )}
                      {hasOverdue && (
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: 'rgba(239,68,68,0.1)', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <AlertTriangle size={10} /> {stat.overdueFollowups} overdue
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-dark)' }}>{stat.member.email}</span>
                  </div>

                  {/* Quick stats */}
                  <div className="td-member-quick-stats" style={{ display: 'flex', gap: '16px', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1 }}>{stat.totalLeads}</div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-dark)', textTransform: 'uppercase', fontWeight: 600 }}>Leads</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#16a34a', lineHeight: 1 }}>{stat.convertedLeads}</div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-dark)', textTransform: 'uppercase', fontWeight: 600 }}>Won</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: hasOverdue ? '#dc2626' : stat.pendingFollowups > 0 ? '#eab308' : 'var(--text-dark)', lineHeight: 1 }}>{stat.pendingFollowups}</div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-dark)', textTransform: 'uppercase', fontWeight: 600 }}>Follow-ups</div>
                    </div>
                  </div>

                  {/* Last activity */}
                  <div className="td-member-last-activity" style={{ flexShrink: 0, textAlign: 'right', minWidth: '80px' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dark)', fontWeight: 600 }}>
                      {stat.lastActivityAt ? formatRelative(stat.lastActivityAt) : 'No activity'}
                    </div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-dark)' }}>last action</div>
                  </div>

                  {isExpanded ? <ChevronUp size={18} style={{ color: 'var(--text-dark)', flexShrink: 0 }} /> : <ChevronDown size={18} style={{ color: 'var(--text-dark)', flexShrink: 0 }} />}
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '16px', background: 'var(--bg-light)' }}>
                    {/* Presence info */}
                    <div className="td-expanded-presence" style={{ marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ padding: '8px 12px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Radio size={12} style={{ color: online ? '#22c55e' : 'var(--text-dark)' }} />
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: online ? '#16a34a' : 'var(--text-dark)' }}>
                          {online ? 'Online now' : 'Offline'}
                        </span>
                      </div>
                      <div style={{ padding: '8px 12px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <LogIn size={12} style={{ color: 'var(--text-dark)' }} />
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-dark)' }}>
                          Last login: {formatLastLogin(stat.member.last_login_at)}
                        </span>
                      </div>
                    </div>

                    {/* Overdue follow-ups alert */}
                    {hasOverdue && (
                      <div style={{ marginBottom: '16px', padding: '10px 14px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertTriangle size={14} style={{ color: '#dc2626', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 600 }}>
                          {stat.overdueFollowups} follow-up{stat.overdueFollowups !== 1 ? 's' : ''} past due date — needs attention
                        </span>
                      </div>
                    )}

                    {/* Lead status breakdown */}
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <UserCheck size={14} /> Lead Breakdown
                      </div>
                      <div className="td-expanded-breakdown" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {[
                          { label: 'New', count: stat.newLeads, status: 'new' },
                          { label: 'Called', count: stat.contactedLeads, status: 'called_responded' },
                          { label: 'Interested', count: stat.interestedLeads, status: 'interested' },
                          { label: 'Converted', count: stat.convertedLeads, status: 'converted' },
                          { label: 'Not Interested', count: stat.notInterestedLeads, status: 'not_interested' },
                        ].map((s) => {
                          const sc = STATUS_COLORS[s.status] || { bg: 'rgba(100,116,139,0.1)', text: 'var(--text-dark)' };
                          return (
                            <div key={s.label} style={{ padding: '8px 12px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: sc.text }} />
                              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>{s.label}</span>
                              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: sc.text }}>{s.count}</span>
                            </div>
                          );
                        })}
                      </div>
                      {stat.convertedFunds > 0 && (
                        <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(22,163,74,0.06)', borderRadius: '8px', border: '1px solid rgba(22,163,74,0.15)', fontSize: '0.8rem', fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <TrendingUp size={14} /> Total Converted Funds: ${stat.convertedFunds.toLocaleString()}
                        </div>
                      )}
                    </div>

                    {/* Recent activity feed */}
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Activity size={14} /> Recent Activity
                      </div>
                      {stat.recentActivities.length === 0 ? (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-dark)', padding: '8px 0' }}>
                          No recent activity from this member.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '280px', overflowY: 'auto' }}>
                          {stat.recentActivities.map((act) => (
                            <div key={act.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 12px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--bg-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {ACTIVITY_ICONS[act.activity_type] || <FileText size={14} style={{ color: 'var(--text-dark)' }} />}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>{act.description}</div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-dark)' }}>{formatRelative(act.created_at)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Unassigned leads note */}
      {totalLeads === 0 && members.length > 0 && (
        <div style={{ marginTop: '16px', padding: '12px 16px', background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: '8px', fontSize: '0.78rem', color: '#854d0e', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={14} /> No leads are currently assigned to any team member. Enable Lead Assignment in Settings to auto-distribute leads.
        </div>
      )}
    </>
  );
}
