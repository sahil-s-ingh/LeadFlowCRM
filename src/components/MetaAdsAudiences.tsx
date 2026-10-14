import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, Plus, Trash2, RefreshCw, Loader2, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';

interface MetaAdsAudiencesProps {
  session: { user: { id: string } };
  callApi: (action: string, extra?: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

interface CustomAudience {
  id: string;
  name: string;
  description: string | null;
  audience_id: string;
  audience_type: string;
  estimated_size: number | null;
  status: string;
  last_synced_at: string | null;
}

interface LookalikeAudience {
  id: string;
  name: string;
  source_audience_id: string | null;
  lookalike_audience_id: string | null;
  audience_size: string;
  country: string;
  status: string;
}

export default function MetaAdsAudiences({ session, callApi }: MetaAdsAudiencesProps) {
  const [customAudiences, setCustomAudiences] = useState<CustomAudience[]>([]);
  const [lookalikes, setLookalikes] = useState<LookalikeAudience[]>([]);
  const [metaAudiences, setMetaAudiences] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create custom audience form
  const [showCreate, setShowCreate] = useState(false);
  const [audName, setAudName] = useState('');
  const [audDesc, setAudDesc] = useState('');
  const [audLeadIds, setAudLeadIds] = useState('');
  const [leadCount, setLeadCount] = useState(0);

  // Create lookalike form
  const [showLookalike, setShowLookalike] = useState(false);
  const [lkName, setLkName] = useState('');
  const [lkSourceId, setLkSourceId] = useState('');
  const [lkCountry, setLkCountry] = useState('US');
  const [lkSize, setLkSize] = useState('1');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: caData } = await supabase.from('meta_custom_audiences').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
      if (caData) setCustomAudiences(caData as CustomAudience[]);

      const { data: lkData } = await supabase.from('meta_lookalike_audiences').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
      if (lkData) setLookalikes(lkData as LookalikeAudience[]);

      const { count } = await supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('user_id', session.user.id);
      setLeadCount(count || 0);
    } catch {
      // ignore
    }
    setLoading(false);
  }, [session.user.id]);

  const fetchMetaAudiences = async () => {
    setActionLoading(true);
    setError('');
    try {
      const result = await callApi('list_custom_audiences');
      setMetaAudiences((result.audiences as Array<Record<string, unknown>>) || []);
      await loadData();
      setSuccess('Audiences synced from Meta');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch audiences');
    }
    setActionLoading(false);
  };

  const handleCreateAudience = async () => {
    if (!audName.trim()) { setError('Audience name is required'); return; }
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      const leadIds = audLeadIds.trim() ? audLeadIds.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
      const result = await callApi('create_custom_audience', {
        name: audName.trim(),
        description: audDesc || undefined,
        lead_ids: leadIds,
      });
      setSuccess(`Custom audience created with ${result.lead_count || leadCount} leads`);
      setAudName(''); setAudDesc(''); setAudLeadIds('');
      setShowCreate(false);
      await loadData();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create audience');
    }
    setActionLoading(false);
  };

  const handleDeleteAudience = async (audienceId: string) => {
    if (!confirm('Delete this custom audience? This cannot be undone.')) return;
    setActionLoading(true);
    setError('');
    try {
      await callApi('delete_custom_audience', { audience_id: audienceId });
      setCustomAudiences((prev) => prev.filter((a) => a.audience_id !== audienceId));
      setSuccess('Audience deleted');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete audience');
    }
    setActionLoading(false);
  };

  const handleCreateLookalike = async () => {
    if (!lkName.trim() || !lkSourceId) { setError('Name and source audience are required'); return; }
    setActionLoading(true);
    setError('');
    try {
      await callApi('create_lookalike_audience', {
        name: lkName.trim(),
        source_audience_id: lkSourceId,
        country: lkCountry,
        audience_size: lkSize,
      });
      setSuccess('Lookalike audience created');
      setLkName(''); setLkSourceId(''); setShowLookalike(false);
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create lookalike audience');
    }
    setActionLoading(false);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1px solid var(--border-subtle)', borderRadius: '8px',
    background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.85rem', outline: 'none',
  };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Audiences</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={fetchMetaAudiences} disabled={actionLoading} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            {actionLoading ? <Loader2 size={15} className="crm-spin" /> : <RefreshCw size={15} />} Sync from Meta
          </button>
          <button onClick={() => setShowLookalike(true)} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={15} /> Lookalike
          </button>
          <button onClick={() => setShowCreate(true)} style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#1877F2', color: '#fff', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={15} /> Create Custom Audience
          </button>
        </div>
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '12px 16px', color: '#dc2626', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}><AlertCircle size={16} /> {error}</div>}
      {success && <div style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: '10px', padding: '12px 16px', color: '#16a34a', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} /> {success}</div>}

      {/* Create custom audience modal */}
      {showCreate && (
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', padding: '24px' }}>
          <h4 style={{ margin: '0 0 6px', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>Create Custom Audience from CRM Leads</h4>
          <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Push your CRM leads to Facebook as a custom audience for retargeting. Lead emails and phone numbers are SHA-256 hashed before being sent to Meta.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Audience Name *</label>
              <input type="text" value={audName} onChange={(e) => setAudName(e.target.value)} placeholder="e.g. Interested Leads — Q4" style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Description (optional)</label>
              <input type="text" value={audDesc} onChange={(e) => setAudDesc(e.target.value)} placeholder="e.g. All leads marked as interested" style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Specific Lead IDs (optional, comma-separated)</label>
              <input type="text" value={audLeadIds} onChange={(e) => setAudLeadIds(e.target.value)} placeholder="Leave empty to use all leads" style={inputStyle} />
              <small style={{ fontSize: '0.74rem', color: 'var(--text-dark)', marginTop: '4px', display: 'block' }}>
                You have {leadCount.toLocaleString()} leads in your CRM. Leave empty to include all of them.
              </small>
            </div>
          </div>
          <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
            <button onClick={handleCreateAudience} disabled={actionLoading || !audName.trim()} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: audName.trim() && !actionLoading ? '#1877F2' : '#cbd5e1', color: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {actionLoading ? <Loader2 size={16} className="crm-spin" /> : <Users size={16} />} Create Audience
            </button>
            <button onClick={() => setShowCreate(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Create lookalike modal */}
      {showLookalike && (
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', padding: '24px' }}>
          <h4 style={{ margin: '0 0 6px', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>Create Lookalike Audience</h4>
          <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Find new people similar to your existing CRM leads. Meta will analyze the source audience and find people with similar characteristics.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Lookalike Name *</label>
              <input type="text" value={lkName} onChange={(e) => setLkName(e.target.value)} placeholder="e.g. Lookalike — Top Customers" style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Source Audience *</label>
              <select value={lkSourceId} onChange={(e) => setLkSourceId(e.target.value)} style={inputStyle}>
                <option value="">Select source audience...</option>
                {customAudiences.map((a) => <option key={a.id} value={a.audience_id}>{a.name}</option>)}
                {metaAudiences.map((a, i) => <option key={i} value={String(a.id)}>{String(a.name)}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Country</label>
              <select value={lkCountry} onChange={(e) => setLkCountry(e.target.value)} style={inputStyle}>
                <option value="US">United States</option><option value="IN">India</option><option value="GB">United Kingdom</option>
                <option value="AE">UAE</option><option value="SG">Singapore</option><option value="AU">Australia</option><option value="CA">Canada</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Audience Size (%)</label>
              <select value={lkSize} onChange={(e) => setLkSize(e.target.value)} style={inputStyle}>
                <option value="1">1% (Most similar, smallest)</option><option value="2">2%</option><option value="3">3%</option>
                <option value="5">5%</option><option value="10">10% (Least similar, largest)</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
            <button onClick={handleCreateLookalike} disabled={actionLoading || !lkName.trim() || !lkSourceId} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: lkName.trim() && lkSourceId && !actionLoading ? '#8B5CF6' : '#cbd5e1', color: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {actionLoading ? <Loader2 size={16} className="crm-spin" /> : <Sparkles size={16} />} Create Lookalike
            </button>
            <button onClick={() => setShowLookalike(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Custom audiences list */}
      <div>
        <h4 style={{ margin: '0 0 10px', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>Custom Audiences</h4>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Loader2 size={24} className="crm-spin" style={{ color: '#1877F2' }} /></div>
        ) : customAudiences.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
            <Users size={36} style={{ color: 'var(--text-dark)', margin: '0 auto 10px' }} />
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No custom audiences yet. Create one from your CRM leads.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {customAudiences.map((aud) => (
              <div key={aud.id} style={{ background: 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--border-subtle)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>{aud.name}</div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-dark)', marginTop: '4px' }}>
                    {aud.description || 'No description'} &middot; {aud.estimated_size?.toLocaleString() || '—'} people &middot; {aud.status}
                    {aud.audience_id && ` &middot; ID: ${aud.audience_id}`}
                  </div>
                </div>
                <button onClick={() => handleDeleteAudience(aud.audience_id)} disabled={actionLoading} title="Delete audience" style={{ width: '34px', height: '34px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: '#dc2626', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lookalike audiences list */}
      {lookalikes.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 10px', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>Lookalike Audiences</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {lookalikes.map((lk) => (
              <div key={lk.id} style={{ background: 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--border-subtle)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} style={{ color: '#8B5CF6' }} />
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>{lk.name}</span>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-dark)', marginTop: '4px' }}>
                    {lk.audience_size}% lookalike &middot; {lk.country} &middot; {lk.status}
                    {lk.lookalike_audience_id && ` &middot; ID: ${lk.lookalike_audience_id}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
