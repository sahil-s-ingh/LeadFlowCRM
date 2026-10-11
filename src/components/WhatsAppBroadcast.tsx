import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowLeft, Loader2, Plus, Send, Trash2, Eye, AlertTriangle,
  RefreshCw, Users, CheckCircle2, XCircle, Clock,
} from 'lucide-react';

type WaTemplate = {
  meta_template_id: string | null;
  name: string;
  language: string;
  category: string;
  status: string;
  components: any[];
  rejection_reason: string | null;
};

type BroadcastCampaign = {
  id: string;
  template_name: string;
  template_language: string;
  template_components: any[];
  status: string;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  created_at: string;
};

type BroadcastRecipient = {
  id: string;
  campaign_id: string;
  phone_number: string;
  lead_id: string | null;
  status: string;
  error_message: string | null;
  sent_at: string | null;
};

export default function WhatsAppBroadcast({ session, onBack }: { session: Session; onBack: () => void }) {
  const [waTemplates, setWaTemplates] = useState<WaTemplate[]>([]);
  const [broadcasts, setBroadcasts] = useState<BroadcastCampaign[]>([]);
  const [broadcastsLoading, setBroadcastsLoading] = useState(false);
  const [broadcastError, setBroadcastError] = useState('');
  const [showBroadcastForm, setShowBroadcastForm] = useState(false);
  const [broadcastTplName, setBroadcastTplName] = useState('');
  const [broadcastTplLanguage, setBroadcastTplLanguage] = useState('en_US');
  const [broadcastTplComponents, setBroadcastTplComponents] = useState<any[]>([]);
  const [broadcastRecipientFilter, setBroadcastRecipientFilter] = useState<'all' | 'new' | 'interested' | 'called_responded' | 'called_no_response' | 'converted' | 'not_interested'>('all');
  const [broadcastRecipientCount, setBroadcastRecipientCount] = useState(0);
  const [broadcastCreating, setBroadcastCreating] = useState(false);
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastSendingId, setBroadcastSendingId] = useState<string | null>(null);
  const [selectedBroadcast, setSelectedBroadcast] = useState<BroadcastCampaign | null>(null);
  const [broadcastRecipients, setBroadcastRecipients] = useState<BroadcastRecipient[]>([]);
  const [broadcastRecipientsLoading, setBroadcastRecipientsLoading] = useState(false);

  useEffect(() => {
    fetchWaTemplates();
    fetchBroadcasts();
    fetchBroadcastRecipientCount(broadcastRecipientFilter);
  }, []);

  useEffect(() => {
    fetchBroadcastRecipientCount(broadcastRecipientFilter);
  }, [broadcastRecipientFilter]);

  const fetchWaTemplates = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates?action=list`;
      const res = await fetch(apiUrl, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok || data.error) return;
      setWaTemplates(data.templates || []);
    } catch {
      // non-fatal
    }
  };

  const fetchBroadcasts = async () => {
    setBroadcastsLoading(true);
    setBroadcastError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-broadcast?action=list`;
      const res = await fetch(apiUrl, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok || data.error) {
        setBroadcastError(data.error || 'Failed to load campaigns');
        return;
      }
      setBroadcasts(data.campaigns || []);
    } catch {
      setBroadcastError('Failed to load campaigns');
    } finally {
      setBroadcastsLoading(false);
    }
  };

  const fetchBroadcastRecipients = async (campaignId: string) => {
    setBroadcastRecipientsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-broadcast?action=get&campaign_id=${campaignId}`;
      const res = await fetch(apiUrl, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok || data.error) {
        setBroadcastError(data.error || 'Failed to load recipients');
        return;
      }
      setBroadcastRecipients(data.recipients || []);
      setSelectedBroadcast(data.campaign || null);
    } catch {
      setBroadcastError('Failed to load recipients');
    } finally {
      setBroadcastRecipientsLoading(false);
    }
  };

  const fetchBroadcastRecipientCount = async (filter: string) => {
    let query = supabase.from('submissions').select('id', { count: 'exact', head: true }).is('deleted_at', null);
    if (filter !== 'all') {
      query = query.eq('status', filter);
    }
    const { count } = await query;
    setBroadcastRecipientCount(count || 0);
  };

  const handleSelectBroadcastTemplate = (tplName: string) => {
    const tpl = waTemplates.find((t) => t.name === tplName && t.status === 'APPROVED');
    if (!tpl) return;
    setBroadcastTplName(tpl.name);
    setBroadcastTplLanguage(tpl.language);
    setBroadcastTplComponents(tpl.components || []);
  };

  const handleCreateBroadcast = async () => {
    if (!broadcastTplName || broadcastRecipientCount === 0) return;
    setBroadcastCreating(true);
    setBroadcastError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      let query = supabase.from('submissions').select('id, mobile_number').is('deleted_at', null);
      if (broadcastRecipientFilter !== 'all') {
        query = query.eq('status', broadcastRecipientFilter);
      }
      const { data: leads } = await query;
      if (!leads || leads.length === 0) {
        setBroadcastError('No leads found matching the filter');
        setBroadcastCreating(false);
        return;
      }

      const recipients = leads
        .filter((l: { mobile_number: string }) => l.mobile_number && l.mobile_number.trim())
        .map((l: { id: string; mobile_number: string }) => ({
          lead_id: l.id,
          phone_number: l.mobile_number.trim(),
        }));

      if (recipients.length === 0) {
        setBroadcastError('No leads with valid phone numbers found');
        setBroadcastCreating(false);
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-broadcast?action=create`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          template_name: broadcastTplName,
          template_language: broadcastTplLanguage,
          template_components: broadcastTplComponents,
          recipients,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setBroadcastError(data.error || 'Failed to create broadcast');
        setBroadcastCreating(false);
        return;
      }
      setShowBroadcastForm(false);
      setBroadcastTplName('');
      setBroadcastTplComponents([]);
      setBroadcastRecipientFilter('all');
      await fetchBroadcasts();
    } catch {
      setBroadcastError('Failed to create broadcast');
    } finally {
      setBroadcastCreating(false);
    }
  };

  const handleSendBroadcast = async (campaignId: string) => {
    if (!confirm('Start sending this broadcast? Messages will be sent one by one to all pending recipients.')) return;
    setBroadcastSending(true);
    setBroadcastSendingId(campaignId);
    setBroadcastError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-broadcast?action=send`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setBroadcastError(data.error || 'Failed to send broadcast');
        return;
      }
      await fetchBroadcasts();
      if (selectedBroadcast?.id === campaignId) {
        await fetchBroadcastRecipients(campaignId);
      }
    } catch {
      setBroadcastError('Failed to send broadcast');
    } finally {
      setBroadcastSending(false);
      setBroadcastSendingId(null);
    }
  };

  const handleDeleteBroadcast = async (campaignId: string) => {
    if (!confirm('Delete this broadcast campaign? This cannot be undone.')) return;
    setBroadcastError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-broadcast?action=delete`;
      const res = await fetch(apiUrl, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setBroadcastError(data.error || 'Failed to delete campaign');
        return;
      }
      if (selectedBroadcast?.id === campaignId) {
        setSelectedBroadcast(null);
        setBroadcastRecipients([]);
      }
      await fetchBroadcasts();
    } catch {
      setBroadcastError('Failed to delete campaign');
    }
  };

  const approvedTemplates = waTemplates.filter((t) => t.status === 'APPROVED');

  const aggregateStats = broadcasts.reduce(
    (acc, c) => {
      acc.total += c.total_recipients;
      acc.sent += c.sent_count;
      acc.delivered += c.delivered_count;
      acc.failed += c.failed_count;
      return acc;
    },
    { total: 0, sent: 0, delivered: 0, failed: 0 }
  );

  const statusConfig: Record<string, { bg: string; color: string }> = {
    completed: { bg: 'rgba(22,163,74,0.12)', color: '#16a34a' },
    sending: { bg: 'rgba(59,130,246,0.12)', color: '#2563eb' },
    failed: { bg: 'rgba(239,68,68,0.12)', color: '#dc2626' },
    draft: { bg: 'rgba(234,179,8,0.12)', color: '#854d0e' },
  };

  const recipientStatusConfig: Record<string, { bg: string; color: string }> = {
    sent: { bg: 'rgba(37,99,235,0.12)', color: '#2563eb' },
    delivered: { bg: 'rgba(22,163,74,0.12)', color: '#16a34a' },
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
            <h1 className="wb-title">WhatsApp Broadcast</h1>
            <p className="wb-subtitle">Send approved template messages to many leads at once</p>
          </div>
        </div>
        <div className="wb-header-actions">
          <button className="wb-refresh-btn" onClick={fetchBroadcasts} disabled={broadcastsLoading}>
            {broadcastsLoading ? <Loader2 size={16} className="crm-spin" /> : <RefreshCw size={16} />}
            Refresh
          </button>
          {!selectedBroadcast && !showBroadcastForm && (
            <button className="wb-new-btn" onClick={() => { setShowBroadcastForm(true); fetchBroadcastRecipientCount(broadcastRecipientFilter); }}>
              <Plus size={16} /> New Broadcast
            </button>
          )}
        </div>
      </div>

      {broadcastError && (
        <div className="wb-error-banner">
          <AlertTriangle size={16} /> {broadcastError}
        </div>
      )}

      {selectedBroadcast ? (
        <div className="wb-detail-view">
          <button className="wb-back-link" onClick={() => { setSelectedBroadcast(null); setBroadcastRecipients([]); }}>
            <ArrowLeft size={14} /> Back to campaigns
          </button>

          <div className="wb-detail-info">
            <div className="wb-detail-info-card">
              <span className="wb-detail-info-label">Template</span>
              <span className="wb-detail-info-value">{selectedBroadcast.template_name}</span>
              <span className="wb-detail-info-sub">{selectedBroadcast.template_language}</span>
            </div>
            <div className="wb-detail-info-card">
              <span className="wb-detail-info-label">Status</span>
              <span
                className="wb-status-pill"
                style={{ background: (statusConfig[selectedBroadcast.status] || statusConfig.draft).bg, color: (statusConfig[selectedBroadcast.status] || statusConfig.draft).color }}
              >
                {selectedBroadcast.status}
              </span>
            </div>
          </div>

          <div className="wb-detail-stats">
            {[
              { label: 'Total', value: selectedBroadcast.total_recipients, icon: <Users size={16} />, color: 'var(--text-muted)' },
              { label: 'Sent', value: selectedBroadcast.sent_count, icon: <Send size={16} />, color: '#2563eb' },
              { label: 'Delivered', value: selectedBroadcast.delivered_count, icon: <CheckCircle2 size={16} />, color: '#16a34a' },
              { label: 'Failed', value: selectedBroadcast.failed_count, icon: <XCircle size={16} />, color: '#dc2626' },
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
                <span className="wb-log-count">{broadcastRecipients.length}</span>
              </div>
            </div>
            {broadcastRecipientsLoading ? (
              <div className="wb-loading-state">
                <Loader2 size={28} className="crm-spin" style={{ color: '#25D366' }} />
                <p>Loading recipients...</p>
              </div>
            ) : broadcastRecipients.length === 0 ? (
              <div className="wb-empty-state">
                <Users size={40} style={{ opacity: 0.25, marginBottom: 10 }} />
                <p>No recipients in this campaign.</p>
              </div>
            ) : (
              <div className="wb-table-wrap">
                <table className="wb-table">
                  <thead>
                    <tr>
                      <th>Phone</th>
                      <th>Status</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {broadcastRecipients.map((r) => (
                      <tr key={r.id}>
                        <td className="wb-td-phone">+{r.phone_number}</td>
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
      ) : showBroadcastForm ? (
        <div className="wb-card wb-card-elevated wb-form-card">
          <div className="wb-card-header">
            <div className="wb-card-title">
              <div className="wb-card-icon wb-card-icon-green"><Plus size={18} /></div>
              <h2>Create New Broadcast</h2>
            </div>
            <button className="wb-cancel-link" onClick={() => setShowBroadcastForm(false)}>
              <ArrowLeft size={14} /> Cancel
            </button>
          </div>

          <div className="wb-form-body">
            <label className="wb-field">
              <span>Select Template <em>*</em></span>
              <select
                value={broadcastTplName}
                onChange={(e) => handleSelectBroadcastTemplate(e.target.value)}
                className="wb-select"
              >
                <option value="">Choose an approved template...</option>
                {approvedTemplates.map((t) => (
                  <option key={t.name} value={t.name}>{t.name} ({t.language})</option>
                ))}
              </select>
              {approvedTemplates.length === 0 && (
                <small className="wb-field-hint wb-field-hint-error">
                  No approved templates yet. Go to WhatsApp Templates to create and get templates approved first.
                </small>
              )}
            </label>

            <label className="wb-field">
              <span>Recipient Filter <em>*</em></span>
              <select
                value={broadcastRecipientFilter}
                onChange={(e) => setBroadcastRecipientFilter(e.target.value as typeof broadcastRecipientFilter)}
                className="wb-select"
              >
                <option value="all">All Leads ({broadcastRecipientCount})</option>
                <option value="new">New Leads ({broadcastRecipientCount})</option>
                <option value="called_no_response">Called — No Response ({broadcastRecipientCount})</option>
                <option value="called_responded">Called — Responded ({broadcastRecipientCount})</option>
                <option value="interested">Interested ({broadcastRecipientCount})</option>
                <option value="not_interested">Not Interested ({broadcastRecipientCount})</option>
                <option value="converted">Converted ({broadcastRecipientCount})</option>
              </select>
              <small className="wb-field-hint">
                Only leads with a phone number will be included. The count updates when you change the filter.
              </small>
            </label>

            <div className="wb-warn-box">
              <AlertTriangle size={16} />
              <div>
                <strong>Before you send:</strong> Make sure your WhatsApp Business number is verified and your account has enough daily messaging quota. New accounts start at 250-1,000 unique contacts per day. Messages are sent one by one with a small delay between each.
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreateBroadcast}
              disabled={!broadcastTplName || broadcastRecipientCount === 0 || broadcastCreating}
              className="wb-create-btn"
            >
              {broadcastCreating ? <Loader2 size={18} className="crm-spin" /> : <Send size={16} />}
              {broadcastCreating ? 'Creating...' : `Create Broadcast (${broadcastRecipientCount} recipients)`}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="wb-stats-grid">
            {[
              { icon: <Send size={22} />, value: broadcasts.length, label: 'Total Campaigns', color: 'green' },
              { icon: <Users size={22} />, value: aggregateStats.total, label: 'Total Recipients', color: 'blue' },
              { icon: <CheckCircle2 size={22} />, value: aggregateStats.delivered, label: 'Delivered', color: 'cyan' },
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
                <span className="wb-log-count">{broadcasts.length}</span>
              </div>
            </div>

            {broadcastsLoading ? (
              <div className="wb-loading-state">
                <Loader2 size={28} className="crm-spin" style={{ color: '#25D366' }} />
                <p>Loading campaigns...</p>
              </div>
            ) : broadcasts.length === 0 ? (
              <div className="wb-empty-state">
                <Send size={40} style={{ opacity: 0.25, marginBottom: 10 }} />
                <h3>No broadcast campaigns yet</h3>
                <p>Click "New Broadcast" to send a WhatsApp template to many leads at once.</p>
              </div>
            ) : (
              <div className="wb-campaign-list">
                {broadcasts.map((camp) => {
                  const progress = camp.total_recipients > 0 ? Math.round(((camp.sent_count + camp.failed_count) / camp.total_recipients) * 100) : 0;
                  const sc = statusConfig[camp.status] || statusConfig.draft;
                  return (
                    <div key={camp.id} className="wb-campaign-item">
                      <div className="wb-campaign-top">
                        <div className="wb-campaign-info">
                          <span className="wb-campaign-name">{camp.template_name}</span>
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
                        <button className="wb-action-btn wb-action-btn-ghost" onClick={() => fetchBroadcastRecipients(camp.id)}>
                          <Eye size={13} /> Details
                        </button>
                        {camp.status === 'draft' && (
                          <button
                            className="wb-action-btn wb-action-btn-primary"
                            onClick={() => handleSendBroadcast(camp.id)}
                            disabled={broadcastSending && broadcastSendingId === camp.id}
                          >
                            {broadcastSending && broadcastSendingId === camp.id ? <Loader2 size={13} className="crm-spin" /> : <Send size={13} />}
                            {broadcastSending && broadcastSendingId === camp.id ? 'Sending...' : 'Send Now'}
                          </button>
                        )}
                        <button className="wb-action-btn wb-action-btn-danger" onClick={() => handleDeleteBroadcast(camp.id)}>
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
