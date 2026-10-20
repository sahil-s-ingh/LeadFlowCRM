import { useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft, Plus, Loader2, Trash2, RefreshCw, Send, X,
  CheckCircle2, AlertTriangle, FileText, Inbox, Search,
  Rocket, Eye, Copy, ExternalLink, ChevronRight, Layout,
} from 'lucide-react';
import WhatsAppSetupGuide from './WhatsAppSetupGuide';

interface WaFlow {
  id: string;
  wa_flow_id: string | null;
  name: string;
  categories: string[];
  endpoint_uri: string | null;
  status: string;
  flow_json: Record<string, unknown> | null;
  wa_settings_id: string | null;
  created_at: string;
  updated_at: string;
}

interface FlowSubmission {
  id: string;
  flow_id: string;
  wa_phone_number: string | null;
  wa_wa_id: string | null;
  submitted_data: Record<string, unknown>;
  raw_payload: Record<string, unknown> | null;
  wa_message_id: string | null;
  created_at: string;
}

interface Props {
  session: Session;
  onBack: () => void;
}

const FLOW_CATEGORIES = [
  'SURVEY', 'SIGN_UP', 'APPOINTMENT', 'LEAD_GEN', 'SUPPORT',
  'CUSTOMER_SATISFACTION', 'OTHER',
];

type View = 'list' | 'submissions' | 'create';

export default function WhatsAppFlows({ session, onBack }: Props) {
  const [view, setView] = useState<View>('list');
  const [flows, setFlows] = useState<WaFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedFlow, setSelectedFlow] = useState<WaFlow | null>(null);
  const [submissions, setSubmissions] = useState<FlowSubmission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);

  // Create form state
  const [flowName, setFlowName] = useState('');
  const [flowCategory, setFlowCategory] = useState('SURVEY');
  const [flowEndpointUri, setFlowEndpointUri] = useState('');
  const [flowScreens, setFlowScreens] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Send flow modal
  const [sendModalFlow, setSendModalFlow] = useState<WaFlow | null>(null);
  const [sendTo, setSendTo] = useState('');
  const [sendBodyText, setSendBodyText] = useState('');
  const [sendButtonText, setSendButtonText] = useState('Start');
  const [sendHeader, setSendHeader] = useState('');
  const [sendFooter, setSendFooter] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState('');

  const fetchFlows = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('wa_flows')
      .select('*')
      .order('created_at', { ascending: false });
    if (err) {
      setError(err.message);
    } else {
      setFlows(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  useEffect(() => {
    const channel = supabase
      .channel('wa-flows-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_flows' }, () => fetchFlows())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wa_flow_submissions' }, () => {
        if (view === 'submissions' && selectedFlow) fetchSubmissions(selectedFlow.id);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchFlows, view, selectedFlow]);

  const fetchSubmissions = async (flowId: string) => {
    setSubmissionsLoading(true);
    const { data } = await supabase
      .from('wa_flow_submissions')
      .select('*')
      .eq('flow_id', flowId)
      .order('created_at', { ascending: false });
    setSubmissions(data || []);
    setSubmissionsLoading(false);
  };

  const openSubmissions = (flow: WaFlow) => {
    setSelectedFlow(flow);
    setView('submissions');
    fetchSubmissions(flow.id);
  };

  const callFlowApi = async (action: string, body: Record<string, unknown>) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-flows?action=${action}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      },
    );
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  };

  const handleCreate = async () => {
    if (!flowName.trim()) { setCreateError('Flow name is required'); return; }
    setCreating(true);
    setCreateError('');
    try {
      let flowJsonObj: Record<string, unknown> | undefined;
      if (flowScreens.trim()) {
        try { flowJsonObj = JSON.parse(flowScreens); }
        catch { setCreateError('Flow JSON is invalid — check your syntax'); setCreating(false); return; }
      }
      await callFlowApi('create', {
        name: flowName.trim(),
        categories: [flowCategory],
        endpointUri: flowEndpointUri.trim() || undefined,
        flowJson: flowJsonObj,
      });
      setView('list');
      setFlowName('');
      setFlowCategory('SURVEY');
      setFlowEndpointUri('');
      setFlowScreens('');
      await fetchFlows();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create flow');
    } finally {
      setCreating(false);
    }
  };

  const handlePublish = async (flow: WaFlow) => {
    setActionLoading(`publish-${flow.id}`);
    setError('');
    try {
      await callFlowApi('publish', { flowId: flow.wa_flow_id });
      await fetchFlows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish flow');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (flow: WaFlow) => {
    if (!confirm(`Delete "${flow.name}"? This removes the flow from WhatsApp permanently.`)) return;
    setActionLoading(`delete-${flow.id}`);
    setError('');
    try {
      await callFlowApi('delete', { flowId: flow.wa_flow_id });
      await fetchFlows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete flow');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSync = async () => {
    setActionLoading('sync');
    setError('');
    try {
      await callFlowApi('sync', {});
      await fetchFlows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync flows');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSend = async () => {
    if (!sendModalFlow || !sendTo.trim()) { setSendError('Phone number is required'); return; }
    setSending(true);
    setSendError('');
    setSendSuccess('');
    try {
      await callFlowApi('send', {
        to: sendTo.trim(),
        flowId: sendModalFlow.wa_flow_id,
        headerText: sendHeader.trim() || undefined,
        bodyText: sendBodyText.trim() || 'Please fill out this form',
        buttonText: sendButtonText.trim() || 'Start',
        footerText: sendFooter.trim() || undefined,
      });
      setSendSuccess(`Flow sent to ${sendTo.trim()}`);
      setSendTo('');
      setSendBodyText('');
      setSendHeader('');
      setSendFooter('');
      setTimeout(() => { setSendSuccess(''); setSendModalFlow(null); }, 2000);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send flow');
    } finally {
      setSending(false);
    }
  };

  const copyJson = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* clipboard */ }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  const statusColor = (status: string) => {
    switch (status) {
      case 'published': return { bg: 'rgba(34,197,94,0.15)', color: '#16a34a' };
      case 'draft': return { bg: 'rgba(245,158,11,0.15)', color: '#d97706' };
      case 'blocked': return { bg: 'rgba(239,68,68,0.15)', color: '#dc2626' };
      default: return { bg: 'rgba(107,114,128,0.15)', color: '#6b7280' };
    }
  };

  const filteredFlows = flows.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ─── Create Flow View ──────────────────────────────────────────
  if (view === 'create') {
    const defaultFlowJson = JSON.stringify({
      version: "5.0",
      data_api_version: "3.0",
      routing_model: { WELCOME: ["SUCCESS"], SUCCESS: [] },
      screens: [
        {
          id: "WELCOME",
          title: "Welcome",
          terminal: false,
          "layout": {
            type: "SingleColumnLayout",
            children: [
              {
                type: "Form",
                name: "flow_form",
                children: [
                  {
                    type: "TextBody",
                    text: "Please fill out the form below",
                  },
                  {
                    type: "TextInput",
                    name: "full_name",
                    label: "Full Name",
                    required: true,
                    "helper-text": "Enter your full name",
                  },
                  {
                    type: "TextInput",
                    name: "email",
                    label: "Email",
                    required: false,
                    "input-type": "email",
                  },
                  {
                    type: "Footer",
                    "buttons": [
                      { name: "submit", text: "Submit", type: "button", "on-click-action": { name: "complete", payload: {} } }
                    ],
                  },
                ],
              },
            ],
          },
        },
      ],
    }, null, 2);

    return (
      <div className="dash-overview">
        <div className="dash-page-header">
          <button className="dash-back-btn" onClick={() => setView('list')}>
            <ArrowLeft size={18} /> Back to Flows
          </button>
          <h1>Create New Flow</h1>
          <p>Build a structured in-chat form for WhatsApp</p>
        </div>

        {createError && (
          <div className="crm-error-banner" style={{ marginBottom: '16px' }}>{createError}</div>
        )}

        <div style={{ maxWidth: '700px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Flow Name <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="text"
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              placeholder="e.g. Lead Qualification Form"
              maxLength={100}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: '8px',
                border: '1px solid var(--border-light)', background: 'var(--bg-card)',
                color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Category
            </label>
            <select
              value={flowCategory}
              onChange={(e) => setFlowCategory(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: '8px',
                border: '1px solid var(--border-light)', background: 'var(--bg-card)',
                color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none',
              }}
            >
              {FLOW_CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Endpoint URI (optional)
            </label>
            <input
              type="text"
              value={flowEndpointUri}
              onChange={(e) => setFlowEndpointUri(e.target.value)}
              placeholder="https://your-server.com/flow-endpoint (for dynamic data flows)"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: '8px',
                border: '1px solid var(--border-light)', background: 'var(--bg-card)',
                color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none',
              }}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Only needed for dynamic flows where your server provides data mid-form.
            </p>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                Flow JSON Definition (optional)
              </label>
              <button
                onClick={() => setFlowScreens(defaultFlowJson)}
                style={{
                  background: 'none', border: '1px solid var(--border-light)', borderRadius: '6px',
                  padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer', color: 'var(--text-secondary)',
                }}
              >
                Load Template
              </button>
            </div>
            <textarea
              value={flowScreens}
              onChange={(e) => setFlowScreens(e.target.value)}
              placeholder="Paste your Flow JSON here, or click Load Template..."
              rows={12}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: '8px',
                border: '1px solid var(--border-light)', background: 'var(--bg-card)',
                color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none', resize: 'vertical',
                fontFamily: 'monospace',
              }}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              You can design this visually in Meta's Flow Builder, export the JSON, and paste it here.
            </p>
          </div>

          <div style={{
            padding: '12px 14px', borderRadius: '8px',
            background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.2)',
            fontSize: '0.8rem', color: 'var(--text-secondary)',
            display: 'flex', gap: '8px', alignItems: 'flex-start',
          }}>
            <CheckCircle2 size={16} style={{ color: '#25D366', flexShrink: 0, marginTop: '1px' }} />
            <span>
              After creating the flow, you'll need to publish it before it can be sent to contacts.
              Meta may take a few minutes to process the flow definition.
            </span>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setView('list')}
              style={{
                padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-light)',
                background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer',
                fontSize: '0.875rem', fontWeight: 600,
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !flowName.trim()}
              style={{
                padding: '10px 20px', borderRadius: '8px', border: 'none',
                background: '#25D366', color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px',
                fontSize: '0.875rem', fontWeight: 600, opacity: creating || !flowName.trim() ? 0.5 : 1,
              }}
            >
              {creating ? <Loader2 size={16} className="crm-spin" /> : <Plus size={16} />}
              Create Flow
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Submissions View ──────────────────────────────────────────
  if (view === 'submissions' && selectedFlow) {
    return (
      <div className="dash-overview">
        <div className="dash-page-header">
          <button className="dash-back-btn" onClick={() => { setView('list'); setSelectedFlow(null); }}>
            <ArrowLeft size={18} /> Back to Flows
          </button>
          <h1>{selectedFlow.name} — Submissions</h1>
          <p>{submissions.length} response{submissions.length !== 1 ? 's' : ''} received</p>
        </div>

        {submissionsLoading ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <Loader2 size={32} className="crm-spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        ) : submissions.length === 0 ? (
          <div className="crm-empty-state">
            <Inbox size={48} />
            <h3>No submissions yet</h3>
            <p>When contacts fill out this flow, their responses will appear here.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {submissions.map((sub) => (
              <div
                key={sub.id}
                style={{
                  background: 'var(--bg-card)', borderRadius: '12px', padding: '20px',
                  border: '1px solid var(--border-light)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                      {sub.wa_phone_number || sub.wa_wa_id || 'Unknown sender'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(sub.created_at).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(sub.submitted_data, null, 2))}
                    style={{
                      background: 'none', border: '1px solid var(--border-light)', borderRadius: '6px',
                      padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer', color: 'var(--text-secondary)',
                      display: 'flex', alignItems: 'center', gap: '4px',
                    }}
                  >
                    <Copy size={13} /> Copy Data
                  </button>
                </div>
                <div style={{
                  background: 'var(--bg-secondary)', borderRadius: '8px', padding: '12px 14px',
                  fontSize: '0.85rem', fontFamily: 'monospace',
                }}>
                  {Object.entries(sub.submitted_data).map(([key, val]) => (
                    <div key={key} style={{ display: 'flex', gap: '8px', padding: '2px 0' }}>
                      <span style={{ color: 'var(--text-muted)', minWidth: '120px' }}>{key}:</span>
                      <span style={{ color: 'var(--text-primary)' }}>{String(val)}</span>
                    </div>
                  ))}
                  {Object.keys(sub.submitted_data).length === 0 && (
                    <span style={{ color: 'var(--text-muted)' }}>No data fields</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Flows List View ───────────────────────────────────────────
  return (
    <div className="dash-overview">
      <div className="dash-page-header">
        <button className="dash-back-btn" onClick={onBack}>
          <ArrowLeft size={18} /> Back
        </button>
        <h1>WhatsApp Flows</h1>
        <p>Create in-chat forms, surveys, and guided experiences for WhatsApp</p>
      </div>

      {error && <div className="crm-error-banner" style={{ marginBottom: '16px' }}>{error}</div>}

      <WhatsAppSetupGuide feature="flows" />

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search flows..."
            style={{
              width: '100%', padding: '10px 12px 10px 38px', borderRadius: '8px',
              border: '1px solid var(--border-light)', background: 'var(--bg-card)',
              color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none',
            }}
          />
        </div>
        <button
          onClick={handleSync}
          disabled={actionLoading === 'sync'}
          className="crm-btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
        >
          {actionLoading === 'sync' ? <Loader2 size={16} className="crm-spin" /> : <RefreshCw size={16} />}
          Sync from WhatsApp
        </button>
        <button
          onClick={() => setView('create')}
          style={{
            padding: '10px 18px', borderRadius: '8px', border: 'none',
            background: '#25D366', color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '8px',
            fontSize: '0.875rem', fontWeight: 600, whiteSpace: 'nowrap',
          }}
        >
          <Plus size={16} /> Create Flow
        </button>
      </div>

      {/* Flows grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <Loader2 size={32} className="crm-spin" style={{ color: 'var(--text-muted)' }} />
          <p style={{ marginTop: '12px', color: 'var(--text-muted)' }}>Loading flows...</p>
        </div>
      ) : filteredFlows.length === 0 ? (
        <div className="crm-empty-state">
          <Layout size={48} />
          <h3>No flows yet</h3>
          <p>Create your first WhatsApp Flow to collect structured data from contacts inside a chat.</p>
          <button
            onClick={() => setView('create')}
            style={{
              marginTop: '16px', padding: '10px 20px', borderRadius: '8px', border: 'none',
              background: '#25D366', color: '#fff', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              fontSize: '0.875rem', fontWeight: 600,
            }}
          >
            <Plus size={16} /> Create Flow
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '16px',
        }}>
          {filteredFlows.map((flow) => {
            const sc = statusColor(flow.status);
            return (
              <div
                key={flow.id}
                style={{
                  background: 'var(--bg-card)', borderRadius: '12px', padding: '20px',
                  border: '1px solid var(--border-light)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '10px', flexShrink: 0,
                    background: 'rgba(37,211,102,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Layout size={20} style={{ color: '#25D366' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{
                      fontSize: '0.95rem', fontWeight: 700, marginBottom: '4px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{flow.name}</h3>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '0.7rem', padding: '2px 8px', borderRadius: '20px',
                        background: sc.bg, color: sc.color, textTransform: 'capitalize',
                      }}>
                        {flow.status}
                      </span>
                      {flow.categories.map((c) => (
                        <span key={c} style={{
                          fontSize: '0.7rem', padding: '2px 8px', borderRadius: '20px',
                          background: 'var(--bg-secondary)', color: 'var(--text-muted)',
                        }}>
                          {c.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{
                  fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px',
                  display: 'flex', gap: '12px',
                }}>
                  <span>Created {formatDate(flow.created_at)}</span>
                </div>

                <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
                  <button
                    onClick={() => setSendModalFlow(flow)}
                    disabled={flow.status !== 'published'}
                    style={{
                      flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-light)',
                      background: flow.status === 'published' ? 'rgba(37,211,102,0.08)' : 'var(--bg-secondary)',
                      color: flow.status === 'published' ? '#16a34a' : 'var(--text-muted)',
                      cursor: flow.status === 'published' ? 'pointer' : 'not-allowed',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                      fontSize: '0.75rem', fontWeight: 500,
                    }}
                    title={flow.status === 'published' ? 'Send to a contact' : 'Publish first'}
                  >
                    <Send size={13} /> Send
                  </button>
                  <button
                    onClick={() => openSubmissions(flow)}
                    style={{
                      flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-light)',
                      background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                      fontSize: '0.75rem', fontWeight: 500,
                    }}
                  >
                    <Inbox size={13} /> Submissions
                  </button>
                  {flow.status === 'draft' && (
                    <button
                      onClick={() => handlePublish(flow)}
                      disabled={actionLoading === `publish-${flow.id}`}
                      style={{
                        padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(37,211,102,0.3)',
                        background: 'rgba(37,211,102,0.08)', color: '#16a34a', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                      title="Publish flow"
                    >
                      {actionLoading === `publish-${flow.id}` ? <Loader2 size={13} className="crm-spin" /> : <Rocket size={13} />}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(flow)}
                    disabled={actionLoading === `delete-${flow.id}`}
                    style={{
                      padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)',
                      background: 'rgba(239,68,68,0.08)', color: '#dc2626', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    title="Delete flow"
                  >
                    {actionLoading === `delete-${flow.id}` ? <Loader2 size={13} className="crm-spin" /> : <Trash2 size={13} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Send Flow Modal */}
      {sendModalFlow && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
          }}
          onClick={() => setSendModalFlow(null)}
        >
          <div
            style={{
              background: 'var(--bg-card)', borderRadius: '16px', padding: '28px',
              maxWidth: '480px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Send Flow: {sendModalFlow.name}</h2>
              <button onClick={() => setSendModalFlow(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            {sendError && (
              <div style={{
                padding: '10px 14px', borderRadius: '8px', marginBottom: '16px',
                background: 'rgba(239,68,68,0.1)', color: '#dc2626', fontSize: '0.85rem',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <AlertTriangle size={16} /> {sendError}
              </div>
            )}
            {sendSuccess && (
              <div style={{
                padding: '10px 14px', borderRadius: '8px', marginBottom: '16px',
                background: 'rgba(34,197,94,0.1)', color: '#16a34a', fontSize: '0.85rem',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <CheckCircle2 size={16} /> {sendSuccess}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Phone Number <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="tel"
                value={sendTo}
                onChange={(e) => setSendTo(e.target.value)}
                placeholder="+1234567890"
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '8px',
                  border: '1px solid var(--border-light)', background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Header Text (optional)
              </label>
              <input
                type="text"
                value={sendHeader}
                onChange={(e) => setSendHeader(e.target.value)}
                placeholder="e.g. Quick Question"
                maxLength={60}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '8px',
                  border: '1px solid var(--border-light)', background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Body Text
              </label>
              <textarea
                value={sendBodyText}
                onChange={(e) => setSendBodyText(e.target.value)}
                placeholder="Please fill out this form"
                rows={2}
                maxLength={1024}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '8px',
                  border: '1px solid var(--border-light)', background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none', resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Button Text
                </label>
                <input
                  type="text"
                  value={sendButtonText}
                  onChange={(e) => setSendButtonText(e.target.value)}
                  placeholder="Start"
                  maxLength={20}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '8px',
                    border: '1px solid var(--border-light)', background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Footer (optional)
                </label>
                <input
                  type="text"
                  value={sendFooter}
                  onChange={(e) => setSendFooter(e.target.value)}
                  placeholder="Powered by..."
                  maxLength={60}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '8px',
                    border: '1px solid var(--border-light)', background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSendModalFlow(null)}
                style={{
                  padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-light)',
                  background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer',
                  fontSize: '0.875rem', fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !sendTo.trim()}
                style={{
                  padding: '10px 20px', borderRadius: '8px', border: 'none',
                  background: '#25D366', color: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  fontSize: '0.875rem', fontWeight: 600, opacity: sending || !sendTo.trim() ? 0.5 : 1,
                }}
              >
                {sending ? <Loader2 size={16} className="crm-spin" /> : <Send size={16} />}
                Send Flow
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
