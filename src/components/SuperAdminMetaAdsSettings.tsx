import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  TrendingUp, CheckCircle2, AlertCircle, Loader2, Save,
  Facebook, ExternalLink, ShieldCheck, Eye, EyeOff,
  BookOpen, ChevronDown, Info, HelpCircle,
} from 'lucide-react';

const linkStyle: React.CSSProperties = {
  color: '#1877F2',
  textDecoration: 'none',
};

const codeStyle: React.CSSProperties = {
  background: 'var(--bg-light)',
  padding: '2px 6px',
  borderRadius: '4px',
  fontSize: '0.78rem',
  fontFamily: 'monospace',
};

const stepSummaryStyle: React.CSSProperties = {
  padding: '14px 24px',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: '0.88rem',
  color: 'var(--text-main)',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  listStyle: 'none',
  userSelect: 'none',
  transition: 'background 0.15s',
};

const stepBadgeStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '24px',
  height: '24px',
  borderRadius: '6px',
  background: 'rgba(15,118,110,0.1)',
  color: '#0f766e',
  fontSize: '0.76rem',
  fontWeight: 800,
  flexShrink: 0,
};

const stepContentStyle: React.CSSProperties = {
  padding: '0 24px 20px 24px',
  fontSize: '0.84rem',
  color: 'var(--text-muted)',
  lineHeight: 1.8,
};

const stepTextStyle: React.CSSProperties = {
  margin: '0 0 12px',
  fontSize: '0.84rem',
  color: 'var(--text-muted)',
  lineHeight: 1.8,
};

const stepListStyle: React.CSSProperties = {
  margin: '0 0 12px',
  paddingLeft: '24px',
  fontSize: '0.84rem',
  color: 'var(--text-muted)',
  lineHeight: 1.8,
};

const calloutWarningStyle: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
  padding: '12px 16px',
  background: 'rgba(234,179,8,0.08)',
  border: '1px solid rgba(234,179,8,0.2)',
  borderRadius: '10px',
  fontSize: '0.8rem',
  color: '#854d0e',
  marginTop: '12px',
  lineHeight: 1.6,
};

const calloutInfoStyle: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
  padding: '12px 16px',
  background: 'rgba(24,119,242,0.06)',
  border: '1px solid rgba(24,119,242,0.2)',
  borderRadius: '10px',
  fontSize: '0.8rem',
  color: '#1d4ed8',
  marginTop: '12px',
  lineHeight: 1.6,
};

const calloutSuccessStyle: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
  padding: '12px 16px',
  background: 'rgba(22,163,74,0.08)',
  border: '1px solid rgba(22,163,74,0.2)',
  borderRadius: '10px',
  fontSize: '0.8rem',
  color: '#16a34a',
  marginTop: '12px',
  lineHeight: 1.6,
};

export default function SuperAdminMetaAdsSettings() {
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: queryError } = await supabase
        .from('platform_meta_ads_config')
        .select('*')
        .maybeSingle();

      if (queryError) throw queryError;

      if (data) {
        setConfigId(data.id);
        setAppId(data.meta_app_id || '');
        setAppSecret(data.app_secret || '');
        setIsEnabled(data.is_enabled);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    if (!appId.trim()) {
      setError('Meta App ID is required');
      setSaving(false);
      return;
    }
    if (!appSecret.trim()) {
      setError('App Secret is required');
      setSaving(false);
      return;
    }

    try {
      const payload = {
        meta_app_id: appId.trim(),
        app_secret: appSecret.trim(),
        is_enabled: isEnabled,
        updated_at: new Date().toISOString(),
      };

      if (configId) {
        const { error: updateError } = await supabase
          .from('platform_meta_ads_config')
          .update(payload)
          .eq('id', configId);
        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from('platform_meta_ads_config')
          .insert(payload)
          .select()
          .single();
        if (insertError) throw insertError;
        if (data) setConfigId(data.id);
      }

      setSuccess('Meta Marketing API configuration saved successfully.');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    }
    setSaving(false);
  };

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

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
        <Loader2 size={28} className="crm-spin" style={{ color: '#0f766e' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, #1877F2, #0d5fc3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <TrendingUp size={24} style={{ color: '#fff' }} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>Meta Marketing API</h2>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Configure platform-level Facebook app for the Ads Manager OAuth flow</p>
        </div>
      </div>

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

      {/* Configuration card */}
      <div style={{ background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border-subtle)', padding: '24px' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>Facebook App Credentials</h3>
        <p style={{ margin: '0 0 20px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          These credentials are used by all customer accounts when they click "Connect with Facebook" in the Ads Manager. Customers never see the App Secret — only the App ID is shared with their browser to initiate the OAuth popup.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Meta App ID <em style={{ color: '#dc2626' }}>*</em></label>
            <input
              type="text"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              placeholder="1234567890123456"
              style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.82rem' }}
            />
            <small style={{ fontSize: '0.74rem', color: 'var(--text-dark)', marginTop: '4px', display: 'block' }}>
              Found in your Meta App Dashboard under Settings &rarr; Basic.
            </small>
          </div>
          <div>
            <label style={labelStyle}>App Secret <em style={{ color: '#dc2626' }}>*</em></label>
            <div style={{ position: 'relative' }}>
              <input
                type={showSecret ? 'text' : 'password'}
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                placeholder="••••••••••••••••••••••••"
                style={{ ...inputStyle, paddingRight: '38px', fontFamily: 'monospace', fontSize: '0.82rem' }}
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dark)', padding: '4px' }}
              >
                {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <small style={{ fontSize: '0.74rem', color: 'var(--text-dark)', marginTop: '4px', display: 'block' }}>
              Click "Show" in your Meta App Dashboard to reveal the secret.
            </small>
          </div>
        </div>

        {/* Enable toggle */}
        <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: 'var(--bg-light)', borderRadius: '10px' }}>
          <button
            type="button"
            onClick={() => setIsEnabled(!isEnabled)}
            style={{
              width: '44px', height: '24px', borderRadius: '999px', border: 'none',
              background: isEnabled ? '#16a34a' : '#cbd5e1',
              cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0,
            }}
          >
            <div style={{
              position: 'absolute', top: '2px', left: isEnabled ? '22px' : '2px',
              width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
              transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </button>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
              {isEnabled ? 'Enabled' : 'Disabled'}
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-dark)' }}>
              When enabled, customers can use "Connect with Facebook" in their Ads Manager.
            </div>
          </div>
        </div>

        <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '10px 20px', borderRadius: '8px', border: 'none',
              background: saving ? '#94a3b8' : '#0f766e',
              color: '#fff', fontSize: '0.85rem', fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: '6px',
            }}
          >
            {saving ? <Loader2 size={16} className="crm-spin" /> : <Save size={16} />} Save Configuration
          </button>
        </div>
      </div>

      {/* ─── Comprehensive Setup Guide ─── */}
      <div style={{ background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BookOpen size={20} style={{ color: '#0f766e' }} />
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>Complete Setup Guide</h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Everything you need to configure the Facebook Marketing API for your entire platform</p>
          </div>
        </div>
        <div style={{ padding: '0' }}>
          <details open>
            <summary style={stepSummaryStyle}>
              <span style={stepBadgeStyle}>1</span>
              <span>Create a Meta Developer Account & App</span>
              <ChevronDown size={16} style={{ marginLeft: 'auto', color: 'var(--text-dark)' }} />
            </summary>
            <div style={stepContentStyle}>
              <p style={stepTextStyle}>Before you can use the Facebook Marketing API, you need to create a Meta Developer account and register a new app. This app acts as the bridge between your CRM and Facebook's advertising platform.</p>
              <ol style={stepListStyle}>
                <li>Go to <a href="https://developers.facebook.com/" target="_blank" rel="noopener noreferrer" style={linkStyle}>developers.facebook.com <ExternalLink size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /></a> and sign in with your Facebook account.</li>
                <li>If you don't have a developer account, Facebook will prompt you to create one. Accept the terms and verify your account (may require a phone number or credit card on file — this is for spam prevention, not charged).</li>
                <li>Once logged in, go to <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer" style={linkStyle}>My Apps <ExternalLink size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /></a> and click the green <strong>"Create App"</strong> button.</li>
                <li>You'll see three app type options. Select <strong>"Business"</strong> — this type is designed for apps that manage ads and marketing data. Click "Next".</li>
                <li>Fill in the app details:
                  <ul style={{ margin: '6px 0 0', paddingLeft: '20px', listStyle: 'disc' }}>
                    <li><strong>App Name:</strong> Use something recognizable, e.g. "LeadCentre Ads Manager" or your platform name.</li>
                    <li><strong>App Contact Email:</strong> Your support or admin email address.</li>
                    <li><strong>Business Account:</strong> Select your Meta Business Manager account (create one at <a href="https://business.facebook.com/" target="_blank" rel="noopener noreferrer" style={linkStyle}>business.facebook.com</a> if you don't have one).</li>
                  </ul>
                </li>
                <li>Click <strong>"Create App"</strong> and complete the security captcha. Your app is now created in Development Mode.</li>
              </ol>
            </div>
          </details>

          <div style={{ height: '1px', background: 'var(--border-subtle)' }} />

          <details>
            <summary style={stepSummaryStyle}>
              <span style={stepBadgeStyle}>2</span>
              <span>Add the Marketing API Product</span>
              <ChevronDown size={16} style={{ marginLeft: 'auto', color: 'var(--text-dark)' }} />
            </summary>
            <div style={stepContentStyle}>
              <p style={stepTextStyle}>Your new app starts with no products. You need to add the Marketing API so it can interact with Facebook's advertising system.</p>
              <ol style={stepListStyle}>
                <li>In your app dashboard, scroll down to the <strong>"Add a Product"</strong> section.</li>
                <li>Find <strong>"Marketing API"</strong> and click <strong>"Set Up"</strong>.</li>
                <li>You'll be taken to the Marketing API settings page. Under <strong>"Tools"</strong>, you can test API calls — but you don't need to do anything here yet.</li>
                <li>Note the <strong>API version</strong> shown (e.g. v21.0). Your CRM uses v21.0 automatically — no action needed unless you want to change this.</li>
              </ol>
            </div>
          </details>

          <div style={{ height: '1px', background: 'var(--border-subtle)' }} />

          <details>
            <summary style={stepSummaryStyle}>
              <span style={stepBadgeStyle}>3</span>
              <span>Copy Your App ID and App Secret</span>
              <ChevronDown size={16} style={{ marginLeft: 'auto', color: 'var(--text-dark)' }} />
            </summary>
            <div style={stepContentStyle}>
              <p style={stepTextStyle}>These are the two credentials you need to enter in the form above. The App ID is public — it's sent to the customer's browser to open the Facebook login popup. The App Secret is private — it never leaves the server.</p>
              <ol style={stepListStyle}>
                <li>In your app dashboard, click <strong>"Settings"</strong> in the left sidebar, then <strong>"Basic"</strong>.</li>
                <li>You'll see the <strong>App ID</strong> displayed at the top — it's a 15-16 digit number. Copy this and paste it into the "Meta App ID" field above.</li>
                <li>Next to the App ID, you'll see <strong>App Secret</strong> with a "Show" button. Click it (you may need to re-enter your Facebook password).</li>
                <li>The secret will be revealed — a ~32 character string. Copy it and paste it into the "App Secret" field above.</li>
                <li>While you're on this page, also fill in:
                  <ul style={{ margin: '6px 0 0', paddingLeft: '20px', listStyle: 'disc' }}>
                    <li><strong>Privacy Policy URL:</strong> Required for App Review. Use your site's privacy policy page (e.g. https://yoursite.com/privacy).</li>
                    <li><strong>Terms of Service URL:</strong> Required for App Review. Use your site's terms page (e.g. https://yoursite.com/terms).</li>
                    <li><strong>App Icon:</strong> Upload a 1024x1024 logo — this is what customers see in the Facebook login popup.</li>
                  </ul>
                </li>
                <li>Scroll to the bottom and click <strong>"Save Changes"</strong>.</li>
              </ol>
            </div>
          </details>

          <div style={{ height: '1px', background: 'var(--border-subtle)' }} />

          <details>
            <summary style={stepSummaryStyle}>
              <span style={stepBadgeStyle}>4</span>
              <span>Configure Facebook Login & OAuth Redirect URI</span>
              <ChevronDown size={16} style={{ marginLeft: 'auto', color: 'var(--text-dark)' }} />
            </summary>
            <div style={stepContentStyle}>
              <p style={stepTextStyle}>This is the most critical step for the OAuth flow to work. Facebook needs to know which URL the user is redirected back to after they log in and grant permission. If this URL doesn't match exactly, the connection will fail.</p>
              <ol style={stepListStyle}>
                <li>In your app dashboard, scroll to <strong>"Add a Product"</strong> and find <strong>"Facebook Login"</strong>. Click <strong>"Set Up"</strong>.</li>
                <li>Select <strong>"Web"</strong> as the platform.</li>
                <li>In the <strong>"Site URL"</strong> field, enter your production domain (e.g. <code style={codeStyle}>https://leadcentre.bolt.new</code>). Do NOT use localhost or a test URL. Click <strong>"Save"</strong>.</li>
                <li>In the left sidebar under Facebook Login, click <strong>"Settings"</strong>.</li>
                <li>Scroll down to <strong>"Valid OAuth Redirect URIs"</strong>. Add the following URL:
                  <div style={{ marginTop: '8px', marginBottom: '8px' }}>
                    <code style={{ ...codeStyle, display: 'block', padding: '8px 12px', fontSize: '0.78rem', overflowX: 'auto' }}>
                      {typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}
                    </code>
                  </div>
                  This must be the exact origin of your site — no trailing slash, no path, no query parameters. It must match what appears in the browser's address bar when a customer visits your CRM.
                </li>
                <li>Leave <strong>"Deauthorize Callback URL"</strong> and <strong>"Data Deletion Request URL"</strong> empty for now (these are optional for this flow).</li>
                <li>Scroll to the bottom and click <strong>"Save Changes"</strong>.</li>
              </ol>
            </div>
          </details>

          <div style={{ height: '1px', background: 'var(--border-subtle)' }} />

          <details>
            <summary style={stepSummaryStyle}>
              <span style={stepBadgeStyle}>5</span>
              <span>Save Credentials & Test in Development Mode</span>
              <ChevronDown size={16} style={{ marginLeft: 'auto', color: 'var(--text-dark)' }} />
            </summary>
            <div style={stepContentStyle}>
              <p style={stepTextStyle}>Your app is in Development Mode — only people you've added as testers or developers can use it. This is perfect for testing the "Connect with Facebook" flow yourself before opening it to all customers.</p>
              <ol style={stepListStyle}>
                <li>Copy your <strong>App ID</strong> and <strong>App Secret</strong> from Step 3 above.</li>
                <li>Enter them in the configuration form at the top of this page.</li>
                <li>Make sure the <strong>"Enabled"</strong> toggle is on.</li>
                <li>Click <strong>"Save Configuration"</strong>.</li>
                <li>Now open your CRM's <strong>Meta Ads Manager</strong> (as a regular user, not super admin). Go to the <strong>Connection</strong> tab.</li>
                <li>You should see the <strong>"Connect with Facebook"</strong> button. Click it.</li>
                <li>A Facebook login popup should appear. Log in with the same Facebook account you used to create the app.</li>
                <li>Grant the requested permissions (ads_management, ads_read, business_management).</li>
                <li>You should be redirected back to the CRM with your ad accounts loaded. Select one and verify the connection works.</li>
              </ol>
              <div style={calloutWarningStyle}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Popup blocked?</strong> If your browser blocks the Facebook login popup, you'll see an error. Allow popups for your site in your browser settings and try again. The popup is required for the OAuth flow to work.
                </div>
              </div>
            </div>
          </details>

          <div style={{ height: '1px', background: 'var(--border-subtle)' }} />

          <details>
            <summary style={stepSummaryStyle}>
              <span style={stepBadgeStyle}>6</span>
              <span>Add Test Users (Development Mode)</span>
              <ChevronDown size={16} style={{ marginLeft: 'auto', color: 'var(--text-dark)' }} />
            </summary>
            <div style={stepContentStyle}>
              <p style={stepTextStyle}>In Development Mode, only people listed as testers, developers, or admins of your Meta App can complete the "Connect with Facebook" flow. To let a few customers try it before App Review, add them as testers.</p>
              <ol style={stepListStyle}>
                <li>In your app dashboard, go to <strong>App Roles &rarr; Roles</strong>.</li>
                <li>Under <strong>"Testers"</strong>, click <strong>"Add Testers"</strong>.</li>
                <li>Enter the Facebook user's name or email. They must have a Facebook account.</li>
                <li>The tester will receive a notification on Facebook. They need to accept it before they can use "Connect with Facebook".</li>
                <li>Once they accept, they can open the Meta Ads Manager in their CRM, click "Connect with Facebook", and the flow will work.</li>
              </ol>
              <div style={calloutInfoStyle}>
                <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Tip:</strong> You can add up to 100 testers in Development Mode. For larger rollouts, complete App Review (Step 7) to remove this limitation.
                </div>
              </div>
            </div>
          </details>

          <div style={{ height: '1px', background: 'var(--border-subtle)' }} />

          <details>
            <summary style={stepSummaryStyle}>
              <span style={stepBadgeStyle}>7</span>
              <span>Submit for App Review (Enable for All Customers)</span>
              <ChevronDown size={16} style={{ marginLeft: 'auto', color: 'var(--text-dark)' }} />
            </summary>
            <div style={stepContentStyle}>
              <p style={stepTextStyle}>To allow ALL your customers to use "Connect with Facebook" — not just testers — your app must pass Meta's App Review process. This verifies that your app uses Facebook data legitimately.</p>
              <ol style={stepListStyle}>
                <li>Complete <strong>Business Verification</strong> first:
                  <ul style={{ margin: '6px 0 0', paddingLeft: '20px', listStyle: 'disc' }}>
                    <li>Go to <a href="https://business.facebook.com/settings" target="_blank" rel="noopener noreferrer" style={linkStyle}>Meta Business Settings <ExternalLink size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /></a>.</li>
                    <li>Select your Business Manager account.</li>
                    <li>Go to <strong>Business Settings &rarr; Security Center</strong>.</li>
                    <li>Click <strong>"Start Verification"</strong> and submit your business documents (business license, utility bill, or tax certificate).</li>
                    <li>Wait for Meta to verify your business — this typically takes 1-5 business days.</li>
                  </ul>
                </li>
                <li>Once verified, go back to your app dashboard and navigate to <strong>App Review &rarr; Permissions and Features</strong>.</li>
                <li>Find and request the following permissions:
                  <ul style={{ margin: '6px 0 0', paddingLeft: '20px', listStyle: 'disc' }}>
                    <li><code style={codeStyle}>ads_management</code> — Required to create, edit, and manage ad campaigns.</li>
                    <li><code style={codeStyle}>ads_read</code> — Required to read ad performance data (spend, impressions, clicks).</li>
                  </ul>
                </li>
                <li>For each permission, you'll need to provide:
                  <ul style={{ margin: '6px 0 0', paddingLeft: '20px', listStyle: 'disc' }}>
                    <li><strong>Detailed description</strong> of how your app uses the data (be specific: "Our CRM allows users to create Facebook ad campaigns, view spend metrics, and sync lead data from Facebook Lead Ads").</li>
                    <li><strong>Screencast</strong> — a 1-3 minute video showing the "Connect with Facebook" flow, the Ads Manager UI, and how a customer creates a campaign. Use a tool like Loom or record your screen.</li>
                    <li><strong>App usage instructions</strong> — step-by-step instructions for the reviewer to test the flow (include test login credentials if possible).</li>
                  </ul>
                </li>
                <li>Submit for review. Meta will review within 1-7 business days. You'll receive an email when the review is complete.</li>
                <li>Once approved, your app switches from "Development" to "Live" mode automatically. All customers can now use "Connect with Facebook" without being added as testers.</li>
              </ol>
              <div style={calloutWarningStyle}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Common rejection reasons:</strong> Incomplete screencast, missing privacy policy URL, unclear data usage description, or business verification not completed. Address these before re-submitting.
                </div>
              </div>
            </div>
          </details>

          <div style={{ height: '1px', background: 'var(--border-subtle)' }} />

          <details>
            <summary style={stepSummaryStyle}>
              <span style={stepBadgeStyle}>8</span>
              <span>Switch App to Live Mode</span>
              <ChevronDown size={16} style={{ marginLeft: 'auto', color: 'var(--text-dark)' }} />
            </summary>
            <div style={stepContentStyle}>
              <p style={stepTextStyle}>After App Review is approved, you need to switch your app to Live mode to make it available to all Facebook users.</p>
              <ol style={stepListStyle}>
                <li>In your app dashboard, find the <strong>"App Mode"</strong> toggle at the top of the page.</li>
                <li>Switch it from <strong>"Development"</strong> to <strong>"Live"</strong>.</li>
                <li>Facebook will confirm that your app meets all requirements (privacy policy, terms of service, app icon, business verification, approved permissions).</li>
                <li>Once in Live mode, any Facebook user who clicks "Connect with Facebook" in your CRM will be able to log in and grant permission — no need to add them as testers.</li>
              </ol>
              <div style={calloutSuccessStyle}>
                <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>You're done!</strong> All your customers can now connect their Facebook ad accounts with one click. No API keys, no developer tools, no technical knowledge required from their side.
                </div>
              </div>
            </div>
          </details>

          <div style={{ height: '1px', background: 'var(--border-subtle)' }} />

          {/* Troubleshooting */}
          <details>
            <summary style={{ ...stepSummaryStyle, color: '#dc2626' }}>
              <span style={{ ...stepBadgeStyle, background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}>
                <AlertCircle size={14} />
              </span>
              <span>Troubleshooting Common Issues</span>
              <ChevronDown size={16} style={{ marginLeft: 'auto', color: 'var(--text-dark)' }} />
            </summary>
            <div style={stepContentStyle}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <strong style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>"Can't Load URL: The domain of this URL isn't included in the app's domains"</strong>
                  <p style={{ ...stepTextStyle, marginTop: '4px' }}>
                    Your OAuth redirect URI doesn't match. Go to Facebook Login &rarr; Settings and make sure the Valid OAuth Redirect URI exactly matches your site URL (no trailing slash). Also check that your app's App Domains (Settings &rarr; Basic) include your domain.
                  </p>
                </div>
                <div>
                  <strong style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>"Invalid Scopes: ads_management"</strong>
                  <p style={{ ...stepTextStyle, marginTop: '4px' }}>
                    Your app hasn't been approved for the ads_management permission yet, and the user isn't a tester/developer. Either complete App Review (Step 7) or add the user as a tester (Step 6).
                  </p>
                </div>
                <div>
                  <strong style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>"Meta Marketing API is not configured" message in customer's Ads Manager</strong>
                  <p style={{ ...stepTextStyle, marginTop: '4px' }}>
                    You haven't saved the App ID and App Secret in the form above, or the "Enabled" toggle is off. Come back to this page, enter your credentials, enable the toggle, and save.
                  </p>
                </div>
                <div>
                  <strong style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>Popup doesn't appear or is blocked</strong>
                  <p style={{ ...stepTextStyle, marginTop: '4px' }}>
                    Browsers may block popups. The customer should allow popups for your site in their browser settings. In Chrome, the icon appears in the address bar — click it and select "Always allow popups from this site".
                  </p>
                </div>
                <div>
                  <strong style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>Token expired (after 60 days)</strong>
                  <p style={{ ...stepTextStyle, marginTop: '4px' }}>
                    Facebook long-lived tokens expire after 60 days. The customer will need to click "Disconnect" and then "Connect with Facebook" again to get a fresh token. The Connection tab shows the token expiry date so they know when to reconnect.
                  </p>
                </div>
                <div>
                  <strong style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>No ad accounts showing after connecting</strong>
                  <p style={{ ...stepTextStyle, marginTop: '4px' }}>
                    The Facebook user may not have any ad accounts, or their ad accounts are not associated with the Business Manager they selected. They need to create an ad account in Facebook Ads Manager first, then click "Load Ad Accounts" in the Connection tab.
                  </p>
                </div>
              </div>
            </div>
          </details>

          <div style={{ height: '1px', background: 'var(--border-subtle)' }} />

          {/* FAQ */}
          <details>
            <summary style={{ ...stepSummaryStyle, color: '#0f766e' }}>
              <span style={{ ...stepBadgeStyle, background: 'rgba(15,118,110,0.1)', color: '#0f766e' }}>
                <HelpCircle size={14} />
              </span>
              <span>Frequently Asked Questions</span>
              <ChevronDown size={16} style={{ marginLeft: 'auto', color: 'var(--text-dark)' }} />
            </summary>
            <div style={stepContentStyle}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <strong style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>Do I need a separate Meta App for each customer?</strong>
                  <p style={{ ...stepTextStyle, marginTop: '4px' }}>
                    No. That's the whole point of this setup. You create ONE Meta App and configure it here. Every customer uses the same app through the "Connect with Facebook" button. Each customer gets their own access token — they're independent.
                  </p>
                </div>
                <div>
                  <strong style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>Does the customer see my App Secret?</strong>
                  <p style={{ ...stepTextStyle, marginTop: '4px' }}>
                    No. The App Secret is stored securely on the server and never sent to the customer's browser. Only the App ID is shared with the browser — that's public and safe to expose.
                  </p>
                </div>
                <div>
                  <strong style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>Can customers run ads from any Facebook account?</strong>
                  <p style={{ ...stepTextStyle, marginTop: '4px' }}>
                    Yes. Each customer connects their own Facebook account. They can only manage ad accounts that their Facebook user has access to. One customer cannot see another customer's ad accounts or campaigns.
                  </p>
                </div>
                <div>
                  <strong style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>What happens if I disable the toggle after customers have connected?</strong>
                  <p style={{ ...stepTextStyle, marginTop: '4px' }}>
                    Existing connections keep working — their tokens are already stored. But new customers won't be able to connect (they'll see the "not configured" message). Re-enable the toggle to allow new connections.
                  </p>
                </div>
                <div>
                  <strong style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>Is there a cost for using the Facebook Marketing API?</strong>
                  <p style={{ ...stepTextStyle, marginTop: '4px' }}>
                    No. The Marketing API is free to use. You only pay for the actual ad spend through Facebook. There are no API call fees or per-request charges from Meta.
                  </p>
                </div>
                <div>
                  <strong style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>How long does App Review take?</strong>
                  <p style={{ ...stepTextStyle, marginTop: '4px' }}>
                    Typically 1-7 business days. Business verification can take 1-5 days. Submit both early so they process in parallel. While waiting, use Development Mode with testers to validate the flow.
                  </p>
                </div>
              </div>
            </div>
          </details>
        </div>
      </div>

      {/* How it works for customers */}
      <div style={{ background: 'rgba(15,118,110,0.06)', border: '1px solid rgba(15,118,110,0.2)', borderRadius: '14px', padding: '20px 24px' }}>
        <h3 style={{ margin: '0 0 10px', fontSize: '0.9rem', fontWeight: 700, color: '#0f766e' }}>How customers experience this</h3>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.8 }}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '6px' }}>
            <span style={{ color: '#0f766e', fontWeight: 700 }}>1.</span>
            <span>Customer opens Meta Ads Manager in their CRM and sees a "Connect with Facebook" button.</span>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '6px' }}>
            <span style={{ color: '#0f766e', fontWeight: 700 }}>2.</span>
            <span>A Facebook login popup appears — they log in and grant your app permission to manage their ads.</span>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '6px' }}>
            <span style={{ color: '#0f766e', fontWeight: 700 }}>3.</span>
            <span>Their ad accounts are loaded — they select which one to use.</span>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <span style={{ color: '#0f766e', fontWeight: 700 }}>4.</span>
            <span>They can now create, pause, and manage campaigns, sync stats, and view insights — all from the CRM.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
