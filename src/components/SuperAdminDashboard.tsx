import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { Shield, Users, TrendingUp, MessageSquare, UserCog, LogOut, Loader2, Building2, Mail, Activity, AlertCircle, Search, RefreshCw, CircleDot, LogIn, Eye, UserCircle } from 'lucide-react';
import AccountDetailDrawer from './AccountDetailDrawer';
import AdminProfilePage from './AdminProfilePage';

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
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  team_count: number;
  active_team_count: number;
  lead_count: number;
  conversation_count: number;
};

export default function SuperAdminDashboard({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [drawerUserId, setDrawerUserId] = useState<string | null>(null);
  const [view, setView] = useState<'dashboard' | 'profile'>('dashboard');

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
      setAccounts((accountsRes.data as Account[]) || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load dashboard data';
      setError(msg);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleImpersonate = async (account: Account) => {
    if (account.owner_id === session.user.id) {
      setError('You cannot impersonate yourself.');
      return;
    }
    setImpersonatingId(account.owner_id);
    setError('');

    try {
      const { data: { session: adminSession } } = await supabase.auth.getSession();
      if (!adminSession) throw new Error('No active admin session');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/impersonate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminSession.access_token}`,
        },
        body: JSON.stringify({ action: 'start', targetUserId: account.owner_id }),
      });

      if (!response.ok) {
        const errBody = await response.json();
        throw new Error(errBody.error || 'Failed to start impersonation');
      }

      const data = await response.json();

      // Save admin session so we can restore it later
      localStorage.setItem('impersonation_admin_session', JSON.stringify({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
        admin_email: adminSession.user.email,
      }));

      // Set the target user's session
      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      if (setSessionError) throw setSessionError;

      // Redirect to CRM
      window.location.hash = '#/admin';
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to impersonate user';
      setError(msg);
    }
    setImpersonatingId(null);
  };

  const isActive = (lastSignIn: string | null) => {
    if (!lastSignIn) return false;
    const daysSince = (Date.now() - new Date(lastSignIn).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince <= 7;
  };

  const filteredAccounts = accounts.filter((a) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return a.email?.toLowerCase().includes(q) || a.owner_id.toLowerCase().includes(q);
  }).filter((a) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'active') return isActive(a.last_sign_in_at);
    if (statusFilter === 'inactive') return !isActive(a.last_sign_in_at);
    return true;
  });

  const activeCount = accounts.filter((a) => isActive(a.last_sign_in_at)).length;
  const inactiveCount = accounts.length - activeCount;

  const formatDate = (d?: string | null) => {
    if (!d) return 'Never';
    try {
      return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return 'Unknown';
    }
  };

  const formatRelative = (d?: string | null) => {
    if (!d) return 'Never';
    try {
      const diff = Date.now() - new Date(d).getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      if (days === 0) return 'Today';
      if (days === 1) return 'Yesterday';
      if (days < 7) return `${days} days ago`;
      if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
      if (days < 365) return `${Math.floor(days / 30)} months ago`;
      return `${Math.floor(days / 365)} years ago`;
    } catch {
      return 'Unknown';
    }
  };

  if (loading && view === 'dashboard') {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={32} className="crm-spin" style={{ color: '#0f766e' }} />
          <p style={{ marginTop: '12px', color: '#64748b', fontSize: '0.88rem' }}>Loading super admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (view === 'profile') {
    return <AdminProfilePage session={session} onBack={() => setView('dashboard')} />;
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
          {view === 'dashboard' && (
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
          )}
          {view === 'dashboard' && (
            <button
              type="button"
              onClick={() => setView('profile')}
              style={{
                padding: '8px 14px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px',
                background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.8rem',
                fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              <UserCircle size={14} /> My Profile
            </button>
          )}
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
            label="Total Accounts"
            value={accounts.length}
            subtext="All signed-up users"
            color="#0f766e"
            bg="rgba(15,118,110,0.08)"
          />
          <StatCard
            icon={<CircleDot size={22} />}
            label="Active Users (7 days)"
            value={activeCount}
            subtext={`${inactiveCount} inactive`}
            color="#16a34a"
            bg="rgba(22,163,74,0.08)"
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
            color="#2563eb"
            bg="rgba(37,99,235,0.08)"
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
            value={accounts.length > 0 ? Math.round((stats?.total_submissions ?? 0) / accounts.length) : 0}
            subtext="Average per account"
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
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>All Accounts</h2>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                {accounts.length} account{accounts.length !== 1 ? 's' : ''} on the platform
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {/* Status filter buttons */}
              <div style={{ display: 'flex', gap: '4px' }}>
                {(['all', 'active', 'inactive'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setStatusFilter(f)}
                    style={{
                      padding: '7px 12px', borderRadius: '8px', border: '1px solid',
                      borderColor: statusFilter === f ? '#0f766e' : '#e2e8f0',
                      background: statusFilter === f ? 'rgba(15,118,110,0.08)' : '#fff',
                      color: statusFilter === f ? '#0f766e' : '#64748b',
                      fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                      textTransform: 'capitalize', transition: 'all 0.15s',
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* Search */}
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
          </div>

          {filteredAccounts.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <Users size={36} style={{ color: '#cbd5e1', marginBottom: '10px' }} />
              <p style={{ fontSize: '0.88rem', color: '#94a3b8' }}>
                {search || statusFilter !== 'all' ? 'No accounts match your filters.' : 'No accounts found yet.'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}><Mail size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />Email</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Joined</th>
                    <th style={thStyle}>Last Active</th>
                    <th style={thStyle}>Team</th>
                    <th style={thStyle}>Leads</th>
                    <th style={thStyle}>Chats</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.map((account, idx) => {
                    const active = isActive(account.last_sign_in_at);
                    const isSelf = account.owner_id === session.user.id;
                    return (
                      <tr key={account.owner_id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s', cursor: 'pointer' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        onClick={() => setDrawerUserId(account.owner_id)}
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
                        <td style={tdStyle}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '3px 10px', borderRadius: '9999px',
                            fontSize: '0.72rem', fontWeight: 700,
                            background: active ? 'rgba(22,163,74,0.1)' : 'rgba(148,163,184,0.1)',
                            color: active ? '#16a34a' : '#94a3b8',
                          }}>
                            <span style={{
                              width: '6px', height: '6px', borderRadius: '50%',
                              background: active ? '#16a34a' : '#cbd5e1',
                            }} />
                            {active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, fontSize: '0.8rem', color: '#64748b' }}>
                          {formatDate(account.created_at)}
                        </td>
                        <td style={{ ...tdStyle, fontSize: '0.8rem', color: '#64748b' }}>
                          {formatRelative(account.last_sign_in_at)}
                        </td>
                        <td style={tdStyle}>
                          <span style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(37,99,235,0.08)', color: '#2563eb', fontSize: '0.78rem', fontWeight: 700 }}>
                            {account.team_count}
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
                        <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => setDrawerUserId(account.owner_id)}
                            title="View account details"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '5px',
                              padding: '6px 10px', borderRadius: '7px', border: '1px solid #e2e8f0',
                              background: '#fff', color: '#475569',
                              fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                              transition: 'all 0.15s', whiteSpace: 'nowrap',
                            }}
                          >
                            <Eye size={13} /> View
                          </button>
                          <button
                            type="button"
                            onClick={() => handleImpersonate(account)}
                            disabled={isSelf || impersonatingId === account.owner_id}
                            title={isSelf ? 'You cannot impersonate yourself' : 'Log into this customer\'s CRM'}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '5px',
                              padding: '6px 12px', borderRadius: '7px', border: 'none',
                              background: isSelf ? '#f1f5f9' : '#0f766e',
                              color: isSelf ? '#94a3b8' : '#fff',
                              fontSize: '0.75rem', fontWeight: 700, cursor: (isSelf || impersonatingId === account.owner_id) ? 'not-allowed' : 'pointer',
                              transition: 'all 0.15s', whiteSpace: 'nowrap',
                            }}
                          >
                            {impersonatingId === account.owner_id ? (
                              <Loader2 size={13} className="crm-spin" />
                            ) : (
                              <LogIn size={13} />
                            )}
                            {isSelf ? 'You' : 'Login'}
                          </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.78rem', color: '#94a3b8' }}>
          Super Admin Portal &middot; LeadCentre CRM Platform
        </p>
      </div>

      {drawerUserId && (
        <AccountDetailDrawer
          targetUserId={drawerUserId}
          session={session}
          onClose={() => setDrawerUserId(null)}
          onImpersonate={(userId, email) => {
            setDrawerUserId(null);
            handleImpersonate({ owner_id: userId, email } as Account);
          }}
        />
      )}
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
