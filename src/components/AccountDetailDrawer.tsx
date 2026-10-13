import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Loader2, Users, TrendingUp, DollarSign, Activity, Mail, Phone, Clock, Crown, UserCog, CircleDot, LogIn } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';

type TeamMember = {
  id: string;
  email: string;
  role: string;
  full_name: string | null;
  status: string;
  created_at: string;
};

type Lead = {
  id: string;
  name: string | null;
  email: string | null;
  mobile_number: string | null;
  status: string | null;
  fund_amount: string | null;
  purchase_value: string | null;
  assigned_to: string | null;
  created_at: string;
};

type ActivityItem = {
  id: string;
  activity_type: string;
  description: string;
  created_at: string;
};

type AccountDetails = {
  user: {
    id: string;
    email: string;
    phone: string | null;
    created_at: string;
    last_sign_in_at: string | null;
  };
  team_members: TeamMember[];
  recent_leads: Lead[];
  revenue: {
    total_revenue: number;
    converted_count: number;
    total_leads: number;
    avg_deal_size: number;
  };
  status_counts: Record<string, number>;
  activity: ActivityItem[];
};

export default function AccountDetailDrawer({
  targetUserId,
  session,
  onClose,
  onImpersonate,
}: {
  targetUserId: string;
  session: Session;
  onClose: () => void;
  onImpersonate: (userId: string, email: string) => void;
}) {
  const [details, setDetails] = useState<AccountDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'leads' | 'activity'>('overview');

  const loadDetails = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('get_super_admin_account_details', {
        target_user_id: targetUserId,
      });
      if (rpcError) throw rpcError;
      setDetails(data as AccountDetails);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load account details';
      setError(msg);
    }
    setLoading(false);
  }, [targetUserId]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

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
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days === 1) return 'Yesterday';
      if (days < 7) return `${days}d ago`;
      return formatDate(d);
    } catch {
      return 'Unknown';
    }
  };

  const formatCurrency = (val: number | string | null) => {
    if (val === null || val === undefined) return '$0';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return '$0';
    return num.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const roleIcon = (role: string) => {
    if (role === 'admin') return <Crown size={13} style={{ color: '#d97706' }} />;
    if (role === 'manager') return <UserCog size={13} style={{ color: '#2563eb' }} />;
    return <CircleDot size={13} style={{ color: 'var(--text-dark)' }} />;
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'active': return { bg: 'rgba(22,163,74,0.1)', color: '#16a34a' };
      case 'pending': return { bg: 'rgba(217,119,6,0.1)', color: '#d97706' };
      case 'disabled': return { bg: 'rgba(239,68,68,0.1)', color: '#dc2626' };
      default: return { bg: 'rgba(148,163,184,0.1)', color: 'var(--text-dark)' };
    }
  };

  const leadStatusColor = (status: string | null) => {
    switch (status) {
      case 'converted': case 'won': return { bg: 'rgba(22,163,74,0.1)', color: '#16a34a' };
      case 'lost': case 'closed': return { bg: 'rgba(239,68,68,0.1)', color: '#dc2626' };
      case 'new': return { bg: 'rgba(37,99,235,0.1)', color: '#2563eb' };
      case 'contacted': case 'follow_up': return { bg: 'rgba(217,119,6,0.1)', color: '#d97706' };
      default: return { bg: 'rgba(148,163,184,0.1)', color: 'var(--text-dark)' };
    }
  };

  const activityIcon = (type: string) => {
    switch (type) {
      case 'email_sent': return <Mail size={12} />;
      case 'status_change': return <TrendingUp size={12} />;
      case 'call': return <Phone size={12} />;
      case 'note': return <Activity size={12} />;
      default: return <CircleDot size={12} />;
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15,23,42,0.4)', zIndex: 9998,
          animation: 'fadeIn 0.2s ease',
        }}
      />
      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '100%', maxWidth: '560px',
        background: 'var(--bg-card)', zIndex: 9999,
        overflowY: 'auto', boxShadow: '-8px 0 30px -10px rgba(0,0,0,0.15)',
        animation: 'slideInRight 0.25s ease',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0f172a, #0f766e)',
          padding: '20px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: 'rgba(255,255,255,0.15)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Users size={20} style={{ color: 'var(--bg-card)' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--bg-card)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {details?.user.email || 'Loading...'}
              </h2>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)' }}>
                Account Details
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              flexShrink: 0, width: '34px', height: '34px', borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)',
              color: 'var(--bg-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <Loader2 size={28} className="crm-spin" style={{ color: '#0f766e' }} />
              <p style={{ marginTop: '12px', color: 'var(--text-dark)', fontSize: '0.85rem' }}>Loading account details...</p>
            </div>
          ) : error ? (
            <div style={{ padding: '14px', background: 'var(--bg-card)', border: '1px solid #fecaca', borderRadius: '10px', color: '#dc2626', fontSize: '0.85rem' }}>
              {error}
            </div>
          ) : details ? (
            <>
              {/* Action Bar */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                <button
                  type="button"
                  onClick={() => onImpersonate(details.user.id, details.user.email)}
                  disabled={details.user.id === session.user.id}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    padding: '10px', borderRadius: '10px', border: 'none',
                    background: details.user.id === session.user.id ? 'var(--bg-light)' : '#0f766e',
                    color: details.user.id === session.user.id ? '#94a3b8' : 'var(--bg-card)',
                    fontSize: '0.82rem', fontWeight: 700, cursor: details.user.id === session.user.id ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <LogIn size={14} /> {details.user.id === session.user.id ? 'Your Account' : 'Login as Customer'}
                </button>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '2px solid var(--border-subtle)', paddingBottom: '0' }}>
                {(['overview', 'team', 'leads', 'activity'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: '10px 16px', border: 'none', background: 'none',
                      fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                      color: activeTab === tab ? '#0f766e' : 'var(--text-dark)',
                      borderBottom: activeTab === tab ? '2px solid #0f766e' : '2px solid transparent',
                      marginBottom: '-2px', transition: 'all 0.15s', textTransform: 'capitalize',
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* User Info */}
                  <div style={{ background: 'var(--bg-light)', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-dark)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Phone</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600, marginTop: '3px', wordBreak: 'break-word' }}><Phone size={13} /> {details.user.phone || 'Not provided'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-dark)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Joined</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600, marginTop: '3px' }}>{formatDate(details.user.created_at)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-dark)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Last Active</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600, marginTop: '3px' }}>{formatRelative(details.user.last_sign_in_at)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Revenue Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <DollarSign size={18} style={{ color: '#16a34a' }} />
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-dark)', fontWeight: 600, textTransform: 'uppercase' }}>Total Revenue</span>
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>{formatCurrency(details.revenue.total_revenue)}</div>
                    </div>
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <TrendingUp size={18} style={{ color: '#d97706' }} />
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-dark)', fontWeight: 600, textTransform: 'uppercase' }}>Converted Leads</span>
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        {details.revenue.converted_count}
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-dark)', fontWeight: 500 }}> / {details.revenue.total_leads}</span>
                      </div>
                    </div>
                  </div>

                  {/* Lead Status Breakdown */}
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '16px' }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>Lead Status Breakdown</h3>
                    {Object.keys(details.status_counts).length === 0 ? (
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-dark)', margin: 0 }}>No leads yet.</p>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {Object.entries(details.status_counts).map(([status, count]) => {
                          const c = leadStatusColor(status);
                          return (
                            <span key={status} style={{
                              display: 'inline-flex', alignItems: 'center', gap: '6px',
                              padding: '5px 12px', borderRadius: '9999px',
                              background: c.bg, color: c.color, fontSize: '0.78rem', fontWeight: 700,
                              textTransform: 'capitalize',
                            }}>
                              {status} <span style={{ opacity: 0.7 }}>{count}</span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Avg Deal Size */}
                  {details.revenue.converted_count > 0 && (
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-dark)', fontWeight: 600 }}>Avg Deal Size</span>
                        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f766e' }}>{formatCurrency(details.revenue.avg_deal_size)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Team Tab */}
              {activeTab === 'team' && (
                <div>
                  {details.team_members.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                      <Users size={32} style={{ color: 'var(--text-dark)', marginBottom: '10px' }} />
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-dark)' }}>No team members yet.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {details.team_members.map((tm) => {
                        const sc = statusColor(tm.status);
                        return (
                          <div key={tm.id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '14px', border: '1px solid var(--border-subtle)', borderRadius: '10px',
                            transition: 'border-color 0.15s',
                          }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{
                                width: '36px', height: '36px', borderRadius: '50%',
                                background: 'rgba(15,118,110,0.1)', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                              }}>
                                {roleIcon(tm.role)}
                              </div>
                              <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                  {tm.full_name || tm.email}
                                </div>
                                {tm.full_name && (
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dark)', marginTop: '2px' }}>{tm.email}</div>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                padding: '3px 10px', borderRadius: '6px',
                                background: 'rgba(15,118,110,0.08)', color: '#0f766e',
                                fontSize: '0.72rem', fontWeight: 700, textTransform: 'capitalize',
                              }}>
                                {tm.role}
                              </span>
                              <span style={{
                                padding: '3px 10px', borderRadius: '9999px',
                                background: sc.bg, color: sc.color,
                                fontSize: '0.72rem', fontWeight: 700, textTransform: 'capitalize',
                              }}>
                                {tm.status}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Leads Tab */}
              {activeTab === 'leads' && (
                <div>
                  {details.recent_leads.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                      <TrendingUp size={32} style={{ color: 'var(--text-dark)', marginBottom: '10px' }} />
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-dark)' }}>No leads yet.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {details.recent_leads.map((lead) => {
                        const sc = leadStatusColor(lead.status);
                        return (
                          <div key={lead.id} style={{
                            padding: '12px 14px', border: '1px solid var(--border-subtle)', borderRadius: '10px',
                            transition: 'border-color 0.15s',
                          }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                {lead.name || lead.email || 'Unknown'}
                              </span>
                              <span style={{
                                padding: '2px 8px', borderRadius: '9999px',
                                background: sc.bg, color: sc.color,
                                fontSize: '0.7rem', fontWeight: 700, textTransform: 'capitalize',
                              }}>
                                {lead.status || 'new'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: 'var(--text-dark)' }}>
                              {lead.email && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Mail size={11} /> {lead.email}</span>}
                              {lead.mobile_number && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={11} /> {lead.mobile_number}</span>}
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={11} /> {formatRelative(lead.created_at)}</span>
                            </div>
                            {lead.purchase_value && parseFloat(lead.purchase_value) > 0 && (
                              <div style={{ marginTop: '6px' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#16a34a' }}>
                                  {formatCurrency(lead.purchase_value)}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Activity Tab */}
              {activeTab === 'activity' && (
                <div>
                  {details.activity.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                      <Activity size={32} style={{ color: 'var(--text-dark)', marginBottom: '10px' }} />
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-dark)' }}>No recent activity.</p>
                    </div>
                  ) : (
                    <div style={{ position: 'relative', paddingLeft: '20px' }}>
                      {/* Timeline line */}
                      <div style={{
                        position: 'absolute', left: '6px', top: '4px', bottom: '4px',
                        width: '2px', background: 'var(--border-subtle)',
                      }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {details.activity.map((act) => (
                          <div key={act.id} style={{ position: 'relative' }}>
                            {/* Dot */}
                            <div style={{
                              position: 'absolute', left: '-20px', top: '2px',
                              width: '12px', height: '12px', borderRadius: '50%',
                              background: 'var(--bg-card)', border: '2px solid #0f766e',
                              zIndex: 1,
                            }} />
                            <div style={{ paddingBottom: '2px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                                <span style={{ color: '#0f766e' }}>{activityIcon(act.activity_type)}</span>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f766e', textTransform: 'capitalize' }}>
                                  {act.activity_type.replace(/_/g, ' ')}
                                </span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-dark)' }}>{formatRelative(act.created_at)}</span>
                              </div>
                              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                                {act.description || 'No description'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
