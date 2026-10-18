import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Send, MessageCircle, AlertCircle, Image as ImageIcon, Paperclip, FileText, Sparkles, ChevronRight, Check, CheckCheck, Clock, StickyNote, Plus, Trash2, Phone, Mail, CalendarClock, Tag, Zap, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

type Lead = {
  id: string;
  full_name: string;
  email?: string;
  mobile_number: string;
  status?: string;
  lead_source?: string | null;
  fund_amount?: number | null;
  purchase_value?: number | null;
  state?: string | null;
  created_at?: string;
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
  wa_message_id?: string | null;
  delivery_status?: string | null;
};

type Conversation = {
  id: string;
  wa_phone_number: string;
  wa_name: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
  is_typing?: boolean | null;
  typing_at?: string | null;
  labels?: string[] | null;
};

type Template = {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: any[];
};

type InternalNote = {
  id: string;
  body: string;
  author_name: string | null;
  created_at: string;
};

type ReplySnippet = {
  id: string;
  title: string;
  body: string;
  category: string | null;
  channel: string;
};

type FollowUp = {
  id: string;
  lead_id: string;
  title: string;
  note: string | null;
  reminder_at: string;
  status: string;
};

type Props = {
  open: boolean;
  lead: Lead | null;
  session: Session | null;
  onClose: () => void;
};

const STAGE_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  interested: 'Interested',
  negotiation: 'Negotiation',
  converted: 'Converted',
  not_interested: 'Not Interested',
};

const LABEL_PRESETS = [
  { label: 'Hot Lead', color: '#EF4444' },
  { label: 'Warm', color: '#F59E0B' },
  { label: 'Follow Up', color: '#3B82F6' },
  { label: 'VIP', color: '#8B5CF6' },
  { label: 'Qualified', color: '#10B981' },
  { label: 'Cold', color: '#6B7280' },
];

const labelColor = (label: string): string => {
  const found = LABEL_PRESETS.find((p) => p.label.toLowerCase() === label.toLowerCase());
  if (found) return found.color;
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = label.charCodeAt(i) + ((hash << 5) - hash);
  const hues = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#6366F1'];
  return hues[Math.abs(hash) % hues.length];
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

const toLocalDateTimeInput = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

const replacePlaceholders = (text: string, lead: Lead): string => {
  return text
    .replace(/\{\{full_name\}\}/gi, lead.full_name || '')
    .replace(/\{\{email\}\}/gi, lead.email || '')
    .replace(/\{\{mobile_number\}\}/gi, lead.mobile_number || '')
    .replace(/\{\{first_name\}\}/gi, lead.full_name?.split(' ')[0] || '');
};

const LeadWhatsAppDrawer: React.FC<Props> = ({ open, lead, session, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);
  const [paramValues, setParamValues] = useState<string[]>([]);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [leadStatus, setLeadStatus] = useState<string>(lead?.status || 'new');
  const [showActions, setShowActions] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [fuDate, setFuDate] = useState<string>('');
  const [fuNote, setFuNote] = useState('');
  const [fuSaving, setFuSaving] = useState(false);
  const [fuList, setFuList] = useState<FollowUp[]>([]);
  const [snippets, setSnippets] = useState<ReplySnippet[]>([]);
  const [snippetsLoading, setSnippetsLoading] = useState(false);
  const [showSnippetPicker, setShowSnippetPicker] = useState(false);
  const [convLabels, setConvLabels] = useState<string[]>([]);
  const [showLabelEditor, setShowLabelEditor] = useState(false);
  const [newLabelText, setNewLabelText] = useState('');
  const [labelSaving, setLabelSaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const phone = lead ? normalizePhone(lead.mobile_number) : '';

  const loadConversation = useCallback(async () => {
    if (!lead || !phone || !session) return;
    setLoading(true);
    setError(null);
    setConversation(null);
    setMessages([]);
    setShowTemplatePicker(false);
    setActiveTemplate(null);
    setParamValues([]);
    try {
      const { data: conv, error: convErr } = await supabase
        .from('wa_conversations')
        .select('id, wa_phone_number, wa_name, last_message_text, last_message_at, is_typing, typing_at, labels')
        .eq('user_id', session.user.id)
        .eq('wa_phone_number', phone)
        .maybeSingle();

      if (convErr) throw convErr;
      if (conv) {
        setConversation(conv as Conversation);
        setConvLabels(conv.labels || []);
        const { data: msgs, error: msgErr } = await supabase
          .from('wa_messages')
          .select('id, conversation_id, sender, message_type, text_content, media_id, mime_type, file_name, created_at, wa_message_id, delivery_status')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: true });
        if (msgErr) throw msgErr;
        setMessages((msgs || []) as WaMessage[]);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load chat history');
    } finally {
      setLoading(false);
    }
  }, [lead, phone, session]);

  const loadNotes = useCallback(async () => {
    if (!lead || !session) return;
    try {
      const { data, error } = await supabase
        .from('wa_conv_notes')
        .select('id, body, author_name, created_at')
        .eq('conversation_id', conversation?.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setNotes((data || []) as InternalNote[]);
    } catch {
      setNotes([]);
    }
  }, [lead, session, conversation]);

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

  const loadSnippets = useCallback(async () => {
    if (!session) return;
    setSnippetsLoading(true);
    try {
      const { data, error } = await supabase
        .from('reply_templates')
        .select('id, title, body, category, channel')
        .or(`channel.eq.all,channel.eq.whatsapp`)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setSnippets((data || []) as ReplySnippet[]);
    } catch {
      setSnippets([]);
    } finally {
      setSnippetsLoading(false);
    }
  }, [session]);

  const loadFollowUps = useCallback(async () => {
    if (!lead || !session) return;
    try {
      const { data, error } = await supabase
        .from('lead_followups')
        .select('id, lead_id, title, note, reminder_at, status')
        .eq('lead_id', lead.id)
        .order('reminder_at', { ascending: false });
      if (error) throw error;
      setFuList((data || []) as FollowUp[]);
    } catch {
      setFuList([]);
    }
  }, [lead, session]);

  useEffect(() => {
    if (open) {
      setLeadStatus(lead?.status || 'new');
      loadConversation();
      loadTemplates();
      loadSnippets();
      loadFollowUps();
      const now = new Date();
      now.setHours(now.getHours() + 24, 0, 0, 0);
      setFuDate(toLocalDateTimeInput(now));
    }
  }, [open, loadConversation, loadTemplates, loadSnippets, loadFollowUps, lead?.status]);

  useEffect(() => {
    if (open && conversation) loadNotes();
  }, [open, conversation, loadNotes]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  useEffect(() => {
    if (!open || !conversation) return;
    const channel = supabase
      .channel(`lead-wa-drawer-${conversation.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wa_messages', filter: `conversation_id=eq.${conversation.id}` },
        (payload) => { setMessages((prev) => [...prev, payload.new as WaMessage]); },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'wa_messages', filter: `conversation_id=eq.${conversation.id}` },
        (payload) => { setMessages((prev) => prev.map((m) => (m.id === (payload.new as WaMessage).id ? (payload.new as WaMessage) : m))); },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'wa_conversations', filter: `id=eq.${conversation.id}` },
        (payload) => {
          const updated = payload.new as Conversation;
          if (updated.is_typing && updated.typing_at) {
            const age = Date.now() - new Date(updated.typing_at).getTime();
            setIsTyping(age < 8000);
          } else {
            setIsTyping(false);
          }
          if (updated.labels) setConvLabels(updated.labels);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [open, conversation]);

  useEffect(() => {
    if (!isTyping) return;
    const t = setTimeout(() => setIsTyping(false), 8000);
    return () => clearTimeout(t);
  }, [isTyping]);

  const handleSend = async () => {
    if (!draft.trim() || !conversation || sending) return;
    const text = draft.trim();
    setDraft('');
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
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
        headers: { Authorization: `Bearer ${session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
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
        .select('id, wa_phone_number, wa_name, last_message_text, last_message_at, is_typing, typing_at, labels')
        .eq('user_id', session.user.id)
        .eq('wa_phone_number', phone)
        .maybeSingle();
      if (exErr) throw exErr;
      if (existing) { const conv = existing as Conversation; setConversation(conv); setConvLabels(conv.labels || []); return conv; }
      const { data: created, error: createErr } = await supabase
        .from('wa_conversations')
        .insert({ user_id: session.user.id, wa_phone_number: phone, wa_name: lead.full_name, lead_id: lead.id })
        .select('id, wa_phone_number, wa_name, last_message_text, last_message_at, is_typing, typing_at, labels')
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
      if (!conv) { setSending(false); return; }
      const templateComponents = (tpl.components || [])
        .map((c) => ((c.type || '').toLowerCase() === 'body' ? { type: 'body', parameters: params.map((p) => ({ type: 'text', text: p })) } : null))
        .filter(Boolean);
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: JSON.stringify({ conversationId: conv.id, templateName: tpl.name, templateLanguage: tpl.language, templateComponents }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send template');
      if (data.message) setMessages((prev) => [...prev, data.message as WaMessage]);
      setActiveTemplate(null); setParamValues([]); setShowTemplatePicker(false);
      await loadConversation();
    } catch (e: any) {
      setError(e.message || 'Failed to send template');
    } finally {
      setSending(false);
    }
  };

  const handleSaveNote = async () => {
    if (!noteDraft.trim() || !conversation || savingNote) return;
    setSavingNote(true);
    try {
      const { data, error } = await supabase
        .from('wa_conv_notes')
        .insert({ conversation_id: conversation.id, body: noteDraft.trim(), author_name: session?.user?.email || 'Team member' })
        .select('id, body, author_name, created_at')
        .single();
      if (error) throw error;
      setNotes((prev) => [data as InternalNote, ...prev]);
      setNoteDraft('');
    } catch (e: any) { setError(e.message || 'Failed to save note'); }
    finally { setSavingNote(false); }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase.from('wa_conv_notes').delete().eq('id', noteId);
      if (error) throw error;
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (e: any) { setError(e.message || 'Failed to delete note'); }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!lead || statusSaving) return;
    const prev = leadStatus;
    setLeadStatus(newStatus);
    setStatusSaving(true);
    try {
      const { error } = await supabase.from('submissions').update({ status: newStatus }).eq('id', lead.id);
      if (error) throw error;
    } catch (e: any) { setLeadStatus(prev); setError(e.message || 'Failed to update status'); }
    finally { setStatusSaving(false); }
  };

  const handleSaveFollowUp = async () => {
    if (!lead || !session || !fuDate || fuSaving) return;
    setFuSaving(true);
    setError(null);
    try {
      const { error } = await supabase.from('lead_followups').insert({
        lead_id: lead.id,
        title: fuNote.trim() || 'WhatsApp follow-up',
        note: fuNote.trim() || null,
        reminder_at: new Date(fuDate).toISOString(),
        status: 'pending',
      });
      if (error) throw error;
      setShowFollowUp(false);
      setFuNote('');
      const now = new Date();
      now.setHours(now.getHours() + 24, 0, 0, 0);
      setFuDate(toLocalDateTimeInput(now));
      await loadFollowUps();
    } catch (e: any) { setError(e.message || 'Failed to schedule follow-up'); }
    finally { setFuSaving(false); }
  };

  const handleMarkFollowUpDone = async (id: string) => {
    try {
      const { error } = await supabase.from('lead_followups').update({ status: 'done' }).eq('id', id);
      if (error) throw error;
      setFuList((prev) => prev.filter((f) => f.id !== id));
    } catch (e: any) { setError(e.message || 'Failed to update follow-up'); }
  };

  const handleToggleLabel = async (label: string) => {
    if (!conversation || labelSaving) return;
    setLabelSaving(true);
    const next = convLabels.includes(label) ? convLabels.filter((l) => l !== label) : [...convLabels, label];
    const prevLabels = convLabels;
    setConvLabels(next);
    try {
      const { error } = await supabase.from('wa_conversations').update({ labels: next }).eq('id', conversation.id);
      if (error) throw error;
    } catch (e: any) {
      setConvLabels(prevLabels);
      setError(e.message || 'Failed to update labels');
    } finally {
      setLabelSaving(false);
    }
  };

  const handleAddCustomLabel = async () => {
    const label = newLabelText.trim();
    if (!label || !conversation || convLabels.includes(label) || labelSaving) return;
    setLabelSaving(true);
    const next = [...convLabels, label];
    const prevLabels = convLabels;
    setConvLabels(next);
    setNewLabelText('');
    try {
      const { error } = await supabase.from('wa_conversations').update({ labels: next }).eq('id', conversation.id);
      if (error) throw error;
    } catch (e: any) {
      setConvLabels(prevLabels);
      setError(e.message || 'Failed to add label');
    } finally {
      setLabelSaving(false);
    }
  };

  const handleInsertSnippet = (snippet: ReplySnippet) => {
    if (!lead) return;
    const text = replacePlaceholders(snippet.body, lead);
    setDraft((prev) => (prev ? prev + ' ' + text : text));
    setShowSnippetPicker(false);
  };

  if (!open || !lead) return null;

  const noConversation = !loading && !conversation && !error;
  const showStarterTemplatePicker = noConversation && !showTemplatePicker;
  const showActiveTemplateForm = showStarterTemplatePicker && activeTemplate;

  const renderDeliveryTicks = (m: WaMessage) => {
    if (m.sender !== 'admin') return null;
    const status = (m.delivery_status || (m.wa_message_id ? 'sent' : '') || '').toLowerCase();
    if (status === 'read') return <CheckCheck size={13} className="lead-wa-tick lead-wa-tick-read" />;
    if (status === 'delivered') return <CheckCheck size={13} className="lead-wa-tick" />;
    if (status === 'sent') return <Check size={12} className="lead-wa-tick" />;
    if (status === 'failed') return <span className="lead-wa-tick lead-wa-tick-fail">!</span>;
    return null;
  };

  const waLink = phone ? `https://wa.me/${phone.replace(/[^\d]/g, '')}` : '';
  const pendingFollowUps = fuList.filter((f) => f.status === 'pending');

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
          <div className="lead-wa-header-actions">
            <button
              className={`lead-wa-icon-btn ${showActions ? 'lead-wa-icon-btn-active' : ''}`}
              onClick={() => { setShowActions((v) => !v); setShowFollowUp(false); setShowLabelEditor(false); }}
              aria-label="Quick actions"
              title="Quick actions"
            >
              <Zap size={16} />
            </button>
            <button
              className={`lead-wa-icon-btn ${notesOpen ? 'lead-wa-icon-btn-active' : ''}`}
              onClick={() => setNotesOpen((v) => !v)}
              aria-label="Internal notes"
              title="Internal notes"
            >
              <StickyNote size={16} />
            </button>
            <button className="lead-wa-close" onClick={onClose} aria-label="Close chat">
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Quick action bar */}
        {showActions && (
          <div className="lead-wa-action-bar">
            {lead.email && (
              <a className="lead-wa-action-btn" href={`mailto:${lead.email}?subject=Following up on your inquiry`}>
                <Mail size={16} /> Email
              </a>
            )}
            {waLink && (
              <a className="lead-wa-action-btn" href={waLink} target="_blank" rel="noopener noreferrer">
                <Phone size={16} /> Call
              </a>
            )}
            <button className="lead-wa-action-btn" onClick={() => { setShowFollowUp((v) => !v); setShowLabelEditor(false); }}>
              <CalendarClock size={16} /> Follow-up
              {pendingFollowUps.length > 0 && <span className="lead-wa-action-badge">{pendingFollowUps.length}</span>}
            </button>
            <button className="lead-wa-action-btn" onClick={() => { setShowLabelEditor((v) => !v); setShowFollowUp(false); }}>
              <Tag size={16} /> Labels
              {convLabels.length > 0 && <span className="lead-wa-action-badge lead-wa-action-badge-labels">{convLabels.length}</span>}
            </button>
          </div>
        )}

        {/* Follow-up scheduler panel */}
        {showActions && showFollowUp && (
          <div className="lead-wa-panel">
            <div className="lead-wa-panel-head">
              <CalendarClock size={15} />
              <span>Schedule a follow-up reminder</span>
            </div>
            <div className="lead-wa-panel-body">
              <label className="lead-wa-panel-label">When</label>
              <input
                type="datetime-local"
                className="lead-wa-panel-input"
                value={fuDate}
                onChange={(e) => setFuDate(e.target.value)}
                disabled={fuSaving}
              />
              <label className="lead-wa-panel-label">Note (optional)</label>
              <input
                type="text"
                className="lead-wa-panel-input"
                placeholder="e.g. Check if they reviewed the proposal"
                value={fuNote}
                onChange={(e) => setFuNote(e.target.value)}
                disabled={fuSaving}
              />
              <button className="lead-wa-panel-save" onClick={handleSaveFollowUp} disabled={fuSaving || !fuDate}>
                {fuSaving ? 'Saving…' : 'Schedule reminder'}
              </button>

              {pendingFollowUps.length > 0 && (
                <div className="lead-wa-fu-list">
                  <p className="lead-wa-fu-list-title">Upcoming reminders</p>
                  {pendingFollowUps.map((f) => (
                    <div key={f.id} className="lead-wa-fu-item">
                      <Clock size={13} />
                      <div className="lead-wa-fu-info">
                        <span className="lead-wa-fu-title">{f.title}</span>
                        <span className="lead-wa-fu-date">{new Date(f.reminder_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                      </div>
                      <button className="lead-wa-fu-done" onClick={() => handleMarkFollowUpDone(f.id)} aria-label="Mark done">
                        <Check size={13} /> Done
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Label editor panel */}
        {showActions && showLabelEditor && (
          <div className="lead-wa-panel">
            <div className="lead-wa-panel-head">
              <Tag size={15} />
              <span>Conversation labels</span>
            </div>
            <div className="lead-wa-panel-body">
              <div className="lead-wa-label-grid">
                {LABEL_PRESETS.map((p) => {
                  const active = convLabels.includes(p.label);
                  return (
                    <button
                      key={p.label}
                      className={`lead-wa-label-chip ${active ? 'lead-wa-label-chip-active' : ''}`}
                      style={active ? { background: p.color, borderColor: p.color } : { color: p.color, borderColor: p.color + '40' }}
                      onClick={() => handleToggleLabel(p.label)}
                      disabled={labelSaving || !conversation}
                    >
                      {active && <Check size={11} />} {p.label}
                    </button>
                  );
                })}
                {convLabels.filter((l) => !LABEL_PRESETS.some((p) => p.label === l)).map((l) => (
                  <button
                    key={l}
                    className="lead-wa-label-chip lead-wa-label-chip-active"
                    style={{ background: labelColor(l), borderColor: labelColor(l) }}
                    onClick={() => handleToggleLabel(l)}
                    disabled={labelSaving || !conversation}
                  >
                    <Check size={11} /> {l}
                  </button>
                ))}
              </div>
              <div className="lead-wa-label-add">
                <input
                  className="lead-wa-panel-input"
                  placeholder="Add custom label…"
                  value={newLabelText}
                  onChange={(e) => setNewLabelText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustomLabel(); }}
                  disabled={labelSaving || !conversation}
                />
                <button className="lead-wa-label-add-btn" onClick={handleAddCustomLabel} disabled={labelSaving || !newLabelText.trim() || !conversation}>
                  <Plus size={15} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lead context strip with labels */}
        <div className="lead-wa-context">
          <div className="lead-wa-context-item">
            <span className="lead-wa-context-label">Status</span>
            <select className="lead-wa-status-select" value={leadStatus} onChange={(e) => handleStatusChange(e.target.value)} disabled={statusSaving}>
              {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {lead.lead_source && (
            <div className="lead-wa-context-item">
              <span className="lead-wa-context-label">Source</span>
              <span className="lead-wa-context-value">{lead.lead_source}</span>
            </div>
          )}
          {lead.fund_amount != null && (
            <div className="lead-wa-context-item">
              <span className="lead-wa-context-label">Fund</span>
              <span className="lead-wa-context-value">${lead.fund_amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
            </div>
          )}
          {lead.email && (
            <div className="lead-wa-context-item">
              <span className="lead-wa-context-label">Email</span>
              <span className="lead-wa-context-value lead-wa-context-truncate">{lead.email}</span>
            </div>
          )}
          {convLabels.length > 0 && (
            <div className="lead-wa-context-labels">
              {convLabels.map((l) => (
                <span key={l} className="lead-wa-label-pill" style={{ background: labelColor(l) + '18', color: labelColor(l) }}>{l}</span>
              ))}
            </div>
          )}
        </div>

        <div className="lead-wa-subheader">
          <MessageCircle size={13} />
          <span>WhatsApp Conversation</span>
          {conversation && <span className="lead-wa-conv-count">{messages.length} messages</span>}
        </div>

        <div className="lead-wa-body">
          <div className="lead-wa-messages-wrap">
            <div className="lead-wa-messages" ref={scrollRef}>
              {loading && (
                <div className="lead-wa-state"><div className="lead-wa-spinner" /><p>Loading chat history…</p></div>
              )}

              {showStarterTemplatePicker && !activeTemplate && (
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
                  {templatesLoading && <div className="lead-wa-state"><div className="lead-wa-spinner" /><p>Loading templates…</p></div>}
                  {!templatesLoading && templates.length === 0 && (
                    <div className="lead-wa-starter-empty">
                      <FileText size={30} />
                      <p className="lead-wa-starter-empty-title">No approved templates yet</p>
                      <p className="lead-wa-starter-empty-desc">Create and get templates approved in the Templates hub to start new conversations with one tap.</p>
                    </div>
                  )}
                  {!templatesLoading && templates.length > 0 && (
                    <div className="lead-wa-tpl-list">
                      {templates.map((tpl) => (
                        <button key={tpl.id} className="lead-wa-tpl-card" onClick={() => { setActiveTemplate(tpl); setParamValues(getTemplateParams(tpl).map(() => '')); }} disabled={sending}>
                          <div className="lead-wa-tpl-icon"><FileText size={16} /></div>
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

              {showActiveTemplateForm && activeTemplate && (
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
                        <input key={i} className="lead-wa-tpl-input" placeholder={`Placeholder {{${i + 1}}}`} value={paramValues[i] || ''}
                          onChange={(e) => { const next = [...paramValues]; next[i] = e.target.value; setParamValues(next); }} disabled={sending} />
                      ))}
                    </div>
                  ) : (
                    <p className="lead-wa-starter-desc" style={{ textAlign: 'center' }}>This template has no placeholders — ready to send.</p>
                  )}
                  <div className="lead-wa-tpl-form-actions">
                    <button className="lead-wa-tpl-cancel" onClick={() => { setActiveTemplate(null); setParamValues([]); }} disabled={sending}>Back</button>
                    <button className="lead-wa-tpl-send" onClick={() => handleSendTemplate(activeTemplate, paramValues)} disabled={sending || getTemplateParams(activeTemplate).some((_, i) => !paramValues[i])}>
                      {sending ? 'Sending…' : 'Send template'}
                    </button>
                  </div>
                </div>
              )}

              {!loading && !showStarterTemplatePicker && error && (
                <div className="lead-wa-state lead-wa-state-error">
                  <AlertCircle size={32} />
                  <p className="lead-wa-state-title">Something went wrong</p>
                  <p className="lead-wa-state-desc">{error}</p>
                  <button className="lead-wa-retry" onClick={loadConversation}>Try again</button>
                </div>
              )}

              {!loading && conversation && messages.length === 0 && !error && !showTemplatePicker && (
                <div className="lead-wa-state"><MessageCircle size={36} /><p className="lead-wa-state-desc">No messages in this conversation yet.</p></div>
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
                            {(m.message_type === 'audio' || m.message_type === 'voice') && <span>Audio</span>}
                            {(m.message_type === 'video') && <span>Video</span>}
                            <span className="lead-wa-media-label">{m.message_type}</span>
                            {m.file_name && <span className="lead-wa-media-file"> · {m.file_name}</span>}
                          </div>
                        )}
                        {m.text_content && <p className="lead-wa-bubble-text">{m.text_content}</p>}
                      </div>
                      <div className="lead-wa-bubble-meta">
                        <span className="lead-wa-bubble-time">{formatTime(m.created_at)}</span>
                        {renderDeliveryTicks(m)}
                      </div>
                    </div>
                  );
                })
              )}

              {isTyping && conversation && (
                <div className="lead-wa-typing"><span /><span /><span /></div>
              )}
            </div>

            {/* Template picker for active conversation */}
            {showTemplatePicker && conversation && (
              <div className="lead-wa-tpl-popover">
                <div className="lead-wa-tpl-popover-head">
                  <span>Send a template</span>
                  <button className="lead-wa-tpl-popover-close" onClick={() => setShowTemplatePicker(false)}><X size={14} /></button>
                </div>
                {templatesLoading && <div className="lead-wa-spinner lead-wa-spinner-sm" />}
                {!templatesLoading && templates.length === 0 && <p className="lead-wa-tpl-popover-empty">No approved templates available.</p>}
                <div className="lead-wa-tpl-popover-list">
                  {templates.map((tpl) => (
                    <button key={tpl.id} className="lead-wa-tpl-popover-item" onClick={() => { setActiveTemplate(tpl); setParamValues(getTemplateParams(tpl).map(() => '')); setShowTemplatePicker(false); }} disabled={sending}>
                      <FileText size={14} />
                      <span className="lead-wa-tpl-popover-name">{tpl.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Saved reply snippets picker */}
            {showSnippetPicker && conversation && (
              <div className="lead-wa-tpl-popover">
                <div className="lead-wa-tpl-popover-head">
                  <span>Saved replies</span>
                  <button className="lead-wa-tpl-popover-close" onClick={() => setShowSnippetPicker(false)}><X size={14} /></button>
                </div>
                {snippetsLoading && <div className="lead-wa-spinner lead-wa-spinner-sm" />}
                {!snippetsLoading && snippets.length === 0 && <p className="lead-wa-tpl-popover-empty">No saved replies yet. Create reply templates in your settings to use them here.</p>}
                <div className="lead-wa-tpl-popover-list">
                  {snippets.map((s) => (
                    <button key={s.id} className="lead-wa-snippet-item" onClick={() => handleInsertSnippet(s)} disabled={sending}>
                      <Zap size={14} />
                      <div className="lead-wa-snippet-body">
                        <span className="lead-wa-snippet-title">{s.title}</span>
                        <span className="lead-wa-snippet-preview">{s.body.slice(0, 60)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Active template form (inline above composer) */}
            {activeTemplate && conversation && !showStarterTemplatePicker && (
              <div className="lead-wa-tpl-inline">
                <div className="lead-wa-tpl-inline-head">
                  <FileText size={14} />
                  <span>{activeTemplate.name}</span>
                  <button className="lead-wa-tpl-inline-close" onClick={() => { setActiveTemplate(null); setParamValues([]); }}><X size={14} /></button>
                </div>
                {getTemplateParams(activeTemplate).length > 0 && (
                  <div className="lead-wa-tpl-inline-params">
                    {getTemplateParams(activeTemplate).map((_, i) => (
                      <input key={i} className="lead-wa-tpl-input" placeholder={`{{${i + 1}}}`} value={paramValues[i] || ''}
                        onChange={(e) => { const next = [...paramValues]; next[i] = e.target.value; setParamValues(next); }} disabled={sending} />
                    ))}
                  </div>
                )}
                <button className="lead-wa-tpl-inline-send" onClick={() => handleSendTemplate(activeTemplate, paramValues)} disabled={sending || getTemplateParams(activeTemplate).some((_, i) => !paramValues[i])}>
                  {sending ? 'Sending…' : 'Send template'}
                </button>
              </div>
            )}
          </div>

          {/* Internal notes sidebar */}
          {notesOpen && (
            <div className="lead-wa-notes">
              <div className="lead-wa-notes-head">
                <StickyNote size={15} />
                <span>Internal Notes</span>
                <span className="lead-wa-notes-count">{notes.length}</span>
              </div>
              <div className="lead-wa-notes-list">
                {notes.length === 0 && <p className="lead-wa-notes-empty">No notes yet. Add a private note about this conversation — visible only to your team.</p>}
                {notes.map((n) => (
                  <div key={n.id} className="lead-wa-note">
                    <div className="lead-wa-note-meta">
                      <span className="lead-wa-note-author">{n.author_name || 'Team'}</span>
                      <span className="lead-wa-note-time">{formatTime(n.created_at)}</span>
                      <button className="lead-wa-note-del" onClick={() => handleDeleteNote(n.id)} aria-label="Delete note"><Trash2 size={12} /></button>
                    </div>
                    <p className="lead-wa-note-body">{n.body}</p>
                  </div>
                ))}
              </div>
              <div className="lead-wa-notes-composer">
                <textarea className="lead-wa-notes-input" placeholder="Add a private note…" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={2} disabled={savingNote} />
                <button className="lead-wa-notes-add" onClick={handleSaveNote} disabled={!noteDraft.trim() || savingNote || !conversation}>
                  <Plus size={15} /> Add
                </button>
              </div>
            </div>
          )}
        </div>

        {conversation ? (
          <div className="lead-wa-composer">
            <button className="lead-wa-attach" onClick={() => fileInputRef.current?.click()} disabled={sending} aria-label="Attach file">
              <Paperclip size={18} />
            </button>
            <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
            <button className={`lead-wa-attach ${showTemplatePicker ? 'lead-wa-icon-btn-active' : ''}`} onClick={() => { setShowTemplatePicker((v) => !v); setActiveTemplate(null); setShowSnippetPicker(false); }} disabled={sending || templates.length === 0} aria-label="Send template" title="Send a template">
              <FileText size={18} />
            </button>
            <button className={`lead-wa-attach ${showSnippetPicker ? 'lead-wa-icon-btn-active' : ''}`} onClick={() => { setShowSnippetPicker((v) => !v); setShowTemplatePicker(false); }} disabled={sending || snippets.length === 0} aria-label="Saved replies" title="Saved reply snippets">
              <Zap size={18} />
            </button>
            <textarea className="lead-wa-input" placeholder="Type a WhatsApp message…" value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              rows={1} disabled={sending}
            />
            <button className="lead-wa-send" onClick={handleSend} disabled={!draft.trim() || sending} aria-label="Send message">
              <Send size={16} />
            </button>
          </div>
        ) : (
          !showStarterTemplatePicker && (
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
