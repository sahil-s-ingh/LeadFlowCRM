import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Plus, Trash2, Edit3, Save, X, Loader2, AlertCircle, CheckCircle2,
  Webhook, Copy, Send, Zap, Clock, RefreshCw, ExternalLink, Power,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { GoogleSheetsIntegration } from './GoogleSheetsIntegration';
import { FileSpreadsheet } from 'lucide-react';

type WebhookEvent =
  | 'lead_created' | 'lead_status_changed' | 'lead_converted'
  | 'lead_assigned' | 'lead_note_added' | 'lead_deleted';

type IntegrationWebhook = {
  id: string;
  user_id: string;
  name: string;
  url: string;
  secret_token: string;
  events: WebhookEvent[];
  is_active: boolean;
  last_delivery_at: string | null;
  last_delivery_status: string | null;
  created_at: string;
};

type Delivery = {
  id: string;
  webhook_id: string;
  event: string;
  payload: Record<string, unknown>;
  status: string;
  response_code: number | null;
  response_body: string | null;
  attempts: number;
  created_at: string;
};

const EVENT_OPTIONS: { key: WebhookEvent; label: string; desc: string; color: string }[] = [
  { key: 'lead_created', label: 'New Lead', desc: 'Fires when a lead is added to the CRM', color: '#2563eb' },
  { key: 'lead_status_changed', label: 'Status Changed', desc: 'Fires when a lead moves pipeline stages', color: '#f59e0b' },
  { key: 'lead_converted', label: 'Lead Converted', desc: 'Fires when a lead is marked as converted', color: '#16a34a' },
  { key: 'lead_assigned', label: 'Lead Assigned', desc: 'Fires when a lead is assigned to a team member', color: '#0f766e' },
  { key: 'lead_note_added', label: 'Note Added', desc: 'Fires when a note is added to a lead', color: '#7c3aed' },
  { key: 'lead_deleted', label: 'Lead Deleted', desc: 'Fires when a lead is removed', color: '#dc2626' },
];

const PLATFORMS = [
  {
    name: 'Pabbly Connect',
    url: 'https://www.pabbly.com/connect/',
    color: '#00b4d8',
    steps: [
      'Log in to Pabbly Connect and create a new workflow.',
      'Choose "Webhooks by Pabbly" as the trigger app and select "Catch Hook".',
      'Copy the webhook URL Pabbly generates for you.',
      'Paste that URL into a webhook endpoint below and select the events you want.',
      'Click "Test Fire" to send a sample payload — Pabbly will capture it and let you map fields.',
    ],
  },
  {
    name: 'Make.com',
    url: 'https://www.make.com/',
    color: '#6d00cc',
    steps: [
      'Log in to Make.com and create a new scenario.',
      'Add a "Custom Webhook" module and click "Add" to create a new webhook.',
      'Copy the webhook URL Make generates.',
      'Paste that URL into a webhook endpoint below and select the events you want.',
      'Click "Test Fire" to send a sample payload — Make will receive it and let you map the data.',
    ],
  },
  {
    name: 'Zapier',
    url: 'https://zapier.com/apps/webhook/integrations/webhook',
    color: '#ff4f00',
    steps: [
      'Log in to Zapier and click "Create Zap".',
      'Choose "Webhooks by Zapier" as the trigger and select "Catch Hook".',
      'Copy the webhook URL Zapier provides.',
      'Paste that URL into a webhook endpoint below and select the events you want.',
      'Click "Test Fire" to send a sample payload — Zapier will capture it for field mapping.',
    ],
  },
];

export function IntegrationHub({ session }: { session: Session | null }) {
  const [webhooks, setWebhooks] = useState<IntegrationWebhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formEvents, setFormEvents] = useState<WebhookEvent[]>(['lead_created']);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'endpoints' | 'event_log' | 'platforms' | 'google_sheets'>('endpoints');
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [expandedDelivery, setExpandedDelivery] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const fetchWebhooks = useCallback(async () => {
    setLoading(true);
    const { data, err } = await supabase
      .from('integration_webhooks')
      .select('*')
      .order('created_at', { ascending: false });
    if (err) setError(err.message);
    else setWebhooks((data || []) as IntegrationWebhook[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchWebhooks(); }, [fetchWebhooks]);

  const fetchDeliveries = useCallback(async () => {
    setDeliveriesLoading(true);
    const { data } = await supabase
      .from('integration_webhook_deliveries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setDeliveries((data || []) as Delivery[]);
    setDeliveriesLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'event_log') fetchDeliveries();
  }, [activeTab, fetchDeliveries]);

  const resetForm = () => {
    setFormName('');
    setFormUrl('');
    setFormEvents(['lead_created']);
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (wh: IntegrationWebhook) => {
    setEditingId(wh.id);
    setFormName(wh.name);
    setFormUrl(wh.url);
    setFormEvents(wh.events);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formUrl.trim()) { setError('Name and URL are required'); return; }
    if (!formUrl.startsWith('https://')) { setError('URL must start with https://'); return; }
    setSaving(true);
    setError('');

    if (editingId) {
      const { error: updErr } = await supabase
        .from('integration_webhooks')
        .update({ name: formName.trim(), url: formUrl.trim(), events: formEvents, updated_at: new Date().toISOString() })
        .eq('id', editingId);
      if (updErr) setError(updErr.message);
      else { setSuccess('Webhook updated successfully'); resetForm(); fetchWebhooks(); }
    } else {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) { setError('Not authenticated'); setSaving(false); return; }
      const { error: insErr } = await supabase
        .from('integration_webhooks')
        .insert({ name: formName.trim(), url: formUrl.trim(), events: formEvents, user_id: userId });
      if (insErr) setError(insErr.message);
      else { setSuccess('Webhook created successfully'); resetForm(); fetchWebhooks(); }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this webhook? Delivery logs will also be removed.')) return;
    await supabase.from('integration_webhooks').delete().eq('id', id);
    fetchWebhooks();
  };

  const toggleActive = async (wh: IntegrationWebhook) => {
    await supabase.from('integration_webhooks')
      .update({ is_active: !wh.is_active, updated_at: new Date().toISOString() })
      .eq('id', wh.id);
    fetchWebhooks();
  };

  const toggleEvent = (ev: WebhookEvent) => {
    setFormEvents((prev) => prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]);
  };

  const testFire = async (wh: IntegrationWebhook) => {
    setTestingId(wh.id);
    setError('');
    const { data: sessionData } = await supabase.auth.getSession();
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/integration-webhooks`;
    try {
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          webhook_id: wh.id,
          event: wh.events[0] || 'lead_created',
          payload: {
            test: true,
            lead: {
              id: 'test-lead-00000000-0000-0000-0000-000000000000',
              full_name: 'Test Lead',
              email: 'test@example.com',
              mobile_number: '+1234567890',
              status: 'new',
              created_at: new Date().toISOString(),
            },
          },
        }),
      });
      if (!resp.ok) {
        const body = await resp.text();
        setError(`Test fire failed (${resp.status}): ${body.slice(0, 200)}`);
      } else {
        setSuccess('Test event sent! Check your platform to confirm it was received.');
        fetchWebhooks();
      }
    } catch (err) {
      setError(`Test fire error: ${String(err)}`);
    }
    setTestingId(null);
  };

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const statusColor = (status: string) => {
    if (status === 'delivered') return '#16a34a';
    if (status === 'failed') return '#dc2626';
    if (status === 'retrying') return '#f59e0b';
    return '#64748b';
  };

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(37,99,235,0.1)' }}>
            <Webhook size={24} style={{ color: '#2563eb' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Integrations</h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-dark)', margin: '2px 0 0' }}>
              Connect your CRM to 5,000+ apps via Pabbly, Make.com, or Zapier using outbound webhooks.
            </p>
          </div>
        </div>
      </div>

      {error && <Banner type="error" message={error} onClose={() => setError('')} />}
      {success && <Banner type="success" message={success} onClose={() => setSuccess('')} />}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)' }}>
        {([
          { key: 'endpoints', label: 'Webhook Endpoints', icon: <Webhook size={14} /> },
          { key: 'event_log', label: 'Event Log', icon: <Clock size={14} /> },
          { key: 'platforms', label: 'Platform Guides', icon: <Zap size={14} /> },
          { key: 'google_sheets', label: 'Google Sheets', icon: <FileSpreadsheet size={14} /> },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 16px', border: 'none', borderBottom: activeTab === tab.key ? '2px solid #2563eb' : '2px solid transparent',
              background: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
              color: activeTab === tab.key ? '#2563eb' : 'var(--text-dark)',
              transition: 'all 0.15s', marginBottom: '-1px',
              display: 'inline-flex', alignItems: 'center', gap: '6px',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Endpoints Tab */}
      {activeTab === 'endpoints' && (
        <div>
          {!showForm && (
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
                background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px',
                fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', marginBottom: '16px', transition: 'background 0.15s',
              }}
            >
              <Plus size={16} /> Add Webhook Endpoint
            </button>
          )}

          {showForm && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 16px' }}>
                {editingId ? 'Edit Webhook' : 'New Webhook Endpoint'}
              </h3>

              <Field label="Name" style={{ marginBottom: '14px' }}>
                <input
                  type="text" value={formName} onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. New Lead → Google Sheets"
                  style={inputStyle}
                />
              </Field>

              <Field label="Destination URL (from Pabbly / Make / Zapier)" style={{ marginBottom: '14px' }}>
                <input
                  type="url" value={formUrl} onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://hook.us1.make.com/..."
                  style={inputStyle}
                />
              </Field>

              <div style={{ marginBottom: '16px' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginBottom: '8px' }}>
                  Events to subscribe
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                  {EVENT_OPTIONS.map((ev) => {
                    const selected = formEvents.includes(ev.key);
                    return (
                      <button
                        key={ev.key} type="button" onClick={() => toggleEvent(ev.key)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
                          borderRadius: '8px', border: `2px solid ${selected ? ev.color : 'var(--border-subtle)'}`,
                          background: selected ? `${ev.color}10` : 'var(--bg-card)',
                          cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: ev.color, flexShrink: 0, opacity: selected ? 1 : 0.3 }} />
                        <div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>{ev.label}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-dark)' }}>{ev.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
                  {saving ? <Loader2 size={16} className="crm-spin" /> : <Save size={16} />}
                  {editingId ? 'Update' : 'Create'} Webhook
                </button>
                <button onClick={resetForm} style={btnSecondary}>Cancel</button>
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Loader2 size={28} className="crm-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
          ) : webhooks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-dark)' }}>
              <Webhook size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>No webhook endpoints yet</p>
              <p style={{ fontSize: '0.82rem' }}>Add a webhook to start sending lead events to your favorite apps.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {webhooks.map((wh) => (
                <div key={wh.id} style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                  borderRadius: '12px', padding: '16px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{wh.name}</strong>
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '100px',
                          background: wh.is_active ? 'rgba(22,163,74,0.1)' : 'rgba(148,163,184,0.15)',
                          color: wh.is_active ? '#16a34a' : '#94a3b8',
                        }}>
                          {wh.is_active ? 'ACTIVE' : 'PAUSED'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                        <ExternalLink size={12} style={{ flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wh.url}</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {wh.events.map((ev) => {
                          const opt = EVENT_OPTIONS.find((o) => o.key === ev);
                          return (
                            <span key={ev} style={{
                              fontSize: '0.65rem', fontWeight: 600, padding: '2px 8px', borderRadius: '6px',
                              background: `${opt?.color || '#64748b'}15`, color: opt?.color || '#64748b',
                            }}>
                              {opt?.label || ev}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button onClick={() => toggleActive(wh)} title={wh.is_active ? 'Pause' : 'Activate'} style={iconBtn}>
                        <Power size={14} style={{ color: wh.is_active ? '#16a34a' : '#94a3b8' }} />
                      </button>
                      <button onClick={() => testFire(wh)} disabled={testingId === wh.id} title="Send test event" style={iconBtn}>
                        {testingId === wh.id ? <Loader2 size={14} className="crm-spin" /> : <Send size={14} style={{ color: '#2563eb' }} />}
                      </button>
                      <button onClick={() => startEdit(wh)} title="Edit" style={iconBtn}>
                        <Edit3 size={14} />
                      </button>
                      <button onClick={() => handleDelete(wh.id)} title="Delete" style={{ ...iconBtn, color: '#dc2626', borderColor: 'rgba(239,68,68,0.2)' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--bg-light)', borderRadius: '8px', fontSize: '0.72rem', color: 'var(--text-dark)' }}>
                    <span style={{ fontWeight: 600 }}>Secret:</span>
                    <code style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {wh.secret_token.slice(0, 12)}...{wh.secret_token.slice(-6)}
                    </code>
                    <button onClick={() => copyToken(wh.secret_token)} style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', color: 'var(--text-dark)' }}>
                      {copiedToken === wh.secret_token ? <CheckCircle2 size={12} style={{ color: '#16a34a' }} /> : <Copy size={12} />}
                      {copiedToken === wh.secret_token ? 'Copied' : 'Copy'}
                    </button>
                  </div>

                  {wh.last_delivery_at && (
                    <div style={{ marginTop: '8px', fontSize: '0.7rem', color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={12} />
                      Last delivery: {new Date(wh.last_delivery_at).toLocaleString()}
                      {wh.last_delivery_status && (
                        <span style={{
                          fontWeight: 600, color: statusColor(wh.last_delivery_status),
                        }}>
                          ({wh.last_delivery_status})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Google Sheets Tab */}
      {activeTab === 'google_sheets' && (
        <GoogleSheetsIntegration session={session} />
      )}

      {/* Event Log Tab */}
      {activeTab === 'event_log' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-dark)', margin: 0 }}>
              Recent webhook deliveries. Click a row to see the full payload and response.
            </p>
            <button onClick={fetchDeliveries} style={btnSecondary}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {deliveriesLoading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Loader2 size={28} className="crm-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
          ) : deliveries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-dark)' }}>
              <Clock size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>No deliveries yet</p>
              <p style={{ fontSize: '0.82rem' }}>Webhook deliveries will appear here once events fire.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {deliveries.map((d) => {
                const wh = webhooks.find((w) => w.id === d.webhook_id);
                const expanded = expandedDelivery === d.id;
                return (
                  <div key={d.id} style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                    borderRadius: '10px', overflow: 'hidden',
                  }}>
                    <div
                      onClick={() => setExpandedDelivery(expanded ? null : d.id)}
                      style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
                    >
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColor(d.status), flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>
                          {wh?.name || 'Unknown webhook'} — {d.event}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-dark)' }}>
                          {new Date(d.created_at).toLocaleString()} · {d.attempts} attempt{d.attempts !== 1 ? 's' : ''}
                          {d.response_code && ` · HTTP ${d.response_code}`}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 700, padding: '2px 10px', borderRadius: '100px',
                        background: `${statusColor(d.status)}15`, color: statusColor(d.status),
                        textTransform: 'capitalize',
                      }}>
                        {d.status}
                      </span>
                    </div>
                    {expanded && (
                      <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border-subtle)' }}>
                        <div style={{ marginTop: '12px' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-dark)' }}>Payload:</span>
                          <pre style={{
                            marginTop: '4px', padding: '10px', background: 'var(--bg-light)', borderRadius: '8px',
                            fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--text-main)',
                            overflow: 'auto', maxHeight: '200px', whiteSpace: 'pre-wrap',
                          }}>
                            {JSON.stringify(d.payload, null, 2)}
                          </pre>
                        </div>
                        {d.response_body && (
                          <div style={{ marginTop: '10px' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-dark)' }}>Response:</span>
                            <pre style={{
                              marginTop: '4px', padding: '10px', background: 'var(--bg-light)', borderRadius: '8px',
                              fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--text-muted)',
                              overflow: 'auto', maxHeight: '150px', whiteSpace: 'pre-wrap',
                            }}>
                              {d.response_body.slice(0, 500)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Platform Guides Tab */}
      {activeTab === 'platforms' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {PLATFORMS.map((p) => (
            <div key={p.name} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
              borderRadius: '12px', padding: '20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '40px', height: '40px', borderRadius: '10px',
                  background: `${p.color}12`, border: `1px solid ${p.color}30`,
                }}>
                  <Zap size={20} style={{ color: p.color }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>{p.name}</h3>
                  <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.72rem', color: p.color, display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                    Visit platform <ExternalLink size={10} />
                  </a>
                </div>
              </div>
              <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {p.steps.map((step, i) => (
                  <li key={i} style={{ fontSize: '0.8rem', color: 'var(--text-dark)', lineHeight: 1.5 }}>{step}</li>
                ))}
              </ol>
            </div>
          ))}

          <div style={{
            background: 'rgba(37,99,235,0.05)', border: '1px solid rgba(37,99,235,0.15)',
            borderRadius: '12px', padding: '16px',
          }}>
            <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#2563eb', margin: '0 0 8px' }}>
              Event Payload Schema
            </h4>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-dark)', margin: '0 0 10px' }}>
              Every webhook delivers a JSON body with this structure:
            </p>
            <pre style={{
              padding: '12px', background: 'var(--bg-card)', borderRadius: '8px',
              fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--text-main)',
              overflow: 'auto', margin: 0,
            }}>
{`{
  "event": "lead_created",
  "timestamp": "2026-10-19T12:00:00.000Z",
  "data": {
    "lead": {
      "id": "uuid",
      "full_name": "John Doe",
      "email": "john@example.com",
      "mobile_number": "+1234567890",
      "status": "new",
      "state": "California",
      "trading_product": "algo",
      "fund_amount": null,
      "lead_source": "Meta Ads",
      "assigned_to": null,
      "created_at": "2026-10-19T12:00:00.000Z"
    }
  }
}`}
            </pre>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-dark)', margin: '10px 0 0' }}>
              The <code style={{ fontSize: '0.7rem' }}>X-Webhook-Signature</code> header contains an HMAC-SHA256 hash of the body using your webhook's secret token. Use it to verify the payload is from your CRM.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', border: '1px solid var(--border-subtle)',
  borderRadius: '8px', fontSize: '0.85rem', outline: 'none', background: 'var(--bg-card)',
};

const btnPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 16px',
  background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px',
  fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 16px',
  background: 'var(--bg-card)', color: 'var(--text-dark)', border: '1px solid var(--border-subtle)',
  borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
};

const iconBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '6px 8px', borderRadius: '6px',
  border: '1px solid var(--border-subtle)', background: 'var(--bg-card)',
  color: 'var(--text-muted)', cursor: 'pointer',
};

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', ...style }}>
      <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-dark)' }}>{label}</span>
      {children}
    </label>
  );
}

function Banner({ type, message, onClose }: { type: 'error' | 'success'; message: string; onClose: () => void }) {
  const isErr = type === 'error';
  return (
    <div style={{
      padding: '12px 16px', borderRadius: '12px', fontSize: '0.85rem', marginBottom: '16px',
      display: 'flex', alignItems: 'center', gap: '10px',
      background: isErr ? '#fef2f2' : '#f0fdf4',
      border: `1px solid ${isErr ? '#fecaca' : '#bbf7d0'}`,
      color: isErr ? '#dc2626' : '#16a34a',
    }}>
      {isErr ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />} {message}
      <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6 }}>
        <X size={16} />
      </button>
    </div>
  );
}
