import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  TrendingUp, Plus, RefreshCw, Play, Pause, Trash2, Eye,
  CheckCircle2, AlertCircle, Loader2, Globe, Target, DollarSign,
  BarChart3, Settings as SettingsIcon, Zap, ExternalLink, ChevronDown,
  Facebook, LogOut, Link2, MessageCircle, Upload, Users, FileText, Calendar,
} from 'lucide-react';
import MetaAdsWorkspaceFeatures from '@/components/MetaAdsWorkspaceFeatures';
import MetaAdsPerformance from '@/components/MetaAdsPerformance';
import MetaAdsAudiences from '@/components/MetaAdsAudiences';
import MetaAdsLeadForms from '@/components/MetaAdsLeadForms';
import MetaAdsAttribution from '@/components/MetaAdsAttribution';

interface MetaAdsManagerProps {
  session: { user: { id: string; email?: string } };
}

interface AdsSettings {
  id?: string;
  app_id: string | null;
  access_token: string | null;
  ad_account_id: string | null;
  is_connected: boolean;
  fb_user_id: string | null;
  fb_user_name: string | null;
  token_expires_at: string | null;
  connected_via: string;
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
  is_click_to_whatsapp?: boolean;
  whatsapp_greeting?: string | null;
}

interface AdsSettings {
  id?: string;
  app_id: string | null;
  access_token: string | null;
  ad_account_id: string | null;
  is_connected: boolean;
  fb_user_id: string | null;
  fb_user_name: string | null;
  token_expires_at: string | null;
  connected_via: string;
  page_id?: string | null;
  page_name?: string | null;
  whatsapp_phone_number?: string | null;
}

type View = 'overview' | 'settings' | 'campaigns' | 'create' | 'workspace' | 'c2w' | 'performance' | 'audiences' | 'leadforms' | 'attribution' | 'schedule';

const OBJECTIVES = [
  { value: 'OUTCOME_TRAFFIC', label: 'Traffic — Send people to a website' },
  { value: 'OUTCOME_LEADS', label: 'Leads — Collect leads via forms' },
  { value: 'OUTCOME_ENGAGEMENT', label: 'Engagement — Get more messages and engagement' },
  { value: 'OUTCOME_AWARENESS', label: 'Awareness — Maximize ad reach' },
  { value: 'OUTCOME_SALES', label: 'Sales — Drive online sales' },
  { value: 'OUTCOME_APP_PROMOTION', label: 'App Promotion — Get app installs' },
];

const GRAPH_VERSION = 'v21.0';

export default function MetaAdsManager({ session }: MetaAdsManagerProps) {
  const [view, setView] = useState<View>('overview');
  const [settings, setSettings] = useState<AdsSettings | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [adAccounts, setAdAccounts] = useState<Array<{ id: string; name: string; currency: string; account_status: number }>>([]);
  const [verifyResult, setVerifyResult] = useState<{ name: string; currency: string; amount_spent: string; balance: string } | null>(null);
  const [platformAppId, setPlatformAppId] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState('');

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

  // Click-to-WhatsApp state
  const [fbPages, setFbPages] = useState<Array<{ id: string; name: string }>>([]);
  const [c2wName, setC2wName] = useState('');
  const [c2wObjective, setC2wObjective] = useState('OUTCOME_ENGAGEMENT');
  const [c2wDailyBudget, setC2wDailyBudget] = useState('');
  const [c2wCurrency, setC2wCurrency] = useState('USD');
  const [c2wPageId, setC2wPageId] = useState('');
  const [c2wWaNumber, setC2wWaNumber] = useState('');
  const [c2wGreeting, setC2wGreeting] = useState('');
  const [c2wHeadline, setC2wHeadline] = useState('');
  const [c2wPrimaryText, setC2wPrimaryText] = useState('');
  const [c2wDescription, setC2wDescription] = useState('');
  const [c2wImageUrl, setC2wImageUrl] = useState('');
  const [c2wCountries, setC2wCountries] = useState('US');
  const [c2wAgeMin, setC2wAgeMin] = useState('18');
  const [c2wAgeMax, setC2wAgeMax] = useState('65');
  const [c2wAdName, setC2wAdName] = useState('');
  const [c2wImageHash, setC2wImageHash] = useState('');
  const [c2wUploading, setC2wUploading] = useState(false);

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
      }

      const { data: campData } = await supabase
        .from('meta_ad_campaigns')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (campData) setCampaigns(campData as Campaign[]);

      // Fetch platform app ID for OAuth
      try {
        const result = await callApi('get_oauth_config');
        setPlatformAppId(result.app_id);
      } catch {
        setPlatformAppId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    }
    setLoading(false);
  }, [session.user.id, callApi]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── OAuth: Connect with Facebook ─────────────────────────
  const handleConnectFacebook = async () => {
    setOauthError('');
    setOauthLoading(true);

    try {
      if (!platformAppId) {
        throw new Error('Meta Marketing API is not configured. Please contact your platform administrator.');
      }

      const redirectUri = `${window.location.origin}${window.location.pathname}`;
      const scope = 'ads_management,ads_read,business_management';
      const state = `meta_ads_${session.user.id}_${Date.now()}`;
      const authUrl = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?client_id=${platformAppId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}&response_type=code`;

      const popup = window.open(authUrl, 'facebook_oauth', 'width=600,height=700,scrollbars=yes');

      if (!popup) {
        throw new Error('Popup was blocked. Please allow popups for this site and try again.');
      }

      // Poll for popup closure or redirect
      const pollInterval = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollInterval);
          setOauthLoading(false);
        }
      }, 500);

      // Listen for the OAuth redirect (code in URL params)
      const handleOAuthMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        if (event.data?.type === 'meta_ads_oauth' && event.data?.code) {
          clearInterval(pollInterval);
          window.removeEventListener('message', handleOAuthMessage);
          popup.close();

          try {
            const result = await callApi('exchange_code', { code: event.data.code });
            setSuccess(`Connected as ${result.user_name}. Select an ad account to start managing campaigns.`);
            setAdAccounts(result.ad_accounts || []);
            await loadData();
            setTimeout(() => setSuccess(''), 5000);
          } catch (err) {
            setOauthError(err instanceof Error ? err.message : 'Failed to connect Facebook account');
          }
          setOauthLoading(false);
        }
      };
      window.addEventListener('message', handleOAuthMessage);

      // Also check URL params if redirect happens in same window
      const urlCheckInterval = setInterval(() => {
        try {
          const popupUrl = popup.location;
          const urlParams = new URLSearchParams(popupUrl.search);
          const code = urlParams.get('code');
          if (code) {
            clearInterval(urlCheckInterval);
            clearInterval(pollInterval);
            popup.close();
            window.removeEventListener('message', handleOAuthMessage);

            callApi('exchange_code', { code })
              .then((result) => {
                setSuccess(`Connected as ${result.user_name}. Select an ad account to start managing campaigns.`);
                setAdAccounts(result.ad_accounts || []);
                loadData();
                setTimeout(() => setSuccess(''), 5000);
              })
              .catch((err) => {
                setOauthError(err instanceof Error ? err.message : 'Failed to connect Facebook account');
              })
              .finally(() => setOauthLoading(false));
          }
        } catch {
          // Cross-origin — popup is still on Facebook domain, keep waiting
        }
      }, 500);
    } catch (err) {
      setOauthError(err instanceof Error ? err.message : 'Failed to start OAuth flow');
      setOauthLoading(false);
    }
  };

  // Check URL for OAuth callback on mount (in case redirect happened in same tab)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (code && state?.startsWith('meta_ads_')) {
      // Clean the URL
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);

      setOauthLoading(true);
      callApi('exchange_code', { code })
        .then((result) => {
          setSuccess(`Connected as ${result.user_name}. Select an ad account to start managing campaigns.`);
          setAdAccounts(result.ad_accounts || []);
          loadData();
          setTimeout(() => setSuccess(''), 5000);
        })
        .catch((err) => {
          setOauthError(err instanceof Error ? err.message : 'Failed to connect Facebook account');
        })
        .finally(() => setOauthLoading(false));
    }
  }, [callApi, loadData]);

  const handleDisconnect = async () => {
    if (!confirm('Disconnect your Facebook account? You will need to reconnect to manage ads.')) return;
    setActionLoading(true);
    setError('');
    try {
      await callApi('disconnect');
      setSettings(null);
      setAdAccounts([]);
      setVerifyResult(null);
      setSuccess('Facebook account disconnected.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
    setActionLoading(false);
  };

  const handleSaveAdAccount = async (accountId: string) => {
    setActionLoading(true);
    setError('');
    try {
      await callApi('save_ad_account', { ad_account_id: accountId });
      setSuccess('Ad account selected. You can now create and manage campaigns.');
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save ad account');
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

  // ─── Click-to-WhatsApp handlers ───────────────────────────
  const handleFetchPages = async () => {
    setActionLoading(true);
    setError('');
    try {
      const result = await callApi('get_pages');
      setFbPages(result.pages || []);
      if (settings?.page_id && !result.pages?.some((p: { id: string }) => p.id === settings.page_id)) {
        // keep existing page_id even if not in fresh list
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch Facebook Pages');
    }
    setActionLoading(false);
  };

  const handleSavePage = async () => {
    if (!c2wPageId) { setError('Select a Facebook Page first'); return; }
    setActionLoading(true);
    setError('');
    try {
      const page = fbPages.find(p => p.id === c2wPageId);
      await callApi('save_page', {
        page_id: c2wPageId,
        page_name: page?.name || null,
        whatsapp_phone_number: c2wWaNumber || null,
      });
      setSuccess('Facebook Page and WhatsApp number saved for click-to-WhatsApp ads.');
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save Page settings');
    }
    setActionLoading(false);
  };

  const handleUploadImage = async () => {
    if (!c2wImageUrl.trim()) { setError('Enter an image URL first'); return; }
    setC2wUploading(true);
    setError('');
    try {
      const result = await callApi('upload_ad_image', { image_url: c2wImageUrl.trim() });
      setC2wImageHash(result.hash || '');
      setSuccess('Image uploaded to Meta. You can now create the ad.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    }
    setC2wUploading(false);
  };

  const handleCreateC2WAd = async () => {
    if (!c2wName.trim()) { setError('Campaign name is required'); return; }
    if (!c2wPageId && !settings?.page_id) { setError('Select a Facebook Page first'); return; }
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      const result = await callApi('create_c2w_ad', {
        campaign_name: c2wName.trim(),
        objective: c2wObjective,
        daily_budget: c2wDailyBudget || null,
        currency: c2wCurrency,
        page_id: c2wPageId || settings?.page_id,
        whatsapp_phone_number: c2wWaNumber || settings?.whatsapp_phone_number || null,
        whatsapp_greeting: c2wGreeting || null,
        ad_name: c2wAdName || null,
        headline: c2wHeadline || null,
        primary_text: c2wPrimaryText || null,
        description: c2wDescription || null,
        image_hash: c2wImageHash || null,
        image_url: c2wImageUrl || null,
        countries: c2wCountries.split(',').map(s => s.trim()).filter(Boolean),
        age_min: Number(c2wAgeMin),
        age_max: Number(c2wAgeMax),
      });
      setSuccess(`Click-to-WhatsApp ad created (Campaign ID: ${result.campaign_id}). It starts paused — review it in Facebook Ads Manager before activating.`);
      setC2wName(''); setC2wHeadline(''); setC2wPrimaryText(''); setC2wDescription('');
      setC2wImageUrl(''); setC2wImageHash(''); setC2wGreeting(''); setC2wAdName('');
      await loadData();
      setView('campaigns');
      setTimeout(() => setSuccess(''), 6000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create click-to-WhatsApp ad');
    }
    setActionLoading(false);
  };

  const isConnected = settings?.is_connected;
  const hasAdAccount = !!settings?.ad_account_id;

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
          <div style={{ width: '76px', height: '44px', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 8px', overflow: 'hidden' }}>
            <img
              src="/assets/images/meta-logo.webp"
              alt="Meta"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
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
            <SettingsIcon size={16} /> Connection
          </button>
          <button onClick={() => setView('c2w')} style={{ ...tabBtnStyle, background: view === 'c2w' ? '#1877F2' : 'var(--bg-card)', color: view === 'c2w' ? '#fff' : 'var(--text-main)' }}>
            <MessageCircle size={16} /> WhatsApp Ads
          </button>
          <button onClick={() => setView('workspace')} style={{ ...tabBtnStyle, background: view === 'workspace' ? '#1877F2' : 'var(--bg-card)', color: view === 'workspace' ? '#fff' : 'var(--text-main)' }}>
            <Zap size={16} /> Workspace
          </button>
          <button onClick={() => setView('performance')} style={{ ...tabBtnStyle, background: view === 'performance' ? '#1877F2' : 'var(--bg-card)', color: view === 'performance' ? '#fff' : 'var(--text-main)' }}>
            <BarChart3 size={16} /> Performance
          </button>
          <button onClick={() => setView('audiences')} style={{ ...tabBtnStyle, background: view === 'audiences' ? '#1877F2' : 'var(--bg-card)', color: view === 'audiences' ? '#fff' : 'var(--text-main)' }}>
            <Users size={16} /> Audiences
          </button>
          <button onClick={() => setView('leadforms')} style={{ ...tabBtnStyle, background: view === 'leadforms' ? '#1877F2' : 'var(--bg-card)', color: view === 'leadforms' ? '#fff' : 'var(--text-main)' }}>
            <FileText size={16} /> Lead Forms
          </button>
          <button onClick={() => setView('attribution')} style={{ ...tabBtnStyle, background: view === 'attribution' ? '#1877F2' : 'var(--bg-card)', color: view === 'attribution' ? '#fff' : 'var(--text-main)' }}>
            <TrendingUp size={16} /> Attribution
          </button>
          <button onClick={() => setView('schedule')} style={{ ...tabBtnStyle, background: view === 'schedule' ? '#1877F2' : 'var(--bg-card)', color: view === 'schedule' ? '#fff' : 'var(--text-main)' }}>
            <Calendar size={16} /> Schedule
          </button>
        </div>
      </div>

      {/* Status banner */}
      {(!isConnected || !hasAdAccount) && view !== 'settings' && (
        <div style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={20} style={{ color: '#eab308', flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: '0.85rem', color: '#854d0e' }}>
            <strong>{!isConnected ? 'Facebook account not connected.' : 'No ad account selected.'}</strong> {!isConnected ? 'Click "Connect with Facebook" to link your ad account.' : 'Go to Connection settings to select your ad account.'}
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
          {/* ─── WORKSPACE VIEW ─── */}
          {view === 'workspace' && (
            <MetaAdsWorkspaceFeatures
              session={session}
              campaigns={campaigns.map(campaign => ({ id: campaign.id, name: campaign.name }))}
            />
          )}

          {/* ─── PERFORMANCE VIEW ─── */}
          {view === 'performance' && (
            <MetaAdsPerformance callApi={callApi} />
          )}

          {/* ─── AUDIENCES VIEW ─── */}
          {view === 'audiences' && (
            <MetaAdsAudiences session={session} callApi={callApi} />
          )}

          {/* ─── LEAD FORMS VIEW ─── */}
          {view === 'leadforms' && (
            <MetaAdsLeadForms session={session} callApi={callApi} />
          )}

          {/* ─── ATTRIBUTION VIEW ─── */}
          {view === 'attribution' && (
            <MetaAdsAttribution session={session} callApi={callApi} />
          )}

          {/* ─── AD SCHEDULE VIEW ─── */}
          {view === 'schedule' && (
            <MetaAdsScheduleView callApi={callApi} campaigns={campaigns} />
          )}

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
                  icon={<MessageCircle size={20} />}
                  title="Click-to-WhatsApp Ad"
                  desc="Create an ad that opens a WhatsApp chat with your business"
                  onClick={() => setView('c2w')}
                  color="#25D366"
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
                  onClick={() => { setView('performance'); }}
                  color="#8B5CF6"
                />
                <ActionCard
                  icon={<Users size={20} />}
                  title="Custom Audiences"
                  desc="Push CRM leads to Facebook for retargeting"
                  onClick={() => setView('audiences')}
                  color="#0d9488"
                />
                <ActionCard
                  icon={<FileText size={20} />}
                  title="Lead Form Ads"
                  desc="Collect leads natively on Facebook & Instagram"
                  onClick={() => setView('leadforms')}
                  color="#F59E0B"
                />
                <ActionCard
                  icon={<TrendingUp size={20} />}
                  title="Lead Attribution"
                  desc="Track which ads generate paying customers"
                  onClick={() => setView('attribution')}
                  color="#16A34A"
                />
                <ActionCard
                  icon={<Calendar size={20} />}
                  title="Ad Scheduling"
                  desc="Schedule ads to run only during peak hours"
                  onClick={() => setView('schedule')}
                  color="#6366f1"
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
                    Create and manage Facebook &amp; Instagram ad campaigns without leaving your CRM. Click "Connect with Facebook" to link your ad account — no API keys needed. Track spend, impressions, clicks, and cost-per-lead across all your campaigns. Campaigns are created in a <strong>paused</strong> state — review them in Facebook Ads Manager before activating to go live.
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
                              {camp.is_click_to_whatsapp && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px', borderRadius: '999px', background: 'rgba(37,211,102,0.1)', color: '#25D366' }}>
                                  <MessageCircle size={10} /> WhatsApp
                                </span>
                              )}
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

          {/* ─── CLICK-TO-WHATSAPP AD VIEW ─── */}
          {view === 'c2w' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Info banner */}
              <div style={{ background: 'rgba(37,211,102,0.06)', border: '1px solid rgba(37,211,102,0.2)', borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <MessageCircle size={20} style={{ color: '#25D366', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  <strong style={{ color: '#25D366' }}>Click-to-WhatsApp Ads</strong><br />
                  Create Facebook &amp; Instagram ads that open a WhatsApp chat with your business when tapped. The full flow — campaign, ad set, creative, and ad — is created in one step and starts paused for your review.
                </div>
              </div>

              {/* Step 1: Facebook Page setup */}
              <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', padding: '24px' }}>
                <h3 style={{ margin: '0 0 6px', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>1. Facebook Page &amp; WhatsApp Number</h3>
                <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Select the Facebook Page linked to your WhatsApp Business number.</p>

                {settings?.page_id && (
                  <div style={{ padding: '10px 14px', background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: '8px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={16} style={{ color: '#16a34a' }} />
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>Current Page: <strong>{settings.page_name || settings.page_id}</strong>{settings.whatsapp_phone_number && ` · WhatsApp: ${settings.whatsapp_phone_number}`}</span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                  <button onClick={handleFetchPages} disabled={actionLoading} style={{ ...tabBtnStyle }}>
                    {actionLoading ? <Loader2 size={15} className="crm-spin" /> : <RefreshCw size={15} />} Load Pages
                  </button>
                </div>

                {fbPages.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                    <div>
                      <label style={labelStyle}>Facebook Page</label>
                      <select value={c2wPageId} onChange={(e) => setC2wPageId(e.target.value)} style={inputStyle}>
                        <option value="">Select a Page...</option>
                        {fbPages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>WhatsApp Number (with country code)</label>
                      <input type="text" value={c2wWaNumber} onChange={(e) => setC2wWaNumber(e.target.value)} placeholder="e.g. 919876543210" style={inputStyle} />
                    </div>
                  </div>
                )}

                {fbPages.length > 0 && (
                  <button onClick={handleSavePage} disabled={actionLoading || !c2wPageId} style={{ ...tabBtnStyle, background: '#1877F2', color: '#fff', border: 'none' }}>
                    {actionLoading ? <Loader2 size={15} className="crm-spin" /> : <CheckCircle2 size={15} />} Save Page Settings
                  </button>
                )}

                {fbPages.length === 0 && !actionLoading && (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-dark)', fontSize: '0.82rem', background: 'var(--bg-light)', borderRadius: '8px' }}>
                    Click "Load Pages" to fetch your Facebook Pages.
                  </div>
                )}
              </div>

              {/* Step 2: Campaign details */}
              <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', padding: '24px' }}>
                <h3 style={{ margin: '0 0 6px', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>2. Campaign Details</h3>
                <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Set the campaign name, objective, and budget.</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Campaign Name <em style={{ color: '#dc2626' }}>*</em></label>
                    <input type="text" value={c2wName} onChange={(e) => setC2wName(e.target.value)} placeholder="e.g. WhatsApp Lead Campaign — Q4" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Objective</label>
                    <select value={c2wObjective} onChange={(e) => setC2wObjective(e.target.value)} style={inputStyle}>
                      <option value="OUTCOME_ENGAGEMENT">Engagement — Get WhatsApp messages</option>
                      <option value="OUTCOME_LEADS">Leads — Collect leads via WhatsApp</option>
                      <option value="OUTCOME_TRAFFIC">Traffic — Send people to WhatsApp</option>
                      <option value="OUTCOME_SALES">Sales — Drive sales via WhatsApp</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Currency</label>
                    <select value={c2wCurrency} onChange={(e) => setC2wCurrency(e.target.value)} style={inputStyle}>
                      <option value="USD">USD</option><option value="INR">INR</option><option value="EUR">EUR</option>
                      <option value="GBP">GBP</option><option value="AED">AED</option><option value="SGD">SGD</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Daily Budget</label>
                    <input type="number" min="1" step="0.01" value={c2wDailyBudget} onChange={(e) => setC2wDailyBudget(e.target.value)} placeholder="e.g. 50.00" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Target Countries</label>
                    <input type="text" value={c2wCountries} onChange={(e) => setC2wCountries(e.target.value)} placeholder="US, IN, AE" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Age Min</label>
                    <input type="number" min="13" max="65" value={c2wAgeMin} onChange={(e) => setC2wAgeMin(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Age Max</label>
                    <input type="number" min="13" max="65" value={c2wAgeMax} onChange={(e) => setC2wAgeMax(e.target.value)} style={inputStyle} />
                  </div>
                </div>
              </div>

              {/* Step 3: Ad creative */}
              <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', padding: '24px' }}>
                <h3 style={{ margin: '0 0 6px', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>3. Ad Creative</h3>
                <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Write the ad copy and upload an image. The call-to-action is automatically set to "Send WhatsApp Message".</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Ad Name (optional)</label>
                    <input type="text" value={c2wAdName} onChange={(e) => setC2wAdName(e.target.value)} placeholder="e.g. WhatsApp Ad — Version A" style={inputStyle} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Headline</label>
                    <input type="text" value={c2wHeadline} onChange={(e) => setC2wHeadline(e.target.value)} placeholder="e.g. Start your trading journey today" style={inputStyle} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Primary Text</label>
                    <textarea value={c2wPrimaryText} onChange={(e) => setC2wPrimaryText(e.target.value)} rows={3} placeholder="Write the main ad copy that appears above the image..." style={{ ...inputStyle, resize: 'vertical' }} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Description (optional)</label>
                    <input type="text" value={c2wDescription} onChange={(e) => setC2wDescription(e.target.value)} placeholder="Short description under the headline" style={inputStyle} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Image URL</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input type="text" value={c2wImageUrl} onChange={(e) => { setC2wImageUrl(e.target.value); setC2wImageHash(''); }} placeholder="https://example.com/ad-image.jpg" style={inputStyle} />
                      <button onClick={handleUploadImage} disabled={c2wUploading || !c2wImageUrl.trim()} style={{ ...tabBtnStyle, flexShrink: 0, whiteSpace: 'nowrap' }}>
                        {c2wUploading ? <Loader2 size={15} className="crm-spin" /> : <Upload size={15} />} Upload
                      </button>
                    </div>
                    {c2wImageHash && (
                      <small style={{ fontSize: '0.74rem', color: '#16a34a', marginTop: '4px', display: 'block' }}>
                        <CheckCircle2 size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Image uploaded — hash: {c2wImageHash.substring(0, 16)}...
                      </small>
                    )}
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>WhatsApp Greeting Message (optional)</label>
                    <textarea value={c2wGreeting} onChange={(e) => setC2wGreeting(e.target.value)} rows={2} placeholder="Hi! Thanks for your interest. How can we help you today?" style={{ ...inputStyle, resize: 'vertical' }} />
                    <small style={{ fontSize: '0.74rem', color: 'var(--text-dark)', marginTop: '4px', display: 'block' }}>This message is shown automatically when someone opens the WhatsApp chat from your ad.</small>
                  </div>
                </div>
              </div>

              {/* Create button */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleCreateC2WAd}
                  disabled={!c2wName.trim() || actionLoading || (!c2wPageId && !settings?.page_id)}
                  style={{
                    padding: '12px 24px', borderRadius: '10px', border: 'none',
                    background: c2wName.trim() && !actionLoading && (c2wPageId || settings?.page_id) ? '#25D366' : '#cbd5e1',
                    color: '#fff', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    boxShadow: c2wName.trim() && !actionLoading ? '0 4px 12px rgba(37,211,102,0.3)' : 'none',
                  }}
                >
                  {actionLoading ? <Loader2 size={18} className="crm-spin" /> : <MessageCircle size={18} />}
                  Create Click-to-WhatsApp Ad
                </button>
                <button onClick={() => setView('campaigns')} style={{ padding: '12px 24px', borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
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

          {/* ─── CONNECTION / SETTINGS VIEW ─── */}
          {view === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Not connected state */}
              {!isConnected ? (
                <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', padding: '40px 24px', textAlign: 'center' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, #1877F2, #0d5fc3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <Facebook size={32} style={{ color: '#fff' }} />
                  </div>
                  <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>Connect Your Facebook Account</h3>
                  <p style={{ margin: '0 0 24px', fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
                    Link your Facebook ad account with one click. No API keys or developer tools needed — just click the button below and log in to Facebook to grant permission.
                  </p>

                  {oauthError && (
                    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '10px 16px', color: '#dc2626', fontSize: '0.82rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                      <AlertCircle size={16} /> {oauthError}
                    </div>
                  )}

                  <button
                    onClick={handleConnectFacebook}
                    disabled={oauthLoading || !platformAppId}
                    style={{
                      padding: '14px 32px', borderRadius: '10px', border: 'none',
                      background: oauthLoading || !platformAppId ? '#94a3b8' : '#1877F2',
                      color: '#fff', fontSize: '0.95rem', fontWeight: 700, cursor: oauthLoading || !platformAppId ? 'not-allowed' : 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: '10px',
                      transition: 'all 0.15s', boxShadow: oauthLoading ? 'none' : '0 4px 12px rgba(24,119,242,0.3)',
                    }}
                  >
                    {oauthLoading ? <Loader2 size={20} className="crm-spin" /> : <Facebook size={20} />}
                    {oauthLoading ? 'Connecting...' : 'Connect with Facebook'}
                  </button>

                  {!platformAppId && (
                    <p style={{ margin: '16px 0 0', fontSize: '0.78rem', color: '#854d0e' }}>
                      <AlertCircle size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Meta Marketing API is not configured yet. Please contact your platform administrator.
                    </p>
                  )}

                  {/* OAuth flow explanation */}
                  <div style={{ marginTop: '32px', padding: '16px', background: 'var(--bg-light)', borderRadius: '10px', textAlign: 'left' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                      <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>How it works:</strong>
                      1. Click "Connect with Facebook" above<br />
                      2. A Facebook login popup will appear<br />
                      3. Log in and grant permission to manage your ads<br />
                      4. Select which ad account you want to use<br />
                      5. Start creating and managing campaigns from your CRM
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Connected state */}
                  <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #1877F2, #0d5fc3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Facebook size={24} style={{ color: '#fff' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
                            {settings?.fb_user_name || 'Facebook Account'}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <CheckCircle2 size={14} style={{ color: '#16a34a' }} />
                            <span style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 600 }}>Connected via Facebook Login</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={handleDisconnect}
                        disabled={actionLoading}
                        style={{
                          padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)',
                          background: 'rgba(239,68,68,0.08)', color: '#dc2626',
                          fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                        }}
                      >
                        {actionLoading ? <Loader2 size={14} className="crm-spin" /> : <LogOut size={14} />} Disconnect
                      </button>
                    </div>

                    {settings?.token_expires_at && (
                      <div style={{ marginTop: '12px', padding: '10px 14px', background: 'var(--bg-light)', borderRadius: '8px', fontSize: '0.76rem', color: 'var(--text-dark)' }}>
                        <Clock size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                        Token expires: {new Date(settings.token_expires_at).toLocaleDateString()} at {new Date(settings.token_expires_at).toLocaleTimeString()}
                      </div>
                    )}
                  </div>

                  {/* Ad account selection */}
                  <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', padding: '24px' }}>
                    <h3 style={{ margin: '0 0 6px', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>Ad Account</h3>
                    <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Select which Facebook ad account you want to manage campaigns from.</p>

                    {hasAdAccount && (
                      <div style={{ padding: '12px 16px', background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: '10px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <CheckCircle2 size={18} style={{ color: '#16a34a' }} />
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Active Ad Account: {settings?.ad_account_id}</div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-dark)' }}>Click "Verify" to check the connection or select a different account below.</div>
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                      <button onClick={handleFetchAdAccounts} disabled={actionLoading} style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {actionLoading ? <Loader2 size={16} className="crm-spin" /> : <RefreshCw size={16} />} Load Ad Accounts
                      </button>
                      <button onClick={handleVerify} disabled={actionLoading} style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {actionLoading ? <Loader2 size={16} className="crm-spin" /> : <Globe size={16} />} Verify Connection
                      </button>
                    </div>

                    {verifyResult && (
                      <div style={{ marginBottom: '16px', padding: '14px 16px', background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: '10px' }}>
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
                      <div>
                        <h4 style={{ margin: '0 0 8px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>Your Ad Accounts</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {adAccounts.map(acct => {
                            const cleanId = acct.id.replace(/^act_/, '');
                            const isSelected = settings?.ad_account_id === cleanId;
                            return (
                              <button
                                key={acct.id}
                                onClick={() => handleSaveAdAccount(cleanId)}
                                disabled={actionLoading}
                                style={{
                                  padding: '12px 16px', borderRadius: '8px',
                                  border: isSelected ? '2px solid #1877F2' : '1px solid var(--border-subtle)',
                                  background: isSelected ? 'rgba(24,119,242,0.08)' : 'var(--bg-light)',
                                  cursor: 'pointer', textAlign: 'left',
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  {isSelected && <CheckCircle2 size={16} style={{ color: '#1877F2' }} />}
                                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>{acct.name}</span>
                                </div>
                                <span style={{ fontSize: '0.76rem', color: 'var(--text-dark)' }}>{cleanId} &middot; {acct.currency}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {adAccounts.length === 0 && !actionLoading && (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dark)', fontSize: '0.82rem', background: 'var(--bg-light)', borderRadius: '8px' }}>
                        <Link2 size={24} style={{ color: 'var(--text-dark)', margin: '0 auto 8px' }} />
                        Click "Load Ad Accounts" to fetch your available ad accounts from Facebook.
                      </div>
                    )}
                  </div>
                </>
              )}
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

function Clock({ size, style }: { size: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
