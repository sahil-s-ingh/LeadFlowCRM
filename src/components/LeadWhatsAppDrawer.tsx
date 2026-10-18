import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Send, MessageCircle, AlertCircle, Image as ImageIcon, Paperclip, FileText, Sparkles, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

type Lead = {
  id: string;
  full_name: string;
  email?: string;
  mobile_number: string;
};

type WaMessage = {
  id: string;
  conversation_id: string;
  sender: 'client' | 'admin';
  message_type: string;
  text_content: string | null;
  media_id: string | null;
  mime_type: string | null;
  file_name: string | null;
  created_at: string;
};

type Conversation = {
  id: string;
  wa_phone_number: string;
  wa_name: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
};

type Template = {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: any[];
};

type Props = {
  open: boolean;
  lead: Lead | null;
  session: Session | null;
  onClose: () => void;
};

const normalizePhone = (raw: string): string => {
  let p = (raw || '').trim();
  if (!p) return '';
  p = p.replace(/[^\d+]/g, '');
  if (!p.startsWith('+') && /^\d/.test(p)) p = '+' + p;
  return p;
};

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const getTemplatePreview = (tpl: Template): string => {
  const body = (tpl.components || []).find((c) => (c.type || '').toUpperCase() === 'BODY');
  if (body?.text) return body.text as string;
  return `[${tpl.name}]`;
};

const getTemplateParams = (tpl: Template): { type: string; text: string }[] => {
  const body = (tpl.components || []).find((c) => (c.type || '').toUpperCase() === 'BODY');
  if (!body?.text) return [];
  const matches = (body.text as string).match(/\{\{(\d+)\}\}/g);
  if (!matches) return [];
  return matches.map(() => ({ type: 'text', text: '' }));
};

const LeadWhatsAppDrawer: React.FC<Props> = ({ open, lead, session, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [notConfigured, setNotConfigured] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);
  const [paramValues, setParamValues] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const phone = lead ? normalizePhone(lead.mobile_number) : '';

  const loadConversation = useCallback(async () => {
    if (!lead || !phone || !session) return;
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    setConversation(null);
    setMessages([]);
    try {
      const { data: conv, error: convErr } = await supabase
        .from('wa_conversations')
        .select('id, wa_phone_number, wa_name, last_message_text, last_message_at')
        .eq('user_id', session.user.id)
        .eq('wa_phone_number', phone)
        .maybeSingle();

      if (convErr) throw convErr;
      if (!conv) {
        setLoading(false);
        return;
      }
      setConversation(conv as Conversation);
      const { data: msgs, error: msgErr } = await supabase
        .from('wa_messages')
        .select('id, conversation_id, sender, message_type, text_content, media_id, mime_type, file_name, created_at')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: true });
      if (msgErr) throw msgErr;
      setMessages((msgs || []) as WaMessage[]);
    } catch (e: any) {
      setError(e.message || 'Failed to load chat history');
    } finally {
      setLoading(false);
    }
  }, [lead, phone, session]);

  const loadTemplates = useCallback(async () => {
    if (!session) return;
    setTemplatesLoading(true);
    try {
      const { data, error: tErr } = await supabase
        .from('wa_message_templates')
        .select('id, name, language, category, status, components')
        .eq('user_id', session.user.id)
        .eq('status', 'APPROVED')
        .order('created_at', { ascending: false });
      if (tErr) throw tErr;
      setTemplates((data || []) as Template[]);
    } catch {
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (open) {
      loadConversation();
      loadTemplates();
      setActiveTemplate(null);
      setParamValues([]);
    }
  }, [open, loadConversation, loadTemplates]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  // Realtime subscription for incoming messages
  useEffect(() => {
    if (!open || !conversation) return;
    const channel = supabase
      .channel(`lead-wa-drawer-${conversation.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wa_messages', filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as WaMessage]);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [open, conversation]);

  const handleSend = async () => {
    if (!draft.trim() || !conversation || sending) return;
    const text = draft.trim();
    setDraft('');
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ conversationId: conversation.id, text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send message');
      if (data.message) setMessages((prev) => [...prev, data.message as WaMessage]);
    } catch (e: any) {
      setError(e.message || 'Failed to send');
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const handleFile = async (file: File) => {
    if (!conversation || sending) return;
    setSending(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('conversationId', conversation.id);
      formData.append('file', file);
      formData.append('caption', '');
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp-message`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload');
      if (data.message) setMessages((prev) => [...prev, data.message as WaMessage]);
    } catch (e: any) {
      setError(e.message || 'Failed to upload file');
    } finally {
      setSending(false);
    }
  };

  const ensureConversation = async (): Promise<Conversation | null> => {
    if (conversation) return conversation;
    if (!session || !lead || !phone) return null;
    try {
      const { data: existing, error: exErr } = await supabase
        .from('wa_conversations')
        .select('id, wa_phone_number, wa_name, last_message_text, last_message_at')
        .eq('user_id', session.user.id)
        .eq('wa_phone_number', phone)
        .maybeSingle();
      if (exErr) throw exErr;
      if (existing) {
        const conv = existing as Conversation;
        setConversation(conv);
        return conv;
      }
      const { data: created, error: createErr } = await supabase
        .from('wa_conversations')
        .insert({
          user_id: session.user.id,
          wa_phone_number: phone,
          wa_name: lead.full_name,
          lead_id: lead.id,
        })
        .select('id, wa_phone_number, wa_name, last_message_text, last_message_at')
        .single();
      if (createErr) throw createErr;
      const conv = created as Conversation;
      setConversation(conv);
      return conv;
    } catch (e: any) {
      setError(e.message || 'Failed to start conversation');
      return null;
    }
  };

  const handleSendTemplate = async (tpl: Template, params: string[]) => {
    if (!session || sending) return;
    setSending(true);
    setError(null);
    try {
      const conv = await ensureConversation();
      if (!conv) {
        setSending(false);
        return;
      }
      const templateComponents = (tpl.components || [])
        .map((c) => {
          const typeStr = (c.type || '').toLowerCase();
          if (typeStr === 'body') {
            return { type: 'body', parameters: params.map((p) => ({ type: 'text', text: p })) };
          }
          return null;
        })
        .filter(Boolean);

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          conversationId: conv.id,
          templateName: tpl.name,
          templateLanguage: tpl.language,
          templateComponents,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send template');
      if (data.message) setMessages((prev) => [...prev, data.message as WaMessage]);
      setActiveTemplate(null);
      setParamValues([]);
      await loadConversation();
    } catch (e: any) {
      setError(e.message || 'Failed to send template');
    } finally {
      setSending(false);
    }
  };

  if (!open || !lead) return null;

  const noConversation = !loading && !conversation && !error;
  const showTemplatePicker = noConversation;

  return (
    <>
      <div className="lead-wa-overlay" onClick={onClose} />
      <aside className="lead-wa-drawer" role="dialog" aria-label="WhatsApp chat">
        <header className="lead-wa-header">
          <div className="lead-wa-header-info">
            <div className="lead-wa-avatar">{lead.full_name?.charAt(0).toUpperCase() || '?'}</div>
            <div className="lead-wa-header-text">
              <div className="lead-wa-name">{lead.full_name}</div>
              <div className="lead-wa-phone">
                <span className="lead-wa-online-dot" /> {phone || 'No phone'}
              </div>
            </div>
          </div>
          <button className="lead-wa-close" onClick={onClose} aria-label="Close chat">
            <X size={18} />
          </button>
        </header>

        <div className="lead-wa-subheader">
          <MessageCircle size={13} />
          <span>WhatsApp Conversation</span>
          {conversation && <span className="lead-wa-conv-count">{messages.length} messages</span>}
        </div>

        <div className="lead-wa-messages" ref={scrollRef}>
          {loading && (
            <div className="lead-wa-state">
              <div className="lead-wa-spinner" />
              <p>Loading chat history…</p>
            </div>
          )}

          {showTemplatePicker && !activeTemplate && (
            <div className="lead-wa-starter">
              <div className="lead-wa-starter-head">
                <Sparkles size={26} />
                <p className="lead-wa-starter-title">Start the conversation</p>
                <p className="lead-wa-starter-desc">
                  {phone
                    ? 'This lead has not messaged your WhatsApp number yet. Pick an approved template below to send the first message — WhatsApp requires approved templates for business-initiated chats.'
                    : 'This lead has no phone number on file.'}
                </p>
              </div>

              {templatesLoading && (
                <div className="lead-wa-state">
                  <div className="lead-wa-spinner" />
                  <p>Loading templates…</p>
                </div>
              )}

              {!templatesLoading && templates.length === 0 && (
                <div className="lead-wa-starter-empty">
                  <FileText size={30} />
                  <p className="lead-wa-starter-empty-title">No approved templates yet</p>
                  <p className="lead-wa-starter-empty-desc">
                    Create and get templates approved in the Templates hub to start new conversations with one tap.
                  </p>
                </div>
              )}

              {!templatesLoading && templates.length > 0 && (
                <div className="lead-wa-tpl-list">
                  {templates.map((tpl) => (
                    <button
                      key={tpl.id}
                      className="lead-wa-tpl-card"
                      onClick={() => {
                        setActiveTemplate(tpl);
                        setParamValues(getTemplateParams(tpl).map(() => ''));
                      }}
                      disabled={sending}
                    >
                      <div className="lead-wa-tpl-icon">
                        <FileText size={16} />
                      </div>
                      <div className="lead-wa-tpl-body">
                        <div className="lead-wa-tpl-name">{tpl.name}</div>
                        <div className="lead-wa-tpl-preview">{getTemplatePreview(tpl)}</div>
                        <div className="lead-wa-tpl-meta">
                          <span className="lead-wa-tpl-cat">{tpl.category}</span>
                          <span className="lead-wa-tpl-lang">{tpl.language}</span>
                        </div>
                      </div>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {showTemplatePicker && activeTemplate && (
            <div className="lead-wa-starter">
              <div className="lead-wa-starter-head">
                <FileText size={26} />
                <p className="lead-wa-starter-title">{activeTemplate.name}</p>
                <p className="lead-wa-starter-desc">{getTemplatePreview(activeTemplate)}</p>
              </div>

              {getTemplateParams(activeTemplate).length > 0 ? (
                <div className="lead-wa-tpl-form">
                  <p className="lead-wa-tpl-form-label">Fill in the placeholders:</p>
                  {getTemplateParams(activeTemplate).map((_, i) => (
                    <input
                      key={i}
                      className="lead-wa-tpl-input"
                      placeholder={`Placeholder {{${i + 1}}}`}
                      value={paramValues[i] || ''}
                      onChange={(e) => {
                        const next = [...paramValues];
                        next[i] = e.target.value;
                        setParamValues(next);
                      }}
                      disabled={sending}
                    />
                  ))}
                </div>
              ) : (
                <p className="lead-wa-starter-desc" style={{ textAlign: 'center' }}>
                  This template has no placeholders — ready to send.
                </p>
              )}

              <div className="lead-wa-tpl-form-actions">
                <button
                  className="lead-wa-tpl-cancel"
                  onClick={() => { setActiveTemplate(null); setParamValues([]); }}
                  disabled={sending}
                >
                  Back
                </button>
                <button
                  className="lead-wa-tpl-send"
                  onClick={() => handleSendTemplate(activeTemplate, paramValues)}
                  disabled={sending || getTemplateParams(activeTemplate).some((_, i) => !paramValues[i])}
                >
                  {sending ? 'Sending…' : 'Send template'}
                </button>
              </div>
            </div>
          )}

          {!loading && !showTemplatePicker && error && (
            <div className="lead-wa-state lead-wa-state-error">
              <AlertCircle size={32} />
              <p className="lead-wa-state-title">Something went wrong</p>
              <p className="lead-wa-state-desc">{error}</p>
              <button className="lead-wa-retry" onClick={loadConversation}>Try again</button>
            </div>
          )}

          {!loading && conversation && messages.length === 0 && !error && (
            <div className="lead-wa-state">
              <MessageCircle size={36} />
              <p className="lead-wa-state-desc">No messages in this conversation yet.</p>
            </div>
          )}

          {!loading && conversation && messages.length > 0 && (
            messages.map((m) => {
              const isClient = m.sender === 'client';
              return (
                <div key={m.id} className={`lead-wa-bubble ${isClient ? 'lead-wa-bubble-in' : 'lead-wa-bubble-out'}`}>
                  <div className="lead-wa-bubble-body">
                    {m.message_type !== 'text' && (
                      <div className="lead-wa-bubble-media">
                        {m.message_type === 'image' && <ImageIcon size={18} />}
                        {m.message_type === 'document' && <Paperclip size={18} />}
                        {(m.message_type === 'audio' || m.message_type === 'voice') && <span>🎵 Audio</span>}
                        {(m.message_type === 'video') && <span>🎬 Video</span>}
                        <span className="lead-wa-media-label">{m.message_type}</span>
                        {m.file_name && <span className="lead-wa-media-file"> · {m.file_name}</span>}
                      </div>
                    )}
                    {m.text_content && <p className="lead-wa-bubble-text">{m.text_content}</p>}
                  </div>
                  <div className="lead-wa-bubble-time">{formatTime(m.created_at)}</div>
                </div>
              );
            })
          )}
        </div>

        {notConfigured && (
          <div className="lead-wa-not-configured">
            <AlertCircle size={14} /> WhatsApp is not configured. Set it up in Settings.
          </div>
        )}

        {conversation ? (
          <div className="lead-wa-composer">
            <button
              className="lead-wa-attach"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              aria-label="Attach file"
            >
              <Paperclip size={18} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
            />
            <textarea
              className="lead-wa-input"
              placeholder="Type a WhatsApp message…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              rows={1}
              disabled={sending}
            />
            <button
              className="lead-wa-send"
              onClick={handleSend}
              disabled={!draft.trim() || sending}
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </div>
        ) : (
          !showTemplatePicker && (
            <div className="lead-wa-composer lead-wa-composer-disabled">
              <p>Chat will activate once the lead messages your WhatsApp number.</p>
            </div>
          )
        )}
      </aside>
    </>
  );
};

export default LeadWhatsAppDrawer;
