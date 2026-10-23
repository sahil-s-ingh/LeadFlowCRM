import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import {
  BookOpen, Plus, Trash2, Pencil, X, Tag, Loader2, Save,
  Lightbulb, FlaskRound, Send, Link2, FileSpreadsheet, Package,
  AlertTriangle, ArrowRight,
} from 'lucide-react';

const KB_CATEGORIES = ['Product', 'Pricing', 'FAQ', 'How it works', 'Feature', 'Policy', 'Other'];

interface KBEntry {
  id?: string;
  title: string;
  category: string;
  content: string;
  keywords: string[];
  is_active: boolean;
  priority?: number;
  expires_at?: string | null;
  language?: string;
}

const DEFAULT_KB: KBEntry = {
  title: '', category: 'Product', content: '', keywords: [], is_active: true, priority: 0, expires_at: null, language: 'en',
};

const INDUSTRY_TEMPLATES: Array<{ name: string; icon: string; entries: Array<{ title: string; category: string; content: string; keywords: string[] }> }> = [
  {
    name: 'Trading & Forex',
    icon: '📈',
    entries: [
      {
        title: 'Premium TradingView Indicator',
        category: 'Product',
        content: 'Our Premium TradingView Indicator is a proprietary technical analysis tool for forex, crypto, and stock traders. Features: 1) Auto buy/sell arrows with 85%+ accuracy, 2) Multi-timeframe trend confirmation, 3) Dynamic support/resistance zones, 4) Risk management with stop-loss/take-profit, 5) Mobile + desktop alerts. Works on all timeframes and asset classes. Compatible with free TradingView. Setup in 5 minutes with included video tutorial.',
        keywords: ['tradingview', 'indicator', 'premium', 'signals', 'buy sell', 'technical analysis', 'chart', 'trading tool'],
      },
      {
        title: 'Algo Trading System',
        category: 'Product',
        content: 'Our Algo Trading System automates trading strategies via broker API. Features: 1) Fully automated 24/7 execution, 2) No-code strategy builder, 3) 5+ years backtesting, 4) Risk management with daily loss limits, 5) Multi-asset (forex, crypto, stocks, commodities), 6) Real-time dashboard, 7) MT4/MT5/cTrader integration. Cloud-based — trades even when your PC is off. Min capital: $500. Full setup assistance included.',
        keywords: ['algo trading', 'algorithmic', 'automated trading', 'bot', 'auto trading', 'strategy', 'mt4', 'mt5', 'metatrader', 'execution'],
      },
      {
        title: 'Pricing & Plans',
        category: 'Pricing',
        content: 'TradingView Indicator: $97/mo or $797/yr. Algo System: $197/mo or $1,497/yr. Bundle: $247/mo or $1,997/yr. All plans: email support, video tutorials, setup guide, free updates. Yearly: priority support + 1-on-1 onboarding. 7-day money-back guarantee. Payment: UPI, card, PayPal.',
        keywords: ['price', 'pricing', 'cost', 'plan', 'subscription', 'how much', 'fee', 'monthly', 'yearly', 'payment'],
      },
      {
        title: 'Account Opening Process',
        category: 'How it works',
        content: 'To open a trading account: 1) Complete the signup form on our website, 2) Verify your email, 3) Upload KYC documents (ID proof, address proof, photo), 4) Account approved within 24 hours, 5) Fund your account via UPI/bank transfer/card, 6) Start trading. Need help? Contact support.',
        keywords: ['account', 'open account', 'signup', 'register', 'kyc', 'verification', 'new account', 'open trading account'],
      },
      {
        title: 'Risk Disclosure',
        category: 'Policy',
        content: 'Trading involves substantial risk of loss. Past performance is not indicative of future results. Only trade with capital you can afford to lose. Leverage can work against you as well as for you. We are not financial advisors — all trading decisions are your responsibility. Please read our full risk disclosure before subscribing.',
        keywords: ['risk', 'disclaimer', 'disclosure', 'warning', 'loss', 'leverage', 'financial advice'],
      },
    ],
  },
  {
    name: 'CRM & SaaS',
    icon: '⚙️',
    entries: [
      {
        title: 'CRM Platform Overview',
        category: 'Product',
        content: 'Our CRM platform includes lead management, WhatsApp/Telegram integration, email broadcasting, pipeline tracking, team collaboration, analytics dashboard, and AI auto-reply. Designed for trading businesses, brokers, and financial service providers. Web-based — access from any device.',
        keywords: ['crm', 'platform', 'features', 'lead management', 'pipeline', 'dashboard'],
      },
      {
        title: 'Subscription Plans',
        category: 'Pricing',
        content: 'Starter: $29/mo — up to 500 leads, 1 user, WhatsApp integration. Pro: $79/mo — unlimited leads, 5 users, all integrations, AI auto-reply. Enterprise: $199/mo — unlimited everything, priority support, custom branding. 14-day free trial. Cancel anytime.',
        keywords: ['price', 'plan', 'subscription', 'cost', 'trial', 'starter', 'pro', 'enterprise'],
      },
    ],
  },
];

export default function AIKnowledgeBase({ session }: { session: Session | null }) {
  const [kbEntries, setKbEntries] = useState<KBEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKb, setEditingKb] = useState<KBEntry | null>(null);
  const [keywordInput, setKeywordInput] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlGenerating, setUrlGenerating] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkImporting, setBulkImporting] = useState(false);

  // Testing panel state
  const [testMessage, setTestMessage] = useState('');
  const [testReply, setTestReply] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testMeta, setTestMeta] = useState<{ used_kb: boolean; kb_entries: string[]; language: string; sentiment: string } | null>(null);
  const testAbortRef = useRef<AbortController | null>(null);

  const fetchKb = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('ai_knowledge_base')
        .select('*')
        .eq('user_id', session.user.id)
        .order('priority', { ascending: false });
      if (err) throw err;
      setKbEntries((data || []) as KBEntry[]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load knowledge base';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  const [fetched, setFetched] = useState(false);
  if (!fetched) { setFetched(true); fetchKb(); }

  const handleSaveKb = async () => {
    if (!session?.user?.id || !editingKb) return;
    if (!editingKb.title.trim() || !editingKb.content.trim()) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...editingKb,
        priority: editingKb.priority ?? 0,
        expires_at: editingKb.expires_at || null,
        language: editingKb.language || 'en',
      };
      if (editingKb.id) {
        const { error: err } = await supabase.from('ai_knowledge_base').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingKb.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('ai_knowledge_base').insert({ ...payload, user_id: session.user.id });
        if (err) throw err;
      }
      setEditingKb(null);
      setKeywordInput('');
      fetchKb();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteKb = async (id: string) => {
    try {
      const { error: err } = await supabase.from('ai_knowledge_base').delete().eq('id', id);
      if (err) throw err;
      fetchKb();
    } catch { /* best effort */ }
  };

  const handleToggleActive = async (entry: KBEntry) => {
    try {
      const { error: err } = await supabase.from('ai_knowledge_base').update({ is_active: !entry.is_active, updated_at: new Date().toISOString() }).eq('id', entry.id!);
      if (err) throw err;
      fetchKb();
    } catch { /* best effort */ }
  };

  const handleAddKeyword = () => {
    if (!keywordInput.trim() || !editingKb) return;
    const kw = keywordInput.trim().toLowerCase();
    if (!editingKb.keywords.includes(kw)) setEditingKb({ ...editingKb, keywords: [...editingKb.keywords, kw] });
    setKeywordInput('');
  };

  const handleTestReply = async () => {
    if (!testMessage.trim() || !session?.user?.id) return;
    setTestLoading(true);
    setTestReply('');
    setTestMeta(null);
    setError('');
    testAbortRef.current = new AbortController();
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-reply`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ user_id: session.user.id, platform: 'test', conversation_id: '', incoming_text: testMessage, test_mode: true }),
        signal: testAbortRef.current.signal,
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setTestReply(data.reply || 'No reply generated');
      setTestMeta(data.meta || null);
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return;
      const msg = e instanceof Error ? e.message : 'Test failed';
      setError(msg);
    } finally {
      setTestLoading(false);
    }
  };

  const handleUrlGenerate = async () => {
    if (!urlInput.trim() || !session?.user?.id) return;
    setUrlGenerating(true);
    setError('');
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-generate-kb`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ user_id: session.user.id, url: urlInput.trim() }),
      });
      if (!res.ok) {
        const ed = await res.json().catch(() => ({}));
        throw new Error(ed.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      if (data.entry) {
        setEditingKb({ ...DEFAULT_KB, title: data.entry.title, category: data.entry.category || 'Product', content: data.entry.content, keywords: data.entry.keywords || [] });
        setUrlInput('');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to generate from URL';
      setError(msg);
    } finally {
      setUrlGenerating(false);
    }
  };

  const handleBulkImport = async () => {
    if (!bulkText.trim() || !session?.user?.id) return;
    setBulkImporting(true);
    setError('');
    try {
      const lines = bulkText.trim().split('\n').filter((l) => l.trim());
      const entries: Array<{ title: string; category: string; content: string; keywords: string[]; is_active: boolean; user_id: string }> = [];
      let current: { title?: string; category?: string; content?: string; keywords?: string[] } = {};
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.toLowerCase().startsWith('title:')) { if (current.title) { entries.push({ title: current.title, category: current.category || 'Product', content: current.content || '', keywords: current.keywords || [], is_active: true, user_id: session.user.id }); } current = { title: trimmed.slice(6).trim() }; }
        else if (trimmed.toLowerCase().startsWith('category:')) current.category = trimmed.slice(9).trim();
        else if (trimmed.toLowerCase().startsWith('keywords:')) current.keywords = trimmed.slice(9).split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);
        else if (trimmed.toLowerCase().startsWith('content:')) current.content = trimmed.slice(8).trim();
        else if (current.title && current.content !== undefined) current.content += ' ' + trimmed;
      }
      if (current.title && current.content) entries.push({ title: current.title, category: current.category || 'Product', content: current.content, keywords: current.keywords || [], is_active: true, user_id: session.user.id });
      if (entries.length === 0) { setError('No valid entries found. Use format: Title:, Category:, Keywords:, Content:'); return; }
      const { error: err } = await supabase.from('ai_knowledge_base').insert(entries);
      if (err) throw err;
      setBulkText('');
      setBulkOpen(false);
      fetchKb();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Import failed';
      setError(msg);
    } finally {
      setBulkImporting(false);
    }
  };

  const handleAddTemplatePack = async (pack: typeof INDUSTRY_TEMPLATES[0]) => {
    if (!session?.user?.id) return;
    try {
      const rows = pack.entries.map((e) => ({ ...e, is_active: true, priority: 0, language: 'en', user_id: session.user.id }));
      const { error: err } = await supabase.from('ai_knowledge_base').insert(rows);
      if (err) throw err;
      setShowTemplates(false);
      fetchKb();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to import template pack';
      setError(msg);
    }
  };

  if (loading) {
    return <div style={{ padding: '48px', textAlign: 'center' }}><Loader2 size={24} className="crm-spin" /></div>;
  }

  return (
    <div>
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', marginBottom: '16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', color: '#dc2626', fontSize: '0.825rem' }}>
          <AlertTriangle size={16} /> {error}
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', color: '#dc2626' }}><X size={16} /></button>
        </div>
      )}

      {/* AI Reply Testing Panel */}
      <div className="crm-table-card" style={{ padding: '20px 24px', marginBottom: '20px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 600, marginBottom: '6px' }}>
          <FlaskRound size={18} style={{ color: '#7c3aed' }} /> AI Reply Tester
        </h3>
        <p style={{ fontSize: '0.825rem', color: 'var(--text-muted, #64748b)', margin: '0 0 14px' }}>
          Type a sample customer message and see exactly what the AI would reply. Tests your current settings and knowledge base without sending to a real customer.
        </p>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <input type="text" value={testMessage} onChange={(e) => setTestMessage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !testLoading) handleTestReply(); }} placeholder="e.g. What is the price of your premium indicator?" style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border, #e2e8f0)', background: 'var(--bg-input, #fff)', fontSize: '0.875rem' }} />
          <button onClick={handleTestReply} disabled={testLoading || !testMessage.trim()} style={{ padding: '0 18px', borderRadius: '10px', border: 'none', background: '#7c3aed', color: '#fff', cursor: testLoading ? 'not-allowed' : 'pointer', fontSize: '0.825rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', opacity: testLoading || !testMessage.trim() ? 0.5 : 1, whiteSpace: 'nowrap' }}>
            {testLoading ? <Loader2 size={16} className="crm-spin" /> : <Send size={16} />} Test
          </button>
        </div>
        {testReply && (
          <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(124,58,237,0.04)', border: '1px solid rgba(124,58,237,0.15)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#7c3aed', marginBottom: '8px' }}>AI Response:</div>
            <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{testReply}</p>
            {testMeta && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                <span style={{ fontSize: '0.68rem', padding: '3px 10px', borderRadius: '20px', background: testMeta.used_kb ? 'rgba(34,197,94,0.1)' : 'rgba(148,163,184,0.1)', color: testMeta.used_kb ? '#16a34a' : '#94a3b8', fontWeight: 600 }}>
                  {testMeta.used_kb ? `KB used: ${testMeta.kb_entries.join(', ')}` : 'No KB match'}
                </span>
                <span style={{ fontSize: '0.68rem', padding: '3px 10px', borderRadius: '20px', background: 'rgba(37,99,235,0.08)', color: '#2563eb', fontWeight: 600 }}>Lang: {testMeta.language}</span>
                <span style={{ fontSize: '0.68rem', padding: '3px 10px', borderRadius: '20px', background: testMeta.sentiment === 'negative' ? 'rgba(239,68,68,0.08)' : testMeta.sentiment === 'positive' ? 'rgba(34,197,94,0.08)' : 'rgba(148,163,184,0.1)', color: testMeta.sentiment === 'negative' ? '#dc2626' : testMeta.sentiment === 'positive' ? '#16a34a' : '#94a3b8', fontWeight: 600 }}>
                  Sentiment: {testMeta.sentiment}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Generate from URL */}
      <div className="crm-table-card" style={{ padding: '20px 24px', marginBottom: '20px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 600, marginBottom: '6px' }}>
          <Link2 size={18} style={{ color: '#2563eb' }} /> Generate from URL
        </h3>
        <p style={{ fontSize: '0.825rem', color: 'var(--text-muted, #64748b)', margin: '0 0 14px' }}>
          Paste a link to your product page, pricing page, or FAQ. The AI reads the page and creates a knowledge entry automatically.
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input type="url" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://yoursite.com/pricing" style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border, #e2e8f0)', background: 'var(--bg-input, #fff)', fontSize: '0.875rem' }} />
          <button onClick={handleUrlGenerate} disabled={urlGenerating || !urlInput.trim()} style={{ padding: '0 18px', borderRadius: '10px', border: 'none', background: '#2563eb', color: '#fff', cursor: urlGenerating ? 'not-allowed' : 'pointer', fontSize: '0.825rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', opacity: urlGenerating || !urlInput.trim() ? 0.5 : 1, whiteSpace: 'nowrap' }}>
            {urlGenerating ? <Loader2 size={16} className="crm-spin" /> : <ArrowRight size={16} />} Generate
          </button>
        </div>
      </div>

      {/* Action buttons row */}
      {!editingKb && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <button onClick={() => { setEditingKb({ ...DEFAULT_KB }); setKeywordInput(''); }} style={{ flex: 1, minWidth: '140px', padding: '10px 16px', borderRadius: '10px', border: '2px solid #2563eb', background: 'rgba(37,99,235,0.06)', color: '#2563eb', cursor: 'pointer', fontSize: '0.825rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <Plus size={16} /> Add Entry
          </button>
          <button onClick={() => setShowTemplates(!showTemplates)} style={{ flex: 1, minWidth: '140px', padding: '10px 16px', borderRadius: '10px', border: '2px solid #f59e0b', background: 'rgba(245,158,11,0.06)', color: '#f59e0b', cursor: 'pointer', fontSize: '0.825rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <Package size={16} /> Templates
          </button>
          <button onClick={() => setBulkOpen(!bulkOpen)} style={{ flex: 1, minWidth: '140px', padding: '10px 16px', borderRadius: '10px', border: '2px solid var(--border, #e2e8f0)', background: 'transparent', cursor: 'pointer', fontSize: '0.825rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <FileSpreadsheet size={16} /> Bulk Import
          </button>
        </div>
      )}

      {/* Industry templates */}
      {showTemplates && !editingKb && (
        <div className="crm-table-card" style={{ padding: '20px 24px', marginBottom: '20px', borderColor: '#f59e0b' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 600, margin: 0 }}>
              <Package size={18} style={{ color: '#f59e0b' }} /> Industry Template Packs
            </h3>
            <button onClick={() => setShowTemplates(false)} style={{ padding: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted, #64748b)' }}><X size={18} /></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {INDUSTRY_TEMPLATES.map((pack) => (
              <div key={pack.name} style={{ padding: '14px', borderRadius: '10px', border: '1px solid var(--border, #e2e8f0)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{pack.icon} {pack.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>{pack.entries.length} knowledge entries</div>
                </div>
                <button onClick={() => handleAddTemplatePack(pack)} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#f59e0b', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  Add All
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bulk import */}
      {bulkOpen && !editingKb && (
        <div className="crm-table-card" style={{ padding: '20px 24px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 600, margin: 0 }}>
              <FileSpreadsheet size={18} /> Bulk Import
            </h3>
            <button onClick={() => setBulkOpen(false)} style={{ padding: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted, #64748b)' }}><X size={18} /></button>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748b)', marginBottom: '10px' }}>
            Paste entries in this format (one block per entry):
          </p>
          <pre style={{ fontSize: '0.72rem', background: 'rgba(148,163,184,0.08)', padding: '10px', borderRadius: '8px', overflow: 'auto', margin: '0 0 12px', color: 'var(--text-muted, #64748b)' }}>
{`Title: Premium Indicator
Category: Product
Keywords: tradingview, indicator, signals
Content: Our premium indicator provides...
---
Title: Algo Trading
Category: Product
Keywords: algo, automated, bot
Content: Our algo trading system...`}
          </pre>
          <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={8} placeholder="Paste your entries here..." style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border, #e2e8f0)', background: 'var(--bg-input, #fff)', fontSize: '0.825rem', resize: 'vertical', fontFamily: 'monospace', lineHeight: 1.5 }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button onClick={handleBulkImport} disabled={bulkImporting || !bulkText.trim()} style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#fff', cursor: bulkImporting ? 'not-allowed' : 'pointer', fontSize: '0.825rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', opacity: bulkImporting || !bulkText.trim() ? 0.5 : 1 }}>
              {bulkImporting ? <Loader2 size={16} className="crm-spin" /> : <Save size={16} />} Import
            </button>
          </div>
        </div>
      )}

      {/* KB entries list */}
      {!editingKb && (
        <div className="crm-table-card" style={{ padding: '20px 24px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>
            <BookOpen size={18} /> Knowledge Entries ({kbEntries.length})
          </h3>
          {kbEntries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <Lightbulb size={32} style={{ color: '#f59e0b', marginBottom: '12px' }} />
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted, #64748b)', margin: 0 }}>
                No knowledge entries yet. Add one manually, generate from a URL, or use a template pack to get started.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {kbEntries.map((entry) => (
                <div key={entry.id} style={{ padding: '14px', borderRadius: '10px', border: '1px solid var(--border, #e2e8f0)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', opacity: entry.is_active ? 1 : 0.55 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{entry.title}</span>
                      <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '20px', background: 'rgba(37,99,235,0.08)', color: '#2563eb', fontWeight: 600 }}>{entry.category}</span>
                      {entry.priority ? <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '20px', background: 'rgba(245,158,11,0.08)', color: '#f59e0b', fontWeight: 600 }}>P{entry.priority}</span> : null}
                      {!entry.is_active && <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '20px', background: 'rgba(148,163,184,0.15)', color: '#94a3b8', fontWeight: 600 }}>Inactive</span>}
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748b)', margin: '0 0 6px', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.content.slice(0, 120)}{entry.content.length > 120 ? '...' : ''}
                    </p>
                    {entry.keywords.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {entry.keywords.slice(0, 5).map((kw) => (
                          <span key={kw} style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '6px', background: 'rgba(148,163,184,0.1)', color: '#64748b' }}>{kw}</span>
                        ))}
                        {entry.keywords.length > 5 && <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>+{entry.keywords.length - 5}</span>}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                    <button onClick={() => { setEditingKb({ ...entry }); setKeywordInput(''); }} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border, #e2e8f0)', background: 'transparent', cursor: 'pointer', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                      <Pencil size={12} /> Edit
                    </button>
                    <button onClick={() => handleToggleActive(entry)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border, #e2e8f0)', background: 'transparent', cursor: 'pointer', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                      {entry.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button onClick={() => entry.id && handleDeleteKb(entry.id)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.04)', color: '#dc2626', cursor: 'pointer', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit/Create form */}
      {editingKb && (
        <div className="crm-table-card" style={{ padding: '20px 24px', borderColor: '#2563eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{editingKb.id ? 'Edit Knowledge Entry' : 'New Knowledge Entry'}</span>
            <button onClick={() => { setEditingKb(null); setKeywordInput(''); }} style={{ padding: '4px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted, #64748b)' }}><X size={18} /></button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Title</label>
              <input type="text" value={editingKb.title} onChange={(e) => setEditingKb({ ...editingKb, title: e.target.value })} placeholder="e.g. Premium Indicator" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border, #e2e8f0)', background: 'var(--bg-input, #fff)', fontSize: '0.825rem' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Category</label>
              <select value={editingKb.category} onChange={(e) => setEditingKb({ ...editingKb, category: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border, #e2e8f0)', background: 'var(--bg-input, #fff)', fontSize: '0.825rem' }}>
                {KB_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Priority (0-10)</label>
              <input type="number" min={0} max={10} value={editingKb.priority ?? 0} onChange={(e) => setEditingKb({ ...editingKb, priority: parseInt(e.target.value, 10) || 0 })} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border, #e2e8f0)', background: 'var(--bg-input, #fff)', fontSize: '0.825rem' }} />
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Content — What the AI should know</label>
            <textarea value={editingKb.content} onChange={(e) => setEditingKb({ ...editingKb, content: e.target.value })} rows={8} placeholder="Describe the product, feature, or answer in detail..." style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border, #e2e8f0)', background: 'var(--bg-input, #fff)', fontSize: '0.825rem', resize: 'vertical', lineHeight: 1.6 }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Language Code</label>
              <input type="text" value={editingKb.language || 'en'} onChange={(e) => setEditingKb({ ...editingKb, language: e.target.value })} placeholder="en, hi, es, etc." style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border, #e2e8f0)', background: 'var(--bg-input, #fff)', fontSize: '0.825rem' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Expires At (optional)</label>
              <input type="datetime-local" value={editingKb.expires_at ? editingKb.expires_at.slice(0, 16) : ''} onChange={(e) => setEditingKb({ ...editingKb, expires_at: e.target.value ? new Date(e.target.value).toISOString() : null })} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border, #e2e8f0)', background: 'var(--bg-input, #fff)', fontSize: '0.825rem' }} />
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Keywords — Trigger words for this entry</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input type="text" value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddKeyword(); } }} placeholder="Type a keyword and press Enter" style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border, #e2e8f0)', background: 'var(--bg-input, #fff)', fontSize: '0.825rem' }} />
              <button onClick={handleAddKeyword} style={{ padding: '0 14px', borderRadius: '8px', border: '1px solid var(--border, #e2e8f0)', background: 'transparent', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>Add</button>
            </div>
            {editingKb.keywords.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {editingKb.keywords.map((kw) => (
                  <span key={kw} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '20px', background: 'rgba(37,99,235,0.08)', color: '#2563eb' }}>
                    {kw}
                    <button onClick={() => setEditingKb({ ...editingKb, keywords: editingKb.keywords.filter((k) => k !== kw) })} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'flex', color: '#2563eb' }}><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={() => { setEditingKb(null); setKeywordInput(''); }} style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid var(--border, #e2e8f0)', background: 'transparent', cursor: 'pointer', fontSize: '0.825rem', fontWeight: 600 }}>Cancel</button>
            <button onClick={handleSaveKb} disabled={saving || !editingKb.title.trim() || !editingKb.content.trim()} style={{ padding: '9px 22px', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.825rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', opacity: saving ? 0.6 : 1 }}>
              {saving ? <Loader2 size={16} className="crm-spin" /> : <Save size={16} />} {editingKb.id ? 'Update' : 'Save'} Entry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
