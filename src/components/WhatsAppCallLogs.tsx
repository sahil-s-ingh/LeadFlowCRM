import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowLeft, Phone, PhoneMissed, PhoneIncoming, PhoneOutgoing,
  Clock, CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw,
  MessageSquare, PhoneCall, TrendingUp, BarChart3, Filter, Search,
  Calendar, PhoneOff, User, Zap, ChevronRight, Activity,
} from 'lucide-react';

type CallSession = {
  id: string;
  user_id: string | null;
  phone_number: string;
  call_id: string | null;
  status: string;
  direction: string;
  created_at: string;
  updated_at: string;
  call_duration: number | null;
  call_start_time: string | null;
  call_end_time: string | null;
  error_code: number | null;
  error_message: string | null;
  recording_enabled: boolean;
  transcription_enabled: boolean;
};

type LeadInfo = {
  id: string;
  full_name: string | null;
  mobile_number: string | null;
  status: string | null;
};

const MISSED_STATUSES = ['rejected', 'no-answer', 'failed'];
const INCOMING_DIR = 'user_initiated';
const OUTGOING_DIR = 'business_initiated';

const STATUS_CONFIG: Record<string, { bg: string; color: string; icon: React.ReactNode; label: string }> = {
  incoming_ringing: { bg: 'rgba(59,130,246,0.12)', color: '#2563eb', icon: <PhoneIncoming size={13} />, label: 'Ringing' },
  ringing: { bg: 'rgba(59,130,246,0.12)', color: '#2563eb', icon: <PhoneIncoming size={13} />, label: 'Ringing' },
  accepted: { bg: 'rgba(22,163,74,0.12)', color: '#16a34a', icon: <PhoneCall size={13} />, label: 'Answered' },
  ended: { bg: 'rgba(22,163,74,0.12)', color: '#16a34a', icon: <CheckCircle2 size={13} />, label: 'Completed' },
  rejected: { bg: 'rgba(239,68,68,0.12)', color: '#dc2626', icon: <PhoneOff size={13} />, label: 'Rejected' },
  'no-answer': { bg: 'rgba(234,179,8,0.12)', color: '#854d0e', icon: <PhoneMissed size={13} />, label: 'Missed' },
  failed: { bg: 'rgba(239,68,68,0.12)', color: '#dc2626', icon: <XCircle size={13} />, label: 'Failed' },
  busy: { bg: 'rgba(234,179,8,0.12)', color: '#854d0e', icon: <PhoneOff size={13} />, label: 'Busy' },
  initiating: { bg: 'rgba(100,116,139,0.12)', color: '#64748b', icon: <Clock size={13} />, label: 'Initiating' },
};

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getHourLabel(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

export default function WhatsAppCallLogs({ session, onBack }: { session: Session; onBack: () => void }) {
  const [calls, setCalls] = useState<CallSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'missed' | 'incoming' | 'outgoing' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | 'all'>('7d');
  const [leadMap, setLeadMap] = useState<Record<string, LeadInfo>>({});
  const [callbackLoading, setCallbackLoading] = useState<string | null>(null);
  const [selectedCall, setSelectedCall] = useState<CallSession | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let query = supabase.from('wa_call_sessions').select('*').order('created_at', { ascending: false }).limit(200);
      if (dateRange !== 'all') {
        const days = dateRange === 'today' ? 1 : dateRange === '7d' ? 7 : 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - (days - 1));
        startDate.setHours(0, 0, 0, 0);
        query = query.gte('created_at', startDate.toISOString());
      }
      const { data, err } = await query;
      if (err) { setError(err.message); return; }
      setCalls(data || []);

      const phoneNumbers = [...new Set((data || []).map((c) => c.phone_number).filter(Boolean))];
      if (phoneNumbers.length > 0) {
        const { data: leads } = await supabase
          .from('submissions')
          .select('id, full_name, mobile_number, status')
          .in('mobile_number', phoneNumbers)
          .is('deleted_at', null);
        const map: Record<string, LeadInfo> = {};
        (leads || []).forEach((l: any) => {
          if (l.mobile_number) map[l.mobile_number.trim().replace(/^\+/, '')] = l;
        });
        setLeadMap(map);
      }
    } catch {
      setError('Failed to load call logs');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { fetchCalls(); }, [fetchCalls]);

  // Realtime subscription for new/updated calls
  useEffect(() => {
    const channel = supabase
      .channel('wa-call-logs-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_call_sessions' }, () => {
        fetchCalls();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchCalls]);

  const handleCallback = async (call: CallSession, method: 'call' | 'message') => {
    setCallbackLoading(call.id);
    setError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      if (method === 'call') {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'initiate', phone_number: call.phone_number }),
        });
        const data = await res.json();
        if (!res.ok || data.error) { setError(data.error || 'Failed to initiate call'); return; }
      } else {
        const lead = leadMap[call.phone_number];
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp-message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            to: call.phone_number,
            message: `Hi${lead?.full_name ? ` ${lead.full_name}` : ''}, sorry we missed your call. How can we help you today?`,
            lead_id: lead?.id || null,
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) { setError(data.error || 'Failed to send message'); return; }
      }
    } catch {
      setError(`Failed to ${method === 'call' ? 'initiate call' : 'send message'}`);
    } finally {
      setCallbackLoading(null);
    }
  };

  const filteredCalls = calls.filter((c) => {
    if (filter === 'missed' && !MISSED_STATUSES.includes(c.status) && c.status !== 'incoming_ringing') return false;
    if (filter === 'incoming' && c.direction !== INCOMING_DIR) return false;
    if (filter === 'outgoing' && c.direction !== OUTGOING_DIR) return false;
    if (filter === 'completed' && c.status !== 'ended' && c.status !== 'accepted') return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const lead = leadMap[c.phone_number];
      const matches = c.phone_number.includes(q) || (lead?.full_name?.toLowerCase().includes(q) || false);
      if (!matches) return false;
    }
    return true;
  });

  const stats = {
    total: calls.length,
    missed: calls.filter((c) => MISSED_STATUSES.includes(c.status) || (c.status === 'incoming_ringing' && c.direction === INCOMING_DIR)).length,
    incoming: calls.filter((c) => c.direction === INCOMING_DIR).length,
    outgoing: calls.filter((c) => c.direction === OUTGOING_DIR).length,
    completed: calls.filter((c) => c.status === 'ended' || c.status === 'accepted').length,
  };
  const missedRate = stats.total > 0 ? Math.round((stats.missed / stats.total) * 100) : 0;
  const avgDuration = (() => {
    const durations = calls.filter((c) => c.call_duration && c.call_duration > 0).map((c) => c.call_duration!);
    return durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
  })();

  // Hourly heatmap data
  const heatmapData = Array.from({ length: 24 }, () => 0);
  calls.forEach((c) => {
    const hour = new Date(c.created_at).getHours();
    heatmapData[hour]++;
  });
  const maxHeat = Math.max(...heatmapData, 1);

  // Day-of-week data
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayData = Array.from({ length: 7 }, () => ({ total: 0, missed: 0 }));
  calls.forEach((c) => {
    const day = new Date(c.created_at).getDay();
    dayData[day].total++;
    if (MISSED_STATUSES.includes(c.status) || (c.status === 'incoming_ringing' && c.direction === INCOMING_DIR)) {
      dayData[day].missed++;
    }
  });

  const missedCallsList = calls.filter(
    (c) => MISSED_STATUSES.includes(c.status) || (c.status === 'incoming_ringing' && c.direction === INCOMING_DIR)
  );

  return (
    <div className="wcl-container">
      {/* Header */}
      <div className="wcl-header">
        <div className="wcl-header-left">
          <button className="wcl-back-btn" onClick={onBack}><ArrowLeft size={18} /></button>
          <div>
            <h1 className="wcl-title">WhatsApp Call Logs</h1>
            <p className="wcl-subtitle">Track all calls, recover missed calls, and analyze call patterns</p>
          </div>
        </div>
        <div className="wcl-header-actions">
          <button className="wcl-refresh-btn" onClick={() => setShowAnalytics(!showAnalytics)}>
            <BarChart3 size={16} /> {showAnalytics ? 'Hide Analytics' : 'Analytics'}
          </button>
          <button className="wcl-refresh-btn" onClick={fetchCalls} disabled={loading}>
            {loading ? <Loader2 size={16} className="crm-spin" /> : <RefreshCw size={16} />} Refresh
          </button>
        </div>
      </div>

      {error && <div className="wcl-error-banner"><AlertTriangle size={16} /> {error}</div>}

      {/* Stats Grid */}
      <div className="wcl-stats-grid">
        {[
          { icon: <Phone size={20} />, value: stats.total, label: 'Total Calls', color: 'blue', sub: `${stats.incoming} in · ${stats.outgoing} out` },
          { icon: <PhoneMissed size={20} />, value: stats.missed, label: 'Missed Calls', color: 'red', sub: `${missedRate}% miss rate` },
          { icon: <CheckCircle2 size={20} />, value: stats.completed, label: 'Completed', color: 'green', sub: `${stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}% rate` },
          { icon: <Clock size={20} />, value: formatDuration(avgDuration), label: 'Avg Duration', color: 'cyan', sub: 'per call' },
        ].map((card, i) => (
          <div key={i} className={`wcl-stat-card wcl-stat-${card.color}`}>
            <div className="wcl-stat-glow" />
            <div className="wcl-stat-top"><div className="wcl-stat-icon-wrap">{card.icon}</div></div>
            <span className="wcl-stat-value">{card.value}</span>
            <span className="wcl-stat-label">{card.label}</span>
            <span className="wcl-stat-sub">{card.sub}</span>
          </div>
        ))}
      </div>

      {/* Analytics Section */}
      {showAnalytics && (
        <div className="wcl-analytics-section">
          {/* Hourly heatmap */}
          <div className="wcl-card wcl-card-elevated">
            <div className="wcl-card-header">
              <div className="wcl-card-title">
                <div className="wcl-card-icon wcl-card-icon-blue"><Activity size={18} /></div>
                <h2>Call Activity by Hour</h2>
              </div>
            </div>
            <div className="wcl-heatmap">
              {heatmapData.map((count, hour) => {
                const intensity = count / maxHeat;
                const isPeak = count === maxHeat && count > 0;
                return (
                  <div key={hour} className="wcl-heatmap-bar" title={`${getHourLabel(hour)}: ${count} call${count !== 1 ? 's' : ''}`}>
                    <div
                      className="wcl-heatmap-fill"
                      style={{
                        height: `${Math.max(intensity * 100, 4)}%`,
                        background: isPeak ? '#dc2626' : `rgba(37, 99, 235, ${0.2 + intensity * 0.6})`,
                      }}
                    />
                    <span className="wcl-heatmap-count">{count}</span>
                    <span className="wcl-heatmap-label">{hour % 3 === 0 ? getHourLabel(hour).replace(' ', '') : ''}</span>
                  </div>
                );
              })}
            </div>
            <div className="wcl-heatmap-legend">
              <span>Less</span>
              <div className="wcl-heatmap-legend-bar" />
              <span>More</span>
            </div>
          </div>

          {/* Day of week breakdown */}
          <div className="wcl-card wcl-card-elevated">
            <div className="wcl-card-header">
              <div className="wcl-card-title">
                <div className="wcl-card-icon wcl-card-icon-green"><Calendar size={18} /></div>
                <h2>Calls by Day of Week</h2>
              </div>
            </div>
            <div className="wcl-dow-chart">
              {dayData.map((d, i) => {
                const maxTotal = Math.max(...dayData.map((x) => x.total), 1);
                const totalH = (d.total / maxTotal) * 100;
                const missH = d.total > 0 ? (d.missed / d.total) * totalH : 0;
                return (
                  <div key={i} className="wcl-dow-col" title={`${dayNames[i]}: ${d.total} total, ${d.missed} missed`}>
                    <div className="wcl-dow-bars">
                      <div className="wcl-dow-bar-total" style={{ height: `${totalH}%` }}>
                        <div className="wcl-dow-bar-missed" style={{ height: `${totalH > 0 ? (missH / totalH) * 100 : 0}%` }} />
                      </div>
                    </div>
                    <span className="wcl-dow-label">{dayNames[i]}</span>
                    <span className="wcl-dow-count">{d.total}</span>
                  </div>
                );
              })}
            </div>
            <div className="wcl-dow-legend">
              <div className="wcl-dow-legend-item"><span className="wcl-dow-legend-dot wcl-dow-legend-total" /> Total</div>
              <div className="wcl-dow-legend-item"><span className="wcl-dow-legend-dot wcl-dow-legend-missed" /> Missed</div>
            </div>
          </div>
        </div>
      )}

      {/* Missed Call Recovery Banner */}
      {missedCallsList.length > 0 && !selectedCall && (
        <div className="wcl-recovery-banner">
          <div className="wcl-recovery-icon"><PhoneMissed size={20} /></div>
          <div className="wcl-recovery-info">
            <strong>{missedCallsList.length} missed call{missedCallsList.length !== 1 ? 's' : ''} need attention</strong>
            <span>Call back or send a WhatsApp message to recover these leads.</span>
          </div>
          <button className="wcl-recovery-btn" onClick={() => setFilter('missed')}>
            View Missed <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Filters & Search */}
      {!selectedCall && (
        <div className="wcl-filters-bar">
          <div className="wcl-filter-tabs">
            {[
              { key: 'all', label: 'All Calls', icon: <Phone size={14} /> },
              { key: 'missed', label: 'Missed', icon: <PhoneMissed size={14} /> },
              { key: 'incoming', label: 'Incoming', icon: <PhoneIncoming size={14} /> },
              { key: 'outgoing', label: 'Outgoing', icon: <PhoneOutgoing size={14} /> },
              { key: 'completed', label: 'Completed', icon: <CheckCircle2 size={14} /> },
            ].map((tab) => (
              <button
                key={tab.key}
                className={`wcl-filter-tab ${filter === tab.key ? 'active' : ''}`}
                onClick={() => setFilter(tab.key as typeof filter)}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
          <div className="wcl-filter-right">
            <div className="wcl-search-box">
              <Search size={14} />
              <input
                type="text"
                placeholder="Search phone or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select value={dateRange} onChange={(e) => setDateRange(e.target.value as typeof dateRange)} className="wcl-date-select">
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="all">All time</option>
            </select>
          </div>
        </div>
      )}

      {/* Detail View */}
      {selectedCall ? (
        <div className="wcl-detail-view">
          <button className="wcl-back-link" onClick={() => setSelectedCall(null)}>
            <ArrowLeft size={14} /> Back to call logs
          </button>

          <div className="wcl-detail-header">
            <div className={`wcl-detail-icon ${MISSED_STATUSES.includes(selectedCall.status) ? 'wcl-detail-icon-missed' : 'wcl-detail-icon-ok'}`}>
              {MISSED_STATUSES.includes(selectedCall.status) ? <PhoneMissed size={28} /> : <PhoneCall size={28} />}
            </div>
            <div className="wcl-detail-info">
              <h2>{leadMap[selectedCall.phone_number]?.full_name || selectedCall.phone_number}</h2>
              <span className="wcl-detail-phone">{selectedCall.phone_number}</span>
              <div className="wcl-detail-meta">
                <span className="wcl-status-pill" style={{ background: (STATUS_CONFIG[selectedCall.status] || STATUS_CONFIG.initiating).bg, color: (STATUS_CONFIG[selectedCall.status] || STATUS_CONFIG.initiating).color }}>
                  {(STATUS_CONFIG[selectedCall.status] || STATUS_CONFIG.initiating).icon}
                  {(STATUS_CONFIG[selectedCall.status] || STATUS_CONFIG.initiating).label}
                </span>
                <span className="wcl-detail-direction">
                  {selectedCall.direction === INCOMING_DIR ? <PhoneIncoming size={13} /> : <PhoneOutgoing size={13} />}
                  {selectedCall.direction === INCOMING_DIR ? 'Incoming' : 'Outgoing'}
                </span>
              </div>
            </div>
          </div>

          <div className="wcl-detail-grid">
            <div className="wcl-detail-card">
              <span className="wcl-detail-card-label"><Clock size={14} /> Date & Time</span>
              <span className="wcl-detail-card-value">{new Date(selectedCall.created_at).toLocaleString()}</span>
            </div>
            <div className="wcl-detail-card">
              <span className="wcl-detail-card-label"><PhoneCall size={14} /> Duration</span>
              <span className="wcl-detail-card-value">{formatDuration(selectedCall.call_duration)}</span>
            </div>
            <div className="wcl-detail-card">
              <span className="wcl-detail-card-label"><User size={14} /> Lead</span>
              <span className="wcl-detail-card-value">{leadMap[selectedCall.phone_number]?.full_name || 'Not found'}</span>
              {leadMap[selectedCall.phone_number]?.status && (
                <span className="wcl-detail-card-sub">Status: {leadMap[selectedCall.phone_number].status}</span>
              )}
            </div>
            <div className="wcl-detail-card">
              <span className="wcl-detail-card-label"><Activity size={14} /> Call ID</span>
              <span className="wcl-detail-card-value wcl-detail-mono">{selectedCall.call_id || '—'}</span>
            </div>
            {selectedCall.call_start_time && (
              <div className="wcl-detail-card">
                <span className="wcl-detail-card-label"><PhoneIncoming size={14} /> Start Time</span>
                <span className="wcl-detail-card-value">{new Date(selectedCall.call_start_time).toLocaleString()}</span>
              </div>
            )}
            {selectedCall.call_end_time && (
              <div className="wcl-detail-card">
                <span className="wcl-detail-card-label"><PhoneOff size={14} /> End Time</span>
                <span className="wcl-detail-card-value">{new Date(selectedCall.call_end_time).toLocaleString()}</span>
              </div>
            )}
            {selectedCall.error_message && (
              <div className="wcl-detail-card wcl-detail-card-error">
                <span className="wcl-detail-card-label"><AlertTriangle size={14} /> Error</span>
                <span className="wcl-detail-card-value">{selectedCall.error_message}</span>
                {selectedCall.error_code && <span className="wcl-detail-card-sub">Code: {selectedCall.error_code}</span>}
              </div>
            )}
          </div>

          {/* Recovery actions */}
          <div className="wcl-detail-actions">
            <button
              className="wcl-action-btn wcl-action-btn-call"
              onClick={() => handleCallback(selectedCall, 'call')}
              disabled={callbackLoading === selectedCall.id}
            >
              {callbackLoading === selectedCall.id ? <Loader2 size={16} className="crm-spin" /> : <PhoneCall size={16} />}
              Call Back
            </button>
            <button
              className="wcl-action-btn wcl-action-btn-msg"
              onClick={() => handleCallback(selectedCall, 'message')}
              disabled={callbackLoading === selectedCall.id}
            >
              {callbackLoading === selectedCall.id ? <Loader2 size={16} className="crm-spin" /> : <MessageSquare size={16} />}
              Send WhatsApp Message
            </button>
          </div>
        </div>
      ) : (
        /* Call Logs Table */
        <div className="wcl-card wcl-card-elevated">
          <div className="wcl-card-header">
            <div className="wcl-card-title">
              <div className="wcl-card-icon wcl-card-icon-green"><Phone size={18} /></div>
              <h2>Call History</h2>
              <span className="wcl-log-count">{filteredCalls.length}</span>
            </div>
          </div>

          {loading ? (
            <div className="wcl-loading-state">
              <Loader2 size={28} className="crm-spin" style={{ color: '#25D366' }} />
              <p>Loading call logs...</p>
            </div>
          ) : filteredCalls.length === 0 ? (
            <div className="wcl-empty-state">
              <Phone size={40} style={{ opacity: 0.25, marginBottom: 10 }} />
              <h3>No calls found</h3>
              <p>{filter === 'missed' ? 'No missed calls in this time range.' : 'Try changing the filter or date range.'}</p>
            </div>
          ) : (
            <div className="wcl-table-wrap">
              <table className="wcl-table">
                <thead>
                  <tr>
                    <th>Direction</th>
                    <th>Caller</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Time</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCalls.map((call) => {
                    const sc = STATUS_CONFIG[call.status] || STATUS_CONFIG.initiating;
                    const lead = leadMap[call.phone_number];
                    const isMissed = MISSED_STATUSES.includes(call.status) || (call.status === 'incoming_ringing' && call.direction === INCOMING_DIR);
                    return (
                      <tr key={call.id} className={isMissed ? 'wcl-row-missed' : ''} onClick={() => setSelectedCall(call)} style={{ cursor: 'pointer' }}>
                        <td>
                          <div className="wcl-direction-cell">
                            {call.direction === INCOMING_DIR
                              ? <PhoneIncoming size={15} style={{ color: '#2563eb' }} />
                              : <PhoneOutgoing size={15} style={{ color: '#64748b' }} />}
                          </div>
                        </td>
                        <td className="wcl-td-name">
                          {lead?.full_name || <span className="wcl-td-unknown">Unknown</span>}
                          {lead?.status && <span className="wcl-td-lead-status">{lead.status}</span>}
                        </td>
                        <td className="wcl-td-phone">{call.phone_number}</td>
                        <td>
                          <span className="wcl-status-pill" style={{ background: sc.bg, color: sc.color }}>
                            {sc.icon} {sc.label}
                          </span>
                        </td>
                        <td className="wcl-td-duration">{formatDuration(call.call_duration)}</td>
                        <td className="wcl-td-time">{formatTimeAgo(call.created_at)}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          {isMissed && (
                            <div className="wcl-row-actions">
                              <button
                                className="wcl-mini-btn wcl-mini-btn-call"
                                onClick={() => handleCallback(call, 'call')}
                                disabled={callbackLoading === call.id}
                                title="Call back"
                              >
                                {callbackLoading === call.id ? <Loader2 size={13} className="crm-spin" /> : <PhoneCall size={13} />}
                              </button>
                              <button
                                className="wcl-mini-btn wcl-mini-btn-msg"
                                onClick={() => handleCallback(call, 'message')}
                                disabled={callbackLoading === call.id}
                                title="Send WhatsApp message"
                              >
                                {callbackLoading === call.id ? <Loader2 size={13} className="crm-spin" /> : <MessageSquare size={13} />}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Info Section */}
      {!selectedCall && (
        <div className="wcl-info-section">
          <div className="wcl-info-card">
            <div className="wcl-info-icon"><Zap size={18} /></div>
            <div>
              <h4>About Call Logs</h4>
              <ul>
                <li><strong>All WhatsApp calls:</strong> See incoming, outgoing, missed, and completed calls in one place.</li>
                <li><strong>Missed call recovery:</strong> Call back or send a WhatsApp message directly from the missed call row.</li>
                <li><strong>Real-time updates:</strong> New calls and status changes appear automatically without refreshing.</li>
                <li><strong>Analytics:</strong> View call activity by hour and day to identify peak times and optimize coverage.</li>
                <li><strong>Lead matching:</strong> Calls are automatically matched to your existing leads by phone number.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
