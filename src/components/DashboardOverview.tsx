import { useMemo } from 'react';
import {
  ArrowUpRight, Users, Star, CheckCircle2, Clock, DollarSign,
  TrendingUp, Bell, Mail, MessageCircle, Send, Plus,
  PhoneMissed, PhoneCall, XCircle, BarChart3, Filter,
  ArrowRight, Calendar,
} from 'lucide-react';
import SalesInsightsSection from '@/components/SalesInsightsSection';
import type { Session } from '@supabase/supabase-js';

type LeadStatus = 'new' | 'called_no_response' | 'called_responded' | 'interested' | 'not_interested' | 'converted';

interface DashboardOverviewProps {
  session: Session;
  leads: {
    id: string;
    full_name: string;
    status: LeadStatus;
    created_at: string;
    fund_amount: number | null;
    trading_product: string;
    assigned_to?: string | null;
    email?: string;
    mobile_number?: string;
    state?: string;
    lead_score?: number;
  }[];
  followUps?: { id: string; title: string; reminder_at: string; status: string; lead_id: string | null }[];
  onGoToLeads: () => void;
  onGoToInbox: () => void;
  onGoToWhatsApp: () => void;
  onGoToEmailAnalytics?: () => void;
  onGoToMessageTemplates?: () => void;
  onGoToBroadcast?: () => void;
  onGoToFollowUps?: () => void;
  onGoToAnalytics?: () => void;
  onGoToAddLead?: () => void;
  onGoToLeaderboard?: () => void;
  onGoToGoals?: () => void;
  onGoToWinLoss?: () => void;
  onGoToDuplicates?: () => void;
}

const STAGE_META: { key: LeadStatus; label: string; icon: typeof Users; color: string; bg: string }[] = [
  { key: 'new', label: 'New', icon: Users, color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' },
  { key: 'called_no_response', label: 'No Response', icon: PhoneMissed, color: '#F97316', bg: 'rgba(249,115,22,0.08)' },
  { key: 'called_responded', label: 'Responded', icon: PhoneCall, color: '#06B6D4', bg: 'rgba(6,182,212,0.08)' },
  { key: 'interested', label: 'Interested', icon: Star, color: '#22C55E', bg: 'rgba(34,197,94,0.08)' },
  { key: 'not_interested', label: 'Not Interested', icon: XCircle, color: '#EF4444', bg: 'rgba(239,68,68,0.08)' },
  { key: 'converted', label: 'Converted', icon: CheckCircle2, color: '#EAB308', bg: 'rgba(234,179,8,0.08)' },
];

const formatFund = (amount: number) =>
  '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

export default function DashboardOverview({
  session,
  leads,
  followUps,
  onGoToLeads,
  onGoToInbox,
  onGoToBroadcast,
  onGoToFollowUps,
  onGoToAnalytics,
  onGoToAddLead,
  onGoToLeaderboard,
  onGoToGoals,
  onGoToWinLoss,
  onGoToDuplicates,
}: DashboardOverviewProps) {
  const stats = useMemo(() => {
    const total = leads.length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = leads.filter((l) => new Date(l.created_at) >= today).length;
    const interested = leads.filter((l) => l.status === 'interested').length;
    const converted = leads.filter((l) => l.status === 'converted').length;
    const totalFunds = leads.reduce((sum, l) => sum + (l.fund_amount || 0), 0);
    return { total, todayCount, interested, converted, totalFunds };
  }, [leads]);

  const pipelineCounts = useMemo(() => {
    const map: Record<LeadStatus, number> = {
      new: 0, called_no_response: 0, called_responded: 0,
      interested: 0, not_interested: 0, converted: 0,
    };
    leads.forEach((l) => { map[l.status]++; });
    return map;
  }, [leads]);

  const recentLeads = useMemo(() =>
    [...leads]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 6),
    [leads],
  );

  const overdueFollowUps = useMemo(() => {
    if (!followUps) return [];
    return followUps
      .filter((f) => f.status === 'pending' && new Date(f.reminder_at).getTime() <= Date.now())
      .slice(0, 5);
  }, [followUps]);

  const conversionRate = stats.total > 0
    ? Math.round((stats.converted / stats.total) * 100)
    : 0;

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const userInitial = session.user.email?.[0]?.toUpperCase() || 'U';

  return (
    <div className="dash-overview">
      {/* Header */}
      <div className="dash-hero">
        <div className="dash-hero-content">
          <div className="dash-hero-greeting">{getGreeting()}</div>
          <h1 className="dash-hero-title">Dashboard Overview</h1>
          <p className="dash-hero-sub">Complete view of everything happening in your CRM</p>
        </div>
        <div className="dash-hero-actions">
          <div className="dash-hero-stat">
            <span className="dash-hero-stat-value">{stats.total}</span>
            <span className="dash-hero-stat-label">Total Leads</span>
          </div>
          <div className="dash-hero-divider" />
          <div className="dash-hero-stat">
            <span className="dash-hero-stat-value">{conversionRate}%</span>
            <span className="dash-hero-stat-label">Conversion</span>
          </div>
          <div className="dash-hero-divider" />
          <div className="dash-hero-avatar">{userInitial}</div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="dash-stats-grid">
        <div className="dash-stat-card dash-stat-blue dash-stat-clickable" onClick={onGoToLeads}>
          <div className="dash-stat-glow" />
          <div className="dash-stat-top">
            <div className="dash-stat-icon-wrap"><Users size={22} /></div>
          </div>
          <div className="dash-stat-value">{stats.total}</div>
          <div className="dash-stat-label">Total Leads</div>
        </div>

        <div className="dash-stat-card dash-stat-green dash-stat-clickable" onClick={onGoToLeads}>
          <div className="dash-stat-glow" />
          <div className="dash-stat-top">
            <div className="dash-stat-icon-wrap"><Star size={22} /></div>
          </div>
          <div className="dash-stat-value">{stats.interested}</div>
          <div className="dash-stat-label">Interested</div>
        </div>

        <div className="dash-stat-card dash-stat-gold dash-stat-clickable" onClick={onGoToLeads}>
          <div className="dash-stat-glow" />
          <div className="dash-stat-top">
            <div className="dash-stat-icon-wrap"><CheckCircle2 size={22} /></div>
          </div>
          <div className="dash-stat-value">{stats.converted}</div>
          <div className="dash-stat-label">Converted</div>
        </div>

        <div className="dash-stat-card dash-stat-cyan">
          <div className="dash-stat-glow" />
          <div className="dash-stat-top">
            <div className="dash-stat-icon-wrap"><Clock size={22} /></div>
            {stats.todayCount > 0 && <span className="dash-stat-trend">+{stats.todayCount} today</span>}
          </div>
          <div className="dash-stat-value">{stats.todayCount}</div>
          <div className="dash-stat-label">New Today</div>
        </div>

        <div className="dash-stat-card dash-stat-violet">
          <div className="dash-stat-glow" />
          <div className="dash-stat-top">
            <div className="dash-stat-icon-wrap"><DollarSign size={22} /></div>
          </div>
          <div className="dash-stat-value">{formatFund(stats.totalFunds)}</div>
          <div className="dash-stat-label">Total Funds</div>
        </div>
      </div>

      {/* Pipeline + Quick Actions */}
      <div className="dash-two-col">
        {/* Pipeline Funnel */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="dash-card-title">
              <div className="dash-card-icon dash-card-icon-blue"><TrendingUp size={18} /></div>
              <h2>Sales Pipeline</h2>
              <span className="dash-pipeline-total-badge">{stats.total} leads</span>
            </div>
            <button className="dash-card-link" onClick={onGoToLeads}>View All <ArrowRight size={12} /></button>
          </div>
          <div className="dash-pipeline-grid">
            {STAGE_META.map((stage) => {
              const count = pipelineCounts[stage.key];
              const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
              const Icon = stage.icon;
              return (
                <div
                  key={stage.key}
                  className="dash-pipeline-stage-card"
                  style={{ ['--stage-color' as string]: stage.color }}
                >
                  <div className="dash-pipeline-stage-top">
                    <div className="dash-pipeline-stage-icon" style={{ background: stage.bg, color: stage.color }}>
                      <Icon size={16} />
                    </div>
                    <span className="dash-pipeline-stage-pct" style={{ color: stage.color }}>{pct}%</span>
                  </div>
                  <div className="dash-pipeline-stage-count">{count}</div>
                  <div className="dash-pipeline-stage-label">{stage.label}</div>
                  <div className="dash-pipeline-stage-track">
                    <div
                      className="dash-pipeline-stage-fill"
                      style={{ width: `${pct}%`, background: stage.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="dash-card-title">
              <div className="dash-card-icon dash-card-icon-cyan"><ArrowUpRight size={18} /></div>
              <h2>Quick Actions</h2>
            </div>
          </div>
          <div className="dash-quick-actions">
            {onGoToAddLead && (
              <button className="dash-quick-btn" onClick={onGoToAddLead}>
                <div className="dash-quick-icon dash-quick-blue"><Plus size={18} /></div>
                <span>Add Lead</span>
              </button>
            )}
            <button className="dash-quick-btn" onClick={onGoToInbox}>
              <div className="dash-quick-icon dash-quick-cyan"><MessageCircle size={18} /></div>
              <span>Inbox</span>
            </button>
            {onGoToBroadcast && (
              <button className="dash-quick-btn" onClick={onGoToBroadcast}>
                <div className="dash-quick-icon dash-quick-violet"><Send size={18} /></div>
                <span>Broadcast</span>
              </button>
            )}
            {onGoToFollowUps && (
              <button className="dash-quick-btn" onClick={onGoToFollowUps}>
                <div className="dash-quick-icon dash-quick-amber"><Bell size={18} /></div>
                <span>Follow-Ups</span>
              </button>
            )}
            {onGoToAnalytics && (
              <button className="dash-quick-btn" onClick={onGoToAnalytics}>
                <div className="dash-quick-icon dash-quick-green"><BarChart3 size={18} /></div>
                <span>Analytics</span>
              </button>
            )}
            <button className="dash-quick-btn" onClick={onGoToLeads}>
              <div className="dash-quick-icon dash-quick-blue"><Filter size={18} /></div>
              <span>Manage Leads</span>
            </button>
          </div>
        </div>
      </div>

      {/* Recent Leads + Follow-Ups */}
      <div className="dash-two-col">
        {/* Recent Leads */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="dash-card-title">
              <div className="dash-card-icon dash-card-icon-amber"><Clock size={18} /></div>
              <h2>Recent Leads</h2>
            </div>
            <button className="dash-card-link" onClick={onGoToLeads}>View All <ArrowRight size={12} /></button>
          </div>
          <div className="dash-recent-list">
            {recentLeads.length === 0 ? (
              <div className="dash-recent-empty">
                <Users size={32} />
                <p>No leads yet</p>
              </div>
            ) : (
              recentLeads.map((lead) => {
                const stage = STAGE_META.find((s) => s.key === lead.status);
                return (
                  <div key={lead.id} className="dash-recent-row" onClick={onGoToLeads}>
                    <div className="dash-recent-avatar" style={{ background: stage?.bg, color: stage?.color }}>
                      {lead.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="dash-recent-info">
                      <div className="dash-recent-name">{lead.full_name}</div>
                      <div className="dash-recent-meta">
                        {lead.trading_product === 'algo' ? 'Algo' : 'TV Premium'}
                        {lead.state && lead.state !== 'N/A' && ` · ${lead.state}`}
                      </div>
                    </div>
                    <div className="dash-recent-right">
                      <span
                        className="dash-recent-status"
                        style={{ background: stage?.bg, color: stage?.color }}
                      >
                        {stage?.label}
                      </span>
                      <span className="dash-recent-time">{timeAgo(lead.created_at)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Follow-Ups Due */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="dash-card-title">
              <div className="dash-card-icon dash-card-icon-violet"><Bell size={18} /></div>
              <h2>Follow-Ups Due</h2>
              {overdueFollowUps.length > 0 && (
                <span className="dash-followup-badge">{overdueFollowUps.length}</span>
              )}
            </div>
            {onGoToFollowUps && (
              <button className="dash-card-link" onClick={onGoToFollowUps}>View All <ArrowRight size={12} /></button>
            )}
          </div>
          <div className="dash-recent-list">
            {overdueFollowUps.length === 0 ? (
              <div className="dash-recent-empty">
                <CheckCircle2 size={32} />
                <p>All caught up!</p>
              </div>
            ) : (
              overdueFollowUps.map((f) => (
                <div key={f.id} className="dash-recent-row" onClick={onGoToFollowUps}>
                  <div className="dash-recent-avatar dash-followup-avatar">
                    <Calendar size={16} />
                  </div>
                  <div className="dash-recent-info">
                    <div className="dash-recent-name">{f.title}</div>
                    <div className="dash-recent-meta">Reminder</div>
                  </div>
                  <div className="dash-recent-right">
                    <span className="dash-recent-time">{timeAgo(f.reminder_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Sales Insights Section */}
      {onGoToLeaderboard && onGoToGoals && onGoToWinLoss && onGoToDuplicates && (
        <SalesInsightsSection
          session={session}
          leads={leads}
          onGoToLeaderboard={onGoToLeaderboard}
          onGoToGoals={onGoToGoals}
          onGoToWinLoss={onGoToWinLoss}
          onGoToDuplicates={onGoToDuplicates}
        />
      )}
    </div>
  );
}
