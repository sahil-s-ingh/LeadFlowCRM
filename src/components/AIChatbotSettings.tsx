import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import {
  Bot, Save, Loader2, CheckCircle2, AlertTriangle, Sparkles,
  MessageCircle, Send, Power, Key, Cpu, Thermometer, FileText,
  RefreshCw, Shield,
} from 'lucide-react';

const PROVIDERS = [
  { id: 'openai', label: 'OpenAI (ChatGPT)', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'], apiKeyUrl: 'https://platform.openai.com/api-keys' },
  { id: 'gemini', label: 'Google Gemini', models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'], apiKeyUrl: 'https://aistudio.google.com/app/apikey' },
  { id: 'claude', label: 'Anthropic Claude', models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'], apiKeyUrl: 'https://console.anthropic.com/settings/keys' },
  { id: 'mistral', label: 'Mistral AI', models: ['mistral-large-latest', 'mistral-small-latest', 'open-mixtral-8x7b'], apiKeyUrl: 'https://console.mistral.ai/api-keys/' },
] as const;

interface AIConfig {
  id?: string;
  provider: string;
  api_key: string;
  model: string;
  system_prompt: string | null;
  temperature: number;
  max_tokens: number;
  whatsapp_enabled: boolean;
  telegram_enabled: boolean;
  fallback_message: string;
  is_active: boolean;
}

const DEFAULT_CONFIG: AIConfig = {
  provider: 'openai',
  api_key: '',
  model: 'gpt-4o-mini',
  system_prompt: 'You are a helpful customer support assistant for a trading CRM. Be concise, friendly, and professional. If you do not know something, say so and let the customer know a human agent will follow up.',
  temperature: 0.7,
  max_tokens: 500,
  whatsapp_enabled: false,
  telegram_enabled: false,
  fallback_message: 'Sorry, I could not process your request at the moment. Our team will get back to you shortly.',
  is_active: true,
};

export default function AIChatbotSettings({ session }: { session: Session | null }) {
  const [config, setConfig] = useState<AIConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  const fetchConfig = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('ai_reply_settings')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (err) throw err;
      if (data) setConfig(data as AIConfig);
      else setConfig(DEFAULT_CONFIG);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load settings';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async () => {
    if (!session?.user?.id) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const payload = { ...config, user_id: session.user.id, updated_at: new Date().toISOString() };
      if (config.id) {
        const { error: err } = await supabase.from('ai_reply_settings').update(payload).eq('id', config.id);
        if (err) throw err;
      } else {
        const { data, error: err } = await supabase.from('ai_reply_settings').insert(payload).select().single();
        if (err) throw err;
        if (data) setConfig(data as AIConfig);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const currentProvider = PROVIDERS.find((p) => p.id === config.provider) || PROVIDERS[0];
  const update = <K extends keyof AIConfig>(key: K, value: AIConfig[K]) => setConfig((prev) => ({ ...prev, [key]: value }));

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <Loader2 size={28} className="crm-spin" style={{ marginBottom: '12px' }} />
        <p style={{ color: 'var(--text-muted, #64748b)' }}>Loading AI settings...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '24px' }}>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #2563eb, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Sparkles size={24} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>AI Chatbot Auto-Reply</h1>
            <p style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.9rem', margin: '4px 0 0' }}>
              Automatically reply to WhatsApp and Telegram messages using AI. All providers in one place.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', marginBottom: '20px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', color: '#dc2626', fontSize: '0.875rem' }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {saved && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', marginBottom: '20px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '10px', color: '#16a34a', fontSize: '0.875rem' }}>
          <CheckCircle2 size={16} /> Settings saved successfully.
        </div>
      )}

      {/* Master toggle */}
      <div className="crm-table-card" style={{ padding: '20px 24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Power size={20} style={{ color: config.is_active ? '#16a34a' : '#94a3b8' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>AI Auto-Reply Status</h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.825rem', color: 'var(--text-muted, #64748b)' }}>
                {config.is_active ? 'Active — AI will respond to new messages' : 'Disabled — no AI replies will be sent'}
              </p>
            </div>
          </div>
          <button onClick={() => update('is_active', !config.is_active)} style={{ width: '52px', height: '28px', borderRadius: '14px', background: config.is_active ? '#16a34a' : '#cbd5e1', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
            <span style={{ position: 'absolute', top: '3px', left: config.is_active ? '27px' : '3px', width: '22px', height: '22px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
          </button>
        </div>
      </div>

      {/* Channel toggles */}
      <div className="crm-table-card" style={{ padding: '20px 24px', marginBottom: '20px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>
          <Bot size={18} /> Channels
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <ChannelToggle icon={<MessageCircle size={18} style={{ color: '#16a34a' }} />} label="WhatsApp" description="Auto-reply to incoming WhatsApp messages" enabled={config.whatsapp_enabled} onToggle={() => update('whatsapp_enabled', !config.whatsapp_enabled)} />
          <ChannelToggle icon={<Send size={18} style={{ color: '#0088cc' }} />} label="Telegram" description="Auto-reply to incoming Telegram messages" enabled={config.telegram_enabled} onToggle={() => update('telegram_enabled', !config.telegram_enabled)} />
        </div>
      </div>

      {/* Provider config */}
      <div className="crm-table-card" style={{ padding: '20px 24px', marginBottom: '20px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>
          <Cpu size={18} /> AI Provider
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px', marginBottom: '20px' }}>
          {PROVIDERS.map((p) => (
            <button key={p.id} onClick={() => { update('provider', p.id); update('model', p.models[0]); }} style={{ padding: '12px', borderRadius: '10px', border: config.provider === p.id ? '2px solid #2563eb' : '2px solid var(--border, #e2e8f0)', background: config.provider === p.id ? 'rgba(37,99,235,0.06)' : 'transparent', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
              <div style={{ fontWeight: 600, fontSize: '0.825rem', color: config.provider === p.id ? '#2563eb' : 'inherit' }}>{p.label}</div>
            </button>
          ))}
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.825rem', fontWeight: 600, marginBottom: '6px' }}>
            <Key size={14} /> API Key
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type={showApiKey ? 'text' : 'password'} value={config.api_key || ''} onChange={(e) => update('api_key', e.target.value)} placeholder={`Enter your ${currentProvider.label} API key`} style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border, #e2e8f0)', background: 'var(--bg-input, #fff)', fontSize: '0.875rem' }} />
            <button onClick={() => setShowApiKey(!showApiKey)} style={{ padding: '0 14px', borderRadius: '8px', border: '1px solid var(--border, #e2e8f0)', background: 'transparent', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
              {showApiKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <a href={currentProvider.apiKeyUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: '#2563eb', marginTop: '4px', display: 'inline-block' }}>
            Get API key from {currentProvider.label} →
          </a>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.825rem', fontWeight: 600, marginBottom: '6px' }}>
            <Cpu size={14} /> Model
          </label>
          <select value={config.model || ''} onChange={(e) => update('model', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border, #e2e8f0)', background: 'var(--bg-input, #fff)', fontSize: '0.875rem' }}>
            {currentProvider.models.map((m) => (<option key={m} value={m}>{m}</option>))}
          </select>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.825rem', fontWeight: 600, marginBottom: '6px' }}>
            <FileText size={14} /> System Prompt
          </label>
          <textarea value={config.system_prompt || ''} onChange={(e) => update('system_prompt', e.target.value)} rows={5} placeholder="Instructions for the AI assistant..." style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border, #e2e8f0)', background: 'var(--bg-input, #fff)', fontSize: '0.875rem', resize: 'vertical', lineHeight: 1.5 }} />
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', marginTop: '4px' }}>Define the AI's personality, tone, and what it should know about your business.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.825rem', fontWeight: 600, marginBottom: '6px' }}>
              <Thermometer size={14} /> Temperature: {config.temperature.toFixed(1)}
            </label>
            <input type="range" min="0" max="2" step="0.1" value={config.temperature} onChange={(e) => update('temperature', parseFloat(e.target.value))} style={{ width: '100%' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted, #64748b)' }}>
              <span>Precise</span><span>Creative</span>
            </div>
          </div>
          <div>
            <label style={{ fontSize: '0.825rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Max Response Tokens</label>
            <input type="number" min="50" max="4000" step="50" value={config.max_tokens} onChange={(e) => update('max_tokens', parseInt(e.target.value, 10) || 500)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border, #e2e8f0)', background: 'var(--bg-input, #fff)', fontSize: '0.875rem' }} />
          </div>
        </div>

        <div>
          <label style={{ fontSize: '0.825rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Fallback Message</label>
          <input type="text" value={config.fallback_message} onChange={(e) => update('fallback_message', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border, #e2e8f0)', background: 'var(--bg-input, #fff)', fontSize: '0.875rem' }} />
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', marginTop: '4px' }}>Sent to the customer if the AI fails to generate a response.</p>
        </div>
      </div>

      {/* Human override info */}
      <div style={{ padding: '16px', background: 'rgba(37,99,235,0.04)', border: '1px solid rgba(37,99,235,0.15)', borderRadius: '10px', marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <Shield size={18} style={{ color: '#2563eb', flexShrink: 0, marginTop: '2px' }} />
        <div>
          <p style={{ margin: 0, fontSize: '0.825rem', fontWeight: 600, color: '#2563eb' }}>Human Override</p>
          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', lineHeight: 1.5 }}>
            When you or a team member replies to a conversation, AI auto-reply automatically pauses for that conversation. The AI will not interrupt ongoing human conversations.
          </p>
        </div>
      </div>

      {/* Save button */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button onClick={fetchConfig} disabled={saving} style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid var(--border, #e2e8f0)', background: 'transparent', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={16} /> Reset
        </button>
        <button onClick={handleSave} disabled={saving} style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', opacity: saving ? 0.6 : 1 }}>
          {saving ? <Loader2 size={16} className="crm-spin" /> : <Save size={16} />} Save Settings
        </button>
      </div>
    </div>
  );
}

function ChannelToggle({ icon, label, description, enabled, onToggle }: {
  icon: React.ReactNode;
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border, #e2e8f0)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {icon}
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{label}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>{description}</div>
        </div>
      </div>
      <button onClick={onToggle} style={{ width: '44px', height: '24px', borderRadius: '12px', background: enabled ? '#16a34a' : '#cbd5e1', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
        <span style={{ position: 'absolute', top: '2px', left: enabled ? '22px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  );
}
