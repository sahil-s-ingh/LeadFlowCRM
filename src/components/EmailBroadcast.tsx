import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowLeft, Loader2, Plus, Send, Trash2, Eye, AlertTriangle,
  RefreshCw, Users, CheckCircle2, XCircle, Clock, Mail,
} from 'lucide-react';

type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
  is_active: boolean;
};

type EmailCampaign = {
  id: string;
  subject: string;
  body: string;
  html_body: string | null;
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
};

type EmailRecipient = {
  id: string;
  campaign_id: string;
  lead_id: string | null;
  email: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
};

export default function EmailBroadcast({ session, onBack }: { session: Session; onBack: () => void }) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignError, setCampaignError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientFilter, setRecipientFilter] = useState<'all' | 'new' | 'interested' | 'called_responded' | 'called_no_response' | 'converted' | 'not_interested'>('all');
  const [recipientCount, setRecipientCount] = useState(0);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<EmailCampaign | null>(null);
  const [recipients, setRecipients] = useState<EmailRecipient[]>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);

  useEffect(() => {
    fetchTemplates();
    fetchCampaigns();
    fetchRecipientCount(recipientFilter);
  }, []);

  useEffect(() => {
    fetchRecipientCount(recipientFilter);
  }, [recipientFilter]);

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from('email_templates')
      .select('id, name, subject, body, category, is_active')
      .eq('is_active', true)
      .order('name', { ascending: true });
    setTemplates((data || []) as EmailTemplate[]);
  };

  const fetchCampaigns = async () => {
    setCampaignsLoading(true);
    setCampaignError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-broadcast?action=list`;
      const res = await fetch(apiUrl, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok || data.error) {
        setCampaignError(data.error || 'Failed to load campaigns');
        return;
      }
      setCampaigns(data.campaigns || []);
    } catch {
      setCampaignError('Failed to load campaigns');
    } finally {
      setCampaignsLoading(false);
    }
  };

  const fetchCampaignRecipients = async (campaignId: string) => {
    setRecipientsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-broadcast?action=get&campaign_id=${campaignId}`;
      const res = await fetch(apiUrl, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok || data.error) {
        setCampaignError(data.error || 'Failed to load recipients');
        return;
      }
      setRecipients(data.recipients || []);
      setSelectedCampaign(data.campaign || null);
    } catch {
      setCampaignError('Failed to load recipients');
    } finally {
      setRecipientsLoading(false);
    }
  };

  const fetchRecipientCount = async (filter: string) => {
    let query = supabase.from('submissions').select('id', { count: 'exact', head: true }).is('deleted_at', null);
    if (filter !== 'all') {
      query = query.eq('status', filter);
    }
    const { count } = await query;
    setRecipientCount(count || 0);
  };

  const handleSelectTemplate = (tplId: string) => {
    setSelectedTemplateId(tplId);
    const tpl = templates.find((t) => t.id === tplId);
    if (tpl) {
      setSubject(tpl.subject);
      setBody(tpl.body);
    }
  };

  const handleCreateCampaign = async () => {
    if (!subject.trim() || !body.trim() || recipientCount === 0) return;
    setCreating(true);
    setCampaignError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      let query = supabase.from('submissions').select('id, email').is('deleted_at', null);
      if (recipientFilter !== 'all') {
        query = query.eq('status', recipientFilter);
      }
      const { data: leads } = await query;
      if (!leads || leads.length === 0) {
        setCampaignError('No leads found matching the filter');
        setCreating(false);
        return;
      }

      const recipientsList = leads
        .filter((l: { email: string }) => l.email && l.email.trim())
        .map((l: { id: string; email: string }) => ({
          lead_id: l.id,
          email: l.email.trim(),
        }));

      if (recipientsList.length === 0) {
        setCampaignError('No leads with valid email addresses found');
        setCreating(false);
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-broadcast?action=create`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          subject: subject.trim(),
          body: body.trim(),
          recipients: recipientsList,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setCampaignError(data.error || 'Failed to create campaign');
        setCreating(false);
        return;
      }
      setShowForm(false);
      setSubject('');
      setBody('');
      setSelectedTemplateId('');
      setRecipientFilter('all');
      await fetchCampaigns();
    } catch {
      setCampaignError('Failed to create campaign');
    } finally {
      setCreating(false);
    }
  };

  const handleSendCampaign = async (campaignId: string) => {
    if (!confirm('Start sending this email broadcast? Emails will be sent one by one to all pending recipients.')) return;
    setSending(true);
    setSendingId(campaignId);
    setCampaignError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-broadcast?action=send`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setCampaignError(data.error || 'Failed to send campaign');
        return;
      }
      await fetchCampaigns();
      if (selectedCampaign?.id === campaignId) {
        await fetchCampaignRecipients(campaignId);
      }
    } catch {
      setCampaignError('Failed to send campaign');
    } finally {
      setSending(false);
      setSendingId(null);
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm('Delete this email broadcast campaign? This cannot be undone.')) return;
    setCampaignError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-broadcast?action=delete`;
      const res = await fetch(apiUrl, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setCampaignError(data.error || 'Failed to delete campaign');
        return;
      }
      if (selectedCampaign?.id === campaignId) {
        setSelectedCampaign(null);
        setRecipients([]);
      }
      await fetchCampaigns();
    } catch {
      setCampaignError('Failed to delete campaign');
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
    sent: { bg: 'rgba(37,99,235,0.12)', color: '#2563eb' },
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
            <h1 className="wb-title">Email Broadcast</h1>
            <p className="wb-subtitle">Send a personalized email to many leads at once with open and click tracking</p>
          </div>
        </div>
        <div className="wb-header-actions">
          <button className="wb-refresh-btn" onClick={fetchCampaigns} disabled={campaignsLoading}>
            {campaignsLoading ? <Loader2 size={16} className="crm-spin" /> : <RefreshCw size={16} />}
            Refresh
          </button>
          {!selectedCampaign && !showForm && (
            <button className="wb-new-btn" onClick={() => { setShowForm(true); fetchRecipientCount(recipientFilter); }}>
              <Plus size={16} /> New Broadcast
            </button>
          )}
        </div>
      </div>

      {campaignError && (
        <div className="wb-error-banner">
          <AlertTriangle size={16} /> {campaignError}
        </div>
      )}

      {selectedCampaign ? (
        <div className="wb-detail-view">
          <button className="wb-back-link" onClick={() => { setSelectedCampaign(null); setRecipients([]); }}>
            <ArrowLeft size={14} /> Back to campaigns
          </button>

          <div className="wb-detail-info">
            <div className="wb-detail-info-card">
              <span className="wb-detail-info-label">Subject</span>
              <span className="wb-detail-info-value">{selectedCampaign.subject}</span>
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
                <Loader2 size={28} className="crm-spin" style={{ color: '#2563eb' }} />
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
                      <th>Email</th>
                      <th>Status</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipients.map((r) => (
                      <tr key={r.id}>
                        <td className="wb-td-phone">{r.email}</td>
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
              <h2>Create New Email Broadcast</h2>
            </div>
            <button className="wb-cancel-link" onClick={() => setShowForm(false)}>
              <ArrowLeft size={14} /> Cancel
            </button>
          </div>

          <div className="wb-form-body">
            <label className="wb-field">
              <span>Use a Template (optional)</span>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleSelectTemplate(e.target.value)}
                className="wb-select"
              >
                <option value="">Write from scratch...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {templates.length === 0 && (
                <small className="wb-field-hint">
                  No email templates yet. You can write your own below or create templates in WhatsApp Templates.
                </small>
              )}
            </label>

            <label className="wb-field">
              <span>Subject <em>*</em></span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject line..."
                className="wb-input"
              />
            </label>

            <label className="wb-field">
              <span>Email Body <em>*</em></span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                placeholder="Write your email content here. Links will be clickable and tracked automatically."
                className="wb-textarea"
                style={{ width: '100%', fontFamily: 'inherit', resize: 'vertical' }}
              />
              <small className="wb-field-hint">
                Plain text is fine. URLs will be turned into clickable tracked links. Each recipient gets an individual email.
              </small>
            </label>

            <label className="wb-field">
              <span>Recipient Filter <em>*</em></span>
              <select
                value={recipientFilter}
                onChange={(e) => setRecipientFilter(e.target.value as typeof recipientFilter)}
                className="wb-select"
              >
                <option value="all">All Leads ({recipientCount})</option>
                <option value="new">New Leads ({recipientCount})</option>
                <option value="called_no_response">Called — No Response ({recipientCount})</option>
                <option value="called_responded">Called — Responded ({recipientCount})</option>
                <option value="interested">Interested ({recipientCount})</option>
                <option value="not_interested">Not Interested ({recipientCount})</option>
                <option value="converted">Converted ({recipientCount})</option>
              </select>
              <small className="wb-field-hint">
                Only leads with an email address will be included. The count updates when you change the filter.
              </small>
            </label>

            <div className="wb-warn-box">
              <AlertTriangle size={16} />
              <div>
                <strong>Before you send:</strong> Make sure your SMTP settings are configured in Settings. Emails are sent one by one with a small delay between each to avoid spam filters. Each email is logged in Email Analytics with open and click tracking.
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreateCampaign}
              disabled={!subject.trim() || !body.trim() || recipientCount === 0 || creating}
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
              { icon: <Mail size={22} />, value: campaigns.length, label: 'Total Campaigns', color: 'green' },
              { icon: <Users size={22} />, value: aggregateStats.total, label: 'Total Recipients', color: 'blue' },
              { icon: <Send size={22} />, value: aggregateStats.sent, label: 'Emails Sent', color: 'cyan' },
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
                <div className="wb-card-icon wb-card-icon-green"><Mail size={18} /></div>
                <h2>Campaigns</h2>
                <span className="wb-log-count">{campaigns.length}</span>
              </div>
            </div>

            {campaignsLoading ? (
              <div className="wb-loading-state">
                <Loader2 size={28} className="crm-spin" style={{ color: '#2563eb' }} />
                <p>Loading campaigns...</p>
              </div>
            ) : campaigns.length === 0 ? (
              <div className="wb-empty-state">
                <Mail size={40} style={{ opacity: 0.25, marginBottom: 10 }} />
                <h3>No email broadcast campaigns yet</h3>
                <p>Click "New Broadcast" to send an email to many leads at once.</p>
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
                          <span className="wb-campaign-name">{camp.subject}</span>
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
                        <button className="wb-action-btn wb-action-btn-ghost" onClick={() => fetchCampaignRecipients(camp.id)}>
                          <Eye size={13} /> Details
                        </button>
                        {camp.status === 'draft' && (
                          <button
                            className="wb-action-btn wb-action-btn-primary"
                            onClick={() => handleSendCampaign(camp.id)}
                            disabled={sending && sendingId === camp.id}
                          >
                            {sending && sendingId === camp.id ? <Loader2 size={13} className="crm-spin" /> : <Send size={13} />}
                            {sending && sendingId === camp.id ? 'Sending...' : 'Send Now'}
                          </button>
                        )}
                        <button className="wb-action-btn wb-action-btn-danger" onClick={() => handleDeleteCampaign(camp.id)}>
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
