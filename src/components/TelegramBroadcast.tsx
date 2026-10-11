import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowLeft, Loader2, Plus, Send, Trash2, Eye, AlertTriangle,
  RefreshCw, Users, CheckCircle2, XCircle, Clock,
} from 'lucide-react';

type TgCampaign = {
  id: string;
  message_text: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
};

type TgRecipient = {
  id: string;
  campaign_id: string;
  telegram_chat_id: number;
  telegram_username: string | null;
  telegram_first_name: string | null;
  status: string;
  error_message: string | null;
  sent_at: string | null;
};

export default function TelegramBroadcast({ session, onBack }: { session: Session; onBack: () => void }) {
  const [campaigns, setCampaigns] = useState<TgCampaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [recipientCount, setRecipientCount] = useState(0);
  const [selectedCampaign, setSelectedCampaign] = useState<TgCampaign | null>(null);
  const [recipients, setRecipients] = useState<TgRecipient[]>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);

  useEffect(() => {
    fetchCampaigns();
    fetchRecipientCount();
  }, []);

  const getToken = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData.session?.access_token;
  };

  const fetchCampaigns = async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getToken();
      if (!token) return;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-broadcast?action=list`;
      const res = await fetch(apiUrl, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Failed to load campaigns');
        return;
      }
      setCampaigns(data.campaigns || []);
    } catch {
      setError('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecipientCount = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-broadcast?action=count`;
      const res = await fetch(apiUrl, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok || data.error) return;
      setRecipientCount(data.count || 0);
    } catch {
      // non-fatal
    }
  };

  const fetchRecipients = async (campaignId: string) => {
    setRecipientsLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-broadcast?action=get&campaign_id=${campaignId}`;
      const res = await fetch(apiUrl, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Failed to load recipients');
        return;
      }
      setRecipients(data.recipients || []);
      setSelectedCampaign(data.campaign || null);
    } catch {
      setError('Failed to load recipients');
    } finally {
      setRecipientsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!messageText.trim() || recipientCount === 0) return;
    setCreating(true);
    setError('');
    try {
      const token = await getToken();
      if (!token) return;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-broadcast?action=create`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message_text: messageText.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Failed to create broadcast');
        setCreating(false);
        return;
      }
      setShowForm(false);
      setMessageText('');
      await fetchCampaigns();
    } catch {
      setError('Failed to create broadcast');
    } finally {
      setCreating(false);
    }
  };

  const handleSend = async (campaignId: string) => {
    if (!confirm('Start sending this broadcast? Messages will be sent one by one to all recipients.')) return;
    setSending(true);
    setSendingId(campaignId);
    setError('');
    try {
      const token = await getToken();
      if (!token) return;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-broadcast?action=send`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Failed to send broadcast');
        return;
      }
      await fetchCampaigns();
      if (selectedCampaign?.id === campaignId) {
        await fetchRecipients(campaignId);
      }
    } catch {
      setError('Failed to send broadcast');
    } finally {
      setSending(false);
      setSendingId(null);
    }
  };

  const handleDelete = async (campaignId: string) => {
    if (!confirm('Delete this broadcast campaign? This cannot be undone.')) return;
    setError('');
    try {
      const token = await getToken();
      if (!token) return;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-broadcast?action=delete`;
      const res = await fetch(apiUrl, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Failed to delete campaign');
        return;
      }
      if (selectedCampaign?.id === campaignId) {
        setSelectedCampaign(null);
        setRecipients([]);
      }
      await fetchCampaigns();
    } catch {
      setError('Failed to delete campaign');
    }
  };

  const aggregateStats = campaigns.reduce(
    (acc, c) => {
      acc.total += c.total_recipients;
      acc.sent += c.sent_count;
      acc.failed += c.failed_count;
      return acc;
    },
    { total: 0, sent: 0, failed: 0 }
  );

  const statusConfig: Record<string, { bg: string; color: string }> = {
    completed: { bg: 'rgba(22,163,74,0.12)', color: '#16a34a' },
    sending: { bg: 'rgba(59,130,246,0.12)', color: '#2563eb' },
    failed: { bg: 'rgba(239,68,68,0.12)', color: '#dc2626' },
    draft: { bg: 'rgba(234,179,8,0.12)', color: '#854d0e' },
  };

  const recipientStatusConfig: Record<string, { bg: string; color: string }> = {
    sent: { bg: 'rgba(22,163,74,0.12)', color: '#16a34a' },
    failed: { bg: 'rgba(239,68,68,0.12)', color: '#dc2626' },
    pending: { bg: 'rgba(100,116,139,0.12)', color: 'var(--text-dark)' },
  };

  return (
    <div className="wb-container">
      {/* Header */}
      <div className="wb-header">
        <div className="wb-header-left">
          <button className="wb-back-btn" onClick={onBack} aria-label="Back to dashboard">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="wb-title">Telegram Broadcast</h1>
            <p className="wb-subtitle">Send a message to all your Telegram contacts at once</p>
          </div>
        </div>
        <div className="wb-header-actions">
          <button className="wb-refresh-btn" onClick={fetchCampaigns} disabled={loading}>
            {loading ? <Loader2 size={16} className="crm-spin" /> : <RefreshCw size={16} />}
            Refresh
          </button>
          {!selectedCampaign && !showForm && (
            <button className="wb-new-btn" onClick={() => setShowForm(true)}>
              <Plus size={16} /> New Broadcast
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="wb-error-banner">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {selectedCampaign ? (
        <div className="wb-detail-view">
          <button className="wb-back-link" onClick={() => { setSelectedCampaign(null); setRecipients([]); }}>
            <ArrowLeft size={14} /> Back to campaigns
          </button>

          <div className="wb-detail-info">
            <div className="wb-detail-info-card">
              <span className="wb-detail-info-label">Message</span>
              <span className="wb-detail-info-value" style={{ maxWidth: '400px', whiteSpace: 'pre-wrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selectedCampaign.message_text}
              </span>
            </div>
            <div className="wb-detail-info-card">
              <span className="wb-detail-info-label">Status</span>
              <span
                className="wb-status-pill"
                style={{ background: (statusConfig[selectedCampaign.status] || statusConfig.draft).bg, color: (statusConfig[selectedCampaign.status] || statusConfig.draft).color }}
              >
                {selectedCampaign.status}
              </span>
            </div>
          </div>

          <div className="wb-detail-stats">
            {[
              { label: 'Total', value: selectedCampaign.total_recipients, icon: <Users size={16} />, color: 'var(--text-muted)' },
              { label: 'Sent', value: selectedCampaign.sent_count, icon: <Send size={16} />, color: '#2563eb' },
              { label: 'Failed', value: selectedCampaign.failed_count, icon: <XCircle size={16} />, color: '#dc2626' },
            ].map((stat) => (
              <div key={stat.label} className="wb-detail-stat-tile">
                <div className="wb-detail-stat-icon" style={{ color: stat.color, background: `${stat.color}15` }}>{stat.icon}</div>
                <span className="wb-detail-stat-value" style={{ color: stat.color }}>{stat.value}</span>
                <span className="wb-detail-stat-label">{stat.label}</span>
              </div>
            ))}
          </div>

          <div className="wb-card wb-card-elevated">
            <div className="wb-card-header">
              <div className="wb-card-title">
                <div className="wb-card-icon wb-card-icon-green"><Eye size={18} /></div>
                <h2>Recipients</h2>
                <span className="wb-log-count">{recipients.length}</span>
              </div>
            </div>
            {recipientsLoading ? (
              <div className="wb-loading-state">
                <Loader2 size={28} className="crm-spin" style={{ color: '#0088cc' }} />
                <p>Loading recipients...</p>
              </div>
            ) : recipients.length === 0 ? (
              <div className="wb-empty-state">
                <Users size={40} style={{ opacity: 0.25, marginBottom: 10 }} />
                <p>No recipients in this campaign.</p>
              </div>
            ) : (
              <div className="wb-table-wrap">
                <table className="wb-table">
                  <thead>
                    <tr>
                      <th>Recipient</th>
                      <th>Status</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipients.map((r) => (
                      <tr key={r.id}>
                        <td className="wb-td-phone">
                          {r.telegram_first_name || r.telegram_username || `Chat ${r.telegram_chat_id}`}
                          {r.telegram_username && ` (@${r.telegram_username})`}
                        </td>
                        <td>
                          <span className="wb-status-pill wb-status-sm" style={{ background: (recipientStatusConfig[r.status] || recipientStatusConfig.pending).bg, color: (recipientStatusConfig[r.status] || recipientStatusConfig.pending).color }}>
                            {r.status}
                          </span>
                        </td>
                        <td className="wb-td-error">{r.error_message || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : showForm ? (
        <div className="wb-card wb-card-elevated wb-form-card">
          <div className="wb-card-header">
            <div className="wb-card-title">
              <div className="wb-card-icon wb-card-icon-green"><Plus size={18} /></div>
              <h2>Create New Broadcast</h2>
            </div>
            <button className="wb-cancel-link" onClick={() => setShowForm(false)}>
              <ArrowLeft size={14} /> Cancel
            </button>
          </div>

          <div className="wb-form-body">
            <label className="wb-field">
              <span>Message <em>*</em></span>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                className="wb-select"
                rows={5}
                placeholder="Type your broadcast message here..."
                style={{ resize: 'vertical', fontFamily: 'inherit', padding: '10px 12px' }}
              />
              <small className="wb-field-hint">
                This message will be sent to all {recipientCount} Telegram contacts who have messaged your bot.
              </small>
            </label>

            <div className="wb-warn-box">
              <AlertTriangle size={16} />
              <div>
                <strong>Before you send:</strong> Make sure your Telegram bot is configured in Settings. Messages are sent one by one with a small delay between each to avoid rate limits.
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreate}
              disabled={!messageText.trim() || recipientCount === 0 || creating}
              className="wb-create-btn"
            >
              {creating ? <Loader2 size={18} className="crm-spin" /> : <Send size={16} />}
              {creating ? 'Creating...' : `Create Broadcast (${recipientCount} recipients)`}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="wb-stats-grid">
            {[
              { icon: <Send size={22} />, value: campaigns.length, label: 'Total Campaigns', color: 'green' },
              { icon: <Users size={22} />, value: aggregateStats.total, label: 'Total Recipients', color: 'blue' },
              { icon: <CheckCircle2 size={22} />, value: aggregateStats.sent, label: 'Sent', color: 'cyan' },
              { icon: <XCircle size={22} />, value: aggregateStats.failed, label: 'Failed', color: 'red' },
            ].map((card, i) => (
              <div key={i} className={`wb-stat-card wb-stat-${card.color}`}>
                <div className="wb-stat-glow" />
                <div className="wb-stat-top">
                  <div className="wb-stat-icon-wrap">{card.icon}</div>
                </div>
                <span className="wb-stat-value">{card.value}</span>
                <span className="wb-stat-label">{card.label}</span>
              </div>
            ))}
          </div>

          {/* Campaign List */}
          <div className="wb-card wb-card-elevated">
            <div className="wb-card-header">
              <div className="wb-card-title">
                <div className="wb-card-icon wb-card-icon-green"><Send size={18} /></div>
                <h2>Campaigns</h2>
                <span className="wb-log-count">{campaigns.length}</span>
              </div>
            </div>

            {loading ? (
              <div className="wb-loading-state">
                <Loader2 size={28} className="crm-spin" style={{ color: '#0088cc' }} />
                <p>Loading campaigns...</p>
              </div>
            ) : campaigns.length === 0 ? (
              <div className="wb-empty-state">
                <Send size={40} style={{ opacity: 0.25, marginBottom: 10 }} />
                <h3>No broadcast campaigns yet</h3>
                <p>Click "New Broadcast" to send a message to all your Telegram contacts at once.</p>
              </div>
            ) : (
              <div className="wb-campaign-list">
                {campaigns.map((camp) => {
                  const progress = camp.total_recipients > 0 ? Math.round(((camp.sent_count + camp.failed_count) / camp.total_recipients) * 100) : 0;
                  const sc = statusConfig[camp.status] || statusConfig.draft;
                  return (
                    <div key={camp.id} className="wb-campaign-item">
                      <div className="wb-campaign-top">
                        <div className="wb-campaign-info">
                          <span className="wb-campaign-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {camp.message_text}
                          </span>
                          <span className="wb-campaign-date">
                            <Clock size={11} /> {new Date(camp.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </div>
                        <span className="wb-status-pill" style={{ background: sc.bg, color: sc.color }}>{camp.status}</span>
                      </div>

                      <div className="wb-campaign-stats">
                        <span><strong>{camp.total_recipients}</strong> recipients</span>
                        <span className="wb-campaign-stat-blue"><strong>{camp.sent_count}</strong> sent</span>
                        <span className="wb-campaign-stat-red"><strong>{camp.failed_count}</strong> failed</span>
                      </div>

                      {(camp.status === 'sending' || camp.status === 'completed') && (
                        <div className="wb-progress-track">
                          <div
                            className="wb-progress-fill"
                            style={{ width: `${progress}%`, background: camp.status === 'completed' ? '#16a34a' : '#2563eb' }}
                          />
                        </div>
                      )}

                      <div className="wb-campaign-actions">
                        <button className="wb-action-btn wb-action-btn-ghost" onClick={() => fetchRecipients(camp.id)}>
                          <Eye size={13} /> Details
                        </button>
                        {camp.status === 'draft' && (
                          <button
                            className="wb-action-btn wb-action-btn-primary"
                            onClick={() => handleSend(camp.id)}
                            disabled={sending && sendingId === camp.id}
                          >
                            {sending && sendingId === camp.id ? <Loader2 size={13} className="crm-spin" /> : <Send size={13} />}
                            {sending && sendingId === camp.id ? 'Sending...' : 'Send Now'}
                          </button>
                        )}
                        <button className="wb-action-btn wb-action-btn-danger" onClick={() => handleDelete(camp.id)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
