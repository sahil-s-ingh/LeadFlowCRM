import { useMemo, useRef, useCallback, useState } from 'react';
import {
  ArrowUpRight, Users, Star, CheckCircle2, Clock, DollarSign,
  TrendingUp, Bell, MessageCircle, Send, Plus,
  PhoneMissed, PhoneCall, XCircle, BarChart3, Filter,
  ArrowRight, Calendar, Sparkles, Zap, Target, CheckSquare, Flame,
  Radio, FileText, Upload, Webhook, UserPlus, Globe,
  Timer, Banknote, UserX, AlertTriangle, MessageSquare,
} from 'lucide-react';
import { SourceLogo, SOURCE_META as BRAND_SOURCE_META, SOURCE_ORDER } from '@/components/BrandLogos';
import SalesInsightsSection from '@/components/SalesInsightsSection';
import LeadWhatsAppDrawer from '@/components/LeadWhatsAppDrawer';
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
    lead_source?: string | null;
    last_contacted_at?: string | null;
    purchase_value?: number | null;
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

const STAGE_META: { key: LeadStatus; label: string; icon: typeof Users; color: string; bg: string; glow: string }[] = [
  { key: 'new', label: 'New', icon: Users, color: '#3B82F6', bg: 'rgba(59,130,246,0.1)', glow: 'rgba(59,130,246,0.25)' },
  { key: 'called_no_response', label: 'No Response', icon: PhoneMissed, color: '#F97316', bg: 'rgba(249,115,22,0.1)', glow: 'rgba(249,115,22,0.25)' },
  { key: 'called_responded', label: 'Responded', icon: PhoneCall, color: '#06B6D4', bg: 'rgba(6,182,212,0.1)', glow: 'rgba(6,182,212,0.25)' },
  { key: 'interested', label: 'Interested', icon: Star, color: '#22C55E', bg: 'rgba(34,197,94,0.1)', glow: 'rgba(34,197,94,0.25)' },
  { key: 'not_interested', label: 'Not Interested', icon: XCircle, color: '#EF4444', bg: 'rgba(239,68,68,0.1)', glow: 'rgba(239,68,68,0.25)' },
  { key: 'converted', label: 'Converted', icon: CheckCircle2, color: '#EAB308', bg: 'rgba(234,179,8,0.1)', glow: 'rgba(234,179,8,0.25)' },
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
    const totalRevenue = leads
      .filter((l) => l.status === 'converted')
      .reduce((sum, l) => sum + (l.purchase_value || 0), 0);
    return { total, todayCount, interested, converted, totalFunds, totalRevenue };
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

  const sourceBreakdown = useMemo(() => {
    const FALLBACK_ICONS: Record<string, { icon: typeof Globe; color: string }> = {
      'Landing Page': { icon: Globe, color: '#3B82F6' },
      'Direct Link': { icon: ArrowUpRight, color: '#06B6D4' },
      'Popup Form': { icon: FileText, color: '#F59E0B' },
      'Bulk Upload': { icon: Upload, color: 'var(--text-dark)' },
      'Manual Entry': { icon: UserPlus, color: '#EC4899' },
      'Webhook': { icon: Webhook, color: '#EF4444' },
    };
    const counts: Record<string, { count: number; converted: number }> = {};
    for (const lead of leads) {
      const src = lead.lead_source || 'Landing Page';
      if (!counts[src]) counts[src] = { count: 0, converted: 0 };
      counts[src].count++;
      if (lead.status === 'converted') counts[src].converted++;
    }
    const entries = Object.entries(counts);
    entries.sort((a, b) => {
      const ai = SOURCE_ORDER.indexOf(a[0]);
      const bi = SOURCE_ORDER.indexOf(b[0]);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return b[1].count - a[1].count;
    });
    return entries
      .map(([key, data]) => {
        const brand = BRAND_SOURCE_META[key];
        const fb = FALLBACK_ICONS[key];
        return {
          key,
          label: brand?.label || key,
          color: brand?.color || fb?.color || '#64748B',
          icon: fb?.icon || Globe,
          count: data.count,
          converted: data.converted,
          convRate: data.count > 0 ? Math.round((data.converted / data.count) * 100) : 0,
          pct: leads.length > 0 ? Math.round((data.count / leads.length) * 100) : 0,
        };
      });
  }, [leads]);

  const todayTasks = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const newLeadsToday = leads.filter((l) => new Date(l.created_at) >= todayStart);
    const newLeadsToContact = newLeadsToday.filter((l) => l.status === 'new');
    const overdueFollowUpsCount = followUps
      ? followUps.filter((f) => f.status === 'pending' && new Date(f.reminder_at).getTime() <= Date.now()).length
      : 0;
    const respondedLeads = leads.filter((l) => l.status === 'called_responded' || l.status === 'interested');
    const hotLeads = leads.filter((l) => (l.lead_score ?? 0) >= 70);
    const staleLeads = leads.filter((l) => {
      if (l.status === 'converted' || l.status === 'not_interested') return false;
      const lastContact = l.last_contacted_at ? new Date(l.last_contacted_at) : new Date(l.created_at);
      const daysSince = Math.floor((Date.now() - lastContact.getTime()) / (1000 * 60 * 60 * 24));
      return daysSince >= 5;
    });
    return {
      newLeadsToContact: newLeadsToContact.length,
      overdueFollowUps: overdueFollowUpsCount,
      hotLeads: hotLeads.length,
      staleLeads: staleLeads.length,
      total: newLeadsToContact.length + overdueFollowUpsCount + hotLeads.length + staleLeads.length,
    };
  }, [leads, followUps]);

  const conversionRate = stats.total > 0
    ? Math.round((stats.converted / stats.total) * 100)
    : 0;

  const avgResponseTime = useMemo(() => {
    const contacted = leads.filter((l) => l.last_contacted_at && l.created_at);
    if (contacted.length === 0) return null;
    const totalHours = contacted.reduce((sum, l) => {
      const diff = new Date(l.last_contacted_at!).getTime() - new Date(l.created_at).getTime();
      return sum + Math.max(0, diff / (1000 * 60 * 60));
    }, 0);
    return totalHours / contacted.length;
  }, [leads]);

  const formatResponseTime = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)}d`;
  };

  const staleLeadsList = useMemo(() => {
    return leads
      .filter((l) => {
        if (l.status === 'converted' || l.status === 'not_interested') return false;
        const lastContact = l.last_contacted_at ? new Date(l.last_contacted_at) : new Date(l.created_at);
        const daysSince = Math.floor((Date.now() - lastContact.getTime()) / (1000 * 60 * 60 * 24));
        return daysSince >= 5;
      })
      .sort((a, b) => {
        const aLast = a.last_contacted_at ? new Date(a.last_contacted_at) : new Date(a.created_at);
        const bLast = b.last_contacted_at ? new Date(b.last_contacted_at) : new Date(b.created_at);
        return aLast.getTime() - bLast.getTime();
      });
  }, [leads]);

  const unassignedLeads = useMemo(() => {
    return leads.filter((l) =>
      !l.assigned_to && (l.status === 'interested' || l.status === 'converted')
    );
  }, [leads]);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const userInitial = session.user.email?.[0]?.toUpperCase() || 'U';

  const [waDrawerLead, setWaDrawerLead] = useState<{ id: string; full_name: string; email?: string; mobile_number: string } | null>(null);
  const openWaDrawer = useCallback((lead: { id: string; full_name: string; email?: string; mobile_number?: string }) => {
    setWaDrawerLead({ id: lead.id, full_name: lead.full_name, email: lead.email, mobile_number: lead.mobile_number || '' });
  }, []);
  const closeWaDrawer = useCallback(() => setWaDrawerLead(null), []);

  // 3D tilt tracking
  const heroRef = useRef<HTMLDivElement>(null);

  const handleTilt = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    const maxTilt = 8;
    el.style.transform = `perspective(1000px) rotateX(${-y * maxTilt}deg) rotateY(${x * maxTilt}deg) translateZ(0)`;
  }, []);

  const handleTiltReset = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0)';
  }, []);

  const handleHeroTilt = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = heroRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(1200px) rotateX(${-y * 4}deg) rotateY(${x * 4}deg)`;
  }, []);

  const handleHeroReset = useCallback(() => {
    const el = heroRef.current;
    if (el) el.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg)';
  }, []);

  const statCards = [
    { key: 'total', value: stats.total, label: 'Total Leads', icon: Users, color: '#3B82F6', glow: 'rgba(59,130,246,0.3)', depth: 40, clickable: true, onClick: onGoToLeads },
    { key: 'interested', value: stats.interested, label: 'Interested', icon: Star, color: '#22C55E', glow: 'rgba(34,197,94,0.3)', depth: 30, clickable: true, onClick: onGoToLeads },
    { key: 'converted', value: stats.converted, label: 'Converted', icon: CheckCircle2, color: '#EAB308', glow: 'rgba(234,179,8,0.3)', depth: 50, clickable: true, onClick: onGoToLeads },
    { key: 'today', value: stats.todayCount, label: 'New Today', icon: Clock, color: '#06B6D4', glow: 'rgba(6,182,212,0.3)', depth: 25, clickable: false, onClick: () => {} },
    { key: 'funds', value: formatFund(stats.totalFunds), label: 'Total Funds', icon: DollarSign, color: '#8B5CF6', glow: 'rgba(139,92,246,0.3)', depth: 35, clickable: false, onClick: () => {} },
    { key: 'revenue', value: formatFund(stats.totalRevenue), label: 'Revenue (Converted)', icon: Banknote, color: '#10B981', glow: 'rgba(16,185,129,0.3)', depth: 35, clickable: false, onClick: () => {} },
    { key: 'response', value: avgResponseTime !== null ? formatResponseTime(avgResponseTime) : '—', label: 'Avg Response Time', icon: Timer, color: '#F59E0B', glow: 'rgba(245,158,11,0.3)', depth: 25, clickable: false, onClick: () => {} },
  ];

  return (
    <div className="dash3d-container">
      {/* 3D Hero Header */}
      <div
        className="dash3d-hero-scene"
        onMouseMove={handleHeroTilt}
        onMouseLeave={handleHeroReset}
      >
        <div className="dash3d-hero" ref={heroRef}>
          <div className="dash3d-hero-layer" style={{ transform: 'translateZ(30px)' }}>
            <div className="dash3d-hero-greeting">
              <Sparkles size={14} /> {getGreeting()}
            </div>
            <h1 className="dash3d-hero-title">Dashboard Overview</h1>
            <p className="dash3d-hero-sub">Complete view of everything happening in your CRM</p>
          </div>
          <div className="dash3d-hero-stats" style={{ transform: 'translateZ(50px)' }}>
            <div className="dash3d-hero-stat">
              <span className="dash3d-hero-stat-value">{stats.total}</span>
              <span className="dash3d-hero-stat-label">Total Leads</span>
            </div>
            <div className="dash3d-hero-divider" />
            <div className="dash3d-hero-stat">
              <span className="dash3d-hero-stat-value">{conversionRate}%</span>
              <span className="dash3d-hero-stat-label">Conversion</span>
            </div>
            <div className="dash3d-hero-divider" />
            <div className="dash3d-hero-avatar" style={{ transform: 'translateZ(20px)' }}>{userInitial}</div>
          </div>
          {/* Floating decorative orbs */}
          <div className="dash3d-orb dash3d-orb-1" style={{ transform: 'translateZ(15px)' }} />
          <div className="dash3d-orb dash3d-orb-2" style={{ transform: 'translateZ(10px)' }} />
        </div>
      </div>

      {/* 3D Stat Cards */}
      <div className="dash3d-stats-grid">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={card.key}
              className={`dash3d-stat-scene ${card.clickable ? 'dash3d-stat-clickable' : ''}`}
              onMouseMove={handleTilt}
              onMouseLeave={handleTiltReset}
              onClick={card.onClick}
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div
                className="dash3d-stat-card"
                style={{ ['--card-color' as string]: card.color, ['--card-glow' as string]: card.glow }}
              >
                <div className="dash3d-stat-shine" />
                <div className="dash3d-stat-edge" />
                <div className="dash3d-stat-top" style={{ transform: 'translateZ(35px)' }}>
                  <div className="dash3d-stat-icon-wrap">
                    <Icon size={22} />
                  </div>
                  {card.key === 'today' && stats.todayCount > 0 && (
                    <span className="dash3d-stat-trend">+{stats.todayCount} today</span>
                  )}
                </div>
                <div className="dash3d-stat-value" style={{ transform: 'translateZ(25px)' }}>{card.value}</div>
                <div className="dash3d-stat-label" style={{ transform: 'translateZ(15px)' }}>{card.label}</div>
                <div className="dash3d-stat-bar" style={{ transform: 'translateZ(10px)' }}>
                  <div className="dash3d-stat-bar-fill" style={{ background: card.color, width: `${Math.min(100, (typeof card.value === 'number' ? card.value : 0) * 5 + 20)}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Items — Stale Leads + Unassigned Leads */}
      {(staleLeadsList.length > 0 || unassignedLeads.length > 0) && (
        <div className="dash3d-action-items" style={{ marginBottom: 22 }}>
          {staleLeadsList.length > 0 && (
            <div
              className="dash3d-action-card dash3d-action-stale"
              onMouseMove={handleTilt}
              onMouseLeave={handleTiltReset}
            >
              <div className="dash3d-action-card-scene">
                <div className="dash3d-action-icon-wrap">
                  <AlertTriangle size={20} />
                </div>
                <div className="dash3d-action-content">
                  <div className="dash3d-action-title-row">
                    <span className="dash3d-action-title">
                      {staleLeadsList.length} Stale Lead{staleLeadsList.length !== 1 ? 's' : ''} Need Attention
                    </span>
                    <span className="dash3d-action-badge">5+ days no contact</span>
                  </div>
                  <p className="dash3d-action-desc">
                    {staleLeadsList.slice(0, 3).map((l) => l.full_name).join(', ')}
                    {staleLeadsList.length > 3 && ` and ${staleLeadsList.length - 3} more`}
                    {' — re-engage before they go cold.'}
                  </p>
                </div>
                <button className="dash3d-action-btn dash3d-action-btn-solid" onClick={onGoToLeads}>
                  Review Now <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {unassignedLeads.length > 0 && (
            <div
              className="dash3d-action-card dash3d-action-unassigned"
              onMouseMove={handleTilt}
              onMouseLeave={handleTiltReset}
            >
              <div className="dash3d-action-card-scene">
                <div className="dash3d-action-icon-wrap">
                  <UserX size={20} />
                </div>
                <div className="dash3d-action-content">
                  <div className="dash3d-action-title-row">
                    <span className="dash3d-action-title">
                      {unassignedLeads.length} Unassigned Lead{unassignedLeads.length !== 1 ? 's' : ''}
                    </span>
                    <span className="dash3d-action-badge">No agent</span>
                  </div>
                  <p className="dash3d-action-desc">
                    {unassignedLeads.length} interested/converted lead{unassignedLeads.length !== 1 ? 's' : ''} have no agent assigned. Assign them to ensure proper follow-up and ownership.
                  </p>
                </div>
                <button className="dash3d-action-btn dash3d-action-btn-outline" onClick={onGoToLeads}>
                  Assign Leads <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pipeline + Quick Actions side by side */}
      <div className="dash3d-three-col">
        {/* Pipeline Funnel */}
        <div className="dash3d-card-scene" onMouseMove={handleTilt} onMouseLeave={handleTiltReset}>
          <div className="dash3d-card">
            <div className="dash3d-card-header">
              <div className="dash3d-card-title">
                <div className="dash3d-card-icon dash3d-card-icon-blue"><TrendingUp size={18} /></div>
                <h2>Sales Pipeline</h2>
                <span className="dash3d-pipeline-total-badge">{stats.total} leads</span>
              </div>
              <button className="dash3d-card-link" onClick={onGoToLeads}>View All <ArrowRight size={12} /></button>
            </div>
            <div className="dash3d-pipeline-grid">
              {STAGE_META.map((stage, idx) => {
                const count = pipelineCounts[stage.key];
                const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                const Icon = stage.icon;
                return (
                  <div
                    key={stage.key}
                    className="dash3d-pipeline-stage-card"
                    style={{
                      ['--stage-color' as string]: stage.color,
                      ['--stage-glow' as string]: stage.glow,
                      transform: `translateZ(${Math.max(0, 30 - idx * 4)}px)`,
                    }}
                  >
                    <div className="dash3d-pipeline-stage-top">
                      <div className="dash3d-pipeline-stage-icon" style={{ background: stage.bg, color: stage.color }}>
                        <Icon size={16} />
                      </div>
                      <span className="dash3d-pipeline-stage-pct" style={{ color: stage.color }}>{pct}%</span>
                    </div>
                    <div className="dash3d-pipeline-stage-count">{count}</div>
                    <div className="dash3d-pipeline-stage-label">{stage.label}</div>
                    <div className="dash3d-pipeline-stage-track">
                      <div className="dash3d-pipeline-stage-fill" style={{ width: `${pct}%`, background: stage.color, boxShadow: `0 0 12px ${stage.glow}` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="dash3d-card-scene" onMouseMove={handleTilt} onMouseLeave={handleTiltReset}>
          <div className="dash3d-card">
            <div className="dash3d-card-header">
              <div className="dash3d-card-title">
                <div className="dash3d-card-icon dash3d-card-icon-cyan"><Zap size={18} /></div>
                <h2>Quick Actions</h2>
              </div>
            </div>
            <div className="dash3d-quick-actions">
              {onGoToAddLead && (
                <button className="dash3d-quick-btn" onClick={onGoToAddLead}>
                  <div className="dash3d-quick-icon dash3d-quick-blue"><Plus size={18} /></div>
                  <span>Add Lead</span>
                </button>
              )}
              <button className="dash3d-quick-btn" onClick={onGoToInbox}>
                <div className="dash3d-quick-icon dash3d-quick-cyan"><MessageCircle size={18} /></div>
                <span>Inbox</span>
              </button>
              {onGoToBroadcast && (
                <button className="dash3d-quick-btn" onClick={onGoToBroadcast}>
                  <div className="dash3d-quick-icon dash3d-quick-violet"><Send size={18} /></div>
                  <span>Broadcast</span>
                </button>
              )}
              {onGoToFollowUps && (
                <button className="dash3d-quick-btn" onClick={onGoToFollowUps}>
                  <div className="dash3d-quick-icon dash3d-quick-amber"><Bell size={18} /></div>
                  <span>Follow-Ups</span>
                </button>
              )}
              {onGoToAnalytics && (
                <button className="dash3d-quick-btn" onClick={onGoToAnalytics}>
                  <div className="dash3d-quick-icon dash3d-quick-green"><BarChart3 size={18} /></div>
                  <span>Analytics</span>
                </button>
              )}
              <button className="dash3d-quick-btn" onClick={onGoToLeads}>
                <div className="dash3d-quick-icon dash3d-quick-blue"><Filter size={18} /></div>
                <span>Manage Leads</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Lead Source Breakdown + Today's Task Summary */}
      <div className="dash3d-two-col">
        {/* Lead Source Breakdown */}
        <div className="dash3d-card-scene" onMouseMove={handleTilt} onMouseLeave={handleTiltReset}>
          <div className="dash3d-card">
            <div className="dash3d-card-header">
              <div className="dash3d-card-title">
                <div className="dash3d-card-icon dash3d-card-icon-blue"><BarChart3 size={18} /></div>
                <h2>Lead Source Breakdown</h2>
                <span className="dash3d-pipeline-total-badge">{stats.total} total</span>
              </div>
            </div>
            <div className="dash3d-source-list">
              {sourceBreakdown.length === 0 ? (
                <div className="dash3d-recent-empty">
                  <BarChart3 size={32} />
                  <p>No source data yet</p>
                </div>
              ) : (
                sourceBreakdown.map((src, idx) => {
                  const Icon = src.icon;
                  const brandIcon = <SourceLogo source={src.key} size={16} />;
                  return (
                    <div
                      key={src.key}
                      className="dash3d-source-row"
                      style={{ transform: `translateZ(${Math.max(0, 18 - idx * 3)}px)` }}
                    >
                      <div className="dash3d-source-icon-wrap" style={{ background: `${src.color}1a`, color: src.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {brandIcon || <Icon size={16} />}
                      </div>
                      <div className="dash3d-source-info">
                        <div className="dash3d-source-top">
                          <span className="dash3d-source-label">{src.label}</span>
                          <span className="dash3d-source-count" style={{ color: src.color }}>{src.count}</span>
                        </div>
                        <div className="dash3d-source-track">
                          <div
                            className="dash3d-source-fill"
                            style={{ width: `${src.pct}%`, background: src.color, boxShadow: `0 0 10px ${src.color}40` }}
                          />
                        </div>
                        <div className="dash3d-source-bottom">
                          <span className="dash3d-source-pct">{src.pct}% of total</span>
                          <span className="dash3d-source-conv">{src.converted} converted ({src.convRate}%)</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Today's Task Summary */}
        <div className="dash3d-card-scene" onMouseMove={handleTilt} onMouseLeave={handleTiltReset}>
          <div className="dash3d-card">
            <div className="dash3d-card-header">
              <div className="dash3d-card-title">
                <div className="dash3d-card-icon dash3d-card-icon-amber"><Target size={18} /></div>
                <h2>Today's Tasks</h2>
                {todayTasks.total > 0 && (
                  <span className="dash3d-followup-badge" style={{ background: '#F59E0B' }}>{todayTasks.total}</span>
                )}
              </div>
            </div>
            <div className="dash3d-tasks-grid">
              <div className="dash3d-task-card" style={{ ['--task-color' as string]: '#3B82F6', ['--task-glow' as string]: 'rgba(59,130,246,0.15)' }}>
                <div className="dash3d-task-icon-wrap"><UserPlus size={18} /></div>
                <div className="dash3d-task-count">{todayTasks.newLeadsToContact}</div>
                <div className="dash3d-task-label">New Leads to Contact</div>
              </div>
              <div className="dash3d-task-card" style={{ ['--task-color' as string]: '#EF4444', ['--task-glow' as string]: 'rgba(239,68,68,0.15)' }}>
                <div className="dash3d-task-icon-wrap"><Bell size={18} /></div>
                <div className="dash3d-task-count">{todayTasks.overdueFollowUps}</div>
                <div className="dash3d-task-label">Overdue Follow-Ups</div>
              </div>
              <div className="dash3d-task-card" style={{ ['--task-color' as string]: '#EAB308', ['--task-glow' as string]: 'rgba(234,179,8,0.15)' }}>
                <div className="dash3d-task-icon-wrap"><Flame size={18} /></div>
                <div className="dash3d-task-count">{todayTasks.hotLeads}</div>
                <div className="dash3d-task-label">Hot Leads (Score 70+)</div>
              </div>
              <div className="dash3d-task-card" style={{ ['--task-color' as string]: '#F97316', ['--task-glow' as string]: 'rgba(249,115,22,0.15)' }}>
                <div className="dash3d-task-icon-wrap"><Clock size={18} /></div>
                <div className="dash3d-task-count">{todayTasks.staleLeads}</div>
                <div className="dash3d-task-label">Stale Leads (5+ days)</div>
              </div>
            </div>
            {todayTasks.total > 0 && onGoToFollowUps && (
              <div className="dash3d-tasks-footer">
                <button className="dash3d-card-link" onClick={onGoToFollowUps}>
                  Start working on tasks <ArrowRight size={12} />
                </button>
              </div>
            )}
            {todayTasks.total === 0 && (
              <div className="dash3d-tasks-footer">
                <div className="dash3d-tasks-all-done">
                  <CheckSquare size={16} />
                  <span>You're all caught up for today</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3D Recent Leads + Follow-Ups */}
      <div className="dash3d-two-col">
        {/* Recent Leads */}
        <div className="dash3d-card-scene" onMouseMove={handleTilt} onMouseLeave={handleTiltReset}>
          <div className="dash3d-card">
            <div className="dash3d-card-header">
              <div className="dash3d-card-title">
                <div className="dash3d-card-icon dash3d-card-icon-amber"><Clock size={18} /></div>
                <h2>Recent Leads</h2>
              </div>
              <button className="dash3d-card-link" onClick={onGoToLeads}>View All <ArrowRight size={12} /></button>
            </div>
            <div className="dash3d-recent-list">
              {recentLeads.length === 0 ? (
                <div className="dash3d-recent-empty">
                  <Users size={32} />
                  <p>No leads yet</p>
                </div>
              ) : (
                recentLeads.map((lead, idx) => {
                  const stage = STAGE_META.find((s) => s.key === lead.status);
                  return (
                    <div
                      key={lead.id}
                      className="dash3d-recent-row"
                      onClick={onGoToLeads}
                      style={{ transform: `translateZ(${Math.max(0, 20 - idx * 3)}px)` }}
                    >
                      <div className="dash3d-recent-avatar" style={{ background: stage?.bg, color: stage?.color }}>
                        {lead.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="dash3d-recent-info">
                        <div className="dash3d-recent-name">{lead.full_name}</div>
                        <div className="dash3d-recent-meta">
                          {lead.trading_product === 'algo' ? 'Algo' : 'TV Premium'}
                          {lead.state && lead.state !== 'N/A' && ` · ${lead.state}`}
                        </div>
                      </div>
                      <div className="dash3d-recent-right">
                        <button
                          className="lead-wa-row-btn"
                          title={lead.mobile_number ? 'WhatsApp Quick-Chat' : 'No phone number on file'}
                          disabled={!lead.mobile_number}
                          onClick={(e) => { e.stopPropagation(); openWaDrawer(lead); }}
                        >
                          <MessageSquare size={15} />
                        </button>
                        <span className="dash3d-recent-status" style={{ background: stage?.bg, color: stage?.color }}>
                          {stage?.label}
                        </span>
                        <span className="dash3d-recent-time">{timeAgo(lead.created_at)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Follow-Ups Due */}
        <div className="dash3d-card-scene" onMouseMove={handleTilt} onMouseLeave={handleTiltReset}>
          <div className="dash3d-card">
            <div className="dash3d-card-header">
              <div className="dash3d-card-title">
                <div className="dash3d-card-icon dash3d-card-icon-violet"><Bell size={18} /></div>
                <h2>Follow-Ups Due</h2>
                {overdueFollowUps.length > 0 && (
                  <span className="dash3d-followup-badge">{overdueFollowUps.length}</span>
                )}
              </div>
              {onGoToFollowUps && (
                <button className="dash3d-card-link" onClick={onGoToFollowUps}>View All <ArrowRight size={12} /></button>
              )}
            </div>
            <div className="dash3d-recent-list">
              {overdueFollowUps.length === 0 ? (
                <div className="dash3d-recent-empty">
                  <CheckCircle2 size={32} />
                  <p>All caught up!</p>
                </div>
              ) : (
                overdueFollowUps.map((f, idx) => (
                  <div
                    key={f.id}
                    className="dash3d-recent-row"
                    onClick={onGoToFollowUps}
                    style={{ transform: `translateZ(${Math.max(0, 20 - idx * 3)}px)` }}
                  >
                    <div className="dash3d-recent-avatar dash3d-followup-avatar">
                      <Calendar size={16} />
                    </div>
                    <div className="dash3d-recent-info">
                      <div className="dash3d-recent-name">{f.title}</div>
                      <div className="dash3d-recent-meta">Reminder</div>
                    </div>
                    <div className="dash3d-recent-right">
                      <span className="dash3d-recent-time">{timeAgo(f.reminder_at)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
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

      <LeadWhatsAppDrawer
        open={!!waDrawerLead}
        lead={waDrawerLead}
        session={session}
        onClose={closeWaDrawer}
      />
    </div>
  );
}
