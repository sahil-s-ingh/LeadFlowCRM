import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Sparkles, Save, Loader2, CheckCircle2, AlertTriangle, Key, Cpu, Power, RefreshCw } from 'lucide-react';

const PROVIDERS = [
  { id: 'openai', label: 'OpenAI (ChatGPT)', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'], apiKeyUrl: 'https://platform.openai.com/api-keys' },
  { id: 'gemini', label: 'Google Gemini (Free)', models: ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.8-flash-lite', 'gemini-flash-latest'], apiKeyUrl: 'https://aistudio.google.com/app/apikey' },
  { id: 'claude', label: 'Anthropic Claude', models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'], apiKeyUrl: 'https://console.anthropic.com/settings/keys' },
  { id: 'mistral', label: 'Mistral AI', models: ['mistral-large-latest', 'mistral-small-latest', 'open-mixtral-8x7b'], apiKeyUrl: 'https://console.mistral.ai/api-keys/' },
] as const;

interface Config {
  id?: string;
  provider: string;
  api_key: string;
  model: string;
  system_prompt: string | null;
  temperature: number;
  max_tokens: number;
  is_active: boolean;
}

export default function SuperAdminAIAssistant() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('ai_assistant_config')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (err) throw err;
      if (data) setConfig(data as Config);
      else setConfig(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const payload = { ...config, updated_at: new Date().toISOString() };
      if (config.id) {
        const { error: err } = await supabase.from('ai_assistant_config').update(payload).eq('id', config.id);
        if (err) throw err;
      } else {
        const { data, error: err } = await supabase.from('ai_assistant_config').insert(payload).select().single();
        if (err) throw err;
        if (data) setConfig(data as Config);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '48px' }}>
        <Loader2 size={28} className="crm-spin" style={{ color: '#0f766e' }} />
      </div>
    );
  }

  const currentProvider = PROVIDERS.find((p) => p.id === (config?.provider || 'openai')) || PROVIDERS[0];
  const update = <K extends keyof Config>(key: K, value: Config[K]) => {
    setConfig((prev) => prev ? { ...prev, [key]: value } : prev);
  };

  return (
    <div style={{ maxWidth: '600px' }}>
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', marginBottom: '16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', color: '#dc2626', fontSize: '0.82rem' }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}
      {saved && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', marginBottom: '16px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '10px', color: '#16a34a', fontSize: '0.82rem' }}>
          <CheckCircle2 size={16} /> Settings saved. Jarvis AI is now available to all CRM users.
        </div>
      )}

      <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-subtle)', padding: '24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Sparkles size={20} style={{ color: '#2563eb' }} />
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Jarvis AI Assistant Configuration</h3>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
          Configure the AI provider and API key for the Jarvis AI Assistant. This is a platform-level setting — every CRM user who signs in will have access to the floating Jarvis button in their dashboard.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Power size={18} style={{ color: config?.is_active ? '#16a34a' : '#94a3b8' }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Assistant Active</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{config?.is_active ? 'Jarvis is available to all users' : 'Jarvis is disabled'}</div>
            </div>
          </div>
          <button onClick={() => update('is_active', !config?.is_active)} style={{ width: '44px', height: '24px', borderRadius: '12px', background: config?.is_active ? '#16a34a' : '#cbd5e1', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
            <span style={{ position: 'absolute', top: '2px', left: config?.is_active ? '22px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
          </button>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Cpu size={14} /> AI Provider
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => { update('provider', p.id); update('model', p.models[0]); }}
                style={{
                  padding: '10px', borderRadius: '8px',
                  border: (config?.provider || 'openai') === p.id ? '2px solid #2563eb' : '2px solid var(--border-subtle)',
                  background: (config?.provider || 'openai') === p.id ? 'rgba(37,99,235,0.06)' : 'transparent',
                  cursor: 'pointer', textAlign: 'center', fontSize: '0.78rem', fontWeight: 600,
                  color: (config?.provider || 'openai') === p.id ? '#2563eb' : 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Key size={14} /> API Key
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type={showApiKey ? 'text' : 'password'}
              value={config?.api_key || ''}
              onChange={(e) => update('api_key', e.target.value)}
              placeholder={`Enter ${currentProvider.label} API key`}
              style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-light)', fontSize: '0.82rem' }}
            />
            <button onClick={() => setShowApiKey(!showApiKey)} style={{ padding: '0 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'transparent', cursor: 'pointer', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
              {showApiKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <a href={currentProvider.apiKeyUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.72rem', color: '#2563eb', marginTop: '4px', display: 'inline-block' }}>
            Get API key from {currentProvider.label} →
          </a>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Model</label>
          <select value={config?.model || ''} onChange={(e) => update('model', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-light)', fontSize: '0.82rem' }}>
            {currentProvider.models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>System Prompt</label>
          <textarea
            value={config?.system_prompt || ''}
            onChange={(e) => update('system_prompt', e.target.value)}
            rows={4}
            placeholder="Instructions for the Jarvis AI assistant..."
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-light)', fontSize: '0.82rem', resize: 'vertical', lineHeight: 1.5 }}
          />
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>Defines Jarvis's personality and what it should know about your business.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Temperature: {(config?.temperature ?? 0.7).toFixed(1)}</label>
            <input type="range" min="0" max="2" step="0.1" value={config?.temperature ?? 0.7} onChange={(e) => update('temperature', parseFloat(e.target.value))} style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Max Response Tokens</label>
            <input type="number" min="100" max="4000" step="50" value={config?.max_tokens ?? 800} onChange={(e) => update('max_tokens', parseInt(e.target.value, 10) || 800)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-light)', fontSize: '0.82rem' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={load} disabled={saving} style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'transparent', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={15} /> Reset
          </button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '9px 22px', borderRadius: '8px', border: 'none', background: '#0f766e', color: 'var(--bg-card)', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', opacity: saving ? 0.6 : 1 }}>
            {saving ? <Loader2 size={15} className="crm-spin" /> : <Save size={15} />} Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
