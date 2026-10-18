import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import {
  ShieldBan, Plus, Trash2, X, Loader2, AlertCircle, CheckCircle2,
  ArrowLeft, Search, UserPlus, Ban,
} from 'lucide-react';

type OptOut = {
  id: string;
  phone_number: string;
  reason: string | null;
  source: string | null;
  created_at: string;
};

export default function WhatsAppOptOutManager({ session, onBack }: { session: Session; onBack: () => void }) {
  const [optOuts, setOptOuts] = useState<OptOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newReason, setNewReason] = useState('manual');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    let query = supabase.from('wa_opt_outs').select('*').order('created_at', { ascending: false });
    if (search.trim()) {
      query = query.ilike('phone_number', `%${search.trim()}%`);
    }
    const { data, error: err } = await query.limit(200);
    if (err) { setError(err.message); }
    else { setOptOuts((data || []) as OptOut[]); }
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(''), 3000); return () => clearTimeout(t); }
  }, [success]);

  const addOptOut = async () => {
    const phone = newPhone.trim();
    if (!phone) { setError('Phone number is required.'); return; }
    setSaving(true);
    setError('');
    const normalized = phone.startsWith('+') ? phone : `+${phone.replace(/[^0-9]/g, '')}`;
    try {
      const { error: err } = await supabase.from('wa_opt_outs').upsert(
        { phone_number: normalized, reason: newReason, source: 'admin' },
        { onConflict: 'user_id,phone_number' },
      );
      if (err) throw err;
      setSuccess(`${normalized} added to opt-out list.`);
      setNewPhone('');
      setShowAdd(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add');
    }
    setSaving(false);
  };

  const removeOptOut = async (id: string, phone: string) => {
    if (!confirm(`Remove ${phone} from the opt-out list? They will receive WhatsApp messages again.`)) return;
    const { error: err } = await supabase.from('wa_opt_outs').delete().eq('id', id);
    if (err) { setError(err.message); return; }
    setSuccess(`${phone} re-subscribed.`);
    await load();
  };

  const reasonLabel = (r: string | null) => {
    if (r === 'keyword') return 'Auto (keyword)';
    if (r === 'manual') return 'Manual';
    return r || 'Unknown';
  };

  return (
    <div className="wa-optout-page">
      <div className="wa-optout-header">
        <button className="wa-optout-back" onClick={onBack}><ArrowLeft size={18} /> Back</button>
        <div className="wa-optout-title-wrap">
          <div className="wa-optout-title-icon"><ShieldBan size={22} /></div>
          <div>
            <h1 className="wa-optout-title">Opt-Out & Consent Management</h1>
            <p className="wa-optout-subtitle">Manage contacts who have unsubscribed from your WhatsApp messages. Contacts who text STOP are added automatically.</p>
          </div>
        </div>
      </div>

      <div className="wa-optout-stats">
        <div className="wa-optout-stat-card">
          <div className="wa-optout-stat-icon wa-optout-stat-red"><Ban size={18} /></div>
          <div>
            <div className="wa-optout-stat-value">{optOuts.length}</div>
            <div className="wa-optout-stat-label">Opted-out contacts</div>
          </div>
        </div>
        <div className="wa-optout-stat-card">
          <div className="wa-optout-stat-icon wa-optout-stat-amber"><UserPlus size={18} /></div>
          <div>
            <div className="wa-optout-stat-value">{optOuts.filter((o) => o.reason === 'keyword').length}</div>
            <div className="wa-optout-stat-label">Auto (STOP keyword)</div>
          </div>
        </div>
        <div className="wa-optout-stat-card">
          <div className="wa-optout-stat-icon wa-optout-stat-blue"><ShieldBan size={18} /></div>
          <div>
            <div className="wa-optout-stat-value">{optOuts.filter((o) => o.source === 'admin').length}</div>
            <div className="wa-optout-stat-label">Manually added</div>
          </div>
        </div>
      </div>

      {error && <Banner type="error" message={error} onClose={() => setError('')} />}
      {success && <Banner type="success" message={success} onClose={() => setSuccess('')} />}

      <div className="wa-optout-toolbar">
        <div className="wa-optout-search-wrap">
          <Search size={15} className="wa-optout-search-icon" />
          <input className="wa-optout-search" type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by phone number..." />
        </div>
        <button className="wa-optout-add-btn" onClick={() => setShowAdd(!showAdd)}><Plus size={16} /> Add to opt-out</button>
      </div>

      {showAdd && (
        <div className="wa-optout-form-card">
          <div className="wa-optout-form-head">
            <h2>Block a phone number</h2>
            <button className="wa-optout-form-close" onClick={() => setShowAdd(false)}><X size={18} /></button>
          </div>
          <div className="wa-optout-form-grid">
            <label className="wa-optout-field">
              <span className="wa-optout-field-label">Phone number (E.164)</span>
              <input className="wa-optout-input" type="text" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+1234567890" />
            </label>
            <label className="wa-optout-field">
              <span className="wa-optout-field-label">Reason</span>
              <select className="wa-optout-input" value={newReason} onChange={(e) => setNewReason(e.target.value)}>
                <option value="manual">Manual block</option>
                <option value="keyword">Keyword opt-out</option>
              </select>
            </label>
          </div>
          <div className="wa-optout-form-actions">
            <button className="wa-optout-save-btn" onClick={addOptOut} disabled={saving}>
              {saving ? <Loader2 size={16} className="crm-spin" /> : <Plus size={16} />} Add to opt-out list
            </button>
            <button className="wa-optout-cancel-btn" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="wa-optout-loading"><Loader2 size={28} className="crm-spin" /></div>
      ) : optOuts.length === 0 ? (
        <div className="wa-optout-empty">
          <ShieldBan size={40} />
          <h3>No opt-outs yet</h3>
          <p>Contacts who text STOP to your WhatsApp number will appear here automatically. You can also manually block numbers.</p>
        </div>
      ) : (
        <div className="wa-optout-list">
          <div className="wa-optout-list-head">
            <span>Phone number</span>
            <span>Reason</span>
            <span>Date</span>
            <span></span>
          </div>
          {optOuts.map((o) => (
            <div key={o.id} className="wa-optout-row">
              <div className="wa-optout-row-phone">
                <Ban size={14} className="wa-optout-row-icon" />
                {o.phone_number}
              </div>
              <div className="wa-optout-row-reason">
                <span className={`wa-optout-reason-badge ${o.reason === 'keyword' ? 'wa-optout-reason-auto' : 'wa-optout-reason-manual'}`}>
                  {reasonLabel(o.reason)}
                </span>
                {o.source && o.source !== 'admin' && <span className="wa-optout-source-tag">"{o.source}"</span>}
              </div>
              <div className="wa-optout-row-date">{new Date(o.created_at).toLocaleDateString()}</div>
              <button className="wa-optout-row-remove" onClick={() => removeOptOut(o.id, o.phone_number)} title="Re-subscribe this contact">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Banner({ type, message, onClose }: { type: 'error' | 'success'; message: string; onClose: () => void }) {
  const isErr = type === 'error';
  return (
    <div className={`wa-optout-banner ${isErr ? 'wa-optout-banner-err' : 'wa-optout-banner-ok'}`}>
      {isErr ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />} {message}
      <button className="wa-optout-banner-close" onClick={onClose}><X size={16} /></button>
    </div>
  );
}
