import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { Shield, Users, TrendingUp, MessageSquare, UserCog, LogOut, Loader2, Building2, Mail, Activity, AlertCircle, Search, RefreshCw } from 'lucide-react';

type Stats = {
  total_auth_users: number;
  total_submissions: number;
  total_team_members: number;
  active_team_members: number;
  total_conversations: number;
  account_count: number;
};

type Account = {
  owner_id: string;
  team_count: number;
  active_team_count: number;
  lead_count: number;
  conversation_count: number;
};

type AccountWithEmail = Account & {
  email?: string;
  created_at?: string;
  last_sign_in_at?: string;
};

export default function SuperAdminDashboard({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [accounts, setAccounts] = useState<AccountWithEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [emailsMap, setEmailsMap] = useState<Record<string, { email: string; created_at: string; last_sign_in_at: string | null }>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, accountsRes] = await Promise.all([
        supabase.rpc('get_super_admin_stats'),
        supabase.rpc('get_super_admin_accounts'),
      ]);

      if (statsRes.error) throw statsRes.error;
      if (accountsRes.error) throw accountsRes.error;

      setStats(statsRes.data as Stats);
      const rawAccounts = (accountsRes.data as Account[]) || [];

      // Fetch all auth users via SECURITY DEFINER function for real emails + last sign-in
      const { data: authUsersData, error: authUsersError } = await supabase.rpc('get_all_auth_users');
      const emailLookup: Record<string, { email: string; created_at: string; last_sign_in_at: string | null }> = {};

      if (!authUsersError && authUsersData) {
        for (const u of authUsersData as { id: string; email: string; created_at: string; last_sign_in_at: string | null }[]) {
          emailLookup[u.id] = { email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at };
        }
      }

      // Fallback: also check team_members for owner emails
      const ownerIds = rawAccounts.map((a) => a.owner_id).filter(Boolean);
      if (ownerIds.length > 0) {
        const { data: memberEmails } = await supabase
          .from('team_members')
          .select('owner_id, email, created_at')
          .in('owner_id', ownerIds)
          .order('created_at', { ascending: true });

        if (memberEmails) {
          for (const m of memberEmails as { owner_id: string; email: string; created_at: string }[]) {
            if (!emailLookup[m.owner_id]) {
              emailLookup[m.owner_id] = { email: m.email, created_at: m.created_at, last_sign_in_at: null };
            }
          }
        }
      }

      setEmailsMap(emailLookup);

      const enriched: AccountWithEmail[] = rawAccounts.map((a) => {
        const info = emailLookup[a.owner_id];
        return {
          ...a,
          email: info?.email || 'Unknown',
          created_at: info?.created_at,
          last_sign_in_at: info?.last_sign_in_at,
        };
      });

      // Sort by lead count descending
      enriched.sort((a, b) => b.lead_count - a.lead_count);
      setAccounts(enriched);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load dashboard data';
      setError(msg);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredAccounts = accounts.filter((a) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return a.email?.toLowerCase().includes(q) || a.owner_id.toLowerCase().includes(q);
  });

  const formatDate = (d?: string) => {
    if (!d) return 'Unknown';
    try {
      return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={32} className="crm-spin" style={{ color: '#0f766e' }} />
          <p style={{ marginTop: '12px', color: '#64748b', fontSize: '0.88rem' }}>Loading super admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a, #0f766e)',
        padding: '20px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(10px)',
          }}>
            <Shield size={24} style={{ color: '#fff' }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>Super Admin Dashboard</h1>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)' }}>LeadCentre CRM Platform Overview</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            style={{
              padding: '8px 14px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px',
              background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.8rem',
              fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            <RefreshCw size={14} className={loading ? 'crm-spin' : ''} /> Refresh
          </button>
          <button
            type="button"
            onClick={onSignOut}
            style={{
              padding: '8px 14px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px',
              background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.8rem',
              fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '28px 24px' }}>
        {error && (
          <div style={{
            padding: '14px 16px', background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: '12px', fontSize: '0.85rem', color: '#dc2626', marginBottom: '20px',
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <AlertCircle size={18} /> {error}
          </div>
        )}

        {/* Stats Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
        }}>
          <StatCard
            icon={<Building2 size={22} />}
            label="Total CRM Accounts"
            value={stats?.account_count ?? 0}
            subtext="Distinct organizations signed up"
            color="#0f766e"
            bg="rgba(15,118,110,0.08)"
          />
          <StatCard
            icon={<Users size={22} />}
            label="Total Auth Users"
            value={stats?.total_auth_users ?? 0}
            subtext="All registered users"
            color="#2563eb"
            bg="rgba(37,99,235,0.08)"
          />
          <StatCard
            icon={<TrendingUp size={22} />}
            label="Total Leads"
            value={stats?.total_submissions ?? 0}
            subtext="Across all accounts"
            color="#d97706"
            bg="rgba(217,119,6,0.08)"
          />
          <StatCard
            icon={<UserCog size={22} />}
            label="Team Members"
            value={stats?.total_team_members ?? 0}
            subtext={`${stats?.active_team_members ?? 0} active`}
            color="#7c3aed"
            bg="rgba(124,58,237,0.08)"
          />
          <StatCard
            icon={<MessageSquare size={22} />}
            label="Conversations"
            value={stats?.total_conversations ?? 0}
            subtext="Total chat conversations"
            color="#0891b2"
            bg="rgba(8,145,178,0.08)"
          />
          <StatCard
            icon={<Activity size={22} />}
            label="Avg Leads / Account"
            value={stats && stats.account_count > 0 ? Math.round(stats.total_submissions / stats.account_count) : 0}
            subtext="Average per organization"
            color="#db2777"
            bg="rgba(219,39,119,0.08)"
          />
        </div>

        {/* Accounts Table */}
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>All CRM Accounts</h2>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                {accounts.length} account{accounts.length !== 1 ? 's' : ''} on the platform
              </p>
            </div>

            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search by email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  padding: '9px 12px 9px 34px', border: '1px solid #e2e8f0', borderRadius: '8px',
                  fontSize: '0.85rem', outline: 'none', width: '240px',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#0f766e'; }}
                onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; }}
              />
            </div>
          </div>

          {filteredAccounts.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <Users size={36} style={{ color: '#cbd5e1', marginBottom: '10px' }} />
              <p style={{ fontSize: '0.88rem', color: '#94a3b8' }}>
                {search ? 'No accounts match your search.' : 'No CRM accounts found yet.'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}><Mail size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />Account Email</th>
                    <th style={thStyle}>Joined</th>
                    <th style={thStyle}>Last Active</th>
                    <th style={thStyle}>Team Members</th>
                    <th style={thStyle}>Active Members</th>
                    <th style={thStyle}>Leads</th>
                    <th style={thStyle}>Conversations</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.map((account, idx) => (
                    <tr key={account.owner_id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={tdStyle}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(15,118,110,0.1)', color: '#0f766e', fontSize: '0.75rem', fontWeight: 700 }}>
                          {idx + 1}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.85rem' }}>{account.email}</div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                          {account.owner_id.slice(0, 8)}...
                        </div>
                      </td>
                      <td style={{ ...tdStyle, fontSize: '0.8rem', color: '#64748b' }}>
                        {formatDate(account.created_at)}
                      </td>
                      <td style={{ ...tdStyle, fontSize: '0.8rem', color: '#64748b' }}>
                        {formatDate(account.last_sign_in_at)}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(124,58,237,0.08)', color: '#7c3aed', fontSize: '0.78rem', fontWeight: 700 }}>
                          {account.team_count}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(34,197,94,0.08)', color: '#16a34a', fontSize: '0.78rem', fontWeight: 700 }}>
                          {account.active_team_count}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(217,119,6,0.08)', color: '#d97706', fontSize: '0.78rem', fontWeight: 700 }}>
                          {account.lead_count}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(8,145,178,0.08)', color: '#0891b2', fontSize: '0.78rem', fontWeight: 700 }}>
                          {account.conversation_count}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.78rem', color: '#94a3b8' }}>
          Super Admin Portal &middot; LeadCentre CRM Platform
        </p>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  fontSize: '0.74rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: '#64748b',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '14px 16px',
  fontSize: '0.85rem',
  color: '#334155',
};

function StatCard({ icon, label, value, subtext, color, bg }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  subtext: string;
  color: string;
  bg: string;
}) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: '14px',
      border: '1px solid #e2e8f0',
      padding: '20px',
      transition: 'transform 0.2s, box-shadow 0.2s',
      cursor: 'default',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px -8px rgba(0,0,0,0.12)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '10px',
          background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: color,
        }}>
          {icon}
        </div>
        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#0f172a', lineHeight: 1, marginBottom: '6px' }}>
        {value.toLocaleString()}
      </div>
      <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>{subtext}</div>
    </div>
  );
}
