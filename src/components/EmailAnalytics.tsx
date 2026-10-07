import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import {
  Send, Mail, MailOpen, MousePointerClick, CheckCircle2, XCircle,
  TrendingUp, ArrowLeft, RefreshCw, Loader2, Search, Calendar,
  BarChart3, Activity, Target, AlertTriangle, ExternalLink, X, Trash2,
  CheckSquare, Square,
} from 'lucide-react';

interface EmailLogRow {
  id: string;
  recipient_email: string;
  subject: string;
  body_preview: string | null;
  status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';
  is_bulk: boolean;
  message_id: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  clicked_links: string[];
  bounce_reason: string | null;
  sent_at: string;
  lead_id: string | null;
}

type DateRange = 'today' | '7d' | '30d' | '90d' | 'all';

interface EmailAnalyticsProps {
  session: Session;
  onBack: () => void;
}

export default function EmailAnalytics({ session, onBack }: EmailAnalyticsProps) {
  const [logs, setLogs] = useState<EmailLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const PAGE_SIZE = 15;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('email_log')
      .select('*')
      .order('sent_at', { ascending: false });

    if (dateRange !== 'all') {
      const since = new Date();
      if (dateRange === 'today') {
        since.setHours(0, 0, 0, 0);
      } else {
        const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
        since.setDate(since.getDate() - days);
        since.setHours(0, 0, 0, 0);
      }
      query = query.gte('sent_at', since.toISOString());
    }

    const { data, error } = await query.limit(500);
    if (error) {
      console.error('Failed to load email logs:', error.message);
    }
    setLogs((data || []) as EmailLogRow[]);
    setLoading(false);
  }, [dateRange]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh every 15 seconds so opens/clicks show up without manual refresh
  useEffect(() => {
    const interval = setInterval(() => {
      fetchLogs();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  // Realtime subscription — refetch when email_log rows change (open/click events)
  useEffect(() => {
    const channel = supabase
      .channel('email_log_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'email_log' }, () => {
        fetchLogs();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchLogs]);

  const stats = useMemo(() => {
    const total = logs.length;
    const delivered = logs.filter((l) => ['delivered', 'opened', 'clicked'].includes(l.status)).length;
    const opened = logs.filter((l) => ['opened', 'clicked'].includes(l.status)).length;
    const clicked = logs.filter((l) => l.status === 'clicked' || (l.clicked_links && l.clicked_links.length > 0)).length;
    const bounced = logs.filter((l) => l.status === 'bounced' || l.status === 'failed').length;
    const bulkCount = logs.filter((l) => l.is_bulk).length;
    const openRate = total > 0 ? Math.round((opened / total) * 100) : 0;
    const clickRate = total > 0 ? Math.round((clicked / total) * 100) : 0;
    const deliveryRate = total > 0 ? Math.round((delivered / total) * 100) : 0;
    const bounceRate = total > 0 ? Math.round((bounced / total) * 100) : 0;
    return { total, delivered, opened, clicked, bounced, bulkCount, openRate, clickRate, deliveryRate, bounceRate };
  }, [logs]);

  const dailyData = useMemo(() => {
    const days = dateRange === 'today' ? 1 : dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 30;
    const map: Record<string, { sent: number; opened: number; clicked: number }> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      map[key] = { sent: 0, opened: 0, clicked: 0 };
    }

    logs.forEach((l) => {
      const key = l.sent_at.slice(0, 10);
      if (map[key]) {
        map[key].sent++;
        if (l.opened_at || l.status === 'opened' || l.status === 'clicked') map[key].opened++;
        if (l.status === 'clicked' || (l.clicked_links && l.clicked_links.length > 0)) map[key].clicked++;
      }
    });

    return Object.entries(map).map(([date, counts]) => ({ date, ...counts }));
  }, [logs, dateRange]);

  const maxDaily = useMemo(() => {
    return Math.max(...dailyData.map((d) => d.sent), 1);
  }, [dailyData]);

  const filteredLogs = useMemo(() => {
    let result = logs;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((l) =>
        l.recipient_email.toLowerCase().includes(q) ||
        l.subject.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter((l) => l.status === statusFilter);
    }
    return result;
  }, [logs, search, statusFilter]);

  const pagedLogs = filteredLogs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const { error } = await supabase.from('email_log').delete().eq('id', deleteId);
    setDeleting(false);
    if (error) {
      console.error('Failed to delete email log:', error.message);
    } else {
      setLogs((prev) => prev.filter((l) => l.id !== deleteId));
    }
    setDeleteId(null);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectPage = () => {
    const pageIds = pagedLogs.map((l) => l.id);
    const allSelected = pageIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from('email_log').delete().in('id', ids);
    setBulkDeleting(false);
    if (error) {
      console.error('Failed to bulk delete:', error.message);
    } else {
      setLogs((prev) => prev.filter((l) => !selectedIds.has(l.id)));
    }
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' at ' +
      d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatShortDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; color: string; label: string; icon: React.ReactNode }> = {
      sent: { bg: 'rgba(59,130,246,0.1)', color: '#2563EB', label: 'Sent', icon: <Send size={11} /> },
      delivered: { bg: 'rgba(6,182,212,0.1)', color: '#0891B2', label: 'Delivered', icon: <CheckCircle2 size={11} /> },
      opened: { bg: 'rgba(139,92,246,0.1)', color: '#7C3AED', label: 'Opened', icon: <MailOpen size={11} /> },
      clicked: { bg: 'rgba(22,163,74,0.1)', color: '#16A34A', label: 'Clicked', icon: <MousePointerClick size={11} /> },
      bounced: { bg: 'rgba(239,68,68,0.1)', color: '#DC2626', label: 'Bounced', icon: <XCircle size={11} /> },
      failed: { bg: 'rgba(239,68,68,0.1)', color: '#DC2626', label: 'Failed', icon: <AlertTriangle size={11} /> },
    };
    const c = config[status] || config.sent;
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        padding: '3px 9px', borderRadius: '6px',
        background: c.bg, color: c.color,
        fontSize: '0.72rem', fontWeight: 700,
      }}>
        {c.icon} {c.label}
      </span>
    );
  };

  const statCards = [
    { icon: <Send size={22} />, value: stats.total, label: 'Total Sent', sub: `${stats.bulkCount} bulk`, color: 'blue' },
    { icon: <CheckCircle2 size={22} />, value: stats.delivered, label: 'Delivered', sub: `${stats.deliveryRate}% rate`, color: 'cyan' },
    { icon: <MailOpen size={22} />, value: stats.opened, label: 'Opened', sub: `${stats.openRate}% rate`, color: 'violet' },
    { icon: <MousePointerClick size={22} />, value: stats.clicked, label: 'Clicked', sub: `${stats.clickRate}% rate`, color: 'green' },
    { icon: <XCircle size={22} />, value: stats.bounced, label: 'Bounced/Failed', sub: `${stats.bounceRate}% rate`, color: 'red' },
  ];

  return (
    <div className="ea-container">
      {/* Header */}
      <div className="ea-header">
        <div className="ea-header-left">
          <button className="ea-back-btn" onClick={onBack}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="ea-title">Email Analytics</h1>
            <p className="ea-subtitle">Track delivery, opens, clicks, and bounce rates for every email sent</p>
          </div>
        </div>
        <div className="ea-header-actions">
          <div className="ea-date-toggle">
            {(['today', '7d', '30d', '90d', 'all'] as DateRange[]).map((r) => (
              <button
                key={r}
                className={dateRange === r ? 'active' : ''}
                onClick={() => { setDateRange(r); setPage(0); }}
              >
                {r === 'today' ? 'Today' : r === 'all' ? 'All Time' : `Last ${r.replace('d', ' Days')}`}
              </button>
            ))}
          </div>
          <button className="ea-refresh-btn" onClick={fetchLogs} disabled={loading}>
            {loading ? <Loader2 size={16} className="crm-spin" /> : <RefreshCw size={16} />}
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="ea-stats-grid">
        {statCards.map((card, i) => (
          <div key={i} className={`ea-stat-card ea-stat-${card.color}`}>
            <div className="ea-stat-glow" />
            <div className="ea-stat-top">
              <div className="ea-stat-icon-wrap">{card.icon}</div>
              <span className="ea-stat-sub">{card.sub}</span>
            </div>
            <span className="ea-stat-value">{card.value}</span>
            <span className="ea-stat-label">{card.label}</span>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="ea-charts-row">
        {/* Daily Activity Chart */}
        <div className="ea-card ea-card-elevated">
          <div className="ea-card-header">
            <div className="ea-card-title">
              <div className="ea-card-icon ea-card-icon-blue"><BarChart3 size={18} /></div>
              <h2>Email Activity Over Time</h2>
            </div>
            <div className="ea-chart-legend">
              <span className="ea-legend-item"><span className="ea-legend-dot ea-legend-sent" />Sent</span>
              <span className="ea-legend-item"><span className="ea-legend-dot ea-legend-opened" />Opened</span>
              <span className="ea-legend-item"><span className="ea-legend-dot ea-legend-clicked" />Clicked</span>
            </div>
          </div>
          <div className="ea-chart-body">
            {dailyData.every((d) => d.sent === 0) ? (
              <div className="ea-chart-empty">
                <BarChart3 size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                <p>No email data for this period yet</p>
              </div>
            ) : (
              <div className="ea-bar-chart">
                {dailyData.map((d) => (
                  <div key={d.date} className="ea-bar-group">
                    <div className="ea-bars">
                      <div className="ea-bar ea-bar-sent" style={{ height: `${(d.sent / maxDaily) * 100}%` }} title={`${d.sent} sent`} />
                      <div className="ea-bar ea-bar-opened" style={{ height: `${(d.opened / maxDaily) * 100}%` }} title={`${d.opened} opened`} />
                      <div className="ea-bar ea-bar-clicked" style={{ height: `${(d.clicked / maxDaily) * 100}%` }} title={`${d.clicked} clicked`} />
                    </div>
                    <span className="ea-bar-label">{formatShortDate(d.date)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Funnel / Rates */}
        <div className="ea-card ea-card-elevated">
          <div className="ea-card-header">
            <div className="ea-card-title">
              <div className="ea-card-icon ea-card-icon-violet"><Target size={18} /></div>
              <h2>Email Performance Funnel</h2>
            </div>
          </div>
          <div className="ea-funnel-body">
            {[
              { label: 'Sent', value: stats.total, pct: 100, color: '#3B82F6', icon: <Send size={14} /> },
              { label: 'Delivered', value: stats.delivered, pct: stats.total > 0 ? (stats.delivered / stats.total) * 100 : 0, color: '#06B6D4', icon: <CheckCircle2 size={14} /> },
              { label: 'Opened', value: stats.opened, pct: stats.total > 0 ? (stats.opened / stats.total) * 100 : 0, color: '#8B5CF6', icon: <MailOpen size={14} /> },
              { label: 'Clicked', value: stats.clicked, pct: stats.total > 0 ? (stats.clicked / stats.total) * 100 : 0, color: '#16A34A', icon: <MousePointerClick size={14} /> },
            ].map((step, i, arr) => (
              <div key={step.label} className="ea-funnel-step">
                <div className="ea-funnel-step-header">
                  <span className="ea-funnel-step-icon" style={{ color: step.color }}>{step.icon}</span>
                  <span className="ea-funnel-step-label">{step.label}</span>
                  <span className="ea-funnel-step-value">{step.value}</span>
                  <span className="ea-funnel-step-pct" style={{ color: step.color }}>{Math.round(step.pct)}%</span>
                </div>
                <div className="ea-funnel-step-bar-track">
                  <div className="ea-funnel-step-bar-fill" style={{ width: `${step.pct}%`, background: `linear-gradient(90deg, ${step.color}, ${step.color}cc)` }} />
                </div>
                {i < arr.length - 1 && (
                  <div className="ea-funnel-drop">
                    {arr[i + 1].value < step.value && step.value > 0 && (
                      <span>
                        {Math.round(((step.value - arr[i + 1].value) / step.value) * 100)}% drop
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="ea-metrics-row">
        <div className="ea-metric-tile">
          <div className="ea-metric-icon ea-metric-open"><MailOpen size={18} /></div>
          <div className="ea-metric-body">
            <span className="ea-metric-value">{stats.openRate}%</span>
            <span className="ea-metric-label">Open Rate</span>
          </div>
        </div>
        <div className="ea-metric-tile">
          <div className="ea-metric-icon ea-metric-click"><MousePointerClick size={18} /></div>
          <div className="ea-metric-body">
            <span className="ea-metric-value">{stats.clickRate}%</span>
            <span className="ea-metric-label">Click Rate</span>
          </div>
        </div>
        <div className="ea-metric-tile">
          <div className="ea-metric-icon ea-metric-deliver"><CheckCircle2 size={18} /></div>
          <div className="ea-metric-body">
            <span className="ea-metric-value">{stats.deliveryRate}%</span>
            <span className="ea-metric-label">Delivery Rate</span>
          </div>
        </div>
        <div className="ea-metric-tile">
          <div className="ea-metric-icon ea-metric-bounce"><AlertTriangle size={18} /></div>
          <div className="ea-metric-body">
            <span className="ea-metric-value">{stats.bounceRate}%</span>
            <span className="ea-metric-label">Bounce Rate</span>
          </div>
        </div>
        <div className="ea-metric-tile">
          <div className="ea-metric-icon ea-metric-cta"><TrendingUp size={18} /></div>
          <div className="ea-metric-body">
            <span className="ea-metric-value">{stats.total > 0 ? Math.round((stats.clicked / (stats.opened || 1)) * 100) : 0}%</span>
            <span className="ea-metric-label">CTA Rate</span>
          </div>
        </div>
      </div>

      {/* Recent Emails */}
      <div className="ea-card ea-card-elevated ea-log-card">
        <div className="ea-card-header">
          <div className="ea-card-title">
            <div className="ea-card-icon ea-card-icon-cyan"><Activity size={18} /></div>
            <h2>Recent Emails</h2>
            <span className="ea-log-count">{filteredLogs.length}</span>
          </div>
          <div className="ea-log-filters">
            <div className="ea-search-wrap">
              <Search size={15} />
              <input
                type="text"
                placeholder="Search by email or subject..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              />
              {(search || statusFilter !== 'all') && (
                <button
                  className="ea-clear-btn"
                  onClick={() => { setSearch(''); setStatusFilter('all'); setPage(0); }}
                  title="Clear filters"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
              className="ea-status-select"
            >
              <option value="all">All Statuses</option>
              <option value="sent">Sent</option>
              <option value="delivered">Delivered</option>
              <option value="opened">Opened</option>
              <option value="clicked">Clicked</option>
              <option value="bounced">Bounced</option>
              <option value="failed">Failed</option>
            </select>
            {selectedIds.size > 0 ? (
              <button
                className="ea-bulk-delete-btn"
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 size={14} /> Delete {selectedIds.size} selected
              </button>
            ) : (
              <button
                className="ea-bulk-select-btn"
                onClick={toggleSelectPage}
                title="Select all on this page"
              >
                <CheckSquare size={14} /> Select
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="ea-log-loading">
            <Loader2 size={28} className="crm-spin" />
            <p>Loading emails...</p>
          </div>
        ) : pagedLogs.length === 0 ? (
          <div className="ea-log-empty">
            <Mail size={40} style={{ opacity: 0.25, marginBottom: 10 }} />
            <h3>No emails found</h3>
            <p>{logs.length === 0 ? 'No emails have been sent yet. Send an email from the Leads section to see analytics here.' : 'No emails match your current filters.'}</p>
          </div>
        ) : (
          <>
            <div className="ea-email-list">
              {pagedLogs.map((log) => {
                const sc: Record<string, { bg: string; color: string; label: string; icon: React.ReactNode }> = {
                  sent: { bg: 'rgba(59,130,246,0.1)', color: '#2563EB', label: 'Sent', icon: <Send size={14} /> },
                  delivered: { bg: 'rgba(6,182,212,0.1)', color: '#0891B2', label: 'Delivered', icon: <CheckCircle2 size={14} /> },
                  opened: { bg: 'rgba(139,92,246,0.1)', color: '#7C3AED', label: 'Opened', icon: <MailOpen size={14} /> },
                  clicked: { bg: 'rgba(22,163,74,0.1)', color: '#16A34A', label: 'Clicked', icon: <MousePointerClick size={14} /> },
                  bounced: { bg: 'rgba(239,68,68,0.1)', color: '#DC2626', label: 'Bounced', icon: <XCircle size={14} /> },
                  failed: { bg: 'rgba(239,68,68,0.1)', color: '#DC2626', label: 'Failed', icon: <AlertTriangle size={14} /> },
                };
                const c = sc[log.status] || sc.sent;
                const isSelected = selectedIds.has(log.id);
                return (
                  <div key={log.id} className={`ea-email-item${isSelected ? ' ea-email-item-selected' : ''}`}>
                    <button
                      className="ea-email-check"
                      onClick={() => toggleSelect(log.id)}
                      title={isSelected ? 'Deselect' : 'Select'}
                    >
                      {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>
                    <div className="ea-email-avatar" style={{ background: c.bg, color: c.color }}>
                      {c.icon}
                    </div>
                    <div className="ea-email-body">
                      <div className="ea-email-row-top">
                        <span className="ea-email-recipient">{log.recipient_email}</span>
                        <span className="ea-email-time">{formatDate(log.sent_at)}</span>
                      </div>
                      <div className="ea-email-row-subject">
                        <span className="ea-email-subject-text">{log.subject}</span>
                        <span className={`ea-type-badge ${log.is_bulk ? 'ea-type-bulk' : 'ea-type-single'}`}>
                          {log.is_bulk ? 'Bulk' : 'Single'}
                        </span>
                      </div>
                      {log.body_preview && (
                        <p className="ea-email-preview">{log.body_preview.slice(0, 120)}{log.body_preview.length > 120 ? '...' : ''}</p>
                      )}
                      <div className="ea-email-meta">
                        <span className="ea-email-status-pill" style={{ background: c.bg, color: c.color }}>
                          {c.icon} {c.label}
                        </span>
                        {log.opened_at && (
                          <span className="ea-email-opened-tag">
                            <MailOpen size={12} /> Opened {formatDate(log.opened_at)}
                          </span>
                        )}
                        {log.clicked_links && log.clicked_links.length > 0 && (
                          <span className="ea-email-clicked-tag">
                            <ExternalLink size={12} /> {log.clicked_links.length} link{log.clicked_links.length !== 1 ? 's' : ''} clicked
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      className="ea-email-delete-btn"
                      onClick={() => setDeleteId(log.id)}
                      title="Delete this log entry"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="ea-pagination">
                <button disabled={page === 0} onClick={() => setPage(page - 1)}>
                  Previous
                </button>
                <span className="ea-page-info">Page {page + 1} of {totalPages}</span>
                <button disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {deleteId && (
        <div className="ea-modal-overlay" onClick={() => !deleting && setDeleteId(null)}>
          <div className="ea-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ea-modal-icon">
              <Trash2 size={24} />
            </div>
            <h3 className="ea-modal-title">Delete Email Log?</h3>
            <p className="ea-modal-text">This will permanently remove this entry from your email analytics. This cannot be undone.</p>
            <div className="ea-modal-actions">
              <button className="ea-modal-cancel" onClick={() => setDeleteId(null)} disabled={deleting}>
                Cancel
              </button>
              <button className="ea-modal-confirm" onClick={handleDelete} disabled={deleting}>
                {deleting ? <Loader2 size={15} className="crm-spin" /> : <Trash2 size={15} />}
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkDeleteOpen && (
        <div className="ea-modal-overlay" onClick={() => !bulkDeleting && setBulkDeleteOpen(false)}>
          <div className="ea-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ea-modal-icon">
              <Trash2 size={24} />
            </div>
            <h3 className="ea-modal-title">Delete {selectedIds.size} Email Logs?</h3>
            <p className="ea-modal-text">This will permanently remove {selectedIds.size} selected entries from your email analytics. This cannot be undone.</p>
            <div className="ea-modal-actions">
              <button className="ea-modal-cancel" onClick={() => setBulkDeleteOpen(false)} disabled={bulkDeleting}>
                Cancel
              </button>
              <button className="ea-modal-confirm" onClick={handleBulkDelete} disabled={bulkDeleting}>
                {bulkDeleting ? <Loader2 size={15} className="crm-spin" /> : <Trash2 size={15} />}
                {bulkDeleting ? 'Deleting...' : 'Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="ea-bulk-bar">
          <span className="ea-bulk-count">{selectedIds.size} selected</span>
          <button className="ea-bulk-clear" onClick={clearSelection}>Clear</button>
          <button className="ea-bulk-delete-action" onClick={() => setBulkDeleteOpen(true)}>
            <Trash2 size={14} /> Delete Selected
          </button>
        </div>
      )}
    </div>
  );
}
