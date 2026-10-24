import { useState, useMemo } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  Settings as SettingsIcon, CreditCard, ToggleLeft, FileText, Mail,
  Wallet, MessageSquare, Zap, TrendingUp, LogIn,
  ChevronRight, Sparkles,
} from 'lucide-react';
import SuperAdminPlans from './SuperAdminPlans';
import SuperAdminFeatures from './SuperAdminFeatures';
import SuperAdminLegal from './SuperAdminLegal';
import SuperAdminEmailSettings from './SuperAdminEmailSettings';
import SuperAdminPaymentSettings from './SuperAdminPaymentSettings';
import SuperAdminWhatsAppConfig from './SuperAdminWhatsAppConfig';
import SuperAdminWhatsAppOnboarding from './SuperAdminWhatsAppOnboarding';
import SuperAdminMetaAdsSettings from './SuperAdminMetaAdsSettings';
import SuperAdminSocialAuthSettings from './SuperAdminSocialAuthSettings';
import SuperAdminAIAssistant from './SuperAdminAIAssistant';

type SettingsTab =
  | 'plans'
  | 'features'
  | 'legal'
  | 'email'
  | 'payments'
  | 'wa_config'
  | 'wa_onboarding'
  | 'meta_ads'
  | 'social_auth'
  | 'ai_assistant';

type TabDef = {
  key: SettingsTab;
  label: string;
  description: string;
  icon: React.ReactNode;
  group: string;
};

const TABS: TabDef[] = [
  { key: 'plans', label: 'Plans & Pricing', description: 'Manage subscription plans and pricing', icon: <CreditCard size={18} />, group: 'Billing' },
  { key: 'payments', label: 'Payment Gateway', description: 'Configure Razorpay payment gateway for checkout', icon: <Wallet size={18} />, group: 'Billing' },
  { key: 'features', label: 'Feature Toggles', description: 'Enable or disable platform features', icon: <ToggleLeft size={18} />, group: 'Platform' },
  { key: 'legal', label: 'Legal Pages', description: 'Edit legal pages published on your site', icon: <FileText size={18} />, group: 'Platform' },
  { key: 'email', label: 'Email Config', description: 'Configure default SMTP for all accounts', icon: <Mail size={18} />, group: 'Platform' },
  { key: 'wa_config', label: 'WhatsApp Cloud API', description: 'Master switches for WhatsApp Cloud API, embedded signup, and coexistence mode', icon: <MessageSquare size={18} />, group: 'WhatsApp' },
  { key: 'wa_onboarding', label: 'WhatsApp Onboarding', description: 'Configure embedded signup for client WhatsApp onboarding', icon: <Zap size={18} />, group: 'WhatsApp' },
  { key: 'meta_ads', label: 'Meta Marketing API', description: 'Configure Facebook Marketing API for the Ads Manager OAuth flow', icon: <TrendingUp size={18} />, group: 'Integrations' },
  { key: 'social_auth', label: 'Social Login', description: 'Enable Continue with Google / Facebook on the admin login page', icon: <LogIn size={18} />, group: 'Integrations' },
  { key: 'ai_assistant', label: 'HubbotsX AI Assistant', description: 'Configure the AI provider and API key for the HubbotsX CRM assistant', icon: <Sparkles size={18} />, group: 'Integrations' },
];

export default function SuperAdminSettings({ session }: { session: Session }) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('plans');

  const grouped = useMemo(() => {
    return TABS.reduce((acc, tab) => {
      (acc[tab.group] = acc[tab.group] || []).push(tab);
      return acc;
    }, {} as Record<string, TabDef[]>);
  }, []);

  const currentTab = TABS.find((t) => t.key === activeTab)!;

  const renderPanel = () => {
    switch (activeTab) {
      case 'plans': return <SuperAdminPlans />;
      case 'features': return <SuperAdminFeatures />;
      case 'legal': return <SuperAdminLegal />;
      case 'email': return <SuperAdminEmailSettings />;
      case 'payments': return <SuperAdminPaymentSettings />;
      case 'wa_config': return <SuperAdminWhatsAppConfig />;
      case 'wa_onboarding': return <SuperAdminWhatsAppOnboarding />;
      case 'meta_ads': return <SuperAdminMetaAdsSettings />;
      case 'social_auth': return <SuperAdminSocialAuthSettings />;
      case 'ai_assistant': return <SuperAdminAIAssistant />;
      default: return null;
    }
  };

  return (
    <div style={{ maxWidth: '1080px' }}>
      {/* Hero */}
      <div style={{
        borderRadius: '20px', padding: '28px', marginBottom: '24px', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #0f172a 0%, #0f766e 50%, #134e4a 100%)',
      }}>
        <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(20,184,166,0.15)', filter: 'blur(40px)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <SettingsIcon size={18} style={{ color: '#5eead4' }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#5eead4', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Platform Settings</span>
          </div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Settings
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: '0.88rem', color: 'rgba(255,255,255,0.6)', maxWidth: '520px' }}>
            Manage plans, feature toggles, integrations, and platform-wide configuration for all clients in one place.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        {/* Sidebar tabs */}
        <div style={{ width: '260px', flexShrink: 0, position: 'sticky', top: '16px' }}>
          {Object.entries(grouped).map(([group, tabs]) => (
            <div key={group} style={{ marginBottom: '18px' }}>
              <div style={{
                fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-dark)', textTransform: 'uppercase',
                letterSpacing: '0.08em', padding: '0 12px 8px',
              }}>
                {group}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {tabs.map((tab) => {
                  const isActiveTab = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 12px', borderRadius: '10px',
                        background: isActiveTab ? 'rgba(15,118,110,0.08)' : 'transparent',
                        border: 'none', cursor: 'pointer', textAlign: 'left',
                        transition: 'all 0.15s', width: '100%',
                      }}
                      onMouseEnter={(e) => { if (!isActiveTab) e.currentTarget.style.background = 'var(--bg-light)'; }}
                      onMouseLeave={(e) => { if (!isActiveTab) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span style={{
                        color: isActiveTab ? '#0f766e' : 'var(--text-dark)',
                        display: 'flex', alignItems: 'center', flexShrink: 0,
                      }}>
                        {tab.icon}
                      </span>
                      <span style={{
                        fontSize: '0.83rem', fontWeight: isActiveTab ? 700 : 500,
                        color: isActiveTab ? '#0f766e' : 'var(--text-main)', flex: 1,
                      }}>
                        {tab.label}
                      </span>
                      {isActiveTab && <ChevronRight size={14} style={{ color: '#0f766e' }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Active panel */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px',
            padding: '0 4px',
          }}>
            <span style={{ color: '#0f766e', display: 'flex' }}>{currentTab.icon}</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>{currentTab.label}</h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-dark)' }}>{currentTab.description}</p>
            </div>
          </div>
          {renderPanel()}
        </div>
      </div>
    </div>
  );
}
