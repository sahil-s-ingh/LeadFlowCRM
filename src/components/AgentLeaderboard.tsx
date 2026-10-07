import { useMemo, useState } from 'react';
import { ArrowLeft, Trophy, TrendingUp, DollarSign, Target, Award } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { useEffect } from 'react';

interface TeamMember {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
}

interface Lead {
  id: string;
  status: string;
  fund_amount: number | null;
  assigned_to: string | null;
  created_at: string;
}

interface AgentLeaderboardProps {
  session: Session;
  leads: Lead[];
  onBack: () => void;
}

type SortKey = 'converted' | 'revenue' | 'rate' | 'total';

export default function AgentLeaderboard({ session, leads, onBack }: AgentLeaderboardProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('converted');
  const [period, setPeriod] = useState<'all' | 'month' | 'week'>('all');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('team_members')
        .select('id, full_name, email, role')
        .eq('owner_id', session.user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: true });
      setTeamMembers((data || []) as TeamMember[]);
    })();
  }, [session.user.id]);

  const filteredLeads = useMemo(() => {
    if (period === 'all') return leads;
    const now = new Date();
    if (period === 'week') {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      return leads.filter((l) => new Date(l.created_at) >= start);
    }
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return leads.filter((l) => new Date(l.created_at) >= start);
  }, [leads, period]);

  const leaderboard = useMemo(() => {
    const stats = teamMembers.map((m) => {
      const memberLeads = filteredLeads.filter((l) => l.assigned_to === m.id);
      const total = memberLeads.length;
      const converted = memberLeads.filter((l) => l.status === 'converted').length;
      const interested = memberLeads.filter((l) => l.status === 'interested').length;
      const revenue = memberLeads
        .filter((l) => l.status === 'converted')
        .reduce((sum, l) => sum + (l.fund_amount || 0), 0);
      const rate = total > 0 ? Math.round((converted / total) * 100) : 0;
      const name = m.full_name || m.email.split('@')[0];
      return { ...m, name, total, converted, interested, revenue, rate };
    });

    const unassigned = filteredLeads.filter((l) => !l.assigned_to);
    stats.push({
      id: 'unassigned',
      full_name: null,
      email: '',
      role: '',
      name: 'Unassigned',
      total: unassigned.length,
      converted: unassigned.filter((l) => l.status === 'converted').length,
      interested: unassigned.filter((l) => l.status === 'interested').length,
      revenue: unassigned.filter((l) => l.status === 'converted').reduce((s, l) => s + (l.fund_amount || 0), 0),
      rate: unassigned.length > 0 ? Math.round((unassigned.filter((l) => l.status === 'converted').length / unassigned.length) * 100) : 0,
    });

    return stats.sort((a, b) => {
      if (sortKey === 'converted') return b.converted - a.converted;
      if (sortKey === 'revenue') return b.revenue - a.revenue;
      if (sortKey === 'rate') return b.rate - a.rate;
      return b.total - a.total;
    });
  }, [teamMembers, filteredLeads, sortKey]);

  const maxConverted = Math.max(...leaderboard.map((a) => a.converted), 1);
  const maxRevenue = Math.max(...leaderboard.map((a) => a.revenue), 1);
  const formatMoney = (n: number) => '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });

  const medalColors = ['#EAB308', '#94A3B8', '#B45309'];
  const sortLabels: { key: SortKey; label: string; icon: typeof Trophy }[] = [
    { key: 'converted', label: 'Deals Won', icon: Trophy },
    { key: 'revenue', label: 'Revenue', icon: DollarSign },
    { key: 'rate', label: 'Conv. Rate', icon: Target },
    { key: 'total', label: 'Total Leads', icon: TrendingUp },
  ];

  return (
    <div className="dash-overview">
      <div className="dash-page-header">
        <button className="dash-back-btn" onClick={onBack}><ArrowLeft size={18} /> Back</button>
        <h1>Agent Leaderboard</h1>
        <p>Team performance ranked by conversion metrics</p>
      </div>

      <div className="dash-leaderboard-controls">
        <div className="dash-leaderboard-sort">
          {sortLabels.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.key}
                className={`dash-leaderboard-sort-btn ${sortKey === s.key ? 'active' : ''}`}
                onClick={() => setSortKey(s.key)}
              >
                <Icon size={15} /> {s.label}
              </button>
            );
          })}
        </div>
        <div className="dash-leaderboard-period">
          {(['week', 'month', 'all'] as const).map((p) => (
            <button
              key={p}
              className={`dash-leaderboard-period-btn ${period === p ? 'active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      <div className="dash-leaderboard-list">
        {leaderboard.map((agent, i) => (
          <div
            key={agent.id}
            className={`dash-leaderboard-row ${i < 3 ? 'dash-leaderboard-top' : ''}`}
          >
            <div className="dash-leaderboard-rank">
              {i < 3 ? (
                <div className="dash-leaderboard-medal" style={{ background: medalColors[i] }}>
                  <Award size={18} />
                </div>
              ) : (
                <span className="dash-leaderboard-rank-num">{i + 1}</span>
              )}
            </div>
            <div className="dash-leaderboard-info">
              <div className="dash-leaderboard-name-row">
                <span className="dash-leaderboard-name">{agent.name}</span>
                {agent.role && <span className="dash-leaderboard-role">{agent.role}</span>}
              </div>
              <div className="dash-leaderboard-bars">
                <div className="dash-leaderboard-bar-wrap">
                  <div className="dash-leaderboard-bar-track">
                    <div
                      className="dash-leaderboard-bar-fill dash-leaderboard-bar-green"
                      style={{ width: `${(agent.converted / maxConverted) * 100}%` }}
                    />
                  </div>
                  <span className="dash-leaderboard-bar-val">{agent.converted} won</span>
                </div>
                <div className="dash-leaderboard-bar-wrap">
                  <div className="dash-leaderboard-bar-track">
                    <div
                      className="dash-leaderboard-bar-fill dash-leaderboard-bar-gold"
                      style={{ width: `${maxRevenue > 0 ? (agent.revenue / maxRevenue) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="dash-leaderboard-bar-val">{formatMoney(agent.revenue)}</span>
                </div>
              </div>
            </div>
            <div className="dash-leaderboard-stats">
              <div className="dash-leaderboard-stat">
                <span className="dash-leaderboard-stat-val">{agent.total}</span>
                <span className="dash-leaderboard-stat-label">Leads</span>
              </div>
              <div className="dash-leaderboard-stat">
                <span className="dash-leaderboard-stat-val">{agent.interested}</span>
                <span className="dash-leaderboard-stat-label">Interested</span>
              </div>
              <div className="dash-leaderboard-stat">
                <span className="dash-leaderboard-stat-val">{agent.rate}%</span>
                <span className="dash-leaderboard-stat-label">Rate</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
