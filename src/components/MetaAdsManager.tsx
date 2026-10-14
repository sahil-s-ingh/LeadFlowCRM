import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  TrendingUp, Plus, RefreshCw, Play, Pause, Trash2, Eye, EyeOff,
  CheckCircle2, AlertCircle, Loader2, Globe, Target, DollarSign,
  BarChart3, Settings as SettingsIcon, Zap, ExternalLink, ChevronDown,
} from 'lucide-react';

interface MetaAdsManagerProps {
  session: { user: { id: string; email?: string } };
}

interface AdsSettings {
  id?: string;
  app_id: string | null;
  app_secret: string | null;
  access_token: string | null;
  ad_account_id: string | null;
  is_connected: boolean;
}

interface Campaign {
  id: string;
  meta_campaign_id: string | null;
  name: string;
  objective: string;
  status: string;
  buying_type: string;
  daily_budget: number | null;
  lifetime_budget: number | null;
  currency: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  cpl: number | null;
  ctr: number | null;
  last_synced_at: string | null;
  created_at: string;
}

type View = 'overview' | 'settings' | 'campaigns' | 'create';

const OBJECTIVES = [
  { value: 'OUTCOME_TRAFFIC', label: 'Traffic — Send people to a website' },
  { value: 'OUTCOME_LEADS', label: 'Leads — Collect leads via forms' },
  { value: 'OUTCOME_ENGAGEMENT', label: 'Engagement — Get more messages and engagement' },
  { value: 'OUTCOME_AWARENESS', label: 'Awareness — Maximize ad reach' },
  { value: 'OUTCOME_SALES', label: 'Sales — Drive online sales' },
  { value: 'OUTCOME_APP_PROMOTION', label: 'App Promotion — Get app installs' },
];

const CALL_TO_ACTIONS = [
  'LEARN_MORE', 'SIGN_UP', 'SUBSCRIBE', 'CONTACT_US', 'SHOP_NOW',
  'BOOK_NOW', 'GET_QUOTE', 'DOWNLOAD', 'APPLY_NOW', 'REGISTER_NOW',
];

export default function MetaAdsManager({ session }: MetaAdsManagerProps) {
  const [view, setView] = useState<View>('overview');
  const [settings, setSettings] = useState<AdsSettings | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [adAccounts, setAdAccounts] = useState<Array<{ id: string; name: string; currency: string; account_status: number }>>([]);
  const [verifyResult, setVerifyResult] = useState<{ name: string; currency: string; amount_spent: string; balance: string } | null>(null);

  // Settings form state
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [adAccountId, setAdAccountId] = useState('');

  // Create campaign form state
  const [campName, setCampName] = useState('');
  const [campObjective, setCampObjective] = useState('OUTCOME_TRAFFIC');
  const [campBuyingType, setCampBuyingType] = useState('AUCTION');
  const [campDailyBudget, setCampDailyBudget] = useState('');
  const [campLifetimeBudget, setCampLifetimeBudget] = useState('');
  const [campCurrency, setCampCurrency] = useState('USD');
  const [campStartTime, setCampStartTime] = useState('');

  // Insights state
  const [insights, setInsights] = useState<Array<Record<string, unknown>>>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('last_7d');

  const callApi = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-ads-manager`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ action, ...extra }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || result.details || `Request failed (${response.status})`);
    }
    return result;
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: settingsData } = await supabase
        .from('meta_ads_settings')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (settingsData) {
        setSettings(settingsData as AdsSettings);
        setAppId(settingsData.app_id || '');
        setAppSecret(settingsData.app_secret || '');
        setAccessToken(settingsData.access_token || '');
        setAdAccountId(settingsData.ad_account_id || '');
      }

      const { data: campData } = await supabase
        .from('meta_ad_campaigns')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (campData) setCampaigns(campData as Campaign[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    }
    setLoading(false);
  }, [session.user.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveSettings = async () => {
    setActionLoading(true);
    setError('');
    setSuccess('');
    setVerifyResult(null);
    try {
      await callApi('save_settings', {
        app_id: appId,
        app_secret: appSecret,
        access_token: accessToken,
        ad_account_id: adAccountId,
      });
      setSuccess('Settings saved successfully.');
      setSettings({
        app_id: appId || null,
        app_secret: appSecret || null,
        access_token: accessToken || null,
        ad_account_id: adAccountId.replace(/^act_/, '') || null,
        is_connected: !!(accessToken && adAccountId),
      });
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    }
    setActionLoading(false);
  };

  const handleVerify = async () => {
    setActionLoading(true);
    setError('');
    setVerifyResult(null);
    try {
      const result = await callApi('verify_connection');
      if (result.account) {
        setVerifyResult({
          name: result.account.name || 'Unknown',
          currency: result.account.currency || 'USD',
          amount_spent: result.account.amount_spent || '0',
          balance: result.account.balance || '0',
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    }
    setActionLoading(false);
  };

  const handleFetchAdAccounts = async () => {
    setActionLoading(true);
    setError('');
    try {
      const result = await callApi('get_ad_accounts');
      setAdAccounts(result.accounts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch ad accounts');
    }
    setActionLoading(false);
  };

  const handleSyncMetaCampaigns = async () => {
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      const result = await callApi('sync_campaign_stats');
      setSuccess(result.message || 'Stats synced');
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    }
    setActionLoading(false);
  };

  const handleToggleCampaign = async (campaign: Campaign) => {
    if (!campaign.meta_campaign_id) return;
    const newStatus = campaign.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    setActionLoading(true);
    setError('');
    try {
      await callApi('update_campaign_status', {
        campaign_id: campaign.meta_campaign_id,
        status: newStatus,
      });
      setCampaigns(prev => prev.map(c =>
        c.id === campaign.id ? { ...c, status: newStatus } : c
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update campaign');
    }
    setActionLoading(false);
  };

  const handleDeleteCampaign = async (campaign: Campaign) => {
    if (!campaign.meta_campaign_id) return;
    if (!confirm(`Delete campaign "${campaign.name}"? This cannot be undone.`)) return;
    setActionLoading(true);
    setError('');
    try {
      await callApi('delete_campaign', { campaign_id: campaign.meta_campaign_id });
      setCampaigns(prev => prev.filter(c => c.id !== campaign.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete campaign');
    }
    setActionLoading(false);
  };

  const handleCreateCampaign = async () => {
    if (!campName.trim()) {
      setError('Campaign name is required');
      return;
    }
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      const result = await callApi('create_campaign', {
        name: campName,
        objective: campObjective,
        buying_type: campBuyingType,
        daily_budget: campDailyBudget || null,
        lifetime_budget: campLifetimeBudget || null,
        currency: campCurrency,
        start_time: campStartTime || null,
      });
      setSuccess(`Campaign created (ID: ${result.campaign_id}). It starts paused — review it in Facebook Ads Manager before activating.`);
      setCampName('');
      setCampDailyBudget('');
      setCampLifetimeBudget('');
      setCampStartTime('');
      await loadData();
      setView('campaigns');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create campaign');
    }
    setActionLoading(false);
  };

  const handleFetchInsights = async (campaignId?: string) => {
    setInsightsLoading(true);
    setError('');
    try {
      const result = await callApi('get_insights', {
        campaign_id: campaignId || selectedCampaignId || undefined,
        date_range: dateRange,
      });
      setInsights(result.insights || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch insights');
    }
    setInsightsLoading(false);
  };

  const isConnected = settings?.is_connected;

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid var(--border-subtle)',
    borderRadius: '8px',
    background: 'var(--bg-card)',
    color: 'var(--text-main)',
    fontSize: '0.85rem',
    outline: 'none',
    transition: 'border-color 0.15s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.82rem',
    fontWeight: 600,
    color: 'var(--text-main)',
    marginBottom: '6px',
  };

  const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
  const totalImpressions = campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
  const totalLeads = campaigns.reduce((sum, c) => sum + (c.leads || 0), 0);
  const activeCount = campaigns.filter(c => c.status === 'ACTIVE').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, #1877F2, #0d5fc3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={24} style={{ color: '#fff' }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>Meta Ads Manager</h2>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Create and manage Facebook &amp; Instagram ad campaigns</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => setView('overview')} style={{ ...tabBtnStyle, background: view === 'overview' ? '#1877F2' : 'var(--bg-card)', color: view === 'overview' ? '#fff' : 'var(--text-main)' }}>
            <BarChart3 size={16} /> Overview
          </button>
          <button onClick={() => setView('campaigns')} style={{ ...tabBtnStyle, background: view === 'campaigns' ? '#1877F2' : 'var(--bg-card)', color: view === 'campaigns' ? '#fff' : 'var(--text-main)' }}>
            <Target size={16} /> Campaigns
          </button>
          <button onClick={() => setView('settings')} style={{ ...tabBtnStyle, background: view === 'settings' ? '#1877F2' : 'var(--bg-card)', color: view === 'settings' ? '#fff' : 'var(--text-main)' }}>
            <SettingsIcon size={16} /> Settings
          </button>
        </div>
      </div>

      {/* Status banner */}
      {!isConnected && view !== 'settings' && (
        <div style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={20} style={{ color: '#eab308', flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: '0.85rem', color: '#854d0e' }}>
            <strong>Meta Ads not connected.</strong> Go to Settings to enter your Meta Marketing API credentials.
          </div>
          <button onClick={() => setView('settings')} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(234,179,8,0.4)', background: 'rgba(234,179,8,0.1)', color: '#854d0e', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
            Configure
          </button>
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '12px 16px', color: '#dc2626', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {success && (
        <div style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: '10px', padding: '12px 16px', color: '#16a34a', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} /> {success}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <Loader2 size={28} className="crm-spin" style={{ color: '#1877F2' }} />
        </div>
      ) : (
        <>
          {/* ─── OVERVIEW VIEW ─── */}
          {view === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Stats cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                <StatCard icon={<DollarSign size={18} />} label="Total Spend" value={`$${totalSpend.toFixed(2)}`} color="#1877F2" />
                <StatCard icon={<Eye size={18} />} label="Impressions" value={totalImpressions.toLocaleString()} color="#8B5CF6" />
                <StatCard icon={<Zap size={18} />} label="Clicks" value={totalClicks.toLocaleString()} color="#F59E0B" />
                <StatCard icon={<TrendingUp size={18} />} label="Leads" value={totalLeads.toString()} color="#16A34A" />
                <StatCard icon={<Target size={18} />} label="Active Campaigns" value={activeCount.toString()} color="#0d9488" />
              </div>

              {/* Quick actions */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                <ActionCard
                  icon={<Plus size={20} />}
                  title="Create Campaign"
                  desc="Launch a new Facebook or Instagram ad campaign"
                  onClick={() => setView('create')}
                  color="#1877F2"
                />
                <ActionCard
                  icon={<RefreshCw size={20} />}
                  title="Sync Campaign Stats"
                  desc="Pull latest spend and performance data from Meta"
                  onClick={handleSyncMetaCampaigns}
                  loading={actionLoading}
                  color="#0d9488"
                />
                <ActionCard
                  icon={<BarChart3 size={20} />}
                  title="View Performance Insights"
                  desc="See detailed breakdown of spend, clicks, and CPL"
                  onClick={() => { setView('campaigns'); setSelectedCampaignId(null); handleFetchInsights(); }}
                  color="#8B5CF6"
                />
              </div>

              {/* Recent campaigns preview */}
              {campaigns.length > 0 && (
                <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>Recent Campaigns</h3>
                    <button onClick={() => setView('campaigns')} style={{ fontSize: '0.8rem', color: '#1877F2', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                      View all
                    </button>
                  </div>
                  <div>
                    {campaigns.slice(0, 5).map(camp => (
                      <div key={camp.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-main)' }}>{camp.name}</div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-dark)' }}>{camp.objective.replace(/_/g, ' ')} &middot; {camp.currency}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>${(camp.spend || 0).toFixed(2)}</span>
                          <StatusBadge status={camp.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Info panel */}
              <div style={{ background: 'rgba(24,119,242,0.06)', border: '1px solid rgba(24,119,242,0.2)', borderRadius: '10px', padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <Globe size={20} style={{ color: '#1877F2', flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    <strong style={{ color: '#1877F2' }}>About Meta Ads Manager</strong><br />
                    Create and manage Facebook &amp; Instagram ad campaigns without leaving your CRM. Track spend, impressions, clicks, and cost-per-lead across all your campaigns. Campaigns are created in a <strong>paused</strong> state — review them in Facebook Ads Manager before activating to go live.
                    <br /><br />
                    <strong>Prerequisites:</strong> A Meta Business Manager account, a Facebook App with Marketing API access, and a valid long-lived access token. Visit <a href="https://developers.facebook.com/docs/marketing-api" target="_blank" rel="noopener noreferrer" style={{ color: '#1877F2', textDecoration: 'none' }}>developers.facebook.com/docs/marketing-api</a> to get started.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── CAMPAIGNS VIEW ─── */}
          {view === 'campaigns' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Campaigns</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={handleSyncMetaCampaigns} disabled={actionLoading} style={{ ...tabBtnStyle, opacity: actionLoading ? 0.6 : 1 }}>
                    {actionLoading ? <Loader2 size={16} className="crm-spin" /> : <RefreshCw size={16} />} Sync
                  </button>
                  <button onClick={() => setView('create')} style={{ ...tabBtnStyle, background: '#1877F2', color: '#fff' }}>
                    <Plus size={16} /> New Campaign
                  </button>
                </div>
              </div>

              {campaigns.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                  <Target size={40} style={{ color: 'var(--text-dark)', margin: '0 auto 12px' }} />
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>No campaigns yet. Create your first ad campaign to get started.</p>
                  <button onClick={() => setView('create')} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#1877F2', color: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={16} /> Create Campaign
                  </button>
                </div>
              ) : (
                <>
                  {/* Insights section */}
                  <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                      <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>Performance Insights</h4>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.8rem', cursor: 'pointer' }}>
                          <option value="today">Today</option>
                          <option value="yesterday">Yesterday</option>
                          <option value="last_3d">Last 3 days</option>
                          <option value="last_7d">Last 7 days</option>
                          <option value="last_14d">Last 14 days</option>
                          <option value="last_30d">Last 30 days</option>
                          <option value="this_month">This month</option>
                          <option value="last_month">Last month</option>
                          <option value="maximum">All time</option>
                        </select>
                        <button onClick={() => handleFetchInsights()} disabled={insightsLoading} style={{ ...tabBtnStyle, padding: '6px 12px', fontSize: '0.78rem' }}>
                          {insightsLoading ? <Loader2 size={14} className="crm-spin" /> : <BarChart3 size={14} />} Fetch
                        </button>
                      </div>
                    </div>
                    {insights.length > 0 && (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                          <thead>
                            <tr style={{ background: 'var(--bg-light)' }}>
                              <th style={thStyle}>Spend</th>
                              <th style={thStyle}>Impressions</th>
                              <th style={thStyle}>Clicks</th>
                              <th style={thStyle}>CTR</th>
                              <th style={thStyle}>CPM</th>
                              <th style={thStyle}>CPC</th>
                              <th style={thStyle}>Reach</th>
                            </tr>
                          </thead>
                          <tbody>
                            {insights.map((row, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <td style={tdStyle}>${parseFloat(String(row.spend || '0')).toFixed(2)}</td>
                                <td style={tdStyle}>{parseInt(String(row.impressions || '0'), 10).toLocaleString()}</td>
                                <td style={tdStyle}>{parseInt(String(row.clicks || '0'), 10).toLocaleString()}</td>
                                <td style={tdStyle}>{parseFloat(String(row.ctr || '0')).toFixed(2)}%</td>
                                <td style={tdStyle}>${parseFloat(String(row.cpm || '0')).toFixed(2)}</td>
                                <td style={tdStyle}>${parseFloat(String(row.cpc || '0')).toFixed(2)}</td>
                                <td style={tdStyle}>{parseInt(String(row.reach || '0'), 10).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {insights.length === 0 && (
                      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dark)', fontSize: '0.82rem' }}>
                        Click "Fetch" to load performance data from Meta.
                      </div>
                    )}
                  </div>

                  {/* Campaign list */}
                  <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                    {campaigns.map(camp => (
                      <div key={camp.id} style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                          <div style={{ flex: 1, minWidth: '200px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>{camp.name}</span>
                              <StatusBadge status={camp.status} />
                            </div>
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-dark)' }}>
                              {camp.objective.replace(/_/g, ' ')} &middot; {camp.buying_type}
                              {camp.daily_budget && ` &middot; $${camp.daily_budget}/day`}
                              {camp.meta_campaign_id && ` &middot; ID: ${camp.meta_campaign_id}`}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                            <button
                              onClick={() => handleFetchInsights(camp.meta_campaign_id || undefined)}
                              disabled={!camp.meta_campaign_id}
                              title="View insights"
                              style={iconBtnStyle}
                            >
                              <BarChart3 size={16} />
                            </button>
                            <button
                              onClick={() => handleToggleCampaign(camp)}
                              disabled={!camp.meta_campaign_id || actionLoading}
                              title={camp.status === 'ACTIVE' ? 'Pause' : 'Activate'}
                              style={iconBtnStyle}
                            >
                              {camp.status === 'ACTIVE' ? <Pause size={16} /> : <Play size={16} />}
                            </button>
                            {camp.meta_campaign_id && (
                              <a
                                href={`https://www.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=${camp.meta_campaign_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open in Facebook Ads Manager"
                                style={{ ...iconBtnStyle, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <ExternalLink size={16} />
                              </a>
                            )}
                            <button
                              onClick={() => handleDeleteCampaign(camp)}
                              disabled={!camp.meta_campaign_id || actionLoading}
                              title="Delete campaign"
                              style={{ ...iconBtnStyle, color: '#dc2626' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        {(camp.spend > 0 || camp.impressions > 0) && (
                          <div style={{ display: 'flex', gap: '20px', marginTop: '10px', flexWrap: 'wrap' }}>
                            <MiniStat label="Spend" value={`$${(camp.spend || 0).toFixed(2)}`} />
                            <MiniStat label="Impressions" value={(camp.impressions || 0).toLocaleString()} />
                            <MiniStat label="Clicks" value={(camp.clicks || 0).toLocaleString()} />
                            <MiniStat label="Leads" value={(camp.leads || 0).toString()} />
                            <MiniStat label="CPL" value={camp.cpl ? `$${camp.cpl.toFixed(2)}` : '—'} />
                            <MiniStat label="CTR" value={camp.ctr ? `${camp.ctr.toFixed(2)}%` : '—'} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ─── CREATE CAMPAIGN VIEW ─── */}
          {view === 'create' && (
            <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', padding: '24px' }}>
              <h3 style={{ margin: '0 0 6px', fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Create New Campaign</h3>
              <p style={{ margin: '0 0 20px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Campaigns are created in a paused state. Review in Facebook Ads Manager before activating.</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Campaign Name <em style={{ color: '#dc2626' }}>*</em></label>
                  <input type="text" value={campName} onChange={(e) => setCampName(e.target.value)} placeholder="e.g. Q4 Lead Generation — Forex" style={inputStyle} />
                </div>

                <div>
                  <label style={labelStyle}>Objective</label>
                  <select value={campObjective} onChange={(e) => setCampObjective(e.target.value)} style={inputStyle}>
                    {OBJECTIVES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Buying Type</label>
                  <select value={campBuyingType} onChange={(e) => setCampBuyingType(e.target.value)} style={inputStyle}>
                    <option value="AUCTION">Auction (recommended)</option>
                    <option value="REACH_AND_FREQUENCY">Reach &amp; Frequency</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Currency</label>
                  <select value={campCurrency} onChange={(e) => setCampCurrency(e.target.value)} style={inputStyle}>
                    <option value="USD">USD</option>
                    <option value="INR">INR</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="AED">AED</option>
                    <option value="SGD">SGD</option>
                    <option value="AUD">AUD</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Daily Budget (optional)</label>
                  <input type="number" min="1" step="0.01" value={campDailyBudget} onChange={(e) => setCampDailyBudget(e.target.value)} placeholder="e.g. 50.00" style={inputStyle} />
                </div>

                <div>
                  <label style={labelStyle}>Lifetime Budget (optional)</label>
                  <input type="number" min="1" step="0.01" value={campLifetimeBudget} onChange={(e) => setCampLifetimeBudget(e.target.value)} placeholder="e.g. 500.00" style={inputStyle} />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Start Time (optional)</label>
                  <input type="datetime-local" value={campStartTime} onChange={(e) => setCampStartTime(e.target.value)} style={inputStyle} />
                  <small style={{ fontSize: '0.74rem', color: 'var(--text-dark)', marginTop: '4px', display: 'block' }}>Leave empty to start when you activate the campaign.</small>
                </div>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleCreateCampaign}
                  disabled={!campName.trim() || actionLoading}
                  style={{
                    padding: '10px 20px', borderRadius: '8px', border: 'none',
                    background: campName.trim() && !actionLoading ? '#1877F2' : '#cbd5e1',
                    color: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: campName.trim() && !actionLoading ? 'pointer' : 'not-allowed',
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  {actionLoading ? <Loader2 size={16} className="crm-spin" /> : <Plus size={16} />} Create Campaign
                </button>
                <button onClick={() => setView('campaigns')} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ─── SETTINGS VIEW ─── */}
          {view === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', padding: '24px' }}>
                <h3 style={{ margin: '0 0 6px', fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Meta Marketing API Credentials</h3>
                <p style={{ margin: '0 0 20px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Connect your Meta Business Manager account to create and manage ads.</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={labelStyle}>App ID</label>
                    <input type="text" value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="1234567890123456" style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.82rem' }} />
                  </div>
                  <div>
                    <label style={labelStyle}>App Secret</label>
                    <div style={{ position: 'relative' }}>
                      <input type={showSecret ? 'text' : 'password'} value={appSecret} onChange={(e) => setAppSecret(e.target.value)} placeholder="••••••••••••••••" style={{ ...inputStyle, paddingRight: '38px', fontFamily: 'monospace', fontSize: '0.82rem' }} />
                      <button type="button" onClick={() => setShowSecret(!showSecret)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dark)', padding: '4px' }}>
                        {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Access Token <em style={{ color: '#dc2626' }}>*</em></label>
                    <div style={{ position: 'relative' }}>
                      <input type={showToken ? 'text' : 'password'} value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="EAAGxxxxxxxxxxxxxxxxx..." style={{ ...inputStyle, paddingRight: '38px', fontFamily: 'monospace', fontSize: '0.82rem' }} />
                      <button type="button" onClick={() => setShowToken(!showToken)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dark)', padding: '4px' }}>
                        {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <small style={{ fontSize: '0.74rem', color: 'var(--text-dark)', marginTop: '4px', display: 'block' }}>
                      Generate a long-lived access token in <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" style={{ color: '#1877F2' }}>Graph API Explorer</a> with the ads_management permission.
                    </small>
                  </div>
                  <div>
                    <label style={labelStyle}>Ad Account ID <em style={{ color: '#dc2626' }}>*</em></label>
                    <input type="text" value={adAccountId} onChange={(e) => setAdAccountId(e.target.value)} placeholder="1234567890" style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.82rem' }} />
                    <small style={{ fontSize: '0.74rem', color: 'var(--text-dark)', marginTop: '4px', display: 'block' }}>Found in Facebook Ads Manager. Without the "act_" prefix.</small>
                  </div>
                </div>

                <div style={{ marginTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button onClick={handleSaveSettings} disabled={actionLoading} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#1877F2', color: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    {actionLoading ? <Loader2 size={16} className="crm-spin" /> : <CheckCircle2 size={16} />} Save Settings
                  </button>
                  <button onClick={handleVerify} disabled={actionLoading || (!accessToken && !settings?.access_token)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    {actionLoading ? <Loader2 size={16} className="crm-spin" /> : <Globe size={16} />} Verify Connection
                  </button>
                  <button onClick={handleFetchAdAccounts} disabled={actionLoading || (!accessToken && !settings?.access_token)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Target size={16} /> List Ad Accounts
                  </button>
                </div>

                {verifyResult && (
                  <div style={{ marginTop: '16px', padding: '14px 16px', background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <CheckCircle2 size={18} style={{ color: '#16a34a' }} />
                      <strong style={{ fontSize: '0.85rem', color: '#16a34a' }}>Connection verified!</strong>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px' }}>
                      <span><strong>Account:</strong> {verifyResult.name}</span>
                      <span><strong>Currency:</strong> {verifyResult.currency}</span>
                      <span><strong>Amount Spent:</strong> ${(parseFloat(verifyResult.amount_spent) / 100).toFixed(2)}</span>
                      <span><strong>Balance:</strong> ${(parseFloat(verifyResult.balance) / 100).toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {adAccounts.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <h4 style={{ margin: '0 0 8px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>Your Ad Accounts</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {adAccounts.map(acct => (
                        <button
                          key={acct.id}
                          onClick={() => setAdAccountId(acct.id.replace(/^act_/, ''))}
                          style={{ padding: '10px 14px', borderRadius: '8px', border: adAccountId === acct.id.replace(/^act_/, '') ? '2px solid #1877F2' : '1px solid var(--border-subtle)', background: adAccountId === acct.id.replace(/^act_/, '') ? 'rgba(24,119,242,0.08)' : 'var(--bg-light)', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                        >
                          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>{acct.name}</span>
                          <span style={{ fontSize: '0.76rem', color: 'var(--text-dark)' }}>{acct.id.replace(/^act_/, '')} &middot; {acct.currency}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Setup guide */}
              <div style={{ background: 'var(--bg-light)', borderRadius: '12px', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                <details>
                  <summary style={{ padding: '14px 20px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', listStyle: 'none', userSelect: 'none' }}>
                    <ChevronDown size={18} style={{ color: '#1877F2' }} />
                    Setup Guide: How to get Meta Marketing API credentials
                  </summary>
                  <div style={{ padding: '0 20px 16px', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)', margin: '12px 0 8px' }}>Step 1 — Create a Meta App</h4>
                    <ol style={{ margin: '0 0 12px', paddingLeft: '20px' }}>
                      <li>Go to <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer" style={{ color: '#1877F2' }}>developers.facebook.com/apps</a> and click "Create App".</li>
                      <li>Choose "Business" as the app type and give it a name.</li>
                      <li>In your app dashboard, add the "Marketing API" product.</li>
                      <li>Copy your <strong>App ID</strong> and <strong>App Secret</strong> from Settings &rarr; Basic.</li>
                    </ol>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)', margin: '12px 0 8px' }}>Step 2 — Generate an Access Token</h4>
                    <ol style={{ margin: '0 0 12px', paddingLeft: '20px' }}>
                      <li>Go to the <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" style={{ color: '#1877F2' }}>Graph API Explorer</a>.</li>
                      <li>Select your app from the dropdown.</li>
                      <li>Click "Generate Access Token" and select the <strong>ads_management</strong> permission.</li>
                      <li>Copy the generated token.</li>
                      <li>For a long-lived token, use the <a href="https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived" target="_blank" rel="noopener noreferrer" style={{ color: '#1877F2' }}>long-lived token guide</a>.</li>
                    </ol>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)', margin: '12px 0 8px' }}>Step 3 — Find your Ad Account ID</h4>
                    <ol style={{ margin: '0 0 12px', paddingLeft: '20px' }}>
                      <li>Open <a href="https://www.facebook.com/adsmanager" target="_blank" rel="noopener noreferrer" style={{ color: '#1877F2' }}>Facebook Ads Manager</a>.</li>
                      <li>Your Ad Account ID is in the URL or Account Settings (a number like <span style={{ fontFamily: 'monospace' }}>1234567890</span>).</li>
                      <li>Enter it without the "act_" prefix.</li>
                    </ol>
                    <div style={{ padding: '10px 14px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: '8px', fontSize: '0.78rem', color: '#854d0e' }}>
                      <strong>App Review:</strong> To create ads on behalf of other users, your Meta app needs to pass App Review for the <code>ads_management</code> permission. For personal use with your own access token, you can start immediately. Visit <a href="https://developers.facebook.com/docs/app-review" target="_blank" rel="noopener noreferrer" style={{ color: '#854d0e' }}>developers.facebook.com/docs/app-review</a> for details.
                    </div>
                  </div>
                </details>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Helper components ──────────────────────────────────────

const tabBtnStyle: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: '8px',
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-card)',
  color: 'var(--text-main)',
  fontSize: '0.82rem',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  transition: 'all 0.15s',
};

const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  fontWeight: 700,
  fontSize: '0.76rem',
  color: 'var(--text-main)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 14px',
  fontSize: '0.82rem',
  color: 'var(--text-main)',
  fontWeight: 500,
};

const iconBtnStyle: React.CSSProperties = {
  width: '34px',
  height: '34px',
  borderRadius: '8px',
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-card)',
  color: 'var(--text-main)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s',
  flexShrink: 0,
};

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', padding: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
          {icon}
        </div>
        <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-dark)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>{value}</div>
    </div>
  );
}

function ActionCard({ icon, title, desc, onClick, loading, color }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void; loading?: boolean; color: string }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        textAlign: 'left',
        padding: '18px',
        borderRadius: '12px',
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-card)',
        cursor: loading ? 'wait' : 'pointer',
        transition: 'all 0.15s',
        opacity: loading ? 0.7 : 1,
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
      }}
    >
      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
        {loading ? <Loader2 size={20} className="crm-spin" /> : icon}
      </div>
      <div>
        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>{title}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-dark)', lineHeight: 1.4 }}>{desc}</div>
      </div>
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string; label: string }> = {
    ACTIVE: { bg: 'rgba(22,163,74,0.1)', text: '#16a34a', label: 'Active' },
    PAUSED: { bg: 'rgba(234,179,8,0.1)', text: '#eab308', label: 'Paused' },
    DRAFT: { bg: 'rgba(100,116,139,0.1)', text: '#64748b', label: 'Draft' },
    DELETED: { bg: 'rgba(239,68,68,0.1)', text: '#dc2626', label: 'Deleted' },
    UNKNOWN: { bg: 'rgba(100,116,139,0.1)', text: '#64748b', label: 'Unknown' },
  };
  const c = colors[status] || colors.UNKNOWN;
  return (
    <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '3px 8px', borderRadius: '999px', background: c.bg, color: c.text, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
      {c.label}
    </span>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.68rem', color: 'var(--text-dark)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)' }}>{value}</div>
    </div>
  );
}
