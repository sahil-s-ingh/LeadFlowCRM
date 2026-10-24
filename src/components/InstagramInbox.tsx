import { useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft, Send, Loader2, Instagram, Settings as SettingsIcon, X,
  CheckCircle2, AlertCircle, MessageCircle, RefreshCw, ExternalLink,
} from 'lucide-react';

interface IgSettings {
  id: string;
  ig_user_id: string | null;
  page_id: string | null;
  page_access_token: string | null;
  connected_username: string | null;
  welcome_message: string;
  is_active: boolean;
}

interface IgConversation {
  id: string;
  ig_sender_id: string;
  sender_username: string | null;
  sender_name: string | null;
  sender_profile_pic: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
  unread_count: number;
}

interface IgMessage {
  id: string;
  sender: 'admin' | 'client';
  message_type: string;
  text_content: string | null;
  media_url: string | null;
  delivery_status: string | null;
  created_at: string;
}

interface Props {
  session: Session;
  onBack: () => void;
  onUnreadChange?: (n: number) => void;
  refreshKey?: number;
  onRefresh?: () => void;
}

export default function InstagramInbox({ session, onBack, onUnreadChange, refreshKey, onRefresh }: Props) {
  const [settings, setSettings] = useState<IgSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [showSetup, setShowSetup] = useState(false);

  // Setup form
  const [igUserId, setIgUserId] = useState('');
  const [pageId, setPageId] = useState('');
  const [pageToken, setPageToken] = useState('');
  const [username, setUsername] = useState('');
  const [welcome, setWelcome] = useState('Hi! Thanks for reaching out. Our team will get back to you shortly.');
  const [saving, setSaving] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [setupSuccess, setSetupSuccess] = useState(false);

  // Conversations
  const [conversations, setConversations] = useState<IgConversation[]>([]);
  const [convLoading, setConvLoading] = useState(true);
  const [selectedConv, setSelectedConv] = useState<IgConversation | null>(null);
  const [messages, setMessages] = useState<IgMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const fetchSettings = useCallback(async () => {
    setLoadingSettings(true);
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) { setLoadingSettings(false); return; }

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-instagram-message`,
      { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'get_settings' }) },
    );
    const data = await res.json();
    if (data.settings) {
      setSettings(data.settings);
    }
    setLoadingSettings(false);
  }, []);

  const fetchConversations = useCallback(async () => {
    setConvLoading(true);
    const { data, error: err } = await supabase
      .from('ig_conversations')
      .select('*')
      .order('last_message_at', { ascending: false, nullsFirst: false });
    if (err) {
      setError(err.message);
    } else {
      setConversations(data || []);
    }
    setConvLoading(false);
  }, []);

  // Report unread count to parent (Shared Inbox)
  useEffect(() => {
    if (onUnreadChange) {
      onUnreadChange(conversations.reduce((sum, c) => sum + c.unread_count, 0));
    }
  }, [conversations, onUnreadChange]);

  // External refresh trigger (from Shared Inbox refresh button)
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0) {
      fetchConversations();
    }
  }, [refreshKey, fetchConversations]);

  useEffect(() => {
    fetchSettings();
    fetchConversations();
  }, [fetchSettings, fetchConversations]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('ig-inbox-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ig_conversations' }, () => fetchConversations())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ig_messages' }, (payload) => {
        if (selectedConv && (payload.new as IgMessage).conversation_id === selectedConv.id) {
          setMessages((prev) => [...prev, payload.new as IgMessage]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchConversations, selectedConv]);

  const fetchMessages = async (convId: string) => {
    setMsgLoading(true);
    const { data } = await supabase
      .from('ig_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setMsgLoading(false);
  };

  const openConversation = async (conv: IgConversation) => {
    setSelectedConv(conv);
    fetchMessages(conv.id);
    if (conv.unread_count > 0) {
      await supabase.from('ig_conversations').update({ unread_count: 0 }).eq('id', conv.id);
      setConversations((prev) => prev.map((c) => c.id === conv.id ? { ...c, unread_count: 0 } : c));
    }
  };

  const handleSaveSettings = async () => {
    if (!igUserId.trim() || !pageId.trim() || !pageToken.trim()) {
      setSetupError('Instagram User ID, Page ID, and Page Access Token are required.');
      return;
    }
    setSaving(true);
    setSetupError('');
    setSetupSuccess(false);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) { setSetupError('Not authenticated'); setSaving(false); return; }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-instagram-message`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            action: 'save_settings',
            igUserId: igUserId.trim(),
            pageId: pageId.trim(),
            pageAccessToken: pageToken.trim(),
            connectedUsername: username.trim() || undefined,
            welcomeMessage: welcome.trim() || undefined,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok || data.error) {
        setSetupError(data.error || 'Failed to save settings');
        setSaving(false);
        return;
      }
      setSetupSuccess(true);
      setSaving(false);
      await fetchSettings();
      setTimeout(() => { setShowSetup(false); setSetupSuccess(false); }, 1500);
    } catch {
      setSetupError('Failed to save settings');
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect your Instagram account? Your conversation history will be kept.')) return;
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return;
    await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-instagram-message`,
      { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'disconnect' }) },
    );
    setSettings(null);
    setShowSetup(false);
  };

  const handleSend = async () => {
    if (!selectedConv || !messageText.trim()) return;
    setSending(true);
    setError('');
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) { setError('Not authenticated'); setSending(false); return; }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-instagram-message`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'send_message', conversationId: selectedConv.id, text: messageText.trim() }),
        },
      );
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Failed to send message');
        setSending(false);
        return;
      }
      setMessageText('');
      setMessages((prev) => [...prev, data.message]);
      setConversations((prev) => prev.map((c) => c.id === selectedConv.id ? { ...c, last_message_text: messageText.trim(), last_message_at: new Date().toISOString() } : c));
    } catch {
      setError('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (d: string) => new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const formatDate = (d: string | null) => {
    if (!d) return '';
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hrs = diff / 3600000;
    if (hrs < 24) return formatTime(d);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const callApi = async (action: string, extra: Record<string, unknown> = {}) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-instagram-message`,
      { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action, ...extra }) },
    );
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  };

  // ─── Loading state ──────────────────────────────────────────
  if (loadingSettings) {
    return (
      <div className="dash-overview" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <Loader2 size={28} className="crm-spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    );
  }

  // ─── Setup modal ────────────────────────────────────────────
  const renderSetupModal = () => {
    if (!showSetup) return null;
    return (
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        onClick={() => setShowSetup(false)}
      >
        <div
          style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '28px', maxWidth: '520px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Instagram size={22} style={{ color: '#E1306C' }} /> Connect Instagram
            </h2>
            <button onClick={() => setShowSetup(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={20} />
            </button>
          </div>

          {setupError && (
            <div style={{ padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', background: 'rgba(239,68,68,0.1)', color: '#dc2626', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} /> {setupError}
            </div>
          )}
          {setupSuccess && (
            <div style={{ padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', background: 'rgba(34,197,94,0.1)', color: '#16a34a', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} /> Instagram connected successfully!
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Instagram User ID <span style={{ color: '#dc2626' }}>*</span></label>
            <input type="text" value={igUserId} onChange={(e) => setIgUserId(e.target.value)} placeholder="e.g. 17841412345678" style={inputStyle} />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Found in Meta Graph API: GET /me/accounts → instagram_business_account → id</p>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Facebook Page ID <span style={{ color: '#dc2626' }}>*</span></label>
            <input type="text" value={pageId} onChange={(e) => setPageId(e.target.value)} placeholder="e.g. 123456789012345" style={inputStyle} />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Page Access Token <span style={{ color: '#dc2626' }}>*</span></label>
            <input type="password" value={pageToken} onChange={(e) => setPageToken(e.target.value)} placeholder="Long-lived Page access token" style={inputStyle} />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Must have instagram_manage_messages permission</p>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Instagram @handle (optional)</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="your_business" style={inputStyle} />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Welcome Message</label>
            <textarea value={welcome} onChange={(e) => setWelcome(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          <div style={{ padding: '12px 14px', borderRadius: '8px', marginBottom: '20px', background: 'rgba(225,48,108,0.06)', border: '1px solid rgba(225,48,108,0.2)', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <AlertCircle size={16} style={{ color: '#E1306C', flexShrink: 0, marginTop: '1px' }} />
            <span>Requires an Instagram Professional account (Creator or Business) linked to a Facebook Page. After saving, set the webhook URL in Meta App settings to <code style={{ fontSize: '0.75rem' }}>/functions/v1/instagram-webhook</code> with verify token "leadcentre".</span>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowSetup(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>Cancel</button>
            <button onClick={handleSaveSettings} disabled={saving} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#E1306C', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
              {saving ? <Loader2 size={16} className="crm-spin" /> : <CheckCircle2 size={16} />} Save & Connect
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─── Not connected state ────────────────────────────────────
  if (!settings) {
    return (
      <div className="dash-overview">
        <div className="dash-page-header">
          <button className="dash-back-btn" onClick={onBack}><ArrowLeft size={18} /> Back</button>
          <h1>Instagram Inbox</h1>
          <p>Manage Instagram DM conversations from your CRM</p>
        </div>

        <div className="crm-empty-state">
          <Instagram size={48} style={{ color: '#E1306C' }} />
          <h3>Instagram not connected</h3>
          <p>Connect your Instagram Professional account to start receiving and replying to DMs directly from your CRM.</p>
          <button onClick={() => setShowSetup(true)} style={{ marginTop: '16px', padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#E1306C', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', fontWeight: 600 }}>
            <SettingsIcon size={16} /> Connect Instagram
          </button>
        </div>

        <div style={{ marginTop: '24px', padding: '20px', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={16} style={{ color: '#E1306C' }} /> Requirements
          </h4>
          <ul style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, paddingLeft: '20px', margin: 0 }}>
            <li>An Instagram Professional account (Creator or Business)</li>
            <li>A Facebook Page connected to that Instagram account</li>
            <li>A Meta App with the <code>instagram_manage_messages</code> permission</li>
            <li>A long-lived Page access token</li>
          </ul>
          <a href="https://developers.facebook.com/documentation/business-messaging/instagram-messaging/get-started/" target="_blank" rel="noopener noreferrer" style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: '#3b82f6', fontWeight: 600, textDecoration: 'none' }}>
            Setup Guide <ExternalLink size={14} />
          </a>
        </div>

        {renderSetupModal()}
      </div>
    );
  }

  // ─── Connected: inbox view ──────────────────────────────────
  return (
    <div className="dash-overview">
      <div className="dash-page-header">
        <button className="dash-back-btn" onClick={onBack}><ArrowLeft size={18} /> Back</button>
        <h1>Instagram Inbox</h1>
        <p style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Instagram size={14} style={{ color: '#E1306C' }} />
          @{settings.connected_username || 'connected'} · {conversations.length} conversations
        </p>
      </div>

      {error && <div className="crm-error-banner" style={{ marginBottom: '16px' }}>{error}</div>}

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
        <button onClick={() => { fetchConversations(); onRefresh?.(); }} className="crm-btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={16} /> Refresh
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Webhook URL: <code>{import.meta.env.VITE_SUPABASE_URL}/functions/v1/instagram-webhook</code>
        </span>
        <button onClick={() => setShowSetup(true)} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
          <SettingsIcon size={14} /> Settings
        </button>
      </div>

      {/* Inbox layout */}
      <div style={{ display: 'flex', gap: '16px', height: 'calc(100vh - 240px)', minHeight: '400px' }}>
        {/* Conversation list */}
        <div style={{ width: '320px', flexShrink: 0, background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageCircle size={18} style={{ color: '#E1306C' }} />
            <strong style={{ fontSize: '0.9rem' }}>Conversations</strong>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {convLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Loader2 size={24} className="crm-spin" style={{ color: 'var(--text-muted)' }} />
              </div>
            ) : conversations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                <MessageCircle size={36} style={{ opacity: 0.3, marginBottom: '8px' }} />
                <p style={{ fontSize: '0.85rem' }}>No conversations yet. Instagram DMs will appear here.</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => openConversation(conv)}
                  style={{
                    padding: '12px 16px', borderBottom: '1px solid var(--border-light)', cursor: 'pointer',
                    background: selectedConv?.id === conv.id ? 'rgba(225,48,108,0.06)' : 'transparent',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => { if (selectedConv?.id !== conv.id) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                  onMouseLeave={(e) => { if (selectedConv?.id !== conv.id) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                      background: 'rgba(225,48,108,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.85rem', fontWeight: 700, color: '#E1306C',
                      backgroundImage: conv.sender_profile_pic ? `url(${conv.sender_profile_pic})` : undefined,
                      backgroundSize: 'cover', backgroundPosition: 'center',
                    }}>
                      {!conv.sender_profile_pic && (conv.sender_username?.[0]?.toUpperCase() || '?')}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {conv.sender_name || conv.sender_username || 'Unknown'}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0 }}>{formatDate(conv.last_message_at)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {conv.last_message_text || 'No messages'}
                        </span>
                        {conv.unread_count > 0 && (
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#fff', background: '#E1306C', borderRadius: '10px', padding: '1px 7px', flexShrink: 0 }}>
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat area */}
        <div style={{ flex: 1, background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!selectedConv ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <Instagram size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <p style={{ fontSize: '0.9rem' }}>Select a conversation to view messages</p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(225,48,108,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#E1306C' }}>
                  {selectedConv.sender_username?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <strong style={{ fontSize: '0.9rem' }}>{selectedConv.sender_name || selectedConv.sender_username || 'Unknown'}</strong>
                  {selectedConv.sender_username && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{selectedConv.sender_username}</div>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {msgLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <Loader2 size={24} className="crm-spin" style={{ color: 'var(--text-muted)' }} />
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    <MessageCircle size={36} style={{ opacity: 0.3, marginBottom: '8px' }} />
                    <p style={{ fontSize: '0.85rem' }}>No messages yet</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} style={{ display: 'flex', flexDirection: msg.sender === 'admin' ? 'row-reverse' : 'row', gap: '8px' }}>
                      <div style={{
                        maxWidth: '70%',
                        background: msg.sender === 'admin' ? '#E1306C' : 'var(--bg-secondary)',
                        color: msg.sender === 'admin' ? '#fff' : 'var(--text-primary)',
                        borderRadius: msg.sender === 'admin' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                        padding: '10px 14px',
                      }}>
                        {msg.media_url && msg.message_type !== 'text' && (
                          <div style={{ marginBottom: msg.text_content ? '6px' : 0 }}>
                            {msg.message_type === 'image' && <img src={msg.media_url} alt="" style={{ maxWidth: '100%', borderRadius: '8px' }} />}
                            {msg.message_type === 'video' && <video src={msg.media_url} controls style={{ maxWidth: '100%', borderRadius: '8px' }} />}
                            {msg.message_type === 'audio' && <audio src={msg.media_url} controls style={{ width: '100%' }} />}
                          </div>
                        )}
                        <div style={{ fontSize: '0.875rem', lineHeight: 1.4 }}>{msg.text_content || `[${msg.message_type}]`}</div>
                        <div style={{ fontSize: '0.7rem', marginTop: '4px', opacity: 0.7, textAlign: msg.sender === 'admin' ? 'right' : 'left' }}>
                          {formatTime(msg.created_at)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Send bar */}
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-light)', display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Type a reply..."
                  style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none' }}
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !messageText.trim()}
                  style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#E1306C', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', fontWeight: 600, opacity: sending || !messageText.trim() ? 0.5 : 1 }}
                >
                  {sending ? <Loader2 size={16} className="crm-spin" /> : <Send size={16} />} Send
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {renderSetupModal()}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: '8px',
  border: '1px solid var(--border-light)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  fontSize: '0.875rem',
  outline: 'none',
};
