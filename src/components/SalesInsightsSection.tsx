import { useEffect, useMemo, useState } from 'react';
import {
  Trophy, Target, DollarSign, Users, TrendingDown, TrendingUp,
  ArrowRight, AlertTriangle, Award, CheckCircle2, XCircle, Copy,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import LeadFollowupHeatmap from '@/components/LeadFollowupHeatmap';

interface Lead {
  id: string;
  full_name: string;
  status: string;
  email: string;
  mobile_number: string;
  fund_amount: number | null;
  created_at: string;
  assigned_to?: string | null;
}

interface SalesInsightsSectionProps {
  session: Session;
  leads: Lead[];
  onGoToLeaderboard: () => void;
  onGoToGoals: () => void;
  onGoToWinLoss: () => void;
  onGoToDuplicates: () => void;
}

interface TeamMember {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
}

interface Goal {
  id: string;
  goal_type: 'revenue' | 'conversions' | 'leads';
  target_value: number;
  period_month: number;
  period_year: number;
}

interface WinLossReason {
  id: string;
  outcome: 'won' | 'lost';
  reason_category: string;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const LOSS_CATEGORIES: Record<string, string> = {
  price: 'Too Expensive',
  timing: 'Bad Timing',
  competitor: 'Chose Competitor',
  not_interested: 'Lost Interest',
  unreachable: 'Unreachable',
  budget: 'No Budget',
  other: 'Other',
};

const WIN_CATEGORIES: Record<string, string> = {
  good_fit: 'Great Product Fit',
  competitive_price: 'Competitive Price',
  trust: 'Built Trust',
  timing: 'Perfect Timing',
  referral: 'Referred by Friend',
  follow_up: 'Persistent Follow-Up',
  other: 'Other',
};

const normPhone = (s: string) => s.replace(/[\s+\-()]/g, '').toLowerCase();
const normEmail = (s: string) => s.trim().toLowerCase();

export default function SalesInsightsSection({
  session,
  leads,
  onGoToLeaderboard,
  onGoToGoals,
  onGoToWinLoss,
  onGoToDuplicates,
}: SalesInsightsSectionProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [reasons, setReasons] = useState<WinLossReason[]>([]);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  useEffect(() => {
    (async () => {
      const [tmRes, goalsRes, reasonsRes] = await Promise.allSettled([
        supabase
          .from('team_members')
          .select('id, full_name, email, role')
          .eq('owner_id', session.user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: true }),
        supabase
          .from('sales_goals')
          .select('id, goal_type, target_value, period_month, period_year')
          .eq('user_id', session.user.id)
          .eq('period_month', currentMonth)
          .eq('period_year', currentYear),
        supabase
          .from('win_loss_reasons')
          .select('id, outcome, reason_category')
          .eq('user_id', session.user.id),
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = (r: PromiseSettledResult<{ data: any }>) => r.status === 'fulfilled' ? r.value.data : null;
      setTeamMembers((d(tmRes) || []) as TeamMember[]);
      setGoals((d(goalsRes) || []) as Goal[]);
      setReasons((d(reasonsRes) || []) as WinLossReason[]);
    })();
  }, [session.user.id, currentMonth, currentYear]);

  // --- Leaderboard top 3 ---
  const topAgents = useMemo(() => {
    const stats = teamMembers.map((m) => {
      const memberLeads = leads.filter((l) => l.assigned_to === m.id);
      const converted = memberLeads.filter((l) => l.status === 'converted').length;
      const revenue = memberLeads
        .filter((l) => l.status === 'converted')
        .reduce((sum, l) => sum + (l.fund_amount || 0), 0);
      const total = memberLeads.length;
      const rate = total > 0 ? Math.round((converted / total) * 100) : 0;
      return { ...m, name: m.full_name || m.email.split('@')[0], converted, revenue, total, rate };
    });
    return stats.sort((a, b) => b.converted - a.converted).slice(0, 3);
  }, [teamMembers, leads]);

  // --- Goal progress ---
  const goalActuals = useMemo(() => {
    const monthStart = new Date(currentYear, currentMonth - 1, 1);
    const monthLeads = leads.filter((l) => new Date(l.created_at) >= monthStart);
    return {
      leads: monthLeads.length,
      conversions: monthLeads.filter((l) => l.status === 'converted').length,
      revenue: monthLeads.filter((l) => l.status === 'converted').reduce((s, l) => s + (l.fund_amount || 0), 0),
    };
  }, [leads, currentMonth, currentYear]);

  const getGoal = (type: Goal['goal_type']) => goals.find((g) => g.goal_type === type);

  const goalCards = [
    {
      type: 'revenue' as const,
      label: 'Revenue',
      icon: DollarSign,
      color: '#8B5CF6',
      bg: 'rgba(139,92,246,0.1)',
      actual: goalActuals.revenue,
      format: (n: number) => '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 }),
    },
    {
      type: 'conversions' as const,
      label: 'Conversions',
      icon: Target,
      color: '#EAB308',
      bg: 'rgba(234,179,8,0.1)',
      actual: goalActuals.conversions,
      format: (n: number) => String(n),
    },
    {
      type: 'leads' as const,
      label: 'New Leads',
      icon: Users,
      color: '#3B82F6',
      bg: 'rgba(59,130,246,0.1)',
      actual: goalActuals.leads,
      format: (n: number) => String(n),
    },
  ];

  // --- Win/Loss summary ---
  const winLossSummary = useMemo(() => {
    const lostReasons = reasons.filter((r) => r.outcome === 'lost');
    const wonReasons = reasons.filter((r) => r.outcome === 'won');
    const lostCounts: Record<string, number> = {};
    lostReasons.forEach((r) => { lostCounts[r.reason_category] = (lostCounts[r.reason_category] || 0) + 1; });
    const wonCounts: Record<string, number> = {};
    wonReasons.forEach((r) => { wonCounts[r.reason_category] = (wonCounts[r.reason_category] || 0) + 1; });
    const topLost = Object.entries(lostCounts)
      .map(([key, count]) => ({ key, label: LOSS_CATEGORIES[key] || key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    const topWon = Object.entries(wonCounts)
      .map(([key, count]) => ({ key, label: WIN_CATEGORIES[key] || key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    return { topLost, topWon, lostTotal: lostReasons.length, wonTotal: wonReasons.length };
  }, [reasons]);

  // --- Duplicate count ---
  const duplicateCount = useMemo(() => {
    const seen = new Map<string, number>();
    for (const l of leads) {
      const e = normEmail(l.email);
      const p = normPhone(l.mobile_number);
      const key = e || p;
      if (!key) continue;
      seen.set(key, (seen.get(key) || 0) + 1);
    }
    let total = 0;
    let groups = 0;
    seen.forEach((count) => {
      if (count > 1) { groups++; total += count; }
    });
    return { groups, total };
  }, [leads]);

  const formatMoney = (n: number) => '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  const medalColors = ['#EAB308', '#94A3B8', '#B45309'];

  return (
    <div className="dash-insights-section">
      {/* Duplicate Alert Banner */}
      {duplicateCount.groups > 0 && (
        <button className="dash-dupe-alert" onClick={onGoToDuplicates}>
          <div className="dash-dupe-alert-icon">
            <AlertTriangle size={18} />
          </div>
          <div className="dash-dupe-alert-text">
            <strong>{duplicateCount.groups} duplicate group{duplicateCount.groups !== 1 ? 's' : ''} found</strong>
            <span>{duplicateCount.total} leads share the same email or phone — Review &amp; merge</span>
          </div>
          <ArrowRight size={16} />
        </button>
      )}

      {/* Four-card grid */}
      <div className="dash-insights-grid">
        {/* Top Agents */}
        <div className="dash-card dash-insights-card">
          <div className="dash-card-header">
            <div className="dash-card-title">
              <div className="dash-card-icon dash-card-icon-amber"><Trophy size={18} /></div>
              <h2>Top Agents</h2>
            </div>
            <button className="dash-card-link" onClick={onGoToLeaderboard}>View All <ArrowRight size={12} /></button>
          </div>
          {topAgents.length === 0 ? (
            <div className="dash-insights-empty">
              <Trophy size={28} />
              <p>No team data yet</p>
            </div>
          ) : (
            <div className="dash-insights-leaderboard">
              {topAgents.map((agent, i) => (
                <div key={agent.id} className="dash-insights-agent-row">
                  <div className="dash-insights-rank">
                    <div className="dash-insights-medal" style={{ background: medalColors[i] }}>
                      <Award size={14} />
                    </div>
                  </div>
                  <div className="dash-insights-agent-info">
                    <div className="dash-insights-agent-name">{agent.name}</div>
                    <div className="dash-insights-agent-bars">
                      <span className="dash-insights-agent-stat">{agent.converted} won</span>
                      <span className="dash-insights-agent-sep">·</span>
                      <span className="dash-insights-agent-stat">{agent.rate}%</span>
                    </div>
                  </div>
                  <span className="dash-insights-agent-revenue">{formatMoney(agent.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Monthly Goals */}
        <div className="dash-card dash-insights-card">
          <div className="dash-card-header">
            <div className="dash-card-title">
              <div className="dash-card-icon dash-card-icon-violet"><Target size={18} /></div>
              <h2>Monthly Goals</h2>
              <span className="dash-pipeline-total-badge">{MONTH_NAMES[currentMonth - 1].slice(0, 3)}</span>
            </div>
            <button className="dash-card-link" onClick={onGoToGoals}>Set <ArrowRight size={12} /></button>
          </div>
          <div className="dash-insights-goals">
            {goalCards.map((card) => {
              const goal = getGoal(card.type);
              const target = goal?.target_value || 0;
              const pct = target > 0 ? Math.min(100, Math.round((card.actual / target) * 100)) : 0;
              const Icon = card.icon;
              const hasGoal = target > 0;
              return (
                <div key={card.type} className="dash-insights-goal-row">
                  <div className="dash-insights-goal-icon" style={{ background: card.bg, color: card.color }}>
                    <Icon size={16} />
                  </div>
                  <div className="dash-insights-goal-body">
                    <div className="dash-insights-goal-top">
                      <span className="dash-insights-goal-label">{card.label}</span>
                      <span className="dash-insights-goal-val" style={{ color: card.color }}>
                        {card.format(card.actual)}
                      </span>
                    </div>
                    <div className="dash-insights-goal-track">
                      <div
                        className="dash-insights-goal-fill"
                        style={{ width: hasGoal ? `${pct}%` : '0%', background: card.color }}
                      />
                    </div>
                    <div className="dash-insights-goal-bottom">
                      {hasGoal ? (
                        <>
                          <span className="dash-insights-goal-pct" style={{ color: pct >= 100 ? '#22C55E' : card.color }}>
                            {pct}%
                          </span>
                          <span className="dash-insights-goal-target">of {card.format(target)}</span>
                        </>
                      ) : (
                        <button className="dash-insights-goal-set" onClick={onGoToGoals}>
                          Set target
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Win / Loss Summary */}
        <div className="dash-card dash-insights-card">
          <div className="dash-card-header">
            <div className="dash-card-title">
              <div className="dash-card-icon dash-card-icon-red"><TrendingDown size={18} /></div>
              <h2>Win / Loss</h2>
            </div>
            <button className="dash-card-link" onClick={onGoToWinLoss}>Details <ArrowRight size={12} /></button>
          </div>
          <div className="dash-insights-winloss-compact">
            <div className="dash-insights-winloss-col">
              <div className="dash-insights-winloss-header">
                <CheckCircle2 size={14} style={{ color: '#22C55E' }} />
                <span>Wins</span>
                <span className="dash-insights-winloss-count">{winLossSummary.wonTotal}</span>
              </div>
              {winLossSummary.topWon.length === 0 ? (
                <span className="dash-insights-winloss-empty">No wins tagged</span>
              ) : (
                <div className="dash-insights-chips">
                  {winLossSummary.topWon.map((r) => (
                    <span key={r.key} className="dash-insights-chip dash-insights-chip-green">
                      {r.label} <strong>{r.count}</strong>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="dash-insights-winloss-divider" />
            <div className="dash-insights-winloss-col">
              <div className="dash-insights-winloss-header">
                <XCircle size={14} style={{ color: '#EF4444' }} />
                <span>Losses</span>
                <span className="dash-insights-winloss-count">{winLossSummary.lostTotal}</span>
              </div>
              {winLossSummary.topLost.length === 0 ? (
                <span className="dash-insights-winloss-empty">No losses tagged</span>
              ) : (
                <div className="dash-insights-chips">
                  {winLossSummary.topLost.map((r) => (
                    <span key={r.key} className="dash-insights-chip dash-insights-chip-red">
                      {r.label} <strong>{r.count}</strong>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Activity Heatmap */}
        <LeadFollowupHeatmap />
      </div>
    </div>
  );
}
