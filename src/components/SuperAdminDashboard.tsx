import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import {
  Shield, Users, TrendingUp, MessageSquare, UserCog, LogOut, Loader2,
  Building2, Mail, Activity, AlertCircle, Search, RefreshCw, CircleDot,
  LogIn, Eye, UserCircle, CreditCard, ToggleLeft, FileText, BarChart3,
  Server, LayoutDashboard, Menu, X,
} from 'lucide-react';
import AccountDetailDrawer from './AccountDetailDrawer';
import AdminProfilePage from './AdminProfilePage';
import SuperAdminPlans from './SuperAdminPlans';
import SuperAdminFeatures from './SuperAdminFeatures';
import SuperAdminLegal from './SuperAdminLegal';
import SuperAdminUsage from './SuperAdminUsage';
import SuperAdminSetupGuide from './SuperAdminSetupGuide';
import SuperAdminEmailSettings from './SuperAdminEmailSettings';

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

type NavKey = 'dashboard' | 'profile' | 'plans' | 'features' | 'legal' | 'usage' | 'setup' | 'email';

const NAV_ITEMS: { key: NavKey; label: string; icon: React.ReactNode; group: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, group: 'Overview' },
  { key: 'usage', label: 'Usage & Billing', icon: <BarChart3 size={18} />, group: 'Overview' },
  { key: 'plans', label: 'Plans & Pricing', icon: <CreditCard size={18} />, group: 'Platform' },
  { key: 'features', label: 'Feature Toggles', icon: <ToggleLeft size={18} />, group: 'Platform' },
  { key: 'legal', label: 'Legal Pages', icon: <FileText size={18} />, group: 'Platform' },
  { key: 'email', label: 'Email Config', icon: <Mail size={18} />, group: 'Platform' },
  { key: 'setup', label: 'Setup Guide', icon: <Server size={18} />, group: 'System' },
  { key: 'profile', label: 'My Profile', icon: <UserCircle size={18} />, group: 'Account' },
];

const PAGE_SUBTITLES: Record<NavKey, string> = {
  dashboard: 'Platform overview and account management',
  usage: 'Per-account usage and revenue tracking',
  plans: 'Manage subscription plans and pricing',
  features: 'Enable or disable platform features',
  legal: 'Edit legal pages published on your site',
  email: 'Configure default SMTP for all accounts',
  setup: 'Deploy your CRM on a VPS step by step',
  profile: 'Super admin account settings',
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
  const [view, setView] = useState<NavKey>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  useEffect(() => { loadData(); }, [loadData]);

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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminSession.access_token}` },
        body: JSON.stringify({ action: 'start', targetUserId: account.owner_id }),
      });
      if (!response.ok) {
        const errBody = await response.json();
        throw new Error(errBody.error || 'Failed to start impersonation');
      }
      const data = await response.json();
      localStorage.setItem('impersonation_admin_session', JSON.stringify({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
        admin_email: adminSession.user.email,
      }));
      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (setSessionError) throw setSessionError;
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

  const filteredAccounts = accounts
    .filter((a) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return a.email?.toLowerCase().includes(q) || a.owner_id.toLowerCase().includes(q);
    })
    .filter((a) => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'active') return isActive(a.last_sign_in_at);
      if (statusFilter === 'inactive') return !isActive(a.last_sign_in_at);
      return true;
    });

  const activeCount = accounts.filter((a) => isActive(a.last_sign_in_at)).length;
  const inactiveCount = accounts.length - activeCount;

  const formatDate = (d?: string | null) => {
    if (!d) return 'Never';
    try { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return 'Unknown'; }
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
    } catch { return 'Unknown'; }
  };

  const groupedNav = NAV_ITEMS.reduce((acc, item) => {
    (acc[item.group] = acc[item.group] || []).push(item);
    return acc;
  }, {} as Record<string, typeof NAV_ITEMS>);

  const currentNav = NAV_ITEMS.find((n) => n.key === view);

  const navigate = (key: NavKey) => {
    setView(key);
    setSidebarOpen(false);
  };

  const renderContent = () => {
    if (view === 'profile') return <AdminProfilePage session={session} />;
    if (view === 'plans') return <SuperAdminPlans />;
    if (view === 'features') return <SuperAdminFeatures />;
    if (view === 'legal') return <SuperAdminLegal />;
    if (view === 'usage') return <SuperAdminUsage />;
    if (view === 'setup') return <SuperAdminSetupGuide />;
    if (view === 'email') return <SuperAdminEmailSettings />;

    // Dashboard view
    if (loading) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
          <div style={{ textAlign: 'center' }}>
            <Loader2 size={32} className="crm-spin" style={{ color: '#0f766e' }} />
            <p style={{ marginTop: '12px', color: 'var(--text-dark)', fontSize: '0.88rem' }}>Loading dashboard data...</p>
          </div>
        </div>
      );
    }

    return (
      <>
        {error && (
          <div style={{
            padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid #fecaca',
            borderRadius: '12px', fontSize: '0.85rem', color: '#dc2626', marginBottom: '20px',
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <AlertCircle size={18} /> {error}
          </div>
        )}

        {/* Stats Cards */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px', marginBottom: '32px',
        }}>
          <StatCard icon={<Building2 size={22} />} label="Total Accounts" value={accounts.length} subtext="All signed-up users" color="#0f766e" bg="rgba(15,118,110,0.08)" />
          <StatCard icon={<CircleDot size={22} />} label="Active Users (7 days)" value={activeCount} subtext={`${inactiveCount} inactive`} color="#16a34a" bg="rgba(22,163,74,0.08)" />
          <StatCard icon={<TrendingUp size={22} />} label="Total Leads" value={stats?.total_submissions ?? 0} subtext="Across all accounts" color="#d97706" bg="rgba(217,119,6,0.08)" />
          <StatCard icon={<UserCog size={22} />} label="Team Members" value={stats?.total_team_members ?? 0} subtext={`${stats?.active_team_members ?? 0} active`} color="#2563eb" bg="rgba(37,99,235,0.08)" />
          <StatCard icon={<MessageSquare size={22} />} label="Conversations" value={stats?.total_conversations ?? 0} subtext="Total chat conversations" color="#0891b2" bg="rgba(8,145,178,0.08)" />
          <StatCard icon={<Activity size={22} />} label="Avg Leads / Account" value={accounts.length > 0 ? Math.round((stats?.total_submissions ?? 0) / accounts.length) : 0} subtext="Average per account" color="#db2777" bg="rgba(219,39,119,0.08)" />
        </div>

        {/* Accounts Table */}
        <div style={{
          background: 'var(--bg-card)', borderRadius: '16px',
          border: '1px solid var(--border-subtle)', overflow: 'hidden',
        }}>
          <div style={{
            padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: '12px',
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>All Accounts</h2>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-dark)' }}>
                {accounts.length} account{accounts.length !== 1 ? 's' : ''} on the platform
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                {(['all', 'active', 'inactive'] as const).map((f) => (
                  <button key={f} type="button" onClick={() => setStatusFilter(f)} style={{
                    padding: '7px 12px', borderRadius: '8px', border: '1px solid',
                    borderColor: statusFilter === f ? '#0f766e' : 'var(--border-subtle)',
                    background: statusFilter === f ? 'rgba(15,118,110,0.08)' : 'var(--bg-card)',
                    color: statusFilter === f ? '#0f766e' : 'var(--text-dark)',
                    fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                    textTransform: 'capitalize', transition: 'all 0.15s',
                  }}>
                    {f}
                  </button>
                ))}
              </div>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dark)' }} />
                <input
                  type="text" placeholder="Search by email..." value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ padding: '9px 12px 9px 34px', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '0.85rem', outline: 'none', width: '240px' }}
                  onFocus={(e) => { e.target.style.borderColor = '#0f766e'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; }}
                />
              </div>
            </div>
          </div>

          {filteredAccounts.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <Users size={36} style={{ color: 'var(--text-dark)', marginBottom: '10px' }} />
              <p style={{ fontSize: '0.88rem', color: 'var(--text-dark)' }}>
                {search || statusFilter !== 'all' ? 'No accounts match your filters.' : 'No accounts found yet.'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-light)' }}>
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
                      <tr key={account.owner_id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s', cursor: 'pointer' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-light)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        onClick={() => setDrawerUserId(account.owner_id)}
                      >
                        <td style={tdStyle}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(15,118,110,0.1)', color: '#0f766e', fontSize: '0.75rem', fontWeight: 700 }}>
                            {idx + 1}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.85rem' }}>{account.email}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-dark)', marginTop: '2px' }}>{account.owner_id.slice(0, 8)}...</div>
                        </td>
                        <td style={tdStyle}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '3px 10px', borderRadius: '9999px',
                            fontSize: '0.72rem', fontWeight: 700,
                            background: active ? 'rgba(22,163,74,0.1)' : 'rgba(148,163,184,0.1)',
                            color: active ? '#16a34a' : 'var(--text-dark)',
                          }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: active ? '#16a34a' : 'var(--text-dark)' }} />
                            {active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, fontSize: '0.8rem', color: 'var(--text-dark)' }}>{formatDate(account.created_at)}</td>
                        <td style={{ ...tdStyle, fontSize: '0.8rem', color: 'var(--text-dark)' }}>{formatRelative(account.last_sign_in_at)}</td>
                        <td style={tdStyle}>
                          <span style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(37,99,235,0.08)', color: '#2563eb', fontSize: '0.78rem', fontWeight: 700 }}>{account.team_count}</span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(217,119,6,0.08)', color: '#d97706', fontSize: '0.78rem', fontWeight: 700 }}>{account.lead_count}</span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(8,145,178,0.08)', color: '#0891b2', fontSize: '0.78rem', fontWeight: 700 }}>{account.conversation_count}</span>
                        </td>
                        <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button type="button" onClick={() => setDrawerUserId(account.owner_id)} title="View account details" style={{
                              display: 'inline-flex', alignItems: 'center', gap: '5px',
                              padding: '6px 10px', borderRadius: '7px', border: '1px solid var(--border-subtle)',
                              background: 'var(--bg-card)', color: 'var(--text-muted)',
                              fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                            }}>
                              <Eye size={13} /> View
                            </button>
                            <button type="button" onClick={() => handleImpersonate(account)} disabled={isSelf || impersonatingId === account.owner_id} title={isSelf ? 'You cannot impersonate yourself' : "Log into this customer's CRM"} style={{
                              display: 'inline-flex', alignItems: 'center', gap: '5px',
                              padding: '6px 12px', borderRadius: '7px', border: 'none',
                              background: isSelf ? 'var(--bg-light)' : '#0f766e',
                              color: isSelf ? '#94a3b8' : 'var(--bg-card)',
                              fontSize: '0.75rem', fontWeight: 700, cursor: (isSelf || impersonatingId === account.owner_id) ? 'not-allowed' : 'pointer',
                              transition: 'all 0.15s', whiteSpace: 'nowrap',
                            }}>
                              {impersonatingId === account.owner_id ? <Loader2 size={13} className="crm-spin" /> : <LogIn size={13} />}
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
      </>
    );
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-light)' }}>
      <style>{`
        .sa-sidebar {
          position: fixed; left: 16px; top: 16px; bottom: 16px; width: 260px; z-index: 100;
          transition: transform 0.3s ease;
          display: flex; flex-direction: column;
          background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
          border-radius: 20px;
          box-shadow: 0 12px 40px -8px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06);
          overflow: hidden;
        }
        .sa-main { margin-left: 292px; flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .sa-overlay { display: none; }
        .sa-hamburger { display: none; }
        @media (max-width: 768px) {
          .sa-sidebar { left: 0; top: 0; bottom: 0; border-radius: 0 20px 20px 0; transform: translateX(-100%); }
          .sa-sidebar-open { transform: translateX(0); }
          .sa-main { margin-left: 0; }
          .sa-overlay-show { display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 99; }
          .sa-hamburger { display: flex !important; }
        }
      `}</style>

      {/* Mobile overlay */}
      {sidebarOpen && <div className="sa-overlay sa-overlay-show" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`sa-sidebar ${sidebarOpen ? 'sa-sidebar-open' : ''}`}>
        {/* Brand */}
        <div style={{
          padding: '20px 22px', display: 'flex', alignItems: 'center', gap: '12px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #0f766e, #14b8a6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Shield size={22} style={{ color: '#fff' }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>Super Admin</h1>
            <p style={{ margin: 0, fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>LeadCentre CRM</p>
          </div>
          <button type="button" onClick={() => setSidebarOpen(false)} className="sa-hamburger"
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '16px 12px' }}>
          {Object.entries(groupedNav).map(([group, items]) => (
            <div key={group} style={{ marginBottom: '20px' }}>
              <div style={{
                fontSize: '0.62rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)',
                textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 12px 8px',
              }}>
                {group}
              </div>
              {items.map((item) => {
                const active = view === item.key;
                return (
                  <button key={item.key} type="button" onClick={() => navigate(item.key)} style={{
                    width: '100%', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px',
                    borderRadius: '8px', border: 'none', textAlign: 'left', cursor: 'pointer',
                    background: active ? 'rgba(15,118,110,0.2)' : 'transparent',
                    color: active ? '#fff' : 'rgba(255,255,255,0.6)',
                    fontSize: '0.84rem', fontWeight: active ? 600 : 500, transition: 'all 0.15s',
                    marginBottom: '2px',
                  }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ color: active ? '#14b8a6' : 'rgba(255,255,255,0.4)', display: 'flex', flexShrink: 0 }}>{item.icon}</span>
                    {item.label}
                    {active && <span style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', background: '#14b8a6' }} />}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Admin footer */}
        <div style={{
          padding: '16px', borderTop: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px',
            padding: '8px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)',
          }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #0f766e, #14b8a6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>
                {(session.user.email || '?').charAt(0).toUpperCase()}
              </span>
            </div>
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {session.user.email || 'Admin'}
              </div>
              <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)' }}>Super Admin</div>
            </div>
          </div>
          <button type="button" onClick={onSignOut} style={{
            width: '100%', padding: '9px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.7)',
            fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            transition: 'all 0.15s',
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.color = '#fca5a5'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
          >
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="sa-main">
        {/* Top bar */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: 'var(--bg-card)', borderBottom: '1px solid var(--border-subtle)',
          padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '12px', minHeight: '64px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <button type="button" onClick={() => setSidebarOpen(true)} className="sa-hamburger" style={{
              width: '38px', height: '38px', borderRadius: '8px', border: '1px solid var(--border-subtle)',
              background: 'var(--bg-card)', color: 'var(--text-muted)', cursor: 'pointer',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Menu size={20} />
            </button>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentNav?.label}
              </h1>
              <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {PAGE_SUBTITLES[view]}
              </p>
            </div>
          </div>

          {view === 'dashboard' && (
            <button type="button" onClick={loadData} disabled={loading} style={{
              padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)',
              background: 'var(--bg-card)', color: 'var(--text-muted)',
              fontSize: '0.8rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', flexShrink: 0,
              transition: 'all 0.15s',
            }}
              onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.borderColor = '#0f766e'; e.currentTarget.style.color = '#0f766e'; } }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <RefreshCw size={14} className={loading ? 'crm-spin' : ''} /> Refresh
            </button>
          )}
        </header>

        {/* Content */}
        <main style={{ flex: 1, padding: '28px 24px', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
          {renderContent()}
        </main>
      </div>

      {/* Account Detail Drawer */}
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
  textAlign: 'left', padding: '12px 16px', fontSize: '0.74rem', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dark)', whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '14px 16px', fontSize: '0.85rem', color: 'var(--text-muted)',
};

function StatCard({ icon, label, value, subtext, color, bg }: {
  icon: React.ReactNode; label: string; value: number; subtext: string; color: string; bg: string;
}) {
  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border-subtle)',
      padding: '20px', transition: 'transform 0.2s, box-shadow 0.2s',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px -8px rgba(0,0,0,0.12)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '10px',
          background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color,
        }}>
          {icon}
        </div>
        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-dark)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1, marginBottom: '6px' }}>
        {value.toLocaleString()}
      </div>
      <div style={{ fontSize: '0.76rem', color: 'var(--text-dark)' }}>{subtext}</div>
    </div>
  );
}
