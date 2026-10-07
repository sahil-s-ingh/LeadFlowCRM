import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import {
  Loader2, RefreshCw, Mail, Trash2, Send, AlertTriangle,
  Paperclip, ArrowLeft, Inbox,
} from 'lucide-react';

type EmailConversation = {
  id: string;
  from_email: string;
  from_name: string | null;
  subject: string;
  last_message_text: string | null;
  last_message_at: string | null;
  unread_count: number;
  lead_id: string | null;
  created_at: string;
};

type EmailMessage = {
  id: string;
  conversation_id: string;
  from_email: string;
  from_name: string | null;
  to_email: string;
  subject: string;
  body_text: string;
  body_html: string | null;
  direction: 'incoming' | 'outgoing';
  message_id: string | null;
  is_read: boolean;
  has_attachments: boolean;
  attachments: Array<{ filename: string; contentType: string; size: number }>;
  created_at: string;
};

export default function EmailInbox({ session, onUnreadChange, refreshKey, onRefresh }: {
  session: Session;
  onUnreadChange: (count: number) => void;
  refreshKey: number;
  onRefresh: () => void;
}) {
  const [conversations, setConversations] = useState<EmailConversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [imapConfigured, setImapConfigured] = useState<boolean | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const getToken = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData.session?.access_token;
  };

  const fetchConversations = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('email_inbox_conversations')
      .select('*')
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (fetchError) return;
    setConversations((data || []) as EmailConversation[]);
    const totalUnread = (data || []).reduce((sum, c) => sum + c.unread_count, 0);
    onUnreadChange(totalUnread);
    setLoading(false);
  }, [onUnreadChange]);

  const checkImapConfig = useCallback(async () => {
    const { data } = await supabase
      .from('smtp_settings')
      .select('imap_host, imap_username, imap_password')
      .maybeSingle();
    setImapConfigured(Boolean(data?.imap_host && data?.imap_username && data?.imap_password));
  }, []);

  useEffect(() => {
    fetchConversations();
    checkImapConfig();
  }, [fetchConversations, checkImapConfig, refreshKey]);

  // Realtime: subscribe to conversation list updates
  useEffect(() => {
    const channel = supabase
      .channel('email_inbox_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'email_inbox_conversations' },
        () => { fetchConversations(); },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'email_inbox_messages' },
        () => { fetchConversations(); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchConversations]);

  // Load messages when a conversation is selected
  useEffect(() => {
    if (!selectedConv) return;
    setLoadingMessages(true);
    (async () => {
      const { data, error: fetchError } = await supabase
        .from('email_inbox_messages')
        .select('*')
        .eq('conversation_id', selectedConv)
        .order('created_at', { ascending: true });

      if (!fetchError && data) {
        setMessages(data as EmailMessage[]);
      }
      setLoadingMessages(false);

      // Mark as read
      const token = await getToken();
      if (token) {
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-inbox?action=mark_read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ conversation_id: selectedConv }),
        });
      }
      fetchConversations();
    })();
  }, [selectedConv, fetchConversations]);

  // Realtime: subscribe to new messages in selected conversation
  useEffect(() => {
    if (!selectedConv) return;
    const channel = supabase
      .channel(`email_inbox_messages:${selectedConv}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'email_inbox_messages', filter: `conversation_id=eq.${selectedConv}` },
        (payload) => {
          setMessages((prev) => {
            const newMsg = payload.new as EmailMessage;
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedConv]);

  const handleFetchEmails = async () => {
    setFetching(true);
    setError('');
    try {
      const token = await getToken();
      if (!token) return;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-inbox?action=fetch`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Failed to fetch emails');
        return;
      }
      await fetchConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch emails');
    } finally {
      setFetching(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedConv || sending) return;
    setSending(true);
    setError('');
    try {
      const token = await getToken();
      if (!token) return;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-inbox?action=reply`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversation_id: selectedConv, reply_text: replyText.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Failed to send reply');
        return;
      }
      // Reload messages to show the outgoing email
      const { data: msgs } = await supabase
        .from('email_inbox_messages')
        .select('*')
        .eq('conversation_id', selectedConv)
        .order('created_at', { ascending: true });
      if (msgs) setMessages(msgs as EmailMessage[]);
      setReplyText('');
      fetchConversations();
    } catch {
      setError('Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    setShowDeleteConfirm(null);
    try {
      const token = await getToken();
      if (!token) return;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-inbox?action=delete`;
      const res = await fetch(apiUrl, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversation_id: id }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Failed to delete conversation');
        return;
      }
      if (selectedConv === id) setSelectedConv(null);
      fetchConversations();
    } catch {
      setError('Failed to delete conversation');
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getInitials = (name: string, email: string) => {
    if (name) return name[0]?.toUpperCase() || email[0]?.toUpperCase() || '?';
    return email[0]?.toUpperCase() || '?';
  };

  const selectedConversation = conversations.find((c) => c.id === selectedConv);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <Loader2 size={32} className="crm-spin" style={{ color: '#2563eb' }} />
      </div>
    );
  }

  if (imapConfigured === false) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', textAlign: 'center', padding: '24px' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, #2563eb, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
          <Mail size={32} style={{ color: '#fff' }} />
        </div>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>Email Inbox Not Configured</h2>
        <p style={{ color: '#94a3b8', fontSize: '0.88rem', maxWidth: '400px', lineHeight: 1.6, marginBottom: '20px' }}>
          To use the email inbox, you need to configure IMAP settings in Settings. Add your Hostinger email IMAP host (imap.hostinger.com), port (993), username, and password.
        </p>
      </div>
    );
  }

  return (
    <div className="crm-chat-container tg-theme" style={{ '--tg-gradient': 'linear-gradient(135deg, #2563eb, #3b82f6)' } as React.CSSProperties}>
      {/* Conversation List */}
      <div className={`crm-chat-list ${selectedConv ? 'hidden-mobile' : ''}`}>
        <div className="crm-chat-list-header">
          <div className="crm-chat-list-heading">
            <h2>Email Inbox</h2>
            <span>{conversations.length} conversations</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              className="crm-chat-refresh"
              onClick={handleFetchEmails}
              disabled={fetching}
              aria-label="Fetch new emails"
              style={fetching ? { opacity: 0.6 } : undefined}
            >
              {fetching ? <Loader2 size={16} className="crm-spin" /> : <Inbox size={16} />}
            </button>
            <button className="crm-chat-refresh" onClick={() => { fetchConversations(); onRefresh(); }} aria-label="Refresh">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: '8px 16px', background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#dc2626' }}>
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {conversations.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center' }}>
            <Mail size={40} style={{ opacity: 0.25, marginBottom: 12 }} />
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginBottom: 16 }}>No emails yet. Click the inbox icon above to fetch new emails.</p>
            <button
              onClick={handleFetchEmails}
              disabled={fetching}
              style={{
                padding: '8px 20px', borderRadius: '8px', border: 'none',
                background: '#2563eb', color: '#fff', fontSize: '0.85rem', fontWeight: 600,
                cursor: fetching ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              }}
            >
              {fetching ? <Loader2 size={16} className="crm-spin" /> : <Inbox size={16} />}
              {fetching ? 'Fetching...' : 'Fetch Emails'}
            </button>
          </div>
        ) : (
          <div className="crm-chat-items">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`crm-chat-item ${selectedConv === conv.id ? 'active' : ''}`}
                onClick={() => { setSelectedConv(conv.id); setError(''); }}
                style={{ cursor: 'pointer' }}
              >
                <div className="crm-chat-avatar" style={{ background: '#2563eb' }}>
                  {getInitials(conv.from_name || '', conv.from_email)}
                </div>
                <div className="crm-chat-item-body">
                  <div className="crm-chat-item-top">
                    <span className="crm-chat-item-name" style={{ fontWeight: conv.unread_count > 0 ? 700 : 500 }}>
                      {conv.from_name || conv.from_email}
                    </span>
                    <span className="crm-chat-item-time">
                      {conv.last_message_at ? formatTime(conv.last_message_at) : ''}
                    </span>
                  </div>
                  <div className="crm-chat-item-preview">
                    <span className="crm-chat-item-text" style={{ fontWeight: conv.unread_count > 0 ? 600 : 400 }}>
                      {conv.subject || '(No subject)'}
                    </span>
                    {conv.unread_count > 0 && (
                      <span className="crm-chat-unread-badge" style={{ background: '#2563eb' }}>
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                  <div className="crm-chat-item-text" style={{ fontSize: '0.75rem', opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conv.last_message_text || ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Message View */}
      <div className={`crm-chat-messages ${selectedConv ? 'show-mobile' : 'hidden-mobile'}`}>
        {selectedConv && selectedConversation ? (
          <>
            <div className="crm-chat-msg-header">
              <button className="crm-chat-back-btn" onClick={() => setSelectedConv(null)} aria-label="Back">
                <ArrowLeft size={18} />
              </button>
              <div className="crm-chat-msg-header-info">
                <div className="crm-chat-msg-header-name">{selectedConversation.from_name || selectedConversation.from_email}</div>
                <div className="crm-chat-msg-header-status" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  {selectedConversation.from_email}
                </div>
              </div>
              <button
                className="crm-chat-refresh"
                onClick={() => setShowDeleteConfirm(selectedConv)}
                aria-label="Delete conversation"
                style={{ color: '#ef4444' }}
              >
                <Trash2 size={16} />
              </button>
            </div>

            {showDeleteConfirm === selectedConv && (
              <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ fontSize: '0.82rem', color: '#dc2626' }}>Delete this conversation?</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setShowDeleteConfirm(null)} style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '0.78rem', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={() => handleDeleteConversation(selectedConv)} style={{ padding: '4px 12px', borderRadius: '6px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '0.78rem', cursor: 'pointer' }}>Delete</button>
                </div>
              </div>
            )}

            <div className="crm-chat-msg-list">
              {loadingMessages ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px' }}>
                  <Loader2 size={28} className="crm-spin" style={{ color: '#2563eb' }} />
                </div>
              ) : messages.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', textAlign: 'center' }}>
                  <Mail size={36} style={{ opacity: 0.2, marginBottom: 10 }} />
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No messages in this conversation.</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`crm-chat-bubble ${msg.direction === 'outgoing' ? 'admin' : 'client'}`}
                    style={{ maxWidth: '85%' }}
                  >
                    <div className="crm-chat-bubble-header" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '0.72rem', opacity: 0.7 }}>
                      {msg.direction === 'incoming' ? (
                        <>{msg.from_name || msg.from_email}</>
                      ) : (
                        <>You</>
                      )}
                      <span style={{ marginLeft: 'auto' }}>{formatTime(msg.created_at)}</span>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: '4px', opacity: 0.8 }}>
                      {msg.subject}
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.85rem', lineHeight: 1.5 }}>
                      {msg.body_text}
                    </div>
                    {msg.has_attachments && msg.attachments && msg.attachments.length > 0 && (
                      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {msg.attachments.map((a, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', opacity: 0.8 }}>
                            <Paperclip size={12} /> {a.filename}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Reply Box */}
            <div className="crm-chat-reply-box">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your reply..."
                rows={3}
                style={{
                  flex: 1, resize: 'none', border: '1px solid #e2e8f0', borderRadius: '10px',
                  padding: '10px 14px', fontSize: '0.88rem', fontFamily: 'inherit',
                  outline: 'none', lineHeight: 1.5,
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSendReply();
                  }
                }}
              />
              <button
                onClick={handleSendReply}
                disabled={!replyText.trim() || sending}
                style={{
                  padding: '10px 18px', borderRadius: '10px', border: 'none',
                  background: replyText.trim() && !sending ? '#2563eb' : '#cbd5e1',
                  color: '#fff', fontSize: '0.85rem', fontWeight: 600,
                  cursor: replyText.trim() && !sending ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  alignSelf: 'flex-end',
                }}
              >
                {sending ? <Loader2 size={16} className="crm-spin" /> : <Send size={16} />}
                Send
              </button>
            </div>
          </>
        ) : (
          <div className="crm-chat-empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
            <Mail size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
            <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Select a conversation to view emails</p>
          </div>
        )}
      </div>
    </div>
  );
}
