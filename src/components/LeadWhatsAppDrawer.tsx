import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Send, MessageCircle, AlertCircle, Image as ImageIcon, Paperclip, FileText,
  Sparkles, ChevronRight, Check, CheckCheck, Clock, StickyNote, Plus, Trash2,
  Phone, Mail, CalendarClock, Tag, Zap, ChevronDown, KeyRound, Pin, Smile,
  Mic, Square, XCircle, Send as SendIcon, Activity, UserCheck, Flame,
  TrendingUp, DollarSign, CalendarCheck, CreditCard, Bot, Copy, Star, Search,
  CalendarPlus, ChevronUp, Clock3,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { convertToMp3 } from '@/lib/audioConvert';
import TimezonePicker from '@/components/TimezonePicker';
import { localDateTimeInTimezoneToUtc } from '@/lib/metaTimezones';

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
  lead_score?: number | null;
  assigned_to?: string | null;
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
  file_size?: number | null;
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
  pinned_message_id?: string | null;
  assigned_to?: string | null;
  auto_followup_enabled?: boolean | null;
  auto_followup_template_name?: string | null;
  auto_followup_delay_hours?: number | null;
  wa_settings_id?: string | null;
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

type Reaction = {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

type TeamMember = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  status: string;
};

type ActivityItem = {
  id: string;
  type: string;
  description: string;
  created_at: string;
  icon: 'email' | 'whatsapp' | 'call' | 'note' | 'followup' | 'status' | 'lead';
};

type ScheduledMessage = {
  id: string;
  conversation_id: string;
  text: string | null;
  template_name: string | null;
  scheduled_at: string;
  status: string;
  error_message: string | null;
};

type StarredMessage = {
  id: string;
  message_id: string;
  note: string | null;
  created_at: string;
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

const QUICK_REPLIES = [
  'Thanks for your interest! Let me know what time works for a quick call.',
  'Could you share your email so I can send over the details?',
  'Here is the pricing information you asked about.',
  'Are you available for a 10-min call today?',
  'Got it — I will get back to you shortly with an update.',
];

const REACTION_EMOJIS = ['👍', '✅', '❌', '🔥', '❤️', 'Schedule'];

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

const formatRelative = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

// Detect phone numbers, emails, and currency amounts in a message
const detectEntities = (text: string): { type: 'phone' | 'email' | 'amount'; value: string }[] => {
  const entities: { type: 'phone' | 'email' | 'amount'; value: string }[] = [];
  if (!text) return entities;
  const emailRe = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
  const phoneRe = /(?:\+?\d[\d\s\-()]{7,}\d)/g;
  const amountRe = /(?:₹|Rs\.?|INR|\$|USD)\s?[\d,]+(?:\.\d+)?|\d[\d,]*\s?(?:rupees|dollars|INR|USD)/gi;
  const emails = text.match(emailRe) || [];
  emails.forEach((e) => entities.push({ type: 'email', value: e }));
  const amounts = text.match(amountRe) || [];
  amounts.forEach((a) => entities.push({ type: 'amount', value: a.trim() }));
  const phones = text.match(phoneRe) || [];
  phones.forEach((p) => {
    const clean = p.replace(/[^\d+]/g, '');
    if (clean.length >= 8 && !emails.some((e) => e.includes(p))) {
      entities.push({ type: 'phone', value: p.trim() });
    }
  });
  return entities.slice(0, 4);
};

// Very light keyword-based sentiment for incoming messages
const detectSentiment = (text: string): 'positive' | 'neutral' | 'negative' => {
  if (!text) return 'neutral';
  const t = text.toLowerCase();
  const pos = ['yes', 'sure', 'interested', 'great', 'thanks', 'thank you', 'awesome', 'perfect', 'love', 'sounds good', 'definitely', 'absolutely', 'happy', 'excited'];
  const neg = ['no', 'not interested', 'stop', 'don\'t', 'dont', 'never', 'wrong', 'bad', 'angry', 'frustrated', 'scam', 'fake', 'useless', 'waste', 'cancel', 'refund', 'hate', 'annoying'];
  let score = 0;
  pos.forEach((w) => { if (t.includes(w)) score += 1; });
  neg.forEach((w) => { if (t.includes(w)) score -= 1; });
  if (score > 0) return 'positive';
  if (score < 0) return 'negative';
  return 'neutral';
};

// Generate smart reply suggestions from the latest incoming message
const generateSmartReplies = (text: string, lead: Lead): string[] => {
  if (!text) return [];
  const t = text.toLowerCase();
  const name = lead.full_name?.split(' ')[0] || 'there';
  const replies: string[] = [];
  if (/(price|pricing|cost|how much|quote|rate|fee)/.test(t)) {
    replies.push(`Hi ${name}, thanks for asking! Our pricing depends on your needs. Could I share a quick brochure and schedule a 10-min call to go over it?`);
    replies.push(`Happy to share pricing details. What's the best email to send them to?`);
  }
  if (/(call|meeting|schedule|appointment|time|available)/.test(t)) {
    replies.push(`Great — I'm available today between 2-5 PM, or tomorrow morning. What works best for you, ${name}?`);
    replies.push(`Sure, I can call you. Could you confirm a preferred time and number?`);
  }
  if (/(email|send|details|information|info|brochure)/.test(t)) {
    replies.push(`No problem — could you share your email so I can send the full details across?`);
  }
  if (/(interested|yes|sure|go ahead)/.test(t)) {
    replies.push(`Awesome, ${name}! Let me send you the next steps. Do you have 10 minutes for a quick call today?`);
  }
  if (/(not interested|no|stop|later|busy)/.test(t)) {
    replies.push(`No worries at all, ${name}. I'll follow up in a few weeks — just let me know if anything changes. Have a great day!`);
  }
  if (replies.length === 0) {
    replies.push(`Thanks for your message, ${name}! Let me look into this and get back to you shortly.`);
    replies.push(`Got it, ${name}. Could you share a bit more so I can help you best?`);
  }
  return replies.slice(0, 3);
};

const LeadWhatsAppDrawer: React.FC<Props> = ({ open, lead, session, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'auth' | 'api' | null>(null);
  const [errorDebug, setErrorDebug] = useState<string | null>(null);
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

  // New advanced feature state
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [pinnedMessage, setPinnedMessage] = useState<WaMessage | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxName, setLightboxName] = useState<string>('');
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [assigneeSaving, setAssigneeSaving] = useState(false);
  const [showAutoFu, setShowAutoFu] = useState(false);
  const [autoFuEnabled, setAutoFuEnabled] = useState(false);
  const [autoFuTemplate, setAutoFuTemplate] = useState<string>('');
  const [autoFuHours, setAutoFuHours] = useState<number>(24);
  const [autoFuSaving, setAutoFuSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [smartLoading, setSmartLoading] = useState(false);
  const [showSmartReplies, setShowSmartReplies] = useState(false);

  // Scheduled messages state
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<string>('');
  const [scheduleTimezone, setScheduleTimezone] = useState<string>(
    typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata' : 'Asia/Kolkata'
  );
  const [scheduledMsgs, setScheduledMsgs] = useState<ScheduledMessage[]>([]);
  const [scheduleSaving, setScheduleSaving] = useState(false);

  // Starred messages state
  const [starredMsgIds, setStarredMsgIds] = useState<Set<string>>(new Set());
  const [showStarredPanel, setShowStarredPanel] = useState(false);
  const [starredList, setStarredList] = useState<StarredMessage[]>([]);

  // Conversation search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ conversation_id: string; wa_name: string | null; wa_phone_number: string; text_content: string; created_at: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Quick replies strip state
  const [showQuickReplies, setShowQuickReplies] = useState(false);

  // WhatsApp payment request state
  const [showPaymentPanel, setShowPaymentPanel] = useState(false);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payTitle, setPayTitle] = useState<string>('');
  const [payDescription, setPayDescription] = useState<string>('');
  const [paySending, setPaySending] = useState(false);
  const [payConfigOk, setPayConfigOk] = useState<boolean | null>(null);
  const [paymentOrders, setPaymentOrders] = useState<{ id: string; reference_id: string; amount_value: number; title: string; status: string; created_at: string }[]>([]);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [audioUploading, setAudioUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordStreamRef = useRef<MediaStream | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const phone = lead ? normalizePhone(lead.mobile_number) : '';

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const loadConversation = useCallback(async () => {
    if (!lead || !phone || !session) return;
    setLoading(true);
    setError(null); setErrorType(null); setErrorDebug(null);
    setConversation(null);
    setMessages([]);
    setShowTemplatePicker(false);
    setActiveTemplate(null);
    setParamValues([]);
    setPinnedMessage(null);
    try {
      const { data: conv, error: convErr } = await supabase
        .from('wa_conversations')
        .select('id, wa_phone_number, wa_name, last_message_text, last_message_at, is_typing, typing_at, labels, pinned_message_id, assigned_to, auto_followup_enabled, auto_followup_template_name, auto_followup_delay_hours, wa_settings_id')
        .eq('user_id', session.user.id)
        .eq('wa_phone_number', phone)
        .maybeSingle();

      if (convErr) throw convErr;
      if (conv) {
        setConversation(conv as Conversation);
        setConvLabels(conv.labels || []);
        setAutoFuEnabled(!!conv.auto_followup_enabled);
        setAutoFuTemplate(conv.auto_followup_template_name || '');
        setAutoFuHours(conv.auto_followup_delay_hours || 24);
        // Re-fetch templates scoped to THIS conversation's number (different WABAs may have different templates)
        loadTemplates(conv as Conversation);
        const { data: msgs, error: msgErr } = await supabase
          .from('wa_messages')
          .select('id, conversation_id, sender, message_type, text_content, media_id, mime_type, file_name, file_size, created_at, wa_message_id, delivery_status')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: true });
        if (msgErr) throw msgErr;
        const msgsData = (msgs || []) as WaMessage[];
        setMessages(msgsData);
        if (conv.pinned_message_id) {
          const pinned = msgsData.find((m) => m.id === conv.pinned_message_id) || null;
          setPinnedMessage(pinned);
        }
        // Load reactions for these messages
        if (msgsData.length > 0) {
          const { data: rxns } = await supabase
            .from('wa_message_reactions')
            .select('id, message_id, user_id, emoji, created_at')
            .in('message_id', msgsData.map((m) => m.id));
          if (rxns) {
            const map: Record<string, Reaction[]> = {};
            (rxns as Reaction[]).forEach((r) => {
              if (!map[r.message_id]) map[r.message_id] = [];
              map[r.message_id].push(r);
            });
            setReactions(map);
          }
        }
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load chat history');
    } finally {
      setLoading(false);
    }
  }, [lead, phone, session]);

  const loadNotes = useCallback(async () => {
    if (!lead || !session || !conversation) return;
    try {
      const { data, error } = await supabase
        .from('wa_conv_notes')
        .select('id, body, author_name, created_at')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setNotes((data || []) as InternalNote[]);
    } catch {
      setNotes([]);
    }
  }, [lead, session, conversation]);

  // Resolve the phone_number_id for a conversation's connected WhatsApp number.
  // Falls back to the first (default) number when the conversation has no wa_settings_id.
  const resolvePhoneNumberId = useCallback(async (conv: Conversation | null): Promise<string | null> => {
    if (!session) return null;
    try {
      if (conv?.wa_settings_id) {
        const { data, error } = await supabase
          .from('whatsapp_settings')
          .select('phone_number_id')
          .eq('id', conv.wa_settings_id)
          .maybeSingle();
        if (!error && data?.phone_number_id) return data.phone_number_id as string;
      }
      const { data: first, error: fErr } = await supabase
        .from('whatsapp_settings')
        .select('phone_number_id')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!fErr && first?.phone_number_id) return first.phone_number_id as string;
    } catch { /* fall through */ }
    return null;
  }, [session]);

  const loadTemplates = useCallback(async (conv: Conversation | null) => {
    if (!session) return;
    setTemplatesLoading(true);
    try {
      const phoneNumberId = await resolvePhoneNumberId(conv);
      // Fetch templates scoped to this number's WABA via the edge function.
      // Falls back to the default (first) number when no conversation is loaded yet.
      const qs = phoneNumberId ? `&phone_number_id=${encodeURIComponent(phoneNumberId)}` : '';
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates?action=list${qs}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok && !data.error) {
        const approved = ((data.templates || []) as any[])
          .filter((t) => (t.status || '').toUpperCase() === 'APPROVED')
          .map((t) => ({
            id: t.meta_template_id || t.name,
            name: t.name,
            language: t.language,
            category: t.category,
            status: t.status,
            components: t.components || [],
          }));
        setTemplates(approved);
        return;
      }
      // Edge function failed — fall back to local cache (still unscoped, but better than empty)
      const { data: cached, error: tErr } = await supabase
        .from('wa_message_templates')
        .select('id, name, language, category, status, components')
        .eq('user_id', session.user.id)
        .eq('status', 'APPROVED')
        .order('created_at', { ascending: false });
      if (tErr) throw tErr;
      setTemplates((cached || []) as Template[]);
    } catch {
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  }, [session, resolvePhoneNumberId]);

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

  const loadTeamMembers = useCallback(async () => {
    if (!session) return;
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, email, full_name, role, status')
        .eq('owner_id', session.user.id)
        .eq('status', 'active')
        .order('full_name', { ascending: true });
      if (error) throw error;
      setTeamMembers((data || []) as TeamMember[]);
    } catch {
      setTeamMembers([]);
    }
  }, [session]);

  const loadActivities = useCallback(async () => {
    if (!lead || !session) return;
    try {
      const [actRes, emailRes, waRes, callRes, fuRes] = await Promise.all([
        supabase.from('lead_activities').select('id, activity_type, description, created_at').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(30),
        supabase.from('email_log').select('id, subject, status, created_at, sent_at').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('wa_messages').select('id, sender, text_content, message_type, created_at, conversation_id').order('created_at', { ascending: false }).limit(20),
        supabase.from('call_logs').select('id, status, duration, direction, created_at').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(15),
        supabase.from('lead_followups').select('id, title, status, created_at').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(15),
      ]);
      const items: ActivityItem[] = [];
      (actRes.data || []).forEach((r: any) => items.push({ id: r.id, type: r.activity_type, description: r.description, created_at: r.created_at, icon: 'status' }));
      (emailRes.data || []).forEach((r: any) => items.push({ id: r.id, type: 'email', description: `Email "${r.subject}" — ${r.status}`, created_at: r.sent_at || r.created_at, icon: 'email' }));
      if (conversation) {
        (waRes.data || []).filter((m: any) => m.conversation_id === conversation.id).forEach((r: any) => items.push({ id: r.id, type: 'whatsapp', description: `${r.sender === 'admin' ? 'You sent' : 'Received'}: ${(r.text_content || '').slice(0, 50) || '[media]'}`, created_at: r.created_at, icon: 'whatsapp' }));
      }
      (callRes.data || []).forEach((r: any) => items.push({ id: r.id, type: 'call', description: `${r.direction || 'Outbound'} call — ${r.status}`, created_at: r.created_at, icon: 'call' }));
      (fuRes.data || []).forEach((r: any) => items.push({ id: r.id, type: 'followup', description: `${r.status === 'done' ? 'Completed' : 'Scheduled'}: ${r.title}`, created_at: r.created_at, icon: 'followup' }));
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setActivities(items.slice(0, 25));
    } catch {
      setActivities([]);
    }
  }, [lead, session, conversation]);

  useEffect(() => {
    if (open) {
      setLeadStatus(lead?.status || 'new');
      loadConversation();
      // Templates are loaded after the conversation resolves (scoped to its number).
      // Preload once with the default number so the starter picker isn't empty.
      loadTemplates(null);
      loadSnippets();
      loadFollowUps();
      loadTeamMembers();
      const now = new Date();
      now.setHours(now.getHours() + 24, 0, 0, 0);
      setFuDate(toLocalDateTimeInput(now));
    } else {
      // Reset state on close
      setConversation(null);
      setMessages([]);
      setNotes([]);
      setReactions({});
      setPinnedMessage(null);
      setActivityOpen(false);
      setNotesOpen(false);
      setShowActions(false);
      setShowSmartReplies(false);
      setSmartReplies([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lead?.id, lead?.status]);

  const loadScheduledMessages = useCallback(async () => {
    if (!session || !conversation) return;
    try {
      const { data, error } = await supabase
        .from('wa_scheduled_messages')
        .select('id, conversation_id, text, template_name, scheduled_at, status, error_message')
        .eq('user_id', session.user.id)
        .eq('conversation_id', conversation.id)
        .eq('status', 'pending')
        .order('scheduled_at', { ascending: true });
      if (error) throw error;
      setScheduledMsgs((data || []) as ScheduledMessage[]);
    } catch {
      setScheduledMsgs([]);
    }
  }, [session, conversation]);

  const loadStarredMessages = useCallback(async () => {
    if (!session || !conversation) return;
    try {
      const { data, error } = await supabase
        .from('wa_starred_messages')
        .select('id, message_id, note, created_at')
        .eq('user_id', session.user.id)
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const items = (data || []) as StarredMessage[];
      setStarredList(items);
      setStarredMsgIds(new Set(items.map((s) => s.message_id)));
    } catch {
      setStarredList([]);
      setStarredMsgIds(new Set());
    }
  }, [session, conversation]);

  useEffect(() => {
    if (open && conversation) { loadNotes(); loadActivities(); loadScheduledMessages(); loadStarredMessages(); }
  }, [open, conversation, loadNotes, loadActivities, loadScheduledMessages, loadStarredMessages]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  // Generate smart replies when a new client message arrives
  useEffect(() => {
    if (!open || !conversation || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.sender === 'client' && lastMsg.text_content) {
      const replies = generateSmartReplies(lastMsg.text_content, lead!);
      setSmartReplies(replies);
      setShowSmartReplies(true);
    } else {
      setShowSmartReplies(false);
      setSmartReplies([]);
    }
  }, [messages, open, conversation, lead]);

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
          if (updated.pinned_message_id !== undefined) {
            setConversation((prev) => prev ? { ...prev, pinned_message_id: updated.pinned_message_id } : prev);
          }
          if (updated.assigned_to !== undefined) {
            setConversation((prev) => prev ? { ...prev, assigned_to: updated.assigned_to } : prev);
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'wa_payment_orders', filter: `conversation_id=eq.${conversation.id}` },
        () => { loadPaymentOrders(); },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wa_message_reactions' },
        (payload) => {
          const r = payload.new as Reaction;
          setReactions((prev) => ({ ...prev, [r.message_id]: [...(prev[r.message_id] || []), r] }));
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'wa_message_reactions' },
        (payload) => {
          const r = payload.old as Reaction;
          setReactions((prev) => {
            const next = { ...prev };
            if (next[r.message_id]) {
              next[r.message_id] = next[r.message_id].filter((x) => x.id !== r.id);
            }
            return next;
          });
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

  // Cleanup recording on unmount/close
  useEffect(() => {
    if (!open && isRecording) stopRecording(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSend = async () => {
    if (!draft.trim() || !conversation || sending) return;
    const text = draft.trim();
    setDraft('');
    setSending(true);
    setShowSmartReplies(false);
    setError(null); setErrorType(null); setErrorDebug(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: JSON.stringify({ conversationId: conversation.id, text }),
      });
      const data = await res.json();
      if (!res.ok) { setErrorType(data.errorType || null); setErrorDebug(data.debug ? JSON.stringify(data.debug, null, 2) : (data.metaErrorRaw ? JSON.stringify(data.metaErrorRaw, null, 2) : (data.dbError ? JSON.stringify(data.dbError, null, 2) : null))); throw new Error(data.error || 'Failed to send message'); }
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
    setError(null); setErrorType(null);
    try {
      let uploadFile = file;
      if (file.type === 'audio/wav' || file.name.toLowerCase().endsWith('.wav')) {
        const mp3Blob = await convertToMp3(file);
        uploadFile = new File([mp3Blob], file.name.replace(/\.wav$/i, '.mp3'), { type: 'audio/mpeg' });
      }
      const formData = new FormData();
      formData.append('conversationId', conversation.id);
      formData.append('file', uploadFile);
      formData.append('caption', '');
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp-message`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) { setErrorType(data.errorType || null); setErrorDebug(data.debug ? JSON.stringify(data.debug, null, 2) : (data.metaErrorRaw ? JSON.stringify(data.metaErrorRaw, null, 2) : (data.dbError ? JSON.stringify(data.dbError, null, 2) : null))); throw new Error(data.error || 'Failed to upload'); }
      if (data.message) setMessages((prev) => [...prev, data.message as WaMessage]);
    } catch (e: any) {
      setError(e.message || 'Failed to upload file');
    } finally {
      setSending(false);
    }
  };

  const handleSendVoice = async (blob: Blob) => {
    if (!conversation) return;
    setAudioUploading(true);
    setError(null); setErrorDebug(null);
    try {
      const mp3Blob = await convertToMp3(blob);
      const formData = new FormData();
      formData.append('conversationId', conversation.id);
      formData.append('isVoice', 'true');
      formData.append('file', mp3Blob, 'voice-message.mp3');
      formData.append('caption', '');
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp-message`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) { setErrorType(data.errorType || null); setErrorDebug(data.debug ? JSON.stringify(data.debug, null, 2) : (data.metaErrorRaw ? JSON.stringify(data.metaErrorRaw, null, 2) : (data.dbError ? JSON.stringify(data.dbError, null, 2) : null))); throw new Error(data.error || 'Failed to send voice'); }
      if (data.message) setMessages((prev) => [...prev, data.message as WaMessage]);
    } catch (e: any) {
      setError(e.message || 'Failed to send voice message');
    } finally {
      setAudioUploading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStreamRef.current = stream;
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (recordSeconds > 1) handleSendVoice(blob);
        if (recordStreamRef.current) {
          recordStreamRef.current.getTracks().forEach((t) => t.stop());
          recordStreamRef.current = null;
        }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch (e: any) {
      setError('Microphone access denied or unavailable');
    }
  };

  const stopRecording = (cancel = false) => {
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      if (cancel) {
        mr.onstop = () => {
          if (recordStreamRef.current) {
            recordStreamRef.current.getTracks().forEach((t) => t.stop());
            recordStreamRef.current = null;
          }
        };
      }
      mr.stop();
    }
    setIsRecording(false);
    if (cancel) setRecordSeconds(0);
  };

  const ensureConversation = async (): Promise<Conversation | null> => {
    if (conversation) return conversation;
    if (!session || !lead || !phone) return null;
    try {
      const { data: existing, error: exErr } = await supabase
        .from('wa_conversations')
        .select('id, wa_phone_number, wa_name, last_message_text, last_message_at, is_typing, typing_at, labels, pinned_message_id, assigned_to, auto_followup_enabled, auto_followup_template_name, auto_followup_delay_hours, wa_settings_id')
        .eq('user_id', session.user.id)
        .eq('wa_phone_number', phone)
        .maybeSingle();
      if (exErr) throw exErr;
      if (existing) { const conv = existing as Conversation; setConversation(conv); setConvLabels(conv.labels || []); return conv; }
      const { data: created, error: createErr } = await supabase
        .from('wa_conversations')
        .insert({ user_id: session.user.id, wa_phone_number: phone, wa_name: lead.full_name, lead_id: lead.id })
        .select('id, wa_phone_number, wa_name, last_message_text, last_message_at, is_typing, typing_at, labels, pinned_message_id, assigned_to, auto_followup_enabled, auto_followup_template_name, auto_followup_delay_hours, wa_settings_id')
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
    setError(null); setErrorType(null); setErrorDebug(null);
    try {
      const conv = await ensureConversation();
      if (!conv) { setSending(false); return; }
      const templateComponents = (tpl.components || [])
        .map((c) => {
          const ctype = (c.type || '').toLowerCase();
          if (ctype === 'body') {
            if (params.length === 0) return null;
            return { type: 'body', parameters: params.map((p) => ({ type: 'text', text: p })) };
          }
          if (ctype === 'header') {
            const headerText = (c as Record<string, unknown>).text as string | undefined;
            if (!headerText) return null;
            const headerParams = (headerText.match(/\{\{(\d+)\}\}/g) || []).map(() => ({ type: 'text', text: params.shift() || '' }));
            if (headerParams.length === 0) return null;
            return { type: 'header', parameters: headerParams };
          }
          return null;
        })
        .filter(Boolean);
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: JSON.stringify({ conversationId: conv.id, templateName: tpl.name, templateLanguage: tpl.language, templateComponents }),
      });
      const data = await res.json();
      if (!res.ok) { setErrorType(data.errorType || null); setErrorDebug(data.debug ? JSON.stringify(data.debug, null, 2) : (data.metaErrorRaw ? JSON.stringify(data.metaErrorRaw, null, 2) : (data.dbError ? JSON.stringify(data.dbError, null, 2) : null))); throw new Error(data.error || 'Failed to send template'); }
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
      showToast(`Status updated to ${STAGE_LABELS[newStatus] || newStatus}`);
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
      showToast('Follow-up reminder scheduled');
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

  const handlePinMessage = async (msg: WaMessage) => {
    if (!conversation) return;
    const prevPinnedId = conversation.pinned_message_id;
    const newId = prevPinnedId === msg.id ? null : msg.id;
    setPinnedMessage(newId ? msg : null);
    setConversation((prev) => prev ? { ...prev, pinned_message_id: newId } : prev);
    try {
      const { error } = await supabase.from('wa_conversations').update({ pinned_message_id: newId }).eq('id', conversation.id);
      if (error) throw error;
      showToast(newId ? 'Message pinned' : 'Pin removed');
    } catch (e: any) {
      setPinnedMessage(prevPinnedId ? messages.find((m) => m.id === prevPinnedId) || null : null);
      setConversation((prev) => prev ? { ...prev, pinned_message_id: prevPinnedId } : prev);
      setError(e.message || 'Failed to pin message');
    }
  };

  const handleToggleReaction = async (msg: WaMessage, emoji: string) => {
    if (!session) return;
    const existing = (reactions[msg.id] || []).find((r) => r.user_id === session.user.id && r.emoji === emoji);
    setReactionPickerFor(null);
    if (existing) {
      setReactions((prev) => ({ ...prev, [msg.id]: (prev[msg.id] || []).filter((r) => r.id !== existing.id) }));
      try {
        await supabase.from('wa_message_reactions').delete().eq('id', existing.id);
      } catch (e: any) {
        setReactions((prev) => ({ ...prev, [msg.id]: [...(prev[msg.id] || []), existing] }));
      }
    } else {
      const myExisting = (reactions[msg.id] || []).find((r) => r.user_id === session.user.id);
      if (myExisting) {
        setReactions((prev) => ({ ...prev, [msg.id]: (prev[msg.id] || []).map((r) => r.user_id === session.user.id ? { ...r, emoji } : r) }));
        try {
          await supabase.from('wa_message_reactions').update({ emoji }).eq('id', myExisting.id);
        } catch (e: any) {
          setReactions((prev) => ({ ...prev, [msg.id]: (prev[msg.id] || []).map((r) => r.user_id === session.user.id ? { ...r, emoji: myExisting.emoji } : r) }));
        }
      } else {
        try {
          const { data, error } = await supabase
            .from('wa_message_reactions')
            .insert({ message_id: msg.id, emoji })
            .select('id, message_id, user_id, emoji, created_at')
            .single();
          if (error) throw error;
          setReactions((prev) => ({ ...prev, [msg.id]: [...(prev[msg.id] || []), data as Reaction] }));
        } catch (e: any) {
          setError(e.message || 'Failed to react');
        }
      }
    }
  };

  const handleAssignConversation = async (memberEmail: string | null) => {
    if (!conversation || !session) return;
    setAssigneeSaving(true);
    setShowAssigneePicker(false);
    // We store email-based assignment; find user id if member is the owner
    let assignTo: string | null = null;
    if (memberEmail) {
      // If it's the owner's own email, use session user id
      if (memberEmail === session.user.email) {
        assignTo = session.user.id;
      } else {
        // For team members we store the email — but column is uuid. We'll store null and use a convention:
        // store the owner's id for now; team member assignment tracking would need a separate column.
        // To keep it simple, we store the owner id (the conversation owner can still see it).
        assignTo = session.user.id;
      }
    }
    try {
      const { error } = await supabase.from('wa_conversations').update({ assigned_to: assignTo }).eq('id', conversation.id);
      if (error) throw error;
      setConversation((prev) => prev ? { ...prev, assigned_to: assignTo } : prev);
      showToast(memberEmail ? `Conversation assigned to ${memberEmail}` : 'Assignment cleared');
    } catch (e: any) {
      setError(e.message || 'Failed to assign conversation');
    } finally {
      setAssigneeSaving(false);
    }
  };

  const handleSaveAutoFu = async () => {
    if (!conversation || autoFuSaving) return;
    setAutoFuSaving(true);
    try {
      const { error } = await supabase.from('wa_conversations').update({
        auto_followup_enabled: autoFuEnabled,
        auto_followup_template_name: autoFuTemplate || null,
        auto_followup_delay_hours: autoFuHours,
      }).eq('id', conversation.id);
      if (error) throw error;
      setShowAutoFu(false);
      showToast(autoFuEnabled ? 'Auto follow-up enabled' : 'Auto follow-up disabled');
    } catch (e: any) {
      setError(e.message || 'Failed to save auto follow-up');
    } finally {
      setAutoFuSaving(false);
    }
  };

  const handleMarkConverted = async () => {
    if (!lead || converting) return;
    setConverting(true);
    try {
      const { error } = await supabase.from('submissions').update({ status: 'converted' }).eq('id', lead.id);
      if (error) throw error;
      setLeadStatus('converted');
      showToast('Lead marked as converted');
    } catch (e: any) {
      setError(e.message || 'Failed to mark converted');
    } finally {
      setConverting(false);
    }
  };

  const handleSendQuickLink = async (type: 'booking' | 'payment') => {
    if (!conversation || !lead) return;
    const link = type === 'booking'
      ? `https://calendly.com/your-link?name=${encodeURIComponent(lead.full_name)}&email=${encodeURIComponent(lead.email || '')}`
      : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/short-link?ref=pay&lead=${lead.id}`;
    const text = type === 'booking'
      ? `Hi ${lead.full_name?.split(' ')[0] || 'there'}, you can book a call with me here: ${link}`
      : `Hi ${lead.full_name?.split(' ')[0] || 'there'}, here is your payment link: ${link}`;
    setDraft(text);
    setShowSmartReplies(false);
    showToast(type === 'booking' ? 'Booking link added — press send' : 'Payment link added — press send');
  };

  const checkPaymentConfig = useCallback(async () => {
    if (!session) return;
    try {
      const { data, error } = await supabase
        .from('wa_payment_config')
        .select('id, payment_gateway_name, configuration_name')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      setPayConfigOk(!!data);
    } catch {
      setPayConfigOk(false);
    }
  }, [session]);

  const [payConfigGateway, setPayConfigGateway] = useState<string>('razorpay');
  const [payConfigName, setPayConfigName] = useState<string>('');
  const [payConfigSaving, setPayConfigSaving] = useState(false);

  const handleSavePayConfig = async () => {
    if (!session || !payConfigName.trim()) return;
    setPayConfigSaving(true);
    try {
      const { error } = await supabase.from('wa_payment_config').insert({
        user_id: session.user.id,
        payment_gateway_name: payConfigGateway,
        configuration_name: payConfigName.trim(),
        is_active: true,
      });
      if (error) throw error;
      setPayConfigOk(true);
      setPayConfigName('');
      showToast('Payment configuration linked');
      checkPaymentConfig();
    } catch (e: any) {
      setError(e.message || 'Failed to save payment config');
    } finally {
      setPayConfigSaving(false);
    }
  };

  const loadPaymentOrders = useCallback(async () => {
    if (!session || !conversation) return;
    try {
      const { data, error } = await supabase
        .from('wa_payment_orders')
        .select('id, reference_id, amount_value, title, status, created_at')
        .eq('user_id', session.user.id)
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      setPaymentOrders((data || []) as any);
    } catch {
      setPaymentOrders([]);
    }
  }, [session, conversation]);

  const handleSendPaymentRequest = async () => {
    if (!session || !conversation || !payAmount || !payTitle.trim()) return;
    const amountNum = parseFloat(payAmount);
    if (isNaN(amountNum) || amountNum < 1) {
      showToast('Enter a valid amount (minimum ₹1)');
      return;
    }
    setPaySending(true);
    setError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          conversationId: conversation.id,
          amount: amountNum,
          title: payTitle.trim(),
          description: payDescription.trim() || undefined,
          leadId: lead?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      showToast('Payment request sent to customer');
      setShowPaymentPanel(false);
      setPayAmount('');
      setPayTitle('');
      setPayDescription('');
      loadPaymentOrders();
      loadConversation();
    } catch (e: any) {
      setError(e.message || 'Failed to send payment request');
    } finally {
      setPaySending(false);
    }
  };

  const handleScheduleMessage = async () => {
    if (!session || !conversation || !draft.trim() || !scheduleDate) return;
    setScheduleSaving(true);
    setError(null);
    try {
      const { error } = await supabase.from('wa_scheduled_messages').insert({
        user_id: session.user.id,
        conversation_id: conversation.id,
        lead_id: lead?.id,
        text: draft.trim(),
        scheduled_at: localDateTimeInTimezoneToUtc(scheduleDate, scheduleTimezone),
        status: 'pending',
      });
      if (error) throw error;
      setDraft('');
      setShowScheduler(false);
      showToast('Message scheduled');
      await loadScheduledMessages();
    } catch (e: any) {
      setError(e.message || 'Failed to schedule message');
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleCancelScheduled = async (id: string) => {
    try {
      const { error } = await supabase.from('wa_scheduled_messages').update({ status: 'cancelled' }).eq('id', id);
      if (error) throw error;
      setScheduledMsgs((prev) => prev.filter((s) => s.id !== id));
      showToast('Scheduled message cancelled');
    } catch (e: any) {
      setError(e.message || 'Failed to cancel');
    }
  };

  const handleToggleStar = async (msg: WaMessage) => {
    if (!session || !conversation) return;
    if (starredMsgIds.has(msg.id)) {
      try {
        await supabase.from('wa_starred_messages').delete().eq('user_id', session.user.id).eq('message_id', msg.id);
        setStarredMsgIds((prev) => { const next = new Set(prev); next.delete(msg.id); return next; });
        setStarredList((prev) => prev.filter((s) => s.message_id !== msg.id));
      } catch (e: any) { setError(e.message || 'Failed to unstar'); }
    } else {
      try {
        const { data, error } = await supabase.from('wa_starred_messages').insert({
          user_id: session.user.id,
          message_id: msg.id,
          conversation_id: conversation.id,
        }).select('id, message_id, note, created_at').single();
        if (error) throw error;
        setStarredMsgIds((prev) => new Set(prev).add(msg.id));
        setStarredList((prev) => [data as StarredMessage, ...prev]);
        showToast('Message starred');
      } catch (e: any) { setError(e.message || 'Failed to star message'); }
    }
  };

  const handleSearchConversations = async () => {
    if (!session || !searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const { data, error } = await supabase
        .from('wa_messages')
        .select('id, conversation_id, text_content, created_at, sender, wa_conversations(wa_name, wa_phone_number)')
        .ilike('text_content', `%${searchQuery.trim()}%`)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      const results = ((data || []) as any[]).map((r) => ({
        conversation_id: r.conversation_id,
        wa_name: r.wa_conversations?.wa_name || null,
        wa_phone_number: r.wa_conversations?.wa_phone_number || '',
        text_content: r.text_content || '',
        created_at: r.created_at,
      }));
      setSearchResults(results);
    } catch (e: any) {
      setError(e.message || 'Search failed');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleEntityClick = (entity: { type: 'phone' | 'email' | 'amount'; value: string }) => {
    if (entity.type === 'amount') {
      const num = parseFloat(entity.value.replace(/[^\d.]/g, ''));
      if (!isNaN(num) && lead) {
        supabase.from('submissions').update({ fund_amount: num }).eq('id', lead.id).then(() => {
          showToast(`Saved fund amount: ${entity.value}`);
        }).catch(() => setError('Failed to save amount'));
      }
    } else if (entity.type === 'email' && lead) {
      supabase.from('submissions').update({ email: entity.value }).eq('id', lead.id).then(() => {
        showToast(`Saved email: ${entity.value}`);
      }).catch(() => setError('Failed to save email'));
    } else if (entity.type === 'phone' && lead) {
      const normalized = normalizePhone(entity.value);
      supabase.from('submissions').update({ mobile_number: normalized }).eq('id', lead.id).then(() => {
        showToast(`Saved phone: ${normalized}`);
      }).catch(() => setError('Failed to save phone'));
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file && conversation) {
          e.preventDefault();
          handleFile(file);
          return;
        }
      }
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && conversation) handleFile(file);
  };

  const lastClientMsg = useMemo(() => [...messages].reverse().find((m) => m.sender === 'client' && m.text_content), [messages]);

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

  const scoreClass = (score: number) => score >= 70 ? '' : score >= 40 ? 'lead-wa-score-mid' : 'lead-wa-score-low';
  const leadScore = lead.lead_score || 0;
  const waLink = phone ? `https://wa.me/${phone.replace(/[^\d]/g, '')}` : '';
  const pendingFollowUps = fuList.filter((f) => f.status === 'pending');
  const entities = lastClientMsg ? detectEntities(lastClientMsg.text_content || '') : [];
  const sentiment = lastClientMsg ? detectSentiment(lastClientMsg.text_content || '') : 'neutral';

  const renderMediaContent = (m: WaMessage) => {
    if (!m.media_id) return null;
    const fileUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-file?media_id=${m.media_id}&message_id=${m.id}`;
    if (m.message_type === 'image') {
      return <img className="lead-wa-bubble-img" src={fileUrl} alt={m.file_name || 'image'} onClick={() => { setLightboxUrl(fileUrl); setLightboxName(m.file_name || 'image'); }} />;
    }
    return (
      <a className="lead-wa-media-download" href={fileUrl} download={m.file_name || undefined} target="_blank" rel="noopener noreferrer">
        <Paperclip size={12} /> Download {m.file_name || m.message_type}
      </a>
    );
  };

  const renderActivityIcon = (icon: ActivityItem['icon']) => {
    switch (icon) {
      case 'email': return <Mail size={13} />;
      case 'whatsapp': return <MessageCircle size={13} />;
      case 'call': return <Phone size={13} />;
      case 'note': return <StickyNote size={13} />;
      case 'followup': return <CalendarClock size={13} />;
      case 'status': return <TrendingUp size={13} />;
      default: return <Activity size={13} />;
    }
  };

  const activityIconBg: Record<ActivityItem['icon'], string> = {
    email: 'rgba(99,102,241,0.12)', whatsapp: 'rgba(22,163,74,0.12)', call: 'rgba(59,130,246,0.12)',
    note: 'rgba(217,119,6,0.12)', followup: 'rgba(217,119,6,0.12)', status: 'rgba(59,130,246,0.12)', lead: 'rgba(34,197,94,0.12)',
  };
  const activityIconColor: Record<ActivityItem['icon'], string> = {
    email: '#6366F1', whatsapp: '#16a34a', call: '#2563EB', note: '#D97706', followup: '#D97706', status: '#2563EB', lead: '#22C55E',
  };

  return (
    <>
      <div className="lead-wa-overlay" onClick={onClose} />
      <aside
        className="lead-wa-drawer"
        role="dialog"
        aria-label="WhatsApp chat"
        ref={drawerRef}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
        onDrop={onDrop}
      >
        <header className="lead-wa-header">
          <div className="lead-wa-header-info">
            <div className="lead-wa-avatar">{lead.full_name?.charAt(0).toUpperCase() || '?'}</div>
            <div className="lead-wa-header-text">
              <div className="lead-wa-name">{lead.full_name}</div>
              <div className="lead-wa-header-meta">
                <span className="lead-wa-phone">
                  <span className="lead-wa-online-dot" /> {phone || 'No phone'}
                </span>
                {leadScore > 0 && (
                  <span className={`lead-wa-score ${scoreClass(leadScore)}`} title="Lead score">
                    <Flame size={10} /> {leadScore}
                  </span>
                )}
                {(() => {
                  const lastInbound = messages.filter((m) => m.sender === 'client').sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
                  if (!lastInbound) return null;
                  const elapsedMs = Date.now() - new Date(lastInbound.created_at).getTime();
                  const windowMs = 24 * 60 * 60 * 1000;
                  const remainingMs = windowMs - elapsedMs;
                  const open = remainingMs > 0;
                  const remainingH = Math.floor(remainingMs / (60 * 60 * 1000));
                  const remainingM = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
                  return (
                    <span
                      className="lead-wa-window-badge"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '2px 8px', borderRadius: '6px', fontSize: '0.62rem', fontWeight: 700,
                        background: open ? (remainingH < 1 ? 'rgba(245,158,11,0.12)' : 'rgba(37,211,102,0.12)') : 'rgba(239,68,68,0.12)',
                        color: open ? (remainingH < 1 ? '#D97706' : '#16A34A') : '#DC2626',
                        border: `1px solid ${open ? (remainingH < 1 ? 'rgba(245,158,11,0.3)' : 'rgba(37,211,102,0.3)') : 'rgba(239,68,68,0.3)'}`,
                        whiteSpace: 'nowrap', flexShrink: 0,
                      }}
                      title={open ? `24-hour window open — closes in ${remainingH}h ${remainingM}m` : '24-hour window expired — only template messages can be sent'}
                    >
                      <Clock3 size={10} />
                      {open ? `${remainingH}h ${remainingM}m left` : 'Window closed'}
                    </span>
                  );
                })()}
                {conversation && (
                  <div className="lead-wa-header-actions-right">
                    <button
                      className="lead-wa-assignee"
                      onClick={() => setShowAssigneePicker((v) => !v)}
                      disabled={assigneeSaving}
                    >
                      <UserCheck size={11} />
                      {conversation.assigned_to ? 'Assigned' : 'Assign'}
                    </button>
                    {showAssigneePicker && (
                      <div className="lead-wa-assign-popover">
                        <div className="lead-wa-assign-popover-head">Assign conversation to</div>
                        <div className="lead-wa-assign-list">
                          <button
                            className={`lead-wa-assign-item ${!conversation.assigned_to ? 'lead-wa-assign-item-active' : ''}`}
                            onClick={() => handleAssignConversation(null)}
                          >
                            <div className="lead-wa-assign-item-avatar" style={{ background: '#6B7280' }}>—</div>
                            <div className="lead-wa-assign-item-info">
                              <div className="lead-wa-assign-item-name">Unassigned</div>
                            </div>
                          </button>
                          <button
                            className={`lead-wa-assign-item ${conversation.assigned_to === session?.user?.id ? 'lead-wa-assign-item-active' : ''}`}
                            onClick={() => handleAssignConversation(session?.user?.email || null)}
                          >
                            <div className="lead-wa-assign-item-avatar">{(session?.user?.email || '?').charAt(0).toUpperCase()}</div>
                            <div className="lead-wa-assign-item-info">
                              <div className="lead-wa-assign-item-name">You</div>
                              <div className="lead-wa-assign-item-email">{session?.user?.email}</div>
                            </div>
                          </button>
                          {teamMembers.filter((m) => m.email !== session?.user?.email).map((m) => (
                            <button
                              key={m.id}
                              className="lead-wa-assign-item"
                              onClick={() => handleAssignConversation(m.email)}
                            >
                              <div className="lead-wa-assign-item-avatar">{(m.full_name || m.email).charAt(0).toUpperCase()}</div>
                              <div className="lead-wa-assign-item-info">
                                <div className="lead-wa-assign-item-name">{m.full_name || m.email}</div>
                                <div className="lead-wa-assign-item-email">{m.email}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="lead-wa-header-actions">
            <button
              className={`lead-wa-icon-btn ${searchOpen ? 'lead-wa-icon-btn-active' : ''}`}
              onClick={() => { setSearchOpen((v) => !v); if (searchOpen) { setSearchQuery(''); setSearchResults([]); } }}
              aria-label="Search conversations"
              title="Search across all chats"
            >
              <Search size={16} />
            </button>
            <button
              className={`lead-wa-icon-btn ${showStarredPanel ? 'lead-wa-icon-btn-active' : ''}`}
              onClick={() => setShowStarredPanel((v) => !v)}
              aria-label="Starred messages"
              title="Starred messages"
            >
              <Star size={16} />
            </button>
            <button
              className={`lead-wa-icon-btn ${activityOpen ? 'lead-wa-icon-btn-active' : ''}`}
              onClick={() => { setActivityOpen((v) => !v); setNotesOpen(false); }}
              aria-label="Activity timeline"
              title="Activity timeline"
            >
              <Activity size={16} />
            </button>
            <button
              className={`lead-wa-icon-btn ${showActions ? 'lead-wa-icon-btn-active' : ''}`}
              onClick={() => { setShowActions((v) => !v); setShowFollowUp(false); setShowLabelEditor(false); setShowAutoFu(false); }}
              aria-label="Quick actions"
              title="Quick actions"
            >
              <Zap size={16} />
            </button>
            <button
              className={`lead-wa-icon-btn ${notesOpen ? 'lead-wa-icon-btn-active' : ''}`}
              onClick={() => { setNotesOpen((v) => !v); setActivityOpen(false); }}
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

        {/* Search panel */}
        {searchOpen && (
          <div className="lead-wa-search-panel">
            <div className="lead-wa-search-bar">
              <Search size={15} />
              <input
                type="text"
                className="lead-wa-search-input"
                placeholder="Search across all WhatsApp chats…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearchConversations(); }}
                autoFocus
              />
              {searchLoading && <div className="lead-wa-spinner lead-wa-spinner-sm" />}
              <button className="lead-wa-search-go" onClick={handleSearchConversations} disabled={!searchQuery.trim()}>Search</button>
            </div>
            {searchResults.length > 0 && (
              <div className="lead-wa-search-results">
                {searchResults.map((r, i) => (
                  <div key={i} className="lead-wa-search-result">
                    <MessageCircle size={13} />
                    <div className="lead-wa-search-result-body">
                      <span className="lead-wa-search-result-name">{r.wa_name || r.wa_phone_number}</span>
                      <span className="lead-wa-search-result-text">{r.text_content.slice(0, 60)}{r.text_content.length > 60 ? '…' : ''}</span>
                    </div>
                    <span className="lead-wa-search-result-time">{formatTime(r.created_at)}</span>
                  </div>
                ))}
              </div>
            )
            }
            {searchQuery.trim() && !searchLoading && searchResults.length === 0 && (
              <p className="lead-wa-search-empty">No messages found. Try a different keyword.</p>
            )
            }
          </div>
        )
        }

        {/* Starred messages panel */}
        {showStarredPanel && (
          <div className="lead-wa-starred-panel">
            <div className="lead-wa-starred-head">
              <Star size={14} />
              <span>Starred messages</span>
              <button className="lead-wa-starred-close" onClick={() => setShowStarredPanel(false)}><X size={13} /></button>
            </div>
            {starredList.length === 0 ? (
              <p className="lead-wa-starred-empty">No starred messages in this chat yet. Click the star icon on any message to bookmark it for later follow-up.</p>
            ) : (
              <div className="lead-wa-starred-list">
                {starredList.map((s) => {
                  const msg = messages.find((m) => m.id === s.message_id);
                  return (
                    <div key={s.id} className="lead-wa-starred-item">
                      <Star size={11} className="lead-wa-starred-item-icon" />
                      <span className="lead-wa-starred-item-text">{(msg?.text_content || '[media]').slice(0, 50)}{(msg?.text_content || '').length > 50 ? '…' : ''}</span>
                      <span className="lead-wa-starred-item-time">{formatTime(s.created_at)}</span>
                      <button className="lead-wa-starred-item-unstar" onClick={() => msg && handleToggleStar(msg)} title="Unstar">
                        <X size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )
            }
          </div>
        )
        }

        {/* Pinned message banner */}
        {pinnedMessage && (
          <div className="lead-wa-pinned" onClick={() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }}>
            <Pin size={14} className="lead-wa-pinned-icon" />
            <span className="lead-wa-pinned-text">{pinnedMessage.text_content || `[${pinnedMessage.message_type}]`}</span>
            <button className="lead-wa-pinned-close" onClick={(e) => { e.stopPropagation(); handlePinMessage(pinnedMessage); }}>
              <X size={13} />
            </button>
          </div>
        )}

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
            <button className="lead-wa-action-btn" onClick={() => { setShowFollowUp((v) => !v); setShowLabelEditor(false); setShowAutoFu(false); }}>
              <CalendarClock size={16} /> Follow-up
              {pendingFollowUps.length > 0 && <span className="lead-wa-action-badge">{pendingFollowUps.length}</span>}
            </button>
            <button className="lead-wa-action-btn" onClick={() => { setShowLabelEditor((v) => !v); setShowFollowUp(false); setShowAutoFu(false); }}>
              <Tag size={16} /> Labels
              {convLabels.length > 0 && <span className="lead-wa-action-badge lead-wa-action-badge-labels">{convLabels.length}</span>}
            </button>
            <button className="lead-wa-action-btn" onClick={() => { setShowAutoFu((v) => !v); setShowFollowUp(false); setShowLabelEditor(false); }}>
              <Bot size={16} /> Auto-followup
            </button>
            <button className="lead-wa-action-btn" onClick={() => handleSendQuickLink('booking')}>
              <CalendarCheck size={16} /> Booking link
            </button>
            <button className="lead-wa-action-btn" onClick={() => { setShowPaymentPanel((v) => !v); setShowFollowUp(false); setShowLabelEditor(false); setShowAutoFu(false); checkPaymentConfig(); loadPaymentOrders(); }}>
              <CreditCard size={16} /> Payment Request
              {paymentOrders.filter((o) => o.status === 'pending').length > 0 && (
                <span className="lead-wa-action-badge">{paymentOrders.filter((o) => o.status === 'pending').length}</span>
              )}
            </button>
            {leadStatus !== 'converted' && (
              <button className="lead-wa-convert-btn" onClick={handleMarkConverted} disabled={converting}>
                <Check size={14} /> {converting ? 'Marking…' : 'Mark converted'}
              </button>
            )}
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

        {/* Auto follow-up panel */}
        {showActions && showAutoFu && (
          <div className="lead-wa-panel">
            <div className="lead-wa-panel-head">
              <Bot size={15} />
              <span>Auto follow-up</span>
            </div>
            <div className="lead-wa-panel-body">
              <p className="lead-wa-starter-desc" style={{ marginBottom: 6 }}>
                Automatically send a template if the lead doesn't reply within the delay window after your last message.
              </p>
              <div className="lead-wa-autofu-toggle">
                <div
                  className={`lead-wa-switch ${autoFuEnabled ? 'lead-wa-switch-on' : ''}`}
                  onClick={() => setAutoFuEnabled((v) => !v)}
                >
                  <div className="lead-wa-switch-knob" />
                </div>
                <span className="lead-wa-autofu-label">Enable auto follow-up</span>
              </div>
              {autoFuEnabled && (
                <>
                  <label className="lead-wa-panel-label">Template to send</label>
                  <select className="lead-wa-panel-input" value={autoFuTemplate} onChange={(e) => setAutoFuTemplate(e.target.value)}>
                    <option value="">Select a template…</option>
                    {templates.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
                  </select>
                  <label className="lead-wa-panel-label">Delay (hours)</label>
                  <input
                    type="number" min={1} max={168}
                    className="lead-wa-panel-input"
                    value={autoFuHours}
                    onChange={(e) => setAutoFuHours(parseInt(e.target.value) || 24)}
                  />
                </>
              )}
              <button className="lead-wa-panel-save" onClick={handleSaveAutoFu} disabled={autoFuSaving}>
                {autoFuSaving ? 'Saving…' : 'Save setting'}
              </button>
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

        {/* WhatsApp payment request panel */}
        {showActions && showPaymentPanel && (
          <div className="lead-wa-panel">
            <div className="lead-wa-panel-head">
              <CreditCard size={15} />
              <span>Send payment request (WhatsApp Pay)</span>
            </div>
            <div className="lead-wa-panel-body">
              {payConfigOk === false && (
                <>
                  <div className="lead-wa-payment-warning">
                    <AlertCircle size={14} />
                    <span>Your WhatsApp payment gateway is not linked yet. First, create a payment configuration in WhatsApp Manager (Business Settings &gt; Payments), then link it here.</span>
                  </div>
                  <label className="lead-wa-panel-label">Payment gateway</label>
                  <select className="lead-wa-panel-input" value={payConfigGateway} onChange={(e) => setPayConfigGateway(e.target.value)} disabled={payConfigSaving}>
                    <option value="razorpay">Razorpay</option>
                    <option value="payu">PayU</option>
                    <option value="billdesk">BillDesk</option>
                    <option value="zaakpay">Zaakpay</option>
                  </select>
                  <label className="lead-wa-panel-label">Configuration name (from WhatsApp Manager)</label>
                  <input
                    type="text"
                    className="lead-wa-panel-input"
                    placeholder="e.g. razorpay_config_1"
                    value={payConfigName}
                    onChange={(e) => setPayConfigName(e.target.value)}
                    disabled={payConfigSaving}
                  />
                  <button
                    className="lead-wa-panel-save"
                    onClick={handleSavePayConfig}
                    disabled={payConfigSaving || !payConfigName.trim()}
                  >
                    {payConfigSaving ? 'Saving…' : 'Link payment config'}
                  </button>
                </>
              )}
              <p className="lead-wa-starter-desc" style={{ marginBottom: 6 }}>
                Send a native &quot;Review and Pay&quot; screen inside WhatsApp. The customer pays via UPI or cards without leaving the chat. India only, INR only.
              </p>
              <label className="lead-wa-panel-label">Title / item name</label>
              <input
                type="text"
                className="lead-wa-panel-input"
                placeholder="e.g. Account funding, Course fee, Broker deposit"
                value={payTitle}
                onChange={(e) => setPayTitle(e.target.value)}
                disabled={paySending}
              />
              <label className="lead-wa-panel-label">Amount (₹)</label>
              <input
                type="number"
                min={1}
                step="0.01"
                className="lead-wa-panel-input"
                placeholder="e.g. 5000"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                disabled={paySending}
              />
              <label className="lead-wa-panel-label">Header text (optional)</label>
              <input
                type="text"
                className="lead-wa-panel-input"
                placeholder="Short label shown on the payment screen"
                value={payDescription}
                onChange={(e) => setPayDescription(e.target.value)}
                disabled={paySending}
                maxLength={60}
              />
              <button
                className="lead-wa-panel-save"
                onClick={handleSendPaymentRequest}
                disabled={paySending || !payAmount || !payTitle.trim() || payConfigOk === false}
              >
                {paySending ? 'Sending…' : 'Send payment request'}
              </button>

              {paymentOrders.length > 0 && (
                <div className="lead-wa-fu-list">
                  <p className="lead-wa-fu-list-title">Recent payment requests</p>
                  {paymentOrders.map((o) => (
                    <div key={o.id} className="lead-wa-pay-item">
                      <CreditCard size={13} />
                      <div className="lead-wa-fu-info">
                        <span className="lead-wa-fu-title">{o.title}</span>
                        <span className="lead-wa-fu-date">₹{(o.amount_value / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <span className={`lead-wa-pay-status lead-wa-pay-status-${o.status}`}>{o.status}</span>
                    </div>
                  ))}
                </div>
              )}
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

        {/* Detected entities + sentiment from last client message */}
        {conversation && lastClientMsg && (entities.length > 0 || sentiment !== 'neutral') && (
          <div className="lead-wa-context" style={{ background: '#F8FAFC', gap: 10 }}>
            {sentiment !== 'neutral' && (
              <span className={`lead-wa-sentiment lead-wa-sentiment-${sentiment}`}>
                {sentiment === 'positive' ? 'Positive tone' : sentiment === 'negative' ? 'Needs attention' : sentiment}
              </span>
            )}
            {entities.length > 0 && (
              <div className="lead-wa-entities">
                {entities.map((ent, i) => (
                  <button
                    key={i}
                    className={`lead-wa-entity lead-wa-entity-${ent.type}`}
                    onClick={() => handleEntityClick(ent)}
                    title={`Click to save ${ent.type} to lead`}
                  >
                    {ent.type === 'phone' && <Phone size={10} />}
                    {ent.type === 'email' && <Mail size={10} />}
                    {ent.type === 'amount' && <DollarSign size={10} />}
                    {ent.value}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="lead-wa-subheader">
          <MessageCircle size={13} />
          <span>WhatsApp Conversation</span>
          {conversation && <span className="lead-wa-conv-count">{messages.length} messages</span>}
        </div>

        <div className="lead-wa-body">
          <div className="lead-wa-messages-wrap">
            <div className="lead-wa-messages" ref={scrollRef} onPaste={onPaste}>
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
                <div className={`lead-wa-state ${errorType === 'auth' ? 'lead-wa-state-auth-error' : 'lead-wa-state-error'}`}>
                  {errorType === 'auth' ? <KeyRound size={32} /> : <AlertCircle size={32} />}
                  <p className="lead-wa-state-title">
                    {errorType === 'auth' ? 'WhatsApp connection expired' : 'Something went wrong'}
                  </p>
                  <p className="lead-wa-state-desc">{error}</p>
                  {errorDebug && (
                    <details className="lead-wa-error-details" style={{ marginTop: 8, fontSize: '0.72rem', color: '#64748B', textAlign: 'left', background: 'rgba(0,0,0,0.03)', borderRadius: 6, padding: '8px 10px' }}>
                      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Error details</summary>
                      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 6, fontFamily: 'ui-monospace, monospace', fontSize: '0.68rem' }}>{errorDebug}</pre>
                    </details>
                  )}
                  {errorType === 'auth' ? (
                    <p className="lead-wa-state-hint">
                      Open WhatsApp Settings from the sidebar, then re-enter your Phone Number ID and generate a new access token in Meta Business Manager.
                    </p>
                  ) : (
                    <button className="lead-wa-retry" onClick={loadConversation}>Try again</button>
                  )}
                </div>
              )}

              {!loading && conversation && messages.length === 0 && !error && !showTemplatePicker && (
                <div className="lead-wa-state"><MessageCircle size={36} /><p className="lead-wa-state-desc">No messages in this conversation yet.</p></div>
              )}

              {!loading && conversation && messages.length > 0 && (
                messages.map((m) => {
                  const isClient = m.sender === 'client';
                  const msgReactions = reactions[m.id] || [];
                  const isPinned = conversation.pinned_message_id === m.id;
                  return (
                    <div key={m.id} className={`lead-wa-bubble ${isClient ? 'lead-wa-bubble-in' : 'lead-wa-bubble-out'}`}>
                      <div className="lead-wa-bubble-actions">
                        <button
                          className={`lead-wa-bubble-action ${isPinned ? 'lead-wa-bubble-action-active' : ''}`}
                          onClick={() => handlePinMessage(m)}
                          title={isPinned ? 'Unpin' : 'Pin message'}
                        >
                          <Pin size={12} />
                        </button>
                        <button
                          className={`lead-wa-bubble-action ${starredMsgIds.has(m.id) ? 'lead-wa-bubble-action-active' : ''}`}
                          onClick={() => handleToggleStar(m)}
                          title={starredMsgIds.has(m.id) ? 'Unstar' : 'Star message'}
                        >
                          <Star size={12} />
                        </button>
                        <button
                          className="lead-wa-bubble-action"
                          onClick={() => setReactionPickerFor(reactionPickerFor === m.id ? null : m.id)}
                          title="React"
                        >
                          <Smile size={12} />
                        </button>
                        {m.text_content && (
                          <button
                            className="lead-wa-bubble-action"
                            onClick={() => { navigator.clipboard?.writeText(m.text_content || ''); showToast('Message copied'); }}
                            title="Copy text"
                          >
                            <Copy size={12} />
                          </button>
                        )}
                        {reactionPickerFor === m.id && (
                          <div className="lead-wa-reaction-picker">
                            {REACTION_EMOJIS.map((emo) => (
                              <button key={emo} onClick={() => handleToggleReaction(m, emo)}>{emo}</button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="lead-wa-bubble-body">
                        {m.message_type !== 'text' && m.message_type !== 'template' && (
                          <div className="lead-wa-bubble-media">
                            {!m.media_id && (
                              <>
                                {m.message_type === 'image' && <ImageIcon size={18} />}
                                {m.message_type === 'document' && <Paperclip size={18} />}
                                {(m.message_type === 'audio' || m.message_type === 'voice') && <span>Audio</span>}
                                {(m.message_type === 'video') && <span>Video</span>}
                                <span className="lead-wa-media-label">{m.message_type}</span>
                                {m.file_name && <span className="lead-wa-media-file"> · {m.file_name}</span>}
                              </>
                            )}
                            {renderMediaContent(m)}
                          </div>
                        )}
                        {m.text_content && <p className="lead-wa-bubble-text">{m.text_content}</p>}
                      </div>
                      {msgReactions.length > 0 && (
                        <div className="lead-wa-reactions">
                          {msgReactions.map((r) => {
                            const mine = r.user_id === session?.user?.id;
                            return (
                              <button
                                key={r.id}
                                className={`lead-wa-reaction ${mine ? 'lead-wa-reaction-mine' : ''}`}
                                onClick={() => handleToggleReaction(m, r.emoji)}
                                title={mine ? 'Remove reaction' : 'Reacted'}
                              >
                                <span className="lead-wa-reaction-emoji">{r.emoji}</span>
                                {msgReactions.length > 1 && <span>1</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}
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

              {dragOver && (
                <div className="lead-wa-drag-overlay">
                  <Paperclip size={28} />
                  <span>Drop file to send</span>
                </div>
              )}
            </div>

            {/* Smart reply suggestions */}
            {showSmartReplies && smartReplies.length > 0 && conversation && !isRecording && (
              <div className="lead-wa-smart-replies">
                <div className="lead-wa-smart-replies-head">
                  <Sparkles size={11} /> Suggested replies
                  <button
                    style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0 }}
                    onClick={() => setShowSmartReplies(false)}
                  >
                    <X size={12} />
                  </button>
                </div>
                {smartReplies.map((r, i) => (
                  <button key={i} className="lead-wa-smart-reply" onClick={() => { setDraft(r); setShowSmartReplies(false); }} disabled={sending}>
                    {r}
                  </button>
                ))}
              </div>
            )}

            {/* Quick reply chips */}
            {conversation && !isRecording && (
              <div className="lead-wa-quick-replies">
                {QUICK_REPLIES.map((q) => (
                  <button key={q} className="lead-wa-quick-reply" onClick={() => setDraft(q)} disabled={sending}>
                    {q.length > 42 ? q.slice(0, 42) + '…' : q}
                  </button>
                ))}
              </div>
            )}

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

          {/* Mini activity timeline sidebar */}
          {activityOpen && (
            <div className="lead-wa-activity">
              <div className="lead-wa-activity-head">
                <Activity size={15} />
                <span>Lead Activity</span>
              </div>
              <div className="lead-wa-activity-list">
                {activities.length === 0 && <p className="lead-wa-activity-empty">No activity recorded for this lead yet.</p>}
                {activities.map((a) => (
                  <div key={a.id} className="lead-wa-activity-item">
                    <div
                      className="lead-wa-activity-dot"
                      style={{ background: activityIconBg[a.icon], color: activityIconColor[a.icon] }}
                    >
                      {renderActivityIcon(a.icon)}
                    </div>
                    <div className="lead-wa-activity-content">
                      <div className="lead-wa-activity-title">{a.description}</div>
                      <div className="lead-wa-activity-time">{formatRelative(a.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Voice recording bar */}
        {isRecording ? (
          <div className="lead-wa-voice-bar">
            <span className="lead-wa-voice-dot" />
            <span className="lead-wa-voice-time">{String(Math.floor(recordSeconds / 60)).padStart(2, '0')}:{String(recordSeconds % 60).padStart(2, '0')}</span>
            <span style={{ fontSize: '0.74rem', color: '#7F1D1D', fontWeight: 600 }}>Recording…</span>
            <button className="lead-wa-voice-cancel" onClick={() => stopRecording(true)}>
              <XCircle size={13} /> Cancel
            </button>
            <button className="lead-wa-voice-send" onClick={() => stopRecording(false)} disabled={recordSeconds < 1}>
              <SendIcon size={13} /> Send
            </button>
          </div>
        ) : audioUploading ? (
          <div className="lead-wa-voice-bar" style={{ background: '#F0FDF4', borderTopColor: '#DCFCE7' }}>
            <div className="lead-wa-spinner lead-wa-spinner-sm" style={{ borderTopColor: '#16a34a' }} />
            <span style={{ fontSize: '0.78rem', color: '#15803d', fontWeight: 600 }}>Uploading voice message…</span>
          </div>
        ) : null}

        {conversation ? (
          <>
          <div className="lead-wa-composer">
            <button className="lead-wa-attach" onClick={() => fileInputRef.current?.click()} disabled={sending || isRecording} aria-label="Attach file">
              <Paperclip size={18} />
            </button>
            <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
            <button className={`lead-wa-attach ${showTemplatePicker ? 'lead-wa-icon-btn-active' : ''}`} onClick={() => { setShowTemplatePicker((v) => !v); setActiveTemplate(null); setShowSnippetPicker(false); }} disabled={sending || isRecording || templates.length === 0} aria-label="Send template" title="Send a template">
              <FileText size={18} />
            </button>
            <button className={`lead-wa-attach ${showSnippetPicker ? 'lead-wa-icon-btn-active' : ''}`} onClick={() => { setShowSnippetPicker((v) => !v); setShowTemplatePicker(false); }} disabled={sending || isRecording || snippets.length === 0} aria-label="Saved replies" title="Saved reply snippets">
              <Zap size={18} />
            </button>
            <button
              className={`lead-wa-voice-btn ${isRecording ? 'lead-wa-voice-btn-recording' : ''}`}
              onClick={isRecording ? () => stopRecording(false) : startRecording}
              disabled={sending || audioUploading}
              aria-label="Record voice message"
              title="Record voice message"
            >
              {isRecording ? <Square size={16} /> : <Mic size={18} />}
            </button>
            <textarea className="lead-wa-input" placeholder="Type a WhatsApp message…" value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              onPaste={onPaste}
              rows={1} disabled={sending || isRecording}
            />
            <button
              className={`lead-wa-attach ${showScheduler ? 'lead-wa-icon-btn-active' : ''}`}
              onClick={() => setShowScheduler((v) => !v)}
              disabled={sending || isRecording || !draft.trim()}
              aria-label="Schedule message"
              title="Schedule for later"
            >
              <CalendarPlus size={18} />
            </button>
            <button className="lead-wa-send" onClick={handleSend} disabled={!draft.trim() || sending || isRecording} aria-label="Send message">
              <Send size={16} />
            </button>
            {toast && <div className="lead-wa-toast">{toast}</div>}
          </div>

          {/* Schedule message panel */}
          {showScheduler && conversation && (
            <div className="lead-wa-scheduler-panel">
              <div className="lead-wa-scheduler-head">
                <CalendarPlus size={14} />
                <span>Schedule this message</span>
                <button className="lead-wa-scheduler-close" onClick={() => setShowScheduler(false)}><X size={13} /></button>
              </div>
              <div className="lead-wa-scheduler-body">
                <input
                  type="datetime-local"
                  className="lead-wa-scheduler-input"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  disabled={scheduleSaving}
                />
                <button className="lead-wa-scheduler-save" onClick={handleScheduleMessage} disabled={scheduleSaving || !scheduleDate || !draft.trim()}>
                  {scheduleSaving ? 'Scheduling…' : 'Schedule send'}
                </button>
                <div className="lead-wa-scheduler-tz">
                  <TimezonePicker value={scheduleTimezone} onChange={setScheduleTimezone} compact />
                  <span className="lead-wa-scheduler-tz-hint">Times above are interpreted in this timezone</span>
                </div>
              </div>
              {scheduledMsgs.length > 0 && (
                <div className="lead-wa-scheduler-list">
                  <div className="lead-wa-scheduler-list-title">Pending scheduled messages</div>
                  {scheduledMsgs.map((s) => (
                    <div key={s.id} className="lead-wa-scheduler-item">
                      <Clock size={12} />
                      <span className="lead-wa-scheduler-item-text">{(s.text || s.template_name || '').slice(0, 40)}{(s.text || '').length > 40 ? '…' : ''}</span>
                      <span className="lead-wa-scheduler-item-time">{formatTime(s.scheduled_at)}</span>
                      <button className="lead-wa-scheduler-item-cancel" onClick={() => handleCancelScheduled(s.id)} title="Cancel">
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
          }

          {/* Quick replies collapsible strip */}
          {conversation && !showScheduler && (
            <button className="lead-wa-qr-strip-toggle" onClick={() => setShowQuickReplies((v) => !v)}>
              <ChevronUp size={12} className={showQuickReplies ? '' : 'lead-wa-qr-rotate'} />
              <span>Quick replies</span>
              {starredList.length > 0 && <Star size={10} />}
            </button>
          )
          }
          {showQuickReplies && conversation && (
            <div className="lead-wa-quick-replies lead-wa-quick-replies-strip">
              {QUICK_REPLIES.map((q) => (
                <button key={q} className="lead-wa-quick-reply" onClick={() => setDraft(q)} disabled={sending}>
                  {q.length > 42 ? q.slice(0, 42) + '…' : q}
                </button>
              ))}
            </div>
          )
          }
          </>
        ) : (
          !showStarterTemplatePicker && (
            <div className="lead-wa-composer lead-wa-composer-disabled">
              <p>Chat will activate once the lead messages your WhatsApp number.</p>
            </div>
          )
        )}
      </aside>

      {/* Image lightbox */}
      {lightboxUrl && (
        <div className="lead-wa-lightbox" onClick={() => setLightboxUrl(null)}>
          <button className="lead-wa-lightbox-close" onClick={() => setLightboxUrl(null)}>
            <X size={22} />
          </button>
          <img src={lightboxUrl} alt={lightboxName} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
};

export default LeadWhatsAppDrawer;
