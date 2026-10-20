import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Plus, Trash2, Edit3, Save, X, Loader2, AlertCircle, CheckCircle2,
  Table, Copy, Send, Power, Clock, RefreshCw, ExternalLink, FileSpreadsheet,
  ArrowRight, Code, Zap,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';

type WebhookEvent =
  | 'lead_created' | 'lead_status_changed' | 'lead_converted'
  | 'lead_assigned' | 'lead_note_added' | 'lead_deleted';

type GSConnection = {
  id: string;
  user_id: string;
  name: string;
  script_url: string;
  spreadsheet_id: string | null;
  spreadsheet_name: string | null;
  sheet_name: string;
  events: WebhookEvent[];
  column_mapping: Record<string, string>;
  is_active: boolean;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  created_at: string;
};

type SyncLogEntry = {
  id: string;
  connection_id: string;
  event: string;
  lead_id: string | null;
  lead_data: Record<string, unknown>;
  status: string;
  error_message: string | null;
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

const LEAD_FIELDS = [
  'full_name', 'email', 'mobile_number', 'status', 'state',
  'trading_product', 'fund_amount', 'lead_source', 'assigned_to', 'created_at',
];

const APPS_SCRIPT_CODE = `/**
 * CRM → Google Sheets Sync
 * Paste this into Extensions → Apps Script in your Google Sheet,
 * then Deploy → New deployment → Web app → Anyone access.
 * Copy the deployment URL and paste it into the CRM.
 */
function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(body.sheetName) || SpreadsheetApp.getActiveSpreadsheet()
    .insertSheet(body.sheetName);

  const mapping = body.columnMapping || {};
  const lead = body.lead || {};
  const headers = sheet.getLastRow() === 0;

  const cols = Object.keys(mapping).length > 0
    ? Object.keys(mapping)
    : ['Full Name', 'Email', 'Phone', 'Status', 'Source', 'Created At'];

  const fieldMap = {
    'Full Name': 'full_name', 'Email': 'email', 'Phone': 'mobile_number',
    'Status': 'status', 'Source': 'lead_source', 'Created At': 'created_at',
  };

  if (headers) sheet.getRange(1, 1, 1, cols.length).setValues([cols]);

  const row = cols.map(function(c) {
    var field = mapping[c] || fieldMap[c] || c.toLowerCase().replace(/\\s/g, '_');
    return lead[field] || '';
  });

  sheet.appendRow(row);
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}`;

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', border: '1px solid var(--border-subtle)',
  borderRadius: '8px', fontSize: '0.85rem', outline: 'none', background: 'var(--bg-card)',
};

const btnPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 16px',
  background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px',
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

export function GoogleSheetsIntegration({ session }: { session: Session | null }) {
  const [connections, setConnections] = useState<GSConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formSheet, setFormSheet] = useState('Leads');
  const [formEvents, setFormEvents] = useState<WebhookEvent[]>(['lead_created']);
  const [formMapping, setFormMapping] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'connections' | 'sync_log' | 'setup'>('connections');
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [syncLogLoading, setSyncLogLoading] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const fetchConnections = useCallback(async () => {
    setLoading(true);
    const { data, err } = await supabase
      .from('google_sheets_connections')
      .select('*')
      .order('created_at', { ascending: false });
    if (err) setError(err.message);
    else setConnections((data || []) as GSConnection[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchConnections(); }, [fetchConnections]);

  const fetchSyncLog = useCallback(async () => {
    setSyncLogLoading(true);
    const { data } = await supabase
      .from('google_sheets_sync_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setSyncLog((data || []) as SyncLogEntry[]);
    setSyncLogLoading(false);
  }, []);

  useEffect(() => {
    if (activeSubTab === 'sync_log') fetchSyncLog();
  }, [activeSubTab, fetchSyncLog]);

  const resetForm = () => {
    setFormName(''); setFormUrl(''); setFormSheet('Leads');
    setFormEvents(['lead_created']); setFormMapping({});
    setEditingId(null); setShowForm(false);
  };

  const startEdit = (conn: GSConnection) => {
    setEditingId(conn.id);
    setFormName(conn.name);
    setFormUrl(conn.script_url);
    setFormSheet(conn.sheet_name);
    setFormEvents(conn.events);
    setFormMapping(conn.column_mapping || {});
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formUrl.trim()) { setError('Name and Script URL are required'); return; }
    if (!formUrl.startsWith('https://')) { setError('URL must start with https://'); return; }
    setSaving(true); setError('');

    if (editingId) {
      const { error: updErr } = await supabase
        .from('google_sheets_connections')
        .update({
          name: formName.trim(), script_url: formUrl.trim(), sheet_name: formSheet.trim(),
          events: formEvents, column_mapping: formMapping,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId);
      if (updErr) setError(updErr.message);
      else { setSuccess('Connection updated successfully'); resetForm(); fetchConnections(); }
    } else {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) { setError('Not authenticated'); setSaving(false); return; }
      const { error: insErr } = await supabase
        .from('google_sheets_connections')
        .insert({
          name: formName.trim(), script_url: formUrl.trim(), sheet_name: formSheet.trim(),
          events: formEvents, column_mapping: formMapping, user_id: userId,
        });
      if (insErr) setError(insErr.message);
      else { setSuccess('Google Sheets connection created'); resetForm(); fetchConnections(); }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this Google Sheets connection? Sync logs will also be removed.')) return;
    await supabase.from('google_sheets_connections').delete().eq('id', id);
    fetchConnections();
  };

  const toggleActive = async (conn: GSConnection) => {
    await supabase.from('google_sheets_connections')
      .update({ is_active: !conn.is_active, updated_at: new Date().toISOString() })
      .eq('id', conn.id);
    fetchConnections();
  };

  const toggleEvent = (ev: WebhookEvent) => {
    setFormEvents((prev) => prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]);
  };

  const updateMapping = (colName: string, field: string) => {
    setFormMapping((prev) => {
      const next = { ...prev };
      if (!field) delete next[colName];
      else next[colName] = field;
      return next;
    });
  };

  const testSync = async (conn: GSConnection) => {
    setTestingId(conn.id);
    setError('');
    const { data: sessionData } = await supabase.auth.getSession();
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-sheets-sync`;
    try {
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          connection_id: conn.id,
          event: conn.events[0] || 'lead_created',
          lead_data: {
            id: 'test-lead-00000000-0000-0000-0000-000000000000',
            full_name: 'Test Lead',
            email: 'test@example.com',
            mobile_number: '+1234567890',
            status: 'new',
            lead_source: 'Test',
            created_at: new Date().toISOString(),
          },
        }),
      });
      if (!resp.ok) {
        const body = await resp.text();
        setError(`Test sync failed (${resp.status}): ${body.slice(0, 200)}`);
      } else {
        setSuccess('Test row sent! Check your Google Sheet to confirm it appeared.');
        fetchConnections();
      }
    } catch (err) {
      setError(`Test sync error: ${String(err)}`);
    }
    setTestingId(null);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const statusColor = (status: string) => {
    if (status === 'synced') return '#16a34a';
    if (status === 'failed') return '#dc2626';
    if (status === 'pending') return '#f59e0b';
    return '#64748b';
  };

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)' }}>
        {([
          { key: 'connections', label: 'Connections' },
          { key: 'sync_log', label: 'Sync Log' },
          { key: 'setup', label: 'Setup Guide' },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key)}
            style={{
              padding: '10px 16px', border: 'none', borderBottom: activeSubTab === tab.key ? '2px solid #16a34a' : '2px solid transparent',
              background: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
              color: activeSubTab === tab.key ? '#16a34a' : 'var(--text-dark)',
              transition: 'all 0.15s', marginBottom: '-1px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <GSBanner type="error" message={error} onClose={() => setError('')} />}
      {success && <GSBanner type="success" message={success} onClose={() => setSuccess('')} />}

      {/* Connections sub-tab */}
      {activeSubTab === 'connections' && (
        <div>
          {!showForm && (
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
                background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px',
                fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', marginBottom: '16px', transition: 'background 0.15s',
              }}
            >
              <Plus size={16} /> Add Google Sheets Connection
            </button>
          )}

          {showForm && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 16px' }}>
                {editingId ? 'Edit Connection' : 'New Google Sheets Connection'}
              </h3>

              <GSField label="Connection Name" style={{ marginBottom: '14px' }}>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. New Leads → Master Sheet" style={inputStyle} />
              </GSField>

              <GSField label="Apps Script Web App URL" style={{ marginBottom: '14px' }}>
                <input type="url" value={formUrl} onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec" style={inputStyle} />
              </GSField>

              <GSField label="Sheet Name (tab inside the spreadsheet)" style={{ marginBottom: '14px' }}>
                <input type="text" value={formSheet} onChange={(e) => setFormSheet(e.target.value)}
                  placeholder="Leads" style={inputStyle} />
              </GSField>

              <div style={{ marginBottom: '16px' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginBottom: '8px' }}>
                  Events to sync
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

              {/* Column mapping */}
              <div style={{ marginBottom: '16px' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginBottom: '8px' }}>
                  Column Mapping (optional — leave empty to auto-detect)
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Object.entries(formMapping).map(([col, field]) => (
                    <div key={col} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input type="text" value={col} readOnly
                        style={{ ...inputStyle, flex: 1, background: 'var(--bg-light)', cursor: 'default' }} />
                      <ArrowRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <select value={field} onChange={(e) => updateMapping(col, e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                        {LEAD_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
                      </select>
                      <button onClick={() => updateMapping(col, '')} style={{ ...iconBtn, color: '#dc2626', borderColor: 'rgba(239,68,68,0.2)' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="text" id="gs-new-col" placeholder="New column name (e.g. Phone Number)"
                      style={{ ...inputStyle, flex: 1 }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (val && !formMapping[val]) {
                            setFormMapping({ ...formMapping, [val]: LEAD_FIELDS[0] });
                            (e.target as HTMLInputElement).value = '';
                          }
                        }
                      }} />
                    <button onClick={() => {
                      const input = document.getElementById('gs-new-col') as HTMLInputElement;
                      const val = input.value.trim();
                      if (val && !formMapping[val]) {
                        setFormMapping({ ...formMapping, [val]: LEAD_FIELDS[0] });
                        input.value = '';
                      }
                    }} style={btnSecondary}>
                      <Plus size={14} /> Add Column
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
                  {saving ? <Loader2 size={16} className="crm-spin" /> : <Save size={16} />}
                  {editingId ? 'Update' : 'Create'} Connection
                </button>
                <button onClick={resetForm} style={btnSecondary}>Cancel</button>
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Loader2 size={28} className="crm-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
          ) : connections.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-dark)' }}>
              <FileSpreadsheet size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>No Google Sheets connections yet</p>
              <p style={{ fontSize: '0.82rem' }}>Connect a Google Sheet to start syncing leads automatically. Check the Setup Guide tab for step-by-step instructions.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {connections.map((conn) => (
                <div key={conn.id} style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                  borderRadius: '12px', padding: '16px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <Table size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
                        <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{conn.name}</strong>
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '100px',
                          background: conn.is_active ? 'rgba(22,163,74,0.1)' : 'rgba(148,163,184,0.15)',
                          color: conn.is_active ? '#16a34a' : '#94a3b8',
                        }}>
                          {conn.is_active ? 'ACTIVE' : 'PAUSED'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                        <ExternalLink size={12} style={{ flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conn.script_url}</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dark)', marginBottom: '8px' }}>
                        Sheet: <strong>{conn.sheet_name}</strong>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {conn.events.map((ev) => {
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
                      <button onClick={() => toggleActive(conn)} title={conn.is_active ? 'Pause' : 'Activate'} style={iconBtn}>
                        <Power size={14} style={{ color: conn.is_active ? '#16a34a' : '#94a3b8' }} />
                      </button>
                      <button onClick={() => testSync(conn)} disabled={testingId === conn.id} title="Send test row" style={iconBtn}>
                        {testingId === conn.id ? <Loader2 size={14} className="crm-spin" /> : <Send size={14} style={{ color: '#16a34a' }} />}
                      </button>
                      <button onClick={() => startEdit(conn)} title="Edit" style={iconBtn}>
                        <Edit3 size={14} />
                      </button>
                      <button onClick={() => handleDelete(conn.id)} title="Delete" style={{ ...iconBtn, color: '#dc2626', borderColor: 'rgba(239,68,68,0.2)' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {conn.last_sync_at && (
                    <div style={{ marginTop: '8px', fontSize: '0.7rem', color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={12} />
                      Last sync: {new Date(conn.last_sync_at).toLocaleString()}
                      {conn.last_sync_status && (
                        <span style={{ fontWeight: 600, color: statusColor(conn.last_sync_status) }}>
                          ({conn.last_sync_status})
                        </span>
                      )}
                      {conn.last_sync_error && (
                        <span style={{ color: '#dc2626' }}>— {conn.last_sync_error}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sync Log sub-tab */}
      {activeSubTab === 'sync_log' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-dark)', margin: 0 }}>
              Recent sync attempts. Click a row to see the lead data that was sent.
            </p>
            <button onClick={fetchSyncLog} style={btnSecondary}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {syncLogLoading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Loader2 size={28} className="crm-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
          ) : syncLog.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-dark)' }}>
              <Clock size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>No sync events yet</p>
              <p style={{ fontSize: '0.82rem' }}>Sync events will appear here once lead data is pushed to your sheets.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {syncLog.map((entry) => {
                const conn = connections.find((c) => c.id === entry.connection_id);
                const expanded = expandedLog === entry.id;
                return (
                  <div key={entry.id} style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                    borderRadius: '10px', overflow: 'hidden',
                  }}>
                    <div
                      onClick={() => setExpandedLog(expanded ? null : entry.id)}
                      style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
                    >
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColor(entry.status), flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>
                          {conn?.name || 'Unknown connection'} — {entry.event}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-dark)' }}>
                          {new Date(entry.created_at).toLocaleString()}
                          {entry.error_message && ` · ${entry.error_message.slice(0, 80)}`}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 700, padding: '2px 10px', borderRadius: '100px',
                        background: `${statusColor(entry.status)}15`, color: statusColor(entry.status),
                        textTransform: 'capitalize',
                      }}>
                        {entry.status}
                      </span>
                    </div>
                    {expanded && (
                      <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border-subtle)' }}>
                        <div style={{ marginTop: '12px' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-dark)' }}>Lead Data:</span>
                          <pre style={{
                            marginTop: '4px', padding: '10px', background: 'var(--bg-light)', borderRadius: '8px',
                            fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--text-main)',
                            overflow: 'auto', maxHeight: '200px', whiteSpace: 'pre-wrap',
                          }}>
                            {JSON.stringify(entry.lead_data, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Setup Guide sub-tab */}
      {activeSubTab === 'setup' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            background: 'rgba(22,163,74,0.05)', border: '1px solid rgba(22,163,74,0.15)',
            borderRadius: '12px', padding: '20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '40px', height: '40px', borderRadius: '10px',
                background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(22,163,74,0.3)',
              }}>
                <FileSpreadsheet size={20} style={{ color: '#16a34a' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>How Google Sheets Sync Works</h3>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-dark)', margin: '2px 0 0' }}>
                  Your CRM pushes lead data to a Google Sheet in real-time — no Zapier or Make.com needed.
                </p>
              </div>
            </div>
            <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li style={{ fontSize: '0.8rem', color: 'var(--text-dark)', lineHeight: 1.5 }}>
                Open your Google Sheet, then go to <strong>Extensions &rarr; Apps Script</strong>.
              </li>
              <li style={{ fontSize: '0.8rem', color: 'var(--text-dark)', lineHeight: 1.5 }}>
                Delete any code in the editor and paste the script below.
              </li>
              <li style={{ fontSize: '0.8rem', color: 'var(--text-dark)', lineHeight: 1.5 }}>
                Click <strong>Deploy &rarr; New deployment</strong>, choose <strong>Web app</strong>, set access to <strong>Anyone</strong>, and click Deploy.
              </li>
              <li style={{ fontSize: '0.8rem', color: 'var(--text-dark)', lineHeight: 1.5 }}>
                Copy the deployment URL (ends in <code>/exec</code>) and paste it into a new connection on the Connections tab.
              </li>
              <li style={{ fontSize: '0.8rem', color: 'var(--text-dark)', lineHeight: 1.5 }}>
                Choose which events to sync and optionally map columns. Click <strong>Test</strong> to send a sample row.
              </li>
              <li style={{ fontSize: '0.8rem', color: 'var(--text-dark)', lineHeight: 1.5 }}>
                From now on, every matching lead event will automatically append a row to your sheet.
              </li>
            </ol>
          </div>

          {/* Apps Script code block */}
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            borderRadius: '12px', padding: '20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Code size={18} style={{ color: '#16a34a' }} />
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Apps Script Code</h4>
              </div>
              <button onClick={copyCode} style={btnSecondary}>
                {copiedCode ? <CheckCircle2 size={14} style={{ color: '#16a34a' }} /> : <Copy size={14} />}
                {copiedCode ? 'Copied!' : 'Copy Code'}
              </button>
            </div>
            <pre style={{
              padding: '14px', background: 'var(--bg-light)', borderRadius: '8px',
              fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--text-main)',
              overflow: 'auto', maxHeight: '400px', whiteSpace: 'pre-wrap', margin: 0,
            }}>
{APPS_SCRIPT_CODE}
            </pre>
          </div>

          {/* Data flow diagram */}
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            borderRadius: '12px', padding: '20px',
          }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 14px' }}>Data Flow</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'var(--bg-light)', borderRadius: '10px' }}>
                <Table size={16} style={{ color: '#2563eb' }} />
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)' }}>New Lead in CRM</span>
              </div>
              <ArrowRight size={18} style={{ color: 'var(--text-muted)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'var(--bg-light)', borderRadius: '10px' }}>
                <Zap size={16} style={{ color: '#f59e0b' }} />
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)' }}>Edge Function Fires</span>
              </div>
              <ArrowRight size={18} style={{ color: 'var(--text-muted)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'var(--bg-light)', borderRadius: '10px' }}>
                <FileSpreadsheet size={16} style={{ color: '#16a34a' }} />
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)' }}>Row Added to Sheet</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GSField({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', ...style }}>
      <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-dark)' }}>{label}</span>
      {children}
    </label>
  );
}

function GSBanner({ type, message, onClose }: { type: 'error' | 'success'; message: string; onClose: () => void }) {
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
