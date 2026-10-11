import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Loader2, AlertCircle, Search, TrendingUp, Users, DollarSign, Zap, Crown, Calendar } from 'lucide-react';

export type Subscription = {
  id: string;
  user_id: string;
  plan_id: string | null;
  plan_name: string | null;
  plan_slug: string | null;
  monthly_price: number;
  annual_price: number;
  currency: string;
  status: string;
  billing_cycle: string;
  lead_limit: number;
  team_seats: number;
  current_period_end: string | null;
  trial_ends_at: string | null;
};

export type UsageRow = {
  user_id: string;
  email: string;
  plan_name: string | null;
  plan_slug: string | null;
  status: string;
  billing_cycle: string;
  monthly_price: number;
  currency: string;
  lead_count: number;
  lead_limit: number;
  team_count: number;
  team_seats: number;
  lead_usage_pct: number;
  team_usage_pct: number;
  last_sign_in_at: string | null;
};

export default function SuperAdminUsage({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Get all accounts with their subscription + plan info
      const { data: accountsData, error: accountsErr } = await supabase.rpc('get_super_admin_accounts');
      if (accountsErr) throw accountsErr;
      const accounts = accountsData || [];

      // Get all subscriptions with plan details
      const { data: subsData, error: subsErr } = await supabase
        .from('account_subscriptions')
        .select('id, user_id, plan_id, status, billing_cycle, current_period_end, trial_ends_at, subscription_plans(id, name, slug, monthly_price, annual_price, currency, lead_limit, team_seats)')
        .order('created_at', { ascending: false });
      if (subsErr) throw subsErr;

      // Also fetch lead counts per user
      const { data: leadCounts } = await supabase.rpc('get_super_admin_stats');

      // Build usage rows
      const subs = (subsData || []) as Array<{
        id: string; user_id: string; plan_id: string | null; status: string; billing_cycle: string;
        current_period_end: string | null; trial_ends_at: string | null;
        subscription_plans: { id: string; name: string; slug: string; monthly_price: number; annual_price: number; currency: string; lead_limit: number; team_seats: number } | null;
      }>;

      const subMap = new Map<string, typeof subs[0]>();
      subs.forEach((s) => subMap.set(s.user_id, s));

      const usageRows: UsageRow[] = accounts.map((acc: { owner_id: string; email: string; team_count: number; lead_count: number; last_sign_in_at: string | null }) => {
        const sub = subMap.get(acc.owner_id);
        const plan = sub?.subscription_plans;
        const leadCount = acc.lead_count || 0;
        const leadLimit = plan?.lead_limit || 0;
        const teamCount = acc.team_count || 0;
        const teamSeats = plan?.team_seats || 0;
        const price = sub?.billing_cycle === 'annual' ? (plan?.annual_price || 0) : (plan?.monthly_price || 0);
        return {
          user_id: acc.owner_id,
          email: acc.email,
          plan_name: plan?.name || 'Free',
          plan_slug: plan?.slug || 'free',
          status: sub?.status || 'trial',
          billing_cycle: sub?.billing_cycle || 'monthly',
          monthly_price: price,
          currency: plan?.currency || 'USD',
          lead_count: leadCount,
          lead_limit: leadLimit,
          team_count: teamCount,
          team_seats: teamSeats,
          lead_usage_pct: leadLimit > 0 ? Math.round((leadCount / leadLimit) * 100) : 0,
          team_usage_pct: teamSeats > 0 ? Math.round((teamCount / teamSeats) * 100) : 0,
          last_sign_in_at: acc.last_sign_in_at,
        };
      });

      setRows(usageRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load usage data');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = rows
    .filter((r) => {
      if (!search.trim()) return true;
      return r.email?.toLowerCase().includes(search.toLowerCase());
    })
    .filter((r) => {
      if (planFilter === 'all') return true;
      if (planFilter === 'free') return !r.plan_slug || r.plan_slug === 'free';
      return r.plan_slug === planFilter;
    });

  const totalMRR = filtered.reduce((sum, r) => sum + (r.billing_cycle === 'annual' ? r.monthly_price / 12 : r.monthly_price), 0);
  const nearLimit = filtered.filter((r) => r.lead_usage_pct >= 80).length;
  const paidAccounts = filtered.filter((r) => r.monthly_price > 0).length;
  const planDistribution = filtered.reduce((acc, r) => { acc[r.plan_name] = (acc[r.plan_name] || 0) + 1; return acc; }, {} as Record<string, number>);

  const formatDate = (d?: string | null) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return '—'; }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-light)' }}>
      <div style={{ background: 'linear-gradient(135deg, #0f172a, #0f766e)', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button type="button" onClick={onBack} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: 'var(--bg-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', fontWeight: 600 }}>
            <ArrowLeft size={15} /> Back
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--bg-card)' }}>Usage & Billing</h1>
            <p style={{ margin: 0, fontSize: '0.76rem', color: 'rgba(255,255,255,0.7)' }}>Per-account usage and revenue overview</p>
          </div>
        </div>
        <button type="button" onClick={load} disabled={loading} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: 'var(--bg-card)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
          {loading ? <Loader2 size={14} className="crm-spin" /> : <TrendingUp size={14} />} Refresh
        </button>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 20px' }}>
        {error && (
          <div style={{ padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid #fecaca', borderRadius: '12px', fontSize: '0.85rem', color: '#dc2626', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={18} /> {error}
          </div>
        )}

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          <SummaryCard icon={<DollarSign size={20} />} label="Est. Monthly Revenue" value={`$${totalMRR.toFixed(0)}`} sub="From active subscriptions" color="#16a34a" bg="rgba(22,163,74,0.08)" />
          <SummaryCard icon={<Crown size={20} />} label="Paid Accounts" value={paidAccounts} sub={`${filtered.length - paidAccounts} on free/trial`} color="#d97706" bg="rgba(217,119,6,0.08)" />
          <SummaryCard icon={<Zap size={20} />} label="Near Limit (80%+)" value={nearLimit} sub="Consider upselling" color="#dc2626" bg="rgba(220,38,38,0.08)" />
          <SummaryCard icon={<Users size={20} />} label="Total Accounts" value={filtered.length} sub="All on platform" color="#0f766e" bg="rgba(15,118,110,0.08)" />
        </div>

        {/* Plan distribution */}
        {Object.keys(planDistribution).length > 0 && (
          <div style={{ background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border-subtle)', padding: '18px 20px', marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>Plan Distribution</h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {Object.entries(planDistribution).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
                <span key={name} style={{ padding: '6px 14px', borderRadius: '10px', background: name === 'Free' ? 'rgba(148,163,184,0.1)' : 'rgba(15,118,110,0.08)', border: `1px solid ${name === 'Free' ? 'rgba(148,163,184,0.2)' : 'rgba(15,118,110,0.2)'}`, fontSize: '0.8rem', fontWeight: 600, color: name === 'Free' ? '#64748b' : '#0f766e' }}>
                  {name}: <strong style={{ fontSize: '0.85rem' }}>{count}</strong>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dark)' }} />
            <input type="text" placeholder="Search by email..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ padding: '9px 12px 9px 34px', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '0.85rem', outline: 'none', width: '260px' }} />
          </div>
          <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} style={{ padding: '9px 12px', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}>
            <option value="all">All Plans</option>
            <option value="free">Free / Trial</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>

        {/* Usage table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <Loader2 size={28} className="crm-spin" style={{ color: '#0f766e' }} />
          </div>
        ) : (
          <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-subtle)', overflow: 'hidden', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-light)' }}>
                  <th style={th}>Account</th>
                  <th style={th}>Plan</th>
                  <th style={th}>Status</th>
                  <th style={th}>Billing</th>
                  <th style={th}>Leads Used</th>
                  <th style={th}>Team Seats</th>
                  <th style={th}>Revenue/mo</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dark)', fontSize: '0.85rem' }}>No accounts found.</td></tr>
                ) : filtered.map((r) => (
                  <tr key={r.user_id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-light)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                    <td style={td}>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.83rem' }}>{r.email}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dark)', marginTop: '2px' }}>Last active: {formatDate(r.last_sign_in_at)}</div>
                    </td>
                    <td style={td}>
                      <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 700, background: r.plan_slug === 'free' ? 'rgba(148,163,184,0.1)' : 'rgba(15,118,110,0.08)', color: r.plan_slug === 'free' ? '#64748b' : '#0f766e' }}>
                        {r.plan_name}
                      </span>
                    </td>
                    <td style={td}>
                      <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '0.68rem', fontWeight: 700, background: r.status === 'active' ? 'rgba(22,163,74,0.1)' : r.status === 'trial' ? 'rgba(234,179,8,0.1)' : 'rgba(239,68,68,0.1)', color: r.status === 'active' ? '#16a34a' : r.status === 'trial' ? '#854d0e' : '#dc2626' }}>
                        {r.status}
                      </span>
                    </td>
                    <td style={{ ...td, fontSize: '0.78rem', color: 'var(--text-dark)' }}>{r.billing_cycle}</td>
                    <td style={td}>
                      <UsageBar used={r.lead_count} limit={r.lead_limit} pct={r.lead_usage_pct} />
                    </td>
                    <td style={td}>
                      <UsageBar used={r.team_count} limit={r.team_seats} pct={r.team_usage_pct} />
                    </td>
                    <td style={{ ...td, fontWeight: 700, color: r.monthly_price > 0 ? '#16a34a' : 'var(--text-dark)', fontSize: '0.85rem' }}>
                      {r.currency === 'INR' ? '₹' : '$'}{r.monthly_price.toFixed(0)}
                      {r.billing_cycle === 'annual' && r.monthly_price > 0 && <span style={{ fontSize: '0.68rem', color: 'var(--text-dark)', fontWeight: 400 }}>/mo*</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ marginTop: '12px', fontSize: '0.72rem', color: 'var(--text-dark)', textAlign: 'center' }}>
          * Annual plans show monthly equivalent. Revenue is estimated from active subscriptions.
        </p>
      </div>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: 'left', padding: '12px 14px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dark)', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '13px 14px', fontSize: '0.83rem', color: 'var(--text-muted)' };

function SummaryCard({ icon, label, value, sub, color, bg }: { icon: React.ReactNode; label: string; value: string | number; sub: string; color: string; bg: string }) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border-subtle)', padding: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <div style={{ width: '38px', height: '38px', borderRadius: '9px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>{icon}</div>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dark)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1, marginBottom: '4px' }}>{value}</div>
      <div style={{ fontSize: '0.74rem', color: 'var(--text-dark)' }}>{sub}</div>
    </div>
  );
}

function UsageBar({ used, limit, pct }: { used: number; limit: number; pct: number }) {
  const color = pct >= 100 ? '#dc2626' : pct >= 80 ? '#d97706' : pct >= 50 ? '#0f766e' : '#16a34a';
  const displayLimit = limit > 0 ? limit.toLocaleString() : '∞';
  return (
    <div style={{ minWidth: '120px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
        <span>{used.toLocaleString()} / {displayLimit}</span>
        <span style={{ color }}>{pct}%</span>
      </div>
      <div style={{ height: '6px', borderRadius: '3px', background: 'var(--bg-light)', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: '3px', background: color, width: `${Math.min(pct, 100)}%`, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}
