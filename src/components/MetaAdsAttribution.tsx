import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { DollarSign, TrendingUp, RefreshCw, Loader2, AlertCircle, CheckCircle2, Zap, Link2 } from 'lucide-react';

interface MetaAdsAttributionProps {
  session: { user: { id: string } };
  callApi: (action: string, extra?: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

interface Attribution {
  id: string;
  submission_id: string;
  meta_campaign_id: string | null;
  campaign_name: string | null;
  lead_source: string;
  attributed_revenue: number;
  attributed_at: string;
  submission: {
    full_name: string;
    email: string | null;
    mobile_number: string | null;
    status: string;
    purchase_value: number | null;
    fund_amount: number | null;
  } | null;
}

export default function MetaAdsAttribution({ session, callApi }: MetaAdsAttributionProps) {
  const [attributions, setAttributions] = useState<Attribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await callApi('get_attribution');
      setAttributions((result.attributions as Attribution[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load attribution data');
    }
    setLoading(false);
  }, [callApi]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAutoAttribute = async () => {
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      const result = await callApi('auto_attribute_leads');
      setSuccess(result.message as string || 'Attribution complete');
      await loadData();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to auto-attribute');
    }
    setActionLoading(false);
  };

  const handleManualAttribute = async (submissionId: string, campaignId: string, campaignName: string) => {
    setActionLoading(true);
    setError('');
    try {
      await callApi('create_attribution', {
        submission_id: submissionId,
        meta_campaign_id: campaignId,
        campaign_name: campaignName,
      });
      await loadData();
      setSuccess('Lead attributed to campaign');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create attribution');
    }
    setActionLoading(false);
  };

  const totalRevenue = attributions.reduce((sum, a) => sum + (a.attributed_revenue || 0), 0);
  const totalLeads = attributions.length;
  const campaigns = [...new Set(attributions.map((a) => a.campaign_name).filter(Boolean))] as string[];
  const avgRevenuePerLead = totalLeads > 0 ? totalRevenue / totalLeads : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Lead-to-Ad Attribution</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={loadData} disabled={loading} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            {loading ? <Loader2 size={15} className="crm-spin" /> : <RefreshCw size={15} />} Refresh
          </button>
          <button onClick={handleAutoAttribute} disabled={actionLoading} style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#1877F2', color: '#fff', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            {actionLoading ? <Loader2 size={15} className="crm-spin" /> : <Zap size={15} />} Auto-Attribute Leads
          </button>
        </div>
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '12px 16px', color: '#dc2626', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}><AlertCircle size={16} /> {error}</div>}
      {success && <div style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: '10px', padding: '12px 16px', color: '#16a34a', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} /> {success}</div>}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(24,119,242,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1877F2' }}><TrendingUp size={18} /></div>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-dark)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Attributed Leads</span>
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)' }}>{totalLeads.toLocaleString()}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(22,163,74,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}><DollarSign size={18} /></div>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-dark)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Attributed Revenue</span>
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)' }}>${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8B5CF6' }}><DollarSign size={18} /></div>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-dark)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Revenue / Lead</span>
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)' }}>${avgRevenuePerLead.toFixed(2)}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(13,148,136,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0d9488' }}><Link2 size={18} /></div>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-dark)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Campaigns</span>
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)' }}>{campaigns.length}</div>
        </div>
      </div>

      {/* Attribution table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Loader2 size={24} className="crm-spin" style={{ color: '#1877F2' }} /></div>
      ) : attributions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
          <TrendingUp size={36} style={{ color: 'var(--text-dark)', margin: '0 auto 10px' }} />
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>No attribution data yet. Click "Auto-Attribute Leads" to automatically match your CRM leads to Meta campaigns.</p>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-light)' }}>
                  <th style={th}>Lead Name</th>
                  <th style={th}>Email</th>
                  <th style={th}>Phone</th>
                  <th style={th}>Status</th>
                  <th style={th}>Campaign</th>
                  <th style={th}>Source</th>
                  <th style={th}>Revenue</th>
                  <th style={th}>Attributed At</th>
                </tr>
              </thead>
              <tbody>
                {attributions.map((attr) => (
                  <tr key={attr.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={td}>{attr.submission?.full_name || 'Unknown'}</td>
                    <td style={td}>{attr.submission?.email || '—'}</td>
                    <td style={td}>{attr.submission?.mobile_number || '—'}</td>
                    <td style={td}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: 'rgba(24,119,242,0.1)', color: '#1877F2', textTransform: 'capitalize' }}>
                        {attr.submission?.status || '—'}
                      </span>
                    </td>
                    <td style={td}>{attr.campaign_name || attr.meta_campaign_id || '—'}</td>
                    <td style={td}>{attr.lead_source || 'Meta Ads'}</td>
                    <td style={td, fontWeight: 700, color: '#16a34a' }}>${(attr.attributed_revenue || 0).toFixed(2)}</td>
                    <td style={td}>{new Date(attr.attributed_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: '0.76rem', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.04em' };
const td: React.CSSProperties = { padding: '10px 14px', fontSize: '0.82rem', color: 'var(--text-main)', fontWeight: 500 };
