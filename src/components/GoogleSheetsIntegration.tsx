import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Plus, Trash2, Copy, Loader2, AlertCircle, CheckCircle2,
  FileSpreadsheet, Code, Key, Power, X, ArrowRight,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';

type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
};

const APPS_SCRIPT_CODE = `/**
 * Google Sheets → CRM Contact Sync
 * Paste into Extensions → Apps Script in your Google Sheet.
 * Run "syncContacts" or set a time trigger to run every 5 minutes.
 * Every new row with a phone number will be pushed into your CRM automatically.
 */
var API_KEY = 'PASTE_YOUR_API_KEY_HERE';
var SYNC_URL = 'https://SUPABASE_URL/functions/v1/google-sheets-sync';
var LAST_SYNC_CELL = 'SyncMeta';

function syncContacts() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return;

  var headers = data[0];
  var lastSynced = getSyncedCount();

  // Collect unsynced rows
  var contacts = [];
  for (var i = lastSynced; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j].toString().trim()] = data[i][j] ? data[i][j].toString().trim() : '';
    }
    contacts.push(row);
  }

  if (contacts.length === 0) {
    Logger.log('No new contacts to sync.');
    return;
  }

  var response = UrlFetchApp.fetch(SYNC_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Api-Key': API_KEY },
    payload: JSON.stringify({ contacts: contacts }),
    muteHttpExceptions: true,
  });

  var result = JSON.parse(response.getContentText());
  Logger.log('Synced: ' + result.imported + ' imported, ' +
    result.duplicates + ' duplicates, ' + result.failed + ' failed');

  // Mark all rows as synced
  setSyncedCount(data.length);
}

function getSyncedCount() {
  var props = PropertiesService.getDocumentProperties();
  var val = props.getProperty(LAST_SYNC_CELL);
  return val ? parseInt(val) : 1;
}

function setSyncedCount(count) {
  PropertiesService.getDocumentProperties().setProperty(LAST_SYNC_CELL, count.toString());
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
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeTab, setActiveTab] = useState<'api_keys' | 'setup'>('api_keys');

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    const { data, err } = await supabase
      .from('google_sheets_api_keys')
      .select('id, name, key_prefix, is_active, last_used_at, created_at')
      .order('created_at', { ascending: false });
    if (err) setError(err.message);
    else setKeys((data || []) as ApiKey[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const generateKey = useCallback(async () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const plain = Array.from(array).map((b) => b.toString(16).padStart(2, '0')).join('');
    const prefix = plain.slice(0, 10);

    const data = new TextEncoder().encode(plain);
    const buf = await crypto.subtle.digest('SHA-256', data);
    const keyHash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) { setError('Not authenticated'); return; }

    const { error: insErr } = await supabase.from('google_sheets_api_keys').insert({
      name: keyName.trim() || 'My Google Sheets Key',
      key_hash: keyHash,
      key_prefix: prefix,
      user_id: userId,
    });

    if (insErr) { setError(insErr.message); return; }
    setNewKey(plain);
    setKeyName('');
    setShowCreate(false);
    setSuccess('API key created! Copy it now — you will not be able to see it again.');
    fetchKeys();
  }, [keyName, fetchKeys]);

  const toggleActive = async (key: ApiKey) => {
    await supabase.from('google_sheets_api_keys')
      .update({ is_active: !key.is_active, updated_at: new Date().toISOString() })
      .eq('id', key.id);
    fetchKeys();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this API key? Contacts will no longer sync from this key.')) return;
    await supabase.from('google_sheets_api_keys').delete().eq('id', id);
    fetchKeys();
  };

  const copyToClipboard = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)' }}>
        {([
          { key: 'api_keys', label: 'API Keys' },
          { key: 'setup', label: 'Setup Guide' },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 16px', border: 'none', borderBottom: activeTab === tab.key ? '2px solid #16a34a' : '2px solid transparent',
              background: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
              color: activeTab === tab.key ? '#16a34a' : 'var(--text-dark)',
              transition: 'all 0.15s', marginBottom: '-1px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <GSBanner type="error" message={error} onClose={() => setError('')} />}
      {success && <GSBanner type="success" message={success} onClose={() => setSuccess('')} />}

      {newKey && (
        <div style={{
          background: 'rgba(22,163,74,0.05)', border: '1px solid rgba(22,163,74,0.3)',
          borderRadius: '12px', padding: '16px', marginBottom: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <Key size={16} style={{ color: '#16a34a' }} />
            <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>Your New API Key (shown once)</strong>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input readOnly value={newKey} style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.78rem' }} />
            <button onClick={() => copyToClipboard(newKey, setCopiedKey)} style={btnSecondary}>
              {copiedKey ? <CheckCircle2 size={14} style={{ color: '#16a34a' }} /> : <Copy size={14} />}
              {copiedKey ? 'Copied!' : 'Copy'}
            </button>
            <button onClick={() => setNewKey(null)} style={iconBtn}><X size={14} /></button>
          </div>
        </div>
      )}

      {activeTab === 'api_keys' && (
        <div>
          {!showCreate && (
            <button
              onClick={() => { setKeyName(''); setShowCreate(true); }}
              style={{ ...btnPrimary, marginBottom: '16px' }}
            >
              <Plus size={16} /> Generate API Key
            </button>
          )}

          {showCreate && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 14px' }}>
                Create New API Key
              </h3>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '14px' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-dark)' }}>Key Name</span>
                <input type="text" value={keyName} onChange={(e) => setKeyName(e.target.value)}
                  placeholder="e.g. Master Lead Sheet" style={inputStyle}
                  onKeyDown={(e) => { if (e.key === 'Enter' && keyName.trim()) generateKey(); }} />
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={generateKey} disabled={creating} style={{ ...btnPrimary, opacity: creating ? 0.6 : 1 }}>
                  {creating ? <Loader2 size={16} className="crm-spin" /> : <Key size={16} />}
                  Generate
                </button>
                <button onClick={() => setShowCreate(false)} style={btnSecondary}>Cancel</button>
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Loader2 size={28} className="crm-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
          ) : keys.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-dark)' }}>
              <Key size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>No API keys yet</p>
              <p style={{ fontSize: '0.82rem' }}>Generate an API key, then paste it into your Google Sheet's Apps Script to start syncing contacts automatically.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {keys.map((key) => (
                <div key={key.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <Key size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
                        <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{key.name}</strong>
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '100px',
                          background: key.is_active ? 'rgba(22,163,74,0.1)' : 'rgba(148,163,184,0.15)',
                          color: key.is_active ? '#16a34a' : '#94a3b8',
                        }}>
                          {key.is_active ? 'ACTIVE' : 'REVOKED'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-dark)', fontFamily: 'monospace', marginBottom: '4px' }}>
                        {key.key_prefix}••••••••••••••••
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Created {new Date(key.created_at).toLocaleDateString()}
                        {key.last_used_at && ` · Last used ${new Date(key.last_used_at).toLocaleDateString()}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button onClick={() => toggleActive(key)} title={key.is_active ? 'Revoke' : 'Activate'} style={iconBtn}>
                        <Power size={14} style={{ color: key.is_active ? '#16a34a' : '#94a3b8' }} />
                      </button>
                      <button onClick={() => handleDelete(key.id)} title="Delete" style={{ ...iconBtn, color: '#dc2626', borderColor: 'rgba(239,68,68,0.2)' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'setup' && (
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
                  New rows in your Google Sheet automatically become leads in your CRM — no manual CSV uploads.
                </p>
              </div>
            </div>
            <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li style={{ fontSize: '0.8rem', color: 'var(--text-dark)', lineHeight: 1.5 }}>
                Go to the <strong>API Keys</strong> tab and click <strong>Generate API Key</strong>. Copy the key immediately — you won't see it again.
              </li>
              <li style={{ fontSize: '0.8rem', color: 'var(--text-dark)', lineHeight: 1.5 }}>
                Open your Google Sheet, then go to <strong>Extensions &rarr; Apps Script</strong>.
              </li>
              <li style={{ fontSize: '0.8rem', color: 'var(--text-dark)', lineHeight: 1.5 }}>
                Delete any code and paste the script below. Replace <code>API_KEY</code> with your key and <code>SUPABASE_URL</code> with your project URL.
              </li>
              <li style={{ fontSize: '0.8rem', color: 'var(--text-dark)', lineHeight: 1.5 }}>
                Click <strong>Run</strong> to sync immediately, or set a time trigger to run every 5 minutes for real-time sync.
              </li>
              <li style={{ fontSize: '0.8rem', color: 'var(--text-dark)', lineHeight: 1.5 }}>
                Every row in your sheet with a phone column will be imported as a new lead. Duplicates are skipped automatically.
              </li>
            </ol>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Code size={18} style={{ color: '#16a34a' }} />
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Apps Script Code</h4>
              </div>
              <button onClick={() => copyToClipboard(APPS_SCRIPT_CODE, setCopiedCode)} style={btnSecondary}>
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

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 14px' }}>Data Flow</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'var(--bg-light)', borderRadius: '10px' }}>
                <FileSpreadsheet size={16} style={{ color: '#16a34a' }} />
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)' }}>New Row in Google Sheet</span>
              </div>
              <ArrowRight size={18} style={{ color: 'var(--text-muted)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'var(--bg-light)', borderRadius: '10px' }}>
                <Key size={16} style={{ color: '#f59e0b' }} />
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)' }}>API Key Auth</span>
              </div>
              <ArrowRight size={18} style={{ color: 'var(--text-muted)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'var(--bg-light)', borderRadius: '10px' }}>
                <Plus size={16} style={{ color: '#2563eb' }} />
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)' }}>New Lead in CRM</span>
              </div>
            </div>
          </div>

          <div style={{
            background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)',
            borderRadius: '12px', padding: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <AlertCircle size={16} style={{ color: '#f59e0b' }} />
              <strong style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>Column Requirements</strong>
            </div>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-dark)', lineHeight: 1.5, margin: 0 }}>
              Your sheet must have a column for phone numbers (recognized names: <code>phone</code>, <code>mobile_number</code>, <code>Phone</code>, or <code>phone number</code>).<br />
              Optional columns: <code>name</code>/<code>full_name</code>/<code>Full Name</code> and <code>email</code>/<code>Email</code>.
              The first row should be headers.
            </p>
          </div>
        </div>
      )}
    </div>
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
